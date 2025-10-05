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
   * It has been implemented within the function `getRandom.port(?amount)`
   */
  PortGet = require('port-get'),
  /**
   * Create an SSH tunnel with the ability to close it, and listen to its traffic
   * It has been implemented within the function `tunnelSSH.createTunnel(data)`
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
  Sanitize = require('sanitize-filename'),
  /**
   * Pure Node.js RSA library implemented
   * It has been implemented within the functions `encryptText(publicKey, text)` and `decryptText(privateKey, text)`
   */
  NodeRSA = require('node-rsa'),
  /**
   * Generate a random string
   * Mainly used for generating IDs for connections, workspaces, UI elements, and so on
   * It has been implemented within the function `getRandom.id(length, ?amount)`
   */
  RandomID = require('id-16'),
  ZLib = require('zlib')

/**
 * Get the set extra resources path
 * This value will be updated from the main thread
 */
let extraResourcesPath = null,
  // An array to hold all created SSH tunnels
  sshTunnelsObjects = [],
  // Boolean value used to tell if the logging system should be enabled in the current session or not
  isLoggingFeatureEnabled = true,
  // An array that tells which SSH tunnel should be closed - after terminating the process -
  toBeClosedSSHTunnels = [],
  /**
   * Store the apps' RSA public key
   * In this way, there's no need to request the key every time from the keys generator tool
   */
  publicKey = ''

// Get the set extra resources path from the main thread
$(document).ready(() => IPCRenderer.on('extra-resources-path', (_, path) => {
  // Adopt the set path
  extraResourcesPath = path

  // The config module; to get the app's config and sync with any change
  const Config = require(Path.join(__dirname, '..', '..', 'custom_modules', 'renderer', 'config'))

  let internalDataPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'internal_data')

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

  /**
   * Check the status of either enabling or disabling the logging feature
   * Get the app's config
   */
  Config.getConfig(async (config) => {
    // Check the status of either enabling or disabling the logging feature
    isLoggingFeatureEnabled = config.get('security', 'loggingEnabled') || isLoggingFeatureEnabled

    // Convert the flag to a boolean instead of a string
    isLoggingFeatureEnabled = isLoggingFeatureEnabled == 'false' ? false : true
  })

  // Handle all communication channels with the main thread
  {
    // SSH tunnels creation and controlling
    {
      // Request from the main thread to create an SSH tunnel
      IPCRenderer.on(`ssh-tunnel:create`, async (_, data) => {
        // Add log for this request
        try {
          addLog(`Create an SSH tunnel to activate connection`, 'network')
        } catch (e) {}

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
            ] = await getRandom.port(2)

            // If no specific port passed for the SSH server then use 22
            data.port = data.port || 22

            // Same for the destination address/host, default is 127.0.0.1 - localhost -
            data.dstAddr = data.dstAddr || '127.0.0.1'

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
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
            }

            try {
              // If a pass phrase for the private key file has been passed
              if (data.passphrase == undefined || data.passphrase.trim().length <= 0)
                throw 0

              // Parse the key file's content using the `parseKey` function
              let prasedKey = SSH2Utils.parseKey(authentication.privateKey, data.passphrase)

              // Ignore the parsed private key in case the format is `ed25519`
              if (prasedKey.type.includes('ed25519'))
                throw 0

              // Update the key's content
              authentication.privateKey = prasedKey.getPrivatePEM()
            } catch (e) {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
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
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
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
                  addLog(data)
                } catch (e) {}
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
              try {
                addLog(`Final attributes of the SSH tunnel are '${JSON.stringify(sshTunnelAttributesCopy)}'`)
              } catch (e) {}
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
                  try {
                    addLog(`The SSH tunnel which associated with request ID '${data.requestID}' has been closed`)
                  } catch (e) {}

                  // Remove the SSH tunnel from being closed
                  toBeClosedSSHTunnels = toBeClosedSSHTunnels.filter((_requestID) => _requestID == data.requestID)
                } catch (e) {
                  try {
                    errorLog(e, 'SSH tunnel')
                  } catch (e) {}
                }

                // Skip the upcoming code and stop the process
                return
              } catch (e) {}

              /**
               * Set the SSH tunnel's object key in the array
               * The key is either the connection's ID or the port
               */
              let key = data.connectionID == 'port' ? `_${localPort}` : data.connectionID

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
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}

              // Catch any occurred error
              result.error = e.toString()

              if (minifyText(result.error).includes('connectionrefused'))
                result.error = `${result.error}. Ensure that Cassandra is up and running, then start taking additional steps if the error persists`

              // Send the creation result to the main thread
              IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
                ...result,
                requestID: data.requestID
              })
            })
          } catch (e) {
            try {
              errorLog(e, 'SSH tunnel')
            } catch (e) {}

            // Catch any occurred error
            result.error = e.toString()

            if (minifyText(result.error).includes('connectionrefused'))
              result.error = `${result.error}. Ensure that Cassandra is up and running, then start taking additional steps if the error persists`

            // Send the creation result to the main thread
            IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
              ...result,
              requestID: data.requestID
            })
          }
        })
      })

      // Request to close an SSH tunnel based on the connection's ID
      IPCRenderer.on('ssh-tunnel:close', (_, connectionID) => {
        /**
         * Check if the given `connectionID` is the port
         * This occurs when a request comes from a connection test to a connection that is about to be added or updated.
         */
        let isPort = !isNaN(parseInt(connectionID))

        // Add log for this process
        try {
          addLog(`Close an SSH tunnel that associated with the connection of ID/defined-port '${connectionID}'`, 'network')
        } catch (e) {}

        try {
          // If what has been given is not a port then skip this try-catch block
          if (!isPort)
            throw 0

          // Loop through the active SSH tunnels
          Object.keys(sshTunnelsObjects).forEach((tunnel) => {
            // Define the current SSH tunnel
            let sshTunnel = sshTunnelsObjects[tunnel]

            // If the current SSH tunnel's port is not the given one then skip it and move to the next tunnel
            if (sshTunnel.port != connectionID)
              return

            // Close that SSH tunnel
            try {
              sshTunnel.object.close()

              // Add log for this process
              try {
                addLog(`The SSH tunnel which associated with connection of ID/defined-port '${connectionID}' has been closed`)
              } catch (e) {}
            } catch (e) {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
            }
          })

          // Skip the upcoming code
          return
        } catch (e) {
          try {
            errorLog(e, 'SSH tunnel')
          } catch (e) {}
        }

        // Close that SSH tunnel
        try {
          sshTunnelsObjects[connectionID].object.close()

          // Add log for this process
          addLog(`The SSH tunnel which associated with connection of ID/defined-port '${connectionID}' has been closed.`)
        } catch (e) {
          try {
            errorLog(e, 'SSH tunnel')
          } catch (e) {}
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
            try {
              errorLog(e, 'SSH tunnel')
            } catch (e) {}
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

    {
      let handleCQLExecution = (data) => {
        let finalContent = '',
          count = 0,
          errors = [],
          totalExecutions = 0

        try {
          IPCRenderer.removeAllListeners(`pty:data:${data.id}`)
        } catch (e) {}

        IPCRenderer.on(`pty:data:${data.id}`, (_, _data) => {
          try {
            count += 1

            finalContent = `${finalContent}${_data.output}`

            // If no output has been detected then skip this try-catch block
            if (!finalContent.includes('KEYWORD:OUTPUT:COMPLETED:ALL'))
              throw 0

            totalExecutions += 1

            // Get the detected output of each statement
            let detectedOutput = finalContent.match(/([\s\S]*?)KEYWORD:OUTPUT:COMPLETED:ALL/gm)

            try {
              for (let output of detectedOutput) {
                finalContent = finalContent.replace(output, '')

                let statementOutputRegex = /KEYWORD:OUTPUT:STARTED([\s\S]*?)KEYWORD:OUTPUT:COMPLETED/gm,
                  // Define variable to initially hold the regex's match
                  matches,
                  // The index of loop's pointer
                  loopIndex = -1

                while ((matches = statementOutputRegex.exec(output)) !== null) {
                  // Increase the loop; to match the identifier of the current output's statement
                  loopIndex = loopIndex + 1

                  // Avoid infinite loops with zero-width matches
                  if (matches.index === statementOutputRegex.lastIndex)
                    statementOutputRegex.lastIndex++

                  matches.forEach((match, groupIndex) => {
                    // Ignore specific group
                    if (groupIndex != 1)
                      return

                    let isErrorFound = `${match}`.indexOf('KEYWORD:ERROR:STARTED') != -1

                    if (isErrorFound)
                      errors.push(`${match}`)
                  })
                }
              }
            } catch (e) {}

            if (!(count % 100 == 0 || minifyText(_data.output).includes('keyword:output:source:completed')))
              return

            let finalData = {
              ...data,
              totalExecutions,
              errors: JSON.stringify(errors),
              isFinished: minifyText(_data.output).includes('keyword:output:source:completed')
            }

            IPCRenderer.send(`cql:file:execute:data`, finalData)

            errors = []
          } catch (e) {}
        })
      }

      IPCRenderer.on('cql:file:execute', (_, data) => handleCQLExecution(data))
    }

    // Encrypt/Decrypt provided metadata
    {
      IPCRenderer.on('background:text:encrypt', async (_, data) => {
        let encryptedText = ''

        try {
          encryptedText = encryptText(data.key, data.text)
        } catch (e) {}

        try {
          ZLib.gzip(encryptedText, {
            level: ZLib.constants.Z_BEST_COMPRESSION
          }, async (err, compressedText) => {
            try {
              if (err)
                return

              try {
                encryptedText = compressedText.toString('base64')
              } catch (e) {}

              if (encryptedText.length <= 0 || data.keychainOSName == null)
                return

              try {
                await FS.ensureDir(internalDataPath)
              } catch (e) {}

              try {
                await FS.writeFileSync(Path.join(internalDataPath, `${data.keychainOSName}.blob`), encryptedText)
              } catch (e) {}
            } catch (e) {}
          })
        } catch (e) {}
      })

      IPCRenderer.on(`background:text:decrypt`, async (_, data) => {
        let decryptedText = '',
          sendResult = () => IPCRenderer.send(`background:text:decrypt:result:${data.requestID}`, decryptedText)

        try {
          if (data.keychainOSName == null)
            throw 0

          try {
            await FS.ensureDir(internalDataPath)
          } catch (e) {}

          try {
            data.text = await FS.readFileSync(Path.join(internalDataPath, `${data.keychainOSName}.blob`), 'utf8')
          } catch (e) {}

          ZLib.gunzip(Buffer.from(data.text, 'base64'), async (err, decompressed) => {
            if (err)
              return sendResult()

            try {
              decryptedText = decompressed.toString()
            } catch (e) {}

            try {
              decryptedText = decryptText(data.key, decryptedText)
            } catch (e) {}

            sendResult()
          })

          return
        } catch (e) {}

        try {
          decryptedText = decryptText(data.key, data.text)
        } catch (e) {}

        sendResult()
      })
    }
  }
}))
