/** Builds copyable localhost and SSH-forwarding instructions for the UI's two loopback listeners. */
export interface ForwardingGuide {
  localUrl: string;
  sshCommand: string;
}

const cleanPort = (port: string, fallback: string): string =>
  /^\d{1,5}$/.test(port) ? port : fallback;

/** One SSH command carries the main Studio and, when known, its isolated test-bench listener. */
export function forwardingGuide(
  uiPort: string,
  sandboxPort?: string,
): ForwardingGuide {
  const main = cleanPort(uiPort, "8321");
  const sandbox = sandboxPort ? cleanPort(sandboxPort, "") : "";
  const forwards = [
    `-L ${main}:127.0.0.1:${main}`,
    ...(sandbox ? [`-L ${sandbox}:127.0.0.1:${sandbox}`] : []),
  ];
  return {
    localUrl: `http://localhost:${main}`,
    sshCommand: `ssh ${forwards.join(" ")} user@server`,
  };
}
