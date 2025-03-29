import { cleanTeamName } from "./matchUtils";

// Map team names to their logo images
export const TEAM_LOGOS: { [key: string]: any } = {
  // Bundesliga
  "1. FC Heidenheim 1846": require("../assets/images/teams/bundesliga/heidenheim.png"),
  "1. FC Union Berlin": require("../assets/images/teams/bundesliga/hertha-bsc-berlin.png"),
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

// "Blackburn Rovers FC": require("../assets/images/teams/championship/blackburn-rovers-fc.png"),
  // "Bristol City FC": require("../assets/images/teams/championship/bristol-city.png"),
  // "Burnley FC": require("../assets/images/teams/championship/burnley-fc.png"),
  // "Cardiff City FC": require("../assets/images/teams/championship/cardiff-city-fc.png"),
  // "Coventry City FC": require("../assets/images/teams/championship/coventry-city-fc.png"),
  // "Derby County FC": require("../assets/images/teams/championship/derby-county-fc.png"),
  // "Hull City AFC": require("../assets/images/teams/championship/hull-city-afc.png"),
  // "Leeds United FC": require("../assets/images/teams/championship/leeds-united-fc.png"),
  // "Luton Town FC": require("../assets/images/teams/championship/luton-town-fc.png"),
  // "Middlesbrough FC": require("../assets/images/teams/championship/middlesbrough-fc.png"),
  // "Millwall FC": require("../assets/images/teams/championship/millwall-fc.png"),
  // "Norwich City FC": require("../assets/images/teams/championship/norwich-city-fc.png"),
  // "Oxford United FC": require("../assets/images/teams/championship/oxford-united-fc.png"),
  // "Plymouth Argyle FC": require("../assets/images/teams/championship/plymouth-argyle-fc.png"),
  // "Portsmouth FC": require("../assets/images/teams/championship/portsmouth-fc.png"),
  // "Preston North End FC": require("../assets/images/teams/championship/preston-north-end-fc.png"),
  // "Queens Park Rangers FC": require("../assets/images/teams/championship/queens-park-rangers-fc.png"),
  // "Sheffield United FC": require("../assets/images/teams/championship/sheffield-united-fc.png"),
  // "Sheffield Wednesday FC": require("../assets/images/teams/championship/sheffield-wednesday-fc.png"),
  // "Stoke City FC": require("../assets/images/teams/championship/stoke-city-fc.png"),
  // "Sunderland AFC": require("../assets/images/teams/championship/sunderland-afc.png"),
  // "Swansea City AFC": require("../assets/images/teams/championship/swansea-city-afc.png"),
  // "Watford FC": require("../assets/images/teams/championship/watford-fc.png"),
  // "West Bromwich Albion FC": require("../assets/images/teams/championship/west-bromwich-albion-fc.png"),

  // Serie A
  "AC Milan": require("../assets/images/teams/serie-a/ac-milan.png"),
  // "AC Monza": require("../assets/images/teams/serie-a/ac-monza.png"),
  "ACF Fiorentina": require("../assets/images/teams/serie-a/fiorentina.png"),
  "AS Roma": require("../assets/images/teams/serie-a/roma.png"),
  "Atalanta BC": require("../assets/images/teams/serie-a/atalanta.png"),
  "Bologna FC 1909": require("../assets/images/teams/serie-a/bologna.png"),
  "Cagliari Calcio": require("../assets/images/teams/serie-a/cagliari.png"),
  // "Como 1907": require("../assets/images/teams/serie-a/como.png"),
  "Empoli FC": require("../assets/images/teams/serie-a/empoli.png"),
  // "FC Internazionale Milano": require("../assets/images/teams/serie-a/inter.png"),
  // "Genoa CFC": require("../assets/images/teams/serie-a/genoa.png"),
  "Hellas Verona FC": require("../assets/images/teams/serie-a/hellas-verona.png"),
  "Juventus FC": require("../assets/images/teams/serie-a/juventus.png"),
  // "Parma Calcio 1913": require("../assets/images/teams/serie-a/parma-calcio.png"),
  "SS Lazio": require("../assets/images/teams/serie-a/lazio.png"),
  "SSC Napoli": require("../assets/images/teams/serie-a/napoli.png"),
  // "Torino FC": require("../assets/images/teams/serie-a/torino.png"),
  // "US Lecce": require("../assets/images/teams/serie-a/lecce.png"),
  // "Udinese Calcio": require("../assets/images/teams/serie-a/udinese.png"),
  // "Venezia FC": require("../assets/images/teams/serie-a/venezia.png"),
  
  // Ligue 1
  // "AJ Auxerre": require("../assets/images/teams/ligue-1/aj-auxerre.png"),
  "AS Monaco FC": require("../assets/images/teams/ligue-1/as-monaco.png"),
  "AS Saint-Étienne": require("../assets/images/teams/ligue-1/as-saint-etienne.png"),
  "Angers SCO": require("../assets/images/teams/ligue-1/angers-sco.png"),
  "FC Nantes": require("../assets/images/teams/ligue-1/fc-nantes.png"),
  // "Le Havre AC": require("../assets/images/teams/ligue-1/le-havre-ac.png"),
  "Lille OSC": require("../assets/images/teams/ligue-1/losc-lille.png"),
  "Montpellier HSC": require("../assets/images/teams/ligue-1/montpellier-herault.png"),
  // "OGC Nice": require("../assets/images/teams/ligue-1/ogc-nice.png"),
  "Olympique Lyonnais": require("../assets/images/teams/ligue-1/olympique-lyonnais.png"),
  "Olympique de Marseille": require("../assets/images/teams/ligue-1/olympique-de-marseille.png"),
  "Paris Saint-Germain FC": require("../assets/images/teams/ligue-1/paris-saint-germain.png"),
  // "RC Strasbourg Alsace": require("../assets/images/teams/ligue-1/rc-strasbourg-alsace.png"),
  "Racing Club de Lens": require("../assets/images/teams/ligue-1/rc-lens.png"),
  "Stade Brestois 29": require("../assets/images/teams/ligue-1/stade-brestois-29.png"),
  "Stade Rennais FC 1901": require("../assets/images/teams/ligue-1/stade-rennais-fc.png"),
  "Stade de Reims": require("../assets/images/teams/ligue-1/stade-de-reims.png"),
  // "Toulouse FC": require("../assets/images/teams/ligue-1/toulouse.png"),
  
  // La Liga
  // "Athletic Club": require("../assets/images/teams/la-liga/athletic.png"),
  // "CA Osasuna": require("../assets/images/teams/la-liga/osasuna.png"),
  // "CD Leganés": require("../assets/images/teams/la-liga/leganes.png"),
  "Club Atlético de Madrid": require("../assets/images/teams/la-liga/atletico-madrid.png"),
  // "Deportivo Alavés": require("../assets/images/teams/la-liga/deportivo-alavez"),
  "FC Barcelona": require("../assets/images/teams/la-liga/barcelona.png"),
  "Getafe CF": require("../assets/images/teams/la-liga/getafe.png"),
  // "Girona FC": require("../assets/images/teams/la-liga/girona.png"),
  "RC Celta de Vigo": require("../assets/images/teams/la-liga/celta.png"),
  "RCD Espanyol de Barcelona": require("../assets/images/teams/la-liga/espanyol.png"),
  // "RCD Mallorca": require("../assets/images/teams/la-liga/mallorca.png"),
  "Rayo Vallecano de Madrid": require("../assets/images/teams/la-liga/rayo-vallecano.png"),
  "Real Betis Balompié": require("../assets/images/teams/la-liga/real-betis.png"),
  "Real Madrid CF": require("../assets/images/teams/la-liga/real-madrid.png"),
  "Real Sociedad de Fútbol": require("../assets/images/teams/la-liga/real-sociedad.png"),
  // "Real Valladolid CF": require("../assets/images/teams/la-liga/real-valladolid.png"),
  "Sevilla FC": require("../assets/images/teams/la-liga/sevilla.png"),
  // "UD Las Palmas": require("../assets/images/teams/la-liga/las-palmas.png"),
  "Valencia CF": require("../assets/images/teams/la-liga/valencia.png"),
  "Villarreal CF": require("../assets/images/teams/la-liga/villarreal.png"),
};

// Map alternative team names to standard names
const TEAM_NAME_ALIASES: { [key: string]: string } = {
  "Bayern Munich": "FC Bayern München",
  Bayern: "FC Bayern München",
  Dortmund: "Borussia Dortmund",
  BVB: "Borussia Dortmund",
  Leverkusen: "Bayer 04 Leverkusen",
  Heidenheim: "1. FC Heidenheim 1846",
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

// Helper function to get team logo by name
export const getTeamLogo = (teamName: string) => {
  return TEAM_LOGOS[teamName] || null;
};

// Get team logo with enhanced fallbacks
export const getTeamLogoWithFallback = (teamName: string) => {
  // Try direct match first
  const directLogo = TEAM_LOGOS[teamName];
  if (directLogo) return directLogo;

  // Check for aliases
  const standardizedName = TEAM_NAME_ALIASES[teamName];
  if (standardizedName && TEAM_LOGOS[standardizedName]) {
    return TEAM_LOGOS[standardizedName];
  }

  // Check if this is a cleaned name
  const cleanedName = cleanTeamName(teamName);
  if (cleanedName !== teamName && TEAM_LOGOS[cleanedName]) {
    return TEAM_LOGOS[cleanedName];
  }

  // Check the mapping of cleaned names to official names
  const officialFromCleaned = CLEANED_NAME_MAPPING[cleanedName];
  if (officialFromCleaned && TEAM_LOGOS[officialFromCleaned]) {
    return TEAM_LOGOS[officialFromCleaned];
  }

  // As a last resort, try to find any team that ends with this name
  for (const key of Object.keys(TEAM_LOGOS)) {
    if (key.endsWith(teamName) || key.includes(teamName)) {
      return TEAM_LOGOS[key];
    }
  }

  // No match found
  return null;
};
