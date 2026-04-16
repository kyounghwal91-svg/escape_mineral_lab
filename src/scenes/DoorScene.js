import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { AudioManager } from '../systems/AudioManager.js';
import { MINERALS } from '../data/minerals.js';

import { SafetySystem } from '../systems/SafetySystem.js';
import { NotePopup } from '../ui/NotePopup.js';

const SLOT_COUNT = 3;
const CARD_W = 96;
const CARD_H = 110;
const DOOR_CENTER_Y = 315;
const DOOR_LAYOUT = {
  lockLabelOffsetY: -22,
  ledOffsetY: -58,
  slotOffsetY: 6,
  // Feedback text sits above the submit button area
  feedbackOffsetY: 148,
};

export default class DoorScene extends BaseScene {
  constructor() {
    super();
    this.statusManager = null;
    this.mineralManager = null;
    this.safetySystem = null;

    this._slots = [];   // { container, graphics, mineral, card, x, y, radius }
    this._cards = [];   // { container, id, mineral, originalX, originalY }
    this._dragging = null;
    this._stageMove = null;
    this._stageUp = null;
    this._feedbackText = null;
    this._popup = null;
    this._escapeTimeout = null;
    this._feedbackTimeout = null;
    // Submit-flow state
    this._submitBtn = null;
    this._attemptsText = null;
    this._cluePanel = null;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);
    const W = 1280, H = 720;

    await PIXI.Assets.load(['images/exit_door.png']);

    this.statusManager = data.statusManager;
    this.mineralManager = data.mineralManager;
    this.safetySystem = data.safetySystem ?? new SafetySystem();

    this._buildBackground(W, H);
    this._buildDoor(W, H);
    this._buildSlots(W, H);
    this._buildCardTray(W, H);
    this._buildCards(W, H);
    this._buildFeedback(W, H);
    this._buildSubmitButton(W, H);
    this._buildBackButton(W, H);
    this._buildLogbookPanel(W, H);
    this._buildCluePanel(W, H);

    // Sync submit button with current mineralManager state
    this._updateSubmitButton();

    AudioManager.instance.playBGM('door');
  }

  // ─── Background & door ────────────────────────────────────────────────────

  _buildBackground(W, H) {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x141e2b);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    this.container.addChild(bg);

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0x080f1a);
    titleBg.drawRect(0, 0, W, 74);
    titleBg.endFill();
    titleBg.lineStyle(2, 0x8b1a1a, 0.9);
    titleBg.moveTo(0, 72); titleBg.lineTo(W, 72);
    this.container.addChild(titleBg);

    const title = new PIXI.Text('탈출구 — 실험 근거를 바탕으로 열쇠 광물 3종을 추론하여 제출하세요', {
      fontFamily: 'Arial', fontSize: 18, fill: 0x85c1e9, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0.5); title.position.set(W / 2, 33);
    this.container.addChild(title);

    const sub = new PIXI.Text('MINERAL LOCK SYSTEM  ·  PLACE 3 MINERALS  ·  SUBMIT WHEN READY', {
      fontFamily: 'Arial', fontSize: 10, fill: 0x3d4f62, letterSpacing: 2,
    });
    sub.anchor.set(0.5, 0); sub.position.set(W / 2, 53);
    this.container.addChild(sub);
  }

  _buildDoor(W, H) {
    const door = PIXI.Sprite.from('images/exit_door.png');
    door.anchor.set(0.5);
    door.position.set(W / 2, DOOR_CENTER_Y);
    door.width = 360;
    door.height = 480;
    this.container.addChild(door);

    this._slotLEDs = [];
    const ledY = DOOR_CENTER_Y + DOOR_LAYOUT.ledOffsetY;
    [568, 640, 712].forEach((sx) => {
      const led = new PIXI.Graphics();
      led.position.set(sx, ledY);
      this._drawLED(led, false);
      this.container.addChild(led);
      this._slotLEDs.push(led);
    });
  }

  _drawLED(g, unlocked) {
    g.clear();
    g.beginFill(unlocked ? 0x27ae60 : 0xe74c3c, 0.95);
    g.drawCircle(0, 0, 10);
    g.endFill();
    g.beginFill(0xffffff, 0.35);
    g.drawCircle(-2, -2, 5);
    g.endFill();
  }

  // ─── Slots ────────────────────────────────────────────────────────────────

  _buildSlots(W, H) {
    const slotSpacing = 72;
    const totalWidth = (SLOT_COUNT - 1) * slotSpacing;
    const startX = W / 2 - totalWidth / 2;
    const slotY = DOOR_CENTER_Y + DOOR_LAYOUT.slotOffsetY;
    const slotR = 28;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx = startX + i * slotSpacing + (i === SLOT_COUNT - 1 ? 3 : 0);
      const g = new PIXI.Graphics();
      const cont = new PIXI.Container();
      cont.position.set(sx, slotY);
      cont.addChild(g);

      // card: null — set when a card is placed here, cleared on eject
      const slot = { container: cont, graphics: g, mineral: null, card: null, x: sx, y: slotY, radius: slotR };
      this._drawSlot(slot, null);
      cont.eventMode = 'static';
      cont.cursor = 'pointer';

      // Clicking a FILLED slot ejects the mineral back to the tray.
      // No per-slot hints are revealed here — use the clue panel / hint button instead.
      cont.on('pointerdown', () => {
        if (this._popup || this._dragging) return;
        if (slot.mineral) this._ejectSlot(slot);
      });

      this.container.addChild(cont);
      this._slots.push(slot);
    }

    // Slot index labels
    const labelY = slotY + slotR + 16;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx = startX + i * slotSpacing + (i === SLOT_COUNT - 1 ? 3 : 0);
      const lbl = new PIXI.Text(`슬롯 ${i + 1}`, {
        fontFamily: 'Arial', fontSize: 9, fill: 0x3d5a78,
      });
      lbl.anchor.set(0.5, 0);
      lbl.position.set(sx, labelY);
      this.container.addChild(lbl);
    }
  }

  _drawSlot(slot, mineral) {
    const { graphics: g, container: cont, radius: r } = slot;
    g.clear();

    const oldSprite = cont.getChildByName('mineralSprite');
    if (oldSprite) cont.removeChild(oldSprite);
    const oldLabel = cont.getChildByName('mineralLabel');
    if (oldLabel) cont.removeChild(oldLabel);

    if (mineral) {
      g.lineStyle(3, 0x85c1e9);
      g.beginFill(0x1a2535);
      g.drawCircle(0, 0, r);
      g.endFill();

      const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
      sprite.name = 'mineralSprite';
      sprite.anchor.set(0.5);
      sprite.width = r * 1.6;
      sprite.height = r * 1.6;
      cont.addChild(sprite);

      const lbl = new PIXI.Text(mineral.name, {
        fontFamily: 'Arial', fontSize: 9, fill: 0xddeeff, fontWeight: 'bold',
      });
      lbl.name = 'mineralLabel';
      lbl.anchor.set(0.5, 0);
      lbl.position.set(0, r + 2);
      cont.addChild(lbl);
    } else {
      g.lineStyle(2, 0x2e4057, 1, 0.5, true);
      g.beginFill(0x0d1b2a, 0.5);
      g.drawCircle(0, 0, r);
      g.endFill();
    }
  }

  /** Remove the mineral from a slot and restore its card to the tray. */
  _ejectSlot(slot) {
    if (!slot.mineral) return;
    if (slot.card) {
      slot.card.container.visible = true;
      slot.card.container.x = slot.card.originalX;
      slot.card.container.y = slot.card.originalY;
    }
    slot.mineral = null;
    slot.card = null;
    this._drawSlot(slot, null);
    this._updateSubmitButton();
  }

  // ─── Card tray & draggable cards ─────────────────────────────────────────

  _buildCardTray(W, H) {
    const ty = 556, th = H - ty - 6;
    const tray = new PIXI.Graphics();
    tray.beginFill(0x0a1520);
    tray.lineStyle(2, 0x1f3a52);
    tray.drawRoundedRect(40, ty, W - 80, th, 6);
    tray.endFill();
    tray.lineStyle(1, 0x2e5070, 0.5);
    tray.moveTo(44, ty + 2); tray.lineTo(W - 44, ty + 2);
    tray.lineStyle(1, 0x0d1e2e, 0.5);
    for (let y = ty + 18; y < ty + th; y += 20) {
      tray.moveTo(44, y); tray.lineTo(W - 44, y);
    }
    this.container.addChild(tray);

    const lbl = new PIXI.Text('▶  선택 광물  ( 슬롯을 클릭하면 제거됩니다 )', {
      fontFamily: 'Arial', fontSize: 11, fill: 0x3d5a78, letterSpacing: 2,
    });
    lbl.position.set(56, ty + 8);
    this.container.addChild(lbl);
  }

  _buildCards(W, H) {
    const totalW = MINERALS.length * CARD_W + (MINERALS.length - 1) * 16;
    const startX = W / 2 - totalW / 2;
    const cardY = H - CARD_H - 30;
    MINERALS.forEach((mineral, i) => {
      const cx = startX + i * (CARD_W + 16);
      const card = this._createCard(mineral, cx, cardY);
      this._cards.push(card);
      this.container.addChild(card.container);
      this._makeDraggable(card);
    });
  }

  _createCard(mineral, cx, cy) {
    const cont = new PIXI.Container();
    cont.position.set(cx, cy);
    const bg = new PIXI.Graphics();
    bg.lineStyle(2, 0x2e4057);
    bg.beginFill(0x152232);
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 6);
    bg.endFill();
    cont.addChild(bg);

    const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
    sprite.anchor.set(0.5);
    sprite.position.set(CARD_W / 2, 42);
    sprite.width = 60;
    sprite.height = 60;
    cont.addChild(sprite);

    const name = new PIXI.Text(mineral.name, {
      fontFamily: 'Arial', fontSize: 12, fill: 0xddeeff, fontWeight: 'bold',
    });
    name.anchor.set(0.5, 0);
    name.position.set(CARD_W / 2, 76);
    cont.addChild(name);

    cont.eventMode = 'static';
    cont.cursor = 'grab';
    return { container: cont, id: mineral.id, mineral, originalX: cx, originalY: cy };
  }

  _makeDraggable(card) {
    card.container.on('pointerdown', (e) => {
      if (this._dragging || this._popup) return;
      this._dragging = card;
      const pos = e.data.getLocalPosition(this.container);
      this._dragging.offX = pos.x - card.container.x;
      this._dragging.offY = pos.y - card.container.y;
      this.container.addChild(card.container);
      this._stageMove = (ev) => {
        if (!this._dragging) return;
        const p = ev.data.getLocalPosition(this.container);
        card.container.x = p.x - this._dragging.offX;
        card.container.y = p.y - this._dragging.offY;
      };
      this._stageUp = () => {
        if (!this._dragging) return;
        this._dragging = null;
        this.sceneManager.app.stage.off('pointermove', this._stageMove);
        this._onDrop(card);
      };
      this.sceneManager.app.stage.on('pointermove', this._stageMove);
      this.sceneManager.app.stage.once('pointerup', this._stageUp);
    });
  }

  _onDrop(card) {
    const hit = this._findSlotHit(card);
    if (hit) {
      // Reject if slot is already occupied
      if (hit.mineral) { this._snapBack(card); return; }

      // Place mineral in slot — NO validation here, only on Submit
      hit.mineral = card.mineral;
      hit.card = card;
      this._drawSlot(hit, card.mineral);
      card.container.visible = false;
      this._updateSubmitButton();
      AudioManager.instance.playSFX('door_unlock');
      return;
    }
    this._snapBack(card);
  }

  _findSlotHit(card) {
    const cb = card.container.getBounds();
    const cx = cb.x + cb.width / 2;
    const cy = cb.y + cb.height / 2;
    for (const slot of this._slots) {
      const sb = slot.container.getBounds();
      const scx = sb.x + sb.width / 2;
      const scy = sb.y + sb.height / 2;
      if (Math.hypot(cx - scx, cy - scy) < slot.radius + 30) return slot;
    }
    return null;
  }

  _snapBack(card) {
    const app = this.sceneManager.app;
    const sx = card.container.x, sy = card.container.y;
    const tx = card.originalX, ty = card.originalY;
    let t = 0;
    const tick = () => {
      t = Math.min(t + 0.14, 1);
      card.container.x = sx + (tx - sx) * t;
      card.container.y = sy + (ty - sy) * t;
      if (t >= 1) { card.container.x = tx; card.container.y = ty; app.ticker.remove(tick); }
    };
    app.ticker.add(tick);
  }

  // ─── Submit system ────────────────────────────────────────────────────────

  _buildSubmitButton(W, H) {
    const btnW = 230, btnH = 44;
    const btnX = W / 2 - btnW / 2;
    const btnY = DOOR_CENTER_Y + 185;   // ≈ Y:500

    // Dark backdrop panel — makes the submit area readable over the door image
    const padX = 26, padTop = 32, padBot = 10;
    const panelW = btnW + padX * 2;
    const panelH = padTop + btnH + padBot;  // attempts text lives inside padTop space
    const panelX = W / 2 - panelW / 2;
    const panelY = btnY - padTop;

    const backdrop = new PIXI.Graphics();
    backdrop.beginFill(0x060e18, 0.88);
    backdrop.lineStyle(1, 0x2e5878, 0.8);
    backdrop.drawRoundedRect(0, 0, panelW, panelH, 12);
    backdrop.endFill();
    backdrop.position.set(panelX, panelY);
    this.container.addChild(backdrop);

    // Attempt counter — inside the backdrop, centred above the button
    this._attemptsText = new PIXI.Text('', {
      fontFamily: 'Arial', fontSize: 14, fill: 0x7ec8e3, fontWeight: 'bold',
    });
    this._attemptsText.anchor.set(0.5, 0.5);
    this._attemptsText.position.set(W / 2, btnY - 14);
    this.container.addChild(this._attemptsText);

    // Submit button
    const btn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0x1b4f72);
    btnBg.lineStyle(2, 0x5dade2, 1.0);
    btnBg.drawRoundedRect(0, 0, btnW, btnH, 10);
    btnBg.endFill();
    btn.addChild(btnBg);

    const btnTxt = new PIXI.Text('✔  제출하기', {
      fontFamily: 'Arial', fontSize: 17, fill: 0xffffff, fontWeight: 'bold',
    });
    btnTxt.anchor.set(0.5, 0.5);
    btnTxt.position.set(btnW / 2, btnH / 2);
    btn.addChild(btnTxt);

    btn.position.set(btnX, btnY);
    btn.eventMode = 'none';   // disabled until all slots filled
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => this._onSubmit());
    this.container.addChild(btn);
    this._submitBtn = btn;

    // Helper note — below the panel, small and dimmed
    const helper = new PIXI.Text('슬롯을 클릭하면 광물을 제거할 수 있습니다', {
      fontFamily: 'Arial', fontSize: 10, fill: 0x3d5a78, letterSpacing: 1,
    });
    helper.anchor.set(0.5, 0);
    helper.position.set(W / 2, panelY + panelH + 4);
    this.container.addChild(helper);
  }

  /** Sync submit button enabled-state and attempt counter with manager state. */
  _updateSubmitButton() {
    if (!this._submitBtn) return;

    const allFilled = this._slots.every(s => s.mineral !== null);
    const attemptsLeft = this.mineralManager.getSubmitAttemptsLeft();
    const canSubmit = allFilled && attemptsLeft > 0;

    this._submitBtn.alpha = canSubmit ? 1.0 : 0.45;
    this._submitBtn.eventMode = canSubmit ? 'static' : 'none';
    this._submitBtn.cursor = canSubmit ? 'pointer' : 'default';

    if (this._attemptsText) {
      const max = this.mineralManager.maxSubmitAttempts;
      this._attemptsText.text = `남은 시도: ${attemptsLeft} / ${max}`;
      this._attemptsText.style.fill = attemptsLeft <= 1 ? 0xff6b6b : 0x7ec8e3;
    }
  }

  /**
   * Submit handler — the core of the new anti-brute-force flow:
   * 1. Check all slots filled.
   * 2. Check canSubmitKey() — blocks if experiments/clues insufficient.
   * 3. Validate minerals (order-independent) via checkAllSlots().
   * 4. On failure show only generic feedback; never reveal which slot is correct.
   */
  _onSubmit() {
    if (this._popup) return;

    // Guard: all slots must be occupied
    if (!this._slots.every(s => s.mineral !== null)) {
      this._showFeedback('모든 슬롯에 광물을 먼저 넣어주세요', 0xe67e22);
      return;
    }

    // Guard: experiment progress + clue count check
    const check = this.mineralManager.canSubmitKey();
    if (!check.allowed) {
      this._showNotePopup(
        `제출할 수 없습니다.\n\n${check.reason}\n\n실험실로 돌아가 더 많은 실험을 진행하세요.`,
        '실험 증거 부족'
      );
      return;
    }

    // Validate (order-independent match against keyMinerals)
    const mineralIds = this._slots.map(s => s.mineral.id);
    const correct = this.mineralManager.checkAllSlots(mineralIds);

    if (correct) {
      // ── Success ──────────────────────────────────────────────────────────
      AudioManager.instance.playSFX('door_open');
      this._slotLEDs?.forEach(led => this._drawLED(led, true));
      this._showFeedback('탈출 성공!', 0x27ae60);
      this._escapeTimeout = setTimeout(() => this._escape(), 1500);
    } else {
      // ── Failure — generic only, no per-slot hints ─────────────────────
      AudioManager.instance.playSFX('door_locked');
      const attemptsLeft = this.mineralManager.getSubmitAttemptsLeft();
      this._slots.forEach(s => this._shakeSlot(s));

      if (attemptsLeft <= 0) {
        this._showNotePopup(
          '조합이 틀렸습니다.\n\n모든 시도 횟수를 소진했습니다.\n실험실로 돌아가 단서를 다시 확인해보세요.',
          '탈출 실패'
        );
      } else {
        this._showNotePopup(
          `조합이 틀렸습니다.\n\n남은 시도: ${attemptsLeft}회\n\n실험 도감을 다시 확인하고 단서와 비교해보세요.`,
          '조합 오류'
        );
      }

      this._updateSubmitButton();
    }
  }

  // ─── Clue panel (right side) ──────────────────────────────────────────────

  /**
   * Builds a right-side panel listing the 3 mineral hints revealed in LabScene.
   * Uses mineralManager.getHintPanelState() to show Stage 1 and Stage 2 hints.
   */
  _buildCluePanel(W, H) {
    const PX = 930, PY = 86, PW = 310, PH = 450;
    const TY = 58;
    const PANEL_H = Math.floor((PH - TY - 12) / 3);

    const panel = new PIXI.Container();
    panel.position.set(PX, PY);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x08111a, 0.95);
    bg.lineStyle(1, 0x315f82, 0.9);
    bg.drawRoundedRect(0, 0, PW, PH, 16);
    bg.endFill();
    panel.addChild(bg);

    // Header background
    const headerBg = new PIXI.Graphics();
    headerBg.beginFill(0x0d1b2a, 0.95);
    headerBg.drawRoundedRect(0, 0, PW, 48, 16);
    headerBg.drawRect(0, 24, PW, 24);
    headerBg.endFill();
    panel.addChild(headerBg);

    const hdrTxt = new PIXI.Text('발견한 단서', {
      fontFamily: 'Arial', fontSize: 16, fill: 0xf0c080, fontWeight: 'bold',
    });
    hdrTxt.position.set(16, 12);
    panel.addChild(hdrTxt);

    const states = this.mineralManager.getHintPanelState();
    const discoveredCount = states.filter(s => s.level > 0).length;

    const hdrSub = new PIXI.Text(`열쇠 광물 힌트 · ${discoveredCount}개 발견됨`, {
      fontFamily: 'Arial', fontSize: 10, fill: 0x5d88a9,
    });
    hdrSub.position.set(16, 30);
    panel.addChild(hdrSub);

    states.forEach((state, i) => {
      const yOff = TY + i * (PANEL_H + 4);
      const unlocked = state.level > 0;
      const expanded = state.level > 1;

      const rowBg = new PIXI.Graphics();
      if (unlocked) {
        rowBg.beginFill(0x0a2218, 0.92);
        rowBg.lineStyle(1.5, 0x27ae60, 0.6);
      } else {
        rowBg.beginFill(0x0c1b28, 0.92);
        rowBg.lineStyle(1, 0x1e3a52, 0.5);
      }
      rowBg.drawRoundedRect(8, yOff, PW - 16, PANEL_H, 8);
      rowBg.endFill();
      panel.addChild(rowBg);

      // Numbered badge
      const badge = new PIXI.Graphics();
      badge.beginFill(unlocked ? 0x27ae60 : 0x1a3a5c, 0.9);
      badge.drawCircle(0, 0, 10);
      badge.endFill();
      badge.position.set(24, yOff + 18);
      panel.addChild(badge);

      const numTxt = new PIXI.Text(`${i + 1}`, {
        fontFamily: 'Arial', fontSize: 10, fill: unlocked ? 0xffffff : 0xaaccee, fontWeight: 'bold',
      });
      numTxt.anchor.set(0.5, 0.5);
      numTxt.position.set(24, yOff + 18);
      panel.addChild(numTxt);

      if (!unlocked) {
        const lockTxt = new PIXI.Text('힌트 잠김', {
          fontFamily: 'Arial', fontSize: 12, fill: 0x3a5a7a,
        });
        lockTxt.anchor.set(0.5, 0.5);
        lockTxt.position.set(PW / 2, yOff + PANEL_H / 2);
        panel.addChild(lockTxt);
      } else {
        const lines = [`• 1단계 힌트: ${state.stage1}`];
        if (expanded) {
          lines.push(`• 2단계 힌트: ${state.stage2}`);
        }

        const clueTxt = new PIXI.Text(lines.join('\n\n'), {
          fontFamily: 'Arial', fontSize: 14, fill: 0xcce4ff,
          wordWrap: true, wordWrapWidth: PW - 54, lineHeight: 20,
        });
        clueTxt.position.set(42, yOff + 8);
        panel.addChild(clueTxt);
      }
    });

    this.container.addChild(panel);
    this._cluePanel = panel;
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────

  _buildFeedback(W, H) {
    this._feedbackText = new PIXI.Text('', {
      fontFamily: 'Arial', fontSize: 16, fill: 0xe74c3c, fontWeight: 'bold',
    });
    this._feedbackText.anchor.set(0.5, 0);
    this._feedbackText.position.set(W / 2, DOOR_CENTER_Y + DOOR_LAYOUT.feedbackOffsetY);
    this.container.addChild(this._feedbackText);
  }

  _showFeedback(m, c) {
    this._feedbackText.text = m;
    this._feedbackText.style.fill = c;
    this._feedbackText.alpha = 1;
    if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout);
    this._feedbackTimeout = setTimeout(() => {
      if (this._feedbackText && !this._feedbackText.destroyed) {
        this._feedbackText.alpha = 0;
      }
      this._feedbackTimeout = null;
    }, 2500);
  }

  _showNotePopup(text, title) {
    const pop = new NotePopup(this.sceneManager.app, text, title);
    pop.onClose(() => { this._popup = null; });
    this._popup = pop;
    this.container.addChild(pop.container);
  }

  _shakeSlot(slot) {
    const app = this.sceneManager.app;
    const ox = slot.container.x;
    let elapsed = 0;
    const tick = (delta) => {
      elapsed += delta;
      slot.container.x = ox + Math.sin(elapsed * 1.2) * 6;
      if (elapsed > 20) { slot.container.x = ox; app.ticker.remove(tick); }
    };
    app.ticker.add(tick);
  }

  _escape() {
    const condition = this.statusManager.determineEnding();
    this.statusManager.stopTimer();
    this.sceneManager.changeScene('result', {
      condition,
      statusManager: this.statusManager,
      mineralManager: this.mineralManager,
    });
  }

  // ─── Navigation buttons ───────────────────────────────────────────────────

  _buildBackButton(W, H) {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2e4057);
    bg.drawRoundedRect(0, 0, 100, 34, 8);
    bg.endFill();
    btn.addChild(bg);
    const txt = new PIXI.Text('← 돌아가기', { fontFamily: 'Arial', fontSize: 13, fill: 0xaabbcc });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(50, 17);
    btn.addChild(txt);
    btn.position.set(20, 20);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => {
      this.statusManager?.resumeTimer?.();
      this.sceneManager.changeScene('lab', {
        statusManager: this.statusManager,
        mineralManager: this.mineralManager,
        safetySystem: this.safetySystem,
      });
    });
    this.container.addChild(btn);
  }

  // ─── Logbook panel (experiment record, kept from original) ────────────────

  _buildLogbookPanel(W, H) {
    const PX = 20, PY = 86, PW = 340, PH = 408;
    const panel = new PIXI.Container();
    panel.position.set(PX, PY);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x08111a, 0.95);
    bg.lineStyle(1, 0x315f82, 0.9);
    bg.drawRoundedRect(0, 0, PW, PH, 16);
    bg.endFill();
    panel.addChild(bg);

    const headerBg = new PIXI.Graphics();
    headerBg.beginFill(0x0d1b2a, 0.95);
    headerBg.drawRoundedRect(0, 0, PW, 48, 16);
    headerBg.drawRect(0, 24, PW, 24);
    headerBg.endFill();
    panel.addChild(headerBg);

    const hdrTxt = new PIXI.Text('실험 도감', {
      fontFamily: 'Arial', fontSize: 16, fill: 0x9dd8ff, fontWeight: 'bold',
    });
    hdrTxt.position.set(16, 12);
    panel.addChild(hdrTxt);

    const hdrSub = new PIXI.Text('실험실에서 기록된 결과', {
      fontFamily: 'Arial', fontSize: 12, fill: 0x5d88a9,
    });
    hdrSub.position.set(16, 30);
    panel.addChild(hdrSub);

    const COLS = [
      { key: 'name',     w: 80, label: '광물' },
      { key: 'color',    w: 46, label: '색' },
      { key: 'streak',   w: 48, label: '조흔' },
      { key: 'acid',     w: 54, label: '염산' },
      { key: 'magnet',   w: 44, label: '자성' },
      { key: 'hardness', w: 48, label: '긁힘' },
    ];
    const NO_HARDNESS = ['feldspar', 'biotite', 'magnetite'];
    const ROW_H = 62, HDR_H = 28, TX = 10, TY = 58;
    const tableW = COLS.reduce((s, c) => s + c.w, 0);

    const headerRow = new PIXI.Graphics();
    headerRow.beginFill(0x0f2234, 0.95);
    headerRow.drawRoundedRect(TX, TY, tableW, HDR_H, 10);
    headerRow.endFill();
    panel.addChild(headerRow);

    let colX = TX;
    COLS.forEach(col => {
      const t = new PIXI.Text(col.label, {
        fontFamily: 'Arial', fontSize: 12, fill: 0x78b8de, fontWeight: 'bold',
      });
      t.anchor.set(0.5, 0.5);
      t.position.set(colX + col.w / 2, TY + HDR_H / 2);
      panel.addChild(t);
      colX += col.w;
    });

    const records = this.mineralManager.getAllRecords();
    const fmtMap = {
      color: (r, mid) => {
        if (!this.mineralManager.isColorRevealed(mid)) return { text: '?', color: 0x2e4057 };
        const m = this.mineralManager.getMineral(mid);
        return { text: m?.colorLabel ?? '?', color: 0x9dd8ff };
      },
      streak: (r) => r.streakTested
        ? { text: ({ none: '없음', white: '흰색', black: '검정' })[r.streakColor] || r.streakColor, color: 0x73e2a7 }
        : { text: '?', color: 0x2e4057 },
      acid: (r) => r.acidTested
        ? { text: r.acidReacted ? '거품✓' : '무반응', color: r.acidReacted ? 0xf3b562 : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      magnet: (r) => r.magnetTested
        ? { text: r.magnetic ? '있음✓' : '없음', color: r.magnetic ? 0xc792ea : 0x90a4b8 }
        : { text: '?', color: 0x2e4057 },
      hardness: (r, mid) => {
        if (NO_HARDNESS.includes(mid)) return { text: '해당없음', color: 0x4a6580 };
        if (!r.hardnessTested) return { text: '?', color: 0x2e4057 };
        return { text: r.hardness === 'high' ? '없음' : '있음', color: 0x55d6c2 };
      },
    };

    MINERALS.forEach((mineral, ri) => {
      const rowY = TY + HDR_H + 8 + ri * ROW_H;
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(ri % 2 === 0 ? 0x102231 : 0x0c1b28, 0.92);
      rowBg.drawRoundedRect(TX, rowY, tableW, ROW_H - 6, 12);
      rowBg.endFill();
      panel.addChild(rowBg);

      const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
      sprite.anchor.set(0.5);
      sprite.width = 24;
      sprite.height = 24;
      sprite.position.set(TX + 16, rowY + 28);
      panel.addChild(sprite);

      const nmTxt = new PIXI.Text(mineral.name, {
        fontFamily: 'Arial', fontSize: 13, fill: 0xddeeff, fontWeight: 'bold',
      });
      nmTxt.anchor.set(0, 0.5);
      nmTxt.position.set(TX + 32, rowY + 22);
      panel.addChild(nmTxt);

      const rec = records[mineral.id] || {};
      let cx = TX + COLS[0].w;
      COLS.slice(1).forEach(col => {
        const { text, color } = fmtMap[col.key](rec, mineral.id);
        const cell = new PIXI.Text(text, {
          fontFamily: 'Arial', fontSize: 12, fill: color,
          fontWeight: text !== '?' ? 'bold' : 'normal',
        });
        cell.anchor.set(0.5, 0.5);
        cell.position.set(cx + col.w / 2, rowY + 28);
        panel.addChild(cell);
        cx += col.w;
      });
    });

    this.container.addChild(panel);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async onExit() {
    AudioManager.instance.stopBGM();
    if (this._stageMove) this.sceneManager.app.stage.off('pointermove', this._stageMove);
    if (this._escapeTimeout) {
      clearTimeout(this._escapeTimeout);
      this._escapeTimeout = null;
    }
    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout);
      this._feedbackTimeout = null;
    }
    this._slots = [];
    this._cards = [];
    this._dragging = null;
    this._submitBtn = null;
    this._attemptsText = null;
    this._cluePanel = null;
  }
}
