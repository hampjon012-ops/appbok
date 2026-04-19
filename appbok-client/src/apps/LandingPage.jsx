import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import MobileBookingFrontend from '../MobileBookingFrontend.jsx';
import ThankYou from '../ThankYou.jsx';
import Terms from '../Terms.jsx';
import Invite from '../pages/Invite.jsx';
import LoginRoute from '../components/LoginRoute.jsx';
import AdminApexRedirect from '../components/AdminApexRedirect.jsx';
import MarketingLanding from '../pages/MarketingLanding.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import BookingCancel from '../BookingCancel.jsx';

/** Apex / med ?slug= / ?salon_id= → boknings-UI (samma som tidigare index.html-läge). Annars marknadsföring. */
function ApexHomeRoute() {
  const [searchParams] = useSearchParams();
  const hasSalonQuery =
    searchParams.has('slug') ||
    searchParams.has('demo') ||
    searchParams.has('salon_id') ||
    searchParams.has('salonId');
  if (hasSalonQuery) return <MobileBookingFrontend />;
  return <MarketingLanding />;
}

/**
 * Basdomän (appbok.se / www.appbok.se / localhost).
 * Visar:
 *  • marknadsföringslandningssida på /
 *  • boknings-UI för demosalongen Colorisma på /preview/mobile
 *
 * Routing: /, /preview/mobile, /tack, /villkor, /login, /admin → admin.appbok.se, /invite/:token, /cancel/:id
 */
export default function LandingPage() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ApexHomeRoute />} />
        <Route path="/preview/mobile" element={<MobileBookingFrontend />} />
        <Route path="/tack" element={<ThankYou />} />
        <Route path="/villkor" element={<Terms />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/onboarding" element={<SignupPage />} />
        <Route path="/signup" element={<Navigate to="/onboarding" replace />} />
        <Route path="/admin" element={<AdminApexRedirect />} />
        <Route path="/admin/dashboard" element={<AdminApexRedirect />} />
        <Route path="/admin/schema" element={<AdminApexRedirect />} />
        <Route path="/admin/tjanster" element={<AdminApexRedirect />} />
        <Route path="/cancel/:id" element={<BookingCancel />} />
        <Route path="/invite/:token" element={<Invite />} />
      </Routes>
    </BrowserRouter>
  );
}
