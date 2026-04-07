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

const armedTabs = new Map();

const STRESS_SCRIPT_IDS = ['eko-bridge-cs', 'eko-stress-cs', 'eko-targeting-cs'];
const COOKIE_NAME = 'ekoStressSettings';

async function registerStressScripts() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: STRESS_SCRIPT_IDS });
  } catch (_) {}

  await chrome.scripting.registerContentScripts([
    {
      id: 'eko-bridge-cs',
      matches: ['<all_urls>'],
      js: ['content/content-bridge.js'],
      runAt: 'document_start'
    },
    {
      id: 'eko-stress-cs',
      matches: ['<all_urls>'],
      js: ['content/stress-engine.js'],
      runAt: 'document_start',
      world: 'MAIN'
    },
    {
      id: 'eko-targeting-cs',
      matches: ['<all_urls>'],
      js: ['content/eko-targeting.js'],
      runAt: 'document_start',
      world: 'MAIN'
    }
  ]);
}

async function unregisterStressScripts() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: STRESS_SCRIPT_IDS });
  } catch (_) {}
}

async function removeCookie() {
  try {
    const data = await chrome.storage.local.get('armedTabUrl');
    if (data.armedTabUrl) {
      await chrome.cookies.remove({ url: data.armedTabUrl, name: COOKIE_NAME });
    }
  } catch (_) {}
}

async function cleanupTest(tabId) {
  if (tabId) armedTabs.delete(tabId);
  await removeCookie();
  await chrome.storage.local.set({ testActive: false, armedTabId: null, armedTabUrl: null });
  await unregisterStressScripts();
}

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

    const tab = await chrome.tabs.get(tabId);
    const url = tab.url;

    await chrome.storage.local.set({
      settings,
      testActive: true,
      armedTabId: tabId,
      armedTabUrl: url
    });
    armedTabs.set(tabId, settings);

    // Plant settings in a cookie BEFORE reload so MAIN world scripts can
    // read them synchronously via document.cookie at document_start.
    if (url) {
      try {
        await chrome.cookies.set({
          url,
          name: COOKIE_NAME,
          value: encodeURIComponent(JSON.stringify(settings)),
          path: '/',
          expirationDate: Math.floor(Date.now() / 1000) + 300
        });
      } catch (err) {
        console.warn('[eko SW] Cookie set failed:', err.message);
      }
    }

    await registerStressScripts();
    chrome.tabs.reload(tabId);

    return { ok: true };
  },

  'stop-test': async (message) => {
    const tabId = message.tabId;
    await cleanupTest(tabId);
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'eko-stress-stop' });
    } catch (_) {}
    return { ok: true };
  },

  'get-tab-state': async (message) => {
    if (armedTabs.has(message.tabId)) return { running: true };
    const data = await chrome.storage.local.get(['testActive', 'armedTabId']);
    return { running: !!(data.testActive && data.armedTabId === message.tabId) };
  },

  'metrics-update': () => ({ ok: true }),

  'test-ended': async (_message, sender) => {
    const tabId = sender.tab?.id;
    await cleanupTest(tabId);
    return { ok: true };
  }
};

// Inject floating panel + CSS once the page is fully loaded
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;

  let settings = armedTabs.get(tabId);
  if (!settings) {
    const data = await chrome.storage.local.get(['testActive', 'armedTabId', 'settings']);
    if (!data.testActive || data.armedTabId !== tabId) return;
    settings = data.settings;
    armedTabs.set(tabId, settings);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/panel.js'],
      world: 'MAIN'
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/panel.css']
    });
    await chrome.tabs.sendMessage(tabId, {
      type: 'eko-stress-start',
      settings
    });
  } catch (err) {
    console.error('[eko SW] Panel inject failed:', err.message);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (armedTabs.has(tabId)) {
    await cleanupTest(tabId);
  }
});
