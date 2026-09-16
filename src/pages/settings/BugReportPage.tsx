import { useRef, useState } from 'react';
import { Smartphone, Send } from 'lucide-react';
import { SettingsPage, SettingsSection } from '../../components/SettingsUI';
import { useToast } from '../../components/ToastContext';

const WHATSAPP_NUMBER = '918220514063';

export function BugReportPage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const isFormValid = description.trim().length >= 10;

  function handleFileClick() {
    fileInput.current?.click();
  }

  function handleSubmit() {
    const cleanDesc = description.trim().replace(/\s+/g, ' ');
    const cleanEmail = email.trim();

    if (!isFormValid) {
      toast('Please describe the issue in at least 10 characters');
      return;
    }

    const header = '🐛 Bug Report';
    const descLine = `*Description:*\\n${cleanDesc}`;
    const emailLine = cleanEmail ? `*Contact:*\\n${cleanEmail}` : '';

    const dateStr = new Date().toLocaleString();

    const body = [header, '', descLine, emailLine, '', `*Device Info:*\\n- Date: ${dateStr}\\n- OS: ${navigator.platform}\\n- Browser: ${navigator.userAgent}`].filter(Boolean).join('\n');

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
    toast('Redirecting to WhatsApp to send your report');
  }

  return (
    <SettingsPage
      title="Bug Report"
      description="Share details about any issue you're experiencing. This will open WhatsApp to send the report to the Owezy Team."
    >
      <SettingsSection title="Contact Information">
        <div className="px-4 py-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Your email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Issue Details">
        <div className="px-4 py-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Describe the problem</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What went wrong? What were you doing when it happened?"
            rows={5}
            className="w-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{description.length}/500 characters</p>
        </div>

        <div className="px-4 py-3">
          <button
            type="button"
            onClick={handleFileClick}
            className="w-full min-h-12 px-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-secondary)]"
          >
            <Smartphone size={16} />
            <span>{step === 1 ? 'Add screenshot (optional)' : 'Screenshot added'}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setStep(2);
                toast('Screenshot selected');
                e.target.value = '';
              }
            }}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Send Report">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="w-full min-h-12 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={16} />
          <span>Send via WhatsApp</span>
        </button>
        <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">
          This will redirect to WhatsApp Web or app. No data is stored on our servers.
        </p>
      </SettingsSection>
    </SettingsPage>
  );
}
