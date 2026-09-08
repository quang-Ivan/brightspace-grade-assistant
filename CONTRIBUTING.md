# 🤝 Contributing to Brightspace (D2L) CSV Grade & Feedback Auto-Filler

Contributions, bug reports, and ideas from TAs, instructors, and developers are welcome!

These instructions are for developers. If you only want to use the helper, follow the [quick start](README.md) or [step-by-step user guide](docs/USER_GUIDE.md); you do not need Node, npm, or the test files.

## 🔒 Keep student data private

- Use fictional names, IDs, scores, and feedback in samples, fixtures, tests, screenshots, and documentation.
- Never add real student names, emails, IDs, submissions, or grades to this directory or to an issue/patch.
- Preserve the UI-only design: no direct network/API calls, telemetry, or third-party uploads. Brightspace handles its own server communication in response to page interactions. Follow institutional privacy policy.

## 🛠️ Development setup

Install your edited [userscript](brightspace_auto_feedback_injector.user.js) in Violentmonkey or Tampermonkey using the [installation guide](docs/USER_GUIDE.md). Review the diff and run the relevant local checks before testing a change on a real Brightspace page. The fictional browser fixture below needs no LMS account and cannot affect real students.

## Implementation contract

Keep changes consistent with [`README.md`](README.md) and [`docs/IN_DEPTH_GUIDE.md`](docs/IN_DEPTH_GUIDE.md):

- For saving, only an exact, unique, enabled native **Save Draft** control may be clicked. Do not substitute `Update`, `Publish`, or generic `Save`. Fill Current means no explicit save click; Brightspace still controls its normal temporary-saving behavior.
- A fresh native save acknowledgement must be followed by a full reload and same student/course/assignment/CSV-revision score-and-feedback readback before Auto-Cruise resumes.
- Unrecognized acknowledgements, failed or mismatched readback, identity conflicts, unexpected dialogs, and navigation timeouts pause the run. Emergency Stop invalidates pending continuations but cannot recall autosave or save requests already sent.
- Mutations are limited to the unique overall grade and overall feedback controls. Rubric criteria and unrelated editors must remain untouched.
- CSV import has one unambiguous grade column. Duplicate IDs block the whole import; distinct IDs may disambiguate identical names; no-ID names must be unique after normalization. An explicit page-ID mismatch never falls back to a name. Only a genuinely absent page ID permits unique-name fallback.
- Blank scores mean explicitly unsubmitted. Invalid nonblank scores block import rather than being silently skipped. Reason/Feedback is plaintext with safe CSV quoting and escaped line breaks, not arbitrary HTML.
- Do not reintroduce a default sample database that can write grades. A real task CSV must be imported, and old cache/progress must not be treated as verified after schema or record-contract changes.

## ✅ Verification

Run from this directory:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
```

The 34 DOM/lifecycle tests execute the production core with jsdom and controlled timers, covering CSV staging, identity conflicts, unique overall-control selection, exact Save Draft selection, reload/readback, dialogs, cancellation, and the live-page navigation and fast-skip regressions. The separate browser fixture exercises the unmodified userscript, real Shadow DOM, native file input, full reloads, and local server-stored drafts:

```bash
node tests/fixture-server.cjs 0
```

Open the printed loopback URL in an isolated browser and import `tests/fixtures/roster.csv`. The fixture loads the userscript itself; no extension or LMS credentials are needed. Its `/__state` endpoint exposes synthetic save calls and drafts for readback. Stop the server with Ctrl+C. See [local validation results](docs/LOCAL_VALIDATION.md) for the exercised workload and failure cases. Do not turn fixture timing into a live Brightspace speed promise.

These checks are not live Brightspace acceptance. Do not claim permanent persistence, 100% security, complete roster coverage, FERPA compliance, or immunity from detection/account action based only on local tests. A live evaluation requires explicit authorization and separate verification of save, publish/release, Gradebook synchronization, and student visibility.

## CSV examples

Use the fictional [`sample_grades.csv`](sample_grades.csv) as parser documentation. It demonstrates a single `score` column, a blank score for an explicitly unsubmitted row, and quoted plaintext feedback with a line break. Keep export-derived examples tied to the exact official course export when documenting a real tenant; do not invent grade-item headers or add arbitrary native Gradebook columns.

## Review checklist

Before handing off a local change, check:

- the local source and relative documentation links still resolve;
- examples contain no real student data and no HTML feedback payloads;
- version numbers and feature descriptions match the userscript;
- installation links point to the actual project listing, and no unsupported fixed-speed claims were added;
- tests cover the changed behavior and no live browser/LMS mutation was performed unintentionally.

## 📦 Publishing the project

The three public surfaces have different jobs:

- **GitHub:** source code, examples, issues, and documentation. Upload this project directory, not its parent folder containing coursework or student records. Include dotfiles and the lockfile; exclude local dependencies and browser output as listed in `.gitignore`.
- **GitHub Pages:** the static `index.html` landing page. After uploading the repository, choose **Settings → Pages → Deploy from a branch → main → /(root)**. The page uses ordinary HTML/CSS and links to GitHub's rendered documentation; no website build dependencies are required.
- **Greasy Fork:** the primary userscript installation and update channel. Upload only `brightspace_auto_feedback_injector.user.js`. Use [GREASY_FORK.md](docs/GREASY_FORK.md) for the English listing description. Do not upload tests, a ZIP archive, or a real grading CSV.

Greasy Fork assigns the script's numeric ID when its listing is created; a GitHub repository name does not determine it. After the first upload, replace the three `GREASY_FORK_URL` markers in the README, user guide, and landing page with the actual listing URL. Check the live installation button, the Pages links, and the installed version after publication. Until then, the listing is labelled “coming soon,” not represented by a fabricated link.

The repository name used by existing links is `quang-Ivan/brightspace-grade-assistant`. If publishing under another owner or repository name, update those links together. Do not include private student data in release archives or Pages output.

Use the ready-to-copy repository description, Topics, Pages checks, and search-indexing steps in [PUBLISHING.md](docs/PUBLISHING.md). The README, landing page, and listing share the same product name and fictional-data demo. This setup document is not a claim that any public surface has already been published.

Brightspace is a trademark of D2L Corporation. This project is not affiliated with or endorsed by D2L.
