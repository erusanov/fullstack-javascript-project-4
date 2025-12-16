import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import { load } from 'cheerio'
import debug from 'debug'

const log = debug('page-loader')

const formatName = (urlString, extension = '') => {
  let url

  try {
    url = new URL(urlString)
  }
  catch (e) {
    throw new Error(`Failed to parse ${urlString}: ${e.message}`)
  }

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
  try {
    const { host } = new URL(url)
    const { host: srcHost } = new URL(src, url)

    return host === srcHost
  }
  catch {
    return true
  }
}

const pageLoader = (url, outputDir = process.cwd()) => {
  let htmlFilename
  let htmlFilepath
  let resourceDirName
  let resourceDirPath

  try {
    log(`Start loading page: ${url} to ${outputDir}`)

    htmlFilename = formatName(url, '.html')
    htmlFilepath = path.join(outputDir, htmlFilename)
    resourceDirName = formatName(url, '_files')
    resourceDirPath = path.join(outputDir, resourceDirName)
  }
  catch (e) {
    return Promise.reject(e)
  }

  log(`Generated html filename: ${htmlFilename}`)
  log(`Generated resource directory name: ${resourceDirName}`)

  let $

  return axios
    .get(url)
    .catch((e) => {
      throw new Error(`Failed to download page ${url}: ${e.message}`)
    })
    .then((response) => {
      log('Html loaded')

      $ = load(response.data)

      const resources = []

      Object
        .keys(tags)
        .forEach(
          (tagName) => {
            const attr = tags[tagName]

            $(tagName)
              .each((i, el) => {
                const src = $(el).attr(attr)

                if (src && isLocal(src, url)) {
                  const resourceUrl = new URL(src, url)

                  log(`Found local resource: ${resourceUrl.href}`)

                  const extension = path.extname(resourceUrl.pathname) || '.html'
                  const resourceFilename = formatName(resourceUrl.href, extension)

                  resources.push({
                    el,
                    attr,
                    url: resourceUrl.href,
                    filepath: path.join(resourceDirPath, resourceFilename),
                    newSrc: path.posix.join(resourceDirName, resourceFilename),
                  })
                }
              })
          })

      if (resources.length === 0) {
        log('No resources to load')

        return Promise.resolve()
      }

      log('Start loading resources')

      return fs
        .mkdir(resourceDirPath, { recursive: true })
        .catch((e) => {
          throw new Error(`Failed to create resource directory ${resourceDirPath}: ${e.message}`)
        })
        .then(() => {
          resources
            .forEach((res) => {
              $(res.el).attr(res.attr, res.newSrc)
            })

          const promises = resources.map(res =>
            axios
              .get(res.url, { responseType: 'arraybuffer' })
              .then((resData) => {
                log(`Saving resource ${res.url} to ${res.filepath}`)

                return fs.writeFile(res.filepath, resData.data)
              })
              .catch((e) => {
                throw new Error(`Failed to download resource ${res.url}: ${e.message}`)
              }),
          )

          return Promise.all(promises)
        })
    })
    .then(() => {
      log('All resources loaded')

      log(`Saving html to ${htmlFilepath}`)

      return fs
        .writeFile(htmlFilepath, $.html())
        .catch((e) => {
          throw new Error(`Failed to save page to ${htmlFilepath}: ${e.message}`)
        })
    })
    .then(() => {
      log(`Page loaded successfully to ${htmlFilepath}`)

      return htmlFilepath
    })
}

export default pageLoader
