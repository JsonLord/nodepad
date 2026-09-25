# Canonical Projects and Tasks

The Projects view is a projection over the same canonical workspace used by classic Nodepad. Projects are `Entity.type === "project"`; tasks and subtasks are independently addressable `Entity.type === "task"` records. No nested project task array is stored.

Relationships use one canonical direction:

- `Task --belongs_to--> Project`: one primary project is enforced by operations, though the graph format remains extensible.
- `Child Task --child_of--> Parent Task`: new subtasks are first-class tasks and also receive an explicit `belongs_to` edge matching the parent. Historical embedded `subTasks` remain compatibility-only.
- `Task A --depends_on--> Task B`: A is blocked by B; the inverse “Blocking” list is derived rather than persisted as a second edge.

Task completion is solely `status === "done"`. Project progress is derived from done/direct-task counts; child tasks are excluded to avoid double-counting through their parent. Priorities are categorical (`none`, `low`, `medium`, `high`, `urgent`), and due dates use canonical `dueAt` for future Calendar projection.

`lib/projects/operations.ts` centralizes atomic graph transitions for project/task creation, updates, membership, subtasks, dependencies, archiving, and note-to-task conversion. `lib/projects/queries.ts` provides rendering-independent queries suitable for future APIs and Hermes tools. Moving tasks replaces the one primary membership edge without changing task identity or other relationships.

The classic Nodepad type picker already bridges captured thoughts into Projects: changing a note’s content type to task causes the compatibility boundary to change the same canonical entity to `type: "task"`, preserving its ID, body, timestamps, sources, annotations, and graph relationships.

Temporary filters/search remain UI state. Offline Hub cache and revision-conflict states disable Projects interactions and require reloading server authority. Agent assignment is only a disabled visual extension point; no agent/control-plane fields exist on entities.
