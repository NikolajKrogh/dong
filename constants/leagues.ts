/**
 * @brief League information for API endpoints
 */
export interface LeagueEndpoint {
  code: string;
  name: string;
  category?: string; // New property for categorization
}

/**
 * @brief Categories for organizing leagues
 */
export const LEAGUE_CATEGORIES = [
  "Europe",
  "USA, Mexico & CONCACAF",
  "South America",
  "Internationals",
  "Asia",
  "Africa"
];

/**
 * @brief Default league definitions for ESPN API
 */
export const LEAGUE_ENDPOINTS: LeagueEndpoint[] = [
  { code: "eng.1", name: "Premier League", category: "Europe" },
  { code: "eng.2", name: "Championship", category: "Europe" },
  { code: "ger.1", name: "Bundesliga", category: "Europe" },
  { code: "esp.1", name: "La Liga", category: "Europe" },
  { code: "ita.1", name: "Serie A", category: "Europe" },
  { code: "fra.1", name: "Ligue 1", category: "Europe" },
  { code: "den.1", name: "Superliga", category: "Europe" },
];

/**
 * @brief A more extensive list of available league slugs for ESPN API
 */
export const AVAILABLE_LEAGUES: LeagueEndpoint[] = [
  // Europe
  { code: "eng.1", name: "Premier League", category: "Europe" },
  { code: "eng.2", name: "Championship", category: "Europe" },
  { code: "eng.3", name: "League One", category: "Europe" },
  { code: "eng.4", name: "League Two", category: "Europe" },
  { code: "eng.league_cup", name: "Carabao Cup", category: "Europe" },
  { code: "eng.fa", name: "FA Cup", category: "Europe" },
  { code: "esp.1", name: "La Liga", category: "Europe" },
  { code: "esp.2", name: "LALIGA 2", category: "Europe" },
  { code: "esp.copa_del_rey", name: "Spanish Copa del Rey", category: "Europe" },
  { code: "ger.1", name: "Bundesliga", category: "Europe" },
  { code: "ger.2", name: "German 2. Bundesliga", category: "Europe" },
  { code: "ger.dfb_pokal", name: "DFB Pokal", category: "Europe" },
  { code: "ita.1", name: "Serie A", category: "Europe" },
  { code: "ita.2", name: "Serie B", category: "Europe" },
  { code: "ita.coppa_italia", name: "Coppa Italia", category: "Europe" },
  { code: "fra.1", name: "Ligue 1", category: "Europe" },
  { code: "fra.2", name: "Ligue 2", category: "Europe" },
  { code: "fra.coupe_de_france", name: "Coupe de France", category: "Europe" },
  { code: "por.1", name: "Portuguese Primeira Liga", category: "Europe" },
  { code: "ned.1", name: "Eredivisie", category: "Europe" },
  { code: "ned.cup", name: "Dutch KNVB Beker", category: "Europe" },
  { code: "sco.1", name: "Scottish Premiership", category: "Europe" },
  { code: "sco.3", name: "Scottish League One", category: "Europe" },
  { code: "sco.4", name: "Scottish League Two", category: "Europe" },
  { code: "bel.1", name: "Belgian Pro League", category: "Europe" },
  { code: "rus.1", name: "Russian Premier League", category: "Europe" },
  { code: "tur.1", name: "Turkish Super Lig", category: "Europe" },
  { code: "gre.1", name: "Greek Super League", category: "Europe" },
  { code: "sui.1", name: "Swiss Super League", category: "Europe" },
  { code: "aut.1", name: "Austrian Bundesliga", category: "Europe" },
  { code: "den.1", name: "Superliga", category: "Europe" },
  { code: "nor.1", name: "Norwegian Eliteserien", category: "Europe" },
  { code: "swe.1", name: "Swedish Allsvenskan", category: "Europe" },
  { code: "irl.1", name: "Irish Premier Division", category: "Europe" },
  { code: "uefa.champions", name: "UEFA Champions League", category: "Europe" },
  { code: "uefa.europa", name: "UEFA Europa League", category: "Europe" },
  { code: "uefa.europa.conf", name: "UEFA Conference League", category: "Europe" },
  { code: "uefa.wchampions", name: "UEFA Women's Champions League", category: "Europe" },
  
  // USA, Mexico & CONCACAF
  { code: "usa.1", name: "MLS", category: "USA, Mexico & CONCACAF" },
  { code: "usa.nwsl", name: "NWSL", category: "USA, Mexico & CONCACAF" },
  { code: "usa.usl.1", name: "USL Championship", category: "USA, Mexico & CONCACAF" },
  { code: "usa.usl.l1", name: "USL League One", category: "USA, Mexico & CONCACAF" },
  { code: "usa.open", name: "U.S. Open Cup", category: "USA, Mexico & CONCACAF" },
  { code: "usa.nwsl.cup", name: "NWSL Challenge Cup", category: "USA, Mexico & CONCACAF" },
  { code: "mex.1", name: "Mexican Liga BBVA MX", category: "USA, Mexico & CONCACAF" },
  { code: "mex.2", name: "Mexican Liga de Expansión MX", category: "USA, Mexico & CONCACAF" },
  { code: "mex.copa_mx", name: "Mexican Copa MX", category: "USA, Mexico & CONCACAF" },
  { code: "concacaf.champions", name: "Concacaf Champions Cup", category: "USA, Mexico & CONCACAF" },
  { code: "concacaf.gold", name: "Concacaf Gold Cup", category: "USA, Mexico & CONCACAF" },
  { code: "crc.1", name: "Costa Rican Primera Division", category: "USA, Mexico & CONCACAF" },
  { code: "hon.1", name: "Honduran Liga Nacional", category: "USA, Mexico & CONCACAF" },
  { code: "gua.1", name: "Guatemalan Liga Nacional", category: "USA, Mexico & CONCACAF" },
  { code: "slv.1", name: "Salvadoran Primera Division", category: "USA, Mexico & CONCACAF" },
  
  // South America
  { code: "bra.1", name: "Brazilian Serie A", category: "South America" },
  { code: "bra.2", name: "Brazilian Serie B", category: "South America" },
  { code: "bra.copa_do_brazil", name: "Copa do Brasil", category: "South America" },
  { code: "bra.camp.gaucho", name: "Brazilian Campeonato Gaucho", category: "South America" },
  { code: "bra.camp.paulista", name: "Brazilian Campeonato Paulista", category: "South America" },
  { code: "bra.camp.carioca", name: "Brazilian Campeonato Carioca", category: "South America" },
  { code: "bra.camp.mineiro", name: "Brazilian Campeonato Mineiro", category: "South America" },
  { code: "arg.1", name: "Argentine Liga Profesional de Fútbol", category: "South America" },
  { code: "arg.2", name: "Argentine Nacional B", category: "South America" },
  { code: "arg.3", name: "Argentine Primera B", category: "South America" },
  { code: "arg.4", name: "Argentine Primera C", category: "South America" },
  { code: "arg.5", name: "Argentine Primera D", category: "South America" },
  { code: "arg.copa", name: "Copa Argentina", category: "South America" },
  { code: "arg.copa_lpf", name: "Argentine Copa de la Liga Profesional", category: "South America" },
  { code: "col.1", name: "Colombian Primera A", category: "South America" },
  { code: "col.2", name: "Colombian Primera B", category: "South America" },
  { code: "col.copa", name: "Copa Colombia", category: "South America" },
  { code: "chi.1", name: "Chilean Primera División", category: "South America" },
  { code: "chi.copa_chi", name: "Copa Chile", category: "South America" },
  { code: "ecu.1", name: "LigaPro Ecuador", category: "South America" },
  { code: "uru.1", name: "Liga UAF Uruguaya", category: "South America" },
  { code: "ven.1", name: "Venezuelan Primera División", category: "South America" },
  { code: "par.1", name: "Paraguayan Primera División", category: "South America" },
  { code: "per.1", name: "Peruvian Liga 1", category: "South America" },
  { code: "bol.1", name: "Bolivian Liga Profesional", category: "South America" },
  { code: "conmebol.libertadores", name: "CONMEBOL Libertadores", category: "South America" },
  { code: "conmebol.sudamericana", name: "CONMEBOL Sudamericana", category: "South America" },
  { code: "conmebol.america", name: "Copa América", category: "South America" },
  
  // Internationals
  { code: "fifa.world", name: "FIFA World Cup", category: "Internationals" },
  { code: "fifa.cwc", name: "FIFA Club World Cup", category: "Internationals" },
  { code: "fifa.worldq.uefa", name: "FIFA World Cup Qualifying - UEFA", category: "Internationals" },
  { code: "fifa.worldq.concacaf", name: "FIFA World Cup Qualifying - Concacaf", category: "Internationals" },
  { code: "fifa.worldq.conmebol", name: "FIFA World Cup Qualifying - CONMEBOL", category: "Internationals" },
  { code: "fifa.worldq.afc", name: "FIFA World Cup Qualifying - AFC", category: "Internationals" },
  { code: "fifa.worldq.caf", name: "FIFA World Cup Qualifying - CAF", category: "Internationals" },
  { code: "fifa.worldq.ofc", name: "FIFA World Cup Qualifying - OFC", category: "Internationals" },
  { code: "fifa.wwc", name: "FIFA Women's World Cup", category: "Internationals" },
  { code: "fifa.world.u20", name: "FIFA Under-20 World Cup", category: "Internationals" },
  { code: "fifa.world.u17", name: "FIFA Under-17 World Cup", category: "Internationals" },
  { code: "fifa.olympics", name: "Men's Olympic Soccer Tournament", category: "Internationals" },
  { code: "fifa.w.olympics", name: "Women's Olympic Soccer Tournament", category: "Internationals" },
  { code: "fifa.friendly", name: "International Friendly", category: "Internationals" },
  { code: "fifa.friendly.w", name: "Women's International Friendly", category: "Internationals" },
  { code: "uefa.euro", name: "UEFA European Championship", category: "Internationals" },
  { code: "uefa.nations", name: "UEFA Nations League", category: "Internationals" },
  { code: "uefa.euro_u21", name: "UEFA European Under-21 Championship", category: "Internationals" },
  { code: "uefa.euro.u19", name: "UEFA European Under-19 Championship", category: "Internationals" },
  { code: "uefa.euroq", name: "UEFA European Championship Qualifying", category: "Internationals" },
  { code: "uefa.weuro", name: "UEFA Women's European Championship", category: "Internationals" },
  { code: "concacaf.womens.championship", name: "Concacaf W Championship", category: "Internationals" },
  
  // Asia
  { code: "afc.champions", name: "AFC Champions League Elite", category: "Asia" },
  { code: "afc.cup", name: "AFC Champions League Two", category: "Asia" },
  { code: "afc.asian.cup", name: "AFC Asian Cup", category: "Asia" },
  { code: "afc.cupq", name: "AFC Asian Cup Qualifiers", category: "Asia" },
  { code: "ksa.1", name: "Saudi Pro League", category: "Asia" },
  { code: "aus.1", name: "Australian A-League Men", category: "Asia" },
  { code: "aus.w.1", name: "Australian A-League Women", category: "Asia" },
  { code: "jpn.1", name: "Japanese J.League", category: "Asia" },
  { code: "chn.1", name: "Chinese Super League", category: "Asia" },
  { code: "ind.1", name: "Indian Super League", category: "Asia" },
  { code: "idn.1", name: "Indonesian Liga 1", category: "Asia" },
  { code: "mys.1", name: "Malaysian Super League", category: "Asia" },
  { code: "sgp.1", name: "Singaporean Premier League", category: "Asia" },
  { code: "tha.1", name: "Thai League 1", category: "Asia" },
  { code: "aff.championship", name: "ASEAN Championship", category: "Asia" },
  
  // Africa
  { code: "caf.champions", name: "CAF Champions League", category: "Africa" },
  { code: "caf.nations", name: "Africa Cup of Nations", category: "Africa" }
];