import fs from 'node:fs/promises';
import {validateData} from './validate-data.mjs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFile(root+p,'utf8');
const write=(p,s)=>fs.writeFile(root+p,s);
const items=JSON.parse(await read('components.json'));
// Local snapshots of the original page's styles, in the original cascade order.
const base=(await Promise.all(['style.css','content.css','learning-demos.css'].map(n=>read('shared/'+n)))).join('\n');
const page=(title,body,css='',js='')=>`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${base}\n${css}\n/* Only the surrounding page is sized for standalone viewing. */
main.article{margin:auto;padding:24px;max-width:948px}
@media(max-width:520px){main.article{padding:16px}}
</style></head><body data-page="llm"><main class="article">${body}</main>${js?`<script>${js.replaceAll('</script','<\\/script')}</script>`:''}</body></html>\n`;
const dataSource=await read('components/gpt-representations-not/template.html');
const dataBlock=dataSource.match(/<!-- BEGIN EDITABLE DIAGRAM DATA[\s\S]*?<\/script>/)?.[0];
if(!dataBlock)throw new Error('Missing editable data block');
await validateData(JSON.parse(dataBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]));
const runtime=await read('shared/diagram-data.js');
await fs.mkdir(root+'dist',{recursive:true});
for(const {id,title} of items){
 const prefix=`components/${id}/`;
 await write(`dist/${id}.html`,page(title,dataBlock+'\n'+(await read(prefix+'template.html')).replace(dataBlock,''),await read(prefix+'style.css'),runtime+'\n'+await read(prefix+'behavior.js')));
 // Remove the obsolete Web Component build, without touching unrelated files.
 await fs.rm(root+`dist/${id}.js`,{force:true});
}
const list=animated=>items.filter(item=>item.animated===animated).map(({id,title})=>`<li><a href="dist/${id}.html">${title}</a> — <a href="dist/${id}.html" download>HTMLを保存</a></li>`).join('');
await write('index.html',page('GPTのアニメーション',`<h1>GPTのアニメーション</h1><p>元の教材から切り出したアニメーションです。リンク先のHTMLを1つ渡すだけで、オフラインで開いて操作できます。</p><h2>動かせるアニメーション</h2><ul>${list(true)}</ul><h2>元ページの静止図</h2><ul>${list(false)}</ul>`));
console.log(`Built ${items.length} standalone HTML files.`);
