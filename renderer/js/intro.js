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
  IPCRenderer = require('electron').ipcRenderer

// When the window/view is fully loaded
window.onload = () => {
  try {
    // Import and register the spinner
    try {
      import(Path.join(__dirname, '..', '..', 'node_modules', 'ldrs', 'dist', 'index.js')).then((loaders) => loaders.squircle.register())
    } catch (e) {}

    try {
      // Import the app's info from the `package.json` file
      const AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')); // This semicolon is critical here

      // Set the app's name and version
      (['title', 'version']).forEach((info) => document.getElementById(info).innerHTML = AppInfo[info])
    } catch (e) {}

    // Handle the Cassandra®'s copyright acknowledgement
    {
      // Point at the intro's overall elements container
      let container = document.querySelector('center'),
        // Point at the acknowledgement checkbox
        acknowledgedCheckbox = document.getElementById('cassandraCopyrightAcknowledged')

      // When the checkbox value is changed
      acknowledgedCheckbox.addEventListener('change', () => {
        // Whether or not it's checked
        let isChecked = acknowledgedCheckbox.checked

        // If it's not then skip the upcoming code
        if (!isChecked)
          return

        // Hide the checkbox's form
        setTimeout(() => container.classList.remove('show-checkbox'), 100)

        // Set the associated key in the app's config to be `true`
        IPCRenderer.send(`cassandra-copyright-acknowledged:true`)

        // The app should be loaded now
        setTimeout(() => IPCRenderer.send('loaded'), 1000)
      })

      // Send request to the main thread; to get the status of the copyright acknowledgement
      IPCRenderer.send(`cassandra-copyright-acknowledged`)

      // Once the result is received
      IPCRenderer.on(`cassandra-copyright-acknowledged`, (_, isAcknowledged) => {
        // Show spinner then the notice
        try {
          // Show the spinner
          setTimeout(() => container.classList.add('show-spinner'), 750)

          // Now show the notice
          setTimeout(() => container.classList.add('show-notice'), 1500)

          // If the copyright notice is already acknowledgement then skip this try-catch block
          if (isAcknowledged)
            throw 0

          // Now show the notice
          setTimeout(() => container.classList.add('show-checkbox'), 2000)
        } catch (e) {}
      })
    }
  } catch (e) {}
}
