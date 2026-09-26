import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { Workspace } from "../domain/workspace"
import { parseNodepadFile, serialiseProject } from "../nodepad-format"
import { workspaceBlocks } from "../domain/workspace-operations"

const canonical: Workspace = {
  id: "p1", name: "Graph", collapsedIds: ["a"], ghostNotes: [],
  entities: [
    { id: "a", type: "idea", title: "A", body: "A", workspaceId: "p1", createdAt: 1, updatedAt: 1,
      metadata: { legacy: { id: "a", text: "A", timestamp: 1, contentType: "idea", annotation: "annotation" } } },
    { id: "b", type: "note", title: "B", body: "B", workspaceId: "p1", createdAt: 2, updatedAt: 2,
      metadata: { legacy: { id: "b", text: "B", timestamp: 2, contentType: "claim" } } },
  ],
  edges: [{ id: "edge", sourceId: "a", targetId: "b", type: "influenced_by", origin: "ai", createdAt: 3, updatedAt: 3 }],
}

describe(".nodepad format", () => {
  it("writes v2 and round-trips canonical edges through collision-safe IDs", () => {
    const file = serialiseProject(canonical)
    assert.equal(file.version, 2)
    const parsed = parseNodepadFile(JSON.stringify(file), ["Graph"])
    assert.equal(parsed.name, "Graph (2)")
    assert.equal(parsed.edges.length, 1)
    assert.equal(parsed.edges[0].sourceId, parsed.entities[0].id)
    assert.equal(parsed.edges[0].targetId, parsed.entities[1].id)
    assert.ok(parsed.entities.every(entity => entity.id.startsWith(`${parsed.id}:`)))
    assert.deepEqual(parsed.collapsedIds, [parsed.entities[0].id])
  })

  it("imports v1 into canonical state without losing metadata or relationships", () => {
    const parsed = parseNodepadFile(JSON.stringify({ version: 1, exportedAt: 1, project: {
      id: "old", name: "Old", collapsedIds: [], ghostNotes: [], blocks: [
        { id: "a", text: "A", timestamp: 1, contentType: "task", annotation: "note", isPinned: true, influencedBy: ["b"] },
        { id: "b", text: "B", timestamp: 2, contentType: "claim" },
      ],
    } }), [])
    const blocks = workspaceBlocks(parsed)
    assert.equal(blocks[0].annotation, "note")
    assert.equal(blocks[0].isPinned, true)
    assert.deepEqual(blocks[0].influencedBy, [blocks[1].id])
    assert.equal(parsed.edges[0].origin, "import")
  })
})
