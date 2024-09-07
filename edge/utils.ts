import * as fp from 'path'
import * as fs from 'fs'

export function findFileOutward(directoryPath: string, fileName: string) {
	const path = fp.join(directoryPath, fileName)
	if (fs.existsSync(path)) {
		return path
	}

	const { root: rootPath } = fp.parse(directoryPath)
	if (directoryPath === rootPath) {
		return null
	}

	return findFileOutward(fp.dirname(directoryPath), fileName)
}
