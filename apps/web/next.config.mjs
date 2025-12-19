import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const appDir = dirname(fileURLToPath(new URL('.', import.meta.url)));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async redirects() {
    return [
      {
        source: '/profile',
        destination: '/account',
        permanent: true
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
