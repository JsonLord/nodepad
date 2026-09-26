import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { TextBlock } from "./legacy-types"
import { blocksToWorkGraph, entityToTextBlock, legacyInfluencedByToEdges, textBlockToEntity } from "./legacy-adapter"
import { getConnectedEntityIds } from "../graph/relationships"
import { migrateNodepadV1 } from "../migrations/nodepad-v1"

const source: TextBlock = {
  id: "task-a",
  text: "Ship graph foundation",
  timestamp: 100,
  contentType: "task",
  category: "Delivery",
  annotation: "Keep compatibility",
  confidence: 0.91,
  sources: [{ url: "https://example.test", title: "Example", siteName: "example.test" }],
  influencedBy: ["note-b"],
  isPinned: true,
  subTasks: [{ id: "legacy-child", text: "Old child", isDone: false, timestamp: 90 }],
}

const target: TextBlock = {
  id: "note-b",
  text: "Relationship source",
  timestamp: 80,
  contentType: "claim",
}

describe("classic Nodepad graph adapter", () => {
  it("converts a TextBlock to an Entity without losing legacy presentation data", () => {
    const entity = textBlockToEntity(source, "workspace-1")
    assert.deepEqual({ id: entity.id, type: entity.type, title: entity.title, body: entity.body, workspaceId: entity.workspaceId, createdAt: entity.createdAt }, {
      id: source.id,
      type: "task",
      title: source.text,
      body: source.text,
      workspaceId: "workspace-1",
      createdAt: 100,
    })
    assert.deepEqual((entity.metadata?.legacy as TextBlock).subTasks, source.subTasks)
    assert.equal((entity.metadata?.legacy as TextBlock).annotation, source.annotation)
    assert.equal("influencedBy" in (entity.metadata?.legacy as object), false)
  })

  it("converts an Entity and Edge graph back to the legacy TextBlock shape", () => {
    const { entities, edges } = blocksToWorkGraph([source, target], "workspace-1")
    assert.deepEqual(entityToTextBlock(entities[0], edges), source)
  })

  it("turns influencedBy IDs into stable directed edges", () => {
    assert.deepEqual(legacyInfluencedByToEdges([source, target]).map(({ id, sourceId, targetId, type, origin }) => ({ id, sourceId, targetId, type, origin })), [
      {
        id: "edge:task-a:influenced_by:note-b",
        sourceId: "task-a",
        targetId: "note-b",
        type: "influenced_by",
        origin: "import",
      },
    ])
  })

  it("queries related IDs without UI data structures", () => {
    const edges = legacyInfluencedByToEdges([source, target])
    assert.deepEqual([...getConnectedEntityIds("note-b", edges)].sort(), ["note-b", "task-a"])
  })

  it("migrates a v1 project without relationship loss", () => {
    const migrated = migrateNodepadV1({
      version: 1,
      project: { id: "project-1", name: "Work", blocks: [source, target], collapsedIds: ["note-b"] },
    })
    assert.equal(migrated.entities.length, 2)
    assert.equal(migrated.edges.length, 1)
    assert.equal(migrated.edges[0].sourceId, "task-a")
    assert.equal(migrated.edges[0].targetId, "note-b")
    assert.deepEqual(migrated.legacy.collapsedIds, ["note-b"])
  })

  it("keeps separate task blocks as independent entities", () => {
    const anotherTask = { ...source, id: "task-c", text: "Review graph foundation", influencedBy: [] }
    const graph = blocksToWorkGraph([source, anotherTask, target], "workspace-1")
    assert.deepEqual(graph.entities.filter(entity => entity.type === "task").map(entity => entity.id), ["task-a", "task-c"])
  })
})
