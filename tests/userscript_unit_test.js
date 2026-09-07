const assert = require('assert');

// 1. Test HTML escaping & newline formatting
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatFeedbackHtml(plainText) {
    if (!plainText) return '<p></p>';
    const safe = escapeHtml(plainText);
    const lines = safe.split(/\r?\n/);
    return '<p>' + lines.join('<br>') + '</p>';
}

console.log('Testing HTML escaping & newline formatting...');
assert.strictEqual(
    formatFeedbackHtml('Great work! Score < 100 & > 0.\nLine 2'),
    '<p>Great work! Score &lt; 100 &amp; &gt; 0.<br>Line 2</p>'
);
assert.strictEqual(
    formatFeedbackHtml('<script>alert("xss")</script>'),
    '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>'
);

// 2. Test CSV Parsing & Duplicate Name Detection
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    return lines.map(line => {
        const row = [];
        let cur = '';
        let inside = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inside && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inside = !inside;
                }
            } else if (ch === ',' && !inside) {
                row.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        row.push(cur.trim());
        return row;
    });
}

console.log('Testing CSV parsing & duplicate name collision detection...');
const testCsv = `First Name,Last Name,OrgDefinedId,Score,Feedback
Alex,Smith,001,90,Good job
Alex,Smith,002,85,Needs improvement
Bob,Jones,003,100,Perfect`;

const rows = parseCSV(testCsv);
const headers = rows[0].map(h => h.toLowerCase().trim());
const fI = headers.indexOf('first name');
const lI = headers.indexOf('last name');
const sI = headers.indexOf('score');

assert.notStrictEqual(sI, -1, 'Score column must be found');

const db = {};
const duplicates = [];
for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = `${row[fI]} ${row[lI]}`;
    if (db[name]) {
        duplicates.push(name);
    }
    db[name] = { score: row[sI] };
}

assert.strictEqual(duplicates.length, 1);
assert.strictEqual(duplicates[0], 'Alex Smith');

// 3. Test Score Sanity Validation
console.log('Testing numeric score validation...');
function validateScore(raw) {
    if (raw === '' || raw === null || raw === undefined) return null;
    if (raw.toLowerCase() === 'null' || raw.toLowerCase() === 'none') return null;
    const num = Number(raw);
    if (!isNaN(num) && isFinite(num) && num >= 0) return num;
    return null;
}

assert.strictEqual(validateScore('95'), 95);
assert.strictEqual(validateScore('100.5'), 100.5);
assert.strictEqual(validateScore('95abc'), null);
assert.strictEqual(validateScore('Infinity'), null);
assert.strictEqual(validateScore('-10'), null);
assert.strictEqual(validateScore(''), null);

console.log('All regression unit tests passed successfully!');
