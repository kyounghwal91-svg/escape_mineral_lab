import * as PIXI from 'pixi.js';
import { AudioManager } from '../systems/AudioManager.js';

/**
 * 염산 반응 실험 효과
 * petri_dish + 광물 위에 스포이드(Hcl_bottle_spoide.png)를 드래그&드롭하여 결과 확인
 * Hcl_bottle.png(뒤) + Hcl_bottle_only.png(앞) 은 정적 장식
 */
export class AcidEffect {
  constructor(app, acidReaction, mineralId) {
    this.app = app;
    this.acidReaction = acidReaction;
    this.mineralId = mineralId;
    this.container = new PIXI.Container();
    this.container.eventMode = 'static';

    this._bubbles = [];
    this._ticker = null;
    this._doneTimeout = null;
    this._onDone = null;
    this._done = false;

    this._dropperCont = null;
    this._dropperOrigin = { x: 0, y: 0 };
    this._dragOffset = { x: 0, y: 0 };
    this._onDragMove = null;
    this._onDragUp = null;

    this._petriCenter = { x: 0, y: 0 };
    this._mineralCenter = { x: 0, y: 0 };
    this._bubbleLayer = null;
    this._arrow = null;

    this._build();
  }

  _build() {
    const W = 500, H = 280;

    // 배경 트레이
    const tray = new PIXI.Graphics();
    tray.lineStyle(1, 0x3d5166, 0.5);
    tray.beginFill(0x111926, 0.35);
    tray.drawRoundedRect(0, 0, W, H, 10);
    tray.endFill();
    this.container.addChild(tray);

    // === 왼쪽 장식: hcl_bottle.png (뒤) + Hcl_bottle_only.png (앞) — 인터랙션 없음 ===
    const bottleBase = PIXI.Sprite.from('images/hcl_bottle.png');
    bottleBase.anchor.set(0.5, 1);
    bottleBase.height = 130;
    bottleBase.scale.x = bottleBase.scale.y;
    bottleBase.position.set(440, H - 18);
    bottleBase.eventMode = 'none';
    this.container.addChild(bottleBase);

    const bottleFront = PIXI.Sprite.from('images/Hcl_bottle_only.png');
    bottleFront.anchor.set(0.5, 1);
    bottleFront.height = 130;
    bottleFront.scale.x = bottleFront.scale.y;
    bottleFront.position.set(440, H - 18);
    bottleFront.eventMode = 'none';
    this.container.addChild(bottleFront);

    // === 가운데: petri_dish.png + 광물 ===
    const petriX = W / 2, petriY = H - 52;
    this._petriCenter = { x: petriX, y: petriY };

    const petri = PIXI.Sprite.from('images/petri_dish.png');
    petri.anchor.set(0.5, 0.5);
    petri.width = 150;
    petri.height = 105;
    petri.position.set(petriX, petriY);
    petri.eventMode = 'none';
    this.container.addChild(petri);

    const mineral = PIXI.Sprite.from(`images/${this.mineralId}.png`);
    mineral.anchor.set(0.5, 0.5);
    mineral.width = 88;
    mineral.height = 88;
    mineral.position.set(petriX, petriY - (this.mineralId === 'quartz' ? 23 : 15));
    this._mineralCenter = { x: mineral.x, y: mineral.y };
    mineral.eventMode = 'none';
    this.container.addChild(mineral);

    // 거품 레이어 (petri 위)
    this._bubbleLayer = new PIXI.Container();
    this.container.addChild(this._bubbleLayer);

    // === 드래그 안내 화살표 ===
    const arrow = new PIXI.Text('← 드래그', {
      fontFamily: 'Arial', fontSize: 13, fill: 0xf39c12, fontWeight: 'bold',
      dropShadow: true, dropShadowDistance: 1, dropShadowColor: 0x000000,
    });
    arrow.anchor.set(0.5, 0.5);
    arrow.position.set(330, 60);
    this.container.addChild(arrow);
    this._arrow = arrow;

    // === 오른쪽: Hcl_bottle_spoide.png — 드래그 가능 ===
    const dropperCont = new PIXI.Container();
    const dropperSprite = PIXI.Sprite.from('images/Hcl_bottle_spoide.png');
    dropperSprite.anchor.set(0.5, 0);
    dropperSprite.height = 150;
    dropperSprite.scale.x = dropperSprite.scale.y;
    dropperCont.addChild(dropperSprite);
    dropperCont.position.set(410, 18);
    dropperCont.eventMode = 'static';
    dropperCont.cursor = 'grab';
    this.container.addChild(dropperCont);

    this._dropperCont = dropperCont;
    this._dropperOrigin = { x: 410, y: 18 };

    dropperCont.on('pointerdown', (e) => this._startDrag(e));
  }

  _startDrag(e) {
    if (this._done) return;
    // 드래그 시작 시 container 로컬 좌표 기준 오프셋 계산
    const local = this.container.toLocal(e.global);
    this._dragOffset = {
      x: local.x - this._dropperCont.x,
      y: local.y - this._dropperCont.y,
    };
    this._dropperCont.cursor = 'grabbing';

    this._onDragMove = (ev) => {
      const p = this.container.toLocal(ev.global);
      this._dropperCont.x = p.x - this._dragOffset.x;
      this._dropperCont.y = p.y - this._dragOffset.y;
    };

    this._onDragUp = () => {
      this.app.stage.off('pointermove', this._onDragMove);
      this.app.stage.off('pointerup', this._onDragUp);
      this.app.stage.off('pointerupoutside', this._onDragUp);
      this._dropperCont.cursor = 'grab';
      this._endDrag();
    };

    this.app.stage.on('pointermove', this._onDragMove);
    this.app.stage.once('pointerup', this._onDragUp);
    this.app.stage.once('pointerupoutside', this._onDragUp);
  }

  _endDrag() {
    // 드로퍼 하단 중심이 petri dish 범위 내에 있는지 확인
    const tipX = this._dropperCont.x;
    const tipY = this._dropperCont.y + 150;
    const px = this._petriCenter.x, py = this._petriCenter.y;
    const hit = Math.abs(tipX - px) < 90 && tipY > py - 80 && tipY < py + 60;

    if (hit && !this._done) {
      this._done = true;
      this._dropperCont.eventMode = 'none';
      AudioManager.instance.playSFX('acid_drop');
      if (this._arrow && !this._arrow.destroyed) {
        this.container.removeChild(this._arrow);
        this._arrow = null;
      }
      if (this.acidReaction) {
        this._spawnBubbles();
      } else {
        this._showNoReaction();
        this._doneTimeout = setTimeout(() => {
          if (!this.container.destroyed && this._onDone) this._onDone(false);
        }, 800);
      }
    } else {
      this._snapBack();
    }
  }

  _snapBack() {
    const ox = this._dropperOrigin.x, oy = this._dropperOrigin.y;
    const tick = () => {
      const dx = ox - this._dropperCont.x;
      const dy = oy - this._dropperCont.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        this._dropperCont.position.set(ox, oy);
        this.app.ticker.remove(tick);
      } else {
        this._dropperCont.x += dx * 0.18;
        this._dropperCont.y += dy * 0.18;
      }
    };
    this.app.ticker.add(tick);
  }

  _spawnBubbles() {
    AudioManager.instance.playSFX('acid_bubble');
    let elapsed = 0;
    this._ticker = (delta) => {
      elapsed += delta;
      if (elapsed % 3 < delta + 0.1) {
        const bubble = new PIXI.Graphics();
        const angle = Math.random() * Math.PI * 2;
        const orbit = 18 + Math.random() * 26;
        const r = 3 + Math.random() * 5;
        bubble.lineStyle(1, 0xffffff, 0.95);
        bubble.beginFill(0xffffff, 0.72);
        bubble.drawCircle(0, 0, r);
        bubble.endFill();
        bubble.x = this._mineralCenter.x + Math.cos(angle) * orbit;
        bubble.y = this._mineralCenter.y + Math.sin(angle) * (orbit * 0.45) + 10;
        bubble.vx = (Math.random() - 0.5) * 0.35;
        bubble.vy = -(0.2 + Math.random() * 0.45);
        bubble.grow = 0.008 + Math.random() * 0.014;
        bubble.life = 1.0;
        this._bubbleLayer.addChild(bubble);
        this._bubbles.push(bubble);
      }
      for (let i = this._bubbles.length - 1; i >= 0; i--) {
        const b = this._bubbles[i];
        b.x += b.vx;
        b.y += b.vy;
        b.scale.x += b.grow;
        b.scale.y += b.grow;
        b.life -= 0.028;
        b.alpha = Math.min(1, b.life * 1.1);
        if (b.life <= 0) {
          this._bubbleLayer.removeChild(b);
          this._bubbles.splice(i, 1);
        }
      }
      if (elapsed > 120) {
        this.app.ticker.remove(this._ticker);
        this._ticker = null;
        this._showReactionResult();
        this._doneTimeout = setTimeout(() => {
          if (!this.container.destroyed && this._onDone) this._onDone(true);
        }, 600);
      }
    };
    this.app.ticker.add(this._ticker);
  }

  _showReactionResult() {
    const text = new PIXI.Text('거품 발생! (CO₂)', {
      fontFamily: 'Arial', fontSize: 14, fill: 0x85c1e9, fontWeight: 'bold',
      dropShadow: true, dropShadowDistance: 1, dropShadowColor: 0x000000,
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(this._petriCenter.x, this._petriCenter.y - 90);
    this.container.addChild(text);
  }

  _showNoReaction() {
    AudioManager.instance.playSFX('acid_none');
    const text = new PIXI.Text('반응 없음', {
      fontFamily: 'Arial', fontSize: 14, fill: 0x7f8c8d,
      dropShadow: true, dropShadowDistance: 1, dropShadowColor: 0x000000,
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(this._petriCenter.x, this._petriCenter.y - 90);
    this.container.addChild(text);
  }

  onDone(cb) {
    this._onDone = cb;
    return this;
  }

  destroy() {
    if (this._ticker) this.app.ticker.remove(this._ticker);
    if (this._doneTimeout) clearTimeout(this._doneTimeout);
    if (this._onDragMove) this.app.stage.off('pointermove', this._onDragMove);
    if (this._onDragUp) {
      this.app.stage.off('pointerup', this._onDragUp);
      this.app.stage.off('pointerupoutside', this._onDragUp);
    }
    if (!this.container.destroyed) this.container.destroy({ children: true });
  }
}
