# In-Depth Guide: Brightspace (D2L) CSV Grade & Feedback Auto-Filler

> Technical reference for v1.0.3. For installation and everyday use, start with the [step-by-step user guide](USER_GUIDE.md).

This advanced guide explains student matching, local state, CSV validation, and the verified-save state machine. Brightspace layouts and controls can differ by institution and course configuration.

## Contents

1. [Scope and lifecycle](#1-scope-and-lifecycle)
2. [CSV ingestion and identity](#2-csv-ingestion-and-identity)
3. [Target isolation and plaintext feedback](#3-target-isolation-and-plaintext-feedback)
4. [Verified save state machine](#4-verified-save-state-machine)
5. [Traversal, resume, and stop behavior](#5-traversal-resume-and-stop-behavior)
6. [Brightspace release boundaries](#6-brightspace-release-boundaries)
7. [Local state and privacy limits](#7-local-state-and-privacy-limits)
8. [Testing and acceptance](#8-testing-and-acceptance)

## 1. Scope and lifecycle

The userscript runs in the TA's or instructor's browser on a Brightspace Consistent Evaluation page. The intended flow is:

```text
real task CSV
     |
     v
validate and stage rows  -- any validation error -->  import blocked
     |
     v
identify same student and assignment
     |
     v
fill unique overall grade + overall feedback controls
     |
     v
click exact native "Save Draft"
     |
     v
wait for a fresh native save acknowledgement
     |
     v
full page reload
     |
     v
re-identify same student/context + read back score and feedback
     |                                      |
     v                                      v
verified -> resume cruise/navigation       mismatch or timeout -> pause
```

Only an exact, unique, enabled native **Save Draft** control is an eligible save target. The script does not substitute `Update`, `Publish`, or generic `Save`. Each save includes a page refresh and value check; timing depends on Brightspace's response and the page load.

The script changes only the overall grade and overall feedback fields. Rubric criteria, rubric scores, and unrelated editors are out of scope. It operates through page controls and their normal UI events: it does not make its own network requests or call a grading API directly. Brightspace handles server communication, including temporary saving while fields are edited. **Fill Current** means no explicit Save Draft or Publish click. See D2L's [evaluation guide](https://community.d2l.com/brightspace/kb/articles/34714-evaluate-assignment-activities) for the platform's own save behavior.

## 2. CSV ingestion and identity

The importer accepts a local simple format or a copy of an official course export. Whichever format is used, it must have exactly one unambiguous grade column. A grade-item header from an official export is accepted as-is; do not place competing `score`, `grade`, or `points` columns in the same file. `reason` or `Feedback` is a separate plaintext column for the userscript.

### Validation and staging

Rows are staged before the existing local database or progress state is replaced. Import is blocked with no staged-data commit when validation finds a hard conflict:

- duplicate IDs block the whole import;
- an explicit page ID that conflicts with a CSV row is a stop condition, not a name-fallback opportunity;
- a nonblank score that is not a valid non-negative decimal blocks the whole import;
- a no-ID file must have unique names after the script's normalization;
- a blank score explicitly marks an unsubmitted row. It is not an invalid score and is not a reason to write a grade.

Identical display names are allowed when distinct supported IDs disambiguate them. If an ID is genuinely absent on the page, the script may use a unique normalized name. It must not fall back to a name when an ID is present but mismatched or when multiple records remain possible.

### Using student IDs

The supported ID column is **OrgDefinedId** (also accepted as **Org Defined ID**). It is the institution-defined identifier from Brightspace's official Grades export. The script does not treat a username, email address, internal Brightspace user number, or a number found in a page URL as an equivalent ID.

1. Use a copy of the official export for the correct course. Keep the OrgDefinedId values unchanged, including leading zeros; a spreadsheet may need that column set to text.
2. Keep the student's first and last name columns, one target numeric grade column, and at most one feedback column. Remove other grade-item columns from this copy, not from the original export.
3. Keep the target grade column's heading exactly as exported. The example below shows the required shape, not a heading to substitute for your own course.
4. Import the copy on an individual evaluation page and check the preview.

Adding IDs to the CSV does not make an otherwise ambiguous page safe to match. To distinguish two students with the same name, the evaluation page must also expose their OrgDefinedId in a form this version recognizes. If it does not, the helper pauses; process those students manually using the official roster.

Example local input:

```csv
student,score,reason
Alice Example,95.0,"Strong work with a clear method and conclusion."
Bob Example,88.5,"Good work. Note for improvement: label the axes more clearly."
Casey Example,,"No submission"
```

Example export-derived input:

```csv
OrgDefinedId,Last Name,First Name,Target Points Grade <Numeric MaxPoints:100>,Feedback,End-of-Line Indicator
#1001,Example,Alice,95.0,"Strong work with a clear method and conclusion.",#
#1002,Example,Bob,88.5,"Good work. Note for improvement: label the axes more clearly.",#
#1003,Example,Casey,,"No submission",#
```

The grade-item header in the second example is illustrative. For a real task, preserve the exact header from the current course export. A file containing `Feedback` is userscript input, not automatically a valid native Brightspace Gradebook import.

### Plaintext feedback and CSV escaping

`Reason`/`Feedback` is treated as plaintext. Commas, quotes, and line breaks must follow ordinary CSV quoting rules. The userscript escapes special characters before placing the text into the Brightspace editor and preserves line breaks. HTML is not an input language: markup-looking text is displayed as text rather than interpreted as arbitrary markup.

```csv
student,score,reason
"Alice Example",95.0,"Good work.

Note for improvement: show the intermediate calculation on the next revision."
```

### Revision scope

Local progress and verified records are scoped by course, assignment, and CSV revision. Changing any of those inputs, or upgrading from the older cache/record contract, requires importing the real task CSV again. The sample file is documentation only; no default sample database may write grades.

## 3. Target isolation and plaintext feedback

Brightspace uses custom elements, Shadow DOM, and editor frames. The source traverses the page's reachable component boundaries so it can locate the current page's controls, but discovery is not permission to edit every matching element.

Before filling, the script filters candidates to the overall grade and overall feedback controls. It pauses if a target is absent or ambiguous. Rubric ancestors and unrelated editors are explicitly excluded. This protects a rubric score from being overwritten when a similarly shaped numeric input is present.

For feedback, the script synchronizes the editor's value and the events required by the current Brightspace editor integration. The logical input remains plaintext; escaping and line-break rendering are implementation details used to avoid interpreting student or instructor feedback as HTML.

## 4. Verified save state machine

For a submitted row that needs a new draft save, the sequence is:

1. Identify the student from the current page and resolve the row by supported ID or, only when the ID is absent, a unique normalized name.
2. Locate exactly one overall grade control and exactly one overall feedback control. Pause on missing or ambiguous controls.
3. Fill the nonnegative numeric score and escaped plaintext feedback.
4. Locate exactly one enabled native control whose accessible/text label is **Save Draft** and click it. Do not click `Update`, `Publish`, or generic `Save`.
5. Wait for a fresh native save acknowledgement. An old status message, a local cache entry, or a click event alone is not a fresh acknowledgement.
6. Once the acknowledgement is observed, perform a full page reload.
7. Recover the same course/assignment context, CSV revision, student identity, score, and feedback. The score and normalized feedback must match the row that was just saved.
8. Mark the row verified and allow Auto-Cruise to resume or navigate.

The readback is intentionally stronger than “the button was clicked.” A save acknowledgement proves that Brightspace reported that action; only the post-reload readback proves the expected record is present on the same page/context. If readback is unavailable or mismatched, the run pauses and the row remains unresolved.

Save, publish/release, Gradebook synchronization, and student visibility are separate states. A saved draft may later synchronize to a configured Gradebook item, but that behavior is tenant/configuration-dependent and must be checked separately. The userscript never clicks a publish control.

## 5. Traversal, resume, and stop behavior

Auto-Cruise can optionally rewind to the beginning of the iterator and move forward. Rewind and navigation are convenience operations; they do not waive identity or readback checks. A submitted row is not counted as complete merely because it was visited, filled, or present in local progress. Unsubmitted rows are explicitly skipped according to their blank score state.

With **Skip matching existing evaluations** enabled, a published evaluation or a previously reload-verified draft can be skipped when the visible score and any supplied feedback match the current CSV. A published mismatch pauses before filling or clicking Update. A match is recorded as **existing matched**, not as a newly saved draft. The script remembers its own fills during the page's lifetime so that an unsaved fill cannot qualify as an existing match even if Brightspace's editor reports a clean state.

After a verified readback, Auto-Cruise resumes using the same task scope. It pauses for:

- an unrecognized save acknowledgement;
- a failed, missing, or mismatched post-reload readback;
- explicit or conflicting student identity evidence;
- multiple or missing overall controls;
- an unexpected, destructive, or unsaved-navigation dialog;
- a navigation or full-reload timeout.

Unknown, destructive, and unsaved-navigation dialogs are not auto-accepted. The script may observe a dialog while waiting, but it must not guess which button is safe. Manual review is required.

Emergency Stop invalidates the active run token and all pending continuations. It cannot recall temporary-autosave or Save Draft requests that Brightspace has already sent, or undo server-side changes. Restart only after confirming the current page and task CSV revision.

Because every save includes a reload and readback, completion time is not specified here. Report verified rows and paused rows from observed state; do not promise a fixed per-student rate or 100% completion without a representative live acceptance run.

## 6. Brightspace release boundaries

The userscript operates inside an existing instructor-authorized evaluation session. It does not grant permission to grade, upload, publish, or contact students. The instructor remains responsible for:

- confirming the course, assignment, roster, and CSV are the intended ones;
- reviewing the drafts and any paused state;
- deciding when and how Brightspace publishes/releases grades;
- checking Gradebook synchronization and the intended student-facing view;
- following institutional policies for student data and automation.

The native UI can send temporary field edits as well as explicit saves to Brightspace's server. A network request alone does not establish publication, student visibility, permanent persistence, or a complete roster. Use the current Brightspace page and relevant student-facing view for those checks.

## 7. Local state and privacy limits

The script has no direct network/API calls, telemetry, or third-party upload destination. It interacts with Brightspace's existing UI; requests made by Brightspace in response are platform behavior, not a separate transmission channel implemented by this script. CSV rows and progress are held in browser storage scoped to the LMS origin and course/assignment context. `localStorage` and `sessionStorage` on an LMS origin follow that origin's normal access rules.

The project makes no blanket claim of FERPA/GDPR compliance, 100% security, permanent saved state, perfect completion, or immunity from detection or account action. “No telemetry” means this source does not intentionally send analytics or third-party requests; it does not change Brightspace's own server behavior or institutional obligations.

## 8. Testing and acceptance

The local project includes 34 production-core DOM/lifecycle tests with controlled timers, plus a separate browser fixture that runs the unmodified userscript against synthetic server-stored drafts. Coverage includes identity conflicts, strict/staged CSV import, unique controls, reload/readback, dialogs, cancellation, and the live-page fast-skip/navigation regressions. See [validation results](LOCAL_VALIDATION.md) and [test commands](../CONTRIBUTING.md).

Automated tests provide local evidence only. The validation note separately records bounded live-page testing; real draft saving and post-save readback remain unverified. A live run should record the actual tenant controls, the exact course/assignment context, save acknowledgement, post-reload readback, and any remaining paused state.

For implementation details, inspect [`brightspace_auto_feedback_injector.user.js`](../brightspace_auto_feedback_injector.user.js), the local [`README.md`](../README.md), and the fictional [`sample_grades.csv`](../sample_grades.csv).
