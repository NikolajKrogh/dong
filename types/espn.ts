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
  details?: Array<{
    scoringPlay?: boolean;
    team?: {
      id: string;
      name?: string;
    };
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
  }>;
}

/**
 * @brief Interface for ESPN API competitor data.
 */
export interface ESPNCompetitor {
  id?: string;
  homeAway?: string;
  score?: string;
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
