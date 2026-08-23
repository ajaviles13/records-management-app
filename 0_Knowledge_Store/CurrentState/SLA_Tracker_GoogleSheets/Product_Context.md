# Egnyte ETL Documentation

```yaml
product: Egnyte ETL / SLA Tracker
version: 5.0
status: reconciled_with_live_code
last_updated: 2026-07-29
supersedes: v4.0 (2024-12-16) — v4.0 had drifted from deployed code; see "Changelog vs v4.0" at bottom
source_of_truth_files_reviewed:
  - Latest__Code_gs__code_-_last_updated_Feb._5th_2026  (main backend, ~1346 lines)
  - Google_Apps_Script_Code_-_calculateStatus.gs
  - Google_Apps_Script_Code_-_calculateSLA.gs
  - Google_Apps_Script_Code_-_showGenerateNewLanguageTab.gs
  - SLA_Monthly_Report_Generator_-_MonthlyReportGenerator_Code.gs (related, separate tool)
developer: AJ (aj.a@MindfulSolutionsGroup.com) — Consultant, Mindful Solutions Group
egnyte_domain: auratrans.egnyte.com
destination: SLA Tracking Google Sheet (Word_Type and PDF_Type templates)
```

> **Note on this revision:** This version was produced by diffing the December 2024 "v4.0" documentation against the actual deployed Apps Script (last touched Feb 5, 2026). Several things had changed without the docs being updated — see the **Changelog vs v4.0** section at the end for the full list of corrections. Treat this file as authoritative going forward; re-run the diff against source whenever `Code.gs` changes.

---

## 1. Purpose & Key Features

Automates extraction of file metadata from Egnyte folders into a Google Sheet for SLA compliance tracking. Core capabilities:

- **Dual-mode operation** — `Received` and `Delivered` import flows, tracked independently.
- **Dual template types** — `PDF_Type` and `Word_Type`, each with different column mappings and SLA math.
- **Urgency detection** — Word_Type only; folder path containing `"URGENT"` (case-insensitive) sets `isUrgent`.
- **Smart Delivered mode** — only searches for rows already flagged in the QA Delivery By column with empty delivery timestamps; efficient even against folders with thousands of files (Map-based O(1) lookup).
- **Duplicate detection** (Received mode) — user picks which duplicate rows to overwrite via checklist UI.
- **Automatic Status + SLA calculation** — as of the current code, `Delivered` mode calls `calculateStatus()` and `calculateSLA()` **programmatically** and writes the results directly into the sheet at the moment delivery timestamps are recorded (see §6). These two functions are still exposed as `@customfunction`s usable directly in sheet formulas too.
- **Timezone conversion** — Egnyte's UTC epoch `uploaded` timestamp → Eastern Time (EST/EDT) via `Utilities.formatDate()` with `America/New_York`.
- **Efficient pagination** — up to 3,000 files per API call, with early-exit once all target files are found (Delivered mode).
- **Token refresh flow** — access tokens are cached and auto-refreshed via a refresh-token grant, falling back to password auth if refresh fails (see §7). Relevant to the June 2026 Egnyte 30-day token TTL change.
- **Language tab generation** — clones a `TEMPLATE` sheet (formatting, formulas, validation, protected ranges) into a new named tab.

---

## 2. Architecture & Files

```
Egnyte File Extraction/
├── Code.gs                              # Main backend logic
├── Dialog.html                          # Main extraction UI
├── calculateSLA.gs                      # SLA compliance custom function
├── calculateStatus.gs                   # Business/consecutive hours custom function
└── showGenerateNewLanguageTab.html      # Tab generation UI
```

There is also a menu item / function stub for **`🧮 Calculate Status and SLA`** (`showCalcStatusSLA()`), currently **commented out** in the `onOpen()` menu and referencing an `CalcStatusSLA_html` file that does not exist in the five-file structure above. Treat this as an in-progress/abandoned feature, not a supported entry point.

### Related, separate tool: SLA Monthly Report Generator

A **separate** bound script (own `onOpen()`, own menu `☁️ Generate Monthly Report`) aggregates four source SLA spreadsheets (Word/PDF × two Molina LOB groupings) into one consolidated monthly report. It is not part of the ETL tool's file structure and deserves its own documentation pass if AJ wants it maintained here — flagging its existence so it isn't lost. Files: `MonthlyReportGenerator_Code.gs`, `MonthlyReportDialog.html`.

### Code.gs Modules

| Module | Responsibility |
|---|---|
| Configuration | Credentials (Script Properties), template type, file-extension list, API params |
| Column Mapping Helper | `getColumnMapping()` — dynamic column indices per template type |
| Menu & Dialog Management | `onOpen()`, `showDialog()`, `showGenerateNewLanguageTab()` |
| Authentication | `getAccessToken()`, `refreshAccessToken()` — cached token + refresh-token flow |
| API Integration | `extractFolderIdFromLink()`, `getFolderContents()` (paginated) |
| Data Processing | `stripFileExtension()`, `convertEpochToEST()`, `formatSheetDateTime()` |
| Urgency Detection | `isFolderUrgent()` |
| Duplicate Detection | `checkForDuplicatesReceived()` |
| Smart Search | `buildDeliveredSearchList()`, `getFilesWithFlagNotSet()`, `searchFolderForDeliveredFiles()` |
| Data Writing | `writeDataToSheet()`, `processReceivedWithOverwrite()`, `updateSheetWithDeliveredFiles()` |
| Tab Generation | `generateNewLanguageTab()`, `getSheetNames()`, `getSheetInfo()` |

---

## 3. Template Type System

Set in `Code.gs`:

```javascript
const CONFIG = {
  // ...credentials from Script Properties...
  TEMPLATE_TYPE: "PDF_Type",  // or "Word_Type"
  FILE_EXTENSIONS_TO_REMOVE: [".pdf", ".docx", ".txt"],
  API_CONFIG: {
    list_content: true,
    list_custom_metadata: true,
    count: 3000,
    offset: 0,
    sort_by: "last_modified",
    sort_direction: "ascending",   // ⚠️ see note below
    include_perm: true
  }
};
```

> ⚠️ **`sort_direction` is `"ascending"` in the live code**, despite an inline comment claiming it was "updated from ascending to descending." If descending was the intended behavior, this is a live bug, not just a stale comment — worth confirming with AJ before next deploy.

| | PDF_Type | Word_Type |
|---|---|---|
| Urgency detection | Not applicable | Yes — folder path scan for `"URGENT"` |
| isUrgent column | — | Column J |
| QA Delivery By column | Column J | Column K |
| Status column (auto-written) | Column L | Column M |
| SLA thresholds | 60 hrs | Urgent (YES): 6 hrs · Regular (NO): 24 hrs |

---

## 4. Google Sheets Column Mapping

Returned dynamically by `getColumnMapping()`:

```javascript
function getColumnMapping() {
  const isPDFType = CONFIG.TEMPLATE_TYPE === "PDF_Type";
  return {
    FILE_NAME: 2,                          // Column B
    DATE_RECEIVED: 5,                      // Column E
    TIME_RECEIVED: 6,                      // Column F
    DATE_DELIVERED: 7,                     // Column G
    TIME_DELIVERED: 8,                     // Column H
    IS_URGENT: isPDFType ? null : 10,      // Column J (Word_Type only)
    QA_DELIVERY_BY: isPDFType ? 10 : 11,   // Column J (PDF) / K (Word)
    STATUS: isPDFType ? 12 : 13            // Column L (PDF) / M (Word)
  };
}
```

The **SLA MET** column is *not* returned by `getColumnMapping()` — it's hardcoded separately as **Column I (index 9)** for both template types (`const SLA_MET_COLUMN = 9;` in `updateSheetWithDeliveredFiles()`).

| Col | Purpose | Written by | Notes |
|---|---|---|---|
| A | Project Number | External / manual | Not touched by ETL |
| B | File Name | ETL | Extension stripped (`.pdf`, `.docx`, `.txt`) |
| C | Line of Business | External / manual | Not touched by ETL |
| D | State | External / manual | Not touched by ETL |
| E | Date Received | ETL | UTC → Eastern (MM/DD/YYYY) |
| F | Time Received | ETL | UTC → Eastern (H:MM:SS AM/PM) |
| G | Date Delivered | ETL | UTC → Eastern (MM/DD/YYYY) |
| H | Time Delivered | ETL | UTC → Eastern (H:MM:SS AM/PM) |
| I | SLA MET (Y/N/NA) | ETL (auto, Delivered mode) | Written by `calculateSLA()` call inside `updateSheetWithDeliveredFiles()` |
| J | isUrgent (Word) / QA Delivery By (PDF) | ETL / manual | Template-dependent |
| K | QA Delivery By (Word only) | Manual | — |
| L | Status (PDF) | ETL (auto, Delivered mode) | e.g. `"38.25 Consecutive Business Hours"` |
| M | Status (Word) | ETL (auto, Delivered mode) | e.g. `"5.10 Business Hours"` |

---

## 5. Custom Google Sheets Functions

### `calculateStatus()`

```javascript
=calculateStatus(receivedDate, receivedTime, deliveredDate, deliveredTime, template_type, isUrgent)
```

**6 parameters — there is no `holidayRange` argument.** Holidays are read internally from a hardcoded sheet/range: sheet `ℹ️ HOW TO USE`, range `A40:A51`. If that sheet/range is missing, the function silently continues with an empty holiday list (logged, not surfaced to the user).

| Param | Example | Notes |
|---|---|---|
| `receivedDate` | `"12/14/2024"` or a Date cell | |
| `receivedTime` | `"2:30:00 PM"` or a Date cell | |
| `deliveredDate` | `"12/15/2024"` | |
| `deliveredTime` | `"10:15:00 AM"` | |
| `template_type` | `"Word"` or `"PDF"` | Exact strings, case-sensitive |
| `isUrgent` | `"YES"` / `"NO"` | Required for Word; ignored for PDF |

**Return values (these strings changed from earlier docs — "Support Hours" no longer appears anywhere):**

| Case | Return |
|---|---|
| Both timestamps missing | `"Awaiting Received and Delivered timestamps."` |
| Received missing | `"Awaiting Received timestamp."` |
| Delivered missing | `"Awaiting Delivered timestamp."` |
| Bad `template_type` | `"The 'template_type' parameter must be either 'Word' or 'PDF'"` |
| Bad/missing `isUrgent` (Word) | `"isUrgent cell must be set to 'YES' or 'NO'"` |
| Unparseable dates | `"Invalid date or time format"` |
| Delivered < Received | `"Delivered timestamp cannot be before Received timestamp"` |
| Any other exception | `"Error calculating status"` |
| **PDF** (success) | `"{N} Consecutive Business Hours"` — Mon–Fri 8 AM–9 PM, Sat/Sun/holidays closed (0 hrs) |
| **Word + Urgent (YES)** (success) | `"{N} Business Hours"` — business-hours-only counting, not consecutive |
| **Word + Regular (NO)** (success) | `"{N} Consecutive Hours"` — Mon–Sat 8 AM–9 PM (full days count as 24 consecutive hrs once open) + Sun/holidays 1 PM–6 PM window; internal 24-hour SLA cap/freeze logic applies (see source for exact mechanics if debugging edge cases) |

`updateSheetWithDeliveredFiles()` additionally maps any of `"Invalid date"`, `"Awaiting"`, or `"Error calculating"` substrings to a user-facing `"❓Error - Invalid date or time format"` when writing to the Status column.

### `calculateSLA()`

```javascript
=calculateSLA(template_type, isUrgent_column, status_column)
```

Signature and thresholds are **unchanged** from prior documentation and match the live code:

| Param | Notes |
|---|---|
| `template_type` | `"Word"` or `"PDF"` (case-insensitive, trimmed) |
| `isUrgent_column` | `"YES"`/`"NO"`, only relevant for Word |
| `status_column` | The string output from `calculateStatus()` — parsed via regex for the first numeric value |

| Return | Meaning |
|---|---|
| `"Y"` | Hours ≤ threshold |
| `"N"` | Hours > threshold |
| `"NA"` | Missing/invalid `template_type`, unparseable `status_column`, or Word with invalid/missing `isUrgent_column` |

**Thresholds:** Word Urgent = 6 hrs · Word Regular = 24 hrs · PDF = 60 hrs.

Example: `=calculateSLA("Word", J2, M2)` — note the status-column reference should point at Column M for Word_Type (or L for PDF_Type) per §4, not a generic "status column" placeholder.

---

## 6. Automatic Status/SLA Calculation (Delivered Mode) — Architecture Note

This is the most significant behavioral change since the last full documentation pass: `calculateStatus()` and `calculateSLA()` are no longer *only* formulas a user drops into a cell. When the Delivered-mode workflow finds files and calls `updateSheetWithDeliveredFiles()`, the script:

1. Batch-reads existing `Date Received`/`Time Received` (and `isUrgent` for Word_Type) for the affected rows.
2. Calls `calculateStatus(...)` directly in Apps Script for each found file and writes the result to the Status column (L/M).
3. Feeds that Status string into `calculateSLA(...)` and writes the Y/N/NA result to Column I.
4. Writes `Date Delivered`, `Time Delivered`, and `SLA MET` (G, H, I) together in a single `setValues()` call.

Both functions remain marked `@customfunction`, so they still work if manually entered as live formulas elsewhere in the sheet — but the primary SLA/Status population path for Delivered-mode rows is now this scripted call, not a formula the user maintains. Worth knowing before assuming a blank/wrong Status or SLA cell is a formula problem — check whether the script-write path ran instead.

---

## 7. Authentication & Token Management

OAuth 2.0, Resource Owner Password Credentials (ROPC) grant, **plus a refresh-token flow that is fully implemented and live** (not just drafted):

```
getAccessToken()
  ├─ cached token still valid (5-min buffer)?  → return it
  ├─ cached token expired, refresh token stored?
  │     ├─ refreshAccessToken(refreshToken) succeeds → return new token
  │     └─ fails → delete stored refresh token, fall through
  └─ password grant (CLIENT_ID/SECRET/USERNAME/PASSWORD) → new token
        stores access token, expiration, and refresh token (if returned)
```

`refreshAccessToken()` posts `grant_type: 'refresh_token'` to `https://{EGNYTE_DOMAIN}/puboauth/token`, stores the new access token + expiration, and rotates the stored refresh token if Egnyte returns a new one.

**Relevance to the June 2026 Egnyte 30-day token TTL change:** this flow should already be resilient to that change since it refreshes proactively before falling back to a fresh password grant. Confirm in production logs that refreshes are succeeding rather than silently falling back to password auth every 30 days (the fallback works, but it's less desirable and worth monitoring for quota/friction reasons).

Script Properties used: `CLIENT_ID`, `CLIENT_SECRET`, `USERNAME`, `PASSWORD` (user-set) and `EGNYTE_ACCESS_TOKEN`, `EGNYTE_TOKEN_EXPIRATION`, `EGNYTE_REFRESH_TOKEN` (managed automatically by the script — do not set manually).

---

## 8. Egnyte API Configuration

```
GET https://auratrans.egnyte.com/pubapi/v1/fs/ids/folder/{FOLDER_ID}
    ?list_content=true
    &list_custom_metadata=true
    &count=3000
    &offset={dynamic}
    &sort_by=last_modified
    &sort_direction=ascending      ⚠️ see §3 note
    &include_perm=true
```

| API Field | Type | Usage |
|---|---|---|
| `name` | String | Written to Column B after stripping extensions |
| `uploaded` | Number (epoch ms, UTC) | Converted to Eastern via `convertEpochToEST()` |
| `path` | String | Urgency detection (Word_Type only) — checks for `"URGENT"` |

**Known open issue (not yet addressed):** org-level API quota errors under high `count` (3,000) combined with multiple concurrent users. A centralized queue/rate-limiter has been scoped previously but not implemented.

---

## 9. Workflow Logic

### Received Mode

1. Fetch folder contents.
2. `checkForDuplicatesReceived()` — matches Column B filename **and** existing E/F data.
3. **No duplicates:** `writeDataToSheet()` finds first empty row in Column B (not `getLastRow()` — unreliable per prior learnings) and batch-writes B, E, F, G(blank), H(blank), and J (Word_Type isUrgent) in single-range `setValues()` calls.
4. **Duplicates found:** UI shows checklist; `processReceivedWithOverwrite()` handles per-file selected/new/skip logic, updating E/F/J for overwrites or inserting new rows.

### Delivered Mode

Optimized for large folders — only searches for what's actually flagged.

1. `buildDeliveredSearchList()` — rows where Column B has a value, the QA Delivery By column (J for PDF / K for Word) has a value, and G or H is empty.
2. `getFilesWithFlagNotSet()` — separately identifies rows with received timestamps but no delivered timestamps *and* no QA Delivery By flag set (surfaced in the report as "Flag Not Set" so nothing silently falls through).
3. If nothing to search: informational message, or a "Flag Not Set" report if applicable.
4. Otherwise: paginated search via `searchFolderForDeliveredFiles()` using a `Map` for O(1) lookup, early-exits once all targets are found.
5. `updateSheetWithDeliveredFiles()` writes G/H/I (Date Delivered, Time Delivered, SLA MET) and L/M (Status) per §6.
6. Report shows Updated / Not Found / Flag Not Set with color-coded tags.

---

## 10. Generate Language Tab Feature

Unchanged from prior documentation:

- Menu: **📦 Egnyte File Extraction → ➕ Generate Language Tab**
- Validates: non-empty name, ≤15 characters, unique, no `*`, `/`, `?`, and a sheet literally named `TEMPLATE` (all caps) must exist.
- `templateSheet.copyTo(ss)` copies all values, formulas, formatting, column widths/row heights, data validation, conditional formatting, and protected ranges.
- New sheet is renamed and moved immediately after `TEMPLATE` via `moveActiveSheet(templateIndex + 2)` (0-indexed `getSheets()` vs. 1-indexed `moveActiveSheet()` — note the off-by-one is intentional here, not a bug).

---

## 11. Key Function Reference

| Function | Description |
|---|---|
| `processEgnyteExtraction(directLink, deliveryType, destinationTab)` | Main entry point; validates input, routes to Received or Delivered logic |
| `getColumnMapping()` | Returns column indices per template type (§4) |
| `isFolderUrgent(folderPath)` | Case-insensitive check for `"URGENT"` in path |
| `getAccessToken()` / `refreshAccessToken(refreshToken)` | Token caching + refresh-token flow (§7) |
| `getFolderContents(folderId, offset)` | Paginated Egnyte API call |
| `convertEpochToEST(epochMilliseconds)` | UTC epoch ms → `{date, time}` Eastern strings |
| `formatSheetDateTime(dateValue, timeValue)` | Formats existing sheet date/time using UTC methods (avoids re-conversion drift) |
| `checkForDuplicatesReceived(files, sheetName)` | Received-mode duplicate scan |
| `writeDataToSheet(folderData, sheetName, deliveryType)` | Batch write for new Received/Delivered rows |
| `processReceivedWithOverwrite(...)` | Per-file overwrite/new/skip handling after duplicate checklist |
| `buildDeliveredSearchList(sheetName)` | Builds the Delivered-mode search target list |
| `getFilesWithFlagNotSet(sheetName)` | Rows missing the QA Delivery By flag entirely |
| `searchFolderForDeliveredFiles(folderId, searchList)` | Paginated Map-based search |
| `updateSheetWithDeliveredFiles(foundFiles, sheetName)` | Writes G/H/I/L(or M) — includes auto Status+SLA calc (§6) |
| `generateNewLanguageTab(newTabName)` | Tab cloning from `TEMPLATE` |
| `calculateStatus(...)` | Custom Sheets function — hours calc (§5) |
| `calculateSLA(...)` | Custom Sheets function — Y/N/NA compliance (§5) |

---

## 12. Setup Instructions

Prerequisites: Google Sheet edit access, Egnyte admin access to generate API credentials.

1. **Egnyte:** Settings → Integrations → API Applications → create Internal Application → copy Client ID/Secret + domain.
2. **Apps Script:** create the five files listed in §2, paste source.
3. **Script Properties** (gear icon → Project Settings → Script Properties): set `CLIENT_ID`, `CLIENT_SECRET`, `USERNAME`, `PASSWORD`. Do **not** manually set `EGNYTE_ACCESS_TOKEN`, `EGNYTE_TOKEN_EXPIRATION`, or `EGNYTE_REFRESH_TOKEN` — these are managed automatically (§7).
4. **`CONFIG.TEMPLATE_TYPE`** — set to `"PDF_Type"` or `"Word_Type"` in `Code.gs`.
5. Refresh the sheet, authorize via the new menu prompt.

---

## 13. Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Authentication failed | Bad credentials or Internal Applications disabled for the user | Verify Script Properties; confirm Egnyte user permits Internal Apps |
| Folder ID extraction failed | Link doesn't match `/navigate/folder/{UUID}` pattern | Confirm link format |
| Incorrect timestamps | N/A — conversion is handled via `Utilities.formatDate()` + `America/New_York` | If still wrong, check the source `uploaded` epoch value itself |
| `isUrgent` not setting | `TEMPLATE_TYPE` is `PDF_Type`, or path lacks `"URGENT"` | Verify template type and folder path |
| `calculateStatus` returns an "Awaiting..." message | Missing received/delivered timestamps | Fill required cells |
| `calculateStatus` returns `"The 'template_type' parameter must be..."` | `template_type` isn't exactly `"Word"` or `"PDF"` | Check spelling/case |
| `calculateStatus` returns `"Delivered timestamp cannot be before Received timestamp"` | Data entry error / out-of-order timestamps | Correct the source data |
| `calculateSLA` returns `"NA"` | Bad `template_type`, unparseable status string, or missing Word `isUrgent` | Confirm inputs; confirm Status cell reference points at the correct L/M column (§4) |
| Status/SLA cells blank or stale after a Delivered run | Might be a formula-vs-script-write mismatch | See §6 — Delivered mode writes these programmatically now, check the script path before assuming formula error |
| Generate Language Tab — TEMPLATE not found | No sheet named exactly `TEMPLATE` | Create/rename accordingly |
| QA Delivery By column looks wrong | Template type mismatch | PDF_Type = Column J, Word_Type = Column K |
| Repeated org-level API quota errors | Known unresolved issue — high `count` (3000) + concurrent users | No fix shipped yet; centralized rate-limiter previously scoped but not built |

---

## 14. Version History

**Version 5.0 (July 29, 2026)** — Documentation reconciled against live Feb 5, 2026 code (see Changelog below).

**Version 4.0 (December 16, 2024)** — Enhanced Delivered mode reporting, file-level reports for both modes, visual status indicators, folder path display, improved duplicate workflow UX.

**Version 3.0 (December 15, 2024)** — Template type system, urgency detection, dynamic column mapping, `calculateStatus()`/`calculateSLA()` introduced, Generate Language Tab feature, credentials moved to Script Properties.

**Version 2.0 (November 26, 2024)** — Smart Delivered mode with QA flag filtering, batch size 100→3,000, Map-based O(1) lookup, `Utilities.formatDate()` + `America/New_York` fix, sort direction change, progress dialog, "Files Not Found" dialog.

**Version 1.0 (November 25, 2024)** — Initial release: basic Received/Delivered modes, duplicate detection, extension stripping, basic timezone conversion.

---

## 15. Changelog vs. v4.0 (What Was Wrong / Missing)

This section exists so future doc passes can see exactly what drifted and why v5.0 differs from the previous "latest" doc:

1. **`calculateStatus()` signature** — v4.0 documented a 7th `holidayRange` parameter. Live code has 6 params; holidays come from a hardcoded sheet range (`ℹ️ HOW TO USE'!A40:A51`), not a passed argument.
2. **`calculateStatus()` return labels** — v4.0 said outputs looked like `"14.5 Business Hours"` / `"20.3 Support Hours"`. Live labels are `"Consecutive Business Hours"` (PDF), `"Business Hours"` (Word Urgent), `"Consecutive Hours"` (Word Regular). "Support Hours" does not appear in the live code at all.
3. **New STATUS column** (L for PDF, M for Word) added to `getColumnMapping()` — absent from v4.0's column tables.
4. **SLA MET column is hardcoded to Column I** regardless of template type — this wasn't explicit in v4.0's column mapping table, only implied by an example formula.
5. **Delivered mode now auto-calculates and writes Status + SLA** during `updateSheetWithDeliveredFiles()` — v4.0 described `calculateStatus`/`calculateSLA` purely as manually-placed sheet formulas. Both remain usable that way, but the primary write path changed (§6).
6. **Refresh-token flow is fully implemented and deployed**, not a "drafted, not yet tested" item — relevant to the June 2026 Egnyte 30-day token TTL change.
7. **`sort_direction` config value is `"ascending"`** in live code, contradicting both v4.0's documented `"descending"` and the code's own inline comment claiming it was updated to descending. Flagged as needing confirmation — may be a live bug.
8. **New helper `getFilesWithFlagNotSet()`** and its "Flag Not Set" report path — present in the color-coded tag system v4.0 mentioned in passing but not documented as its own function/workflow branch.
9. **Commented-out `🧮 Calculate Status and SLA` menu item** referencing a nonexistent `CalcStatusSLA_html` file — an in-progress feature not previously flagged as incomplete.
10. **Separate SLA Monthly Report Generator tool** (own script, own menu, aggregates 4 source sheets) — not mentioned anywhere in v4.0; noted here as a related-but-distinct system.

---

*For support: aj.a@MindfulSolutionsGroup.com*