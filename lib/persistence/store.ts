import type { DomainEvent, KnowledgeEdge, KnowledgeNode, Workspace } from "../domain/types"
export interface NodepadStore {
  getWorkspace(id: string): Promise<Workspace>
  listWorkspaces(): Promise<Workspace[]>
  saveWorkspace(workspace: Workspace): Promise<void>
  listNodes(workspaceId: string, filter?: { kind?: string }): Promise<KnowledgeNode[]>
  upsertNode(node: KnowledgeNode): Promise<void>
  upsertEdge(edge: KnowledgeEdge): Promise<void>
  appendEvent(event: DomainEvent): Promise<void>
  acquireLease(workspaceId: string, owner: string, ttlMs: number): Promise<boolean>
  releaseLease(workspaceId: string, owner: string): Promise<void>
}
