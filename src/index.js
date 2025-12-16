import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'
import { load } from 'cheerio'
import debug from 'debug'
import Listr from 'listr'

const log = debug('page-loader')

const TAGS = {
  img: 'src',
  link: 'href',
  script: 'src',
}

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

const collectResources = ({ $, resourceDirPath, resourceDirName, url }) => {
  const resources = []

  Object
    .keys(TAGS)
    .forEach(
      (tagName) => {
        const attr = TAGS[tagName]

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

  return resources
}

const createResourceTask = ({ url, filepath }) => {
  return {
    title: url,
    task: () => axios
      .get(url, { responseType: 'arraybuffer' })
      .then(resData => fs.writeFile(filepath, resData.data))
      .catch((e) => {
        throw new Error(`Failed to download resource ${url}: ${e.message}`)
      }),
  }
}

const replaceResourcePaths = ({ $, resources }) => {
  resources
    .forEach((res) => {
      $(res.el).attr(res.attr, res.newSrc)
    })
}

const loadResources = ({ resourceDirPath, resourceDirName, url }) => (response) => {
  log('Html loaded')

  const $ = load(response.data)
  const resources = collectResources({ $, resourceDirPath, resourceDirName, url })

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
      replaceResourcePaths({ $, resources })

      return new Listr(
        resources.map(createResourceTask),
        { concurrent: true },
      )
        .run()
    })
    .then(() => replaceResourcePaths({ $, resources }))
    .then(() => $.html())
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

  return axios
    .get(url)
    .catch((e) => {
      throw new Error(`Failed to download page ${url}: ${e.message}`)
    })
    .then(loadResources({ resourceDirPath, resourceDirName, url }))
    .then((html) => {
      log('All resources loaded')

      log(`Saving html to ${htmlFilepath}`)

      return fs
        .writeFile(htmlFilepath, html)
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
