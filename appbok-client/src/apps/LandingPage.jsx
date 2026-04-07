import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileBookingFrontend from '../MobileBookingFrontend.jsx';
import ThankYou from '../ThankYou.jsx';
import Terms from '../Terms.jsx';
import Invite from '../pages/Invite.jsx';
import LoginRoute from '../components/LoginRoute.jsx';
import AdminApexRedirect from '../components/AdminApexRedirect.jsx';

/**
 * Basdomän (appbok.se / www.appbok.se / localhost).
 * Visar antingen:
 *  • boknings-UI för demosalongen Colorisma (appbok.se → colorisma.appbok.se redirect i index.html)
 *  • eller en framtida marknadsföringslandningssida
 *
 * Routing: /, /preview/mobile, /tack, /villkor, /login, /admin → admin.appbok.se, /invite/:token
 */
export default function LandingPage() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MobileBookingFrontend />} />
        <Route path="/preview/mobile" element={<MobileBookingFrontend />} />
        <Route path="/tack" element={<ThankYou />} />
        <Route path="/villkor" element={<Terms />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/admin" element={<AdminApexRedirect />} />
        <Route path="/invite/:token" element={<Invite />} />
      </Routes>
    </BrowserRouter>
  );
}
