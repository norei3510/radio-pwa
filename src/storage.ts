import { PlaybackPrefs, Playlist, RadioItem } from './types';

declare const __RADIO_CATALOG__: { version: number; playlists: Playlist[]; items: RadioItem[] };
const catalog = __RADIO_CATALOG__;

export const DEFAULT_PLAYLISTS: Playlist[] = catalog.playlists;
export const defaultItems: RadioItem[] = catalog.items;
export const defaultPrefs: PlaybackPrefs = { shuffle: false, volume: 0.85, selectedPlaylistId: 'tokumei', sortMode: 'default', lastPlayedByPlaylist: {} };
const KEY = 'radio.playback-prefs.catalog.v1';

async function loadLegacyAppData() {
  let stored: Partial<PlaybackPrefs> = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem('radio.playback-prefs.v2') ?? '{}') ?? {}; } catch { /* Settings are optional. */ }
  const prefs = { ...defaultPrefs, ...stored, lastPlayedByPlaylist: stored.lastPlayedByPlaylist && typeof stored.lastPlayedByPlaylist === 'object' ? stored.lastPlayedByPlaylist : {} };
  prefs.volume = Number.isFinite(prefs.volume) ? Math.min(1, Math.max(0, prefs.volume)) : defaultPrefs.volume;
  prefs.shuffle = prefs.shuffle === true;
  if (!['default', 'number_asc', 'number_desc'].includes(prefs.sortMode)) prefs.sortMode = 'default';
  return { prefs };
}

export async function savePrefs(prefs: PlaybackPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

// Catalog is maintained in Git, never written back from the phone.
export async function loadAppData() {
  let data = catalog;
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'catalog.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('一覧取得失敗');
    const candidate = await response.json();
    if (candidate.version !== 1 || !Array.isArray(candidate.items) || !Array.isArray(candidate.playlists) || candidate.playlists.length !== 3 || !candidate.items.every((item: RadioItem) => typeof item.id === 'string' && typeof item.url === 'string' && typeof item.title === 'string' && candidate.playlists.some((p: Playlist) => p.id === item.playlistId))) throw new Error('一覧形式不正');
    data = candidate;
  } catch { /* Bundled catalog also works offline. */ }
  const legacy = await loadLegacyAppData();
  const selectedPlaylistId = data.playlists.some(p => p.id === legacy.prefs.selectedPlaylistId) ? legacy.prefs.selectedPlaylistId : data.playlists[0].id;
  for (const [playlistId, id] of Object.entries(legacy.prefs.lastPlayedByPlaylist)) {
    if (!data.items.some(item => item.id === id && item.playlistId === playlistId)) delete legacy.prefs.lastPlayedByPlaylist[playlistId];
  }
  return { items: data.items, playlists: data.playlists, prefs: { ...legacy.prefs, selectedPlaylistId } };
}
