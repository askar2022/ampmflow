import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/buscampny", destination: "/buscompany", permanent: false },
      { source: "/bus-company", destination: "/buscompany", permanent: false },
    ];
  },
};

export default nextConfig;
