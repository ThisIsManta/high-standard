/* eslint-disable jest/valid-title, levitate/test-case-title */

const fp = require('path')
const fs = require('fs')
const cp = require('child_process')

jest.setTimeout(30000)

const testingPaths = fs.readdirSync(fp.join(__dirname, 'test'))
	.map(fileName => fp.join(__dirname, 'test', fileName))
	.filter(fullPath => fs.lstatSync(fullPath).isDirectory())

for (const directoryPath of testingPaths) {
	describe(fp.basename(directoryPath), () => {
		beforeAll(() => {
			cp.spawnSync('node', ['index.js'], { cwd: directoryPath })
		})

		it('generates the same ESLint configuration file', async () => {
			const fileText = await fs.promises.readFile(fp.join(directoryPath, '.eslintrc.json'), { encoding: 'utf-8' })

			expect(fileText).toMatchSnapshot()
		})

		it('yields the same linting results', () => {
			const results = String(cp.spawnSync(
				fp.join(process.cwd(), 'node_modules', '.bin', 'eslint'),
				['.', '--ext .js', '--ext .ts', '--ext .tsx'],
				{
					cwd: directoryPath,
					shell: true,
				}
			).stdout)

			expect(results).toMatchSnapshot()
		})
	})
}
