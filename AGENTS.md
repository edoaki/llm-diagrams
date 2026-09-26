# 開発方針

- Node.js 22.17以上とnpmを使用する。
- 各図のHTML・CSS・挙動は components/<id>/ にまとめる。外部CDNや元リポジトリに依存させない。
- 変更後は npm run build と npm test。dist/ と index.html は生成物として管理する。
- 値や座標が説明用かどうかはデータの status で管理し、画面には「説明用」などの注記を表示しない。
- 外部へのpush・公開・送信は、ユーザーが明示的に指示したときだけ行う。

# 表現図の役割

- `dist/gpt-representations.html` は not なしの文章を扱う通常版。not の有無を選ぶUIや切り替え機能を設けない。
- `dist/gpt-representations-not.html` は not の有無を選択できる比較版。この2つの表現図では、こちらだけに not の選択機能を設ける。
- 共通する表示・アニメーションの修正は両方の `components/` の生成元に反映し、比較版だけ古い挙動のまま残さない。
- `autoregressive.html` は不要なため、生成対象や一覧に戻さない。

# デコーダー図の共有

- `components/decoder-kv-cache/` がデコーダー図の本体。`ngram-to-llm` は最後の場面でこれを埋め込む（`components.json` の `uses`）。
- デコーダー図の見た目・動きの修正は `decoder-kv-cache` 側だけで行い、`ngram-to-llm` に別実装を作らない。
