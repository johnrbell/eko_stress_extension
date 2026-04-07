'use strict';

(() => {
  if (window.__ekoTargeting) return;

  const EKO_URL_PATTERNS = [
    'visually-io.com',
    'live.visually-io.com',
    'play.eko.com',
    'video.eko.com',
    'vsly-preact',
    'visually.js',
    'eko.com/api',
    'eko.com/v1'
  ];

  const EKO_SELECTORS = [
    '.eko-smart-gallery-container',
    '.eko-gallery',
    '[class*="vsly"]',
    '[data-vsly]',
    '[class*="eko-"]',
    '[data-eko]'
  ];

  function matchesEkoPattern(url) {
    const s = String(url).toLowerCase();
    return EKO_URL_PATTERNS.some(p => s.includes(p));
  }

  // -----------------------------------------------------------------------
  // Network Delay: monkey-patch fetch and XHR for eko-related URLs
  // -----------------------------------------------------------------------
  const originalFetch = window.fetch;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  let networkDelayMs = 0;

  function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (networkDelayMs > 0 && matchesEkoPattern(url)) {
      console.log(`%c[eko Target] Delaying fetch ${networkDelayMs}ms: ${url.slice(0, 80)}`, 'color:#f97316;');
      return new Promise(resolve => {
        setTimeout(() => resolve(originalFetch.call(window, input, init)), networkDelayMs);
      });
    }
    return originalFetch.call(window, input, init);
  }

  function patchedXhrOpen(method, url, ...rest) {
    this.__ekoUrl = url;
    return originalXhrOpen.call(this, method, url, ...rest);
  }

  function patchedXhrSend(body) {
    if (networkDelayMs > 0 && this.__ekoUrl && matchesEkoPattern(this.__ekoUrl)) {
      console.log(`%c[eko Target] Delaying XHR ${networkDelayMs}ms: ${String(this.__ekoUrl).slice(0, 80)}`, 'color:#f97316;');
      setTimeout(() => originalXhrSend.call(this, body), networkDelayMs);
      return;
    }
    return originalXhrSend.call(this, body);
  }

  function enableNetworkDelay(intensity) {
    const delays = { low: 200, medium: 500, high: 1000, extreme: 2000 };
    networkDelayMs = delays[intensity] || 500;
    window.fetch = patchedFetch;
    XMLHttpRequest.prototype.open = patchedXhrOpen;
    XMLHttpRequest.prototype.send = patchedXhrSend;
    console.log(`%c[eko Target] Network delay ON: ${networkDelayMs}ms for eko URLs`, 'color:#8b5cf6;font-weight:bold;');
  }

  function disableNetworkDelay() {
    networkDelayMs = 0;
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    XMLHttpRequest.prototype.send = originalXhrSend;
    console.log('%c[eko Target] Network delay OFF', 'color:#71717a;');
  }

  // -----------------------------------------------------------------------
  // DOM Targeting: aggressively thrash eko element subtrees
  // -----------------------------------------------------------------------
  let domTargetingActive = false;
  let domTargetingTimer = null;
  let domObserver = null;
  const trackedElements = new Set();

  function thrashElement(el) {
    if (!domTargetingActive) return;

    // Force layout reads on the element and its children
    const _h = el.offsetHeight;
    const _w = el.offsetWidth;
    el.getBoundingClientRect();

    // Mutate styles that force reflow
    const original = el.style.transform;
    el.style.transform = 'translateZ(0)';
    const _r = el.offsetHeight;
    el.style.transform = original || '';

    // Thrash children
    const children = el.querySelectorAll('*');
    let count = 0;
    children.forEach(child => {
      if (count++ > 30) return;
      child.getBoundingClientRect();
      const orig = child.style.opacity;
      child.style.opacity = '0.999';
      const _x = child.offsetWidth;
      child.style.opacity = orig || '';
    });
  }

  function domTargetingLoop() {
    if (!domTargetingActive) return;
    trackedElements.forEach(el => {
      if (document.contains(el)) thrashElement(el);
      else trackedElements.delete(el);
    });
    domTargetingTimer = setTimeout(domTargetingLoop, 16);
  }

  function scanForEkoElements() {
    const combined = EKO_SELECTORS.join(', ');
    document.querySelectorAll(combined).forEach(el => {
      if (!trackedElements.has(el)) {
        trackedElements.add(el);
        console.log(`%c[eko Target] Tracking element: ${el.tagName}.${el.className}`, 'color:#8b5cf6;');
      }
    });
  }

  function enableDomTargeting() {
    domTargetingActive = true;
    trackedElements.clear();
    scanForEkoElements();

    domObserver = new MutationObserver(() => scanForEkoElements());
    domObserver.observe(document.documentElement, { childList: true, subtree: true });

    domTargetingLoop();
    console.log(`%c[eko Target] DOM targeting ON: tracking ${trackedElements.size} elements`, 'color:#8b5cf6;font-weight:bold;');
  }

  function disableDomTargeting() {
    domTargetingActive = false;
    if (domTargetingTimer) clearTimeout(domTargetingTimer);
    if (domObserver) domObserver.disconnect();
    trackedElements.clear();
    domObserver = null;
    domTargetingTimer = null;
    console.log('%c[eko Target] DOM targeting OFF', 'color:#71717a;');
  }

  // -----------------------------------------------------------------------
  // Render Interference: ResizeObserver + IntersectionObserver on eko els
  // -----------------------------------------------------------------------
  let renderActive = false;
  let renderObservers = [];
  let renderMutationObserver = null;

  function heavyPaintWork() {
    // Offscreen canvas draw to create compositing pressure
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${Math.random()*255|0},${Math.random()*255|0},${Math.random()*255|0},0.5)`;
        ctx.fillRect(Math.random()*256, Math.random()*256, Math.random()*64, Math.random()*64);
      }
    }
    // Force a style recalc
    document.body.style.willChange = 'transform';
    const _v = document.body.offsetHeight;
    document.body.style.willChange = '';
  }

  function observeElement(el) {
    const resizeObs = new ResizeObserver(() => {
      if (!renderActive) return;
      heavyPaintWork();
    });
    resizeObs.observe(el);

    const interObs = new IntersectionObserver((entries) => {
      if (!renderActive) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) heavyPaintWork();
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    interObs.observe(el);

    renderObservers.push(resizeObs, interObs);
  }

  function scanAndObserve() {
    const combined = EKO_SELECTORS.join(', ');
    document.querySelectorAll(combined).forEach(el => {
      if (!el.__ekoRenderObserved) {
        el.__ekoRenderObserved = true;
        observeElement(el);
        console.log(`%c[eko Target] Render-observing: ${el.tagName}.${el.className}`, 'color:#8b5cf6;');
      }
    });
  }

  function enableRenderInterference() {
    renderActive = true;
    scanAndObserve();

    renderMutationObserver = new MutationObserver(() => scanAndObserve());
    renderMutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    console.log('%c[eko Target] Render interference ON', 'color:#8b5cf6;font-weight:bold;');
  }

  function disableRenderInterference() {
    renderActive = false;
    renderObservers.forEach(obs => obs.disconnect());
    renderObservers = [];
    if (renderMutationObserver) renderMutationObserver.disconnect();
    renderMutationObserver = null;

    // Clean up flags
    const combined = EKO_SELECTORS.join(', ');
    document.querySelectorAll(combined).forEach(el => {
      delete el.__ekoRenderObserved;
    });

    console.log('%c[eko Target] Render interference OFF', 'color:#71717a;');
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  window.__ekoTargeting = {
    start(settings) {
      this.stop();
      const intensity = settings.intensity || 'medium';

      if (settings.ekoNetworkDelay) enableNetworkDelay(intensity);
      if (settings.ekoDomTargeting) enableDomTargeting();
      if (settings.ekoRenderInterference) enableRenderInterference();
    },

    stop() {
      disableNetworkDelay();
      disableDomTargeting();
      disableRenderInterference();
    }
  };

  // Listen for commands from the bridge
  document.addEventListener('eko-ext-to-page', (e) => {
    let msg;
    try { msg = JSON.parse(e.detail); } catch (_) { return; }
    if (msg.type === 'eko-stress-start') {
      window.__ekoTargeting.start(msg.settings);
    } else if (msg.type === 'eko-stress-stop') {
      window.__ekoTargeting.stop();
    }
  });
})();
