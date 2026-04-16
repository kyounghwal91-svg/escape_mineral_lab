# 폴더 구조 설계: 탈출! 미치광이 과학자의 광물 실험실

## 프로젝트 루트

```
광물실험실/
├── index.html                    # HTML 진입점 (Canvas 컨테이너)
├── package.json                  # 의존성 관리 (PixiJS, TypeScript, Vite 등)
├── tsconfig.json                 # TypeScript 설정
├── vite.config.ts                # Vite 번들러 설정
├── .gitignore
├── public/                       # 정적 파일 (빌드 시 그대로 복사)
│   └── favicon.ico
├── src/                          # 소스 코드 루트
│   ├── main.ts                   # 앱 진입점 - PixiJS Application 초기화, 첫 씬 로드
│   ├── App.ts                    # Application 래퍼 - PixiJS App 설정, 리사이즈 핸들링
│   ├── constants.ts              # 전역 상수 (화면 크기, 타이머, HP 기본값 등)
│   ├── types.ts                  # 공통 타입 정의 (MineralType, ToolType, EndingType 등)
│   │
│   ├── scenes/                   # 씬(화면) 관리
│   │   ├── BaseScene.ts          # 씬 기본 클래스 - PIXI.Container 확장, 공통 라이프사이클
│   │   ├── IntroScene.ts         # 인트로 씬 - 시작 버튼, 과학자 대사 연출
│   │   ├── SafetyScene.ts        # 보호구 착용 씬 - 드래그로 보안경/장갑/실험복 착용
│   │   ├── MainLabScene.ts       # 메인 실험실 씬 - 광물 5종 배치, 도감/문 접근
│   │   ├── ExperimentScene.ts    # 광물 확대 실험 씬 - 도구 사용, 스크래치/염산/자성 실험
│   │   ├── DoorScene.ts          # 열쇠 확인 문 씬 - 광물 3종 투입, 힌트, 탈출 시도
│   │   └── EndingScene.ts        # 엔딩 씬 - 완벽/겨우/실패 3종 분기 연출
│   │
│   ├── managers/                 # 핵심 매니저 클래스 (싱글턴 패턴)
│   │   ├── SceneManager.ts       # 씬 전환 관리 - 씬 스택, 트랜지션 효과
│   │   ├── GameManager.ts        # 게임 상태 총괄 - HP, 타이머, 보호구 착용 상태, 게임 흐름
│   │   ├── MineralManager.ts     # 광물 데이터 관리 - 5종 광물 속성, 열쇠 광물 랜덤 선정
│   │   ├── AudioManager.ts       # 사운드 관리 - BGM, SFX 재생/정지, 볼륨 조절
│   │   └── AssetManager.ts       # 에셋 로딩 관리 - PIXI.Assets 래핑, 프리로드, 캐싱
│   │
│   ├── systems/                  # 게임 시스템 (독립적 기능 모듈)
│   │   ├── TimerSystem.ts        # 10분 카운트다운 타이머 - 시간 초과 시 실패 엔딩 트리거
│   │   ├── HPSystem.ts           # 체력 시스템 - HP 차감/회복, 0 도달 시 실패 엔딩 트리거
│   │   ├── SafetySystem.ts       # 안전장비 시스템 - 착용 여부 추적, 미착용 시 HP 페널티 적용
│   │   ├── ExperimentSystem.ts   # 실험 수행 시스템 - 도구별 상호작용 로직 (스크래치/염산/자성/굳기)
│   │   ├── LogbookSystem.ts      # 자동 도감 시스템 - 실험 결과 자동 기록, 체크 표시
│   │   └── KeySystem.ts          # 열쇠 판정 시스템 - 랜덤 열쇠 3종 생성, 정답 판정, 힌트 생성
│   │
│   ├── ui/                       # 재사용 UI 컴포넌트
│   │   ├── Button.ts             # 범용 버튼 - Normal/Hover/Click 상태, 클릭 콜백
│   │   ├── DialogBox.ts          # 대사창 - 과학자 대사 타이핑 효과, 클릭으로 넘기기
│   │   ├── HPBar.ts              # HP 바 UI - 체력 게이지 시각화, 감소 애니메이션
│   │   ├── TimerDisplay.ts       # 타이머 표시 UI - MM:SS 카운트다운, 긴급 시 빨간색 전환
│   │   ├── LogbookPopup.ts       # 도감 팝업 UI - 광물별 실험 결과 표/체크 표시
│   │   ├── ToolInventory.ts      # 도구함 UI - 조흔판/염산/클립/비교광물 아이콘 배치
│   │   ├── MineralSlot.ts        # 철문 광물 투입 슬롯 UI - 원형 홈, 드래그 앤 드롭 수용
│   │   ├── DamageOverlay.ts      # HP 감소 시 화면 붉은색 점멸 오버레이
│   │   └── TransitionOverlay.ts  # 씬 전환 시 페이드 인/아웃 오버레이
│   │
│   ├── objects/                  # 게임 오브젝트 (인터랙티브 스프라이트)
│   │   ├── Mineral.ts            # 광물 오브젝트 - 클릭/드래그 가능, 광물 타입별 속성 바인딩
│   │   ├── Tool.ts               # 도구 오브젝트 - 드래그 가능, 광물 위 드롭 시 실험 트리거
│   │   ├── SafetyGear.ts         # 보호구 오브젝트 - 드래그하여 캐릭터에 착용
│   │   ├── Character.ts          # 플레이어 캐릭터 - 보호구 착용 상태 시각화
│   │   └── Scientist.ts          # 과학자 캐릭터 - 대사 연출, 표정 변화 (인트로/엔딩)
│   │
│   ├── effects/                  # 시각/오디오 이펙트
│   │   ├── ScratchEffect.ts      # 스크래치 효과 - 드래그 궤적 따라 선 생성 (PIXI.Graphics)
│   │   ├── AcidEffect.ts         # 염산 반응 효과 - GIF/스프라이트시트 거품 애니메이션 재생
│   │   ├── MagnetEffect.ts       # 자성 반응 효과 - 클립 붙음/튕김 모션
│   │   └── ScreenFlash.ts        # 화면 점멸 효과 - HP 감소 시 붉은 번쩍임
│   │
│   ├── data/                     # 정적 게임 데이터 (JSON/상수)
│   │   ├── minerals.ts           # 광물 5종 속성 데이터 (겉보기색, 조흔색, 굳기, 염산반응, 자성)
│   │   ├── dialogs.ts            # 과학자 대사 텍스트 모음 (씬별, 힌트 등)
│   │   ├── safetyRules.ts        # 안전 규칙 및 HP 페널티 수치 데이터
│   │   └── assetManifest.ts      # 에셋 로딩 매니페스트 (경로, 키, 그룹 정의)
│   │
│   └── utils/                    # 유틸리티 함수
│       ├── math.ts               # 수학 유틸 (랜덤 선택, 클램프, 거리 계산)
│       ├── drag.ts               # 드래그 앤 드롭 헬퍼 (PixiJS 이벤트 래핑)
│       └── responsive.ts         # 반응형 레이아웃 유틸 (PC/태블릿 가로모드 대응)
│
└── assets/                       # 게임 에셋 루트
    ├── sprites/                  # 스프라이트 이미지
    │   ├── ui/                   # UI 관련 스프라이트
    │   │   ├── hp-bar-frame.png        # (G_02) HP/타이머 프레임
    │   │   ├── hp-bar-fill.png         # (G_02) HP 게이지 채움
    │   │   ├── timer-icon.png          # (G_02) 태엽 시계 아이콘
    │   │   ├── textbox-bg.png          # (G_03) 대사창 배경
    │   │   ├── logbook-icon.png        # (G_04) 도감 버튼 아이콘
    │   │   ├── logbook-bg.png          # (L_01) 도감 내지 배경
    │   │   ├── check-mark.png          # (L_03) 완료 체크 표시
    │   │   ├── x-mark.png              # (L_03) 미완료 X 표시
    │   │   ├── reset-btn.png           # (M_06) 초기화 버튼
    │   │   └── cursor/                 # (G_05) 커서 이미지
    │   │       ├── default.png
    │   │       ├── pointer.png
    │   │       └── tool.png
    │   │
    │   ├── characters/           # 캐릭터 스프라이트
    │   │   ├── player-base.png         # (P_01) 기본 캐릭터
    │   │   └── scientist.png           # (P_02) 미치광이 과학자 (상반신)
    │   │
    │   ├── safety-gear/          # 보호구 스프라이트
    │   │   ├── goggles.png             # (P_03) 보안경
    │   │   ├── lab-coat.png            # (P_04) 실험복
    │   │   └── gloves.png              # (P_05) 실험용 장갑
    │   │
    │   ├── tools/                # 실험 도구 스프라이트
    │   │   ├── streak-plate.png        # (M_02) 조흔판
    │   │   ├── acid-dropper.png        # (M_03) 염산 스포이트
    │   │   ├── clip.png                # (M_04) 클립
    │   │   └── compare-mineral.png     # (M_05) 비교용 광물 (석영 조각)
    │   │
    │   ├── minerals/             # 광물 스프라이트
    │   │   ├── thumbnails/       # 메인 실험실용 작은 아이콘
    │   │   │   ├── quartz-thumb.png        # 석영 썸네일
    │   │   │   ├── feldspar-thumb.png      # 장석 썸네일
    │   │   │   ├── biotite-thumb.png       # 흑운모 썸네일
    │   │   │   ├── calcite-thumb.png       # 방해석 썸네일
    │   │   │   └── magnetite-thumb.png     # 자철석 썸네일
    │   │   ├── closeups/         # 확대 실험용 고해상도
    │   │   │   ├── quartz.png              # (D_01) 석영 확대
    │   │   │   ├── feldspar.png            # (D_02) 장석 확대
    │   │   │   ├── biotite.png             # (D_03) 흑운모 확대
    │   │   │   ├── calcite.png             # (D_04) 방해석 확대
    │   │   │   └── magnetite.png           # (D_05) 자철석 확대
    │   │   └── logbook-icons/    # 도감용 아이콘
    │   │       ├── quartz-icon.png         # (L_02) 석영 아이콘
    │   │       ├── feldspar-icon.png       # (L_02) 장석 아이콘
    │   │       ├── biotite-icon.png        # (L_02) 흑운모 아이콘
    │   │       ├── calcite-icon.png        # (L_02) 방해석 아이콘
    │   │       └── magnetite-icon.png      # (L_02) 자철석 아이콘
    │   │
    │   └── backgrounds/          # 배경 이미지
    │       ├── lab-main.png            # (G_01) 메인 실험실 배경
    │       ├── lab-table.png           # (M_01) 실험대 (탑뷰)
    │       ├── door.png                # (ED_01) 탈출 철문
    │       ├── ending-perfect.png      # (ED_02) 완벽한 탈출 엔딩
    │       ├── ending-barely.png       # (ED_03) 겨우겨우 탈출 엔딩
    │       └── ending-fail.png         # (ED_04) 실험 실패 엔딩
    │
    ├── animations/               # 애니메이션 에셋
    │   ├── acid-bubble.gif             # (E_01) 염산 거품 GIF
    │   ├── acid-bubble.json            # (E_01) Lottie 대안 (선택)
    │   └── scratch-texture.png         # (E_02) 스크래치 선 텍스처
    │
    └── sounds/                   # 사운드 에셋
        ├── bgm/                  # 배경 음악
        │   ├── lab-ambient.mp3         # 실험실 분위기 BGM
        │   └── tension.mp3             # 시간 부족 시 긴박한 BGM
        │
        └── sfx/                  # 효과음
            ├── typing.mp3              # 과학자 대사 타이핑 효과음
            ├── scratch-hard.mp3        # 석영 긁기 (묵직하고 단단한 소리)
            ├── scratch-soft.mp3        # 방해석 긁기 (가볍고 사각거리는 소리)
            ├── scratch-normal.mp3      # 장석/흑운모/자철석 긁기 (보통 소리)
            ├── acid-fizz.mp3           # 염산 거품 소리 (치익-)
            ├── magnet-attach.mp3       # 클립 붙는 소리 (착!)
            ├── magnet-repel.mp3        # 클립 튕기는 소리
            ├── hp-damage.mp3           # HP 감소 경고음
            ├── equip.mp3               # 보호구 착용 소리
            ├── door-open.mp3           # 문 열리는 소리
            ├── door-fail.mp3           # 문 열기 실패 소리
            ├── btn-click.mp3           # 버튼 클릭 소리
            └── timer-warning.mp3       # 시간 부족 경고음
```

---

## 핵심 파일 역할 상세 설명

### 진입점

| 파일 | 역할 |
|---|---|
| `src/main.ts` | 앱 부트스트랩. PixiJS Application 생성, AssetManager로 에셋 프리로드, SceneManager 초기화 후 IntroScene 로드 |
| `src/App.ts` | PIXI.Application 래퍼. 캔버스 크기(1920x1080 기준), 리사이즈 핸들링, 가로모드 강제 등 설정 |

### 씬 (scenes/)

| 파일 | 역할 |
|---|---|
| `BaseScene.ts` | 모든 씬의 부모 클래스. `onEnter()`, `onExit()`, `update(delta)` 라이프사이클 메서드 정의 |
| `IntroScene.ts` | 게임 시작 화면. 어두운 실험실 배경, 과학자 실루엣, 경고 대사, [게임 시작] 버튼 |
| `SafetyScene.ts` | 보호구 3종(보안경/장갑/실험복)을 캐릭터에 드래그하여 착용. 모두 착용 시 [실험실 입장] 활성화 |
| `MainLabScene.ts` | 메인 실험실. 광물 5종 배치, 클릭 시 ExperimentScene으로 전환. 도감/철문 접근 가능 |
| `ExperimentScene.ts` | 광물 확대 실험. 도구함에서 도구를 드래그하여 광물에 적용. 스크래치/염산/자성/굳기 실험 수행 |
| `DoorScene.ts` | 탈출 문. 3개 원형 홈에 광물 드래그 투입, 과학자 힌트, [탈출 시도] 판정 |
| `EndingScene.ts` | 엔딩 3종 분기. 완벽(HP100)/겨우(HP1-99)/실패(시간초과 or HP0) 연출 |

### 매니저 (managers/)

| 파일 | 역할 |
|---|---|
| `SceneManager.ts` | 씬 전환 관리. 현재 씬 트래킹, 전환 애니메이션(페이드), 씬 스택 관리 |
| `GameManager.ts` | 게임 전체 상태 관리. 현재 HP, 남은 시간, 보호구 착용 여부, 게임 진행 상태 등 중앙 관리 |
| `MineralManager.ts` | 광물 데이터 및 열쇠 선정. 5종 광물 속성 로드, 필수 페어 규칙에 따라 열쇠 3종 랜덤 선정 |
| `AudioManager.ts` | 오디오 재생 관리. BGM/SFX 분리, 볼륨 조절, 동시 재생 제어 |
| `AssetManager.ts` | 에셋 로딩 관리. PIXI.Assets 기반 프리로드, 로딩 진행률 콜백, 텍스처 캐싱 |

### 시스템 (systems/)

| 파일 | 역할 |
|---|---|
| `TimerSystem.ts` | 10분(600초) 카운트다운. 매 프레임 업데이트, 00:00 도달 시 GameManager에 실패 알림 |
| `HPSystem.ts` | HP 관리. 차감 이벤트 수신, 0 도달 시 실패 엔딩 트리거, UI 업데이트 알림 |
| `SafetySystem.ts` | 안전장비 추적. 착용 여부 판단, 미착용 상태에서 실험 시 HP 페널티(-20) 적용 |
| `ExperimentSystem.ts` | 실험 수행 로직. 도구-광물 조합별 결과 판정, 조흔색/염산반응/자성/굳기 실험 처리 |
| `LogbookSystem.ts` | 도감 자동 기록. 실험 완료 시 해당 광물의 속성 데이터를 도감에 체크 표시 |
| `KeySystem.ts` | 열쇠 판정. 필수 페어 규칙([석영-방해석] 1종 + [흑운모-자철석] 1종 + 나머지) 기반 열쇠 생성, 정답 비교, 힌트 텍스트 생성 |

### 데이터 (data/)

| 파일 | 역할 |
|---|---|
| `minerals.ts` | 광물 5종의 정적 속성 (겉보기색, 조흔색, 굳기 SFX 키, 염산 반응 여부, 자성 여부) |
| `dialogs.ts` | 과학자 대사 전체. 인트로/실험 중/힌트/엔딩별 대사 텍스트 배열 |
| `safetyRules.ts` | 안전 규칙 데이터. 미착용 시 HP 감소량(-20), 염산 부주의(-30), 유리 파손(-15) 등 |
| `assetManifest.ts` | 에셋 매니페스트. 에셋 키-경로 매핑, 씬별 로딩 그룹 정의 |

---

## 씬 흐름도

```
IntroScene → SafetyScene → MainLabScene ⇄ ExperimentScene
                                ↓
                           DoorScene → EndingScene
                                         ├── 완벽한 탈출 (HP 100)
                                         ├── 겨우 탈출 (HP 1~99)
                                         └── 실험 실패 (시간초과/HP 0)
```

---

## 기술 스택 요약

| 항목 | 선택 |
|---|---|
| 렌더링 엔진 | PixiJS v8 |
| 언어 | TypeScript |
| 번들러 | Vite |
| 패키지 매니저 | npm |
| 오디오 | PixiJS Sound (또는 Howler.js) |
| 애니메이션 | PixiJS 내장 + GIF/Lottie 플러그인 |
