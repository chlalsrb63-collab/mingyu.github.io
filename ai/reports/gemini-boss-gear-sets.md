# 보스 세트 장비 아이콘 8종 시안 제작 보고서

## 1. 원래 작업 행 및 변경 파일
- **작업 행**: `- [ ] [ART] 보스 세트 장비 아이콘 8개 (16×16, 지금은 일반 5단계 그림을 같이 씀): 밤장막 세트 veil_h 박쥐 가면 · veil_a 장막 망토 · veil_r 송곳니 반지 · veil_n 흉곽 부적 (검보라·뼈·자홍 심장), 꽃무덤 세트 bloom_h 고래뼈 투구 · bloom_a 갈비 흉갑 · bloom_r 혼꽃 반지 · bloom_n 결정 심장 (청록 수정·백골·꽃잎). 파일 이름 = 아이템 id (asset/generated/gear-sets/veil_h.png …), 프롬프트 파일, asset/CREDITS.md 한 줄, import-art.mjs로 16×16 정리까지. 설치는 하지 말 것`
- **생성·변경 파일**:
  - `asset/generated/gear-sets/veil_h.png`, `veil_h.prompt.md`
  - `asset/generated/gear-sets/veil_a.png`, `veil_a.prompt.md`
  - `asset/generated/gear-sets/veil_r.png`, `veil_r.prompt.md`
  - `asset/generated/gear-sets/veil_n.png`, `veil_n.prompt.md`
  - `asset/generated/gear-sets/bloom_h.png`, `bloom_h.prompt.md`
  - `asset/generated/gear-sets/bloom_a.png`, `bloom_a.prompt.md`
  - `asset/generated/gear-sets/bloom_r.png`, `bloom_r.prompt.md`
  - `asset/generated/gear-sets/bloom_n.png`, `bloom_n.prompt.md`
  - `asset/CREDITS.md` (출처 및 라이선스 등록)

## 2. 세트·부위별 디자인 및 16×16 판독성
- **밤장막 세트 (`veil_*` — 검보라 `#321d4a`/`#55327d` · 백골 `#d8cee0`/`#f7f0ff` · 자홍 심장 `#ff4298`)**:
  - `veil_h` (박쥐 가면): 양옆으로 높이 솟은 박쥐 날개 귀와 뼈 안면 바이저, 이마의 자홍 심장 보석으로 꽃무덤 투구(둥근 두개골형)와 실루엣을 차별화.
  - `veil_a` (장막 망토): 뾰족한 백골 깃과 자홍 심장 브로치 아래로 펼쳐지는 3갈래 박쥐 날개 밑단 망토 조형.
  - `veil_r` (송곳니 반지): 속이 빈 3×3 원형 반지 고리 상단에 두 개의 휜 백골 송곳니가 자홍 심장 보석을 물고 있는 형태.
  - `veil_n` (흉곽 부적): 보라색 목걸이 줄 아래 3단 백골 갈비뼈가 자홍색 심장 코어를 감싼 부적 조형.
- **꽃무덤 세트 (`bloom_*` — 청록 수정 `#3fd4de`/`#b8ffff` · 백골 `#d6e6ed`/`#f4fcff` · 혼꽃잎 `#ff70b8`)**:
  - `bloom_h` (고래뼈 투구): 둥근 백골 두개골 투구 정수리에 솟은 청록 수정 등지느러미 볏과 측면의 분홍 혼꽃잎 장식.
  - `bloom_a` (갈비 흉갑): 4단 가로 백골 갈비뼈 판갑 중앙을 관통하는 청록 수정 흉골 코어와 양 어깨의 혼꽃잎 견갑.
  - `bloom_r` (혼꽃 반지): 속이 빈 백골 반지 고리 위에 피어난 분홍 혼꽃잎 2쌍과 중앙 청록 수정 암술.
  - `bloom_n` (결정 심장): 백골 사슬 고리에 매달린 대형 육각 청록 결정 심장과 이를 받치는 백골 발톱·혼꽃잎.

## 3. 정규화 검수 및 미리보기 경로
- `node game/scripts/import-art.mjs`로 8종 모두 `16×16`, 9~10색(16색 이하), `#2b2233` 1px 외곽선, 노이즈 0건으로 정규화 완료 (`--install` 미실행).
- 8× 확대 · 1× 실제 크기 · 무채색(흑백) 비교 시트: `game/shots/gemini-boss-gear-sets.png`
- 개별 정규화 전후 비교: `asset/_preview/veil_h_clean.compare.png` 외 7종
