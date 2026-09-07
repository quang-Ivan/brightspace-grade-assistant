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

## 📋 CSV Format Specification

You can upload either format. A ready-to-use template is available in [`sample_grades.csv`](sample_grades.csv).

### Format A: Simple 3-Column CSV (Recommended)
```csv
student,score,reason
"Alice Smith",95.0,"Excellent work! Problem 1 and Problem 2 are completely correct."
"Bob Jones",88.5,"Good submission. Remember to include physical units on final answers."
"Charlie Brown",,"No submission"
```
- `student`: Full name matching the student's name on Brightspace (e.g. `First Last` or `Last, First`).
- `score`: Numeric points. Leave empty for unsubmitted students.
- `reason`: Multi-line text or HTML rubric comments.

### Format B: Brightspace Native Export Format
```csv
OrgDefinedId,Last Name,First Name,Homework 1 Points Grade <Numeric MaxPoints:100>,End-of-Line Indicator
#112233445,Smith,Alice,95.0,#
#112233446,Jones,Bob,88.5,#
#112233447,Brown,Charlie,,#
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
