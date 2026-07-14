/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
