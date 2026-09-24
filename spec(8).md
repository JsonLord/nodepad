# Nodepad → Hermes Personal Work Graph
## Transformation Specification

**Repository:** `https://github.com/JsonLord/nodepad.git`  
**Primary runtime:** Debian server running Hermes locally  
**Frontend:** existing Next.js application, deployable independently from the Debian backend  
**Status:** Architecture / implementation specification  
**Target:** evolve Nodepad from an AI-augmented note canvas into a multi-view personal work graph for Hermes.

---

## 1. Product Vision

Nodepad should become the visual operating system for the local Hermes agent.

The existing Nodepad experience remains available as the **classic Nodepad view**, but its underlying data model is generalized so notes, tasks, projects, goals, jobs, applications, events, people, companies, and documents can all participate in the same relationship graph.

The central architectural rule is:

> **One shared entity graph, many views.**

Do not build separate databases or isolated state systems for Jobs, Projects, Calendar, Goals, and Notes.

All views must operate on the same canonical entities and edges.

---

## 2. Primary User Experience

The application should ultimately expose these top-level views:

1. **Home**
   - Daily command center
   - Upcoming deadlines
   - Overdue tasks
   - Active applications
   - Goal progress
   - Hermes suggestions
   - New/inferred connections

2. **Jobs**
   - Job discovery and application pipeline
   - Company, role, application, next actions, interviews, deadlines
   - Links to relevant notes, tasks, experience, goals, and documents

3. **Projects**
   - Serious task/project management
   - Status-based Kanban
   - Project overview
   - Priorities, deadlines, blockers, relationships
   - Imported/synchronized external tasks

4. **Calendar**
   - Day / week / month / agenda
   - Projection of time-bearing entities
   - Tasks, events, application deadlines, interviews, project milestones

5. **Goals**
   - Long-term objectives
   - Linked projects, milestones, tasks, jobs, and other evidence of progress
   - Calculated progress where possible

6. **Nodepad**
   - Preserve existing classic experience
   - Tiling
   - Type-based Kanban
   - Graph
   - AI enrichment
   - Ghost/synthesis notes

7. **Universal connection mode**
   - Connections are not a separate silo
   - Hover/select an entity in any relevant view to reveal connected entities
   - Connections may cross entity types and workspaces

---

## 3. Existing Nodepad Capabilities to Preserve

The transformation must preserve the existing strengths of Nodepad:

- Next.js / React / TypeScript frontend
- Existing visual design language
- Tiling view
- Existing type-based Kanban view
- Force-directed D3 graph view
- AI enrichment
- AI content classification
- AI relationship inference
- `influencedBy` semantics during migration
- Ghost / synthesis notes
- Workspaces/projects
- Import/export
- Existing `.nodepad` files
- Local browser support during migration
- Undo behavior where practical
- Existing provider configuration until the Hermes integration replaces or supplements it

Do not rewrite the frontend framework.

---

# PART I — CORE ARCHITECTURE

## 4. Canonical Domain Model

The current `TextBlock` model is too note-specific.

Introduce a generic entity layer.

### 4.1 Entity

Recommended conceptual model:

```ts
export type EntityType =
  | "note"
  | "task"
  | "project"
  | "goal"
  | "job"
  | "application"
  | "event"
  | "person"
  | "company"
  | "document"
  | "idea";

export interface Entity {
  id: string;
  type: EntityType;

  title: string;
  body?: string;

  workspaceId?: string;

  status?: string;
  priority?: string;

  createdAt: number;
  updatedAt: number;

  dueAt?: number;
  scheduledStart?: number;
  scheduledEnd?: number;

  source?: string;
  sourceId?: string;
  sourceUrl?: string;

  metadata?: Record<string, unknown>;
}
```

This interface is deliberately general.

Domain-specific data should initially live in `metadata` or typed extension interfaces rather than bloating the base entity.

### 4.2 Edge

Relationships must become first-class records.

```ts
export type EdgeOrigin =
  | "user"
  | "system"
  | "import"
  | "microsoft"
  | "hermes"
  | "ai";

export interface Edge {
  id: string;

  sourceId: string;
  targetId: string;

  type: string;

  origin: EdgeOrigin;
  confidence?: number;
  explanation?: string;

  createdAt: number;
  updatedAt: number;

  metadata?: Record<string, unknown>;
}
```

Initial relationship types should include:

```text
related_to
influenced_by
belongs_to
child_of
contributes_to
depends_on
blocks
supports
contradicts
scheduled_for
application_for
works_at
derived_from
mentioned_in
next_action_for
```

The implementation must allow additional relationship types without schema rewrites.

---

## 5. Relationship Rules

Relationships may originate from four major sources:

### Explicit
Created by the user.

Example:

```text
Task --belongs_to--> Project
```

### Source-native
Imported from an external source.

Example:

```text
Microsoft checklist item --child_of--> Microsoft task
```

### Deterministic
Created by application rules.

Example:

```text
Application --application_for--> Job
Job --belongs_to--> Company
```

### AI/Hermes inferred
Created probabilistically.

Example:

```text
Note --related_to--> Project
```

AI-created edges must include:

- `origin`
- `confidence`
- optional human-readable `explanation`

Never make AI-inferred relationships indistinguishable from explicit links.

---

## 6. Relationship Candidate Pipeline

Do not compare every new entity with every existing entity through an LLM.

Use a two-stage pipeline.

### Stage A — Candidate Retrieval

Candidate retrieval may use:

- same workspace
- same project
- same goal
- same company
- same tags
- text overlap
- recent temporal proximity
- common source
- full-text search
- embeddings/vector similarity later

Produce a small shortlist, ideally 10–20 candidates.

### Stage B — Semantic Classification

Hermes or a configured smaller model evaluates the shortlist.

It may:

- accept a connection
- reject a connection
- assign edge type
- assign confidence
- add an explanation

Store resulting edges.

---

# PART II — COMPATIBILITY WITH CURRENT NODEPAD

## 7. Classic Nodepad Adapter

Do not immediately rewrite every existing UI component.

Introduce an adapter layer so the current Nodepad views can continue consuming a `TextBlock`-like structure while canonical storage transitions to entities and edges.

Example conceptual functions:

```ts
entityToTextBlock(entity, edges): TextBlock
textBlockToEntity(block): Entity
legacyInfluencedByToEdges(blocks): Edge[]
```

The adapter must preserve:

- content type
- category
- annotation
- confidence
- sources
- pin state
- ghost-note behavior where relevant
- connection highlighting
- graph topology

The classic UI should look and behave almost exactly as it did before the migration.

---

## 8. Legacy `influencedBy` Migration

Current Nodepad relationships are stored as block IDs in `influencedBy`.

Migration rule:

```text
block A.influencedBy includes B
```

becomes:

```text
A --influenced_by--> B
```

or, if maintaining exact semantics becomes difficult during compatibility work:

```text
A --related_to--> B
```

Prefer `influenced_by` when the current meaning can be preserved.

Do not discard historical relationships.

---

## 9. Task Migration

Current Nodepad task handling must not remain the long-term project-management model.

Do not automatically flatten separate task cards into the first task card as subtasks.

Going forward:

- every task is a first-class entity
- subtasks are either:
  - task entities linked with `child_of`, or
  - typed child records with stable IDs

Preferred long-term design:

```text
Task B --child_of--> Task A
```

This allows scheduling, linking, prioritizing, and reasoning over individual subtasks.

---

# PART III — PERSISTENCE

## 10. Canonical State

Current browser `localStorage` must no longer be the canonical database once backend persistence is introduced.

Target:

```text
Debian Nodepad service
        ↓
SQLite
        ↓
Entities + Edges + Workspaces + Sync State
```

Browser storage becomes:

- temporary cache
- offline fallback
- migration source
- not authoritative

---

## 11. Database

Use **SQLite initially**.

Reason:

- single-user system
- always-on Debian server
- easy backups
- low operational overhead
- sufficient for thousands or hundreds of thousands of graph records
- can migrate to PostgreSQL later if necessary

Suggested logical tables:

```text
entities
edges
workspaces
sync_sources
sync_state
agent_suggestions
activity_log
schema_migrations
```

### entities

Minimum:

```text
id
type
title
body
workspace_id
status
priority
created_at
updated_at
due_at
scheduled_start
scheduled_end
source
source_id
source_url
metadata_json
```

### edges

Minimum:

```text
id
source_id
target_id
type
origin
confidence
explanation
created_at
updated_at
metadata_json
```

Add indexes for:

- entity type
- workspace
- status
- due date
- source/source ID
- edge source
- edge target
- edge type

---

## 12. Persistence Abstraction

Do not let React components talk directly to SQLite logic.

Create a storage/repository abstraction.

Conceptually:

```text
EntityRepository
EdgeRepository
WorkspaceRepository
```

The frontend should access canonical state through an API or typed client.

This abstraction is required even if the first implementation still has an in-memory or browser-backed compatibility implementation.

---

# PART IV — BACKEND / DEBIAN HUB

## 13. Nodepad Hub

Introduce a server-side service on Debian.

Suggested responsibility boundaries:

```text
server/
├── api/
├── db/
├── graph/
├── repositories/
├── sync/
├── hermes/
├── jobs/
├── goals/
├── calendar/
└── migrations/
```

Exact directory naming may be adapted to the existing repository conventions.

The backend is responsible for:

- persistence
- entity/edge CRUD
- migration
- connection calculation
- external synchronization
- Hermes-facing tools
- background processing
- access control/authentication
- audit/activity state

---

# PART V — HERMES INTEGRATION

## 14. Hermes Role

Hermes is the **reasoning and action layer**.

Hermes must not be the database.

Hermes may:

- search entities
- read project context
- create/update entities
- create/update edges
- plan tasks
- reason about priorities
- analyze goals
- process job descriptions
- suggest relationships
- schedule tasks
- prepare daily summaries
- identify stale projects
- identify tasks without goal/project links

Deterministic synchronization should stay outside Hermes.

---

## 15. Nodepad MCP Server

Expose a narrow MCP surface for Hermes.

Initial target tools:

```text
nodepad.search
nodepad.get_entity
nodepad.create_entity
nodepad.update_entity
nodepad.delete_entity

nodepad.get_connections
nodepad.create_edge
nodepad.remove_edge
nodepad.find_connection_candidates

nodepad.list_tasks
nodepad.create_task
nodepad.complete_task

nodepad.list_projects
nodepad.get_project_context

nodepad.list_goals
nodepad.get_goal_status

nodepad.calendar_range
nodepad.schedule_task

nodepad.list_jobs
nodepad.update_application

nodepad.dashboard_context
```

Do not implement all tools in the first PR.

First PR only needs the underlying architecture required for these future tools.

---

## 16. Hermes API Integration

The frontend may later provide a Hermes panel.

Target flow:

```text
Browser
  ↓
Nodepad frontend/BFF
  ↓ authenticated server-to-server request
Debian Nodepad Hub
  ↓
Hermes API
  ↓
Hermes tools
  ↓
Nodepad MCP
  ↓
SQLite
```

Never expose Hermes secrets directly to browser JavaScript.

---

# PART VI — PROJECT / TASK MANAGEMENT

## 17. Project View

Create a dedicated project-management view separate from the classic type-based Nodepad Kanban.

Recommended default columns:

```text
Inbox
Next
In Progress
Waiting
Done
```

Tasks should support:

- status
- priority
- due date
- scheduled time
- project relationship
- goal relationships
- blockers
- source
- external sync state
- related notes
- related jobs/applications
- Hermes annotation/suggestion

Do not replace the existing classic Nodepad Kanban.

They serve different purposes.

---

# PART VII — MICROSOFT TO DO

## 18. Microsoft To Do Integration

Implement later as a bidirectional synchronization adapter using Microsoft Graph.

Goals:

- import lists
- import tasks
- keep remote IDs
- synchronize updates
- synchronize completion
- preserve local graph relationships
- avoid duplicate entities
- support delta/incremental synchronization when possible

Store source metadata such as:

```text
source = microsoft_todo
sourceListId
sourceTaskId
remoteUpdatedAt
syncCursor
```

Important:

> Hermes does not perform the mechanical synchronization loop.

Synchronization is deterministic backend code.

Hermes may classify imported tasks and suggest project/goal links afterward.

---

# PART VIII — CALENDAR

## 19. Calendar as Projection

Do not build an isolated calendar database.

Calendar displays any entity with time-bearing attributes.

Examples:

```text
Task        → dueAt / scheduledStart / scheduledEnd
Event       → scheduledStart / scheduledEnd
Application → deadline
Job         → closing date
Project     → milestone
Goal        → milestone
Interview   → event
```

Target views:

- day
- week
- month
- agenda

Dragging/scheduling an item updates the underlying entity.

---

# PART IX — GOALS

## 20. Goal Model

Goals sit above projects conceptually but must not force a strict tree.

Supported patterns:

```text
Goal
 ├─ Project
 │   └─ Task
 └─ Task
```

and:

```text
Task ──contributes_to──> Goal A
Task ──contributes_to──> Goal B
```

Goal progress should be calculated from linked milestones/tasks where practical.

Hermes should later be able to answer queries such as:

- Which goals have no recent activity?
- Which active tasks contribute to no goal?
- Which tasks have the highest leverage for a selected goal?
- Which projects are stalled?

---

# PART X — JOB ASSISTANT

## 21. Job / Application Domain

Job pipeline:

```text
discovered
interested
preparing
applied
interview
offer
closed
rejected
withdrawn
```

### Job entity metadata

Possible fields:

```text
company
role
location
description
salary
deadline
requirements
source
```

### Application entity metadata

Possible fields:

```text
jobId
status
appliedAt
cvVersion
coverLetter
contact
nextAction
interviewDates
notes
```

Recommended deterministic edges:

```text
Application --application_for--> Job
Job --belongs_to--> Company
Task --next_action_for--> Application
Application --contributes_to--> Career Goal
Interview --related_to--> Application
```

Job-specific tasks automatically appear in Projects.

Job/application deadlines automatically appear in Calendar.

Research and notes remain visible in classic Nodepad.

---

# PART XI — FRONTEND ARCHITECTURE

## 22. Main Navigation

Target primary navigation:

```text
Home
Jobs
Projects
Calendar
Goals
Nodepad
```

Potential secondary/global controls:

```text
Search
Command palette
Hermes
Connection mode
Settings
```

Use the existing Nodepad visual identity rather than creating an unrelated dashboard theme.

---

## 23. Global Entity Interaction

Where practical, entities should share a common interaction contract.

Examples:

- click → details
- hover connection indicator → highlight connected items
- command → move/link/schedule
- open in graph
- ask Hermes about this entity
- create related task
- link to project
- link to goal

Avoid reimplementing different relationship behavior in each view.

---

# PART XII — FILE FORMAT

## 24. `.nodepad` Version 2

Preserve import/export.

Current v1 files must remain importable.

Introduce a v2 format along these lines:

```json
{
  "version": 2,
  "exportedAt": 0,
  "workspaces": [],
  "entities": [],
  "edges": [],
  "metadata": {}
}
```

Migration requirements:

```text
v1 → v2 supported
v2 export supported
v1 import remains supported
```

Never silently destroy unknown metadata during migration when it can be preserved.

---

# PART XIII — HOME DASHBOARD

## 25. Dashboard

The Home dashboard should be mostly a projection over graph/database state.

Potential modules:

### Today
- scheduled tasks
- overdue tasks
- due soon
- meetings/events

### Jobs
- active applications
- interviews
- applications needing action

### Goals
- progress
- stale goals
- recently advanced goals

### Hermes
- short suggestions
- proposed grouping/linking
- proposed day plan

### Connections
- newly inferred relationships
- low-confidence links awaiting confirmation

Avoid embedding large amounts of business logic into dashboard UI components.

---

# PART XIV — DEPLOYMENT

## 26. Debian

Expected long-term services:

```text
Hermes
Nodepad backend
SQLite
Nodepad MCP
sync workers
```

Do not expose unnecessary backend ports publicly.

The exact ingress mechanism is outside this repository unless already present.

---

## 27. Frontend Host

Keep Next.js.

Two supported deployment models:

### Combined
Next.js runs on Debian beside Hermes.

### Split
Hosted Next.js frontend / BFF talks securely to Debian.

For split deployment:

```text
Browser
   ↓
Hosted Next.js
   ↓ authenticated server-side API
Debian Nodepad Hub
```

Hermes API credentials and Microsoft credentials must never be shipped to the browser.

---

# PART XV — IMPLEMENTATION PHASES

## 28. Phase 0 — Safety Baseline

Before structural changes:

- inspect current architecture
- document current state shape
- document important current behavior
- add or improve smoke tests around:
  - project loading
  - creating note
  - classification/enrichment boundary
  - graph relationships
  - legacy import/export
  - classic views rendering

Do not overbuild test infrastructure.

---

## 29. Phase 1 — Entity / Edge Core

Implement:

- `Entity`
- `Edge`
- entity type definitions
- edge origin/type definitions
- graph helpers
- validators/schemas
- stable IDs
- conversion utilities

No Jobs/Goals/Calendar UI yet.

Acceptance:

- typecheck passes
- build passes
- legacy classic Nodepad data can be represented without loss
- graph relationships can be represented independently of cards

---

## 30. Phase 2 — Compatibility Adapter

Implement:

- `TextBlock → Entity`
- `Entity → TextBlock`
- `influencedBy → Edge`
- edge → legacy connection display
- workspace/project compatibility

Classic Nodepad views should continue working.

Acceptance:

- Tiling works
- classic Kanban works
- graph works
- connection highlighting works
- AI enrichment still works
- ghost notes still work or have a documented temporary compatibility boundary

---

## 31. Phase 3 — Storage Abstraction

Introduce repository/storage interfaces.

Initial implementations may include:

```text
LegacyBrowserStore
ServerStore / ApiStore
```

Move React components away from direct persistence concerns.

Acceptance:

- UI no longer assumes `localStorage` is canonical
- existing local storage data can be migrated
- import/export still works
- no silent data loss

---

## 32. Phase 4 — SQLite / Debian API

Implement:

- database schema/migrations
- entity CRUD
- edge CRUD
- workspace CRUD
- basic query endpoints
- migration endpoint/tool for legacy browser projects
- local development mode

Acceptance:

- app can reload canonical state from backend
- relationships survive reload
- browser is no longer the only canonical persistence layer
- existing `.nodepad` data can be imported

---

## 33. Phase 5 — Projects / Tasks

Implement:

- first-class task entities
- first-class project entities
- status Kanban
- task details
- relationships to projects/goals/notes

---

## 34. Phase 6 — Microsoft To Do

Implement deterministic synchronization adapter.

---

## 35. Phase 7 — Calendar

Implement calendar projection and scheduling.

---

## 36. Phase 8 — Goals

Implement goal entities, linked progress, and overview.

---

## 37. Phase 9 — Jobs

Implement Job, Company, Application views and pipeline.

---

## 38. Phase 10 — Nodepad MCP

Expose controlled tools to Hermes.

---

## 39. Phase 11 — Hermes UI

Implement conversational/action panel backed by Hermes server-side integration.

---

## 40. Phase 12 — Home Dashboard

Build command-center projection after core domains exist.

---

# PART XVI — FIRST CODEX IMPLEMENTATION SCOPE

## 41. First Coding Task

The first Codex task should implement **Phases 0–2 only**, plus enough scaffolding for Phase 3.

Do NOT attempt to implement:

- Microsoft To Do
- calendar UI
- goals UI
- jobs UI
- Hermes MCP
- Hermes chat
- SQLite backend
- authentication
- background workers

The purpose of the first task is to create a safe architectural seam.

### Required outputs

1. Audit the existing data flow.
2. Add reusable canonical domain types.
3. Add edge representation.
4. Add migration/conversion helpers.
5. Refactor relationship helpers to consume or understand edges.
6. Keep classic UI behavior.
7. Remove or isolate assumptions that tasks must collapse into one task block.
8. Add tests for conversion/migration.
9. Update developer documentation.

---

# PART XVII — FIRST PR ACCEPTANCE CRITERIA

## 42. Functional

The following still work:

- create a note
- enrich a note
- classify a note
- show annotation
- show relationship
- Tiling view
- classic Kanban
- graph
- project/workspace switching
- import current `.nodepad` file
- export current project

---

## 43. Architecture

The PR must introduce:

```text
Entity
Edge
EntityType
EdgeOrigin
```

and a compatibility/migration layer.

Relationship semantics must no longer be hard-coded only as:

```text
TextBlock.influencedBy
```

The new architecture must allow:

```text
Entity ↔ Edge ↔ Entity
```

independently of rendering.

---

## 44. Quality

Before finishing:

```bash
npm install
npm run lint
npm run build
```

Run any repository tests that exist or are introduced.

Do not claim success if commands fail.

Document known remaining issues.

---

# PART XVIII — ENGINEERING RULES

## 45. Guardrails

- Preserve the current UI before improving it.
- Prefer small modules over enlarging `app/page.tsx`.
- Move domain logic out of React components.
- Do not introduce a second frontend framework.
- Do not introduce PostgreSQL yet.
- Do not expose secrets client-side.
- Do not remove `.nodepad` import/export.
- Do not delete legacy migration support.
- Do not make Hermes a persistence dependency.
- Do not call an LLM for deterministic operations.
- Do not create pairwise O(n²) LLM relationship evaluation.
- Do not combine all future features into the first PR.
- Avoid huge generated diffs where possible.
- Prefer staged commits.
- Keep migrations reversible or at minimum non-destructive.

---

# PART XIX — SUGGESTED MODULE BOUNDARIES

## 46. Possible structure

Adapt this to the existing repository rather than following it mechanically:

```text
lib/
├── domain/
│   ├── entity.ts
│   ├── edge.ts
│   ├── workspace.ts
│   └── schemas.ts
│
├── graph/
│   ├── relationships.ts
│   ├── legacy-adapter.ts
│   └── candidates.ts
│
├── storage/
│   ├── types.ts
│   ├── legacy-browser-store.ts
│   └── index.ts
│
├── migrations/
│   ├── nodepad-v1.ts
│   └── index.ts
│
└── nodepad/
    └── legacy-block-adapter.ts
```

Do not create unnecessary abstraction layers if a smaller implementation achieves the same clean separation.

---

# PART XX — DESIGN PRINCIPLE

The transformation is successful when the same underlying object can naturally appear in several interfaces.

Example:

```text
"Prepare Acme interview"
```

is one task entity.

It appears:

- in Projects because it belongs to the application-preparation project
- in Calendar because it is scheduled
- in Goals because it contributes to the career goal
- in Jobs because it is a next action for an application
- in Graph because it connects to notes, company, job, and interview
- to Hermes because it is part of the canonical work graph

There must not be five copied records representing the same task.

---

# PART XXI — END STATE

The target architecture is:

```text
                     NODEPAD FRONTEND
                           │
      ┌──────────┬─────────┼─────────┬──────────┐
      │          │         │         │          │
    Notes      Tasks     Goals      Jobs      Events
      │          │         │         │          │
      └──────────┴─────────┴─────────┴──────────┘
                           │
                    ENTITY / EDGE GRAPH
                           │
                     NODEPAD HUB API
                           │
                        SQLite
                           │
                ┌──────────┴──────────┐
                │                     │
             Hermes                Sync adapters
                │                     │
          reasoning/tools        Microsoft To Do
```

The graph is the product core.

The views are projections.

Hermes reasons over the graph.

External systems synchronize through adapters.

Classic Nodepad remains the spatial thinking interface over the same information universe.
