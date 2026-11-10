// This app uses its own same-origin Cloudflare Pages Function for email reminders.
// No email service URL or secret belongs in browser-side JavaScript.
window.PCDP_REMINDERS_API = '/api/reminders';
