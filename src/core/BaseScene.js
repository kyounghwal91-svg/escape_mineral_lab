import * as PIXI from 'pixi.js';

/**
 * 모든 씬이 상속받는 기반 클래스.
 * PIXI.Container를 직접 확장하지 않고 내부에 container를 보유하는 컴포지션 방식.
 */
export class BaseScene {
  constructor() {
    this.container = new PIXI.Container();
    this.sceneManager = null; // GameApp에서 주입
  }

  /**
   * 씬 진입 시 호출. 오버라이드하여 UI 구성.
   * @param {Object} data - 이전 씬에서 전달되는 데이터
   */
  async onEnter(data = {}) {
    if (data.sceneManager) {
      this.sceneManager = data.sceneManager;
    }
  }

  /**
   * 씬 퇴장 시 호출. 오버라이드하여 이벤트 정리.
   */
  async onExit() {}

  /**
   * 매 프레임 호출. 오버라이드하여 애니메이션/로직 처리.
   * @param {number} delta - 프레임 델타
   */
  update(delta) {}

  /**
   * 씬 리소스 완전 해제.
   */
  destroy() {
    this.container.destroy({ children: true });
  }
}
