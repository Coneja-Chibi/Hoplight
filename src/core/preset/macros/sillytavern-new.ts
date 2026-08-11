/**
 * SillyTavern's macro catalog, read from that engine's own registry.
 *
 * DO NOT EDIT THE ENTRIES BY HAND. Regenerate with:
 *   bun run scripts/sillytavern-macros.ts --st-root=<a SillyTavern checkout>
 *
 * Source: the MacroRegistry of SillyTavern 1.18.0, 93 macros,
 * plus 13 preserved below.
 *
 * THE NEW ENGINE, DELIBERATELY. SillyTavern carries two macro surfaces and
 * power_user.experimental_macro_engine - default true since 1.17.0 - picks between them. This catalog
 * documents the REGISTRY, which is what a default install runs. The older regex table in
 * public/scripts/macros.js spells several macros differently and more permissively
 * ({{roll:1d6}} and {{roll::1d20}} are both parsed by it), so text written for the old engine is
 * not wrong - it is simply not what this file describes. scripts/macro-audit.ts reports the
 * difference between the two.
 *
 * PRESERVED ENTRIES ARE NOT AN OVERSIGHT. Macros registered outside the macro folder are invisible
 * to the dumper, which stubs everything it does not stage: {{authorsNote}} comes from
 * authors-note.js, {{summary}} from extensions/memory, {{charPrefix}} from
 * extensions/stable-diffusion. They are real, so the generator carries them through untouched
 * rather than deleting what it cannot see.
 *
 * The `op` annotations are hand-authored, carried across by macro name, and the generator refuses
 * to write this file if any of them cannot be placed.
 */
import type { MacroGroup } from "./types";

export const SILLYTAVERN_NEW_MACRO_GROUPS: MacroGroup[] = [
  {
    name: "Text Processing",
    description: "SillyTavern's text processing macros.",
    macros: [
      { macro: "{{space}}", description: "Returns one or more spaces. One space by default, more if the count argument is specified." },
      { macro: "{{newline}}", description: "Inserts one or more newlines. One newline by default, more if the count argument is specified." },
      { macro: "{{noop}}", description: "Does nothing and produces an empty string." },
      { macro: "{{trim}}", description: "Trims whitespace. Non-scoped: trims newlines around the macro (post-processing). Scoped: returns the content (auto-trimmed by the engine).", op: "text.trim-surrounding" },
      { macro: "{{if::condition::content}}", description: "Conditional macro. Returns the content if the condition is truthy, otherwise returns nothing (or the else branch if present). Prefix the condition with ! to invert. If the condition is a registered macro name (without braces), it will be resolved first. Variable shorthands (.varname for local, $varname for global) are also supported.", op: "flow.conditional" },
      { macro: "{{else}}", description: "Marks the else branch inside a scoped {{if}} block. Only works inside {{if}}...{{/if}}. If used outside, returns an invisible marker." },
      { macro: "{{input}}", description: "Current text from the send textarea." },
      { macro: "{{reverse::I am Lana}}", description: "Reverses the characters of the argument provided.", op: "text.reverse" },
      { macro: "{{// This is a comment}}", description: "Comment macro that produces an empty string. Can be used for writing into prompt definitions, without being passed to the context.", aliases: ["comment"] },
      { macro: "{{banned::delve}}", description: "Bans a word for Text Completion backend. (Strips quotes surrounding the banned word, if present)", op: "gen.banned" },
      { macro: "{{outlet::character-achievements}}", description: "Returns the world info outlet prompt for a given outlet key." },
    ],
  },
  {
    name: "Runtime & Stats",
    description: "SillyTavern's runtime & stats macros.",
    macros: [
      { macro: "{{maxPrompt}}", description: "Maximum prompt context size.", aliases: ["maxPromptTokens"] },
      { macro: "{{maxContext}}", description: "Maximum context token limit.", aliases: ["maxContextTokens"] },
      { macro: "{{maxResponse}}", description: "Maximum response token limit.", aliases: ["maxResponseTokens"] },
      { macro: "{{model}}", description: "Model name for the currently selected API (Chat Completion or Chat Completion)." },
      { macro: "{{isMobile}}", description: "\"true\" if currently running in a mobile environment, \"false\" otherwise." },
      { macro: "{{lastGenerationType}}", description: "Type of the last queued generation request (e.g. \"normal\", \"impersonate\", \"regenerate\", \"quiet\", \"swipe\", \"continue\"). Empty if none yet or chat was switched." },
      { macro: "{{hasExtension::extensionName}}", description: "Checks if a specific extension is enabled. If the extension does not exist, returns false." },
      { macro: "{{instructStoryStringPrefix}}", description: "Instruct story string prefix." },
      { macro: "{{instructStoryStringSuffix}}", description: "Instruct story string suffix." },
      { macro: "{{instructUserPrefix}}", description: "Instruct input / user prefix sequence.", aliases: ["instructInput"] },
      { macro: "{{instructUserSuffix}}", description: "Instruct input / user suffix sequence." },
      { macro: "{{instructAssistantPrefix}}", description: "Instruct output / assistant prefix sequence.", aliases: ["instructOutput"] },
      { macro: "{{instructAssistantSuffix}}", description: "Instruct output / assistant suffix sequence.", aliases: ["instructSeparator"] },
      { macro: "{{instructSystemPrefix}}", description: "Instruct system prefix sequence." },
      { macro: "{{instructSystemSuffix}}", description: "Instruct system suffix sequence." },
      { macro: "{{instructFirstAssistantPrefix}}", description: "Instruct first assistant / output prefix sequence", aliases: ["instructFirstOutputPrefix"] },
      { macro: "{{instructLastAssistantPrefix}}", description: "Instruct last assistant / output prefix sequence.", aliases: ["instructLastOutputPrefix"] },
      { macro: "{{instructStop}}", description: "Instruct stop sequence." },
      { macro: "{{instructUserFiller}}", description: "Instruct user alignment filler." },
      { macro: "{{instructSystemInstructionPrefix}}", description: "Instruct system instruction prefix sequence." },
      { macro: "{{instructFirstUserPrefix}}", description: "Instruct first user / input prefix sequence.", aliases: ["instructFirstInput"] },
      { macro: "{{instructLastUserPrefix}}", description: "Instruct last user / input prefix sequence.", aliases: ["instructLastInput"] },
      { macro: "{{defaultSystemPrompt}}", description: "Default system prompt.", aliases: ["instructSystem", "instructSystemPrompt"] },
      { macro: "{{systemPrompt}}", description: "Active system prompt text (optionally overridden by character prompt)" },
      { macro: "{{exampleSeparator}}", description: "Separator used between example chat blocks in text completion prompts.", aliases: ["chatSeparator"] },
      { macro: "{{chatStart}}", description: "Chat start marker used in text completion prompts." },
    ],
  },
  {
    name: "Random & Dice",
    description: "SillyTavern's random & dice macros.",
    macros: [
      { macro: "{{roll::1d20}}", description: "Rolls dice using droll syntax (e.g. {{roll 1d20}}).", op: "dice.roll" },
      { macro: "{{random::blonde::brown::red::black::blue}}", description: "Picks a random item from a list. Will be re-rolled every time macros are resolved.", op: "random.pick" },
      { macro: "{{pick::blonde::brown::red::black::blue}}", description: "Picks a random item from a list, but keeps the choice stable for a given chat and macro position. Can be rerolled via /reroll-pick slash command.", op: "random.pick-sticky" },
    ],
  },
  {
    name: "Identity",
    description: "SillyTavern's identity macros.",
    macros: [
      { macro: "{{user}}", description: "Your current Persona username." },
      { macro: "{{char}}", description: "The character's name." },
      { macro: "{{group}}", description: "Comma-separated list of group member names (including muted) or the character name in solo chats.", aliases: ["charIfNotGroup"] },
      { macro: "{{groupNotMuted}}", description: "Comma-separated list of group member names excluding muted members." },
      { macro: "{{notChar}}", description: "Comma-separated list of all participants except the current speaker." },
    ],
  },
  {
    name: "Character Card",
    description: "SillyTavern's character card macros.",
    macros: [
      { macro: "{{charPrompt}}", description: "The character's Main Prompt override." },
      { macro: "{{charInstruction}}", description: "The character's Post-History Instructions override." },
      { macro: "{{charDescription}}", description: "The character's description.", aliases: ["description"] },
      { macro: "{{charPersonality}}", description: "The character's personality.", aliases: ["personality"] },
      { macro: "{{charScenario}}", description: "The character's scenario.", aliases: ["scenario"] },
      { macro: "{{persona}}", description: "Your current Persona description." },
      { macro: "{{mesExamplesRaw}}", description: "Unformatted dialogue examples from the character card." },
      { macro: "{{mesExamples}}", description: "The character's dialogue examples, formatted for instruct mode when enabled." },
      { macro: "{{charDepthPrompt}}", description: "The character's @ Depth Note." },
      { macro: "{{charCreatorNotes}}", description: "Creator notes from the character card.", aliases: ["creatorNotes"], op: "char.creator-notes" },
      { macro: "{{charFirstMessage}}", description: "The character's first message / greeting. Optionally specify an index to access alternate greetings.", aliases: ["greeting"], op: "char.first-message" },
      { macro: "{{charVersion}}", description: "The character's version number.", aliases: ["version", "char_version"], op: "char.version" },
      { macro: "{{original}}", description: "Original message content for {{original}} substitution in in character prompt overrides." },
    ],
  },
  {
    name: "Chat Context",
    description: "SillyTavern's chat context macros.",
    macros: [
      { macro: "{{lastMessage}}", description: "Last message in the chat." },
      { macro: "{{lastMessageId}}", description: "Index of the last message in the chat." },
      { macro: "{{lastUserMessage}}", description: "Last user message in the chat." },
      { macro: "{{lastCharMessage}}", description: "Last character/bot message in the chat." },
      { macro: "{{firstIncludedMessageId}}", description: "Index of the first message included in the current context." },
      { macro: "{{firstDisplayedMessageId}}", description: "Index of the first displayed message in the chat." },
      { macro: "{{lastSwipeId}}", description: "1-based index of the last swipe for the last message." },
      { macro: "{{currentSwipeId}}", description: "1-based index of the current swipe." },
      { macro: "{{allChatRange}}", description: "Range of all message IDs in the chat (e.g. \"0-10\"). Empty string if the chat is empty." },
      { macro: "{{summary}}", description: "Latest chat summary, if the Summarize extension is active" },
    ],
  },
  {
    name: "Time & Date",
    description: "SillyTavern's time & date macros.",
    macros: [
      { macro: "{{time}}", description: "Current local time, or UTC offset when called as {{time::UTC±(offset)}}", op: "time.now" },
      { macro: "{{date}}", description: "Current local date as a string in the local short format." },
      { macro: "{{weekday}}", description: "Current weekday name." },
      { macro: "{{isotime}}", description: "Current time in HH:mm format." },
      { macro: "{{isodate}}", description: "Current date in YYYY-MM-DD format." },
      { macro: "{{datetimeformat::YYYY-MM-DD HH:mm:ss}}", description: "Formats the current date/time using the given moment.js format string.", op: "time.format" },
      { macro: "{{idleDuration}}", description: "Human-readable duration since the last user message.", aliases: ["idle_duration"] },
      { macro: "{{timeDiff::left::right}}", description: "Human-readable difference between two times. Order of times does not matter, it will return the absolute difference." },
    ],
  },
  {
    name: "Variables",
    description: "SillyTavern's variables macros.",
    macros: [
      { macro: "{{setvar::myvar::foo}}", description: "Sets a local variable to the given value." },
      { macro: "{{addvar::mystrvar::foo}}", description: "Adds a value to an existing local variable (numeric or string append). If the variable does not exist, it will be created." },
      { macro: "{{incvar::myintvar}}", description: "Increments a local variable by 1 and returns the new value. If the variable does not exist, it will be created." },
      { macro: "{{decvar::myintvar}}", description: "Decrements a local variable by 1 and returns the new value. If the variable does not exist, it will be created." },
      { macro: "{{getvar::myvar}}", description: "Gets the value of a local variable." },
      { macro: "{{hasvar::myvar}}", description: "Checks if a local variable exists.", aliases: ["varexists"] },
      { macro: "{{deletevar::myvar}}", description: "Deletes a local variable.", aliases: ["flushvar"] },
      { macro: "{{setvarkey::myarray::0::foo}}", description: "Sets a value at a specific key or index in a local object or array. If the variable does not exist, it will be created based on the type of the key.", aliases: ["setvarindex"] },
      { macro: "{{getvarkey::myarray::0}}", description: "Gets a value at a specific key or index in a local object or array variable.", aliases: ["getvarindex"] },
      { macro: "{{setglobalvar::myvar::foo}}", description: "Sets a global variable to the given value." },
      { macro: "{{addglobalvar::mystrvar::foo}}", description: "Adds a value to an existing global variable (numeric or string append). If the variable does not exist, it will be created." },
      { macro: "{{incglobalvar::myintvar}}", description: "Increments a global variable by 1 and returns the new value. If the variable does not exist, it will be created." },
      { macro: "{{decglobalvar::myintvar}}", description: "Decrements a global variable by 1 and returns the new value. If the variable does not exist, it will be created." },
      { macro: "{{getglobalvar::myvar}}", description: "Gets the value of a global variable." },
      { macro: "{{hasglobalvar::myvar}}", description: "Checks if a global variable exists.", aliases: ["globalvarexists"] },
      { macro: "{{deleteglobalvar::myvar}}", description: "Deletes a global variable.", aliases: ["flushglobalvar"] },
      { macro: "{{setglobalvarkey::myarray::0::foo}}", description: "Sets a value at a specific key or index in a global object or array variable. If the variable does not exist, it will be created based on the type of the key.", aliases: ["setglobalvarindex"] },
      { macro: "{{getglobalvarkey::myarray::0}}", description: "Gets a value at a specific key or index in a global object or array variable.", aliases: ["getglobalvarindex"] },
      { macro: "{{var::name}}", description: "Read a scoped (STscript) variable" },
      { macro: "{{var::name::index}}", description: "Item at an index of a scoped array or object" },
    ],
  },
  {
    name: "Registered by other modules",
    description: "Macros other parts of SillyTavern add at startup rather than the macro engine itself - the author's note, bundled extensions. Real, and invisible to a dump of the registry alone.",
    macros: [
      { macro: "{{defaultExpression}}", description: "Returns the global fallback expression." },
      { macro: "{{lastExpression}}", description: "Returns the last expression used." },
      { macro: "{{availableExpressions}}", description: "Returns a list with all the available expressions provided by the Classifier API." },
    ],
  },
  {
    name: "Formatting",
    description: "SillyTavern's formatting macros.",
    macros: [
      { macro: "{{pipe}}", description: "Result of the previous slash command. Slash-command batching only" },
    ],
  },
  {
    name: "Runtime",
    description: "SillyTavern's runtime macros.",
    macros: [
      { macro: "{{bias \"text here\"}}", description: "Set a behavioral bias until the next user input. Quotes required" },
    ],
  },
  {
    name: "Card, state and runtime",
    description: "SillyTavern's card, state and runtime macros.",
    macros: [
      { macro: "{{charPrefix}}", description: "Character-specific prefix" },
      { macro: "{{charNegativePrefix}}", description: "Character-specific negative prefix" },
      { macro: "{{charAuthorsNote}}", description: "The character's Author's Note" },
      { macro: "{{authorsNote}}", description: "The active Author's Note" },
      { macro: "{{defaultAuthorsNote}}", description: "The default Author's Note" },
      { macro: "{{reasoningPrefix}}", description: "Reasoning block prefix", op: "format.reasoning-prefix" },
      { macro: "{{reasoningSuffix}}", description: "Reasoning block suffix", op: "format.reasoning-suffix" },
      { macro: "{{reasoningSeparator}}", description: "Reasoning block separator" },
    ],
  },
];
