import {
  DT,
  HITBOX_H,
  HITBOX_LIFT,
  HITBOX_OX,
  HITBOX_W,
  HORSE_SCREEN_FRAC,
  PB_KEY,
  SPEED,
} from "../config";
import { gaitFrame, jump, makeHorse, stepHorse, type Horse } from "./horse";
import { assertSolvable, cullBehind, hitObstacle, spawnAhead, type Obstacle } from "./obstacles";
import type { Rig } from "../rig/extract";
import type { Rect } from "../engine/aabb";

export type Mode = "title" | "running" | "dead";

export type Snapshot = {
  mode: Mode;
  distance: number;
  hop: number;
  horse: Horse;
  obstacles: Obstacle[];
  score: number;
  pb: number;
  overlay: boolean;
  frame: ReturnType<typeof gaitFrame>;
  screenX: number;
};

assertSolvable();

function loadPb() {
  const n = Number(localStorage.getItem(PB_KEY) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function makeSim(rig: Rig, viewW: () => number) {
  let mode: Mode = "title";
  let distance = 0;
  let prevDistance = 0;
  let prevHop = 0;
  let horse = makeHorse(rig);
  let obstacles: Obstacle[] = [];
  let overlay = false;
  let pb = loadPb();

  const idle = () => {
    distance = 0;
    prevDistance = 0;
    prevHop = 0;
    horse = makeHorse(rig);
    obstacles = [];
  };

  const resetRun = () => {
    idle();
    spawnAhead(obstacles, viewW() + 900);
  };

  const horseRect = (): Rect => ({
    x: distance + HITBOX_OX,
    y: horse.hop + HITBOX_LIFT,
    w: HITBOX_W,
    h: HITBOX_H,
  });

  return {
    action() {
      if (mode === "title") {
        resetRun();
        mode = "running";
        return;
      }
      if (mode === "dead") {
        idle();
        mode = "title";
        return;
      }
      jump(horse);
    },
    toggleOverlay() {
      overlay = !overlay;
    },
    update() {
      if (mode !== "running") return;
      prevDistance = distance;
      prevHop = horse.hop;
      distance += SPEED * DT;
      stepHorse(horse, rig, DT);
      spawnAhead(obstacles, distance + viewW() + 500);
      cullBehind(obstacles, distance - 240);
      if (hitObstacle(obstacles, horseRect())) {
        const s = Math.floor(distance);
        if (s > pb) {
          pb = s;
          localStorage.setItem(PB_KEY, String(pb));
        }
        mode = "dead";
      }
    },
    snapshot(alpha: number): Snapshot {
      const distanceL = prevDistance + (distance - prevDistance) * alpha;
      const hopL = prevHop + (horse.hop - prevHop) * alpha;
      return {
        mode,
        distance: distanceL,
        hop: hopL,
        horse,
        obstacles,
        score: Math.floor(distance),
        pb,
        overlay,
        frame: gaitFrame(horse, rig),
        screenX: viewW() * HORSE_SCREEN_FRAC,
      };
    },
  };
}
