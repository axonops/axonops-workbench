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
 * Module to set the appropriate `logging` add function for the main thread
 * It's mainly used with modules that are common between both the main and renderer threads
 *
 * Define the final result which be exported
 */
let finalAddLog = null,
  // Save delayed logs - logs that have been requested to be added before getting an init request from the renderer thread -
  delayedLogs = [],
  // Interval object to be cleared in case the logging feature has been enabled or 5 seconds passed
  watchForDelayedLogs = {
    interval: null,
    time: new Date().getTime()
  }

try {
  // If the `add Log` function is defined then this module has been imported within the renderer thread and no need for custom events
  if (typeof addLog != 'undefined' && addLog != null) {
    finalAddLog = addLog

    // Skip this try-catch block
    throw 0
  }

  /**
   * Define the customized `add` log function
   * The new function will emit a custom event `logging:add` and the result is the same as calling `addLog` in the renderer thread
   */
  finalAddLog = (log, type = 'info') => {
    try {
      if (!isLoggingFeatureEnabled || delayedLogs.length <= 0)
        throw 0

      for (let log of delayedLogs)
        eventEmitter.emit('logging:add', '', log)

      delayedLogs = []
    } catch (e) {}

    if (!isLoggingFeatureEnabled)
      return delayedLogs.push({
        date: new Date().getTime(),
        log,
        type
      })

    eventEmitter.emit('logging:add', '', {
      date: new Date().getTime(),
      log,
      type
    })
  }
} catch (e) {}

try {
  watchForDelayedLogs.interval = setInterval(() => {
    let intervalTime = (new Date().getTime() - watchForDelayedLogs.time)

    if (intervalTime >= 5000)
      return clearInterval(watchForDelayedLogs.interval)

    try {
      if (!isLoggingFeatureEnabled || delayedLogs.length <= 0)
        throw 0

      for (let log of delayedLogs)
        eventEmitter.emit('logging:add', '', log)

      delayedLogs = []

      clearInterval(watchForDelayedLogs.interval)
    } catch (e) {}
  }, 500)
} catch (e) {}

module.exports = {
  addLog: finalAddLog
}
