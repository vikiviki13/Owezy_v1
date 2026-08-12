import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Image, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { SettingsPage } from '../../components/SettingsUI';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/ToastContext';
import { getProfile, updateProfile } from '../../lib/db';
import { supabase } from '../../lib/supabase';

export function EditProfile() {
  const original = getProfile();
  const [name, setName] = useState(original.full_name);
  const [email, setEmail] = useState(original.email || '');
  const [phone, setPhone] = useState((original.phone || '').replace(/^\+91\s?/, ''));
  const [avatar, setAvatar] = useState(original.avatar_url || '');
  const [photoOpen, setPhotoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(true);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setVerified(Boolean(data.user?.email_confirmed_at))); }, []);
  const changed = name.trim() !== original.full_name || email.trim() !== (original.email || '') || phone.trim() !== (original.phone || '').replace(/^\+91\s?/, '') || avatar !== (original.avatar_url || '');
  const valid = name.trim().length > 0 && (!email || /^\S+@\S+\.\S+$/.test(email));

  function readPhoto(file?: File) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast('Choose a photo smaller than 3 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setAvatar(String(reader.result)); setPhotoOpen(false); };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!changed || !valid) return;
    setSaving(true);
    try {
      if (email.trim() && email.trim() !== original.email) {
        const { error } = await supabase.auth.updateUser({ email: email.trim() });
        if (error) throw error;
        setVerified(false);
      }
      updateProfile({ full_name: name.trim(), email: email.trim() || undefined, phone: phone.trim() ? `+91 ${phone.trim()}` : undefined, avatar_url: avatar || undefined });
      toast('Profile updated successfully');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not update profile');
    } finally { setSaving(false); }
  }

  return (
    <SettingsPage title="Edit Profile">
      <div className="flex flex-col items-center mb-7">
        <button onClick={() => setPhotoOpen(true)} className="relative" aria-label="Change profile photo">
          <Avatar name={name || 'You'} src={avatar} size={88} />
          <span className="absolute -right-1 -bottom-1 w-9 h-9 rounded-full bg-[var(--color-primary)] text-white border-4 border-[var(--color-bg)] flex items-center justify-center"><Camera size={16} /></span>
        </button>
        <button onClick={() => setPhotoOpen(true)} className="mt-3 text-sm font-semibold text-[var(--color-primary)] min-h-9">Change photo</button>
      </div>

      <label className="block mb-5"><span className="block text-sm font-semibold mb-2">Full Name <span className="text-[var(--color-error)]">*</span></span><input className="input min-h-12" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />{!name.trim() && <span className="text-xs text-[var(--color-error)] mt-1 block">Full name is required</span>}</label>
      <label className="block mb-5"><span className="block text-sm font-semibold mb-2">Email</span><input className="input min-h-12" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /><span className={`inline-flex items-center gap-1 text-xs mt-2 ${verified ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}><BadgeCheck size={14} /> {verified ? 'Verified' : 'Verification required'}</span>{email.trim() !== original.email && <p className="text-xs text-[var(--color-text-muted)] mt-1">We'll send a verification link to your new email.</p>}</label>
      <label className="block mb-28"><span className="block text-sm font-semibold mb-2">Phone Number <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></span><span className="flex"><span className="h-12 px-3 flex items-center border border-r-0 border-[var(--color-border)] rounded-l-xl bg-[var(--color-surface-secondary)] text-sm font-medium">+91</span><input className="input min-h-12 rounded-l-none" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9 ]/g, '').slice(0, 12))} placeholder="98765 43210" autoComplete="tel" /></span></label>

      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-20 bg-[var(--color-bg)]/95 backdrop-blur border-t border-[var(--color-border)] p-4 safe-bottom"><div className="max-w-2xl mx-auto"><button onClick={save} disabled={!changed || !valid || saving} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40">{saving ? 'Saving changes…' : 'Save Changes'}</button></div></div>

      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => readPhoto(e.target.files?.[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => readPhoto(e.target.files?.[0])} />
      <BottomSheet open={photoOpen} onClose={() => setPhotoOpen(false)} title="Profile Photo">
        <button onClick={() => cameraRef.current?.click()} className="w-full min-h-14 flex items-center gap-3 border-b border-[var(--color-border)]"><Camera size={19} /> <span className="font-medium">Take Photo</span></button>
        <button onClick={() => galleryRef.current?.click()} className="w-full min-h-14 flex items-center gap-3 border-b border-[var(--color-border)]"><Image size={19} /> <span className="font-medium">Choose Photo</span></button>
        <button onClick={() => { setAvatar(''); setPhotoOpen(false); }} disabled={!avatar} className="w-full min-h-14 flex items-center gap-3 text-[var(--color-error)] disabled:opacity-40"><Trash2 size={19} /> <span className="font-medium">Remove Photo</span></button>
      </BottomSheet>
    </SettingsPage>
  );
}
