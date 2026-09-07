# 🎓 Brightspace (D2L) Feedback & Grade Auto-Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen.svg)](brightspace_auto_feedback_injector.user.js)
[![Userscript](https://img.shields.io/badge/Userscript-Tampermonkey%20%7C%20Violentmonkey-green.svg)](brightspace_auto_feedback_injector.user.js)
[![FERPA Compliant](https://img.shields.io/badge/FERPA-100%25%20Compliant-brightgreen.svg)](#-privacy--ferpa-compliance)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

> A blazing-fast, lightweight client-side userscript for instructors, professors, and Teaching Assistants (TAs). Automatically injects grades and rich rubric feedback into **D2L Brightspace Consistent Evaluation**, auto-confirms dialogs, fast-skips already evaluated students, and cruises through the entire class roster with **100% class coverage**.

---

## ⚡ 60-Second Quick Start

```
+---------------------------+       +-------------------------------+       +------------------------------------+
| 1. Install Extension      | ----> | 2. Install Script (1 Click)   | ----> | 3. Grade in Brightspace            |
| Violentmonkey/Tampermonkey|       | Open raw .user.js in browser  |       | Load CSV & Press Alt+A (Auto-Cruise|
+---------------------------+       +-------------------------------+       +------------------------------------+
```

### Step 1: Install a Userscript Manager (One-Time Setup)
Install one of the recommended open-source browser extensions:
- [**Violentmonkey**](https://violentmonkey.github.io/) (Recommended — fast, lightweight, and open source)
- [**Tampermonkey**](https://www.tampermonkey.net/) (Popular alternative)

### Step 2: Install This Userscript
Click the 1-click install link below:

👉 [**⚡ Click Here to Install Userscript (v1.0.0)**](https://raw.githubusercontent.com/quang-Ivan/brightspace-grade-assistant/main/brightspace_auto_feedback_injector.user.js)

*(Your extension manager will automatically open a tab asking you to confirm. Click **Install** or **Confirm**).*

### Step 3: Grade in Brightspace!
1. Log into your university's Brightspace (e.g. Stony Brook, Purdue, Waterloo, or `*.brightspace.com`).
2. Go to your course ➔ **Assignments** ➔ Click on any student submission to enter **Consistent Evaluation**.
3. Look at the bottom-right corner: the blue **🎓 Brightspace Feedback & Grade Assistant** panel will appear automatically!
4. Click **📁 Load Gradebook CSV** and select your CSV file (see [CSV format](#-csv-format-specification)).
5. Click **🚀 Start Auto-Cruise** (or press <kbd>Alt</kbd> + <kbd>A</kbd>).
6. Sit back and watch it work! When all students are graded, you will hear a cheerful 4-note completion chime 🎵.

---

## 🌟 Key Features

- 🔄 **Zero-Miss Full Roster Traversal**:
  - **Auto-Rewind**: If you open an evaluation in the middle of your class, the script automatically steps backward to Student #1 before starting forward cruising.
  - **Wrap-Around**: If it reaches the end of the roster while some students remain ungraded, it wraps back to finish them automatically.
  - **Manual Rewind (<kbd>Alt</kbd> + <kbd>H</kbd>)**: Jump back to Student #1 at any time.
- 🎯 **Deep Web Component Piercing**: Penetrates `d2l-input-number` and TinyMCE iframe editors inside Brightspace Web Components.
- 📝 **True Event Synchronization**: Dispatches proper `@d2l-htmleditor-blur` events and triggers `_saveFeedback()` to guarantee rich HTML overall feedback is permanently persisted to the Brightspace server.
- ⚡ **0.4s Fast Skip & Dialog Dismissal**:
  - Already-graded students are skipped in 400ms (while actively verifying that overall feedback is not blank).
  - Unsaved changes dialogs are dynamically intercepted and dismissed in 100ms.
- ⚠️ **Smart Skip for Unsubmitted Students**: Detects students who did not submit homework or have blank scores, displays an alert in the UI, and smoothly proceeds to the next student without stalling.
- 🛑 **Emergency Stop (<kbd>Alt</kbd> + <kbd>S</kbd>)**: Instantly halts all automation in real time.
- 🎵 **Web Audio Completion Chime**: Synthesizes a pleasant 4-note chime (C5-E5-G5-C6) when all grading is finished.
- 📁 **Universal CSV Importer**: Supports standard 3-column spreadsheets or Brightspace official gradebook exports.
- 🔒 **100% FERPA & Privacy Compliant**: Zero student data or grades are hosted or transmitted. Everything runs locally in your browser.

---

## 📁 Why Start with a CSV File?

### 💡 The Modern Grading Workflow
Grading software generally forces you to do two things at once:
1. **Evaluate work** (reading code/reports, calculating rubrics, writing constructive feedback).
2. **Data entry into the LMS** (clicking through menus, waiting for page reloads, pasting into web forms).

Doing both simultaneously inside Brightspace is agonizingly slow. **Brightspace Feedback & Grade Assistant** decouples these two tasks:
- You calculate grades and write feedback in your favorite offline environment (Excel, Google Sheets, Jupyter Notebooks, Autograding scripts, or LLM-assisted rubrics).
- You export your results to a **CSV file** (your local Master Record).
- The userscript reads this CSV and handles **100% of the repetitive Brightspace data entry, saving, and navigation in seconds**.

#### Key Benefits:
- 🔒 **100% FERPA Compliant**: Your student data never leaves your computer or touches an external server.
- 🗂️ **Auditable Master Record**: You retain a clean, permanent CSV record of every grade and rubric deduction offline.
- ⚡ **Lightning Fast**: Batch-inject 50–500 students in 2 minutes instead of 2 hours.

---

## 📋 CSV Format Specification

### 🎯 Which Format Should You Choose?

| Goal | Recommended Format | Score Filled? | Feedback Injected? |
| :--- | :---: | :---: | :---: |
| **Inject Both Scores & Detailed Feedback** (Simplest) | **Format A** (`student,score,reason`) | ✅ Yes | ✅ Yes (Built-in `reason` column) |
| **Export Roster from Brightspace, then add Feedback** | **Format B with `Feedback` column** | ✅ Yes | ✅ Yes (Add a `Feedback` column) |
| **Only Fill Numeric Scores** (No feedback needed) | **Format B Native** (Standard Brightspace export) | ✅ Yes | ⏹️ No (Score only) |

---

### Format A: Simple 3-Column CSV (Recommended for Scores + Feedback)
The simplest, most popular format for instructors and TAs:
```csv
student,score,reason
"Alice Smith",95.0,"Excellent work! Problem 1 and Problem 2 are completely correct."
"Bob Jones",88.5,"Good submission. Note: check units and label all axes on problem 2."
"Charlie Brown",,"No submission"
"Diana Prince",92.0,"<p><b>Part A:</b> 50/50</p><p><b>Part B:</b> 42/50 (-8: calculation error)</p>"
```

#### Column Rules:
| Column | Required | Description | Examples |
| :--- | :---: | :--- | :--- |
| **`student`** | **Yes** | Full student name matching Brightspace. Supports `First Last` or `Last, First`. | `"Alice Smith"`, `"Smith, Alice"` |
| **`score`** | **Yes** | Numeric grade points. **For unsubmitted students, leave this completely blank!** | `95`, `95.0`, `8.0`, `""` *(blank)* |
| **`reason`** | Optional | Overall feedback comments. Supports plain text, multiple lines (wrapped in quotes), or HTML tags. | `"Great work!"`, `"<p>Good job</p>"` |

> [!TIP]
> **Handling Unsubmitted Students**: Simply leave the `score` column blank (e.g. `"Charlie Brown",,"No submission"`). The script will automatically detect the absence of a grade, mark the student as `⚠️ [Unsubmitted]`, and smoothly advance to the next student without stalling!

---

### Format B: Brightspace Export Format (Supports Both Score & Feedback!)

Brightspace's official Gradebook Export by default only contains numeric points columns. **However, both scores and feedback CAN be provided in Format B!**

#### Option B1: With Feedback (Add a `Feedback` Column)
Simply insert a column titled `Feedback` (or `Comments` / `Reason`) into your exported spreadsheet:
```csv
OrgDefinedId,Last Name,First Name,Homework 1 Points Grade <Numeric MaxPoints:100>,Feedback,End-of-Line Indicator
#112233445,Smith,Alice,95.0,"Excellent work! All answers completely correct.",#
#112233446,Jones,Bob,88.5,"Good job. Note: check units on problem 2.",#
#112233447,Brown,Charlie,,No submission,#
```
> The script automatically detects the `Feedback` / `Comments` / `Reason` column and injects it into Brightspace's rich-text feedback editor!

#### Option B2: Score Only (Native Brightspace Export as-is)
If you only want to auto-fill numeric grades and don't need overall feedback:
```csv
OrgDefinedId,Last Name,First Name,Homework 1 Points Grade <Numeric MaxPoints:100>,End-of-Line Indicator
#112233445,Smith,Alice,95.0,#
#112233446,Jones,Bob,88.5,#
#112233447,Brown,Charlie,,#
```
The script will automatically detect `First Name` + `Last Name`, fill the score, and leave the feedback field untouched.

---

## 🛠️ How to Create Your CSV File (3 Simple Workflows)

Here are the three easiest ways to prepare your grade CSV:

### Workflow 1: From Brightspace Export (Zero Manual Typing of Names)
If you want an exact list of all student names in your course without typing them:
1. In Brightspace, navigate to **Grades** ➔ **Enter Grades** ➔ **Export**.
2. Under **Key Field**, **ensure you select `OrgDefinedId`** (or `Both`).
3. Under **User Details**, check `Last Name` and `First Name`.
4. Under **Choose Grades to Export**, check your target Assignment (e.g. `Homework 1`).
5. Click **Export to CSV**.
6. Open the downloaded file in Microsoft Excel or Google Sheets, fill in the scores and comments, and click **Save as CSV**.

> [!IMPORTANT]
> **Why `OrgDefinedId` is strongly recommended**:
> - **Unique Student Identification**: Prevents ambiguity if two students share similar or identical names.
> - **Gradebook Re-Import Compatibility**: Brightspace's native Gradebook Import feature (`Grades ➔ Import`) **strictly requires** the `OrgDefinedId` column (with `#` prefix). Keeping this column allows you to reuse this same CSV file for Brightspace's official gradebook import whenever needed!

---

### Workflow 2: From Excel or Google Sheets (Quick 3-Column Spreadsheet)
1. Open Excel or Google Sheets and create a blank sheet.
2. In the first row, create three headers:
   - Cell `A1`: `student`
   - Cell `B1`: `score`
   - Cell `C1`: `reason`
3. Enter your students:
   - Type or paste student names in Column A.
   - Enter numeric scores in Column B (leave blank for unsubmitted students).
   - Enter feedback or rubric notes in Column C.
4. Export the file:
   - **In Excel**: Click **File** ➔ **Save As** ➔ Select file type **CSV (Comma delimited) (*.csv)**.
   - **In Google Sheets**: Click **File** ➔ **Download** ➔ **Comma-separated values (.csv)**.

---

### Workflow 3: Automated Python / Jupyter / Autograder Workflow
If you are a TA in Computer Science, Data Science, or Engineering running autograders or Python grading scripts, you can export directly from your grading script:

```python
import csv

# Example grading output dictionary
graded_students = [
    {
        "name": "Alice Smith",
        "score": 100.0,
        "feedback": "All unit tests passed. Code style is clean and well-documented."
    },
    {
        "name": "Bob Jones",
        "score": 85.0,
        "feedback": "Problem 3 failed test case 2 (IndexError). All other tests passed."
    },
    {
        "name": "Charlie Brown",
        "score": None,  # No submission
        "feedback": "No submission"
    }
]

# Write to CSV ready for the userscript
with open("homework1_grades.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["student", "score", "reason"])
    for s in graded_students:
        score_val = s["score"] if s["score"] is not None else ""
        writer.writerow([s["name"], score_val, s["feedback"]])

print("Done! Upload homework1_grades.csv to the userscript in Brightspace.")
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
| :---: | :--- | :--- |
| <kbd>Alt</kbd> + <kbd>A</kbd> | **Toggle Auto-Cruise** | Starts continuous automated grading or pauses execution |
| <kbd>Alt</kbd> + <kbd>S</kbd> | **Emergency Stop** | Instantly halts all cruise timers, DOM clicks, and navigation |
| <kbd>Alt</kbd> + <kbd>H</kbd> | **Rewind to First** | Rapidly navigates backwards to Student #1 |
| <kbd>Alt</kbd> + <kbd>F</kbd> | **Fill Current Student** | Fills current score & feedback without saving or advancing |
| <kbd>Alt</kbd> + <kbd>→</kbd> | **Next Student** | Deep-clicks the Brightspace Next Student button |
| <kbd>Alt</kbd> + <kbd>←</kbd> | **Previous Student** | Deep-clicks the Brightspace Previous Student button |

---

## ❓ Frequently Asked Questions (FAQ)

#### Q: Does this work on my university's Brightspace website?
**A:** Yes! The script matches all standard Brightspace domains including `*.brightspace.com`, `*.desire2learn.com`, Stony Brook University (`mycourses.stonybrook.edu`), Purdue, Waterloo, Arizona, and others.

#### Q: Will Brightspace detect or ban this?
**A:** No. This script is a client-side assistive userscript running inside your own browser session. It interacts with the DOM exactly as a human instructor would (triggering standard click and input events). It does not perform illegal API calls or scrape prohibited data.

#### Q: Will students see grades immediately while I am grading?
**A:** No. The script clicks **"Save Draft"** or **"Update"**, saving your feedback and grades in draft status. Students cannot see them until you choose to release grades by clicking Brightspace's official "Publish All" button.

#### Q: What happens if a student did not submit their assignment?
**A:** The script automatically detects unsubmitted students (or empty scores in your CSV), highlights them on the panel in orange (`⚠️ [Unsubmitted]`), and smoothly advances to the next student without stopping.

#### Q: Is student data protected under FERPA / GDPR?
**A:** Absolutely.
- **Zero Cloud Storage**: All CSV parsing occurs locally in memory via the HTML5 `FileReader` API.
- **Origin-Isolated**: Caches are saved strictly in your browser domain origin `localStorage`.
- **Zero Telemetry**: No analytics, no remote script loads, and no third-party network requests.

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
