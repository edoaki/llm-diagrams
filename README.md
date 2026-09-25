# LLM diagrams

GPTの説明図を、図ごとに独立して編集・配布・埋め込みできるよう分離したリポジトリです。

## 開く・渡す

`index.html` をブラウザで直接開くと一覧を表示します。サーバーは不要です。

「文字から空間が動く」図は **`dist/gpt-representations.html`** です。このHTMLファイル1個を渡すだけで、オフラインで操作できます。

| 図 | 単独配布ファイル | 編集場所 |
| --- | --- | --- |
| トークン化と位置情報 | `dist/token-embeddings.html` | `components/token-embeddings/` |
| 文章→ベクトル→各層→出力 | `dist/gpt-representations.html` | `components/gpt-representations/` |
| 次トークンを入力に戻す | `dist/generation-loop.html` | `components/generation-loop/` |

## コンポーネントとして使う

必要な図のJSファイル1個をコピーし、HTMLで読み込みます。フレームワークや外部ライブラリは不要です。

```html
<script src="./gpt-representations.js" defer></script>
<llm-gpt-representations></llm-gpt-representations>
<llm-gpt-representations></llm-gpt-representations>
```

Shadow DOMでCSS・SVG ID・操作状態を分離しています。同じページに複数置いても独立して動きます。ほかの図は `llm-token-embeddings`、`llm-generation-loop` を使います。

単独HTMLはCSSとJSも内蔵します。JavaScript無効時はDeclarative Shadow DOM対応ブラウザで静的な各段階を表示します。JSだけを埋め込む形式はJavaScriptが必要です。印刷時は各層を静的に表示し、「動きを減らす」設定にも対応します。

## 編集・検証

Node.js 22.17以上とnpmを使用します。

```sh
npm ci
npm run browser:install
npm run build
npm test
```

- `components/<id>/template.html`: 図のHTML・SVG・説明用データ
- `components/<id>/style.css`: 図固有の表示
- `components/<id>/behavior.js`: `mount(root)` と後始末関数
- `shared/base.css`: 図の最低限の共通スタイル
- `components.json`: 図の登録一覧
- `dist/`: 自己完結したHTMLとWeb Component用JS（生成物）

新しい図は上記3ファイルを作り `components.json` に登録します。生成ファイルを直接編集せず、`npm run build` で更新します。ビルド自体はNode.jsの標準機能のみで実行できます。

## 今後追加する図

今回は置き場と作業メモのみ作成しています。

- `planned/decoder-kv-cache/`: KVキャッシュを含めたデコーダーの動作
- `planned/ngram-to-llm/`: 「n-gramの最適化としてのLLM」の説明を検討する図

## 分離元

`/Users/aki/docs/ml-landscape/content/models/llm/components/` の `visual-001.html`、`visual-002.html`、`visual-003.html`、`layers.js`、`page.css` を2026-09-26の作業ツリーから分離。元リポジトリの変更や参照は実行時に不要です。

主な変更はスタイルと状態の分離、コンポーネント取り外し時のタイマー破棄、単独配布用ビルドです。操作ラベル「ベクトル化（Word2Vec）」はGPTの埋め込みとWord2Vecを混同しないよう「ベクトル化（埋め込み）」にしました。点や確率は元図の説明用データを保持し、実モデルの計算結果ではありません。

外部への送信・公開は行っていません。利用許諾は分離元の権利者の方針に従い、この作業では新しいライセンスを付与していません。

## HTMLスライドとの連携

`examples/slides.html` にスライド側の「前／次」ボタンで図を進める実例があります。

```html
<script src="./gpt-representations.js" defer></script>
<llm-gpt-representations id="figure" stage="0"></llm-gpt-representations>
<script>
const figure = document.getElementById('figure');
// スライドの表示・段階切り替えイベントから呼び出す
function showOutput() { figure.setAttribute('stage', '6'); }
function resetFigure() { figure.setAttribute('stage', '0'); }
figure.addEventListener('stagechange', event => {
  console.log(event.detail.stage, event.detail.title);
});
</script>
```

`stage` は0（文章）、1（埋め込み）、2〜4（第1〜3層）、5（N層）、6（出力）。初期化時と図内の操作でも `stagechange` が発火します。属性は外部からの指示用で、現在の段階はイベントで受け取ります。

図は配置先の幅に追従し、狭いカラムでは説明を下に並べます。スライドの高さは固定せず、図の幅やスライド側のレイアウトで調整してください。タグをDOMから取り外すと保留中のタイマーを解除し、再配置時には `stage` 属性の段階（未指定なら文章）から初期化します。
