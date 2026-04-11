/**
 * ESPN API root response.
 * @description Top-level shape containing leagues metadata and event entries.
 */
export interface ESPNResponse {
  leagues?: {
    id: string;
    uid?: string;
    name: string;
    abbreviation: string;
    slug?: string;
    midsizeName?: string;
    logos?: {
      href: string;
      width: number;
      height: number;
      alt: string;
      rel: string[];
      lastUpdated?: string;
    }[];
  }[];
  events: ESPNEvent[];
}

/**
 * ESPN event object.
 * @description Represents a single scheduled or live match event including competitions and status.
 */
export interface ESPNEvent {
  id: string;
  uid?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: ESPNCompetition[];
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      description?: string;
      shortDetail?: string;
    };
    displayClock?: string;
  };
  venue?: {
    id?: string;
    fullName?: string;
    displayName?: string;
  };
}

/**
 * ESPN competition wrapper.
 * @description Contains competitors, status and detail records for a given event instance.
 */
export interface ESPNCompetition {
  id?: string;
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      description?: string;
    };
  };
  competitors?: ESPNCompetitor[];
  details?: ESPNCompetitionDetail[];
}

/**
 * ESPN competition detail.
 * @description Fine-grained event occurrences (cards, goals) with involved athletes and type info.
 */
export interface ESPNCompetitionDetail {
  yellowCard?: boolean;
  redCard?: boolean;
  team?: {
    id: string;
    name?: string;
  };
  scoringPlay?: boolean;
  athletesInvolved?: {
    displayName?: string;
    shortName?: string;
  }[];
  clock?: {
    displayValue?: string;
  };
  penaltyKick?: boolean;
  ownGoal?: boolean;
  type?: {
    text?: string;
  };
}

/**
 * ESPN statistic entry.
 * @description Single stat name/value pair sometimes with display formatting.
 */
export interface ESPNStatistic {
  name?: string;
  displayValue?: string;
  value?: number;
}

/**
 * ESPN competitor entity.
 * @description Team participant in a competition with score and statistics.
 */
export interface ESPNCompetitor {
  id?: string;
  homeAway?: string;
  score?: string;
  statistics?: ESPNStatistic[];
  team?: {
    id?: string;
    name?: string;
    displayName?: string;
    logo?: string;
    abbreviation?: string;
    shortDisplayName?: string;
    location?: string;
    color?: string;
    alternateColor?: string;
    isActive?: boolean;
  };
}
