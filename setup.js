#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function createEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (fs.existsSync(envPath)) {
    log('⚠️  .env file already exists, skipping creation...', 'yellow');
    return;
  }
  
  if (!fs.existsSync(envExamplePath)) {
    log('❌ .env.example file not found!', 'red');
    return;
  }
  
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // 生成JWT密钥
  const jwtSecret = generateJWTSecret();
  envContent = envContent.replace(
    'your_super_secret_jwt_key_here_replace_with_random_64_char_string',
    jwtSecret
  );
  
  fs.writeFileSync(envPath, envContent);
  log('✅ Created .env file with generated JWT secret', 'green');
}

function installDependencies() {
  log('📦 Installing dependencies...', 'blue');
  try {
    execSync('npm install', { stdio: 'inherit' });
    log('✅ Dependencies installed successfully', 'green');
  } catch (error) {
    log('❌ Failed to install dependencies', 'red');
    process.exit(1);
  }
}

function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    log('❌ Node.js version 16.0 or higher is required', 'red');
    log(`Current version: ${nodeVersion}`, 'yellow');
    process.exit(1);
  }
  
  log(`✅ Node.js version check passed (${nodeVersion})`, 'green');
}

function displayWelcome() {
  log('', 'reset');
  log('🔥 FireChat - Coze聊天SDK演示项目', 'cyan');
  log('=====================================', 'cyan');
  log('', 'reset');
}

function displayNextSteps() {
  log('', 'reset');
  log('🎉 Setup completed successfully!', 'green');
  log('', 'reset');
  log('📝 Next steps:', 'bright');
  log('1. Edit .env file and add your Coze API credentials:', 'yellow');
  log('   - COZE_API_TOKEN: Your Coze Personal Access Token', 'yellow');
  log('   - COZE_BOT_ID: Your Coze Bot ID', 'yellow');
  log('', 'reset');
  log('2. Get your Coze credentials:', 'yellow');
  log('   - Visit: https://www.coze.com/open/oauth/pats', 'cyan');
  log('   - Create a Personal Access Token', 'yellow');
  log('   - Create or select a Bot and get its ID', 'yellow');
  log('', 'reset');
  log('3. Start the development server:', 'yellow');
  log('   npm run dev', 'green');
  log('', 'reset');
  log('4. Open your browser and visit:', 'yellow');
  log('   http://localhost:3000', 'cyan');
  log('', 'reset');
  log('📚 For more information, check the README.md file', 'blue');
  log('', 'reset');
}

function main() {
  try {
    displayWelcome();
    
    log('🔍 Checking Node.js version...', 'blue');
    checkNodeVersion();
    
    log('⚙️  Creating environment configuration...', 'blue');
    createEnvFile();
    
    installDependencies();
    
    displayNextSteps();
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();