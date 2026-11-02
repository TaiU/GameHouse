# GameHouse

Terry 的遊戲間：一個網頁大廳，收著平常愛玩的小遊戲。純靜態網頁，不需要建置，直接用 GitHub Pages 發佈。

## 目前可以玩

| 桌 | 遊戲 | 檔案 |
|---|---|---|
| 一 | 九宮數獨 | `js/sudoku.js` |
| 二 | 轉角方塊（3D 魔術方塊，three.js） | `js/cube.js` |
| 三 | 旋轉拼板（翻轉圖樣、轉板接線兩種玩法） | `js/spin.js` |
| 四 | 台灣麻將（十六張，一人對三家 AI） | `mahjong/dist/` |
| 五 | 星位（每排、每列、每色塊一顆星） | `js/stars.js` |
| 六 | 疊牌配對 | `js/tilematch.js` |
| 五 | 數字框框 | `js/numbox.js` |
| 八 | 楚河漢界（象棋） | `js/xiangqi.js` |
| 七 | 大老二 | `js/bigtwo.js` |
| 九 | 五子連珠 | `js/gomoku.js` |
| 十 | 迴廊幻境（等角錯覺解謎，12 關，原創音樂） | `js/drift.js`、`js/drift-levels.js`、`js/drift-audio.js` |

## 結構

- `index.html`：大廳與共用樣式。用網址的 `#遊戲代號` 切換遊戲。
- `js/<遊戲>.js`：每個遊戲一個檔，用 `GameRoom.register(id, { mount(root, api) })` 掛上大廳；`mount` 回傳清理函式。
- 迴廊幻境分三個檔：`js/drift.js` 引擎與畫面、`js/drift-levels.js` 關卡、`js/drift-audio.js` 音樂與音效（試聽頁 `drift-audio.html`）。關卡格式與規則見 `docs/drift-level-format.md`；改關卡後用 `node tools/drift-check.js js/drift-levels.js` 驗證每關解得開，`node tools/drift-shot.js 輸出資料夾` 逐關截圖。
- 網頁 app（PWA）：`manifest.webmanifest` 與 `sw.js` 讓遊戲間可以加到手機主畫面、離線也能玩。`sw.js` 先上網拿最新檔，斷線才用快取；新增遊戲檔時把路徑加進 `sw.js` 的 `CORE`，並把 `VERSION` 加一。
- `icons/`：logo 原稿 `logo.svg`（黃銅門框裡一顆朱紅棋子，取「遊戲間」的「間」），其餘尺寸用 `node tools/make-icons.js` 從它產生。
- `mahjong/`：台麻專案。`dist/` 是遊戲本體，`RULES.md` 是本桌規則，測試用 `cd mahjong && node --test tests/*.test.mjs` 執行。

## 本機試玩

```sh
python3 -m http.server 8000
# 開 http://localhost:8000
```

玩法參考常見遊戲規則；名稱、畫面、關卡與音樂都是原創。
