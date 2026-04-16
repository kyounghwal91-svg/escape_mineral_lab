import * as PIXI from 'pixi.js';

const POP_W = 760;
const POP_H = 640;
const HARDNESS_VAL = { high: 7, medium: 6, low: 3 };
const CALCITE_SCALE = 1.3;
const SCRATCH_TARGET = 85 * CALCITE_SCALE;
const TARGET_RADIUS = 58 * CALCITE_SCALE;
const SCRATCH_OUTER_WIDTH = 4.6 * CALCITE_SCALE;
const SCRATCH_OFFSET = 0.8 * CALCITE_SCALE;
const SCRATCH_SAFE_MARGIN = (SCRATCH_OUTER_WIDTH / 2) + SCRATCH_OFFSET + 4;

export class HardnessComparePopup {
  constructor(app, { mineralA, mineralB, mineralManager, uiManager }) {
    this.app = app;
    this.mineralManager = mineralManager;
    this.uiManager = uiManager;

    this.quartz = mineralA.id === 'quartz' ? mineralA : mineralB;
    this.calcite = mineralA.id === 'calcite' ? mineralA : mineralB;
    this.quartzVal = HARDNESS_VAL[this.quartz?.hardness] ?? 7;
    this.calciteVal = HARDNESS_VAL[this.calcite?.hardness] ?? 3;

    this.container = new PIXI.Container();
    this._onClose = null;
    this._resultShown = false;
    this._scratchProgress = 0;
    this._lastScratchPoint = null;
    this._dragOffset = { x: 0, y: 0 };
    this._quartzSprite = null;
    this._quartzBaseScale = 1;
    this._scratchContainer = null;
    this._resultBadge = null;
    this._quartzHome = null;
    this._targetPos = null;
    this._scratchRadius = TARGET_RADIUS - SCRATCH_SAFE_MARGIN;

    this._build();
  }

  _build() {
    const W = 1280;
    const H = 720;
    const px = (W - POP_W) / 2;
    const py = (H - POP_H) / 2;
    const midX = px + POP_W / 2;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.65);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.container.addChild(overlay);

    const box = new PIXI.Graphics();
    box.lineStyle(2, 0x2e86c1, 0.8);
    box.beginFill(0x1a2332);
    box.drawRoundedRect(0, 0, POP_W, POP_H, 12);
    box.endFill();
    box.position.set(px, py);
    this.container.addChild(box);

    const innerPanel = new PIXI.Graphics();
    innerPanel.beginFill(0xfde8cc, 1);
    innerPanel.drawRoundedRect(0, 0, POP_W - 44, POP_H - 108, 18);
    innerPanel.endFill();
    innerPanel.position.set(px + 22, py + 74);
    this.container.addChild(innerPanel);

    const header = new PIXI.Graphics();
    header.beginFill(0x0d1b2a);
    header.drawRoundedRect(0, 0, POP_W - 2, 62, 11);
    header.endFill();
    header.position.set(px + 1, py + 1);
    this.container.addChild(header);

    const accentLine = new PIXI.Graphics();
    accentLine.lineStyle(3, 0x16a085);
    accentLine.moveTo(px + 10, py + 62);
    accentLine.lineTo(px + POP_W - 10, py + 62);
    this.container.addChild(accentLine);

    const title = new PIXI.Text('굳기 비교 실험', {
      fontFamily: 'Arial',
      fontSize: 19,
      fill: 0x1abc9c,
      fontWeight: 'bold',
    });
    title.position.set(px + 20, py + 18);
    this.container.addChild(title);

    const closeBg = new PIXI.Graphics();
    closeBg.beginFill(0x3d4f60);
    closeBg.drawCircle(0, 0, 16);
    closeBg.endFill();
    const closeX = new PIXI.Text('✕', { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff });
    closeX.anchor.set(0.5);
    const closeBtn = new PIXI.Container();
    closeBtn.addChild(closeBg, closeX);
    closeBtn.position.set(px + POP_W - 26, py + 32);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerover', () => { closeBg.tint = 0xe74c3c; });
    closeBtn.on('pointerout', () => { closeBg.tint = 0xffffff; });
    closeBtn.on('pointerdown', () => this.close());
    this.container.addChild(closeBtn);

    const instr = new PIXI.Text('🪨 오른쪽 석영을 드래그해 가운데 방해석에 문질러보세요', {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0x5d4037,
      fontWeight: 'bold',
      align: 'center',
    });
    instr.anchor.set(0.5, 0);
    instr.position.set(midX, py + 90);
    this.container.addChild(instr);

    const mineralY = py + 262;
    const targetX = midX;
    const quartzX = px + POP_W - 150;
    const spriteSize = 114;
    const calciteSize = spriteSize * CALCITE_SCALE;
    this._targetPos = { x: targetX, y: mineralY };
    this._quartzHome = { x: quartzX, y: mineralY + 6 };

    const targetHalo = new PIXI.Graphics();
    targetHalo.lineStyle(3, 0xffffff, 0.28);
    targetHalo.beginFill(0xffffff, 0.06);
    targetHalo.drawCircle(targetX, mineralY, TARGET_RADIUS + 10);
    targetHalo.endFill();
    this.container.addChild(targetHalo);

    const calciteSprite = PIXI.Sprite.from(`images/${this.calcite.id}.png`);
    calciteSprite.anchor.set(0.5);
    calciteSprite.width = calciteSize;
    calciteSprite.height = calciteSize;
    calciteSprite.position.set(targetX, mineralY);
    this.container.addChild(calciteSprite);

    const calciteTag = new PIXI.Text('긁힘 대상', {
      fontFamily: 'Arial',
      fontSize: 11,
      fill: 0xe74c3c,
      fontWeight: 'bold',
    });
    calciteTag.anchor.set(0.5, 1);
    calciteTag.position.set(targetX, mineralY - (64 * CALCITE_SCALE));
    this.container.addChild(calciteTag);

    const calciteLabel = new PIXI.Text(`${this.calcite.name} (굳기 ${this.calciteVal})`, {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0x3e2723,
      fontWeight: 'bold',
    });
    calciteLabel.anchor.set(0.5, 0);
    calciteLabel.position.set(targetX, mineralY + (64 * CALCITE_SCALE));
    this.container.addChild(calciteLabel);

    const quartzGuide = new PIXI.Graphics();
    quartzGuide.lineStyle(3, 0x16a085, 0.85);
    quartzGuide.moveTo(targetX + 86, mineralY);
    quartzGuide.lineTo(quartzX - 70, mineralY);
    quartzGuide.lineStyle(0);
    quartzGuide.beginFill(0x16a085);
    quartzGuide.drawPolygon([
      targetX + 86, mineralY - 10,
      targetX + 66, mineralY,
      targetX + 86, mineralY + 10,
    ]);
    quartzGuide.endFill();
    this.container.addChild(quartzGuide);

    const guideLabel = new PIXI.Text('문지르기', {
      fontFamily: 'Arial',
      fontSize: 12,
      fill: 0x16a085,
    });
    guideLabel.anchor.set(0.5, 1);
    guideLabel.position.set((targetX + quartzX) / 2, mineralY - 14);
    this.container.addChild(guideLabel);

    const quartzSprite = PIXI.Sprite.from(`images/${this.quartz.id}.png`);
    quartzSprite.anchor.set(0.5);
    quartzSprite.width = spriteSize;
    quartzSprite.height = spriteSize;
    this._quartzBaseScale = quartzSprite.scale.x;
    quartzSprite.position.set(this._quartzHome.x, this._quartzHome.y);
    quartzSprite.eventMode = 'static';
    quartzSprite.cursor = 'pointer';
    this.container.addChild(quartzSprite);
    this._quartzSprite = quartzSprite;

    const quartzTag = new PIXI.Text('드래그', {
      fontFamily: 'Arial',
      fontSize: 11,
      fill: 0x1abc9c,
      fontWeight: 'bold',
    });
    quartzTag.anchor.set(0.5, 1);
    quartzTag.position.set(this._quartzHome.x, this._quartzHome.y - 64);
    this.container.addChild(quartzTag);

    const quartzLabel = new PIXI.Text(`${this.quartz.name} (굳기 ${this.quartzVal})`, {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0x3e2723,
      fontWeight: 'bold',
    });
    quartzLabel.anchor.set(0.5, 0);
    quartzLabel.position.set(this._quartzHome.x, this._quartzHome.y + 64);
    this.container.addChild(quartzLabel);

    const scratchMask = new PIXI.Graphics();
    scratchMask.beginFill(0xffffff);
    scratchMask.drawCircle(targetX, mineralY, this._scratchRadius);
    scratchMask.endFill();
    this.container.addChild(scratchMask);

    this._scratchContainer = new PIXI.Container();
    this._scratchContainer.mask = scratchMask;
    this.container.addChild(this._scratchContainer);

    const resultPanel = new PIXI.Graphics();
    resultPanel.beginFill(0x0d1520, 0.95);
    resultPanel.lineStyle(1, 0x294a66, 0.75);
    resultPanel.drawRoundedRect(0, 0, POP_W - 72, 74, 14);
    resultPanel.endFill();
    resultPanel.position.set(px + 36, py + 442);
    this.container.addChild(resultPanel);

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0x16a085, 0.3);
    divider.moveTo(px + 42, py + 432);
    divider.lineTo(px + POP_W - 42, py + 432);
    this.container.addChild(divider);

    this._resultBadge = new PIXI.Text('석영을 방해석 위로 끌어 문질러보세요.', {
      fontFamily: 'Arial',
      fontSize: 15,
      fill: 0x8ea5b8,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: POP_W - 120,
    });
    this._resultBadge.anchor.set(0.5);
    this._resultBadge.position.set(midX, py + 479);
    this.container.addChild(this._resultBadge);

    this._wireDrag();
  }

  _wireDrag() {
    this._quartzSprite
      .on('pointerdown', this._onDragStart, this)
      .on('pointermove', this._onDragMove, this)
      .on('pointerup', this._onDragEnd, this)
      .on('pointerupoutside', this._onDragEnd, this);
  }

  _onDragStart(event) {
    if (this._resultShown) return;
    const local = event.data.getLocalPosition(this.container);
    this._dragging = true;
    this._dragOffset.x = this._quartzSprite.x - local.x;
    this._dragOffset.y = this._quartzSprite.y - local.y;
    this._quartzSprite.alpha = 0.95;
    this._quartzSprite.scale.set(this._quartzBaseScale * 1.05);
    this._quartzSprite.zIndex = 5;
    this.container.sortChildren();
    this._lastScratchPoint = null;
  }

  _onDragMove(event) {
    if (!this._dragging || this._resultShown) return;

    const local = event.data.getLocalPosition(this.container);
    this._quartzSprite.position.set(local.x + this._dragOffset.x, local.y + this._dragOffset.y);

    const dx = this._quartzSprite.x - this._targetPos.x;
    const dy = this._quartzSprite.y - this._targetPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= TARGET_RADIUS + 10) {
      const point = {
        x: this._quartzSprite.x + dx * 0.18,
        y: this._quartzSprite.y + dy * 0.18,
      };
      this._addScratch(point);
    } else {
      this._lastScratchPoint = null;
    }
  }

  _onDragEnd() {
    if (!this._dragging) return;
    this._dragging = false;
    this._quartzSprite.alpha = 1;
    this._quartzSprite.scale.set(this._quartzBaseScale);
    this._lastScratchPoint = null;

    if (!this._resultShown) {
      this._quartzSprite.position.set(this._quartzHome.x, this._quartzHome.y);
    }
  }

  _addScratch(point) {
    if (this._resultShown) return;

    point = this._clampToScratchArea(point);

    if (!this._lastScratchPoint) {
      this._lastScratchPoint = point;
      return;
    }

    const prev = this._clampToScratchArea(this._lastScratchPoint);
    const segment = Math.hypot(point.x - prev.x, point.y - prev.y);
    if (segment < 6) return;

    const g = new PIXI.Graphics();
    // 밝은 홈이 패인 듯 보이도록 바닥 음영 + 흰색 중심선을 겹친다.
    g.lineStyle(SCRATCH_OUTER_WIDTH, 0x8f8f8f, 0.22);
    g.moveTo(prev.x + SCRATCH_OFFSET, prev.y + SCRATCH_OFFSET);
    g.lineTo(point.x + SCRATCH_OFFSET, point.y + SCRATCH_OFFSET);
    g.lineStyle(2.8 * CALCITE_SCALE, 0xf6f6f2, 0.95);
    g.moveTo(prev.x, prev.y);
    g.lineTo(point.x, point.y);
    g.lineStyle(1.2 * CALCITE_SCALE, 0xffffff, 0.85);
    g.moveTo(prev.x, prev.y);
    g.lineTo(point.x, point.y);
    this._scratchContainer.addChild(g);

    this._scratchProgress += segment;
    this._lastScratchPoint = point;

    if (this._scratchProgress >= SCRATCH_TARGET) {
      this._showResult();
    }
  }

  _clampToScratchArea(point) {
    const dx = point.x - this._targetPos.x;
    const dy = point.y - this._targetPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this._scratchRadius || dist === 0) return point;

    const ratio = this._scratchRadius / dist;
    return {
      x: this._targetPos.x + dx * ratio,
      y: this._targetPos.y + dy * ratio,
    };
  }

  _showResult() {
    if (this._resultShown) return;
    this._resultShown = true;
    this._dragging = false;

    this._quartzSprite.position.set(this._quartzHome.x, this._quartzHome.y);
    this._quartzSprite.alpha = 1;
    this._quartzSprite.scale.set(this._quartzBaseScale);
    this._quartzSprite.eventMode = 'none';

    this._resultBadge.style = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: 15,
      fill: 0x1abc9c,
      fontWeight: 'bold',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: POP_W - 120,
    });
    this._resultBadge.text =
      `${this.quartz.name} (굳기 ${this.quartzVal}) > ${this.calcite.name} (굳기 ${this.calciteVal}) - ${this.calcite.name}에 긁힘 자국이 생겼습니다!`;

    this.mineralManager?.recordExperiment(this.quartz.id, 'hardness', this.quartz.hardness);
    this.mineralManager?.recordExperiment(this.calcite.id, 'hardness', this.calcite.hardness);

    this.uiManager?.showDialogue(
      `굳기 비교 결과: ${this.quartz.name}이 ${this.calcite.name}을 긁었습니다. 도감에 기록됨.`
    );
  }

  onClose(cb) {
    this._onClose = cb;
    return this;
  }

  close() {
    if (this._onClose) this._onClose();
    if (this.container.parent) this.container.parent.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
