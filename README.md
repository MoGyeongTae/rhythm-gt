# rhythm-gt

웹 기반 4키 리듬게임 프로토타입입니다. 오디오 싱크와 판정 처리를 검증하는 데모 단계입니다.

## 기술 스택

- React 19 + TypeScript + Vite
- PixiJS 8 (`@pixi/react`) — 스테이지와 노트 렌더링
- Web Audio API — 음원 재생, 게임 시간 기준(`AudioContext.currentTime`)
- Zustand — 노트, 판정 이펙트 상태

## 실행

```bash
npm install
npm run dev
```

`public/music.mp3`가 있어야 게임이 시작됩니다.

## 조작

| 키 | D | F | J | K |
| --- | --- | --- | --- | --- |
| 레인 | 1 | 2 | 3 | 4 |

## 판정

| 판정 | 오차 |
| --- | --- |
| PERFECT | ±50ms 이내 |
| GOOD | ±150ms 이내 |
| BAD | ±300ms 미만 |
| MISS | 노트가 화면을 벗어남 |

## 구조

```
src/
├── App.tsx              # 오디오 로드, 게임 시작, 키 입력 처리
├── main.tsx
├── index.css
├── game/
│   ├── Stage.tsx        # PixiJS 스테이지, 노트, 판정 이펙트 렌더링
│   ├── judgment.ts      # 노트 생성, 판정 로직
│   └── playfield.ts     # 레이아웃 상수, 레인 정의, 채보
└── store/
    └── noteStore.ts     # 노트, 이펙트 상태
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 후 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm run preview` | 빌드 결과 미리보기 |
