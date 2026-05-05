/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  ...(process.env.NODE_ENV === 'production' && {
    basePath: '/wallet',
    assetPrefix: '/wallet',
  }),
};

module.exports = nextConfig;