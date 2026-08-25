import { useState } from 'react';

import { updateProfile } from '../lib/db';
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe';

/* ── Illustration for slide 0: "You pay." ── */
function PayIllustration() {
  return (
    <div className="relative w-full h-80 flex items-center justify-center shrink-0">
      {/* Background radial glow */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-[300px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0) 70%)' }}
      />

      {/* Background blob */}
      <div
        className="absolute w-[230px] h-[230px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, #ecfdf5 0%, #f0fdf4 60%, rgba(240,253,244,0) 100%)' }}
      />

      {/* Dotted ring */}
      <svg
        width="280" height="280"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 280 280"
      >
        <circle cx="140" cy="140" r="128" fill="none" stroke="#d1fae5" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
      </svg>

      {/* Floating dollar coin */}
      <div
        className="absolute top-5 left-7 w-12 h-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full flex items-center justify-center z-4"
        style={{ boxShadow: '0 8px 18px -4px rgba(28,25,23,0.14)', transform: 'rotate(-10deg)' }}
      >
        <span className="text-xl font-extrabold text-[var(--color-primary)]">$</span>
      </div>

      {/* Floating checkmark badge */}
      <div
        className="absolute top-8 right-6 w-10 h-10 bg-[var(--color-primary)] rounded-full flex items-center justify-center z-4"
        style={{ boxShadow: '0 6px 16px -4px rgba(5,150,105,0.5)', transform: 'rotate(8deg)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Floating "Paid" chip */}
      <div
        className="absolute bottom-9 left-5.5 z-4"
        style={{ transform: 'rotate(-6deg)' }}
      >
        <div
          className="bg-[var(--color-primary-soft)] border border-[#a7f3d0] rounded-[10px] px-2.5 py-1.5 flex items-center gap-1.5"
          style={{ boxShadow: '0 6px 14px -4px rgba(5,150,105,0.18)' }}
        >
          <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full" />
          <span className="text-[11px] font-semibold text-[var(--color-primary)]">Paid</span>
        </div>
      </div>

      {/* Accent dots */}
      <div className="absolute bottom-[60px] right-7 w-[9px] h-9 bg-[#a7f3d0] rounded-full" />
      <div className="absolute top-[100px] left-11 w-[5px] h-[5px] bg-[var(--color-border)] rounded-full" />

      {/* Payment card behind */}
      <div
        className="absolute w-[154px] h-[98px] rounded-2xl z-1 p-3.5"
        style={{
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          boxShadow: '0 14px 28px -8px rgba(5,150,105,0.4)',
          transform: 'rotate(10deg) translate(56px, 56px)',
          boxSizing: 'border-box',
        }}
      >
        <div className="w-[26px] h-[18px] bg-white/25 rounded-sm mb-4" />
        <div className="h-[5px] w-16 bg-white/40 rounded-[3px] mb-[5px]" />
        <div className="h-[5px] w-11 bg-white/25 rounded-[3px]" />
        <div
          className="absolute top-0 right-0 w-[60px] h-full rounded-r-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 100%)' }}
        />
      </div>

      {/* Receipt card (main) */}
      <div
        className="relative w-[182px] h-[226px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] z-2 p-4"
        style={{
          boxShadow: '0 24px 48px -12px rgba(28,25,23,0.18), 0 4px 12px rgba(28,25,23,0.05)',
          transform: 'rotate(-3deg)',
          boxSizing: 'border-box',
        }}
      >
        {/* Receipt header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 bg-[var(--color-primary-soft)] rounded-[9px] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <span className="text-[10.5px] font-semibold text-[var(--color-text-muted)]">Receipt</span>
          </div>
          <div className="bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-md px-2 py-0.5">
            <span className="text-[9px] font-semibold text-[var(--color-primary)]">Dinner</span>
          </div>
        </div>

        {/* Skeleton line items */}
        <div className="mb-3">
          {[
            { width: 'w-14', amount: '$22.00' },
            { width: 'w-11', amount: '$36.00' },
            { width: 'w-[50px]', amount: '$26.20' },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center mb-2 last:mb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-[5px] h-[5px] bg-[#a7f3d0] rounded-full" />
                <div className={`h-[5px] ${item.width} bg-[var(--color-border)] rounded-[3px]`} />
              </div>
              <span className="text-[10.5px] font-semibold text-[var(--color-text-primary)]">{item.amount}</span>
            </div>
          ))}
        </div>

        {/* Split avatars row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9.5px] text-[var(--color-text-muted)] font-medium">Split with</span>
          <div className="flex">
            {[
              { bg: '#ddd6fe', color: '#5b21b6', letter: 'A' },
              { bg: '#fde68a', color: '#92400e', letter: 'J' },
              { bg: '#fecaca', color: '#991b1b', letter: 'R' },
            ].map((avatar, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-[var(--color-surface)]"
                style={{
                  background: avatar.bg,
                  color: avatar.color,
                  marginLeft: i === 0 ? 0 : '-6px',
                }}
              >
                {avatar.letter}
              </div>
            ))}
          </div>
        </div>

        {/* Dashed divider */}
        <div className="border-t border-dashed border-[var(--color-border)] mb-3" />

        {/* Total row */}
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">Total paid</span>
          <span className="text-[15px] text-[var(--color-text-primary)] font-bold">$84.20</span>
        </div>
      </div>
    </div>
  );
}

/* ── Illustration for slide 1: "Track what friends owe you." ── */
function TrackIllustration() {
  const friends = [
    { initials: 'JM', bg: '#fde68a', color: '#92400e', amount: '+$32', nameW: 'w-12', subW: 'w-8', hasDot: true },
    { initials: 'AK', bg: '#ddd6fe', color: '#5b21b6', amount: '+$18', nameW: 'w-10', subW: 'w-7', hasDot: true },
    { initials: 'RL', bg: '#fecaca', color: '#991b1b', amount: '+$14', nameW: 'w-11', subW: 'w-[30px]', hasDot: false },
  ];

  return (
    <div className="relative w-full h-80 flex items-center justify-center shrink-0">
      {/* Background blob */}
      <div
        className="absolute w-[230px] h-[230px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, #ecfdf5 0%, #f0fdf4 60%, rgba(240,253,244,0) 100%)' }}
      />

      {/* Dotted ring */}
      <svg
        width="280" height="280"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 280 280"
      >
        <circle cx="140" cy="140" r="128" fill="none" stroke="#d1fae5" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
      </svg>

      {/* Floating avatar — top left */}
      <div className="absolute top-[18px] left-6 z-4" style={{ transform: 'rotate(-10deg)' }}>
        <div className="relative">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold border-[3px] border-white"
            style={{ background: '#fde68a', color: '#92400e', boxShadow: '0 8px 18px -4px rgba(28,25,23,0.15)' }}
          >JM</div>
          <div className="absolute bottom-[1px] right-[1px] w-[11px] h-[11px] bg-[var(--color-primary)] rounded-full border-[2.5px] border-[var(--color-bg)]" />
        </div>
      </div>

      {/* Floating avatar — top right */}
      <div className="absolute top-7 right-5 z-4" style={{ transform: 'rotate(8deg)' }}>
        <div className="relative">
          <div
            className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13px] font-bold border-[3px] border-white"
            style={{ background: '#ddd6fe', color: '#5b21b6', boxShadow: '0 6px 16px -4px rgba(28,25,23,0.14)' }}
          >AK</div>
          <div className="absolute bottom-[1px] right-[1px] w-[10px] h-[10px] bg-[var(--color-primary)] rounded-full border-[2.5px] border-[var(--color-bg)]" />
        </div>
      </div>

      {/* Floating "owes you" chip — bottom right */}
      <div className="absolute bottom-[30px] right-5 z-4" style={{ transform: 'rotate(5deg)' }}>
        <div
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-[7px] flex items-center gap-1.5"
          style={{ boxShadow: '0 8px 18px -4px rgba(28,25,23,0.12)' }}
        >
          <div className="w-[7px] h-[7px] bg-[var(--color-primary)] rounded-full" />
          <span className="text-[11px] font-semibold text-[var(--color-primary)]">+$32 owed</span>
        </div>
      </div>

      {/* Accent dots */}
      <div className="absolute bottom-14 left-[26px] w-[9px] h-[9px] bg-[#a7f3d0] rounded-full" />
      <div className="absolute top-[104px] left-[42px] w-[5px] h-[5px] bg-[var(--color-border)] rounded-full" />

      {/* Mini contact card behind */}
      <div
        className="absolute w-[144px] h-[88px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl z-1 p-3.5"
        style={{
          boxShadow: '0 10px 24px -8px rgba(28,25,23,0.10)',
          transform: 'rotate(10deg) translate(56px, 62px)',
          boxSizing: 'border-box',
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#fecaca', color: '#991b1b' }}>RL</div>
          <div className="h-[6px] w-[52px] bg-[var(--color-border)] rounded-[3px]" />
        </div>
        <div className="flex justify-between items-center">
          <div className="h-[5px] w-10 bg-[var(--color-surface-secondary)] rounded-[3px]" />
          <span className="text-[11px] font-bold text-[var(--color-primary)]">+$18</span>
        </div>
      </div>

      {/* Main balance list card */}
      <div
        className="relative w-[186px] h-[232px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] z-2 p-4"
        style={{
          boxShadow: '0 24px 48px -12px rgba(28,25,23,0.18), 0 4px 12px rgba(28,25,23,0.05)',
          transform: 'rotate(-3deg)',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 bg-[var(--color-primary-soft)] rounded-[9px] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="text-[10.5px] font-semibold text-[var(--color-text-secondary)]">Balances</span>
          </div>
          <div className="bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-md px-2 py-0.5">
            <span className="text-[9px] font-semibold text-[var(--color-primary)]">3 friends</span>
          </div>
        </div>

        {/* Friend rows */}
        {friends.map((f, i) => (
          <div
            key={i}
            className={`flex items-center justify-between mb-2.5 pb-2.5 ${
              i < friends.length - 1 ? 'border-b border-[var(--color-surface-secondary)]' : 'mb-3'
            }`}
          >
            <div className="flex items-center gap-2">
              {f.hasDot ? (
                <div className="relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: f.bg, color: f.color }}
                  >{f.initials}</div>
                  <div className="absolute -bottom-[1px] -right-[1px] w-[9px] h-[9px] bg-[var(--color-primary)] rounded-full border-2 border-[var(--color-surface)]" />
                </div>
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: f.bg, color: f.color }}
                >{f.initials}</div>
              )}
              <div>
                <div className={`h-[6px] ${f.nameW} bg-[var(--color-border)] rounded-[3px] mb-1`} />
                <div className={`h-1 ${f.subW} bg-[var(--color-surface-secondary)] rounded-[3px]`} />
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--color-primary)]">{f.amount}</span>
          </div>
        ))}

        {/* Dashed divider */}
        <div className="border-t border-dashed border-[var(--color-border)] mb-2.5" />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">You're owed</span>
          <span className="text-[15px] text-[var(--color-primary)] font-bold">$64.00</span>
        </div>
      </div>
    </div>
  );
}

/* ── Illustration for slide 2: "Record repayments & share statements." ── */
function ShareIllustration() {
  return (
    <div className="relative w-full h-80 flex items-center justify-center shrink-0">
      {/* Background blob */}
      <div
        className="absolute w-[230px] h-[230px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, #ecfdf5 0%, #f0fdf4 60%, rgba(240,253,244,0) 100%)' }}
      />

      {/* Dotted ring */}
      <svg
        width="280" height="280"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 280 280"
      >
        <circle cx="140" cy="140" r="128" fill="none" stroke="#d1fae5" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
      </svg>

      {/* Floating WhatsApp badge — top left */}
      <div
        className="absolute top-4 left-6 w-12 h-12 rounded-full flex items-center justify-center z-4"
        style={{ background: '#25d366', boxShadow: '0 8px 18px -4px rgba(37,211,102,0.5)', transform: 'rotate(-10deg)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.12 1.528 5.847L.057 23.5a.5.5 0 0 0 .611.63l5.79-1.517A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.58-.504-5.064-1.382l-.363-.214-3.761.986.999-3.648-.236-.374A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      </div>

      {/* Floating "Sent!" reply bubble — top right */}
      <div className="absolute top-[22px] right-[18px] z-4" style={{ transform: 'rotate(8deg)' }}>
        <div
          className="bg-[#dcfce7] border border-[#a7f3d0] rounded-[14px_14px_4px_14px] px-3 py-[9px]"
          style={{ boxShadow: '0 6px 14px -4px rgba(5,150,105,0.2)' }}
        >
          <div className="flex items-center gap-[5px]">
            <div className="w-4 h-4 bg-[var(--color-primary)] rounded-full flex items-center justify-center shrink-0">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[11px] font-bold text-[var(--color-primary)]">Paid!</span>
          </div>
        </div>
      </div>

      {/* Floating share chip — bottom left */}
      <div className="absolute bottom-7 left-[18px] z-4" style={{ transform: 'rotate(-6deg)' }}>
        <div
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-[7px] flex items-center gap-1.5"
          style={{ boxShadow: '0 8px 18px -4px rgba(28,25,23,0.12)' }}
        >
          <div className="w-5 h-5 bg-[var(--color-primary)] rounded-md flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">Shared</span>
        </div>
      </div>

      {/* Accent dots */}
      <div className="absolute bottom-14 right-7 w-[9px] h-[9px] bg-[#a7f3d0] rounded-full" />
      <div className="absolute top-[108px] left-[42px] w-[5px] h-[5px] bg-[var(--color-border)] rounded-full" />

      {/* WhatsApp chat card behind */}
      <div
        className="absolute w-[148px] h-[96px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl z-1 p-3.5"
        style={{
          boxShadow: '0 10px 24px -8px rgba(28,25,23,0.10)',
          transform: 'rotate(10deg) translate(56px, 60px)',
          boxSizing: 'border-box',
        }}
      >
        <div className="flex items-center gap-[7px] mb-2.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#25d366' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-primary)]">Alex K.</span>
        </div>
        <div className="bg-[#dcfce7] rounded-[8px_8px_8px_2px] px-[9px] py-2">
          <div className="h-[5px] w-[82px] bg-[#a7f3d0] rounded-[3px] mb-1" />
          <div className="h-[5px] w-[60px] bg-[#a7f3d0] rounded-[3px]" />
        </div>
      </div>

      {/* Main statement card */}
      <div
        className="relative w-[186px] h-[232px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] z-2 p-4"
        style={{
          boxShadow: '0 24px 48px -12px rgba(28,25,23,0.18), 0 4px 12px rgba(28,25,23,0.05)',
          transform: 'rotate(-3deg)',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 bg-[var(--color-primary-soft)] rounded-[9px] flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="text-[10.5px] font-semibold text-[var(--color-text-secondary)]">Statement</span>
          </div>
          <div className="bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-md px-2 py-0.5">
            <span className="text-[9px] font-semibold text-[var(--color-primary)]">July</span>
          </div>
        </div>

        {/* Friend row */}
        <div className="flex items-center gap-2 mb-3 pb-[11px] border-b border-[var(--color-surface-secondary)]">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: '#ddd6fe', color: '#5b21b6' }}>AK</div>
          <div className="flex-1">
            <div className="h-[6px] w-[52px] bg-[var(--color-border)] rounded-[3px] mb-1" />
            <div className="h-1 w-9 bg-[var(--color-surface-secondary)] rounded-[3px]" />
          </div>
          <div className="w-2 h-2 bg-[#a7f3d0] rounded-full" />
        </div>

        {/* Transaction rows */}
        <div className="mb-2.5">
          {[
            { dot: '#a7f3d0', width: 'w-[54px]', amount: '$24.00', color: 'var(--color-text-primary)' },
            { dot: '#a7f3d0', width: 'w-[42px]', amount: '$18.50', color: 'var(--color-text-primary)' },
            { dot: '#fca5a5', width: 'w-12', amount: '-$10.00', color: 'var(--color-error)' },
          ].map((tx, i) => (
            <div key={i} className="flex items-center justify-between mb-[7px] last:mb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-[5px] h-[5px] rounded-full" style={{ background: tx.dot }} />
                <div className={`h-[5px] ${tx.width} bg-[var(--color-border)] rounded-[3px]`} />
              </div>
              <span className="text-[10.5px] font-semibold" style={{ color: tx.color }}>{tx.amount}</span>
            </div>
          ))}
        </div>

        {/* Dashed divider */}
        <div className="border-t border-dashed border-[var(--color-border)] mb-2.5" />

        {/* Total + send */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-[var(--color-text-muted)] font-medium mb-0.5">Owes you</div>
            <span className="text-[15px] text-[var(--color-primary)] font-bold">$32.50</span>
          </div>
          <div
            className="bg-[var(--color-primary)] rounded-[10px] px-2.5 py-[7px] flex items-center gap-[5px]"
            style={{ boxShadow: '0 4px 10px -2px rgba(5,150,105,0.4)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span className="text-[10px] font-semibold text-white">Send</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Slide definitions ── */
const SLIDES = [
  {
    render: () => <PayIllustration />,
    title: 'You pay.',
    body: 'Cover the bill at dinner, on a trip, wherever — record it in seconds.',
  },
  {
    render: () => <TrackIllustration />,
    title: 'Track what friends owe you.',
    body: 'Every friend has a running balance, calculated automatically.',
  },
  {
    render: () => <ShareIllustration />,
    title: 'Record repayments & share statements.',
    body: 'Send a clean summary over WhatsApp whenever you like.',
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  useHorizontalSwipe({
    onSwipeLeft: () => setStep((current) => Math.min(current + 1, SLIDES.length - 1)),
    onSwipeRight: () => setStep((current) => Math.max(current - 1, 0)),
  }, !showProfile);

  function finish() {
    updateProfile({ full_name: name.trim() || 'You', default_currency: 'INR', onboarding_completed: true });
    onDone();
  }

  if (showProfile) {
    return (
      <div className="min-h-screen flex flex-col safe-top relative overflow-hidden">
        {/* Background radial glow */}
        <div
          className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[320px] h-[320px] pointer-events-none z-0"
          style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.07) 0%, rgba(5,150,105,0) 70%)' }}
        />

        <div className="flex-1 flex flex-col px-6 pt-4 relative z-1">
          {/* Progress pip */}
          <div className="flex justify-center mb-6">
            <div className="w-10 h-1 bg-[var(--color-primary)] rounded-full" style={{ boxShadow: '0 1px 3px rgba(5,150,105,0.35)' }} />
          </div>

          {/* Illustration scene */}
          <div className="relative w-full h-[230px] flex items-center justify-center mb-6 shrink-0">
            {/* Background blob */}
            <div
              className="absolute w-[200px] h-[200px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: 'radial-gradient(circle, #ecfdf5 0%, #f0fdf4 60%, rgba(240,253,244,0) 100%)' }}
            />

            {/* Dotted ring */}
            <svg width="250" height="250" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" viewBox="0 0 250 250">
              <circle cx="125" cy="125" r="114" fill="none" stroke="#d1fae5" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
            </svg>

            {/* Floating wave badge — top left */}
            <div
              className="absolute top-[10px] left-5 w-[46px] h-[46px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex items-center justify-center z-4"
              style={{ boxShadow: '0 8px 18px -4px rgba(28,25,23,0.13)', transform: 'rotate(-10deg)' }}
            >
              <span className="text-[22px] leading-none">&#x1F44B;</span>
            </div>

            {/* Floating avatar stack — top right */}
            <div className="absolute top-4 right-4 z-4" style={{ transform: 'rotate(6deg)' }}>
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-[2.5px] border-white"
                  style={{ background: '#ddd6fe', color: '#5b21b6', boxShadow: '0 4px 10px -2px rgba(28,25,23,0.12)' }}
                >A</div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-[2.5px] border-white -ml-2"
                  style={{ background: '#fde68a', color: '#92400e', boxShadow: '0 4px 10px -2px rgba(28,25,23,0.12)' }}
                >J</div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border-[2.5px] border-white -ml-2 bg-[var(--color-primary-soft)]"
                  style={{ boxShadow: '0 4px 10px -2px rgba(28,25,23,0.12)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              </div>
              <div className="mt-[5px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1" style={{ boxShadow: '0 3px 8px -2px rgba(28,25,23,0.09)' }}>
                <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">Your group</span>
              </div>
            </div>

            {/* Floating "You're in!" chip — bottom right */}
            <div className="absolute bottom-5 right-4 z-4" style={{ transform: 'rotate(5deg)' }}>
              <div
                className="bg-[var(--color-primary-soft)] border border-[#a7f3d0] rounded-xl px-3 py-[7px] flex items-center gap-1.5"
                style={{ boxShadow: '0 6px 14px -4px rgba(5,150,105,0.2)' }}
              >
                <div className="w-4 h-4 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-[var(--color-primary)]">You're in!</span>
              </div>
            </div>

            {/* Accent dots */}
            <div className="absolute bottom-11 left-[22px] w-[9px] h-[9px] bg-[#a7f3d0] rounded-full" />
            <div className="absolute top-24 left-9 w-[5px] h-[5px] bg-[var(--color-border)] rounded-full" />
            <div className="absolute bottom-7 left-[54px] w-[5px] h-[5px] bg-[#d1fae5] rounded-full" />

            {/* Mini balance stub card behind */}
            <div
              className="absolute w-[138px] h-[80px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl z-1 p-3.5"
              style={{
                boxShadow: '0 8px 20px -6px rgba(28,25,23,0.10)',
                transform: 'rotate(9deg) translate(52px, 48px)',
                boxSizing: 'border-box',
              }}
            >
              <div className="flex items-center gap-[7px] mb-[9px]">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#fecaca', color: '#991b1b' }}>R</div>
                <div className="h-[6px] w-12 bg-[var(--color-border)] rounded-[3px]" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-[5px] w-9 bg-[var(--color-surface-secondary)] rounded-[3px]" />
                <span className="text-[11px] font-bold text-[var(--color-primary)]">+$22</span>
              </div>
            </div>

            {/* Main profile setup card */}
            <div
              className="relative w-[186px] h-[218px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] z-2 p-4"
              style={{
                boxShadow: '0 24px 48px -12px rgba(28,25,23,0.18), 0 4px 12px rgba(28,25,23,0.05)',
                transform: 'rotate(-3deg)',
                boxSizing: 'border-box',
              }}
            >
              {/* App brand strip */}
              <div
                className="rounded-[10px] px-3 py-[9px] mb-3.5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
              >
                <span className="text-[10px] font-bold text-white/95 tracking-widest">OWEZY</span>
                <div className="flex gap-[3px]">
                  <div className="w-[5px] h-[5px] bg-white/50 rounded-full" />
                  <div className="w-[5px] h-[5px] bg-white/30 rounded-full" />
                  <div className="w-[5px] h-[5px] bg-white/20 rounded-full" />
                </div>
              </div>

              {/* Avatar + name area */}
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-[1.5px] border-[#a7f3d0]" style={{ background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="h-[7px] bg-[var(--color-border)] rounded-[4px] mb-[5px] relative overflow-hidden">
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-[var(--color-primary)] rounded-[1px]" />
                  </div>
                  <div className="h-[5px] w-11 bg-[var(--color-surface-secondary)] rounded-[3px]" />
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-1.5 mb-3">
                <div className="flex-1 bg-[var(--color-surface-secondary)] rounded-lg px-2 py-[7px]">
                  <div className="text-[9px] text-[var(--color-text-muted)] font-medium mb-[3px]">Expenses</div>
                  <div className="text-[13px] font-bold text-[var(--color-text-primary)]">0</div>
                </div>
                <div className="flex-1 bg-[var(--color-surface-secondary)] rounded-lg px-2 py-[7px]">
                  <div className="text-[9px] text-[var(--color-text-muted)] font-medium mb-[3px]">Friends</div>
                  <div className="text-[13px] font-bold text-[var(--color-text-primary)]">0</div>
                </div>
                <div className="flex-1 bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-lg px-2 py-[7px]">
                  <div className="text-[9px] text-[var(--color-primary)] font-medium mb-[3px]">Owed</div>
                  <div className="text-[13px] font-bold text-[var(--color-primary)]">{'\u20B9'}0</div>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="border-t border-dashed border-[var(--color-border)] mb-2.5" />

              {/* Currency + edit row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-[var(--color-primary-soft)] rounded-[5px] flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[var(--color-primary)]">{'\u20B9'}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">INR</span>
                </div>
                <div className="bg-[var(--color-primary)] rounded-[7px] px-[9px] py-1 flex items-center gap-1">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span className="text-[10px] font-semibold text-white">Edit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="max-w-[342px] w-full mx-auto">
            <h1 className="text-[24px] font-bold mb-1 text-[var(--color-text-primary)] tracking-tight">What should we call you?</h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">You can change this anytime in Profile.</p>

            {/* Name input with icon */}
            <div className="relative mb-3">
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="input pl-[38px]"
                onKeyDown={(e) => e.key === 'Enter' && finish()}
              />
            </div>

            {/* Currency note */}
            <div className="flex items-center gap-1.5 mb-5">
              <span className="text-sm text-[var(--color-text-secondary)]">Default currency:</span>
              <span className="inline-flex items-center bg-[var(--color-primary-soft)] border border-[#d1fae5] rounded-full px-2.5 py-0.5 text-[13px] font-semibold text-[var(--color-primary)]">INR {'\u20B9'}</span>
            </div>

            {/* Actions */}
            <button onClick={finish} className="w-full bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5 mb-2" style={{ boxShadow: '0 4px 12px -2px rgba(5,150,105,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              Get Started
            </button>
            <button onClick={finish} className="w-full text-sm text-[var(--color-text-muted)] font-medium py-2">Skip for now</button>
          </div>
        </div>
      </div>
    );
  }

  const slide = SLIDES[step];
  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-10 safe-top">
      <div className="flex justify-end">
        <button onClick={() => setShowProfile(true)} className="text-sm font-medium text-[var(--color-text-muted)]">Skip</button>
      </div>
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        {slide.render ? (
          slide.render()
        ) : (
          <div className="w-20 h-20 rounded-3xl bg-[var(--color-primary-soft)] flex items-center justify-center mb-6">
            {slide.icon && <slide.icon size={34} className="text-[var(--color-primary)]" />}
          </div>
        )}
        <h1 className="text-2xl font-bold mb-2">{slide.title}</h1>
        <p className="text-[var(--color-text-secondary)]">{slide.body}</p>
      </div>
      <div>
        <div className="flex justify-center gap-1.5 mb-6">
          {SLIDES.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[var(--color-primary)]' : 'w-1.5 bg-[var(--color-border)]'}`} />
          ))}
        </div>
        <button
          onClick={() => (step < SLIDES.length - 1 ? setStep(step + 1) : setShowProfile(true))}
          className="w-full max-w-sm mx-auto block bg-[var(--color-primary)] text-white font-medium rounded-xl py-3.5"
        >
          {step < SLIDES.length - 1 ? 'Next' : "Let's go"}
        </button>
      </div>
    </div>
  );
}
