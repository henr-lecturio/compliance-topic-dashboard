const COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16"
];

let data = null;
let categories = [];
let chartInstance = null;

async function init() {
  const res = await fetch("data/data.json");
  const raw = await res.json();

  // Rohdaten → Kategorien aggregieren
  categories = aggregateCategories(raw.items || []);

  renderCategories();
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

function handleRoute() {
  const hash = window.location.hash;
  if (hash.startsWith("#category/")) {
    const index = parseInt(hash.split("/")[1], 10);
    showChart(index);
  } else {
    showCategories();
  }
}

function renderCategories() {
  const grid = document.getElementById("category-grid");
  grid.innerHTML = "";

  categories.forEach((cat, i) => {
    const tagCount = Object.keys(cat.tags).length;
    const total = Object.values(cat.tags).reduce((a, b) => a + b, 0);

    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `
      <h2>${cat.name}</h2>
      <span class="tag-count">${tagCount} Tags &middot; ${total} gesamt</span>
    `;
    card.addEventListener("click", () => {
      window.location.hash = `category/${i}`;
      showChart(i);
    });
    grid.appendChild(card);
  });
}

function showCategories() {
  document.getElementById("category-view").classList.remove("hidden");
  document.getElementById("chart-view").classList.add("hidden");
  document.getElementById("page-title").textContent = "Kategorien";
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function showChart(index) {
  const cat = categories[index];
  if (!cat) return;

  document.getElementById("category-view").classList.add("hidden");
  document.getElementById("chart-view").classList.remove("hidden");
  document.getElementById("page-title").textContent = cat.name;

  document.getElementById("back-btn").onclick = () => {
    window.location.hash = "";
    showCategories();
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

  renderLegendTable(labels, values, total, colors);
}

function renderLegendTable(labels, values, total, colors) {
  const tbody = document.querySelector("#legend-table tbody");
  tbody.innerHTML = "";

  const sorted = labels
    .map((label, i) => ({ label, value: values[i], color: colors[i] }))
    .sort((a, b) => b.value - a.value);

  sorted.forEach((item) => {
    const pct = ((item.value / total) * 100).toFixed(1);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="color-dot" style="background:${item.color}"></span></td>
      <td class="tag-name">${item.label}</td>
      <td class="tag-count">${item.value}</td>
      <td class="tag-percent">${pct}%</td>
    `;
    tbody.appendChild(row);
  });
}

init();
