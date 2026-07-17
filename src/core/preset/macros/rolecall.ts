/**
 * RoleCall's macro reference. Transcribed 1-1 from RC's own MacroReferenceDropdown
 * (apps/rc/src/components/presets/editor/MacroReferenceDropdown.tsx) - RC's engine, RC's grouping.
 * RC is a sibling product, so its prose carries over as-is.
 *
 * This is RC's dialect ONLY. Its separators and meanings are NOT portable: {{roll::NdM}} and
 * {{random::min::max}} (a real range here) both differ from SillyTavern's and Marinara's forms.
 * Never reuse this catalog for another lens - see ./sillytavern.ts and ./marinara.ts.
 */
import type { MacroGroup } from "./types";

export const ROLECALL_MACRO_GROUPS: MacroGroup[] = [
  {
    name: "Identity",
    description: "Character, user, and persona names",
    macros: [
      { macro: "{{char}}", description: "Character's name" },
      { macro: "{{user}}", description: "User's display name" },
      { macro: "{{persona}}", description: "User's persona name" },
      { macro: "{{model}}", description: "Current AI model name" },
    ],
  },
  {
    name: "Character Card",
    description: "Character card fields and data",
    macros: [
      { macro: "{{description}}", description: "Character description" },
      { macro: "{{personality}}", description: "Character personality" },
      { macro: "{{scenario}}", description: "Current scenario" },
      { macro: "{{mesExamples}}", description: "Example dialogues (formatted)" },
      { macro: "{{firstMessage}}", description: "Character greeting" },
      { macro: "{{charVersion}}", description: "Character card version" },
      { macro: "{{charCreator}}", description: "Card creator username" },
      { macro: "{{charCreatorNotes}}", description: "Creator's notes" },
      { macro: "{{charTags}}", description: "Character tags (comma-separated)" },
      { macro: "{{charDepthPrompt}}", description: "Character's depth note" },
      { macro: "{{accentColor}}", description: "Character signature color" },
      { macro: "{{palette}}", description: "Character color palette" },
    ],
  },
  {
    name: "Chat Context",
    description: "Messages and conversation state",
    macros: [
      { macro: "{{lastMessage}}", description: "Most recent message content" },
      { macro: "{{lastUserMessage}}", description: "Most recent user message" },
      { macro: "{{lastCharMessage}}", description: "Most recent AI message" },
      { macro: "{{messageCount}}", description: "Total message count" },
      { macro: "{{message::N}}", description: "Message at index N", example: "{{message::0}}" },
      { macro: "{{recentMessages::N}}", description: "Last N messages formatted" },
      { macro: "{{memories}}", description: "Chat memory summaries" },
      { macro: "{{summary}}", description: "Latest chat summary" },
      { macro: "{{userMessageCount}}", description: "Number of user messages" },
      { macro: "{{charMessageCount}}", description: "Number of character messages" },
      { macro: "{{chatId}}", description: "Current chat session ID" },
    ],
  },
  {
    name: "Time & Date",
    description: "Current time and date information",
    macros: [
      { macro: "{{time}}", description: "Current time (12h)" },
      { macro: "{{time::24}}", description: "Current time (24h)" },
      { macro: "{{date}}", description: "Current date" },
      { macro: "{{weekday}}", description: "Day of the week" },
      { macro: "{{isodate}}", description: "ISO date (YYYY-MM-DD)" },
      { macro: "{{datetimeformat::FMT}}", description: "Custom format", example: "{{datetimeformat::YYYY-MM-DD}}" },
      { macro: "{{idle_duration}}", description: "Time since last message" },
      { macro: "{{season}}", description: "Current season" },
    ],
  },
  {
    name: "Variables",
    description: "Get and set local/global variables",
    macros: [
      { macro: "{{getvar::name}}", description: "Get local variable" },
      { macro: "{{setvar::name::value}}", description: "Set local variable" },
      { macro: "{{addvar::name::value}}", description: "Add to variable" },
      { macro: "{{incvar::name}}", description: "Increment by 1" },
      { macro: "{{decvar::name}}", description: "Decrement by 1" },
      { macro: "{{hasvar::name}}", description: "Check if var exists" },
      { macro: "{{getglobalvar::name}}", description: "Get global variable" },
      { macro: "{{setglobalvar::name::value}}", description: "Set global variable" },
      { macro: "{{pushvar::name::value}}", description: "Push to array variable" },
      { macro: "{{listvar::name}}", description: "Get array as list" },
      { macro: "{{allvars}}", description: "List all variable names" },
    ],
  },
  {
    name: "Advanced Syntax",
    description: "Blocks, shorthand variables, and reusable macro functions",
    macros: [
      { macro: "{{if condition}}...{{/if}}", description: "Block if", example: "{{if {{getvar::mood}} == happy}}smiles{{/if}}" },
      { macro: "{{if condition}}...{{else}}...{{/if}}", description: "Block if/else" },
      { macro: "{{setvar::name}}...{{/setvar}}", description: "Set a local variable from block content" },
      { macro: "{{macro::name::body}}", description: "Define a reusable macro" },
      { macro: "{{.name}}", description: "Local variable shorthand for getvar" },
      { macro: "{{.name = value}}", description: "Local variable shorthand for setvar" },
      { macro: "{{$globalName}}", description: "Global variable shorthand" },
      { macro: "{{// comment}}", description: "Invisible comment" },
    ],
  },
  {
    name: "Random & Dice",
    description: "Random values and dice rolls",
    macros: [
      { macro: "{{random}}", description: "Random 0-100" },
      { macro: "{{random::min::max}}", description: "Random in range" },
      { macro: "{{pick::a::b::c}}", description: "Pick random item" },
      { macro: "{{roll::NdM}}", description: "Roll dice", example: "{{roll::2d6}}" },
      { macro: "{{coinflip}}", description: "Heads or Tails" },
      { macro: "{{shuffle::a::b::c}}", description: "Shuffle items" },
      { macro: "{{weighted::a::3::b::1}}", description: "Weighted random pick" },
    ],
  },
  {
    name: "Text Processing",
    description: "String manipulation and formatting",
    macros: [
      { macro: "{{upper::text}}", description: "UPPERCASE" },
      { macro: "{{lower::text}}", description: "lowercase" },
      { macro: "{{title::text}}", description: "Title Case" },
      { macro: "{{trim::text}}", description: "Remove whitespace" },
      { macro: "{{newline}}", description: "Insert newline" },
      { macro: "{{length::text}}", description: "Character count" },
      { macro: "{{truncate::text::len}}", description: "Truncate to length" },
      { macro: "{{replace::text::find::new}}", description: "Find and replace" },
      { macro: "{{regex::text::pattern::new}}", description: "Regex find and replace" },
      { macro: "{{join::delim::a::b}}", description: "Join with delimiter" },
      { macro: "{{repeat::text::N}}", description: "Repeat N times" },
    ],
  },
  {
    name: "Conditionals",
    description: "Conditional logic and comparisons",
    macros: [
      { macro: "{{if::cond::then}}", description: "If condition true" },
      { macro: "{{if::cond::then::else}}", description: "If-else" },
      { macro: "{{compare::a::==::b}}", description: "Compare equality" },
      { macro: "{{compare::a::>::b}}", description: "Compare greater-than" },
      { macro: "{{switch::val::case1::res1}}", description: "Switch statement" },
      { macro: "{{not::value}}", description: "Negate boolean" },
      { macro: "{{and::a::b}}", description: "Logical AND" },
      { macro: "{{or::a::b}}", description: "Logical OR" },
    ],
  },
  {
    name: "Pronouns",
    description: "Character and user pronouns",
    macros: [
      { macro: "{{they}}", description: "Character's they/she/he" },
      { macro: "{{them}}", description: "Character's them/her/him" },
      { macro: "{{their}}", description: "Character's their/her/his" },
      { macro: "{{themself}}", description: "Character's themself/herself/himself" },
      { macro: "{{uthey}}", description: "User's they/she/he" },
      { macro: "{{uthem}}", description: "User's them/her/him" },
      { macro: "{{utheir}}", description: "User's their/her/his" },
    ],
  },
  {
    name: "Runtime & Stats",
    description: "System, token budget, and session stats",
    macros: [
      { macro: "{{maxPrompt}}", description: "Max context tokens" },
      { macro: "{{tokenBudget}}", description: "Maximum context size in tokens" },
      { macro: "{{tokenCount}}", description: "Current prompt token estimate" },
      { macro: "{{tokenRemaining}}", description: "Remaining context tokens" },
      { macro: "{{contextUsage}}", description: "Context usage percentage" },
      { macro: "{{isMobile}}", description: "Is mobile device" },
      { macro: "{{input}}", description: "Chat input content" },
      { macro: "{{banned::text}}", description: "Mark text banned for compatible backends" },
    ],
  },
  {
    name: "Roleplay & Game",
    description: "Story state, RPG helpers, and shorthand variables",
    macros: [
      { macro: "{{mood}}", description: "Current mood variable" },
      { macro: "{{relationship}}", description: "Current relationship variable" },
      { macro: "{{location}}", description: "Current scene location variable" },
      { macro: "{{tension}}", description: "Scene tension variable" },
      { macro: "{{stat::name}}", description: "Read a stat from the stats object" },
      { macro: "{{check::stat::DC}}", description: "Roll d20 plus stat against a difficulty" },
      { macro: "{{damage::2d6+3}}", description: "Roll damage dice" },
      { macro: "{{progress::current::max}}", description: "Render a text progress bar" },
      { macro: "{{inventory}}", description: "List inventory items" },
    ],
  },
  {
    name: "Lorebook",
    description: "World info and lorebook access",
    macros: [
      { macro: "{{triggered}}", description: "All triggered entries" },
      { macro: "{{triggeredEntries}}", description: "Triggered entry names" },
      { macro: "{{lorebookCount}}", description: "Number of triggered entries" },
      { macro: "{{outlet::name}}", description: "Get a lorebook entry by name" },
    ],
  },
];

