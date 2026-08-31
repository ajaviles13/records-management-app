/**
 * Verifies the My Snapshot -> Records deep-link contract and the date bucketing that
 * drives the SLA chart. Run with: npx tsx scripts/navContract.test.ts
 */
import assert from "node:assert/strict";
import {
  bucketEnd,
  bucketStart,
  bucketStarts,
  chartDay,
  granularityFor,
  recordMatchesWindow,
  resolveDateRange,
  windowForRecords,
} from "../src/lib/dateRange";
import { buildRecordsLink, parseRecordsLink } from "../src/lib/recordsNav";
import type { FileRecord, SnapshotDateRange } from "../src/types";

let passed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${label}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL  ${label}\n      ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

function record(partial: Partial<FileRecord>): FileRecord {
  return { received_at_est: "", delivered_at_est: "", sla_met: "", assigned_analyst_id: "", ...partial } as FileRecord;
}

check("a status link round-trips through the URL", () => {
  const url = buildRecordsLink({ viewId: "all-records", filters: { status: ["In-Review"] } });
  const parsed = parseRecordsLink(url.slice(url.indexOf("?")));
  assert.equal(parsed.viewId, "all-records");
  assert.deepEqual(parsed.filters, { status: ["In-Review"] });
  assert.equal(parsed.dateWindow, null);
});

check("a date window round-trips with its basis", () => {
  const url = buildRecordsLink({
    viewId: "all-records",
    filters: { sla_met: ["N"] },
    dateWindow: { basis: "delivered", from: "2026-07-01", to: "2026-07-31" },
  });
  const parsed = parseRecordsLink(url.slice(url.indexOf("?")));
  assert.deepEqual(parsed.dateWindow, { basis: "delivered", from: "2026-07-01", to: "2026-07-31" });
  assert.deepEqual(parsed.filters, { sla_met: ["N"] });
});

check("the unassigned sentinel survives the round trip", () => {
  const url = buildRecordsLink({ filters: { assigned_analyst_id: ["__notset__"] } });
  const parsed = parseRecordsLink(url.slice(url.indexOf("?")));
  assert.deepEqual(parsed.filters, { assigned_analyst_id: ["__notset__"] });
});

check("multi-value filters survive the round trip", () => {
  const url = buildRecordsLink({ filters: { status: ["In-Review", "On-Hold"] } });
  const parsed = parseRecordsLink(url.slice(url.indexOf("?")));
  assert.deepEqual(parsed.filters, { status: ["In-Review", "On-Hold"] });
});

check("an incomplete date window is dropped rather than half-applied", () => {
  const url = buildRecordsLink({ dateWindow: { basis: "both", from: "2026-07-01", to: "" } });
  assert.equal(url, "/records");
});

check("a bare link carries no query string", () => {
  assert.equal(buildRecordsLink({}), "/records");
});

check("all time resolves to an unbounded window", () => {
  const range: SnapshotDateRange = { preset: "all", basis: "both", from: "", to: "" };
  assert.deepEqual(resolveDateRange(range), { from: "", to: "" });
});

check("this month resolves to the calendar month", () => {
  const range: SnapshotDateRange = { preset: "month", basis: "both", from: "", to: "" };
  const window = resolveDateRange(range, new Date(2026, 1, 14));
  assert.deepEqual(window, { from: "2026-02-01", to: "2026-02-28" });
});

check("this week resolves Monday through Sunday", () => {
  const range: SnapshotDateRange = { preset: "week", basis: "both", from: "", to: "" };
  // 2026-08-19 is a Wednesday.
  const window = resolveDateRange(range, new Date(2026, 7, 19));
  assert.deepEqual(window, { from: "2026-08-17", to: "2026-08-23" });
});

check("a record delivered late in the day is still inside the window", () => {
  const row = record({ received_at_est: "2026-07-01 9:00:00", delivered_at_est: "2026-07-31 17:45:00" });
  assert.equal(recordMatchesWindow(row, { from: "2026-07-31", to: "2026-07-31" }, "delivered"), true);
});

check("basis received ignores the delivered date", () => {
  const row = record({ received_at_est: "2026-06-01 9:00:00", delivered_at_est: "2026-07-15 9:00:00" });
  assert.equal(recordMatchesWindow(row, { from: "2026-07-01", to: "2026-07-31" }, "received"), false);
  assert.equal(recordMatchesWindow(row, { from: "2026-07-01", to: "2026-07-31" }, "delivered"), true);
  assert.equal(recordMatchesWindow(row, { from: "2026-07-01", to: "2026-07-31" }, "both"), true);
});

check("an undelivered record never matches a delivered-only window", () => {
  const row = record({ received_at_est: "2026-07-10 9:00:00", delivered_at_est: "" });
  assert.equal(recordMatchesWindow(row, { from: "2026-07-01", to: "2026-07-31" }, "delivered"), false);
});

check("granularity widens as the span grows", () => {
  assert.equal(granularityFor({ from: "2026-08-01", to: "2026-08-20" }), "day");
  assert.equal(granularityFor({ from: "2026-05-01", to: "2026-08-01" }), "week");
  assert.equal(granularityFor({ from: "2025-01-01", to: "2026-08-01" }), "month");
  assert.equal(granularityFor({ from: "", to: "" }), "month");
});

check("month buckets cover the range inclusively", () => {
  const starts = bucketStarts({ from: "2026-01-15", to: "2026-04-02" }, "month");
  assert.deepEqual(starts, ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
  assert.equal(bucketEnd("2026-02-01", "month"), "2026-02-28");
});

check("a day lands in the month bucket that contains it", () => {
  assert.equal(bucketStart("2026-03-17", "month"), "2026-03-01");
  assert.equal(bucketStart("2026-03-17", "week"), "2026-03-16");
  assert.equal(bucketStart("2026-03-17", "day"), "2026-03-17");
});

check("an unbounded window widens to the span present in the data", () => {
  const rows = [
    record({ received_at_est: "2026-03-02 9:00:00" }),
    record({ received_at_est: "2026-01-05 9:00:00", delivered_at_est: "2026-06-09 9:00:00" }),
  ];
  assert.deepEqual(windowForRecords(rows, { from: "", to: "" }, "both"), { from: "2026-01-05", to: "2026-06-09" });
});

check("a record is charted in exactly one bucket under the both basis", () => {
  const row = record({ received_at_est: "2026-02-20 9:00:00", delivered_at_est: "2026-03-05 9:00:00" });
  assert.equal(chartDay(row, { from: "2026-01-01", to: "2026-12-31" }, "both"), "2026-02-20");
  assert.equal(chartDay(row, { from: "2026-03-01", to: "2026-03-31" }, "both"), "2026-03-05");
});

check("an analyst chart link carries assigned_analyst_id with sla_met", () => {
  const url = buildRecordsLink({
    viewId: "__all__",
    filters: { sla_met: ["Y"], assigned_analyst_id: ["1"] },
    dateWindow: { basis: "both", from: "2026-06-01", to: "2026-06-30" },
  });
  const parsed = parseRecordsLink(url.slice(url.indexOf("?")));
  assert.equal(parsed.viewId, "__all__");
  assert.deepEqual(parsed.filters, { sla_met: ["Y"], assigned_analyst_id: ["1"] });
  assert.deepEqual(parsed.dateWindow, { basis: "both", from: "2026-06-01", to: "2026-06-30" });
});

check("a chart segment link filters Records to that bucket and outcome", () => {
  const url = buildRecordsLink({
    viewId: "all-records",
    filters: { sla_met: ["N"] },
    dateWindow: { basis: "both", from: "2026-03-01", to: bucketEnd("2026-03-01", "month") },
  });
  const parsed = parseRecordsLink(url.slice(url.indexOf("?")));
  assert.deepEqual(parsed.filters, { sla_met: ["N"] });
  assert.deepEqual(parsed.dateWindow, { basis: "both", from: "2026-03-01", to: "2026-03-31" });

  // The record the segment represents must survive the Records-side predicate.
  const row = record({ delivered_at_est: "2026-03-14 11:00:00", sla_met: "N" });
  assert.equal(recordMatchesWindow(row, parsed.dateWindow!, parsed.dateWindow!.basis), true);
});

console.log(`\n${passed} checks passed`);
