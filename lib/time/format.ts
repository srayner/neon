export type TimeZoneMode = 'utc' | 'local';

/**
 * "24 Nov, 14:02 UTC", or in the browser's own zone with its name
 * ("24 Nov, 14:02 GMT+1"). Times are stored in UTC; this only displays them.
 */
export function formatTimestamp(date: Date, mode: TimeZoneMode, timeZone?: string): string {
  const zone = mode === 'utc' ? 'UTC' : timeZone;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month')}, ${part('hour')}:${part('minute')} ${part('timeZoneName')}`;
}
