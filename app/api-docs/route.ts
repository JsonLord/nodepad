import { NextResponse } from "next/server"

export async function GET() {
  const docs = {
    title: "Nodepad Hypotheses API Documentation",
    version: "1.0.0",
    description: "API documentation for Nodepad spatial evidence-to-hypothesis operating system.",
    endpoints: [
      {
        path: "/health",
        method: "GET",
        purpose: "Health check endpoint for Hugging Face Space readiness.",
        request: "None",
        response: { status: "ok", timestamp: "2026-10-06T00:00:00.000Z" }
      },
      {
        path: "/api-docs",
        method: "GET",
        purpose: "Documents all available API endpoints.",
        request: "None",
        response: "JSON object documenting API endpoints."
      },
      {
        path: "/api/v1/llm/status",
        method: "GET",
        purpose: "Get status of environment-configured OpenAI-compatible default LLM provider.",
        request: "None",
        response: { configured: true, provider: "openai-compatible", baseUrl: "https://example.com/v1", model: "gemma-3-12b", status: "available" }
      },
      {
        path: "/api/v1/llm/test",
        method: "POST",
        purpose: "Test prompt on configured default LLM provider.",
        request: "POST JSON: { prompt: 'Respond only with NODEPAD_LLM_OK' } (Requires NODEPAD_API_KEY if configured)",
        response: { content: "NODEPAD_LLM_OK", model: "gemma-3-12b", provider: "openai-compatible" }
      },
      {
        path: "/api/v1/portfolio",
        method: "GET",
        purpose: "Get portfolio summary across workspaces.",
        request: "None",
        response: { workspaces: [], summary: {} }
      },
      {
        path: "/api/v1/workspaces",
        method: "GET",
        purpose: "List all workspaces.",
        request: "None",
        response: ["default", "workspace-1"]
      },
      {
        path: "/api/v1/workspaces/{id}/graph",
        method: "GET",
        purpose: "Query workspace graph with optional filters.",
        request: "Query parameters: nodeId, kind, depth, qualification, important, stale, contested",
        response: { nodes: [], edges: [] }
      },
      {
        path: "/api/v1/workspaces/{id}/context",
        method: "GET",
        purpose: "Get workspace context, revision, heartbeat, and backup status.",
        request: "None",
        response: { id: "default", name: "Default", revision: 1, heartbeat: {}, backup: {} }
      },
      {
        path: "/api/v1/workspaces/{id}/evidence",
        method: "GET / POST",
        purpose: "Fetch or add evidence to workspace.",
        request: "POST JSON: { claim, polarity, source, observedAt }",
        response: "Evidence object"
      },
      {
        path: "/api/v1/workspaces/{id}/hypotheses",
        method: "GET / POST",
        purpose: "Fetch or create hypotheses in workspace.",
        request: "POST JSON: { title, statement, supportingEvidenceIds, contradictingEvidenceIds }",
        response: "Hypothesis object"
      },
      {
        path: "/api/v1/workspaces/{id}/research/tasks",
        method: "GET / POST",
        purpose: "Fetch or create research tasks.",
        request: "POST JSON: { hypothesisId, objective, priority }",
        response: "Research task object"
      },
      {
        path: "/api/v1/workspaces/{id}/research/tasks/{taskId}/claim",
        method: "POST",
        purpose: "Claim a research task for execution.",
        request: "POST JSON: { ttlMs: 60000 }",
        response: "Claim status"
      },
      {
        path: "/api/v1/workspaces/{id}/research/tasks/{taskId}/results",
        method: "POST",
        purpose: "Submit research task results.",
        request: "POST JSON: { findings, evidenceProposals }",
        response: "Submission status"
      },
      {
        path: "/api/v1/workspaces/{id}/brain",
        method: "GET",
        purpose: "Get brain inspector state, qualification badges, gaps, and audit history.",
        request: "None",
        response: { qualification: [], gaps: [], history: [] }
      },
      {
        path: "/api/v1/workspaces/{id}/events",
        method: "GET",
        purpose: "Get workspace event audit stream.",
        request: "None",
        response: []
      },
      {
        path: "/api/v1/workspaces/{id}/events/agent",
        method: "POST",
        purpose: "Record correlated agent event.",
        request: "POST JSON: { eventType, payload }",
        response: "Event record"
      },
      {
        path: "/api/v1/workspaces/{id}/syntheses/run",
        method: "POST",
        purpose: "Run synthesis engine for specified type.",
        request: "POST JSON: { synthesisType: 'contradiction' }",
        response: "Synthesis output"
      },
      {
        path: "/api/v1/workspaces/{id}/heartbeat",
        method: "POST",
        purpose: "Trigger manual heartbeat execution.",
        request: "POST JSON: { runId: 'manual-1' }",
        response: "Heartbeat execution summary"
      },
      {
        path: "/api/v1/workspaces/{id}/github/backup",
        method: "POST",
        purpose: "Trigger GitHub/local workspace backup.",
        request: "None",
        response: { commitSha: "abc", status: "completed" }
      },
      {
        path: "/api/v1/workspaces/{id}/github/restore",
        method: "POST",
        purpose: "Restore workspace from snapshot reference.",
        request: "POST JSON: { ref: 'commit-sha' }",
        response: { restored: true }
      },
      {
        path: "/api/fetch-url",
        method: "POST",
        purpose: "Secure server-side URL fetching for research and web grounding.",
        request: "POST JSON: { url: 'https://example.com' }",
        response: { content: "...", contentType: "text/html" }
      }
    ]
  }

  return NextResponse.json(docs, { status: 200 })
}
