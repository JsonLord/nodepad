import { NextRequest, NextResponse } from "next/server"
import { isHubAuthenticated } from "../../../../lib/server/auth"
import { backupDatabase, getDatabase } from "../../../../lib/server/database"
import { RevisionConflictError, WorkspaceRepository } from "../../../../lib/server/workspace-repository"
import { hubError, readLimitedJson, validateMutationOrigin } from "../../../../lib/server/http"
import { logHub } from "../../../../lib/server/log"

export const runtime = "nodejs"

const unauthorized = () => hubError("AUTH_REQUIRED", "Authentication required", 401)

export function GET(request: NextRequest) {
  if (!isHubAuthenticated(request)) return unauthorized()
  const state = new WorkspaceRepository(getDatabase()).loadState()
  return NextResponse.json(state)
}

export async function PUT(request: NextRequest) {
  if (!isHubAuthenticated(request)) return unauthorized()
  const originError = validateMutationOrigin(request)
  if (originError) return originError
  try {
    const payload = await readLimitedJson(request) as { state?: unknown; expectedRevisions?: Record<string, number> }
    const db = getDatabase()
    await backupDatabase(db)
    const saved = new WorkspaceRepository(db).saveState(payload.state as never, payload.expectedRevisions)
    return NextResponse.json(saved)
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      logHub("hub_conflict", { workspaceId: error.workspaceId, expected: error.expected, actual: error.actual })
      return hubError("REVISION_CONFLICT", "Workspace changed on the server", 409, { workspaceId: error.workspaceId, expectedRevision: error.expected, actualRevision: error.actual })
    }
    const code = (error as { code?: string }).code
    if (code === "REQUEST_TOO_LARGE") return hubError("REQUEST_TOO_LARGE", "Request body exceeds the configured limit", 413)
    if (code === "INVALID_PAYLOAD" || error instanceof SyntaxError || (error instanceof Error && error.message.includes("Invalid canonical"))) return hubError("INVALID_PAYLOAD", "Invalid canonical state payload", 400)
    logHub("hub_request_error", { message: error instanceof Error ? error.message : "unknown" })
    return hubError("INTERNAL_ERROR", "The Hub could not persist state", 500)
  }
}
