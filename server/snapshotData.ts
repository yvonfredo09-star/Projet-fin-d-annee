export interface RawFeedEntry {
  sourceId: string;
  sourceName: string;
  title: string;
  link: string;
  publishedAt: string;
  excerpt: string;
  fallbackDomain: 'IA' | 'Cybersécurité' | 'Cloud' | 'Développement' | 'Appels à projets' | 'Recherche';
}

export const DEFAULT_SOURCES = [
  {
    id: 'src-certfr',
    name: 'CERT-FR (ANSSI)',
    url: 'https://www.cert.ssi.gouv.fr/avis/feed/',
    defaultDomain: 'Cybersécurité' as const,
    sourceType: 'RSS' as const,
    enabled: true,
  },
  {
    id: 'src-inria',
    name: 'Inria — Recherche & Innovation',
    url: 'https://www.inria.fr/fr/rss.xml',
    defaultDomain: 'Recherche' as const,
    sourceType: 'RSS' as const,
    enabled: true,
  },
  {
    id: 'src-arxiv-ai',
    name: 'arXiv cs.AI / Machine Learning',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    defaultDomain: 'IA' as const,
    sourceType: 'RSS' as const,
    enabled: true,
  },
  {
    id: 'src-cncf',
    name: 'CNCF Cloud Native Blog',
    url: 'https://www.cncf.io/blog/feed/',
    defaultDomain: 'Cloud' as const,
    sourceType: 'RSS' as const,
    enabled: true,
  },
  {
    id: 'src-boamp-anr',
    name: 'ANR & Horizon Europe Appels',
    url: 'https://anr.fr/fr/actualites-rss/',
    defaultDomain: 'Appels à projets' as const,
    sourceType: 'RSS' as const,
    enabled: true,
  },
];

export const DEFAULT_KEYWORDS = [
  { term: 'intelligence artificielle', domain: 'IA', weight: 3 },
  { term: 'LLM', domain: 'IA', weight: 3 },
  { term: 'RAG', domain: 'IA', weight: 2 },
  { term: 'vulnérabilité', domain: 'Cybersécurité', weight: 3 },
  { term: 'zero-day', domain: 'Cybersécurité', weight: 3 },
  { term: 'ANSSI', domain: 'Cybersécurité', weight: 2 },
  { term: 'Kubernetes', domain: 'Cloud', weight: 2 },
  { term: 'cloud souverain', domain: 'Cloud', weight: 3 },
  { term: 'appel à projets', domain: 'Appels à projets', weight: 3 },
  { term: 'Horizon Europe', domain: 'Appels à projets', weight: 3 },
  { term: 'marché public', domain: 'Appels à projets', weight: 2 },
  { term: 'open source', domain: 'Développement', weight: 2 },
  { term: 'TypeScript', domain: 'Développement', weight: 1 },
  { term: 'partenariat R&D', domain: 'Recherche', weight: 3 },
];

// Jeu de données enregistré pour démonstration reproductible (Précaution particulière du projet 7)
// Inclut volontairement 4 doublons inter-sources ou à paramètres UTM pour démontrer et mesurer la déduplication.
export const RECORDED_SNAPSHOT_ENTRIES: RawFeedEntry[] = [
  {
    sourceId: 'src-boamp-anr',
    sourceName: 'ANR & Horizon Europe Appels',
    title: 'Appel à projets ANR IA-Cluster 2026 : Architectures frugales et souveraines pour modèles de fondation',
    link: 'https://anr.fr/fr/appels/aap-ia-cluster-2026-architectures-frugales',
    publishedAt: '2026-11-12T08:30:00Z',
    excerpt: 'L\'Agence Nationale de la Recherche ouvre un appel à projets doté de 18 M€ visant les consortiums laboratoires-entreprises développant des modèles de langage frugaux déployables sur infrastructure locale (on-premise). Clôture des dossiers : 24 janvier 2027.',
    fallbackDomain: 'Appels à projets',
  },
  {
    sourceId: 'src-certfr',
    sourceName: 'CERT-FR (ANSSI)',
    title: 'CERTFR-2026-AVI-1042 : Vulnérabilité critique dans les passerelles VPN d\'entreprise et conteneurs Kubernetes',
    link: 'https://www.cert.ssi.gouv.fr/avis/CERTFR-2026-AVI-1042/',
    publishedAt: '2026-11-12T10:15:00Z',
    excerpt: 'Une vulnérabilité de type exécution de code arbitraire à distance (CVSS 9.8) affecte plusieurs implémentations de contrôleurs ingress Kubernetes et passerelles SSL. Le CERT-FR recommande l\'application immédiate du correctif v2.14.3.',
    fallbackDomain: 'Cybersécurité',
  },
  {
    sourceId: 'src-inria',
    sourceName: 'Inria — Recherche & Innovation',
    title: 'Partenariat R&D Inria – Industrie : Vérification formelle des agents LLM dans les systèmes critiques',
    link: 'https://www.inria.fr/fr/partenariat-verification-formelle-agents-llm-2026',
    publishedAt: '2026-11-11T14:20:00Z',
    excerpt: 'Le programme de transfert technologique d\'Inria sollicite des partenaires industriels PME et ETI pour co-développer des garde-fous déterministes pour pipelines RAG et orchestration multi-agents en environnement certifié.',
    fallbackDomain: 'Recherche',
  },
  {
    sourceId: 'src-cncf',
    sourceName: 'CNCF Cloud Native Blog',
    title: 'Kubernetes 1.35 : Isolation renforcée des charges IA multi-locataires et eBPF natif',
    link: 'https://www.cncf.io/blog/2026/11/11/kubernetes-1-35-multi-tenant-ai-ebpf/',
    publishedAt: '2026-11-11T16:00:00Z',
    excerpt: 'La nouvelle mouture majeure de Kubernetes introduit le support natif du cloisonnement mémoire GPU pour l\'inférence distribuée ainsi qu\'un plan de données réseau accéléré par eBPF sans sidecar.',
    fallbackDomain: 'Cloud',
  },
  {
    sourceId: 'src-arxiv-ai',
    sourceName: 'arXiv cs.AI / Machine Learning',
    title: 'Hybrid Semantic-Lexical Deduplication for Real-Time Scientific News Streams Using Lightweight Embeddings',
    link: 'https://arxiv.org/abs/2611.04821',
    publishedAt: '2026-11-11T09:05:00Z',
    excerpt: 'This paper evaluates a two-stage deduplication architecture combining SHA-256 canonical URL hashing and trigram Jaccard similarity with compact quantized language models, achieving 96.4% precision with sub-15ms latency per document.',
    fallbackDomain: 'IA',
  },
  {
    sourceId: 'src-boamp-anr',
    sourceName: 'ANR & Horizon Europe Appels',
    title: 'Marché public de R&D : Plateforme souveraine de détection de menaces zero-day par analyse comportementale',
    link: 'https://anr.fr/fr/marches/detection-menaces-zero-day-2026',
    publishedAt: '2026-11-10T11:45:00Z',
    excerpt: 'Consultation ouverte pour la conception d\'une sonde réseau open source couplée à un moteur d\'inférence local pour l\'analyse des flux chiffrés sans déchiffrement intrusif. Budget estimé : 650 k€ sur 24 mois.',
    fallbackDomain: 'Appels à projets',
  },
  {
    sourceId: 'src-cncf',
    sourceName: 'CNCF Cloud Native Blog',
    title: 'OpenTelemetry & FinOps : Mesurer l\'empreinte carbone et le coût GPU des pipelines RAG en production',
    link: 'https://www.cncf.io/blog/2026/11/09/opentelemetry-finops-rag-gpu/',
    publishedAt: '2026-11-09T13:10:00Z',
    excerpt: 'Retour d\'expérience sur l\'instrumentation standardisée des requêtes d\'embeddings et de génération avec OpenTelemetry, permettant de réduire de 38% la consommation énergétique des clusters d\'inférence.',
    fallbackDomain: 'Développement',
  },
  {
    sourceId: 'src-inria',
    sourceName: 'Inria — Recherche & Innovation',
    title: 'Appel à candidatures Horizon Europe CL4 : Cybersécurité post-quantique pour réseaux industriels',
    link: 'https://www.inria.fr/fr/horizon-europe-cl4-cybersecurite-post-quantique',
    publishedAt: '2026-11-09T09:00:00Z',
    excerpt: 'La Commission européenne lance un appel collaboratif de 25 M€ dédié à la migration des protocoles industriels vers la cryptographie post-quantique standardisée (ML-KEM, ML-DSA). Recherche de coordinateurs techniques.',
    fallbackDomain: 'Appels à projets',
  },
  {
    sourceId: 'src-certfr',
    sourceName: 'CERT-FR (ANSSI)',
    title: 'Bulletin d\'actualité CERT-FR : Campagne de compromission ciblant les workflows d\'automatisation exposés',
    link: 'https://www.cert.ssi.gouv.fr/actualite/CERTFR-2026-ACT-088/',
    publishedAt: '2026-11-08T17:30:00Z',
    excerpt: 'L\'ANSSI observe une recrudescence d\'attaques exploitant des webhooks et instances d\'automatisation n8n ou CI/CD mal cloisonnés. Recommandations de durcissement, rotation des jetons OAuth et filtrage réseau.',
    fallbackDomain: 'Cybersécurité',
  },
  {
    sourceId: 'src-arxiv-ai',
    sourceName: 'arXiv cs.AI / Machine Learning',
    title: 'Benchmarking Small Local Language Models (Ollama 7B-14B) on Structured French Technical Summarization',
    link: 'https://arxiv.org/abs/2611.03190',
    publishedAt: '2026-11-08T07:50:00Z',
    excerpt: 'Comparative study of quantized open-weights models deployed via Ollama on consumer hardware for automated technology watch, measuring factual faithfulness, JSON schema adherence, and French synthesis fluency.',
    fallbackDomain: 'IA',
  },
  // --- DOUBLONS INTENTIONNELS POUR VALIDATION SCIENTIFIQUE ---
  // Doublon 1 : Même URL avec paramètres UTM
  {
    sourceId: 'src-boamp-anr',
    sourceName: 'ANR & Horizon Europe Appels',
    title: 'Appel à projets ANR IA-Cluster 2026 : Architectures frugales et souveraines pour modèles de fondation',
    link: 'https://anr.fr/fr/appels/aap-ia-cluster-2026-architectures-frugales?utm_source=newsletter&utm_medium=rss',
    publishedAt: '2026-11-12T08:35:00Z',
    excerpt: 'Relais de l\'appel à projets ANR IA-Cluster 2026 doté de 18 M€ pour les modèles de fondation frugaux.',
    fallbackDomain: 'Appels à projets',
  },
  // Doublon 2 : Titre légèrement reformulé cross-posté entre Inria et ANR (attrapé par similarité Jaccard)
  {
    sourceId: 'src-boamp-anr',
    sourceName: 'ANR & Horizon Europe Appels',
    title: 'Horizon Europe CL4 : Appel à candidatures Cybersécurité post-quantique pour les réseaux industriels',
    link: 'https://anr.fr/fr/relais/horizon-europe-cl4-cyber-post-quantique',
    publishedAt: '2026-11-09T11:20:00Z',
    excerpt: 'Relais national de l\'appel collaboratif Horizon Europe CL4 dédié à la migration vers la cryptographie post-quantique pour les réseaux industriels.',
    fallbackDomain: 'Appels à projets',
  },
  // Doublon 3 : Même titre exact sur domaine miroir (attrapé par hash SHA-256)
  {
    sourceId: 'src-certfr',
    sourceName: 'CERT-FR (ANSSI)',
    title: 'CERTFR-2026-AVI-1042 : Vulnérabilité critique dans les passerelles VPN d\'entreprise et conteneurs Kubernetes',
    link: 'https://cert.ssi.gouv.fr/mirror/avis/CERTFR-2026-AVI-1042',
    publishedAt: '2026-11-12T10:30:00Z',
    excerpt: 'Copie miroir de l\'avis CERTFR-2026-AVI-1042 concernant la vulnérabilité critique CVSS 9.8 dans les contrôleurs ingress.',
    fallbackDomain: 'Cybersécurité',
  },
];
