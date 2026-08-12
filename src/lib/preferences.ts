import type { UserPreferences } from '../types';

const now = () => new Date().toISOString();

export function defaultPreferences(userId = 'local-user'): UserPreferences {
  const timestamp = now();
  return {
    id: `preferences-${userId}`,
    user_id: userId,
    currency_code: 'INR',
    number_format: 'indian',
    decimal_display: 'automatic',
    date_format: 'DD MMM YYYY',
    time_format: '12h',
    week_starts_on: 'automatic',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    timezone_mode: 'automatic',
    language: 'en',
    theme: 'system',
    notifications_enabled: true,
    payment_reminders_enabled: true,
    pending_balance_reminders_enabled: true,
    app_updates_enabled: true,
    default_reminder_days: 3,
    default_reminder_time: '19:00',
    app_lock_enabled: false,
    auto_lock_duration: '5m',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

let snapshot = defaultPreferences();

export function setPreferenceSnapshot(value?: Partial<UserPreferences>) {
  snapshot = { ...defaultPreferences(value?.user_id), ...value };
}

export function getPreferenceSnapshot(): UserPreferences {
  return snapshot;
}
