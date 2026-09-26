# デコーダーの動作

実装済み: `components/decoder-kv-cache/` → `dist/decoder-kv-cache.html`。

I と live の処理が済んだ状態から、in と Tokyo の層ごとの計算・過去のK・Vの参照・表現空間の変化・出力確率と選択を同期表示する。3層、座標、確率は説明用。一段階ずつ進む・戻る・リセットに対応。
