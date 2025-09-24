import { levenshtein } from 'fast-levenshtein';
import councils from './data/councils.json';

export interface CouncilInfo {
  council: string;
  url: string;
  region: string;
  type: string;
}

export interface CouncilMatch {
  council: CouncilInfo;
  score: number;
  confidence: 'exact' | 'high' | 'medium' | 'low';
}

export class CouncilMatcher {
  private councils: CouncilInfo[] = councils.councils;

  /**
   * Calculate similarity score between two strings using Levenshtein distance
   */
  private calculateSimilarity(query: string, councilName: string): number {
    const queryLower = query.toLowerCase();
    const councilLower = councilName.toLowerCase();

    // Exact match
    if (queryLower === councilLower) {
      return 1.0;
    }

    // Substring match
    if (councilLower.includes(queryLower) || queryLower.includes(councilLower)) {
      return 0.9;
    }

    // Word-based matching
    const queryWords = queryLower.split(/\s+/);
    const councilWords = councilLower.split(/\s+/);

    let wordMatches = 0;
    for (const queryWord of queryWords) {
      for (const councilWord of councilWords) {
        if (queryWord === councilWord ||
            councilWord.includes(queryWord) ||
            queryWord.includes(councilWord)) {
          wordMatches++;
          break;
        }
      }
    }

    const wordMatchRatio = wordMatches / Math.max(queryWords.length, councilWords.length);

    // Levenshtein distance based similarity
    const maxLength = Math.max(queryLower.length, councilLower.length);
    const distance = levenshtein(queryLower, councilLower);
    const levenshteinScore = 1 - (distance / maxLength);

    // Combine word matching and Levenshtein scores
    return Math.max(wordMatchRatio, levenshteinScore);
  }

  /**
   * Determine confidence level based on similarity score
   */
  private getConfidence(score: number): 'exact' | 'high' | 'medium' | 'low' {
    if (score >= 0.95) return 'exact';
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Find the best matching council for a given query
   */
  findBestMatch(query: string): CouncilMatch | null {
    if (!query || query.trim().length === 0) {
      return null;
    }

    let bestMatch: CouncilMatch | null = null;

    for (const council of this.councils) {
      const score = this.calculateSimilarity(query, council.council);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          council,
          score,
          confidence: this.getConfidence(score)
        };
      }
    }

    return bestMatch;
  }

  /**
   * Find all councils matching a query above a minimum score threshold
   */
  findMatches(query: string, minScore: number = 0.3): CouncilMatch[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const matches: CouncilMatch[] = [];

    for (const council of this.councils) {
      const score = this.calculateSimilarity(query, council.council);

      if (score >= minScore) {
        matches.push({
          council,
          score,
          confidence: this.getConfidence(score)
        });
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Search councils by region
   */
  findByRegion(region: string): CouncilInfo[] {
    const regionLower = region.toLowerCase();
    return this.councils.filter(council =>
      council.region.toLowerCase().includes(regionLower) ||
      regionLower.includes(council.region.toLowerCase())
    );
  }

  /**
   * Search councils by type
   */
  findByType(type: string): CouncilInfo[] {
    const typeLower = type.toLowerCase();
    return this.councils.filter(council =>
      council.type.toLowerCase().includes(typeLower) ||
      typeLower.includes(council.type.toLowerCase())
    );
  }

  /**
   * Get all councils
   */
  getAllCouncils(): CouncilInfo[] {
    return [...this.councils];
  }

  /**
   * Get council count
   */
  getCouncilCount(): number {
    return this.councils.length;
  }
}
