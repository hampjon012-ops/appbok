import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import Admin from '../pages/Admin.jsx';
import Invite from '../pages/Invite.jsx';
import MobileBookingFrontend from '../MobileBookingFrontend.jsx';

/**
 * Admin-subdomän (admin.appbok.se / admin.localhost).
 * Huvudsakligen inloggnings- och administrationsvyn för salongsägare.
 *
 * Routing: / och /admin → Admin-dashboard, /login, /invite/:token
 * /preview/mobile → samma boknings-UI som basdomänen (iframe för tema live preview)
 */
export default function AdminApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Admin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/dashboard" element={<Admin />} />
        <Route path="/preview/mobile" element={<MobileBookingFrontend />} />
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<Invite />} />
      </Routes>
    </BrowserRouter>
  );
}
