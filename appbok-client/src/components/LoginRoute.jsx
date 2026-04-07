import { useLayoutEffect } from 'react';
import Login from '../pages/Login.jsx';
import { shouldRedirectToCanonicalAdminLogin, getAdminLoginUrl } from '../lib/adminUrls.js';

/**
 * Visar inloggning endast på admin.appbok.se (eller localhost / admin.localhost i dev).
 * Övriga appbok.se-värdar → omdirigering till admin.appbok.se/login.
 */
export default function LoginRoute() {
  const redirect = shouldRedirectToCanonicalAdminLogin();

  useLayoutEffect(() => {
    if (!redirect) return;
    const target = getAdminLoginUrl();
    if (window.location.href.split('#')[0] !== target.split('#')[0]) {
      window.location.replace(target);
    }
  }, [redirect]);

  if (redirect) {
    return <div className="loading-screen">Omdirigerar till inloggning…</div>;
  }

  return <Login />;
}
