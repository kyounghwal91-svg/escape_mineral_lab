import * as PIXI from 'pixi.js';
import { AudioManager } from '../systems/AudioManager.js';

export class MagnetEffect {
  constructor(app, magnetic, mineralId = null) {
    this.app = app;
    this.magnetic = magnetic;
    this.mineralId = mineralId;
    this.container = new PIXI.Container();
    this.container.eventMode = 'static';

    this._clipObjects = [];
    this._mineralCont = null;
    this._hint = null;
    this._done = false;
    this._resultFired = false;
    this._onDone = null;
    this._dragOffset = { x: 0, y: 0 };
    this._onDragMove = null;
    this._onDragUp = null;
    this._stickTickers = [];
    this._doneTimeout = null;

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
    tray.eventMode = 'none';
    this.container.addChild(tray);

    // 흩어진 클립들 (중앙 영역, 다양한 각도)
    const clipDefs = [
      { x: 210, y: 85,  angle: -35 },
      { x: 290, y: 75,  angle:  20 },
      { x: 360, y: 105, angle: -55 },
      { x: 230, y: 165, angle:  50 },
      { x: 320, y: 175, angle: -15 },
      { x: 268, y: 125, angle:  75 },
      { x: 385, y: 158, angle: -65 },
    ];

    for (const def of clipDefs) {
      const clip = PIXI.Sprite.from('images/paper_clip.png');
      clip.anchor.set(0.5, 0.5);
      clip.width = 73;
      clip.scale.y = clip.scale.x;
      clip.position.set(def.x, def.y);
      clip.rotation = def.angle * (Math.PI / 180);
      clip.eventMode = 'none';
      this.container.addChild(clip);
      this._clipObjects.push({ sprite: clip, stuck: false });
    }

    // 광물 스프라이트 (드래그 가능, 왼쪽 시작)
    const mineralCont = new PIXI.Container();
    const sprite = PIXI.Sprite.from(`images/${this.mineralId}.png`);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = 104;
    sprite.scale.y = sprite.scale.x;
    sprite.zIndex = 0;
    mineralCont.sortableChildren = true;
    mineralCont.addChild(sprite);
    mineralCont.position.set(60, 140);
    mineralCont.eventMode = 'static';
    mineralCont.cursor = 'grab';
    this.container.addChild(mineralCont);
    this._mineralCont = mineralCont;

    mineralCont.on('pointerdown', (e) => this._startDrag(e));

    // 안내 텍스트
    this._hint = new PIXI.Text('광물을 클립 근처로 가져가보세요', {
      fontFamily: 'Arial', fontSize: 13, fill: 0x8ea5b8, align: 'center',
    });
    this._hint.anchor.set(0.5, 0);
    this._hint.position.set(W / 2, H - 30);
    this.container.addChild(this._hint);
  }

  _startDrag(e) {
    const local = this.container.toLocal(e.global);
    this._dragOffset = {
      x: local.x - this._mineralCont.x,
      y: local.y - this._mineralCont.y,
    };
    this._mineralCont.cursor = 'grabbing';

    this._onDragMove = (ev) => {
      const p = this.container.toLocal(ev.global);
      let tx = p.x - this._dragOffset.x;
      let ty = p.y - this._dragOffset.y;

      // Clamp to tray bounds (500x280)
      const margin = 40;
      tx = Math.max(margin, Math.min(500 - margin, tx));
      ty = Math.max(margin, Math.min(280 - margin, ty));

      this._mineralCont.x = tx;
      this._mineralCont.y = ty;
      this._checkProximity();
    };

    this._onDragUp = () => {
      this.app.stage.off('pointermove', this._onDragMove);
      this.app.stage.off('pointerup', this._onDragUp);
      this.app.stage.off('pointerupoutside', this._onDragUp);
      this._mineralCont.cursor = 'grab';
    };

    this.app.stage.on('pointermove', this._onDragMove);
    this.app.stage.once('pointerup', this._onDragUp);
    this.app.stage.once('pointerupoutside', this._onDragUp);
  }

  _checkProximity() {
    if (this._done) return;

    const mx = this._mineralCont.x;
    const my = this._mineralCont.y;
    const threshold = 90;

    if (this.magnetic) {
      for (const clipObj of this._clipObjects) {
        if (clipObj.stuck) continue;
        const dist = Math.hypot(clipObj.sprite.x - mx, clipObj.sprite.y - my);
        if (dist < threshold) {
          clipObj.stuck = true;
          this._animateStick(clipObj);
          if (!this._resultFired) {
            this._resultFired = true;
            AudioManager.instance.playSFX('magnet_attract');
            if (this._hint) this._hint.visible = false;
            this._doneTimeout = setTimeout(() => {
              if (this._onDone) this._onDone(true);
            }, 700);
          }
        }
      }
    } else {
      // 비자성: 가까이 가면 무반응 결과 출력
      const anyNear = this._clipObjects.some(
        c => Math.hypot(c.sprite.x - mx, c.sprite.y - my) < threshold
      );
      if (anyNear) {
        this._done = true;
        AudioManager.instance.playSFX('magnet_none');
        if (this._hint) this._hint.visible = false;
        this._doneTimeout = setTimeout(() => {
          if (this._onDone) this._onDone(false);
        }, 400);
      }
    }
  }

  _animateStick(clipObj) {
    const startX = clipObj.sprite.x;
    const startY = clipObj.sprite.y;
    let frame = 0;
    const duration = 10;

    const tick = () => {
      frame++;
      const t = Math.min(frame / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      // 매 프레임마다 현재 광물 위치를 목표로 추적
      const mx = this._mineralCont.x;
      const my = this._mineralCont.y;
      clipObj.sprite.x = startX + (mx - startX) * eased;
      clipObj.sprite.y = startY + (my - startY) * eased;

      if (t >= 1) {
        this.app.ticker.remove(tick);
        this._stickTickers = this._stickTickers.filter(f => f !== tick);
        // 광물 컨테이너의 자식으로 재부모화 → 드래그 따라다님
        if (!this.container.destroyed) {
          this.container.removeChild(clipObj.sprite);
          // 광물 중앙 근처에 살짝 흩어져서 겹침
          const angle = Math.random() * Math.PI * 2;
          const radius = 10 + Math.random() * 28;
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * radius;
          clipObj.sprite.position.set(offsetX, offsetY);
          clipObj.sprite.zIndex = 10;
          this._mineralCont.sortableChildren = true;
          this._mineralCont.addChild(clipObj.sprite);
          this._mineralCont.sortChildren();
        }
      }
    };
    this._stickTickers.push(tick);
    this.app.ticker.add(tick);
  }

  onDone(cb) {
    this._onDone = cb;
    return this;
  }

  destroy() {
    if (this._onDragMove) this.app.stage.off('pointermove', this._onDragMove);
    if (this._onDragUp) {
      this.app.stage.off('pointerup', this._onDragUp);
      this.app.stage.off('pointerupoutside', this._onDragUp);
    }
    for (const tick of this._stickTickers) this.app.ticker.remove(tick);
    if (this._doneTimeout) clearTimeout(this._doneTimeout);
    if (!this.container.destroyed) this.container.destroy({ children: true });
  }
}
