// === State & Config ===

const COLORS = [
  "#FF0000", "#DC143C", "#FF6347", 
  "#FFA500", "#FF8C00", "#FF7F50",
  "#FFFF00", "#FFD700", "#F0E68C",
  "#008000", "#32CD32", "#228B22",
  "#0000FF", "#4169E1", "#1E90FF",
  "#800080", "#9400D3", "#9370DB" 
];

const GMAIL_BASE = "https://mail.google.com/mail/u/1/#all/";

const SUPABASE_URL = "https://ipuhepfyamxjpqzbcixj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwdWhlcGZ5YW14anBxemJjaXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDg1MDksImV4cCI6MjA4NzU4NDUwOX0.D3TuhPsXWjmVI0K6gMvfuou5p35qPx34S06MIGuLHI4";

let rawItems = [];
let categories = [];
let chartInstance = null;
let categoryChartInstance = null;
let currentCategoryIndex = null;
let categoryToggles = {};
let highlightedCategory = localStorage.getItem("highlightedCategory") || "";
let filterFromDate = "";
let filterRegulatory = false;
let selectedItems = new Map(); // key: item.id (supabase row id), value: item object with metadata
let trendReports = [];
let trendBarChartInstance = null;
let courseUpdates = [];
let currentSeverityFilter = "all";

// === Utilities ===

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findCategoryBySlug(slug) {
  return categories.find(cat => slugify(cat.name) === slug);
}

function getFilteredItems() {
  let items = rawItems;
  if (filterFromDate) {
    items = items.filter(item => {
      const d = item.email_date ? item.email_date.split("T")[0] : "";
      return d >= filterFromDate;
    });
  }
  if (filterRegulatory) {
    items = items.filter(item => item.is_regulatory_update === true);
  }
  return items;
}

function getSelectedCountForCategory(catName) {
  let count = 0;
  for (const item of selectedItems.values()) {
    if (item.matched_categories_tags?.some(ct => ct.category === catName)) count++;
  }
  return count;
}

function getSelectedCountForTag(catName, tagName) {
  let count = 0;
  for (const item of selectedItems.values()) {
    if (item.matched_categories_tags?.some(ct => ct.category === catName && ct.tag === tagName)) count++;
  }
  return count;
}

// === Init & Filter ===

async function init() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/newsletter_topics?select=*`,
    { headers: { "apikey": SUPABASE_KEY } }
  );
  rawItems = await res.json();

  categories = aggregateCategories(getFilteredItems());

  initFilter();
  initSettings();
  initExport();
  initTrend();
  initUpdates();
  handleRoute();
  window.addEventListener("popstate", handleRoute);
}

function initFilter() {
  const input = document.getElementById("filter-from");
  const resetBtn = document.getElementById("filter-reset");

  input.addEventListener("change", (e) => {
    filterFromDate = e.target.value;
    applyFilter();
  });

  resetBtn.addEventListener("click", () => {
    filterFromDate = "";
    input.value = "";
    applyFilter();
  });

  const regulatoryToggle = document.getElementById("filter-regulatory");
  regulatoryToggle.addEventListener("change", (e) => {
    filterRegulatory = e.target.checked;
    applyFilter();
  });
}

function applyFilter() {
  categories = aggregateCategories(getFilteredItems());
  categoryToggles = {};
  handleRoute();
}

function initSettings() {
  const btn = document.getElementById("settings-btn");
  const dropdown = document.getElementById("settings-dropdown");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add("hidden");
    }
  });

  const select = document.getElementById("highlight-select");
  select.innerHTML = '<option value="">Keine</option>';
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });

  select.value = highlightedCategory;

  select.addEventListener("change", (e) => {
    highlightedCategory = e.target.value;
    localStorage.setItem("highlightedCategory", highlightedCategory);
    if (window.location.hash === "" || window.location.hash === "#") {
      renderCategories();
    }
  });
}

// === Data Processing ===

function aggregateCategories(items) {
  const map = {};

  for (const item of items) {
    const categoryTags = item.matched_categories_tags;

    if (!categoryTags || categoryTags.length === 0) continue;

    // Deduplicate category+tag pairs within a single email
    const seenPairs = new Set();
    for (const ct of categoryTags) {
      const key = `${ct.category}\0${ct.tag}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      if (!map[ct.category]) map[ct.category] = {};
      map[ct.category][ct.tag] = (map[ct.category][ct.tag] || 0) + 1;
    }
  }

  return Object.entries(map)
    .map(([name, tags]) => ({ name, tags }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getEmailsForTag(categoryName, tagName) {
  return getFilteredItems().filter(
    (item) => item.matched_categories_tags?.some(
      ct => ct.category === categoryName && ct.tag === tagName
    )
  );
}

// === Routing ===

function handleRoute() {
  const hash = window.location.hash;
  const filterBar = document.getElementById("filter-bar");
  const isTrend = hash === "#trends";
  const isUpdates = hash === "#updates";

  // Update active tab
  document.querySelectorAll(".nav-tab").forEach(tab => {
    const tabTarget = tab.dataset.tab;
    const isActive = (isTrend && tabTarget === "trends")
      || (isUpdates && tabTarget === "updates")
      || (!isTrend && !isUpdates && tabTarget === "overview");
    tab.classList.toggle("active", isActive);
  });

  const settingsWrapper = document.getElementById("settings-wrapper");

  if (isTrend) {
    filterBar.classList.add("hidden");
    settingsWrapper.classList.add("hidden");
    showTrends();
  } else if (isUpdates) {
    filterBar.classList.add("hidden");
    settingsWrapper.classList.add("hidden");
    showUpdates();
  } else {
    filterBar.classList.remove("hidden");
    settingsWrapper.classList.remove("hidden");
    if (hash.startsWith("#emails/")) {
      const parts = hash.split("/");
      const catSlug = parts[1];
      const tagName = decodeURIComponent(parts.slice(2).join("/"));
      showEmails(catSlug, tagName);
    } else if (hash.startsWith("#category/")) {
      const slug = hash.split("/").slice(1).join("/");
      showChart(slug);
    } else {
      showCategories();
    }
  }
}

function hideAllViews() {
  document.getElementById("category-view").classList.add("hidden");
  document.getElementById("chart-view").classList.add("hidden");
  document.getElementById("email-view").classList.add("hidden");
  document.getElementById("trend-view").classList.add("hidden");
  document.getElementById("updates-view").classList.add("hidden");
  document.getElementById("update-detail-view").classList.add("hidden");
}

// === View: Category Overview ===

function renderCategories() {
  if (Object.keys(categoryToggles).length === 0) {
    categories.forEach(cat => { categoryToggles[cat.name] = true; });
  }

  const tbody = document.querySelector("#category-table tbody");
  tbody.innerHTML = "";

  const sorted = categories.map((cat, i) => ({ cat, origIndex: i }));
  if (highlightedCategory) {
    sorted.sort((a, b) => {
      if (a.cat.name === highlightedCategory) return -1;
      if (b.cat.name === highlightedCategory) return 1;
      return 0;
    });
  }

  sorted.forEach(({ cat, origIndex }) => {
    const total = Object.values(cat.tags).reduce((a, b) => a + b, 0);
    const checked = categoryToggles[cat.name] ? "checked" : "";
    const color = COLORS[origIndex % COLORS.length];

    const row = document.createElement("tr");
    if (cat.name === highlightedCategory) row.classList.add("highlighted");
    row.innerHTML = `
      <td class="cat-count">${total}</td>
      <td class="cat-toggle"><label class="toggle"><input type="checkbox" ${checked}><span class="toggle-slider"></span></label></td>
      <td class="cat-name" style="cursor:pointer"><span class="color-dot" style="background:${color}"></span> ${cat.name} <span class="sel-badge" data-category="${cat.name}"></span></td>
    `;
    row.querySelector("input").addEventListener("change", (e) => {
      e.stopPropagation();
      categoryToggles[cat.name] = e.target.checked;
      syncToggleAll();
      renderCategoryChart();
    });
    row.querySelector(".cat-name").addEventListener("click", () => {
      window.location.hash = `category/${slugify(cat.name)}`;
    });
    tbody.appendChild(row);
  });

  const toggleAll = document.getElementById("toggle-all");
  toggleAll.addEventListener("change", (e) => {
    const state = e.target.checked;
    categories.forEach(cat => { categoryToggles[cat.name] = state; });
    tbody.querySelectorAll("input[type=checkbox]").forEach(cb => { cb.checked = state; });
    renderCategoryChart();
  });
  syncToggleAll();

  renderCategoryChart();
  updateSelectionBadges();
}

function syncToggleAll() {
  const allOn = categories.every(cat => categoryToggles[cat.name]);
  document.getElementById("toggle-all").checked = allOn;
}

function renderCategoryChart() {
  const active = categories
    .map((cat, i) => ({ cat, color: COLORS[i % COLORS.length] }))
    .filter(({ cat }) => categoryToggles[cat.name]);

  const labels = active.map(({ cat }) => cat.name);
  const values = active.map(({ cat }) => Object.values(cat.tags).reduce((a, b) => a + b, 0));
  const colors = active.map(({ color }) => color);
  const total = values.reduce((a, b) => a + b, 0);

  const hasHighlight = highlightedCategory && labels.includes(highlightedCategory);
  const bgColors = hasHighlight
    ? colors.map((c, i) => labels[i] === highlightedCategory ? c : c + "99")
    : colors;
  const offsets = hasHighlight
    ? labels.map(l => l === highlightedCategory ? 15 : 0)
    : labels.map(() => 0);
  const borderWidths = hasHighlight
    ? labels.map(l => l === highlightedCategory ? 3 : 1)
    : labels.map(() => 2);

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  const ctx = document.getElementById("category-pie-chart").getContext("2d");
  categoryChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderColor: "#0f1117",
        borderWidth: borderWidths,
        offset: offsets
      }]
    },
    options: {
      responsive: true,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const catName = labels[idx];
          window.location.hash = `category/${slugify(catName)}`;
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function showCategories() {
  hideAllViews();
  document.getElementById("category-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = "Kategorien";
  currentCategoryIndex = null;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }
  renderCategories();
}

// === View: Tag Chart ===

function showChart(slug) {
  const cat = findCategoryBySlug(slug);
  if (!cat) return;

  hideAllViews();
  document.getElementById("chart-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = cat.name;
  currentCategoryIndex = slug;

  document.getElementById("back-btn").onclick = () => {
    window.location.hash = "";
  };

  const labels = Object.keys(cat.tags);
  const values = Object.values(cat.tags);
  const total = values.reduce((a, b) => a + b, 0);
  const colors = labels.map((_, i) => COLORS[i % COLORS.length]);

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = document.getElementById("pie-chart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "#0f1117",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const tagName = labels[idx];
          window.location.hash = `emails/${slug}/${encodeURIComponent(tagName)}`;
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  renderLegendTable(labels, values, total, colors, slug);
}

function renderLegendTable(labels, values, total, colors, catSlug) {
  const cat = findCategoryBySlug(catSlug);
  const catName = cat ? cat.name : "";
  const tbody = document.querySelector("#legend-table tbody");
  tbody.innerHTML = "";

  const sorted = labels
    .map((label, i) => ({ label, value: values[i], color: colors[i] }))
    .sort((a, b) => b.value - a.value);

  sorted.forEach((item) => {
    const pct = ((item.value / total) * 100).toFixed(1);
    const tagEmails = getEmailsForTag(catName, item.label);
    const allSelected = tagEmails.length > 0 && tagEmails.every(e => selectedItems.has(e.id));
    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `
      <td class="cb-col"><input type="checkbox" ${allSelected ? "checked" : ""}></td>
      <td><span class="color-dot" style="background:${item.color}"></span></td>
      <td class="tag-name">${item.label} <span class="sel-badge" data-category="${catName}" data-tag="${item.label}"></span></td>
      <td class="tag-count">${item.value}</td>
      <td class="tag-percent">${pct}%</td>
    `;
    const cb = row.querySelector("input[type=checkbox]");
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", (e) => {
      tagEmails.forEach(email => {
        if (e.target.checked) {
          selectedItems.set(email.id, { ...email, _category: catName, _tag: item.label });
        } else {
          selectedItems.delete(email.id);
        }
      });
      syncTagSelectAll(catSlug);
      updateExportButton();
      updateSelectionBadges();
    });
    row.addEventListener("click", () => {
      window.location.hash = `emails/${catSlug}/${encodeURIComponent(item.label)}`;
    });
    tbody.appendChild(row);
  });

  syncTagSelectAll(catSlug);

  const selectAll = document.getElementById("tag-select-all");
  selectAll.onchange = (e) => {
    sorted.forEach((item) => {
      const tagEmails = getEmailsForTag(catName, item.label);
      tagEmails.forEach(email => {
        if (e.target.checked) {
          selectedItems.set(email.id, { ...email, _category: catName, _tag: item.label });
        } else {
          selectedItems.delete(email.id);
        }
      });
    });
    tbody.querySelectorAll("input[type=checkbox]").forEach(cb => { cb.checked = e.target.checked; });
    updateExportButton();
    updateSelectionBadges();
  };
}

function syncTagSelectAll(catSlug) {
  const cat = findCategoryBySlug(catSlug);
  if (!cat) return;
  const allTags = Object.keys(cat.tags);
  const allEmails = allTags.flatMap(tag => getEmailsForTag(cat.name, tag));
  const allSelected = allEmails.length > 0 && allEmails.every(e => selectedItems.has(e.id));
  document.getElementById("tag-select-all").checked = allSelected;
}

// === View: Email Detail ===

function showEmails(catSlug, topicName) {
  const cat = findCategoryBySlug(catSlug);
  if (!cat) return;

  hideAllViews();
  document.getElementById("email-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = topicName;

  document.getElementById("email-back-btn").onclick = () => {
    window.location.hash = `category/${catSlug}`;
  };

  const emails = getEmailsForTag(cat.name, topicName);
  const tbody = document.querySelector("#email-table tbody");
  tbody.innerHTML = "";

  emails.forEach((email) => {
    const rawDate = email.email_date ? email.email_date.split("T")[0] : "";
    const date = rawDate ? rawDate.split("-").reverse().join(".") : "";
    const row = document.createElement("tr");
    const topicLink = email.topic_link;
    const articleCell = topicLink
      ? `<a class="email-link" href="${topicLink}" target="_blank">Zum Artikel &rarr;</a>`
      : `<span class="email-na">n/a</span>`;
    const isSelected = selectedItems.has(email.id);
    row.innerHTML = `
      <td class="cb-col"><input type="checkbox" ${isSelected ? "checked" : ""}></td>
      <td class="email-date">${date}</td>
      <td class="email-sender">${email.sender || ""}</td>
      <td class="email-topic">${email.topic_name || ""}</td>
      <td><a class="email-link" href="${GMAIL_BASE}${email.email_id}" target="_blank">Zur Mail &rarr;</a></td>
      <td>${articleCell}</td>
    `;
    const cb = row.querySelector("input[type=checkbox]");
    cb.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedItems.set(email.id, { ...email, _category: cat.name, _tag: topicName });
      } else {
        selectedItems.delete(email.id);
      }
      syncEmailSelectAll(emails);
      updateExportButton();
    });
    tbody.appendChild(row);
  });

  syncEmailSelectAll(emails);

  const selectAll = document.getElementById("email-select-all");
  selectAll.onchange = (e) => {
    emails.forEach(email => {
      if (e.target.checked) {
        selectedItems.set(email.id, { ...email, _category: cat.name, _tag: topicName });
      } else {
        selectedItems.delete(email.id);
      }
    });
    tbody.querySelectorAll("input[type=checkbox]").forEach(cb => { cb.checked = e.target.checked; });
    updateExportButton();
  };
}

function syncEmailSelectAll(emails) {
  const allSelected = emails.length > 0 && emails.every(e => selectedItems.has(e.id));
  document.getElementById("email-select-all").checked = allSelected;
}

// === Export ===

function initExport() {
  document.getElementById("export-btn").addEventListener("click", exportSelectedMarkdown);
  document.getElementById("deselect-btn").addEventListener("click", deselectAll);
  updateExportButton();
}

function deselectAll() {
  selectedItems.clear();
  updateExportButton();
  handleRoute();
}

function updateExportButton() {
  const btn = document.getElementById("export-btn");
  const deselectBtn = document.getElementById("deselect-btn");
  const count = selectedItems.size;
  const countEl = document.getElementById("export-count");
  if (count > 0) {
    btn.disabled = false;
    countEl.textContent = `(${count})`;
    deselectBtn.classList.remove("hidden");
  } else {
    btn.disabled = true;
    countEl.textContent = "";
    deselectBtn.classList.add("hidden");
  }
  updateSelectionBadges();
}

function updateSelectionBadges() {
  document.querySelectorAll(".sel-badge").forEach(badge => {
    const cat = badge.dataset.category;
    const tag = badge.dataset.tag;
    const count = tag
      ? getSelectedCountForTag(cat, tag)
      : getSelectedCountForCategory(cat);
    badge.textContent = count > 0 ? `\u2713${count}` : "";
  });
}

function exportSelectedMarkdown() {
  const items = Array.from(selectedItems.values());
  const date = new Date().toISOString().split("T")[0];

  let md = `# Newsletter Topics Export\n\n`;
  md += `**Exportiert:** ${date}  \n`;
  md += `**Anzahl:** ${items.length}\n\n---\n\n`;

  items.forEach((item, i) => {
    const name = item.topic_name || "Ohne Titel";
    const summary = item.topic_summary || "";
    const link = item.topic_link || "";
    const category = item._category || "";
    const tag = item._tag || "";
    const emailDate = item.email_date ? item.email_date.split("T")[0] : "";

    md += `## ${i + 1}. ${name}\n\n`;
    md += `| Feld | Wert |\n|---|---|\n`;
    md += `| Kategorie | ${category} |\n`;
    md += `| Tag | ${tag} |\n`;
    if (emailDate) md += `| Datum | ${emailDate} |\n`;
    if (link) md += `| Artikel | [Link](${link}) |\n`;
    md += `\n`;
    if (summary) md += `### Zusammenfassung\n\n${summary}\n\n`;
    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notebooklm-export-${date}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// === View: Trend Report ===

function initTrend() {
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = tab.getAttribute("href").replace("#", "") || "";
    });
  });

  document.getElementById("trend-report-select").addEventListener("change", (e) => {
    const report = trendReports.find(r => String(r.id) === e.target.value);
    if (report) renderTrendReport(report);
  });
}

async function showTrends() {
  hideAllViews();
  document.getElementById("trend-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = "Trend Report";

  if (trendReports.length === 0) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/trend_reports?select=*&order=period_end.desc`,
      { headers: { "apikey": SUPABASE_KEY } }
    );
    trendReports = await res.json();
  }

  if (trendReports.length === 0) {
    document.getElementById("trend-summary").innerHTML = "<p>Noch keine Trend Reports vorhanden.</p>";
    return;
  }

  const select = document.getElementById("trend-report-select");
  select.innerHTML = "";
  trendReports.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`;
    select.appendChild(opt);
  });

  renderTrendReport(trendReports[0]);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return dateStr.split("-").reverse().join(".");
}

function renderTrendReport(report) {
  const aiRaw = typeof report.ai_report === "string" ? JSON.parse(report.ai_report) : report.ai_report;
  const ai = aiRaw.output || aiRaw;
  const stats = typeof report.stats_json === "string" ? JSON.parse(report.stats_json) : report.stats_json;

  // Summary
  document.getElementById("trend-summary").innerHTML = `
    <div class="trend-period">${formatDate(report.period_start)} – ${formatDate(report.period_end)}</div>
    <p>${ai.weekly_summary}</p>
  `;

  // Content Recommendations
  renderRecommendations(ai.content_recommendations);

  // Rising Topics
  renderRisingTopics(ai.rising_topics);

  // New Signals
  renderNewSignals(ai.new_signals);

  // Regulatory
  renderRegulatory(ai.regulatory_developments);

  // Clusters
  renderClusters(ai.topic_clusters);

  // Bar Chart
  renderTrendBarChart(stats);
}

function renderRecommendations(reco) {
  const grid = document.getElementById("trend-reco-grid");
  grid.innerHTML = `
    <div class="trend-reco-item reco-act">
      <div class="reco-label">Sofort umsetzen</div>
      <div class="reco-topic">${reco.act_now.topic}</div>
      <div class="reco-reason">${reco.act_now.reason}</div>
    </div>
    <div class="trend-reco-item reco-monitor">
      <div class="reco-label">Beobachten</div>
      <div class="reco-topic">${reco.monitor.topic}</div>
      <div class="reco-reason">${reco.monitor.reason}</div>
    </div>
    <div class="trend-reco-item reco-deprioritize">
      <div class="reco-label">Nicht relevant</div>
      <div class="reco-topic">${reco.deprioritize.topic}</div>
      <div class="reco-reason">${reco.deprioritize.reason}</div>
    </div>
  `;
}

function renderRisingTopics(topics) {
  const container = document.getElementById("trend-rising-list");
  if (!topics || topics.length === 0) {
    container.innerHTML = '<div class="trend-item"><span class="trend-item-detail">Keine aufsteigenden Themen</span></div>';
    return;
  }
  container.innerHTML = topics.map(t => `
    <div class="trend-item">
      <div>
        <div class="trend-item-name">${t.topic}</div>
        <div class="trend-item-detail">${t.assessment}</div>
      </div>
      <span class="trend-badge trend-badge-up">${t.current} (${t.change_pct != null ? (t.change_pct > 0 ? "+" : "") + t.change_pct + "%" : "neu"})</span>
    </div>
  `).join("");
}

function renderNewSignals(signals) {
  const container = document.getElementById("trend-signals-list");
  if (!signals || signals.length === 0) {
    container.innerHTML = '<div class="trend-item"><span class="trend-item-detail">Keine neuen Tags diese Woche</span></div>';
    return;
  }
  container.innerHTML = signals.map(s => `
    <div class="trend-item">
      <div>
        <div class="trend-item-name">${s.topic}</div>
        <div class="trend-item-detail">${s.source_count} Quelle${s.source_count !== 1 ? "n" : ""} — ${s.assessment}</div>
      </div>
      <span class="trend-badge trend-badge-new">neu</span>
    </div>
  `).join("");
}

function renderRegulatory(reg) {
  const container = document.getElementById("trend-regulatory-content");
  const prevText = reg.count_previous != null ? `Vorzeitraum: ${reg.count_previous}` : "";
  const urgentHtml = reg.urgent_topics && reg.urgent_topics.length > 0
    ? `<ul class="trend-urgent-list">${reg.urgent_topics.map(t => `<li>${t}</li>`).join("")}</ul>`
    : "";

  container.innerHTML = `
    <div class="trend-regulatory-stat">
      <span class="stat-value">${reg.count_current}</span>
      <span class="stat-prev">${prevText}</span>
    </div>
    ${urgentHtml}
    <div class="trend-item-detail">${reg.assessment}</div>
  `;
}

function renderClusters(clusters) {
  const container = document.getElementById("trend-clusters-list");
  if (!clusters || clusters.length === 0) {
    container.innerHTML = '<div class="trend-item-detail">Keine Cluster erkannt</div>';
    return;
  }
  container.innerHTML = clusters.map(c => `
    <div class="trend-cluster-item">
      <div class="trend-cluster-topics">${c.topics.join(" + ")}</div>
      <div class="trend-cluster-impl">${c.implication}</div>
    </div>
  `).join("");
}

function renderTrendBarChart(stats) {
  const window7d = stats.windows?.["7d"];
  if (!window7d || !window7d.top_tags || window7d.top_tags.length === 0) return;

  const topTags = window7d.top_tags.slice(0, 10);
  const labels = topTags.map(t => t.name);
  const values = topTags.map(t => t.count);
  const colors = topTags.map((_, i) => COLORS[i % COLORS.length]);

  if (trendBarChartInstance) {
    trendBarChartInstance.destroy();
  }

  const ctx = document.getElementById("trend-bar-chart").getContext("2d");
  trendBarChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "transparent",
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw} Beiträge`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(45, 49, 72, 0.5)" },
          ticks: { color: "#8b8fa3" }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#e1e4e8", font: { size: 12 } }
        }
      }
    }
  });
}

// === View: Course Updates ===

let parsedUpdatesForPeriod = [];

function initUpdates() {
  document.getElementById("updates-period-select").addEventListener("change", (e) => {
    const periodEnd = e.target.value;
    const filtered = courseUpdates.filter(u => u.period_end === periodEnd);
    renderCourseUpdatesList(filtered, currentSeverityFilter);
  });

  document.querySelectorAll(".severity-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".severity-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSeverityFilter = btn.dataset.severity;

      const select = document.getElementById("updates-period-select");
      const periodEnd = select.value;
      const filtered = courseUpdates.filter(u => u.period_end === periodEnd);
      renderCourseUpdatesList(filtered, currentSeverityFilter);
    });
  });

  document.getElementById("update-back-btn").addEventListener("click", () => {
    window.location.hash = "updates";
  });
}

async function showUpdates() {
  hideAllViews();
  document.getElementById("updates-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = "Kurs-Updates";

  if (courseUpdates.length === 0) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/course_updates?select=*&order=period_end.desc`,
      { headers: { "apikey": SUPABASE_KEY } }
    );
    courseUpdates = await res.json();
  }

  const tbody = document.querySelector("#updates-table tbody");
  if (courseUpdates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="updates-empty">Noch keine Kurs-Updates vorhanden.</td></tr>';
    return;
  }

  // Populate period dropdown with unique period_end values
  const periods = [...new Set(courseUpdates.map(u => u.period_end))];
  const select = document.getElementById("updates-period-select");
  select.innerHTML = "";
  periods.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = formatDate(p);
    select.appendChild(opt);
  });

  const filtered = courseUpdates.filter(u => u.period_end === periods[0]);
  renderCourseUpdatesList(filtered, currentSeverityFilter);
}

function severityLabel(severity) {
  if (severity === "zur_kenntnis") return "Zur Kenntnis";
  if (!severity) return "Zur Kenntnis";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function renderCourseUpdatesList(updates, severityFilter) {
  const tbody = document.querySelector("#updates-table tbody");

  // Parse ai_analysis for each update
  const parsed = updates.map(u => {
    const rawAi = typeof u.ai_analysis === "string" ? JSON.parse(u.ai_analysis) : u.ai_analysis;
    const ai = rawAi.output || rawAi;
    return { ...u, _ai: ai };
  });

  // Filter by severity
  const filtered = severityFilter === "all"
    ? parsed
    : parsed.filter(u => u._ai.severity === severityFilter);

  parsedUpdatesForPeriod = filtered;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="updates-empty">Keine Updates für diesen Filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((u, i) => {
    const severity = u._ai.severity || "zur_kenntnis";
    const label = severityLabel(severity);
    const courseName = u.course_name || "Unbekannter Kurs";
    const updateCount = (u._ai.consolidated_updates || []).length;
    return `
      <tr data-update-idx="${i}">
        <td class="update-col-course">${courseName}</td>
        <td><span class="severity-badge severity-${severity}">${label}</span></td>
        <td class="update-col-count">${updateCount}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("tr[data-update-idx]").forEach(row => {
    row.addEventListener("click", () => {
      const idx = parseInt(row.dataset.updateIdx, 10);
      showUpdateDetail(idx);
    });
  });
}

function showUpdateDetail(idx) {
  const update = parsedUpdatesForPeriod[idx];
  if (!update) return;

  hideAllViews();
  document.getElementById("update-detail-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = update.course_name || "Unbekannter Kurs";

  const ai = update._ai;
  const severity = ai.severity || "zur_kenntnis";

  const updatesHtml = (ai.consolidated_updates || []).map(cu => {
    const sourcesHtml = (cu.sources || []).map((src, i) => {
      const label = `Quelle ${i + 1}`;
      return `<a href="${src}" class="update-source-link" target="_blank">${label} &rarr;</a>`;
    }).join("");

    const itemSeverity = cu.severity || severity;

    return `
      <div class="update-item">
        <div class="update-item-title">${cu.title || ""}</div>
        <span class="update-item-severity severity-badge severity-${itemSeverity}">${severityLabel(itemSeverity)}</span>
        <div class="update-item-summary">${cu.summary || ""}</div>
        ${sourcesHtml ? `<div class="update-item-sources">${sourcesHtml}</div>` : ""}
      </div>
    `;
  }).join("");

  const recoHtml = ai.recommendation ? `
    <div class="update-recommendation">
      <div class="update-recommendation-label">Handlungsempfehlung</div>
      <div class="update-recommendation-text">${ai.recommendation}</div>
    </div>
  ` : "";

  document.getElementById("update-detail-content").innerHTML = `
    <div class="update-card">
      <div class="update-card-header">
        <span class="update-card-course">${update.course_name || "Unbekannter Kurs"}</span>
        <span class="severity-badge severity-${severity}">${severityLabel(severity)}</span>
      </div>
      ${updatesHtml}
      ${recoHtml}
    </div>
  `;
}

init();
