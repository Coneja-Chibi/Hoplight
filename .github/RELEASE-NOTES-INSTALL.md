## Install

| You are on | Take this file | Then |
|---|---|---|
| **Windows** | `Hoplight.exe` | Double-click it. That is the whole install. |
| **Windows, terminal** | `hoplight-cli-windows-x64.exe` | Optional. Run it from a terminal with a command; it has no window. |
| **macOS** | `hoplight-cli-darwin-arm64` (Apple Silicon) or `hoplight-cli-darwin-x64` (Intel) | Terminal tool: `chmod +x` it, run `./hoplight-cli-darwin-arm64 ui`, open the printed address |
| **Linux** | `hoplight-cli-linux-x64` (Intel/AMD) or `hoplight-cli-linux-arm64` (ARM, Raspberry Pi) | Terminal tool: `chmod +x` it, run `./hoplight-cli-linux-x64 ui`, open the printed address |

- **Windows warns once**: SmartScreen shows "Windows protected your PC" because the exe is new and
  unsigned, not because anything is wrong. Click **More info**, then **Run anyway**. `SHA256SUMS`
  is right here if you want to verify the download first.
- **App starts but no window?** Install Microsoft's
  [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) and launch again
  (Windows 11 already has it).
- The `hoplight-cli-*` files are terminal tools with no window. Double-clicking one on Windows now
  prints the help and waits for Enter instead of flashing shut. The double-click app is `Hoplight.exe`.
- **Kit** (`hoplight-kit-*`) is the terminal companion: your whole studio as a conversation, in a
  terminal. Optional, and a separate download from the app. Windows x64, Linux x64 and Apple Silicon
  for now, with more platforms to follow.
- **Renamed this release**: the CLI downloads gained a `-cli` in their names
  (`hoplight-windows-x64.exe` is now `hoplight-cli-windows-x64.exe`, and the same for macOS and
  Linux). If you update the CLI from inside itself, grab this one manually once; the desktop app is
  unaffected.
- Launching `Hoplight.exe` while Hoplight is already running just opens another window onto the
  same studio. Your pieces live in `Documents/Hoplight Studio` as plain files.
