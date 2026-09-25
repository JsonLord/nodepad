import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sessionValue, tokenMatches } from "./auth"

describe("Hub authentication", () => {
  it("accepts only the configured token and derives a non-secret session value", () => {
    process.env.NODEPAD_API_TOKEN = "correct-horse-battery-staple"
    assert.equal(tokenMatches("correct-horse-battery-staple"), true)
    assert.equal(tokenMatches("wrong"), false)
    assert.notEqual(sessionValue(), process.env.NODEPAD_API_TOKEN)
  })
})
