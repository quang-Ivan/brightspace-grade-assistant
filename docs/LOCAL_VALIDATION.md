# Testing & Current Scope

## v1.0.8 bonus points — 2026-10-05

The helper previously rejected scores above the nominal maximum in both the CSV importer and the Overall Grade fill preflight. v1.0.8 accepts those bonus scores without clamping them or changing the native control's maximum. Finite, nonnegative numeric scores remain required; identity, feedback, save acknowledgment and reload verification checks are unchanged.

Syntax and all **49** production-core regression tests passed. The tests cover a CSV score of 6.5 with `MaxPoints:6`, filling 7 with both the native host and inner input set to `max="6"`, exact feedback/readback, and rejecting invalid scores before either field changes. All 37 rows of the current local assignment CSV also filled their exact scores and feedback in the isolated DOM fixture at max 6, including 11 bonus scores above 6, with zero save clicks. Private CSV data is outside this repository.

Chrome's installed Tampermonkey script was updated to v1.0.8. A fresh, signed-in Brightspace homepage displayed **Grading Assistant v1.0.8**. No live grade fields were filled or saved during this repair; over-maximum live Save Draft acceptance remains unverified.

## v1.0.7 floating panel repair — 2026-10-05

The previous panel was fixed to the bottom-right corner without a height limit. When its content exceeded the viewport height, its title, drag handle and minimize button extended above the visible page. Dragging also had no viewport boundaries.

v1.0.7 keeps the title outside a scrolling content area, limits the panel to the viewport, and clamps its position after dragging, resizing or content changes. The compact minimized panel, drag position and minimized preference are retained across refreshes. Pages without an identified assignment initially minimize the panel.

Syntax and all **47** production-core regression tests passed. In Chrome's loopback fixture, an **800 × 420** viewport kept the panel within an 8-pixel margin: its height was 404 pixels, and the content scrolled independently. At **320 × 360**, the panel fit within 304 × 344 pixels and its title remained visible. Actual pointer drags to both viewport corners stayed in bounds. Minimizing reduced the fixture panel to 260 × 62 pixels; a refresh restored its minimized state and position. **Alt+M** also minimized the installed v1.0.7 panel.

After updating Tampermonkey, a real Brightspace homepage loaded **Grading Assistant v1.0.7** minimized by default. Expanding and minimizing both worked, and the expanded panel fit the live viewport. This repair performed no grade entry or LMS save; the local fixture recorded **zero saves**. These UI checks do not establish a new live Save Draft acceptance result. The existing demonstration still shows v1.0.5 field filling.

## v1.0.6 feedback notification repair — 2026-09-14

A live v1.0.5 Auto-Cruise run stopped at reload verification: the score was present but the expected nonempty feedback was absent. Inspection of the currently loaded native Brightspace component identified the cause. Its blur handler compares `editor.html` with the panel's `_feedbackText` (the last-notified value) and only emits `d2l-consistent-eval-feedback-edit` when those values differ. The helper's compatibility bridge assigned `_feedbackText` before emitting blur. When the HTML strings matched, it suppressed the native model update even though the editor displayed the text. Saving could therefore persist the score with empty feedback.

v1.0.6 removes that private-cache assignment from the shared feedback writer used by Fill Current, Fill & Save, and Auto-Cruise. The native panel owns its change tracking and emits the evaluation edit. Save acknowledgement, full reload, identity checks, and matching readback requirements are unchanged.

The old source failed both new regression tests: a plain feedback fill left the evaluation model empty, and Auto-Cruise saved empty model feedback. The fixed source passes all **47** production-core tests and the syntax check. The tests and browser fixture now distinguish editor HTML from the notified evaluation model; draft saving consumes that model. Single-paragraph and escaped multiline feedback, native duplicate-event suppression, zero grades, and unrelated rubric preservation are covered.

A second check used the actual loaded Brightspace component classes with fictional content in detached elements. The old cache assignment produced zero native feedback-edit events; leaving the cache to the native handler produced exactly one, including after a repeated blur. The elements were never connected to a real evaluation, and this check made no real grade or feedback save.

The complete v1.0.6 userscript then ran in Chrome on the loopback fixture with its six fictional CSV rows. Auto-Cruise completed **5 reload-verified drafts, 1 blank-score skip, and 0 rows remaining**. The server received exactly five saves; every saved score and feedback matched the corresponding CSV row, including zero, multiline text, and the two students sharing a name. The fixture used its root URL with assignment query parameters so the older installed userscript could not also inject through its `/d2l/` match.

This confirms the native notification defect and its repair, plus the complete local save/reload workflow. A real LMS Save Draft with v1.0.6 was not performed during this repair; permanent persistence and publication are not claimed. No private student data is included in the regression fixtures or public documentation. The existing demo remains an accurate recording of v1.0.5 field filling.

## Earlier checks

The initial v1.0.1 simulation and subsequent bounded live-page checks were performed on 2026-09-08. No grades were published. Those checks did not include a GitHub push or hosted deployment; the project's subsequent public launch is recorded separately in [Publication & Search Setup](PUBLISHING.md#launch-status--2026-09-09). Student identities and feedback are intentionally omitted here.

## Automated regression checks

`npm ci --ignore-scripts --no-audit --no-fund` passed for the initial environment; `npm run check` and all 34 tests passed for v1.0.3. Tests execute the production core in jsdom with controlled timers. Only panel mounting and the platform reload primitive are substituted; the separate browser exercise below uses the complete, unmodified userscript.

For v1.0.4, `npm run check` and all 40 regression tests passed. Added coverage verifies separate outside-CSV accounting, persistence across documents, revisit deduplication, reset on a new CSV or cache clear, Stop/restart cancellation during a skip, continued conflict rejection, and completion that cannot hide an imported student missing from the roster. A one-row CSV successfully rewinds and traverses a forty-student simulated roster without the old CSV-size-based early stop.

Coverage includes strict CSV parsing and whole-file validation, zero versus empty scores, duplicate IDs and normalized names, conflicting page identities, scoped controls, escaped multiline feedback, exact Save Draft selection, unsupported published controls, dialogs, stale acknowledgements, Stop/restart races, CSV/context changes, full-reload recovery, mismatched persisted values, storage failure, and canonical progress accounting.

## Real-browser local simulation

Started `node tests/fixture-server.cjs 0` on loopback and used an isolated Chromium browser session. The synthetic page supplies Shadow DOM controls, a normal file input, native-style save notices, iterator navigation, full-document reloads, and server-side in-memory draft state. It is a simulation, not a faithful copy or proof of support for every Brightspace tenant.

A manual Fill & Save smoke test passed, then Auto-Cruise completed the six-row fixture roster: five reload-verified drafts and one explicitly unsubmitted skip. The server observed exactly five save requests; the already-verified smoke-test row was not saved twice. Both students named Alex Smith were distinguished by OrgDefinedId, a score of zero persisted, special characters and multiline feedback remained plaintext, and the unrelated rubric note stayed unchanged.

Separate one-row contexts exercised failure handling:

| Scenario | Observed result |
| --- | --- |
| Save Draft absent | No field changes, no save request, no verified row. |
| Published page exposing Update | No field changes, no save request, no verified row. |
| Fresh acknowledgement without server persistence | One save request and full reload; old stored values did not match, so verification failed and no navigation followed. |
| Emergency Stop after sending a delayed save | The already-sent request completed, but the late acknowledgement caused no reload, navigation, or verified row. |
| Save request without a recognized fresh acknowledgement | Timed out with no reload, navigation, or verified row. |

All five cases cleared pending continuation state and preserved the unrelated rubric note. The browser fixture, its fictional roster, and automated tests are included so the checks can be repeated locally; browser-session output and dependencies are not part of the source package.

## Bounded live Brightspace checks

Chrome ran the user-installed v1.0.2 script against an actual 39-row assignment CSV (36 submitted, three unsubmitted). The v1.0.1 navigation failure was reproduced, then the v1.0.2 script successfully navigated using the footer student button despite a second header arrow.

With auto-rewind temporarily disabled, fast cruise matched 16 existing published evaluations and skipped two explicitly unsubmitted rows, then paused on an existing evaluation whose score matched but feedback differed. The complete network observation for that cruise contained only read requests and platform telemetry POSTs, not grade-save requests. Existing matches are counted separately from newly saved, reload-verified drafts.

Fill Current populated the real Overall Feedback editor with the imported text. Refreshing discarded the unsaved test content, and the original grade and feedback were read back unchanged. This exposed a native editor behavior: `isDirty` can become false immediately after a scripted fill. v1.0.3 therefore remembers its own page edits so they cannot be fast-skipped as saved; the corresponding production-core regression test passes.

### v1.0.3 live retest

The installed version was confirmed from the helper panel. After Fill Current on a published evaluation, the native editor again reported `isDirty === false`. Starting Auto-Cruise did not advance or increase the existing-match count; it paused at the published Update control. This verifies the added protection against treating the helper's own unsaved fill as an existing saved match.

The complete network observation for that fill-and-start check contained two grade PATCH requests made by Brightspace in response to field interactions. Both carried the score already present on the record; neither was a direct API call or an explicit Save Draft or Update click by the helper. After refreshing, the original score and feedback were read back unchanged. The script itself has no networking or third-party upload code; these were Brightspace's own requests, consistent with the temporary-saving behavior described in its [evaluation guide](https://community.d2l.com/brightspace/kb/articles/34714-evaluate-assignment-activities). This observation does not verify the separate Save Draft workflow.

A separate navigation-and-fast-skip check moved to an existing matching published evaluation, skipped it, and paused on the next evaluation's feedback mismatch. The complete network observation for this separate check contained no non-read requests. No new grade or feedback values were entered during that check.

The assignment roster was then rechecked: 39 students, 36 evaluations marked Published. An opened published evaluation had one Update button and no Save Draft button. The browser session and real student records were available; the missing first-save test case was an appropriate unpublished submission. No grades were entered or saved during this roster recheck.

## v1.0.4 partial-CSV browser workload

The complete v1.0.4 userscript ran in an isolated Chromium session against the same six-student local fixture, with a four-row CSV. Two roster students were deliberately omitted from the CSV, one included student had an empty score, and three included students had grades of 0, 88, and 100.

Auto-Cruise completed with **3 reload-verified drafts, 1 explicitly unsubmitted skip, 2 outside-CSV skips, and 0 CSV rows remaining**. The local server received exactly three save requests, all for the intended graded students; neither omitted student nor the empty-score student received a save request. The zero score and escaped feedback persisted correctly, the unrelated rubric feedback stayed unchanged, and outside-CSV counts survived the draft-save page reloads without entering the CSV completion numerator or denominator.

This is local browser evidence, not an additional live Brightspace save test. The earlier live-page findings above remain scoped to their stated versions.

## Remaining acceptance boundary

Real draft saving and post-save reload verification remain unperformed: submitted evaluations in this assignment were already published, and the remaining rows were unsubmitted. Neither published records nor unsubmitted grades were changed to manufacture a test case. The script depends on recognizable English evaluation identity, unique overall controls, an exact enabled Save Draft button, and a fresh supported native acknowledgement. A tenant with another layout or wording may pause and require adaptation. These checks do not prove a live save, publication/release, Gradebook synchronization, student visibility, institutional compliance, or permanent persistence.


## v1.0.5 local repair and demo — 2026-09-12

A focused reproduction showed that the documented name-only CSV was rejected whenever the evaluation page exposed an OrgDefinedId, even though no conflicting ID had been supplied. The new regression tests first failed on the unchanged source. The repair permits a unique normalized-name match only for a wholly name-only CSV; ID-bearing/mixed databases still pause on actual ID conflicts, and ambiguous names remain blocked.

All **45** production-core tests and the syntax check pass. New import-summary tests also cover filename replacement, actual zero grades, blank-score skips, missing feedback, and absence of field writes during import.

A new isolated headless Chrome recording exercises the complete unmodified v1.0.5 userscript on the local fixture. Its separately opened name-only browser smoke test matched and filled the correct student without saving. The main recording imported six fictional rows, manually filled/saved/reloaded the first draft, selected the next student's separate row, and completed Auto-Cruise with **5 saved, reload-verified drafts and 1 blank-score skip**. The local server observed exactly five save requests. The zero grade persisted, both identically named students retained their own IDs and feedback, all saved values matched the CSV, and the unrelated rubric note stayed unchanged.

The recording adds only presentation CSS, a fictional CSV preview, pointer highlights, and explanatory titles. It does not fake save acknowledgements or replace the userscript's grading/identity logic. The loopback fixture—not Brightspace—provides the draft server. No authenticated browser profile, real student records, or real LMS save was used. The separate live draft-save acceptance boundary above remains open.


## Native HTML demo revision — 2026-09-14

The 37.20-second demo uses source-anonymized native Brightspace HTML and the unchanged v1.0.5 userscript. Its 20 fictional score/feedback readbacks passed; selected students are explicitly disclosed in the edit. The camera retains the full page for 91.9% of the movie, with one three-second detail. Full decode, burned-caption and actual-input checks, source privacy checks, and the actual 960×540 player with optional CC off passed. The final MP4 was reviewed again after the clip and subtitle corrections; that review checked the exact file hash, decoded all 1,116 frames and inspected adjacent frames at the corrected transitions. No further media changes followed that review.

The review used decoding and frame inspection, not a continuous first-time human viewing test. An independent new-viewer comprehension test remains unperformed. There is no audio stream and no live LMS access, save or publication in this offline recording. The separate real draft-save acceptance boundary above remains open. See [the demo notes and transcript](DEMO.md).
