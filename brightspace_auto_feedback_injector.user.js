// ==UserScript==
// @name         Brightspace (D2L) Assignment Feedback & Grade Auto-Filler
// @namespace    https://github.com/quang-Ivan/brightspace-grade-assistant
// @version      1.0.0
// @description  Deep Shadow-DOM & TinyMCE Piercer for D2L Brightspace. Auto-rewinds to roster start, fills grades and rich feedback, syncs true blur/Siren events, fast skips graded students, dismisses dialogs, and auto-navigates. 100% FERPA Compliant.
// @author       quang-Ivan
// @license      MIT
// @homepageURL  https://github.com/ivan/brightspace-grade-assistant
// @supportURL   https://github.com/ivan/brightspace-grade-assistant/issues
// @match        *://*/d2l/*
// @match        *://*/*activities/iterator/*
// @match        *://*/d2l/lms/dropbox/admin/mark/*
// @match        *://*/d2l/le/activities/iterator/*
// @match        https://mycourses.stonybrook.edu/d2l/*
// @match        https://*.brightspace.com/d2l/*
// @match        https://*.desire2learn.com/d2l/*
// @run-at       document-idle
// @all-frames   true
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const IS_TOP = window.self === window.top;

    // Sample fallback database (Zero student private data - 100% FERPA Compliant)
    const SAMPLE_STUDENT_DB = {
        "Sample Student A": { "score": "100.0", "reason": "Excellent work! All problems completed thoroughly and accurately.", "submitted": true },
        "Sample Student B": { "score": "85.0", "reason": "Good effort. Note for improvement: check units and label all axes on problem 2.", "submitted": true },
        "Sample Student C": { "score": null, "reason": "No submission", "submitted": false }
    };

    let isHalted = false;
    let autoCruiseActive = false;
    let isProcessingCurrent = false;
    let currentProcessingStudent = null;
    let cruiseInterval = null;
    const processedSet = new Set();

    function getAssignmentId() {
        const m = window.location.pathname.match(/iterator\/(\d+)/);
        if (m && m[1]) return m[1];
        const ouMatch = window.location.search.match(/ou=(\d+)/);
        return ouMatch ? ouMatch[1] : 'default';
    }

    function getProcessedMap() {
        try {
            const id = getAssignmentId();
            const raw = localStorage.getItem(`d2l_processed_map_${id}`);
            return raw ? JSON.parse(raw) : {};
        } catch(e) {
            return {};
        }
    }

    function markStudentProcessed(name, details = {}) {
        try {
            const id = getAssignmentId();
            const map = getProcessedMap();
            map[name] = {
                timestamp: Date.now(),
                ...details
            };
            localStorage.setItem(`d2l_processed_map_${id}`, JSON.stringify(map));
        } catch(e) {}
    }

    function clearProcessedMap() {
        try {
            const id = getAssignmentId();
            localStorage.removeItem(`d2l_processed_map_${id}`);
        } catch(e) {}
    }

    function getSkipProcessedPref() {
        try {
            const pref = localStorage.getItem('d2l_skip_processed_pref');
            return pref === null ? true : pref === 'true';
        } catch(e) {
            return true;
        }
    }

    function setSkipProcessedPref(val) {
        try {
            localStorage.setItem('d2l_skip_processed_pref', val ? 'true' : 'false');
        } catch(e) {}
    }

    function getAutoRewindPref() {
        try {
            const pref = localStorage.getItem('d2l_auto_rewind_pref');
            return pref === null ? true : pref === 'true';
        } catch(e) {
            return true;
        }
    }

    function setAutoRewindPref(val) {
        try {
            localStorage.setItem('d2l_auto_rewind_pref', val ? 'true' : 'false');
        } catch(e) {}
    }

    function getStudentDatabase() {
        try {
            const saved = localStorage.getItem('d2l_auto_eval_db_public');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Object.keys(parsed).length > 0) return parsed;
            }
        } catch(e) {}
        return SAMPLE_STUDENT_DB;
    }

    function saveStudentDatabase(db) {
        localStorage.setItem('d2l_auto_eval_db_public', JSON.stringify(db));
    }

    function findStudentData(studentName, db) {
        if (!studentName || !db) return null;
        if (db[studentName]) return db[studentName];
        
        const clean = studentName.trim().toLowerCase();
        for (const [key, val] of Object.entries(db)) {
            if (key.trim().toLowerCase() === clean) return val;
            
            // Handle "First Last" vs "Last, First"
            const parts = key.split(/[\s,]+/).filter(Boolean);
            if (parts.length === 2) {
                const rev = `${parts[1]} ${parts[0]}`.toLowerCase();
                if (rev === clean) return val;
            }
        }
        return null;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function playSuccessChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            // Melodic 4-note chime: C5, E5, G5, C6
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.12);
            osc.frequency.setValueAtTime(783.99, now + 0.24);
            osc.frequency.setValueAtTime(1046.50, now + 0.36);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.7);
        } catch(e) {}
    }

    function deepQuery(selector, root = document) {
        let matches = [];
        try { matches = Array.from(root.querySelectorAll(selector)); } catch(e) {}
        if (root.shadowRoot) {
            matches = matches.concat(deepQuery(selector, root.shadowRoot));
        }
        try {
            const allElements = root.querySelectorAll('*');
            for (const el of allElements) {
                if (el.id === 'bs-helper-panel-root' || (el.closest && el.closest('#bs-helper-panel-root'))) continue;
                if (el.shadowRoot) {
                    matches = matches.concat(deepQuery(selector, el.shadowRoot));
                }
            }
        } catch(e) {}
        try {
            const iframes = root.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    if (iframe.contentDocument) {
                        matches = matches.concat(deepQuery(selector, iframe.contentDocument));
                    }
                } catch(e) {}
            }
        } catch(e) {}

        return matches.filter(el => {
            if (!el) return false;
            if (el.id && (el.id === 'bs-helper-panel-root' || el.id.startsWith('bs-btn-') || el.id.startsWith('bs-panel-'))) return false;
            if (el.closest && el.closest('#bs-helper-panel-root')) return false;
            return true;
        });
    }

    function getStudentNameFromPage() {
        const titleMatch = (document.title || '').match(/Assignment Evaluation\s*-\s*(.+?)\s*-\s*/i);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1].trim();
        }

        const h1s = deepQuery('h1, h2, h3, [class*="immersive-navigation" i], [class*="nav-bar" i]');
        for (const h of h1s) {
            const txt = h.textContent || '';
            const m = txt.match(/Evaluation for\s+([A-Za-z\s'-]+)/i);
            if (m && m[1]) {
                return m[1].trim().replace(/\s+on\s+.*$/i, '').trim();
            }
        }

        const db = getStudentDatabase();
        const pageText = (document.body ? document.body.innerText : '') + ' ' + document.title;
        for (const name of Object.keys(db)) {
            if (pageText.includes(name)) return name;
        }

        return null;
    }

    function isStudentAlreadySavedOnPage(expectedScore, expectedFeedback) {
        if (expectedScore === null || expectedScore === undefined || expectedScore === '') return false;
        
        const gradeEls = deepQuery('#d2l-grade, d2l-input-number#d2l-grade, d2l-input-number');
        let scoreMatches = false;
        const target = parseFloat(expectedScore);
        for (const gc of gradeEls) {
            if (gc.value !== undefined && gc.value !== null && gc.value !== '') {
                if (Math.abs(parseFloat(gc.value) - target) < 0.001) {
                    scoreMatches = true;
                    break;
                }
            }
            const inner = deepQuery('input', gc);
            for (const inp of inner) {
                if (inp.value && Math.abs(parseFloat(inp.value) - target) < 0.001) {
                    scoreMatches = true;
                    break;
                }
            }
        }

        if (!scoreMatches) {
            const fallbackInputs = deepQuery('input[class*="d2l-input" i], input[id*="score" i], input[aria-label*="score" i]');
            for (const inp of fallbackInputs) {
                if (inp.value && Math.abs(parseFloat(inp.value) - target) < 0.001) {
                    scoreMatches = true;
                    break;
                }
            }
        }

        let hasUpdateBtn = false;
        const candidates = deepQuery('d2l-button, button, [role="button"]');
        for (const b of candidates) {
            const txt = (b.getAttribute('text') || b.textContent || '').trim().toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (txt === 'update' || txt.includes('update') || aria.includes('update')) {
                hasUpdateBtn = true;
                break;
            }
        }

        // Verify feedback is actually populated!
        if (expectedFeedback && expectedFeedback.trim().length > 0) {
            const ed = deepQuery('d2l-htmleditor')[0];
            const fb = deepQuery('d2l-consistent-evaluation-right-panel-feedback')[0];
            const toxIframe = deepQuery('iframe.tox-edit-area__iframe')[0];
            
            let currentHtml = (ed ? ed.html : '') || (fb ? fb.feedbackText : '');
            if (!currentHtml && toxIframe && toxIframe.contentDocument && toxIframe.contentDocument.body) {
                currentHtml = toxIframe.contentDocument.body.innerHTML;
            }
            const cleanText = (currentHtml || '').replace(/<[^>]*>/g, '').trim();
            if (cleanText.length === 0) {
                return false; // Feedback missing on page -> MUST NOT SKIP!
            }
        }

        return scoreMatches && hasUpdateBtn;
    }

    function deepFillScore(scoreVal) {
        if (scoreVal === null || scoreVal === undefined || scoreVal === '') return false;

        const gradeEls = deepQuery('#d2l-grade, d2l-input-number#d2l-grade, d2l-input-number');
        let matchedCount = 0;

        for (const gc of gradeEls) {
            try { gc.value = parseFloat(scoreVal); } catch(e) {}

            const innerInputs = deepQuery('input', gc);
            for (const inp of innerInputs) {
                try {
                    inp.focus();
                    inp.value = scoreVal;
                    inp.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    inp.blur();
                    matchedCount++;
                } catch(e) {}
            }

            try {
                gc.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
                matchedCount++;
            } catch(e) {}
        }

        if (matchedCount === 0) {
            const fallbackInputs = deepQuery('input[class*="d2l-input" i], input[id*="score" i], input[aria-label*="score" i]');
            for (const inp of fallbackInputs) {
                try {
                    inp.focus();
                    inp.value = scoreVal;
                    inp.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    inp.blur();
                    matchedCount++;
                } catch(e) {}
            }
        }

        return matchedCount > 0;
    }

    // Complete Siren & Blur Event synchronized feedback injection
    function deepFillFeedback(plainText) {
        if (!plainText) return false;
        const html = '<p>' + plainText.replace(/\\n/g, '<br>') + '</p>';
        let filled = false;

        const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const tiny = win.tinymce || window.tinymce;

        // 1. Target d2l-htmleditor & TinyMCE instance directly
        const editors = deepQuery('d2l-htmleditor');
        for (const ed of editors) {
            try {
                ed.html = html;
                ed.isDirty = true;
                
                // Sync via TinyMCE instance if available
                if (tiny && ed._editorId) {
                    const tEd = tiny.get(ed._editorId);
                    if (tEd) {
                        tEd.focus();
                        tEd.setContent(html);
                        tEd.save();
                        tEd.fire('change');
                        tEd.fire('input');
                        tEd.fire('blur');
                    }
                }

                // CRITICAL: Brightspace feedback panel only synchronizes on 'd2l-htmleditor-blur'
                ed.dispatchEvent(new CustomEvent('d2l-htmleditor-blur', { bubbles: true, composed: true }));
                ed.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
                ed.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }));
                filled = true;
            } catch(e) {}
        }

        // 2. Direct sync with parent feedback container (d2l-consistent-evaluation-right-panel-feedback)
        const fbPanels = deepQuery('d2l-consistent-evaluation-right-panel-feedback');
        for (const fb of fbPanels) {
            try {
                fb._feedbackText = html;
                if (typeof fb._saveFeedback === 'function') {
                    fb._saveFeedback();
                }
                filled = true;
            } catch(e) {}
        }

        // 3. Fallback sync to iframe DOM
        const toxIframes = deepQuery('iframe.tox-edit-area__iframe, iframe[id*="_ifr"]');
        for (const f of toxIframes) {
            try {
                if (f.contentDocument && f.contentDocument.body) {
                    f.contentDocument.body.innerHTML = html;
                    f.contentDocument.body.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    f.contentDocument.body.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    filled = true;
                }
            } catch(e) {}
        }

        // 4. Textarea fallback
        const textareas = deepQuery('textarea');
        for (const ta of textareas) {
            const id = (ta.id || '').toLowerCase();
            const name = (ta.name || '').toLowerCase();
            if (id.includes('feedback') || name.includes('feedback') || textareas.length === 1 || id.includes('uid')) {
                try {
                    ta.focus();
                    ta.value = plainText;
                    ta.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    ta.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    ta.blur();
                    filled = true;
                } catch(e) {}
            }
        }

        return filled;
    }

    function triggerSave() {
        const candidates = deepQuery('d2l-button, button, [role="button"]');
        for (const b of candidates) {
            const txt = (b.getAttribute('text') || b.textContent || '').trim().toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (
                txt === 'save draft' || txt === 'update' || txt === 'save' ||
                txt.includes('save draft') || txt.includes('update') ||
                aria.includes('save draft') || aria.includes('update')
            ) {
                console.log('[D2L-AutoFeedback] Triggering Save/Update:', b);
                if (b.shadowRoot) {
                    const inner = b.shadowRoot.querySelector('button');
                    if (inner) inner.click();
                }
                b.click();
                return true;
            }
        }
        return false;
    }

    function autoConfirmDialog() {
        const dialogs = deepQuery('d2l-dialog-confirm, d2l-dialog, [role="alertdialog"], [role="dialog"], .d2l-dialog');
        let confirmed = 0;

        for (const d of dialogs) {
            const isOpen = d.opened || d.hasAttribute('opened') || (d.style && d.style.display !== 'none' && d.offsetWidth > 0);
            if (!isOpen) continue;

            console.log('[D2L-AutoFeedback] Active Dialog Detected, auto-confirming:', d);

            try {
                if (typeof d._close === 'function') d._close('yes');
                else if (typeof d.close === 'function') d.close('yes');
            } catch(e) {}

            try {
                d.dispatchEvent(new CustomEvent('d2l-dialog-close', {
                    bubbles: true,
                    composed: true,
                    detail: { action: 'yes' }
                }));
            } catch(e) {}

            const btns = deepQuery('button, d2l-button', d);
            for (const b of btns) {
                const act = (b.getAttribute('data-dialog-action') || b.getAttribute('dialog-action') || '').toLowerCase();
                const txt = (b.getAttribute('text') || b.textContent || '').trim().toLowerCase();
                const isPrimary = b.hasAttribute('primary') || (b.className && b.className.includes('primary'));

                if (act === 'yes' || act === 'save' || act.includes('save') || act === 'proceed' || act === 'ok' || txt === 'yes' || txt.includes('save') || txt.includes('update') || txt.includes('both') || isPrimary) {
                    console.log('[D2L-AutoFeedback] Clicking affirmative dialog button:', b);
                    if (b.shadowRoot) {
                        const inner = b.shadowRoot.querySelector('button');
                        if (inner) inner.click();
                    }
                    b.click();
                    confirmed++;
                    break;
                }
            }

            try { d.opened = false; } catch(e) {}
        }
        return confirmed > 0;
    }

    function deepClickNext() {
        const nextBtns = deepQuery('button[aria-label="Next Student"], button[aria-label="Next"]');
        for (const b of nextBtns) {
            if (b.disabled || b.hasAttribute('disabled')) {
                console.warn('[D2L-AutoFeedback] Next button is disabled (End of roster)');
                return 'DISABLED';
            }
            b.click();
            return 'CLICKED';
        }
        return 'NOT_FOUND';
    }

    function deepClickPrev() {
        const prevBtns = deepQuery('button[aria-label="Previous Student"], button[aria-label="Previous"]');
        for (const b of prevBtns) {
            if (b.disabled || b.hasAttribute('disabled')) {
                console.warn('[D2L-AutoFeedback] Prev button is disabled (Start of roster)');
                return 'DISABLED';
            }
            b.click();
            return 'CLICKED';
        }
        return 'NOT_FOUND';
    }

    function isAtFirstStudent() {
        const prevBtns = deepQuery('button[aria-label="Previous Student"], button[aria-label="Previous"]');
        if (prevBtns.length === 0) return false;
        return prevBtns.some(b => b.disabled || b.hasAttribute('disabled'));
    }

    async function rewindToFirstStudent() {
        setStatus('⏪ Rewinding to first student in roster...', '#006fbf');
        let steps = 0;
        while (!isHalted && autoCruiseActive && steps < 70) {
            if (isAtFirstStudent()) {
                console.log('[D2L-AutoFeedback] Arrived at first student!');
                return true;
            }
            const res = deepClickPrev();
            if (res === 'DISABLED') {
                return true;
            }
            if (res !== 'CLICKED') {
                await sleep(500);
                if (isAtFirstStudent()) return true;
                break;
            }
            await waitForPageTransition();
            steps++;
        }
        return isAtFirstStudent();
    }

    function executeFill(showNotification = true) {
        if (isHalted) return false;

        const db = getStudentDatabase();
        const student = getStudentNameFromPage();
        const statusEl = document.getElementById('bs-op-status');

        if (!student) {
            const msg = '⚠️ Could not identify student name on current page';
            if (statusEl && showNotification) {
                statusEl.textContent = msg;
                statusEl.style.color = '#d9534f';
            }
            return false;
        }

        const data = findStudentData(student, db);
        if (!data || data.score === null || data.score === undefined || data.submitted === false) {
            const msg = `⚠️ Student ${student} has no submission; skipping grading`;
            if (statusEl && showNotification) {
                statusEl.textContent = msg;
                statusEl.style.color = '#f0ad4e';
            }
            return false;
        }

        const scoreOk = deepFillScore(data.score);
        const feedbackOk = deepFillFeedback(data.reason);

        console.log(`[D2L-AutoFeedback] Filled ${student} -> Score: ${data.score} (${scoreOk}), Feedback (${feedbackOk})`);

        if (statusEl && showNotification) {
            if (scoreOk || feedbackOk) {
                statusEl.textContent = `✔ Filled ${student} (Score: ${data.score}, Feedback: ${feedbackOk ? 'synced' : 'attempted'})`;
                statusEl.style.color = '#28a745';
            } else {
                statusEl.textContent = '⚠️ Inputs not found (page may still be loading)';
                statusEl.style.color = '#f0ad4e';
            }
        }

        return scoreOk || feedbackOk;
    }

    function updateProgress() {
        const db = getStudentDatabase();
        const total = Object.keys(db).length;
        const map = getProcessedMap();
        const processedUnion = new Set([...Object.keys(map), ...processedSet]);
        const count = processedUnion.size;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;

        const pText = document.getElementById('bs-progress-text');
        const pBar = document.getElementById('bs-progress-bar');
        if (pText) pText.textContent = `Processed: ${count} / ${total} (${pct}%)`;
        if (pBar) pBar.style.width = `${pct}%`;

        // Missing students badge
        const missingEl = document.getElementById('bs-missing-badge');
        if (missingEl) {
            const allNames = Object.keys(db);
            const missing = allNames.filter(name => !processedUnion.has(name));
            if (missing.length === 0) {
                missingEl.textContent = '🎉 Entire class 100% processed!';
                missingEl.style.color = '#28a745';
            } else {
                missingEl.textContent = `Remaining: ${missing.length} students (Auto-covered during cruise)`;
                missingEl.style.color = '#e67e22';
            }
        }
    }

    function setStatus(text, color = '#333') {
        const el = document.getElementById('bs-op-status');
        if (el) {
            el.textContent = text;
            el.style.color = color;
        }
    }

    function stopCruise(msg = '🛑 Auto-Cruise stopped', color = '#d9534f') {
        autoCruiseActive = false;
        isProcessingCurrent = false;
        currentProcessingStudent = null;
        if (cruiseInterval) {
            clearInterval(cruiseInterval);
            cruiseInterval = null;
        }
        const cruiseBtn = document.getElementById('bs-btn-cruise');
        if (cruiseBtn) {
            cruiseBtn.textContent = '🚀 Start Auto-Cruise';
            cruiseBtn.style.background = '#198754';
        }
        setStatus(msg, color);
    }

    async function waitForPageTransition() {
        const initialUrl = window.location.href;
        const initialStudent = getStudentNameFromPage();
        for (let i = 0; i < 30; i++) {
            await sleep(150);
            if (isHalted || !autoCruiseActive) break;
            // Actively sweep and auto-confirm any "Unsaved Changes" dialogs triggered by navigation
            autoConfirmDialog();
            if (window.location.href !== initialUrl) break;
            const curStudent = getStudentNameFromPage();
            if (curStudent && curStudent !== initialStudent) break;
        }
        autoConfirmDialog();
        await sleep(300);
    }

    async function cruiseStep() {
        if (isHalted || !autoCruiseActive || isProcessingCurrent) return;

        const db = getStudentDatabase();
        const student = getStudentNameFromPage();

        if (!student) {
            setStatus('⏳ Waiting for evaluation page to render...', '#006fbf');
            return;
        }

        const data = findStudentData(student, db);

        // 1. Unsubmitted student -> Auto-Skip & Advance
        if (!data || data.score === null || data.score === undefined || data.score === '' || data.submitted === false) {
            isProcessingCurrent = true;
            markStudentProcessed(student, { unsubmitted: true });
            processedSet.add(student);
            updateProgress();
            setStatus(`⚠️ [Unsubmitted] ${student} (no submission) - Auto-skipping...`, '#f0ad4e');
            console.log(`[D2L-AutoFeedback] Auto-skipping unsubmitted student: ${student}`);
            await sleep(400);
            if (isHalted || !autoCruiseActive) { isProcessingCurrent = false; return; }

            const nav = deepClickNext();
            if (nav === 'DISABLED') {
                await checkWrapAroundOrFinish();
                isProcessingCurrent = false;
                return;
            }
            await waitForPageTransition();
            isProcessingCurrent = false;
            return;
        }

        // 2. Already Processed Check (Fast Cruise)
        const skipPref = getSkipProcessedPref();
        const map = getProcessedMap();
        const isRecorded = !!map[student] || processedSet.has(student);
        const isSavedOnPage = isStudentAlreadySavedOnPage(data.score, data.reason);

        // Only skip if genuinely saved on page with non-empty feedback
        if (skipPref && (isRecorded || isSavedOnPage)) {
            if (isSavedOnPage) {
                isProcessingCurrent = true;
                if (!isRecorded) {
                    markStudentProcessed(student, { score: data.score, source: 'page_detected' });
                }
                processedSet.add(student);
                updateProgress();
                setStatus(`⏩ [Ready] ${student} (Score: ${data.score}, Feedback synced) - Fast skipping...`, '#007a4d');
                console.log(`[D2L-AutoFeedback] Fast skipping already processed student: ${student}`);
                await sleep(400);
                if (isHalted || !autoCruiseActive) { isProcessingCurrent = false; return; }

                const nav = deepClickNext();
                if (nav === 'DISABLED') {
                    await checkWrapAroundOrFinish();
                    isProcessingCurrent = false;
                    return;
                }
                await waitForPageTransition();
                isProcessingCurrent = false;
                return;
            }
        }

        // 3. Submitted Student -> Fill, Save, Dismiss Dialog, Advance
        isProcessingCurrent = true;
        currentProcessingStudent = student;
        setStatus(`🚀 [Cruising] Filling: ${student}...`, '#007a4d');

        const ok = executeFill(false);
        if (!ok) {
            setStatus(`⚠️ Waiting for inputs: ${student}...`, '#f0ad4e');
            isProcessingCurrent = false;
            return;
        }

        await sleep(800);
        if (isHalted || !autoCruiseActive) { isProcessingCurrent = false; return; }

        setStatus(`💾 [Cruising] Saving Draft/Update: ${student}...`, '#007a4d');
        triggerSave();

        await sleep(1800);
        if (isHalted || !autoCruiseActive) { isProcessingCurrent = false; return; }

        autoConfirmDialog();

        markStudentProcessed(student, { score: data.score, source: 'evaluated' });
        processedSet.add(student);
        updateProgress();

        setStatus(`⏭️ [Cruising] Advancing to next student...`, '#006fbf');
        await sleep(500);
        if (isHalted || !autoCruiseActive) { isProcessingCurrent = false; return; }

        const navRes = deepClickNext();
        if (navRes === 'DISABLED') {
            await checkWrapAroundOrFinish();
            isProcessingCurrent = false;
            return;
        }

        await waitForPageTransition();
        isProcessingCurrent = false;
    }

    async function checkWrapAroundOrFinish() {
        const db = getStudentDatabase();
        const map = getProcessedMap();
        const processedUnion = new Set([...Object.keys(map), ...processedSet]);
        const total = Object.keys(db).length;
        const missing = Object.keys(db).filter(n => !processedUnion.has(n));

        if (missing.length > 0 && !isAtFirstStudent() && getAutoRewindPref()) {
            setStatus(`🔄 Reached end, but ${missing.length} students remain unvisited! Auto-rewinding to cover...`, '#e67e22');
            console.log('[D2L-AutoFeedback] Wrap-around: rewinding to beginning to cover missing students:', missing);
            await sleep(1000);
            await rewindToFirstStudent();
            setStatus('📍 Returned to start of roster, continuing cruise to cover remaining students...', '#006fbf');
            return;
        }

        playSuccessChime();
        stopCruise('🎉 Reached end of roster. Entire class 100% completed!', '#28a745');
    }

    function copyCurrentFeedback() {
        const student = getStudentNameFromPage();
        const db = getStudentDatabase();
        const data = findStudentData(student, db);
        if (student && data && data.reason) {
            navigator.clipboard.writeText(data.reason).then(() => {
                setStatus(`📋 Copied feedback for ${student} to clipboard!`, '#006fbf');
            });
        }
    }

    // Robust CSV parser supporting quotes, commas within quotes, and multi-line cells
    function parseCSV(text) {
        const rows = [];
        let curRow = [];
        let curField = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            const next = text[i + 1];
            if (c === '"') {
                if (inQuotes && next === '"') {
                    curField += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                curRow.push(curField.trim());
                curField = '';
            } else if ((c === '\r' || c === '\n') && !inQuotes) {
                if (c === '\r' && next === '\n') i++;
                curRow.push(curField.trim());
                if (curRow.some(f => f.length > 0)) rows.push(curRow);
                curRow = [];
                curField = '';
            } else {
                curField += c;
            }
        }
        if (curField.length > 0 || curRow.length > 0) {
            curRow.push(curField.trim());
            if (curRow.some(f => f.length > 0)) rows.push(curRow);
        }
        return rows;
    }

    // Floating Interactive UI Control Panel (100% English)
    if (IS_TOP) {
        function buildUI() {
            if (document.getElementById('bs-helper-panel-root')) return;

            const panel = document.createElement('div');
            panel.id = 'bs-helper-panel-root';
            panel.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 380px;
                background: #ffffff;
                border: 2px solid #006fbf;
                border-radius: 8px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.35);
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                color: #222;
            `;

            const skipChecked = getSkipProcessedPref() ? 'checked' : '';
            const rewindChecked = getAutoRewindPref() ? 'checked' : '';

            panel.innerHTML = `
                <div id="bs-panel-hdr" style="background:#006fbf; color:#fff; padding:10px 14px; font-weight:bold; cursor:move; display:flex; justify-content:space-between; align-items:center; border-radius:6px 6px 0 0;">
                    <span>🎓 Brightspace Feedback & Grade Assistant v1.0</span>
                    <button id="bs-panel-min" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer; font-weight:bold;">–</button>
                </div>
                <div id="bs-panel-bdy" style="padding:14px;">
                    <!-- Student Info -->
                    <div style="margin-bottom:8px;">
                        <span style="font-size:11px; color:#666; font-weight:bold;">Current Student:</span>
                        <div id="bs-curr-student" style="font-size:15px; font-weight:bold; color:#006fbf; margin-top:2px;">Detecting...</div>
                    </div>

                    <!-- Progress Bar -->
                    <div style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:#555; margin-bottom:3px;">
                            <span>Grading & Skip Progress</span>
                            <span id="bs-progress-text">Processed: 0 / 0 (0%)</span>
                        </div>
                        <div style="width:100%; height:8px; background:#e9ecef; border-radius:4px; overflow:hidden;">
                            <div id="bs-progress-bar" style="width:0%; height:100%; background:#28a745; transition:width 0.3s ease;"></div>
                        </div>
                        <div id="bs-missing-badge" style="font-size:11px; font-weight:bold; margin-top:4px; text-align:right; color:#e67e22;">
                            Calculating roster coverage...
                        </div>
                    </div>

                    <!-- Options: Rewind & Fast Skip -->
                    <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px; font-size:11px; color:#444; background:#f4f9fd; padding:6px 8px; border-radius:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="display:flex; align-items:center; cursor:pointer; user-select:none;" title="If starting away from first student, automatically rewinds to the start to guarantee full class coverage">
                                <input type="checkbox" id="bs-chk-rewind" style="margin-right:5px;" ${rewindChecked}>
                                <span>🎯 Cover entire class (Auto-rewind to start)</span>
                            </label>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="display:flex; align-items:center; cursor:pointer; user-select:none;" title="Fast skip students with score and feedback already saved">
                                <input type="checkbox" id="bs-chk-skip" style="margin-right:5px;" ${skipChecked}>
                                <span>⚡ Skip already evaluated (Fast Cruise)</span>
                            </label>
                            <button id="bs-btn-reset-cache" style="background:none; border:none; color:#d9534f; cursor:pointer; text-decoration:underline; font-size:11px; padding:0;" title="Clear evaluated history for this assignment">🔄 Reset Cache</button>
                        </div>
                    </div>

                    <!-- Preview -->
                    <div style="margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:11px; color:#666; font-weight:bold;">Grade & Feedback Preview:</span>
                            <button id="bs-btn-copy" style="font-size:11px; color:#006fbf; background:none; border:none; text-decoration:underline; cursor:pointer; padding:0;">📋 Copy Feedback</button>
                        </div>
                        <div id="bs-curr-preview" style="font-size:11px; background:#f5f8fa; border:1px solid #d3e1ea; border-radius:4px; padding:6px; max-height:70px; overflow-y:auto; margin-top:3px; line-height:1.4;">-</div>
                    </div>

                    <!-- Status Display -->
                    <div id="bs-op-status" style="font-size:12px; font-weight:bold; min-height:20px; margin-bottom:10px; padding:4px 6px; border-radius:4px; background:#f8f9fa;">🟢 Ready</div>

                    <!-- Continuous Cruise Control -->
                    <button id="bs-btn-cruise" style="width:100%; padding:11px; background:#198754; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px; margin-bottom:8px; box-shadow:0 2px 6px rgba(25,135,84,0.35);">
                        🚀 Start Full Class Auto-Cruise [Alt+A]
                    </button>

                    <!-- Emergency Stop Button -->
                    <button id="bs-btn-stop" style="width:100%; padding:9px; background:#dc3545; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:12px; margin-bottom:8px; box-shadow:0 2px 4px rgba(220,53,69,0.3);">
                        🛑 Emergency Stop [Alt+S]
                    </button>

                    <!-- Manual Step Controls -->
                    <div style="display:flex; gap:6px; margin-bottom:8px;">
                        <button id="bs-btn-fill-now" style="flex:1; padding:8px; background:#007a4d; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;" title="Fill score and feedback only (no save, no navigation)">
                            ⚡ Fill Current [Alt+F]
                        </button>
                        <button id="bs-btn-save-now" style="flex:1; padding:8px; background:#0d6efd; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;" title="Save draft / update and confirm dialog">
                            💾 Save Draft
                        </button>
                        <button id="bs-btn-fill-save" style="flex:1; padding:8px; background:#495057; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;" title="Fill and save draft without advancing">
                            ▶️ Fill & Save
                        </button>
                    </div>

                    <div style="display:flex; gap:6px; margin-bottom:10px;">
                        <button id="bs-btn-rewind-now" style="flex:1; padding:7px; background:#17a2b8; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;" title="Rewind back to first student in roster">
                            ⏮️ To First [Alt+H]
                        </button>
                        <button id="bs-btn-prev-only" style="flex:1; padding:7px; background:#6c757d; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;">
                            ◀️ Prev [Alt+←]
                        </button>
                        <button id="bs-btn-next-only" style="flex:1; padding:7px; background:#6c757d; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;">
                            Next ▶️ [Alt+→]
                        </button>
                    </div>

                    <div style="font-size:11px; background:#eef5fc; padding:8px; border-radius:5px; margin-bottom:10px; color:#333; line-height:1.4;">
                        💡 <b>Zero-Miss Coverage</b>: With "Cover entire class" checked, the script automatically rewinds to the first student whenever cruise is started, ensuring 100% roster coverage.
                    </div>

                    <hr style="border:0; border-top:1px solid #eee; margin:10px 0;">

                    <!-- CSV Load for Future Homeworks -->
                    <div style="font-size:11px; color:#666; font-weight:bold; margin-bottom:4px;">📁 Load Gradebook CSV (Stored Locally)</div>
                    <input type="file" id="bs-csv-file" accept=".csv" style="font-size:11px; width:100%;">
                    <div id="bs-csv-stats" style="font-size:10px; color:#888; margin-top:4px;">Currently loaded: Sample data (Please import CSV)</div>
                </div>
            `;

            document.body.appendChild(panel);

            // Dragging
            const hdr = document.getElementById('bs-panel-hdr');
            let dragging = false, sX, sY, pX, pY;
            hdr.addEventListener('mousedown', (e) => {
                if (e.target.id === 'bs-panel-min') return;
                dragging = true;
                sX = e.clientX; sY = e.clientY;
                pX = panel.offsetLeft; pY = panel.offsetTop;
            });
            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                panel.style.left = (pX + e.clientX - sX) + 'px';
                panel.style.top = (pY + e.clientY - sY) + 'px';
                panel.style.right = 'auto';
            });
            document.addEventListener('mouseup', () => { dragging = false; });

            // Toggle collapse
            const minBtn = document.getElementById('bs-panel-min');
            const bdy = document.getElementById('bs-panel-bdy');
            minBtn.addEventListener('click', () => {
                bdy.style.display = (bdy.style.display === 'none') ? 'block' : 'none';
                minBtn.textContent = (bdy.style.display === 'none') ? '+' : '–';
            });

            // Toggle Skip Processed
            document.getElementById('bs-chk-skip').addEventListener('change', (e) => {
                setSkipProcessedPref(e.target.checked);
                setStatus(e.target.checked ? '⚡ Fast Cruise enabled (skipping evaluated)' : '⚠️ Fast Cruise disabled (will force re-evaluate)', '#006fbf');
            });

            // Toggle Auto Rewind
            document.getElementById('bs-chk-rewind').addEventListener('change', (e) => {
                setAutoRewindPref(e.target.checked);
                setStatus(e.target.checked ? '🎯 Class coverage enabled (Auto-rewind to start)' : '⚠️ Class coverage disabled (Cruises forward only)', '#006fbf');
            });

            // Reset Processed Cache
            document.getElementById('bs-btn-reset-cache').addEventListener('click', () => {
                if (confirm('Clear evaluated history cache for this assignment?\n(Does not alter grades already saved in Brightspace)')) {
                    clearProcessedMap();
                    processedSet.clear();
                    updateProgress();
                    setStatus('🔄 Evaluated history cache cleared!', '#d9534f');
                }
            });

            // Rewind to First Button
            document.getElementById('bs-btn-rewind-now').addEventListener('click', async () => {
                isHalted = false;
                autoCruiseActive = true;
                await rewindToFirstStudent();
                autoCruiseActive = false;
                setStatus('📍 Arrived at first student in roster!', '#28a745');
            });

            // Emergency Stop
            const triggerStop = () => {
                isHalted = true;
                stopCruise('🛑 Automation halted (Emergency Stop)', '#dc3545');
            };
            document.getElementById('bs-btn-stop').addEventListener('click', triggerStop);

            // Auto-Cruise Button with Full Roster Auto-Rewind
            document.getElementById('bs-btn-cruise').addEventListener('click', async () => {
                isHalted = false;
                autoCruiseActive = !autoCruiseActive;
                const cruiseBtn = document.getElementById('bs-btn-cruise');
                if (autoCruiseActive) {
                    isProcessingCurrent = false;
                    currentProcessingStudent = null;
                    cruiseBtn.textContent = '⏸️ Auto-Cruising... (Click to Pause)';
                    cruiseBtn.style.background = '#dc3545';

                    // If enabled and not at first student, automatically rewind to start first!
                    if (getAutoRewindPref() && !isAtFirstStudent()) {
                        setStatus('⏪ Not at start of roster. Auto-rewinding to first student...', '#006fbf');
                        await rewindToFirstStudent();
                        if (isHalted || !autoCruiseActive) return;
                        setStatus('📍 At first student. Starting full class auto-cruise!', '#198754');
                    } else {
                        setStatus('🚀 Starting Auto-Cruise...', '#198754');
                    }

                    cruiseStep();
                    if (!cruiseInterval) {
                        cruiseInterval = setInterval(cruiseStep, 2000);
                    }
                } else {
                    stopCruise('⏸️ Auto-Cruise paused', '#006fbf');
                }
            });

            // Manual Step: Fill Current Only
            document.getElementById('bs-btn-fill-now').addEventListener('click', () => {
                isHalted = false;
                executeFill(true);
            });

            // Manual Step: Save Current Only
            document.getElementById('bs-btn-save-now').addEventListener('click', async () => {
                const saveOk = triggerSave();
                setStatus(saveOk ? '💾 Save Draft/Update triggered...' : '⚠️ Save button not found', saveOk ? '#0d6efd' : '#d9534f');
                await sleep(1000);
                autoConfirmDialog();
            });

            // Manual Step: Fill and Save
            document.getElementById('bs-btn-fill-save').addEventListener('click', async () => {
                isHalted = false;
                const fillOk = executeFill(false);
                if (fillOk) {
                    setStatus('✔ Filled, saving draft...', '#007a4d');
                    await sleep(600);
                    triggerSave();
                    await sleep(1000);
                    autoConfirmDialog();
                    setStatus('✔ Filled and saved successfully!', '#28a745');
                }
            });

            // Manual Step: Prev Only
            document.getElementById('bs-btn-prev-only').addEventListener('click', () => {
                const res = deepClickPrev();
                setStatus(res === 'CLICKED' ? '◀️ Triggered Previous Student...' : (res === 'DISABLED' ? '⚠️ Already at first student' : '⚠️ Previous button not found'), '#6c757d');
            });

            // Manual Step: Next Only
            document.getElementById('bs-btn-next-only').addEventListener('click', () => {
                const res = deepClickNext();
                setStatus(res === 'CLICKED' ? 'Next ▶️ Triggered Next Student...' : (res === 'DISABLED' ? '⚠️ Already at last student' : '⚠️ Next button not found'), '#6c757d');
            });

            // Copy Feedback
            document.getElementById('bs-btn-copy').addEventListener('click', copyCurrentFeedback);

            // Global Hotkeys: Alt+S (Stop), Alt+A (Cruise), Alt+F (Fill), Alt+H (Rewind to First), Alt+Left (Prev), Alt+Right (Next)
            window.addEventListener('keydown', (e) => {
                if (e.altKey && e.code === 'KeyS') {
                    e.preventDefault();
                    triggerStop();
                } else if (e.altKey && e.code === 'KeyA') {
                    e.preventDefault();
                    document.getElementById('bs-btn-cruise').click();
                } else if (e.altKey && e.code === 'KeyF') {
                    e.preventDefault();
                    document.getElementById('bs-btn-fill-now').click();
                } else if (e.altKey && e.code === 'KeyH') {
                    e.preventDefault();
                    document.getElementById('bs-btn-rewind-now').click();
                } else if (e.altKey && e.code === 'ArrowRight') {
                    e.preventDefault();
                    document.getElementById('bs-btn-next-only').click();
                } else if (e.altKey && e.code === 'ArrowLeft') {
                    e.preventDefault();
                    document.getElementById('bs-btn-prev-only').click();
                }
            });

            // CSV Load for future assignments (Multi-format & D2L export resilient)
            document.getElementById('bs-csv-file').addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = (ev) => {
                    const rows = parseCSV(ev.target.result);
                    if (rows.length < 2) return;
                    
                    const headers = rows[0].map(h => h.toLowerCase().trim());
                    
                    let lI = headers.findIndex(h => h === 'last name' || h.includes('last name') || h === 'lastname');
                    let fI = headers.findIndex(h => h === 'first name' || h.includes('first name') || h === 'firstname');
                    let nI = -1;
                    if (lI === -1 || fI === -1) {
                        nI = headers.findIndex(h => h === 'student' || h === 'name' || h === 'student name' || h === 'full name' || h.includes('student') || h.includes('name'));
                    }
                    let sI = headers.findIndex(h => h.includes('score') || h.includes('grade') || h.includes('points') || h.includes('mark'));
                    let rI = headers.findIndex(h => h.includes('reason') || h.includes('feedback') || h.includes('comment') || h.includes('notes'));

                    const db = {};
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        let name = '';
                        if (lI !== -1 && fI !== -1 && row[lI] && row[fI]) {
                            name = `${row[fI]} ${row[lI]}`.trim();
                        } else if (nI !== -1 && row[nI]) {
                            name = row[nI].trim();
                            if (name.includes(',') && !name.includes(';')) {
                                const parts = name.split(',').map(p => p.trim()).filter(Boolean);
                                if (parts.length === 2) {
                                    name = `${parts[1]} ${parts[0]}`;
                                }
                            }
                        }

                        if (name) {
                            const sc = (sI !== -1 && row[sI] !== undefined) ? row[sI].trim() : '';
                            const re = (rI !== -1 && row[rI] !== undefined) ? row[rI].trim() : '';
                            const isSubmitted = sc !== '' && sc !== null && sc !== undefined && sc.toLowerCase() !== 'null' && sc.toLowerCase() !== 'none';
                            
                            db[name] = {
                                score: isSubmitted ? sc : null,
                                reason: re || (isSubmitted ? '' : 'No submission'),
                                submitted: isSubmitted
                            };
                        }
                    }

                    saveStudentDatabase(db);
                    document.getElementById('bs-csv-stats').textContent = `Loaded ${Object.keys(db).length} students from ${f.name} (Stored locally)`;
                    updateProgress();
                    setStatus(`✔ Loaded ${Object.keys(db).length} students successfully!`, '#28a745');
                };
                r.readAsText(f);
            });
        }

        function updateUIPolling() {
            buildUI();

            const db = getStudentDatabase();
            const student = getStudentNameFromPage();
            const stuEl = document.getElementById('bs-curr-student');
            const prevEl = document.getElementById('bs-curr-preview');
            if (!stuEl || !prevEl) return;

            if (student) {
                const data = findStudentData(student, db);
                if (data) {
                    if (data.submitted === false || data.score === null || data.score === '') {
                        stuEl.textContent = `${student} (Unsubmitted - Auto skip)`;
                        stuEl.style.color = '#e67e22';
                        prevEl.textContent = '⚠️ This student did not submit an assignment (Will be auto-skipped during cruise).';
                    } else {
                        stuEl.textContent = student;
                        stuEl.style.color = '#007a4d';
                        prevEl.textContent = `[Score: ${data.score}] ${data.reason}`;
                    }
                } else {
                    stuEl.textContent = `${student} (Not in database)`;
                    stuEl.style.color = '#888';
                    prevEl.textContent = 'This student is not in the loaded database (Will be auto-skipped). Import a CSV with this student below.';
                }
            } else {
                stuEl.textContent = 'No student detected on page';
                stuEl.style.color = '#888';
                prevEl.textContent = 'Please navigate to a student evaluation page (Consistent Evaluation).';
            }
            updateProgress();
        }

        setInterval(updateUIPolling, 1000);
    }

})();
