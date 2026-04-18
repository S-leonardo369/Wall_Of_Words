/**
 * Generates default wallpapers and icons using pure Node.js (no native deps needed at gen-time).
 * Run once: node scripts/gen-assets.js
 */
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const WP_DIR = path.join(ASSETS, 'wallpapers');
[ASSETS, WP_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Minimal 1x1 transparent PNG
const TRANSPARENT_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000a49444154789c6260000000020001e221bc33000000' +
  '0049454e44ae426082', 'hex'
);

// Write placeholder icon if not present
const iconPath = path.join(ASSETS, 'icon.png');
const trayPath = path.join(ASSETS, 'tray-icon.png');
if (!fs.existsSync(iconPath)) fs.writeFileSync(iconPath, TRANSPARENT_PNG);
if (!fs.existsSync(trayPath)) fs.writeFileSync(trayPath, TRANSPARENT_PNG);

console.log('[gen-assets] Placeholder icons written.');
console.log('[gen-assets] Note: Replace assets/icon.png and assets/tray-icon.png with real 256x256 icons.');
console.log('[gen-assets] Default wallpapers will be generated at runtime if canvas is available.');
