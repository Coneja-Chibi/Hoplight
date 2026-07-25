/** Rendered-frame proof for the four-row doctor diagnostic playbill. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { DoctorCard } from "./doctor-card";

test("renders every check and its honest status", async () => {
  const rendered = await testRender(
    <DoctorCard
      checks={[
        { id: "vault", label: "Vault", status: "ok", detail: "sealed with dpapi" },
        { id: "provider", label: "Provider", status: "warn", detail: "not connected" },
        { id: "studio", label: "Studio", status: "fail", detail: "unreadable" },
        { id: "version", label: "Version", status: "ok", detail: "Hoplight 0.1.13" },
      ]}
    />,
    { width: 72, height: 10 },
  );
  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    expect(frame).toContain("DOCTOR · 4 CHECKS");
    expect(frame).toContain("Vault");
    expect(frame).toContain("Provider");
    expect(frame).toContain("Studio");
    expect(frame).toContain("Version");
  } finally {
    await rendered.renderer.destroy();
  }
});
