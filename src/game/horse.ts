import { AIR_TUCK_FRAC, GRAVITY, JUMP_IMPULSE, SPEED, STRIDE_LENGTH, jumpStats } from "../config";
import type { Rig } from "../rig/extract";

export type Horse = {
  hop: number;
  vy: number;
  airT: number;
  grounded: boolean;
  phase: number;
};

export function makeHorse(rig: Rig): Horse {
  return {
    hop: 0,
    vy: 0,
    airT: 0,
    grounded: true,
    phase: rig.landing_frame / rig.n,
  };
}

export function jump(h: Horse) {
  if (!h.grounded) return;
  h.grounded = false;
  h.vy = JUMP_IMPULSE;
  h.airT = 0;
}

export function stepHorse(h: Horse, rig: Rig, dt: number) {
  if (h.grounded) {
    h.phase = (h.phase + (SPEED * dt) / STRIDE_LENGTH) % 1;
    return;
  }
  h.vy -= GRAVITY * dt;
  h.hop += h.vy * dt;
  h.airT += dt;
  if (h.hop <= 0) {
    h.hop = 0;
    h.vy = 0;
    h.grounded = true;
    h.airT = 0;
    h.phase = rig.landing_frame / rig.n;
  }
}

export function gaitFrame(h: Horse, rig: Rig) {
  if (h.grounded) return rig.frames[Math.min(rig.n - 1, Math.floor(h.phase * rig.n))]!;
  const tuckUntil = jumpStats().airtime * AIR_TUCK_FRAC;
  return h.airT < tuckUntil ? rig.frames[0]! : rig.frames[Math.floor(rig.n / 2)]!;
}
