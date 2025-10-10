module.exports = {
  env: {
    es2022: true,
    node: true,
    "jest/globals": true,
  },
  extends: ["airbnb-base", "prettier"],
  plugins: ["prettier", "jest"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    "no-await-in-loop": 0,
    "no-restricted-syntax": 0,
  },
};
