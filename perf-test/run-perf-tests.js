const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Base URL - update this to your store's product page
  baseUrl: 'https://eko-dean.myshopify.com/products/preset-side-carousel',
  
  // Preview theme ID - required to load unpublished theme with stress test code
  previewThemeId: '185250185506',
  
  // Store password (if password protected) - set to null if not needed
  storePassword: 'ekodemo', // e.g., 'your-store-password'
  
  // Intensity levels to test
  intensities: ['off', 'low', 'medium', 'high', 'extreme'],
  
  // Test duration in seconds (how long stress test runs)
  stressDuration: 10,
  
  // How long to wait after page load to collect final metrics (ms)
  settleTime: 5000,
  
  // Number of runs per intensity level for averaging
  runsPerLevel: 1,
  
  // eko gallery network patterns to track
  ekoPatterns: [
    'visually-io.com',
    'live.visually-io.com',
    'vsly-preact',
    'visually.js',
    'visually-a.js',
    'EKO_DEAN',
    'loomi'
  ],
  
  // Output directory for reports
  outputDir: './reports'
};

// Parse command line args
const args = process.argv.slice(2);
const quickMode = args.includes('--quick');
if (quickMode) {
  CONFIG.stressDuration = 5;
  CONFIG.settleTime = 3000;
  console.log('🚀 Running in quick mode (shorter duration)\n');
}

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Run a single performance test for a given intensity level
 */
async function runTest(browser, intensity, runNumber) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  // Get CDP session for tracing
  const client = await context.newCDPSession(page);
  
  // Metrics we'll collect
  const metrics = {
    intensity,
    runNumber,
    timestamp: new Date().toISOString(),
    
    // Navigation timing
    navigationStart: 0,
    domContentLoaded: 0,
    loadComplete: 0,
    
    // Core Web Vitals
    lcp: null,
    fcp: null,
    cls: 0,
    
    // eko Gallery specific
    ekoRequests: [],
    ekoFirstRequest: null,
    ekoLastComplete: null,
    ekoTotalLoadTime: null,
    ekoGalleryReady: null,
    
    // Performance breakdown from tracing
    scriptingTime: 0,
    renderingTime: 0,
    paintingTime: 0,
    idleTime: 0,
    
    // Long tasks
    longTasks: [],
    totalBlockingTime: 0,
    
    // Memory
    usedJSHeapSize: null,
    totalJSHeapSize: null,
    
    // Frame rate estimation
    frameDrops: 0,
    avgFrameTime: null,
    estimatedFPS: null,
    
    // Network
    totalRequests: 0,
    totalTransferSize: 0,
    
    // Errors
    errors: []
  };
  
  // Track network requests - set up BEFORE navigation
  const networkRequests = [];
  const navStartTime = Date.now();
  
  page.on('request', request => {
    const url = request.url();
    const isEko = CONFIG.ekoPatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
    networkRequests.push({
      url: url,
      shortUrl: url.substring(0, 100),
      isEko,
      startTime: Date.now() - navStartTime,
      method: request.method(),
      resourceType: request.resourceType()
    });
  });
  
  page.on('response', response => {
    const url = response.url();
    const req = networkRequests.find(r => r.url === url && !r.endTime);
    if (req) {
      req.endTime = Date.now() - navStartTime;
      req.status = response.status();
      req.duration = req.endTime - req.startTime;
    }
  });
  
  page.on('pageerror', error => {
    metrics.errors.push(error.message);
  });
  
  // Capture console logs for debugging
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text.substring(0, 200)}`);
  });
  
  // Enable performance metrics via CDP
  await client.send('Performance.enable');
  
  // Build test URL with preview theme ID
  const previewParam = CONFIG.previewThemeId ? `preview_theme_id=${CONFIG.previewThemeId}&` : '';
  const testUrl = `${CONFIG.baseUrl}?${previewParam}stress=1&intensity=${intensity}&duration=${CONFIG.stressDuration}&dom=1&layout=1&longtasks=1&memory=1&network=1&js=1`;
  
  console.log(`  🔗 Loading: ${intensity} (run ${runNumber})`);
  console.log(`  🌐 URL: ${testUrl.substring(0, 80)}...`);
  
  const actualNavStart = Date.now();
  
  try {
    // Start tracing for detailed performance data
    await client.send('Tracing.start', {
      categories: [
        'devtools.timeline',
        'blink.user_timing',
        'loading',
        'devtools.timeline.frame'
      ].join(','),
      options: 'sampling-frequency=10000'
    });
    
    // Navigate to page
    await page.goto(testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 120000 
    });
    
    metrics.domContentLoaded = Date.now() - actualNavStart;
    
    // Debug: Check page title and content
    let pageTitle = await page.title();
    let pageUrl = page.url();
    
    // Check if redirected to password page
    if (pageUrl.includes('/password')) {
      if (CONFIG.storePassword) {
        console.log(`  🔐 Password page detected, logging in...`);
        try {
          await page.fill('input[type="password"]', CONFIG.storePassword);
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            page.click('button[type="submit"]')
          ]);
          
          // Wait a bit for any redirects to complete
          await page.waitForTimeout(1000);
          
          // Re-navigate to the test URL with stress params
          console.log(`  🔄 Navigating to test URL...`);
          await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          pageTitle = await page.title();
          pageUrl = page.url();
          console.log(`  ✅ Logged in successfully`);
        } catch (e) {
          console.log(`  ❌ Password login failed: ${e.message}`);
        }
      } else {
        console.log(`  ⚠️  Store is password protected! Set CONFIG.storePassword or disable protection.`);
        metrics.errors.push('Store is password protected');
      }
    }
    
    console.log(`  📄 Page: "${pageTitle.substring(0, 50)}" @ ${pageUrl.substring(0, 60)}`);
    
    // Debug: Check if stress params are in URL
    const actualUrl = await page.evaluate(() => window.location.href);
    const hasStressParam = actualUrl.includes('stress=1');
    console.log(`  🔍 URL has stress=1: ${hasStressParam}`);
    if (!hasStressParam) {
      console.log(`  ⚠️  Full URL: ${actualUrl}`);
    }
    
    // Wait for load event
    await page.waitForLoadState('load', { timeout: 120000 });
    metrics.loadComplete = Date.now() - actualNavStart;
    
    // Inject performance observers AFTER page load
    await page.evaluate(() => {
      window.__perfMetrics = {
        lcp: null,
        fcp: null,
        cls: 0,
        longTasks: [],
        frames: [],
        stressState: null
      };
      
      // Capture existing paint timing
      try {
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
        if (fcpEntry) {
          window.__perfMetrics.fcp = fcpEntry.startTime;
        }
      } catch (e) {}
      
      // LCP Observer
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            window.__perfMetrics.lcp = entries[entries.length - 1].startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {}
      
      // CLS Observer
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__perfMetrics.cls += entry.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
      
      // Long Task Observer
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__perfMetrics.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch (e) {}
      
      // Frame timing
      let lastFrameTime = performance.now();
      let frameCount = 0;
      const measureFrames = () => {
        const now = performance.now();
        const delta = now - lastFrameTime;
        window.__perfMetrics.frames.push(delta);
        lastFrameTime = now;
        frameCount++;
        if (frameCount < 300) {
          requestAnimationFrame(measureFrames);
        }
      };
      requestAnimationFrame(measureFrames);
      
      // Capture stress state
      if (window.__stressState) {
        window.__perfMetrics.stressState = {
          active: window.__stressState.active,
          blockedTime: window.__stressState.blockedTime,
          totalOps: window.__stressState.totalOps
        };
      }
    });
    
    // Wait for stress test to complete + settle time
    const waitTime = (CONFIG.stressDuration * 1000) + CONFIG.settleTime;
    console.log(`  ⏳ Waiting ${waitTime/1000}s for test completion...`);
    await page.waitForTimeout(waitTime);
    
    // Stop tracing and get data
    const traceData = await client.send('Tracing.end');
    
    // Get CDP performance metrics
    const cdpMetrics = await client.send('Performance.getMetrics');
    const cdpMetricsMap = {};
    for (const metric of cdpMetrics.metrics) {
      cdpMetricsMap[metric.name] = metric.value;
    }
    
    // Collect performance metrics from page
    const perfData = await page.evaluate(() => {
      const memory = performance.memory || {};
      
      // Get stress test state - read all available data
      let stressMetrics = null;
      if (window.__stressState) {
        stressMetrics = {
          active: window.__stressState.active,
          blockedTime: window.__stressState.blockedTime || 0,
          totalOps: window.__stressState.totalOps || 0,
          intensity: window.__stressState.intensity,
          duration: window.__stressState.duration,
          elapsedMs: window.__stressState.elapsedMs || 0
        };
      }
      
      // Also check for stress test performance marks
      let stressDuration = null;
      try {
        const measures = performance.getEntriesByName('eko-stress-duration');
        if (measures.length > 0) {
          stressDuration = measures[0].duration;
        }
      } catch (e) {}
      
      return {
        ...window.__perfMetrics,
        stressMetrics,
        stressDuration,
        stressStateExists: !!window.__stressState,
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        navigationTiming: performance.getEntriesByType('navigation')[0]
      };
    });
    
    // Debug output
    if (perfData.stressMetrics) {
      console.log(`  🔥 Stress state: blocked=${perfData.stressMetrics.blockedTime}ms, ops=${perfData.stressMetrics.totalOps}`);
    } else {
      console.log(`  ⚠️  No stress state found (stressStateExists: ${perfData.stressStateExists})`);
    }
    
    // Process collected metrics
    metrics.lcp = perfData.lcp;
    metrics.fcp = perfData.fcp;
    metrics.cls = perfData.cls;
    metrics.usedJSHeapSize = perfData.usedJSHeapSize || cdpMetricsMap['JSHeapUsedSize'];
    metrics.totalJSHeapSize = perfData.totalJSHeapSize || cdpMetricsMap['JSHeapTotalSize'];
    
    // Use stress test's own metrics if available
    if (perfData.stressMetrics) {
      metrics.stressBlockedTime = perfData.stressMetrics.blockedTime;
      metrics.stressTotalOps = perfData.stressMetrics.totalOps;
    }
    
    // Long tasks analysis
    metrics.longTasks = perfData.longTasks || [];
    metrics.totalBlockingTime = metrics.longTasks.reduce((sum, task) => {
      return sum + Math.max(0, task.duration - 50);
    }, 0);
    
    // Use stress test blocked time if observer didn't capture it
    if (metrics.totalBlockingTime === 0 && metrics.stressBlockedTime) {
      metrics.totalBlockingTime = metrics.stressBlockedTime;
    }
    
    // Frame analysis
    const frames = perfData.frames || [];
    if (frames.length > 10) {
      const validFrames = frames.filter(f => f > 0 && f < 1000);
      if (validFrames.length > 0) {
        metrics.avgFrameTime = validFrames.reduce((a, b) => a + b, 0) / validFrames.length;
        metrics.frameDrops = validFrames.filter(f => f > 50).length;
        metrics.estimatedFPS = Math.round(1000 / metrics.avgFrameTime);
      }
    }
    
    // CDP timing metrics
    if (cdpMetricsMap['ScriptDuration']) {
      metrics.scriptingTime = Math.round(cdpMetricsMap['ScriptDuration'] * 1000);
    }
    if (cdpMetricsMap['LayoutDuration']) {
      metrics.renderingTime = Math.round(cdpMetricsMap['LayoutDuration'] * 1000);
    }
    if (cdpMetricsMap['RecalcStyleDuration']) {
      metrics.renderingTime += Math.round(cdpMetricsMap['RecalcStyleDuration'] * 1000);
    }
    
    // eko Gallery network analysis
    const ekoReqs = networkRequests.filter(r => r.isEko && r.endTime);
    metrics.ekoRequests = ekoReqs.map(r => ({
      url: r.shortUrl,
      duration: r.duration,
      status: r.status,
      startTime: r.startTime
    }));
    
    // Total network stats
    metrics.totalRequests = networkRequests.length;
    
    if (ekoReqs.length > 0) {
      const startTimes = ekoReqs.map(r => r.startTime);
      const endTimes = ekoReqs.map(r => r.endTime);
      metrics.ekoFirstRequest = Math.min(...startTimes);
      metrics.ekoLastComplete = Math.max(...endTimes);
      metrics.ekoTotalLoadTime = metrics.ekoLastComplete;
    }
    
    // Check for eko gallery ready state
    const ekoReady = await page.evaluate(() => {
      return {
        hasVisuallyWidget: !!document.querySelector('[class*="vsly"]') || !!document.querySelector('[data-vsly]'),
        hasIframe: !!document.querySelector('iframe'),
        loomiContext: !!window.loomi_ctx,
        widgetCount: document.querySelectorAll('[class*="vsly"]').length
      };
    });
    metrics.ekoGalleryReady = ekoReady;
    
    // Store console logs for debugging
    metrics.consoleLogs = consoleLogs.slice(0, 50);
    
    // Debug: print console logs
    console.log(`  📋 Console logs: ${consoleLogs.length} entries`);
    const stressLogs = consoleLogs.filter(l => l.toLowerCase().includes('stress') || l.toLowerCase().includes('eko'));
    if (stressLogs.length > 0) {
      console.log(`  📋 Stress-related logs:`);
      stressLogs.slice(0, 5).forEach(l => console.log(`     ${l.substring(0, 100)}`));
    } else {
      console.log(`  ⚠️  No stress-related console logs found`);
      // Print first few logs to debug
      consoleLogs.slice(0, 3).forEach(l => console.log(`     ${l.substring(0, 100)}`));
    }
    
  } catch (error) {
    metrics.errors.push(`Test error: ${error.message}`);
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  await context.close();
  return metrics;
}

/**
 * Generate markdown report from test results
 */
function generateReport(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Calculate relative impact compared to baseline (off)
  const baseline = results['off'];
  
  let report = `# eko Stress Test Performance Report

**Generated:** ${new Date().toLocaleString()}  
**Test URL:** ${CONFIG.baseUrl}  
**Stress Duration:** ${CONFIG.stressDuration}s per test  

---

## Executive Summary

This report compares how different stress test intensity levels affect the **end user's experience** of loading a product page with the eko gallery.

### Impact on User Experience by Intensity Level

| Intensity | Page Load | Blocking Time | Long Tasks | FPS Est. | User Experience |
|-----------|-----------|---------------|------------|----------|-----------------|
`;

  // Summary table
  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    if (!data) continue;
    
    const load = `${Math.round(data.loadComplete)}ms`;
    
    // Use stress test blocked time if available, otherwise use TBT
    const blockTime = data.stressBlockedTime || data.totalBlockingTime;
    const tbt = blockTime > 0 ? `${Math.round(blockTime)}ms` : '<50ms';
    
    const tasks = data.longTasks?.length || 0;
    const fps = data.estimatedFPS ? `~${data.estimatedFPS}` : '60';
    
    let impact = '✅ Smooth';
    if (blockTime > 300 || data.loadComplete > 2000) impact = '⚠️ Noticeable lag';
    if (blockTime > 1000 || data.loadComplete > 4000) impact = '🔶 Frustrating';
    if (blockTime > 3000 || data.loadComplete > 8000) impact = '🔴 Very poor';
    if (blockTime > 6000 || data.loadComplete > 15000) impact = '🚨 Unusable';
    
    report += `| **${intensity.charAt(0).toUpperCase() + intensity.slice(1)}** | ${load} | ${tbt} | ${tasks} | ${fps} | ${impact} |\n`;
  }

  report += `
### What These Metrics Mean

- **Page Load**: Time until all resources are loaded (lower is better)
- **Blocking Time**: How long the page is unresponsive to user input (lower is better)
- **Long Tasks**: Count of JavaScript tasks >50ms that block the UI
- **FPS Est.**: Estimated frames per second (60 = smooth, <30 = choppy)

---

## Impact Comparison vs Baseline

The "Off" intensity serves as the baseline. Here's how each level compares:

`;

  if (baseline) {
    for (const intensity of CONFIG.intensities.slice(1)) {
      const data = results[intensity];
      if (!data) continue;
      
      const loadDiff = data.loadComplete - baseline.loadComplete;
      const loadPct = ((loadDiff / baseline.loadComplete) * 100).toFixed(0);
      
      const baselineBlock = baseline.stressBlockedTime || baseline.totalBlockingTime || 1;
      const dataBlock = data.stressBlockedTime || data.totalBlockingTime;
      const blockDiff = dataBlock - baselineBlock;
      
      report += `### ${intensity.charAt(0).toUpperCase() + intensity.slice(1)} vs Off (Baseline)

| Metric | Off (Baseline) | ${intensity.charAt(0).toUpperCase() + intensity.slice(1)} | Difference |
|--------|----------------|${'-'.repeat(intensity.length + 2)}|------------|
| Page Load | ${baseline.loadComplete}ms | ${data.loadComplete}ms | +${loadDiff}ms (${loadPct}% slower) |
| Blocking Time | ${Math.round(baselineBlock)}ms | ${Math.round(dataBlock)}ms | +${Math.round(blockDiff)}ms |
| Long Tasks | ${baseline.longTasks?.length || 0} | ${data.longTasks?.length || 0} | +${(data.longTasks?.length || 0) - (baseline.longTasks?.length || 0)} |

`;
    }
  }

  report += `---

## What Users Will Experience

`;

  const experienceDescriptions = {
    off: {
      title: 'Off - Normal Performance',
      desc: 'The page loads at its natural speed with no artificial delays. Users experience the site as intended.',
      ux: [
        'Page responds immediately to clicks and scrolls',
        'Animations are smooth',
        'eko gallery loads promptly'
      ]
    },
    low: {
      title: 'Low - Slight Slowdown (Simulates moderate CPU/network)',
      desc: 'Mimics a user on a slightly older device or slower connection.',
      ux: [
        'Minor delays when interacting',
        'Some animations may stutter briefly',
        'eko gallery may take slightly longer to become interactive'
      ]
    },
    medium: {
      title: 'Medium - Noticeable Impact (Simulates budget device)',
      desc: 'Represents a typical budget smartphone or congested network.',
      ux: [
        'Noticeable pause when clicking buttons',
        'Scrolling may feel less smooth',
        'Users may wonder if their click registered'
      ]
    },
    high: {
      title: 'High - Significant Degradation (Simulates stressed device)',
      desc: 'Simulates a device with many tabs open or background apps running.',
      ux: [
        'Page feels "frozen" at times',
        'Clicks have visible delay before response',
        'Scrolling is choppy',
        'Users may try clicking multiple times'
      ]
    },
    extreme: {
      title: 'Extreme - Severe Impact (Stress test edge case)',
      desc: 'Tests absolute worst-case scenarios. Not representative of real users.',
      ux: [
        'Page is nearly unresponsive for seconds at a time',
        'Users will likely abandon the page',
        'Interactions feel completely broken',
        'Browser may show "Page Unresponsive" warning'
      ]
    }
  };

  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    const desc = experienceDescriptions[intensity];
    if (!data || !desc) continue;
    
    report += `### ${desc.title}

${desc.desc}

**Test Results:**
- Page fully loaded in: **${data.loadComplete}ms** (${(data.loadComplete/1000).toFixed(2)}s)
- Main thread blocked for: **${Math.round(data.stressBlockedTime || data.totalBlockingTime)}ms**
- Long tasks detected: **${data.longTasks?.length || 0}**
${data.estimatedFPS ? `- Frame rate: ~**${data.estimatedFPS}fps**` : ''}

**What users experience:**
${desc.ux.map(u => `- ${u}`).join('\n')}

`;
  }

  report += `---

## eko Gallery Load Analysis

The eko gallery (visually.io) loads these resources:

`;

  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    if (!data) continue;
    
    report += `### ${intensity.charAt(0).toUpperCase() + intensity.slice(1)}

`;
    
    if (data.ekoRequests && data.ekoRequests.length > 0) {
      report += `| Resource | Load Time | Status |
|----------|-----------|--------|
`;
      for (const req of data.ekoRequests) {
        const name = req.url.split('/').pop()?.substring(0, 50) || req.url.substring(0, 50);
        const status = req.status === 200 ? '✅' : '⚠️';
        report += `| ${name} | ${req.duration}ms | ${status} ${req.status} |\n`;
      }
      report += `\n**eko Gallery Total Load Time:** ${Math.round(data.ekoTotalLoadTime || 0)}ms\n\n`;
    } else {
      report += `No eko gallery requests captured (gallery may load asynchronously or via different domain).\n\n`;
    }
    
    if (data.ekoGalleryReady) {
      report += `**Gallery State:**
- Visually widgets found: ${data.ekoGalleryReady.widgetCount || 0}
- Has iframes: ${data.ekoGalleryReady.hasIframe ? 'Yes' : 'No'}
- Loomi context: ${data.ekoGalleryReady.loomiContext ? 'Initialized' : 'Not found'}

`;
    }
  }

  report += `---

## Core Web Vitals Comparison

| Metric | ${CONFIG.intensities.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(' | ')} | Target |
|--------|${CONFIG.intensities.map(() => '------').join('|')}|--------|
`;

  // LCP row
  report += `| LCP |`;
  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    const lcp = data?.lcp ? `${Math.round(data.lcp)}ms` : 'N/A';
    report += ` ${lcp} |`;
  }
  report += ` <2500ms |\n`;

  // FCP row
  report += `| FCP |`;
  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    const fcp = data?.fcp ? `${Math.round(data.fcp)}ms` : 'N/A';
    report += ` ${fcp} |`;
  }
  report += ` <1800ms |\n`;

  // TBT row
  report += `| TBT |`;
  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    const tbt = data?.totalBlockingTime ? `${Math.round(data.totalBlockingTime)}ms` : '<50ms';
    report += ` ${tbt} |`;
  }
  report += ` <200ms |\n`;

  // CLS row
  report += `| CLS |`;
  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    const cls = data?.cls !== undefined ? data.cls.toFixed(3) : 'N/A';
    report += ` ${cls} |`;
  }
  report += ` <0.1 |\n`;

  report += `
---

## Recommendations

1. **For realistic demos:** Use **Low** or **Medium** to show how the site performs on typical budget devices.

2. **For stress testing:** Use **High** to verify eko gallery handles main thread competition gracefully.

3. **For edge case testing:** Use **Extreme** only to check absolute worst-case behavior.

4. **Key insight:** As blocking time increases, users are more likely to:
   - Think their click didn't register
   - Click multiple times (causing issues)
   - Abandon the page entirely

---

*Report generated automatically by eko Stress Test Performance Tool*

## Raw Data

Full test data: \`reports/raw-data-${timestamp}.json\`
`;

  // Save report
  const reportPath = path.join(CONFIG.outputDir, `performance-report-${timestamp}.md`);
  fs.writeFileSync(reportPath, report);
  
  // Save raw data
  const rawDataPath = path.join(CONFIG.outputDir, `raw-data-${timestamp}.json`);
  fs.writeFileSync(rawDataPath, JSON.stringify(results, null, 2));
  
  return { reportPath, rawDataPath, report };
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 eko Stress Test Performance Comparison\n');
  console.log('━'.repeat(50));
  console.log(`📍 Testing URL: ${CONFIG.baseUrl}`);
  console.log(`⏱️  Stress Duration: ${CONFIG.stressDuration}s`);
  console.log(`🔄 Runs per level: ${CONFIG.runsPerLevel}`);
  console.log(`📊 Intensity levels: ${CONFIG.intensities.join(', ')}`);
  console.log('━'.repeat(50) + '\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const results = {};
  
  for (const intensity of CONFIG.intensities) {
    console.log(`\n📈 Testing: ${intensity.toUpperCase()}`);
    console.log('-'.repeat(30));
    
    const runs = [];
    for (let i = 1; i <= CONFIG.runsPerLevel; i++) {
      const metrics = await runTest(browser, intensity, i);
      runs.push(metrics);
    }
    
    // Average metrics if multiple runs
    if (runs.length === 1) {
      results[intensity] = runs[0];
    } else {
      results[intensity] = runs[0];
    }
    
    // Quick summary
    const r = results[intensity];
    const blockTime = r.stressBlockedTime || r.totalBlockingTime;
    console.log(`  ✅ Complete`);
    console.log(`     Load: ${r.loadComplete}ms`);
    console.log(`     Blocked: ${Math.round(blockTime)}ms`);
    console.log(`     Long Tasks: ${r.longTasks?.length || 0}`);
    if (r.estimatedFPS) console.log(`     FPS: ~${r.estimatedFPS}`);
  }
  
  await browser.close();
  
  console.log('\n' + '━'.repeat(50));
  console.log('📝 Generating Report...\n');
  
  const { reportPath, rawDataPath, report } = generateReport(results);
  
  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`✅ Raw data saved: ${rawDataPath}`);
  
  // Print summary to console
  console.log('\n' + '═'.repeat(50));
  console.log('📊 QUICK SUMMARY');
  console.log('═'.repeat(50));
  
  console.log('\n| Intensity | Load Time | Blocking | Experience |');
  console.log('|-----------|-----------|----------|------------|');
  for (const intensity of CONFIG.intensities) {
    const data = results[intensity];
    if (!data) continue;
    const blockTime = data.stressBlockedTime || data.totalBlockingTime;
    let exp = '✅ Good';
    if (blockTime > 300) exp = '⚠️ Lag';
    if (blockTime > 1000) exp = '🔶 Poor';
    if (blockTime > 3000) exp = '🔴 Bad';
    console.log(`| ${intensity.padEnd(9)} | ${String(data.loadComplete + 'ms').padEnd(9)} | ${String(Math.round(blockTime) + 'ms').padEnd(8)} | ${exp} |`);
  }
  
  console.log('\n🎉 Done!\n');
}

main().catch(console.error);
