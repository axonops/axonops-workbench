{
  IPCRenderer.on('cli:list-workspaces', async () => {
    let workspaces = await Modules.Workspaces.getWorkspaces()

    IPCRenderer.send('cli:list-workspaces:result', workspaces)
  })
}

{
  IPCRenderer.on('cli:list-connections', async (_, workspaceID) => {
    let connections = await Modules.Connections.getConnections(workspaceID)

    IPCRenderer.send('cli:list-connections:result', connections)
  })
}

{
  IPCRenderer.on('cli:import-workspace', async (_, argumentInput) => {
    let isInputAPath = pathIsAccessible(`${argumentInput}`),
      contentJSON = null,
      sendResult = (result) => IPCRenderer.send('cli:import-workspace:result', result)

    // Check if the given input is a path first
    try {
      if (!isInputAPath)
        throw 0

      // It's a path, attempt to read it
      let fileContent = FS.readFileSync(`${argumentInput}`, 'utf8')

      // Attempt to repair it in case it's broken or invalid
      fileContent = repairJSON(fileContent)

      // Now attempt to parse it to JSON object
      contentJSON = JSON.parse(fileContent)
    } catch (e) {}

    // Check if the given input is a JSON string
    try {
      if (isInputAPath)
        throw 0

      /**
       * It's not a valid path, so it's considered to be a JSON string
       * Attempt to repair it in case it's broken or invalid
       */
      let inputContent = repairJSON(`${argumentInput}`)

      // Now attempt to parse it to JSON object
      contentJSON = JSON.parse(inputContent)
    } catch (e) {}

    // Saving process status: [-3: Invalid input, -2: Duplication in ID, -1: Duplication in name, 0: Not saved, 1: Saved]
    if (contentJSON == null)
      return sendResult({
        code: -3,
        text: 'Provided JSON string is not valid'
      })

    /**
     * Reaching here means we've got a valid JSON object
     * The only required attribute is the name, if it exists other attributes will be filled with generated values
     */
    try {
      let name = contentJSON.name

      if (name == undefined || minifyText(name).length <= 0)
        return sendResult({
          code: -3,
          text: 'Provided name is not valid'
        })
    } catch (e) {}

    // Check if an ID has been provided
    try {
      // let id = contentJSON.id
      //
      // if (id != undefined && `${id}`.length != 0) {
      //   contentJSON.id = minifyText(id)
      // } else {
      //   contentJSON.id = `workspace-${getRandomID(10)}`
      // }

      contentJSON.id = `workspace-${getRandomID(10)}`
    } catch (e) {}

    // Check if color has been provided
    try {
      let color = contentJSON.color,
        colorObject = TinyColor(color)

      if (colorObject.isValid()) {
        contentJSON.color = `#${colorObject.toHex()}`
      } else {
        contentJSON.color = getRandomColor()
      }
    } catch (e) {}

    // Check given path
    try {
      let isDefaultPath = contentJSON.defaultPath == true

      if (isDefaultPath)
        throw 0

      // Here user should provide an absolute `path` instead
      let path = contentJSON.path

      if (!((path == undefined || minifyText(path).length <= 0) && contentJSON.defaultPath != false) && !pathIsAccessible(`${path}`))
        return sendResult({
          code: -3,
          text: 'Provided path is invalid'
        })

      contentJSON.defaultPath = false

      if (path == undefined || minifyText(path).length <= 0)
        contentJSON.defaultPath = true
    } catch (e) {}

    // Now everything should be fine and ready to be passed to the save function
    let result = await Modules.Workspaces.saveWorkspace(contentJSON)

    // Send final result code
    sendResult({
      code: result,
      text: [`${contentJSON.name}`, `${contentJSON.id}`],
      isInputAPath
    })
  })
}

{
  IPCRenderer.on('cli:import-connection', async (_, jsonObject) => {
    getKey('public', async (key) => {
      let isInputAPath = pathIsAccessible(`${jsonObject.jsonStringPath}`),
        contentJSON = null,
        sendResult = (result) => IPCRenderer.send('cli:import-connection:result', result),
        finalJSON = {}

      // Check if the given input is a path first
      try {
        if (!isInputAPath)
          throw 0

        // It's a path, attempt to read it
        let fileContent = FS.readFileSync(`${jsonObject.jsonStringPath}`, 'utf8')

        // Attempt to repair it in case it's broken or invalid
        fileContent = repairJSON(fileContent)

        // Now attempt to parse it to JSON object
        contentJSON = JSON.parse(fileContent)
      } catch (e) {}

      // Saving process status: [-3: Invalid input, -2: Duplication in ID, -1: Duplication in name, 0: Not saved, 1: Saved]
      if (contentJSON == null)
        return sendResult({
          success: false,
          text: 'Either provided JSON string path is not valid or the string inside the file is invalid'
        })

      /**
       * Reaching here means we've got a valid JSON object
       *
       * Check if a secure connection bundle has been provided
       */
      let scbFilePath = ''
      try {
        let providedScbFilePath = contentJSON.scb_path

        if (providedScbFilePath == undefined)
          throw 0

        if (!pathIsAccessible(`${providedScbFilePath}`))
          return sendResult({
            success: false,
            text: 'The provided secure connection bundle zip file is either inaccessible or invalid'
          })

        scbFilePath = `${providedScbFilePath}`
      } catch (e) {}

      let isScbFile = scbFilePath.length > 0

      /**
       * Start with workspace ID
       */
      let workspaceID = ''
      try {
        let providedWorkspaceID = !isScbFile ? contentJSON.basic.workspace_id : contentJSON.workspace_id

        if (providedWorkspaceID == undefined || minifyText(providedWorkspaceID).length <= 0)
          throw 0

        // Check if the provided ID exists
        let workspaces = await Modules.Workspaces.getWorkspaces()

        if (workspaces.find((workspace) => manipulateText(providedWorkspaceID) == manipulateText(workspace.id)) == undefined)
          throw 0

        // Reaching here means the provided workspace ID is valid and exists
        workspaceID = providedWorkspaceID
      } catch (e) {}

      if (workspaceID == undefined || workspaceID.length <= 0)
        return sendResult({
          success: false,
          text: `Either ${isScbFile ? '' : 'basic.'}workspace_id attribute does not exist, or provided value does not belong to a workspace`
        })

      // Check connection's name
      try {
        let name = !isScbFile ? contentJSON.basic.name : contentJSON.name

        if (name == undefined || minifyText(name).length <= 0)
          return sendResult({
            success: false,
            text: `Either ${isScbFile ? '' : 'basic.'}name attribute does not exist, or provided name is not valid`
          })
      } catch (e) {}

      // Handle secure connection bundle type
      try {
        if (!isScbFile)
          throw 0

        finalJSON = {
          name: contentJSON.name,
          info: {
            secureConnectionBundlePath: scbFilePath,
            id: `connection-${getRandomID(10)}`,
            secrets: {}
          }
        }

        try {
          if (contentJSON.username == undefined)
            return sendResult({
              success: false,
              text: `The attribute username must be provided for AstraDB connections`
            })

          finalJSON.info.secrets.username = encrypt(key, contentJSON.username)
        } catch (e) {}

        try {
          if (contentJSON.password == undefined)
            return sendResult({
              success: false,
              text: `The attribute password must be provided for AstraDB connections`
            })

          finalJSON.info.secrets.password = encrypt(key, contentJSON.password)
        } catch (e) {}

        // Test connection if needed..
        try {
          if (!jsonObject.testConnection.passed)
            throw 0

          let stopOnFailure = jsonObject.testConnection.value,
            requestID = getRandomID(10),
            testConnectionProcessID = getRandomID(10)

          IPCRenderer.send('pty:test-connection', {
            requestID,
            processID: testConnectionProcessID,
            secrets: {
              username: finalJSON.info.secrets.username,
              password: finalJSON.info.secrets.password
            },
            workspaceID: workspaceID,
            scbFilePath: finalJSON.info.secureConnectionBundlePath
          })

          IPCRenderer.on(`pty:test-connection:${requestID}`, async (_, result) => {
            let notConnected = !result.connected || [undefined, null].includes(result.version) || result.terminated != undefined

            IPCRenderer.send('cli:import-connection:test-connection:result', {
              success: !notConnected,
              reason: `${result.error}`
            })

            if (notConnected && jsonObject.testConnection.value)
              return

            // Now everything should be fine and ready to be passed to the save function
            Modules.Connections.saveConnection(workspaceID, {
              ...finalJSON
            }).then((result) => {
              // Send final result code
              sendResult({
                success: result,
                text: [finalJSON.name, finalJSON.info.id]
              })
            })
          })

          return
        } catch (e) {}

        // Now everything should be fine and ready to be passed to the save function
        Modules.Connections.saveConnection(workspaceID, {
          ...finalJSON
        }).then((result) => {
          // Send final result code
          sendResult({
            success: result,
            text: [finalJSON.name, finalJSON.info.id]
          })
        })

        // Skip Apache Cassandra connection type
        return
      } catch (e) {}

      // Check connection's hostname
      try {
        let hostname = contentJSON.basic.hostname

        if (hostname == undefined || minifyText(hostname).length <= 0)
          return sendResult({
            success: false,
            text: 'Either basic.hostname attribute does not exist, or provided hostname is not valid'
          })
      } catch (e) {}

      /**
       * Reaching here, means we have:
       ** Workspace ID
       ** Connection name
       ** Connection hostname
       */
      let cqlshrcContent = Modules.Consts.CQLSHRC

      try {
        let cqlshrcPath = contentJSON.basic.cqlshrc

        if (!pathIsAccessible(`${cqlshrcPath}`)) {
          if (cqlshrcPath != undefined)
            return sendResult({
              success: false,
              text: 'The provided path to the cqlsh.rc file is either inaccessible or invalid'
            })

          throw 0
        }

        // It's a path, attempt to read it
        cqlshrcContent = FS.readFileSync(`${cqlshrcPath}`, 'utf8')
      } catch (e) {}

      /**
       * Refresh cqlsh values, and prepare for the given values
       */
      let cqlshrcDefaultValues = await Modules.Connections.getCQLSHRCContent(workspaceID, cqlshrcContent)

      if (Object.keys(cqlshrcDefaultValues).length <= 0 || cqlshrcDefaultValues.connection == undefined || cqlshrcDefaultValues.auth_provider == undefined) {
        return sendResult({
          success: false,
          text: 'Failed to read and parse cqlsh.rc content'
        })
      }

      /**
       * Reaching here means we've now a valid array to update for the cqlsh.rc content
       * Remove any senstive data and warn user about it
       */
      let senstiveData = []

      try {
        for (let section of Object.keys(cqlshrcDefaultValues)) {
          // Define the current section's keys/options
          let keys = Object.keys(cqlshrcDefaultValues[section])

          // If no keys have been found in this section then skip it and move to the next one
          if (keys.length <= 0)
            continue

          // Loop through keys/options
          for (let key of keys) {
            // If the current key/option is considered sensitive - for instance; it is `username` -
            if (Modules.Consts.SensitiveData.includes(key)) {
              senstiveData.push(key)
              delete cqlshrcDefaultValues[section][key]
            }
          }
        }
      } catch (e) {}

      if (senstiveData.length >= 1)
        IPCRenderer.send('cli:import-connection:found-sens-data', senstiveData)

      /**
       * Set connection's name
       */
      finalJSON.name = contentJSON.basic.name

      // Connection info
      finalJSON.info = {}

      // Connection ID
      try {
        contentJSON.basic.id = `connection-${getRandomID(10)}`
      } catch (e) {}

      finalJSON.info.id = contentJSON.basic.id

      // Data center
      try {
        let datacenter = contentJSON.basic.datacenter

        if (datacenter != undefined && `${datacenter}`.length != 0)
          finalJSON.info.datacenter = datacenter
      } catch (e) {}

      // Handle SSH values
      try {
        if (contentJSON.ssh == undefined)
          throw 0

        finalJSON.ssh = {}

        let sshValues = ['username', 'password', 'host', 'port', 'passphrase', 'privateKey'],
          sshValuesToBeUpdated = [
            ['dstAddr', 'destaddr'],
            ['dstPort', 'destport']
          ];

        for (let sshValue of sshValues.concat(sshValuesToBeUpdated)) {
          // Handle SSH values that should be updated
          try {
            if (typeof sshValue !== 'object')
              throw 0

            finalJSON.ssh[sshValue[0]] = contentJSON.ssh[sshValue[1]]

            continue
          } catch (e) {}

          // Handle other SSH values
          finalJSON.ssh[sshValue] = contentJSON.ssh[sshValue]

          if (['username', 'password'].includes(sshValue))
            finalJSON.ssh[sshValue] = encrypt(key, finalJSON.ssh[sshValue])
        }

        // Clean the SSH JSON object
        for (let sshObjValue of Object.keys(finalJSON.ssh)) {
          let value = finalJSON.ssh[sshObjValue]

          finalJSON.ssh[sshObjValue] = value == undefined ? '' : value
        }
      } catch (e) {}

      /**
       * Handle basic info
       *
       * Update hostname
       */
      try {
        cqlshrcDefaultValues.connection.hostname = `${contentJSON.basic.hostname}`
      } catch (e) {}

      // Update port in case it has been provided
      try {
        if (contentJSON.basic.port == undefined)
          throw 0

        let port = parseInt(contentJSON.basic.port)

        if (isNaN(port)) {
          return sendResult({
            success: false,
            text: 'Provided port (basic.port) is invalid'
          })
        }

        cqlshrcDefaultValues.connection.port = `${contentJSON.basic.port}`
      } catch (e) {}

      // Update timestamp generator in case it has been provided
      try {
        if (contentJSON.basic.timestamp_generator == undefined)
          throw 0

        let timestampGenerator = contentJSON.basic.timestamp_generator

        if (!['none', 'monotonictimestampgenerator'].includes(minifyText(timestampGenerator))) {
          return sendResult({
            success: false,
            text: 'Provided timestamp generator (basic.timestamp_generator) is invalid, possible values are None and MonotonicTimestampGenerator'
          })
        }

        cqlshrcDefaultValues.connection.timestamp_generator = minifyText(timestampGenerator) == 'none' ? 'None' : 'MonotonicTimestampGenerator'
      } catch (e) {}

      /*
       * Handle SSL values
       * Make sure the attribute has been provided
       */
      try {
        if (contentJSON.ssl == undefined)
          throw 0

        /**
         * Update SSL boolean value
         * connection.ssl = true / false
         */
        try {
          if (contentJSON.ssl.ssl == undefined)
            throw 0

          let isSSLEnabled = contentJSON.ssl.ssl

          if (!['true', 'false'].includes(isSSLEnabled)) {
            return sendResult({
              success: false,
              text: 'Provided SSL (ssl.ssl) boolean is invalid, possible values are true and false'
            })
          }

          cqlshrcDefaultValues.connection.ssl = `${isSSLEnabled}`
        } catch (e) {}

        /**
         * Other SSL values
         * [ssl]
         */
        try {
          for (let sslValue of Object.keys(contentJSON.ssl)) {
            if (contentJSON.ssl[sslValue] != undefined)
              cqlshrcDefaultValues.ssl[sslValue] = `${contentJSON.ssl[sslValue]}`
          }
        } catch (e) {}
      } catch (e) {}

      /**
       * Handle provided authentication
       * Handle `username`
       */
      try {
        if (contentJSON.auth == undefined)
          throw 0

        finalJSON.info.secrets = {}

        try {
          if (contentJSON.auth.username == undefined)
            throw 0

          finalJSON.info.secrets.username = encrypt(key, contentJSON.auth.username)
        } catch (e) {}

        try {
          if (contentJSON.auth.password == undefined)
            throw 0

          finalJSON.info.secrets.password = encrypt(key, contentJSON.auth.password)
        } catch (e) {}
      } catch (e) {}

      // Set the cqlsh.rc content based on the given values
      try {
        finalJSON.cqlshrc = Modules.Connections.setCQLSHRCContent(cqlshrcDefaultValues, cqlshrcContent)
      } catch (e) {
        return sendResult({
          success: false,
          text: 'Failed to read and parse cqlsh.rc content'
        })
      }

      // Handle if there's a need to test connection first
      try {
        if (!jsonObject.testConnection.passed)
          throw 0

        let sshTunnel = false,
          isSSHTunnelNeeded = false,
          // Get a random ID for this connection test process
          testConnectionProcessID = getRandomID(30),
          // Get a random ID for the SSH tunnel creation process
          sshTunnelCreationRequestID = getRandomID(30),
          requestID = getRandomID(10)

        // Check if there's a need to create an SSH tunnel
        try {
          // If both username and (password or private key) have been provided then an SSH tunnel should be created
          sshTunnel = finalJSON.ssh.username.trim().length != 0 && ([finalJSON.ssh.password, finalJSON.ssh.privateKey].some((secret) => secret.trim().length != 0))

          // Set the flag's value
          isSSHTunnelNeeded = sshTunnel
        } catch (e) {}

        /**
         * Inner function to do processes which are after the SSH tunneling creation process - whether the process has been executed or not -
         *
         * @Parameters:
         * {object} `?sshCreation` the SSH tunnel object associated with the connection
         */
        let afterSSHProcess = async (sshCreation = null) => {
          // Make sure to set tempConnectionID to `null` if there's no SSH tunnel to be created
          if (sshCreation == null)
            tempConnectionID = null

          // Inner function inside `afterSSHProcess` function; to start the connection test with connection
          let startTestConnection = async () => {
            /**
             * A custom port might be passed to the `cqlsh` tool in case there's an SSH tunnel creation process
             *
             * The variable which will have the `port` attribute as an override
             */
            let override = null

            // If an SSH tunnel creation object has been passed
            if (sshCreation != null) {
              // Override the port
              override = {
                port: sshCreation.port
              }
            }

            // Get variables manifest and values
            try {
              // Define JSON object which will hold the names of the temporary files
              let files = {}

              // Loop through the names of the content
              for (let name of ['manifest', 'values']) {
                // Get the content from the OS keychain
                let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

                // Create a name for the temporary file
                files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandomID(20)}.aocwtmp`))

                // Create the temporary file with related content
                await FS.writeFileSync(files[name], content || '')
              }

              // Update the creation data to adopt the variables' info
              override = {
                ...override,
                variables: {
                  ...files
                }
              }
            } catch (e) {}

            let testJSON = {
              requestID,
              processID: testConnectionProcessID,
              workspaceID,
              cqlshrcPath: tempConfigFile
            }

            if (finalJSON.info.secrets != undefined) {
              testJSON.secrets = {
                ...finalJSON.info.secrets
              }
            }

            testJSON = {
              ...testJSON,
              ...override
            }

            IPCRenderer.send('pty:test-connection', testJSON)

            // In both cases listen to the response about the connection test
            IPCRenderer.on(`pty:test-connection:${requestID}`, async (_, result) => {
              setTimeout(async () => {
                // Delete the temp file which contains the `cqlsh.rc` config file's content
                try {
                  await FS.unlinkSync(tempConfigFile)
                } catch (e) {
                  try {
                    errorLog(e, 'connections')
                  } catch (e) {}
                }

                // Hold the tested connection's object
                testedConnectionObject = result

                try {
                  // Determine if the connection test has succeeded or not, or terminated
                  let notConnected = !result.connected || [undefined, null].includes(result.version) || result.terminated != undefined

                  IPCRenderer.send('cli:import-connection:test-connection:result', {
                    success: !notConnected,
                    reason: `${result.error}`
                  })

                  // Failed to connect with the connection - process hasn't been terminated -
                  if (notConnected && result.terminated == undefined) {
                    if (jsonObject.testConnection.value)
                      return

                    // Skip the upcoming code
                    throw 0
                  }

                  // If the process has been terminated then skip this try-catch block
                  if (result.terminated != undefined)
                    throw 0

                  /**
                   * Successfully connected with the connection
                   */
                  Modules.Connections.saveConnection(workspaceID, {
                    ...finalJSON
                  }).then((result) => {
                    // Send final result code
                    sendResult({
                      success: result,
                      text: [finalJSON.name, finalJSON.info.id]
                    })
                  })
                } catch (e) {}
              })
            })
          }

          let cqlshrc = {
              value: finalJSON.cqlshrc,
              name: `${getRandomID(10)}.cwb` // [C]assandra [W]ork[B]ench
            },
            /**
             * Get the OS temp folder path
             * `OS` module will handle this for all operating systems
             */
            tempConfigFile = Path.join(OS.tmpdir(), cqlshrc.name),
            // Create the temp `*.cwb` file with the `cqlsh.rc` content from the editor
            saveTemp = await FS.writeFileSync(tempConfigFile, cqlshrc.value)

          try {
            // If the app has successfully created the temp file then skip this try-catch block
            if (saveTemp == undefined)
              throw 0

            return sendResult({
              success: false,
              text: 'Failed to complete the test process, please check the privileges of the app to read/write'
            })
          } catch (e) {}

          // Call the function which will start the connection test
          startTestConnection()
        }
        // End of the function `afterSSHProcess`

        let checkAndCreateSSHTunnel = () => {
          /**
           * There's a need to create an SSH tunnel before testing the connection with the connection
           *
           * Check if an SSH client is installed and accessible
           */
          checkSSH((exists) => {
            // If the SSH client doesn't exist then end the process and show feedback to the user
            if (!exists)
              return sendResult({
                success: false,
                text: 'SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine'
              })

            // Create an SSH tunnel
            createSSHTunnel({
              ...finalJSON.ssh,
              requestID: sshTunnelCreationRequestID
            }, (creationResult) => {
              // If no error has occurred then perform the after SSH tunnel creation processes, and skip the upcoming code
              if (creationResult.error == undefined) {
                let host = ssh.dstAddr != '127.0.0.1' ? ssh.dstAddr : ssh.host,
                  port = ssh.dstPort

                // Hold the created SSH tunnel's info
                testedSSHTunnelObject = {
                  port: creationResult.port, // The port to be shown to the user
                  oport: port, // The original port to be used within the creation process
                  ...creationResult,
                  host
                }

                // Call the next function in the process and skip the upcoming code
                return afterSSHProcess(creationResult)
              }
            })
          })
        }

        // Call the `afterSSHProcess` function if there's no need to create an SSH tunnel
        if (!sshTunnel)
          return afterSSHProcess(null)

        // Call the `checkAndCreateSSHTunnel` function as there's a need to create an SSH tunnel
        checkAndCreateSSHTunnel()

        return
      } catch (e) {}

      // Now everything should be fine and ready to be passed to the save function
      Modules.Connections.saveConnection(workspaceID, {
        ...finalJSON
      }).then((result) => {
        // Send final result code
        sendResult({
          success: result,
          text: [finalJSON.name, finalJSON.info.id]
        })
      })
    })
  })
}

{
  IPCRenderer.on('cli:connect', async (_, connectionID) => {
    let sendResult = (result) => IPCRenderer.send('cli:connect:result', result)

    // Check the given connection ID
    if (`${connectionID}`.length <= 0) {
      return sendResult({
        success: false,
        text: 'Provided connection ID is invalid'
      })
    }

    // Get all workspaces
    let workspacesIDs = Modules.Workspaces.getWorkspacesNoAsync().map((workspace) => workspace.id)

    let connectionObject

    for await (let workspaceID of workspacesIDs) {
      let connections = await Modules.Connections.getConnections(workspaceID)

      connectionObject = connections.find((connection) => connection.info.id == `${connectionID}`)

      if (connectionObject != undefined) {
        connectionObject.workspaceID = workspaceID
        break
      }
    }

    if (connectionObject == undefined) {
      return sendResult({
        success: false,
        text: 'Provided ID does not belong to any saved connection'
      })
    }

    /**
     * Reaching here means we have a connection object
     * Send the object to the argv module in the main thread
     */
    sendResult({
      success: true,
      connectionObject
    })
  })

  IPCRenderer.on('cli:connect:ssh:handle', async (_, connectionObject) => {
    /**
     * There's a need to create an SSH tunnel before connecting with the node
     *
     * Check if an SSH client is installed and accessible
     */
    checkSSH((exists) => {
      // If the SSH client doesn't exist then end the process and show feedback to the user
      if (!exists) {
        IPCRenderer.send('cli:connect:ssh:handle', {
          error: 'SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine'
        })

        exitApp()

        return
      }

      // Get SSH username and password
      let ssh = {
        ...connectionObject.ssh
      }

      getKey('private', (key) => {
        try {
          ssh.username = decrypt(key, connectionObject.info.secrets.sshUsername)
        } catch (e) {}

        try {
          ssh.password = decrypt(key, connectionObject.info.secrets.sshPassword)
        } catch (e) {}

        let requestID = getRandomID(10)

        createSSHTunnel({
          ...ssh,
          requestID,
        }, (creationResult) => IPCRenderer.send('cli:connect:ssh:handle', creationResult))
      })
    })
  })

  IPCRenderer.on('cli:connect:variables:get', async () => {
    let files = []

    for (let name of ['manifest', 'values']) {
      // Get the content from the OS keychain
      let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

      // Create a name for the temporary file
      files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandomID(20)}.aocwtmp`))

      // Create the temporary file with related content
      await FS.writeFileSync(files[name], content || '')
    }

    IPCRenderer.send('cli:connect:variables:get:result', files)
  })
}
