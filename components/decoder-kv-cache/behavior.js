'use strict';
// Decoder diagram, mounted on every [data-decoder]: words below, layers stacked above, and the representation space.
// data-cycles="last" computes only the last word; data-case-select adds buttons for the input sentences.
// Other diagrams embed it through "uses" in components.json, so this file is the one implementation.
(() => {
 const {data,layers,format,percent,esc}=window.Diagram;
 const NS='http://www.w3.org/2000/svg',N=data.model.numLayers;
 const blue='#4c7da5',orange='#c36a28';
 const illustrative=data.model.projection.status!=='measured';
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const r1=v=>Math.round(v*10)/10;
 const text=(x,y,s,extra='')=>`<text x="${r1(x)}" y="${r1(y)}" ${extra}>${s}</text>`;
 // Axis-break mark (two parallel waves) = layers left out of the drawing.
 const breakMark=(cx,cy,len,thick,amp,period,bg)=>{
  const wave=off=>{const pts=[];for(let t=-len/2;t<=len/2+.01;t+=Math.min(2,len/8))pts.push([r1(t),r1(off+amp*Math.sin(2*Math.PI*t/period))]);return pts;};
  const a=wave(-thick/2),b=wave(thick/2),line=pts=>'M'+pts.map(p=>p.join(' ')).join(' L');
  return `<g class="dc-break" transform="translate(${r1(cx)} ${r1(cy)})"><path d="${line(a)} L${b.reverse().map(p=>p.join(' ')).join(' L')} Z" fill="${bg}"/><path d="${line(a)}" fill="none" stroke="#7d8f99" stroke-width="1.2"/><path d="${line(b.reverse())}" fill="none" stroke="#7d8f99" stroke-width="1.2"/></g>`;
 };
 let mounted=0;

 function mount(root){
  const select=root.hasAttribute('data-case-select'),onlyLast=root.dataset.cycles==='last',uid='dc'+ ++mounted;
  const cases=select?data.cases:[data.cases[0]];
  // Show three layers on each side of the break; measured data needs points for added rows.
  const extraRows=[3,N-2,N-1].filter(L=>L>0&&L<=N&&(illustrative||cases.every(c=>c.tokens.every(t=>t.points[String(L)]))));
  const rows=[...new Set([...layers,...extraRows])].sort((a,b)=>a-b);
  const count=rows.length,full=[0,...rows];
  // Row index k whose distance from the row below skips layers (the axis break), or -1.
  const gapK=full.findIndex((v,k)=>k>0&&v>full[k-1]+1);
  // When layers are skipped, the top rows are named by position from the end rather than by number.
  const layerName=L=>!L?'埋め込み':gapK>0&&L===N?'第N層':gapK>0&&L===N-1?'第N−1層':gapK>0&&L===N-2?'第N−2層':`第${L}層`;
  const label=k=>layerName(full[k]);
  // Phases in a cycle: embedding, each drawn layer, the output layer, then (all cycles) the choice.
  const OUTPUT=count+1,PICK=count+2,perCycle=count+(onlyLast?2:3);

  root.insertAdjacentHTML('beforeend',`<div class="dc-toolbar">${select?`<div class="dc-cases" role="group" aria-label="入力する文">${cases.map((c,i)=>`<button type="button" data-dc-case="${i}">${esc(c.label)}</button>`).join('')}</div>`:''}<div class="dc-controls" role="group" aria-label="アニメーションの操作"><button type="button" data-dc-back aria-label="1ステップ戻る">戻る</button><button type="button" data-dc-next>進む</button><span class="dc-step" aria-live="polite"></span><span class="dc-count"></span><button type="button" data-dc-reset aria-label="最初から" title="最初から"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>
<div class="dc-legend"><span><i class="dc-orange"></i>計算中のトークン</span><span><i class="dc-blue"></i>計算済みのトークン（K・Vを保存）</span><span><i class="dc-unused"></i>この段階では使わない表現</span></div>
<div class="dc-panels"><section><div class="dc-panel-title"><h2>01　計算の経路</h2></div><svg class="dc-network" role="img"></svg></section><section class="dc-right"><div class="dc-panel-title"><h2 class="dc-right-title"></h2></div><div class="dc-right-body"><svg class="dc-space" viewBox="0 0 360 340" role="img" aria-label="層ごとの表現の変化"></svg><div class="dc-probs" role="list" aria-label="次のトークンの確率"></div></div></section></div>`);
  const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];

  // ---- 01 network geometry: fixed across cases so switching sentences does not rescale the drawing.
  const ROW=36,GAP=56,LEFT=76,bg='#f6f8fa';
  const ys=[];ys[count]=34;
  for(let k=count;k>0;k--)ys[k-1]=ys[k]+(k===gapK?GAP:ROW);
  const y=k=>ys[k],wordY=y(0)+34,H=wordY+12,midY=(y(0)+y(count))/2;
  const slotsOf=c=>c.tokens.length+(onlyLast?0:1);
  const W=Math.max(360,LEFT+(Math.max(...cases.map(slotsOf))-1)*54+30);
  // Half the node's size including its stroke: lines stop here instead of running through the node.
  const edge=k=>k===count?12:10;
  const CARD=[150,72],BOX=[84,52],cardLeft=12+CARD[0]/2,boxX=W-12-BOX[0]/2,arrow=[12+CARD[0]+8,W-12-BOX[0]-12];
  const network=$('.dc-network');
  network.setAttribute('viewBox',`0 0 ${W} ${H}`);
  network.innerHTML=`<defs><filter id="${uid}-shadow" x="-10%" y="-15%" width="120%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#27404f" flood-opacity=".16"/></filter></defs><g class="dc-net"><g class="dc-edges"></g><g class="dc-links"></g>${gapK>0?breakMark(W/2,(y(gapK)+y(gapK-1))/2,W-12,10,3,22,bg):''}<g class="dc-nodes"></g><g class="dc-labels"></g></g><g class="dc-words"></g>
<g class="dc-output"><g class="dc-out-arrow"><line x1="${arrow[0]}" y1="${midY}" x2="${arrow[1]}" y2="${midY}"/><path d="M${arrow[1]} ${midY-6} L${arrow[1]+9} ${midY} L${arrow[1]} ${midY+6}Z"/></g><g transform="translate(${boxX} ${midY})"><g class="dc-out-layer"><rect x="${-BOX[0]/2}" y="${-BOX[1]/2}" width="${BOX[0]}" height="${BOX[1]}" rx="10"/>${text(0,5,'出力層','text-anchor="middle"')}</g></g>
<g class="dc-card"><rect x="${-CARD[0]/2}" y="${-CARD[1]/2}" width="${CARD[0]}" height="${CARD[1]}" rx="10" filter="url(#${uid}-shadow)"/>${text(0,-12,'','text-anchor="middle" class="dc-card-word"')}${text(0,5,`${label(count)}の表現`,'text-anchor="middle" class="dc-card-caption"')}<g class="dc-card-vector"></g></g></g>`;
  const edges=$('.dc-edges'),links=$('.dc-links'),nodesG=$('.dc-nodes'),labelsG=$('.dc-labels'),wordsG=$('.dc-words'),card=$('.dc-card');
  labelsG.innerHTML=full.map((_,k)=>text(8,y(k)+4,label(k),`data-row-label="${k}"`)).join('');

  // ---- 02 space: measured projections are drawn as-is; illustrative ones get a context-dependent teaching layout.
  const SW=360,SH=340;
  const toSpace=([u,v])=>[28+u*(SW-56),22+v*(SH-50)];
  const spaceOf=c=>{
   if(!illustrative)return c.tokens.map(t=>Array.from({length:N+1},(_,L)=>t.points[String(L)]?toSpace(t.points[String(L)]):null));
   // Each token gets its own steps from a generator seeded by its text and position, so the layout is stable across reloads.
   const rng=seed=>{let h=2166136261;for(const ch of seed)h=Math.imul(h^ch.charCodeAt(0),16777619);return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};};
   const clamp=p=>p.map(v=>Math.min(.92,Math.max(.08,v)));
   const move=(p,r,len)=>{const a=r()*2*Math.PI;return clamp([p[0]+len*Math.cos(a),p[1]+len*Math.sin(a)]);};
   const occupied=[];
   return c.tokens.map((t,i)=>{
    const r=rng(t.text+'#'+i),path=[clamp(t.points[0])];
    // Before the break (or on every row when nothing is skipped): small steps whose size and direction differ per token.
    const last=gapK<0?count:gapK-1;
    for(let k=1;k<=last;k++)path.push(move(path.at(-1),r,.04+.1*r()));
    if(gapK<0)return path.map(toSpace);
    // Sample irregular local paths, retaining space between whole paths (not just their endpoints).
    let latePath,best=-1;
    for(let attempt=0;attempt<600;attempt++){
     const candidate=[[.12+.76*r(),.12+.76*r()]],angle=r()*Math.PI*2,turn=r()<.5?-1:1;
     const bend=.65+.35*r(),angles=[angle,angle+turn*bend,angle+turn*(bend-(.55+.45*r()))];
     for(let j=1;j<4;j++){
      const a=angles[j-1],len=.04+.025*r(),p=candidate.at(-1);
      candidate.push([p[0]+len*Math.cos(a),p[1]+len*Math.sin(a)]);
     }
     if(candidate.some(p=>p.some(v=>v<.09||v>.91)))continue;
     const clearance=occupied.length?Math.min(...candidate.flatMap(p=>occupied.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1])))):1;
     if(clearance>best){best=clearance;latePath=candidate;}
     if(clearance>.21)break;
    }
    occupied.push(...latePath);
    const tail=latePath.slice(0,count-gapK+1).reverse();
    // Omitted rows still have their own local steps beyond the last early row.
    for(let L=full[last]+1;L<full[gapK];L++)path.push(move(path.at(-1),r,.04+.1*r()));
    // The virtual predecessor of N−2 forms a short local history near the final cluster.
    for(let L=full[gapK]-1;L>=Math.max(full[last]+1,N-3);L--)path[L]=latePath[N-L];
    path.push(...tail);
    return path.map(toSpace);
   });
  };
  const space=$('.dc-space');
  let grid='';
  for(let k=0;k<=6;k++)grid+=`<line x1="${28+k*(SW-56)/6}" y1="14" x2="${28+k*(SW-56)/6}" y2="${SH-20}" stroke="#e7edf1"/><line x1="20" y1="${22+k*(SH-50)/6}" x2="${SW-20}" y2="${22+k*(SH-50)/6}" stroke="#e7edf1"/>`;
  space.innerHTML=`<g>${grid}</g><g class="dc-cached-trails"></g><g class="dc-trails"></g><g class="dc-cached"></g><g class="dc-heads"></g><text class="dc-space-layer" x="${SW-24}" y="${SH-30}" text-anchor="end"></text>`;
  const heads=$('.dc-heads'),probs=$('.dc-probs');

  // ---- per-case state
  let ci=0,c,n,x,words,cycles,spacePts,total,step=0,sub=2,timers=[],builtFor='',spaceCycle=-1;
  function build(){
   c=cases[ci];n=c.tokens.length;
   const col=(W-30-LEFT)/Math.max(1,slotsOf(c)-1);x=i=>LEFT+i*col;
   words=[...c.tokens.map(t=>t.text),c.candidates[c.selectedIndex].text];
   // Earlier prompt tokens start out computed (their K・V are cached); from the earliest position whose prediction is recorded, one token at a time.
   let start=n-1;
   if(!onlyLast)while(start>0&&c.tokens[start-1].candidates)start--;
   cycles=[];
   for(let t=start;t<n;t++){const cs=t<n-1?c.tokens[t].candidates:c.candidates;cycles.push({t,cs,chosen:t<n-1?cs.findIndex(v=>v.text===c.tokens[t+1].text):c.selectedIndex});}
   total=cycles.length*perCycle;
   spacePts=spaceOf(c);
   let e='',nd='';
   for(let i=0;i<n;i++)for(let k=0;k<=count;k++){
    if(k)e+=`<line class="dc-edge" data-edge="${i}-${k}" x1="${r1(x(i))}" y1="${r1(y(k-1)-edge(k-1))}" x2="${r1(x(i))}" y2="${r1(y(k)+edge(k))}"/>`;
    nd+=k===count?`<rect class="dc-node" data-node="${i}-${k}" x="${r1(x(i)-11)}" y="${y(k)-11}" width="22" height="22" rx="3"/>`:`<circle class="dc-node" data-node="${i}-${k}" cx="${r1(x(i))}" cy="${y(k)}" r="9"/>`;
   }
   edges.innerHTML=e;nodesG.innerHTML=nd;
   wordsG.innerHTML=words.slice(0,onlyLast?n:n+1).map((w,i)=>text(x(i),wordY,esc(w),`text-anchor="middle" class="dc-word" data-word="${i}"`)).join('');
   heads.replaceChildren();$('.dc-cached').replaceChildren();builtFor='';spaceCycle=-1;
   $$('[data-dc-case]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.dcCase===ci)));
  }

  // Only the current token moves. Cached representations stay fixed; preview their path two steps ahead of the highlighted layer.
  function renderSpace(cur,lay,cachedLay,glide){
   const color=i=>i<cur.t?blue:orange,at=(i,k)=>spacePts[i][full[k]],actual=(i,L)=>spacePts[i][L];
   const highlightedLayer=cachedLay;
   const late=gapK>0&&full[lay]>=full[gapK];
   const previewFrom=late?Math.max(0,N-3):0;
   const previewTo=late?N:Math.min(N,(cachedLay>=0?cachedLay:full[lay])+2);
   let cachedTrails='';
   for(let i=0;i<cur.t;i++)for(let k=previewFrom+1;k<=previewTo;k++){
    if(!actual(i,k-1)||!actual(i,k))continue;
    const [ax,ay]=actual(i,k-1),[bx,by]=actual(i,k);
    cachedTrails+=`<line data-cached-edge="${i}-${k}" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}"/>`;
   }
   $('.dc-cached-trails').innerHTML=cachedTrails;
   let trails='';
   {const i=cur.t;
    // The current token keeps a local history too; late layers replace the embedding-era trail.
    const from=previewFrom,to=full[lay];
    trails+=`<g data-space-token="${i}">`;
    for(let L=from+1;L<=to;L++){
     if(!actual(i,L-1)||!actual(i,L))continue;
     const [ax,ay]=actual(i,L-1),[bx,by]=actual(i,L);
     trails+=`<line data-trail-layer="${L}" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}" stroke="${color(i)}" stroke-width="1.5" opacity=".55"/>`;
    }
    for(let L=from;L<to;L++){
     if(!actual(i,L))continue;
     const [px,py]=actual(i,L);
     trails+=`<circle data-trail-layer="${L}" cx="${r1(px)}" cy="${r1(py)}" r="3" fill="${color(i)}" opacity=".45"/>`;
    }
    trails+='</g>';
   }
   $('.dc-trails').innerHTML=trails;
   $('.dc-space-layer').textContent=label(lay);
   // Points may overlap; only the labels are placed around their dots to stay readable.
   const boxes=[],dots=[];
   for(let i=0;i<=cur.t;i++)for(let L=previewFrom;L<=(i<cur.t?previewTo:full[lay]);L++)if(actual(i,L))dots.push(actual(i,L));
   const place=(i,[hx,hy])=>{
    const w=words[i].trim().length*7.6+6;
    const options=[[0,-11,'middle',hx-w/2,hy-24],[0,21,'middle',hx-w/2,hy+8],[10,5,'start',hx+8,hy-8],[-10,5,'end',hx-8-w,hy-8]];
    const free=o=>!boxes.some(b=>o[3]<b[0]+b[2]&&b[0]<o[3]+w&&o[4]<b[1]+15&&b[1]<o[4]+15)&&!dots.some(([dx,dy])=>(dx!==hx||dy!==hy)&&dx>o[3]-5&&dx<o[3]+w+5&&dy>o[4]-5&&dy<o[4]+20);
    const o=options.find(free)||options[0];boxes.push([o[3],o[4],w]);return o;
   };
   const cached=$('.dc-cached');
   for(let i=0;i<cur.t;i++)for(let k=0;k<=N;k++){
    if(!actual(i,k))continue;
    let h=cached.querySelector(`[data-cached="${i}-${k}"]`);
    const [hx,hy]=actual(i,k);
    if(!h){
     h=document.createElementNS(NS,'g');h.setAttribute('class','dc-cached-point');h.dataset.cached=`${i}-${k}`;
     h.dataset.k=k;h.style.transform=`translate(${r1(hx)}px,${r1(hy)}px)`;
     h.innerHTML=`<circle r="5" fill="${blue}" stroke="#fff" stroke-width="1.5"/>${text(0,-11,esc(words[i]),'text-anchor="middle" style="font-weight:600"')}`;
     cached.append(h);
    }
    h.classList.toggle('is-preview-hidden',k<previewFrom||k>previewTo);
    h.classList.toggle('is-highlighted',k===highlightedLayer);
    h.classList.toggle('is-past',k<(highlightedLayer<0?N+1:highlightedLayer));
    h.querySelector('circle').setAttribute('r',k===highlightedLayer?6:3);
    if(k===highlightedLayer){const tx=h.querySelector('text'),o=place(i,[hx,hy]);tx.style.fill=blue;tx.setAttribute('x',o[0]);tx.setAttribute('y',o[1]);tx.setAttribute('text-anchor',o[2]);}
   }
   [...cached.children].forEach(h=>{if(+h.dataset.cached.split('-')[0]>=cur.t)h.remove();});
   [...heads.children].forEach(h=>{if(+h.dataset.head!==cur.t)h.remove();});
   {const i=cur.t;
    let h=heads.querySelector(`[data-head="${i}"]`);
    const [hx,hy]=at(i,lay);
    if(!h){
     h=document.createElementNS(NS,'g');h.setAttribute('class','dc-head');h.dataset.head=i;
     h.innerHTML=`<circle class="dc-ring" r="12" fill="none" stroke-width="2"/><circle class="dc-dot" r="6" stroke="#fff" stroke-width="2"/>${text(0,-11,esc(words[i]),'text-anchor="middle" style="font-weight:600"')}`;
     heads.append(h);
     if(!motion.matches)h.animate([{opacity:0},{opacity:1}],{duration:400});
    }else if(!glide)h.getAnimations().forEach(a=>a.cancel());
    else if(+h.dataset.k!==lay&&!motion.matches){
     const k0=+h.dataset.k,warp=gapK>0&&Math.min(k0,lay)<gapK&&Math.max(k0,lay)>=gapK;
     h.getAnimations().forEach(a=>a.cancel());
     const [from,to]=[at(i,k0),at(i,lay)].map(([px,py])=>`translate(${r1(px)}px,${r1(py)}px)`);
     // Across omitted layers, show the destination immediately.
     if(!warp)h.animate([{transform:from},{transform:to}],{duration:650,easing:'ease-in-out'});
    }
    h.dataset.k=lay;h.style.transform=`translate(${r1(hx)}px,${r1(hy)}px)`;
    h.querySelector('.dc-dot').setAttribute('fill',color(i));
    const tx=h.querySelector('text'),o=place(i,[hx,hy]);
    tx.style.fill=color(i);tx.setAttribute('x',o[0]);tx.setAttribute('y',o[1]);tx.setAttribute('text-anchor',o[2]);
    h.querySelector('.dc-ring').setAttribute('stroke',i===cur.t?orange:'none');
   }
  }

  // Restart a one-shot CSS animation on an element.
  const replay=(el,cls)=>{if(!el)return;el.classList.remove(cls);el.getBoundingClientRect();el.classList.add(cls);};
  function render(effect){
   const cycle=Math.floor(step/perCycle),phase=step%perCycle,cur=cycles[cycle],t=cur.t;
   const done=Math.min(phase,count),layerPhase=phase>=1&&phase<=count,output=phase>=OUTPUT,picked=phase===PICK;
   // The row after the axis break is reached through the omitted layers, so no information is drawn flowing into it.
   const flows=layerPhase&&done!==gapK;
   const ready=picked||output&&sub===2;
   const cachedLayer=layerPhase?full[done]-1:phase===0?0:-1;
   root.dataset.step=step;root.dataset.layer=full[done];root.dataset.sub=sub;
   root.classList.toggle('is-output',output&&!picked);root.classList.toggle('is-ready',ready);root.classList.toggle('is-picked',picked);
   root.classList.toggle('is-reading',layerPhase&&sub>=1);
   const shown=(i,k)=>i<t||i===t&&k<=done;
   // Circles used in this step stay saturated: the new node and, while a layer is computed, every node it reads from the row below.
   $$('.dc-node').forEach(el=>{
    const [i,k]=el.dataset.node.split('-').map(Number),target=i===t&&k===done;
    el.dataset.state=i<t?'cached':'active';
    el.classList.toggle('is-hidden',!shown(i,k));
    el.classList.toggle('is-target',target);
    el.classList.toggle('is-past',i<t?full[k]<(cachedLayer<0?N+1:cachedLayer):k<done);
    el.classList.toggle('is-source',flows&&k===done-1&&i<=t);
    el.classList.toggle('is-highlighted',i<t&&full[k]===cachedLayer);
    el.classList.toggle('is-pending',target&&flows&&sub<2);
    if(!target)el.classList.remove('dc-made');
   });
   $$('.dc-edge').forEach(el=>{
    const [i,k]=el.dataset.edge.split('-').map(Number);
    el.dataset.state=i<t?'cached':'active';
    el.classList.toggle('is-hidden',!(shown(i,k)&&shown(i,k-1)));
    el.classList.toggle('is-self',flows&&i===t&&k===done);
   });
   // Information from every earlier word's node in the row below flows into the new node.
   const key=`${ci}:${step}`;
   if(key!==builtFor){
    builtFor=key;
    let l='';
    if(flows)for(let i=0;i<t;i++){
     const sx=x(i),sy=y(done-1)-edge(done-1),ex=x(t),ey=y(done)+edge(done),d=sy-ey;
     l+=`<path class="dc-link" d="M${r1(sx)} ${r1(sy)} C${r1(sx)} ${r1(sy-d*.55)} ${r1(ex)} ${r1(ey+d*.45)} ${r1(ex)} ${r1(ey)}"/>`;
    }
    links.innerHTML=l;
    probs.innerHTML=cur.cs.map((v,r)=>`<div class="dc-prob${v.text==='その他'?' is-other':''}" role="listitem"><span class="dc-prob-word">${esc(v.text.trim()||v.text)}</span><span class="dc-track"><span class="dc-fill"></span></span><b>${percent(v.probability)}</b></div>`).join('');
   }
   $$('[data-row-label]').forEach(el=>el.classList.toggle('dc-row-current',!output&&+el.dataset.rowLabel===done));
   $$('.dc-word').forEach(el=>{
    const i=+el.dataset.word;
    el.classList.toggle('is-hidden',!(i<=t||picked&&i===t+1));
    el.classList.toggle('is-active',i===t);
    el.classList.toggle('is-picked',picked&&i===t+1);
   });
   // The final representation grows out of its node and moves beside the output layer.
   const vector=t===n-1?data.ngram.features[c.key]:c.tokens[t].layers[String(N)];
   // The illustrative card is a fixed-width vector glyph, matching the embedded N-gram card.
   const glyphSize=data.ngram.features[c.key].length;
   const cardVector=data.model.status==='illustrative'&&vector.length!==glyphSize?Array.from({length:glyphSize},(_,j)=>{
    const p=j*(vector.length-1)/Math.max(1,glyphSize-1),a=Math.floor(p),b=Math.ceil(p);
    return (vector[a]*(1-(p-a))+vector[b]*(p-a))/Math.max(1,...vector.map(Math.abs));
   }):vector;
   const [vx,vy]=output?[cardLeft,midY]:[x(t),y(count)];
   card.style.transform=`translate(${r1(vx)}px,${r1(vy)}px) scale(${output?1:.1})`;
   card.querySelector('.dc-card-word').textContent=words[t].trim();
   card.querySelector('.dc-card-vector').innerHTML=cardVector.map((v,j)=>`<rect x="${r1(j*20-cardVector.length*10+2)}" y="14" width="16" height="11" rx="2" opacity="${r1(Math.max(.15,Math.min(1,Math.abs(v))))}"><title>${format(v)}</title></rect>`).join('');
   // Probabilities replace the space once only the final representation remains.
   const best=Math.max(...cur.cs.map(v=>v.probability));
   $('.dc-right').classList.toggle('is-probs',output);
   $('.dc-right-title').textContent=output?'02　次のトークンの確率':'02　表現の空間';
   [...probs.children].forEach((row,r)=>{
    const p=cur.cs[r].probability;
    row.classList.toggle('is-top',ready&&!picked&&p===best);
    row.classList.toggle('is-chosen',picked&&r===cur.chosen);
    row.classList.toggle('is-muted',picked&&r!==cur.chosen);
    row.querySelector('.dc-fill').style.width=`${ready?p*100:0}%`;
   });
   const glide=spaceCycle===cycle&&!root.classList.contains('dc-instant');spaceCycle=cycle;
   renderSpace(cur,flows&&sub<2?done-1:done,cachedLayer,glide);
   network.setAttribute('aria-label',output?`${words[t].trim()}の${label(count)}の表現から、次のトークンの確率を出す`:`${words[t].trim()}の${label(done)}を計算`);
   if(effect==='made')replay($('.dc-node.is-target'),'dc-made');
   if(effect==='enter'&&phase===0)replay($('.dc-node.is-target'),'dc-made');
   if(effect==='enter'&&picked)replay($('.dc-word.is-picked'),'dc-drop');
   const chip=$('.dc-step');
   chip.textContent=picked?'選択':output?'出力':label(done);
   chip.classList.toggle('is-output',output);
   $('[data-dc-back]').disabled=step===0;
   $('[data-dc-next]').disabled=step===total-1;
   $('.dc-count').textContent=`${step+1} / ${total}`;
  }

  const stop=()=>{timers.forEach(clearTimeout);timers=[];};
  // Forward: a layer's new node appears first, information flows into it, then it forms; the output layer lights up once the card arrives.
  function play(to){
   stop();step=to;
   const phase=step%perCycle,flows=phase>=1&&phase<=count&&phase!==gapK;
   if(phase===gapK){sub=2;render('made');return;}
   if(motion.matches||!(flows||phase===OUTPUT)){sub=2;render('enter');return;}
   sub=0;render('enter');
   const at=phase===OUTPUT?[900,1800]:[700,1900];
   timers=[setTimeout(()=>{sub=1;render();},at[0]),setTimeout(()=>{sub=2;render('made');},at[1])];
  }
  // Backward, reset and sentence changes show the finished state without motion.
  function show(to){
   stop();step=to;sub=2;root.classList.add('dc-instant');render();
   root.getBoundingClientRect();root.classList.remove('dc-instant');
  }
  $('[data-dc-next]').addEventListener('click',()=>{if(step<total-1)play(step+1);});
  $('[data-dc-back]').addEventListener('click',()=>show(Math.max(0,step-1)));
  $('[data-dc-reset]').addEventListener('click',()=>show(0));
  $$('[data-dc-case]').forEach(b=>b.addEventListener('click',()=>{if(ci===+b.dataset.dcCase)return;ci=+b.dataset.dcCase;build();show(Math.min(step,total-1));}));
  motion.addEventListener('change',()=>show(step));
  build();show(0);
  // Embedding pages call settle() when the diagram is hidden, so no delayed step fires off-screen.
  return {settle:()=>show(step)};
 }
 document.querySelectorAll('[data-decoder]').forEach(el=>{el.decoderDiagram=mount(el);});
})();
