// formatChunksForPrompt.js
// Formatiert die Vektor-Suchergebnisse (matched Chunks) als lesbaren Text für den KI-Prompt.
// Enthält Kapitel-Kontext und Similarity Score.
//
// Input: Supabase RPC match_course_chunks Ergebnis + Update-Daten aus vorherigem Schritt
// Output: Zusammengeführte Daten mit formatiertem Chunk-Text

const chunks = $input.all().map(i => i.json);
const update = $('Split In Batches').first().json;

// Chunks nach Similarity absteigend sortieren (sollte schon sortiert sein)
const sorted = [...chunks].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

// Chunks als lesbaren Text formatieren
const formattedChunks = sorted.map((chunk, i) => {
  const sim = chunk.similarity ? (chunk.similarity * 100).toFixed(1) : "?";
  return [
    `--- Skript-Abschnitt ${i + 1} (Relevanz: ${sim}%) ---`,
    `Kapitel: ${chunk.chapter || "Unbekannt"}`,
    ``,
    chunk.content
  ].join("\n");
}).join("\n\n");

// matched_chunks für DB-Speicherung (kompakt)
const matchedChunks = sorted.map(chunk => ({
  chunk_id: chunk.id,
  chapter: chunk.chapter,
  chunk_index: chunk.chunk_index,
  similarity: chunk.similarity ? parseFloat(chunk.similarity.toFixed(4)) : null
}));

const hasChunks = sorted.length > 0;

return [{
  json: {
    // Update-Daten durchreichen
    course_update_id: update.course_update_id,
    course_name: update.course_name,
    period_start: update.period_start,
    period_end: update.period_end,
    update_title: update.update_title,
    update_severity: update.update_severity,
    update_summary: update.update_summary,
    source_links: update.source_links,
    // Chunk-Daten
    matched_chunks: matchedChunks,
    formatted_chunks: hasChunks
      ? formattedChunks
      : "Keine relevanten Skript-Abschnitte gefunden. Das Thema wird im aktuellen Kursskript möglicherweise nicht behandelt.",
    chunk_count: sorted.length
  }
}];
