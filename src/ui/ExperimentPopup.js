import * as PIXI from 'pixi.js';
import { ScratchEffect } from '../effects/ScratchEffect.js';
import { AcidEffect } from '../effects/AcidEffect.js';
import { MagnetEffect } from '../effects/MagnetEffect.js';

const POP_W = 760, POP_H = 640;

export class ExperimentPopup {
  constructor(app, { mineral, experimentType, statusManager, mineralManager, safetySystem, uiManager }) {
    this.app = app;
    this.mineral = mineral;
    this.experimentType = experimentType;
    this.statusManager = statusManager;
    this.mineralManager = mineralManager;
    this.safetySystem = safetySystem;
    this.uiManager = uiManager;

    this.container = new PIXI.Container();
    this._effect = null;
    this._resultBadge = null;
    this._onClose = null;
    this._ppeWarning = null;

    this._build();
  }

  _build() {
    const W = 1280, H = 720;
    const px = (W - POP_W) / 2;  // 260
    const py = (H - POP_H) / 2;  // 120
    const midX = px + POP_W / 2;

    // 어두운 반투명 오버레이 (클릭 차단)
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.65);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.container.addChild(overlay);

    // 팝업 박스
    const box = new PIXI.Graphics();
    box.lineStyle(2, 0x2e86c1, 0.8);
    box.beginFill(0x1a2332);
    box.drawRoundedRect(0, 0, POP_W, POP_H, 12);
    box.endFill();
    box.position.set(px, py);
    this.container.addChild(box);

    const innerPanel = new PIXI.Graphics();
    innerPanel.beginFill(0xd6eaf8, 1);
    innerPanel.drawRoundedRect(0, 0, POP_W - 44, POP_H - 108, 18);
    innerPanel.endFill();
    innerPanel.position.set(px + 22, py + 74);
    this.container.addChild(innerPanel);

    // 헤더 배경
    const header = new PIXI.Graphics();
    header.beginFill(0x0d1b2a);
    header.drawRoundedRect(0, 0, POP_W - 2, 62, 11);
    header.endFill();
    header.position.set(px + 1, py + 1);
    this.container.addChild(header);

    // 헤더 강조선
    const accentColors = { streak: 0x27ae60, acid: 0xe67e22, magnet: 0x8e44ad };
    const accent = accentColors[this.experimentType] ?? 0x2e86c1;
    const accentLine = new PIXI.Graphics();
    accentLine.lineStyle(3, accent);
    accentLine.moveTo(px + 10, py + 62);
    accentLine.lineTo(px + POP_W - 10, py + 62);
    this.container.addChild(accentLine);

    // 도구 이름 맵
    const toolNames = { streak: '조흔판', acid: '묽은 염산', magnet: '클립' };

    // 광물 아이콘 추가
    const mineralIcon = PIXI.Sprite.from(`images/${this.mineral.id}.png`);
    mineralIcon.anchor.set(0, 0.5);
    mineralIcon.width = 32;
    mineralIcon.height = 32;
    mineralIcon.position.set(px + 20, py + 31);
    this.container.addChild(mineralIcon);

    // 제목
    const title = new PIXI.Text(
      `${this.mineral.name}  ×  ${toolNames[this.experimentType] ?? this.experimentType}`,
      { fontFamily: 'Arial', fontSize: 19, fill: accent, fontWeight: 'bold' }
    );
    title.position.set(px + 62, py + 18);
    this.container.addChild(title);

    // X 닫기 버튼
    const closeBg = new PIXI.Graphics();
    closeBg.beginFill(0x3d4f60);
    closeBg.drawCircle(0, 0, 16);
    closeBg.endFill();
    const closeX = new PIXI.Text('✕', { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff });
    closeX.anchor.set(0.5, 0.5);
    const closeBtn = new PIXI.Container();
    closeBtn.addChild(closeBg);
    closeBtn.addChild(closeX);
    closeBtn.position.set(px + POP_W - 26, py + 32);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerover', () => { closeBg.tint = 0xe74c3c; });
    closeBtn.on('pointerout',  () => { closeBg.tint = 0xffffff; });
    closeBtn.on('pointerdown', () => this.close());
    this.container.addChild(closeBtn);

    // 안내 텍스트
    const instrMap = {
      streak: '🖐 광물을 조흔판에 긁어 보세요.',
      acid:   '💧 광물에 묽은 염산 방울을 떨어뜨려 보세요.',
      magnet: '🔗 광물을 클립에 접근시켜 보세요.',
    };
    const instr = new PIXI.Text(instrMap[this.experimentType] ?? '', {
      fontFamily: 'Arial', fontSize: 20, fill: 0x8ea5b8, fontWeight: 'bold', align: 'center',
    });
    instr.anchor.set(0.5, 0);
    instr.position.set(midX, py + 88);
    this.container.addChild(instr);

    // 효과 위젯 배치 (instr 아래 14px 여백, py+82+28+14 = py+124)
    const EW = 500;
    const EFFECT_SCALE = (POP_W - 72) / EW; // 결과 박스와 동일 너비
    const ex = px + 36; // 결과 박스 left와 동일
    const ey = py + 124;
    this._buildEffect(ex, ey);
    if (this._effect) this._effect.container.scale.set(EFFECT_SCALE);

    // effect bottom ≈ py+124+392 = py+516, gap 20px → result at py+536
    const resultPanel = new PIXI.Graphics();
    resultPanel.beginFill(0x0d1520, 0.95);
    resultPanel.lineStyle(1, 0x294a66, 0.75);
    resultPanel.drawRoundedRect(0, 0, POP_W - 72, 74, 14);
    resultPanel.endFill();
    resultPanel.position.set(px + 36, py + 521);
    this.container.addChild(resultPanel);

    // 결과 배지
    this._resultBadge = new PIXI.Text('실험 결과가 여기에 표시됩니다', {
      fontFamily: 'Arial', fontSize: 16, fill: 0x566573,
      align: 'center', wordWrap: true, wordWrapWidth: POP_W - 120,
    });
    this._resultBadge.anchor.set(0.5, 0.5);
    this._resultBadge.position.set(midX, py + 558);
    this.container.addChild(this._resultBadge);

    // PPE 경고 체크
    this._checkPPE(px, py);
  }

  _buildEffect(ex, ey) {
    let effect;
    if (this.experimentType === 'streak') {
      effect = new ScratchEffect(this.mineral.streakColor, this.app, this.mineral.id);
      effect.onDone((r) => this._onResult(r));
    } else if (this.experimentType === 'acid') {
      effect = new AcidEffect(this.app, this.mineral.acidReaction, this.mineral.id);
      effect.onDone((r) => this._onResult(r));
    } else if (this.experimentType === 'magnet') {
      effect = new MagnetEffect(this.app, this.mineral.magnetic, this.mineral.id);
      effect.onDone((r) => this._onResult(r));
    }
    if (effect) {
      effect.container.position.set(ex, ey);
      effect.container.zIndex = 2;
      this.container.addChild(effect.container);
      this._effect = effect;
    }
  }

  _checkPPE(px, py) {
    if (!this.safetySystem) return;
    const penalty = this.safetySystem.getPenalty(this.experimentType);
    if (!penalty) return;

    // 경고창이 있는 동안 실험 진행 차단
    if (this._effect) this._effect.container.eventMode = 'none';

    // 경고 배너
    const warn = new PIXI.Container();
    this._ppeWarning = warn;

    const warnBg = new PIXI.Graphics();
    warnBg.beginFill(0x2c1810);
    warnBg.lineStyle(1, 0xe74c3c, 0.8);
    warnBg.drawRoundedRect(0, 0, POP_W - 40, 120, 8);
    warnBg.endFill();
    warn.addChild(warnBg);

    const warnTitle = new PIXI.Text('⚠ 안전 경고', {
      fontFamily: 'Arial', fontSize: 16, fill: 0xe74c3c, fontWeight: 'bold',
    });
    warnTitle.position.set(16, 12);
    warn.addChild(warnTitle);

    const warnMsg = new PIXI.Text(penalty.reason, {
      fontFamily: 'Arial', fontSize: 13, fill: 0xffcccc,
      wordWrap: true, wordWrapWidth: POP_W - 80,
    });
    warnMsg.position.set(16, 38);
    warn.addChild(warnMsg);

    // 진행 버튼
    const proceedBg = new PIXI.Graphics();
    proceedBg.beginFill(0xe74c3c);
    proceedBg.drawRoundedRect(0, 0, 180, 34, 6);
    proceedBg.endFill();
    const proceedTxt = new PIXI.Text(`그냥 진행 (−${penalty.damage} HP)`, {
      fontFamily: 'Arial', fontSize: 12, fill: 0xffffff,
    });
    proceedTxt.anchor.set(0.5, 0.5);
    proceedTxt.position.set(90, 17);
    const proceedBtn = new PIXI.Container();
    proceedBtn.addChild(proceedBg);
    proceedBtn.addChild(proceedTxt);
    proceedBtn.position.set(16, 78);
    proceedBtn.eventMode = 'static';
    proceedBtn.cursor = 'pointer';
    proceedBtn.on('pointerdown', () => {
      this.statusManager?.applyDamage(penalty.damage, penalty.reason);
      this.container.removeChild(warn);
      warn.destroy({ children: true });
      this._ppeWarning = null;
      if (this._effect) this._effect.container.eventMode = 'static';
    });
    warn.addChild(proceedBtn);

    // 취소 버튼
    const cancelBg = new PIXI.Graphics();
    cancelBg.beginFill(0x2e4057);
    cancelBg.drawRoundedRect(0, 0, 140, 34, 6);
    cancelBg.endFill();
    const cancelTxt = new PIXI.Text('취소', {
      fontFamily: 'Arial', fontSize: 12, fill: 0xffffff,
    });
    cancelTxt.anchor.set(0.5, 0.5);
    cancelTxt.position.set(70, 17);
    const cancelBtn = new PIXI.Container();
    cancelBtn.addChild(cancelBg);
    cancelBtn.addChild(cancelTxt);
    cancelBtn.position.set(206, 78);
    cancelBtn.eventMode = 'static';
    cancelBtn.cursor = 'pointer';
    cancelBtn.on('pointerdown', () => this.close());
    warn.addChild(cancelBtn);

    warn.position.set(px + 20, py + POP_H - 146);
    this.container.addChild(warn);
  }

  _onResult(result) {
    this.mineralManager?.recordExperiment(this.mineral.id, this.experimentType, result);

    let text, color;
    if (this.experimentType === 'streak') {
      const label = result === 'black' ? '검은색' : result === 'white' ? '흰색' : '해당 없음';
      text = `조흔색: ${label}`;
      color = 0x2ecc71;
    } else if (this.experimentType === 'acid') {
      text = result ? '염산 반응: 거품 발생 ✓' : '염산 반응: 무반응 ✗';
      color = result ? 0xf39c12 : 0x7f8c8d;
    } else if (this.experimentType === 'magnet') {
      text = result ? '자성: 있음 ✓' : '자성: 없음 ✗';
      color = result ? 0xf1c40f : 0x7f8c8d;
    }

    this._resultBadge.style = new PIXI.TextStyle({
      fontFamily: 'Arial', fontSize: 15, fill: color, fontWeight: 'bold',
    });
    this._resultBadge.text = text;

    if (!this.mineralManager?.areAllHintsRevealed()) {
      this.uiManager?.showDialogue(`${this.mineral.name} — ${text}  (도감에 기록됨)`);
    }

    if (this._onDone) {
      this._onDone(this.mineral.id);
    }
  }

  onClose(cb) {
    this._onClose = cb;
    return this;
  }

  onDone(cb) {
    this._onDone = cb;
    return this;
  }

  close() {
    if (this._effect) {
      this._effect.destroy?.();
      this._effect = null;
    }
    if (this._onClose) this._onClose();
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }
}
