const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'responsive.css'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'device-compatibility.js'), 'utf8');

assert(html.includes('name="viewport"'), 'viewport metadata is present');
assert((html.match(/name="viewport"/g) || []).length === 1, 'viewport metadata is not duplicated');
assert(html.includes('viewport-fit=cover'), 'safe-area viewport is enabled');
assert(html.includes('href="responsive.css"'), 'responsive stylesheet is loaded');
assert(css.includes('@media (max-width: 600px)'), 'mobile breakpoint exists');
assert(css.includes('@media (max-width: 900px)'), 'tablet breakpoint exists');
assert(css.includes('[style*="grid-template-columns"]'), 'inline grid layouts collapse on narrow screens');
assert(css.includes('@media (pointer: coarse)'), 'touch controls are enlarged');
assert(css.includes('prefers-reduced-motion'), 'reduced motion is respected');
assert(helper.includes('readMakerViewport'), 'viewport state is exposed to the app');

console.log('responsive interface checks passed');

