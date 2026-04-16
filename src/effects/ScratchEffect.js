import * as PIXI from 'pixi.js';
import { AudioManager } from '../systems/AudioManager.js';

export class ScratchEffect {
  constructor(streakColor, app = null, mineralId = null) {
    this.streakColor = streakColor;
    this.app = app;
    this.mineralId = mineralId;
    this.container = new PIXI.Container();
    this.container.eventMode = 'static';

    this._lines = null;
    this._isDrawing = false;
    this._lastPos = null;
    this._totalDistance = 0;
    this._onDone = null;
    this._done = false;
    this._mineralCont = null;
    this._hint = null;
    this._dragOffset = { x: 0, y: 0 };
    this._onDragMove = null;
    this._onDragUp = null;
    this._scratchSoundDist = 0;

    // 조흔판 영역 (컨테이너 좌표 기준)
    this._plateX = 160;
    this._plateY = 65;
    this._plateW = 310;
    this._plateH = 150;

    this._build();
  }

  _build() {
    const W = 500, H = 280;

    // 배경 트레이 (AcidEffect 스타일)
    const tray = new PIXI.Graphics();
    tray.lineStyle(1, 0x3d5166, 0.5);
    tray.beginFill(0x111926, 0.35);
    tray.drawRoundedRect(0, 0, W, H, 10);
    tray.endFill();
    tray.eventMode = 'none';
    this.container.addChild(tray);

    // 조흔판 (연한 회색)
    const plate = new PIXI.Graphics();
    plate.lineStyle(2, 0xbbbbbb);
    plate.beginFill(0xe4e4e4);
    plate.drawRoundedRect(0, 0, this._plateW, this._plateH, 8);
    plate.endFill();
    plate.position.set(this._plateX, this._plateY);
    plate.eventMode = 'none';
    this.container.addChild(plate);

    // 조흔판 격자 질감
    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0xc8c8c8, 0.4);
    for (let x = this._plateX + 20; x < this._plateX + this._plateW; x += 20) {
      grid.moveTo(x, this._plateY);
      grid.lineTo(x, this._plateY + this._plateH);
    }
    for (let y = this._plateY + 20; y < this._plateY + this._plateH; y += 20) {
      grid.moveTo(this._plateX, y);
      grid.lineTo(this._plateX + this._plateW, y);
    }
    grid.eventMode = 'none';
    this.container.addChild(grid);

    // 조흔선 레이어 + 마스크 (조흔판 영역 밖으로 안 나오게)
    const lineMask = new PIXI.Graphics();
    lineMask.beginFill(0xffffff);
    lineMask.drawRect(this._plateX, this._plateY, this._plateW, this._plateH);
    lineMask.endFill();
    this.container.addChild(lineMask);

    this._lines = new PIXI.Graphics();
    this._lines.mask = lineMask;
    this.container.addChild(this._lines);

    // 안내 텍스트 (조흔판 중앙)
    this._hint = new PIXI.Text('광물을 드래그하여\n조흔판에 긁어보세요', {
      fontFamily: 'Arial', fontSize: 13, fill: 0x888880, align: 'center',
    });
    this._hint.anchor.set(0.5, 0.5);
    this._hint.position.set(this._plateX + this._plateW / 2, this._plateY + this._plateH / 2);
    this.container.addChild(this._hint);

    // 광물 스프라이트 (드래그 가능, 조흔판 왼쪽 시작)
    const mineralCont = new PIXI.Container();
    const sprite = PIXI.Sprite.from(`images/${this.mineralId}.png`);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = 114;
    sprite.scale.y = sprite.scale.x;
    mineralCont.addChild(sprite);

    mineralCont.position.set(75, 140);
    mineralCont.eventMode = 'static';
    mineralCont.cursor = 'grab';
    this.container.addChild(mineralCont);
    this._mineralCont = mineralCont;

    mineralCont.on('pointerdown', (e) => this._startDrag(e));
  }

  _startDrag(e) {
    const local = this.container.toLocal(e.global);
    this._dragOffset = {
      x: local.x - this._mineralCont.x,
      y: local.y - this._mineralCont.y,
    };
    this._mineralCont.cursor = 'grabbing';
    this._lastPos = null;

    this._onDragMove = (ev) => {
      const p = this.container.toLocal(ev.global);
      const cx = p.x - this._dragOffset.x;
      const cy = p.y - this._dragOffset.y;
      this._mineralCont.x = cx;
      this._mineralCont.y = cy;
      this._tryDraw(cx, cy);
    };

    this._onDragUp = () => {
      this.app.stage.off('pointermove', this._onDragMove);
      this.app.stage.off('pointerup', this._onDragUp);
      this.app.stage.off('pointerupoutside', this._onDragUp);
      this._mineralCont.cursor = 'grab';
      this._lastPos = null;
    };

    this.app.stage.on('pointermove', this._onDragMove);
    this.app.stage.once('pointerup', this._onDragUp);
    this.app.stage.once('pointerupoutside', this._onDragUp);
  }

  _tryDraw(cx, cy) {
    const onPlate = cx >= this._plateX && cx <= this._plateX + this._plateW &&
                    cy >= this._plateY && cy <= this._plateY + this._plateH;

    if (!onPlate) {
      this._lastPos = null;
      return;
    }

    if (this._hint && this._hint.visible) {
      this._hint.visible = false;
    }

    if (this._lastPos) {
      this._drawCrayon(this._lastPos.x, this._lastPos.y, cx, cy);

      const dx = cx - this._lastPos.x;
      const dy = cy - this._lastPos.y;
      const segDist = Math.sqrt(dx * dx + dy * dy);
      this._totalDistance += segDist;
      this._scratchSoundDist += segDist;
      if (this._scratchSoundDist >= 15) {
        AudioManager.instance.playSFX('scratch');
        this._scratchSoundDist = 0;
      }

      if (this._totalDistance >= 20 && !this._done) {
        this._done = true;
        if (this._onDone) this._onDone(this.streakColor);
      }
    }
    this._lastPos = { x: cx, y: cy };
  }

  _drawCrayon(x1, y1, x2, y2) {
    if (this.streakColor === 'none') return;

    const lineColor = this.streakColor === 'black' ? 0x222222 : 0xffffff;

    // 크레파스 효과: 여러 겹의 두꺼운 선 + 랜덤 오프셋
    for (let i = 0; i < 5; i++) {
      const ox = (Math.random() - 0.5) * 5;
      const oy = (Math.random() - 0.5) * 5;
      const width = 5 + Math.random() * 5;
      this._lines.lineStyle(width, lineColor, 0.4 + Math.random() * 0.6);
      this._lines.moveTo(x1 + ox, y1 + oy);
      this._lines.lineTo(x2 + ox, y2 + oy);
    }
  }

  onDone(cb) {
    this._onDone = cb;
    return this;
  }

  destroy() {
    if (this._onDragMove) this.app?.stage.off('pointermove', this._onDragMove);
    if (this._onDragUp) {
      this.app?.stage.off('pointerup', this._onDragUp);
      this.app?.stage.off('pointerupoutside', this._onDragUp);
    }
    if (!this.container.destroyed) this.container.destroy({ children: true });
  }
}
