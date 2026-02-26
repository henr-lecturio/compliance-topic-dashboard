// chunkDocument.js
// Kapitel-basiertes Chunking von Google Docs Content.
// Erkennt Headings (HEADING_1, HEADING_2) als Kapitelgrenzen.
// Innerhalb jedes Kapitels: Chunks à ~3200 Zeichen mit 800 Zeichen Overlap.
// Splittet nie mitten im Satz.
//
// Input: Google Docs structured JSON body + { docId, courseName }
// Output: Array von Chunks mit Metadaten

const doc = $input.first().json;
const body = doc.body || doc;
const courseName = $('Split In Batches').first().json.courseName;
const docId = $('Split In Batches').first().json.docId;

const CHUNK_SIZE = 3200;   // ~800 Tokens
const OVERLAP = 800;       // ~200 Tokens

// --- Schritt 1: Absätze aus Google Docs Body extrahieren ---

const paragraphs = [];

const elements = body.content || [];
for (const el of elements) {
  if (!el.paragraph) continue;

  const style = el.paragraph.paragraphStyle?.namedStyleType || "NORMAL_TEXT";
  const text = (el.paragraph.elements || [])
    .map(e => e.textRun?.content || "")
    .join("")
    .trim();

  if (!text) continue;
  paragraphs.push({ style, text });
}

// --- Schritt 2: In Kapitel gruppieren ---

const chapters = [];
let currentChapter = { title: "Einleitung", paragraphs: [] };

for (const p of paragraphs) {
  if (p.style === "HEADING_1" || p.style === "HEADING_2") {
    // Vorheriges Kapitel abschließen (wenn nicht leer)
    if (currentChapter.paragraphs.length > 0) {
      chapters.push(currentChapter);
    }
    currentChapter = { title: p.text, paragraphs: [] };
  } else {
    currentChapter.paragraphs.push(p.text);
  }
}

// Letztes Kapitel abschließen
if (currentChapter.paragraphs.length > 0) {
  chapters.push(currentChapter);
}

// --- Fallback: Keine Headings erkannt → gesamtes Dokument als ein Kapitel ---

if (chapters.length === 0) {
  const allText = paragraphs.map(p => p.text).join("\n\n");
  chapters.push({ title: "Dokument", paragraphs: [allText] });
}

// --- Schritt 3: Kapitel in Chunks aufteilen ---

function findSentenceBoundary(text, pos) {
  // Suche nächste Satzgrenze nach pos
  const sentenceEnders = /[.!?]\s/g;
  sentenceEnders.lastIndex = pos;
  const match = sentenceEnders.exec(text);
  if (match && match.index - pos < 400) {
    return match.index + 1; // Nach dem Satzzeichen
  }
  // Fallback: nächster Zeilenumbruch oder exakte Position
  const newline = text.indexOf("\n", pos);
  if (newline !== -1 && newline - pos < 400) {
    return newline;
  }
  return pos;
}

const chunks = [];

for (const chapter of chapters) {
  const chapterText = chapter.paragraphs.join("\n\n");

  if (chapterText.length <= CHUNK_SIZE) {
    // Kapitel passt in einen Chunk
    chunks.push({
      course_name: courseName,
      chapter: chapter.title,
      chunk_index: chunks.length,
      content: chapterText,
      metadata: { doc_id: docId }
    });
    continue;
  }

  // Kapitel in mehrere Chunks aufteilen
  let start = 0;
  while (start < chapterText.length) {
    let end = start + CHUNK_SIZE;

    if (end < chapterText.length) {
      end = findSentenceBoundary(chapterText, end);
    } else {
      end = chapterText.length;
    }

    chunks.push({
      course_name: courseName,
      chapter: chapter.title,
      chunk_index: chunks.length,
      content: chapterText.slice(start, end),
      metadata: { doc_id: docId }
    });

    // Nächster Start mit Overlap
    start = end - OVERLAP;
    if (start < 0) start = 0;
    // Vermeide Endlosschleife bei sehr kurzen Resten
    if (end >= chapterText.length) break;
  }
}

return chunks.map(chunk => ({ json: chunk }));
