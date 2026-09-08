#!/usr/bin/env node

// Local-only Brightspace-shaped fixture. It never contacts an LMS or persists outside this process.
const http = require('http');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'fixtures');
const htmlPath = path.join(fixtures, 'evaluation.html');
const rosterPath = path.join(fixtures, 'roster.csv');
const userscriptPath = path.join(repo, 'brightspace_auto_feedback_injector.user.js');

function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { pushField(); if (row.some(value => value.trim())) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === ',') pushField();
        else if (ch === '\r' || ch === '\n') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            pushRow();
        } else if (ch === '"' && !field.trim()) quoted = true;
        else field += ch;
    }
    if (quoted) throw new Error('Fixture roster has an unclosed quoted field.');
    if (field || row.length) pushRow();
    return rows;
}

function loadRoster() {
    const rows = parseCsv(fs.readFileSync(rosterPath, 'utf8').replace(/^\uFEFF/, ''));
    if (rows.length < 2) throw new Error('Fixture roster must contain students.');
    const headers = rows.shift().map(value => value.trim().toLowerCase());
    const at = name => headers.indexOf(name);
    const studentAt = at('student'), idAt = at('orgdefinedid'), scoreAt = at('score'), reasonAt = at('reason');
    if ([studentAt, idAt, scoreAt, reasonAt].some(index => index < 0)) throw new Error('Fixture roster headers are incomplete.');
    return rows.map(row => ({
        student: row[studentAt].trim(),
        OrgDefinedId: row[idAt].trim().replace(/^#/, ''),
        score: row[scoreAt].trim() || null,
        reason: row[reasonAt] || ''
    }));
}

const roster = loadRoster();
const byId = new Map(roster.map(student => [student.OrgDefinedId, student]));
const state = {saveCalls: 0, drafts: new Map(), results: []};

function json(res, status, value) {
    const body = JSON.stringify(value);
    res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
    res.end(body);
}

function text(res, status, value, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'});
    res.end(value);
}

function publicState() {
    const persistentDrafts = Object.fromEntries(state.drafts);
    return {
        localSimulation: true,
        saveCalls: state.saveCalls,
        persistentDrafts,
        draftCount: state.drafts.size,
        results: state.results,
        saveResults: state.results,
        rubric: {serverState: 'none; rubric fixture is client-only'}
    };
}

function bodyJson(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) req.destroy(new Error('Request body too large.'));
        });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (error) { reject(error); }
        });
        req.on('error', reject);
    });
}

function draftFor(id) {
    const draft = state.drafts.get(id);
    return draft ? {...draft} : null;
}

function handleSave(req, res, url) {
    bodyJson(req).then(body => {
        const id = String(body.OrgDefinedId || body.orgDefinedId || body.student || '').trim().replace(/^#/, '');
        const mode = String(body.mode || url.searchParams.get('mode') || 'default');
        if (!byId.has(id)) return json(res, 400, {ok: false, error: 'Unknown synthetic OrgDefinedId.'});
        const draft = {
            OrgDefinedId: id,
            student: byId.get(id).student,
            score: body.score === null || body.score === undefined ? '' : String(body.score),
            feedbackHtml: String(body.feedbackHtml ?? body.html ?? body.feedback ?? body.reason ?? ''),
            savedAt: new Date().toISOString()
        };
        state.saveCalls++;
        const result = {call: state.saveCalls, OrgDefinedId: id, mode, score: draft.score,
            feedbackHtml: draft.feedbackHtml, acknowledged: false, persisted: false};
        state.results.push(result);
        const finish = () => {
            if (mode === 'reject-save' || mode === 'no-ack' || mode === 'published') {
                if (mode === 'reject-save') return json(res, 409, {ok: false, acknowledged: false, error: 'Fixture rejected this save.'});
                if (mode === 'published') return json(res, 405, {ok: false, acknowledged: false, error: 'Published evaluation exposes Update only.'});
                return json(res, 200, {ok: true, acknowledged: false, persisted: false});
            }
            const persisted = mode !== 'ack-no-commit';
            if (persisted) state.drafts.set(id, draft);
            result.acknowledged = true;
            result.persisted = persisted;
            return json(res, 200, {ok: true, acknowledged: true, persisted, draft: persisted ? draft : null});
        };
        if (mode === 'delayed-save') setTimeout(finish, 2000);
        else finish();
    }).catch(error => json(res, 400, {ok: false, error: error.message || 'Invalid JSON.'}));
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/__state') return json(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/api/roster') return json(res, 200, {students: roster});
    if (req.method === 'GET' && url.pathname === '/api/drafts') {
        const id = String(url.searchParams.get('OrgDefinedId') || url.searchParams.get('orgDefinedId') || url.searchParams.get('student') || '').replace(/^#/, '');
        return json(res, 200, {found: !!draftFor(id), draft: draftFor(id)});
    }
    if (req.method === 'POST' && url.pathname === '/api/drafts') return handleSave(req, res, url);
    if (req.method !== 'GET') return text(res, 405, 'Method not allowed.');
    if (url.pathname === '/roster.csv') return text(res, 200, fs.readFileSync(rosterPath, 'utf8'), 'text/csv; charset=utf-8');
    if (url.pathname === '/userscript.js') return text(res, 200, fs.readFileSync(userscriptPath, 'utf8'), 'application/javascript; charset=utf-8');
    if (url.pathname === '/' || url.pathname.startsWith('/d2l/le/activities/iterator/1')) {
        return text(res, 200, fs.readFileSync(htmlPath, 'utf8'), 'text/html; charset=utf-8');
    }
    return text(res, 404, 'Not found.');
});

const requestedPort = process.argv[2] === undefined ? 0 : Number(process.argv[2]);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error('Port must be an integer from 0 through 65535.');
server.listen(requestedPort, '127.0.0.1', () => {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    console.log(`LOCAL SIMULATION fixture: ${base}/d2l/le/activities/iterator/1?ou=42&iteratorId=7`);
    console.log(`Read-only state: ${base}/__state`);
});

function close() { server.close(() => process.exit(0)); }
process.on('SIGINT', close);
process.on('SIGTERM', close);
