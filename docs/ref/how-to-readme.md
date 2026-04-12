# README Writing Notes

## Intro

- Explain this is a browser extension for Chrome and Safari that adds useful features to Apex Fusion
- Explain it works on apex.local because it needs access to info only available from apex.local

## Features Section

`Features` is the H1. Add an H2 for each feature. Center all GIFs (from `img/` folder).

### Widget Search & Filter
- GIF: `widgets.gif`
- Ability to search and filter the unused widgets section

### Find References (Dashboard)
- GIF: `dash-references.gif`
- Click the magnifier icon → panel appears below
- Panel shows where an input/output/probe is referenced as a single line of code
- Click that line to see the full code
- Click the name of the reference to go directly to the edit page

### Explore
- GIF: `explore.gif`
- Like the references panel but for all inputs, outputs & probes at once
- Can also show everything that does NOT reference the selected item
- Search available in the left column
- SET and FALLBACK are included as a convenience
- Accessed via the new option in the `?` button on the dashboard

### Code Debugger
- GIF: `debugger.gif`
- Explain the gutter and line colors
- Explain it's immediate — reflects changes as you edit the code
- Explain the hover/flyover on gutter elements

### References from Output/Input Pages
- GIF: `page-ref.gif`
- The references panel is also available directly from the output and inputs pages
- Works the same as the dashboard references panel

### Legend
- GIF: `legend.gif`
- Accessed from the light bulb icon on the output/inputs page
- Explains the debugger color system
- Shows what the extension can and can't evaluate
- Includes coding references to help write new code

## Installation Section

- Split into a Safari page and a separate Chrome page
- Reuse existing installation content from `INSTALL_SAFARI.md` and `INSTALL_CHROME.md`
- Link to each from the main README
