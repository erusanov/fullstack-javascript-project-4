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

test('page-loader', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const responseData = await fs.readFile(getFixturePath('ru-hexlet-io-courses.html'), 'utf-8')

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, responseData)

  const expectedFilename = 'ru-hexlet-io-courses.html'
  const filepath = await pageLoader(url, tempDir)

  expect(filepath).toBe(path.join(tempDir, expectedFilename))

  const downloadedData = await fs.readFile(filepath, 'utf-8')

  expect(downloadedData).toEqual(responseData)
})

test('page-loader with trailing slash', async () => {
  const url = 'https://ru.hexlet.io/'
  const responseData = await fs.readFile(getFixturePath('ru-hexlet-io-courses.html'), 'utf-8')

  nock('https://ru.hexlet.io')
    .get('/')
    .reply(200, responseData)

  const expectedFilename = 'ru-hexlet-io.html'
  const filepath = await pageLoader(url, tempDir)

  expect(filepath).toBe(path.join(tempDir, expectedFilename))

  const downloadedData = await fs.readFile(filepath, 'utf-8')

  expect(downloadedData).toEqual(responseData)
})

test('page-loader http error', async () => {
  const url = 'https://ru.hexlet.io/courses'

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(404)

  await expect(pageLoader(url, tempDir)).rejects.toThrow('Request failed with status code 404')
})

test('page-loader filesystem error', async () => {
  const url = 'https://ru.hexlet.io/courses'

  const responseData = await fs.readFile(getFixturePath('ru-hexlet-io-courses.html'), 'utf-8')

  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, responseData)

  const nonExistentDir = path.join(tempDir, 'non-existent')

  await expect(pageLoader(url, nonExistentDir)).rejects.toThrow('ENOENT')
})
