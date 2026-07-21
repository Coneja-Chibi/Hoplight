/**
 * RUN: rooms - every app the dock and catalog offer, both themes. The app list is read from the
 * LIVE dock, so a dropped-in app is walked on the next run with no edits here.
 */
import { makeRig } from "./shared";

const rig = await makeRig("rooms", process.env.AUDIT_URL ?? "http://127.0.0.1:8331");

for (const pass of rig.passes) {
  const apps = await rig.dockApps();
  console.log(`[${rig.theme}] dock offers: ${apps.join(" · ")}`);
  for (const title of apps) {
    if (await rig.openApp(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))) {
      await rig.stop(`room-${title.toLowerCase().replace(/\W+/g, "-")}`);
    }
  }
  // the catalog room (its door is the dashed ADD APP tile)
  if (await rig.openApp(/ADD APP|Browse apps/i)) {
    await rig.stop("room-app-catalog");
    // every catalog entry gets opened too (catalog-only rooms live here)
    const entries = await rig.buttonNames("main");
    let cat = 0;
    for (const name of entries.filter((n) => /open/i.test(n)).slice(0, 12)) {
      cat++;
      if (await rig.openApp(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))) {
        await rig.stop(`room-catalog-${name.toLowerCase().replace(/\W+/g, "-").slice(0, 30)}`);
        if (!(await rig.openApp(/ADD APP|Browse apps/i))) break;
      }
    }
  }
  if (pass === 1 && rig.passes.length > 1) await rig.flipTheme();
}

process.exit((await rig.finish("rooms")) > 0 ? 1 : 0);
