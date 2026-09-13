{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/apps/macro-lab/styles.module.css */\n.room_Y8XB1Q {\n  container-type: inline-size;\n  display: flex;\n  overflow-y: auto;\n  flex-direction: column;\n  flex: 1;\n  gap: .9rem;\n  min-height: 0;\n  padding: clamp(.9rem, 2.4vw, 1.8rem);\n}\n\n.head_Y8XB1Q {\n  max-width: 54rem;\n}\n\n.eyebrow_Y8XB1Q {\n  font-family: var(--font-mono);\n  letter-spacing: .14em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .65rem;\n  font-weight: 800;\n}\n\n.title_Y8XB1Q {\n  font-family: var(--font-big);\n  font-size: var(--text-title);\n  color: var(--text);\n  margin: .25rem 0 .4rem;\n  line-height: 1;\n}\n\n.lede_Y8XB1Q {\n  color: var(--text-soft);\n  margin: 0;\n  line-height: 1.45;\n}\n\n.lenses_Y8XB1Q {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .4rem;\n}\n\n.lens_Y8XB1Q {\n  font-family: var(--font-big);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--text-soft);\n  background: var(--face);\n  border: 3px solid var(--edge);\n  cursor: pointer;\n  padding: .4rem .7rem;\n  font-size: .7rem;\n  font-weight: 800;\n}\n\n.lensOn_Y8XB1Q {\n  color: var(--stage-ink);\n  background: var(--a);\n  box-shadow: 3px 3px 0 0 var(--edge);\n}\n\n.boxes_Y8XB1Q {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n  align-items:  start;\n  gap: 1rem;\n}\n\n@container (width <= 52rem) {\n  .boxes_Y8XB1Q {\n    grid-template-columns: minmax(0, 1fr);\n  }\n}\n\n.box_Y8XB1Q {\n  display: flex;\n  background: var(--face);\n  border: 3px solid var(--edge);\n  box-shadow: 5px 5px 0 0 var(--a);\n  flex-direction: column;\n  gap: .7rem;\n  min-width: 0;\n  padding: .9rem;\n}\n\n.boxHead_Y8XB1Q {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: .6rem;\n}\n\n.boxTitle_Y8XB1Q {\n  font-family: var(--font-big);\n  color: var(--text);\n  margin: 0;\n  font-size: .95rem;\n}\n\n.boxNote_Y8XB1Q {\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .62rem;\n}\n\n.source_Y8XB1Q {\n  resize: vertical;\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--stage-row, var(--face));\n  border: 3px solid var(--edge);\n  width: 100%;\n  min-height: 11rem;\n  padding: .6rem;\n  font-size: .82rem;\n  line-height: 1.55;\n}\n\n.who_Y8XB1Q {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  align-items:  center;\n  gap: .4rem .6rem;\n}\n\n.whoLabel_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text-soft);\n  white-space: nowrap;\n  font-size: .72rem;\n}\n\n.field_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--stage-row, var(--face));\n  border: 2px solid var(--edge);\n  min-width: 0;\n  padding: .35rem .45rem;\n  font-size: .78rem;\n}\n\n.vars_Y8XB1Q {\n  display: flex;\n  flex-direction: column;\n  gap: .35rem;\n}\n\n.varRow_Y8XB1Q {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;\n  align-items:  center;\n  gap: .35rem;\n}\n\n.drop_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  border: 2px solid var(--edge);\n  cursor: pointer;\n  background: none;\n  padding: .3rem .5rem;\n  font-size: .8rem;\n  line-height: 1;\n}\n\n.actions_Y8XB1Q {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .6rem;\n}\n\n.why_Y8XB1Q {\n  color: var(--text-dim);\n  flex: 1;\n  min-width: 12rem;\n  font-size: .76rem;\n  line-height: 1.4;\n}\n\n.resolved_Y8XB1Q {\n  overflow: auto;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--stage-row, var(--face));\n  border: 3px solid var(--edge);\n  min-height: 4rem;\n  max-height: 22rem;\n  margin: 0;\n  padding: .6rem;\n  font-size: .82rem;\n  line-height: 1.55;\n}\n\n.stamp_Y8XB1Q {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  color: var(--text-dim);\n  font-size: .62rem;\n}\n\n.quiet_Y8XB1Q {\n  color: var(--text-dim);\n  margin: 0;\n  font-size: .82rem;\n  line-height: 1.45;\n}\n\n.problem_Y8XB1Q {\n  color: var(--text);\n  background: var(--stage-row, var(--face));\n  border-left: 4px solid var(--edge);\n  margin: 0;\n  padding: .5rem .6rem;\n  font-size: .82rem;\n  line-height: 1.45;\n}\n\n.rows_Y8XB1Q {\n  display: flex;\n  overflow-y: auto;\n  flex-direction: column;\n  gap: .5rem;\n  max-height: 26rem;\n}\n\n.row_Y8XB1Q {\n  border: 2px solid var(--edge);\n  background: var(--stage-row, var(--face));\n  min-width: 0;\n  padding: .5rem .6rem;\n}\n\n.rowNested_Y8XB1Q {\n  border-left-width: 5px;\n  margin-left: 1.1rem;\n}\n\n.rowHead_Y8XB1Q {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: .5rem;\n}\n\n.token_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text);\n  overflow-wrap: anywhere;\n  font-size: .8rem;\n  font-weight: 700;\n}\n\n.verdict_Y8XB1Q {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: 2px solid var(--edge);\n  color: var(--text-soft);\n  padding: .1rem .35rem;\n  font-size: .6rem;\n}\n\n.verdictKnown_Y8XB1Q {\n  color: var(--stage-ink);\n  background: var(--a);\n}\n\n.meaning_Y8XB1Q {\n  color: var(--text-soft);\n  margin: .3rem 0 0;\n  font-size: .8rem;\n  line-height: 1.4;\n}\n\n.example_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  overflow-wrap: anywhere;\n  margin: .25rem 0 0;\n  font-size: .72rem;\n}\n\n.travel_Y8XB1Q {\n  display: flex;\n  flex-direction: column;\n  gap: .2rem;\n  margin: .4rem 0 0;\n}\n\n.travelRow_Y8XB1Q {\n  display: flex;\n  color: var(--text-dim);\n  flex-wrap: wrap;\n  gap: .4rem;\n  font-size: .74rem;\n  line-height: 1.35;\n}\n\n.travelLens_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text-soft);\n  min-width: 6rem;\n  font-weight: 700;\n}\n\n.travelSame_Y8XB1Q {\n  color: var(--text-dim);\n}\n\n.travelFlag_Y8XB1Q {\n  color: var(--text);\n  font-weight: 600;\n}\n\n.more_Y8XB1Q {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  border: 2px solid var(--edge);\n  cursor: pointer;\n  background: none;\n  align-self:  flex-start;\n  padding: .2rem .4rem;\n  font-size: .62rem;\n}\n\n.tokens_Y8XB1Q {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .3rem;\n}\n\n.deadToken_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text);\n  border: 2px solid var(--edge);\n  overflow-wrap: anywhere;\n  padding: .15rem .4rem;\n  font-size: .74rem;\n}\n\n.stack_Y8XB1Q {\n  display: flex;\n  flex-direction: column;\n  gap: 1rem;\n  min-width: 0;\n}\n\n.tabs_Y8XB1Q {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .35rem;\n}\n\n.tab_Y8XB1Q {\n  font-family: var(--font-big);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--text-soft);\n  background: var(--face);\n  border: 2px solid var(--edge);\n  cursor: pointer;\n  padding: .35rem .65rem;\n  font-size: .68rem;\n  font-weight: 800;\n}\n\n.tabOn_Y8XB1Q {\n  color: var(--stage-ink);\n  background: var(--a);\n  box-shadow: 2px 2px 0 0 var(--edge);\n}\n\n.groupHead_Y8XB1Q {\n  display: flex;\n  cursor: pointer;\n  text-align: left;\n  background: none;\n  border: 0;\n  justify-content: space-between;\n  align-items:  center;\n  gap: .6rem;\n  width: 100%;\n  padding: 0;\n}\n\n.entries_Y8XB1Q {\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: .45rem;\n  margin: .5rem 0 0;\n  padding: 0;\n}\n\n.entry_Y8XB1Q {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: .4rem;\n  min-width: 0;\n}\n\n.insert_Y8XB1Q {\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--face);\n  border: 2px solid var(--edge);\n  cursor: pointer;\n  overflow-wrap: anywhere;\n  padding: .15rem .4rem;\n  font-size: .74rem;\n  font-weight: 700;\n}\n\n.insert_Y8XB1Q:hover {\n  color: var(--stage-ink);\n  background: var(--a);\n}\n\n.insert_Y8XB1Q:focus-visible {\n  color: var(--stage-ink);\n  background: var(--a);\n}\n\n.entryDesc_Y8XB1Q {\n  color: var(--text-soft);\n  flex: 1;\n  min-width: 8rem;\n  font-size: .78rem;\n  line-height: 1.35;\n}\n\n/* src/ui/components/stamp/styles.module.css */\n.topbtn_XRqkoA {\n  display: flex;\n  font-family: var(--font-big);\n  letter-spacing: .13em;\n  text-transform: uppercase;\n  color: var(--text);\n  background: var(--chrome);\n  cursor: pointer;\n  align-items:  center;\n  gap: .4rem;\n  padding: .45rem .7rem;\n  font-size: .625rem;\n  font-weight: 800;\n}\n\n.topbtn_XRqkoA svg {\n  display: block;\n}\n\n.topbtn_XRqkoA:disabled {\n  opacity: .45;\n  cursor: default;\n  pointer-events: none;\n}\n\n/* src/ui/apps/macro-lab/ops.module.css */\n.tableWrap_oB2LjA {\n  overflow-x: auto;\n  border: 2px solid var(--edge);\n  max-width: 100%;\n}\n\n.table_oB2LjA {\n  border-collapse: collapse;\n  width: 100%;\n  font-size: .76rem;\n}\n\n.table_oB2LjA th, .table_oB2LjA td {\n  text-align: left;\n  vertical-align: top;\n  border-bottom: 2px solid var(--edge);\n  padding: .4rem .5rem;\n}\n\n.table_oB2LjA thead th {\n  position: sticky;\n  font-family: var(--font-big);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  background: var(--face);\n  white-space: nowrap;\n  font-size: .62rem;\n  top: 0;\n}\n\n.opCell_oB2LjA {\n  display: flex;\n  white-space: nowrap;\n  flex-direction: column;\n  gap: .1rem;\n}\n\n.opAction_oB2LjA {\n  font-family: var(--font-big);\n  color: var(--text);\n  font-size: .78rem;\n}\n\n.opFamily_oB2LjA {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .6rem;\n}\n\n.gap_oB2LjA {\n  background: var(--stage-row, transparent);\n}\n\n.gapWord_oB2LjA {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .7rem;\n}\n";document.head.append(s);}
// src/ui/apps/macro-lab/index.tsx
import {
  useCallback,
  useEffect,
  useMemo as useMemo3,
  useRef,
  useState as useState3
} from "react";

// src/ui/_shared/api-fetch.ts
var apiStatusIs = (error, status) => typeof error === "object" && error !== null && error.status === status;
var INSPECT_BODY_MAX_BYTES = 64 * 1024 * 1024;

// src/core/preset/macros/rolecall.ts
var ROLECALL_MACRO_GROUPS = [
  {
    name: "Identity",
    description: "Character, user, and persona names",
    macros: [
      { macro: "{{char}}", description: "Character's name" },
      { macro: "{{user}}", description: "User's display name" },
      { macro: "{{persona}}", description: "User's persona name" },
      { macro: "{{model}}", description: "Current AI model name" }
    ]
  },
  {
    name: "Character Card",
    description: "Character card fields and data",
    macros: [
      { macro: "{{description}}", description: "Character description" },
      { macro: "{{personality}}", description: "Character personality" },
      { macro: "{{scenario}}", description: "Current scenario" },
      { macro: "{{mesExamples}}", description: "Example dialogues (formatted)" },
      { macro: "{{mesExamplesRaw}}", description: "Example dialogues (raw)" },
      { macro: "{{firstMessage}}", op: "char.first-message", description: "Character greeting" },
      { macro: "{{charVersion}}", description: "Character card version", op: "char.version" },
      { macro: "{{charCreator}}", description: "Card creator username" },
      { macro: "{{charCreatorNotes}}", description: "Creator notes", op: "char.creator-notes" },
      { macro: "{{charTags}}", description: "Character tags (comma-separated)" },
      { macro: "{{charPrompt}}", description: "Character's prompt override" },
      { macro: "{{charInstruction}}", description: "Character's post-history instructions" },
      { macro: "{{charDepthPrompt}}", description: "Character's depth note" },
      { macro: "{{accentColor}}", description: "Character signature color" },
      { macro: "{{palette}}", description: "Character color palette" },
      { macro: "{{gradient}}", description: "Character gradient colors" },
      { macro: "{{personaColor}}", description: "Persona signature color" },
      { macro: "{{personaPalette}}", description: "Persona color palette" }
    ]
  },
  {
    name: "Chat Context",
    description: "Messages and conversation state",
    macros: [
      { macro: "{{lastMessage}}", description: "Most recent message content" },
      { macro: "{{lastUserMessage}}", description: "Most recent user message" },
      { macro: "{{lastCharMessage}}", description: "Most recent AI message" },
      { macro: "{{firstMessage}}", description: "Very first message" },
      { macro: "{{messageCount}}", description: "Total message count" },
      { macro: "{{message::N}}", description: "Message at index N", example: "{{message::0}} for first" },
      { macro: "{{recentMessages::N}}", description: "Last N messages formatted" },
      { macro: "{{message history}}", description: "Full chat history (token-aware)" },
      { macro: "{{memories}}", description: "Chat memory summaries", op: "chat.memories" },
      { macro: "{{summary}}", description: "Latest chat summary" },
      { macro: "{{lastMessageId}}", description: "Index of last message" },
      { macro: "{{firstIncludedMessageId}}", description: "First message in context" },
      { macro: "{{firstDisplayedMessageId}}", description: "First message visible in the chat view" },
      { macro: "{{userMessageCount}}", description: "Number of user messages" },
      { macro: "{{charMessageCount}}", description: "Number of character messages" },
      { macro: "{{chatStart}}", description: "Chat start time" },
      { macro: "{{currentSwipeId}}", description: "Current swipe index" },
      { macro: "{{lastSwipeId}}", description: "Last available swipe index" },
      { macro: "{{chatId}}", description: "Current chat session ID" }
    ]
  },
  {
    name: "Time & Date",
    description: "Current time and date information",
    macros: [
      { macro: "{{time}}", description: "Current time (12h format)", op: "time.now" },
      { macro: "{{time::24}}", description: "Current time (24h format)" },
      { macro: "{{date}}", description: "Current date" },
      { macro: "{{date::long}}", description: "Long date format" },
      { macro: "{{weekday}}", description: "Day of the week" },
      { macro: "{{month}}", description: "Current month name" },
      { macro: "{{day}}", description: "Day of month" },
      { macro: "{{year}}", description: "Current year" },
      { macro: "{{isodate}}", description: "ISO date (YYYY-MM-DD)" },
      { macro: "{{isotime}}", description: "ISO datetime" },
      { macro: "{{datetimeformat::FMT}}", description: "Custom format", example: "{{datetimeformat::YYYY-MM-DD}}", op: "time.format" },
      { macro: "{{timeDiff::D1::D2}}", description: "Time between two dates" },
      { macro: "{{idle_duration}}", description: "Time since last message" },
      { macro: "{{season}}", description: "Current season" },
      { macro: "{{moonPhase}}", description: "Current moon phase" },
      { macro: "{{zodiac}}", description: "Current zodiac sign" }
    ]
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
      { macro: "{{delvar::name}}", description: "Delete variable" },
      { macro: "{{getglobalvar::name}}", description: "Get global variable" },
      { macro: "{{setglobalvar::name::value}}", description: "Set global variable" },
      { macro: "{{addglobalvar::name::value}}", description: "Add to global variable" },
      { macro: "{{incglobalvar::name}}", description: "Increment global variable" },
      { macro: "{{decglobalvar::name}}", description: "Decrement global variable" },
      { macro: "{{pushvar::name::value}}", description: "Push to array variable" },
      { macro: "{{popvar::name}}", description: "Pop from array" },
      { macro: "{{listvar::name}}", description: "Get array as list" },
      { macro: "{{countvar::name}}", description: "Count array items or object keys" },
      { macro: "{{allvars}}", description: "List all variable names" }
    ]
  },
  {
    name: "Advanced Syntax",
    description: "Blocks, shorthand variables, and reusable macro functions",
    macros: [
      { macro: "{{if condition}}...{{/if}}", description: "Block if; supports nested macros and comparisons", example: "{{if {{getvar::mood}} == happy}}smiles{{/if}}", op: "flow.conditional" },
      { macro: "{{#if condition}}...{{/if}}", description: "SillyTavern-style block if alias" },
      { macro: "{{if condition}}...{{else}}...{{/if}}", description: "Block if/else with short-circuit branch evaluation" },
      { macro: "{{setvar::name}}...{{/setvar}}", description: "Set a local variable from block content" },
      { macro: "{{setglobalvar::name}}...{{/setglobalvar}}", description: "Set a global variable from block content" },
      { macro: "{{macro::name::body}}", description: "Define a reusable macro for this prompt assembly" },
      { macro: "{{macro::name::arg1::arg2}}", description: "Call a previously defined macro" },
      { macro: "{{.name}}", description: "Local variable shorthand for getvar" },
      { macro: "{{.name = value}}", description: "Local variable shorthand for setvar" },
      { macro: "{{.name++}}", description: "Local variable shorthand for increment" },
      { macro: "{{$globalName}}", description: "Global variable shorthand" },
      { macro: "{{// comment}}", description: "Invisible comment" }
    ]
  },
  {
    name: "Random & Dice",
    description: "Random values and dice rolls",
    macros: [
      { macro: "{{random}}", description: "Random 0-100", op: "random.range" },
      { macro: "{{random::min::max}}", description: "Random in range", op: "random.range" },
      { macro: "{{random::a::b::c}}", description: "Three or more arguments picks one of the listed items, not a range", op: "random.pick" },
      { macro: "{{pick::a::b::c}}", description: "Pick random item", op: "random.pick" },
      { macro: "{{roll::NdM}}", description: "Roll dice", example: "{{roll::2d6}}", op: "dice.roll" },
      { macro: "{{range::start::end::step}}", description: "Pick a random number from a stepped range" },
      { macro: "{{coinflip}}", description: "Heads or Tails" },
      { macro: "{{percent}}", description: "Random percentage from 0 to 100" },
      { macro: "{{shuffle::a::b::c}}", description: "Shuffle items", op: "random.shuffle" },
      { macro: "{{weighted::a::3::b::1}}", description: "Weighted random pick" }
    ]
  },
  {
    name: "Text Processing",
    description: "String manipulation and formatting",
    macros: [
      { macro: "{{upper::text}}", description: "UPPERCASE" },
      { macro: "{{lower::text}}", description: "lowercase" },
      { macro: "{{title::text}}", description: "Title Case" },
      { macro: "{{trim}}", description: "Collapses the whitespace around this point; takes no argument", op: "text.trim-surrounding" },
      { macro: "{{trim::text}}", description: "Remove whitespace", op: "text.trim-argument" },
      { macro: "{{newline}}", description: "Insert newline" },
      { macro: "{{space}}", description: "Insert space" },
      { macro: "{{space::N}}", description: "Insert N spaces" },
      { macro: "{{reverse::text}}", description: "Reverse text", op: "text.reverse" },
      { macro: "{{length::text}}", description: "Character count" },
      { macro: "{{wordcount::text}}", description: "Word count" },
      { macro: "{{truncate::text::len}}", description: "Truncate to length" },
      { macro: "{{replace::text::find::new}}", description: "Find and replace" },
      { macro: "{{regex::text::pattern::new}}", description: "Regex find and replace" },
      { macro: "{{split::text::delim::N}}", description: "Split and get item N" },
      { macro: "{{join::delim::a::b}}", description: "Join with delimiter", op: "text.join" },
      { macro: "{{repeat::text::N}}", description: "Repeat N times" },
      { macro: "{{pad::text::len::char::right}}", description: "Pad text left, right, or centered" },
      { macro: "{{noop}}", description: "Returns empty string" },
      { macro: "{{// comment}}", description: "Invisible comment" }
    ]
  },
  {
    name: "Conditionals",
    description: "Conditional logic and comparisons",
    macros: [
      { macro: "{{if::cond::then}}", description: "If condition true", op: "flow.conditional" },
      { macro: "{{if::cond::then::else}}", description: "If-else" },
      { macro: "{{compare::a::==::b}}", description: "Compare equality; returns true or false" },
      { macro: "{{compare::a::>::b}}", description: "Compare greater-than; returns true or false" },
      { macro: "{{compare::text::contains::sub}}", description: "Check whether text contains a substring" },
      { macro: "{{switch::val::case1::res1::...}}", description: "Switch statement" },
      { macro: "{{not::value}}", description: "Negate boolean" },
      { macro: "{{and::a::b}}", description: "Logical AND" },
      { macro: "{{or::a::b}}", description: "Logical OR" }
    ]
  },
  {
    name: "Pronouns",
    description: "Character and user pronouns",
    macros: [
      { macro: "{{they}}", description: "Character's they/she/he" },
      { macro: "{{them}}", description: "Character's them/her/him" },
      { macro: "{{their}}", description: "Character's their/her/his" },
      { macro: "{{theirs}}", description: "Character's theirs/hers/his" },
      { macro: "{{themself}}", description: "Character's themself/herself/himself" },
      { macro: "{{uthey}}", description: "User's they/she/he" },
      { macro: "{{uthem}}", description: "User's them/her/him" },
      { macro: "{{utheir}}", description: "User's their/her/his" },
      { macro: "{{utheirs}}", description: "User's theirs/hers/his" },
      { macro: "{{uthemself}}", description: "User's themself/herself/himself" }
    ]
  },
  {
    name: "Runtime & Stats",
    description: "System, token budget, and session stats",
    macros: [
      { macro: "{{maxPrompt}}", description: "Max context tokens" },
      { macro: "{{tokenBudget}}", description: "Maximum context size in tokens" },
      { macro: "{{tokenCount}}", description: "Current prompt token estimate", op: "prompt.tokencount" },
      { macro: "{{tokenRemaining}}", description: "Remaining context tokens" },
      { macro: "{{responseTokens}}", description: "Maximum response token setting" },
      { macro: "{{sessionTokens}}", description: "Total session token estimate" },
      { macro: "{{contextUsage}}", description: "Context usage percentage" },
      { macro: "{{costEstimate}}", description: "Estimated API cost when rates are available" },
      { macro: "{{isMobile}}", description: "Is mobile device" },
      { macro: "{{lastGenerationType}}", description: "Last gen type (chat, etc.)" },
      { macro: "{{input}}", description: "Chat input content" },
      { macro: "{{orisonPreferences}}", description: "Active approved Orison memory bullets when RP prompt influence is enabled" },
      { macro: "{{orisonPreferenceBlock}}", description: "Wrapped Orison preference system block" },
      { macro: "{{banned::text}}", description: "Mark text as banned for compatible completion backends", op: "gen.banned" },
      { macro: "{{outlet::name}}", description: "Get a lorebook entry by outlet/name" }
    ]
  },
  {
    name: "Roleplay & Game",
    description: "Story state, RPG helpers, and shorthand variables",
    macros: [
      { macro: "{{mood}}", description: "Current mood variable" },
      { macro: "{{relationship}}", description: "Current relationship variable" },
      { macro: "{{location}}", description: "Current scene location variable" },
      { macro: "{{timeOfDay}}", description: "In-story time of day variable" },
      { macro: "{{trust}}", description: "Trust level variable" },
      { macro: "{{affection}}", description: "Affection level variable" },
      { macro: "{{tension}}", description: "Scene tension variable" },
      { macro: "{{weather}}", description: "Weather variable" },
      { macro: "{{stat::name}}", description: "Read a stat from the stats object" },
      { macro: "{{check::stat::DC}}", description: "Roll d20 plus stat against a difficulty" },
      { macro: "{{damage::2d6+3}}", description: "Roll damage dice" },
      { macro: "{{hp}}", description: "Display current HP" },
      { macro: "{{progress::current::max}}", description: "Render a text progress bar" },
      { macro: "{{inventory}}", description: "List inventory items" },
      { macro: "{{questStatus::name}}", description: "Read quest status" },
      { macro: "{{gold}}", description: "Gold or currency amount" },
      { macro: "{{level}}", description: "Level variable" },
      { macro: "{{xp}}", description: "Experience points variable" }
    ]
  },
  {
    name: "Lorebook",
    description: "World info and lorebook access",
    macros: [
      { macro: "{{triggered}}", description: "All triggered entries" },
      { macro: "{{triggeredEntries}}", description: "Triggered entry names" },
      { macro: "{{lorebookCount}}", description: "Number of triggered entries" },
      { macro: "{{lorebookTokens}}", description: "Estimated tokens used by triggered entries" },
      { macro: "{{lorebookList}}", description: "Active lorebook names" },
      { macro: "{{lorebookRandom::group}}", description: "Random entry from an inclusion group" },
      { macro: "{{entry::name}}", description: "Get specific entry content" },
      { macro: "{{lore::name}}", description: "Get a lorebook entry by name" }
    ]
  }
];

// src/core/preset/macros/sillytavern.ts
var SILLYTAVERN_MACRO_GROUPS = [
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
      { macro: "{{notChar}}", description: "Everyone in the conversation except the current speaker" }
    ]
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
      { macro: "{{charInstruction}}", description: "The character's post-history instructions override" }
    ]
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
      { macro: "{{lastGenerationType}}", description: "Type of the last generation (normal, swipe, continue, ...)" }
    ]
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
        example: "{{datetimeformat DD.MM.YYYY HH:mm}}"
      },
      { macro: "{{time_UTC±#}}", description: "Current time at a UTC offset", example: "{{time_UTC-4}}" },
      { macro: "{{timeDiff::(time1)::(time2)}}", description: "Difference between two times; accepts time/date macros" },
      { macro: "{{idle_duration}}", description: "Time since the last user message was sent" }
    ]
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
        description: "Random item from the list. The :: form lets items contain commas. NOT a range"
      },
      { macro: "{{pick::a::b}}", description: "Like random, but stays fixed for this chat once picked", op: "random.pick-sticky" }
    ]
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
      { macro: "{{var::name::index}}", description: "Item at an index of a scoped array or object" }
    ]
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
      { macro: "{{original}}", description: "The global prompt from API settings. Only in prompt overrides" }
    ]
  },
  {
    name: "Runtime",
    description: "Backend and environment state",
    macros: [
      { macro: '{{bias "text here"}}', description: "Set a behavioral bias until the next user input. Quotes required" },
      { macro: '{{banned "text here"}}', description: "Add to banned sequences. Text Generation WebUI backend only", op: "gen.banned" },
      { macro: "{{isMobile}}", description: '"true" when running on mobile, otherwise "false"' },
      { macro: "{{maxPrompt}}", description: "Max allowed prompt length in tokens (context size minus response length)" }
    ]
  },
  {
    name: "Lorebook",
    description: "World info access",
    macros: [{ macro: "{{outlet::name}}", description: "World info entry content for the named outlet" }]
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
      { macro: "{{instructStop}}", description: "Instruct stop sequence" }
    ]
  },
  {
    name: "Conditionals & structure",
    description: "Blocks, branches, comments and whitespace control",
    macros: [
      {
        macro: "{{if condition}}...{{/if}}",
        description: "Emits the body when the condition is truthy. Empty, false, 0, off and no are falsy",
        op: "flow.conditional"
      },
      { macro: "{{if !condition}}...{{/if}}", description: "Inverted condition" },
      { macro: "{{else}}", description: "Alternative branch inside an if block" },
      { macro: "{{//}}", description: "Scoped comment block, closed with a slash form; produces no output" },
      { macro: "{{#}}", description: "Whitespace-preserving flag on a scoped block opener" }
    ]
  },
  {
    name: "Card, state and runtime",
    description: "Card fields, variable existence and deletion, and runtime values",
    macros: [
      { macro: "{{charVersion}}", description: "Card version string", op: "char.version" },
      { macro: "{{charCreatorNotes}}", description: "Creator notes from the card", op: "char.creator-notes" },
      { macro: "{{charFirstMessage}}", description: "The character's greeting", op: "char.first-message" },
      { macro: "{{charPrefix}}", description: "Character-specific prefix" },
      { macro: "{{charNegativePrefix}}", description: "Character-specific negative prefix" },
      { macro: "{{charIfNotGroup}}", description: "Character name outside a group chat" },
      { macro: "{{charAuthorsNote}}", description: "The character's Author's Note" },
      { macro: "{{authorsNote}}", description: "The active Author's Note" },
      { macro: "{{defaultAuthorsNote}}", description: "The default Author's Note" },
      { macro: "{{hasvar::name}}", description: "Whether a chat-local variable exists" },
      { macro: "{{deletevar::name}}", description: "Removes a chat-local variable" },
      { macro: "{{hasglobalvar::name}}", description: "Whether a global variable exists" },
      { macro: "{{deleteglobalvar::name}}", description: "Removes a global variable" },
      { macro: "{{hasExtension::name}}", description: "Whether a named extension is installed" },
      { macro: "{{idleDuration}}", description: "Time since the last user message" },
      { macro: "{{allChatRange}}", description: "Range covering the whole chat" },
      { macro: "{{maxContextTokens}}", description: "Context size limit in tokens" },
      { macro: "{{maxResponseTokens}}", description: "Response length limit in tokens" },
      { macro: "{{chatSeparator}}", description: "Chat separator from the context template" },
      { macro: "{{instructSeparator}}", description: "Instruct separator" },
      { macro: "{{reasoningPrefix}}", description: "Reasoning block prefix", op: "format.reasoning-prefix" },
      { macro: "{{reasoningSuffix}}", description: "Reasoning block suffix", op: "format.reasoning-suffix" },
      { macro: "{{reasoningSeparator}}", description: "Reasoning block separator" },
      { macro: "{{space}}", description: "A literal space character" }
    ]
  }
];

// src/core/preset/macros/marinara.ts
var MARINARA_MACRO_GROUPS = [
  {
    name: "Identity",
    description: "Who is in the scene",
    macros: [
      { macro: "{{user}}", description: "Current user or persona name" },
      { macro: "{{persona}}", description: "Active persona description, personality, backstory, appearance and scenario, joined by newlines" },
      { macro: "{{char}}", description: "Current character name" },
      { macro: "{{characters}}", description: "All character names, comma separated" }
    ]
  },
  {
    name: "Character",
    description: "Fields off the current character card",
    macros: [
      { macro: "{{description}}", description: "Current character description" },
      { macro: "{{personality}}", description: "Current character personality" },
      { macro: "{{backstory}}", description: "Current character backstory" },
      { macro: "{{appearance}}", description: "Current character appearance" },
      { macro: "{{scenario}}", description: "Current character scenario" },
      { macro: "{{example}}", description: "Current character example dialogue" }
    ]
  },
  {
    name: "Context",
    description: "Session and runtime state",
    macros: [
      { macro: "{{input}}", description: "Most recent user message" },
      { macro: "{{model}}", description: "Current model name" },
      { macro: "{{chatId}}", description: "Current chat id" },
      { macro: "{{agent::TYPE}}", description: "Cached output for an agent or tracker type" }
    ]
  },
  {
    name: "Time",
    description: "Real-world clock and calendar",
    macros: [
      { macro: "{{date}}", description: "Current real date, YYYY-MM-DD" },
      { macro: "{{time}}", description: "Current real time, HH:MM", op: "time.now" },
      { macro: "{{datetime}}", description: "Current ISO timestamp" },
      { macro: "{{isotime}}", description: "Current ISO timestamp" },
      { macro: "{{weekday}}", description: "Current weekday name" }
    ]
  },
  {
    name: "Random",
    description: "Dice and random numbers. Single colon, and the range form is real here",
    macros: [
      { macro: "{{random}}", description: "Random number from 0 to 100", op: "random.range" },
      { macro: "{{random:X:Y}}", description: "Random number between X and Y. Single colon", example: "{{random:1:20}}", op: "random.range" },
      { macro: "{{roll:XdY}}", description: "Dice roll total. Single colon", example: "{{roll:2d6}}", op: "dice.roll" }
    ]
  },
  {
    name: "Variables",
    description: "Dynamic variables, plus the preset's own choice-block variables",
    macros: [
      { macro: "{{getvar::name}}", description: "Read a dynamic variable" },
      { macro: "{{setvar::name::value}}", description: "Set a dynamic variable" },
      { macro: "{{addvar::name::value}}", description: "Append to a dynamic variable" },
      { macro: "{{incvar::name}}", description: "Increment a numeric variable" },
      { macro: "{{decvar::name}}", description: "Decrement a numeric variable" },
      { macro: "{{NAME}}", description: "Resolve a preset variable named NAME, e.g. one set by a choice block" }
    ]
  },
  {
    name: "Formatting",
    description: "Whitespace, case, and comments. Case transforms wrap a block",
    macros: [
      { macro: "{{newline}}", description: "Insert a literal newline" },
      { macro: "{{\\n}}", description: "Insert a literal newline" },
      { macro: "{{trim}}", description: "Trim the final output. Takes no argument", op: "text.trim-surrounding" },
      { macro: "{{trimStart}}", description: "Trim whitespace at the start of the output" },
      { macro: "{{trimEnd}}", description: "Trim whitespace at the end of the output" },
      { macro: "{{uppercase}}...{{/uppercase}}", description: "Uppercase a wrapped block" },
      { macro: "{{lowercase}}...{{/lowercase}}", description: "Lowercase a wrapped block" },
      { macro: "{{noop}}", description: "No-op placeholder, removed from output" },
      { macro: "{{// comment}}", description: "Author comment, removed from output" },
      { macro: '{{banned "text"}}', description: "Accepted, but currently stripped from output", op: "gen.banned" }
    ]
  }
];

// src/core/preset/macros/lumiverse.ts
var LUMIVERSE_MACRO_GROUPS = [
  {
    name: "Structure",
    description: "Literals, comments, conditionals, and prompt plumbing",
    macros: [
      { macro: "{{space}}", description: "A literal space character" },
      { macro: "{{newline}}", aliases: ["nl", "n"], description: "A literal newline" },
      { macro: "{{noop}}", description: "Does nothing; resolves to empty text" },
      { macro: "{{trim}}", description: "Removes surrounding whitespace; as a block, trims the wrapped content", op: "text.trim-surrounding" },
      { macro: "{{comment::text}}", aliases: ["note"], description: "Authoring note; never reaches the prompt" },
      { macro: "{{// text}}", description: "Inline comment shorthand; resolves to nothing" },
      { macro: "{{input}}", description: "The raw text of the latest user message" },
      { macro: "{{outlet::name}}", description: "Content of an activated world-info outlet by name" },
      { macro: "{{wi_marker}}", description: "All activated world-info entries set to At Marker, joined by blank lines" },
      { macro: "{{banned}}", description: "Banned-tokens placeholder; resolves to nothing", op: "gen.banned" },
      { macro: "{{if::condition}}...{{/if}}", description: "Conditional block; supports {{elseif::x}} and {{else}} branches", op: "flow.conditional" },
      { macro: "{{else}}", description: "Fallback branch inside an {{if}} or {{unless}} block" },
      { macro: "{{elseif::condition}}", aliases: ["elif"], description: "Extra branch inside an {{if}} block" },
      { macro: "{{unless::condition}}...{{/unless}}", description: "Inverted conditional block; body renders when the condition is falsy" }
    ]
  },
  {
    name: "Names",
    description: "Who is in the chat",
    macros: [
      { macro: "{{user}}", description: "The user or persona display name" },
      { macro: "{{char}}", aliases: ["charName"], description: "The character's name" },
      { macro: "{{group}}", description: "Group member names, comma separated" },
      { macro: "{{groupNotMuted}}", aliases: ["group_not_muted"], description: "Group member names excluding muted members" },
      { macro: "{{notChar}}", aliases: ["not_char"], description: "The counterpart name, usually the user" },
      {
        macro: "{{charGroupFocused}}",
        aliases: ["charFocused", "char_group_focused"],
        description: "Name of the focused character in a group chat; empty outside groups"
      },
      { macro: "{{isGroupChat}}", aliases: ["is_group_chat"], description: "Whether this chat is a group chat" },
      { macro: "{{isNarrator}}", aliases: ["is_narrator"], description: "Whether the active persona is a narrator rather than a self-insert" },
      { macro: "{{groupOthers}}", aliases: ["group_others"], description: "Group member names excluding the focused character" },
      { macro: "{{groupMemberCount}}", aliases: ["group_member_count"], description: "How many characters are in the group; 0 outside groups" },
      { macro: "{{groupLastSpeaker}}", aliases: ["group_last_speaker"], description: "Last non-user character who spoke" },
      { macro: "{{groupCardMode}}", aliases: ["group_card_mode"], description: "How group cards are composed for this chat: solo, swap, or merge" }
    ]
  },
  {
    name: "Character card",
    description: "Fields from the loaded card and persona",
    macros: [
      { macro: "{{description}}", aliases: ["charDescription"], description: "Character description field" },
      { macro: "{{personality}}", aliases: ["charPersonality"], description: "Character personality field" },
      {
        macro: "{{charGroupFocusedDescription}}",
        aliases: ["charFocusedDescription", "char_group_focused_description"],
        description: "Description of the focused group character"
      },
      {
        macro: "{{charGroupFocusedPersonality}}",
        aliases: ["charFocusedPersonality", "char_group_focused_personality"],
        description: "Personality of the focused group character"
      },
      { macro: "{{scenario}}", aliases: ["charScenario"], description: "Scenario field" },
      { macro: "{{persona}}", aliases: ["userPersona"], description: "The user persona's description" },
      { macro: "{{sub}}", aliases: ["subjectivePronoun", "personaSubjectivePronoun"], description: "Persona subjective pronoun" },
      { macro: "{{obj}}", aliases: ["objectivePronoun", "personaObjectivePronoun"], description: "Persona objective pronoun" },
      { macro: "{{poss}}", aliases: ["possessivePronoun", "personaPossessivePronoun"], description: "Persona possessive pronoun" },
      { macro: "{{mesExamples}}", aliases: ["mes_examples", "exampleMessages"], description: "Example dialogue, formatted" },
      { macro: "{{mesExamplesRaw}}", description: "Example dialogue exactly as stored" },
      { macro: "{{system}}", aliases: ["charPrompt", "charSystem"], description: "The card's system prompt override" },
      {
        macro: "{{charPostHistoryInstructions}}",
        aliases: ["charInstruction", "jailbreak", "charJailbreak"],
        description: "The card's post-history instructions"
      },
      { macro: "{{charDepthPrompt}}", aliases: ["depth_prompt"], description: "The card's depth prompt extension field" },
      { macro: "{{charCreatorNotes}}", aliases: ["creatorNotes"], description: "Creator notes from the card" },
      { macro: "{{charVersion}}", description: "Card version string" },
      { macro: "{{charCreator}}", description: "Card creator name" },
      { macro: "{{firstMessage}}", aliases: ["firstMes", "first_message"], description: "The character's greeting message" },
      { macro: "{{original}}", description: "The original card description text" },
      { macro: "{{charTags}}", aliases: ["characterTags", "char_tags", "tags"], description: "The card's tags, comma separated" },
      {
        macro: "{{tag::index}}",
        aliases: ["tagAt", "tag_at", "charTagAt", "nthTag"],
        description: "Tag at a zero-based index; negatives count from the end"
      },
      { macro: "{{tagCount}}", aliases: ["tag_count", "tags_count", "numTags", "charTagCount"], description: "How many tags the card carries" },
      { macro: "{{randomTag}}", aliases: ["random_tag", "randomCharTag"], description: "One random tag from the card" },
      { macro: "{{hasTag::tag}}", aliases: ["charTag", "char_tag", "has_tag", "tagged"], description: "True when the card has that tag, case-insensitive" }
    ]
  },
  {
    name: "Chat",
    description: "Message history and swipes",
    macros: [
      { macro: "{{lastMessage}}", aliases: ["last_message"], description: "Content of the newest message" },
      { macro: "{{lastMessageId}}", aliases: ["last_message_id"], description: "Index of the newest message" },
      { macro: "{{lastUserMessage}}", aliases: ["last_user_message"], description: "Content of the newest user message" },
      { macro: "{{lastCharMessage}}", aliases: ["last_char_message", "lastBotMessage"], description: "Content of the newest character message" },
      { macro: "{{lastMessageName}}", description: "Who sent the newest message" },
      { macro: "{{messageCount}}", aliases: ["message_count", "messagecount"], description: "Total messages in the chat" },
      { macro: "{{chatId}}", aliases: ["chat_id"], description: "The current chat's identifier" },
      { macro: "{{firstIncludedMessageId}}", description: "Index of the first message that fits the prompt window" },
      { macro: "{{firstDisplayedMessageId}}", description: "Index of the first displayed message" },
      { macro: "{{lastSwipeId}}", description: "Index of the last swipe on the newest message" },
      { macro: "{{currentSwipeId}}", description: "Index of the active swipe" },
      {
        macro: "{{rejectedSwipe}}",
        aliases: ["rejectedGeneration", "regeneratedMessage"],
        description: "The message text a regenerate or swipe is replacing"
      }
    ]
  },
  {
    name: "Time",
    description: "Clock and calendar",
    macros: [
      { macro: "{{time::utcOffset}}", description: "Current time as HH:MM; the UTC offset argument is optional", op: "time.now" },
      { macro: "{{date}}", description: "Current date, written out" },
      { macro: "{{weekday}}", description: "Current day of the week" },
      { macro: "{{isotime}}", description: "Current date and time in ISO 8601 form" },
      { macro: "{{isodate}}", description: "Current date as YYYY-MM-DD" },
      { macro: "{{datetimeformat::format}}", description: "Current date and time through a custom format pattern", op: "time.format" },
      { macro: "{{idleDuration}}", aliases: ["idle_duration"], description: "Readable time elapsed since the last message" },
      { macro: "{{timeDiff::date1::date2}}", aliases: ["time_diff"], description: "Readable difference between two ISO dates" }
    ]
  },
  {
    name: "Random",
    description: "Dice and chance",
    macros: [
      {
        macro: "{{random::min::max}}",
        op: "random.range",
        description: "Two numeric args: an inclusive min/max integer range. Three or more args: picks one item from the list"
      },
      { macro: "{{pick::a::b::c}}", description: "Picks one of the listed items; stable within a single evaluation", op: "random.pick" },
      { macro: "{{roll::2d6}}", description: "Rolls dice in NdS form and returns the total", op: "dice.roll" }
    ]
  },
  {
    name: "Variables",
    description: "Local, global, and chat-persisted state",
    macros: [
      { macro: "{{getvar::key}}", description: "Read a local variable" },
      { macro: "{{setvar::key::value}}", description: "Set a local variable; outputs nothing" },
      { macro: "{{addvar::key::value}}", description: "Add a number to a local variable" },
      { macro: "{{incvar::key}}", description: "Increase a local variable by one" },
      { macro: "{{decvar::key}}", description: "Decrease a local variable by one" },
      { macro: "{{deletevar::key}}", aliases: ["flushvar"], description: "Remove a local variable" },
      {
        macro: "{{let::name::value}}...{{/let}}",
        aliases: ["withVar", "scope"],
        description: "Bind variables for the wrapped body only, restoring prior values after"
      },
      { macro: "{{getgvar::key}}", aliases: ["getglobalvar"], description: "Read a global variable" },
      { macro: "{{setgvar::key::value}}", aliases: ["setglobalvar"], description: "Set a global variable" },
      { macro: "{{addgvar::key::value}}", aliases: ["addglobalvar"], description: "Add a number to a global variable" },
      { macro: "{{incgvar::key}}", aliases: ["incglobalvar"], description: "Increase a global variable by one" },
      { macro: "{{decgvar::key}}", aliases: ["decglobalvar"], description: "Decrease a global variable by one" },
      { macro: "{{hasgvar::key}}", aliases: ["hasglobalvar", "gvarexists"], description: "True when the global variable exists" },
      {
        macro: "{{deletegvar::key}}",
        aliases: ["flushgvar", "flushglobalvar", "deleteglobalvar"],
        description: "Remove a global variable"
      },
      { macro: "{{getchatvar::key}}", description: "Read a chat-persisted variable" },
      { macro: "{{setchatvar::key::value}}", description: "Set a chat-persisted variable; survives across generations" },
      { macro: "{{addchatvar::key::value}}", description: "Add a number to a chat-persisted variable" },
      { macro: "{{incchatvar::key}}", description: "Increase a chat-persisted variable by one" },
      { macro: "{{decchatvar::key}}", description: "Decrease a chat-persisted variable by one" },
      { macro: "{{haschatvar::key}}", description: "True when the chat-persisted variable exists" },
      { macro: "{{deletechatvar::key}}", aliases: ["flushchatvar"], description: "Remove a chat-persisted variable" }
    ]
  },
  {
    name: "Prompt variables",
    description: "Variables declared on preset blocks (the walkthrough controls)",
    macros: [
      { macro: "{{var::name}}", aliases: ["promptVar", "presetVar"], description: "Read a preset prompt variable's runtime value" },
      {
        macro: "{{varDefault::name}}",
        aliases: ["promptVarDefault", "presetVarDefault"],
        description: "Read a prompt variable's creator-set default, ignoring user overrides"
      },
      { macro: "{{hasVar::name}}", aliases: ["hasPromptVar", "hasPresetVar"], description: "True when the named prompt variable resolves" }
    ]
  },
  {
    name: "Runtime state",
    description: "Model, client, and current-block facts",
    macros: [
      { macro: "{{userInput}}", aliases: ["user_input"], description: "Draft text in the input bar when generation started" },
      { macro: "{{model}}", description: "The active model's name" },
      { macro: "{{isMobile}}", aliases: ["is_mobile"], description: "Whether the client is a mobile device" },
      { macro: "{{maxPrompt}}", aliases: ["maxPromptTokens", "max_prompt"], description: "Prompt token budget" },
      { macro: "{{maxContext}}", aliases: ["maxContextTokens", "max_context"], description: "Context window size in tokens" },
      { macro: "{{maxResponse}}", aliases: ["maxResponseTokens", "max_response"], description: "Response token budget" },
      { macro: "{{lastGenerationType}}", aliases: ["last_generation_type"], description: "Kind of the previous generation: normal, continue, regenerate" },
      { macro: "{{hasExtension::name}}", aliases: ["has_extension"], description: "True when the named extension is active" },
      { macro: "{{promptBlockRole}}", aliases: ["blockRole", "prompt_block_role"], description: "Role configured on the block being rendered" },
      {
        macro: "{{promptBlockPosition}}",
        aliases: ["blockPosition", "prompt_block_position"],
        description: "Position configured on the block being rendered"
      },
      { macro: "{{promptBlockDepth}}", aliases: ["blockDepth", "prompt_block_depth"], description: "Insertion depth of the block being rendered" },
      { macro: "{{userColorMode}}", aliases: ["user_color_mode", "colorMode", "color_mode"], description: "The user's color scheme: dark, light, or system" },
      { macro: "{{presetBlock::key}}", aliases: ["pblock"], description: "Content of a named preset runtime block" }
    ]
  },
  {
    name: "Reasoning",
    description: "Chain-of-thought tags",
    macros: [
      { macro: "{{reasoningPrefix::mode}}", description: "The reasoning opening tag from user settings; raw mode strips newlines", op: "format.reasoning-prefix" },
      { macro: "{{reasoningSuffix::mode}}", description: "The reasoning closing tag from user settings; raw mode strips newlines", op: "format.reasoning-suffix" }
    ]
  },
  {
    name: "Lumia",
    description: "Lumiverse's companion-persona system; these depend on Lumia packs and Council mode",
    macros: [
      { macro: "{{randomLumia::property}}", description: "A random Lumia from loaded packs; property narrows to name or trait fields" },
      { macro: "{{lumiaDef::property}}", description: "The selected Lumia's physical definition; adapts to Council and Chimera modes" },
      { macro: "{{lumiaBehavior::property}}", description: "Selected behavioral traits; len property returns the count" },
      { macro: "{{lumiaPersonality::property}}", description: "Selected personality traits; len property returns the count" },
      { macro: "{{loomStyle::property}}", description: "Selected narrative style content" },
      { macro: "{{loomUtils::property}}", description: "Selected utility prompts" },
      { macro: "{{loomRetrofits::property}}", description: "Selected retrofit prompts" },
      { macro: "{{lumiaOOC}}", description: "The out-of-character commentary prompt" },
      { macro: "{{lumiaOOCErotic}}", description: "The adult variant of the OOC prompt" },
      { macro: "{{lumiaOOCEroticBleed}}", description: "The mid-narrative adult OOC interruption prompt" },
      { macro: "{{lumiaCouncilInst}}", description: "Council mode instructions with member names; empty when Council is off" },
      { macro: "{{lumiaSelf::form}}", description: "Self-address pronouns by numbered form, singular or collective" },
      { macro: "{{lumiaCouncilModeActive}}", description: "Yes or no: is Council mode on" },
      { macro: "{{lumiaQuirks}}", aliases: ["lumiaCouncilQuirks"], description: "Formatted behavioral quirks with a mode-aware header" },
      { macro: "{{lumiaStateSynthesis}}", description: "The state synthesis prompt; wording adapts to Council mode" },
      { macro: "{{lumiaCouncilDeliberation}}", description: "Council tool results plus deliberation instructions; empty without results" },
      { macro: "{{loomCouncilResult::variable}}", description: "A named Council tool result" },
      { macro: "{{lumiaCouncilToolsActive}}", description: "Yes or no: are Council tools on" },
      { macro: "{{lumiaCouncilToolsList}}", description: "Configured Council tools with member attribution" },
      { macro: "{{lumiaMessageCount}}", description: "The chat's message count" },
      { macro: "{{lumiaOOCTrigger}}", description: "OOC countdown or activation text driven by message count" }
    ]
  },
  {
    name: "Loom",
    description: "Summary and co-pilot prompts",
    macros: [
      { macro: "{{loomSummary}}", description: "The stored chat summary" },
      { macro: "{{loomSummaryPrompt}}", description: "The summarization directive prompt" },
      { macro: "{{loomLastUserMessage}}", description: "The newest user message" },
      { macro: "{{loomSovHandActive}}", description: "Yes or no: is Sovereign Hand mode on" },
      { macro: "{{loomLastMessageName}}", description: "Who sent the newest message" },
      { macro: "{{loomLastCharMessage}}", description: "The newest character message" },
      { macro: "{{loomContinuePrompt}}", description: "Continuation instructions when Sovereign Hand is on and the character spoke last" },
      { macro: "{{loomSovHand}}", description: "The full Sovereign Hand co-pilot prompt" }
    ]
  },
  {
    name: "Memory",
    description: "Long-term memory, the Memory Cortex, and the databank",
    macros: [
      { macro: "{{memories::count}}", aliases: ["longTermMemory", "chatMemory", "ltm"], description: "Retrieved memory chunks with the header template", op: "chat.memories" },
      { macro: "{{memoriesActive}}", description: "Yes or no: were memory chunks retrieved" },
      { macro: "{{memoriesCount}}", description: "How many memory chunks were retrieved" },
      { macro: "{{memoriesRaw::count}}", description: "Memory chunks joined plainly, without the header" },
      { macro: "{{entities::count}}", description: "Active entity snapshots with facts and relationships" },
      { macro: "{{entityFacts::name}}", description: "Key facts about a named entity" },
      { macro: "{{relationships}}", description: "Relationship edges between entities in the current scene" },
      { macro: "{{arc}}", description: "The current narrative arc summary" },
      { macro: "{{memorySalience}}", description: "The most narratively important memory in the retrieval set" },
      { macro: "{{cortexActive}}", description: "Yes or no: did the Memory Cortex produce results" },
      { macro: "{{entityCount}}", description: "How many entities are active in context" },
      { macro: "{{characterColors}}", description: "Per-character font color attributions from the Cortex" },
      { macro: "{{databank::count}}", aliases: ["databankMemory", "documents", "knowledgeBank"], description: "Retrieved databank chunks with the header template" },
      { macro: "{{databankActive}}", description: "Yes or no: were databank chunks retrieved" },
      { macro: "{{databankCount}}", description: "How many databank chunks were retrieved" },
      { macro: "{{databankRaw::count}}", description: "Databank chunks joined plainly, without the header" }
    ]
  },
  {
    name: "Strings",
    description: "Text transforms",
    macros: [
      { macro: "{{len::text}}", aliases: ["length"], description: "Character count of the text" },
      { macro: "{{upper::text}}", aliases: ["uppercase", "toUpper"], description: "Uppercase the text" },
      { macro: "{{lower::text}}", aliases: ["lowercase", "toLower"], description: "Lowercase the text" },
      { macro: "{{capitalize::text}}", aliases: ["titlecase"], description: "Capitalize the first letter of each sentence" },
      { macro: "{{replace::find::with::text}}", description: "Substring replacement; also works as a block around the text" },
      { macro: "{{substr::text::start::end}}", aliases: ["substring"], description: "Slice by start and optional end index" },
      { macro: "{{split::text::delimiter::index}}", description: "Split on a delimiter and return the item at a zero-based index" },
      { macro: "{{join::separator::items}}", description: "Join the listed values with a separator", op: "text.join" },
      { macro: "{{repeat::count::text}}", description: "Repeat text a number of times; also works as a block" },
      { macro: "{{wrap::prefix::suffix::text}}", description: "Wrap non-empty text with a prefix and suffix" },
      { macro: "{{regex::pattern::replacement::text}}", description: "Regex replacement over the text; also works as a block" },
      { macro: "{{tokenCount::text}}", aliases: ["token_count", "tokens"], description: "Approximate token count of the text", op: "text.tokencount-argument" },
      { macro: "{{truncate::text::maxTokens}}", description: "Trim text to about that many tokens on word boundaries" },
      { macro: "{{reverse::text}}", description: "Reverse a string's characters", op: "text.reverse" }
    ]
  },
  {
    name: "Math",
    description: "Arithmetic",
    macros: [
      { macro: "{{calc::expression}}", aliases: ["math", "evaluate"], description: "Evaluate basic arithmetic with parentheses" },
      { macro: "{{min::a::b}}", description: "Smallest of the listed numbers" },
      { macro: "{{max::a::b}}", description: "Largest of the listed numbers" },
      { macro: "{{clamp::value::min::max}}", description: "Bound a value between min and max" },
      { macro: "{{abs::value}}", description: "Absolute value" },
      { macro: "{{floor::value}}", description: "Round down to a whole number" },
      { macro: "{{ceil::value}}", description: "Round up to a whole number" },
      { macro: "{{mod::a::b}}", description: "Remainder of dividing a by b" },
      { macro: "{{round::value::decimals}}", description: "Round to a number of decimal places, default zero" }
    ]
  },
  {
    name: "Logic",
    description: "Conditions and comparisons; true results pair with {{if}} blocks",
    macros: [
      { macro: "{{switch::value::case1::result1::default}}", description: "Multi-branch match on a value; last unpaired arg is the fallback" },
      { macro: "{{case}}", description: "Case marker inside a block-form {{switch}}" },
      { macro: "{{default::value::fallback}}", aliases: ["fallback", "coalesce"], description: "First truthy value, else the fallback" },
      { macro: "{{and::a::b}}", description: "True when every argument is truthy" },
      { macro: "{{or::a::b}}", description: "True when any argument is truthy" },
      { macro: "{{not::value}}", description: "True when the value is falsy" },
      { macro: "{{empty::value}}", aliases: ["isEmpty"], description: "True when the value is exactly empty" },
      { macro: "{{blank::value}}", aliases: ["isBlank"], description: "True when the value is empty or only whitespace" },
      { macro: "{{number::value}}", aliases: ["isNumber", "numeric"], description: "True when the value is a finite number" },
      { macro: "{{integer::value}}", aliases: ["isInteger", "int"], description: "True when the value is a whole number" },
      { macro: "{{matches::text::pattern::flags}}", description: "True when the text matches a regular expression" },
      { macro: "{{startsWith::text::prefix}}", aliases: ["starts_with"], description: "True when the text starts with the prefix" },
      { macro: "{{endsWith::text::suffix}}", aliases: ["ends_with"], description: "True when the text ends with the suffix" },
      { macro: "{{eq::a::b}}", description: "True when a equals b, numeric-aware" },
      { macro: "{{ne::a::b}}", description: "True when a differs from b" },
      { macro: "{{gt::a::b}}", description: "True when a is greater than b" },
      { macro: "{{lt::a::b}}", description: "True when a is less than b" },
      { macro: "{{gte::a::b}}", description: "True when a is at least b" },
      { macro: "{{lte::a::b}}", description: "True when a is at most b" }
    ]
  },
  {
    name: "Formatting",
    description: "List rendering",
    macros: [
      { macro: "{{bullets::a::b}}", description: "Render items as a bulleted list; as a block, splits the body on newlines" },
      { macro: "{{numbered::a::b}}", aliases: ["ol", "enumerate"], description: "Render items as a numbered list; as a block, splits the body on newlines" }
    ]
  },
  {
    name: "Chat utilities",
    description: "History lookups and counters",
    macros: [
      { macro: "{{messageAt::index}}", aliases: ["message_at", "msgAt"], description: "Message content at an index; negatives count from the end" },
      { macro: "{{messagesBy::name::count}}", aliases: ["messages_by", "msgBy"], description: "The last N messages from one speaker, newest first" },
      { macro: "{{chatAge}}", aliases: ["chat_age"], description: "Readable time since the chat was created" },
      { macro: "{{counter::name}}", description: "Increment a named counter variable and return the new value" },
      { macro: "{{toggle::name}}", description: "Flip a named boolean variable and return the new value" },
      { macro: "{{rcounter::name::reset}}", description: "Increment a render-scoped counter that resets each generation" }
    ]
  },
  {
    name: "Regex",
    description: "Regex script hooks",
    macros: [
      {
        macro: "{{regexInstalled::scriptId::text}}",
        aliases: ["regex_installed", "hasRegex", "has_regex"],
        description: "Without text: true when the script is installed. With text: applies the script to it"
      }
    ]
  },
  {
    name: "Multiplayer",
    description: "Room state; empty or zero outside multiplayer",
    macros: [
      { macro: "{{isMultiplayer}}", aliases: ["is_multiplayer", "isMultiplayerRoom", "is_multiplayer_room"], description: "Yes or no: is this a multiplayer room" },
      { macro: "{{playerCount}}", aliases: ["player_count", "playersCount", "players_count"], description: "Active players in the room, host included" },
      { macro: "{{players}}", aliases: ["player_names", "playerNames"], description: "All active player names, host first" },
      { macro: "{{hostName}}", aliases: ["host_name"], description: "The room host's display name" },
      {
        macro: "{{currentPlayer}}",
        aliases: ["current_player", "currentTurn", "current_turn"],
        description: "Whose turn it is in round-robin rooms"
      }
    ]
  },
  {
    name: "Iteration",
    description: "Loops over lists, history, and variables; bodies bind dot-locals like {{.item}}",
    macros: [
      { macro: "{{foreach::a,b,c}}...{{/foreach}}", aliases: ["each", "for_each"], description: "Run the body once per list item" },
      { macro: "{{map::a,b,c::x}}...{{/map}}", aliases: ["collect"], description: "Transform each item through the body and return the list" },
      { macro: "{{filter::a,b,c}}...{{/filter}}", aliases: ["where"], description: "Keep items whose body condition is truthy" },
      { macro: "{{some::a,b,c}}...{{/some}}", aliases: ["any"], description: "True when any item's body condition is truthy; short-circuits" },
      { macro: "{{every::a,b,c}}...{{/every}}", aliases: ["all"], description: "True when every item's body condition is truthy; true for empty lists" },
      { macro: "{{foreachMessage}}...{{/foreachMessage}}", aliases: ["for_each_message"], description: "Run the body once per chat message, optionally only the last N" },
      { macro: "{{foreachVar::prefix}}...{{/foreachVar}}", aliases: ["for_each_var"], description: "Loop local variables whose names start with the prefix" },
      {
        macro: "{{foreachChatVar::prefix}}...{{/foreachChatVar}}",
        aliases: ["for_each_chat_var"],
        description: "Loop chat-persisted variables whose names start with the prefix"
      },
      {
        macro: "{{foreachGlobalVar::prefix}}...{{/foreachGlobalVar}}",
        aliases: ["foreachGvar", "for_each_global_var"],
        description: "Loop global variables whose names start with the prefix"
      },
      { macro: "{{range::start::end::step}}", description: "A numeric sequence as a comma-separated list" }
    ]
  },
  {
    name: "Lists",
    description: "Comma-separated list operations",
    macros: [
      { macro: "{{count::list}}", aliases: ["listLength", "list_count"], description: "How many items the list holds, blanks ignored" },
      { macro: "{{includes::list::item}}", aliases: ["contains", "inList"], description: "True when the list contains the whole item, case-sensitive" },
      { macro: "{{nth::list::index}}", aliases: ["at"], description: "Item at a zero-based index; negatives count from the end" },
      { macro: "{{first::list}}", description: "The first item" },
      { macro: "{{last::list}}", description: "The last item" },
      { macro: "{{slice::list::start::end}}", description: "Sublist between start and optional exclusive end; negatives count from the end" },
      { macro: "{{take::list::n}}", description: "The first N items; a negative N takes from the end" },
      { macro: "{{sort::list::direction}}", description: "Sort numerically when all items are numbers, else alphabetically; desc reverses" },
      { macro: "{{unique::list}}", aliases: ["dedupe", "distinct"], description: "Drop duplicate items, keeping first occurrences" },
      { macro: "{{reverseList::list}}", aliases: ["reverse_list"], description: "Reverse the item order" },
      { macro: "{{shuffle::list}}", description: "Randomly reorder the items", op: "random.shuffle" },
      { macro: "{{sum::list}}", description: "Sum of the numeric items, zero when empty" },
      { macro: "{{avg::list}}", aliases: ["mean", "average"], description: "Mean of the numeric items" },
      { macro: "{{listMax::list}}", aliases: ["list_max"], description: "Largest numeric item" },
      { macro: "{{listMin::list}}", aliases: ["list_min"], description: "Smallest numeric item" }
    ]
  }
];

// src/core/preset/macros/risu.ts
var RISU_MACRO_GROUPS = [
  {
    name: "All CBS macros",
    description: "Every macro RisuAI documents, as its own CBS reference lists them. Risu writes examples as " + "[[name]] so its documentation is not itself parsed; the engine reads {{name}}.",
    macros: [
      { macro: "{{previous_char_chat}}", description: "Returns the previous character message", aliases: ["previouscharchat", "lastcharmessage"] },
      { macro: "{{previous_user_chat}}", description: "Returns the previous user message", aliases: ["previoususerchat", "lastusermessage"] },
      { macro: "{{char}}", description: "Returns the character's name or nickname", aliases: ["bot"] },
      { macro: "{{user}}", description: "Returns the user's name" },
      { macro: "{{personality}}", description: "Returns the character's personality", aliases: ["char_persona", "charpersona"] },
      { macro: "{{description}}", description: "Returns the character's description", aliases: ["char_desc", "chardesc"] },
      { macro: "{{scenario}}", description: "Returns the character's scenario" },
      { macro: "{{example_dialogue}}", description: "Returns the character's example dialogue", aliases: ["example_message", "exampledialogue", "examplemessage"] },
      { macro: "{{persona}}", description: "Returns the user's persona", aliases: ["user_persona", "userpersona"] },
      { macro: "{{main_prompt}}", description: "Returns the main/system prompt", aliases: ["system_prompt", "systemprompt", "mainprompt"] },
      { macro: "{{lorebook}}", description: "Returns the lorebook/world info", aliases: ["world_info", "worldinfo"] },
      { macro: "{{history}}", description: "Returns the full chat history", aliases: ["messages"] },
      { macro: "{{user_history}}", description: "Returns the user's message history", aliases: ["user_messages", "userhistory", "usermessages"] },
      { macro: "{{char_history}}", description: "Returns the character's message history", aliases: ["char_messages", "charhistory", "charmessages"] },
      { macro: "{{ujb}}", description: "Returns the global/system note", aliases: ["global_note", "system_note", "globalnote", "systemnote"] },
      { macro: "{{chat_index}}", description: "Returns the current chat index", aliases: ["chatindex"] },
      { macro: "{{first_msg_index}}", description: "Returns the first message index", aliases: ["firstmessageindex", "firstmsgindex"] },
      { macro: "{{blank}}", description: "Returns an empty string", aliases: ["none"] },
      { macro: "{{message_time}}", description: "Returns the time of the message", aliases: ["messagetime"] },
      { macro: "{{message_date}}", description: "Returns the date of the message", aliases: ["messagedate"] },
      { macro: "{{message_unixtime_array}}", description: "Returns an array of message unix times", aliases: ["messageunixtimearray"] },
      { macro: "{{unixtime}}", description: "Returns the current unix time" },
      { macro: "{{time}}", description: "Returns the current time" },
      { macro: "{{date}}", description: "Returns the current date" },
      { macro: "{{isotime}}", description: "Returns the current UTC time" },
      { macro: "{{isodate}}", description: "Returns the current UTC date" },
      { macro: "{{message_idle_duration}}", description: "Returns idle duration between last two user messages", aliases: ["messageidleduration"] },
      { macro: "{{idle_duration}}", description: "Returns idle duration since last message", aliases: ["idleduration"] },
      { macro: "{{br}}", description: "Returns a newline character", aliases: ["newline"] },
      { macro: "{{model}}", description: "Returns the current AI model" },
      { macro: "{{axmodel}}", description: "Returns the submodel" },
      { macro: "{{role}}", description: "Returns the message role" },
      { macro: "{{isfirstmsg}}", description: "Returns 1 if first message, else 0", aliases: ["is_first_msg", "is_first_message", "isfirstmessage"] },
      { macro: "{{random}}", description: "Returns a random number" },
      { macro: "{{maxcontext}}", description: "Returns the max context value" },
      { macro: "{{lastmessage}}", description: "Returns the last message data" },
      { macro: "{{lastmessageid}}", description: "Returns the last message index", aliases: ["lastmessageindex"] },
      { macro: "{{emotionlist}}", description: "Returns the list of emotion names" },
      { macro: "{{assetlist}}", description: "Returns the list of asset names" },
      { macro: "{{prefill_supported}}", description: "Returns 1 if prefill is supported", aliases: ["prefillsupported", "prefill"] },
      { macro: "{{screen_width}}", description: "Returns the screen width", aliases: ["screenwidth"] },
      { macro: "{{screen_height}}", description: "Returns the screen height", aliases: ["screenheight"] },
      { macro: "{{cbr}}", description: "Returns a literal newline string", aliases: ["cnl", "cnewline"] },
      { macro: "{{decbo}}", description: "Returns a special open curly bracket character", aliases: ["displayescapedcurlybracketopen"] },
      { macro: "{{decbc}}", description: "Returns a special close curly bracket character", aliases: ["displayescapedcurlybracketclose"] },
      { macro: "{{bo}}", description: "Returns double open curly bracket character", aliases: ["ddecbo", "doubledisplayescapedcurlybracketopen"] },
      { macro: "{{bc}}", description: "Returns double close curly bracket character", aliases: ["ddecbc", "doubledisplayescapedcurlybracketclose"] },
      { macro: "{{tempvar::name}}", description: "Get a temporary variable", aliases: ["gettempvar"] },
      { macro: "{{settempvar::name::value}}", description: "Set a temporary variable" },
      { macro: "{{return::value}}", description: "Set a return value and force return" },
      { macro: "{{getvar::name}}", description: "Get a chat variable" },
      { macro: "{{calc::expression}}", description: "Calculate a string expression" },
      { macro: "{{addvar::name::value}}", description: "Add a value to a chat variable" },
      { macro: "{{setvar::name::value}}", description: "Set a chat variable" },
      { macro: "{{setdefaultvar::name::value}}", description: "Set a default value if variable is not set" },
      { macro: "{{getglobalvar::name}}", description: "Get a global chat variable" },
      { macro: "{{button::label::action}}", description: "Create a button" },
      { macro: "{{risu::size}}", description: "Insert a Risu logo image" },
      { macro: "{{equal::a::b}}", description: "Check if two values are equal" },
      { macro: "{{not_equal::a::b}}", description: "Check if two values are not equal", aliases: ["notequal"] },
      { macro: "{{greater::a::b}}", description: "Check if a > b" },
      { macro: "{{less::a::b}}", description: "Check if a < b" },
      { macro: "{{greater_equal::a::b}}", description: "Check if a >= b", aliases: ["greaterequal"] },
      { macro: "{{less_equal::a::b}}", description: "Check if a <= b", aliases: ["lessequal"] },
      { macro: "{{and::a::b}}", description: "Logical AND of two values" },
      { macro: "{{or::a::b}}", description: "Logical OR of two values" },
      { macro: "{{not::a}}", description: "Logical NOT of a value" },
      { macro: "{{file::name::base64data}}", description: "Display file or decode base64" },
      { macro: "{{startswith::string::prefix}}", description: "Check if a string starts with another" },
      { macro: "{{endswith::string::suffix}}", description: "Check if a string ends with another" },
      { macro: "{{contains::string::substring}}", description: "Check if a string contains another" },
      { macro: "{{replace::string::target::replacement}}", description: "Replace all occurrences in a string" },
      { macro: "{{split::string::delimiter}}", description: "Split a string into an array" },
      { macro: "{{join::array::delimiter}}", description: "Join an array into a string" },
      { macro: "{{spread::array}}", description: "Spread an array with :: separator" },
      { macro: "{{trim::string}}", description: "Trim whitespace from a string" },
      { macro: "{{length::string}}", description: "Get length of a string" },
      { macro: "{{arraylength::array}}", description: "Get length of an array", aliases: ["array_length"] },
      { macro: "{{lower::string}}", description: "Convert string to lowercase" },
      { macro: "{{upper::string}}", description: "Convert string to uppercase" },
      { macro: "{{capitalize::string}}", description: "Capitalize first letter" },
      { macro: "{{round::number}}", description: "Round a number" },
      { macro: "{{floor::number}}", description: "Floor a number" },
      { macro: "{{ceil::number}}", description: "Ceil a number" },
      { macro: "{{abs::number}}", description: "Absolute value" },
      { macro: "{{remaind::a::b}}", description: "Modulo operation" },
      { macro: "{{previous_chat_log::index}}", description: "Get previous chat log by index" },
      { macro: "{{tonumber::string}}", description: "Extract numbers from string" },
      { macro: "{{pow::base::exponent}}", description: "Power operation" },
      { macro: "{{arrayelement::array::index}}", description: "Get array element by index", aliases: ["array_element"] },
      { macro: "{{dictelement::dict::key}}", description: "Get dictionary/object element by key", aliases: ["dict_element", "objectelement", "object_element"] },
      { macro: "{{object_assert::dict::key::value}}", description: "Assert key in object", aliases: ["dict_assert", "dictassert", "objectassert"] },
      { macro: "{{element::json::key1::key2::...}}", description: "Get nested element from JSON", aliases: ["ele"] },
      { macro: "{{arrayshift::array}}", description: "Remove first element from array", aliases: ["array_shift"] },
      { macro: "{{arraypop::array}}", description: "Remove last element from array", aliases: ["array_pop"] },
      { macro: "{{arraypush::array::value}}", description: "Push value to array", aliases: ["array_push"] },
      { macro: "{{arraysplice::array::start::deleteCount::item}}", description: "Splice array", aliases: ["array_splice"] },
      { macro: "{{arrayassert::array::index::value}}", description: "Assert index in array", aliases: ["array_assert"] },
      { macro: "{{makearray::item1::item2::...}}", description: "Create array from arguments", aliases: ["array", "a", "make_array"] },
      { macro: "{{makedict::key1=value1::key2=value2::...}}", description: "Create dictionary/object from key=value pairs", aliases: ["dict", "d", "make_dict", "makeobject", "object", "o", "make_object"] },
      { macro: "{{range::start::end::step}}", description: "Create a range array" },
      { macro: "{{date::format::timestamp}}", description: "Format date/time", aliases: ["time", "datetimeformat"] },
      { macro: "{{module_enabled::namespace}}", description: "Check if module is enabled", aliases: ["moduleenabled"] },
      { macro: "{{module_assetlist::namespace}}", description: "Get asset list from module", aliases: ["moduleassetlist"] },
      { macro: "{{filter::array::type}}", description: `Filter array. Type can be:
- unique: Remove duplicates
- nonempty: Remove empty values
- all: do unique and nonempty` },
      { macro: "{{all::array::...}}", description: "Check if all values are 1" },
      { macro: "{{any::array::...}}", description: "Check if any value is 1" },
      { macro: "{{min::array::...}}", description: "Get minimum value" },
      { macro: "{{max::array::...}}", description: "Get maximum value" },
      { macro: "{{sum::array::...}}", description: "Sum values" },
      { macro: "{{average::array::...}}", description: "Average values" },
      { macro: "{{fixnum::number::decimals}}", description: "Fix number to decimals", aliases: ["fix_num", "fixnumber", "fix_number"] },
      { macro: "{{unicode_encode::string::index}}", description: "Get unicode code of char", aliases: ["unicodeencode"] },
      { macro: "{{unicode_decode::code}}", description: "Decode unicode code to char", aliases: ["unicodedecode"] },
      { macro: "{{u::hex}}", description: "Decode unicode from hex", aliases: ["unicodedecodefromhex"] },
      { macro: "{{ue::hex}}", description: "Encode unicode from hex", aliases: ["unicodeencodefromhex"] },
      { macro: "{{hash::string}}", description: "Hash a string" },
      { macro: "{{randint::min::max}}", description: "Random integer in range" },
      { macro: "{{dice::NdM}}", description: "Roll dice in NdM notation" },
      { macro: "{{fromhex::hex}}", description: "Convert hex to decimal" },
      { macro: "{{tohex::number}}", description: "Convert decimal to hex" },
      { macro: "{{metadata::key}}", description: `Get metadata value. argument can be:
- mobile (is mobile)
- local (is local)
- node (is node)
- version (version of Risuai)
- major (Major version of risuai)
- lang (current language code)
- browserlang (same as navigator.language in js)
- modelshortname (returns current model's short name)
- modelname (returns current model's name)
- modelformat (returns current model's format)
- modelprovider (returns current model's provider)
- modeltokenizer (returns current model's tokenizer)
- risutype (returns current risuai type like node web and etc.)
- maxcontext (returns current max context)` },
      { macro: "{{iserror::string}}", description: "Check if string is error" },
      { macro: "{{asset::name}}", description: "Returns a asset image named first argument" },
      { macro: "{{emotion::name}}", description: "Returns a emotion image named first argument" },
      { macro: "{{audio::name}}", description: "Returns a audio named first argument" },
      { macro: "{{bg::name}}", description: "Returns a image with width and height as 100% named first argument. mostly used with background embedding feature in character" },
      { macro: "{{video::name}}", description: "Returns a video named first argument" },
      { macro: "{{video-img::name}}", description: "Return a video that is styled like a image named first argument" },
      { macro: "{{path::name}}", description: "Returns a string which is a path to the file named first argument", aliases: ["raw"] },
      { macro: "{{image::name}}", description: "Returns a image named first argument" },
      { macro: "{{img::name}}", description: "Returns a image named first argument but without styling" },
      { macro: "{{bgm::name}}", description: "Returns a audio which is hidden named first argument" },
      { macro: "{{inlay::name}}", description: "Returns a image from inlay data named first argument" },
      { macro: "{{inlayed::name}}", description: "Returns a image from inlay data named first argument but with styling" },
      { macro: "{{inlayeddata::name}}", description: "Returns a image from inlay data named first argument but with styling and data. unlike inlayed it is also sent to the AI when character sent with this function" },
      { macro: "{{?}}", description: "Do math operations doesn't follow the usual syntax of arguments supports + - * / ^ % < > <= >= || && == != !" },
      { macro: "{{random::arg1::arg2::arg3::...}}", description: "Returns a random selection of arguments" },
      { macro: "{{pick::arg1::arg2::arg3::...}}", description: "same as random but seed is fixed by message index resulting consistent output" },
      { macro: "{{roll::number}}", description: "Returns a random integer from 1 to first argument" },
      { macro: "{{rollp::number}}", description: "same as roll but seed is fixed by message index resulting consistent output" },
      { macro: "{{slot::name}}", description: "returns the current element being iterated over, identified by named first argument" }
    ]
  }
];

// src/core/preset/macros/sillytavern-new.ts
var SILLYTAVERN_NEW_MACRO_GROUPS = [
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
      { macro: "{{outlet::character-achievements}}", description: "Returns the world info outlet prompt for a given outlet key." }
    ]
  },
  {
    name: "Runtime & Stats",
    description: "SillyTavern's runtime & stats macros.",
    macros: [
      { macro: "{{maxPrompt}}", description: "Maximum prompt context size.", aliases: ["maxPromptTokens"] },
      { macro: "{{maxContext}}", description: "Maximum context token limit.", aliases: ["maxContextTokens"] },
      { macro: "{{maxResponse}}", description: "Maximum response token limit.", aliases: ["maxResponseTokens"] },
      { macro: "{{model}}", description: "Model name for the currently selected API (Chat Completion or Chat Completion)." },
      { macro: "{{isMobile}}", description: '"true" if currently running in a mobile environment, "false" otherwise.' },
      { macro: "{{lastGenerationType}}", description: 'Type of the last queued generation request (e.g. "normal", "impersonate", "regenerate", "quiet", "swipe", "continue"). Empty if none yet or chat was switched.' },
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
      { macro: "{{chatStart}}", description: "Chat start marker used in text completion prompts." }
    ]
  },
  {
    name: "Random & Dice",
    description: "SillyTavern's random & dice macros.",
    macros: [
      { macro: "{{roll::1d20}}", description: "Rolls dice using droll syntax (e.g. {{roll 1d20}}).", op: "dice.roll" },
      { macro: "{{random::blonde::brown::red::black::blue}}", description: "Picks a random item from a list. Will be re-rolled every time macros are resolved.", op: "random.pick" },
      { macro: "{{pick::blonde::brown::red::black::blue}}", description: "Picks a random item from a list, but keeps the choice stable for a given chat and macro position. Can be rerolled via /reroll-pick slash command.", op: "random.pick-sticky" }
    ]
  },
  {
    name: "Identity",
    description: "SillyTavern's identity macros.",
    macros: [
      { macro: "{{user}}", description: "Your current Persona username." },
      { macro: "{{char}}", description: "The character's name." },
      { macro: "{{group}}", description: "Comma-separated list of group member names (including muted) or the character name in solo chats.", aliases: ["charIfNotGroup"] },
      { macro: "{{groupNotMuted}}", description: "Comma-separated list of group member names excluding muted members." },
      { macro: "{{notChar}}", description: "Comma-separated list of all participants except the current speaker." }
    ]
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
      { macro: "{{original}}", description: "Original message content for {{original}} substitution in in character prompt overrides." }
    ]
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
      { macro: "{{allChatRange}}", description: 'Range of all message IDs in the chat (e.g. "0-10"). Empty string if the chat is empty.' },
      { macro: "{{summary}}", description: "Latest chat summary, if the Summarize extension is active" }
    ]
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
      { macro: "{{timeDiff::left::right}}", description: "Human-readable difference between two times. Order of times does not matter, it will return the absolute difference." }
    ]
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
      { macro: "{{var::name::index}}", description: "Item at an index of a scoped array or object" }
    ]
  },
  {
    name: "Registered by other modules",
    description: "Macros other parts of SillyTavern add at startup rather than the macro engine itself - the author's note, bundled extensions. Real, and invisible to a dump of the registry alone.",
    macros: [
      { macro: "{{defaultExpression}}", description: "Returns the global fallback expression." },
      { macro: "{{lastExpression}}", description: "Returns the last expression used by the selected character. The currently active character is used if no character name is provided." },
      { macro: "{{availableExpressions}}", description: "Returns a list with all the available expressions provided by the Classifier API." }
    ]
  },
  {
    name: "Formatting",
    description: "SillyTavern's formatting macros.",
    macros: [
      { macro: "{{pipe}}", description: "Result of the previous slash command. Slash-command batching only" }
    ]
  },
  {
    name: "Runtime",
    description: "SillyTavern's runtime macros.",
    macros: [
      { macro: '{{bias "text here"}}', description: "Set a behavioral bias until the next user input. Quotes required" }
    ]
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
      { macro: "{{reasoningSeparator}}", description: "Reasoning block separator" }
    ]
  }
];

// src/core/preset/macros/index.ts
var CATALOG_BY_PROFILE = {
  full: ROLECALL_MACRO_GROUPS,
  rolecall: ROLECALL_MACRO_GROUPS,
  sillytavern: SILLYTAVERN_MACRO_GROUPS,
  marinara: MARINARA_MACRO_GROUPS,
  lumiverse: LUMIVERSE_MACRO_GROUPS
};
function macroGroupsForProfile(profile) {
  return CATALOG_BY_PROFILE[profile] ?? ROLECALL_MACRO_GROUPS;
}
var MACRO_DIALECTS = [
  "rolecall",
  "sillytavern",
  "sillytavern-new",
  "marinara",
  "lumiverse",
  "risu"
];
var MACRO_DIALECT_LABELS = {
  full: "Hoplight",
  rolecall: "RoleCall",
  sillytavern: "SillyTavern",
  "sillytavern-new": "SillyTavern (new engine)",
  marinara: "Marinara",
  lumiverse: "Lumiverse",
  risu: "RisuAI"
};
var canTranslate = (dialect) => dialect !== "risu" && dialect !== "sillytavern-new";
function macroGroupsForDialect(dialect) {
  if (dialect === "risu")
    return RISU_MACRO_GROUPS;
  if (dialect === "sillytavern-new")
    return SILLYTAVERN_NEW_MACRO_GROUPS;
  return macroGroupsForProfile(dialect);
}

// src/ui/apps/macro-lab/bible-pane.tsx
import { useMemo, useState } from "react";

// src/core/preset/macros/ops.ts
var opFamily = (op) => op.split(".")[0] ?? op;
var innerOf = (macro) => macro.replace(/^\{\{/, "").replace(/\}\}$/, "").replace(/^[#/!?~>]/, "");
function separatorOf(macro) {
  const inner = innerOf(macro);
  if (inner.includes("::"))
    return "::";
  if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(inner))
    return ":";
  if (/^[A-Za-z_][A-Za-z0-9_]*\s+\S/.test(inner))
    return " ";
  return "none";
}
function arityOf(macro) {
  const inner = innerOf(macro);
  const separator = separatorOf(macro);
  switch (separator) {
    case "::": {
      const parts = inner.split("::");
      return /\.\.\./.test(inner) || parts.length > 3 ? null : parts.length - 1;
    }
    case ":": {
      const rest = inner.slice(inner.indexOf(":") + 1);
      return rest.includes(",") || /\.\.\./.test(rest) ? null : 1;
    }
    case " ": {
      const rest = inner.slice(inner.indexOf(" ") + 1).trim();
      return rest.length === 0 ? 0 : null;
    }
    default:
      return 0;
  }
}
function arityAccepts(formArity, count) {
  return formArity === null ? true : formArity === count;
}
function renderToken(targetMacro, args) {
  const inner = innerOf(targetMacro);
  const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(inner)?.[0] ?? inner;
  if (args.length === 0)
    return `{{${name}}}`;
  switch (separatorOf(targetMacro)) {
    case "::":
      return `{{${name}::${args.join("::")}}}`;
    case ":":
      return `{{${name}:${args.join(",")}}}`;
    case " ":
      return `{{${name} ${args.join(" ")}}}`;
    default:
      return `{{${name}}}`;
  }
}

// src/core/preset/capabilities.ts
var PRESET_WRITE_FOR_PROFILES = [
  "full",
  "rolecall",
  "sillytavern",
  "marinara",
  "lumiverse"
];

// src/core/preset/macros/support.ts
function scanMacroTree(text, depth = 0) {
  const found = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1)
      break;
    const close = matchingClose(text, open);
    if (close === -1)
      break;
    found.push({ token: text.slice(open, close + 2), depth });
    found.push(...scanMacroTree(text.slice(open + 2, close), depth + 1));
    index = close + 2;
  }
  return found;
}
function matchingClose(text, open) {
  let depth = 0;
  for (let i = open;i < text.length - 1; i += 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (text[i] === "}" && text[i + 1] === "}") {
      depth -= 1;
      if (depth === 0)
        return i;
      i += 1;
    }
  }
  return -1;
}
function macroName(token) {
  const inner = token.replace(/^\{\{/, "").replace(/\}\}$/, "").trim().replace(/^\//, "");
  return (/^[A-Za-z_][A-Za-z0-9_]*/.exec(inner)?.[0] ?? "").toLowerCase();
}
var namesCache = new Map;
function supportedMacroNames(profile) {
  const hit = namesCache.get(profile);
  if (hit)
    return hit;
  const names = new Set(macroGroupsForDialect(profile).flatMap((g) => g.macros).flatMap((m) => [macroName(m.macro), ...(m.aliases ?? []).map((a) => a.toLowerCase())]).filter(Boolean));
  namesCache.set(profile, names);
  return names;
}
function findMacro(profile, token) {
  const name = macroName(token);
  if (!name)
    return null;
  for (const g of macroGroupsForDialect(profile)) {
    for (const m of g.macros) {
      if (macroName(m.macro) === name)
        return m;
      if (m.aliases?.some((a) => a.toLowerCase() === name))
        return m;
    }
  }
  return null;
}

// src/core/preset/macros/equivalence.ts
function entriesOf(engine) {
  return macroGroupsForProfile(engine).flatMap((group) => group.macros);
}
function answersTo(entry, name) {
  if (macroName(entry.macro) === name)
    return true;
  return (entry.aliases ?? []).some((alias) => alias.toLowerCase() === name);
}
function resolveEntry(engine, name, argCount) {
  const matches = entriesOf(engine).filter((entry) => answersTo(entry, name));
  if (matches.length === 0)
    return null;
  return matches.find((entry) => arityAccepts(arityOf(entry.macro), argCount)) ?? matches.find((entry) => arityOf(entry.macro) === null) ?? matches[0] ?? null;
}
function formsForOp(op) {
  const forms = [];
  for (const engine of PRESET_WRITE_FOR_PROFILES) {
    for (const entry of entriesOf(engine)) {
      if (entry.op === op)
        forms.push({ engine, entry });
    }
  }
  return forms;
}
function familyCandidates(engine, op) {
  const family = opFamily(op);
  return entriesOf(engine).filter((entry) => entry.op && opFamily(entry.op) === family).map((entry) => entry.macro);
}
function equivalentOf(from, to, name, args) {
  const source = resolveEntry(from, name, args.length);
  const sameName = resolveEntry(to, name, args.length);
  if (!source?.op) {
    if (sameName && !sameName.op) {
      return {
        verdict: "portable",
        source,
        target: sameName,
        rewritten: null,
        candidates: [],
        why: `Both engines have {{${name}}} and neither declares a different meaning for it.`
      };
    }
    if (sameName?.op) {
      return {
        verdict: "collision",
        source,
        target: sameName,
        rewritten: null,
        candidates: familyCandidates(to, sameName.op),
        why: `${to} defines {{${name}}} as ${sameName.op}, and ${from} does not declare a matching ` + "meaning, so it cannot be assumed to behave the same way."
      };
    }
    return {
      verdict: "absent",
      source,
      target: null,
      rewritten: null,
      candidates: [],
      why: `${to} has no macro named "${name}".`
    };
  }
  const target = entriesOf(to).find((entry) => entry.op === source.op) ?? null;
  if (target) {
    return {
      verdict: "portable",
      source,
      target,
      rewritten: renderToken(target.macro, args),
      candidates: [],
      why: `Both engines perform ${source.op}; ${to} spells it ${target.macro}.`
    };
  }
  const candidates = familyCandidates(to, source.op);
  if (sameName) {
    return {
      verdict: "collision",
      source,
      target: sameName,
      rewritten: null,
      candidates,
      why: `${from} uses {{${name}}} for ${source.op}, but ${to} has no macro for that operation and ` + `its own {{${name}}} does something else. Leaving it unchanged would silently alter the prompt.`
    };
  }
  return {
    verdict: "absent",
    source,
    target: null,
    rewritten: null,
    candidates,
    why: `${to} has no macro for ${source.op}.`
  };
}

// src/core/preset/macros/translate.ts
var COLLISION_NOTE = "left unchanged and flagged; it must be reviewed before use";
function lowerIndexedAccess(token) {
  const name = macroName(token);
  if (name !== "getvarkey" && name !== "setvarkey")
    return null;
  const args = splitArgs(token.slice(2, -2)).slice(1).map((a) => a.trim());
  const [array, index, ...rest] = args;
  if (!array || index === undefined || index.length === 0)
    return null;
  const composedKey = `${array}_${index}`;
  if (name === "getvarkey")
    return `{{getvar::${composedKey}}}`;
  return `{{setvar::${composedKey}::${rest.join("::")}}}`;
}
function splitArgs(inner) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0;i < inner.length; i += 1) {
    if (inner[i] === "{" && inner[i + 1] === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (inner[i] === "}" && inner[i + 1] === "}") {
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth === 0 && inner[i] === ":" && inner[i + 1] === ":") {
      parts.push(inner.slice(start, i));
      i += 1;
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}
function conditionOf(inner) {
  return inner.replace(/^[#!?~>]/, "").replace(/^\s*(if|unless|foreach|each)\b\s*(?:::|:)?\s*/i, "").replaceAll("{{", "").replaceAll("}}", "").replaceAll("}", "").replaceAll("{", "").trim();
}
var isBlockOpener = (name, inner) => (name === "if" || name === "unless" || name === "foreach" || name === "each") && !/^\s*if::[^:]*::/.test(inner);
function flattenBlocks(text, where, changes) {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1) {
      out += text.slice(index);
      break;
    }
    const close = matchingClose(text, open);
    if (close === -1) {
      out += text.slice(index);
      break;
    }
    const token = text.slice(open, close + 2);
    const inner = token.slice(2, -2).trim();
    const bare = inner.replace(/^[#!?~>]/, "");
    const name = macroName(`{{${bare}}}`);
    out += text.slice(index, open);
    if (!isBlockOpener(name, inner)) {
      out += token;
      index = close + 2;
      continue;
    }
    const closer = findCloser(text, close + 2, name);
    if (closer === null) {
      out += token;
      index = close + 2;
      continue;
    }
    const body = text.slice(close + 2, closer.start);
    const branch = firstBranch(body);
    const condition = conditionOf(inner);
    changes.push({
      kind: "flatten",
      from: token,
      to: null,
      where,
      why: `The target engine has no ${name} block, so the block was flattened and its body kept. ` + (condition ? `The condition "${condition}" is no longer applied.` : "") + " Review whether this text should always be present."
    });
    out += condition ? `{{// was ${name}: ${condition}}}` : "";
    out += flattenBlocks(branch, where, changes);
    index = closer.end;
  }
  return out;
}
function findCloser(text, from, name) {
  let depth = 0;
  let index = typeof from === "number" ? from : 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1)
      return null;
    const close = matchingClose(text, open);
    if (close === -1)
      return null;
    const inner = text.slice(open + 2, close).trim();
    const bare = inner.replace(/^[#!?~>]/, "");
    if (bare.startsWith("/")) {
      const closing = macroName(`{{${bare.slice(1)}}}`);
      if (closing === name) {
        if (depth === 0)
          return { start: open, end: close + 2 };
        depth -= 1;
      }
    } else if (isBlockOpener(macroName(`{{${bare}}}`), inner)) {
      depth += 1;
    }
    index = close + 2;
  }
  return null;
}
function firstBranch(body) {
  let index = 0;
  while (index < body.length) {
    const open = body.indexOf("{{", index);
    if (open === -1)
      break;
    const close = matchingClose(body, open);
    if (close === -1)
      break;
    const inner = body.slice(open + 2, close).trim().replace(/^[#!?~>]/, "");
    if (/^else\b/i.test(inner))
      return body.slice(0, open);
    index = close + 2;
  }
  return body;
}
function translateTokens(text, from, to, where, changes) {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1) {
      out += text.slice(index);
      break;
    }
    const close = matchingClose(text, open);
    if (close === -1) {
      out += text.slice(index);
      break;
    }
    const token = text.slice(open, close + 2);
    out += text.slice(index, open);
    out += translateOne(token, from, to, where, changes);
    index = close + 2;
  }
  return out;
}
function settleArguments(token, from, to, where, changes) {
  const inner = token.slice(2, -2);
  if (!inner.includes("{{"))
    return token;
  const parts = splitArgs(inner);
  if (parts.length < 2)
    return token;
  const [head, ...tail] = parts;
  const settled = tail.map((argument) => translateTokens(argument, from, to, where, changes));
  return `{{${[head, ...settled].join("::")}}}`;
}
function translateOne(original, from, to, where, changes) {
  const token = settleArguments(original, from, to, where, changes);
  const lowered = lowerIndexedAccess(token);
  if (lowered) {
    const target = equivalentOf(from, to, macroName(lowered), splitArgs(lowered.slice(2, -2)).slice(1));
    if (target.verdict === "portable") {
      changes.push({
        kind: "rewrite",
        from: original,
        to: lowered,
        where,
        why: `Indexed access lowered to a plain variable whose name carries the index, since ${to} has no arrays.`
      });
      return lowered;
    }
  }
  const inner = token.slice(2, -2);
  const name = macroName(token);
  if (!name)
    return token;
  if (isStructuralBlockToken(name, inner) && targetHasConditionals(to)) {
    return `{{${translateTokens(inner, from, to, where, changes)}}}`;
  }
  const args = splitArgs(inner).slice(1);
  const match = equivalentOf(from, to, name, args);
  if (match.verdict === "portable") {
    if (!match.rewritten || match.rewritten === token)
      return token;
    changes.push({ kind: "rewrite", from: original, to: match.rewritten, where, why: match.why });
    return match.rewritten;
  }
  if (match.verdict === "collision") {
    changes.push({
      kind: "collision",
      from: original,
      to: token,
      where,
      why: `${match.why} It was ${COLLISION_NOTE}.`,
      ...match.candidates.length ? { candidates: match.candidates } : {}
    });
    return token;
  }
  changes.push({
    kind: "absent",
    from: original,
    to: null,
    where,
    why: match.candidates.length ? `${match.why} Removed; one of these may fit instead.` : `${match.why} Removed, since it would otherwise stay literal text.`,
    ...match.candidates.length ? { candidates: match.candidates } : {}
  });
  return "";
}
function translateText(text, from, to, where = "text") {
  const changes = [];
  const source = targetHasConditionals(to) ? text : flattenBlocks(text, where, changes);
  return { text: translateTokens(source, from, to, where, changes), changes };
}
function targetHasConditionals(to) {
  return formsForOp("flow.conditional").some((form) => form.engine === to);
}
function isStructuralBlockToken(name, inner) {
  if (/^\s*\//.test(inner))
    return true;
  if (name === "else")
    return true;
  return (name === "if" || name === "unless") && !/^\s*\w+::/.test(inner.trim());
}

// src/ui/apps/macro-lab/lab-core.ts
var LAB_LENSES = MACRO_DIALECTS;
var dialectTranslates = canTranslate;
function noTranslationNote(lens) {
  const annotated = macroGroupsForDialect(lens).flatMap((g) => g.macros).some((m) => m.op);
  if (annotated) {
    return "This is one of SillyTavern's two macro engines, and a preset is written for " + "SillyTavern rather than for one of them - so there is nothing to convert it into. Switch " + "to SillyTavern to see where a macro travels.";
  }
  return `Hoplight does not yet model how ${MACRO_DIALECT_LABELS[lens]}'s macros map onto the ` + "other engines, so it cannot tell you what this becomes elsewhere. Its catalog carries no " + "operation annotations, and answering from names alone is what makes a macro look portable " + "when it is not.";
}
function readMacros(text, lens) {
  const scanned = scanMacroTree(text);
  const known = supportedMacroNames(lens);
  const tokens = [];
  const unknown = [];
  for (const { token, depth } of scanned) {
    const name = macroName(token);
    if (!name) {
      tokens.push({ token, name: "", depth, verdict: "invokes-nothing" });
      continue;
    }
    const entry = findMacro(lens, token);
    if (!entry || !known.has(name)) {
      tokens.push({ token, name, depth, verdict: "unknown" });
      if (!unknown.includes(name))
        unknown.push(name);
      continue;
    }
    tokens.push({
      token,
      name,
      depth,
      verdict: "known",
      description: entry.description,
      ...entry.example ? { example: entry.example } : {},
      ...entry.macro !== token ? { documentedAs: entry.macro } : {}
    });
  }
  return { tokens, unknownNames: unknown, empty: scanned.length === 0 };
}
function travelFor(token, from) {
  if (!canTranslate(from))
    return [];
  const rows = [];
  for (const lens of LAB_LENSES) {
    if (lens === from || !canTranslate(lens))
      continue;
    const out = translateText(token, from, lens, "lab");
    const change = out.changes[0];
    if (!change) {
      rows.push({ lens, becomes: out.text, why: "the same token works there", kind: "same" });
      continue;
    }
    rows.push({ lens, becomes: change.to, why: change.why, kind: change.kind });
  }
  return rows;
}
function buildResolveAsk(engineId, text, ctx) {
  const identity = {};
  if (ctx.user.trim())
    identity.user = ctx.user.trim();
  if (ctx.char.trim())
    identity.char = ctx.char.trim();
  const state = {};
  for (const row of ctx.vars) {
    const key = row.key.trim();
    if (key)
      state[key] = row.value;
  }
  return {
    engine: engineId,
    text,
    ...Object.keys(state).length > 0 ? { state } : {},
    ...Object.keys(identity).length > 0 ? { identity } : {}
  };
}
var VERDICT_LABEL = {
  known: "in this engine's catalog",
  unknown: "no macro of this name here",
  "invokes-nothing": "invokes no macro"
};
var OPERATION_LENSES = LAB_LENSES.filter(canTranslate);
var OPERATION_ABSENT = (() => {
  const unmapped = [];
  const shared = [];
  for (const lens of LAB_LENSES) {
    if (canTranslate(lens))
      continue;
    const annotated = macroGroupsForDialect(lens).flatMap((g) => g.macros).some((m) => m.op);
    (annotated ? shared : unmapped).push(lens);
  }
  return { unmapped, shared };
})();
function operationRows() {
  const seen = new Map;
  for (const lens of OPERATION_LENSES) {
    for (const group of macroGroupsForDialect(lens)) {
      for (const entry of group.macros) {
        if (!entry.op)
          continue;
        let perLens = seen.get(entry.op);
        if (!perLens) {
          perLens = new Map;
          seen.set(entry.op, perLens);
        }
        const forms = perLens.get(lens) ?? [];
        forms.push(entry);
        perLens.set(lens, forms);
      }
    }
  }
  const rows = [];
  for (const [op, perLens] of seen) {
    const byLens = OPERATION_LENSES.map((lens) => ({ lens, forms: perLens.get(lens) ?? [] }));
    rows.push({
      op,
      family: opFamily(op),
      byLens,
      carriedBy: byLens.filter((c) => c.forms.length > 0).length
    });
  }
  return rows.sort((a, b) => a.carriedBy - b.carriedBy || a.op.localeCompare(b.op));
}
function insertToken(text, token, selectionStart, selectionEnd) {
  const clamp = (n) => Math.max(0, Math.min(text.length, Math.trunc(n) || 0));
  const lo = Math.min(clamp(selectionStart), clamp(selectionEnd));
  const hi = Math.max(clamp(selectionStart), clamp(selectionEnd));
  return {
    text: `${text.slice(0, lo)}${token}${text.slice(hi)}`,
    caret: lo + token.length
  };
}
function bibleFor(lens) {
  return macroGroupsForDialect(lens);
}
var bibleSize = (lens) => bibleFor(lens).reduce((n, group) => n + group.macros.length, 0);
function filterBible(groups, query) {
  const needle = query.trim().toLowerCase();
  if (!needle)
    return groups;
  const hit = (entry) => entry.macro.toLowerCase().includes(needle) || entry.description.toLowerCase().includes(needle) || (entry.aliases ?? []).some((a) => a.toLowerCase().includes(needle));
  return groups.map((group) => ({ ...group, macros: group.macros.filter(hit) })).filter((group) => group.macros.length > 0);
}

// src/ui/apps/macro-lab/styles.module.css
var styles_module_default = {
  room: "room_Y8XB1Q",
  head: "head_Y8XB1Q",
  eyebrow: "eyebrow_Y8XB1Q",
  title: "title_Y8XB1Q",
  lede: "lede_Y8XB1Q",
  lenses: "lenses_Y8XB1Q",
  lens: "lens_Y8XB1Q",
  lensOn: "lensOn_Y8XB1Q",
  boxes: "boxes_Y8XB1Q",
  box: "box_Y8XB1Q",
  boxHead: "boxHead_Y8XB1Q",
  boxTitle: "boxTitle_Y8XB1Q",
  boxNote: "boxNote_Y8XB1Q",
  source: "source_Y8XB1Q",
  who: "who_Y8XB1Q",
  whoLabel: "whoLabel_Y8XB1Q",
  field: "field_Y8XB1Q",
  vars: "vars_Y8XB1Q",
  varRow: "varRow_Y8XB1Q",
  drop: "drop_Y8XB1Q",
  actions: "actions_Y8XB1Q",
  why: "why_Y8XB1Q",
  resolved: "resolved_Y8XB1Q",
  stamp: "stamp_Y8XB1Q",
  quiet: "quiet_Y8XB1Q",
  problem: "problem_Y8XB1Q",
  rows: "rows_Y8XB1Q",
  row: "row_Y8XB1Q",
  rowNested: "rowNested_Y8XB1Q",
  rowHead: "rowHead_Y8XB1Q",
  token: "token_Y8XB1Q",
  verdict: "verdict_Y8XB1Q",
  verdictKnown: "verdictKnown_Y8XB1Q",
  meaning: "meaning_Y8XB1Q",
  example: "example_Y8XB1Q",
  travel: "travel_Y8XB1Q",
  travelRow: "travelRow_Y8XB1Q",
  travelLens: "travelLens_Y8XB1Q",
  travelSame: "travelSame_Y8XB1Q",
  travelFlag: "travelFlag_Y8XB1Q",
  more: "more_Y8XB1Q",
  tokens: "tokens_Y8XB1Q",
  deadToken: "deadToken_Y8XB1Q",
  stack: "stack_Y8XB1Q",
  tabs: "tabs_Y8XB1Q",
  tab: "tab_Y8XB1Q",
  tabOn: "tabOn_Y8XB1Q",
  groupHead: "groupHead_Y8XB1Q",
  entries: "entries_Y8XB1Q",
  entry: "entry_Y8XB1Q",
  insert: "insert_Y8XB1Q",
  entryDesc: "entryDesc_Y8XB1Q"
};

// src/ui/apps/macro-lab/bible-pane.tsx
import { jsxDEV, Fragment } from "react/jsx-dev-runtime";
function BiblePane({
  lens,
  onInsert
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(() => new Set);
  const groups = useMemo(() => bibleFor(lens), [lens]);
  const shown = useMemo(() => filterBible(groups, query), [groups, query]);
  const total = bibleSize(lens);
  const searching = query.trim().length > 0;
  const toggle = (name) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(name))
      next.delete(name);
    else
      next.add(name);
    return next;
  });
  const shownCount = shown.reduce((n, g) => n + g.macros.length, 0);
  return /* @__PURE__ */ jsxDEV("section", {
    className: styles_module_default.box,
    "aria-label": "Every macro this platform has",
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.boxHead,
        children: [
          /* @__PURE__ */ jsxDEV("h2", {
            className: styles_module_default.boxTitle,
            children: "Macro bible"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("span", {
            className: styles_module_default.boxNote,
            children: searching ? `${shownCount} of ${total}` : `${total} macros`
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("input", {
        className: styles_module_default.field,
        value: query,
        placeholder: "Search by name, meaning or alias",
        "aria-label": "Search macros",
        onChange: (e) => setQuery(e.target.value)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("p", {
        className: styles_module_default.quiet,
        children: `Click any macro to drop it into your text. Words and meanings are ${MACRO_DIALECT_LABELS[lens]}'s own.`
      }, undefined, false, undefined, this),
      shown.length === 0 ? /* @__PURE__ */ jsxDEV("p", {
        className: styles_module_default.quiet,
        children: [
          `Nothing in ${MACRO_DIALECT_LABELS[lens]}'s catalog matches that. It may exist on `,
          "another platform - try one of the others above."
        ]
      }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.rows,
        children: shown.map((group) => {
          const isOpen = searching || open.has(group.name);
          return /* @__PURE__ */ jsxDEV("div", {
            className: styles_module_default.row,
            children: [
              /* @__PURE__ */ jsxDEV("button", {
                type: "button",
                className: styles_module_default.groupHead,
                "aria-expanded": isOpen,
                onClick: () => toggle(group.name),
                children: [
                  /* @__PURE__ */ jsxDEV("span", {
                    className: styles_module_default.token,
                    children: group.name
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV("span", {
                    className: styles_module_default.verdict,
                    children: group.macros.length
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              isOpen ? /* @__PURE__ */ jsxDEV(Fragment, {
                children: [
                  /* @__PURE__ */ jsxDEV("p", {
                    className: styles_module_default.meaning,
                    children: group.description
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV("ul", {
                    className: styles_module_default.entries,
                    children: group.macros.map((m) => /* @__PURE__ */ jsxDEV("li", {
                      className: styles_module_default.entry,
                      children: [
                        /* @__PURE__ */ jsxDEV("button", {
                          type: "button",
                          className: styles_module_default.insert,
                          title: `Insert ${m.macro}`,
                          onClick: () => onInsert(m.macro),
                          children: m.macro
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("span", {
                          className: styles_module_default.entryDesc,
                          children: m.description
                        }, undefined, false, undefined, this),
                        m.example ? /* @__PURE__ */ jsxDEV("span", {
                          className: styles_module_default.example,
                          children: `e.g. ${m.example}`
                        }, undefined, false, undefined, this) : null,
                        m.aliases && m.aliases.length > 0 ? /* @__PURE__ */ jsxDEV("span", {
                          className: styles_module_default.example,
                          children: `also written ${m.aliases.map((a) => `{{${a}}}`).join(" ")}`
                        }, undefined, false, undefined, this) : null
                      ]
                    }, m.macro, true, undefined, this))
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this) : null
            ]
          }, group.name, true, undefined, this);
        })
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/stamp/index.tsx
import { useMemo as useMemo2 } from "react";

// src/ui/components/stamp/styles.module.css
var styles_module_default2 = {
  topbtn: "topbtn_XRqkoA"
};

// src/ui/components/stamp/index.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
function Stamp({
  children,
  onClick,
  disabled,
  accent,
  title,
  type = "button",
  id,
  "aria-label": ariaLabel
}) {
  const style = useMemo2(() => accent ? { background: accent } : undefined, [accent]);
  return /* @__PURE__ */ jsxDEV2("button", {
    id,
    type,
    className: `stamp ${styles_module_default2.topbtn}`,
    style,
    onClick,
    disabled,
    title,
    "aria-label": ariaLabel,
    children
  }, undefined, false, undefined, this);
}

// src/ui/apps/macro-lab/engine-pane.tsx
import { jsxDEV as jsxDEV3, Fragment as Fragment2 } from "react/jsx-dev-runtime";
var IDLE_ENGINE = { result: null, busy: false, problem: null };
function EnginePane({
  engine,
  lensLabel,
  state,
  onResolve
}) {
  const result = state.result;
  return /* @__PURE__ */ jsxDEV3("section", {
    className: styles_module_default.box,
    "aria-label": "What the engine did",
    children: [
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default.boxHead,
        children: [
          /* @__PURE__ */ jsxDEV3("h2", {
            className: styles_module_default.boxTitle,
            children: "Resolved"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3("span", {
            className: styles_module_default.boxNote,
            children: result?.ok ? `${result.engine.name} ${result.engine.version}` : "the real engine"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default.actions,
        children: [
          /* @__PURE__ */ jsxDEV3(Stamp, {
            onClick: onResolve,
            disabled: !engine || state.busy,
            children: state.busy ? "Resolving…" : "Resolve for real"
          }, undefined, false, undefined, this),
          !engine ? /* @__PURE__ */ jsxDEV3("span", {
            className: styles_module_default.why,
            children: [
              `No ${lensLabel} engine on this machine, so nothing can run this text. The reading beside `,
              "it still works."
            ]
          }, undefined, true, undefined, this) : null
        ]
      }, undefined, true, undefined, this),
      state.problem ? /* @__PURE__ */ jsxDEV3("p", {
        className: styles_module_default.problem,
        children: state.problem
      }, undefined, false, undefined, this) : null,
      result && !result.ok ? /* @__PURE__ */ jsxDEV3("p", {
        className: styles_module_default.problem,
        children: [
          `The engine did not finish (${result.reason}): ${result.detail}. Nothing was resolved, so `,
          "do not read this as a pass."
        ]
      }, undefined, true, undefined, this) : null,
      result?.ok ? /* @__PURE__ */ jsxDEV3(Fragment2, {
        children: [
          /* @__PURE__ */ jsxDEV3("pre", {
            className: styles_module_default.resolved,
            children: result.prompt || "(the engine returned nothing)"
          }, undefined, false, undefined, this),
          result.unresolved.length > 0 ? /* @__PURE__ */ jsxDEV3("div", {
            children: [
              /* @__PURE__ */ jsxDEV3("p", {
                className: styles_module_default.quiet,
                children: [
                  "Still wearing braces after the engine finished, so this is what the model would ",
                  "actually see:"
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV3("div", {
                className: styles_module_default.tokens,
                children: result.unresolved.map((u) => /* @__PURE__ */ jsxDEV3("code", {
                  className: styles_module_default.deadToken,
                  children: u.count > 1 ? `${u.token} ×${u.count}` : u.token
                }, u.token, false, undefined, this))
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV3("p", {
            className: styles_module_default.quiet,
            children: "Every macro resolved. Nothing was left unexpanded."
          }, undefined, false, undefined, this),
          result.warnings.map((w) => /* @__PURE__ */ jsxDEV3("p", {
            className: styles_module_default.problem,
            children: w
          }, w, false, undefined, this))
        ]
      }, undefined, true, undefined, this) : null,
      !result && !state.problem ? /* @__PURE__ */ jsxDEV3("p", {
        className: styles_module_default.quiet,
        children: engine ? "Press Resolve to run this text through the engine itself. Nothing is sent anywhere: it runs on this machine, against the checkout you installed." : "This box needs a real engine to answer. Point Hoplight at a checkout and it will run your text through it."
      }, undefined, false, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/macro-lab/ops.module.css
var ops_module_default = {
  tableWrap: "tableWrap_oB2LjA",
  table: "table_oB2LjA",
  opCell: "opCell_oB2LjA",
  opAction: "opAction_oB2LjA",
  opFamily: "opFamily_oB2LjA",
  gap: "gap_oB2LjA",
  gapWord: "gapWord_oB2LjA"
};

// src/ui/apps/macro-lab/ops-pane.tsx
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
var actionOf = (op) => op.slice(op.indexOf(".") + 1).replace(/-/g, " ");
function OpsPane({ onInsert }) {
  const rows = operationRows();
  const gaps = rows.filter((r) => r.carriedBy < OPERATION_LENSES.length).length;
  return /* @__PURE__ */ jsxDEV4("section", {
    className: styles_module_default.box,
    "aria-label": "What each platform calls the same operation",
    children: [
      /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default.boxHead,
        children: [
          /* @__PURE__ */ jsxDEV4("h2", {
            className: styles_module_default.boxTitle,
            children: "Operations"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("span", {
            className: styles_module_default.boxNote,
            children: `${rows.length} operations · ${gaps} with gaps`
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV4("p", {
        className: styles_module_default.quiet,
        children: "Every row is one thing a macro can do, and every column is what that platform calls it. A blank cell means that platform has no macro for it at all, so text relying on it will not survive the move. Click a spelling to drop it into your text."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("div", {
        className: ops_module_default.tableWrap,
        children: /* @__PURE__ */ jsxDEV4("table", {
          className: ops_module_default.table,
          children: [
            /* @__PURE__ */ jsxDEV4("thead", {
              children: /* @__PURE__ */ jsxDEV4("tr", {
                children: [
                  /* @__PURE__ */ jsxDEV4("th", {
                    scope: "col",
                    children: "Operation"
                  }, undefined, false, undefined, this),
                  OPERATION_LENSES.map((lens) => /* @__PURE__ */ jsxDEV4("th", {
                    scope: "col",
                    children: MACRO_DIALECT_LABELS[lens]
                  }, lens, false, undefined, this))
                ]
              }, undefined, true, undefined, this)
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV4("tbody", {
              children: rows.map((row) => /* @__PURE__ */ jsxDEV4("tr", {
                children: [
                  /* @__PURE__ */ jsxDEV4("th", {
                    scope: "row",
                    className: ops_module_default.opCell,
                    children: [
                      /* @__PURE__ */ jsxDEV4("span", {
                        className: ops_module_default.opAction,
                        children: actionOf(row.op)
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV4("span", {
                        className: ops_module_default.opFamily,
                        children: row.family
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this),
                  row.byLens.map((cell) => /* @__PURE__ */ jsxDEV4("td", {
                    className: cell.forms.length === 0 ? ops_module_default.gap : undefined,
                    children: cell.forms.length === 0 ? /* @__PURE__ */ jsxDEV4("span", {
                      className: ops_module_default.gapWord,
                      children: "none"
                    }, undefined, false, undefined, this) : cell.forms.map((form) => /* @__PURE__ */ jsxDEV4("button", {
                      type: "button",
                      className: styles_module_default.insert,
                      title: form.description,
                      onClick: () => onInsert(form.macro),
                      children: form.macro
                    }, form.macro, false, undefined, this))
                  }, cell.lens, false, undefined, this))
                ]
              }, row.op, true, undefined, this))
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("p", {
        className: styles_module_default.quiet,
        children: "Only operations where the engines DISAGREE appear here. A macro name that already means the same thing everywhere carries no operation annotation and lives in the bible instead."
      }, undefined, false, undefined, this),
      OPERATION_ABSENT.unmapped.length > 0 ? /* @__PURE__ */ jsxDEV4("p", {
        className: styles_module_default.quiet,
        children: [
          `${OPERATION_ABSENT.unmapped.map((l) => MACRO_DIALECT_LABELS[l]).join(", ")} has no `,
          "column here yet. Its macro list is complete in the bible, but Hoplight has not yet ",
          "mapped which of these operations each of its macros performs - so a column would show ",
          "our gap as its gap. That mapping is read from the engine, one macro at a time."
        ]
      }, undefined, true, undefined, this) : null,
      OPERATION_ABSENT.shared.length > 0 ? /* @__PURE__ */ jsxDEV4("p", {
        className: styles_module_default.quiet,
        children: [
          `${OPERATION_ABSENT.shared.map((l) => MACRO_DIALECT_LABELS[l]).join(", ")} performs the `,
          "same operations as the engine above it, so it has no column of its own. The two differ in ",
          "which macros they carry and in how a few are spelled - see the bible for both."
        ]
      }, undefined, true, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/macro-lab/reading-pane.tsx
import { useState as useState2 } from "react";
import { jsxDEV as jsxDEV5, Fragment as Fragment3 } from "react/jsx-dev-runtime";
function TokenRow({
  row,
  lens
}) {
  const [open, setOpen] = useState2(false);
  const travel = open && row.name ? travelFor(row.token, lens) : [];
  return /* @__PURE__ */ jsxDEV5("li", {
    className: `${styles_module_default.row}${row.depth > 0 ? ` ${styles_module_default.rowNested}` : ""}`,
    children: [
      /* @__PURE__ */ jsxDEV5("div", {
        className: styles_module_default.rowHead,
        children: [
          /* @__PURE__ */ jsxDEV5("code", {
            className: styles_module_default.token,
            children: row.token
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("span", {
            className: `${styles_module_default.verdict}${row.verdict === "known" ? ` ${styles_module_default.verdictKnown}` : ""}`,
            children: VERDICT_LABEL[row.verdict]
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      row.description ? /* @__PURE__ */ jsxDEV5("p", {
        className: styles_module_default.meaning,
        children: row.description
      }, undefined, false, undefined, this) : null,
      row.documentedAs ? /* @__PURE__ */ jsxDEV5("p", {
        className: styles_module_default.example,
        children: `written here as ${row.documentedAs}`
      }, undefined, false, undefined, this) : null,
      row.example ? /* @__PURE__ */ jsxDEV5("p", {
        className: styles_module_default.example,
        children: `e.g. ${row.example}`
      }, undefined, false, undefined, this) : null,
      row.verdict === "invokes-nothing" ? /* @__PURE__ */ jsxDEV5("p", {
        className: styles_module_default.meaning,
        children: "Nothing here names a macro, so no engine will expand it. Comments and escapes look like this."
      }, undefined, false, undefined, this) : null,
      row.name && dialectTranslates(lens) ? /* @__PURE__ */ jsxDEV5("button", {
        type: "button",
        className: styles_module_default.more,
        onClick: () => setOpen(!open),
        children: open ? "Hide other platforms" : "Where else does it work"
      }, undefined, false, undefined, this) : null,
      open ? /* @__PURE__ */ jsxDEV5("ul", {
        className: styles_module_default.travel,
        children: travel.map((t) => /* @__PURE__ */ jsxDEV5("li", {
          className: styles_module_default.travelRow,
          children: [
            /* @__PURE__ */ jsxDEV5("span", {
              className: styles_module_default.travelLens,
              children: MACRO_DIALECT_LABELS[t.lens]
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV5("span", {
              className: t.kind === "same" ? styles_module_default.travelSame : styles_module_default.travelFlag,
              children: t.kind === "same" ? "the same token works there" : t.becomes ? `${t.becomes} - ${t.why}` : t.why
            }, undefined, false, undefined, this)
          ]
        }, t.lens, true, undefined, this))
      }, undefined, false, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}
function ReadingPane({
  text,
  lens
}) {
  const reading = readMacros(text, lens);
  const label = MACRO_DIALECT_LABELS[lens];
  return /* @__PURE__ */ jsxDEV5("section", {
    className: styles_module_default.box,
    "aria-label": "What the catalog says",
    children: [
      /* @__PURE__ */ jsxDEV5("div", {
        className: styles_module_default.boxHead,
        children: [
          /* @__PURE__ */ jsxDEV5("h2", {
            className: styles_module_default.boxTitle,
            children: "Reading"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("span", {
            className: styles_module_default.boxNote,
            children: `${label} catalog`
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      reading.empty ? /* @__PURE__ */ jsxDEV5("p", {
        className: styles_module_default.quiet,
        children: [
          "No macros in this text yet. Type something with double braces in it, like",
          " ",
          /* @__PURE__ */ jsxDEV5("code", {
            children: "{{char}}"
          }, undefined, false, undefined, this),
          "."
        ]
      }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV5(Fragment3, {
        children: [
          reading.unknownNames.length > 0 ? /* @__PURE__ */ jsxDEV5("div", {
            children: [
              /* @__PURE__ */ jsxDEV5("p", {
                className: styles_module_default.quiet,
                children: [
                  `${label} has no macro by ${reading.unknownNames.length === 1 ? "this name" : "these names"}. `,
                  "It will reach the model as literal text."
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV5("div", {
                className: styles_module_default.tokens,
                children: reading.unknownNames.map((n) => /* @__PURE__ */ jsxDEV5("code", {
                  className: styles_module_default.deadToken,
                  children: n
                }, n, false, undefined, this))
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this) : null,
          /* @__PURE__ */ jsxDEV5("ul", {
            className: styles_module_default.rows,
            children: reading.tokens.map((row, i) => /* @__PURE__ */ jsxDEV5(TokenRow, {
              row,
              lens
            }, `${row.token}-${i}`, false, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("p", {
            className: styles_module_default.quiet,
            children: `Read from our catalog of ${label}, which is transcribed from that engine's own ` + "capability source and matches on macro NAME. A name being present is not a promise " + "about its arguments. For that, resolve it."
          }, undefined, false, undefined, this),
          dialectTranslates(lens) ? null : /* @__PURE__ */ jsxDEV5("p", {
            className: styles_module_default.quiet,
            children: noTranslationNote(lens)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/macro-lab/index.tsx
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
var VIEWS = [
  { id: "reading", label: "Reading" },
  { id: "bible", label: "Macro bible" },
  { id: "operations", label: "Operations" }
];
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + '<path d="M9 3v6.2L4.5 17.4A2 2 0 0 0 6.3 20.5h11.4a2 2 0 0 0 1.8-3.1L15 9.2V3"/>' + '<path d="M7.5 3h9"/><path d="M7.8 14.5h8.4"/></svg>';
var STARTER = "Hello {{char}}, I am {{user}}.";
var ACCENT = "#7a5cc4";
function MacroLab({ ctx }) {
  const [text, setText] = useState3(STARTER);
  const [lens, setLens] = useState3("sillytavern");
  const [engines, setEngines] = useState3([]);
  const [user, setUser] = useState3("");
  const [char, setChar] = useState3("");
  const [vars, setVars] = useState3([{ key: "", value: "" }]);
  const [engineState, setEngineState] = useState3(IDLE_ENGINE);
  const [view, setView] = useState3("reading");
  const scratch = useRef(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const out = await ctx.api.macroEngines();
        if (!cancelled)
          setEngines(out.engines);
      } catch {
        if (!cancelled) {
          setEngineState((s) => ({
            ...s,
            problem: "Could not ask which engines are installed. The studio may be unreachable."
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);
  useEffect(() => {
    ctx.setStatus(engines.length > 0 ? `macro lab · ${engines.map((e) => e.label).join(" · ")} ready` : "macro lab · catalog only, no engine installed");
  }, [ctx, engines]);
  const engine = useMemo3(() => engines.find((e) => e.id === lens) ?? null, [engines, lens]);
  useEffect(() => setEngineState(IDLE_ENGINE), [text, lens, user, char, vars]);
  const resolve = useCallback(async () => {
    if (!engine)
      return;
    setEngineState({ result: null, busy: true, problem: null });
    try {
      const result = await ctx.api.macroResolve(buildResolveAsk(engine.id, text, { user, char, vars }));
      setEngineState({ result, busy: false, problem: null });
    } catch (e) {
      const busyElsewhere = apiStatusIs(e, 429);
      setEngineState({
        result: null,
        busy: false,
        problem: busyElsewhere ? `${engine.label} is already resolving something. Wait for that to finish.` : e instanceof Error ? e.message : "the render could not be started"
      });
    }
  }, [ctx, engine, text, user, char, vars]);
  const setVar = (index, patch) => setVars(vars.map((row, i) => i === index ? { ...row, ...patch } : row));
  const insertAtCaret = useCallback((token) => {
    const box = scratch.current;
    const at = box ? box.selectionStart : text.length;
    const to = box ? box.selectionEnd : text.length;
    const next = insertToken(text, token, at, to);
    setText(next.text);
    requestAnimationFrame(() => {
      const el = scratch.current;
      if (!el)
        return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  }, [text]);
  return /* @__PURE__ */ jsxDEV6("div", {
    className: styles_module_default.room,
    style: { "--a": ACCENT },
    children: [
      /* @__PURE__ */ jsxDEV6("header", {
        className: styles_module_default.head,
        children: [
          /* @__PURE__ */ jsxDEV6("span", {
            className: styles_module_default.eyebrow,
            children: "Macro Lab"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV6("h1", {
            className: styles_module_default.title,
            children: "What does this macro actually do?"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV6("p", {
            className: styles_module_default.lede,
            children: "Write macro text on the left. The right tells you what each token means on the platform you picked, and - when you have that platform installed - what its own engine turns your text into."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: styles_module_default.lenses,
        role: "radiogroup",
        "aria-label": "Platform",
        children: LAB_LENSES.map((id) => /* @__PURE__ */ jsxDEV6("button", {
          type: "button",
          role: "radio",
          "aria-checked": id === lens,
          className: `${styles_module_default.lens}${id === lens ? ` ${styles_module_default.lensOn}` : ""}`,
          onClick: () => setLens(id),
          children: [
            MACRO_DIALECT_LABELS[id],
            engines.some((e) => e.id === id) ? " ·" : ""
          ]
        }, id, true, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: styles_module_default.boxes,
        children: [
          /* @__PURE__ */ jsxDEV6("section", {
            className: styles_module_default.box,
            "aria-label": "Your macro text",
            children: [
              /* @__PURE__ */ jsxDEV6("div", {
                className: styles_module_default.boxHead,
                children: [
                  /* @__PURE__ */ jsxDEV6("h2", {
                    className: styles_module_default.boxTitle,
                    children: "Your text"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV6("span", {
                    className: styles_module_default.boxNote,
                    children: `${text.length} characters`
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV6("textarea", {
                ref: scratch,
                className: styles_module_default.source,
                value: text,
                spellCheck: false,
                "aria-label": "Macro text",
                onChange: (e) => setText(e.target.value)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                className: styles_module_default.boxHead,
                children: [
                  /* @__PURE__ */ jsxDEV6("h2", {
                    className: styles_module_default.boxTitle,
                    children: "Pretend context"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV6("span", {
                    className: styles_module_default.boxNote,
                    children: "used when resolving"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV6("p", {
                className: styles_module_default.quiet,
                children: [
                  "A macro that names somebody needs somebody to name. Leave these empty and each engine ",
                  "falls back to its own placeholder."
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                className: styles_module_default.who,
                children: [
                  /* @__PURE__ */ jsxDEV6("label", {
                    className: styles_module_default.whoLabel,
                    htmlFor: "macro-lab-user",
                    children: "{{user}} is"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV6("input", {
                    id: "macro-lab-user",
                    className: styles_module_default.field,
                    value: user,
                    placeholder: "User",
                    onChange: (e) => setUser(e.target.value)
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV6("label", {
                    className: styles_module_default.whoLabel,
                    htmlFor: "macro-lab-char",
                    children: "{{char}} is"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV6("input", {
                    id: "macro-lab-char",
                    className: styles_module_default.field,
                    value: char,
                    placeholder: "Character",
                    onChange: (e) => setChar(e.target.value)
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                className: styles_module_default.vars,
                children: [
                  vars.map((row, i) => /* @__PURE__ */ jsxDEV6("div", {
                    className: styles_module_default.varRow,
                    children: [
                      /* @__PURE__ */ jsxDEV6("input", {
                        className: styles_module_default.field,
                        value: row.key,
                        placeholder: "variable",
                        "aria-label": `Variable ${i + 1} name`,
                        onChange: (e) => setVar(i, { key: e.target.value })
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("input", {
                        className: styles_module_default.field,
                        value: row.value,
                        placeholder: "value",
                        "aria-label": `Variable ${i + 1} value`,
                        onChange: (e) => setVar(i, { value: e.target.value })
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV6("button", {
                        type: "button",
                        className: styles_module_default.drop,
                        "aria-label": `Remove variable ${i + 1}`,
                        onClick: () => setVars(vars.length === 1 ? [{ key: "", value: "" }] : vars.filter((_, j) => j !== i)),
                        children: "x"
                      }, undefined, false, undefined, this)
                    ]
                  }, i, true, undefined, this)),
                  /* @__PURE__ */ jsxDEV6("button", {
                    type: "button",
                    className: styles_module_default.more,
                    onClick: () => setVars([...vars, { key: "", value: "" }]),
                    children: "Add a variable"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV6("div", {
            className: styles_module_default.stack,
            children: [
              /* @__PURE__ */ jsxDEV6(EnginePane, {
                engine,
                lensLabel: MACRO_DIALECT_LABELS[lens],
                state: engineState,
                onResolve: () => void resolve()
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV6("div", {
                className: styles_module_default.tabs,
                role: "tablist",
                "aria-label": "Reference",
                children: VIEWS.map((v) => /* @__PURE__ */ jsxDEV6("button", {
                  type: "button",
                  role: "tab",
                  "aria-selected": v.id === view,
                  className: `${styles_module_default.tab}${v.id === view ? ` ${styles_module_default.tabOn}` : ""}`,
                  onClick: () => setView(v.id),
                  children: v.label
                }, v.id, false, undefined, this))
              }, undefined, false, undefined, this),
              view === "reading" ? /* @__PURE__ */ jsxDEV6(ReadingPane, {
                text,
                lens
              }, undefined, false, undefined, this) : null,
              view === "bible" ? /* @__PURE__ */ jsxDEV6(BiblePane, {
                lens,
                onInsert: insertAtCaret
              }, undefined, false, undefined, this) : null,
              view === "operations" ? /* @__PURE__ */ jsxDEV6(OpsPane, {
                onInsert: insertAtCaret
              }, undefined, false, undefined, this) : null
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var app = {
  manifest: {
    id: "macro-lab",
    title: "Macro Lab",
    markSvg: MARK_SVG,
    accent: ACCENT,
    order: 55,
    subtitle: "app · macros",
    catalogOnly: true,
    agentSurface: {
      describe: "The Macro Lab: a scratch pad for macro text. The reading half explains each token against " + "the catalog for the chosen platform and shows what it becomes on the other four. The " + "resolved half runs the text through that platform's real macro engine, when a checkout " + "of it is installed on this machine.",
      actions: [
        {
          id: "read",
          label: "Explain a macro",
          describe: "Say what a token does on the chosen platform, and what it becomes on the other four. " + "Answered from the catalogs, so it works with no engine installed."
        },
        {
          id: "resolve",
          label: "Resolve for real",
          describe: "Run the text through the platform's own macro engine and report what it turned into " + "and what was left unexpanded. Needs a checkout of that platform on this machine."
        }
      ]
    }
  },
  Component: MacroLab
};
var macro_lab_default = app;
export {
  macro_lab_default as default,
  MacroLab
};
