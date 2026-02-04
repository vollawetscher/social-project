/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  output: 'standalone',
  // Exclude v0-original staging folder from build
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/v0-original/**', '**/node_modules/**'],
    }
    return config
  },
};

module.exports = nextConfig;
