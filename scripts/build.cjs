#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Build script for LLM agent package
 * Copies files from src/ to build/ with appropriate transformations
 */

const SRC_DIR = path.join(__dirname, '..', 'src');
const BUILD_DIR = path.join(__dirname, '..', 'build');

// File mapping: [source, destination]
const FILE_MAPPINGS = [
  ['context.md', 'CLAUDE.md'],           // Execution context becomes CLAUDE.md
  ['mcp.json', '.mcp.json'],             // MCP config goes to root
  ['script.md', 'script.md'],            // Main script
];

// Directory mappings: [source, destination]
const DIR_MAPPINGS = [
  ['context', 'context'],                // Context files
  ['templates', 'templates'],            // Prompt templates (if exists)
  ['commands', '.claude/commands'],      // Slash commands (build output)
];

// Project-root mappings: always kept in sync with src/ (used by local Claude Code)
const ROOT_DIR = path.join(__dirname, '..');
const ROOT_DIR_MAPPINGS = [
  ['commands', '.claude/commands'],      // Slash commands (local dev)
];

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
  console.log('🔨 Building LLM agent package...\n');

  // Check if src directory exists
  if (!fs.existsSync(SRC_DIR)) {
    console.error('❌ Error: src/ directory not found');
    process.exit(1);
  }

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

  // Also sync commands to project-root .claude/commands/ for local dev
  console.log('\n📁 Syncing to project root (local dev):');
  for (const [src, dest] of ROOT_DIR_MAPPINGS) {
    copyDir(
      path.join(SRC_DIR, src),
      path.join(ROOT_DIR, dest)
    );
  }

  console.log('\n✅ Build complete! Run from build/ directory with: cd build && claude-code');
}

// Run build
try {
  build();
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
