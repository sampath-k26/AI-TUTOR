export interface ConceptMapNode {
  id: string;
  name: string;
}

export interface ConceptMapEdge {
  source: string;
  target: string;
  weight: number;
}

export interface ConceptMapGraph {
  nodes: ConceptMapNode[];
  edges: ConceptMapEdge[];
}

// Below this length a concept name (e.g. "DNA" is fine, but a 1-2 char name isn't)
// matches too many chunks by coincidence to be a meaningful co-occurrence signal.
const MIN_CONCEPT_NAME_LENGTH = 3;

// UUIDs (concept ids) never contain "::", so it's a safe, readable pair-key separator.
const PAIR_KEY_SEPARATOR = "::";

/**
 * Live heuristic co-occurrence (decision D19): two concepts "co-occur" whenever
 * their names both appear (case-insensitive substring match) in the same material
 * chunk. Computed fresh per request rather than precomputed into a join table —
 * insertConcepts() is append-only (no reprocess-time delete like insertChunks()
 * has), so a precomputed table would need a full project recompute on every
 * material reprocess; computing live sidesteps that with zero invalidation code.
 */
export function computeConceptCooccurrence(
  conceptList: ConceptMapNode[],
  chunkContents: string[],
): ConceptMapGraph {
  const eligible = conceptList.filter((c) => c.name.length >= MIN_CONCEPT_NAME_LENGTH);
  const weightByPairKey = new Map<string, number>();

  for (const content of chunkContents) {
    const lowerContent = content.toLowerCase();
    const presentIds = eligible.filter((c) => lowerContent.includes(c.name.toLowerCase())).map((c) => c.id);

    for (let i = 0; i < presentIds.length; i++) {
      for (let j = i + 1; j < presentIds.length; j++) {
        const [source, target] = [presentIds[i]!, presentIds[j]!].sort();
        const key = `${source}${PAIR_KEY_SEPARATOR}${target}`;
        weightByPairKey.set(key, (weightByPairKey.get(key) ?? 0) + 1);
      }
    }
  }

  const edges: ConceptMapEdge[] = [...weightByPairKey.entries()].map(([key, weight]) => {
    const [source, target] = key.split(PAIR_KEY_SEPARATOR) as [string, string];
    return { source, target, weight };
  });

  return { nodes: conceptList, edges };
}
