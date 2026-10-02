-- Canonical account identity. Unicode category data is pinned to Unicode 16.0.0.
CREATE TABLE private.username_codepoint_ranges (
  first_codepoint integer PRIMARY KEY,
  last_codepoint integer NOT NULL CHECK (last_codepoint >= first_codepoint)
);
REVOKE ALL ON private.username_codepoint_ranges FROM PUBLIC, anon, authenticated;

-- Unicode 16.0.0 Letter/Number ranges. Source SHA-256: ff58e5823bd095166564a006e47d111130813dcf8bf234ef79fa51a870edb48f
INSERT INTO private.username_codepoint_ranges (first_codepoint, last_codepoint) VALUES
  (48, 57),
  (65, 90),
  (97, 122),
  (170, 170),
  (178, 179),
  (181, 181),
  (185, 186),
  (188, 190),
  (192, 214),
  (216, 246),
  (248, 705),
  (710, 721),
  (736, 740),
  (748, 748),
  (750, 750),
  (880, 884),
  (886, 887),
  (890, 893),
  (895, 895),
  (902, 902),
  (904, 906),
  (908, 908),
  (910, 929),
  (931, 1013),
  (1015, 1153),
  (1162, 1327),
  (1329, 1366),
  (1369, 1369),
  (1376, 1416),
  (1488, 1514),
  (1519, 1522),
  (1568, 1610),
  (1632, 1641),
  (1646, 1647),
  (1649, 1747),
  (1749, 1749),
  (1765, 1766),
  (1774, 1788),
  (1791, 1791),
  (1808, 1808),
  (1810, 1839),
  (1869, 1957),
  (1969, 1969),
  (1984, 2026),
  (2036, 2037),
  (2042, 2042),
  (2048, 2069),
  (2074, 2074),
  (2084, 2084),
  (2088, 2088),
  (2112, 2136),
  (2144, 2154),
  (2160, 2183),
  (2185, 2190),
  (2208, 2249),
  (2308, 2361),
  (2365, 2365),
  (2384, 2384),
  (2392, 2401),
  (2406, 2415),
  (2417, 2432),
  (2437, 2444),
  (2447, 2448),
  (2451, 2472),
  (2474, 2480),
  (2482, 2482),
  (2486, 2489),
  (2493, 2493),
  (2510, 2510),
  (2524, 2525),
  (2527, 2529),
  (2534, 2545),
  (2548, 2553),
  (2556, 2556),
  (2565, 2570),
  (2575, 2576),
  (2579, 2600),
  (2602, 2608),
  (2610, 2611),
  (2613, 2614),
  (2616, 2617),
  (2649, 2652),
  (2654, 2654),
  (2662, 2671),
  (2674, 2676),
  (2693, 2701),
  (2703, 2705),
  (2707, 2728),
  (2730, 2736),
  (2738, 2739),
  (2741, 2745),
  (2749, 2749),
  (2768, 2768),
  (2784, 2785),
  (2790, 2799),
  (2809, 2809),
  (2821, 2828),
  (2831, 2832),
  (2835, 2856),
  (2858, 2864),
  (2866, 2867),
  (2869, 2873),
  (2877, 2877),
  (2908, 2909),
  (2911, 2913),
  (2918, 2927),
  (2929, 2935),
  (2947, 2947),
  (2949, 2954),
  (2958, 2960),
  (2962, 2965),
  (2969, 2970),
  (2972, 2972),
  (2974, 2975),
  (2979, 2980),
  (2984, 2986),
  (2990, 3001),
  (3024, 3024),
  (3046, 3058),
  (3077, 3084),
  (3086, 3088),
  (3090, 3112),
  (3114, 3129),
  (3133, 3133),
  (3160, 3162),
  (3165, 3165),
  (3168, 3169),
  (3174, 3183),
  (3192, 3198),
  (3200, 3200),
  (3205, 3212),
  (3214, 3216),
  (3218, 3240),
  (3242, 3251),
  (3253, 3257),
  (3261, 3261),
  (3293, 3294),
  (3296, 3297),
  (3302, 3311),
  (3313, 3314),
  (3332, 3340),
  (3342, 3344),
  (3346, 3386),
  (3389, 3389),
  (3406, 3406),
  (3412, 3414),
  (3416, 3425),
  (3430, 3448),
  (3450, 3455),
  (3461, 3478),
  (3482, 3505),
  (3507, 3515),
  (3517, 3517),
  (3520, 3526),
  (3558, 3567),
  (3585, 3632),
  (3634, 3635),
  (3648, 3654),
  (3664, 3673),
  (3713, 3714),
  (3716, 3716),
  (3718, 3722),
  (3724, 3747),
  (3749, 3749),
  (3751, 3760),
  (3762, 3763),
  (3773, 3773),
  (3776, 3780),
  (3782, 3782),
  (3792, 3801),
  (3804, 3807),
  (3840, 3840),
  (3872, 3891),
  (3904, 3911),
  (3913, 3948),
  (3976, 3980),
  (4096, 4138),
  (4159, 4169),
  (4176, 4181),
  (4186, 4189),
  (4193, 4193),
  (4197, 4198),
  (4206, 4208),
  (4213, 4225),
  (4238, 4238),
  (4240, 4249),
  (4256, 4293),
  (4295, 4295),
  (4301, 4301),
  (4304, 4346),
  (4348, 4680),
  (4682, 4685),
  (4688, 4694),
  (4696, 4696),
  (4698, 4701),
  (4704, 4744),
  (4746, 4749),
  (4752, 4784),
  (4786, 4789),
  (4792, 4798),
  (4800, 4800),
  (4802, 4805),
  (4808, 4822),
  (4824, 4880),
  (4882, 4885),
  (4888, 4954),
  (4969, 4988),
  (4992, 5007),
  (5024, 5109),
  (5112, 5117),
  (5121, 5740),
  (5743, 5759),
  (5761, 5786),
  (5792, 5866),
  (5870, 5880),
  (5888, 5905),
  (5919, 5937),
  (5952, 5969),
  (5984, 5996),
  (5998, 6000),
  (6016, 6067),
  (6103, 6103),
  (6108, 6108),
  (6112, 6121),
  (6128, 6137),
  (6160, 6169),
  (6176, 6264),
  (6272, 6276),
  (6279, 6312),
  (6314, 6314),
  (6320, 6389),
  (6400, 6430),
  (6470, 6509),
  (6512, 6516),
  (6528, 6571),
  (6576, 6601),
  (6608, 6618),
  (6656, 6678),
  (6688, 6740),
  (6784, 6793),
  (6800, 6809),
  (6823, 6823),
  (6917, 6963),
  (6981, 6988),
  (6992, 7001),
  (7043, 7072),
  (7086, 7141),
  (7168, 7203),
  (7232, 7241),
  (7245, 7293),
  (7296, 7306),
  (7312, 7354),
  (7357, 7359),
  (7401, 7404),
  (7406, 7411),
  (7413, 7414),
  (7418, 7418),
  (7424, 7615),
  (7680, 7957),
  (7960, 7965),
  (7968, 8005),
  (8008, 8013),
  (8016, 8023),
  (8025, 8025),
  (8027, 8027),
  (8029, 8029),
  (8031, 8061),
  (8064, 8116),
  (8118, 8124),
  (8126, 8126),
  (8130, 8132),
  (8134, 8140),
  (8144, 8147),
  (8150, 8155),
  (8160, 8172),
  (8178, 8180),
  (8182, 8188),
  (8304, 8305),
  (8308, 8313),
  (8319, 8329),
  (8336, 8348),
  (8450, 8450),
  (8455, 8455),
  (8458, 8467),
  (8469, 8469),
  (8473, 8477),
  (8484, 8484),
  (8486, 8486),
  (8488, 8488),
  (8490, 8493),
  (8495, 8505),
  (8508, 8511),
  (8517, 8521),
  (8526, 8526),
  (8528, 8585),
  (9312, 9371),
  (9450, 9471),
  (10102, 10131),
  (11264, 11492),
  (11499, 11502),
  (11506, 11507),
  (11517, 11517),
  (11520, 11557),
  (11559, 11559),
  (11565, 11565),
  (11568, 11623),
  (11631, 11631),
  (11648, 11670),
  (11680, 11686),
  (11688, 11694),
  (11696, 11702),
  (11704, 11710),
  (11712, 11718),
  (11720, 11726),
  (11728, 11734),
  (11736, 11742),
  (11823, 11823),
  (12293, 12295),
  (12321, 12329),
  (12337, 12341),
  (12344, 12348),
  (12353, 12438),
  (12445, 12447),
  (12449, 12538),
  (12540, 12543),
  (12549, 12591),
  (12593, 12686),
  (12690, 12693),
  (12704, 12735),
  (12784, 12799),
  (12832, 12841),
  (12872, 12879),
  (12881, 12895),
  (12928, 12937),
  (12977, 12991),
  (13312, 19903),
  (19968, 42124),
  (42192, 42237),
  (42240, 42508),
  (42512, 42539),
  (42560, 42606),
  (42623, 42653),
  (42656, 42735),
  (42775, 42783),
  (42786, 42888),
  (42891, 42957),
  (42960, 42961),
  (42963, 42963),
  (42965, 42972),
  (42994, 43009),
  (43011, 43013),
  (43015, 43018),
  (43020, 43042),
  (43056, 43061),
  (43072, 43123),
  (43138, 43187),
  (43216, 43225),
  (43250, 43255),
  (43259, 43259),
  (43261, 43262),
  (43264, 43301),
  (43312, 43334),
  (43360, 43388),
  (43396, 43442),
  (43471, 43481),
  (43488, 43492),
  (43494, 43518),
  (43520, 43560),
  (43584, 43586),
  (43588, 43595),
  (43600, 43609),
  (43616, 43638),
  (43642, 43642),
  (43646, 43695),
  (43697, 43697),
  (43701, 43702),
  (43705, 43709),
  (43712, 43712),
  (43714, 43714),
  (43739, 43741),
  (43744, 43754),
  (43762, 43764),
  (43777, 43782),
  (43785, 43790),
  (43793, 43798),
  (43808, 43814),
  (43816, 43822),
  (43824, 43866),
  (43868, 43881),
  (43888, 44002),
  (44016, 44025),
  (44032, 55203),
  (55216, 55238),
  (55243, 55291),
  (63744, 64109),
  (64112, 64217),
  (64256, 64262),
  (64275, 64279),
  (64285, 64285),
  (64287, 64296),
  (64298, 64310),
  (64312, 64316),
  (64318, 64318),
  (64320, 64321),
  (64323, 64324),
  (64326, 64433),
  (64467, 64829),
  (64848, 64911),
  (64914, 64967),
  (65008, 65019),
  (65136, 65140),
  (65142, 65276),
  (65296, 65305),
  (65313, 65338),
  (65345, 65370),
  (65382, 65470),
  (65474, 65479),
  (65482, 65487),
  (65490, 65495),
  (65498, 65500),
  (65536, 65547),
  (65549, 65574),
  (65576, 65594),
  (65596, 65597),
  (65599, 65613),
  (65616, 65629),
  (65664, 65786),
  (65799, 65843),
  (65856, 65912),
  (65930, 65931),
  (66176, 66204),
  (66208, 66256),
  (66273, 66299),
  (66304, 66339),
  (66349, 66378),
  (66384, 66421),
  (66432, 66461),
  (66464, 66499),
  (66504, 66511),
  (66513, 66517),
  (66560, 66717),
  (66720, 66729),
  (66736, 66771),
  (66776, 66811),
  (66816, 66855),
  (66864, 66915),
  (66928, 66938),
  (66940, 66954),
  (66956, 66962),
  (66964, 66965),
  (66967, 66977),
  (66979, 66993),
  (66995, 67001),
  (67003, 67004),
  (67008, 67059),
  (67072, 67382),
  (67392, 67413),
  (67424, 67431),
  (67456, 67461),
  (67463, 67504),
  (67506, 67514),
  (67584, 67589),
  (67592, 67592),
  (67594, 67637),
  (67639, 67640),
  (67644, 67644),
  (67647, 67669),
  (67672, 67702),
  (67705, 67742),
  (67751, 67759),
  (67808, 67826),
  (67828, 67829),
  (67835, 67867),
  (67872, 67897),
  (67968, 68023),
  (68028, 68047),
  (68050, 68096),
  (68112, 68115),
  (68117, 68119),
  (68121, 68149),
  (68160, 68168),
  (68192, 68222),
  (68224, 68255),
  (68288, 68295),
  (68297, 68324),
  (68331, 68335),
  (68352, 68405),
  (68416, 68437),
  (68440, 68466),
  (68472, 68497),
  (68521, 68527),
  (68608, 68680),
  (68736, 68786),
  (68800, 68850),
  (68858, 68899),
  (68912, 68921),
  (68928, 68965),
  (68975, 68997),
  (69216, 69246),
  (69248, 69289),
  (69296, 69297),
  (69314, 69316),
  (69376, 69415),
  (69424, 69445),
  (69457, 69460),
  (69488, 69505),
  (69552, 69579),
  (69600, 69622),
  (69635, 69687),
  (69714, 69743),
  (69745, 69746),
  (69749, 69749),
  (69763, 69807),
  (69840, 69864),
  (69872, 69881),
  (69891, 69926),
  (69942, 69951),
  (69956, 69956),
  (69959, 69959),
  (69968, 70002),
  (70006, 70006),
  (70019, 70066),
  (70081, 70084),
  (70096, 70106),
  (70108, 70108),
  (70113, 70132),
  (70144, 70161),
  (70163, 70187),
  (70207, 70208),
  (70272, 70278),
  (70280, 70280),
  (70282, 70285),
  (70287, 70301),
  (70303, 70312),
  (70320, 70366),
  (70384, 70393),
  (70405, 70412),
  (70415, 70416),
  (70419, 70440),
  (70442, 70448),
  (70450, 70451),
  (70453, 70457),
  (70461, 70461),
  (70480, 70480),
  (70493, 70497),
  (70528, 70537),
  (70539, 70539),
  (70542, 70542),
  (70544, 70581),
  (70583, 70583),
  (70609, 70609),
  (70611, 70611),
  (70656, 70708),
  (70727, 70730),
  (70736, 70745),
  (70751, 70753),
  (70784, 70831),
  (70852, 70853),
  (70855, 70855),
  (70864, 70873),
  (71040, 71086),
  (71128, 71131),
  (71168, 71215),
  (71236, 71236),
  (71248, 71257),
  (71296, 71338),
  (71352, 71352),
  (71360, 71369),
  (71376, 71395),
  (71424, 71450),
  (71472, 71483),
  (71488, 71494),
  (71680, 71723),
  (71840, 71922),
  (71935, 71942),
  (71945, 71945),
  (71948, 71955),
  (71957, 71958),
  (71960, 71983),
  (71999, 71999),
  (72001, 72001),
  (72016, 72025),
  (72096, 72103),
  (72106, 72144),
  (72161, 72161),
  (72163, 72163),
  (72192, 72192),
  (72203, 72242),
  (72250, 72250),
  (72272, 72272),
  (72284, 72329),
  (72349, 72349),
  (72368, 72440),
  (72640, 72672),
  (72688, 72697),
  (72704, 72712),
  (72714, 72750),
  (72768, 72768),
  (72784, 72812),
  (72818, 72847),
  (72960, 72966),
  (72968, 72969),
  (72971, 73008),
  (73030, 73030),
  (73040, 73049),
  (73056, 73061),
  (73063, 73064),
  (73066, 73097),
  (73112, 73112),
  (73120, 73129),
  (73440, 73458),
  (73474, 73474),
  (73476, 73488),
  (73490, 73523),
  (73552, 73561),
  (73648, 73648),
  (73664, 73684),
  (73728, 74649),
  (74752, 74862),
  (74880, 75075),
  (77712, 77808),
  (77824, 78895),
  (78913, 78918),
  (78944, 82938),
  (82944, 83526),
  (90368, 90397),
  (90416, 90425),
  (92160, 92728),
  (92736, 92766),
  (92768, 92777),
  (92784, 92862),
  (92864, 92873),
  (92880, 92909),
  (92928, 92975),
  (92992, 92995),
  (93008, 93017),
  (93019, 93025),
  (93027, 93047),
  (93053, 93071),
  (93504, 93548),
  (93552, 93561),
  (93760, 93846),
  (93952, 94026),
  (94032, 94032),
  (94099, 94111),
  (94176, 94177),
  (94179, 94179),
  (94208, 100343),
  (100352, 101589),
  (101631, 101640),
  (110576, 110579),
  (110581, 110587),
  (110589, 110590),
  (110592, 110882),
  (110898, 110898),
  (110928, 110930),
  (110933, 110933),
  (110948, 110951),
  (110960, 111355),
  (113664, 113770),
  (113776, 113788),
  (113792, 113800),
  (113808, 113817),
  (118000, 118009),
  (119488, 119507),
  (119520, 119539),
  (119648, 119672),
  (119808, 119892),
  (119894, 119964),
  (119966, 119967),
  (119970, 119970),
  (119973, 119974),
  (119977, 119980),
  (119982, 119993),
  (119995, 119995),
  (119997, 120003),
  (120005, 120069),
  (120071, 120074),
  (120077, 120084),
  (120086, 120092),
  (120094, 120121),
  (120123, 120126),
  (120128, 120132),
  (120134, 120134),
  (120138, 120144),
  (120146, 120485),
  (120488, 120512),
  (120514, 120538),
  (120540, 120570),
  (120572, 120596),
  (120598, 120628),
  (120630, 120654),
  (120656, 120686),
  (120688, 120712),
  (120714, 120744),
  (120746, 120770),
  (120772, 120779),
  (120782, 120831),
  (122624, 122654),
  (122661, 122666),
  (122928, 122989),
  (123136, 123180),
  (123191, 123197),
  (123200, 123209),
  (123214, 123214),
  (123536, 123565),
  (123584, 123627),
  (123632, 123641),
  (124112, 124139),
  (124144, 124153),
  (124368, 124397),
  (124400, 124410),
  (124896, 124902),
  (124904, 124907),
  (124909, 124910),
  (124912, 124926),
  (124928, 125124),
  (125127, 125135),
  (125184, 125251),
  (125259, 125259),
  (125264, 125273),
  (126065, 126123),
  (126125, 126127),
  (126129, 126132),
  (126209, 126253),
  (126255, 126269),
  (126464, 126467),
  (126469, 126495),
  (126497, 126498),
  (126500, 126500),
  (126503, 126503),
  (126505, 126514),
  (126516, 126519),
  (126521, 126521),
  (126523, 126523),
  (126530, 126530),
  (126535, 126535),
  (126537, 126537),
  (126539, 126539),
  (126541, 126543),
  (126545, 126546),
  (126548, 126548),
  (126551, 126551),
  (126553, 126553),
  (126555, 126555),
  (126557, 126557),
  (126559, 126559),
  (126561, 126562),
  (126564, 126564),
  (126567, 126570),
  (126572, 126578),
  (126580, 126583),
  (126585, 126588),
  (126590, 126590),
  (126592, 126601),
  (126603, 126619),
  (126625, 126627),
  (126629, 126633),
  (126635, 126651),
  (127232, 127244),
  (130032, 130041),
  (131072, 173791),
  (173824, 177977),
  (177984, 178205),
  (178208, 183969),
  (183984, 191456),
  (191472, 192093),
  (194560, 195101),
  (196608, 201546),
  (201552, 205743);

CREATE FUNCTION private.normalize_username(raw_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT normalize(
    pg_catalog.btrim(raw_name,
      ' ' || chr(160) || chr(5760) || chr(8239) || chr(8287) || chr(12288) ||
      (SELECT string_agg(chr(n), '' ORDER BY n) FROM generate_series(8192, 8202) n)),
    NFC);
$fn$;

CREATE FUNCTION private.username_is_valid(display_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  position integer;
  codepoint integer;
BEGIN
  IF display_name IS NULL OR length(display_name) NOT BETWEEN 3 AND 30 THEN
    RETURN false;
  END IF;
  FOR position IN 1..length(display_name) LOOP
    codepoint := ascii(substr(display_name, position, 1));
    IF codepoint <> 95 AND NOT EXISTS (
      SELECT 1 FROM private.username_codepoint_ranges r
      WHERE codepoint BETWEEN r.first_codepoint AND r.last_codepoint
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$fn$;

CREATE FUNCTION private.username_lookup_key(display_name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
DECLARE
  position integer;
  result text := '';
BEGIN
  IF display_name IS NULL THEN RETURN NULL; END IF;
  FOR position IN 1..length(display_name) LOOP
    result := result || lower(substr(display_name, position, 1) COLLATE pg_catalog."und-x-icu");
  END LOOP;
  RETURN normalize(result, NFC);
END;
$fn$;

DO $preflight$
DECLARE
  invalid_id uuid;
  duplicate_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_collation WHERE collname = 'und-x-icu' AND collnamespace = 'pg_catalog'::regnamespace) THEN
    RAISE EXCEPTION 'username_requires_icu_root_collation';
  END IF;
  SELECT id INTO invalid_id FROM public.accounts
  WHERE preferred_display_name IS NOT NULL
    AND NOT private.username_is_valid(private.normalize_username(preferred_display_name))
  LIMIT 1;
  IF invalid_id IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_existing_username: %', invalid_id;
  END IF;
  SELECT private.username_lookup_key(private.normalize_username(preferred_display_name))
    INTO duplicate_key
  FROM public.accounts WHERE preferred_display_name IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1 LIMIT 1;
  IF duplicate_key IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate_existing_username_key: %', duplicate_key;
  END IF;
END;
$preflight$;

ALTER TABLE public.accounts DROP CONSTRAINT chk_accounts_preferred_display_name_nonempty;
ALTER TABLE public.accounts RENAME COLUMN preferred_display_name TO username;
ALTER TABLE public.accounts ADD COLUMN username_key text COLLATE "C";

CREATE FUNCTION private.enforce_account_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL AND NEW.username IS NULL THEN
    RAISE EXCEPTION 'username_cannot_be_cleared' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.username IS NULL THEN
    NEW.username_key := NULL;
    RETURN NEW;
  END IF;
  NEW.username := private.normalize_username(NEW.username);
  IF NOT private.username_is_valid(NEW.username) THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = 'P0001';
  END IF;
  NEW.username_key := private.username_lookup_key(NEW.username);
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER enforce_account_username_before_write
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION private.enforce_account_username();
UPDATE public.accounts SET username = username;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_username_pair_check
  CHECK ((username IS NULL) = (username_key IS NULL));
ALTER TABLE public.accounts ADD CONSTRAINT accounts_username_length_check
  CHECK (username IS NULL OR length(username) BETWEEN 3 AND 30);
ALTER TABLE public.accounts ADD CONSTRAINT accounts_username_key_unique UNIQUE (username_key);

-- Bootstrap may insert an id only; every username claim goes through the RPC.
REVOKE INSERT, UPDATE, SELECT ON public.accounts FROM authenticated;
GRANT INSERT (id) ON public.accounts TO authenticated;
GRANT SELECT (id, username, created_at, updated_at) ON public.accounts TO authenticated;
REVOKE ALL ON FUNCTION private.normalize_username(text),
  private.username_is_valid(text), private.username_lookup_key(text),
  private.enforce_account_username() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.set_account_username(requested_username text)
RETURNS TABLE (id uuid, username text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  normalized text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  normalized := private.normalize_username(requested_username);
  IF NOT private.username_is_valid(normalized) THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    UPDATE public.accounts a SET username = normalized, updated_at = now()
    WHERE a.id = auth.uid()
    RETURNING a.id, a.username, a.created_at, a.updated_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0001';
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'username_unavailable' USING ERRCODE = 'P0001';
END;
$fn$;
REVOKE ALL ON FUNCTION public.set_account_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_account_username(text) TO authenticated;

-- The historical participant display_name remains a captured game snapshot.
ALTER VIEW private._history_account_display_names RENAME COLUMN preferred_display_name TO username;
DROP TABLE public.profiles;

-- Recompile readers against the canonical account and history-view column.
CREATE OR REPLACE FUNCTION private.join_room_as_registered(p_join_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_account uuid := auth.uid();
  v_join_code text := upper(btrim(coalesce(p_join_code, '')));
  v_room public.game_sessions %ROWTYPE;
  v_active uuid;
  v_display text;
  v_participant public.participants %ROWTYPE;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.join_code = v_join_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  -- Idempotent: already a participant (possibly soft-left) of this room?
  SELECT * INTO v_participant FROM public.participants p
  WHERE p.session_id = v_room.id AND p.account_id = v_account
  LIMIT 1;
  IF FOUND THEN
    IF v_participant.left_at IS NOT NULL THEN
      UPDATE public.participants SET left_at = NULL WHERE id = v_participant.id
      RETURNING * INTO v_participant;
    END IF;
    RETURN jsonb_build_object(
      'participantId', v_participant.id::text,
      'sessionId', v_room.id::text,
      'joinCode', v_room.join_code,
      'displayName', v_participant.display_name,
      'membershipType', v_participant.membership_type::text,
      'sessionRole', v_participant.session_role::text,
      'snapshot', private.build_guest_room_snapshot(v_room.id)
    );
  END IF;

  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  v_active := private.find_active_room_for(v_account);
  IF v_active IS NOT NULL AND v_active <> v_room.id THEN RAISE EXCEPTION 'already_in_active_room'; END IF;

  SELECT coalesce(NULLIF(btrim(accounts.username), ''), 'Player') INTO v_display
  FROM public.accounts accounts WHERE accounts.id = v_account;
  v_display := coalesce(v_display, 'Player');

  INSERT INTO public.participants (
    session_id, account_id, display_name, membership_type, session_role,
    current_drink_total, guest_rejoin_token_hash, created_at
  ) VALUES (
    v_room.id, v_account, v_display, 'registered'::public.participant_membership_type,
    'member'::public.participant_session_role, 0, NULL, now()
  ) RETURNING * INTO v_participant;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    v_room.id, public.allocate_event_sequence(v_room.id), v_participant.id, 'participant_joined',
    concat('registered-join:', v_account::text),
    jsonb_build_object('participantId', v_participant.id::text, 'displayName', v_display,
                       'membershipType', 'registered', 'sessionRole', 'member'),
    now()
  );

  RETURN jsonb_build_object(
    'participantId', v_participant.id::text,
    'sessionId', v_room.id::text,
    'joinCode', v_room.join_code,
    'displayName', v_display,
    'membershipType', 'registered',
    'sessionRole', 'member',
    'snapshot', private.build_guest_room_snapshot(v_room.id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_session_owner_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
	v_display_name text;
BEGIN
	SELECT accounts.username INTO v_display_name
	FROM public.accounts accounts
	WHERE accounts.id = NEW.owner_account_id;

	UPDATE public.participants
	SET session_role = 'member'::public.participant_session_role
	WHERE session_id = NEW.id
		AND session_role = 'owner'::public.participant_session_role
		AND account_id IS DISTINCT FROM NEW.owner_account_id;

	UPDATE public.participants
	SET display_name = COALESCE(
			NULLIF(public.participants.display_name, ''),
			COALESCE(v_display_name, 'Session Owner')
		),
		membership_type = 'registered'::public.participant_membership_type,
		session_role = 'owner'::public.participant_session_role,
		guest_rejoin_token_hash = NULL
	WHERE session_id = NEW.id
		AND account_id = NEW.owner_account_id;

	IF NOT FOUND THEN
		INSERT INTO public.participants (
			session_id,
			account_id,
			display_name,
			membership_type,
			session_role,
			current_drink_total,
			guest_rejoin_token_hash,
			created_at
		)
		VALUES (
			NEW.id,
			NEW.owner_account_id,
			COALESCE(v_display_name, 'Session Owner'),
			'registered'::public.participant_membership_type,
			'owner'::public.participant_session_role,
			0,
			NULL,
			COALESCE(NEW.created_at, now())
		);
	END IF;

	RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.compare_registered_players(left_account_id uuid, right_account_id uuid)
 RETURNS TABLE(player1_id uuid, player2_id uuid, player1_name text, player2_name text, player1_games_played integer, player2_games_played integer, player1_total_drinks numeric, player2_total_drinks numeric, player1_average_per_game numeric, player2_average_per_game numeric, games_played_together integer, player1_wins_count integer, player2_wins_count integer, tied_games_count integer, player1_max_in_a_game numeric, player2_max_in_a_game numeric, player1_common_match_count integer, player2_common_match_count integer, player1_efficiency numeric, player2_efficiency numeric, player1_top_drinker_count integer, player2_top_drinker_count integer, player1_avg_with_player2 numeric, player1_avg_without_player2 numeric, player2_avg_with_player1 numeric, player2_avg_without_player1 numeric, timeline_data jsonb)
 LANGUAGE sql
 STABLE
AS $function$
WITH left_games AS (
		SELECT participants.session_id,
			participants.completed_at,
			participants.current_drink_total,
			participants.common_match_id,
			participants.session_match_count,
			participants.is_top_drinker
		FROM private._history_participant_session_rollups participants
		WHERE participants.account_id = left_account_id
	),
	right_games AS (
		SELECT participants.session_id,
			participants.completed_at,
			participants.current_drink_total,
			participants.common_match_id,
			participants.session_match_count,
			participants.is_top_drinker
		FROM private._history_participant_session_rollups participants
		WHERE participants.account_id = right_account_id
	),
	shared_games AS (
		SELECT left_games.session_id,
			left_games.completed_at,
			left_games.current_drink_total AS player1_drinks,
			right_games.current_drink_total AS player2_drinks
		FROM left_games
			INNER JOIN right_games USING (session_id)
	),
	left_without_games AS (
		SELECT left_games.*
		FROM left_games
			LEFT JOIN shared_games USING (session_id)
		WHERE shared_games.session_id IS NULL
	),
	right_without_games AS (
		SELECT right_games.*
		FROM right_games
			LEFT JOIN shared_games USING (session_id)
		WHERE shared_games.session_id IS NULL
	),
	left_totals AS (
		SELECT count(*)::integer AS games_played,
			COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
			COALESCE(sum(session_match_count), 0)::integer AS total_matches,
			COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
			COALESCE(
				count(*) FILTER (
					WHERE common_match_id IS NOT NULL
				),
				0
			)::integer AS common_match_count,
			COALESCE(
				count(*) FILTER (
					WHERE is_top_drinker
				),
				0
			)::integer AS top_drinker_count
		FROM left_games
	),
	right_totals AS (
		SELECT count(*)::integer AS games_played,
			COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
			COALESCE(sum(session_match_count), 0)::integer AS total_matches,
			COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
			COALESCE(
				count(*) FILTER (
					WHERE common_match_id IS NOT NULL
				),
				0
			)::integer AS common_match_count,
			COALESCE(
				count(*) FILTER (
					WHERE is_top_drinker
				),
				0
			)::integer AS top_drinker_count
		FROM right_games
	)
SELECT left_account_id AS player1_id,
	right_account_id AS player2_id,
	COALESCE(
		(
			SELECT username
			FROM private._history_account_display_names
			WHERE account_id = left_account_id
		),
		left_account_id::text
	) AS player1_name,
	COALESCE(
		(
			SELECT username
			FROM private._history_account_display_names
			WHERE account_id = right_account_id
		),
		right_account_id::text
	) AS player2_name,
	left_totals.games_played AS player1_games_played,
	right_totals.games_played AS player2_games_played,
	left_totals.total_drinks AS player1_total_drinks,
	right_totals.total_drinks AS player2_total_drinks,
	CASE
		WHEN left_totals.games_played > 0 THEN left_totals.total_drinks / left_totals.games_played
		ELSE 0
	END AS player1_average_per_game,
	CASE
		WHEN right_totals.games_played > 0 THEN right_totals.total_drinks / right_totals.games_played
		ELSE 0
	END AS player2_average_per_game,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
		),
		0
	) AS games_played_together,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
			WHERE player1_drinks > player2_drinks
		),
		0
	) AS player1_wins_count,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
			WHERE player2_drinks > player1_drinks
		),
		0
	) AS player2_wins_count,
	COALESCE(
		(
			SELECT count(*)::integer
			FROM shared_games
			WHERE player1_drinks = player2_drinks
		),
		0
	) AS tied_games_count,
	left_totals.max_in_a_game AS player1_max_in_a_game,
	right_totals.max_in_a_game AS player2_max_in_a_game,
	left_totals.common_match_count AS player1_common_match_count,
	right_totals.common_match_count AS player2_common_match_count,
	CASE
		WHEN left_totals.total_matches > 0 THEN left_totals.total_drinks / left_totals.total_matches
		ELSE 0
	END AS player1_efficiency,
	CASE
		WHEN right_totals.total_matches > 0 THEN right_totals.total_drinks / right_totals.total_matches
		ELSE 0
	END AS player2_efficiency,
	left_totals.top_drinker_count AS player1_top_drinker_count,
	right_totals.top_drinker_count AS player2_top_drinker_count,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(player1_drinks) / count(*)
					ELSE 0
				END
			FROM shared_games
		),
		0
	) AS player1_avg_with_player2,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
					ELSE 0
				END
			FROM left_without_games
		),
		0
	) AS player1_avg_without_player2,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(player2_drinks) / count(*)
					ELSE 0
				END
			FROM shared_games
		),
		0
	) AS player2_avg_with_player1,
	COALESCE(
		(
			SELECT CASE
					WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
					ELSE 0
				END
			FROM right_without_games
		),
		0
	) AS player2_avg_without_player1,
	COALESCE(
		(
			SELECT jsonb_agg(
					jsonb_build_object(
						'date',
						completed_at::text,
						'player1Drinks',
						player1_drinks,
						'player2Drinks',
						player2_drinks
					)
					ORDER BY completed_at,
						session_id
				)
			FROM shared_games
		),
		'[]'::jsonb
	) AS timeline_data
FROM left_totals,
	right_totals;
$function$;
