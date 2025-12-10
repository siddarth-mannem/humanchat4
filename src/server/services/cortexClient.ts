import { z } from 'zod';

import { env } from '../config/env.js';
import { SamAction, SamProfileSummary, SamResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

const CORTEX_API_BASE = 'https://cortex-api-37305898543.us-central1.run.app/api';

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
  sessionId?: string;
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
- Keep replies to at most two short sentences (ideally under 60 words) that lead with the clearest next step.
- Skip pleasantries and long summaries; get to the actionable recommendation immediately.
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

const mapHistoryToCortex = (history: ConversationHistoryEntry[]) =>
  history.map((entry) => ({
    role: entry.role === 'sam' ? 'assistant' : 'user',
    content: entry.content
  }));

const getCortexAuthToken = (): string | null => {
  // This should ideally be stored in env or fetched dynamically
  // For now using the token from the example
  return env.cortexApiToken || null;
};

export const sendToSam = async ({
  userMessage,
  conversationHistory,
  userContext,
  sessionId
}: SendToSamInput): Promise<SamResponse & { sessionId?: string }> => {
  const authToken = getCortexAuthToken();
  if (!authToken) {
    logger.warn('Cortex API token missing; returning fallback Sam response.');
    return buildFallbackResponse('Sam is warming up. Please retry in a moment.');
  }

  const trimmedHistory = conversationHistory.slice(-12);
  const contextString = JSON.stringify({
    conversation_history: trimmedHistory,
    user_context: userContext ?? {},
    latest_user_message: userMessage
  }, null, 2);

  try {
    // If no sessionId, start a new chat session
    if (!sessionId) {
      logger.info('Starting new Cortex chat session');
      const startResponse = await fetch(`${CORTEX_API_BASE}/chat/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...mapHistoryToCortex(trimmedHistory),
            {
              role: 'user',
              content: `${userMessage}\n\nCONTEXT:\n${contextString}`
            }
          ],
          context: contextString
        })
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        logger.error('Cortex API start error', { 
          status: startResponse.status, 
          statusText: startResponse.statusText,
          error: errorText 
        });
        throw new Error(`Cortex API error: ${startResponse.status} ${startResponse.statusText} - ${errorText}`);
      }

      const startData = await startResponse.json();
      logger.info('Cortex chat started', { sessionId: startData.sessionId, rawResponse: JSON.stringify(startData).substring(0, 200) });

      const responseText = startData.text || startData.response || startData.message || '';
      logger.info('Cortex response text', { responseText: responseText.substring(0, 200) });
      
      // Cortex returns plain text, not JSON with structured actions
      // We need to wrap it in our expected format
      const response: SamResponse = {
        text: responseText,
        actions: [
          {
            type: 'follow_up_prompt',
            prompt: 'What else would you like to know?'
          }
        ]
      };

      logger.info('Sam response generated', { 
        text: response.text.substring(0, 100), 
        actionCount: response.actions?.length ?? 0,
        sessionId: startData.sessionId
      });

      return {
        ...response,
        sessionId: startData.sessionId
      };
    }

    // Continue existing chat session
    logger.info('Continuing Cortex chat session', { sessionId });
    const chatResponse = await fetch(`${CORTEX_API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        sessionId,
        messages: [
          {
            role: 'user',
            content: `${userMessage}\n\nCONTEXT:\n${contextString}`
          }
        ],
        rag: {
          enabled: false,
          topK: null
        }
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      logger.error('Cortex API chat error', { 
        status: chatResponse.status, 
        statusText: chatResponse.statusText,
        error: errorText 
      });
      throw new Error(`Cortex API error: ${chatResponse.status} ${chatResponse.statusText} - ${errorText}`);
    }

    const chatData = await chatResponse.json();
    logger.info('Cortex chat response', { rawResponse: JSON.stringify(chatData).substring(0, 200) });
    
    const responseText = chatData.text || chatData.response || chatData.message || '';
    logger.info('Cortex response text', { responseText: responseText.substring(0, 200) });
    
    // Cortex returns plain text, not JSON with structured actions
    // We need to wrap it in our expected format
    const response: SamResponse = {
      text: responseText,
      actions: [
        {
          type: 'follow_up_prompt',
          prompt: 'What else would you like to know?'
        }
      ]
    };

    logger.info('Sam response generated', { 
      text: response.text.substring(0, 100), 
      actionCount: response.actions?.length ?? 0,
      sessionId
    });

    return {
      ...response,
      sessionId
    };
  } catch (error) {
    logger.error('Cortex request failed', error);
    return { 
      ...buildFallbackResponse('Sam hit a snag. Give it another try in a few seconds.'),
      sessionId
    };
  }
};
