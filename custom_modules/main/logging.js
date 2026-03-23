/*
 * © 2024 AxonOps Limited. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Module to handle the logging actions in the app overall
 * There's a `constructing` and `add log` functions
 */
const OS = require('os'),
  App = require('electron').app

Sanitize = require('sanitize-filename')

class Logging {
  /**
   * Data is:
   * { date, id }
   */
  constructor(data) {
    this.loggingFilesPath = Path.join(extraResourcesPath != null ? App.getPath('logs') : Path.join(__dirname, '..', '..', 'data', 'logging'))
    this.logginSessionFileName = Sanitize(`${this.formatTimestamp(data.date, true).replace(/\s+/gm, '_')}-${data.id}.log`)
    this.loggingSessionFile = Path.join(this.loggingFilesPath, this.logginSessionFileName)

    try {
      FS.accessSync(this.loggingFilesPath, FS.constants.R_OK | FS.constants.W_OK)
    } catch (e) {
      try {
        FS.mkdirSync(this.loggingFilesPath)
      } catch (e) {}
    }

    setTimeout(() => {
      try {
        FS.writeFileSync(this.loggingSessionFile, '')
      } catch (e) {}
    }, 100)
  }

  /**
   * Add a log text
   * Data is:
   * { date, log }
   */
  async addLog(data) {
    data.type = `${data.type}`.toUpperCase()

    try {
      await FS.appendFileSync(this.loggingSessionFile, `[${this.formatTimestamp(data.date)} ${data.type}] ${data.log}` + OS.EOL)
    } catch (e) {}
  }

  /**
   * Format a given timestamp to readable text
   *
   * @Parameters:
   * {integer} `timestamp` the timestamp value to be formatted
   * {boolean} `?isSecondFormat` return the second format `Year-Month-Day Hours:Mintues:Seconds`
   *
   * @Return: {string} formatted timestamp `Day-Month-Year Hours:Mintues:Seconds`
   */
  formatTimestamp(timestamp, isSecondFormat = false) {
    let format = ''

    try {
      let date = new Date(timestamp),
        year = date.getUTCFullYear(),
        month = date.getUTCMonth(),
        day = date.getUTCDate()

      month = month < 1 ? 1 : ((month > 12) ? 12 : (++month))
      month = month < 10 ? `0${month}` : month
      day = day < 10 ? `0${day}` : day

      let hours = date.getHours(),
        minutes = date.getMinutes(),
        seconds = date.getSeconds(),
        milliSeconds = date.getMilliseconds()

      hours = hours < 10 ? `0${hours}` : hours
      minutes = minutes < 10 ? `0${minutes}` : minutes
      seconds = seconds < 10 ? `0${seconds}` : seconds

      if (isSecondFormat)
        format = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      else
        format = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`

      format = `${format}.${milliSeconds}`
    } catch (e) {}

    return format
  }
}

module.exports = {
  Logging
}
