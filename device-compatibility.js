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
    ['universal', 'deviceUniversal'],
    ['adobe', 'deviceAdobe'],
    ['kobo', 'deviceKobo'],
    ['pocketbook', 'devicePocketbook'],
    ['kindle', 'deviceKindle'],
    ['xteink', 'deviceXteink'],
    ['crosspoint', 'deviceCrossPoint'],
    ['sumi', 'deviceSumi'],
    ['android', 'deviceAndroid']
  ];

  function byId(id) { return document.getElementById(id); }

  function translate(key) {
    return typeof window.t === 'function' ? window.t(key) : key;
  }

  function applyTargetLanguage() {
    var label = document.querySelector('label[for="deviceTarget"]');
    var help = byId('deviceTargetHelp');
    if (label) label.textContent = translate('deviceTargetLabel');
    if (help) help.textContent = translate('deviceTargetHelp');
    TARGETS.forEach(function (item) {
      var option = byId('deviceTarget') && byId('deviceTarget').querySelector('option[value="' + item[0] + '"]');
      if (option) option.textContent = translate(item[1]);
    });
  }

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
    field.innerHTML = '<label for="deviceTarget" data-i18n="deviceTargetLabel"></label>' +
      '<select id="deviceTarget" aria-describedby="deviceTargetHelp"></select>' +
      '<div class="help" id="deviceTargetHelp" data-i18n="deviceTargetHelp"></div>';
    firmware.parentNode.insertAdjacentElement('afterend', field);
    var select = byId('deviceTarget');
    TARGETS.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item[0];
      option.textContent = translate(item[1]);
      select.appendChild(option);
    });
    select.addEventListener('change', applyTarget);
    applyTargetLanguage();
    applyTarget();
  }

  function applyTarget() {
    var select = byId('deviceTarget');
    var firmware = byId('fwProfile');
    if (!select || !firmware) return;
    var target = select.value || 'universal';
    var profile = target === 'crosspoint' ? 'crosspoint' : 'universal';
    if ([].some.call(firmware.options, function (option) { return option.value === profile; })) {
      firmware.value = profile;
    } else {
      firmware.value = 'universal';
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

  window.applyDeviceTargetLanguage = applyTargetLanguage;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());

