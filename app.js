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

let rawItems = [];
let categories = [];
let chartInstance = null;
let categoryChartInstance = null;
let currentCategoryIndex = null;
let categoryToggles = {};
let highlightedCategory = localStorage.getItem("highlightedCategory") || "";
let filterFromDate = "";
let filterRegulatory = false;
let selectedItems = new Map(); // key: email.id, value: email object with metadata

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
    items = items.filter(item => item.topics?.is_regulatory_update === true);
  }
  return items;
}

function getSelectedCountForCategory(catName) {
  let count = 0;
  for (const item of selectedItems.values()) {
    if (item.topics?.matched_categories_tags?.some(ct => ct.category === catName)) count++;
  }
  return count;
}

function getSelectedCountForTag(catName, tagName) {
  let count = 0;
  for (const item of selectedItems.values()) {
    if (item.topics?.matched_categories_tags?.some(ct => ct.category === catName && ct.tag === tagName)) count++;
  }
  return count;
}

// === Init & Filter ===

async function init() {
  const res = await fetch(
    `https://raw.githubusercontent.com/henr-lecturio/newsletter-topic-dashboard/data/data.json?t=${Date.now()}`
  );
  const raw = await res.json();
  rawItems = raw.items || [];

  // Deduplicate by email id (same email can appear multiple times in source data)
  const seenIds = new Set();
  rawItems = rawItems.filter(item => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  categories = aggregateCategories(getFilteredItems());

  initFilter();
  initSettings();
  initExport();
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
    const categoryTags = item.topics?.matched_categories_tags;

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
    (item) => item.topics?.matched_categories_tags?.some(
      ct => ct.category === categoryName && ct.tag === tagName
    )
  );
}

// === Routing ===

function handleRoute() {
  const hash = window.location.hash;
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

function hideAllViews() {
  document.getElementById("category-view").classList.add("hidden");
  document.getElementById("chart-view").classList.add("hidden");
  document.getElementById("email-view").classList.add("hidden");
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
    const topicLink = email.topics?.topic_link;
    const articleCell = topicLink
      ? `<a class="email-link" href="${topicLink}" target="_blank">Zum Artikel &rarr;</a>`
      : `<span class="email-na">n/a</span>`;
    const isSelected = selectedItems.has(email.id);
    row.innerHTML = `
      <td class="cb-col"><input type="checkbox" ${isSelected ? "checked" : ""}></td>
      <td class="email-date">${date}</td>
      <td class="email-sender">${email.sender || ""}</td>
      <td class="email-topic">${email.topics?.topic_name || ""}</td>
      <td><a class="email-link" href="${GMAIL_BASE}${email.id}" target="_blank">Zur Mail &rarr;</a></td>
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
    const name = item.topics?.topic_name || "Ohne Titel";
    const summary = item.topics?.topic_summary || "";
    const link = item.topics?.topic_link || "";
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

init();
