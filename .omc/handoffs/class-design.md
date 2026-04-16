# 핵심 클래스 설계서

> "탈출! 미치광이 과학자의 광물 실험실" - TypeScript + PixiJS 기반

---

## 1. SceneManager

씬 전환 및 PixiJS Application 생명주기를 관리하는 최상위 컨트롤러.

### 역할
- PixiJS `Application` 인스턴스 보유 및 초기화
- 씬(Scene) 간 전환 관리 (인트로 → 안전준비 → 메인랩 → 실험상세 → 탈출문 → 엔딩)
- 씬 진입/퇴장 시 리소스 로드/해제
- 전역 UI 레이어(HP바, 타이머) 유지

### 주요 속성
```typescript
class SceneManager {
  private app: PIXI.Application;
  private currentScene: Scene | null;
  private sceneStack: Scene[];          // 씬 히스토리 (뒤로가기 지원)
  private globalUILayer: PIXI.Container; // HP바, 타이머 등 항상 표시되는 UI
  private scenes: Map<SceneType, () => Scene>; // 씬 팩토리 레지스트리
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(canvasEl: HTMLCanvasElement): Promise<void>` | PixiJS Application 생성, 캔버스 마운트, 전역 UI 레이어 초기화 |
| `registerScene(type: SceneType, factory: () => Scene): void` | 씬 팩토리 등록 |
| `goTo(type: SceneType, data?: any): Promise<void>` | 현재 씬 `onExit()` → 새 씬 `onEnter(data)` 전환 |
| `pushScene(type: SceneType, data?: any): Promise<void>` | 스택에 현재 씬 보존 후 새 씬 전환 (실험 상세 → 메인 복귀용) |
| `popScene(): Promise<void>` | 스택에서 이전 씬 복원 |
| `getApp(): PIXI.Application` | PixiJS Application 참조 반환 |

### 씬 인터페이스
```typescript
enum SceneType {
  INTRO = 'intro',
  SAFETY_PREP = 'safety_prep',
  MAIN_LAB = 'main_lab',
  EXPERIMENT_DETAIL = 'experiment_detail',
  DOOR = 'door',
  ENDING = 'ending',
}

interface Scene {
  container: PIXI.Container;
  onEnter(data?: any): Promise<void>;   // 씬 진입 시 초기화
  onExit(): Promise<void>;              // 씬 퇴장 시 정리
  update(delta: number): void;          // 매 프레임 업데이트
  destroy(): void;                      // 리소스 해제
}
```

### 의존관계
- **의존 없음** (최상위 컨트롤러, 다른 매니저들은 각 Scene 구현체에서 주입)

---

## 2. MineralManager

광물 5종의 데이터 정의, 열쇠 광물 랜덤 생성, 실험 결과 기록을 담당.

### 역할
- 광물 5종 속성 데이터 관리 (조흔색, 굳기, 염산 반응, 자성)
- 열쇠 광물 3종 랜덤 선정 (필수 페어 규칙 적용)
- 각 광물별 실험 수행 결과 기록 (도감 데이터)
- 열쇠 정답 검증

### 주요 속성
```typescript
interface MineralData {
  id: MineralId;
  name: string;                    // 석영, 장석, 흑운모, 방해석, 자철석
  appearance: string;              // 겉보기색
  streakColor: StreakColor;        // 조흔색: 'none' | 'white' | 'black'
  hardness: Hardness;              // 굳기: 'high' | 'medium' | 'low'
  acidReaction: boolean;           // 염산 반응 여부
  magnetic: boolean;               // 자성 여부
  spriteAsset: string;             // 스프라이트 에셋 경로
  closeUpAsset: string;            // 확대 에셋 경로
}

enum MineralId {
  QUARTZ = 'quartz',         // 석영
  FELDSPAR = 'feldspar',     // 장석
  BIOTITE = 'biotite',       // 흑운모
  CALCITE = 'calcite',       // 방해석
  MAGNETITE = 'magnetite',   // 자철석
}

type StreakColor = 'none' | 'white' | 'black';
type Hardness = 'high' | 'medium' | 'low';

interface ExperimentRecord {
  streakTested: boolean;
  streakColor?: StreakColor;
  hardnessTested: boolean;
  hardness?: Hardness;
  acidTested: boolean;
  acidReaction?: boolean;
  magnetTested: boolean;
  magnetic?: boolean;
}

class MineralManager {
  private minerals: Map<MineralId, MineralData>;
  private keyMinerals: MineralId[];              // 정답 열쇠 광물 3종
  private experimentRecords: Map<MineralId, ExperimentRecord>; // 실험 기록
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(): void` | 광물 5종 데이터 초기화, 열쇠 광물 생성 |
| `generateKeyMinerals(): MineralId[]` | 필수 페어 규칙 적용하여 3종 랜덤 선정 |
| `getMineral(id: MineralId): MineralData` | 특정 광물 데이터 반환 |
| `getAllMinerals(): MineralData[]` | 전체 광물 목록 반환 |
| `recordExperiment(mineralId: MineralId, type: ExperimentType, result: any): void` | 실험 결과 기록 (도감 자동 업데이트) |
| `getExperimentRecord(mineralId: MineralId): ExperimentRecord` | 특정 광물의 실험 기록 반환 |
| `getAllRecords(): Map<MineralId, ExperimentRecord>` | 전체 도감 데이터 반환 |
| `validateKeyAnswer(slots: MineralId[]): boolean` | 열쇠 3종 정답 검증 |
| `getKeyMinerals(): MineralId[]` | 정답 열쇠 반환 (디버그/힌트용) |

### 열쇠 생성 알고리즘
```
1. [석영, 방해석] 중 1종 랜덤 선택 → pairA
2. [흑운모, 자철석] 중 1종 랜덤 선택 → pairB
3. 나머지 3종 중 1종 랜덤 선택 → third (pairA, pairB 제외)
4. 셔플하여 반환 [pairA, pairB, third]
```

### 의존관계
- **GameStateManager** (실험 결과 기록 시 도감 상태 변경 이벤트 발행)

---

## 3. ExperimentLogic

각 실험 도구별 물리/시각 처리 로직을 담당.

### 역할
- 조흔판 실험: 드래그 궤적 → 선(Line) 생성 + 조흔색 결정
- 염산 실험: 스포이트 드래그 → GIF/애니메이션 재생 + 반응 판정
- 자석/클립 실험: 클립 드래그 → 붙거나 튕김 애니메이션 + 자성 판정
- 굳기 실험: 비교 광물로 긁기 → 흠집 생성 여부
- 안전 장비 미착용 시 패널티 트리거

### 주요 속성
```typescript
enum ExperimentType {
  STREAK = 'streak',       // 조흔색
  ACID = 'acid',           // 염산 반응
  MAGNET = 'magnet',       // 자성
  HARDNESS = 'hardness',   // 굳기
}

enum ToolType {
  STREAK_PLATE = 'streak_plate',  // 조흔판
  HCL_DROPPER = 'hcl_dropper',   // 염산 스포이트
  CLIP = 'clip',                   // 클립
  COMPARE_MINERAL = 'compare_mineral', // 비교 광물
}

class ExperimentLogic {
  private mineralManager: MineralManager;
  private safetySystem: SafetySystem;
  private audioManager: AudioManager;
  private gameState: GameStateManager;
  private currentMineral: MineralId | null;
  private currentTool: ToolType | null;
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `setCurrentMineral(id: MineralId): void` | 현재 실험 대상 광물 설정 |
| `startExperiment(tool: ToolType): boolean` | 실험 시작 전 안전 검사 수행, 가능 여부 반환 |
| `executeStreak(points: PIXI.Point[]): StreakResult` | 조흔판 드래그 궤적 → 선 색상(white/black/none) 결정 및 SFX 재생 |
| `executeAcid(targetPos: PIXI.Point): AcidResult` | 염산 투하 → 반응 GIF 재생 여부 결정, 맨손 체크 |
| `executeMagnet(targetPos: PIXI.Point): MagnetResult` | 클립 드래그 → 붙음/튕김 모션 결정 |
| `executeHardness(points: PIXI.Point[]): HardnessResult` | 비교 광물 긁기 → 흠집 생성 여부 |
| `resetExperiment(): void` | 현재 광물의 실험 흔적 초기화 (세척 버튼) |

### 실험 결과 타입
```typescript
interface StreakResult {
  color: StreakColor;
  sfxId: string;         // 석영→단단한 소리, 방해석→사각거리는 소리
  linePoints: PIXI.Point[];
}

interface AcidResult {
  reacted: boolean;
  animationAsset: string | null;  // 거품 GIF 경로 (반응 시)
  penaltyApplied: boolean;        // 맨손 패널티 적용 여부
}

interface MagnetResult {
  attracted: boolean;
  motionType: 'attach' | 'bounce'; // 붙음 or 튕김
  sfxId: string;
}

interface HardnessResult {
  scratched: boolean;    // 흠집 생성 여부
  hardness: Hardness;
  sfxId: string;
}
```

### 의존관계
- **MineralManager** (광물 속성 조회, 실험 결과 기록)
- **SafetySystem** (보호구 착용 상태 검사)
- **AudioManager** (실험별 SFX 재생)
- **GameStateManager** (HP 패널티 적용)

---

## 4. GameStateManager

게임 전체 상태를 중앙에서 관리하는 상태 저장소. EventEmitter 패턴으로 상태 변경 알림.

### 역할
- 타이머 (600초) 카운트다운 관리
- HP 관리 (100에서 시작, 0 도달 시 게임 오버)
- 열쇠 슬롯 상태 (문에 넣은 광물 3종 추적)
- 도감 체크 상태 통합 관리
- 게임 오버 / 클리어 조건 판정
- 이벤트 기반 상태 변경 통지

### 주요 속성
```typescript
type GameEvent =
  | 'hp_changed'
  | 'timer_tick'
  | 'timer_expired'
  | 'game_over'
  | 'game_clear'
  | 'key_slot_changed'
  | 'log_updated';

interface GameState {
  hp: number;
  maxHp: number;
  timerSeconds: number;
  keySlots: (MineralId | null)[];  // 길이 3
  isGameOver: boolean;
  isCleared: boolean;
  endingType: EndingType | null;
}

enum EndingType {
  PERFECT = 'perfect',     // HP 100 + 성공
  BARELY = 'barely',       // HP 1~99 + 성공
  FAILURE = 'failure',     // 시간 초과 or HP 0
}

class GameStateManager {
  private state: GameState;
  private timerHandle: number | null;
  private listeners: Map<GameEvent, Set<(...args: any[]) => void>>;
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(): void` | 상태 초기화 (HP=100, timer=600, 슬롯 비움) |
| `startTimer(): void` | 카운트다운 시작, 매초 `timer_tick` 이벤트 발행 |
| `stopTimer(): void` | 카운트다운 정지 |
| `getTimeRemaining(): number` | 남은 시간(초) 반환 |
| `applyDamage(amount: number, reason: string): void` | HP 차감 + `hp_changed` 이벤트. HP 0 이하 시 `game_over` 발행 |
| `getHp(): number` | 현재 HP 반환 |
| `setKeySlot(index: number, mineralId: MineralId): void` | 열쇠 슬롯에 광물 배치 |
| `removeKeySlot(index: number): void` | 열쇠 슬롯에서 광물 제거 |
| `getKeySlots(): (MineralId \| null)[]` | 현재 슬롯 상태 반환 |
| `determineEnding(): EndingType` | 엔딩 타입 결정 (HP 기반) |
| `on(event: GameEvent, callback): void` | 이벤트 리스너 등록 |
| `off(event: GameEvent, callback): void` | 이벤트 리스너 해제 |
| `emit(event: GameEvent, ...args): void` | 이벤트 발행 (private) |
| `getState(): Readonly<GameState>` | 현재 전체 상태 스냅샷 반환 |

### 의존관계
- **의존 없음** (순수 상태 저장소, 다른 클래스들이 이 클래스에 의존)

---

## 5. SafetySystem

보호구 착용 상태를 추적하고, 실험 전 안전 검사를 수행하며, HP 패널티를 적용.

### 역할
- 보안경, 장갑, 실험복 착용 상태 추적
- 실험 도구 사용 전 착용 상태 검사
- 미착용 시 HP 패널티 적용 및 경고 UI 트리거
- 도구별 특수 패널티 처리 (염산 맨손 사용 등)

### 주요 속성
```typescript
enum PPEType {
  GOGGLES = 'goggles',     // 보안경
  GLOVES = 'gloves',       // 장갑
  LAB_COAT = 'lab_coat',   // 실험복
}

interface PenaltyRule {
  condition: (equipped: Set<PPEType>, tool: ToolType) => boolean;
  damage: number;
  message: string;
}

class SafetySystem {
  private equipped: Set<PPEType>;
  private gameState: GameStateManager;
  private penaltyRules: PenaltyRule[];
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(): void` | 착용 상태 초기화 (모두 미착용), 패널티 규칙 등록 |
| `equip(ppe: PPEType): void` | 보호구 착용 |
| `unequip(ppe: PPEType): void` | 보호구 해제 |
| `isEquipped(ppe: PPEType): boolean` | 특정 보호구 착용 여부 |
| `isFullyEquipped(): boolean` | 3종 모두 착용 여부 |
| `checkSafety(tool: ToolType): SafetyCheckResult` | 도구 사용 전 안전 검사 수행 |
| `applyPenalty(result: SafetyCheckResult): void` | 패널티 HP 차감 및 피드백 이벤트 발행 |

### 패널티 규칙
```typescript
const PENALTY_RULES: PenaltyRule[] = [
  {
    // 안전장비 미착용 상태에서 아무 실험 시도
    condition: (equipped, tool) => equipped.size < 3,
    damage: 20,
    message: '안전 장비를 착용하지 않아 부상을 입었습니다!',
  },
  {
    // 장갑 미착용 상태에서 염산 사용
    condition: (equipped, tool) =>
      tool === ToolType.HCL_DROPPER && !equipped.has(PPEType.GLOVES),
    damage: 30,
    message: '맨손으로 염산을 만져 심각한 화상을 입었습니다!',
  },
];
```

### SafetyCheckResult
```typescript
interface SafetyCheckResult {
  safe: boolean;
  penalties: { damage: number; message: string }[];
  totalDamage: number;
}
```

### 의존관계
- **GameStateManager** (HP 패널티 적용)

---

## 6. UIManager

게임 전체의 HUD 요소와 팝업 UI를 렌더링하고 업데이트.

### 역할
- HP바 렌더링 및 애니메이션 (피격 시 붉은색 점멸)
- 타이머 디스플레이 (카운트다운)
- 자동 도감 팝업 렌더링
- 과학자 대사 텍스트박스 (타이핑 효과)
- 경고/알림 팝업

### 주요 속성
```typescript
class UIManager {
  private hpBar: HPBarComponent;
  private timerDisplay: TimerDisplayComponent;
  private logPopup: LogPopupComponent;
  private dialogueBox: DialogueBoxComponent;
  private alertPopup: AlertPopupComponent;
  private uiContainer: PIXI.Container;
  private gameState: GameStateManager;
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(stage: PIXI.Container): void` | UI 컨테이너 생성, 전역 이벤트 리스너 바인딩 |
| `updateHP(current: number, max: number): void` | HP바 너비 갱신 + 감소 시 붉은색 점멸 |
| `updateTimer(seconds: number): void` | 타이머 텍스트 갱신 (MM:SS 형식) |
| `showDialogue(text: string, character?: string): Promise<void>` | 과학자 대사를 타이핑 효과로 출력 (완료 시 resolve) |
| `showLog(records: Map<MineralId, ExperimentRecord>): void` | 도감 팝업 열기 (실험 결과 체크 표시) |
| `hideLog(): void` | 도감 팝업 닫기 |
| `showAlert(message: string, type: 'warning' \| 'info'): void` | 경고/안내 팝업 표시 |
| `hideAlert(): void` | 팝업 닫기 |
| `showDamageFlash(): void` | 화면 붉은색 점멸 효과 |
| `destroy(): void` | 모든 UI 컴포넌트 정리 |

### UI 컴포넌트 인터페이스
```typescript
interface UIComponent {
  container: PIXI.Container;
  init(): void;
  update(data: any): void;
  show(): void;
  hide(): void;
  destroy(): void;
}
```

### 의존관계
- **GameStateManager** (HP, 타이머 이벤트 구독)
- **MineralManager** (도감 데이터 조회)

---

## 7. AudioManager

게임 내 모든 효과음(SFX) 및 BGM 재생을 관리.

### 역할
- 실험별 SFX 재생 (석영 긁기, 방해석 긁기, 자철석 클립 등)
- 과학자 대사 타이핑 효과음
- 배경 음악(BGM) 루프 재생
- 음량 조절 및 음소거

### 주요 속성
```typescript
interface SoundEntry {
  id: string;
  src: string;
  volume: number;
  loop: boolean;
}

class AudioManager {
  private sounds: Map<string, HTMLAudioElement>;
  private bgm: HTMLAudioElement | null;
  private masterVolume: number;
  private sfxVolume: number;
  private isMuted: boolean;
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(): Promise<void>` | 사운드 에셋 사전 로드 |
| `loadSound(id: string, src: string): Promise<void>` | 개별 사운드 파일 로드 |
| `playSFX(id: string): void` | SFX 1회 재생 |
| `playBGM(id: string): void` | BGM 루프 재생 |
| `stopBGM(): void` | BGM 정지 |
| `setMasterVolume(vol: number): void` | 전체 음량 (0.0 ~ 1.0) |
| `setSFXVolume(vol: number): void` | SFX 음량 |
| `mute(): void` | 음소거 |
| `unmute(): void` | 음소거 해제 |

### SFX ID 매핑
```typescript
const SFX_MAP = {
  // 조흔 실험
  STREAK_QUARTZ: 'streak_quartz',       // 석영 긁기 - 묵직하고 단단한 소리
  STREAK_CALCITE: 'streak_calcite',     // 방해석 긁기 - 가볍고 사각거리는 소리
  STREAK_DEFAULT: 'streak_default',     // 기본 긁기 소리 (장석, 흑운모)

  // 염산 실험
  ACID_REACT: 'acid_react',             // 방해석 거품 - 치익 소리
  ACID_NO_REACT: 'acid_no_react',       // 반응 없음 - 물방울 소리

  // 자성 실험
  MAGNET_ATTACH: 'magnet_attach',       // 자철석 - 클립 "착" 붙는 소리
  MAGNET_BOUNCE: 'magnet_bounce',       // 비자성 - 클립 튕기는 소리

  // UI
  TYPING: 'typing',                     // 과학자 대사 타이핑 효과음
  DAMAGE: 'damage',                     // HP 감소 경고음
  DOOR_OPEN: 'door_open',              // 탈출 문 열림
  DOOR_FAIL: 'door_fail',             // 열쇠 불일치
  BUTTON_CLICK: 'button_click',        // 버튼 클릭
} as const;
```

### 의존관계
- **의존 없음** (다른 클래스들이 SFX 재생을 위해 호출)

---

## 8. DragController

PixiJS 기반 드래그 인터랙션을 통합 처리하는 유틸리티 컨트롤러.

### 역할
- 드래그 가능 오브젝트 등록/해제
- 드래그 시작/이동/종료 이벤트 핸들링
- 드래그 궤적 수집 (조흔판 실험용)
- 드롭 존(drop zone) 히트 테스트
- 보호구 착용, 열쇠 슬롯 투입 등 공통 드래그 처리

### 주요 속성
```typescript
interface DragTarget {
  sprite: PIXI.Sprite;
  id: string;
  returnOnFail: boolean;        // 드롭 실패 시 원위치 복귀
  originalPosition: PIXI.Point;
  constrainToParent: boolean;   // 부모 컨테이너 내 제한
}

interface DropZone {
  id: string;
  bounds: PIXI.Rectangle;
  accepts: string[];            // 허용되는 드래그 대상 id 목록
  onDrop: (targetId: string) => void;
}

class DragController {
  private dragTargets: Map<string, DragTarget>;
  private dropZones: Map<string, DropZone>;
  private activeDrag: { target: DragTarget; offset: PIXI.Point; trail: PIXI.Point[] } | null;
  private stage: PIXI.Container;
}
```

### 주요 메서드
| 메서드 | 설명 |
|---|---|
| `init(stage: PIXI.Container): void` | 스테이지 참조 설정, 전역 포인터 이벤트 바인딩 |
| `registerDraggable(config: DragTarget): void` | 드래그 가능 오브젝트 등록 |
| `unregisterDraggable(id: string): void` | 드래그 대상 해제 |
| `registerDropZone(config: DropZone): void` | 드롭 존 등록 |
| `unregisterDropZone(id: string): void` | 드롭 존 해제 |
| `onDragStart(event: PIXI.FederatedPointerEvent): void` | 드래그 시작 처리 |
| `onDragMove(event: PIXI.FederatedPointerEvent): void` | 드래그 이동 처리 + 궤적 기록 |
| `onDragEnd(event: PIXI.FederatedPointerEvent): void` | 드래그 종료 → 드롭 존 히트 테스트 → 콜백 실행 or 원위치 |
| `getDragTrail(): PIXI.Point[]` | 현재 드래그 궤적 반환 (조흔 실험에서 선 생성용) |
| `clearAll(): void` | 모든 드래그 대상 및 드롭 존 해제 |

### 의존관계
- **의존 없음** (범용 유틸리티, 각 씬에서 인스턴스 활용)

---

## 클래스 의존관계 다이어그램

```
                    ┌──────────────┐
                    │ SceneManager │  (최상위 컨트롤러)
                    └──────┬───────┘
                           │ 각 Scene 구현체에서 주입
                           ▼
        ┌──────────────────────────────────────┐
        │           Scene 구현체들              │
        │  (IntroScene, MainLabScene, etc.)     │
        └──┬───────┬──────┬──────┬─────┬───────┘
           │       │      │      │     │
           ▼       ▼      ▼      ▼     ▼
    ┌──────────┐ ┌────────────────┐ ┌───────────┐
    │UIManager │ │ExperimentLogic │ │DragControl│
    └────┬─────┘ └──┬──┬──┬──────┘ └───────────┘
         │          │  │  │
         │          │  │  └──► SafetySystem ──► GameStateManager
         │          │  └─────► AudioManager
         │          └────────► MineralManager ──► GameStateManager
         │
         └──────────────────► GameStateManager (이벤트 구독)

    ※ 화살표 = "~를 의존한다 / 사용한다"
```

---

## 이벤트 흐름 예시

### 조흔판 실험 흐름
```
1. DragController: 조흔판을 광물 위로 드래그
2. ExperimentLogic.startExperiment(STREAK_PLATE)
   → SafetySystem.checkSafety(STREAK_PLATE) → 안전 검사
   → (미착용 시) GameStateManager.applyDamage(20) → UIManager.updateHP() + showDamageFlash()
3. ExperimentLogic.executeStreak(dragTrail)
   → MineralManager에서 해당 광물의 streakColor 조회
   → AudioManager.playSFX(STREAK_QUARTZ)
   → MineralManager.recordExperiment() → 도감 업데이트
4. UIManager: 조흔색 선 렌더링
```

### 열쇠 검증 흐름
```
1. DragController: 광물을 문의 슬롯으로 드래그
2. GameStateManager.setKeySlot(index, mineralId)
3. 3슬롯 모두 채워지면 → MineralManager.validateKeyAnswer(slots)
   → true: GameStateManager.determineEnding() → SceneManager.goTo(ENDING, endingType)
   → false: 광물 튕겨나감 애니메이션 + 힌트 텍스트 출력
```

---

## 초기화 순서 (부트스트랩)

```typescript
async function bootstrap() {
  // 1. 의존성 없는 매니저 먼저 초기화
  const gameState = new GameStateManager();
  gameState.init();

  const audioManager = new AudioManager();
  await audioManager.init();

  const dragController = new DragController();

  // 2. gameState에 의존하는 매니저
  const safetySystem = new SafetySystem(gameState);
  safetySystem.init();

  const mineralManager = new MineralManager();
  mineralManager.init();

  // 3. 복합 의존성 매니저
  const experimentLogic = new ExperimentLogic(
    mineralManager, safetySystem, audioManager, gameState
  );

  const uiManager = new UIManager(gameState, mineralManager);

  // 4. SceneManager (최상위)
  const sceneManager = new SceneManager();
  await sceneManager.init(document.getElementById('game-canvas') as HTMLCanvasElement);

  // 5. 씬 팩토리 등록
  sceneManager.registerScene(SceneType.INTRO, () =>
    new IntroScene(uiManager, audioManager, dragController)
  );
  sceneManager.registerScene(SceneType.SAFETY_PREP, () =>
    new SafetyPrepScene(safetySystem, uiManager, dragController)
  );
  // ... 나머지 씬들

  // 6. 게임 시작
  uiManager.init(sceneManager.getApp().stage);
  dragController.init(sceneManager.getApp().stage);
  await sceneManager.goTo(SceneType.INTRO);
}
```
