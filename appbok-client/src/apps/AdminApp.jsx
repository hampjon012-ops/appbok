import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import Admin from '../pages/Admin.jsx';
import Invite from '../pages/Invite.jsx';

/**
 * Admin-subdomän (admin.appbok.se / admin.localhost).
 * Huvudsakligen inloggnings- och administrationsvyn för salongsägare.
 *
 * Routing: / och /admin → Admin-dashboard, /login, /invite/:token
 */
export default function AdminApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Admin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<Invite />} />
      </Routes>
    </BrowserRouter>
  );
}
