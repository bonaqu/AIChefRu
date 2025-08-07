/* EasyChefAI RU — клиентская логика */
(function(){
  const DATA = window.EASY_CHEF_DATA;

  const state = {
    selected: new Set(),
    diets: new Set(),
    techniques: new Set(["stovetop"]),
    portions: 2,
    timeLimit: 25,
    spiceLevel: 1,
    autoSubstitute: true,
    onePan: false,
    kidFriendly: false,
  };

  const els = {};
  document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initHeader();
    renderCatalog();
    renderDietFilters();
    renderTechniqueFilters();
    restoreFromStorage();
    bindEvents();
    updateSummary();
    registerSW();
    updateYear();
  });

  function cacheElements(){
    els.stepper = document.querySelector('.stepper');
    els.stepButtons = Array.from(document.querySelectorAll('.stepper-item'));
    els.steps = [1,2,3].map(n=>document.getElementById(`step-${n}`));

    els.ingredientSearch = document.getElementById('ingredient-search');
    els.manualInput = document.getElementById('manual-ingredients');
    els.selectedChips = document.getElementById('selected-ingredients');
    els.catalog = document.getElementById('ingredient-catalog');

    els.clearIngredients = document.getElementById('clear-ingredients');
    els.toStep2 = document.getElementById('to-step-2');

    els.dietFilters = document.getElementById('diet-filters');
    els.techniqueFilters = document.getElementById('technique-filters');
    els.portions = document.getElementById('portions');
    els.timeLimit = document.getElementById('time-limit');
    els.timeLimitValue = document.getElementById('time-limit-value');
    els.spiceLevel = document.getElementById('spice-level');
    els.spiceLevelValue = document.getElementById('spice-level-value');
    els.autoSubstitute = document.getElementById('auto-substitute');
    els.onePan = document.getElementById('one-pan');
    els.kidFriendly = document.getElementById('kid-friendly');

    els.backTo1 = document.getElementById('back-to-1');
    els.toStep3 = document.getElementById('to-step-3');

    els.selectionSummary = document.getElementById('selection-summary');
    els.generateBtn = document.getElementById('generate-btn');
    els.generateAgain = document.getElementById('generate-again');
    els.aiOutputCard = document.getElementById('ai-output-card');
    els.recipeTitle = document.getElementById('recipe-title');
    els.recipeContent = document.getElementById('recipe-content');
    els.historyCard = document.getElementById('history-card');
    els.historyList = document.getElementById('history-list');

    els.copyBtn = document.getElementById('copy-recipe');
    els.saveFavorite = document.getElementById('save-favorite');
    els.exportTxt = document.getElementById('export-txt');
    els.printBtn = document.getElementById('print-recipe');
    els.shareBtn = document.getElementById('share-recipe');

    els.backTo2 = document.getElementById('back-to-2');
    els.resetAll = document.getElementById('reset-all');

    els.toast = document.getElementById('toast');
    els.toggleTheme = document.getElementById('toggle-theme');
  }

  function initHeader(){
    const theme = localStorage.getItem('theme');
    if(theme){
      document.documentElement.dataset.theme = theme;
    }
    els.toggleTheme.addEventListener('click',()=>{
      const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      if(cur==='dark') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = 'light';
      localStorage.setItem('theme', document.documentElement.dataset.theme||'dark');
    });
  }

  function renderCatalog(){
    const fragment = document.createDocumentFragment();
    DATA.ingredientsCatalog.forEach(group=>{
      const wrap = el('div',{class:'group'});
      const title = el('div',{class:'group-title'},`${group.emoji} ${group.name}`);
      wrap.appendChild(title);
      const list = el('div',{class:'checks'});
      group.items.forEach(item=>{
        const id = `ing-${slug(item)}`;
        const label = el('label');
        const input = el('input',{type:'checkbox',id,value:item});
        input.addEventListener('change',()=>toggleIngredient(item, input.checked));
        label.appendChild(input);
        label.appendChild(el('span',{},capitalize(item)));
        list.appendChild(label);
      });
      wrap.appendChild(list);
      fragment.appendChild(wrap);
    });
    els.catalog.appendChild(fragment);
  }

  function renderDietFilters(){
    const fragment = document.createDocumentFragment();
    Object.entries(DATA.dietRules).forEach(([key,rule])=>{
      const id = `diet-${key}`;
      const label = el('label');
      const input = el('input',{type:'checkbox',id});
      input.addEventListener('change',()=>{
        if(input.checked) state.diets.add(key); else state.diets.delete(key);
        persist();
      });
      label.appendChild(input);
      label.appendChild(el('span',{},rule.title));
      fragment.appendChild(label);
    });
    els.dietFilters.appendChild(fragment);
  }

  function renderTechniqueFilters(){
    const fragment = document.createDocumentFragment();
    DATA.techniques.forEach(t=>{
      const id = `tech-${t.key}`;
      const label = el('label');
      const input = el('input',{type:'checkbox',id});
      input.checked = state.techniques.has(t.key);
      input.addEventListener('change',()=>{
        if(input.checked) state.techniques.add(t.key); else state.techniques.delete(t.key);
        if(state.techniques.size===0){
          showToast('Нужна хотя бы одна техника');
          input.checked = true; state.techniques.add(t.key);
        }
        persist();
      });
      label.appendChild(input);
      label.appendChild(el('span',{},`${t.emoji} ${t.title}`));
      fragment.appendChild(label);
    });
    els.techniqueFilters.appendChild(fragment);
  }

  function bindEvents(){
    // Stepper
    els.stepButtons.forEach(btn=>{
      btn.addEventListener('click',()=>goToStep(parseInt(btn.dataset.step,10)));
    });

    // Search filter
    els.ingredientSearch.addEventListener('input',()=>{
      const q = normalize(els.ingredientSearch.value);
      Array.from(els.catalog.querySelectorAll('label')).forEach(lab=>{
        const name = normalize(lab.textContent||'');
        lab.style.display = name.includes(q) ? '' : 'none';
      });
    });

    // Manual input chips
    els.manualInput.addEventListener('keydown',(e)=>{
      if(e.key==='Enter' || e.key===','){
        e.preventDefault();
        const value = els.manualInput.value.trim();
        if(!value) return;
        addManualItems(value);
        els.manualInput.value='';
      }
    });

    // Buttons
    els.clearIngredients.addEventListener('click',()=>{
      state.selected.clear();
      syncCatalogChecks();
      renderSelectedChips();
      persist();
    });
    els.toStep2.addEventListener('click',()=>goToStep(2));

    els.portions.addEventListener('input',()=>{ state.portions = clamp(parseInt(els.portions.value||'2',10),1,8); persist(); });
    els.timeLimit.addEventListener('input',()=>{ state.timeLimit = parseInt(els.timeLimit.value,10); els.timeLimitValue.textContent = state.timeLimit; persist(); });
    els.spiceLevel.addEventListener('input',()=>{ state.spiceLevel = parseInt(els.spiceLevel.value,10); els.spiceLevelValue.textContent = ['неостро','средняя','остро'][state.spiceLevel]; persist(); });
    els.autoSubstitute.addEventListener('change',()=>{ state.autoSubstitute = els.autoSubstitute.checked; persist(); });
    els.onePan.addEventListener('change',()=>{ state.onePan = els.onePan.checked; persist(); });
    els.kidFriendly.addEventListener('change',()=>{ state.kidFriendly = els.kidFriendly.checked; persist(); });

    els.backTo1.addEventListener('click',()=>goToStep(1));
    els.toStep3.addEventListener('click',()=>{ updateSummary(); goToStep(3); });

    els.generateBtn.addEventListener('click',onGenerate);
    els.generateAgain.addEventListener('click',onGenerate);

    els.copyBtn.addEventListener('click',copyRecipe);
    els.saveFavorite.addEventListener('click',saveFavorite);
    els.exportTxt.addEventListener('click',exportTxt);
    els.printBtn.addEventListener('click',()=>window.print());
    els.shareBtn.addEventListener('click',shareRecipe);

    els.backTo2.addEventListener('click',()=>goToStep(2));
    els.resetAll.addEventListener('click',()=>{ localStorage.clear(); location.reload(); });
  }

  function goToStep(n){
    els.stepButtons.forEach(b=>b.classList.toggle('active', parseInt(b.dataset.step,10)===n));
    els.steps.forEach((s,i)=>{ s.classList.toggle('active', (i+1)===n); });
  }

  function addManualItems(text){
    const parts = text.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
    parts.forEach(p=>{
      const normalized = normalizeSynonym(p);
      state.selected.add(normalized);
    });
    syncCatalogChecks();
    renderSelectedChips();
    persist();
  }

  function toggleIngredient(name, checked){
    const normalized = normalizeSynonym(name);
    if(checked) state.selected.add(normalized); else state.selected.delete(normalized);
    renderSelectedChips();
    persist();
  }

  function renderSelectedChips(){
    els.selectedChips.innerHTML = '';
    const fr = document.createDocumentFragment();
    Array.from(state.selected).sort().forEach(name=>{
      const chip = el('span',{class:'chip'},capitalize(name));
      const btn = el('button',{class:'remove',title:'Убрать',ariaLabel:'Убрать'},'✖');
      btn.addEventListener('click',()=>{
        state.selected.delete(name);
        syncCatalogChecks();
        renderSelectedChips();
        persist();
      });
      chip.appendChild(btn);
      fr.appendChild(chip);
    });
    els.selectedChips.appendChild(fr);
  }

  function syncCatalogChecks(){
    Array.from(els.catalog.querySelectorAll('input[type=checkbox]')).forEach(cb=>{
      const value = normalizeSynonym(cb.value);
      cb.checked = state.selected.has(value);
    });
  }

  function updateSummary(){
    const items = Array.from(state.selected).sort();
    const diets = Array.from(state.diets).map(k=>DATA.dietRules[k].title).join(', ') || '—';
    const techn = Array.from(state.techniques).map(k=>{
      const t = DATA.techniques.find(x=>x.key===k); return t? t.title : k;
    }).join(', ');

    els.selectionSummary.innerHTML = `
      <div class="block"><strong>Ингредиенты:</strong> ${items.length? items.map(capitalize).join(', ') : 'не выбрано'}</div>
      <div class="block"><strong>Диеты:</strong> ${diets}</div>
      <div class="block"><strong>Техника:</strong> ${techn}</div>
      <div class="block"><strong>Порций:</strong> ${state.portions} • <strong>Время:</strong> до ${state.timeLimit} мин • <strong>Острота:</strong> ${['неостро','средняя','остро'][state.spiceLevel]}</div>
    `;
  }

  async function onGenerate(){
    if(state.selected.size===0){ showToast('Добавьте хотя бы 1–2 ингредиента'); return; }

    const selection = applyDietRules(Array.from(state.selected));
    const context = { ...state, selection };

    els.aiOutputCard.hidden = false;
    els.recipeContent.innerHTML = '';
    els.recipeTitle.textContent = 'Думаю над идеями…';
    els.generateBtn.disabled = true;
    els.generateAgain.disabled = true;

    await typeAI(["Оцениваю ингредиенты…", "Подбираю технику и стиль блюда…", "Пишу рецепт…"]);

    const recipe = generateRecipe(context);

    els.recipeTitle.textContent = recipe.title;
    renderRecipe(recipe);
    saveHistory(recipe);

    els.generateBtn.disabled = false;
    els.generateAgain.disabled = false;
  }

  function applyDietRules(list){
    if(state.diets.size===0) return list;
    const forbiddens = new Set();
    const subs = {};
    state.diets.forEach(key=>{
      const rule = DATA.dietRules[key];
      rule.forbidden.forEach(x=>forbiddens.add(x));
      Object.assign(subs, rule.substitutes||{});
    });

    const result = [];
    const replacements = [];
    list.forEach(item=>{
      if(forbiddens.has(item)){
        if(state.autoSubstitute && subs[item]){
          replacements.push(`${capitalize(item)} → ${capitalize(subs[item])}`);
          result.push(subs[item]);
        }
      } else {
        result.push(item);
      }
    });

    if(replacements.length){
      showToast('Автозамены: '+replacements.join(', '));
    }

    return Array.from(new Set(result));
  }

  function classify(item){
    // Очень упрощённая классификация
    const veg = ["картофель","лук","чеснок","морковь","перец","помидоры","огурец","кабачок","баклажан","брокколи","цветная капуста","капуста","шпинат","свёкла","кукуруза","горох","грибы","овощная смесь","шпинат (зам.)"];
    const fruits=["яблоко","банан","апельсин","лимон","лайм","клубника","ягоды (зам.)"];
    const proteins=["курица","индейка","говядина","свинина","рыба","лосось","тунец","яйцы","яйца","тофу","нут","фасоль","чечевица","сыр","творог","сосиски"];
    const grains=["рис","гречка","макароны","лапша","булгур","кус-кус","овсянка","хлеб","лаваш","тортилья","рисовые макароны"];
    const dairy=["молоко","сливки","йогурт","сметана","масло сливочное","сыр","кефир","творог"];
    const sauces=["соль","перец чёрный","паприка","карри","куркума","соевый соус","уксус","оливковое масло","растительное масло","томатная паста","горчица","майонез","чеснок сушёный","лук сушёный","базилик","орегано","тимьян","кумин","кориандр","чили","кунжут","семечки","арахис","миндаль","грецкий орех"];

    if(veg.includes(item)) return 'овощ';
    if(fruits.includes(item)) return 'фрукт';
    if(proteins.includes(item)) return 'белок';
    if(grains.includes(item)) return 'крупа';
    if(dairy.includes(item)) return 'молочное';
    if(sauces.includes(item)) return 'соус';
    return 'прочее';
  }

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function generateRecipe(ctx){
    const items = ctx.selection;
    const byRole = groupByRole(items);

    const allowedTemplates = DATA.recipeTemplates.filter(t=> t.techniques.some(k=>ctx.techniques.has(k)) && t.time <= ctx.timeLimit+10);
    const template = pick(allowedTemplates.length?allowedTemplates:DATA.recipeTemplates);

    const title = buildTitle(template, byRole, ctx);
    const ingredients = buildIngredients(byRole, ctx);
    const steps = buildSteps(template, byRole, ctx);
    const tips = buildWasteTips(items);

    return { id: String(Date.now()), title, ingredients, steps, tips, meta: {
      portions: ctx.portions, time: estimateTime(template, ctx), spice: ctx.spiceLevel, diets: Array.from(ctx.diets).map(k=>DATA.dietRules[k].title), techniques: Array.from(ctx.techniques)
    }};
  }

  function groupByRole(items){
    const map = { овощ:[], белок:[], крупа:[], молочное:[], соус:[], фрукт:[], прочее:[] };
    items.forEach(it=> map[classify(it)].push(it));
    return map;
  }

  function buildTitle(tpl, byRole, ctx){
    const main = (byRole.белок[0]||byRole.овощ[0]||byRole.крупа[0]||'овощами');
    const support = (byRole.овощ[1]||byRole.крупа[0]||byRole.соус[0]||'травами');
    const sauce = (byRole.соус[0]||'соусом');
    let name = tpl.name.replace('{main}', main).replace('{support}', support).replace('{sauce}', sauce);
    name = name.replace(/\bяйцы\b/,'яйца');
    return capitalize(name);
  }

  function buildIngredients(byRole, ctx){
    const list = [];
    const push = (name, qty)=> list.push({name: capitalize(name), qty});
    const portions = ctx.portions;

    if(byRole.белок[0]) push(byRole.белок[0], `${200*portions} г`);
    if(byRole.овощ[0]) push(byRole.овощ[0], `${150*portions} г`);
    if(byRole.овощ[1]) push(byRole.овощ[1], `${120*portions} г`);
    if(byRole.крупа[0]) push(byRole.крупа[0], `${70*portions} г (сухая)`) ;

    // Базовые добавки
    if(!byRole.соус.includes('соль')) list.push({name:'Соль', qty:'по вкусу'});
    if(!byRole.соус.includes('перец чёрный')) list.push({name:'Перец чёрный', qty:'по вкусу'});
    if(byRole.соус[0]) push(byRole.соус[0], '1–2 ст. л.');
    if(byRole.молочное[0]) push(byRole.молочное[0], 'по вкусу');

    return list;
  }

  function buildSteps(tpl, byRole, ctx){
    const technique = pick(Array.from(ctx.techniques));
    const steps = [];
    const portions = ctx.portions;
    const time = estimateTime(tpl, ctx);

    const hasGrain = !!byRole.крупа.length;
    const hasProtein = !!byRole.белок.length;
    const hasVeg = !!byRole.овощ.length;

    steps.push(`Подготовка (5–10 мин): вымойте и нарежьте ингредиенты удобными кусочками. ${ctx.onePan? 'Готовим всё в одной посуде.' : ''}`);

    if(technique==='stovetop'){
      if(hasGrain) steps.push(`Отварите ${byRole.крупа[0]} до готовности согласно инструкции.`);
      if(hasVeg) steps.push(`Разогрейте сковороду, добавьте немного масла, обжарьте ${byRole.овощ.slice(0,2).join(' и ')} 4–6 мин.`);
      if(hasProtein) steps.push(`Добавьте ${byRole.белок[0]} и готовьте до готовности.`);
      steps.push(`Приправьте ${ctx.spiceLevel===0?'мягко':'по вкусу'}: соль, перец${ctx.spiceLevel>0?', паприка/карри':''}${byRole.соус[0]?`, ${byRole.соус[0]}`:''}. Перемешайте.`);
    } else if(technique==='oven'){
      steps.push(`Разогрейте духовку до 200°C. В форме смешайте ${[...byRole.овощ.slice(0,2), byRole.белок[0]].filter(Boolean).join(', ')} с маслом и специями. Запекайте 20–30 мин до румяности.`);
      if(hasGrain) steps.push(`Параллельно отварите ${byRole.крупа[0]} до готовности.`);
    } else if(technique==='microwave'){
      steps.push(`В кружке/сосуде для СВЧ смешайте ${byRole.белок.includes('яйца')?'яйца,':''} ${byRole.овощ.slice(0,2).join(', ')} и щепотку соли. Готовьте 2–4 мин, проверяя каждые 30 сек.`);
    } else if(technique==='noheat'){
      steps.push(`Соберите салат/боул: ${[...byRole.овощ.slice(0,3), byRole.белок[0], byRole.крупа[0]].filter(Boolean).join(', ')}. Заправьте маслом, уксусом/соусом.`);
    } else if(technique==='blender'){
      steps.push(`Соедините в блендере ${[...byRole.фрукт.slice(0,2), byRole.молочное[0]||'воду'].filter(Boolean).join(', ')}. Измельчите до однородности.`);
    } else if(technique==='multicooker'){
      steps.push(`В чашу мультиварки добавьте ${[...byRole.овощ.slice(0,2), byRole.белок[0], byRole.крупа[0]].filter(Boolean).join(', ')} и 2–3 стакана воды/бульона. Режим «Тушение» 25–35 мин.`);
    }

    steps.push(`Подача: порции ×${portions}. Время приготовления: ~${time} мин.`);

    if(ctx.kidFriendly) steps.push('Совет: режьте помельче, избегайте лишней остроты, подавайте с йогуртом/соусом без чили.');

    return steps;
  }

  function estimateTime(tpl, ctx){
    const base = tpl.time || 20; const mod = ctx.onePan? -3 : 0; return Math.max(10, Math.min(ctx.timeLimit+5, base+mod));
  }

  function buildWasteTips(items){
    const tips = [];
    if(items.includes('хлеб')) tips.push('Остатки хлеба подсушите — будут отличные сухари или панировка.');
    if(items.includes('морковь')||items.includes('лук')) tips.push('Обрезки овощей заморозьте для будущего бульона.');
    if(items.includes('лимон')||items.includes('лайм')) tips.push('Цедру снимите заранее — добавит аромата другим блюдам.');
    if(items.includes('рис')) tips.push('Остывший рис используйте завтра для жарки — так он лучше держит форму.');
    if(tips.length===0) tips.push('Планируйте порции и храните остатки в герметичных контейнерах до 3 дней.');
    return tips;
  }

  function renderRecipe(recipe){
    const cont = els.recipeContent;
    cont.innerHTML = '';

    const intro = el('div',{class:'block'},`\n<strong>Название:</strong> ${recipe.title}<br/>\n<strong>Порций:</strong> ${recipe.meta.portions} • <strong>Время:</strong> ~${recipe.meta.time} мин${recipe.meta.diets.length?` • <strong>Диеты:</strong> ${recipe.meta.diets.join(', ')}`:''}`);
    cont.appendChild(intro);

    const ing = el('div',{class:'block'});
    ing.appendChild(el('h4',{},'Ингредиенты'));
    const ul = el('ul');
    recipe.ingredients.forEach(it=>{
      ul.appendChild(el('li',{},`${it.name} — ${it.qty}`));
    });
    ing.appendChild(ul);
    cont.appendChild(ing);

    const st = el('div',{class:'block'});
    st.appendChild(el('h4',{},'Шаги'));
    const ol = el('ol');
    recipe.steps.forEach(s=> ol.appendChild(el('li',{},s)) );
    st.appendChild(ol);
    cont.appendChild(st);

    const tips = el('div',{class:'block'});
    tips.appendChild(el('h4',{},'Как снизить отходы'));
    const lt = el('ul');
    recipe.tips.forEach(s=> lt.appendChild(el('li',{},s)) );
    tips.appendChild(lt);
    cont.appendChild(tips);

    // Store current for actions
    cont.dataset.current = JSON.stringify(recipe);
  }

  async function typeAI(lines){
    const box = els.recipeContent;
    box.innerHTML = '';
    for(const line of lines){
      const p = el('div',{class:'muted'},line);
      box.appendChild(p);
      await sleep(500 + Math.random()*400);
    }
  }

  function saveHistory(recipe){
    const key = 'history';
    const list = JSON.parse(localStorage.getItem(key)||'[]');
    list.unshift({ id: recipe.id, title: recipe.title, meta: recipe.meta, when: Date.now(), snapshot: recipe });
    const trimmed = list.slice(0,8);
    localStorage.setItem(key, JSON.stringify(trimmed));
    renderHistory(trimmed);
  }

  function renderHistory(list){
    els.historyList.innerHTML = '';
    const fr = document.createDocumentFragment();
    list.forEach(item=>{
      const div = el('div',{class:'item'});
      div.appendChild(el('div',{class:'muted'}, new Date(item.when).toLocaleString()))
      div.appendChild(el('div',{}, item.title));
      const btn = el('button',{class:'btn-link'},'Открыть');
      btn.addEventListener('click',()=>{ els.aiOutputCard.hidden=false; renderRecipe(item.snapshot); els.recipeTitle.textContent = item.title; goToStep(3); });
      div.appendChild(btn);
      fr.appendChild(div);
    });
    els.historyList.appendChild(fr);
  }

  function copyRecipe(){
    const data = currentRecipe(); if(!data) return;
    const text = asPlainText(data);
    navigator.clipboard.writeText(text).then(()=>showToast('Скопировано')).catch(()=>showToast('Не удалось скопировать'));
  }

  function saveFavorite(){
    const data = currentRecipe(); if(!data) return;
    const fav = JSON.parse(localStorage.getItem('favorites')||'[]');
    fav.unshift(data);
    localStorage.setItem('favorites', JSON.stringify(fav.slice(0,20)));
    showToast('Сохранено в избранное');
  }

  function exportTxt(){
    const data = currentRecipe(); if(!data) return;
    const blob = new Blob([asPlainText(data)], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = slug(data.title)+'.txt'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  async function shareRecipe(){
    const data = currentRecipe(); if(!data) return;
    const text = asPlainText(data);
    if(navigator.share){
      try { await navigator.share({ title: data.title, text }); }
      catch(e){ /* cancel */ }
    } else {
      copyRecipe();
      showToast('Поделиться недоступно — рецепт скопирован');
    }
  }

  function currentRecipe(){
    try { return JSON.parse(els.recipeContent.dataset.current||'null'); } catch{ return null; }
  }

  function asPlainText(recipe){
    const head = `${recipe.title}\nПорций: ${recipe.meta.portions} • Время: ~${recipe.meta.time} мин${recipe.meta.diets.length?` • Диеты: ${recipe.meta.diets.join(', ')}`:''}\n\n`;
    const ing = 'Ингредиенты:\n'+recipe.ingredients.map(i=>`• ${i.name} — ${i.qty}`).join('\n')+'\n\n';
    const steps = 'Шаги:\n'+recipe.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')+'\n\n';
    const tips = 'Как снизить отходы:\n'+recipe.tips.map(s=>'• '+s).join('\n')+'\n';
    return head+ing+steps+tips;
  }

  function restoreFromStorage(){
    try{
      const saved = JSON.parse(localStorage.getItem('state')||'null');
      if(!saved) return;
      Object.assign(state, saved, { selected: new Set(saved.selected||[]) , diets: new Set(saved.diets||[]), techniques: new Set(saved.techniques||[]) });
      syncCatalogChecks();
      renderSelectedChips();
      els.portions.value = state.portions;
      els.timeLimit.value = state.timeLimit; els.timeLimitValue.textContent = state.timeLimit;
      els.spiceLevel.value = state.spiceLevel; els.spiceLevelValue.textContent = ['неостро','средняя','остро'][state.spiceLevel];
      els.autoSubstitute.checked = state.autoSubstitute;
      els.onePan.checked = state.onePan;
      els.kidFriendly.checked = state.kidFriendly;
      // diets
      Object.keys(DATA.dietRules).forEach(k=>{
        const cb = document.getElementById('diet-'+k); if(cb) cb.checked = state.diets.has(k);
      });
      // techniques
      DATA.techniques.forEach(t=>{
        const cb = document.getElementById('tech-'+t.key); if(cb) cb.checked = state.techniques.has(t.key);
      });
      // history
      const hist = JSON.parse(localStorage.getItem('history')||'[]');
      renderHistory(hist);
    }catch{}
  }

  function persist(){
    const serializable = { ...state, selected: Array.from(state.selected), diets: Array.from(state.diets), techniques: Array.from(state.techniques) };
    localStorage.setItem('state', JSON.stringify(serializable));
    updateSummary();
  }

  function showToast(message){
    els.toast.textContent = message;
    if(!els.toast.open) els.toast.show();
    clearTimeout(els.toast.__t);
    els.toast.__t = setTimeout(()=>{ try{ els.toast.close(); }catch{} }, 2000);
  }

  function normalize(str){
    return (str||'').toLowerCase().replace(/[ё]/g,'е').trim();
  }
  function normalizeSynonym(str){
    const n = normalize(str);
    return DATA.synonyms[n] || n;
  }
  function capitalize(s){ return (s||'').charAt(0).toUpperCase()+ (s||'').slice(1); }
  function slug(s){ return normalize(s).replace(/[^a-z0-9а-я-]+/g,'-').replace(/-+/g,'-'); }
  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
  const el = (tag, attrs={}, content)=>{ const e=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>{ if(k==='class') e.className=v; else if(k==='for') e.htmlFor=v; else if(k==='ariaLabel') e.setAttribute('aria-label', v); else e.setAttribute(k,v); }); if(content!=null) e.innerHTML = content; return e; };

  function updateYear(){
    const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();
  }

  function registerSW(){
    if('serviceWorker' in navigator && location.protocol.startsWith('http')){
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    }
  }
})();