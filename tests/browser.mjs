import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const items=JSON.parse(await fs.readFile(root+'components.json','utf8'));
await fs.mkdir(root+'test-results',{recursive:true});
const browser=await chromium.launch();
const errors=[];
try {
 for(const width of [960,390,320]) {
  const context=await browser.newContext({viewport:{width,height:1100},offline:true,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const {id} of items) {
   await page.goto(pathToFileURL(root+`dist/${id}.html`).href);
   assert.equal(await page.locator('figure').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${id} overflow at ${width}`);
   if(id==='gpt-representations') {
    for(let stage=0;stage<7;stage++) {
     await page.locator(`[data-layer="${stage}"]`).click();
     assert.equal(await page.locator(`[data-layer="${stage}"]`).getAttribute('aria-pressed'),'true');
     assert.equal(await page.locator('.tf-token').count(),5);
    }
    await page.screenshot({path:root+`test-results/output-${width}.png`,fullPage:true});
   }
  }
  await context.close();
 }
 const context=await browser.newContext({offline:true,reducedMotion:'reduce',viewport:{width:1100,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(root+'examples/slides.html').href);
 await page.locator('#next').click();
 assert.equal(await page.locator('[data-layer="1"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-layer="4"]').click();
 assert.equal(await page.locator('#status').textContent(),'段階 5 / 7');
 await page.locator('#next').click();
 assert.equal(await page.locator('[data-layer="5"]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{
  const second=document.createElement('llm-gpt-representations');second.id='second';second.style.width='340px';document.body.append(second);
  const style=document.createElement('style');style.textContent='button{background:red!important;font-size:90px!important}figure{display:none!important}';document.head.append(style);
 });
 await page.locator('#second [data-layer="2"]').click();
 assert.equal(await page.locator('#diagram [data-layer="5"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#second .tf-stage').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1,'responds to container width');
 assert.notEqual(await page.locator('#second button').first().evaluate(e=>getComputedStyle(e).fontSize),'90px');
 await page.evaluate(()=>{const el=document.getElementById('second');el.remove();document.body.append(el);el.setAttribute('stage','6');});
 assert.equal(await page.locator('#second').evaluate(e=>e.shadowRoot.querySelector('.tf-representation').classList.contains('tf-output-ready')),true);
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('#second .tf-static').isVisible(),true);
 await context.close();
 const normal=await browser.newContext({offline:true,reducedMotion:'no-preference'});
 const motion=await normal.newPage();motion.on('pageerror',e=>errors.push(e.message));
 await motion.goto(pathToFileURL(root+'dist/gpt-representations.html').href);
 await motion.locator('[data-layer="1"]').click();
 assert.equal(await motion.locator('.tf-representation').evaluate(e=>e.classList.contains('tf-numeric')),true);
 await motion.waitForFunction(()=>!document.querySelector('llm-gpt-representations').shadowRoot.querySelector('.tf-representation').classList.contains('tf-numeric'));
 await motion.locator('[data-layer="6"]').click();
 await motion.locator('[data-layer="0"]').click();
 await motion.waitForTimeout(2300);
 assert.equal(await motion.locator('.tf-representation').evaluate(e=>e.classList.contains('tf-output-ready')),false,'stale timers cancelled');
 await normal.close();
 const staticContext=await browser.newContext({javaScriptEnabled:false,offline:true,viewport:{width:390,height:1000}});
 const staticPage=await staticContext.newPage();
 await staticPage.goto(pathToFileURL(root+'dist/gpt-representations.html').href);
 assert.equal(await staticPage.locator('.tf-static').isVisible(),true);
 assert.equal(await staticPage.locator('.tf-live').isVisible(),false);
 await staticContext.close();
 assert.deepEqual(errors,[]);
 console.log('Passed: offline files, 3 widths, all stages, embedding isolation, container layout, slide controls, reconnect, animation cancellation, print, and no-JS fallback.');
} finally {await browser.close();}
