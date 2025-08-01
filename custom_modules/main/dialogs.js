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
 * Module to create a customized dialog
 *
 * Import the `dialog` module from Electron
 */
const Dialog = require('electron').dialog

/**
 * Create a dialog by passing the window's object - which the dialog will be attached to it -, and other data; like the ID of that dialog, and the window's properties
 *
 * @Parameters:
 * {object} `window` the main view/window object
 * {object} `data` properties of the dialog
 */
let createDialog = async (window, data) => {
  // Show the dialog and send the response to the renderer thread
  Dialog[data.type == undefined ? 'showOpenDialog' : data.type](window, data).then((result) => window.webContents.send(`dialog:${data.id}`, result.filePaths || result.filePath)).catch((e) => {
    try {
      errorLog(e, 'dialog')
    } catch (e) {}
  })
}

let createBox = async (window, data) => {
  // Show the dialog and send the response to the renderer thread
  Dialog[data.boxType == undefined ? 'showMessageBox' : data.type](window, data).then((result) => window.webContents.send(`box:${data.id}`, result)).catch((e) => {
    try {
      errorLog(e, 'dialog')
    } catch (e) {}
  })
}

module.exports = {
  createDialog,
  createBox
}
