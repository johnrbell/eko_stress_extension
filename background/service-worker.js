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

const tabState = new Map();

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
    const tab = message.tabId;
    const settings = message.settings;

    await chrome.storage.local.set({ settings });

    await chrome.scripting.executeScript({
      target: { tabId: tab },
      files: ['content/content-bridge.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab },
      files: ['content/stress-engine.js'],
      world: 'MAIN'
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab },
      files: ['content/eko-targeting.js'],
      world: 'MAIN'
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab },
      files: ['content/panel.js'],
      world: 'MAIN'
    });

    await chrome.scripting.insertCSS({
      target: { tabId: tab },
      files: ['content/panel.css']
    });

    await chrome.tabs.sendMessage(tab, {
      type: 'eko-stress-start',
      settings
    });

    tabState.set(tab, { running: true, settings, startedAt: Date.now() });
    return { ok: true };
  },

  'stop-test': async (message) => {
    const tab = message.tabId;
    try {
      await chrome.tabs.sendMessage(tab, { type: 'eko-stress-stop' });
    } catch (_) { /* tab may have navigated */ }
    tabState.delete(tab);
    return { ok: true };
  },

  'get-tab-state': (message) => {
    const state = tabState.get(message.tabId);
    return state || { running: false };
  },

  'metrics-update': (message, sender) => {
    const tab = sender.tab?.id;
    if (tab && tabState.has(tab)) {
      tabState.get(tab).metrics = message.metrics;
    }
    return { ok: true };
  },

  'test-ended': (message, sender) => {
    const tab = sender.tab?.id;
    if (tab) {
      tabState.delete(tab);
    }
    return { ok: true };
  }
};

chrome.tabs.onRemoved.addListener(tabId => {
  tabState.delete(tabId);
});
