import * as PIXI from 'pixi.js';
import { AudioManager } from '../systems/AudioManager.js';

export class UIManager {
  constructor(app, statusManager) {
    this.app = app;
    this.statusManager = statusManager;
    this.container = new PIXI.Container();
    this.container.zIndex = 100;
    this._hpBarFill = null;
    this._timerText = null;
    this._dialogBox = null;
    this._dialogText = null;
    this._typingTimer = null;
    this._damageOverlay = null;
    this._hpChangedHandler = null;
    this._timerTickHandler = null;
    this._timerWarningSounded = false;
    this._muteBtn = null;
    this._muteBtnIcon = null;
  }

  init() {
    this._buildHUD();
    this._bindEvents();
    this.app.stage.addChild(this.container);

    // 전역 클릭 감지로 대사창 닫기
    this.app.stage.eventMode = 'static';
    this.app.stage.on('pointerdown', () => {
      if (this._dialogBox.visible) {
        this.hideDialogue();
      }
    });
  }

  _buildHUD() {
    const W = 1280;
    const H = 720;

    // === HP 바 ===
    const hpLabel = new PIXI.Text('HP', {
      fontFamily: 'Arial', fontSize: 16, fill: 0xffffff, fontWeight: 'bold',
    });
    hpLabel.position.set(20, H - 43);
    this.container.addChild(hpLabel);

    // 배경
    const hpBg = new PIXI.Graphics();
    hpBg.beginFill(0x555555);
    hpBg.drawRoundedRect(0, 0, 200, 18, 4);
    hpBg.endFill();
    hpBg.position.set(50, H - 42);
    this.container.addChild(hpBg);

    // fill
    this._hpBarFill = new PIXI.Graphics();
    this._drawHPBar(100);
    this._hpBarFill.position.set(50, H - 42);
    this.container.addChild(this._hpBarFill);

    // === 타이머 ===
    this._timerText = new PIXI.Text('05:00', {
      fontFamily: 'Arial', fontSize: 28, fill: 0xffffff, fontWeight: 'bold',
    });
    this._timerText.anchor.set(1, 0);
    this._timerText.position.set(W - 20, 16);
    this.container.addChild(this._timerText);

    // === 대사창 ===
    this._dialogBox = new PIXI.Container();
    this._dialogBox.visible = false;

    const dialogBg = new PIXI.Graphics();
    dialogBg.beginFill(0x000000, 0.75);
    dialogBg.drawRoundedRect(0, 0, 760, 100, 8);
    dialogBg.endFill();
    this._dialogBox.addChild(dialogBg);

    this._dialogText = new PIXI.Text('', {
      fontFamily: 'Arial', fontSize: 18, fill: 0xffffff,
      wordWrap: true, wordWrapWidth: 720, lineHeight: 22,
    });
    this._dialogText.position.set(20, 15);
    this._dialogBox.addChild(this._dialogText);

    // ▼ 클릭 안내 화살표 추가
    this._dialogArrow = new PIXI.Graphics();
    this._dialogArrow.beginFill(0xffffff, 0.8);
    this._dialogArrow.moveTo(0, 0);
    this._dialogArrow.lineTo(14, 0);
    this._dialogArrow.lineTo(7, 10);
    this._dialogArrow.closePath();
    this._dialogArrow.endFill();
    this._dialogArrow.position.set(720, 75);
    this._dialogBox.addChild(this._dialogArrow);
    this._arrowTime = 0;

    this._dialogBox.position.set(260, 100);
    this.container.addChild(this._dialogBox);

    // === 데미지 오버레이 ===
    this._damageOverlay = new PIXI.Graphics();
    this._damageOverlay.beginFill(0xff0000, 0.4);
    this._damageOverlay.drawRect(0, 0, 1280, 720);
    this._damageOverlay.endFill();
    this._damageOverlay.alpha = 0;
    this._damageOverlay.eventMode = 'none'; // alpha=0이어도 이벤트 차단 방지
    this.container.addChild(this._damageOverlay);

    // === 음소거 버튼 (우측 하단) ===
    // 대화창(x:190~1090), HP바(좌하단)와 겹치지 않는 위치
    const MUTE_X = W - 54;
    const MUTE_Y = H - 54;
    const MUTE_R = 22;

    this._muteBtnBg = new PIXI.Graphics();
    this._muteBtnBg.position.set(MUTE_X, MUTE_Y);
    this.container.addChild(this._muteBtnBg);

    this._muteBtnIcon = new PIXI.Text('🔊', {
      fontSize: 22,
    });
    this._muteBtnIcon.anchor.set(0.5);
    this._muteBtnIcon.position.set(MUTE_X, MUTE_Y);
    this.container.addChild(this._muteBtnIcon);

    // 클릭 영역 (투명 원형)
    this._muteBtn = new PIXI.Graphics();
    this._muteBtn.beginFill(0xffffff, 0.001);
    this._muteBtn.drawCircle(0, 0, MUTE_R);
    this._muteBtn.endFill();
    this._muteBtn.position.set(MUTE_X, MUTE_Y);
    this._muteBtn.eventMode = 'static';
    this._muteBtn.cursor = 'pointer';
    this._muteBtn.on('pointerdown', (e) => {
      e.stopPropagation();
      const muted = AudioManager.instance.toggleMute();
      this._updateMuteBtn(muted);
    });
    this._muteBtn.on('pointerover', () => {
      this._drawMuteBtnBg(true);
    });
    this._muteBtn.on('pointerout', () => {
      this._drawMuteBtnBg(false);
    });
    this.container.addChild(this._muteBtn);

    this._muteBtnRadius = MUTE_R;
    this._drawMuteBtnBg(false);
  }

  _drawMuteBtnBg(hover) {
    const r = this._muteBtnRadius ?? 22;
    this._muteBtnBg.clear();
    this._muteBtnBg.beginFill(0x000000, hover ? 0.65 : 0.45);
    this._muteBtnBg.drawCircle(0, 0, r);
    this._muteBtnBg.endFill();
    this._muteBtnBg.lineStyle(1.5, 0xffffff, 0.5);
    this._muteBtnBg.drawCircle(0, 0, r);
  }

  _updateMuteBtn(muted) {
    this._muteBtnIcon.text = muted ? '🔇' : '🔊';
    this._drawMuteBtnBg(false);
  }

  /**
   * 음소거 버튼 위치를 오프셋만큼 이동 (씬별 레이아웃 조정용)
   * @param {number} dx
   * @param {number} dy
   */
  setDialoguePosition(x, y) {
    this._dialogBox.position.set(x, y);
  }

  moveMuteBtn(dx, dy) {
    this._muteBtnBg.x += dx;
    this._muteBtnBg.y += dy;
    this._muteBtnIcon.x += dx;
    this._muteBtnIcon.y += dy;
    this._muteBtn.x += dx;
    this._muteBtn.y += dy;
  }

  _drawHPBar(hp) {
    this._hpBarFill.clear();
    const ratio = Math.max(0, hp / 100);
    const color = ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c;
    this._hpBarFill.beginFill(color);
    this._hpBarFill.drawRoundedRect(0, 0, 200 * ratio, 18, 4);
    this._hpBarFill.endFill();
  }

  _bindEvents() {
    this._hpChangedHandler = ({ hp }) => this.updateHP(hp);
    this._timerTickHandler = (t) => this.updateTimer(t);
    this.statusManager.on('hpChanged', this._hpChangedHandler);
    this.statusManager.on('timerTick', this._timerTickHandler);
  }

  update(delta) {
    if (this._dialogBox.visible && this._dialogArrow) {
      this._arrowTime += delta * 0.1;
      // 부드러운 깜빡임
      this._dialogArrow.alpha = 0.5 + Math.sin(this._arrowTime) * 0.5;
      // 부드러운 위아래 움직임
      this._dialogArrow.y = 75 + Math.sin(this._arrowTime * 1.5) * 3;
    }
  }

  updateHP(hp) {
    this._drawHPBar(hp);
    this.showDamageFlash();
    AudioManager.instance.playSFX('damage');
  }

  updateTimer(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    this._timerText.text = `${m}:${s}`;
    this._timerText.style.fill = seconds <= 60 ? 0xff4444 : 0xffffff;
    if (seconds === 60 && !this._timerWarningSounded) {
      this._timerWarningSounded = true;
      AudioManager.instance.playSFX('timer_warning');
    }
  }

  showDialogue(text, onComplete = null) {
    if (this._typingTimer) clearInterval(this._typingTimer);
    this._dialogText.text = '';
    this._dialogBox.visible = true;
    AudioManager.instance.playSFX('dialogue');

    let i = 0;
    this._typingTimer = setInterval(() => {
      if (i < text.length) {
        this._dialogText.text += text[i++];
      } else {
        clearInterval(this._typingTimer);
        this._typingTimer = null;
        if (onComplete) onComplete();
      }
    }, 50);
  }

  hideDialogue() {
    if (this._typingTimer) {
      clearInterval(this._typingTimer);
      this._typingTimer = null;
    }
    this._dialogBox.visible = false;
    this._dialogText.text = '';
  }

  showDamageFlash() {
    this._damageOverlay.alpha = 0.4;
    const fade = () => {
      this._damageOverlay.alpha -= 0.02;
      if (this._damageOverlay.alpha <= 0) {
        this._damageOverlay.alpha = 0;
        this.app.ticker.remove(fade);
      }
    };
    this.app.ticker.add(fade);
  }

  destroy() {
    if (this._typingTimer) clearInterval(this._typingTimer);
    if (this._hpChangedHandler) {
      this.statusManager.off('hpChanged', this._hpChangedHandler);
      this._hpChangedHandler = null;
    }
    if (this._timerTickHandler) {
      this.statusManager.off('timerTick', this._timerTickHandler);
      this._timerTickHandler = null;
    }
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }
}
