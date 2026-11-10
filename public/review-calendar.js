/* ProtAIomics review calculator.
 * Barcelona public holidays (national, Catalan and Barcelona local) are verified for 2026–2027.
 * Source: Ajuntament de Barcelona official holiday calendar (guia.barcelona.cat).
 * Outside those years, weekend correction remains automatic but the UI asks for a local holiday check.
 * No personal details are sent to any external calendar service.
 */
(function (root) {
  'use strict';
  const OFFICIAL_BARCELONA_HOLIDAYS = {
    2026: ['01-01','01-06','04-03','04-06','05-01','05-25','06-24','08-15','09-11','09-24','10-12','12-08','12-25','12-26'],
    2027: ['01-01','01-06','03-26','03-29','05-01','05-17','06-24','09-11','09-24','10-12','11-01','12-06','12-08','12-25']
  };
  const pad = n => String(n).padStart(2, '0');
  function isoUTC(d) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  }
  function calculate(reviewISO) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewISO || '')) return null;
    const [year, month, day] = reviewISO.split('-').map(Number);
    const input = new Date(Date.UTC(year, month-1, day));
    if (isoUTC(input) !== reviewISO) return null;
    const targetIndex = year * 12 + (month-1) + 6;
    const y = Math.floor(targetIndex / 12);
    const m = (targetIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const result = new Date(Date.UTC(y, m-1, Math.min(day, lastDay)));
    const original = isoUTC(result);
    let shiftDays = 0;
    const covers = year => Object.prototype.hasOwnProperty.call(OFFICIAL_BARCELONA_HOLIDAYS, year);
    while (shiftDays < 15) {
      const iso = isoUTC(result);
      const weekday = result.getUTCDay();
      const mmdd = iso.slice(5);
      if (weekday !== 0 && weekday !== 6 && !(OFFICIAL_BARCELONA_HOLIDAYS[result.getUTCFullYear()] || []).includes(mmdd)) break;
      result.setUTCDate(result.getUTCDate()+1);
      shiftDays++;
    }
    const final = isoUTC(result);
    return {
      original,
      date: final,
      shiftDays,
      holidayCalendarConfirmed: covers(y) && covers(result.getUTCFullYear())
    };
  }
  const api = Object.freeze({calculate, OFFICIAL_BARCELONA_HOLIDAYS});
  root.PCDPReviewCalendar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
