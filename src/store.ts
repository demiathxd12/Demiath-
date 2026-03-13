import { create } from 'zustand';
import { Chat, UserProfile } from './types';

interface AppState {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  currentUserProfile: UserProfile | null;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id, isSettingsOpen: false }),
  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen, activeChatId: null }),
  currentUserProfile: null,
  setCurrentUserProfile: (profile) => {
    if (profile?.theme) {
      set({ theme: profile.theme });
      document.documentElement.classList.toggle('dark', profile.theme === 'dark');
    }
    set({ currentUserProfile: profile });
  },
  theme: 'light',
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },
}));
