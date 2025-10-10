import js from "@eslint/js";
import jest from "eslint-plugin-jest";
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

  // Jest configuration for test files
  {
    files: ["**/*.test.js", "**/tests/**/*.js"],
    plugins: {
      jest,
    },
    languageOptions: {
      globals: {
        ...jest.environments.globals.globals,
      },
    },
    rules: {
      ...jest.configs.recommended.rules,
    },
  },

  // Prettier config (must be last to override other formatting rules)
  prettier,
];
