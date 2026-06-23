# Logging errors via the browser console (support guide)

> **What's this for?** When something doesn't work in Preset Forge — the GP-200
> won't connect, a preset won't load, an upload fails, or live editing stops
> responding — the decisive clues are almost always in the **browser console**.
> This guide walks you through making those messages visible, recording them, and
> sending them to the developer. With a console capture a bug can often be found
> in minutes; without one, we're guessing.

Many open topics revolve around USB-MIDI device communication (e.g. IR/NAM
upload, sending effect changes to the device, SysEx captures — see the
[GitHub issues](https://github.com/phash/gp200editor/issues)). That's exactly
where your console logs help the most.

---

## TL;DR

1. Open **Chrome, Edge, or Brave** (required for device/MIDI issues — Web MIDI
   only exists in Chromium browsers).
2. Open Preset Forge, then press `F12` → **Console** tab.
3. Tick **"Preserve log"** (in the gear menu ⚙ at the top right of DevTools if you
   don't see the checkbox).
4. **Reproduce** the problem (e.g. connect the device, load a preset, start an upload).
5. Right-click in the console → **"Save as…"** → save the file.
6. Send the file (or a screenshot of the red messages) by **email to
   [phash@phash.de](mailto:phash@phash.de)** or as a **GitHub issue**.

---

## 1. What is the console?

Every modern browser has built-in "Developer Tools" (DevTools). The **console**
is the part where web pages print technical messages: status output, warnings
(yellow), and errors (red). Preset Forge deliberately writes traceable messages
there — for example, every MIDI command it sends to the pedal.

Opening the console **changes nothing** about your presets or your device — you're
just watching.

---

## 2. Opening the console

> **Important for device issues:** Live editing over USB uses the **Web MIDI API**,
> which only exists in **Chromium-based browsers** (Google Chrome, Microsoft Edge,
> Brave, Chromium). **Firefox and Safari** do not support Web MIDI — so for any
> MIDI topic, please use Chrome or Edge.

### Chrome / Edge / Brave / Chromium

| System | Shortcut (opens the console directly) |
|--------|----------------------------------------|
| Windows / Linux | `F12` or `Ctrl` + `Shift` + `J` |
| macOS | `Cmd` + `Option` + `J` |

Alternatively: right-click anywhere on the page → **"Inspect"** → **Console** tab.

### Firefox (non-MIDI issues only)

| System | Shortcut |
|--------|----------|
| Windows / Linux | `F12` or `Ctrl` + `Shift` + `K` |
| macOS | `Cmd` + `Option` + `K` |

### Safari (non-MIDI issues only)

1. First enable the developer menu: **Safari → Settings → Advanced → "Show
   features for web developers"** (a.k.a. "Show Develop menu").
2. Then open the console with `Cmd` + `Option` + `C`.

---

## 3. Before reproducing: two important settings

1. **Enable "Preserve log".**
   Without it, the console clears on every reload or page change — and the very
   message just before the failure is lost. In Chrome/Edge the checkbox is in the
   console toolbar or behind the gear icon (⚙) → "Preserve log".

2. **Set the log level to "All".**
   Make sure you're not accidentally filtered to "Errors" only. Above the log are
   filter buttons (Verbose / Info / Warnings / Errors) — best to keep them all on.

Tip: use the trash-can icon (🚫) to clear the console first, so only messages from
now on are captured.

---

## 4. Reproduce the problem

Keep the console open and perform exactly the steps that trigger the bug — e.g.:

- Connect the device / click "Connect"
- Load, save, or send a preset to the device
- Toggle an effect or change a parameter
- Upload a file (gallery, IR/NAM)

Note **what you clicked** and **what happened** (or didn't). That description
belongs in your report.

---

## 5. Reading Preset Forge's messages

Preset Forge tags its messages with clear prefixes you can search for in the
console's **filter box**:

| Prefix | Meaning |
|--------|---------|
| `[GP-200]` | USB-MIDI communication with the device (most important for device bugs). Includes commands sent/received, e.g. `pull rx:` / `pull tx:` with hex data. |
| `[ErrorLog:...]` | Server/app errors that are also mirrored to the console. |

- **Red** lines are errors, **yellow** are warnings.
- Type `[GP-200]` into the **filter box** (the search field above the log) to show
  only device communication.
- A small triangle ▸ in front of a line can be expanded — for errors it holds the
  **stack trace** (the technical origin of the error). Please include it.

---

## 6. Recording and sending the logs

### Option A — Save as a file (most complete)

In **Chrome / Edge / Brave**:

1. **Right-click** anywhere in the console.
2. Choose **"Save as…"**.
3. Save the `.log` file and attach it to your report.

### Option B — Copy & paste

1. Click into the console, `Ctrl` + `A` (select all), `Ctrl` + `C` (copy).
2. Paste it into the email or GitHub issue — ideally inside a code block (three
   backticks ``` before and after) so it stays readable.

### Option C — Screenshot

Often enough for obvious red errors: take a screenshot of the console. Make sure
the **full red error message including the expanded stack trace** is visible.

---

## 7. Capturing network errors (upload, gallery, login, API)

When something goes wrong with the server (upload fails, login doesn't work,
gallery won't load), the **Network** tab helps in addition to the console:

1. Switch to the **"Network"** tab in DevTools.
2. Tick **"Preserve log"** here too.
3. Reproduce the problem.
4. Click the **red** (failed) request — at the top you'll see the **status code**
   (e.g. `400`, `403`, `500`), and under **"Response"** the server's reply.
5. Screenshot the status + response, or right-click the request →
   **"Copy" → "Copy as cURL"**.

> ⚠️ **Careful with HAR files:** a "Save all as HAR" contains **cookies and login
> tokens**. Please do **not** post HAR files publicly — send them by email only,
> or strip sensitive data first.

---

## 8. For MIDI / device issues: what to include

For device bugs (connection, pull/push, sending effects, IR/NAM upload), please
also provide:

- **Browser + version** (e.g. "Chrome 126 on Linux Mint 21").
- **Operating system.**
- **Exact steps:** what did you click, and in what order?
- Every line containing `[GP-200]` — especially the **hex dumps** `pull rx:` /
  `pull tx:`.
- Whether the device works normally elsewhere (the official Valeton editor).

Background: several open topics (USB captures, IR/NAM upload, SysEx) can **only**
be solved with real captures from the device — see the
[GitHub issues](https://github.com/phash/gp200editor/issues).

---

## 9. Privacy — a quick check before sending

Console and network logs can contain data such as:

- preset and author names,
- your email address / username,
- login tokens (especially in HAR files).

Skim the logs before posting publicly and **redact anything you don't want to
share**. Send anything sensitive by email rather than in a public issue.

---

## 10. Where to send it

| Channel | When |
|---------|------|
| **GitHub issue:** <https://github.com/phash/gp200editor/issues> | Bugs, feature requests, captures (publicly trackable). |
| **Email:** [phash@phash.de](mailto:phash@phash.de) | When the logs contain sensitive data or you don't have a GitHub account. |

### Checklist for a good bug report

- [ ] What were you trying to do? What happened? What did you expect?
- [ ] Browser + version + operating system
- [ ] Steps to reproduce (1, 2, 3 …)
- [ ] Console log (file, text block, or screenshot with stack trace)
- [ ] For server errors: network status + response
- [ ] For device errors: every `[GP-200]` line including hex dumps
- [ ] Sensitive data checked / redacted

Thanks for helping out — every capture makes Preset Forge more stable. 🎸
