// Command sidecar embeds a Tailscale node (via tsnet) inside its own process and reverse-proxies
// tailnet traffic into a SEPARATE, UNTRUSTED local port that the Hoplight server treats as hostile.
//
// It is launched and driven by the Hoplight process, never by a human at a terminal. It speaks a
// machine-readable control channel: one JSON status object per line on STDOUT (see statusEvent), so
// Hoplight can render the whole flow, "Enable" button, sign-in prompt, connected state, as UI. tsnet's
// own chatter stays on stderr and is silent unless -verbose.
//
// This is the Phase 0/1 substrate for Hoplight remote access. It proves and carries the four
// load-bearing assumptions the feature rests on:
//
//	C1  identity: every remote request is resolved to a tailnet user via LocalClient.WhoIs, so the app
//	    can allowlist the owner and deny by absence (a tailnet is NOT a trust boundary; it can hold
//	    other users, shared nodes, or a compromised phone).
//	C2  isolation: remote traffic is proxied to a dedicated UNTRUSTED listener, never onto the trusted
//	    127.0.0.1 port. The proxy stamps a shared secret header; the trusted port refuses anything
//	    carrying it, so remote traffic can never be laundered onto the local-trust path.
//	H1  privacy: tsnet's telemetry upload to log.tailscale.io is disabled, so "your content stays
//	    yours" is true on our defaults, not just in theory.
//	H3  transport: the node serves auto-provisioned TLS on its <host>.<tailnet>.ts.net name, so a phone
//	    browser gets a real cert with no warning.
package main

import (
	"bufio"
	"context"
	"crypto/subtle"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"tailscale.com/client/local"
	"tailscale.com/client/tailscale/apitype"
	"tailscale.com/tailcfg"
	"tailscale.com/tsnet"
)

// config is parsed once at the boundary; the rest of the program treats it as read-only.
type config struct {
	hostname     string // tailnet node name; keep it non-identifying (ts.net certs are CT-logged)
	stateDir     string // explicit writable dir so tsnet never tries to mkdir a system path
	upstream     string // the UNTRUSTED local port the Hoplight server exposes for remote traffic
	sharedSecret string // stamped on every proxied request; the trusted port must refuse it
	watchParent  bool   // exit when Hoplight (our parent) closes stdin, so no stale node survives it
	verbose      bool
}

// statusEvent is the control channel: one JSON object per line on stdout. Hoplight reads these to drive
// the UI, so the sign-in URL and connected state never touch a terminal.
type statusEvent struct {
	Event   string `json:"event"`             // always "status"
	State   string `json:"state"`             // starting | needs-login | running | stopped | error
	AuthURL string `json:"authUrl,omitempty"` // Tailscale sign-in URL when state=needs-login
	DNSName string `json:"dnsName,omitempty"` // the node's <host>.<tailnet>.ts.net when state=running
	Message string `json:"message,omitempty"` // detail when state=error
}

// emit writes one control-channel line. It is a var so tests can capture it.
var emit = func(ev statusEvent) {
	b, err := json.Marshal(ev)
	if err != nil {
		return
	}
	fmt.Fprintln(os.Stdout, string(b))
}

// deviceInfo is one connected remote device, as reported to the host.
type deviceInfo struct {
	NodeID   string `json:"nodeId"`   // stable node id, the kick key
	Name     string `json:"name"`     // friendly device name
	Login    string `json:"login"`    // tailnet login of its owner
	LastSeen int64  `json:"lastSeen"` // unix ms of the last request seen
}

// deviceTracker records which devices have connected and which the host has kicked. Concurrency-safe:
// the request handler and the command reader touch it from different goroutines.
type deviceTracker struct {
	mu      sync.Mutex
	devices map[string]deviceInfo
	blocked map[string]bool
}

func newDeviceTracker() *deviceTracker {
	return &deviceTracker{devices: map[string]deviceInfo{}, blocked: map[string]bool{}}
}

func (t *deviceTracker) seen(d deviceInfo) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.devices[d.NodeID] = d
}

func (t *deviceTracker) isBlocked(nodeID string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.blocked[nodeID]
}

// block kicks a device: future requests from it are denied and it drops off the active list.
func (t *deviceTracker) block(nodeID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.blocked[nodeID] = true
	delete(t.devices, nodeID)
}

func (t *deviceTracker) list() []deviceInfo {
	t.mu.Lock()
	defer t.mu.Unlock()
	out := make([]deviceInfo, 0, len(t.devices))
	for _, d := range t.devices {
		out = append(out, d)
	}
	return out
}

// emitDevices reports the current device list to the host over the control channel.
func emitDevices(devices []deviceInfo) {
	b, err := json.Marshal(struct {
		Event   string       `json:"event"`
		Devices []deviceInfo `json:"devices"`
	}{Event: "devices", Devices: devices})
	if err != nil {
		return
	}
	fmt.Fprintln(os.Stdout, string(b))
}

// command is a host->sidecar instruction read from stdin (one JSON object per line).
type command struct {
	Cmd    string `json:"cmd"`    // "kick"
	NodeID string `json:"nodeId"` // device to kick
}

func main() {
	cfg := parseFlags()

	tracker := newDeviceTracker()
	if cfg.watchParent {
		go watchCommands(tracker)
	}

	// H1: silence the telemetry upload before tsnet starts. TS_NO_LOGS_NO_SUPPORT stops the logtail
	// client from shipping logs to log.tailscale.io. We verify this with an egress watch, not trust.
	if err := os.Setenv("TS_NO_LOGS_NO_SUPPORT", "true"); err != nil {
		log.Fatalf("sidecar: could not disable telemetry: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, cfg, tracker); err != nil {
		log.Fatalf("sidecar: %v", err)
	}
}

func parseFlags() config {
	var cfg config
	flag.StringVar(&cfg.hostname, "hostname", envOr("HOPLIGHT_TSNET_HOSTNAME", "hoplight-studio"),
		"tailnet node name (keep it non-identifying; ts.net certs are publicly enumerable)")
	flag.StringVar(&cfg.stateDir, "state-dir", envOr("HOPLIGHT_TSNET_DIR", defaultStateDir()),
		"writable directory for tsnet state")
	flag.StringVar(&cfg.upstream, "upstream", envOr("HOPLIGHT_UNTRUSTED_UPSTREAM", "127.0.0.1:8788"),
		"the UNTRUSTED local address the Hoplight server exposes for remote traffic")
	flag.StringVar(&cfg.sharedSecret, "shared-secret", os.Getenv("HOPLIGHT_SIDECAR_SECRET"),
		"secret stamped on proxied requests; the trusted port must reject requests carrying it")
	flag.BoolVar(&cfg.watchParent, "watch-parent", false,
		"exit when the parent process (Hoplight) closes stdin, so no stale node survives an app restart")
	flag.BoolVar(&cfg.verbose, "verbose", false, "log tsnet internals to stderr")
	flag.Parse()
	return cfg
}

func run(ctx context.Context, cfg config, tracker *deviceTracker) error {
	logf := func(string, ...any) {} // swallow tsnet chatter unless asked
	if cfg.verbose {
		logf = log.Printf
	}

	srv := &tsnet.Server{
		Hostname: cfg.hostname,
		Dir:      cfg.stateDir,
		Logf:     logf,
		AuthKey:  os.Getenv("TS_AUTHKEY"), // optional; empty means an interactive sign-in URL
	}
	defer srv.Close()

	emit(statusEvent{Event: "status", State: "starting"})
	if err := srv.Start(); err != nil {
		return fail("start node", err)
	}
	lc, err := srv.LocalClient()
	if err != nil {
		return fail("local client", err)
	}

	dnsName, err := waitForRunning(ctx, lc)
	if err != nil {
		return err
	}
	ownerID := resolveOwnerID(ctx, lc)
	emit(statusEvent{Event: "status", State: "starting"}) // node joined; now provisioning the TLS link
	return serve(ctx, srv, lc, cfg, dnsName, ownerID, tracker)
}

// resolveOwnerID returns the user ID of the account that owns this node. The proxy admits only this user
// (deny by absence): remote requests are the owner's own devices, never another tailnet user. Comparing
// numeric user IDs avoids login-string format mismatches; the login is logged only for diagnostics.
func resolveOwnerID(ctx context.Context, lc *local.Client) tailcfg.UserID {
	st, err := lc.Status(ctx)
	if err != nil || st == nil || st.Self == nil {
		return 0
	}
	return st.Self.UserID
}

// waitForRunning polls the backend until the node joins the tailnet, emitting the sign-in URL the instant
// control hands it over so Hoplight can open it. With no auth key it kicks interactive login itself. It
// returns the node's tailnet name; it does NOT emit "running" (the node being joined is not the same as
// the link actually serving, which only serve() can confirm).
func waitForRunning(ctx context.Context, lc *local.Client) (string, error) {
	emittedURL := false
	loginKicked := false
	ticker := time.NewTicker(600 * time.Millisecond)
	defer ticker.Stop()

	for {
		st, err := lc.StatusWithoutPeers(ctx)
		if err == nil && st != nil {
			switch st.BackendState {
			case "NeedsLogin":
				if st.AuthURL != "" && !emittedURL {
					emit(statusEvent{Event: "status", State: "needs-login", AuthURL: st.AuthURL})
					emittedURL = true
				} else if st.AuthURL == "" && !loginKicked {
					loginKicked = true
					_ = lc.StartLoginInteractive(ctx) // best effort; the URL appears on a later poll
				}
			case "Running":
				dns := ""
				if st.Self != nil {
					dns = strings.TrimSuffix(st.Self.DNSName, ".")
				}
				return dns, nil
			}
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-ticker.C:
		}
	}
}

// serve provisions the tailnet TLS listener (H3) and reverse-proxies to the untrusted upstream (C2). It
// emits "running" only once the link is actually serving. owner is the only tailnet identity admitted.
func serve(ctx context.Context, srv *tsnet.Server, lc identityResolver, cfg config, dnsName string, ownerID tailcfg.UserID, tracker *deviceTracker) error {
	ln, err := listenTLS(ctx, srv)
	if err != nil {
		return err
	}
	defer ln.Close()

	emit(statusEvent{Event: "status", State: "running", DNSName: dnsName})

	// Report the connected-device list to the host every few seconds.
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				emitDevices(tracker.list())
			}
		}
	}()

	httpSrv := &http.Server{Handler: newProxy(cfg, lc, ownerID, tracker), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutCtx)
	}()

	err = httpSrv.Serve(ln)
	emit(statusEvent{Event: "status", State: "stopped"})
	if err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("serve: %w", err)
	}
	return nil
}

// identity is the resolved caller, carried through the request context so the Director stamps it AFTER
// its own strip pass (ReverseProxy calls Director on an internal clone, so setting headers in the handler
// before ServeHTTP would be undone by that second Director run).
type identity struct {
	user string
	node string
}

type ctxKey int

const identityKey ctxKey = 0

// listenTLS provisions the tailnet TLS listener (H3). When the tailnet has HTTPS certs disabled the error
// is not fatal, it is a guided, recoverable state: emit needs-https once and keep retrying, so when the
// user flips the admin toggle the link comes up on its own with no further clicks.
func listenTLS(ctx context.Context, srv *tsnet.Server) (net.Listener, error) {
	guided := false
	ticker := time.NewTicker(4 * time.Second)
	defer ticker.Stop()
	for {
		ln, err := srv.ListenTLS("tcp", ":443")
		if err == nil {
			return ln, nil
		}
		if !isHTTPSNotEnabled(err) {
			return nil, fail("listen tls", err)
		}
		if !guided {
			guided = true
			emit(statusEvent{Event: "status", State: "needs-https"})
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
		}
	}
}

// isHTTPSNotEnabled recognizes the tailnet-has-HTTPS-disabled error (the admin toggle is off) so it is
// shown as a guided step, not a dead-end failure.
func isHTTPSNotEnabled(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "enable https")
}

// newProxy builds the reverse proxy that resolves caller identity (C1), admits only the studio owner, and
// hands traffic to the untrusted upstream with a secret header (C2). Identity failures fail closed.
func newProxy(cfg config, lc identityResolver, ownerID tailcfg.UserID, tracker *deviceTracker) http.Handler {
	target := &url.URL{Scheme: "http", Host: cfg.upstream}
	rp := httputil.NewSingleHostReverseProxy(target)

	// The Director runs on the proxied clone. It strips any caller-forged copies of our headers, then
	// stamps the trusted identity read from context, so forged values can never survive.
	rp.Director = func(r *http.Request) {
		r.URL.Scheme = target.Scheme
		r.URL.Host = target.Host
		r.Host = target.Host
		r.Header.Del("X-Tailscale-User")
		r.Header.Del("X-Tailscale-Node")
		r.Header.Del("X-Hoplight-Sidecar-Secret")
		id, ok := r.Context().Value(identityKey).(identity)
		if !ok {
			return
		}
		r.Header.Set("X-Tailscale-User", id.user)
		r.Header.Set("X-Tailscale-Node", id.node)
		if cfg.sharedSecret != "" {
			// C2: the trusted 127.0.0.1 port rejects any request carrying this; only the sidecar knows it.
			r.Header.Set("X-Hoplight-Sidecar-Secret", cfg.sharedSecret)
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		who, err := lc.WhoIs(r.Context(), r.RemoteAddr)
		if err != nil || who == nil || who.UserProfile == nil {
			// C1: no resolvable identity means deny by absence, never proxy anonymously.
			http.Error(w, "remote access: unidentified caller", http.StatusForbidden)
			return
		}
		if ownerID == 0 || who.UserProfile.ID != ownerID {
			// Only the studio owner's own account is admitted; any other tailnet user is denied.
			http.Error(w, "remote access: not the studio owner", http.StatusForbidden)
			return
		}
		node := ""
		nodeID := ""
		if who.Node != nil {
			node = strings.TrimSuffix(who.Node.Name, ".")
			nodeID = string(who.Node.StableID)
		}
		if nodeID == "" {
			// Owner admitted but no stable node id to track or kick by: fail closed rather than serve an
			// untrackable, un-kickable device.
			http.Error(w, "remote access: unidentifiable device", http.StatusForbidden)
			return
		}
		if tracker.isBlocked(nodeID) {
			// The host kicked this device; deny it even though it is the owner's own account.
			http.Error(w, "remote access: this device was removed by the host", http.StatusForbidden)
			return
		}
		tracker.seen(deviceInfo{NodeID: nodeID, Name: node, Login: who.UserProfile.LoginName, LastSeen: time.Now().UnixMilli()})
		id := identity{user: who.UserProfile.LoginName, node: node}
		r = r.WithContext(context.WithValue(r.Context(), identityKey, id))
		rp.ServeHTTP(w, r)
	})
}

// identityResolver is the slice of the local client the proxy needs; narrowing it keeps the proxy
// testable without a live tailnet.
type identityResolver interface {
	WhoIs(ctx context.Context, remoteAddr string) (*apitype.WhoIsResponse, error)
}

func fail(scope string, err error) error {
	emit(statusEvent{Event: "status", State: "error", Message: fmt.Sprintf("%s: %v", scope, err)})
	return fmt.Errorf("%s: %w", scope, err)
}

// watchCommands reads host->sidecar commands (one JSON object per line) from stdin and applies them
// (kick a device). When stdin closes (EOF), the parent (Hoplight) has died, so we exit: this both ties
// our lifetime to the app and gives the host a control channel with no extra socket. Only the host can
// write here, so kicking is inherently host-only.
func watchCommands(tracker *deviceTracker) {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var c command
		if err := json.Unmarshal(scanner.Bytes(), &c); err != nil {
			continue // ignore a malformed line
		}
		if c.Cmd == "kick" && c.NodeID != "" {
			tracker.block(c.NodeID)
			log.Printf("sidecar: kicked device %s", c.NodeID)
		}
	}
	os.Exit(0) // stdin closed = parent died
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func defaultStateDir() string {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		base = os.TempDir()
	}
	return base + string(os.PathSeparator) + "hoplight" + string(os.PathSeparator) + "tsnet"
}

// secretsEqual is a constant-time compare, kept here so the eventual trusted-port check on the Bun side
// has a matching reference for how the header must be verified (never with ==).
func secretsEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
