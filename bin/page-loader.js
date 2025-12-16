#!/usr/bin/env node
import { Command } from 'commander'
import pageLoader from '../src/index.js'
import debug from 'debug'

const log = debug('page-loader:bin')

const program = new Command()

program
  .version('1.0.0')
  .description('Page loader utility')
  .option('-o, --output [dir]', `output dir (default: "${process.cwd()}")`)
  .arguments('<url>')
  .action((url) => {
    const options = program.opts()
    pageLoader(url, options.output)
      .then((filepath) => {
        console.log(filepath)
      })
      .catch((error) => {
        log(error)

        console.error(error.message)

        process.exit(1)
      })
  })

program.parse(process.argv)
