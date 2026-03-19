'use client';

import { useState } from 'react';

interface PasswordInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
  label: string;
}

export function PasswordInput({ id, name, value, onChange, required, minLength, label }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
        htmlFor={id}
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          className="w-full rounded px-3 py-2 pr-10 text-sm focus:outline-none transition-shadow"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-active)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-sm px-1"
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
          tabIndex={-1}
        >
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
