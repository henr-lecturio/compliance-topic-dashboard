return $input.all().map(item => ({
  json: {
    email_id: item.json.email_id,
    sender: item.json.sender,
    email_date: item.json.email_date,
    summary_general: item.json.summary_general,
    topic_name: item.json.topics.topic_name,
    topic_summary: item.json.topics.topic_summary,
    topic_link: item.json.topics.topic_link,
    is_regulatory_update: item.json.topics.is_regulatory_update ?? false,
    matched_categories_tags: item.json.topics.matched_categories_tags ?? []
  }
}));
