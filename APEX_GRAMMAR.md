# Apex Programming Grammar Reference
> Synthesized from Comprehensive_Reference_Manual.pdf, Timers-guide.pdf, Lights-Lunar-guide.pdf

---

## How the Evaluator Works

- Statements are evaluated **top to bottom**, once per second
- Each statement updates an internal **outlet register** (ON or OFF)
- **Last true statement wins** — whatever the register holds after all lines are evaluated is the physical output state
- `Defer`, `Min Time`, `When` are exceptions — they operate on the outlet itself, not the register, and can be placed **anywhere** (position doesn't matter for these)

---

## Statement Types

### NEUTRAL — No color

```
Fallback ON|OFF
Set ON|OFF|[PROFILE]
```

- `Fallback`: what the physical outlet does if it loses communication with the base unit. Physical outlets only (not virtual).
- `Set`: initializes the outlet register before conditionals run.

---

### ✅ EVALUABLE statements

#### If Time
```
If Time HH:MM to HH:MM Then ON|OFF|[PROFILE]
```
- 24-hour format
- **Inclusive** on both ends (10:00 to 10:01 is true at 10:00 AND 10:01)
- Can span midnight: `If Time 21:00 to 03:00 Then ON` is valid
- **Data source**: `istat.date` (Unix timestamp)

#### If DOW (Day of Week)
```
If DOW SMTWTFS Then ON|OFF|[PROFILE]
```
- 7 placeholders: S(un) M(on) T(ue) W(ed) T(hu) F(ri) S(at)
- Hyphen = false for that day
- Example: `If DOW -MTWTF- Then ON` = Mon–Fri only
- **Data source**: `istat.date` (Unix timestamp → derive day of week)

#### If [PROBE] > or < [VALUE]
```
If [PROBE_NAME] > [VALUE] Then ON|OFF|[PROFILE]
If [PROBE_NAME] < [VALUE] Then ON|OFF|[PROFILE]
```
- Works for Temp, pH, ORP, and any custom named probe (Salt, NO3, PO4, Alk, etc.)
- Lookup by name (case-insensitive) in `istat.inputs[].name`
- **Data source**: `istat.inputs[n].value`

#### If [INPUT] OPEN|CLOSED
```
If [INPUT_NAME] OPEN Then ON|OFF|[PROFILE]
If [INPUT_NAME] CLOSED Then ON|OFF|[PROFILE]
```
- For digital float switches / contact switches
- OPEN = `value: 0`, CLOSED = `value: 200` (confirmed via physical switch test)
- Inputs have `type: "digital"` in the JSON
- Lookup by name in `istat.inputs[].name`
- **Data source**: `istat.inputs[n].value` where type === "digital"

#### If Output / If Outlet (identical keywords)
```
If Output [NAME] = ON|OFF Then ON|OFF|[PROFILE]
If Outlet [NAME] = ON|OFF Then ON|OFF|[PROFILE]
```
- `Output` (Fusion UI) and `Outlet` (older firmware/manual) are equivalent
- ON states: `status[0]` === "AON", "TBL", or "ON"
- OFF states: `status[0]` === "AOF" or "OFF"
- Lookup by name (case-insensitive) in `istat.outputs[].name`
- **Data source**: `istat.outputs[n].status[0]`

#### If Output Percent
```
If Output [NAME] Percent > [VALUE] Then ON|OFF|[PROFILE]
If Output [NAME] Percent < [VALUE] Then ON|OFF|[PROFILE]
```
- Tests the intensity/speed percentage of a variable output (COR pump, VarSpd, etc.)
- **Data source**: `istat.outputs[n].intensity` (0–100)

#### If FeedA / FeedB / FeedC / FeedD
```
If FeedA [MMM] Then ON|OFF|[PROFILE]
If FeedB [MMM] Then ON|OFF|[PROFILE]
```
- True if that feed cycle is currently active OR within DELAY minutes of ending
- Delay value is in **minutes** (000 = no delay after cycle ends)
- **Data source**: `istat.feed.active` and `istat.feed.name`
  - `active: 0` = no feed cycle running
  - When active, `name` indicates which cycle (1=A, 2=B, 3=C, 4=D — needs verification)

#### If Error
```
If Error [OUTPUT_NAME] Then ON|OFF|[PROFILE]
```
- True if the named output is currently in an error state
- **Data source**: `istat.outputs[n].status[0]` === `"ERR"`
  - Occurs on EB832 outlets when current draw exceeds limit (tripped breaker) or short circuit detected
- Secondary error info also visible in `status[2]`: "Werr" (wiring error), "Asnc" (async/not synced), "RC"

---

### 🔶 PARTIALLY EVALUABLE — treat as grey for now

#### OSC (Oscillate)
```
OSC MMM:SS/MMM:SS/MMM:SS Then ON|OFF|[PROFILE]
```
- No `If` prefix
- Three segments: **delay_before_first / on_time / off_time** when `Then ON`
- Reversed when `Then OFF`: **delay / off_time / on_time**
- The middle value is the "Then" state; flanking values are the opposite state
- Timing reference:
  - If (A+B+C) is evenly divisible by 1440 → cycles from **midnight of the current day**
  - Otherwise → cycles from **midnight Jan 1, 1996**
- **Could be computed** from `istat.date`, but complex — grey for now

#### If Power
```
If Power Apex ON|OFF [MMM] Then ON|OFF|[PROFILE]
If Power EB8_x ON|OFF [MMM] Then ON|OFF|[PROFILE]
```
- Tests power state of base unit or an Energy Bar at a given Aquabus address
- DURATION (minutes): how long to hold the state after power is restored
- **Data source**: `istat.power.failed` (Unix timestamp of last failure), `istat.power.restored`
  - If `power.failed > power.restored` → power is currently out (but we'd need to know which EB's power)
  - Individual EB power state not clearly exposed in status.json — grey for now

---

### ❌ CANNOT EVALUATE — always grey

#### Defer
```
Defer MMM:SS Then ON|OFF
```
- No `If` prefix. Can appear **anywhere** in the program.
- Delays the outlet from **changing state** until the register has been in the specified state continuously for the duration
- Requires outlet state history — cannot derive from a single snapshot

#### Min Time
```
Min Time MMM:SS Then ON|OFF
```
- No `If` prefix. Can appear **anywhere**.
- Forces the outlet to **remain** in its current state for the minimum duration before allowing a change
- Requires outlet state history — cannot derive from a snapshot

#### When
```
When ON|OFF > MMM:SS Then ON|OFF
```
- No `If` prefix. Can appear **anywhere**.
- If outlet has been in the specified state longer than the duration, **forces it to manual OFF** (removes from AUTO)
- Requires outlet runtime tracking — cannot derive from a snapshot

#### If Sun
```
If Sun [+/-MMM]/[+/-MMM] Then ON|OFF|[PROFILE]
```
- First param: offset from sunrise (minutes); Second: offset from sunset
- Requires seasonal sunrise/sunset tables — not in status.json

#### If Moon
```
If Moon [+/-MMM]/[+/-MMM] Then ON|OFF|[PROFILE]
```
- Same as Sun but for moonrise/moonset
- Requires lunar schedule tables — not in status.json


#### If Temp < RT+ (Regional Temperature)
```
If Temp < RT+ Then ON
If Temp < RT+0.4 Then ON
If Temp < RT+-0.4 Then ON
```
- Compares probe to seasonal temperature table value ± a differential
- Requires seasonal temperature tables — not in status.json

---

## Then Clause Values

```
Then ON
Then OFF
Then [PROFILE_NAME]   ← e.g. "Then RampUp", "Then PF1", "Then Moonlight"
```

- Profile names are user-defined (up to 8 chars), e.g. PF1–PF32 or custom names
- When `Then [PROFILE]` is the result, treat the line as **neutral** — we can't evaluate profile activation state

---

## Output Status Decoding

`istat.outputs[n].status[0]`:

| Value | Meaning | ON/OFF |
|-------|---------|--------|
| `AON` | Always ON (manual or program) | ON |
| `TBL` | Running on a table/profile | ON |
| `ON`  | On | ON |
| `AOF` | Always OFF | OFF |
| `OFF` | Off | OFF |

Other status[0] values (variable pumps, Cor, WAV, etc.) — treat output as ON if not AOF/OFF.

`istat.outputs[n].status[2]` (error field):
- `"OK"` = no error
- `"Werr"` = wiring error
- `"Asnc"` = async (not synchronized)
- `"RC"` = ? (remote control mode?)

---

## Data Available in status.json

| Field | Path | Use |
|-------|------|-----|
| Current time | `istat.date` | Unix timestamp — for If Time, If DOW |
| Inputs (probes + switches) | `istat.inputs[n].name/value/type` | Probe comparisons, OPEN/CLOSED |
| Output on/off | `istat.outputs[n].name/status[0]` | If Output = ON/OFF |
| Output intensity | `istat.outputs[n].intensity` | If Output Percent |
| Feed state | `istat.feed.active`, `istat.feed.name` | If FeedA/B/C/D |
| Power events | `istat.power.failed`, `istat.power.restored` | If Power (partial) |

---

## Color Rules for Debug Overlay

| Result | Color | Meaning |
|--------|-------|---------|
| Condition true | Light green `#c8f7c5` | This line is currently firing |
| Condition false | Light red `#f7c5c5` | This line is currently dormant |
| Grey | `#e0e0e0` | Unrecognized or unevaluable condition |
| Neutral | None | Fallback, Set, blank lines |

Lines with `Then [PROFILE]` (not ON/OFF) → **neutral** (can't evaluate profile state).
