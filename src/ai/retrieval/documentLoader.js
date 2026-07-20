const { Document } = require("@langchain/core/documents");
const { knowledgeDocuments } = require("./knowledgeBase");

/**
 * Document Loader stage of the RAG pipeline (Part 7):
 * Document Loader -> Text Splitter -> Embeddings -> ChromaDB -> Retriever.
 *
 * Loads the curated knowledge base into LangChain `Document` objects.
 * In-memory today; swap the body of this function for a real loader
 * (DirectoryLoader/TextLoader/PDFLoader/CSVLoader from
 * `@langchain/community/document_loaders`) if the knowledge base moves to
 * actual files — nothing downstream (splitter/embeddings/store) needs to
 * change, since they only depend on getting back `Document[]`.
 */
async function loadKnowledgeDocuments() {
    return knowledgeDocuments.map(
        (item, i) =>
            new Document({
                pageContent: item.text,
                metadata: { category: item.category, sourceId: `seed-${i}` },
            })
    );
}

module.exports = { loadKnowledgeDocuments };
