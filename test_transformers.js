const { pipeline } = require('@xenova/transformers');

async function run() {
  console.log("Loading model...");
  const extractor = await pipeline('feature-extraction', 'Supabase/bge-small-en');
  console.log("Model loaded. Running inference...");
  const output = await extractor('This is a test');
  console.log(output.data.length);
}
run();
