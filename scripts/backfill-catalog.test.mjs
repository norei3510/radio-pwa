import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectArchive } from './backfill-catalog.mjs';
import { programs } from './update-catalog.mjs';
const feed = (id, audio = true) => `<rss><channel><item><title>第${id}回</title><link>https://omocoro.jp/radio/${id}/</link><pubDate>Thu, 29 Oct 2026 00:00:00 GMT</pubDate>${audio ? `<enclosure url="https://omocoro.heteml.net/radio/${id}.mp3" />` : ''}</item></channel></rss>`;
test('最終ページまで取得し、境界の重複を排除する', async () => {
  const pages = [feed(3), feed(2), feed(1), null];
  const result = await collectArchive(programs[0], async (_, page) => pages[page - 1]);
  assert.equal(result.length, 3);
  assert.ok(result.some(item => item.title === '第1回'));
});
test('同じページの再送を検出し、不完全な一覧を成功扱いしない', async () => {
  await assert.rejects(collectArchive(programs[0], async () => feed(1)), /繰り返され/);
});
test('通信エラーを最終ページと取り違えない', async () => {
  await assert.rejects(collectArchive(programs[0], async (_, page) => { if (page === 1) return feed(1); throw new Error('HTTP 503'); }), /503/);
  await assert.rejects(collectArchive(programs[0], async () => '<html>error</html>'), /RSSではありません/);
});
test('音声のない記事を記録し、それより古い回も取得する', async () => {
  const missing = [];
  const pages = [feed(3, false), feed(2), '<rss><channel><title>終端</title></channel></rss>'];
  const result = await collectArchive(programs[0], async (_, page) => pages[page - 1], { onMissingAudio: entry => missing.push(entry) });
  assert.equal(missing.length, 1);
  assert.equal(result[0].title, '第2回');
});
