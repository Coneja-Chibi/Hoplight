/**
 * /image: paste a picture from the clipboard.
 *
 * The third door onto the same action, and the one that cannot be broken by a terminal. Alt+V was
 * the original binding and is dead on Windows Terminal, which does not implement the Kitty keyboard
 * protocol, so opentui never sets the alt modifier and the chord never arrives. Ctrl+G fixes that for
 * the keyboard. This exists because a key is always a bet on what the terminal delivers, and a
 * command word is not: it is typed characters, which every terminal has always sent.
 */
import type { KitCommand } from "./command";
import { readClipboardImage } from "../render/clipboard-read";

const command: KitCommand = {
  name: "/image",
  aliases: ["/paste", "/img"],
  summary: "paste an image from the clipboard",
  group: "session",
  run: async (ctx) => {
    if (!ctx.showImage) {
      ctx.say("This shell cannot draw pictures.");
      return;
    }
    const image = await readClipboardImage();
    if (!image) {
      // Names both halves, because "nothing happened" has two very different causes and the fix
      // differs: copy an image first, or your terminal cannot draw one at all.
      ctx.say("No image on the clipboard. Copy one first, then run /image again.");
      return;
    }
    ctx.showImage(image.bytes, "shown to you only - Kit's providers take text, so this is not sent", "that clipboard image");
  },
};

export default command;
