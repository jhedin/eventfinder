#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Build script for setup LLM agent
 * Copies files from setup/src/ to setup/build/ for guided configuration
 */

const SRC_DIR = path.join(__dirname, '..', 'setup', 'src');
const BUILD_DIR = path.join(__dirname, '..', 'setup', 'build');

// File mapping: [source, destination]
const FILE_MAPPINGS = [
  ['context.md', 'CLAUDE.md'],           // Setup context becomes CLAUDE.md
  ['script.md', 'script.md'],            // Setup script
];

// Directory mappings: [source, destination]
const DIR_MAPPINGS = [
  ['guides', 'guides'],                  // Setup guides
];

/**
 * Clean build directory
 */
function clean() {
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
  }
}

/**
 * Create necessary directories
 */
function createDirs() {
  const dirs = [
    BUILD_DIR,
    path.join(BUILD_DIR, 'guides'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Copy a single file
 */
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Skipping ${src} (not found)`);
    return;
  }

  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  console.log(`✓ Copied ${path.relative(process.cwd(), src)} → ${path.relative(process.cwd(), dest)}`);
}

/**
 * Recursively copy a directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Skipping ${src} (not found)`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  console.log(`✓ Copied ${path.relative(process.cwd(), src)}/ → ${path.relative(process.cwd(), dest)}/`);
}

/**
 * Main build process
 */
function build() {
  console.log('🔧 Building setup assistant...\n');

  // Check if src directory exists
  if (!fs.existsSync(SRC_DIR)) {
    console.error('❌ Error: setup/src/ directory not found');
    process.exit(1);
  }

  // Clean and create directories
  clean();
  createDirs();

  // Copy individual files
  console.log('📄 Copying files:');
  for (const [src, dest] of FILE_MAPPINGS) {
    copyFile(
      path.join(SRC_DIR, src),
      path.join(BUILD_DIR, dest)
    );
  }

  console.log('\n📁 Copying directories:');
  // Copy directories
  for (const [src, dest] of DIR_MAPPINGS) {
    copyDir(
      path.join(SRC_DIR, src),
      path.join(BUILD_DIR, dest)
    );
  }

  console.log('\n✅ Setup assistant build complete!');
  console.log('   The setup will now launch automatically...\n');
}

// Run build
try {
  build();
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
