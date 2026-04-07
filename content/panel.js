'use strict';

(() => {
  if (window.__ekoStressPanel) return;

  const PANEL_HTML = `
    <div class="eko-stress-header">
      <div class="eko-stress-logo">
        <svg width="45" height="20" viewBox="0 0 45 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30.0606 5.62405H24.8662L20.5566 12.4505V0H16.1478V19.6728H20.0074L22.8143 15.7534L25.6213 19.6728H31.2658L25.4154 12.1157L30.0606 5.62405Z" fill="white"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M29.5267 12.6408C29.5267 8.57686 32.8295 5.28158 36.9026 5.28158C40.9834 5.28158 44.2862 8.57686 44.2786 12.6408C44.2786 16.7047 40.9758 20 36.9026 20C32.8295 20 29.5267 16.7047 29.5267 12.6408ZM33.9507 12.6484C33.9507 14.4597 35.2703 15.7686 36.9026 15.7686C38.535 15.7686 39.8545 14.4521 39.8545 12.6484C39.8545 10.8371 38.535 9.52055 36.9026 9.52055C35.2703 9.52055 33.9507 10.8371 33.9507 12.6484Z" fill="white"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M0 12.6408C0 8.57686 3.30278 5.28158 7.37595 5.28158C11.4491 5.28158 14.7519 8.57686 14.7519 12.6408C14.7519 13.1126 14.7061 13.5769 14.6222 14.0259H4.41642C4.91984 15.449 6.03348 16.172 7.41409 16.172C8.73368 16.172 9.32863 15.7839 9.79392 15.2359H14.279C13.2264 18.0213 10.5338 20 7.37595 20C3.30278 20 0 16.7047 0 12.6408ZM7.37595 9.14002C6.03348 9.14002 4.88933 9.9315 4.41641 11.2557H10.3355C9.87019 9.9315 8.71842 9.14002 7.37595 9.14002Z" fill="white"/>
        </svg>
        <span class="eko-stress-title">Stress Test</span>
      </div>
      <button class="eko-panel-toggle" title="Minimize panel">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="eko-stress-body">
      <div class="eko-active-banner" style="display:flex;">
        <div class="banner-pulse"></div>
        <div class="banner-content">
          <strong>Test Running</strong>
          <span>Blocking main thread</span>
        </div>
      </div>
      <div class="eko-stress-status">
        <div class="eko-status-row">
          <span class="status-indicator">
            <span class="status-dot running"></span>
            <span id="eko-panel-status-text">Running</span>
          </span>
        </div>
        <div class="eko-metrics">
          <div class="eko-metric">
            <span class="metric-value" id="eko-panel-elapsed">0.0s</span>
            <span class="metric-label">Elapsed</span>
          </div>
          <div class="eko-metric">
            <span class="metric-value" id="eko-panel-blocked">0ms</span>
            <span class="metric-label">Blocked</span>
          </div>
          <div class="eko-metric">
            <span class="metric-value" id="eko-panel-ops">0</span>
            <span class="metric-label">Operations</span>
          </div>
        </div>
      </div>
      <div class="eko-graph-section">
        <div class="eko-graph-header">
          <label class="eko-label">Blocking Impact</label>
          <span class="eko-graph-value" id="eko-panel-impact-label">Low</span>
        </div>
        <div class="eko-impact-meter">
          <div class="impact-bar-bg">
            <div class="impact-tick" id="eko-panel-tick" style="left:0%;">
              <div class="tick-line"></div>
              <div class="tick-value" id="eko-panel-tick-value">0%</div>
            </div>
          </div>
          <div class="impact-labels">
            <span>0%</span>
            <span>Low Impact</span>
            <span>High Impact</span>
            <span>100%</span>
          </div>
        </div>
        <div class="eko-graph-stats">
          <div class="graph-stat">
            <span class="stat-label">Avg Block</span>
            <span class="stat-value" id="eko-panel-avg">0ms</span>
          </div>
          <div class="graph-stat">
            <span class="stat-label">Est. FPS</span>
            <span class="stat-value" id="eko-panel-fps">60fps</span>
          </div>
          <div class="graph-stat">
            <span class="stat-label">Block Rate</span>
            <span class="stat-value" id="eko-panel-block-rate">0%</span>
          </div>
        </div>
      </div>
      <div class="eko-progress" id="eko-panel-progress" style="display:none;">
        <div class="progress-track">
          <div class="progress-fill" id="eko-panel-progress-bar"></div>
        </div>
        <span class="progress-label" id="eko-panel-progress-text">0%</span>
      </div>
    </div>
  `;

  function createPanel() {
    if (document.getElementById('eko-stress-panel-ext')) return;

    const panel = document.createElement('div');
    panel.id = 'eko-stress-panel-ext';
    panel.className = 'eko-stress-panel running';
    panel.innerHTML = PANEL_HTML;
    document.body.appendChild(panel);

    setupDrag(panel);
    setupToggle(panel);
    startMetricsLoop(panel);
  }

  function setupToggle(panel) {
    const btn = panel.querySelector('.eko-panel-toggle');
    const body = panel.querySelector('.eko-stress-body');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const minimized = panel.classList.toggle('minimized');
      body.style.display = minimized ? 'none' : 'block';
      btn.style.transform = minimized ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }

  function setupDrag(panel) {
    const header = panel.querySelector('.eko-stress-header');
    const toggleBtn = panel.querySelector('.eko-panel-toggle');
    let dragging = false, startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      if (toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target))) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.transition = 'none';
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - 52;
      panel.style.right = 'auto';
      panel.style.left = Math.max(0, Math.min(startLeft + e.clientX - startX, maxLeft)) + 'px';
      panel.style.top = Math.max(0, Math.min(startTop + e.clientY - startY, maxTop)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        panel.style.transition = '';
        header.style.cursor = 'grab';
      }
    });

    header.style.cursor = 'grab';
  }

  function formatOps(ops) {
    if (ops > 1000000) return (ops / 1000000).toFixed(1) + 'M';
    if (ops > 1000) return (ops / 1000).toFixed(1) + 'K';
    return String(ops);
  }

  function startMetricsLoop(panel) {
    const MAX_BARS = 30;

    const elapsedEl     = panel.querySelector('#eko-panel-elapsed');
    const blockedEl     = panel.querySelector('#eko-panel-blocked');
    const opsEl         = panel.querySelector('#eko-panel-ops');
    const impactLabel   = panel.querySelector('#eko-panel-impact-label');
    const tickEl        = panel.querySelector('#eko-panel-tick');
    const tickValueEl   = panel.querySelector('#eko-panel-tick-value');
    const avgEl         = panel.querySelector('#eko-panel-avg');
    const fpsEl         = panel.querySelector('#eko-panel-fps');
    const blockRateEl   = panel.querySelector('#eko-panel-block-rate');
    const statusText    = panel.querySelector('#eko-panel-status-text');
    const banner        = panel.querySelector('.eko-active-banner');
    const progressWrap  = panel.querySelector('#eko-panel-progress');
    const progressBar   = panel.querySelector('#eko-panel-progress-bar');
    const progressText  = panel.querySelector('#eko-panel-progress-text');

    const interval = setInterval(() => {
      const state = window.__stressState;
      if (!state) return;

      const elapsed = state.elapsedMs / 1000;
      elapsedEl.textContent = elapsed.toFixed(1) + 's';
      blockedEl.textContent = Math.round(state.blockedTime) + 'ms';
      opsEl.textContent = formatOps(state.totalOps);

      // Progress bar
      if (state.duration > 0) {
        progressWrap.style.display = 'block';
        const pct = Math.min((elapsed / state.duration) * 100, 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = Math.round(pct) + '%';
      }

      // Impact meter
      const graphData = state.graphData || [];
      if (graphData.length > 0) {
        const recent = graphData.slice(-MAX_BARS);
        const avgBlock = recent.reduce((a, b) => a + b, 0) / recent.length;
        const fps = Math.max(1, Math.round(1000 / (avgBlock + 16.67)));
        const blockRate = state.elapsedMs > 0
          ? Math.min(100, (state.blockedTime / state.elapsedMs) * 100)
          : 0;
        const impact = Math.min(100, blockRate);

        tickEl.style.left = impact + '%';
        tickValueEl.textContent = Math.round(impact) + '%';

        let label = 'Low', color = 'var(--eko-success)';
        if (impact > 75)      { label = 'Severe'; color = 'var(--eko-danger)'; }
        else if (impact > 50) { label = 'High';   color = 'var(--eko-warning)'; }
        else if (impact > 25) { label = 'Medium'; color = '#f59e0b'; }
        impactLabel.textContent = label;
        impactLabel.style.color = color;

        avgEl.textContent = Math.round(avgBlock) + 'ms';
        fpsEl.textContent = fps + 'fps';
        fpsEl.style.color = fps < 15 ? 'var(--eko-danger)' : fps < 30 ? 'var(--eko-warning)' : 'var(--eko-success)';
        blockRateEl.textContent = Math.round(blockRate) + '%';
        blockRateEl.style.color = blockRate > 75 ? 'var(--eko-danger)' : blockRate > 50 ? 'var(--eko-warning)' : 'var(--eko-text)';
      }

      if (!state.active) {
        clearInterval(interval);
        panel.classList.remove('running');
        panel.querySelector('.status-dot')?.classList.remove('running');
        statusText.textContent = 'Completed';
        banner.style.display = 'none';
        if (impactLabel) {
          impactLabel.textContent = 'Done';
          impactLabel.style.color = 'var(--eko-success)';
        }
      }
    }, 100);
  }

  function removePanel() {
    const panel = document.getElementById('eko-stress-panel-ext');
    if (panel) panel.remove();
  }

  window.__ekoStressPanel = { createPanel, removePanel };

  // Listen for start/stop to show/hide panel
  document.addEventListener('eko-ext-to-page', (e) => {
    let msg;
    try { msg = JSON.parse(e.detail); } catch (_) { return; }
    if (msg.type === 'eko-stress-start') {
      createPanel();
    } else if (msg.type === 'eko-stress-stop') {
      removePanel();
    }
  });
})();
