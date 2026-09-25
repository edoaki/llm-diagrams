import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFile(root+p,'utf8');
const write=(p,s)=>fs.writeFile(root+p,s);
const items=JSON.parse(await read('components.json'));
const base=await read('shared/base.css');
const page=(title,body)=>`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;padding:24px;background:#f6f8f7;color:#243b30;font-family:system-ui,sans-serif}main{max-width:960px;margin:auto}h1{font-size:24px}p{line-height:1.8}a{color:#35664d}section{margin:32px 0}@media(max-width:600px){body{padding:12px}}</style><main>${body}</main></html>`;
await fs.mkdir(root+'dist',{recursive:true});
let sections='';
for(const {id,title} of items){
 const prefix=`components/${id}/`;
 const html=await read(prefix+'template.html');
 const css=base+await read(prefix+'style.css');
 const markup=`<style>${css}</style>${html}`;
 const behavior=await read(prefix+'behavior.js');
 const tag=`llm-${id}`;
 const code=`(() => {\n${behavior}\nconst template=${JSON.stringify(markup)};\nif (!customElements.get('${tag}')) customElements.define('${tag}',class extends HTMLElement {\n static observedAttributes=['stage'];\n attributeChangedCallback(name,oldValue,value){ if(value!==null)this.cleanup?.setStage?.(Number(value)); }\n connectedCallback(){ if(this.cleanup)return; const root=this.shadowRoot || this.attachShadow({mode:'open'}); root.innerHTML=template; this.cleanup=mount(root); if(this.hasAttribute('stage'))this.cleanup.setStage?.(Number(this.getAttribute('stage'))); }\n disconnectedCallback(){ this.cleanup?.(); this.cleanup=null; }\n});\n})();\n`;
 await write(`dist/${id}.js`,code);
 const figure=`<${tag}><template shadowrootmode="open">${markup}</template></${tag}>`;
 await write(`dist/${id}.html`,page(title,`<h1>${title}</h1>${figure}<script>${code.replaceAll('</script','<\\/script')}</script>`));
 sections+=`<section><h2>${title}</h2><p><a href="dist/${id}.html">この図だけを開く・送る</a></p>${figure}<script src="dist/${id}.js"></script></section>`;
}
await write('index.html',page('LLMの図コンポーネント',`<h1>LLMの図コンポーネント</h1><p>各図は単独のHTMLで閲覧でき、Web Componentとして別ページにも埋め込めます。数値・座標は説明用です。</p>${sections}<section><h2>追加予定（未実装）</h2><ul><li>KVキャッシュを含めたデコーダーの動作</li><li>n-gramとLLMの次トークン予測</li></ul></section>`));
console.log(`Built ${items.length} independent diagrams.`);
