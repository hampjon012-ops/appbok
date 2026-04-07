import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileBookingFrontend from '../MobileBookingFrontend.jsx';
import ThankYou from '../ThankYou.jsx';
import Terms from '../Terms.jsx';
import Login from '../pages/Login.jsx';
import Admin from '../pages/Admin.jsx';
import Invite from '../pages/Invite.jsx';
import { useSubdomain } from '../hooks/useSubdomain.js';
import SalonTenantNotFoundView from '../components/SalonTenantNotFoundView.jsx';

/**
 * Salongs-subdomän (t.ex. colorisma.appbok.se / colorisma.localhost).
 *
 * Salongen hämtas från Supabase i App-komponenten via:
 *   GET /api/salons/public?slug=<tenantSlug>
 *   (API:t slår först upp kolumnen `slug`, fallback till `subdomain`)
 *
 * Om subdomänen inte matchar någon salong → <SalonTenantNotFoundView />
 *
 * Routing: /, /preview/mobile, /tack, /villkor, /login, /admin, /invite/:token
 */
export default function TenantBookingApp() {
  const { tenantSlug } = useSubdomain();

  return (
    <BrowserRouter>
      <Routes>
        {/* Tenant-landing: MobileBookingFrontend hämtar rätt salong via
            fetchMergedSalonConfig → getImplicitHostSalonSlug() → /api/salons/public?slug=… */}
        <Route path="/" element={<MobileBookingFrontend />} />
        <Route path="/preview/mobile" element={<MobileBookingFrontend />} />
        <Route path="/tack" element={<ThankYou />} />
        <Route path="/villkor" element={<Terms />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/invite/:token" element={<Invite />} />
      </Routes>
    </BrowserRouter>
  );
}
