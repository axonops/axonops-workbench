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
 * Module to handle scripts actions - mainly the execution - and events
 *
 * Execute a given script in an async way
 *
 * @Parameters:
 * {object} `window` the main view/window object
 * {object} `Terminal` the terminal `node-cmd` object
 * {object} `data` info related to the script meant to be executed:
 * {string} `id`, {string} `scriptPath`
 */
let executeScript = (window, Terminal, data) => {
  let responseID = `script:result:${data.id}`,
    command = `"${data.scriptPath}"`

  Terminal.run(command, (err, data, stderr) => {
    try {
      stderr = `${stderr}`.length <= 0 ? null : stderr
    } catch (e) {}

    try {
      err = `${err}`.length <= 0 ? null : err
    } catch (e) {}

    let foundError = (err || stderr) != undefined

    if (foundError)
      try {
        addLog(`Error regards executing script '${data.scriptPath}'. Details: ${err || stderr}`)
      } catch (e) {}

    window.webContents.send(responseID, foundError ? -1000 : data)
  })
}

module.exports = {
  executeScript
}
