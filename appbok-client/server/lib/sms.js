import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
/** E.164 nummer (+46…), Messaging Service SID (MG…), eller Twilio Phone Number SID (PN…) */
const senderId = process.env.TWILIO_SENDER_ID;

/** Cache: PN… → uppslaget nummer, MG…/+/text som sig */
let cachedFromAddress = null;

function getClient() {
  if (!accountSid || !authToken || accountSid.includes('PLACEHOLDER')) {
    return null;
  }
  return Twilio(accountSid, authToken);
}

/** True om SMS kan skickas (Twilio + avsändare kan lösas när ett meddelande skickas). */
export function isSmsConfigured() {
  return Boolean(accountSid && authToken && !String(accountSid).includes('PLACEHOLDER'));
}

/**
 * Twilio kräver `from` som E.164 (+4670…), Messaging Service (MG…), inte raw Phone Number SID (PN…).
 */
async function resolveFromAddress(client) {
  const raw = senderId?.trim();
  if (!raw) return null;
  if (cachedFromAddress) return cachedFromAddress;

  if (raw.startsWith('MG')) {
    cachedFromAddress = raw;
    return cachedFromAddress;
  }
  if (raw.startsWith('+')) {
    cachedFromAddress = raw;
    return cachedFromAddress;
  }
  // Twilio "Incoming Phone Number" resource SID → phoneNumber (E.164)
  if (raw.startsWith('PN')) {
    try {
      const res = await client.incomingPhoneNumbers(raw).fetch();
      if (res?.phoneNumber) {
        cachedFromAddress = res.phoneNumber;
        console.log('[sms] Resolved TWILIO_SENDER_ID (PN…) to', cachedFromAddress);
        return cachedFromAddress;
      }
    } catch (err) {
      console.error('[sms] Could not resolve Phone Number SID — use E.164 or MG… in TWILIO_SENDER_ID:', err?.message || err);
      return null;
    }
  }
  cachedFromAddress = raw;
  return cachedFromAddress;
}

/**
 * Gör mobilnummer till E.164 (+46…). Hanterar mellanslag, parenteser, bindestreck.
 */
export function normalizeToE164(to) {
  if (to == null) return '';
  const raw = String(to).trim();
  if (!raw) return '';

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return '';

  if (digitsOnly.startsWith('0') && digitsOnly.length >= 9 && digitsOnly.length <= 11) {
    return `+46${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.startsWith('46') && digitsOnly.length >= 11) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith('00')) {
    return `+${digitsOnly.slice(2)}`;
  }

  return `+${digitsOnly}`;
}

/**
 * @param to  Telefon (gärna E.164; vi normaliserar 07… → +46…)
 */
export async function sendSMS(to, message) {
  const client = getClient();
  if (!client) {
    console.warn('[sms] Twilio not configured — skipping SMS');
    return null;
  }

  const from = await resolveFromAddress(client);
  if (!from) {
    console.warn('[sms] TWILIO_SENDER_ID could not be resolved — skipping SMS');
    return null;
  }

  const toE164 = normalizeToE164(to);
  if (!toE164.startsWith('+')) {
    console.error('[sms] Invalid destination number (need E.164 or Swedish 0…):', to);
    return null;
  }

  try {
    const result = await client.messages.create({
      body: message.slice(0, 1600),
      from,
      to: toE164,
    });
    console.log(`[sms] Sent to ${toE164}, SID: ${result.sid}`);
    return result.sid;
  } catch (err) {
    console.error('[sms] Failed to send SMS:', err?.message || err, err?.code != null ? `code=${err.code}` : '');
    return null;
  }
}

export async function sendBookingSMS({ to, customerName, salonName, date, time, bookingId }) {
  // Cancel-länken är ALLTID på huvudplattformen — den är inte på salongens subdomän.
  const cancelUrl = `https://appbok.se/cancel/${bookingId || ''}`;
  console.log('[sms] Booking SMS — cancelUrl:', cancelUrl);
  const msg = `Hej ${customerName}! Din bokning hos ${salonName} den ${date} kl ${time} är nu bekräftad. Välkommen!\n\nAvboka din tid här: ${cancelUrl}`;
  return sendSMS(to, msg);
}

export async function sendReminderSMS({ to, salonName, time }) {
  const msg = `Påminnelse: Du har en tid hos ${salonName} imorgon kl ${time}. Vi ses!`;
  return sendSMS(to, msg);
}

export async function sendCancellationSMS({ to, salonName }) {
  const msg = `Din tid hos ${salonName} är avbokad. Beloppet återbetalas till ditt kort inom 3–5 bankdagar.`;
  return sendSMS(to, msg);
}

/**
 * Skickar SMS till kund när deras stylists bokning påverkas av blockering.
 * @param {{ to, customerName, salonName, date, time, stylistName, blockType }} p
 */
export async function sendBlockedDaySMS({
  to,
  customerName,
  salonName,
  date,
  time,
  stylistName,
  blockType,
  rebookUrl,
}) {
  const reason =
    blockType === 'sick'     ? 'sjuk'
    : blockType === 'vacation' ? 'på semester'
    : 'ledig';
  let msg =
    `Hej ${customerName}, din bokning hos ${salonName} den ${date} kl ${time} kan inte genomföras ` +
    `eftersom ${stylistName} är ${reason}.`;
  if (rebookUrl) {
    msg += ` Boka om här: ${rebookUrl}`;
  } else {
    msg += ' Vi kontaktar dig för att boka om.';
  }
  return sendSMS(to, msg);
}

/** Bekräftelse efter lyckad ombokning via /rebook */
export async function sendRebookConfirmationSMS({ to, customerName, salonName, date, time }) {
  const msg =
    `Hej ${customerName}! Din ombokning är bekräftad: ${salonName}, ${date} kl ${String(time).slice(0, 5)}. Vi ses!`;
  return sendSMS(to, msg);
}
