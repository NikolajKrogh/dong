//! Find more logos at: https://brandlogos.net/
import { cleanTeamName } from "./matchUtils";
import { TEAM_ALIASES } from "./teamAliases";

// Map team names to their logo images
export const TEAM_LOGOS: { [key: string]: any } = {
  // Bundesliga
  "1. FC Heidenheim 1846": require("../assets/images/teams/bundesliga/heidenheim.png"),
  "1. FC Union Berlin": require("../assets/images/teams/bundesliga/union-berlin.png"),
  "1. FSV Mainz 05": require("../assets/images/teams/bundesliga/mainz.png"),
  "Bayer 04 Leverkusen": require("../assets/images/teams/bundesliga/leverkusen.png"),
  "Borussia Dortmund": require("../assets/images/teams/bundesliga/dortmund.png"),
  "Borussia Mönchengladbach": require("../assets/images/teams/bundesliga/moenchengladbach.png"),
  "Eintracht Frankfurt": require("../assets/images/teams/bundesliga/frankfurt.png"),
  "FC Augsburg": require("../assets/images/teams/bundesliga/augsburg.png"),
  "FC Bayern München": require("../assets/images/teams/bundesliga/bayern.png"),
  "FC St. Pauli 1910": require("../assets/images/teams/bundesliga/st-pauli.png"),
  "Holstein Kiel": require("../assets/images/teams/bundesliga/holstein-kiel.png"),
  "RB Leipzig": require("../assets/images/teams/bundesliga/redbull-leipzig.png"),
  "SC Freiburg": require("../assets/images/teams/bundesliga/freiburg.png"),
  "SV Werder Bremen": require("../assets/images/teams/bundesliga/bremen.png"),
  "TSG 1899 Hoffenheim": require("../assets/images/teams/bundesliga/hoffenheim.png"),
  "VfB Stuttgart": require("../assets/images/teams/bundesliga/stuttgart.png"),
  "VfL Bochum 1848": require("../assets/images/teams/bundesliga/bochum.png"),
  "VfL Wolfsburg": require("../assets/images/teams/bundesliga/wolfsburg.png"),

  // Premier League
  "AFC Bournemouth": require("../assets/images/teams/premier-league/bournemouth.png"),
  "Arsenal FC": require("../assets/images/teams/premier-league/arsenal.png"),
  "Aston Villa FC": require("../assets/images/teams/premier-league/aston-villa.png"),
  "Brentford FC": require("../assets/images/teams/premier-league/brentford.png"),
  "Brighton & Hove Albion FC": require("../assets/images/teams/premier-league/brighton.png"),
  "Chelsea FC": require("../assets/images/teams/premier-league/chelsea.png"),
  "Crystal Palace FC": require("../assets/images/teams/premier-league/crystal-palace.png"),
  "Everton FC": require("../assets/images/teams/premier-league/everton.png"),
  "Fulham FC": require("../assets/images/teams/premier-league/fulham.png"),
  "Ipswich Town FC": require("../assets/images/teams/premier-league/ipswich.png"),
  "Leicester City FC": require("../assets/images/teams/premier-league/leicester-city.png"),
  "Liverpool FC": require("../assets/images/teams/premier-league/liverpool.png"),
  "Manchester City FC": require("../assets/images/teams/premier-league/manchester-city.png"),
  "Manchester United FC": require("../assets/images/teams/premier-league/manchester-united.png"),
  "Newcastle United FC": require("../assets/images/teams/premier-league/newcastle-united.png"),
  "Nottingham Forest FC": require("../assets/images/teams/premier-league/nottingham-forest.png"),
  "Southampton FC": require("../assets/images/teams/premier-league/southampton.png"),
  "Tottenham Hotspur FC": require("../assets/images/teams/premier-league/tottenham-hotspur.png"),
  "West Ham United FC": require("../assets/images/teams/premier-league/west-ham-united.png"),
  "Wolverhampton Wanderers FC": require("../assets/images/teams/premier-league/wolves.png"),

  "Blackburn Rovers FC": require("../assets/images/teams/championship/blackburn.png"),
  "Bristol City FC": require("../assets/images/teams/championship/bristol-city.png"),
  "Burnley FC": require("../assets/images/teams/championship/burnley.png"),
  "Cardiff City FC": require("../assets/images/teams/championship/cardiff-city.png"),
  "Coventry City FC": require("../assets/images/teams/championship/coventry-city.png"),
  "Derby County FC": require("../assets/images/teams/championship/derby-county.png"),
  "Hull City AFC": require("../assets/images/teams/championship/hull-city.png"),
  "Leeds United FC": require("../assets/images/teams/championship/leeds.png"),
  "Luton Town FC": require("../assets/images/teams/championship/luton.png"),
  "Middlesbrough FC": require("../assets/images/teams/championship/middlesbrough.png"),
  "Millwall FC": require("../assets/images/teams/championship/millwall.png"),
  "Norwich City FC": require("../assets/images/teams/championship/norwich-city.png"),
  "Oxford United FC": require("../assets/images/teams/championship/oxford-united.png"),
  "Plymouth Argyle FC": require("../assets/images/teams/championship/plymouth.png"),
  "Portsmouth FC": require("../assets/images/teams/championship/portsmouth.png"),
  "Preston North End FC": require("../assets/images/teams/championship/preston.png"),
  "Queens Park Rangers FC": require("../assets/images/teams/championship/qpr.png"),
  "Sheffield United FC": require("../assets/images/teams/championship/sheffield-united.png"),
  "Sheffield Wednesday FC": require("../assets/images/teams/championship/sheffield-wednesday.png"),
  "Stoke City FC": require("../assets/images/teams/championship/stoke-city.png"),
  "Sunderland AFC": require("../assets/images/teams/championship/sunderland.png"),
  "Swansea City AFC": require("../assets/images/teams/championship/swansea-city.png"),
  "Watford FC": require("../assets/images/teams/championship/watford.png"),
  "West Bromwich Albion FC": require("../assets/images/teams/championship/west-bromwich-albion.png"),

  // Serie A
  "AC Milan": require("../assets/images/teams/serie-a/milan.png"),
  "AC Monza": require("../assets/images/teams/serie-a/monza.png"),
  "ACF Fiorentina": require("../assets/images/teams/serie-a/fiorentina.png"),
  "AS Roma": require("../assets/images/teams/serie-a/roma.png"),
  "Atalanta BC": require("../assets/images/teams/serie-a/atalanta.png"),
  "Bologna FC 1909": require("../assets/images/teams/serie-a/bologna.png"),
  "Cagliari Calcio": require("../assets/images/teams/serie-a/cagliari.png"),
  "Como 1907": require("../assets/images/teams/serie-a/como.png"),
  "Empoli FC": require("../assets/images/teams/serie-a/empoli.png"),
  "FC Internazionale Milano": require("../assets/images/teams/serie-a/inter.png"),
  "Genoa CFC": require("../assets/images/teams/serie-a/genoa.png"),
  "Hellas Verona FC": require("../assets/images/teams/serie-a/hellas-verona.png"),
  "Juventus FC": require("../assets/images/teams/serie-a/juventus.png"),
  "Parma Calcio 1913": require("../assets/images/teams/serie-a/parma.png"),
  "SS Lazio": require("../assets/images/teams/serie-a/lazio.png"),
  "SSC Napoli": require("../assets/images/teams/serie-a/napoli.png"),
  "Torino FC": require("../assets/images/teams/serie-a/torino.png"),
  "US Lecce": require("../assets/images/teams/serie-a/lecce.png"),
  "Udinese Calcio": require("../assets/images/teams/serie-a/udinese.png"),
  "Venezia FC": require("../assets/images/teams/serie-a/venezia.png"),

  // Ligue 1
  "AJ Auxerre": require("../assets/images/teams/ligue-1/auxerre.png"),
  "AS Monaco FC": require("../assets/images/teams/ligue-1/monaco.png"),
  "AS Saint-Étienne": require("../assets/images/teams/ligue-1/saint-etienne.png"),
  "Angers SCO": require("../assets/images/teams/ligue-1/angers-sco.png"),
  "FC Nantes": require("../assets/images/teams/ligue-1/nantes.png"),
  "Le Havre AC": require("../assets/images/teams/ligue-1/havre.png"),
  "Lille OSC": require("../assets/images/teams/ligue-1/lille.png"),
  "Montpellier HSC": require("../assets/images/teams/ligue-1/montpellier-herault.png"),
  "OGC Nice": require("../assets/images/teams/ligue-1/nice.png"),
  "Olympique Lyonnais": require("../assets/images/teams/ligue-1/lyon.png"),
  "Olympique de Marseille": require("../assets/images/teams/ligue-1/marseille.png"),
  "Paris Saint-Germain FC": require("../assets/images/teams/ligue-1/psg.png"),
  "RC Strasbourg Alsace": require("../assets/images/teams/ligue-1/strasbourg.png"),
  "Racing Club de Lens": require("../assets/images/teams/ligue-1/lens.png"),
  "Stade Brestois 29": require("../assets/images/teams/ligue-1/brest.png"),
  "Stade Rennais FC 1901": require("../assets/images/teams/ligue-1/rennes.png"),
  "Stade de Reims": require("../assets/images/teams/ligue-1/reims.png"),
  "Toulouse FC": require("../assets/images/teams/ligue-1/toulouse.png"),

  // La Liga
  "Athletic Club": require("../assets/images/teams/la-liga/athletic.png"),
  "CA Osasuna": require("../assets/images/teams/la-liga/osasuna.png"),
  "CD Leganés": require("../assets/images/teams/la-liga/leganes.png"),
  "Club Atlético de Madrid": require("../assets/images/teams/la-liga/atletico-madrid.png"),
  "Deportivo Alavés": require("../assets/images/teams/la-liga/alaves.png"),
  "FC Barcelona": require("../assets/images/teams/la-liga/barcelona.png"),
  "Getafe CF": require("../assets/images/teams/la-liga/getafe.png"),
  "Girona FC": require("../assets/images/teams/la-liga/girona.png"),
  "RC Celta de Vigo": require("../assets/images/teams/la-liga/celta.png"),
  "RCD Espanyol de Barcelona": require("../assets/images/teams/la-liga/espanyol.png"),
  "RCD Mallorca": require("../assets/images/teams/la-liga/mallorca.png"),
  "Rayo Vallecano de Madrid": require("../assets/images/teams/la-liga/rayo-vallecano.png"),
  "Real Betis Balompié": require("../assets/images/teams/la-liga/real-betis.png"),
  "Real Madrid CF": require("../assets/images/teams/la-liga/real-madrid.png"),
  "Real Sociedad de Fútbol": require("../assets/images/teams/la-liga/real-sociedad.png"),
  "Real Valladolid CF": require("../assets/images/teams/la-liga/real-valladolid.png"),
  "Sevilla FC": require("../assets/images/teams/la-liga/sevilla.png"),
  "UD Las Palmas": require("../assets/images/teams/la-liga/las-palmas.png"),
  "Valencia CF": require("../assets/images/teams/la-liga/valencia.png"),
  "Villarreal CF": require("../assets/images/teams/la-liga/villarreal.png"),
};

// Expanded mapping for cleaned team names to official names
const CLEANED_NAME_MAPPING: { [key: string]: string } = {
  // Automatically generate this from your TEAM_LOGOS keys
};

// Initialize the CLEANED_NAME_MAPPING
Object.keys(TEAM_LOGOS).forEach((officialName) => {
  const cleanedName = cleanTeamName(officialName);
  if (cleanedName !== officialName) {
    CLEANED_NAME_MAPPING[cleanedName] = officialName;
  }
});

// Create normalized lookup maps for faster case-insensitive matching
const NORMALIZED_LOGOS: { [key: string]: any } = {};
const NORMALIZED_ALIASES: { [key: string]: string } = {};
const NORMALIZED_CLEANED_MAPPING: { [key: string]: string } = {};

// Initialize the normalized maps
Object.entries(TEAM_LOGOS).forEach(([key, value]) => {
  NORMALIZED_LOGOS[key.toLowerCase()] = value;
});

Object.entries(TEAM_ALIASES).forEach(([alias, team]) => {
  NORMALIZED_ALIASES[alias.toLowerCase()] = team;
});

Object.entries(CLEANED_NAME_MAPPING).forEach(([cleaned, official]) => {
  NORMALIZED_CLEANED_MAPPING[cleaned.toLowerCase()] = official;
});

// Helper function to get team logo by name
export const getTeamLogo = (teamName: string) => {
  return TEAM_LOGOS[teamName] || null;
};

// Get team logo with case-insensitive matching
export const getTeamLogoWithFallback = (teamName: string) => {
  // Normalize the input name
  const normalizedName = teamName.trim();
  const lowerCaseName = normalizedName.toLowerCase();

  // Try direct match first
  if (NORMALIZED_LOGOS[lowerCaseName]) {
    return NORMALIZED_LOGOS[lowerCaseName];
  }

  // Check for aliases
  const aliasedTeam = NORMALIZED_ALIASES[lowerCaseName];
  if (aliasedTeam && TEAM_LOGOS[aliasedTeam]) {
    return TEAM_LOGOS[aliasedTeam];
  }

  // Check if this is a cleaned name
  const cleanedName = cleanTeamName(normalizedName).toLowerCase();
  if (NORMALIZED_LOGOS[cleanedName]) {
    return NORMALIZED_LOGOS[cleanedName];
  }

  // Check the mapping of cleaned names to official names
  const officialFromCleaned = NORMALIZED_CLEANED_MAPPING[cleanedName];
  if (officialFromCleaned && TEAM_LOGOS[officialFromCleaned]) {
    return TEAM_LOGOS[officialFromCleaned];
  }

  // Partial match as a last resort
  for (const [lowercaseKey, logo] of Object.entries(NORMALIZED_LOGOS)) {
    if (
      lowercaseKey.includes(lowerCaseName) ||
      lowerCaseName.includes(lowercaseKey)
    ) {
      return logo;
    }
  }

  // No match found
  return null;
};
