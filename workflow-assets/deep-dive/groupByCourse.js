// === Input: Regulatory items der letzten 7 Tage ===

const items = $input.all().map(i => i.json);

if (items.length === 0) {
  return [{ json: { courses: [], total_items: 0, message: "Keine regulatorischen Updates in diesem Zeitraum." } }];
}

const today = new Date().toISOString().split("T")[0];
const periodStart = new Date();
periodStart.setDate(periodStart.getDate() - 7);
const periodStartStr = periodStart.toISOString().split("T")[0];

// === Nach Kurs (= Kategorie) gruppieren ===

const courseMap = {};

for (const item of items) {
  const ct = item.matched_categories_tags;
  if (!Array.isArray(ct) || ct.length === 0) continue;

  // Dedupliziere Kategorien pro Item
  const seenCourses = new Set();
  for (const { category, tag } of ct) {
    if (seenCourses.has(category)) continue;
    seenCourses.add(category);

    if (!courseMap[category]) {
      courseMap[category] = {
        course_name: category,
        items: [],
        tags: {},
        senders: new Set()
      };
    }

    const course = courseMap[category];
    course.items.push({
      id: item.id,
      topic_name: item.topic_name,
      topic_summary: item.topic_summary,
      topic_link: item.topic_link,
      email_date: item.email_date,
      sender: item.sender,
      tag: tag
    });

    course.tags[tag] = (course.tags[tag] || 0) + 1;
    if (item.sender) course.senders.add(item.sender);
  }
}

// === Output: Ein Item pro betroffenen Kurs ===

const courses = Object.values(courseMap)
  .map(course => ({
    course_name: course.course_name,
    item_count: course.items.length,
    sender_count: course.senders.size,
    tags: Object.entries(course.tags)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count })),
    items: course.items,
    item_ids: course.items.map(i => i.id),
    period_start: periodStartStr,
    period_end: today
  }))
  .sort((a, b) => b.item_count - a.item_count);

return courses.map(course => ({ json: course }));
