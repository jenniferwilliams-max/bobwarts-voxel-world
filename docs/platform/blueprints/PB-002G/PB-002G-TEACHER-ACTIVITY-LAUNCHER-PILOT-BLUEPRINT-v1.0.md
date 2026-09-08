# PB-002G — Teacher Activity Launcher (Pilot) Blueprint v1.0

## 1. Document Status

- **Blueprint:** PB-002G
- **Title:** Teacher Activity Launcher (Pilot)
- **Version:** 1.0
- **Status:** Pilot blueprint; implementation not authorized
- **Audience:** Product, design, engineering, classroom-readiness, and pilot support teams
- **Purpose:** Define the smallest teacher-facing configuration flow needed to control which classroom activities and tools students can access during today's class.

This document specifies behavior and boundaries only. It does not authorize application code, automation, infrastructure, integrations, or production governance.

## 2. References

- Classroom Readiness Sprint
- PB-003A — Student Home
- PB-003B — Mission Choice
- PB-003C — My STEM Work

These references establish the surrounding student experience. PB-002G does not replace their ownership or redefine their navigation.

## 3. Pilot Objective

Give a teacher one simple launcher configuration for the current class session. The teacher chooses an age-band activity library, chooses the amount of activity content to expose, enables the classroom tools and evidence destinations needed today, optionally enables whole Side Paths, reviews the configuration, and applies it to the entire class.

The corresponding student experience must expose only the choices enabled by the teacher. Unavailable activities, tools, evidence destinations, and Side Paths are hidden rather than presented as disabled or dead-end controls.

## 4. Pilot Success Criteria

The pilot is successful when:

1. A teacher can select either the Grade 3/4 or Grade 5/6 Activity Library.
2. A teacher can expose an entire Goal or one specific Activity from the selected library.
3. A teacher can independently enable Builder, Workshop, Google Slides Evidence, Google Vids Evidence, and Reflection.
4. A teacher can optionally expose whole Side Paths.
5. The configuration applies to the entire class.
6. Students see only enabled, valid choices.
7. Every visible student choice opens an existing classroom destination.
8. The pilot does not depend on automation, a registry, mission distribution, cloud services, or new persistence.

## 5. Users and Ownership

### Teacher

The teacher owns the choices for today's class:

- activity library;
- entire Goal or specific Activity;
- enabled creation and evidence tools;
- Reflection availability;
- whole Side Path availability;
- application to the entire class.

### Student

The student consumes the applied configuration through the existing PB-003 student surfaces. Students do not edit, expand, or bypass the teacher's choices.

### Existing systems

PB-002G delegates navigation and tool behavior to existing owners. Builder, Workshop, Google resources, Reflection, Student Home, Mission Choice, and My STEM Work retain their existing behavior. The launcher controls visibility and availability only.

## 6. Entry and Exit

The pilot launcher is entered from an authorized teacher surface defined by the later implementation plan. It must provide a clear return to the existing teacher home or originating teacher surface.

Leaving the launcher before applying must not silently change the current classroom configuration. If the teacher has changed selections, the interface should clearly offer either:

- continue editing; or
- leave without applying.

The precise pilot handling of unapplied changes remains a product decision listed in Section 21.

## 7. Teacher Flow

The bounded flow is:

1. **Choose Activity Library**
   - Grade 3/4 Activity Library; or
   - Grade 5/6 Activity Library.
2. **Choose Activity Scope**
   - Entire Goal; or
   - Specific Activity.
3. **Choose Student Tools**
   - Builder;
   - Workshop;
   - Google Slides Evidence;
   - Google Vids Evidence;
   - Reflection.
4. **Choose Side Paths**
   - Side Paths off; or
   - whole Side Paths on.
5. **Confirm Audience**
   - Entire Class.
6. **Review** the student-visible choices.
7. **Apply for Today's Class**.

The flow should remain understandable without knowledge of registries, distribution systems, permissions architecture, or technical resource identifiers.

## 8. Activity Library Selection

Exactly one age-band library may be active:

- **Grade 3/4 Activity Library**
- **Grade 5/6 Activity Library**

Selecting a different library must clear any incompatible Goal, Activity, or Side Path selection before the teacher can apply the configuration. The teacher must not unknowingly retain an item from the previously selected library.

For the pilot, library contents may be hardcoded and manually maintained. Every listed item must map to an existing classroom resource before it can be enabled.

## 9. Goal and Activity Scope

The teacher chooses one mutually exclusive content scope.

### Entire Goal

The student receives access to every approved Activity belonging to the selected Goal.

### Specific Activity

The student receives access to one selected Activity within the selected library and Goal context.

The pilot must not allow Entire Goal and Specific Activity to be applied simultaneously. Changing between the two modes must produce a clear review summary before application.

## 10. Student Tool Controls

The teacher may independently enable the following:

| Teacher control | Student-visible destination | Pilot requirement |
| --- | --- | --- |
| Builder | Existing Builder | Hide when not enabled |
| Workshop | Existing Workshop | Hide when not enabled |
| Google Slides Evidence | Existing approved Slides resource | Show only when a valid resource exists |
| Google Vids Evidence | Existing approved Vids resource | Show only when a valid resource exists |
| Reflection | Existing “What I Learned Today” destination | Hide when not enabled |

An enabled control is valid only when its destination exists and can be launched. Placeholder destinations are acceptable only when explicitly approved for the classroom pilot and verified not to be dead ends.

The launcher does not change tool capabilities, authentication, ownership, saving, or data behavior.

## 11. Side Paths

The teacher may enable or disable Side Paths.

For the pilot:

- Side Paths are optional.
- Enabling Side Paths exposes the entire approved Side Path associated with the selected Goal or Activity context.
- Individual Side Path activities cannot be selected.
- A Side Path with no valid classroom destination must not appear to the teacher as an enableable option or to the student as an available choice.

Specific Side Path activity selection is future scope.

## 12. Audience

The only pilot audience is:

- **Entire Class**

The audience should be explicit in the review and applied-state confirmation even if it is the only available choice. Selected Students is documented as future scope and must not appear as an active pilot control.

## 13. Review and Apply

Before applying, the teacher must be shown a concise summary containing:

- selected age-band library;
- selected Goal;
- Entire Goal or named Specific Activity;
- enabled student tools;
- Side Paths on or off;
- audience: Entire Class.

The apply action should use clear classroom language such as **Apply for Today's Class**. It must be unavailable until every required selection is complete and every enabled destination is valid.

After a successful pilot application, the teacher receives a visible confirmation of what students can access. The pilot must not claim cloud synchronization, automated distribution, or persistence that does not exist.

## 14. Student Experience Contract

PB-003A, PB-003B, and PB-003C remain the authoritative student surfaces. They consume the pilot choice without exposing teacher configuration controls.

Student-facing rules:

1. Show only the selected Goal or Activity content.
2. Show only teacher-enabled tools and evidence destinations.
3. Show Side Paths only when enabled.
4. Never show unavailable controls as disabled teasers.
5. Never present an enabled button without a working destination.
6. Preserve Return to Student Home and all existing student navigation.
7. Do not reveal teacher-only labels, configuration state, or future options.

## 15. Empty, Invalid, and Unavailable States

The teacher must not be able to apply an incomplete or invalid configuration.

- No library selected: request a library selection.
- No Goal selected: request a Goal selection.
- Specific Activity mode without an Activity: request an Activity selection.
- Enabled tool without a valid destination: identify it as unavailable and require the teacher to disable it or supply the approved pilot destination.
- Side Paths enabled without a valid Side Path: prevent application and explain the missing classroom resource.
- No student tools selected: allowed only if the selected activity itself remains a valid, complete student destination; this is an unresolved pilot decision.

Errors must use plain teacher-facing language and must not expose implementation details.

## 16. Accessibility and Classroom Usability

Any later implementation must:

- use native controls for selections and actions;
- provide visible labels rather than color-only meaning;
- preserve logical keyboard order and Enter/Space activation;
- maintain visible focus indicators;
- expose checked, selected, expanded, invalid, and disabled states accessibly;
- use touch targets of at least 44 by 44 CSS pixels;
- keep review and validation messages readable with assistive technology;
- avoid hidden controls remaining keyboard-focusable;
- remain readable at the supported classroom Chromebook viewport;
- use age-band and classroom language familiar to teachers.

## 17. Pilot Data Model (Conceptual Only)

The following conceptual snapshot is sufficient to describe the pilot contract. It is not a schema, registry, persistence model, or implementation requirement.

```text
Today's Class Configuration
  library: grade-3-4 | grade-5-6
  goal: approved hardcoded goal identifier
  scope: entire-goal | specific-activity
  activity: approved hardcoded activity identifier | none
  tools:
    builder: on | off
    workshop: on | off
    slidesEvidence: on | off
    vidsEvidence: on | off
    reflection: on | off
  sidePaths: on | off
  audience: entire-class
```

No student records, analytics, authentication data, or cloud state are introduced by this blueprint.

## 18. Prototype Resource Rules

- Hardcoded classroom resources are acceptable.
- Manual resource maintenance and manual application are acceptable.
- Existing Google resources may be launched directly.
- An approved placeholder link is acceptable only if it resolves to a usable classroom resource.
- Dead-end, empty, inaccessible, or unverified destinations must not be enabled.
- Resource ownership and sharing permissions must be checked manually before classroom use.
- The pilot must describe manual behavior honestly and must not simulate automation or synchronization.

## 19. Explicit Non-Goals

PB-002G v1.0 does not include:

- Mission Distribution;
- Activity Registry;
- cloud backend or cloud persistence;
- student data persistence;
- analytics or reporting;
- AI;
- automation;
- production integrations;
- authentication changes;
- production governance;
- per-student assignment;
- selected-student targeting;
- individual Side Path activity selection;
- authoring or editing classroom resources;
- automatic Google resource creation or permission management.

## 20. Future Capabilities (Documentation Only)

The following may be explored after the classroom pilot and require separate approval:

- **Selected Students:** apply different configurations to a teacher-selected subset.
- **Specific Side Path activities:** expose individual Side Path activities rather than the whole path.
- **Activity Registry:** maintain structured, validated activity and resource metadata.
- **Mission Distribution:** distribute missions and access rules through an authoritative system.
- **Automation:** schedule, provision, distribute, revoke, or synchronize classroom resources.

These future capabilities must not influence the pilot architecture in ways that add hidden complexity or premature production requirements.

## 21. Remaining Pilot Decisions

The following human decisions are required before implementation authorization:

1. Which exact Grade 3/4 and Grade 5/6 Goals and Activities are available during the pilot?
2. What existing URL or in-product destination belongs to each Activity and whole Side Path?
3. Which Google Slides and Google Vids resources are approved, and are their classroom sharing permissions verified?
4. Does Google evidence open a shared template, a teacher-owned source, or an already prepared student-safe destination?
5. What exact existing destination owns Reflection / “What I Learned Today”?
6. Is a configuration with no optional tools enabled valid when the Activity itself is launchable?
7. What is the pilot default: no tools selected, or a documented safe starter set?
8. How is the manually applied configuration made visible to all students for today's class without introducing persistence or automation?
9. When does today's manual configuration expire or get replaced?
10. What happens to unapplied changes when a teacher leaves the launcher?
11. What teacher confirmation wording best distinguishes manual pilot application from production distribution?
12. Who performs the pre-class dead-link and Google-permission check?

## 22. Proposed Future Implementation Boundary

A later implementation gate should identify the existing PB-002 teacher surface and PB-003 student visibility seam before naming files. The implementation should be isolated, use namespaced Platform CSS, and avoid changes to Builder, Workshop, authentication, or unrelated navigation.

No implementation file scope is approved by this blueprint.

## 23. Verification Plan for a Later Build

If implementation is separately approved, verification must include:

### Focused behavior

- both library choices;
- mutually exclusive Entire Goal and Specific Activity modes;
- selection reset when the library changes;
- independent tool choices;
- whole Side Path choice;
- Entire Class summary;
- incomplete and invalid resource blocking;
- accurate review and confirmation;
- hidden student choices when unavailable;
- no enabled dead-end destination;
- preserved return navigation.

### Regression

- PB-001 Platform Foundation;
- PB-002 teacher systems;
- PB-003A Student Home;
- PB-003B Mission Choice;
- PB-003C My STEM Work;
- Builder;
- Workshop.

### Physical classroom acceptance

- supported Chromebook viewport and device-pixel ratio;
- pointer, touch, and keyboard operation;
- readable teacher review at classroom distance;
- at least 44px touch targets;
- no clipped choices or page-level horizontal scrolling;
- every enabled student destination opened on the actual classroom device;
- Google permissions verified with the actual pilot account context.

## 24. Stop Conditions

Stop and request a new decision or scope inspection if:

- the pilot requires student-specific data;
- classroom access cannot work without a cloud service or authentication change;
- an enabled destination cannot be verified;
- the student experience would need to expose unavailable choices;
- existing PB-002 or PB-003 ownership must change;
- Builder or Workshop behavior must change;
- implementation would introduce an Activity Registry, Mission Distribution, automation, analytics, or production governance;
- required resources or sharing permissions are not defined.

## 25. Blueprint Acceptance Gate

This blueprint is ready for product review when stakeholders confirm:

- the remaining pilot decisions in Section 21;
- the complete hardcoded resource list;
- the manual classroom application mechanism;
- the teacher and student wording;
- the later bounded implementation scope.

Acceptance of this blueprint documents the pilot contract only. It does not authorize implementation, staging, committing, pushing, publishing, or deployment.
