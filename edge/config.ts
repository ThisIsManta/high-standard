import * as fp from 'path'
import * as fs from 'fs'
import * as cp from 'child_process'
import * as _ from 'lodash'
import { globSync } from 'glob'
import isVersionGreaterOrEqual from 'semver/functions/gte'
import areVersionsCompatible from 'semver/ranges/intersects'
import parseVersion from 'semver/functions/coerce'
import detectIndent from 'detect-indent'
import { findFileOutward } from './utils'
import globals from 'globals'
import { Linter } from 'eslint'
import { fixupPluginRules } from '@eslint/compat'
import JSON5 from 'json5'
import * as ts from 'typescript'
import { parseBoolean } from '@thisismanta/pessimist'
import parseGitignore from 'parse-gitignore'

export function createConfig(inputPath: string): Array<Linter.Config> {
	const debug: (...args: Array<any>) => void = parseBoolean(process.env.DEBUG) ? console.debug : _.noop

	debug('Looking for a local package.json')
	const packagePath = findFileOutward(inputPath, 'package.json')
	if (packagePath) {
		debug(`  Found "${packagePath}"`)

	} else {
		throw new Error('Expected package.json to be found.')
	}

	// TODO: support multiple package.json files (e.g. PNPM workspaces)
	const packageText = fs.readFileSync(packagePath, 'utf-8')
	const packageJson = require(packagePath) as Partial<{
		type: 'module' | 'commonjs'
		browser: string
		main: string
		bin: string | Record<string, string>
		packageManager: string
		devDependencies: Record<string, string>
		dependencies: Record<string, string>
		eslintConfig: never
	}>

	const rootPath = fp.dirname(packagePath)

	debug('Looking for a local VSCode settings')
	const vscodeSettingsPath = findFileOutward(inputPath, fp.join('.vscode', 'settings.json'))
	const vscodeSettings = vscodeSettingsPath ? JSON5.parse(fs.readFileSync(vscodeSettingsPath, 'utf-8')) : null
	if (vscodeSettings) {
		debug(`  Found "${vscodeSettingsPath}"`)

	} else {
		debug('  Could not find any local VSCode settings')
	}

	const indent = ((): 'tab' | number => {
		if (vscodeSettings) {
			if (vscodeSettings['editor.insertSpaces'] === true) {
				return vscodeSettings['editor.tabSize'] || 2
			}

			if (vscodeSettings['editor.insertSpaces'] === false) {
				return 'tab'
			}
		}

		const indentOfPackageJson = detectIndent(packageText)
		if (indentOfPackageJson.type === 'space') {
			return indentOfPackageJson.amount
		}

		return 'tab'
	})()

	const dependencies = {
		...packageJson.devDependencies,
		...packageJson.dependencies,
	}

	debug('Checking Node.js version')
	const pnpm = packageJson.packageManager?.startsWith('pnpm@') || !!findFileOutward(rootPath, 'pnpm-lock.yaml')
	if (pnpm) {
		debug('  Found PNPM')
	}

	const nodeVersion = parseVersion(
		parseVersion(_.get(packageJson, 'engines.node', ''))?.version ||
		pnpm && cp.execSync('pnpm exec node --version').toString().trim() ||
		cp.execSync('node --version').toString().trim()
	)
	debug(`  Found Node.js version ${nodeVersion}`)

	// See https://eslint.org/docs/latest/use/configure/language-options#specifying-parser-options
	// See https://node.green/
	const ecmaVersion = (() => {
		if (packageJson.browser) {
			return 'latest'
		}

		if (!nodeVersion) {
			return undefined
		}

		if (isVersionGreaterOrEqual(nodeVersion, '23.0.0')) {
			return 2025

		} else if (isVersionGreaterOrEqual(nodeVersion, '21.7.3')) {
			return 2024

		} else if (isVersionGreaterOrEqual(nodeVersion, '20.11.0')) {
			return 2023

		} else if (isVersionGreaterOrEqual(nodeVersion, '17.1.0')) {
			return 2022

		} else if (isVersionGreaterOrEqual(nodeVersion, '16.0.0')) {
			return 2021

		} else if (isVersionGreaterOrEqual(nodeVersion, '14.0.0')) {
			return 2020

		} else if (isVersionGreaterOrEqual(nodeVersion, '12.0.0')) {
			return 2019

		} else if (isVersionGreaterOrEqual(nodeVersion, '10.0.0')) {
			return 2018

		} else if (isVersionGreaterOrEqual(nodeVersion, '9.0.0')) {
			return 2017

		} else if (isVersionGreaterOrEqual(nodeVersion, '7.0.0')) {
			return 2016

		} else {
			return 2015
		}
	})()

	debug('Generating ESLint configurations')

	const baseConfig = {
		name: 'base',
		languageOptions: {
			ecmaVersion,
			sourceType: packageJson.type,
			globals: Object.assign(
				{},
				globals.node,
				(
					packageJson.browser ||
					dependencies.jquery ||
					dependencies['react-dom']
				) && globals.browser,
				typeof ecmaVersion === 'number' && _.get(globals, 'es' + ecmaVersion),
			),
			parserOptions: {
				ecmaFeatures: {
					jsx: !!dependencies.react,
				},
			},
		},
		plugins: {
			'@stylistic': require('@stylistic/eslint-plugin'),
			import: fixupPluginRules(require('eslint-plugin-import')),
			levitate: require('eslint-plugin-levitate'),
			node: fixupPluginRules(require('eslint-plugin-node')),
			promise: require('eslint-plugin-promise'),
			unicorn: require('eslint-plugin-unicorn'),
		},
		rules: {
			'@stylistic/array-bracket-newline': ['error', 'consistent'],
			'@stylistic/array-bracket-spacing': ['error', 'never'],
			'@stylistic/array-element-newline': ['error', 'consistent'],
			'@stylistic/arrow-parens': ['error', 'as-needed'],
			'@stylistic/arrow-spacing': 'error',
			'@stylistic/block-spacing': ['error', 'always'],
			'@stylistic/brace-style': 'error',
			'@stylistic/comma-dangle': ['error', 'always-multiline'],
			'@stylistic/comma-spacing': ['error', { before: false, after: true }],
			'@stylistic/comma-style': ['error', 'last'],
			'@stylistic/computed-property-spacing': ['error', 'never'],
			'@stylistic/dot-location': ['error', 'property'],
			'@stylistic/eol-last': ['error', 'always'],
			'@stylistic/func-call-spacing': ['error', 'never'],
			'@stylistic/function-call-argument-newline': ['error', 'consistent'],
			'@stylistic/function-call-spacing': ['error', 'never'],
			'@stylistic/function-paren-newline': ['error', 'multiline'],
			'@stylistic/generator-star-spacing': ['error', { 'before': false, 'after': true }],
			'@stylistic/indent': ['error', indent, { SwitchCase: 1 }],
			'@stylistic/indent-binary-ops': ['error', indent],
			'@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
			'@stylistic/keyword-spacing': ['error', { before: true, after: true }],
			'@stylistic/line-comment-position': ['error', { position: 'above' }],
			'@stylistic/linebreak-style': ['error', 'unix'],
			'@stylistic/lines-around-comment': 'off', // Conflict with padding-line-between-statements
			'@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
			'@stylistic/max-statements-per-line': ['error', { max: 1 }],
			'@stylistic/multiline-comment-style': ['error', 'separate-lines'],
			'@stylistic/new-parens': ['error', 'always'],
			'@stylistic/no-confusing-arrow': 'error',
			'@stylistic/no-extra-parens': ['error', 'functions'],
			'@stylistic/no-floating-decimal': 'error',
			'@stylistic/no-mixed-operators': 'error',
			'@stylistic/no-mixed-spaces-and-tabs': 'error',
			'@stylistic/no-multi-spaces': 'error',
			'@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
			'@stylistic/no-trailing-spaces': 'error',
			'@stylistic/no-whitespace-before-property': 'error',
			'@stylistic/nonblock-statement-body-position': ['error', 'beside'],
			'@stylistic/object-curly-newline': [
				'error',
				{
					ObjectExpression: {
						multiline: true,
						consistent: true,
					},
					ObjectPattern: 'never',
					ImportDeclaration: 'never',
					ExportDeclaration: {
						multiline: true,
						consistent: true,
					},
				},
			],
			'@stylistic/object-curly-spacing': ['error', 'always'],
			'@stylistic/object-property-newline': 'error',
			'@stylistic/operator-linebreak': [
				'error',
				'after',
				{
					overrides: {
						'?': 'before',
						':': 'before',
						'|>': 'before',
					},
				},
			],
			'@stylistic/padding-line-between-statements': [
				'error',

				// 'use strict'
				{
					blankLine: 'always',
					prev: 'directive',
					next: '*',
				},

				{
					blankLine: 'always',
					prev: '*',
					next: 'block-like',
				},

				// Group declarations together with its immediate instructions as they are usually tightly coupled
				{
					blankLine: 'never',
					prev: ['singleline-const', 'singleline-let', 'singleline-var'],
					next: 'block-like',
				},

				// Group fall-through switch-cases; See https://eslint.org/docs/rules/no-fallthrough
				{
					blankLine: 'never',
					prev: 'case',
					next: 'case',
				},

				// Ensure having an ending new line after a block
				{
					blankLine: 'always',
					prev: 'block-like',
					next: '*',
				},

				// Isolate function and try-catch keywords as they are usually independent
				{
					blankLine: 'always',
					prev: '*',
					next: ['function', 'try'],
				},

				// Group instructions by declarations and exit keywords
				{
					blankLine: 'always',
					prev: 'expression',
					next:
						[
							'const',
							'let',
							'var',
							'export',
							'cjs-export',
							'return',
							'throw',
							'break',
							'continue',
						],
				},
			],
			'@stylistic/quote-props': ['error', 'as-needed'],
			'@stylistic/quotes': ['error', 'single'],
			'@stylistic/rest-spread-spacing': ['error', 'never'],
			'@stylistic/semi': ['error', 'never'],
			'@stylistic/semi-spacing': ['error', { before: false, after: true }],
			'@stylistic/space-before-blocks': ['error', 'always'],
			'@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
			'@stylistic/space-in-parens': ['error', 'never'],
			'@stylistic/space-infix-ops': 'error',
			'@stylistic/space-unary-ops': ['error', { words: true, nonwords: false }],
			'@stylistic/spaced-comment': [
				'error',
				'always',
				{
					line: {
						markers: [
							'*package',
							'!',
							'/',
							',',
							'=',
						],
					},
					block: {
						balanced: true,
						markers: [
							'*package',
							'!',
							',',
							':',
							'::',
							'flow-include',
						],
						exceptions: [
							'*',
						],
					},
				},
			],
			'@stylistic/switch-colon-spacing': ['error', { before: false, after: true }],
			'@stylistic/template-curly-spacing': ['error', 'never'],
			'@stylistic/template-tag-spacing': ['error', 'never'],
			'@stylistic/wrap-iife': ['error', 'any', { functionPrototypeMethods: true }],
			'@stylistic/yield-star-spacing': ['error', 'after'],

			camelcase: 'warn',
			'consistent-return': 'error',
			'constructor-super': 'error',
			curly: ['error', 'all'],
			'dot-notation': ['error', { allowKeywords: true }],
			eqeqeq: ['error', 'always', { null: 'ignore' }],
			'max-nested-callbacks': ['error', 4],
			'new-cap': ['error', { newIsCap: true, capIsNew: false, properties: true }],
			'no-array-constructor': 'error',
			'no-async-promise-executor': 'error',
			'no-compare-neg-zero': 'error',
			'no-cond-assign': 'error',
			'no-constant-condition': ['error', { checkLoops: false }],
			'no-control-regex': 'error',
			'no-debugger': 'error',
			'no-delete-var': 'error',
			'no-dupe-args': 'error',
			'no-dupe-class-members': 'error',
			'no-dupe-keys': 'error',
			'no-duplicate-case': 'error',
			'no-else-return': 'error',
			'no-empty': 'error',
			'no-empty-character-class': 'error',
			'no-empty-pattern': 'error',
			'no-eval': 'error',
			'no-ex-assign': 'error',
			'no-extend-native': 'error',
			'no-extra-bind': 'error',
			'no-extra-boolean-cast': 'error',
			'no-fallthrough': 'error',
			'no-func-assign': 'error',
			'no-global-assign': 'error',
			'no-implicit-coercion': ['error', { allow: ['!!'] }],
			'no-implied-eval': 'error',
			'no-inner-declarations': ['error', 'functions'],
			'no-invalid-regexp': 'error',
			'no-irregular-whitespace': 'error',
			'no-iterator': 'error',
			'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
			'no-lone-blocks': 'error',
			'no-misleading-character-class': 'error',
			'no-multi-str': 'error',
			'no-nested-ternary': 'error',
			'no-new': 'error',
			'no-new-func': 'error',
			'no-new-native-nonconstructor': 'error',
			'no-object-constructor': 'error',
			'no-new-wrappers': 'error',
			'no-obj-calls': 'error',
			'no-octal': 'error',
			'no-octal-escape': 'error',
			'no-promise-executor-return': 'error',
			'no-proto': 'error',
			'no-prototype-builtins': 'error',
			'no-redeclare': ['error', { builtinGlobals: false }],
			'no-regex-spaces': 'error',
			'no-return-assign': ['error', 'except-parens'],
			'no-self-assign': ['error', { props: true }],
			'no-self-compare': 'error',
			'no-sequences': 'error',
			'no-shadow-restricted-names': 'error',
			'no-sparse-arrays': 'error',
			'no-template-curly-in-string': 'warn',
			'no-this-before-super': 'error',
			'no-throw-literal': 'error',
			'no-undef': 'error',
			'no-undef-init': 'error',
			'no-unexpected-multiline': 'error',
			'no-unmodified-loop-condition': 'error',
			'no-unneeded-ternary': ['error', { defaultAssignment: false }],
			'no-unreachable': 'error',
			'no-unsafe-finally': 'error',
			'no-unsafe-negation': 'error',
			'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
			'no-unused-vars': ['error', { vars: 'all', args: 'none', ignoreRestSiblings: true }],
			'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
			'no-useless-call': 'error',
			'no-useless-catch': 'error',
			'no-useless-computed-key': 'error',
			'no-useless-rename': 'error',
			'no-useless-return': 'error',
			'no-var': 'error',
			'no-with': 'error',
			'object-shorthand': ['error', 'properties'],
			'prefer-arrow-callback': 'error',
			'prefer-const': 'error',
			'prefer-promise-reject-errors': 'error',
			'symbol-description': 'error',
			'unicode-bom': ['error', 'never'],
			'use-isnan': 'error',
			'valid-typeof': ['error', { requireStringLiterals: true }],
			yoda: ['error', 'never'],

			'import/export': 'error',
			'import/first': 'error',
			'import/named': 'error',
			'import/no-absolute-path': ['error', { esmodule: true, commonjs: true, amd: false }],
			'import/no-duplicates': 'error',
			'import/no-named-default': 'error',
			'import/no-useless-path-segments': 'error',

			'levitate/comment': 'warn',
			'levitate/consecutive-block-new-line': 'error',
			'levitate/import-convention': [
				'error',
				..._.compact([
					dependencies.classnames && {
						path: '^classnames$',
						default: 'classNames',
					},
					dependencies.jquery && {
						path: '^jquery$',
						default: '$',
					},
					dependencies.react && {
						path: '^react$',
						default: 'React',
						named: [
							{
								name: '^use[A-Z].*',
							},
						],
					},
					dependencies.react && {
						path: '^react-.*',
						default: true,
						named: false,
					},
					dependencies['date-fns'] && {
						path: '^date-fns(\\-|$)',
						default: false,
						namespace: false,
						named: [
							{
								name: '^format$',
								rename: 'formatDate',
							},
						],
					},
				])
			],
			'levitate/parameter-new-line': 'error',
			'levitate/sort-imports': ['error', 'manta'],

			'node/handle-callback-err': ['error', 'error'],
			'node/no-deprecated-api': 'warn',
			'node/no-new-require': 'error',
			'node/no-path-concat': 'error',
			'node/process-exit-as-throw': 'error',

			'promise/param-names': 'error',

			'unicorn/catch-error-name': ['error', { name: 'error' }],
			'unicorn/error-message': 'error',
			'unicorn/escape-case': 'error',
			'unicorn/explicit-length-check': ['error', { 'non-zero': 'greater-than' }],
			'unicorn/import-index': 'error',
			'unicorn/no-for-loop': 'error',
			'unicorn/no-unreadable-array-destructuring': 'error',
			'unicorn/number-literal-case': 'error',
			'unicorn/prefer-event-key': 'error',
			'unicorn/throw-new-error': 'error',
		},
	} satisfies Linter.Config

	const configResolvers: Array<() => Array<Linter.Config>> = [
		() => {
			const gitignorePathList = globSync('**/.gitignore', {
				ignore: ['**/node_modules/**'],
				cwd: rootPath,
				absolute: true,
			})
			if (gitignorePathList.length === 0) {
				return []
			}

			debug('  Found .gitignore')

			return gitignorePathList.map(gitignorePath => ({
				name: 'gitignore:' + fp.relative(rootPath, gitignorePath),
				ignores: parseGitignore(fs.readFileSync(gitignorePath, 'utf-8')).map(originalGlob => {
					const absoluteGlob = fp.join(fp.dirname(gitignorePath), originalGlob.replace(/^!/, ''))
					const relativeGlob = fp.relative(rootPath, absoluteGlob)
					return (originalGlob.startsWith('!') ? '!' : '') + relativeGlob
				})
			}))
		},

		() => {
			if (!dependencies.jquery) {
				return []
			}

			debug('  Found jQuery')

			return [{
				name: 'jquery',
				languageOptions: {
					globals: globals.jquery,
				},
			}]
		},

		() => {
			if (!dependencies.jasmine) {
				return []
			}

			debug('  Found Jasmine')

			return [{
				name: 'jasmine',
				files: ['**/*.spec.js'],
				languageOptions: {
					globals: globals.jasmine,
				},
			}]
		},

		() => {
			if (!dependencies.jest) {
				return []
			}

			debug('  Found Jest')

			return [{
				name: 'jest',
				files: ['**/*.test.{js,jsx,mjs,ts,tsx}'], // TODO: read from jest.config
				languageOptions: {
					globals: globals.jest,
				},
				plugins: {
					jest: require('eslint-plugin-jest'),
				},
				rules: {
					'jest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
					'jest/no-alias-methods': 'error',
					'jest/no-commented-out-tests': 'error',
					'jest/no-disabled-tests': 'error',
					'jest/no-duplicate-hooks': 'error',
					'jest/no-export': 'error',
					'jest/no-focused-tests': 'error',
					'jest/no-identical-title': 'error',
					'jest/no-test-return-statement': 'error',
					'jest/prefer-to-be': 'error',
					'jest/prefer-to-contain': 'error',
					'jest/prefer-to-have-length': 'error',
					"jest/valid-describe-callback": "error",
					'jest/valid-expect': 'error',

					'levitate/test-case-new-line': 'error',
					'levitate/test-case-title': 'error',

					'lodash/prefer-noop': 'off',
				}
			}]
		},

		() => {
			if (!dependencies['@testing-library/jest-dom']) {
				return []
			}

			debug('  Found Testing Library - Jest DOM')

			return [{
				name: '@testing-library/jest-dom',
				files: ['**/*.test.{js,jsx,mjs,ts,tsx}'], // TODO: read from jest.config
				plugins: {
					'jest-dom': require('eslint-plugin-jest-dom'),
				},
				rules: {
					'jest-dom/prefer-enabled-disabled': 'error',
					'jest-dom/prefer-to-have-attribute': 'error',
					'jest-dom/prefer-to-have-class': 'error',
					'jest-dom/prefer-to-have-text-content': 'error',
					'jest-dom/prefer-to-have-value': 'error',
				}
			}]
		},

		() => {
			if (!dependencies.vitest) {
				return []
			}

			debug('  Found Vitest')

			return [{
				name: 'vitest',
				files: ['**/*.test.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
				plugins: {
					vitest: require('eslint-plugin-vitest')
				},
				rules: {
					'levitate/test-case-group': 'warn',
					'levitate/test-case-new-line': 'error',
					'levitate/test-case-title': 'error',

					'lodash/prefer-noop': 'off',

					'unicorn/catch-error-name': 'off',
					'unicorn/error-message': 'off',

					'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
					'vitest/expect-expect': 'error',
					'vitest/no-alias-methods': 'error',
					'vitest/no-commented-out-tests': 'error',
					'vitest/no-conditional-in-test': 'warn',
					'vitest/no-disabled-tests': 'error',
					'vitest/no-duplicate-hooks': 'error',
					'vitest/no-focused-tests': 'error',
					'vitest/no-identical-title': 'error',
					'vitest/no-standalone-expect': 'error',
					'vitest/no-test-return-statement': 'warn',
					'vitest/prefer-to-be': 'error',
					'vitest/prefer-to-contain': 'error',
					'vitest/prefer-to-have-length': 'error',
					'vitest/valid-describe-callback': 'error',
					'vitest/valid-expect': 'error',
				}
			}]
		},

		() => {
			if (!dependencies.lodash) {
				return []
			}

			debug('  Found Lodash')

			return [{
				name: 'lodash',
				plugins: {
					lodash: require('eslint-plugin-lodash')
				},
				rules: {
					'lodash/chain-style': ['error', 'explicit'],
					'lodash/collection-method-value': 'error',
					'lodash/identity-shorthand': ['warn', 'never'],
					'lodash/import-scope': ['error', 'method'],
					'lodash/no-extra-args': 'error',
					'lodash/no-unbound-this': 'error',
					'lodash/path-style': ['error', 'string'],
					'lodash/prefer-compact': 'error',
					'lodash/prefer-immutable-method': 'warn',
					'lodash/prefer-noop': 'warn',
					'lodash/prefer-reject': 'error',
					'lodash/prop-shorthand': ['warn', 'never'],
					'lodash/unwrap': 'error',
				}
			}]
		},

		() => {
			if (!dependencies.react) {
				return []
			}

			debug('  Found React')

			return [{
				name: 'react',
				languageOptions: {
					parserOptions: {
						ecmaFeatures: {
							jsx: true
						}
					},
				},
				plugins: {
					react: require('eslint-plugin-react')
				},
				settings: {
					react: {
						pragma: 'React',
						version: 'detect',
					},
				},
				rules: {
					'@stylistic/jsx-child-element-spacing': 'error',
					'@stylistic/jsx-closing-bracket-location': ['error', 'tag-aligned'],
					'@stylistic/jsx-closing-tag-location': 'error',
					'@stylistic/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
					'@stylistic/jsx-curly-newline': ['error', { multiline: 'consistent', singleline: 'consistent' }],
					'@stylistic/jsx-curly-spacing': ['error', { attributes: { when: 'never' }, children: { when: 'never' }, allowMultiline: true }],
					'@stylistic/jsx-equals-spacing': ['error', 'never'],
					'@stylistic/jsx-first-prop-new-line': ['error', 'multiline'],
					'@stylistic/jsx-function-call-newline': ['error', 'multiline'],
					'@stylistic/jsx-indent': ['error', indent, { checkAttributes: true, indentLogicalExpressions: true }],
					'@stylistic/jsx-indent-props': ['error', indent],
					'@stylistic/jsx-max-props-per-line': ['error', { maximum: 1, when: 'multiline' }],
					'@stylistic/jsx-newline': ['error', { prevent: false }],
					'@stylistic/jsx-one-expression-per-line': ['error', { allow: 'single-line' }],
					'@stylistic/jsx-pascal-case': ['error', { allowAllCaps: false, allowLeadingUnderscore: false, allowNamespace: false }],
					'@stylistic/jsx-props-no-multi-spaces': 'error',
					'@stylistic/jsx-quotes': ['error', 'prefer-double'],
					'@stylistic/jsx-self-closing-comp': 'error',
					'@stylistic/jsx-sort-props': ['error', { callbacksLast: true, ignoreCase: true, noSortAlphabetically: true, reservedFirst: ['key', 'ref'] }],
					'@stylistic/jsx-tag-spacing': ['error', { closingSlash: 'never', beforeSelfClosing: 'always', afterOpening: 'never', beforeClosing: 'never' }],
					'@stylistic/jsx-wrap-multilines': ['error', { declaration: 'parens-new-line', assignment: 'parens-new-line', return: 'parens-new-line', arrow: 'parens-new-line', condition: 'parens-new-line', logical: 'parens-new-line', prop: 'parens-new-line', propertyValue: 'parens-new-line' }],

					'react/destructuring-assignment': ['warn', 'never'],
					'react/forbid-foreign-prop-types': 'error',
					'react/forbid-prop-types': ['error', { forbid: ['any'] }],
					'react/jsx-boolean-value': 'error',
					'react/jsx-fragments': ['error', 'element'],
					'react/jsx-key': 'error',
					'react/jsx-no-duplicate-props': 'error',
					'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],
					'react/jsx-no-undef': 'error',
					'react/jsx-uses-react': 'error',
					'react/jsx-uses-vars': 'error',
					'react/no-access-state-in-setstate': 'error',
					'react/no-children-prop': 'error',
					'react/no-danger-with-children': 'error',
					'react/no-deprecated': 'warn',
					'react/no-direct-mutation-state': 'error',
					'react/no-redundant-should-component-update': 'error',
					'react/no-string-refs': 'error',
					'react/no-typos': 'error',
					'react/react-in-jsx-scope': 'error',
					'react/require-render-return': 'error',
					'react/self-closing-comp': 'error',
					'react/sort-comp': [
						'error',
						{
							order: [
								'constructor',
								'lifecycle',
								'everything-else',
								'/^on.+$/',
								'/^render.+$/',
								'render',
							],
						},
					],

					'levitate/react-new-line': 'error',
				}
			}]
		},

		() => {
			if (!dependencies.react || !areVersionsCompatible(dependencies.react, '>=16.8.0')) {
				return []
			}

			debug('  Found React Hooks')

			return [{
				name: 'react-hooks',
				plugins: {
					'react-hooks': fixupPluginRules(require('eslint-plugin-react-hooks'))
				},
				rules: {
					'react-hooks/rules-of-hooks': 'error',
					'react-hooks/exhaustive-deps': 'warn',
				}
			}]
		},

		() => {
			if (!dependencies.typescript) {
				return []
			}

			debug('  Found TypeScript')

			return globSync('**/tsconfig.json', {
				ignore: ['**/node_modules/**'],
				cwd: rootPath,
				absolute: true,
			}).map(tsconfigPath => {
				const directoryPath = fp.dirname(tsconfigPath)

				const tsconfigFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
				const { options: compilerOptions } = ts.parseJsonConfigFileContent(tsconfigFile.config, ts.sys, directoryPath)

				const topLevelOptions = JSON5.parse(fs.readFileSync(tsconfigPath, 'utf-8')) as { files?: Array<string>, include?: Array<string>, exclude?: Array<string> }

				const commaSeparatedFileExtensionList = Object.entries({
					'ts,mts,cts': true,
					'tsx': compilerOptions.jsx,
					'js,mjs,cjs': compilerOptions.allowJs,
					'jsx': compilerOptions.jsx && compilerOptions.allowJs,
				}).filter(([, value]) => value).map(([key]) => key).join(',')

				const files = (topLevelOptions.include || ['**/*'])
					.map(path => fp.posix.join(path.replace(/(\\|\/)\*$/, ''), '*.{' + commaSeparatedFileExtensionList + '}'))
					.concat(
						topLevelOptions.files?.map(path => fp.posix.join(directoryPath, path)) || []
					)
					.map(path => fp.posix.resolve(directoryPath, path))
					.map(path => fp.posix.relative(rootPath, path))

				const ignores = (topLevelOptions.exclude || [])
					.map(path => fp.posix.join(path.replace(/\/\*\*?$/, ''), '**', '*'))
					.map(path => fp.posix.resolve(directoryPath, path))
					.map(path => fp.posix.relative(rootPath, path))

				const ecmaVersion = (() => {
					if (compilerOptions.target === ts.ScriptTarget.ESNext) {
						return 'latest'
					}

					const value = parseInt(String(compilerOptions.target).match(/es(\d+)/i)?.[1] ?? '')
					return isNaN(value) ? undefined : value
				})() as Linter.ParserOptions['ecmaVersion']

				return {
					name: 'typescript:' + fp.relative(rootPath, tsconfigPath).replace(/\\/g, fp.posix.sep),
					files,
					ignores,
					languageOptions: {
						parser: require('@typescript-eslint/parser'),
						parserOptions: {
							project: fp.relative(directoryPath, tsconfigPath),
							tsconfigRootDir: directoryPath,
							ecmaVersion,
							jsx: !!compilerOptions.jsx,
						}
					},
					plugins: {
						'@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
					},
					rules: {
						camelcase: 'off',
						'no-undef': 'off',
						'no-unused-vars': 'off',
						'no-use-before-define': 'off',

						'@stylistic/member-delimiter-style': [
							'error',
							{
								multiline: {
									delimiter: 'none',
									requireLast: false,
								},
								singleline: {
									delimiter: 'comma',
									requireLast: false,
								},
							},
						],
						'@stylistic/type-annotation-spacing': [
							'error',
							{
								before: true, after: true,
								overrides: {
									colon: { before: false, after: true },
									arrow: { before: true, after: true },
								},
							},
						],
						'@stylistic/type-generic-spacing': 'error',
						'@stylistic/type-named-tuple-spacing': 'error',

						'@typescript-eslint/adjacent-overload-signatures': 'error',
						'@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
						'@typescript-eslint/consistent-type-assertions': 'error',
						'@typescript-eslint/naming-convention': [
							'warn', // Heavily modified from https://github.com/typescript-eslint/typescript-eslint/blob/26d71b57fbff013b9c9434c96e2ba98c6c541259/packages/eslint-plugin/docs/rules/naming-convention.md#enforce-the-codebase-follows-eslints-camelcase-conventions
							{
								selector: 'variable',
								format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
							},
							{
								selector: 'function',
								format: ['camelCase', 'PascalCase'],
							},
							{
								selector: ['variable', 'parameter'],
								modifiers: ['destructured'],
								format: null,
							},
							{
								selector: 'parameter',
								format: ['camelCase'],
								leadingUnderscore: 'allow',
							},
							{
								selector: ['typeLike', 'enumMember'],
								format: ['PascalCase'],
							},
							{
								selector: 'interface',
								modifiers: ['exported'],
								format: ['PascalCase'],
								prefix: ['I'],
							},
							{
								selector: 'memberLike',
								modifiers: ['private'],
								format: ['camelCase'],
								leadingUnderscore: 'allowSingleOrDouble',
							},
							{
								selector: 'memberLike',
								format: ['camelCase', 'snake_case'],
								leadingUnderscore: 'allowSingleOrDouble',
							},
							{
								selector: ['memberLike', 'objectLiteralProperty'],
								modifiers: ['requiresQuotes'],
								format: null,
							},
							{
								selector: 'objectLiteralProperty',
								format: ['camelCase', 'snake_case'],
								leadingUnderscore: 'allowSingleOrDouble',
								trailingUnderscore: 'allowSingleOrDouble',
							},
						],
						'@typescript-eslint/no-namespace': 'error',
						'@typescript-eslint/no-this-alias': 'error',
						'@typescript-eslint/no-use-before-define': baseConfig.rules['no-use-before-define'],
						'@typescript-eslint/prefer-for-of': 'error',
						'@typescript-eslint/triple-slash-reference': ['error', { types: 'prefer-import' }],

						'import/export': 'off',
						'import/named': 'off',

						'levitate/no-top-level-require': 'error',
						'levitate/typescript-explicit-return-type': ['error', { allowJSX: true, allowNonExports: true, allowSingleValueReturns: true }],
						'levitate/typescript-method-type': 'error',
						'levitate/react-prop-type': dependencies.react ? 'error' : undefined,

						'react/react-in-jsx-scope': compilerOptions.jsx === ts.JsxEmit.ReactJSX || compilerOptions.jsx === ts.JsxEmit.ReactJSXDev ? 'off' : undefined,
						'react/jsx-uses-react': compilerOptions.jsx === ts.JsxEmit.ReactJSX || compilerOptions.jsx === ts.JsxEmit.ReactJSXDev ? 'off' : undefined,
					},
				}
			})
		},

		() => {
			if ((!dependencies.prettier)) {
				return []
			}

			debug('  Found Prettier')

			const prettierConfig = require('eslint-config-prettier')

			// Conflict with Prettier
			return [{
				name: 'prettier',
				rules: prettierConfig.rules,
			}]
		}
	]

	const outputConfigs = [
		baseConfig,
		...configResolvers
			.flatMap(resolver => resolver())
			.filter(config => typeof config === 'object' && config !== null && !_.isEmpty(config)),
	].map((config: Linter.Config) => {
		if (_.isEmpty(config.files)) {
			delete config.files
		}

		if (_.isEmpty(config.ignores)) {
			delete config.ignores
		}

		// Fix the error from ESLint extension for VS Code when sourceType is undefined
		if (config.languageOptions && 'sourceType' in config.languageOptions && config.languageOptions.sourceType === undefined) {
			delete config.languageOptions.sourceType
		}

		// See https://eslint.org/docs/latest/use/configure/language-options#specifying-globals:~:text=10-,Tip,-For%20historical%20reasons
		if (config.languageOptions?.globals) {
			for (const name in config.languageOptions.globals) {
				if (typeof config.languageOptions.globals[name] === 'boolean') {
					config.languageOptions.globals[name] = config.languageOptions.globals[name] ? 'writable' : 'readonly'
				}
			}
		}

		if (config.rules) {
			for (const name in config.rules) {
				if (config.rules[name] === undefined) {
					delete config.rules[name]
				}
			}
		}

		return config
	})

	debug('Generated configs:', outputConfigs)

	return outputConfigs
}
