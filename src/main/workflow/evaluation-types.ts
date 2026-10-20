export interface EvidenceQuote { quote: string; verified: boolean; }
export interface EvaluationResult {
  score: number;
  verdict: 'strong-fit' | 'moderate-fit' | 'weak-fit' | 'no-fit';
  evidence: EvidenceQuote[];
  supported: string[];
  missing: string[];
  suggestions: string[];
  provider: string | null;
  model: string | null;
}
export interface RawEvaluation {
  score: unknown;
  verdict: unknown;
  evidence: unknown;
  supported: unknown;
  missing: unknown;
  suggestions: unknown;
}
