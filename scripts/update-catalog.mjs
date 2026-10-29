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
const plain = value => String(typeof value === 'object' ? value?.['#text'] ?? '' : value ?? '');
export function parseFeed(xml, program) {
  if (XMLValidator.validate(xml) !== true) throw new Error('RSSのXMLが不正です');
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel || !array(channel.item).length) throw new Error(`${program.name}: RSSに記事がありません`);
  return array(channel.item).flatMap(item => {
    const sourceUrl = plain(item.link);
    if (!/^https:\/\/omocoro\.jp\/(radio|rensai)\/\d+\/$/.test(sourceUrl)) return [];
    const content = [item['content:encoded'], item.description].map(plain).join('\n');
    const urls = [...array(item.enclosure).map(e => e['@_url']), ...[...content.matchAll(/https?:\/\/[^\s"'<>]+\.mp3(?:\?[^\s"'<>]*)?/gi)].map(m => m[0])];
    const url = urls.find(value => { try { const u = new URL(value); return u.protocol === 'https:' && /(^|\.)omocoro\.(heteml\.net|jp)$/.test(u.hostname) && u.pathname.endsWith('.mp3'); } catch { return false; } });
    if (!url) throw new Error(`${program.name}: MP3が見つかりません: ${sourceUrl}`);
    const title = plain(item.title);
    const createdAt = new Date(plain(item.pubDate)).toISOString();
    return [{ id: createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24), title, url, createdAt, playlistId: program.id, sourceUrl }];
  });
}
export function mergeCatalog(previous, entries) {
  const bySource = new Map(previous.map(item => [item.sourceUrl || item.url, item]));
  for (const item of entries) bySource.set(item.sourceUrl || item.url, item);
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
