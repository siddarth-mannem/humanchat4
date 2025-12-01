"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { compressImageFile } from '../utils/media';
import { initializeNotifications } from '../utils/notifications';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const AVATAR_KEY = 'humanchat.profile.avatar';
const CONTRAST_KEY = 'humanchat.contrast';
const FONT_KEY = 'humanchat.fontScale';

export default function ProfilePanel() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'enabled' | 'blocked'>('idle');
  const [contrast, setContrast] = useState<'normal' | 'high'>('normal');
  const [fontScale, setFontScale] = useState(1);
  const { canInstall, promptInstall, hasInstalled } = useInstallPrompt();

  useEffect(() => {
    const storedAvatar = window.localStorage.getItem(AVATAR_KEY);
    if (storedAvatar) setAvatar(storedAvatar);
    const storedContrast = (window.localStorage.getItem(CONTRAST_KEY) as 'normal' | 'high' | null) ?? 'normal';
    setContrast(storedContrast);
    document.documentElement.dataset.contrast = storedContrast === 'high' ? 'high' : 'normal';
    const storedFont = Number(window.localStorage.getItem(FONT_KEY)) || 1;
    setFontScale(storedFont);
    document.documentElement.style.setProperty('--font-scale', storedFont.toString());
  }, []);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result?.toString() ?? null;
      if (dataUrl) {
        setAvatar(dataUrl);
        window.localStorage.setItem(AVATAR_KEY, dataUrl);
      }
    };
    reader.readAsDataURL(compressed);
  };

  const handleNotificationEnable = async () => {
    const granted = await initializeNotifications();
    setNotificationStatus(granted ? 'enabled' : 'blocked');
  };

  const handleContrastToggle = () => {
    const next = contrast === 'high' ? 'normal' : 'high';
    setContrast(next);
    document.documentElement.dataset.contrast = next === 'high' ? 'high' : 'normal';
    window.localStorage.setItem(CONTRAST_KEY, next);
  };

  const handleFontScale = (value: number) => {
    setFontScale(value);
    document.documentElement.style.setProperty('--font-scale', value.toString());
    window.localStorage.setItem(FONT_KEY, value.toString());
  };

  return (
    <section className="flex min-h-[calc(100vh-64px)] flex-col gap-6 bg-gradient-to-b from-black/70 to-black/40 px-4 pb-24 pt-6 text-white">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-white/20">
          {avatar ? (
            <Image src={avatar} alt="Profile avatar" fill sizes="64px" className="object-cover" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-semibold" aria-hidden>
              HC
            </span>
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold">Your Account</h2>
          <p className="text-sm text-white/60">Update appearance and device integrations.</p>
        </div>
      </div>

      <label className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <span className="text-white/80">Upload avatar</span>
        <input type="file" accept="image/*" onChange={handleAvatarChange} className="text-white" />
        <span className="text-xs text-white/60">Images are compressed client-side for performance.</span>
      </label>

      <button
        type="button"
        className="rounded-2xl border border-white/15 bg-gradient-to-r from-indigoGlow/60 to-aqua/40 px-4 py-3 text-left text-sm font-semibold text-white"
        onClick={handleNotificationEnable}
      >
        Enable push notifications
        <div className="text-xs font-normal text-white/70">
          Status: {notificationStatus === 'enabled' ? 'Enabled' : notificationStatus === 'blocked' ? 'Blocked' : 'Not requested'}
        </div>
      </button>

      <button
        type="button"
        disabled={!canInstall || hasInstalled}
        onClick={() => promptInstall()}
        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/90 disabled:opacity-50"
      >
        {hasInstalled ? 'App installed' : canInstall ? 'Add to Home Screen' : 'Install prompt unavailable yet'}
      </button>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span>High contrast mode</span>
          <button
            type="button"
            onClick={handleContrastToggle}
            className="min-h-[44px] rounded-full border border-white/20 px-4 text-sm font-semibold"
          >
            {contrast === 'high' ? 'Disable' : 'Enable'}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/60">Respects system preference and improves readability.</p>
      </div>

      <label className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span>Font scale</span>
          <span className="text-xs text-white/60">{fontScale.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.9}
          max={1.3}
          step={0.05}
          value={fontScale}
          onChange={(event) => handleFontScale(Number(event.target.value))}
          className="w-full"
          aria-label="Adjust font scale"
        />
      </label>
    </section>
  );
}
