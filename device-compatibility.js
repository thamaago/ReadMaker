/*
 * Device compatibility helper.
 *
 * EPUB is a reflowable standard, so a single standards-first package is the
 * safest choice for most readers.  This small layer exposes a friendly target
 * selector and maps device-specific targets to the existing firmware profile
 * control without changing the source book or forcing a vendor lock-in.
 */
(function () {
  'use strict';

  var TARGETS = [
    ['universal', 'Semua pembaca EPUB (disarankan)'],
    ['adobe', 'Adobe Digital Editions'],
    ['kobo', 'Kobo'],
    ['pocketbook', 'PocketBook / Tolino'],
    ['kindle', 'Kindle (EPUB melalui Send to Kindle)'],
    ['xteink', 'Xteink / CrossPoint'],
    ['sumi', 'Sumi / firmware sejenis'],
    ['android', 'Android e-reader']
  ];

  function byId(id) { return document.getElementById(id); }

  function markViewport() {
    var narrow = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    document.documentElement.dataset.readMakerViewport = narrow ? 'mobile' :
      (window.innerWidth <= 900 ? 'tablet' : 'desktop');
    document.documentElement.dataset.readMakerInput = touch ? 'touch' : 'pointer';
  }

  function addTargetControl() {
    if (byId('deviceTarget') || !byId('fwProfile')) return;
    var firmware = byId('fwProfile');
    var field = document.createElement('div');
    field.className = 'field';
    field.id = 'deviceTargetField';
    field.style.marginTop = '12px';
    field.innerHTML = '<label for="deviceTarget">Perangkat tujuan</label>' +
      '<select id="deviceTarget" aria-describedby="deviceTargetHelp"></select>' +
      '<div class="help" id="deviceTargetHelp">EPUB standar tetap dapat dibuka di perangkat lain; pilihan ini hanya menyiapkan profil yang paling aman.</div>';
    firmware.parentNode.insertAdjacentElement('afterend', field);
    var select = byId('deviceTarget');
    TARGETS.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item[0];
      option.textContent = item[1];
      select.appendChild(option);
    });
    select.addEventListener('change', applyTarget);
    applyTarget();
  }

  function applyTarget() {
    var select = byId('deviceTarget');
    var firmware = byId('fwProfile');
    if (!select || !firmware) return;
    var target = select.value || 'universal';
    var profile = target === 'xteink' ? 'crosspoint' :
      target === 'sumi' ? 'sumi' : 'universal';
    if ([].some.call(firmware.options, function (option) { return option.value === profile; })) {
      firmware.value = profile;
    }
    document.documentElement.dataset.readMakerDeviceTarget = target;
    window.readMakerDeviceTarget = target;
  }

  function beforeBuild(event) {
    /* Capture phase runs before the app's existing build listener. */
    if (!event.target || (event.target.id !== 'build' && event.target.id !== 'buildBatch')) return;
    applyTarget();
  }

  function init() {
    markViewport();
    window.addEventListener('resize', markViewport, { passive: true });
    addTargetControl();
    document.addEventListener('click', beforeBuild, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());

