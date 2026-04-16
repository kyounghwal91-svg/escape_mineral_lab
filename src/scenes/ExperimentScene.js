import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { ScratchEffect } from '../effects/ScratchEffect.js';
import { AcidEffect } from '../effects/AcidEffect.js';
import { MagnetEffect } from '../effects/MagnetEffect.js';

/**
 * 시연용 실험 씬 (독립 실행 가능)
 * - UI 구조와 실험 이펙트 확인에 최적화된 형태
 */
export default class ExperimentScene extends BaseScene {
  constructor() {
    super();
    this._currentEffect = null;
    this._uiContainer = null;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;

    // 1. 시연용 깔끔한 배경
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0f172a); // 깊은 다크 블루
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    this.container.addChild(bg);

    // 상단 가이드 바
    const topBar = new PIXI.Graphics();
    topBar.beginFill(0x1e293b, 0.8);
    topBar.drawRect(0, 0, W, 60);
    topBar.endFill();
    this.container.addChild(topBar);

    const title = new PIXI.Text('실험 모듈 시연 레이아웃', {
      fontFamily: 'Arial', fontSize: 20, fill: 0x38bdf8, fontWeight: 'bold'
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, 30);
    this.container.addChild(title);

    // 2. UI 구조 컨테이너 (중앙 배치)
    this._uiContainer = new PIXI.Container();
    this.container.addChild(this._uiContainer);
    this._buildDemoUI(W, H);

    // 기본으로 '조흔색 실험' 먼저 표시
    this._switchExperiment('streak');
  }

  _buildDemoUI(W, H) {
    // 실험 영역 프레임
    const frame = new PIXI.Graphics();
    frame.lineStyle(2, 0x334155);
    frame.beginFill(0x1e293b, 0.5);
    frame.drawRoundedRect(W / 2 - 400, H / 2 - 200, 800, 450, 16);
    frame.endFill();
    this._uiContainer.addChild(frame);

    // 하단 탭 버튼 (실험 종류 전환)
    const types = [
      { id: 'streak', label: '조흔색 실험' },
      { id: 'acid',   label: '염산 반응' },
      { id: 'magnet', label: '자성 테스트' }
    ];

    types.forEach((t, i) => {
      const btn = this._createTabButton(t.label, W / 2 - 220 + (i * 220), H / 2 + 300, () => {
        this._switchExperiment(t.id);
      });
      this.container.addChild(btn);
    });

    // 돌아가기 버튼
    const backBtn = this._createTabButton('뒤로가기', 100, 30, () => {
      this.sceneManager.changeScene('lab');
    }, 0xef4444);
    backBtn.scale.set(0.7);
    this.container.addChild(backBtn);
  }

  _switchExperiment(type) {
    if (this._currentEffect) {
      this._currentEffect.destroy();
      this._uiContainer.removeChild(this._currentEffect.container);
    }

    const W = 1280, H = 720;
    let effect;

    // 시연용 가상 데이터
    if (type === 'streak') {
      effect = new ScratchEffect('black', this.sceneManager.app);
    } else if (type === 'acid') {
      effect = new AcidEffect(this.sceneManager.app, true);
    } else if (type === 'magnet') {
      effect = new MagnetEffect(this.sceneManager.app, true);
    }

    if (effect) {
      // 실험 도구 중앙 배치
      effect.container.position.set(W / 2 - 230, H / 2 - 45);
      this._uiContainer.addChild(effect.container);
      this._currentEffect = effect;
    }
  }

  _createTabButton(label, x, y, onClick, color = 0x0ea5e9) {
    const btn = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.beginFill(color);
    g.drawRoundedRect(-100, -25, 200, 50, 10);
    g.endFill();
    btn.addChild(g);

    const txt = new PIXI.Text(label, { fontFamily: 'Arial', fontSize: 16, fill: 0xffffff, fontWeight: 'bold' });
    txt.anchor.set(0.5);
    btn.addChild(txt);

    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => { btn.alpha = 0.8; });
    btn.on('pointerout',  () => { btn.alpha = 1.0; });
    return btn;
  }

  async onExit() {
    if (this._currentEffect) this._currentEffect.destroy();
  }
}
