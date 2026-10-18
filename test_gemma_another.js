const { pipeline, env } = require('@xenova/transformers');
env.allowLocalModels = false;
async function run() {
  try {
    console.log("Loading onnx-community/google-bert/bert-base-uncased...");
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
    const output = await extractor('This is a test');
    console.log("Success! Dims:", output.data.length);
  } catch (e) {
    console.error("Failed to load:", e.message);
  }
}
run();
