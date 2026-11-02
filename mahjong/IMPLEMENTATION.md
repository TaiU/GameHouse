# 台麻前端與引擎交接

本檔由介面實作者維護；規格仍以統籌的 NORTH_STAR.md、RULES.md 為準。

目前引擎版本為 0.2.5，桌規維持 RULES.md 0.2.1；最新交接雜湊見 `tests/results/source-hashes-v025-m1574.json`（dist八檔、測試與交接紀錄）；原版雜湊與證據保留，不作為新版通過依據。

## 目前交付：v0.2.5（m1574）

針對監控 v0.2.4 的 U08 再現，將結算導航移至明細上方，避免下一局與原自摸位置重疊；保留一秒停用防護。只改 index.html、style.css 與引擎版本號，命令介面不變。

46/46 開發測試通過，Chrome 三尺寸固定場景、手機直向兩種雙擊方法、延遲後點原位置、明確 Enter／下一局操作通過。詳見 [新版報告](tests/evidence/v025-m1574/REPORT.md)。U08 待 v0.2.5 獨立複驗；監控最新舊版帳冊為70通過、1部分驗證、1失敗，不能以本次開發測試直接改為獨立通過。產品交付後凍結，未發布。

## v0.2.4 歷史交付（m1536；後續監控 U08 未通過）

修復監控發現的U08：雙擊自摸第二下可能落在新結算視窗的下一局。結算開啟後，兩處下一局與返回牌桌按鈕停用一秒，啟用後仍拒絕連點及重複鍵盤事件。命令介面及同窗多人回覆規則維持0.2.3契約；引擎僅升版號，桌規不變。

46/46開發測試通過；同一監控prehu固定場景在Chrome三尺寸雙擊自摸均保留第1局結算，稍後正常續局及鍵盤操作通過。詳見 [本次驗證報告](tests/evidence/v024-m1536/REPORT.md)。本次未重跑自然完整瀏覽器牌局，尚待監控獨立複驗U08。交付後產品再次凍結；未發布。

## v0.2.3 歷史獨立驗證狀態（m1494）

已直接讀取監控站的 [v0.2.3獨立複驗報告](qa/regression-review-m1430.md)、[baseline.json](qa/runs/v023-m1430/baseline.json)、[replay-output.json](qa/runs/v023-m1430/replay-output.json) 及 [targeted-results.json](qa/runs/v023-m1430/targeted-results.json)。**v0.2.3的U01／U02與多人反應窗已獨立複驗通過，包含commands.mjs，不再標示為待獨立確認。**

- 監控基準包含八個產品檔，全部符合v0.2.3清單。
- U02：第1局實體牌96的round-1／version35舊命令，在第2局被拒絕且完整state不變；round-2／version1新命令可接受。
- 8組監控定向測試全數PASS；包括同窗其他席命令有效、本人重送拒絕、舊click／Enter及取消／重複timer防護。監控另以12局657步驗證命令層及守恆；報告確認雙胡兩種提交順序皆近家優先。
- 監控報告另載新版自然瀏覽器整局、結算、續局吃牌與出牌及空console；隔離固定場景與自然牌局證據分開。
- 累積72項為67 PASS、5 PARTIAL、0 FAIL、0 NOT_RUN，並非72項全部重跑。剩餘T06、S08、U04、U06、U08仍為部分驗證，尚未整體驗收通過或實機接受。

上述為監控站獨立證據，不以開發方44項測試替代。產品維持凍結，未發布。本次只更新交接文件；原定版清單及qa證據不修改。原清單中的文件雜湊屬交付當時快照，本次文件異動由 `tests/results/handoff-status-m1494.json` 補充記錄；八個產品雜湊維持不變。

## 啟動

在專案根目錄執行：

```powershell
python -m http.server 8897 --bind 127.0.0.1 --directory dist
```

開啟 http://127.0.0.1:8897 。不需安裝 npm 套件、不需建置。必須用 HTTP 伺服器，不能直接用 file:// 開 ES modules。發布時將整個 dist/ 作為靜態網站根目錄；本成員沒有建立、變更或發布託管站台。

## 檔案與可測介面

- `dist/index.html`、`style.css`、`app.mjs`：繁中牌桌、原創 SVG 牌面、選牌／應牌／結算／規則說明。沒有網路依賴、外部字型或帳號。
- `dist/tiles.mjs`：144 個唯一實體 ID、牌種名稱、洗牌。
- `dist/rules.mjs`：五面子一對眼全部分解、聽牌種類、依有效胡張位置計暗刻及兩面聽、最高合法分解計台、逐筆付款。
- `dist/engine.mjs`（VERSION 0.2.5）：`newGame(seed?)`、`legalActions(state, seat)`、`act(state, seat, action)`、`snapshot(state)`、`observe(state, seat)`、`audit(state)`。非法動作先拒絕、不變更原局面。正常動作回傳新 state。完整 snapshot 與受限 observation 都是深複本，必須分開使用。
- `dist/ai.mjs`：`chooseAction(observation)`，只收 `observe` 的副本。沒有引擎 import；觀察資料沒有牌牆 ID、種子、別人暗手或對手暗槓牌種。
- `tests/`：固定牌型、實體牌狀態 fixture、邊界測試與多局模擬。fixture 不會被 dist 載入。

真人為 seat 0；輪序為 0→1→2→3→0，桌面為下→右→上→左。門風相對莊家計算。牌河被吃碰胡的牌保留灰色歷史標記，守恆計算不重複計入。對手暗槓在牌桌與結算均只顯示牌背。`state.reserve` 記錄洗牌後最後 16 張固定實體 ID；`state.wall` 只含尚未取用的可摸牌與末端底牌，正常摸從前端、補牌從底牌之前的可摸區尾端取，絕不動用底牌。發牌四輪每家四張，遇花立即補。

## 命令校驗（m1403，取代m1398的逐命令加版規則）

`legalActions(state, seat)` 回傳的每個命令都帶有 `roundId` 與整數 `turnVersion`；`observe` 根層也有這兩欄。請直接將當下合法動作交給 `act`，不要自行構造缺少版本的 `{kind:'next'}` 等命令，也不要替舊命令補上目前版本。

```js
const actions = legalActions(state, player);
const action = actions.find(a => a.kind === 'discard');
state = act(state, player, action);
```

每局 `turnVersion` 從 1 起，代表行牌／反應窗版本。一般行牌命令接受後換版；多人反應窗內收到一家回覆時維持版本，其他家原先取得的有效回覆仍可提交，直到所有人回覆、完成優先序判定並離開反應窗才加一。下一局變更 `roundId` 並從 1 起算。同一席已回覆後 `legalActions` 為空，重送胡／過／吃碰槓均拒絕，局面不變；判定優先序依座序與胡牌優先，與到達順序無關。換窗後請重新讀取合法動作。

過期、缺欄、錯局命令在複製／改動之前拋錯，原狀態不變；當前版本的命令仍須符合該席尚未回覆及合法動作清單。欄位與0.2.2相同，但同窗其他席回覆不再強制所有命令失效。

`dist/commands.mjs` 提供共同校驗、捕捉命令的按鈕回呼與 AI 排程防護。選牌、Enter、打出、應牌與兩處下一局按鈕皆綁定當時命令；舊回呼不會重新蓋章。AI 在排程時由受限 observation 選出命令，計時器執行時同時檢查排程世代與命令版本。已取消但已進入佇列的回呼不會操作新局／新窗；每個AI排程回呼只可執行一次，即使反應窗版本尚未變動。前端過期回呼安靜忽略；直接呼叫引擎仍會明確拒絕。

## 重現測試

```powershell
node --test tests/*.test.mjs
node tests/simulate.mjs 200
node tests/export-snapshot.mjs 87654
```

模擬結果保存在 `tests/results/simulation-<timestamp>.json`，若失敗保留當時 state。遊戲不載入測試牌局；正式頁面依當時種子洗牌，沒有演示局、保送或預錄結算。

固定 seed 87654 的完整一局加下一局快照已產生於 `tests/results/v0.2.3-seed-87654-full.jsonl`（step 0 初始，後續為各次操作後 state）；相對應決策前 AI view 與 action 分離於 `v0.2.3-seed-87654-observations.jsonl`。完整快照含私有資訊，不可當作 AI input。

`state.events` 含 `id / roundId / type / text`，亮花事件另有 `player / tile`，普通摸牌公開事件不含暗手牌種或 ID。結算 `state.result` 含本局 `roundId / settlementId / dealer / repeat`、台型與所選分解／胡張位置（測試用）、花胡 `triggerEventId`。每筆 `transfers` 含 `payer / payee / baseTai / dealerTai / totalTai / amount / roundId / settlementId`，保留原 `from / to / tai` 相容欄位。AI view 不含分解與胡張歸屬細節。

## 視覺參考

已實際在 Chrome 開啟指定 Microsoft Store「麻將大戰」頁面並放大第 1/9 張牌局截圖：
https://apps.microsoft.com/detail/9nsc3xf4b2l1?hl=zh-TW&gl=TW

參考四面牌河、中央風位與剩餘牌數、下方真人手牌及沿邊副露；牌面以程式自行繪製 SVG，牌桌以 CSS 製作，沒有複製原作圖像、角色、商標或其他周邊介面。

## 使用與限制

點手牌選取，再按「打出」；已選牌可按 Enter。建議出牌只提供建議，不會自動操作真人席。吃牌列出實際可選組合，過可略過應牌。AI 動作依序執行，只有一個排程計時器。結算列出台型、每筆付款、莊連加台與餘額，並可開始下一局。

本版狀態在記憶體，重新整理重開，頁尾已有揭露。沒有帳號、進度雲端同步或音效。AI 為組牌效率策略，非高階對戰模型。橫向手機可垂直捲動至手牌；不需橫向拖移。減少動態偏好有 CSS 支援。

實作者測試不等於獨立驗收、使用者裝置接受或發布完成；仍交由統籌與監控站確認。
