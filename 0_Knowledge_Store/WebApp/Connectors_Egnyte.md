# Connectors: Egnyte File Share

## Status: placeholder, intentionally inert

The Configure > Connectors tab captures Egnyte API credentials and stores them, but
**nothing in the application consumes them yet**. No Egnyte API call is made anywhere in
the codebase. This tab exists so the credential-entry surface is designed and the storage
path is settled before the integration work begins.

Do not assume a working Egnyte connection because this form is populated.

## What it collects

| UI label | Environment variable | Notes |
| --- | --- | --- |
| Key | `EGNYTE_CLIENT_ID` | Safe to display back to the admin |
| Secret | `EGNYTE_CLIENT_SECRET` | Write-only from the browser's perspective |

Administrator only. `canSeeConnectors` is true for no other role, and the server rejects
non-Administrator callers independently of the hidden UI.

## Local development storage

`PUT /api/connectors/egnyte` writes both values into the repository-root `.env`, which is
gitignored. The write is an upsert: existing unrelated keys and comments in that file are
preserved rather than clobbered.

`GET /api/connectors/egnyte` returns a `ConnectorStatus` containing the `client_id` and
two booleans, `has_client_id` and `has_client_secret`. **The secret value is never
returned to the browser.** The UI shows a masked indicator when a secret is present, and
submitting a blank secret leaves the stored one untouched rather than erasing it.

This is a development convenience only. A real deployment would never let a web form
write to a file on the application server.

## Production design

Credentials will live in **AWS Systems Manager Parameter Store** as `SecureString`
parameters, read at runtime by the backend Lambda functions that talk to Egnyte. The
browser will never receive the secret, and the Express `.env` path described above
disappears entirely along with the rest of the local mock API.

That implies the following work when the integration is picked up:

1. Move the credential write behind an authenticated Lambda that puts the parameter,
   scoped by an IAM policy that permits `ssm:PutParameter` on a single path prefix.
2. Keep the read shape identical — a status object with presence booleans — so the
   Connectors UI does not need to change.
3. Add the actual Egnyte client: OAuth token exchange using the stored client
   credentials, then whatever file operations the record pipeline needs.
4. The `egnyte_direct_link`, `egnyte_file_path`, and `egnyte_file_size_kb` columns already
   present on `sla-file-records` are the intended destination for data pulled through
   this connector. They are currently populated from the seeded sample data.

## Why the credentials are not used yet

The record pipeline currently ingests from the legacy Google Sheets flow documented in
`0_Knowledge_Store/CurrentState/`. Egnyte becomes relevant once ingestion moves into the
new backend. Until then the connector is a form and a stored value, nothing more.
