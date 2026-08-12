import { useEffect, useState } from 'react';
import { Download, Moon, Sun, Monitor, LogOut, HelpCircle, Smartphone, Trash2, Cloud } from 'lucide-react';
import { getProfile, updateProfile, listFriends, listExpenses, listAllRepayments, resetDB, seedSampleData } from '../lib/db';
import { flushCloudData, stopCloudData } from '../lib/cloudData';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/ToastContext';

type Theme = 'light' | 'dark' | 'system';

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  useEffect(() => {
    function handler(e: any) { e.preventDefault(); setPrompt(e); }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return prompt;
}

export function Profile() {
  const profile = getProfile();
  const [name, setName] = useState(profile.full_name);
  const [theme, setTheme] = useState<Theme>((localStorage.getItem('tab_theme') as Theme) || 'system');
  const [signingOut, setSigningOut] = useState(false);
  const toast = useToast();
  const installPrompt = useInstallPrompt();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    localStorage.setItem('tab_theme', theme);
  }, [theme]);

  function saveName() {
    if (!name.trim()) return;
    updateProfile({ full_name: name.trim() });
    toast('Profile updated');
  }

  function exportData(format: 'csv' | 'json') {
    const friends = listFriends();
    const expenses = listExpenses();
    const repayments = listAllRepayments();
    let content: string;
    let filename: string;
    if (format === 'json') {
      content = JSON.stringify({ friends, expenses, repayments }, null, 2);
      filename = 'tab-export.json';
    } else {
      const rows = ['type,title,friend_or_method,amount,date'];
      expenses.forEach((e) => rows.push(`expense,"${e.title}",${e.category},${e.recoverable_amount},${e.expense_date}`));
      repayments.forEach((r) => rows.push(`repayment,"Payment",${r.payment_method},${r.amount},${r.repayment_date}`));
      content = rows.join('\n');
      filename = 'tab-export.csv';
    }
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast(`Exported as ${format.toUpperCase()}`);
  }

  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
  }

  function clearAll() {
    if (confirm('This clears all friends, expenses, and repayments from this account. Continue?')) {
      resetDB();
      toast('All data cleared');
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      try { await flushCloudData(); } catch { toast('Some changes could not be synced.'); }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      stopCloudData();
      window.location.reload();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not sign out');
      setSigningOut(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-10 safe-top">
      <h1 className="text-xl font-semibold mb-6">Profile</h1>
      <div className="flex items-center gap-4 mb-6">
        <Avatar name={profile.full_name} size={56} />
        <div className="flex-1"><input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} className="input" /></div>
      </div>

      {!installPrompt ? null : (
        <button onClick={install} className="w-full flex items-center gap-3 bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)] font-medium rounded-2xl p-4 mb-6">
          <Smartphone size={20} /><span className="flex-1 text-left">Install Tab on this device</span>
        </button>
      )}

      <Section title="Account">
        <Row label="Email" value={profile.email || 'Signed in'} />
        <div className="flex items-center gap-2 py-2 text-sm text-[var(--color-success)]"><Cloud size={16} /><span>Synced securely with Supabase</span></div>
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {([['light', Sun], ['dark', Moon], ['system', Monitor]] as [Theme, typeof Sun][]).map(([t, Icon]) => (
            <button key={t} onClick={() => setTheme(t)} className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border capitalize text-xs font-medium transition-colors ${theme === t ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
              <Icon size={17} /> {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Currency & format"><Row label="Default currency" value={profile.default_currency} /><Row label="Date format" value="DD MMM YYYY" /></Section>

      <Section title="Data">
        <div className="flex gap-2 mb-2">
          <button onClick={() => exportData('csv')} className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-medium rounded-xl py-2.5 text-sm"><Download size={15} /> Export CSV</button>
          <button onClick={() => exportData('json')} className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-medium rounded-xl py-2.5 text-sm"><Download size={15} /> Export JSON</button>
        </div>
        <button onClick={() => { seedSampleData(); toast('Sample data loaded'); }} className="w-full text-sm text-[var(--color-primary)] font-medium py-2">Load sample data</button>
      </Section>

      <Section title="Support"><button className="w-full flex items-center gap-3 py-2.5 text-left"><HelpCircle size={17} className="text-[var(--color-text-secondary)]" /><span className="text-sm font-medium">Help & feedback</span></button></Section>

      <button onClick={clearAll} className="w-full flex items-center justify-center gap-2 text-[var(--color-error)] font-medium py-3 mt-4 text-sm"><Trash2 size={16} /> Clear all data</button>
      <button onClick={signOut} disabled={signingOut} className="w-full flex items-center justify-center gap-2 text-[var(--color-text-muted)] disabled:opacity-60 font-medium py-2 text-sm"><LogOut size={16} /> {signingOut ? 'Signing out…' : 'Log out'}</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-6"><p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">{title}</p>{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-[var(--color-text-secondary)]">{label}</span><span className="font-medium truncate">{value}</span></div>;
}
