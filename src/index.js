import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import { load } from 'cheerio'

const formatName = (urlString, extension = '') => {
  const url = new URL(urlString)
  const { hostname } = url
  const pathname = url.pathname.endsWith(extension) && extension
    ? url.pathname.slice(0, -extension.length)
    : url.pathname

  const formatted = `${hostname}${pathname}`
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+$/, '')

  const basename = formatted || 'index'
  return `${basename}${extension}`
}

const pageLoader = (url, outputDir = process.cwd()) => {
  const htmlFilename = formatName(url, '.html')
  const htmlFilepath = path.join(outputDir, htmlFilename)
  const resourceDirName = formatName(url, '_files')
  const resourceDirPath = path.join(outputDir, resourceDirName)

  const loadHtml = ({ data }) => load(data)

  const loadResource = $ => (i, img) => {
    const src = $(img).attr('src')

    if (src && !src.startsWith('http')) {
      const resourceUrl = new URL(src, url)
      const extension = path.extname(resourceUrl.pathname)
      const resourceFilename = formatName(resourceUrl.href, extension)
      const resourceFilepath = path.join(resourceDirPath, resourceFilename)
      const newSrc = path.join(resourceDirName, resourceFilename)

      const promise = axios
        .get(resourceUrl.href, { responseType: 'arraybuffer' })
        .then(response => fs.writeFile(resourceFilepath, response.data))

      $(img).attr('src', newSrc)

      return promise
    }
  }

  const loadResources = ($) => {
    const promises = $('img').map(loadResource($)).get()

    if (promises.length === 0) {
      return Promise.resolve($)
    }

    return fs
      .mkdir(resourceDirPath, { recursive: true })
      .then(() => Promise.all(promises))
      .then(() => Promise.resolve($))
  }

  const writeHtml = $ => fs.writeFile(htmlFilepath, $.html())

  return axios
    .get(url)
    .then(loadHtml)
    .then(loadResources)
    .then(writeHtml)
    .then(() => htmlFilepath)
}

export default pageLoader
