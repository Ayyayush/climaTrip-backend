/**
 * Full RAG ingestion pipeline (Part 7):
 * Document Loader -> Text Splitter -> Embeddings -> ChromaDB
 *
 * Run with: node src/ai/retrieval/seed.js
 * Safe to re-run — Chroma dedupes on the same collection/documents.
 */
const dotenv = require("dotenv");
dotenv.config();

const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { loadKnowledgeDocuments } = require("./documentLoader");
const { splitDocuments } = require("./textSplitter");
const { getEmbeddings, COLLECTION_NAME } = require("./vectorStore");
const logger = require("../../utils/logger");

async function seed() {
    // 1. Load
    const rawDocuments = await loadKnowledgeDocuments();
    logger.info(`Loaded ${rawDocuments.length} source documents`);

    // 2. Split
    const chunks = await splitDocuments(rawDocuments);
    logger.info(`Split into ${chunks.length} chunks`);

    // 3 + 4. Embed and store in ChromaDB
    await Chroma.fromDocuments(chunks, getEmbeddings(), {
        collectionName: COLLECTION_NAME,
        url: process.env.CHROMA_URL || "http://localhost:8000",
    });

    logger.info(`Seeded ${chunks.length} chunks into Chroma collection "${COLLECTION_NAME}"`);
    process.exit(0);
}

seed().catch((error) => {
    logger.error("Seeding failed", { error: error.message });
    process.exit(1);
});
