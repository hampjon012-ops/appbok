import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileBookingFrontend from '../MobileBookingFrontend.jsx';
import ThankYou from '../ThankYou.jsx';
import Terms from '../Terms.jsx';
import Invite from '../pages/Invite.jsx';
import LoginRoute from '../components/LoginRoute.jsx';
import AdminDashboardRedirect from '../components/AdminDashboardRedirect.jsx';

/**
 * Salongs-subdomän (t.ex. colorisma.appbok.se / colorisma.localhost).
 *
 * Salongen hämtas från Supabase i App-komponenten via:
 *   GET /api/salons/public?slug=<tenantSlug>
 *   (API:t slår först upp kolumnen `slug`, fallback till `subdomain`)
 *
 * Om subdomänen inte matchar någon salong → not-found i App (fetchMergedSalonConfig).
 * Inloggning / admin → kanoniska admin.appbok.se (LoginRoute, AdminDashboardRedirect).
 *
 * Routing: /, /preview/mobile, /tack, /villkor, /login, /admin, /invite/:token
 */
export default function TenantBookingApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tenant-landing: MobileBookingFrontend hämtar rätt salong via
            fetchMergedSalonConfig → getImplicitHostSalonSlug() → /api/salons/public?slug=… */}
        <Route path="/" element={<MobileBookingFrontend />} />
        <Route path="/preview/mobile" element={<MobileBookingFrontend />} />
        <Route path="/tack" element={<ThankYou />} />
        <Route path="/villkor" element={<Terms />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/admin" element={<AdminDashboardRedirect />} />
        <Route path="/invite/:token" element={<Invite />} />
      </Routes>
    </BrowserRouter>
  );
}
