#!/usr/bin/env node
import { getLanguage, LANGUAGE_IDS } from './lib/languages.mjs'
import { probeLanguages } from './lib/toolchain.mjs'

const HELP = `Usage: node scripts/check-toolchain.mjs [--language <id>]

One uniform dependency gate for every language. Prints one line per language
and nothing else.

  ts ok registry
  python ok checkout
  ruby fail missing-bin bundle (https://bundler.io)

Exit 0 when every printed language passes. Exit 1 when any fail.
`

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP.trim())
  process.exit(0)
}

let language
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--language' || argv[i] === '-l') {
    language = argv[i + 1]
    i += 1
  } else {
    console.error(`Unknown argument: ${argv[i]}`)
    process.exit(2)
  }
}

if (language) getLanguage(language)

const results = await probeLanguages(language)
for (const result of results) {
  process.stdout.write(`${result.line}\n`)
}

if (results.some(result => !result.ok)) {
  process.stderr.write(
    `Toolchain gate failed. Valid languages: ${LANGUAGE_IDS.join(', ')}.\n` +
      'Install the missing binary, or set SOLVAPAY_SDK_ROOT to a solvapay-sdk checkout.\n',
  )
  process.exit(1)
}
