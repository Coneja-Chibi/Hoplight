/**
 * RUN: setup - the first-run wizard against a FRESH studio: every step (walked by pressing the
 * wizard's own NEXT), the live theme flip, the custom accent tile, and the final screen.
 */
import { makeRig } from "./shared";

const rig = await makeRig("setup", process.env.AUDIT_URL ?? "http://127.0.0.1:8332");

let step = 1;
for (; step <= 8; step++) {
  await rig.stop(`setup-step-${step}`);
  // exercise the live theme flip on the first screen
  if (step === 1) {
    await rig.page.getByRole("button", { name: /Light/ }).first().click().catch(() => {});
    await rig.settle(400);
    rig.theme = "light";
    await rig.stop("setup-step-1-light");
    await rig.page.getByRole("button", { name: /Dark/ }).first().click().catch(() => {});
    await rig.settle(300);
    rig.theme = "dark";
  }
  // the custom accent tile when this step offers it
  const custom = rig.page.getByRole("button", { name: /custom/i }).first();
  if (await custom.isVisible().catch(() => false)) {
    await custom.click().catch(() => {});
    await rig.settle(400);
    await rig.stop(`setup-step-${step}-custom-accent`);
    await rig.page.keyboard.press("Escape");
  }
  // NEXT can lag a re-render; retry before concluding the wizard is done
  let advanced = false;
  for (let tries = 0; tries < 3 && !advanced; tries++) {
    const next = rig.page.getByRole("button", { name: /NEXT/i }).first();
    if (await next.isVisible().catch(() => false)) {
      await next.click({ timeout: 3000 }).catch(() => {});
      advanced = true;
    } else {
      await rig.settle(800);
    }
  }
  if (!advanced) break;
  await rig.settle(700);
}
await rig.stop("setup-final");

process.exit((await rig.finish("setup")) > 0 ? 1 : 0);
