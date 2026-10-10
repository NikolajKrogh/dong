module.exports = (asset) => {
  // Cloudflare Pages excludes node_modules directories, including exported fonts.
  if (asset.httpServerLocation.includes('?export_path=')) {
    asset.httpServerLocation = asset.httpServerLocation.replaceAll('/node_modules/', '/vendor/');
  }
  return asset;
};
