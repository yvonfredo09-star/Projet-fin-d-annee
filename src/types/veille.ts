export type VeilleDomain =
  | 'IA'
  | 'Cybersécurité'
  | 'Cloud'
  | 'Développement'
  | 'Appels à projets'
  | 'Recherche';

export type OpportunityType =
  | 'Appel à projets'
  | 'Appel d\'offres'
  | 'Partenariat'
  | 'Publication technique'
  | 'Alerte sécurité';

export type DedupMethod = 'url_canonique' | 'hash_sha256' | 'similarite_jaccard' | null;

export interface VeilleSource {
  id: string;
  name: string;
  url: string;
  defaultDomain: VeilleDomain;
  sourceType: 'RSS' | 'Atom' | 'OpenData';
  enabled: boolean;
  lastFetchedAt: string | null;
  lastStatus: string;
  itemCount: number;
}

export interface WatchKeyword {
  id: number;
  term: string;
  domain: VeilleDomain;
  weight: number;
}

export interface VeilleItem {
  id: string;
  title: string;
  canonicalUrl: string;
  originalUrl: string;
  contentHash: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  collectedAt: string;
  rawExcerpt: string;
  aiSummary: string;
  keyPoints: string[];
  domain: VeilleDomain;
  opportunityType: OpportunityType;
  matchedKeywords: string[];
  relevanceScore: number;
  aiEngine: string;
  humanRelevant: number | null; // 1 = pertinent, 0 = non pertinent, null = non évalué
  summaryRating: number | null; // 1 à 5
  isDuplicate: boolean;
  duplicateOfId: string | null;
  duplicateOfTitle?: string | null;
  dedupMethod: DedupMethod;
  similarityScore: number | null;
}

export interface CollectionRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  mode: 'live_rss' | 'snapshot' | 'hybride';
  sourcesCount: number;
  rawFetched: number;
  duplicatesRemoved: number;
  newItems: number;
  durationMs: number;
  status: 'succes' | 'partiel' | 'erreur';
  logSummary: string;
}

export interface BulletinRecord {
  id: string;
  title: string;
  cadence: 'quotidien' | 'hebdomadaire';
  periodLabel: string;
  createdAt: string;
  itemIds: string[];
  markdownContent: string;
  htmlContent: string;
}

export interface ScientificMetrics {
  totalRawCollected: number;
  uniqueRetained: number;
  duplicatesRemoved: number;
  deduplicationRate: number;
  dedupByMethod: {
    url_canonique: number;
    hash_sha256: number;
    similarite_jaccard: number;
  };
  evaluatedCount: number;
  relevantCount: number;
  precisionRate: number | null;
  avgSummaryRating: number | null;
  ratingDistribution: Array<{ rating: number; count: number }>;
  domainBreakdown: Array<{ domain: string; count: number; avgRelevance: number }>;
  sourceStats: Array<{
    sourceName: string;
    total: number;
    uniqueCount: number;
    duplicateCount: number;
    dedupRate: number;
  }>;
}

export interface PipelineSettings {
  scheduleCadence: 'manual' | 'hourly' | 'daily' | 'weekly';
  dedupThreshold: number;
  collectionMode: 'hybride' | 'snapshot' | 'live_rss';
  ollamaEndpoint: string;
  ollamaModel: string;
  preferLocalOllama: boolean;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: string;
  organization: string;
  createdAt: string;
  updatedAt: string;
}

