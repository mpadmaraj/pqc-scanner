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
      "@": resolve("./src"),
      "@shared": resolve("../shared"),
      "@assets": resolve("../attached_assets"),
    },
  },
  build: {
    outDir: resolve("../vercel-build"),
    emptyOutDir: true,
  },
});
`;

// Write the Vite config to client directory
writeFileSync('client/vite.config.vercel.js', vercelViteConfig);

// Copy Tailwind configuration for the build
const tailwindConfig = `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
      },
    },
  },
  plugins: [],
}
`;

const postcssConfig = `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

writeFileSync('client/tailwind.config.js', tailwindConfig);
writeFileSync('client/postcss.config.js', postcssConfig);

// Change to client directory and run build
console.log('Running vite build from client directory...');
process.chdir('client');
execSync('vite build --config vite.config.vercel.js', { stdio: 'inherit' });
process.chdir('..');

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
execSync('rm -f client/vite.config.vercel.js client/tailwind.config.js client/postcss.config.js');
execSync('rm -rf vercel-build');