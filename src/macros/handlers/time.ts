// ============================================================================
// TIME & DATE MACROS
// Current time, date, and astronomical calculations
// ============================================================================

import { MacroDefinition, MacroResult, MacroContext } from '../types';
import { registerMacros } from '../registry';

/**
 * Get current date/time, respecting context timezone if set
 */
function getNow(context: MacroContext): Date {
  return new Date();
}

/**
 * {{time}} - Current time (12h format)
 * {{time::24}} - Current time (24h format)
 */
const timeMacro: MacroDefinition = {
  name: 'time',
  description: 'Current time. Use {{time::24}} for 24-hour format',
  args: [{ name: 'format', description: '24 for 24-hour format', required: false }],
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const use24h = args[0] === '24';

    let timeStr: string;
    if (use24h) {
      timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: context.timezone,
      });
    } else {
      timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: context.timezone,
      });
    }

    return { value: timeStr, success: true };
  },
};

/**
 * {{date}} - Current date (locale format)
 * {{date::short}} - Short date
 * {{date::long}} - Long date
 */
const dateMacro: MacroDefinition = {
  name: 'date',
  description: 'Current date. Use ::short or ::long for different formats',
  args: [{ name: 'format', description: 'short, medium, long, full', required: false }],
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const format = args[0]?.toLowerCase() || 'medium';

    const dateStyle = ['short', 'medium', 'long', 'full'].includes(format)
      ? (format as 'short' | 'medium' | 'long' | 'full')
      : 'medium';

    const dateStr = now.toLocaleDateString(context.locale || 'en-US', {
      dateStyle,
      timeZone: context.timezone,
    });

    return { value: dateStr, success: true };
  },
};

/**
 * {{weekday}} - Current day of week
 */
const weekdayMacro: MacroDefinition = {
  name: 'weekday',
  aliases: ['dayofweek'],
  description: 'Current day of the week',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const weekday = now.toLocaleDateString(context.locale || 'en-US', {
      weekday: 'long',
      timeZone: context.timezone,
    });
    return { value: weekday, success: true };
  },
};

/**
 * {{isodate}} - ISO 8601 date (YYYY-MM-DD)
 */
const isodateMacro: MacroDefinition = {
  name: 'isodate',
  description: 'Current date in ISO 8601 format (YYYY-MM-DD)',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const isoDate = now.toISOString().split('T')[0];
    return { value: isoDate, success: true };
  },
};

/**
 * {{isotime}} - ISO 8601 datetime
 */
const isotimeMacro: MacroDefinition = {
  name: 'isotime',
  aliases: ['isodatetime'],
  description: 'Current datetime in ISO 8601 format',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    return { value: now.toISOString(), success: true };
  },
};

/**
 * {{idle_duration}} - Time since last message
 */
const idleDurationMacro: MacroDefinition = {
  name: 'idle_duration',
  aliases: ['idle', 'idletime'],
  description: 'Human-readable time since last activity',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (!context.lastActivityTime) {
      return { value: 'unknown', success: true };
    }

    const now = getNow(context);
    const diffMs = now.getTime() - context.lastActivityTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return { value: `${diffSec} seconds`, success: true };
    }
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return { value: `${mins} minute${mins !== 1 ? 's' : ''}`, success: true };
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return { value: `${hours} hour${hours !== 1 ? 's' : ''}`, success: true };
    }
    const days = Math.floor(diffSec / 86400);
    return { value: `${days} day${days !== 1 ? 's' : ''}`, success: true };
  },
};

/**
 * {{season}} - Current season based on date
 * Uses meteorological seasons (Northern Hemisphere by default)
 */
const seasonMacro: MacroDefinition = {
  name: 'season',
  description: 'Current season (Spring, Summer, Fall, Winter)',
  args: [{ name: 'hemisphere', description: 'north or south', required: false, defaultValue: 'north' }],
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const month = now.getMonth(); // 0-11
    const hemisphere = args[0]?.toLowerCase() || 'north';
    const isSouth = hemisphere === 'south' || hemisphere === 's';

    // Meteorological seasons (by month)
    // North: Spring (Mar-May), Summer (Jun-Aug), Fall (Sep-Nov), Winter (Dec-Feb)
    let season: string;
    if (month >= 2 && month <= 4) {
      season = isSouth ? 'Fall' : 'Spring';
    } else if (month >= 5 && month <= 7) {
      season = isSouth ? 'Winter' : 'Summer';
    } else if (month >= 8 && month <= 10) {
      season = isSouth ? 'Spring' : 'Fall';
    } else {
      season = isSouth ? 'Summer' : 'Winter';
    }

    return { value: season, success: true };
  },
};

/**
 * {{moonPhase}} - Current moon phase
 * Uses a simple synodic month calculation
 * Reference: January 6, 2000 was a new moon
 */
const moonPhaseMacro: MacroDefinition = {
  name: 'moonphase',
  aliases: ['moon', 'lunarphase'],
  description: 'Current moon phase name',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);

    // Reference new moon: January 6, 2000 at 18:14 UTC
    const referenceNewMoon = new Date('2000-01-06T18:14:00Z');
    const synodicMonth = 29.53058867; // days

    const daysSinceReference = (now.getTime() - referenceNewMoon.getTime()) / (1000 * 60 * 60 * 24);
    const lunarAge = daysSinceReference % synodicMonth;
    const phase = lunarAge / synodicMonth; // 0-1

    // 8 phases
    let phaseName: string;
    if (phase < 0.0625) {
      phaseName = 'New Moon';
    } else if (phase < 0.1875) {
      phaseName = 'Waxing Crescent';
    } else if (phase < 0.3125) {
      phaseName = 'First Quarter';
    } else if (phase < 0.4375) {
      phaseName = 'Waxing Gibbous';
    } else if (phase < 0.5625) {
      phaseName = 'Full Moon';
    } else if (phase < 0.6875) {
      phaseName = 'Waning Gibbous';
    } else if (phase < 0.8125) {
      phaseName = 'Last Quarter';
    } else if (phase < 0.9375) {
      phaseName = 'Waning Crescent';
    } else {
      phaseName = 'New Moon';
    }

    return { value: phaseName, success: true };
  },
};

/**
 * {{zodiac}} - Current zodiac sign based on date
 */
const zodiacMacro: MacroDefinition = {
  name: 'zodiac',
  aliases: ['starsign', 'sunsign'],
  description: 'Current zodiac sign based on date',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();

    // Zodiac date ranges (approximate)
    const zodiacSigns = [
      { name: 'Capricorn', start: [12, 22], end: [1, 19] },
      { name: 'Aquarius', start: [1, 20], end: [2, 18] },
      { name: 'Pisces', start: [2, 19], end: [3, 20] },
      { name: 'Aries', start: [3, 21], end: [4, 19] },
      { name: 'Taurus', start: [4, 20], end: [5, 20] },
      { name: 'Gemini', start: [5, 21], end: [6, 20] },
      { name: 'Cancer', start: [6, 21], end: [7, 22] },
      { name: 'Leo', start: [7, 23], end: [8, 22] },
      { name: 'Virgo', start: [8, 23], end: [9, 22] },
      { name: 'Libra', start: [9, 23], end: [10, 22] },
      { name: 'Scorpio', start: [10, 23], end: [11, 21] },
      { name: 'Sagittarius', start: [11, 22], end: [12, 21] },
    ];

    for (const sign of zodiacSigns) {
      const [startMonth, startDay] = sign.start;
      const [endMonth, endDay] = sign.end;

      // Handle Capricorn which spans year boundary
      if (startMonth > endMonth) {
        if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
          return { value: sign.name, success: true };
        }
      } else {
        if (
          (month === startMonth && day >= startDay) ||
          (month === endMonth && day <= endDay) ||
          (month > startMonth && month < endMonth)
        ) {
          return { value: sign.name, success: true };
        }
      }
    }

    return { value: 'Unknown', success: true };
  },
};

/**
 * {{year}} - Current year
 */
const yearMacro: MacroDefinition = {
  name: 'year',
  description: 'Current year',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    return { value: now.getFullYear().toString(), success: true };
  },
};

/**
 * {{month}} - Current month name
 */
const monthMacro: MacroDefinition = {
  name: 'month',
  description: 'Current month name',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    const month = now.toLocaleDateString(context.locale || 'en-US', {
      month: 'long',
      timeZone: context.timezone,
    });
    return { value: month, success: true };
  },
};

/**
 * {{day}} - Current day of month
 */
const dayMacro: MacroDefinition = {
  name: 'day',
  description: 'Current day of month',
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const now = getNow(context);
    return { value: now.getDate().toString(), success: true };
  },
};

/**
 * {{datetimeformat::format}} - Custom formatted date/time
 * Format specifiers: YYYY, MM, DD, HH, mm, ss, etc.
 * Example: {{datetimeformat::YYYY-MM-DD HH:mm}}
 */
const datetimeformatMacro: MacroDefinition = {
  name: 'datetimeformat',
  aliases: ['dateformat', 'formatdate', 'formattime'],
  description: 'Custom formatted date/time using format string',
  args: [{ name: 'format', description: 'Format string (YYYY, MM, DD, HH, mm, ss)', required: true }],
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    const format = args[0] || 'YYYY-MM-DD HH:mm:ss';
    const now = getNow(context);
    const tz = context.timezone;
    const locale = context.locale || 'en-US';

    // Extract numeric parts in the correct timezone using Intl.DateTimeFormat
    // so that HH/mm/DD/etc. reflect the target timezone, not the local runtime timezone.
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (type: string): string => parts.find(p => p.type === type)?.value ?? '00';

    const yearFull = get('year');
    const monthNum = get('month');          // '01'..'12', zero-padded
    const dayNum = get('day');             // '01'..'31', zero-padded
    // hour12:false gives '00'..'23'; '24' is returned instead of '00' on some engines — normalise it
    const hourRaw = get('hour') === '24' ? '00' : get('hour');
    const minuteNum = get('minute');
    const secondNum = get('second');

    const hourInt = parseInt(hourRaw, 10);
    const monthInt = parseInt(monthNum, 10);
    const dayInt = parseInt(dayNum, 10);
    const hour12 = (hourInt % 12 || 12).toString();
    const hour12Padded = hour12.padStart(2, '0');

    // Build the token map.  Name-bearing tokens (MMMM, MMM, dddd, ddd) use
    // toLocaleDateString so they honour the locale; numeric tokens come from
    // the Intl parts above so they honour the timezone.
    const tokens: Record<string, string> = {
      'YYYY': yearFull,
      'YY':   yearFull.slice(-2),
      'MMMM': now.toLocaleDateString(locale, { month: 'long',  timeZone: tz }),
      'MMM':  now.toLocaleDateString(locale, { month: 'short', timeZone: tz }),
      'MM':   monthNum,
      'M':    monthInt.toString(),
      'DD':   dayNum,
      'D':    dayInt.toString(),
      'HH':   hourRaw.padStart(2, '0'),
      'H':    hourInt.toString(),
      'hh':   hour12Padded,
      'h':    hour12,
      'mm':   minuteNum,
      'm':    parseInt(minuteNum, 10).toString(),
      'ss':   secondNum,
      's':    parseInt(secondNum, 10).toString(),
      'A':    hourInt >= 12 ? 'PM' : 'AM',
      'a':    hourInt >= 12 ? 'pm' : 'am',
      'dddd': now.toLocaleDateString(locale, { weekday: 'long',  timeZone: tz }),
      'ddd':  now.toLocaleDateString(locale, { weekday: 'short', timeZone: tz }),
    };

    // Replace all tokens in a single pass using a regex that matches the
    // longest token at each position.  This prevents partial-token corruption
    // (e.g. the 'M' token mutating the already-expanded month name "March").
    const tokenPattern = new RegExp(
      // Sort longest-first so the alternation greedily picks the right token.
      Object.keys(tokens)
        .sort((a, b) => b.length - a.length)
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
      'g',
    );
    const result = format.replace(tokenPattern, match => tokens[match] ?? match);

    return { value: result, success: true };
  },
};

/**
 * {{timeDiff::date1::date2}} - Calculate time difference between two dates
 * Returns human-readable duration
 * If date2 is omitted, compares date1 to now
 * Date format: ISO 8601 or Unix timestamp
 */
const timeDiffMacro: MacroDefinition = {
  name: 'timediff',
  aliases: ['datediff', 'duration'],
  description: 'Calculate time difference between two dates',
  args: [
    { name: 'date1', description: 'First date (ISO or timestamp)', required: true },
    { name: 'date2', description: 'Second date (optional, defaults to now)', required: false },
  ],
  category: 'time',
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) {
      return { value: '', success: false, error: 'timeDiff requires at least one date' };
    }

    // Parse date1
    let date1: Date;
    const date1Str = args[0];
    if (/^\d+$/.test(date1Str)) {
      // Unix timestamp (seconds or milliseconds)
      const ts = parseInt(date1Str, 10);
      date1 = new Date(ts > 9999999999 ? ts : ts * 1000);
    } else {
      date1 = new Date(date1Str);
    }

    if (isNaN(date1.getTime())) {
      return { value: '', success: false, error: 'Invalid first date' };
    }

    // Parse date2 (or use now)
    let date2: Date;
    if (args.length >= 2 && args[1]) {
      const date2Str = args[1];
      if (/^\d+$/.test(date2Str)) {
        const ts = parseInt(date2Str, 10);
        date2 = new Date(ts > 9999999999 ? ts : ts * 1000);
      } else {
        date2 = new Date(date2Str);
      }
      if (isNaN(date2.getTime())) {
        return { value: '', success: false, error: 'Invalid second date' };
      }
    } else {
      date2 = getNow(context);
    }

    // Calculate absolute difference in seconds
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    const diffSec = Math.floor(diffMs / 1000);

    // Format as human-readable
    if (diffSec < 60) {
      return { value: `${diffSec} second${diffSec !== 1 ? 's' : ''}`, success: true };
    }
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return { value: `${mins} minute${mins !== 1 ? 's' : ''}`, success: true };
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      if (mins === 0) {
        return { value: `${hours} hour${hours !== 1 ? 's' : ''}`, success: true };
      }
      return { value: `${hours} hour${hours !== 1 ? 's' : ''}, ${mins} minute${mins !== 1 ? 's' : ''}`, success: true };
    }
    if (diffSec < 2592000) { // 30 days
      const days = Math.floor(diffSec / 86400);
      return { value: `${days} day${days !== 1 ? 's' : ''}`, success: true };
    }
    if (diffSec < 31536000) { // 365 days
      const months = Math.floor(diffSec / 2592000);
      return { value: `${months} month${months !== 1 ? 's' : ''}`, success: true };
    }
    const years = Math.floor(diffSec / 31536000);
    return { value: `${years} year${years !== 1 ? 's' : ''}`, success: true };
  },
};

/**
 * Register all time macros
 */
export function registerTimeMacros(): void {
  registerMacros([
    timeMacro,
    dateMacro,
    weekdayMacro,
    isodateMacro,
    isotimeMacro,
    idleDurationMacro,
    seasonMacro,
    moonPhaseMacro,
    zodiacMacro,
    yearMacro,
    monthMacro,
    dayMacro,
    datetimeformatMacro,
    timeDiffMacro,
  ]);
}
