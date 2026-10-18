const { pipeline, env } = require('@xenova/transformers');
env.allowLocalModels = false;
async function run() {
  try {
    console.log("Loading onnx-community/google-bert/bert-base-uncased...");
    const extractor = await pipeline('feature-extraction', 'onnx-community/google-bert/bert-base-uncased');
    const output = await extractor('This is a test');
    console.log("Success! Dims:", output.data.length);
  } catch (e) {
    console.error("Failed:", e.message);
  }
}
run();
