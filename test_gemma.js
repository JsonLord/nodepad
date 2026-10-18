const { pipeline } = require('@xenova/transformers');

async function run() {
  try {
    console.log("Loading onnx-community/embeddinggemma-2-ONNX...");
    const extractor = await pipeline('feature-extraction', 'onnx-community/embeddinggemma-2-ONNX');
    const output = await extractor('This is a test');
    console.log("Success! Dims:", output.data.length);
  } catch (e) {
    console.error("Failed to load onnx-community/embeddinggemma-2-ONNX:", e.message);
  }
}
run();
