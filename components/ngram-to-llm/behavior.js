'use strict';
(() => {
 const root=document.querySelector('#ng-demo');if(!root)return;
 const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
 const {data,format,percent}=window.Diagram;
 const {contexts,words,probabilities,matrix:matrixData}=data.ngram;
 const stages=['確率表','並べ替える','傾向で推測','文脈から予測'];
 let step=0,context=0,sortPhase=0,revealed=false;
 const illustrative=s=>s!=='measured';
 const makeButton=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;};
 stages.forEach((label,i)=>{const b=makeButton(`${i+1} ${label}`,()=>go(i));b.dataset.stage=i;q('.ng-steps').append(b);});

 // Scene 1: column headers select the context, so the table itself is the control.
 const table=q('.ng-prob-table');
 table.style.gridTemplateColumns=`minmax(60px,.8fr) repeat(${contexts.length},minmax(70px,1fr))`;
 for(let row=-1;row<words.length;row++)for(let col=-1;col<contexts.length;col++){
  const head=row===-1&&col>=0,cell=head?makeButton(contexts[col],()=>{context=col;renderContext();}):document.createElement('div');
  cell.className='ng-cell'+(row===-1?' ng-colhead':col===-1?' ng-rowhead':'');
  if(!head)cell.textContent=row===-1?'y ＼ x':col===-1?words[row]:percent(probabilities[col][row]);
  if(col>=0)cell.dataset.col=col;if(head)cell.dataset.context=col;table.append(cell);
 }
 function renderContext(){
  qa('[data-context]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.context===context)));
  qa('[data-col]').forEach(c=>c.classList.toggle('ng-selected',+c.dataset.col===context));
 }

 // Scenes 2–3: one score matrix whose cells move between layouts.
 const matrix=q('.ng-matrix');
 const {words:matrixWords,contexts:matrixContexts,values,rowOrder:rowShuffled,columnOrder:colShuffled,rowSwap,columnSwap,hiddenCell}=matrixData;
 // Sorting steps through the row swap, the column swap, then the rest at once; each button names its operation.
 const sortOps=[
  {back:'◀ 戻す',next:'行を入れ替える ▶'},
  {back:'◀ 行を元に戻す',next:'列を入れ替える ▶'},
  {back:'◀ 列を元に戻す',next:'残りをまとめて並べ替える ▶'},
  {back:'◀ まとめて並べ替える前に戻す',next:'並べ替え完了'}];
 const rowH=54,top0=54,colW=80/matrixContexts.length;
 for(let r=0;r<matrixWords.length;r++)for(let c=0;c<matrixContexts.length;c++){const el=document.createElement('div');el.className='ng-number';el.dataset.r=r;el.dataset.c=c;el.style.setProperty('--value',(values[r][c]-matrixData.range[0])/(matrixData.range[1]-matrixData.range[0])*5);matrix.append(el);}
 for(const [axis,labels] of [['x',matrixContexts],['y',matrixWords]])labels.forEach((label,i)=>{const el=document.createElement('span');el.className=`ng-axis ng-${axis}`;el.dataset.index=i;el.textContent=label;matrix.append(el);});
 const corner=document.createElement('span');corner.className='ng-axis ng-corner';corner.textContent='y ＼ x';matrix.append(corner);
 matrix.style.height=(top0+matrixWords.length*rowH+8)+'px';
 qa('.ng-number,.ng-axis.ng-x').forEach(el=>el.style.width=(colW-4)+'%');
 q('.ng-matrix-badge').textContent=`スコア ${matrixData.range.join('〜')}`;
 function renderMatrix(){
  const layoutPhase=step===2?3:sortPhase;
  const swap=(order,a,b)=>order.map(i=>i===a?b:i===b?a:i);
  const rowOrder=layoutPhase===3?matrixWords.map((_,i)=>i):layoutPhase>=1?swap(rowShuffled,...rowSwap):rowShuffled;
  const colOrder=layoutPhase===3?matrixContexts.map((_,i)=>i):layoutPhase>=2?swap(colShuffled,...columnSwap):colShuffled;
  const highlighted=(r,c)=>step===1&&(sortPhase===1&&rowSwap.includes(r)||sortPhase===2&&columnSwap.includes(c));
  const masked=(r,c)=>step===2&&r===hiddenCell[0]&&c===hiddenCell[1]&&!revealed;
  const x=pos=>(16+pos*colW)+'%',y=pos=>(top0+pos*rowH)+'px';
  qa('.ng-number').forEach(el=>{const r=+el.dataset.r,c=+el.dataset.c;el.style.left=x(colOrder.indexOf(c));el.style.top=y(rowOrder.indexOf(r));el.textContent=masked(r,c)?'?':format(values[r][c]);el.classList.toggle('ng-hidden-value',masked(r,c));el.classList.toggle('ng-answer',step===2&&revealed&&r===hiddenCell[0]&&c===hiddenCell[1]);el.classList.toggle('ng-swapped',highlighted(r,c));});
  qa('.ng-axis.ng-x,.ng-axis.ng-y').forEach(el=>{const isX=el.classList.contains('ng-x'),pos=(isX?colOrder:rowOrder).indexOf(+el.dataset.index);el.style.left=isX?x(pos):'0';el.style.top=isX?'0':y(pos);el.classList.toggle('ng-swapped',highlighted(isX?-1:+el.dataset.index,isX?+el.dataset.index:-1));});
  const layoutLabel=layoutPhase===3?'並べ替えた配置':layoutPhase===0?'元の配置':'並べ替え中';
  matrix.setAttribute('aria-label',`${layoutLabel}のスコア表。列：${colOrder.map(c=>matrixContexts[c]).join('、')}。${rowOrder.map(r=>matrixWords[r]+'：'+colOrder.map(c=>masked(r,c)?'はてな':format(values[r][c])).join('、')).join('。')}`);
  q('.ng-matrix-title').textContent=step===2?'傾向があれば、見ていない組み合わせ「?」も推測しやすい':'行と列を並べ替えると、表の傾向が見えてくる';
  const back=q('[data-sort-back]'),next=q('[data-sort-next]');
  back.hidden=next.hidden=step!==1;
  back.textContent=sortOps[sortPhase].back;back.disabled=sortPhase===0;
  next.textContent=sortOps[sortPhase].next;next.disabled=sortPhase===3;
  q('[data-reveal]').hidden=step!==2;
  q('[data-reveal]').textContent=revealed?'もう一度隠す':'答えを見る';
  q('[data-reveal]').setAttribute('aria-expanded',String(revealed));
  q('.ng-matrix-note').hidden=step!==2||!revealed;
  q('.ng-matrix-note').textContent=`${matrixContexts[hiddenCell[1]]} → ${matrixWords[hiddenCell[0]]}：${format(values[hiddenCell[0]][hiddenCell[1]])}`;
 }

 // Scene 4 embeds the decoder diagram (components/decoder-kv-cache), computing only the last word.
 const decoder=q('[data-decoder]').decoderDiagram;

 function go(n){step=n;root.dataset.step=step;
  qa('[data-stage]').forEach(b=>{if(+b.dataset.stage===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  const panel=['table','matrix','matrix','attention'][step];qa('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==panel);
  q('[data-prev]').disabled=step===0;q('[data-next]').disabled=step===stages.length-1;q('.ng-page').textContent=`${step+1} / ${stages.length}`;
  renderContext();renderMatrix();decoder.settle();
 }
 q('[data-prev]').addEventListener('click',()=>go(Math.max(0,step-1)));q('[data-next]').addEventListener('click',()=>go(Math.min(stages.length-1,step+1)));
 q('[data-sort-back]').addEventListener('click',()=>{sortPhase=Math.max(0,sortPhase-1);renderMatrix();});
 q('[data-sort-next]').addEventListener('click',()=>{sortPhase=Math.min(3,sortPhase+1);renderMatrix();});
 q('[data-reveal]').addEventListener('click',()=>{revealed=!revealed;renderMatrix();});
 q('figcaption').textContent=(illustrative(data.model.status)?'':`予測はモデル ${data.model.id} の実測値。`)+'線はAttentionの重みではありません。';
 q('.ng-interactive').hidden=false;q('.ng-fallback').hidden=true;go(0);
})();
