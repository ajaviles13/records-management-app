# Records Tab UX

The Records tab is the primary work surface. This document covers the editing affordance,
pagination, and export, and the deep-link contract it accepts from other tabs.

## Editing a record

Rows are **not** clickable. Clicking a row previously opened a right-side sheet, which made
it impossible to select or copy cell text. That interaction is gone.

Instead the table has a pinned leftmost column holding a blue pencil button per row:

- The column is rendered only when the user can edit records, so a Viewer never sees it.
- Both the header cell and the body cells use `position: sticky; left: 0`, so the pencil
  stays visible while the table scrolls horizontally.
- The header cell sits at `z-40` and the body cells at `z-20`. The header must outrank the
  body cells, otherwise a scrolled row would paint over the sticky header corner.
- Body cells repeat the row's zebra background (`bg-card` or `bg-muted/30`). A sticky cell
  is lifted out of the row's paint order, so without this the striping breaks.

Clicking the pencil opens `RecordModal`, a centered modal (`components/ui/dialog`), not a
side sheet. The modal is a flex column: a fixed header, a scrolling body, and a fixed
footer. Fields are grouped into Document, Timing, Assignment & status, Effort metrics, and
Egnyte.

### Unsaved changes

`RecordModal` snapshots the draft as JSON when it opens and compares on every render. A
close request with a dirty draft raises a `window.confirm`. The snapshot is deliberately
re-taken only on `open`; including `draft` in the effect dependencies would re-baseline on
every keystroke and the guard would never fire.

### Assignment dropdown

Only `Analyst` and `Manager` users are offered, because only they can own a document.
Whoever currently owns the record is appended to the list if their role has since changed,
so opening the modal never silently drops an existing assignment. The dropdown is disabled
unless `canAssignRecords(role)` passes, and the server rejects the patch independently.

## Pagination

`src/lib/pagination.ts` holds the arithmetic; `RecordsPagination` renders the control.

- Page sizes are 25, 50, 100, 500, and 1000.
- The choice is cached per user in `localStorage`, so it survives a reload and does not
  leak between accounts on a shared machine.
- The page resets to 1 whenever the active view, the column filters, or the page size
  changes. Without that reset a user sitting on page 12 could filter down to 30 rows and
  see an empty table.
- `clampPage` bounds the requested page against the current row count, so deleting the
  last row on the final page does not leave the table blank.

## Export

Available to Analyst, Manager, and Administrator via `canExport`. The dialog offers:

| Choice | Options |
| --- | --- |
| Export Scope | `{N} records in current view` (the current page), or all records in the current view |
| Export Format | CSV (Comma Separated Values), or Excel File |

Both formats write the **visible columns in their current order**, using the same rendering
the table shows: derived status, resolved analyst names, language labels, Yes/No booleans,
and formatted dates. Exporting raw CSV values would not match what the user was looking at.

CSV output is prefixed with a UTF-8 BOM so Excel does not mangle non-ASCII characters.
XLSX is produced with `exceljs`, with a bold frozen header row and width-fitted columns.

## Deep links from other tabs

Records accepts a query string described by `src/lib/recordsNav.ts`:

| Key | Meaning |
| --- | --- |
| `view` | Saved view to activate on arrival. Defaults to All Records. |
| `f.<field>` | A column filter value. Repeat the key for multi-value filters. |
| `basis` | `received`, `delivered`, or `both` |
| `from`, `to` | Inclusive `YYYY-MM-DD` bounds of a date window |

The date window is applied as a **separate predicate layer** from the column filters,
because a single column filter input cannot express a two-sided range. When present it is
shown as a dismissible pill in the toolbar next to Export Data, so an arriving user can
see and clear the filtering that was applied on their behalf.

`buildRecordsLink` drops a partial date window rather than applying half of it. Round-trip
behaviour is covered by `scripts/navContract.test.ts`.

### Edge cases

- **Filters only apply to visible columns.** The filter pass iterates the active view's
  fields, so a deep link carrying a filter on a hidden column is silently ignored. Every
  link built today targets All Records, whose default fields include `status`, `sla_met`,
  and `assigned_analyst_id`. A new link must either target a view that shows the field or
  add it to that view.
- **Re-applying the same URL.** The deep-link effect tracks the last applied search string
  in a ref. Without it, any state change would re-run the effect and stomp filters the
  user had since edited by hand.
- **Empty values.** `__notset__` is the sentinel for "field is empty" and is checked ahead
  of the per-kind branches in `matchesColumnFilter`, so it works for choice columns such as
  `assigned_analyst_id`. This is what makes the My Snapshot "Unassigned" link work.
