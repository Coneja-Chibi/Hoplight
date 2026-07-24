package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tailscale.com/client/tailscale/apitype"
	"tailscale.com/tailcfg"
)

// fakeResolver stands in for the live tailnet so the proxy's trust logic is tested without a node.
type fakeResolver struct {
	who *apitype.WhoIsResponse
	err error
}

func (f fakeResolver) WhoIs(_ context.Context, _ string) (*apitype.WhoIsResponse, error) {
	return f.who, f.err
}

// upstreamCapturing spins a throwaway upstream and returns a config pointed at it plus a getter for the
// last request it saw. The upstream must never be hit for a denied caller.
func upstreamCapturing(t *testing.T, onReq func(*http.Request)) config {
	t.Helper()
	up := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		onReq(r)
	}))
	t.Cleanup(up.Close)
	return config{upstream: strings.TrimPrefix(up.URL, "http://")}
}

func TestProxyDeniesUnidentifiedCaller(t *testing.T) {
	reached := false
	cfg := upstreamCapturing(t, func(*http.Request) { reached = true })
	h := newProxy(cfg, fakeResolver{}, 1, newDeviceTracker()) // nil identity

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 for unidentified caller, got %d", rec.Code)
	}
	if reached {
		t.Fatal("upstream was reached despite no resolvable identity (fail-open bug)")
	}
}

func TestProxyDeniesNonOwner(t *testing.T) {
	reached := false
	cfg := upstreamCapturing(t, func(*http.Request) { reached = true })
	// a real, resolvable tailnet user, but NOT the studio owner
	who := &apitype.WhoIsResponse{UserProfile: &tailcfg.UserProfile{ID: 2, LoginName: "someone-else@example.com"}}
	h := newProxy(cfg, fakeResolver{who: who}, 1, newDeviceTracker()) // owner is user 1, caller is user 2

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 for a non-owner tailnet user, got %d", rec.Code)
	}
	if reached {
		t.Fatal("a non-owner reached the studio (owner-gate fail-open)")
	}
}

func TestProxyFailsClosedWhenOwnerUnresolved(t *testing.T) {
	reached := false
	cfg := upstreamCapturing(t, func(*http.Request) { reached = true })
	who := &apitype.WhoIsResponse{UserProfile: &tailcfg.UserProfile{ID: 5, LoginName: "anyone@example.com"}}
	h := newProxy(cfg, fakeResolver{who: who}, 0, newDeviceTracker()) // owner could not be resolved (0)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusForbidden || reached {
		t.Fatalf("an unresolved owner must deny everyone, got %d reached=%v", rec.Code, reached)
	}
}

func TestProxyStampsIdentityFromWhoIsNotFromClient(t *testing.T) {
	var gotUser, gotNode, gotSecret string
	cfg := upstreamCapturing(t, func(r *http.Request) {
		gotUser = r.Header.Get("X-Tailscale-User")
		gotNode = r.Header.Get("X-Tailscale-Node")
		gotSecret = r.Header.Get("X-Hoplight-Sidecar-Secret")
	})
	cfg.sharedSecret = "s3cr3t"

	who := &apitype.WhoIsResponse{
		UserProfile: &tailcfg.UserProfile{ID: 1, LoginName: "owner@example.com"},
		Node:        &tailcfg.Node{StableID: "stable-1", Name: "phone.tail1234.ts.net."},
	}
	h := newProxy(cfg, fakeResolver{who: who}, 1, newDeviceTracker())

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Tailscale-User", "attacker@evil") // forged; must be overwritten from WhoIs
	h.ServeHTTP(httptest.NewRecorder(), req)

	if gotUser != "owner@example.com" {
		t.Fatalf("user header = %q, a forged client value survived", gotUser)
	}
	if gotNode != "phone.tail1234.ts.net" {
		t.Fatalf("node header = %q, trailing dot not trimmed", gotNode)
	}
	if gotSecret != "s3cr3t" {
		t.Fatalf("secret header = %q", gotSecret)
	}
}

func TestProxyOmitsSecretWhenUnset(t *testing.T) {
	present := false
	cfg := upstreamCapturing(t, func(r *http.Request) {
		_, present = r.Header["X-Hoplight-Sidecar-Secret"]
	})
	who := &apitype.WhoIsResponse{
		UserProfile: &tailcfg.UserProfile{ID: 1, LoginName: "o"},
		Node:        &tailcfg.Node{StableID: "stable-2", Name: "n."},
	}
	h := newProxy(cfg, fakeResolver{who: who}, 1, newDeviceTracker()) // cfg.sharedSecret == ""

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if present {
		t.Fatal("secret header must be absent when no shared secret is configured")
	}
}

func TestProxyDeniesNodeWithoutStableID(t *testing.T) {
	reached := false
	cfg := upstreamCapturing(t, func(*http.Request) { reached = true })
	who := &apitype.WhoIsResponse{UserProfile: &tailcfg.UserProfile{ID: 1, LoginName: "o"}} // Node nil -> no StableID
	h := newProxy(cfg, fakeResolver{who: who}, 1, newDeviceTracker())

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil)) // must not panic
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 for a device with no stable id (untrackable, un-kickable), got %d", rec.Code)
	}
	if reached {
		t.Fatal("an untrackable device (no stable id) reached the studio")
	}
}

func TestDeviceTrackerKick(t *testing.T) {
	tr := newDeviceTracker()
	tr.seen(deviceInfo{NodeID: "n1", Name: "phone", Login: "o@x"})
	tr.seen(deviceInfo{NodeID: "n2", Name: "laptop", Login: "o@x"})
	if len(tr.list()) != 2 {
		t.Fatalf("want 2 devices, got %d", len(tr.list()))
	}
	tr.block("n1")
	if !tr.isBlocked("n1") {
		t.Fatal("n1 should be blocked after a kick")
	}
	if len(tr.list()) != 1 {
		t.Fatalf("a kicked device should drop off the list, got %d", len(tr.list()))
	}
}

func TestProxyDeniesKickedDevice(t *testing.T) {
	reached := false
	cfg := upstreamCapturing(t, func(*http.Request) { reached = true })
	who := &apitype.WhoIsResponse{
		UserProfile: &tailcfg.UserProfile{ID: 1, LoginName: "o"},
		Node:        &tailcfg.Node{StableID: "kicked-node", Name: "n."},
	}
	tr := newDeviceTracker()
	tr.block("kicked-node")
	h := newProxy(cfg, fakeResolver{who: who}, 1, tr) // owner matches, but the device is kicked

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 for a kicked device, got %d", rec.Code)
	}
	if reached {
		t.Fatal("a kicked device reached the studio")
	}
}

func TestSecretsEqualConstantTime(t *testing.T) {
	if !secretsEqual("abc", "abc") {
		t.Fatal("equal secrets should match")
	}
	if secretsEqual("abc", "abd") {
		t.Fatal("different secrets must not match")
	}
	if secretsEqual("abc", "ab") {
		t.Fatal("different-length secrets must not match")
	}
}
