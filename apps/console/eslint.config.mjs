import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: [".next/**", ".source/**", "storybook-static/**", "playwright-report/**", "test-results/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.mjs"], languageOptions: { globals: { URL: "readonly", process: "readonly", fetch: "readonly", setTimeout: "readonly" } }, rules: { "no-empty": ["error", { allowEmptyCatch: true }] } },
  { files: ["next-env.d.ts"], rules: { "@typescript-eslint/triple-slash-reference": "off" } },
  { files: ["**/*.{ts,tsx,js,jsx}"], plugins: { react, "react-hooks": reactHooks }, settings: { react: { version: "detect" } }, rules: { "react/react-in-jsx-scope": "off", "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }], "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" } },
);
