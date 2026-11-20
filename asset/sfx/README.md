# asset/sfx — 녹음 효과음 (게임에 설치됨)

고른 녹음을 자르고(앞 무음 제거·끝 페이드), 모노 44.1 kHz로 피크 -1 dBFS에 맞춰 Ogg Vorbis로 만든 파일입니다.
같은 파일이 `game/public/assets/sfx/`에 있고, `assets/manifest.json` `"audio"`의 `sfx.<소리>[.<무기>][#변형]` 키로 쓰입니다.
음량(`vol`)은 원래 합성음과 같은 크기(가장 큰 50 ms 기준)로 측정해 맞췄고, 적중·치명타·마무리·스침·화살·마법탄·내려찍기·번개는 합성음을 0.7로 깔고 그 위에 녹음을 3 dB 낮춰 겹칩니다(`synth`).
파일이 없거나 브라우저가 못 읽으면 합성음이 납니다. 비교해서 듣기: `game/public/_sfx.html` (`npm run preview` 뒤 http://127.0.0.1:5178/_sfx.html).

찾은 곳: Openverse (Freesound 원본), 2026-11-21 (2차까지). 전부 CC0 — 게임 안 표기는 필요 없지만 만든이 화면에 한 줄로 밝힙니다.

| 파일 | 원본 제목 | 만든 사람 (Freesound) | 라이선스 | 출처 |
| --- | --- | --- | --- | --- |
| `ui` | UI click | Ranner | CC0 | https://freesound.org/people/Ranner/sounds/488534 |
| `tab` | Soft UI Button Click | Jummit | CC0 | https://freesound.org/people/Jummit/sounds/528561 |
| `open` `close` | Menu Open Modern Gentle | modusmogulus | CC0 | https://freesound.org/people/modusmogulus/sounds/735908 |
| `no` | Multimedia SFX - Error 01.wav | 8bitmyketison | CC0 | https://freesound.org/people/8bitmyketison/sounds/699923 |
| `blip` | Blip or Select | Jofae | CC0 | https://freesound.org/people/Jofae/sounds/379339 |
| `coin` | Coin Pickup Sound | Davidsraba | CC0 | https://freesound.org/people/Davidsraba/sounds/347172 |
| `item` | item-pickup-v1.wav | DeltaCode | CC0 | https://freesound.org/people/DeltaCode/sounds/678384 |
| `potion` | Potion - drink - swallow.wav | ValentinPetiteau | CC0 | https://freesound.org/people/ValentinPetiteau/sounds/574077 |
| `pop` | Bubble Pop | Mafon2 | CC0 | https://freesound.org/people/Mafon2/sounds/253956 |
| `swing` | Swipe Whoosh | qubodup | CC0 | https://freesound.org/people/qubodup/sounds/60007 |
| `swing_sword` | Fast Sword Swing Sound | qubodup | CC0 | https://freesound.org/people/qubodup/sounds/60004 |
| `swing_dagger` | swosh-08.flac - 'stick cutting air' | qubodup | CC0 | https://freesound.org/people/qubodup/sounds/59995 |
| `swing_spear` | Sharp Swosh 18 | qubodup | CC0 | https://freesound.org/people/qubodup/sounds/60005 |
| `swing_hammer` | FX - Swoosh - Slow | bolkmar | CC0 | https://freesound.org/people/bolkmar/sounds/475133 |
| `swing_staff` | Magic Whoosh | DustyWind | CC0 | https://freesound.org/people/DustyWind/sounds/715784 |
| `swing_book` | Page Flip | qubodup | CC0 | https://freesound.org/people/qubodup/sounds/454707 |
| `hit` | body_hit.wav | insanity54 | CC0 | https://freesound.org/people/insanity54/sounds/276600 |
| `hit_sword` | Hit Impact Sword | Eponn | CC0 | https://freesound.org/people/Eponn/sounds/547035 |
| `hit_dagger` | Knife Stab Melon.wav | jawbutch | CC0 | https://freesound.org/people/jawbutch/sounds/344404 |
| `hit_spear` | Sword Impact | TheBuilder15 | CC0 | https://freesound.org/people/TheBuilder15/sounds/434896 |
| `hit_hammer` | Heavy, wet impact.wav | puppetmaster685719 | CC0 | https://freesound.org/people/puppetmaster685719/sounds/626405 |
| `die_small` | Zombie Pain 4.wav | tonsil5 | CC0 | https://freesound.org/people/tonsil5/sounds/555421 |
| `die_big` | Zombie Pain 1.wav | tonsil5 | CC0 | https://freesound.org/people/tonsil5/sounds/555424 |
| `step_grass-1` `step_grass-2` `step_grass-3` `step_grass-4` | 6 footsteps grass | whothefuckisjojo | CC0 | https://freesound.org/people/whothefuckisjojo/sounds/673305 |
| `step_wood-1` `step_wood-2` `step_wood-3` `step_wood-4` | Footsteps on Wood Floor.wav | mrh4hn | CC0 | https://freesound.org/people/mrh4hn/sounds/426620 |
| `step_dirt-1` `step_dirt-2` `step_dirt-3` `step_dirt-4` | Footsteps Dirt Road 1.wav | HenKonen | CC0 | https://freesound.org/people/HenKonen/sounds/682127 |
| `step_water-1` `step_water-2` `step_water-3` `step_water-4` | puddlewalk.wav | j1987 | CC0 | https://freesound.org/people/j1987/sounds/106395 |
| `hurt` | Simple Hit/Hurt Sound | Davidsraba | CC0 | https://freesound.org/people/Davidsraba/sounds/448801 |
| `dash` | Whoosh / Dash (2) | Kastenfrosch | CC0 | https://freesound.org/people/Kastenfrosch/sounds/521996 |
| `bow_shot` | Longbow Release 2.wav | saturdaysoundguy | CC0 | https://freesound.org/people/saturdaysoundguy/sounds/394179 |
| `arrow_hit` | arrow_damage.wav | braqoon | CC0 | https://freesound.org/people/braqoon/sounds/161098 |
| `bow_draw` | Bow Drawn | Paveroux | CC0 | https://freesound.org/people/Paveroux/sounds/490556 |
| `boom` | Small Explosion | Cyberios | CC0 | https://freesound.org/people/Cyberios/sounds/145788 |
| `slam` | Heavy Metal Thud on Ground | 7of9Designs | CC0 | https://freesound.org/people/7of9Designs/sounds/640204 |
| `door` | door - open 01.wav | Anthousai | CC0 | https://freesound.org/people/Anthousai/sounds/398750 |
| `cast` | fishingreel_throw.wav | BranndyBottle | CC0 | https://freesound.org/people/BranndyBottle/sounds/464697 |
| `bite` | water splash 2.wav | VacekH | CC0 | https://freesound.org/people/VacekH/sounds/189499 |
| `landed` | Water splash 5.wav | deleted_user_2104797 | CC0 | https://freesound.org/people/deleted_user_2104797/sounds/164596 |
| `forge_hit` | Anvil Hit 1 | michorvath | CC0 | https://freesound.org/people/michorvath/sounds/270589 |
| `forge_quench` | Steam/hiss | wubitog | CC0 | https://freesound.org/people/wubitog/sounds/234782 |
| `thunder` | thunder-crack 3.wav | Veiler | CC0 | https://freesound.org/people/Veiler/sounds/545748 |
| `magic_hit` | Energy impact 1 | ihitokage | CC0 | https://freesound.org/people/ihitokage/sounds/413219 |
| `spit` | Step on a slug (Splat!) 2 | Breviceps | CC0 | https://freesound.org/people/Breviceps/sounds/447930 |
| `die_boss` | Monster.wav | anwul | CC0 | https://freesound.org/people/anwul/sounds/185366 |
| `step_stone-1` | Footsteps Stone (1).wav | Wdomino | CC0 | https://freesound.org/people/Wdomino/sounds/517118 |
| `step_stone-2` | Footsteps Stone (8).wav | Wdomino | CC0 | https://freesound.org/people/Wdomino/sounds/517135 |
| `step_stone-3` | Footsteps Stone (11).wav | Wdomino | CC0 | https://freesound.org/people/Wdomino/sounds/517124 |

같은 녹음을 쓰는 키: `graze`←hit, `dodge`←swing_dagger, `shoot` `release`←bow_shot, `mob_shot`←swing, `arrow_wall`←arrow_hit, `crit.*` `finisher.*`←hit.*
