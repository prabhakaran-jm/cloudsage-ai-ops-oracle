/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use static export for Netlify to avoid server-side issues
  output: 'export',
  // Disable image optimization (not needed for static export)
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

