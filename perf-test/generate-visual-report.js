/**
 * Visual Report Generator
 * 
 * Generates an interactive HTML report with D3.js visualizations
 * from the most recent test data.
 * 
 * Usage: node generate-visual-report.js
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = './reports';

// Find the most recent raw data file
function findLatestDataFile() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('raw-data-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.error('❌ No test data found. Run "npm test" first.');
    process.exit(1);
  }
  
  return path.join(REPORTS_DIR, files[0]);
}

// Generate the HTML report
function generateReport(data, outputPath) {
  const intensities = ['off', 'low', 'medium', 'high', 'extreme'];
  
  // Process data for the report
  const processedData = {};
  intensities.forEach(intensity => {
    if (data[intensity]) {
      const d = data[intensity];
      processedData[intensity] = {
        intensity,
        loadComplete: d.loadComplete || 0,
        stressBlockedTime: d.stressBlockedTime || 0,
        totalBlockingTime: d.totalBlockingTime || 0,
        longTasks: d.longTasks?.length || 0,
        estimatedFPS: d.estimatedFPS || 0,
        ekoTotalLoadTime: d.ekoTotalLoadTime || 0,
        lcp: d.lcp || 0,
        fcp: d.fcp || 0,
        tbt: d.totalBlockingTime || 0,
        cls: d.cls || 0,
        usedJSHeapSize: d.usedJSHeapSize || 0,
        stressTotalOps: d.stressTotalOps || 0
      };
    }
  });
  
  const timestamp = data.off?.timestamp || new Date().toISOString();
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eko Stress Test Performance Report</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #0f0f14 0%, #1a1a24 100%);
      color: #f4f4f5;
      min-height: 100vh;
      padding: 40px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      margin-bottom: 60px;
    }
    
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
    }
    
    .subtitle {
      color: #a1a1aa;
      font-size: 1.1rem;
    }
    
    .meta {
      margin-top: 20px;
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
    }
    
    .meta-item {
      background: rgba(255,255,255,0.05);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    
    .meta-item span {
      color: #8b5cf6;
      font-weight: 600;
    }
    
    section {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
    }
    
    h2 {
      font-size: 1.5rem;
      margin-bottom: 24px;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    h2 .icon {
      font-size: 1.8rem;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    
    .summary-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .summary-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 32px rgba(139, 92, 246, 0.2);
    }
    
    .summary-card.off { border-left: 4px solid #71717a; }
    .summary-card.low { border-left: 4px solid #22c55e; }
    .summary-card.medium { border-left: 4px solid #f59e0b; }
    .summary-card.high { border-left: 4px solid #f97316; }
    .summary-card.extreme { border-left: 4px solid #ef4444; }
    
    .summary-card h3 {
      font-size: 1rem;
      color: #a1a1aa;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .summary-card .value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .summary-card .label {
      font-size: 0.85rem;
      color: #71717a;
    }
    
    .summary-card .impact {
      margin-top: 12px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .impact.good { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .impact.moderate { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .impact.poor { background: rgba(249, 115, 22, 0.2); color: #f97316; }
    .impact.critical { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    
    .chart-container {
      background: rgba(0,0,0,0.2);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .chart-title {
      font-size: 1.1rem;
      margin-bottom: 20px;
      color: #e4e4e7;
    }
    
    .chart {
      width: 100%;
      height: 300px;
    }
    
    .axis text {
      fill: #a1a1aa;
      font-size: 12px;
    }
    
    .axis line, .axis path {
      stroke: rgba(255,255,255,0.1);
    }
    
    .grid line {
      stroke: rgba(255,255,255,0.05);
    }
    
    .bar {
      transition: opacity 0.2s;
    }
    
    .bar:hover {
      opacity: 0.8;
    }
    
    .tooltip {
      position: absolute;
      background: #1f1f28;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.85rem;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    
    .tooltip.visible {
      opacity: 1;
    }
    
    .legend {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      color: #a1a1aa;
    }
    
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    
    th, td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    
    th {
      background: rgba(255,255,255,0.03);
      font-weight: 600;
      color: #e4e4e7;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    tr:hover td {
      background: rgba(255,255,255,0.02);
    }
    
    .experience-desc {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }
    
    .experience-card {
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      padding: 20px;
      border-left: 4px solid;
    }
    
    .experience-card.off { border-color: #71717a; }
    .experience-card.low { border-color: #22c55e; }
    .experience-card.medium { border-color: #f59e0b; }
    .experience-card.high { border-color: #f97316; }
    .experience-card.extreme { border-color: #ef4444; }
    
    .experience-card h4 {
      font-size: 1.1rem;
      margin-bottom: 12px;
    }
    
    .experience-card ul {
      list-style: none;
      font-size: 0.9rem;
      color: #a1a1aa;
    }
    
    .experience-card li {
      padding: 6px 0;
      padding-left: 20px;
      position: relative;
    }
    
    .experience-card li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #6366f1;
    }
    
    .cwv-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    
    .cwv-metric {
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    
    .cwv-metric h4 {
      font-size: 0.85rem;
      color: #a1a1aa;
      margin-bottom: 8px;
    }
    
    .cwv-values {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .cwv-value {
      font-size: 0.85rem;
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    .cwv-value.good { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .cwv-value.needs-improvement { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .cwv-value.poor { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
    
    footer {
      text-align: center;
      margin-top: 60px;
      color: #71717a;
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 20px;
      }
      
      h1 {
        font-size: 1.8rem;
      }
      
      .cwv-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>eko Stress Test Performance Report</h1>
      <p class="subtitle">Impact of stress intensity levels on eko gallery user experience</p>
      <div class="meta">
        <div class="meta-item">Test URL: <span>preset-side-carousel</span></div>
        <div class="meta-item">Duration: <span>10 seconds</span></div>
        <div class="meta-item">Generated: <span>${new Date().toLocaleString()}</span></div>
      </div>
    </header>
    
    <section>
      <h2><span class="icon">📊</span> Executive Summary</h2>
      <div class="summary-grid" id="summary-cards"></div>
    </section>
    
    <section>
      <h2><span class="icon">⏱️</span> Blocking Time Comparison</h2>
      <div class="chart-container">
        <div class="chart-title">Main Thread Blocking Time by Intensity Level</div>
        <div class="chart" id="blocking-chart"></div>
      </div>
      <div class="legend">
        <div class="legend-item"><div class="legend-color" style="background:#71717a"></div> Off (Baseline)</div>
        <div class="legend-item"><div class="legend-color" style="background:#22c55e"></div> Low</div>
        <div class="legend-item"><div class="legend-color" style="background:#f59e0b"></div> Medium</div>
        <div class="legend-item"><div class="legend-color" style="background:#f97316"></div> High</div>
        <div class="legend-item"><div class="legend-color" style="background:#ef4444"></div> Extreme</div>
      </div>
    </section>
    
    <section>
      <h2><span class="icon">📈</span> Performance Metrics Comparison</h2>
      <div class="chart-container">
        <div class="chart-title">Page Load Time & eko Gallery Load Time</div>
        <div class="chart" id="load-chart"></div>
      </div>
      <div class="legend">
        <div class="legend-item"><div class="legend-color" style="background:#6366f1"></div> Page Load Time</div>
        <div class="legend-item"><div class="legend-color" style="background:#8b5cf6"></div> eko Gallery Load Time</div>
      </div>
    </section>
    
    <section>
      <h2><span class="icon">🎯</span> Frame Rate & Long Tasks</h2>
      <div class="chart-container">
        <div class="chart-title">Estimated FPS and Long Task Count</div>
        <div class="chart" id="fps-chart"></div>
      </div>
    </section>
    
    <section>
      <h2><span class="icon">🌐</span> Core Web Vitals</h2>
      <div class="cwv-grid" id="cwv-grid"></div>
    </section>
    
    <section>
      <h2><span class="icon">👤</span> User Experience Impact</h2>
      <div class="experience-desc" id="experience-cards"></div>
    </section>
    
    <section>
      <h2><span class="icon">📋</span> Detailed Results</h2>
      <table id="results-table">
        <thead>
          <tr>
            <th>Intensity</th>
            <th>Page Load</th>
            <th>Blocking Time</th>
            <th>Long Tasks</th>
            <th>FPS</th>
            <th>eko Gallery</th>
            <th>Memory</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
    
    <footer>
      <p>Generated by eko Stress Test Performance Tool</p>
      <p style="margin-top: 8px; color: #52525b;">Test run: ${timestamp}</p>
    </footer>
  </div>
  
  <div class="tooltip" id="tooltip"></div>
  
  <script>
    // Performance data from test run
    const data = ${JSON.stringify(processedData, null, 2)};
    
    const intensities = ${JSON.stringify(Object.keys(processedData))};
    const colors = {
      off: '#71717a',
      low: '#22c55e',
      medium: '#f59e0b',
      high: '#f97316',
      extreme: '#ef4444'
    };
    
    // Create summary cards
    const summaryContainer = document.getElementById('summary-cards');
    intensities.forEach(intensity => {
      const d = data[intensity];
      if (!d) return;
      const blockTime = d.stressBlockedTime || d.totalBlockingTime;
      let impact = 'good';
      let impactText = '✅ Smooth';
      if (blockTime > 1000) { impact = 'moderate'; impactText = '⚠️ Noticeable'; }
      if (blockTime > 3000) { impact = 'poor'; impactText = '🔶 Frustrating'; }
      if (blockTime > 6000) { impact = 'critical'; impactText = '🚨 Unusable'; }
      
      summaryContainer.innerHTML += \`
        <div class="summary-card \${intensity}">
          <h3>\${intensity.charAt(0).toUpperCase() + intensity.slice(1)}</h3>
          <div class="value" style="color: \${colors[intensity]}">\${Math.round(blockTime)}ms</div>
          <div class="label">Blocking Time</div>
          <div class="impact \${impact}">\${impactText}</div>
        </div>
      \`;
    });
    
    // Tooltip helper
    const tooltip = document.getElementById('tooltip');
    function showTooltip(event, content) {
      tooltip.innerHTML = content;
      tooltip.style.left = (event.pageX + 10) + 'px';
      tooltip.style.top = (event.pageY - 10) + 'px';
      tooltip.classList.add('visible');
    }
    function hideTooltip() {
      tooltip.classList.remove('visible');
    }
    
    // Blocking Time Chart
    (function() {
      const container = document.getElementById('blocking-chart');
      const width = container.clientWidth;
      const height = 300;
      const margin = { top: 20, right: 30, bottom: 60, left: 80 };
      
      const svg = d3.select('#blocking-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
      
      const chartData = intensities.map(i => ({
        intensity: i,
        value: data[i]?.stressBlockedTime || data[i]?.totalBlockingTime || 0
      }));
      
      const x = d3.scaleBand()
        .domain(intensities)
        .range([margin.left, width - margin.right])
        .padding(0.3);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value) * 1.1 || 100])
        .range([height - margin.bottom, margin.top]);
      
      // Grid lines
      svg.append('g')
        .attr('class', 'grid')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).tickSize(-width + margin.left + margin.right).tickFormat(''));
      
      // Bars
      svg.selectAll('.bar')
        .data(chartData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.intensity))
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.value))
        .attr('fill', d => colors[d.intensity])
        .attr('rx', 6)
        .on('mouseover', function(event, d) {
          showTooltip(event, \`<strong>\${d.intensity.toUpperCase()}</strong><br>Blocking: \${Math.round(d.value)}ms\`);
        })
        .on('mouseout', hideTooltip);
      
      // X axis
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(0,\${height - margin.bottom})\`)
        .call(d3.axisBottom(x).tickFormat(d => d.charAt(0).toUpperCase() + d.slice(1)));
      
      // Y axis
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).tickFormat(d => d + 'ms'));
    })();
    
    // Load Time Chart (grouped bars)
    (function() {
      const container = document.getElementById('load-chart');
      const width = container.clientWidth;
      const height = 300;
      const margin = { top: 20, right: 30, bottom: 60, left: 80 };
      
      const svg = d3.select('#load-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
      
      const chartData = intensities.map(i => ({
        intensity: i,
        pageLoad: data[i]?.loadComplete || 0,
        ekoLoad: data[i]?.ekoTotalLoadTime || 0
      }));
      
      const x0 = d3.scaleBand()
        .domain(intensities)
        .range([margin.left, width - margin.right])
        .padding(0.2);
      
      const x1 = d3.scaleBand()
        .domain(['pageLoad', 'ekoLoad'])
        .range([0, x0.bandwidth()])
        .padding(0.05);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => Math.max(d.pageLoad, d.ekoLoad)) * 1.1 || 100])
        .range([height - margin.bottom, margin.top]);
      
      // Grid
      svg.append('g')
        .attr('class', 'grid')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).tickSize(-width + margin.left + margin.right).tickFormat(''));
      
      const groups = svg.selectAll('.group')
        .data(chartData)
        .enter()
        .append('g')
        .attr('transform', d => \`translate(\${x0(d.intensity)},0)\`);
      
      // Page Load bars
      groups.append('rect')
        .attr('class', 'bar')
        .attr('x', x1('pageLoad'))
        .attr('y', d => y(d.pageLoad))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.pageLoad))
        .attr('fill', '#6366f1')
        .attr('rx', 4)
        .on('mouseover', function(event, d) {
          showTooltip(event, \`<strong>\${d.intensity.toUpperCase()}</strong><br>Page Load: \${d.pageLoad}ms\`);
        })
        .on('mouseout', hideTooltip);
      
      // eko Load bars
      groups.append('rect')
        .attr('class', 'bar')
        .attr('x', x1('ekoLoad'))
        .attr('y', d => y(d.ekoLoad))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - margin.bottom - y(d.ekoLoad))
        .attr('fill', '#8b5cf6')
        .attr('rx', 4)
        .on('mouseover', function(event, d) {
          showTooltip(event, \`<strong>\${d.intensity.toUpperCase()}</strong><br>eko Gallery: \${d.ekoLoad}ms\`);
        })
        .on('mouseout', hideTooltip);
      
      // X axis
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(0,\${height - margin.bottom})\`)
        .call(d3.axisBottom(x0).tickFormat(d => d.charAt(0).toUpperCase() + d.slice(1)));
      
      // Y axis
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).tickFormat(d => (d/1000).toFixed(1) + 's'));
    })();
    
    // FPS Chart
    (function() {
      const container = document.getElementById('fps-chart');
      const width = container.clientWidth;
      const height = 300;
      const margin = { top: 20, right: 80, bottom: 60, left: 80 };
      
      const svg = d3.select('#fps-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
      
      const chartData = intensities.map(i => ({
        intensity: i,
        fps: data[i]?.estimatedFPS || 0,
        longTasks: data[i]?.longTasks || 0
      }));
      
      const x = d3.scaleBand()
        .domain(intensities)
        .range([margin.left, width - margin.right])
        .padding(0.3);
      
      const yFPS = d3.scaleLinear()
        .domain([0, 60])
        .range([height - margin.bottom, margin.top]);
      
      const yTasks = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.longTasks) * 1.2 || 10])
        .range([height - margin.bottom, margin.top]);
      
      // FPS bars
      svg.selectAll('.fps-bar')
        .data(chartData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.intensity))
        .attr('y', d => yFPS(d.fps))
        .attr('width', x.bandwidth() / 2 - 4)
        .attr('height', d => height - margin.bottom - yFPS(d.fps))
        .attr('fill', '#22c55e')
        .attr('rx', 4)
        .on('mouseover', function(event, d) {
          showTooltip(event, \`<strong>\${d.intensity.toUpperCase()}</strong><br>FPS: ~\${d.fps}\`);
        })
        .on('mouseout', hideTooltip);
      
      // Long Tasks bars
      svg.selectAll('.tasks-bar')
        .data(chartData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.intensity) + x.bandwidth() / 2 + 4)
        .attr('y', d => yTasks(d.longTasks))
        .attr('width', x.bandwidth() / 2 - 4)
        .attr('height', d => height - margin.bottom - yTasks(d.longTasks))
        .attr('fill', '#f59e0b')
        .attr('rx', 4)
        .on('mouseover', function(event, d) {
          showTooltip(event, \`<strong>\${d.intensity.toUpperCase()}</strong><br>Long Tasks: \${d.longTasks}\`);
        })
        .on('mouseout', hideTooltip);
      
      // X axis
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(0,\${height - margin.bottom})\`)
        .call(d3.axisBottom(x).tickFormat(d => d.charAt(0).toUpperCase() + d.slice(1)));
      
      // Y axis (FPS)
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(yFPS).tickFormat(d => d + ' fps'));
      
      // Y axis (Tasks)
      svg.append('g')
        .attr('class', 'axis')
        .attr('transform', \`translate(\${width - margin.right},0)\`)
        .call(d3.axisRight(yTasks).tickFormat(d => d + ' tasks'));
      
      // Legend
      svg.append('rect').attr('x', margin.left + 20).attr('y', 10).attr('width', 16).attr('height', 16).attr('fill', '#22c55e').attr('rx', 3);
      svg.append('text').attr('x', margin.left + 44).attr('y', 22).attr('fill', '#a1a1aa').attr('font-size', '12px').text('FPS');
      svg.append('rect').attr('x', margin.left + 80).attr('y', 10).attr('width', 16).attr('height', 16).attr('fill', '#f59e0b').attr('rx', 3);
      svg.append('text').attr('x', margin.left + 104).attr('y', 22).attr('fill', '#a1a1aa').attr('font-size', '12px').text('Long Tasks');
    })();
    
    // Core Web Vitals
    const cwvContainer = document.getElementById('cwv-grid');
    const cwvMetrics = [
      { name: 'LCP', key: 'lcp', unit: 'ms', goodThreshold: 2500, poorThreshold: 4000 },
      { name: 'FCP', key: 'fcp', unit: 'ms', goodThreshold: 1800, poorThreshold: 3000 },
      { name: 'TBT', key: 'tbt', unit: 'ms', goodThreshold: 200, poorThreshold: 600 },
      { name: 'CLS', key: 'cls', unit: '', goodThreshold: 0.1, poorThreshold: 0.25, isDecimal: true }
    ];
    
    cwvMetrics.forEach(metric => {
      let html = \`<div class="cwv-metric"><h4>\${metric.name}</h4><div class="cwv-values">\`;
      intensities.forEach(intensity => {
        const value = data[intensity]?.[metric.key] || 0;
        let rating = 'good';
        if (value > metric.goodThreshold) rating = 'needs-improvement';
        if (value > metric.poorThreshold) rating = 'poor';
        const displayValue = metric.isDecimal ? value.toFixed(3) : Math.round(value) + metric.unit;
        html += \`<div class="cwv-value \${rating}">\${intensity.charAt(0).toUpperCase()}: \${displayValue}</div>\`;
      });
      html += '</div></div>';
      cwvContainer.innerHTML += html;
    });
    
    // Experience cards
    const experienceContainer = document.getElementById('experience-cards');
    const experiences = {
      off: { title: 'Off - Baseline', items: ['Normal page responsiveness', 'Smooth animations', 'eko gallery loads promptly'] },
      low: { title: 'Low - Slight Impact', items: ['Minor interaction delays', 'Occasional stutter', 'Gallery mostly responsive'] },
      medium: { title: 'Medium - Noticeable', items: ['Visible click delays', 'Scrolling feels sluggish', 'Users may double-click'] },
      high: { title: 'High - Frustrating', items: ['Page feels frozen at times', 'Significant input lag', 'Users may abandon'] },
      extreme: { title: 'Extreme - Unusable', items: ['Multi-second freezes', 'Browser may warn', 'Page essentially broken'] }
    };
    
    intensities.forEach(intensity => {
      const exp = experiences[intensity];
      if (!exp) return;
      experienceContainer.innerHTML += \`
        <div class="experience-card \${intensity}">
          <h4>\${exp.title}</h4>
          <ul>\${exp.items.map(item => \`<li>\${item}</li>\`).join('')}</ul>
        </div>
      \`;
    });
    
    // Results table
    const tbody = document.querySelector('#results-table tbody');
    intensities.forEach(intensity => {
      const d = data[intensity];
      if (!d) return;
      const blockTime = d.stressBlockedTime || d.totalBlockingTime;
      tbody.innerHTML += \`
        <tr>
          <td><strong style="color: \${colors[intensity]}">\${intensity.charAt(0).toUpperCase() + intensity.slice(1)}</strong></td>
          <td>\${(d.loadComplete/1000).toFixed(2)}s</td>
          <td>\${Math.round(blockTime)}ms</td>
          <td>\${d.longTasks}</td>
          <td>~\${d.estimatedFPS} fps</td>
          <td>\${(d.ekoTotalLoadTime/1000).toFixed(2)}s</td>
          <td>\${(d.usedJSHeapSize/1024/1024).toFixed(1)} MB</td>
        </tr>
      \`;
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  return outputPath;
}

// Main
console.log('🔍 Finding latest test data...');
const dataFile = findLatestDataFile();
console.log(`📄 Using: ${dataFile}`);

const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));

console.log('📊 Generating visual report...');
const outputPath = path.join(REPORTS_DIR, 'visual-report.html');
generateReport(rawData, outputPath);

console.log(`✅ Visual report generated: ${outputPath}`);
console.log('');
console.log('To view the report, run:');
console.log('  open reports/visual-report.html');
