/** @jsxImportSource @opentui/react */
/**
 * A file path in the transcript, as something you can act on rather than something to read and retype.
 *
 * TWO WAYS IN, and neither is the terminal's own hyperlink. OSC 8 exists and opentui reports whether
 * the terminal supports it, but it hands the URL to the OS's default handler - which for a `.json`
 * means opening it in whatever claims that extension. That is a much larger action than a person
 * means by clicking a path in a chat log, and it is not undoable by clicking again. So:
 *
 *   shift+click   reveal it in the file manager, selected, the way an editor does
 *   plain click   copy the path, because the other thing people do with a path is paste it somewhere
 *
 * Shift for the bigger action deliberately: a stray click on a transcript should not open a window.
 *
 * The path is drawn in the preset accent so it reads as a THING and not as prose - the same
 * distinction the piece chips make - and it is underlined only while hovered, so a transcript full of
 * paths is not a wall of decoration.
 */
import { useState, type ReactNode } from "react";
import { MouseButton } from "@opentui/core";
import type { MouseEvent } from "@opentui/core";
import { theme } from "../theme";
import { revealInFolder } from "../clipboard-read";

/**
 * A `file://` URL the terminal will accept.
 *
 * Windows backslashes become forward slashes and the drive gets a leading slash, so
 * `C:\cards\dite.png` reads `file:///C:/cards/dite.png`. Each SEGMENT is encoded rather than the
 * whole string, because encoding the separators too would produce a URL naming one long filename
 * with `%2F` in it - which is how a path containing a space quietly stops working.
 */
const fileUrl = (path: string): string => {
  const normalised = path.replace(/\\/g, "/");
  const withRoot = /^[a-zA-Z]:/.test(normalised) ? `/${normalised}` : normalised;
  const encoded = withRoot.split("/").map(encodeURIComponent).join("/");
  // The DRIVE's colon must survive. encodeURIComponent turns it into %3A, which is correct for a
  // filename and wrong for a drive letter - `file:///C%3A/...` is not a path any file manager
  // resolves. Restored only in the root position, so a colon inside a real filename stays encoded.
  return `file://${encoded.replace(/^\/([a-zA-Z])%3A\//, "/$1:/")}`;
};

export function PathLink({
  path,
  exists,
  onCopy,
  onNotice,
}: {
  path: string;
  /**
   * Whether this path is really on this machine.
   *
   * A path that is NOT gets no affordance at all - it is drawn as plain text. Offering to reveal
   * something that is not there would put a dead control in front of somebody and make them find out
   * by pressing it, and a model naming a plausible file it never checked is exactly the case that
   * would produce one.
   */
  exists: boolean;
  onCopy?: (path: string) => void;
  onNotice?: (text: string) => void;
}): ReactNode {
  const [hovered, setHovered] = useState(false);
  if (!exists) return <text fg={theme.soft}>{path}</text>;

  return (
    <box
      flexDirection="row"
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      onMouseDown={(event: MouseEvent) => {
        if (event.button !== MouseButton.LEFT) return;
        event.preventDefault();
        if (event.modifiers.shift) {
          void revealInFolder(path).then((asked) => {
            onNotice?.(asked ? `opening the folder for ${path}` : `could not open a file manager here`);
          });
          return;
        }
        onCopy?.(path);
        onNotice?.("path copied");
      }}
    >
      {/*
        A REAL terminal hyperlink (OSC 8) as well as the mouse handling above, because the two do
        different jobs. The escape sequence is what makes the terminal's own affordance work -
        ctrl+click in Windows Terminal, cmd+click elsewhere - and it survives the text being copied
        out of the transcript. The handlers are what let SHIFT+click mean "show me where this is"
        rather than "hand this file to whatever claims .json".
      */}
      <text fg={theme.gold} attributes={hovered ? 8 /* underline */ : undefined}>
        <a href={fileUrl(path)}>{path}</a>
      </text>
    </box>
  );
}
