const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'device-compatibility.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'DEVICE_COMPATIBILITY.md'), 'utf8');

assert(html.includes('<script src="device-compatibility.js"></script>'), 'compatibility helper is loaded');
assert(!html.includes('value="sumi" data-i18n="fwSumi"'), 'no unsupported Sumi stylesheet profile is advertised');
assert(guide.includes('Only CrossPoint has a distinct stylesheet profile'), 'guide explains which target has a custom profile');

const dom = new JSDOM('<!doctype html><html lang="id"><body><div><select id="fwProfile"><option value="universal">Universal</option><option value="crosspoint">CrossPoint</option></select></div><button id="buildBatch"></button></body></html>', {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.test/',
  beforeParse(window) {
    window.matchMedia = () => ({ matches: false });
    window.t = (key) => ({
      deviceTargetLabel: window.document.documentElement.lang === 'en' ? 'Target device' : 'Perangkat tujuan',
      deviceTargetHelp: window.document.documentElement.lang === 'en' ? 'Standard EPUB baseline.' : 'Dasar EPUB standar.',
      deviceUniversal: window.document.documentElement.lang === 'en' ? 'All EPUB readers' : 'Semua pembaca EPUB',
      deviceAdobe: 'Adobe Digital Editions', deviceKobo: 'Kobo',
      devicePocketbook: 'PocketBook / Tolino',
      deviceKindle: window.document.documentElement.lang === 'en' ? 'Kindle' : 'Kindle',
      deviceXteink: 'Xteink', deviceCrossPoint: 'CrossPoint', deviceSumi: 'Sumi', deviceAndroid: 'Android e-reader'
    }[key] || key);
  }
});
const { window } = dom;
window.eval(helper);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const select = window.document.getElementById('deviceTarget');
const firmware = window.document.getElementById('fwProfile');
assert(select, 'target selector is injected');
assert.strictEqual(select.options.length, 9, 'all targets are represented');
assert.strictEqual(window.document.querySelector('label[for="deviceTarget"]').textContent, 'Perangkat tujuan', 'initial Indonesian label is applied');

const expected = {
  universal: 'universal', adobe: 'universal', kobo: 'universal', pocketbook: 'universal',
  kindle: 'universal', xteink: 'universal', crosspoint: 'crosspoint', sumi: 'universal', android: 'universal'
};
for (const [target, profile] of Object.entries(expected)) {
  select.value = target;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.strictEqual(firmware.value, profile, target + ' maps to ' + profile);
}

window.document.documentElement.lang = 'en';
window.t = (key) => ({ deviceTargetLabel: 'Target device', deviceTargetHelp: 'Standard EPUB baseline.', deviceUniversal: 'All EPUB readers' }[key] || key);
window.applyDeviceTargetLanguage();
assert.strictEqual(window.document.querySelector('label[for="deviceTarget"]').textContent, 'Target device', 'English label updates');
assert.strictEqual(select.options[0].textContent, 'All EPUB readers', 'English options update');

select.value = 'crosspoint';
firmware.value = 'universal'; // emulate a preset changing the firmware selector
window.document.getElementById('buildBatch').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.strictEqual(firmware.value, 'crosspoint', 'selected target is restored before batch export');

console.log('device compatibility checks passed: 9 mappings, bilingual labels and batch preflight');

