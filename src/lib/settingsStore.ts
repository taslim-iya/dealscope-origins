import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  apolloApiKey: string;
  aiApiKey: string;
  aiProvider: 'openai' | 'claude';
  defaultColumns: string[];
}

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  apolloApiKey: 'p_k86JQdDzCm5G3aZqH6zg',
  aiApiKey: '',
  aiProvider: 'openai',
  defaultColumns: ['company_name', 'geography', 'industry', 'revenue', 'employees', 'website', 'status', 'director_name'],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    { name: 'dealscope-settings' }
  )
);
