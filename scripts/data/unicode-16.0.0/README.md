# Pinned Unicode category source

- Source: [UnicodeData.txt, Unicode 16.0.0](https://www.unicode.org/Public/16.0.0/ucd/UnicodeData.txt)
- SHA-256: `ff58e5823bd095166564a006e47d111130813dcf8bf234ef79fa51a870edb48f`
- License: [Unicode License v3](LICENSE.txt), downloaded from [Unicode, Inc.](https://www.unicode.org/license.txt)
- Derived file: `letter-number-ranges.sql`, produced by `node scripts/generate-username-ranges.mjs`

The generator expands UnicodeData First/Last entries, keeps general categories beginning with `L` or `N`, and merges adjacent code points. The migration embeds the generated SQL so deployments never download Unicode data at runtime. Updating Unicode requires a reviewed source/checksum and a new migration.
