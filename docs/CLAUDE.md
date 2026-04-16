# 탈출! 미치광이 과학자의 광물 실험실 — 프로젝트 컨텍스트

## 프로젝트 개요
- **장르:** 교육용 시뮬레이션 방탈출 웹앱 (2D)
- **목표:** 광물 5종의 특성을 실험으로 파악해 "열쇠 광물 3종"을 찾아 탈출
- **핵심 교육 목표:** 광물 식별 능력 (조흔색, 염산 반응, 자성, 굳기) + 실험 안전 수칙

## 기술 스택
- **Engine:** PixiJS v7 (Canvas API 기반)
- **Language:** JavaScript ES6+ (모듈 방식)
- **Bundler:** Vite
- **Audio:** 추후 추가 예정
- **해상도:** 1280×720 (반응형 스케일)

---

## 게임 규칙 (핵심)

### 열쇠 생성 알고리즘
```
pairA: [석영, 방해석] 중 1종 필수
pairB: [흑운모, 자철석] 중 1종 필수
third: 나머지 풀에서 랜덤 1종
→ 3종 셔플하여 정답 열쇠로 사용
```

### HP 패널티
| 상황 | 차감 |
|------|------|
| 안전장비 미착용 상태로 실험 | -20 HP |
| 장갑 없이 염산 사용 | -30 HP |
| 유리 기구 파손 | -15 HP |

### 엔딩 분기
| 조건 | 엔딩 |
|------|------|
| 성공 + HP 100 | 완벽한 탈출 (`perfect`) |
| 성공 + HP 1~99 | 겨우 탈출 (`barely`) |
| 시간 초과 or HP 0 | 실험 실패 (`failure`) |

### 광물 5종 속성
| 광물 | 색상값 | 조흔색 | 굳기(수치) | 염산 반응 | 자성 |
|------|--------|--------|-----------|----------|------|
| 석영 | 0xd4f1f9 | none | high (7) | ✗ | ✗ |
| 장석 | 0xffd6d6 | white | medium (6) | ✗ | ✗ |
| 흑운모 | 0x2c2c2c | white | medium (6) | ✗ | ✗ |
| 방해석 | 0xfafafa | white | low (3) | ✓ (거품) | ✗ |
| 자철석 | 0x1a1a1a | black | medium (6) | ✗ | ✓ |

---

## 씬 흐름
```
IntroScene
  └─ "게임 시작" 클릭
       ↓
EquipmentScene
  ├─ 과학자의 첫 위협 대사 출력
  └─ 보호구 착용 (선택) 후 "실험실 입장" 클릭 (미착용 시 경고 스타일)
       ↓
LabScene (타이머 600초 즉시 시작)
  ├─ 실험대 위 '쪽지' 확인 (첫 번째 광물 힌트 획득)
  ├─ 광물 실험 및 도감 기록
  └─ 철문 클릭 → DoorScene
       ↓
DoorScene
  ├─ 슬롯 1~3에 광물 드래그 투입
  │    ├─ 정답: 다음 단계 힌트 팝업 + 슬롯 고정
  │    └─ 오답: 상세 힌트 팝업 (1번 오답 시 "실험실 쪽지" 언급)
  ├─ 💡 힌트: 여태까지 모은 모든 단서 확인
  └─ 3개 슬롯 모두 정답 시 즉시 탈출 → ResultScene
```

> ⚠️ ExperimentScene은 별도 씬 전환 없이 LabScene 내 레이어 팝업으로 대체됨
> ⚠️ 보호구를 다 착용하지 않아도 실험실 입장 가능 (미착용 시 HP 패널티 실제 작동)

---

## 현재 구현 파일 목록

### 프로젝트 루트
| 파일 | 상태 | 설명 |
|------|------|------|
| `package.json` | ✅ 완료 | pixi.js@^7, vite 의존성 |
| `vite.config.js` | ✅ 완료 | Vite 빌드 설정 |
| `index.html` | ✅ 완료 | #game-container div |

### src/core/ — 핵심 엔진
| 파일 | 상태 | 설명 |
|------|------|------|
| `main.js` | ✅ 완료 | GameApp 진입점 |
| `core/GameApp.js` | ✅ 완료 | PixiJS Application 초기화, 씬 등록, 메인 루프 |
| `core/SceneManager.js` | ✅ 완료 | 씬 전환 (ticker 기반 페이드 0.3s), pushScene/popScene 스택 |
| `core/BaseScene.js` | ✅ 완료 | 씬 기반 클래스 (onEnter/onExit/update/destroy) |

### src/systems/ — 게임 시스템
| 파일 | 상태 | 설명 |
|------|------|------|
| `systems/StatusManager.js` | ✅ 완료 | 타이머(600초) + HP(100), EventEmitter 패턴 |
| `systems/MineralManager.js` | ✅ 완료 | 광물 데이터, 열쇠 3종 랜덤 생성, 실험 기록, **단계별 힌트(Clue) 시스템** |
| `systems/SafetySystem.js` | ✅ 완료 | PPE 착용 추적, 실험별 패널티 계산 (1회 적용) |

### src/ui/ — UI 컴포넌트
| 파일 | 상태 | 설명 |
|------|------|------|
| `ui/UIManager.js` | ✅ 완료 | HP바(색상 변화), 타이머, 타이핑 대사창, 데미지 플래시, 이벤트 차단 수정 완료 |
| `ui/ExperimentPopup.js` | ✅ 완료 | 광물×도구 실험 팝업 래퍼 (760×480), PPE 경고 모달 포함 |
| `ui/HardnessComparePopup.js` | ✅ 완료 | 석영+방해석 드래그 합체 → 굳기 비교 팝업 (760×460) |
| `ui/LogbookPopup.js` | ✅ 완료 | 도감 버튼 → 광물 5종 실험 결과 비교표 팝업 (860×520) |
| `ui/NotePopup.js` | ✅ 완료 | 종이 질감의 힌트 레이어 팝업 (💡 힌트 버튼 → 단서 이력 확인) |

### src/data/ — 정적 데이터
| 파일 | 상태 | 설명 |
|------|------|------|
| `data/minerals.js` | ✅ 완료 | 광물 5종 속성 + KEY_PAIRING_RULES + getMineralById() |

### src/scenes/ — 씬 파일
| 파일 | 상태 | 설명 |
|------|------|------|
| `scenes/IntroScene.js` | ✅ 완료 | 타이틀 + "게임 시작" 버튼 → EquipmentScene |
| `scenes/EquipmentScene.js` | ✅ 완료 | 드래그&드롭 보호구 3종 착용, 과학자 첫 위협 대사, "실험실 입장" 버튼 |
| `scenes/LabScene.js` | ✅ 완료 | 광물 카드 5종 + 도구 4종 드래그&드롭, 팝업 시스템, HP/타이머 HUD, **쪽지 오브젝트** |
| `scenes/DoorScene.js` | ✅ 완료 | 광물 3종 슬롯 투입, 실시간 정답 판정, 단계별 힌트 제공 |
| `scenes/ExperimentScene.js` | ⚠️ 레거시 | LabScene 팝업으로 대체됨 (미사용) |
| `scenes/ResultScene.js` | ✅ 완료 | perfect / barely / failure 3종 엔딩 분기 |

### src/effects/ — 실험 이펙트
| 파일 | 상태 | 설명 |
|------|------|------|
| `effects/ScratchEffect.js` | ✅ 완료 | 조흔판 드래그 → 조흔선 그리기, 80px 이상 시 결과 |
| `effects/AcidEffect.js` | ✅ 완료 | 염산 투입 버튼 → 스포이트 이동 → 거품 애니메이션 |
| `effects/MagnetEffect.js` | ✅ 완료 | 클립 접근 버튼 → 붙음/튕김 애니메이션 |
| `effects/HardnessEffect.js` | ✅ 완료 | 방해석/석영 블록 클릭 → 긁힘 여부 판정 (ExperimentPopup 내부용) |

---

## 구현 완료된 기능 상세

### LabScene 드래그&드롭 시스템
- 광물(5종) ↔ 도구(4종) 양방향 드래그 → 드롭 시 ExperimentPopup 오픈
- **석영+방해석 조합 드래그** → HardnessComparePopup 오픈 (특수 인터랙션)
- 드롭 후 snapBack 애니메이션 (0.14 보간)
- `this._popup` 가드: 팝업 열린 동안 새 드래그 차단
- 실험 완료 시 광물 카드 하단 도트 마커 점등 (조흔=초록, 염산=주황, 자성=보라, 굳기=청록)

### ExperimentPopup (광물×도구 실험)
- 4종 실험 타입: `streak` / `acid` / `magnet` / `hardness`
- PPE 미착용 감지 → 경고 배너 + "그냥 진행(-N HP)" / "취소" 선택
- 실험 완료 → MineralManager.recordExperiment() + UIManager 대사창 출력

### HardnessComparePopup (석영↔방해석 굳기 비교)
- 두 광물을 나란히 표시, 화살표로 긁기 방향 표현
- 방해석 원 위에 긁힘 선 5개 순차 애니메이션 (160ms 간격)
- 완료 후 "석영(7) > 방해석(3) → 방해석에 긁힘!" 결과 표시
- 닫기 시 두 광물 모두 hardnessTested 기록 + 도트 마커 업데이트

### LogbookPopup (도감 비교표)
- 5행(광물)×5열(이름·조흔색·염산·자성·굳기) 비교표
- 미실험: `?` 회색 / 실험 완료: 결과 텍스트 + 색상 강조
- `refresh()` 메서드로 외부 갱신 가능
- 도감 버튼 클릭 시 현재 기록 즉시 반영

---

## 팝업 레이어 아키텍처
```
LabScene.container
  ├── 배경/실험대/광물/도구 레이어
  └── [팝업 레이어] ← this._popup
        ├── ExperimentPopup      (광물→도구 드래그)
        ├── HardnessComparePopup (석영+방해석 드래그)
        ├── LogbookPopup         (도감 버튼)
        └── NotePopup            (쪽지 오브젝트 클릭 / 💡 힌트 버튼)
```
- 팝업은 한 번에 1개만 열림 (`this._popup` 가드)
- 팝업 닫기 → `this._popup = null` → 드래그 재활성화

---

## 다음 구현 순서 (Next Steps)

### 1. 아트 및 연출 강화
- **아트 에셋 교체:** Graphics 플레이스홀더 → 실제 PNG/SVG (광물, 도구, 과학자, 배경)
- **애니메이션 추가:** 과학자 등장 애니메이션, 실험 성공/실패 시각 효과 강화

### 2. 오디오 시스템 구현
- **BGM:** 실험실 긴장감 배경음악
- **SFX:** 드래그앤드롭, 거품 소리, 긁는 소리, 슬롯 정답/오답 효과음, 버튼 클릭음

### 3. 모바일 최적화 및 편의성
- **터치 대응:** 모바일 브라우저 드래그앤드롭 터치 이벤트 최적화
- **튜토리얼 보강:** IntroScene에 조작법 및 게임 규칙 안내 추가

### 4. 레거시 정리 및 리팩토링
- [ ] `ExperimentScene.js` 제거
- [ ] 반복 UI 컴포넌트(버튼 등) 공통 클래스로 추상화

---

## 주요 설계 패턴

### 씬 간 데이터 전달
```js
sceneManager.changeScene('lab', {
  statusManager,
  mineralManager,
  safetySystem,
});
```

### 팝업 열기 패턴 (LabScene)
```js
// 팝업 중복 방지 가드
_showPopup(mineralId, toolType) {
  if (this._popup) return;
  const popup = new ExperimentPopup(app, { ... });
  popup.onClose(() => { this._popup = null; this._updateMineralDots(id); });
  this._popup = popup;
  this.container.addChild(popup.container);
}
```

### MineralManager 실험 기록
```js
mineralManager.recordExperiment(mineralId, 'streak', 'white');
mineralManager.recordExperiment(mineralId, 'acid', true);
mineralManager.recordExperiment(mineralId, 'magnet', false);
mineralManager.recordExperiment(mineralId, 'hardness', 'low');
// getRecord(id) → { streakTested, streakColor, acidTested, acidReacted, magnetTested, magnetic, hardnessTested, hardness }
```

### UIManager 이벤트 바인딩
```js
statusManager.on('hpChanged', ({ hp }) => uiManager.updateHP(hp));
statusManager.on('timerTick', (t) => uiManager.updateTimer(t));
```
