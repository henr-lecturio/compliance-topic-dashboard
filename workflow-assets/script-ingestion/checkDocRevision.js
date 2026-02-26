// checkDocRevision.js
// Vergleicht Google Drive modifiedTime mit dem letzten Ingestion-Zeitpunkt.
// Gibt nur Dokumente weiter, die seit dem letzten Lauf geändert wurden.
//
// Input: Array von Items mit { docId, courseName, modifiedTime } + Ingestion-Log aus Supabase
// Output: Nur geänderte Dokumente

const docs = $input.all().map(i => i.json);
const ingestionLog = $('Supabase: Get Ingestion Log').all().map(i => i.json);

const logMap = {};
for (const entry of ingestionLog) {
  logMap[entry.doc_id] = entry.last_modified;
}

const changed = docs.filter(doc => {
  const lastIngested = logMap[doc.docId];
  if (!lastIngested) return true; // Noch nie verarbeitet
  return new Date(doc.modifiedTime) > new Date(lastIngested);
});

if (changed.length === 0) {
  return []; // Keine Änderungen → Workflow stoppt
}

return changed.map(doc => ({ json: doc }));
