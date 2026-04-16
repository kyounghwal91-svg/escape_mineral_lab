import * as PIXI from 'pixi.js';

export class NotePopup {
  constructor(app, text, title = "과학자의 쪽지") {
    this.app = app;
    this.container = new PIXI.Container();
    this._onClose = null;

    this._build(text, title);
  }

  _build(text, title) {
    const W = 1280, H = 720;
    const PW = 500, PH = 340;

    // 배경 오버레이
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.6);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.container.addChild(overlay);

    // 쪽지 박스 (종이 느낌)
    const box = new PIXI.Graphics();
    box.beginFill(0xfdf2e9); // 연한 종이색
    box.lineStyle(2, 0xba8d6c);
    box.drawRoundedRect(0, 0, PW, PH, 12);
    box.endFill();
    box.position.set((W - PW) / 2, (H - PH) / 2);
    this.container.addChild(box);

    // 제목
    const titleTxt = new PIXI.Text(title, {
      fontFamily: 'Arial', fontSize: 20, fill: 0x5d4037, fontWeight: 'bold'
    });
    titleTxt.anchor.set(0.5, 0);
    titleTxt.position.set(W / 2, box.y + 30);
    this.container.addChild(titleTxt);

    // 내용
    if (text && typeof text === 'object' && text.clue !== undefined) {
      // 구조화된 텍스트: clue(크게) + footer(작게)
      const clueTxt = new PIXI.Text(text.clue, {
        fontFamily: 'Arial', fontSize: 22, fill: 0x3e2723, fontWeight: 'bold',
        wordWrap: true, wordWrapWidth: PW - 80, align: 'center', lineHeight: 34
      });
      clueTxt.anchor.set(0.5, 0.5);
      clueTxt.position.set(W / 2, box.y + PH / 2 - 10);
      this.container.addChild(clueTxt);

      const footerTxt = new PIXI.Text(text.footer, {
        fontFamily: 'Arial', fontSize: 13, fill: 0x6d4c41,
        wordWrap: true, wordWrapWidth: PW - 80, align: 'center'
      });
      footerTxt.anchor.set(0.5, 0);
      footerTxt.position.set(W / 2, box.y + PH - 115);
      this.container.addChild(footerTxt);
    } else {
      const contentTxt = new PIXI.Text(text, {
        fontFamily: 'Arial', fontSize: 17, fill: 0x3e2723,
        wordWrap: true, wordWrapWidth: PW - 80, align: 'center', lineHeight: 28
      });
      contentTxt.anchor.set(0.5, 0.5);
      contentTxt.position.set(W / 2, box.y + PH / 2 + 10);
      this.container.addChild(contentTxt);
    }

    // 닫기 버튼
    const closeBtn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0x8d6e63);
    btnBg.drawRoundedRect(-60, -20, 120, 40, 8);
    btnBg.endFill();
    closeBtn.addChild(btnBg);

    const btnTxt = new PIXI.Text("확인", { fontFamily: 'Arial', fontSize: 15, fill: 0xffffff });
    btnTxt.anchor.set(0.5, 0.5);
    closeBtn.addChild(btnTxt);

    closeBtn.position.set(W / 2, box.y + PH - 50);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this.container.addChild(closeBtn);
  }

  onClose(cb) { this._onClose = cb; return this; }

  close() {
    if (this._onClose) this._onClose();
    if (this.container.parent) this.container.parent.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
