const { pipeline, env } = require('@xenova/transformers');
env.allowLocalModels = false;

async function run() {
  console.log("Testing with pipeline...");
  const extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { quantized: true });
  const output = await extractor(["This is a test", "Another test"], { pooling: 'mean', normalize: true });
  console.log(output.tolist());
}
run();
