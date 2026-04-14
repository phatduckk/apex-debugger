# Code Debugger — Debug Mode

Debug mode lets you load a friend's `status.json` and `config` files and evaluate their outlet programs locally, without connecting to their controller.

## How to activate

Navigate to any outlet or input program page on your own Apex (`/apex/config/outputs/...` or `/apex/config/inputs/...`), open DevTools, and paste this into the console:

```js
document.dispatchEvent(new CustomEvent('apex:showCodeDebug'))
```

> **Why the event?** Chrome content scripts run in an isolated JS world and can't expose functions directly to the page console. The custom event is the bridge.

## What appears

A panel is injected directly after `div#content` with:

- A **status.json** file input
- A **config** file input
- A **✕ Close** button

Once both files are loaded, a dropdown of all outlets (from `oconf`) and a **Go** button appear.

## Loading files

1. Upload the `status.json` file (the full response from `/cgi-bin/status.json`)
2. Upload the `config` file (the full response from `/rest/config`)
3. Pick the outlet from the dropdown
4. Click **Go**

The program for that outlet is loaded directly into the CodeMirror editor and evaluated against the debug status data — you see exactly what they see, colors and all.

## Getting the files from a friend

Ask them to visit these URLs on their controller and save the responses:

| File | URL |
|------|-----|
| `status.json` | `http://apex.local/cgi-bin/status.json` |
| `config` | `http://apex.local/rest/config` |

They can save either via **File → Save As** in the browser or `curl`:

```bash
curl http://apex.local/cgi-bin/status.json -o status.json
curl http://apex.local/rest/config -o config
```

## Finding the DID

DIDs are in the `oconf` array of the `config` response. Each entry has a `name` and a `did` field. The DID also appears in the URL when editing an outlet: `/apex/config/outputs/<DID>`.

## Closing debug mode

Click **✕ Close** in the panel. All debug state is cleared and the panel is removed. The extension returns to normal operation.

## Line-by-line evaluation logging

The per-line console logs (`EVALUATING ...`, `Line 1: ...`, etc.) are off by default. Toggle them with:

```js
document.dispatchEvent(new CustomEvent('apex:logLineEvaluation'))
```

Run it again to turn them back off.

## Notes

- Debug mode only intercepts `fetchStatus()` and `fetchSeason()` — everything else (your live editor, your own outlet colors) is unaffected while the panel is open.
- The files are never uploaded anywhere — they're read locally in the browser.
- The `debug/` folder at the repo root is gitignored and can store files between sessions.
