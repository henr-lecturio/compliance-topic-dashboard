# Compliance Topic Dashboard

Ein Dashboard zur Visualisierung und Kategorisierung von Newsletter-Inhalten. Zwei n8n-Workflows analysieren automatisiert E-Mails aus einem Postfach: Der erste extrahiert Themen und kategorisiert sie, der zweite erstellt wöchentliche Trend-Reports. Die Web-App stellt beide Ergebnisse interaktiv dar.

## Architektur

```
E-Mail-Postfach → n8n Workflow 1 (Gmail Crawler) → Supabase (items) → Dashboard (Überblick)
                  n8n Workflow 2 (Trend Scout)    → Supabase (trend_reports) → Dashboard (Trends)
```

**Workflow 1 — Gmail Crawler:**
- Liest Newsletter-E-Mails aus einem Mail-Postfach
- Analysiert und kategorisiert die Inhalte (Kategorien, Tags, Gesetzesänderungen)
- Schreibt die Ergebnisse per Supabase Node in die `items`-Tabelle

**Workflow 2 — Trend Scout (wöchentlich, So 12:00):**
- Lädt die letzten 90 Tage aus der `items`-Tabelle
- Deterministischer Code Node berechnet Statistiken über 3 Zeitfenster (7d, 30d, 90d)
- AI Agent interpretiert die Statistiken und erstellt einen strukturierten Report
- Speichert Rohdaten + AI-Report in die `trend_reports`-Tabelle

**Web-App:**
- Lädt Daten via Supabase REST API
- **Überblick**: Kategorien als interaktive Doughnut-Charts, Drill-Down zu Tags und E-Mails
- **Trends**: Wöchentliche Trend-Reports mit Content-Empfehlungen

## Features

### Überblick
- Kategorien-Übersicht mit Pie-Chart und Tabelle
- Tag-Verteilung pro Kategorie
- E-Mail-Detail-Ansicht mit Links zu Gmail und Originalartikeln
- Datumsfilter und Filter für Gesetzesänderungen
- Kategorie-Hervorhebung (persistent via localStorage)
- Multi-Select und Markdown-Export

### Trends
- Wöchentlicher AI-gestützter Trend-Report
- Content-Empfehlungen: Sofort umsetzen / Beobachten / Nicht relevant
- Aufsteigende Themen mit prozentualer Veränderung
- Neue Tags (erstmalig aufgetauchte Themen)
- Regulatorische Entwicklungen mit Dringlichkeitsbewertung
- Themen-Cluster (Co-Occurrences)
- Top Tags Bar Chart aus den Rohdaten
- Report-Auswahl über Dropdown (historische Reports)

### Allgemein
- Tab-Navigation (Überblick / Trends)
- Dark Theme, responsive Design

## Datenbank (Supabase)

Tabelle `items`:

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | bigint (auto) | Primary Key |
| `email_id` | text | Gmail Message ID |
| `sender` | text | Absender |
| `email_date` | date | E-Mail-Datum |
| `summary_general` | text | Allgemeine Zusammenfassung |
| `topic_name` | text | Thema |
| `topic_summary` | text | Themen-Zusammenfassung |
| `topic_link` | text | Link zum Originalartikel |
| `is_regulatory_update` | boolean | Gesetzesänderung |
| `matched_categories_tags` | jsonb | Kategorien und Tags |
| `created_at` | timestamptz | Erstellungszeitpunkt |

Tabelle `trend_reports`:

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | bigint (auto) | Primary Key |
| `period_start` | date | Beginn des Analysezeitraums |
| `period_end` | date | Ende des Analysezeitraums |
| `stats_json` | jsonb | Deterministische Statistiken (3 Zeitfenster) |
| `ai_report` | jsonb | Strukturierter AI-Report (6 Sektionen) |
| `created_at` | timestamptz | Erstellungszeitpunkt |

## n8n Code Nodes

### Gmail Crawler (`workflow-assets/gmail-crawler/`)

| Datei | Beschreibung |
|-------|-------------|
| `cleanEmail.js` | Bereinigt E-Mail-Rohdaten vor der AI-Analyse |
| `mapOutput.js` | Mapped AI-Output auf strukturierte Felder |
| `flattenForSupabase.js` | Flacht verschachtelte Topic-Daten für den DB-Insert |

### Trend Scout (`workflow-assets/trend-scout/`)

| Datei | Beschreibung |
|-------|-------------|
| `analyse.js` | Deterministischer Analyst: berechnet Tag-Frequenzen, Trends, Co-Occurrences, HHI, Sender-Diversity |
| `trendExpertPrompt.txt` | System-Prompt für den AI Agent mit n8n Expressions für Dateninjektion |
| `outputSchema.json` | JSON Schema für den Structured Output Parser (6 Report-Sektionen) |

## Tech Stack

- Vanilla HTML/CSS/JS
- [Chart.js](https://www.chartjs.org/) für die Visualisierung
- [Supabase](https://supabase.com/) als Datenbank (PostgreSQL + REST API)
- n8n für die Datenverarbeitung

## Lokale Entwicklung

Die App kann direkt im Browser geöffnet werden — kein Build-Schritt nötig:

```bash
npx serve .
# oder
python3 -m http.server
```
