import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager.js';
import { StatusManager } from '../systems/StatusManager.js';
import { MineralManager } from '../systems/MineralManager.js';
import { SafetySystem } from '../systems/SafetySystem.js';
import { AudioManager } from '../systems/AudioManager.js';

const TEST_MODE = true;

export class GameApp {
  constructor() {
    this.app = null;
    this.sceneManager = null;
  }

  async init() {
    // PixiJS Application 생성
    this.app = new PIXI.Application({
      width: 1280,
      height: 720,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Canvas를 DOM에 마운트
    const container = document.getElementById('game-container');
    container.appendChild(this.app.view);

    // 반응형 리사이즈
    this._setupResize();

    // 오디오 프리로드
    await AudioManager.instance.preload();

    // SceneManager 초기화
    this.sceneManager = new SceneManager(this.app);

    // PixiJS v7: stage가 전역 pointermove/pointerup을 수신하도록 설정
    // hitArea를 월드 전체로 지정해 빈 영역(광물 없는 곳)에서도 이벤트 소실 방지
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, 1280, 720);

    // 씬 등록 (동적 import로 번들 분할)
    this.sceneManager.register('intro',     () => import('../scenes/IntroScene.js'));
    this.sceneManager.register('equipment', () => import('../scenes/EquipmentScene.js'));
    this.sceneManager.register('lab',       () => import('../scenes/LabScene.js'));
    this.sceneManager.register('result',     () => import('../scenes/ResultScene.js'));
    this.sceneManager.register('experiment', () => import('../scenes/ExperimentScene.js'));
    this.sceneManager.register('door',       () => import('../scenes/DoorScene.js'));

    // 메인 루프 등록
    this.app.ticker.add((delta) => {
      this.sceneManager.update(delta);
    });

    // 첫 씬 시작
    if (TEST_MODE) {
      await this.sceneManager.changeScene('equipment');
    } else {
      await this.sceneManager.changeScene('intro');
    }
  }

  _setupResize() {
    const resize = () => {
      const ratio = 1280 / 720;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = w / h < ratio ? w / 1280 : h / 720;
      this.app.stage.scale.set(scale);
      this.app.renderer.resize(1280 * scale, 720 * scale);
    };
    window.addEventListener('resize', resize);
    resize();
  }
}
