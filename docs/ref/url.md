# URL Reference

## API Endpoints

| What | Local | apexfusion.com | notes |
|------|-------|----------------|
| Status | `http://{hostname}/cgi-bin/status.json` | `https://apexfusion.com/api/apex/<ID>/status`| none |
| Config | `http://{hostname}/rest/config` | `https://apexfusion.com/api/apex/<ID>` | see Rest Config below |

## Page Paths

| What | Local | apexfusion.com |
|------|-------|----------------|
| Dashboard | `/apex/dash` | https://apexfusion.com/apex/<ID> |
| Output config | `/apex/config/outputs/{did}` | /apex/<ID>/config/outputs/<DID> |
| Input config | `/apex/config/inputs/{did}` | /apex/<ID>/config/inputs/<DID> |

## Notes

- Local uses `http://`, apexfusion.com likely `https://`
- Local hostname comes from extension options (`apex.local` default or custom IP)
- All path pattern matching in content.js currently assumes the local path structure above

## What is <ID>

- when you login to apexfusion.com you land on https://apexfusion.com/apex and are asked to pick an apex who's data you want to view
- when you pick an apex you end up on https://apexfusion.com/apex/6257aef29ad1b33a9511224f
- the hash (or whatever it is) after "/apex/" is <ID>

## Rest Config

The structure of the Config json is NOT the same for Local and apexfusion.com.

| What | Local | apexfusion.com |
|------|-------|----------------|
| oconf | oconf | config.outputs |
| iconf | iconf | config.inputs |

examples: 
- local: docs/ex/rest-config-example.json
- apexfusion.com: doc/ref/apexfusion-com-example-id.json