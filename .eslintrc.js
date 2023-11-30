module.exports = {
  env: {
    es6: true,
    node: true,
    "jest/globals": true,
  },
  extends: ["airbnb-base", "prettier"],
  plugins: ["prettier", "jest"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  rules: {
    "no-await-in-loop": 0,
    "no-restricted-syntax": 0,
  },
};
