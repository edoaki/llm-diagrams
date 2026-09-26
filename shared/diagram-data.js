/* Shared reader is embedded in every standalone HTML; no fetch or external assets. */
'use strict';
(() => {
 const data=JSON.parse(document.querySelector('#diagram-data').textContent);
 const fail=message=>{throw new Error('図のデータ: '+message);};
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const vector=(v,n,label)=>{if(!Array.isArray(v)||v.length!==n||!v.every(finite))fail(label+'の成分数または値が不正です');};
 const model=data.model;
 if(data.schemaVersion!==1)fail('schemaVersionは1が必要です');
 if(!['illustrative','measured'].includes(model.status))fail('model.statusが不正です');
 if(!Number.isInteger(model.numLayers)||model.numLayers<1)fail('numLayersは正の整数です');
 const layers=[...new Set([1,Math.min(2,model.numLayers),model.numLayers])];
 const dims=model.componentIndices;
 if(!Array.isArray(dims)||dims.length<2||new Set(dims).size!==dims.length||!dims.every(n=>Number.isInteger(n)&&n>=0&&n<model.hiddenSize))fail('componentIndicesを確認してください');
 if(!['sinusoidal','learned_absolute','rope','other'].includes(model.positionEncoding.type))fail('位置情報の方式を確認してください');
 if(model.status==='measured'&&(!model.id||!model.extraction?.hiddenStateDefinition))fail('実測にはモデル名とhiddenStateDefinitionが必要です');
 const additive=['sinusoidal','learned_absolute'].includes(model.positionEncoding.type);
 const checkToken=t=>{
  if(typeof t.text!=='string')fail('トークンtextが必要です');
  if(model.status==='measured'&&!Number.isInteger(t.id))fail('実測にはtoken idが必要です');
  vector(t.embedding,dims.length,'embedding');vector(t.input,dims.length,'input');
  if(additive)vector(t.position,dims.length,'position');
  for(const l of layers)vector(t.layers[String(l)],dims.length,'layer '+l);
  for(const l of [0,...layers]){vector(t.points[String(l)],2,'points '+l);if(t.points[String(l)].some(n=>n<0||n>1))fail('pointsは0〜1です');}
 };
 const checkCandidates=(cs,index)=>{
  if(!Array.isArray(cs)||!cs.length)fail('候補がありません');
  if(cs.some(c=>typeof c.text!=='string'||!finite(c.probability)||c.probability<0||c.probability>1))fail('確率は0〜1です');
  if(model.status==='measured'&&cs.some(c=>c.text!=='その他'&&!Number.isInteger(c.tokenId)))fail('実測候補のtokenIdが必要です');
  if(Math.abs(cs.reduce((s,c)=>s+c.probability,0)-1)>1e-6)fail('その他を含む確率の合計を1にしてください');
  if(!Number.isInteger(index)||index<0||index>=cs.length||cs[index].text==='その他')fail('selectedIndexを確認してください');
 };
 if(!Array.isArray(data.cases)||data.cases.length!==2||data.cases[0].key!=='positive'||data.cases[1].key!=='negative')fail('casesはpositive、negativeの順の2条件です');
 if(!['illustrative','measured'].includes(model.projection.status)||!model.projection.method)fail('配置の出所を記録してください');
 for(const c of data.cases){
  if(typeof c.prompt!=='string'||typeof c.label!=='string'||!Array.isArray(c.continuation))fail('入力文・ラベル・continuationを確認してください');
  if(!c.tokens?.length)fail('tokensが空です');c.tokens.forEach(checkToken);checkCandidates(c.candidates,c.selectedIndex);
  let selected=c.candidates[c.selectedIndex];
  for(const s of c.continuation){checkToken(s.token);if(s.token.text!==selected.text||s.token.id!==selected.tokenId)fail('続きのトークンが直前の選択と一致しません');checkCandidates(s.candidates,s.selectedIndex);selected=s.candidates[s.selectedIndex];}
 }
 const ng=data.ngram,m=ng.matrix;
 if(!['illustrative','measured'].includes(ng.status)||(ng.status==='measured'&&!ng.source))fail('N-gram実測の出典が必要です');
 if(m.status!=='illustrative')fail('並べ替え表は説明用スコアとして保持してください');
 if(ng.probabilities.length!==ng.contexts.length)fail('N-gramの列数が一致しません');
 ng.probabilities.forEach(v=>{vector(v,ng.words.length,'N-gram');if(v.some(n=>n<0||n>1)||Math.abs(v.reduce((a,b)=>a+b,0)-1)>1e-6)fail('N-gramの確率を確認してください');});
 if(m.values.length!==m.words.length)fail('スコア表の行数が一致しません');m.values.forEach(v=>vector(v,m.contexts.length,'スコア表'));
 const permutation=(v,n)=>Array.isArray(v)&&v.length===n&&new Set(v).size===n&&v.every(i=>Number.isInteger(i)&&i>=0&&i<n);
 if(!permutation(m.rowOrder,m.words.length)||!permutation(m.columnOrder,m.contexts.length))fail('並べ替えの順番が不正です');
 for(const [indices,n] of [[m.rowSwap,m.words.length],[m.columnSwap,m.contexts.length]])if(indices.length!==2||indices.some(i=>!Number.isInteger(i)||i<0||i>=n))fail('交換する行・列が不正です');
 if(m.hiddenCell.length!==2||m.hiddenCell.some((i,k)=>!Number.isInteger(i)||i<0||i>=[m.words.length,m.contexts.length][k]))fail('隠すセルが不正です');
 if(!m.range?.every(finite)||m.range.length!==2||m.range[1]<=m.range[0])fail('スコア範囲が不正です');
 // Intl truncates the decimal representation without mutating original values.
 // trailing zeros are omitted; negatives truncate toward zero, never toward -Infinity.
 const formatter=new Intl.NumberFormat('en-US',{useGrouping:false,maximumFractionDigits:3,roundingMode:'trunc'});
 const format=n=>{if(!finite(n))fail('表示する数値が不正です');const s=formatter.format(n);return s==='-0'?'0':s.replace('-','−');};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const percent=p=>format(p*100)+'%';
 const vec=v=>'['+v.slice(0,2).map(format).join(', ')+', …]';
 const steps=c=>[{tokens:c.tokens,candidates:c.candidates,selectedIndex:c.selectedIndex},...c.continuation.map((s,i)=>({tokens:[...c.tokens,...c.continuation.slice(0,i+1).map(x=>x.token)],candidates:s.candidates,selectedIndex:s.selectedIndex}))];
 const note=()=> (model.status==='measured'?`モデル：${model.id}。ベクトル・確率は実測値。`:'ベクトル・確率は説明用の仮置き値で、実モデルの計算結果ではありません。')+' '+(model.projection.status==='measured'?`配置：${model.projection.method}。`:'点の座標・軌跡は説明用の配置です。')+' 表示する数値は小数3桁で切り捨てています。';
 window.Diagram={data,layers,additive,format,percent,esc,vec,steps,note};
})();
