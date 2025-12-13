#!/usr/bin/env node
/**
 * Generate Apple Touch Icon from logo SVG
 * Creates:
 * - apple-touch-icon-v2.png (180x180 PNG for iOS)
 * Note: favicon.png should be manually copied from data/logo/favicon.png
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const logoPath = path.join(ROOT_DIR, 'public', 'logo.svg');
const appleIconPath = path.join(ROOT_DIR, 'public', 'apple-touch-icon-v2.png');

async function generateIcons() {
  try {
    if (!fs.existsSync(logoPath)) {
      console.error(`❌ Logo not found: ${logoPath}`);
      process.exit(1);
    }

    console.log('🎨 Generating Apple Touch Icon from logo...');
    
    // Generate Apple Touch Icon (180x180 PNG with white background)
    await sharp(logoPath)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .png()
      .toFile(appleIconPath);

    console.log(`✅ Created: ${appleIconPath}`);
    console.log(`   Size: 180×180 PNG`);
    console.log('\n✨ Apple Touch Icon generated successfully!');
    console.log('💡 Note: favicon.png should be copied from data/logo/favicon.png');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

