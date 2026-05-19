"use client";

import { useState, type ReactNode } from "react";

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete: string;
  action?: ReactNode;
  helper?: ReactNode;
  minLength?: number;
  required?: boolean;
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M2.4 12s3.4-5.7 9.6-5.7 9.6 5.7 9.6 5.7-3.4 5.7-9.6 5.7S2.4 12 2.4 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function PasswordField({
  name,
  label,
  autoComplete,
  action,
  helper,
  minLength,
  required = true,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="auth-field">
      {action ? (
        <span className="auth-label-row">
          {label}
          {action}
        </span>
      ) : (
        label
      )}
      <span className="auth-password-wrap">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="auth-eye-button"
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          <EyeIcon />
        </button>
      </span>
      {helper ? <span className="auth-help">{helper}</span> : null}
    </label>
  );
}
