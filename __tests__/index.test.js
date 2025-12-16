import { fileURLToPath } from 'url'
import path, { dirname } from 'path'
import os from 'os'
import fs from 'fs/promises'
import nock from 'nock'
import { expect, test, beforeEach } from '@jest/globals'
import pageLoader from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const getFixturePath = filename => path.join(__dirname, '..', '__fixtures__', filename)

let tempDir

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'))
})

test('page-loader with all resources', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const expectedHtmlFilename = 'ru-hexlet-io-courses.html'
  const expectedResourceDirName = 'ru-hexlet-io-courses_files'
  const expectedImageFilename = 'ru-hexlet-io-assets-professions-nodejs.png'
  const expectedCssFilename = 'ru-hexlet-io-assets-application.css'
  const expectedJsFilename = 'ru-hexlet-io-packs-js-runtime.js'
  const expectedCanonicalHtmlFilename = 'ru-hexlet-io-courses.html'
  const imageFilepath = path.join(tempDir, expectedResourceDirName, expectedImageFilename)
  const cssFilepath = path.join(tempDir, expectedResourceDirName, expectedCssFilename)
  const jsFilepath = path.join(tempDir, expectedResourceDirName, expectedJsFilename)
  const canonicalHtmlFilepath = path.join(tempDir, expectedResourceDirName, expectedCanonicalHtmlFilename)

  const html = await fs
    .readFile(getFixturePath('page-with-all-resources.html'), 'utf-8')

  const image = await fs
    .readFile(getFixturePath('assets/professions/nodejs.png'))

  const css = await fs
    .readFile(getFixturePath('assets/application.css'), 'utf-8')

  const js = await fs
    .readFile(getFixturePath('packs/js/runtime.js'), 'utf-8')

  const canonicalHtml = await fs
    .readFile(getFixturePath('page-with-all-resources.html'), 'utf-8')

  const expectedModifiedHtml = await fs
    .readFile(
      getFixturePath(
        'expected-modified-page-with-all-resources.html'),
      'utf-8',
    )

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, html)

  nock('https://ru.hexlet.io')
    .get('/assets/professions/nodejs.png')
    .reply(200, image)

  nock('https://ru.hexlet.io')
    .get('/assets/application.css')
    .reply(200, css)

  nock('https://ru.hexlet.io')
    .get('/packs/js/runtime.js')
    .reply(200, js)

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, canonicalHtml)

  const htmlFilepath = await pageLoader(url, tempDir)

  expect(htmlFilepath)
    .toBe(path.join(tempDir, expectedHtmlFilename))

  expect(await fs.readFile(htmlFilepath, 'utf-8'))
    .toEqual(expectedModifiedHtml)

  expect(await fs.readFile(imageFilepath))
    .toEqual(image)

  expect(await fs.readFile(cssFilepath, 'utf-8'))
    .toEqual(css)

  expect(await fs.readFile(jsFilepath, 'utf-8'))
    .toEqual(js)

  expect(await fs.readFile(canonicalHtmlFilepath, 'utf-8'))
    .toEqual(canonicalHtml)
}, 10000)

test('page-loader with resources', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const expectedHtmlFilename = 'ru-hexlet-io-courses.html'
  const expectedResourceDirName = 'ru-hexlet-io-courses_files'
  const expectedImageFilename = 'ru-hexlet-io-assets-professions-nodejs.png'
  const imageFilepath = path.join(tempDir, expectedResourceDirName, expectedImageFilename)

  const html = await fs
    .readFile(
      getFixturePath('page-with-image.html'),
      'utf-8',
    )

  const image = await fs
    .readFile(getFixturePath('assets/professions/nodejs.png'))

  const expectedModifiedHtml = await fs.readFile(getFixturePath('expected-modified-page.html'), 'utf-8')

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, html)

  nock('https://ru.hexlet.io')
    .get('/assets/professions/nodejs.png')
    .reply(200, image)

  const htmlFilepath = await pageLoader(url, tempDir)

  expect(htmlFilepath)
    .toBe(path.join(tempDir, expectedHtmlFilename))

  expect(await fs.readFile(htmlFilepath, 'utf-8'))
    .toEqual(expectedModifiedHtml)

  expect(await fs.readFile(imageFilepath))
    .toEqual(image)
})

test('page-loader', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const expectedFilename = 'ru-hexlet-io-courses.html'

  const responseData = await fs
    .readFile(
      getFixturePath('ru-hexlet-io-courses.html'),
      'utf-8',
    )

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, responseData)

  const filepath = await pageLoader(url, tempDir)

  expect(filepath)
    .toBe(path.join(tempDir, expectedFilename))

  expect(await fs.readFile(filepath, 'utf-8'))
    .toEqual(responseData)
})

test('page-loader with trailing slash', async () => {
  const url = 'https://ru.hexlet.io/'
  const expectedFilename = 'ru-hexlet-io.html'

  const responseData = await fs
    .readFile(
      getFixturePath('ru-hexlet-io-courses.html'),
      'utf-8',
    )

  nock('https://ru.hexlet.io')
    .get('/')
    .reply(200, responseData)

  const filepath = await pageLoader(url, tempDir)

  expect(filepath)
    .toBe(path.join(tempDir, expectedFilename))

  expect(await fs.readFile(filepath, 'utf-8'))
    .toEqual(responseData)
})

test('page-loader http error', async () => {
  const url = 'https://ru.hexlet.io/courses'

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(404)

  await expect(pageLoader(url, tempDir))
    .rejects
    .toThrow('Request failed with status code 404')
})

test('page-loader filesystem error', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const nonExistentDir = path.join(tempDir, 'non-existent')

  const responseData = await fs
    .readFile(
      getFixturePath('ru-hexlet-io-courses.html'),
      'utf-8',
    )

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, responseData)

  await expect(pageLoader(url, nonExistentDir))
    .rejects
    .toThrow('ENOENT')
})
