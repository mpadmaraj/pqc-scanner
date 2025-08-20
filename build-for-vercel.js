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
      "@": resolve("./client/src"),
      "@shared": resolve("./shared"),
      "@assets": resolve("./attached_assets"),
    },
  },
  root: "./client",
  build: {
    outDir: "../vercel-build",
    emptyOutDir: true,
  },
});
`;

writeFileSync('vite.config.temp.js', vercelViteConfig);

// Run the build command with temporary config
console.log('Running vite build with isolated config...');
execSync('vite build --config vite.config.temp.js', { stdio: 'inherit' });

// Copy files to public directory
console.log('Copying files to public directory...');
if (!existsSync('public')) {
  mkdirSync('public', { recursive: true });
}
copyRecursiveSync('vercel-build', 'public');

console.log('Build completed successfully!');
console.log('Files in public directory:');
execSync('ls -la public/', { stdio: 'inherit' });

// Clean up temporary files
execSync('rm -f vite.config.temp.js');
execSync('rm -rf vercel-build');