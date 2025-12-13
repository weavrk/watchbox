#!/usr/bin/env node
/**
 * Generate Apple Touch Icon from black logo SVG
 * Creates a 180x180 PNG for iOS "Add to Home Screen"
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const svgPath = path.join(ROOT_DIR, 'public', 'logo-black.svg');
const outputPath = path.join(ROOT_DIR, 'public', 'apple-touch-icon-v2.png');

async function generateIcon() {
  try {
    if (!fs.existsSync(svgPath)) {
      console.error(`❌ SVG not found: ${svgPath}`);
      process.exit(1);
    }

    console.log('🎨 Generating Apple Touch Icon...');
    
    await sharp(svgPath)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .png()
      .toFile(outputPath);

    console.log(`✅ Created: ${outputPath}`);
    console.log(`   Size: 180×180 PNG`);
  } catch (error) {
    console.error('❌ Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();

