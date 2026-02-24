const staticData = $getWorkflowStaticData('global');

if (!staticData.items) {
  staticData.items = [];
}

const mapData = $('mapOutput').first().json;

if (mapData.email_typ_is_newsletter) {
  for (const item of $('Split Out').all()) {
    staticData.items.push(item.json);
  }
}

return [
  {
    json: { collected: staticData.items }
  }
];