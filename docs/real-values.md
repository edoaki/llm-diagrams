# 実測値への差し替え

## 渡すもの

先輩には **`dist/gpt-representations-not.html` と `docs/prompt-extract.md`** を渡してください。HTMLの `id="diagram-data"` が形式の見本です。指示書の本文を先輩のCodexへ貼り付けると、使用できるローカルモデルを調べ、実測データを取得するための作業を依頼できます。モデルはこの教材側には不要です。

返してもらった `measurements.json` と取得レポートを、このリポジトリのCodexへ渡し、`docs/prompt-import.md` の本文を貼り付けてください。

## 原本と配布HTML

編集する原本は **`components/gpt-representations-not/template.html` の先頭にある `<script type="application/json" id="diagram-data">`** です。JSONの中にはコメントを入れず、説明は直前のHTMLコメントに書きます。

`npm run build` が全7図へ同じデータを埋め込みます。元リポジトリやCDN、別のJSONを読み込む必要はなく、配布HTMLを1つ渡すだけで動きます。配布先ではそのHTML内のデータ欄を直接変更できます。ただし、リポジトリの `dist/` だけを直すと次のビルドで上書きされるため、原本に反映してください。

取得結果の基本形は `{ "schemaVersion": 1, "model": { ... }, "cases": [ ... ] }` です。`ngram` は既存データを維持します。検証して原本へ取り込むには次を使います。

```sh
node scripts/import-measurements.mjs /path/to/measurements.json
npm run build
npm test
```

スクリプトは `model.status="measured"` と基本的な整合性を確認します。値が本当にそのモデルから得られたかは、取得レポートと照合してください。公開やpushはこのスクリプトでは行いません。

## 共通の文章

- notなし：`The capital of France is`
- notあり：`The capital of France is not`

末尾に空白を足しません。モデルの実際のトークン分割を使い、単語ごとに手作業で分割しません。各条件で次トークンを1つ選び、追加後の確率とその追加トークンの表現も取得します。別の題材を追加する必要はありません。期待どおりの候補にならなくても結果を改変しません。

## データの意味

| 項目 | 内容 |
| --- | --- |
| `schemaVersion` | `1` |
| `model.status` | `illustrative` または `measured`。model/casesが全て実測でそろってからmeasuredにする |
| `model.id` | 使用したモデル名。実測時は必須 |
| `model.numLayers` | 実際のブロック数。表示層は自動で1・2・最終層になる。1〜2層なら重複と省略記号を除く |
| `model.hiddenSize` | 元のベクトルの次元数 |
| `model.componentIndices` | 保存する成分の添字（0始まり）。例 `[0,1]`。全token・全layerで同じ添字順。数字表示は先頭2つ、特徴の帯は保存した成分全体を使う |
| `model.positionEncoding.type` | `sinusoidal` / `learned_absolute` / `rope` / `other` |
| `model.positionEncoding.label` | 画面に出す方式名。rope/otherでは加算アニメーションを行わない |
| `model.extraction` | revision、tokenizer、BOS/EOS方針、dtype、量子化、実行条件、日時など。`hiddenStateDefinition` は実測時必須 |
| `model.projection.status` | `illustrative` または `measured`。ベクトル実測と座標実測を独立に管理 |
| `model.projection.method` | 座標を求めた方法・対象・正規化範囲。模式配置ならその旨を書く |
| `cases` | positive（notなし）、negative（notあり）の順の2要素 |
| `case.key / label / prompt` | 識別子、切り替えボタンの表示、実際の入力文 |
| `case.tokens` | 入力トークン列。BOS等を含めた実際のモデル入力順 |
| `case.candidates` | 次トークンの候補と確率 |
| `case.selectedIndex` | 記録された選択の候補配列内の添字。最有力候補とは別の情報 |
| `case.continuation` | 最初の選択後の記録。最低1件を推奨。各要素は `{token, candidates, selectedIndex}`。tokenは直前の選択と一致させる |

`token` は次の形です。

```json
{
  "id": 123,
  "text": " Paris",
  "embedding": [0.123456, -0.234567],
  "position": null,
  "input": [0.123456, -0.234567],
  "layers": {
    "1": [0.12, -0.23],
    "2": [0.13, -0.24],
    "32": [0.14, -0.25]
  },
  "points": {
    "0": [0.1, 0.2],
    "1": [0.2, 0.3],
    "2": [0.3, 0.4],
    "32": [0.4, 0.5]
  }
}
```

これは**構造の例であり実測値ではありません**。`layers` と `points` のキーは実際の層数に置き換えます。`embedding` は位置処理前の埋め込み、`input` は最初のTransformerブロックが受け取る値です。埋め込みのスケーリング等があれば取得レポートへ記録してください。位置ベクトルを加算する方式では `position` を保存します。`sinusoidal` / `learned_absolute` の加算図に当てはまらない処理があれば、無理に加算に見せず `other` を使用します。

`layers` は各ブロック直後の残差ストリームです。フレームワークのhidden_states配列に最終正規化が含まれるかを調べ、ブロック出力と最終正規化後を混同しないでください。実際のlogitsは通常のモデル出力から取得し、図では出力層へ向かう途中の詳細を省略します。採用した定義を `hiddenStateDefinition` に書きます。

`points` は画面用の0〜1の座標です。0は第1ブロックの入力、他は各ブロック出力に対応します。生のベクトル成分やピクセル値をここへ入れません。実測の可視化なら、両条件・各層・追加トークンを同じ基準で変換してください。層ごとに別々のPCAをすると動きの意味が比較できなくなるため、共通基底を使い、方法を記録します。模式配置を使うことも可能ですが、`projection.status` はillustrativeのままにします。

候補は `{ "tokenId": 123, "text": " Paris", "probability": 0.78 }`。確率は**0〜1の生の値**です。語彙全体にsoftmaxを適用した確率を使い、表示候補だけで再正規化しません。「その他」は非表示候補の合計で、tokenIdはnull、選択対象にはしません。候補群の合計は許容誤差1e-6以内で1にしてください。表示では％に変換後、小数3桁で切り捨てます。端数のゼロは省き、負数は0方向に切り捨て、負のゼロは0と表示します。元データには丸めを入れません。

生成の終わりは「記録した範囲の終わり」と表示します。記録終了をEOSと取り違えないようにしています。

## N-gramと並べ替えの表

- `ngram.probabilities` は文脈ごとの列、列の中は `ngram.words` の順。確率は0〜1。N-gramの出現頻度を実測したい場合は別途コーパスとカウントが必要です。LLMのsoftmax確率で代用してmeasuredにしてはいけません。
- `ngram.matrix.values` は行が単語、列が文脈の**説明用スコア**です。LLMの内部行列でも学習済み重みでもありません。これはillustrativeのままにします。
- `rowOrder` / `columnOrder` は初期配置、`rowSwap` / `columnSwap` は交換対象の元の添字、`hiddenCell` は隠すセルの `[行,列]`。説明文と正解表示はこれらから生成されます。
- `range` は色を付けるスコア範囲。表の行列数は配列から決まります。
- 最後のTransformer場面だけは共通の `cases` を使うため、実測値への置換が自動で反映されます。

## 検証

`npm test` は単独HTMLを別フォルダへコピーしてオフライン表示し、幅960・390・320px、各場面、not切り替え、位置ベクトルの加算、キャンセル、生成の再生・停止を確認します。データ欄だけの変更で12層・RoPE・異なるトークン数・細かい小数・表の説明文と最有力候補が反映されるテストもあります。実測取り込み後は、実測JSONに対する整合性も検証してください。
