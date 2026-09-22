import { Subtitle, VideoSection } from '../types';

// Cutting a video into practice-sized chunks. Lives on its own because both the
// practice page (which practises a section) and the home shelf (which shows
// "part 3 of 12") have to arrive at the exact same sections, or the card lies.
// A line belongs to the section its start time falls in, so no sentence is ever
// split; empty windows are dropped, which is why the count is not just
// duration / length.
export const buildSections = (subtitles: Subtitle[], sectionLength: number): VideoSection[] => {
  if (subtitles.length === 0) return [];

  const lastTime = subtitles[subtitles.length - 1].endTime;

  if (sectionLength <= 0) {
    return [{ id: 1, label: 'Full Video', startTime: 0, endTime: lastTime + 10, subtitleIndices: [], subtitles }];
  }

  const duration = sectionLength * 60;
  const sections: VideoSection[] = [];
  let start = 0;
  let id = 1;

  // `|| id === 1` so a video whose lines all sit at time 0 (a malformed SRT)
  // still yields one section rather than none, which the caller would deref.
  while (start < lastTime || id === 1) {
    const end = start + duration;
    const subs = subtitles.filter(s => s.startTime >= start && s.startTime < end);
    if (subs.length > 0 || id === 1) {
      sections.push({ id, label: `Section ${id}`, startTime: start, endTime: end, subtitleIndices: [], subtitles: subs });
    }
    start = end;
    id++;
  }

  return sections;
};
