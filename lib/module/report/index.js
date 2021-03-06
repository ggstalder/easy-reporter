const uuidv4 = require('uuid/v4')
const zlib = require('zlib')
const config = require('config').get('authentication')

const ReportModel = require('../../model/report')
const resources = require('../../resource')
const crypto = require('crypto')

class Report {
  upload (token, payload) {
    let filename = `/reports/${uuidv4()}.gz`

    return Promise.resolve()
      .then(() => {
        const hmac = crypto.createHmac('sha256', config.secret_key).update(payload).digest('base64')

        if (hmac != token) {
          throw new Error('Invalid payload')
        }
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          zlib.gunzip(payload, (err, buffer) => {
            if (err) {
              console.error(`Cannot extract data from report ${filename}`, err)
              reject(err)
            } else {
              resolve(JSON.parse(buffer.toString('utf8')))
            }
          })
        })
      })
      .then((data) => ReportModel.create(filename, data.application.debug, data.system.name, data.application.version))
      .then(() => {
        return new Promise((resolve, reject) => {
          return resources.file.upload(filename, payload.toString('base64'), (err, json) => {
            if (err) {
              reject(`Cannot upload file due to ${err}`)
            } else {
              resolve(json)
            }
          })
        })
      })
      .then(() => ReportModel.upload(filename, true))
  }

  delete (filename) {
    return new Promise((resolve, reject) => {
      resources.file.delete(filename, (err, json) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    .then(() => ReportModel.delete(filename, true))
  }

  download (filename) {
    return new Promise((resolve, reject) => {
      resources.file.download(filename, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
    .then((data) => {
      return ReportModel.read(filename, true)
        .then(() => data)
    })
  }

  important (filname, value = true) {
    return ReportModel.important(filename, value)
  }

  list () {
    return ReportModel.list()
  }
}

module.exports = new Report()
