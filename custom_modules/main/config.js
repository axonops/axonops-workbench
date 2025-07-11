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
 *
 * Import modules, and define constants
 *
 * Implements a configuration file parser
 * The structure is very similar to the Windows `.ini` file
 */
const ConfigParser = require('configparser'),
  // Define `app-config.json` file path
  AppConfigPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'config', 'app-config.cfg')

/**
 * Get the app's configuration properties
 *
 * @Parameters:
 * {object} `callback` function that will be triggered with passing the final configuration object
 *
 * @Return: {object} either `null` or the configuration object
 */
let getConfig = (callback) => {
  try {
    // Add log about this process
    try {
      addLog(`Retrieve the app's configuration from 'app-config.cfg' file`, 'process')
    } catch (e) {}

    // Create a config parser object
    let configObject = new ConfigParser()

    // Read the app configuration file
    configObject.read(AppConfigPath)

    // Call the `callback` function with passing the configuration object
    return callback(configObject)
  } catch (e) {
    try {
      addLog(`Error in process configuration. Details: ${e}`, 'error')
    } catch (e) {}

    // If any error has occurred then call the `callback` function with passing `null` to indicate a failure
    return callback(null)
  }
}

/**
 * Set the given configuration object content in the app's config file
 *
 * @Parameters:
 * {object} `configObject` the configuration object
 * {object} `callback` function that will be triggered when the process is finished
 */
let setConfig = (configObject, callback = null) => {
  // Add log about this process
  try {
    addLog(`Write/update the app's configuration to file 'app-config.cfg'`, 'process')
  } catch (e) {}

  // Attempt to set/write the given configuration object in the app's config file
  try {
    configObject.write(AppConfigPath)
  } catch (e) {
    try {
      addLog(`Error in process configuration. Details: ${e}`, 'error')
    } catch (e) {}
  }

  // Call the callback function
  try {
    callback()
  } catch (e) {}
}

/**
 * Merge two config files by updating existing keys, add new sections and keys
 *
 * @Parameters:
 * {string} `oldConfigFilePath` the path of the old config file
 * {string} `newConfigFilePath` the path of the new config file
 * {object} `callback` function that will be triggered when the process is finished
 */
let mergeConfigFiles = (oldConfigFilePath, newConfigFilePath, callback) => {
  try {
    // Create a config parser object for the old config
    let oldConfigObject = new ConfigParser(),
      // Create a config parser object for the new config
      newConfigObject = new ConfigParser()

    // Read the old config file
    oldConfigObject.read(oldConfigFilePath)

    // Read the new config file
    newConfigObject.read(newConfigFilePath)

    // Get the sections from the new config file
    let newConfigSections = newConfigObject.sections()

    // Loop through each section
    for (let section of newConfigSections) {
      // Get the keys of the current section
      let keys = newConfigObject.items(section)

      // Loop through each key
      for (let key of Object.keys(keys)) {
        // Get the key's value from the old config file
        let oldValue = oldConfigObject.get(section, key)

        // If the key not exist in the old config file then skip it - the default value will be adopted -
        if (oldValue === undefined)
          continue

        // Set the old value in the new config file
        newConfigObject.set(section, key, oldValue)
      }
    }

    // Now write the new config file to the old one
    newConfigObject.write(oldConfigFilePath)
  } catch (e) {
    try {
      addLog(`Error in process configuration. Details: ${e}`, 'error')
    } catch (e) {}
  } finally {
    // Call the callback function
    callback()
  }
}

module.exports = {
  getConfig,
  setConfig,
  mergeConfigFiles
}
