import { DT } from "./config";
import { startLoop } from "./engine/loop";
import { makeInput } from "./engine/input";
import { extractRig, poseFrom } from "./rig/extract";
import { syntheticAnnotations } from "./rig/synthetic";
import { makeSim } from "./game/sim";
import { paint } from "./render/scene";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const rig = extractRig(syntheticAnnotations());
const stand = poseFrom(rig.bones, rig.frames[rig.landing_frame]!);

const size = () => ({ w: canvas.clientWidth, h: canvas.clientHeight });
const sim = makeSim(rig, () => size().w);
const input = makeInput();

function fit() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render(alpha: number) {
  fit();
  const { w, h } = size();
  paint(ctx, w, h, rig, sim.snapshot(alpha), stand);
}

startLoop(
  () => {
    if (input.consumeOverlay()) sim.toggleOverlay();
    if (input.consumeAction()) sim.action();
    sim.update();
  },
  render,
  DT,
);

new ResizeObserver(() => render(1)).observe(canvas);
