import test from 'node:test';
import assert from 'node:assert/strict';
import { clipTimelineRange, stackTimelineJobs, timelineWindow, anchoredTimelineScroll, clampTimelineZoom } from '../lib/dispatch-timeline.ts';
const iso = hour => `2030-01-01T${String(hour).padStart(2, '0')}:00:00Z`;
test('overlapping unassigned jobs stack, while adjacent jobs reuse a lane', () => {
  const result = stackTimelineJobs([{ id: 1, jobStartDateTime: iso(8), jobEndDateTime: iso(10) }, { id: 2, jobStartDateTime: iso(9), jobEndDateTime: iso(11) }, { id: 3, jobStartDateTime: iso(10), jobEndDateTime: iso(12) }]);
  assert.deepEqual(result.map(r => r.lane), [0, 1, 0]);
});
test('overnight jobs clip to the start of the visible date without extending their duration', () => {
  assert.deepEqual(clipTimelineRange('2029-12-31T23:00Z', iso(2), Date.parse(iso(0)), 1440, 1), { left: 0, width: 120 });
});
test('jobs extending past the visible date clip to the right edge', () => {
  assert.deepEqual(clipTimelineRange(iso(23), '2030-01-02T02:00Z', Date.parse(iso(0)), 1440, 1), { left: 1380, width: 60 });
});
test('weekly and daily coordinates use the same scale supplied by the board', () => {
  assert.deepEqual(clipTimelineRange(iso(8), iso(10), Date.parse(iso(0)), 10080 * 0.3, 0.3), { left: 144, width: 36 });
});
test('empty pool produces no synthetic jobs', () => assert.deepEqual(stackTimelineJobs([]), []));

test('pinch zoom keeps the time under the pointer in the same screen position', () => {
  const scroll = anchoredTimelineScroll(600, 520, 220, 1, 2);
  assert.equal(scroll, 1500);
  assert.equal((600 + 520 - 220) / 1, (scroll + 520 - 220) / 2);
  assert.equal(anchoredTimelineScroll(scroll, 520, 220, 2, 1), 600);
});
test('zoom limits and scrolling never exceed the left boundary', () => {
  assert.equal(clampTimelineZoom(0.1), 0.5);
  assert.equal(clampTimelineZoom(12), 4);
  assert.equal(clampTimelineZoom(0.1, 0.2, 5), 0.2);
  assert.equal(clampTimelineZoom(6, 0.2, 5), 5);
  assert.equal(clampTimelineZoom(1.5, 0.2, 5), 1.5);
  assert.equal(anchoredTimelineScroll(0, 500, 220, 1, 0.5), 0);
});

test('legacy board responses still produce a Sydney time axis and correctly positioned jobs', () => {
  const window = timelineWindow('2026-09-28', false, 'Australia/Sydney');
  assert.equal(new Date(window.start).toISOString(), '2026-09-27T14:00:00.000Z');
  assert.equal(window.end - window.start, 24 * 3600000);
  assert.deepEqual(clipTimelineRange('2026-09-28T09:00Z', '2026-09-28T10:30Z', window.start, 2160, 1.5), { left: 1710, width: 135 });
});
test('fallback axis respects short and long Sydney daylight-saving days', () => {
  for (const [date, hours] of [['2026-10-04', 23], ['2026-04-05', 25]]) {
    const window = timelineWindow(date, false, 'Australia/Sydney', 'invalid', 'invalid');
    assert.equal(window.end - window.start, hours * 3600000);
  }
});
test('weekly fallback starts on Monday and preserves the DST transition', () => {
  const window = timelineWindow('2026-10-04', true, 'Australia/Sydney');
  assert.equal(new Date(window.start).toISOString(), '2026-09-27T14:00:00.000Z');
  assert.equal(new Date(window.end).toISOString(), '2026-10-04T13:00:00.000Z');
});
test('valid server windows remain authoritative', () => {
  assert.deepEqual(timelineWindow('2026-09-28', false, 'Australia/Sydney', iso(0), iso(23)), { start: Date.parse(iso(0)), end: Date.parse(iso(23)) });
});
