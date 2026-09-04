import { JOINT_COUNT, JOINT_NAMES, JOINTS } from "../../data/gait/JOINTS";
import plateUrl from "../../data/gait/plate.placeholder.png";

type Point = [number, number];
type Slot = Point | null;
type Crop = { left: number; top: number; right: number; bottom: number };

type AnnotationFile = {
  plate: string;
  frame_count: number;
  cols: number;
  rows: number;
  crop: Crop;
  image_size: [number, number];
  joint_order: string[];
  frames: { index: number; points: Slot[] }[];
};

const parentIndex = new Map<string, number | null>();
for (const j of JOINTS) {
  parentIndex.set(j.name, j.parent === null ? null : JOINT_NAMES.indexOf(j.parent));
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const plateInput = $<HTMLInputElement>("plate");
const colsInput = $<HTMLInputElement>("cols");
const rowsInput = $<HTMLInputElement>("rows");
const cropL = $<HTMLInputElement>("crop-l");
const cropT = $<HTMLInputElement>("crop-t");
const cropR = $<HTMLInputElement>("crop-r");
const cropB = $<HTMLInputElement>("crop-b");
const fileInput = $<HTMLInputElement>("file");
const jsonInput = $<HTMLInputElement>("json");
const exportBtn = $<HTMLButtonElement>("export");
const nameEl = $("current-name");
const metaEl = $("current-meta");
const listEl = $<HTMLOListElement>("joints");
const canvas = $<HTMLCanvasElement>("stage");
const stripEl = $<HTMLElement>("strip");
const ctx = canvas.getContext("2d")!;

let image: HTMLImageElement | null = null;
let points: Slot[][] = [];
let frame = 0;
let view = { scale: 1, tx: 0, ty: 0 };
let space = false;
let panning = false;
let panLast = { x: 0, y: 0 };
let pointerMoved = 0;

const far = (name: string) => name.includes("_far_");

function cols() {
  return Math.max(1, Number(colsInput.value) || 1);
}
function rows() {
  return Math.max(1, Number(rowsInput.value) || 1);
}
function frameCount() {
  return cols() * rows();
}
function crop(): Crop {
  return {
    left: Number(cropL.value) || 0,
    top: Number(cropT.value) || 0,
    right: Number(cropR.value) || 0,
    bottom: Number(cropB.value) || 0,
  };
}

function ensureFrames() {
  const n = frameCount();
  if (points.length === n) return;
  const next = Array.from({ length: n }, (_, i) => points[i] ?? []);
  points = next;
  if (frame >= n) frame = n - 1;
}

function cellAt(f: number) {
  if (!image) return { sx: 0, sy: 0, sw: 1, sh: 1 };
  const c = crop();
  const innerW = Math.max(1, image.width - c.left - c.right);
  const innerH = Math.max(1, image.height - c.top - c.bottom);
  const cw = innerW / cols();
  const ch = innerH / rows();
  const col = f % cols();
  const row = Math.floor(f / cols());
  return { sx: c.left + col * cw, sy: c.top + row * ch, sw: cw, sh: ch };
}

function cell() {
  return cellAt(frame);
}

function fit() {
  const { sw, sh } = cell();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const pad = 20;
  view.scale = Math.min((w - pad * 2) / sw, (h - pad * 2) / sh);
  view.tx = (w - sw * view.scale) / 2;
  view.ty = (h - sh * view.scale) / 2;
}

function currentJoint() {
  return points[frame]?.length ?? 0;
}

function sourceFromCss(cssX: number, cssY: number): Point {
  const { sx, sy } = cell();
  return [sx + (cssX - view.tx) / view.scale, sy + (cssY - view.ty) / view.scale];
}

function cssFromSource(x: number, y: number, fromFrame = frame): Point {
  const { sx, sy } = cellAt(fromFrame);
  return [(x - sx) * view.scale + view.tx, (y - sy) * view.scale + view.ty];
}

function eventCss(e: PointerEvent | WheelEvent): Point {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function draw() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!image) return;

  const { sx, sy, sw, sh } = cell();
  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.scale, view.scale);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();

  const prevFrame = (frame - 1 + frameCount()) % frameCount();
  const prev = points[prevFrame];
  if (prev) drawSkeleton(prev, prevFrame, 0.4, true);
  drawSkeleton(points[frame] ?? [], frame, 1, false);

  const i = currentJoint();
  if (prev && i < prev.length && prev[i]) {
    const [x, y] = cssFromSource(...prev[i]!, prevFrame);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(196, 60, 43, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawSkeleton(slots: Slot[], fromFrame: number, alpha: number, ghost: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = ghost ? 1 : 1.5;
  for (let i = 0; i < slots.length; i++) {
    const p = slots[i];
    const parent = parentIndex.get(JOINT_NAMES[i]);
    if (!p || parent === null || parent === undefined || parent < 0) continue;
    const q = slots[parent];
    if (!q) continue;
    const a = cssFromSource(...q, fromFrame);
    const b = cssFromSource(...p, fromFrame);
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.strokeStyle = far(JOINT_NAMES[i]) ? "#4a5a6a" : "#1a1612";
    ctx.stroke();
  }
  for (let i = 0; i < slots.length; i++) {
    const p = slots[i];
    if (!p) continue;
    const [x, y] = cssFromSource(...p, fromFrame);
    ctx.beginPath();
    ctx.arc(x, y, ghost ? 5 : 6, 0, Math.PI * 2);
    ctx.fillStyle = "#e8dcc4";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, ghost ? 3.5 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = far(JOINT_NAMES[i]) ? "#4a5a6a" : "#1a1612";
    ctx.fill();
  }
  ctx.restore();
}

function renderUi() {
  ensureFrames();
  const i = currentJoint();
  const n = frameCount();
  nameEl.textContent = i >= JOINT_COUNT ? "frame complete" : JOINT_NAMES[i];
  metaEl.textContent = `${Math.min(i, JOINT_COUNT)} / ${JOINT_COUNT} · frame ${frame} / ${n}`;

  listEl.replaceChildren(
    ...JOINT_NAMES.map((name, idx) => {
      const li = document.createElement("li");
      const slot = points[frame][idx];
      const mark = slot === undefined ? "·" : slot === null ? "s" : "●";
      li.innerHTML = `<span class="mark">${idx}</span><span>${name}</span><span class="mark">${mark}</span>`;
      if (idx === i) li.classList.add("current");
      if (far(name)) li.classList.add("far");
      li.addEventListener("click", () => {
        if (idx < points[frame].length) {
          points[frame] = points[frame].slice(0, idx);
          renderUi();
        }
      });
      return li;
    }),
  );

  stripEl.replaceChildren(
    ...Array.from({ length: n }, (_, f) => {
      const b = document.createElement("button");
      b.type = "button";
      const done = (points[f]?.length ?? 0) >= JOINT_COUNT;
      b.textContent = `${f} ${points[f]?.length ?? 0}/${JOINT_COUNT}`;
      if (f === frame) b.classList.add("on");
      if (done) b.classList.add("done");
      b.addEventListener("click", () => {
        frame = f;
        fit();
        renderUi();
      });
      return b;
    }),
  );

  draw();
}

function place(p: Point) {
  ensureFrames();
  if (currentJoint() >= JOINT_COUNT) return;
  points[frame].push(p);
  renderUi();
}

function skip() {
  ensureFrames();
  if (currentJoint() >= JOINT_COUNT) return;
  points[frame].push(null);
  renderUi();
}

function undo() {
  ensureFrames();
  points[frame].pop();
  renderUi();
}

function loadImage(src: string) {
  const img = new Image();
  img.onload = () => {
    image = img;
    ensureFrames();
    fit();
    renderUi();
  };
  img.src = src;
}

function exportJson() {
  ensureFrames();
  const file: AnnotationFile = {
    plate: plateInput.value.trim() || "placeholder",
    frame_count: frameCount(),
    cols: cols(),
    rows: rows(),
    crop: crop(),
    image_size: image ? [image.width, image.height] : [0, 0],
    joint_order: [...JOINT_NAMES],
    frames: points.map((pts, index) => ({
      index,
      points: pts.map((p) => (p === undefined ? null : p)),
    })),
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "annotations.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadAnnotation(data: AnnotationFile) {
  if (JSON.stringify(data.joint_order) !== JSON.stringify(JOINT_NAMES)) {
    window.alert("joint_order does not match frozen JOINTS.ts — refusing to load");
    return;
  }
  plateInput.value = data.plate;
  colsInput.value = String(data.cols);
  rowsInput.value = String(data.rows);
  cropL.value = String(data.crop.left);
  cropT.value = String(data.crop.top);
  cropR.value = String(data.crop.right);
  cropB.value = String(data.crop.bottom);
  points = data.frames.map((f) => [...f.points]);
  frame = 0;
  ensureFrames();
  fit();
  renderUi();
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  loadImage(URL.createObjectURL(f));
});

jsonInput.addEventListener("change", async () => {
  const f = jsonInput.files?.[0];
  if (!f) return;
  loadAnnotation(JSON.parse(await f.text()) as AnnotationFile);
});

exportBtn.addEventListener("click", exportJson);

for (const el of [colsInput, rowsInput, cropL, cropT, cropR, cropB]) {
  el.addEventListener("change", () => {
    ensureFrames();
    fit();
    renderUi();
  });
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 1 || e.button === 2 || space) {
    panning = true;
    panLast = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  pointerMoved = 0;
});

canvas.addEventListener("pointermove", (e) => {
  if (!panning) {
    pointerMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
    return;
  }
  view.tx += e.clientX - panLast.x;
  view.ty += e.clientY - panLast.y;
  panLast = { x: e.clientX, y: e.clientY };
  draw();
});

canvas.addEventListener("pointerup", (e) => {
  if (panning) {
    panning = false;
    return;
  }
  if (e.button !== 0 || pointerMoved > 6) return;
  place(sourceFromCss(...eventCss(e)));
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const [cssX, cssY] = eventCss(e);
    const [sx, sy] = sourceFromCss(cssX, cssY);
    view.scale *= e.deltaY > 0 ? 0.92 : 1.08;
    view.tx = cssX - (sx - cell().sx) * view.scale;
    view.ty = cssY - (sy - cell().sy) * view.scale;
    draw();
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  if (e.key === " ") space = true;
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === "Backspace") {
    e.preventDefault();
    undo();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    frame = (frame - 1 + frameCount()) % frameCount();
    fit();
    renderUi();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    frame = (frame + 1) % frameCount();
    fit();
    renderUi();
  } else if (e.key === "s" || e.key === "S") {
    skip();
  } else if (e.key === "0") {
    fit();
    draw();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === " ") space = false;
});

new ResizeObserver(() => {
  fit();
  draw();
}).observe(canvas);

loadImage(plateUrl);
renderUi();
