/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  basePath: '/wallet',
  assetPrefix: '/wallet',
  compress: true,
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material', 'recharts'],
  },
};

module.exports = nextConfig;