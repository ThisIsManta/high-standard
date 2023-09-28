import { execaCommandSync, SyncOptions } from 'execa'

export default function run(command: string, options?: SyncOptions): string {
	const { stdout } = execaCommandSync(command, options)
	return stdout
}
