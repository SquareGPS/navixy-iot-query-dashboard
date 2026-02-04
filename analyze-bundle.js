#!/usr/bin/env node

import fs from 'fs';

// Read the stats.json file
const stats = JSON.parse(fs.readFileSync('stats.json', 'utf8'));

// Get nodeParts (contains sizes) and nodeMetas (contains module IDs)
const nodeParts = stats.nodeParts;
const nodeMetas = stats.nodeMetas;

// Build a map from metaUid to module ID
const metaToId = {};
for (const [uid, meta] of Object.entries(nodeMetas)) {
  metaToId[uid] = meta.id || '';
}

// Extract library sizes from node_modules
const libraryStats = {};
const srcStats = { total: 0, gzip: 0, brotli: 0, files: {} };
let totalRendered = 0;
let totalGzip = 0;
let totalBrotli = 0;

for (const [partUid, part] of Object.entries(nodeParts)) {
  const metaUid = part.metaUid;
  const moduleId = metaToId[metaUid] || '';
  
  const renderedLength = part.renderedLength || 0;
  const gzipLength = part.gzipLength || 0;
  const brotliLength = part.brotliLength || 0;
  
  totalRendered += renderedLength;
  totalGzip += gzipLength;
  totalBrotli += brotliLength;
  
  // Check if it's from node_modules
  const nodeModulesMatch = moduleId.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  
  if (nodeModulesMatch) {
    const libName = nodeModulesMatch[1];
    if (!libraryStats[libName]) {
      libraryStats[libName] = {
        rendered: 0,
        gzip: 0,
        brotli: 0,
        files: 0
      };
    }
    libraryStats[libName].rendered += renderedLength;
    libraryStats[libName].gzip += gzipLength;
    libraryStats[libName].brotli += brotliLength;
    libraryStats[libName].files += 1;
  } else if (moduleId && !moduleId.startsWith('\u0000')) {
    // Source files (not virtual modules)
    srcStats.total += renderedLength;
    srcStats.gzip += gzipLength;
    srcStats.brotli += brotliLength;
    const fileName = moduleId.split('/').pop();
    if (!srcStats.files[fileName]) {
      srcStats.files[fileName] = { rendered: 0, gzip: 0 };
    }
    srcStats.files[fileName].rendered += renderedLength;
    srcStats.files[fileName].gzip += gzipLength;
  }
}

// Sort libraries by rendered size
const sortedLibraries = Object.entries(libraryStats)
  .sort((a, b) => b[1].rendered - a[1].rendered);

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Calculate library totals
const libTotalRendered = sortedLibraries.reduce((sum, [, s]) => sum + s.rendered, 0);
const libTotalGzip = sortedLibraries.reduce((sum, [, s]) => sum + s.gzip, 0);
const libTotalBrotli = sortedLibraries.reduce((sum, [, s]) => sum + s.brotli, 0);

// Generate report
console.log('='.repeat(105));
console.log('📦 BUNDLE SIZE ANALYSIS REPORT');
console.log('='.repeat(105));
console.log(`\nGenerated: ${new Date().toISOString()}`);
console.log(`\n📊 BUNDLE SUMMARY`);
console.log('-'.repeat(105));
console.log(`Total JS Bundle:        ${formatBytes(totalRendered).padEnd(12)} (gzip: ${formatBytes(totalGzip)}, brotli: ${formatBytes(totalBrotli)})`);
console.log(`├─ node_modules:        ${formatBytes(libTotalRendered).padEnd(12)} (gzip: ${formatBytes(libTotalGzip)}) - ${((libTotalRendered/totalRendered)*100).toFixed(1)}% of bundle`);
console.log(`└─ Your source code:    ${formatBytes(srcStats.total).padEnd(12)} (gzip: ${formatBytes(srcStats.gzip)}) - ${((srcStats.total/totalRendered)*100).toFixed(1)}% of bundle`);
console.log(`\n${'='.repeat(105)}`);

console.log('\n🏆 TOP 30 LARGEST LIBRARIES (by minified size)');
console.log('-'.repeat(105));
console.log(
  'Rank'.padEnd(6) +
  'Library'.padEnd(42) +
  'Minified'.padStart(12) +
  'Gzip'.padStart(10) +
  'Brotli'.padStart(10) +
  '% of libs'.padStart(11) +
  '% total'.padStart(9) +
  'Files'.padStart(7)
);
console.log('-'.repeat(105));

const top30 = sortedLibraries.slice(0, 30);
top30.forEach(([name, stats], index) => {
  const percentLib = ((stats.rendered / libTotalRendered) * 100).toFixed(1);
  const percentTotal = ((stats.rendered / totalRendered) * 100).toFixed(1);
  console.log(
    `${(index + 1).toString().padEnd(6)}` +
    `${name.substring(0, 40).padEnd(42)}` +
    `${formatBytes(stats.rendered).padStart(12)}` +
    `${formatBytes(stats.gzip).padStart(10)}` +
    `${formatBytes(stats.brotli).padStart(10)}` +
    `${(percentLib + '%').padStart(11)}` +
    `${(percentTotal + '%').padStart(9)}` +
    `${stats.files.toString().padStart(7)}`
  );
});

console.log('-'.repeat(105));
console.log(
  ''.padEnd(6) +
  'TOTAL (node_modules)'.padEnd(42) +
  `${formatBytes(libTotalRendered).padStart(12)}` +
  `${formatBytes(libTotalGzip).padStart(10)}` +
  `${formatBytes(libTotalBrotli).padStart(10)}` +
  '100%'.padStart(11) +
  `${((libTotalRendered/totalRendered)*100).toFixed(1)}%`.padStart(9) +
  `${sortedLibraries.reduce((sum, [, s]) => sum + s.files, 0).toString().padStart(7)}`
);

// Group by category
console.log('\n' + '='.repeat(105));
console.log('📁 LIBRARIES BY CATEGORY');
console.log('-'.repeat(105));

const categories = {
  'React Core': ['react', 'react-dom', 'scheduler', 'react-is'],
  'React Router': ['react-router', 'react-router-dom', '@remix-run/router'],
  'State Management': ['zustand', 'immer', '@tanstack/react-query', '@tanstack/query-core'],
  'UI Components (Radix)': sortedLibraries
    .filter(([name]) => name.startsWith('@radix-ui'))
    .map(([name]) => name),
  'Charts (recharts + d3)': ['recharts', 'recharts-scale', 'd3-shape', 'd3-scale', 'd3-path', 'd3-interpolate', 'd3-color', 'd3-format', 'd3-time', 'd3-time-format', 'd3-array', 'victory-vendor', 'decimal.js-light'],
  'Tables': ['@tanstack/react-table', '@tanstack/table-core'],
  'Forms & Validation': ['react-hook-form', '@hookform/resolvers', 'zod'],
  'Monaco Editor': ['@monaco-editor/react', '@monaco-editor/loader', 'state-local'],
  'Maps (Leaflet)': ['leaflet', 'react-leaflet', '@react-leaflet/core', 'leaflet.markercluster'],
  'Date/Time': ['date-fns'],
  'Drag & Drop': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@dnd-kit/accessibility'],
  'Floating UI': ['@floating-ui/core', '@floating-ui/dom', '@floating-ui/react-dom', '@floating-ui/utils'],
  'Icons (lucide)': ['lucide-react'],
  'UI Utilities': ['clsx', 'class-variance-authority', 'tailwind-merge', 'cmdk', 'sonner', 'next-themes'],
  'Markdown': ['marked'],
  'Storage (IndexedDB)': ['dexie'],
  'Animations': ['react-smooth', 'react-transition-group'],
  'Other': ['lodash', 'eventemitter3', 'prop-types', 'tslib', 'tiny-invariant', 'fast-equals', 'internmap', 'aria-hidden', 'get-nonce', 'detect-node-es', '@babel/runtime', 'dom-helpers', 'use-callback-ref', 'use-sidecar', 'react-remove-scroll', 'react-remove-scroll-bar', 'react-style-singleton']
};

const categoryResults = [];
for (const [category, libs] of Object.entries(categories)) {
  const categoryStats = libs.reduce((acc, lib) => {
    const libStats = libraryStats[lib];
    if (libStats) {
      acc.rendered += libStats.rendered;
      acc.gzip += libStats.gzip;
      acc.brotli += libStats.brotli;
      acc.count += 1;
    }
    return acc;
  }, { rendered: 0, gzip: 0, brotli: 0, count: 0 });
  
  if (categoryStats.rendered > 0) {
    categoryResults.push({ category, ...categoryStats });
  }
}

categoryResults.sort((a, b) => b.rendered - a.rendered);

categoryResults.forEach(({ category, rendered, gzip, brotli, count }) => {
  const percentLib = ((rendered / libTotalRendered) * 100).toFixed(1);
  const percentTotal = ((rendered / totalRendered) * 100).toFixed(1);
  console.log(
    `${category.padEnd(35)}` +
    `${formatBytes(rendered).padStart(12)}` +
    `${formatBytes(gzip).padStart(10)}` +
    `${('(' + percentLib + '% libs)').padStart(14)}` +
    `${('(' + percentTotal + '% total)').padStart(14)}` +
    ` [${count} pkg${count > 1 ? 's' : ''}]`
  );
});

// Show remaining libraries
console.log('\n' + '='.repeat(105));
console.log('📋 ALL LIBRARIES (sorted by size)');
console.log('-'.repeat(105));

sortedLibraries.forEach(([name, stats], index) => {
  const percentTotal = ((stats.rendered / totalRendered) * 100).toFixed(1);
  console.log(
    `${(index + 1).toString().padStart(3)}. ${name.padEnd(47)} ${formatBytes(stats.rendered).padStart(10)} (${percentTotal}% of total)`
  );
});

// Recommendations
console.log('\n' + '='.repeat(105));
console.log('💡 OPTIMIZATION RECOMMENDATIONS');
console.log('-'.repeat(105));

const recommendations = [];

// Check for heavy libraries
const rechartsStats = libraryStats['recharts'];
const d3Libs = sortedLibraries.filter(([name]) => name.startsWith('d3-'));
const d3Total = d3Libs.reduce((sum, [, s]) => sum + s.rendered, 0);
const chartsTotal = (rechartsStats?.rendered || 0) + d3Total + (libraryStats['victory-vendor']?.rendered || 0) + (libraryStats['decimal.js-light']?.rendered || 0) + (libraryStats['recharts-scale']?.rendered || 0);

if (chartsTotal > 100000) {
  recommendations.push({
    priority: 'HIGH',
    library: 'Charts (recharts + d3 ecosystem)',
    size: chartsTotal,
    suggestion: `Consider lazy loading chart components. recharts and its D3 dependencies make up ${formatBytes(chartsTotal)} (${((chartsTotal/totalRendered)*100).toFixed(1)}% of bundle). Use React.lazy() for dashboard/report views.`
  });
}

const leafletStats = libraryStats['leaflet'];
const reactLeafletStats = libraryStats['react-leaflet'];
const leafletCoreStats = libraryStats['@react-leaflet/core'];
const mapsTotal = (leafletStats?.rendered || 0) + (reactLeafletStats?.rendered || 0) + (leafletCoreStats?.rendered || 0);

if (mapsTotal > 50000) {
  recommendations.push({
    priority: 'HIGH',
    library: 'Maps (Leaflet)',
    size: mapsTotal,
    suggestion: `Lazy load the map component. Leaflet ecosystem adds ${formatBytes(mapsTotal)} (${((mapsTotal/totalRendered)*100).toFixed(1)}% of bundle). Maps are only used on specific pages.`
  });
}

const monacoLoader = libraryStats['@monaco-editor/loader'];
const monacoReact = libraryStats['@monaco-editor/react'];
const monacoTotal = (monacoLoader?.rendered || 0) + (monacoReact?.rendered || 0);

if (monacoTotal > 10000) {
  recommendations.push({
    priority: 'MEDIUM',
    library: 'Monaco Editor',
    size: monacoTotal,
    suggestion: `Monaco loader adds ${formatBytes(monacoTotal)}. The actual editor is loaded from CDN. Consider lazy loading the SQL editor page.`
  });
}

const lodashStats = libraryStats['lodash'];
if (lodashStats && lodashStats.rendered > 10000) {
  recommendations.push({
    priority: 'MEDIUM',
    library: 'lodash',
    size: lodashStats.rendered,
    suggestion: `Lodash adds ${formatBytes(lodashStats.rendered)}. It's likely pulled in by recharts. Check if you can tree-shake unused functions or use lodash-es.`
  });
}

const reactDomStats = libraryStats['react-dom'];
if (reactDomStats && reactDomStats.rendered > 100000) {
  recommendations.push({
    priority: 'INFO',
    library: 'react-dom',
    size: reactDomStats.rendered,
    suggestion: `React DOM is ${formatBytes(reactDomStats.rendered)}. This is expected and cannot be reduced. Consider React 19 for potential improvements.`
  });
}

const radixLibs = sortedLibraries.filter(([name]) => name.startsWith('@radix-ui'));
const radixTotal = radixLibs.reduce((sum, [, s]) => sum + s.rendered, 0);

recommendations.push({
  priority: 'INFO',
  library: '@radix-ui/* (UI primitives)',
  size: radixTotal,
  suggestion: `${radixLibs.length} Radix UI packages add ${formatBytes(radixTotal)}. They are well tree-shaken and provide accessible components. Size is reasonable.`
});

const lucideStats = libraryStats['lucide-react'];
if (lucideStats) {
  recommendations.push({
    priority: 'INFO',
    library: 'lucide-react',
    size: lucideStats.rendered,
    suggestion: `lucide-react icons add ${formatBytes(lucideStats.rendered)}. Icons are tree-shaken when using named imports. This is normal.`
  });
}

recommendations.sort((a, b) => {
  const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2, 'INFO': 3 };
  return priorityOrder[a.priority] - priorityOrder[b.priority];
});

recommendations.forEach((rec, i) => {
  const emoji = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : rec.priority === 'LOW' ? '🟢' : 'ℹ️';
  console.log(`\n${emoji} [${rec.priority}] ${rec.library} (${formatBytes(rec.size)})`);
  console.log(`   ${rec.suggestion}`);
});

console.log('\n' + '='.repeat(105));
console.log('📈 CODE SPLITTING IMPLEMENTATION');
console.log('-'.repeat(105));
console.log(`
Current bundle: ${formatBytes(totalRendered)} minified (${formatBytes(totalGzip)} gzipped)
Vite warns about chunks > 500KB. Your bundle is ~1.7MB.

🎯 SUGGESTED LAZY-LOADING STRATEGY:

1. Charts chunk (recharts + d3): ~${formatBytes(chartsTotal)}
   - Affects: Dashboard views, Report visualizations
   - Implementation:
     const BarChartComponent = lazy(() => import('./visualizations/BarChartComponent'));
     const LineChartComponent = lazy(() => import('./visualizations/LineChartComponent'));
     const PieChartComponent = lazy(() => import('./visualizations/PieChartComponent'));

2. Maps chunk (Leaflet): ~${formatBytes(mapsTotal)}
   - Affects: MapPanel component
   - Implementation:
     const MapPanel = lazy(() => import('./visualizations/MapPanel'));

3. SQL Editor (Monaco): ~${formatBytes(monacoTotal)} (loader only, editor from CDN)
   - Affects: SqlEditor page
   - Implementation:
     const SqlEditor = lazy(() => import('./pages/SqlEditor'));

📁 Add to vite.config.ts for explicit chunking:

build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-charts': ['recharts'],
        'vendor-maps': ['leaflet', 'react-leaflet'],
        'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', ...],
      }
    }
  }
}

Expected improvement: Initial load reduced by 40-50%
`);

console.log('='.repeat(105));
console.log('\n✅ Report generated! Open stats.html in browser for interactive treemap visualization.\n');
