import { z } from 'zod';

import { addConversationMessage, ensureSamConversation, hasSamRespondedToUser } from './conversationService.js';
import { sendToSam } from './samAPI.js';
import { SamResponse, SamChatResult } from '../types/index.js';
import { searchUsers } from './userService.js';
import { logRequestedPersonInterest } from './requestedPeopleService.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../utils/logger.js';
import { validate as uuidValidate } from 'uuid';

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
const SAM_INTRO_MESSAGE =
  'Hi, I’m Sam — a super-intelligent AI chatbot. I know more than any human could, but if you prefer talking to real humans, I can connect you with a real human according to your needs. So, what’s up?';

const normalizeSamActions = (
  actions: unknown
): Parameters<typeof addConversationMessage>[4] => {
  if (!actions) {
    return undefined;
  }

  let candidate = actions;
  if (typeof actions === 'string') {
    try {
      candidate = JSON.parse(actions);
    } catch (error) {
      logger.warn('Failed to parse stringified Sam actions; dropping payload', {
        error,
        sample: actions.slice(0, 200)
      });
      return undefined;
    }
  }

  if (!Array.isArray(candidate)) {
    logger.warn('Sam actions payload was not an array; dropping payload', {
      typeof: typeof candidate
    });
    return undefined;
  }

  const cleaned = candidate.filter((entry) => entry && typeof entry === 'object');
  return cleaned.length > 0 ? (cleaned as Parameters<typeof addConversationMessage>[4]) : undefined;
};

const shouldBootstrapSamConversation = (conversationId: string): boolean => {
  if (!conversationId) {
    return true;
  }
  if (conversationId === SAM_CONCIERGE_ID) {
    return true;
  }
  return !uuidValidate(conversationId);
};

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

export const handleSamChat = async (conversationId: string, userId: string, payload: SamPayload): Promise<SamChatResult> => {
  const parsed = SamPayloadSchema.parse(payload);

  let activeConversationId = conversationId;
  if (shouldBootstrapSamConversation(activeConversationId)) {
    const conversation = await ensureSamConversation(userId);
    activeConversationId = conversation.id;
  }

  const persistMessage = async (
    senderId: string,
    content: string,
    type: Parameters<typeof addConversationMessage>[3],
    actions?: Parameters<typeof addConversationMessage>[4]
  ) => {
    const normalizedSenderId = uuidValidate(senderId) ? senderId : null;
    try {
      await addConversationMessage(activeConversationId, normalizedSenderId, content, type, actions);
    } catch (error) {
      const isExpectedMissingConversation =
        error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'INVALID_REQUEST');
      if (isExpectedMissingConversation) {
        const conversation = await ensureSamConversation(userId);
        activeConversationId = conversation.id;
        await addConversationMessage(activeConversationId, normalizedSenderId, content, type, actions);
        logger.info('Recreated missing Sam conversation for user', {
          userId,
          conversationId: activeConversationId
        });
      } else {
        throw error;
      }
    }
  };

  await persistMessage(userId, parsed.message, 'user_text');

  const userHasHeardIntro = await hasSamRespondedToUser(userId);

  const intercepted = await maybeHandleRequestedPerson(userId, parsed.message);
  logger.info('Sam concierge dispatching Gemini request', {
    conversationId: activeConversationId,
    userId,
    historyCount: parsed.conversationHistory.length,
    hasContext: Boolean(parsed.userContext)
  });

  let response: SamResponse;
  if (!userHasHeardIntro) {
    response = {
      text: SAM_INTRO_MESSAGE,
      actions: [
        {
          type: 'follow_up_prompt',
          prompt: 'Tell me what you need and I will route it.'
        }
      ]
    };
  } else {
    response =
      intercepted ??
      (await sendToSam({
        userMessage: parsed.message,
        conversationHistory: parsed.conversationHistory,
        userContext: parsed.userContext
      }));
  }

  logger.info('Sam concierge response received', {
    conversationId: activeConversationId,
    userId,
    actionCount: Array.isArray(response.actions) ? response.actions.length : 0,
    textPreview: response.text?.slice(0, 120) ?? null
  });

  const normalizedActions = normalizeSamActions(response.actions);
  await persistMessage('sam', response.text, 'sam_response', normalizedActions);

  return {
    ...response,
    conversationId: activeConversationId
  };
};
