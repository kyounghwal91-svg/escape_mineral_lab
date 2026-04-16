import * as PIXI from 'pixi.js';
import { BaseScene } from '../core/BaseScene.js';
import { AudioManager } from '../systems/AudioManager.js';
import { SafetySystem } from '../systems/SafetySystem.js';
import { StatusManager } from '../systems/StatusManager.js';
import { MineralManager } from '../systems/MineralManager.js';
import { UIManager } from '../ui/UIManager.js';

const W = 1280, H = 720;

// 장비 정의: 위에서부터 mask_goggles, gloves, lab_coat 순서
const EQUIPMENT = [
  { id: 'goggles', name: '보안경', imgFile: 'mask_goggles.png' },
  { id: 'gloves',  name: '장갑',   imgFile: 'gloves.png'       },
  { id: 'coat',    name: '실험복', imgFile: 'lab_coat.png'     },
];

// 착용 조합 → 캐릭터 스프라이트 (goggles+gloves+coat 순으로 정렬된 키)
const CHAR_SPRITES = {
  '':                    'images/character_base.png',
  'goggles':             'images/character_mask.png',
  'gloves':              'images/character_gloves.png',
  'coat':                'images/character_labcoat.png',
  'goggles+gloves':      'images/character_mask_gloves.png',
  'goggles+coat':        'images/charater_mask_labcoat.png',
  'gloves+coat':         'images/character_labcoat_gloves.png',
  'goggles+gloves+coat': 'images/character_mask_gloves_labcoat.png',
};
const CHAR_SPRITE_ORDER = ['goggles', 'gloves', 'coat'];
function charSpriteKey(wornSet) {
  return CHAR_SPRITE_ORDER.filter(id => wornSet.has(id)).join('+');
}

// 드롭 슬롯 정의 (캐릭터 그룹 중심 기준 상대 좌표, 캐릭터 height=520 기준)
const SLOT_R = 38;
const SLOT_DEFS = [
  { id: 'face',      equipId: 'goggles', label: '얼굴',   relX: 0,   relY: -55,  r: SLOT_R * 2 },
  { id: 'leftHand',  equipId: 'gloves',  label: '왼손',   relX: -68, relY: 142,  r: SLOT_R     },
  { id: 'rightHand', equipId: 'gloves',  label: '오른손', relX:  68, relY: 142,  r: SLOT_R     },
  { id: 'body',      equipId: 'coat',    label: '몸통',   relX: 0,   relY: 130,  r: SLOT_R * 2 },
];

// 장비 아이템 세로 배치 (왼쪽 패널)
const ITEM_X  = 1125;
const ITEM_Y0 = 195;
const ITEM_GAP = 155;
const ITEM_W  = 110;
const ITEM_H  = 130;

// 드래그 글로우 감지 거리
const GLOW_DIST = SLOT_R + 70;

// 캐릭터 표시 스케일 (기준 height 1125px 기준, 표시 height ≈ 676px = 520 × 1.3)
const CHAR_SCALE = 676 / 1125;

export default class EquipmentScene extends BaseScene {
  constructor() {
    super();
    this.safetySystem   = null;
    this.statusManager  = null;
    this.mineralManager = null;
    this.uiManager      = null;
    this._items  = [];
    this._slots  = [];
    this._dragging   = null;
    this._stageMove  = null;
    this._stageUp    = null;
    this._enterBtn   = null;
    this._statusText = null;
    this._monitorFadeTimeout    = null;
    this._monitorFadeOutTicker  = null;
    this._monitorEffectTicker   = null;
    this._monitorFadeInTicker   = null;
    this._charGroupOrigin = { x: W / 2, y: H / 2 - 40 };
    this._wornSet = new Set();   // 현재 착용 중인 장비 ID 집합
    this._charSprite = null;     // 현재 표시 중인 캐릭터 스프라이트
    this._allMissionChecked = false;
    this._missionCheckboxes = [];
    this._missionFooter = null;
  }

  async onEnter(data = {}) {
    await super.onEnter(data);

    await PIXI.Assets.load([
      'images/equipment_bg.png',
      'images/character_base.png',
      'images/character_mask.png',
      'images/character_gloves.png',
      'images/character_labcoat.png',
      'images/character_mask_gloves.png',
      'images/charater_mask_labcoat.png',
      'images/character_labcoat_gloves.png',
      'images/character_mask_gloves_labcoat.png',
      'images/monitor.png',
      'images/scientist_uppper_body.png',
      'images/mask_goggles.png',
      'images/gloves.png',
      'images/lab_coat.png',
    ]);

    this.safetySystem  = data.safetySystem  ?? new SafetySystem();
    this.statusManager = data.statusManager ?? new StatusManager();
    this.uiManager = new UIManager(this.sceneManager.app, this.statusManager);
    this.uiManager.init();

    if (data.mineralManager) {
      this.mineralManager = data.mineralManager;
    } else {
      this.mineralManager = new MineralManager();
      this.mineralManager.init();
    }

    this._buildBackground();
    this._buildMissionPanel();
    this._buildCharacter();
    this._buildSlots();
    this._buildItems();
    this._buildEnterButton();
    this._buildStatusText();
    this._buildGuide();

    if (data.fromLab) {
      this._allMissionChecked = true;
      this._missionCheckboxes.forEach(cb => {
        cb.checked = true;
        this._drawCheckbox(cb.gfx, true);
      });
    } else {
      this._showMonitorIntro();
    }

    // 이미 착용 중인 장비 복원
    for (const eq of EQUIPMENT) {
      if (this.safetySystem.isWearing(eq.id)) {
        this._slots
          .filter(s => s.equipId === eq.id)
          .forEach(s => { s.filled = true; s.container.visible = false; });
        const item = this._items.find(i => i.id === eq.id);
        if (item) item.container.visible = false;
        this._wornSet.add(eq.id);
      }
    }
    this._applyCharSprite(false); // 복원 시 즉시 교체 (애니 없음)
    this._refreshUI();

    AudioManager.instance.playBGM('equipment');
  }

  update(delta) {
    if (this.uiManager) this.uiManager.update(delta);
  }

  // ─── 배경 ─────────────────────────────────────────────────────────
  _buildBackground() {
    const bg = PIXI.Sprite.from('images/equipment_bg.png');
    bg.width = W; bg.height = H;
    this.container.addChild(bg);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.5);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    this.container.addChild(dim);

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0x0d1b2a, 0.7);
    titleBg.drawRect(0, 0, W, 75);
    titleBg.endFill();
    this.container.addChild(titleBg);

    const title = new PIXI.Text('실험 준비 - 안전 장비 착용', {
      fontFamily: 'Arial', fontSize: 24, fill: 0xf0b429, fontWeight: 'bold',
      dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2,
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(W / 2, 38);
    this.container.addChild(title);
  }

  // ─── 미션 패널 (왼쪽) ─────────────────────────────────────────────
  _buildMissionPanel() {
    const PX = 45, PY = 85, PW = 285, PH = 555;

    // 종이 배경
    const paper = new PIXI.Graphics();
    paper.beginFill(0xf5ecd7);
    paper.lineStyle(2, 0x7a5c1e, 1);
    paper.drawRoundedRect(PX, PY, PW, PH, 6);
    paper.endFill();
    this.container.addChild(paper);

    // 줄 무늬 (노트 느낌)
    const ruled = new PIXI.Graphics();
    ruled.lineStyle(1, 0xc9a96e, 0.2);
    for (let y = PY + 54; y < PY + PH - 10; y += 20) {
      ruled.moveTo(PX + 10, y);
      ruled.lineTo(PX + PW - 10, y);
    }
    this.container.addChild(ruled);

    // 헤더
    const hdr = new PIXI.Graphics();
    hdr.beginFill(0x3d2b08);
    hdr.drawRoundedRect(PX, PY, PW, 46, 6);
    hdr.beginFill(0x3d2b08);
    hdr.drawRect(PX, PY + 30, PW, 16); // 하단 모서리 직각 처리
    hdr.endFill();
    this.container.addChild(hdr);

    const hdrTxt = new PIXI.Text('📋 미션 지령서', {
      fontFamily: 'Arial', fontSize: 16, fill: 0xfdf0c0, fontWeight: 'bold',
    });
    hdrTxt.anchor.set(0.5, 0.5);
    hdrTxt.position.set(PX + PW / 2, PY + 23);
    this.container.addChild(hdrTxt);

    const MISSIONS = [
      '찾아야 하는 광물은\n세 개.',
      '실험으로 광물의\n특징을 파악하자.',
      '탈출구로 가서\n광물을 제출하자.',
      '제출 기회는\n단 세 번뿐.',
    ];

    const ITEM_START_Y = PY + 50;
    const ITEM_H = 116;
    this._missionCheckboxes = [];

    MISSIONS.forEach((text, i) => {
      const iy = ITEM_START_Y + i * ITEM_H;

      // 구분선
      if (i > 0) {
        const div = new PIXI.Graphics();
        div.lineStyle(1, 0xc9a96e, 0.45);
        div.moveTo(PX + 14, iy);
        div.lineTo(PX + PW - 14, iy);
        this.container.addChild(div);
      }

      // 번호 뱃지 (좌우 마진 1.5배: left=18, right=12)
      const badge = new PIXI.Graphics();
      badge.beginFill(0x3d2b08, 0.13);
      badge.lineStyle(1.5, 0x7a5c1e, 0.7);
      badge.drawCircle(0, 0, 14);
      badge.endFill();
      badge.position.set(PX + 32, iy + 58);
      this.container.addChild(badge);

      const numTxt = new PIXI.Text(`${i + 1}`, {
        fontFamily: 'Arial', fontSize: 13, fill: 0x3d2b08, fontWeight: 'bold',
      });
      numTxt.anchor.set(0.5, 0.5);
      numTxt.position.set(PX + 32, iy + 58);
      this.container.addChild(numTxt);

      // 미션 텍스트 (fontSize 20, 2줄 중심이 뱃지 중심과 세로 정렬)
      // lineHeight=26, 2줄 높이=52, 세로 중심=text_y+26 → iy+32+26=iy+58 (뱃지와 일치)
      const mTxt = new PIXI.Text(text, {
        fontFamily: 'Arial', fontSize: 20, fill: 0x2c1a06,
        wordWrap: true, wordWrapWidth: 162, lineHeight: 26,
      });
      mTxt.position.set(PX + 58, iy + 32);
      this.container.addChild(mTxt);

      // 체크박스
      const cb = new PIXI.Graphics();
      this._drawCheckbox(cb, false);
      cb.position.set(PX + PW - 38, iy + 46);
      cb.eventMode = 'static';
      cb.cursor = 'pointer';
      this.container.addChild(cb);

      this._missionCheckboxes.push({ gfx: cb, checked: false });

      cb.on('pointerdown', (e) => {
        e.stopPropagation();
        const box = this._missionCheckboxes[i];
        box.checked = !box.checked;
        this._drawCheckbox(cb, box.checked);
        this._allMissionChecked = this._missionCheckboxes.every(b => b.checked);
        this._refreshUI();
        AudioManager.instance.playSFX('btn_click');
      });
    });

    // 하단 안내 텍스트
    this._missionFooter = new PIXI.Text('모든 항목을 확인해주세요', {
      fontFamily: 'Arial', fontSize: 12, fill: 0x8b6914, fontStyle: 'italic',
    });
    this._missionFooter.anchor.set(0.5, 0);
    this._missionFooter.position.set(PX + PW / 2, PY + PH - 28);
    this.container.addChild(this._missionFooter);
  }

  _drawCheckbox(gfx, checked) {
    gfx.clear();
    if (checked) {
      gfx.beginFill(0x27ae60);
      gfx.lineStyle(2, 0x1e8449);
    } else {
      gfx.beginFill(0xfff5e0);
      gfx.lineStyle(2, 0x8b6914);
    }
    gfx.drawRoundedRect(0, 0, 24, 24, 4);
    gfx.endFill();
    if (checked) {
      gfx.lineStyle(3, 0xffffff);
      gfx.moveTo(4, 12);
      gfx.lineTo(10, 18);
      gfx.lineTo(20, 6);
    }
  }

  // ─── 캐릭터 ───────────────────────────────────────────────────────
  _buildCharacter() {
    const { x, y } = this._charGroupOrigin;
    this._characterGroup = new PIXI.Container();
    this._characterGroup.position.set(x, y);
    this.container.addChild(this._characterGroup);

    this._charSprite = PIXI.Sprite.from('images/character_base.png');
    this._charSprite.anchor.set(0.5, 0.5);
    this._charSprite.scale.set(CHAR_SCALE);
    this._characterGroup.addChild(this._charSprite);
  }

  // ─── 드롭 슬롯 (원형) ─────────────────────────────────────────────
  _buildSlots() {
    const { x: ox, y: oy } = this._charGroupOrigin;

    for (const def of SLOT_DEFS) {
      const wx = ox + def.relX;
      const wy = oy + def.relY;
      const r  = def.r ?? SLOT_R;

      const cont = new PIXI.Container();
      cont.position.set(wx, wy);

      // 평상시 링 (노란색)
      const ring = new PIXI.Graphics();
      ring.lineStyle(4, 0xf0b429, 0.55);
      ring.beginFill(0xf0b429, 0.06);
      ring.drawCircle(0, 0, r);
      ring.endFill();
      // 은은한 외곽 헤일로
      ring.lineStyle(12, 0xf0b429, 0.1);
      ring.drawCircle(0, 0, r + 6);
      cont.addChild(ring);

      // 드래그 근접 시 글로우 (노란색, 기본 숨김)
      const glow = new PIXI.Graphics();
      glow.lineStyle(16, 0xffe066, 0.25);
      glow.drawCircle(0, 0, r + 14);
      glow.lineStyle(8, 0xf0b429, 0.7);
      glow.drawCircle(0, 0, r + 4);
      glow.lineStyle(4, 0xffd700, 1.0);
      glow.drawCircle(0, 0, r);
      glow.beginFill(0xf0b429, 0.12);
      glow.drawCircle(0, 0, r);
      glow.endFill();
      glow.visible = false;
      cont.addChild(glow);

      const lbl = new PIXI.Text(def.label, {
        fontFamily: 'Arial', fontSize: 11, fill: 0xffffff,
      });
      lbl.anchor.set(0.5, 0.5);
      lbl.alpha = 0.35;
      cont.addChild(lbl);

      this.container.addChild(cont);
      this._slots.push({
        container: cont, ring, glow,
        id: def.id, equipId: def.equipId,
        filled: false,
        x: wx, y: wy,
        radius: r,
      });
    }

    // 드롭 영역 깜빡임 ticker
    let blinkT = 0;
    this._slotBlinkTicker = (delta) => {
      blinkT += delta * 0.02;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(blinkT * Math.PI * 2));
      for (const slot of this._slots) {
        if (!slot.filled && !slot.glow.visible) {
          slot.ring.alpha = pulse;
        }
      }
    };
    this.sceneManager.app.ticker.add(this._slotBlinkTicker);
  }

  // ─── 장비 아이템 (왼쪽 세로 배치) ────────────────────────────────
  _buildItems() {
    EQUIPMENT.forEach((eq, i) => {
      const cy = ITEM_Y0 + i * ITEM_GAP;
      const item = this._createItem(eq, ITEM_X, cy);
      this._items.push(item);
      this.container.addChild(item.container);
      this._makeDraggable(item);
    });
  }

  _createItem(eq, cx, cy) {
    const cont = new PIXI.Container();
    cont.position.set(cx - ITEM_W / 2, cy - ITEM_H / 2);

    const bg = new PIXI.Graphics();
    bg.lineStyle(2, 0x5dadff, 0.8);
    bg.beginFill(0x1c2b3d, 0.95);
    bg.drawRoundedRect(0, 0, ITEM_W, ITEM_H, 10);
    bg.endFill();
    cont.addChild(bg);

    const icon = PIXI.Sprite.from(`images/${eq.imgFile}`);
    icon.anchor.set(0.5);
    icon.position.set(ITEM_W / 2, 50);
    const iconSize = 72;
    const scale = Math.min(iconSize / icon.texture.width, iconSize / icon.texture.height);
    icon.scale.set(scale);
    cont.addChild(icon);

    const txt = new PIXI.Text(eq.name, {
      fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, fontWeight: 'bold',
      dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
    });
    txt.anchor.set(0.5, 0);
    txt.position.set(ITEM_W / 2, 96);
    cont.addChild(txt);

    cont.eventMode = 'static';
    cont.cursor = 'grab';
    return {
      container: cont, id: eq.id, eq,
      originalX: cx - ITEM_W / 2,
      originalY: cy - ITEM_H / 2,
    };
  }

  // ─── 드래그 ───────────────────────────────────────────────────────
  _makeDraggable(item) {
    item.container.on('pointerdown', (e) => {
      if (this._dragging) return;
      this._dragging = item;
      // PixiJS v7 API: ev.getLocalPosition()
      const pos = e.getLocalPosition(this.container);
      this._dragging.offX = pos.x - item.container.x;
      this._dragging.offY = pos.y - item.container.y;
      this.container.addChild(item.container); // 최상단으로

      this._stageMove = (ev) => {
        if (!this._dragging) return;
        const p = ev.getLocalPosition(this.container);
        item.container.x = p.x - this._dragging.offX;
        item.container.y = p.y - this._dragging.offY;
        this._updateSlotGlows(item);
      };
      this._stageUp = () => {
        if (!this._dragging) return;
        this._dragging = null;
        this.sceneManager.app.stage.off('pointermove', this._stageMove);
        this.sceneManager.app.stage.off('pointerup', this._stageUp);
        // 모바일: 손가락이 캔버스 밖에서 떼어질 때 fallback
        window.removeEventListener('pointerup', this._stageUp);
        this._clearSlotGlows();
        this._onDrop(item);
      };
      this.sceneManager.app.stage.on('pointermove', this._stageMove);
      this.sceneManager.app.stage.on('pointerup', this._stageUp);
      window.addEventListener('pointerup', this._stageUp, { once: true });
    });
  }

  // 드래그 중 슬롯 글로우 업데이트
  _updateSlotGlows(item) {
    const cx = item.container.x + ITEM_W / 2;
    const cy = item.container.y + ITEM_H / 2;

    for (const slot of this._slots) {
      if (slot.filled || slot.equipId !== item.id) {
        slot.glow.visible = false;
        continue;
      }
      const dist = Math.hypot(cx - slot.x, cy - slot.y);
      slot.glow.visible = dist < GLOW_DIST;
      if (slot.glow.visible) {
        slot.glow.alpha = Math.max(0.5, 1 - dist / GLOW_DIST);
      }
    }
  }

  _clearSlotGlows() {
    for (const slot of this._slots) slot.glow.visible = false;
  }

  // ─── 드롭 판정 ────────────────────────────────────────────────────
  _onDrop(item) {
    const hit = this._findSlotHit(item);
    if (hit && hit.equipId === item.id && !hit.filled) {
      // 같은 equipId의 슬롯 모두 닫기 (gloves는 양손 모두)
      this._slots
        .filter(s => s.equipId === item.id)
        .forEach(s => { s.filled = true; s.container.visible = false; });
      this._wornSet.add(item.id);
      this._applyCharSprite(true);
      this.safetySystem.wear(item.id);
      item.container.visible = false;
      this._refreshUI();
      if (this._wornSet.size === EQUIPMENT.length) {
        AudioManager.instance.playSFX('equip_complete');
      } else {
        AudioManager.instance.playSFX('equip_success');
      }
    } else {
      AudioManager.instance.playSFX('equip_fail');
    }
    this._snapBack(item);
  }

  _findSlotHit(item) {
    // getBounds()는 stage scale 영향을 받으므로 월드 좌표로 직접 계산
    const cx = item.container.x + ITEM_W / 2;
    const cy = item.container.y + ITEM_H / 2;

    // 1단계: 같은 equipId 슬롯 중 반경 내 가장 가까운 슬롯 탐색
    let best = null, bestDist = Infinity;
    for (const slot of this._slots) {
      if (slot.filled || slot.equipId !== item.id) continue;
      const dist = Math.hypot(cx - slot.x, cy - slot.y);
      if (dist < slot.radius + 45 && dist < bestDist) {
        best = slot; bestDist = dist;
      }
    }
    if (best) return best;

    // 2단계: 겹침 영역 폴백 — 드롭 위치가 어느 슬롯 영역 안에라도 있다면
    // 같은 equipId의 슬롯 중 가장 가까운 것으로 등록
    const inAnyZone = this._slots.some(
      s => !s.filled && Math.hypot(cx - s.x, cy - s.y) < s.radius + 45
    );
    if (inAnyZone) {
      let fallback = null, fallbackDist = Infinity;
      for (const slot of this._slots) {
        if (slot.filled || slot.equipId !== item.id) continue;
        const dist = Math.hypot(cx - slot.x, cy - slot.y);
        if (dist < fallbackDist) { fallback = slot; fallbackDist = dist; }
      }
      return fallback;
    }

    return null;
  }

  // ─── 캐릭터 스프라이트 교체 ──────────────────────────────────────
  _applyCharSprite(animate = true) {
    const key  = charSpriteKey(this._wornSet);
    const path = CHAR_SPRITES[key] ?? 'images/character_base.png';
    const tex  = PIXI.Texture.from(path);

    const setSize = (s) => { s.scale.set(CHAR_SCALE); };

    if (!animate) {
      this._charSprite.texture = tex;
      setSize(this._charSprite);
      return;
    }

    // 페이드 아웃 → 텍스처 교체 → 페이드 인
    const sprite = this._charSprite;
    let phase = 'out', t = 1;
    const ticker = (delta) => {
      if (phase === 'out') {
        t -= 0.15 * delta;
        if (t <= 0) {
          t = 0;
          sprite.texture = tex;
          setSize(sprite);
          phase = 'in';
        }
      } else {
        t += 0.15 * delta;
        if (t >= 1) {
          t = 1;
          this.sceneManager.app.ticker.remove(ticker);
        }
      }
      sprite.alpha = t;
    };
    this.sceneManager.app.ticker.add(ticker);
  }

  // ─── 스냅백 ───────────────────────────────────────────────────────
  _snapBack(item) {
    const app = this.sceneManager.app;
    const sx = item.container.x, sy = item.container.y;
    const tx = item.originalX,   ty = item.originalY;
    let t = 0;
    const tick = () => {
      t = Math.min(t + 0.14, 1);
      item.container.x = sx + (tx - sx) * t;
      item.container.y = sy + (ty - sy) * t;
      if (t >= 1) { item.container.x = tx; item.container.y = ty; app.ticker.remove(tick); }
    };
    app.ticker.add(tick);
  }

  // ─── 버튼 / 텍스트 ────────────────────────────────────────────────
  _buildEnterButton() {
    const cont = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2980b9);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.drawRoundedRect(0, 0, 260, 56, 14);
    bg.endFill();
    cont.addChild(bg);

    const txt = new PIXI.Text('실험실 입장 →', {
      fontFamily: 'Arial', fontSize: 20, fill: 0xffffff, fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);
    txt.position.set(130, 28);
    cont.addChild(txt);

    cont.position.set(W / 2 - 130, H - 120);
    cont.eventMode = 'static';
    cont.cursor = 'pointer';
    cont.on('pointerover', () => { bg.tint = 0x85c1e9; });
    cont.on('pointerout',  () => { bg.tint = 0xffffff; });
    cont.on('pointerdown', () => this._onEnterBtnClick());
    this.container.addChild(cont);
    this._enterBtn = cont;
  }

  _onEnterBtnClick() {
    if (!this._allMissionChecked) {
      this.uiManager.showDialogue('미션 지령서의 모든 항목을 먼저 확인해주세요!');
      return;
    }
    AudioManager.instance.playSFX('btn_click');
    this.sceneManager?.changeScene('lab', {
      statusManager:  this.statusManager,
      mineralManager: this.mineralManager,
      safetySystem:   this.safetySystem,
    });
  }

  _buildStatusText() {
    this._statusText = new PIXI.Text('0 / 3 착용 완료', {
      fontFamily: 'Arial', fontSize: 16, fill: 0xffffff, fontWeight: 'bold',
      dropShadow: true, dropShadowColor: 0x000000, dropShadowBlur: 4, dropShadowDistance: 2,
    });
    this._statusText.anchor.set(0.5, 0);
    this._statusText.position.set(W / 2, H - 160);
    this.container.addChild(this._statusText);
  }

  _buildGuide() {
    const txt = new PIXI.Text('보호구를 드래그하여 슬롯에 장착하세요', {
      fontFamily: 'Arial', fontSize: 14, fill: 0xddeeff, fontWeight: 'bold',
      dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
    });
    txt.anchor.set(0.5, 0);
    txt.position.set(W / 2, 90);
    this.container.addChild(txt);
  }

  _refreshUI() {
    const count = EQUIPMENT.filter(eq => this.safetySystem.isWearing(eq.id)).length;
    if (this._statusText) {
      this._statusText.text = `${count} / 3 착용 완료`;
      this._statusText.style.fill = count === 3 ? 0x2ecc71 : 0xf1948a;
    }
    if (this._enterBtn) {
      const bg  = this._enterBtn.getChildAt(0);
      const txt = this._enterBtn.getChildAt(1);
      if (!this._allMissionChecked) {
        bg.tint = 0x7f8c8d; txt.text = '미션을 먼저 확인하세요';
      } else if (count === 3) {
        bg.tint = 0xffffff; txt.text = '완벽해! 실험실 입장 →';
      } else {
        bg.tint = 0xe74c3c; txt.text = '이대로 입장 (위험!)';
      }
    }
    if (this._missionFooter) {
      if (this._allMissionChecked) {
        this._missionFooter.text = '✓ 확인 완료!';
        this._missionFooter.style.fill = 0x27ae60;
      } else {
        this._missionFooter.text = '모든 항목을 확인해주세요';
        this._missionFooter.style.fill = 0x8b6914;
      }
    }
  }

  // ─── 모니터 인트로 연출 ────────────────────────────────────────────
  async _showMonitorIntro() {
    await PIXI.Assets.load(['images/monitor.png', 'images/scientist_uppper_body.png']);

    const monitorCont = new PIXI.Container();
    monitorCont.alpha = 0;
    this.container.addChild(monitorCont);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.75);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    monitorCont.addChild(dim);

    const midX = W / 2, midY = H / 2 - 20;
    const monitor = PIXI.Sprite.from('images/monitor.png');
    monitor.anchor.set(0.5);
    monitor.position.set(midX, midY);
    monitor.width = 640;
    monitor.scale.y = monitor.scale.x;
    monitorCont.addChild(monitor);

    const screenW = 450, screenH = 320, screenOffsetY = -15;
    const screenX = midX, screenY = midY + screenOffsetY;

    const screenMask = new PIXI.Graphics();
    screenMask.beginFill(0xffffff);
    screenMask.drawRect(screenX - screenW / 2, screenY - screenH / 2, screenW, screenH);
    screenMask.endFill();
    monitorCont.addChild(screenMask);

    const screenCont = new PIXI.Container();
    screenCont.mask = screenMask;
    monitorCont.addChild(screenCont);

    const scientist = PIXI.Sprite.from('images/scientist_uppper_body.png');
    scientist.anchor.set(0.5, 0.5);
    scientist.position.set(screenX, screenY + 20);
    const finalScale = Math.max(screenW / scientist.width, screenH / scientist.height) * 1.5;
    scientist.scale.set(finalScale);
    scientist.tint = 0xade8ff;
    screenCont.addChild(scientist);

    const effectLayer = new PIXI.Graphics();
    screenCont.addChild(effectLayer);

    let tick = 0;
    const updateEffect = (delta) => {
      tick += delta;
      effectLayer.clear();
      effectLayer.lineStyle(1, 0x000000, 0.12);
      for (let y = screenY - screenH / 2 + ((tick % 30) * (screenH / 30)) % screenH; y < screenY + screenH / 2; y += 12) {
        effectLayer.moveTo(screenX - screenW / 2, y);
        effectLayer.lineTo(screenX + screenW / 2, y);
      }
      if (Math.random() > 0.97) {
        scientist.alpha = 0.5 + Math.random() * 0.5;
        scientist.x = screenX + (Math.random() - 0.5) * 8;
        effectLayer.beginFill(0xffffff, 0.05);
        effectLayer.drawRect(screenX - screenW / 2, screenY - screenH / 2 + Math.random() * screenH, screenW, 2);
        effectLayer.endFill();
      } else {
        scientist.alpha = 0.98; scientist.x = screenX;
      }
    };
    this.sceneManager.app.ticker.add(updateEffect);
    this._monitorEffectTicker = updateEffect;

    let fadeT = 0;
    const fadeIn = () => {
      fadeT += 0.05;
      monitorCont.alpha = Math.min(fadeT, 1);
      if (fadeT >= 1) {
        this.sceneManager.app.ticker.remove(fadeIn);
        this._monitorFadeInTicker = null;
        this.uiManager.showDialogue(
          '흐흐흐... 10분 안에 열쇠 광물 3개를 찾아 문에 끼워넣지 못하면 넌 내 영원한 실험체가 될 것이다!'
        );

        // onComplete 안이 아닌 즉시 등록 — 타이핑 중 클릭해도 모니터가 반드시 닫힘
        const checkDismiss = () => {
          if (!this.uiManager._dialogBox.visible) {
            this.sceneManager.app.ticker.remove(checkDismiss);
            let outT = 1;
            const fadeOut = () => {
              outT -= 0.04;
              monitorCont.alpha = Math.max(outT, 0);
              if (outT <= 0) {
                this.sceneManager.app.ticker.remove(fadeOut);
                this.sceneManager.app.ticker.remove(updateEffect);
                this._monitorFadeOutTicker = null;
                this._monitorEffectTicker = null;
                if (monitorCont.parent) this.container.removeChild(monitorCont);
                monitorCont.destroy({ children: true });
              }
            };
            this._monitorFadeOutTicker = fadeOut;
            this.sceneManager.app.ticker.add(fadeOut);
          }
        };
        this.sceneManager.app.ticker.add(checkDismiss);
      }
    };
    AudioManager.instance.playSFX('monitor_on');
    this._monitorFadeInTicker = fadeIn;
    this.sceneManager.app.ticker.add(fadeIn);
  }

  // ─── 정리 ─────────────────────────────────────────────────────────
  async onExit() {
    AudioManager.instance.stopBGM();

    if (this.uiManager) {
      this.uiManager.destroy();
      this.uiManager = null;
    }

    if (this._stageMove) {
      this.sceneManager.app.stage.off('pointermove', this._stageMove);
      this._stageMove = null;
    }
    if (this._stageUp) {
      this.sceneManager.app.stage.off('pointerup', this._stageUp);
      window.removeEventListener('pointerup', this._stageUp);
      this._stageUp = null;
    }
    if (this._slotBlinkTicker) { this.sceneManager.app.ticker.remove(this._slotBlinkTicker); this._slotBlinkTicker = null; }
    if (this._monitorFadeTimeout)   { clearTimeout(this._monitorFadeTimeout); this._monitorFadeTimeout = null; }
    if (this._monitorEffectTicker)  { this.sceneManager.app.ticker.remove(this._monitorEffectTicker);  this._monitorEffectTicker = null; }
    if (this._monitorFadeInTicker)  { this.sceneManager.app.ticker.remove(this._monitorFadeInTicker);  this._monitorFadeInTicker = null; }
    if (this._monitorFadeOutTicker) { this.sceneManager.app.ticker.remove(this._monitorFadeOutTicker); this._monitorFadeOutTicker = null; }
    this.uiManager?.destroy();
    this._items = []; this._slots = [];
  }
}
