import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  clientId: string;
  templateId: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface OutreachItem {
  id: string;
  campaignId: string;
  companyId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  status: 'pending' | 'sent' | 'opened' | 'replied' | 'bounced';
  personalizedSubject: string | null;
  personalizedBody: string | null;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
}

interface OutreachState {
  templates: EmailTemplate[];
  campaigns: OutreachCampaign[];
  items: OutreachItem[];
  addTemplate: (t: EmailTemplate) => void;
  updateTemplate: (id: string, updates: Partial<EmailTemplate>) => void;
  deleteTemplate: (id: string) => void;
  addCampaign: (c: OutreachCampaign) => void;
  updateCampaign: (id: string, updates: Partial<OutreachCampaign>) => void;
  deleteCampaign: (id: string) => void;
  addItems: (items: OutreachItem[]) => void;
  updateItem: (id: string, updates: Partial<OutreachItem>) => void;
  deleteItem: (id: string) => void;
  getItemsByCampaign: (campaignId: string) => OutreachItem[];
}

export const useOutreachStore = create<OutreachState>()(
  persist(
    (set, get) => ({
      templates: [],
      campaigns: [],
      items: [],
      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
      updateTemplate: (id, updates) =>
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      addCampaign: (c) => set((s) => ({ campaigns: [...s.campaigns, c] })),
      updateCampaign: (id, updates) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
          ),
        })),
      deleteCampaign: (id) =>
        set((s) => ({
          campaigns: s.campaigns.filter((c) => c.id !== id),
          items: s.items.filter((i) => i.campaignId !== id),
        })),
      addItems: (newItems) => set((s) => ({ items: [...s.items, ...newItems] })),
      updateItem: (id, updates) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
      deleteItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      getItemsByCampaign: (campaignId) => get().items.filter((i) => i.campaignId === campaignId),
    }),
    { name: 'dealscope-outreach-v1' }
  )
);
