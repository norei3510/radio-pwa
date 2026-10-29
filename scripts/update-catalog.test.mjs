import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, mergeCatalog, programs } from './update-catalog.mjs';
const feed = url => `<rss><channel><item><title>匿名ラジオ &amp; 第1回</title><link>https://omocoro.jp/radio/123/</link><pubDate>Thu, 29 Oct 2026 00:00:00 GMT</pubDate><enclosure url="${url}" /></item></channel></rss>`;
test('実URLを抽出し、タイトルと公開日時を保持する', () => {
  const [item] = parseFeed(feed('https://omocoro.heteml.net/radio/tokumei/5to39u.mp3'), programs[0]);
  assert.equal(item.url, 'https://omocoro.heteml.net/radio/tokumei/5to39u.mp3');
  assert.equal(item.title, '匿名ラジオ & 第1回');
  assert.equal(item.createdAt, '2026-10-29T00:00:00.000Z');
});
test('過去回を保持し、同じ記事のURL訂正を更新する', () => {
  const [item] = parseFeed(feed('https://omocoro.heteml.net/radio/a.mp3'), programs[0]);
  const old = { ...item, id: 'old', sourceUrl: 'https://omocoro.jp/radio/1/' };
  const merged = mergeCatalog([old, item], [{ ...item, url: 'https://omocoro.heteml.net/radio/correct.mp3' }]);
  assert.equal(merged.length, 2);
  assert.ok(merged.includes(old));
  assert.ok(merged.some(x => x.url.endsWith('correct.mp3')));
});
test('空フィード、不正XML、MP3なしを失敗として扱う', () => {
  for (const xml of ['<html>error</html>', '<rss>', feed('https://example.com/a.mp3')]) assert.throws(() => parseFeed(xml, programs[0]));
});
