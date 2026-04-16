import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  searchCriteria: {
    industries: string[];
    geographies: string[];
    revenueMin: number | null;
    revenueMax: number | null;
    employeesMin: number | null;
    employeesMax: number | null;
    keywords: string[];
    description: string;
  };
  assignedCompanyIds: string[];
  created_at: string;
  updated_at: string;
}

interface ClientState {
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  assignCompanies: (clientId: string, companyIds: string[]) => void;
  unassignCompany: (clientId: string, companyId: string) => void;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set) => ({
      clients: [],
      addClient: (client) =>
        set((state) => ({ clients: [...state.clients, client] })),
      updateClient: (id, updates) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
          ),
        })),
      deleteClient: (id) =>
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id) })),
      assignCompanies: (clientId, companyIds) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  assignedCompanyIds: [...new Set([...c.assignedCompanyIds, ...companyIds])],
                  updated_at: new Date().toISOString(),
                }
              : c
          ),
        })),
      unassignCompany: (clientId, companyId) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  assignedCompanyIds: c.assignedCompanyIds.filter((id) => id !== companyId),
                  updated_at: new Date().toISOString(),
                }
              : c
          ),
        })),
    }),
    { name: 'dealscope-clients-v1' }
  )
);
