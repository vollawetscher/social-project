/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // Railway doesn't need standalone build
  // output: 'standalone',
  
  // Increase timeout for static page generation (helps with font fetching)
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;
