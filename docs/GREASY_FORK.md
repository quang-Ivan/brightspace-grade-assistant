# 🎓 Brightspace (D2L) CSV Grade & Feedback Auto-Filler

**Stop copy-pasting grades and feedback into Brightspace.** Already reviewed a stack of assignments, lab reports, or autograder results? Let this helper enter your CSV scores and personalized comments into **D2L Brightspace Consistent Evaluation**.

Built for **Teaching Assistants (TAs)**; instructors are welcome too. Free and open-source, with no third-party uploads. Use **Violentmonkey** (recommended) or **Tampermonkey**. No programming, Node, or separate application is required.

## 🎬 See it in action

[![A reviewed CSV matched to the current fictional student in the native Brightspace layout](https://raw.githubusercontent.com/quang-Ivan/brightspace-grade-assistant/main/assets/demo/quick-demo.png)](https://quang-Ivan.github.io/brightspace-grade-assistant/#demo)

[Watch the 37-second silent demo](https://quang-Ivan.github.io/brightspace-grade-assistant/#demo): import one reviewed CSV, match each student, and fill their score and individual feedback together. The v1.0.5 helper runs on a source-anonymized copy of the actual Brightspace evaluation page. Numbered steps, a stable page view and visible input cues show the first three students and selected results from a 20-person fictional roster. English captions are burned in. No grades are saved or published in the demonstration.

## ⚡ Getting started

1. Install a userscript manager if you do not already have one.
2. Click **Install this script** above, then confirm **Install** in the manager.
3. Sign in to Brightspace and open one student's assignment evaluation.
4. Click **Load Scores & Feedback CSV** in the helper panel and select your reviewed CSV.
5. Check the student, points, and feedback preview. Try **Fill Current → Save Draft** on one unpublished submission before starting **Auto-Cruise**.

Keep only one copy of this helper enabled. For scripts installed from this page, use your userscript manager's update check to get new versions.

## 🌟 Features

- Drag the blue title bar to move the panel; use **– / +** or **Alt+M** to minimize or expand it. Its title stays on screen, contents scroll in short windows, and position and the minimized preference survive refreshes. Pages without an identified assignment start minimized.
- Enter Overall Grade and Overall Feedback together, including multiline written comments.
- Allow bonus scores above the nominal assignment maximum, such as 7 points on a 6-point assignment, without clamping them.
- Skip existing evaluations when the grade and supplied feedback already match.
- Rewind to the beginning of the current student list or continue from where you are.
- Track verified drafts, existing matches, explicitly unsubmitted rows, **Outside CSV** pages, and rows still remaining.
- Pause with **Emergency Stop** or **Alt+S**.
- Hear a completion chime when every intended CSV row is accounted for; **Outside CSV** pages are excluded from completion.

## 📋 Simple CSV format

```csv
student,score,reason
Alice Example,95,"Clear method and conclusion."
Bob Example,88.5,"Good work. Please label the axes."
Casey Example,,"No submission"
```

These fictional scores are out of 100. Use the actual points for your assignment.

- Keep the student's name or ID and leave their **score empty** to skip automatically, without filling or saving that evaluation. **0** is a real grade.
- Feedback is ordinary text, not HTML. Leave it empty to preserve existing feedback.
- Completely empty CSV lines are ignored. Auto-Cruise supports partial CSVs through longer rosters: a roster student with neither a matching ID nor name is skipped without filling or saving and tracked separately as **Outside CSV**. Outside CSV is not unsubmitted or graded and does not count toward CSV completion; name/ID conflicts and ambiguous identities still pause.
- You can also use an official Brightspace export with **OrgDefinedId**, names, one target grade column, and optional **Feedback**. Keep the exact exported grade heading.

Load this CSV in the helper, not Brightspace's Grades Import tool.

## 💾 Saving and publishing

Auto-Cruise uses **Save Draft**, waits for Brightspace's confirmation, refreshes, and checks the same student's values before continuing. Already-published evaluations are skipped only when the supplied values match; otherwise Auto-Cruise pauses. For a reviewed change, click **Overwrite Published (Current Student)** and confirm the student and score. This fills the CSV values, clicks **Update**, and verifies after refresh, without advancing or resuming Auto-Cruise. Blank CSV feedback is preserved. The helper never clicks **Publish** or automatically accepts native confirmation dialogs.

## 🔒 Privacy

**No tracking, direct network/API calls, or third-party uploads.** The script reads your CSV locally and operates Brightspace's existing fields and buttons. Brightspace itself handles sending and saving grades.

Imported rows, progress, and the current CSV revision's **Outside CSV** count stay in browser storage under your school's website. Reimporting starts a fresh Outside CSV count; **Reset Cache** removes the helper's current-assignment data, not Brightspace grades.

## 📖 Help and scope

- [Project homepage and video](https://quang-Ivan.github.io/brightspace-grade-assistant/)
- [Step-by-step installation and user guide](https://github.com/quang-Ivan/brightspace-grade-assistant/blob/main/docs/USER_GUIDE.md)
- [Source code and documentation](https://github.com/quang-Ivan/brightspace-grade-assistant)
- [Testing details](https://github.com/quang-Ivan/brightspace-grade-assistant/blob/main/docs/LOCAL_VALIDATION.md)

Designed for the English-language Consistent Evaluation interface. v1.0.10 fixes restarting Auto-Cruise after **Fill Current → native Update**. When this page still carries a local edit marker, the helper reloads and verifies the stored values before advancing, without sending another Update. A merely visible, unsaved fill cannot become a completed match. The confirmed **Overwrite Published (Current Student)** control also supports restarting Auto-Cruise after its verification. Keep **Skip matching existing evaluations** enabled; turn off **Cover entire class** if you want to continue from the current student instead of rewinding. Syntax and all **57** production-core tests pass. A Chrome simulation completed all six fictional rows after a native Update with zero additional save requests. Live Brightspace acceptance remains unverified. See [validation details](https://github.com/quang-Ivan/brightspace-grade-assistant/blob/main/docs/LOCAL_VALIDATION.md).

## ❓ Can I bulk enter assignment feedback as a TA?

Yes, with permission to evaluate the assignment and supported page controls. Import each student's written feedback from your CSV through the helper, not Brightspace's native Grades Import. Your grades and comments are already reviewed: this is a data-entry helper, not an AI grader.

MIT licensed. Not affiliated with or endorsed by D2L. Follow your institution's grading and privacy rules.
