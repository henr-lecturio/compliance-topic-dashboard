const newItems = $('aggregate').first().json['collected'];

const fileData = $input.first().json['data'];
const items = (fileData && fileData['items']) ? fileData['items'] : [];

for (const item of newItems) {
  items.push(item);
}

return [{ json: { items } }];