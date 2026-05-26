SystemDeck Pin UI Contract — WordPress-Aligned Modern Shell

This should be the binding visual direction for standard DOM pins and the outer shell of Pixi pins.

It stays inside the existing pin model:

-   canonical shell remains .postbox.sd-pin
-   pins are bounded workspace presentation surfaces
-   shared shell/chrome styling belongs to shared pin styling authority, not per-pin reinvention. ￼ ￼ ￼

⸻

1. Design goal

Pins must read as:

-   clearly WordPress-admin / block-editor adjacent
-   easier on the eyes than default postboxes
-   more modern through spacing and hierarchy, not novelty
-   dense-grid friendly across 12 / 8 / 4 column layouts
-   stable across approved pin sizes, especially the new default 2x1. ￼ ￼

Pins must not become:

-   glossy cards
-   gradient panels
-   oversized dashboard widgets
-   mini-app shells with custom chrome

⸻

2. Core shell rules

Canonical shell

<article class="postbox sd-pin" tabindex="0">
  <div class="inside">...</div>
</article>

For Pixi pins:

<article class="postbox sd-pin sd-pixi-pin" tabindex="0">
  <div class="inside">
    <div class="sd-pixi-surface"></div>
  </div>
</article>

These remain authoritative. Pin-local styling must not replace or duplicate this shell. ￼

Shell behavior

-   white surface
-   4px radius
-   restrained border
-   stronger visual state only on hover, focus, selected, or drag
-   no heavy shadow at rest
-   no gradient fill
-   no thick saturated border around every resting pin

⸻

3. Color system

Use WordPress-admin-aligned colors and derived scheme variables, not arbitrary hardcoded drift. SystemDeck presentation rules already center asset/theme authority and dynamic scheme alignment. ￼ ￼

Primary color roles

A. Background

-   --sd-pin-bg: #ffffff

B. Resting border

Use a very soft cool-gray or blue-gray border, not full primary blue.

-   --sd-pin-border: #dcdcde
    or slightly cooler:
-   --sd-pin-border: #d7dce1

C. Primary accent blue

Use WordPress-style blue for active states, focus, selected states, and controlled accents.

-   --sd-pin-accent: #2271b1

D. Hover border

-   --sd-pin-border-hover: #bfc6ce

E. Primary text

Use dark charcoal, not pure black.

-   --sd-pin-text: #1d2327

F. Secondary text

-   --sd-pin-text-soft: #50575e

G. Tertiary / meta text

-   --sd-pin-text-faint: #646970

H. Neutral icon

-   --sd-pin-icon: #3c434a

I. Subtle surface separator

-   --sd-pin-separator: #e2e4e7

Color law

-   Blue is an accent/state color.
-   Blue is not the default body text color.
-   Blue is not required on every icon.
-   Resting pins should feel calm.
-   State changes should introduce stronger blue emphasis.

⸻

4. Preferred visual model

Approved model

White card + soft neutral border + selective WP blue accent

This is the recommended model for the project.

Not recommended as default

Full blue border on every resting pin

Reason:

-   too loud in dense grids
-   causes visual fatigue on 12-column desktop boards
-   makes every pin feel selected
-   weakens the meaning of active/focus/selected states

If blue border is desired, use it as:

-   top edge accent
-   selected state
-   focus ring
-   small badge/accent marker
-   actionable control emphasis

⸻

5. Typography rules

Pin typography must prioritize readability in compact spans.

Primary text

-   color: var(--sd-pin-text)
-   weight: 600 for titles or key labels
-   use for: titles, primary values, key labels

Secondary text

-   color: var(--sd-pin-text-soft)
-   weight: 400–500
-   use for: descriptions, support labels, timestamps, supporting metrics

Tertiary/meta text

-   color: var(--sd-pin-text-faint)
-   use for: quiet metadata, non-critical labels, counts, provenance

Typography law

-   do not use blue for normal content text
-   maintain strong contrast on white
-   compact pins must avoid overly light text
-   2x1 pins must remain readable at a glance

⸻

6. Icon rules

Default icon behavior

-   icons default to var(--sd-pin-icon)
-   icons match primary/secondary text neutrality, not action-blue by default

Blue icon usage

Blue icons are allowed only when:

-   icon represents an action
-   icon represents active/selected state
-   icon is part of a focused control
-   icon is intentionally communicating WP-primary emphasis

Semantic colors

Use semantic colors only for true state/status:

-   success
-   warning
-   error
-   info

Do not flood the whole shell for semantic state unless explicitly required by the pin type.

⸻

7. State model

Resting

-   background: white
-   border: soft neutral
-   no strong shadow
-   text/icons neutral

Hover

-   border becomes slightly stronger
-   optional very subtle shadow
-   no dramatic lift
-   no color flood

Focus

-   strong visible WP-blue ring
-   must be keyboard-obvious
-   focus state should outrank hover visually

Selected / active

-   stronger blue emphasis than hover
-   may use:
    -   blue top edge
    -   blue inset ring
    -   stronger border tint
-   must not look like an error or warning state

Dragging

-   slightly stronger elevation
-   clearer border
-   shell remains readable and stable

Disabled / unavailable

-   lower contrast text/icon treatment
-   preserve legibility
-   never reduce so far that the card becomes muddy

⸻

8. Recommended shell metrics

Border radius

-   4px

Border width

-   1px

Padding

For default 2x1:

-   12px 14px minimum
-   14px 16px preferred if content density allows

Gap rhythm

-   tight internal rhythm for data
-   slightly larger spacing between title and body groups
-   do not cram content to edge

Shadow

At rest:

-   none, or almost none

Hover/drag only:

-   subtle, low-blur shadow
-   must not resemble floating product cards

⸻

9. Size-aware content behavior

Pins use governed size tokens and do not own layout authority. The shell must therefore degrade cleanly across approved spans. ￼ ￼

2x1 default

Best for:

-   single metric + label
-   status + short summary
-   note/file projection summary
-   control surface with 1–2 actions

Rules:

-   no oversized icon
-   title/value hierarchy should be immediately readable
-   content should bias horizontal clarity

1x1

Rules:

-   one focal value or icon+label only
-   extremely reduced supporting text
-   preserve the same shell identity

2x2 / 3x2 / 3x3

Rules:

-   same shell identity
-   more room for internal grouping
-   do not increase chrome heaviness with size

⸻

10. Modern-feel rules

Pins should feel modern through:

-   tighter alignment discipline
-   calmer border treatment
-   stronger type hierarchy
-   better spacing
-   restrained accent usage
-   controlled hover/focus states

Pins should not rely on:

-   gradients
-   thick borders
-   glossy fills
-   deep shadows
-   glassmorphism
-   rounded-pill everything
-   ornamental UI chrome

⸻

11. CSS token block

This is the recommended starting token set:

:root {
--sd-pin-bg: #ffffff;
--sd-pin-border: #dcdcde;
--sd-pin-border-hover: #bfc6ce;
--sd-pin-border-active: #2271b1;
--sd-pin-accent: #2271b1;
--sd-pin-accent-soft: rgba(34, 113, 177, 0.12);
--sd-pin-focus-ring: rgba(34, 113, 177, 0.28);
--sd-pin-text: #1d2327;
--sd-pin-text-soft: #50575e;
--sd-pin-text-faint: #646970;
--sd-pin-icon: #3c434a;
--sd-pin-separator: #e2e4e7;
--sd-pin-radius: 4px;
--sd-pin-padding-y: 12px;
--sd-pin-padding-x: 14px;
--sd-pin-shadow-hover: 0 1px 2px rgba(0, 0, 0, 0.06);
--sd-pin-shadow-drag: 0 4px 14px rgba(0, 0, 0, 0.10);
}

⸻

12. Shared shell CSS starter

.postbox.sd-pin {
background: var(--sd-pin-bg);
border: 1px solid var(--sd-pin-border);
border-radius: var(--sd-pin-radius);
box-shadow: none;
color: var(--sd-pin-text);
overflow: hidden;
transition:
border-color 140ms ease,
box-shadow 140ms ease,
transform 140ms ease;
}
.postbox.sd-pin > .inside {
margin: 0;
padding: var(--sd-pin-padding-y) var(--sd-pin-padding-x);
color: inherit;
}
.postbox.sd-pin:hover {
border-color: var(--sd-pin-border-hover);
box-shadow: var(--sd-pin-shadow-hover);
}
.postbox.sd-pin:focus,
.postbox.sd-pin:focus-visible {
outline: none;
border-color: var(--sd-pin-border-active);
box-shadow: 0 0 0 3px var(--sd-pin-focus-ring);
}
.postbox.sd-pin.is-selected,
.postbox.sd-pin[data-selected="true"] {
border-color: var(--sd-pin-border-active);
box-shadow: inset 0 2px 0 0 var(--sd-pin-accent);
}
.postbox.sd-pin.is-dragging {
border-color: var(--sd-pin-border-active);
box-shadow: var(--sd-pin-shadow-drag);
}
.sd-pin-title,
.sd-pin-value,
.sd-pin-label {
color: var(--sd-pin-text);
}
.sd-pin-meta,
.sd-pin-description,
.sd-pin-subtext {
color: var(--sd-pin-text-soft);
}
.sd-pin-kicker,
.sd-pin-timestamp,
.sd-pin-source {
color: var(--sd-pin-text-faint);
}
.sd-pin-icon {
color: var(--sd-pin-icon);
fill: currentColor;
}
.sd-pin-action,
.sd-pin-action .sd-pin-icon,
.sd-pin.is-selected .sd-pin-action {
color: var(--sd-pin-accent);
}

⸻

13. Optional accent-strip variant

This is the version I would personally use for the cleanest modern/WP hybrid look:

.postbox.sd-pin {
position: relative;
}
.postbox.sd-pin::before {
content: "";
position: absolute;
inset: 0 0 auto 0;
height: 2px;
background: transparent;
transition: background 140ms ease;
}
.postbox.sd-pin:hover::before,
.postbox.sd-pin.is-selected::before,
.postbox.sd-pin[data-selected="true"]::before {
background: var(--sd-pin-accent);
}

This gives you the WP-blue identity without over-outlining every card.

⸻

14. Semantic state accents

Use small, controlled accents rather than repainting the full shell.

Success

-   icon, dot, or badge only
-   avoid green borders on all cards by default

Warning

-   small badge/marker
-   maybe a tinted top strip for special pins only

Error

-   only for actual error status
-   preserve readable white base and dark text

Info

-   blue remains acceptable because it already fits the WP language

⸻

15. What should be shared vs local

Per pin contracts, shared shell/chrome belongs in shared pin styling authority; advanced pin CSS should only own internal composition. ￼

Shared pin CSS should own

-   shell background
-   border/radius
-   padding
-   default typography roles
-   default icon treatment
-   default hover/focus/selected/drag states

Pin-local CSS should own

-   internal layout
-   pin-specific badges/rows/graphs
-   special content composition
-   renderer-specific internal treatments

Pin-local CSS must not own

-   workspace placement
-   global grid behavior
-   alternate shell systems
-   replacement card chrome

⸻

16. Final recommendation

Use this as the default visual law:

-   white background
-   4px radius
-   soft neutral border at rest
-   dark charcoal text
-   graphite neutral icons
-   WP blue only as a selective accent/state color
-   subtle hover
-   strong accessible focus
-   selected state gets real blue emphasis

That will read as:

-   WordPress-native
-   cleaner than stock postboxes
-   easier to look at
-   modern enough for SystemDeck
-   stable across dense grid layouts. ￼ ￼ ￼

###

Codex-Ready Implementation Directive — SystemDeck Pin UI Shell

Classification: ENFORCED DIRECTIVE
Scope: Shared pin shell/chrome styling, pin-local CSS ownership, DOM pin shell consistency, Pixi pin outer shell consistency
Primary Goal: Implement a WordPress-aligned, modern pin shell without allowing shell drift, grid leakage, or per-pin chrome reinvention

This directive operationalizes the approved pin UI direction:

-   white background
-   4px radius
-   restrained border treatment
-   dark neutral text
-   neutral icons by default
-   WordPress blue used as accent/state, not constant visual flood

This directive must be followed alongside:

-   SYSTEMDECK-PIN-CONTRACT.md for pin identity, persistence, size rules, renderer ownership, and presentation modes. ￼
-   SYSTEMDECK-PIN-LOADING-STRUCTURE-RUNTIME-CONTRACT.md for shell identity, loading, mount, and advanced pin lane rules. ￼
-   SYSTEMDECK-WORKSPACE-LAYOUT-CONTRACT.md for layout ownership and responsive grid rules. ￼
-   SYSTEMDECK-PRESENTATION-UI-CONTRACT.md for centralized asset authority and WordPress scheme-aligned design behavior. ￼

⸻

1. Purpose

This directive defines the exact ownership model for pin shell styling.

It exists to prevent:

-   shell restyling in individual pins
-   grid/layout rules leaking into pin CSS
-   blue-border overuse across dense boards
-   DOM pins and Pixi pins diverging visually at the shell layer
-   more shared-shell sludge being pushed into unrelated common stylesheets

⸻

2. Core implementation law

All standard DOM pins and all Pixi pins must share one common shell/chrome system.

That shared system owns:

-   shell background
-   shell border
-   shell radius
-   shell padding
-   shell state styles
-   shell typography roles
-   shell icon defaults

Individual pins may style their internals only.

No individual pin may redefine the shared outer card appearance unless an explicit exception is approved.

This follows the pin loading/runtime contract’s shell authority and the pin contract’s rule that renderers and pins do not own workspace layout or create alternate shell systems. ￼ ￼

⸻

3. Required file ownership

3.1 Shared pin shell stylesheet

Create or use one dedicated shared plain CSS file for pin shell/chrome.

Authoritative file:

assets/css/pins.css

This file owns:

-   .postbox.sd-pin
-   .postbox.sd-pin > .inside
-   shared state classes
-   shared typography utility roles for pins
-   shared icon treatment for pins
-   shared selected/focus/drag states
-   shared shell tokens if CSS custom properties are emitted here

This file must be the only place where the standard pin shell appearance is defined.

3.2 Base DOM pin lane

Keep simple DOM pins in the base lane:

pins/
├── pin.php
├── pin.js

Per the loading/runtime contract, this lane remains the default unless real advanced needs exist. ￼

pins/pin.php may:

-   render canonical shell markup
-   output internal structural classes
-   declare the shared pins.css handle as needed through asset authority

pins/pin.js may:

-   provide shared lightweight behavior for simple DOM pins
-   bind through canonical mount event flow only

pins/pin.php and pins/pin.js must not:

-   own shared shell CSS definitions
-   emit inline style systems
-   create pin-specific outer shell variants

    3.3 Advanced pin lane

Complex DOM pins and Pixi pins use dedicated folders:

pins/
├── <pin-name-folder>/
│ ├── pin.php
│ ├── app.js
│ └── style.css

Per contract, this is required for Pixi pins and other advanced behavior. ￼

Advanced style.css files may own:

-   internal composition
-   pin-specific rows, badges, separators, graphs
-   internal Pixi wrapper rules where needed

Advanced style.css files must not own:

-   .postbox.sd-pin global shell styling
-   grid placement rules
-   outer shell radius/border/background defaults
-   replacement card systems

    3.4 Pixi pins

Pixi pins must still use the same shared outer shell and only differ internally:

<article class="postbox sd-pin sd-pixi-pin" tabindex="0">
  <div class="inside">
    <div class="sd-pixi-surface"></div>
  </div>
</article>

That shell remains canonical. Pixi visuals render inside it only. ￼ ￼

⸻

4. CSS placement rules

4.1 Must live in assets/css/pins.css

The following rules must be centralized in the shared pin stylesheet:

-   .postbox.sd-pin
-   .postbox.sd-pin > .inside
-   .postbox.sd-pin:hover
-   .postbox.sd-pin:focus
-   .postbox.sd-pin:focus-visible
-   .postbox.sd-pin.is-selected
-   .postbox.sd-pin[data-selected="true"]
-   .postbox.sd-pin.is-dragging
-   shared shell pseudo-elements such as accent strip
-   shared typography role classes:
    -   .sd-pin-title
    -   .sd-pin-value
    -   .sd-pin-label
    -   .sd-pin-meta
    -   .sd-pin-description
    -   .sd-pin-subtext
    -   .sd-pin-kicker
    -   .sd-pin-timestamp
    -   .sd-pin-source
-   shared icon class: \* .sd-pin-icon

    4.2 Must remain out of assets/css/pins.css

The shared pin stylesheet must not own:

-   workspace grid columns
-   masonry spacing
-   x/y/w/h placement behavior
-   drag/drop placeholder geometry
-   canvas-level responsive layout rules
-   widget shell styling
-   generic admin page styling
-   unrelated common component systems

Those remain with workspace/layout or other owned systems. ￼

4.3 Must not be added to sd-common.css

Do not place new shared pin shell rules into bloated mixed global stylesheets.

The pin shell must have a dedicated shared home.

This matches the direction away from mixed ownership and toward item-owned plain CSS.

⸻

5. Canonical visual rules to implement

5.1 Shell appearance

Implement exactly:

-   background: white
-   radius: 4px
-   border: soft neutral by default
-   no heavy resting shadow
-   restrained transition
-   strong accessible focus
-   stronger blue emphasis only on selected/focus/active states

    5.2 Color roles

Implement this hierarchy:

-   primary background: white
-   resting border: neutral cool gray
-   hover border: slightly stronger neutral
-   active/focus border/accent: WordPress blue
-   primary text: dark charcoal
-   secondary text: medium neutral/slate
-   tertiary/meta text: softer gray
-   default icons: graphite/dark neutral
-   action/selected icons: WordPress blue

    5.3 Accent law

WordPress blue is an accent/state color, not the permanent default shell border color for all resting pins.

Therefore:

-   full strong blue border at rest is forbidden as default shared behavior
-   blue top strip, focus ring, selected state, or action emphasis is allowed
-   a soft neutral border is the default resting treatment

⸻

6. Required token block

Codex should implement these in the shared pin stylesheet or in the generated CSS token layer if that layer already exists and is appropriate:

:root {
--sd-pin-bg: #ffffff;
--sd-pin-border: #dcdcde;
--sd-pin-border-hover: #bfc6ce;
--sd-pin-border-active: #2271b1;
--sd-pin-accent: #2271b1;
--sd-pin-accent-soft: rgba(34, 113, 177, 0.12);
--sd-pin-focus-ring: rgba(34, 113, 177, 0.28);
--sd-pin-text: #1d2327;
--sd-pin-text-soft: #50575e;
--sd-pin-text-faint: #646970;
--sd-pin-icon: #3c434a;
--sd-pin-separator: #e2e4e7;
--sd-pin-radius: 4px;
--sd-pin-padding-y: 12px;
--sd-pin-padding-x: 14px;
--sd-pin-shadow-hover: 0 1px 2px rgba(0, 0, 0, 0.06);
--sd-pin-shadow-drag: 0 4px 14px rgba(0, 0, 0, 0.10);
}

If the project already emits scheme-aware equivalents through centralized asset/theme logic, Codex may map these to existing SystemDeck semantic variables instead of duplicating permanent raw literals. Asset/theme alignment remains centrally governed. ￼

⸻

7. Required shared shell CSS

Codex should implement the shared shell in the dedicated pin stylesheet using this as the required baseline:

.postbox.sd-pin {
background: var(--sd-pin-bg);
border: 1px solid var(--sd-pin-border);
border-radius: var(--sd-pin-radius);
box-shadow: none;
color: var(--sd-pin-text);
overflow: hidden;
transition:
border-color 140ms ease,
box-shadow 140ms ease,
transform 140ms ease;
}
.postbox.sd-pin > .inside {
margin: 0;
padding: var(--sd-pin-padding-y) var(--sd-pin-padding-x);
color: inherit;
}
.postbox.sd-pin:hover {
border-color: var(--sd-pin-border-hover);
box-shadow: var(--sd-pin-shadow-hover);
}
.postbox.sd-pin:focus,
.postbox.sd-pin:focus-visible {
outline: none;
border-color: var(--sd-pin-border-active);
box-shadow: 0 0 0 3px var(--sd-pin-focus-ring);
}
.postbox.sd-pin.is-selected,
.postbox.sd-pin[data-selected="true"] {
border-color: var(--sd-pin-border-active);
box-shadow: inset 0 2px 0 0 var(--sd-pin-accent);
}
.postbox.sd-pin.is-dragging {
border-color: var(--sd-pin-border-active);
box-shadow: var(--sd-pin-shadow-drag);
}
.sd-pin-title,
.sd-pin-value,
.sd-pin-label {
color: var(--sd-pin-text);
}
.sd-pin-meta,
.sd-pin-description,
.sd-pin-subtext {
color: var(--sd-pin-text-soft);
}
.sd-pin-kicker,
.sd-pin-timestamp,
.sd-pin-source {
color: var(--sd-pin-text-faint);
}
.sd-pin-icon {
color: var(--sd-pin-icon);
fill: currentColor;
}
.sd-pin-action,
.sd-pin-action .sd-pin-icon,
.sd-pin.is-selected .sd-pin-action {
color: var(--sd-pin-accent);
}

Optional shared accent strip is allowed:

.postbox.sd-pin {
position: relative;
}
.postbox.sd-pin::before {
content: "";
position: absolute;
inset: 0 0 auto 0;
height: 2px;
background: transparent;
transition: background 140ms ease;
}
.postbox.sd-pin:hover::before,
.postbox.sd-pin.is-selected::before,
.postbox.sd-pin[data-selected="true"]::before {
background: var(--sd-pin-accent);
}

⸻

8. Pin-local CSS ownership rules

8.1 Allowed in advanced style.css

Pin-local styles may define:

-   internal flex/grid layout inside .inside
-   pin-specific content wrappers
-   badges
-   value clusters
-   internal status rows
-   charts/plots wrappers
-   internal separators
-   pin-specific action groups
-   internal empty/loading/error states

    8.2 Forbidden in advanced style.css

Pin-local styles must not define or override:

-   .postbox.sd-pin { background ... }
-   .postbox.sd-pin { border-radius ... }
-   .postbox.sd-pin { border ... }
-   .postbox.sd-pin > .inside { base padding ... }
-   shared hover/focus/selected shell logic
-   workspace board spacing
-   masonry packing
-   breakpoint-driven grid column ownership

    8.3 Exception rule

A pin may extend shell behavior only if:

-   the change is pin-type specific
-   the change does not replace the shared shell identity
-   the change is additive and visually restrained
-   the change is approved as a real special case

Example acceptable exception:

-   a site health pin adds a narrow internal status rail or status badge

Example unacceptable exception:

-   a pin replaces the shared shell with a custom dark card, 12px radius, and unique shadow language

⸻

9. PHP and asset ownership rules

9.1 Asset registration

Per presentation contract, asset registration authority is centralized. Pin CSS/JS must be registered through the proper asset authority path, not ad hoc in pin code. ￼

9.2 Required shared style handle

Codex should ensure there is a dedicated shared style handle for the pin shell stylesheet, for example:

-   sd-pins

That handle should point to:

assets/css/pins.css

9.3 Base pins

Base lane pin definitions should declare/use the shared pin stylesheet as their shell authority when rendered.

9.4 Advanced pins

Advanced pins should depend on:

-   the shared pin shell stylesheet
-   their own local style.css only if needed for internals

This preserves one shell language across all pins.

⸻

10. Layout boundary rules

Per workspace contract, layout is not owned by pins. ￼

Therefore Codex must not:

-   add width/height placement rules to the shared pin stylesheet that compete with grid ownership
-   hardcode board-level spacing into pin shell CSS
-   use pin CSS to define 12/8/4 column behavior
-   make pin CSS responsible for square logic or span math

Pin CSS may:

-   assume it receives a bounded rendered area
-   adapt internal composition within that area
-   degrade gracefully by span size

Pin CSS may not:

-   become layout authority

⸻

11. Size behavior implementation rule

Pins already use approved size tokens governed by contract. ￼

The shared shell must therefore:

-   look identical in language across 1x1, 2x1, 2x2, 3x2, etc.
-   avoid changing shell chrome style based on size
-   allow internal composition to respond by size, not outer shell identity

Default design target remains:

-   2x1 first
-   1x1 reduced
-   larger spans expanded through internals only

⸻

12. Prohibited implementation patterns

Codex must reject the following:

-   adding shared pin shell rules to sd-common.css
-   redefining .postbox.sd-pin in multiple pin-local files
-   making default resting borders saturated blue across all pins
-   giving each pin its own radius/shadow/card identity
-   placing workspace grid rules into pin CSS
-   using inline styles for shell authority
-   introducing SCSS as the required editing surface for pins
-   allowing Pixi pins to diverge from DOM pins at the outer shell layer
-   using advanced pin CSS to restyle global shell authority

⸻

13. Exact first implementation pass

Files to create or modify

1. Shared pin stylesheet

assets/css/pins.css

Add:

-   shared tokens
-   shared shell CSS
-   shared state CSS
-   shared typography/icon role classes

2. Central asset authority
   Likely:

core/Assets.php

Add/register:

-   shared sd-pins style handle
-   enqueue/manifest support so pins can depend on the shared stylesheet through the approved asset system

3. Base pin definitions
   Likely:

pins/pin.php

Ensure:

-   canonical shell markup remains intact
-   shared pin stylesheet is declared as the shell style authority for simple pins

4. Advanced pin folders
   For each advanced pin:

pins/<pin-name>/style.css

Audit and reduce:

-   remove any outer shell overrides
-   keep only internal composition rules

5. Shared pin JS only if necessary

pins/pin.js

Do not add style ownership here. Keep JS behavior-only.

⸻

14. Review checklist for Codex

A pass is correct only if all are true:

-   there is one dedicated shared plain CSS file for pin shell/chrome
-   shared pin shell rules are not spread across multiple pin-local files
-   .postbox.sd-pin remains canonical
-   default resting state uses a restrained neutral border
-   WP blue is used as accent/state color
-   text is dark neutral, not blue
-   icons are neutral by default
-   focus state is clearly accessible
-   no grid/layout ownership moved into pin CSS
-   no shared shell rules were added to sd-common.css
-   Pixi pins and DOM pins share the same outer shell language

⸻

15. Preferred reporting format for Codex

When Codex performs this pass, require this response structure:

1. Files changed

Exact file list only.

2. Shared shell ownership

What moved into assets/css/pins.css.

3. Asset authority changes

What was registered/enqueued through the centralized asset path.

4. Pin-local cleanup

Which advanced pin styles stopped owning outer shell behavior.

5. Deferred items

Only real remaining cleanup.

⸻

16. Final enforcement law

The SystemDeck pin shell is a shared platform surface.

It is not:

-   per-pin card art direction
-   a place for layout logic
-   a place for ad hoc shell experimentation
-   a place to dump more mixed global CSS

It is:

-   one shared WordPress-aligned shell
-   one restrained visual language
-   one centralized plain CSS ownership path
-   one stable base for DOM and Pixi pins alike.
