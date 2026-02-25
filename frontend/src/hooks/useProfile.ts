'use client';

/**
 * useProfile — manages per-wallet profile data stored in localStorage.
 *
 * Profile data is keyed by wallet address (lowercased) so each wallet
 * gets its own nickname and avatar independently.
 *
 * Storage schema:
 *   localStorage key: "claw_profile_<address>"
 *   value: JSON { nickname: string; avatarUrl: string }
 *
 * Usage:
 *   const { profile, setNickname, setAvatarUrl } = useProfile(address);
 */

import { useState, useEffect, useCallback } from 'react';

export interface Profile {
  nickname: string;
  avatarUrl: string;
}

const DEFAULT_PROFILE: Profile = {
  nickname: '',
  avatarUrl: '',
};

function storageKey(address: string): string {
  return `claw_profile_${address.toLowerCase()}`;
}

function loadProfile(address: string): Profile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '',
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(address: string, profile: Profile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(profile));
  } catch {
    // localStorage may be unavailable in private browsing
  }
}

export function useProfile(address: string | undefined) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  // Load from localStorage when address changes
  useEffect(() => {
    if (!address) {
      setProfile(DEFAULT_PROFILE);
      return;
    }
    setProfile(loadProfile(address));
  }, [address]);

  const setNickname = useCallback(
    (nickname: string) => {
      if (!address) return;
      const updated = { ...profile, nickname: nickname.trim().slice(0, 24) };
      setProfile(updated);
      saveProfile(address, updated);
    },
    [address, profile]
  );

  const setAvatarUrl = useCallback(
    (avatarUrl: string) => {
      if (!address) return;
      const updated = { ...profile, avatarUrl };
      setProfile(updated);
      saveProfile(address, updated);
    },
    [address, profile]
  );

  // Read nickname for any address (used by Tile to show owner nicknames)
  const getNickname = useCallback((addr: string): string => {
    return loadProfile(addr).nickname;
  }, []);

  const getAvatarUrl = useCallback((addr: string): string => {
    return loadProfile(addr).avatarUrl;
  }, []);

  return {
    profile,
    setNickname,
    setAvatarUrl,
    getNickname,
    getAvatarUrl,
  };
}
