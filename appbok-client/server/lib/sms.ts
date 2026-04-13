import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const senderId = process.env.TWILIO_SENDER_ID;

/** Returns a Twilio client, or null if credentials are missing. */
function getClient() {
  if (!accountSid || !authToken || accountSid.includes('PLACEHOLDER')) {
    return null;
  }
  return Twilio(accountSid, authToken);
}

/**
 * Send an SMS message to a phone number.
 * @param to  E.164 formatted number, e.g. '+46701234567'
 * @param message  The message body (max 1600 chars for SMS)
 * @returns The Twilio message SID, or null if skipped/failed
 */
export async function sendSMS(to, message) {
  const client = getClient();
  if (!client) {
    console.warn('[sms] Twilio not configured — skipping SMS');
    return null;
  }

  const from = senderId?.trim() || undefined;
  if (!from) {
    console.warn('[sms] TWILIO_SENDER_ID not set — skipping SMS');
    return null;
  }

  try {
    const result = await client.messages.create({
      body: message.slice(0, 1600),
      from,
      to,
    });
    console.log(`[sms] Sent to ${to}, SID: ${result.sid}`);
    return result.sid;
  } catch (err) {
    console.error('[sms] Failed to send SMS:', err?.message || err);
    return null;
  }
}

/**
 * Send booking confirmation SMS.
 */
export async function sendBookingSMS({ to, customerName, salonName, date, time }) {
  const msg = `Hej ${customerName}! Din bokning hos ${salonName} den ${date} kl ${time} är nu bekräftad. Välkommen!`;
  return sendSMS(to, msg);
}

/**
 * Send 24-hour reminder SMS.
 */
export async function sendReminderSMS({ to, salonName, time }) {
  const msg = `Påminnelse: Du har en tid hos ${salonName} imorgon kl ${time}. Vi ses!`;
  return sendSMS(to, msg);
}