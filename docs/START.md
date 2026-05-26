# SystemDeck Agent Start File

SystemDeck is a WordPress-native media and vault extension plugin.

Agents working on this project must follow native WordPress integration behavior.

Read this file before making changes.

---

# Project Philosophy

SystemDeck extends WordPress.

It does not replace WordPress UI, media systems, navigation, or workflows.

Agents must preserve native WordPress behavior at all times.

---

# Required Behavior

Use WordPress-native:

-   media modal
-   navigation
-   attachment editing
-   hooks
-   styles
-   accessibility behavior
-   layout flow

If WordPress already provides functionality, use it.

Do not recreate native systems.

---

# Modal Integration Rules

Do not recreate or simulate the WordPress media modal.

Never replace:

-   `.media-frame-content`
-   `.edit-attachment-frame`
-   `.attachment-media-view`
-   `.attachment-info`

Do not:

-   create custom modal navigation
-   duplicate native attachment fields
-   replace modal layouts
-   override native modal structure

Use WordPress-native modal behavior only.

---

# SystemDeck UI Rules

SystemDeck UI may only extend the sidebar panel.

Allowed insertion targets:

-   after `.settings`
-   before `.actions`

Custom UI must remain inside:

```txt
.sd-vault-native-extension

Never remove or hide native WordPress UI.

CSS Rules

Do not globally style:

.media-modal
.media-frame
.attachment-info
.attachment-media-view

All custom styles must remain scoped.

Runtime Investigation Rules

Before patching:

Trace runtime execution.
Verify hook timing.
Verify enqueue order.
Verify dependency registration.
Identify the exact failure point.

Do not patch guesses.

If the runtime path cannot be proven, stop.

WordPress Script Rules

Verify:

registration hook
enqueue hook
dependency order
admin scope
load timing

Dependencies must register before enqueue.

Native Integration Doctrine

You are not redesigning WordPress.

You are extending WordPress.

The correct result looks native.

The only visible difference should be the SystemDeck extension panel.
```
