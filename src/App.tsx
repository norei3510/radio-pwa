import { useEffect, useMemo, useRef, useState } from 'react';
import { PlaybackProgress } from './playback-progress';
import {
  DEFAULT_PLAYLISTS,
  defaultItems,
  defaultPrefs,
  loadAppData,
  savePrefs,
} from './storage';
import { PlaybackPrefs, PlaybackState, Playlist, RadioItem } from './types';
import {
  createShuffledIds,
  formatHostLabel,
} from './utils';

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      {children}
    </svg>
  );
}

function PlayIcon() {
  return (
    <IconBase>
      <path d="M8 6.5v11l8.5-5.5z" fill="currentColor" />
    </IconBase>
  );
}

function PauseIcon() {
  return (
    <IconBase>
      <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
    </IconBase>
  );
}

function NextIcon() {
  return (
    <IconBase>
      <path d="M6 7v10l7-5z" fill="currentColor" />
      <path d="M13 7v10l7-5z" fill="currentColor" />
      <rect x="19.5" y="7" width="1.5" height="10" rx="0.75" fill="currentColor" />
    </IconBase>
  );
}

function PreviousIcon() {
  return (
    <IconBase>
      <path d="M18 7v10l-7-5z" fill="currentColor" />
      <path d="M11 7v10l-7-5z" fill="currentColor" />
      <rect x="3" y="7" width="1.5" height="10" rx="0.75" fill="currentColor" />
    </IconBase>
  );
}

function ShuffleIcon() {
  return (
    <IconBase>
      <path
        d="M4 7h3.5c1.2 0 2.3.5 3 1.4l5 6.2c.8.9 1.8 1.4 3 1.4H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 6h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 17h3.5c1.2 0 2.3-.5 3-1.4l1.5-1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 10.2l1.5-1.8c.8-.9 1.8-1.4 3-1.4H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 15h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SeekBackIcon() {
  return (
    <IconBase>
      <path d="M12 7a5 5 0 1 0 4.3 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3 8.8 6.2 12.8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="currentColor">10</text>
    </IconBase>
  );
}

function SeekForwardIcon() {
  return (
    <IconBase>
      <path d="M12 7a5 5 0 1 1-4.3 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3 15.2 6.2 11.2 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="currentColor">10</text>
    </IconBase>
  );
}

function SearchIcon() {
  return (
    <IconBase>
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 15.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function ExternalIcon() {
  return (
    <IconBase>
      <path d="M14 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function ChevronUpIcon() {
  return (
    <IconBase>
      <path d="m7 14 5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function EqualizerIcon() {
  return (
    <IconBase>
      <rect x="5" y="9" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="10.5" y="5" width="3" height="13" rx="1" fill="currentColor" />
      <rect x="16" y="11" width="3" height="7" rx="1" fill="currentColor" />
    </IconBase>
  );
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<PlaybackProgress | null>(null);
  const [items, setItems] = useState<RadioItem[]>(defaultItems);
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);
  const [prefs, setPrefs] = useState<PlaybackPrefs>(defaultPrefs);
  const [activeId, setActiveId] = useState<string | null>(
    defaultPrefs.lastPlayedByPlaylist[defaultPrefs.selectedPlaylistId] ?? null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [statusText, setStatusText] = useState('停止中');
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDockExpanded, setIsDockExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const selectedPlaylistId = prefs.selectedPlaylistId;
  useEffect(() => { setVisibleCount(100); }, [selectedPlaylistId, searchQuery, prefs.sortMode]);
  const selectedPlaylist =
    playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0] ?? DEFAULT_PLAYLISTS[0];
  const selectedItems = useMemo(
    () => items.filter((item) => item.playlistId === selectedPlaylistId),
    [items, selectedPlaylistId],
  );
  const normalizedSearchQuery = searchQuery.normalize('NFKC').trim().toLowerCase();
  const filteredSelectedItems = useMemo(() => {
    const filtered = !normalizedSearchQuery
      ? selectedItems
      : selectedItems.filter((item) => item.title.normalize('NFKC').toLowerCase().includes(normalizedSearchQuery));

    if (prefs.sortMode === 'default') {
      return filtered;
    }

    const direction = prefs.sortMode === 'number_desc' ? -1 : 1;
    return [...filtered].sort((left, right) => {
      const leftDigits = left.title.match(/\d+/)?.[0] ?? '';
      const rightDigits = right.title.match(/\d+/)?.[0] ?? '';
      const leftValue = leftDigits ? Number(leftDigits) : Number.NEGATIVE_INFINITY;
      const rightValue = rightDigits ? Number(rightDigits) : Number.NEGATIVE_INFINITY;

      if (leftValue === rightValue) {
        return left.createdAt.localeCompare(right.createdAt) * direction;
      }

      return (leftValue - rightValue) * direction;
    });
  }, [normalizedSearchQuery, prefs.sortMode, selectedItems]);
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [activeId, items],
  );

  useEffect(() => {
    if (!audioRef.current) return;
    const progress = new PlaybackProgress(audioRef.current, {
      storage: {
        getItem: key => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      visibilityTarget: document,
      pageTarget: window,
      onError: () => setError('再生位置を保存できませんでした。端末のストレージ設定を確認してください。'),
    });
    progressRef.current = progress;
    return () => { progress.dispose(); progressRef.current = null; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadAppData()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setItems(data.items);
        setPlaylists(data.playlists);
        setPrefs(data.prefs);
        setActiveId(data.prefs.lastPlayedByPlaylist[data.prefs.selectedPlaylistId] ?? null);
        const remembered = data.items.find(item => item.id === data.prefs.lastPlayedByPlaylist[data.prefs.selectedPlaylistId]);
        setCurrentTime(remembered ? progressRef.current?.getPosition(remembered) ?? 0 : 0);
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError('設定を読み込めませんでした。再読み込みしてください。');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);



  useEffect(() => {
    if (!hydrated) {
      return;
    }
    void savePrefs(prefs).catch(() => setError('再生設定を保存できませんでした。'));
  }, [hydrated, prefs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = prefs.volume;
  }, [prefs.volume]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const playNext = () => {
    if (selectedItems.length === 0) {
      return;
    }

    const currentQueue =
      queue.length > 0 ? queue : buildQueue(selectedItems, activeId ?? undefined, prefs.shuffle);
    const currentIndex = activeId ? currentQueue.indexOf(activeId) : -1;
    const nextId = currentQueue[currentIndex + 1];

    if (!nextId) {
      audioRef.current?.pause();
      setPlaybackState('paused');
      setStatusText('再生完了');
      return;
    }

    void startPlayback(nextId, false, currentQueue);
  };

  const playPrevious = () => {
    if (selectedItems.length === 0) {
      return;
    }

    const currentQueue =
      queue.length > 0 ? queue : buildQueue(selectedItems, activeId ?? undefined, prefs.shuffle);
    const currentIndex = activeId ? currentQueue.indexOf(activeId) : -1;
    const previousId = currentQueue[currentIndex - 1];
    const fallbackId = currentQueue[0];

    if (previousId) {
      void startPlayback(previousId, false, currentQueue);
      return;
    }

    if (fallbackId) {
      void startPlayback(fallbackId, false, currentQueue);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleWaiting = () => {
      setPlaybackState('loading');
      setStatusText('読み込み中');
    };
    const handlePlaying = () => {
      setPlaybackState('playing');
      setStatusText('再生中');
    };
    const handlePause = () => {
      setPlaybackState((current) => (current === 'error' ? current : 'paused'));
      setStatusText('一時停止');
    };
    const handleEnded = () => {
      setCurrentTime(0);
      playNext();
    };
    const handleError = () => {
      setPlaybackState('error');
      setStatusText('再生失敗');
      setError('この音源は再生できませんでした。URLまたは配信設定を確認してください。');
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setCurrentTime(audio.currentTime);
    };
    const handleDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);

    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
  }, [activeId, selectedItems, playNext]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof window === 'undefined' ||
      typeof window.MediaMetadata === 'undefined'
    ) {
      return;
    }

    try {
      if (!activeItem) {
        navigator.mediaSession.metadata = null;
        return;
      }

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: activeItem.title,
        artist: 'Radio Desk',
        album: formatHostLabel(activeItem.url),
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          void resumePlayback();
        });
      } catch {}

      try {
        navigator.mediaSession.setActionHandler('pause', () => {
          pausePlayback();
        });
      } catch {}

      try {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNext();
        });
      } catch {}

      try {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          playPrevious();
        });
      } catch {}
    } catch {
      // Ignore partial Media Session support on iPhone Safari.
    }
  }, [activeItem, playNext, playPrevious]);

  function buildQueue(sourceItems: RadioItem[], seedId?: string, shuffle = prefs.shuffle) {
    if (sourceItems.length === 0) {
      return [];
    }

    const ordered = [...sourceItems].sort((a,b) => prefs.sortMode === 'number_asc' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
    return shuffle ? createShuffledIds(ordered, seedId) : ordered.map(item => item.id);
  }

  async function startPlayback(itemId: string, rebuildQueue = true, incomingQueue?: string[]) {
    const item = items.find((entry) => entry.id === itemId);
    const audio = audioRef.current;

    if (!item || !audio) {
      return;
    }

    if (isOffline) {
      setError('オフライン中は音声を再生できません。通信が戻ると再生できます。');
      return;
    }

    const playlistItems = items.filter((entry) => entry.playlistId === item.playlistId);
    const nextQueue = incomingQueue ?? (rebuildQueue ? buildQueue(playlistItems, itemId) : queue);
    if (nextQueue.length > 0) {
      setQueue(nextQueue);
    }

    setError('');
    setPrefs(current => ({ ...current, selectedPlaylistId: item.playlistId, lastPlayedByPlaylist: { ...current.lastPlayedByPlaylist, [item.playlistId]: itemId } }));
    setActiveId(itemId);
    setPlaybackState('loading');
    setStatusText('読み込み中');

    if (audio.src !== item.url) {
      const position = progressRef.current?.prepare(item) ?? 0;
      audio.src = item.url;
      setCurrentTime(position);
      setDuration(0);
    }

    try {
      await audio.play();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setPlaybackState('error');
      setStatusText('再生失敗');
      setError('自動再生がブロックされたか、音源にアクセスできません。再生ボタンを押してください。');
    }
  }

  async function resumePlayback() {
    if (!activeItem) {
      if (selectedItems.length > 0) {
        await startPlayback(selectedItems[0].id);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.src !== activeItem.url) {
      await startPlayback(activeItem.id);
      return;
    }
    setError('');
    try {
      await audio.play();
    } catch {
      setError('再生を開始できませんでした。画面上の操作から再度試してください。');
    }
  }

  function pausePlayback() {
    audioRef.current?.pause();
  }

  function toggleShuffle() {
    const nextShuffle = !prefs.shuffle;
    setPrefs((current) => ({ ...current, shuffle: nextShuffle }));
    setQueue(buildQueue(selectedItems, activeId ?? undefined, nextShuffle));
  }

  function switchPlaylist(playlistId: string) {
    progressRef.current?.release();
    audioRef.current?.pause();
    setQueue([]);
    audioRef.current?.removeAttribute('src');
    audioRef.current?.load();
    const remembered = items.find(item => item.id === prefs.lastPlayedByPlaylist[playlistId]);
    setCurrentTime(remembered ? progressRef.current?.getPosition(remembered) ?? 0 : 0);
    setDuration(0);
    setActiveId(prefs.lastPlayedByPlaylist[playlistId] ?? null);
    setPlaybackState('paused');
    setStatusText('一時停止');
    setPrefs(current => ({ ...current, selectedPlaylistId: playlistId }));
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    audio.currentTime = value;
    progressRef.current?.capture(true);
    setCurrentTime(value);
  }

  function seekBy(delta: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = Math.max(0, Math.min(audio.currentTime + delta, Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + delta));
    audio.currentTime = nextTime;
    progressRef.current?.capture(true);
    setCurrentTime(nextTime);
  }

  function formatTime(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      return '0:00';
    }

    const totalSeconds = Math.floor(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  const progressRatio = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const statusTone = isOffline
    ? 'is-offline'
    : playbackState === 'playing'
      ? 'is-playing'
      : playbackState === 'loading'
        ? 'is-loading'
        : playbackState === 'error'
          ? 'is-error'
          : '';
  const trackMeta = !activeItem
    ? '下の一覧から聴きたい回を選んでください'
    : duration > 0
      ? `${formatTime(currentTime)} / ${formatTime(duration)}`
      : currentTime > 0
        ? `続きは${formatTime(currentTime)}から再生できます`
        : '再生ボタンで聴けます';
  const playerDisabled = !hydrated || selectedItems.length === 0;

  return (
    <div className="app-shell">
      <audio ref={audioRef} preload="none" />

      <header className="app-header">
        <div className="app-heading">
          <h1 className="app-title">Radio Desk</h1>
          <p className="catalog-note">3番組の音源を自動更新</p>
        </div>
        <p role="status" className={`status-chip ${statusTone}`}>
          <span className="status-dot" aria-hidden="true" />
          {isOffline ? 'オフライン' : statusText}
        </p>
      </header>

      {isOffline && <p className="notice-banner">音声の再生には通信が必要です。通信が戻ると再生できます。</p>}
      {error && (
        <div role="alert" className="error-banner">
          <p>{error}</p>
          <button type="button" className="banner-close" onClick={() => setError('')} aria-label="エラーを閉じる">
            <CloseIcon />
          </button>
        </div>
      )}

      <main className="main-grid">
        <div className="tab-content-scroll">
          <section className="now-playing" aria-label="再生中">
            <div className="playlist-rail" role="group" aria-label="番組">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className={`playlist-chip ${playlist.id === selectedPlaylistId ? 'is-active' : ''}`}
                  aria-pressed={playlist.id === selectedPlaylistId}
                  onClick={() => {
                    if (playlist.id !== selectedPlaylistId) {
                      switchPlaylist(playlist.id);
                    }
                  }}
                >
                  {playlist.name}
                </button>
              ))}
            </div>

            <div className="track-card">
              <p className="track-eyebrow">{selectedPlaylist.name}</p>
              <h2>{activeItem?.title ?? 'まだ選択されていません'}</h2>
              <p className="track-meta">{trackMeta}</p>
            </div>
          </section>

          <section className="list-panel" aria-labelledby="list-heading">
            <div className="list-head">
              <h2 id="list-heading" className="list-title">エピソード</h2>
              <p className="count-chip">
                全{selectedItems.length}回{searchQuery && ` · 該当${filteredSelectedItems.length}回`}
              </p>
            </div>

            <div className="list-tools">
              <div className="search-field">
                <label htmlFor="search-input" className="field-label">検索</label>
                <div className="search-input-wrap">
                  <SearchIcon />
                  <input
                    id="search-input"
                    type="search"
                    enterKeyHint="search"
                    placeholder="タイトルで探す"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  {searchQuery && (
                    <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="検索をクリア">
                      <CloseIcon />
                    </button>
                  )}
                </div>
              </div>
              <div className="sort-field">
                <label htmlFor="sort-select" className="field-label">並び順</label>
                <select
                  id="sort-select"
                  className="sort-select"
                  value={prefs.sortMode}
                  onChange={(event) => {
                    setQueue([]);
                    setPrefs((p) => ({ ...p, sortMode: event.target.value as PlaybackPrefs['sortMode'] }));
                  }}
                >
                  <option value="default">新しい順</option>
                  <option value="number_asc">古い順</option>
                  <option value="number_desc">番号が新しい順</option>
                </select>
              </div>
            </div>

            <ul className="station-list">
              {filteredSelectedItems.slice(0, visibleCount).map((item) => {
                const isActive = item.id === activeId;
                const isPlayingItem = isActive && playbackState === 'playing';
                return (
                  <li key={item.id} className={`station-row ${isActive ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      className="station-main"
                      disabled={!hydrated}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => {
                        void startPlayback(item.id);
                      }}
                    >
                      <span className="station-icon" aria-hidden="true">
                        {isPlayingItem ? <EqualizerIcon /> : <PlayIcon />}
                      </span>
                      <span className="station-text">
                        <strong className="station-title">{item.title}</strong>
                        {isActive && (
                          <span className="station-state">
                            {isPlayingItem ? '再生中' : playbackState === 'loading' ? '読み込み中' : '選択中'}
                          </span>
                        )}
                      </span>
                    </button>
                    {item.sourceUrl && (
                      <a
                        className="station-link"
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${item.title}の公式記事を開く`}
                      >
                        <ExternalIcon />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>

            {filteredSelectedItems.length === 0 && (
              <div className="empty-state">
                {searchQuery ? (
                  <>
                    <p>「{searchQuery}」に一致する回はありません。別の言葉で探してください。</p>
                    <button type="button" className="secondary" onClick={() => setSearchQuery('')}>
                      検索をクリア
                    </button>
                  </>
                ) : (
                  <p>この番組の音源はまだありません。自動更新をお待ちください。</p>
                )}
              </div>
            )}
            {filteredSelectedItems.length > visibleCount && (
              <button type="button" className="secondary more-button" onClick={() => setVisibleCount((count) => count + 100)}>
                さらに100回を表示（残り{filteredSelectedItems.length - visibleCount}回）
              </button>
            )}
          </section>
        </div>
      </main>

      <div className="bottom-player-dock">
        <div className="dock-panel">
          <div className="dock-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progressRatio})` }} />
          </div>

          {isDockExpanded && (
            <div className="seekbar-block" id="dock-expanded">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => handleSeek(Number(event.target.value))}
                disabled={duration <= 0}
                aria-label="再生位置"
              />
              <div className="seekbar-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="seekbar-actions">
                <button
                  type="button"
                  className="secondary icon-button"
                  onClick={() => seekBy(-10)}
                  disabled={duration <= 0}
                  aria-label="10秒戻る"
                >
                  <SeekBackIcon />
                </button>
                <button
                  type="button"
                  className={`toggle-button ${prefs.shuffle ? 'is-active' : ''}`}
                  onClick={toggleShuffle}
                  aria-pressed={prefs.shuffle}
                >
                  <ShuffleIcon />
                  <span>シャッフル</span>
                </button>
                <button
                  type="button"
                  className="secondary icon-button"
                  onClick={() => seekBy(10)}
                  disabled={duration <= 0}
                  aria-label="10秒進む"
                >
                  <SeekForwardIcon />
                </button>
              </div>
            </div>
          )}

          <div className="control-cluster">
            <button
              type="button"
              className="dock-title-button"
              onClick={() => setIsDockExpanded((current) => !current)}
              aria-expanded={isDockExpanded}
              aria-controls="dock-expanded"
            >
              <span className="dock-title-text">
                <span className="dock-title">{activeItem?.title ?? '未再生'}</span>
                <span className="dock-hint">
                  {isDockExpanded ? 'タップで閉じる' : prefs.shuffle ? 'シャッフル中 · タップで操作' : 'タップでシーク・シャッフル'}
                </span>
              </span>
              <span className="dock-chevron" aria-hidden="true">
                <ChevronUpIcon />
              </span>
            </button>
            <button
              type="button"
              className="dock-action icon-button"
              onClick={playPrevious}
              disabled={playerDisabled}
              aria-label="前へ"
            >
              <PreviousIcon />
            </button>
            <button
              type="button"
              className="play-button icon-button"
              onClick={() => {
                if (playbackState === 'playing') {
                  pausePlayback();
                } else {
                  void resumePlayback();
                }
              }}
              disabled={playerDisabled}
              aria-label={playbackState === 'playing' ? '一時停止' : '再生'}
            >
              {playbackState === 'playing' ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className="dock-action icon-button"
              onClick={playNext}
              disabled={playerDisabled}
              aria-label="次へ"
            >
              <NextIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
