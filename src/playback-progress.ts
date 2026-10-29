type Track = { id: string; url: string };
type SavedPosition = { url: string; seconds: number };
const KEY = 'radio.playback-progress.v1';

// Keep writes synchronous: mobile browsers may terminate the page after it is hidden.
export class PlaybackProgress {
  private positions: Record<string, SavedPosition> = {};
  private track: Track | null = null;
  private pending: number | null = null;
  private lastWrite = -Infinity;
  private listeners: Array<() => void> = [];
  private reportedError = false;

  constructor(private audio: HTMLAudioElement, private options: {
    storage: Pick<Storage, 'getItem' | 'setItem'>;
    visibilityTarget: EventTarget;
    pageTarget: EventTarget;
    onError: () => void;
    now?: () => number;
  }) {
    try {
      const stored = JSON.parse(options.storage.getItem(KEY) ?? '{}');
      if (stored && typeof stored === 'object') {
        for (const [id, value] of Object.entries(stored)) {
          const position = value as SavedPosition | null;
          if (position && typeof position.url === 'string' && Number.isFinite(position.seconds) && position.seconds >= 0) this.positions[id] = position;
        }
      }
    } catch { /* Missing or damaged history starts empty. */ }
    this.listen(audio, 'timeupdate', () => this.capture());
    this.listen(audio, 'pause', () => this.capture(true));
    this.listen(audio, 'seeked', () => this.capture(true));
    this.listen(audio, 'ended', () => {
      if (!this.track) return;
      this.pending = null;
      this.positions[this.track.id] = { url: this.track.url, seconds: 0 };
      this.persist();
    });
    this.listen(audio, 'loadedmetadata', () => this.restore());
    this.listen(audio, 'canplay', () => this.restore());
    this.listen(options.visibilityTarget, 'visibilitychange', () => this.capture(true));
    this.listen(options.pageTarget, 'pagehide', () => this.capture(true));
  }

  getPosition(track: Track): number {
    const saved = this.positions[track.id];
    return saved?.url === track.url ? saved.seconds : 0;
  }

  prepare(track: Track): number {
    if (this.track?.id === track.id && this.track.url === track.url && this.audio.src === track.url) return this.pending ?? this.audio.currentTime;
    this.capture(true);
    this.track = track;
    this.pending = this.getPosition(track);
    return this.pending;
  }

  private restore() {
    if (!this.track || this.pending === null || this.audio.src !== this.track.url || this.audio.readyState < 1) return;
    const duration = this.audio.duration;
    // An episode may have been replaced with a shorter recording.
    const seconds = Number.isFinite(duration) && this.pending >= duration ? 0 : this.pending;
    try {
      this.audio.currentTime = seconds;
      this.pending = null;
    } catch { /* Retry on canplay if the browser cannot seek yet. */ }
  }

  capture(force = false) {
    if (!this.track || this.pending !== null || this.audio.src !== this.track.url || this.audio.readyState < 1) return;
    const seconds = this.audio.ended ? 0 : this.audio.currentTime;
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const now = (this.options.now ?? Date.now)();
    if (!force && now - this.lastWrite < 5000) return;
    this.positions[this.track.id] = { url: this.track.url, seconds };
    if (this.persist()) this.lastWrite = now;
  }

  release() {
    this.capture(true);
    this.track = null;
    this.pending = null;
  }

  dispose() {
    this.release();
    for (const remove of this.listeners) remove();
  }

  private persist() {
    try {
      this.options.storage.setItem(KEY, JSON.stringify(this.positions));
      return true;
    } catch {
      if (!this.reportedError) this.options.onError();
      this.reportedError = true;
      return false;
    }
  }

  private listen(target: EventTarget, event: string, handler: () => void) {
    target.addEventListener(event, handler);
    this.listeners.push(() => target.removeEventListener(event, handler));
  }
}
