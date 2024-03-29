#!/usr/bin/env node

const fp = require('path')
const fs = require('fs')
const cp = require('child_process')
const _ = require('lodash')
const semver = require('semver')
const detectIndent = require('detect-indent')

function findFile(path, fileName) {
	const textPath = fp.join(path, fileName)
	if (fs.existsSync(textPath)) {
		return textPath
	}

	const { root: rootPath } = fp.parse(path)
	if (path === rootPath) {
		return null
	}

	return findFile(fp.dirname(path), fileName)
}

const moduleVersionHash = require('./package.json').devDependencies

console.log('Looking for a local package.json')

const packagePath = findFile(process.cwd(), 'package.json')
if (fs.existsSync(packagePath)) {
	console.log(`  Found "${packagePath}"`)

} else {
	console.log('  Could not find any package.json')
	process.exit(-1)
}

const packageText = fs.readFileSync(packagePath, 'utf-8')
const packageJson = require(packagePath)

const workingPath = fp.dirname(packagePath)

const indentation = (() => {
	const packageIndent = detectIndent(packageText)
	if (packageIndent.type) {
		return packageIndent
	}

	return {
		type: 'space',
		amount: 2,
		indent: '  ',
	}
})()

console.log('Looking for existing ESLint configurations')

let existingConfigFound = false
if (packageJson.eslintConfig) {
	delete packageJson.eslintConfig
	updatePackageJson()
	console.log(`  Deleted "eslintConfig" field in "${packagePath}"`)
	existingConfigFound = true
}

fs.readdirSync(workingPath)
	.filter(fileName => /^\.eslintrc(\.(js|json|yml))?$/i.test(fileName))
	.forEach(fileName => {
		fs.unlinkSync(fp.join(workingPath, fileName))
		console.log(`  Deleted "${fileName}"`)
		existingConfigFound = true
	})

if (existingConfigFound === false) {
	console.log('  Could not find any existing ESLint configuration')
}

console.log('Looking for a local VSCode settings')

const vscodeSettingsPath = findFile(process.cwd(), fp.join('.vscode', 'settings.json'))
const vscodeSettings = vscodeSettingsPath ? require(vscodeSettingsPath) : null
if (vscodeSettings) {
	if (_.isBoolean(vscodeSettings['editor.insertSpaces'])) {
		indentation.type = vscodeSettings['editor.insertSpaces'] ? 'space' : 'tab'
	}

	if (_.isNumber(vscodeSettings['editor.tabSize'])) {
		indentation.amount = vscodeSettings['editor.tabSize'] || indentation.amount
	}

	indentation.indent = indentation.type === 'space' ? ' '.repeat(indentation.amount) : '\t'
	console.log(`  Found "${vscodeSettingsPath}"`)

} else {
	console.log('  Could not find any local VSCode settings')
}

console.log('Generating ESLint configurations')

const config = {
	parser: 'babel-eslint',
	parserOptions: { sourceType: 'module' },
	env: {
		browser: true,
		node: true,
	},
	globals: {
		document: 'readonly',
		navigator: 'readonly',
		window: 'readonly',
	},
	extends: [],
	plugins: [
		'eslint-plugin-import',
		'eslint-plugin-levitate',
		'eslint-plugin-node',
		'eslint-plugin-promise',
		'eslint-plugin-unicorn',
	],
	rules: {
		'array-bracket-newline': [
			'error',
			'consistent',
		],
		'array-bracket-spacing': [
			'error',
			'never',
		],
		'array-element-newline': [
			'error',
			'consistent',
		],
		'arrow-parens': [
			'error',
			'as-needed',
		],
		'arrow-spacing': 'error',
		'block-spacing': [
			'error',
			'always',
		],
		'brace-style': 'error',
		camelcase: 'warn',
		'comma-dangle': [
			'error',
			'always-multiline',
		],
		'comma-spacing': [
			'error',
			{
				before: false,
				after: true,
			},
		],
		'comma-style': [
			'error',
			'last',
		],
		'computed-property-spacing': [
			'error',
			'never',
		],
		'consistent-return': 'error',
		'constructor-super': 'error',
		curly: [
			'error',
			'all',
		],
		'dot-location': [
			'error',
			'property',
		],
		'dot-notation': [
			'error',
			{ allowKeywords: true },
		],
		'eol-last': [
			'error',
			'always',
		],
		eqeqeq: [
			'error',
			'always',
			{ null: 'ignore' },
		],
		'func-call-spacing': [
			'error',
			'never',
		],
		'generator-star-spacing': [
			'error',
			'after',
		],
		indent: [
			'error',
			indentation.type === 'space' ? indentation.amount : 'tab',
			{ SwitchCase: 1 },
		],
		'key-spacing': [
			'error',
			{
				beforeColon: false,
				afterColon: true,
			},
		],
		'keyword-spacing': [
			'error',
			{
				before: true,
				after: true,
			},
		],
		'lines-between-class-members': [
			'error',
			'always',
			{ exceptAfterSingleLine: true },
		],
		'max-nested-callbacks': [
			'error',
			4,
		],
		'max-statements-per-line': [
			'error',
			{ max: 1 },
		],
		'new-cap': [
			'error',
			{
				newIsCap: true,
				capIsNew: false,
				properties: true,
			},
		],
		'new-parens': 'error',
		'no-array-constructor': 'error',
		'no-async-promise-executor': 'error',
		'no-compare-neg-zero': 'error',
		'no-cond-assign': 'error',
		'no-confusing-arrow': 'error',
		'no-constant-condition': [
			'error',
			{ checkLoops: false },
		],
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
		'no-extra-parens': [
			'error',
			'functions',
		],
		'no-fallthrough': 'error',
		'no-func-assign': 'error',
		'no-global-assign': 'error',
		'no-implicit-coercion': [
			'error',
			{
				allow: [
					'!!',
				],
			},
		],
		'no-implied-eval': 'error',
		'no-inner-declarations': [
			'error',
			'functions',
		],
		'no-invalid-regexp': 'error',
		'no-irregular-whitespace': 'error',
		'no-iterator': 'error',
		'no-labels': [
			'error',
			{
				allowLoop: false,
				allowSwitch: false,
			},
		],
		'no-lone-blocks': 'error',
		'no-misleading-character-class': 'error',
		'no-mixed-spaces-and-tabs': 'error',
		'no-multi-spaces': 'error',
		'no-multi-str': 'error',
		'no-multiple-empty-lines': [
			'error',
			{
				max: 1,
				maxBOF: 0,
				maxEOF: 1,
			},
		],
		'no-nested-ternary': 'error',
		'no-new': 'error',
		'no-new-func': 'error',
		'no-new-object': 'error',
		'no-new-symbol': 'error',
		'no-new-wrappers': 'error',
		'no-obj-calls': 'error',
		'no-octal': 'error',
		'no-octal-escape': 'error',
		'no-promise-executor-return': 'error',
		'no-proto': 'error',
		'no-prototype-builtins': 'error',
		'no-redeclare': [
			'error',
			{ builtinGlobals: false },
		],
		'no-regex-spaces': 'error',
		'no-return-assign': [
			'error',
			'except-parens',
		],
		'no-return-await': 'error',
		'no-self-assign': [
			'error',
			{ props: true },
		],
		'no-self-compare': 'error',
		'no-sequences': 'error',
		'no-shadow-restricted-names': 'error',
		'no-sparse-arrays': 'error',
		'no-template-curly-in-string': 'warn',
		'no-this-before-super': 'error',
		'no-throw-literal': 'error',
		'no-trailing-spaces': 'error',
		'no-undef': 'error',
		'no-undef-init': 'error',
		'no-unexpected-multiline': 'error',
		'no-unmodified-loop-condition': 'error',
		'no-unneeded-ternary': [
			'error',
			{ defaultAssignment: false },
		],
		'no-unreachable': 'error',
		'no-unsafe-finally': 'error',
		'no-unsafe-negation': 'error',
		'no-unused-expressions': [
			'error',
			{
				allowShortCircuit: true,
				allowTernary: true,
				allowTaggedTemplates: true,
			},
		],
		'no-unused-vars': [
			'error',
			{
				vars: 'all',
				args: 'none',
				ignoreRestSiblings: true,
			},
		],
		'no-use-before-define': [
			'error',
			{
				functions: false,
				classes: false,
				variables: false,
			},
		],
		'no-useless-call': 'error',
		'no-useless-catch': 'error',
		'no-useless-computed-key': 'error',
		'no-useless-concat': 'error',
		'no-useless-rename': 'error',
		'no-useless-return': 'error',
		'no-var': 'error',
		'no-whitespace-before-property': 'error',
		'no-with': 'error',
		'object-curly-newline': [
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
		'object-curly-spacing': [
			'error',
			'always',
		],
		'object-property-newline': 'error',
		'object-shorthand': [
			'error',
			'properties',
		],
		'operator-linebreak': [
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
		'padding-line-between-statements': [
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
		'prefer-arrow-callback': 'error',
		'prefer-const': 'error',
		'prefer-promise-reject-errors': 'error',
		'quote-props': [
			'error',
			'as-needed',
		],
		quotes: [
			'error',
			'single',
		],
		'rest-spread-spacing': [
			'error',
			'never',
		],
		semi: [
			'error',
			'never',
		],
		'semi-spacing': [
			'error',
			{
				before: false,
				after: true,
			},
		],
		'space-before-blocks': [
			'error',
			'always',
		],
		'space-before-function-paren': [
			'error',
			{
				anonymous: 'never',
				named: 'never',
				asyncArrow: 'always',
			},
		],
		'space-in-parens': [
			'error',
			'never',
		],
		'space-infix-ops': 'error',
		'space-unary-ops': [
			'error',
			{
				words: true,
				nonwords: false,
			},
		],
		'spaced-comment': [
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
		'symbol-description': 'error',
		'template-curly-spacing': [
			'error',
			'never',
		],
		'template-tag-spacing': [
			'error',
			'never',
		],
		'unicode-bom': [
			'error',
			'never',
		],
		'use-isnan': 'error',
		'valid-typeof': [
			'error',
			{ requireStringLiterals: true },
		],
		'wrap-iife': [
			'error',
			'any',
			{ functionPrototypeMethods: true },
		],
		'yield-star-spacing': [
			'error',
			'after',
		],
		yoda: [
			'error',
			'never',
		],
		'import/export': 'error',
		'import/first': 'error',
		'import/named': 'error',
		'import/no-absolute-path': [
			'error',
			{
				esmodule: true,
				commonjs: true,
				amd: false,
			},
		],
		'import/no-duplicates': 'error',
		'import/no-named-default': 'error',
		'import/no-useless-path-segments': 'error',
		'levitate/comment': 'warn',
		'levitate/import-convention': [
			'error',
			{
				path: '^classnames$',
				default: 'classNames',
			},
		],
		'levitate/new-line-within-statement': [
			'error',
			{ maxLength: 80 },
		],
		'levitate/sort-imports': [
			'error',
			'manta',
		],
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
	overrides: [],
}

const dependencies = _.assign({}, packageJson.devDependencies, packageJson.dependencies)

const nodeVersion = (
	_.get(packageJson, 'engines.node') || _.get(dependencies, '@types/node') ||
	_.get(String(cp.execSync('node --version')).match(/v(\d+\.\d+\.\d+)/), '1')
)
console.log(`  Found Node.js version ${nodeVersion}`)

// See https://eslint.org/docs/user-guide/configuring/language-options#specifying-parser-options
// See https://node.green/
if (semver.satisfies(nodeVersion, '>=16')) {
	config.env.es2021 = true
	config.parserOptions.ecmaVersion = 2021

} else if (semver.satisfies(nodeVersion, '>=14')) {
	config.env.es2020 = true
	config.parserOptions.ecmaVersion = 2020

} else if (semver.satisfies(nodeVersion, '>=12')) {
	config.env.es2017 = true
	config.parserOptions.ecmaVersion = 2019

} else if (semver.satisfies(nodeVersion, '>=10')) {
	config.env.es2017 = true
	config.parserOptions.ecmaVersion = 2018

} else if (semver.satisfies(nodeVersion, '>=9')) {
	config.env.es2017 = true
	config.parserOptions.ecmaVersion = 2017

} else if (semver.satisfies(nodeVersion, '>=7')) {
	config.env.es6 = true
	config.parserOptions.ecmaVersion = 2016

} else {
	config.env.es6 = true
	config.parserOptions.ecmaVersion = 2015
}

if (dependencies.jquery) {
	console.log('  Found jQuery')

	config.env.jquery = true

	config.rules['levitate/import-convention']
		.splice(1, 0, {
			path: '^jquery$',
			default: '$',
		})
}

if (dependencies.jasmine) {
	console.log('  Found Jasmine')
	config.overrides
		.push({
			files: ['**/*.spec.js'],
			env: { jasmine: true },
		})
}

if (dependencies.jest) {
	console.log('  Found Jest')

	config.plugins.push('eslint-plugin-jest')

	config.overrides
		.push({
			files: ['**/*.test.{js,jsx,mjs,ts,tsx}'],
			env: { jest: true },
			rules: {
				'jest/consistent-test-it': [
					'error',
					{
						fn: 'it',
						withinDescribe: 'it',
					},
				],
				'jest/no-alias-methods': 'error',
				'jest/no-commented-out-tests': 'error',
				'jest/no-disabled-tests': 'error',
				'jest/no-duplicate-hooks': 'error',
				'jest/no-export': 'error',
				'jest/no-focused-tests': 'error',
				'jest/no-identical-title': 'error',
				'jest/no-jest-import': 'error',
				'jest/no-test-return-statement': 'warn',
				'jest/no-truthy-falsy': 'warn',
				'jest/no-try-expect': 'warn',
				'jest/prefer-to-be-null': 'error',
				'jest/prefer-to-be-undefined': 'error',
				'jest/prefer-to-contain': 'error',
				'jest/valid-describe': 'error',
				'jest/valid-expect': 'error',
				'jest/valid-title': 'error',
				'levitate/test-case-new-line': 'error',
				'levitate/test-case-title': 'error',
				'lodash/prefer-noop': 'off',
			},
		})
}

if (dependencies.lodash) {
	console.log('  Found Lodash')

	config.plugins.push('eslint-plugin-lodash')

	config.rules['levitate/import-convention']
		.splice(1, 0, {
			path: '^lodash$',
			default: true,
			namespace: true,
		})

	_.assign(config.rules, {
		'lodash/chain-style': [
			'error',
			'explicit',
		],
		'lodash/chaining': [
			'error',
			'always',
		],
		'lodash/collection-method-value': 'error',
		'lodash/identity-shorthand': [
			'warn',
			'never',
		],
		'lodash/import-scope': [
			'error',
			'full',
		],
		'lodash/no-extra-args': 'error',
		'lodash/no-unbound-this': 'error',
		'lodash/path-style': [
			'error',
			'string',
		],
		'lodash/prefer-compact': 'error',
		'lodash/prefer-get': 'error',
		'lodash/prefer-immutable-method': 'warn',
		'lodash/prefer-lodash-typecheck': 'error',
		'lodash/prefer-noop': 'warn',
		'lodash/prefer-reject': 'error',
		'lodash/prop-shorthand': [
			'warn',
			'never',
		],
		'lodash/unwrap': 'error',
	})
}

if (dependencies.react) {
	console.log('  Found React')

	config.plugins.push('eslint-plugin-react')

	_.merge(config, {
		parserOptions: { ecmaFeatures: { jsx: true } },
		settings: {
			react: {
				pragma: 'React',
				version: 'detect',
			},
		},
	})

	config.rules['levitate/import-convention']
		.splice(
			1,
			0,
			{
				path: '^react$',
				default: 'React',
				named: [
					{
						name: '^use[A-Z].*',
					},
				],
			},
			{
				path: '^react-.*',
				default: true,
				named: false,
			}
		)

	_.assign(config.rules, {
		'jsx-quotes': [
			'error',
			'prefer-double',
		],
		'react/destructuring-assignment': [
			'warn',
			'never',
		],
		'react/forbid-foreign-prop-types': 'error',
		'react/forbid-prop-types': [
			'error',
			{
				forbid: [
					'any',
				],
			},
		],
		'react/jsx-boolean-value': 'error',
		'react/jsx-closing-bracket-location': [
			'error',
			'tag-aligned',
		],
		'react/jsx-closing-tag-location': 'error',
		'react/jsx-curly-brace-presence': [
			'error',
			{
				props: 'never',
				children: 'never',
			},
		],
		'react/jsx-curly-newline': [
			'error',
			{
				multiline: 'consistent',
				singleline: 'consistent',
			},
		],
		'react/jsx-curly-spacing': [
			'error',
			{
				attributes: { when: 'never' },
				children: { when: 'never' },
				allowMultiline: true,
			},
		],
		'react/jsx-equals-spacing': [
			'error',
			'never',
		],
		'react/jsx-first-prop-new-line': [
			'error',
			'multiline',
		],
		'react/jsx-fragments': [
			'error',
			'element',
		],
		'react/jsx-indent': [
			'error',
			config.rules.indent[1],
			{
				checkAttributes: true,
				indentLogicalExpressions: true,
			},
		],
		'react/jsx-indent-props': [
			'error',
			config.rules.indent[1],
		],
		'react/jsx-key': 'error',
		'react/jsx-max-props-per-line': [
			'error',
			{
				maximum: 1,
				when: 'multiline',
			},
		],
		'react/jsx-no-duplicate-props': 'error',
		'react/jsx-no-target-blank': [
			'error',
			{ enforceDynamicLinks: 'always' },
		],
		'react/jsx-no-undef': 'error',
		'react/jsx-pascal-case': [
			'error',
			{ allowAllCaps: false },
		],
		'react/jsx-props-no-multi-spaces': 'error',
		'react/jsx-sort-props': ['error', {
			callbacksLast: true,
			ignoreCase: true,
			noSortAlphabetically: true,
			reservedFirst: ['key', 'ref'],
		}],
		'react/jsx-tag-spacing': [
			'error',
			{
				closingSlash: 'never',
				beforeSelfClosing: 'always',
				afterOpening: 'never',
				beforeClosing: 'never',
			},
		],
		'react/jsx-uses-react': 'error',
		'react/jsx-uses-vars': 'error',
		'react/jsx-wrap-multilines': 'off', // In favor of 'levitate/new-line-within-statement'
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
	})

	if (semver.satisfies(dependencies.react, '>=16.8.0')) {
		config.plugins.push('eslint-plugin-react-hooks')

		_.assign(config.rules, {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
		})
	}
}

if (dependencies.typescript) {
	console.log('  Found TypeScript')

	config.parser = '@typescript-eslint/parser'

	config.plugins.push('@typescript-eslint/eslint-plugin')

	config.overrides
		.push({
			files: ['**/*.{ts,tsx}'],
			rules: {
				'brace-style': 'off',
				camelcase: 'off',
				'func-call-spacing': 'off',
				indent: 'off',
				'no-extra-parens': 'off',
				'no-undef': 'off',
				'no-unused-vars': 'off',
				'no-use-before-define': 'off',
				semi: 'off',
				'@typescript-eslint/adjacent-overload-signatures': 'error',
				'@typescript-eslint/array-type': [
					'error',
					{ default: 'generic' },
				],
				'@typescript-eslint/brace-style': config.rules['brace-style'],
				'@typescript-eslint/consistent-type-assertions': 'error',
				'@typescript-eslint/func-call-spacing': [
					'error',
					'never',
				],
				'@typescript-eslint/indent': config.rules.indent,
				'@typescript-eslint/member-delimiter-style': [
					'error',
					{
						multiline: {
							delimiter: 'none',
							requireLast: true,
						},
						singleline: {
							delimiter: 'comma',
							requireLast: false,
						},
					},
				],
				'@typescript-eslint/naming-convention': [
					'warn',
					// Heavily modified from https://github.com/typescript-eslint/typescript-eslint/blob/26d71b57fbff013b9c9434c96e2ba98c6c541259/packages/eslint-plugin/docs/rules/naming-convention.md#enforce-the-codebase-follows-eslints-camelcase-conventions
					{
						selector: 'default',
						format: ['camelCase'],
					},
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
				'@typescript-eslint/no-extra-parens': [
					'error',
					'functions',
				],
				'@typescript-eslint/no-namespace': 'error',
				'@typescript-eslint/no-this-alias': 'error',
				'@typescript-eslint/no-use-before-define': config.rules['no-use-before-define'],
				'@typescript-eslint/prefer-for-of': 'error',
				'@typescript-eslint/semi': config.rules.semi,
				'@typescript-eslint/triple-slash-reference': [
					'error',
					{ types: 'prefer-import' },
				],
				'import/export': 'off',
				'import/named': 'off',
				'levitate/no-top-level-require': 'error',
				'levitate/typescript-explicit-return-type': [
					'error',
					'onlyIfMoreThanOneReturns',
				],
				'levitate/typescript-method-type': 'error',
				...(dependencies.react
					? {
						'levitate/react-prop-type': 'error',
						'react/prop-types': 'off',
					}
					: {}),
				'lodash/prefer-get': config.rules['lodash/prefer-get'] ? 'off' : undefined,
				'lodash/prefer-lodash-typecheck': config.rules['lodash/prefer-lodash-typecheck'] ? 'off' : undefined,
			},
		})

	if (vscodeSettings && !_.includes(vscodeSettings['eslint.validate'], 'typescript')) {
		const newLanguageValidationList = _.union(
			vscodeSettings['eslint.validate'] || [],
			['javascript', 'typescript'],
			dependencies.react ? ['typescriptreact'] : [],
		)

		if (!_.isEqual(vscodeSettings['eslint.validate'], newLanguageValidationList)) {
			vscodeSettings['eslint.validate'] = newLanguageValidationList
			fs.writeFileSync(vscodeSettingsPath, JSON.stringify(vscodeSettings, null, indentation.indent), 'utf-8')
			console.log(`  Updated "eslint.validate" field in "${vscodeSettingsPath}"`)
		}
	}
}

if (dependencies['date-fns']) {
	config.rules['levitate/import-convention']
		.splice(1, 0, {
			path: '^date-fns(\\-|$)',
			default: false,
			namespace: false,
			named: [
				{
					name: '^format$',
					rename: 'formatDate',
				},
			],
		})
}

if (_.isEmpty(config.overrides)) {
	delete config.overrides
}

const requiredDependencies = _.compact([
	'eslint',
	config.parser,
	...config.plugins.map(name => {
		// See https://eslint.org/docs/user-guide/configuring/plugins#use-a-plugin
		if (name.startsWith('eslint-plugin-')) {
			return name
		}

		if (name.startsWith('@') && _.last(name.split('/')) === 'eslint-plugin') {
			return name
		}

		if (name.startsWith('@')) {
			return name + '/eslint-plugin'
		}

		return 'eslint-plugin-' + name
	}),
])

const finalNewLine = packageText.endsWith('\n') ? '\n' : ''

const configPath = fp.join(workingPath, '.eslintrc.json')
config.plugins.sort()
fs.writeFileSync(configPath, JSON.stringify(config, null, indentation.indent) + finalNewLine, 'utf-8')
console.log(`  Updated "${configPath}"`)

console.log('Checking for missing dependencies')

const missingDependencies = _.difference(requiredDependencies, _.keys(dependencies))
if (missingDependencies.length > 0) {
	if (!packageJson.devDependencies) {
		packageJson.devDependencies = {}
	}

	for (const name of missingDependencies) {
		packageJson.devDependencies[name] = moduleVersionHash[name] || '*'
		console.log(`  Added "${name}"`)
	}

	packageJson.devDependencies = _.chain(packageJson.devDependencies)
		.toPairs()
		.sortBy(([name]) => name)
		.fromPairs()
		.value()
	updatePackageJson()
	console.log(`  Updated "${packagePath}"`)
	// TODO: install dependencies

} else {
	console.log('  Found no missing dependencies')
}

function updatePackageJson() {
	fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, indentation.indent) + finalNewLine, 'utf-8')
}
