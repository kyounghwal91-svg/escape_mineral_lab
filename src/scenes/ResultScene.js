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
    this._allowDelayedResultBGM = false;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;
    this._allowDelayedResultBGM = true;

    const condition = data.condition ?? 'failure';
    const statusManager = data.statusManager ?? null;
    const hp = statusManager ? statusManager.hp : 0;
    const timeStr = statusManager ? statusManager.getTimeFormatted() : '00:00';

    // ── 이미지 로드 및 배경 설정 ───────────────────────────
    const bgMap = {
      perfect: 'images/result_sucess.png',
      barely: 'images/result_barely.png',
      failure: 'images/result_failed.png'
    };
    await PIXI.Assets.load(bgMap[condition]);

    const bg = PIXI.Sprite.from(bgMap[condition]);
    bg.width = W;
    bg.height = H;
    this.container.addChild(bg);

    // ── 레이아웃 상수 (왼쪽 배치) ──────────────────────────
    const LEFT_X = 120;
    const TITLE_Y = H / 2 - 160;

    // ── 분기별 설정 ──────────────────────────────────────────
    let titleText, titleColor, subText, subColor, btnColor;

    if (condition === 'perfect') {
      titleText  = '완벽한 탈출!';
      titleColor = 0xf1c40f;
      subText    = 'HP 100을 유지한 채 모든 실험을 완료했습니다!';
      subColor   = 0xf9e4a0;
      btnColor   = 0x27ae60;
    } else if (condition === 'barely') {
      titleText  = '겨우 탈출...';
      titleColor = 0x85c1e9;
      subText    = '가까스로 탈출에 성공했지만 부상을 입었습니다.';
      subColor   = 0xaed6f1;
      btnColor   = 0x2e86c1;
    } else {
      titleText  = '실험 실패...';
      titleColor = 0xe74c3c;
      subText    = hp === 0
        ? 'HP가 모두 소진되어 실험을 계속할 수 없습니다.'
        : '10분의 시간이 모두 지나버렸습니다.';
      subColor   = 0xffffff;
      btnColor   = 0x922b21;
    }

    // ── 타이틀 ───────────────────────────────────────────────
    const title = new PIXI.Text(titleText, {
      fontFamily: 'Arial',
      fontSize: 52,
      fill: titleColor,
      fontWeight: 'bold',
      align: 'left',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 4,
    });
    title.position.set(LEFT_X, TITLE_Y);
    this.container.addChild(title);

    // ── 부제 ─────────────────────────────────────────────────
    const sub = new PIXI.Text(subText, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: subColor,
      align: 'left',
      wordWrap: true,
      wordWrapWidth: 500,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2,
    });
    sub.position.set(LEFT_X, TITLE_Y + 70);
    this.container.addChild(sub);

    // ── 분기별 추가 요소 ─────────────────────────────────────
    if (condition === 'perfect') {
      this._buildStars();
    } else if (condition === 'barely') {
      this._buildHpBar(hp, LEFT_X, TITLE_Y + 120);
    }

    // ── 통계 박스 ────────────────────────────────────────────
    this._buildStatsBox(hp, timeStr, LEFT_X, TITLE_Y + 180);

    // ── 다시 시작 버튼 ───────────────────────────────────────
    const btn = this._createButton('다시 시작', LEFT_X + 100, TITLE_Y + 320, btnColor, () => {
      this.sceneManager?.changeScene('intro');
    });
    this.container.addChild(btn);

    // ── 오디오 ──────────────────────────────────────────────────
    if (condition === 'failure') {
      console.log('[ResultScene] Entered failure ending');
      console.log('[ResultScene] Starting failure SFX: result_failure');
      AudioManager.instance.playSFX('result_failure', {
        complete: () => {
          if (this._allowDelayedResultBGM) {
            console.log('[ResultScene] Starting result BGM after failure SFX: result');
            AudioManager.instance.playBGM('result');
          }
        },
      });
    } else {
      AudioManager.instance.playBGM('result');
      AudioManager.instance.playSFX(`result_${condition}`);
    }

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
    this._allowDelayedResultBGM = false;
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
  _buildHpBar(hp, x, y) {
    const barW = 300, barH = 20;

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
  _buildStatsBox(hp, timeStr, bx, by) {
    const boxW = 360, boxH = 80;

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
