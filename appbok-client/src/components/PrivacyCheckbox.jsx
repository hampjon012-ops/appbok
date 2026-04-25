import React from 'react';

export default function PrivacyCheckbox({ checked, onChange }) {
  return (
    <div className="privacy-checkbox-block">
      <label className="privacy-checkbox-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="privacy-checkbox-input"
        />
        <span className="privacy-checkbox-track">
          <span className="privacy-checkbox-thumb" />
        </span>
        <span className="privacy-checkbox-text">
          Jag samtycker till att ta emot SMS-aviseringar om min bokning
        </span>
      </label>
      <p className="privacy-checkbox-hint">
        SMS skickas endast vid bokningsbekräftelse och eventuella ändringar.
      </p>
    </div>
  );
}