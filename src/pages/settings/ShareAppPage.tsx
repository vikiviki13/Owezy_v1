import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Link2, Mail, MessageCircle, MessageSquareText, MoreHorizontal, QrCode, Send, Share2 } from 'lucide-react';
import { SettingsPage, SettingsSection } from '../../components/SettingsUI';
import { useToast } from '../../components/ToastContext';
import { useSecurity } from '../../components/SecurityContext';
import {
  APP_SHARE_SHORT_TEXT,
  APP_SHARE_SUBJECT,
  buildAppShareMessage,
  buildAppShareUrl,
  buildEmailShareUrl,
  buildSmsShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  copyAppLink,
  openShareUrl,
  shareAppNatively,
} from '../../lib/share';

export function ShareAppSettings() {
  const toast = useToast();
  const { userId } = useSecurity();
  const url = buildAppShareUrl(userId);
  const message = buildAppShareMessage(url);
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let active = true;
    setQrError(false);
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#1c1917', light: '#ffffff' } })
      .then((dataUrl) => { if (active) setQrDataUrl(dataUrl); })
      .catch(() => { if (active) { setQrDataUrl(''); setQrError(true); } });
    return () => { active = false; };
  }, [url]);

  async function handleCopyLink() {
    const ok = await copyAppLink();
    toast(ok ? 'App link copied successfully.' : "Couldn't share the app. Please try again.");
  }

  async function handleNativeShare() {
    const result = await shareAppNatively('Owezy', APP_SHARE_SHORT_TEXT, url);
    if (result === 'failed') {
      toast("Couldn't share the app. Please try again.");
      await handleCopyLink();
    }
  }

  function handleWhatsApp() { openShareUrl(buildWhatsAppShareUrl(message)); }
  function handleTelegram() { openShareUrl(buildTelegramShareUrl(message, url)); }
  function handleSms() { openShareUrl(buildSmsShareUrl(message)); }
  function handleEmail() { openShareUrl(buildEmailShareUrl(APP_SHARE_SUBJECT, message)); }
  function handleMore() { void handleNativeShare(); }

  async function handleSaveQr() {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'owezy-qr.png';
    link.click();
    toast('QR code saved');
  }

  async function handleShareQr() {
    if (!qrDataUrl) return;
    try {
      const file = dataUrlToPngFile(qrDataUrl);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Owezy', text: APP_SHARE_SHORT_TEXT });
        return;
      }
      await handleCopyLink();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast("Couldn't share the app. Please try again.");
      await handleCopyLink();
    }
  }

  return (
    <SettingsPage title="Share App" description="Invite your friends to use Owezy and easily track shared expenses, repayments, and balances together.">
      <ShareIllustration />

      {canNativeShare && (
        <button
          onClick={() => void handleNativeShare()}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white font-semibold rounded-2xl py-3.5 mb-7"
        >
          <Share2 size={18} /> Share Now
        </button>
      )}

      <SettingsSection title="Share Options">
        <div className="grid grid-cols-3 gap-px bg-[var(--color-border)]">
          <ShareOption icon={<MessageCircle size={20} />} label="WhatsApp" color="#25D366" onClick={handleWhatsApp} />
          <ShareOption icon={<Send size={20} />} label="Telegram" color="#229ED9" onClick={handleTelegram} />
          <ShareOption icon={<MessageSquareText size={20} />} label="Messages" color="#3B82F6" onClick={handleSms} />
          <ShareOption icon={<Mail size={20} />} label="Email" color="#64748B" onClick={handleEmail} />
          <ShareOption icon={<Link2 size={20} />} label="Copy Link" color="#059669" onClick={() => void handleCopyLink()} />
          {canNativeShare && <ShareOption icon={<MoreHorizontal size={20} />} label="More..." color="#64748B" onClick={handleMore} />}
        </div>
      </SettingsSection>

      <SettingsSection title="Invite Message">
        <div className="px-4 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-[var(--color-text-secondary)]">{message}</pre>
        </div>
      </SettingsSection>

      <SettingsSection title="Share via QR Code">
        <div className="flex flex-col items-center px-4 py-5">
          {qrError ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">QR code could not be generated.</p>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code for the Owezy app" className="w-44 h-44 rounded-xl bg-white p-2" />
          ) : (
            <div className="w-44 h-44 rounded-xl bg-[var(--color-surface-secondary)] animate-pulse" />
          )}
          <p className="text-xs text-[var(--color-text-muted)] mt-3 mb-5 text-center">Scan from another phone to open the app and install it as a PWA.</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => void handleSaveQr()}
              disabled={!qrDataUrl}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold rounded-xl py-3 text-sm disabled:opacity-50"
            >
              <Download size={16} /> Save QR
            </button>
            <button
              onClick={() => void handleShareQr()}
              disabled={!qrDataUrl}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-surface-secondary)] font-semibold rounded-xl py-3 text-sm disabled:opacity-50"
            >
              <Share2 size={16} /> Share QR
            </button>
          </div>
        </div>
      </SettingsSection>

      <div className="flex items-center gap-2 justify-center mb-2 text-xs text-[var(--color-text-muted)]">
        <QrCode size={14} />
        <span>Recipients open the link in a browser and can install the app from there.</span>
      </div>
    </SettingsPage>
  );
}

function dataUrlToPngFile(dataUrl: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], 'owezy-qr.png', { type: mime });
}

function ShareOption({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 bg-[var(--color-surface)] py-4 active:bg-[var(--color-surface-secondary)] transition-colors">
      <span className="w-11 h-11 rounded-full grid place-items-center" style={{ backgroundColor: `${color}1A`, color }}>
        {icon}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ShareIllustration() {
  return (
    <div className="flex justify-center mb-7">
      <svg viewBox="0 0 240 150" className="w-56 h-auto" role="img" aria-label="Friends splitting an expense">
        <defs>
          <linearGradient id="shareBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-soft)" />
            <stop offset="100%" stopColor="var(--color-surface-secondary)" />
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="220" height="130" rx="24" fill="url(#shareBg)" />
        <circle cx="62" cy="86" r="22" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
        <circle cx="62" cy="78" r="9" fill="var(--color-primary)" />
        <path d="M44 108 Q62 96 80 108" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="178" cy="86" r="22" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
        <circle cx="178" cy="78" r="9" fill="var(--color-primary)" />
        <path d="M160 108 Q178 96 196 108" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
        <rect x="92" y="42" width="56" height="78" rx="8" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="2" />
        <path d="M106 56 h28 M106 66 h22 M106 76 h26 M106 86 h18 M106 96 h24" stroke="var(--color-primary-soft)" strokeWidth="4" strokeLinecap="round" />
        <path d="M98 98 L120 92 L142 98 L142 112 L120 106 L98 112 Z" fill="var(--color-primary)" opacity="0.85" />
        <circle cx="120" cy="99" r="3" fill="var(--color-surface)" />
        <path d="M120 62 v30" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
        <path d="M120 100 L126 96 M120 100 L114 96" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}