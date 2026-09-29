import type { NextConfig } from "next";
import { env } from "./src/lib/env";

const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseUrl.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
