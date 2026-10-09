import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { serializeWorkspace, restoreSerialized } from "../lib/github-sync/serialization"
import { exportBrain } from "../lib/brain/export"
import { isBlockedHost } from "../app/api/fetch-url/route"
import { fixture } from "./helpers"

test("SEC-01/CORE-10/11 backup, brain and restoration exclude auth/model metadata", () => {
  const w = fixture()
  const secrets = ["SUPER_SECRET_LOGIN_928374", "SUPER_SECRET_NODEPAD_API_928374", "SUPER_SECRET_OPENAI_928374"]
  w.nodes.push({ id: "safe", workspaceId: w.id, kind: "observation", title: "safe", metadata: { NODEPAD_LOGIN_KEY: secrets[0], NODEPAD_API_KEY: secrets[1], OPENAI_API: secrets[2], sessionToken: "private-session", authorization: "Bearer private" }, version: 1, createdAt: w.createdAt, updatedAt: w.updatedAt, provenance: { origin: "human", createdAt: w.createdAt } })
  const snapshot = serializeWorkspace(w)
  for (const secret of [...secrets, "private-session"]) assert.equal(JSON.stringify(snapshot).includes(secret), false)
  for (const secret of secrets) assert.equal(JSON.stringify(exportBrain(w)).includes(secret), false)
  assert.equal(restoreSerialized(snapshot).nodes.length, 1)
})
test("SEC-04 SSRF localhost/private/file targets blocked", () => {
  for (const url of ["http://localhost", "http://127.0.0.1", "http://10.0.0.1", "http://169.254.169.254", "http://192.168.1.1", "http://[::1]", "file:///etc/passwd"]) assert.equal(isBlockedHost(url), true)
})
test("AUTH-04/12 timing-safe comparison and Automaker-derived login UI states", () => {
  assert.match(readFileSync("lib/auth/server.ts", "utf8"), /timingSafeEqual/)
  const source = readFileSync("components/login-view.tsx", "utf8")
  for (const text of ["Authentication Required", "Nodepad", 'type="password"', "Authenticating", "Invalid access key", "Server Unavailable", "Retry Connection"]) assert.ok(source.includes(text))
  assert.doesNotMatch(source.replace(/^\/\/.*$/gm, ""), /Automaker/)
})
