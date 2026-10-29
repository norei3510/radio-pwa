import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { programs, parseFeed, mergeCatalog, audioEntries } from './update-catalog.mjs';

const parser = new XMLParser({ ignoreAttributes: false });
export async function collectArchive(program, readPage, { onMissingAudio } = {}) {
  const entries = [];
  const seenPages = new Set();
  for (let page = 1; page <= 500; page++) {
    const xml = await readPage(program, page);
    if (xml === null && page > 1) return mergeCatalog([], entries);
    if (XMLValidator.validate(xml) !== true) throw new Error(`${program.name}: 不正なXML (${page})`);
    const channel = parser.parse(xml)?.rss?.channel;
    if (!channel) throw new Error(`${program.name}: RSSではありません (${page})`);
    if (!channel.item) return mergeCatalog([], entries);
    const pageItems = parseFeed(xml, program, { onMissingAudio });
    const signature = JSON.stringify(channel.item);
    if (seenPages.has(signature)) throw new Error(`${program.name}: 同じページが繰り返されています (${page})`);
    seenPages.add(signature);
    entries.push(...pageItems);
  }
  throw new Error(`${program.name}: ページ上限に達しました。途中の一覧は保存しません。`);
}

async function readPage(program, page) {
  const cache = new URL(`../work/archive-feeds/${program.id}-${page}.xml`, import.meta.url);
  try { return await readFile(cache, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await new Promise(resolve => setTimeout(resolve, 300));
  const url = `https://omocoro.jp/tag/${encodeURIComponent(program.tag)}/feed/?paged=${page}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'RadioDesk/1.0 (RSS archive reader)' } });
      if (response.status === 404 && page > 1) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (XMLValidator.validate(xml) !== true || !parser.parse(xml)?.rss?.channel) throw new Error('RSSではありません');
      await writeFile(cache, xml);
      console.log(`${program.name}: ページ${page}`);
      return xml;
    } catch (error) {
      if (attempt === 2) throw new Error(`${program.name} ページ${page}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}

export async function backfillCatalog() {
  await mkdir(new URL('../work/archive-feeds/', import.meta.url), { recursive: true });
  const path = new URL('../public/catalog.json', import.meta.url);
  const previous = JSON.parse(await readFile(path, 'utf8'));
  const all = [];
  const missing = [];
  for (const program of programs) {
    const entries = await collectArchive(program, readPage, { onMissingAudio: entry => missing.push(entry) });
    if (!entries.length) throw new Error(`${program.name}: 音源がありません`);
    console.log(`${program.name}: ${entries.length}件・最古 ${entries.at(-1).title}`);
    all.push(...entries);
  }
  const unavailable = [];
  for (const entry of missing) {
    const cache = new URL(`../work/archive-feeds/article-${entry.id}.html`, import.meta.url);
    let html;
    try { html = await readFile(cache, 'utf8'); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await new Promise(resolve => setTimeout(resolve, 300));
      const response = await fetch(entry.sourceUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${entry.sourceUrl}: HTTP ${response.status}`);
      html = await response.text();
      await writeFile(cache, html);
    }
    const urls = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.mp3(?:\?[^\s"'<>]*)?/gi)].map(m => m[0].replaceAll('&amp;', '&'));
    const audioUrls = urls.filter(value => { const u = new URL(value); return /(^|\.)omocoro\.(heteml\.net|jp)$/.test(u.hostname); });
    if (audioUrls.length) all.push(...audioEntries(entry, audioUrls));
    else unavailable.push({ ...entry, reason: '公式記事に公開MP3リンクなし' });
    console.log(`${audioUrls.length ? '本文から取得' : '公開MP3なし'}: ${entry.title}`);
  }
  const items = mergeCatalog(previous.items, all);
  await writeFile(new URL('../public/archive-report.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), imported: items.length, unavailable }, null, 2) + '\n');
  await writeFile(path, JSON.stringify({ ...previous, updatedAt: new Date().toISOString(), items }, null, 2) + '\n');
  console.log(`全番組の過去回を保存: ${items.length}件`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await backfillCatalog();
