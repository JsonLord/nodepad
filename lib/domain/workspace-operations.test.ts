import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { Workspace } from "./workspace"
import { replaceAIInfluencedEdges, workspaceBlocks } from "./workspace-operations"

const base: Workspace = {
  id: "w", name: "W", collapsedIds: [], ghostNotes: [],
  entities: ["a", "b", "c"].map((id, index) => ({ id, type: index === 1 ? "note" : "task", title: id, body: id, workspaceId: "w", createdAt: 1, updatedAt: 1 })),
  edges: [
    { id: "user", sourceId: "a", targetId: "b", type: "influenced_by", origin: "user", createdAt: 1, updatedAt: 1 },
    { id: "old-ai", sourceId: "a", targetId: "c", type: "influenced_by", origin: "ai", createdAt: 1, updatedAt: 1 },
  ],
}

describe("canonical workspace operations", () => {
  it("projects canonical graph relationships and independent task cards", () => {
    const blocks = workspaceBlocks(base)
    assert.deepEqual(blocks.filter(block => block.contentType === "task").map(block => block.id), ["a", "c"])
    assert.deepEqual(blocks[0].influencedBy?.sort(), ["b", "c"])
  })

  it("replaces AI edges without duplicates or deleting user edges", () => {
    const enriched = replaceAIInfluencedEdges(base, "a", ["b", "b", "c"], 0.8)
    assert.equal(enriched.edges.filter(edge => edge.sourceId === "a" && edge.targetId === "b").length, 1)
    assert.equal(enriched.edges.find(edge => edge.id === "user")?.origin, "user")
    assert.equal(enriched.edges.filter(edge => edge.origin === "ai").length, 1)
    assert.equal(enriched.edges.find(edge => edge.origin === "ai")?.targetId, "c")
  })
})
