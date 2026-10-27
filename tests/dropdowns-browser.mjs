import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const server = spawn(process.execPath, ['tools/dev-server.mjs'], { env: {...process.env, PORT:'0'}, windowsHide:true, stdio:['ignore','pipe','pipe'] });
let browser;
const results=[];
try {
  await mkdir('output/playwright',{recursive:true});
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),10000);server.on('error',reject);server.stdout.on('data',data=>{const m=String(data).match(/http:\/\/localhost:\d+\//);if(m){clearTimeout(timer);resolve(m[0]);}});});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
  const page=await browser.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror',e=>results.push({error:e.message}));
  await page.goto(url);await page.locator('#btn-login-local').click();
  assert.ok(await page.evaluate(async()=>{
    const {STATE,RUNTIME}=await import('/modules/state.js');
    const nav=await import('/modules/navigation.js');
    const play=await import('/modules/play-recipe.js');
    const {getAllRecipes,recipeMatchesDietPreference}=await import('/modules/recipe-domain.js');
    const planner=await import('/modules/planner.js');
    const {dateKey,weekDates}=await import('/modules/planner-calendar.js');
    const monday=dateKey(weekDates()[0]),tuesday=dateKey(weekDates()[1]);
    const scheduled=document.getElementById('select-meal-recipe-dropdown');
    STATE.user.dietPreference='None';
    for(const slot of ['Breakfast','Lunch','Dinner']) {
      planner.openScheduleDropdown('Monday',slot);
      const expected=getAllRecipes().filter(recipe=>recipe.category===slot);
      assertBrowser(expected.length>0,`${slot} has matching recipes`);
      assertBrowser(JSON.stringify([...scheduled.options].slice(1).map(option=>[option.value,option.textContent]))===JSON.stringify(expected.map(recipe=>[recipe.id,recipe.title])),`${slot} lists only matching recipes with plain titles`);
      scheduled.value=expected[0].id;planner.saveScheduledMealSelection();
      planner.openScheduleDropdown('Monday',slot);
      assertBrowser(scheduled.value===expected[0].id,`${slot} selection stays saved`);
    }
    const mismatched=getAllRecipes().find(recipe=>recipe.category==='Dinner');
    STATE.scheduledMeals[`${tuesday}-Breakfast`]=mismatched.id;
    planner.openScheduleDropdown('Tuesday','Breakfast');
    assertBrowser(![...scheduled.options].some(option=>option.value===mismatched.id),'An old mismatched assignment is excluded from the choices');
    assertBrowser(scheduled.value===''&&STATE.scheduledMeals[`${tuesday}-Breakfast`]===mismatched.id,'Opening the picker keeps the saved assignment until an explicit save');
    document.getElementById('select-meal-modal').style.display='none';
    nav.switchView('play');
    const cooks=document.getElementById('play-cook-count');
    cooks.value='2';cooks.dispatchEvent(new Event('change',{bubbles:true}));
    const choice=document.getElementById('play-recipe-select');
    choice.selectedIndex=1;choice.dispatchEvent(new Event('change',{bubbles:true}));
    assertBrowser(cooks.value==='2','Changing recipe preserves two cooks');
    choice.value='not-a-recipe';play.renderPlayRecipeView();
    assertBrowser(choice.selectedIndex===0,'Missing recipe returns to the placeholder');
    const filtered=getAllRecipes().find(recipe=>recipe.category==='Dinner'&&!recipeMatchesDietPreference(recipe,'Vegetarian'));
    assertBrowser(Boolean(filtered),'Fixture contains a non-vegetarian recipe');
    STATE.scheduledMeals[`${monday}-Dinner`]=filtered.id;
    STATE.user.dietPreference='Vegetarian';
    planner.openScheduleDropdown('Monday','Dinner');
    assertBrowser(scheduled.value===filtered.id,'Filtered scheduled meal stays selected');
    assertBrowser(scheduled.selectedOptions[0].textContent===`${filtered.title} (outside diet preference)`,'The preserved selection omits the category prefix');
    planner.saveScheduledMealSelection();
    assertBrowser(STATE.scheduledMeals[`${monday}-Dinner`].recipeId===filtered.id && STATE.scheduledMeals[`${monday}-Dinner`].portions===1,'Saving preserves the filtered meal');
    planner.openScheduleDropdown('Monday','Dinner');
    scheduled.value='';planner.saveScheduledMealSelection();
    assertBrowser(!STATE.scheduledMeals[`${monday}-Dinner`],'Empty option explicitly clears the meal');
    RUNTIME.playSession.recipeId=filtered.id;
    RUNTIME.playSession.upcoming=filtered.steps;
    play.renderPlayRecipeView();
    assertBrowser(choice.value===filtered.id&&choice.disabled,'Active cooking selection survives diet changes');
    play.resetPlayRecipeSession();STATE.user.dietPreference='None';
    return true;
    function assertBrowser(value,message){if(!value)throw new Error(message);}
  }));
  console.log('PASS planner filters all meal slots with plain titles and saved selections; recipe changes preserve cook count; filtered meals and active sessions retain selections');
  const groups=[
    ['pantry',['#pantry-category-input','#pantry-unit-input']],
    ['ai-generator',['#recipe-category-input','#recipe-difficulty-input','.recipe-ingredient-unit','.recipe-step-action-type','.recipe-step-type','.recipe-step-cook','.recipe-step-attention','.recipe-step-dependencies','#ai-provider-select','#ai-diet-preference','#ai-difficulty']],
    ['play',['#play-cook-count']],
    ['planner',['#select-meal-recipe-dropdown']],
    ['profile',['#profile-diet-input','#profile-ai-provider-select']],
    ['detail',['#modal-cook-count']]
  ];
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:844});
    for(const [view,selectors] of groups){
      await page.evaluate(async view=>{
        document.querySelectorAll('.modal-overlay').forEach(el=>el.style.display='none');
        const nav=await import('/modules/navigation.js');
        if(view==='profile') (await import('/modules/profile.js')).openProfileModal();
        else if(view==='detail') (await import('/modules/recipe-detail.js')).showRecipeDetailsModal((await import('/modules/recipe-domain.js')).getVisibleRecipes()[0]);
        else {
          nav.switchView(view);
          if(view==='planner') (await import('/modules/planner.js')).openScheduleDropdown('Monday','Dinner');
          if(view==='ai-generator') {
            const b=await import('/modules/recipe-builder.js');b.ensureRecipeBuilderDefaults();
            if(document.querySelectorAll('.recipe-step-row').length<2)b.addRecipeStepRow({title:'A second action'});
            document.querySelectorAll('#view-ai-generator details').forEach(el=>el.open=true);
          }
        }
      },view);
      for(const selector of selectors){
        const select=page.locator(selector).first();
        try {
          await select.scrollIntoViewIfNeeded({timeout:3000});
          const info=await select.evaluate(el=>{
            const r=el.getBoundingClientRect();
            return {value:el.value,options:[...el.options].map(o=>o.value),multiple:el.multiple,label:el.labels?.[0]?.textContent||el.getAttribute('aria-label'),bounds:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:el.scrollWidth>el.clientWidth+1};
          });
          const item={width,view,selector,...info,issues:[]};results.push(item);
          if(info.bounds.x<0||info.bounds.x+info.bounds.width>width+1)item.issues.push('trigger outside viewport');
          if(info.overflow)item.issues.push('trigger text overflows');
          if(!info.label)item.issues.push('no accessible label');
          if(info.multiple){await select.selectOption(info.options.slice(0,2));continue;}
          await select.click({timeout:3000});
          if(!await select.evaluate(el=>el.matches(':open')))item.issues.push('menu fails to open');
          const last=select.locator('option').last();
          await last.scrollIntoViewIfNeeded();
          const box=await last.boundingBox();
          if(box.x<0||box.x+box.width>width+1)item.issues.push('option outside viewport');
          if(await last.evaluate(el=>el.scrollWidth>el.clientWidth+1))item.issues.push('option text overflows');
          await last.click();
          if(await select.inputValue()!==info.options.at(-1))item.issues.push('selection not applied');
          await select.click();await page.keyboard.press('Escape');
          if(await select.evaluate(el=>el.matches(':open')))item.issues.push('Escape fails');
          await select.focus();await page.keyboard.press('Space');await page.keyboard.press('Home');await page.keyboard.press('Enter');
          if(await select.inputValue()!==info.options[0])item.issues.push('keyboard selection fails');
          await select.selectOption(info.value);
        } catch(e){results.push({width,view,selector,error:e.message});await page.keyboard.press('Escape');}
      }
    }
    console.log(`Checked ${width}px`);
  }
} finally {await browser?.close();server.kill();}
await writeFile('output/playwright/dropdown-audit.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.filter(r=>r.error||r.issues?.length),null,2));
console.log('Controls checked:',results.filter(r=>r.issues).length);
assert.deepEqual(results.filter(r=>r.error||r.issues?.length),[]);
