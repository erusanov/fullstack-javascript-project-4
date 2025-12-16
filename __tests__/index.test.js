import { fileURLToPath } from 'url'
import path, { dirname } from 'path'
import os from 'os'
import fs from 'fs/promises'
import nock from 'nock'
import { expect, test, beforeEach } from '@jest/globals'
import { load } from 'cheerio'
import pageLoader from '../src/index.js'

nock.disableNetConnect()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const getFixturePath = filename => path.join(__dirname, '..', '__fixtures__', filename)
const normalizeHtml = html => load(html).html()

const BASE_URL = 'https://ru.hexlet.io'

const API = {
  COURSES: '/courses',
  IMAGE: '/assets/professions/nodejs.png',
  CSS: '/assets/application.css',
  JS: '/packs/js/runtime.js',
}

const PATHS = {
  IMAGE: 'assets/professions/nodejs.png',
  CSS: 'assets/application.css',
  JS: 'packs/js/runtime.js',
}

const RESPONSE = {
  OK: 200,
  NOT_FOUND: 404,
}

const FILES = {
  HTML: 'ru-hexlet-io-courses.html',
  RESOURCES_DIR: 'ru-hexlet-io-courses_files',
  IMAGE: 'ru-hexlet-io-assets-professions-nodejs.png',
  CSS: 'ru-hexlet-io-assets-application.css',
  JS: 'ru-hexlet-io-packs-js-runtime.js',
  CANONICAL_HTML: 'ru-hexlet-io-courses.html',
  EXPECTED: 'expected.html',
}

let tempDir
let getTempPath

const URL = `${BASE_URL}${API.COURSES}`

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'))
  getTempPath = (...paths) => path.join(tempDir, ...paths)
})

test('page-loader with all resources', async () => {
  const html = await fs.readFile(getFixturePath(FILES.HTML), 'utf-8')
  const image = await fs.readFile(getFixturePath(PATHS.IMAGE))
  const css = await fs.readFile(getFixturePath(PATHS.CSS), 'utf-8')
  const js = await fs.readFile(getFixturePath(PATHS.JS), 'utf-8')
  const expectedHtml = normalizeHtml(await fs.readFile(getFixturePath(FILES.EXPECTED), 'utf-8'))

  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.OK, html)

  nock(BASE_URL)
    .get(API.IMAGE)
    .reply(RESPONSE.OK, image)

  nock(BASE_URL)
    .get(API.CSS)
    .reply(RESPONSE.OK, css)

  nock(BASE_URL)
    .get(API.JS)
    .reply(RESPONSE.OK, js)

  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.OK, html)

  const htmlFilepath = await pageLoader(URL, tempDir)

  expect(htmlFilepath)
    .toBe(getTempPath(FILES.HTML))

  await expect(fs.readFile(htmlFilepath, 'utf-8'))
    .resolves
    .toEqual(expectedHtml)

  await expect(fs.readFile(getTempPath(FILES.RESOURCES_DIR, FILES.IMAGE)))
    .resolves
    .toEqual(image)

  await expect(fs.readFile(getTempPath(FILES.RESOURCES_DIR, FILES.CSS), 'utf-8'))
    .resolves
    .toEqual(css)

  await expect(fs.readFile(getTempPath(FILES.RESOURCES_DIR, FILES.JS), 'utf-8'))
    .resolves
    .toEqual(js)

  await expect(fs.readFile(getTempPath(FILES.RESOURCES_DIR, FILES.CANONICAL_HTML), 'utf-8'))
    .resolves
    .toEqual(html)
})

test('page-loader http error on page', async () => {
  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.NOT_FOUND)

  await expect(pageLoader(URL, tempDir))
    .rejects
    .toThrow(`Failed to download page ${URL}: Request failed with status code ${RESPONSE.NOT_FOUND}`)
})

test('page-loader http error on resource', async () => {
  const html = await fs.readFile(getFixturePath(FILES.HTML), 'utf-8')

  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.OK, html)

  nock(BASE_URL)
    .get(API.IMAGE)
    .reply(RESPONSE.NOT_FOUND)

  nock(BASE_URL)
    .get(API.CSS)
    .reply(RESPONSE.OK, 'css data')

  nock(BASE_URL)
    .get(API.JS)
    .reply(RESPONSE.OK, 'js data')

  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.OK, 'html data')

  await expect(pageLoader(URL, tempDir))
    .rejects
    .toThrow(`Failed to download resource ${BASE_URL}${API.IMAGE}: Request failed with status code ${RESPONSE.NOT_FOUND}`)
})

test('page-loader filesystem error on saving page', async () => {
  const html = '<html><body><h1>Hello, World!</h1></body></html>'

  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.OK, html)

  const nonExistentDir = path.join(tempDir, 'non-existent')

  await expect(pageLoader(URL, nonExistentDir))
    .rejects
    .toThrow(`Failed to save page to ${path.join(nonExistentDir, FILES.HTML)}`)
})

test('page-loader filesystem error on creating resource dir', async () => {
  const html = await fs.readFile(getFixturePath(FILES.HTML), 'utf-8')
  const resourceDirPath = getTempPath(FILES.RESOURCES_DIR)

  nock(BASE_URL)
    .get(API.COURSES)
    .reply(RESPONSE.OK, html)

  nock(BASE_URL)
    .get(API.IMAGE)
    .reply(RESPONSE.OK, 'image data')

  await fs.writeFile(resourceDirPath, '')

  await expect(pageLoader(URL, tempDir))
    .rejects
    .toThrow(`Failed to create resource directory ${resourceDirPath}`)
})
