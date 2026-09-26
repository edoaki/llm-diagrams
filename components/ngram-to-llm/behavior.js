'use strict';
(() => {
 const root=document.querySelector('#ng-demo');if(!root)return;
 const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
 const {data,format,percent,esc,note}=window.Diagram;
 const {contexts,words,probabilities,matrix:matrixData}=data.ngram;
 const stages=[
  ['確率表',''],
  ['並べ替える','値はそのままに、行と列の位置だけを変えています。前の操作に戻して、どこが変わったかを見比べられます。'],
  ['傾向を使う',''],
  ['文脈から予測','notの有無で入力と最後のトークンの表現を比較します。文脈を切り替えて比べてみてください。']
 ];
 let step=0,context=0,sortPhase=0,structureSorted=true,revealed=false,bank='money',phase=0,paused=false,bankTimer;
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const bankExamples=Object.fromEntries(data.cases.map((c,i)=>[i===0?'money':'river',c]));
 const makeButton=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;};
 stages.forEach((s,i)=>{const b=makeButton(`${i+1} ${s[0]}`,()=>go(i));b.dataset.stage=i;q('.ng-steps').append(b);});
 const holder=q('[data-panel="table"] .ng-contexts');contexts.forEach((label,i)=>{const b=makeButton(label,()=>{context=i;renderContext();});b.dataset.context=i;holder.append(b);});
 const table=q('.ng-prob-table');
 for(let row=-1;row<words.length;row++)for(let col=-1;col<contexts.length;col++){
  const cell=document.createElement('div');cell.className='ng-cell'+(row===-1?' ng-colhead':col===-1?' ng-rowhead':'');
  cell.textContent=row===-1?(col===-1?'y ／ x':contexts[col]):col===-1?words[row]:percent(probabilities[col][row]);
  if(col>=0)cell.dataset.col=col;table.append(cell);
 }
 const matrix=q('.ng-matrix');
 const {words:matrixWords,contexts:matrixContexts,values,rowOrder:rowShuffled,columnOrder:colShuffled,rowSwap,columnSwap,hiddenCell}=matrixData;
 for(let r=0;r<matrixWords.length;r++)for(let c=0;c<matrixContexts.length;c++){const el=document.createElement('div');el.className='ng-number';el.dataset.r=r;el.dataset.c=c;el.style.setProperty('--value',(values[r][c]-matrixData.range[0])/(matrixData.range[1]-matrixData.range[0])*5);matrix.append(el);}
 for(const [axis,labels] of [['x',matrixContexts],['y',matrixWords]])labels.forEach((label,i)=>{const el=document.createElement('span');el.className=`ng-axis ng-${axis}`;el.dataset.index=i;el.textContent=label;matrix.append(el);});
 q('.ng-prob-table').style.gridTemplateColumns=`minmax(65px,1fr) repeat(${contexts.length},minmax(65px,1fr))`;
 q('.ng-matrix').style.height=(105+matrixWords.length*54)+'px';
 q('.ng-matrix').style.minWidth=Math.max(560,100+matrixContexts.length*110)+'px';
 q('.ng-table-note').textContent=data.ngram.status==='measured'?'出現頻度から求めた確率（表示の切り捨てで合計が100%にならない場合があります）':'N-gramの確率は説明用の仮置き値です。各列の合計は100%です。';
 q('.ng-example-label').innerHTML='N-gramの例<br>（単語単位）';
 q('.ng-ngram-example small').textContent='文脈 x：直前の語';
 q('.ng-ngram-example b').textContent=contexts[0];
 qa('.ng-ngram-example b')[1].textContent=words[0];
 function renderContext(){
  qa('[data-context]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.context===context)));
  qa('[data-col]').forEach(c=>c.classList.toggle('ng-selected',+c.dataset.col===context));

 }
 function renderMatrix(){
  const layoutPhase=step===2?(structureSorted?3:0):sortPhase;
  const swap=(order,a,b)=>order.map(i=>i===a?b:i===b?a:i);
  const rowOrder=layoutPhase===3?matrixWords.map((_,i)=>i):layoutPhase>=1?swap(rowShuffled,...rowSwap):rowShuffled;
  const colOrder=layoutPhase===3?matrixContexts.map((_,i)=>i):layoutPhase>=2?swap(colShuffled,...columnSwap):colShuffled;
  const highlighted=(r,c)=>step===1&&(sortPhase===1&&rowSwap.includes(r)||sortPhase===2&&columnSwap.includes(c));
  const masked=(r,c)=>step===2&&r===hiddenCell[0]&&c===hiddenCell[1]&&!revealed;
  qa('.ng-number').forEach(el=>{const r=+el.dataset.r,c=+el.dataset.c;el.style.left=(16+colOrder.indexOf(c)*(80/matrixContexts.length))+'%';el.style.top=(54+rowOrder.indexOf(r)*54)+'px';el.textContent=masked(r,c)?'?':format(values[r][c]);el.classList.toggle('ng-hidden-value',masked(r,c));el.classList.toggle('ng-swapped',highlighted(r,c));});
  qa('.ng-axis').forEach(el=>{const isX=el.classList.contains('ng-x'),pos=(isX?colOrder:rowOrder).indexOf(+el.dataset.index);el.style.left=isX?(16+pos*(80/matrixContexts.length))+'%':'0';el.style.top=isX?'0':(54+pos*54)+'px';el.classList.toggle('ng-swapped',highlighted(isX?-1:+el.dataset.index,isX?+el.dataset.index:-1));});
  const orderLabel=step===2?(structureSorted?'並べ替えた配置':'元の配置'):['0 / 3 · 最初の配置',`1 / 3 · ${rowSwap.map(i=>matrixWords[i]).join(' と ')} の行を交換済み`,`2 / 3 · ${columnSwap.map(i=>matrixContexts[i]).join(' と ')} の列も交換済み`,'3 / 3 · 並べ替え完了'][sortPhase];
  q('.ng-matrix-order').textContent=orderLabel;
  matrix.setAttribute('aria-label',`${orderLabel}のスコア表。列：${colOrder.map(c=>matrixContexts[c]).join('、')}。${rowOrder.map(r=>matrixWords[r]+'：'+colOrder.map(c=>masked(r,c)?'はてな':format(values[r][c])).join('、')).join('。')}`);
  q('.ng-matrix-title').textContent=step===2?'表の傾向から値を考える':'並べ替えて、表の傾向を見る';
  q('.ng-matrix-intro').textContent=step===2?'前の場面と同じ表から、値を1つ隠しました。行や列の増減を手がかりに、「?」にはどんな値が入りそうか考えてみてください。':'ここからは、文脈と次の語の合い方をスコアで表します。確率表と同じく、列が文脈、行が次の語です。行と列を動かして、共通の傾向を探します。';
  q('.ng-sort-controls').hidden=step!==1;
  q('.ng-structure-controls').hidden=step!==2;
  q('.ng-structure-bridge').hidden=step!==2;
  q('[data-sort-back]').disabled=sortPhase===0;
  q('[data-sort-reset]').disabled=sortPhase===0;
  q('[data-sort]').disabled=sortPhase===3;
  q('[data-sort]').textContent=sortPhase===3?'並べ替え完了':'次の操作 →';
  q('.ng-sort-instruction').textContent=[`次：${rowSwap.map(i=>matrixWords[i]).join(' と ')} の行を交換`,`次：${columnSwap.map(i=>matrixContexts[i]).join(' と ')} の列を交換`,'次：残りの行と列をまとめて並べ替える','行や列に沿った、値の増減が見える配置になりました。'][sortPhase];
  qa('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.layout==='sorted')===structureSorted)));
  q('[data-reveal]').textContent=revealed?'値をもう一度隠す':'隠した値を確かめる';
  q('[data-reveal]').setAttribute('aria-expanded',String(revealed));
  q('.ng-matrix-note').hidden=step!==2||!revealed;
  q('.ng-matrix-note').textContent=`${matrixContexts[hiddenCell[1]]} → ${matrixWords[hiddenCell[0]]} の元の値は${format(values[hiddenCell[0]][hiddenCell[1]])}です。ただし、周囲の値だけから一意には決まりません。`;
 }
 function renderBank(){
  const example=bankExamples[bank],mixed=phase>0,last=example.tokens.at(-1),f=mixed?last.layers[data.model.numLayers]:last.input;
  qa('[data-bank]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bank===bank)));
  q('.ng-sentence').textContent=example.prompt+' ?';
  q('.ng-sources').replaceChildren(...example.tokens.slice(0,-1).map(t=>{const s=document.createElement('span');s.className='ng-source';s.textContent=t.text;return s;}));
  q('.ng-bank strong').textContent=last.text;
  q('.ng-attention').classList.toggle('ng-mixed',mixed);
  q('[data-panel="attention"]').dataset.phase=phase;
  q('[data-panel="attention"]').classList.toggle('ng-paused',paused);
  q('.ng-bank-vector').innerHTML=f.map(n=>`<i title="${format(n)}" style="--strength:${Math.min(1,Math.abs(n))}"></i>`).join('');
  q('.ng-bank-caption').textContent=mixed?`第${data.model.numLayers}層の表現`:'入力時の表現';
  const best=Math.max(...example.candidates.map(c=>c.probability));
  q('.ng-prediction-label').textContent=last.text+' の表現 → 語ごとのスコア → softmax';
  q('.ng-next-bars').innerHTML=example.candidates.map(c=>`<div class="ng-next-row ${phase===2&&c.probability===best?'ng-top-prediction':''}"><span>${esc(c.text)}</span><span class="ng-bar-track"><span class="ng-bar-fill" style="--p:${phase===2?c.probability*100:0}%"></span></span><b>${phase===2?percent(c.probability):'—'}</b></div>`).join('');
  q('.ng-completion').textContent=phase===2?'最有力候補：'+example.candidates.filter(c=>c.probability===best).map(c=>c.text).join(' ／ '):phase===1?'文脈を含む表現から、次のトークンの確率へ':'まず、最後のトークンより前の文脈を見ます';
  q('[data-playback]').textContent=paused?'再生する':'一時停止';q('[data-playback]').hidden=motion.matches;q('[data-replay]').hidden=motion.matches;
  q('.ng-playback-state').textContent=motion.matches?'結果を表示中':paused?'一時停止中':'自動ループ再生中';
 }
 function scheduleBank(){
  clearTimeout(bankTimer);
  if(step!==3||paused||motion.matches||document.hidden)return;
  bankTimer=setTimeout(()=>{phase=(phase+1)%3;renderBank();scheduleBank();},[1200,1600,3600][phase]);
 }
 function restartBank(){phase=motion.matches||paused?2:0;renderBank();scheduleBank();}
 motion.addEventListener('change',restartBank);
 document.addEventListener('visibilitychange',scheduleBank);
 function go(n){step=n;root.dataset.step=step;clearTimeout(bankTimer);if(motion.matches)phase=2;
  qa('[data-stage]').forEach(b=>{if(+b.dataset.stage===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  q('.ng-copy').textContent=stages[step][1];q('.ng-copy').hidden=!stages[step][1];
  const panel=['table','matrix','matrix','attention'][step];qa('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==panel);
  q('[data-prev]').disabled=step===0;q('[data-next]').disabled=step===stages.length-1;q('.ng-page').textContent=`${step+1} / ${stages.length}`;
  q('[data-next]').textContent=step===stages.length-1?'最後の場面':'次の場面 →';
  renderContext();renderMatrix();renderBank();scheduleBank();
 }
 q('[data-prev]').addEventListener('click',()=>go(Math.max(0,step-1)));q('[data-next]').addEventListener('click',()=>go(Math.min(stages.length-1,step+1)));
 q('[data-sort]').addEventListener('click',()=>{sortPhase=Math.min(3,sortPhase+1);renderMatrix();});
 q('[data-sort-back]').addEventListener('click',()=>{sortPhase=Math.max(0,sortPhase-1);renderMatrix();});
 q('[data-sort-reset]').addEventListener('click',()=>{sortPhase=0;renderMatrix();});
 qa('[data-layout]').forEach(b=>b.addEventListener('click',()=>{structureSorted=b.dataset.layout==='sorted';renderMatrix();}));
 q('[data-reveal]').addEventListener('click',()=>{revealed=!revealed;renderMatrix();});
 qa('[data-bank]').forEach(b=>b.addEventListener('click',()=>{if(bank===b.dataset.bank)return;bank=b.dataset.bank;restartBank();}));
 q('[data-playback]').addEventListener('click',()=>{paused=!paused;renderBank();scheduleBank();});
 q('[data-replay]').addEventListener('click',()=>{paused=false;restartBank();});
 q('figcaption').textContent=note()+' N-gramの表は'+(data.ngram.status==='measured'?'出現頻度の実測':'説明用の仮置き')+'、並べ替えの表は説明用のスコアです。';
 q('.ng-attention-note').textContent='色の帯は表示成分の絶対値を0〜1に収めた模式表示です。線はAttentionの実測重みではありません。';
 qa('[data-bank]').forEach((b,i)=>b.textContent=data.cases[i]?.label||'比較');
 q('.ng-badge').textContent=`文脈との合い方：${matrixData.range.join('〜')}（説明用）`;
 qa('.ng-number,.ng-axis.ng-x').forEach(el=>el.style.width=(76/matrixContexts.length)+'%');
 q('.ng-interactive').hidden=false;q('.ng-fallback').hidden=true;go(0);
})();
