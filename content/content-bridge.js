'use strict';

(() => {
  if (window.__ekoBridgeInstalled) return;
  window.__ekoBridgeInstalled = true;

  // Extension -> Page: forward chrome.runtime messages as CustomEvents on document.
  // We JSON-stringify the detail to avoid structured-clone restrictions across worlds.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    document.dispatchEvent(new CustomEvent('eko-ext-to-page', {
      detail: JSON.stringify(message)
    }));
    sendResponse({ ok: true });
  });

  // Page -> Extension: forward CustomEvents as chrome.runtime messages
  document.addEventListener('eko-page-to-ext', (e) => {
    try {
      const data = JSON.parse(e.detail);
      chrome.runtime.sendMessage(data).catch(() => {});
    } catch (_) {}
  });

  // Auto-start at document_start: read storage for an active test and
  // immediately relay settings to MAIN world scripts. This fires before
  // any page <script> tags execute, enabling stress during initial load.
  chrome.storage.local.get(['testActive', 'settings'], (data) => {
    if (!data.testActive || !data.settings) return;

    const payload = JSON.stringify({
      type: 'eko-stress-start',
      settings: data.settings
    });

    // Plant settings in a DOM attribute so MAIN world scripts that load
    // after this callback can still pick them up synchronously.
    document.documentElement.setAttribute('data-eko-stress', payload);

    // Dispatch event for MAIN world scripts already loaded and listening.
    document.dispatchEvent(new CustomEvent('eko-ext-to-page', { detail: payload }));
  });
})();
