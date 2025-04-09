/**
 * @brief Interface for ESPN API response data.
 */
export interface ESPNResponse {
  leagues?: Array<{
    id: string;
    uid: string;
    name: string;
    abbreviation: string;
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
  };
}
