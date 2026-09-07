import { OBSTACLE_MIN_H, OBSTACLE_MIN_W, jumpStats } from "../config";
import { overlaps, type Rect } from "../engine/aabb";

export type Obstacle = { x: number; w: number; h: number };

export function assertSolvable() {
  const s = jumpStats();
  if (s.maxWidth < OBSTACLE_MIN_W) throw new Error("unclearable: maxWidth < min obstacle width");
  if (s.maxHeight < OBSTACLE_MIN_H) throw new Error("unclearable: maxHeight < min obstacle height");
  if (s.minGap <= s.jumpDistance) throw new Error("unclearable: minGap does not leave landing room");
}

export function spawnAhead(list: Obstacle[], until: number) {
  const s = jumpStats();
  const randBox = () => ({
    w: OBSTACLE_MIN_W + Math.random() * (s.maxWidth - OBSTACLE_MIN_W),
    h: OBSTACLE_MIN_H + Math.random() * (s.maxHeight - OBSTACLE_MIN_H),
  });
  if (list.length === 0) {
    const b = randBox();
    list.push({ x: s.minGap, ...b });
  }
  let x = list[list.length - 1]!.x + list[list.length - 1]!.w;
  while (x + s.minGap < until) {
    x += s.minGap + Math.random() * (s.maxGap - s.minGap);
    const b = randBox();
    list.push({ x, ...b });
    x += b.w;
  }
}

export function cullBehind(list: Obstacle[], behind: number) {
  while (list.length && list[0]!.x + list[0]!.w < behind) list.shift();
}

export function hitObstacle(list: Obstacle[], horse: Rect) {
  for (const o of list) {
    if (overlaps(horse, { x: o.x, y: 0, w: o.w, h: o.h })) return o;
  }
  return null;
}
