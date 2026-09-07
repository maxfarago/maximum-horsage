import {
  GROUND_FRAC,
  HITBOX_H,
  HITBOX_LIFT,
  HITBOX_OX,
  HITBOX_W,
  HORSE_SCALE,
  jumpStats,
} from "../config";
import type { Rig } from "../rig/extract";
import type { Snapshot } from "../game/sim";
import { drawSkeleton, lowestY, poseOf, type Pose } from "./skeleton";

export function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rig: Rig,
  snap: Snapshot,
  stand: Pose,
) {
  const groundY = h * GROUND_FRAC;
  const plant = lowestY(stand);
  ctx.fillStyle = "#e8dcc4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d9ccb0";
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();

  for (const o of snap.obstacles) {
    const x = snap.screenX + (o.x - snap.distance);
    if (x > w || x + o.w < 0) continue;
    ctx.fillStyle = "#1a1612";
    ctx.fillRect(x, groundY - o.h, o.w, o.h);
  }

  const pose = poseOf(rig.bones, snap.frame);
  drawSkeleton(ctx, rig.bones, pose, snap.screenX, groundY - snap.hop, HORSE_SCALE, plant);

  ctx.fillStyle = "#1a1612";
  ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
  if (snap.mode === "running" || snap.mode === "dead") {
    ctx.fillText(String(snap.score), 20, 32);
  }
  if (snap.mode === "title") {
    ctx.font = "600 42px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("max.horse", 20, h * 0.38);
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("space / tap", 20, h * 0.38 + 36);
    ctx.fillText("synthetic gait · d overlay", 20, h * 0.38 + 58);
  }
  if (snap.mode === "dead") {
    ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("dead", 20, 70);
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`best ${snap.pb}`, 20, 96);
    ctx.fillText("space / tap", 20, 118);
  }

  if (snap.overlay) {
    const s = jumpStats();
    const box = {
      x: snap.screenX + HITBOX_OX,
      y: groundY - (snap.hop + HITBOX_LIFT + HITBOX_H),
      w: HITBOX_W,
      h: HITBOX_H,
    };
    ctx.strokeStyle = "#6b2a1a";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "#6b2a1a";
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    const i = Math.min(rig.n - 1, Math.floor(snap.horse.phase * rig.n));
    const lines = [
      `frame ${i}/${rig.n}  phase ${snap.horse.phase.toFixed(3)}`,
      `ground ${snap.horse.grounded ? "yes" : "air " + snap.horse.airT.toFixed(2)}`,
      `jumpDistance ${s.jumpDistance.toFixed(0)}  height ${s.jumpHeight.toFixed(0)}`,
      `hop ${snap.hop.toFixed(1)}`,
    ];
    lines.forEach((t, n) => ctx.fillText(t, 20, h - 72 + n * 16));
  }
}
