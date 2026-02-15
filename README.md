# eko Stress Test Suite

A complete performance testing toolkit for measuring how CPU/JS stress affects the eko gallery user experience on Shopify stores. Includes a Liquid snippet that simulates various levels of browser stress, plus automated Playwright-based testing with visual D3.js reports.

---

## Table of Contents

- [Overview](#overview)
- [Part 1: Stress Test Snippet](#part-1-stress-test-snippet)
  - [What It Does](#what-it-does)
  - [Installation](#installation)
  - [URL Parameters](#url-parameters)
  - [Using the Control Panel](#using-the-control-panel)
- [Part 2: Automated Performance Testing](#part-2-automated-performance-testing)
  - [Quick Start](#quick-start)
  - [Configuration](#configuration)
  - [Running Tests](#running-tests)
  - [Visual Reports](#visual-reports)
- [Understanding Results](#understanding-results)
- [Troubleshooting](#troubleshooting)

---

## Overview

This toolkit helps answer the question: **"How does third-party JavaScript affect the eko gallery experience?"**

It consists of two parts:

1. **Stress Test Snippet** (`cpu-stress-test.liquid`) - A Shopify Liquid snippet that simulates various levels of browser stress (CPU load, long tasks, memory pressure, etc.)

2. **Automated Testing Tool** (`perf-test/`) - A Playwright-based Node.js tool that automatically runs the stress test at different intensity levels and generates comparative reports

---

## Part 1: Stress Test Snippet

### What It Does

The stress test snippet simulates real-world performance issues that can affect e-commerce sites:

| Stress Type | What It Simulates |
|-------------|-------------------|
| **JS Compute** | Heavy JavaScript calculations (analytics, A/B testing scripts) |
| **Long Tasks** | Main thread blocking (chat widgets, personalization engines) |
| **Layout Thrashing** | Forced reflows/repaints (carousels, dynamic content) |
| **Memory Pressure** | Garbage collection stress (memory leaks, large DOM) |
| **DOM Operations** | Heavy render tree updates (infinite scroll, live updates) |
| **Network/Event Loop** | Async operations flooding the event loop |

### Installation

#### Step 1: Copy the Snippet File

Copy `snippets/cpu-stress-test.liquid` to your Shopify theme's `snippets/` folder.

**Option A: Via Shopify Admin**
1. Go to **Online Store → Themes**
2. Click **⋯ → Edit code** on your development theme
3. Under **Snippets**, click **Add a new snippet**
4. Name it `cpu-stress-test`
5. Paste the contents of `snippets/cpu-stress-test.liquid`
6. Click **Save**

**Option B: Via Shopify CLI**
```bash
# If you have theme files locally
cp snippets/cpu-stress-test.liquid /path/to/your-theme/snippets/
shopify theme push
```

#### Step 2: Add the Render Tag to theme.liquid

Open your theme's `layout/theme.liquid` file and add the render tag inside the `<head>` section:

```liquid
<!doctype html>
<html>
  <head>
    {%- comment -%} eko CPU Stress Test - Only on Product Pages {%- endcomment -%}
    {%- if request.page_type == 'product' -%}
      {% render 'cpu-stress-test' %}
    {%- endif -%}
    
    <!-- ... rest of your head content ... -->
  </head>
```

**Important placement notes:**
- Place it **at the very top** of the `<head>` section (before other scripts)
- The stress test runs synchronously during page parse to simulate real blocking scripts
- The conditional `request.page_type == 'product'` limits it to product pages only

#### Step 3: Save and Preview

1. Save `theme.liquid`
2. Preview your theme (don't publish to live!)
3. Navigate to any product page
4. You should see the eko Stress Panel in the bottom-right corner

### URL Parameters

Control the stress test via URL parameters for easy sharing and automation:

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `stress` | `1` | - | **Required** to auto-start the test |
| `intensity` | `off`, `low`, `medium`, `high`, `extreme` | `medium` | Stress level |
| `duration` | `5`, `10`, `15`, `30`, `60`, `0` | `30` | Seconds (0 = infinite) |
| `js` | `0`, `1` | `1` | Enable JS compute stress |
| `layout` | `0`, `1` | `1` | Enable layout thrashing |
| `longtasks` | `0`, `1` | `1` | Enable long blocking tasks |
| `memory` | `0`, `1` | `0` | Enable memory pressure |
| `dom` | `0`, `1` | `0` | Enable DOM stress |
| `network` | `0`, `1` | `0` | Enable network/event loop stress |

#### Example URLs

```bash
# Medium stress for 10 seconds (good for demos)
https://your-store.myshopify.com/products/test-product?stress=1&intensity=medium&duration=10

# High stress with all options enabled
https://your-store.myshopify.com/products/test-product?stress=1&intensity=high&duration=30&js=1&layout=1&longtasks=1&memory=1&dom=1&network=1

# Extreme stress (simulates worst-case scenario)
https://your-store.myshopify.com/products/test-product?stress=1&intensity=extreme&duration=5

# Baseline - no stress (for comparison)
https://your-store.myshopify.com/products/test-product?stress=1&intensity=off
```

**Don't forget the preview_theme_id!** If testing an unpublished theme:
```
?preview_theme_id=YOUR_THEME_ID&stress=1&intensity=high&duration=10
```

### Using the Control Panel

When the snippet is installed, a control panel appears on product pages:

- **Intensity Selector** - Choose stress level (off/low/medium/high/extreme)
- **Duration Selector** - How long the test runs
- **Stress Type Toggles** - Enable/disable specific stress types
- **Start/Stop Button** - Manually control the test
- **Live Metrics** - Shows blocked time, FPS, and operations in real-time
- **Performance Graph** - Visual timeline of stress impact

The panel is draggable and can be collapsed.

### Intensity Levels Explained

| Level | Main Thread Blocking | User Experience |
|-------|---------------------|-----------------|
| **Off** | 0% | Normal page, no artificial stress |
| **Low** | ~45% | Minor delays, mostly smooth |
| **Medium** | ~65% | Noticeable lag, some frustration |
| **High** | ~82% | Significant freezing, poor UX |
| **Extreme** | ~99% | Page nearly unusable |

---

## Part 2: Automated Performance Testing

The `perf-test/` folder contains a Playwright-based tool that automatically runs stress tests and generates reports.

### Quick Start

```bash
# 1. Navigate to the perf-test folder
cd perf-test

# 2. Install dependencies
npm install

# 3. Configure settings in run-perf-tests.js (see Configuration)

# 4. Run tests AND generate visual report
npm run test:report

# 5. Open the visual report
open reports/visual-report.html
```

### Configuration

Edit the `CONFIG` object at the top of `run-perf-tests.js`:

```javascript
const CONFIG = {
  // REQUIRED: Your store's product page URL (without query params)
  baseUrl: 'https://your-store.myshopify.com/products/your-product',
  
  // REQUIRED: The preview theme ID containing the stress test snippet
  // Find this in the Shopify admin URL when previewing your theme
  previewThemeId: '185250185506',
  
  // REQUIRED if store is password protected, otherwise set to null
  storePassword: 'your-password',  // or null
  
  // Intensity levels to test
  intensities: ['off', 'low', 'medium', 'high', 'extreme'],
  
  // How long each stress test runs (seconds)
  stressDuration: 10,
  
  // Wait time after page load to collect metrics (ms)
  settleTime: 5000,
  
  // Number of runs per intensity (higher = more accurate)
  runsPerLevel: 1,
};
```

#### Finding Your Preview Theme ID

1. Go to **Shopify Admin → Online Store → Themes**
2. Click **Customize** on your development theme
3. Look at the URL: `...?preview_theme_id=XXXXXXXXX`
4. Copy that number into `previewThemeId`

### Running Tests

| Command | Description |
|---------|-------------|
| `npm run test:report` | Run tests + generate visual report (recommended) |
| `npm test` | Run tests only |
| `npm run test:quick` | Quick tests with shorter duration |
| `npm run report` | Generate visual report from existing data |

### Visual Reports

The tool generates interactive HTML reports with D3.js charts:

- **Executive Summary** - Color-coded cards showing impact at each level
- **Blocking Time Chart** - Bar chart comparing main thread blocking
- **Load Time Chart** - Page load vs eko gallery load times
- **FPS & Long Tasks** - Frame rate and task count comparison
- **Core Web Vitals** - LCP, FCP, TBT, CLS with ratings
- **User Experience** - What each level feels like for users
- **Detailed Table** - All metrics in one view

Reports are saved to `perf-test/reports/`:
- `visual-report.html` - Interactive charts
- `performance-report-[timestamp].md` - Markdown summary
- `raw-data-[timestamp].json` - Raw metrics data

---

## Understanding Results

### Key Metrics

| Metric | What It Measures | Why It Matters |
|--------|-----------------|----------------|
| **Blocking Time** | Time main thread was blocked | Affects all interactions |
| **eko Gallery Load** | When gallery is ready | User's first impression |
| **Long Tasks** | Tasks >50ms | Causes visible jank |
| **FPS** | Frames per second | Animation smoothness |
| **LCP** | Largest Contentful Paint | Perceived load speed |

### User Experience Ratings

| Rating | Blocking Time | Description |
|--------|--------------|-------------|
| ✅ Smooth | < 1,000ms | Normal, responsive |
| ⚠️ Noticeable | 1,000 - 3,000ms | Some delays |
| 🔶 Frustrating | 3,000 - 6,000ms | Users may leave |
| 🚨 Unusable | > 6,000ms | Page feels broken |

---

## Troubleshooting

### Stress Panel Not Appearing

1. Verify the snippet is saved in `snippets/cpu-stress-test.liquid`
2. Check that `{% render 'cpu-stress-test' %}` is in `theme.liquid`
3. Ensure you're on a **product page** (not homepage/collection)
4. Make sure you're viewing the correct theme (check preview_theme_id)

### Automated Tests Show Zero Blocking Time

1. Verify `previewThemeId` is correct in the config
2. The stress snippet must be in the theme you're testing
3. Check console output for `[eko Stress]` logs

### Tests Fail at Password Page

1. Set `storePassword` to your store's password
2. If store is public, set `storePassword: null`

### Inconsistent Results

1. Increase `runsPerLevel` to 3+ for averaging
2. Close other browser tabs
3. Use `npm test` instead of `npm run test:quick`

---

## File Structure

```
jb-slowdowntest/
├── README.md                           # This file
├── snippets/
│   └── cpu-stress-test.liquid          # The stress test snippet
├── layout/
│   └── theme.liquid                    # Theme layout (shows where to add render tag)
└── perf-test/
    ├── run-perf-tests.js               # Main test script
    ├── generate-visual-report.js       # Report generator
    ├── package.json                    # Dependencies
    ├── README.md                       # Testing tool docs
    └── reports/
        ├── visual-report.html          # Interactive charts
        ├── performance-report-*.md     # Markdown reports
        └── raw-data-*.json             # Raw data
```

---

## License

Internal use only - eko team.
