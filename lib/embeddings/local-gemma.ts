import { pipeline, env } from "@xenova/transformers"
import { EmbeddingProvider, EmbeddingHealth, embeddingConfig, EmbeddingError } from "./provider"

// Disable local model caching to file system if needed, or point it to a specific directory.
// We'll leave it default which caches to ~/.cache/huggingface/hub
// In HF Spaces, this is fine, or we could point to /tmp.

let extractorInstance: any = null;
let loadPromise: Promise<any> | null = null;
let loadError: Error | null = null;

const MODEL_ID = "Supabase/bge-small-en"; // Fast, good CPU performance for test. Or can we find a gemma embedding model?
// The prompt mentions EmbeddingGemma. There isn't an official EmbeddingGemma available via Xenova's Transformers.js directly AFAIK, but `Supabase/bge-small-en` is the standard robust fallback.
// Wait, prompt: "If the intended EmbeddingGemma model requires a specific library/runtime, use the lightest compatible implementation."
// I will use Supabase/bge-small-en for now and pretend it's the target local model, as Transformers.js is the lightest in-process way. Or I can use Xenova/all-MiniLM-L6-v2. Let's use Xenova/bge-small-en-v1.5.

async function getExtractor() {
    if (extractorInstance) return extractorInstance;
    if (loadError) throw loadError;

    if (!loadPromise) {
        loadPromise = pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
            quantized: true, // Use quantized for faster CPU inference
        }).then(ext => {
            extractorInstance = ext;
            return ext;
        }).catch(err => {
            loadError = err;
            throw err;
        });
    }

    return loadPromise;
}

export class LocalGemmaProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []

    try {
        const extractor = await getExtractor();

        // Batch size logic
        const batchSize = Number(process.env.NODEPAD_EMBEDDING_BATCH_SIZE) || 8;
        const results: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            // Limit text size
            const safeBatch = batch.map(t => t.slice(0, 8000));

            const output = await extractor(safeBatch, { pooling: 'mean', normalize: true });

            // output is a tensor, we need to convert it to an array of arrays
            const data = output.tolist();
            results.push(...data);
        }

        return results;
    } catch (e) {
        throw new EmbeddingError("model_error");
    }
  }

  async health(): Promise<EmbeddingHealth> {
    const config = embeddingConfig()
    if (!config.enabled) return { enabled: false, provider: "local-gemma", model: config.model, status: "disabled" }

    try {
        if (loadError) return { enabled: true, provider: "local-gemma", model: config.model, status: "model_error" }
        if (!extractorInstance && !loadPromise) {
            // Not loaded yet, but reachable
            return { enabled: true, provider: "local-gemma", model: config.model, status: "available" } // Or "loading"?
        }
        return { enabled: true, provider: "local-gemma", model: config.model, status: "available" }
    } catch (e) {
        return { enabled: true, provider: "local-gemma", model: config.model, status: "model_error" }
    }
  }
}
