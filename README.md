# Newsletter Topic Dashboard

Ein Dashboard zur Visualisierung und Kategorisierung von Newsletter-Inhalten. Ein n8n-Workflow analysiert automatisiert E-Mails aus einem Postfach, extrahiert Themen und kategorisiert sie. Diese Web-App stellt die Ergebnisse interaktiv dar.

## Architektur

```
E-Mail-Postfach → n8n Workflow → Supabase (PostgreSQL) → Dashboard (Web-App)
```

**n8n Workflow:**
- Liest Newsletter-E-Mails aus einem Mail-Postfach
- Analysiert und kategorisiert die Inhalte (Kategorien, Tags, Gesetzesänderungen)
- Schreibt die Ergebnisse per Supabase Node direkt in die Datenbank

**Web-App (`main` Branch):**
- Lädt Daten via Supabase REST API
- Zeigt Kategorien als interaktive Doughnut-Charts (Chart.js)
- Drill-Down: Kategorie → Tags → einzelne E-Mails mit Links

## Features

- Kategorien-Übersicht mit Pie-Chart und Tabelle
- Tag-Verteilung pro Kategorie
- E-Mail-Detail-Ansicht mit Links zu Gmail und Originalartikeln
- Datumsfilter und Filter für Gesetzesänderungen
- Kategorie-Hervorhebung (persistent via localStorage)
- Multi-Select und Markdown-Export
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

## n8n Code Nodes

| Datei | Beschreibung |
|-------|-------------|
| `cleanEmail.js` | Bereinigt E-Mail-Rohdaten vor der AI-Analyse |
| `mapOutput.js` | Mapped AI-Output auf strukturierte Felder |
| `flattenForSupabase.js` | Flacht verschachtelte Topic-Daten für den DB-Insert |

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
