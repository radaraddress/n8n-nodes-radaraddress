# n8n-nodes-radaraddress

RadarAddress for [n8n](https://n8n.io): verify postal addresses against the national address registers, check emails, phone numbers and websites, validate Italian tax codes, split names with the right salutation and find duplicate contacts, inside your workflows.

Made by RadarWave di Gianluca Sordiglioni. Licence: MIT.

## Installation

In n8n, open **Settings → Community nodes → Install** and enter `n8n-nodes-radaraddress`. To install it from the file you downloaded from https://www.radaraddress.com/en/n8n-integration, run `npm install ./radaraddress-for-n8n-1.0.1.tgz` in the folder `~/.n8n/nodes`.

## Credentials

Create a free account at https://www.radaraddress.com (no credit card: every month a quota of operations is free), copy the API token from the API token page and paste it in a **RadarAddress API** credential. The credential test calls `GET /credit`, which consumes nothing. "API URL" stays as it is.

## Operations

| Resource | Operation | What it does |
| --- | --- | --- |
| Contact | Verify | Address, and the email, phone, name and tax code of the same record, in one call |
| Email | Verify | Can the address receive mail, certain typos in common domains corrected, disposable and generic addresses recognised. No email is sent |
| Phone | Verify | International form, mobile or landline, area |
| Website | Verify | Domain, HTTP answer, certificate |
| Name | Enrich | Last name, first name, title, person or company, formal and informal salutation |
| Tax Code | Validate, Extract, Generate | Italian codice fiscale |
| Duplicate | Find | The contacts that are the same person among the incoming items (up to 500) |
| Credit | Get | Operations available on every counter. Consumes nothing |

With **Simplify** on (the default) the output is a flat record with the verified values (`verified_address`, `verified_postcode`, `verified_city`, `kind`, `confidence`...); off, it is the whole answer of the API. The node never changes your data by itself: you choose where to write the verified values.

An address that cannot be found does not stop the workflow: the node returns its outcome (`kind`: ok, modified, warning, error) and you decide with an IF node. The workflow stops only when the token is not valid or the operations are used up (or, with **Continue On Fail**, the item carries the error).

## What it consumes

Verify Contact consumes one contact verification (the email, phone and tax code of the same record are included); the other Verify, Enrich and Tax Code operations one light check each; Find Duplicates one deduplication per record. Every month a quota is free; beyond that, packs and monthly subscriptions: https://www.radaraddress.com/en/pricing

Every call sends the name and version of the node and the address of your n8n instance, and the name of the workflow, so that consumption can be traced to where it comes from. The data of the records is processed and not kept for training.

## Compatibility

Tested with n8n 2.46. Node.js 22 or later.
