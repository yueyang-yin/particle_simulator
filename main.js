const intro = document.getElementById("intro");
const enableBtn = document.getElementById("enableCamera");
const canvas = document.getElementById("particleCanvas");
const ctx = canvas.getContext("2d");
const preview = document.getElementById("preview");
const video = document.getElementById("camera");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const runtimeUi = document.getElementById("runtimeUi");
const modeLine = document.getElementById("modeLine");
const shortcutLine = document.getElementById("shortcutLine");
const terminalEl = document.getElementById("terminal");
const gestureTerminal = document.getElementById("gestureTerminal");

// Golden ratio used to space particles and oscillations later in the loop.
const phi = (1 + Math.sqrt(5)) / 2;
const particles = [];
const maxParticles = 15000;
let mode = "attract";
let currentThemeIndex = 0;
let lastThemeSwitch = 0;
let canvasSize = { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 1 };
let lastFace = null;
let lastHands = null;
let faceReady = false;
let handsReady = false;
let statusOverride = "";
let frameLoopId = null;
let cameraActive = false;
let previewVisible = true;
let textTargets = [];
let textTargetsSorted = [];
let textBounds = { minX: 0, maxX: 0 };
let textStartTime = performance.now();
const textRevealDuration = 3.5;
const terminalLines = [
  "Particle Fluid Portrait",
  "Press Enter to start the camera and let thousands of particles trace your face and hands.",
];
let typingStarted = false;
let typingLine = 0;
let typingChar = 0;
let typingTimer = null;
let peaceCooldownUntil = 0;
let middleCooldownUntil = 0;
let middleActive = false;
let apologyTimer = null;
let apologyShown = false;
let gestureTyping = false;
let gestureTimer = null;

// Theme palettes that drive particle colors and trail blending.
const themes = [
  {
    name: "Rainbow",
    palette: ["#ff4d6d", "#ffd166", "#64dfdf", "#5f8cff", "#c77dff"],
    trail: "rgba(6, 7, 12, 0.18)",
  },
  {
    name: "Flame",
    palette: ["#ff9f1c", "#ff5714", "#ffd166", "#ff006e", "#ffa8c6"],
    trail: "rgba(8, 6, 4, 0.2)",
  },
  {
    name: "Ocean",
    palette: ["#1b998b", "#0ead69", "#0f4c5c", "#5bc0eb", "#c1fba4"],
    trail: "rgba(5, 10, 14, 0.18)",
  },
  {
    name: "Galaxy",
    palette: ["#f15bb5", "#9b5de5", "#00bbf9", "#00f5d4", "#fee440"],
    trail: "rgba(7, 6, 12, 0.2)",
  },
  {
    name: "Matrix",
    palette: ["#00f5d4", "#0aff99", "#37ff8b", "#7cff6b", "#c7ff9e"],
    trail: "rgba(3, 6, 4, 0.22)",
  },
];

function resizeCanvas() {
  // Keep the canvas crisp on high-DPI screens.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  updateCanvasTransform();
}

function updateCanvasTransform() {
  // Compute a scale/offset to letterbox the camera feed into the canvas.
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  const canvasAspect = cw / ch;
  const videoAspect = vw / vh;
  let scale;
  let offsetX = 0;
  let offsetY = 0;

  if (canvasAspect > videoAspect) {
    scale = cw / vw;
    offsetY = (ch - vh * scale) / 2;
  } else {
    scale = ch / vh;
    offsetX = (cw - vw * scale) / 2;
  }

  canvasSize = { width: cw, height: ch, offsetX, offsetY, scale };
}

function mapToCanvas(point) {
  // Convert normalized landmarks into mirrored canvas coordinates.
  const x = point.x * (video.videoWidth || 640) * canvasSize.scale + canvasSize.offsetX;
  const y = point.y * (video.videoHeight || 360) * canvasSize.scale + canvasSize.offsetY;
  return { x: canvasSize.width - x, y };
}

function createParticles() {
  // Seed particles near the center for the initial reveal.
  particles.length = 0;
  for (let i = 0; i < maxParticles; i += 1) {
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.5;
    particles.push({
      x: cx + (Math.random() - 0.5) * window.innerWidth * 0.2,
      y: cy + (Math.random() - 0.5) * window.innerHeight * 0.2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 1.2 + 0.6,
      color: pickThemeColor(),
      jitter: Math.random() * 0.5 + 0.2,
    });
  }
}

function buildTextTargets() {
  // Rasterize the intro text into point targets.
  const width = window.innerWidth;
  const height = window.innerHeight;
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");
  off.width = width;
  off.height = height;
  offCtx.clearRect(0, 0, width, height);
  const fontSize = Math.max(26, Math.min(64, Math.floor(width * 0.05)));
  offCtx.font = `600 ${fontSize}px "Space Grotesk", "IBM Plex Sans", sans-serif`;
  offCtx.textAlign = "center";
  offCtx.textBaseline = "middle";
  offCtx.fillStyle = "#ffffff";
  const text = "Welcome to Particle Fluid Portrait";
  offCtx.fillText(text, width * 0.5, height * 0.4);
  const image = offCtx.getImageData(0, 0, width, height);
  const data = image.data;
  const targets = [];
  const step = Math.max(2, Math.floor(fontSize / 10));
  let minX = width;
  let maxX = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4 + 3;
      if (data[idx] > 10) {
        targets.push({
          x,
          y,
          weight: 1.4,
          size: 1.6,
        });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  textTargets = targets;
  textTargetsSorted = [...targets].sort((a, b) => a.x - b.x);
  textBounds = { minX, maxX };
  textStartTime = performance.now();
}

function pickThemeColor() {
  // Sample a random color from the active theme palette.
  const palette = themes[currentThemeIndex].palette;
  return palette[Math.floor(Math.random() * palette.length)];
}

function rethemeParticles() {
  // Refresh particle colors after switching themes.
  particles.forEach((p) => {
    p.color = pickThemeColor();
  });
}

function toggleMode() {
  // Switch between attract and repel forces.
  mode = mode === "attract" ? "repel" : "attract";
  if (modeLine) {
    modeLine.textContent = `> Mode: ${mode === "attract" ? "Attract" : "Repel"}`;
  }
}

function togglePreview() {
  // Show or hide the camera preview element.
  if (!preview) return;
  previewVisible = !previewVisible;
  preview.classList.toggle("hidden", !previewVisible);
}

function isFist(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const wrist = landmarks[0];
  const fingerTips = [4, 8, 12, 16, 20];
  const fingerPips = [3, 6, 10, 14, 18];
  let curled = 0;
  fingerTips.forEach((tipIdx, i) => {
    const pipIdx = fingerPips[i];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    if (tipDist < pipDist * 1.05) curled += 1;
  });
  return curled >= 4;
}

function maybeSwitchTheme(handsLandmarks) {
  const now = performance.now();
  if (now - lastThemeSwitch < 1400) return;
  if (!handsLandmarks || handsLandmarks.length === 0) return;
  if (handsLandmarks.some(isFist)) {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    rethemeParticles();
    lastThemeSwitch = now;
  }
}

function addJitteredPoint(targets, point, radius, weight = 1, size = 1.2) {
  const jitter = radius * (Math.random() * 2 - 1);
  const angle = Math.random() * Math.PI * 2;
  targets.push({
    x: point.x + Math.cos(angle) * jitter,
    y: point.y + Math.sin(angle) * jitter,
    weight,
    size,
  });
}

function addBonePoints(targets, start, end, width, density, size = 1.2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const count = Math.max(4, Math.floor(length * density));
  const nx = -dy / (length || 1);
  const ny = dx / (length || 1);
  for (let i = 0; i < count; i += 1) {
    const t = (i * phi) % 1;
    const baseX = start.x + dx * t;
    const baseY = start.y + dy * t;
    const offset = (Math.random() * 2 - 1) * width;
    targets.push({
      x: baseX + nx * offset,
      y: baseY + ny * offset,
      weight: 1.2,
      size,
    });
  }
}

function buildTargets() {
  const faceTargets = [];
  const handTargets = [];
  const scale = Math.min(canvasSize.width, canvasSize.height) / 800;
  if (lastFace && lastFace.length) {
    const noseBoost = new Set([1, 2, 98, 327, 4, 5]);
    const cheekBoost = new Set([234, 454, 93, 323, 127, 356]);
    const eyeSocketBoost = new Set([33, 133, 362, 263, 159, 386]);
    lastFace.forEach((lm, idx) => {
      const pt = mapToCanvas(lm);
      addJitteredPoint(faceTargets, pt, 1.4, 1, 1.1);
      addJitteredPoint(faceTargets, pt, 1.4, 1, 1.1);
      if (noseBoost.has(idx) || cheekBoost.has(idx) || eyeSocketBoost.has(idx)) {
        addJitteredPoint(faceTargets, pt, 2.2, 2, 1.8);
        addJitteredPoint(faceTargets, pt, 2.2, 2, 1.8);
        addJitteredPoint(faceTargets, pt, 2.2, 2, 1.8);
      }
    });
  }

  if (lastHands && lastHands.length) {
    const fingerChains = [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [0, 9, 10, 11, 12],
      [0, 13, 14, 15, 16],
      [0, 17, 18, 19, 20],
    ];

    lastHands.forEach((hand) => {
      fingerChains.forEach((chain) => {
        for (let i = 0; i < chain.length - 1; i += 1) {
          const a = mapToCanvas(hand[chain[i]]);
          const b = mapToCanvas(hand[chain[i + 1]]);
          const isTip = chain[i + 1] === 4 || chain[i + 1] === 8 || chain[i + 1] === 12 || chain[i + 1] === 16 || chain[i + 1] === 20;
          const isPalm = chain[i] === 0 || chain[i] === 5 || chain[i] === 9 || chain[i] === 13 || chain[i] === 17;
          const width = (isPalm ? 10 : isTip ? 3 : 6) * scale;
          const size = isTip ? 1.9 : isPalm ? 1.5 : 1.3;
          addBonePoints(handTargets, a, b, width, 0.9, size);
        }
      });

      const palmConnections = [
        [0, 5],
        [5, 9],
        [9, 13],
        [13, 17],
        [17, 0],
      ];
      palmConnections.forEach(([i, j]) => {
        const a = mapToCanvas(hand[i]);
        const b = mapToCanvas(hand[j]);
        addBonePoints(handTargets, a, b, 12 * scale, 0.8, 1.5);
      });

      [4, 8, 12, 16, 20, 0].forEach((idx) => {
        const pt = mapToCanvas(hand[idx]);
        const size = idx === 0 ? 1.6 : 2.2;
        addJitteredPoint(handTargets, pt, 3.2 * scale, 1.6, size);
        addJitteredPoint(handTargets, pt, 2.2 * scale, 1.4, size);
      });
    });
  }

  return { faceTargets, handTargets };
}

function updateParticles(faceTargets, handTargets) {
  const { width, height } = canvasSize;
  const theme = themes[currentThemeIndex];
  ctx.fillStyle = theme.trail;
  ctx.fillRect(0, 0, width, height);

  let activeTargets = [];
  if (!cameraActive && textTargetsSorted.length) {
    const elapsed = (performance.now() - textStartTime) / 1000;
    const progress = Math.min(1, elapsed / textRevealDuration);
    const eased = 1 - Math.pow(1 - progress, 2);
    const revealX = textBounds.minX + (textBounds.maxX - textBounds.minX) * eased;
    const revealCount = textTargetsSorted.findIndex((t) => t.x > revealX);
    activeTargets =
      revealCount === -1 ? textTargetsSorted : textTargetsSorted.slice(0, Math.max(1, revealCount));
  }

  const hasFace = faceTargets.length > 0;
  const hasHands = handTargets.length > 0;
  const totalTargets = faceTargets.length + handTargets.length;
  if (!totalTargets && !activeTargets.length) {
    particles.forEach((p) => {
      p.vx += (Math.random() - 0.5) * 0.1;
      p.vy += (Math.random() - 0.5) * 0.1;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    return;
  }

  let faceCount = 0;
  if (activeTargets.length) {
    faceCount = 0;
  } else if (hasFace && hasHands) {
    const faceRatio = Math.min(0.6, Math.max(0.35, faceTargets.length / totalTargets));
    faceCount = Math.floor(particles.length * faceRatio);
  } else if (hasFace) {
    faceCount = particles.length;
  }

  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    let target;
    if (activeTargets.length) {
      target = activeTargets[i % activeTargets.length];
    } else if (i < faceCount && hasFace) {
      target = faceTargets[i % faceTargets.length];
    } else if (hasHands) {
      const index = i - faceCount;
      target = handTargets[index % handTargets.length];
    } else {
      target = faceTargets[i % faceTargets.length];
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy) + 0.01;
    const dir = mode === "attract" ? 1 : -1;
    const pull = Math.min(3.2, (1.6 + target.weight) / (dist * 0.12));
    p.vx += (dx / dist) * pull * dir;
    p.vy += (dy / dist) * pull * dir;
    p.vx += (Math.random() - 0.5) * p.jitter * 0.6;
    p.vy += (Math.random() - 0.5) * p.jitter * 0.6;
    p.vx *= 0.86;
    p.vy *= 0.86;
    p.x += p.vx;
    p.y += p.vy;

    if (dist > 240 && Math.random() < 0.01) {
      p.x = target.x + (Math.random() - 0.5) * 40;
      p.y = target.y + (Math.random() - 0.5) * 40;
      p.vx = 0;
      p.vy = 0;
    }

    const targetSize = target.size || 1.2;
    p.size += (targetSize - p.size) * 0.08;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  if (!cameraActive && !typingStarted && performance.now() - textStartTime >= textRevealDuration * 1000) {
    startTyping();
  }
}

function drawOverlay(resultsFace, resultsHands) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.save();
  overlayCtx.translate(overlay.width, 0);
  overlayCtx.scale(-1, 1);
  overlayCtx.lineCap = "round";

  if (resultsFace && resultsFace.multiFaceLandmarks && resultsFace.multiFaceLandmarks[0]) {
    const face = resultsFace.multiFaceLandmarks[0];
    drawConnectors(overlayCtx, face, FACEMESH_TESSELATION, {
      color: "rgba(120, 200, 255, 0.4)",
      lineWidth: 0.5,
    });
    drawConnectors(overlayCtx, face, FACEMESH_LEFT_EYE, { color: "#58f0ff", lineWidth: 1.2 });
    drawConnectors(overlayCtx, face, FACEMESH_RIGHT_EYE, { color: "#58f0ff", lineWidth: 1.2 });
    drawConnectors(overlayCtx, face, FACEMESH_LIPS, { color: "#ff6bd6", lineWidth: 1.4 });
    drawConnectors(overlayCtx, face, FACEMESH_FACE_OVAL, { color: "#58f0ff", lineWidth: 1.2 });
  }

  if (resultsHands && resultsHands.multiHandLandmarks) {
    resultsHands.multiHandLandmarks.forEach((handLandmarks) => {
      overlayCtx.save();
      overlayCtx.shadowBlur = 12;
      overlayCtx.shadowColor = "rgba(88, 240, 255, 0.8)";
      drawConnectors(overlayCtx, handLandmarks, HAND_CONNECTIONS, {
        color: "rgba(88, 240, 255, 0.9)",
        lineWidth: 2.4,
      });
      overlayCtx.shadowColor = "rgba(255, 107, 214, 0.7)";
      drawConnectors(overlayCtx, handLandmarks, HAND_CONNECTIONS, {
        color: "rgba(255, 107, 214, 0.7)",
        lineWidth: 1.2,
      });
      overlayCtx.shadowBlur = 0;
      const emphasis = new Set([0, 4, 8, 12, 16, 20]);
      handLandmarks.forEach((lm, idx) => {
        const radius = emphasis.has(idx) ? 4.2 : 2.4;
        overlayCtx.fillStyle = emphasis.has(idx) ? "#58f0ff" : "#ff6bd6";
        overlayCtx.beginPath();
        overlayCtx.arc(lm.x * overlay.width, lm.y * overlay.height, radius, 0, Math.PI * 2);
        overlayCtx.fill();
      });
      overlayCtx.restore();
    });
  }

  overlayCtx.restore();
}

function startTyping() {
  if (!terminalEl || typingStarted) return;
  typingStarted = true;
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  terminalEl.textContent = "";
  terminalEl.appendChild(cursor);
  const timestamp = () => {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    const ss = String(now.getUTCSeconds()).padStart(2, "0");
    return `[GMT ${hh}:${mm}:${ss}]`;
  };
  const linePrefix = () => `> ${timestamp()} `;
  const typeStep = () => {
    if (typingLine >= terminalLines.length) return;
    const line = `${typingLine === 0 ? linePrefix() : "  "}${terminalLines[typingLine]}`;
    if (typingChar < line.length) {
      cursor.before(line[typingChar]);
      typingChar += 1;
      const delay = 18 + Math.random() * 45;
      typingTimer = setTimeout(typeStep, delay);
      return;
    }
    cursor.before("\n");
    typingLine += 1;
    typingChar = 0;
    typingTimer = setTimeout(typeStep, 260 + Math.random() * 120);
  };
  typeStep();
}

function showGestureTerminal() {
  if (!gestureTerminal) return;
  gestureTerminal.classList.remove("hidden");
}

function clearGestureTerminal() {
  if (!gestureTerminal) return;
  gestureTerminal.textContent = "";
  gestureTerminal.classList.add("hidden");
  gestureTyping = false;
}

function typeGestureLines(lines, options = {}) {
  if (!gestureTerminal || gestureTyping) return;
  gestureTyping = true;
  showGestureTerminal();
  if (gestureTimer) clearTimeout(gestureTimer);
  gestureTerminal.textContent = "";
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  gestureTerminal.appendChild(cursor);
  let lineIndex = 0;
  let charIndex = 0;
  const typeStep = () => {
    if (lineIndex >= lines.length) {
      gestureTyping = false;
      if (options.onDone) options.onDone();
      return;
    }
    const line = lines[lineIndex];
    if (charIndex < line.length) {
      cursor.before(line[charIndex]);
      charIndex += 1;
      const delay = 16 + Math.random() * 55;
      gestureTimer = setTimeout(typeStep, delay);
      return;
    }
    cursor.before("\n");
    lineIndex += 1;
    charIndex = 0;
    const pause = options.lineDelayMs ? options.lineDelayMs(lineIndex) : 240;
    gestureTimer = setTimeout(typeStep, pause);
  };
  typeStep();
}

function setShortcutLine(showSpace) {
  if (!shortcutLine) return;
  shortcutLine.textContent = showSpace
    ? "> Shortcuts: Space Toggle Mode · V Toggle Preview"
    : "> Shortcuts: V Toggle Preview";
}

function triggerPeaceGesture() {
  const now = performance.now();
  peaceCooldownUntil = now + 6000;
  if (gestureTimer) clearTimeout(gestureTimer);
  typeGestureLines(["> How's your day?"], {
    onDone: () => {
      gestureTimer = setTimeout(() => {
        typeGestureLines(
          [
            "I know you're gonna to say i'm good, but i think you're not. Because you're so bored that you're browsing this website.",
          ],
          {
            onDone: () => {
              gestureTimer = setTimeout(() => {
                clearGestureTerminal();
              }, 900);
            },
          }
        );
      }, 2000);
    },
  });
}

function triggerMiddleGesture() {
  if (middleActive) return;
  const now = performance.now();
  middleCooldownUntil = now + 9000;
  middleActive = true;
  apologyShown = false;
  mode = "repel";
  if (modeLine) modeLine.textContent = "> Mode: Repel";
  setShortcutLine(false);
  clearGestureTerminal();
  if (apologyTimer) clearTimeout(apologyTimer);
  apologyTimer = setTimeout(() => {
    apologyShown = true;
    typeGestureLines(
      ["You should be more polite, you boring person. Press the spacebar to apologize to me."],
      {}
    );
  }, 7000);
}

function endMiddlePunishment() {
  if (!middleActive) return;
  middleActive = false;
  apologyShown = false;
  mode = "attract";
  if (modeLine) modeLine.textContent = "> Mode: Attract";
  setShortcutLine(true);
  if (apologyTimer) clearTimeout(apologyTimer);
  clearGestureTerminal();
}

function fingerExtended(hand, tipIdx, pipIdx, wristIdx = 0) {
  const tip = hand[tipIdx];
  const pip = hand[pipIdx];
  const wrist = hand[wristIdx];
  const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
  return tipDist > pipDist * 1.18;
}

function fingerCurled(hand, tipIdx, pipIdx, wristIdx = 0) {
  const tip = hand[tipIdx];
  const pip = hand[pipIdx];
  const wrist = hand[wristIdx];
  const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
  return tipDist < pipDist * 1.05;
}

function isPeaceGesture(hand) {
  const indexExt = fingerExtended(hand, 8, 6);
  const middleExt = fingerExtended(hand, 12, 10);
  const ringCurled = fingerCurled(hand, 16, 14);
  const pinkyCurled = fingerCurled(hand, 20, 18);
  return indexExt && middleExt && ringCurled && pinkyCurled;
}

function isMiddleFingerGesture(hand) {
  const middleExt = fingerExtended(hand, 12, 10);
  const indexCurled = fingerCurled(hand, 8, 6);
  const ringCurled = fingerCurled(hand, 16, 14);
  const pinkyCurled = fingerCurled(hand, 20, 18);
  return middleExt && indexCurled && ringCurled && pinkyCurled;
}

function handleGestures(hands) {
  if (!hands || hands.length === 0) return;
  const now = performance.now();
  const hasMiddle = hands.some(isMiddleFingerGesture);
  if (hasMiddle && now > middleCooldownUntil) {
    triggerMiddleGesture();
    return;
  }
  if (middleActive) return;
  const hasPeace = hands.some(isPeaceGesture);
  if (hasPeace && now > peaceCooldownUntil) {
    triggerPeaceGesture();
  }
}

function updateStatus() {}

function stopFrameLoop() {
  if (frameLoopId) {
    cancelAnimationFrame(frameLoopId);
    frameLoopId = null;
  }
}

function startManualFrameLoop(faceMesh, hands) {
  const step = async () => {
    try {
      if (video.readyState >= 2) {
        await faceMesh.send({ image: video });
        await hands.send({ image: video });
      }
    } catch (err) {
      statusOverride = "Model processing failed";
    }
    frameLoopId = requestAnimationFrame(step);
  };
  stopFrameLoop();
  step();
}

async function initMediaPipe() {
  statusOverride = "Loading models...";
  updateStatus();
  try {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    faceMesh.onResults((results) => {
      faceReady = true;
      if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
        lastFace = results.multiFaceLandmarks[0];
      } else {
        lastFace = null;
      }
      drawOverlay(results, lastHands ? { multiHandLandmarks: lastHands } : null);
    });

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  hands.onResults((results) => {
    handsReady = true;
    lastHands = results.multiHandLandmarks || null;
    maybeSwitchTheme(lastHands || []);
    handleGestures(lastHands || []);
    drawOverlay(lastFace ? { multiFaceLandmarks: [lastFace] } : null, results);
  });

    statusOverride = "Requesting camera access...";
    updateStatus();

    if (typeof Camera !== "undefined") {
      const camera = new Camera(video, {
        onFrame: async () => {
          await faceMesh.send({ image: video });
          await hands.send({ image: video });
        },
        width: 640,
        height: 360,
      });
      await camera.start();
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      startManualFrameLoop(faceMesh, hands);
    }
    cameraActive = true;
    if (preview) preview.classList.remove("hidden");
    if (runtimeUi) runtimeUi.classList.remove("hidden");
    if (modeLine) modeLine.textContent = `> Mode: ${mode === "attract" ? "Attract" : "Repel"}`;
    if (shortcutLine) shortcutLine.textContent = "> Shortcuts: Space Toggle Mode · V Toggle Preview";

    video.addEventListener(
      "loadedmetadata",
      () => {
        updateCanvasTransform();
      },
      { once: true }
    );

    statusOverride = "";
    updateStatus();
  } catch (err) {
    statusOverride = "Camera or model failed to load";
    console.error(err);
    updateStatus();
  }
}

function animate() {
  const { faceTargets, handTargets } = buildTargets();
  updateParticles(faceTargets, handTargets);
  updateStatus();
  requestAnimationFrame(animate);
}

function setup() {
  resizeCanvas();
  createParticles();
  buildTextTargets();
  overlay.width = 256;
  overlay.height = 144;
  video.width = 256;
  video.height = 144;
  updateCanvasTransform();
  animate();
}

enableBtn.addEventListener("click", async () => {
  intro.classList.add("hidden");
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusOverride = "Camera access requires HTTPS or localhost";
    updateStatus();
    alert("Please use http://localhost:8000 or an https page to access the camera.");
    return;
  }
  await initMediaPipe();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !intro.classList.contains("hidden")) {
    event.preventDefault();
    enableBtn.click();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (middleActive) {
      endMiddlePunishment();
    } else {
      toggleMode();
    }
  }
  if (event.key.toLowerCase() === "v") {
    togglePreview();
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  createParticles();
  buildTextTargets();
});

setup();
