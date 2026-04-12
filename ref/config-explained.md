# Neptune Apex /rest/config Reference

`/rest/config` returns the configuration model of a Neptune Apex aquarium controller. It represents the static structure of the system (what exists), while `/cgi-bin/status.json` represents live state (what it's doing right now). The data is not officially documented by Neptune Systems, so this is based on observed real-world usage and reverse engineering.

The response typically includes objects like modules, outlets, inputs, probes, virtual outputs, and system metadata, though the exact structure varies depending on firmware version and installed modules.

A typical response shape may look like:

{
  "modules": [...],
  "outlets": [...],
  "inputs": [...],
  "probes": [...],
  "virtual": [...],
  "system": {...}
}

Not all keys are guaranteed to appear.

Modules represent physical hardware connected via AquaBus, such as EB832 energy bars, FMM fluid monitoring modules, DOS pumps, and probe modules. A module object typically looks like:

{
  "id": "3",
  "name": "FMM_1",
  "type": "FMM",
  "addr": "3",
  "status": "OK"
}

Fields:
- id: internal module identifier
- name: user-defined module name
- type: module type (e.g., EB832, FMM, DOS, PM1)
- addr: AquaBus address
- status: health/status of the module

Outlets represent controllable outputs (relays, 24V ports, etc.):

{
  "name": "ReturnPump",
  "id": "4_1",
  "module": "4",
  "type": "out",
  "control": "auto",
  "fallback": "ON"
}

Fields:
- name: user-defined outlet name
- id: unique identifier, usually formatted as <module>_<port>
- module: parent module ID
- type: always "out" for physical outputs
- control: "auto" or "manual"
- fallback: default state if Apex loses control (ON or OFF)

Inputs represent digital inputs like float switches, optical sensors, and leak detectors:

{
  "name": "Sump_High",
  "id": "3_1",
  "module": "3",
  "type": "in"
}

Fields:
- name: user-defined input name
- id: unique identifier
- module: parent module ID
- type: "in" (digital input)

Digital inputs map to values in status.json where:
- 0 = OPEN (not triggered)
- any non-zero value (e.g., 60, 200) = CLOSED (triggered)

Recommended normalization:
const isClosed = value !== 0;

Probes represent analog sensors like temperature, pH, ORP, and salinity:

{
  "name": "Temp",
  "type": "probe",
  "unit": "F",
  "min": 0,
  "max": 100
}

Fields:
- name: probe name
- type: "probe"
- unit: measurement unit (F, C, pH, mV, etc.)
- min/max: expected value range

Virtual outputs represent software-defined outlets used for logic and automation:

{
  "name": "ATO_Enable",
  "type": "virt"
}

Fields:
- name: virtual outlet name
- type: "virt"
- program: Apex logic (sometimes present)

System metadata contains general information about the controller:

{
  "system": {
    "name": "MyApex",
    "serial": "AB12345",
    "firmware": "5.10_xx",
    "timezone": "PST"
  }
}

Fields:
- name: system name
- serial: device serial number
- firmware: firmware version
- timezone: system timezone

IDs in Apex generally follow the pattern:

<module>_<port>

Examples:
- 3_1 = module 3, port 1
- 4_8 = EB832 outlet 8

Common module types include:
- EB832: Energy Bar with 8 controllable outlets
- FMM: Fluid Monitoring Module (optical sensors, leak detectors)
- DOS: Dosing pump
- PM1: Probe module
- VXM: Vortech pump control
- WXM: Wireless expansion module

The relationship model is hierarchical:
A module contains inputs, outputs, and probes. Virtual outputs exist independently and are not tied to a physical module.

When building applications, `/rest/config` should be combined with `/status.json`. The config provides structure (names, IDs, types), while status provides live data (values, states, AOF/AON strings).

Typical join pattern:
config.id === status.did

Type field values commonly encountered:
- in: digital input (switches, sensors)
- out: physical output (relay, outlet, solenoid)
- probe: analog sensor
- virt: virtual/software outlet
- var: calculated/internal variable (sometimes overlaps with virt)
- module: hardware module
- alarm: alarm object
- feed: feed mode
- clock: system clock
- status: system-level status
- config: configuration metadata

Recommended normalization for applications:

function classify(obj) {
  switch (obj.type) {
    case 'in':
    case 'probe':
      return 'input';
    case 'out':
      return 'output';
    case 'virt':
    case 'var':
      return 'virtual';
    default:
      return 'other';
  }
}

Outputs (type: "out") use string states like AOF, AON, FON, FOF:
- AOF: Auto mode, OFF
- AON: Auto mode, ON
- FON: Forced ON (manual override)
- FOF: Forced OFF (manual override)
- ON/OFF: direct states (fallback or simple config)

Recommended normalization:
const isOn = status.endsWith('ON') || status.endsWith('TO');

Key differences:
- /rest/config = structure, relatively static
- /status.json = live values, dynamic

Gotchas:
- Fields vary across firmware versions
- Not all modules expose full metadata
- Virtual outputs may appear under "virt" or "var"
- Naming is user-defined and not reliable for logic
- Some objects only appear in Fusion APIs, not local endpoints

Suggested normalized object model:

{
  id,
  name,
  category: 'input' | 'output' | 'probe' | 'virtual' | 'other',
  moduleId,
  rawType,
  capabilities: {}
}

TL;DR:
- Use /rest/config to discover devices and structure
- Use /status.json to read live state
- Normalize types and values early
- Treat digital inputs as boolean (value !== 0)
- Treat outputs as ON if status string ends with ON/TO