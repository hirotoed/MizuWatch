# MizuWatch project rules

These rules apply to all work in this repository.

## Read the project direction first

- Before planning or implementation, read `docs/PROJECT_DIRECTION.md`.
- State the active outcome, its connection to the project goal, the scope, and
  the evidence that will prove completion.
- Keep the current task aligned with the decided architecture, current
  priority, and non-goals in `docs/PROJECT_DIRECTION.md`.
- Do not silently switch to an adjacent task or broaden the scope because a
  nearby improvement is convenient.
- If code, an older document, or a requested approach conflicts with the
  project direction, explain the conflict before implementing it.
- The user's latest explicit decision takes precedence. When it changes the
  project direction, update `docs/PROJECT_DIRECTION.md` in the same task.

## Backend boundary

- GAS is a legacy validation and migration asset, not the production backend.
- GAS work was concluded on 2026-08-15. Do not resume it without an explicit
  user decision to change the project direction.
- Do not add GAS features, finish GAS migration, or expand GAS compatibility
  unless the user explicitly changes the project decision.
- Preserve the current GAS path only until a mock or production API replacement
  is verified; then remove it or isolate it as legacy material.
- The production direction is device -> LTE-M -> API -> database -> web app.
- API, database, authentication, and hosting technologies are undecided until
  the user explicitly selects them.

## Repository boundary

- This repository, `hirotoed/MizuWatch`, is the implementation target.
- `Triton-Project/Visualize_Data_webAPP` is read-only reference material. Do not
  mutate the Triton repository without explicit authorization for that exact
  action in the current conversation.

## Handoff and completion

- Report what changed, verification performed, remaining work, and the next
  aligned step.
- Update `docs/PROJECT_DIRECTION.md` whenever a task changes an architectural
  decision, project priority, current state, or open decision.
- Do not describe a partial implementation as complete. Verify the requested
  outcome against the actual files, tests, or runtime behavior first.
