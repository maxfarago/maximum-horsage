import { extractRig, poseFrom, type Rig } from "../../src/rig/extract";
import { syntheticAnnotations } from "../../src/rig/synthetic";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const file = document.getElementById("file") as HTMLInputElement;
const demo = document.getElementById("demo") as HTMLButtonElement;
const save = document.getElementById("save") as HTMLButtonElement;
const loopEl = document.getElementById("loop")!;
const scrub = document.getElementById("scrub") as HTMLInputElement;
const frameEl = document.getElementById("frame")!;

let rig: Rig | null = null;
let playing = true;
let phase = 0;
let last = performance.now();

function loadRig(next: Rig) {
  rig = next;
  scrub.max = String(next.n - 1);
  const deg = ((next.loop.maxAbsDelta * 180) / Math.PI).toFixed(1);
  loopEl.textContent = `n=${next.n} · loop Δ ${deg}°`;
}

file.addEventListener("change", async () => {
  const f = file.files?.[0];
  if (!f) return;
  loadRig(extractRig(JSON.parse(await f.text())));
});

demo.addEventListener("click", () => {
  loadRig(extractRig(syntheticAnnotations()));
  playing = true;
});

save.addEventListener("click", () => {
  if (!rig) return;
  const blob = new Blob([JSON.stringify(rig, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rig.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

scrub.addEventListener("input", () => {
  if (!rig) return;
  playing = false;
  phase = Number(scrub.value) / rig.n;
});

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
  if (!rig) return;

  const i = Math.min(rig.n - 1, Math.floor(((phase % 1) + 1) % 1 * rig.n));
  scrub.value = String(i);
  frameEl.textContent = `frame ${i}`;

  const pose = poseFrom(rig.bones, rig.frames[i]!);
  const scale = Math.min(w, h) * 0.55;
  const ox = w * 0.55;
  const oy = h * 0.45;

  const far = (name: string) => name.includes("_far_");
  ctx.lineCap = "round";
  for (const b of rig.bones) {
    const a = pose.get(b.parent);
    const c = pose.get(b.name);
    if (!a || !c) continue;
    ctx.beginPath();
    ctx.moveTo(ox + a.x * scale, oy + a.y * scale);
    ctx.lineTo(ox + c.x * scale, oy + c.y * scale);
    ctx.strokeStyle = far(b.name) ? "#4a5a6a" : "#1a1612";
    ctx.lineWidth = far(b.name) ? 2 : 3;
    ctx.stroke();
  }
  for (const [name, p] of pose) {
    ctx.beginPath();
    ctx.arc(ox + p.x * scale, oy + p.y * scale, 3, 0, Math.PI * 2);
    ctx.fillStyle = far(name) ? "#4a5a6a" : "#1a1612";
    ctx.fill();
  }
}

function tick(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (rig && playing) phase = (phase + dt * 1.2) % 1;
  draw();
  requestAnimationFrame(tick);
}

new ResizeObserver(draw).observe(canvas);
requestAnimationFrame(tick);
loadRig(extractRig(syntheticAnnotations()));
