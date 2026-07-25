/** Studio boot-failure screen with direct recovery and Remote Access setup links. */
import { useState } from "react";
import type { JSX } from "react";
import { copyText } from "../_shared/clipboard";
import { Stamp } from "../components/stamp";
import type { BootProblem } from "./boot-error";

export function BootErrorScreen({ problem }: { problem: BootProblem | null }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const copyCommand = (): void => {
    if (!problem?.sshCommand) return;
    void copyText(problem.sshCommand).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      id="shell"
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        padding: "2rem",
        fontFamily: "var(--font-body, system-ui)",
      }}
    >
      <div role="alert" style={{ maxWidth: "38rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.75rem" }}>Studio could not start</h1>
        <p style={{ margin: 0, color: "var(--text-soft)" }}>
          {problem?.message ?? "Settings are unreadable. Fix or restore settings.json, then reload."}
        </p>
        {problem?.localUrl ? (
          <div style={{ marginTop: "1.25rem", textAlign: "left" }}>
            <p>
              Open the forwarded address on <strong>this computer</strong>, not the server or
              container address:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <a
                href={problem.localUrl}
                style={{
                  padding: "0.6rem 0.8rem",
                  border: "2px solid var(--edge)",
                  background: "var(--panel)",
                }}
              >
                Open Studio
              </a>
              {problem.remoteSetupUrl ? (
                <a
                  href={problem.remoteSetupUrl}
                  style={{
                    padding: "0.6rem 0.8rem",
                    border: "2px solid var(--edge)",
                    background: "var(--panel)",
                  }}
                >
                  Open Remote Access setup
                </a>
              ) : null}
            </div>
            {problem.sshCommand ? (
              <>
                <p>Start the tunnel first, replacing the last two placeholders:</p>
                <code
                  style={{
                    display: "block",
                    padding: "0.75rem",
                    background: "var(--panel)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {problem.sshCommand}
                </code>
                <div style={{ marginTop: "0.75rem" }}>
                  <Stamp onClick={copyCommand}>
                    {copied ? "SSH command copied" : "Copy SSH command"}
                  </Stamp>
                </div>
              </>
            ) : null}
            {problem.sandboxNote ? (
              <p style={{ color: "var(--text-soft)" }}>{problem.sandboxNote}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
