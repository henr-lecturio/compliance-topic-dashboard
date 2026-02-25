# Compliance Topic Dashboard

Ein Dashboard zur Visualisierung und Kategorisierung von Newsletter-Inhalten. Drei n8n-Workflows analysieren automatisiert E-Mails aus einem Postfach: Der erste extrahiert Themen und kategorisiert sie, der zweite erstellt wöchentliche Trend-Reports, der dritte bewertet regulatorische Updates pro Kurs und gibt Handlungsempfehlungen. Die Web-App stellt alle Ergebnisse interaktiv dar.

## Architektur

```
E-Mail-Postfach → n8n Workflow 1 (Gmail Crawler)       → Supabase (newsletter_topics)   → Dashboard (Überblick)
                  n8n Workflow 2 (Trend Scout)         → Supabase (trend_reports)       → Dashboard (Trends)
                  n8n Workflow 3 (Deep Dive Analyst)   → Supabase (course_updates)      → Dashboard (Kurs-Updates)
```

**Workflow 1 — Gmail Crawler:**
- Liest Newsletter-E-Mails aus einem Mail-Postfach
- Analysiert und kategorisiert die Inhalte (Kategorien, Tags, Gesetzesänderungen)
- Schreibt die Ergebnisse per Supabase Node in die `newsletter_topics`-Tabelle

**Workflow 2 — Trend Scout (wöchentlich, So 12:00):**
- Lädt die letzten 90 Tage aus der `newsletter_topics`-Tabelle
- Deterministischer Code Node berechnet Statistiken über 3 Zeitfenster (7d, 30d, 90d)
- AI Agent interpretiert die Statistiken und erstellt einen strukturierten Report
- Speichert Rohdaten + AI-Report in die `trend_reports`-Tabelle

**Workflow 3 — Deep Dive Analyst (wöchentlich):**
- Lädt regulatorische Updates der letzten 7 Tage aus der `newsletter_topics`-Tabelle
- Gruppiert die Beiträge nach betroffenen Kursen (= Kategorien)
- AI Agent konsolidiert die Updates pro Kurs, bewertet die Kritikalität und gibt Handlungsempfehlungen
- Speichert die Analyse pro Kurs in die `course_updates`-Tabelle

**Web-App:**
- Lädt Daten via Supabase REST API
- **Überblick**: Kategorien als interaktive Doughnut-Charts, Drill-Down zu Tags und E-Mails
- **Trends**: Wöchentliche Trend-Reports mit Content-Empfehlungen
- **Kurs-Updates**: Regulatorische Updates pro Kurs mit Severity-Bewertung und Handlungsempfehlungen

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

### Kurs-Updates
- Listenansicht aller betroffenen Kurse pro Periode mit Severity-Badge und Update-Anzahl
- Detail-Ansicht pro Kurs mit konsolidierten Updates, Quelllinks und Handlungsempfehlung
- Severity-Filter (Alle / Kritisch / Prüfen / Zur Kenntnis)
- Perioden-Auswahl über Dropdown (historische Berichte)
- URL-basiertes Routing (`#updates`, `#updates/<id>`) mit Browser-Navigation

### Allgemein
- Tab-Navigation (Überblick / Trends / Kurs-Updates)
- Dark Theme, responsive Design

## Datenbank (Supabase)

Tabelle `newsletter_topics`:

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

Tabelle `course_updates`:

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | bigint (auto) | Primary Key |
| `course_name` | text | Name des betroffenen Kurses |
| `period_start` | date | Beginn des Analysezeitraums |
| `period_end` | date | Ende des Analysezeitraums |
| `item_ids` | jsonb | IDs der zugrunde liegenden Newsletter-Beiträge |
| `ai_analysis` | jsonb | AI-Bewertung (Severity, konsolidierte Updates, Empfehlung) |
| `created_at` | timestamptz | Erstellungszeitpunkt |

### `ai_analysis` Schema (Deep Dive)

```json
{
  "severity": "kritisch | prüfen | zur_kenntnis",
  "consolidated_updates": [
    {
      "title": "Kurzer Titel des Sachverhalts",
      "severity": "kritisch | prüfen | zur_kenntnis",
      "summary": "Was ist passiert? 2-3 Sätze.",
      "source_count": 3,
      "source_links": ["https://..."]
    }
  ],
  "recommendation": "Konkrete Handlungsempfehlung für das Kurs-Update-Team."
}
```

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

### Deep Dive Analyst (`workflow-assets/deep-dive/`)

| Datei | Beschreibung |
|-------|-------------|
| `groupByCourse.js` | Gruppiert regulatorische Items nach Kurs, berechnet Tag-Frequenzen und Sender-Diversity |
| `courseAnalystPrompt.txt` | System-Prompt für den AI Agent: Konsolidierung, Kritikalitätsbewertung, Handlungsempfehlung |
| `outputSchema.json` | JSON Schema für den Structured Output (Severity, konsolidierte Updates, Empfehlung) |

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
