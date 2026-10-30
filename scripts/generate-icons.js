const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const rowBytes = width * 4;
  const scanlines = Buffer.alloc((1 + rowBytes) * height);
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + rowBytes)] = 0;
    rgba.copy(scanlines, y * (1 + rowBytes) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const idat = chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 }));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Distance to rounded rectangle (squircle)
function distRoundedRect(x, y, rx, ry, rw, rh, rad) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const hw = rw / 2 - rad;
  const hh = rh / 2 - rad;
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dy = Math.max(0, Math.abs(y - cy) - hh);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist - rad;
}

// Distance to rectangle
function distRect(x, y, rx, ry, rw, rh) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = Math.abs(x - cx) - rw / 2;
  const dy = Math.abs(y - cy) - rh / 2;
  const outside = Math.sqrt(Math.max(0, dx) ** 2 + Math.max(0, dy) ** 2);
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside;
}

// Distance to circle
function distCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

// Color blend
function blend(bg, fg, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  return [
    Math.round(bg[0] * (1 - a) + fg[0] * a),
    Math.round(bg[1] * (1 - a) + fg[1] * a),
    Math.round(bg[2] * (1 - a) + fg[2] * a),
    Math.min(255, Math.round(bg[3] + fg[3] * a * (1 - bg[3] / 255))),
  ];
}

// Render Master Icon at size S (e.g. 512x512)
function renderMasterIcon(S) {
  const rgba = Buffer.alloc(S * S * 4);
  const scale = S / 256;

  // Background squircle bounds
  const margin = 14 * scale;
  const rw = S - margin * 2;
  const rh = S - margin * 2;
  const rad = 52 * scale;

  // Glyph bounds
  // F Stem
  const stemX = 64 * scale, stemY = 58 * scale, stemW = 38 * scale, stemH = 142 * scale;
  // F Top bar
  const topX = 64 * scale, topY = 58 * scale, topW = 132 * scale, topH = 34 * scale;
  // F Mid bar (Crossbar with gradient)
  const midX = 64 * scale, midY = 120 * scale, midW = 106 * scale, midH = 32 * scale;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let pixel = [0, 0, 0, 0]; // RGBA

      // 1. Shadow for squircle
      const dShadow = distRoundedRect(x, y - 4 * scale, margin, margin, rw, rh, rad);
      if (dShadow < 8 * scale) {
        const shadowAlpha = Math.max(0, 1 - dShadow / (8 * scale)) * 0.45;
        pixel = blend(pixel, [0, 0, 0, 255], shadowAlpha);
      }

      // 2. Squircle Container
      const dBox = distRoundedRect(x, y, margin, margin, rw, rh, rad);
      if (dBox < 0) {
        // Inside background container
        // Gradient from top-left deep indigo (28, 25, 75) to bottom-right slate dark (12, 16, 28)
        const t = (x + y) / (2 * S);
        const bgR = Math.round(30 * (1 - t) + 10 * t);
        const bgG = Math.round(27 * (1 - t) + 15 * t);
        const bgB = Math.round(75 * (1 - t) + 30 * t);
        pixel = [bgR, bgG, bgB, 255];

        // Top specular highlight
        const dInnerTop = y - margin;
        if (dInnerTop >= 0 && dInnerTop < 40 * scale) {
          const spec = (1 - dInnerTop / (40 * scale)) * 0.12;
          pixel = blend(pixel, [255, 255, 255, 255], spec);
        }

        // Typographic Baseline / Cap-height vector guidelines
        const isCapLine = Math.abs(y - 58 * scale) < 0.8 * scale && x > margin + 10 * scale && x < S - margin - 10 * scale;
        const isBaseLine = Math.abs(y - 200 * scale) < 0.8 * scale && x > margin + 10 * scale && x < S - margin - 10 * scale;
        const isMidLine = Math.abs(y - 120 * scale) < 0.8 * scale && x > margin + 10 * scale && x < S - margin - 10 * scale;
        if ((isCapLine || isBaseLine || isMidLine) && (Math.floor(x / (4 * scale)) % 2 === 0)) {
          pixel = blend(pixel, [99, 102, 241, 255], 0.35);
        }

        // 3. Render Glyph "F" Stem and Top Bar (White to ice blue gradient)
        const dStem = distRect(x, y, stemX, stemY, stemW, stemH);
        const dTop = distRect(x, y, topX, topY, topW, topH);
        const dGlyphWhite = Math.min(dStem, dTop);

        if (dGlyphWhite < 1.0) {
          const glyphT = (y - stemY) / stemH;
          const gR = Math.round(255 * (1 - glyphT) + 224 * glyphT);
          const gG = Math.round(255 * (1 - glyphT) + 231 * glyphT);
          const gB = Math.round(255 * (1 - glyphT) + 255 * glyphT);
          const a = dGlyphWhite <= 0 ? 1 : (1 - dGlyphWhite);
          pixel = blend(pixel, [gR, gG, gB, 255], a);
        }

        // 4. Render Vibrant Crossbar (Indigo #6366f1 to Electric Cyan #38bdf8 gradient)
        const dMid = distRect(x, y, midX, midY, midW, midH);
        if (dMid < 1.0) {
          const barT = (x - midX) / midW;
          // Gradient from #6366f1 (99, 102, 241) to #38bdf8 (56, 189, 248)
          const bR = Math.round(99 * (1 - barT) + 56 * barT);
          const bG = Math.round(102 * (1 - barT) + 189 * barT);
          const bB = Math.round(241 * (1 - barT) + 248 * barT);
          const a = dMid <= 0 ? 1 : (1 - dMid);
          pixel = blend(pixel, [bR, bG, bB, 255], a);
        }

        // 5. Typographic Bezier Anchor Nodes (Cyan dots)
        const nodes = [
          [topX + topW, topY],           // Top right of top bar
          [topX + topW, topY + topH],    // Inner top bar corner
          [midX + midW, midY],           // Top right of crossbar
          [midX + midW, midY + midH],    // Bottom right of crossbar
          [stemX, stemY + stemH],        // Bottom left stem
          [stemX + stemW, stemY + stemH],// Bottom right stem
        ];

        for (const [nx, ny] of nodes) {
          const dNode = distCircle(x, y, nx, ny, 4.5 * scale);
          if (dNode < 1.5) {
            const a = dNode <= 0 ? 1 : (1 - dNode / 1.5);
            // Outer node border
            pixel = blend(pixel, [15, 23, 42, 255], a * 0.8);
          }
          if (dNode < 0) {
            // Inner cyan dot
            pixel = blend(pixel, [56, 189, 248, 255], 1);
          }
        }

        // 6. Accent Sparkle / Studio Diamond in top-right
        const starX = 202 * scale, starY = 46 * scale;
        const dStarX = Math.abs(x - starX);
        const dStarY = Math.abs(y - starY);
        // Diamond star shape: |dx| + |dy| <= radius
        const starDist = (dStarX + dStarY) - 13 * scale;
        if (starDist < 1.0) {
          const a = starDist <= 0 ? 1 : (1 - starDist);
          // Amber/Gold glow (#fbbf24: 251, 191, 36)
          pixel = blend(pixel, [251, 191, 36, 255], a);
        }
      } else if (dBox < 1.5 * scale) {
        // Border antialiasing
        const borderAlpha = (1 - dBox / (1.5 * scale));
        pixel = blend(pixel, [99, 102, 241, 200], borderAlpha);
      }

      const idx = (y * S + x) * 4;
      rgba[idx] = pixel[0];
      rgba[idx + 1] = pixel[1];
      rgba[idx + 2] = pixel[2];
      rgba[idx + 3] = pixel[3];
    }
  }

  return rgba;
}

// Downsample from master RGBA (e.g. 512x512) to target size (width x height) using Area Averaging
function downsample(srcRGBA, srcSize, dstSize) {
  if (srcSize === dstSize) return srcRGBA;
  const dstRGBA = Buffer.alloc(dstSize * dstSize * 4);
  const ratio = srcSize / dstSize;

  for (let dy = 0; dy < dstSize; dy++) {
    for (let dx = 0; dx < dstSize; dx++) {
      let r = 0, g = 0, b = 0, a = 0;
      let count = 0;

      const sx0 = Math.floor(dx * ratio);
      const sx1 = Math.floor((dx + 1) * ratio);
      const sy0 = Math.floor(dy * ratio);
      const sy1 = Math.floor((dy + 1) * ratio);

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const sIdx = (sy * srcSize + sx) * 4;
          const srcA = srcRGBA[sIdx + 3] / 255;
          r += srcRGBA[sIdx] * srcA;
          g += srcRGBA[sIdx + 1] * srcA;
          b += srcRGBA[sIdx + 2] * srcA;
          a += srcRGBA[sIdx + 3];
          count++;
        }
      }

      const dIdx = (dy * dstSize + dx) * 4;
      if (a > 0 && count > 0) {
        const finalA = a / count;
        dstRGBA[dIdx] = Math.round(r / (a / 255));
        dstRGBA[dIdx + 1] = Math.round(g / (a / 255));
        dstRGBA[dIdx + 2] = Math.round(b / (a / 255));
        dstRGBA[dIdx + 3] = Math.round(finalA);
      } else {
        dstRGBA[dIdx] = 0;
        dstRGBA[dIdx + 1] = 0;
        dstRGBA[dIdx + 2] = 0;
        dstRGBA[dIdx + 3] = 0;
      }
    }
  }

  return dstRGBA;
}

// Pack array of PNG buffers into standard Windows ICO file
function packICO(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // count

  let offset = 6 + count * 16;
  const entries = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    const sz = img.size >= 256 ? 0 : img.size;
    entry.writeUInt8(sz, 0); // width (0 = 256)
    entry.writeUInt8(sz, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // palette colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((img) => img.buffer)]);
}

function main() {
  console.log('Generating Font Studio high-resolution icon set...');
  const masterSize = 512;
  const masterRGBA = renderMasterIcon(masterSize);

  // Targets to generate for ICO
  const icoSizes = [256, 128, 64, 48, 32, 24, 16];
  const pngEntries = [];

  for (const size of icoSizes) {
    const downsampledRGBA = downsample(masterRGBA, masterSize, size);
    const pngBuf = encodePNG(size, size, downsampledRGBA);
    pngEntries.push({ size, buffer: pngBuf });
    console.log(`Generated ${size}x${size} PNG (${pngBuf.length} bytes)`);
  }

  // Pack into ICO
  const icoBuf = packICO(pngEntries);
  console.log(`Packed multi-resolution ICO (${icoBuf.length} bytes, ${pngEntries.length} resolutions: ${icoSizes.join(', ')})`);

  // Master 512x512 PNG
  const masterPNGBuf = encodePNG(masterSize, masterSize, masterRGBA);

  // Output directories
  const targetDirs = ['build', 'resources', path.join('src', 'renderer', 'public')];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'icon.png'), masterPNGBuf);
    fs.writeFileSync(path.join(dir, 'icon.ico'), icoBuf);
    console.log(`Saved icon.ico and icon.png to ${dir}`);
  }

  console.log('Icon generation successfully completed!');
}

main();

