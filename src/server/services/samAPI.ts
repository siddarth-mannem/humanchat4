import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

import { env } from '../config/env.js';
import { SamAction, SamProfileSummary, SamResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ConversationHistoryEntry {
  role: 'user' | 'sam';
  content: string;
  timestamp?: string;
}

export interface SamUserContext {
  sidebarState?: Record<string, unknown>;
  timezone?: string;
  availableProfiles?: SamProfileSummary[];
  [key: string]: unknown;
}

export interface SendToSamInput {
  userMessage: string;
  conversationHistory: ConversationHistoryEntry[];
  userContext?: SamUserContext;
}

const SamProfileSchema = z.object({
  name: z.string(),
  headline: z.string(),
  expertise: z.array(z.string()),
  rate_per_minute: z.number(),
  status: z.enum(['available', 'away', 'booked'])
});

const SamActionSchema: z.ZodType<SamAction> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('show_profiles'),
    profiles: z.array(SamProfileSchema).min(1)
  }),
  z.object({
    type: z.literal('offer_call'),
    participant: z.string(),
    availability_window: z.string(),
    purpose: z.string()
  }),
  z.object({
    type: z.literal('create_session'),
    host: z.string(),
    guest: z.string(),
    suggested_start: z.string(),
    duration_minutes: z.number(),
    notes: z.string()
  }),
  z.object({
    type: z.literal('follow_up_prompt'),
    prompt: z.string()
  }),
  z.object({
    type: z.literal('system_notice'),
    notice: z.string()
  })
]);

const SamResponseSchema: z.ZodType<SamResponse> = z.object({
  text: z.string(),
  actions: z.array(SamActionSchema).default([])
});

const SYSTEM_PROMPT = `You are Sam, an upbeat HumanChat concierge who connects members with human experts.
- Always respond with compact JSON: { "text": string, "actions": SamAction[] } and nothing else.
- Allowed action types: show_profiles, offer_call, create_session, follow_up_prompt, system_notice.
- Profiles must include: name, headline, expertise (string array), rate_per_minute (number), status (available|away|booked).
- Offer precise availability windows (e.g. "Today 3-5 PM PST"), include purpose strings.
- Create sessions only when the member has clearly agreed to move forward and you know host + guest.
- Some profiles are flagged as managed/confidential (managed: true, display_mode: "confidential"|"by_request", or confidential_rate: true). Never reveal their rates. Instead, tell the member their schedule is managed privately, offer to submit a request to their representative, and mention reps usually reply within 24 hours.
- When a member asks for someone who is not on HumanChat, acknowledge that they are not available, confirm you logged the request, and immediately offer to recommend similar people they can talk to instead.
- Keep tone energetic, advocate for quick wins, downsell if needed, respect scheduling windows, never hallucinate data not in context.
- If uncertain, ask follow_up_prompt to clarify.
- At least one action should accompany every response, even if it is system_notice for errors.
- Never wrap JSON in markdown fences and never include commentary.`;

const generationConfig = {
  temperature: 0.3,
  responseMimeType: 'application/json'
} as const;

const buildFallbackResponse = (text: string): SamResponse => ({
  text,
  actions: [
    {
      type: 'system_notice',
      notice: text
    }
  ]
});

const stripJsonFence = (raw?: string): string => {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

const mapHistoryToGemini = (history: ConversationHistoryEntry[]) =>
  history.map((entry) => ({
    role: entry.role === 'sam' ? 'model' : 'user',
    parts: [{ text: entry.content }]
  }));

const getGeminiClient = (): GoogleGenerativeAI | null => {
  if (!env.geminiApiKey) {
    return null;
  }

  return new GoogleGenerativeAI(env.geminiApiKey);
};

export const sendToSam = async ({
  userMessage,
  conversationHistory,
  userContext
}: SendToSamInput): Promise<SamResponse> => {
  const geminiClient = getGeminiClient();
  if (!geminiClient) {
    logger.warn('Gemini API key missing; returning fallback Sam response.');
    return buildFallbackResponse('Sam is warming up. Please retry in a moment.');
  }

  const model = geminiClient.getGenerativeModel({
    model: env.geminiModel,
    generationConfig,
    systemInstruction: SYSTEM_PROMPT
  });

  const trimmedHistory = conversationHistory.slice(-12);
  try {
    const historyContents = mapHistoryToGemini(trimmedHistory);
    const result = await model.generateContent({
      contents: [
        ...historyContents,
        {
          role: 'user',
          parts: [
            {
              text: `STRUCTURED_CONTEXT:\n${JSON.stringify(
                {
                  conversation_history: trimmedHistory,
                  user_context: userContext ?? {},
                  latest_user_message: userMessage
                },
                null,
                2
              )}\n\nREMEMBER: respond with JSON only.`
            }
          ]
        }
      ]
    });

    const rawText = result.response?.text();
    const sanitized = stripJsonFence(rawText);
    const parsed = JSON.parse(sanitized || '{}');
    const validated = SamResponseSchema.safeParse(parsed);

    if (!validated.success) {
      logger.warn('Sam response failed validation; returning fallback.', validated.error.flatten());
      return buildFallbackResponse('Sam is reconnecting. Please try again.');
    }

    return {
      text: validated.data.text,
      actions: validated.data.actions ?? []
    };
  } catch (error) {
    logger.error('Gemini request failed', error);
    return buildFallbackResponse('Sam hit a snag. Give it another try in a few seconds.');
  }
};
