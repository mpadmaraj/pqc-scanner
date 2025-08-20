#!/usr/bin/env node
import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs';
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

// Create a temporary, isolated Vite config for Vercel
const vercelViteConfig = `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "client/src"),
      "@shared": resolve(process.cwd(), "shared"),
      "@assets": resolve(process.cwd(), "attached_assets"),
    },
  },
  root: resolve(process.cwd(), "client"),
  build: {
    outDir: resolve(process.cwd(), "vercel-build"),
    emptyOutDir: true,
  },
});
`;

writeFileSync('vite.config.vercel-deploy.js', vercelViteConfig);

// Temporarily rename the original config to avoid conflicts
if (existsSync('vite.config.ts')) {
  console.log('Temporarily moving original vite.config.ts...');
  execSync('mv vite.config.ts vite.config.ts.backup');
}

// Run the build command with isolated config
console.log('Running vite build with isolated config...');
execSync('vite build --config vite.config.vercel-deploy.js', { stdio: 'inherit' });

// Copy files to public directory
console.log('Copying files to public directory...');
if (!existsSync('public')) {
  mkdirSync('public', { recursive: true });
}
copyRecursiveSync('vercel-build', 'public');

console.log('Build completed successfully!');
console.log('Files in public directory:');
execSync('ls -la public/', { stdio: 'inherit' });

// Restore the original config and clean up
if (existsSync('vite.config.ts.backup')) {
  execSync('mv vite.config.ts.backup vite.config.ts');
}
execSync('rm -f vite.config.vercel-deploy.js');
execSync('rm -rf vercel-build');