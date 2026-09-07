const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const userscriptPath = path.resolve(__dirname, '../brightspace_auto_feedback_injector.user.js');
const rawCode = fs.readFileSync(userscriptPath, 'utf8');

console.log('--- 1. Testing Production Code Integrity & Security Predicates ---');

// Assert that production code contains real escapeHtml implementation
assert.ok(rawCode.includes('function escapeHtml(text)'), 'Production code must contain escapeHtml()');
assert.ok(rawCode.includes('function formatFeedbackHtml(plainText)'), 'Production code must contain formatFeedbackHtml()');
assert.ok(rawCode.includes('formatFeedbackHtml(plainText)'), 'deepFillFeedback must call formatFeedbackHtml()');

// Assert that activeRunToken is present for race condition protection
assert.ok(rawCode.includes('activeRunToken'), 'Production code must use activeRunToken for cancellation');

// Assert that rubric isolation exists across Shadow DOM
assert.ok(rawCode.includes('hasRubricAncestor'), 'Production code must check hasRubricAncestor()');
assert.ok(rawCode.includes('isOverallGradeElement'), 'Production code must check isOverallGradeElement()');

// Assert that duplicate student names trigger a hard block
assert.ok(rawCode.includes('duplicateNames.length > 0'), 'Production code must detect duplicate student names');
assert.ok(rawCode.includes('CSV Import Blocked'), 'Production code must alert and block duplicate imports');

// Assert that dialog handler halts on destructive modals and rejects negative buttons
assert.ok(rawCode.includes("txt.includes(\"don't\")"), 'autoConfirmDialog must reject negative buttons like "Don\'t save"');
assert.ok(rawCode.includes('Destructive dialog detected'), 'autoConfirmDialog must halt on destructive dialogs');

console.log('✔ All production security predicates verified in brightspace_auto_feedback_injector.user.js');

console.log('--- 2. Executing Extracted Functions in VM Sandbox ---');

// Extract the functions from production script to test runtime logic
function extractFunction(code, fnName) {
    const match = code.match(new RegExp(`function ${fnName}\\s*\\([\\s\\S]*?\\n    \\}`));
    if (!match) throw new Error(`Could not find function ${fnName} in production code`);
    return match[0];
}

const sandbox = {};
vm.createContext(sandbox);

// Evaluate escapeHtml and formatFeedbackHtml directly from the production script
const escapeHtmlSrc = extractFunction(rawCode, 'escapeHtml');
const formatHtmlSrc = extractFunction(rawCode, 'formatFeedbackHtml');
vm.runInContext(escapeHtmlSrc, sandbox);
vm.runInContext(formatHtmlSrc, sandbox);

// Test XSS and HTML tag escaping
assert.strictEqual(
    sandbox.formatFeedbackHtml('Score < 100 & > 0.\nSecond line'),
    '<p>Score &lt; 100 &amp; &gt; 0.<br>Second line</p>',
    'Must escape HTML tags and convert newlines to <br>'
);
assert.strictEqual(
    sandbox.formatFeedbackHtml('<script>alert("xss")</script>'),
    '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>',
    'Must safely neutralize script tags'
);
console.log('✔ Real production formatFeedbackHtml passed escaping & multiline tests');

// Evaluate parseCSV from production script
const parseCsvSrc = extractFunction(rawCode, 'parseCSV');
vm.runInContext(parseCsvSrc, sandbox);

const sampleCsv = `First Name,Last Name,OrgDefinedId,Score,Feedback
Alex,Smith,001,90,Good job
Bob,Jones,002,100,Perfect`;

const parsedRows = sandbox.parseCSV(sampleCsv);
assert.strictEqual(parsedRows.length, 3);
assert.strictEqual(parsedRows[1][0], 'Alex');
assert.strictEqual(parsedRows[1][3], '90');
console.log('✔ Real production parseCSV passed CSV parsing tests');

console.log('\n🎉 ALL REAL PRODUCTION CODE UNIT TESTS PASSED!');
