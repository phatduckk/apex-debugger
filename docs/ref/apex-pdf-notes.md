# Apex PDF Reference Notes

> Note: Comprehensive_Reference_Manual.pdf requires poppler to render — content already captured in APEX_GRAMMAR.md

---

## Timers — Practical Details

### OSC

- Max value per segment: `999:99` = 16h 39m 59s
- **1440 divisibility trick**: if all three segments add up to a number evenly divisible by 1440 (minutes in a day), the oscillation will always fire at the same times each day. If not divisible, the phase drifts — each day starts at a slightly different time, calculated from midnight Jan 1, 1996.
- Use the initial delay to stagger two outputs so they don't run simultaneously (e.g., two dosing pumps)

```
OSC 000:00/002:00/358:00 Then ON   ← 2 min on, 358 min off = fires 4x/day at same times (4×360=1440)
```

### If Time

- Both start and end times are **inclusive** — `10:00 to 10:01` is true at both 10:00 AND 10:01, turns off at 10:02
- Minimum effective duration is **2 minutes** (same start/end like `10:00 to 10:00` is invalid)
- For sub-2-minute behavior, combine with Defer:
  ```
  Set OFF
  If Time 10:00 to 10:01 Then ON
  Defer 001:00 Then ON            ← delays ON by 1 min → effectively 1 minute of runtime
  ```
- Spans midnight naturally: `If Time 18:00 to 08:00 Then ON` works as expected

### Defer

- The timer **resets** if the triggering condition changes state before the countdown expires (like a shot clock — any interruption restarts the clock)
- You can have both `Defer MMM:SS Then ON` and `Defer MMM:SS Then OFF` in the same program — both apply independently
- Defer statements apply to the outlet itself, not the conditional logic — they can appear **anywhere** in the program (conventionally placed at the end)
- Primary use case: debouncing float/optical switches to prevent rapid cycling on rippled water surfaces

```
Set OFF
If Float1 Open Then ON
Defer 000:10 Then ON    ← switch must be Open continuously for 10s before pump turns on
Defer 000:10 Then OFF   ← switch must be Closed continuously for 10s before pump turns off
```

### When

- Switches the outlet from **AUTO → manual OFF** when the outlet has been in the specified state longer than the duration
- Requires **manual intervention** (moving the slider back to AUTO in Fusion) to re-enable programming
- Not reversible by code — this is intentional as a safety failsafe
- Like Defer, can appear anywhere in the program
- Most common use: ATO pump overflow protection

```
When ON > 003:00 Then OFF    ← if pump runs continuously for 3 min, kill it and require manual reset
```

### Min Time

- Ensures an outlet **stays in its current state** for a minimum duration, regardless of what the conditionals evaluate to
- Distinct from Defer: Defer delays a *change*, Min Time locks in the *current state*
- Common use: force ATO pump to stay off for at least 60 min between cycles to reduce wear

```
Min Time 060:00 Then OFF    ← outlet must stay OFF for at least 60 min before it can turn ON again
```

### Defer vs Min Time — Key Distinction

| | Defer | Min Time |
|---|---|---|
| What it does | Delays a state *change* | Locks the *current* state for a minimum duration |
| Resets if condition changes? | Yes | No |
| Typical use | Debounce sensors | Reduce cycling frequency |

---

## Lunar Schedule and Lighting Profiles

### Setting Up the Lunar Schedule

The lunar schedule requires per-month configuration of the new moon date. This is only accessible from the **local console** (not Fusion):

1. Browse to `http://apex.local`
2. Apex menu → Misc → Season icon → select **Day of New Moon**
3. Enter the day-of-month for the new moon for each month
4. Save

The Apex follows a 29.5-day lunar cycle based on these entries.

### If Moon Command

```
If Moon [+/-MMM]/[+/-MMM] Then ON|OFF|PROFILE
```

- First offset = minutes relative to **moonrise** (positive = after, negative = before)
- Second offset = minutes relative to **moonset**
- `000/000` = on at moonrise, off at moonset

Examples:
```
If Moon 000/000 Then ON       ← on at moonrise, off at moonset
If Moon 030/000 Then ON       ← on 30 min after moonrise
If Moon 000/-060 Then ON      ← off 60 min before moonset
```

**Important gotcha**: the moon is sometimes visible during the day. To prevent moon lighting from running at noon, combine with a virtual output and If Time:

```
# vMoon virtual output:
Set OFF
If Moon 000/000 Then ON
If Time 07:00 to 21:00 Then OFF    ← suppress during normal lighting hours
```

Then reference `vMoon` in your light's programming:
```
If Output vMoon = ON Then Moonlight   ← switches to moonlight profile
```

### Lighting Profiles

- The Apex has **32 fixed profile slots** named PF01–PF32. You can rename them but cannot create or delete them.
- Profiles store per-channel intensity settings for **Radion** and **Vega/Hydra** LED lights only. Other lights can still be on/off controlled but not profile-switched.
- Profile names can be up to 8 characters (user-defined), e.g., `Moonlight`, `BlueLights`, `WhiteLights`, `RampUp`
- Profiles are referenced by name in the `Then` clause: `Then Moonlight`
- Profiles are configured via: Advanced (gear icon) → Profiles (folder icon) → select an unused slot

---

## Error Detection in status.json

### Module Health — `hwstat` field

Each module object has an `hwstat` field:

| Value | Meaning |
|-------|---------|
| `"OK"` | Communicating correctly |
| `"Error"` | Lost communication with base unit |
| `"Disconnected"` | Not responding on AquaBus |
| `"Old"` | Firmware out of date — update via apex.local |

If a module is **missing entirely** from the modules array, it typically means a power failure or a complete AquaBus communication break (not just an error state).

### Output Errors — `status` field

- `"ERR"` in `status[0]` = outlet-level error — typically an EB832 outlet where current draw exceeded the limit (tripped breaker) or a short circuit was detected
- `xstatus` field: secondary diagnostic string on wireless/advanced modules (Vortech pumps, DOS). May contain device-specific error codes.

### Probe Errors — watch for extreme values

The Apex does not always set a text error flag on failed probes. Instead it reports garbage sensor values:

| Probe type | Suspect value | Likely cause |
|------------|--------------|--------------|
| Temperature | 120°F+ or near 0 | Probe unplugged or thermistor failure |
| pH / ORP | Stuck at exactly `0.00` or `12.00` | Hardware fault or probe disconnected |

### Key JSON paths to monitor for errors

| Target | JSON path | Error condition |
|--------|-----------|----------------|
| Modules | `istat.modules[*].hwstat` | Value is not `"OK"` |
| Outlets | `istat.outputs[*].status[0]` | Value is `"ERR"` |
| Outlet errors | `istat.outputs[*].status[2]` | `"Werr"`, `"Asnc"` |
| Alarms | `istat.outputs` where name ends in `Alm` | `status[0]` is `"AON"` |

> Note: Neptune Systems officially recommends `status.xml` and does not document `status.json` — but the JSON endpoint is widely used and more complete.
