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
 * Module to handle Apache Cassandra's connections and all related processes
 *
 * Import needed modules
 *
 * Extract string based on a given pattern
 * As this module is only needed for this module it has been imported within its scope
 */
const Extract = require('extract-string'),
  // Access and manage the system's keychain
  Keytar = require('keytar')

/**
 * Return all saved connections for a specific workspace,
 * with their info to be used for connection and easy access for the UI
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {boolean} `?rawData` only return connections' object from the JSON file
 *
 * @Return: {object} list of saved connections
 */
let getConnections = async (workspaceID, rawData = false) => {
  let connections = [] // Final object which be returned

  // Add log about this process
  try {
    addLog(`Retrieve saved connections`, 'process')
  } catch (e) {}

  try {
    // Get the workspace's folder path
    let workspaceFolder = getWorkspaceFolderPath(workspaceID)

    // Get all saved connections in that workspace by reading its `connections.json` file
    let savedConnections = await FS.readFileSync(Path.join(workspaceFolder, 'connections.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      savedConnections = JSON.parse(savedConnections)
    } catch (e) {
      savedConnections = []
    }

    // Passing a `true` value will return the saved connections without any manipulation
    if (rawData)
      return savedConnections

    // Loop through the workspace's connections
    for (let connection of savedConnections) {
      try {
        // This `temp` object will be used to manipulate the current connection's info and then pushed
        let temp = {
          name: connection.name,
          folder: connection.folder,
          host: '',
          cqlshrc: '',
          cqlshrcPath: '',
          info: {
            id: '',
            datacenter: ''
          }
        }

        // Define the connection's folder path
        let connectionFolderPath = Path.join(workspaceFolder, connection.folder),
          /**
           * Try to access files in that folder
           * This is required; to get the content of the `info.json` file, also, the content of the `cqlsh.rc` file
           */
          info = await FS.readFileSync(Path.join(connectionFolderPath, 'info.json'), 'utf8')

        // Define the cqlsh.rc content
        let cqlshrc = ''

        // In case the connection is not a secure connection bundle
        if (connection.scb == undefined)
          cqlshrc = await FS.readFileSync(Path.join(connectionFolderPath, 'config', 'cqlsh.rc'), 'utf8')

        // Add the connection's info to the `temp.info` object and make sure to convert JSON content from string to object
        temp.info = JSON.parse(info)

        /**
         * Check if the current connection has secrets to be passed with the final result
         *
         * Different implementation has been performed for Linux and macOS, and Windows
         */
        try {
          // Define the final array which will hold the secrets
          let secrets = []

          try {
            // Get all saved secrets from the keychain
            secrets = await Keytar.findCredentials('AxonOpsWorkbenchClustersSecrets')
          } catch (e) {
            try {
              errorLog(e, 'connections')
            } catch (e) {}
          }

          // Find secrets associated with the current connection
          let secret = secrets.find((secret) => secret.account == temp.info.id)

          // If no secrets are found then skip this try-catch block
          if (secret == undefined)
            throw 0

          // Add those secrets to the final result
          temp.info.secrets = JSON.parse(secret.password)
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        try {
          if (cqlshrc.length <= 0)
            throw 0

          // Add the content of the `cqlsh.rc` file alongside the path to the file
          temp.cqlshrc = cqlshrc
          temp.cqlshrcPath = Path.join(connectionFolderPath, 'config', 'cqlsh.rc')

          /**
           * Get the connection's host to be used by the UI with ease
           * Final result will be `{IP}:{Port}`
           */
          let cqlshContent = await getCQLSHRCContent(workspaceID, cqlshrc, null),
            host = `${cqlshContent.connection.hostname || '127.0.0.1'}:${cqlshContent.connection.port || '9040'}`

          temp.host = host
        } catch (e) {}

        try {
          if (connection.scb != undefined)
            throw 0

          // Check SSH tunneling info existence, and if so then add that info to `temp`
          let sshTunnel = []
          try {
            // Get the info file of the current connection
            sshTunnel = await FS.readFileSync(Path.join(connectionFolderPath, 'config', 'ssh-tunnel.json'), 'utf8')

            // Convert the JSON content from string to object
            try {
              sshTunnel = JSON.parse(sshTunnel)
            } catch (e) {
              sshTunnel = []
            }

            // If the result of parsing `sshTunnel` is not a JSON object then skip the upcoming code
            if (typeof sshTunnel != 'object' || sshTunnel.length <= 0)
              throw 1

            // Try to change variables to their values
            try {
              // Get variables based on the workspace
              let variables = await getProperVariables(workspaceID)

              // Call the `variablesToValues` function and change what needed to variables
              sshTunnel = variablesToValues(sshTunnel, variables)
            } catch (e) {}

            // Update host value as we now have SSH tunneling info
            temp.host = sshTunnel.dstAddr != '127.0.0.1' ? sshTunnel.dstAddr : sshTunnel.host
            temp.host = `${temp.host}:${sshTunnel.dstPort}`
          } catch (e) {
            try {
              errorLog(e, 'connections')
            } catch (e) {}

            sshTunnel = []
          }

          /**
           * Check if either a passphrase or a private key exist
           * If so then set them in the OS keychain and remove them
           */
          try {
            if (['passphrase', 'privatekey'].every((attribute) => sshTunnel[attribute] == undefined))
              throw 0

            let savedSecrets = temp.info.secrets,
              finalSecrets = {}

            if (savedSecrets != undefined) {
              finalSecrets = {
                ...savedSecrets
              }
            }

            if (sshTunnel.passphrase != undefined)
              delete sshTunnel.passphrase

            if (sshTunnel.privatekey != undefined) {
              finalSecrets.sshPrivatekey = `${sshTunnel.privatekey}`

              delete sshTunnel.privatekey
            }

            await Keytar.setPassword(
              'AxonOpsWorkbenchClustersSecrets',
              temp.info.id, JSON.stringify({
                ...finalSecrets
              })
            )

            await FS.writeFileSync(Path.join(connectionFolderPath, 'config', 'ssh-tunnel.json'), beautifyJSON(sshTunnel))
          } catch (e) {}

          sshTunnel.passphrase = temp.info.secrets.sshPassphrase
          sshTunnel.privatekey = temp.info.secrets.sshPrivatekey

          // Set SSH tunneling info in `temp.ssh` object
          temp.ssh = sshTunnel
        } catch (e) {}

        // Push the temp into the `connections` array
        connections.push(temp)
      } catch (e) {}
    }
  } catch (e) {
    try {
      errorLog(e, 'connections')
    } catch (e) {}
  } finally {
    // Return the final `connections` object if the raw data hasn't been sent already
    if (!rawData)
      return connections
  }
}

/**
 * Save a passed connection
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {object} `connection` the connection's info and data to be saved
 *
 * @Return: {boolean} the saving process has succeeded or failed
 */
let saveConnection = async (workspaceID, connection) => {
  // Saving process status: [false: Not saved, true: Saved]
  let status = false

  // Add log about this process
  try {
    addLog(`Save connection with attributes '${JSON.stringify(connection)}' in the workspace '${workspaceID}'`, 'process')
  } catch (e) {}

  try {
    // Get the workspace's folder path by its ID
    let workspaceFolder = getWorkspaceFolderPath(workspaceID),
      // Get all saved workspaces
      workspaces = await Modules.Workspaces.getWorkspaces(),
      // Get the related workspace object by its folder
      workspace = workspaces.find((workspace) => workspace.folder == Path.basename(workspaceFolder))

    // If we weren't able to get the workspace then stop the saving process
    if (workspace == undefined)
      return status // false

    // Get all saved connections
    let connections = await getConnections(workspaceID, true)

    // Extract the connection's folder name based on its given name
    let folder = Sanitize(connection.name),
      // Check if the folder name already exists - there is a duplication -
      duplication = connections.find((connection) => manipulateText(connection.folder) == manipulateText(folder))

    // If the folder name exists then stop the saving process
    if (duplication != undefined)
      return status // false

    let newConnection = {
      name: connection.name,
      folder
    }

    if (connection.info.secureConnectionBundlePath != undefined)
      newConnection.scb = true

    // Otherwise, push the new connection
    connections.push(newConnection)

    // Define the connection folder path - which will be created - by joining the workspace folder path with the connection's folder name
    let connectionFolderPath = Path.join(workspaceFolder, folder)

    // Create the connection's folder path and its `logs` and `config` folders
    await FS.mkdirSync(connectionFolderPath)
    await FS.mkdirSync(Path.join(connectionFolderPath, 'logs'))
    await FS.mkdirSync(Path.join(connectionFolderPath, 'config'))
    await FS.mkdirSync(Path.join(connectionFolderPath, 'snapshots'))

    // Inside the `config` folder create the `cqlsh.rc` file and put the passed content to it
    if (connection.info.secureConnectionBundlePath == undefined)
      await FS.writeFileSync(Path.join(connectionFolderPath, 'config', 'cqlsh.rc'), connection.cqlshrc)

    try {
      if (connection.info.secureConnectionBundlePath != undefined)
        throw 0

      // If we don't have SSH info then we'll keep the file empty
      connection.ssh = connection.ssh || ''

      // Change what can be changed from SSH tunneling info values to variables
      connection.ssh = await variablesManipulation(workspaceID, connection.ssh)

      try {
        delete connection.ssh.passphrase
      } catch (e) {}

      try {
        if (connection.ssh.privatekey == undefined)
          throw 0

        if (connection.info.secrets == undefined)
          connection.info.secrets = {}

        connection.info.secrets.sshPrivatekey = `${connection.ssh.privatekey}`

        delete connection.ssh.privatekey
      } catch (e) {}

      // Write final SSH tunneling info in the `ssh-tunnel.json` file
      await FS.writeFileSync(Path.join(connectionFolderPath, 'config', 'ssh-tunnel.json'), beautifyJSON(connection.ssh))

      /**
       * Update the `cqlsh.rc` file content by replacing strings with variables
       * We do this after writing the original `cqlsh.rc` content; so if any error occurs the original file is reserved
       */
      await updateFilesVariables(workspaceID, connection.cqlshrc, Path.join(connectionFolderPath, 'config', 'cqlsh.rc'))
    } catch (e) {}

    // Check if secrets have been provided to be saved - username and password for Apache Cassandra and SSH tunneling info -
    try {
      // If no secrets have been provided then skip this try-catch block
      if (connection.info.secrets == undefined || Object.keys(connection.info.secrets).length <= 0)
        throw 0

      // Save the connection's secrets in the keychain associated with its ID
      await Keytar.setPassword(
        'AxonOpsWorkbenchClustersSecrets',
        connection.info.id, JSON.stringify({
          ...connection.info.secrets
        })
      )
    } catch (e) {
      try {
        errorLog(e, 'connections')
      } catch (e) {}
    }

    // Delete secrets from connection object if exist; to prevent adding them in `connections.json` and `info.json` files
    try {
      delete connection.info.secrets
    } catch (e) {}

    // Write the info content in `info.json` file
    await FS.writeFileSync(Path.join(connectionFolderPath, 'info.json'), beautifyJSON(connection.info))

    // Update saved `connections.json` file by adding the new connection
    await FS.writeFileSync(Path.join(connectionFolderPath, '..', 'connections.json'), beautifyJSON(connections))

    // Successfully saved
    status = true
  } catch (e) {
    try {
      errorLog(e, 'connections')
    } catch (e) {}

    // Failed to save
    status = false
  } finally {
    // Return saving process status
    return status
  }
}

/**
 * Update a passed connection
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {object} `connection` the connection's info and data to be saved
 * `connection` should contain the `original` object; which has the original connection object before the edit/update
 *
 * @Return: {boolean} the updating process has succeeded or failed
 */
let updateConnection = async (workspaceID, connection) => {
  // Updating process status: [false: Not updated, true: Updated]
  let status = false

  // Add log about this process
  try {
    addLog(`Update/edit connection with attributes '${JSON.stringify(connection)}' in the workspace '${workspaceID}'`, 'process')
  } catch (e) {}

  try {
    // Get the workspace's folder path by its ID
    let workspaceFolder = getWorkspaceFolderPath(workspaceID),
      // Get all saved workspaces
      workspaces = await Modules.Workspaces.getWorkspaces(),
      // Get the workspace in which the given connection to update is saved
      workspace = workspaces.find((workspace) => workspace.folder == Path.basename(workspaceFolder))

    // If we weren't able to get the workspace then stop the saving process
    if (workspace == undefined)
      return status

    // Get all saved connections
    let connections = await getConnections(workspaceID, true),
      // Extract the connection's new folder name from its new name
      folder = Sanitize(connection.name),
      // Get the index of the connection we want to update by its folder name
      targetConnectionIndex = connections.findIndex((_connection) => manipulateText(Sanitize(_connection.folder)) == manipulateText(Sanitize(connection.original.folder))),
      // Define an object which will hold the target connection's object
      targetConnection

    // If no connection has been found then end the updating process with a failure
    if (targetConnectionIndex == -1)
      return status

    // Point at the target connection's object
    targetConnection = connections[targetConnectionIndex]

    // Update the name, and folder to the new given values
    targetConnection = {
      ...targetConnection,
      name: connection.name,
      folder
    }

    if (connection.info.secureConnectionBundlePath != undefined)
      targetConnection.scb = true

    // Update the target connection
    connections[targetConnectionIndex] = targetConnection

    // Define the original and the new connection folder path
    let originalConnectionFolderPath = Path.join(workspaceFolder, connection.original.folder),
      newConnectionFolderPath = Path.join(originalConnectionFolderPath, '..', folder)

    // Rename the connection folder
    await FS.renameSync(originalConnectionFolderPath, newConnectionFolderPath)

    try {
      if (connection.info.secureConnectionBundlePath != undefined)
        throw 0

      /**
       * Update files;
       * `cqlsh.rc`, `ssh-tunnel.json`, and `connections.json` files
       * Start with `cqlsh.rc` file by replacing its content with the new one then attempt to replace strings in its content with variables
       */
      await FS.writeFileSync(Path.join(newConnectionFolderPath, 'config', 'cqlsh.rc'), connection.cqlshrc)
      await updateFilesVariables(workspaceID, connection.cqlshrc, Path.join(newConnectionFolderPath, 'config', 'cqlsh.rc'))

      /**
       * Update `ssh-tunnel.json` file
       * If we don't have SSH info then we'll keep the file empty
       */
      connection.ssh = connection.ssh || ``

      // Change what can be changed from SSH tunneling info values to variables
      connection.ssh = await variablesManipulation(workspaceID, connection.ssh)

      try {
        delete connection.ssh.passphrase
      } catch (e) {}

      try {
        if (connection.ssh.privatekey == undefined)
          throw 0

        if (connection.info.secrets == undefined)
          connection.info.secrets = {}

        connection.info.secrets.sshPrivatekey = `${connection.ssh.privatekey}`

        delete connection.ssh.privatekey
      } catch (e) {}

      // Write final SSH tunneling info in the `ssh-tunnel.json` file
      await FS.writeFileSync(Path.join(newConnectionFolderPath, 'config', 'ssh-tunnel.json'), beautifyJSON(connection.ssh))
    } catch (e) {}

    try {
      // Check if `secrets` are provided to be saved or updated
      if (connection.info.secrets != undefined && Object.keys(connection.info.secrets).length > 0) {
        try {
          // Save/update the connection's secrets in the keychain associated with its ID
          await Keytar.setPassword('AxonOpsWorkbenchClustersSecrets', connection.info.id, JSON.stringify({
            ...connection.info.secrets
          }))
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        // Skip the upcoming code in the try-catch block
        throw 0
      }

      /**
       * Reaching here means there are no secrets to be saved/updated, so instead secrets associated with the connection should be deleted
       *
       * Delete secrets associated with the connection from the keychain if exist
       */
      await Keytar.deletePassword('AxonOpsWorkbenchClustersSecrets', connection.info.id)
    } catch (e) {
      try {
        errorLog(e, 'connections')
      } catch (e) {}
    }

    // Delete secrets from connection object if exist; to prevent adding them in `connections.json` and `info.json` files
    delete connection.info.secrets

    // Write the updated info content in the `info.json` file
    await FS.writeFileSync(Path.join(newConnectionFolderPath, 'info.json'), beautifyJSON(connection.info))

    // Update saved `connections.json` file by adding the new connection
    await FS.writeFileSync(Path.join(newConnectionFolderPath, '..', 'connections.json'), beautifyJSON(connections))

    // Successfully updated
    status = true
  } catch (e) {
    try {
      errorLog(e, 'connections')
    } catch (e) {}

    // Failed to update
    status = false
  } finally {
    // Return updating process status
    return status
  }
}

/**
 * Delete a passed connection
 *
 * @Parameters:
 * {string} `workspaceFolder` the target workspace's folder path
 * {string} `connectionFolder` the target connection's folder path
 * {string} `connectionID` the target connection's ID
 * {object} `callback` function that will be triggered with passing the deletion status
 * {boolean} `?keepFiles` whether or not related files should be kept in the system
 *
 * @Return: {boolean} the deletion process's status
 */
let deleteConnection = async (workspaceFolder, connectionFolder, connectionID, callback, keepFiles = false) => {
  // Define the connection folder's path in the workspace
  let connectionPath = Path.join(workspaceFolder, connectionFolder)

  // Add log about this process
  try {
    addLog(`Delete connection '${connectionID}' in workspace '${workspaceFolder}'`, 'process')
  } catch (e) {}

  try {
    // Remove the entire folder, recursively, with no exceptions
    if (!keepFiles)
      await FS.rmSync(connectionPath, {
        recursive: true,
        force: true
      })

    // Keep the connection's folder, however, add a prefix `_DEL_` with random digits
    if (keepFiles)
      await FS.moveSync(connectionPath, `${connectionPath}_DEL_${getRandom.id(5)}`, {
        overwrite: true
      })

    // Update `connections.json` file by removing the deleted connection
    let connections = await FS.readFileSync(Path.join(connectionPath, '..', 'connections.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      connections = JSON.parse(connections)
    } catch (e) {
      connections = []
    }

    // Filter connections; remove the connection we're deleting right now
    connections = connections.filter((connection) => connection.folder != connectionFolder)

    // Convert connections object to JSON string
    connections = beautifyJSON(connections)

    // Handle when we now have no added connections
    connections = connections == '[]' ? '' : connections

    // Write the new connections list
    await FS.writeFileSync(Path.join(connectionPath, '..', 'connections.json'), connections)

    // Remove any stored data - regards executed statements' history - for the connection if exists
    Store.remove(connectionID)

    // Delete secrets associated with the deleted connection
    try {
      // Delete the connection's secrets from the keychain
      await Keytar.deletePassword('AxonOpsWorkbenchClustersSecrets', connectionID)
    } catch (e) {
      try {
        errorLog(e, 'connections')
      } catch (e) {}
    }

    // Call the `callback` function with `true` as the deletion process was successfully completed
    callback(true)
  } catch (e) {
    try {
      errorLog(e, 'connections')
    } catch (e) {}

    // If any error has occurred then call the `callback` function with `false`
    callback(false)
  }
}

/**
 * Get the content of `cqlsh.rc` file as a formatted array of sections and options
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {string} `?cqlshrc` a `cqlsh.rc` file content
 * {object} `?editor` the editor's object that can be used to get its content
 * {boolean} `?changeVariables` Change variables inside options' values to their values
 *
 * @Return: {object} formatted array of sections and options
 */
let getCQLSHRCContent = async (workspaceID, cqlshrc = null, editor = null, changeVariables = true) => {
  let result = [] // Final result that will be returned

  try {
    // Get the `cqlsh.rc` content either by passing one or from the editor
    let content = cqlshrc || editor.getValue(),
      // Get all "active" options and sections
      active = content.match(/^((?![\;\[])|(\;*\s*\[)).+/gm)

    // Loop through all matched options and sections
    for (let value of active) {
      try {
        // Extract the option key and value
        let option = `${value}`.split(/\s*\=\s*/gm)

        // Push them separately - name and value -
        result.push({
          name: option[0],
          value: option[1]
        })
      } catch (e) {}
    }

    // Now we loop through the results; to distinguish between an option and a section
    for (let i = 0; i < result.length; i++) {
      try {
        // If the matched object has a value `name = value` then it's not a section and we may skip it
        if (result[i].value != undefined)
          continue

        // Otherwise, extract the section name
        let option = await Extract(result[i].name).pattern('[{section}]')

        // Update the `name` attribute
        result[i].name = option[0].section
      } catch (e) {}
    }

    /**
     * Group options under its suitable section
     *
     * This array will hold each section and under it its options
     */
    let finalResults = [],
      // This string will be changed frequently; so we can switch between sections and add options correctly
      currentSection = ''

    // Loop through all options and sections
    for (let i = 0; i < result.length; i++) {
      // Check if the current object doesn't have a value, and if so then it's a section and we may set it; to push the upcoming options under it
      if (result[i].value == undefined) {
        // We should change the current section
        currentSection = result[i].name

        // Add the new section in the final results; so the upcoming options will be pushed under it
        finalResults[currentSection] = []

        // Skip the upcoming code and move to the next object
        continue
      }

      /**
       * The current object is an option
       * Add the option under the current section
       * Check if the current option is a script, and if it's under pre or post-connect sections
       */
      let isScript = result[i].name == 'script' && ['preconnect', 'postconnect'].includes(currentSection)

      // If the current option is a script hen rename `script` to something unique; because we can't add multiple values with the same name
      if (isScript)
        result[i].name = `${result[i].name}_${i}`

      // Push option under the current section
      finalResults[currentSection][result[i].name] = result[i].value
    }

    // Adopt the new results
    result = finalResults
  } catch (e) {} finally {
    /**
     * Final process is to check if we need to change variables to their value
     * This is done by passing `changeVariables` with `true` value
     */
    try {
      // If there's no need to change variables then skip this try-catch block
      if (!changeVariables)
        throw 0

      // Get sections from the `result` object
      let sections = Object.keys(result),
        // Get variables based on the workspace
        variables = await getProperVariables(workspaceID)

      // Loop through every section
      sections.forEach((section) => {
        // Get options of the current section
        let options = Object.keys(result[section])

        // If the current section has no options then skip it and move to the next one
        if (options.length <= 0)
          return

        // Loop through every option in the section
        for (let _option of options) {
          // Get the option's value
          let option = result[section][_option],
            // Check if there are variables in that value
            exists = variables.filter((variable) => option.search('${' + variable.name + '}'))

          // If no variable has been found then skip the current option and move to the next one
          if (exists.length <= 0)
            continue

          // Otherwise, loop through all found variables and change them to their values
          exists.forEach((variable) => {
            let regex = createRegex('${' + variable.name + '}', 'gm')

            option = `${option}`.replace(regex, variable.value)
          })

          // Set the final value
          result[section][_option] = option
        }
      })
    } catch (e) {}

    // Return the final result
    return result
  }
}

/**
 * Set `cqlsh.rc` file options' values to new ones based on a passed sections array
 *
 * @Parameters:
 * {object} `sections` array of content's sections and their options
 * {string} `?cqlshrc` a `cqlsh.rc` file content
 * {object} `?editor` the editor's object that can be used to get its content
 *
 * @Return: {string} the passed `cqlsh.rc` file content updated with the passed sections array
 */
let setCQLSHRCContent = (sections, cqlshrc = null, editor = null) => {
  let content = '' // Final content which be returned

  try {
    // Get the `cqlsh.rc` content either by passing one or from the editor
    content = cqlshrc || editor.getValue()

    // Loop through the passed sections
    Object.keys(sections).forEach((section) => {
      /**
       * Create a regular expression
       * It'll match the entire block of a passed section
       */
      let regex = new RegExp('^((?![\\;\\[])|(\\;*\\s*\\[))' + quoteForRegex(section) + '\\](.|\n)*?(?=^\\s*\\[)', 'gm')

      // Get the sections' block
      let block = (content.match(regex))[0]

      // Make a `temp` variable to work on and reserve the original content
      let temp = `${block}`,
        // Get the options within that section
        options = sections[section],
        // Get their keys (names)
        optionsKeys = Object.keys(options)

      // If the current section has no changes in its options then we may skip it
      if (optionsKeys.length <= 0)
        return

      // Otherwise, loop through active options
      optionsKeys.forEach((option) => {
        // Create a regular expression to match that option
        let newRegex = new RegExp('^\\;*\\s*' + quoteForRegex(option) + '.+', 'gm'),
          disabled = false // Whether or not the current option is marked to be disabled

        // If its value is `DISABLED` or it has an empty one
        if (options[option] == undefined || options[option] == 'DISABLED' || `${options[option]}`.trim().length <= 0) {
          // Comment on that option taking into account some exceptions
          disabled = true

          // Empty the option's value
          options[option] = ''
        }

        /**
         * Replace the option value within the section block with the new one or comment it
         * Those exceptions will not be commented on but will have the default value
         */
        let exceptions = ['hostname', 'port']

        temp = `${temp}`.replace(newRegex, `${(disabled && !(exceptions.includes(option))) ? '; ' : ''}${option} = ${options[option]}`)
      })

      // Replace the entire block of the section with the new one
      content = `${content}`.replace(block, temp)
    })
  } catch (e) {} finally {
    // Return the final content
    return content
  }
}

/**
 * Update connection's files' - `cqlsh.rc`, `ssh-tunnel.json`, etc.. - content;
 * by replacing strings with their alternative variables, or updating and deleting existing variables
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {string} `cqlshrc` a passed `cqlsh.rc` file content
 * {string} `cqlshrcPath` the path to the `cqlsh.rc` file
 * {object} `?removedVariables` array of removed variables to be handled
 * {object} `?changedVariables` array of changed variables to be handled
 * {object} `?savedVariables` JSON object which has values of variables `before` and `after` an updating process
 *
 * @Return: {boolean || string} the updating process status, or the updated `cqlsh.rc` file content
 */
let updateFilesVariables = async (workspaceID, cqlshrc, cqlshrcPath, removedVariables = null, changedVariables = null, savedVariables = null) => {
  // Final content which be returned
  let newContent = cqlshrc; // This semicolon is critical here

  // Sort each given array based on the values' lengths
  [savedVariables, removedVariables, changedVariables].forEach((variablesArray) => {
    try {
      variablesArray.sort((a, b) => {
        let aSide = a.value.old || a.value,
          bSide = b.value.old || b.value

        return `${bSide}`.length - `${aSide}`.length
      })
    } catch (e) {}
  })

  // Inner function to get a given variable's value - nested-variables are resolved -
  let getVariableValue = (status, name, scope) => {
    // Final value to be returned
    let value = null

    try {
      // Attempt to get the related object
      let relatedObject = savedVariables[status].find((variable) => variable.name == name && JSON.stringify(variable.scope) == JSON.stringify(scope))

      // Set the variable's value
      value = relatedObject ? relatedObject.value : null
    } catch (e) {}

    // Return the final result
    return value
  }

  // Wrap the updating process in one try-catch block which will hold multiple sub blocks
  try {
    // Get the passed `cqlsh.rc` content as JSON object
    let content = await getCQLSHRCContent(workspaceID, cqlshrc, null, false),
      // Get all sections in that content
      sections = Object.keys(content),
      // Inner function to resolve a given (option/ssh tunnel)'s value - return the value of nested variable(s) -
      resolveValue = (passedValue) => {
        // Define final value to be returned
        let latestOptionValue = passedValue

        try {
          // Check if there is a variable or more in its value
          let exists = savedVariables.after.filter(
            (variable) =>
            // Check the variable's name exists in the option's value
            passedValue.search('${' + variable.name + '}') &&
            // Check that the variable's scope includes the passed workspace
            variable.scope.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace))
          )

          // If the option's value doesn't have variables then skip this try-catch block
          if (exists.length <= 0)
            throw 0

          // Otherwise, change the variable name with its value
          exists.forEach((variable) => {
            // Regex to match the variable's name
            let regex = createRegex('${' + variable.name + '}', 'gm'),
              // Get the variable's value - resolved -
              variableValue = getVariableValue('after', variable.name, variable.scope)

            // Update the passed option
            passedValue = `${passedValue}`.replace(regex, variableValue || variable.value)
          })

          // Recursively call the function
          latestOptionValue = resolveValue(passedValue)
        } catch (e) {}

        // Return the final value
        return latestOptionValue
      }

    // Loop through each section
    for (let section of sections) {
      // Get the current section's active options
      options = Object.keys(content[section])

      // If the current section has no options, then skip it
      if (options.length <= 0)
        continue

      /**
       * Otherwise, many processes will be performed
       *
       * Check if removed variables have been passed, and if so, we'll replace them with their value
       *********
       * [Option's value] => [Check the name of the removed variable exists] => [If so, it'll be replaced with its value]
       *********
       */
      try {
        // If no removed variables have been passed then skip this try-catch block
        if (removedVariables == null)
          throw 0

        // Otherwise, loop through all options
        for (let optionKey of options) {
          // Get the value of the current option
          let option = content[section][optionKey]

          // Check if there are variables or more in the option's value
          try {
            let variablesExist = removedVariables.filter(
              (variable) =>
              // Check the variable's name exists in the option's value
              option.search('${' + variable.name + '}') &&
              // Check that the variable's scope includes the passed workspace
              (`${variable.scope}`.split(',')).some((workspace) => [workspaceID, 'workspace-all'].includes(workspace))
            )

            // If the option's value doesn't have variables then skip to the next option
            if (variablesExist.length <= 0)
              continue

            // Otherwise, change the removed variable's name with its value
            for (let variable of variablesExist) {
              // Regex to match the variable's name
              let regex = createRegex('${' + variable.name + '}', 'gm'),
                // Get the variable's value
                variableValue = getVariableValue('before', variable.name, `${variable.scope}`.split(','))

              // Replace the variable with its value
              option = `${option}`.replace(regex, variableValue || variable.value)
            }
          } catch (e) {}

          // Update the variable's object's value
          content[section][optionKey] = option
        }
      } catch (e) {}

      /**
       * Check if changed variables have been passed, and if so, we'll first replace its old name with its old value, and then replace its new value with its new name, taking into account both; the old and new scope
       *********
       * [Option's value] => [Check the old name of the changed variable exists] => [If so, it'll be replaced with the changed variable's old name]
       * [Option's value] => [Now check the new value of the changed variable exists] => [If so, it'll be replaced with the changed variable's new name]
       *********
       */
      try {
        // If no changed variables have been passed then skip this try-catch block
        if (changedVariables == null)
          throw 0

        // Check where the old variable name is being used - taking into account the old scope - and replace it with its old value
        for (let optionKey of options) {
          // Get the value of the current option
          let option = content[section][optionKey]

          for (let variable of changedVariables) {
            try {
              let variableExists = option.search('${' + variable.name.old + '}') &&
                variable.scope.old.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace))

              // If the variable doesn't exist in the current SSH value then skip it and move to the next changed variable
              if (!variableExists)
                continue

              // Otherwise, replace the variable name with its old value
              let regex = createRegex('${' + variable.name.old + '}', 'gm'),
                // Get the old value
                variableValue = getVariableValue('before', variable.name.old, variable.scope.old)

              // Replace the variable's old name with its old value
              option = `${option}`.replace(regex, variableValue || variable.value.old)
            } catch (e) {}
          }

          // Check where the new variable name is being used and replace it with its new value
          for (let variable of changedVariables) {
            try {
              // Make sure the variable scope is covering the workspace, and if not then skip that variable and move to the next one
              if (!(variable.scope.new.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace))))
                throw 0


              // Get the variable's new value
              let variableValue = getVariableValue('after', variable.name.new, variable.scope.new),
                // Check where the new value exists and change it with the new variable name
                regex = createRegex(`${variableValue || variable.value.new}`, `gm`)

              // Replace the variable's new value with its new name
              option = `${option}`.replace(regex, '${' + variable.name.new + '}')
            } catch (e) {}
          }

          // Update the variable's object's value
          content[section][optionKey] = option
        }
      } catch (e) {}

      // Last process is looping through options again and making sure all variables are set well
      try {
        // Loop through all options
        for (let optionKey of options) {
          // Get the value of the current option
          let option = content[section][optionKey]

          // Attempt to resolve the option's value
          try {
            option = resolveValue(option)
          } catch (e) {}

          try {
            // Determine if the variable is in the option's value or not
            let exists = await retrieveVariables(true)

            exists = exists.filter((variable) => variable.scope.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace)))

            // If no variable's value has been found in the option's value then skip the current option and move to the next one
            if (exists.length <= 0)
              continue

            // Otherwise, loop through variables
            exists.forEach((variable) => {
              let variableValue = getVariableValue('after', variable.name, variable.scope),
                // Replace its value with its name
                regex = createRegex(`${variableValue || variable.value}`, `gm`)

              // Update the option's value
              option = `${option}`.replace(regex, '${' + variable.name + '}')
            })
          } catch (e) {}

          // And update the content object in overall
          content[section][optionKey] = option
        }
      } catch (e) {}
    }

    // Apply the new content on the passed `cqlsh.rc` file content then write it to the `cqlsh.rc` file based on the passed path `cqlshrcPath`
    newContent = await setCQLSHRCContent(content, cqlshrc)

    // Write the new content
    await FS.writeFileSync(cqlshrcPath, newContent)

    /**
     * Handling variables for the `cqlsh.rc` files has been finished
     *
     * Now attempt to update variables in the `ssh-tunnel.json` files
     */
    try {
      // Get SSH tunneling info for the connection using the passed path for `cqlsh.rc` file
      let sshTunnelingInfo = await FS.readFileSync(Path.join(cqlshrcPath, '..', 'ssh-tunnel.json'), 'utf8')

      // Convert JSON content from string to object
      sshTunnelingInfo = JSON.parse(sshTunnelingInfo)

      // Get the SSH values from the `sshValues` object and loop through those values
      for (let sshKey of Object.keys(sshTunnelingInfo)) {
        // Get the value for the current SSH option
        let value = sshTunnelingInfo[sshKey]

        // Check if removed variables have been passed and if so, we'll replace them with their value
        try {
          // If no removed variables have been passed then skip this try-catch block
          if (removedVariables == null)
            throw 0

          try {
            // Check if there is a variable or more in its value
            let variablesExist = removedVariables.filter(
              (variable) =>
              // Check the variable's name exists in the SSH's value
              value.search('${' + variable.name + '}') &&
              // Check that the variable's scope includes the passed workspace
              (`${variable.scope}`.split(',')).some((workspace) => [workspaceID, 'workspace-all'].includes(workspace))
            )

            // If the SSH value doesn't have variables then skip this try-catch block
            if (variablesExist.length <= 0)
              throw 0

            // Otherwise, change the variable name with its value
            for (let variable of variablesExist) {
              // Regex to match the variable's name
              let regex = createRegex('${' + variable.name + '}', 'gm'),
                // Get the variable's value
                variableValue = getVariableValue('before', variable.name, `${variable.scope}`.split(','))

              // Replace the variable with its value
              value = `${value}`.replace(regex, variableValue || variable.value)
            }
          } catch (e) {}

          // Update the overall object's value with the new one
          sshTunnelingInfo[sshKey] = value
        } catch (e) {}

        // Check if changed variables have been passed, and if so, we'll first replace its old name with its old value, and then replace its new value with its new name, taking into account both; the old and new scope
        try {
          // If no changed variables have been passed then skip this try-catch block
          if (changedVariables == null)
            throw 0

          // Check where the old variable name is being used - taking into account the old scope - and replace it with its old value
          for (let variable of changedVariables) {
            try {
              let exists = value.search('${' + variable.name.old + '}') &&
                variable.scope.old.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace))

              // If the variable doesn't exist in the current SSH value then skip it and move to the next changed variable
              if (!exists)
                continue

              // Otherwise, replace the variable name with its old value
              let regex = createRegex('${' + variable.name.old + '}', 'gm'),
                variableValue = getVariableValue('before', variable.name.old, variable.scope.old)

              value = `${value}`.replace(regex, variableValue || variable.value.old)
            } catch (e) {}
          }

          // Check where the new variable name is being used and replace it with its new value
          for (let variable of changedVariables) {
            try {
              // Make sure the variable scope is covering the workspace, and if not then skip that variable and move to the next one
              if (!variable.scope.new.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace)))
                continue

              let variableValue = getVariableValue('after', variable.name.new, variable.scope.new),
                // Check where the new value exists and change it with the new variable name
                regex = createRegex(`${variableValue || variable.value.new}`, `gm`)

              value = `${value}`.replace(regex, '${' + variable.name.new + '}')
            } catch (e) {}
          }

          // Update SSH value
          sshTunnelingInfo[sshKey] = value
        } catch (e) {}

        // Last process is looping through SSH values again and making sure all variables are set well
        try {
          // Attempt to resolve the value
          try {
            value = resolveValue(value)
          } catch (e) {}

          try {
            // Determine if the variable is in the value or not
            let exists = await retrieveVariables(true)

            exists = exists.filter((variable) => variable.scope.some((workspace) => [workspaceID, 'workspace-all'].includes(workspace)))

            // If no variable's value has been found in the SSH value then skip this try-catch block
            if (exists.length <= 0)
              throw 0

            // Otherwise, loop through variables
            exists.forEach((variable) => {
              let variableValue = getVariableValue('after', variable.name, variable.scope),
                // Replace its value with its name
                regex = createRegex(`${variableValue || variable.value}`, `gm`)

              // Update the option's value
              value = `${value}`.replace(regex, '${' + variable.name + '}')
            })
          } catch (e) {}

          // And update the content object in overall
          sshTunnelingInfo[_sshValue] = value
        } catch (e) {}
      }

      // Write new info
      await FS.writeFileSync(Path.join(cqlshrcPath, '..', 'ssh-tunnel.json'), beautifyJSON(sshTunnelingInfo))
    } catch (e) {}

    // If `cqlshrcPath` is `null` then we've passed the editor content and want the final results
    if (cqlshrcPath == null)
      return newContent

    // Otherwise, return true to tell that the update process has successfully finished
    return true
  } catch (e) { // If any error has occurred then return `false` or the `cqlsh.rc` content
    if (cqlshrcPath == null)
      return newContent

    // Or return `false`
    return false
  }
}

/**
 * Get full metadata for a specific connection
 *
 * @Parameters:
 * {string} `connectionID` the ID of the target connection
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {string} the target connection's metadata in JSON string format
 */
let getMetadata = (connectionID, callback) => {
  /**
   * Get a random ID for that request
   * It'll be sent to the main thread
   */
  let metadataSendID = getRandom.id(5)

  // Send the request
  IPCRenderer.send('pty:metadata', {
    id: connectionID,
    metadataSendID
  })

  /**
   * Listen to the response from the main thread
   * The main thread will send the JSON string in parts, and they'll be grouped in the `connectionsMetadata` array, and then converted to JSON object using the `repairJSONString` function
   */
  IPCRenderer.on(`connection:metadata:${metadataSendID}:${connectionID}`, (_, data) => {
    try {
      // If `null` has been received then we weren't able to get the result
      if (data.metadata == null)
        return callback(null)

      // Define the given block of data
      let metadata = data.metadata

      // "Repair" the given metadata to be parsed later
      metadata = repairJSONString(metadata)

      // Call the `callback` function and pass the final metadata JSON object
      callback(metadata)
    } catch (e) {
      callback(null)
    }
  })
}

/**
 * Get CQL description for a specific connection, keyspace in it, or table
 *
 * @Parameters:
 * {string} `connectionID` the ID of the target connection
 * {string} `scope` the scope of the CQL description, possible values:
 * "connection" to get the connection's CQL description overall, "keyspace>{name}" to get a specific keyspace's CQL description, and "keyspace>{name}table>{name}" to get a specific table's CQL description
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {string} the target connection's metadata in JSON string format
 */
let getCQLDescription = (connectionID, scope, callback) => {
  /**
   * Get a random ID for that request
   * It'll be sent to the main thread
   */
  let cqlDescSendID = getRandom.id(10)

  // Send the request to the main thread
  IPCRenderer.send('pty:cql-desc', {
    id: connectionID,
    cqlDescSendID,
    scope
  })

  // Listen to the response from the main thread
  IPCRenderer.on(`connection:cql-desc:${cqlDescSendID}:${connectionID}`, (_, data) => {
    try {
      /**
       * If `null` has been received then we weren't able to get the result
       * Call the `callback` function and pass the final CQL description
       */
      callback(data.cqlDesc)
    } catch (e) {
      // If any error has occurred then return the `null` value
      callback(null)
    }
  })
}

/**
 * Get SSH tunneling info for a specific connection
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace - which has the target connection -
 * {string} `connectionFolder` the target connection's folder path
 *
 * @Return: {object} the SSH tunneling info in JSON object
 */
let getSSHTunnelingInfo = async (workspaceID, connectionFolder) => {
  let result = null // Final result which be returned

  try {
    // Get the workspace's folder path
    let workspaceFolder = getWorkspaceFolderPath(workspaceID),
      // Define connection folder path by joining its name and workspace folder path
      connectionFolderPath = Path.join(workspaceFolder, connectionFolder),
      // Read SSH tunneling info file `ssh-tunnel.json`
      info = await FS.readFileSync(Path.join(connectionFolderPath, 'config', 'ssh-tunnel.json'), 'utf8')

    // Convert JSON content from string to object
    info = JSON.parse(info)

    // Change variables inside SSH values to their values
    try {
      // Get proper variables based on the workspace ID
      let variables = await getProperVariables(workspaceID)

      // Call the `variablesToValues` function and change what needed to variables
      info = variablesToValues(info, variables)
    } catch (e) {}

    // Set the final result
    result = info
  } catch (e) {
    try {
      errorLog(e, 'connections')
    } catch (e) {}
  } finally {
    // Return the final result
    return result
  }
}

/**
 * Get the result of query tracing for a specific session
 *
 * @Parameters:
 * {string} `connectionID` the target connection's ID
 * {string} `sessionID` the target session's ID
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {string} query tracing result in JSON string format
 */
let getQueryTracingResult = (connectionID, sessionID, callback) => {
  let result = '', // Final result which be returned
    requestTimeout = null, // Timeout to be triggered if we don't get a valid result
    requestID = getRandom.id(10), // Generate a random ID for the request
    isResultSent = false // Flag to tell if the result has already been sent for the current request

  // Send a request to get the query tracing result from the main thread, which will use functions in class `Pty`
  IPCRenderer.send('pty:query-tracing', {
    id: requestID,
    connectionID,
    sessionID
  })

  // Set timeout function to be triggered if final result hasn't been received within 5 seconds
  let setRequestTimeOut = () => {
      requestTimeout = setTimeout(() => callTheCallbackFunction(null), 5000)
    },
    // Clear the timeout function and reset it if needed to
    clearRequestTimeOut = (reset = false) => {
      // Clear the timer
      clearTimeout(requestTimeout)

      // If no need to reset then we may skip the upcoming code
      if (!reset)
        return

      // Reset the timeout function again
      setRequestTimeOut()
    },
    // Inner function to determine to call the callback function
    callTheCallbackFunction = (result) => {
      // If the result has already been sent then skip the upcoming code
      if (isResultSent)
        return

      // Update the flag
      isResultSent = true

      // Call the callback function
      callback(result)
    }

  // Call the function; to start the timer
  setRequestTimeOut()

  // The data is sent as chunks, we catch those chunks one by one and add them to `result`, once a keyword (n rows) is found we end the listening and return the result
  IPCRenderer.on(`connection:query-tracing:${requestID}`, (_, data) => {
    // If `null` has been received then we weren't able to get the result
    if (data.block == null)
      return callTheCallbackFunction(null)

    // Append the catched block in `result`
    result += data.block

    // Call the timer clearing function with reset
    clearRequestTimeOut(true)

    // Check if the keyword has been catched
    try {
      // If not, we may skip this try-catch block
      if ((new RegExp('\\(\\s*\\d+\\s*row(s|)\\)')).exec(result) == null)
        throw 0

      // Call the timer clearing function without reset
      clearRequestTimeOut()

      // Manipulate the data before returning it
      try {
        // Create a variable and store the result's content in it; so we'll have a result to return if something went wrong inside that try-catch block
        let temp = result

        // Get rid of the control characters that could be added by the terminal
        temp = `${temp}`.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')

        // Get rid of the styling characters as well
        temp = temp.replace(/(\[0m|\[0\;1\;33m)/g, '')

        // Match and clean more ASCII escape characters for Windows
        if (OS.platform == 'win32')
          temp = temp.replace(/[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\[0K|\[\?25[hl]/g, '')

        // Match the JSON block and ignore everything else
        temp = temp.match(/\{[\s\S]+\}/gm).join('')


        temp = temp.match(/\{.*?\}/gm)

        temp = temp.map((row) => {
          try {
            return JSON.parse(repairJSONString(row))
          } catch (e) {}

          return row
        })

        result = temp
      } catch (e) {}

      // Call the `callback` function and pass the final `result`
      return callTheCallbackFunction(result)
    } catch (e) {}
  })
}

/**
 * Get all saved snapshots of a connection
 *
 * @Parameters:
 * {string} `connectionFolder` the target connection's folder path
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object} list of saved snapshots
 */
let getSnapshots = (connectionFolder, callback) => {
  // Read the `snapshots` folder and get its content
  FS.readdir(Path.join(connectionFolder, 'snapshots'), (err, snapshots) => {
    // If any error has occurred then return an empty array
    if (err)
      try {
        return callback([])
      } catch (e) {}

    // Map the items (files and folders) array in the snapshots' folder
    snapshots = snapshots.map((snapshot) => {
      try {
        // Get the status of the current item - assuming it's a snapshot -
        let snapshotStatus = FS.statSync(Path.join(connectionFolder, 'snapshots', snapshot))

        // If the item is a file, and ends with `.json` then accept it, otherwise consider it as `null`
        return snapshotStatus.isFile() && snapshot.toLowerCase().endsWith('.json') ? {
          name: snapshot,
          time: snapshotStatus.birthtime.getTime(),
          size: snapshotStatus.size,
          path: Path.join(connectionFolder, 'snapshots', snapshot)
        } : null
      } catch (e) {
        try {
          errorLog(e, 'connections')
        } catch (e) {}
      }
    }).filter((snapshot) => {
      // Get rid of `null` items
      return snapshot != null
    }).sort((a, b) => {
      // Sort them descending based on creation time
      return b.time - a.time
    })

    // Return the final result
    try {
      callback(snapshots)
    } catch (e) {}
  })
}

/**
 * Get the newest saved snapshot of a connection
 *
 * @Parameters:
 * {string} `connectionFolder` the target connection's folder path
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object} the newest snapshot
 */
let getNewestSnapshot = (connectionFolder, callback) => {
  // Final result which be returned
  let result = {}

  // Call the function which gets all saved snapshots
  getSnapshots(connectionFolder, async (snapshots) => {
    try {
      // If there are no saved snapshots then skip this try-catch block
      if (snapshots.length <= 0)
        throw 0

      // Point at the latest/newest snapshot
      let newestSnapshot = snapshots[0]

      try {
        // Get the snapshot's content
        let snapshotContent = await FS.readFileSync(newestSnapshot.path, 'utf8')

        // Add it in the JSON object
        newestSnapshot.content = snapshotContent

        // Set final result
        result = newestSnapshot
      } catch (e) {
        try {
          errorLog(e, 'connections')
        } catch (e) {}
      }
    } catch (e) {} finally {
      // Return the final result
      try {
        callback(result)
      } catch (e) {}
    }
  })
}

/**
 * Check the connectivity with a given connection
 *
 * @Parameters:
 * {string} `connectionID` the ID of the target connection
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {string} the target connection's metadata in JSON string format
 */
let checkConnectivity = (connectionID, callback) => {
  /**
   * Get a random ID for that check request
   * It'll be sent to the main thread
   */
  let checkConnectivityRequestID = getRandom.id(10)

  // Send the request to the main thread
  IPCRenderer.send('pty:check-connection', {
    id: connectionID,
    checkConnectivityRequestID
  })

  // Listen to the response from the main thread
  IPCRenderer.on(`connection:check-connection:${checkConnectivityRequestID}:${connectionID}`, (_, connected) => {
    try {
      /**
       * If `null` has been received then we weren't able to get the result
       * Call the `callback` function and pass the final result
       */
      callback(connected)
    } catch (e) {
      // If any error has occurred then return the `null` value
      callback(null)
    }
  })
}

/**
 * Execute a given array of scripts
 *
 * @Parameters:
 * {integer} `scriptID` the index of the script to execute in the `scripts` array
 * {object} `scripts` an array of paths of scripts
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object}: {integer} `scriptID`, {object} `scripts`, {integer} `status`
 *
 * If `status` is not `0`, then the last executed script didn't return the success code `0`, otherwise, all scripts have been successfully executed
 */
let executeScript = (scriptID, scripts, callback) => {
  // Get a random ID for the execution request
  let requestID = getRandom.id(20)

  // Add log about executing the current script
  try {
    addLog(`Executing the script '${scripts[scriptID]}' within a connection process`, 'process')
  } catch (e) {}

  // Send the execution request
  IPCRenderer.send('script:run', {
    id: requestID,
    scriptPath: scripts[scriptID]
  })

  // Handle the response
  IPCRenderer.on(`script:result:${requestID}`, (_, status) => {
    // Preserve the original status' value before parsing
    let originalStatus = status

    /**
     * Get the execution's status
     * If it's not the success code `0`, then the last script hasn't executed properly
     */
    status = parseInt(status)

    // Add log for the execution's status
    try {
      addLog(`Execution status of the script '${scripts[scriptID]}' is '${isNaN(status) ? originalStatus : status}'`)
    } catch (e) {}

    try {
      // If the status/returned value is not `0` then it is considered an error
      if (status != 0)
        throw 0; // This semicolon is critical here

      // Otherwise, the status value is `0` and the current script has been successfully executed
      ++scriptID

      // If condition `true`, then all scripts have been executed without errors
      if (scriptID + 1 > scripts.length)
        throw 0

      // Call the execution function again in a recursive way
      executeScript(scriptID, scripts, callback)
    } catch (e) {
      try {
        errorLog(e, 'functions')
      } catch (e) {}

      /**
       * Call the callback function
       * Pass the last executed script ID, all scripts array, and the last execution status
       */
      return callback({
        scriptID: scriptID,
        scripts: scripts,
        status: isNaN(status) ? originalStatus : status
      })
    }
  })
}

/**
 * Get all pre and post-connection scripts of a given connection
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {string} `?connectionID` the target connection's ID, or null to check the editor's content
 *
 * @Return: {object} JSON object which has `pre` and `post` attributes, each attribute holds an array of scripts' paths
 */
let getPrePostScripts = async (workspaceID, connectionID = null) => {
  // Final result to be returned - scripts to be executed -
  let scripts = {
      pre: [], // Pre-connection scripts' paths
      post: [] // Post-connection scripts' paths
    },
    /**
     * Flag which tells if sensitive data has been found in the connection's `cqlsh.rc` content
     * This is an extra attribute
     */
    foundSensitiveData = false,
    // An object which holds the content of the connection's cqlsh.rc file
    cqlshContent = null

  // Define the text to be added to the log regards the workspace
  let workspace = `workspace #${workspaceID}`

  // Add log about this process
  try {
    addLog(`Get all pre and post-connection scripts of ${connectionID != null ? 'connection #' + connectionID + ' in ' : ' a connection about to be added/updated in '}${workspace}`, 'process')
  } catch (e) {}

  // Check pre and post-connection scripts
  try {
    // Set connection to be null by default
    let connection = null

    try {
      // If there's no connection ID has been passed then skip this try-catch block
      if (connectionID == null)
        throw 0

      // Get all saved connections
      let connections = await getConnections(workspaceID)

      // Get the target connection's object
      connection = connections.filter((connection) => connection.info.id == connectionID)[0]
    } catch (e) {
      try {
        errorLog(e, 'functions')
      } catch (e) {}
    }

    // Get the connection's `cqlsh.rc` file's content
    cqlshContent = connection != null ? await getCQLSHRCContent(workspaceID, connection.cqlshrc) : await getCQLSHRCContent(workspaceID, null, addEditConnectionEditor),
      // Define the file's sections
      sections = Object.keys(cqlshContent)

    // If there are no sections in the `cqlsh.rc` file then skip this try-catch block
    if (sections.length <= 0)
      throw 0

    // Loop through each section
    for (let section of sections) {
      // Define the current section's keys/options
      let keys = Object.keys(cqlshContent[section])

      // If no keys have been found in this section then skip it and move to the next one
      if (keys.length <= 0)
        continue

      // Loop through keys/options
      for (let key of keys) {
        // If the current key/option is considered sensitive - for instance; it is `username` -
        if (Modules.Consts.SensitiveData.includes(key))
          foundSensitiveData = true

        // Check if there are scripts
        let script = cqlshContent[section][key]

        // Check if there're pre or post connect scripts
        if (['preconnect', 'postconnect'].includes(section))
          scripts[section == 'preconnect' ? 'pre' : 'post'].push(script)
      }
    }
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Add log if scripts have been found
  if (scripts.length != 0)
    try {
      addLog(`Pre and post-connection scripts of ${connectionID != null ? 'connection #' + connectionID + ' in ' : ' a connection about to be added/updated in '}${workspace} are (${JSON.stringify(scripts)})`, 'process')
    } catch (e) {}

  // Return the final result
  return {
    ...scripts,
    foundSensitiveData,
    cqlshContent
  }
}

module.exports = {
  // Main connection's operations
  getConnections,
  saveConnection,
  updateConnection,
  deleteConnection,
  // Operations regard the `cqlsh.rc` content
  getCQLSHRCContent,
  setCQLSHRCContent,
  // Operation regards the variables
  updateFilesVariables,
  // Operation regards checking the connectivity with connection
  checkConnectivity,
  // Operations regard getting different data related to the connections
  getMetadata,
  getCQLDescription,
  getSSHTunnelingInfo,
  getQueryTracingResult,
  getSnapshots,
  getNewestSnapshot,
  executeScript,
  getPrePostScripts
}
