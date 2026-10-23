import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // só em desenvolvimento: deixa abrir o `npm run dev` pelo celular na mesma rede (http://192.168.x.x:3000)
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
