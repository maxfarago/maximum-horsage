import type { Bone } from "../rig/extract";
import { poseFrom } from "../rig/extract";

export type Pose = Map<string, { x: number; y: number }>;

export function poseOf(bones: Bone[], frame: { rootY: number; angles: Record<string, number> }) {
  return poseFrom(bones, frame);
}

export function lowestY(pose: Pose) {
  let m = -Infinity;
  for (const p of pose.values()) if (p.y > m) m = p.y;
  return m;
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  bones: Bone[],
  pose: Pose,
  ox: number,
  oy: number,
  scale: number,
  plant: number,
) {
  const far = (name: string) => name.includes("_far_");
  const px = (p: { x: number; y: number }) => ox + p.x * scale;
  const py = (p: { x: number; y: number }) => oy + (p.y - plant) * scale;
  ctx.lineCap = "round";
  for (const b of bones) {
    const a = pose.get(b.parent);
    const c = pose.get(b.name);
    if (!a || !c) continue;
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(c), py(c));
    ctx.strokeStyle = far(b.name) ? "#4a5a6a" : "#1a1612";
    ctx.lineWidth = far(b.name) ? 2 : 3.2;
    ctx.stroke();
  }
  for (const [name, p] of pose) {
    ctx.beginPath();
    ctx.arc(px(p), py(p), 3, 0, Math.PI * 2);
    ctx.fillStyle = far(name) ? "#4a5a6a" : "#1a1612";
    ctx.fill();
  }
}
