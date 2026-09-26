# Personal Work Graph foundation

## Current data flow (Phase 0 audit)

1. `app/page.tsx` creates a temporary `TextBlock`, then calls `enrichBlockClient`.
2. AI enrichment classifies it and returns relationship indices. The page maps those indices back to stable block IDs in `influencedBy`.
3. Projects are loaded and saved as versioned canonical workspaces through `BrowserGraphStore`; legacy project, backup, and old single-project keys remain migration/recovery inputs.
4. `.nodepad` v1 import remains supported, while v2 export/import preserves entities, edge provenance, annotations, sources, subtasks, ghost history, and relationship IDs.
5. Tiling, classic type Kanban, and D3 graph remain legacy projections. Their relationship lookup now passes through the Edge compatibility layer rather than implementing connection semantics independently.

## Foundation boundary

`Entity` and `Edge` are the canonical domain primitives. `TextBlock` is explicitly a classic-UI compatibility type. The adapter preserves IDs and legacy metadata, represents `A.influencedBy = [B]` as `A --influenced_by--> B`, and can reconstruct the classic shape. Edge queries do not depend on React or rendering.

Every task block now remains independently addressable. The old enrichment path that deleted later task blocks and appended them as anonymous subtasks has been removed. Existing embedded subtasks remain readable for backward compatibility; a later migration can promote them to task entities joined by `child_of` edges.

Agent profiles, delegations, routing rules, Laya decisions, AGTX state, and Hermes runtime state are deliberately outside this graph. They will use separate control-plane modules and may reference entity IDs without becoming note entities.

## Canonical browser persistence (Phase 3)

`Workspace.entities` and `Workspace.edges` are now the only mutable project source of truth. Classic `TextBlock[]` values are derived for rendering, and all classic callbacks pass through one centralized compatibility mutation boundary. AI enrichment updates entity metadata and replaces only AI-origin `influenced_by` edges, preserving equivalent/manual edges.

`BrowserGraphStore` stores an explicitly versioned `{ version: 2, activeWorkspaceId, workspaces, savedAt }` record in `nodepad-v2`. Before replacing it, a valid current record is copied to `nodepad-v2-backup`; invalid input is rejected, and an invalid current record never replaces the last-known-good backup. Loading automatically recovers from that backup.

On first load without v2 state, the store reads `nodepad-projects`, then `nodepad-backup`, then the oldest `nodepad-blocks`/`nodepad-collapsed` pair. It validates and verifies v2 storage before writing a migration marker. Legacy keys are deliberately not deleted, providing rollback material. Migration logs counts only, never note bodies.

`.nodepad` exports now use v2 canonical workspaces. Both v1 and v2 imports produce canonical graphs, and imports namespace entity IDs while remapping edges and collapsed IDs to prevent collisions.

## Proposed next PR (PR 3)

PR 3 implements the Debian persistence boundary: explicit browser/server selection configures either `BrowserGraphStore` or `ApiStore`; the same canonical state is served through authenticated same-origin BFF routes and normalized into SQLite workspace, entity, and edge tables. Whole-state writes are transactional and revision-checked, while the browser cache is recovery-only and never queued for later overwrite.

The Hub is intentionally limited to authentication, health, persistence, migration tracking, integrity, and backup/recovery. AGTX, Laya, Hermes, routing/delegation state, new product views, and external sync remain separate future work. See `docs/nodepad-hub.md` for deployment details.
