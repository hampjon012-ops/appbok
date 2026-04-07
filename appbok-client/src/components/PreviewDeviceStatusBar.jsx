/** Ikonstorlek motsvarar w-4 h-4 (16px); färg neutral-900. */

function PreviewSignalIcon() {
  return (
    <svg
      className="preview-device-status-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="3" y="14" width="3.5" height="6" rx="1" />
      <rect x="8.25" y="11" width="3.5" height="9" rx="1" />
      <rect x="13.5" y="8" width="3.5" height="12" rx="1" />
      <rect x="18.75" y="5" width="3.5" height="15" rx="1" />
    </svg>
  );
}

function PreviewWifiIcon() {
  return (
    <svg
      className="preview-device-status-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}

function PreviewBatteryIcon() {
  return (
    <svg
      className="preview-device-status-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="7" width="15" height="10" rx="2" />
      <path d="M17 11v2" strokeLinecap="round" />
      <rect x="4" y="9" width="9" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * iOS-lik statusrad endast i admin mobil-preview (preview_embed=1).
 * Bakgrund = samma yta som innehållskortet (--bg-color).
 */
export default function PreviewDeviceStatusBar() {
  return (
    <div className="preview-device-status-bar" aria-hidden>
      <span className="preview-device-status-time">09:41</span>
      <div className="preview-device-status-notch" />
      <div className="preview-device-status-icons">
        <PreviewSignalIcon />
        <PreviewWifiIcon />
        <PreviewBatteryIcon />
      </div>
    </div>
  );
}
