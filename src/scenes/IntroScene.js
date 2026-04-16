import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { AudioManager } from '../systems/AudioManager.js';

export default class IntroScene extends BaseScene {
  constructor() {
    super();
    this._bg = null;
    this._btn = null;
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
  }

  async onExit() {
    AudioManager.instance.stopBGM();
    if (this._animateFn) {
      this.sceneManager.app.ticker.remove(this._animateFn);
    }
    this._btn?.removeAllListeners();
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
