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
 *
 * Import the Node.js OS module
 * Used for operating system-related utilities and properties
 */
const OS = require('os'),
  /**
   * Import different sub-modules from the Electron module
   *
   * `app`
   * For controlling the app's event life cycle
   */
  App = require('electron').app

/**
 * Import other associated modules
 *
 * Sanitize a string to be safe for use as a file name; by removing directory paths and invalid characters
 */
Sanitize = require('sanitize-filename')

// Define the `logging` class which will present the logging system
class Logging {
  /**
   * Data is:
   * { date, id }
   */
  constructor(data) {
    // Define the logging files folder's path
    this.loggingFilesPath = Path.join(extraResourcesPath != null ? App.getPath('logs') : Path.join(__dirname, '..', '..', 'data', 'logging'))

    this.logginSessionFileName = Sanitize(`${this.formatTimestamp(data.date, true).replace(/\s+/gm, '_')}-${data.id}.log`)

    // Define the current logging session's file's path
    this.loggingSessionFile = Path.join(this.loggingFilesPath, this.logginSessionFileName)

    // Make sure the logging files' folder exists
    try {
      FS.accessSync(this.loggingFilesPath, FS.constants.R_OK | FS.constants.W_OK)
    } catch (e) {
      // If not then create it
      try {
        FS.mkdirSync(this.loggingFilesPath)
      } catch (e) {}
    }

    // Create the logging session's file
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
    // Manipulate the passed log's type
    data.type = `${data.type}`.toUpperCase()

    // Attempt to append the log line
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
    // Define the final result to be returned
    let format = ''

    try {
      // Get the date object based on the given timestamp, then get the year, month, and day of that timestamp
      let date = new Date(timestamp),
        year = date.getUTCFullYear(),
        month = date.getUTCMonth(),
        day = date.getUTCDate()

      // Manipulate month and day values; by adding `0` to what is less than `10`, and normalize the month's value
      month = month < 1 ? 1 : ((month > 12) ? 12 : (++month))
      month = month < 10 ? `0${month}` : month
      day = day < 10 ? `0${day}` : day

      // Get left hours, minutes, and seconds in the given timestamp
      let hours = date.getHours(),
        minutes = date.getMinutes(),
        seconds = date.getSeconds(),
        milliSeconds = date.getMilliseconds()

      // Manipulate hours, minutes, and seconds values; by adding `0` to what is less than `10`
      hours = hours < 10 ? `0${hours}` : hours
      minutes = minutes < 10 ? `0${minutes}` : minutes
      seconds = seconds < 10 ? `0${seconds}` : seconds

      // Define the default format
      format = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`

      // If it's required to adopt the second format
      if (isSecondFormat)
        format = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

      format = `${format}.${milliSeconds}`
    } catch (e) {}

    // Return the human-readable result
    return format
  }
}

module.exports = {
  Logging
}
