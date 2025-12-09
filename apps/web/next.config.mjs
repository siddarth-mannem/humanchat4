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
  }
};

export default nextConfig;
