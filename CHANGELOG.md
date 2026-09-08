# CHANGELOG

## Phase 2B.1 — Engineering Control Console Redesign
**Status:** VERIFIED ✅

- Manual testing: 10/10 PASS.
- Approved SHA-256: `49338dbffd017306deaab325f3850ff437f4bd1596538ef89a738eafe866a012`.
- Replaced seven simultaneous dashboard columns with a tabbed Engineering Control Console and permanently visible Quick Access Toolbar.
- Added seven category tabs and displays only the active category workspace.
- Reduced dashboard height from 156px to 112px, increasing the ruler-framed stage by approximately 44px vertically.
- Preserved existing Workshop engineering behavior and Builder isolation.
- Added no new engineering functionality.

## Phase 1.5 — Engineering Workspace Version 1
**Status:** VERIFIED AND LOCKED ✅

- Phase 1.5 Engineering Workspace Version 1 verified and locked.
- Known non-blocking issue: native hover tooltips for disabled future-tool buttons are not visibly appearing.

## Update #155 — THINKer Bob Workshop Rig Checkpoint
**Status:** VERIFIED ✅

### Added
- Integrated THINKer Bob as an articulated foreground character in the existing STEM Coach workshop.
- Added gentle idle movement, automatic blinking, one greeting wave per workshop opening, and a neutral reset.
- Connected speech Play to a subtle head tilt and speech Stop to the neutral pose.
- Added an inline rig fallback so Bob also appears when the Builder is opened directly from a local `file://` link.

### Verified
- Confirmed all 24 PNG rig layers resolve and render.
- Confirmed the opening/reopening wave, blink, speech tilt, and Stop reset.
- Kept the workshop background, workbench, dashboard, mission HUD, and Coach content unchanged.


## Update #154 — Grade 5 Moon/Mars Colony and Mission Banner Vehicles
**Status:** VERIFIED ✅

### Grade 5 Mission
- Replaced the single Moon Colony launcher with one shared Moon or Mars Colony mission.
- Students now select Moon or Mars after pressing Start Mission and before the Builder loads.
- Moon uses a gray surface with craters; Mars uses red terrain, dusty sky colors, a shallow crater, and rust-colored rocks.

### Builder Sky
- Restored the plane banner for Castle, playground, habitat, city, and all other non-space missions.
- Added a BOB-piloted rocket banner for Moon and Mars colony missions only.
- Saved separate transparent PNG assets for the plane and rocket, with the live banner text preserved as editable HTML.

### Verification
- Confirmed the colony picker appears after Start Mission, Mars launches successfully, both Builder canvases initialize, and the correct vehicle is selected by mission.

## Update #151 — Finished Dashboard and Live Ticker Master Build
**Status:** VERIFIED ✅

### Dashboard
- Finalized the compact hidden ticker, flush to the viewport bottom, and the full-size ticker seated against the expanded dashboard rail.
- Improved Utilities label contrast and shifted the tool-message strip clear of the color scrollbar.

### Live Ticker
- Added the default welcome message, tool and color/shape context messages, and badge-earned celebrations with 🎉.
- Corrected ticker layering so text renders above the bezel artwork.
- Limited the text window to the center LED matrix and slowed scrolling to a readable 32-second loop.

### Reliability
- Bundled Three.js locally so the Builder and View cube render without an external CDN.
- Corrected the workshop background asset filename casing for reliable deployment.

### Verification
- Confirmed Builder rendering, image assets, dashboard controls, ticker text, message updates, badge ticker behavior, and responsive ticker alignment.

## Update #150F — Dashboard Ticker and Readability Polish
**Status:** VERIFIED ✅

### Changed
- Cropped the production LED ticker bezel to its visible bounds and aligned it in both dashboard states.
- Seated the expanded ticker directly against the dashboard rail and made the hidden ticker flush with the viewport bottom.
- Reduced the hidden ticker to 80% scale while keeping its click target aligned.
- Improved Utilities button-label contrast and moved the tool-message bar right to clear the color scrollbar.

### Verified
- Hidden and expanded ticker positions were measured at the reference viewport.
- Dashboard controls, ticker interaction, and the message bar remain usable.
- User-tested build passes.

## Update #140A — Integrate BUILD DASHBOARD Hood
**Status:** VERIFIED ✅

### Changed
- Raised and narrowed the BUILD DASHBOARD title plate.
- Integrated the plate into the gold-chrome dashboard hood.
- Removed overlap with Build Tools, Screenshot, Utilities, Shapes and Colors, Mission controls, and Voice controls.
- Preserved the existing dashboard width, height, and bottom placement.
- Preserved the clean collapsed BUILD DASHBOARD tab.

### Verified
- Dashboard expands and collapses correctly.
- All dashboard controls remain visible and clickable.
- All IDs, JavaScript, and event listeners remain preserved.
- Builder gameplay, missions, STEM Coach, View panel, camera, grid, robot animation, Mission Passport, Object Library, Screenshot, and voice reader remain functional.

### Approved Baseline
This version is the stable baseline for adding the compact dashboard category selector.

# Current Stable Version

**Current Verified Build:** Update #139C

This is the approved baseline for all future dashboard redesign work.


## Update #139C — Verified Dashboard Baseline
**Status:** VERIFIED ✅

### Verified
- Confirmed the Build Dashboard opens and collapses correctly.
- Confirmed the BUILD DASHBOARD title plate remains permanently visible when collapsed.
- Verified the expanded dashboard layout remains correctly positioned.
- Verified Mission Passport, Object Library, Shapes, Colors, Build Tools, Utilities, Screenshot, Grid, and Voice controls remain functional.
- Verified the tool message bar remains present.
- Verified all IDs, JavaScript, and event listeners are preserved.
- Verified Builder gameplay, STEM Coach, View panel, camera, robot animation, missions, passport, and voice reader remain unchanged.
- No duplicate IDs, broken selectors, invalid HTML, or JavaScript syntax errors found.

### Approved Baseline
This version is the approved baseline for the upcoming blended dashboard redesign, combining:
- A permanent top control row.
- A scrollable lower dashboard area.
- A future central dashboard dial with transparent category overlays.

## Update #137 — Add Redo and Dashboard Utility Reflow

### Status
VERIFIED

### Summary
Implemented a Redo system for the existing Builder Undo feature and improved the Build Dashboard utility-button layout to better support future controls.

### Added
- Added a Redo button beside the existing Undo button.
- Added a Redo history stack that restores the original Three.js mesh removed by Undo.
- Added enabled/disabled states for both Undo and Redo buttons.
- Added Redo status messages for successful restores and empty history.

### Changed
- Reflowed the silver dashboard utility buttons.
- Prevented the utility-button column from creating a fifth row beneath the Return to Missions button.
- Moved overflow utility buttons into the available horizontal space beneath the tool-message bar.
- Preserved the existing dashboard height, styling, spacing, and responsive layout.

### Preserved
- Cube, sphere, and triangular wedge creation.
- Existing Undo behavior and Ctrl/Command + Z shortcut.
- Save, Load, Screenshot, Reset, and Grid functionality.
- Mission system.
- Object Library.
- Mission Passport.
- Voice Reader.
- Camera controls.
- Gameplay and Builder interaction.

### Testing
✅ Undo removes the most recently placed block.

✅ Redo restores the same block with its original:
- Geometry
- Material
- Color
- Position
- Rotation
- Scale
- Builder metadata

✅ New block placement clears the Redo history.

✅ Reset clears the Redo history.

✅ Utility buttons remain inside the Build Dashboard.

✅ No fifth utility-button row appears beneath Return to Missions.

✅ Dashboard layout remains responsive with no control overlap.

### Verification
VERIFICATION PASSED

No regressions were found in the existing Builder systems. The Redo implementation remains narrowly scoped to the current Undo behavior without introducing a general history engine.


Update #138B — Correct Start Mission Button Scaling
- Enlarged the Starter Page Start Mission PNG proportionally.
- Preserved the original artwork aspect ratio.
- Removed conflicting fixed-height and padding rules.
- Expanded only the required Before You Start grid column.
- Preserved Starter Page scrolling and all mission behavior.

Update 105.3 VERIFIED
## Update #104 — Mission-Aware Object Library

**Date:** July 2026

**Status:** VERIFIED ✅

### Changes
- Added mission-aware Object Library ordering.
- Object Library now automatically opens to the category and objects most relevant to the currently selected mission.
- Added a centralized mission-to-object mapping.
- Preserved the complete Object Library for browsing.
- Preserved object placement, scrolling, categories, and selection behavior.
- Preserved THINKer BOB STEM Coach integration and voice-reader behavior.
- Preserved all Object Library open, close, hover, and lock-open functionality.

### Verification
- Weather Station mission automatically displays Weather objects first.
- Recommended objects appear without hiding any other library objects.
- Remaining Object Library stays accessible through normal scrolling.
- Dashboard, Builder, and gameplay unaffected.
- Object placement and STEM Coach continue functioning correctly.

## Update #103.8 — Dashboard Title PNG

**Date:** July 2026

**Status:** VERIFIED ✅

### Changes
- Replaced the CSS-generated BUILD DASHBOARD plaque with the final PNG artwork.
- Preserved all existing dashboard functionality.
- Preserved expand/collapse behavior.
- Preserved minimized dashboard behavior.
- Removed the previous CSS-generated title styling.
- Centered the new dashboard title without overlapping the color swatches.
- Preserved dashboard layout, spacing, and controls.
- Locked the dashboard title artwork for future updates.

### Verification
- Dashboard title displays correctly in expanded mode.
- Dashboard title remains correctly positioned.
- Dashboard controls function normally.
- Dashboard layout unchanged.


## Update #103.7A — Mission Button PNG Conversion

Status: VERIFIED ✅

Changes:
- Replaced Builder Return to Missions button with final brass PNG.
- Replaced Starter Page Start Mission button with matching brass PNG.
- Preserved all existing JavaScript.
- Preserved button functionality.
- Improved industrial engineering appearance.


# Update #103 – Engineering Console Dashboard

Status: Complete

Changes:
- Replaced flat dashboard with brushed gunmetal engineering console.
- Added thick metallic gold outer frame.
- Redesigned Return to Missions as engraved brushed-gold navigation button.
- Converted utility buttons to brushed silver.
- Converted build controls to colored metallic buttons.
- Updated dashboard styling to industrial engineering theme.
- Preserved all Builder functionality.

## Update #102B – Add Cube, Sphere, and Triangle Shapes

Date: July 2026

Status: Complete ✅

Added:
- Cube building
- Sphere building
- Triangle building
- Shape selector integrated into the Builder

Notes:
- Existing Builder layout preserved.
- Mission system unchanged.
- Dashboard, robot animation, voice reader, engineering grid, and gameplay preserved.

## Update #102B – Add Cube, Sphere, and Triangle Shapes

Status: Complete ✅

### Added
- Cube building support
- Sphere building support
- Triangle building support
- Shape selection integrated into the Builder

### Preserved
- Existing Builder layout
- Mission system
- Robot animation
- Dashboard
- Engineering grid
- Toolbox
- Passport
- Voice reader
- Camera controls
- Mission-generated objects
- Existing event listeners

### Result
Students can now build using three basic geometric shapes instead of cubes alone, providing a stronger foundation for engineering, mathematics, and creative design activities.

## Update #101.2C — Increase Grass Engineering Grid Contrast

Completed:
- Increased engineering grid visibility on grass missions.
- Preserved existing grid alignment.
- Preserved cube placement and snapping.
- Preserved Grid On/Off toggle.
- No gameplay or performance changes.

## Update #101B — Add Engineering Build Grid

### Changes
- Added a persistent engineering grid across the full 50 × 50 build surface.
- Added minor grid lines every 1 world unit.
- Added brighter major grid lines every 5 world units.
- Aligned the grid to block-placement coordinates.
- Positioned the grid slightly above the ground to avoid flicker.
- Kept the grid non-interactive and excluded from raycasting.
- Prevented duplicate grid creation after Reset World.

### Verification
- Tested across grass, gray, dark, moon, and white mission grounds.
- Confirmed block placement, removal, move mode, and reset remain unchanged.
- Confirmed no duplicate grid or noticeable performance issue.


## Update #101A — Inspect Build Area for Engineering Grid

### Type
Diagnostic inspection only — no code changes.

### Findings
- Confirmed the active build surface is the `ground` mesh.
- Confirmed the ground is a 50 × 1 × 50 box positioned at `y = -1`.
- Confirmed the visible ground and block-placement raycasting surface are the same object.
- Confirmed block placement snaps to one-unit coordinates.
- Found no active Three.js engineering grid.
- Identified the empty `buildStarterGrid()` function as the safest insertion point.
- Recommended a lightweight custom `THREE.LineSegments` grid with minor lines every 1 unit and major lines every 5 units.
- Recommended placing the grid approximately 0.015 units above the ground.
- Confirmed the grid can be non-interactive and should have negligible Chromebook performance impact.

### Status
Inspection complete. Awaiting Update #101B implementation and testing.

## Update #100.3B — Apply Final Mission HUD Style Immediately

### Changes
- Applied the approved Mission HUD cyan bottom glow immediately when the active HUD appears.
- Removed the visible dependency on the delayed `builderTitleCompactActive` state.
- Preserved the existing HUD design, placement, dimensions, mission text, and timing.
- Made no JavaScript or gameplay changes.

### Verification
- Tested multiple missions in Chrome using Live Server.
- Confirmed that the HUD appears immediately in its complete final style.
- Confirmed that no delayed style change remains.

## Update #100.3A — Diagnose Delayed Mission HUD Style Change

### Type
Diagnostic inspection only — no code changes.

### Findings
- Confirmed that `#worldTitle` is the single active Selected Mission HUD.
- Confirmed that the main blue HUD panel appears immediately in its correct style.
- Identified a legacy `#worldTitle::after` rule that adds the cyan bottom glow only after the body receives the `builderTitleCompactActive` class.
- Confirmed that delayed legacy Builder title JavaScript adds `builderTitleCompactActive` after a timer or title-state change.
- Determined that the delayed visual change is not caused by mission text, the popup, image loading, or a delayed stylesheet.
- Recommended a CSS-only final override that applies the approved cyan glow immediately and removes its dependency on the delayed compact-title class.

### Status
Diagnosis complete. Awaiting Update #100.3B implementation and testing.



## Update 58 — Builder Refactor Setup
- Added README.md
- Added BRANDING.md
- Added CHANGELOG.md
- Organized project folder
- Prepared Builder for cleaner future updates

## Update 58 — Start Page Cleanup
- Update_58_BuilderRefactor_Baseline

## Update #96.7 — VERIFIED

Status: VERIFIED

Completed:
- Removed duplicate Builder header systems.
- Restored single Builder robot.
- Restored single Builder sign.
- Eliminated mission title flash.
- Stabilized Selected Mission HUD.
- Established verified Builder header layout.

Backup:
Update #96.7 VERIFIED

Notes:
Robot position is acceptable. Minor cosmetic adjustment (5–10 px lower) may be done later during polish.

## Update #97 — Builder Header Polish
Status: VERIFIED ✅

Changes:
- Lowered Builder robot approximately 6–8 px.
- Robot now rests naturally on the Builder sign.
- Preserved Builder sign, mission HUD, gameplay, and JavaScript.
- No regressions found during verification.

Backup:
index-update97-verified.html

Update 98.4
Status: PASS (timing)

• Removed delayed Selected Mission HUD reveal.
• Robot now appears immediately.
• Sign now appears immediately.
• Selected Mission HUD now appears immediately after popup closes.
• Remaining issue: HUD sits slightly too high and overlaps the popup area.
• Next update will adjust HUD vertical spacing only.

## Update #98.4 — Immediate Selected Mission HUD
Status: VERIFIED ✅

- Added a CSS-only override for the active Selected Mission HUD.
- Removed the delayed HUD reveal after the mission popup closes.
- Preserved mission launch, popup behavior, robot, sign, and gameplay.
- Mission HUD remains dynamic and stable.

Update #99.1 (Diagnostic)
Identified delayed legacy title-state CSS affecting #gameLogo. No code changes made.

Update #99.3 (Diagnostic)
Identified competing CSS rules causing the Selected Mission HUD to shift downward after legacy Builder title-state classes expire. No code changes made.

## Update #99.4 — Stable Builder Header and Mission HUD
Status: VERIFIED ✅

- Froze the Builder robot and sign in the approved centered position.
- Froze the Selected Mission HUD at its approved vertical position.
- Prevented delayed horizontal and vertical movement caused by legacy title-state CSS.
- Preserved immediate HUD visibility, dynamic mission titles, mission launch, popup behavior, and gameplay.

## Update #100.1 — Remove Obsolete PNG Builder Title Sequence

Status: PASS

Changes:
- Removed the legacy PNG Builder title introduction sequence.
- Preserved the active Builder header (#gameLogo, #builderHeaderRobot, #builderHeaderSign).
- Preserved the active Selected Mission HUD (#worldTitle).
- Preserved immediate mission HUD visibility.
- Preserved dynamic mission title updates.
- Mission launch and popup behavior remain functional.

Verification:
- One robot displayed.
- One Builder sign displayed.
- One Selected Mission HUD displayed.
- Mission titles remain dynamic.
- No regression observed after removal.

Remaining Issue:
- The Selected Mission HUD changes appearance slightly after approximately 20–30 seconds, even though its position remains fixed.
- Robot and Builder sign remain stable.
- This appears to be caused by a delayed legacy CSS state overriding HUD styling rather than movement.

Next Step:
- Update #99.5 Diagnostic — Trace delayed mission HUD style change.

## Update #100.2 — Mission HUD Appearance Diagnostic

Status: COMPLETE

Changes:
- Diagnosed delayed visual change affecting #worldTitle.
- Confirmed HUD position remains stable.
- Determined delayed appearance is caused by legacy builderTitleCompactActive CSS.
- Verified robot and Builder sign remain fixed.
- Determined JavaScript is no longer causing movement.
- Recommended one final CSS appearance freeze before removing remaining legacy Builder title CSS.
  
### Known Issues

- Selected Mission HUD remains in the correct position but changes visual styling after approximately 20–30 seconds.
- Suspected cause: delayed legacy CSS class or higher-specificity selector overriding the HUD appearance.
- Gameplay, mission launch, robot, and Builder sign are stable.

## Update #100.3A — Diagnose Delayed Mission HUD Style Change

### Type
Diagnostic inspection only — no code changes.

### Findings
- Confirmed that `#worldTitle` is the single active Selected Mission HUD.
- Confirmed that the main blue HUD panel appears immediately in its correct style.
- Identified a legacy `#worldTitle::after` rule that adds the cyan bottom glow only after the body receives the `builderTitleCompactActive` class.
- Confirmed that delayed legacy Builder title JavaScript adds `builderTitleCompactActive` after a timer or title-state change.
- Determined that the delayed visual change is not caused by mission text, the popup, image loading, or a delayed stylesheet.
- Recommended a CSS-only final override that applies the approved cyan glow immediately and removes its dependency on the delayed compact-title class.

### Status
Diagnosis complete. Awaiting Update #100.3B implementation and testing.

---

## Next Planned Update

### Update #138 — Builder Status Console

Replace the floating Current Mission HUD with an industrial LCD-style Builder Status Console integrated beside the BUILD DASHBOARD title plate.

Planned features:
- Current Mission display
- Current Badge display
- Industrial LCD styling
- Scrolling mission title for long names
- Future support for XP, Builder Level, Block Count, Achievements, and THINKer BOB status messages

This update will also prepare the Builder interface for THINKer BOB's Workshop expansion by freeing space around the STEM Coach panel.
