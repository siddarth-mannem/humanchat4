import { z } from 'zod';

import { addConversationMessage } from './conversationService.js';
import { sendToSam } from './samAPI.js';
import { SamResponse } from '../types/index.js';

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

export const handleSamChat = async (conversationId: string, userId: string, payload: SamPayload): Promise<SamResponse> => {
  const parsed = SamPayloadSchema.parse(payload);

  const response = await sendToSam({
    userMessage: parsed.message,
    conversationHistory: parsed.conversationHistory,
    userContext: parsed.userContext
  });

  await addConversationMessage(conversationId, 'sam', response.text, 'sam_response', response.actions);
  return response;
};
