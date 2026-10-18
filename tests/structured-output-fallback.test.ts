import test from "node:test"
import assert from "node:assert/strict"
import { completeChat, getEnvLlmConfig } from "../lib/ai/openai-provider"
import { structuredChat } from "../lib/ai/reasoning"

// Mock fetch wrapper for testing
async function mockFetch(
  url: string | URL | Request,
  options: any,
  responses: Array<{ status: number, body: string }>
): Promise<Response> {
  const nextResponse = responses.shift()
  if (!nextResponse) {
    throw new Error("No more mock responses defined")
  }
  return new Response(nextResponse.body, { status: nextResponse.status })
}

test("structuredChat handles json_schema valid response without fallback", async () => {
    // Setup env
    const prevUrl = process.env.OPENAI_URL;
    const prevKey = process.env.OPENAI_API;
    const prevModel = process.env.OPENAI_MODEL;
    const prevMode = process.env.NODEPAD_STRUCTURED_OUTPUT_MODE;

    process.env.OPENAI_URL = "http://localhost:8080"
    process.env.OPENAI_API = "dummy"
    process.env.OPENAI_MODEL = "dummy-model"
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = "auto"

    const responses = [
        { status: 200, body: JSON.stringify({ choices: [{ message: { content: '{"relation":"supports"}' } }] }) }
    ]

    const mockFetchImpl = async (url: string | URL | Request, options: any) => mockFetch(url, options, responses) as any

    const result = await completeChat({
        messages: [{ role: "user", content: "test" }],
        responseFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: {} } }
    }, mockFetchImpl as any)

    assert.equal(result.content, '{"relation":"supports"}')

    // cleanup
    process.env.OPENAI_URL = prevUrl;
    process.env.OPENAI_API = prevKey;
    process.env.OPENAI_MODEL = prevModel;
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = prevMode;
});

test("structuredChat HTTP 400 mentioning schema causes auto retry with json_object", async () => {
    const prevUrl = process.env.OPENAI_URL;
    const prevKey = process.env.OPENAI_API;
    const prevModel = process.env.OPENAI_MODEL;
    const prevMode = process.env.NODEPAD_STRUCTURED_OUTPUT_MODE;

    process.env.OPENAI_URL = "http://localhost:8080"
    process.env.OPENAI_API = "dummy"
    process.env.OPENAI_MODEL = "test-model-400"
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = "auto"

    const responses = [
        { status: 400, body: "unsupported response_format" }, // First call fails
        { status: 200, body: JSON.stringify({ choices: [{ message: { content: '{"relation":"supports"}' } }] }) } // Retry succeeds
    ]

    let requestCount = 0;
    const mockFetchImpl = async (url: string | URL | Request, options: any) => {
        requestCount++;
        const parsed = JSON.parse(options.body)
        if (requestCount === 2) {
            assert.equal(parsed.response_format?.type, "json_object")
            assert.ok(parsed.messages[0].content.includes("Return exactly one JSON object"))
        }
        return mockFetch(url, options, responses) as any
    }

    const result = await completeChat({
        messages: [{ role: "user", content: "test" }],
        responseFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: {} } }
    }, mockFetchImpl as any)

    assert.equal(result.content, '{"relation":"supports"}')
    assert.equal(requestCount, 2)

    process.env.OPENAI_URL = prevUrl;
    process.env.OPENAI_API = prevKey;
    process.env.OPENAI_MODEL = prevModel;
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = prevMode;
});

test("structuredChat HTTP 200 but assistant content is invalid JSON causes auto retry with json_object", async () => {
    const prevUrl = process.env.OPENAI_URL;
    const prevKey = process.env.OPENAI_API;
    const prevModel = process.env.OPENAI_MODEL;
    const prevMode = process.env.NODEPAD_STRUCTURED_OUTPUT_MODE;

    process.env.OPENAI_URL = "http://localhost:8080"
    process.env.OPENAI_API = "dummy"
    process.env.OPENAI_MODEL = "test-model-200-bad-json"
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = "auto"

    const responses = [
        { status: 200, body: JSON.stringify({ choices: [{ message: { content: '```json\n{"relation":"supports"}\n```' } }] }) }, // First call returns markdown
        { status: 200, body: JSON.stringify({ choices: [{ message: { content: '{"relation":"supports"}' } }] }) } // Retry succeeds with pure JSON
    ]

    let requestCount = 0;
    const mockFetchImpl = async (url: string | URL | Request, options: any) => {
        requestCount++;
        const parsed = JSON.parse(options.body)
        if (requestCount === 2) {
            assert.equal(parsed.response_format?.type, "json_object")
            assert.ok(parsed.messages[0].content.includes("Return exactly one JSON object"))
        }
        return mockFetch(url, options, responses) as any
    }

    const result = await completeChat({
        messages: [{ role: "user", content: "test" }],
        responseFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: {} } }
    }, mockFetchImpl as any)

    assert.equal(result.content, '{"relation":"supports"}')
    assert.equal(requestCount, 2)

    process.env.OPENAI_URL = prevUrl;
    process.env.OPENAI_API = prevKey;
    process.env.OPENAI_MODEL = prevModel;
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = prevMode;
});

test("explicit NODEPAD_STRUCTURED_OUTPUT_MODE=json_schema does not silently downgrade", async () => {
    const prevUrl = process.env.OPENAI_URL;
    const prevKey = process.env.OPENAI_API;
    const prevModel = process.env.OPENAI_MODEL;
    const prevMode = process.env.NODEPAD_STRUCTURED_OUTPUT_MODE;

    process.env.OPENAI_URL = "http://localhost:8080"
    process.env.OPENAI_API = "dummy"
    process.env.OPENAI_MODEL = "test-model-explicit"
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = "json_schema"

    const responses = [
        { status: 400, body: "unsupported response_format" }
    ]

    const mockFetchImpl = async (url: string | URL | Request, options: any) => mockFetch(url, options, responses) as any

    try {
        await completeChat({
            messages: [{ role: "user", content: "test" }],
            responseFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: {} } }
        }, mockFetchImpl as any)
        assert.fail("Should have thrown error instead of falling back")
    } catch (e: any) {
        assert.match(e.message, /LLM provider request failed \(400\)/)
    }

    process.env.OPENAI_URL = prevUrl;
    process.env.OPENAI_API = prevKey;
    process.env.OPENAI_MODEL = prevModel;
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = prevMode;
});

test("credentials are never exposed through fallback errors", async () => {
    const prevUrl = process.env.OPENAI_URL;
    const prevKey = process.env.OPENAI_API;
    const prevModel = process.env.OPENAI_MODEL;
    const prevMode = process.env.NODEPAD_STRUCTURED_OUTPUT_MODE;

    process.env.OPENAI_URL = "http://localhost:8080"
    process.env.OPENAI_API = "SECRET_TOKEN_123"
    process.env.OPENAI_MODEL = "test-model"
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = "json_schema"

    const responses = [
        { status: 500, body: "Server error with SECRET_TOKEN_123 in payload" }
    ]

    const mockFetchImpl = async (url: string | URL | Request, options: any) => mockFetch(url, options, responses) as any

    try {
        await completeChat({
            messages: [{ role: "user", content: "test" }],
            responseFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: {} } }
        }, mockFetchImpl as any)
        assert.fail("Should have thrown error")
    } catch (e: any) {
        assert.ok(!e.message.includes("SECRET_TOKEN_123"))
        assert.ok(e.message.includes("[REDACTED]"))
    }

    process.env.OPENAI_URL = prevUrl;
    process.env.OPENAI_API = prevKey;
    process.env.OPENAI_MODEL = prevModel;
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = prevMode;
});

test("structuredChat throws on invalid JSON even after all fallbacks", async () => {
    const prevUrl = process.env.OPENAI_URL;
    const prevKey = process.env.OPENAI_API;
    const prevModel = process.env.OPENAI_MODEL;
    const prevMode = process.env.NODEPAD_STRUCTURED_OUTPUT_MODE;

    process.env.OPENAI_URL = "http://localhost:8080"
    process.env.OPENAI_API = "dummy"
    process.env.OPENAI_MODEL = "test-model-prose"
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = "auto"

    const mockChat = async (request: any) => {
        // Mocking at the structuredChat layer directly
        return {
            content: "This is some prose.",
            model: "test-model-prose",
            provider: "openai-compatible" as const
        }
    }

    try {
        await structuredChat({ messages: [] }, { type: "object" }, mockChat as any)
        assert.fail("Should have thrown")
    } catch (e: any) {
        assert.match(e.message, /Unexpected token/)
    }

    process.env.OPENAI_URL = prevUrl;
    process.env.OPENAI_API = prevKey;
    process.env.OPENAI_MODEL = prevModel;
    process.env.NODEPAD_STRUCTURED_OUTPUT_MODE = prevMode;
});
