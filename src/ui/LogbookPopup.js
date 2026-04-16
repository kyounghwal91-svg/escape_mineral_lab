import * as PIXI from 'pixi.js';
import { MINERALS } from '../data/minerals.js';

const POP_W = 860, POP_H = 520;

// 열 정의
const COLS = [
  { key: 'name',    label: '광물',    w: 130 },
  { key: 'streak',  label: '조흔색',  w: 150 },
  { key: 'acid',    label: '염산 반응', w: 160 },
  { key: 'magnet',  label: '자성',    w: 130 },
  { key: 'hardness',label: '굳기',    w: 150 },
];
const COL_ACCENT = { streak: 0x27ae60, acid: 0xe67e22, magnet: 0x8e44ad, hardness: 0x16a085 };
const ROW_H = 58;
const HEADER_H = 44;
const TABLE_TOP_OFFSET = 88; // 팝업 상단에서 테이블까지 거리

/**
 * 도감 비교표 팝업
 * - getAllRecords()를 받아 실험 결과를 표로 표시
 * - 미실험 항목은 "?" 표시
 */
export class LogbookPopup {
  constructor(app, { mineralManager }) {
    this.app = app;
    this.mineralManager = mineralManager;

    this.container = new PIXI.Container();
    this._onClose = null;
    this._cellTexts = {}; // { mineralId_colKey: PIXI.Text }

    this._build();
  }

  _build() {
    const W = 1280, H = 720;
    const px = (W - POP_W) / 2;
    const py = (H - POP_H) / 2;

    // 오버레이
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.65);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.container.addChild(overlay);

    // 팝업 박스
    const box = new PIXI.Graphics();
    box.lineStyle(2, 0x1f618d, 0.9);
    box.beginFill(0x1a2332);
    box.drawRoundedRect(0, 0, POP_W, POP_H, 12);
    box.endFill();
    box.position.set(px, py);
    this.container.addChild(box);

    // 헤더
    const header = new PIXI.Graphics();
    header.beginFill(0x0d1b2a);
    header.drawRect(0, 0, POP_W, 62);
    header.endFill();
    header.position.set(px, py);
    this.container.addChild(header);

    const accentLine = new PIXI.Graphics();
    accentLine.lineStyle(3, 0x1f618d);
    accentLine.moveTo(px + 10, py + 62);
    accentLine.lineTo(px + POP_W - 10, py + 62);
    this.container.addChild(accentLine);

    const title = new PIXI.Text('📋  광물 실험 도감', {
      fontFamily: 'Arial', fontSize: 20, fill: 0x85c1e9, fontWeight: 'bold',
    });
    title.position.set(px + 22, py + 16);
    this.container.addChild(title);

    // X 버튼
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

    // 테이블 그리기
    this._buildTable(px, py);
  }

  _buildTable(px, py) {
    // 열 x 좌표 계산 (전체 너비에서 중앙 정렬)
    const totalColW = COLS.reduce((s, c) => s + c.w, 0);
    const tableLeft = px + (POP_W - totalColW) / 2;
    const tableTop  = py + TABLE_TOP_OFFSET;

    const colX = [];
    let cx = tableLeft;
    for (const col of COLS) { colX.push(cx); cx += col.w; }

    const grid = new PIXI.Graphics();
    this.container.addChild(grid);

    // ── 헤더 행 ──────────────────────────────────────────────
    grid.beginFill(0x0d2233);
    grid.drawRect(tableLeft, tableTop, totalColW, HEADER_H);
    grid.endFill();

    COLS.forEach((col, ci) => {
      const accent = COL_ACCENT[col.key] ?? 0x85c1e9;
      const txt = new PIXI.Text(col.label, {
        fontFamily: 'Arial', fontSize: 13, fill: accent, fontWeight: 'bold',
      });
      txt.anchor.set(0.5, 0.5);
      txt.position.set(colX[ci] + col.w / 2, tableTop + HEADER_H / 2);
      this.container.addChild(txt);
    });

    // ── 데이터 행 ────────────────────────────────────────────
    const records = this.mineralManager.getAllRecords();

    MINERALS.forEach((mineral, ri) => {
      const rowY = tableTop + HEADER_H + ri * ROW_H;
      const isEven = ri % 2 === 0;

      // 행 배경
      grid.beginFill(isEven ? 0x1e2e40 : 0x172535, 0.9);
      grid.drawRect(tableLeft, rowY, totalColW, ROW_H);
      grid.endFill();

      // 광물 이름 열: 이미지 썸네일 + 이름
      const sprite = PIXI.Sprite.from(`images/${mineral.id}.png`);
      sprite.anchor.set(0.5);
      sprite.width = 24;
      sprite.height = 24;
      sprite.position.set(colX[0] + 22, rowY + ROW_H / 2);
      this.container.addChild(sprite);

      const nameTxt = new PIXI.Text(mineral.name, {
        fontFamily: 'Arial', fontSize: 13, fill: 0xddeeff, fontWeight: 'bold',
      });
      nameTxt.anchor.set(0, 0.5);
      nameTxt.position.set(colX[0] + 38, rowY + ROW_H / 2);
      this.container.addChild(nameTxt);

      // 실험 결과 열 (streak / acid / magnet / hardness)
      const rec = records[mineral.id] ?? {};
      const cellData = [
        this._formatStreak(rec),
        this._formatAcid(rec),
        this._formatMagnet(rec),
        this._formatHardness(rec, mineral.id),
      ];

      COLS.slice(1).forEach((col, dataIdx) => {
        const ci = dataIdx + 1;
        const { text, color } = cellData[dataIdx];

        const cellTxt = new PIXI.Text(text, {
          fontFamily: 'Arial', fontSize: 13, fill: color, fontWeight: text !== '?' ? 'bold' : 'normal',
        });
        cellTxt.anchor.set(0.5, 0.5);
        cellTxt.position.set(colX[ci] + col.w / 2, rowY + ROW_H / 2);
        this.container.addChild(cellTxt);

        // 나중에 갱신할 수 있도록 참조 보관
        this._cellTexts[`${mineral.id}_${col.key}`] = cellTxt;
      });
    });

    // ── 격자 선 ──────────────────────────────────────────────
    const totalRows = MINERALS.length;
    grid.lineStyle(1, 0x2e4057, 0.7);

    // 가로선
    for (let r = 0; r <= totalRows + 1; r++) {
      const y = r === 0
        ? tableTop
        : r === 1
        ? tableTop + HEADER_H
        : tableTop + HEADER_H + (r - 1) * ROW_H;
      grid.moveTo(tableLeft, y);
      grid.lineTo(tableLeft + totalColW, y);
    }

    // 세로선
    colX.forEach(x => {
      grid.moveTo(x, tableTop);
      grid.lineTo(x, tableTop + HEADER_H + totalRows * ROW_H);
    });
    grid.moveTo(tableLeft + totalColW, tableTop);
    grid.lineTo(tableLeft + totalColW, tableTop + HEADER_H + totalRows * ROW_H);

    // 안내 문구
    const hint = new PIXI.Text('실험을 진행하면 결과가 자동으로 기록됩니다', {
      fontFamily: 'Arial', fontSize: 11, fill: 0x4a6580,
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(px + POP_W / 2, py + POP_H - 28);
    this.container.addChild(hint);
  }

  // ── 포맷 헬퍼 ──────────────────────────────────────────────────────────────
  _formatStreak(rec) {
    if (!rec.streakTested) return { text: '?', color: 0x2e4057 };
    const map = { none: '없음(무색)', white: '흰색', black: '검은색' };
    return { text: map[rec.streakColor] ?? rec.streakColor, color: 0x2ecc71 };
  }

  _formatAcid(rec) {
    if (!rec.acidTested) return { text: '?', color: 0x2e4057 };
    return rec.acidReacted
      ? { text: '거품 발생 ✓', color: 0xf39c12 }
      : { text: '무반응 ✗',   color: 0x7f8c8d };
  }

  _formatMagnet(rec) {
    if (!rec.magnetTested) return { text: '?', color: 0x2e4057 };
    return rec.magnetic
      ? { text: '있음 ✓', color: 0xf1c40f }
      : { text: '없음 ✗', color: 0x7f8c8d };
  }

  _formatHardness(rec, mineralId) {
    const NO_HARDNESS = ['feldspar', 'biotite', 'magnetite'];
    if (NO_HARDNESS.includes(mineralId)) return { text: '— 해당없음', color: 0x4a6580 };
    if (!rec.hardnessTested) return { text: '?', color: 0x2e4057 };
    const map = { high: '높음 (7)', medium: '중간 (6)', low: '낮음 (3)' };
    return { text: map[rec.hardness] ?? rec.hardness, color: 0x1abc9c };
  }

  // ── 외부에서 결과 갱신 ────────────────────────────────────────────────────
  refresh() {
    const records = this.mineralManager.getAllRecords();
    const formatters = {
      streak:   (rec) => this._formatStreak(rec),
      acid:     (rec) => this._formatAcid(rec),
      magnet:   (rec) => this._formatMagnet(rec),
      hardness: (rec, mineralId) => this._formatHardness(rec, mineralId),
    };

    MINERALS.forEach(mineral => {
      const rec = records[mineral.id] ?? {};
      Object.entries(formatters).forEach(([key, fn]) => {
        const cellTxt = this._cellTexts[`${mineral.id}_${key}`];
        if (!cellTxt) return;
        const { text, color } = fn(rec, mineral.id);
        cellTxt.text = text;
        cellTxt.style = new PIXI.TextStyle({
          fontFamily: 'Arial', fontSize: 13, fill: color,
          fontWeight: text !== '?' ? 'bold' : 'normal',
        });
      });
    });
  }

  onClose(cb) { this._onClose = cb; return this; }

  close() {
    if (this._onClose) this._onClose();
    if (this.container.parent) this.container.parent.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
