import * as fp from 'path'
import * as fs from 'fs'
import * as cp from 'child_process'
import * as _ from 'lodash'
import { ESLint } from 'eslint'
import { describe, it, expect } from 'vitest'
import { createConfig } from '../edge/config'

const underTestingPathList = fs.readdirSync(__dirname, { withFileTypes: true })
	.filter(file => !file.name.startsWith('__') && file.isDirectory())
	.map(file => fp.join(file.parentPath, file.name))

for (const directoryPath of underTestingPathList) {
	it(fp.basename(directoryPath), async () => {
		const configList = createConfig(directoryPath)

		// Strip off implementation detail objects
		for (const config of configList) {
			if (config.plugins) {
				for (const pluginName in config.plugins) {
					_.set(config.plugins, pluginName, true)
				}
			}

			if (_.has(config, 'languageOptions.parser')) {
				_.set(config, 'languageOptions.parser', true)
			}
		}

		expect(configList).toMatchFileSnapshot(fp.join(directoryPath, 'eslint.config.js.snap'))
	})

	const filePathList = fs.readdirSync(directoryPath, { withFileTypes: true })
		.filter(file => file.isFile() && /\.((m|c)?(j|t)s)$/.test(file.name))
		.map(file => fp.join(file.parentPath, file.name))

	for (const filePath of filePathList) {
		it(fp.basename(directoryPath) + ' » ' + fp.basename(filePath), async () => {
			const fileText = await fs.promises.readFile(filePath, 'utf-8')

			const baseConfig = createConfig(directoryPath)

			const [{ messages }] = await new ESLint({
				overrideConfigFile: true,
				baseConfig,
				fix: false,
			}).lintText(fileText, { filePath })

			expect(
				messages.map(({ severity, message, ruleId, line, column }) =>
					`${severity === 1 ? 'warn' : 'error'} ${line}:${column} [${ruleId}] ${message}`
				).join('\n')
			).toMatchFileSnapshot(filePath + '.messages.snap')

			const [{ output }] = await new ESLint({
				overrideConfigFile: true,
				baseConfig,
				fix: true,
			}).lintText(fileText, { filePath })

			expect(output).toMatchFileSnapshot(filePath + '.output.snap')
		})
	}
}
