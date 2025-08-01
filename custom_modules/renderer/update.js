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

// This module for handling the checking process of new releases, alongside the attempt to auto update if the current app's format is supporting that
let checkForUpdates = (callback) => {
  let result = {
    updateAvailable: false,
    dismissed: false,
    releaseInfo: {},
    error: null
  }

  try {
    // Import the app's info from the `package.json` file
    let AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')),
      buildInfo = {
        provider: "github",
        owner: "axonops",
        repo: "axonops-workbench"
      },
      targetInfo = {
        owner: buildInfo.owner,
        repo: buildInfo.repo,
        currentVersion: AppInfo.version
      }

    Axios.get(`https://api.github.com/repos/${targetInfo.owner}/${targetInfo.repo}/releases/latest`)
      .then((response) => {
        try {
          let release = response.data

          try {
            if (`${release.tag_name}`.startsWith('v'))
              release.tag_name = `${release.tag_name}`.slice(1)
          } catch (e) {}

          result.updateAvailable = (`${release.tag_name}` != `${targetInfo.currentVersion}`)
          result.dismissed = (`${release.tag_name}` == `${Store.get('dismissUpdate')}`)
          result.releaseInfo = release
        } catch (e) {}
      })
      .catch((error) => {
        result.updateAvailable = false
        result.dismissed = false
        result.error = `${error}`
      }).finally(() => callback(result))
  } catch (e) {}
}

module.exports = {
  checkForUpdates
}
