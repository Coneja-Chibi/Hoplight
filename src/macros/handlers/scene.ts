// ============================================================================
// CHAT CONTEXT MACROS
// Access to chat messages and conversation state
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';
import { countTokens } from '@/lib/lorebook/tokenizer';

/**
 * {{lastMessage}} - Content of the most recent message (any role)
 */
const lastMessageMacro: MacroDefinition = {
  name: 'lastmessage',
  aliases: ['lastmsg', 'lastchatmessage', 'lastchatmsg'],
  description: 'Content of the most recent message',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const lastMsg = context.messages[context.messages.length - 1];
    return { value: lastMsg?.content || '', success: true };
  },
};

/**
 * {{lastUserMessage}} - Content of the most recent user message
 */
const lastUserMessageMacro: MacroDefinition = {
  name: 'lastusermessage',
  aliases: ['lastuser'],
  description: 'Content of the most recent user message',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // Search from end to find most recent user message
    for (let i = context.messages.length - 1; i >= 0; i--) {
      if (context.messages[i].role === 'user') {
        return { value: context.messages[i].content, success: true };
      }
    }
    return { value: '', success: true };
  },
};

/**
 * {{lastCharMessage}} - Content of the most recent assistant/character message
 */
const lastCharMessageMacro: MacroDefinition = {
  name: 'lastcharmessage',
  aliases: ['lastchar', 'lastassistant', 'lastai'],
  description: 'Content of the most recent character/assistant message',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    for (let i = context.messages.length - 1; i >= 0; i--) {
      if (context.messages[i].role === 'assistant') {
        return { value: context.messages[i].content, success: true };
      }
    }
    return { value: '', success: true };
  },
};

/**
 * {{messageCount}} - Total number of messages in chat
 */
const messageCountMacro: MacroDefinition = {
  name: 'messagecount',
  aliases: ['msgcount', 'chatlen', 'chatlength'],
  description: 'Total number of messages in the chat',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: context.messageCount.toString(), success: true };
  },
};

/**
 * {{message::N}} - Get message at specific index (0-based from start, negative from end)
 */
const messageMacro: MacroDefinition = {
  name: 'message',
  aliases: ['msg'],
  description: 'Get message at index (0 = first, -1 = last)',
  args: [{ name: 'index', description: 'Message index', required: true }],
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const index = parseInt(args[0], 10);
    if (isNaN(index)) {
      return { value: '', success: false, error: 'Invalid message index' };
    }

    let actualIndex = index;
    if (index < 0) {
      actualIndex = context.messages.length + index;
    }

    if (actualIndex < 0 || actualIndex >= context.messages.length) {
      return { value: '', success: true }; // Out of range = empty
    }

    return { value: context.messages[actualIndex].content, success: true };
  },
};

/**
 * {{userMessageCount}} - Count of user messages only
 */
const userMessageCountMacro: MacroDefinition = {
  name: 'usermessagecount',
  aliases: ['usercount'],
  description: 'Number of user messages in the chat',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const count = context.messages.filter(m => m.role === 'user').length;
    return { value: count.toString(), success: true };
  },
};

/**
 * {{charMessageCount}} - Count of assistant messages only
 */
const charMessageCountMacro: MacroDefinition = {
  name: 'charmessagecount',
  aliases: ['charcount', 'aicount'],
  description: 'Number of character/assistant messages in the chat',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const count = context.messages.filter(m => m.role === 'assistant').length;
    return { value: count.toString(), success: true };
  },
};

/**
 * {{chatId}} - Unique identifier for the current chat session
 */
const chatIdMacro: MacroDefinition = {
  name: 'chatid',
  aliases: ['sessionid'],
  description: 'Unique identifier for the current chat session',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    return { value: context.chatId || '', success: true };
  },
};

/**
 * {{chatStart}} - When the chat started (ISO format)
 */
const chatStartMacro: MacroDefinition = {
  name: 'chatstart',
  description: 'When the chat session started',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (!context.chatStartTime) {
      return { value: '', success: true };
    }
    return { value: context.chatStartTime.toISOString(), success: true };
  },
};

/**
 * {{firstMessage}} - Content of the very first message
 */
const firstMessageMacro: MacroDefinition = {
  name: 'firstmessage',
  aliases: ['firstmsg'],
  description: 'Content of the very first message in the chat',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.firstMessage) {
      return { value: context.firstMessage, success: true };
    }
    const firstMsg = context.messages[0];
    return { value: firstMsg?.content || '', success: true };
  },
};

/**
 * {{recentMessages::N}} - Get last N messages as formatted text
 */
const recentMessagesMacro: MacroDefinition = {
  name: 'recentmessages',
  aliases: ['recent'],
  description: 'Get last N messages formatted',
  args: [{ name: 'count', description: 'Number of messages', required: true }],
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const count = parseInt(args[0], 10);
    if (isNaN(count) || count < 1) {
      return { value: '', success: false, error: 'Invalid message count' };
    }

    const messages = context.messages.slice(-count);
    const formatted = messages.map(m => {
      const speaker = m.role === 'user' ? context.userName : context.characterName;
      return `${speaker}: ${m.content}`;
    }).join('\n');

    return { value: formatted, success: true };
  },
};

/**
 * {{message history}} - Full conversation history formatted
 *
 * Token-aware message history injection:
 * - Includes messages up to a token budget (default: 2000 tokens)
 * - Starts from most recent messages
 * - Can be configured with args: {{message_history::1500}} for custom budget
 * - Can limit count: {{message_history::1500::20}} for max 20 messages
 */
const messageHistoryMacro: MacroDefinition = {
  name: 'message history',
  aliases: ['history', 'chatlog', 'chat_history'],
  description: 'Conversation history formatted (token-aware)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const messages = context.messages;
    console.log('[MessageHistoryMacro] Called with', messages.length, 'messages');

    if (messages.length === 0) {
      console.log('[MessageHistoryMacro] No messages, returning empty');
      return { value: '', success: true };
    }

    // Parse args: {{message_history::tokenBudget::maxCount}}
    // Example: {{message_history::2000::20}} = up to 2000 tokens, max 20 messages
    const tokenBudget = args.length > 0 ? parseInt(args[0], 10) : 2000;
    const maxCount = args.length > 1 ? parseInt(args[1], 10) : 50;

    const header = `=== MESSAGE HISTORY ===\n`;
    const footer = `\n======================\n`;

    const headerTokens = countTokens(header);
    const footerTokens = countTokens(footer);

    // Start from most recent messages (end of array)
    const selectedMessages: Array<{ speaker: string; content: string }> = [];
    let usedTokens = headerTokens + footerTokens;

    // Go through messages from newest to oldest
    for (let i = messages.length - 1; i >= 0 && selectedMessages.length < maxCount; i--) {
      const msg = messages[i];
      const speaker = msg.role === 'user' ? context.userName : context.characterName;
      const messageText = `${speaker}: ${msg.content}`;
      const messageTokens = countTokens(messageText);

      // Check if adding this message would exceed budget
      if (usedTokens + messageTokens > tokenBudget) {
        // Check if we should include a truncated version
        const remainingBudget = tokenBudget - usedTokens - 3; // -3 for "..."
        if (remainingBudget > 10) {
          // Truncate the message to fit (rough estimate: 4 chars per token)
          const truncatedContent = msg.content.substring(0, remainingBudget * 4) + '...';
          const truncatedText = `${speaker}: ${truncatedContent}`;
          selectedMessages.unshift({ speaker, content: truncatedText });
          usedTokens += countTokens(truncatedText);
        }
        break; // Budget exhausted
      }

      selectedMessages.unshift({ speaker, content: msg.content });
      usedTokens += messageTokens;
    }

    // Reverse for chronological order (oldest first, newest last)
    const displayMessages = selectedMessages.reverse();

    if (displayMessages.length === 0) {
      console.log('[MessageHistoryMacro] No messages fit in token budget');
      return { value: '', success: true };
    }

    const formatted = header + displayMessages.map(m => `${m.speaker}: ${m.content}`).join('\n') + footer;
    console.log('[MessageHistoryMacro] Included', displayMessages.length, 'messages (~' + usedTokens + ' tokens)');

    return { value: formatted, success: true };
  },
};

/**
 * {{lastMessageId}} - Index of the last message (0-based)
 */
const lastMessageIdMacro: MacroDefinition = {
  name: 'lastmessageid',
  aliases: ['lastmsgid', 'lastmsgindex'],
  description: 'Index of the last message (0-based)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const lastIndex = context.messages.length - 1;
    return { value: Math.max(0, lastIndex).toString(), success: true };
  },
};

/**
 * {{firstIncludedMessageId}} - Index of the first message included in context window
 * This is the oldest message that will be sent to the AI
 */
const firstIncludedMessageIdMacro: MacroDefinition = {
  name: 'firstincludedmessageid',
  aliases: ['firstincludedmsgid'],
  description: 'Index of first message included in context (oldest sent to AI)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    // Access extended context for context window info
    const ctx = context as SceneExtendedContext;
    // If we have first included ID from context management, use it
    // Otherwise default to 0 (all messages included)
    return { value: (ctx.firstIncludedMessageId ?? 0).toString(), success: true };
  },
};

/**
 * {{firstDisplayedMessageId}} - Index of the first displayed message in UI
 */
const firstDisplayedMessageIdMacro: MacroDefinition = {
  name: 'firstdisplayedmessageid',
  aliases: ['firstdisplayedmsgid'],
  description: 'Index of first displayed message in UI',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as SceneExtendedContext;
    // Default to 0 if not specified
    return { value: (ctx.firstDisplayedMessageId ?? 0).toString(), success: true };
  },
};

/**
 * {{summary}} - Latest chat summary (if available)
 * Returns the most recent auto-generated summary of the conversation
 */
const summaryMacro: MacroDefinition = {
  name: 'summary',
  aliases: ['chatsummary'],
  description: 'Latest auto-generated chat summary',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as SceneExtendedContext;
    return { value: ctx.chatSummary || '', success: true };
  },
};

/**
 * {{lastSwipeId}} - 1-based index of the last swipe (total swipes available)
 */
const lastSwipeIdMacro: MacroDefinition = {
  name: 'lastswipeid',
  aliases: ['swipecount'],
  description: 'Total number of swipes available (1-based)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as SceneExtendedContext;
    return { value: (ctx.lastSwipeId ?? 1).toString(), success: true };
  },
};

/**
 * {{currentSwipeId}} - 1-based index of the currently displayed swipe
 */
const currentSwipeIdMacro: MacroDefinition = {
  name: 'currentswipeid',
  aliases: ['swipeid'],
  description: 'Current swipe index (1-based)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const ctx = context as SceneExtendedContext;
    return { value: (ctx.currentSwipeId ?? 1).toString(), success: true };
  },
};

/**
 * Extended context interface for chat-specific fields
 */
export interface SceneExtendedContext extends MacroContext {
  firstIncludedMessageId?: number;
  firstDisplayedMessageId?: number;
  lastSwipeId?: number;
  currentSwipeId?: number;
}

/**
 * {{memories}} - Chat memory summaries for context
 *
 * Token-aware memory injection:
 * - Includes memories up to a token budget (default: 1500 tokens)
 * - Starts from most recent memories
 * - Can be configured with args: {{memories::1000}} for custom budget
 * - Can limit count: {{memories::1000::50}} for max 50 memories
 */
const memoriesMacro: MacroDefinition = {
  name: 'memories',
  aliases: ['memory'],
  description: 'Chat memory summaries as context (token-aware)',
  category: 'chat',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const memories = context.chatMemories || [];
    console.log('[MemoriesMacro] Called with', memories.length, 'memories');

    if (memories.length === 0) {
      console.log('[MemoriesMacro] No memories, returning empty');
      return { value: '', success: true };
    }

    // Parse args: {{memories::tokenBudget::maxCount}}
    // Example: {{memories::1500::50}} = up to 1500 tokens, max 50 memories
    const tokenBudget = args.length > 0 ? parseInt(args[0], 10) : 1500;
    const maxCount = args.length > 1 ? parseInt(args[1], 10) : 100;

    // Memories are already sorted by creation time (oldest first)
    const sortedMemories = [...memories];

    const header = `=== CHAT MEMORIES ===\n`;
    const footer = `\n=====================\n`;

    const headerTokens = countTokens(header);
    const footerTokens = countTokens(footer);

    // Start from most recent memories (end of array)
    // We want to include recent memories first
    const selectedMemories: string[] = [];
    let usedTokens = headerTokens + footerTokens;

    // Go through memories from newest to oldest
    for (let i = sortedMemories.length - 1; i >= 0 && selectedMemories.length < maxCount; i--) {
      const memory = sortedMemories[i];
      const memoryText = `- ${memory}`;
      const memoryTokens = countTokens(memoryText);

      // Check if adding this memory would exceed budget
      if (usedTokens + memoryTokens > tokenBudget) {
        // Check if we should include a truncated version
        const remainingBudget = tokenBudget - usedTokens - 3; // -3 for "..."
        if (remainingBudget > 10) {
          // Truncate the memory to fit (rough estimate: 4 chars per token)
          const truncatedMemory = memory.substring(0, remainingBudget * 4) + '...';
          selectedMemories.unshift(`- ${truncatedMemory}`);
          usedTokens += countTokens(`- ${truncatedMemory}`);
        }
        break; // Budget exhausted
      }

      selectedMemories.unshift(memoryText);
      usedTokens += memoryTokens;
    }

    // Reverse for chronological order (oldest first, newest last)
    const displayMemories = selectedMemories.reverse();

    if (displayMemories.length === 0) {
      console.log('[MemoriesMacro] No memories fit in token budget');
      return { value: '', success: true };
    }

    const formatted = header + displayMemories.join('\n') + footer;
    console.log('[MemoriesMacro] Included', displayMemories.length, 'memories (~' + usedTokens + ' tokens)');

    return { value: formatted, success: true };
  },
};

/**
 * Register all chat context macros
 */
export function registerChatMacros(): void {
  registerMacros([
    lastMessageMacro,
    lastUserMessageMacro,
    lastCharMessageMacro,
    messageCountMacro,
    messageMacro,
    userMessageCountMacro,
    charMessageCountMacro,
    chatIdMacro,
    chatStartMacro,
    firstMessageMacro,
    recentMessagesMacro,
    messageHistoryMacro,
    lastMessageIdMacro,
    firstIncludedMessageIdMacro,
    firstDisplayedMessageIdMacro,
    summaryMacro,
    lastSwipeIdMacro,
    currentSwipeIdMacro,
    memoriesMacro,
  ]);
}
