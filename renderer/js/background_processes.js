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
 * Handle all background processes in this secondary hidden view
 * This view is completely separated from the main - renderer - view and only the modules and JS files that are needed are being imported
 *
 * Import needed modules
 *
 * Node.js file system module - improved version which has methods that aren't included in the native `fs` module -
 * Used for working with files system, it provides related utilities
 */
const FS = require('fs-extra'),
  /**
   * Node.js path module
   * Working with file and directory paths, and providing useful utilities
   */
  Path = require('path'),
  /**
   * Node.js OS module
   * Used for operating system-related utilities and properties
   */
  OS = require('os'),
  // JQuery library
  $ = require('jquery'),
  jQuery = $,
  /**
   * Electron renderer communication with the main thread
   * Used to send requests from the renderer threads to the main thread and listen to the responses
   */
  IPCRenderer = require('electron').ipcRenderer,
  /**
   * Get a random free-to-use port
   * It has been implemented within the function `getRandomPort(?amount)`
   */
  PortGet = require('port-get'),
  /**
   * Create an SSH tunnel with the ability to close it, and listen to its traffic
   * It has been implemented within the function `createSSHTunnel(data)`
   */
  OpenSSHTunnel = require(Path.join(__dirname, '..', 'js', 'external', 'open_ssh_tunnel.js')),
  /**
   * Useful SSH2 utilities
   * Used especially for `parseKey` function
   */
  SSH2Utils = require('ssh2').utils,
  // JS module for text differencing implementation
  Diff = require('diff'),
  // Convert to/from HEX strings and byte arrays
  ConvertHEX = require('convert-hex'),
  // Sanitize a string to be safe for use as a file name; by removing directory paths and invalid characters
  Sanitize = require('sanitize-filename')

/**
 * Electron Logging
 * Used for logging
 */
const log = require('electron-log/renderer')
log.debug('background_processes.js is running...')

/**
 * Get the set extra resources path
 * This value will be updated from the main thread
 */
let extraResourcesPath = null,
  // An array to hold all created SSH tunnels
  sshTunnelsObjects = [],
  // An array that tells which SSH tunnel should be closed - after terminating the process -
  toBeClosedSSHTunnels = []

// Get the set extra resources path from the main thread
$(document).ready(() => IPCRenderer.on('extra-resources-path', (_, path) => {
  // Adopt the set path
  extraResourcesPath = path

  // The config module; to get the app's config and sync with any change
  const Config = require(Path.join(__dirname, '..', '..', 'custom_node_modules', 'renderer', 'config'))

  $(document).ready(() => {
    /**
     * Load the functions file
     * It has global functions used in the entire app
     */
    $.ajax({
      async: false,
      url: Path.join(__dirname, '..', 'js', 'funcs.js'),
      dataType: 'script'
    })
  })

  // Handle all communication channels with the main thread
  {
    // SSH tunnels creation and controlling
    {
      // Request from the main thread to create an SSH tunnel
      IPCRenderer.on(`ssh-tunnel:create`, async (_, data) => {
        // If no specific port passed for the SSH server then use 22
        data.port = data.port || 22

        // Same for the destination address/host, default is 127.0.0.1 - localhost -
        data.dstAddr = data.dstAddr || '127.0.0.1'

        // Add log for this request
        log.info('Creating an SSH tunnel...', {'address': data.dstAddr, 'port': data.port})

        // Get the app's config
        Config.getConfig(async (config) => {
          let timeout = {}; // This semicolon is critical here

          // Get the timeout values, set to default value if they are invalid
          (['ready', 'forward']).forEach((value) => timeout[value] = parseInt(config.get('sshtunnel', `${value}Timeout`)) || 60000)

          // Result which be returned
          let result = {
            object: null, // The tunnel object
            port: 0 // Port that can be called to use the tunnel
          }

          try {
            // Get random ports for source and local SSH tunnel ports
            let [
              srcPort,
              localPort
            ] = await getRandomPort(2)

            // Initialize the authentication data
            let authentication = {}

            // If a password has been passed then adopt it
            if (![undefined, null, ''].includes(data.password))
              authentication.password = data.password

            try {
              // If private key file path has been passed
              if (![undefined, null, ''].includes(data.privatekey))
                authentication.privateKey = await FS.readFileSync(data.privatekey, 'utf8')
            } catch (e) {
              log.warning('Failed to read private key file', {'path': data.privatekey, 'error': e})
            }

            // If a pass phrase for the private key file has been passed
            if (data.passphrase != undefined && data.passphrase.trim().length > 0) {
              try {
                // Parse the key file's content using the `parseKey` function
                let prasedKey = SSH2Utils.parseKey(authentication.privateKey, data.passphrase)

                // Update the key's content
                authentication.privateKey = prasedKey.getPrivatePEM()
              } catch (e) {
                log.warning('Failed to parse private key with pass phrase', {'error': e})
              }
            }

            // Make sure there's no key with an `undefined` value
            try {
              // Loop through the `data` JSON object
              Object.keys(data).forEach((key) => {
                if (`${data[key]}` == 'undefined')
                  delete data[key]
              })

              // Loop through the `authentication` JSON object
              Object.keys(authentication).forEach((key) => {
                if (`${authentication[key]}` == 'undefined' || minifyText(`${authentication[key]}`).length <= 0)
                  delete authentication[key]
              })
            } catch (e) {
              log.warning('Something went wrong sanitizing ssh tunnel data', {'error': e})
            }

            // Define the final SSH tunnel's attributes
            let sshTunnelAttributes = {
              /**
               * Add `data` object with all its sub-objects:
               * SSH server host, username, and its port (default 22)
               * Destination address/host, and its port
               */
              ...data,
              // Authentication - password and/or privateKey -
              ...authentication,
              // Source address/host, and its port (random)
              srcAddr: '127.0.0.1',
              srcPort,
              // Local address/host, and its port (random, will be returned)
              localAddr: '127.0.0.1',
              localPort,
              // Increasing those will give more time to establish a tunnel with a slow connection
              readyTimeout: timeout.ready,
              forwardTimeout: timeout.forward,
              debug: function(data) {
                try {
                  log.info('SSH Tunnel debug', data)
                } catch (e) {
                  log.warning('Failed to log SSH tunnel debug data', {'error': e})
                }
              }
            }

            // Obscure sensitive info if present
            {
              // Copy the SSH tunnel's attributes
              let sshTunnelAttributesCopy = {
                ...sshTunnelAttributes
              }; // This semicolon is critical here

              // Loop through the sensitive data and obscure it if present
              (['username', 'password', 'privateKey', 'passphrase', 'requestID']).forEach((attribute) => {
                // If the current sensitive data doesn't exist then end the process
                if (sshTunnelAttributesCopy[attribute] == undefined)
                  return

                // Replace the data with asterisks
                sshTunnelAttributesCopy[attribute] = '*****'
              })

              // Add log about the final attributes
              log.info('SSH Tunnel attributes', sshTunnelAttributesCopy)
            }

            // Create the tunnel
            OpenSSHTunnel(sshTunnelAttributes).then((tunnel) => {
              // Handle the need to close this tunnel and stop the process
              try {
                if (!(toBeClosedSSHTunnels.some((_requestID) => _requestID == data.requestID)))
                  throw 0

                try {
                  // Close that SSH tunnel
                  tunnel.close()

                  // Add log for this process
                  log.info('The SSH tunnel has been closed', {'requestID': data.requestID})

                  // Remove the SSH tunnel from being closed
                  toBeClosedSSHTunnels = toBeClosedSSHTunnels.filter((_requestID) => _requestID == data.requestID)
                } catch (e) {
                  log.warning('Failed to close SSH tunnel', {'error': e})
                }

                // Skip the upcoming code and stop the process
                return
              } catch (e) {}

              /**
               * Set the SSH tunnel's object key in the array
               * The key is either the cluster's ID or the port
               */
              let key = data.clusterID == 'port' ? `_${localPort}` : data.clusterID

              // Add the SSH tunnel to the array
              sshTunnelsObjects[key] = {
                object: tunnel,
                port: localPort
              }

              // Update the `port` attribute of the result
              result.port = localPort

              // Send the creation result to the main thread
              IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
                ...result,
                requestID: data.requestID
              })
            }).catch((e) => {
              log.warning('Failed to open ssh tunnel', {'requestID': data.requestID, 'error': e})

              // Catch any occurred error
              result.error = e.toString()

              // Send the creation result to the main thread
              IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
                ...result,
                requestID: data.requestID
              })
            })
          } catch (e) {
            log.warning('Failed to create ssh tunnel', {'address': data.dstAddr, 'port': data.port, 'error': e})

            // Catch any occurred error
            result.error = e.toString()

            // Send the creation result to the main thread
            IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
              ...result,
              requestID: data.requestID
            })
          }
        })
      })

      // Request to close an SSH tunnel based on the cluster's ID
      IPCRenderer.on('ssh-tunnel:close', (_, clusterID) => {
        /**
         * Check if the given `clusterID` is the port
         * This occurs when a request comes from a connection test to a cluster that is about to be added or updated.
         */
        let isPort = !isNaN(parseInt(clusterID))

        // Add log for this process
        log.info('Closing an SSH tunnel...', {'id': clusterID, 'type': isPort ? 'port' : 'cluster' })

        try {
          if (isPort) {
            // Close that SSH tunnel
            sshTunnelsObjects[clusterID].object.close()
          } else {
            // Loop through the active SSH tunnels
            sshTunnelsObjects
              .filter((tunnel) => tunnel.port == clusterID)
              .forEach((tunnel) => tunnel.object.close());
          }
          // Add log for this process
          log.info('The SSH tunnel has been closed', {'id': clusterID, 'type': isPort ? 'port' : 'cluster' })
        } catch (e) {
          log.warning('Something went wrong closing SSH tunnel', {'id': clusterID, 'type': isPort ? 'port' : 'cluster', 'error': e})
        }
      })

      // Request to update the key/ID of a created SSH tunnel
      IPCRenderer.on('ssh-tunnel:update', (_, data) => {
        try {
          if (sshTunnelsObjects[data.newID] != undefined)
            throw 0

          // Set the new ID in the `sshTunnelsObjects` array and make sure to put the SSH tunnel's object in it
          sshTunnelsObjects[data.newID] = sshTunnelsObjects[data.oldID]
        } catch (e) {}
      })

      // Request to close SSH tunnel when it's created as the process has been terminated
      IPCRenderer.on('ssh-tunnel:close:queue', (_, requestID) => toBeClosedSSHTunnels.push(requestID))
    }

    // Detect differentiation between two texts (metadata in specific)
    {
      // Request from the main thread to detect differentiation
      IPCRenderer.on('detect-differentiation', async (_, data) => {
        // Define the response tag to be called
        let responseTag = `detect-differentiation:result:${data.requestID}`,
          /**
           * Final result which be returned
           * The two arrays will be concatenated together
           */
          changedLines = [],
          newLines = []

        try {
          // Split the two given texts into lines
          data.oldText = data.oldText.split('\n')
          data.newText = data.newText.split('\n')

          // If the length of the new text is less than the old one then skip this try-catch block
          if (data.newText.length <= data.oldText.length)
            throw 0

          // Get the number of added lines
          let numOfLines = data.newText.length - data.oldText.length

          // Loop based on the calculated number and push index as a line number to the `newLines` array
          for (let i = data.newText.length - numOfLines; i < data.newText.length; ++i)
            newLines.push({
              number: i,
              content: data.newText[i],
              type: 'ADD'
            })
        } catch (e) {}

        // Loop through the lines of the old text
        for (let i = 0; i < data.oldText.length; ++i) {
          try {
            // Get the line content of both; the old and new texts
            let oldLine = data.oldText[i].replace(/\s+/gm, ''),
              newLine = data.newText[i].replace(/\s+/gm, '')

            // Get the differentiation
            let diff = Diff.diffSentences(oldLine, newLine)[0]

            // If there's any difference then push the line number and its content to the `changedLines` array
            if ([diff.added, diff.removed].some((val) => val != undefined))
              changedLines.push({
                number: i,
                content: oldLine,
                type: 'CHANGE'
              })
          } catch (e) {
            log.warning('Something went wrong detecting differentiation', {'error': e})
          }
        }

        // Concatenate the two arrays as a final result
        let result = changedLines.concat(newLines)

        // Manipulate the result by removing whitespaces from the start and end of the line
        try {
          result = result.map((change) => {
            return {
              ...change,
              content: change.content.trim()
            }
          })
        } catch (e) {}

        // Send the result associated with the response tag
        IPCRenderer.send(responseTag, {
          result,
          requestID: data.requestID
        })
      })
    }

    // Handle `blob` content bi-directional conversion
    {
      IPCRenderer.on('blob:read-convert', (_, data) => {
        let itemHEXString = ''

        try {
          let itemBuffer = FS.readFileSync(data.itemPath)

          itemHEXString = ConvertHEX.bytesToHex(Array.from(itemBuffer))

          itemHEXString = `0x${itemHEXString}`
        } catch (e) {}

        IPCRenderer.send(`blob:read-convert:result:${data.requestID}`, {
          itemHEXString,
          requestID: data.requestID
        })
      })

      IPCRenderer.on('blob:convert-write', (_, data) => {
        let itemTempFile = ``,
          error = false

        try {
          let blobBytes = ConvertHEX.hexToBytes(data.blobHEXString),
            itemBuffer = Buffer.from(blobBytes)

          itemTempFile = Path.join(OS.tmpdir(), Sanitize(`preview_item_${data.randomID}`))

          itemTempFile = `${itemTempFile}.${data.itemType}`

          FS.writeFileSync(itemTempFile, itemBuffer)
        } catch (e) {
          error = true
        } finally {
          IPCRenderer.send(`blob:convert-write:result:${data.requestID}`, {
            itemTempFile,
            error,
            requestID: data.requestID
          })
        }
      })
    }
  }
}))
