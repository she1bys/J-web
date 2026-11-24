// A small block world: walk around in first or third person, mine and build.
// Everything here (textures, character, world) is original and drawn in code.
import * as THREE from "./vendor/three.module.min.js";

/* ---------- World data ---------- */
const SX = 64, SY = 32, SZ = 64;
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, PLANK = 7, ROSE = 8;
const BLOCK_NAMES = ["", "GRASS", "DIRT", "STONE", "WOOD", "LEAVES", "SAND", "PLANKS", "ROSE"];
const HOTBAR = [GRASS, DIRT, STONE, WOOD, PLANK, LEAVES, SAND, ROSE];

// Tiles in a 4x4 atlas of 16x16 pixel textures.
const T_GRASS_TOP = 0, T_GRASS_SIDE = 1, T_DIRT = 2, T_STONE = 3, T_WOOD_SIDE = 4,
      T_WOOD_TOP = 5, T_LEAVES = 6, T_SAND = 7, T_PLANK = 8, T_ROSE = 9;
// [top, side, bottom] tile for each block
const BLOCK_TILES = [
  null,
  [T_GRASS_TOP, T_GRASS_SIDE, T_DIRT],
  [T_DIRT, T_DIRT, T_DIRT],
  [T_STONE, T_STONE, T_STONE],
  [T_WOOD_TOP, T_WOOD_SIDE, T_WOOD_TOP],
  [T_LEAVES, T_LEAVES, T_LEAVES],
  [T_SAND, T_SAND, T_SAND],
  [T_PLANK, T_PLANK, T_PLANK],
  [T_ROSE, T_ROSE, T_ROSE],
];

const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Pixel textures, painted in code ---------- */
function makeAtlas() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = rng(11);
  const pick = a => a[Math.floor(r() * a.length)];
  const paint = (t, f) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = f(x, y);
      g.fillRect((t % 4) * 16 + x, Math.floor(t / 4) * 16 + y, 1, 1);
    }
  };
  const GR = ["#5fae3e", "#6cbf4a", "#6cbf4a", "#7bcc56", "#529a35"];
  const DI = ["#7b4f32", "#8a5a3b", "#8a5a3b", "#9a6946", "#694229"];
  const ST = ["#8a8a8a", "#8a8a8a", "#979797", "#7b7b7b", "#6d6d6d"];
  const LE = ["#3c8a35", "#3c8a35", "#4c9e42", "#2f6e2a", "#23551f"];
  const SA = ["#e6d29a", "#e6d29a", "#eedba6", "#d8c287"];
  const PL = ["#b98a52", "#c2945d", "#ae7f48"];
  const RO = ["#ff6fa5", "#ff7db0", "#f45f98"];

  paint(T_GRASS_TOP, () => pick(GR));
  const edge = Array.from({ length: 16 }, () => 3 + Math.floor(r() * 3));
  paint(T_GRASS_SIDE, (x, y) => (y < edge[x] ? pick(GR) : pick(DI)));
  paint(T_DIRT, () => pick(DI));
  paint(T_STONE, () => pick(ST));
  for (let k = 0; k < 9; k++) {             // a few darker chips in the stone
    g.fillStyle = "#5f5f5f";
    g.fillRect(48 + Math.floor(r() * 14), Math.floor(r() * 15), 2, 1);
  }
  paint(T_WOOD_SIDE, x => (x % 5 === 0 ? "#5a3a20" : r() < 0.15 ? "#8a6240" : "#74502f"));
  paint(T_WOOD_TOP, (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    return d > 6.5 ? "#5a3a20" : Math.floor(d) % 2 ? "#b88a55" : "#a3763f";
  });
  paint(T_LEAVES, () => pick(LE));
  paint(T_SAND, () => pick(SA));
  paint(T_PLANK, (x, y) => {
    const row = Math.floor(y / 4);
    if (y % 4 === 3) return "#7d5a33";
    if (x === (row * 7 + 3) % 16) return "#8d6638";
    return pick(PL);
  });
  paint(T_ROSE, (x, y) => {
    const hx = x - 4, hy = y - 5;
    if (hy >= 0 && hy < 6 && hx >= 0 && hx < 7 && HEART[hy][hx] === "#") return "#ffd6e6";
    return pick(RO);
  });
  return c;
}

function tileColor(atlas, t) {
  const d = atlas.getContext("2d").getImageData((t % 4) * 16, Math.floor(t / 4) * 16, 16, 16).data;
  let rr = 0, gg = 0, bb = 0;
  for (let i = 0; i < d.length; i += 4) { rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
  const n = d.length / 4;
  return new THREE.Color(`rgb(${Math.round(rr / n)},${Math.round(gg / n)},${Math.round(bb / n)})`);
}

/* ---------- Terrain ---------- */
function hash(x, z, seed) {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const s = t => t * t * (3 - 2 * t);
  const u = s(x - xi), v = s(z - zi);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed);
  const c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* ---------- Face table for meshing ---------- */
const FACES = [
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1, corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.68, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.68, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];

// A box whose faces are shaded by direction, so flat colours still read as 3D.
function shadedBox(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const n = geo.attributes.normal, base = new THREE.Color(color), cols = [];
  for (let i = 0; i < n.count; i++) {
    const s = n.getY(i) > 0.5 ? 1 : n.getY(i) < -0.5 ? 0.55 : Math.abs(n.getX(i)) > 0.5 ? 0.8 : 0.68;
    cols.push(base.r * s, base.g * s, base.b * s);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

/* ---------- The game ---------- */
export function createGame({ container, settings: initial, nameRows, onPause }) {
  let settings = { ...initial };
  const touch = matchMedia("(pointer: coarse)").matches;

  /* World */
  const world = new Uint8Array(SX * SY * SZ);
  const idx = (x, y, z) => (y * SZ + z) * SX + x;
  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ;
  const get = (x, y, z) => (inside(x, y, z) ? world[idx(x, y, z)] : AIR);
  const set = (x, y, z, b) => { if (inside(x, y, z)) world[idx(x, y, z)] = b; };
  // Out of bounds counts as solid sideways and below, so you can't walk off the world.
  const solid = (x, y, z) => {
    if (x < 0 || z < 0 || x >= SX || z >= SZ || y < 0) return true;
    if (y >= SY) return false;
    return world[idx(x, y, z)] !== AIR;
  };

  const heightAt = (x, z) => Math.floor(7 + vnoise(x / 14, z / 14, 1) * 7 + vnoise(x / 5, z / 5, 2) * 2.5);
  const SPAWN = { x: 32, z: 46 };
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = heightAt(x, z), beach = h <= 8;
    for (let y = 0; y <= h; y++) {
      set(x, y, z, y === h ? (beach ? SAND : GRASS) : y > h - 3 ? (beach ? SAND : DIRT) : STONE);
    }
  }
  const tr = rng(5);
  for (let z = 3; z < SZ - 3; z++) for (let x = 3; x < SX - 3; x++) {
    const h = heightAt(x, z);
    if (get(x, h, z) !== GRASS || tr() > 0.018) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6) continue;
    const th = 4 + Math.floor(tr() * 2);
    for (let y = 1; y <= th; y++) set(x, h + y, z, WOOD);
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy === 1 ? 1 : 2;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && tr() < 0.6) continue;
        const y = h + th + dy;
        if (get(x + dx, y, z + dz) === AIR) set(x + dx, y, z + dz, LEAVES);
      }
    }
  }
  // Her name, in pink rose blocks, floating in the sky ahead of where you start.
  nameRows.forEach((row, r) => [...row].forEach((c, i) => {
    if (c === "#") set(15 + i, 27 - r, 10, ROSE);
  }));

  /* Renderer, scene, camera */
  const canvas = document.createElement("canvas");
  canvas.className = "g-view";
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const scene = new THREE.Scene();
  const SKY = 0xbfe3ff;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 26, 62);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
  camera.rotation.order = "YXZ";

  const atlas = makeAtlas();
  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const worldMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
  const blockColors = BLOCK_TILES.map(t => (t ? tileColor(atlas, t[1]) : null));

  let worldMesh = null;
  function buildMesh() {
    const pos = [], uv = [], col = [], ind = [];
    const e = 0.002, q = 0.25;
    for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const id = world[idx(x, y, z)];
      if (!id) continue;
      for (const f of FACES) {
        const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
        if (ny < 0 || get(nx, ny, nz) !== AIR) continue;
        const t = BLOCK_TILES[id][f.dir[1] === 1 ? 0 : f.dir[1] === -1 ? 2 : 1];
        const u0 = (t % 4) * q, v0 = 1 - (Math.floor(t / 4) + 1) * q;
        const n = pos.length / 3;
        for (const c of f.corners) {
          pos.push(x + c[0], y + c[1], z + c[2]);
          uv.push(u0 + e + c[3] * (q - 2 * e), v0 + e + c[4] * (q - 2 * e));
          col.push(f.shade, f.shade, f.shade);
        }
        ind.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(ind);
    if (worldMesh) { scene.remove(worldMesh); worldMesh.geometry.dispose(); }
    worldMesh = new THREE.Mesh(geo, worldMat);
    scene.add(worldMesh);
  }
  buildMesh();

  // Drifting clouds
  const clouds = [];
  const cr = rng(9);
  for (let k = 0; k < 7; k++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(4 + cr() * 6, 1, 3 + cr() * 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    c.position.set(cr() * SX, 31 + cr() * 3, cr() * SZ);
    scene.add(c);
    clouds.push(c);
  }

  // Outline of the block you're pointing at
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000 }));
  highlight.visible = false;
  scene.add(highlight);

  /* Character: an original blocky figure in black and white with a pink heart */
  const hero = new THREE.Group();
  const limb = (w, h, d, color, px, py) => {
    const pivot = new THREE.Group();
    const m = shadedBox(w, h, d, color);
    m.position.y = -h / 2;
    pivot.add(m);
    pivot.position.set(px, py, 0);
    hero.add(pivot);
    return pivot;
  };
  const legL = limb(0.24, 0.72, 0.26, 0x1a1a1a, -0.13, 0.72);
  const legR = limb(0.24, 0.72, 0.26, 0x1a1a1a, 0.13, 0.72);
  const armL = limb(0.18, 0.64, 0.22, 0x1a1a1a, -0.36, 1.36);
  const armR = limb(0.18, 0.64, 0.22, 0x1a1a1a, 0.36, 1.36);
  const add = (m, x, y, z) => { m.position.set(x, y, z); hero.add(m); return m; };
  add(shadedBox(0.52, 0.66, 0.3, 0x1a1a1a), 0, 1.05, 0);
  add(shadedBox(0.14, 0.12, 0.02, 0xff5c9a), 0, 1.18, -0.16);      // heart on the chest
  add(shadedBox(0.48, 0.46, 0.48, 0xf6f2ee), 0, 1.6, 0);           // head
  add(shadedBox(0.52, 0.12, 0.52, 0x111111), 0, 1.86, 0);          // hair top
  add(shadedBox(0.52, 0.34, 0.08, 0x111111), 0, 1.66, 0.24);       // hair back
  add(shadedBox(0.08, 0.1, 0.02, 0x111111), -0.11, 1.62, -0.245);  // eyes
  add(shadedBox(0.08, 0.1, 0.02, 0x111111), 0.11, 1.62, -0.245);
  scene.add(hero);

  /* Debris when a block breaks */
  const debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const debrisMats = blockColors.map(c => (c ? new THREE.MeshBasicMaterial({ color: c }) : null));
  const debris = [];
  function burst(x, y, z, id) {
    for (let k = 0; k < 12; k++) {
      const m = new THREE.Mesh(debrisGeo, debrisMats[id]);
      m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
      scene.add(m);
      debris.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.8 + Math.random() * 0.5 });
    }
  }

  /* Player */
  const p = new THREE.Vector3(SPAWN.x + 0.5, heightAt(SPAWN.x, SPAWN.z) + 1, SPAWN.z + 0.5);
  const v = new THREE.Vector3();
  const HW = 0.3, PH = 1.8, EYE = 1.62;
  let yaw = 0, pitch = 0.18, onGround = false, walk = 0;
  let camMode = settings.camera, slot = 0;

  function collides() {
    const x0 = Math.floor(p.x - HW + 1e-4), x1 = Math.floor(p.x + HW - 1e-4);
    const y0 = Math.floor(p.y + 1e-4), y1 = Math.floor(p.y + PH - 1e-4);
    const z0 = Math.floor(p.z - HW + 1e-4), z1 = Math.floor(p.z + HW - 1e-4);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (solid(x, y, z)) return true;
    }
    return false;
  }

  // Move along one axis; on contact, snap flush to the block face. Returns true if blocked.
  function moveAxis(axis, d) {
    if (!d) return false;
    const before = p[axis];
    p[axis] += d;
    if (!collides()) return false;
    if (axis === "y") p.y = d < 0 ? Math.floor(p.y) + 1 : Math.floor(p.y + PH) - PH - 1e-4;
    else p[axis] = d > 0 ? Math.floor(p[axis] + HW) - HW - 1e-4 : Math.floor(p[axis] - HW) + 1 + HW + 1e-4;
    if (collides()) p[axis] = before;
    return true;
  }

  /* Pointing at blocks: step through the grid along the view ray */
  function raycast(o, dir, maxDist) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const dx = Math.abs(1 / dir.x), dy = Math.abs(1 / dir.y), dz = Math.abs(1 / dir.z);
    let tx = dir.x > 0 ? (x + 1 - o.x) * dx : (o.x - x) * dx;
    let ty = dir.y > 0 ? (y + 1 - o.y) * dy : (o.y - y) * dy;
    let tz = dir.z > 0 ? (z + 1 - o.z) * dz : (o.z - z) * dz;
    let px = x, py = y, pz = z, t = 0;
    while (t <= maxDist) {
      if (get(x, y, z) !== AIR) return { x, y, z, px, py, pz };
      px = x; py = y; pz = z;
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += dx; }
      else if (ty < tz) { y += sy; t = ty; ty += dy; }
      else { z += sz; t = tz; tz += dz; }
    }
    return null;
  }

  let target = null;
  const look = new THREE.Vector3();
  function updateTarget() {
    camera.getWorldDirection(look);
    const reach = 5 + (camMode === "third" ? camera.position.distanceTo(eye()) : 0);
    target = raycast(camera.position, look, reach);
    highlight.visible = !!target;
    if (target) highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  }

  function mine() {
    if (!target) return;
    const id = get(target.x, target.y, target.z);
    set(target.x, target.y, target.z, AIR);
    burst(target.x, target.y, target.z, id);
    buildMesh();
    updateTarget();
  }

  function build() {
    if (!target) return;
    const { px, py, pz } = target;
    if (!inside(px, py, pz) || get(px, py, pz) !== AIR) return;
    // Don't place a block inside yourself.
    const overlap = px + 1 > p.x - HW && px < p.x + HW && pz + 1 > p.z - HW && pz < p.z + HW &&
                    py + 1 > p.y && py < p.y + PH;
    if (overlap) return;
    set(px, py, pz, HOTBAR[slot]);
    buildMesh();
    updateTarget();
  }

  /* HUD */
  const el = (cls, parent = container, tag = "div") => {
    const e = document.createElement(tag);
    e.className = cls;
    parent.appendChild(e);
    return e;
  };
  el("g-cross");
  const hotbar = el("g-hotbar");
  const label = el("g-label");
  const hint = el("g-hint");
  const pauseBtn = el("g-pause", container, "button");
  pauseBtn.textContent = "II";
  pauseBtn.setAttribute("aria-label", "Pause");

  const slots = HOTBAR.map((id, n) => {
    const b = el("g-slot", hotbar, "button");
    b.setAttribute("aria-label", BLOCK_NAMES[id]);
    const ic = document.createElement("canvas");
    ic.width = ic.height = 16;
    const t = BLOCK_TILES[id][1];
    ic.getContext("2d").drawImage(atlas, (t % 4) * 16, Math.floor(t / 4) * 16, 16, 16, 0, 0, 16, 16);
    b.appendChild(ic);
    b.addEventListener("click", () => select(n));
    return b;
  });
  let labelTimer;
  function select(n) {
    slot = (n + HOTBAR.length) % HOTBAR.length;
    slots.forEach((s, i) => s.classList.toggle("sel", i === slot));
    label.textContent = BLOCK_NAMES[HOTBAR[slot]];
    label.classList.add("show");
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => label.classList.remove("show"), 1200);
  }
  select(0);

  if (touch) hint.classList.add("top");
  hint.innerHTML = touch
    ? "LEFT STICK: MOVE<br>DRAG: LOOK AROUND<br>MINE / BUILD / JUMP / CAM"
    : "CLICK TO PLAY<br>WASD MOVE · SPACE JUMP<br>LEFT CLICK MINE · RIGHT CLICK BUILD<br>1-8 BLOCKS · V CAMERA · ESC PAUSE";

  /* Input */
  const keys = new Set();
  let jumpHeld = false, joy = { x: 0, y: 0 };
  const sens = () => (0.0008 + settings.look * 0.00045) * (touch ? 2.2 : 1);
  const turn = (dx, dy) => {
    yaw -= dx * sens();
    pitch -= dy * sens() * (settings.invertY ? -1 : 1);
    pitch = Math.max(-1.55, Math.min(1.55, pitch));
  };
  const toggleCam = () => { camMode = camMode === "first" ? "third" : "first"; };

  let paused = true;
  const locked = () => document.pointerLockElement === canvas;

  canvas.addEventListener("click", () => {
    if (!touch && !paused && !locked()) canvas.requestPointerLock();
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("mousedown", e => {
    if (!locked() || paused) return;
    if (e.button === 0) mine();
    if (e.button === 2) build();
  });
  // Browsers sometimes report one huge jump right after the mouse is captured; ignore it.
  const onMouseMove = e => {
    if (!locked() || paused) return;
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
    turn(e.movementX, e.movementY);
  };
  const onLockChange = () => {
    hint.classList.toggle("hide", locked() || touch || paused);
    if (!locked() && !paused && !touch) pause();
  };
  const onWheel = e => { if (locked() && !paused) select(slot + Math.sign(e.deltaY)); };
  const onKeyDown = e => {
    if (paused) return;
    keys.add(e.code);
    if (e.code === "Space") jumpHeld = true;
    if (e.code === "KeyV" || e.code === "F5") { e.preventDefault(); toggleCam(); }
    if (/^Digit[1-8]$/.test(e.code)) select(+e.code.slice(5) - 1);
    if (e.code === "Escape") pause();
  };
  const onKeyUp = e => {
    keys.delete(e.code);
    if (e.code === "Space") jumpHeld = false;
  };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onLockChange);
  addEventListener("wheel", onWheel, { passive: true });
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  pauseBtn.addEventListener("click", () => pause());

  // Touch: stick on the left, drag anywhere else on the view to look, buttons on the right.
  if (touch) {
    const pad = el("g-touch");
    const stick = el("g-stick", pad);
    const knob = el("g-knob", stick);
    let stickId = null;
    stick.addEventListener("pointerdown", e => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
    stick.addEventListener("pointermove", e => { if (e.pointerId === stickId) moveStick(e); });
    const endStick = e => {
      if (e.pointerId !== stickId) return;
      stickId = null; joy = { x: 0, y: 0 }; knob.style.transform = "translate(-50%, -50%)";
    };
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);
    function moveStick(e) {
      const r = stick.getBoundingClientRect(), R = r.width / 2 - 8;
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy);
      if (m > R) { dx *= R / m; dy *= R / m; }
      joy = { x: dx / R, y: dy / R };
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    let lookId = null, lx = 0, ly = 0;
    canvas.addEventListener("pointerdown", e => {
      if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (e.pointerId !== lookId || paused) return;
      turn(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
    });
    const endLook = e => { if (e.pointerId === lookId) lookId = null; };
    canvas.addEventListener("pointerup", endLook);
    canvas.addEventListener("pointercancel", endLook);

    const btns = el("g-btns", pad);
    const btn = (text, down, up) => {
      const b = el("g-btn", btns, "button");
      b.textContent = text;
      b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("down"); down(); });
      const off = () => { b.classList.remove("down"); up && up(); };
      b.addEventListener("pointerup", off);
      b.addEventListener("pointercancel", off);
      b.addEventListener("pointerleave", off);
    };
    btn("MINE", mine);
    btn("BUILD", build);
    btn("CAM", toggleCam);
    btn("JUMP", () => { jumpHeld = true; }, () => { jumpHeld = false; });
  }

  /* Sizing */
  function resize() {
    const w = innerWidth, h = innerHeight;
    // Retro mode renders at a lower resolution and scales up with hard pixel edges.
    const ratio = settings.retro ? Math.min(1, Math.max(300, w / 2) / w) : Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  /* Simulation */
  const eye = () => new THREE.Vector3(p.x, p.y + EYE, p.z);
  const camDir = new THREE.Vector3();

  function update(dt) {
    // Movement input in camera space
    let fx = 0, fz = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) fz -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) fz += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) fx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) fx += 1;
    fx += joy.x; fz += joy.y;
    const m = Math.hypot(fx, fz);
    if (m > 1) { fx /= m; fz /= m; }
    const SPEED = 4.3;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    v.x = (fx * cos + fz * sin) * SPEED;
    v.z = (-fx * sin + fz * cos) * SPEED;

    v.y = Math.max(-30, v.y - 24 * dt);
    if (jumpHeld && onGround) v.y = 8.2;

    const blockedX = moveAxis("x", v.x * dt);
    const blockedZ = moveAxis("z", v.z * dt);
    // On touch, hop up single blocks automatically when walking into them.
    if (touch && onGround && (blockedX || blockedZ) && m > 0.3) v.y = 8.2;
    const yHit = moveAxis("y", v.y * dt);
    onGround = yHit && v.y < 0;
    if (yHit) v.y = 0;
    if (p.y < -20) p.set(SPAWN.x + 0.5, heightAt(SPAWN.x, SPAWN.z) + 2, SPAWN.z + 0.5);

    // Camera
    const head = eye();
    if (camMode === "first") {
      camera.position.copy(head);
    } else {
      camDir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const pivot = new THREE.Vector3(p.x, p.y + 1.5, p.z);
      let dist = 0.3;
      for (; dist < 4; dist += 0.1) {
        const c = pivot.clone().addScaledVector(camDir, -dist);
        if (solid(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z))) { dist -= 0.25; break; }
      }
      camera.position.copy(pivot).addScaledVector(camDir, -Math.max(0.3, dist));
    }
    camera.rotation.set(pitch, yaw, 0);

    // Character
    hero.visible = camMode === "third";
    hero.position.copy(p);
    hero.rotation.y = yaw;
    const moving = m > 0.1 && onGround;
    walk = moving ? walk + dt * 9 : walk * 0.8;
    const swing = Math.sin(walk) * (moving ? 0.7 : 0);
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing; armR.rotation.x = swing;

    // Debris
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.v.y -= 20 * dt;
      d.m.position.addScaledVector(d.v, dt);
      const q = d.m.position;
      if (d.v.y < 0 && solid(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z))) {
        q.y = Math.floor(q.y) + 1.08;
        d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6;
      }
      d.life -= dt;
      d.m.scale.setScalar(Math.max(0.01, Math.min(1, d.life * 3)));
      if (d.life <= 0) { scene.remove(d.m); debris.splice(i, 1); }
    }

    for (const c of clouds) { c.position.x += dt * 0.6; if (c.position.x > SX + 10) c.position.x = -10; }

    updateTarget();
  }

  let lastT = 0;
  function frame(now) {
    if (paused) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    update(dt);
    renderer.render(scene, camera);
  }

  function pause() {
    if (paused) return;
    paused = true;
    keys.clear(); jumpHeld = false; joy = { x: 0, y: 0 };
    hint.classList.add("hide");
    if (locked()) document.exitPointerLock();
    onPause && onPause();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    camMode = settings.camera === camMode ? camMode : settings.camera;
    hint.classList.toggle("hide", false);
    if (touch) setTimeout(() => hint.classList.add("hide"), 4000);
    else canvas.requestPointerLock?.();
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  return {
    resume,
    pause,
    setSettings(s) {
      const camChanged = s.camera !== settings.camera;
      settings = { ...s };
      if (camChanged) camMode = settings.camera;
      resize();
    },
  };
}
