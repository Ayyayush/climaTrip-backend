const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/hf_transformers");
const logger = require("../../utils/logger");

const COLLECTION_NAME = "climatrip_travel_knowledge";

let embeddingsSingleton;
let vectorStoreSingleton;

// Local, offline embedding model (no OpenAI/paid key required) — good
// enough for retrieval over a modest knowledge base of travel guides.
function getEmbeddings() {
    if (!embeddingsSingleton) {
        embeddingsSingleton = new HuggingFaceTransformersEmbeddings({
            modelName: "Xenova/all-MiniLM-L6-v2",
        });
    }
    return embeddingsSingleton;
}

async function getVectorStore() {
    if (vectorStoreSingleton) return vectorStoreSingleton;

    vectorStoreSingleton = await Chroma.fromExistingCollection(getEmbeddings(), {
        collectionName: COLLECTION_NAME,
        url: process.env.CHROMA_URL || "http://localhost:8000",
    }).catch(async (error) => {
        logger.warn("Chroma collection not found yet, creating an empty one", {
            error: error.message,
        });
        return new Chroma(getEmbeddings(), {
            collectionName: COLLECTION_NAME,
            url: process.env.CHROMA_URL || "http://localhost:8000",
        });
    });

    return vectorStoreSingleton;
}

/**
 * Retriever stage of the RAG pipeline (Part 7). Wraps the vector store in
 * LangChain's standard Retriever interface so it can be composed directly
 * into a chain (e.g. `retriever.pipe(...)`) elsewhere, not just called
 * ad hoc.
 */
async function getRetriever(k = 4) {
    const store = await getVectorStore();
    return store.asRetriever({ k });
}

/**
 * Retrieves the top-K most relevant knowledge chunks for a destination /
 * query. Never throws — RAG is an enhancement, not a hard dependency, so
 * a ChromaDB outage degrades to "no extra context" instead of a 500.
 */
async function retrieveContext(query, k = 4) {
    try {
        const retriever = await getRetriever(k);
        const results = await retriever.invoke(query);
        if (!results.length) return "No specific retrieved knowledge for this destination.";
        return results.map((doc, i) => `[${i + 1}] ${doc.pageContent}`).join("\n");
    } catch (error) {
        logger.warn("RAG retrieval failed, continuing without retrieved context", {
            error: error.message,
        });
        return "No retrieved knowledge available (retrieval service unavailable).";
    }
}

module.exports = { getVectorStore, getEmbeddings, getRetriever, retrieveContext, COLLECTION_NAME };
