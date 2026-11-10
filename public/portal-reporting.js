/* Reporting support for the PCDP. No portal submission is made by this tool.
   Field requirements based on ProtAIomics manager's EU Funding & Tenders Portal screenshots (Nov 2026). */
window.PCDPReporting = (() => {
  'use strict';
  const MAX_ITEMS = 25;
  const cfg = {
    publications:{radio:'hasPublications',panel:'publicationsPanel',list:'publicationsList',add:'addPublication',title:'Publication'},
    outputs:{radio:'hasOutputs',panel:'outputsPanel',list:'outputsList',add:'addOutput',title:'Research output'},
    dissemination:{radio:'hasDissemination',panel:'disseminationPanel',list:'disseminationList',add:'addDissemination',title:'Dissemination / conference activity'},
    communication:{radio:'hasCommunication',panel:'communicationPanel',list:'communicationList',add:'addCommunication',title:'Communication activity'}
  };
  const audiences = [
    'Industry / business partners','Innovators','Investors','EU institutions',
    'National authorities','Regional authorities','Local authorities','Civil society',
    'Citizens','Research communities','Specific end-user communities',
    'International organisations (UN, OECD, etc.)','Other'
  ];
  const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const f = (name,label,opts={}) => {
    const {type='text',required=false,placeholder='',options=null,maxlength=null}=opts;
    const mark=required?'<span class="required-symbol">*</span>':'';
    const attr=`data-report-field="${name}" ${required?'required':''} ${maxlength?`maxlength="${maxlength}"`:''}`;
    const control=options
      ? `<select ${attr}><option value="">Select</option>${options.map(opt=>`<option value="${esc(opt)}">${esc(opt)}</option>`).join('')}</select>`
      :type==='textarea' ? `<textarea rows="3" ${attr} placeholder="${esc(placeholder)}"></textarea>`
      :`<input type="${type}" ${attr} placeholder="${esc(placeholder)}"/>`;
    return `<div class="field"><label>${esc(label)} ${mark}${control}</label></div>`;
  };
  function audienceMarkup(){
    return `<div class="field audience-select"><div class="report-label">Who? Target audience reached <span class="required-symbol">*</span></div><p class="field-hint">Select one or more target audiences.</p><div class="checkbox-grid compact-options report-audience">${audiences.map(x=>`<label><input type="checkbox" data-report-audience="${esc(x)}"/>${esc(x)}</label>`).join('')}</div></div>`;
  }
  function publicationFields(){
    return `<p class="field-hint">Only fields with * are mandatory in the portal screenshot. Author role and optional identifiers are useful for internal monitoring.</p>
    <div class="field-grid two">${f('title','Title of the scientific publication',{required:true})}${f('author_role','Your author contribution',{options:['First author','Co-first author','Co-author / participating author','Corresponding author','Other']})}</div>
    <div class="field-grid two">${f('pid_type','Type of PID (repository)',{required:true,options:['DOI','Handle','arXiv ID','PubMed ID / PMID','Other persistent identifier']})}${f('publisher_pid','PID (publisher version of record)',{required:true,placeholder:'e.g. 10.xxxx/yyyy'})}</div>
    <div class="field-grid two">${f('publication_type','Type of publication',{required:true,options:['Journal article','Review article','Preprint','Conference paper','Book','Book chapter','Other']})}${f('authors','Authors (as listed in the publication)',{required:true,placeholder:'Surname, First name; Surname, First name'})}</div>
    <div class="field-grid two">${f('publisher','Publisher',{required:true})}${f('journal','Journal or equivalent')}</div>
    <div class="field-grid two">${f('open_access_repository','Was the publication available in open access through a repository at publication?',{required:true,options:['Yes','No']})}${f('peer_reviewed','Peer-reviewed?',{required:true,options:['Yes','No']})}</div>
    <div class="field-grid two">${f('publication_url','Link to publication',{type:'url',placeholder:'https://...'})}${f('deposited_pid','PID of deposited publication (if different)')}</div>
    <div class="field-grid three">${f('journal_number','Journal number / issue')}${f('issn','ISSN or eISSN')}${f('publication_year','Year of publication',{type:'number'})}</div>
    ${f('publication_month','Month of publication',{options:['January','February','March','April','May','June','July','August','September','October','November','December']})}`;
  }
  function outputFields(){
    return `<p class="field-hint">In the portal screenshot, a repository landing-page URL is mandatory for datasets, and recommended for other results. Other details below are optional.</p>
    <div class="field-grid two">${f('type','Type of result',{options:['Dataset','Software','Workflow','Protocol','Prototype','Other']})}${f('title','Title / name of the result')}</div>
    ${f('description','Description',{type:'textarea',placeholder:'Explain the result and its relation to your doctoral project.'})}
    <div class="field-grid two">${f('pid_type','Type of PID (if available)')}${f('pid','PID (if available)')}</div>
    ${f('repository_url','URL to repository landing page',{type:'url',placeholder:'https://...'})}
    <p class="field-hint output-url-note">For datasets, the repository URL is required.</p>`;
  }
  function disseminationFields(){
    return `<p class="field-hint">Capture event attendance as well as presentations. Attendance only is marked for internal tracking and should not automatically be reported as dissemination of research results.</p>
    <div class="field-grid two">${f('activity_name','Dissemination activity name',{required:true})}${f('activity_type','Type of dissemination activity',{required:true,options:['Scientific conference / meeting','Conference presentation','Workshop / training','Research seminar / lecture','Scientific exhibition / open science event','Other dissemination']})}</div>
    <div class="field-grid two">${f('conference_participation','Your participation',{options:['Attended only (no research presentation)','Oral presentation','Poster presentation','Invited talk / keynote','Organised or chaired session','Other']})}${f('event_date','Activity / conference date',{type:'date'})}</div>
    ${f('conference_name','Conference or event name (if applicable)')}
    ${audienceMarkup()}
    ${f('objectives','Why? Objectives with reference to a project output (max 200 characters)',{required:true,type:'textarea',maxlength:200,placeholder:'What result or output was shared, with whom, and why?'})}
    <div class="field-grid two">${f('status','Status of the dissemination activity',{required:true,options:['Planned','Ongoing','Completed','Cancelled']})}${f('link','Event or presentation link (if available)',{type:'url',placeholder:'https://...'})}</div>`;
  }
  function communicationFields(){
    return `<div class="field-grid two">${f('activity_name','Communication activity name',{required:true})}${f('event_date','Activity date',{type:'date'})}</div>
    ${f('description','Description',{required:true,type:'textarea',placeholder:'What was communicated and to whom?'})}
    ${audienceMarkup()}
    <div class="field-grid two">${f('channel','How? Communication channel',{required:true,options:['Project or institutional website','Social media','Newsletter / mailing list','Press / media interview','Public event / outreach','Podcast / video','Exhibition','Other']})}${f('status','Status',{required:true,options:['Planned','Ongoing','Completed','Cancelled']})}</div>
    ${f('outcome','Outcome',{required:true,placeholder:'e.g. article published, event held, audience engagement'})}
    ${f('link','URL / supporting evidence (if available)',{type:'url',placeholder:'https://...'})}`;
  }
  const fields={publications:publicationFields,outputs:outputFields,dissemination:disseminationFields,communication:communicationFields};
  function getSelected(type){return document.querySelector(`input[name="${cfg[type].radio}"]:checked`)?.value||'no';}
  function getCards(type){return [...document.querySelectorAll(`#${cfg[type].list} .report-card`)];}
  function updateHeading(type){getCards(type).forEach((card,i)=>card.querySelector('.repeat-title').textContent=`${cfg[type].title} ${i+1}`);}
  function updateDatasetRequirement(card){
    const url=card.querySelector('[data-report-field="repository_url"]');
    const type=card.querySelector('[data-report-field="type"]');
    if(!url||!type)return;
    url.required=type.value==='Dataset';
    const note=card.querySelector('.output-url-note');
    if(note)note.textContent=url.required?'The repository landing-page URL is mandatory for a dataset.':'The repository landing-page URL is recommended for other results.';
  }
  function add(type, data={}) {
    const target=document.getElementById(cfg[type].list);
    if(!target || getCards(type).length>=MAX_ITEMS)return;
    const card=document.createElement('div');card.className='repeat-card report-card';card.dataset.reportType=type;
    card.innerHTML=`<div class="repeat-head"><strong class="repeat-title"></strong><button type="button" class="remove-btn" aria-label="Remove this record">Remove</button></div>${fields[type]()}`;
    target.appendChild(card);
    card.querySelector('.remove-btn').addEventListener('click',()=>{card.remove();updateHeading(type);});
    const typeInput=card.querySelector('[data-report-field="type"]');
    if(type==='outputs')typeInput?.addEventListener('change',()=>updateDatasetRequirement(card));
    Object.entries(data).forEach(([k,value])=>{
      const el=[...card.querySelectorAll('[data-report-field]')].find(el=>el.dataset.reportField===k);
      if(el && value!==null && value!==undefined)el.value=String(value);
    });
    if(Array.isArray(data.target_audiences))card.querySelectorAll('[data-report-audience]').forEach(x=>{x.checked=data.target_audiences.includes(x.dataset.reportAudience);});
    if(type==='outputs')updateDatasetRequirement(card);
    updateHeading(type);
  }
  function updatePanel(type){
    const on=getSelected(type)==='yes';
    document.getElementById(cfg[type].panel).classList.toggle('hidden',!on);
    if(on&&!getCards(type).length)add(type);
  }
  function init(){
    Object.keys(cfg).forEach(type=>{
      document.querySelectorAll(`input[name="${cfg[type].radio}"]`).forEach(r=>r.addEventListener('change',()=>updatePanel(type)));
      document.getElementById(cfg[type].add)?.addEventListener('click',()=>add(type));
      updatePanel(type);
    });
  }
  function collectType(type){
    if(getSelected(type)!=='yes')return [];
    return getCards(type).map(card=>{
      const record={};
      card.querySelectorAll('[data-report-field]').forEach(el=>record[el.dataset.reportField]=el.value.trim());
      const audiences=[...card.querySelectorAll('[data-report-audience]:checked')].map(x=>x.dataset.reportAudience);
      if(type==='dissemination'||type==='communication')record.target_audiences=audiences;
      if(type==='dissemination')record.attendance_only=record.conference_participation==='Attended only (no research presentation)';
      return record;
    });
  }
  function collect(){
    return {
      publications:collectType('publications'),
      other_research_outputs:collectType('outputs'),
      dissemination_activities:collectType('dissemination'),
      communication_activities:collectType('communication'),
      reporting_source:'Doctoral-candidate self-report, for PM review; not an EU portal submission.'
    };
  }
  function validateStep(step){
    const types=step.dataset.title==='Research quality' ? ['publications','outputs'] :
      step.dataset.title==='Dissemination and communication' ? ['dissemination','communication'] : [];
    for(const type of types){
      if(getSelected(type)!=='yes')continue;
      if(!getCards(type).length){alert(`Please add at least one ${cfg[type].title.toLowerCase()} or select No.`);return false;}
      for(const card of getCards(type)){
        for(const el of card.querySelectorAll('[data-report-field][required]')){
          if(!el.checkValidity()){
            el.reportValidity();el.focus();return false;
          }
        }
        if((type==='dissemination'||type==='communication')&&!card.querySelector('[data-report-audience]:checked')){
          alert('Select at least one target audience for each reported activity.');
          card.querySelector('[data-report-audience]').focus();return false;
        }
        if(type==='dissemination' && card.querySelector('[data-report-field="objectives"]').value.length>200){
          alert('The objectives field must be 200 characters or fewer.');return false;
        }
      }
    }
    return true;
  }
  function printable(type,data){
    if(!data?.length)return 'None reported for this review period.';
    const labels={
      publications:{title:'Title',author_role:'Author role',authors:'Authors',pid_type:'Repository PID type',publisher_pid:'Publisher version PID',publication_type:'Type',publisher:'Publisher',journal:'Journal',open_access_repository:'Open access in repository',peer_reviewed:'Peer-reviewed',publication_url:'Link',deposited_pid:'Deposited version PID',journal_number:'Journal number',issn:'ISSN / eISSN',publication_month:'Month',publication_year:'Year'},
      outputs:{type:'Type',title:'Title',description:'Description',pid_type:'PID type',pid:'PID',repository_url:'Repository URL'},
      dissemination:{activity_name:'Activity',activity_type:'Type',conference_participation:'Participation',conference_name:'Conference',event_date:'Date',target_audiences:'Target audiences',objectives:'Objective / research output',status:'Status',link:'Link'},
      communication:{activity_name:'Activity',event_date:'Date',description:'Description',target_audiences:'Target audiences',channel:'Communication channel',outcome:'Outcome',status:'Status',link:'Link'}
    };
    return data.map((item,i)=>`${i+1}. ${item.title || item.activity_name || item.type || 'Reported result'}\n`+
      Object.entries(labels[type]).filter(([k])=>item[k]!=null && item[k]!=='' && !(Array.isArray(item[k])&&!item[k].length)).map(([k,label])=>`${label}: ${Array.isArray(item[k])?item[k].join('; '):item[k]}`).join('\n')).join('\n\n');
  }
  function formatDocx(raw){return {
    publications_summary:printable('publications',raw.publications),
    other_outputs_summary:printable('outputs',raw.other_research_outputs),
    dissemination_summary:printable('dissemination',raw.dissemination_activities),
    communication_summary:printable('communication',raw.communication_activities)
  };}
  return {init,collect,validateStep,formatDocx};
})();
