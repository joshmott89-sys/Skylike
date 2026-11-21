/**
 * Skylike calendar bridge
 * Lets your family screen read and edit your Google Calendars (two-way).
 * Other people's calendars work too: they share their calendar with this Google account
 * (Google Calendar > Settings and sharing > Share with specific people > "Make changes to events").
 *
 * Setup (about 5 minutes):
 * 1. Go to script.google.com, click "New project", delete everything, paste this whole file.
 * 2. Click Deploy > New deployment > type "Web app".
 *    Execute as: Me. Who has access: Anyone. Click Deploy.
 * 3. Approve access (click "Advanced" > "Go to project" on the unverified warning - it's your own script).
 * 4. Copy the Web app URL and paste it into Skylike > Settings > Calendar.
 *
 * Only requests carrying the secret key below are answered. Don't share this file.
 */
const KEY = '__SKYLIKE_KEY__';

function doGet(e) { return handle_(e && e.parameter ? e.parameter : {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(p);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(p) {
  if (!p || p.key !== KEY) return out_({ ok: false, error: 'bad key' });
  try {
    switch (p.action) {
      case 'calendars':
        return out_({
          ok: true,
          calendars: CalendarApp.getAllCalendars().map(function (c) {
            return { id: c.getId(), name: c.getName(), color: c.getColor(), primary: c.isMyPrimaryCalendar() };
          })
        });
      case 'events': {
        const from = new Date(p.from), to = new Date(p.to);
        const ids = String(p.ids || '').split(',').filter(String);
        const events = [];
        ids.forEach(function (id) {
          const cal = CalendarApp.getCalendarById(id);
          if (!cal) return;
          cal.getEvents(from, to).forEach(function (ev) {
            const allDay = ev.isAllDayEvent();
            const s = allDay ? ev.getAllDayStartDate() : ev.getStartTime();
            const en = allDay ? ev.getAllDayEndDate() : ev.getEndTime();
            events.push({
              calendarId: id,
              id: ev.getId(),
              key: ev.getId() + '@' + s.getTime(),
              title: ev.getTitle(),
              start: s.toISOString(),
              end: en.toISOString(),
              allDay: allDay,
              location: ev.getLocation() || null
            });
          });
        });
        return out_({ ok: true, events: events });
      }
      case 'create': {
        const cal = CalendarApp.getCalendarById(p.calendarId) || CalendarApp.getDefaultCalendar();
        const opts = { location: p.location || '', description: p.description || '' };
        if (p.repeat) { // a regular event: Skylike sends {freq, days, monthBy, until, count}
          const rule = recurrence_(JSON.parse(p.repeat), date_(p.start));
          const series = bool_(p.allDay)
            ? cal.createAllDayEventSeries(p.title, date_(p.start), rule, opts)
            : cal.createEventSeries(p.title, date_(p.start), date_(p.end), rule, opts);
          return out_({ ok: true, id: series.getId() });
        }
        const ev = bool_(p.allDay)
          ? cal.createAllDayEvent(p.title, date_(p.start), date_(p.end), opts)
          : cal.createEvent(p.title, date_(p.start), date_(p.end), opts);
        return out_({ ok: true, id: ev.getId() });
      }
      case 'move':
      case 'update': {
        const ev = findEvent_(CalendarApp.getCalendarById(p.calendarId), p.id, p.originalStart);
        if (!ev) return out_({ ok: false, error: 'event not found' });
        if (p.start && p.end) {
          if (bool_(p.allDay)) ev.setAllDayDates(date_(p.start), date_(p.end));
          else ev.setTime(date_(p.start), date_(p.end));
        }
        if (p.title !== undefined && p.title !== '') ev.setTitle(p.title);
        if (p.location !== undefined) ev.setLocation(p.location);
        return out_({ ok: true });
      }
      case 'delete': {
        const ev = findEvent_(CalendarApp.getCalendarById(p.calendarId), p.id, p.originalStart);
        if (!ev) return out_({ ok: false, error: 'event not found' });
        ev.deleteEvent();
        return out_({ ok: true });
      }
      default:
        return out_({ ok: true, pong: true, tz: Session.getScriptTimeZone() });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// Turn Skylike's repeat settings into a Google Calendar recurrence.
// (Apps Script can't say "2nd Tuesday of the month", so monthly repeats use the same date each month.)
function recurrence_(R, start) {
  const W = [CalendarApp.Weekday.SUNDAY, CalendarApp.Weekday.MONDAY, CalendarApp.Weekday.TUESDAY, CalendarApp.Weekday.WEDNESDAY, CalendarApp.Weekday.THURSDAY, CalendarApp.Weekday.FRIDAY, CalendarApp.Weekday.SATURDAY];
  const rec = CalendarApp.newRecurrence();
  let rule;
  if (R.freq === 'day') rule = rec.addDailyRule();
  else if (R.freq === 'week' || R.freq === 'fortnight') { rule = rec.addWeeklyRule().interval(R.freq === 'fortnight' ? 2 : 1); const d = (R.days && R.days.length ? R.days : [start.getDay()]).map(function (i) { return W[i]; }); rule = rule.onlyOnWeekdays(d); }
  else if (R.freq === 'month') rule = rec.addMonthlyRule().onlyOnMonthDay(start.getDate());
  else rule = rec.addYearlyRule();
  if (R.until) rule.until(date_(R.until + 'T23:59:59'));
  else if (R.count) rule.times(+R.count);
  return rec;
}
// "true"/"false" arrive as text from web requests
function bool_(v) { return v === true || v === 'true' || v === '1'; }
// A plain date (YYYY-MM-DD) is a calendar day in this script's time zone; anything else is an exact time.
function date_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
}

function findEvent_(cal, id, originalStart) {
  if (!cal) return null;
  if (originalStart) {
    const s = new Date(originalStart);
    const evs = cal.getEvents(new Date(s.getTime() - 60000), new Date(s.getTime() + 86400000));
    for (let i = 0; i < evs.length; i++) if (evs[i].getId() === id) return evs[i];
  }
  return cal.getEventById(id);
}
