import {
  CYCLE_FRAME_COUNT,
  DERIVED_JOINTS,
  HOOF_LENGTH_RATIO,
  JOINT_NAMES,
  JOINTS,
  type JointName,
} from "../../data/gait/JOINTS";

export type Point = [number, number];
export type Slot = Point | null;

export type AnnotationFile = {
  plate: string;
  frame_count: number;
  cols: number;
  rows: number;
  crop: { left: number; top: number; right: number; bottom: number };
  image_size: [number, number];
  joint_order: string[];
  frames: { index: number; points: Slot[] }[];
};

export type Bone = { name: string; parent: string; length: number };

export type Rig = {
  plate: string;
  n: number;
  bones: Bone[];
  frames: { rootY: number; angles: Record<string, number> }[];
  loop: { maxAbsDelta: number; perBone: Record<string, number> };
  contact_frames: number[];
  landing_frame: number;
};

function median(xs: number[]) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function wrapDist(i: number, j: number, n: number) {
  const d = (j - i + n) % n;
  return d === 0 ? n : d;
}

function interpolateJoint(series: Slot[], n: number): (Point | null)[] {
  const out: (Point | null)[] = series.map((p) => p);
  for (let i = 0; i < n; i++) {
    if (out[i]) continue;
    let prev = -1;
    let next = -1;
    for (let k = 1; k < n; k++) {
      if (series[(i - k + n) % n]) {
        prev = (i - k + n) % n;
        break;
      }
    }
    for (let k = 1; k < n; k++) {
      if (series[(i + k) % n]) {
        next = (i + k) % n;
        break;
      }
    }
    if (prev < 0 && next < 0) continue;
    if (prev < 0) {
      out[i] = series[next];
      continue;
    }
    if (next < 0) {
      out[i] = series[prev];
      continue;
    }
    const span = wrapDist(prev, next, n);
    const t = wrapDist(prev, i, n) / span;
    out[i] = lerp(series[prev]!, series[next]!, t);
  }
  return out;
}

export function extractRig(data: AnnotationFile): Rig {
  if (JSON.stringify(data.joint_order) !== JSON.stringify(JOINT_NAMES)) {
    throw new Error("joint_order does not match JOINTS.ts");
  }

  const n = Math.min(CYCLE_FRAME_COUNT, data.frames.length);
  const raw = data.frames.slice(0, n).map((f) => {
    const pts = [...f.points];
    while (pts.length < JOINT_NAMES.length) pts.push(null);
    return pts.slice(0, JOINT_NAMES.length);
  });

  const filled: (Point | null)[][] = JOINT_NAMES.map((_, j) =>
    interpolateJoint(
      raw.map((frame) => frame[j] ?? null),
      n,
    ),
  );

  const at = (frame: number, joint: number) => filled[joint][frame];

  const bones: Bone[] = [];
  for (const j of JOINTS) {
    if (j.parent === null) continue;
    const ci = JOINT_NAMES.indexOf(j.name);
    const pi = JOINT_NAMES.indexOf(j.parent);
    const lengths: number[] = [];
    for (let f = 0; f < n; f++) {
      const c = at(f, ci);
      const p = at(f, pi);
      if (!c || !p) continue;
      lengths.push(Math.hypot(c[0] - p[0], c[1] - p[1]));
    }
    bones.push({ name: j.name, parent: j.parent, length: median(lengths) });
  }

  const angleAt = (frame: number, name: JointName, parent: JointName) => {
    const ci = JOINT_NAMES.indexOf(name);
    const pi = JOINT_NAMES.indexOf(parent);
    const c = at(frame, ci);
    const p = at(frame, pi);
    if (!c || !p) return 0;
    return Math.atan2(c[1] - p[1], c[0] - p[0]);
  };

  const rootIdx = JOINT_NAMES.indexOf("root");
  const rootYs = Array.from({ length: n }, (_, f) => at(f, rootIdx)?.[1] ?? 0);
  const meanRootY = rootYs.reduce((a, b) => a + b, 0) / n;

  const frames = Array.from({ length: n }, (_, f) => {
    const angles: Record<string, number> = {};
    for (const b of bones) angles[b.name] = angleAt(f, b.name as JointName, b.parent as JointName);
    return { rootY: rootYs[f] - meanRootY, angles };
  });

  const sample = poseFrom(bones, frames[0]!, 1);
  const ys = [...sample.values()].map((p) => p.y);
  const height = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = 1 / height;
  for (const b of bones) b.length *= scale;
  for (const fr of frames) fr.rootY *= scale;

  for (const d of DERIVED_JOINTS) {
    const fetlock = d.parent;
    const fetlockBone = bones.find((b) => b.name === fetlock);
    bones.push({ name: d.name, parent: fetlock, length: HOOF_LENGTH_RATIO });
    for (const fr of frames) {
      fr.angles[d.name] = fetlockBone ? fr.angles[fetlockBone.name] : 0;
    }
  }

  const perBone: Record<string, number> = {};
  let maxAbsDelta = 0;
  for (const b of bones) {
    const a0 = frames[0]!.angles[b.name] ?? 0;
    const aN = frames[n - 1]!.angles[b.name] ?? 0;
    let d = aN - a0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    perBone[b.name] = d;
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(d));
  }

  return {
    plate: data.plate,
    n,
    bones,
    frames,
    loop: { maxAbsDelta, perBone },
    contact_frames: [],
    landing_frame: 0,
  };
}

export function poseFrom(
  bones: Bone[],
  frame: { rootY: number; angles: Record<string, number> },
  scale = 1,
) {
  const pos = new Map<string, { x: number; y: number }>();
  pos.set("root", { x: 0, y: frame.rootY * scale });
  const remaining = [...bones];
  let guard = remaining.length + 1;
  while (remaining.length && guard--) {
    const i = remaining.findIndex((b) => pos.has(b.parent));
    if (i < 0) break;
    const [b] = remaining.splice(i, 1);
    const p = pos.get(b.parent)!;
    const a = frame.angles[b.name] ?? 0;
    pos.set(b.name, {
      x: p.x + Math.cos(a) * b.length * scale,
      y: p.y + Math.sin(a) * b.length * scale,
    });
  }
  return pos;
}
