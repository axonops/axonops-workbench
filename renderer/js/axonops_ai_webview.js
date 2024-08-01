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
 * Handle communication between the AxonOps™ AI Assistant webview and the app
 * This file is a preload for the webview
 *
 * Once the content of the webview is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Define a function to handle the click event of the `Sign Up` button
  handleClickEvent = () => {
    setTimeout(() => {
      // Point at the sign up button
      let signUpButton = document.querySelector('#auth0-lock-container-1 > div > div.auth0-lock-center > form > div > div > div > div > div.auth0-lock-content-body-wrapper > div:nth-child(2) > span > div > div > div > div > div > div > div > div > div.auth0-lock-tabs-container > ul > li:nth-child(2) > a')

      // If the buttons hasn't been found then call the function again
      if (signUpButton == null)
        return handleClickEvent()

      // Remove any `click` event listener
      signUpButton.removeEventListener('click', () => {})

      // Define a new event listener
      signUpButton.addEventListener('click', function(e) {
        // Prevent the default behavior of the event
        e.preventDefault()
        e.stopPropagation()

        // Open a new URL
        window.open("https://axonops.com/starter", "_self")

        // End the process
        return
      })
    }, 1000)
  }

  handleClickEvent()
})
