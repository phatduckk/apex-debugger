# Apex 24V Output Status Values

Status strings for 24v outputs in `status.json`. Format: `[Control Mode][State][Extra Flag]`

## Values

| Value | Meaning | ON/OFF |
|-------|---------|--------|
| `AON` | Auto mode, currently ON | ON |
| `ATO` | Auto mode, output ON (older/alt encoding) | ON |
| `FON` | Forced ON — manual override | ON |
| `ON` | Explicit ON | ON |
| `AOF` | Auto mode, currently OFF | OFF |
| `FOF` | Forced OFF — manual override | OFF |
| `OFF` | Explicit OFF (fallback / no program) | OFF |

## Normalization

```js
const isOn  = status === 'TBL' || status.endsWith('ON') || status.endsWith('TO');
const isOff = status.endsWith('OF') || status.endsWith('FF');

const isManual = status.startsWith('F');
const isAuto   = status.startsWith('A');
```

> `TBL` (running on a table/profile) must be handled explicitly — it doesn't match the `endsWith` patterns.
