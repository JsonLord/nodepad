import { NextResponse } from "next/server"
import { getDatabase } from "../../../../lib/server/database"
import { hubError } from "../../../../lib/server/http"

export const runtime = "nodejs"

export function GET() {
  try {
    const db = getDatabase()
    db.prepare("BEGIN IMMEDIATE").run()
    db.prepare("ROLLBACK").run()
    const row = db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number }
    return NextResponse.json({ status: "ok", database: "ready", schemaVersion: row.version, writable: true })
  } catch {
    return hubError("DATABASE_UNAVAILABLE", "Database unavailable", 503)
  }
}
