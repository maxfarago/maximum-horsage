import { CYCLE_FRAME_COUNT, JOINT_NAMES } from "../../data/gait/JOINTS";
import type { AnnotationFile, Point } from "./extract";

function pt(x: number, y: number): Point {
  return [x, y];
}

export function syntheticAnnotations(): AnnotationFile {
  const n = CYCLE_FRAME_COUNT;
  const frames = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const bounce = Math.sin(t * 2) * 8;
    const root: Point = pt(200, 140 + bounce);
    const withers = pt(root[0] + 6, root[1] - 18);
    const poll = pt(root[0] + 70, root[1] - 28);
    const muzzle = pt(poll[0] + 28, poll[1] + 16);
    const croup = pt(root[0] - 70, root[1] - 10);
    const tail_base = pt(croup[0] - 12, croup[1] + 6);
    const tail_tip = pt(tail_base[0] - 36, tail_base[1] + 40);

    const forePhase = t;
    const hindPhase = t + Math.PI;
    const farOff = 0.7;

    const foreNear = leg(withers, 18, 55, 40, 28, 22, forePhase, 1);
    const foreFar = leg(withers, 14, 52, 38, 26, 20, forePhase + farOff, 1);
    const hindNear = leg(croup, 10, 20, 48, 32, 24, hindPhase, -1);
    const hindFar = leg(croup, 8, 18, 46, 30, 22, hindPhase + farOff, -1);

    const byName: Record<string, Point> = {
      root,
      poll,
      muzzle,
      withers,
      croup,
      tail_base,
      tail_tip,
      fore_near_shoulder: foreNear[0],
      fore_near_elbow: foreNear[1],
      fore_near_knee: foreNear[2],
      fore_near_fetlock: foreNear[3],
      fore_far_shoulder: foreFar[0],
      fore_far_elbow: foreFar[1],
      fore_far_knee: foreFar[2],
      fore_far_fetlock: foreFar[3],
      hind_near_hip: hindNear[0],
      hind_near_stifle: hindNear[1],
      hind_near_hock: hindNear[2],
      hind_near_fetlock: hindNear[3],
      hind_far_hip: hindFar[0],
      hind_far_stifle: hindFar[1],
      hind_far_hock: hindFar[2],
      hind_far_fetlock: hindFar[3],
    };

    return {
      index: i,
      points: JOINT_NAMES.map((name) => byName[name] ?? null),
    };
  });

  return {
    plate: "synthetic",
    frame_count: n,
    cols: n,
    rows: 1,
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    image_size: [400, 300],
    joint_order: [...JOINT_NAMES],
    frames,
  };
}

function leg(
  origin: Point,
  ox: number,
  oy: number,
  u: number,
  mid: number,
  low: number,
  phase: number,
  dir: number,
): Point[] {
  const a0 = dir * (0.4 + Math.sin(phase) * 0.5);
  const a1 = dir * (0.2 + Math.sin(phase + 0.4) * 0.7);
  const a2 = dir * (-0.3 + Math.cos(phase) * 0.6);
  const s = pt(origin[0] + ox * dir, origin[1] + oy);
  const e = step(s, a0, u);
  const k = step(e, a0 + a1, mid);
  const f = step(k, a0 + a1 + a2, low);
  return [s, e, k, f];
}

function step(p: Point, a: number, len: number): Point {
  return [p[0] + Math.cos(a + Math.PI / 2) * len, p[1] + Math.sin(a + Math.PI / 2) * len];
}