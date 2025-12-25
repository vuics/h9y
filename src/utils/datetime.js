import {
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
} from 'date-fns'

// Map interval type to corresponding date-fns function
const intervalMap = {
  minute: addMinutes,
  hour: addHours,
  day: addDays,
  week: addWeeks,
  month: addMonths,
  quarter: addQuarters,
  year: addYears,
};

// Usage example:
//   const now = new Date();
//   console.log(addInterval(now, 'day', 5));    // adds 5 days
//   console.log(addInterval(now, 'week', 2));   // adds 2 weeks
//   console.log(addInterval(now, 'month', 1));  // adds 1 month
//   console.log(addInterval(now, 'year', 3));   // adds 3 years
export function addInterval(date, intervalType, amount = 1) {
  const addFn = intervalMap[intervalType];
  if (!addFn) throw new Error(`Unsupported interval type: ${intervalType}`);
  return addFn(date, amount);
}

const DELTA_SYMBOL_MAP = {
  '1m':  { type: 'minute', amount: 1 },
  '1h':  { type: 'hour', amount: 1 },
  '12h': { type: 'hour', amount: 12 },
  '1d':  { type: 'day', amount: 1 },
  '1w':  { type: 'week', amount: 1 },
  '1mo': { type: 'month', amount: 1 }, // calendar month ✅
};

export function offsetTime(timeAt, deltaSymbol) {
  if (!timeAt || !deltaSymbol) return null;

  let date;
  if (typeof timeAt === 'string') {
    date = new Date(timeAt); // ISO-8601 → UTC-safe
  } else if (timeAt instanceof Date) {
    date = timeAt;
  } else {
    throw new Error('Invalid timeAt');
  }

  const delta = DELTA_SYMBOL_MAP[deltaSymbol];
  if (!delta) {
    throw new Error(`Unknown deltaSymbol: ${deltaSymbol}`);
  }

  return addInterval(date, delta.type, delta.amount);
}
