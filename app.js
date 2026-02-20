const COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16"
];

const GMAIL_BASE = "https://mail.google.com/mail/u/1/#all/";

let rawItems = [];
let categories = [];
let chartInstance = null;
let currentCategoryIndex = null;

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

async function init() {
  const res = await fetch(
    `https://raw.githubusercontent.com/henr-lecturio/newsletter-topic-dashboard/data/data.json?t=${Date.now()}`
  );
  const raw = await res.json();
  rawItems = raw.items || [];

  categories = aggregateCategories(rawItems);

  handleRoute();
  window.addEventListener("popstate", handleRoute);
}

function aggregateCategories(items) {
  const map = {};

  for (const item of items) {
    const topicName = item.topics?.topic_name;
    const courses = item.topics?.matched_courses;

    if (!topicName || !courses || courses.length === 0) continue;

    for (const course of courses) {
      if (!map[course]) map[course] = {};
      map[course][topicName] = (map[course][topicName] || 0) + 1;
    }
  }

  return Object.entries(map)
    .map(([name, tags]) => ({ name, tags }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getEmailsForTag(courseName, topicName) {
  return rawItems.filter(
    (item) =>
      item.topics?.topic_name === topicName &&
      item.topics?.matched_courses?.includes(courseName)
  );
}

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

function renderCategories() {
  const tbody = document.querySelector("#category-table tbody");
  tbody.innerHTML = "";

  categories.forEach((cat) => {
    const tagCount = Object.keys(cat.tags).length;
    const total = Object.values(cat.tags).reduce((a, b) => a + b, 0);

    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `
      <td class="cat-count">${tagCount}</td>
      <td class="cat-count">${total}</td>
      <td class="cat-name">${cat.name}</td>
    `;
    row.addEventListener("click", () => {
      window.location.hash = `category/${slugify(cat.name)}`;
    });
    tbody.appendChild(row);
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
  renderCategories();
}

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
  const tbody = document.querySelector("#legend-table tbody");
  tbody.innerHTML = "";

  const sorted = labels
    .map((label, i) => ({ label, value: values[i], color: colors[i] }))
    .sort((a, b) => b.value - a.value);

  sorted.forEach((item) => {
    const pct = ((item.value / total) * 100).toFixed(1);
    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `
      <td><span class="color-dot" style="background:${item.color}"></span></td>
      <td class="tag-name">${item.label}</td>
      <td class="tag-count">${item.value}</td>
      <td class="tag-percent">${pct}%</td>
    `;
    row.addEventListener("click", () => {
      window.location.hash = `emails/${catSlug}/${encodeURIComponent(item.label)}`;
    });
    tbody.appendChild(row);
  });
}

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
    const date = email.email_date ? email.email_date.split("T")[0] : "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="email-sender">${email.sender || ""}</td>
      <td class="email-date">${date}</td>
      <td><a class="email-link" href="${GMAIL_BASE}${email.id}" target="_blank">Zur Mail &rarr;</a></td>
    `;
    tbody.appendChild(row);
  });
}

init();
