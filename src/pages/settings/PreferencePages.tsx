import { useMemo, useState } from 'react';
import { Check, Clock3, Monitor, Moon, Search, Sun } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { ChoiceRow, SettingsPage, SettingsSection } from '../../components/SettingsUI';
import { usePreferences } from '../../components/PreferencesContext';
import { useToast } from '../../components/ToastContext';
import type { CurrencyCode, DateFormat, NumberFormat, ThemePreference, TimeFormat, WeekStartsOn } from '../../types';
import { currencySymbol, formatCurrency, formatDate, formatTimestamp, formatTimestampDate, formatTimestampTime } from '../../lib/utils';
import { APP_NAME } from '../../components/Brand';

const CURRENCIES: { code: CurrencyCode; name: string; region: string; flag: string; keywords?: string }[] = [
  { code: 'INR', name: 'Indian Rupee', region: 'India', flag: '🇮🇳', keywords: '₹ rupee' },
  { code: 'USD', name: 'US Dollar', region: 'United States', flag: '🇺🇸', keywords: '$ dollar' },
  { code: 'GBP', name: 'British Pound', region: 'United Kingdom', flag: '🇬🇧', keywords: '£ pound sterling' },
  { code: 'EUR', name: 'Euro', region: 'European Union', flag: '🇪🇺', keywords: '€ euro' },
  { code: 'AED', name: 'UAE Dirham', region: 'United Arab Emirates', flag: '🇦🇪', keywords: 'dirham' },
  { code: 'SGD', name: 'Singapore Dollar', region: 'Singapore', flag: '🇸🇬', keywords: 'S$ dollar' },
];

export function CurrencySettings() {
  const { preferences, updatePreferences } = usePreferences();
  const [search, setSearch] = useState('');
  const toast = useToast();
  const selected = CURRENCIES.find((currency) => currency.code === preferences.currency_code) || CURRENCIES[0];
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? CURRENCIES : CURRENCIES.filter((c) => `${c.name} ${c.code} ${c.keywords}`.toLowerCase().includes(q));
  }, [search]);

  function choose(code: CurrencyCode) {
    updatePreferences({ currency_code: code });
    toast('Currency updated');
  }

  return (
    <SettingsPage title="Currency" description="Choose how monetary values are displayed throughout the app.">
      <div className="rounded-2xl bg-[var(--color-primary-soft)] border border-[color:var(--color-primary)]/20 p-4 mb-6 flex items-center gap-3">
        <span className="text-3xl">{selected.flag}</span><div className="flex-1"><p className="text-xs font-semibold text-[var(--color-primary)] mb-1">CURRENT CURRENCY</p><p className="font-bold">{selected.name}</p><p className="text-sm text-[var(--color-text-secondary)]">{selected.code} · {currencySymbol(selected.code)}</p></div><span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]"><Check size={15} /> Selected</span>
      </div>

      <label className="relative block mb-6"><Search size={18} className="absolute left-3.5 top-3.5 text-[var(--color-text-muted)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search currency or code" className="input min-h-12 pl-11" /></label>

      <SettingsSection title={search ? 'Search Results' : 'Suggested Currencies'}>
        {results.map((currency) => <CurrencyRow key={currency.code} currency={currency} selected={currency.code === preferences.currency_code} onClick={() => choose(currency.code)} />)}
        {!results.length && <p className="p-5 text-sm text-center text-[var(--color-text-muted)]">No matching currency</p>}
      </SettingsSection>

      <SettingsSection title="Number Format">
        {(['indian', 'international'] as NumberFormat[]).map((format) => (
          <ChoiceRow key={format} selected={preferences.number_format === format} title={format === 'indian' ? 'Indian' : 'International'} description={format === 'indian' ? `${currencySymbol()}1,23,456.78` : `${currencySymbol()}123,456.78`} onClick={() => { updatePreferences({ number_format: format }); toast('Number format updated'); }} />
        ))}
      </SettingsSection>

      <SettingsSection title="Decimal Places">
        {([['automatic', 'Automatic', 'Hides .00, but keeps meaningful decimals'], ['0', '0', formatCurrency(450)], ['2', '2', `${currencySymbol()}450.00`]] as const).map(([value, title, preview]) => (
          <ChoiceRow key={value} selected={preferences.decimal_display === value} title={title} description={preview} onClick={() => { updatePreferences({ decimal_display: value }); toast('Decimal display updated'); }} />
        ))}
      </SettingsSection>
      <p className="text-xs leading-5 text-[var(--color-text-muted)] px-1">Changing currency changes display labels only. Existing amounts are not converted using exchange rates, and recorded transactions retain their original currency.</p>
    </SettingsPage>
  );
}

function CurrencyRow({ currency, selected, onClick }: { currency: typeof CURRENCIES[number]; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} className="w-full min-h-[66px] flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--color-surface-secondary)]"><span className="text-2xl">{currency.flag}</span><span className="flex-1"><span className="block font-semibold text-[15px]">{currency.name}</span><span className="block text-xs text-[var(--color-text-muted)] mt-1">{currency.code} · {currencySymbol(currency.code)}</span></span>{selected && <Check size={19} className="text-[var(--color-primary)]" strokeWidth={3} />}</button>;
}

const DATE_OPTIONS: { value: DateFormat; label: string; recommended?: boolean }[] = [
  { value: 'DD MMM YYYY', label: 'Recommended', recommended: true },
  { value: 'DD/MM/YYYY', label: 'Numeric Day First' },
  { value: 'MM/DD/YYYY', label: 'Numeric Month First' },
  { value: 'YYYY-MM-DD', label: 'ISO' },
  { value: 'DD MMM YY', label: 'Short' },
];

export function DateTimeSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const date = '2026-08-12';
  const previewMoment = '2026-08-12T08:33:00.000Z';
  const expenseMoment = '2026-08-12T15:15:00.000Z';
  const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  return (
    <SettingsPage title="Date & Time">
      <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-7">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)] mb-3">Preview</p>
        <p className="font-bold text-xl">Wednesday, {formatTimestampDate(previewMoment)}</p><p className="text-2xl font-extrabold mt-1">{formatTimestampTime(previewMoment)}</p>
        <div className="border-t border-[var(--color-border)] mt-4 pt-4"><p className="font-semibold text-sm">Dinner with Arun</p><p className="text-xs text-[var(--color-text-muted)] mt-1">{formatTimestamp(expenseMoment)}</p></div>
      </div>

      <SettingsSection title="Date Format">
        {DATE_OPTIONS.map((option) => <ChoiceRow key={option.value} selected={preferences.date_format === option.value} title={formatDate(date, option.value)} description={`${option.value}${option.recommended ? ' · Recommended' : ''}`} onClick={() => { updatePreferences({ date_format: option.value }); toast('Date format updated'); }} />)}
      </SettingsSection>

      <SettingsSection title="Time Format">
        {([['12h', '12-hour', '2:03 PM'], ['24h', '24-hour', '14:03']] as [TimeFormat, string, string][]).map(([value, title, preview]) => <ChoiceRow key={value} selected={preferences.time_format === value} title={title} description={preview} onClick={() => { updatePreferences({ time_format: value }); toast('Time format updated'); }} />)}
      </SettingsSection>

      <SettingsSection title="First Day of Week">
        {([['automatic', 'Automatic'], ['monday', 'Monday'], ['sunday', 'Sunday']] as [WeekStartsOn, string][]).map(([value, title]) => <ChoiceRow key={value} selected={preferences.week_starts_on === value} title={title} onClick={() => { updatePreferences({ week_starts_on: value }); toast('Week start updated'); }} />)}
      </SettingsSection>

      <SettingsSection title="Time Zone">
        <button onClick={() => setTimezoneOpen(true)} className="w-full min-h-[72px] px-4 py-3 flex items-center gap-3 text-left"><Clock3 size={19} className="text-[var(--color-text-secondary)]" /><span className="flex-1"><span className="font-semibold block">{preferences.timezone_mode === 'automatic' ? 'Automatic' : preferences.timezone}</span><span className="text-xs text-[var(--color-text-muted)] mt-1 block">{preferences.timezone_mode === 'automatic' ? detectedZone : preferences.timezone} ({zoneOffset(preferences.timezone_mode === 'automatic' ? detectedZone : preferences.timezone)})</span></span></button>
      </SettingsSection>
      <p className="text-xs leading-5 text-[var(--color-text-muted)] px-1">Transaction moments are stored in UTC. Changing your time zone updates their display, not when they happened.</p>

      <BottomSheet open={timezoneOpen} onClose={() => setTimezoneOpen(false)} title="Time Zone">
        {[['automatic', detectedZone], ['manual', 'Asia/Kolkata'], ['manual', 'Europe/London'], ['manual', 'America/New_York'], ['manual', 'Asia/Singapore']].map(([mode, zone], index) => {
          const active = mode === 'automatic' ? preferences.timezone_mode === 'automatic' : preferences.timezone_mode === 'manual' && preferences.timezone === zone;
          return <ChoiceRow key={`${mode}-${zone}-${index}`} selected={active} title={mode === 'automatic' ? 'Automatic' : zone} description={mode === 'automatic' ? `${detectedZone} (${zoneOffset(detectedZone)})` : zoneOffset(zone)} onClick={() => { updatePreferences({ timezone_mode: mode as 'automatic' | 'manual', timezone: zone }); setTimezoneOpen(false); toast('Time zone updated'); }} />;
        })}
      </BottomSheet>
    </SettingsPage>
  );
}

function zoneOffset(zone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value.replace('GMT', 'GMT') || 'GMT';
  } catch { return 'GMT'; }
}

export function AppearanceSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const options: { value: ThemePreference; title: string; text: string; icon: typeof Sun }[] = [
    { value: 'system', title: 'System Default', text: 'Follow your device setting', icon: Monitor },
    { value: 'light', title: 'Light', text: 'Always use light theme', icon: Sun },
    { value: 'dark', title: 'Dark', text: 'Always use dark theme', icon: Moon },
  ];
  return <SettingsPage title="Appearance" description={`Choose how ${APP_NAME} looks on this device.`}><div className="grid gap-3">{options.map(({ value, title, text, icon: Icon }) => <button key={value} onClick={() => { updatePreferences({ theme: value }); toast('Appearance updated'); }} className={`relative min-h-32 rounded-2xl border-2 p-4 text-left overflow-hidden ${preferences.theme === value ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}><div className="flex items-start justify-between"><span className="w-10 h-10 rounded-xl bg-[var(--color-surface-secondary)] flex items-center justify-center"><Icon size={20} /></span>{preferences.theme === value && <span className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center"><Check size={15} /></span>}</div><p className="font-bold mt-4">{title}</p><p className="text-xs text-[var(--color-text-muted)] mt-1">{text}</p></button>)}</div></SettingsPage>;
}

export function LanguageSettings() {
  return <SettingsPage title="Language" description="Choose the language used throughout the app."><SettingsSection title="Available Languages"><ChoiceRow selected title="English" description="English" onClick={() => undefined} /></SettingsSection><p className="text-xs leading-5 text-[var(--color-text-muted)] px-1">More languages are coming later. {APP_NAME}'s interface is prepared for localization.</p></SettingsPage>;
}
