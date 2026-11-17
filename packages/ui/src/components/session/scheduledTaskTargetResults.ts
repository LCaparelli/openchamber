import type { Session } from '@/lib/opencode/model';
import { rankByQuery } from '@/lib/search/fuzzySearch';
import { isOperatorChildSession } from '@/lib/sessionOperatorChild';
import { isReviewSession } from '@/lib/sessionReviewMetadata';

export const SCHEDULED_TASK_TARGET_LIMIT = 100;

export type ScheduledTaskTargetRow = {
  id: string;
  title: string;
  subagent: boolean;
  parentTitle: string | null;
};

type ScheduledTaskTargetResults = {
  selected: ScheduledTaskTargetRow | null;
  rows: ScheduledTaskTargetRow[];
  more: boolean;
};

export const scheduledTaskTargetCandidates = (cached: readonly Session[], live: readonly Session[]): Session[] => {
  const merged = new Map(cached.map((session) => [session.id, session]));
  for (const session of live) if (!merged.has(session.id)) merged.set(session.id, session);
  return [...merged.values()].filter((session) => !session.time?.archived);
};

const isRoot = (session: Session): boolean => !session.parentID || isReviewSession(session);

const titleOf = (session: Session): string => session.title.trim() || session.id;

const toRow = (session: Session, byId: ReadonlyMap<string, Session>): ScheduledTaskTargetRow => {
  if (isRoot(session)) return { id: session.id, title: titleOf(session), subagent: false, parentTitle: null };
  const parent = session.parentID ? byId.get(session.parentID) : undefined;
  return { id: session.id, title: titleOf(session), subagent: true, parentTitle: parent ? titleOf(parent) : null };
};

const findMatches = (sessions: readonly Session[], query: string) => {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.startsWith('ses_')) return { matches: sessions.filter((session) => session.id.toLowerCase() === trimmed), hiddenSubagents: false };
  const roots = sessions.filter(isRoot);
  if (!trimmed) return { matches: roots, hiddenSubagents: roots.length < sessions.length };
  const byTitle = (session: Session) => [titleOf(session)];
  const subagents = sessions.filter((session) => !isRoot(session));
  return {
    matches: [...rankByQuery(roots, query, byTitle, { fuzzy: false }), ...rankByQuery(subagents, query, byTitle, { fuzzy: false })],
    hiddenSubagents: false,
  };
};

export const scheduledTaskTargetResults = ({ eligible, known, query, selectedId, compare }: {
  eligible: readonly Session[];
  known: readonly Session[];
  query: string;
  selectedId: string;
  compare: (left: Session, right: Session) => number;
}): ScheduledTaskTargetResults => {
  const byId = new Map(known.map((session) => [session.id, session]));
  const searching = query.trim().length > 0;
  const pinSelected = Boolean(selectedId) && !searching;
  const listed = eligible
    .filter((session) => !isOperatorChildSession(session) && !(pinSelected && session.id === selectedId))
    .sort(compare);
  const { matches, hiddenSubagents } = findMatches(listed, query);
  const selectedSession = pinSelected ? byId.get(selectedId) : undefined;
  return {
    selected: !pinSelected ? null : selectedSession ? toRow(selectedSession, byId) : { id: selectedId, title: selectedId, subagent: false, parentTitle: null },
    rows: matches.slice(0, SCHEDULED_TASK_TARGET_LIMIT).map((session) => toRow(session, byId)),
    more: hiddenSubagents || matches.length > SCHEDULED_TASK_TARGET_LIMIT,
  };
};
