import { MINERALS, KEY_PAIRING_RULES, getMineralById } from '../data/minerals.js';

function countTested(records, type) {
  const key = `${type}Tested`;
  return Object.values(records).filter((record) => record[key] === true).length;
}

function countExperimented(records) {
  return Object.values(records).filter(
    (record) => record.streakTested || record.acidTested || record.magnetTested || record.hardnessTested,
  ).length;
}

const CLUE_DEFINITIONS = [
  {
    id: 'clue_acid',
    text: '열쇠 광물 중 하나에 묽은 염산을 떨어뜨리면 거품이 생깁니다.',
    condition: (records) => countTested(records, 'acid') >= 1,
    validFor: (keys) => keys.some((id) => getMineralById(id)?.acidReaction === true),
  },
  {
    id: 'clue_magnet',
    text: '열쇠 광물 중 하나에는 자성이 있어 클립이 달라붙습니다.',
    condition: (records) => countTested(records, 'magnet') >= 1,
    validFor: (keys) => keys.some((id) => getMineralById(id)?.magnetic === true),
  },
  {
    id: 'clue_streak_black',
    text: '열쇠 광물 중 하나를 조흔판에 긁으면 검은색의 광물 가루가 나옵니다.',
    condition: (records) => countTested(records, 'streak') >= 1,
    validFor: (keys) => keys.some((id) => getMineralById(id)?.streakColor === 'black'),
  },
];

const STAGE1_HINTS = {
  quartz: 'N번 열쇠는 무색투명해.',
  feldspar: 'N번 열쇠는 흰색 또는 분홍색을 띠어.',
  biotite: 'N번 열쇠는 검은색을 띠어.',
  calcite: 'N번 열쇠는 무색투명해.',
  magnetite: 'N번 열쇠는 검은색을 띠어.',
};

const STAGE2_HINTS = {
  calcite: 'N번 열쇠에 묽은 염산을 떨어뜨리면 거품이 생겨.',
  magnetite: 'N번 열쇠에는 자성이 있어 클립이 달라붙어.',
  biotite: 'N번 열쇠를 조흔판에 긁으면 흰색의 광물 가루가 나와.',
  quartz: '석영과 방해석을 서로 긁었을 때, 긁히지 않는 광물이 N번 열쇠야.',
  feldspar: 'N번 열쇠의 조흔색은 흰색이야.',
};

const HINT_REVEAL_ORDER = [
  { index: 0, level: 1 },
  { index: 0, level: 2 },
  { index: 1, level: 1 },
  { index: 1, level: 2 },
  { index: 2, level: 1 },
  { index: 2, level: 2 },
];

export class MineralManager {
  constructor() {
    this.minerals = new Map();
    this.keyMinerals = [];
    this.experimentRecords = {};
    this.unlockedLevel = 0;
    this.correctSlots = [false, false, false];
    this.revealedHints = [];
    this.revealedColors = new Set();
    this.labIntroDialogueShown = false;
    this.hasVisitedDoor = false;
    this.experimentAttemptsBeforeDoor = 0;
    this.doorHintDialogueShown = false;
    this.unlockedClues = [];
    this.submitAttempts = 0;
    this.maxSubmitAttempts = 3;
    this.hintPanelLevels = [1, 0, 0];
    this.hintPanelProgress = 1;
  }

  init() {
    this.minerals.clear();
    MINERALS.forEach((mineral) => this.minerals.set(mineral.id, mineral));
    MINERALS.forEach((mineral) => {
      this.experimentRecords[mineral.id] = {
        streakTested: false,
        streakColor: null,
        acidTested: false,
        acidReacted: null,
        magnetTested: false,
        magnetic: null,
        hardnessTested: false,
        hardness: null,
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
    this.unlockedClues = [];
    this.submitAttempts = 0;
    this.hintPanelLevels = [1, 0, 0];
    this.hintPanelProgress = 1;
  }

  generateKeyMinerals() {
    const { pairA, pairB } = KEY_PAIRING_RULES;
    const pickA = pairA[Math.floor(Math.random() * pairA.length)];
    const pickB = pairB[Math.floor(Math.random() * pairB.length)];
    const rest = MINERALS.map((mineral) => mineral.id).filter((id) => id !== pickA && id !== pickB);
    const pickC = rest[Math.floor(Math.random() * rest.length)];
    const keys = [pickA, pickB, pickC];

    for (let i = keys.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }

    return keys;
  }

  getClue(index, isDetailed = false) {
    const mineralId = this.keyMinerals[index];
    if (!mineralId) return '데이터가 없습니다.';

    const hintMap = isDetailed ? STAGE2_HINTS : STAGE1_HINTS;
    const template = hintMap[mineralId] ?? '특징을 더 관찰해 보세요.';
    return template.replaceAll('N번', `${index + 1}번`);
  }

  getUnlockedClues() {
    const history = [];
    for (let i = 0; i <= this.unlockedLevel; i += 1) {
      history.push(this.getClue(i, false));
    }
    return history;
  }

  revealClue(index, isDetailed = false) {
    const clue = this.getClue(index, isDetailed);
    if (clue !== '데이터가 없습니다.' && !this.revealedHints.includes(clue)) {
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

  revealColor(id) {
    this.revealedColors.add(id);
  }

  isColorRevealed(id) {
    return this.revealedColors.has(id);
  }

  getMineral(id) {
    return this.minerals.get(id) ?? null;
  }

  getAllMinerals() {
    return [...this.minerals.values()];
  }

  getKeyMinerals() {
    return [...this.keyMinerals];
  }

  recordExperiment(mineralId, type, result) {
    const record = this.experimentRecords[mineralId];
    if (!record) return;

    if (type === 'streak') {
      record.streakTested = true;
      record.streakColor = result;
    }
    if (type === 'acid') {
      record.acidTested = true;
      record.acidReacted = result;
    }
    if (type === 'magnet') {
      record.magnetTested = true;
      record.magnetic = result;
    }
    if (type === 'hardness') {
      record.hardnessTested = true;
      record.hardness = result;
    }
  }

  getRecord(mineralId) {
    return this.experimentRecords[mineralId] ?? null;
  }

  getAllRecords() {
    return { ...this.experimentRecords };
  }

  advanceHintPanel() {
    if (this.hintPanelProgress >= HINT_REVEAL_ORDER.length) {
      return null;
    }

    const next = HINT_REVEAL_ORDER[this.hintPanelProgress];
    this.hintPanelLevels[next.index] = Math.max(this.hintPanelLevels[next.index], next.level);
    this.hintPanelProgress += 1;

    const text = this.getClue(next.index, next.level === 2);
    // Add to unlockedClues if not already there to keep consistency with the "Note" and submission logic
    if (!this.unlockedClues.some(c => c.text === text)) {
      this.unlockedClues.push({ id: `panel_${next.index}_${next.level}`, text });
    }

    return { ...next, text };
  }

  getHintPanelState() {
    return this.keyMinerals.map((mineralId, index) => ({
      index,
      mineralId,
      level: this.hintPanelLevels[index] ?? 0,
      stage1: this.getClue(index, false),
      stage2: this.getClue(index, true),
    }));
  }

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
    const record = this.experimentRecords[mineralId];
    return !!(record && record.streakTested && record.acidTested && record.magnetTested);
  }

  checkSlot(index, mineralId) {
    const isCorrect = this.keyMinerals[index] === mineralId;
    if (isCorrect) {
      this.correctSlots[index] = true;
      if (this.unlockedLevel === index && index < 2) {
        this.unlockedLevel += 1;
      }
    }
    return isCorrect;
  }

  isAllCorrect() {
    return this.correctSlots.every((value) => value === true);
  }

  tryUnlockClues() {
    const newlyUnlocked = [];
    for (const definition of CLUE_DEFINITIONS) {
      if (this.unlockedClues.some((clue) => clue.id === definition.id)) continue;
      if (definition.condition(this.experimentRecords) && definition.validFor(this.keyMinerals)) {
        const clue = { id: definition.id, text: definition.text };
        this.unlockedClues.push(clue);
        newlyUnlocked.push(clue);
      }
    }
    return newlyUnlocked;
  }

  canSubmitKey() {
    if (this.submitAttempts >= this.maxSubmitAttempts) {
      return { allowed: false, reason: '시도 횟수를 모두 사용했습니다.' };
    }

    const experimentedCount = countExperimented(this.experimentRecords);
    if (experimentedCount < 3) {
      return {
        allowed: false,
        reason: `실험 기록이 부족합니다. (현재 ${experimentedCount}/3 광물 실험 완료)\n3가지 이상 광물을 실험해 보세요.`,
      };
    }

    if (this.unlockedClues.length < 3) {
      return {
        allowed: false,
        reason: `단서가 부족합니다. (현재 ${this.unlockedClues.length}/3 단서 발견)\n실험대에서 다양한 실험을 진행해 보세요.`,
      };
    }

    return { allowed: true, reason: '' };
  }

  checkAllSlots(mineralIds) {
    this.submitAttempts += 1;
    if (!Array.isArray(mineralIds) || mineralIds.length !== 3) return false;

    const keySet = new Set(this.keyMinerals);
    const submitSet = new Set(mineralIds);
    if (submitSet.size !== 3) return false;

    for (const id of keySet) {
      if (!submitSet.has(id)) return false;
    }
    return true;
  }

  getSubmitAttemptsLeft() {
    return Math.max(0, this.maxSubmitAttempts - this.submitAttempts);
  }

  hasAnyExperiment(mineralId) {
    const record = this.experimentRecords[mineralId];
    return !!(record && (record.streakTested || record.acidTested || record.magnetTested || record.hardnessTested));
  }
}
