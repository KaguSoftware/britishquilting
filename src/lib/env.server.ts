import "server-only";
import { env } from "./env";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
}

/** Server-only environment, with the service role key required rather than optional. */
export const serverEnv = {
  ...env,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
};
