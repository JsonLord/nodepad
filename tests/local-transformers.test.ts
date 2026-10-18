import test from "node:test"
import assert from "node:assert/strict"
import { LocalTransformersProvider, resetLocalTransformersState, setMockPipeline } from "../lib/embeddings/local-transformers"

test("local-transformers loads and reuses singleton correctly", async () => {
    resetLocalTransformersState();
    let loadCount = 0;

    setMockPipeline(async (task: any, modelId: any, options: any) => {
        loadCount++;
        return async (texts: any, opts: any) => {
            return {
                tolist: () => texts.map((t: string) => [t.length, 0, 0])
            }
        }
    });

    const prevModel = process.env.NODEPAD_EMBEDDING_MODEL;
    const prevEnabled = process.env.NODEPAD_EMBEDDING_ENABLED;
    process.env.NODEPAD_EMBEDDING_MODEL = "test-model-1";
    process.env.NODEPAD_EMBEDDING_ENABLED = "true";

    const p = new LocalTransformersProvider();

    // Initial state
    const h1 = await p.health();
    assert.equal(h1.status, "not_configured");

    const res1 = await p.embed(["a", "bc"]);
    assert.deepEqual(res1, [[1, 0, 0], [2, 0, 0]]);
    assert.equal(loadCount, 1);

    const h2 = await p.health();
    assert.equal(h2.status, "available");

    // Second call should reuse the same model
    const res2 = await p.embed(["def"]);
    assert.deepEqual(res2, [[3, 0, 0]]);
    assert.equal(loadCount, 1); // No new load

    // Changing the model should trigger a reload
    process.env.NODEPAD_EMBEDDING_MODEL = "test-model-2";

    const h3 = await p.health();
    assert.equal(h3.status, "not_configured"); // Changed model resets state

    const res3 = await p.embed(["ghij"]);
    assert.deepEqual(res3, [[4, 0, 0]]);
    assert.equal(loadCount, 2);

    process.env.NODEPAD_EMBEDDING_MODEL = prevModel;
    process.env.NODEPAD_EMBEDDING_ENABLED = prevEnabled;
});

test("local-transformers batches texts appropriately", async () => {
    resetLocalTransformersState();

    let batchesProcessed = 0;
    setMockPipeline(async (task: any, modelId: any, options: any) => {
        return async (texts: any, opts: any) => {
            batchesProcessed++;
            return {
                tolist: () => texts.map((t: string) => [1])
            }
        }
    });

    const prevBatch = process.env.NODEPAD_EMBEDDING_BATCH_SIZE;
    process.env.NODEPAD_EMBEDDING_BATCH_SIZE = "2";

    const p = new LocalTransformersProvider();
    const res = await p.embed(["1", "2", "3", "4", "5"]);

    assert.equal(res.length, 5);
    assert.equal(batchesProcessed, 3); // 2 + 2 + 1

    process.env.NODEPAD_EMBEDDING_BATCH_SIZE = prevBatch;
});

test("local-transformers handles malformed vectors/error fallback", async () => {
    resetLocalTransformersState();

    setMockPipeline(async (task: any, modelId: any, options: any) => {
        throw new Error("Failed to load model");
    });

    const prevEnabled = process.env.NODEPAD_EMBEDDING_ENABLED;
    process.env.NODEPAD_EMBEDDING_ENABLED = "true";

    const p = new LocalTransformersProvider();
    try {
        await p.embed(["test"]);
        assert.fail("Should throw EmbeddingError");
    } catch (e: any) {
        assert.equal(e.status, "model_error");
    }

    const h = await p.health();
    assert.equal(h.status, "model_error");

    process.env.NODEPAD_EMBEDDING_ENABLED = prevEnabled;
});
