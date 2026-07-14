// assets/js/app.js
(() => {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const countdownEl = document.getElementById("countdown");
  const frameListEl = document.getElementById("frameList");

  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const btnCapture = document.getElementById("btnCapture");
  const btnReset = document.getElementById("btnReset");

  const btnDownloadPng = document.getElementById("btnDownloadPng");
  const btnDownloadJpg = document.getElementById("btnDownloadJpg");
  const btnFullscreen = document.getElementById("btnFullscreen");

  const btnSwitchCamera = document.getElementById("btnSwitchCamera");
  const btnShare = document.getElementById("btnShare");

  const modeEl = document.getElementById("mode");
  const outSizeEl = document.getElementById("outSize");
  const cdSecEl = document.getElementById("cdSec");
  const mirrorEl = document.getElementById("mirror");
  const filterEl = document.getElementById("filter");
  const strengthEl = document.getElementById("strength");
  const scaleEl = document.getElementById("scale");

  let currentCamera = "user";
  let stream = null;

  let activeFrame = null;
  let activeFrameImg = new Image();
  activeFrameImg.crossOrigin = "anonymous";

  let shots = [];

  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = "high";

  function isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  function wait(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function showCountdown(n) {
    countdownEl?.classList.remove("hidden");
    if (countdownEl) countdownEl.textContent = String(n);
  }

  function hideCountdown() {
    countdownEl?.classList.add("hidden");
  }

  async function runCountdown() {
    const sec = Number(cdSecEl?.value || 3);
    if (sec <= 0) return;

    for (let i = sec; i >= 1; i--) {
      showCountdown(i);
      await wait(1000);
    }
    hideCountdown();
  }

  function setOutputSizeFromUI() {
    const size = outSizeEl?.value || "1080x1080";
    let w, h;

    if (size === "none") {
      w = 1080;
      h = 1080;
    } else {
      [w, h] = size.split("x").map(Number);
    }

    canvas.width = w;
    canvas.height = h;
    tempCanvas.width = w;
    tempCanvas.height = h;

    redrawPreview();
  }

  function syncMirrorByCamera() {
    if (!mirrorEl) return;
    mirrorEl.checked = currentCamera === "user";
  }

  function renderFramesUI() {
    if (!frameListEl) return;
    frameListEl.innerHTML = "";

    const frames = window.FRAMES || [];
    frames.forEach((f, idx) => {
      const item = document.createElement("div");
      item.className = "frameItem" + (idx === 0 ? " active" : "");
      item.dataset.id = f.id;

      const img = document.createElement("img");
      img.alt = f.name;
      img.src = f.src;

      item.appendChild(img);
      frameListEl.appendChild(item);

      item.addEventListener("click", () => {
        document.querySelectorAll(".frameItem").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        selectFrame(f);
      });

      if (idx === 0) selectFrame(f);
    });
  }

  function selectFrame(frame) {
    activeFrame = frame;
    activeFrameImg = new Image();
    activeFrameImg.crossOrigin = "anonymous";
    activeFrameImg.onload = () => redrawPreview();
    activeFrameImg.src = frame.src;
  }

  async function startCamera() {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const portrait = isPortrait();

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: currentCamera },
          width: portrait ? { ideal: 1080 } : { ideal: 1350 },
          height: portrait ? { ideal: 1350 } : { ideal: 1080 }
        },
        audio: false
      });

      video.srcObject = stream;
      await video.play();
      redrawPreview();
    } catch (err) {
      alert(
        "មិនអាចបើកកាមេរ៉ា។ សូមពិនិត្យ Permission ឬរត់ដោយ http:// (Live Server)។\n\n" +
          err
      );
    }
  }

  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    redrawPreview();
  }

  function getFrameFitRect(canvasW, canvasH, frameW, frameH) {
    const scale = Math.min(canvasW / frameW, canvasH / frameH);
    const drawW = frameW * scale;
    const drawH = frameH * scale;
    const ox = (canvasW - drawW) / 2;
    const oy = (canvasH - drawH) / 2;
    return { scale, drawW, drawH, ox, oy };
  }

  function drawVideoCoverTo(ctx2, w, h) {
    if (!video.videoWidth || !video.videoHeight) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetRatio = w / h;
    const videoRatio = vw / vh;

    let sx, sy, sw, sh;

    if (videoRatio > targetRatio) {
      sh = vh;
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / targetRatio;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    ctx2.save();
    if (mirrorEl?.checked) {
      ctx2.translate(w, 0);
      ctx2.scale(-1, 1);
      ctx2.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      ctx2.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    }
    ctx2.restore();
  }

  function drawImageCoverIntoRect(ctx2, img, dx, dy, dw, dh, mirror = false, zoom = 1) {
    const iw = img.videoWidth || img.naturalWidth || img.width;
    const ih = img.videoHeight || img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const targetRatio = dw / dh;
    const srcRatio = iw / ih;

    let sx, sy, sw, sh;

    if (srcRatio > targetRatio) {
      sh = ih;
      sw = ih * targetRatio;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      sw = iw;
      sh = iw / targetRatio;
      sx = 0;
      sy = (ih - sh) / 2;
    }

    if (zoom && zoom !== 1) {
      const zsw = sw / zoom;
      const zsh = sh / zoom;
      sx += (sw - zsw) / 2;
      sy += (sh - zsh) / 2;
      sw = zsw;
      sh = zsh;
    }

    ctx2.save();
    if (mirror) {
      ctx2.translate(dx + dw, dy);
      ctx2.scale(-1, 1);
      ctx2.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    } else {
      ctx2.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx2.restore();
  }

  function captureShot() {
    const w = canvas.width;
    const h = canvas.height;

    tempCtx.clearRect(0, 0, w, h);
    drawVideoCoverTo(tempCtx, w, h);

    const dataUrl = tempCanvas.toDataURL("image/png");
    const img = new Image();
    img.src = dataUrl;
    return img;
  }

  function clamp(v) {
    return Math.max(0, Math.min(255, v));
  }

  function rand01(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function applyBilateralBlur(imgData, w, h, strength01) {
    const d = imgData.data;
    const output = new Uint8ClampedArray(d.length);
    const radius = Math.ceil(3 * strength01) || 2;
    const colorSigma = 50 * strength01;
    const spatialSigma = radius * 0.5;

    for (let p = 0; p < d.length; p += 4) {
      const idx = p / 4;
      const x = idx % w;
      const y = (idx / w) | 0;

      const centerR = d[p];
      const centerG = d[p + 1];
      const centerB = d[p + 2];

      let weightSum = 0;
      let rSum = 0,
        gSum = 0,
        bSum = 0;

      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const nx = x + ox;
          const ny = y + oy;

          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

          const nidx = (ny * w + nx) * 4;
          const nr = d[nidx];
          const ng = d[nidx + 1];
          const nb = d[nidx + 2];

          const colorDiff =
            Math.sqrt((centerR - nr) ** 2 + (centerG - ng) ** 2 + (centerB - nb) ** 2) /
            Math.sqrt(3);
          const spatialDist = Math.sqrt(ox * ox + oy * oy);

          const colorWeight = Math.exp(-(colorDiff * colorDiff) / (2 * colorSigma * colorSigma));
          const spatialWeight = Math.exp(
            -(spatialDist * spatialDist) / (2 * spatialSigma * spatialSigma)
          );
          const weight = colorWeight * spatialWeight;

          weightSum += weight;
          rSum += nr * weight;
          gSum += ng * weight;
          bSum += nb * weight;
        }
      }

      output[p] = rSum / weightSum;
      output[p + 1] = gSum / weightSum;
      output[p + 2] = bSum / weightSum;
      output[p + 3] = d[p + 3];
    }

    for (let i = 0; i < d.length; i++) {
      d[i] = output[i];
    }
  }

  function applyHalftoneEffect(theme, strength01 = 1) {
    const w = canvas.width;
    const h = canvas.height;

    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);

    const s = src.data;
    const d = out.data;

    const themes = {
      green: {
        paper: { r: 238, g: 242, b: 170 },
        ink: { r: 36, g: 72, b: 32 },
        cross: "rgba(20,40,20,0.55)"
      },
      pink: {
        paper: { r: 255, g: 220, b: 235 },
        ink: { r: 120, g: 35, b: 75 },
        cross: "rgba(110,30,70,0.50)"
      },
      blue: {
        paper: { r: 220, g: 235, b: 255 },
        ink: { r: 25, g: 55, b: 120 },
        cross: "rgba(20,45,110,0.50)"
      }
    };

    const current = themes[theme] || themes.green;
    const paper = current.paper;
    const ink = current.ink;

    const cell = Math.max(4, Math.round(6 + strength01 * 8));

    for (let i = 0; i < d.length; i += 4) {
      d[i] = paper.r;
      d[i + 1] = paper.g;
      d[i + 2] = paper.b;
      d[i + 3] = 255;
    }

    for (let by = 0; by < h; by += cell) {
      for (let bx = 0; bx < w; bx += cell) {
        let sum = 0;
        let count = 0;

        for (let y = by; y < Math.min(by + cell, h); y++) {
          for (let x = bx; x < Math.min(bx + cell, w); x++) {
            const i = (y * w + x) * 4;
            const gray = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
            sum += gray;
            count++;
          }
        }

        const avg = count ? sum / count : 255;
        const darkness = 1 - avg / 255;
        const radius = darkness * (cell * 0.48);

        const cx = bx + cell / 2;
        const cy = by + cell / 2;

        for (let y = by; y < Math.min(by + cell, h); y++) {
          for (let x = bx; x < Math.min(bx + cell, w); x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
              const i = (y * w + x) * 4;
              d[i] = ink.r;
              d[i + 1] = ink.g;
              d[i + 2] = ink.b;
              d[i + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(out, 0, 0);
    applyCrossTexture(current.cross, strength01);
  }

  function applyCrossTexture(strokeColor, strength01 = 1) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.globalAlpha = 0.08 + strength01 * 0.10;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;

    const gap = Math.max(6, Math.round(10 - strength01 * 3));

    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x - 2, y - 2);
        ctx.lineTo(x + 2, y + 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 2, y - 2);
        ctx.lineTo(x - 2, y + 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function applyFilterToImageData(imgData, w, h, filterName, strength01) {
    const d = imgData.data;
    const cx = w / 2;
    const cy = h / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let p = 0; p < d.length; p += 4) {
      const idx = p / 4;
      const x = idx % w;
      const y = (idx / w) | 0;

      let r = d[p];
      let g = d[p + 1];
      let b = d[p + 2];

      if (filterName === "none") {
      } else if (filterName === "bw") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r + (gray - r) * strength01;
        g = g + (gray - g) * strength01;
        b = b + (gray - b) * strength01;
      } else if (filterName === "sepia") {
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = r + (sr - r) * strength01;
        g = g + (sg - g) * strength01;
        b = b + (sb - b) * strength01;
      } else if (filterName === "warm") {
        r = r + 35 * strength01;
        g = g + 10 * strength01;
        b = b - 15 * strength01;
      } else if (filterName === "cool") {
        r = r - 10 * strength01;
        g = g + 5 * strength01;
        b = b + 35 * strength01;
      } else if (filterName === "contrast") {
        const c = 1 + 1.2 * strength01;
        r = (r - 128) * c + 128;
        g = (g - 128) * c + 128;
        b = (b - 128) * c + 128;
      } else if (filterName === "fade") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r + (gray - r) * (0.25 * strength01);
        g = g + (gray - g) * (0.25 * strength01);
        b = b + (gray - b) * (0.25 * strength01);

        r = r + 18 * strength01;
        g = g + 18 * strength01;
        b = b + 18 * strength01;

        const c = 1 - 0.25 * strength01;
        r = (r - 128) * c + 128;
        g = (g - 128) * c + 128;
        b = (b - 128) * c + 128;
      } else if (filterName === "kodak") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const t = gray / 255;

        r = r + (gray - r) * (0.18 * strength01) + 10 * strength01;
        g = g + (gray - g) * (0.12 * strength01) + 10 * strength01;
        b = b + (gray - b) * (0.08 * strength01) + 10 * strength01;

        r += (-6 * (1 - t) + 18 * t) * strength01;
        g += (2 * (1 - t) + 8 * t) * strength01;
        b += (8 * (1 - t) - 8 * t) * strength01;

        const c = 1 + 0.35 * strength01;
        r = (r - 128) * c + 128;
        g = (g - 128) * c + 128;
        b = (b - 128) * c + 128;

        const grainAmt = 22 * strength01;
        const n = (rand01(idx * 0.17 + gray) - 0.5) * 2;
        r += n * grainAmt;
        g += n * grainAmt;
        b += n * grainAmt;

        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
        const vig = 1 - 0.55 * strength01 * (dist * dist);
        r *= vig;
        g *= vig;
        b *= vig;
      } else if (filterName === "vintage") {
        r += 15 * strength01;
        g += 5 * strength01;
        b -= 10 * strength01;

        const gray = 0.3 * r + 0.59 * g + 0.11 * b;
        r = r * 0.8 + gray * 0.2;
        g = g * 0.8 + gray * 0.2;
        b = b * 0.8 + gray * 0.2;
      } else if (filterName === "film") {
        r *= 1 + 0.1 * strength01;
        g *= 1 + 0.05 * strength01;
        b *= 1 - 0.1 * strength01;
      } else if (filterName === "instagram") {
        r += 25 * strength01;
        g += 10 * strength01;
        b -= 10 * strength01;
      } else if (filterName === "bright") {
        r += 40 * strength01;
        g += 40 * strength01;
        b += 40 * strength01;
      } else if (filterName === "dark") {
        r -= 40 * strength01;
        g -= 40 * strength01;
        b -= 40 * strength01;
      } else if (filterName === "dream") {
        r += 20 * strength01;
        g += 10 * strength01;
        b += 30 * strength01;
      } else if (filterName === "sunset") {
        r += 40 * strength01;
        g += 15 * strength01;
        b -= 25 * strength01;
      } else if (filterName === "smoothface") {
        r += 12 * strength01;
        g += 6 * strength01;
        b -= 2 * strength01;

        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r + (gray - r) * (0.15 * strength01);
        g = g + (gray - g) * (0.15 * strength01);
        b = b + (gray - b) * (0.15 * strength01);

        r += 8 * strength01;
        g += 8 * strength01;
        b += 8 * strength01;

        const c = 1 - 0.08 * strength01;
        r = (r - 128) * c + 128;
        g = (g - 128) * c + 128;
        b = (b - 128) * c + 128;
      }

      d[p] = clamp(r);
      d[p + 1] = clamp(g);
      d[p + 2] = clamp(b);
    }

    if (filterName === "smoothface" && strength01 > 0) {
      applyBilateralBlur(imgData, w, h, strength01);
    }

    return imgData;
  }

  function applyCurrentFilterOnCanvas() {
    const filterName = filterEl?.value || "none";
    const strength01 = Number(strengthEl?.value || 0) / 100;
    if (filterName === "none" || strength01 <= 0) return;

    if (filterName === "halftoneGreen") {
      applyHalftoneEffect("green", strength01);
      return;
    }

    if (filterName === "halftonePink") {
      applyHalftoneEffect("pink", strength01);
      return;
    }

    if (filterName === "halftoneBlue") {
      applyHalftoneEffect("blue", strength01);
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    applyFilterToImageData(imgData, w, h, filterName, strength01);
    ctx.putImageData(imgData, 0, 0);
  }

  function roundRectPath(ctx2, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + rr, y);
    ctx2.arcTo(x + w, y, x + w, y + h, rr);
    ctx2.arcTo(x + w, y + h, x, y + h, rr);
    ctx2.arcTo(x, y + h, x, y, rr);
    ctx2.arcTo(x, y, x + w, y, rr);
    ctx2.closePath();
  }

  function composeSingle(shotImg) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const hole = activeFrame?.hole;

    if (hole && activeFrameImg && activeFrameImg.complete && activeFrameImg.naturalWidth) {
      const fw = activeFrameImg.naturalWidth;
      const fh = activeFrameImg.naturalHeight;
      const fit = getFrameFitRect(w, h, fw, fh);

      const dx = fit.ox + hole.x * fit.scale;
      const dy = fit.oy + hole.y * fit.scale;
      const dw = hole.w * fit.scale;
      const dh = hole.h * fit.scale;
      const zoom = hole.zoom || 1;

      drawImageCoverIntoRect(ctx, shotImg, dx, dy, dw, dh, mirrorEl?.checked, zoom);
      applyCurrentFilterOnCanvas();
      ctx.drawImage(activeFrameImg, fit.ox, fit.oy, fit.drawW, fit.drawH);
      return;
    }

    ctx.drawImage(shotImg, 0, 0, w, h);
    applyCurrentFilterOnCanvas();

    if (activeFrameImg && activeFrameImg.complete) {
      ctx.drawImage(activeFrameImg, 0, 0, w, h);
    }
  }

  function composeStrip(shotImgs) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const holes = activeFrame?.holes;

    if (
      holes &&
      Array.isArray(holes) &&
      holes.length > 0 &&
      activeFrameImg &&
      activeFrameImg.complete &&
      activeFrameImg.naturalWidth
    ) {
      const fw = activeFrameImg.naturalWidth;
      const fh = activeFrameImg.naturalHeight;
      const fit = getFrameFitRect(w, h, fw, fh);

      holes.forEach((hole, i) => {
        const img = shotImgs[i];
        if (!img) return;

        const dx = fit.ox + hole.x * fit.scale;
        const dy = fit.oy + hole.y * fit.scale;
        const dw = hole.w * fit.scale;
        const dh = hole.h * fit.scale;
        const zoom = hole.zoom || 1;

        drawImageCoverIntoRect(ctx, img, dx, dy, dw, dh, mirrorEl?.checked, zoom);
      });

      applyCurrentFilterOnCanvas();
      ctx.drawImage(activeFrameImg, fit.ox, fit.oy, fit.drawW, fit.drawH);
      return;
    }

    const pad = Math.round(w * 0.05);
    const gap = Math.round(w * 0.03);
    const innerW = w - pad * 2;
    const numCells = shotImgs.length;
    const cellH = Math.floor((h - pad * 2 - gap * (numCells - 1)) / numCells);

    for (let i = 0; i < numCells; i++) {
      const x = pad;
      const y = pad + i * (cellH + gap);

      if (shotImgs[i]) {
        const img = shotImgs[i];
        const iw = img.width || innerW;
        const ih = img.height || cellH;

        const cellRatio = innerW / cellH;
        const imgRatio = iw / ih;

        let sx, sy, sw, sh;

        if (imgRatio > cellRatio) {
          sh = ih;
          sw = ih * cellRatio;
          sx = (iw - sw) / 2;
          sy = 0;
        } else {
          sw = iw;
          sh = iw / cellRatio;
          sx = 0;
          sy = (ih - sh) / 2;
        }

        const scale = Number(scaleEl?.value || 1);

        if (scale !== 1) {
          const zsw = sw / scale;
          const zsh = sh / scale;
          sx += (sw - zsw) / 2;
          sy += (sh - zsh) / 2;
          sw = zsw;
          sh = zsh;
        }

        ctx.save();
        roundRectPath(ctx, x, y, innerW, cellH, 18);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, x, y, innerW, cellH);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        roundRectPath(ctx, x, y, innerW, cellH, 18);
        ctx.fill();
      }
    }

    applyCurrentFilterOnCanvas();

    if (activeFrameImg && activeFrameImg.complete) {
      ctx.drawImage(activeFrameImg, 0, 0, w, h);
    }
  }

  function redrawPreview() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (modeEl?.value === "single") {
      if (shots[0]) {
        composeSingle(shots[0]);
      } else {
        if (stream) {
          const hole = activeFrame?.hole;

          if (
            hole &&
            activeFrameImg &&
            activeFrameImg.complete &&
            activeFrameImg.naturalWidth
          ) {
            const fw = activeFrameImg.naturalWidth;
            const fh = activeFrameImg.naturalHeight;
            const fit = getFrameFitRect(w, h, fw, fh);

            const dx = fit.ox + hole.x * fit.scale;
            const dy = fit.oy + hole.y * fit.scale;
            const dw = hole.w * fit.scale;
            const dh = hole.h * fit.scale;
            const zoom = hole.zoom || 1;

            drawImageCoverIntoRect(ctx, video, dx, dy, dw, dh, mirrorEl?.checked, zoom);
            ctx.drawImage(activeFrameImg, fit.ox, fit.oy, fit.drawW, fit.drawH);
          } else {
            tempCtx.clearRect(0, 0, w, h);
            drawVideoCoverTo(tempCtx, w, h);
            ctx.drawImage(tempCanvas, 0, 0, w, h);

            if (activeFrameImg && activeFrameImg.complete) {
              ctx.drawImage(activeFrameImg, 0, 0, w, h);
            }
          }
        } else {
          if (activeFrameImg && activeFrameImg.complete) {
            ctx.drawImage(activeFrameImg, 0, 0, w, h);
          }
        }
      }
    } else {
      if (shots.length > 0) {
        composeStrip(shots);
      } else {
        const holes = activeFrame?.holes;

        if (
          holes &&
          activeFrameImg &&
          activeFrameImg.complete &&
          activeFrameImg.naturalWidth
        ) {
          const fw = activeFrameImg.naturalWidth;
          const fh = activeFrameImg.naturalHeight;
          const fit = getFrameFitRect(w, h, fw, fh);

          holes.forEach((hole) => {
            const dx = fit.ox + hole.x * fit.scale;
            const dy = fit.oy + hole.y * fit.scale;
            const dw = hole.w * fit.scale;
            const dh = hole.h * fit.scale;
            const radius = hole.r ?? 0;

            ctx.save();
            if (radius > 0) {
              roundRectPath(ctx, dx, dy, dw, dh, radius * fit.scale);
              ctx.clip();
            }
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(dx, dy, dw, dh);
            ctx.restore();

            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 1;
            ctx.strokeRect(dx, dy, dw, dh);
          });

          ctx.drawImage(activeFrameImg, fit.ox, fit.oy, fit.drawW, fit.drawH);
        } else {
          if (activeFrameImg && activeFrameImg.complete) {
            ctx.drawImage(activeFrameImg, 0, 0, w, h);
          }
        }
      }
    }
  }

  async function handleCapture() {
    if (!stream) {
      alert("សូមចុច Start Camera មុន!");
      return;
    }

    const mode = modeEl?.value || "single";

    if (mode === "single") {
      await runCountdown();
      const img = captureShot();
      await img.decode().catch(() => {});
      shots = [img];
      redrawPreview();
      return;
    }

    shots = [];
    redrawPreview();

    let numShots = 3;
    if (mode === "strip2") {
      numShots = 2;
    } else if (mode === "strip3") {
      numShots = 3;
    }

    for (let i = 0; i < numShots; i++) {
      await runCountdown();
      const img = captureShot();
      await img.decode().catch(() => {});
      shots.push(img);
      redrawPreview();
      await wait(350);
    }
  }

  function download(type) {
    redrawPreview();

    const mime = type === "jpg" ? "image/jpeg" : "image/png";
    const quality = type === "jpg" ? 0.95 : undefined;
    const dataUrl = canvas.toDataURL(mime, quality);

    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `photobooth-${modeEl?.value || "single"}-${outSizeEl?.value || "1080x1080"}-${stamp}.${type}`;
    a.href = dataUrl;
    a.click();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  async function shareImage() {
    redrawPreview();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return;

    const file = new File([blob], "photobooth.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: "Photobooth", files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "photobooth.png";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  btnStart?.addEventListener("click", startCamera);
  btnStop?.addEventListener("click", stopCamera);
  btnCapture?.addEventListener("click", handleCapture);
  btnReset?.addEventListener("click", () => {
    shots = [];
    redrawPreview();
  });

  btnDownloadPng?.addEventListener("click", () => download("png"));
  btnDownloadJpg?.addEventListener("click", () => download("jpg"));
  btnFullscreen?.addEventListener("click", toggleFullscreen);

  btnSwitchCamera?.addEventListener("click", async () => {
    currentCamera = currentCamera === "user" ? "environment" : "user";
    syncMirrorByCamera();
    await startCamera();
  });

  btnShare?.addEventListener("click", shareImage);

  outSizeEl?.addEventListener("change", setOutputSizeFromUI);
  modeEl?.addEventListener("change", () => {
    shots = [];
    redrawPreview();
  });
  mirrorEl?.addEventListener("change", redrawPreview);
  filterEl?.addEventListener("change", redrawPreview);
  strengthEl?.addEventListener("input", redrawPreview);
  scaleEl?.addEventListener("input", redrawPreview);

  window.addEventListener("resize", async () => {
    if (!stream) return;
    await startCamera();
  });

  renderFramesUI();
  syncMirrorByCamera();
  setOutputSizeFromUI();

  setInterval(() => {
    if (!shots.length) redrawPreview();
  }, 140);
})();