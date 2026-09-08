const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

class MemoryStorage {
    constructor() { this.values = new Map(); this.failWrites = false; }
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { if (this.failWrites) throw new Error('Storage unavailable'); this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
    clear() { this.values.clear(); }
    get length() { return this.values.size; }
    key(i) { return [...this.values.keys()][i] ?? null; }
}

function createHarness(options = {}) {
    const url = options.url || 'https://fixture.invalid/d2l/le/activities/iterator/1?ou=42&iteratorId=7&student=001';
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {url, runScripts: 'outside-only', pretendToBeVisual: true});
    const w = dom.window;
    const local = options.local || new MemoryStorage(), session = options.session || new MemoryStorage();
    Object.defineProperty(w, 'localStorage', {value: local});
    Object.defineProperty(w, 'sessionStorage', {value: session});
    w.HTMLElement.prototype.getClientRects = function() { return this.isConnected ? [{}] : []; };
    Object.defineProperty(w.performance, 'getEntriesByType', {value: () => [{type: options.navigationType || 'navigate'}]});

    let now = local.clockTime || 1800000000000, counter = 0;
    const timers = new Map();
    w.Date.now = () => now;
    w.setTimeout = (fn, ms = 0) => { const id = ++counter; timers.set(id, {fn, at: now + Number(ms)}); return id; };
    w.clearTimeout = id => timers.delete(id);
    const flush = async () => { await new Promise(setImmediate); };
    const advance = async milliseconds => {
        const end = now + milliseconds;
        await flush();
        for (;;) {
            const entries = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at);
            if (!entries.length) break;
            const [id, timer] = entries[0]; now = timer.at; timers.delete(id); timer.fn(); await flush();
        }
        now = end; local.clockTime = now; await flush();
    };

    w.document.body.innerHTML = '<d2l-consistent-evaluation-header></d2l-consistent-evaluation-header>' +
        '<div data-user-id="not-an-org-id"></div>' +
        '<d2l-input-number id="d2l-grade" label="Overall Grade" max="100"></d2l-input-number>' +
        '<d2l-consistent-evaluation-right-panel-feedback><d2l-htmleditor></d2l-htmleditor></d2l-consistent-evaluation-right-panel-feedback>' +
        '<d2l-rubric><d2l-htmleditor></d2l-htmleditor><d2l-input-number label="Rubric criterion"></d2l-input-number></d2l-rubric>' +
        '<button id="native-save">Save Draft</button><button id="native-previous" aria-label="Previous Student" disabled>Previous</button>' +
        '<button id="native-next" aria-label="Next Student">Next</button><button hidden>Update</button>' +
        '<div id="bs-helper-panel-root"><div id="bs-op-status"></div><button id="bs-btn-cruise"></button>' +
        '<div id="bs-progress-text"></div><div id="bs-progress-bar"></div><div id="bs-missing-badge"></div></div>';
    const grade = w.document.getElementById('d2l-grade');
    grade.attachShadow({mode: 'open'}).innerHTML = '<input type="number" max="100">';
    Object.defineProperty(grade, 'value', {get() { return grade.shadowRoot.querySelector('input').value; },
        set(value) { grade.shadowRoot.querySelector('input').value = value ?? ''; }});
    grade.value = options.score ?? '';
    const editor = w.document.querySelector('d2l-consistent-evaluation-right-panel-feedback d2l-htmleditor');
    const rubric = w.document.querySelector('d2l-rubric d2l-htmleditor');
    for (const el of [editor, rubric]) {
        el.attachShadow({mode: 'open'}).innerHTML = '<div class="editor-content"></div>';
        Object.defineProperty(el, 'html', {get() { return el.shadowRoot.querySelector('div').innerHTML; },
            set(value) { el.shadowRoot.querySelector('div').innerHTML = value; }});
    }
    editor.html = options.feedback || '';
    rubric.html = '<p>Keep this rubric feedback</p>';
    const h = {dom, w, local, session, advance, flush, grade, editor, rubric, reloads: 0, saveClicks: 0, nextClicks: 0, previousClicks: 0};
    h.setStudent = (name, id, changeUrl = false) => {
        w.document.title = 'Assignment Evaluation - ' + name + ' - Fixture Homework';
        const header = w.document.querySelector('d2l-consistent-evaluation-header');
        header.textContent = 'Evaluation for ' + name + ' on Fixture Homework';
        if (id) header.setAttribute('data-org-defined-id', id); else header.removeAttribute('data-org-defined-id');
        if (changeUrl) { const next = new URL(w.location.href); next.searchParams.set('student', id || name); w.history.pushState({}, '', next); }
    };
    h.setStudent(options.name || 'Alice Smith', options.orgId === undefined ? '001' : options.orgId);
    h.signal = text => { const el = w.document.createElement('div'); el.setAttribute('role', 'status'); el.textContent = text; w.document.body.append(el); return el; };
    h.save = w.document.getElementById('native-save');
    h.next = w.document.getElementById('native-next');
    h.previous = w.document.getElementById('native-previous');
    h.save.addEventListener('click', () => { h.saveClicks++; h.onSave?.(); });
    h.next.addEventListener('click', () => { h.nextClicks++; h.onNext?.(); });
    h.previous.addEventListener('click', () => { h.previousClicks++; h.onPrevious?.(); });
    w.__reload = () => { h.reloads++; };
    const source = fs.readFileSync(path.join(__dirname, '../brightspace_auto_feedback_injector.user.js'), 'utf8');
    // Execute the complete production core, substituting only the platform reload primitive
    // and suppressing panel mounting. Real panel handlers/reload are exercised in the browser fixture.
    const exports = ['parseCSV', 'parseGradebookCSV', 'saveStudentDatabase', 'getStudentDatabase', 'getDatabaseRevision',
        'getProcessedMap', 'getAssignmentContextKey', 'clearAllAssignmentData', 'findStudentData', 'pageIdentity',
        'deepQuery', 'feedbackControl', 'overallGradeControl', 'formatFeedbackHtml', 'beginOperation', 'captureTarget',
        'executeFill', 'manualAction', 'startCruise', 'cruiseStep', 'runCruise', 'navigateStudent', 'rewindToFirstStudent',
        'stopCruise', 'restorePendingReadback', 'progressSummary', 'readbackMatches', 'loadCSVFile'];
    const marker = '    // Floating Interactive UI';
    if (!source.includes(marker) || !source.includes('window.location.reload();')) throw new Error('Harness integration marker missing');
    w.eval(source.replace('window.location.reload();', 'window.__reload();')
        .replace('if (IS_TOP) {', 'if (false) {')
        .replace(marker, '    window.__api = {' + exports.join(',') + ', operation: () => activeOperation};\n' + marker));
    h.api = w.__api;
    h.importCSV = text => h.api.saveStudentDatabase(h.api.parseGradebookCSV(text));
    h.status = () => w.document.getElementById('bs-op-status').textContent;
    h.close = () => { h.api.stopCruise(); w.close(); };
    return h;
}

module.exports = {createHarness, MemoryStorage};
