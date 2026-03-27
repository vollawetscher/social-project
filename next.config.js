const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  staticPageGenerationTimeout: 120,
  experimental: {
    serverComponentsExternalPackages: ['ffmpeg-static'],
  },
}

module.exports = withNextIntl(nextConfig)
