import { MINERALS, KEY_PAIRING_RULES, getMineralById } from '../data/minerals.js';

// ─── Experiment-gated clue system helpers ─────────────────────────────────────

/** Count how many minerals have been tested for a specific experiment type. */
function _countTested(records, type) {
  const key = `${type}Tested`;
  return Object.values(records).filter(r => r[key] === true).length;
}

/** Count minerals that have completed streak + acid + magnet experiments. */
function _countFullyTested(records) {
  return Object.values(records).filter(
    r => r.streakTested && r.acidTested && r.magnetTested
  ).length;
}

/** Count minerals with at least one experiment of any type completed. */
function _countExperimented(records) {
  return Object.values(records).filter(
    r => r.streakTested || r.acidTested || r.magnetTested || r.hardnessTested
  ).length;
}

/**
 * Clue definitions. Each clue unlocks when BOTH:
 *  1. condition(records) — the player has done enough experiments
 *  2. validFor(keyMinerals) — the clue is factually true for the current key set
 * Clues are logical constraints, never direct answers.
 */
const CLUE_DEFINITIONS = [
  {
    id: 'clue_acid',
    text: '열쇠 광물 중 하나는 염산에 반응하여 CO₂ 거품을 냅니다.',
    condition: records => _countTested(records, 'acid') >= 1,
    validFor: keys => keys.some(id => getMineralById(id)?.acidReaction === true),
  },
  {
    id: 'clue_magnet',
    text: '열쇠 광물 중 하나는 강한 자성을 가지고 있습니다.',
    condition: records => _countTested(records, 'magnet') >= 1,
    validFor: keys => keys.some(id => getMineralById(id)?.magnetic === true),
  },
  {
    id: 'clue_streak_black',
    text: '열쇠 광물 중 하나는 조흔판에 검은색 가루를 남깁니다.',
    condition: records => _countTested(records, 'streak') >= 1,
    validFor: keys => keys.some(id => getMineralById(id)?.streakColor === 'black'),
  },
];

export class MineralManager {
  constructor() {
    this.minerals = new Map();
    this.keyMinerals = [];
    this.experimentRecords = {};
    this.unlockedLevel = 0; // 0: 1번 힌트만, 1: 2번까지...
    this.correctSlots = [false, false, false];
    this.revealedHints = [];
    this.revealedColors = new Set();
    this.labIntroDialogueShown = false;
    this.hasVisitedDoor = false;
    this.experimentAttemptsBeforeDoor = 0;
    this.doorHintDialogueShown = false;
    // Experiment-gated clue system
    this.unlockedClues = [];      // { id: string, text: string }[]
    this.submitAttempts = 0;
    this.maxSubmitAttempts = 3;
  }

  init() {
    MINERALS.forEach(m => this.minerals.set(m.id, m));
    MINERALS.forEach(m => {
      this.experimentRecords[m.id] = {
        streakTested: false, streakColor: null,
        acidTested: false, acidReacted: null,
        magnetTested: false, magnetic: null,
        hardnessTested: false, hardness: null,
      };
    });
    this.keyMinerals = this.generateKeyMinerals();
    this.revealedHints = [];
    this.revealedColors = new Set();
    this.unlockedLevel = 0;
    this.correctSlots = [false, false, false];
    this.labIntroDialogueShown = false;
    this.hasVisitedDoor = false;
    this.experimentAttemptsBeforeDoor = 0;
    this.doorHintDialogueShown = false;
    // Reset clue system
    this.unlockedClues = [];
    this.submitAttempts = 0;
  }

  generateKeyMinerals() {
    const { pairA, pairB } = KEY_PAIRING_RULES;
    const pickA = pairA[Math.floor(Math.random() * pairA.length)];
    const pickB = pairB[Math.floor(Math.random() * pairB.length)];
    const rest = MINERALS.map(m => m.id).filter(id => id !== pickA && id !== pickB);
    const pickC = rest[Math.floor(Math.random() * rest.length)];
    const keys = [pickA, pickB, pickC];
    // 셔플하여 순서 결정
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys;
  }

  getClue(index, isDetailed = false) {
    const mid = this.keyMinerals[index];
    const m = this.getMineral(mid);
    if (!m) return "데이터 없음";

    const n = index + 1;
    if (!isDetailed) {
      // 1단계: 색상 힌트
      const colorHints = {
        quartz:    `${n}번 열쇠는 무색투명해.`,
        feldspar:  `${n}번 열쇠는 흰색 또는 분홍색을 띠어.`,
        biotite:   `${n}번 열쇠는 검은색을 띠어.`,
        calcite:   `${n}번 열쇠는 무색투명해.`,
        magnetite: `${n}번 열쇠는 검은색을 띠어.`,
      };
      return colorHints[mid] ?? `${n}번 열쇠는 특이한 색을 띠고 있어.`;
    } else {
      // 2단계: 실험 결과 힌트
      if (m.acidReaction)          return `${n}번 열쇠에 묽은 염산을 떨어뜨리면 거품이 생겨.`;
      if (m.magnetic)              return `${n}번 열쇠에는 자성이 있어 클립이 달라붙어.`;
      if (m.streakColor === 'black') return `${n}번 열쇠를 조흔판에 긁으면 흰색의 광물 가루가 나와.`;
      if (m.hardness === 'high')   return `석영과 방해석을 서로 긁었을 때, 긁히지 않는 광물이 ${n}번 열쇠야.`;
      return `${n}번 열쇠의 조흔색은 흰색이야.`;
    }
  }

  getUnlockedClues() {
    const history = [];
    for (let i = 0; i <= this.unlockedLevel; i++) {
      history.push(this.getClue(i, false));
    }
    return history;
  }

  revealClue(index, isDetailed = false) {
    const clue = this.getClue(index, isDetailed);
    if (clue !== '데이터 없음' && !this.revealedHints.includes(clue)) {
      this.revealedHints.push(clue);
    }
    return clue;
  }

  addRevealedHint(text) {
    if (text && !this.revealedHints.includes(text)) {
      this.revealedHints.push(text);
    }
  }

  getRevealedHints() {
    return [...this.revealedHints];
  }

  revealColor(id) { this.revealedColors.add(id); }
  isColorRevealed(id) { return this.revealedColors.has(id); }

  getMineral(id) { return this.minerals.get(id) ?? null; }
  getAllMinerals() { return [...this.minerals.values()]; }
  getKeyMinerals() { return [...this.keyMinerals]; }

  recordExperiment(mineralId, type, result) {
    const rec = this.experimentRecords[mineralId];
    if (!rec) return;
    if (type === 'streak')    { rec.streakTested = true; rec.streakColor = result; }
    if (type === 'acid')      { rec.acidTested = true; rec.acidReacted = result; }
    if (type === 'magnet')    { rec.magnetTested = true; rec.magnetic = result; }
    if (type === 'hardness')  { rec.hardnessTested = true; rec.hardness = result; }
  }

  getRecord(mineralId) { return this.experimentRecords[mineralId] ?? null; }
  getAllRecords() { return { ...this.experimentRecords }; }

  markLabIntroDialogueShown() {
    this.labIntroDialogueShown = true;
  }

  shouldShowLabIntroDialogue() {
    return !this.labIntroDialogueShown;
  }

  markDoorVisited() {
    this.hasVisitedDoor = true;
  }

  registerExperimentAttempt() {
    if (this.hasVisitedDoor) return false;
    this.experimentAttemptsBeforeDoor += 1;
    if (!this.doorHintDialogueShown && this.experimentAttemptsBeforeDoor >= 3) {
      this.doorHintDialogueShown = true;
      return true;
    }
    return false;
  }

  isExperimentComplete(mineralId) {
    const rec = this.experimentRecords[mineralId];
    return rec && rec.streakTested && rec.acidTested && rec.magnetTested;
  }

  // 슬롯별 검증 로직
  checkSlot(index, mineralId) {
    const isCorrect = this.keyMinerals[index] === mineralId;
    if (isCorrect) {
      this.correctSlots[index] = true;
      // 다음 단계 힌트 해제 (최대 2단계까지)
      if (this.unlockedLevel === index && index < 2) {
        this.unlockedLevel++;
      }
    }
    return isCorrect;
  }

  isAllCorrect() {
    return this.correctSlots.every(v => v === true);
  }

  // ─── Experiment-gated clue system ─────────────────────────────────────────

  /**
   * Evaluates all CLUE_DEFINITIONS against current experiment records + key minerals.
   * Any clue whose condition and validity are newly satisfied is pushed to
   * this.unlockedClues.
   * @returns {{ id: string, text: string }[]} Newly unlocked clues this call.
   */
  tryUnlockClues() {
    const newlyUnlocked = [];
    for (const def of CLUE_DEFINITIONS) {
      if (this.unlockedClues.some(c => c.id === def.id)) continue;
      if (def.condition(this.experimentRecords) && def.validFor(this.keyMinerals)) {
        const clue = { id: def.id, text: def.text };
        this.unlockedClues.push(clue);
        newlyUnlocked.push(clue);
      }
    }
    return newlyUnlocked;
  }

  /**
   * Returns whether the player is allowed to submit in DoorScene.
   * Requires: ≥3 minerals experimented AND ≥3 clues unlocked AND attempts remaining.
   * @returns {{ allowed: boolean, reason: string }}
   */
  canSubmitKey() {
    if (this.submitAttempts >= this.maxSubmitAttempts) {
      return { allowed: false, reason: '시도 횟수를 모두 소진했습니다.' };
    }
    const experimentedCount = _countExperimented(this.experimentRecords);
    if (experimentedCount < 3) {
      return {
        allowed: false,
        reason: `실험 증거가 부족합니다. (현재 ${experimentedCount}/3 광물 실험 완료)\n3가지 이상의 광물을 실험해보세요.`,
      };
    }
    if (this.unlockedClues.length < 3) {
      return {
        allowed: false,
        reason: `단서가 부족합니다. (현재 ${this.unlockedClues.length}/3 단서 발견)\n실험실에서 더 다양한 실험을 진행해보세요.`,
      };
    }
    return { allowed: true, reason: '' };
  }

  /**
   * Validates all 3 submitted mineral IDs against the key minerals (order-independent).
   * Increments submitAttempts regardless of result.
   * @param {string[]} mineralIds  Array of 3 mineral ID strings from the slots.
   * @returns {boolean} True if the submitted set exactly matches keyMinerals.
   */
  checkAllSlots(mineralIds) {
    this.submitAttempts++;
    if (!Array.isArray(mineralIds) || mineralIds.length !== 3) return false;
    const keySet = new Set(this.keyMinerals);
    const subSet = new Set(mineralIds);
    if (subSet.size !== 3) return false;
    for (const id of keySet) { if (!subSet.has(id)) return false; }
    return true;
  }

  /** How many submit attempts remain. */
  getSubmitAttemptsLeft() {
    return Math.max(0, this.maxSubmitAttempts - this.submitAttempts);
  }

  /** True if mineralId has had at least one experiment of any type recorded. */
  hasAnyExperiment(mineralId) {
    const rec = this.experimentRecords[mineralId];
    return !!(rec && (rec.streakTested || rec.acidTested || rec.magnetTested || rec.hardnessTested));
  }
}
