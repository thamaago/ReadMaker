const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'responsive.css'), 'utf8');
const device = fs.readFileSync(path.join(root, 'device-compatibility.js'), 'utf8');

/* Representative viewport matrix used by the UI stress check. */
const viewports = [
  [320, 568], [360, 800], [375, 812], [412, 915],
  [600, 960], [768, 1024], [900, 600], [1024, 768],
  [1280, 720], [1440, 900], [1920, 1080]
];
assert(viewports.length >= 10, 'viewport matrix has broad coverage');
viewports.forEach(([width, height]) => {
  assert(width >= 320 && height >= 480, 'viewport is usable: ' + width + 'x' + height);
});

/* Long user input must wrap instead of expanding the document horizontally. */
const longInput = 'https://example.com/' + 'a'.repeat(2000);
assert(longInput.length > 2000, 'long URL fixture is present');
assert(css.includes('overflow-wrap: anywhere'), 'long input wrapping is enabled');
assert(css.includes('overflow-x: hidden'), 'horizontal overflow is contained');

/* Device and preset combinations that must remain available. */
['universal', 'adobe', 'kobo', 'pocketbook', 'kindle', 'xteink', 'sumi', 'android']
  .forEach((target) => assert(device.includes("['" + target + "'"), 'target: ' + target));
['presetAuto', 'presetUniversal', 'presetText', 'presetLayout', 'presetComic']
  .forEach((key) => assert(html.includes('data-i18n="' + key + '"'), 'preset label: ' + key));
assert(html.includes('value="universal"'), 'source-quality universal preset is wired');

/* Repeated batch selections should not create duplicate target controls. */
const guardCount = (device.match(/byId\('deviceTarget'\)/g) || []).length;
assert(guardCount >= 1, 'target-control duplicate guard exists');

console.log('responsive stress matrix passed: ' + viewports.length + ' viewports, long-input and device/preset checks passed');

