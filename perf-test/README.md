# eko Stress Test - Automated Performance Testing

Playwright-based automated testing tool that runs stress tests at different intensity levels and generates comparative reports with D3.js visualizations.

> **Note**: For full documentation including how to install the stress test snippet in a Shopify store, see the [main README](../README.md).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Generating Visual Reports](#generating-visual-reports)
- [Understanding the Output](#understanding-the-output)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Navigate to the perf-test folder
cd perf-test

# 2. Install dependencies
npm install

# 3. Configure your settings (see Configuration section)

# 4. Run tests AND generate visual report in one command
npm run test:report

# 5. Open the visual report
open reports/visual-report.html
```

---

## Configuration

Before running tests, edit the `CONFIG` object at the top of `run-perf-tests.js`:

```javascript
const CONFIG = {
  // REQUIRED: Your store's product page URL (without query params)
  baseUrl: 'https://eko-dean.myshopify.com/products/preset-side-carousel',
  
  // REQUIRED: The preview theme ID containing the stress test code
  // Find this in the Shopify admin URL when previewing your theme
  previewThemeId: '185250185506',
  
  // REQUIRED if store is password protected, otherwise set to null
  storePassword: 'ekodemo',
  
  // Intensity levels to test (modify to test specific levels only)
  intensities: ['off', 'low', 'medium', 'high', 'extreme'],
  
  // How long each stress test runs (in seconds)
  stressDuration: 10,
  
  // Wait time after page load to collect final metrics (in ms)
  settleTime: 5000,
  
  // Number of runs per intensity level (higher = more accurate averages)
  runsPerLevel: 1,
};
```

### Finding Your Preview Theme ID

1. Go to **Shopify Admin → Online Store → Themes**
2. Click **Customize** on your development theme
3. Look at the URL: `...?preview_theme_id=XXXXXXXXX`
4. Copy that number into `previewThemeId`

### Store Password

If your store has password protection enabled:
- Set `storePassword` to your store's password
- The script will automatically handle login

If your store is public:
- Set `storePassword: null`

---

## Running Tests

### All-in-One: Test + Visual Report (Recommended)

```bash
npm run test:report
```

- Runs all 5 intensity levels
- Automatically generates visual report when complete
- Best for getting a full analysis in one command

### Standard Test Only

```bash
npm test
```

- Runs all 5 intensity levels (off, low, medium, high, extreme)
- 10-second stress duration per level
- Takes approximately 2-3 minutes total
- Generates markdown + JSON reports in `/reports`

### Quick Test Mode

```bash
npm run test:quick
```

- Faster tests with shorter durations
- Good for quick checks during development
- Less accurate than standard tests

### Generate Visual Report Only

```bash
npm run report
```

- Uses the most recent test data to generate a visual report
- Useful if you already ran tests and want to regenerate the HTML

### Test Specific Levels Only

Edit `CONFIG.intensities` to test only certain levels:

```javascript
// Test only baseline and extreme
intensities: ['off', 'extreme'],

// Test low/medium only
intensities: ['low', 'medium'],
```

### Multiple Runs for Accuracy

For more reliable results, increase `runsPerLevel`:

```javascript
runsPerLevel: 3,  // Averages 3 runs per intensity level
```

---

## Generating Visual Reports

After running tests, generate an interactive HTML report with D3.js charts:

### Automatic Generation (Easiest)

```bash
# Run tests and generate report in one command
npm run test:report
```

### Generate Report from Existing Data

If you've already run tests and want to regenerate the visual report:

```bash
npm run report
```

This automatically finds the most recent `raw-data-*.json` file and creates an updated `visual-report.html`.

### Open the Report

```bash
# macOS
open reports/visual-report.html

# Windows
start reports/visual-report.html

# Linux
xdg-open reports/visual-report.html
```

### What's in the Visual Report

The D3.js-powered report includes:

| Section | Description |
|---------|-------------|
| **Executive Summary** | Color-coded cards showing blocking time and user experience rating |
| **Blocking Time Chart** | Bar chart comparing main thread blocking across intensities |
| **Load Time Chart** | Grouped bars showing page load vs eko gallery load times |
| **FPS & Long Tasks** | Dual-axis chart showing frame rate and task counts |
| **Core Web Vitals** | LCP, FCP, TBT, CLS with color-coded ratings |
| **User Experience** | What each intensity level feels like for real users |
| **Detailed Table** | All metrics in a comprehensive table |

---

## Understanding the Output

### Output Files

After each test run, two files are generated in `/reports`:

| File | Purpose |
|------|---------|
| `performance-report-[timestamp].md` | Human-readable markdown summary |
| `raw-data-[timestamp].json` | Complete metrics data (use for visual report) |

### Key Metrics Explained

| Metric | What It Measures | Impact on Users |
|--------|-----------------|-----------------|
| **Page Load Time** | Total time until page is interactive | How long users wait |
| **eko Gallery Load Time** | When gallery resources finish loading | When gallery is ready |
| **Total Blocking Time** | Time the main thread was blocked | Page "freezing" |
| **Long Tasks** | Tasks blocking >50ms | Stutters and jank |
| **Estimated FPS** | Frames per second during test | Animation smoothness |
| **LCP** | Largest Contentful Paint | Perceived load speed |
| **FCP** | First Contentful Paint | Initial visual response |
| **CLS** | Cumulative Layout Shift | Visual stability |

### User Experience Ratings

| Rating | Blocking Time | What Users Feel |
|--------|--------------|-----------------|
| ✅ **Smooth** | < 1,000ms | Normal, responsive page |
| ⚠️ **Noticeable** | 1,000 - 3,000ms | Some delays, still usable |
| 🔶 **Frustrating** | 3,000 - 6,000ms | Significant lag, users may leave |
| 🚨 **Unusable** | > 6,000ms | Page feels broken |

---

## Troubleshooting

### "Stress test not detected" or all zeros

**Problem**: The test reports 0ms blocking time and shows no stress activity.

**Solution**: Check that `previewThemeId` is correct. The stress test code only exists in your development theme, not the published theme.

### "Password page" errors

**Problem**: Tests fail at the login step.

**Solution**: 
1. Verify `storePassword` is set correctly
2. Check the password hasn't changed in Shopify admin

### Inconsistent results between runs

**Problem**: Same intensity shows different numbers each time.

**Solution**:
1. Increase `runsPerLevel` to 3+ for averaging
2. Ensure no other browser tabs are using significant resources
3. Use standard `npm test` instead of quick mode

### Browser warnings or timeouts

**Problem**: Tests time out or Playwright crashes.

**Solution**:
1. Increase `settleTime` if page takes long to stabilize
2. Reduce `stressDuration` for extreme intensity tests
3. Run tests one at a time: `intensities: ['extreme']`

### Visual report shows old data

**Problem**: Charts display outdated test results.

**Solution**: Regenerate the report from the latest data:
```bash
npm run report
```
This automatically uses the most recent test data.

---

## Requirements

- Node.js 16 or higher
- npm or yarn
- Chromium browser (installed automatically by Playwright)

---

## File Structure

```
perf-test/
├── run-perf-tests.js           # Main test script
├── generate-visual-report.js   # Visual report generator
├── package.json                # Dependencies & scripts
├── README.md                   # This file
└── reports/
    ├── visual-report.html      # Interactive D3.js report (auto-generated)
    ├── performance-report-*.md # Markdown summaries
    └── raw-data-*.json         # Raw test data
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run performance tests |
| `npm run test:quick` | Run quick tests (shorter duration) |
| `npm run report` | Generate visual report from latest data |
| `npm run test:report` | Run tests + generate visual report |
