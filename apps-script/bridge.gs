/**
 * Skylike calendar bridge
 * Lets your family screen read (and later edit) your Google Calendars.
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
        const cal = CalendarApp.getCalendarById(p.calendarId);
        const ev = p.allDay
          ? cal.createAllDayEvent(p.title, new Date(p.start), new Date(p.end))
          : cal.createEvent(p.title, new Date(p.start), new Date(p.end), { location: p.location || '' });
        return out_({ ok: true, id: ev.getId() });
      }
      case 'move': {
        const ev = findEvent_(CalendarApp.getCalendarById(p.calendarId), p.id, p.originalStart);
        if (!ev) return out_({ ok: false, error: 'event not found' });
        if (p.allDay) ev.setAllDayDates(new Date(p.start), new Date(p.end));
        else ev.setTime(new Date(p.start), new Date(p.end));
        if (p.title) ev.setTitle(p.title);
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

function findEvent_(cal, id, originalStart) {
  if (!cal) return null;
  if (originalStart) {
    const s = new Date(originalStart);
    const evs = cal.getEvents(new Date(s.getTime() - 60000), new Date(s.getTime() + 86400000));
    for (let i = 0; i < evs.length; i++) if (evs[i].getId() === id) return evs[i];
  }
  return cal.getEventById(id);
}
