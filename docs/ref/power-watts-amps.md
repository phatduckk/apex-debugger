# Power Data (Watts & Amps)

## Standard Outputs

For most outputs, power data is exposed as separate entries in `status.json` under `inputs`:

| Suffix | `type` field | Meaning |
|--------|-------------|---------|
| `<name>W` | `pwr` | Watts |
| `<name>A` | `Amps` | Amps |

**Example:** An output named `outputX` → look for inputs named `outputXW` (watts, `type: "pwr"`) and `outputXA` (amps, `type: "Amps"`).

> This pattern applies to most inputs/outputs. For inputs specifically, this is the expected path — the array-status fallback below has not been observed on inputs, though it can't be ruled out.

---

## Special Output Types

When `<name>A` / `<name>W` inputs don't exist, the output's `status` field is an **array** rather than a singular value. Use the index table below to find the relevant fields.

### Status Array Fields by Type

| Type | idx0 | idx1 | idx2 | idx3 | idx4 | idx5 | idx6 | idx7 |
|------|------|------|------|------|------|------|------|------|
| `cor\|15` | mode | intensity | status | — | rpm | temp | watts | — |
| `cor\|20` | mode | intensity | status | — | rpm | temp | watts | — |
| `wav` | mode | intensity | status | — | rpm | temp | — | — |
| `dos\|2` | mode | status | flow | runtime | calibration | error | — | — |
| `eb832` | port-based — see note below | | | | | | | |
| `pm1/2/3` | type | value | status | calibration | offset | — | — | — |
| `trident` | mode | status | nh3 | no3 | po4 | ca | alk | mg |

> **EB832 note:** Power data is not in a simple status array. Amps and watts are exposed as named inputs using the port-key pattern `{addr}_P{i}` internally, which surfaces in `status.json` as standard `<name>W` / `<name>A` inputs. Use the standard path.

### Power Calculation by Type

| Type | Watts | Amps | Notes |
|------|-------|------|-------|
| `cor\|15` | `status[6]` (direct) | — | No amps exposed. Watts range 0–120, no scaling needed. |
| `cor\|20` | `status[6]` (direct) | — | Same as COR-15. |
| `wav` | — | — | No power data in status array. Only RPM and temperature available. |
| `dos\|2` | — | — | No power or current telemetry available. |
| `eb832` | `inputs[nameW]` | `inputs[nameA]` | True AC measurement. Use standard `<name>W` / `<name>A` input lookup. |
| `pm1/2/3` | — | — | Probe modules don't report power. |
| `trident` | — | — | No power/amp data exposed in status. |
