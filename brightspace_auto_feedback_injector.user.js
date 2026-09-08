// ==UserScript==
// @name         Brightspace (D2L) CSV Grade & Feedback Auto-Filler
// @namespace    https://github.com/quang-Ivan/brightspace-grade-assistant
// @version      1.0.4
// @description  A time-saving tool for TAs: fill Brightspace assignment grades and personalized feedback from CSV. Free, open-source, and no third-party uploads.
// @author       quang-Ivan
// @license      MIT
// @homepageURL  https://quang-ivan.github.io/brightspace-grade-assistant/
// @supportURL   https://github.com/quang-Ivan/brightspace-grade-assistant/issues
// @match        *://*/d2l/*
// @match        *://*/*activities/iterator/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const IS_TOP = window.self === window.top;
    const SCHEMA_VERSION = 2;
    const PENDING_KEY = 'd2l_pending_draft_readback_v2';
    const READBACK_TTL = 120000;
    const MIN_ROSTER_CAPACITY = 1000;
    const PAGE_INSTANCE = makeRevision();
    let activeRunToken = 0;
    let activeOperation = null;
    let isHalted = true;
    let restoreStarted = false;
    let locallyEditedTarget = null;

    function makeRevision() {
        return typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    // Retain the existing query/path repair; unknown/duplicate scope must not share a cache.
    function getAssignmentContextKey() {
        try {
            const url = new URL(window.location.href);
            const one = key => {
                const values = url.searchParams.getAll(key);
                if (values.length > 1) throw new Error('Duplicate context parameter');
                return values[0] || null;
            };
            const ou = one('ou');
            const ids = ['iteratorId', 'db', 'folderId'].map(one).filter(Boolean);
            if (new Set(ids).size > 1) return null;
            const path = url.pathname.match(/iterator\/(\d+)(?:\/|$)/);
            const iter = ids[0] || (path ? path[1] : null);
            if (!ou || !iter || !/^\d+$/.test(ou) || !/^\d+$/.test(iter)) return null;
            return 'ou' + ou + '_assign' + iter;
        } catch (_) { return null; }
    }

    function readGradebook() {
        const ctx = getAssignmentContextKey();
        if (!ctx) return null;
        try {
            const value = JSON.parse(localStorage.getItem('d2l_auto_eval_db_' + ctx));
            if (value && value.schemaVersion === SCHEMA_VERSION && typeof value.revision === 'string' &&
                value.students && typeof value.students === 'object' && !Array.isArray(value.students)) return value;
        } catch (_) {}
        return null;
    }

    function getStudentDatabase() {
        return readGradebook()?.students || {};
    }

    function getDatabaseRevision() {
        return readGradebook()?.revision || null;
    }

    function saveStudentDatabase(students) {
        const ctx = getAssignmentContextKey();
        if (!ctx) throw new Error('Course/assignment context is not identified.');
        const value = {schemaVersion: SCHEMA_VERSION, revision: makeRevision(), students};
        localStorage.setItem('d2l_auto_eval_db_' + ctx, JSON.stringify(value));
        return value;
    }

    function getProgressState() {
        const ctx = getAssignmentContextKey();
        const revision = getDatabaseRevision();
        if (!ctx || !revision) return {};
        try {
            const value = JSON.parse(localStorage.getItem('d2l_processed_map_' + ctx));
            return value && value.schemaVersion === SCHEMA_VERSION && value.revision === revision
                ? value : {};
        } catch (_) { return {}; }
    }

    function getProcessedMap() { return getProgressState().records || {}; }

    function saveProgressState(progress) {
        const ctx = getAssignmentContextKey(), revision = getDatabaseRevision();
        if (!ctx || !revision) throw new Error('Import a CSV for this assignment before recording progress.');
        localStorage.setItem('d2l_processed_map_' + ctx, JSON.stringify({
            ...progress, schemaVersion: SCHEMA_VERSION, revision
        }));
    }

    function recordFingerprint(data) {
        return JSON.stringify([data.score, data.reason || '', data.submitted]);
    }

    function markStudentProcessed(key, details) {
        const db = getStudentDatabase();
        if (!Object.hasOwn(db, key)) throw new Error('Cannot record a student outside this CSV.');
        const progress = getProgressState();
        const records = progress.records || {};
        records[key] = {...details, fingerprint: recordFingerprint(db[key]), timestamp: Date.now()};
        saveProgressState({...progress, records});
    }

    function markOutsideCsv(target) {
        const progress = getProgressState();
        const outsideCsv = progress.outsideCsv || {};
        const key = target.orgId ? 'id:' + target.orgId : 'name:' + target.name;
        if (outsideCsv[key]) return;
        outsideCsv[key] = true;
        saveProgressState({...progress, outsideCsv});
    }

    function clearProcessedMap() {
        const ctx = getAssignmentContextKey();
        if (ctx) localStorage.removeItem('d2l_processed_map_' + ctx);
    }

    function clearAllAssignmentData() {
        stopCruise('Assignment cache cleared.');
        const ctx = getAssignmentContextKey();
        if (ctx) {
            localStorage.removeItem('d2l_auto_eval_db_' + ctx);
            localStorage.removeItem('d2l_processed_map_' + ctx);
        }
        for (const key of ['d2l_auto_eval_db_public', 'd2l_evaluation_map_public', 'd2l_processed_students_public']) {
            localStorage.removeItem(key);
        }
    }

    function getPreference(key, fallback = true) {
        try { const value = localStorage.getItem(key); return value === null ? fallback : value === 'true'; }
        catch (_) { return fallback; }
    }
    function getSkipProcessedPref() { return getPreference('d2l_skip_processed_pref'); }
    function getAutoRewindPref() { return getPreference('d2l_auto_rewind_pref'); }
    function setSkipProcessedPref(value) { localStorage.setItem('d2l_skip_processed_pref', String(value)); }
    function setAutoRewindPref(value) { localStorage.setItem('d2l_auto_rewind_pref', String(value)); }

    function normalizeName(value) {
        let name = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
        const parts = name.split(',').map(p => p.trim());
        if (parts.length === 2 && parts.every(Boolean)) name = parts[1] + ' ' + parts[0];
        return name.toLowerCase();
    }
    function normalizeOrgId(value) { return String(value || '').trim().replace(/^#/, '').trim(); }

    function findStudentData(studentName, db, studentOrgId = null) {
        const entries = Object.entries(db || {});
        const name = normalizeName(studentName);
        const byName = entries.filter(([key, data]) => normalizeName(data.name || key) === name && name);
        const wrap = ([key, data]) => ({...data, key, name: data.name || key});
        if (studentOrgId) {
            const id = normalizeOrgId(studentOrgId);
            const byId = entries.filter(([, data]) => data.orgId && normalizeOrgId(data.orgId) === id);
            if (byId.length > 1) return {ambiguous: true, error: 'Duplicate OrgDefinedId.'};
            if (!byId.length) return byName.length
                ? {ambiguous: true, error: 'Page name matches a CSV row, but its OrgDefinedId conflicts.'} : null;
            if (byName.length && !byName.some(([key]) => key === byId[0][0])) {
                return {ambiguous: true, error: 'Page name and OrgDefinedId identify different CSV records.'};
            }
            return {...wrap(byId[0]), matchedBy: 'OrgDefinedId'};
        }
        if (byName.length > 1) return {ambiguous: true, error: 'Name is not unique; a verified page OrgDefinedId is required.'};
        return byName.length === 1 ? {...wrap(byName[0]), matchedBy: 'unique name'} : null;
    }

    function deepQuery(selector, root = document) {
        const matches = new Set();
        const roots = new Set();
        function walk(scope) {
            if (!scope || roots.has(scope)) return;
            roots.add(scope);
            try {
                for (const el of scope.querySelectorAll(selector)) matches.add(el);
                if (scope.shadowRoot) walk(scope.shadowRoot);
                for (const el of scope.querySelectorAll('*')) {
                    if (el.id === 'bs-helper-panel-root' || el.closest?.('#bs-helper-panel-root')) continue;
                    if (el.shadowRoot) walk(el.shadowRoot);
                    if (el.tagName === 'IFRAME') {
                        try { walk(el.contentDocument); } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        walk(root);
        return [...matches].filter(el => !el.closest?.('#bs-helper-panel-root') && el.id !== 'bs-helper-panel-root');
    }

    function getComposedParent(node) {
        if (!node) return null;
        if (node.parentElement) return node.parentElement;
        const root = node.getRootNode?.();
        if (root?.host) return root.host;
        try { return root?.defaultView?.frameElement || null; } catch (_) { return null; }
    }

    function hasRubricAncestor(el) {
        for (let cur = el; cur; cur = getComposedParent(cur)) {
            const hint = (cur.tagName || '') + ' ' + (typeof cur.className === 'string' ? cur.className : '');
            if (/rubric|criterion/i.test(hint)) return true;
        }
        return false;
    }

    function isVisible(el) {
        if (!el || el.isConnected === false) return false;
        for (let cur = el; cur; cur = getComposedParent(cur)) {
            if (cur.hidden || cur.getAttribute?.('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(cur);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        return el.getClientRects().length > 0;
    }

    function pageIdentity() {
        const title = (document.title || '').split(/\s+-\s+/);
        let name = title.length >= 3 && /assignment evaluation/i.test(title[0]) ? title[1].trim() : null;
        const names = new Set(name ? [normalizeName(name)] : []);
        const headers = deepQuery('d2l-consistent-evaluation-header, .d2l-consistent-evaluation-user-details').filter(isVisible);
        const ids = new Set();
        const add = value => { if (normalizeOrgId(value)) ids.add(normalizeOrgId(value)); };
        for (const header of headers) {
            const elements = [header, ...deepQuery('[data-org-defined-id], [data-orgdefinedid]', header)];
            for (const el of elements) {
                add(el.getAttribute('data-org-defined-id'));
                add(el.getAttribute('data-orgdefinedid'));
            }
            const text = header.textContent || '';
            const idMatch = text.match(/Org\s*Defined\s*ID\s*[:#]?\s*([A-Za-z0-9_-]+)/i);
            if (idMatch) add(idMatch[1]);
            const nameMatch = text.match(/Evaluation for\s+([^\n\r]+?)(?:\s+on\s+|$)/i);
            if (nameMatch) {
                names.add(normalizeName(nameMatch[1]));
                if (!name) name = nameMatch[1].trim();
            }
        }
        return {name, orgId: ids.size === 1 ? [...ids][0] : null,
            error: ids.size > 1 ? 'Conflicting OrgDefinedId values in the evaluation header.'
                : names.size > 1 ? 'Conflicting student names in the page title and evaluation header.' : null};
    }
    function getStudentNameFromPage() { return pageIdentity().name; }
    function getStudentOrgIdFromPage() { return pageIdentity().orgId; }

    function isOverallGradeElement(el) {
        if (hasRubricAncestor(el)) return false;
        const label = (el.getAttribute('label') || el.getAttribute('aria-label') || '').toLowerCase().trim();
        return el.id === 'd2l-grade' || label === 'overall grade' || label === 'overall score';
    }

    function overallGradeControl() {
        let matches = deepQuery('#d2l-grade, d2l-input-number, input[aria-label="Overall Grade"], input[aria-label="Overall Score"]')
            .filter(el => isVisible(el) && isOverallGradeElement(el));
        matches = matches.filter(el => !matches.some(other => other !== el && composedContains(other, el)));
        if (matches.length !== 1) throw new Error('Expected one unambiguous Overall Grade control.');
        return matches[0];
    }

    function composedContains(parent, child) {
        for (let cur = getComposedParent(child); cur; cur = getComposedParent(cur)) if (cur === parent) return true;
        return false;
    }

    function feedbackControl() {
        const panels = deepQuery('d2l-consistent-evaluation-right-panel-feedback').filter(el => isVisible(el) && !hasRubricAncestor(el));
        if (panels.length > 1) throw new Error('Multiple Overall Feedback panels; no feedback was written.');
        const panel = panels[0] || null;
        const selector = panel ? 'd2l-htmleditor' : 'd2l-htmleditor[aria-label="Overall Feedback"], d2l-htmleditor[label="Overall Feedback"]';
        const editors = deepQuery(selector, panel || document).filter(el => isVisible(el) && !hasRubricAncestor(el));
        if (editors.length > 1) throw new Error('Multiple Overall Feedback editors; no feedback was written.');
        const editor = editors[0] || null;
        if (editor) {
            const iframes = deepQuery('iframe.tox-edit-area__iframe, iframe[id*="_ifr"]', editor);
            if (iframes.length > 1) throw new Error('Multiple editor frames; no feedback was written.');
            return {panel, editor, iframe: iframes[0] || null, textarea: null};
        }
        const textareas = deepQuery('textarea[aria-label="Overall Feedback"], textarea[name="overallFeedback"]', panel || document)
            .filter(el => isVisible(el) && !hasRubricAncestor(el));
        if (textareas.length !== 1) throw new Error('Expected one scoped Overall Feedback editor.');
        return {panel, editor: null, iframe: null, textarea: textareas[0]};
    }

    function escapeHtml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function formatFeedbackHtml(plainText) {
        return '<p>' + escapeHtml(plainText || '').replace(/\r?\n/g, '<br>') + '</p>';
    }
    function normalizeFeedback(text) { return String(text || '').replace(/\s+/g, ' ').trim(); }
    function feedbackText(control) {
        if (control.textarea) return control.textarea.value;
        const tiny = window.tinymce?.get(control.editor._editorId);
        const html = tiny ? tiny.getContent() : control.editor.html ?? control.iframe?.contentDocument?.body?.innerHTML;
        if (typeof html !== 'string') throw new Error('Overall Feedback has not loaded.');
        const template = document.createElement('template');
        template.innerHTML = html.replace(/<br\s*\/?>|<\/(?:p|div|li)>/gi, '\n');
        return template.content.textContent || '';
    }

    function scoreValue(control) {
        const input = control.tagName === 'INPUT' ? control : deepQuery('input', control)[0];
        const raw = control.value ?? input?.value;
        if (raw === '' || raw === null || raw === undefined) return null;
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error('Overall Grade is not a finite number.');
        return value;
    }

    function expectedFor(data) {
        return {score: String(data.score), reason: data.reason || '', checkFeedback: !!data.reason?.trim()};
    }

    function readbackMatches(expected) {
        const score = scoreValue(overallGradeControl());
        if (score === null || Math.abs(score - Number(expected.score)) > 0.0000001) return false;
        return !expected.checkFeedback || normalizeFeedback(feedbackText(feedbackControl())) === normalizeFeedback(expected.reason);
    }

    function assertScoreFits(control, score) {
        const number = Number(score);
        if (!/^\d+(\.\d+)?$/.test(String(score)) || !Number.isFinite(number) || number < 0) throw new Error('Invalid score.');
        const input = control.tagName === 'INPUT' ? control : deepQuery('input', control)[0];
        for (const el of [control, input].filter(Boolean)) {
            const max = el.getAttribute('max');
            if (max !== null && max !== '' && Number.isFinite(Number(max)) && number > Number(max)) {
                throw new Error('Score exceeds the current Overall Grade maximum.');
            }
        }
    }

    function deepFillScore(score, op, target, control = overallGradeControl()) {
        if (!guardTarget(op, target)) return false;
        assertScoreFits(control, score);
        control.value = Number(score);
        for (const input of deepQuery('input', control)) {
            if (!guardTarget(op, target)) return false;
            input.value = String(score);
            input.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
            if (!guardTarget(op, target)) return false;
            input.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
        }
        if (!guardTarget(op, target)) return false;
        control.dispatchEvent(new CustomEvent('change', {bubbles: true, composed: true}));
        return guardTarget(op, target) && scoreValue(control) === Number(score);
    }

    function deepFillFeedback(text, op, target, control = feedbackControl()) {
        if (!guardTarget(op, target)) return false;
        const html = formatFeedbackHtml(text);
        if (control.textarea) {
            control.textarea.value = text;
            control.textarea.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
            if (!guardTarget(op, target)) return false;
            control.textarea.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
        } else {
            const editor = control.editor;
            editor.html = html;
            editor.isDirty = true;
            const tiny = window.tinymce?.get(editor._editorId);
            if (tiny) {
                tiny.setContent(html);
                tiny.save();
                for (const event of ['change', 'input', 'blur']) {
                    if (!guardTarget(op, target)) return false;
                    tiny.fire(event);
                }
            } else if (control.iframe?.contentDocument?.body) {
                control.iframe.contentDocument.body.innerHTML = html;
            }
            if (!guardTarget(op, target)) return false;
            // Compatibility bridge is restricted to the single resolved Overall Feedback panel.
            if (control.panel && '_feedbackText' in control.panel) control.panel._feedbackText = html;
            for (const event of ['input', 'change', 'd2l-htmleditor-blur']) {
                if (!guardTarget(op, target)) return false;
                editor.dispatchEvent(new CustomEvent(event, {bubbles: true, composed: true}));
            }
        }
        return guardTarget(op, target) && normalizeFeedback(feedbackText(control)) === normalizeFeedback(text);
    }

    function setStatus(text, color = '#333') {
        const el = document.getElementById('bs-op-status');
        if (el) { el.textContent = text; el.style.color = color; }
    }

    function stopCruise(message = 'Stopped. No further automated actions.', color = '#d9534f') {
        activeRunToken++;
        isHalted = true;
        activeOperation?.controller.abort();
        activeOperation = null;
        try { sessionStorage.removeItem(PENDING_KEY); } catch (_) {}
        const button = document.getElementById('bs-btn-cruise');
        if (button) { button.textContent = 'Start Auto-Cruise [Alt+A]'; button.style.background = '#198754'; }
        setStatus(message, color);
    }

    function beginOperation(mode) {
        stopCruise();
        const ctx = getAssignmentContextKey();
        if (!ctx) throw new Error('Cannot identify course and assignment. No action taken.');
        const op = {token: activeRunToken, ctx, revision: getDatabaseRevision(), mode,
            controller: new AbortController(), wraps: 0, hops: 0};
        activeOperation = op;
        isHalted = false;
        return op;
    }

    function ownsOperation(op) {
        return !!op && activeOperation === op && op.token === activeRunToken && !isHalted && !op.controller.signal.aborted;
    }

    function guardOperation(op) {
        if (!ownsOperation(op)) return false;
        if (getAssignmentContextKey() !== op.ctx || getDatabaseRevision() !== op.revision) {
            stopCruise('Course, assignment, or imported CSV changed. Paused.');
            return false;
        }
        return true;
    }

    function captureTarget(op, requireRow = true) {
        if (!guardOperation(op)) throw new Error('Operation is no longer current.');
        const identity = pageIdentity();
        if (identity.error) throw new Error(identity.error);
        if (!identity.name && !identity.orgId) throw new Error('Current student has not been identified.');
        const db = getStudentDatabase();
        const data = Object.keys(db).length ? findStudentData(identity.name, db, identity.orgId) : null;
        if (data?.ambiguous) throw new Error(data.error);
        if (requireRow && !data) throw new Error('Current student is not in this CSV; not classified as unsubmitted.');
        return {ctx: op.ctx, url: window.location.href, name: normalizeName(identity.name),
            orgId: identity.orgId, key: data?.key || null, data};
    }

    function targetMatches(target) {
        const current = pageIdentity();
        return !current.error && getAssignmentContextKey() === target.ctx && window.location.href === target.url &&
            normalizeName(current.name) === target.name && current.orgId === target.orgId;
    }

    function guardTarget(op, target) {
        if (!guardOperation(op)) return false;
        if (!targetMatches(target)) {
            stopCruise('Target student/page changed. Paused before the next action.');
            return false;
        }
        return true;
    }

    function pauseOnError(op, error) {
        if (ownsOperation(op)) stopCruise(error.message || String(error));
    }

    function finishOperation(op, text) {
        if (guardOperation(op)) stopCruise(text, '#198754');
    }

    function delay(ms, op) {
        if (!guardOperation(op)) return Promise.resolve(false);
        return new Promise(resolve => {
            const done = result => { clearTimeout(timer); op.controller.signal.removeEventListener('abort', abort); resolve(result); };
            const abort = () => done(false);
            const timer = setTimeout(() => done(guardOperation(op)), ms);
            op.controller.signal.addEventListener('abort', abort, {once: true});
        });
    }

    function buttonLabel(button) {
        return (button.getAttribute('text') || button.getAttribute('aria-label') || button.textContent || '')
            .trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function buttons() {
        let result = deepQuery('d2l-button, button, [role="button"]').filter(el => isVisible(el) && !hasRubricAncestor(el));
        return result.filter(el => !result.some(parent => parent !== el && composedContains(parent, el) && parent.tagName === 'D2L-BUTTON'));
    }

    function isDisabled(button) {
        return !!button.disabled || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';
    }

    function assertNoDialog() {
        if (deepQuery('d2l-dialog-confirm, d2l-dialog, [role="alertdialog"], [role="dialog"], .d2l-dialog')
            .some(el => isVisible(el) && (el.opened || el.hasAttribute('opened') || !el.tagName.toLowerCase().startsWith('d2l-')))) {
            throw new Error('A dialog requires your review. No automatic confirmation was clicked.');
        }
    }

    function saveDraftButton() {
        assertNoDialog();
        const all = buttons();
        if (all.some(button => buttonLabel(button) === 'update')) {
            throw new Error('An Update action is present. Published evaluations are not modified.');
        }
        const matches = all.filter(button => buttonLabel(button) === 'save draft');
        if (matches.length !== 1 || isDisabled(matches[0])) throw new Error('One enabled Save Draft button is required.');
        return matches[0];
    }

    function triggerSave(op, target) {
        if (!guardTarget(op, target)) return false;
        const button = saveDraftButton();
        if (!guardTarget(op, target)) return false;
        button.click();
        return true; // Clicked only: never interpreted as a completed save.
    }

    function nativeSignals() {
        return deepQuery('d2l-alert-toast, d2l-alert, [role="status"], [role="alert"]').filter(isVisible)
            .map(node => ({node, text: normalizeFeedback((node.textContent || '') + ' ' + (node.shadowRoot?.textContent || '')).toLowerCase()}));
    }

    async function waitForSaveAcknowledgement(op, target, previous) {
        for (let i = 0; i < 60; i++) {
            if (!guardTarget(op, target)) return false;
            assertNoDialog();
            for (const {node, text} of nativeSignals()) {
                if (/\b(error|failed|unable|invalid|could not|cannot)\b/.test(text)) throw new Error('Brightspace reports: ' + text);
                const fresh = !previous.has(node) || previous.get(node) !== text;
                const success = /\b(draft saved|saved as draft|evaluation saved|feedback saved|changes saved|saved successfully)\b/.test(text);
                if (fresh && success && !/\b(not|unsaved|fail|error|publish)\b/.test(text)) return true;
            }
            if (!await delay(200, op)) return false;
        }
        throw new Error('No fresh native save acknowledgment. Save may have occurred; verify it manually before retrying.');
    }

    async function executeFill(op, target) {
        if (!guardTarget(op, target)) return false;
        assertNoDialog();
        const data = target.data;
        if (!data || data.submitted === false || data.score === null) throw new Error('This CSV row is explicitly unsubmitted; no grade is filled.');
        const expected = expectedFor(data);
        // Resolve every requested control before changing either one.
        const grade = overallGradeControl();
        const feedback = expected.checkFeedback ? feedbackControl() : null;
        assertScoreFits(grade, expected.score);
        // The native editor may clear isDirty during its change event. Remember our own writes.
        locallyEditedTarget = target;
        if (!deepFillScore(expected.score, op, target, grade)) throw new Error('Overall Grade did not accept the value.');
        if (feedback && !deepFillFeedback(expected.reason, op, target, feedback)) throw new Error('Overall Feedback did not accept the text.');
        return guardTarget(op, target) && readbackMatches(expected);
    }

    async function saveAndVerify(op, target, expected) {
        if (!guardTarget(op, target)) return false;
        if (!readbackMatches(expected)) throw new Error('Values changed before saving. Paused.');
        saveDraftButton(); // Preflight before creating recovery state or clicking.
        // Test storage before sending a save; readback cannot safely resume without it.
        const pending = {schemaVersion: SCHEMA_VERSION, stage: 'waiting_ack', pageInstance: PAGE_INSTANCE,
            createdAt: Date.now(), ctx: op.ctx, revision: op.revision, mode: op.mode,
            wraps: op.wraps, hops: op.hops,
            target: {ctx: target.ctx, url: target.url, name: target.name, orgId: target.orgId, key: target.key}, expected};
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        const previous = new Map(nativeSignals().map(signal => [signal.node, signal.text]));
        if (!triggerSave(op, target)) return false;
        setStatus('Save Draft requested. Waiting for native confirmation...', '#006fbf');
        if (!await waitForSaveAcknowledgement(op, target, previous) || !guardTarget(op, target)) return false;
        if (!readbackMatches(expected)) throw new Error('Values changed during saving. Completion was not recorded.');
        pending.stage = 'readback';
        pending.createdAt = Date.now();
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        setStatus('Save acknowledged. Reloading this student to verify stored values...', '#006fbf');
        window.location.reload();
        delay(15000, op).then(current => {
            if (current && guardOperation(op)) stopCruise('Page reload did not complete. No verification was recorded.');
        });
        // Do not advance in this document. A new document must perform the readback.
        return 'reload';
    }

    function navigationButton(direction) {
        // Brightspace can show both a header arrow and a footer student button.
        const all = buttons();
        for (const label of [direction + ' student', direction]) {
            const matches = all.filter(button => buttonLabel(button) === label);
            if (matches.length > 1) throw new Error('Multiple ' + label + ' buttons.');
            if (matches.length === 1) return matches[0];
        }
        throw new Error('Expected one ' + direction + ' student button.');
    }

    function isAtFirstStudent() { return isDisabled(navigationButton('previous')); }

    async function navigateStudent(op, direction) {
        if (!guardOperation(op)) return false;
        assertNoDialog();
        const target = captureTarget(op, false);
        const button = navigationButton(direction);
        if (isDisabled(button)) return 'end';
        if (!guardTarget(op, target)) return false;
        // A partial CSV can cover a few students in a much longer roster.
        if (++op.hops > Math.max(MIN_ROSTER_CAPACITY, Object.keys(getStudentDatabase()).length) * 7 + 10) {
            throw new Error('Navigation limit reached. Review roster/filter before restarting.');
        }
        button.click();
        let lastIdentity = null;
        for (let i = 0; i < 60; i++) {
            if (!await delay(150, op)) return false;
            assertNoDialog();
            const current = pageIdentity();
            if (current.error) throw new Error(current.error);
            const identity = normalizeName(current.name) + '|' + (current.orgId || '');
            const changed = identity !== target.name + '|' + (target.orgId || '');
            if ((current.name || current.orgId) && changed) {
                if (lastIdentity === identity && !deepQuery('[aria-busy="true"], d2l-loading-spinner').some(isVisible)) return true;
                lastIdentity = identity;
            } else { lastIdentity = null; }
        }
        throw new Error('Student navigation did not finish. No grade was filled on the next page.');
    }

    async function rewindToFirstStudent(op) {
        const cap = Math.max(MIN_ROSTER_CAPACITY, Object.keys(getStudentDatabase()).length) + 5;
        for (let step = 0; step < cap; step++) {
            if (!guardOperation(op)) return false;
            if (isAtFirstStudent()) return true;
            const result = await navigateStudent(op, 'previous');
            if (!result || !guardOperation(op)) return false;
            if (result === 'end') return true;
        }
        throw new Error('Could not reach the start of the roster within the navigation limit.');
    }

    function completedRecord(key, data) {
        const record = getProcessedMap()[key];
        if (!record || record.fingerprint !== recordFingerprint(data)) return false;
        return data.submitted === false ? record.state === 'unsubmitted'
            : (record.state === 'verified' && record.verification === 'reload_readback') ||
                (record.state === 'matched' && record.verification === 'page_readback');
    }

    function progressSummary() {
        const entries = Object.entries(getStudentDatabase());
        const records = getProcessedMap();
        const verified = entries.filter(([key, data]) => data.submitted !== false && completedRecord(key, data) && records[key].state === 'verified').length;
        const matched = entries.filter(([key, data]) => data.submitted !== false && completedRecord(key, data) && records[key].state === 'matched').length;
        const skipped = entries.filter(([key, data]) => data.submitted === false && completedRecord(key, data)).length;
        const submitted = entries.filter(([, data]) => data.submitted !== false).length;
        const outsideCsv = Object.keys(getProgressState().outsideCsv || {}).length;
        return {total: entries.length, submitted, verified, matched, skipped, outsideCsv,
            remaining: entries.filter(([key, data]) => !completedRecord(key, data)).map(([, data]) => data.name)};
    }

    function updateProgress() {
        const progress = progressSummary();
        const count = progress.verified + progress.matched + progress.skipped;
        const percent = progress.total ? Math.round(count / progress.total * 100) : 0;
        const text = document.getElementById('bs-progress-text');
        const bar = document.getElementById('bs-progress-bar');
        const badge = document.getElementById('bs-missing-badge');
        if (text) text.textContent = 'Drafts verified: ' + progress.verified + '; existing matched: ' + progress.matched + '; unsubmitted: ' + progress.skipped + '; outside CSV: ' + progress.outsideCsv;
        if (bar) bar.style.width = percent + '%';
        if (badge) {
            badge.textContent = progress.total ? progress.remaining.length + ' CSV row(s) remaining' : 'Import a CSV for this assignment.';
            badge.style.color = progress.total && !progress.remaining.length ? '#198754' : '#e67e22';
        }
    }

    function playSuccessChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => osc.frequency.setValueAtTime(note, ctx.currentTime + i * 0.12));
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc.onended = () => ctx.close();
            osc.start(); osc.stop(ctx.currentTime + 0.6);
        } catch (_) {}
    }

    async function cruiseStep(op) {
        if (!guardOperation(op)) return false;
        const target = captureTarget(op, false);
        const data = target.data;
        if (!data) {
            if (!guardTarget(op, target)) return false;
            markOutsideCsv(target);
            updateProgress();
            setStatus('Not in CSV: skipping this student without filling or saving.', '#006fbf');
            if (!await delay(200, op) || !guardTarget(op, target)) return false;
            return 'advance';
        }
        if (data.submitted === false) {
            if (!guardTarget(op, target)) return false;
            markStudentProcessed(data.key, {state: 'unsubmitted'});
            updateProgress();
            if (!await delay(200, op) || !guardTarget(op, target)) return false;
            return 'advance';
        }
        if (getSkipProcessedPref() && readbackMatches(expectedFor(data))) {
            assertNoDialog();
            const published = buttons().some(button => buttonLabel(button) === 'update');
            const editor = data.reason?.trim() ? feedbackControl().editor : null;
            const dirty = (locallyEditedTarget && targetMatches(locallyEditedTarget)) || editor?.isDirty === true ||
                window.tinymce?.get(editor?._editorId)?.isDirty?.() === true;
            if (!dirty && (published || completedRecord(data.key, data))) {
                if (!completedRecord(data.key, data)) {
                    markStudentProcessed(data.key, {state: 'matched', verification: 'page_readback'});
                    updateProgress();
                }
                if (!await delay(200, op) || !guardTarget(op, target)) return false;
                return 'advance';
            }
        }
        // Refuse unsupported/published save actions before changing fields.
        saveDraftButton();
        if (!await executeFill(op, target) || !guardTarget(op, target)) return false;
        if (!await delay(250, op) || !guardTarget(op, target)) return false;
        return saveAndVerify(op, target, expectedFor(data));
    }

    async function runCruise(op) {
        try {
            while (guardOperation(op)) {
                const step = await cruiseStep(op);
                if (step !== 'advance' || !guardOperation(op)) return;
                const navigation = await navigateStudent(op, 'next');
                if (!navigation || !guardOperation(op)) return;
                if (navigation === 'end') {
                    const progress = progressSummary();
                    if (!progress.remaining.length && progress.total) {
                        playSuccessChime();
                        finishOperation(op, 'CSV complete: ' + progress.verified + ' reload-verified drafts; ' + progress.matched + ' existing evaluations matched; ' + progress.skipped + ' explicitly unsubmitted; ' + progress.outsideCsv + ' outside CSV skipped.');
                        return;
                    }
                    if (!getAutoRewindPref() || op.wraps >= 2) throw new Error('CSV rows remain unverified: ' + progress.remaining.slice(0, 5).join(', '));
                    op.wraps++;
                    if (!await rewindToFirstStudent(op)) return;
                }
            }
        } catch (error) { pauseOnError(op, error); }
    }

    async function startCruise() {
        if (activeOperation?.mode === 'cruise') { stopCruise('Auto-Cruise paused.'); return; }
        let op;
        try {
            op = beginOperation('cruise');
            if (!Object.keys(getStudentDatabase()).length) throw new Error('Import a valid CSV before starting.');
            const button = document.getElementById('bs-btn-cruise');
            if (button) button.textContent = 'Pause Auto-Cruise [Alt+A]';
            setStatus('Auto-Cruise started; drafts require reload readback.', '#006fbf');
            if (getAutoRewindPref() && !await rewindToFirstStudent(op)) return;
            if (guardOperation(op)) await runCruise(op);
        } catch (error) { if (op) pauseOnError(op, error); else setStatus(error.message, '#d9534f'); }
    }

    async function manualAction(action) {
        let op;
        try {
            op = beginOperation('manual');
            if (action === 'first') {
                if (await rewindToFirstStudent(op)) finishOperation(op, 'At the first student.');
                return;
            }
            if (action === 'next' || action === 'previous') {
                const result = await navigateStudent(op, action);
                if (result) finishOperation(op, result === 'end' ? 'At the roster boundary.' : 'Navigation finished.');
                return;
            }
            const target = captureTarget(op, action !== 'save');
            let expected;
            if (action === 'save') {
                const score = scoreValue(overallGradeControl());
                if (score === null) throw new Error('No numeric Overall Grade is present.');
                expected = {score: String(score), reason: feedbackText(feedbackControl()), checkFeedback: true};
            } else {
                if (action === 'fill-save') saveDraftButton();
                if (!await executeFill(op, target)) return;
                expected = expectedFor(target.data);
            }
            if (!guardTarget(op, target)) return;
            if (action === 'fill') { finishOperation(op, 'Values filled only. This is not a verified save.'); return; }
            if (!await delay(250, op) || !guardTarget(op, target)) return;
            await saveAndVerify(op, target, expected);
        } catch (error) { if (op) pauseOnError(op, error); else setStatus(error.message, '#d9534f'); }
    }

    async function restorePendingReadback() {
        let pending;
        try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY)); }
        catch (_) { stopCruise('Pending readback could not be read; paused.'); return; }
        if (!pending) return;
        const navigationType = performance.getEntriesByType('navigation')[0]?.type;
        if (pending.schemaVersion !== SCHEMA_VERSION || pending.stage !== 'readback' ||
            pending.pageInstance === PAGE_INSTANCE || navigationType !== 'reload' ||
            Date.now() - pending.createdAt > READBACK_TTL || Date.now() < pending.createdAt ||
            pending.ctx !== getAssignmentContextKey() || pending.revision !== getDatabaseRevision() ||
            pending.target?.url !== window.location.href) {
            stopCruise('Pending save was not resumed: reload, context, CSV revision, or time limit did not match.');
            return;
        }
        const op = beginOperation(pending.mode === 'cruise' ? 'cruise' : 'manual');
        op.wraps = pending.wraps || 0; op.hops = pending.hops || 0;
        try {
            setStatus('Reading the reloaded evaluation; no values are being filled...', '#006fbf');
            let matches = 0;
            for (let i = 0; i < 60; i++) {
                if (!guardOperation(op)) return;
                const identity = pageIdentity();
                if (identity.error) throw new Error(identity.error);
                if (identity.name || identity.orgId) {
                    if (!guardTarget(op, pending.target)) return;
                    assertNoDialog();
                    try { matches = readbackMatches(pending.expected) ? matches + 1 : 0; }
                    catch (_) { matches = 0; } // Components can render after the page title.
                    if (matches >= 2) {
                        const data = getStudentDatabase()[pending.target.key];
                        if (data && data.submitted !== false &&
                            Number(data.score) === Number(pending.expected.score) &&
                            (!data.reason?.trim() || normalizeFeedback(data.reason) === normalizeFeedback(pending.expected.reason))) {
                            markStudentProcessed(pending.target.key, {state: 'verified', verification: 'reload_readback'});
                        }
                        updateProgress();
                        if (op.mode === 'cruise') {
                            if (!data || !completedRecord(pending.target.key, data)) throw new Error('Readback could not be reconciled to the CSV.');
                            // Resume at the next student, not by saving the just-verified draft again.
                            const navigation = await navigateStudent(op, 'next');
                            if (!navigation || !guardOperation(op)) return;
                            if (navigation === 'end') {
                                const progress = progressSummary();
                                if (!progress.remaining.length) {
                                    playSuccessChime();
                                    finishOperation(op, 'CSV complete: ' + progress.verified + ' reload-verified drafts; ' + progress.matched + ' existing evaluations matched; ' + progress.skipped + ' explicitly unsubmitted; ' + progress.outsideCsv + ' outside CSV skipped.');
                                    return;
                                }
                                if (!getAutoRewindPref() || op.wraps >= 2) throw new Error('CSV still has unverified students; review the roster/filter.');
                                op.wraps++;
                                if (!await rewindToFirstStudent(op)) return;
                            }
                            await runCruise(op);
                        } else { finishOperation(op, 'Draft save verified by reloading and reading the same student.'); }
                        return;
                    }
                }
                if (!await delay(250, op)) return;
            }
            throw new Error('Reloaded score/feedback did not match. Completion was not recorded; review this student.');
        } catch (error) { pauseOnError(op, error); }
    }

    function parseCSV(text) {
        const rows = [];
        let row = [], field = '', quoted = false, closed = false;
        text = String(text).replace(/^\uFEFF/, '');
        const pushField = () => { row.push(field); field = ''; closed = false; };
        const pushRow = () => { pushField(); if (row.some(value => value.trim())) rows.push(row); row = []; };
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (quoted) {
                if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
                else if (char === '"') { quoted = false; closed = true; }
                else field += char;
            } else if (char === ',') pushField();
            else if (char === '\n' || char === '\r') {
                if (char === '\r' && text[i + 1] === '\n') i++;
                pushRow();
            } else if (char === '"') {
                if (field.trim() || closed) throw new Error('Malformed CSV quote.');
                field = ''; quoted = true;
            } else if (closed) {
                if (!/\s/.test(char)) throw new Error('Unexpected text after a quoted CSV field.');
            } else field += char;
        }
        if (quoted) throw new Error('CSV has an unclosed quoted field.');
        if (field || row.length || closed) pushRow();
        return rows;
    }

    function parseGradebookCSV(text) {
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error('CSV must contain a header and at least one student.');
        const headers = rows[0].map(value => value.trim().toLowerCase());
        if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column headers.');
        const index = names => headers.findIndex(header => names.includes(header));
        const nameIndex = index(['student', 'name', 'student name', 'full name']);
        const firstIndex = index(['first name', 'firstname']);
        const lastIndex = index(['last name', 'lastname']);
        const idIndex = index(['orgdefinedid', 'org defined id']);
        const reasons = headers.map((header, i) => ({header, i})).filter(({header}) => ['reason', 'feedback', 'comments', 'notes'].includes(header));
        if (reasons.length > 1) throw new Error('CSV must have at most one unambiguous feedback column.');
        const reasonIndex = reasons[0]?.i ?? -1;
        const grades = headers.map((header, i) => ({header, i})).filter(({header}) =>
            ['score', 'grade', 'points', 'mark'].includes(header) || /^.+ points grade <numeric maxpoints:\d+(\.\d+)?>$/.test(header));
        if (grades.length !== 1) throw new Error('CSV needs exactly one unambiguous score/grade column. Export only the target grade item.');
        const scoreIndex = grades[0].i;
        const maxMatch = grades[0].header.match(/<numeric maxpoints:(\d+(?:\.\d+)?)>/);
        const max = maxMatch ? Number(maxMatch[1]) : null;
        if (max !== null && !Number.isFinite(max)) throw new Error('Invalid grade-item maximum.');
        if (nameIndex < 0 && (firstIndex < 0 || lastIndex < 0) && idIndex < 0) throw new Error('CSV needs student names or OrgDefinedId.');
        const db = Object.create(null);
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length !== headers.length) throw new Error('CSV row ' + (i + 1) + ' has the wrong number of columns.');
            const orgId = idIndex >= 0 ? normalizeOrgId(row[idIndex]) : null;
            if (idIndex >= 0 && !orgId) throw new Error('Missing OrgDefinedId on row ' + (i + 1) + '.');
            let name = nameIndex >= 0 ? row[nameIndex].trim() : '';
            if (firstIndex >= 0 && lastIndex >= 0) name = (row[firstIndex].trim() + ' ' + row[lastIndex].trim()).trim();
            if (!name && (nameIndex >= 0 || firstIndex >= 0 || lastIndex >= 0)) throw new Error('Missing student name on row ' + (i + 1) + '.');
            const key = orgId ? 'id:' + orgId : 'name:' + normalizeName(name);
            if (Object.hasOwn(db, key)) throw new Error('Duplicate student identity on row ' + (i + 1) + '. Import blocked without changing the current CSV.');
            const rawScore = row[scoreIndex].trim();
            const submitted = rawScore !== '';
            if (submitted && (!/^\d+(\.\d+)?$/.test(rawScore) || !Number.isFinite(Number(rawScore)))) {
                throw new Error('Invalid nonblank score on row ' + (i + 1) + '. Only an empty score means unsubmitted.');
            }
            if (submitted && max !== null && Number(rawScore) > max) throw new Error('Score exceeds the CSV grade-item maximum on row ' + (i + 1) + '.');
            db[key] = {name, orgId, score: submitted ? rawScore : null, submitted,
                reason: reasonIndex >= 0 ? row[reasonIndex].trim() : ''};
        }
        return db;
    }

    function loadCSVFile(event) {
        stopCruise('CSV import selected; previous operation cancelled.', '#006fbf');
        const file = event.target.files?.[0];
        if (!file) return;
        const ctx = getAssignmentContextKey(), revision = getDatabaseRevision(), token = activeRunToken;
        if (!ctx) { setStatus('Open an identified course/assignment before importing.', '#d9534f'); return; }
        if (file.size > 10 * 1024 * 1024) { setStatus('CSV exceeds the 10 MB import limit.', '#d9534f'); return; }
        const reader = new FileReader();
        const stillCurrent = () => token === activeRunToken && ctx === getAssignmentContextKey() && revision === getDatabaseRevision();
        reader.onload = event => {
            if (!stillCurrent()) return;
            try {
                const db = parseGradebookCSV(event.target.result);
                if (!stillCurrent()) return;
                // Validate the whole file before committing. New revision invalidates all old progress.
                saveStudentDatabase(db);
                clearProcessedMap();
                updateProgress();
                setStatus('Loaded ' + Object.keys(db).length + ' CSV rows. No grades were written.', '#198754');
            } catch (error) { setStatus('CSV import blocked: ' + error.message, '#d9534f'); }
        };
        reader.onerror = () => { if (stillCurrent()) setStatus('CSV could not be read. Existing data preserved.', '#d9534f'); };
        reader.readAsText(file);
    }

    function copyCurrentFeedback() {
        const identity = pageIdentity();
        const data = !identity.error && findStudentData(identity.name, getStudentDatabase(), identity.orgId);
        if (!data || data.ambiguous) { setStatus('Resolve the current student before copying.', '#d9534f'); return; }
        const token = activeRunToken;
        navigator.clipboard.writeText(data.reason || '').then(() => {
            if (token === activeRunToken) setStatus('Feedback copied.', '#006fbf');
        }).catch(() => { if (token === activeRunToken) setStatus('Clipboard permission denied.', '#d9534f'); });
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
                    <span>🎓 Brightspace CSV Grade & Feedback Auto-Filler v1.0.4</span>
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
                            <span>Reload Verification & Skip Progress</span>
                            <span id="bs-progress-text">Verified: 0 / 0</span>
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
                            <label style="display:flex; align-items:center; cursor:pointer; user-select:none;" title="If starting away from first student, automatically rewinds to the start and reconciles the imported CSV">
                                <input type="checkbox" id="bs-chk-rewind" style="margin-right:5px;" ${rewindChecked}>
                                <span>🎯 Cover entire class (Auto-rewind to start)</span>
                            </label>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="display:flex; align-items:center; cursor:pointer; user-select:none;" title="Skip matching published evaluations or reload-verified drafts; never treat this page's unsaved fill as saved">
                                <input type="checkbox" id="bs-chk-skip" style="margin-right:5px;" ${skipChecked}>
                                <span>⚡ Skip matching existing evaluations</span>
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
                        <button id="bs-btn-save-now" style="flex:1; padding:8px; background:#0d6efd; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:11px;" title="Save Draft, then reload to verify (never publishes)">
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
                        💡 <b>Draft verification</b>: Each save requires a fresh native acknowledgment and page reload readback. Students outside the CSV are skipped separately; identity conflicts pause the run. Completion covers only the imported CSV.
                    </div>

                    <hr style="border:0; border-top:1px solid #eee; margin:10px 0;">

                    <!-- CSV Load for Future Homeworks -->
                    <div style="font-size:11px; color:#666; font-weight:bold; margin-bottom:4px;">📁 Load Gradebook CSV (Stored Locally)</div>
                    <input type="file" id="bs-csv-file" accept=".csv" style="font-size:11px; width:100%;">
                    <div id="bs-csv-stats" style="font-size:10px; color:#888; margin-top:4px;">No CSV imported for this assignment</div>
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

            document.getElementById('bs-chk-skip').addEventListener('change', event => {
                stopCruise('Skip preference changed; automation paused.');
                setSkipProcessedPref(event.target.checked);
            });
            document.getElementById('bs-chk-rewind').addEventListener('change', event => {
                stopCruise('Rewind preference changed; automation paused.');
                setAutoRewindPref(event.target.checked);
            });
            document.getElementById('bs-btn-reset-cache').addEventListener('click', () => {
                stopCruise('Automation paused for cache reset.');
                if (confirm('Clear this assignment CSV and local verification history? Saved Brightspace grades are not changed.')) {
                    try { clearAllAssignmentData(); updateProgress(); }
                    catch (error) { setStatus('Cache reset failed: ' + error.message, '#d9534f'); }
                }
            });
            document.getElementById('bs-btn-stop').addEventListener('click', () => stopCruise('Stopped. A save already sent cannot be undone by Stop.'));
            document.getElementById('bs-btn-cruise').addEventListener('click', startCruise);
            for (const [id, action] of [
                ['bs-btn-fill-now', 'fill'], ['bs-btn-save-now', 'save'], ['bs-btn-fill-save', 'fill-save'],
                ['bs-btn-rewind-now', 'first'], ['bs-btn-prev-only', 'previous'], ['bs-btn-next-only', 'next']
            ]) document.getElementById(id).addEventListener('click', () => manualAction(action));
            document.getElementById('bs-btn-copy').addEventListener('click', copyCurrentFeedback);
            document.getElementById('bs-csv-file').addEventListener('change', loadCSVFile);
            window.addEventListener('keydown', event => {
                if (!event.altKey) return;
                const keys = {KeyS: 'bs-btn-stop', KeyA: 'bs-btn-cruise', KeyF: 'bs-btn-fill-now',
                    KeyH: 'bs-btn-rewind-now', ArrowLeft: 'bs-btn-prev-only', ArrowRight: 'bs-btn-next-only'};
                if (keys[event.code]) { event.preventDefault(); document.getElementById(keys[event.code]).click(); }
            });
        }

        function updateUIPolling() {
            buildUI();
            if (activeOperation) guardOperation(activeOperation);
            const identity = pageIdentity();
            const db = getStudentDatabase();
            const data = identity.error ? {ambiguous: true, error: identity.error} : findStudentData(identity.name, db, identity.orgId);
            const student = document.getElementById('bs-curr-student');
            const preview = document.getElementById('bs-curr-preview');
            if (student) student.textContent = identity.name || identity.orgId || 'No student identified';
            if (preview) {
                preview.textContent = data?.ambiguous ? data.error : !data ? 'No matching CSV row.'
                    : data.submitted === false ? 'Explicitly unsubmitted (blank score): no grade will be written.'
                    : '[' + data.matchedBy + '] Score: ' + data.score + ' | ' + (data.reason || '(score only)');
            }
            const stats = document.getElementById('bs-csv-stats');
            if (stats) stats.textContent = 'Current CSV: ' + Object.keys(db).length + ' rows | ' +
                (getAssignmentContextKey() || 'unknown assignment') + (getDatabaseRevision() ? '' : ' | Import required (old caches are not trusted)');
            updateProgress();
            if (!restoreStarted) { restoreStarted = true; restorePendingReadback(); }
        }

        updateUIPolling();
        setInterval(updateUIPolling, 1000);
    }
})();
