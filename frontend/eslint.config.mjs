import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import checkFile from "eslint-plugin-check-file"
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";
import eslintConfigPrettier from 'eslint-config-prettier'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
})

const eslintConfig = defineConfig([
  // 1. Global Ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  
  // 2. Base Recommended Configs
  ...nextVitals,
  ...nextTs,
  ...tailwind.configs["flat/recommended"],

  // 3. Backward compatibility for legacy plugins
  ...compat.config({
    extends: [
      "plugin:import/errors",
      "plugin:import/warnings",
      "plugin:import/typescript",
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
      "plugin:testing-library/react",
      "plugin:jest-dom/recommended",
    ],
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: {},
      },
    },
  }),
  
  // 4. Main rules
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    settings: {
      tailwindcss: {
        callees: ["classnames", 'clsx', "ctl", "cva", "cn"],
        config: {},
        cssFiles: [
          "**/*.css",
          "!**/node_modules",
          "!**/.*",
          "!**/dist",
          "!**/build",
        ]
      }
    },
    rules: {
      "@next/next/no-img-element": "off",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "jsx-a11y/anchor-is-valid": "off",
      "linebreak-style": ["error", "unix"],

      // Unused variables management
      "@typescript-eslint/no-unused-vars": ["error"],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",

      // Imports, sorting and cycles
      "import/no-cycle": "error",
      "import/default": "off",
      "import/no-named-as-default-member": "off",
      "import/no-named-as-default": "off",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // Enforce imports from @ alias (src). Disallow relative imports and bare "src/*" imports — prefer "@/..."
      "import/no-relative-parent-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            "./*",
            "../*",
            "src/*"
          ]
        }
      ],

      // Architectural boundaries (Bulletproof React core)
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // disables cross-feature imports:
            {
              target: "./src/features/auth",
              from: "./src/features",
              except: ["./auth"],
            },
            {
              target: "./src/features/comments",
              from: "./src/features",
              except: ["./comments"],
            },
            {
              target: "./src/features/discussions",
              from: "./src/features",
              except: ["./discussions"],
            },
            {
              target: "./src/features/teams",
              from: "./src/features",
              except: ["./teams"],
            },
            {
              target: "./src/features/users",
              from: "./src/features",
              except: ["./users"],
            },

            // enforce unidirectional codebase:
            {
              target: "./src/features",
              from: "./src/app",
            },

            // shared modules boundary
            {
              target: [
                "./src/components",
                "./src/hooks",
                "./src/lib",
                "./src/types",
                "./src/utils",
              ],
              from: ["./src/features", "./src/app"],
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*"],
    plugins: {
      "check-file": checkFile,
    },
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        {
          "**/*.{ts,tsx}": "KEBAB_CASE",
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "!(src/app)/**/*": "KEBAB_CASE",
          "!(**/__tests__)/**/*": "KEBAB_CASE",
        },
      ],
    },
  },
  eslintConfigPrettier
]);

export default eslintConfig;
