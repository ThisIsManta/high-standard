/* eslint-disable jest/valid-title, levitate/test-case-title */

const fp = require('path')
const fs = require('fs')
const cp = require('child_process')
const _ = require('lodash')

jest.setTimeout(30000)

const testingPaths = fs.readdirSync(__dirname)
	.filter(name => !name.startsWith('__'))
	.map(name => fp.join(__dirname, name))
	.filter(path => fs.lstatSync(path).isDirectory())

for (const directoryPath of testingPaths) {
	describe(fp.basename(directoryPath), () => {
		beforeAll(() => {
			cp.spawnSync('node', ['../../index.js'], { cwd: directoryPath })
		})

		it('generates the same package.json', async () => {
			const fileText = await fs.promises.readFile(fp.join(directoryPath, 'package.json'), { encoding: 'utf-8' })

			expect(fileText).toMatchSnapshot()
		})

		it('generates the same ESLint configuration file', async () => {
			const fileText = await fs.promises.readFile(fp.join(directoryPath, '.eslintrc.json'), { encoding: 'utf-8' })

			expect(fileText).toMatchSnapshot()
		})

		it('yields the same linting results', () => {
			const results = cp.spawnSync(
				fp.join(process.cwd(), 'node_modules', '.bin', 'eslint'),
				['.', '--format compact', '--ext .js', '--ext .ts', '--ext .tsx'],
				{
					cwd: directoryPath,
					shell: true,
				}
			).stdout.toString()

			const normalizedResults = _.chain(results.split('\n'))
				.dropRight(2)
				.map(line => line.replace(new RegExp('^' + _.escapeRegExp(__dirname)), '').replace(/\\/g, '/').replace(/^\//, ''))
				.value()
				.join('\n')

			expect(normalizedResults).toMatchSnapshot()
		})
	})
}
