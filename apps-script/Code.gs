/**
 * ProtAIomics PCDP email reminders (Google Apps Script + Google Sheets).
 * Backend only: students never see Google Sheets or Apps Script.
 * Deploy as a Google Apps Script web app, Execute as: Me, Access: Anyone.
 * Google Workspace may restrict the Anyone option. Obtain CRG approval first.
 * NEVER put BRIDGE_SECRET or LINK_SECRET in source files or on GitHub.
 */

var HEADERS = [
  'id','network','email','review_date','frequency','status',
  'created_at','verified_at','updated_at','consent_at',
  'sent_keys','last_verification_at','closed_at'
];
var TAB_NAME = 'Reminders';
var PROJECT_NETWORK = 'ProtAIomics';
var TZ = 'Europe/Madrid';
var REMINDER_SCHEDULES = {
  'standard':[30,15,5,1],
  'intensive':[30,15,5,3,2,1]
};

/** Run once after configuring BRIDGE_SECRET and SITE_URL (see guide). */
function setup() {
  var props = PropertiesService.getScriptProperties();
  ['BRIDGE_SECRET','SITE_URL'].forEach(function(k) {
    if (!props.getProperty(k)) throw new Error('Missing Script Property: '+k);
  });
  if (!props.getProperty('SENDER_EMAIL')) throw new Error('Missing Script Property: SENDER_EMAIL');
  if (!props.getProperty('REPLY_TO_EMAIL')) props.setProperty('REPLY_TO_EMAIL',props.getProperty('SENDER_EMAIL'));
  if (!props.getProperty('LINK_SECRET')) props.setProperty('LINK_SECRET',Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());
  if (!/^https:\/\//.test(props.getProperty('SITE_URL')))
    throw new Error('SITE_URL must be the published HTTPS PCDP site URL');
  var spreadsheet=SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open Apps Script from Extensions > Apps Script inside the Google Sheet');
  props.setProperty('SPREADSHEET_ID',spreadsheet.getId());
  var sh=spreadsheet.getSheetByName(TAB_NAME) || spreadsheet.insertSheet(TAB_NAME);
  if(sh.getLastRow()===0) sh.appendRow(HEADERS);
  if(sh.getLastColumn()<HEADERS.length || sh.getRange(1,1,1,HEADERS.length).getValues()[0].join('|')!==HEADERS.join('|'))
    throw new Error('Unexpected sheet headers. Use a new sheet or do not edit the Reminders tab headers.');
  sh.getRange(1,1,sh.getMaxRows(),HEADERS.length).setNumberFormat('@');
  sh.setFrozenRows(1);
  verifySender_();
  var existing=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='sendDueReminders';});
  if(!existing) ScriptApp.newTrigger('sendDueReminders').timeBased().everyDays(1).atHour(9).inTimezone(TZ).create();
  Logger.log('ProtAIomics reminders ready. Sender verified. Daily trigger installed.');
}

/** Optional manual test from the Apps Script editor. Sends ONE email to the executor. */
function sendTestEmail() {
  var recipient=Session.getEffectiveUser().getEmail();
  if(!recipient) throw new Error('Cannot determine your Google account email.');
  sendMail_(recipient,'ProtAIomics PCDP reminder service test',
    'This is a test email. The ProtAIomics PCDP reminder service is configured.');
  Logger.log('Test message sent to '+recipient);
}

function doGet() {
  return ContentService.createTextOutput('ProtAIomics reminders backend. Use the PCDP website.');
}

function doPost(e) {
  try {
    var d=JSON.parse(e.postData.contents || '{}');
    var props=PropertiesService.getScriptProperties();
    if(!props.getProperty('BRIDGE_SECRET') || d.bridgeSecret!==props.getProperty('BRIDGE_SECRET'))
      return output_({ok:false,error:'Request not authorised.'});
    if(d.network!==PROJECT_NETWORK) return output_({ok:false,error:'Unknown network.'});
    if(!['register','verify','stop','complete'].includes(d.action))
      return output_({ok:false,error:'Unsupported request.'});
    var lock=LockService.getScriptLock();
    if(!lock.tryLock(20000)) return output_({ok:false,error:'Service is busy. Please try again.'});
    try {
      var data;
      if(d.action==='register') data=register_(d);
      else if(d.action==='verify') data=verify_(d.token);
      else data=close_(d.action,d.token);
      SpreadsheetApp.flush();
      return output_(data);
    } finally {lock.releaseLock();}
  } catch(err) {
    console.error('ProtAIomics reminders error: '+err.message);
    return output_({ok:false,error:'The reminder service could not complete the request. Please contact the ProtAIomics project team.'});
  }
}

function output_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function props_() {return PropertiesService.getScriptProperties();}
function sheet_() {return SpreadsheetApp.openById(props_().getProperty('SPREADSHEET_ID')).getSheetByName(TAB_NAME);}
function timestamp_() {return new Date().toISOString();}
function day_() {return Utilities.formatDate(new Date(),TZ,'yyyy-MM-dd');}
function goodDate_(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return false;
  var d=new Date(value+'T12:00:00Z');
  if(isNaN(d.getTime()) || d.toISOString().slice(0,10)!==value) return false;
  var days=dayDiff_(value,day_());
  return days>0 && days<=730;
}
function dayDiff_(later,earlier) {
  return Math.round((Date.parse(later+'T12:00:00Z')-Date.parse(earlier+'T12:00:00Z'))/86400000);
}
function allRows_() {
  var sh=sheet_();
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,HEADERS.length).getDisplayValues().map(function(values,i) {
    var obj={_row:i+2};
    HEADERS.forEach(function(key,j){obj[key]=values[j]||'';});
    return obj;
  });
}
function writeFields_(r,changes) {
  var sh=sheet_();
  Object.keys(changes).forEach(function(key) {
    var col=HEADERS.indexOf(key)+1;
    if(!col) throw new Error('Unknown sheet column: '+key);
    sh.getRange(r._row,col).setValue(changes[key]);
    r[key]=String(changes[key]);
  });
}
function linkToken_(kind,id) {
  var secret=props_().getProperty('LINK_SECRET');
  var signature=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(kind+':'+id,secret)).replace(/=+$/,'');
  return id+'.'+signature;
}
function tokenRow_(kind,token) {
  if(!/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{30,100}$/i.test(String(token||''))) return null;
  var id=token.split('.')[0];
  if(linkToken_(kind,id)!==token) return null;
  var rows=allRows_();
  return rows.find(function(r){return r.id===id;}) || null;
}
function link_(action,token) {
  var base=props_().getProperty('SITE_URL').replace(/\/$/,'');
  return base+'/api/reminders?action='+encodeURIComponent(action)+'&token='+encodeURIComponent(token);
}
function verifySender_() {
  var sender=props_().getProperty('SENDER_EMAIL').trim().toLowerCase();
  if(!sender) throw new Error('SENDER_EMAIL must be configured in Script Properties.');
  var effective=Session.getEffectiveUser().getEmail().toLowerCase();
  var aliases=GmailApp.getAliases().map(function(s){return s.toLowerCase();});
  if(effective===sender) return {fromAlias:false};
  if(aliases.includes(sender)) return {fromAlias:true};
  throw new Error('The executing Google account ('+effective+') cannot send as '+sender+'. Ask IT to configure the authorised Gmail sender/alias before deploying.');
}
function sendMail_(recipient,subject,body) {
  var sender=verifySender_();
  var opts={name:'ProtAIomics | PCDP reminders',replyTo:props_().getProperty('REPLY_TO_EMAIL')};
  if(sender.fromAlias) opts.from=props_().getProperty('SENDER_EMAIL');
  GmailApp.sendEmail(recipient,subject,body,opts);
}
function sendVerification_(email,reviewDate,frequency,id) {
  var url=link_('verify',linkToken_('verify',id));
  var body='Hello,\n\nYou requested ProtAIomics PCDP review reminders.\n\n'
    +'Next PCDP review: '+reviewDate+'\nReminder schedule: '+frequency+'\n\n'
    +'Confirm your email and activate reminders (valid for 72 hours):\n'+url+'\n\n'
    +'If you did not request this service, ignore this email. No reminders will be sent unless you confirm.\n\n'
    +'ProtAIomics project team\n'+props_().getProperty('REPLY_TO_EMAIL');
  sendMail_(email,'Confirm your ProtAIomics PCDP email reminders',body);
}
function register_(d) {
  var email=String(d.email||'').trim().toLowerCase();
  var review=String(d.reviewDate||'');
  var frequency=String(d.frequency||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254)
    return {ok:false,error:'Enter a valid email address.'};
  if(!goodDate_(review)) return {ok:false,error:'Choose a future review date within two years.'};
  if(!REMINDER_SCHEDULES[frequency]) return {ok:false,error:'Invalid reminder frequency.'};
  if(d.consent!==true) return {ok:false,error:'Consent is required.'};
  var now=timestamp_();
  var rows=allRows_();
  var last=rows.filter(function(r){return r.email===email && r.last_verification_at;}).sort(function(a,b){return b.last_verification_at.localeCompare(a.last_verification_at);})[0];
  if(last && Date.now()-Date.parse(last.last_verification_at)<15*60000)
    return {ok:true,message:'If eligible, a verification message has been sent. Please check your inbox and spam folder. If needed, try again after 15 minutes.'};
  var count=rows.filter(function(r){return r.last_verification_at.startsWith(day_());}).length;
  if(count>=40) return {ok:false,error:'Reminder registrations are temporarily full today. Please try tomorrow or contact the ProtAIomics project team.'};
  var id=Utilities.getUuid();
  var values={id:id,network:PROJECT_NETWORK,email:email,review_date:review,frequency:frequency,
    status:'pending',created_at:now,verified_at:'',updated_at:now,consent_at:now,
    sent_keys:'',last_verification_at:now,closed_at:''};
  sheet_().appendRow(HEADERS.map(function(k){return values[k];}));
  try {sendVerification_(email,review,frequency,id);}
  catch(err) {
    var sh=sheet_();sh.deleteRow(sh.getLastRow());
    throw err;
  }
  return {ok:true,message:'Check your email for a verification link. Reminders will start only after you confirm.'};
}
function verify_(token) {
  var r=tokenRow_('verify',token);
  if(!r || r.status!=='pending' || Date.now()-Date.parse(r.created_at)>72*3600000)
    return {ok:false,error:'This confirmation link is invalid, expired or already used. Register again in the PCDP tool.'};
  var now=timestamp_();
  allRows_().filter(function(a){return a.email===r.email && a.id!==r.id && ['active','pending'].includes(a.status);}).forEach(function(a){
    writeFields_(a,{status:'replaced',updated_at:now,closed_at:now});
  });
  writeFields_(r,{status:'active',verified_at:now,updated_at:now});
  return {ok:true,message:'Email reminders are active for your next PCDP review. You can stop them using any reminder email.'};
}
function close_(action,token) {
  var r=tokenRow_('manage',token);
  if(!r || r.status!=='active') return {ok:false,error:'This link is invalid or these reminders have already been stopped.'};
  var now=timestamp_();
  var status=action==='complete'?'completed':'stopped';
  writeFields_(r,{status:status,updated_at:now,closed_at:now});
  return {ok:true,message:status==='completed'?'Your PCDP has been marked as completed for reminder purposes, and future reminders have stopped. This is not a formal submission.':'You have unsubscribed from PCDP reminders for this review.'};
}

/** Runs daily under the Google account that installed the trigger. */
function sendDueReminders() {
  var lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var today=day_();
    allRows_().forEach(function(r) {
      if(r.status!=='active' || !REMINDER_SCHEDULES[r.frequency]) return;
      var remaining=dayDiff_(r.review_date,today);
      if(REMINDER_SCHEDULES[r.frequency].indexOf(remaining)===-1) return;
      var key=r.review_date+':'+remaining;
      var sent=r.sent_keys?r.sent_keys.split('|'):[];
      if(sent.indexOf(key)!==-1) return;
      var app=props_().getProperty('SITE_URL').replace(/\/$/,'');
      var manage=linkToken_('manage',r.id);
      var body='Hello,\n\nYour ProtAIomics Personal Career Development Plan review is due on '+r.review_date+'.\n'
        +'Days remaining: '+remaining+'\n\n'
        +'Open the PCDP tool: '+app+'\n\n'
        +'If you already completed the PCDP, stop these reminders:\n'+link_('complete',manage)+'\n\n'
        +'Or unsubscribe without indicating completion:\n'+link_('stop',manage)+'\n\n'
        +'Completing your PCDP does not count as formally submitting it to the project manager.\n\n'
        +'ProtAIomics project team\n'+props_().getProperty('REPLY_TO_EMAIL');
      try {
        sendMail_(r.email,'ProtAIomics PCDP review: '+remaining+' day'+(remaining===1?'':'s')+' remaining',body);
        writeFields_(r,{sent_keys:sent.concat([key]).join('|'),updated_at:timestamp_()});
      } catch(err) {console.error('Could not send reminder to subscription '+r.id+': '+err.message);}
    });
    cleanupRecords_();
    SpreadsheetApp.flush();
  } finally {lock.releaseLock();}
}
function cleanupRecords_() {
  var sh=sheet_();
  var now=Date.now();
  allRows_().reverse().forEach(function(r) {
    var stalePending=r.status==='pending' && now-Date.parse(r.created_at)>7*86400000;
    var staleClosed=['completed','stopped','replaced'].includes(r.status) && now-Date.parse(r.closed_at||r.updated_at)>90*86400000;
    var staleActive=r.status==='active' && dayDiff_(day_(),r.review_date)>90;
    if(stalePending || staleClosed || staleActive) sh.deleteRow(r._row);
  });
}