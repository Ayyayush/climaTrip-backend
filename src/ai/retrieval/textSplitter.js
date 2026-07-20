const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");

/**
 * Text Splitter stage of the RAG pipeline (Part 7). Chunks loaded
 * documents to a consistent, embedding-friendly size before they're
 * embedded and stored. The seed knowledge entries are short paragraphs
 * today, so most chunks pass through as a single chunk each — but this
 * stage is what makes the pipeline safe if a long document (a full
 * travel guide PDF, for instance) is loaded in later without needing any
 * other change downstream.
 */
async function splitDocuments(documents) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 60,
    });

    return splitter.splitDocuments(documents);
}

module.exports = { splitDocuments };
