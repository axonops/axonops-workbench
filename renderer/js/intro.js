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

const Path = require('path'),
  IPCRenderer = require('electron').ipcRenderer,
  Consts = require(Path.join(__dirname, '..', '..', 'custom_modules', 'main', 'consts'))

window.onload = () => {
  try {
    // Register the spinner loader
    try {
      import(Path.join(__dirname, '..', '..', 'node_modules', 'ldrs', 'dist', 'index.js')).then((loaders) => loaders.squircle.register())
    } catch (e) {}

    try {
      document.querySelector('div.notice').innerHTML = `${Consts.LegalNotice}.`
    } catch (e) {}

    try {
      const AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')); // This semicolon is critical here

      (['title', 'version']).forEach((info) => document.getElementById(info).innerHTML = (info == 'version' && !AppInfo[info].startsWith('v') ? 'v' : '') + AppInfo[info])
    } catch (e) {}

    // Handle the copyright acknowledgement flow
    {
      let container = document.querySelector('center'),
        acknowledgedCheckbox = document.getElementById('cassandraCopyrightAcknowledged')

      IPCRenderer.send(`cassandra-copyright-acknowledged`)

      setTimeout(() => container.classList.add('show-spinner'), 565)

      // Show an error if no acknowledgement result is received within 30 seconds
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
      }, 30000)

      IPCRenderer.on(`cassandra-copyright-acknowledged`, (_, isAcknowledged) => {
        try {
          clearTimeout(initErrorMessage)
        } catch (e) {}

        try {
          setTimeout(() => container.classList.add('show-notice'), 1125)

          // If already acknowledged, skip to loading
          if (isAcknowledged)
            throw IPCRenderer.send('loaded')

          setTimeout(() => container.classList.add('show-checkbox'), 1500)
        } catch (e) {}
      })

      acknowledgedCheckbox.addEventListener('change', () => {
        if (!acknowledgedCheckbox.checked)
          return

        setTimeout(() => container.classList.remove('show-checkbox'), 100)

        IPCRenderer.send(`cassandra-copyright-acknowledged:true`)
        IPCRenderer.send('loaded')
      })
    }
  } catch (e) {}
}
