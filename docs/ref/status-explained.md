# Neptune Apex /cgi-bin/status.json Reference

`/cgi-bin/status.json` returns the live runtime state of a Neptune Apex aquarium controller. It represents what the system is doing right now, including sensor readings, outlet states, and system status. This endpoint complements `/rest/config`, which provides the static structure.

The structure is loosely consistent but not formally documented and may vary by firmware version and installed modules.

A typical response shape looks like:

{
  "istat": {...},
  "modules": [...],
  "outlets": [...],
  "inputs": [...],
  "probes": [...],
  "feed": {...},
  "alarm": {...}
}

Some systems instead return a flatter array of objects with fields like `did`, `gid`, `type`, `name`, `value`, and `status`.

There are two common formats:
1) Structured (grouped by category like outlets, probes, etc.)
2) Flat list (everything in one array, more common in older firmware)

Each object typically includes identifying fields and live state values.

Common fields across objects:

- did: device ID (matches `id` in `/rest/config`)
- gid: group ID (used for UI grouping, not critical)
- name: user-defined name
- type: object type (`in`, `out`, `probe`, etc.)
- value: numeric value (used for inputs and probes)
- status: string state (used for outputs)
- state: sometimes used instead of status
- unit: unit of measurement (for probes)
- error: error flag (if present)

Digital inputs (type: "in") represent switches like optical sensors, float switches, and leak detectors. Their values are numeric but should be interpreted as boolean:

- 0 = OPEN (not triggered)
- any non-zero value (commonly 60, 200, etc.) = CLOSED (triggered)

Recommended normalization:
const isClosed = value !== 0;

The actual numeric values are bitmask combinations that encode module, port, and sensor type, but should not be relied on directly.

Analog probes (type: "probe") represent sensors like temperature, pH, ORP, and salinity. Their values are numeric and meaningful:

Example:
{
  "name": "Temp",
  "type": "probe",
  "value": 78.5,
  "unit": "F"
}

Fields:
- value: current reading
- unit: measurement unit (F, C, pH, mV, etc.)

Outputs (type: "out") represent controllable devices like outlets, solenoids, pumps, and lights. Their state is represented as a string in the `status` field.

Common status values:
- AOF: Auto mode, currently OFF
- AON: Auto mode, currently ON
- FON: Forced ON (manual override)
- FOF: Forced OFF (manual override)
- ON: ON (no auto logic or fallback)
- OFF: OFF
- ATO: Auto mode ON (alternate encoding, still ON)

Recommended normalization:
const isOn = status.endsWith('ON') || status.endsWith('TO');

To detect manual override:
const isManual = status.startsWith('F');

To detect auto mode:
const isAuto = status.startsWith('A');

Feed mode information may appear as:

{
  "feed": {
    "active": "A",
    "time": 120
  }
}

Meaning:
- active: which feed mode is active (A, B, C, D) or null
- time: seconds remaining

Alarm state may appear as:

{
  "alarm": {
    "status": "ON"
  }
}

Modules may also report runtime status:

{
  "modules": [
    {
      "id": "3",
      "status": "OK"
    }
  ]
}

This indicates module health, not configuration.

Some entries include both `value` and `status`, depending on type.

Common type values in status.json:
- in: digital input (switches)
- out: controllable output
- probe: analog sensor
- virt: virtual outlet
- var: calculated/internal variable
- alarm: alarm object
- feed: feed mode
- module: module status

Joining with `/rest/config`:

status.did === config.id

This allows you to combine:
- config → name, structure, module relationships
- status → live values and states

Example merged model:

{
  id,
  name,
  type,
  moduleId,
  value,
  status,
  isOn,
  isClosed
}

Recommended normalization layer:

function normalize(obj) {
  if (obj.type === 'in') {
    return {
      ...obj,
      isClosed: obj.value !== 0
    };
  }

  if (obj.type === 'out') {
    return {
      ...obj,
      isOn: obj.status.endsWith('ON') || obj.status.endsWith('TO'),
      isManual: obj.status.startsWith('F')
    };
  }

  if (obj.type === 'probe') {
    return {
      ...obj,
      reading: obj.value
    };
  }

  return obj;
}

Common gotchas:
- Some firmware uses `state` instead of `status`
- Some objects omit `did` or use different IDs
- Values may be strings instead of numbers in rare cases
- Virtual outlets behave like outputs but may lack hardware mapping
- Bitmask values for inputs vary but should always be treated as boolean
- Different modules may encode output states slightly differently (AON vs ATO)

Performance considerations:
- status.json is lightweight and safe to poll frequently (e.g., every 1–5 seconds)
- avoid excessive polling on slower Apex hardware

Suggested normalized schema:

{
  id,
  name,
  category: 'input' | 'output' | 'probe' | 'virtual' | 'other',
  rawType,
  value,
  status,
  isOn,
  isClosed,
  unit,
  moduleId
}

TL;DR:
- `/cgi-bin/status.json` = live state of everything
- Inputs: value !== 0 → CLOSED
- Outputs: status string → parse ON/OFF
- Probes: value is real measurement
- Join with `/rest/config` for full context