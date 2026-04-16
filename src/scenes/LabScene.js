import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { AudioManager } from '../systems/AudioManager.js';
import { MINERALS } from '../data/minerals.js';
import { getMineralById } from '../data/minerals.js';
import { StatusManager } from '../systems/StatusManager.js';
import { MineralManager } from '../systems/MineralManager.js';
import { UIManager } from '../ui/UIManager.js';
import { SafetySystem } from '../systems/SafetySystem.js';
import { ExperimentPopup } from '../ui/ExperimentPopup.js';
import { HardnessComparePopup } from '../ui/HardnessComparePopup.js';
import { NotePopup } from '../ui/NotePopup.js';

const TABLE_LAYOUT = {
  streak: { x: 360, y: 300 },
  acid: { x: 560, y: 300 },
  magnet: { x: 760, y: 336 },
};

const MINERAL_POSITIONS = [
  { cx: 260, cy: 438 },  // quartz  (석영 — 라벨 하단 기준)
  { cx: 397, cy: 481 },  // feldspar
  { cx: 554, cy: 481 },  // biotite
  { cx: 711, cy: 481 },  // calcite
  { cx: 868, cy: 481 },  // magnetite (x 기존 유지)
];

const LAB_OBJECT_SCALE = 1.3;
const GLOW_THRESHOLD = 91;

export default class LabScene extends BaseScene {
  constructor() {
    super();
    this.statusManager = null;
    this.mineralManager = null;
    this.uiManager = null;
    this.safetySystem = null;

    this._minerals = [];
    this._tools = [];
    this._note = null;
    this._dragging = null;
    this._stageMove = null;
    this._stageUp = null;
    this._popup = null;
    this._noteClicked = false;
    this._logbookCells = {};
    this._gameOverHandler = null;
    this._timerExpiredHandler = null;
    this._pulseHighlightTicker = null;
    this._clueHintCards = [];
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;

    this.container.sortableChildren = true;

    await PIXI.Assets.load([
      'images/lab_bg.png',
      'images/streak_plate.png',
      'images/hcl_bottle.png',
      'images/Hcl_bottle_only.png',
      'images/Hcl_bottle_spoide.png',
      'images/petri_dish.png',
      'images/paper_clip.png',
      'images/lab_note.png',
      'images/exit_door.png'
    ]);

    this.statusManager = data.statusManager ?? new StatusManager();
    this.mineralManager = data.mineralManager ?? new MineralManager();
    if (!data.mineralManager) this.mineralManager.init();
    this.safetySystem = data.safetySystem ?? new SafetySystem();

    this.uiManager = new UIManager(this.sceneManager.app, this.statusManager);
    this.uiManager.init();
    this.uiManager.moveMuteBtn(0, -80); // 힌트 버튼(우하단)과 겹치지 않도록 위로 이동

    // 빌드 순서 및 zIndex 부여
    this._buildBackground(W, H);
    this._buildClueHints(W, H);
    this._buildLabTable(W, H);
    this._buildLogbookPanel(W, H);
    this._buildDoorButton(W, H);
    this._buildHintButton(W, H);
    this._buildEquipmentButton(W, H);
    this._buildNote(W, H);

    const placed = this._buildMinerals(W, H);
    this._buildTools(W, H, placed);
    this.refresh();

    if (this.mineralManager.shouldShowLabIntroDialogue()) {
      this.uiManager.showDialogue(
        '여기가… 실험실인가.\n문이 잠겨 있고… 저 철문이 출구인 것 같아.\n저걸 열려면 \'열쇠 광물\'을 찾아야 한다고 했지…\n실험대 위에 있는 광물과 도구들을 살펴봐야겠다.',
        () => this._pulseHighlight()
      );
      this.mineralManager.markLabIntroDialogueShown();
    }

    this._gameOverHandler = () => this._onGameOver();
    this._timerExpiredHandler = () => this._onGameOver();
    this.statusManager.on('gameOver', this._gameOverHandler);
    this.statusManager.on('timerExpired', this._timerExpiredHandler);
    this.statusManager.startTimer();

    AudioManager.instance.playBGM('lab');
  }

  // ─── 상단 단서 힌트 카드 3개 ─────────────────────────────────────
  _buildClueHints(W, H) {
    const CARD_W = 185, CARD_H = 69, GAP = 8;
    const totalW = CARD_W * 3 + GAP * 2;
    const startX = Math.round((W - totalW) / 2) - 40; // 타이머(우상단) 피해 좌측 보정
    const startY = 10;

    this._clueHintCards = [];

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (CARD_W + GAP);
      const card = new PIXI.Container();
      card.position.set(x, startY);
      card.zIndex = 20;

      // 카드 배경 (잠금 상태)
      const bg = new PIXI.Graphics();
      this._drawClueCard(bg, false);
      card.addChild(bg);

      // 번호 뱃지
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(0x1a3a5c, 0.9);
      badgeBg.drawCircle(0, 0, 9);
      badgeBg.endFill();
      badgeBg.position.set(13, 13);
      card.addChild(badgeBg);

      const badgeTxt = new PIXI.Text(`${i + 1}`, {
        fontFamily: 'Arial', fontSize: 9, fill: 0xaaccee, fontWeight: 'bold',
      });
      badgeTxt.anchor.set(0.5, 0.5);
      badgeTxt.position.set(13, 13);
      card.addChild(badgeTxt);

      // 잠금 아이콘
      const lockTxt = new PIXI.Text('🔒 실험 후 해금', {
        fontFamily: 'Arial', fontSize: 11, fill: 0x3a5a7a,
      });
      lockTxt.anchor.set(0.5, 0.5);
      lockTxt.position.set(CARD_W / 2 + 6, CARD_H / 2);
      card.addChild(lockTxt);

      // 단서 텍스트 (해금 후 표시)
      const clueTxt = new PIXI.Text('', {
        fontFamily: 'Arial', fontSize: 13, fill: 0xb8deff,
        wordWrap: true, wordWrapWidth: CARD_W - 28, lineHeight: 19,
      });
      clueTxt.position.set(26, 8);
      clueTxt.visible = false;
      clueTxt.alpha = 0;
      card.addChild(clueTxt);

      this.container.addChild(card);
      this._clueHintCards.push({ card, bg, badgeBg, lockTxt, clueTxt });
    }

    // 이미 해금된 단서 즉시 반영 (씬 재진입 시)
    this._refreshClueHints(false);
  }

  _drawClueCard(bg, unlocked) {
    bg.clear();
    if (unlocked) {
      bg.beginFill(0x0a2218, 0.92);
      bg.lineStyle(1.5, 0x27ae60, 0.85);
    } else {
      bg.beginFill(0x08111e, 0.88);
      bg.lineStyle(1, 0x1e3a52, 0.7);
    }
    bg.drawRoundedRect(0, 0, 185, 69, 6);
    bg.endFill();
  }

  _refreshClueHints(animate = true) {
    if (!this._clueHintCards.length) return;
    const clues = this.mineralManager?.unlockedClues ?? [];

    clues.forEach((clue, i) => {
      if (i >= 3) return;
      const card = this._clueHintCards[i];
      if (card.clueTxt.visible) return; // 이미 해금됨

      // 카드 스타일 전환
      this._drawClueCard(card.bg, true);

      // 뱃지 색상 변경
      card.badgeBg.clear();
      card.badgeBg.beginFill(0x27ae60, 0.9);
      card.badgeBg.drawCircle(0, 0, 9);
      card.badgeBg.endFill();

      // 잠금 아이콘 숨기고 텍스트 표시
      card.lockTxt.visible = false;
      card.clueTxt.text = clue.text;
      card.clueTxt.visible = true;

      if (animate) {
        card.clueTxt.alpha = 0;
        const tick = (delta) => {
          card.clueTxt.alpha = Math.min(card.clueTxt.alpha + 0.04 * delta, 1);
          if (card.clueTxt.alpha >= 1) this.sceneManager.app.ticker.remove(tick);
        };
        this.sceneManager.app.ticker.add(tick);
      } else {
        card.clueTxt.alpha = 1;
      }
    });
  }

  _buildBackground(W, H) {
    const bg = PIXI.Sprite.from('images/lab_bg.png');
    bg.width = W; bg.height = H;
    bg.zIndex = 0;
    this.container.addChild(bg);

    const bottomBar = new PIXI.Graphics();
    bottomBar.clear(); bottomBar.beginFill(0x050a12, 0.85);
    bottomBar.drawRect(0, H - 65, W, 65); bottomBar.endFill();
    bottomBar.zIndex = 2;
    this.container.addChild(bottomBar);
  }

  _buildLabTable(W, H) {
    const hint = new PIXI.Text('광물을 도구에 드래그하여 실험을 시작하세요', {
      fontFamily: 'Arial', fontSize: 17, fill: 0xcfe8f6, fontWeight: 'bold',
      dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(W / 2, 570);
    hint.zIndex = 5;
    this.container.addChild(hint);
  }

  _buildLogbookPanel(W, H) {
    const PX = 936, PY = 86, PW = 320, PH = 420;
    const panel = new PIXI.Container();
    panel.position.set(PX, PY);
    panel.zIndex = 10;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x08111a, 0.95); bg.lineStyle(1, 0x315f82, 0.9);
    bg.drawRoundedRect(0, 0, PW, PH, 16); bg.endFill();
    panel.addChild(bg);

    const headerBg = new PIXI.Graphics();
    headerBg.beginFill(0x0d1b2a, 0.95);
    headerBg.drawRoundedRect(0, 0, PW, 48, 16);
    headerBg.drawRect(0, 24, PW, 24);
    headerBg.endFill();
    panel.addChild(headerBg);

    const hdrTxt = new PIXI.Text('실험 도감', { fontFamily: 'Arial', fontSize: 16, fill: 0x9dd8ff, fontWeight: 'bold' });
    hdrTxt.position.set(16, 12);
    panel.addChild(hdrTxt);

    const hdrSub = new PIXI.Text('진행한 실험 결과가 자동 기록됩니다', {
      fontFamily: 'Arial', fontSize: 10, fill: 0x5d88a9,
    });
    hdrSub.position.set(16, 30);
    panel.addChild(hdrSub);

    const COLS = [
      { key: 'name',     w: 74, label: '광물' },
      { key: 'color',    w: 42, label: '색' },
      { key: 'streak',   w: 44, label: '조흔' },
      { key: 'acid',     w: 50, label: '염산' },
      { key: 'magnet',   w: 40, label: '자성' },
      { key: 'hardness', w: 46, label: '긁힘' },
    ];
    const NO_HARDNESS = ['feldspar', 'biotite', 'magnetite'];
    const ROW_H = 62;
    const HDR_H = 28;
    const TX = 10;
    const TY = 58;
    const tableW = COLS.reduce((sum, col) => sum + col.w, 0);

    const headerRow = new PIXI.Graphics();
    headerRow.beginFill(0x0f2234, 0.95);
    headerRow.drawRoundedRect(TX, TY, tableW, HDR_H, 10);
    headerRow.endFill();
    panel.addChild(headerRow);

    let colX = TX;
    COLS.forEach((col) => {
      const colTxt = new PIXI.Text(col.label, {
        fontFamily: 'Arial', fontSize: 10, fill: 0x78b8de, fontWeight: 'bold',
      });
      colTxt.anchor.set(0.5, 0.5);
      colTxt.position.set(colX + col.w / 2, TY + HDR_H / 2);
      panel.addChild(colTxt);
      colX += col.w;
    });

    MINERALS.forEach((mineral, ri) => {
      const rowY = TY + HDR_H + 8 + ri * ROW_H;
      const rowCenterY = rowY + (ROW_H - 6) / 2;
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(ri % 2 === 0 ? 0x102231 : 0x0c1b28, 0.92);
      rowBg.drawRoundedRect(TX, rowY, tableW, ROW_H - 6, 12);
      rowBg.endFill();
      panel.addChild(rowBg);

      const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
      sprite.anchor.set(0.5); sprite.width = 24; sprite.height = 24;
      sprite.position.set(TX + 16, rowCenterY);
      panel.addChild(sprite);

      const nmTxt = new PIXI.Text(mineral.name, { fontFamily: 'Arial', fontSize: 11, fill: 0xddeeff, fontWeight: 'bold' });
      nmTxt.anchor.set(0, 0.5); nmTxt.position.set(TX + 32, rowCenterY);
      panel.addChild(nmTxt);

      let cellX = TX + COLS[0].w;
      COLS.slice(1).forEach((col) => {
        const isHardnessX = col.key === 'hardness' && NO_HARDNESS.includes(mineral.id);
        const initText  = isHardnessX ? '해당없음' : '?';
        const initColor = isHardnessX ? 0x4a6580 : 0x2e4057;
        const cell = new PIXI.Text(initText, { fontFamily: 'Arial', fontSize: 9, fill: initColor });
        cell.anchor.set(0.5, 0.5);
        cell.position.set(cellX + col.w / 2, rowY + 28);
        panel.addChild(cell);
        this._logbookCells[`${mineral.id}_${col.key}`] = cell;
        cellX += col.w;
      });
    });

    this.container.addChild(panel);
  }

  _buildDoorButton(W, H) {
    const btn = new PIXI.Container();
    btn.position.set(60, 20);
    btn.zIndex = 10;

    // 글로우 효과용 그래픽
    this._doorGlow = new PIXI.Graphics();
    this._doorGlow.beginFill(0xffcc00, 0.4);
    this._doorGlow.drawRoundedRect(-20, -20, 260, 145, 32);
    this._doorGlow.endFill();
    this._doorGlow.filters = [new PIXI.BlurFilter(12)];
    btn.addChild(this._doorGlow);
    this._glowTime = 0;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0); // 투명하게 설정
    bg.drawRoundedRect(0, 0, 220, 105, 12);
    bg.endFill();
    btn.addChild(bg);

    const txt = new PIXI.Text('', {
      fontFamily: 'Arial', fontSize: 48, fill: 0xffffff, fontWeight: 'bold'
    });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(165, 60);
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => this._tryDoor());
    this.container.addChild(btn);
  }

  _buildHintButton(W, H) {
    const btn = new PIXI.Container();
    btn.position.set(1156, H - 46);
    btn.zIndex = 10;
    const bg = new PIXI.Graphics();
    bg.beginFill(0x935116); bg.drawRoundedRect(0, 0, 100, 34, 8); bg.endFill();
    btn.addChild(bg);
    const txt = new PIXI.Text('💡 힌트', { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff });
    txt.anchor.set(0.5, 0.5); txt.position.set(50, 17); btn.addChild(txt);
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => this._showRevealedHints());
    this.container.addChild(btn);
  }

  _buildEquipmentButton(W, H) {
    const allWorn = ['goggles', 'gloves', 'coat'].every(id => this.safetySystem.isWearing(id));
    if (allWorn) return;

    const btn = new PIXI.Container();
    btn.position.set(W / 2 - 110, H - 50);
    btn.zIndex = 10;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x6c3483);
    bg.lineStyle(1, 0xc39bd3, 0.8);
    bg.drawRoundedRect(0, 0, 220, 34, 8);
    bg.endFill();
    btn.addChild(bg);

    const txt = new PIXI.Text('← 안전 장비 착용하기', { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, fontWeight: 'bold' });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(110, 17);
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => { bg.tint = 0xbb8fce; });
    btn.on('pointerout', () => { bg.tint = 0xffffff; });
    btn.on('pointerdown', () => {
      this.sceneManager.changeScene('equipment', {
        statusManager: this.statusManager,
        mineralManager: this.mineralManager,
        safetySystem: this.safetySystem
      });
    });
    this.container.addChild(btn);
  }

  _buildNote(W, H) {
    const cont = new PIXI.Container();
    cont.position.set(500, 380);
    cont.zIndex = 10;
    const sprite = PIXI.Sprite.from('images/lab_note.png');
    sprite.anchor.set(0.5); sprite.width = 70 * LAB_OBJECT_SCALE; sprite.scale.y = sprite.scale.x;
    cont.addChild(sprite);
    cont.eventMode = 'static'; cont.cursor = 'pointer';
    cont.on('pointerdown', () => this._showNote());
    this.container.addChild(cont);
  }

  _buildMinerals(W, H) {
    const placed = [];
    MINERALS.forEach((mineral, i) => {
      const { cx, cy } = MINERAL_POSITIONS[i];
      placed.push({ x: cx, y: cy });
      const obj = this._createMineralSprite(mineral, cx, cy);
      this._minerals.push(obj);
      this.container.addChild(obj.container);
      this._makeDraggable(obj, 'mineral');
    });
    return placed;
  }

  _createMineralSprite(mineral, cx, cy) {
    const isQuartz = mineral.id === 'quartz';
    const spriteSize = 90 * LAB_OBJECT_SCALE;
    const halfWidth = spriteSize / 2;
    const spriteCenterY = 46 * LAB_OBJECT_SCALE;
    const labelY = (isQuartz ? 97 : 79) * LAB_OBJECT_SCALE;
    const containerOffsetY = 55 * LAB_OBJECT_SCALE;
    const cont = new PIXI.Container();
    cont.position.set(cx - halfWidth, cy - containerOffsetY);
    cont.zIndex = 20;
    const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
    sprite.anchor.set(0.5); sprite.position.set(halfWidth, spriteCenterY);
    sprite.width = spriteSize; sprite.height = spriteSize;
    cont.addChild(sprite);

    const name = new PIXI.Text(mineral.name, { fontFamily: 'Arial', fontSize: 13, fill: 0xffffff, fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1 });
    name.anchor.set(0.5, 0); name.position.set(halfWidth, labelY);
    cont.addChild(name);

    const glow = PIXI.Sprite.from(`images/${mineral.id}.png`);
    glow.anchor.set(0.5);
    glow.position.set(halfWidth, spriteCenterY);
    glow.width = spriteSize * 1.2;
    glow.height = spriteSize * 1.2;
    glow.tint = 0xffffff;
    glow.filters = [new PIXI.BlurFilter(10)];
    glow.alpha = 0;
    cont.addChildAt(glow, 0);

    return {
      container: cont,
      id: mineral.id,
      originalX: cx - halfWidth,
      originalY: cy - containerOffsetY,
      glow,
      hitOffsetX: halfWidth,
      hitOffsetY: spriteCenterY,
      hitRadius: spriteSize * 0.4,
    };
  }

  _buildTools(W, H, placed) {
    const toolDefs = [
      { type: 'streak', img: 'streak_plate.png' }, { type: 'acid', img: 'hcl_bottle.png' },
      { type: 'magnet', img: 'paper_clip.png' }
    ];
    toolDefs.forEach((td) => {
      const layout = TABLE_LAYOUT[td.type];
      const tx = layout.x;
      const ty = layout.y;
      const cont = new PIXI.Container();
      cont.position.set(tx, ty); cont.zIndex = 20;
      const sprite = PIXI.Sprite.from(`images/${td.img}`);
      sprite.anchor.set(0.5);
      const targetSize = 90 * LAB_OBJECT_SCALE;
      const scale = Math.min(targetSize / sprite.texture.width, targetSize / sprite.texture.height);
      sprite.scale.set(scale);
      cont.addChild(sprite);

      const label = new PIXI.Text(
        td.type === 'streak' ? '조흔판' :
          td.type === 'acid' ? '염산' :
            td.type === 'magnet' ? '클립' : '굳기 비교',
        { fontFamily: 'Arial', fontSize: 11, fill: 0xffffff, fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1 }
      );
      label.anchor.set(0.5, 0);
      label.position.set(0, (td.type === 'magnet' ? 30 : 46) * LAB_OBJECT_SCALE);
      cont.addChild(label);

      const toolGlow = PIXI.Sprite.from(`images/${td.img}`);
      toolGlow.anchor.set(0.5);
      toolGlow.scale.set(scale * 1.2);
      const whitenCM = new PIXI.ColorMatrixFilter();
      whitenCM.matrix = [0,0,0,0,1, 0,0,0,0,1, 0,0,0,0,1, 0,0,0,1,0];
      toolGlow.filters = [whitenCM, new PIXI.BlurFilter(10)];
      toolGlow.alpha = 0;
      cont.addChildAt(toolGlow, 0);

      this.container.addChild(cont);
      const toolObj = {
        container: cont,
        type: td.type,
        originalX: tx,
        originalY: ty,
        glow: toolGlow,
        hitOffsetX: 0,
        hitOffsetY: 0,
        hitRadius: targetSize * (td.type === 'magnet' ? 0.34 : 0.42),
      };
      this._tools.push(toolObj);
      this._makeDraggable(toolObj, 'tool');
    });
  }

  _randomPos(placed, minX, maxX, minY, maxY, minDist) {
    for (let i = 0; i < 100; i++) {
      const x = minX + Math.random() * (maxX - minX), y = minY + Math.random() * (maxY - minY);
      if (!placed.some(p => Math.hypot(p.x - x, p.y - y) < minDist)) return { cx: x, cy: y };
    }
    return { cx: minX + Math.random() * (maxX - minX), cy: minY + Math.random() * (maxY - minY) };
  }

  _makeDraggable(obj, objType) {
    obj.container.eventMode = 'static'; obj.container.cursor = 'grab';
    let _startX = 0, _startY = 0, _didMove = false;
    obj.container.on('pointerdown', (e) => {
      if (this._dragging || this._popup) return;
      if (objType === 'mineral') AudioManager.instance.playSFX('mineral_pickup');
      this._dragging = { obj, objType };
      // PixiJS v7 API: ev.getLocalPosition() (ev.data는 하위호환용)
      const pos = e.getLocalPosition(this.container);
      _startX = pos.x; _startY = pos.y; _didMove = false;
      this._dragging.offX = pos.x - obj.container.x;
      this._dragging.offY = pos.y - obj.container.y;
      this.container.addChild(obj.container);

      this._stageMove = (ev) => {
        if (!this._dragging) return;
        const p = ev.getLocalPosition(this.container);
        obj.container.x = p.x - this._dragging.offX;
        obj.container.y = p.y - this._dragging.offY;
        if (Math.hypot(p.x - _startX, p.y - _startY) > 6) _didMove = true;
        this._updateGlows(this._dragging.obj, this._dragging.objType);
      };

      this._stageUp = () => {
        if (!this._dragging) return;
        const d = this._dragging; this._dragging = null;
        this.sceneManager.app.stage.off('pointermove', this._stageMove);
        this.sceneManager.app.stage.off('pointerup', this._stageUp);
        // 모바일: 캔버스 밖에서 손을 떼도 드롭 처리되도록 window 리스너도 제거
        window.removeEventListener('pointerup', this._stageUp);
        this._clearAllGlows();
        if (!_didMove && objType === 'mineral') {
          this.mineralManager.revealColor(obj.id);
          this.refresh();
        }
        if (objType === 'mineral') AudioManager.instance.playSFX('mineral_drop');
        this._onDrop(d);
      };

      this.sceneManager.app.stage.on('pointermove', this._stageMove);
      this.sceneManager.app.stage.on('pointerup', this._stageUp);
      // 모바일에서 손가락이 캔버스 영역 밖으로 나갈 경우 window에서 fallback 처리
      window.addEventListener('pointerup', this._stageUp, { once: true });
    });
  }

  _updateGlows(draggedObj, draggedType) {
    if (draggedType === 'mineral') {
      this._tools.forEach(tool => {
        if (tool.glow) tool.glow.alpha = this._isWithinGlowRange(draggedObj, tool) ? 1.0 : 0;
      });

      // 석영↔방해석 굳기 비교 글로우
      const PAIR = ['quartz', 'calcite'];
      if (PAIR.includes(draggedObj.id)) {
        const partnerId = draggedObj.id === 'quartz' ? 'calcite' : 'quartz';
        const partner = this._minerals.find(m => m.id === partnerId);
        if (partner) {
          if (partner.glow) partner.glow.alpha = this._isWithinGlowRange(draggedObj, partner) ? 1.0 : 0;
        }
      }
    } else {
      this._minerals.forEach(mineral => {
        if (mineral.glow) mineral.glow.alpha = this._isWithinGlowRange(draggedObj, mineral) ? 1.0 : 0;
      });
    }
  }

  _clearAllGlows() {
    [...this._minerals, ...this._tools].forEach(obj => {
      if (obj.glow) obj.glow.alpha = 0;
    });
  }

  _onDrop(dragInfo) {
    const { obj, objType } = dragInfo;
    if (objType === 'mineral') {
      const hitTool = this._findGlowTarget(obj, this._tools);
      if (hitTool) { this._snapBack(obj); this._showExperiment(obj.id, hitTool.type); return; }
      const otherMinerals = this._minerals.filter(m => m.id !== obj.id);
      const hitMineral = this._findGlowTarget(obj, otherMinerals);
      if (hitMineral) {
        const pair = new Set([obj.id, hitMineral.id]);
        if (pair.has('quartz') && pair.has('calcite')) { this._snapBack(obj); this._showHardnessCompare(obj.id, hitMineral.id); return; }
      }
    } else {
      const hitMineral = this._findGlowTarget(obj, this._minerals);
      if (hitMineral) { this._snapBack(obj); this._showExperiment(hitMineral.id, obj.type); return; }
    }
    this._snapBack(obj);
  }

  _findGlowTarget(obj, targets) {
    for (const target of targets) {
      if (this._isWithinGlowRange(obj, target)) return target;
    }
    return null;
  }

  _isWithinGlowRange(obj, target) {
    const x1 = obj.container.x + (obj.hitOffsetX ?? 0);
    const y1 = obj.container.y + (obj.hitOffsetY ?? 0);
    const x2 = target.container.x + (target.hitOffsetX ?? 0);
    const y2 = target.container.y + (target.hitOffsetY ?? 0);
    return Math.hypot(x1 - x2, y1 - y2) < GLOW_THRESHOLD;
  }

  _snapBack(obj) {
    const sx = obj.container.x, sy = obj.container.y, tx = obj.originalX, ty = obj.originalY;
    let t = 0;
    const tick = (delta) => {
      t += 0.15 * delta;
      if (t >= 1) { obj.container.position.set(tx, ty); this.sceneManager.app.ticker.remove(tick); }
      else { obj.container.x = sx + (tx - sx) * t; obj.container.y = sy + (ty - sy) * t; }
    };
    this.sceneManager.app.ticker.add(tick);
  }

  _showExperiment(mineralId, type) {
    if (this._popup) return;
    AudioManager.instance.playSFX('popup_open');
    this._maybeShowDoorHintDialogue();
    const mineral = getMineralById(mineralId);
    const popup = new ExperimentPopup(this.sceneManager.app, {
      mineral, experimentType: type, statusManager: this.statusManager, mineralManager: this.mineralManager,
      safetySystem: this.safetySystem, uiManager: this.uiManager
    });
    popup.onClose(() => { AudioManager.instance.playSFX('popup_close'); this._popup = null; this.refresh(); });
    popup.onDone(() => {
      this.refresh();
      // After each experiment, check if new clues are now unlocked and notify the player.
      const newClues = this.mineralManager.tryUnlockClues();
      this._refreshClueHints();
      if (newClues.length > 0) {
        this.uiManager.showDialogue(`🔍 새 단서 발견: "${newClues[0].text}"`);
      }
    });
    this._mountPopup(popup);
  }

  _showHardnessCompare(idA, idB) {
    if (this._popup) return;
    AudioManager.instance.playSFX('popup_open');
    this._maybeShowDoorHintDialogue();
    const mineralA = getMineralById(idA), mineralB = getMineralById(idB);
    const popup = new HardnessComparePopup(this.sceneManager.app, {
      mineralA, mineralB, mineralManager: this.mineralManager, uiManager: this.uiManager
    });
    popup.onClose(() => {
      AudioManager.instance.playSFX('popup_close');
      this._popup = null;
      this.refresh();
      // Hardness comparison also counts as experimentation — check for new clues.
      const newClues = this.mineralManager.tryUnlockClues();
      this._refreshClueHints();
      if (newClues.length > 0) {
        this.uiManager.showDialogue(`🔍 새 단서 발견: "${newClues[0].text}"`);
      }
    });
    this._mountPopup(popup);
  }

  _showNote() {
    if (this._popup) return;
    AudioManager.instance.playSFX('popup_open');
    // Show the first unlocked clue from experiment progress, or a starter prompt.
    const clues = this.mineralManager.unlockedClues;
    let text;
    if (clues.length > 0) {
      text = {
        clue: `"${clues[0].text}"`,
        footer: '힌트 버튼에서 발견된 모든 단서를 확인할 수 있습니다.',
      };
    } else {
      text = {
        clue: '"광물을 실험 도구에 드래그하여 실험을 진행해보세요."',
        footer: '실험을 충분히 진행하면 열쇠 광물에 대한 단서가 나타납니다.',
      };
    }
    const pop = new NotePopup(this.sceneManager.app, text, '실험실 쪽지');
    pop.onClose(() => { AudioManager.instance.playSFX('popup_close'); this._popup = null; });
    this._mountPopup(pop);
  }

  _tryDoor() {
    this.mineralManager.markDoorVisited();
    this.sceneManager.changeScene('door', {
      statusManager: this.statusManager, mineralManager: this.mineralManager, safetySystem: this.safetySystem
    });
  }

  _maybeShowDoorHintDialogue() {
    if (this.mineralManager.registerExperimentAttempt()) {
      this.uiManager.showDialogue('탈출구에 가서 힌트를 확인해 볼까?');
    }
  }

  _showRevealedHints() {
    if (this._popup) return;
    AudioManager.instance.playSFX('popup_open');
    // Show experiment-unlocked clues (replaces the old revealedHints system).
    const clues = this.mineralManager.unlockedClues;
    const text = clues.length > 0
      ? clues.map((c, i) => `${i + 1}. ${c.text}`).join('\n\n')
      : '아직 발견된 단서가 없습니다.\n더 많은 실험을 진행해보세요.';
    const pop = new NotePopup(this.sceneManager.app, text, `발견된 단서 목록 (${clues.length}개)`);
    pop.onClose(() => { AudioManager.instance.playSFX('popup_close'); this._popup = null; });
    this._mountPopup(pop);
  }

  _mountPopup(popup) {
    popup.container.zIndex = 1000;
    this._popup = popup;
    this.container.addChild(popup.container);
    this.container.sortChildren();
  }

  refresh() {
    const records = this.mineralManager.getAllRecords();
    const NO_HARDNESS = ['feldspar', 'biotite', 'magnetite'];
    const map = {
      color: (r, mid) => {
        const mineral = this.mineralManager.getMineral(mid);
        return { text: mineral?.colorLabel ?? '?', color: 0x9dd8ff };
      },
      streak: (r) => r.streakTested
        ? { text: (({ none: '없음', white: '흰색', black: '검정' })[r.streakColor] || r.streakColor), color: 0x73e2a7 }
        : { text: '?', color: 0x2e4057 },
      acid: (r) => r.acidTested
        ? { text: (r.acidReacted ? '거품✓' : '무반응'), color: r.acidReacted ? 0xf3b562 : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      magnet: (r) => r.magnetTested
        ? { text: (r.magnetic ? '있음✓' : '없음'), color: r.magnetic ? 0xc792ea : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      hardness: (r, mid) => {
        if (NO_HARDNESS.includes(mid)) return { text: '해당없음', color: 0x4a6580 };
        if (!r.hardnessTested) return { text: '?', color: 0x2e4057 };
        return { text: r.hardness === 'high' ? '없음' : '있음', color: 0x55d6c2 };
      },
    };
    MINERALS.forEach(m => {
      const rec = records[m.id] || {};
      ['color', 'streak', 'acid', 'magnet', 'hardness'].forEach(k => {
        const cell = this._logbookCells[`${m.id}_${k}`];
        if (cell) {
          const next = map[k](rec, m.id);
          cell.text = next.text;
          cell.style.fill = next.color;
        }
      });
    });
  }

  /**
   * Briefly highlights minerals and tools after the intro dialogue finishes.
   * Two sine-wave pulses: glow alpha 0→0.8→0 and container scale 1→1.1→1.
   * Stops early if the player starts dragging.
   */
  _pulseHighlight() {
    const targets = [...this._minerals, ...this._tools];
    const TOTAL  = 90;   // ~1.5 s at 60 fps (delta ≈ 1 per frame)
    const PULSES = 2;    // number of bumps
    let t = 0;

    const tick = (delta) => {
      // Cancel cleanly if the player has already started interacting
      if (this._dragging) {
        targets.forEach(obj => {
          if (obj.glow) obj.glow.alpha = 0;
          obj.container.scale.set(1);
        });
        this.sceneManager.app.ticker.remove(tick);
        this._pulseHighlightTicker = null;
        return;
      }

      t += delta;
      const progress = Math.min(t / TOTAL, 1);
      // PULSES positive sine bumps: sin(0…PULSES·2π), negative values clamped to 0
      const wave = Math.max(0, Math.sin(progress * PULSES * 2 * Math.PI));

      targets.forEach(obj => {
        if (obj.glow) obj.glow.alpha = wave * 0.8;
        obj.container.scale.set(1 + wave * 0.1);
      });

      if (progress >= 1) {
        targets.forEach(obj => {
          if (obj.glow) obj.glow.alpha = 0;
          obj.container.scale.set(1);
        });
        this.sceneManager.app.ticker.remove(tick);
        this._pulseHighlightTicker = null;
      }
    };

    this._pulseHighlightTicker = tick;
    this.sceneManager.app.ticker.add(tick);
  }

  _onGameOver() {
    this.sceneManager.changeScene('result', { statusManager: this.statusManager, mineralManager: this.mineralManager });
  }

  update(delta) {
    if (this.uiManager) this.uiManager.update(delta);

    if (this._doorGlow) {
      this._glowTime += delta * 0.03;
      // 0.1 ~ 0.4 사이를 천천히 반복 (최대 밝기 감소)
      this._doorGlow.alpha = 0.25 + Math.sin(this._glowTime) * 0.15;
    }
  }

  async onExit() {
    AudioManager.instance.stopBGM();
    this.statusManager.stopTimer();
    // 드래그 중 씬 이탈 시 이벤트 리스너 정리
    if (this._stageMove) {
      this.sceneManager.app.stage.off('pointermove', this._stageMove);
      this._stageMove = null;
    }
    if (this._stageUp) {
      this.sceneManager.app.stage.off('pointerup', this._stageUp);
      window.removeEventListener('pointerup', this._stageUp);
      this._stageUp = null;
    }
    if (this._gameOverHandler) {
      this.statusManager.off('gameOver', this._gameOverHandler);
      this._gameOverHandler = null;
    }
    if (this._timerExpiredHandler) {
      this.statusManager.off('timerExpired', this._timerExpiredHandler);
      this._timerExpiredHandler = null;
    }
    if (this._pulseHighlightTicker) {
      this.sceneManager.app.ticker.remove(this._pulseHighlightTicker);
      this._pulseHighlightTicker = null;
    }
    this.uiManager?.destroy();
  }
}
