export type JointDef = {
  name: string;
  parent: string | null;
  hint: string;
};

export const JOINTS = [
  { name: "root", parent: null, hint: "just under the withers bump, in the neck/shoulder. not the top line, not the belly." },
  { name: "poll", parent: "root", hint: "top of the head, between the ears, on the outline." },
  { name: "muzzle", parent: "poll", hint: "nose / mouth tip, on the outline." },
  { name: "withers", parent: "root", hint: "peak where neck becomes back. on the top line." },
  { name: "croup", parent: "root", hint: "highest point of the rump. on the top line." },
  { name: "tail_base", parent: "croup", hint: "where the tail leaves the rump." },
  { name: "tail_tip", parent: "tail_base", hint: "the visible end of the tail. outline." },

  { name: "fore_near_shoulder", parent: "withers", hint: "center of the camera-side shoulder mass. mid-flesh, not the outline." },
  { name: "fore_near_elbow", parent: "fore_near_shoulder", hint: "camera-side front elbow. mid-limb, the rear corner of the upper leg." },
  { name: "fore_near_knee", parent: "fore_near_elbow", hint: "camera-side front knee (carpus). mid-limb." },
  { name: "fore_near_fetlock", parent: "fore_near_knee", hint: "camera-side front fetlock — the ankle just above the hoof. not the hoof." },

  { name: "fore_far_shoulder", parent: "withers", hint: "same as near shoulder, far side of the body. skip if hidden." },
  { name: "fore_far_elbow", parent: "fore_far_shoulder", hint: "far-side front elbow. mid-limb. skip if hidden." },
  { name: "fore_far_knee", parent: "fore_far_elbow", hint: "far-side front knee. mid-limb. skip if hidden." },
  { name: "fore_far_fetlock", parent: "fore_far_knee", hint: "far-side front fetlock. mid-limb, not the hoof. skip if hidden." },

  { name: "hind_near_hip", parent: "croup", hint: "camera-side hip joint, in the rump, below the croup. not the outline." },
  { name: "hind_near_stifle", parent: "hind_near_hip", hint: "camera-side stifle — the true hind knee, mid-thigh." },
  { name: "hind_near_hock", parent: "hind_near_stifle", hint: "camera-side hock — the pointy hind joint. mid-limb." },
  { name: "hind_near_fetlock", parent: "hind_near_hock", hint: "camera-side hind fetlock. mid-limb, not the hoof." },

  { name: "hind_far_hip", parent: "croup", hint: "far-side hip, in the rump. skip if hidden." },
  { name: "hind_far_stifle", parent: "hind_far_hip", hint: "far-side stifle. mid-limb. skip if hidden." },
  { name: "hind_far_hock", parent: "hind_far_stifle", hint: "far-side hock. mid-limb. skip if hidden." },
  { name: "hind_far_fetlock", parent: "hind_far_hock", hint: "far-side hind fetlock. not the hoof. skip if hidden." },
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
