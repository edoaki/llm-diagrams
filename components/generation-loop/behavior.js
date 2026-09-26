(() => {
 const {data,esc,percent,note}=window.Diagram,c=data.cases[0],selected=c.candidates[c.selectedIndex];
 document.querySelector('.generation-content').innerHTML=`<h2>生成の一巡</h2><div class="generation-cards"><section><small>入力</small><p>${esc(c.prompt)}</p></section><span>↓</span><section><small>次トークンの確率</small><p>${c.candidates.map(v=>esc(v.text)+' '+percent(v.probability)).join(' ／ ')}</p></section><span>↓</span><section><small>${esc(selected.text)} を選んで入力へ追加</small><p>${esc(c.prompt+selected.text)}</p></section><span>↓</span><section><p>追加したトークンを使い、その先の確率を計算</p></section></div>`;
 document.querySelector('figcaption').textContent=note()+' 選択は記録された生成経路に従います。候補の最大確率と選択結果は別の情報です。';
})();
