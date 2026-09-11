#!/usr/bin/env node
// Runs every *.test.js suite in this folder and reports a combined result.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const suites = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;

for (const s of suites) {
  process.stdout.write('\n\u2500\u2500 ' + s + ' \u2500\u2500\n');
  try {
    execFileSync('node', [s], { cwd: dir, stdio: 'inherit' });
  } catch (e) {
    failed++;
    process.stdout.write('  \u2717 suite failed: ' + s + '\n');
  }
}

process.stdout.write('\n' + (failed ? ('\u2717 ' + failed + ' suite(s) failed') : '\u2713 all suites passed') + '\n');
process.exit(failed ? 1 : 0);
