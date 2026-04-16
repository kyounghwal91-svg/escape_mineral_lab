# 탈출! 미치광이 과학자의 광물 실험실

> 광물 실험을 통해 단서를 모으고, 실험실을 탈출하라!

PixiJS 기반의 방탈출 교육 게임입니다. 플레이어는 미치광이 과학자의 실험실에 갇혀 광물의 특성을 실험으로 직접 확인하고, 얻은 정보를 바탕으로 탈출구를 열어야 합니다.

---

## 게임 소개

실험실 안에는 5종류의 광물이 놓여 있습니다. 조흔, 염산 반응, 자성, 굳기 비교 등의 실험을 직접 수행하여 각 광물의 특성을 도감에 기록하고, 최종적으로 철문을 여는 올바른 광물 조합을 찾아내야 합니다.

### 등장 광물

| 광물 | 조흔색 | 염산 반응 | 자성 | 굳기 |
|------|--------|-----------|------|------|
| 석영 | 없음 | ✗ | ✗ | 높음 |
| 장석 | 흰색 | ✗ | ✗ | 중간 |
| 흑운모 | 흰색 | ✗ | ✗ | 중간 |
| 방해석 | 흰색 | ✓ | ✗ | 낮음 |
| 자철석 | 검은색 | ✗ | ✓ | 중간 |

---

## 주요 기능

- **안전 장비 시스템** — 장갑, 마스크, 실험복을 착용해야 실험 진행 가능
- **조흔 실험** — 광물을 드래그하여 조흔판에 직접 긁어 조흔색 확인
- **염산 반응 실험** — 스포이드로 염산을 광물에 떨어뜨려 반응 여부 확인
- **자성 실험** — 광물을 클립에 가까이 가져가 자성 여부 확인
- **굳기 비교** — 석영과 방해석을 문질러 굳기 차이 확인
- **실험 도감** — 완료한 실험 결과가 도감에 자동 기록
- **타이머** — 제한 시간 내 탈출 도전
- **드래그 글로우 효과** — 상호작용 가능한 대상 강조 표시
- **모바일 지원** — 터치 조작 최적화

### 게임 진행 흐름

```
인트로 → 실험실(Lab) → 장비 착용(Equipment) → 실험 수행 → 도감 기록 → 철문 열기 → 결과
```

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 렌더링 | [PixiJS](https://pixijs.com/) v7 |
| 오디오 | [@pixi/sound](https://pixijs.io/sound/) v5 |
| 빌드 도구 | [Vite](https://vitejs.dev/) v5 |
| 언어 | JavaScript (ES Modules) |

---

## 시작하기

### 요구 사항

- Node.js 18 이상
- npm

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/kyounghwal91-svg/escape_min.git
cd escape_min

# 패키지 설치
npm install

# 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과물 미리보기
npm run preview
```

빌드 결과물은 `dist/` 폴더에 생성됩니다.

---

## 프로젝트 구조

```
escape_min/
├── src/
│   ├── main.js              # 진입점
│   ├── core/
│   │   └── GameApp.js       # 앱 초기화
│   ├── scenes/              # 게임 씬
│   │   ├── IntroScene.js
│   │   ├── LabScene.js
│   │   ├── EquipmentScene.js
│   │   ├── ExperimentScene.js
│   │   ├── DoorScene.js
│   │   └── ResultScene.js
│   ├── systems/             # 게임 시스템
│   │   ├── MineralManager.js
│   │   ├── SafetySystem.js
│   │   ├── StatusManager.js
│   │   └── AudioManager.js
│   ├── ui/                  # UI 컴포넌트
│   │   ├── UIManager.js
│   │   ├── ExperimentPopup.js
│   │   ├── HardnessComparePopup.js
│   │   ├── LogbookPopup.js
│   │   └── NotePopup.js
│   ├── effects/             # 실험 이펙트
│   └── data/
│       ├── minerals.js      # 광물 데이터
│       └── audio-manifest.js
├── images/                  # 게임 에셋
├── public/
├── index.html
├── vite.config.js
└── package.json
```

---

## 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.
