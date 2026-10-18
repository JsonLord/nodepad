import { pipeline, env } from "@xenova/transformers"
import { EmbeddingProvider, EmbeddingHealth, embeddingConfig, EmbeddingError } from "./provider"

// Transformers.js settings
env.allowLocalModels = false;

let extractorInstance: any = null;
let loadPromise: Promise<any> | null = null;
let loadError: Error | null = null;

async function getExtractor(modelId: string) {
    if (extractorInstance) return extractorInstance;
    if (loadError) throw loadError;

    if (!loadPromise) {
        // use default model id if empty string is passed (for tests running without env var)
        const effectiveModelId = modelId || "Xenova/all-MiniLM-L6-v2";
        loadPromise = pipeline("feature-extraction", effectiveModelId, {
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

export class LocalTransformersProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []

    try {
        const config = embeddingConfig()
        const extractor = await getExtractor(config.model);

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
    const effectiveModelId = config.model || "Xenova/all-MiniLM-L6-v2";
    if (!config.enabled) return { enabled: false, provider: "local-transformers", model: effectiveModelId, status: "disabled" }

    try {
        if (loadError) return { enabled: true, provider: "local-transformers", model: effectiveModelId, status: "model_error" }
        if (!extractorInstance && !loadPromise) {
            // Not loaded yet, but reachable
            return { enabled: true, provider: "local-transformers", model: effectiveModelId, status: "available" }
        }
        return { enabled: true, provider: "local-transformers", model: effectiveModelId, status: "available" }
    } catch (e) {
        return { enabled: true, provider: "local-transformers", model: effectiveModelId, status: "model_error" }
    }
  }
}
