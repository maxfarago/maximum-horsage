# max.horse — V1 Implementation Plan

> A side-scrolling endless runner whose horse is animated from joint data traced off
> Muybridge's 1878 plates. Constant speed, flat ground, jump only, quantized gait,
> Canvas 2D, forward kinematics only. Low-tech by intent.

---

## 0. Thesis and constraints

A game with beautiful animation — not a motion study with a game bolted on. The animation
is the reason to look; the game is the reason to stay.

The gait is not hand-tuned. It is traced from Muybridge plates, reduced to joint angles, and
played back **quantized to the original frame count** so the source is visible in the motion
itself. Muybridge sampled a gallop at N discrete instants; this horse gallops at those same
N instants and no others. That is a stylistic choice, not a performance artifact.

Low-tech rendering is deliberate and it *reduces* risk. With FK and no IK, the horse looks
exactly as good as the traced data — but at low fidelity the eye reads silhouette, contact,
and rhythm rather than anatomy. A stark silhouette with correct gallop timing looks alive.
This also puts the render close to the source: the plates are themselves silhouettes on a grid.

**V1 scope.** One gallop cycle. Constant world speed. Flat ground. Objects as obstacles.
Jump only, ground locked. Collision ends the run with a score. No sound. Static site, no
backend, public repo.

**Explicitly V2+.** Speed ramp and difficulty curve. Duck. Walk/trot/canter and gait
transitions. Hoofbeat audio synced to contact frames. Terrain height variation. Phase-space
bloom visualization. The 1878/2026 fade juxtaposition. WebGL.

---

## 1. The load-bearing risk

FK-only means there is no IK to rescue bad angles and no procedural smoothing to hide them.
If the tracing is sloppy or the joint hierarchy is wrong, the gallop looks broken and the fix
is re-tracing, not tuning code.

Therefore **Phase 0 is the annotation tool and the extraction pipeline, and the gate is a
stick figure galloping convincingly on a blank canvas.** No game loop, no obstacles, no art
until that loop looks right. This is the same structural decision as the eval harness in
glasshouse: build the thing that determines quality first, in isolation, where it is cheap
to iterate.

---

## 2. Source data

**Plate.** One gallop sequence from Muybridge. The 1878 *The Horse in Motion* is the famous
one; the later *Animal Locomotion* plates generally give more complete cycles. Both are
public domain — Library of Congress holds *Horse in Motion*, the University of Pennsylvania
holds *Animal Locomotion*.

*Animal Locomotion* is the better instinct over Sallie Gardner. Treat any specific plate
number in JSON or filenames as a placeholder until verified against the actual Penn scans:
it must be a gallop, it must have a clean cycle, and it must have a usable frame count.
That verification is open item 1, and tracing does not start until it is done.

Pick the plate before tracing and record in `data/gait/PROVENANCE.md`: plate identifier,
source institution, URL, frame count, and which frames form one complete cycle. Frame count
`N` becomes the quantization step for the entire project.

**One caution on cycle boundaries.** Not every plate is exactly one cycle, and some include
partial strides at either end. Choose the sub-range that loops cleanly — the last frame must
flow into the first without a visible pop. Getting this wrong is the most likely cause of a
gallop that looks subtly wrong for reasons you cannot place.

---

## 3. Phase 0 — Annotation tool and rig extraction

### 3.1 Joint model

Side-on view. **All four legs are visible and each is at a different phase**, so the rig has
four legs, not two. This is the single most important structural decision in the skeleton —
a two-leg rig mirrored cannot produce a gallop.

**Frozen.** 23 clicked joints, four derived hooves. Order and parent-child mapping live in
`data/gait/JOINTS.ts` — the single source of truth for the tool, the extractor, and the
renderer. Do not change this file after tracing begins.

Ordered click sequence (index = click order):

```
 0  root                    (base of neck / withers area — reconstruction origin)
 1  poll
 2  muzzle
 3  withers
 4  croup
 5  tail_base
 6  tail_tip

 7  fore_near_shoulder      11  fore_far_shoulder
 8  fore_near_elbow         12  fore_far_elbow
 9  fore_near_knee          13  fore_far_knee
10  fore_near_fetlock       14  fore_far_fetlock

15  hind_near_hip           19  hind_far_hip
16  hind_near_stifle        20  hind_far_stifle
17  hind_near_hock          21  hind_far_hock
18  hind_near_fetlock       22  hind_far_fetlock
```

Hooves are derived, not clicked: a child of each fetlock with a fixed length ratio, angle
continuing the previous segment. Hierarchy (parent → child):

```
root
  poll → muzzle
  withers
    fore_near_shoulder → elbow → knee → fetlock → (hoof)
    fore_far_shoulder  → elbow → knee → fetlock → (hoof)
  croup
    tail_base → tail_tip
    hind_near_hip → stifle → hock → fetlock → (hoof)
    hind_far_hip  → stifle → hock → fetlock → (hoof)
```

Withers and croup are both parented to root, not to each other — torso errors stay isolated
instead of chaining through a spine bone. ~23 × N clicks. At N=12 that is 276 clicks.

### 3.2 Annotation tool (`tools/annotate/`)

Vite page. Imports `JOINTS.ts` so the frozen click order cannot drift from the extractor. No framework.

- Load the full plate image; specify grid rows/cols to auto-slice into frames.
- Display one frame at a time, zoomable.
- Click through the joint list in fixed order; current joint name and index shown large.
- `Backspace` undo last point, `←`/`→` change frame, `S` skip a joint (occluded).
- Overlay the previous frame's points at low opacity — this is what keeps tracing consistent
  across frames and is worth the twenty lines it costs.
- Export `data/gait/annotations.json`.

```jsonc
{
  "plate": "muybridge_animal_locomotion_pl_XXX",
  "frame_count": 12,
  "joint_order": ["root", "poll", ...],
  "frames": [
    { "index": 0, "points": [[x, y], [x, y], null, ...] }  // null = skipped
  ]
}
```

Coordinates in source-image pixels. Do not normalize in the tool — normalization is the
extractor's job and you want the raw clicks preserved.

The tool can be built and exercised against a placeholder plate. Tracing the real plate is
the expensive-to-redo step; it waits on provenance + this frozen joint list.

### 3.3 Extractor (`scripts/extract-rig.ts`)

Raw clicks are noisy: bone lengths will vary frame to frame from annotation error and slight
perspective differences, and playing those back directly makes the horse visibly pulse in
size. The extractor fixes this, and it is the step that makes FK-only viable.

Muybridge's camera panned, so a joint's X within each frame is forward motion minus camera
motion, and neither is recoverable. Do not model it.

1. **Build the bone hierarchy** from `JOINTS.ts` (parent → child).
2. **Median bone length** for each bone across all frames. Median, not mean — it is robust to
   the occasional badly-placed click.
3. **Per-frame joint angle** for each bone, from the clicked positions, relative to parent.
4. **Reconstruct** each frame from the root using fixed median lengths and per-frame angles.
5. **Root X: zero per frame.** The renderer never sees traced world X. World scroll supplies
   all horizontal motion.
6. **Root Y: subtract the mean root Y across the cycle.** Keep the bounce as a deviation;
   drop drift from a camera that wasn't perfectly level. Jump offset stacks on this Y in
   the game, not here.
7. **Interpolate skipped joints** across neighboring frames.
8. **Check the loop**: report the angular delta between frame N-1 and frame 0 per joint. A
   large delta means the chosen cycle range does not close.
9. Emit `data/gait/rig.json`.

```jsonc
{
  "bones": [{ "name": "fore_near_upper", "parent": "fore_near_shoulder", "length": 0.18 }],
  "frames": [{ "rootY": 0.02, "angles": { "fore_near_upper": -1.24, ... } }],
  "contact_frames": [0, 3, 5, 8],   // frames where a hoof is planted — hand-marked
  "landing_frame": 0                 // phase to resume at after a jump
}
```

Lengths normalized to a horse height of 1.0 so render scale is a single multiplier.

**`contact_frames` is hand-marked and matters later** — it is what jump landings snap to in
V1, and what hoofbeat audio syncs to in V2. Mark it while the plate is in front of you.

### 3.4 Playback harness (`src/rig/preview.ts`)

A dev route that renders the reconstructed skeleton as lines on a blank canvas, looping,
with frame index and a scrubber.

**This is the Phase 0 gate.** The stick figure must read as a convincing gallop — hooves
landing in the right order, body not pulsing, loop not popping — before Phase 1 begins. If it
does not, the fix is in the tracing or the cycle range, not in code.

---

## 4. Phase 1 — Game

### 4.1 Loop

Fixed-timestep simulation with an accumulator, decoupled from render, so jump physics are
identical regardless of monitor refresh rate. Simulate at 60Hz; render as often as the
browser allows.

No render interpolation is needed for the horse — the gait is quantized by design — but the
world scroll and the jump arc should interpolate so motion stays smooth.

Canvas backing store matches `devicePixelRatio` and the canvas CSS size tracks the viewport.
This is Phase 1, not an art-pass item — skip it and every intermediate build looks wrong on
a retina screen.

### 4.2 Gait phase and anti-skate

Phase advances with **distance travelled**, not wall time. This is what prevents the horse
from skating, and it is the reason it stays correct for free when V2 adds a speed ramp.

```
phase = (distanceTravelled / STRIDE_LENGTH) mod 1
frameIndex = floor(phase * N)
```

`STRIDE_LENGTH` is tuned by eye until the hooves appear to grip the ground. This is the
single most important visual tuning constant in the project; put it somewhere obvious.

### 4.3 Jump

Ballistic, one input (`Space` / tap), no double jump, no variable height in V1.

```
onJump:  if grounded → vy = -JUMP_IMPULSE; airT = 0
update:  vy += GRAVITY * dt;  y += vy * dt;  airT += dt
onLand:  y = groundY; vy = 0; phase = landing_frame / N
```

Two authored airborne poses. Select by `time-in-air`, not velocity: first ~40% of expected
airtime (`2 * JUMP_IMPULSE / GRAVITY`) is the tuck, remainder is the reach. One transition.
`airT` is monotonic so this cannot flicker at the apex.

Author the two poses by hand in the annotation tool's coordinate space and store them in
`rig.json` alongside the cycle frames.

Snapping phase to `landing_frame` on touchdown is what makes the landing read as a landing —
the horse resumes mid-stride at a foot-plant rather than wherever the cycle happened to be.
A pop at touchdown is the mechanic working, not a data problem. Ship the hard snap. If it is
too aggressive at 12fps quantized, the pocket option is a two-frame blend — not abandoning
the snap.

### 4.4 Obstacles and solvability

Flat ground, discrete objects (fences, hedges, barrels). Constant speed means the jump arc is
a fixed, known distance, so solvability is arithmetic rather than a search:

```
airtime      = 2 * JUMP_IMPULSE / GRAVITY
jumpDistance = SPEED * airtime
```

Two hard constraints on the generator:

- `obstacle.width <= jumpDistance - CLEARANCE_MARGIN` — every obstacle is clearable.
- `gap >= jumpDistance + LANDING_MARGIN + REACTION_DISTANCE` — there is room to land and to
  react before the next one.

`REACTION_DISTANCE = SPEED * 0.4s` is a reasonable starting point for human reaction time
plus decision. Spawn gaps uniformly in `[minGap, maxGap]`.

Assert both constraints in a unit test rather than trusting the constants. An unclearable
obstacle is the one bug that makes the game feel broken rather than hard.

### 4.5 Collision, score, states

AABB. One rect for the horse, tracking body position; one per obstacle. Keep the horse's rect
slightly forgiving — a hitbox that matches the silhouette exactly feels unfair.

Score is distance travelled. States: `title → running → dead`. Death shows the score and a
restart prompt. Persist a personal best in `localStorage`.

---

## 5. Phase 2 — Art pass

Silhouette rendering: solid dark horse, light ground, minimal palette. This is the 1878
visual language and it means V2's plate juxtaposition is between two things that already
match.

Draw order: far legs, body, near legs. At single-color silhouette fidelity the far legs will
merge with the body and vanish — four-leggedness will not read from z-order alone. Anticipate
now that far legs likely need a lighter shade or an outline; that may push off a pure
single-color silhouette, and it is an art-pass decision, not a Phase 0 one.

Render the horse as filled quads or capsules along the bones rather than lines, with hoof and
head shapes hand-tuned. Consider a fixed horizon line and a ground rule as the only scenery,
with obstacles in the same solid black.

**Frame rate stays high even though the art is coarse.** Low-tech means the gait is quantized
and the palette is stark — never that the game is choppy. The game runs at 60fps; only the
gait is stepped.

---

## 6. Repository

```
maximum-horsage/
├── tools/annotate/               Vite page. Imports JOINTS.ts.
├── data/gait/
│   ├── PROVENANCE.md             Plate ID, source, URL, licence, cycle range
│   ├── JOINTS.ts                 Click order + bone hierarchy. Frozen. Single source of truth.
│   ├── plate.png                 Source image (placeholder until plate is chosen)
│   ├── annotations.json          Raw clicks
│   └── rig.json                  Derived. Committed.
├── scripts/extract-rig.ts        annotations.json → rig.json
├── src/
│   ├── main.ts
│   ├── engine/                   loop.ts, input.ts, aabb.ts
│   ├── rig/                      loader.ts, fk.ts, phase.ts, preview.ts
│   ├── game/                     horse.ts, obstacles.ts, world.ts, score.ts, states.ts
│   └── render/                   skeleton.ts, silhouette.ts, scene.ts
└── index.html
```

Vite + TypeScript, no framework. Canvas 2D behind a thin renderer interface so a WebGL
backend is possible in V2 without touching game logic.

`rig.json` is committed — it is the interesting artifact in this repo, it is small, and it is
genuinely reusable by anyone else who wants a Muybridge-derived gallop.

Remote: `https://github.com/maxfarago/maximum-horsage.git` (public).

---

## 7. Build order

**Phase 0 — Rig.** Annotation tool → trace one cycle → extractor → stick-figure preview.
*Gate: a convincing looping gallop as lines on a blank canvas.* Nothing else starts until
this passes. Tracing waits on plate choice; the tool does not.

**Phase 1 — Game.** Fixed-timestep loop, distance-driven phase, scroll, jump with authored
airborne poses, obstacle generator with asserted solvability, AABB collision, score, states,
canvas DPR / viewport resize.
*Done when: playable start to death with the stick-figure horse.*

**Phase 2 — Art.** Silhouette renderer (far / body / near, plus whatever treatment makes far
legs read), ground and horizon, obstacle art, title and death screens, mobile tap input.

**Phase 3 — Ship.** Cloudflare Pages (or Workers Assets) on `max.horse`, static, no backend.
`README` with a short note on the Muybridge source and the quantization choice.

Move `max.horse` nameservers to Cloudflare **now**, not at Phase 3. Propagation plus parked-
page cache can eat a day. An empty zone on Cloudflare NS costs nothing; a ship-day cutover
does.

---

## 8. Tuning constants, in one file

These are the whole feel of the game. Keep them together in `src/config.ts` and expect to
spend real time on them:

```
STRIDE_LENGTH        // anti-skate. tune first, tune longest.
SPEED
JUMP_IMPULSE
GRAVITY
CLEARANCE_MARGIN
LANDING_MARGIN
REACTION_DISTANCE
HORSE_SCALE
```

A dev overlay toggled by a keypress — showing hitboxes, current frame index, phase, ground
contact, and the generator's computed `jumpDistance` — costs almost nothing and pays for
itself during Phase 1 tuning. It is also the thing a technical visitor most wants to see, so
keep it in the shipped build.

---

## 9. Open items

1. Which plate, and its frame count `N`. Verify gallop, clean cycle, usable N against Penn
   scans before tracing. Placeholder numbers in JSON are not a decision.
2. Whether the two airborne poses are traced from a plate or hand-authored.
3. Palette, including the far-leg treatment (lighter shade vs outline vs live with merge).
