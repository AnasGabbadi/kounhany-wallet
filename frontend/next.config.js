/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  ...(process.env.NODE_ENV === 'production' && {
    basePath: '/wallet',
    assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || '/wallet',
  }),
};

module.exports = nextConfig;