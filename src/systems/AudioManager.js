import { sound } from '@pixi/sound';
import { AUDIO_MANIFEST } from '../data/audio-manifest.js';

/**
 * AudioManager - singleton wrapper around @pixi/sound.
 * Audio playback is deferred until the first user gesture to avoid
 * browser autoplay warnings when scenes are opened programmatically.
 */
export class AudioManager {
  /** @type {AudioManager | null} */
  static _instance = null;

  static get instance() {
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
    }
    return AudioManager._instance;
  }

  constructor() {
    if (AudioManager._instance) {
      return AudioManager._instance;
    }

    this._currentBGM = null;
    this._bgmVolume = 1.0;
    this._sfxVolume = 1.0;
    this._muted = false;
    this._loaded = false;
    this._failedKeys = new Set();
    this._checkedSources = new Map();
    this._pendingActions = [];
    this._preloadRequested = false;
    this._preloadPromise = null;
    this._audioUnlocked = typeof window === 'undefined';
    this._unlockHandler = this._onUserGesture.bind(this);

    this._bindUnlockEvents();
  }

  async preload() {
    if (this._loaded) return;
    if (!this._audioUnlocked) {
      this._preloadRequested = true;
      return;
    }
    await this._ensurePreloaded();
  }

  playBGM(key, options = {}) {
    if (!AUDIO_MANIFEST.bgm[key]) {
      console.warn(`[AudioManager] 알 수 없는 BGM 키: ${key}`);
      return;
    }
    if (this._failedKeys.has(key)) return;
    if (this._currentBGM === key) return;

    this.stopBGM();
    this._currentBGM = key;

    if (this._muted) return;
    if (!this._audioUnlocked) {
      this._queueAction({ kind: 'bgm', key, options });
      return;
    }

    this._playBGMNow(key, options);
  }

  stopBGM() {
    this._pendingActions = this._pendingActions.filter((action) => action.kind !== 'bgm');
    if (this._currentBGM) {
      sound.stop(this._currentBGM);
      this._currentBGM = null;
    }
  }

  pauseBGM() {
    if (this._currentBGM) sound.pause(this._currentBGM);
  }

  resumeBGM() {
    if (this._currentBGM) sound.resume(this._currentBGM);
  }

  playSFX(key, options = {}) {
    if (!AUDIO_MANIFEST.sfx[key]) {
      console.warn(`[AudioManager] 알 수 없는 SFX 키: ${key}`);
      return;
    }
    if (this._failedKeys.has(key)) return;
    if (this._muted) return;

    if (!this._audioUnlocked) {
      this._queueAction({ kind: 'sfx', key, options });
      return;
    }

    this._playSFXNow(key, options);
  }

  setBGMVolume(v) {
    this._bgmVolume = Math.max(0, Math.min(1, v));
    if (this._currentBGM) {
      const cfg = AUDIO_MANIFEST.bgm[this._currentBGM];
      sound.volume(this._currentBGM, (cfg.volume ?? 1.0) * this._bgmVolume);
    }
  }

  setSFXVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
  }

  toggleMute() {
    this._muted = !this._muted;
    sound.volumeAll = this._muted ? 0 : 1;
    return this._muted;
  }

  get muted() {
    return this._muted;
  }

  async _ensurePreloaded() {
    if (this._loaded) return;
    if (this._preloadPromise) {
      await this._preloadPromise;
      return;
    }

    this._preloadPromise = (async () => {
      const entries = [
        ...Object.entries(AUDIO_MANIFEST.bgm),
        ...Object.entries(AUDIO_MANIFEST.sfx),
      ];

      const addPromises = entries.map(([key, cfg]) => new Promise(async (resolve) => {
        if (sound.exists(key)) {
          resolve();
          return;
        }

        const exists = await this._sourceExists(cfg.src);
        if (!exists) {
          this._failedKeys.add(key);
          resolve();
          return;
        }

        sound.add(key, {
          url: cfg.src,
          loop: cfg.loop ?? false,
          volume: cfg.volume ?? 1.0,
          preload: true,
          loaded: (err) => {
            if (err) {
              this._failedKeys.add(key);
            }
            resolve();
          },
        });
      }));

      await Promise.all(addPromises);
      this._loaded = true;
      this._preloadRequested = false;
    })();

    try {
      await this._preloadPromise;
    } finally {
      this._preloadPromise = null;
    }
  }

  async _onUserGesture() {
    if (this._audioUnlocked) return;

    this._audioUnlocked = true;
    this._unbindUnlockEvents();
    await this._resumeAudioContext();

    if (this._preloadRequested) {
      await this._ensurePreloaded();
    }

    this._flushPendingActions();
  }

  _bindUnlockEvents() {
    if (typeof window === 'undefined' || this._audioUnlocked) return;

    const opts = { passive: true };
    window.addEventListener('pointerdown', this._unlockHandler, opts);
    window.addEventListener('keydown', this._unlockHandler, opts);
    window.addEventListener('touchstart', this._unlockHandler, opts);
    window.addEventListener('mousedown', this._unlockHandler, opts);
  }

  _unbindUnlockEvents() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('pointerdown', this._unlockHandler);
    window.removeEventListener('keydown', this._unlockHandler);
    window.removeEventListener('touchstart', this._unlockHandler);
    window.removeEventListener('mousedown', this._unlockHandler);
  }

  _queueAction(action) {
    if (action.kind === 'bgm') {
      this._pendingActions = this._pendingActions.filter((item) => item.kind !== 'bgm');
    }
    this._pendingActions.push(action);
  }

  _flushPendingActions() {
    const pending = this._pendingActions;
    this._pendingActions = [];

    pending.forEach((action) => {
      if (action.kind === 'bgm') {
        if (this._currentBGM === action.key) {
          this._playBGMNow(action.key, action.options);
        }
        return;
      }
      this._playSFXNow(action.key, action.options);
    });
  }

  async _resumeAudioContext() {
    try {
      const ctx = sound.context?.audioContext;
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (_) {}
  }

  _playBGMNow(key, options = {}) {
    const cfg = AUDIO_MANIFEST.bgm[key];

    this._resumeAudioContext();
    try {
      sound.play(key, {
        loop: cfg.loop ?? true,
        volume: (cfg.volume ?? 1.0) * this._bgmVolume,
        singleInstance: true,
        ...options,
      });
    } catch (e) {
      console.warn(`[AudioManager] BGM 재생 실패 (${key}):`, e);
    }
  }

  _playSFXNow(key, options = {}) {
    const cfg = AUDIO_MANIFEST.sfx[key];

    this._resumeAudioContext();
    try {
      sound.play(key, {
        volume: (cfg.volume ?? 1.0) * this._sfxVolume,
        ...options,
      });
    } catch (e) {
      console.warn(`[AudioManager] SFX 재생 실패 (${key}):`, e);
    }
  }

  async _sourceExists(url) {
    if (this._checkedSources.has(url)) {
      return this._checkedSources.get(url);
    }

    const existsPromise = fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
    })
      .then((response) => response.ok)
      .catch(() => false);

    this._checkedSources.set(url, existsPromise);
    return existsPromise;
  }
}
