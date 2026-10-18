const { pipeline, env } = require('@xenova/transformers');
// Can we disable the local models warning?
env.allowLocalModels = false;
async function run() {
  try {
    console.log("Loading Xenova/bge-small-en-v1.5...");
    const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    const output = await extractor('This is a test');
    console.log("Success! Dims:", output.data.length);
  } catch (e) {
    console.error("Failed to load Xenova/bge-small-en-v1.5:", e.message);
  }
}
run();
