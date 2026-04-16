import * as PIXI from 'pixi.js';

export class SceneManager {
  constructor(app) {
    this.app = app;
    this.currentScene = null;
    this.registry = new Map();
    this._transitioning = false;

    // 페이드용 검정 오버레이
    this._fadeOverlay = new PIXI.Graphics();
    this._fadeOverlay.beginFill(0x000000);
    this._fadeOverlay.drawRect(0, 0, app.screen.width, app.screen.height);
    this._fadeOverlay.endFill();
    this._fadeOverlay.alpha = 0;
    this._fadeOverlay.zIndex = 9999;
    this._fadeOverlay.eventMode = 'none'; // 이벤트 완전 차단 — alpha=0이어도 히트테스트 가로채는 버그 방지
    // 오버레이는 나중에 stage에 추가
  }

  /**
   * 씬 팩토리 등록
   * @param {string} name - 씬 이름 키
   * @param {Function} factory - () => Promise<{default: class}> 형태의 동적 임포트 함수
   */
  register(name, factory) {
    this.registry.set(name, factory);
  }

  /**
   * 씬 전환 (페이드아웃 → 교체 → 페이드인)
   * @param {string} name - 등록된 씬 이름
   * @param {Object} data - 다음 씬에 전달할 데이터
   */
  async changeScene(name, data = {}) {
    if (this._transitioning) return;
    if (!this.registry.has(name)) {
      console.error(`[SceneManager] 등록되지 않은 씬: ${name}`);
      return;
    }

    this._transitioning = true;

    try {
      // 페이드 오버레이를 stage 최상단에 추가
      if (!this._fadeOverlay.parent) {
        this.app.stage.addChild(this._fadeOverlay);
      }

      // 1. 페이드 아웃 (alpha 0 → 1, 0.3s)
      await this._fade(0, 1, 300);

      // 2. 현재 씬 정리
      if (this.currentScene) {
        await this.currentScene.onExit();
        this.app.stage.removeChild(this.currentScene.container);
        this.currentScene.destroy();
        this.currentScene = null;
      }

      // 3. 새 씬 생성
      const module = await this.registry.get(name)();
      const SceneClass = module.default;
      this.currentScene = new SceneClass();
      this.app.stage.addChildAt(this.currentScene.container, 0);

      // sceneManager 주입 포함
      await this.currentScene.onEnter({ ...data, sceneManager: this });

      // 4. 페이드 인 (alpha 1 → 0, 0.3s)
      await this._fade(1, 0, 300);
    } catch (err) {
      console.error(`[SceneManager] 씬 전환 오류 (${name}):`, err);
      this._fadeOverlay.alpha = 0;
    } finally {
      this._transitioning = false;
    }
  }

  /**
   * ticker 기반 alpha 트윈 (gsap 없이 구현)
   */
  _fade(fromAlpha, toAlpha, durationMs) {
    return new Promise((resolve) => {
      this._fadeOverlay.alpha = fromAlpha;
      const totalFrames = Math.ceil((durationMs / 1000) * this.app.ticker.FPS);
      let frame = 0;

      const tick = () => {
        frame++;
        const progress = Math.min(frame / totalFrames, 1);
        this._fadeOverlay.alpha = fromAlpha + (toAlpha - fromAlpha) * progress;
        if (progress >= 1) {
          this.app.ticker.remove(tick);
          resolve();
        }
      };
      this.app.ticker.add(tick);
    });
  }

  /**
   * 매 프레임 업데이트 위임
   */
  update(delta) {
    this.currentScene?.update(delta);
  }

  /**
   * 현재 씬을 스택에 보존하고 새 씬을 위에 올림 (ExperimentScene 용)
   */
  async pushScene(name, data = {}) {
    if (this._transitioning) return;
    if (!this.registry.has(name)) {
      console.error(`[SceneManager] 등록되지 않은 씬: ${name}`);
      return;
    }

    this._transitioning = true;
    if (!this._sceneStack) this._sceneStack = [];

    if (!this._fadeOverlay.parent) {
      this.app.stage.addChild(this._fadeOverlay);
    }

    await this._fade(0, 1, 200);

    // 현재 씬은 숨기고 스택에 보존
    if (this.currentScene) {
      this.currentScene.container.visible = false;
      this._sceneStack.push(this.currentScene);
    }

    const module = await this.registry.get(name)();
    const SceneClass = module.default;
    this.currentScene = new SceneClass();
    this.app.stage.addChild(this.currentScene.container);
    await this.currentScene.onEnter({ ...data, sceneManager: this });

    await this._fade(1, 0, 200);
    this._transitioning = false;
  }

  /**
   * 스택에서 이전 씬 복원
   */
  async popScene() {
    if (this._transitioning) return;
    if (!this._sceneStack || this._sceneStack.length === 0) return;

    this._transitioning = true;

    await this._fade(0, 1, 200);

    await this.currentScene.onExit();
    this.app.stage.removeChild(this.currentScene.container);
    this.currentScene.destroy();

    this.currentScene = this._sceneStack.pop();
    this.currentScene.container.visible = true;

    await this._fade(1, 0, 200);
    this._transitioning = false;
  }

  getCurrentScene() {
    return this.currentScene;
  }
}
