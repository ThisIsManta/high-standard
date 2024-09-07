#!/usr/bin/env node

import * as fs from 'fs'
import * as fp from 'path'
import { parseArguments } from '@thisismanta/pessimist'
import chalk from 'chalk'
import { ESLint, type Linter } from 'eslint'
import _ from 'lodash'
import YAML from 'yaml'
import { findFileOutward } from './utils'

main().then((fatalErrorCount) => {
	process.exitCode = fatalErrorCount
})

async function main(): Promise<number> {
	const rootPath = process.cwd()

	const nodeModulePath = findFileOutward(rootPath, 'node_modules') || fp.join(rootPath, 'node_modules')

	const {
		inputPathList,
		cache,
		fix,
		updateAllowlist,
		warnings,
		typeChecking,
		progress,
	} = await getCommandArguments()

	type RelativeFilePath = string
	type RuleId = string
	const allowlistFilePath = 'eslint.allowlist.yml'
	const allowlist: Record<RelativeFilePath, Record<RuleId, number>> =
		fs.existsSync(allowlistFilePath)
			? YAML.parse(fs.readFileSync(allowlistFilePath, 'utf-8')) || {}
			: {}

	const startTime = Date.now()

	// See https://eslint.org/docs/latest/integrate/nodejs-api#eslint-class
	const engine = new ESLint({
		cwd: rootPath,

		fix,

		cache,
		cacheLocation: fp.join(nodeModulePath, '.cache', 'eslint'),
		cacheStrategy: 'content', // Do not use 'metadata' as it does not work on CI

		// Speed up the process by skipping rules that have warning severity
		ruleFilter: fix || warnings ? undefined : ({ severity }) => severity === 2,

		overrideConfigFile: fp.resolve(__dirname, '..', require('../package.json').main),

		// Speed up the process by disabling type checking and the related rules
		// See https://typescript-eslint.io/getting-started/typed-linting/#how-is-performance
		overrideConfig: typeChecking
			? undefined
			: (await import('typescript-eslint')).configs.disableTypeChecked as Linter.Config,
	})

	if (progress) {
		console.log('')
		console.log('⏳ Linting...')
	}

	const results = await engine.lintFiles(inputPathList)
	if (fix) {
		await ESLint.outputFixes(results)
	}

	let fatalErrorCount = 0
	let whitelistedErrorCount = 0
	for (const { filePath, messages, fixableErrorCount, fixableWarningCount } of results) {
		if (messages.length === 0) {
			continue
		}

		const relativePath = fp
			.relative(rootPath, filePath)
			.replace(/\\/g, fp.posix.sep) // Normalize path separators for Windows

		const nonFixableItems = fix ? messages.filter((item) => !item.fix) : messages
		if (nonFixableItems.length === 0) {
			continue
		}

		const totalErrorItems = nonFixableItems.filter((item) => item.severity === 2)
		const errorCountMap = _.countBy(totalErrorItems, (error) => error.ruleId)
		if (updateAllowlist) {
			allowlist[relativePath] = _.chain(errorCountMap)
				.toPairs()
				.sortBy(([ruleId]) => ruleId)
				.fromPairs()
				.value()
		}

		const fatalErrorItems = totalErrorItems.filter(
			(error) =>
				!error.ruleId ||
				errorCountMap[error.ruleId] >
				(allowlist[relativePath]?.[error.ruleId] || 0)
		)

		fatalErrorCount += fatalErrorItems.length
		whitelistedErrorCount += totalErrorItems.length - fatalErrorItems.length

		const warningItems = warnings
			? nonFixableItems.filter((item) => item.severity === 1)
			: []

		function sort(items: Linter.LintMessage[]) {
			return _.sortBy(
				items,
				({ ruleId }) => ruleId?.includes('/') ? 1 : 0,
				({ ruleId }) => ruleId,
				({ line }) => line,
				({ column }) => column,
			)
		}

		const reportingItems = [
			...sort(fatalErrorItems),
			...sort(warningItems),
		]
		if (reportingItems.length === 0) {
			continue
		}

		console.log('')
		console.log(chalk.black.bold(relativePath) + `:${reportingItems[0]?.line}` + (fixableErrorCount + fixableWarningCount > 0 ? ' 🔧' : ''))

		const lineDigitCount = (
			_.maxBy(reportingItems, (item) => item.line)?.line || 0
		).toString().length
		const columnDigitCount = (
			_.maxBy(reportingItems, (item) => item.column)?.column || 0
		).toString().length

		for (const { severity, line, column, ruleId, message } of reportingItems) {
			console.log(
				' ' + (severity === 2 ? '🔺' : '🔻'),
				..._.compact([
					typeof line === 'number' && typeof column === 'number' && `${line.toString().padStart(lineDigitCount)}:${column.toString().padEnd(columnDigitCount)}`,
					ruleId && `[${ruleId}]`,
					(severity === 2 ? chalk.red : chalk.yellow)(message),
				]),
			)
		}
	}

	if (progress) {
		console.log('')
	}

	if (updateAllowlist) {
		if (progress) {
			console.log('🛂 Updated', allowlistFilePath)
		}

		const normalizedWhitelist = _.chain(allowlist)
			.toPairs()
			.sortBy(([filePath]) => filePath)
			.fromPairs()
			.value()
		fs.writeFileSync(
			allowlistFilePath,
			YAML.stringify(normalizedWhitelist),
			'utf-8'
		)
	}

	const timeSpent = Number(((Date.now() - startTime) / 1000).toFixed(2))

	const totalWarningCount = warnings
		? _.sumBy(results, (result) => result.warningCount)
		: NaN

	if (progress) {
		printStats([
			['📄 ', results.length, 'file', _.identity],
			['🟢 ', whitelistedErrorCount, 'whitelisted error', _.identity],
			['🟡', totalWarningCount, 'warning', chalk.yellow],
			['🔴 ', fatalErrorCount, 'error', chalk.red],
			['⏱  ', timeSpent, 'second', _.identity],
		])
	}

	return fatalErrorCount
}

async function getCommandArguments(): Promise<{
	inputPathList: string[]
	cache: boolean
	fix: boolean
	updateAllowlist: boolean
	warnings: boolean
	typeChecking: boolean
	progress: boolean
}> {
	const commandLineArguments = process.argv.slice(2)
	if (process.env.CI || commandLineArguments.length > 0) {
		const {
			cache,
			fix,
			updateAllowlist,
			warnings,
			typeChecking,
			progress,
			...inputPathList
		} = parseArguments(
			commandLineArguments,
			{
				cache: false,
				fix: false,
				updateAllowlist: false,
				warnings: false,
				typeChecking: true,
				progress: true,
			},
			{
				aliases: [
					['f', 'fix'],
					['u', 'updateAllowlist'],
					['w', 'warnings'],
				],
				exclusives: [['fix', 'updateAllowlist']],
			}
		)
		return {
			inputPathList: Array.from(inputPathList),
			cache,
			fix,
			updateAllowlist,
			warnings,
			typeChecking,
			progress,
		}
	}

	const { select, confirm } = await import('@inquirer/prompts')
	const action = await select({
		message: 'What do you want to do?',
		choices: [
			{ value: 'Run with cache (--cache)' },
			{ value: 'Run without cache (--no-cache)' },
			{ value: 'Fix auto-fixable errors (--fix)' },
			{ value: 'Put errors into the allowlist (--update-allowlist)' },
		],
	})

	const warnings = action.startsWith('Run')
		? await confirm({
			message: 'Do you want to enable warnings?',
			default: false,
		})
		: action.includes('--fix')

	return {
		inputPathList: [],
		cache: action.includes('--cache'),
		fix: action.includes('--fix'),
		updateAllowlist: action.includes('--update-allowlist'),
		warnings,
		typeChecking: true,
		progress: true,
	}
}

function printStats(lines: Array<[string, number, string, (text: string) => string]> = []) {
	const countableLines = lines.filter(
		([, count]) => !isNaN(count) && Number.isFinite(count)
	)

	const longest = Math.max(
		3,
		...countableLines.map(([, count]) => count.toLocaleString().length)
	)

	for (const [indicator, count, unit, paint] of countableLines) {
		console.log(
			indicator,
			paint(
				count.toLocaleString().padStart(longest) +
				' ' +
				unit +
				(count === 1 ? '' : 's')
			)
		)
	}
}
