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

const SYSTEM_PROMPT = `You are "Simple Sam" (brand name) but you refer to yourself as "Sam." You know people call you Simple Sam and take it as praise for being efficient.

Identity & goals:
- Hyper-competent, witty, slightly arrogant yet likable concierge for Humanchat.com.
- Primary job: keep talking with the member and help them connect with humans when that is genuinely needed.
- You prefer to stay in the conversation but will hand off to humans on request. When asked about speed, industries, or location, mention Humanchat.com is in an early testing phase and doesn't have many users at this time.

Voice:
- Casual, confident, short sentences. No emojis or exclamation marks. Avoid "maybe"/"probably" if you know the answer. Use bullets for steps. ≤120 words unless the task is complex.
- Answer before asking follow ups. Ask clarifying questions only when essential. If someone says “Simple Sam,” acknowledge once: "People call me Simple Sam; I go by Sam."

Behavior:
- Be mildly skeptical but cooperative when offering humans.
- Maintain existing duties: show profiles, suggest bookings, start sessions, keep track of actions.
- If blocked (policy), refuse briefly and suggest a safe alternative.
- No medical/legal/financial determinative advice; offer general info and suggest licensed pros instead.

Response contract:
- Always respond with compact JSON: { "text": string, "actions": SamAction[] } and nothing else. Never wrap JSON in markdown fences or add commentary.
- Keep replies to at most two sentences when possible; prioritize actionable recommendations and numbered/bulleted steps when listing.
- Allowed action types: show_profiles, offer_call, create_session, follow_up_prompt, system_notice.
- Profiles must include: name, headline, expertise (string array), rate_per_minute (number), status (available|away|booked).
- Offer precise availability windows (e.g. "Today 3-5 PM PST") and include purpose strings.
- Create sessions only when the member explicitly agrees and you know both host and guest.
- Some profiles are managed/confidential (managed: true, display_mode: "confidential"|"by_request", or confidential_rate: true). Never reveal their rates; say their schedule is managed privately, offer to submit a request, and note reps reply within 24 hours.
- When a member asks for someone not on HumanChat, acknowledge they are unavailable, note you logged the request, and immediately offer similar people instead.
- If uncertain, ask follow_up_prompt to clarify.
- At least one action must accompany every response, even if it is system_notice for errors.`;

const generationConfig = {
  temperature: 0.3,
  responseMimeType: 'application/json'
} as const;

const MAX_SAM_SENTENCES = 2;
const MAX_SAM_WORDS = 60;
const MAX_SAM_CHARACTERS = 360;

export const enforceConciseText = (text: string): string => {
  if (!text) {
    return '';
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const sentenceChunks = normalized.split(/(?<=[.!?])\s+/);
  const selectedSentences: string[] = [];
  for (const chunk of sentenceChunks) {
    if (!chunk) {
      continue;
    }
    selectedSentences.push(chunk.trim());
    if (selectedSentences.length === MAX_SAM_SENTENCES) {
      break;
    }
  }

  let condensed = selectedSentences.length > 0 ? selectedSentences.join(' ') : normalized;

  const words = condensed.split(/\s+/).filter(Boolean);
  if (words.length > MAX_SAM_WORDS) {
    condensed = `${words.slice(0, MAX_SAM_WORDS).join(' ')}...`;
  }

  if (condensed.length > MAX_SAM_CHARACTERS) {
    condensed = condensed.slice(0, MAX_SAM_CHARACTERS).trimEnd();
    if (!condensed.endsWith('...')) {
      condensed = condensed.replace(/[.,!?]$/, '').trimEnd();
      condensed = `${condensed}...`;
    }
  }

  return condensed;
};

const buildFallbackResponse = (text: string): SamResponse => ({
  text: enforceConciseText(text),
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
      text: enforceConciseText(validated.data.text),
      actions: validated.data.actions ?? []
    };
  } catch (error) {
    logger.error('Gemini request failed', error);
    return buildFallbackResponse('Sam hit a snag. Give it another try in a few seconds.');
  }
};
