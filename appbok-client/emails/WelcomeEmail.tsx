import React from 'react';
import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  token: string;
  baseUrl: string;
  salonSlug?: string;
}

export function WelcomeEmail({ name, token, baseUrl, salonSlug }: WelcomeEmailProps) {
  const verifyUrl = `${baseUrl}/api/verify?token=${encodeURIComponent(token)}`;
  const adminUrl = `${baseUrl}/admin`;
  const bookingUrl = salonSlug ? `${baseUrl}/b/${salonSlug}` : baseUrl;

  return (
    <Html>
      <Head />
      <Preview>Välkommen till Appbok! Bekräfta din e-postadress</Preview>
      <Tailwind>
        <Body className="bg-white font-sans my-0 mx-auto py-12 px-4">
          <Container className="max-w-[480px] bg-white rounded-xl p-8">
            {/* ── Logo ── */}
            <Section className="text-center mb-10">
              <Img
                src={`${baseUrl}/logo-web.svg`}
                alt="Appbok"
                width={120}
                height={40}
                className="inline-block"
                style={{ width: '120px', height: 'auto' }}
              />
            </Section>

            {/* ── Rubrik ── */}
            <Section className="text-center mb-6">
              <Heading className="text-2xl font-bold text-black leading-8 m-0 mb-3">
                Välkommen till Appbok!
              </Heading>
              <Text className="text-[15px] text-gray-600 leading-relaxed m-0">
                Hej {name}! Vi är så glada att du har valt Appbok för din salong. Vi ser
                fram emot att hjälpa dig växa och förenkla din vardag.
              </Text>
            </Section>

            {/* ── CTA ── */}
            <Section className="text-center mb-8">
              <Button
                href={verifyUrl}
                className="bg-black text-white text-[15px] font-semibold rounded-md px-8 py-3 no-underline inline-block"
              >
                Bekräfta e-postadress
              </Button>
            </Section>

            {/* ── Nästa steg ── */}
            <Section className="bg-zinc-50 rounded-lg p-6 mb-8">
              <Text className="text-[15px] font-bold text-black m-0 mb-4">
                Dina nästa steg:
              </Text>

              <Row className="mb-3">
                <Column className="align-top pr-3">
                  <span className="text-black text-base leading-5 no-underline">✓</span>
                </Column>
                <Column>
                  <Text className="text-[14px] text-gray-600 leading-relaxed m-0">
                    Ställ in dina öppettider och schema.
                  </Text>
                </Column>
              </Row>

              <Row className="mb-3">
                <Column className="align-top pr-3">
                  <span className="text-black text-base leading-5 no-underline">✓</span>
                </Column>
                <Column>
                  <Text className="text-[14px] text-gray-600 leading-relaxed m-0">
                    Koppla ditt Stripe-konto för att ta emot betalningar.
                  </Text>
                </Column>
              </Row>

              <Row>
                <Column className="align-top pr-3">
                  <span className="text-black text-base leading-5 no-underline">✓</span>
                </Column>
                <Column>
                  <Text className="text-[14px] text-gray-600 leading-relaxed m-0">
                    Dela din unika bokningslänk med dina kunder.
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* ── Footer ── */}
            <Section className="text-center border-t border-gray-200 pt-6">
              <Text className="text-xs text-gray-400 m-0 mb-3">
                <Link href={adminUrl} className="text-gray-400 underline">
                  Öppna adminpanelen
                </Link>
                {' · '}
                <Link href={bookingUrl} className="text-gray-400 underline">
                  Din bokningssida
                </Link>
              </Text>
              <Text className="text-xs text-gray-400 m-0">
                Behöver du hjälp? Svara på detta mejl så hör vi av oss direkt.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
