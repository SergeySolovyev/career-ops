import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@careerpilot/core', '@careerpilot/db', '@careerpilot/config'],
}

export default nextConfig
