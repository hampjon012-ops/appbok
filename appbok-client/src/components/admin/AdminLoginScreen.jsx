import { Mail, Lock } from 'lucide-react';

const SUPPORT_EMAIL = 'support@appbok.se';

/**
 * Premium inloggning för admin.appbok.se — mörk yta, ljust kort, orange accent.
 */
export default function AdminLoginScreen({
  mode,
  onToggleMode,
  name,
  salonName,
  email,
  password,
  onNameChange,
  onSalonNameChange,
  onEmailChange,
  onPasswordChange,
  error,
  loading,
  onSubmit,
}) {
  const isRegister = mode === 'register';

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10 sm:py-14"
      style={{
        backgroundColor: '#111827',
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(234, 88, 12, 0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(17, 24, 39, 0.9) 0%, #111827 70%)',
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl border border-stone-200/80 bg-[#FDFDFD] px-8 py-9 sm:px-10 sm:py-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
      >
        {/* Logotyp */}
        <div className="flex flex-col items-center text-center">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/appbok-logo.png"
              alt="Appbok"
              className="h-10 w-auto object-contain sm:h-11"
            />
            <span
              className="h-1 w-14 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm"
              aria-hidden
            />
          </div>
          <h1
            className="mt-4 text-[1.5rem] sm:text-[1.625rem] font-semibold tracking-tight text-stone-900"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Administrationspanel
          </h1>
          <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-stone-500">
            Här loggar alla salonger och anställda in
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {isRegister && (
            <>
              <div>
                <label htmlFor="admin-login-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
                  Ditt namn
                </label>
                <input
                  id="admin-login-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Förnamn Efternamn"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25"
                />
              </div>
              <div>
                <label htmlFor="admin-login-salon" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
                  Salongens namn
                </label>
                <input
                  id="admin-login-salon"
                  type="text"
                  autoComplete="organization"
                  placeholder="T.ex. Studio Milano"
                  value={salonName}
                  onChange={(e) => onSalonNameChange(e.target.value)}
                  required
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="admin-login-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
              E-post
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                <Mail className="h-[18px] w-[18px] stroke-[1.75]" aria-hidden />
              </span>
              <input
                id="admin-login-email"
                type="email"
                autoComplete="email"
                placeholder="din.email@salong.se"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                required
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-login-password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-500">
              Lösenord
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                <Lock className="h-[18px] w-[18px] stroke-[1.75]" aria-hidden />
              </span>
              <input
                id="admin-login-password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25"
              />
            </div>
            <div className="mt-2 text-right">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=%C3%85terst%C3%A4ll%20l%C3%B6senord%20Appbok`}
                className="text-xs font-medium text-stone-500 underline-offset-2 transition hover:text-orange-600 hover:underline"
              >
                Glömt lösenord?
              </a>
            </div>
          </div>

          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-center text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-orange-600 py-3.5 text-center text-sm font-semibold tracking-wide text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Loggar in…' : isRegister ? 'Skapa konto' : 'Logga in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          {isRegister ? (
            <>
              Har du redan ett konto?{' '}
              <button
                type="button"
                onClick={() => onToggleMode('login')}
                className="font-medium text-orange-600 underline-offset-2 hover:underline"
              >
                Logga in
              </button>
            </>
          ) : (
            <>
              Har du inget konto?{' '}
              <button
                type="button"
                onClick={() => onToggleMode('register')}
                className="font-medium text-orange-600 underline-offset-2 hover:underline"
              >
                Skapa ett här
              </button>
            </>
          )}
        </p>

        <p className="mt-8 border-t border-stone-200/80 pt-6 text-center text-xs leading-relaxed text-stone-400">
          Problem med inloggningen?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Hj%C3%A4lp%20Appbok%20admin`}
            className="font-medium text-stone-500 underline-offset-2 hover:text-orange-600 hover:underline"
          >
            Kontakta supporten
          </a>
        </p>
      </div>
    </div>
  );
}
