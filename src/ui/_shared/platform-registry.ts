/**
 * Platform registry - "what site is this host, and what color is it" for the leaving-gate badge. Pure
 * data + a lookup, NO network: recognition is entirely local, so showing a badge never fetches anything
 * from the destination (that was the whole safety point). A recognized host paints a colored monogram
 * tile + the site's name; an unrecognized one falls back to a neutral globe + the bare host.
 *
 * This is a curated SEED, not an exhaustive directory - it covers the AI-roleplay ecosystem plus the
 * mainstream "big boys" (search, big tech, social, image/file hosts, funding). Widen it by adding a row
 * to SEED, never a code branch (folders-as-schema doctrine, mirroring the tag taxonomy). Colors are the
 * platforms' approximate brand colors; the badge picks legible ink over them with readableInk.
 */

/** a recognized destination: its display name and brand color (the tile fill) */
export interface Platform {
  name: string;
  color: string;
  /** optional 1-2 char tile mark; defaults to the first letter of name */
  mark?: string;
}

/**
 * host -> platform. Keys are registrable domains (or a specific subdomain when it deserves its own
 * identity, e.g. drive.google.com). Lowercase, no leading www. Grouped by kind for auditability only;
 * the lookup does not care about the groups.
 */
const SEED: Readonly<Record<string, Platform>> = {
  // search
  "google.com": { name: "Google", color: "#4285f4" },
  "bing.com": { name: "Bing", color: "#0c8484" },
  "duckduckgo.com": { name: "DuckDuckGo", color: "#de5833" },
  "search.brave.com": { name: "Brave Search", color: "#fb542b" },
  "yahoo.com": { name: "Yahoo", color: "#6001d2" },
  "yandex.com": { name: "Yandex", color: "#ff0000" },
  "baidu.com": { name: "Baidu", color: "#2319dc" },
  "ecosia.org": { name: "Ecosia", color: "#199a55" },
  "startpage.com": { name: "Startpage", color: "#6472e5" },

  // big tech / mainstream
  "apple.com": { name: "Apple", color: "#555555" },
  "microsoft.com": { name: "Microsoft", color: "#5e5e5e" },
  "amazon.com": { name: "Amazon", color: "#ff9900" },
  "wikipedia.org": { name: "Wikipedia", color: "#636363" },
  "stackoverflow.com": { name: "Stack Overflow", color: "#f48024" },
  "linkedin.com": { name: "LinkedIn", color: "#0a66c2" },
  "spotify.com": { name: "Spotify", color: "#1db954" },
  "netflix.com": { name: "Netflix", color: "#e50914" },
  "paypal.com": { name: "PayPal", color: "#003087" },
  "ebay.com": { name: "eBay", color: "#e53238" },
  "cloudflare.com": { name: "Cloudflare", color: "#f38020" },
  "wordpress.com": { name: "WordPress", color: "#3858e9" },
  "steampowered.com": { name: "Steam", color: "#1b2838" },
  "steamcommunity.com": { name: "Steam", color: "#1b2838" },

  // ai model / labs
  "openai.com": { name: "OpenAI", color: "#10a37f" },
  "chatgpt.com": { name: "ChatGPT", color: "#10a37f" },
  "anthropic.com": { name: "Anthropic", color: "#d97757" },
  "claude.ai": { name: "Claude", color: "#d97757" },
  "openrouter.ai": { name: "OpenRouter", color: "#6467f2" },
  "huggingface.co": { name: "Hugging Face", color: "#ffd21e" },
  "mistral.ai": { name: "Mistral", color: "#fa5010" },
  "gemini.google.com": { name: "Gemini", color: "#4285f4" },
  "ai.google.dev": { name: "Google AI", color: "#4285f4" },
  "deepseek.com": { name: "DeepSeek", color: "#4d6bfe" },
  "x.ai": { name: "xAI", color: "#111111" },
  "cohere.com": { name: "Cohere", color: "#39594d" },
  "groq.com": { name: "Groq", color: "#f55036" },
  "replicate.com": { name: "Replicate", color: "#111111" },
  "together.ai": { name: "Together AI", color: "#0f6fff" },
  "perplexity.ai": { name: "Perplexity", color: "#20808d" },
  "meta.ai": { name: "Meta AI", color: "#0064e0" },
  "nanogpt.com": { name: "NanoGPT", color: "#111111" },

  // ai roleplay / character hubs
  "janitorai.com": { name: "JanitorAI", color: "#e6486b" },
  "chub.ai": { name: "Chub", color: "#2563eb" },
  "characterhub.org": { name: "CharacterHub", color: "#2563eb" },
  "character.ai": { name: "Character.AI", color: "#5c6bc0" },
  "spicychat.ai": { name: "SpicyChat", color: "#ff5a5f" },
  "crushon.ai": { name: "CrushOn", color: "#ff4d8d" },
  "chai-research.com": { name: "Chai", color: "#7c3aed" },
  "figgs.ai": { name: "Figgs", color: "#10b981" },
  "pygmalion.chat": { name: "Pygmalion", color: "#e11d48" },
  "risuai.xyz": { name: "RisuAI", color: "#6d28d9" },
  "risuai.net": { name: "RisuAI", color: "#6d28d9" },
  "realm.risuai.net": { name: "RisuRealm", color: "#6d28d9" },
  "agnai.chat": { name: "Agnaistic", color: "#14b8a6" },
  "backyard.ai": { name: "Backyard AI", color: "#22c55e" },
  "aicharactercards.com": { name: "AI Character Cards", color: "#3b82f6" },
  "yodayo.com": { name: "Yodayo", color: "#a855f7" },
  "moescape.ai": { name: "Moescape", color: "#a855f7" },
  "sakura.fm": { name: "Sakura", color: "#f472b6" },
  "talkie-ai.com": { name: "Talkie", color: "#f59e0b" },
  "poe.com": { name: "Poe", color: "#5d5cde" },
  "perchance.org": { name: "Perchance", color: "#6366f1" },
  "kajiwoto.com": { name: "Kajiwoto", color: "#22d3ee" },
  "charstar.ai": { name: "Charstar", color: "#8b5cf6" },
  "flowgpt.com": { name: "FlowGPT", color: "#10b981" },
  "novelai.net": { name: "NovelAI", color: "#e5c07b" },
  "play.aidungeon.com": { name: "AI Dungeon", color: "#16a34a" },
  "aidungeon.com": { name: "AI Dungeon", color: "#16a34a" },
  "venus.chub.ai": { name: "Venus", color: "#2563eb" },
  "wyvern.chat": { name: "Wyvern", color: "#7c3aed" },
  "moemate.io": { name: "Moemate", color: "#ff6ac1" },
  "candy.ai": { name: "Candy AI", color: "#ff4d6d" },

  // social / community
  "discord.com": { name: "Discord", color: "#5865f2" },
  "discord.gg": { name: "Discord", color: "#5865f2" },
  "reddit.com": { name: "Reddit", color: "#ff4500" },
  "x.com": { name: "X", color: "#111111" },
  "twitter.com": { name: "X", color: "#111111" },
  "youtube.com": { name: "YouTube", color: "#ff0000" },
  "youtu.be": { name: "YouTube", color: "#ff0000" },
  "twitch.tv": { name: "Twitch", color: "#9146ff" },
  "github.com": { name: "GitHub", color: "#4a4a55" },
  "gitlab.com": { name: "GitLab", color: "#fc6d26" },
  "t.me": { name: "Telegram", color: "#26a5e4" },
  "telegram.org": { name: "Telegram", color: "#26a5e4" },
  "bsky.app": { name: "Bluesky", color: "#0085ff" },
  "tumblr.com": { name: "Tumblr", color: "#4a5a70" },
  "facebook.com": { name: "Facebook", color: "#1877f2" },
  "instagram.com": { name: "Instagram", color: "#e4405f" },
  "tiktok.com": { name: "TikTok", color: "#111111" },
  "mastodon.social": { name: "Mastodon", color: "#6364ff" },
  "threads.net": { name: "Threads", color: "#111111" },

  // media / content
  "medium.com": { name: "Medium", color: "#4a4a4a" },
  "substack.com": { name: "Substack", color: "#ff6719" },
  "wattpad.com": { name: "Wattpad", color: "#ff500a" },
  "archiveofourown.org": { name: "AO3", color: "#990000", mark: "AO3" },
  "fanfiction.net": { name: "FanFiction", color: "#2b689c" },
  "fandom.com": { name: "Fandom", color: "#fa005a" },
  "notion.so": { name: "Notion", color: "#4a4a4a" },
  "docs.google.com": { name: "Google Docs", color: "#4285f4" },
  "carrd.co": { name: "Carrd", color: "#b14fe8" },
  "linktr.ee": { name: "Linktree", color: "#25b47a" },
  "neocities.org": { name: "Neocities", color: "#ff5ca0" },
  "toyhou.se": { name: "Toyhouse", color: "#5a8fc7" },

  // image / file hosts
  "catbox.moe": { name: "Catbox", color: "#7b68ee" },
  "litterbox.catbox.moe": { name: "Litterbox", color: "#7b68ee" },
  "imgur.com": { name: "Imgur", color: "#1bb76e" },
  "postimg.cc": { name: "PostImage", color: "#4f46e5" },
  "ibb.co": { name: "ImgBB", color: "#06b6d4" },
  "pixiv.net": { name: "Pixiv", color: "#0096fa" },
  "deviantart.com": { name: "DeviantArt", color: "#05cc47" },
  "artstation.com": { name: "ArtStation", color: "#13aff0" },
  "mega.nz": { name: "MEGA", color: "#d9272e" },
  "drive.google.com": { name: "Google Drive", color: "#1fa463" },
  "dropbox.com": { name: "Dropbox", color: "#0061ff" },
  "pastebin.com": { name: "Pastebin", color: "#23a9f2" },
  "rentry.co": { name: "Rentry", color: "#4a4a55" },
  "rentry.org": { name: "Rentry", color: "#4a4a55" },
  "gofile.io": { name: "Gofile", color: "#1d4ed8" },
  "pixeldrain.com": { name: "Pixeldrain", color: "#f97316" },
  "civitai.com": { name: "Civitai", color: "#1971c2" },
  "files.catbox.moe": { name: "Catbox", color: "#7b68ee" },
  "imgchest.com": { name: "ImgChest", color: "#5865f2" },

  // funding / creator
  "patreon.com": { name: "Patreon", color: "#f1465a" },
  "ko-fi.com": { name: "Ko-fi", color: "#ff5e5b" },
  "buymeacoffee.com": { name: "Buy Me a Coffee", color: "#ffb200" },
  "subscribestar.com": { name: "SubscribeStar", color: "#009488" },
  "subscribestar.adult": { name: "SubscribeStar", color: "#009488" },
  "boosty.to": { name: "Boosty", color: "#f15f2c" },
  "itch.io": { name: "itch.io", color: "#fa5c5c" },
  "gumroad.com": { name: "Gumroad", color: "#ff90e8" },
  "fanbox.cc": { name: "Pixiv Fanbox", color: "#3a5978" },
  "throne.com": { name: "Throne", color: "#111111" },
};

/** normalize a host to a lookup key: lowercase, drop a leading www., drop any :port */
const norm = (host: string): string =>
  host.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");

/**
 * Recognize a destination host. Tries the full host first (so a specific subdomain like
 * drive.google.com wins its own identity), then walks up to the registrable domain. Returns null for an
 * unrecognized host - the gate then shows a neutral globe + the bare host, never a wrong badge.
 */
export const platformFor = (host: string): Platform | null => {
  const parts = norm(host).split(".");
  for (let i = 0; i < parts.length - 1; i += 1) {
    const hit = SEED[parts.slice(i).join(".")];
    if (hit) return hit;
  }
  return null;
};

/** The single-letter (or short) tile mark for a platform: its `mark`, else the first letter of name. */
export const platformMark = (p: Platform): string =>
  (p.mark ?? p.name.replace(/[^a-z0-9]/i, "").charAt(0)).toUpperCase();
