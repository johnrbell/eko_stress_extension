'use strict';

(() => {
  if (window.__ekoStressEngine) return;

  const INTENSITY_SETTINGS = {
    off:     { iterations: 0,       blockMs: 0,   layoutOps: 0,   memoryAllocs: 0,   domOps: 0,   networkOps: 0,   yieldMs: 0 },
    low:     { iterations: 8000,    blockMs: 15,  layoutOps: 8,   memoryAllocs: 3,   domOps: 2,   networkOps: 2,   yieldMs: 80 },
    medium:  { iterations: 80000,   blockMs: 80,  layoutOps: 40,  memoryAllocs: 15,  domOps: 8,   networkOps: 8,   yieldMs: 50 },
    high:    { iterations: 400000,  blockMs: 250, layoutOps: 125, memoryAllocs: 45,  domOps: 25,  networkOps: 25,  yieldMs: 30 },
    extreme: { iterations: 2000000, blockMs: 800, layoutOps: 500, memoryAllocs: 150, domOps: 100, networkOps: 100, yieldMs: 16 }
  };

  window.__ekoStressEngine = {
    start(settings) {
      if (window.__stressState?.active) return;

      const intensity = settings.intensity || 'medium';
      if (intensity === 'off') {
        console.log('%c[eko Stress] OFF - no load', 'background:#71717a;color:white;padding:4px 8px;border-radius:4px;');
        return;
      }

      const cfg = INTENSITY_SETTINGS[intensity] || INTENSITY_SETTINGS.medium;
      const config = {
        js:        settings.js !== false,
        layout:    settings.layout !== false,
        longtasks: settings.longtasks !== false,
        memory:    !!settings.memory,
        dom:       !!settings.dom,
        network:   !!settings.network
      };

      const duration = settings.duration ?? 30;
      const startTime = performance.now();
      const endTime = duration > 0 ? startTime + (duration * 1000) : Infinity;

      const graphData = [];
      const maxGraphPoints = 60;

      window.__stressState = {
        active: true,
        startTime,
        endTime,
        intensity,
        duration,
        config,
        totalOps: 0,
        blockedTime: 0,
        elapsedMs: 0,
        graphData
      };

      performance.mark('eko-stress-start');

      console.log(
        '%c[eko Stress] ACTIVE',
        'background:linear-gradient(90deg,#6366f1,#8b5cf6);color:white;padding:8px 16px;font-weight:bold;border-radius:4px;',
        { intensity, duration, config, cfg }
      );

      // Initial synchronous block during page activity
      if (config.longtasks) {
        const syncStart = performance.now();
        const syncDuration = cfg.blockMs;
        const heavyWork = [];
        while (performance.now() - syncStart < syncDuration) {
          let x = Math.sqrt(Math.random() * 1000000);
          x = Math.sin(x) * Math.cos(x) * Math.tan(x);
          const str = 'stress'.repeat(100) + Math.random().toString(36);
          const hash = str.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          heavyWork.push({ x, hash, arr: new Array(100).fill(x) });
          if (heavyWork.length > 1000) heavyWork.length = 0;
          window.__stressState.totalOps++;
        }
        const initialBlock = performance.now() - syncStart;
        window.__stressState.blockedTime += initialBlock;
        graphData.push(initialBlock);
        console.log(`%c[eko Stress] Initial block: ${Math.round(initialBlock)}ms`, 'color:#f97316;font-weight:bold;');
      }

      let frameCount = 0;

      function blockMainThread() {
        frameCount++;
        const state = window.__stressState;

        if (!state || !state.active) {
          console.log('%c[eko Stress] Completed', 'background:#10b981;color:white;padding:4px 8px;border-radius:4px;');
          console.log(`   Blocked: ${Math.round(state?.blockedTime || 0)}ms | Ops: ${(state?.totalOps || 0).toLocaleString()}`);
          performance.mark('eko-stress-end');
          performance.measure('eko-stress-duration', 'eko-stress-start', 'eko-stress-end');
          document.dispatchEvent(new CustomEvent('eko-page-to-ext', {
            detail: JSON.stringify({ type: 'test-ended' })
          }));
          return;
        }

        if (performance.now() > state.endTime) {
          state.active = false;
          blockMainThread();
          return;
        }

        const blockStart = performance.now();
        let result = 0;
        const heavyWork = [];

        // JS compute
        if (config.js) {
          for (let i = 0; i < cfg.iterations; i++) {
            result += Math.sqrt(Math.random() * 1000000);
            result = Math.sin(result) * Math.cos(result);
            result = Math.tan(Math.atan(result));
            if (i % 10000 === 0) {
              const str = 'block'.repeat(50) + result.toString(36);
              heavyWork.push({ i, str: str.slice(0, 100), arr: [result, result * 2] });
              if (heavyWork.length > 100) heavyWork.length = 0;
            }
            state.totalOps++;
          }
        }

        // Layout thrashing
        if (config.layout && document.body) {
          for (let i = 0; i < cfg.layoutOps; i++) {
            const _h = document.body.offsetHeight;
            document.body.style.paddingBottom = (i % 2) + 'px';
            const _w = document.body.offsetWidth;
            document.body.style.paddingBottom = '';
            if (i % 20 === 0) {
              const els = document.querySelectorAll('div, span, img');
              let count = 0;
              els.forEach(el => { if (count++ < 50) el.getBoundingClientRect(); });
            }
          }
        }

        // Extra synchronous blocking
        if (config.longtasks) {
          const extraStart = performance.now();
          const extraDuration = cfg.blockMs / 4;
          while (performance.now() - extraStart < extraDuration) {
            Math.random() * Math.random();
            state.totalOps++;
          }
        }

        // Memory pressure
        if (config.memory) {
          const chunks = [];
          for (let i = 0; i < cfg.memoryAllocs; i++) {
            const chunk = new Float64Array(10000);
            for (let j = 0; j < chunk.length; j++) chunk[j] = Math.random() * i;
            chunks.push(chunk);
            if (chunks.length > 50) chunks.splice(0, 25);
            state.totalOps++;
          }
        }

        // DOM render tree stress
        if (config.dom && document.body) {
          const container = document.createElement('div');
          container.style.cssText = 'position:absolute;opacity:0;pointer-events:none;left:-9999px;';
          document.body.appendChild(container);
          for (let i = 0; i < cfg.domOps; i++) {
            const fragment = document.createDocumentFragment();
            let parent = fragment;
            for (let d = 0; d < 10; d++) {
              const child = document.createElement('div');
              child.className = 'stress-node-' + d;
              child.textContent = 'Node ' + i + '-' + d;
              parent.appendChild(child);
              parent = child;
            }
            container.appendChild(fragment);
            if (container.childNodes.length > 100) container.innerHTML = '';
            state.totalOps++;
          }
          container.remove();
        }

        // Network / event loop
        if (config.network) {
          for (let i = 0; i < cfg.networkOps; i++) {
            const blob = new Blob([JSON.stringify({ stress: i, data: 'x'.repeat(1000) })]);
            const url = URL.createObjectURL(blob);
            fetch(url)
              .then(r => r.json())
              .then(() => { URL.revokeObjectURL(url); state.totalOps++; })
              .catch(() => URL.revokeObjectURL(url));
          }
          state.totalOps += cfg.networkOps;
        }

        const blockDuration = performance.now() - blockStart;
        state.blockedTime += blockDuration;
        state.elapsedMs = performance.now() - state.startTime;
        window.__stressResult = result;

        graphData.push(blockDuration);
        if (graphData.length > maxGraphPoints) graphData.shift();

        // Relay metrics periodically
        if (frameCount % 25 === 0) {
          document.dispatchEvent(new CustomEvent('eko-page-to-ext', {
            detail: JSON.stringify({
              type: 'metrics-update',
              metrics: {
                elapsedMs: state.elapsedMs,
                blockedTime: state.blockedTime,
                totalOps: state.totalOps,
                active: state.active
              }
            })
          }));
        }

        setTimeout(blockMainThread, cfg.yieldMs);
      }

      blockMainThread();
    },

    stop() {
      if (window.__stressState) {
        window.__stressState.active = false;
      }
    }
  };

  // Listen for start/stop commands from the bridge (document is shared across worlds)
  document.addEventListener('eko-ext-to-page', (e) => {
    let msg;
    try { msg = JSON.parse(e.detail); } catch (_) { return; }
    if (msg.type === 'eko-stress-start') {
      window.__ekoStressEngine.start(msg.settings);
    } else if (msg.type === 'eko-stress-stop') {
      window.__ekoStressEngine.stop();
    }
  });

  function injectGateOverlay(settings) {
    var intensityLabels = { low: 'Low', medium: 'Medium', high: 'High', extreme: 'Extreme' };
    var active = [];
    if (settings.js !== false) active.push('JS Compute');
    if (settings.layout !== false) active.push('Layout');
    if (settings.longtasks !== false) active.push('Long Tasks');
    if (settings.memory) active.push('Memory');
    if (settings.dom) active.push('DOM');
    if (settings.network) active.push('Event Loop');
    if (settings.ekoNetworkDelay) active.push('eko Net Delay');
    if (settings.ekoDomTargeting) active.push('eko DOM');
    if (settings.ekoRenderInterference) active.push('eko Render');
    var networkLabel = settings.networkThrottle && settings.networkThrottle !== 'none'
      ? settings.networkThrottle.replace('fast3g', 'Fast 3G').replace('slow3g', 'Slow 3G').replace('regular2g', '2G').replace('offline', 'Offline')
      : null;
    var durationLabel = settings.duration > 0 ? settings.duration + 's' : 'Unlimited';

    var tagsHtml = '<span style="border-color:#6366f1;color:#a5b4fc;background:rgba(99,102,241,.1);padding:5px 12px;border-radius:6px;font-size:11px;border:1px solid #6366f1;display:inline-block">'
      + (intensityLabels[settings.intensity] || settings.intensity) + '</span> '
      + '<span style="background:#1f1f28;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:5px 12px;font-size:11px;color:#a1a1aa;display:inline-block">' + durationLabel + '</span> ';
    if (networkLabel) tagsHtml += '<span style="border-color:#6366f1;color:#a5b4fc;background:rgba(99,102,241,.1);padding:5px 12px;border-radius:6px;font-size:11px;border:1px solid #6366f1;display:inline-block">' + networkLabel + '</span> ';
    if (settings.disableCache !== false) tagsHtml += '<span style="background:#1f1f28;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:5px 12px;font-size:11px;color:#a1a1aa;display:inline-block">No Cache</span> ';
    for (var i = 0; i < active.length; i++) {
      tagsHtml += '<span style="background:#1f1f28;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:5px 12px;font-size:11px;color:#a1a1aa;display:inline-block">' + active[i] + '</span> ';
    }

    // Build the gate using direct DOM manipulation with all styles inline.
    // At document_start, <head>/<body> may not exist, so we construct them.
    var root = document.documentElement;
    root.innerHTML = '';

    var head = document.createElement('head');
    root.appendChild(head);

    var body = document.createElement('body');
    body.setAttribute('style', 'margin:0;padding:0;background:#0f0f14;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#f4f4f5');

    body.innerHTML = '<div style="text-align:center;max-width:440px;padding:40px">'
      + '<svg width="68" height="30" viewBox="0 0 45 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:16px">'
      + '<path d="M30.0606 5.62405H24.8662L20.5566 12.4505V0H16.1478V19.6728H20.0074L22.8143 15.7534L25.6213 19.6728H31.2658L25.4154 12.1157L30.0606 5.62405Z" fill="white"/>'
      + '<path fill-rule="evenodd" clip-rule="evenodd" d="M29.5267 12.6408C29.5267 8.57686 32.8295 5.28158 36.9026 5.28158C40.9834 5.28158 44.2862 8.57686 44.2786 12.6408C44.2786 16.7047 40.9758 20 36.9026 20C32.8295 20 29.5267 16.7047 29.5267 12.6408ZM33.9507 12.6484C33.9507 14.4597 35.2703 15.7686 36.9026 15.7686C38.535 15.7686 39.8545 14.4521 39.8545 12.6484C39.8545 10.8371 38.535 9.52055 36.9026 9.52055C35.2703 9.52055 33.9507 10.8371 33.9507 12.6484Z" fill="white"/>'
      + '<path fill-rule="evenodd" clip-rule="evenodd" d="M0 12.6408C0 8.57686 3.30278 5.28158 7.37595 5.28158C11.4491 5.28158 14.7519 8.57686 14.7519 12.6408C14.7519 13.1126 14.7061 13.5769 14.6222 14.0259H4.41642C4.91984 15.449 6.03348 16.172 7.41409 16.172C8.73368 16.172 9.32863 15.7839 9.79392 15.2359H14.279C13.2264 18.0213 10.5338 20 7.37595 20C3.30278 20 0 16.7047 0 12.6408ZM7.37595 9.14002C6.03348 9.14002 4.88933 9.9315 4.41641 11.2557H10.3355C9.87019 9.9315 8.71842 9.14002 7.37595 9.14002Z" fill="white"/>'
      + '</svg>'
      + '<h1 style="font-size:22px;font-weight:700;margin:0 0 6px;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Stress Test Ready</h1>'
      + '<p style="color:#a1a1aa;font-size:13px;margin:0 0 24px;line-height:1.5">Stress will activate when the page loads.<br>Click below to begin.</p>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:28px">' + tagsHtml + '</div>'
      + '<button id="ekoGateLoad" style="display:inline-block;padding:14px 48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:600;border:none;border-radius:10px;cursor:pointer;letter-spacing:.3px">Load Page Now</button>'
      + '<br>'
      + '<button id="ekoGateCancel" style="display:inline-block;margin-top:16px;color:#71717a;font-size:12px;cursor:pointer;background:none;border:none;text-decoration:underline">Cancel Test</button>'
      + '</div>';

    root.appendChild(body);

    document.getElementById('ekoGateLoad').addEventListener('click', function() {
      document.cookie = 'ekoStressGate=;path=/;max-age=0';
      location.reload();
    });

    document.getElementById('ekoGateCancel').addEventListener('click', function() {
      document.cookie = 'ekoStressGate=;path=/;max-age=0';
      document.cookie = 'ekoStressSettings=;path=/;max-age=0';
      location.reload();
    });
  }

  // Synchronous auto-start from cookie at document_start.
  const cookieMatch = document.cookie.match(/ekoStressSettings=([^;]+)/);
  if (cookieMatch) {
    try {
      const settings = JSON.parse(decodeURIComponent(cookieMatch[1]));
      const isGate = /ekoStressGate=1/.test(document.cookie);

      if (isGate) {
        // Phase 1 (GATE): replace the document immediately before any page
        // content loads. Don't start the stress engine yet -- it will start
        // on Phase 2 when the user clicks "Load Page Now".
        window.stop();
        injectGateOverlay(settings);
        return; // exit the IIFE entirely during gate phase
      }

      // Phase 2 (ACTIVE): start stress, page loads normally under stress
      window.__ekoStressEngine.start(settings);
    } catch (_) {}
  }

  // Async fallback: bridge may set a DOM attribute after reading storage
  if (!window.__stressState?.active) {
    const autoData = document.documentElement.getAttribute('data-eko-stress');
    if (autoData) {
      try {
        const msg = JSON.parse(autoData);
        if (msg.type === 'eko-stress-start' && msg.settings) {
          window.__ekoStressEngine.start(msg.settings);
        }
      } catch (_) {}
    }
  }
})();
