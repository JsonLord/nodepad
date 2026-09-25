export type HubEvent = "hub_started" | "hub_auth_failed" | "hub_conflict" | "db_migration" | "db_backup" | "db_restore" | "db_integrity_failed" | "hub_request_error" | "control_plane_updated"
export function logHub(event: HubEvent, fields: Record<string, string | number | boolean | undefined> = {}): void {
  console.info(JSON.stringify({ component: "nodepad-hub", event, timestamp: new Date().toISOString(), ...fields }))
}
