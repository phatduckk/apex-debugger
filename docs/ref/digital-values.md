# Apex Digital Input Values

Digital inputs (optical/float switches, leak detectors) report numeric values in status.json — not simple booleans.

## Core Rule

**`0` = OPEN (OFF) — any non-zero = CLOSED (ON)**

The exact non-zero number encodes module type, port index, and sensor type. Two switches can both be CLOSED but report different numbers. Never key off the exact value.

```js
const isClosed = value !== 0;
```

## Known Values

| Value | Meaning | Notes |
|-------|---------|-------|
| `0` | OPEN / OFF | Switch not triggered — all modules |
| `60` | CLOSED / ON | FMM optical sensors, float switches (most common) |
| `200` | CLOSED / ON | Different module/port encoding (also common) |
| `4` | CLOSED | Legacy / base unit inputs |
| `12` | CLOSED | Variation of base inputs |
| `20` | CLOSED | Some older modules |
| `28` | CLOSED | Bitmask combo variant |
| `100` | CLOSED | Some FMM / leak inputs |
| `196` | CLOSED | Variation near 200 |
| `204` | CLOSED | Another 200-series variant |

## Module Patterns

- **FMM optical sensors** → usually `60`
- **FMM leak detectors** → often `100`–`200` range
- **Base unit / breakout box float switches** → often `4`, `12`, `20`, `28`
- **Some FMM ports** → `200`

## Why Different Values?

These numbers are bitmask combinations encoding:
- Switch state (open/closed)
- Module type (FMM, base unit, etc.)
- Input port index
- Sensor type (optical vs mechanical vs leak)

## Important Gotcha

Two switches can both be CLOSED but report different numbers — that does **not** mean different states, just different hardware paths.
