# Testing & Current Scope

The initial v1.0.1 simulation and subsequent bounded live-page checks were performed on 2026-09-08. No grades were published. Those checks did not include a GitHub push or hosted deployment; the project's subsequent public launch is recorded separately in [Publication & Search Setup](PUBLISHING.md#launch-status--2026-09-08). Student identities and feedback are intentionally omitted here.

## Automated regression checks

`npm ci --ignore-scripts --no-audit --no-fund` passed for the initial environment; `npm run check` and all 34 tests passed for v1.0.3. Tests execute the production core in jsdom with controlled timers. Only panel mounting and the platform reload primitive are substituted; the separate browser exercise below uses the complete, unmodified userscript.

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

## Remaining acceptance boundary

Real draft saving and post-save reload verification remain unperformed: submitted evaluations in this assignment were already published, and the remaining rows were unsubmitted. Neither published records nor unsubmitted grades were changed to manufacture a test case. The script depends on recognizable English evaluation identity, unique overall controls, an exact enabled Save Draft button, and a fresh supported native acknowledgement. A tenant with another layout or wording may pause and require adaptation. These checks do not prove a live save, publication/release, Gradebook synchronization, student visibility, institutional compliance, or permanent persistence.
