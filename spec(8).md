Nodepad → Hermes Personal Work Graph
Transformation Specification
Repository: `https://github.com/JsonLord/nodepad.git`  
Primary runtime: Debian server running Hermes locally  
Frontend: existing Next.js application, deployable independently from the Debian backend  
Status: Architecture / implementation specification  
Target: evolve Nodepad from an AI-augmented note canvas into a multi-view personal work graph for Hermes.
---
1. Product Vision
Nodepad should become the visual operating system for the local Hermes agent.
The existing Nodepad experience remains available as the classic Nodepad view, but its underlying data model is generalized so notes, tasks, projects, goals, jobs, applications, events, people, companies, and documents can all participate in the same relationship graph.
The central architectural rule is:
> **One shared entity graph, many views.**
Do not build separate databases or isolated state systems for Jobs, Projects, Calendar, Goals, and Notes.
All views must operate on the same canonical entities and edges.
---
2. Primary User Experience
The application should ultimately expose these top-level views:
Home
Daily command center
Upcoming deadlines
Overdue tasks
Active applications
Goal progress
Hermes suggestions
New/inferred connections
Jobs
Job discovery and application pipeline
Company, role, application, next actions, interviews, deadlines
Links to relevant notes, tasks, experience, goals, and documents
Projects
Serious task/project management
Status-based Kanban
Project overview
Priorities, deadlines, blockers, relationships
Imported/synchronized external tasks
Calendar
Day / week / month / agenda
Projection of time-bearing entities
Tasks, events, application deadlines, interviews, project milestones
Goals
Long-term objectives
Linked projects, milestones, tasks, jobs, and other evidence of progress
Calculated progress where possible
Nodepad
Preserve existing classic experience
Tiling
Type-based Kanban
Graph
AI enrichment
Ghost/synthesis notes
AGTX
Native Nodepad tab backed by the external `agtx` runtime
Multi-project coding-agent blackboard
Backlog → Planning → Running → Review → Done
Dependency graph
Agent assignment by phase
Diffs, review state, phase artifacts, and live execution status
Optional live terminal access through a protected backend bridge
Project/task links back into the Nodepad Entity/Edge graph
Orchestrator
Spynel-inspired supervisor console
One chat / command surface for delegating work to many agent backends
Deterministic routing engine outside the models themselves
Online HTTP agents and local CLI agents behind one adapter contract
Visual rule configuration
Per-project and per-task agent assignment
Runtime status, queue, failures, human-input requests, and retries
Programmatic API so Hermes can inspect and modify routing policy
Universal connection mode
Connections are not a separate silo
Hover/select an entity in any relevant view to reveal connected entities
Connections may cross entity types and workspaces
---
3. Existing Nodepad Capabilities to Preserve
The transformation must preserve the existing strengths of Nodepad:
Next.js / React / TypeScript frontend
Existing visual design language
Tiling view
Existing type-based Kanban view
Force-directed D3 graph view
AI enrichment
AI content classification
AI relationship inference
`influencedBy` semantics during migration
Ghost / synthesis notes
Workspaces/projects
Import/export
Existing `.nodepad` files
Local browser support during migration
Undo behavior where practical
Existing provider configuration until the Hermes integration replaces or supplements it
Do not rewrite the frontend framework.
---
PART I — CORE ARCHITECTURE
4. Canonical Domain Model
The current `TextBlock` model is too note-specific.
Introduce a generic entity layer.
4.1 Entity
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
4.2 Edge
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
5. Relationship Rules
Relationships may originate from four major sources:
Explicit
Created by the user.
Example:
```text
Task --belongs_to--> Project
```
Source-native
Imported from an external source.
Example:
```text
Microsoft checklist item --child_of--> Microsoft task
```
Deterministic
Created by application rules.
Example:
```text
Application --application_for--> Job
Job --belongs_to--> Company
```
AI/Hermes inferred
Created probabilistically.
Example:
```text
Note --related_to--> Project
```
AI-created edges must include:
`origin`
`confidence`
optional human-readable `explanation`
Never make AI-inferred relationships indistinguishable from explicit links.
---
6. Relationship Candidate Pipeline
Do not compare every new entity with every existing entity through an LLM.
Use a two-stage pipeline.
Stage A — Candidate Retrieval
Candidate retrieval may use:
same workspace
same project
same goal
same company
same tags
text overlap
recent temporal proximity
common source
full-text search
embeddings/vector similarity later
Produce a small shortlist, ideally 10–20 candidates.
Stage B — Semantic Classification
Hermes or a configured smaller model evaluates the shortlist.
It may:
accept a connection
reject a connection
assign edge type
assign confidence
add an explanation
Store resulting edges.
---
PART II — COMPATIBILITY WITH CURRENT NODEPAD
7. Classic Nodepad Adapter
Do not immediately rewrite every existing UI component.
Introduce an adapter layer so the current Nodepad views can continue consuming a `TextBlock`-like structure while canonical storage transitions to entities and edges.
Example conceptual functions:
```ts
entityToTextBlock(entity, edges): TextBlock
textBlockToEntity(block): Entity
legacyInfluencedByToEdges(blocks): Edge[]
```
The adapter must preserve:
content type
category
annotation
confidence
sources
pin state
ghost-note behavior where relevant
connection highlighting
graph topology
The classic UI should look and behave almost exactly as it did before the migration.
---
8. Legacy `influencedBy` Migration
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
9. Task Migration
Current Nodepad task handling must not remain the long-term project-management model.
Do not automatically flatten separate task cards into the first task card as subtasks.
Going forward:
every task is a first-class entity
subtasks are either:
task entities linked with `child_of`, or
typed child records with stable IDs
Preferred long-term design:
```text
Task B --child_of--> Task A
```
This allows scheduling, linking, prioritizing, and reasoning over individual subtasks.
---
PART III — PERSISTENCE
10. Canonical State
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
temporary cache
offline fallback
migration source
not authoritative
---
11. Database
Use SQLite initially.
Reason:
single-user system
always-on Debian server
easy backups
low operational overhead
sufficient for thousands or hundreds of thousands of graph records
can migrate to PostgreSQL later if necessary
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
entities
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
edges
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
entity type
workspace
status
due date
source/source ID
edge source
edge target
edge type
---
12. Persistence Abstraction
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
PART IV — BACKEND / DEBIAN HUB
13. Nodepad Hub
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
persistence
entity/edge CRUD
migration
connection calculation
external synchronization
Hermes-facing tools
background processing
access control/authentication
audit/activity state
---
PART V — HERMES INTEGRATION
14. Hermes Role
Hermes is the reasoning and action layer.
Hermes must not be the database.
Hermes may:
search entities
read project context
create/update entities
create/update edges
plan tasks
reason about priorities
analyze goals
process job descriptions
suggest relationships
schedule tasks
prepare daily summaries
identify stale projects
identify tasks without goal/project links
Deterministic synchronization should stay outside Hermes.
---
15. Nodepad MCP Server
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
16. Hermes API Integration
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
PART VI — PROJECT / TASK MANAGEMENT
17. Project View
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
status
priority
due date
scheduled time
project relationship
goal relationships
blockers
source
external sync state
related notes
related jobs/applications
Hermes annotation/suggestion
Do not replace the existing classic Nodepad Kanban.
They serve different purposes.
---
PART VII — MICROSOFT TO DO
18. Microsoft To Do Integration
Implement later as a bidirectional synchronization adapter using Microsoft Graph.
Goals:
import lists
import tasks
keep remote IDs
synchronize updates
synchronize completion
preserve local graph relationships
avoid duplicate entities
support delta/incremental synchronization when possible
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
PART VIII — CALENDAR
19. Calendar as Projection
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
day
week
month
agenda
Dragging/scheduling an item updates the underlying entity.
---
PART IX — GOALS
20. Goal Model
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
Which goals have no recent activity?
Which active tasks contribute to no goal?
Which tasks have the highest leverage for a selected goal?
Which projects are stalled?
---
PART X — JOB ASSISTANT
21. Job / Application Domain
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
Job entity metadata
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
Application entity metadata
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
PART XI — FRONTEND ARCHITECTURE
22. Main Navigation
Target primary navigation:
```text
Home
Jobs
Projects
Calendar
Goals
Nodepad
AGTX
Orchestrator
```
Potential secondary/global controls:
```text
Search
Command palette
Hermes
Connection mode
Agent assignment
Agent runtime status
Settings
```
Use the existing Nodepad visual identity rather than creating an unrelated dashboard theme.
---
23. Global Entity Interaction
Where practical, entities should share a common interaction contract.
Examples:
click → details
hover connection indicator → highlight connected items
command → move/link/schedule
open in graph
ask Hermes about this entity
create related task
link to project
link to goal
Avoid reimplementing different relationship behavior in each view.
---
PART XII — FILE FORMAT
24. `.nodepad` Version 2
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
PART XIII — HOME DASHBOARD
25. Dashboard
The Home dashboard should be mostly a projection over graph/database state.
Potential modules:
Today
scheduled tasks
overdue tasks
due soon
meetings/events
Jobs
active applications
interviews
applications needing action
Goals
progress
stale goals
recently advanced goals
Hermes
short suggestions
proposed grouping/linking
proposed day plan
Connections
newly inferred relationships
low-confidence links awaiting confirmation
Avoid embedding large amounts of business logic into dashboard UI components.
---
PART XIV — DEPLOYMENT
26. Debian
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
27. Frontend Host
Keep Next.js.
Two supported deployment models:
Combined
Next.js runs on Debian beside Hermes.
Split
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
PART XV — IMPLEMENTATION PHASES
28. Phase 0 — Safety Baseline
Before structural changes:
inspect current architecture
document current state shape
document important current behavior
add or improve smoke tests around:
project loading
creating note
classification/enrichment boundary
graph relationships
legacy import/export
classic views rendering
Do not overbuild test infrastructure.
---
29. Phase 1 — Entity / Edge Core
Implement:
`Entity`
`Edge`
entity type definitions
edge origin/type definitions
graph helpers
validators/schemas
stable IDs
conversion utilities
No Jobs/Goals/Calendar UI yet.
Acceptance:
typecheck passes
build passes
legacy classic Nodepad data can be represented without loss
graph relationships can be represented independently of cards
---
30. Phase 2 — Compatibility Adapter
Implement:
`TextBlock → Entity`
`Entity → TextBlock`
`influencedBy → Edge`
edge → legacy connection display
workspace/project compatibility
Classic Nodepad views should continue working.
Acceptance:
Tiling works
classic Kanban works
graph works
connection highlighting works
AI enrichment still works
ghost notes still work or have a documented temporary compatibility boundary
---
31. Phase 3 — Storage Abstraction
Introduce repository/storage interfaces.
Initial implementations may include:
```text
LegacyBrowserStore
ServerStore / ApiStore
```
Move React components away from direct persistence concerns.
Acceptance:
UI no longer assumes `localStorage` is canonical
existing local storage data can be migrated
import/export still works
no silent data loss
---
32. Phase 4 — SQLite / Debian API
Implement:
database schema/migrations
entity CRUD
edge CRUD
workspace CRUD
basic query endpoints
migration endpoint/tool for legacy browser projects
local development mode
Acceptance:
app can reload canonical state from backend
relationships survive reload
browser is no longer the only canonical persistence layer
existing `.nodepad` data can be imported
---
33. Phase 5 — Projects / Tasks
Implement:
first-class task entities
first-class project entities
status Kanban
task details
relationships to projects/goals/notes
---
34. Phase 6 — Microsoft To Do
Implement deterministic synchronization adapter.
---
35. Phase 7 — Calendar
Implement calendar projection and scheduling.
---
36. Phase 8 — Goals
Implement goal entities, linked progress, and overview.
---
37. Phase 9 — Jobs
Implement Job, Company, Application views and pipeline.
---
38. Phase 10 — Nodepad MCP
Expose controlled tools to Hermes.
---
39. Phase 11 — Hermes UI
Implement conversational/action panel backed by Hermes server-side integration.
---
40. Phase 12 — Home Dashboard
Build command-center projection after core domains exist.
---

40A. Phase 13 — Agent Runtime Contract
Implement the provider-neutral agent runtime model used by the Orchestrator.
Deliver:
agent registry
agent profiles
capability metadata
local CLI adapter interface
HTTP agent adapter interface
health/readiness state
execution records
assignment records
route-preview endpoint
deterministic rule engine
API for reading and updating rules
No provider-specific UI logic should leak into generic task/project components.
---
40B. Phase 14 — AGTX Integration
Install and integrate `fynnfluegge/agtx` as the coding-agent execution backend.
Nodepad owns the visual integration and cross-domain links.
AGTX continues to own:
coding-agent sessions
tmux lifecycle
per-task git worktrees
coding workflow phases
plugin phase gates
dependency-aware readiness
coding agent switching
coding artifacts
diffs
review state
merge-conflict assistance
Use an adapter boundary rather than copying AGTX internals into Nodepad.
Preferred control boundary:
```text
Nodepad backend
      ↓
AGTX adapter
      ↓
agtx mcp-serve
      ↓
AGTX blackboard/runtime
      ↓
coding CLIs + worktrees + tmux
```
The Nodepad AGTX tab should expose:
registered AGTX projects
board columns
task phase/status
task dependencies
assigned coding agent
current workflow/plugin
task description/spec references
current plan/artifacts when exposed by AGTX
diff/review information
blocked/human-input state
action controls permitted by AGTX
runtime status
open/focus related Nodepad project/task
Nodepad should store cross-system identity mappings, not duplicate AGTX as the source of truth for coding execution state.
Example:
```text
Nodepad Task Entity
    source = "agtx"
    sourceId = "<agtx-task-id>"
       │
       └── belongs_to → Nodepad Project Entity
```
AGTX live terminal
Treat live terminal access as privileged remote-code-execution capability.
Do not expose the AGTX web server directly to the public internet.
If terminal/diff streaming is exposed inside Nodepad, use one of these controlled approaches:
authenticated Nodepad backend proxy to a loopback-only AGTX serve instance, or
a narrow backend bridge to the relevant tmux/AGTX session.
The frontend must never receive unrestricted host credentials.
Use explicit human-visible state when a terminal can accept keyboard input.
AGTX lifecycle ownership
Nodepad may:
register projects
create/assign linked coding tasks
request valid phase transitions
start permitted coding work
query board state
surface AGTX requests for human input
Nodepad must not silently bypass AGTX phase gates.
---
40C. Phase 15 — Orchestrator Tab
Implement a Spynel-inspired orchestration layer without embedding AI intelligence into the router itself.
The principle is:
> orchestration and lifecycle are deterministic; intelligence belongs to the selected agent.
The Orchestrator tab should contain:
Chat / command pane
One primary command surface for requests such as:
```text
Research alternatives to X.
Update the attached spreadsheet.
Implement issue #42.
Prepare a summary of this project.
Delegate the open coding tasks.
```
Hermes is the default supervisor interpreting high-level user intent.
Agent registry
Show configured agent profiles with:
name
adapter type
online/offline locality
endpoint/command identity
supported capabilities
file-access capability
web/research capability
coding capability
model/provider label
enabled/disabled
health
concurrency
cost class
privacy class
current jobs
Runtime queue
Show:
```text
queued
starting
running
waiting_for_agent
waiting_for_human
review
succeeded
failed
cancelled
```
Routing explanation
For every automatic assignment, show:
selected rule
selected agent
relevant capabilities
fallback chain
reason for route
The routing decision must be inspectable.
---
40D. Phase 16 — Routing Rule Engine
Implement a deterministic ordered rules engine for hard constraints and overrides.
Rules are data, not hard-coded `if` statements scattered through UI components.
After hard-rule filtering, use the dedicated Laya System-1 service to select among multiple compatible agents unless the route is already deterministic.
Conceptual rule:
```ts
interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;

  match: {
    workType?: string[];
    hasFiles?: boolean;
    requiresFileWrite?: boolean;
    requiresWeb?: boolean;
    requiresCode?: boolean;
    entityTypes?: EntityType[];
    projectIds?: string[];
    labels?: string[];
    privacy?: string[];
  };

  route: {
    agentProfileId?: string;
    agentPoolId?: string;
    strategy?: "fixed" | "first-healthy" | "least-busy";
    fallbackAgentProfileIds?: string[];
  };
}
```
Initial default rules should model the requested behavior:
```text
1. file-based work
   → preferred local/offline file-capable agent

2. coding work
   → designated coding agent / AGTX workflow

3. research requiring live web
   → designated research agent

4. ordinary non-file online task
   → preferred online general agent

5. explicit user assignment
   → always overrides automatic rules

6. project-level agent assignment
   → preferred unless a task-level override exists

7. task-level assignment
   → highest assignment precedence
```
The exact defaults must be editable.
Rule precedence
Recommended order:
```text
manual task override
        ↓
manual project assignment
        ↓
explicit request constraint
        ↓
highest-priority matching rule
        ↓
project default
        ↓
global fallback
```
Routing must fail closed when no compatible healthy agent exists.
Do not silently send file-based/private work to an online agent because the local agent is unavailable unless an explicit fallback rule allows it.
---
40E. Phase 17 — Agent Configuration UI
Add a configuration area to the Orchestrator tab.
Users must be able to create agent profiles for:
HTTP agents
Support a generic HTTP adapter.
Minimum concepts:
```text
base URL
authentication reference
request mode
health endpoint
capabilities
timeouts
concurrency
```
Prefer server-side secret references rather than browser-stored credentials.
Where practical, support OpenAI-compatible endpoints as a profile type, but do not assume every remote agent is an LLM completion endpoint.
Local CLI agents
Support command-based profiles such as:
```text
executable
arguments
working-directory strategy
environment allowlist
capabilities
timeout
concurrency
```
Never allow the browser to submit arbitrary shell strings directly for execution.
Commands must reference server-side configured/validated profiles.
AGTX coding profile
Expose AGTX as a specialized coding adapter rather than pretending it is a generic completion model.
Hermes
Hermes is a privileged supervisor profile.
Hermes should generally delegate work rather than being selected by ordinary worker-routing rules.
---
40F. Phase 18 — Programmatic Agent/Rule API
Expose a stable backend API used by both the UI and Hermes.
Minimum conceptual endpoints:
```text
GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PATCH  /api/agents/:id
DELETE /api/agents/:id

GET    /api/routing/rules
POST   /api/routing/rules
PATCH  /api/routing/rules/:id
DELETE /api/routing/rules/:id
POST   /api/routing/preview

POST   /api/delegations
GET    /api/delegations/:id
POST   /api/delegations/:id/cancel
POST   /api/delegations/:id/retry

POST   /api/projects/:id/agents
DELETE /api/projects/:id/agents/:agentId

POST   /api/tasks/:id/agent
DELETE /api/tasks/:id/agent
```
Exact REST naming may be adapted.
All mutations should produce activity/audit events.
---
40G. Phase 19 — Project and Kanban Delegation
The normal project-management interface must become agent-aware.
Project overview
Add:
```text
Assigned agents
Default routing policy
Active delegations
Recent agent activity
Human-input requests
```
Allow the user to:
attach one or more agents to a project
select a project default
specify a coding backend
specify a research backend
remove assignments
delegate an entire project goal to Hermes
Task Kanban
Every task card should support:
```text
Assign agent
Delegate now
Change agent
Pause/cancel
Open run
Open artifacts
Ask Hermes
```
Task cards should visibly distinguish:
unassigned
assigned
queued
running
waiting
failed
completed
The same task entity remains the canonical task.
Do not create a duplicate "agent task" if one already exists.
An execution/delegation record references the task entity.
---
40H. Phase 20 — Hermes Supervisor API
Hermes is the top-level supervisor.
Give Hermes narrowly scoped tools/APIs for:
```text
inspect project
inspect task
inspect graph context

preview route
delegate task
delegate project
assign agent
unassign agent

inspect agent health
inspect active runs
cancel run
retry run

read routing rules
create/update routing rules

inspect AGTX board
create linked AGTX coding task
advance an AGTX task when allowed
send approved operator input to an AGTX session

read UI state
change UI layout
focus project/task/entity
open tab
open panel
apply filter
```
Hermes must use the same backend services as the frontend.
Do not create a private second implementation of these operations only for Hermes.
---
40I. Phase 21 — UI Control API
Expose a constrained UI-state API so Hermes can control the dashboard layout.
Treat layout commands as typed state mutations, not arbitrary browser scripting.
Conceptual UI state:
```ts
interface UiLayoutState {
  activeTab:
    | "home"
    | "jobs"
    | "projects"
    | "calendar"
    | "goals"
    | "nodepad"
    | "agtx"
    | "orchestrator";

  activeProjectId?: string;
  activeEntityId?: string;
  activeTaskId?: string;

  leftPanel?: string | null;
  rightPanel?: string | null;

  filters?: Record<string, unknown>;
  connectionMode?: boolean;
  splitView?: {
    primary: string;
    secondary: string;
    ratio?: number;
  };
}
```
Example safe commands:
```text
open_tab("projects")
focus_project(projectId)
focus_task(taskId)
open_entity(entityId)
show_connections(entityId)
set_project_filter(...)
open_agent_run(runId)
open_agtx_task(taskId)
set_split_view("projects", "orchestrator")
close_panel("right")
```
Do not expose:
arbitrary JavaScript execution
arbitrary DOM selectors
arbitrary URL navigation
raw shell execution
Realtime propagation
UI-control changes initiated by Hermes should propagate to connected frontends through a realtime channel such as WebSocket or Server-Sent Events.
When multiple browser clients are connected, define whether layout state is:
per client/session by default, and
optionally broadcast when explicitly requested.
Default to per-session layout control.
---
40J. Phase 22 — Shared Event Bus
Introduce an internal event model so AGTX, the orchestrator, task management, and Hermes do not poll each other aggressively.
Example events:
```text
entity.created
entity.updated
edge.created

task.assigned
task.status_changed

delegation.queued
delegation.started
delegation.waiting_for_human
delegation.completed
delegation.failed

agent.health_changed

agtx.task_changed
agtx.session_output
agtx.review_ready

routing.rule_changed

ui.command
```
The first implementation may use an in-process event bus plus database persistence.
Do not introduce Kafka/Redis merely for this single-user deployment unless later scale requires it.
---
PART XV-A — AGENT CONTROL PLANE ARCHITECTURE
40K. Overall architecture
Target:
```text
                         NODEPAD FRONTEND
 ┌──────────────────────────────────────────────────────────┐
 │ Home Jobs Projects Calendar Goals Nodepad AGTX Agents   │
 │                                                          │
 │ Project/task agent controls   Hermes supervisor console │
 └──────────────────────────┬───────────────────────────────┘
                            │
                     Nodepad Hub API
                            │
       ┌────────────────────┼────────────────────────┐
       │                    │                        │
 Entity/Edge Graph     Routing Engine           UI State
       │                    │                        │
       │             Delegation Manager              │
       │                    │                        │
       │          ┌─────────┼───────────────┐        │
       │          │         │               │        │
       │             Laya System-1                  │
       │          routing decision model             │
       │                    │                        │
       │      AGTX Adapter  HTTP Adapter  CLI Adapter│
       │          │         │               │        │
       │        AGTX     Online agents   Local agents│
       │          │                         │        │
       └──────────┴──────────────┬──────────┴────────┘
                                 │
                              Hermes
                         supervisor/control
```
Hermes is above the router conceptually but accesses it through the same typed service/API boundaries.
---
40L. Agent domain model
Add canonical runtime concepts separate from knowledge entities.
Suggested models:
```ts
interface AgentProfile {
  id: string;
  name: string;

  adapterType:
    | "http"
    | "openai-compatible"
    | "local-cli"
    | "agtx"
    | "hermes";

  enabled: boolean;

  locality: "local" | "remote";
  capabilities: AgentCapability[];

  maxConcurrency: number;
  costClass?: "free" | "low" | "medium" | "high";
  privacyClass?: string;

  config: Record<string, unknown>;
}
```
Capabilities might include:
```text
chat
research
web
file-read
file-write
code
git
shell
document-edit
spreadsheet
analysis
planning
review
```
Execution state:
```ts
interface Delegation {
  id: string;
  taskEntityId?: string;
  projectEntityId?: string;

  agentProfileId: string;
  routedByRuleId?: string;

  status: string;

  request: Record<string, unknown>;
  result?: Record<string, unknown>;

  createdAt: number;
  startedAt?: number;
  finishedAt?: number;

  externalRunId?: string;
}
```
Do not represent an agent itself as a normal Nodepad note.
Agent profiles are system/runtime configuration.
They may nevertheless be referenced from activity edges or audit records.
---
40M. Supervisor versus worker
Maintain a strong distinction:
Supervisor
Hermes:
interprets broad user intent
decomposes work
inspects graph context
chooses whether delegation is needed
requests route previews
creates tasks
assigns agents
monitors results
escalates human decisions
may modify routing rules when explicitly instructed/authorized
controls the UI through typed commands
Workers
Workers:
perform bounded delegated tasks
report progress/results/artifacts
do not silently alter global routing policy
do not gain supervisor privileges merely because they can call Nodepad
AGTX itself is a specialized coding blackboard/runtime containing one or more coding workers.
---
40N. Security boundaries
This system can launch agents that read/write files and execute code.
Treat it as privileged infrastructure.
Required controls:
Nodepad backend, not browser, stores secrets.
Local CLI command profiles are server-configured.
HTTP agent credentials are secret references.
Agent capability checks happen before dispatch.
Manual/project assignment cannot grant capabilities the profile does not have.
File-based work respects privacy/locality rules.
AGTX live-terminal input is explicitly privileged.
UI-control API is typed and allowlisted.
Every delegation and routing mutation is logged.
Cancellation must be supported where an adapter supports it.
Remote fallback for private file work must require an explicit rule.
Never execute arbitrary shell supplied directly by browser/API callers.
Expose no new public ports merely for AGTX or local workers.
Prefer loopback, Unix sockets, stdio, or existing private ingress.

PART XV-B — LAYA SYSTEM-1 ROUTING SERVICE
40O. Laya decision model
Use:
`https://github.com/receptron/laya`
Package:
```bash
npm install @receptron/laya
```
Laya is the preferred low-latency System-1 decision model for choosing between already-eligible agents.
It must not replace deterministic policy enforcement.
The routing pipeline should be:
```text
incoming work
     ↓
extract routing facts
     ↓
hard constraints / explicit overrides
     ↓
eligible agent set
     ↓
Laya System-1 decision endpoint
     ↓
selected agent + calibrated probabilities
     ↓
fallback / confidence policy
     ↓
delegation manager
```
Hard rules before Laya
Hard rules include:
explicit task-level agent assignment
explicit project-level agent assignment where configured as mandatory
required capabilities
file-access requirements
local/offline-only requirements
privacy constraints
disabled agents
unhealthy agents
concurrency limits
forbidden remote fallback
coding work that is explicitly required to use AGTX
user-forced provider/agent
Laya only chooses among candidates that survive these constraints.
It must never be able to route around a security/privacy rule.
---
40P. Dedicated Laya service
Run Laya as a dedicated long-lived Node.js/TypeScript service on the Debian host.
Do not load the ONNX model inside every API request.
Do not depend on a frontend/serverless runtime to hold the model.
Recommended topology:
```text
Nodepad Hub
    │
    ├── Routing Policy Service
    │       │
    │       └── HTTP / Unix-socket
    │              ↓
    │          Laya Service
    │          ONNX Runtime
    │          warm singleton model
    │
    └── Delegation Manager
```
The Laya service may initially run inside the same monorepo/process supervisor as Nodepad, but it should have a clean service boundary.
Prefer:
loopback HTTP, or
Unix domain socket
Do not expose the Laya endpoint publicly.
Runtime expectations
The current Laya Node package uses ONNX Runtime and does not require Python or PyTorch at runtime.
The published fp32 ONNX weights are approximately 1.7 GB and the loaded process should budget roughly 2 GB RAM plus working memory.
Configure:
```text
LAYA_CACHE=/mnt/ssd/.../laya
```
or another persistent Debian cache path appropriate to the installation.
Load once at service startup:
```ts
const laya = await Laya.load({
  cacheDir: process.env.LAYA_CACHE,
  executionProviders: ["cpu"],
});
```
Pin a model revision in production when reproducibility becomes important.
---
40Q. Laya API
Expose a dedicated internal endpoint.
Minimum endpoint:
```text
POST /api/decision/laya/system-one
```
Request concept:
```json
{
  "state": {},
  "questions": {}
}
```
Response mirrors Laya's typed answer model and includes:
```text
choice answers + probability distribution
score answers + distribution
noul answers / P(true)
usage
model metadata
latency
```
Also expose a routing-specific endpoint:
```text
POST /api/decision/laya/route-agent
```
The routing-specific endpoint is preferred for normal orchestrator use because it validates and constructs the decision questions server-side.
Example request:
```json
{
  "work": {
    "id": "task-123",
    "type": "task",
    "title": "Update the Power BI workbook",
    "hasFiles": true,
    "requiresFileWrite": true,
    "requiresWeb": false,
    "requiresCode": false,
    "privacy": "local"
  },
  "candidateAgentIds": [
    "local-files",
    "online-general"
  ]
}
```
Example conceptual response:
```json
{
  "selectedAgentId": "local-files",
  "probabilities": {
    "local-files": 0.96,
    "online-general": 0.04
  },
  "confidence": 0.96,
  "decisionModel": "laya",
  "policy": {
    "eligibleAgentIds": ["local-files"],
    "filteredAgentIds": ["online-general"]
  }
}
```
When only one candidate survives the hard policy layer, dispatch may skip Laya and select the sole eligible candidate deterministically.
---
40R. Routing questions for Laya
Use Laya's typed questions intentionally.
Primary agent selection
Use `choice`.
Example conceptual question:
```ts
{
  agent: {
    type: "choice",
    instructions:
      "Which eligible agent is best suited to execute this work?",
    criteria: {
      "agent-local-files":
        "local, private file editing and document work",
      "agent-online-general":
        "remote general reasoning without private file access",
      "agent-research":
        "live web research and source gathering",
      "agent-agtx":
        "software engineering through the AGTX coding workflow"
    }
  }
}
```
Keep the option set small.
Only pass eligible agents.
Confidence / ambiguity
The primary choice already returns a probability per option.
The router should inspect:
```text
top probability
margin between first and second choice
```
and may optionally ask additional typed questions such as:
```text
requires_human_review → noul
task_complexity       → score
research_intensity    → score
```
Do not call an LLM merely to explain an otherwise straightforward routing decision.
Laya state
Construct compact structured state from:
task/project type
title
short description
file presence
requested operations
required capabilities
privacy/locality
project defaults
prior failed route if retrying
relevant labels
agent availability summary
Do not send the entire Nodepad knowledge graph into Laya.
The model input has a bounded context; routing state should be purpose-built and concise.
---
40S. Laya confidence policy
Laya returns calibrated probabilities.
Use these probabilities operationally.
Example configurable policy:
```text
top probability >= 0.70
AND margin over second choice >= 0.15
    → auto-dispatch

otherwise
    → ask Hermes for a System-2 decision
       OR request human choice
```
The numeric thresholds are defaults only and must be configurable.
For sensitive/private work, policy may require a higher threshold or prohibit automatic remote dispatch entirely.
Escalation chain
Recommended:
```text
hard deterministic policy
      ↓
Laya System-1
      ↓
confident?
  yes → dispatch
  no  → Hermes System-2
            ↓
       still ambiguous?
            ↓
         human
```
This creates a useful separation:
deterministic rules = permissions and invariants
Laya = fast routine choice
Hermes = slower contextual reasoning
human = final authority for ambiguity/sensitive decisions
---
40T. Laya-backed rule configuration
The Rules UI should distinguish between:
Hard constraints
Examples:
```text
private files must remain local
coding tasks use AGTX
agent X is disabled for project Y
```
Laya decision preferences
Examples:
```text
prefer local agents when capability is equal
prefer cheaper agent for routine work
prefer research agent when web evidence is required
prefer coding agent when repository changes are requested
```
Do not compile natural-language preferences directly into shell or agent commands.
Preferences become validated routing features / criteria used to construct Laya questions.
Route preview
The Rules UI should include:
```text
Preview route
```
Given a sample task, show:
```text
1. hard-rule filtering
2. eligible agents
3. Laya probabilities
4. selected agent
5. fallback path
6. whether Hermes escalation would occur
```
This makes the routing system inspectable.
---
40U. Laya administration endpoint
Add internal health/metadata endpoints:
```text
GET /api/decision/laya/health
GET /api/decision/laya/info
```
Health should report only operational metadata such as:
```text
ready
modelLoaded
modelRevision
executionProvider
queueDepth
activeRequests
lastInferenceAt
```
Do not expose secrets or filesystem credentials.
Optional administrative operation:
```text
POST /api/decision/laya/reload
```
must require privileged local/admin authorization.
The normal routing path must not reload the model.
---
40V. Laya observability
Record a lightweight decision audit for every Laya-backed route:
```text
decisionId
workId
candidateAgentIds
filteredAgentIds
selectedAgentId
probabilities
routingRuleVersion
layaModelRevision
latencyMs
escalatedToHermes
humanOverride
timestamp
```
Do not persist unnecessary full private file contents in routing logs.
The purpose is to answer:
Why was this agent chosen?
How certain was the decision?
Which hard rule filtered another agent?
Did Hermes override Laya?
Did the human override both?
This audit should later be visible from an agent run or task details panel.
---
40W. Future feedback loop
Do not train or fine-tune Laya in the first implementation.
However, preserve feedback signals such as:
```text
route accepted
route manually changed
delegation succeeded
delegation failed
retry used different agent
human preference
```
These may later be used to evaluate or improve the routing policy.
Any future model adaptation should be an explicit separate project, not an implicit online-learning loop.
PART XVI — FIRST CODEX IMPLEMENTATION SCOPE
41. First Coding Task
The first Codex task should implement Phases 0–2 only, plus enough scaffolding for Phase 3.
Do NOT attempt to implement:
Microsoft To Do
calendar UI
goals UI
jobs UI
Hermes MCP
Hermes chat
full AGTX runtime integration
full orchestrator worker execution
agent HTTP/CLI spawning
Laya model/service integration
SQLite backend
authentication
background workers
The purpose of the first task is to create a safe architectural seam.
Required outputs
Audit the existing data flow.
Add reusable canonical domain types.
Add edge representation.
Add migration/conversion helpers.
Refactor relationship helpers to consume or understand edges.
Keep classic UI behavior.
Remove or isolate assumptions that tasks must collapse into one task block.
Add tests for conversion/migration.
Update developer documentation.
---
PART XVII — FIRST PR ACCEPTANCE CRITERIA
42. Functional
The following still work:
create a note
enrich a note
classify a note
show annotation
show relationship
Tiling view
classic Kanban
graph
project/workspace switching
import current `.nodepad` file
export current project
---
43. Architecture
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
44. Quality
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
PART XVIII — ENGINEERING RULES
45. Guardrails
Preserve the current UI before improving it.
Prefer small modules over enlarging `app/page.tsx`.
Move domain logic out of React components.
Do not introduce a second frontend framework.
Do not introduce PostgreSQL yet.
Do not expose secrets client-side.
Do not remove `.nodepad` import/export.
Do not delete legacy migration support.
Do not make Hermes a persistence dependency.
Do not call an LLM for deterministic operations.
Do not create pairwise O(n²) LLM relationship evaluation.
Do not combine all future features into the first PR.
Avoid huge generated diffs where possible.
Prefer staged commits.
Keep migrations reversible or at minimum non-destructive.
---
PART XIX — SUGGESTED MODULE BOUNDARIES
46. Possible structure
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
PART XX — DESIGN PRINCIPLE
The transformation is successful when the same underlying object can naturally appear in several interfaces.
Example:
```text
"Prepare Acme interview"
```
is one task entity.
It appears:
in Projects because it belongs to the application-preparation project
in Calendar because it is scheduled
in Goals because it contributes to the career goal
in Jobs because it is a next action for an application
in Graph because it connects to notes, company, job, and interview
to Hermes because it is part of the canonical work graph
There must not be five copied records representing the same task.
---
PART XXI — END STATE
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
PART XXII — REFERENCE INTEGRATIONS
47. AGTX reference implementation
Reference project:
`https://github.com/fynnfluegge/agtx`
AGTX is used as an installed external runtime/service for coding orchestration, not as a source of truth for all Nodepad work.
Integration should target AGTX's supported control surfaces such as its MCP server and supported serve/runtime interfaces rather than relying on undocumented internal files.
If source code is copied or vendored, preserve all license and attribution requirements.
Preferred strategy is dependency/integration, not code copying.
---
48. Spynel design reference
Reference project:
`https://github.com/agent0ai/spynel`
The Orchestrator tab is Spynel-inspired, not a requirement to embed or fork Spynel.
Reuse these architectural ideas:
deterministic orchestration outside the AI
provider-neutral harness/agent adapters
durable task/goal/run state
one primary human communication surface
bounded agentic loops
explicit human escalation
agent configuration independent of task UI
stable automation APIs
Nodepad's own Entity/Edge graph remains the canonical cross-domain knowledge/work model.
---

49. Laya routing reference
Reference project:
`https://github.com/receptron/laya`
Use `@receptron/laya` as the Node.js/TypeScript System-1 decision runtime.
Its role is narrow:
receive compact routing state
evaluate typed routing questions
return calibrated probabilities
remain non-generative
remain subordinate to hard security/capability constraints
escalate ambiguous decisions to Hermes
Do not use Laya as a replacement for Hermes planning, task decomposition, research, coding, or natural-language interaction.
---
PART XXIII — UPDATED END STATE
The final target is:
```text
                               USER
                                │
                             Hermes
                       supervisor layer
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
          Work Graph       Routing Rules       UI Control
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
                         Delegation Manager
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
       AGTX coding          Online agents        Local agents
       blackboard           HTTP adapters        CLI adapters
           │                    │                    │
     coding workers         research/chat       file/private work
           │
  worktrees / phases / review

                                │
                         NODEPAD FRONTEND
       ┌────────┬─────────┬────────┬──────────┬──────────────┐
       │Projects│ Calendar│ Goals  │  Nodepad │ AGTX / Agents│
       └────────┴─────────┴────────┴──────────┴──────────────┘
```
The user can manually assign agents.
Rules can assign agents automatically.
Hermes can supervise and reconfigure the system through typed APIs.
AGTX remains the specialized coding blackboard.
The Orchestrator remains provider-neutral.
The Entity/Edge graph remains the shared source of context connecting human work, agent work, goals, projects, jobs, tasks, notes, and events.
