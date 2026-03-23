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
 * Module to handle the `app-config.cfg` read and write processes
 * It's also used in the renderer thread
 *
 * Implements a configuration file parser
 * The structure is very similar to the Windows `.ini` file
 */
const ConfigParser = require('configparser'),
  AppConfigPath = Path.join(extraResourcesPath != null ? extraResourcesPath : Path.join(__dirname, '..', '..'), 'config', 'app-config.cfg')

let getConfig = (callback) => {
  try {
    try {
      addLog(`Retrieve the app's configuration from 'app-config.cfg' file`, 'process')
    } catch (e) {}

    let configObject = new ConfigParser()
    configObject.read(AppConfigPath)

    return callback(configObject)
  } catch (e) {
    try {
      addLog(`Error in process configuration. Details: ${e}`, 'error')
    } catch (e) {}

    return callback(null)
  }
}

let setConfig = (configObject, callback = null) => {
  try {
    addLog(`Write/update the app's configuration to file 'app-config.cfg'`, 'process')
  } catch (e) {}

  try {
    configObject.write(AppConfigPath)
  } catch (e) {
    try {
      addLog(`Error in process configuration. Details: ${e}`, 'error')
    } catch (e) {}
  }

  try {
    callback()
  } catch (e) {}
}

let mergeConfigFiles = (oldConfigFilePath, newConfigFilePath, callback) => {
  try {
    let oldConfigObject = new ConfigParser(),
      newConfigObject = new ConfigParser()

    oldConfigObject.read(oldConfigFilePath)
    newConfigObject.read(newConfigFilePath)

    let newConfigSections = newConfigObject.sections()

    for (let section of newConfigSections) {
      let keys = newConfigObject.items(section)

      for (let key of Object.keys(keys)) {
        let oldValue = oldConfigObject.get(section, key)

        // If the key doesn't exist in the old config, skip it - the default value will be adopted
        if (oldValue === undefined)
          continue

        newConfigObject.set(section, key, oldValue)
      }
    }

    newConfigObject.write(oldConfigFilePath)
  } catch (e) {
    try {
      addLog(`Error in process configuration. Details: ${e}`, 'error')
    } catch (e) {}
  } finally {
    callback()
  }
}

module.exports = {
  getConfig,
  setConfig,
  mergeConfigFiles
}
