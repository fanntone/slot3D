# 戰神賽特 II 覺醒之力・麥塊版（slot3D）

麥塊（Minecraft）風格的類 3D 復刻：5 列 × 6 欄消除型老虎機。玩法、賠率、倍數球、免費遊戲、覺醒之力（分裂／鎖定圖騰）、JACKPOT、神秘寶箱、購買特色、自動旋轉、測試情境，全部對照參考站的本地試玩引擎移植；畫面改以 three.js 體素（voxel）重新打造：砂岩神殿、金塊盤面框、像素擠出的 18 個符號、方塊角色與粒子特效，UI 採麥塊 GUI 風格。

參考站：`https://thunder-court.outsider987.workers.dev/?theme=thunder&gn=golden-seth&…&t=local-demo`

## 執行

```bash
npm install            # 只有 harness 需要（playwright-core，使用本機 Chrome）
npm run serve          # http://127.0.0.1:8080/
```

純靜態頁面，任何靜態伺服器都能跑（需要 http://，不能用 file://，因為使用 ES modules 與 importmap）。

網址參數：

| 參數 | 說明 |
| --- | --- |
| `?test=1` | 左側出現「測試」面板，可強制下一轉的情境（免費遊戲、覺醒、JP、神秘寶箱、各級大獎…） |
| `?seed=xxx` | 固定亂數種子（可重現） |
| `?reset=1` | 清除儲存的點數與設定（回到 100,000） |
| `?fast=1` | 驗收用：所有演出等待縮到最短 |

鍵盤：空白鍵旋轉；演出中再按一次加速；Esc 關閉面板。

## 專案結構

```
index.html              頁面骨架（載入畫面、canvas、HUD、彈窗、面板）
styles/main.css         麥塊 GUI 樣式
vendor/three.module.js  three.js 0.160（本機副本，不需網路）
src/engine/             純邏輯，無瀏覽器相依（Node 可直接測）
  config.js             符號、賠率表、倍數球、免費遊戲、JP、神秘寶箱、押注清單等常數
  rng.js                可播種 PRNG（sfc32）與權重抽樣
  engine.js             盤面產生、8+ 消除、下落補位、倍數球、覺醒技能、JP、封頂（回傳事件序列）
  round.js              事件 → 伺服器格式 views（與參考站 gameState[] 相同），整局執行（含免費遊戲）
  scenarios.js          測試情境（強制結果）
  demoServer.js         本地模擬伺服器：點數、下注、紀錄、設定（localStorage）
src/render/             three.js 呈現
  voxel.js              像素圖擠出成方塊幾何（烘焙方向明暗）
  symbols.js            18 個符號的 16×16 像素圖與體素物件
  scene.js              神殿場景、燈光、主題切換（主遊戲／免費／覺醒）
  board.js              30 格的掉落、消除、下落、升級、鎖定、分裂動畫
  effects.js            方塊碎片、金幣噴泉、閃電、火球
  characters.js         賽特與奈芙蒂斯體素角色：動作片段系統（待機／張望／走動／施法丟火球／歡呼／跳舞／懸浮／技能／鞠躬）
  textures.js / text3d.js / icons.js / tween.js
src/game/
  app.js                啟動流程、旋轉／自動／購買／押注、狀態快照（window.__game）
  sequencer.js          把一局的事件演成動畫與彈窗
src/ui/                 HUD、彈窗、面板（規則／押注／自動／設定／購買／紀錄）、測試面板
src/audio/sfx.js        WebAudio 合成音效與背景音樂
harness/                驗收骨架
```

## 驗收（harness）

```bash
npm run harness            # 引擎案例 + 端到端
npm run harness:engine     # node --test harness/engine.test.mjs
npm run harness:e2e        # 真實 Chrome：載入頁面、按鍵旋轉、各特色流程、面板、重新載入
node harness/shot.mjs out  # 開發用：走一輪流程並截圖到 out/
```

- 引擎案例的黃金值全部依規則頁手算（押注 20：8 個荷魯斯之眼 = 200.00、12 個 = 1000.00、4 個 scatter = 60.00、JP MINI/MINOR/MAJOR/GRAND = 100 / 500 / 4000 / 40000、封頂 81,000 倍…）。
- 端到端的「實際值」一律取自畫面 DOM（玩家看到的數字），與引擎權威值和手算值（之前餘額 − 花費 + 贏分）對帳；可重複執行（`?reset=1`）。
- e2e 一次只跑一個 Chrome；同時跑兩個 headless 瀏覽器會因軟體繪圖搶 CPU 而逾時。

## 與參考站的對應

| 參考站 | 本專案 |
| --- | --- |
| 本地試玩引擎（Vite 外殼內的 class St） | `src/engine/engine.js`（常數與權重相同） |
| gameState[] views 格式 | `src/engine/round.js` 的 `toViews` |
| Cocos ReelView / Symbol 動畫 | `src/render/board.js` |
| 測試工具面板（`?test=1`） | `src/ui/testpanel.js` |
| 喵汪交易所（crypto 主題的買進／持倉層） | 未實作（thunder 主題本來就沒有啟用） |
