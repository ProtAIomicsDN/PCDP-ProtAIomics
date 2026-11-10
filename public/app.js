const steps = [...document.querySelectorAll('.step')];
const form = document.getElementById('pcdpForm');
let currentStep = 0;
let importedBackup = null;
let researchSkillCount = 0;
let activityCount = 0;
let lastRenderedMode = null;

const researchSkillOptions = [
  'Experimental design', 'Laboratory techniques and protocols', 'Instrumentation / specialised experimental platforms',
  'Programming and scripting', 'Statistics', 'Data analysis', 'Scientific plotting and visualisation',
  'Literature review and critical appraisal', 'Other'
];
// Competencies selected from the European Commission ResearchComp framework.
// Excludes Doing research and Managing research tools, addressed elsewhere.
const researchCompAreas = window.RESEARCHCOMP_AREAS || [];
const transferableOptions = researchCompAreas.flatMap(area => area.competencies.map(c => c.name));
// Adapted from the CARDEA self-assessment rating scale, for doctoral development.
const experienceLevels = [
  ['NA','N/A - Not applicable'],['0','0 - No knowledge or experience'],
  ['1','1 - Foundational'],['2','2 - Intermediate'],
  ['3','3 - Advanced'],['4','4 - Expert']
];
const experienceNames = Object.fromEntries(experienceLevels);
const ratingCode = text => {
  const map = {'No experience yet':'0','Basic experience':'1',
    'Some independent experience':'2','Confident / regular use':'3',
    'Advanced / can support others':'4', 'N/A':'NA'};
  return map[text] ?? String(text ?? '');
};
const ratingLabel = value => experienceNames[ratingCode(value)] || 'Not previously rated';
const skillKey = text => String(text || '').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const experienceOptions = () => experienceLevels.map(([v,caption])=>
  `<option value="${v}">${escapeHtml(caption)}</option>`).join('');
const learningApproaches = ['Course / workshop','Learning by doing','Mentoring / supervision','Peer learning','Secondment','Self-study','Other'];
const evidenceOptions = ['Completed training','Applied the skill independently','Produced an output','Received feedback','Used the skill in a new context','Took on greater responsibility','Other'];
const supportOptions = ['Supervisor feedback','Access to training','Mentoring','Introduction to collaborators','More opportunities to practise','Access to tools / infrastructure','No specific support needed','Other'];
const trainingCatalog = [
  {id:'ebi-biostatistics', title:'Biostatistics: A practical introduction', provider:'EMBL-EBI Training', url:'https://www.ebi.ac.uk/training/online/courses/biostatistics-introduction/', duration:'~3 h', tags:['Statistics','Data analysis','Scientific plotting and visualisation']},
  {id:'ebi-programmatically', title:'EMBL-EBI, programmatically', provider:'EMBL-EBI Training', url:'https://www.ebi.ac.uk/training/online/courses/embl-ebi-programmatically/', duration:'~3 h', tags:['Programming and scripting','Data analysis']},
  {id:'ebi-data-management', title:'Bringing data to life: Data management for the biomolecular sciences', provider:'EMBL-EBI Training', url:'https://www.ebi.ac.uk/training/online/courses/bringing-data-to-life-data-management/', duration:'~2 h', tags:['Research data management','FAIR principles']},
  {id:'openlearn-talk', title:'Talk the talk', provider:'OpenLearn', url:'https://www.open.edu/openlearn/education-development/talk-the-talk', duration:'Self-paced', tags:['Presentations / public speaking','Scientific communication']},
  {id:'openlearn-project-management', title:'Project management: the start of the project journey', provider:'OpenLearn', url:'https://www.open.edu/openlearn/mod/oucontent/view.php?id=2796', duration:'~35 h', tags:['Project and time management','Managing multiple tasks and priorities']},
  {id:'openlearn-teamwork', title:'Groups and teamwork', provider:'OpenLearn', url:'https://www.open.edu/openlearn/mod/oucontent/view.php?id=3302&intro=1&section=0', duration:'~20 h', tags:['Collaboration / teamwork','Leadership / initiative']},
  {id:'openlearn-virtual-teams', title:'Managing virtual project teams', provider:'OpenLearn', url:'https://www.open.edu/openlearn/mod/oucontent/view.php?id=27295', duration:'~8 h', tags:['Collaboration / teamwork','Leadership / initiative','Intercultural communication']}
];

const field = name => document.querySelector(`[data-field="${name}"]`);
const getMode = () => document.querySelector('input[name="mode"]:checked')?.value || '';
const getNetwork = () => 'ProtAIomics';

function formatDate(value) {
  if (!value) return '';
  const [y,m,d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function safeFilename(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
}

function updateTheme() {
  document.body.classList.remove('theme-prot');
  document.getElementById('networkLogo').src = 'assets/protaiomics-base.png';
}



function updateNextReviewDate() {
  const dateInput = document.getElementById('reviewDate');
  const nextInput = document.getElementById('nextReview');
  const note = document.getElementById('nextReviewHelp');
  const calc = window.PCDPReviewCalendar?.calculate(dateInput?.value);
  if (!calc) {
    if (nextInput) nextInput.value = '';
    if (note) note.textContent = 'Choose a review date to calculate the next review six months later.';
    return;
  }
  nextInput.value = calc.date;
  const adjusted = calc.shiftDays > 0
    ? `The six-month date (${formatDate(calc.original)}) falls on a weekend or Barcelona public holiday; the next working day is ${formatDate(calc.date)}.`
    : `Calculated review: ${formatDate(calc.date)} (six months after this PCDP).`;
  const coverage = calc.holidayCalendarConfirmed
    ? ' Barcelona public holidays are included. You may adjust the date if your host institution follows a different calendar.'
    : ' Holiday dates for this year are not yet verified; weekends are excluded, but please check local public holidays and adjust the date if needed.';
  note.textContent = adjusted + coverage;
}

function nextCycle(previous) {
  const order = ['Initial','6-month','12-month','18-month','24-month','30-month','36-month'];
  const idx = order.indexOf(previous || '');
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : '';
}

function renderPreviousSnapshot() {
  const box = document.getElementById('previousSnapshot');
  if (!box) return;
  if (getMode() !== 'Update' || !importedBackup) { box.classList.add('hidden'); box.innerHTML=''; return; }
  const research=(importedBackup.research_skills||[]).filter(x=>!('learning_priority' in x)||x.learning_priority==='yes').map(x=>x.research_skill==='Other'?(x.research_other||'Other'):x.research_skill).filter(Boolean);
  const transferable=(importedBackup.transferable_skills||[]).filter(x=>!('learning_priority' in x)||x.learning_priority==='yes').map(x=>x.transferable_skill==='Other'?(x.transferable_other||'Other'):x.transferable_skill).filter(Boolean);
  const parts=[];
  if(importedBackup.career_goals)parts.push(`<strong>Previous career reflection</strong><div>${escapeHtml(importedBackup.career_goals)}</div>`);
  if(research.length)parts.push(`<strong>Previous research-skill priorities</strong><div>${research.map(escapeHtml).join('; ')}</div>`);
  if(transferable.length)parts.push(`<strong>Previous transferable priorities</strong><div>${transferable.map(escapeHtml).join('; ')}</div>`);
  if(importedBackup.reproducibility_practice||importedBackup.reproducibility_status)parts.push(`<strong>Previous reproducibility reflection</strong><div>${escapeHtml([importedBackup.reproducibility_status,importedBackup.reproducibility_practice].filter(Boolean).join(' — '))}</div>`);
  if(importedBackup.data_management_practice||importedBackup.data_management_status)parts.push(`<strong>Previous research data management reflection</strong><div>${escapeHtml([importedBackup.data_management_status,importedBackup.data_management_practice].filter(Boolean).join(' — '))}</div>`);
  if(importedBackup.research_action_plan)parts.push(`<strong>Previous research actions</strong><div>${escapeHtml(importedBackup.research_action_plan)}</div>`);
  if(importedBackup.future_comments)parts.push(`<strong>Previous next-period priorities</strong><div>${escapeHtml(importedBackup.future_comments)}</div>`);
  box.innerHTML=parts.length?`<strong>Previous PCDP loaded</strong><div class="muted">Use this only as a reference. Your new review should describe what happened since then.</div>${parts.join('')}`:'<strong>Previous PCDP loaded.</strong>';
  box.classList.remove('hidden');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function rebuildRepeatSectionsForMode() {
  const research=collectRepeat('research',5), activities=collectRepeat('activity',5);
  document.getElementById('researchSkillsContainer').innerHTML='';
  researchSkillCount=0;
  (research.length?research:[{}]).forEach(addResearchSkill);
  document.getElementById('activitiesContainer').innerHTML='';
  activityCount=0;
  (activities.length?activities:[{}]).forEach(addActivity);
}

function updateModeUI() {
  const mode = getMode();
  const effectiveMode = mode || 'Initial';
  document.getElementById('updateImport').classList.toggle('hidden', mode !== 'Update');
  document.querySelectorAll('.update-only').forEach(el => el.classList.toggle('hidden', mode !== 'Update'));

  const cycle = document.getElementById('cycle');
  if (mode === 'Initial') cycle.value = 'Initial';
  if (mode === 'Update' && (!cycle.value || cycle.value === 'Initial')) cycle.value = importedBackup ? (nextCycle(importedBackup.pcdp_cycle || importedBackup.mode) || '6-month') : '6-month';

  document.getElementById('doctoralProgrammeLead').textContent = mode === 'Update'
    ? 'Review the information below and change it only if your university, programme or enrolment status has changed.'
    : 'Provide your current doctoral programme information.';

  document.getElementById('researchPlanLead').textContent = mode === 'Update'
    ? 'Focus on what has happened since your previous PCDP: progress, changes, difficulties and the priorities for the next six months.'
    : 'Describe your research starting point and the priorities for the coming period.';
  document.getElementById('researchOverviewLabel').textContent = mode === 'Update'
    ? 'Research project overview (carried forward; update only if the project scope has changed)'
    : 'Research project overview';
  document.getElementById('researchProgressLabel').textContent = mode === 'Update'
    ? 'Research progress, next objectives and key actions'
    : 'Short-term research objectives and plan';
  document.getElementById('difficultiesLabel').textContent = mode === 'Update'
    ? 'Significant difficulties encountered'
    : 'Significant difficulties and anticipated risks';
  document.getElementById('researchChangesLabel').textContent = 'Changes in research direction';

  const initialResearchHelp = {
    researchOverviewHelp: 'Briefly describe the scientific question, research context and overall approach of your doctoral project. Focus on the project itself, not a list of expected accomplishments.',
    researchProgressHelp: 'List your main objectives for the next six months, the experiments or analyses you plan to carry out, the key actions needed and expected milestones or outputs. Include key research actions here, not in a separate section.',
    difficultiesHelp: 'As this is your first PCDP, describe difficulties or risks you foresee (for example, delays with data or samples, technical optimisation, resources or time) and possible ways to address them. You do not need to have experienced them already.',
    researchChangesHelp: 'At this initial stage, note any changes already identified compared with the original doctoral project plan, and why. If there are none, you can write “No changes identified at this stage”.'
  };
  const updateResearchHelp = {
    researchOverviewHelp: 'Keep this project overview brief. Update it only if the aims or overall scope have changed since your previous PCDP.',
    researchProgressHelp: 'Summarise what you have achieved or progressed since your previous PCDP. Then describe the objectives, experiments or analyses, key actions and expected milestones for the next six months, including any unfinished objectives that continue.',
    difficultiesHelp: 'Describe significant difficulties actually encountered since the previous PCDP, how you dealt with them, and any outstanding risks or support required. If there were none, say so briefly.',
    researchChangesHelp: 'Explain any substantive change in research questions, methods, scope or direction since your previous PCDP, including the reasons and implications. If nothing changed, write “No substantive changes”.'
  };
  const researchHelp = mode === 'Update' ? updateResearchHelp : initialResearchHelp;
  for (const [id, guidance] of Object.entries(researchHelp)) document.getElementById(id).textContent = guidance;
  document.querySelector('[data-field="difficulties"]').placeholder = mode === 'Update'
    ? 'Difficulties encountered, how you responded and remaining risks'
    : 'Potential risks and possible ways to address them';
  document.querySelector('[data-field="research_progress"]').placeholder = mode === 'Update'
    ? 'Progress since last review; next objectives, actions and milestones'
    : 'Objectives, key actions, methods and expected milestones for the next six months';
  document.querySelector('[data-field="research_changes"]').placeholder = mode === 'Update'
    ? 'Changes since the last PCDP, if any, and reasons'
    : 'Changes to the original plan, if any, and their reasons';

  document.getElementById('careerGoalsLabel').textContent = mode === 'Update'
    ? 'What experiences during the last six months influenced your career thinking, and which options interest you now?'
    : 'What are your longer-term career goals or options you would like to explore?';
  document.getElementById('careerTrainingLabel').textContent = mode === 'Update'
    ? 'Which experiences or exposure would be most useful before the next PCDP review?'
    : 'Which experiences or exposure would help you explore or progress towards these goals?';

  document.getElementById('researchSkillsLead').textContent = mode === 'Update'
    ? 'First review your progress on the research skills from your previous PCDP. Then choose 1 to 3 priorities for the next six months, which may be new skills or ones you want to continue developing.'
    : 'Add the research skills most relevant to your current stage and mark 1 to 3 as learning priorities for the next six months.';
  document.getElementById('goodPracticeLead').textContent = mode === 'Update'
    ? 'These are expected research practices. Review what you have implemented or improved since your previous PCDP and identify anything that still needs attention.'
    : 'These are expected research practices rather than optional development priorities. Select the measures already in place and note anything you want to improve.';
  document.getElementById('reproducibilityLabel').textContent = mode === 'Update'
    ? 'What have you improved since your previous PCDP, and what still needs attention in relation to reproducibility?'
    : 'Anything you would like to improve or strengthen in relation to reproducibility?';
  document.getElementById('dataManagementLabel').textContent = mode === 'Update'
    ? 'What have you changed or improved since your previous PCDP, and what still needs attention in your research data and/or code management?'
    : 'Anything you would like to improve or strengthen in your research data and/or code management?';
  document.getElementById('transferableLead').textContent = mode === 'Update'
    ? 'Rate your current experience in each skill again. Compare it with your previous PCDP, then select 1 to 3 priorities and describe your next actions.'
    : 'Rate your current experience in every listed skill, then select 1 to 3 learning priorities and describe your next actions.';
  document.getElementById('activitiesLead').textContent = mode === 'Update'
    ? 'Add activities completed or started since your last PCDP, plus any important activities planned for the next six months.'
    : 'Add completed or planned activities that support your development.';
  document.getElementById('secondmentLegend').textContent = mode === 'Update'
    ? 'Do you have a secondment to report, update or plan?'
    : 'Do you already have a planned secondment?';
  document.getElementById('secondmentObjectivesLabel').textContent = mode === 'Update'
    ? 'What did you gain from the secondment, or what do you now expect to gain from it? How does it relate to your doctoral project?'
    : 'Objectives and relation to the doctoral project';

  if (lastRenderedMode !== effectiveMode) {
    rebuildRepeatSectionsForMode();
    renderTransferableAssessment();
    lastRenderedMode = effectiveMode;
  }
  updateTransferablePrevious();
  if (getMode() === 'Update' && importedBackup) renderPreviousResearchSkills();
  else document.getElementById('previousResearchSection')?.classList.add('hidden');
  renderPreviousSnapshot();
}

function showStep(index) {
  currentStep=Math.max(0,Math.min(index,steps.length-1));
  steps.forEach((s,i)=>s.classList.toggle('active',i===currentStep));
  document.getElementById('stepLabel').textContent=`Step ${currentStep+1} of ${steps.length}`;
  document.getElementById('stepTitle').textContent=steps[currentStep].dataset.title;
  document.getElementById('progressBar').style.width=`${((currentStep+1)/steps.length)*100}%`;
  document.getElementById('backBtn').style.visibility=currentStep===0?'hidden':'visible';
  document.getElementById('nextBtn').classList.toggle('hidden',currentStep===steps.length-1);
  if(steps[currentStep].dataset.title==='Development activities')renderTrainingRecommendations();
  // Final step now contains dissemination/communication reporting, not a review summary.
  window.scrollTo({top:0,behavior:'smooth'});
}

function visibleRequiredInvalid(step) {
  const required = [...step.querySelectorAll('[required]')].filter(el => !el.disabled && el.offsetParent !== null);
  for (const el of required) {
    if (!el.checkValidity()) { el.reportValidity(); return true; }
  }
  return false;
}

function validateCurrentStep() {
  const step=steps[currentStep]; if(visibleRequiredInvalid(step))return false;
  if(currentStep===0){ if(!getMode()){alert('Please select whether this is an initial PCDP or an update.');return false;} if(!document.getElementById('candidateConfirmed').checked){alert('Please confirm that your personal and project information is correct.');return false;} }
  if(step.dataset.title==='Research skills'){const n=countLearningPriorities('research');if(n<1||n>3){alert('Please select between 1 and 3 research-skill learning priorities.');return false;}}
  if(step.dataset.title==='Transferable skills'){
    const n=countLearningPriorities('transferable');
    if(n<1||n>3){ alert('Please select 1 to 3 transferable-skill learning priorities.'); return false; }
    for(const card of document.querySelectorAll('.assessment-row')){
      const level=card.querySelector('[data-assess="rating"]');
      const selected=card.querySelector('[data-assess="priority"]').checked;
      if(card.dataset.skill!=='Other' && !level.value){
        alert('Please rate every listed transferable skill. Choose N/A when it is not applicable.');
        level.focus(); return false;
      }
      if(selected && (level.value==='' || level.value==='NA')){
        alert('For a learning priority, choose a current level from 0 to 4. Use 0 if you have no experience yet.');
        level.focus(); return false;
      }
    }
  }
  if (window.PCDPReporting && !window.PCDPReporting.validateStep(step)) return false;
  return true;
}

function checkboxSet(name, options, selected=[]) {
  const set=new Set(Array.isArray(selected)?selected:[]);
  return `<div class="checkbox-grid compact-options option-set" data-option-set="${name}">${options.map(o=>`<label><input type="checkbox" value="${escapeHtml(o)}" ${set.has(o)?'checked':''}> ${escapeHtml(o)}</label>`).join('')}</div>`;
}
function bindSkillCard(card,type){
  const category=card.querySelector(`[data-array="${type}_skill"]`), otherWrap=card.querySelector('.skill-other-wrap'), priority=card.querySelector('[data-array="learning_priority"]'), details=card.querySelector('.priority-details');
  const updateOther=()=>{const show=category?.value==='Other';otherWrap?.classList.toggle('hidden',!show);const input=otherWrap?.querySelector('input');if(input)input.required=!!show;};
  const updatePriority=()=>{
    details?.classList.toggle('hidden',!priority?.checked);
    details?.querySelectorAll('[data-priority-required]').forEach(x => x.required=!!priority?.checked);
    refreshPriorityLabels();
  };
  category?.addEventListener('change',updateOther);priority?.addEventListener('change',updatePriority);updateOther();updatePriority();
}
function countLearningPriorities(type){
  if(type==='transferable') return document.querySelectorAll('.assessment-row [data-assess="priority"]:checked').length;
  return document.querySelectorAll('#researchSkillsContainer [data-array="learning_priority"]:checked').length;
}
function refreshPriorityLabels(){
  const r=countLearningPriorities('research'),t=countLearningPriorities('transferable');
  const rb=document.getElementById('addResearchSkill');
  if(rb)rb.textContent=`+ Add research skill (${r}/3 priorities selected)`;
  const note=document.getElementById('transferablePriorityCount');
  if(note) note.textContent=`${t} of 3 learning priorities selected.${t===0?' Select at least one.':''}`;
}

function addResearchSkill(data={}) {
  if(researchSkillCount>=5)return; researchSkillCount++; const i=researchSkillCount;
  const opts=researchSkillOptions.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join(''),exp=experienceOptions();
  const card=document.createElement('div');card.className='repeat-card';card.dataset.item='research';card.dataset.index=i;
  card.innerHTML=`<div class="repeat-head"><div class="repeat-title">Research skill ${i}</div><button type="button" class="remove-btn">Remove</button></div>
  <div class="field-grid three"><div class="field"><label>Research skill</label><select data-array="research_skill" required><option value="">Select</option>${opts}</select></div><div class="field"><label>Specific skill / focus</label><input type="text" data-array="research_specific" required placeholder="e.g. Bayesian models, confocal microscopy"></div><div class="field"><label>Current experience</label><select data-array="research_experience" required><option value="">Select</option>${exp}</select></div></div>
  <div class="field skill-other-wrap hidden"><label>Please specify the research skill</label><input type="text" data-array="research_other"></div>
  <label class="priority-toggle"><input type="checkbox" data-array="learning_priority"><span><strong>Learning priority for the next six months</strong><small>Tick only if you want to actively develop this skill now.</small></span></label>
  <div class="priority-details hidden"><div class="field"><label>What would you like to improve or develop over the next six months?</label><textarea rows="3" data-array="research_skill_plan" data-priority-required placeholder="State a clear and realistic learning objective."></textarea></div><div class="field"><label>What will you do to develop this skill?</label><textarea rows="3" data-array="research_skill_actions" data-priority-required placeholder="Describe concrete actions, activities or opportunities and when you plan to do them."></textarea></div><div class="field"><label>Preferred learning approach <span class="muted">Select all that apply.</span></label>${checkboxSet('research_learning_approach',learningApproaches,data.research_learning_approach)}</div><div class="field"><label>How will you recognise progress? <span class="muted">Select all that apply.</span></label>${checkboxSet('research_evidence',evidenceOptions,data.research_evidence)}</div><div class="field"><label>Support that would help <span class="muted">Select all that apply.</span></label>${checkboxSet('research_support',supportOptions,data.research_support)}</div></div>`;
  card.querySelector('.remove-btn').addEventListener('click',()=>{card.remove();renumberRepeat('research');});document.getElementById('researchSkillsContainer').appendChild(card);fillRepeatCard(card,data);bindSkillCard(card,'research');refreshRepeatButtons();refreshPriorityLabels();
}


function previousResearchSkillPriorities() {
  if (!importedBackup || !Array.isArray(importedBackup.research_skills)) return [];
  return importedBackup.research_skills.filter(item =>
    item && item.research_skill && (!('learning_priority' in item) || item.learning_priority === 'yes')
  ).slice(0, 5);
}

function renderPreviousResearchSkills() {
  const section = document.getElementById('previousResearchSection');
  const host = document.getElementById('previousResearchSkillsContainer');
  const prev = previousResearchSkillPriorities();
  if (!section || !host) return;
  if (getMode() !== 'Update' || !prev.length) {
    section.classList.add('hidden');
    if (!prev.length) host.replaceChildren();
    return;
  }
  // Preserve any notes already entered if the mode is toggled.
  const existing = collectPreviousResearchFollowUp();
  host.replaceChildren();
  prev.forEach((item, i) => {
    const record = existing[i] || {};
    const skill = item.research_skill === 'Other'
      ? (item.research_other || 'Other') : item.research_skill;
    const card = document.createElement('div');
    card.className = 'repeat-card previous-research-card';
    card.dataset.previousResearchIndex = String(i);
    card.innerHTML = `<div class="repeat-head"><div><div class="repeat-title">${i+1}. ${escapeHtml(skill)}</div>
      ${item.research_specific ? `<p class="field-hint">Focus: ${escapeHtml(item.research_specific)}</p>` : ''}</div></div>
      <div class="previous-reference">
      ${item.research_experience ? `<div><strong>Previous self-rating:</strong> ${escapeHtml(ratingLabel(item.research_experience))}</div>` : ''}
      ${item.research_skill_plan ? `<div><strong>Previous learning objective:</strong> ${escapeHtml(item.research_skill_plan)}</div>` : ''}
      ${item.research_skill_actions ? `<div><strong>Planned actions:</strong> ${escapeHtml(item.research_skill_actions)}</div>` : ''}
      </div>
      <div class="field"><label>What have you done since the previous PCDP? What progress, learning or difficulties have you experienced?</label>
      <textarea rows="3" data-prev-progress placeholder="Describe your actions and progress, even if the activity has not started yet."></textarea></div>
      <div class="field-grid two"><div class="field"><label>Current status</label>
      <select data-prev-status><option value="">Select</option><option>Completed</option><option>In progress</option><option>Not started</option><option>No longer relevant</option></select></div>
      <div class="field"><label>Current self-rating</label><select data-prev-rating><option value="">Select (optional)</option>${experienceOptions()}</select></div></div>`;
    card.querySelector('[data-prev-progress]').value = record.progress || '';
    card.querySelector('[data-prev-status]').value = record.status || '';
    card.querySelector('[data-prev-rating]').value = record.current_rating || '';
    host.appendChild(card);
  });
  section.classList.remove('hidden');
}

function collectPreviousResearchFollowUp() {
  const previous = previousResearchSkillPriorities();
  return [...document.querySelectorAll('#previousResearchSkillsContainer [data-previous-research-index]')].map(card => {
    const item = previous[Number(card.dataset.previousResearchIndex)] || {};
    return {
      research_skill: item.research_skill || '',
      research_other: item.research_other || '',
      research_specific: item.research_specific || '',
      previous_rating: item.research_experience || '',
      previous_objective: item.research_skill_plan || '',
      previous_actions: item.research_skill_actions || '',
      progress: card.querySelector('[data-prev-progress]')?.value.trim() || '',
      status: card.querySelector('[data-prev-status]')?.value || '',
      current_rating: card.querySelector('[data-prev-rating]')?.value || ''
    };
  });
}

function renderTransferableAssessment() {
  const container=document.getElementById('transferableContainer');
  container.innerHTML='';
  let index=0;
  researchCompAreas.forEach(area => {
    const group=document.createElement('section');
    group.className='assessment-area';
    const heading=document.createElement('h3');
    heading.className='assessment-area-heading';
    heading.textContent=area.name;
    group.appendChild(heading);
    const groupHint=document.createElement('p');
    groupHint.className='field-hint';
    groupHint.textContent=`ResearchComp area: ${area.name}. Rate each competence and tick a learning priority only where you plan specific development.`;
    group.appendChild(groupHint);
    container.appendChild(group);
    area.competencies.forEach(item => {
      const skill=item.name;
      const card=document.createElement('div');
      card.className='assessment-row';
      card.dataset.skill=skill;
      card.dataset.area=area.name;
      card.dataset.skillId=skillKey(skill);
      const opts=experienceOptions();
      card.innerHTML=`<div class="assessment-row-top">
        <div class="assessment-competence"><strong class="assessment-name">${escapeHtml(skill)}</strong>
          <p class="assessment-hint">${escapeHtml(item.hint)}</p></div>
        <div class="assessment-rate"><label for="level-${index}">Current level</label>
          <select id="level-${index}" data-assess="rating" aria-label="Current level for ${escapeHtml(skill)}">
            <option value="">Select</option>${opts}</select></div>
        <label class="assessment-priority"><input type="checkbox" data-assess="priority" /> Learning priority</label>
      </div>
      <div class="assessment-previous hidden" data-assess="previous"></div>
      <div class="assessment-details hidden">
        <div class="field"><label>Specific focus</label><input type="text" data-assess="specific" data-priority-required placeholder="What particular aspect of this competence do you want to develop?"></div>
        ${getMode()==='Update'?'<div class="field"><label>What have you done or improved since the last PCDP?</label><textarea rows="3" data-assess="progress" placeholder="Mention concrete experience, feedback or changes."></textarea></div><div class="field"><label>How would you like to continue developing this competence?</label><select data-assess="status"><option value="">Select</option><option>Continue developing it</option><option>Increase the level / challenge</option><option>Apply it in a new context</option><option>Change the focus</option><option>Revisit a previous learning goal</option></select></div>':''}
        <div class="field"><label>Learning objective for the next six months</label><textarea rows="3" data-assess="plan" data-priority-required placeholder="What exactly would you like to improve or learn?"></textarea></div>
        <div class="field"><label>Concrete actions for the next six months</label><textarea rows="3" data-assess="actions" data-priority-required placeholder="What will you do? Include an activity, an opportunity to practise and/or a realistic timeframe."></textarea></div>
        <div class="field"><label>Preferred learning approach <span class="muted">Select all that apply.</span></label>${checkboxSet('transferable_learning_approach',learningApproaches)}</div>
        <div class="field"><label>How will you know you have progressed? <span class="muted">Select all that apply.</span></label>${checkboxSet('transferable_evidence',evidenceOptions)}</div>
        <div class="field"><label>Support that would help <span class="muted">Select all that apply.</span></label>${checkboxSet('transferable_support',supportOptions)}</div>
      </div>`;
      group.appendChild(card);
      const checkbox=card.querySelector('[data-assess="priority"]');
      const level=card.querySelector('[data-assess="rating"]');
      function display(){
        const open=checkbox.checked;
        card.classList.toggle('active-priority',open);
        card.querySelector('.assessment-details').classList.toggle('hidden',!open);
        card.querySelectorAll('[data-priority-required]').forEach(x=>x.required=open);
        level.setCustomValidity(open&&level.value==='NA'?'Choose 0 if you have no experience yet.':'');
        refreshPriorityLabels();
      }
      checkbox.addEventListener('change',()=>{
        if(checkbox.checked && countLearningPriorities('transferable')>3){
          checkbox.checked=false;
          const msg=document.getElementById('transferableValidation');
          msg.textContent='Choose no more than three transferable-skill learning priorities.';
          msg.classList.remove('hidden');
        } else document.getElementById('transferableValidation').classList.add('hidden');
        display();
      });
      level.addEventListener('change',display);
      display();
      index++;
    });
  });
  updateTransferablePrevious();
}

function previousTransferableFor(skill) {
  if(!importedBackup) return null;
  const assessments=importedBackup.transferable_assessment||[];
  const fromAssessment=assessments.find(item=>item.skill_id===skillKey(skill)||item.skill===skill);
  if(fromAssessment) return fromAssessment;
  const items=importedBackup.transferable_skills||[];
  const found=items.find(item=>item.transferable_skill===skill);
  if(!found) return null;
  return {rating:ratingCode(found.transferable_experience), priority:found.learning_priority==='yes',
    objective:found.transferable_plan||'', actions:found.transferable_actions||''};
}
function updateTransferablePrevious(){
  const isUpdate=getMode()==='Update';
  document.querySelectorAll('.assessment-row').forEach(card=>{
    const item=previousTransferableFor(card.dataset.skill);
    const box=card.querySelector('[data-assess="previous"]');
    box.classList.toggle('hidden',!isUpdate||!item);
    if(!isUpdate||!item){box.textContent='';return;}
    const rating=item.rating??item.transferable_experience??'';
    box.textContent=`Previous PCDP: ${ratingLabel(rating)}${item.priority?' | Learning priority':''}${item.objective?' | Previous objective: '+item.objective:''}${item.actions?' | Previous actions: '+item.actions:''}`;
  });
}
function collectTransferableAssessment() {
  return [...document.querySelectorAll('.assessment-row')].map(card=>{
    const val=card.querySelector('[data-assess="rating"]').value;
    const priority=card.querySelector('[data-assess="priority"]').checked;
    const read=k=>card.querySelector(`[data-assess="${k}"]`)?.value?.trim?.()||'';
    const choices=k=>[...card.querySelectorAll(`[data-option-set="${k}"] input:checked`)].map(x=>x.value);
    const prev=previousTransferableFor(card.dataset.skill);
    const prevVal=prev?.rating??prev?.transferable_experience??'';
    return {skill_id:card.dataset.skillId,skill:card.dataset.skill,area:card.dataset.area||'',
      rating:val==='NA'?'NA':val===''?null:Number(val),
      score:val===''||val==='NA'?null:Number(val),not_applicable:val==='NA',
      priority, specific_focus:priority?read('specific'):'',
      other_skill:card.dataset.skill==='Other'&&priority?read('other'):'',
      objective:priority?read('plan'):'', actions:priority?read('actions'):'',
      update_progress:priority?read('progress'):'', status:priority?read('status'):'',
      learning_approach:priority?choices('transferable_learning_approach'):[],
      evidence:priority?choices('transferable_evidence'):[],
      support:priority?choices('transferable_support'):[],
      previous_rating:prevVal===''?null:(ratingCode(prevVal)==='NA'?'NA':Number(ratingCode(prevVal))),
      previous_priority:Boolean(prev?.priority)
    };
  });
}
function collectTransferablePriorities(){
  return collectTransferableAssessment().filter(x=>x.priority).map(x=>({
    transferable_skill:x.skill,transferable_other:x.other_skill,
    transferable_specific:x.specific_focus,transferable_experience:String(x.rating),
    transferable_plan:x.objective,transferable_actions:x.actions,
    transferable_update_progress:x.update_progress,transferable_status:x.status,
    transferable_learning_approach:x.learning_approach,transferable_evidence:x.evidence,
    transferable_support:x.support,learning_priority:'yes'
  }));
}

function addActivity(data = {}) {
  if (activityCount >= 5) return;
  activityCount++;
  const i = activityCount;
  const isUpdate = getMode() === 'Update';
  const card = document.createElement('div'); card.className = 'repeat-card'; card.dataset.item = 'activity'; card.dataset.index = i;
  card.innerHTML = `<div class="repeat-head"><div class="repeat-title">Activity ${i}</div><button type="button" class="remove-btn">Remove</button></div>
    <div class="field-grid two"><div class="field"><label>Activity / module / course</label><input type="text" data-array="activity"></div><div class="field"><label>Status</label><select data-array="activity_status"><option value="">Select</option><option>Completed</option><option>Ongoing</option><option>Planned</option></select></div></div>
    <div class="field-grid two"><div class="field"><label>Date / period</label><input type="text" data-array="activity_date"></div><div class="field"><label>${isUpdate ? 'What did you gain from it, or which development objective does it support?' : 'Development purpose'}</label><input type="text" data-array="activity_purpose" placeholder="Skill or objective supported"></div></div>`;
  card.querySelector('.remove-btn').addEventListener('click', () => { card.remove(); renumberRepeat('activity'); });
  document.getElementById('activitiesContainer').appendChild(card);
  fillRepeatCard(card, data);
  refreshRepeatButtons();
}

function fillRepeatCard(card,data){
  card.querySelectorAll('[data-array]').forEach(el=>{const key=el.dataset.array;if(!(key in data))return;if(el.type==='checkbox')el.checked=data[key]===true||data[key]==='yes'||data[key]==='on';else el.value=data[key]??'';});
  card.querySelectorAll('[data-option-set]').forEach(set=>{const vals=Array.isArray(data[set.dataset.optionSet])?data[set.dataset.optionSet]:[];set.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=vals.includes(cb.value));});
}

function renumberRepeat(type) {
  const container = document.getElementById(type === 'research' ? 'researchSkillsContainer' : type === 'transferable' ? 'transferableContainer' : 'activitiesContainer');
  const cards = [...container.querySelectorAll('.repeat-card')];
  cards.forEach((c,idx) => { c.dataset.index = idx + 1; c.querySelector('.repeat-title').textContent = `${type === 'research' ? 'Research skill' : type === 'transferable' ? 'Priority' : 'Activity'} ${idx + 1}`; });
  if (type === 'research') researchSkillCount = cards.length;
  if (type === 'activity') activityCount = cards.length;
  refreshRepeatButtons();
}

function refreshRepeatButtons(){document.getElementById('addResearchSkill').disabled=researchSkillCount>=5;document.getElementById('addActivity').disabled=activityCount>=5;refreshPriorityLabels();}

function collectRepeat(type,max){const c=document.getElementById(type==='research'?'researchSkillsContainer':'activitiesContainer');return [...c.querySelectorAll('.repeat-card')].slice(0,max).map(card=>{const item={};card.querySelectorAll('[data-array]').forEach(el=>item[el.dataset.array]=el.type==='checkbox'?(el.checked?'yes':''):(el.value?.trim?.()??el.value??''));card.querySelectorAll('[data-option-set]').forEach(set=>item[set.dataset.optionSet]=[...set.querySelectorAll('input:checked')].map(cb=>cb.value));return item;});}

function collectFormData(){
  const data={};document.querySelectorAll('[data-field]').forEach(el=>data[el.dataset.field]=el.value?.trim?.()??el.value??'');data.mode=getMode();data.network=getNetwork();data.candidate={full_name:data.candidate_name||'',project_title:data.project_title||'',host_institution:data.host_institution||'',main_supervisor:data.main_supervisor||'',co_supervisor:data.co_supervisor||''};
  data.career_options=[...document.querySelectorAll('#careerOptions input:checked')].map(x=>x.value);data.career_experience_types=[...document.querySelectorAll('#careerExperienceTypes input:checked')].map(x=>x.value);data.reproducibility_measures=[...document.querySelectorAll('#reproducibilityMeasures input:checked')].map(x=>x.value);data.data_management_measures=[...document.querySelectorAll('#dataManagementMeasures input:checked')].map(x=>x.value);
  data.research_skills=collectRepeat('research',5);data.research_follow_up=getMode()==='Update'?collectPreviousResearchFollowUp():[];data.transferable_assessment=collectTransferableAssessment();data.transferable_skills=collectTransferablePriorities();data.assessment_scale='CARDEA-adapted 0-4 (self-report)';data.assessment_scale_levels={'NA':'Not applicable','0':'No knowledge or experience','1':'Foundational','2':'Intermediate','3':'Advanced','4':'Expert'};data.schema_version=4;data.sharepoint_documents_confirmed=document.getElementById('sharePointConfirmed').checked; Object.assign(data, window.PCDPReporting?.collect()||{});data.activities=collectRepeat('activity',5);data.has_secondment=document.querySelector('input[name="hasSecondment"]:checked')?.value||'no';return data;
}

function buildTemplateData(raw){
  const c=raw.candidate||{};const out={candidate_name:c.full_name||'',host_institution:c.host_institution||'',project_title:c.project_title||'',main_supervisor:c.main_supervisor||'',co_supervisor:c.co_supervisor||'',pcdp_review_date:formatDate(raw.pcdp_review_date),pcdp_cycle:raw.pcdp_cycle||raw.mode||'',next_review:formatDate(raw.next_review),university_name:raw.university_name||'',doctoral_programme:raw.doctoral_programme||'',enrollment_date:formatDate(raw.enrollment_date),expected_enrollment_date:formatDate(raw.expected_enrollment_date),contract_start_date:formatDate(raw.contract_start_date),contract_end_date:formatDate(raw.contract_end_date),sharepoint_confirmation:raw.sharepoint_documents_confirmed?'Confirmed for this PCDP review':'Not confirmed',research_overview:raw.research_overview||'',research_progress:raw.research_progress||'',difficulties:raw.difficulties|| (raw.mode==='Initial' ? 'No significant risks identified at this stage.' : 'No significant difficulties encountered.'),research_changes:raw.research_changes||'No substantive changes.',
  career_goals:[raw.career_options?.length?`Current career interests: ${raw.career_options.map(x=>x==='Other'&&raw.career_other?raw.career_other:x).join('; ')}`:'',raw.mode==='Update'&&raw.career_change_status?`Change since previous PCDP: ${raw.career_change_status}`:'',raw.career_goals||''].filter(Boolean).join('\n\n'),career_training_needed:[raw.career_experience_types?.length?`Preferred experiences: ${raw.career_experience_types.map(x=>x==='Other'&&raw.career_experience_other?raw.career_experience_other:x).join('; ')}`:'',raw.career_training_needed||''].filter(Boolean).join('\n\n'),
  reproducibility_status:raw.reproducibility_status||'',reproducibility_practice:[raw.reproducibility_measures?.length?`Measures in place: ${raw.reproducibility_measures.map(x=>x==='Other'&&raw.reproducibility_other?raw.reproducibility_other:x).join('; ')}`:'',raw.reproducibility_practice||''].filter(Boolean).join('\n\n'),data_management_status:raw.data_management_status||'',data_management_practice:[raw.data_management_measures?.length?`Measures in place: ${raw.data_management_measures.map(x=>x==='Other'&&raw.data_management_other?raw.data_management_other:x).join('; ')}`:'',raw.data_management_practice||''].filter(Boolean).join('\n\n'),professional_progress_summary:raw.professional_progress_summary||'',future_comments:raw.future_comments||'',supervisor_discussion:raw.supervisor_discussion||'',candidate_signature_date:formatDate(raw.candidate_signature_date||raw.pcdp_review_date),secondment_host:'',secondment_supervisor:'',secondment_duration:'',secondment_start:'',secondment_objectives:'',secondment_research_skills:'',secondment_transferable_skills:''};
  if(raw.has_secondment==='yes'){['secondment_host','secondment_supervisor','secondment_duration','secondment_start','secondment_research_skills','secondment_transferable_skills'].forEach(k=>out[k]=raw[k]||'');out.secondment_objectives=raw.mode==='Update'&&raw.secondment_status?`Current status: ${raw.secondment_status}.\n\n${raw.secondment_objectives||''}`:(raw.secondment_objectives||'');}else{out.secondment_host=out.secondment_supervisor=out.secondment_duration=out.secondment_start='Not yet planned';out.secondment_objectives=out.secondment_research_skills=out.secondment_transferable_skills='To be updated in a future PCDP review.';}
  const followUp = raw.research_follow_up || [];
  out.previous_research_follow_up = raw.mode !== 'Update'
    ? 'Not applicable (first PCDP).'
    : followUp.length ? followUp.map((x,i) => {
        const skill=x.research_skill==='Other'?(x.research_other||'Other'):(x.research_skill||'');
        return [`${i+1}. ${skill}${x.research_specific?' ('+x.research_specific+')':''}`,
          x.previous_objective?`Previous objective: ${x.previous_objective}`:'',
          x.previous_actions?`Planned actions: ${x.previous_actions}`:'',
          x.previous_rating?`Previous rating: ${ratingLabel(x.previous_rating)}`:'',
          `Progress since last review: ${x.progress||'Not recorded'}`,
          x.status?`Status: ${x.status}`:'',
          x.current_rating?`Current rating: ${ratingLabel(x.current_rating)}`:''
        ].filter(Boolean).join('\n');
      }).join('\n\n') : 'No previous research-skill priorities were found in the imported PCDP.';
  const research=(raw.research_skills||[]).filter(x=>x.learning_priority==='yes').slice(0,3),transfer=(raw.transferable_skills||[]).filter(x=>x.learning_priority==='yes').slice(0,3);
  for(let i=1;i<=3;i++){const r=research[i-1]||{},rn=r.research_skill==='Other'&&r.research_other?r.research_other:(r.research_skill||'');out[`research_skill_${i}`]=[rn,r.research_specific].filter(Boolean).join(' — ');out[`research_skill_progress_${i}`]=[r.research_experience?`Self-rated level: ${ratingLabel(r.research_experience)}`:'',r.research_update_progress||''].filter(Boolean).join('\n\n');out[`research_skill_plan_${i}`]=r.research_skill_plan||'';out[`research_skill_implementation_${i}`]=[r.research_skill_actions?`Concrete actions: ${r.research_skill_actions}`:'',r.research_learning_approach?.length?`Learning approach: ${r.research_learning_approach.join('; ')}`:'',r.research_support?.length?`Support: ${r.research_support.join('; ')}`:'',r.research_evidence?.length?`Evidence: ${r.research_evidence.join('; ')}`:''].filter(Boolean).join('\n');const t=transfer[i-1]||{},tn=t.transferable_skill==='Other'&&t.transferable_other?t.transferable_other:(t.transferable_skill||'');out[`transferable_skill_${i}`]=[tn,t.transferable_specific].filter(Boolean).join(' — ');out[`transferable_progress_${i}`]=[t.transferable_experience?`Self-rated level: ${ratingLabel(t.transferable_experience)}`:'',t.transferable_update_progress||''].filter(Boolean).join('\n\n');out[`transferable_plan_${i}`]=t.transferable_plan||'';out[`transferable_implementation_${i}`]=[t.transferable_actions?`Concrete actions: ${t.transferable_actions}`:'',t.transferable_learning_approach?.length?`Learning approach: ${t.transferable_learning_approach.join('; ')}`:'',t.transferable_support?.length?`Support: ${t.transferable_support.join('; ')}`:''].filter(Boolean).join('\n');out[`transferable_evidence_${i}`]=t.transferable_evidence?.join('; ')||'';}
  for(let i=1;i<=transferableOptions.length;i++){const a=raw.transferable_assessment?.[i-1]||{};out[`assessment_area_${i}`]=a.area||'';out[`assessment_skill_${i}`]=a.skill||'';out[`assessment_rating_${i}`]=a.rating==='NA'?'N/A':a.rating==null?'':`${a.rating} - ${experienceNames[String(a.rating)]?.replace(/^\d+ - /,'')||''}`;out[`assessment_priority_${i}`]=a.priority?'Yes':'No';}
  for(let i=1;i<=5;i++){const a=raw.activities[i-1]||{};out[`activity_${i}`]=a.activity||'';out[`activity_status_${i}`]=a.activity_status||'';out[`activity_date_${i}`]=a.activity_date||'';out[`activity_purpose_${i}`]=a.activity_purpose||'';}
  Object.assign(out, window.PCDPReporting?.formatDocx(raw)||{});
  return out;
}

function renderReview() {
  const raw = collectFormData();
  const summary = document.getElementById('reviewSummary');
  if(!summary)return;
  summary.innerHTML = '';
  const items = [
    ['Candidate', raw.candidate ? `${raw.candidate.full_name}, ${raw.candidate.host_institution}` : 'Not identified'],
    ['Research plan', raw.research_progress || 'Not completed'],
    ['Research-skill learning priorities', (raw.research_skills||[]).filter(x=>x.learning_priority==='yes').map(x=>x.research_skill==='Other'?(x.research_other||'Other'):x.research_skill).join('; ')||'Not selected'],
    ['Transferable-skill learning priorities', (raw.transferable_skills||[]).filter(x=>x.learning_priority==='yes').map(x=>x.transferable_skill==='Other'?(x.transferable_other||'Other'):x.transferable_skill).join('; ')||'Not selected'],
    ['Career objectives', raw.career_goals || 'Not completed'],
    ['Research skills', raw.research_skills.map(x => x.research_skill).filter(Boolean).join('; ') || 'None added'],
    ['Reproducibility', raw.reproducibility_status ? `${raw.reproducibility_status}: ${raw.reproducibility_practice || 'No details added'}` : 'Not completed'],
    ['Research data management', raw.data_management_status ? `${raw.data_management_status}: ${raw.data_management_practice || 'No details added'}` : 'Not completed'],
    ['Transferable skills self-assessment', `${raw.transferable_assessment.filter(x => x.rating !== null).length} of ${transferableOptions.length} categories rated`],
    ['Secondment', raw.has_secondment === 'yes' ? (raw.secondment_host || 'Planned, details pending') : 'Not yet planned']
  ];
  items.forEach(([label,value]) => {
    const div = document.createElement('div'); div.className = 'review-item';
    const strong = document.createElement('strong'); strong.textContent = label;
    const p = document.createElement('p'); p.textContent = value;
    div.append(strong,p); summary.appendChild(div);
  });
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlTextWithBreaks(value) {
  const escaped = xmlEscape(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return escaped.split('\n').join('</w:t><w:br/><w:t xml:space="preserve">');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderDocxTemplate(arrayBuffer, templateData) {
  if (typeof JSZip === 'undefined') throw new Error('The document-generation library did not load.');
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFiles = Object.keys(zip.files).filter(name => /^word\/.+\.xml$/.test(name) && !zip.files[name].dir);
  for (const name of xmlFiles) {
    let xml = await zip.file(name).async('string');
    for (const [key, value] of Object.entries(templateData)) {
      const tag = `{${key}}`;
      if (xml.includes(tag)) xml = xml.split(tag).join(xmlTextWithBreaks(value));
    }
    zip.file(name, xml);
  }
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE'
  });
}

async function buildPcdpDocx() {
  const raw = collectFormData();
  const templateData = buildTemplateData(raw);
  const templatePath = './templates/PCDP_ProtAIomics_web_template.docx';
  const response = await fetch(templatePath, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the PCDP template (HTTP ${response.status}).`);
  const content = await response.arrayBuffer();
  const blob = await renderDocxTemplate(content, templateData);
  const filename = `${raw.network}_PCDP_${safeFilename(raw.candidate.full_name)}_${raw.pcdp_cycle || raw.mode}.docx`;
  return { raw, blob, filename };
}

async function generatePackage() {
  if (window.PCDPReporting && !window.PCDPReporting.validateStep(steps[steps.length-1])) return;
  if(!document.getElementById('finalConfirm').checked) return;
  const msg = document.getElementById('generateMessage');
  msg.className='message'; msg.textContent='Preparing your PCDP package…';
  try {
    if (typeof JSZip === 'undefined') throw new Error('The download library did not load.');
    const { raw, blob: docxBlob, filename: docxFilename } = await buildPcdpDocx();
    const exportedAt = new Date().toISOString();
    const backup = { version: 4, exported_at: exportedAt, data: raw };
    const candidateName = safeFilename(raw.candidate?.full_name || 'candidate');
    const cycle = safeFilename(raw.pcdp_cycle || raw.mode || 'PCDP');
    const jsonFilename = `${raw.network || 'ProtAIomics'}_PCDP_${candidateName}_${cycle}_backup.json`;
    const packageFilename = `${raw.network || 'ProtAIomics'}_PCDP_${candidateName}_${cycle}_package.zip`;

    const packageZip = new JSZip();
    packageZip.file(docxFilename, await docxBlob.arrayBuffer());
    packageZip.file(jsonFilename, JSON.stringify(backup, null, 2));
    const packageBlob = await packageZip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE'
    });
    downloadBlob(packageBlob, packageFilename);
    msg.classList.add('success');
    msg.textContent = 'Package downloaded. It contains your Word PCDP and the JSON backup for your next review.';
  } catch (error) {
    console.error(error);
    msg.classList.add('error');
    msg.textContent = `Could not generate the PCDP package: ${error?.message || 'unknown error'}`;
  }
}

async function importBackup(file) {
  const msg = document.getElementById('backupMessage');
  try {
    const parsed = JSON.parse(await file.text());
    importedBackup = parsed.data || parsed;
    if (importedBackup.network && importedBackup.network !== 'ProtAIomics') {
      throw new Error('This backup belongs to a different Doctoral Network.');
    }
    importedBackup.network = 'ProtAIomics';
    applyUpdateBackup(importedBackup);
    updateTheme();
    updateModeUI();
    renderPreviousSnapshot();
    msg.className='message success';
    msg.textContent='Previous PCDP loaded. Review your previous research-skill priorities in the follow-up section, then select new priorities for the next six months. Identity and stable information were carried forward.';
  } catch (error) {
    importedBackup = null;
    msg.className='message error';
    msg.textContent = error?.message || 'This backup file could not be read.';
  }
}

function applyUpdateBackup(data){
  if(!data)return;if(data.candidate){const map={candidate_name:data.candidate.full_name,project_title:data.candidate.project_title,host_institution:data.candidate.host_institution,main_supervisor:data.candidate.main_supervisor,co_supervisor:data.candidate.co_supervisor};Object.entries(map).forEach(([k,v])=>{const el=field(k);if(el&&v!=null)el.value=v;});}
  ['university_name','doctoral_programme','enrollment_date','expected_enrollment_date','contract_start_date','contract_end_date','research_overview'].forEach(k=>{const el=field(k);if(el&&data[k]!=null)el.value=data[k];});const newCycle=nextCycle(data.pcdp_cycle||data.mode);if(newCycle)field('pcdp_cycle').value=newCycle;
  if (data.next_review) field('pcdp_review_date').value = data.next_review;
  updateNextReviewDate();
  document.getElementById('sharePointConfirmed').checked=false;
  ['research_progress','difficulties','research_changes','career_goals','career_training_needed','career_change_status','reproducibility_status','reproducibility_practice','reproducibility_other','data_management_status','data_management_practice','data_management_other','professional_progress_summary','future_comments','supervisor_discussion'].forEach(k=>{const el=field(k);if(el)el.value='';});
  document.querySelectorAll('#careerOptions input').forEach(cb=>cb.checked=(data.career_options||[]).includes(cb.value));if(field('career_other'))field('career_other').value=data.career_other||'';document.querySelectorAll('#careerExperienceTypes input,#reproducibilityMeasures input,#dataManagementMeasures input').forEach(cb=>cb.checked=false);bindOtherTriggers(document);
  // Previous priorities are shown separately as read-only references with fresh follow-up fields.
  // The new six-month plan starts empty and can contain completely different skills.
  document.getElementById('researchSkillsContainer').innerHTML='';
  researchSkillCount=0;
  addResearchSkill();
  // Do not carry progress text from a previously imported backup into a different student.
  document.getElementById('previousResearchSkillsContainer').replaceChildren();
  renderPreviousResearchSkills();
  updateTransferablePrevious();
  document.getElementById('activitiesContainer').innerHTML='';activityCount=0;addActivity();if(data.has_secondment==='yes'){document.querySelector('input[name="hasSecondment"][value="yes"]').checked=true;['secondment_host','secondment_supervisor','secondment_duration','secondment_start','secondment_objectives','secondment_research_skills','secondment_transferable_skills'].forEach(k=>{const el=field(k);if(el&&data[k]!=null)el.value=data[k];});}else document.querySelector('input[name="hasSecondment"][value="no"]').checked=true;field('secondment_status').value='';toggleSecondment();
}

function selectedSkillTags(){const tags=new Set();collectRepeat('research',5).filter(x=>x.learning_priority==='yes').forEach(x=>tags.add(x.research_skill==='Other'?x.research_other:x.research_skill));collectTransferablePriorities().filter(x=>x.learning_priority==='yes').forEach(x=>tags.add(x.transferable_skill==='Other'?x.transferable_other:x.transferable_skill));const rdm=field('data_management_status')?.value;if(rdm&&rdm!=='Yes'&&rdm!=='Not applicable')tags.add('Research data management');if((field('data_management_practice')?.value||'').trim())tags.add('Research data management');return[...tags].filter(Boolean);}
function renderTrainingRecommendations(){const host=document.getElementById('trainingRecommendations');if(!host)return;const tags=selectedSkillTags();const scored=trainingCatalog.map(c=>({...c,score:c.tags.filter(t=>tags.some(s=>s&&(s===t||s.includes(t)||t.includes(s)))).length})).sort((a,b)=>b.score-a.score);const picks=(scored.some(x=>x.score>0)?scored.filter(x=>x.score>0):scored).slice(0,4);host.innerHTML=picks.map(c=>`<article class="course-card"><div class="course-meta">${escapeHtml(c.provider)} · Free · ${escapeHtml(c.duration)}</div><h4>${escapeHtml(c.title)}</h4><div class="course-tags">${c.tags.map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div><div class="course-actions"><a href="${c.url}" target="_blank" rel="noopener">View course</a><button type="button" class="button secondary small add-course" data-course-id="${c.id}">Add to my plan</button></div></article>`).join('');host.querySelectorAll('.add-course').forEach(btn=>btn.addEventListener('click',()=>{const c=trainingCatalog.find(x=>x.id===btn.dataset.courseId);if(!c)return;addActivity({activity:c.title,activity_status:'Planned',activity_date:'',activity_purpose:`Free online course from ${c.provider}; supports: ${c.tags.join(', ')}`});btn.textContent='Added';btn.disabled=true;}));}
function bindOtherTriggers(root=document){root.querySelectorAll('.other-trigger').forEach(cb=>{const update=()=>document.getElementById(cb.dataset.otherTarget)?.classList.toggle('hidden',!cb.checked);if(cb.dataset.boundOther!=='1'){cb.dataset.boundOther='1';cb.addEventListener('change',update);}update();});}

function toggleSecondment() {
  const has = document.querySelector('input[name="hasSecondment"]:checked')?.value === 'yes';
  document.getElementById('secondmentFields').classList.toggle('hidden', !has);
}

function init() {
  window.PCDPReporting?.init();
  addResearchSkill(); addActivity();
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('reviewDate').value = today;
  document.getElementById('reviewDate').addEventListener('change', updateNextReviewDate);
  document.getElementById('reviewDate').addEventListener('input', updateNextReviewDate);
  field('candidate_signature_date').value = today;

  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', updateModeUI));
  document.getElementById('backupFile').addEventListener('change', e => e.target.files[0] && importBackup(e.target.files[0]));
  document.getElementById('addResearchSkill').addEventListener('click', () => addResearchSkill());
  document.getElementById('addActivity').addEventListener('click', () => addActivity());
  document.querySelectorAll('input[name="hasSecondment"]').forEach(r => r.addEventListener('change', toggleSecondment));
  document.getElementById('backBtn').addEventListener('click', () => showStep(currentStep - 1));
  document.getElementById('nextBtn').addEventListener('click', () => { if (validateCurrentStep()) showStep(currentStep + 1); });
  document.getElementById('finalConfirm').addEventListener('change', e => document.getElementById('generateBtn').disabled = !e.target.checked);
  document.getElementById('generateBtn').addEventListener('click', generatePackage);
  document.getElementById('refreshRecommendations')?.addEventListener('click', renderTrainingRecommendations);
  bindOtherTriggers(document);
  showStep(0); updateTheme(); updateModeUI(); toggleSecondment(); updateNextReviewDate();
}

init();
