# WS-013C — Selection Resize Tool Blueprint v1.0

Status: Approved design blueprint; application implementation requires separate authorization

Baseline: `codex/workshop` at `0b52b8c`

## 1. Purpose

Define the bounded Workshop Resize milestone after WS-013A Move and WS-013B Rotate. Resize changes all three local dimensions of one eligible selected box by one centimeter while preserving its horizontal center and world-space bottom elevation.

Resize is an immediate, discrete, validated, atomic command. It does not introduce handles, a preview, a pending mode, numeric entry, or general-purpose geometry editing.

## 2. Approved product contract

- Workshop only. Builder selection, controls, movement, and camera behavior remain unchanged.
- Exactly one live selected object is required.
- The selected object must use supported `BoxGeometry` with finite positive width, height, and depth parameters.
- Two native controls are provided: **Grow +1cm** and **Shrink -1cm**.
- Each control has a minimum 44 by 44 CSS-pixel touch target.
- Each accepted activation changes local width, height, and depth uniformly by exactly one centimeter.
- The minimum permitted local dimension is one centimeter.
- The step remains one centimeter in both CM and MM display modes; display units do not change model-space semantics.
- X/Z center, Y rotation, scale, material, parentage, and world-space bottom elevation remain unchanged.
- The authoritative selection remains selected after Resize, Undo, and Redo.
- Candidate geometry and bounds are calculated off-scene.
- Existing active-workspace and collision policies validate the complete candidate before live mutation.
- A rejected candidate changes no position, dimension, geometry, selection, or history state.
- A successful command records exactly one prepared atomic `RESIZE` transaction with exact position and dimension snapshots.
- Save and autosave schema versions and fields remain unchanged.

## 3. Eligibility

Resize is enabled only when the authoritative Workshop selection contains exactly one eligible live object.

An eligible object must:

- Still belong to the authoritative live Workshop object collection.
- Be attached to the expected scene ownership path.
- Have `BoxGeometry` whose parameters expose finite positive `width`, `height`, and `depth`.
- Have finite position, Y rotation, and scale components required for bounds calculation.
- Have a finite positive Y scale so its bottom anchor can be preserved deterministically.
- Be safe to replace with a newly constructed equivalent box geometry.

Multi-selection, composed selection, spheres, wedges, custom geometry, buffer geometry without authoritative box parameters, and malformed or stale objects are ineligible. Ineligibility is a closed rejection, not an attempt to infer or convert shape data.

## 4. Existing authorities

Resize must consume, not replace:

- `selectedBlocks` as the authoritative Workshop selection.
- Existing live-object identity and scene ownership.
- Existing `BoxGeometry` parameters as authoritative local dimensions.
- Existing active-workspace bounds.
- Existing overlap/collision policy and epsilon.
- Existing Three.js transforms, scale, material, parentage, and world bounds.
- Existing ruler and Measurement Assistant synchronization from settled geometry.
- The prepared transaction contract in the Workshop edit-history owner.
- Existing lifecycle reset, shutdown, fault, and Mission restoration owners.
- Existing save/load and autosave dimension serialization.

WS-013C extends the existing chronological history ledger with dimension snapshots. It does not authorize a second ledger or a second geometry authority.

## 5. Explicit non-ownership

Resize does not own or alter:

- Builder object editing or Builder movement.
- Camera orbit, keyboard camera rotation, wheel zoom, View Dice, View Remote, Home, Fit, or directional views.
- Selection composition, Move translation, Rotate transforms, placement, snapping, raycasting, or pointer intent.
- Grid geometry, origin, rulers, active-workspace expansion, or visible-range calculations.
- Measurement formulas, Smart Board applications, Learning Mode, or Notebook.
- Tool Chest, drawers, Parts & Objects, Shapes, Colors, or Favorites.
- Object rotation, scale, material, color, grouping, parentage, or save version.
- The current bottom-dashboard visual design, height, column allocation, tab visibility, Quick Access visibility, or responsive repairs.

Any kid-friendly bottom-dashboard redesign is a separate future milestone and is outside WS-013C.

## 6. Interaction flow

1. The student retains exactly one eligible selected box.
2. Grow and Shrink reflect eligibility; Shrink also reflects the one-centimeter minimum.
3. The student activates one native control with pointer, touch, Enter, or Space.
4. Resize snapshots exact identity, position, dimensions, rotation, scale, material, and parentage.
5. Resize calculates candidate dimensions and the bottom-anchored candidate Y position.
6. Resize constructs or evaluates candidate box geometry off-scene.
7. Resize rejects dimension no-ops, invalid values, workspace violations, and collisions before mutation.
8. Resize asks history to prepare the complete `RESIZE` operation against exact before state.
9. Resize replaces live geometry and Y position atomically, then settles the prepared transaction against exact after state.
10. Existing selection, ruler, measurement, feedback, Undo, and Redo presentation synchronizes from settled geometry.

There is no armed state. Each accepted activation is one independent one-centimeter edit. Native input handling must not produce duplicate commits from one activation.

## 7. Dimension and bottom-anchor mathematics

Let the authoritative local dimensions be:

```text
beforeWidth
beforeHeight
beforeDepth
```

For Grow, `delta = +1`. For Shrink, `delta = -1`. Candidate local dimensions are:

```text
afterWidth = beforeWidth + delta
afterHeight = beforeHeight + delta
afterDepth = beforeDepth + delta
```

All dimensions use the Workshop model's centimeter basis. A candidate is invalid if any result is non-finite or less than one centimeter.

X and Z positions remain exact. With unchanged finite positive local `scaleY`, preserve the world-space bottom elevation by using:

```text
beforeBottomY = beforePositionY - (beforeHeight * scaleY) / 2
afterPositionY = beforeBottomY + (afterHeight * scaleY) / 2
afterPositionX = beforePositionX
afterPositionZ = beforePositionZ
```

Equivalent delta form:

```text
afterPositionY = beforePositionY + ((afterHeight - beforeHeight) * scaleY) / 2
```

Requirements:

- Calculate exclusively from one immutable pre-resize snapshot.
- Preserve exact X/Z center, rotation, scale, material, and parentage.
- Preserve exact world-space bottom elevation within established floating-point tolerance.
- Do not snap, round, translate horizontally, or alter lattice phase.
- Do not reinterpret the step when the display changes between CM and MM.
- Reject rather than approximate unsupported transforms or geometry.

## 8. Off-scene candidate bounds

Candidate validation must not mutate or attach the live object.

The bounded approach is:

1. Construct a candidate `BoxGeometry` from the three candidate local dimensions, or construct its equivalent local bounding box.
2. Compose an off-scene matrix from candidate position, unchanged rotation, and unchanged scale.
3. Apply that matrix to a cloned or temporary local bounding box.
4. Use the resulting world-space box for active-workspace and collision validation.

Temporary geometry or bounds:

- Must never enter the scene or authoritative live-object collection.
- Must never render, raycast, receive selection, or emit object events.
- Must be disposed or released on every success and failure path.
- Must not replace the live geometry until all validation and history preparation succeed.

If exact candidate bounds cannot be calculated without mutating authoritative geometry, implementation must stop for inspection.

## 9. Validation order

Validation and preparation must complete before live mutation in this order:

1. Confirm Workshop is active and lifecycle-ready.
2. Sanitize the authoritative selection and require exactly one live object.
3. Confirm supported `BoxGeometry` and finite positive authoritative dimensions.
4. Confirm finite required transforms and supported positive Y scale.
5. Calculate candidate dimensions for the requested one-centimeter step.
6. Reject any dimension below one centimeter, invalid numeric result, or exact transform-and-dimension no-op.
7. Calculate the bottom-anchored candidate position.
8. Calculate candidate world bounds off-scene.
9. Require the complete candidate bounds to fit the authoritative active workspace.
10. Apply the existing collision policy against other live objects.
11. Prepare one complete `RESIZE` operation against exact before position and dimensions.
12. Replace geometry and position as one browser-owned atomic mutation.
13. Settle the prepared transaction against exact after position and dimensions.
14. Synchronize presentation only after successful settlement.

No rejection before step 12 may change live geometry. A failure at or after mutation must execute browser-owned atomic rollback and leave history stacks unchanged.

## 10. Collision and selection rules

- The selected object is excluded from collision testing against itself.
- Existing touching-versus-overlap epsilon remains authoritative.
- Candidate size and bottom-anchored position are evaluated together.
- A collision or boundary rejection changes nothing and creates no history.
- Selection membership remains exactly the same after success, rejection, Undo, and Redo.
- Existing contact-graph behavior for a later new selection remains unchanged.
- Resize does not compose nearby objects or grow a connected selection.

## 11. Geometry lifecycle and atomic rollback

Geometry replacement must be transactional even though Three.js geometry identity itself is not persisted in the save schema.

Before mutation, retain:

- The original live geometry reference.
- Exact before dimensions and position.
- The prepared history token.
- Any candidate geometry needed for settlement.

On successful prepared settlement:

- The candidate geometry becomes authoritative.
- The original geometry is disposed only after settlement succeeds.
- Temporary unused geometry is disposed.
- Exactly one history transaction and one transaction ID are consumed.

On apply or settlement failure:

- Restore the original geometry reference and exact position.
- Dispose the failed candidate geometry.
- Cancel the valid prepared token when cancellation remains permitted.
- Restore selection and presentation to the exact before state.
- Consume no history transaction, Redo change, or transaction ID.

Undo and Redo recreate or apply exact box dimensions and positions atomically. Superseded geometry is disposed only after every validation and application step succeeds. Partial geometry replacement is forbidden.

## 12. Prepared RESIZE history model

Add `RESIZE` to the existing Workshop operation types and extend existing entries backward-compatibly. Do not create another ledger or alter direct commit behavior for Placement, Deletion, Move, or Rotate.

Each Resize entry must contain:

- Stable object identity.
- Exact before position `{x, y, z}`.
- Exact after position `{x, y, z}`.
- Exact before dimensions `{width, height, depth}`.
- Exact after dimensions `{width, height, depth}`.

The transaction must also retain the immutable authoritative selection context and operation type `RESIZE`.

Preparation requirements:

- `prepare(operation)` validates exact live before transforms and dimensions.
- Preparation changes no Undo stack, Redo stack, geometry, selection, or `nextId`.
- Competing history operations receive the existing approved `BUSY` response while a token is outstanding.
- `commitPrepared(token)` validates the token and exact live after transforms and dimensions.
- Only successful settlement appends one transaction, clears Redo under existing policy, and consumes one ID.
- `cancelPrepared(token)` is token-guarded and creates no ID gap.
- Reset invalidates an outstanding token.
- Browser-owned rollback restores exact before geometry if settlement fails.

History requirements:

- Grow or Shrink creates exactly one chronological immutable `RESIZE` transaction.
- Invalid, unsupported, blocked, and no-op commands create no transaction.
- Undo validates exact after state, then atomically restores before position and dimensions.
- Redo validates exact before state, then atomically restores after position and dimensions.
- Missing, detached, or unexpectedly changed objects fail closed without partial application or stack movement.
- Placement, Deletion, Move, Rotate, and Resize remain in one ledger.
- Position-only and transform-aware historical entries remain valid and unchanged.

## 13. No-op and minimum policy

A Resize command is a no-op only when the complete canonical candidate position and dimensions equal the before snapshot under the established exact comparison policy.

- Shrink is unavailable or rejected when any resulting local dimension would be below one centimeter.
- A dimension exactly equal to one centimeter is valid.
- Grow is not accepted if numeric overflow or an unchanged numeric result occurs.
- Display formatting and unit-label rounding never determine eligibility or history equality.
- Resize must not infer visual equivalence from material, scale, or camera view.

## 14. UI and accessibility

- Replace only the bounded Workshop Resize placeholder area with native Grow and Shrink buttons.
- Visible labels communicate `Grow +1cm` and `Shrink -1cm`; accessible names must include the direction and one-centimeter step.
- Each target is at least 44 by 44 CSS pixels at supported Chromebook sizes.
- Controls disable for empty, multi-object, unsupported, unavailable, stale, or lifecycle-inactive selection.
- Shrink disables when the next result would violate the one-centimeter minimum.
- Use native mouse, touch, Enter, and Space activation without duplicate key/click commits.
- Expose disabled and busy state with native and appropriate ARIA state.
- Do not use `aria-pressed`; both controls are immediate commands.
- Announce success and rejection politely and atomically.
- Do not depend on hover, color, animation, or audio.
- Preserve focus on the connected control after success or rejection when it remains enabled.
- Preserve the dashboard's current appearance, 148-pixel height, responsive column allocation, all tabs, all Quick Access controls, and lack of horizontal scrolling.

Recommended messages:

- `Select one box before resizing.`
- `Box grown by 1 centimeter.`
- `Box shrunk by 1 centimeter.`
- `Resize blocked. Box dimensions cannot be smaller than 1 centimeter.`
- `Resize blocked. Keep the box inside the visible workspace.`
- `Resize blocked. The box would overlap another object.`
- `This object cannot be resized with these controls.`
- `Resize undone.`
- `Resize restored.`

Messages are presentation only and never determine geometry or history.

## 15. Lifecycle and incompatible commands

Resize is synchronous and immediate and must not leave pending canvas ownership.

- If Move is armed, activating Resize first cancels Move without geometry mutation, then evaluates Resize.
- Rotate, selection, Delete, Build-shape, Undo, and Redo retain their existing ownership.
- Reset, Mission restoration, shutdown, and fault invalidate prepared history through existing owners.
- Resize must not cancel or modify camera state.
- Resize must not register canvas pointer, pointer-move, raycast, wheel, or global keyboard listeners.
- Reduced motion changes no semantics because no animation is authorized.

## 16. Save and compatibility

- Download save remains version 3.
- Autosave remains version 1.
- Existing box dimension serialization and restoration remain authoritative.
- No new required block field, geometry identifier, or migration is authorized.
- Existing rotation and scale serialization remain unchanged.
- Loaded integer and fractional dimensions remain exact until a valid Resize commit.
- Screenshots consume settled rendered geometry and require no Resize-specific schema.

## 17. Automated test requirements

### Pure resize calculation

- Grow adds exactly one centimeter to width, height, and depth.
- Shrink subtracts exactly one centimeter from all three dimensions.
- Exact one-centimeter minimum acceptance and below-minimum rejection.
- Exact X/Z preservation and bottom-elevation preservation.
- Unchanged rotation, scale, material, and parentage.
- Identical semantics in CM and MM display modes.
- Integer and fractional starting dimensions.
- Invalid, non-finite, unsupported, and no-op rejection.

### Eligibility, bounds, and atomicity

- Exactly one eligible live BoxGeometry selection.
- Empty, multi-object, sphere, wedge, custom, detached, malformed, and stale rejection.
- Candidate bounds calculated off-scene without live mutation.
- Complete active-workspace acceptance and rejection at all edges.
- Existing collision touching acceptance and overlap rejection.
- Zero mutation before validation and preparation complete.
- Exact rollback on geometry creation, apply, or history settlement failure.
- Correct disposal with no duplicate scene meshes, live-object entries, events, or callbacks.

### Prepared history

- Prepare validates exact before position and dimensions.
- Preparation changes no stacks, Redo, geometry, or `nextId`.
- Competing operations return `BUSY`.
- Settlement validates exact after position and dimensions.
- Successful settlement creates one immutable `RESIZE` transaction and one ID.
- Cancellation and reset invalidation create no ID gap.
- Exact dimension-and-position Undo and Redo.
- Missing-object and unexpected-state failures preserve geometry and both stacks.
- Chronological interleaving with Placement, Deletion, Move, and Rotate.
- Existing direct commit and prepared Rotate behavior remain unchanged.

### Input, UI, and compatibility

- Native mouse, touch, Enter, and Space parity with one commit per activation.
- Grow and Shrink disabled/enabled/busy state and accessible names.
- Minimum 44px targets at supported Chromebook widths.
- Current dashboard appearance, 148px height, tabs, Quick Access controls, and no horizontal scrolling remain unchanged.
- Camera, orbit, View controls, Grid, rulers, raycasting, placement, Move, and Rotate remain unchanged.
- Measurement Assistant and Tool Chest containment remain unchanged.
- Save/load and autosave preserve resized boxes with unchanged schema versions.
- Mission restoration, reset, shutdown, fault, screenshots, and reduced motion remain unchanged.
- Focused WS-013C tests, all Workshop tests, inline JavaScript validation, and `git diff --check` pass.

## 18. Physical Chromebook acceptance

Verify at 1204 by 695 CSS pixels and DPR 1.25:

- Grow +1cm is fully visible and has a target at least 44px in each required dimension.
- Shrink -1cm is fully visible and has a target at least 44px in each required dimension.
- Mouse, touch, Enter, and Space each resize exactly once.
- Only one eligible selected box can be resized.
- Grow changes all local dimensions by exactly one centimeter.
- Shrink changes all local dimensions by exactly one centimeter and never crosses the minimum.
- X/Z center, rotation, scale, material, parentage, and bottom elevation remain unchanged.
- Selection remains active.
- Valid Resize commits immediately without visible lag, duplication, flash, or stuck state.
- Workspace and collision rejections change no geometry or history.
- Successful Resize creates exactly one `RESIZE` transaction.
- Undo restores exact original position and dimensions.
- Redo restores exact resized position and dimensions.
- Save/load preserves the resized box.
- WS-013A Move and WS-013B Rotate remain correct.
- Dashboard appearance and 148px height remain unchanged.
- All tabs and Quick Access controls remain visible with no horizontal scrolling.
- Camera/View, Grid, rulers, Measurement Assistant, and Tool Chest remain correct.

Physical verification must stop for human acceptance before commit authorization.

## 19. Stop conditions

Stop and request inspection if implementation would require:

- Resizing more than one object or any non-box geometry.
- Changing scale instead of authoritative BoxGeometry dimensions.
- Changing save or autosave schema versions or fields.
- Mutating live geometry to calculate candidate bounds.
- Replacing the existing collision, selection, or history authority.
- Accepting history only after mutation without the approved prepared contract.
- Leaving partial geometry after failure or leaking disposed geometry.
- Adding handles, preview, numeric entry, Cancel mode, or keyboard shortcuts.
- Changing Builder, camera/View, placement, snapping, raycasting, Grid, rulers, Measurement Assistant, or Tool Chest behavior.
- Restyling or reallocating the bottom dashboard.
- Modifying files outside the separately authorized implementation scope.

## 20. Proposed implementation scope

Subject to a separate implementation inspection and authorization:

- `index.html`
- `js/workshop/editing/workshop-edit-history.mjs`
- New `js/workshop/editing/workshop-selection-resize-transform.mjs`
- Focused WS-013C transform, history, integration, input, and responsive-layout tests only as required

The existing Move and Rotate transform modules should remain unchanged unless a later inspection proves a mixed-file dependency and receives separate approval. This blueprint file remains the accepted contract rather than an implementation scratchpad.

## 21. Definition of ready for implementation

WS-013C is ready for implementation authorization only when a read-only inspection confirms:

- Exact supported BoxGeometry detection and dimension sources.
- Exact centimeter-to-model-unit convention.
- Correct bottom-anchor math for the supported scale contract.
- A non-mutating candidate-bounds seam.
- Existing workspace and collision adapters can validate candidate bounds.
- Prepared history can compare and apply exact dimension snapshots backward-compatibly.
- Geometry replacement, disposal, Undo, Redo, and rollback can remain atomic.
- Exact UI insertion and focused test seams fit the proposed file scope.
- No current-dashboard visual change is required.
