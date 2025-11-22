import { z } from 'zod';

import { addConversationMessage } from './conversationService.js';
import { sendToSam } from './samAPI.js';
import { SamResponse } from '../types/index.js';
import { searchUsers } from './userService.js';
import { logRequestedPersonInterest } from './requestedPeopleService.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../utils/logger.js';

const SamPayloadSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'sam']),
      content: z.string(),
      timestamp: z.string().optional()
    })
  ),
  userContext: z
    .object({
      sidebarState: z.record(z.string(), z.any()).optional(),
      timezone: z.string().optional(),
      availableProfiles: z
        .array(
          z.object({
            name: z.string(),
            headline: z.string(),
            expertise: z.array(z.string()),
            rate_per_minute: z.number(),
            status: z.enum(['available', 'away', 'booked'])
          })
        )
        .optional()
    })
    .catchall(z.any())
    .optional()
});

export type SamPayload = z.infer<typeof SamPayloadSchema>;

const REQUEST_REGEX = /(?:talk|speak|chat|connect|book)\s+(?:to|with)\s+([A-Za-z][A-Za-z\s.'-]{2,})/i;
const SAM_CONCIERGE_ID = 'sam-concierge';

const extractRequestedName = (message: string): string | null => {
  const match = message.match(REQUEST_REGEX);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
};

const maybeHandleRequestedPerson = async (userId: string, message: string): Promise<SamResponse | null> => {
  const candidate = extractRequestedName(message);
  if (!candidate || candidate.length < 3) {
    return null;
  }

  const existing = await searchUsers(candidate, undefined);
  if (existing.length > 0) {
    return null;
  }

  await logRequestedPersonInterest({ requestedName: candidate, searchQuery: message, userId }).catch((error) => {
    console.warn('Failed to log requested person request', error);
  });

  return {
    text: `${candidate} isn't on HumanChat yet, but I noted your interest. Want me to suggest a similar person you can talk to today?`,
    actions: [
      {
        type: 'follow_up_prompt',
        prompt: `Show me profiles similar to ${candidate}`
      }
    ]
  };
};

export const handleSamChat = async (conversationId: string, userId: string, payload: SamPayload): Promise<SamResponse> => {
  const parsed = SamPayloadSchema.parse(payload);

  const intercepted = await maybeHandleRequestedPerson(userId, parsed.message);
  const response =
    intercepted ??
    (await sendToSam({
      userMessage: parsed.message,
      conversationHistory: parsed.conversationHistory,
      userContext: parsed.userContext
    }));

  try {
    await addConversationMessage(conversationId, 'sam', response.text, 'sam_response', response.actions);
  } catch (error) {
    const isSamConcierge = conversationId === SAM_CONCIERGE_ID;
    const isExpectedMissingConversation =
      error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'INVALID_REQUEST');
    if (isSamConcierge && isExpectedMissingConversation) {
      logger.warn('Sam conversation missing in DB, skipping persistence until bootstrap is wired.', {
        userId,
        conversationId
      });
    } else {
      throw error;
    }
  }
  return response;
};
