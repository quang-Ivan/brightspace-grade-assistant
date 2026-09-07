# 📖 Deep-Dive Technical Guide & Architecture Manual

This document provides an exhaustive, technical breakdown of **Brightspace Feedback & Grade Assistant** for instructors, TAs, and developers seeking an in-depth understanding of the system architecture, DOM piercing mechanics, Brightspace event lifecycle, and security guarantees.

---

## 📑 Table of Contents
1. [The Two-Phase Grading Workflow (Draft vs. Publish)](#1-the-two-phase-grading-workflow-draft-vs-publish)
2. [Why Backend Gradebook CSV Upload Is Obsolete](#2-why-backend-gradebook-csv-upload-is-obsolete)
3. [Deep Web Component & Shadow DOM Piercing](#3-deep-web-component--shadow-dom-piercing)
4. [The Feedback Persistence Bug & The Siren/Blur Event Solution](#4-the-feedback-persistence-bug--the-sirenblur-event-solution)
5. [Zero-Miss Roster Traversal State Machine](#5-zero-miss-roster-traversal-state-machine)
6. [Fast Skip & Non-Empty Validation](#6-fast-skip--non-empty-validation)
7. [Comprehensive CSV Formatting & Edge Cases](#7-comprehensive-csv-formatting--edge-cases)
8. [FERPA Compliance & Security Audit](#8-ferpa-compliance--security-audit)

---

## 1. The Two-Phase Grading Workflow (Draft vs. Publish)

In university environments, releasing grades student-by-student while grading is actively underway is considered bad practice:
- Students who receive notifications early often contact peers, causing confusion and emails to instructors.
- Instructors or TAs frequently need to adjust curves or rubric penalties mid-way through grading.

To solve this, the userscript implements a strict **Two-Phase Grading Model**:

```
+-----------------------------------------------------------------------------------+
| PHASE 1: Automated Local Draft Ingestion (Userscript)                              |
|                                                                                   |
|  [ Gradebook CSV ] ---> [ Userscript Auto-Cruise ]                                |
|                                |                                                  |
|                                v                                                  |
|                     Clicks "Save Draft" Only                                      |
|                     (or "Update" if pre-published)                                |
|                                |                                                  |
|                                v                                                  |
|                     Grades Stored as DRAFTS                                       |
|                     (Hidden from student view)                                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v (Review complete)
+-----------------------------------------------------------------------------------+
| PHASE 2: Official Batch Release (Instructor Discretion)                           |
|                                                                                   |
|  Instructor opens Brightspace Submissions List ➔ Clicks "Publish All"             |
|  ➔ All students receive grades and rubric notifications simultaneously.           |
+-----------------------------------------------------------------------------------+
```

### Critical Behavioral Guarantees:
- **Never Prematurely Publishes**: The script's `triggerSave()` function looks strictly for `save draft`, `update`, or `save`. It **never** clicks the primary `Publish` button on draft submissions.
- **Audit Before Release**: The instructor retains 100% control over when grades go live. You can inspect any student's draft in Brightspace before making the final release.

---

## 2. Why Backend Gradebook CSV Upload Is Obsolete

In traditional Brightspace grading, instructors often performed redundant work:
1. Exporting a CSV, editing it, and uploading it through `Grades ➔ Enter Grades ➔ Import`.
2. Manually visiting each assignment submission to copy-paste feedback paragraphs.

### The Automated Solution:
In Brightspace, assignments are linked to Grade Items. When an evaluation is saved inside the **Consistent Evaluation** interface:
- Brightspace's backend **automatically propagates the points directly into the official Gradebook (`Grades`)**.
- As a result, using this userscript eliminates the need to ever visit the backend `Grades ➔ Import` page. Both points and rich-text feedback comments are delivered simultaneously in a single automated pass.

---

## 3. Deep Web Component & Shadow DOM Piercing

Modern D2L Brightspace relies heavily on **LitElement**, custom elements, and multi-tier encapsulated **Shadow DOM** boundaries. Standard DOM queries such as `document.querySelector('input')` fail because inputs are hidden inside shadow roots.

### The Recursive `deepQuery` Engine:
The userscript implements a cross-boundary tree crawler:
```javascript
function deepQuery(selector, root = document) {
    let matches = Array.from(root.querySelectorAll(selector));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        if (node.shadowRoot) {
            matches = matches.concat(deepQuery(selector, node.shadowRoot));
        }
    }
    // Cross same-origin iframes
    const iframes = root.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            if (iframe.contentDocument) {
                matches = matches.concat(deepQuery(selector, iframe.contentDocument));
            }
        } catch(e) {}
    }
    return matches;
}
```

### Score Input Traversal:
To inject the numeric score, the crawler penetrates:
`<d2l-consistent-evaluation>` ➔ Shadow Root ➔ `<d2l-input-number>` ➔ Shadow Root ➔ `<d2l-input-text>` ➔ Shadow Root ➔ native `<input type="text">`.
It sets the value and dispatches native `input`, `change`, and custom LitElement events to ensure Brightspace's internal reactivity registers the change.

---

## 4. The Feedback Persistence Bug & The Siren/Blur Event Solution

One of the most complex challenges in automating Brightspace Consistent Evaluation is that injecting HTML into the TinyMCE iframe alone **does not persist** upon saving. 

### Root Cause Analysis:
Brightspace wraps the feedback editor in:
```html
<d2l-consistent-evaluation-right-panel-feedback>
  <d2l-htmleditor>
    <iframe class="tox-edit-area__iframe">...</iframe>
  </d2l-htmleditor>
</d2l-consistent-evaluation-right-panel-feedback>
```
The outer web component `<d2l-consistent-evaluation-right-panel-feedback>` maintains its own internal state (`fb._feedbackText`). It **only** updates this property and dispatches the Siren update payload when it receives a custom **`d2l-htmleditor-blur`** event from `<d2l-htmleditor>`.

Without this blur event, clicking "Save Draft" causes Brightspace to issue a REST call with an empty feedback payload (`fb._feedbackText === ""`).

### The Three-Tier Synchronization Fix:
The userscript executes a synchronized three-tier injection:
```javascript
// 1. Sync the underlying TinyMCE editor instance
if (tiny && ed._editorId) {
    const tEd = tiny.get(ed._editorId);
    if (tEd) {
        tEd.focus();
        tEd.setContent(html);
        tEd.save();
        tEd.fire('change');
    }
}

// 2. Dispatch the exact blur event that Brightspace expects
ed.dispatchEvent(new CustomEvent('d2l-htmleditor-blur', { bubbles: true, composed: true }));

// 3. Direct component state update and save invocation
fbPanels.forEach(fb => {
    fb._feedbackText = html;
    if (typeof fb._saveFeedback === 'function') fb._saveFeedback();
});
```
This guarantees that overall feedback is permanently stored in the Brightspace database upon page reload.

---

## 5. Zero-Miss Roster Traversal State Machine

Brightspace Consistent Evaluation uses an iterator model that by default only moves forward when the user clicks "Next Student".

### State Machine Overview:
1. **Auto-Rewind on Start**:
   - When the user launches Auto-Cruise, the script evaluates `isAtFirstStudent()` (checking if `Previous Student` is disabled).
   - If starting away from Student #1, it automatically steps backward (~400ms per step) until reaching Student #1.
2. **Forward Cruise**:
   - Grades submitted students, saves drafts, dismisses confirmation dialogs, and steps forward.
   - Unsubmitted students are automatically flagged as `[Unsubmitted]` and skipped.
3. **Wrap-Around & Infinite Loop Prevention**:
   - When reaching the end of the roster (`Next Student` disabled), the script compares the set of evaluated students against the students in the CSV who submitted work.
   - If any submitted students remain unvisited, it executes a wrap-around pass (rewinding to the start).
   - **Safety Cap**: The number of wrap-around passes is strictly capped at 2 (`wrapAroundPasses < 2`), mathematically preventing infinite loops even if roster discrepancies occur.

---

## 6. Fast Skip & Non-Empty Validation

On repeated cruise runs, re-submitting already-graded students causes unnecessary network traffic and dialog delays.

### The Fast Skip Algorithm:
1. When arriving at a student, the script checks `localStorage` and `processedSet`.
2. **Feedback Verification Check**: Before skipping, it inspects the live page to verify that:
   - The score on the page matches the expected score.
   - The feedback container on the page actually contains non-empty text.
3. If feedback was somehow wiped or missing from a previous run, the script **refuses to skip** and instead repairs the student by re-injecting the score and feedback and clicking Save/Update.
4. If genuinely complete, it advances to the next student in **400ms**, enabling a 35-student class to be traversed in under 15 seconds.

---

## 7. Comprehensive CSV Formatting & Edge Cases

### Student Name Matching:
On the Consistent Evaluation page, Brightspace displays the student's name in headers and titles:
- `"Assignment Evaluation - First Last - Assignment Name"`
- `"Evaluation for First Last on Assignment Name"`

The userscript parses the CSV and matches against:
- `First Last` (e.g. `Alice Smith`)
- `Last, First` (e.g. `Smith, Alice`)

### Unsubmitted Students:
To designate that a student did not submit:
- In the CSV, leave the `score` column empty:
  `"Charlie Brown",,"No submission"`
- The parser interprets empty strings or null values as `submitted: false`.
- The student is pre-marked as unsubmitted upon CSV load, preventing them from stalling navigation or causing false wrap-arounds.

### Multi-Line and HTML Feedback:
Standard CSV rules apply:
- Multi-line feedback must be enclosed in double quotes:
  ```csv
  "Alice Smith",95.0,"Great work!
  
  Notes:
  - Check problem 2 units (-5)
  - All other problems 100% correct."
  ```
- HTML formatting is fully supported:
  ```csv
  "Bob Jones",88.0,"<p>Good job!</p><ul><li>Part 1: 50/50</li><li>Part 2: 38/50</li></ul>"
  ```

---

## 8. FERPA Compliance & Security Audit

University privacy guidelines (FERPA in the United States, GDPR in Europe) strictly regulate handling student Personally Identifiable Information (PII):

| Risk Vector | Userscript Mitigation |
| :--- | :--- |
| **Data Transmission** | **Zero network requests outside Brightspace**. No analytics, no telemetry, no CDN scripts. |
| **Data Storage** | All CSV data is stored in the browser's origin-isolated `localStorage` under `https://<your-institution>.brightspace.com`. Other websites cannot access it. |
| **Local File Reading** | Relies strictly on the HTML5 `FileReader` API in-memory. No files are uploaded to any external server. |
| **Code Auditing** | 100% vanilla JavaScript. No obfuscation, no minification, no hidden eval. |

---

*Authored by quang-Ivan | MIT License*
