/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['framer-motion', '@quoteseal/ui'],
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
