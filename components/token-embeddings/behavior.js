(() => {
 const {data,additive,esc,vec,note}=window.Diagram,c=data.cases[0];
 document.querySelector('.embedding-content').innerHTML=`<h2>トークン化と位置情報</h2><p>${esc(c.prompt)}</p><p>${esc(data.model.positionEncoding.label)}${additive?'：埋め込みに位置ベクトルを加算':'：埋め込みへの位置ベクトル加算は表示しません'}</p><div class="embedding-grid">${c.tokens.map((t,i)=>`<section><h3>${esc(t.text)} <small>位置 ${i}</small></h3><p>埋め込み<br><b>${vec(t.embedding)}</b></p>${additive?`<p>＋ 位置ベクトル<br><b>${vec(t.position)}</b></p>`:''}<p>層への入力<br><b>${vec(t.input)}</b></p></section>`).join('')}</div><p>このトークン列をTransformerへ渡します。</p>`;
 document.querySelector('figcaption').textContent=note()+` 表示成分は${data.model.componentIndices.slice(0,2).join('・')}（0始まり）です。表示値の切り捨てにより、表示された加算結果に差が出る場合があります。`;
})();
