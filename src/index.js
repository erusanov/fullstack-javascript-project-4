import path from 'path'
import fs from 'fs/promises'
import axios from 'axios'

const formatUrl = (url) => {
  const { hostname, pathname } = new URL(url)
  const formatted = `${hostname}${pathname}`
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+$/, '')

  return `${formatted}.html`
}

const pageLoader = (url, outputDir = process.cwd()) => {
  const filepath = path.join(outputDir, formatUrl(url))

  return axios
    .get(url)
    .then(({ data }) => fs.writeFile(filepath, data))
    .then(() => filepath)
}

export default pageLoader
