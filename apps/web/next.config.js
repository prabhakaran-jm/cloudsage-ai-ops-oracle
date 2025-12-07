/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use trailingSlash for better Netlify compatibility
  trailingSlash: false,
  // Ensure proper asset paths
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
}

module.exports = nextConfig

