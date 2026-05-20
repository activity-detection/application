#!/usr/bin/env node
/**
 * Fix all relative imports (../) to use absolute paths (@/)
 * Recursively scans src/ directory and replaces all relative parent imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

function getAbsoluteImportPath(relativeImportPath, fromFilePath) {
  // Resolve the relative import path based on the file's location
  const fromDir = path.dirname(fromFilePath);
  const resolvedPath = path.resolve(fromDir, relativeImportPath);
  
  // Get the path relative to src/
  const srcIndex = resolvedPath.indexOf(srcDir);
  if (srcIndex === -1) return null;
  
  let relativePath = resolvedPath.slice(srcDir.length + 1);
  
  // Remove .ts/.tsx extension if present
  relativePath = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');
  
  return `@/${relativePath}`;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // Match all relative imports from parent directories
  const importRegex = /from\s+['"](\.\.[\/\w\-\.]+)['"]|import\s+(?:type\s+)?{[^}]*}\s+from\s+['"](\.\.[\/\w\-\.]+)['"]/g;
  
  const newContent = content.replace(importRegex, (match, group1, group2) => {
    const relativePath = group1 || group2;
    if (!relativePath) return match;
    
    const absPath = getAbsoluteImportPath(relativePath, filePath);
    if (!absPath) return match;
    
    changed = true;
    return match.replace(relativePath, absPath);
  });
  
  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Fixed: ${path.relative(projectRoot, filePath)}`);
  }
  
  return changed;
}

function walkDir(dir) {
  let fixedCount = 0;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      fixedCount += walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (entry.name.endsWith('.d.ts')) continue;
      if (processFile(fullPath)) fixedCount++;
    }
  }
  
  return fixedCount;
}

console.log('🔧 Converting relative imports to absolute (@/) paths...\n');
const count = walkDir(srcDir);
console.log(`\n✅ Fixed ${count} file(s) with relative imports`);
