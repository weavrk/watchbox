#!/usr/bin/env node
/**
 * WatchBox Deployment Script
 * 
 * Usage:
 *   node scripts/deploy.js [options]
 * 
 * Options:
 *   --dry-run    Show what would be uploaded without actually uploading
 *   --skip-build Skip the build step (use existing dist/)
 *   --skip-ftp   Skip FTP upload (just build and archive)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipBuild = args.includes('--skip-build');
const skipFtp = args.includes('--skip-ftp');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found. Please create one with FTP credentials.');
    console.error('   See .env.example for the required format.');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

// Get timestamp for archive folder
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}${min}`;
}

// Copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
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
}

// Count files in directory
function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

// Main deployment function
async function deploy() {
  console.log('🚀 WatchBox Deployment');
  console.log('='.repeat(50));
  
  if (isDryRun) {
    console.log('📋 DRY RUN - No actual changes will be made\n');
  }
  
  const env = loadEnv();
  const distDir = path.join(ROOT_DIR, 'dist');
  const archiveBaseDir = path.join(ROOT_DIR, 'x.archive', 'deploys');
  const timestamp = getTimestamp();
  const archiveDir = path.join(archiveBaseDir, timestamp);
  
  // Step 1: Build
  if (!skipBuild) {
    console.log('📦 Building production bundle...');
    if (!isDryRun) {
      try {
        execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Build failed');
        process.exit(1);
      }
    } else {
      console.log('   (skipped in dry run)');
    }
    console.log('✅ Build complete\n');
  } else {
    console.log('⏭️  Skipping build (using existing dist/)\n');
  }
  
  // Verify dist exists
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Run build first.');
    process.exit(1);
  }
  
  const fileCount = countFiles(distDir);
  console.log(`📁 Found ${fileCount} files in dist/\n`);
  
  // Step 2: Create local archive
  console.log(`📂 Creating local archive: x.archive/deploys/${timestamp}/`);
  if (!isDryRun) {
    fs.mkdirSync(archiveBaseDir, { recursive: true });
    copyDir(distDir, archiveDir);
    
    // Also copy API files to archive
    const apiSrc = path.join(ROOT_DIR, 'api');
    const apiDest = path.join(archiveDir, 'api');
    if (fs.existsSync(apiSrc)) {
      copyDir(apiSrc, apiDest);
      console.log('   + Included api/ folder');
    }
    
    // Create a manifest file
    const manifest = {
      timestamp: new Date().toISOString(),
      files: fileCount,
      version: timestamp,
      deployed: !skipFtp
    };
    fs.writeFileSync(
      path.join(archiveDir, 'deploy-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }
  console.log('✅ Archive created\n');
  
  // Step 3: FTP Upload
  if (!skipFtp) {
    console.log('📤 Uploading to GoDaddy via FTP...');
    console.log(`   Host: ${env.FTP_HOST}`);
    console.log(`   Path: ${env.FTP_REMOTE_PATH}`);
    
    if (!isDryRun) {
      try {
        // Dynamic import for basic-ftp
        const { Client } = await import('basic-ftp');
        const client = new Client();
        client.ftp.verbose = false;
        
        await client.access({
          host: env.FTP_HOST,
          user: env.FTP_USER,
          password: env.FTP_PASS,
          secure: false // GoDaddy shared hosting often uses plain FTP
        });
        
        console.log('   Connected to FTP server');
        
        // Ensure remote directory exists
        await client.ensureDir(env.FTP_REMOTE_PATH);
        
        // Upload dist contents
        await client.uploadFromDir(distDir, env.FTP_REMOTE_PATH);
        console.log('   Uploaded dist/ files');
        
        // Upload API files
        const apiSrc = path.join(ROOT_DIR, 'api');
        const baseRemotePath = env.FTP_REMOTE_PATH.replace('/hrefs/watchbox', '');
        if (fs.existsSync(apiSrc)) {
          const apiRemotePath = baseRemotePath + '/api';
          await client.ensureDir(apiRemotePath);
          await client.uploadFromDir(apiSrc, apiRemotePath);
          console.log('   Uploaded api/ files');
        }
        
        // Upload data/users folder (user profiles)
        const usersDir = path.join(ROOT_DIR, 'data', 'users');
        if (fs.existsSync(usersDir)) {
          const usersRemotePath = baseRemotePath + '/data/users';
          await client.ensureDir(usersRemotePath);
          await client.uploadFromDir(usersDir, usersRemotePath);
          console.log('   Uploaded data/users/ files');
        }
        
        // Upload data/avatars folder (avatar SVGs)
        const avatarsDir = path.join(ROOT_DIR, 'data', 'avatars');
        if (fs.existsSync(avatarsDir)) {
          const avatarsRemotePath = baseRemotePath + '/data/avatars';
          await client.ensureDir(avatarsRemotePath);
          // Upload only SVG files, skip x.archive subfolder
          const avatarFiles = fs.readdirSync(avatarsDir);
          for (const file of avatarFiles) {
            const filePath = path.join(avatarsDir, file);
            if (fs.statSync(filePath).isFile() && file.endsWith('.svg')) {
              await client.uploadFrom(filePath, avatarsRemotePath + '/' + file);
            }
          }
          console.log('   Uploaded data/avatars/ files');
        }
        
        // Upload data/streaming JSON files (explore content + defaults)
        const moviesJson = path.join(ROOT_DIR, 'data', 'streaming-movies-results.json');
        const showsJson = path.join(ROOT_DIR, 'data', 'streaming-shows-results.json');
        const defaultServicesJson = path.join(ROOT_DIR, 'data', 'default_streaming_services.json');
        const dataRemotePath = baseRemotePath + '/data';
        await client.ensureDir(dataRemotePath);
        
        if (fs.existsSync(moviesJson)) {
          await client.uploadFrom(moviesJson, dataRemotePath + '/streaming-movies-results.json');
          console.log('   Uploaded data/streaming-movies-results.json');
        }
        
        if (fs.existsSync(showsJson)) {
          await client.uploadFrom(showsJson, dataRemotePath + '/streaming-shows-results.json');
          console.log('   Uploaded data/streaming-shows-results.json');
        }
        
        if (fs.existsSync(defaultServicesJson)) {
          await client.uploadFrom(defaultServicesJson, dataRemotePath + '/default_streaming_services.json');
          console.log('   Uploaded data/default_streaming_services.json');
        }
        
        // Upload data/streaming folder (streaming service logos)
        const streamingDir = path.join(ROOT_DIR, 'data', 'streaming');
        if (fs.existsSync(streamingDir)) {
          const streamingRemotePath = baseRemotePath + '/data/streaming';
          await client.ensureDir(streamingRemotePath);
          await client.uploadFromDir(streamingDir, streamingRemotePath);
          console.log('   Uploaded data/streaming/ files');
        }
        
        // Upload data/posters folder (poster images)
        const postersDir = path.join(ROOT_DIR, 'data', 'posters');
        if (fs.existsSync(postersDir)) {
          const postersRemotePath = baseRemotePath + '/data/posters';
          await client.ensureDir(postersRemotePath);
          await client.uploadFromDir(postersDir, postersRemotePath);
          console.log('   Uploaded data/posters/ files');
        }
        
        // Upload public/design-tokens.json if it exists
        const designTokensFile = path.join(ROOT_DIR, 'public', 'design-tokens.json');
        if (fs.existsSync(designTokensFile)) {
          const designTokensRemotePath = env.FTP_REMOTE_PATH + '/design-tokens.json';
          await client.uploadFrom(designTokensFile, designTokensRemotePath);
          console.log('   Uploaded design-tokens.json');
        }
        
        // Upload public/icon-192.png if it exists (should be in dist already, but ensure it's there)
        const icon192File = path.join(ROOT_DIR, 'public', 'icon-192.png');
        if (fs.existsSync(icon192File)) {
          const icon192RemotePath = env.FTP_REMOTE_PATH + '/icon-192.png';
          await client.uploadFrom(icon192File, icon192RemotePath);
          console.log('   Uploaded icon-192.png');
        }
        
        client.close();
        console.log('✅ FTP upload complete\n');
      } catch (error) {
        console.error('❌ FTP upload failed:', error.message);
        console.log('\n💡 Tip: Check your FTP credentials in .env');
        console.log('   The archive was still created locally.');
        process.exit(1);
      }
    } else {
      console.log('   (skipped in dry run)');
      console.log('✅ FTP upload would complete\n');
    }
  } else {
    console.log('⏭️  Skipping FTP upload\n');
  }
  
  // Summary
  console.log('='.repeat(50));
  console.log('🎉 Deployment complete!');
  console.log('');
  console.log('Summary:');
  console.log(`   📁 Archive: x.archive/deploys/${timestamp}/`);
  if (!skipFtp && !isDryRun) {
    console.log(`   🌐 Live at: https://weavrk.com/hrefs/watchbox/`);
  }
  console.log('');
}

// Run
deploy().catch(error => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});

