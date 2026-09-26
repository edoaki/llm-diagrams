(() => {
 const root=document.querySelector('.decoder');
 if(!root)return;
 const $=s=>root.querySelector(s);
 const blue='#4c7da5',orange='#c36a28',green='#24816c',muted='#c5d0d7';
 const {data,layers,steps,percent,esc,note}=window.Diagram;
 const frames=steps(data.cases[0]),allTokens=frames.at(-1).tokens;
 const words=allTokens.map(t=>t.text);
 const tokenPaths=allTokens.map(t=>[0,...layers].map(l=>[45+t.points[l][0]*300,60+t.points[l][1]*235]));
 const candidates=frames.map(f=>f.candidates.map(v=>[v.text,v.probability]));
 const count=layers.length,perCycle=count*2+3,total=frames.length*perCycle;
 const label=l=>l?`第${layers[l-1]}層`:'埋め込み';
 const gap=count>1&&layers.at(-1)>layers.at(-2)+1;
 const lastInitial=frames[0].tokens.length-1;
 let step=0;
 const line=(x1,y1,x2,y2,color,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" ${extra}/>`;
 const text=(x,y,s,extra='')=>`<text x="${x}" y="${y}" ${extra}>${s}</text>`;
 const y=l=>292-l*(216/count);
 const x=i=>100+i*76;
 function render(){
  const cycle=Math.floor(step/perCycle),phase=step%perCycle,active=cycle+lastInitial;
  const layer=phase===0?0:Math.min(count,Math.ceil(phase/2));
  const attending=phase<count*2+1&&phase%2===1;
  const completed=phase<count*2+1?Math.floor(phase/2):count;
  const ready=phase>=count*2+1,selected=phase===count*2+2;
  root.dataset.step=step;root.dataset.layer=completed?layers[completed-1]:0;
  let net='';
  for(let l=0;l<=count;l++)net+=text(10,y(l)+4,label(l));
  if(gap)net+=text(35,(y(count)+y(count-1))/2,'…','text-anchor="middle"');
  for(let i=0;i<=active;i++){
   const fixed=i<active;
   net+=text(x(i),40,fixed?'KEEP':'計算中',`text-anchor="middle" style="fill:${fixed?blue:orange};font-size:10px;letter-spacing:1px"`);
   for(let l=1;l<=count;l++)net+=line(x(i),y(l-1)-12,x(i),y(l)+12,fixed?blue:l<=completed?orange:muted);
   for(let l=0;l<=count;l++){
    const color=fixed?blue:l<=completed?orange:muted;
    const fill=fixed?'#e1edf5':l<=completed?'#fcdfc4':'#f6f8fa';
    net+=l===count?`<rect data-node="${i}-${l}" x="${x(i)-11}" y="${y(l)-11}" width="22" height="22" rx="3" fill="${fill}" stroke="${color}" stroke-width="2"/>`:`<circle data-node="${i}-${l}" cx="${x(i)}" cy="${y(l)}" r="10" fill="${fill}" stroke="${color}" stroke-width="2"/>`;
   }
   net+=text(x(i),328,esc(words[i]),'text-anchor="middle" class="dc-word"');
  }
  if(attending){
   for(let i=0;i<active;i++)net+=`<path class="dc-flow" d="M ${x(i)+12} ${y(layer-1)} Q ${x(active)-25} ${y(layer-1)-10} ${x(active)-12} ${y(layer)+10}" fill="none" stroke="${blue}" stroke-width="2"/><rect x="${x(i)-17}" class="dc-kv-label" y="${y(layer-1)-35}" width="34" height="17" rx="4" fill="#e1edf5"/>`+text(x(i),y(layer-1)-23,'K・V','text-anchor="middle" style="font-size:9px"');
   net+=text(x(active)+17,y(layer-1)-17,'Q','style="fill:#c36a28;font-size:10px"');
  }
  net+=text(230,359,attending?'過去のK・V ＋ 現在のK・Vを参照':'過去の列はそのまま。現在の列だけ更新。','text-anchor="middle" style="font-size:11px"');
  $('.dc-network').setAttribute('viewBox',`0 0 ${Math.max(460,x(allTokens.length-1)+65)} 370`);
  $('.dc-network').innerHTML=net;
  const pts=tokenPaths[active];
  let space='';
  for(let k=0;k<6;k++)space+=line(45,65+k*45,355,65+k*45,'#e7edf1')+line(55+k*58,55,55+k*58,300,'#e7edf1');
  for(let i=0;i<active;i++){
   const past=tokenPaths[i];
   space+=`<g data-space-token="${esc(words[i])}"><polyline points="${past.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${blue}" stroke-width="1.5" opacity=".45"/>`;
   for(let l=0;l<=count;l++)space+=`<circle data-space-node="${i}-${l}" cx="${past[l][0]}" cy="${past[l][1]}" r="${l===completed?6:3.5}" fill="${blue}" opacity="${l===completed?1:.5}"/>`;
   space+=text(past[count][0],past[count][1]-15,esc(words[i]),`text-anchor="middle" style="fill:${blue};font-weight:600"`)+'</g>';
  }
  space+=`<polyline points="${pts.slice(0,completed+1).map(p=>p.join(',')).join(' ')}" fill="none" stroke="${orange}" stroke-width="2" opacity=".65"/>`;
  for(let l=0;l<=completed;l++)space+=`<circle cx="${pts[l][0]}" cy="${pts[l][1]}" r="4" fill="${orange}"/>`+text(pts[l][0],pts[l][1]+22,label(l),'text-anchor="middle" style="font-size:10px"');
  // Keep the moving SVG node alive so changes of layer animate continuously.
  let dot=$('.dc-dot');
  if(!$('.dc-space-scene'))$('.dc-space').innerHTML='<g class="dc-space-scene"></g>';
  $('.dc-space-scene').innerHTML=space+text(pts[completed][0],pts[completed][1]-16,esc(words[active]),`text-anchor="middle" style="fill:${orange};font-weight:600"`)+text(200,344,'青：過去の表現　オレンジ：現在の表現','text-anchor="middle" style="font-size:11px"');
  if(!dot){dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('class','dc-dot');dot.setAttribute('r','9');dot.setAttribute('fill',orange);dot.setAttribute('stroke','white');dot.setAttribute('stroke-width','3');}
  if(!dot.parentNode)$('.dc-space').append(dot);
  if(phase===0){dot.style.transition='none';}
  dot.setAttribute('cx',pts[completed][0]);dot.setAttribute('cy',pts[completed][1]);
  if(phase===0){dot.getBoundingClientRect();dot.style.transition='';}
  $('.dc-space-token').textContent=`${words[active]} の表現`;
  $('.dc-step').textContent=ready?'OUTPUT':phase===0?'INPUT':`LAYER ${layers[layer-1]}`;
  $('.dc-title').textContent=phase===0?`${words[active]} の埋め込みからスタート`:attending?`第${layers[layer-1]}層：文脈を受け取る`:phase<count*2+1?`第${layers[layer-1]}層：表現が更新された`:selected?`${candidates[cycle][0][0]} を選んで、次の入力へ`:'最上段の表現から、候補の確率へ';
  $('.dc-description').textContent=gap&&layer===count?'第2層の後の中間層の計算を省略して、最終層を表示しています。':'過去のK・Vを保存し、現在のトークンの表現を計算します。';
  const frame=frames[cycle],chosen=frame.candidates[frame.selectedIndex];
  if(selected)$('.dc-title').textContent=`${chosen.text} を選んで、次の入力へ`;
  $('.dc-output-note').textContent=selected?frame.tokens.map(t=>t.text).join('')+chosen.text:ready?`${words[active]} の位置から続きを予測`:'最上段まで計算すると候補が現れます。';
  $('.dc-bars').innerHTML=candidates[cycle].map(([word,p],i)=>`<div class="dc-bar ${selected&&i===frame.selectedIndex?'chosen':''}"><span>${ready?esc(word):'—'}</span><div class="dc-track"><div class="dc-fill" style="width:${ready?p*100:0}%"></div></div><span>${ready?percent(p):'—'}</span></div>`).join('');
  $('[data-dc-back]').disabled=step===0;
  $('[data-dc-next]').disabled=step===total-1;
  $('.dc-count').textContent=`${step+1} / ${total}`;
 }
 function next(){if(step<total-1)step++;render();}
 $('[data-dc-next]').addEventListener('click',()=>{next();});
 $('[data-dc-back]').addEventListener('click',()=>{step=Math.max(0,step-1);render();});
 $('[data-dc-reset]').addEventListener('click',()=>{step=0;render();});
 $('figcaption').textContent=note()+` 埋め込み → ${layers.map(l=>'第'+l+'層').join(' → ')}。`+(gap?'第2層と最終層の間の計算は省略しています。':'');
 render();
})();
