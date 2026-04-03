# Plan: E-postnotifikationer för bokningar

## Översikt

Implementera e-postnotifikationer som skickas när en bokning skapas eller avbokas.

## Mål

- Kund får bekräftelse efter ny bokning
- Kund får bekräftelse vid avbokning
- Personal/stylist får notifikation om ny bokning

## Arkitektur

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  POST /api/     │────▶│   email.js       │────▶│   Nodemailer    │
│  bookings       │     │   sendBooking... │     │   (SMTP)        │
│                 │     │   sendCancel...  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Implementationssteg

### Steg 1: Lägg till email-hjälpfunktioner i `api/lib/email.js`

**Ny filsektion:**
```javascript
// Skicka bokningsbekräftelse till kund
export async function sendBookingConfirmationEmail({ to, customerName, serviceName, stylistName, date, time, salonName }) {
  // Bygger HTML och skickar via transporter
}

// Skicka avbokningsbekräftelse till kund  
export async function sendCancellationEmail({ to, customerName, serviceName, date, time, salonName }) {
  // Bygger HTML och skickar via transporter
}

// Skicka notifikation till stylist om ny bokning
export async function sendStylistNotificationEmail({ to, stylistName, customerName, serviceName, date, time, customerPhone, salonName }) {
  // Bygger HTML och skickar via transporter
}
```

### Steg 2: Anropa email-funktioner i `api/routes/bookings.js`

**Efter lyckad bokning (rad ~165):**
```javascript
// Skicka email till kund
if (customer_email) {
  await sendBookingConfirmationEmail({
    to: customer_email,
    customerName,
    serviceName: service?.name || 'Tjänst',
    stylistName: stylist?.name || 'Vald stylist',
    date: booking_date,
    time: booking_time,
    salonName: salon?.name || 'Salongen'
  });
}

// Skicka email till stylist
if (stylist?.email) {
  await sendStylistNotificationEmail({
    to: stylist.email,
    stylistName: stylist.name,
    customerName,
    serviceName: service?.name || 'Tjänst',
    date: booking_date,
    time: booking_time,
    customerPhone: customer_phone || '-',
    salonName: salon?.name || 'Salongen'
  });
}
```

**Vid avbokning (rad ~185):**
```javascript
// Skicka avbokningsmail till kund
if (customer_email) {
  await sendCancellationEmail({
    to: customer_email,
    customerName,
    serviceName: service?.name || 'Tjänst',
    date: booking_date,
    time: booking_time,
    salonName: salon?.name || 'Salongen'
  });
}
```

### Steg 3: Uppdatera databasfrågan för att hämta kund- och stylist-email

I `POST /api/bookings` behöver vi hämta:
- `customer_email` från request body (redan med)
- `stylist.email` via joined query från `users`-tabellen

### Steg 4: Skapa email HTML-mallar

Tre mallar behövs:
1. **Bokningsbekräftelse** - Tack för din bokning, här är detaljerna
2. **Avbokningsbekräftelse** - Din bokning är avbokad
3. **Stylist-notifikation** - Ny bokning inkommen

## Filer att modifiera

| Fil | Ändring |
|-----|---------|
| `api/lib/email.js` | Lägg till 3 nya email-funktioner + HTML-mallar |
| `api/routes/bookings.js` | Anropa email-funktioner vid create/cancel |
| `api/routes/bookings.js` | Uppdatera SELECT query för att hämta stylist email |

## Existerande resurser att återanvända

- `api/lib/email.js:15-27` - Redan konfigurerad Nodemailer-transport
- `api/lib/email.js:29-88` - Existerande `buildInviteHtml()` som mall för nya mallar

## Prioritet

1. Kundbekräftelse vid ny bokning (viktigast - kundvillkor)
2. Kundbekräftelse vid avbokning
3. Stylist-notifikation (mindre kritisk)

## Icke-mål (framtida)

- Email för påminnelse 24h innan bokning
- Email för ändring av bokning
- SMS-notifikationer
