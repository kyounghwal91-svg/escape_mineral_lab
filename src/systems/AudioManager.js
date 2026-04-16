import { sound } from '@pixi/sound';
import { AUDIO_MANIFEST } from '../data/audio-manifest.js';

/**
 * AudioManager — 싱글톤
 *
 * 사용법:
 *   AudioManager.instance.playBGM('lab');
 *   AudioManager.instance.playSFX('scratch');
 *   AudioManager.instance.stopBGM();
 */
export class AudioManager {
  /** @type {AudioManager} */
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
    this._currentBGM = null;  // 현재 재생 중인 BGM 키
    this._bgmVolume = 1.0;
    this._sfxVolume = 1.0;
    this._muted = false;
    this._loaded = false;
  }

  /**
   * 매니페스트에 정의된 모든 에셋을 프리로드
   * @returns {Promise<void>}
   */
  async preload() {
    if (this._loaded) return;

    const entries = [
      ...Object.entries(AUDIO_MANIFEST.bgm),
      ...Object.entries(AUDIO_MANIFEST.sfx),
    ];

    const addPromises = entries.map(([key, cfg]) => {
      return new Promise((resolve) => {
        if (sound.exists(key)) {
          resolve();
          return;
        }
        sound.add(key, {
          url: cfg.src,
          loop: cfg.loop ?? false,
          volume: cfg.volume ?? 1.0,
          preload: true,
          loaded: (_err, _s) => resolve(),
        });
      });
    });

    await Promise.all(addPromises);
    this._loaded = true;
  }

  /**
   * BGM 재생 (이전 BGM은 자동으로 중지)
   * @param {string} key  AUDIO_MANIFEST.bgm의 키
   * @param {object} [options]
   */
  playBGM(key, options = {}) {
    if (!AUDIO_MANIFEST.bgm[key]) {
      console.warn(`[AudioManager] 알 수 없는 BGM 키: ${key}`);
      return;
    }
    if (this._currentBGM === key) return;

    this.stopBGM();

    const cfg = AUDIO_MANIFEST.bgm[key];
    this._currentBGM = key;

    if (this._muted) return;

    // 브라우저 Autoplay Policy로 AudioContext가 suspended 상태일 경우 재개
    try {
      const ctx = sound.context?.audioContext;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (_) {}

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

  /** 현재 BGM 중지 */
  stopBGM() {
    if (this._currentBGM) {
      sound.stop(this._currentBGM);
      this._currentBGM = null;
    }
  }

  /** 현재 BGM 일시정지 */
  pauseBGM() {
    if (this._currentBGM) sound.pause(this._currentBGM);
  }

  /** 일시정지된 BGM 재개 */
  resumeBGM() {
    if (this._currentBGM) sound.resume(this._currentBGM);
  }

  /**
   * SFX 1회 재생
   * @param {string} key  AUDIO_MANIFEST.sfx의 키
   * @param {object} [options]
   */
  playSFX(key, options = {}) {
    if (!AUDIO_MANIFEST.sfx[key]) {
      console.warn(`[AudioManager] 알 수 없는 SFX 키: ${key}`);
      return;
    }
    if (this._muted) return;

    const cfg = AUDIO_MANIFEST.sfx[key];
    try {
      sound.play(key, {
        volume: (cfg.volume ?? 1.0) * this._sfxVolume,
        ...options,
      });
    } catch (e) {
      console.warn(`[AudioManager] SFX 재생 실패 (${key}):`, e);
    }
  }

  /**
   * BGM 마스터 볼륨 설정 (0.0 ~ 1.0)
   * @param {number} v
   */
  setBGMVolume(v) {
    this._bgmVolume = Math.max(0, Math.min(1, v));
    if (this._currentBGM) {
      const cfg = AUDIO_MANIFEST.bgm[this._currentBGM];
      sound.volume(this._currentBGM, (cfg.volume ?? 1.0) * this._bgmVolume);
    }
  }

  /**
   * SFX 마스터 볼륨 설정 (0.0 ~ 1.0)
   * @param {number} v
   */
  setSFXVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
  }

  /** 전체 음소거 토글 */
  toggleMute() {
    this._muted = !this._muted;
    sound.volumeAll = this._muted ? 0 : 1;
    return this._muted;
  }

  /** 음소거 여부 */
  get muted() {
    return this._muted;
  }
}
