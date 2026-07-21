## Install

| You are on | Take this file | Then |
|---|---|---|
| **Windows** | `Hoplight.exe` | Double-click it. That is the whole install. |
| **macOS** | `hoplight-darwin-arm64` (Apple Silicon) or `hoplight-darwin-x64` (Intel) | Terminal tool: `chmod +x` it, run `./hoplight-darwin-arm64 ui`, open the printed address |
| **Linux** | `hoplight-linux-x64` | Terminal tool: `chmod +x` it, run `./hoplight-linux-x64 ui`, open the printed address |

- **Windows warns once**: SmartScreen shows "Windows protected your PC" because the exe is new and
  unsigned, not because anything is wrong. Click **More info**, then **Run anyway**. `SHA256SUMS`
  is right here if you want to verify the download first.
- **App starts but no window?** Install Microsoft's
  [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) and launch again
  (Windows 11 already has it).
- The `hoplight-*` files are terminal tools; double-clicking one flashes a console and closes.
  The double-click app is `Hoplight.exe`.
- Launching `Hoplight.exe` while Hoplight is already running just opens another window onto the
  same studio. Your pieces live in `Documents/Hoplight Studio` as plain files.
