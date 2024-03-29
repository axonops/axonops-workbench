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
  const $ = require('jquery'),
    /**
     * Electron renderer communication with the main thread
     * Used for sending requests from the renderer threads to the main thread and listening to the responses
     */
    IPCRenderer = require('electron').ipcRenderer

  // Add a reload button in the left menu-side of the AxonOps agent
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
