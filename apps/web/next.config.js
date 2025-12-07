/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output mode - creates self-contained deployment
  // This bundles all dependencies into .next/standalone
  output: 'standalone',

  // Use trailingSlash for better Netlify compatibility
  trailingSlash: false,

  // Ensure proper asset paths
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',

  // Experimental features for better monorepo support
  experimental: {
    // Resolve modules from the workspace root
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
}

module.exports = nextConfig

