import { google } from 'googleapis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/callback';

// ── Create a fresh OAuth2 client ─────────────────────────────────────────────
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// ── Generate the Google consent URL for a stylist ────────────────────────────
export function getConsentUrl(userId) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',          // Force consent to always get refresh_token
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state: userId,              // Pass user ID through OAuth flow
  });
}

// ── Exchange auth code for tokens ────────────────────────────────────────────
export async function getTokensFromCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// ── Create an authenticated Calendar client from stored tokens ───────────────
export function getCalendarClient(tokens) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date:   new Date(tokens.expires_at).getTime(),
  });
  return google.calendar({ version: 'v3', auth: client });
}

// ── Fetch busy times for a stylist on a given date ───────────────────────────
export async function getBusySlots(tokens, date) {
  const calendar = getCalendarClient(tokens);
  const timeMin = new Date(`${date}T00:00:00`);
  const timeMax = new Date(`${date}T23:59:59`);

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = res.data.calendars?.primary?.busy || [];
    return busySlots.map(slot => ({
      start: slot.start,
      end:   slot.end,
    }));
  } catch (err) {
    console.error('Google Calendar freebusy error:', err.message);
    return [];
  }
}

// ── Create a calendar event for a booking ────────────────────────────────────
export async function createCalendarEvent(tokens, { summary, description, date, time, durationMinutes }) {
  const calendar = getCalendarClient(tokens);
  
  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime   = new Date(startDateTime.getTime() + durationMinutes * 60000);

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Europe/Stockholm',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Europe/Stockholm',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
          ],
        },
      },
    });
    return res.data;
  } catch (err) {
    console.error('Google Calendar create event error:', err.message);
    return null;
  }
}

// ── Delete a calendar event (on cancel) ──────────────────────────────────────
export async function deleteCalendarEvent(tokens, eventId) {
  const calendar = getCalendarClient(tokens);
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
    return true;
  } catch (err) {
    console.error('Google Calendar delete event error:', err.message);
    return false;
  }
}

export function isConfigured() {
  return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'PLACEHOLDER' 
    && GOOGLE_CLIENT_SECRET && GOOGLE_CLIENT_SECRET !== 'PLACEHOLDER';
}
