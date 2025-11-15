const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatRelativeTimestamp = (timestamp: number): string => {
  const delta = timestamp - Date.now();
  if (Math.abs(delta) < MINUTE) {
    return 'just now';
  }
  if (Math.abs(delta) < HOUR) {
    return rtf.format(Math.round(delta / MINUTE), 'minute');
  }
  if (Math.abs(delta) < DAY) {
    return rtf.format(Math.round(delta / HOUR), 'hour');
  }
  if (Math.abs(delta) < WEEK) {
    return rtf.format(Math.round(delta / DAY), 'day');
  }
  return rtf.format(Math.round(delta / WEEK), 'week');
};
