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
 * Handle communication between the AxonOps™ agent webview and the app
 * This file is a preload for the webview
 *
 * Once the content of the webview is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  /**
   * Import important libraries
   * JQuery library
   */
  const $ = require('jquery'),
    /**
     * Electron renderer communication with the main thread
     * Used for sending requests from the renderer threads to the main thread and listening to the responses
     */
    IPCRenderer = require('electron').ipcRenderer

  // Add a reload button in the left menu-side of the AxonOps™ agent
  setTimeout(() => {
    // Point at the side menu
    let container = $('div.\\:sideMenu > div'),
      // The button's UI structure to be appended
      element = `
      <div class=":h100 level1 sideMenu__item">
        <div>
          <div class=":flex:mid :p10 :clickable" style="padding-left: 16px;">
            <div class=":sideMenu-icon">
              <span style="display: inherit;">
                <i class="fa fa-refresh" style="text-align: center;width: 20px;font-size: 16px;"></i>
              </span>
            </div>
          </div>
        </div>
      </div>`

    /**
     * Append the button
     * Once it's clicked send to the webview a request of reloading
     */
    container.append($(element).click(() => IPCRenderer.sendToHost(`reload-webview`)))
  }, 1000)
})
