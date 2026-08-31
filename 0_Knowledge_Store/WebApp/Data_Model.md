# Local Data Model

The development build is local-first. `server/` is an Express mock API that reads and
writes the CSV files in `data/` through `server/csvStore.ts`. These files stand in for the
DynamoDB tables described in `0_Knowledge_Store/CurrentState/`, and the column names are
intended to survive the migration.

Because `writeCsv` serializes only the columns named in the corresponding `*_COLUMNS`
array in `server/index.ts`, **adding a column to a CSV requires adding it to that array
too**, or the column is silently dropped on the next write.

## Line endings

Every write rewrites the whole file, so `writeCsv` detects the line ending already in use
and reuses it. Most seeded files are CRLF; emitting LF unconditionally turned a one-field
edit into a diff touching all 1,628 rows of `sla-file-records.csv`. Preserving the existing
delimiter keeps those diffs to the rows that actually changed, which matters because these
files are tracked in git.

## `sla-users.csv`

| Column | Notes |
| --- | --- |
| `user_id` | Numeric string, assigned by the server as max existing id plus one |
| `email` | Unique, stored lowercase, the login identity |
| `first_name`, `last_name` | Display name |
| `abbreviation` | 2 to 4 characters, used as the analyst initials in record columns |
| `role_access` | `Analyst`, `Manager`, `Administrator`, or `Viewer` |
| `last_login` | ISO timestamp, written on each successful login, empty for a new user |
| `created_at` | ISO timestamp |
| `profile_image` | Optional avatar URL |

No password column exists. Every seeded account authenticates with the shared demo
password `password`, checked against the `DUMMY_PASSWORD` constant. User creation from
Configure > Users therefore collects no credential. This is deliberate and disappears
once a real auth provider is wired in.

## `saved-views.csv`

Two columns were added for view inheritance:

| Column | Type | Notes |
| --- | --- | --- |
| `assigned_user_ids_json` | JSON array of user id strings | Individual recipients |
| `assigned_roles_json` | JSON array of role strings | Whole-role recipients; `Viewer` is invalid |

Both default to `[]` and both sit between `sorts_json` and `created_by`. They are parsed
into the `assigned_user_ids` and `assigned_roles` fields of the `SavedView` type by
`parseView`, and validated on write by `sanitizeViewBody`.

An empty pair means the view is private to `owner_user_id`, which the UI presents as the
default "Me" assignment.

## `sla-file-records.csv`

Unchanged by this work, but three behaviors are worth recording because they trip up new
code:

- `sla_met` holds `Y`, `N`, or empty. It is **not** `YES`/`NO`.
- `is_urgent` holds `YES` or `NO`.
- `received_at_est` and `delivered_at_est` are `YYYY-MM-DD H:MM:SS` strings with
  **single-digit hours** in the seeded data, for example `2026-07-01 9:00:00`. Any date
  parsing must tolerate that. The paired `*_at_utc` columns are proper ISO strings.
- `status` is not a stored column. It is derived by `deriveStatus()` in
  `src/lib/status.ts`: On-Hold when `comment` is set, else Completed when
  `delivered_at_est` is set, else In-Review. Views and filters treat `status` as a virtual
  field via `recordFieldValue()`.

## `sla-audit-log.csv`

The file has always carried `artifact_table` and `artifact_name`, but the server's
`AUDIT_COLUMNS` array originally omitted both, so every audit write silently dropped
them. Both are now included and populated at each `appendAudit` call site.

The log is no longer records-only; it also covers user administration and connector
changes. One row means "one field of one object changed", and the columns are used
consistently to say so:

| Column | Meaning |
| --- | --- |
| `artifact_table` | `sla-file-records`, `sla-users`, or `connectors` |
| `artifact_id` | Primary key within that table. Only meaningful alongside `artifact_table`. |
| `artifact_name` | The **column** that changed, which the old and new values describe |
| `event_type` | `Created`, `Updated`, or `Deleted` — a bare verb, nothing appended |

Two conventions are easy to break and worth stating explicitly:

- **`artifact_name` is a field name, not a display name.** The seeded row uses
  `delivered_at_est`. Putting an object's display name here makes the row incoherent,
  because `old_field_value` and `new_field_value` then describe a different column than
  the one named. For a create or delete, the identifying field is used (`email` for a
  user, `file_name` for a record) so the row still reads consistently.
- **Do not append the field to `event_type`.** A value like `Updated:comment` duplicates
  `artifact_name` and breaks grouping by verb. `scripts/rbac-smoke.sh` asserts all three
  of these invariants.

Because a deleted user is gone from `sla-users.csv`, the Audit Log tab cannot resolve
their name and falls back to showing the raw `artifact_id`. The email is still recoverable
from `old_field_value` on the delete row.

## `data-dictionary.csv` and `field-option-values.csv`

`data-dictionary.csv` drives the Records table: which fields are selectable in a view,
their display alias, their filter kind, and whether they are backed by a lookup list.
`filterKindFor()` maps the `type` column to a filter behavior, so changing a field's
`type` there changes how the whole UI filters and formats it. `field-option-values.csv`
supplies the choices for single-choice fields, joined on `field_id`.
