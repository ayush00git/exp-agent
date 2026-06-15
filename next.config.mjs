/** @type {import('next').NextConfig} */
const nextConfig = {
  // The T3 SDK is an ESM package that loads a WASM component (via @bytecodealliance/jco).
  // Keep it out of the webpack/turbopack bundle so it is required at runtime from
  // node_modules with its WASM assets intact. Without this, the WASM load fails.
  experimental: {
    serverComponentsExternalPackages: ["@terminal3/t3n-sdk"],
  },
};

export default nextConfig;
