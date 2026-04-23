export class SafetySystem {
  constructor() {
    // 보호구 착용 상태
    this.equipped = new Set(); // 'gloves' | 'goggles' | 'coat'
  }

  wear(item) { this.equipped.add(item); }
  remove(item) { this.equipped.delete(item); }
  isWearing(item) { return this.equipped.has(item); }
  isAllEquipped() {
    return this.equipped.has('gloves') &&
           this.equipped.has('goggles') &&
           this.equipped.has('coat');
  }

  /**
   * 실험 전 패널티 계산 (팝업마다 매번 적용)
   * @param {'streak'|'acid'|'magnet'} experimentType
   * @returns {{damage: number, reason: string}|null}
   */
  getPenalty(experimentType) {
    if (experimentType === 'acid' && !this.equipped.has('gloves')) {
      return { damage: 30, reason: '장갑 없이 염산을 사용했습니다! (-30 HP)' };
    }
    if (!this.equipped.has('goggles') || !this.equipped.has('coat')) {
      return { damage: 20, reason: '안전장비를 착용하지 않았습니다! (-20 HP)' };
    }
    return null;
  }

  reset() {
    this.equipped.clear();
  }
}
