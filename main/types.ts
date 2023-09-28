import type { Linter } from 'eslint'

declare global {
	export type Dependencies = Record<string, string>

	export type ESLintConfig = Omit<Required<Linter.BaseConfig>, '$schema' | 'noInlineConfig' | 'processor' | 'reportUnusedDisableDirectives' | 'settings'>
}
