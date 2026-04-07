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

let settings = { ...DEFAULT_SETTINGS };
let isRunning = false;
let activeTabId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id;

  const saved = await chrome.runtime.sendMessage({ type: 'get-settings' });
  if (saved && saved.intensity) {
    settings = { ...DEFAULT_SETTINGS, ...saved };
  }

  const state = await chrome.runtime.sendMessage({ type: 'get-tab-state', tabId: activeTabId });
  if (state?.running) {
    setRunningState(true);
  }

  renderUI();
  bindEvents();
});

function renderUI() {
  document.querySelectorAll('#intensity-group .eko-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === settings.intensity);
  });

  document.querySelectorAll('#duration-group .eko-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.duration) === settings.duration);
  });

  document.querySelectorAll('.eko-toggle').forEach(toggle => {
    const key = toggle.dataset.key;
    const checkbox = toggle.querySelector('input');
    checkbox.checked = settings[key];
    toggle.classList.toggle('checked', settings[key]);
  });

  updateToggleDisabledState();
}

function updateToggleDisabledState() {
  const isOff = settings.intensity === 'off';
  document.querySelectorAll('.eko-toggle').forEach(t => {
    t.classList.toggle('disabled', isOff);
  });
}

function bindEvents() {
  document.querySelectorAll('#intensity-group .eko-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.intensity = btn.dataset.level;
      renderUI();
      saveSettings();
    });
  });

  document.querySelectorAll('#duration-group .eko-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.duration = parseInt(btn.dataset.duration);
      renderUI();
      saveSettings();
    });
  });

  document.querySelectorAll('.eko-toggle').forEach(toggle => {
    const checkbox = toggle.querySelector('input');
    checkbox.addEventListener('change', () => {
      const key = toggle.dataset.key;
      settings[key] = checkbox.checked;
      toggle.classList.toggle('checked', checkbox.checked);
      saveSettings();
    });
  });

  document.getElementById('start-btn').addEventListener('click', startTest);
  document.getElementById('stop-btn').addEventListener('click', stopTest);
}

async function saveSettings() {
  await chrome.runtime.sendMessage({ type: 'save-settings', settings });
}

async function startTest() {
  if (!activeTabId) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'start-test',
      tabId: activeTabId,
      settings
    });
    setRunningState(true);
  } catch (err) {
    console.error('Failed to start test:', err);
  }
}

async function stopTest() {
  if (!activeTabId) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'stop-test',
      tabId: activeTabId
    });
    setRunningState(false);
  } catch (err) {
    console.error('Failed to stop test:', err);
  }
}

function setRunningState(running) {
  isRunning = running;
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const badge = document.getElementById('status-badge');

  startBtn.disabled = running;
  startBtn.textContent = running ? 'Running...' : 'Start Test';
  startBtn.classList.toggle('running', running);

  stopBtn.disabled = !running;

  badge.textContent = running ? 'Running' : 'Idle';
  badge.classList.toggle('running', running);
  badge.classList.remove('completed');
}
