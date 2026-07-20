// Re-exported for backward compatibility with existing import paths (e.g.
// components/setupGame/MatchList.tsx). The useTeamFiltering hook that used
// to live in this file had no production consumers and was removed; this
// file's canonical implementation now lives in utils/matchUtils.ts.
export { filterMatchesByDateAndTime } from "../utils/matchUtils";
