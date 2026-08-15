import { useState } from 'react';
import { ChevronDown, ExternalLink, Mail, MessageCircleQuestion, RefreshCw, Send, Sparkles } from 'lucide-react';
import { SettingsPage, SettingsSection } from '../../components/SettingsUI';
import { useToast } from '../../components/ToastContext';
import { APP_VERSION, latestReleaseNotes } from '../../lib/appRelease';
import { checkForAppUpdate } from '../../lib/pwaUpdate';

const HELP_TOPICS = [
  ['Getting Started', 'Set up your profile, add your first friend, and record an expense.'],
  ['Adding Expenses', 'Record what you paid, choose participants, and split the amount.'],
  ['Recording Payments', 'Mark money you receive so pending balances stay accurate.'],
  ['Creating Statements', 'Open a friend, choose Statement, then select a date range.'],
  ['Sharing Through WhatsApp', 'Preview a reminder or statement and choose WhatsApp. Sending is always initiated by you.'],
  ['Managing Friends', 'Add contact details, review balances, or archive people you no longer need.'],
  ['Installing the App', 'Open Install App from Profile and follow the prompt supported by your device.'],
  ['Managing Data', 'Export a backup, manage attachments, or clear temporary cached files.'],
  ['Frequently Asked Questions', 'Currency changes display labels only. Your original transaction amounts are never exchange-rate converted.'],
];

export function HelpSupport() {
  const toast = useToast();
  return <SettingsPage title="Help & Support" description="Find answers or get in touch with the Tab team.">
    <SettingsSection title="Help Topics">{HELP_TOPICS.map(([title, answer]) => <details key={title} className="group"><summary className="list-none min-h-14 px-4 py-3 flex items-center gap-3 cursor-pointer"><span className="flex-1 font-medium text-sm">{title}</span><ChevronDown size={17} className="text-[var(--color-text-muted)] transition-transform group-open:rotate-180" /></summary><p className="px-4 pb-4 text-xs leading-5 text-[var(--color-text-secondary)]">{answer}</p></details>)}</SettingsSection>
    <SettingsSection title="Contact">
      <SupportAction icon={Mail} title="Contact Support" onClick={() => { window.location.href = 'mailto:support@tab.app?subject=Tab%20Support'; }} />
      <SupportAction icon={MessageCircleQuestion} title="Report a Problem" onClick={() => { window.location.href = 'mailto:support@tab.app?subject=Problem%20Report'; }} />
      <SupportAction icon={Send} title="Send Feedback" onClick={() => toast('Thanks—your feedback helps make Tab better')} />
    </SettingsSection>
  </SettingsPage>;
}

function SupportAction({ icon: Icon, title, onClick }: { icon: typeof Mail; title: string; onClick: () => void }) { return <button onClick={onClick} className="w-full min-h-14 px-4 flex items-center gap-3 text-left"><Icon size={18} className="text-[var(--color-text-secondary)]" /><span className="flex-1 font-medium text-sm">{title}</span><ExternalLink size={15} className="text-[var(--color-text-muted)]" /></button>; }

export function AboutSettings() {
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const release = latestReleaseNotes();

  async function checkUpdates() {
    setChecking(true);
    try {
      const result = await checkForAppUpdate();
      if (result === 'unsupported') toast('Updates are managed by your browser');
      else if (result === 'update-found') toast('New update available');
      else toast("You're up to date");
    } catch {
      toast('Could not check for updates. Check your connection and try again.');
    } finally {
      setChecking(false);
    }
  }

  return <SettingsPage title="About"><div className="text-center py-7"><div className="w-18 h-18 rounded-3xl bg-[var(--color-primary)] text-white flex items-center justify-center text-3xl font-extrabold mx-auto shadow-lg shadow-emerald-900/15">O</div><h2 className="text-2xl font-extrabold mt-4">Owezy</h2><p className="text-sm text-[var(--color-text-secondary)] mt-1">Friend Expense Tracker</p><p className="text-xs text-[var(--color-text-muted)] mt-3">Version {APP_VERSION} · Build {import.meta.env.MODE}</p></div>
    <SettingsSection title="App Version">
      <button onClick={() => void checkUpdates()} disabled={checking} className="w-full min-h-14 px-4 flex items-center gap-3 text-left disabled:opacity-50">
        <RefreshCw size={18} className={`text-[var(--color-text-secondary)] ${checking ? 'animate-spin' : ''}`} />
        <span className="flex-1 text-sm font-medium">{checking ? 'Checking for updates…' : 'Check for Updates'}</span>
      </button>
    </SettingsSection>
    {release && (
      <SettingsSection title={`What's New in ${release.version}`}>
        <ul className="px-4 py-4 flex flex-col gap-2">
          {release.notes.map((note) => (
            <li key={note} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <Sparkles size={15} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </SettingsSection>
    )}
    <SettingsSection title="Legal"><LegalLink title="Privacy Policy" href="/privacy" /><LegalLink title="Terms of Service" href="/terms" /><LegalLink title="Open Source Licenses" href="/licenses" /></SettingsSection><p className="text-center text-xs text-[var(--color-text-muted)] mt-9">Made for clearer money conversations.</p></SettingsPage>;
}

function LegalLink({ title, href }: { title: string; href: string }) { return <a href={href} target="_blank" rel="noreferrer" className="min-h-14 px-4 flex items-center gap-3"><span className="flex-1 text-sm font-medium">{title}</span><ExternalLink size={16} className="text-[var(--color-text-muted)]" /></a>; }