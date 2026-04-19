# Console Commands

All commands are dispatched from DevTools console via custom event. Content scripts run in an isolated JS world and can't expose functions directly to the page, so custom events are the bridge.

```js
document.dispatchEvent(new CustomEvent('apex:<command>'))
```

---

## `apex:cleanupStorage`

Opens the **Storage Cleanup** modal. Works on any page.

Scans `chrome.storage.sync` for orphaned custom widget data — entries in `apexDividers` or `apexWetDry` that aren't referenced by any dashboard layout in `apexSections`. Shows a count of orphans per type with checkboxes to select what to clean. The cleanup button is disabled if everything is already clean.

Also removes dead `apex_div_*` / `apex_wd_*` references from `apexSections` in the same write.

```js
document.dispatchEvent(new CustomEvent('apex:cleanupStorage'))
```

---

## `apex:showCodeDebug`

Opens the **Code Debugger** panel. Only works on `/apex/config/` pages (outputs or inputs).

Lets you load a `status.json` and `config` file from any controller and evaluate outlet programs locally against that data — useful for debugging a friend's programs without connecting to their controller. See [debug-code.md](debug-code.md) for full details.

```js
document.dispatchEvent(new CustomEvent('apex:showCodeDebug'))
```

---

## `apex:logLineEvaluation`

Toggles per-line evaluation logging in the console. Off by default. Run again to turn off.

When on, logs each line of a program as it's evaluated (`EVALUATING ...`, `Line 1: ...`, etc.), useful for tracing why a program evaluates the way it does.

Only active during a code debug session.

```js
document.dispatchEvent(new CustomEvent('apex:logLineEvaluation'))
```
