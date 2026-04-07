'use strict';

const DEFAULT_SETTINGS = {
  intensity: 'medium',
  duration: 30,
  js: true,
  layout: true,
  longtasks: true,
  memory: false,
  dom: false,
  network: false,
  ekoNetworkDelay: false,
  ekoDomTargeting: false,
  ekoRenderInterference: false
};

// Tabs that should auto-start stress on next page load
const armedTabs = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];
  if (handler) {
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(err => sendResponse({ error: err.message }));
      return true;
    }
    sendResponse(result);
  }
});

const messageHandlers = {
  'get-settings': () => {
    return new Promise(resolve => {
      chrome.storage.local.get('settings', data => {
        resolve(data.settings || DEFAULT_SETTINGS);
      });
    });
  },

  'save-settings': (message) => {
    return new Promise(resolve => {
      chrome.storage.local.set({ settings: message.settings }, () => {
        resolve({ ok: true });
      });
    });
  },

  'start-test': async (message) => {
    const tabId = message.tabId;
    const settings = message.settings;

    await chrome.storage.local.set({ settings });

    armedTabs.set(tabId, settings);
    chrome.tabs.reload(tabId);

    return { ok: true };
  },

  'stop-test': async (message) => {
    const tabId = message.tabId;
    armedTabs.delete(tabId);
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'eko-stress-stop' });
    } catch (_) {}
    return { ok: true };
  },

  'get-tab-state': (message) => {
    const armed = armedTabs.has(message.tabId);
    return { running: armed };
  },

  'metrics-update': () => ({ ok: true }),

  'test-ended': (_message, sender) => {
    const tabId = sender.tab?.id;
    if (tabId) armedTabs.delete(tabId);
    return { ok: true };
  }
};

// Inject scripts when an armed tab loads
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const settings = armedTabs.get(tabId);
  if (!settings) return;

  // 'loading': new document exists, inject engine + eko-targeting + bridge early
  if (changeInfo.status === 'loading') {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-bridge.js']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/stress-engine.js'],
        world: 'MAIN'
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/eko-targeting.js'],
        world: 'MAIN'
      });

      // Send start command immediately so stress begins during page parse
      await chrome.tabs.sendMessage(tabId, {
        type: 'eko-stress-start',
        settings
      });
    } catch (err) {
      console.warn('[eko SW] Early inject failed (will retry on complete):', err.message);
    }
  }

  // 'complete': DOM is ready, inject the panel UI + CSS
  if (changeInfo.status === 'complete') {
    try {
      // Re-inject bridge + engine in case early inject was too early
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-bridge.js']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/stress-engine.js'],
        world: 'MAIN'
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/eko-targeting.js'],
        world: 'MAIN'
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/panel.js'],
        world: 'MAIN'
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/panel.css']
      });

      // Send start again -- idempotent due to guards in each script
      await chrome.tabs.sendMessage(tabId, {
        type: 'eko-stress-start',
        settings
      });
    } catch (err) {
      console.error('[eko SW] Complete-phase inject failed:', err.message);
    }
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  armedTabs.delete(tabId);
});
