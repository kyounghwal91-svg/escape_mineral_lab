export class StatusManager {
  constructor() {
    this.hp = 100;
    this.maxHp = 100;
    this.timer = 600;
    this._interval = null;
    this._listeners = {};
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(listener => listener !== cb);
  }

  _emit(event, data) {
    (this._listeners[event] ?? []).forEach(cb => cb(data));
  }

  startTimer() {
    if (this._interval) return;
    this._interval = setInterval(() => {
      if (this.timer <= 0) return;
      this.timer--;
      this._emit('timerTick', this.timer);
      if (this.timer === 0) {
        this.stopTimer();
        this._emit('timerExpired');
      }
    }, 1000);
  }

  stopTimer() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  resumeTimer() {
    this.startTimer();
  }

  applyDamage(amount, reason = '') {
    this.hp = Math.max(0, this.hp - amount);
    this._emit('hpChanged', { hp: this.hp, amount, reason });
    if (this.hp === 0) {
      this.stopTimer();
      this._emit('gameOver');
    }
  }

  getTimeFormatted() {
    const m = String(Math.floor(this.timer / 60)).padStart(2, '0');
    const s = String(this.timer % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  determineEnding() {
    if (this.hp === 100) return 'perfect';
    if (this.hp > 0) return 'barely';
    return 'failure';
  }

  reset() {
    this.stopTimer();
    this.hp = 100;
    this.timer = 600;
    this._listeners = {};
  }
}
