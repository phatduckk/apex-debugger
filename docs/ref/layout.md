# Apex Dashboard Layout

> Source: `/rest/layout?_=<random>`
> Example: `docs/ex/layout-example.json`

---

## Structure

`/rest/layout` returns a single JSON object:

```json
{
  "sections": [
    "gid1,gid2,gid3,...",
    "gid4,gid5,...",
    "gid6,gid7,...",
    "gid8,gid9,..."
  ]
}
```

- `sections` is an array of comma-separated GID strings
- `sections[0]` is the **unused widgets tray** (`#unused`) — widgets not placed in any column
- `sections[1]`, `sections[2]`, `sections[3]` map to the 3 visible dashboard columns (`dash-widget-column-1/2/3`)

---

## GID Format

GIDs match the `did` field in `status.json`. Most are plain device IDs (`module_port`), but some have a device-type prefix:

| Example GID | Pattern | Notes |
|-------------|---------|-------|
| `4_1` | `<module>_<port>` | Standard outlet |
| `base_Temp` | `base_<name>` | Base unit probe |
| `base_I1` | `base_<input>` | Base unit input |
| `tri:18` | `tri:<id>` | Trident |
| `dos:doser_12` | `dos:<id>` | DOS dosing pump |
| `wav:16_1` | `wav:<id>` | WAV pump |
| `cor:11_1` | `cor:<id>` | COR pump |
| `ebg:4` | `ebg:<id>` | EB Group |
| `ddr:doser_12` | `ddr:<id>` | DOS dosing pump (alt prefix) |
| `clock` | literal | System clock widget |
| `link` | literal | Link widget |
| `feed` | literal | Feed mode widget |
| `video` | literal | Video widget |

---

## How the Three Pieces Join

```
/rest/layout
  sections[0]          ← unused tray (not a column)
  sections[1..3]       ← columns 1, 2, 3
    → CSV of GIDs      ← ordered list of widgets in that column/tray
         ↕
/cgi-bin/status.json
  [*].did              ← same GID value → gives you name, type, value/status
         ↕
DOM: /apex/dash
  div.dash-widget-column#dash-widget-column-{1,2,3}
    div.widget[id]     ← id attribute = GID
```

So to map a widget on screen to its data:
1. Find the `div.widget` — its `id` is the GID
2. Look up that GID in `status.json` by matching `.did` → get name, type, live value
3. Look up that GID in `layout.sections[n]` → know which column it's in and its position

---

## DOM Structure

The dashboard lives at `/apex/dash` (see `docs/ex/html-dash.html`).

Two `div.dash-widget-row` elements are stacked vertically:
- **Row 1** — `div#dash-widget-unused` (unused tray / `dash-section-0`)
- **Row 2** — the three columns (`dash-widget-column-1/2/3`)

```html
<div class="dash-widget-row">
  <div id="dash-widget-unused" class="dash-widget-container">
    <div id="dash-section-0"> ... </div>
  </div>
</div>
<div class="dash-widget-row">
  <div class="dash-widget-column" id="dash-widget-column-1">
    <div id="dash-section-1">
      <div class="dash-widget" id="4_1"> ... </div>
      <div class="dash-widget" id="4_2"> ... </div>
    </div>
  </div>
  <div class="dash-widget-column" id="dash-widget-column-2">
    <div id="dash-section-2"> ... </div>
  </div>
  <div class="dash-widget-column" id="dash-widget-column-3">
    <div id="dash-section-3"> ... </div>
  </div>
</div>
```

- Column IDs are 1-indexed: `dash-widget-column-1`, `dash-widget-column-2`, `dash-widget-column-3`
- Each column contains a `div#dash-section-{1,2,3}` which holds the actual widgets
- The unused tray is `div#dash-widget-unused` containing `div#dash-section-0`
- Widget class is `dash-widget` (not `widget`) — the `id` attribute is the GID (matches layout CSV and `status.json .did`)

---

## Edit Mode

When the dashboard is unlocked (`div#dash.unlocked`), edit mode activates:

- `div#dash-section-0/1/2/3` each gain class `sortable` — this triggers the dashed orange border via CSS
- Apex's bundled sort library handles drag-to-reorder within and between sections
- Each `div.dash-widget` gets a `div.sortable-remove` injected as a child (the X button)
- Removing a widget moves it from its column section back to `dash-section-0` (the unused tray)

```html
<!-- edit mode -->
<div id="dash-section-1" class="sortable">
  <div class="dash-widget" id="4_1">
    <div class="sortable-remove"></div>   ← X button
    ...
  </div>
</div>
```

---

## Folder Switching (Extension)

Each custom folder stores its own `sections` array (same structure as `/rest/layout`). Switching folders is a **DOM-only operation** — the Apex controller is never touched, nothing is POSTed.

### Approach

All widgets (`div.dash-widget`) are always present in the DOM across `dash-section-0` through `dash-section-3`. Switching just reparents them:

1. On the **first** switch away from Default, snapshot the current DOM node order of all 4 sections (actual node references, not innerHTML — preserves event listeners)
2. Collect every `div.dash-widget` from all sections into a flat map keyed by GID
3. Clear all 4 sections
4. Place the folder's column GIDs into `dash-section-1/2/3` in order
5. Everything not placed goes into `dash-section-0` (unused tray)

On switch back to **Default**: replay the snapshot — move nodes back to their original sections in original order. Discard snapshot.

### Rules

- The same widget GID can appear in multiple folders' sections (each folder is an independent view)
- A GID may only appear once within a single folder's sections
- `sections[3]` is not used for folder layouts — the unused tray is always computed dynamically
- Default folder = the real Apex layout, untouched

### Storage

```json
{
  "apexFolders": [
    {
      "id": "folder_1234",
      "name": "My Folder",
      "glyph": "F660",
      "sections": ["gid1,gid2", "gid3,gid4", "gid5", ""]
      // NOTE: extension-internal format — sections[0..2] = columns 1/2/3, sections[3] unused
      // This differs from Apex's /rest/layout where sections[0] is the unused tray
    }
  ]
}
```

---

## Notes for Layout Manipulation

- To **move** a widget: remove its GID from one section's CSV and insert it in another at the desired position
- To **reorder** within a column: reorder the GIDs in that section's CSV
- Changes need to be POSTed back to `/rest/layout` to persist
- The `sections` array index maps to column order left-to-right
