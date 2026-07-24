/**
 * The LAN remote-access listener: a LAN-bound Bun.serve with a self-signed cert that gates every device
 * through the connect-code + host-approval flow (LanHost) before serving the app. A device with no
 * approved session gets the code page; once it enters the right code it becomes "pending" and waits for
 * the host to approve; only then is the real app served. This flow IS the LAN security (no Tailscale
 * identity on a local network), so nothing bypasses it.
 */
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { json } from "../server-security";
import type { LanHost, LanSessionStatus } from "./lan-host";

const COOKIE = "hoplight-lan";

export interface LanServerHandle {
  origin: string;
  fingerprint: string;
  stop: () => void;
}

export interface LanServerOptions {
  lanHost: LanHost;
  /** the app handler for approved sessions (createHandler with lanApproved: true). */
  appHandler: (req: Request) => Promise<Response>;
  port: number;
  certDir: string;
  /** the host's LAN IP, for building the shown URL. */
  hostIp: string;
}

/** A friendly label for a LAN device from its User-Agent (browser + OS), falling back to the IP. */
function deviceLabel(ua: string, ip: string): string {
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod|iOS/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh|Mac OS/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";
  const br = /Firefox/i.test(ua)
    ? "Firefox"
    : /Edg\//i.test(ua)
      ? "Edge"
      : /Chrome/i.test(ua)
        ? "Chrome"
        : /Safari/i.test(ua)
          ? "Safari"
          : "";
  const desc = [br, os].filter(Boolean).join(" on ");
  return desc ? `${desc} (${ip})` : ip;
}

/** Read one cookie value from the request. */
function readCookie(req: Request, name: string): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return "";
}

async function run(argv: string[]): Promise<{ code: number; out: string }> {
  // windowsHide keeps the console-app openssl from flashing a terminal window during cert generation.
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "ignore", stdin: "ignore", windowsHide: true });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { code, out };
}

/** Generate (or reuse) a self-signed cert for the LAN listener, returning the PEMs + sha256 fingerprint.
 *  Self-signed means the device shows a one-time warning; the host verifies this fingerprint. A modern
 *  browser needs the host's IP in a subjectAltName (a CN-only cert triggers a harsher, sometimes
 *  un-bypassable error), so the current LAN IP + loopback are baked in. Regenerated if it lacks this IP. */
async function ensureCert(
  certDir: string,
  hostIp: string,
): Promise<{ cert: string; key: string; fingerprint: string }> {
  await mkdir(certDir, { recursive: true });
  const certPath = join(certDir, "lan-cert.pem");
  const keyPath = join(certDir, "lan-key.pem");
  const san = ["DNS:hoplight-lan", "IP:127.0.0.1"];
  if (hostIp && hostIp !== "unknown") san.push(`IP:${hostIp}`);

  let have = (await Bun.file(certPath).exists()) && (await Bun.file(keyPath).exists());
  if (have && hostIp && hostIp !== "unknown") {
    // Regenerate if the cached cert does not cover the current IP (address changed, or an old CN-only cert).
    const { out } = await run(["openssl", "x509", "-in", certPath, "-noout", "-ext", "subjectAltName"]);
    if (!out.includes(hostIp)) have = false;
  }
  if (!have) {
    const { code } = await run([
      "openssl", "req", "-x509", "-newkey", "rsa:2048",
      "-keyout", keyPath, "-out", certPath, "-days", "3650", "-nodes",
      "-subj", "/CN=hoplight-lan",
      "-addext", `subjectAltName=${san.join(",")}`,
    ]);
    if (code !== 0) throw new Error("lan: openssl self-signed cert generation failed");
    // Restrict the private key so a co-located local user cannot read it (best-effort; Windows uses ACLs).
    await chmod(keyPath, 0o600).catch(() => {});
  }
  const { out } = await run(["openssl", "x509", "-in", certPath, "-noout", "-fingerprint", "-sha256"]);
  const m = out.match(/Fingerprint=([0-9A-Fa-f:]+)/);
  return {
    cert: await Bun.file(certPath).text(),
    key: await Bun.file(keyPath).text(),
    fingerprint: m ? m[1]! : "",
  };
}

// The LAN login/wait pages are standalone assets served to a device that never loads the app token
// stylesheet, so their palette (mirroring the stage theme) is inlined here.
// prettier-ignore
const P = { bg: "#0a090d", face: "#17161d", edge: "#000", text: "#e7e3da", soft: "#c9c4d2", rose: "#e11d48", deep: "#b4092f", danger: "#ff8d9a", on: "#fff" }; // hardcode-ok: standalone LAN page has no token stylesheet

const PAGE_CSS =
  `body{margin:0;background:${P.bg};color:${P.text};font-family:ui-monospace,monospace;display:flex;` +
  `min-height:100vh;align-items:center;justify-content:center;padding:1.5rem}` +
  `.card{background:${P.face};border:3px solid ${P.edge};box-shadow:6px 6px 0 0 ${P.deep};padding:1.6rem;` +
  `max-width:22rem;width:100%}h1{font-size:1.1rem;margin:0 0 .3rem}p{color:${P.soft};font-size:.82rem;` +
  `line-height:1.6}input{width:100%;box-sizing:border-box;font:inherit;font-size:1.3rem;letter-spacing:` +
  `.18em;text-align:center;text-transform:uppercase;background:${P.bg};color:${P.text};border:2px solid ` +
  `${P.edge};padding:.6rem;margin:.6rem 0}button{font:inherit;font-weight:700;background:${P.rose};color:${P.on};` +
  `border:2px solid ${P.edge};box-shadow:3px 3px 0 0 ${P.edge};padding:.55rem 1rem;cursor:pointer;width:100%}` +
  `.err{color:${P.danger};font-size:.78rem;min-height:1.1rem}.dot{display:inline-block;width:8px;height:8px;` +
  `border-radius:50%;background:${P.rose};margin-right:.4rem;animation:p 1.1s infinite}` +
  `@keyframes p{0%,100%{opacity:.35}50%{opacity:1}}`;

function page(title: string, inner: string, script: string): Response {
  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title><style>${PAGE_CSS}</style></head>` +
    `<body><div class="card">${inner}</div><script>${script}</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/** The page a device sees before it is approved: enter the code, then wait for approval. */
function gatePage(status: LanSessionStatus | null): Response {
  if (status === "pending") {
    return page(
      "Waiting for approval",
      `<h1>Almost there</h1><p><span class="dot"></span>Waiting for the host to allow this device. ` +
        `Ask whoever runs the studio to approve it. This continues on its own.</p>`,
      `setInterval(async()=>{try{const r=await fetch('/lan/status');const j=await r.json();` +
        `if(j.status==='approved')location.reload()}catch(e){}},2000);`,
    );
  }
  return page(
    "Connect to the studio",
    `<h1>Enter the connect code</h1><p>Shown in Settings &gt; About &gt; Remote access on the computer ` +
      `running Hoplight.</p><input id="c" autocomplete="off" placeholder="XXX-XXX-XXX">` +
      `<div class="err" id="e"></div><button id="b">Connect</button>`,
    `const c=document.getElementById('c'),b=document.getElementById('b'),e=document.getElementById('e');` +
      `b.onclick=async()=>{e.textContent='';b.disabled=true;try{const r=await fetch('/lan/code',` +
      `{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:c.value})});` +
      `const j=await r.json();if(j.ok){location.reload()}else{e.textContent=j.retryAfterMs>1500?` +
      `('Too many tries, wait '+Math.ceil(j.retryAfterMs/1000)+'s'):'That code did not match.';b.disabled=false}}` +
      `catch(x){e.textContent='Could not reach the studio.';b.disabled=false}};` +
      `c.addEventListener('keydown',ev=>{if(ev.key==='Enter')b.click()});`,
  );
}

/** Start the LAN listener. Binds 0.0.0.0 so LAN devices can reach it; TLS keeps the code off the wire. */
export async function startLanServer(opts: LanServerOptions): Promise<LanServerHandle> {
  const { cert, key, fingerprint } = await ensureCert(opts.certDir, opts.hostIp);

  const server = Bun.serve({
    port: opts.port,
    hostname: "0.0.0.0",
    tls: { cert, key },
    async fetch(req, srv) {
      const ip = srv.requestIP(req)?.address ?? "unknown";
      const p = new URL(req.url).pathname;
      const sessionId = readCookie(req, COOKIE);

      if (p === "/lan/code" && req.method === "POST") {
        const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
        const code = typeof body?.code === "string" ? body.code : "";
        const v = await opts.lanHost.verifyCode(ip, code);
        if (!v.ok) return json({ ok: false, retryAfterMs: v.retryAfterMs }, 403);
        const id = opts.lanHost.createPending(ip, deviceLabel(req.headers.get("user-agent") ?? "", ip));
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            // No `Secure`: the LAN listener is HTTPS-only, and a self-signed cert is not a "secure
            // context" in some browsers, which then DROP Secure cookies (the device loops on the code
            // page). SameSite=Lax so the cookie rides the reload navigation. HttpOnly still stands.
            "set-cookie": `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/`,
          },
        });
      }
      if (p === "/lan/status") {
        return json({ status: sessionId ? opts.lanHost.status(sessionId) : null });
      }

      const status = sessionId ? opts.lanHost.status(sessionId) : null;
      if (status === "approved") return opts.appHandler(req);
      return gatePage(status);
    },
  });

  return {
    origin: `https://${opts.hostIp}:${server.port}`,
    fingerprint,
    stop: () => server.stop(true),
  };
}
