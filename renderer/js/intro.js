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
 * The `intro` JS file - the only imported file by the `intro` view -
 *
 * Import the Node.js path module
 * Working with file and directory paths
 */
const Path = require('path'),
  /**
   * Electron renderer communication with the main thread
   * Used for sending requests from the renderer threads to the main thread and listening to the responses
   */
  IPCRenderer = require('electron').ipcRenderer,
  // Import the constants module
  Consts = require(Path.join(__dirname, '..', '..', 'custom_modules', 'main', 'consts'))

// When the window/view is fully loaded
window.onload = () => {
  try {
    // Import and register the spinner
    try {
      import(Path.join(__dirname, '..', '..', 'node_modules', 'ldrs', 'dist', 'index.js')).then((loaders) => loaders.squircle.register())
    } catch (e) {}

    // Add the legal notice
    try {
      document.querySelector('div.notice').innerHTML = `${Consts.LegalNotice}.`
    } catch (e) {}

    try {
      // Import the app's info from the `package.json` file
      const AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')); // This semicolon is critical here

      // Set the app's name and version
      (['title', 'version']).forEach((info) => document.getElementById(info).innerHTML = (info == 'version' && !AppInfo[info].startsWith('v') ? 'v' : '') + AppInfo[info])
    } catch (e) {}

    // Handle the Cassandra's - and other trade marks - copyright acknowledgement
    {
      // Point at the intro's elements container
      let container = document.querySelector('center'),
        // Point at the acknowledgement checkbox
        acknowledgedCheckbox = document.getElementById('cassandraCopyrightAcknowledged')

      // Send a request to the main thread to get the status of the copyright acknowledgement
      IPCRenderer.send(`cassandra-copyright-acknowledged`)

      // Show the spinner
      setTimeout(() => container.classList.add('show-spinner'), 565)

      // In case the view didn't receive the acknowledged result from the main thread, show an error to the user suggesting to restart or get a new installation
      let initErrorMessage = setTimeout(function() {
        try {
          let boxID = `initErrorBoxID`

          IPCRenderer.send(`box:create`, {
            message: `An initialization error requires a retry. If this message persists, perform a fresh install from the official repository.`,
            id: boxID,
            type: 'error',
            buttons: ['Exit'],
            title: 'Initialization Failed',
            isInitError: true
          })

          IPCRenderer.on(`box:${boxID}`, () => IPCRenderer.send('options:actions:quit:init'))
        } catch (e) {}
      }, 30000) // 30 seconds without getting an acknowledged means a failure

      // Once the result is received
      IPCRenderer.on(`cassandra-copyright-acknowledged`, (_, isAcknowledged) => {
        // Clear the init error timeout object
        try {
          clearTimeout(initErrorMessage)
        } catch (e) {}

        try {
          // Show the legal notice
          setTimeout(() => container.classList.add('show-notice'), 1125)

          // If the copyright notice is already acknowledgement then skip this try-catch block
          if (isAcknowledged)
            throw IPCRenderer.send('loaded')

          // Now show the acknowledged checkbox
          setTimeout(() => container.classList.add('show-checkbox'), 1500)
        } catch (e) {}
      })

      /**
       * The checkbox is shown only in case the user didn't confirm his acknowledgement
       * When the checkbox value is changed
       */
      acknowledgedCheckbox.addEventListener('change', () => {
        /**
         * Whether or not it's checked
         * If it's not then skip the upcoming code as there's no need to continue
         */
        if (!acknowledgedCheckbox.checked)
          return

        // Hide the checkbox's form
        setTimeout(() => container.classList.remove('show-checkbox'), 100)

        // Set the associated key in the app's config to be `true`
        IPCRenderer.send(`cassandra-copyright-acknowledged:true`)

        // The app should be loaded now
        IPCRenderer.send('loaded')
      })
    }
  } catch (e) {}
}
