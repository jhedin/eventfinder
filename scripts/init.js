#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Initialize project by copying .env.template to .env
 */

const TEMPLATE_PATH = path.join(__dirname, '..', '.env.template');
const ENV_PATH = path.join(__dirname, '..', '.env');

console.log('🚀 Initializing EventFinder...\n');

// Check if .env already exists
if (fs.existsSync(ENV_PATH)) {
  console.log('⚠️  .env file already exists!');
  console.log('   To reconfigure, either:');
  console.log('   1. Delete .env and run "npm run init" again');
  console.log('   2. Run "npm run setup" for guided configuration\n');
  process.exit(0);
}

// Check if template exists
if (!fs.existsSync(TEMPLATE_PATH)) {
  console.error('❌ Error: .env.template not found');
  process.exit(1);
}

// Copy template to .env
try {
  fs.copyFileSync(TEMPLATE_PATH, ENV_PATH);
  console.log('✅ Created .env file from template\n');
  console.log('Next steps:');
  console.log('1. Edit .env and add your API keys');
  console.log('   OR');
  console.log('2. Run "npm run setup" for guided configuration with an LLM assistant\n');
  console.log('💡 Tip: The setup assistant can help you:');
  console.log('   - Obtain API keys and OAuth tokens');
  console.log('   - Configure MCP servers');
  console.log('   - Test your configuration\n');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  process.exit(1);
}
