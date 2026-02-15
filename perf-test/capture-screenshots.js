/**
 * Screenshot Capture Script
 * Captures screenshots of the stress test panel and visual report for documentation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://eko-dean.myshopify.com/products/preset-side-carousel',
  previewThemeId: '185250185506',
  storePassword: 'ekodemo',
  outputDir: '../images'
};

async function captureScreenshots() {
  console.log('📸 Starting screenshot capture...\n');
  
  // Ensure output directory exists
  const outputPath = path.resolve(__dirname, CONFIG.outputDir);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();
  
  try {
    // Handle password page
    console.log('🔐 Handling store password...');
    await page.goto(`https://eko-dean.myshopify.com/password`, { waitUntil: 'load', timeout: 30000 });
    
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.fill(CONFIG.storePassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      console.log('✓ Password accepted\n');
    }
    
    // Screenshot 1: Control Panel (idle state)
    console.log('📸 Capturing control panel (idle)...');
    const panelUrl = `${CONFIG.baseUrl}?preview_theme_id=${CONFIG.previewThemeId}`;
    await page.goto(panelUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    // Scroll down a bit to show more context
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);
    
    await page.screenshot({
      path: path.join(outputPath, 'panel-idle.png'),
      fullPage: false
    });
    console.log('✓ Saved: panel-idle.png\n');
    
    // Screenshot 2: Control Panel (running stress test)
    console.log('📸 Capturing control panel (stress test running)...');
    const stressUrl = `${CONFIG.baseUrl}?preview_theme_id=${CONFIG.previewThemeId}&stress=1&intensity=medium&duration=30&js=1&layout=1&longtasks=1`;
    await page.goto(stressUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000); // Let the stress test run a bit
    
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);
    
    await page.screenshot({
      path: path.join(outputPath, 'panel-running.png'),
      fullPage: false
    });
    console.log('✓ Saved: panel-running.png\n');
    
    // Screenshot 3: Visual Report
    console.log('📸 Capturing visual report...');
    const reportPath = path.resolve(__dirname, 'reports/visual-report.html');
    
    if (fs.existsSync(reportPath)) {
      await page.goto(`file://${reportPath}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      await page.screenshot({
        path: path.join(outputPath, 'visual-report.png'),
        fullPage: false
      });
      console.log('✓ Saved: visual-report.png\n');
      
      // Screenshot 4: Visual Report - Charts section
      console.log('📸 Capturing report charts...');
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      
      await page.screenshot({
        path: path.join(outputPath, 'visual-report-charts.png'),
        fullPage: false
      });
      console.log('✓ Saved: visual-report-charts.png\n');
    } else {
      console.log('⚠️ Visual report not found. Run "npm run test:report" first.\n');
    }
    
    console.log('✅ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
