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
    // Guard the DO-300 fix: assigning `<x>.location.href` triggers a full-document
    // reload, which flashes the screen black during the blank swap. This is a SPA —
    // navigate away with React Router's navigate() instead. Scoped to the frontend
    // (the backend has no `window`/`location`).
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.property.name='href'][left.object.type='MemberExpression'][left.object.property.name='location']",
          message:
            "Assigning location.href triggers a full-page reload (black-screen flash — see DO-300). Use React Router's navigate() instead.",
        },
      ],
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
