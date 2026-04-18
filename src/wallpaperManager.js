const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { BrowserWindow, screen } = require('electron');

const { getWord } = require('./wordFetcher');

const DEFAULT_WALLPAPERS_DIR = path.join(__dirname, '..', 'assets', 'wallpapers');
const TEMP_DIR = path.join(os.tmpdir(), 'wall-of-words');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Always re-reads from disk — picks up additions/removals automatically
function getWallpaperCandidates(store) {
  const source = store.get('wallpaperSource', 'default');
  let candidates = [];

  if (source === 'custom') {
    candidates = (store.get('customWallpapers', [])).filter(p => {
      try { return fs.existsSync(p) && fs.statSync(p).size > 4096; } catch { return false; }
    });
  }

  if (!candidates.length) {
    if (fs.existsSync(DEFAULT_WALLPAPERS_DIR)) {
      candidates = fs.readdirSync(DEFAULT_WALLPAPERS_DIR)
        .filter(f => /\.(jpg|jpeg|png|bmp|webp)$/i.test(f))
        .map(f => path.join(DEFAULT_WALLPAPERS_DIR, f))
        .filter(p => { try { return fs.statSync(p).size > 4096; } catch { return false; } });
    }
  }

  return candidates;
}

// Round-robin: cycles through all images before repeating any
function pickNextWallpaper(store) {
  const candidates = getWallpaperCandidates(store);
  if (!candidates.length) return null;

  let cycle = store.get('wallpaperCycle', []);
  // Reset cycle if all images have been used or if the image list changed
  const remaining = candidates.filter(p => !cycle.includes(p));
  if (!remaining.length) {
    cycle = [];
    store.set('wallpaperCycle', []);
  }

  const pool = candidates.filter(p => !cycle.includes(p));
  const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : candidates[0];

  cycle = [...cycle, pick];
  store.set('wallpaperCycle', cycle);
  return pick;
}

function setWallpaperWindows(imagePath) {
  const psPath = imagePath.replace(/'/g, "''");
  const script = `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
[Wallpaper]::SystemParametersInfo(20, 0, '${psPath}', 3)
`;
  const tmpScript = path.join(TEMP_DIR, `setwp_${Date.now()}.ps1`);
  fs.writeFileSync(tmpScript, script, 'utf8');
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`, (err) => {
      fs.unlink(tmpScript, () => {});
      if (err) console.error('[Wallpaper] Set error:', err.message);
      resolve(!err);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderWallpaperHTML(wordData, backgroundPath, textPos, screenW, screenH) {
  const posX = textPos?.x ?? 50;
  const posY = textPos?.y ?? 50;

  const word    = escapeHtml(wordData.word    || '');
  const meaning = escapeHtml(wordData.meaning || '');
  const example = wordData.example ? escapeHtml(`"${wordData.example}"`) : '';

  const bgUrl = backgroundPath && fs.existsSync(backgroundPath)
    ? 'file:///' + backgroundPath.replace(/\\/g, '/').replace(/ /g, '%20').replace(/#/g, '%23')
    : '';

  // Compute card boundary so it never overflows any edge.
  // Card CSS width: clamp(380, 36%, 680) → at actual screenW pixels:
  const cardMaxW  = Math.min(680, Math.round(screenW * 0.36));
  const halfW     = Math.round(cardMaxW / 2) + 20;  // +20px safe margin
  const halfH     = 200;                             // ~half of tallest expected card + margin

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: ${screenW}px; height: ${screenH}px;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
}
#bg-wrap { position: absolute; inset: 0; }
#bg-img  { width: 100%; height: 100%; object-fit: cover; display: block; }
#analysis-canvas { display: none; }
.card {
  position: absolute;
  /* clamp keeps the card fully inside the screen regardless of corner placement */
  left: clamp(${halfW}px, ${posX}%, calc(100% - ${halfW}px));
  top:  clamp(${halfH}px, ${posY}%, calc(100% - ${halfH}px));
  transform: translate(-50%, -50%);
  width: clamp(380px, 36%, 680px);
  border-radius: 20px;
  padding: 36px 44px 32px;
  box-shadow: 0 12px 50px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
  /* background / border / color injected by inline JS after colour analysis */
}
.accent-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 5px;
  border-radius: 20px 20px 0 0;
  background: linear-gradient(90deg, #7c3aed, #a78bfa, #c4b5fd);
}
.word    { font-weight: 900; letter-spacing: -0.5px; margin-bottom: 12px; line-height: 1.1;  font-size: clamp(34px, 3.5vw, 56px); }
.divider { height: 1.5px; margin-bottom: 16px; border-radius: 1px; }
.meaning { font-size: clamp(17px, 1.8vw, 28px); line-height: 1.6; font-weight: 400; }
.example { font-size: clamp(14px, 1.4vw, 21px); font-style: italic; margin-top: 16px; line-height: 1.55; opacity: 0.85; }
.badge   { position: absolute; bottom: 12px; right: 18px; font-size: clamp(10px, 0.85vw, 14px); letter-spacing: 0.07em; opacity: 0.28; }
</style>
</head>
<body>
<div id="bg-wrap">${bgUrl ? `<img id="bg-img" src="${bgUrl}" />` : ''}</div>
<canvas id="analysis-canvas"></canvas>
<div class="card" id="card">
  <div class="accent-bar"></div>
  <div class="word"    id="c-word">${word}</div>
  <div class="divider" id="c-div"></div>
  <div class="meaning">${meaning}</div>
  ${example ? `<div class="example" id="c-ex">${example}</div>` : ''}
  <div class="badge">Wall of Words</div>
</div>
<script>
(function() {
  var PX = ${posX}, PY = ${posY};
  var W  = ${screenW}, H = ${screenH};

  /* ── RGB → HSL (returns [h 0-360, s 0-100, l 0-100]) ── */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else                h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  /* ── HSL → RGB (returns [r,g,b] 0-255) ── */
  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    function hue2rgb(p, q, t) {
      if (t < 0) t++; if (t > 1) t--;
      if (t < 1/6) return p + (q-p)*6*t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q-p)*(2/3-t)*6;
      return p;
    }
    var q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    return [
      Math.round(hue2rgb(p, q, h + 1/3) * 255),
      Math.round(hue2rgb(p, q, h      ) * 255),
      Math.round(hue2rgb(p, q, h - 1/3) * 255)
    ];
  }

  /* ── Apply theme derived from sampled image colours ── */
  function applyTheme(avgR, avgG, avgB, brightness) {
    var hsl = rgbToHsl(avgR, avgG, avgB);
    var hue = hsl[0];
    var sat = Math.min(hsl[1], 55); // cap vivid saturation

    var cardRgb, cardAlpha, border, text, word, ex, div;

    if (brightness < 135) {
      /* Dark image — deep card tinted with the image's dominant hue */
      cardRgb   = hslToRgb(hue, Math.min(sat, 45), 11);
      cardAlpha = 0.80;
      border    = '1px solid rgba(255,255,255,0.11)';
      text      = '#eef2ff';
      word      = '#a78bfa';
      div       = 'rgba(167,139,250,0.42)';
      ex        = '#c4b5fd';
    } else {
      /* Light image — near-white card softly tinted with the image's hue */
      cardRgb   = hslToRgb(hue, Math.min(sat, 22), 93);
      cardAlpha = 0.84;
      border    = '1px solid rgba(0,0,0,0.08)';
      text      = '#1e1b4b';
      word      = '#6d28d9';
      div       = 'rgba(109,40,217,0.35)';
      ex        = '#4c1d95';
    }

    var card = document.getElementById('card');
    card.style.background = 'rgba('+cardRgb[0]+','+cardRgb[1]+','+cardRgb[2]+','+cardAlpha+')';
    card.style.border      = border;
    card.style.color       = text;
    document.getElementById('c-word').style.color      = word;
    document.getElementById('c-div').style.background  = div;
    var exEl = document.getElementById('c-ex');
    if (exEl) exEl.style.color = ex;
  }

  function applyFallback() { applyTheme(15, 12, 41, 30); } // dark purple default

  /* ── Sample card region then apply ── */
  function analyse() {
    var img = document.getElementById('bg-img');
    if (!img || img.naturalWidth === 0) { applyFallback(); return; }

    var canvas = document.getElementById('analysis-canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    try { ctx.drawImage(img, 0, 0, W, H); }
    catch(e) { applyFallback(); return; }

    /* Sample the region where the card actually renders (using clamped position) */
    var cardW = Math.min(680, W * 0.36);
    var cardH = 340;
    var cx    = Math.min(Math.max((PX/100)*W, cardW/2), W - cardW/2);
    var cy    = Math.min(Math.max((PY/100)*H, cardH/2), H - cardH/2);
    var sx    = Math.max(0, Math.floor(cx - cardW/2));
    var sy    = Math.max(0, Math.floor(cy - cardH/2));
    var sw    = Math.min(W - sx, Math.ceil(cardW));
    var sh    = Math.min(H - sy, cardH);

    var data, rS=0, gS=0, bS=0, n=0;
    try {
      data = ctx.getImageData(sx, sy, sw, sh).data;
      for (var i=0; i<data.length; i+=40) {
        rS += data[i]; gS += data[i+1]; bS += data[i+2]; n++;
      }
    } catch(e) { applyFallback(); return; }

    var aR = rS/n, aG = gS/n, aB = bS/n;
    var br = 0.299*aR + 0.587*aG + 0.114*aB;
    applyTheme(aR, aG, aB, br);
  }

  /* Start with fallback, refine once the image is ready */
  applyFallback();
  var img = document.getElementById('bg-img');
  if (img) {
    if (img.complete && img.naturalWidth > 0) analyse();
    else { img.onload = analyse; img.onerror = applyFallback; }
  }
})();
</script>
</body>
</html>`;
}

class WallpaperManager {
  constructor(store) {
    this.store = store;
  }

  async captureRenderedWallpaper(wordData, backgroundPath) {
    // Use actual primary display size, not hardcoded 1920×1080
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().size;
    const textPos = this.store.get('textPosition', { x: 50, y: 50 });
    const html = renderWallpaperHTML(wordData, backgroundPath, textPos, screenW, screenH);

    const tmpHtml = path.join(TEMP_DIR, `render_${Date.now()}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf8');

    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        width: screenW,
        height: screenH,
        show: false,
        frame: false,
        skipTaskbar: true,
        webPreferences: {
          offscreen: true,
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false  // needed so canvas.getImageData works on file:// images
        }
      });

      win.loadFile(tmpHtml);

      win.webContents.on('did-finish-load', () => {
        // Wait for image load + JS colour analysis to complete
        setTimeout(() => {
          win.webContents.capturePage().then(image => {
            // Always output at the native screen resolution
            const sized = image.resize({ width: screenW, height: screenH });
            const outPath = path.join(TEMP_DIR, `wallpaper_${Date.now()}.png`);
            fs.writeFileSync(outPath, sized.toPNG());
            win.destroy();
            fs.unlink(tmpHtml, () => {});
            resolve(outPath);
          }).catch(err => {
            win.destroy();
            reject(err);
          });
        }, 900); // 900ms — enough for img.onload + getImageData + style apply
      });

      win.webContents.on('did-fail-load', (_e, code, desc) => {
        win.destroy();
        reject(new Error(`Page load failed: ${desc}`));
      });
    });
  }

  async updateWallpaper() {
    try {
      const wordHistory = this.store.get('wordHistory', []);
      const wordData    = await getWord(wordHistory);
      const basePath    = pickNextWallpaper(this.store);

      const outPath = await this.captureRenderedWallpaper(wordData, basePath);
      await setWallpaperWindows(outPath);

      const wordWithTs = { ...wordData, timestamp: Date.now() };
      this.store.set('currentWord', wordWithTs);
      this.store.set('wordHistory', [...wordHistory, wordWithTs].slice(-50));

      console.log(`[WallpaperManager] Set: ${wordData.word} — bg: ${basePath ? path.basename(basePath) : 'gradient'}`);
      return { success: true, word: wordWithTs };
    } catch (err) {
      console.error('[WallpaperManager] Error:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = WallpaperManager;
