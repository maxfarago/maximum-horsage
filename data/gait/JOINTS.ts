export type JointDef = {
  name: string;
  parent: string | null;
};

export const JOINTS = [
  { name: "root", parent: null },
  { name: "poll", parent: "root" },
  { name: "muzzle", parent: "poll" },
  { name: "withers", parent: "root" },
  { name: "croup", parent: "root" },
  { name: "tail_base", parent: "croup" },
  { name: "tail_tip", parent: "tail_base" },

  { name: "fore_near_shoulder", parent: "withers" },
  { name: "fore_near_elbow", parent: "fore_near_shoulder" },
  { name: "fore_near_knee", parent: "fore_near_elbow" },
  { name: "fore_near_fetlock", parent: "fore_near_knee" },

  { name: "fore_far_shoulder", parent: "withers" },
  { name: "fore_far_elbow", parent: "fore_far_shoulder" },
  { name: "fore_far_knee", parent: "fore_far_elbow" },
  { name: "fore_far_fetlock", parent: "fore_far_knee" },

  { name: "hind_near_hip", parent: "croup" },
  { name: "hind_near_stifle", parent: "hind_near_hip" },
  { name: "hind_near_hock", parent: "hind_near_stifle" },
  { name: "hind_near_fetlock", parent: "hind_near_hock" },

  { name: "hind_far_hip", parent: "croup" },
  { name: "hind_far_stifle", parent: "hind_far_hip" },
  { name: "hind_far_hock", parent: "hind_far_stifle" },
  { name: "hind_far_fetlock", parent: "hind_far_hock" },
] as const satisfies readonly JointDef[];

export const HOOF_LENGTH_RATIO = 0.07;

export const DERIVED_JOINTS = [
  { name: "fore_near_hoof", parent: "fore_near_fetlock", lengthRatio: HOOF_LENGTH_RATIO },
  { name: "fore_far_hoof", parent: "fore_far_fetlock", lengthRatio: HOOF_LENGTH_RATIO },
  { name: "hind_near_hoof", parent: "hind_near_fetlock", lengthRatio: HOOF_LENGTH_RATIO },
  { name: "hind_far_hoof", parent: "hind_far_fetlock", lengthRatio: HOOF_LENGTH_RATIO },
] as const;

export type JointName = (typeof JOINTS)[number]["name"];
export type DerivedName = (typeof DERIVED_JOINTS)[number]["name"];

export const JOINT_COUNT = JOINTS.length;
export const JOINT_NAMES = JOINTS.map((j) => j.name);
