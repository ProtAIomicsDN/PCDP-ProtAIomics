/* ProtAIomics PCDP reminders: private Pages Function bridge to Google Apps Script.
 * The browser never receives the Google endpoint or its shared secret.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{30,100}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff'
  }});
}
function esc(s) {return String(s || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function html(title, content, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | ProtAIomics PCDP</title><style>body{margin:0;background:#f5faf9;color:#203941;font:16px/1.55 Arial,sans-serif}.panel{max-width:560px;margin:9vh auto 0;padding:34px;background:white;border:1px solid #d7e8e4;border-radius:16px;box-shadow:0 10px 34px #2039410d}h1{font-size:24px;margin:0 0 16px}p{margin:0 0 18px}button,.button{border:0;border-radius:9px;background:#147e80;color:white;padding:12px 18px;font-weight:600;cursor:pointer;font-size:15px;display:inline-block;text-decoration:none}.secondary{background:#eaf3f1;color:#244c55}small{color:#576d72}</style></head><body><main class="panel"><h1>${esc(title)}</h1>${content}<p><a class="button secondary" href="/">Back to the PCDP tool</a></p><small>ProtAIomics | PCDP reminders are optional. Completing the PCDP does not confirm formal submission.</small></main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'}});
}
function validReviewDate(s) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const t = Date.parse(s+'T12:00:00Z');
  if(!Number.isFinite(t) || new Date(t).toISOString().slice(0,10)!==s) return false;
  const today = new Date().toISOString().slice(0,10);
  return s>today && t-Date.parse(today+'T12:00:00Z') <= 730*86400000;
}
async function callGoogle(env, payload) {
  if(!env.APPS_SCRIPT_WEB_APP_URL || !env.REMINDER_BRIDGE_SECRET)
    return {ok:false, error:'Email reminders are not yet configured. Please contact the ProtAIomics project team.', status:503};
  if(!/^https:\/\/script\.google\.com\/macros\/s\//.test(env.APPS_SCRIPT_WEB_APP_URL))
    return {ok:false, error:'The reminder backend URL is not configured correctly.', status:503};
  try {
    const result = await fetch(env.APPS_SCRIPT_WEB_APP_URL, {
      method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify({...payload,bridgeSecret:env.REMINDER_BRIDGE_SECRET}),
      redirect:'follow'
    });
    if(!result.ok) return {ok:false,error:'The email reminder service could not be reached.',status:502};
    const raw = await result.text();
    let parsed;
    try {parsed=JSON.parse(raw);} catch {return {ok:false,error:'The email reminder service is not available. Check the Apps Script deployment settings.',status:502};}
    if(!parsed || typeof parsed.ok !== 'boolean') return {ok:false,error:'Unexpected response from the email reminder service.',status:502};
    return {ok:parsed.ok,message:parsed.message,error:parsed.error,status:parsed.ok?200:400};
  } catch(e) {
    return {ok:false,error:'Could not contact the email reminder service. Please try later.',status:502};
  }
}
export async function onRequestGet({request}) {
  const url=new URL(request.url);
  const action=url.searchParams.get('action') || '';
  const token=url.searchParams.get('token') || '';
  if(!['verify','complete','stop'].includes(action) || !TOKEN_PATTERN.test(token))
    return html('Invalid reminder link','<p>The link is invalid. Please use the link from your reminder email.</p>',400);
  const label=action==='verify'?'Confirm and activate reminders':action==='complete'?'I have completed my PCDP':'Stop reminders';
  const expl=action==='verify'?'Confirm that you want to receive optional email reminders before your next PCDP review.':action==='complete'?'This will stop future reminders. It does not confirm that your PCDP was officially submitted to the project team.':'This will stop future PCDP reminders for this review.';
  return html(label,`<p>${esc(expl)}</p><form method="post" action="/api/reminders"><input type="hidden" name="action" value="${esc(action)}"><input type="hidden" name="token" value="${esc(token)}"><button type="submit">${esc(label)}</button></form>`);
}
export async function onRequestPost({request,env}) {
  let input;
  const kind=request.headers.get('Content-Type') || '';
  try {
    if(kind.includes('application/json')) {
      if(Number(request.headers.get('content-length')||0)>2500) throw Error('Too large');
      input=await request.json();
    } else if(kind.includes('application/x-www-form-urlencoded')) {
      input=Object.fromEntries((await request.formData()).entries());
    } else return json({error:'Unsupported request type.'},415);
  } catch {return json({error:'Invalid request.'},400);}
  const action=String(input.action || '');
  if(action==='register') {
    const email=String(input.email || '').trim().toLowerCase();
    const reviewDate=String(input.reviewDate || '');
    const frequency=String(input.frequency || '');
    if(email.length>254 || !EMAIL_PATTERN.test(email)) return json({error:'Please enter a valid email.'},400);
    if(!validReviewDate(reviewDate)) return json({error:'Select a valid future review date (within the next two years).'},400);
    if(!['standard','intensive'].includes(frequency)) return json({error:'Choose a reminder frequency.'},400);
    if(input.consent !== true) return json({error:'Consent is required to activate this optional service.'},400);
    const result=await callGoogle(env,{action:'register',network:'ProtAIomics',email,reviewDate,frequency,consent:true});
    return json(result.ok?{message:result.message||'Check your email to verify your reminders.'}:{error:result.error}, result.status);
  }
  if(!['verify','stop','complete'].includes(action) || !TOKEN_PATTERN.test(String(input.token||''))) {
    return kind.includes('application/x-www-form-urlencoded') ? html('Invalid reminder link','<p>Could not process this link.</p>',400) : json({error:'Invalid request.'},400);
  }
  const result=await callGoogle(env,{action,network:'ProtAIomics',token:String(input.token)});
  if(kind.includes('application/x-www-form-urlencoded'))
    return result.ok ? html('Reminder settings updated',`<p>${esc(result.message||'Your preference has been saved.')}</p>`) : html('Could not update reminders',`<p>${esc(result.error||'The link may have expired.')}</p>`,result.status);
  return json(result.ok?{message:result.message}:{error:result.error},result.status);
}
