/**
 * @brief Interface for ESPN API response data.
 */
export interface ESPNResponse {
  leagues?: Array<{
    id: string;
    uid?: string;
    name: string;
    abbreviation: string;
    slug?: string;
    midsizeName?: string;
    logos?: Array<{
      href: string;
      width: number;
      height: number;
      alt: string;
      rel: string[];
      lastUpdated?: string;
    }>;
  }>;
  events: Array<ESPNEvent>;
}

/**
 * @brief Interface for ESPN API event data.
 */
export interface ESPNEvent {
  id: string;
  uid?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: Array<ESPNCompetition>;
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
 * @brief Interface for ESPN API competition data.
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
  competitors?: Array<ESPNCompetitor>;
  details?: Array<ESPNCompetitionDetail>;
}

/**
 * @brief Interface for ESPN API competition details.
 */
export interface ESPNCompetitionDetail {
  yellowCard?: boolean;
  redCard?: boolean;
  team?: {
    id: string;
    name?: string;
  };
  scoringPlay?: boolean;
  athletesInvolved?: Array<{
    displayName?: string;
    shortName?: string;
  }>;
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
 * @brief Interface for ESPN API statistic data.
 */
export interface ESPNStatistic {
  name?: string;
  displayValue?: string;
  value?: number;
}

/**
 * @brief Interface for ESPN API competitor data.
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
