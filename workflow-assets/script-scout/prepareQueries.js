// prepareQueries.js
// Filtert die neuesten course_updates auf actionable Items (kritisch/prüfen)
// und baut pro konsolidiertem Update einen Query-Text für das Embedding.
//
// Input: Alle course_updates der aktuellsten Periode
// Output: Ein Item pro actionable Update mit Query-Text für Similarity Search

const updates = $input.all().map(i => i.json);

if (updates.length === 0) {
  return [];
}

const results = [];

for (const update of updates) {
  const ai = typeof update.ai_analysis === "string"
    ? JSON.parse(update.ai_analysis)
    : update.ai_analysis;
  const analysis = ai.output || ai;

  const severity = analysis.severity || "zur_kenntnis";

  // Nur kritisch und prüfen weiterverarbeiten
  if (severity === "zur_kenntnis") continue;

  const consolidated = analysis.consolidated_updates || [];

  for (const cu of consolidated) {
    // Auch auf Update-Ebene filtern
    if (cu.severity === "zur_kenntnis") continue;

    // Query-Text: Kombination aus Kursname + Update-Titel + Zusammenfassung
    const queryText = [
      update.course_name,
      cu.title,
      cu.summary
    ].filter(Boolean).join(". ");

    results.push({
      json: {
        course_update_id: update.id,
        course_name: update.course_name,
        period_start: update.period_start,
        period_end: update.period_end,
        update_title: cu.title,
        update_severity: cu.severity || severity,
        update_summary: cu.summary,
        source_links: cu.source_links || [],
        query_text: queryText
      }
    });
  }
}

return results;
