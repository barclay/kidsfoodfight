import type { CSSProperties, ReactNode } from 'react';

export type AppLocale = 'en' | 'es';

export const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: 0,
  marginBottom: 16,
  borderBottom: '1px solid #ccc',
};

export const tabStyle = (active: boolean): CSSProperties => ({
  padding: '8px 16px',
  cursor: 'pointer',
  border: 'none',
  background: active ? '#e5e5e5' : '#f5f5f5',
  borderBottom: active ? '2px solid #111' : '2px solid transparent',
  marginBottom: -1,
  fontWeight: active ? 600 : 400,
});

interface LocaleTabBarProps {
  value: AppLocale;
  onChange: (loc: AppLocale) => void;
  ariaLabel: string;
  /** e.g. re-translate controls, aligned to the end of the tab row */
  trailing?: ReactNode;
}

export function LocaleTabBar({ value, onChange, ariaLabel, trailing }: LocaleTabBarProps) {
  return (
    <div style={tabBarStyle} role="tablist" aria-label={ariaLabel}>
      {(['en', 'es'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          style={tabStyle(value === tab)}
          onClick={() => onChange(tab)}
        >
          {tab === 'en' ? 'En' : 'Es'}
        </button>
      ))}
      {trailing}
    </div>
  );
}
