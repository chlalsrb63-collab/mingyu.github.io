# 작업 보고서: 꽃무덤 고래 잠수·떠오름 및 혈루 왕도마뱀 혈루 사출 이펙트 (`gemini-boss-effects`)

## 1. 원래 작업 항목 (`ai/TASKS.md`)
- `- [ ] [VFX] 꽃무덤 고래 \`bloomwhale\`의 잠수/떠오름 이펙트와 혈루 왕도마뱀 \`bloodhorn\`의 혈루 사출(jet) 물줄기를 \`game/public/skillfx.js\`에 코드로 그리기 (서버 이벤트 \`bt\`/\`bc\`는 그대로, 그림만). 바닥 경고와 겹쳐도 잘 보이게`

## 2. 변경 파일
- `game/public/skillfx.js`: `bloomwhaleDive`, `bloodhornJet` 이펙트 함수 추가 및 `skillEvent` 내 `"t"`·`"bc"` 이벤트 연동 (서버 로직 `game/src/logic/` 및 통신 규격 무수정)

## 3. 이펙트 디자인 및 단계별 구분
- **꽃무덤 고래 (`bloomwhale` — `bloomwhaleDive`)**
  - **잠수·경고 (`0..1740ms`)**: 출발 지점과 착지 원(`r=70`) 내부에서 중심 심연 소용돌이(`#0c1016`, `INK`)로 반경이 줄어들며 감겨 들어가는 청록·자홍 나선 파문(`#7ff6ff`, `#e0ffff`, `#ff5ad8`)과 위에서 바닥으로 회전하며 빨려 들어가는 혼꽃 꽃잎 픽셀(`#ff5ad8`, `#ffd0f4`)을 배치했다. 외곽 `r=70` 경계 점선과 8방향 바깥쪽 회피 갈매기표(`#ffe08a`, `#ffffff`)를 분리해 바닥 경고 경계와 피할 방향이 끝까지 선명히 보이게 했다.
  - **떠오름·발동 (`1740..2180ms`)**: 착지 순간 바깥으로 쪼개지며 퍼지는 8분할 파문 호(`갈라지는 파문`)와 수직으로 솟구치는 픽셀 물기둥·물방울·꽃잎(`위로 튀는 픽셀`)로 잠수 단계와 명확히 구분했다.
  - **잔상 (`2180..2480ms`)**: 갈라진 외곽 수면 파문 조각과 공중에서 가라앉는 꽃잎·물방울 픽셀이 점차 소멸한다.
- **혈루 왕도마뱀 (`bloodhorn` — `bloodhornJet`)**
  - **사출·경고 (`0..380ms`)**: 5연속 원형 바닥 경고(`r=13`) 외곽 테두리 점선, 통로 경계선, 좌우 수직 회피 화살표(`<`, `>`)를 표시하고 눈에서 뻗는 조준선 위에 전진 방향 갈매기표를 흘려 사출 방향과 회피 방향이 한눈에 읽히게 했다.
  - **사출·발동 (`380..960ms`)**: `INK` 외곽선 → 검붉은 외피(`#6a0e1e`) → 선홍 본줄기(`#ff3b3b`) → 밝은 분홍(`#ffb0a0`) → 백색 코어(`#ffffff`)로 이어지는 **밝은 중심 줄기**와 전진 화살촉 맥동으로 뻗는 방향을 강조하고, 각 원 중심에서 `r=13` 경계 안쪽으로만 튀는 **짧은 비산** 픽셀을 더해 바닥 경고 경계가 가려지지 않게 유지했다.
  - **사출·잔상 (`960..1320ms`)**: 중심축을 따라 끊어진 핏방울 픽셀과 바닥 혈흔이 가라앉으며 화염 장판과 자연스럽게 이어진다.

## 4. 검증 및 재현 방법
- 문법 확인: `node --check game/public/skillfx.js` (오류 없음)
- 미리보기 재현 명령 (경고·발동·잔상 6컷 비교 합성):
  ```bash
  node game/scripts/shot.mjs --page scene --map cave --x 18 --y 45 --hour 12 --q "mobs=bloomwhale,bloodhorn&solo=1&wps=none" --eval "Promise.all([import('./scene2d.js'),import('./scene_view.js'),import('./scene_fx.js'),import('./skillfx.js')]).then(([S3,V,SF,Fx])=>{const G=V.G,cv=document.getElementById('c');G.fires.clear();const w=G.mobs.get(1),b=G.mobs.get(2);const shotW=(t0,dt)=>{S3.fx.clear();b.x=G.me.x+999;b.y=G.me.y+999;const wx=G.me.x-10,wy=G.me.y-6;w.x=dt<1750?wx-24:wx;w.y=dt<1750?wy-18:wy;w.bst=dt<1750?2:0;SF.setFxClock(t0);const ctx={G,S3,Sound:{play(){}},entityPos:(id)=>G.mobs.get(id)||G.me,heightOf:()=>1.5,t:t0};S3.fx.tele(wx,wy,70,1800);Fx.skillEvent(['t',wx,wy,70,1800],ctx);Fx.skillEvent(['bc',1,0],ctx);if(dt>=1750){SF.setFxClock(t0+1750);S3.render(wx,wy,0.016,t0+1750,false);}SF.setFxClock(t0+dt);S3.render(wx,wy,0.016,t0+dt,false);const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;c.getContext('2d').drawImage(cv,0,0);return c;};const shotB=(t0,dt)=>{S3.fx.clear();w.x=G.me.x+999;w.y=G.me.y+999;b.x=G.me.x-42;b.y=G.me.y-24;SF.setFxClock(t0);const ctx={G,S3,Sound:{play(){}},entityPos:(id)=>G.mobs.get(id)||G.me,heightOf:()=>1.5,t:t0};for(let j=1;j<=5;j++){const jx=b.x+j*20,jy=b.y+j*12;S3.fx.tele(jx,jy,13,900);Fx.skillEvent(['t',jx,jy,13,900],ctx);if(j%2===1)S3.fx.pool(jx,jy,26,5000,'#ff8a3a',900);}Fx.skillEvent(['bc',2,0],ctx);SF.setFxClock(t0+dt);S3.render(b.x+56,b.y+30,0.016,t0+dt,false);const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;c.getContext('2d').drawImage(cv,0,0);return c;};const w1=shotW(1000,420),w2=shotW(4000,1880),w3=shotW(8000,2260),b1=shotB(12000,220),b2=shotB(15000,620),b3=shotB(18000,1080);const out=document.createElement('canvas');out.width=960;out.height=600;out.style.cssText='position:fixed;left:0;top:0;width:960px;height:600px;z-index:99;image-rendering:pixelated';document.body.appendChild(out);const g=out.getContext('2d');g.imageSmoothingEnabled=false;[[w1,0,0,'꽃무덤 고래 1: 잠수·경고'],[w2,1,0,'꽃무덤 고래 2: 떠오름·발동'],[w3,2,0,'꽃무덤 고래 3: 잔상'],[b1,0,1,'혈루 왕도마뱀 1: 사출·경고'],[b2,1,1,'혈루 왕도마뱀 2: 사출·발동'],[b3,2,1,'혈루 왕도마뱀 3: 사출·잔상']].forEach(([im,col,row,lbl])=>{const x0=col*320,y0=row*300;g.drawImage(im,Math.floor((im.width-160)/2),Math.floor((im.height-150)/2),160,150,x0,y0,320,300);g.fillStyle='rgba(20,16,28,0.88)';g.fillRect(x0+8,y0+8,304,24);g.fillStyle='#ffe9b8';g.font='bold 12px sans-serif';g.textAlign='center';g.fillText(lbl,x0+160,y0+24);});})" --wait 100 --out shots/gemini-boss-effects.png
  ```
- 스크린샷 경로: `game/shots/gemini-boss-effects.png`
