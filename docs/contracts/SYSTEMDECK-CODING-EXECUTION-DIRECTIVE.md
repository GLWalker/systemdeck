SYSTEMDECK CODING EXECUTION DIRECTIVE

Fast WordPress Implementation Mode for Codex / Agents / Models

Classification: ENFORCED DIRECTIVE
Task Type: Project-Specific / WordPress plugin and admin runtime development
Primary Goal: Achieve the fastest correct implementation path with minimal wasted cycles, minimal unnecessary verification, and strict source-traceable edits.

⸻

1. Purpose

This directive defines how coding agents must execute WordPress and SystemDeck implementation work when speed, directness, and accuracy are the priority.

This directive exists to prevent slow, low-yield agent behavior such as:
• repeated build loops after trivial edits
• full-project verification after every pass
• inflated reporting for small changes
• unnecessary architectural rewrites
• over-analysis where a direct patch is sufficient
• broad refactors when the task is file-local

This directive is intended to produce:
• faster edit cycles
• smaller, more direct patches
• higher signal responses
• verification proportional to risk
• WordPress-native implementation discipline
• SystemDeck-safe execution boundaries

This aligns with the project’s contract-driven asset authority, workspace/runtime boundaries, and shared service rules. ￼ ￼ ￼

⸻

2. Execution Philosophy

2.1 Edit First, Verify Later

Default operating mode is:

Make the requested change directly, report it clearly, and do not run extra verification unless the change risk justifies it.

Verification is not the default unit of work.
The edit is the default unit of work.

2.2 Verification Must Be Proportional

Verification must be based on:
• runtime risk
• file scope
• coupling level
• mutation type

Verification must not be based on habit.

2.3 Fastest Correct Path

Agents must prefer:
• the shortest correct patch
• the narrowest responsible file scope
• existing project patterns
• WordPress-native solutions where compatible
• reuse of confirmed services and contracts

Agents must avoid:
• speculative abstraction
• broad cleanup during implementation
• side quests
• style rewrites unrelated to the task
• performance theater in reporting

⸻

3. Core Operating Rules

3.1 Directness Rule

Implement the requested change in the most direct confirmed way.

Do not:
• redesign unrelated systems
• introduce new infrastructure when existing infrastructure already solves the task
• split one obvious patch into many unnecessary stages
• create optional future architecture during a current fix

3.2 File Scope Rule

Keep edits as narrow as possible.

Preferred order: 1. single function patch 2. single file patch 3. few-file coordinated patch 4. multi-file change only when execution flow actually requires it

3.3 Existing Pattern Rule

Prefer confirmed project patterns over generic ideas.

In this project, agents must respect:
• centralized asset authority through Assets.php and not ad hoc asset behavior ￼
• workspace layout and runtime boundaries as contract-owned, not renderer-owned ￼
• shared content access through mandatory core services, not inline reinvention ￼

3.4 No Surprise Refactor Rule

Do not convert a simple task into:
• cleanup sweep
• naming overhaul
• architecture pass
• service extraction
• standardization campaign

unless explicitly requested or strictly required by the implementation.

⸻

4. Verification Discipline

4.1 Default Verification Policy

Agents must not automatically run build, lint, grep, test, or sweep loops after every pass.

Default behavior for small edits:
• make change
• summarize change
• stop

4.2 Low-Risk Changes: No Automatic Verification

No automatic verification for:
• one-file text or label changes
• small CSS changes
• one function patch with obvious scope
• local variable rename inside one file
• comments/docs updates
• repetitive mechanical replacements
• small event binding changes
• selector or markup adjustments in one file
• direct UI copy changes
• visual tuning that does not alter shared runtime flow

For these, the agent must report:
• files changed
• what changed
• any obvious follow-on risk

and then stop.

4.3 Medium-Risk Changes: One Targeted Check Maximum

For medium-risk changes, the agent may run one targeted verification only.

Examples:
• one PHP handler branch changed
• one AJAX path adjusted
• one runtime JS file changed
• one asset registration change
• one widget controller fix
• one render-path fix

Allowed:
• php -l on edited PHP file only
• one syntax-level check on edited JS file only
• one grep only if needed to confirm a rename or reference replacement

Not allowed:
• full project scans
• repeated grep loops
• repeated syntax passes
• multi-command validation theater

4.4 High-Risk Changes: Verification Required

Verification is required when changes affect:
• permissions
• authorization
• object access
• workspace mutation rules
• projection logic
• persistence schema
• migration logic
• shared runtime loading
• asset ordering
• registry/bootstrap payloads
• workspace layout math
• multi-file execution flow
• telemetry stream/intelligence/self-healing coordination
• delete, rename, import, export, or synchronization paths

When required, verification must still be:
• targeted
• once per pass
• limited to the actual risk surface
• summarized plainly

4.5 Large Task Rule

For large tasks, agents must batch work first.

After completing a meaningful implementation pass, the agent should ask:

Edits are complete for this pass. Do you want targeted verification now, or should I continue editing?

Agents must not interrupt large work with repeated verification unless failure or risk requires it.

4.6 Repetition Rule

For iterative sessions with many small similar edits:
• do not verify after each pass
• do not rerun the same check repeatedly
• treat the session as one build stream
• verify once at a natural checkpoint, if requested

⸻

5. Reporting Discipline

5.1 Small Edit Reporting

For small edits, report only:
• files changed
• exact change made
• anything still pending

5.2 Forbidden Reporting Style

Do not use inflated language such as:
• full audit complete
• systemic sweep complete
• enforcement sweep complete
• verified entire codebase
• completed broad validation
• production hardening complete

unless that actually happened and was requested.

5.3 Truthfulness Rule

Claims must match actual work performed.

If the agent changed one file and ran no checks, say that plainly.

If the agent ran one syntax check on one file, say that plainly.

Do not exaggerate local verification into subsystem validation.

⸻

6. WordPress Coding Discipline

6.1 WordPress-Native First

When compatible with confirmed project architecture, prefer:
• WordPress APIs
• WordPress data structures
• WordPress nonce/capability patterns
• WordPress script/style registration patterns
• WordPress CPT/meta/comment/query conventions

Do not invent framework-style abstractions where native WordPress behavior is sufficient.

6.2 No Generic Plugin Boilerplate Drift

Do not introduce generic WordPress boilerplate that ignores project architecture.

SystemDeck already defines:
• asset authority boundaries ￼
• app/runtime boundaries ￼
• workspace layout ownership ￼
• shared object access and projection rules ￼

Code must fit those boundaries, not replace them.

6.3 Keep Server and Client Roles Clean

Use PHP for:
• registration
• boot markup
• capability gating
• nonce and request validation
• canonical data preparation
• WordPress-native storage/query behavior

Use JS for:
• runtime behavior
• client lifecycle
• rendering orchestration
• incremental UI updates
• non-canonical display formatting

Do not push renderer-specific presentation logic into PHP when runtime rendering owns display.

6.4 Asset Loading Discipline

Do not register or enqueue assets ad hoc in widget code when centralized asset authority is confirmed.

Asset behavior must remain compatible with the project’s centralized registration/enqueue contract. ￼

6.5 Access Discipline

Do not inline authorization logic when a confirmed shared access service exists.

Where shared/projected content is involved, use the required services and invariants rather than widget-local logic. ￼

⸻

7. Speed Heuristics

7.1 One-File Rule

If the task is a simple one-file change:
• patch it directly
• do not open a verification loop
• do not broaden scope

7.2 Two-to-Three File Rule

If the task spans two to three files:
• patch only the directly necessary files
• run at most one targeted verification if runtime-sensitive
• do not launch a subsystem sweep

7.3 Four-or-More File Rule

If the task spans four or more files:
• complete a coherent pass first
• summarize what changed
• ask before broad verification unless the changes are high-risk

7.4 Mechanical Change Rule

For repetitive changes:
• batch the edits
• avoid per-file ceremony
• avoid per-file verification
• report the pattern once

⸻

8. Decision Rules for Agents

8.1 When to Patch Immediately

Patch immediately when:
• behavior is confirmed
• file target is clear
• scope is narrow
• no cross-system ambiguity exists

8.2 When to Ask Before Verifying

Ask before verifying when:
• task is mid-stream
• changes are mostly mechanical
• user did not request checks
• task is clearly iterative
• checks would cost more time than value

8.3 When to Stop and Request Exact Context

Stop only when:
• the required file is missing
• two or more materially different implementations are possible
• the behavior depends on unknown project code
• the requested claim cannot be verified from source or governed fallback rules

Do not stop for trivial uncertainty that can be resolved by a narrow, reasonable implementation.

⸻

9. Forbidden Agent Behavior

Agents must not:
• run repeated build loops after trivial edits
• run full grep sweeps for one local change
• perform project-wide verification for one-file fixes
• refactor while fixing unless required
• convert direct patches into abstract architecture
• verify unchanged files
• create “future-proofing” layers during simple tasks
• use long ceremonial reports for small edits
• restate obvious context instead of coding
• invent paths, hooks, services, or storage layers not confirmed in source

⸻

10. Preferred Output Format for Coding Passes

Small Pass
• Files changed
• Exact change
• Any pending note

Medium Pass
• Files changed
• Exact runtime responsibility of each change
• One targeted verification result if performed
• Any risk or deferred item

Large Pass
• Files changed
• Pass summary
• What remains
• Ask whether verification is wanted now

⸻

11. Standing Instruction for Codex / Agents / Models

Use this as the reusable execution directive:

Default to edit-first, verify-later.
Use the narrowest correct patch.
For small or repetitive changes, make the edit and report it without extra verification.
For medium-risk changes, use at most one targeted check.
For large tasks, complete the implementation pass first, then ask whether verification is wanted.
Do not run repeated sweeps, repeated build loops, or broad audits unless explicitly requested or required by the risk surface.
Prefer WordPress-native implementation patterns that fit confirmed project architecture.
Preserve SystemDeck contracts, centralized asset authority, shared access services, and workspace/runtime boundaries. ￼ ￼ ￼

⸻

12. Enforcement Summary

This directive is satisfied only when the agent consistently does all of the following:
• chooses the shortest correct path
• keeps changes file-scoped
• avoids unnecessary verification loops
• asks before broad validation on large tasks
• reports honestly and plainly
• respects WordPress-native patterns
• respects confirmed SystemDeck contracts
• avoids architectural invention
• optimizes for speed without sacrificing correctness

⸻
