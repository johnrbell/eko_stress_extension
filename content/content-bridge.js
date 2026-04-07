'use strict';

(() => {
  if (window.__ekoBridgeInstalled) return;
  window.__ekoBridgeInstalled = true;

  // Extension -> Page: forward chrome.runtime messages as CustomEvents on document.
  // document is shared between ISOLATED and MAIN worlds (window is not).
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
})();
