/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://127.0.0.1:8080'

const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/v1/:path*', destination: `${API_URL}/v1/:path*` }]
  },
}

module.exports = nextConfig
