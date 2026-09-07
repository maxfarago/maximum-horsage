export const DT = 1 / 60;

export const SPEED = 320;
export const JUMP_IMPULSE = 560;
export const GRAVITY = 1600;
export const STRIDE_LENGTH = 280;
export const HORSE_SCALE = 150;
export const HORSE_SCREEN_FRAC = 0.28;

export const CLEARANCE_MARGIN = 40;
export const LANDING_MARGIN = 50;
export const REACTION_TIME = 0.4;
export const MAX_GAP_SCALE = 2.4;
export const HEIGHT_MARGIN = 16;
export const OBSTACLE_MIN_W = 28;
export const OBSTACLE_MIN_H = 36;

export const HITBOX_W = 72;
export const HITBOX_H = 58;
export const HITBOX_OX = -18;
export const HITBOX_LIFT = 10;

export const GROUND_FRAC = 0.78;
export const AIR_TUCK_FRAC = 0.4;
export const PB_KEY = "maxhorse.pb";
export const OVERLAY_KEY = "d";

export function jumpStats() {
  const airtime = (2 * JUMP_IMPULSE) / GRAVITY;
  const jumpDistance = SPEED * airtime;
  const jumpHeight = (JUMP_IMPULSE * JUMP_IMPULSE) / (2 * GRAVITY);
  const reaction = SPEED * REACTION_TIME;
  const maxWidth = jumpDistance - CLEARANCE_MARGIN;
  const maxHeight = jumpHeight - HEIGHT_MARGIN;
  const minGap = jumpDistance + LANDING_MARGIN + reaction;
  const maxGap = minGap * MAX_GAP_SCALE;
  return { airtime, jumpDistance, jumpHeight, reaction, maxWidth, maxHeight, minGap, maxGap };
}
