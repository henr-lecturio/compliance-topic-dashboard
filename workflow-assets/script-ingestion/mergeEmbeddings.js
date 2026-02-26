// mergeEmbeddings.js
// Führt die OpenAI Embedding-Responses mit den ursprünglichen Chunk-Daten zusammen.
// Ergebnis: Jeder Chunk hat sein Embedding-Array → bereit für Supabase Insert.
//
// Input: OpenAI Embeddings Response (batch) + Chunks aus chunkDocument
// Output: Array von Items mit { course_name, chapter, chunk_index, content, embedding, metadata }

const embeddingResponse = $input.first().json;
const chunks = $('chunkDocument').all().map(i => i.json);

const embeddings = embeddingResponse.data || embeddingResponse;

return chunks.map((chunk, i) => {
  const embeddingObj = Array.isArray(embeddings)
    ? embeddings[i]
    : null;

  return {
    json: {
      course_name: chunk.course_name,
      chapter: chunk.chapter,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      embedding: embeddingObj?.embedding || null,
      metadata: chunk.metadata
    }
  };
});
