#!/usr/bin/env node
// Simplified build script that works directly with Vercel's environment

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

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

console.log('🚀 Building PQC Scanner for Vercel...');
console.log('Working directory:', process.cwd());
console.log('Available directories:', readdirSync('.').filter(f => !f.startsWith('.') && statSync(f).isDirectory()));
console.log('Available files:', readdirSync('.').filter(f => !f.startsWith('.') && !statSync(f).isDirectory()));

// Check if we have the necessary directories for building
if (!existsSync('client') || !existsSync('server') || !existsSync('shared')) {
  console.log('❌ Missing required directories (client, server, shared)');
  console.log('This suggests the Vercel deployment is not including all source files.');
  console.log('Checking .vercelignore file...');
  
  if (existsSync('.vercelignore')) {
    console.log('Contents of .vercelignore:', require('fs').readFileSync('.vercelignore', 'utf8'));
  }
  
  console.log('❌ Cannot build without source directories. Please check Vercel deployment configuration.');
  process.exit(1);
}

try {
  // Simple approach: Use the main vite command but with environment variable
  console.log('Setting VERCEL environment and building...');
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';
  
  // Build using the main configuration
  execSync('npm run build', { stdio: 'inherit' });
  
  // Copy from wherever the build output went to public
  console.log('Looking for build output...');
  if (existsSync('dist/public')) {
    console.log('Found dist/public, copying to public...');
    if (!existsSync('public')) {
      mkdirSync('public', { recursive: true });
    }
    copyRecursiveSync('dist/public', 'public');
  } else if (existsSync('client/dist')) {
    console.log('Found client/dist, copying to public...');
    if (!existsSync('public')) {
      mkdirSync('public', { recursive: true });
    }
    copyRecursiveSync('client/dist', 'public');
  } else {
    console.log('Checking other possible build locations...');
    console.log('Current directory contents:', readdirSync('.'));
    if (existsSync('client')) {
      console.log('Client directory contents:', readdirSync('client'));
    }
  }
  
  console.log('✅ Build completed successfully!');
  if (existsSync('public')) {
    console.log('Files in public directory:');
    execSync('ls -la public/', { stdio: 'inherit' });
  }
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}