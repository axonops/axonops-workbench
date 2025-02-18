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
 * Handle communication between the AxonOps agent webview and the app
 * This file is a preload for the webview
 *
 * Once the content of the webview is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  /**
   * Import important libraries
   * JQuery library
   */
  global.$ = require('jquery')

  /**
   * Electron renderer communication with the main thread
   * Used for sending requests from the renderer threads to the main thread and listening to the responses
   */
  global.IPCRenderer = require('electron').ipcRenderer

  // Add a reload button in the left menu-side of the AxonOps agent
  setTimeout(() => {
    // The button's UI structure to be appended
    let element = `
        <div bis_skin_checked="1" data-id="reloadWebView">
          <div bis_skin_checked="1">
            <div class=":h100 level1 sideMenu__item " bis_skin_checked="1">
              <div bis_skin_checked="1">
                <div class=":flex:mid :p10 :clickable" style="padding-left: 16px;" bis_skin_checked="1">
                  <div class=":sideMenu-icon" bis_skin_checked="1"><span style="display: inherit;"><i class="fa fa-refresh " style="text-align: center; width: 20px; font-size: 18px;"></i></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>`,
      checkForTheSideMenuTimeout,
      checkForTheSideMenu = () => {
        checkForTheSideMenuTimeout = setTimeout(() => {
          if (document.querySelector('div[data-id="reloadWebView"]') != null)
            return

          try {
            document.querySelector('div.\\:sideMenu > div').insertAdjacentHTML('beforeend', element)

            setTimeout(() => {
              try {
                document.querySelector('div[data-id="reloadWebView"]').addEventListener('click', () => {
                  IPCRenderer.sendToHost(`reload-webview`)
                })
              } catch (e) {}
            })
          } catch (e) {}

          if (document.querySelector('div.\\:sideMenu > div') == null)
            checkForTheSideMenu()
        }, 1000)
      }

    checkForTheSideMenu()

    $(`#__next > div > div.pagesIndex__inner > div.termsAndConditions > div.\\:flex\\:center\\:between > div:nth-child(2) > button`).click(() => checkForTheSideMenu())
  }, 1000)
})
