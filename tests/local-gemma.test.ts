import test from "node:test"
import assert from "node:assert/strict"
import { LocalGemmaProvider } from "../lib/embeddings/local-gemma"
import { cosine } from "../lib/embeddings/similarity"

test("local-gemma provider test", async () => {
    const p = new LocalGemmaProvider();
    const t0 = Date.now();
    const res = await p.embed([
        "Customers abandon checkout because payment processing is too slow.",
        "Slow payment processing causes users to leave checkout.",
        "The office kitchen was renovated last month."
    ]);
    const t1 = Date.now();

    assert.equal(res.length, 3);
    assert.equal(res[0].length, 384);

    const simAB = cosine(res[0], res[1]) ?? 0;
    const simAC = cosine(res[0], res[2]) ?? 0;

    assert.ok(simAB > simAC, `simAB: ${simAB} should be > simAC: ${simAC}`);

    console.log(`Cold start latency: ${t1 - t0}ms`);
    console.log(`simAB: ${simAB}`);
    console.log(`simAC: ${simAC}`);

    const t2 = Date.now();
    await p.embed(["Just another text"]);
    const t3 = Date.now();
    console.log(`Warm start latency: ${t3 - t2}ms`);
});
