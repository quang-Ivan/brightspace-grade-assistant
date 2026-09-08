const test = require('node:test');
const assert = require('node:assert/strict');
const {createHarness, MemoryStorage} = require('./dom-harness.cjs');

const CSV = 'student,OrgDefinedId,score,reason\nAlice Smith,001,95,Good work';
const PENDING_KEY = 'd2l_pending_draft_readback_v2';
function fixture(t, options = {}) { const h = createHarness(options); t.after(() => h.close()); return h; }
function reader(h) {
    h.w.FileReader = class { readAsText(file) { this.onload({target: {result: file.text}}); } };
    return text => h.api.loadCSVFile({target: {files: [{size: text.length, text}]}});
}

test('production CSV parser preserves quotes, commas, line breaks and BOM; malformed input is rejected', t => {
    const h = fixture(t);
    const rows = h.api.parseCSV('\uFEFFstudent,score,reason\r\n"Alice, Smith",0,"A ""quote"",\nB"\r\n');
    assert.equal(rows[1][0], 'Alice, Smith');
    assert.equal(rows[1][2], 'A "quote",\nB');
    for (const text of ['student,score\nAlice,"95', 'student,score\nAlice,"95"oops', 'student,score\nAlice,9"5']) {
        assert.throws(() => h.api.parseCSV(text), /quote|quoted/);
    }
    assert.throws(() => h.api.parseGradebookCSV('student,score\nAlice,95,extra'), /number of columns/);
});

test('only empty scores mean unsubmitted; invalid nonblank or nonfinite values block import', t => {
    const h = fixture(t);
    for (const value of ['95abc', '0x10', '-10', '1e2', 'Infinity', 'NaN', 'null', 'none', '9'.repeat(400)]) {
        assert.throws(() => h.api.parseGradebookCSV('student,score\nAlice,' + value), /Invalid nonblank/);
    }
    const rows = h.api.parseGradebookCSV('student,score\nAlice,0\n\n,\nBob,\nCharlie,88.5');
    assert.equal(Object.keys(rows).length, 3);
    assert.equal(rows['name:alice'].submitted, true);
    assert.equal(rows['name:alice'].score, '0');
    assert.equal(rows['name:bob'].submitted, false);
    assert.equal(rows['name:charlie'].score, '88.5');
});

test('CSV grade columns and maxima must be unambiguous', t => {
    const h = fixture(t);
    assert.throws(() => h.api.parseGradebookCSV('student,score,grade\nAlice,8,9'), /exactly one/);
    assert.throws(() => h.api.parseGradebookCSV('student,Score,score\nAlice,8,9'), /Duplicate CSV/);
    assert.throws(() => h.api.parseGradebookCSV('student,score,reason,Feedback\nAlice,8,One,Other'), /unambiguous feedback/);
    assert.throws(() => h.api.parseGradebookCSV('student,Homework 1 Points Grade <Numeric MaxPoints:8>\nAlice,9'), /maximum/);
    assert.equal(h.api.parseGradebookCSV('OrgDefinedId,Homework 1 Points Grade <Numeric MaxPoints:8>\n#001,8')['id:001'].score, '8');
});

test('duplicate IDs and normalized name-only collisions block; equal names with distinct IDs are supported', t => {
    const h = fixture(t);
    assert.throws(() => h.api.parseGradebookCSV('student,OrgDefinedId,score\nAlice,001,8\nBob,#001,9'), /Duplicate student identity/);
    assert.throws(() => h.api.parseGradebookCSV('student,score\nAlice Smith,8\n"Smith, Alice",9'), /Duplicate student identity/);
    assert.throws(() => h.api.parseGradebookCSV('student,score\nALICE  SMITH,8\nalice smith,9'), /Duplicate student identity/);
    assert.throws(() => h.api.parseGradebookCSV('student,OrgDefinedId,score\nAlice,,8'), /Missing OrgDefinedId/);
    const db = h.api.parseGradebookCSV('student,OrgDefinedId,score\nAlex Smith,001,8\nAlex Smith,002,9');
    assert.equal(Object.keys(db).length, 2);
    assert.equal(h.api.findStudentData('Alex Smith', db, '002').score, '9');
    assert.equal(h.api.findStudentData('Alex Smith', db).ambiguous, true);
});

test('explicit page ID mismatch and conflicting name/ID never fall back silently', t => {
    const h = fixture(t);
    const db = h.api.parseGradebookCSV('student,OrgDefinedId,score\nAlice Smith,001,95\nBob Jones,002,77');
    assert.equal(h.api.findStudentData('Alice Smith', db, '999').ambiguous, true);
    assert.equal(h.api.findStudentData('Outside Student', db, '999'), null);
    assert.equal(h.api.findStudentData('Outside Student', db, null), null);
    assert.equal(h.api.findStudentData('Alice Smith', db, '002').ambiguous, true);
    assert.equal(h.api.findStudentData('Page Alias', db, '002').key, 'id:002');
    assert.equal(h.api.findStudentData('Alice Smith', db, null).matchedBy, 'unique name');
    db['id:002'].orgId = '001';
    assert.equal(h.api.findStudentData('Bob Jones', db, '001').ambiguous, true);
});

test('page identity ignores data-user-id and OrgDefinedId outside the evaluation header', t => {
    const h = fixture(t, {orgId: null});
    const outside = h.w.document.createElement('div'); outside.setAttribute('data-org-defined-id', '999'); h.w.document.body.append(outside);
    assert.equal(h.api.pageIdentity().orgId, null);
    const header = h.w.document.querySelector('d2l-consistent-evaluation-header');
    header.setAttribute('data-org-defined-id', '001');
    const conflict = h.w.document.createElement('span'); conflict.setAttribute('data-org-defined-id', '002'); header.append(conflict);
    assert.match(h.api.pageIdentity().error, /Conflicting/);
});

test('context preserves query/path repair and rejects unknown or conflicting scope', t => {
    const h = fixture(t);
    const cases = [
        ['/d2l/le/activities/iterator/1?notou=999&ou=100&iteratorId=22', 'ou100_assign22'],
        ['/d2l/lms/dropbox/admin/mark/?ou=100&db=33', 'ou100_assign33'],
        ['/d2l/le/activities/iterator/44?ou=100', 'ou100_assign44'],
        ['/d2l/home?ou=100', null],
        ['/d2l/le/activities/iterator/1?ou=100&ou=200', null],
        ['/d2l/le/activities/iterator/1?ou=100&db=2&folderId=3', null]
    ];
    for (const [path, expected] of cases) { h.w.history.replaceState({}, '', path); assert.equal(h.api.getAssignmentContextKey(), expected); }
});

test('conflicting title and evaluation-header names block all writes', async t => {
    const h = fixture(t); h.importCSV(CSV);
    h.w.document.title = 'Assignment Evaluation - Bob Jones - Fixture Homework';
    await h.api.manualAction('fill-save');
    assert.equal(h.grade.value, ''); assert.equal(h.saveClicks, 0);
    assert.match(h.status(), /Conflicting student names/);
});

test('no sample or legacy unverified cache becomes an active gradebook', t => {
    const h = fixture(t);
    assert.equal(Object.keys(h.api.getStudentDatabase()).length, 0);
    h.local.setItem('d2l_auto_eval_db_ou42_assign7', JSON.stringify({'Alice Smith': {score: 100}}));
    assert.equal(Object.keys(h.api.getStudentDatabase()).length, 0);
});

test('fill preflights unique controls and leaves rubric and unrelated feedback untouched', async t => {
    const h = fixture(t); h.importCSV('student,OrgDefinedId,score,reason\nAlice Smith,001,95,"x < y & z\n<script>alert(1)</script>"');
    const before = h.rubric.html;
    await h.api.manualAction('fill');
    assert.equal(h.grade.value, '95');
    assert.equal(h.rubric.html, before);
    assert.match(h.editor.html, /&lt;script&gt;/);
    assert.equal(h.editor.shadowRoot.querySelector('script'), null);
    assert.equal(h.saveClicks, 0);
    assert.equal(h.api.progressSummary().verified, 0);
    assert.match(h.status(), /not a verified save/);
    assert.equal(h.api.deepQuery('input', h.grade).length, 1);
});

test('ambiguous overall feedback prevents even the score write', async t => {
    const h = fixture(t); h.importCSV(CSV);
    const extra = h.w.document.createElement('d2l-htmleditor');
    h.editor.parentElement.append(extra);
    await h.api.manualAction('fill-save');
    assert.equal(h.grade.value, '');
    assert.equal(h.saveClicks, 0);
    assert.match(h.status(), /Multiple Overall Feedback/);
});

test('missing Save Draft and published Update do not fill or claim success', async t => {
    for (const mode of ['missing', 'published']) {
        const h = fixture(t); h.importCSV(CSV);
        if (mode === 'missing') h.save.remove(); else h.save.textContent = 'Update';
        await h.api.manualAction('fill-save');
        assert.equal(h.grade.value, '');
        assert.equal(h.saveClicks, 0);
        assert.doesNotMatch(h.status(), /success|verified by/);
        assert.equal(h.api.progressSummary().verified, 0);
    }
});

test('published/ambiguous/negative save labels cannot be selected as Save Draft', async t => {
    for (const label of ['Publish', "Don't save draft", 'Save draft and publish', 'Save', 'Proceed']) {
        const h = fixture(t); h.importCSV(CSV); h.save.textContent = label;
        await h.api.manualAction('fill-save');
        assert.equal(h.saveClicks, 0);
    }
    const h = fixture(t); h.importCSV(CSV);
    h.w.document.body.append(h.save.cloneNode(true));
    await h.api.manualAction('fill-save');
    assert.equal(h.saveClicks, 0);
});

test('fresh CSV fast-skips matching published values without saving, but mismatches and dirty feedback pause', async t => {
    for (const variant of ['matching', 'mismatch', 'dirty', 'filled-dirty-reset']) {
        const h = fixture(t, {score: 95, feedback: variant === 'mismatch' ? '<p>Old feedback</p>' : '<p>Good work</p>'});
        h.importCSV(CSV); h.save.textContent = 'Update'; h.editor.isDirty = variant === 'dirty';
        h.next.disabled = true;
        if (variant === 'filled-dirty-reset') {
            await h.api.manualAction('fill'); h.editor.isDirty = false;
        }
        const run = h.api.startCruise(); await h.advance(500); await run;
        assert.equal(h.saveClicks, 0); assert.equal(h.reloads, 0); assert.equal(h.api.progressSummary().verified, 0);
        assert.equal(h.api.progressSummary().matched, variant === 'matching' ? 1 : 0);
        assert.match(h.status(), variant === 'matching' ? /1 existing evaluations matched/ : /Published evaluations are not modified/);
    }
});

test('real Brightspace header and footer navigation uses the student-labelled button once', async t => {
    const h = fixture(t); h.importCSV(CSV);
    const headerNext = h.w.document.createElement('button'); headerNext.setAttribute('aria-label', 'Next');
    const headerPrevious = h.w.document.createElement('button'); headerPrevious.setAttribute('aria-label', 'Previous'); headerPrevious.disabled = true;
    h.w.document.body.append(headerNext, headerPrevious);
    let headerClicks = 0; headerNext.onclick = () => headerClicks++;
    h.onNext = () => h.setStudent('Bob Jones', '002', true);
    const run = h.api.manualAction('next'); await h.advance(1000); await run;
    assert.equal(h.nextClicks, 1); assert.equal(headerClicks, 0); assert.equal(h.saveClicks, 0);
    assert.match(h.status(), /Navigation finished/);
});

test('any open confirmation dialog pauses with no automatic button click', async t => {
    const h = fixture(t); h.importCSV(CSV);
    const dialog = h.w.document.createElement('div'); dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<p>Unsaved changes. Discard and leave?</p><button>Yes</button>';
    let clicks = 0; dialog.querySelector('button').onclick = () => clicks++;
    h.w.document.body.append(dialog);
    await h.api.manualAction('fill-save');
    assert.equal(clicks, 0); assert.equal(h.saveClicks, 0); assert.equal(h.grade.value, '');
});

test('Stop cancels delayed Fill & Save; Stop then restart cannot revive the old save', async t => {
    const h = fixture(t); h.importCSV(CSV);
    const old = h.api.manualAction('fill-save');
    await h.flush(); h.api.stopCruise();
    const current = h.api.manualAction('fill-save'); h.onSave = () => h.signal('Draft saved');
    await h.advance(1000); await Promise.all([old, current]);
    assert.equal(h.saveClicks, 1);
    assert.equal(h.reloads, 1);
    assert.equal(h.api.progressSummary().verified, 0);
});

test('Save Only stopped after the click does not react to a late acknowledgment/dialog', async t => {
    const h = fixture(t, {score: 12, feedback: '<p>Manual feedback</p>'});
    h.onSave = () => h.w.setTimeout(() => h.signal('Draft saved'), 1000);
    const operation = h.api.manualAction('save');
    await h.advance(300);
    assert.equal(h.saveClicks, 1);
    h.api.stopCruise();
    await h.advance(2000); await operation;
    assert.equal(h.reloads, 0);
    assert.equal(h.session.getItem(PENDING_KEY), null);
    assert.equal(h.api.progressSummary().verified, 0);
});

test('stale unsubmitted cruise branch does not navigate or stop a newly started operation', async t => {
    const h = fixture(t); h.importCSV('student,OrgDefinedId,score\nAlice Smith,001,');
    const oldOp = h.api.beginOperation('cruise'); const old = h.api.runCruise(oldOp);
    await h.flush(); h.api.stopCruise();
    const newOp = h.api.beginOperation('manual');
    await h.advance(1000); await old;
    assert.equal(h.nextClicks, 0);
    assert.equal(h.api.operation(), newOp);
});

test('rewind is cancelled across Stop/restart, including awaited navigation', async t => {
    const h = fixture(t); h.importCSV(CSV); h.previous.disabled = false;
    const op = h.api.beginOperation('cruise'); const old = h.api.rewindToFirstStudent(op);
    await h.flush(); assert.equal(h.previousClicks, 1);
    h.api.stopCruise(); const current = h.api.beginOperation('manual');
    await h.advance(1000); await old;
    assert.equal(h.previousClicks, 1); assert.equal(h.api.operation(), current);
});

test('target changes between fill and save halt before saving', async t => {
    const h = fixture(t); h.importCSV(CSV);
    const operation = h.api.manualAction('fill-save');
    await h.flush(); h.setStudent('Bob Jones', '002', true);
    await h.advance(1000); await operation;
    assert.equal(h.saveClicks, 0); assert.match(h.status(), /Target student\/page changed/);
});

test('course/CSV revision changes invalidate pending actions', async t => {
    for (const mode of ['context', 'csv']) {
        const h = fixture(t); h.importCSV(CSV);
        const operation = h.api.manualAction('fill-save'); await h.flush();
        if (mode === 'context') h.w.history.pushState({}, '', '/d2l/le/activities/iterator/1?ou=42&iteratorId=8&student=001');
        else h.importCSV(CSV.replace('95', '96'));
        await h.advance(1000); await operation;
        assert.equal(h.saveClicks, 0);
        assert.match(h.status(), /changed/);
    }
});

test('save click or a preexisting saved message is not enough to record completion', async t => {
    const h = fixture(t); h.importCSV(CSV); h.signal('Draft saved');
    const operation = h.api.manualAction('fill-save');
    await h.advance(13000); await operation;
    assert.equal(h.saveClicks, 1); assert.equal(h.reloads, 0);
    assert.equal(h.api.progressSummary().verified, 0);
    assert.match(h.status(), /No fresh native save acknowledgment/);
});

test('native save error and edits during acknowledgment prevent reload/completion', async t => {
    for (const mode of ['error', 'edit']) {
        const h = fixture(t); h.importCSV(CSV);
        h.onSave = () => { h.signal(mode === 'error' ? 'Save failed' : 'Draft saved'); if (mode === 'edit') h.grade.value = '88'; };
        const operation = h.api.manualAction('fill-save'); await h.advance(1000); await operation;
        assert.equal(h.saveClicks, 1); assert.equal(h.reloads, 0); assert.equal(h.api.progressSummary().verified, 0);
    }
});

async function acknowledgedSave(t, {csv = CSV, name = 'Alice Smith', orgId = '001'} = {}) {
    const h = fixture(t, {name, orgId}); h.importCSV(csv);
    let stored;
    h.onSave = () => { stored = {score: h.grade.value, feedback: h.editor.html}; h.signal('Draft saved'); };
    const operation = h.api.manualAction('fill-save'); await h.advance(1000); await operation;
    assert.equal(h.reloads, 1); assert.equal(h.api.progressSummary().verified, 0);
    return {h, stored, pending: h.session.getItem(PENDING_KEY)};
}

test('only matching reload readback records verification, including zero and escaped multiline feedback', async t => {
    const {h, stored} = await acknowledgedSave(t, {csv: 'student,OrgDefinedId,score,reason\nAlice Smith,001,0,"A < B & C\nSecond line"'});
    const reloaded = fixture(t, {local: h.local, session: h.session, navigationType: 'reload', ...stored});
    const verify = reloaded.api.restorePendingReadback(); await reloaded.advance(1000); await verify;
    assert.equal(reloaded.api.progressSummary().verified, 1);
    assert.equal(reloaded.api.getProcessedMap()['id:001'].verification, 'reload_readback');
    assert.equal(reloaded.saveClicks, 0);
    assert.match(reloaded.status(), /verified by reloading/);
});

test('acknowledged click without persisted values fails fresh-document readback', async t => {
    const {h} = await acknowledgedSave(t);
    const reloaded = fixture(t, {local: h.local, session: h.session, navigationType: 'reload', score: 20, feedback: '<p>Old feedback</p>'});
    const verify = reloaded.api.restorePendingReadback(); await reloaded.advance(16000); await verify;
    assert.equal(reloaded.api.progressSummary().verified, 0);
    assert.equal(reloaded.saveClicks, 0); assert.match(reloaded.status(), /did not match/);
});

test('blocked full reload times out without verification or navigation', async t => {
    const {h} = await acknowledgedSave(t);
    await h.advance(16000);
    assert.equal(h.api.progressSummary().verified, 0); assert.equal(h.nextClicks, 0);
    assert.equal(h.api.operation(), null);
    assert.equal(h.session.getItem(PENDING_KEY), null);
    assert.match(h.status(), /reload did not complete/);
});

test('pending readback never resumes on wrong identity, non-reload navigation, stale time, or changed CSV', async t => {
    for (const mode of ['identity', 'navigation', 'stale', 'csv']) {
        const {h, stored, pending} = await acknowledgedSave(t);
        if (mode === 'stale') { const value = JSON.parse(pending); value.createdAt -= 120001; h.session.setItem(PENDING_KEY, JSON.stringify(value)); }
        if (mode === 'csv') h.importCSV(CSV.replace('95', '90'));
        const reloaded = fixture(t, {local: h.local, session: h.session, navigationType: mode === 'navigation' ? 'navigate' : 'reload',
            ...stored, ...(mode === 'identity' ? {name: 'Bob Jones', orgId: '002'} : {})});
        const verify = reloaded.api.restorePendingReadback(); await reloaded.advance(1000); await verify;
        assert.equal(reloaded.api.progressSummary().verified, 0);
        assert.equal(reloaded.saveClicks, 0); assert.equal(reloaded.nextClicks, 0);
    }
});

test('progress uses canonical CSV IDs even when page names are aliases', async t => {
    const {h, stored} = await acknowledgedSave(t, {name: 'Displayed Alias'});
    const reloaded = fixture(t, {local: h.local, session: h.session, navigationType: 'reload', name: 'Displayed Alias', ...stored});
    const verify = reloaded.api.restorePendingReadback(); await reloaded.advance(1000); await verify;
    assert.equal(reloaded.api.progressSummary().verified, 1);
    assert.deepEqual(Object.keys(reloaded.api.getProcessedMap()), ['id:001']);
});

test('outside-CSV students advance untouched and are separate from named blank-score skips', async t => {
    for (const orgId of [null, '999']) {
        const h = fixture(t, {name: 'Other Student', orgId, score: '42', feedback: '<p>Keep this feedback</p>'});
        h.importCSV('student,OrgDefinedId,score,reason\nAlice Smith,001,,Do not write this');
        h.save.textContent = 'Update';
        h.onNext = () => { h.setStudent('Alice Smith', '001', true); h.next.disabled = true; };
        const run = h.api.startCruise(); await h.advance(2000); await run;
        assert.equal(h.nextClicks, 1); assert.equal(h.saveClicks, 0); assert.equal(h.reloads, 0);
        assert.equal(h.grade.value, '42'); assert.equal(h.editor.html, '<p>Keep this feedback</p>');
        const progress = h.api.progressSummary();
        assert.equal(progress.total, 1); assert.equal(progress.skipped, 1); assert.equal(progress.outsideCsv, 1);
        assert.equal(progress.verified, 0); assert.equal(progress.matched, 0); assert.equal(progress.remaining.length, 0);
        assert.deepEqual(Object.keys(h.api.getProcessedMap()), ['id:001']);
        assert.equal(h.w.document.getElementById('bs-progress-bar').style.width, '100%');
        assert.match(h.status(), /1 explicitly unsubmitted; 1 outside CSV skipped/);
    }
});

test('outside-CSV count survives a fresh document, deduplicates revisits, and resets with CSV or cache', async t => {
    const h = fixture(t, {name: 'Other Student', orgId: '999'}); h.importCSV(CSV);
    let step = h.api.cruiseStep(h.api.beginOperation('cruise')); await h.advance(300); await step;
    assert.equal(h.api.progressSummary().outsideCsv, 1); h.api.stopCruise();
    const reloaded = fixture(t, {local: h.local, name: 'Other Student', orgId: '999', navigationType: 'reload'});
    assert.equal(reloaded.api.progressSummary().outsideCsv, 1);
    step = reloaded.api.cruiseStep(reloaded.api.beginOperation('cruise')); await reloaded.advance(300); await step;
    assert.equal(reloaded.api.progressSummary().outsideCsv, 1);
    reloaded.api.stopCruise(); reloaded.importCSV(CSV);
    assert.equal(reloaded.api.progressSummary().outsideCsv, 0);
    step = reloaded.api.cruiseStep(reloaded.api.beginOperation('cruise')); await reloaded.advance(300); await step;
    assert.equal(reloaded.api.progressSummary().outsideCsv, 1);
    reloaded.api.clearAllAssignmentData();
    assert.equal(reloaded.api.progressSummary().outsideCsv, 0);
});

test('Stop during an outside-CSV skip cannot navigate or stop a restarted operation', async t => {
    const h = fixture(t, {name: 'Other Student', orgId: '999'}); h.importCSV(CSV);
    const old = h.api.runCruise(h.api.beginOperation('cruise'));
    await h.flush(); h.api.stopCruise(); const current = h.api.beginOperation('manual');
    await h.advance(1000); await old;
    assert.equal(h.nextClicks, 0); assert.equal(h.saveClicks, 0);
    assert.equal(h.api.operation(), current);
});

test('identity conflicts still pause cruise rather than becoming outside-CSV skips', async t => {
    for (const orgId of ['999', '002']) {
        const h = fixture(t, {orgId});
        h.importCSV(CSV + '\nBob Jones,002,77,Other feedback');
        await h.api.runCruise(h.api.beginOperation('cruise'));
        assert.equal(h.nextClicks, 0); assert.equal(h.saveClicks, 0); assert.equal(h.grade.value, '');
        assert.equal(h.api.progressSummary().outsideCsv, 0);
        assert.match(h.status(), /conflicts|different CSV records/);
    }
});

test('outside-CSV skips cannot hide an imported row missing from the roster or claim completion', async t => {
    const h = fixture(t, {name: 'Other Student', orgId: '999'}); h.importCSV(CSV);
    h.local.setItem('d2l_auto_rewind_pref', 'false'); h.next.disabled = true;
    const run = h.api.startCruise(); await h.advance(1000); await run;
    assert.equal(h.api.progressSummary().outsideCsv, 1);
    assert.equal(h.api.progressSummary().remaining.length, 1);
    assert.equal(h.api.progressSummary().skipped, 0);
    assert.equal(h.w.document.getElementById('bs-progress-bar').style.width, '0%');
    assert.equal(h.saveClicks, 0); assert.match(h.status(), /CSV rows remain unverified: Alice Smith/);
    assert.doesNotMatch(h.status(), /CSV complete/);
});

test('one-row CSV can rewind and traverse a forty-student roster without early navigation limits', async t => {
    const h = fixture(t); h.importCSV('student,OrgDefinedId,score\nAlice Smith,001,');
    let index = 39;
    const show = () => {
        h.setStudent(index === 39 ? 'Alice Smith' : 'Outside Student ' + index,
            index === 39 ? '001' : 'outside-' + index, true);
        h.previous.disabled = index === 0; h.next.disabled = index === 39;
    };
    h.onPrevious = () => { index--; show(); }; h.onNext = () => { index++; show(); }; show();
    const run = h.api.startCruise(); await h.advance(60000); await run;
    assert.equal(h.previousClicks, 39); assert.equal(h.nextClicks, 39); assert.equal(h.saveClicks, 0);
    assert.equal(h.api.progressSummary().outsideCsv, 39); assert.equal(h.api.progressSummary().skipped, 1);
    assert.equal(h.api.progressSummary().total, 1); assert.match(h.status(), /CSV complete/);
});

test('manual Fill Current still refuses a student absent from the CSV', async t => {
    const h = fixture(t, {name: 'Other Student', orgId: '999', score: 42, feedback: '<p>Keep</p>'});
    h.importCSV(CSV); await h.api.manualAction('fill');
    assert.equal(h.grade.value, '42'); assert.equal(h.editor.html, '<p>Keep</p>');
    assert.equal(h.nextClicks, 0); assert.equal(h.saveClicks, 0);
    assert.equal(h.api.progressSummary().outsideCsv, 0);
    assert.match(h.status(), /not in this CSV/);
});

test('whole-file validation has zero database/progress side effects; valid reimport invalidates old progress', t => {
    const h = fixture(t); h.importCSV(CSV);
    h.local.setItem('d2l_processed_map_ou42_assign7', JSON.stringify({schemaVersion: 2, revision: h.api.getDatabaseRevision(), records: {sentinel: {state: 'verified'}}}));
    const before = [...h.local.values];
    const load = reader(h);
    for (const invalid of ['student,score\nAlice,95abc', 'student,OrgDefinedId,score\nAlice,001,8\nBob,001,9']) {
        load(invalid); assert.deepEqual([...h.local.values], before); assert.match(h.status(), /import blocked/i);
    }
    load(CSV.replace('95', '96'));
    assert.equal(Object.keys(h.api.getProcessedMap()).length, 0);
    assert.equal(h.api.progressSummary().verified, 0);
});

test('a late FileReader from an older selection cannot overwrite a newer CSV', t => {
    const h = fixture(t); const readers = [];
    h.w.FileReader = class { readAsText(file) { this.file = file; readers.push(this); } };
    h.api.loadCSVFile({target: {files: [{size: 1, text: CSV}]}});
    h.api.loadCSVFile({target: {files: [{size: 1, text: CSV.replace('95', '88')}]}});
    readers[1].onload({target: {result: readers[1].file.text}});
    readers[0].onload({target: {result: readers[0].file.text}});
    assert.equal(h.api.getStudentDatabase()['id:001'].score, '88');
});

test('storage failure prevents save click; reset preserves unrelated scopes and clears known legacy keys', async t => {
    const h = fixture(t); h.importCSV(CSV); h.session.failWrites = true;
    const operation = h.api.manualAction('fill-save'); await h.advance(1000); await operation;
    assert.equal(h.saveClicks, 0); assert.match(h.status(), /Storage unavailable/);
    h.session.failWrites = false;
    for (const key of ['d2l_auto_eval_db_public', 'd2l_evaluation_map_public', 'd2l_processed_students_public']) h.local.setItem(key, 'legacy');
    h.local.setItem('unrelated_course', 'keep');
    h.api.clearAllAssignmentData();
    assert.equal(h.local.getItem('unrelated_course'), 'keep');
    assert.equal(h.local.getItem('d2l_auto_eval_db_public'), null);
    assert.equal(Object.keys(h.api.getStudentDatabase()).length, 0);
});

test('score maximum is checked before either field is changed; score-only fill needs no feedback editor', async t => {
    const h = fixture(t); h.importCSV(CSV);
    h.grade.setAttribute('max', '8');
    await h.api.manualAction('fill');
    assert.equal(h.grade.value, ''); assert.equal(h.editor.html, '');
    h.grade.setAttribute('max', '100');
    h.importCSV('student,OrgDefinedId,score\nAlice Smith,001,95');
    h.editor.parentElement.remove();
    await h.api.manualAction('fill');
    assert.equal(h.grade.value, '95'); assert.equal(h.saveClicks, 0);
});
