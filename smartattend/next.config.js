/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Temporarily disabled to prevent double rendering
  // This line explicitly sets the project root and silences the lockfile warning.
  outputFileTracingRoot: __dirname,
  serverRuntimeConfig: {
    COUCHDB_URL: process.env.COUCHDB_URL,
  },
  
  // Completely disable Fast Refresh to prevent reload loops
  webpack: (config, { dev, isServer }) => {
    // Handle the 'fs' module issue with face-api.js
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }
    
    // Disable Fast Refresh completely in development
    if (dev && !isServer) {
      config.devtool = false;
    }
    
    return config;
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
  
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Compress responses
  compress: true,
  // Generate static exports for better caching
  trailingSlash: false,
};

module.exports = nextConfig;
