import App from './App.jsx';

/**
 * Mobil bokningsstartsida — samma implementation som `/`.
 * Används explicit i routen `/preview/mobile` (admin live-preview iframe) så vi inte duplicerar UI.
 */
export default App;

export function MobileBookingFrontend() {
  return <App />;
}
