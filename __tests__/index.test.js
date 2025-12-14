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

test('page-loader with resources', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const expectedHtmlFilename = 'ru-hexlet-io-courses.html'
  const expectedResourceDirName = 'ru-hexlet-io-courses_files'
  const expectedImageFilename = 'ru-hexlet-io-assets-professions-nodejs.png'

  const html = await fs
    .readFile(
      getFixturePath('page-with-image.html'),
      'utf-8',
    )

  const image = await fs
    .readFile(getFixturePath('assets/professions/nodejs.png'))

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, html)

  nock('https://ru.hexlet.io')
    .get('/assets/professions/nodejs.png')
    .reply(200, image)

  const htmlFilepath = await pageLoader(url, tempDir)

  expect(htmlFilepath)
    .toBe(path.join(tempDir, expectedHtmlFilename))

  const expectedModifiedHtml = await fs.readFile(getFixturePath('expected-modified-page.html'), 'utf-8')

  await expect(fs.readFile(htmlFilepath, 'utf-8'))
    .toEqual(expectedModifiedHtml)

  const imageFilepath = path.join(tempDir, expectedResourceDirName, expectedImageFilename)

  await expect(fs.readFile(imageFilepath))
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

  await expect(fs.readFile(filepath, 'utf-8'))
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

  await expect(fs.readFile(filepath, 'utf-8'))
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
