# AI별 명령 프롬프트 모음 (복사해서 붙여 넣기)

`.bat` 런처를 쓰면 아래 프롬프트가 자동으로 들어갑니다. 터미널에서 직접 `codex` / `gemini` / `claude`를
실행했을 때 첫 메시지로 붙여 넣으세요. 모두 **`Tales Tales` 폴더**(또는 각자 작업 폴더 `.work\codex`,
`.work\gemini`)에서 실행합니다.

---

## 지금은 Codex 혼자 (Gemini 꺼짐 — `ai/TEAM.txt`가 `GEMINI=off`)

Codex가 구현과 기획·글쓰기를 번갈아 맡습니다. `AI-TEAM.bat` / `AI-AUTO.bat`도 Codex만 실행합니다.

**Codex에게 (기본 — 이것만 붙여 넣으면 됨)**
```
AGENTS.md, ai/codex.md, ai/TEAM.txt, ai/TASKS.md, ai/ROADMAP.md 를 읽어. 지금은 Gemini가 꺼져 있으니 너 혼자
구현과 기획을 번갈아 맡는다. ai/codex.md 2번 순서(a→d)대로 작업 딱 하나만 골라서 끝까지 해:
구현이면 테스트(npm run test:rules) 통과 + 보고서 + codex/work 커밋, 기획이면 docs/ 문서 +
ai/proposals/codex-*.md 작업 제안 + 보고서. 질문하지 말고, 막히면 보고서에 이유와 분해안을 쓰고 멈춰.
```

**Codex에게 (기획만 시키기)**
```
AGENTS.md 와 ai/gemini.md 의 산출물 규칙을 읽고, Gemini 대신 ROADMAP.md 개선 축 "<A~H 중 하나>" 를 점검해.
게임 코드는 고치지 말고 docs/ 에 분석 문서, ai/proposals/codex-<축>.md 에 바로 구현 가능한 작업 3~6줄을 써.
```

## Codex (구현 · 테스트)

**1) 보드의 다음 일 하나**
```
AGENTS.md, ai/codex.md, ai/TASKS.md, ai/ROADMAP.md 를 읽어. ai/codex.md 순서대로 작업 딱 하나만 해:
TASKS.md CODEX 섹션의 첫 미완료 작업, 없으면 ROADMAP.md 의 CODEX 백로그 첫 항목.
npm run test:rules 통과, 보고서 ai/reports/codex-*.md 작성, codex/work 브랜치에 커밋까지.
```

**2) 특정 작업 지시**
```
AGENTS.md 와 ai/codex.md 를 읽고, 이 작업 하나만 해: <여기에 할 일>.
AGENTS.md §8 레시피의 파일만 열고, 테스트 추가 → npm run test:rules 통과 → 보고서 → 커밋.
```

**3) 자동 개선 (보드가 비었을 때)**
```
AGENTS.md, ai/codex.md, ai/ROADMAP.md 를 읽어. ROADMAP.md 상단 품질 기준을 지키면서
CODEX 백로그 첫 항목을 구현해. 질문하지 말고, 막히면 보고서에 분해안을 적고 멈춰.
```

## Gemini (분석 · 기획 · 글)

**1) 보드의 다음 일 하나**
```
AGENTS.md, ai/gemini.md, ai/TASKS.md, ai/ROADMAP.md 를 읽어. ai/gemini.md 순서대로 작업 딱 하나만 해:
TASKS.md GEMINI 섹션의 첫 미완료 작업, 없으면 ROADMAP.md 의 GEMINI 백로그 첫 항목, 그것도 없으면
다음 개선 축(A→H) 콘텐츠 점검. 결과는 docs/ 문서 + ai/proposals/gemini-*.md(Codex용 작업 3~6줄) +
보고서. 게임 코드는 고치지 마. gemini/work 브랜치에 커밋.
```

**2) 콘텐츠 점검 (한 축)**
```
AGENTS.md 와 ai/gemini.md 를 읽고, ROADMAP.md 개선 축 "<A~H 중 하나, 예: A. 퀘스트·스토리>" 를 점검해.
game/src/logic/ 와 game/public/ 에서 관련 부분을 전부 읽고, 부족한 점 표 + 개선안을 docs/ 에,
Codex가 바로 구현할 수 있는 작업 3~6줄(파일·정확한 한국어 문구·수치·테스트 방법 포함)을
ai/proposals/gemini-<축>.md 에 써.
```

**3) 글쓰기 (퀘스트·대사·설명문)**
```
AGENTS.md 1절 세계관과 ROADMAP.md 품질 기준을 지켜서 <퀘스트 10개 / NPC 대사 20줄 / 몬스터 도감 설명>을
한국어로 써 줘. 기존 QUESTS(game/src/logic/10-tables.js), game/public/npctalk.js 와 겹치지 않게.
결과는 docs/content-ideas.md, Codex용 적용 작업은 ai/proposals/ 에.
```

## Claude (통합 · 검토 · 큰 작업)

**1) 합치기** (= `AI-MERGE.bat`)
```
AGENTS.md 와 ai/merge.md 를 읽고 ai/merge.md 대로 진행해.
```

**2) 큰 기능 설계 → 팀에 분배**
```
<기능 설명>을 넣고 싶어. AGENTS.md 기준으로 설계안을 짧게 쓰고, Codex가 할 작은 작업과 Gemini가 할
기획·글 작업으로 나눠 ai/TASKS.md 에 추가해. 아직 구현은 하지 마.
```

**3) 직접 개발**
```
AGENTS.md 를 읽고 <할 일>을 해 줘. 테스트로 확인하고, 화면이 바뀌면 shot.mjs 로 한 장만 확인. main에 커밋하고 push.
```

## 그림 에셋 (무기 디자인 · AI 이미지 · 외부 팩)

전부 [`ai/prompts/weapon-assets.md`](prompts/weapon-assets.md)에 있습니다: 외부 시트 사용 검토, **프롬프트 A**
(Codex가 무기 실루엣을 코드로 추가 — 권장), **프롬프트 B** (ChatGPT 이미지 생성 + `import-art.mjs` 정리 명령),
**프롬프트 C** (Codex가 `asset/generated/` 묶음을 검수·정리·추천). 결과는 `ASSETS.bat` 갤러리에서 비교합니다.

**외형 장비(모자·상의·등·얼굴)** 는 [`ai/prompts/cosmetic-assets.md`](prompts/cosmetic-assets.md): 종족마다 자연스럽게
맞도록 지켜야 할 규칙(앵커, 귀 처리, 눈 보호, 외곽선, 상의 템플릿, 날개), 미리보기 시트(`cos-audit.mjs`),
가드 테스트(`tests/cosmetics.mjs`), Codex용 프롬프트(한국어 + 영어).
