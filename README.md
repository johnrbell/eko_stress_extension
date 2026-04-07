# eko Stress Test - Chrome Extension

A Chrome extension that stress tests the eko player integration on any website. Simulates real-world performance issues (CPU load, long tasks, layout thrashing, memory pressure) and includes eko-specific targeting modes that can selectively degrade network requests, DOM operations, and rendering for eko components.

## Background

The eko player is now rendered as a **same-page component** (not an iframe). This means it shares the main thread with the host page, making it directly susceptible to JavaScript contention, layout thrashing, and other performance issues caused by third-party scripts. This extension simulates those conditions so you can measure how the eko gallery experience degrades under realistic browser stress.

Previously this was a Shopify Liquid snippet (`cpu-stress-test.liquid`) injected into theme files. The Chrome extension approach removes the dependency on Shopify theme access and works on any page, including the Next.js-based gallery app.

**Test page:** https://dianadevstores.eko.com/nextjs-pages-router/gallery-app/tv

---

## Installation

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select this `stress-extension/` directory

The eko icon will appear in your toolbar.

---

## Usage

### Quick Start

1. Navigate to any page with an eko player (e.g. the [test page](https://dianadevstores.eko.com/nextjs-pages-router/gallery-app/tv))
2. Click the extension icon in the toolbar
3. Configure intensity, duration, and stress types
4. Click **Start Test**
5. A floating metrics panel appears on the page showing live results (elapsed time, blocked time, operations, impact meter, estimated FPS, block rate)
6. Click **Stop** or wait for the duration to expire

### Popup Controls

| Control | Options | Description |
|---------|---------|-------------|
| **Intensity** | Off / Low / Med / High / Max | Scales all stress parameters proportionally |
| **Duration** | 5s / 10s / 15s / 30s / 60s / Infinite | How long the test runs |
| **JS Compute** | On/Off | Heavy math operations (sqrt, sin, cos, tan) blocking the main thread |
| **Layout Shift** | On/Off | Forced reflows via interleaved reads/writes of layout properties |
| **Long Tasks** | On/Off | Synchronous busy-wait loops that create >50ms "Long Task" entries |
| **Memory** | On/Off | `Float64Array` allocations and partial releases to trigger GC pauses |
| **DOM Tree** | On/Off | Creation and removal of deeply nested DOM node trees |
| **Event Loop** | On/Off | Blob-URL fetch calls that saturate the microtask queue |

### eko-Specific Targeting

These modes selectively target the eko player component and its resources. Since the player now runs on the same main thread (no iframe isolation), these directly interfere with its rendering and data loading:

| Mode | What It Does |
|------|-------------|
| **Network Delay** | Adds 200ms-2000ms latency (scaled by intensity) to `fetch` and `XHR` requests matching eko URL patterns: `visually-io.com`, `live.visually-io.com`, `play.eko.com`, `video.eko.com`, `vsly-preact`, `visually.js` |
| **DOM Targeting** | Uses `MutationObserver` to find eko gallery elements (`.eko-smart-gallery-container`, `.eko-gallery`, `[class*="vsly"]`, `[data-vsly]`, `[class*="eko-"]`, `[data-eko]`) and aggressively thrashes their subtrees with forced reflows, style mutations, and `getBoundingClientRect` reads |
| **Render Interference** | Attaches `ResizeObserver` and `IntersectionObserver` to eko elements, triggering heavy canvas paint work and forced compositing synchronized with component visibility/size changes |

### Intensity Levels

| Level | Main Thread Blocking | User Experience |
|-------|---------------------|-----------------|
| **Off** | 0% | Normal page, no artificial stress |
| **Low** | ~45% | Minor delays, mostly smooth |
| **Medium** | ~65% | Noticeable lag, some frustration |
| **High** | ~82% | Significant freezing, poor UX |
| **Extreme** | ~99% | Page nearly unusable |

---

## Architecture

```
stress-extension/
  manifest.json                 # Manifest V3 extension config
  background/
    service-worker.js           # State management, script injection, messaging hub
  popup/
    popup.html                  # Extension popup UI
    popup.css                   # Popup styles (eko dark theme)
    popup.js                    # Settings management, start/stop logic
  content/
    content-bridge.js           # ISOLATED world: message relay between extension and page
    stress-engine.js            # MAIN world: core stress test loop (from cpu-stress-test.liquid)
    eko-targeting.js            # MAIN world: eko-specific stress modes (new)
    panel.js                    # MAIN world: floating metrics panel
    panel.css                   # Panel styles injected into the page
  icons/
    icon16.png                  # Toolbar icon
    icon48.png                  # Extensions page icon
    icon128.png                 # Chrome Web Store icon
```

### Messaging Flow

The extension uses a three-layer architecture required by Manifest V3:

```
popup.js
  -- chrome.runtime.sendMessage -->
    service-worker.js
      -- chrome.scripting.executeScript (injects scripts) -->
      -- chrome.tabs.sendMessage -->
        content-bridge.js [ISOLATED world]
          -- document CustomEvent (JSON-serialized) -->
            stress-engine.js [MAIN world]
            eko-targeting.js [MAIN world]
            panel.js [MAIN world]
```

MAIN world scripts must run in the page's JavaScript context to block the main thread and access `window`, DOM APIs, `fetch`, and `XMLHttpRequest`. The ISOLATED world bridge is needed because MAIN world scripts cannot access `chrome.runtime`. Event payloads are JSON-stringified to cross the world boundary cleanly.

---

## How It Works

When you click **Start Test**, the service worker injects four scripts into the active tab:

1. **content-bridge.js** (isolated world) -- sets up bidirectional message relay using `document` CustomEvents
2. **stress-engine.js** (main world) -- starts the stress loop: an initial synchronous block followed by a `setTimeout(..., 4)` recurring loop that performs JS compute, layout thrashing, memory allocation, DOM manipulation, and event loop saturation based on config
3. **eko-targeting.js** (main world) -- if enabled, monkey-patches `fetch`/`XHR` for network delay, starts `MutationObserver`-based DOM thrashing on eko elements, and attaches `ResizeObserver`/`IntersectionObserver` for render interference
4. **panel.js** (main world) + **panel.css** -- creates a draggable, collapsible floating panel that polls `window.__stressState` every 100ms and displays live metrics

When the test ends (by duration expiry or manual stop), each module cleans up: the stress loop exits, network patches are restored, observers are disconnected, and the panel is removed from the DOM.

Settings persist in `chrome.storage.local` across sessions.

---

## Troubleshooting

### Extension icon is grayed out / "Start Test" does nothing

The `activeTab` permission only grants access when the user clicks the extension icon. If the page is a restricted URL (`chrome://`, `chrome-extension://`, Chrome Web Store), script injection will fail. Navigate to a regular `http://` or `https://` page.

### Panel doesn't appear on the page

Open DevTools Console and look for `[eko Stress]` log entries. If scripts were injected but the panel isn't visible, it may be hidden behind a high z-index element on the page. The panel uses `z-index: 2147483647` (max 32-bit int) to stay on top.

### eko-specific targeting modes have no visible effect

The DOM Targeting and Render Interference modes rely on finding eko elements in the page using CSS selectors like `.eko-gallery` and `[class*="vsly"]`. If the eko player uses different class names on the page you're testing, the selectors in `content/eko-targeting.js` (`EKO_SELECTORS` array) may need updating.

Network Delay only affects requests matching URL patterns in `EKO_URL_PATTERNS`. Check the Console for `[eko Target] Delaying fetch` log entries to confirm requests are being intercepted.

### Stress test doesn't feel intense enough

Make sure **Long Tasks** is enabled -- it provides the synchronous blocking that creates the most perceptible main-thread contention. At **Extreme** intensity, the initial synchronous block alone is 2400ms.

### Running multiple tests in a row

Stop the current test before starting a new one. Each script guards against double-initialization (`if (window.__ekoStressEngine) return`), so re-injecting on the same page reuses the existing instances and sends fresh start commands.

---

## License

Internal use only -- eko team.
