#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get package.json dependencies
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = Object.keys(packageJson.dependencies || {});
const devDeps = Object.keys(packageJson.devDependencies || {});

// Calculate directory size recursively
function getDirSize(dirPath) {
  let size = 0;
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        size += getDirSize(fullPath);
      } else if (item.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch (e) {
    // Ignore errors (permission issues, etc.)
  }
  return size;
}

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get sizes for all packages in node_modules
function getPackageSizes() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  const packages = {};
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('node_modules not found. Run npm install first.');
    process.exit(1);
  }
  
  const items = fs.readdirSync(nodeModulesPath, { withFileTypes: true });
  
  for (const item of items) {
    if (!item.isDirectory()) continue;
    if (item.name.startsWith('.')) continue;
    
    const pkgPath = path.join(nodeModulesPath, item.name);
    
    if (item.name.startsWith('@')) {
      // Scoped package
      const scopedItems = fs.readdirSync(pkgPath, { withFileTypes: true });
      for (const scopedItem of scopedItems) {
        if (!scopedItem.isDirectory()) continue;
        const fullName = `${item.name}/${scopedItem.name}`;
        const fullPath = path.join(pkgPath, scopedItem.name);
        packages[fullName] = getDirSize(fullPath);
      }
    } else {
      packages[item.name] = getDirSize(pkgPath);
    }
  }
  
  return packages;
}

// Get transitive dependencies count
function getTransitiveDeps(pkgName) {
  try {
    const result = execSync(`npm ls ${pkgName} --json 2>/dev/null`, { encoding: 'utf8' });
    const data = JSON.parse(result);
    
    function countDeps(obj, visited = new Set()) {
      let count = 0;
      if (obj.dependencies) {
        for (const [name, info] of Object.entries(obj.dependencies)) {
          if (!visited.has(name)) {
            visited.add(name);
            count++;
            count += countDeps(info, visited);
          }
        }
      }
      return count;
    }
    
    return countDeps(data);
  } catch (e) {
    return 0;
  }
}

console.log('='.repeat(105));
console.log('📦 BACKEND DEPENDENCIES ANALYSIS REPORT');
console.log('='.repeat(105));
console.log(`\nGenerated: ${new Date().toISOString()}`);

// Get all package sizes
console.log('\n⏳ Analyzing node_modules...');
const allPackages = getPackageSizes();
const totalSize = Object.values(allPackages).reduce((a, b) => a + b, 0);

console.log(`\n📊 SUMMARY`);
console.log('-'.repeat(105));
console.log(`Total node_modules size: ${formatBytes(totalSize)}`);
console.log(`Total packages: ${Object.keys(allPackages).length}`);
console.log(`Direct dependencies: ${deps.length}`);
console.log(`Dev dependencies: ${devDeps.length}`);

// Sort by size
const sortedPackages = Object.entries(allPackages)
  .sort((a, b) => b[1] - a[1]);

console.log('\n' + '='.repeat(105));
console.log('🏆 TOP 30 LARGEST PACKAGES (disk size in node_modules)');
console.log('-'.repeat(105));
console.log(
  'Rank'.padEnd(6) +
  'Package'.padEnd(50) +
  'Size'.padStart(12) +
  '% of total'.padStart(12) +
  'Type'.padStart(12)
);
console.log('-'.repeat(105));

sortedPackages.slice(0, 30).forEach(([name, size], index) => {
  const percent = ((size / totalSize) * 100).toFixed(1);
  const isDirect = deps.includes(name);
  const isDevDirect = devDeps.includes(name);
  const type = isDirect ? 'direct' : isDevDirect ? 'dev' : 'transitive';
  
  console.log(
    `${(index + 1).toString().padEnd(6)}` +
    `${name.substring(0, 48).padEnd(50)}` +
    `${formatBytes(size).padStart(12)}` +
    `${(percent + '%').padStart(12)}` +
    `${type.padStart(12)}`
  );
});

// Categorize direct dependencies
console.log('\n' + '='.repeat(105));
console.log('📁 DIRECT DEPENDENCIES BY CATEGORY');
console.log('-'.repeat(105));

const categories = {
  'PDF/Excel Export': ['puppeteer', 'exceljs'],
  'Database': ['pg', 'ioredis', 'redis'],
  'Queue/Jobs': ['bullmq'],
  'Web Framework': ['express', 'cors', 'helmet', 'compression', 'express-rate-limit'],
  'Authentication': ['bcryptjs', 'jsonwebtoken'],
  'Validation': ['joi', 'node-sql-parser'],
  'Logging': ['winston'],
  'Config': ['dotenv']
};

for (const [category, pkgNames] of Object.entries(categories)) {
  let categorySize = 0;
  const found = [];
  
  for (const name of pkgNames) {
    // Find the package and all its scoped variants
    for (const [pkgName, size] of Object.entries(allPackages)) {
      if (pkgName === name || pkgName.startsWith(`${name}/`)) {
        categorySize += size;
        if (!found.includes(name)) found.push(name);
      }
    }
    // Direct match
    if (allPackages[name]) {
      if (!found.includes(name)) {
        categorySize += allPackages[name];
        found.push(name);
      }
    }
  }
  
  if (categorySize > 0) {
    const percent = ((categorySize / totalSize) * 100).toFixed(1);
    console.log(
      `${category.padEnd(30)}` +
      `${formatBytes(categorySize).padStart(12)}` +
      `${(percent + '%').padStart(10)}` +
      `  [${found.join(', ')}]`
    );
  }
}

// Direct dependencies analysis
console.log('\n' + '='.repeat(105));
console.log('📋 DIRECT DEPENDENCIES (sorted by size)');
console.log('-'.repeat(105));

const directDepsWithSize = deps.map(name => ({
  name,
  size: allPackages[name] || 0
})).sort((a, b) => b.size - a.size);

directDepsWithSize.forEach(({ name, size }, index) => {
  const percent = ((size / totalSize) * 100).toFixed(1);
  console.log(
    `${(index + 1).toString().padStart(3)}. ${name.padEnd(40)} ${formatBytes(size).padStart(12)} (${percent}%)`
  );
});

// Recommendations
console.log('\n' + '='.repeat(105));
console.log('💡 OPTIMIZATION RECOMMENDATIONS');
console.log('-'.repeat(105));

const recommendations = [];

// Check for puppeteer
const puppeteerSize = allPackages['puppeteer'] || 0;
if (puppeteerSize > 1000000) {
  recommendations.push({
    priority: 'HIGH',
    package: 'puppeteer',
    size: puppeteerSize,
    suggestion: `Puppeteer downloads Chromium (~200MB+). Consider:
   - Using puppeteer-core + system Chrome for production
   - Using @sparticuz/chromium for AWS Lambda
   - Offloading PDF generation to a dedicated service`
  });
}

// Check for Redis duplication
const ioredisSize = allPackages['ioredis'] || 0;
const redisSize = allPackages['redis'] || 0;
if (ioredisSize > 0 && redisSize > 0) {
  recommendations.push({
    priority: 'MEDIUM',
    package: 'ioredis + redis',
    size: ioredisSize + redisSize,
    suggestion: `You have both ioredis and redis packages. Consider using only one:
   - ioredis is more feature-rich and popular
   - bullmq requires ioredis, so you can remove 'redis' package`
  });
}

// Check exceljs
const exceljsSize = allPackages['exceljs'] || 0;
if (exceljsSize > 500000) {
  recommendations.push({
    priority: 'LOW',
    package: 'exceljs',
    size: exceljsSize,
    suggestion: `ExcelJS adds ${formatBytes(exceljsSize)}. If you only need simple CSV/Excel:
   - Consider xlsx-populate (smaller) or csv-stringify for CSV only
   - ExcelJS is fine if you need advanced Excel features`
  });
}

// Dev dependencies in production
const devInProd = [];
for (const devDep of devDeps) {
  if (allPackages[devDep]) {
    devInProd.push({ name: devDep, size: allPackages[devDep] });
  }
}

if (devInProd.length > 0) {
  const devSize = devInProd.reduce((sum, d) => sum + d.size, 0);
  recommendations.push({
    priority: 'INFO',
    package: 'devDependencies',
    size: devSize,
    suggestion: `Dev dependencies add ${formatBytes(devSize)} to node_modules.
   - In production, use: npm ci --only=production
   - For Docker: RUN npm ci --only=production`
  });
}

recommendations.sort((a, b) => {
  const order = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2, 'INFO': 3 };
  return order[a.priority] - order[b.priority];
});

recommendations.forEach((rec) => {
  const emoji = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : rec.priority === 'LOW' ? '🟢' : 'ℹ️';
  console.log(`\n${emoji} [${rec.priority}] ${rec.package} (${formatBytes(rec.size)})`);
  console.log(`   ${rec.suggestion}`);
});

// Docker optimization tips
console.log('\n' + '='.repeat(105));
console.log('🐳 DOCKER OPTIMIZATION TIPS');
console.log('-'.repeat(105));
console.log(`
Current node_modules: ${formatBytes(totalSize)}

For smaller Docker images:

1. Use multi-stage builds:
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   FROM node:20-alpine
   COPY --from=builder /app/node_modules ./node_modules
   COPY dist ./dist

2. For puppeteer, use:
   FROM ghcr.io/puppeteer/puppeteer:latest
   Or install system Chrome and use puppeteer-core

3. Use .dockerignore to exclude:
   node_modules
   *.md
   .git
   tests/
`);

console.log('='.repeat(105));
console.log('\n✅ Backend dependencies analysis complete!\n');
