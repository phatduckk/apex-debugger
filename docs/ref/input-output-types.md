# Apex Input / Output Types

Type values from `/rest/config` (and mirrored in `status.json`).

| Type | Meaning | What it Represents | Example |
|------|---------|-------------------|---------|
| `in` | Input | Sensors / read-only data | optical switch, temp probe |
| `out` | Output | Controllable outlets | solenoid, pump, light |
| `var` | Variable | Internal/calculated values | virtual outlets, logic results |
| `probe` | Probe | Specialized sensor type | pH, ORP, salinity |
| `virt` | Virtual | Software-only outlet | alarms, logic-only outlets |
| `tile` | UI Tile | Dashboard grouping element | Fusion tiles/groups |
| `module` | Module | Physical Apex module | FMM, EB832, DOS |
| `alarm` | Alarm | Alarm status object | email/SMS alarm |
| `feed` | Feed Mode | Feed cycle state | FeedA, FeedB |
| `clock` | Clock | System time | Apex internal clock |
| `status` | Status | System-level status | heartbeat, health |
| `config` | Config | Configuration object | settings metadata |

## Classification

```js
function classify(obj) {
  switch (obj.type) {
    case 'in':
    case 'probe':    return 'input';
    case 'out':      return 'output';
    case 'virt':
    case 'var':      return 'virtual';
    default:         return 'other';
  }
}
```
