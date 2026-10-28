import catalog from "./leagueCatalog.json" with { type: "json" };

/** Saved league selection. Codes identify leagues; names are display snapshots. */
export interface LeagueEndpoint {
  code: string;
  name: string;
  category?: string;
}

/** Release-controlled source shared by the app and provider transport. */
export const AVAILABLE_LEAGUES: LeagueEndpoint[] = catalog.map(({ code, name, category }) => ({ code, name, category }));

export const LEAGUE_ENDPOINTS: LeagueEndpoint[] = catalog
  .filter(league => league.defaultOrder !== null)
  .sort((a, b) => a.defaultOrder! - b.defaultOrder!)
  .map(({ code, name, category }) => ({ code, name, category }));

export const DEFAULT_SELECTED_LEAGUES: LeagueEndpoint[] = catalog
  .filter(league => league.selectedByDefault)
  .sort((a, b) => a.defaultOrder! - b.defaultOrder!)
  .map(({ code, name, category }) => ({ code, name, category }));

/** Presentation order for geographic tabs; membership comes from the catalog. */
export const LEAGUE_CATEGORIES = [
  "Europe",
  "USA, Mexico & CONCACAF",
  "South America",
  "Internationals",
  "Asia",
  "Africa",
];
