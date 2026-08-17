import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import type { ClassificationResult } from "./classifier";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export interface EnrichmentInput {
  indicator: string;
  indicatorType: string;
  description: string;
  claimedAttackType: string;
  claimedMitreTechnique: string;
}

/**
 * Optional LLM confidence boost, gated behind ENABLE_LLM_ENRICHMENT so the demo
 * runs fully offline by default. Any failure (no key, network, refusal) falls
 * back silently to the rule-based result — enrichment must never block a report.
 */
export async function enrichClassification(
  input: EnrichmentInput,
  ruleBasedResult: ClassificationResult
): Promise<ClassificationResult> {
  if (!env.ENABLE_LLM_ENRICHMENT || !env.ANTHROPIC_API_KEY) {
    return ruleBasedResult;
  }

  try {
    const response = await getClient().messages.create({
      model: "claude-opus-5",
      max_tokens: 256,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              plausible: { type: "boolean" },
              confidence: { type: "integer" },
            },
            required: ["plausible", "confidence"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `A threat report claims indicator "${input.indicator}" (${input.indicatorType}) is "${input.claimedAttackType}" (MITRE ${input.claimedMitreTechnique}). Description: "${input.description}". Is this classification plausible given the description? Respond with your assessment.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return ruleBasedResult;
    }

    const parsed = JSON.parse(
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}"
    ) as { plausible?: boolean; confidence?: number };

    if (typeof parsed.confidence !== "number") {
      return ruleBasedResult;
    }

    const blended = Math.round((ruleBasedResult.aiConfidence + parsed.confidence) / 2);
    return { ...ruleBasedResult, aiConfidence: Math.max(0, Math.min(100, blended)) };
  } catch {
    return ruleBasedResult;
  }
}
