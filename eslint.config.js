import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "backend/dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Backend is a Node.js Express service, not a browser bundle.
    files: ["backend/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // shadcn/ui primitives intentionally co-locate cva variant helpers (e.g.
    // buttonVariants) and hooks (useFormField, useSidebar) with their component,
    // and context files co-locate their provider with the consumer hook. This is
    // a deliberate, conventional pattern; the Fast Refresh hint doesn't apply.
    files: ["src/components/ui/**/*.tsx", "src/contexts/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
