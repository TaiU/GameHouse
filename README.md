# GameHouse

Terry 的遊戲間：一個網頁大廳，收著平常愛玩的小遊戲。純靜態網頁，不需要建置，直接用 GitHub Pages 發佈。

## 目前可以玩

| 桌 | 遊戲 | 檔案 |
|---|---|---|
| 一 | 九宮數獨 | `js/sudoku.js` |
| 二 | 轉角方塊（3D 魔術方塊，three.js） | `js/cube.js` |
| 三 | 旋轉拼板 | `js/spin.js` |
| 四 | 台灣麻將（十六張，一人對三家 AI） | `mahjong/dist/` |
| 五 | 星位（每排、每列、每色塊一顆星） | `js/stars.js` |
| 六 | 疊牌配對 | `js/tilematch.js` |
| 五 | 數字框框 | `js/numbox.js` |
| 八 | 楚河漢界（象棋） | `js/xiangqi.js` |
| 七 | 大老二 | `js/bigtwo.js` |
| 九 | 五子連珠 | `js/gomoku.js` |

準備中：迴廊幻境。

## 結構

- `index.html`：大廳與共用樣式。用網址的 `#遊戲代號` 切換遊戲。
- `js/<遊戲>.js`：每個遊戲一個檔，用 `GameRoom.register(id, { mount(root, api) })` 掛上大廳；`mount` 回傳清理函式。
- `mahjong/`：台麻專案。`dist/` 是遊戲本體，`RULES.md` 是本桌規則，測試用 `cd mahjong && node --test tests/*.test.mjs` 執行。

## 本機試玩

```sh
python3 -m http.server 8000
# 開 http://localhost:8000
```

玩法參考常見遊戲規則；名稱、畫面、關卡與音樂都是原創。
