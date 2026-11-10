/* PCDP reminder registration. No PCDP narrative is sent to this service. */
(() => {
  const widget = document.getElementById('reminderWidget');
  if (!widget) return;
  const fields = document.getElementById('reminderFields');
  const button = document.getElementById('activateReminders');
  const message = document.getElementById('reminderMessage');
  const email = document.getElementById('reminderEmail');
  const frequency = document.getElementById('reminderFrequency');
  const consent = document.getElementById('reminderConsent');
  const reviewDate = document.getElementById('nextReview');
  const network = widget.dataset.network;
  let lastSubmittedDate = '';
  const api = '/api/reminders';
  const enabled = true;

  function show(text, type = '') {
    message.textContent = text;
    message.className = 'message reminder-message' + (type ? ' ' + type : '');
  }
  reviewDate?.addEventListener('change', () => {
    if (lastSubmittedDate && reviewDate.value !== lastSubmittedDate) {
      show('You changed the next review date. Activate reminders again and confirm the new verification email to update your schedule.');
    }
  });
  if (!enabled) button.disabled = true;
  button.addEventListener('click', async () => {
    if (!enabled) return show('The reminder service is not yet active.', 'error');
    if (!reviewDate?.value) return show('Choose your next PCDP review date above.', 'error');
    const today = new Date().toISOString().slice(0, 10);
    if (reviewDate.value <= today) return show('Your next review date must be in the future.', 'error');
    if (!email.value.trim() || !email.checkValidity()) return show('Enter a valid email address.', 'error');
    if (!consent.checked) return show('Please tick the consent box to request reminders.', 'error');
    button.disabled = true;
    show('Requesting your verification email...');
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action:'register', network, email:email.value.trim(), reviewDate:reviewDate.value,
          frequency:frequency.value, consent:true})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Could not activate reminders (HTTP ${response.status}).`);
      lastSubmittedDate = reviewDate.value;
      show(data.message || 'Check your email to confirm reminders.', 'success');
    } catch(e) {
      show(e?.message || 'Could not contact the reminder service. Please try again later.', 'error');
    } finally {
      button.disabled = false;
    }
  });
})();
