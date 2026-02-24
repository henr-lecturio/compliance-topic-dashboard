# Newsletter Topic Dashboard

Ein Dashboard zur Visualisierung und Kategorisierung von Newsletter-Inhalten. Ein n8n-Workflow analysiert automatisiert E-Mails aus einem Postfach, extrahiert Themen und kategorisiert sie. Diese Web-App stellt die Ergebnisse interaktiv dar.

## Architektur

```
E-Mail-Postfach → n8n Workflow → data.json (GitHub) → Dashboard (Web-App)
```

**n8n Workflow:**
- Liest Newsletter-E-Mails aus einem Mail-Postfach
- Analysiert und kategorisiert die Inhalte (Kategorien, Tags, Gesetzesänderungen)
- Schreibt die Ergebnisse als `data.json` in den `data`-Branch dieses Repos
- Backup via Google Sheets bei GitHub-API-Fehlern

**Web-App (dieser Branch: `main`):**
- Lädt `data.json` vom `data`-Branch
- Zeigt Kategorien als interaktive Doughnut-Charts (Chart.js)
- Drill-Down: Kategorie → Tags → einzelne E-Mails mit Links

## Features

- Kategorien-Übersicht mit Pie-Chart und Tabelle
- Tag-Verteilung pro Kategorie
- E-Mail-Detail-Ansicht mit Links zu Gmail und Originalartikeln
- Datumsfilter und Filter für Gesetzesänderungen
- Kategorie-Hervorhebung (persistent via localStorage)
- Dark Theme, responsive Design

## Branch-Struktur

| Branch | Inhalt |
|--------|--------|
| `main` | Web-App (HTML, CSS, JS) |
| `data` | `data.json` – wird vom n8n Workflow aktualisiert |

## Tech Stack

- Vanilla HTML/CSS/JS
- [Chart.js](https://www.chartjs.org/) für die Visualisierung
- n8n für die Datenverarbeitung
- GitHub Raw Content als Daten-API

## Lokale Entwicklung

Die App kann direkt im Browser geöffnet werden – kein Build-Schritt nötig:

```bash
# Beliebiger lokaler Server, z.B.:
npx serve .
# oder
python3 -m http.server
```