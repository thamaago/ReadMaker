const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const release = fs.readFileSync(path.join(root, 'RELEASE.md'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const asset of ['index.html', 'jszip.min.js', 'responsive.css', 'device-compatibility.js', '.nojekyll']) {
  assert(workflow.includes(asset), 'Pages artifact includes ' + asset);
  assert(release.includes(asset), 'release checklist names ' + asset);
}
assert(workflow.includes('wc -l)" -eq 5'), 'artifact count is checked');
assert(readme.includes('responsive.css') && readme.includes('device-compatibility.js'), 'local use documents external app assets');
assert(html.includes('href="responsive.css"'), 'HTML references responsive stylesheet');
assert(html.includes('src="device-compatibility.js"'), 'HTML references device helper');

console.log('deployment asset checks passed: all referenced static assets are staged and documented');

