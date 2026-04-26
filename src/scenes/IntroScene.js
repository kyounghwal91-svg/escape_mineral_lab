import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { AudioManager } from '../systems/AudioManager.js';

export default class IntroScene extends BaseScene {
  constructor() {
    super();
    this._bg = null;
    this._btn = null;
    this._animateFn = null;
    this._keyCount = 0;
    this._secretContainer = null;
    this._keyHandler = null;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;

    // 0. 에셋 로드
    await PIXI.Assets.load(['images/LabScene.png', 'images/scientist_body.png']);

    // 배경 이미지
    this._bg = PIXI.Sprite.from('images/LabScene.png');
    this._bg.width = W;
    this._bg.height = H;
    this.container.addChild(this._bg);

    // 어두운 오버레이
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.55);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    this.container.addChild(overlay);

    // ─── 과학자 캐릭터 배치 ──────────────────────────────────────
    const scientist = PIXI.Sprite.from('images/scientist_body.png');
    scientist.anchor.set(0.5, 1);
    scientist.position.set(W * 0.75, H - 50); // 우측 하단 배치
    scientist.height = 600;
    scientist.scale.x = scientist.scale.y;
    this.container.addChild(scientist);

    // BGM
    AudioManager.instance.playBGM('intro');

    // 부유 애니메이션 (위아래로 흔들림)
    let tick = 0;
    const animate = (delta) => {
      tick += delta * 0.05;
      scientist.y = (H - 50) + Math.sin(tick) * 15;
    };
    this.sceneManager.app.ticker.add(animate);
    this._animateFn = animate;

    // ─── 타이틀 및 버튼 (좌측 정렬 느낌으로 이동) ─────────────────────
    const title = new PIXI.Text('탈출!\n미치광이 과학자의\n광물 실험실', {
      fontFamily: 'Arial', fontSize: 52, fill: 0xffffff,
      fontWeight: 'bold', align: 'left', lineHeight: 60,
      dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 4
    });
    title.position.set(100, H / 2 - 150);
    this.container.addChild(title);

    const sub = new PIXI.Text('실험실을 조사해 열쇠 광물 3개를 찾아 탈출하세요', {
      fontFamily: 'Arial', fontSize: 18, fill: 0xcccccc, align: 'left'
    });
    sub.position.set(100, H / 2 + 50);
    this.container.addChild(sub);

    // 버튼
    this._btn = this._createButton('게임 시작', 200, H / 2 + 140, 0x6c5ce7, () => {
      this.sceneManager?.changeScene('equipment');
    });
    this.container.addChild(this._btn);

    // 시연용 이스터에그: '1' 5회 이상 연속 입력 시 엔딩 바로가기 버튼 노출
    this._keyCount = 0;
    this._keyHandler = (e) => {
      if (e.key === '1') {
        this._keyCount += 1;
        if (this._keyCount >= 5 && !this._secretContainer) {
          this._showSecretButtons();
        }
      } else {
        this._keyCount = 0;
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  async onExit() {
    AudioManager.instance.stopBGM();
    if (this._animateFn) {
      this.sceneManager.app.ticker.remove(this._animateFn);
    }
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    this._btn?.removeAllListeners();
  }

  _showSecretButtons() {
    const W = 1280, H = 720;
    this._secretContainer = new PIXI.Container();

    const panel = new PIXI.Graphics();
    panel.beginFill(0x000000, 0.75);
    panel.drawRoundedRect(W / 2 - 265, H - 78, 530, 62, 10);
    panel.endFill();
    this._secretContainer.addChild(panel);

    const label = new PIXI.Text('시연 바로가기', {
      fontFamily: 'Arial', fontSize: 13, fill: 0x888888,
    });
    label.anchor.set(0.5, 0);
    label.position.set(W / 2, H - 74);
    this._secretContainer.addChild(label);

    const barelyBtn = this._createSecretButton('겨우 탈출', W / 2 - 135, H - 47, 0x2e86c1, () => {
      this.sceneManager?.changeScene('result', { condition: 'barely' });
    });
    this._secretContainer.addChild(barelyBtn);

    const failBtn = this._createSecretButton('실패', W / 2 + 135, H - 47, 0x922b21, () => {
      this.sceneManager?.changeScene('result', { condition: 'failure' });
    });
    this._secretContainer.addChild(failBtn);

    this.container.addChild(this._secretContainer);
  }

  _createSecretButton(label, x, y, color, onClick) {
    const btn = new PIXI.Container();
    const BW = 230, BH = 42;
    const bg = new PIXI.Graphics();
    bg.beginFill(color);
    bg.drawRoundedRect(-BW / 2, -BH / 2, BW, BH, 10);
    bg.endFill();
    btn.addChild(bg);
    const text = new PIXI.Text(label, { fontFamily: 'Arial', fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
    text.anchor.set(0.5);
    btn.addChild(text);
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => { bg.alpha = 0.8; });
    btn.on('pointerout',  () => { bg.alpha = 1.0; });
    btn.on('pointerdown', () => { AudioManager.instance.playSFX('btn_click'); onClick(); });
    return btn;
  }

  _createButton(label, x, y, color, onClick) {
    const btn = new PIXI.Container();
    const W = 200, H = 50;
    const bg = new PIXI.Graphics();
    bg.beginFill(color);
    bg.drawRoundedRect(-W / 2, -H / 2, W, H, 12);
    bg.endFill();
    btn.addChild(bg);
    const text = new PIXI.Text(label, { fontFamily: 'Arial', fontSize: 22, fill: 0xffffff, fontWeight: 'bold' });
    text.anchor.set(0.5);
    btn.addChild(text);
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => { bg.alpha = 0.8; });
    btn.on('pointerout',  () => { bg.alpha = 1.0; });
    btn.on('pointerdown', () => { AudioManager.instance.playSFX('btn_click'); onClick(); });
    return btn;
  }
}
