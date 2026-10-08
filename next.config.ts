import type { NextConfig } from "next";
import { env } from "./src/lib/env";

const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);

/** Products that used to be one per colour, now one product with a colour choice (see the merge migration). */
const MERGED_COLOURS: [from: string, to: string, colour: string][] = [
  ["ivory-cotton-sateen-lining", "cotton-sateen-lining", "ivory"],
  ["white-cotton-sateen-lining", "cotton-sateen-lining", "white"],
  ["cream-cotton-sateen-lining", "cotton-sateen-lining", "cream"],
  ["charcoal-blackout-lining", "blackout-lining", "charcoal"],
  ["coloured-sateen-aubergine", "coloured-sateen-lining", "aubergine"],
  ["coloured-sateen-sage", "coloured-sateen-lining", "sage"],
];

const nextConfig: NextConfig = {
  async redirects() {
    return MERGED_COLOURS.map(([from, to, colour]) => ({
      source: `/product/${from}`,
      destination: `/product/${to}?colour=${colour}`,
      permanent: true,
    }));
  },
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
