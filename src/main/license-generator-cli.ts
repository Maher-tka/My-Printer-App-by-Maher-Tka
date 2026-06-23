import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import type { LicensePlan } from '../shared/licensing-types.js'
import {
  createOfflineSerialKey,
  validateOfflineSerialKey
} from './license-serial.js'

type PaidLicensePlan = Exclude<LicensePlan, 'trial'>

interface GeneratorOptions {
  plan?: string
  expiry?: string
  seat?: string
  json: boolean
  plain: boolean
  help: boolean
}

interface SerialKeyResult {
  serialKey: string
  plan: PaidLicensePlan
  planLabel: string
  expiry: string
  expiresAt?: string
  seatCode: string
}

const HELP_TEXT = `My Printer App offline serial-key generator

Usage:
  npm run license:generate
  npm run license:generate -- --plan pro --expiry lifetime
  npm run license:generate -- --plan shop --expiry 2027-12-31 --seat SHOP01

Options:
  -p, --plan <pro|shop>          License plan
  -e, --expiry <value>          "lifetime", YYYY-MM-DD, or YYYYMMDD
  -s, --seat <code>             Optional six-letter/number seat code
      --plain                   Print only the serial key
      --json                    Print machine-readable JSON
  -h, --help                    Show this help

When required options are omitted in a terminal, the generator prompts for them.
Keys are created and verified entirely offline.`

async function main(): Promise<void> {
  try {
    const options = parseArguments(process.argv.slice(2))

    if (options.help) {
      console.log(HELP_TEXT)
      return
    }

    const answers = await collectMissingOptions(options)
    const result = generateSerialKey(answers)

    if (answers.plain) {
      console.log(result.serialKey)
      return
    }

    if (answers.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    console.log('\nOffline serial key created and verified\n')
    console.log(`Plan:    ${result.planLabel}`)
    console.log(`Expiry:  ${result.expiry}`)
    console.log(`Seat:    ${result.seatCode}`)
    console.log(`\nSerial Key\n${result.serialKey}\n`)
    console.log('Paste this key into License > Activate Serial Key in My Printer App.')
  } catch (error) {
    console.error(`Serial key was not created: ${getErrorMessage(error)}`)
    console.error('Run "npm run license:generate -- --help" for usage.')
    process.exitCode = 1
  }
}

function parseArguments(args: string[]): GeneratorOptions {
  const options: GeneratorOptions = {
    json: false,
    plain: false,
    help: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    const [flag, inlineValue] = argument.split('=', 2)

    if (flag === '--help' || flag === '-h') {
      options.help = true
      continue
    }

    if (flag === '--json') {
      options.json = true
      continue
    }

    if (flag === '--plain') {
      options.plain = true
      continue
    }

    if (flag === '--plan' || flag === '-p') {
      const { value, nextIndex } = readOptionValue(args, index, inlineValue, flag)
      options.plan = value
      index = nextIndex
      continue
    }

    if (flag === '--expiry' || flag === '--expires' || flag === '-e') {
      const { value, nextIndex } = readOptionValue(args, index, inlineValue, flag)
      options.expiry = value
      index = nextIndex
      continue
    }

    if (flag === '--seat' || flag === '-s') {
      const { value, nextIndex } = readOptionValue(args, index, inlineValue, flag)
      options.seat = value
      index = nextIndex
      continue
    }

    throw new Error(`Unknown option "${argument}".`)
  }

  if (options.json && options.plain) {
    throw new Error('Choose either --json or --plain, not both.')
  }

  return options
}

async function collectMissingOptions(
  options: GeneratorOptions
): Promise<GeneratorOptions> {
  if (options.plan && options.expiry) {
    return options
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Both --plan and --expiry are required outside an interactive terminal.')
  }

  const prompt = createInterface({ input: stdin, output: stdout })

  try {
    const plan = options.plan ?? (await prompt.question('Plan (Pro or Shop) [Pro]: '))
    const expiry =
      options.expiry ??
      (await prompt.question('Expiry (Lifetime or YYYY-MM-DD) [Lifetime]: '))
    const seat =
      options.seat ??
      (await prompt.question('Seat code (six letters/numbers, blank for random): '))

    return {
      ...options,
      plan: plan.trim() || 'pro',
      expiry: expiry.trim() || 'lifetime',
      seat: seat.trim() || undefined
    }
  } finally {
    prompt.close()
  }
}

function generateSerialKey(options: GeneratorOptions): SerialKeyResult {
  const plan = normalizePlan(options.plan)
  const expiresCode = normalizeExpiry(options.expiry)
  const serialKey = createOfflineSerialKey({
    plan,
    expiresCode,
    ...(options.seat ? { seatCode: options.seat } : {})
  })
  const validation = validateOfflineSerialKey(serialKey)

  if (!validation.ok) {
    throw new Error(validation.error)
  }

  return {
    serialKey,
    plan,
    planLabel: validation.license.planLabel,
    expiry: validation.license.expiresAt
      ? expiresCodeToDisplayDate(expiresCode)
      : 'Lifetime',
    expiresAt: validation.license.expiresAt,
    seatCode: validation.license.seatCode
  }
}

function normalizePlan(value: string | undefined): PaidLicensePlan {
  const normalized = value?.trim().toLowerCase()

  if (normalized === 'pro' || normalized === 'shop') {
    return normalized
  }

  throw new Error('Plan must be Pro or Shop.')
}

function normalizeExpiry(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase()

  if (normalized === 'LIFE' || normalized === 'LIFETIME') {
    return 'LIFE'
  }

  if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized.replace(/-/g, '')
  }

  if (normalized && /^\d{8}$/.test(normalized)) {
    return normalized
  }

  throw new Error('Expiry must be Lifetime or a YYYY-MM-DD date.')
}

function expiresCodeToDisplayDate(expiresCode: string): string {
  return `${expiresCode.slice(0, 4)}-${expiresCode.slice(4, 6)}-${expiresCode.slice(6, 8)}`
}

function readOptionValue(
  args: string[],
  index: number,
  inlineValue: string | undefined,
  flag: string
): { value: string; nextIndex: number } {
  if (inlineValue) {
    return { value: inlineValue, nextIndex: index }
  }

  const value = args[index + 1]

  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value.`)
  }

  return { value, nextIndex: index + 1 }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error.'
}

void main()
