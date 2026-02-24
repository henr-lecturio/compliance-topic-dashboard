const aiOutput = $input.first().json.output;
const originalId = $('cleanEmail').first().json.id;

return [{
  json: {
    id: originalId,
    email_typ_is_newsletter: aiOutput.email_typ_is_newsletter,
    sender: aiOutput.sender,
    summary_general: aiOutput.summary_general,
    email_date: aiOutput.email_date,
    topics: typeof aiOutput.topics === 'string'
      ? JSON.parse(aiOutput.topics)
      : aiOutput.topics
  }
}];