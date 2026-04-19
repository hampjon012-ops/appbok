import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

interface BookingConfirmationEmailProps {
  customerName: string;
  serviceName: string;
  stylistName: string;
  date: string;
  time: string;
  salonName: string;
  /**pris kan skickas om det finns (valfritt) */
  price?: string;
  /**Salongens unika slug för bokningssidan */
  salonSlug?: string;
  baseUrl: string;
  bookingId: string;
}

/**
 * Formaterar YYYY-MM-DD → läsbart svenskt datum.
 */
function fmtDateSwedish(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Genererar en Google Calendar-länk för att lägga till en händelse.
 */
function googleCalendarLink({
  title,
  date,       // YYYY-MM-DD
  time,       // HH:mm
  durationMinutes = 60,
  location,
  description,
}: {
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  location?: string;
  description?: string;
}): string {
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  const start = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ...(location ? { location } : {}),
    ...(description ? { details: description } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function BookingConfirmationEmail({
  customerName,
  serviceName,
  stylistName,
  date,
  time,
  salonName,
  price,
  salonSlug,
  baseUrl,
  bookingId,
}: BookingConfirmationEmailProps) {
  const cancelUrl = `${baseUrl}/cancel/${bookingId}`;
  const bookingPageUrl = salonSlug ? `${baseUrl}/b/${salonSlug}` : baseUrl;
  const calendarLink = googleCalendarLink({
    title: `${serviceName} hos ${salonName}`,
    date,
    time,
    durationMinutes: 60,
    location: salonName,
    description: `Bokning via Appbok.\nTjänst: ${serviceName}\nStylist: ${stylistName}`,
  });

  const formattedDate = fmtDateSwedish(date);

  return (
    <Html>
      <Head />
      <Preview>Bokningsbekräftelse — {serviceName} den {formattedDate}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans my-0 mx-auto py-10 px-4">
          <Container className="max-w-[480px] bg-white rounded-xl p-0">

            {/* ── Vit header med logo ── */}
            <Section className="text-center px-8 pt-8 pb-6">
              <Img
                src={`${baseUrl}/logo-web.svg`}
                alt="Appbok"
                width={100}
                height={34}
                className="inline-block mb-5"
                style={{ width: '100px', height: 'auto' }}
              />
              <Heading className="text-2xl font-bold text-black leading-8 m-0 mb-3">
                {salonName}
              </Heading>
              <Hr className="border-gray-200 my-0" />
            </Section>

            {/* ── Hej + bekräftelse ── */}
            <Section className="px-8 pb-6">
              <Text className="text-lg font-semibold text-black m-0 mb-1">
                Hej {customerName}!
              </Text>
              <Text className="text-base text-gray-600 m-0 leading-relaxed">
                Din bokning är bekräftad. Vi ser fram emot att se dig!
              </Text>
            </Section>

            {/* ── Info-ruta ── */}
            <Section className="mx-8 mb-6 rounded-lg bg-zinc-50 p-5">
              <Text className="text-sm font-bold text-black uppercase tracking-wide m-0 mb-4">
                Din bokning
              </Text>

              <InfoRow label="Tjänst" value={serviceName} />
              <InfoRow label="Stylist" value={stylistName} />
              <InfoRow label="Datum" value={formattedDate} />
              <InfoRow label="Tid" value={time} />
              {price && <InfoRow label="Pris" value={price} isLast />}
            </Section>

            {/* ── Kalender + Avboka ── */}
            <Section className="px-8 mb-6">
              {/* Kalenderlänk */}
              <Button
                href={calendarLink}
                className="bg-black text-white text-sm font-semibold rounded-md px-6 py-3 no-underline inline-block w-full text-center mb-3"
              >
                📅 Lägg till i kalendern
              </Button>

              {/* Avbokningslänk */}
              <Section className="text-center">
                <Link
                  href={cancelUrl}
                  className="text-sm text-gray-500 underline"
                >
                  Avboka eller omboka din tid
                </Link>
              </Section>

              {/* Villkorstext */}
              <Text className="text-xs text-gray-400 text-center m-0 mt-4 leading-relaxed">
                Avbokning måste ske senast 24 timmar före din bokningstid för att undvika
                avgift. Vid uteblivet besök debiteras fullt pris.
              </Text>
            </Section>

            {/* ── Footer ── */}
            <Section className="px-8 py-6 border-t border-gray-100 text-center">
              <Text className="text-xs text-gray-400 m-0 mb-2">
                Bokad via{' '}
                <Link href={bookingPageUrl} className="text-gray-400 underline">
                  {salonName}
                </Link>
                {' '}på Appbok
              </Text>
              <Text className="text-xs text-gray-300 m-0">
                Detta mejl skickades direkt till dig från {salonName}.
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/** Enkel tabellrad för info-rutan */
function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <Section className="flex justify-between py-2 m-0">
      <Text className="text-sm text-gray-500 m-0 w-28 flex-shrink-0">{label}</Text>
      <Text className={`text-sm font-medium text-black m-0 text-right flex-1${isLast ? '' : ' border-b border-gray-200'}`}>
        {value}
      </Text>
    </Section>
  );
}
