import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import { load } from 'cheerio'
import debug from 'debug'

const log = debug('page-loader')

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
  log(`Start loading page: ${url} to ${outputDir}`)

  const htmlFilename = formatName(url, '.html')
  const htmlFilepath = path.join(outputDir, htmlFilename)
  const resourceDirName = formatName(url, '_files')
  const resourceDirPath = path.join(outputDir, resourceDirName)

  log(`Generated html filename: ${htmlFilename}`)
  log(`Generated resource directory name: ${resourceDirName}`)

  const loadHtml = ({ data }) => {
    log('Html loaded')

    return load(data)
  }

  const loadResource = ($, tagName) => (i, el) => {
    const attr = tags[tagName]
    const src = $(el).attr(attr)

    if (src && isLocal(src, url)) {
      const resourceUrl = new URL(src, url)

      log(`Found local resource: ${resourceUrl.href}`)

      const extension = path.extname(resourceUrl.pathname) || '.html'
      const resourceFilename = formatName(resourceUrl.href, extension)
      const resourceFilepath = path.join(resourceDirPath, resourceFilename)
      const newSrc = path.posix.join(resourceDirName, resourceFilename)

      log(`Generated resource filename: ${resourceFilename}`)

      const promise = axios
        .get(resourceUrl.href, { responseType: 'arraybuffer' })
        .then((response) => {
          log(`Saving resource ${resourceUrl.href} to ${resourceFilepath}`)

          return fs.writeFile(resourceFilepath, response.data)
        })

      $(el).attr(attr, newSrc)

      return promise
    }

    return Promise.resolve()
  }

  const loadResources = ($) => {
    log('Start loading resources')

    const promises = Object
      .keys(tags)
      .flatMap(
        tagName => $(tagName)
          .map(loadResource($, tagName))
          .get(),
      )

    if (promises.length === 0) {
      log('No resources to load')

      return Promise.resolve($)
    }

    return fs
      .mkdir(resourceDirPath, { recursive: true })
      .then(() => Promise.all(promises))
      .then(() => {
        log('All resources loaded')

        return Promise.resolve($)
      })
  }

  const writeHtml = ($) => {
    log(`Saving html to ${htmlFilepath}`)

    return fs.writeFile(htmlFilepath, $.html())
  }

  return axios
    .get(url)
    .then(loadHtml)
    .then(loadResources)
    .then(writeHtml)
    .then(() => {
      log(`Page loaded successfully to ${htmlFilepath}`)

      return htmlFilepath
    })
}

export default pageLoader
