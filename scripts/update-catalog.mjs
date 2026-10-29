import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const programs = [
  { id: 'tokumei', name: '匿名ラジオ', tag: '匿名ラジオ' },
  { id: 'watch', name: 'オモコロウォッチ', tag: 'ニュース！オモコロウォッチ！' },
  { id: 'mongol', name: 'モンゴルナイトフィーバー', tag: 'モンゴルナイトフィーバー' },
];
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const parser = new XMLParser({ ignoreAttributes: false, textNodeName: '#text' });
const plain = value => {
  let text = String(typeof value === 'object' ? value?.['#text'] ?? '' : value ?? '');
  // WordPress titles can contain HTML entities inside XML-escaped text or CDATA.
  for (let pass = 0; pass < 2; pass++) text = text.replace(/&#(x[\da-f]+|\d+);/gi, (match, code) => {
    const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
  }).replace(/&(amp|quot|apos|lt|gt);/g, (_, name) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[name]);
  return text;
};
export function audioEntries(entry, urls) {
  const unique = [...new Set(urls.map(value => {
    const url = new URL(value);
    url.protocol = 'https:';
    url.searchParams.delete('_');
    return url.href;
  }))];
  return unique.map((url, index) => index === 0 ? { ...entry, url } : {
    ...entry, url, part: index,
    id: createHash('sha256').update(`${entry.sourceUrl}#part:${index}`).digest('hex').slice(0, 24),
    title: `${entry.title}（音源 ${index + 1}/${unique.length}）`,
  });
}
export function parseFeed(xml, program, { onMissingAudio } = {}) {
  if (XMLValidator.validate(xml) !== true) throw new Error('RSSのXMLが不正です');
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel || !array(channel.item).length) throw new Error(`${program.name}: RSSに記事がありません`);
  return array(channel.item).flatMap(item => {
    const sourceUrl = plain(item.link);
    if (!/^https:\/\/omocoro\.jp\/(radio|rensai)\/\d+\/$/.test(sourceUrl)) return [];
    const content = [item['content:encoded'], item.description].map(plain).join('\n');
    const urls = [...array(item.enclosure).map(e => e['@_url']), ...[...content.matchAll(/https?:\/\/[^\s"'<>]+\.mp3(?:\?[^\s"'<>]*)?/gi)].map(m => m[0])];
    const audioUrls = urls.filter(value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && /(^|\.)omocoro\.(heteml\.net|jp)$/.test(u.hostname) && u.pathname.endsWith('.mp3'); } catch { return false; } });
    const title = plain(item.title);
    const createdAt = new Date(plain(item.pubDate)).toISOString();
    const entry = { id: createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24), title, createdAt, playlistId: program.id, sourceUrl };
    if (!audioUrls.length) {
      if (onMissingAudio) { onMissingAudio(entry); return []; }
      throw new Error(`${program.name}: MP3が見つかりません: ${sourceUrl}`);
    }
    return audioEntries(entry, audioUrls);
  });
}
export function mergeCatalog(previous, entries) {
  const key = item => `${item.sourceUrl || item.url}#part:${item.part ?? 0}`;
  const bySource = new Map(previous.map(item => [key(item), item]));
  for (const item of entries) bySource.set(key(item), item);
  return [...bySource.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
export async function updateCatalog() {
  const path = new URL('../public/catalog.json', import.meta.url);
  const previous = JSON.parse(await readFile(path, 'utf8'));
  const fresh = [];
  // Fetch serially; a failure leaves the existing catalog untouched.
  for (const program of programs) {
    const response = await fetch(`https://omocoro.jp/tag/${encodeURIComponent(program.tag)}/feed/`, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'RadioDesk/1.0 (RSS reader)' } });
    if (!response.ok) throw new Error(`${program.name}: HTTP ${response.status}`);
    const entries = parseFeed(await response.text(), program);
    if (!entries.length) throw new Error(`${program.name}: 音源がありません`);
    fresh.push(...entries);
  }
  const items = mergeCatalog(previous.items, fresh);
  const playlists = programs.map(({id, name}) => ({id, name}));
  if (JSON.stringify(items) === JSON.stringify(previous.items) && JSON.stringify(playlists) === JSON.stringify(previous.playlists)) { console.log('新着なし'); return; }
  await writeFile(path, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), playlists, items }, null, 2) + '\n');
  console.log(`音源一覧を更新: ${items.length}件`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await updateCatalog();
