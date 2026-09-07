# 🎓 Brightspace (D2L) Feedback & Grade Auto-Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen.svg)](brightspace_auto_feedback_injector.user.js)
[![Userscript](https://img.shields.io/badge/Userscript-Tampermonkey%20%7C%20Violentmonkey-green.svg)](brightspace_auto_feedback_injector.user.js)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen.svg)](#-privacy--local-execution)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](CONTRIBUTING.md)

> A blazing-fast client-side userscript for instructors, professors, and Teaching Assistants (TAs). Automatically injects grades and rich rubric feedback into **D2L Brightspace Consistent Evaluation**, auto-confirms navigation dialogs, fast-skips already evaluated students, and cruises through the entire class roster with **reconciled class coverage**.

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
- [**Violentmonkey**](https://violentmonkey.github.io/) (Recommended — fast, lightweight, and works seamlessly)
- [**Tampermonkey**](https://www.tampermonkey.net/) (Popular alternative)

> [!NOTE]
> **Chrome 138+ / Tampermonkey 5.3+ Notice**: In Chromium-based browsers, ensure **"Developer mode"** is enabled in `chrome://extensions` or toggle on **"Allow User Scripts"** in the extension details page so userscripts are permitted to run. Violentmonkey handles this automatically.

### Step 2: Install This Userscript
Click the 1-click install link below:

👉 [**⚡ Click Here to Install Userscript (v1.0.0)**](https://raw.githubusercontent.com/quang-Ivan/brightspace-grade-assistant/main/brightspace_auto_feedback_injector.user.js)

*(Your extension manager will automatically open a tab asking you to confirm. Click **Install** or **Confirm**).*

### Step 3: Grade in Brightspace!
1. Log into your university's Brightspace (e.g. Stony Brook, Purdue, Waterloo, or `*.brightspace.com`).
2. Go to your course ➔ **Assignments** ➔ Click on any student submission to enter **Consistent Evaluation**.
3. The blue **🎓 Brightspace Feedback & Grade Assistant** panel appears in the bottom-right corner!
4. Click **📁 Load Gradebook CSV** and select your CSV file.
5. Click **🚀 Start Auto-Cruise** (or press <kbd>Alt</kbd> + <kbd>A</kbd>).
6. When all students are graded, you will hear a cheerful 4-note completion chime 🎵.

---

## 💡 Key Architectural Clarifications

### 1. Does This Sync Directly to the Brightspace Gradebook?
**Yes!** In Brightspace, whenever an assignment is linked to a Grade Item (the standard setup):
- Saving an evaluation in the **Consistent Evaluation** interface automatically synchronizes the points into the **Brightspace Gradebook (`Grades`)**.
- **You NO LONGER need to manually upload CSVs to the backend `Grades ➔ Import` page!** This script handles both rubric feedback injection and gradebook synchronization simultaneously through the GUI.

### 2. Save Draft vs. Publish: Is It Safe?
**100% Safe.** 
- For new assignments, the script **strictly clicks "Save Draft"** (it **never** clicks "Publish" on drafts).
- Grades and feedback remain completely hidden from students while grading is underway.
- Once you finish and review the entire class, you can release all grades simultaneously with a single click using Brightspace's official **"Publish All"** button on the Submissions list.
- *(Note: If an assignment was already published previously, the script clicks "Update" to refresh the score and feedback).*

> 📖 **Want to know more about the underlying mechanics?**  
> Read our comprehensive **[In-Depth Technical Guide & Architecture Manual](docs/IN_DEPTH_GUIDE.md)** for a deep-dive into Shadow DOM traversal, Siren/TinyMCE event synchronization, state machine flowcharts, and FERPA auditing.

---

## 🌟 Features at a Glance

- 🔄 **Reconciled Full Roster Traversal**: Auto-rewinds to Student #1 before forward cruising, and wraps around if any students remain unvisited (up to 2 passes). Strictly reconciles completed vs. missing students before displaying completion.
- 🎯 **Deep Web Component Piercing**: Targets `d2l-input-number` and TinyMCE iframe editors inside Brightspace Web Components while strictly isolating overall grades from rubric criteria.
- 📝 **True Event Synchronization**: Dispatches proper `@d2l-htmleditor-blur` events to guarantee rich HTML overall feedback is permanently synchronized.
- ⚡ **0.4s Fast Skip & Dialog Dismissal**: Already-graded students are skipped in 400ms (verifying non-empty feedback). Harmless navigation dialogs are safely intercepted; destructive dialogs (delete/discard) strictly halt for safety.
- ⚠️ **Smart Skip & Validation**: Rejects invalid non-numeric scores, alerts on duplicate student names, and safely skips unsubmitted students.
- 🛑 **Emergency Stop (<kbd>Alt</kbd> + <kbd>S</kbd>)**: Immediately cancels running tokens and invalidates all pending asynchronous promises in real time.
- 🎵 **Web Audio Completion Chime**: Synthesizes a pleasant 4-note chime (C5-E5-G5-C6) when all grading is verified.
- 🔒 **Privacy-First Local Architecture**: 100% client-side vanilla JavaScript. Zero telemetry, zero analytics, and no third-party network requests. Stored context is isolated per course and assignment.

---

## 📋 CSV Format Guide

The script natively accepts two CSV formats. A sample template is provided in [`sample_grades.csv`](sample_grades.csv).

### 🎯 Quick Format Selection:
| Your Goal | Recommended Format | Score Filled? | Feedback Injected? |
| :--- | :---: | :---: | :---: |
| **Inject Both Scores & Detailed Feedback** (Simplest) | **Format A** (`student,score,reason`) | ✅ Yes | ✅ Yes (Built-in `reason` column) |
| **Export Roster from Brightspace, then add Feedback** | **Format B with `Feedback` column** | ✅ Yes | ✅ Yes (Add a `Feedback` column) |
| **Only Fill Numeric Scores** (No feedback needed) | **Format B Native** (Standard Brightspace export) | ✅ Yes | ⏹️ No (Score only) |

---

### Format A: Simple 3-Column CSV (Recommended)
```csv
student,score,reason
"Alice Smith",95.0,"Excellent work! Problem 1 and Problem 2 are completely correct."
"Bob Jones",88.5,"Good submission. Note: check units and label all axes on problem 2."
"Charlie Brown",,"No submission"
"Diana Prince",92.0,"<p><b>Part A:</b> 50/50</p><p><b>Part B:</b> 42/50 (-8: calculation error)</p>"
```
- **`student`**: Full name matching Brightspace (e.g. `First Last` or `Last, First`).
- **`score`**: Numeric points. **For unsubmitted students, leave this completely blank!**
- **`reason`**: Multi-line feedback comments or HTML tags.

---

### Format B: Brightspace Roster Export Format

Brightspace's native Gradebook Export (`Grades ➔ Export`) produces a format containing `OrgDefinedId`, `Last Name`, `First Name`, and numeric points columns:

```csv
OrgDefinedId,Last Name,First Name,Homework 1 Points Grade <Numeric MaxPoints:100>,Feedback,End-of-Line Indicator
#112233445,Smith,Alice,95.0,"Excellent work! All answers completely correct.",#
#112233446,Jones,Bob,88.5,"Good job. Note: check units on problem 2.",#
#112233447,Brown,Charlie,,No submission,#
```

> [!WARNING]
> **Format B with `Feedback` is a Userscript-Specific Format**:
> - Adding a `Feedback` column is designed specifically for **this userscript**.
> - Do **NOT** upload a CSV with a `Feedback` column directly to Brightspace's native `Grades ➔ Import` tool, because Brightspace's backend only accepts numeric grade item columns and will reject unknown text columns.
> - **Student Matching Note**: On the Consistent Evaluation page, Brightspace displays students by `First Name` + `Last Name`. Our userscript matches students on screen using their names, while preserving `OrgDefinedId` for auditing and data integrity.

---

## 🛠️ How to Prepare Your CSV (3 Workflows)

<details>
<summary><strong>Click to expand 3 simple CSV preparation workflows</strong></summary>

### Workflow 1: From Brightspace Export (Zero Manual Typing of Names)
1. In Brightspace, go to **Grades** ➔ **Enter Grades** ➔ **Export**.
2. Under **Key Field**, select `OrgDefinedId` (or `Both`). Check `Last Name` and `First Name`.
3. Under **Choose Grades to Export**, check your target Assignment (e.g. `Homework 1`).
4. Click **Export to CSV**.
5. Open in Excel, enter scores, add a `Feedback` column if desired, and save as CSV!

### Workflow 2: From Excel or Google Sheets (Quick 3-Column Spreadsheet)
1. Open Excel or Google Sheets.
2. Put `student`, `score`, and `reason` in the first row.
3. Fill in student names, scores, and comments (leave unsubmitted scores blank).
4. Save as CSV (`File ➔ Download / Save As ➔ CSV`).

### Workflow 3: Automated Python / Jupyter / Autograder Workflow
TAs running autograders can export results directly:
```python
import csv

results = [
    {"name": "Alice Smith", "score": 98.0, "feedback": "All test cases passed!"},
    {"name": "Bob Jones", "score": 85.0, "feedback": "Problem 3 failed test case 2."},
    {"name": "Charlie Brown", "score": None, "feedback": "No submission"}
]

with open("grades.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["student", "score", "reason"])
    for r in results:
        writer.writerow([r["name"], r["score"] if r["score"] is not None else "", r["feedback"]])
```
</details>

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

<details>
<summary><strong>Q: Does this work on my university's Brightspace website?</strong></summary>
Yes! The script matches all standard Brightspace domains including <code>*.brightspace.com</code>, <code>*.desire2learn.com</code>, Stony Brook University (<code>mycourses.stonybrook.edu</code>), Purdue, Waterloo, Arizona, and any custom institutional domain.
</details>

<details>
<summary><strong>Q: Will Brightspace detect or ban this?</strong></summary>
No. This is a client-side assistive script running locally in your browser. It interacts with the DOM exactly as a human instructor would (dispatching standard click and input events).
</details>

<details>
<summary><strong>Q: What happens if a student did not submit their assignment?</strong></summary>
The script automatically detects unsubmitted students (or empty scores in your CSV), highlights them on the panel in orange (<code>⚠️ [Unsubmitted]</code>), and smoothly advances to the next student without stopping.
</details>

<details>
<summary><strong>Q: How is student privacy protected (FERPA / GDPR considerations)?</strong></summary>
The script runs 100% locally inside your browser session as client-side vanilla JavaScript. There are zero remote APIs, zero external CDNs, and zero analytics tracking. CSV parsing happens in memory via the HTML5 <code>FileReader</code> API. Local storage data is scoped strictly to the current course and assignment context, and can be completely purged at any time using the <strong>🔄 Reset Cache & CSV</strong> button.
</details>

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
