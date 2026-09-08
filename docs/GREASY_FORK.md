# 🎓 Brightspace (D2L) CSV Grade & Feedback Auto-Filler

**Stop copy-pasting grades and feedback into Brightspace.** Already reviewed a stack of assignments, lab reports, or autograder results? Let this helper enter your CSV scores and personalized comments into **D2L Brightspace Consistent Evaluation**.

Built for **Teaching Assistants (TAs)**; instructors are welcome too. Free and open-source, with no third-party uploads. Use **Violentmonkey** (recommended) or **Tampermonkey**. No programming, Node, or separate application is required.

## 🎬 See it in action

[![The real helper filling fictional grades and feedback in an anonymized copy of Brightspace's evaluation page](https://raw.githubusercontent.com/quang-Ivan/brightspace-grade-assistant/main/assets/demo/quick-demo.png)](https://quang-Ivan.github.io/brightspace-grade-assistant/#demo)

[Watch the short captioned demo](https://quang-Ivan.github.io/brightspace-grade-assistant/#demo): load a CSV, fill a student's grade and feedback, then move to the next student. It uses the real script on an anonymized local copy of Brightspace's evaluation-page HTML with fictional grading data, not a live save or a speed benchmark. Install the script using Greasy Fork's button above.

## ⚡ Getting started

1. Install a userscript manager if you do not already have one.
2. Click **Install this script** above, then confirm **Install** in the manager.
3. Sign in to Brightspace and open one student's assignment evaluation.
4. Click **Load Gradebook CSV** in the helper panel and select your reviewed CSV.
5. Check the student, points, and feedback preview. Try **Fill Current → Save Draft** on one unpublished submission before starting **Auto-Cruise**.

Keep only one copy of this helper enabled.

## 🌟 Features

- Enter Overall Grade and Overall Feedback together, including multiline written comments.
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

The helper uses **Save Draft**, waits for Brightspace's confirmation, refreshes, and checks the same student's values before continuing. It does not click **Publish** or **Update**. Already-published evaluations are skipped only when the supplied values match; otherwise the helper pauses for review. Confirmation dialogs are left for you to read.

## 🔒 Privacy

**No tracking, direct network/API calls, or third-party uploads.** The script reads your CSV locally and operates Brightspace's existing fields and buttons. Brightspace itself handles sending and saving grades.

Imported rows, progress, and the current CSV revision's **Outside CSV** count stay in browser storage under your school's website. Reimporting starts a fresh Outside CSV count; **Reset Cache** removes the helper's current-assignment data, not Brightspace grades.

## 📖 Help and scope

- [Project homepage and video](https://quang-Ivan.github.io/brightspace-grade-assistant/)
- [Step-by-step installation and user guide](https://github.com/quang-Ivan/brightspace-grade-assistant/blob/main/docs/USER_GUIDE.md)
- [Source code and documentation](https://github.com/quang-Ivan/brightspace-grade-assistant)
- [Testing details](https://github.com/quang-Ivan/brightspace-grade-assistant/blob/main/docs/LOCAL_VALIDATION.md)

Designed for the English-language Consistent Evaluation interface. v1.0.4 has automated regression checks and simulated-browser coverage. Earlier v1.0.3 live checks covered filling, navigation, and fast skip; they are not live v1.0.4 validation. The complete Save Draft and refresh path still needs its real unpublished-evaluation check; that workflow has been exercised in simulation. See [the local validation notes](https://github.com/quang-Ivan/brightspace-grade-assistant/blob/main/docs/LOCAL_VALIDATION.md) for details.

## ❓ Can I bulk enter assignment feedback as a TA?

Yes, with permission to evaluate the assignment and supported page controls. Import each student's written feedback from your CSV through the helper, not Brightspace's native Grades Import. Your grades and comments are already reviewed: this is a data-entry helper, not an AI grader.

MIT licensed. Not affiliated with or endorsed by D2L. Follow your institution's grading and privacy rules.
