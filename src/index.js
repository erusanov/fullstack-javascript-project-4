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

const tags = {
  img: 'src',
  link: 'href',
  script: 'src',
}

const isLocal = (src, url) => {
  const { host } = new URL(url)
  const { host: srcHost } = new URL(src, url)

  return host === srcHost
}

const pageLoader = (url, outputDir = process.cwd()) => {
  const htmlFilename = formatName(url, '.html')
  const htmlFilepath = path.join(outputDir, htmlFilename)
  const resourceDirName = formatName(url, '_files')
  const resourceDirPath = path.join(outputDir, resourceDirName)

  const loadHtml = ({ data }) => load(data)

  const loadResource = ($, tagName) => (i, el) => {
    const attr = tags[tagName]
    const src = $(el).attr(attr)

    if (src && isLocal(src, url)) {
      const resourceUrl = new URL(src, url)
      const extension = path.extname(resourceUrl.pathname) || '.html'
      const resourceFilename = formatName(resourceUrl.href, extension)
      const resourceFilepath = path.join(resourceDirPath, resourceFilename)
      const newSrc = path.posix.join(resourceDirName, resourceFilename)

      const promise = axios
        .get(resourceUrl.href, { responseType: 'arraybuffer' })
        .then(response => fs.writeFile(resourceFilepath, response.data))

      $(el).attr(attr, newSrc)

      return promise
    }

    return Promise.resolve()
  }

  const loadResources = ($) => {
    const promises = Object
      .keys(tags)
      .flatMap(
        tagName => $(tagName)
          .map(loadResource($, tagName))
          .get(),
      )

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
