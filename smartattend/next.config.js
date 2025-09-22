/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This line explicitly sets the project root and silences the lockfile warning.
  outputFileTracingRoot: __dirname,
  serverRuntimeConfig: {
    COUCHDB_URL: process.env.COUCHDB_URL,
  },
  // PWA and Service Worker configuration
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/sw.js',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Add this webpack config to handle the 'fs' module issue with face-api.js
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }
    return config;
  },
  // Enable experimental features for better PWA support
  experimental: {
    esmExternals: false,
  },
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Compress responses
  compress: true,
  // Generate static exports for better caching
  trailingSlash: false,
};

module.exports = nextConfig;
