import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ClassificationResult {
  aiSummary: string;
  keyPoints: string[];
  domain: 'IA' | 'Cybersécurité' | 'Cloud' | 'Développement' | 'Appels à projets' | 'Recherche';
  opportunityType:
    | 'Appel à projets'
    | "Appel d'offres"
    | 'Partenariat'
    | 'Publication technique'
    | 'Alerte sécurité';
  relevanceBoost: number;
  aiEngine: string;
}

const VALID_DOMAINS = [
  'IA',
  'Cybersécurité',
  'Cloud',
  'Développement',
  'Appels à projets',
  'Recherche',
] as const;

const VALID_TYPES = [
  'Appel à projets',
  "Appel d'offres",
  'Partenariat',
  'Publication technique',
  'Alerte sécurité',
] as const;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function deterministicFallback(
  title: string,
  excerpt: string,
  fallbackDomain: ClassificationResult['domain']
): ClassificationResult {
  const text = `${title} ${excerpt}`.toLowerCase();

  let domain: ClassificationResult['domain'] = fallbackDomain;
  if (/certfr|vulnérabilité|cvss|zero-day|anssi|sécurité|attaque|cyber/.test(text)) {
    domain = 'Cybersécurité';
  } else if (/appel à projets|horizon europe|marché public|anr|subvention|candidatures/.test(text)) {
    domain = 'Appels à projets';
  } else if (/llm|rag|ia|intelligence artificielle|language model|machine learning|embedding/.test(text)) {
    domain = 'IA';
  } else if (/kubernetes|cncf|cloud|ebpf|conteneur|gpu/.test(text)) {
    domain = 'Cloud';
  } else if (/partenariat|inria|recherche|arxiv|benchmark/.test(text)) {
    domain = 'Recherche';
  } else if (/opentelemetry|typescript|open source|développement|ci\/cd/.test(text)) {
    domain = 'Développement';
  }

  let opportunityType: ClassificationResult['opportunityType'] = 'Publication technique';
  if (/certfr|vulnérabilité|cvss|compromission|alerte/.test(text)) {
    opportunityType = 'Alerte sécurité';
  } else if (/appel à projets|appel à candidatures|horizon europe|doté de/.test(text)) {
    opportunityType = 'Appel à projets';
  } else if (/marché public|consultation ouverte/.test(text)) {
    opportunityType = "Appel d'offres";
  } else if (/partenariat|transfert technologique|consortium/.test(text)) {
    opportunityType = 'Partenariat';
  }

  const cleanExcerpt = excerpt.replace(/\s+/g, ' ').trim();
  const sentences = cleanExcerpt.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary =
    sentences.slice(0, 2).join(' ') ||
    `${title}. Document classifié automatiquement dans le domaine ${domain}.`;

  return {
    aiSummary: summary,
    keyPoints: [
      `Domaine identifié : ${domain} (${opportunityType})`,
      sentences[0] ? sentences[0].slice(0, 140) : title.slice(0, 140),
    ],
    domain,
    opportunityType,
    relevanceBoost: opportunityType === 'Appel à projets' || opportunityType === "Appel d'offres" ? 15 : 8,
    aiEngine: 'Analyseur heuristique local',
  };
}

async function tryLocalOllama(
  title: string,
  excerpt: string,
  keywords: string[],
  endpoint: string,
  model: string
): Promise<ClassificationResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const prompt = `Tu es un analyste de veille technologique. Analyse cette publication et réponds UNIQUEMENT en JSON valide avec les clés: aiSummary (résumé en français de 2 phrases max), keyPoints (tableau de 2 à 3 points clés concis en français), domain (un parmi: ${VALID_DOMAINS.join(', ')}), opportunityType (un parmi: ${VALID_TYPES.join(', ')}), relevanceBoost (entier 0-25).
Mots-clés prioritaires: ${keywords.join(', ')}.
Titre: ${title}
Extrait: ${excerpt}`;

    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    if (!data.response) return null;
    const parsed = JSON.parse(data.response) as Partial<ClassificationResult>;
    if (!parsed.aiSummary) return null;

    return {
      aiSummary: String(parsed.aiSummary),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 3).map(String) : [],
      domain: VALID_DOMAINS.includes(parsed.domain as ClassificationResult['domain'])
        ? (parsed.domain as ClassificationResult['domain'])
        : 'IA',
      opportunityType: VALID_TYPES.includes(parsed.opportunityType as ClassificationResult['opportunityType'])
        ? (parsed.opportunityType as ClassificationResult['opportunityType'])
        : 'Publication technique',
      relevanceBoost: typeof parsed.relevanceBoost === 'number' ? Math.min(25, Math.max(0, Math.round(parsed.relevanceBoost))) : 10,
      aiEngine: `Ollama (${model})`,
    };
  } catch {
    return null;
  }
}

export async function analyzeBatchWithAI(
  entries: Array<{
    tempId: string;
    title: string;
    excerpt: string;
    sourceName: string;
    fallbackDomain: ClassificationResult['domain'];
  }>,
  keywords: string[],
  options: {
    preferLocalOllama: boolean;
    ollamaEndpoint: string;
    ollamaModel: string;
  }
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();
  if (entries.length === 0) return results;

  // 1. Optional local Ollama route when explicitly enabled & reachable
  if (options.preferLocalOllama) {
    for (const entry of entries) {
      const ollamaRes = await tryLocalOllama(
        entry.title,
        entry.excerpt,
        keywords,
        options.ollamaEndpoint,
        options.ollamaModel
      );
      if (ollamaRes) {
        results.set(entry.tempId, ollamaRes);
      }
    }
    if (results.size === entries.length) {
      return results;
    }
  }

  // 2. Server-side Gemini 4 Hydrogen structured batch synthesis
  const pending = entries.filter((e) => !results.has(e.tempId));
  const ai = getGenAIClient();

  if (ai && pending.length > 0) {
    try {
      const chunkSize = 8;
      for (let i = 0; i < pending.length; i += chunkSize) {
        const chunk = pending.slice(i, i + chunkSize);
        const promptPayload = chunk.map((item) => ({
          tempId: item.tempId,
          source: item.sourceName,
          titre: item.title,
          extrait: item.excerpt.slice(0, 700),
        }));

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Analyse les publications suivantes pour une plateforme de veille technologique d'une entreprise informatique / laboratoire R&D.
Mots-clés stratégiques suivis : ${keywords.join(', ')}.

Publications à analyser :
${JSON.stringify(promptPayload, null, 2)}`,
          config: {
            systemInstruction:
              'Tu es un expert en veille stratégique et R&D. Pour chaque publication, produis un résumé synthétique en français (2 phrases précises maximum, orientées action/décision), 2 à 3 points clés factuels en français, la classification exacte du domaine et du type d\'opportunité, et un bonus de pertinence (0 à 25). Traduis en français si la source est en anglais.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tempId: { type: Type.STRING },
                  aiSummary: { type: Type.STRING },
                  keyPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  domain: {
                    type: Type.STRING,
                    description: 'Un parmi: IA, Cybersécurité, Cloud, Développement, Appels à projets, Recherche',
                  },
                  opportunityType: {
                    type: Type.STRING,
                    description:
                      'Un parmi: Appel à projets, Appel d\'offres, Partenariat, Publication technique, Alerte sécurité',
                  },
                  relevanceBoost: { type: Type.INTEGER },
                },
                required: ['tempId', 'aiSummary', 'keyPoints', 'domain', 'opportunityType', 'relevanceBoost'],
              },
            },
          },
        });

        const rawJson = (response.text ?? '[]').trim();
        const parsedList = JSON.parse(rawJson) as Array<Partial<ClassificationResult> & { tempId?: string }>;
        for (const item of parsedList) {
          if (!item.tempId || !item.aiSummary) continue;
          const orig = chunk.find((c) => c.tempId === item.tempId);
          results.set(item.tempId, {
            aiSummary: item.aiSummary,
            keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints.slice(0, 3).map(String) : [],
            domain: VALID_DOMAINS.includes(item.domain as ClassificationResult['domain'])
              ? (item.domain as ClassificationResult['domain'])
              : (orig?.fallbackDomain ?? 'Recherche'),
            opportunityType: VALID_TYPES.includes(item.opportunityType as ClassificationResult['opportunityType'])
              ? (item.opportunityType as ClassificationResult['opportunityType'])
              : 'Publication technique',
            relevanceBoost:
              typeof item.relevanceBoost === 'number'
                ? Math.min(25, Math.max(0, Math.round(item.relevanceBoost)))
                : 10,
            aiEngine: 'Gemini 4 Hydrogen',
          });
        }
      }
    } catch (err) {
      console.error('Gemini synthesis fallback triggered:', err instanceof Error ? err.message : err);
    }
  }

  // 3. Ensure every entry has a valid result via deterministic fallback if needed
  for (const entry of entries) {
    if (!results.has(entry.tempId)) {
      results.set(entry.tempId, deterministicFallback(entry.title, entry.excerpt, entry.fallbackDomain));
    }
  }

  return results;
}
