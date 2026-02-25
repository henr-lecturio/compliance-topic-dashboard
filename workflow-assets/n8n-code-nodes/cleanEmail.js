const item = $input.first().json;
const text = item.text || '';

const lines = text.replace(/\r\n/g, '\n').split('\n');
const urlOnly = /^\s*https?:\/\/\S+\s*$/;
const result = [];

const keepLabels = [
  /zum programm/i,
  /jetzt anmelden/i,
  /zur veranstaltung/i,
  /zum buch/i,
  /zum artikel/i,
  /mehr erfahren/i,
  /weiterlesen/i,
  /jetzt (teilnehmen|buchen|sichern|bestellen)/i,
  /zur anmeldung/i,
  /zum shop/i,
];

const noiseLabels = [
  /bei darstellungsproblemen/i,
  /^\s*linkedin\s*$/i,
  /^\s*instagram\s*$/i,
  /^\s*facebook\s*$/i,
  /^\s*twitter\s*$/i,
  /^\s*xing\s*$/i,
  /^\s*hier\s+unsere\s+newsletter/i,
];

function findNextText(startIdx) {
  for (let j = startIdx; j < Math.min(startIdx + 4, lines.length); j++) {
    const t = lines[j].trim();
    if (t && !urlOnly.test(lines[j])) {
      return { text: t, index: j };
    }
  }
  return { text: '', index: -1 };
}

const skipIndices = new Set();

for (let i = 0; i < lines.length; i++) {
  if (skipIndices.has(i)) continue;

  const trimmed = lines[i].trim();

  if (urlOnly.test(lines[i])) {
    const next = findNextText(i + 1);

    if (next.text && noiseLabels.some(p => p.test(next.text))) {
      skipIndices.add(next.index);
      continue;
    }

    if (next.text && keepLabels.some(p => p.test(next.text))) {
      result.push(`[${next.text}](${trimmed})`);
      skipIndices.add(next.index);
      continue;
    }

    continue;
  }

  if (noiseLabels.some(p => p.test(trimmed))) {
    continue;
  }

  // Alles andere behalten
  result.push(lines[i]);
}

let content = result.join('\n')
  .replace(/&bdquo;/g, '„')
  .replace(/&ldquo;/g, '"')
  .replace(/&rdquo;/g, '"')
  .replace(/&ndash;/g, '–')
  .replace(/&mdash;/g, '—')
  .replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ')
  .replace(/&[a-z]+;/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const footerMarkers = [
  /Sie wollen keine Veranstaltung mehr verpassen/i,
  /newsletter\s*(abbestellen|abmelden)/i,
  /^\s*copyright\b/im,
  /impressum/i,
];

for (const pattern of footerMarkers) {
  const match = content.search(pattern);
  if (match > content.length * 0.4) {
    content = content.substring(0, match).trim();
    break;
  }
}

const fromAddress = item.from?.value?.[0]?.address
  || item.from?.text
  || 'unknown';

return [{
  json: {
    email_id: item.id,
    from: fromAddress,
    subject: item.subject,
    date: item.date,
    body: content
  }
}];
