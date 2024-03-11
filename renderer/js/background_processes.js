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
  // JQuery library
  $ = require('jquery'),
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
  OpenSSHTunnel = require('open-ssh-tunnel'),
  /**
   * Useful SSH2 utilities
   * Used especially for `parseKey` function
   */
  SSH2Utils = require('ssh2').utils,
  // JS module for text differencing implementation
  Diff = require('diff'),
  // The config module; to get the app's config and sync with any change
  Config = require(Path.join(__dirname, '..', '..', 'custom_node_modules', 'renderer', 'config'))

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

// An array to hold all created SSH tunnels
let sshTunnels = [],
  // Boolean value used to tell if the logging system should be enabled in the current session or not
  isLoggingEnabled = true

/**
 * Check the status of either enabling or disabling the logging feature
 * Get the app's config
 */
Config.getConfig(async (config) => {
  // Check the status of either enabling or disabling the logging feature
  isLoggingEnabled = config.get('security', 'loggingEnabled') || isLoggingEnabled

  // Convert the flag to a boolean instead of a string
  isLoggingEnabled = isLoggingEnabled == 'false' ? false : true
})

// Handle all communication channels with the main thread
{
  // SSH tunnels creation and controlling
  {
    // Request from the main thread to create an SSH tunnel
    IPCRenderer.on(`ssh-tunnel:create`, async (_, data) => {
      // Add log for this request
      addLog(`Request to create an SSH tunnel.`, 'network')

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
            if (![undefined, null, ''].includes(data.privateKey))
              authentication.privateKey = await FS.readFileSync(data.privateKey, 'utf8')
          } catch (e) {}

          try {
            // If a pass phrase for the private key file has been passed
            if (data.passphrase == undefined || data.passphrase.trim().length <= 0)
              throw 0

            // Parse the key file's content using the `parseKey` function
            let prasedKey = SSH2Utils.parseKey(authentication.privateKey, data.passphrase)

            // Update the key's content
            authentication.privateKey = prasedKey.getPrivatePEM()
          } catch (e) {}

          // Make sure there's no key with an `undefined` value
          try {
            // Loop through the `data` JSON object
            Object.keys(data).forEach((key) => {
              if (`${data[key]}` == 'undefined')
                delete data[key]
            })

            // Loop through the `authentication` JSON object
            Object.keys(authentication).forEach((key) => {
              if (`${authentication[key]}` == 'undefined')
                delete authentication[key]
            })
          } catch (e) {}

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
            addLog(`Final attributes of the SSH tunnel are ${JSON.stringify(sshTunnelAttributesCopy)}`)
          }

          // Create the tunnel
          let tunnel = await OpenSSHTunnel(sshTunnelAttributes)

          /**
           * Set the SSH tunnel's object key in the array
           * The key is either the cluster's ID or the port
           */
          let key = data.clusterID == 'port' ? `_${localPort}` : data.clusterID

          // Add the SSH tunnel to the array
          sshTunnels[key] = {
            object: tunnel,
            port: localPort
          }

          // Update the `port` attribute of the result
          result.port = localPort
        } catch (e) {
          // Catch any occurred error
          result.error = e.toString()
        } finally {
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
      addLog(`Request to close an SSH tunnel, associated cluster ID/port is ${clusterID}.`, 'network')

      try {
        // If what has been given is not a port then skip this try-catch block
        if (!isPort)
          throw 0

        // Loop through the active SSH tunnels
        Object.keys(sshTunnels).forEach((tunnel) => {
          // Define the current SSH tunnel
          let sshTunnel = sshTunnels[tunnel]

          // If the current SSH tunnel's port is not the given one then skip it and move to the next tunnel
          if (sshTunnel.port != clusterID)
            return

          // Close that SSH tunnel
          try {
            sshTunnel.object.close()

            // Add log for this process
            addLog(`The SSH tunnel which associated with cluster ID/port ${clusterID} has been closed.`)
          } catch (e) {
            // Add log for this process
            addLog(`Failed to close SSH tunnel which associated with cluster ID/port ${clusterID}. Error details ${e}.`, 'error')
          }
        })

        // Skip the upcoming code
        return
      } catch (e) {}

      // Close that SSH tunnel
      try {
        sshTunnels[clusterID].object.close()

        // Add log for this process
        addLog(`The SSH tunnel which associated with cluster ID/port ${clusterID} has been closed.`)
      } catch (e) {
        // Add log for this process
        addLog(`Failed to close SSH tunnel which associated with cluster ID/port ${clusterID}. Error details ${e}.`, 'error')
      }
    })

    // Request to update the key/ID of a created SSH tunnel
    IPCRenderer.on('ssh-tunnel:update', (_, data) => {
      try {
        if (sshTunnels[data.newID] != undefined)
          throw 0

        // Set the new ID in the `sshTunnels` array and make sure to put the SSH tunnel's object in it
        sshTunnels[data.newID] = sshTunnels[data.oldID]
      } catch (e) {}
    })
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
        for (let i = data.oldText.length; i < data.oldText.length + numOfLines; ++i)
          newLines.push({
            number: i,
            content: data.newText[i]
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
              content: oldLine
            })
        } catch (e) {}
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
}
