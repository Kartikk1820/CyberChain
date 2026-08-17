import { lookupTechnique, MITRE_TECHNIQUES, type MitreTechnique } from "@sixsync/shared";

export interface ClassificationInput {
  indicator: string;
  description: string;
  claimedMitreTechnique: string;
}

export interface ClassificationResult {
  suggestedTechnique: MitreTechnique;
  aiConfidence: number;
}

/**
 * Rule-based baseline classifier (zero external deps). Independently guesses the
 * MITRE technique from indicator + description keywords, then scores aiConfidence
 * by how well that guess agrees with what the reporter claimed.
 */
export function classify(input: ClassificationInput): ClassificationResult {
  const text = `${input.indicator} ${input.description}`;
  const suggestedTechnique = lookupTechnique(text);

  const isDefaultGuess = !MITRE_TECHNIQUES.some((t) => t.id === suggestedTechnique.id);
  const agreesWithClaim = suggestedTechnique.id === input.claimedMitreTechnique;

  let aiConfidence: number;
  if (agreesWithClaim) {
    aiConfidence = 85;
  } else if (!isDefaultGuess) {
    aiConfidence = 55;
  } else {
    aiConfidence = 50;
  }

  const descriptionLength = input.description.trim().length;
  if (descriptionLength >= 50) aiConfidence += 5;
  if (descriptionLength < 20) aiConfidence -= 10;

  aiConfidence = Math.max(0, Math.min(100, aiConfidence));

  return { suggestedTechnique, aiConfidence };
}
