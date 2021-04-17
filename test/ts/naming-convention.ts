export const camelCase1 = 1
export class camelCase2 { }
interface camelCase3 { }
export interface camelCase4 { }
export type camelCase5 = {}
export enum camelCase6 { }

export const PascalCase1 = 1
export class PascalCase2 { }
interface PascalCase3 { }
export interface PascalCase4 { }
export interface IPascalCase4 { }
export type PascalCase6 = {}
export enum PascalCase7 { }

declare global {
  interface Window { }
}

interface X {
  camelCase: string
  PascalCase: string
  snake_case: string
  'dash-case': string
}

const Y = {
  camelCase: 1,
  PascalCase: 1,
  snake_case: 1,
  'dash-case': 1,
}

enum PascalCaseEnum { }
enum camelCaseEnum { }

const { no_Check } = { no_Check: 1 } as any
