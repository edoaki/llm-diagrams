function mount(root) {
 const $ = q => root.querySelector(q);
 const $$ = q => Array.from(root.querySelectorAll(q));
 const d = $('[data-transformer-layers]');
    const {states,stages}=JSON.parse(d.dataset.transformerLayers);
    const tokens=$$('.tf-token',d),steps=$$('[data-layer]',d);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let timers=[],current=0;
    const later=(fn,delay)=>timers.push(setTimeout(fn,delay));
    const place=points=>tokens.forEach((token,i)=>{const [x,y]=points[i];token.style.transform=`translate(${x}px,${y}px)`;});
    const show=stage=>{
      if (!Number.isInteger(stage) || stage < 0 || stage >= states.length) return;
      const previous=current;current=stage;timers.forEach(clearTimeout);timers=[];
      d.classList.remove('tf-numeric','tf-output-morph','tf-output-ready','tf-output-moving');
      d.classList.toggle('tf-sentence',stage===0);
      d.classList.toggle('tf-final-layer',stage===5);
      steps.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===stage)));
      $('.tf-counter',d).textContent=stage===0?'SENTENCE':stage===1?'EMBEDDING':stage===5?'LAYER N':stage===6?'NEXT TOKEN':`LAYER ${stage-1}`;
      $('.tf-stage-title',d).textContent=stages[stage][0];
      $('.tf-stage-description',d).textContent=stages[stage][1];
      $('.tf-space svg',d).setAttribute('aria-label',`${stages[stage][0]}：${stages[stage][1]}`);
      if(stage===1&&!reduced.matches){
        // First replace words with numerical vectors; only then form spatial dots.
        place(states[0]);d.classList.add('tf-numeric');
        later(()=>{d.classList.remove('tf-numeric');place(states[1]);},1400);
      }else if(stage===6){
        // Preserve the final token element: its dot expands into the output vector.
        if(previous!==5)place(states[5]);
        d.classList.add('tf-output-moving');
        const morph=()=>{d.classList.add('tf-output-morph');tokens[tokens.length-1].style.transform='translate(260px,60px)';};
        if(reduced.matches){morph();d.classList.add('tf-output-ready');}
        else {later(morph,previous===5?60:1000);later(()=>d.classList.add('tf-output-ready'),previous===5?1200:2200);}
      }else place(states[stage]);
      root.host.dispatchEvent(new CustomEvent('stagechange', {detail:{stage, title:stages[stage][0]}, bubbles:true, composed:true}));
    };
    steps.forEach(button=>button.addEventListener('click',()=>show(Number(button.dataset.layer))));
    const onMotionChange=()=>show(current);
    reduced.addEventListener('change',onMotionChange);
    $('.tf-live',d).hidden=false;d.classList.add('tf-enhanced');show(0);

 const cleanup = () => { timers.forEach(clearTimeout); reduced.removeEventListener('change',onMotionChange); };
 cleanup.setStage = show;
 return cleanup;
}
