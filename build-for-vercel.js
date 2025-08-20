#!/usr/bin/env node
import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

function copyRecursiveSync(src, dest) {
  const stats = statSync(src);
  const isDirectory = stats.isDirectory();
  
  if (isDirectory) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName));
    });
  } else {
    copyFileSync(src, dest);
  }
}

console.log('Building for Vercel...');

// Run the build command
console.log('Running vite build...');
execSync('vite build', { stdio: 'inherit' });

// Copy files to public directory
console.log('Copying files to public directory...');
copyRecursiveSync('dist/public', 'public');

console.log('Build completed successfully!');
console.log('Files in public directory:');
execSync('ls -la public/', { stdio: 'inherit' });