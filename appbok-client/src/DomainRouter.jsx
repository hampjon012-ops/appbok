import React from 'react';
import { useSubdomain } from './hooks/useSubdomain.js';
import AdminApp from './apps/AdminApp.jsx';
import LandingPage from './apps/LandingPage.jsx';
import TenantBookingApp from './apps/TenantBookingApp.jsx';

/**
 * Huvud-router: styr trafik baserat på subdomän.
 *
 *   admin.appbok.se  → <AdminApp />          (admin/dashboard)
 *   appbok.se        → <LandingPage />       (marknadsföring/bas-bokning)
 *   www.appbok.se    → <LandingPage />
 *   localhost        → <LandingPage />
 *   colorisma.appbok.se → <TenantBookingApp /> (salongens bokningsvy)
 *   *.vercel.app     → <LandingPage />        (känd värd → fallback)
 *   (övriga)         → <LandingPage />        (okänd värd, t.ex. *.vercel.app)
 *
 * Varje gren (AdminApp, LandingPage, TenantBookingApp) har en egen <BrowserRouter>.
 */
export default function DomainRouter() {
  const { isAdminHost, isTenantHost } = useSubdomain();

  if (isAdminHost) {
    return <AdminApp />;
  }

  if (isTenantHost) {
    return <TenantBookingApp />;
  }

  // Basdomän (inkl. okända värdar — fallback till landing)
  return <LandingPage />;
}
