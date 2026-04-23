import * as PIXI from 'pixi.js';
import { AudioManager } from '../systems/AudioManager.js';

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

    this._build();
  }

  _build() {
    const W = 500;
    const H = 280;

    const tray = new PIXI.Graphics();
    tray.lineStyle(1, 0x3d5166, 0.5);
    tray.beginFill(0x111926, 0.35);
    tray.drawRoundedRect(0, 0, W, H, 10);
    tray.endFill();
    this.container.addChild(tray);

    const petriX = W / 2;
    const petriY = H - 52;
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

    const dropperCont = new PIXI.Container();
    const dropperSprite = PIXI.Sprite.from('images/Hcl_bottle_spoide.png');
    dropperSprite.anchor.set(0.5, 0);
    dropperSprite.height = 150;
    dropperSprite.scale.x = dropperSprite.scale.y;
    dropperCont.addChild(dropperSprite);
    dropperCont.position.set(442, 80);
    dropperCont.eventMode = 'static';
    dropperCont.cursor = 'grab';
    this.container.addChild(dropperCont);

    this._dropperCont = dropperCont;
    this._dropperOrigin = { x: 442, y: 80 };

    dropperCont.on('pointerdown', (e) => this._startDrag(e));

    const bottleBase = PIXI.Sprite.from('images/Hcl_bottle.png');
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

    this._bubbleLayer = new PIXI.Container();
    this.container.addChild(this._bubbleLayer);
  }

  _startDrag(e) {
    if (this._done) return;

    const local = this.container.toLocal(e.global);
    this._dragOffset = {
      x: local.x - this._dropperCont.x,
      y: local.y - this._dropperCont.y,
    };
    this._dropperCont.cursor = 'grabbing';

    this._onDragMove = (ev) => {
      const p = this.container.toLocal(ev.global);
      let tx = p.x - this._dragOffset.x;
      let ty = p.y - this._dragOffset.y;

      // Clamp to tray bounds (500x280)
      const margin = 20;
      tx = Math.max(margin, Math.min(500 - margin, tx));
      ty = Math.max(margin, Math.min(280 - margin, ty));

      this._dropperCont.x = tx;
      this._dropperCont.y = ty;
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
    const tipX = this._dropperCont.x;
    const tipY = this._dropperCont.y + 150;
    const px = this._petriCenter.x;
    const py = this._petriCenter.y;
    const hit = Math.abs(tipX - px) < 90 && tipY > py - 80 && tipY < py + 60;

    if (hit && !this._done) {
      this._done = true;
      this._dropperCont.eventMode = 'none';
      AudioManager.instance.playSFX('acid_drop');
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
    const ox = this._dropperOrigin.x;
    const oy = this._dropperOrigin.y;
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
      if (elapsed % 5 < delta + 0.1) {
        const bubble = new PIXI.Graphics();
        const angle = Math.random() * Math.PI * 2;
        const orbit = 14 + Math.random() * 18;
        const r = 2 + Math.random() * 3;
        bubble.lineStyle(1, 0xbbbbbb, 0.7);
        bubble.beginFill(0xcccccc, 0.45);
        bubble.drawCircle(0, 0, r * 0.7);
        bubble.endFill();
        bubble.x = this._mineralCenter.x + Math.cos(angle) * orbit;
        bubble.y = this._mineralCenter.y + Math.sin(angle) * (orbit * 0.45) + 10;
        bubble.vx = 0;
        bubble.vy = 0;
        bubble.grow = 0.003 + Math.random() * 0.007;
        bubble.life = 1.0;
        this._bubbleLayer.addChild(bubble);
        this._bubbles.push(bubble);
      }
      for (let i = this._bubbles.length - 1; i >= 0; i -= 1) {
        const b = this._bubbles[i];
        b.x += b.vx;
        b.y += b.vy;
        b.scale.x += b.grow;
        b.scale.y += b.grow;
        b.life -= 0.016;
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
    const text = new PIXI.Text('거품 발생!', {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0x85c1e9,
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowDistance: 1,
      dropShadowColor: 0x000000,
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(this._petriCenter.x, this._petriCenter.y - 90);
    this.container.addChild(text);
  }

  _showNoReaction() {
    AudioManager.instance.playSFX('acid_none');
    const text = new PIXI.Text('무반응', {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0x7f8c8d,
      dropShadow: true,
      dropShadowDistance: 1,
      dropShadowColor: 0x000000,
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
