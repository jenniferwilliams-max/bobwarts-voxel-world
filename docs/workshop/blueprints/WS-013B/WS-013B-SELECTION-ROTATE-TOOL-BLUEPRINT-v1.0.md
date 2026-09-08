# WS-013B — Selection Rotate Tool Blueprint v1.0

Status: Approved design blueprint; application implementation requires separate authorization

Baseline: `codex/workshop` at `dbe074b`

## 1. Purpose

Define the next bounded Workshop editing operation after WS-013A Move: rotate the current authoritative selection clockwise by exactly 90 degrees around the world Y axis.

Rotate is a discrete, immediate, atomic command. It does not own the canvas, show a geometric preview, enter a pending mode, or introduce free-angle manipulation.

## 2. Approved product contract

- Workshop only. Builder selection, movement, controls, and camera behavior remain unchanged.
- One native **Rotate Right 90°** control with a minimum 44 by 44 CSS-pixel target.
- Each accepted activation applies one clockwise positive 90-degree Y-axis rotation.
- The pivot is the aggregate selected bounds center projected onto X/Z.
- The authoritative Workshop selection rotates as one rigid composition, including connected and disconnected composed selections.
- Every selected member keeps its exact Y position.
- Selection remains authoritative and visibly selected after Rotate, Undo, and Redo.
- Existing active-workspace and collision policies validate the complete candidate before mutation.
- A rejected candidate changes no transform, selection, measurement, or history state.
- A successful command records exactly one chronological `ROTATE` transaction.
- Transform no-ops are rejected and create no history record.
- Rotate adds no preview, Cancel state, free-angle input, keyboard shortcut, vertical lift, grouping, or hierarchy behavior.
- Save and autosave schemas remain unchanged.

## 3. Existing authorities

Rotate must consume, not replace:

- `selectedBlocks` as the authoritative Workshop selection.
- Existing contact-graph selection and composed-selection membership.
- Existing active-workspace bounds.
- Existing overlap/collision policy and epsilon.
- Existing Three.js object positions, Y rotations, geometry, and world bounds.
- Existing ruler and Measurement Assistant synchronization from settled selected geometry.
- Existing chronological Workshop edit history.
- Existing lifecycle reset, shutdown, fault, and Mission restoration owners.
- Existing save/load and autosave `rotationY` fields.

The current history foundation stores positions only. WS-013B requires a bounded transform-snapshot extension; it does not authorize a second history ledger.

## 4. Explicit non-ownership

Rotate does not own or alter:

- Builder object editing.
- Camera orbit, arrow-key camera rotation, wheel zoom, View Dice, View Remote, Home, Fit, or directional views.
- Placement, Move translation, snapping, raycasting, or pointer intent.
- Grid geometry, origin, rulers, active-workspace expansion, or visible-range calculations.
- Measurement calculations, Smart Board applications, Learning Mode, or Notebook.
- Tool Chest, drawers, Parts & Objects, Shapes, Colors, or Favorites.
- Object scale, geometry identity, material, color, grouping, parentage, or save version.

The words “Rotate Left” and “Rotate Right” in current keyboard handling refer to camera rotation and remain camera-only.

## 5. Interaction flow

1. The student creates or retains a valid Workshop selection.
2. Rotate Right is enabled only when the authoritative selection can be inspected safely.
3. The student activates the native button with pointer, touch, Enter, or Space.
4. Rotate snapshots the exact selected members and their current transforms.
5. Rotate calculates one shared pivot and a complete candidate transform set.
6. Rotate rejects a transform no-op.
7. Rotate validates all candidate bounds and collisions without mutating live objects.
8. On success, Rotate applies every candidate transform as one operation.
9. Rotate records exactly one `ROTATE` transaction.
10. Existing selection, ruler, measurement, feedback, Undo, and Redo presentation synchronizes from settled geometry.

There is no armed state. Repeated activations are distinct intentional quarter-turn operations, while duplicate handling of one activation must remain idempotent.

## 6. Rotation mathematics

Let the aggregate selection bounds center be `(pivotX, pivotZ)`. For each selected object with position `(x, y, z)`, a clockwise positive quarter turn uses one project-consistent convention that must be locked in focused tests. The implementation must produce the equivalent rigid transform:

```text
relativeX = x - pivotX
relativeZ = z - pivotZ
nextX = pivotX - relativeZ
nextZ = pivotZ + relativeX
nextY = y
nextRotationY = normalize(rotationY + PI / 2)
```

If the existing renderer’s visible clockwise convention requires the algebraic inverse, the implementation must stop for inspection rather than silently changing the approved direction label. Tests must bind the visible direction to the selected formula.

Requirements:

- Calculate from one immutable pre-rotation snapshot.
- Never update one member and then use its new transform to calculate another.
- Preserve exact rigid relationships within normal floating-point tolerance.
- Normalize Y rotation deterministically without migrating saved positions.
- Do not snap or independently round member positions.
- Do not change X/Z lattice phase merely because Rotate ran.
- Do not alter Y position or X/Z rotation.

## 7. Candidate validation order

Validation must complete before live mutation in this order:

1. Confirm Workshop is active and lifecycle-ready.
2. Sanitize and snapshot the authoritative selection.
3. Require at least one live selected object.
4. Confirm every object exposes finite position and Y rotation values.
5. Calculate the aggregate world-bounds X/Z center.
6. Calculate every candidate position and Y rotation from the same snapshot.
7. Reject an exact transform no-op across the complete selection.
8. Calculate complete candidate world bounds without attaching duplicate student meshes to the scene.
9. Require every candidate bound to fit the authoritative active workspace.
10. Apply the existing collision policy between candidate selected objects and nonselected live objects.
11. Require the edit-history owner to accept one complete transaction.
12. Mutate all members, record once, synchronize presentation, and settle.

If candidate-bound calculation cannot be performed without changing authoritative geometry, implementation must stop for inspection. Temporary calculation state must not render, raycast, receive focus, enter `blocks`, or escape cleanup.

## 8. Collision and selection rules

- The selected set is excluded from external collision rejection while its complete rigid candidate is evaluated.
- Relative geometry within the selected set remains authoritative; Rotate does not recompose or split it.
- Existing touching-versus-overlap epsilon remains authoritative.
- A collision or boundary rejection applies to the complete selection and changes nothing.
- Connected and disconnected composed selections use the same aggregate pivot.
- Selection membership remains exactly the pre-rotation authoritative membership after success and history operations.
- Existing contact-graph behavior for a later new selection remains unchanged.

## 9. Transform-aware history model

Add `ROTATE` to the existing Workshop operation types. Do not create another ledger or schema.

Each Rotate entry must contain:

- Stable object identity.
- Exact before position `{x, y, z}`.
- Exact after position `{x, y, z}`.
- Exact before `rotationY`.
- Exact after `rotationY`.

The transaction must also retain:

- Operation type `ROTATE`.
- The immutable authoritative selection context.
- The shared pivot `{x, z}`.
- The signed quarter-turn angle.

History requirements:

- One accepted button activation creates exactly one transaction.
- Invalid and no-op rotations create no transaction.
- Undo validates every live object at the exact after transform, then atomically restores all before transforms.
- Redo validates every live object at the exact before transform, then atomically restores all after transforms.
- A missing, detached, or unexpectedly changed object fails closed without partial application or stack movement.
- A new committed edit clears the incompatible Redo branch under the existing policy.
- Placement, Deletion, Move, and Rotate remain in one chronological ledger.
- Transaction objects and nested transform snapshots remain deeply immutable.
- Failure while applying restores every object and the prior authoritative selection.

The transform extension must remain backward-compatible with position-only Placement, Deletion, and Move entries. Move behavior and its exact history semantics must not change.

## 10. No-op policy

A command is a no-op only when every selected object’s candidate position and normalized `rotationY` equal its before transform under the approved exact comparison policy.

- A composed arrangement whose positions change is not a no-op even if individual geometry is rotationally symmetric.
- A single symmetric object may still have a changed persisted `rotationY`; whether that is materially unchanged must be decided by the implementation’s canonical transform comparison and locked in tests.
- The implementation must not infer geometric symmetry with a new shape taxonomy.
- If reliable no-op detection requires a new geometry authority, stop for inspection.

Recommended bounded interpretation: compare canonical stored transforms, not visual appearance. A changed canonical `rotationY` is therefore an edit; only an identical canonical transform is rejected.

## 11. UI and accessibility

- Replace only the disabled Workshop Rotate placeholder with one native button.
- Visible label: `Rotate Right` or `Rotate Right 90°`, subject to physical fit while retaining an accessible name that includes 90 degrees.
- Minimum target: 44 by 44 CSS pixels at supported Chromebook sizes.
- Disable the button for empty, invalid, unavailable, or lifecycle-inactive selections.
- Use native mouse, touch, Enter, and Space activation without duplicate key/click commits.
- Expose disabled and busy state with native and appropriate ARIA state.
- Do not use `aria-pressed`; Rotate is an immediate command, not a persistent mode.
- Announce success and rejection politely and atomically.
- Do not announce camera movement, selection measurement updates, or repeated render frames.
- Do not depend on hover, color, animation, or audio.
- Preserve focus on the connected enabled Rotate control after success or rejection.

Recommended messages:

- `Select an object before rotating it.`
- `Selection rotated right 90 degrees.`
- `Rotate blocked. Keep the complete selection inside the visible workspace.`
- `Rotate blocked. The selection would overlap another object.`
- `Rotation did not change the selection.`
- `Rotation undone.`
- `Rotation restored.`

Messages are presentation only and never determine geometry or history.

## 12. Lifecycle and incompatible commands

Because Rotate is synchronous and immediate, it must not leave pending ownership. Reset, Mission restoration, shutdown, and fault still invalidate history and selection through existing owners.

- If Move is armed, activating Rotate first cancels Move without geometry mutation, then evaluates Rotate.
- Selection, Delete, Build-shape, Undo, and Redo keep their existing ownership.
- Rotate must not cancel or modify camera state.
- Rotate must not register canvas pointer, pointer-move, raycast, wheel, or keyboard listeners.
- Reduced motion changes no Rotate semantics because no animation is authorized.

## 13. Save and compatibility

- Download save remains version 3.
- Autosave remains version 1.
- Existing `rotationY` serialization and restoration remain authoritative.
- No new required block field or migration is authorized.
- Loaded integer, half-integer, and fractional positions remain untouched until a valid Rotate commit.
- Screenshots consume settled rendered geometry and require no Rotate-specific schema.

## 14. Automated test requirements

### Pure transform calculation

- Clockwise/right convention for a known asymmetric arrangement.
- Single object and connected/composed selections.
- Aggregate bounds-center pivot.
- Exact unchanged Y values.
- Preserved rigid distances and relative geometry.
- Existing integer, half-integer, and fractional coordinates.
- Deterministic normalized `rotationY` over four quarter turns.
- Complete no-op detection.

### Validation and atomicity

- Empty, detached, invalid, and stale selection rejection.
- Complete active-workspace acceptance and rejection at all edges.
- Existing collision acceptance, touching, and overlap rejection.
- Zero live mutation before all validation completes.
- Zero partial mutation on calculation, validation, history, or apply failure.
- No duplicate scene meshes, `blocks` entries, events, or callbacks.

### History

- One Rotate equals one immutable `ROTATE` transaction.
- Exact transform Undo and Redo for every selected member.
- Chronological interleaving with Placement, Deletion, and Move.
- Invalid and no-op commands create no history.
- Missing-object and unexpected-transform failures preserve geometry and both stacks.
- Selection context is restored exactly.
- Existing Move and position-only transaction tests remain unchanged and passing.

### Input, UI, and compatibility

- Native mouse, touch, Enter, and Space parity with one commit per activation.
- Rotate button disabled/enabled/busy and accessible-name presentation.
- Minimum 44px target at supported Chromebook widths.
- Camera arrow keys, orbit, View controls, wheel, and raycasting remain unchanged.
- Ruler, Measurement Assistant, CAD feedback, Tool Chest, and dashboard containment remain unchanged.
- Save/load and autosave preserve `rotationY` with unchanged versions.
- Mission restoration, reset, shutdown, fault, screenshots, and reduced motion remain unchanged.
- Focused Rotate tests, all Workshop tests, inline JavaScript validation, and `git diff --check` pass.

## 15. Physical Chromebook acceptance

At 1204 by 695 CSS pixels and DPR 1.25, verify explicitly:

1. Rotate Right is completely visible and at least 44 by 44 CSS pixels.
2. Mouse, touch, Enter, and Space each perform exactly one quarter turn.
3. A known asymmetric object visibly rotates clockwise/right.
4. A connected structure rotates rigidly without distortion.
5. A disconnected composed selection rotates around one aggregate pivot and remains selected.
6. Every member retains its exact Y position.
7. Valid edge-adjacent rotations commit only when the complete candidate fits.
8. Outside-workspace and collision candidates are rejected without transform changes.
9. Rejected and no-op commands create no Undo history.
10. Successful Rotate creates exactly one transaction.
11. Undo restores exact original positions and Y rotations.
12. Redo restores exact rotated positions and Y rotations.
13. Four accepted quarter turns restore the canonical starting transforms within the locked comparison policy.
14. Move cancels safely before Rotate without changing geometry.
15. Camera orbit, arrow keys, View controls, Grid, rulers, Measurement Assistant, Tool Chest, and dashboard remain correct and unclipped.
16. Save/load and autosave restore the settled rotation without schema changes.

## 16. Stop conditions

Stop and return to inspection if:

- Visible clockwise direction conflicts with the approved mathematical convention.
- A second selection, history, collision, snapping, camera, measurement, or save authority is required.
- Candidate validation requires visible duplicate student geometry or changes authoritative objects before validation completes.
- Selection members require different angles or pivots.
- Rotation changes Y, scale, geometry identity, material, parentage, or selection membership.
- A failure can partially rotate or partially restore a selection.
- Existing Placement, Delete, Move, Undo, Redo, camera, Grid, ruler, Measurement Assistant, Tool Chest, or save behavior must change beyond the explicitly approved transform-history extension.
- Application implementation requires files outside the proposed scope.
- Any reserved editing feature becomes necessary.

## 17. Proposed implementation scope

Application implementation, if separately authorized, should be limited to:

- `index.html`
- `js/workshop/editing/workshop-edit-history.mjs`
- One focused Rotate transform/controller module under `js/workshop/editing/`
- Focused WS-013B Rotate and history tests under `tests/workshop/`

This blueprint does not authorize application or test changes. It authorizes only design documentation at:

`docs/workshop/blueprints/WS-013B/WS-013B-SELECTION-ROTATE-TOOL-BLUEPRINT-v1.0.md`

## 18. Definition of ready

WS-013B is ready for implementation inspection only when:

- This blueprint is reviewed and accepted.
- The visible clockwise convention is confirmed with the current camera/world coordinate system.
- Transform-aware history compatibility is verified against existing position-only transactions.
- Exact candidate-bound calculation can be implemented without a new rendering or collision authority.
- Exact application file and focused-test scope is approved.
- Physical Chromebook verification remains a required closure gate.
