import fs from 'node:fs/promises';
import {validateData} from './validate-data.mjs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFile(root+p,'utf8');
const write=(p,s)=>fs.writeFile(root+p,s);
const items=JSON.parse(await read('components.json'));
// Local snapshots of the original page's styles, in the original cascade order.
const base=(await Promise.all(['style.css','content.css','learning-demos.css'].map(n=>read('shared/'+n)))).join('\n');
const page=(title,body,css='',js='',width=948)=>`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${base}\n${css}\n/* Only the surrounding page is sized for standalone viewing. */
main.article{margin:auto;padding:24px;max-width:${width}px}
@media(max-width:520px){main.article{padding:16px}}
</style></head><body data-page="llm"><main class="article">${body}</main>${js?`<script>${js.replaceAll('</script','<\\/script')}</script>`:''}</body></html>\n`;
const dataSource=await read('components/gpt-representations-not/template.html');
const dataBlock=dataSource.match(/<!-- BEGIN EDITABLE DIAGRAM DATA[\s\S]*?<\/script>/)?.[0];
if(!dataBlock)throw new Error('Missing editable data block');
await validateData(JSON.parse(dataBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]));
const runtime=await read('shared/diagram-data.js');
await fs.mkdir(root+'dist',{recursive:true});
// "uses" embeds other components' style and behavior first, so one diagram can be reused inside another.
const sources=(ids,file)=>Promise.all(ids.map(u=>read(`components/${u}/${file}`))).then(v=>v.join('\n'));
for(const {id,title,width,uses=[]} of items){
 const own=[...uses,id];
 await write(`dist/${id}.html`,page(title,dataBlock+'\n'+(await read(`components/${id}/template.html`)).replace(dataBlock,''),await sources(own,'style.css'),runtime+'\n'+await sources(own,'behavior.js'),width));
 // Remove the obsolete Web Component build, without touching unrelated files.
 await fs.rm(root+`dist/${id}.js`,{force:true});
}
const list=entries=>entries.map(({id,title})=>`<li><a href="dist/${id}.html">${title}</a> — <a href="dist/${id}.html" download>HTMLを保存</a></li>`).join('');
await write('index.html',page('GPTのアニメーション',`<h1>GPTのアニメーション</h1><p>元の教材から切り出したアニメーションです。リンク先のHTMLを1つ渡すだけで、オフラインで開いて操作できます。</p><h2>文章から、文脈を含む表現へ</h2><p>文章 → 埋め込み → 各層の表現 → 次トークンの確率をたどる図です。通常版は not なしの文章で流れを確認できます。not比較版は同じ図に選択機能を加え、not の有無による表現と次トークンの確率の違いを見比べられます。</p><ul>${list(items.filter(({id})=>id.startsWith('gpt-representations')))}</ul><h2>その他のアニメーション</h2><ul>${list(items.filter(({id})=>!id.startsWith('gpt-representations')))}</ul>`));
console.log(`Built ${items.length} standalone HTML files.`);
