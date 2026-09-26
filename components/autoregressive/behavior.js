'use strict';
(() => {
 const {data,steps,percent,note}=window.Diagram;
 const root=document.querySelector('#ar-demo'),q=s=>root.querySelector(s);
 const select=q('select'),next=q('[data-next]'),play=q('[data-play]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let step=0,timer=null;
 select.replaceChildren(...data.cases.map((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.label;return o;}));
 const frames=()=>steps(data.cases[+select.value]);
 function stop(){clearInterval(timer);timer=null;play.textContent=reduced.matches?'再生（1段ずつ）':'順に再生';play.setAttribute('aria-pressed','false');}
 function render(){
  const fs=frames(),done=step===fs.length,f=fs[Math.min(step,fs.length-1)];
  const words=[...f.tokens.map(t=>t.text),...(done?[f.candidates[f.selectedIndex].text]:[])];
  q('.ld-sequence').replaceChildren(...words.map(t=>{const el=document.createElement('span');el.className='ld-token';el.textContent=t;return el;}));
  q('.ld-candidate').textContent=done?'記録した生成区間の終わりです。':'次の候補：'+f.candidates.map(c=>c.text+' '+percent(c.probability)).join(' ／ ');
  q('[role="status"]').textContent=done?'記録の終わりで停止しました。EOSを選んだことを意味する表示ではありません。':step?'選んだトークンを入力へ追加し、次の確率を表示しています。':'選んだ結果を入力へ戻します。';
  next.disabled=done;play.disabled=done;select.disabled=step>0;
 }
 function advance(){if(step<frames().length)step++;if(step===frames().length)stop();render();}
 next.addEventListener('click',()=>{stop();advance();});
 play.addEventListener('click',()=>{if(timer){stop();return;}if(step===frames().length)return;if(reduced.matches){advance();return;}play.textContent='停止';play.setAttribute('aria-pressed','true');timer=setInterval(advance,1400);});
 q('[data-reset]').addEventListener('click',()=>{stop();step=0;render();});select.addEventListener('change',render);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});reduced.addEventListener('change',stop);
 q('figcaption').textContent=note()+' 記録された選択を順に再生します。モデルをブラウザで実行しているわけではありません。';
 q('.ld-controls').hidden=false;stop();render();
})();
