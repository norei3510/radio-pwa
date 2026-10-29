import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/playback-progress.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { PlaybackProgress } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const track = { id: 'a', url: 'https://example.com/a.mp3' };
class Audio extends EventTarget {
  src = ''; currentTime = 0; duration = 600; readyState = 0; ended = false;
  send(type) { this.dispatchEvent(new Event(type)); }
}
function setup(stored = null) {
  let value = stored; let now = 0; let writes = 0; let errors = 0;
  const audio = new Audio(); const visibilityTarget = new EventTarget(); const pageTarget = new EventTarget();
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; writes++; } };
  const options = { storage, visibilityTarget, pageTarget, onError: () => errors++, now: () => now };
  const progress = new PlaybackProgress(audio, options);
  const load = (item = track) => { progress.prepare(item); audio.src = item.url; audio.readyState = 1; audio.send('loadedmetadata'); };
  return { audio, progress, options, storage, load, visibilityTarget, pageTarget, snapshot: () => value, writes: () => writes, errors: () => errors, advance: ms => now += ms };
}
test('保存して閉じ、新しいプレイヤーでも同じ音源の位置を復元する', () => {
  const a = setup(); a.load(); a.audio.currentTime = 123.5; a.audio.send('pause'); a.progress.dispose();
  const b = setup(a.snapshot()); assert.equal(b.progress.prepare(track), 123.5);
  b.audio.src = track.url; b.audio.readyState = 1; b.audio.send('timeupdate'); // Loading zero must not overwrite progress.
  assert.equal(b.progress.getPosition(track), 123.5);
  b.audio.readyState = 1; b.audio.send('loadedmetadata');
  assert.equal(b.audio.currentTime, 123.5);
});
test('定期保存を間引き、シーク・非表示・ページ離脱時は即時保存する', () => {
  const a = setup(); a.load(); a.audio.currentTime = 10; a.audio.send('timeupdate');
  const first = a.writes(); a.advance(1000); a.audio.currentTime = 11; a.audio.send('timeupdate'); assert.equal(a.writes(), first);
  a.advance(4000); a.audio.currentTime = 15; a.audio.send('timeupdate'); assert.equal(a.progress.getPosition(track), 15);
  a.audio.currentTime = 20; a.audio.send('seeked'); assert.equal(a.progress.getPosition(track), 20);
  a.audio.currentTime = 21; a.visibilityTarget.dispatchEvent(new Event('visibilitychange')); assert.equal(a.progress.getPosition(track), 21);
  a.audio.currentTime = 22; a.pageTarget.dispatchEvent(new Event('pagehide')); assert.equal(a.progress.getPosition(track), 22);
});
test('番組・音源の切り替え後も各回の位置を混同せず保持する', () => {
  const a = setup(); a.load(); a.audio.currentTime = 30;
  const second = { id: 'b', url: 'https://example.com/b.mp3' }; a.load(second); a.audio.currentTime = 50;
  a.progress.release(); a.audio.currentTime = 0; a.audio.send('pause');
  assert.equal(a.progress.getPosition(track), 30); assert.equal(a.progress.getPosition(second), 50);
  assert.equal(a.progress.getPosition({ ...track, url: 'https://example.com/replacement.mp3' }), 0);
});
test('聴き終えた回は先頭に戻し、短く差し替えた音源には無効な位置を適用しない', () => {
  const a = setup(); a.load(); a.audio.currentTime = 600; a.audio.ended = true; a.audio.send('ended');
  assert.equal(a.progress.getPosition(track), 0);
  const b = setup(JSON.stringify({ a: {url: track.url, seconds: 1000} })); b.load(); assert.equal(b.audio.currentTime, 0);
});
test('壊れた保存値と保存エラーでプレイヤーを止めない', () => {
  const a = setup(JSON.stringify({ a: {url: track.url, seconds: -1}, broken: null })); a.load(); assert.equal(a.audio.currentTime, 0);
  a.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  a.audio.currentTime = 10; a.audio.send('pause'); a.audio.send('pause'); assert.equal(a.errors(), 1);
  const b = setup('not-json'); b.load(); assert.equal(b.audio.currentTime, 0);
});
