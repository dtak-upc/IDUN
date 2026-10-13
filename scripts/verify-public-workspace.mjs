import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {chromium,expect} from '@playwright/test';
const root=path.resolve('.idun/showcase-build');const report={views:[],errors:[],requests:[],checks:[]};
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(req.url.split('?')[0]).replace(/^\/IDUN\//,'')||'index.html';const file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(b);});
});
await new Promise(r=>server.listen(5197,'127.0.0.1',r));let browser,page;
try{
 browser=await chromium.launch({headless:true,channel:'chrome'});page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 page.on('worker',w=>void w.evaluate(()=>{self.IDUN_DEBUG=true;}));
 page.on('console',m=>{if(m.text().startsWith('workspace'))console.log(m.text());});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!r.url().includes('kaspersky-labs.com')&&(r.url().includes('/api/')||!r.url().startsWith('http://127.0.0.1:5197/')))report.requests.push(r.url());});
 await page.goto('http://127.0.0.1:5197/IDUN/');const lakeSelect=page.getByLabel('Active data lake');await expect(lakeSelect).toBeVisible();
 expect(await lakeSelect.locator('option').allTextContents()).toEqual(['Dummy','Doc2DB','Disease_A-Z']);
 for(const lake of ['dummy','disease-az','doc2db']){
  await lakeSelect.selectOption(lake);
  for(const name of ['Data Lake','Discover','Integration','Augmentation','Knowledge Graph']){
   console.log(lake,name);await page.getByRole('button',{name,exact:true}).click();
   if(name==='Integration')await expect(page.locator('.integration-run-card').first()).toBeVisible({timeout:90000});
   if(name==='Knowledge Graph')await expect(page.locator('.kg-heading')).toBeVisible({timeout:90000});
   const trigger=page.locator('.data-journey-trigger:visible');await expect(trigger).toBeVisible({timeout:90000});await trigger.click();
   await expect(page.locator('.data-journey-dialog')).toBeVisible();
   if(name==='Data Lake'){
    await page.getByRole('button',{name:'Inspect received profiling sources',exact:true}).click();
    const inspector=page.getByRole('region',{name:'Scope pair inspector',exact:true});
    await expect(inspector.locator('tbody tr').first()).toBeVisible({timeout:90000});
    for(const column of [0,1]){
     await inspector.locator('tbody tr').first().locator('td').nth(column).getByRole('button').click();
     const source=page.getByRole('region',{name:'Expanded source',exact:true});
     await expect(source.locator(column===0?'tbody tr':'pre').first()).toBeVisible({timeout:90000});
     await source.getByRole('button',{name:'Collapse source',exact:true}).click();
    }
    report.checks.push(lake+': Data Journey table and document expansion');
   }
   if(name==='Discover'){
    await page.getByRole('button',{name:'Scores & evidence',exact:true}).click();
    for(const type of ['published link entries','shared-span paths']){
     await page.getByRole('button',{name:new RegExp(type+' ↗$')}).click();
     await expect(page.getByRole('region',{name:'Published evidence inspector',exact:true}).locator('.journey-evidence-list article').first()).toBeVisible({timeout:90000});
    }
    if(lake!=='doc2db')await expect(page.locator('.journey-preview')).not.toContainText(/Unrecorded|Reading saved scores|Calculating/,{timeout:90000});
    report.checks.push(lake+': published links and join paths');
   }
   if(name==='Knowledge Graph'){
    await page.getByRole('button',{name:'Instance data',exact:true}).click();
    await expect(page.locator('.data-journey-dialog .journey-evidence-list article').first()).toBeVisible({timeout:90000});
    report.checks.push(lake+': KG instance journey');
   }
   const alerts=await page.locator('[role="alert"]:visible').allTextContents();if(alerts.length)throw Error(lake+' '+name+': '+alerts.join(';'));
   for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
   await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});report.views.push({lake,stage:name});
  }
 }
 for(const width of [320,390,430,600,768]){
  await page.setViewportSize({width,height:844});
  const nav=page.getByRole('navigation',{name:'Workspace',exact:true});
  expect(await nav.locator('.nav-item').evaluateAll(ns=>ns.every(n=>{
   const label=n.querySelector('.workspace-nav-label'),r=label.getBoundingClientRect(),b=n.getBoundingClientRect();
   return label.scrollWidth<=label.clientWidth+1&&r.left>=b.left&&r.right<=b.right+1;
  }))).toBe(true);
 }
 await page.setViewportSize({width:1440,height:1000});report.checks.push('Mobile workspace tabs: no overlapping labels at 320–768 px');
 // Exercise exact application endpoints through the compiled browser adapter.
 const adapter=fs.readdirSync(path.join(root,'assets')).find(n=>/^browser-[^.]+\.js$/.test(n));
 const endpoint=async(path,body,method='GET')=>page.evaluate(async({adapter,path,body,method})=>{
  const module=await import('/IDUN/assets/'+adapter);return module.browserApi(path,{method,body:method==='GET'?undefined:JSON.stringify(body)},'dummy');
 },{adapter,path,body,method});
 const runs=(await endpoint('/integration')).plans.map(p=>p.id);let graph=await endpoint('/knowledge/automatic/sync',{runs},'POST');
 expect(graph.relationships.length).toBeGreaterThan(0);
 const c=graph.concepts[0];await endpoint('/knowledge/automatic/rename-concept',{runs,revision:graph.revision,concept:c.id,label:'Browser reviewed concept'},'POST');
 await page.reload();await expect(lakeSelect).toBeVisible();graph=await endpoint('/knowledge/automatic/sync',{runs},'POST');expect(graph.concepts.some(c=>c.label==='Browser reviewed concept')).toBe(true);report.checks.push('Private edits persist across reload');
 const exported=await endpoint('/knowledge/automatic/export',{runs,revision:graph.revision,format:'ttl',box:'tbox'},'POST');expect(exported).toBeTruthy();report.checks.push('KG export');
 const edge=graph.relationships[0],query={runs,revision:graph.revision,concept:edge.source,pattern:[{relationship:edge.id,target:edge.target,direction:'outgoing'}],limit:20,budget:1000,start_limit:100};
 const preview=await endpoint('/knowledge/automatic/preview-visual-path',query,'POST');
 const answers=await endpoint('/knowledge/automatic/visual-path',{...query,request_id:crypto.randomUUID(),preview_token:preview.token},'POST');expect(answers.items.length).toBeGreaterThan(0);
 const recipe=await endpoint('/knowledge/automatic/save-visual-query',{title:'Browser validation query',query,preview_token:preview.token},'POST');
 await page.reload();await expect(lakeSelect).toBeVisible();expect((await endpoint('/knowledge/automatic/get-saved-visual-query',{id:recipe.id},'POST')).title).toBe('Browser validation query');report.checks.push('Visual query and saved query persistence');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Settings & Configuration'})).toBeVisible();await page.waitForTimeout(500);expect(await page.locator('[role="alert"]:visible').allTextContents()).toEqual([]);report.checks.push('Settings render');
 expect(report.errors).toEqual([]);expect(report.requests).toEqual([]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e);report.alerts=await page?.locator('[role="alert"]:visible').allTextContents();report.overflow=await page?.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>innerWidth+1).slice(0,25).map(n=>({tag:n.tagName,cls:n.className,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}))}));await page?.screenshot({path:'.idun/static-workspace-failure.png'});process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync('.idun/public-workspace-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
