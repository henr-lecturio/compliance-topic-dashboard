// === Input & Sortierung ===

const items = $input.all().map(i => i.json);
items.sort((a, b) => (a.email_date || "").localeCompare(b.email_date || ""));

const today = new Date().toISOString().split("T")[0];

// === Hilfsfunktionen ===

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function filterWindow(fromDate, toDate) {
  return items.filter(i => {
    const d = (i.email_date || "").split("T")[0];
    return d >= fromDate && d <= toDate;
  });
}

function countTags(windowItems) {
  const counts = {};
  for (const item of windowItems) {
    const ct = item.matched_categories_tags;
    if (!Array.isArray(ct)) continue;
    const seen = new Set();
    for (const { category, tag } of ct) {
      const key = `${category} → ${tag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function countCategories(windowItems) {
  const counts = {};
  for (const item of windowItems) {
    const ct = item.matched_categories_tags;
    if (!Array.isArray(ct)) continue;
    const seen = new Set();
    for (const { category } of ct) {
      if (seen.has(category)) continue;
      seen.add(category);
      counts[category] = (counts[category] || 0) + 1;
    }
  }
  return counts;
}

function computeTrends(current, previous) {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const trends = [];
  for (const key of allKeys) {
    const cur = current[key] || 0;
    const prev = previous[key] || 0;
    if (cur === 0 && prev === 0) continue;
    const change_pct = prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
    const diff = cur - prev;
    trends.push({ name: key, current: cur, previous: prev, diff, change_pct });
  }
  return trends;
}

function findNewEntries(currentCounts, previousCounts) {
  return Object.keys(currentCounts).filter(k => !previousCounts[k]);
}

function computeCoOccurrences(windowItems) {
  const pairCounts = {};
  for (const item of windowItems) {
    const ct = item.matched_categories_tags;
    if (!Array.isArray(ct) || ct.length < 2) continue;
    const tags = [...new Set(ct.map(x => `${x.category} → ${x.tag}`))];
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const pair = [tags[i], tags[j]].sort().join(" + ");
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
    }
  }
  return Object.entries(pairCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pair, count]) => ({ pair, count }));
}

function computeHHI(counts) {
  const values = Object.values(counts);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + Math.pow(v / total, 2), 0) * 1000) / 1000;
}

function computeTop3Share(counts) {
  const values = Object.values(counts).sort((a, b) => b - a);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const top3 = values.slice(0, 3).reduce((a, b) => a + b, 0);
  return Math.round((top3 / total) * 100) / 100;
}

function computeSenderDiversity(windowItems, topTagKeys) {
  const result = {};
  for (const key of topTagKeys) {
    const senders = new Set();
    for (const item of windowItems) {
      const ct = item.matched_categories_tags;
      if (!Array.isArray(ct)) continue;
      if (ct.some(x => `${x.category} → ${x.tag}` === key) && item.sender) {
        senders.add(item.sender);
      }
    }
    result[key] = senders.size;
  }
  return result;
}

function countRegulatory(windowItems) {
  return windowItems.filter(i => i.is_regulatory_update === true).length;
}

// === Zeitfenster definieren ===

const windows = {
  "7d":  { current: filterWindow(daysAgo(7), today),  previous: filterWindow(daysAgo(14), daysAgo(8)) },
  "30d": { current: filterWindow(daysAgo(30), today),  previous: filterWindow(daysAgo(60), daysAgo(31)) },
  "90d": { current: filterWindow(daysAgo(90), today),  previous: [] }
};

// === Analyse pro Fenster ===

function analyzeWindow(name, currentItems, previousItems) {
  const tagsCurrent = countTags(currentItems);
  const tagsPrevious = countTags(previousItems);
  const catsCurrent = countCategories(currentItems);
  const catsPrevious = countCategories(previousItems);

  // Tag-Trends
  const tagTrends = computeTrends(tagsCurrent, tagsPrevious);
  const rising = tagTrends.filter(t => t.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 10);
  const falling = tagTrends.filter(t => t.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 10);

  // Kategorie-Trends
  const catTrends = computeTrends(catsCurrent, catsPrevious);
  const risingCats = catTrends.filter(t => t.diff > 0).sort((a, b) => b.diff - a.diff);
  const fallingCats = catTrends.filter(t => t.diff < 0).sort((a, b) => a.diff - b.diff);

  // Neue Tags (nur wenn Vergleichszeitraum existiert)
  const newTags = previousItems.length > 0 ? findNewEntries(tagsCurrent, tagsPrevious) : [];

  // Top Tags + Sender Diversity
  const topTags = Object.entries(tagsCurrent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    item_count: currentItems.length,
    unique_tags: Object.keys(tagsCurrent).length,
    unique_categories: Object.keys(catsCurrent).length,
    top_tags: topTags,
    top_categories: Object.entries(catsCurrent)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    rising_tags: rising,
    falling_tags: falling,
    rising_categories: risingCats,
    falling_categories: fallingCats,
    new_tags: newTags,
    co_occurrences: computeCoOccurrences(currentItems),
    concentration: {
      hhi: computeHHI(tagsCurrent),
      top3_share: computeTop3Share(tagsCurrent)
    },
    sender_diversity: computeSenderDiversity(currentItems, topTags.map(t => t.name)),
    regulatory: {
      count: countRegulatory(currentItems),
      previous_count: previousItems.length > 0 ? countRegulatory(previousItems) : null
    }
  };
}

// === Output zusammenbauen ===

const analysis = {
  period_start: daysAgo(7),
  period_end: today,
  generated_at: new Date().toISOString(),
  total_items_loaded: items.length,
  windows: {
    "7d":  analyzeWindow("7d",  windows["7d"].current,  windows["7d"].previous),
    "30d": analyzeWindow("30d", windows["30d"].current, windows["30d"].previous),
    "90d": analyzeWindow("90d", windows["90d"].current, [])
  }
};

return [{ json: analysis }];
