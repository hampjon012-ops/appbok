import React from 'react';
import { useSubdomain } from './hooks/useSubdomain.js';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminApp from './apps/AdminApp.jsx';
import LandingPage from './apps/LandingPage.jsx';
import TenantBookingApp from './apps/TenantBookingApp.jsx';
import BookingCancel from './BookingCancel.jsx';

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
 * Allokerad Supabase-query görs i App-komponenten (inom MobileBookingFrontend),
 * inte här — så att samma Router/Routes kan delas mellan LandingPage och TenantBookingApp.
 *
 * /cancel/:id är alltid på basdomänen (SMS-länken pekar alltid på appbok.se).
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
  // BrowserRouter behövs för /cancel/:id
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cancel/:id" element={<BookingCancel />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
