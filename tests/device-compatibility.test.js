const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'device-compatibility.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'DEVICE_COMPATIBILITY.md'), 'utf8');

assert(html.includes('<script src="device-compatibility.js"></script>'), 'compatibility helper is loaded');
assert(helper.includes("id !== 'buildBatch'"), 'batch build is covered by the pre-build hook');
['universal', 'adobe', 'kobo', 'pocketbook', 'kindle', 'xteink', 'sumi', 'android']
  .forEach((target) => assert(helper.includes("['" + target + "'"), target + ' target is available'));
assert(helper.includes("target === 'xteink' ? 'crosspoint'"), 'Xteink maps to CrossPoint profile');
assert(helper.includes("target === 'sumi' ? 'sumi'"), 'Sumi maps to Sumi profile');
assert(guide.includes('EPUB 3 reflow'), 'compatibility guide documents the universal profile');

console.log('device compatibility checks passed');

