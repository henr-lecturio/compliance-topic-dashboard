// prepareForInsert.js
// Mapped den KI-Output auf das script_analyses DB-Schema.
//
// Input: KI-Output (ai_analysis) + Update-Metadaten aus formatChunksForPrompt
// Output: Ein Item bereit für Supabase Insert in script_analyses

const aiOutput = $input.first().json.output || $input.first().json;
const context = $('formatChunksForPrompt').first().json;

return [{
  json: {
    course_update_id: context.course_update_id,
    course_name: context.course_name,
    period_start: context.period_start,
    period_end: context.period_end,
    update_title: context.update_title,
    update_severity: context.update_severity,
    matched_chunks: context.matched_chunks,
    ai_analysis: aiOutput
  }
}];
