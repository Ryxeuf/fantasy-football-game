/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  env: { es6: true, node: true, browser: true },
  rules: {
    "no-unused-vars": "warn",
  },
  settings: {
    react: { version: "detect" },
  },
};
