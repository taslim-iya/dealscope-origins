/**
 * InsightEngine connection — reads enrichment data via localStorage bridge.
 * Both apps run in the same browser, so we use localStorage for cross-app messaging.
 */

export const INSIGHT_URL_DEFAULT = 'https://insighta9.netlify.app';
const STORAGE_KEY = 'insightengine-to-dealscope';
const ENRICH_QUEUE_KEY = 'dealscope-enrich-queue';
const CONFIG_KEY = 'dealscope-insight-config';

export interface InsightEnrichment {
  company_name: string;
  enriched_at: string;
  data: Record<string, any>;
  score?: number;
  tags?: string[];
}

export interface InsightConfig {
  apiUrl: string;
}

export function getInsightConfig(): InsightConfig {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return { apiUrl: INSIGHT_URL_DEFAULT };
  try {
    return JSON.parse(raw);
  } catch {
    return { apiUrl: INSIGHT_URL_DEFAULT };
  }
}

export function saveInsightConfig(config: InsightConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** Pull enrichment data from InsightEngine via localStorage bridge */
export function getInsightEnrichments(): InsightEnrichment[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Check if InsightEngine has pushed any data */
export function isInsightConnected(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Request enrichment for a specific company */
export function requestEnrichment(companyName: string): void {
  const queue = JSON.parse(localStorage.getItem(ENRICH_QUEUE_KEY) || '[]');
  queue.push({
    company_name: companyName,
    requested_at: new Date().toISOString(),
  });
  localStorage.setItem(ENRICH_QUEUE_KEY, JSON.stringify(queue));
}

/** Request enrichment for multiple companies */
export function requestBulkEnrichment(companyNames: string[]): void {
  const queue = JSON.parse(localStorage.getItem(ENRICH_QUEUE_KEY) || '[]');
  const now = new Date().toISOString();
  for (const name of companyNames) {
    queue.push({ company_name: name, requested_at: now });
  }
  localStorage.setItem(ENRICH_QUEUE_KEY, JSON.stringify(queue));
}
