const TILE_SIZE_CM = 30;
const MIN_COMPETITION_TILES = 8;
const MAX_ADDITIONAL_TILES = 2;
const MIN_GAP_CM = 12;
const MAX_GAP_CM = 18;

const canvas = document.getElementById("courseCanvas");
const ctx = canvas.getContext("2d");
const summaryList = document.getElementById("summaryList");
const tileList = document.getElementById("tileList");
const generateBtn = document.getElementById("generateBtn");

const HAZARD_STYLES = {
  line: { color: "#ffffff", label: "Normale Linie" },
  gap: { color: "#ffe3e3", label: "Gap (≤20 cm)" },
  speed_bump: { color: "#fff7cc", label: "Speed Bump" },
  intersection: { color: "#e6f7ff", label: "Intersection" },
  obstacle: { color: "#ffe9d6", label: "Obstacle" },
  seesaw: { color: "#f0e8ff", label: "Seesaw" },
  ramp_up: { color: "#e6ffef", label: "Ramp Up" },
  ramp_down: { color: "#e6ffef", label: "Ramp Down" },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFreeIndex(candidates, blocked) {
  const valid = candidates.filter((i) => !blocked.has(i));
  if (!valid.length) return null;
  return sample(valid);
}

function generateCourse() {
  const mainTileCount = randomInt(MIN_COMPETITION_TILES, MIN_COMPETITION_TILES + MAX_ADDITIONAL_TILES);
  const tiles = Array.from({ length: mainTileCount }, (_, i) => ({
    idx: i + 1,
    type: "line",
    note: "",
  }));

  const blocked = new Set([1, mainTileCount]);
  const candidates = Array.from({ length: mainTileCount - 2 }, (_, i) => i + 2);

  // Mindestens ein leichtes Scoring-Element
  const firstEasy = pickFreeIndex(candidates, blocked);
  if (firstEasy !== null) {
    const easyType = Math.random() < 0.5 ? "gap" : "speed_bump";
    tiles[firstEasy - 1].type = easyType;
    tiles[firstEasy - 1].note = easyType === "gap" ? `Gap-Länge im Generator: ${MIN_GAP_CM}–${MAX_GAP_CM} cm` : "Niedrige Bodenwelle";
    blocked.add(firstEasy);
  }

  // Optional zweite leichte Schwierigkeit
  if (Math.random() < 0.55) {
    const secondEasy = pickFreeIndex(candidates, blocked);
    if (secondEasy !== null) {
      tiles[secondEasy - 1].type = Math.random() < 0.5 ? "gap" : "speed_bump";
      blocked.add(secondEasy);
    }
  }

  // Optional Intersection
  if (Math.random() < 0.45) {
    const ix = pickFreeIndex(candidates, blocked);
    if (ix !== null) {
      tiles[ix - 1].type = "intersection";
      tiles[ix - 1].note = "Einfaches T-Stück, grüne Marker legen die Richtung fest";
      blocked.add(ix);
    }
  }

  // Optional Rampen-Tripel: up - line - down (kein Peak-Fehler)
  if (Math.random() < 0.45 && mainTileCount >= 9) {
    const startCandidates = [];
    for (let i = 2; i <= mainTileCount - 3; i++) {
      if (!blocked.has(i) && !blocked.has(i + 1) && !blocked.has(i + 2)) {
        startCandidates.push(i);
      }
    }
    if (startCandidates.length) {
      const start = sample(startCandidates);
      tiles[start - 1].type = "ramp_up";
      tiles[start].type = "line";
      tiles[start + 1].type = "ramp_down";
      tiles[start].note = "Zwischentile für sichere Rampenführung";
      blocked.add(start);
      blocked.add(start + 1);
      blocked.add(start + 2);
    }
  }

  // Optional einzelnes Obstacle (sparsam für Machbarkeit)
  if (Math.random() < 0.35) {
    const ox = pickFreeIndex(candidates, blocked);
    if (ox !== null) {
      tiles[ox - 1].type = "obstacle";
      tiles[ox - 1].note = "Einzelnes, klar umfahrbares Hindernis";
      blocked.add(ox);
    }
  }

  // Sehr selten Seesaw
  if (Math.random() < 0.2) {
    const sx = pickFreeIndex(candidates, blocked);
    if (sx !== null) {
      tiles[sx - 1].type = "seesaw";
      tiles[sx - 1].note = "Geradlinige Wippe mit geringer Neigung";
      blocked.add(sx);
    }
  }

  // Checkpoints nur auf nicht-scoring Tiles (vereinfachte, machbare Verteilung)
  const scoringTypes = new Set(["gap", "speed_bump", "intersection", "obstacle", "seesaw", "ramp_up", "ramp_down"]);
  const checkpoints = [1];
  for (let i = 3; i <= mainTileCount - 1; i += 3) {
    if (!scoringTypes.has(tiles[i - 1].type)) checkpoints.push(i);
  }

  const hazardCount = tiles.filter((t) => scoringTypes.has(t.type)).length;

  return {
    tiles,
    checkpoints,
    evacuationZone: {
      size: "120 x 90 cm",
      victims: { live: 2, dead: 1 },
      entryStrip: "Reflektierend silber (25 x 250 mm)",
      exitStrip: "Schwarz (25 x 250 mm)",
    },
    postEvacuationTiles: 2,
    difficulty: hazardCount <= 3 ? "niedrig" : "moderat",
  };
}

function drawTile(x, y, tile, isCheckpoint = false) {
  const style = HAZARD_STYLES[tile.type] || HAZARD_STYLES.line;

  ctx.fillStyle = style.color;
  ctx.fillRect(x, y, 80, 80);
  ctx.strokeStyle = "#9aa6b2";
  ctx.strokeRect(x, y, 80, 80);

  // Linie
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 40);
  ctx.lineTo(x + 70, y + 40);
  ctx.stroke();

  // Zusatzsymbolik
  if (tile.type === "gap") {
    ctx.clearRect(x + 34, y + 35, 12, 10);
  }

  if (tile.type === "intersection") {
    ctx.beginPath();
    ctx.moveTo(x + 40, y + 40);
    ctx.lineTo(x + 40, y + 12);
    ctx.stroke();
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x + 48, y + 26, 8, 8);
  }

  if (tile.type === "speed_bump") {
    ctx.fillStyle = "#333";
    ctx.fillRect(x + 28, y + 30, 24, 6);
  }

  if (tile.type === "obstacle") {
    ctx.fillStyle = "#a16207";
    ctx.fillRect(x + 30, y + 20, 20, 40);
  }

  if (tile.type === "seesaw") {
    ctx.strokeStyle = "#6d28d9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 52);
    ctx.lineTo(x + 62, y + 28);
    ctx.stroke();
  }

  if (tile.type === "ramp_up" || tile.type === "ramp_down") {
    ctx.fillStyle = "#059669";
    const dir = tile.type === "ramp_up" ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 60);
    ctx.lineTo(x + 60, y + 60);
    ctx.lineTo(x + 60, y + 60 + dir * -25);
    ctx.closePath();
    ctx.fill();
  }

  if (isCheckpoint) {
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.arc(x + 68, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1f2937";
  ctx.font = "12px sans-serif";
  ctx.fillText(`#${tile.idx}`, x + 6, y + 14);
}

function render(course) {
  const requiredWidth = 20 + 90 * (course.tiles.length + 1) + 20 + 260 + 20 + 90 * course.postEvacuationTiles + 80 + 30;
  canvas.width = Math.max(1400, requiredWidth);
  canvas.height = 420;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const startX = 20;
  const tileY = 55;
  const step = 90;

  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#111827";
  ctx.fillText("Start", startX + 20, 30);
  ctx.strokeRect(startX, tileY, 80, 80);

  course.tiles.forEach((tile, i) => {
    const x = startX + step * (i + 1);
    drawTile(x, tileY, tile, course.checkpoints.includes(tile.idx));
  });

  const ezX = startX + step * (course.tiles.length + 1) + 20;
  const ezY = 35;
  const ezW = 260;
  const ezH = 180;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(ezX, ezY, ezW, ezH);
  ctx.strokeStyle = "#64748b";
  ctx.strokeRect(ezX, ezY, ezW, ezH);
  ctx.fillStyle = "#111827";
  ctx.fillText("Evacuation Zone (120 x 90 cm)", ezX + 8, ezY + 18);

  // Eingang/Ausgang
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(ezX - 10, ezY + ezH / 2 - 4, 10, 8);
  ctx.fillStyle = "#000";
  ctx.fillRect(ezX + ezW, ezY + ezH / 2 - 4, 10, 8);

  // Evacuation points (Dreiecke)
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(ezX + ezW - 14, ezY + 14);
  ctx.lineTo(ezX + ezW - 70, ezY + 14);
  ctx.lineTo(ezX + ezW - 14, ezY + 70);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(ezX + 14, ezY + ezH - 14);
  ctx.lineTo(ezX + 70, ezY + ezH - 14);
  ctx.lineTo(ezX + 14, ezY + ezH - 70);
  ctx.closePath();
  ctx.fill();

  // Opfer (2 live silber, 1 dead schwarz)
  const victimPositions = [
    [ezX + 80, ezY + 80, "silver"],
    [ezX + 150, ezY + 120, "silver"],
    [ezX + 190, ezY + 70, "black"],
  ];
  for (const [vx, vy, color] of victimPositions) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(vx, vy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.stroke();
  }

  // Nach EZ zur Goal Tile
  const exitStartX = ezX + ezW + 20;
  for (let i = 0; i < course.postEvacuationTiles; i++) {
    const x = exitStartX + i * step;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, tileY, 80, 80);
    ctx.strokeStyle = "#9aa6b2";
    ctx.strokeRect(x, tileY, 80, 80);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 10, tileY + 40);
    ctx.lineTo(x + 70, tileY + 40);
    ctx.stroke();
  }

  const goalX = exitStartX + step * course.postEvacuationTiles;
  ctx.strokeStyle = "#9aa6b2";
  ctx.strokeRect(goalX, tileY, 80, 80);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(goalX + 28, tileY + 8, 24, 64);
  ctx.fillStyle = "#111827";
  ctx.fillText("Goal", goalX + 20, 30);

  renderLists(course);
}

function renderLists(course) {
  const counts = course.tiles.reduce((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  summaryList.innerHTML = "";
  const summaryItems = [
    `Tilegröße: ${TILE_SIZE_CM} x ${TILE_SIZE_CM} cm`,
    `Wettbewerbs-Tiles (ohne Start/Goal): ${course.tiles.length}`,
    `Checkpoints: ${course.checkpoints.join(", ")}`,
    `Hazards gesamt: ${(course.tiles.length - (counts.line || 0))}`,
    `Difficulty: ${course.difficulty}`,
    `Evacuation Zone: ${course.evacuationZone.size}, Opfer: 2 lebend + 1 tot`,
  ];

  for (const item of summaryItems) {
    const li = document.createElement("li");
    li.textContent = item;
    summaryList.appendChild(li);
  }

  tileList.innerHTML = "";
  for (const tile of course.tiles) {
    const li = document.createElement("li");
    const style = HAZARD_STYLES[tile.type] || HAZARD_STYLES.line;
    li.textContent = `Tile ${tile.idx}: ${style.label}${tile.note ? ` (${tile.note})` : ""}`;
    tileList.appendChild(li);
  }
}

function generateAndRender() {
  const course = generateCourse();
  render(course);
}

generateBtn.addEventListener("click", generateAndRender);
generateAndRender();
