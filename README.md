# Compliance Topic Dashboard

Ein Dashboard zur Visualisierung und Kategorisierung von Newsletter-Inhalten im Bereich Compliance. Fünf n8n-Workflows analysieren automatisiert E-Mails, erstellen Trend-Reports, bewerten regulatorische Updates pro Kurs und gleichen Änderungen gegen die Kursskripte ab. Die Web-App stellt alle Ergebnisse interaktiv in 4 Tabs dar.

## Architektur

```
E-Mail-Postfach → WF 1  Gmail Crawler        → newsletter_topics   → Dashboard (Überblick)
                  WF 2  Trend Scout           → trend_reports       → Dashboard (Trends)
                  WF 3  Deep Dive Analyst     → course_updates      → Dashboard (Kurs-Updates)
Google Docs    → WF 4  Script Ingestion      → course_chunks       (einmalig + bei Änderungen)
                  WF 5  Script Scout           → script_analyses     → Dashboard (Skript-Check)
                                                  ↑ liest course_updates + course_chunks
```

### Workflow 1 — Gmail Crawler
- Liest Newsletter-E-Mails aus einem Mail-Postfach
- Analysiert und kategorisiert die Inhalte (Kategorien, Tags, Gesetzesänderungen)
- Schreibt die Ergebnisse in die `newsletter_topics`-Tabelle

### Workflow 2 — Trend Scout (wöchentlich, So 12:00)
- Lädt die letzten 90 Tage aus `newsletter_topics`
- Deterministischer Code Node berechnet Statistiken über 3 Zeitfenster (7d, 30d, 90d)
- AI Agent interpretiert die Statistiken und erstellt einen strukturierten Report
- Speichert Rohdaten + AI-Report in `trend_reports`

### Workflow 3 — Deep Dive Analyst (wöchentlich)
- Lädt regulatorische Updates der letzten 7 Tage aus `newsletter_topics`
- Gruppiert nach betroffenen Kursen, AI Agent konsolidiert und bewertet Kritikalität
- Speichert die Analyse pro Kurs in `course_updates`

### Workflow 4 — Script Ingestion (geplant)
- Liest 66 Kursskripte (33 Kurse, 3 Tiers: FK/MA/Essentials) aus Google Docs
- Kapitel-basiertes Chunking (~800 Tokens, 200 Token Overlap)
- Embeddings via OpenAI `text-embedding-3-small`
- Speichert Chunks + Vektoren in `course_chunks`

### Workflow 5 — Script Scout (geplant)
- Nimmt kritische/prüfen-Updates aus `course_updates`
- Similarity Search gegen `course_chunks`
- AI Agent bewertet ob Kursskripte veraltet sind
- Speichert Ergebnis in `script_analyses`

## Kurse & Skripte

33 Compliance-Kurse mit insgesamt 66 Skripten in 3 Tiers:

| Tier | Beschreibung | Anzahl |
|------|-------------|--------|
| FK | Führungskräfte-Skripte | variabel pro Kurs |
| MA | Mitarbeiter-Skripte | variabel pro Kurs |
| Essentials | Kompakt-Version | 10 Kurse |

Das Mapping liegt in `workflow-assets/script-ingestion/courseDocsMap.json` als 1:N-Struktur:
```json
[{ "courseName": "Datenschutz", "docs": [{ "docId": "...", "docTitle": "094_Datenschutz_FK", "type": "FK" }, ...] }]
```

## Dashboard (Web-App)

4 Tabs mit URL-basiertem Routing (`#overview`, `#trends`, `#updates`, `#script-check`):

| Tab | Beschreibung |
|-----|-------------|
| **Überblick** | Kategorien-Doughnut-Charts, Tag-Drill-Down, E-Mail-Details, Datumsfilter, Markdown-Export |
| **Trends** | Wöchentliche AI-Reports, Content-Empfehlungen, aufsteigende Themen, neue Tags, Cluster |
| **Kurs-Updates** | Regulatorische Updates pro Kurs mit Severity-Badges und Handlungsempfehlungen |
| **Skript-Check** | Skript-Bewertungen pro Update mit Status/Priorität und betroffenen Abschnitten |

## Datenbank (Supabase)

5 Tabellen (3 aktiv, 2 geplant):

| Tabelle | Status | Beschreibung |
|---------|--------|-------------|
| `newsletter_topics` | aktiv | E-Mail-Topics mit Kategorien und Tags |
| `trend_reports` | aktiv | Wöchentliche Trend-Reports (Statistiken + AI-Report) |
| `course_updates` | aktiv | Regulatorische Bewertungen pro Kurs |
| `course_chunks` | geplant | Skript-Chunks mit Embeddings für Similarity Search |
| `script_analyses` | geplant | Skript-Bewertungen (veraltet/prüfbedarf/aktuell) |

## Projektstruktur

```
/
├── src/                        Web-App
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── assets/                 Icons (favi.ico, SVGs)
├── workflow-assets/            n8n Code Nodes & Prompts
│   ├── gmail-crawler/          WF 1: cleanEmail, mapOutput, flattenForSupabase
│   ├── trend-scout/            WF 2: analyse, trendExpertPrompt, outputSchema
│   ├── deep-dive/              WF 3: groupByCourse, courseAnalystPrompt, outputSchema
│   ├── script-ingestion/       WF 4: courseDocsMap, chunkDocument, checkDocRevision, mergeEmbeddings
│   └── script-scout/           WF 5: prepareQueries, formatChunksForPrompt, scriptAnalystPrompt, outputSchema, prepareForInsert
├── README.md
├── NEXT-STEP.md
└── .gitignore                  *.png, node_modules/, .env, .DS_Store
```

## Tech Stack

- Vanilla HTML/CSS/JS (kein Build-Schritt)
- [Chart.js](https://www.chartjs.org/) für Visualisierung
- [Supabase](https://supabase.com/) als Datenbank (PostgreSQL + REST API)
- [n8n](https://n8n.io/) für Workflow-Automatisierung
- OpenAI API für AI-Analyse und Embeddings

## Lokale Entwicklung

```bash
npx serve src
```
