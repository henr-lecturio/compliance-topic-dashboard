# RAG-System: Script Ingestion + Script Scout Workflow + Dashboard

## Kontext
Das Compliance-Dashboard hat 3 Workflows. Der Deep Dive Analyst (Workflow 3) bewertet regulatorische Updates pro Kurs, kennt aber den **tatsächlichen Kursinhalt** nicht. Mit RAG kann der neue Script Scout Workflow Newsletter-Updates gegen die echten Kursskripte abgleichen und erkennen, ob Kursinhalte veraltet sind.

## Architektur-Übersicht

```
Bestehend:
  Workflow 1 (Gmail Crawler)      → newsletter_topics  → Dashboard (Überblick)
  Workflow 2 (Trend Scout)        → trend_reports       → Dashboard (Trends)
  Workflow 3 (Deep Dive Analyst)  → course_updates      → Dashboard (Kurs-Updates)

Neu:
  Workflow 4 (Script Ingestion)   → course_chunks       (einmalig + bei Änderungen)
  Workflow 5 (Script Scout)       → script_analyses     → Dashboard (Skript-Check)
                                     ↑ liest course_updates + course_chunks
```

---

## Teil A: Script Ingestion Workflow (n8n)

### Neue Dateien: `workflow-assets/script-ingestion/`

| Datei | Zweck |
|-------|-------|
| `courseDocsMap.json` | Mapping: Google Doc ID → Kursname (29 Kategorien) |
| `chunkDocument.js` | Kapitel-basiertes Chunking mit Overlap |
| `checkDocRevision.js` | Nur geänderte Dokumente verarbeiten |
| `mergeEmbeddings.js` | Embeddings mit Chunks zusammenführen |

### n8n Workflow-Ablauf

```
[Schedule/Manual Trigger]
  → [Code: Load Doc Map] (courseDocsMap.json)
  → [Google Drive: Get File Metadata] (modifiedTime pro Doc)
  → [Supabase: Get Ingestion Log]
  → [Code: checkDocRevision.js] (nur geänderte Docs)
  → [IF: Has Changes?]
  → [Split In Batches] (1 Doc pro Durchlauf)
  → [Google Docs: Read Document] (strukturierter JSON-Content)
  → [Code: chunkDocument.js] (Kapitel-erkennung, ~800 Token Chunks, 200 Token Overlap)
  → [Supabase: Delete Old Chunks] (DELETE WHERE course_name = ...)
  → [HTTP Request: OpenAI Embeddings] (text-embedding-3-small, batch)
  → [Code: mergeEmbeddings.js]
  → [Supabase: Insert Chunks] (course_chunks)
  → [Supabase: Upsert Ingestion Log]
```

### Chunking-Strategie (`chunkDocument.js`)
- Google Docs API liefert strukturierten Body mit `paragraphStyle.namedStyleType` (HEADING_1, HEADING_2, NORMAL_TEXT)
- Headings erkennen → Kapitel-Grenzen definieren
- Innerhalb jedes Kapitels: Chunks à ~3200 Zeichen (~800 Tokens) mit 800 Zeichen Overlap
- Nie mitten im Satz splitten (nächste Satzgrenze suchen)
- Jeder Chunk: `{course_name, chapter, chunk_index, content, metadata: {doc_id}}`

### Neue Supabase-Tabelle: `doc_ingestion_log`

```sql
create table doc_ingestion_log (
    id bigint generated always as identity primary key,
    doc_id text not null unique,
    course_name text not null,
    last_modified timestamptz not null,
    chunk_count int not null,
    ingested_at timestamptz default now()
);
```

---

## Teil B: Script Scout Workflow (n8n)

### Neue Dateien: `workflow-assets/script-scout/`

| Datei | Zweck |
|-------|-------|
| `prepareQueries.js` | Actionable Updates extrahieren, Query-Text für Embedding bauen |
| `formatChunksForPrompt.js` | Vektor-Ergebnisse für KI-Prompt formatieren |
| `scriptAnalystPrompt.txt` | KI-Prompt: Skript vs. Update abgleichen |
| `outputSchema.json` | Structured Output Schema |
| `prepareForInsert.js` | KI-Output → DB-Schema mappen |

### n8n Workflow-Ablauf

```
[Schedule Trigger] (wöchentlich, nach Deep Dive)
  → [Supabase: Get Latest Course Updates]
  → [Code: prepareQueries.js] (nur kritisch/prüfen, Query-Text pro Update)
  → [IF: Has Actionable Updates?]
  → [Split In Batches]
  → [HTTP Request: OpenAI Embedding] (Query-Text embedden)
  → [HTTP Request: Supabase RPC match_course_chunks] (Similarity Search)
  → [Code: formatChunksForPrompt.js] (Chunks als Text + Metadaten)
  → [OpenAI: Script Analyst] (scriptAnalystPrompt.txt + outputSchema.json)
  → [Code: prepareForInsert.js]
  → [Supabase: Insert script_analyses]
```

### KI-Prompt-Konzept (`scriptAnalystPrompt.txt`)
Die KI erhält:
1. Das regulatorische Update (Titel, Severity, Zusammenfassung)
2. Relevante Skript-Abschnitte (per Similarity Search gefunden)

Aufgaben der KI:
- **Status** bewerten: `veraltet` | `pruefbedarf` | `aktuell` | `nicht_abgedeckt`
- **Betroffene Abschnitte** auflisten: Kapitel, Problem, empfohlene Änderung
- **Zusammenfassung**: 2-3 Sätze Gesamtbewertung
- **Priorität**: `hoch` | `mittel` | `niedrig`

### Output Schema (`outputSchema.json`)

```json
{
  "status": "veraltet|pruefbedarf|aktuell|nicht_abgedeckt",
  "affected_sections": [{"chapter": "...", "issue": "...", "action": "..."}],
  "summary": "...",
  "priority": "hoch|mittel|niedrig"
}
```

### Neue Supabase-Tabelle: `script_analyses`

```sql
create table script_analyses (
    id bigint generated always as identity primary key,
    course_update_id bigint not null references course_updates(id),
    course_name text not null,
    period_start date,
    period_end date,
    update_title text not null,
    update_severity text not null,
    matched_chunks jsonb default '[]',
    ai_analysis jsonb not null,
    created_at timestamptz default now()
);

create index idx_script_analyses_course on script_analyses(course_name);
create index idx_script_analyses_period on script_analyses(period_end desc);
create index idx_script_analyses_course_update on script_analyses(course_update_id);

-- RLS für Dashboard-Zugriff
alter table script_analyses enable row level security;
create policy "Allow anon read" on script_analyses for select using (true);
alter table doc_ingestion_log enable row level security;
create policy "Allow anon read" on doc_ingestion_log for select using (true);
```

---

## Teil C: Dashboard-Änderungen

### Neue Files
Keine neuen Files — nur Erweiterungen der bestehenden 3 Dateien.

### 1. `index.html` — Änderungen
- **4. Nav-Tab** hinzufügen: `<a href="#script-check" data-tab="script-check">Skript-Check</a>`
- **2 neue View-Container** nach `update-detail-view`:
  - `#script-check-view`: Period-Select, Status-Filter-Pills (Alle/Veraltet/Prüfbedarf/Aktuell/Nicht abgedeckt), Tabelle (Kurs, Update, Status, Priorität)
  - `#script-check-detail-view`: Back-Button, Detail-Content

### 2. `app.js` — Änderungen
- **State-Variablen**: `scriptAnalyses`, `currentStatusFilter`, `parsedScriptChecksForPeriod`
- **Routing** erweitern: `#script-check` und `#script-check/{id}` in `handleRoute()`
- **`hideAllViews()`** erweitern: neue Views verstecken
- **5 neue Funktionen** (nach dem Pattern von showUpdates/showUpdateDetail):
  - `initScriptCheck()` — Event Listener für Period-Select und Status-Pills
  - `showScriptCheck()` — Daten laden, Period-Dropdown füllen, Liste rendern
  - `renderScriptCheckList()` — Tabelle mit Status/Priorität-Badges rendern
  - `showScriptCheckDetail()` — Detail-Ansicht: Bewertung, betroffene Abschnitte, verglichene Chunks
  - `statusLabel()` / `priorityLabel()` — Label-Helper

### 3. `style.css` — Neue Styles
- `.status-pill` — Filter-Buttons (Pattern: `.severity-pill`)
- `.status-badge` — veraltet (rot), pruefbedarf (amber), aktuell (grün), nicht_abgedeckt (grau)
- `.priority-badge` — hoch (rot), mittel (amber), niedrig (grau)
- `#script-check-table` — Tabellen-Styles (Pattern: `#updates-table`)
- `.sc-section-item`, `.sc-chunk-item` — Detail-Ansicht Abschnitte und Chunks
- Responsive: Mobile-Breakpoint für Filter

---

## Implementierungsreihenfolge

1. **Supabase DDL**: `doc_ingestion_log` + `script_analyses` Tabellen + RLS Policies erstellen
2. **Teil A**: Script Ingestion Workflow-Assets erstellen (`workflow-assets/script-ingestion/`)
3. **Teil B**: Script Scout Workflow-Assets erstellen (`workflow-assets/script-scout/`)
4. **Teil C**: Dashboard erweitern (`index.html`, `app.js`, `style.css`)

---

## Verifizierung

1. **Ingestion testen**: `courseDocsMap.json` mit 1-2 Test-Docs füllen → n8n Workflow ausführen → `SELECT * FROM course_chunks` prüfen
2. **Script Scout testen**: Existierende `course_updates` als Input → n8n Workflow ausführen → `SELECT * FROM script_analyses` prüfen
3. **Dashboard testen**: Browser öffnen → Skript-Check Tab → Periode wählen → Status filtern → Detail-Ansicht öffnen
4. **Edge Cases**: Leere Vektor-Ergebnisse (→ "nicht_abgedeckt"), Docs ohne Headings (→ Fallback-Chunking)
