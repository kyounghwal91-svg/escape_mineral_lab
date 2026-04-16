import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { AudioManager } from '../systems/AudioManager.js';

export default class ResultScene extends BaseScene {
  constructor() {
    super();
    this._ticker = null;
    this._blinkTicker = null;
    this._stars = [];
    this._blinkTime = 0;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;

    const condition = data.condition ?? 'failure';
    const statusManager = data.statusManager ?? null;
    const hp = statusManager ? statusManager.hp : 0;
    const timeStr = statusManager ? statusManager.getTimeFormatted() : '00:00';

    // ── 분기별 설정 ──────────────────────────────────────────
    let bgColor, titleText, titleColor, subText, subColor, btnColor;

    if (condition === 'perfect') {
      bgColor    = 0x0a1628;
      titleText  = '완벽한 탈출!';
      titleColor = 0xf1c40f;
      subText    = 'HP 100을 유지한 채 모든 실험을 완료했습니다!';
      subColor   = 0xf9e4a0;
      btnColor   = 0x27ae60;
    } else if (condition === 'barely') {
      bgColor    = 0x0d1b2a;
      titleText  = '겨우 탈출...';
      titleColor = 0x85c1e9;
      subText    = '가까스로 탈출에 성공했지만 부상을 입었습니다.';
      subColor   = 0xaed6f1;
      btnColor   = 0x2e86c1;
    } else {
      bgColor    = 0x1a0000;
      titleText  = '실험 실패...';
      titleColor = 0xe74c3c;
      subText    = hp === 0
        ? 'HP가 모두 소진되어 실험을 계속할 수 없습니다.'
        : '10분의 시간이 모두 지나버렸습니다.';
      subColor   = 0xffffff;
      btnColor   = 0x922b21;
    }

    // ── 배경 ─────────────────────────────────────────────────
    const bg = new PIXI.Graphics();
    bg.beginFill(bgColor);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    this.container.addChild(bg);

    // ── 타이틀 ───────────────────────────────────────────────
    const title = new PIXI.Text(titleText, {
      fontFamily: 'Arial',
      fontSize: 52,
      fill: titleColor,
      fontWeight: 'bold',
      align: 'center',
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, H / 2 - 160);
    this.container.addChild(title);

    // ── 부제 ─────────────────────────────────────────────────
    const sub = new PIXI.Text(subText, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: subColor,
      align: 'center',
    });
    sub.anchor.set(0.5);
    sub.position.set(W / 2, H / 2 - 95);
    this.container.addChild(sub);

    // ── 분기별 추가 요소 ─────────────────────────────────────
    if (condition === 'perfect') {
      this._buildStars();
    } else if (condition === 'barely') {
      this._buildHpBar(hp, W, H);
    }

    // ── 통계 박스 ────────────────────────────────────────────
    this._buildStatsBox(hp, timeStr, W, H);

    // ── 다시 시작 버튼 ───────────────────────────────────────
    const btn = this._createButton('다시 시작', W / 2, H / 2 + 160, btnColor, () => {
      this.sceneManager?.changeScene('intro');
    });
    this.container.addChild(btn);

    // ── 오디오 ──────────────────────────────────────────────────
    AudioManager.instance.playBGM('result');
    AudioManager.instance.playSFX(`result_${condition}`);

    // ── 애니메이션 ticker ────────────────────────────────────
    if (condition === 'perfect' && this._stars.length > 0) {
      this._ticker = (delta) => {
        for (const star of this._stars) {
          star.y += 1.5;
          if (star.y > 750) star.y = -20;
        }
      };
      this.sceneManager?.app?.ticker.add(this._ticker);
    }

    if (condition === 'failure') {
      this._blinkTicker = (delta) => {
        this._blinkTime += delta / 60;
        title.alpha = 0.4 + 0.6 * (Math.sin(this._blinkTime * Math.PI) * 0.5 + 0.5);
      };
      this.sceneManager?.app?.ticker.add(this._blinkTicker);
    }
  }

  async onExit() {
    AudioManager.instance.stopBGM();
    if (this._ticker) {
      this.sceneManager?.app?.ticker.remove(this._ticker);
      this._ticker = null;
    }
    if (this._blinkTicker) {
      this.sceneManager?.app?.ticker.remove(this._blinkTicker);
      this._blinkTicker = null;
    }
    this._stars = [];
  }

  // ── 별 파티클 (perfect) ───────────────────────────────────
  _buildStars() {
    for (let i = 0; i < 10; i++) {
      const star = this._drawStar();
      star.x = Math.random() * 1280;
      star.y = Math.random() * 720 - 20;
      this.container.addChild(star);
      this._stars.push(star);
    }
  }

  _drawStar() {
    const g = new PIXI.Graphics();
    const outerR = 12, innerR = 5, points = 5;
    g.beginFill(0xf1c40f);
    const step = Math.PI / points;
    const verts = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = i * step - Math.PI / 2;
      verts.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.drawPolygon(verts);
    g.endFill();
    return g;
  }

  // ── HP 바 (barely) ───────────────────────────────────────
  _buildHpBar(hp, W, H) {
    const barW = 300, barH = 20;
    const x = W / 2 - barW / 2;
    const y = H / 2 - 55;

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0x333333);
    barBg.drawRoundedRect(x, y, barW, barH, 6);
    barBg.endFill();
    this.container.addChild(barBg);

    const ratio = Math.max(0, Math.min(1, hp / 100));
    const fillColor = hp >= 60 ? 0x2ecc71 : hp >= 30 ? 0xf39c12 : 0xe74c3c;

    const barFill = new PIXI.Graphics();
    barFill.beginFill(fillColor);
    barFill.drawRoundedRect(x, y, barW * ratio, barH, 6);
    barFill.endFill();
    this.container.addChild(barFill);
  }

  // ── 통계 박스 ────────────────────────────────────────────
  _buildStatsBox(hp, timeStr, W, H) {
    const boxW = 360, boxH = 80;
    const bx = W / 2 - boxW / 2;
    const by = H / 2 - 10;

    const boxBg = new PIXI.Graphics();
    boxBg.beginFill(0x000000, 0.5);
    boxBg.drawRoundedRect(bx, by, boxW, boxH, 10);
    boxBg.endFill();
    this.container.addChild(boxBg);

    const line1 = new PIXI.Text(`남은 HP: ${hp} / 100`, {
      fontFamily: 'Arial', fontSize: 20, fill: 0xffffff,
    });
    line1.position.set(bx + 20, by + 12);
    this.container.addChild(line1);

    const line2 = new PIXI.Text(`남은 시간: ${timeStr}`, {
      fontFamily: 'Arial', fontSize: 20, fill: 0xffffff,
    });
    line2.position.set(bx + 20, by + 42);
    this.container.addChild(line2);
  }

  // ── 버튼 ─────────────────────────────────────────────────
  _createButton(label, x, y, color, onClick) {
    const btn = new PIXI.Container();
    const BW = 200, BH = 50;
    const bg = new PIXI.Graphics();
    bg.beginFill(color);
    bg.drawRoundedRect(-BW / 2, -BH / 2, BW, BH, 12);
    bg.endFill();
    btn.addChild(bg);

    const text = new PIXI.Text(label, {
      fontFamily: 'Arial', fontSize: 22, fill: 0xffffff, fontWeight: 'bold',
    });
    text.anchor.set(0.5);
    btn.addChild(text);

    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => { btn.alpha = 0.8; });
    btn.on('pointerout',  () => { btn.alpha = 1.0; });
    btn.on('pointerdown', () => { AudioManager.instance.playSFX('btn_click'); onClick(); });
    this.container.addChild(btn);
    return btn;
  }
}
