# 탈출! 미치광이 과학자의 광물 실험실 개발 진행 기록

## 프로젝트 현황

기준일: 2026-04-05

현재 프로젝트는 PixiJS + Vite 기반의 교육용 방탈출 게임 프로토타입이다. 핵심 플레이 루프는 이미 연결되어 있으며, 최근 작업은 LabScene 비주얼 개선, 실험 팝업 리디자인(염산), 오브젝트 배치 정밀 조정에 집중되어 있다.

기본 흐름:

`IntroScene -> EquipmentScene -> LabScene -> DoorScene -> ResultScene`

테스트 흐름:

`GameApp.js`의 `TEST_MODE = true` 상태에서는 PPE를 자동 착용한 상태로 `LabScene`부터 바로 시작한다.

---

## 씬 구현 상태

| 씬 | 상태 | 내용 |
|---|---|---|
| `IntroScene` | 완료 | 타이틀과 시작 버튼 구현 |
| `EquipmentScene` | 완료 | 보호구 3종 드래그 착용, 과학자 대사, UI 정리 로직 반영 |
| `LabScene` | 진행 중 | 광물/도구 고정 배치, 배경 개선, 팝업 레이어 정상화 |
| `DoorScene` | 완료 | 광물 3개 투입 퍼즐, 힌트 공개, 오답 피드백 |
| `ResultScene` | 완료 | 탈출 결과 분기 처리 |
| `ExperimentScene` | 레거시 | 현재 메인 플레이에서는 사용하지 않음 |

---

## 시스템 구현 상태

| 파일 | 상태 | 내용 |
|---|---|---|
| `src/core/GameApp.js` | 완료 | 씬 시작 제어, 테스트 모드에서 Lab Scene 직행 |
| `src/core/SceneManager.js` | 완료 | 씬 전환 및 공통 처리 |
| `src/systems/StatusManager.js` | 완료 | HP, 타이머, 게임오버 이벤트 |
| `src/systems/MineralManager.js` | 완료 | 실험 기록, 전역 힌트, Lab/Door 진행 상태 저장 |
| `src/systems/SafetySystem.js` | 완료 | PPE 착용 여부에 따른 패널티 계산 |
| `src/ui/UIManager.js` | 완료 | HUD, 말풍선, 상태 이벤트 연결 및 해제 정리 |
| `src/ui/NotePopup.js` | 완료 | 쪽지 팝업 |
| `src/ui/ExperimentPopup.js` | 완료 | 팝업 세로 640px로 확장, 결과 패널 위치 조정 |
| `src/ui/HardnessComparePopup.js` | 완료 | 굳기 비교 팝업 |
| `src/ui/LogbookPopup.js` | 레거시 | 현재는 우측 고정 도감 패널 사용 |
| `src/effects/AcidEffect.js` | 완료 | 드래그&드롭 방식으로 전면 재작성 |

---

## 이번 세션(2026-04-05) 반영된 작업

### 1. LabScene 배경 및 레이어 구조 개선

- `lab_bg.png`를 배경으로 그대로 사용하되, 기존의 검정 dim 오버레이(0.45)를 제거해 배경이 선명하게 보이도록 수정했다.
- 별도로 올려놓던 `lab_table.png`를 제거했다. `lab_bg.png`에 테이블이 이미 포함되어 있기 때문이다.
- 힌트 텍스트를 `y=570`으로 이동하고 폰트 크기를 `13 → 17px`로 키웠다.

### 2. 광물 및 도구 텍스트 색상

- 광물 이름, 도구 이름 텍스트를 흰색(`0xffffff`)으로 변경하고 드롭섀도를 추가했다.

### 3. 광물·도구 배치 고정 좌표 전환

- 기존 랜덤 배치(`_randomPos`) 방식을 버리고 `MINERAL_POSITIONS` 고정 배열로 전환해 겹침을 완전히 제거했다.

**현재 광물 배치 (`MINERAL_POSITIONS`):**
```
석영(quartz):    cx=240, cy=458  ← 라벨 하단 기준점
장석(feldspar):  cx=397, cy=501  ← 라벨 하단 석영과 동일(y≈532)
흑운모(biotite): cx=554, cy=501
방해석(calcite): cx=711, cy=501
자철석(magnet):  cx=868, cy=501  ← x 좌표 기존 유지
```

**현재 도구 배치 (`TABLE_LAYOUT`):**
```
조흔판(streak): x=240, y=498
염산(acid):     x=490, y=498
클립(magnet):   x=740, y=498
```

### 4. 오브젝트 스케일 및 라벨 간격 조정

- 전체 오브젝트 스케일: `LAB_OBJECT_SCALE = 1.3` 유지
- 광물 라벨 Y 간격: `94 → 79 * scale` (스프라이트와 거리 축소)
- 광물 도트 Y: `114 → 97 * scale`
- 도구 라벨 Y: `54 → 46 * scale` (클립은 `30 * scale`로 별도 조정)
- **석영 전용:** 라벨 Y `112 * scale`, 도트 Y `130 * scale` (2배 거리 유지)

### 5. 석영 배치 시각 정렬

- 석영의 라벨 하단 스크린 y ≈ 532 기준으로 나머지 광물 cy를 역산(cy ≈ 501)해 텍스트 하단을 정렬했다.

### 6. 쪽지(lab_note) 및 기타 오브젝트 위치

| 오브젝트 | 위치 |
|---|---|
| 탈출구 문 버튼 | x=80, y=140 |
| 실험실 쪽지 | x=118, y=512 |
| 도감 패널 | x=936, y=86 (우측 고정) |
| 💡 힌트 버튼 | x=W-350, y=19 |

### 7. 염산 실험(AcidEffect) 전면 재작성

기존 버튼 클릭 방식에서 드래그&드롭 방식으로 완전히 교체했다.

- **가운데:** `petri_dish.png` 위에 해당 광물 이미지가 놓인 형태로 시작
- **왼쪽(장식):** `hcl_bottle.png`(뒤) + `Hcl_bottle_only.png`(앞) — 인터랙션 없음
- **오른쪽(인터랙션):** `Hcl_bottle_spoide.png` — 광물에 드래그&드롭 시 결과 출력
- 드롭 성공 → 거품 애니메이션(acidReaction=true) 또는 무반응 텍스트 출력

### 8. ExperimentPopup 세로 확장

- `POP_H`: `480 → 640` (세로 약 2배)
- 결과 패널, 구분선, 배지 위치를 새 높이에 맞게 조정(py+442, py+432, py+480)
- acid 안내문: `'"염산 투입" 버튼을 클릭하세요'` → `'스포이드를 광물에 드래그하여 염산을 투입하세요'`

### 9. LabScene 이미지 preload 추가

`Hcl_bottle_only.png`, `Hcl_bottle_spoide.png`, `petri_dish.png` 를 LabScene 진입 시 사전 로드하도록 추가했다.

### 10. 말풍선 텍스트 변경

- 실험 3회 후 문 미방문 시 출력 대사: `'문으로 가서 단서를 확인해볼까?'` → `'탈출구에 가서 힌트를 확인해 볼까?'`

---

## 현재 플레이 기준 상태

- 보호구 착용과 과학자 도입 대사
- 광물 5종 실험 (조흔, 염산 드래그&드롭, 자성, 굳기 비교)
- 쪽지 열람
- 우측 도감 패널 즉시 갱신
- 철문 퍼즐 힌트 공개
- 엔딩 분기
- 테스트 모드 Lab Scene 직행

---

## 남은 점검 포인트

### 1. 실기 플레이 검증

- `vite/esbuild spawn EPERM` 이슈로 CI 빌드 검증은 미완. 브라우저에서 직접 테스트 필요.

### 2. 광물·도구 위치 겹침 가능성

- 광물 cy=501과 도구 y=498이 세로 범위가 겹침. x가 달라 대부분 문제없으나 석영(cx=240)과 조흔판(x=240)이 같은 x 좌표임. 추가 조정 후보.

### 3. 레거시 파일 정리

- `ExperimentScene.js`
- `LogbookPopup.js`

### 4. 다음 작업 후보

1. 도구와 광물 위치 최종 미세조정
2. 효과음/BGM 추가
3. 모바일 드래그 최적화
4. 레거시 파일 정리
