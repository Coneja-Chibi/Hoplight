/**
 * SillyTavern's macro reference. TOKENS + SYNTAX transcribed from SillyTavern 1.13.5's own macro
 * reference (public/scripts/templates/macros.html, cross-checked against public/scripts/macros.js).
 * Tokens are facts; the descriptions here are written fresh (ST is AGPL-3.0 and vaud is
 * AGPL-3.0-or-later, but the clean-room doctrine says don't lift their prose).
 *
 * Group names are editorial (ST ships three long sections); every TOKEN below is one ST really has.
 *
 * Separators are load-bearing and differ from RoleCall's engine - do not "tidy" them:
 *   {{roll:1d6}} single colon · {{datetimeformat ...}} space-separated · {{trim}} takes no argument
 *   {{random::a::b}} picks one of the LISTED items - it is NOT a min/max range.
 */
import type { MacroGroup } from "./types";

export const SILLYTAVERN_MACRO_GROUPS: MacroGroup[] = [
  {
    name: "Identity",
    description: "Who is speaking and who is being spoken to",
    macros: [
      { macro: "{{user}}", description: "Your current persona username" },
      { macro: "{{char}}", description: "The character's name" },
      { macro: "{{persona}}", description: "Your current persona description" },
      { macro: "{{model}}", description: "Model name for the selected API (can be inaccurate)" },
      { macro: "{{group}}", description: "Group member names, comma separated. Alias: {{charIfNotGroup}}" },
      { macro: "{{groupNotMuted}}", description: "Same as group, excluding muted members" },
      { macro: "{{notChar}}", description: "Everyone in the conversation except the current speaker" },
    ],
  },
  {
    name: "Character Card",
    description: "Fields off the character card",
    macros: [
      { macro: "{{description}}", description: "The character's description" },
      { macro: "{{personality}}", description: "The character's personality" },
      { macro: "{{scenario}}", description: "The character's scenario" },
      { macro: "{{mesExamples}}", description: "The character's dialogue examples" },
      { macro: "{{mesExamplesRaw}}", description: "Dialogue examples, unformatted" },
      { macro: "{{version}}", description: "The character's version number" },
      { macro: "{{charDepthPrompt}}", description: "The character's at-depth note" },
      { macro: "{{charPrompt}}", description: "The character's main prompt override" },
      { macro: "{{charInstruction}}", description: "The character's post-history instructions override" },
    ],
  },
  {
    name: "Chat Context",
    description: "Messages and conversation state",
    macros: [
      { macro: "{{lastMessage}}", description: "Text of the latest message" },
      { macro: "{{lastUserMessage}}", description: "Text of the latest user message" },
      { macro: "{{lastCharMessage}}", description: "Text of the latest character message" },
      { macro: "{{lastMessageId}}", description: "Index of the latest message" },
      { macro: "{{firstIncludedMessageId}}", description: "Id of the first message included in context" },
      { macro: "{{firstDisplayedMessageId}}", description: "Id of the first message loaded in the visible chat" },
      { macro: "{{currentSwipeId}}", description: "1-based id of the current swipe on the last message" },
      { macro: "{{lastSwipeId}}", description: "Number of swipes on the last message" },
      { macro: "{{summary}}", description: "Latest chat summary, if the Summarize extension is active" },
      { macro: "{{input}}", description: "The user input" },
      { macro: "{{lastGenerationType}}", description: "Type of the last generation (normal, swipe, continue, ...)" },
    ],
  },
  {
    name: "Time & Date",
    description: "Clock and calendar. Note the separators",
    macros: [
      { macro: "{{time}}", description: "Current time", op: "time.now" },
      { macro: "{{date}}", description: "Current date" },
      { macro: "{{weekday}}", description: "Current weekday" },
      { macro: "{{isotime}}", description: "Current ISO time (24-hour clock)" },
      { macro: "{{isodate}}", description: "Current ISO date (YYYY-MM-DD)" },
      {
        macro: "{{datetimeformat DD.MM.YYYY HH:mm}}",
        op: "time.format",
        description: "Date/time in a custom format. Space separated, not ::",
        example: "{{datetimeformat DD.MM.YYYY HH:mm}}",
      },
      { macro: "{{time_UTC±#}}", description: "Current time at a UTC offset", example: "{{time_UTC-4}}" },
      { macro: "{{timeDiff::(time1)::(time2)}}", description: "Difference between two times; accepts time/date macros" },
      { macro: "{{idle_duration}}", description: "Time since the last user message was sent" },
    ],
  },
  {
    name: "Random & Dice",
    description: "ST picks from a LIST. There is no min/max range macro here",
    macros: [
      { macro: "{{roll:1d6}}", description: "Roll dice. Single colon", example: "{{roll:2d6}}", op: "dice.roll" },
      { macro: "{{random:a,b,c}}", description: "Random item from a comma-separated list", op: "random.pick" },
      {
        macro: "{{random::a::b}}",
        op: "random.pick",
        description: "Random item from the list. The :: form lets items contain commas. NOT a range",
      },
      { macro: "{{pick::a::b}}", description: "Like random, but stays fixed for this chat once picked", op: "random.pick-sticky" },
    ],
  },
  {
    name: "Variables",
    description: "Local (this chat), global (everywhere), and scoped (STscript) variables",
    macros: [
      { macro: "{{getvar::name}}", description: "Read a local variable" },
      { macro: "{{setvar::name::value}}", description: "Set a local variable; resolves to empty" },
      { macro: "{{addvar::name::increment}}", description: "Add a number to a local variable" },
      { macro: "{{incvar::name}}", description: "Increment a local variable by 1" },
      { macro: "{{decvar::name}}", description: "Decrement a local variable by 1" },
      { macro: "{{getglobalvar::name}}", description: "Read a global variable" },
      { macro: "{{setglobalvar::name::value}}", description: "Set a global variable" },
      { macro: "{{addglobalvar::name::value}}", description: "Add a number to a global variable" },
      { macro: "{{incglobalvar::name}}", description: "Increment a global variable by 1" },
      { macro: "{{decglobalvar::name}}", description: "Decrement a global variable by 1" },
      { macro: "{{var::name}}", description: "Read a scoped (STscript) variable" },
      { macro: "{{var::name::index}}", description: "Item at an index of a scoped array or object" },
    ],
  },
  {
    name: "Formatting",
    description: "Whitespace, comments, and plumbing",
    macros: [
      { macro: "{{newline}}", description: "Insert a newline" },
      { macro: "{{trim}}", description: "Trim newlines surrounding this macro. Takes no argument", op: "text.trim-surrounding" },
      { macro: "{{noop}}", description: "Empty string" },
      { macro: "{{reverse:(content)}}", description: "Reverse the content", op: "text.reverse" },
      { macro: "{{// note}}", description: "Author comment, removed from output" },
      { macro: "{{pipe}}", description: "Result of the previous slash command. Slash-command batching only" },
      { macro: "{{original}}", description: "The global prompt from API settings. Only in prompt overrides" },
    ],
  },
  {
    name: "Runtime",
    description: "Backend and environment state",
    macros: [
      { macro: '{{bias "text here"}}', description: "Set a behavioral bias until the next user input. Quotes required" },
      { macro: '{{banned "text here"}}', description: "Add to banned sequences. Text Generation WebUI backend only", op: "gen.banned" },
      { macro: "{{isMobile}}", description: '"true" when running on mobile, otherwise "false"' },
      { macro: "{{maxPrompt}}", description: "Max allowed prompt length in tokens (context size minus response length)" },
    ],
  },
  {
    name: "Lorebook",
    description: "World info access",
    macros: [{ macro: "{{outlet::name}}", description: "World info entry content for the named outlet" }],
  },
  {
    name: "Instruct & Context Template",
    description: "Only available in Advanced Formatting templates",
    macros: [
      { macro: "{{exampleSeparator}}", description: "Context template example-dialogue separator" },
      { macro: "{{chatStart}}", description: "Context template chat start line" },
      { macro: "{{systemPrompt}}", description: "System prompt content if enabled" },
      { macro: "{{defaultSystemPrompt}}", description: "System prompt content" },
      { macro: "{{instructStoryStringPrefix}}", description: "Instruct story string prefix sequence" },
      { macro: "{{instructStoryStringSuffix}}", description: "Instruct story string suffix sequence" },
      { macro: "{{instructUserPrefix}}", description: "Instruct user prefix sequence" },
      { macro: "{{instructUserSuffix}}", description: "Instruct user suffix sequence" },
      { macro: "{{instructAssistantPrefix}}", description: "Instruct assistant prefix sequence" },
      { macro: "{{instructAssistantSuffix}}", description: "Instruct assistant suffix sequence" },
      { macro: "{{instructFirstAssistantPrefix}}", description: "Instruct assistant first output sequence" },
      { macro: "{{instructLastAssistantPrefix}}", description: "Instruct assistant last output sequence" },
      { macro: "{{instructFirstUserPrefix}}", description: "Instruct user first input sequence" },
      { macro: "{{instructLastUserPrefix}}", description: "Instruct user last input sequence" },
      { macro: "{{instructSystemPrefix}}", description: "Instruct system message prefix sequence" },
      { macro: "{{instructSystemSuffix}}", description: "Instruct system message suffix sequence" },
      { macro: "{{instructSystemInstructionPrefix}}", description: "Instruct system instruction prefix" },
      { macro: "{{instructUserFiller}}", description: "Instruct first user message filler" },
      { macro: "{{instructStop}}", description: "Instruct stop sequence" },
    ],
  },
];
