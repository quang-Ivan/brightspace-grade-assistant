# 📖 Installation & User Guide

**Brightspace (D2L) CSV Grade & Feedback Auto-Filler** is built for TAs with reviewed grades and written feedback in a spreadsheet; instructors can use it too. It puts each entry into the matching student's assignment page, so you do not have to copy it by hand. It does not decide grades for you, grade rubric items, or publish results to students.

You install **one small file**, [`brightspace_auto_feedback_injector.user.js`](../brightspace_auto_feedback_injector.user.js), using Violentmonkey or Tampermonkey. You do not need to learn programming, download the whole project, or install Node, npm, or Git.

For a quick overview, see the [project README](../README.md) or [watch the fictional-data demo](https://quang-Ivan.github.io/brightspace-grade-assistant/#demo). This guide walks through installing v1.0.3, preparing a CSV, and using the helper one student at a time.

## Before you start: is this the right tool for your task?

Use a teaching-assistant or instructor account that is allowed to grade the assignment. Check your institution's rules about browser extensions and student data.

Look at the buttons on Brightspace's own evaluation page, outside the helper panel:

| What you see | What it means for this version |
| --- | --- |
| **Save Draft** | The helper can attempt to enter and save an evaluation for later review. Verify one genuine, unpublished submission before starting a batch. |
| **Update** | This evaluation is already published. The helper does **not** click Update. It can skip the entry if its grade and the feedback supplied in your file already match; otherwise it pauses. |
| Neither button, or a different page layout | Do not start a batch. First make sure you opened an individual student's assignment evaluation. |

Do not retract a published evaluation or put an invented grade on an unsubmitted student's record just to try the script. A real unpublished submission that you are ready to grade, or an approved test assignment, is the appropriate first-save example.

**How it works:** the script fills fields and clicks controls in the Brightspace page you already use. It does not make its own network requests, call a grading API directly, or upload data to a third-party service. Brightspace handles communication with its own servers, as it does when you enter grades manually.

## 1. Install a userscript manager

A userscript manager is a browser extension that runs this helper on a website. Install **[Violentmonkey](https://violentmonkey.github.io/)** (recommended) or **[Tampermonkey](https://www.tampermonkey.net/)** (alternative). You only need one.

Follow the extension's installation prompts for your browser. For Chrome:

1. Open the official website of your chosen extension, choose its Chrome download, and follow the Chrome Web Store installation prompts.
2. In Chrome's address bar, enter `chrome://extensions` and press Enter.
3. Find your chosen extension, open **Details**, and turn on **Allow User Scripts** if that switch is available.
4. If your browser does not offer that switch, Tampermonkey documents **Developer mode** on the extensions page as an alternative. You do not need to enable both. This setting permits the extension to run your scripts; it does not require you to write code. See the [official permission instructions](https://www.tampermonkey.net/faq.php?locale=en&q=Q209).
5. If Chrome says the setting is controlled by your organization, ask your institution's IT team about an approved setup.

You should now see your chosen extension in Chrome's extensions list. You can use Chrome's puzzle-piece menu to pin its icon next to the address bar.

## 2. Install this script

### Recommended: Greasy Fork

<!-- GREASY_FORK_URL: Add the actual script listing here after publication. -->
**The listing link will be added after the first upload.**

Once it is available:

1. Open this project's Greasy Fork listing.
2. Click the green **Install this script** button.
3. Your userscript manager opens a confirmation page. Check the script name and version, then click **Install**.
4. Keep only one copy of this helper enabled. If you previously copied the source into the manager manually, disable the old copy.

### Alternative: install from the source file

1. Open [`brightspace_auto_feedback_injector.user.js`](../brightspace_auto_feedback_injector.user.js). On a GitHub file page, click **Raw** to show just the code. If it downloads, open it in a plain-text editor.
2. Copy the entire file, from `// ==UserScript==` through the last line.
3. Open your userscript manager's dashboard. In Violentmonkey, use **+ → Create a new script**; in Tampermonkey, choose **Create a new script**.
4. Replace the editor's example text with the code you copied. Use Ctrl+A / Ctrl+V on Windows, or Command+A / Command+V on a Mac.
5. Save in the editor. Confirm **Brightspace (D2L) CSV Grade & Feedback Auto-Filler**, version **1.0.3**, is enabled.
6. Disable older copies, then refresh Brightspace.

Neither method requires downloading the whole repository or installing developer tools.

## 3. Open the right Brightspace page

1. Sign in to your school's Brightspace site as usual.
2. Open the course, then **Assignments**, then the assignment you intend to grade.
3. Click one student's name or **Go to Evaluation**.
4. Check that you can see that student's name, **Overall Grade**, and **Overall Feedback**.
5. Refresh the page. The helper panel should show **Brightspace CSV Grade & Feedback Auto-Filler v1.0.3** and the same student's name.

The class submission list is not the individual evaluation page. If the panel says **No student identified**, do not import a file or start filling there; open a student's evaluation first. Likewise, import on the evaluation page where you will work, not on the course home or Grades page.

If the panel is missing, follow the troubleshooting table below before trying a different installation.

## 4. Prepare your spreadsheet

CSV is a simple spreadsheet file type. Keep your original workbook, then save a separate **CSV UTF-8 (Comma delimited)** copy for the helper. A normal `.xlsx` workbook is not the file to select here.

For the simplest format, use these exact headings in the first row:

| student | score | reason |
| --- | --- | --- |
| Alice Example | 7.5 | Clear explanation. Please label both axes next time. |
| Bob Example | 8 | Complete and correct. |
| Casey Example | *(leave this cell empty)* | No submission |

These are fictional examples for an assignment marked out of 8. Replace the example students and feedback with your own reviewed entries before using the file on a real class.

- **student:** use the name displayed on the student's Brightspace evaluation page. Keep one row per student. If two students share a name, do not guess which row will match; see the [student-ID instructions](IN_DEPTH_GUIDE.md#using-student-ids).
- **score:** enter points, not a percentage. For 7 points out of 8, enter `7`, not `87.5` or `7/8`. Use a decimal point, such as `7.5`.
- **An empty score means skip this student as unsubmitted.** It is not the same as `0`: zero is a real grade and will be entered. Do not use an empty cell for a submitted student whose grade you simply have not decided yet; leave that row out and use manual controls for the rows you are ready to process.
- **reason:** the written feedback you want the student to receive. An empty feedback cell leaves existing feedback unchanged; it does not erase it. Use the feedback language required by your course; the helper copies your text rather than translating it.
- When using a spreadsheet app, keep the feedback in one cell even if it contains commas or line breaks; CSV export handles those characters. If you edit CSV by hand, put such feedback in double quotes and double any quotation marks inside it.

For a ready-made file layout, see [sample_grades.csv](../sample_grades.csv). Its scores illustrate a different, out-of-100 assignment; replace them with points appropriate for your assignment. Do not upload any of the sample students to a real class.

This file is for the helper. Do **not** upload it through Brightspace's Grades Import or assignment File Upload buttons. If you already have an official Brightspace export with IDs and several grade columns, use the [export-derived format instructions](IN_DEPTH_GUIDE.md) instead of guessing which grade column the helper will use.

## 5. Load the file and check the preview

1. On the individual evaluation page, find **Load Gradebook CSV** in the helper panel.
2. Click its **Choose File** button and select your CSV copy.
3. Wait for **Loaded … CSV rows. No grades were written.** Check that the row count is what you expect.
4. Compare the helper's student name, score, and feedback preview with your spreadsheet and the student named by Brightspace.

Loading the file by itself does not fill grade fields. If the name or preview is wrong, stop here. Correct the spreadsheet and load it again. Reimporting starts a new set of progress records for that file, so previous verified counts may reset.

## 6. Check one student before starting a batch

Choose a genuine submission that you are ready to grade and whose Brightspace page has **Save Draft**. Keep the normal page and the helper panel visible so you can compare them.

1. Review the preview again, including the assignment's maximum points.
2. Click the helper's **Fill Current**. Confirm that Overall Grade and Overall Feedback now contain the intended values. This does not click Save Draft. Brightspace may temporarily save edits, just as it can while you type; see its [evaluation guide](https://community.d2l.com/brightspace/kb/articles/34714-evaluate-assignment-activities).
3. If the values are right, click the helper's **Save Draft** once. Do not click Brightspace's Publish button as a substitute.
4. Leave the tab alone while the helper waits for Brightspace's confirmation and refreshes the page. It then reads the grade and feedback again rather than assuming the click worked.
5. A successful check reports **Draft save verified by reloading and reading the same student.** The **Drafts verified** count increases. Also check the visible name, grade, and feedback yourself.

If there is no confirmation, an error, or a mismatch after refreshing, do not keep clicking Save. The request may already have reached Brightspace. Stop the helper, inspect the student's actual record, and determine what was saved before retrying.

If you filled incorrect values and want to discard them, stop the helper and use Brightspace's own cancel/back workflow, reading any confirmation carefully. Do not click Update or Publish. Check the student's saved record afterward; the helper has no undo button for server-side changes.

## 7. Process the remaining students

Once the one-student save works on your assignment:

1. Make sure your file covers the students you intend to process. For a partial set of students, use manual controls; an automatic run stops when it reaches a student absent from the file.
2. **Cover entire class (Auto-rewind to start)** moves to the beginning of Brightspace's current student list before starting. Leave it on for a full-list run; turn it off to begin at the current student. It does not change Brightspace's filters or add missing rows to your CSV.
3. **Skip matching existing evaluations** skips a published evaluation, or a draft this helper previously saved and checked, only when its current grade and any feedback supplied in your file match. A matching score alone is not enough when your file also contains feedback. A just-filled, unsaved entry is not treated as an existing match.
4. Click **Start Full Class Auto-Cruise**. This means the helper works through students one at a time. Keep the tab open and avoid navigating, editing fields, or switching assignments during the run.
5. Use **Emergency Stop** if you need to interrupt it. No further automated actions should follow, but it cannot recall a request already sent to Brightspace.

The progress labels have different meanings:

| Label | Meaning |
| --- | --- |
| Drafts verified | The helper saved a draft, refreshed, and found the expected values again. |
| Existing matched | The existing values matched your file, so the helper skipped them without a new save. |
| Unsubmitted | The CSV score was empty; the helper did not enter a grade. |

Completion refers to the imported rows, not proof that every student in the course was graded. Review any remaining rows. Publish results separately using Brightspace only after you are satisfied with the evaluations.

## Troubleshooting: what to check next

| What you see | What to do |
| --- | --- |
| No helper panel | Check that Tampermonkey and this script are enabled, Chrome permits user scripts, and Tampermonkey has access to your Brightspace site. Refresh an individual assignment evaluation page. |
| No student identified | Open one student's evaluation, not the class list, course home, or Grades page. |
| No matching CSV row | Compare the displayed student name with your file. Check that you imported the file for this assignment on the evaluation page. Do not rename a different student's row to force a match. |
| Duplicate identity or name is not unique | Check for repeated rows or two students with the same name. Resolve the identity issue using the official roster; do not let the helper guess. |
| Invalid score or column error | Keep one grade column. Use a number such as `7.5`, not `7/8`, `90%`, `N/A`, or a formula error. Save as comma-delimited CSV and import again. |
| An Update action is present | The evaluation is already published and cannot be saved as a draft by this version. A difference from your file needs separate review, not another press of Start. |
| No fresh native save acknowledgment | Brightspace did not give a confirmation this script recognizes. A save may still have happened; inspect the record before retrying. |
| A dialog requires your review | Read Brightspace's dialog yourself. The helper does not click through discard, publish, or other confirmation dialogs. |
| More than one grade/feedback control, or navigation failed | Stop. This page layout may not be supported. Report the error and browser/script versions without including student data. |

Other browsers, translated Brightspace interfaces, and different evaluation layouts have not all been tested. Do not assume a pause means you need to weaken a check or click Publish.

## Updating, privacy, and further help

If installed from Greasy Fork, use your manager's normal update check. If installed by copying the source, open the existing script in the manager, replace its entire code, save, and refresh Brightspace. Confirm the version in the helper panel and keep only one copy enabled.

**Reset Cache** clears the helper's imported file and local progress for the current assignment; it does not remove or undo Brightspace grades. Stop any run before using it, then import the correct file again.

**No tracking or third-party uploads.** The script has no separate account, server, analytics service, or direct data-sending code. It reads your CSV locally and operates Brightspace's existing fields and buttons; Brightspace itself handles sending and saving grades.

The imported CSV and progress stay in browser storage under your school's Brightspace website. That storage follows the website's normal access rules rather than being a separate private vault. Use **Reset Cache** when you want to remove the helper's local data for the assignment. Do not put real student data in public bug reports, screenshots, or this repository.

- [Technical details and advanced CSV formats](IN_DEPTH_GUIDE.md)
- [Actual testing and remaining limitations](LOCAL_VALIDATION.md)
- [For developers: contribution and test instructions](../CONTRIBUTING.md)
- [MIT license](../LICENSE)

This project is not affiliated with or endorsed by D2L. Follow your institution's grading and privacy requirements; it does not make a blanket compliance or student-visibility guarantee.
