import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler readiness rules: too strict for this codebase's established patterns
    // (hydration-safe localStorage reads in effects, R3F imperative mutation in useFrame,
    // "latest ref" to dodge stale closures, window.location assignment). Kept as warnings
    // for visibility rather than as errors that would block CI on pre-existing, working code.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    // Vendored React Bits components: restyled to our tokens on the way in, not held to
    // house lint standards (see CLAUDE.md).
    files: ["src/components/reactbits/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
