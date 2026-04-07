'use strict';

(() => {
  if (window.__ekoStressEngine) return;

  const INTENSITY_SETTINGS = {
    off:     { iterations: 0,       blockMs: 0,   layoutOps: 0,   memoryAllocs: 0,   domOps: 0,   networkOps: 0 },
    low:     { iterations: 8000,    blockMs: 15,  layoutOps: 8,   memoryAllocs: 3,   domOps: 2,   networkOps: 2 },
    medium:  { iterations: 80000,   blockMs: 80,  layoutOps: 40,  memoryAllocs: 15,  domOps: 8,   networkOps: 8 },
    high:    { iterations: 400000,  blockMs: 250, layoutOps: 125, memoryAllocs: 45,  domOps: 25,  networkOps: 25 },
    extreme: { iterations: 2000000, blockMs: 800, layoutOps: 500, memoryAllocs: 150, domOps: 100, networkOps: 100 }
  };

  window.__ekoStressEngine = {
    start(settings) {
      this.stop();

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
        const syncDuration = cfg.blockMs * 3;
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

        setTimeout(blockMainThread, 4);
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
})();
