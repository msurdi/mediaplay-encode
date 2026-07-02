import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
  // Global ignores
  {
    ignores: ["node_modules/**", "coverage/**", "*.tgz", ".*.js"],
  },

  // Apply to all JavaScript files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node.js globals
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        exports: "readonly",
        global: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
      },
    },
    rules: {
      // Use ESLint's recommended rules
      ...js.configs.recommended.rules,

      // Custom rules from your original config
      "no-await-in-loop": "off",
      "no-restricted-syntax": "off",
      "no-constant-condition": "off",

      // Additional recommended rules for modern JavaScript
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "template-curly-spacing": "error",
      "arrow-spacing": "error",
      "no-duplicate-imports": "error",
    },
  },

  // Prettier config (must be last to override other formatting rules)
  prettier,
];
