# My Snapshot

My Snapshot answers "what is on my plate, and how are we doing against SLA". Every number
on the page is a link into a filtered Records view, so the tab is a starting point for work
rather than a dead-end report.

## Scope

`seesAllRecords(role)` decides what the page counts:

| Role | Scope |
| --- | --- |
| Analyst | Only records where `assigned_analyst_id` is the signed-in user |
| Manager, Administrator | Every record, team-wide |

Managers and Administrators additionally get an **Unassigned** card. Viewers cannot reach
the tab at all.

## Date range filter

Sits at the top right of the page header. It has two independent dimensions.

**Basis** — which timestamps the range applies to, as two checkboxes:

| Selection | Stored basis | Meaning |
| --- | --- | --- |
| Received | `received` | Filter on `received_at_est` |
| Delivered | `delivered` | Filter on `delivered_at_est` |
| Both | `both` | A record qualifies when **either** date falls in the range |

Unchecking the last remaining box is ignored. With neither selected nothing could ever
match, so the filter would silently empty the page.

**Range** — `All time` (the default), `Today`, `This Week`, `This Month`, `This Year`, or
`Custom range`. Choosing Custom reveals start and end date inputs, seeded with today so
they are never blank, and each bounds the other to prevent an inverted range.

`This Week` is Monday through Sunday. `This Month` and `This Year` are calendar periods,
not trailing windows.

All of this resolves through `resolveDateRange` in `src/lib/dateRange.ts`, which returns an
inclusive `{ from, to }` pair of `YYYY-MM-DD` strings. `All time` returns two empty strings,
meaning unbounded.

### Why date-only comparison

Record timestamps are stored as `YYYY-MM-DD H:MM:SS`, with single-digit hours in the seeded
data. Comparisons truncate to the first ten characters and compare lexicographically, which
is correct for ISO dates. Comparing full timestamps would exclude a record delivered at
17:45 on the last day of the selected range.

## Metric cards

| Card | Records link |
| --- | --- |
| Documents In-Review | `status = In-Review` |
| Documents Completed | `status = Completed` |
| Documents On-Hold | `status = On-Hold` |
| Unassigned (Manager, Administrator) | `assigned_analyst_id` is empty |

Statuses are derived, not stored — see `Data_Model.md`. Each number is an anchor carrying
the currently selected date range, so drilling in preserves the range the user was looking
at. The Unassigned card also renders an explicit "Assign these records" link beneath the
count, and outlines itself in amber while the count is above zero.

## SLA stacked bar chart

Rendered by `components/snapshot/SlaStackedChart.tsx`, scoped to the same records as the
cards.

Each bar is one time bucket, split into **SLA met** and **SLA missed**. Granularity is
chosen from the span of the resolved window:

| Span | Bucket |
| --- | --- |
| 31 days or fewer | Day |
| 32 to 182 days | Week |
| Longer, or All time | Month |

Under `All time` the window is unbounded, so `windowForRecords` widens it to the span
actually present in the data before bucketing. Bucket generation is capped at 400 buckets
as a guard against a stray far-future date producing an unbounded loop.

The larger series is declared first so it renders on the bottom of every bar, keeping the
smaller segment on top where it stays legible. Recharts stacks in declaration order.

Hovering a segment shows a tooltip with the bucket label and the count. Clicking a segment
navigates to Records filtered to that bucket's date window and that SLA outcome. Because a
Recharts tooltip cannot hold a focusable link, a collapsible list of the same counts as real
anchors sits beneath the chart; this is the keyboard and screen-reader path to the same
destinations.

### Edge cases

- **Records with no SLA outcome.** `sla_met` is empty until a record is delivered. Those
  records are excluded from the stacks and reported as a count in the card description,
  rather than being silently dropped or lumped into "missed".
- **One record, one bucket.** Under the `both` basis a record can match on either date. The
  earliest matching day wins, so a record is never counted in two buckets.
- **Empty state.** When no record in range has an outcome, the chart is replaced with an
  explanatory line instead of rendering empty axes.
- **`sla_met` values.** Both `Y`/`N` and `YES`/`NO` are accepted when bucketing, since the
  column is not strictly normalised across the seeded data.
