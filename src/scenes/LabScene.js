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

const TABLE_LAYOUT = {
  streak: { x: 500, y: 320 },
  acid: { x: 650, y: 300 },
  magnet: { x: 850, y: 336 },
};

const MINERAL_POSITIONS = [
  { cx: 291, cy: 458 },  // quartz  (?앹쁺 ???쇰꺼 ?섎떒 湲곗?)
  { cx: 456, cy: 481 },  // feldspar
  { cx: 644, cy: 481 },  // biotite
  { cx: 832, cy: 481 },  // calcite
  { cx: 1020, cy: 481 }, // magnetite (x 湲곗〈 ?좎?)
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
    this._dragging = null;
    this._stageMove = null;
    this._stageUp = null;
    this._popup = null;
    this._logbookCells = {};
    this._gameOverHandler = null;
    this._timerExpiredHandler = null;
    this._pulseHighlightTicker = null;
    this._clueHintCards = [];
    this._pendingStageOneHints = null;
    this._stageHintOverlay = null;
    this._stageHintOverlayTicker = null;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;

    this.container.sortableChildren = true;

    await PIXI.Assets.load([
      'images/lab_bg.png',
      'images/quartz.png',
      'images/feldspar.png',
      'images/biotite.png',
      'images/calcite.png',
      'images/magnetite.png',
      'images/streak_plate.png',
      'images/Hcl_bottle.png',
      'images/Hcl_bottle_only.png',
      'images/Hcl_bottle_spoide.png',
      'images/petri_dish.png',
      'images/paper_clip.png',
      'images/exit_door.png'
    ]);

    this.statusManager = data.statusManager ?? new StatusManager();
    this.mineralManager = data.mineralManager ?? new MineralManager();
    if (!data.mineralManager) this.mineralManager.init();
    this.mineralManager.getAllMinerals().forEach(m => this.mineralManager.revealColor(m.id));
    this.safetySystem = data.safetySystem ?? new SafetySystem();

    this.uiManager = new UIManager(this.sceneManager.app, this.statusManager);
    this.uiManager.init();
    this.uiManager.moveMuteBtn(0, 21); // center in bottom bar (H-54 → H-33)

    this._buildBackground(W, H);
    this._buildClueHints(W, H);
    this._buildLabTable(W, H);
    this._buildLogbookPanel(W, H);
    this._buildDoorButton(W, H);
    this._buildEquipmentButton(W, H);
    const placed = this._buildMinerals(W, H);
    this._buildTools(W, H, placed);
    this.refresh();
    this.container.sortChildren();

    if (this.mineralManager.shouldShowLabIntroDialogue()) {
      this.sceneManager.app.ticker.addOnce(() => {
        this.uiManager.showDialogue(
          '여기가… 실험실인가. 문이 잠겨 있고… 저 철문이 출구인 것 같아.\n저걸 열려면 \'열쇠 광물\'을 찾아야 한다고 했지… 실험대 위에 있는 광물과 도구들을 살펴봐야겠다.',
          () => this._pulseHighlight()
        );
      });
      this.mineralManager.markLabIntroDialogueShown();
    }

    this._gameOverHandler = () => this._onGameOver();
    this._timerExpiredHandler = () => this._onGameOver();
    this.statusManager.on('gameOver', this._gameOverHandler);
    this.statusManager.on('timerExpired', this._timerExpiredHandler);
    this.statusManager.startTimer();

    AudioManager.instance.playBGM('lab');
  }

  // ??? ?곷떒 ?⑥꽌 ?뚰듃 移대뱶 3媛??????????????????????????????????????
  _buildClueHints(W, H) {
    const CARD_W = 205, CARD_H = 81, GAP = 14;
    const OLD_CARD_W = 215;
    const oldTotalW = OLD_CARD_W * 3 + GAP * 2;
    const oldStartX = Math.round((W - oldTotalW) / 2) - 40;
    const rightmostX = oldStartX + 2 * (OLD_CARD_W + GAP);
    const startX = rightmostX - 2 * (CARD_W + GAP);
    const startY = 10;

    this._clueHintCards = [];

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (CARD_W + GAP);
      const card = new PIXI.Container();
      card.position.set(x, startY);
      card.zIndex = 20;

      // 移대뱶 諛곌꼍 (?좉툑 ?곹깭)
      const bg = new PIXI.Graphics();
      this._drawClueCard(bg, false);
      card.addChild(bg);

      // 踰덊샇 諭껋?
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

      const lockTxt = new PIXI.Text('힌트 잠김', {
        fontFamily: 'Arial', fontSize: 11, fill: 0x3a5a7a,
      });
      lockTxt.anchor.set(0.5, 0.5);
      lockTxt.position.set(CARD_W / 2 + 6, CARD_H / 2);
      card.addChild(lockTxt);

      // ?⑥꽌 ?띿뒪??(?닿툑 ???쒖떆)
      const clueTxt = new PIXI.Text('', {
        fontFamily: 'Arial', fontSize: 14, fill: 0xb8deff,
        wordWrap: true, wordWrapWidth: CARD_W - 28, lineHeight: 20,
      });
      clueTxt.position.set(26, 8);
      clueTxt.visible = false;
      clueTxt.alpha = 0;
      card.addChild(clueTxt);

      this.container.addChild(card);
      this._clueHintCards.push({ card, bg, badgeBg, lockTxt, clueTxt });
    }

    // ?대? ?닿툑???⑥꽌 利됱떆 諛섏쁺 (???ъ쭊????
    this._refreshClueHints(false);
  }

  _drawClueCard(bg, unlocked, expanded = false) {
    bg.clear();
    if (unlocked) {
      bg.beginFill(0x0a2218, 0.92);
      bg.lineStyle(1.5, 0x27ae60, 0.85);
    } else {
      bg.beginFill(0x08111e, 0.88);
      bg.lineStyle(1, 0x1e3a52, 0.7);
    }
    bg.drawRoundedRect(0, 0, 215, expanded ? 162 : 81, 6);
    bg.endFill();
  }

  _refreshClueHints(animate = true) {
    if (!this._clueHintCards.length) return;
    const states = this.mineralManager?.getHintPanelState?.() ?? [];

    states.forEach((state, i) => {
      const card = this._clueHintCards[i];
      if (!card) return;

      const unlocked = state.level > 0;
      const expanded = state.level > 1;
      this._drawClueCard(card.bg, unlocked, expanded);

      card.badgeBg.clear();
      card.badgeBg.beginFill(unlocked ? 0x27ae60 : 0x1a3a5c, 0.92);
      card.badgeBg.drawCircle(0, 0, 9);
      card.badgeBg.endFill();

      card.lockTxt.visible = !unlocked;
      card.lockTxt.position.set(110, unlocked ? 40 : 40.5);

      if (!unlocked) {
        card.clueTxt.visible = false;
        card.clueTxt.text = '';
        card.clueTxt.alpha = 0;
        return;
      }

      const lines = [`• 1단계 힌트\n${state.stage1}`];
      if (expanded) {
        lines.push(`• 2단계 힌트\n${state.stage2}`);
      }

      card.clueTxt.position.set(18, 18);
      card.clueTxt.style.wordWrapWidth = 179;
      card.clueTxt.style.lineHeight = 18;
      card.clueTxt.text = lines.join('\n\n');
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
      return;
    });
  }

  _showStageOneHintOverlay() {}

  _hideStageOneHintOverlay() {}

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
    const hint = new PIXI.Text('광물을 도구에 드래그하여 실험을 해 보세요.', {
      fontFamily: 'Arial', fontSize: 17, fill: 0xcfe8f6, fontWeight: 'bold',
      dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(W / 2, 572);
    hint.zIndex = 5;
    this.container.addChild(hint);
  }

  _buildLogbookPanel(W, H) {
    this._buildLogbookToggle(W, H);
    this._buildLogbookOverlay(W, H);
  }

  _buildLogbookToggle(W, H) {
    const btn = new PIXI.Container();
    btn.position.set(W - 162, 308);
    btn.zIndex = 15;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x0d1b2a, 0.95);
    bg.lineStyle(1.5, 0x315f82, 0.9);
    bg.drawRoundedRect(0, 0, 150, 84, 8);
    bg.endFill();
    btn.addChild(bg);

    const txt = new PIXI.Text('📋 실험 도감  ▶', {
      fontFamily: 'Arial', fontSize: 13, fill: 0x9dd8ff, fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(75, 42);
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => { bg.tint = 0x1a3a5c; });
    btn.on('pointerout',  () => { bg.tint = 0xffffff; });
    btn.on('pointerdown', () => this._toggleLogbook());

    this._logbookToggleBg = bg;
    this._logbookToggleTxt = txt;
    this.container.addChild(btn);
  }

  _buildLogbookOverlay(W, H) {
    const PW = 680, PH = 600;
    const PX = Math.round((W - PW) / 2);
    const PY = Math.round((H - PH) / 2);

    const overlay = new PIXI.Container();
    overlay.zIndex = 500;
    overlay.visible = false;

    const backdrop = new PIXI.Graphics();
    backdrop.beginFill(0x000000, 0.6);
    backdrop.drawRect(0, 0, W, H);
    backdrop.endFill();
    backdrop.eventMode = 'static';
    backdrop.on('pointerdown', () => this._closeLogbook());
    overlay.addChild(backdrop);

    const box = new PIXI.Graphics();
    box.beginFill(0x08111a, 0.97);
    box.lineStyle(1.5, 0x315f82, 0.9);
    box.drawRoundedRect(0, 0, PW, PH, 16);
    box.endFill();
    box.position.set(PX, PY);
    box.eventMode = 'static';
    overlay.addChild(box);

    const headerBg = new PIXI.Graphics();
    headerBg.beginFill(0x0d1b2a, 0.97);
    headerBg.drawRoundedRect(0, 0, PW, 56, 16);
    headerBg.drawRect(0, 28, PW, 28);
    headerBg.endFill();
    headerBg.position.set(PX, PY);
    overlay.addChild(headerBg);

    const hdrTxt = new PIXI.Text('실험 도감', {
      fontFamily: 'Arial', fontSize: 20, fill: 0x9dd8ff, fontWeight: 'bold',
    });
    hdrTxt.position.set(PX + 20, PY + 14);
    overlay.addChild(hdrTxt);

    const hdrSub = new PIXI.Text('진행한 실험 결과가 자동 기록됩니다', {
      fontFamily: 'Arial', fontSize: 13, fill: 0x5d88a9,
    });
    hdrSub.position.set(PX + 20, PY + 36);
    overlay.addChild(hdrSub);

    const closeBg = new PIXI.Graphics();
    closeBg.beginFill(0x3d4f60);
    closeBg.drawCircle(0, 0, 15);
    closeBg.endFill();
    const closeX = new PIXI.Text('✕', { fontFamily: 'Arial', fontSize: 13, fill: 0xffffff });
    closeX.anchor.set(0.5, 0.5);
    const closeBtn = new PIXI.Container();
    closeBtn.addChild(closeBg);
    closeBtn.addChild(closeX);
    closeBtn.position.set(PX + PW - 26, PY + 28);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerover', () => { closeBg.tint = 0xe74c3c; });
    closeBtn.on('pointerout',  () => { closeBg.tint = 0xffffff; });
    closeBtn.on('pointerdown', () => this._closeLogbook());
    overlay.addChild(closeBtn);

    const COLS = [
      { key: 'name',     w: 140, label: '광물' },
      { key: 'color',    w: 80,  label: '색' },
      { key: 'streak',   w: 100, label: '조흔색' },
      { key: 'acid',     w: 100, label: '염산' },
      { key: 'magnet',   w: 90,  label: '자성' },
      { key: 'hardness', w: 130, label: '긁힘' },
    ];
    const NO_HARDNESS = ['feldspar', 'biotite', 'magnetite'];
    const ROW_H = 80;
    const HDR_H = 34;
    const TX = PX + 10;
    const TY = PY + 66;
    const tableW = COLS.reduce((sum, col) => sum + col.w, 0);

    const headerRow = new PIXI.Graphics();
    headerRow.beginFill(0x0f2234, 0.95);
    headerRow.drawRoundedRect(TX, TY, tableW, HDR_H, 10);
    headerRow.endFill();
    overlay.addChild(headerRow);

    let colX = TX;
    COLS.forEach((col) => {
      const colTxt = new PIXI.Text(col.label, {
        fontFamily: 'Arial', fontSize: 14, fill: 0x78b8de, fontWeight: 'bold',
      });
      colTxt.anchor.set(0.5, 0.5);
      colTxt.position.set(colX + col.w / 2, TY + HDR_H / 2);
      overlay.addChild(colTxt);
      colX += col.w;
    });

    const fmtMap = {
      color: (r, mid) => {
        if (!this.mineralManager.isColorRevealed(mid)) return { text: '?', color: 0x2e4057 };
        const m = this.mineralManager.getMineral(mid);
        return { text: m?.colorLabel ?? '?', color: 0x9dd8ff };
      },
      streak: (r, mid) => {
        if (mid === 'quartz') return { text: '해당 없음', color: 0x4a6580 };
        if (!r.streakTested) return { text: '?', color: 0x2e4057 };
        return { text: ({ none: '없음', white: '흰색', black: '검정' })[r.streakColor] || r.streakColor, color: 0x73e2a7 };
      },
      acid: (r) => r.acidTested
        ? { text: r.acidReacted ? '거품✓' : '무반응', color: r.acidReacted ? 0xf3b562 : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      magnet: (r) => r.magnetTested
        ? { text: r.magnetic ? '있음✓' : '없음', color: r.magnetic ? 0xc792ea : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      hardness: (r, mid) => {
        if (NO_HARDNESS.includes(mid)) return { text: '해당 없음', color: 0x4a6580 };
        if (!r.hardnessTested) return { text: '?', color: 0x2e4057 };
        return { text: r.hardness === 'high' ? '없음' : '있음', color: 0x55d6c2 };
      },
    };

    const records = this.mineralManager.getAllRecords();
    MINERALS.forEach((mineral, ri) => {
      const rowY = TY + HDR_H + 6 + ri * ROW_H;
      const rowCenterY = rowY + (ROW_H - 6) / 2;

      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(ri % 2 === 0 ? 0x102231 : 0x0c1b28, 0.92);
      rowBg.drawRoundedRect(TX, rowY, tableW, ROW_H - 6, 12);
      rowBg.endFill();
      overlay.addChild(rowBg);

      const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
      sprite.anchor.set(0.5);
      sprite.width = 38; sprite.height = 38;
      sprite.position.set(TX + 22, rowCenterY);
      overlay.addChild(sprite);

      const nmTxt = new PIXI.Text(mineral.name, {
        fontFamily: 'Arial', fontSize: 16, fill: 0xddeeff, fontWeight: 'bold',
      });
      nmTxt.anchor.set(0, 0.5);
      nmTxt.position.set(TX + 46, rowCenterY);
      overlay.addChild(nmTxt);

      const rec = records[mineral.id] || {};
      let cx = TX + COLS[0].w;
      COLS.slice(1).forEach((col) => {
        const { text, color } = fmtMap[col.key](rec, mineral.id);
        const cell = new PIXI.Text(text, {
          fontFamily: 'Arial', fontSize: 14, fill: color,
          fontWeight: text !== '?' ? 'bold' : 'normal',
        });
        cell.anchor.set(0.5, 0.5);
        cell.position.set(cx + col.w / 2, rowCenterY);
        overlay.addChild(cell);
        this._logbookCells[`${mineral.id}_${col.key}`] = cell;
        cx += col.w;
      });
    });

    this._logbookOverlay = overlay;
    this.container.addChild(overlay);
  }

  _toggleLogbook() {
    if (this._logbookOverlay?.visible) {
      this._closeLogbook();
    } else {
      this._openLogbook();
    }
  }

  _openLogbook() {
    this.refresh();
    this._logbookOverlay.visible = true;
    this.container.sortChildren();
    if (this._logbookToggleTxt) this._logbookToggleTxt.text = '📋 실험 도감  ◀';
  }

  _closeLogbook() {
    this._logbookOverlay.visible = false;
    if (this._logbookToggleTxt) this._logbookToggleTxt.text = '📋 실험 도감  ▶';
  }

  _buildDoorButton(W, H) {
    const btn = new PIXI.Container();
    btn.position.set(60, 20);
    btn.zIndex = 10;

    this._doorGlow = new PIXI.Graphics();
    this._doorGlow.beginFill(0xffcc00, 0.4);
    this._doorGlow.drawRoundedRect(-20, -20, 260, 145, 32);
    this._doorGlow.endFill();
    this._doorGlow.filters = [new PIXI.BlurFilter(12)];
    btn.addChild(this._doorGlow);
    this._glowTime = 0;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0); // ?щ챸?섍쾶 ?ㅼ젙
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

    const txt = new PIXI.Text('안전 장비 착용하기', { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, fontWeight: 'bold' });
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
        safetySystem: this.safetySystem,
        fromLab: true
      });
    });
    this.container.addChild(btn);
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
    const spriteSize = 90 * LAB_OBJECT_SCALE * 1.2;
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
      { type: 'streak', img: 'streak_plate.png' }, { type: 'acid', img: 'Hcl_bottle.png' },
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
      const targetSize = 90 * LAB_OBJECT_SCALE * 1.2;
      const scale = Math.min(targetSize / sprite.texture.width, targetSize / sprite.texture.height);
      sprite.scale.set(scale);
      cont.addChild(sprite);

      const label = new PIXI.Text(
        td.type === 'streak' ? '조흔판' :
          td.type === 'acid' ? '묽은 염산' :
            td.type === 'magnet' ? '클립' : '경도 비교',
        { fontFamily: 'Arial', fontSize: 13, fill: 0xffffff, fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1 }
      );
      label.anchor.set(0.5, 0);
      label.position.set(0, td.type === 'streak' ? 46 * LAB_OBJECT_SCALE - 8 : td.type === 'acid' ? 46 * LAB_OBJECT_SCALE + 3 : (td.type === 'magnet' ? 30 : 46) * LAB_OBJECT_SCALE);
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
      // PixiJS v7 API: ev.getLocalPosition() (ev.data???섏쐞?명솚??
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
        // 紐⑤컮?? 罹붾쾭??諛뽰뿉???먯쓣 ?쇰룄 ?쒕∼ 泥섎━?섎룄濡?window 由ъ뒪?덈룄 ?쒓굅
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
      // 紐⑤컮?쇱뿉???먭??쎌씠 罹붾쾭???곸뿭 諛뽰쑝濡??섍컝 寃쎌슦 window?먯꽌 fallback 泥섎━
      window.addEventListener('pointerup', this._stageUp, { once: true });
    });
  }

  _updateGlows(draggedObj, draggedType) {
    if (draggedType === 'mineral') {
      this._tools.forEach(tool => {
        if (tool.glow) tool.glow.alpha = this._isWithinGlowRange(draggedObj, tool) ? 1.0 : 0;
      });

      // ?앹쁺?붾갑?댁꽍 援녠린 鍮꾧탳 湲濡쒖슦
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
    const mineral = getMineralById(mineralId);
    const popup = new ExperimentPopup(this.sceneManager.app, {
      mineral, experimentType: type, statusManager: this.statusManager, mineralManager: this.mineralManager,
      safetySystem: this.safetySystem, uiManager: this.uiManager
    });
    popup.onClose(() => {
      AudioManager.instance.playSFX('popup_close');
      this._popup = null;
      this.refresh();
    });
    popup.onDone(() => {
      this.refresh();
      const hint = this.mineralManager.advanceHintPanel();
      this._refreshClueHints();

      if (hint) {
        this.uiManager.showDialogue(`새로운 힌트 해제: "${hint.text}"`);
      } else {
        const newClues = this.mineralManager.tryUnlockClues();
        if (newClues.length > 0) {
          this.uiManager.showDialogue(`새 단서 발견: "${newClues[0].text}"`);
        }
      }
    });
    this._mountPopup(popup);
  }

  _showHardnessCompare(idA, idB) {
    if (this._popup) return;
    AudioManager.instance.playSFX('popup_open');
    const mineralA = getMineralById(idA), mineralB = getMineralById(idB);
    const popup = new HardnessComparePopup(this.sceneManager.app, {
      mineralA, mineralB, mineralManager: this.mineralManager, uiManager: this.uiManager
    });
    popup.onClose(() => {
      AudioManager.instance.playSFX('popup_close');
      this._popup = null;
      this.refresh();
      const hint = this.mineralManager.advanceHintPanel();
      this._refreshClueHints();

      if (hint) {
        this.uiManager.showDialogue(`새로운 힌트 해제: "${hint.text}"`);
      } else {
        const newClues = this.mineralManager.tryUnlockClues();
        if (newClues.length > 0) {
          this.uiManager.showDialogue(`새 단서 발견: "${newClues[0].text}"`);
        }
      }
    });
    this._mountPopup(popup);
  }

  _tryDoor() {
    this.mineralManager.markDoorVisited();
    this.sceneManager.changeScene('door', {
      statusManager: this.statusManager, mineralManager: this.mineralManager, safetySystem: this.safetySystem
    });
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
      streak: (r, mid) => {
        if (mid === 'quartz') return { text: '해당 없음', color: 0x4a6580 };
        if (!r.streakTested) return { text: '?', color: 0x2e4057 };
        return { text: (({ none: '없음', white: '흰색', black: '검정' })[r.streakColor] || r.streakColor), color: 0x73e2a7 };
      },
      acid: (r) => r.acidTested
        ? { text: (r.acidReacted ? '거품 발생' : '무반응'), color: r.acidReacted ? 0xf3b562 : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      magnet: (r) => r.magnetTested
        ? { text: (r.magnetic ? '있음' : '없음'), color: r.magnetic ? 0xc792ea : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      hardness: (r, mid) => {
        if (NO_HARDNESS.includes(mid)) return { text: '해당 없음', color: 0x4a6580 };
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
   * Two sine-wave pulses: glow alpha 0??.8?? and container scale 1??.1??.
   * Stops early if the player starts dragging.
   */
  _pulseHighlight() {
    const targets = [...this._minerals, ...this._tools];
    const TOTAL  = 90;   // ~1.5 s at 60 fps (delta ??1 per frame)
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
      // PULSES positive sine bumps: sin(0?쪷ULSES쨌2?), negative values clamped to 0
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
      // 0.1 ~ 0.4 ?ъ씠瑜?泥쒖쿇??諛섎났 (理쒕? 諛앷린 媛먯냼)
      this._doorGlow.alpha = 0.25 + Math.sin(this._glowTime) * 0.15;
    }
  }

  async onExit() {
    AudioManager.instance.stopBGM();
    this.statusManager.stopTimer();

    if (this.uiManager) {
      this.uiManager.destroy();
      this.uiManager = null;
    }

    // 드래그 중인 데이터와 이벤트 리스너 정리
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
    this._pendingStageOneHints = null;
    this._hideStageOneHintOverlay();
  }
}

