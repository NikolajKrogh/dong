const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.transformer.assetPlugins.push(require.resolve('./scripts/cloudflare-asset-paths.cjs'));

module.exports = config;
