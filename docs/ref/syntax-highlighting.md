# Apex Code Syntax Highlighting

Color rules used in the Explore panel (columns 2 and 3) and the code preview pane.

> Lines with probe/input/output names prefixed `___` indicate module types not present in the reference system.

---

## Color Reference

| Color | Hex / RGB | Used for |
|-------|-----------|----------|
| Purple | `#8959a8` | Control flow keywords: `If`, `Then`, `Set`, `Fallback`, `Defer`, `Min`, `OSC`, `When`, `to` |
| Midnight Blue | `rgb(34, 17, 153)` | State values: `ON`, `OFF`, `OPEN`, `CLOSED` |
| Green | `rgb(0, 136, 85)` | Probe, input, output, and virtual outlet names; profile names |
| Orange | `#f5871f` | Numeric and time values |
| Medium Blue | `rgb(66, 113, 174)` | Apex keywords: `Time`, `FeedA`–`FeedD`, `Output`, `Switch`, `Power`, `Apex`, `Error`, `Amps`, `Watts` |
| Dark Gray | `rgb(84, 84, 84)` | Comparators (`>`, `<`, `=`) and everything else |

---

## Code Examples by Category

### Basic outlet structure
```
Fallback OFF
Set OFF
```

### Simple probe conditions
```
If Temp > 78.5 Then ON
If Temp < 77.5 Then OFF

If pH > 8.40 Then OFF
If pH < 7.90 Then ON

If ORP < 300 Then ON
If ORP > 350 Then OFF
```

### Time-based
```
If Time 08:00 to 20:00 Then ON
If Time 20:00 to 08:00 Then OFF
```

### Feed modes
```
If FeedA 000 Then OFF
If FeedB 000 Then OFF
If FeedC 005 Then ON
```

### Defer / Min Time
```
Defer 001:00 Then ON
Defer 000:30 Then OFF

Min Time 005:00 Then OFF
Min Time 010:00 Then ON
```

### OSC (Oscillate)
```
OSC 000:00/005:00/005:00 Then ON
```

### Output dependency
```
If Output Return_Etc = OFF Then OFF
If Output Skimmer = OFF Then OFF
If Output UV = ON Then ON
```

### Virtual outlets
```
If Output Feeding = ON Then OFF
If Output RunSkimmer = OFF Then OFF
```

### Switch inputs (floats / sensors)
```
If Switch ATOLOW OPEN Then ON
If Switch ATOMAX CLOSED Then OFF

If Switch SkimSW CLOSED Then OFF
```

### Analog inputs (FMM / levels)
```
If RES_LV < 5.0 Then OFF
If Rtn_lv > 9.0 Then OFF
```

### Power monitoring
```
If Power Apex Off 000 Then OFF
If Power Apex Off 005 Then ON
```

### Error handling
```
If Error Return_Etc Then OFF
If Error Return_UV Then OFF
```

### DOS / doser control
```
If Time 00:00 to 00:10 Then ON
If Output AWC_Enabled = OFF Then OFF
```

### Trident / probe-based
```
If Alkx18 < 7.50 Then ON
If Alkx18 > 8.50 Then OFF

If Cax18 < 420 Then ON
If Mgx18 < 1200 Then ON
```

### WAV / Vortech / profile usage
```
Set Lagoon
If Time 10:00 to 18:00 Then ReefCrest
If FeedA 000 Then Constant
```

### Profile examples
```
If Time 09:00 to 18:00 Then Profile DayFlow
If Time 18:00 to 09:00 Then Profile NightFlow
```

### 0–10V variable speed
```
Set OFF
If Time 08:00 to 20:00 Then ON
If Temp > 79.0 Then OFF
```

### Advanced logic combinations
```
If Temp > 80.0 Then OFF
If Temp < 76.0 Then ON
If Temp > 78.0 Then ON
Defer 002:00 Then ON
Min Time 005:00 Then OFF
```

### Multi-condition cascade
```
If Output Return_Etc = OFF Then OFF
If FeedA 000 Then OFF
If Switch ATOMAX CLOSED Then OFF
If Temp > 79.0 Then OFF
If Temp < 78.0 Then ON
```

### Alarm outlet
```
Fallback OFF
Set OFF
If Temp > 81.0 Then ON
If Temp < 75.0 Then ON
If pH > 8.50 Then ON
If pH < 7.70 Then ON
If ORP < 250 Then ON
```

### Email / alert
```
Set OFF
If Output SndAlm_I6 = ON Then ON
```

### COR pump (return)
```
Fallback ON
Set ON
If FeedA 000 Then OFF
If Output ATO_EMPTY = ON Then OFF
If Error Return_Etc Then OFF
```

### Ozone control
```
Fallback OFF
Set OFF
If ORP < 320 Then ON
If ORP > 350 Then OFF
If FeedA 000 Then OFF
```

### Skimmer control
```
Fallback OFF
Set ON
If FeedA 000 Then OFF
If Output Return_Etc = OFF Then OFF
Defer 005:00 Then ON
```

### ATO control
```
Fallback OFF
Set OFF
If Switch ATOLOW OPEN Then ON
If Switch ATOMAX CLOSED Then OFF
Defer 000:30 Then ON
Min Time 001:00 Then OFF
```

### Missing modules (made-up examples)
```
If ___PAR > 300 Then OFF
If ___Leak CLOSED Then OFF
If ___Flow < 20 Then OFF
If ___Salinity > 36.0 Then OFF
If ___CO2 ON Then OFF
```

### Chaotic / edge cases
```
If Temp > 78.0 Then ON
If Temp > 79.0 Then OFF
If Temp > 80.0 Then ON
```

### When (less common)
```
When On > 010:00 Then OFF
When Off > 005:00 Then ON
```

### Final safety override
```
If Power Apex Off 000 Then OFF
If Error Apex Then OFF
```
