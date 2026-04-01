import { defineConfig, globalIgnores } from "eslint/config";

import eslintConfigPrettier from "eslint-config-prettier";
import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  eslintConfigPrettier,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
