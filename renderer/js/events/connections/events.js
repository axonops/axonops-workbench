/**
 * Get and refresh all connections events
 *
 * `getConnections` will remove all connections in the UI and fetch them all over again from the workspace folder
 * `refreshConnections` will keep the current connections in the UI, and just add connections that are not in the UI already
 */
$(document).on('getConnections refreshConnections', function(e, passedData) {
  // Save the given workspace ID
  const workspaceID = passedData.workspaceID,
    // To determine if the event is `getConnections` or `refreshConnections`
    event = e.type,
    // Point at the element of the associated workspace element in the UI
    workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`),
    // Point at the parent of all connections container
    parentConnectionContainer = $(`div.body div.right div.content div[content="connections"]`),
    // Point at the connection's container
    connectionsContainer = parentConnectionContainer.children(`div.connections-container`).children(`div.connections[workspace-id="${workspaceID}"]`)

  // Get the app's config
  Modules.Config.getConfig((config) => {
    // Determine if the associated workspace is the docker/sandbox projects
    let isSandbox = workspaceID == 'workspace-sandbox',
      isAxonOpsIntegrationEnabled = isInitAxonOpsIntegrationEnabled && !(Store.get(`${workspaceID}:AxonOpsIntegrationEnabled`) != undefined && !Store.get(`${workspaceID}:AxonOpsIntegrationEnabled`)),
      // Set the suitable function to get connections/projects based on the type of the workspace
      moduleGetFunction = !isSandbox ? Modules.Connections.getConnections : Modules.Docker.getProjects

    let connectionsCounter = 0,
      connectionsIndex = 0

    // Get all connections/projects saved in the workspace
    moduleGetFunction(workspaceID).then((connections) => {
      // Clean the container if the event is `get` connections
      if (event == 'getConnections')
        connectionsContainer.html('')

      // Add or remove the `empty` class based on the number of saved connections
      let areNoConnections = connections.length <= 0

      connectionsCounter = connections.length

      // Toggle the `empty` class
      setTimeout(() => parentConnectionContainer.toggleClass('empty', areNoConnections), areNoConnections ? 200 : 10)

      handleContentInfo('connections', workspaceElement)

      // Point at the cog actions button in the UI
      let connectionActions = parentConnectionContainer.find('div.section-actions')

      // If sub-buttons of the cog actions are shown then hide them
      if (connectionActions.hasClass('show'))
        connectionActions.children('div.main').children('button').click()

      // Loop through all fetched connections
      connections.forEach((connection, currentIndex) => {
        try {
          connectionsIndex = currentIndex

          // If the current workspace is not the docker/sandbox then skip this try-catch block
          if (!isSandbox)
            throw 0

          /**
           * Set different attributes for the current connection's object
           * By doing this, resusing and adopting the the same code of connections for the sandbox projects is possible without the need to do heavy edits and changes
           */
          connection.info = {}
          connection.info.id = connection.folder
          connection.info.secrets = undefined
          connection.name = connection.name || connection.folder
          connection.host = `127.0.0.1:${connection.ports.cassandra}`
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        // Define the connection's ID
        let connectionID = connection.info.id,
          // Get random IDs for the different elements of the connection's UI element
          [
            testConnectionBtnID,
            connectBtnID,
            connectAltBtnID,
            terminateProcessBtnID,
            startProjectBtnID,
            folderBtnID,
            settingsBtnID,
            deleteBtnID,
            axonOpsIntegrationBtnID
          ] = getRandom.id(15, 9),
          /**
           * Define the variable which holds the ID for the connection test process of the connection
           * The value will be updated with every test connection process
           */
          testConnectionProcessID,
          /**
           * Define the variable which holds the latest generated ID for the SSH tunnel creation process
           * The value will be updated with every test connection process
           */
          sshTunnelCreationRequestID,
          // For Docker/Sandbox projects set the process ID of checking Cassandra
          checkCassandraProcessID,
          /**
           * The AxonOps section ID
           * It's defined here as it's being used in different parts of the event
           */
          [axonopsIntegrationContentID, localClustersAxonopsContentID] = getRandom.id(15, 2),
          // Flag to tell if this connection is going to be added/appended to the UI as a new element or if it already exists, by default it's `true`
          isAppendAllowed = true,
          // Flag to tell if an SSH tunnel is needed before connecting with Cassandra connection/node
          isSSHTunnelNeeded = false,
          isAxonOpsIntegrationDisabled = Store.get(`${connectionID}:AxonOpsIntegrationEnabled`) != undefined && !Store.get(`${connectionID}:AxonOpsIntegrationEnabled`)

        /**
         * Look for the connection in the UI
         * If it exists then no need to append it
         */
        if (event == 'refreshConnections')
          isAppendAllowed = $(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`).length != 0 ? false : isAppendAllowed

        // This variable will hold the username and password of DB and SSH in UI attributes if needed
        let secrets = ''

        try {
          // If the current connection doesn't have secrets - `username` and `password` for Apache Cassandra, and SSH `username` and `password` - then skip this try-catch block
          if (connection.info.secrets == undefined)
            throw 0

          // Shorten the secrets reference
          let secretsInfo = connection.info.secrets

          // Check the DB authentication's username
          secrets += secretsInfo.username != undefined ? `data-username="${secretsInfo.username}" ` : ''

          // Check the DB authentication's password
          secrets += secretsInfo.password != undefined ? `data-password="${secretsInfo.password}" ` : ''

          // Check the SSH username
          secrets += secretsInfo.sshUsername != undefined ? `data-ssh-username="${secretsInfo.sshUsername}" ` : ''

          // Check the SSH password
          secrets += secretsInfo.sshPassword != undefined ? `data-ssh-password="${secretsInfo.sshPassword}" ` : ''

          // Check the SSH passphrase
          secrets += secretsInfo.sshPassphrase != undefined ? `data-ssh-passphrase="${secretsInfo.sshPassphrase}" ` : ''
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        // This variable will hold the requirement of DB auth and SSH credentials in UI attributes if needed
        let credentials = ''

        try {
          // If the current connection doesn't have any credentials to be given then skip this try-catch block
          if (connection.info.credentials == undefined)
            throw 0

          // Check the DB authentication credentials
          credentials += connection.info.credentials.auth != undefined ? ` data-credentials-auth="true"` : ''

          // Check the SSH credentials
          credentials += connection.info.credentials.ssh != undefined ? ` data-credentials-ssh="true"` : ''
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        let isSCBConnection = connection.info.secureConnectionBundlePath != undefined

        let axonOpsIntegration = ''

        try {
          let relatedData = connection.info.axonOpsIntegration

          if (relatedData == undefined || [relatedData.organization, relatedData.clusterName, relatedData.url].some((data) => data == undefined || minifyText(data).length <= 0))
            throw 0

          axonOpsIntegration = `data-axonops-integration-organization="${relatedData.organization}" data-axonops-integration-clusterName="${relatedData.clusterName}" data-axonops-integration-url="${relatedData.url}"`
        } catch (e) {}

        /**
         * Define the footer of the connection's UI based on the workspace's type
         * It can be a connection or a docker/sandbox project
         */
        let footerStructure = {
          nonSandbox: `
               <div class="footer">
                 <div class="button">
                   <button type="button" class="btn btn-secondary btn-sm test-connection" reference-id="${connectionID}" button-id="${testConnectionBtnID}">
                     <span mulang="test connection"></span>
                   </button>
                   <button type="button" class="btn btn-primary btn-sm connect changed-bg changed-color" reference-id="${connectionID}" button-id="${connectBtnID}" disabled hidden>
                     <span mulang="connect"></span>
                   </button>
                   <button type="button" class="btn btn-primary btn-sm changed-bg changed-color" reference-id="${connectionID}" button-id="${connectAltBtnID}">
                     <span mulang="connect"></span>
                   </button>
                 </div>
                 <div class="actions actions-bg ${!isAxonOpsIntegrationEnabled || axonOpsIntegration.length <= 0 ? '' : 'axonops-integration'}">
                   <div class="action btn btn-tertiary ${!isAxonOpsIntegrationDisabled ? 'enabled' : ''}" data-mdb-ripple-color="#fff" style="overflow: visible !important;" reference-id="${connectionID}" button-id="${axonOpsIntegrationBtnID}" action="axonops-integration" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="toggle the AxonOps integration feature for this connection" capitalize-first ${!isAxonOpsIntegrationEnabled || axonOpsIntegration.length <= 0 ? 'hidden' : ''}>
                   <div class="background actions-bg"></div>
                     <ion-icon name="axonops"></ion-icon>
                     <ion-icon name="${isAxonOpsIntegrationDisabled ? 'close' : 'check'}" class="status"></ion-icon>
                   </div>
                   <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${connectionID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="open the connection folder" capitalize-first>
                     <ion-icon name="folder-open"></ion-icon>
                   </div>
                   <div class="action btn btn-tertiary" reference-id="${connectionID}" button-id="${settingsBtnID}" data-mdb-ripple-color="dark" action="settings" data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="connection settings" capitalize-first data-title>
                     <ion-icon name="cog"></ion-icon>
                   </div>
                   <div class="action btn btn-tertiary" reference-id="${connectionID}" button-id="${deleteBtnID}" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="delete connection" capitalize-first>
                     <ion-icon name="trash"></ion-icon>
                   </div>
                 </div>
               </div>`,
          sandbox: `
               <div class="footer">
                 <div class="button">
                   <button type="button" class="btn btn-primary btn-sm changed-bg changed-color" reference-id="${connectionID}" button-id="${startProjectBtnID}">
                     <span mulang="start"></span>
                   </button>
                   <button type="button" class="btn btn-primary btn-sm connect changed-bg changed-color" reference-id="${connectionID}" button-id="${connectBtnID}" hidden></button>
                 </div>
                 <div class="actions">
                   <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${connectionID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="open the local cluster folder" capitalize-first>
                     <ion-icon name="folder-open"></ion-icon>
                   </div>
                   <div class="action btn btn-tertiary" reference-id="${connectionID}" button-id="${deleteBtnID}" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="delete local cluster" capitalize-first>
                     <ion-icon name="trash"></ion-icon>
                   </div>
                 </div>
               </div>`
        }

        /**
         * For docker/sandbox projects, an additional info is added `number of nodes`
         * By default, it's empty
         */
        let numOfNodesInfo = '',
          isAxonOpsInstalled = '',
          managementTool = ''

        try {
          // If the current connection is not a docker/sandbox project then skip this try-catch block
          if (!isSandbox)
            throw 0

          // The number of chosen nodes' info UI structure
          numOfNodesInfo = `
               <div class="info" info="nodes">
                 <div class="title"><span mulang="nodes" capitalize></span>
                   <ion-icon name="right-arrow-filled"></ion-icon>
                 </div>
                 <div class="text">${connection.nodes}</div>
                 <div class="_placeholder" hidden></div>
               </div>`

          isAxonOpsInstalled = `
               <div class="info" info="axonops">
                 <div class="title">AxonOps</span>
                   <ion-icon name="right-arrow-filled"></ion-icon>
                 </div>
                 <div class="text"><ion-icon class="axonops-status ${connection.axonops}" name="${connection.axonops == true ? 'check' : 'close'}"></ion-icon></div>
                 <div class="_placeholder" hidden></div>
               </div>`

          let containersManagementTool = passedData.containersManagementTool || 'none'

          containersManagementTool = ['docker', 'podman'].some((tool) => containersManagementTool == tool) ? `${containersManagementTool}-plain` : 'unknown'

          managementTool = `
               <div class="info" info="management-tool">
                 <div class="title">Tool</span>
                   <ion-icon name="right-arrow-filled"></ion-icon>
                 </div>
                 <div class="text"><ion-icon class="management-tool" name="${containersManagementTool}"></ion-icon></div>
                 <div class="_placeholder" hidden></div>
               </div>`
        } catch (e) {}

        let scbFilePath = ''

        try {
          if (isSCBConnection)
            scbFilePath = `data-scb-path="${connection.info.secureConnectionBundlePath}"`
        } catch (e) {}

        let inAccessible = false

        try {
          inAccessible = !pathIsAccessible(Path.join(getWorkspaceFolderPath(workspaceID), getAttributes($(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`), 'data-folder')))
        } catch (e) {}

        // Connection UI element structure
        let element = `
                 <div class="connection ${inAccessible ? 'inaccessible' : ''}" data-name="${connection.name}" data-folder="${connection.folder}" data-id="${connectionID}" data-workspace-id="${workspaceID}" data-host="${connection.host}" data-datacenter="${connection.info.datacenter}" data-connected="false" data-is-sandbox="${isSandbox}" data-axonops-installed="${connection.axonops || 'unknown'}" data-workarea="false" ${secrets} ${credentials} ${scbFilePath} ${axonOpsIntegration} ${axonOpsIntegration.length != 0 ? 'axonops-integration="true"' : ''}>
                   <div class="header">
                     <div class="title connection-name">${connection.name}</div>
                     <div class="connection-info" ${isSCBConnection ? 'style="flex-direction: column; flex-wrap: nowrap; justify-content: flex-start; align-items: flex-start;"' : ''}>
                       <div class="info" info="host" ${isSCBConnection ? 'hidden' : ''}>
                         <div class="title"><span mulang="host" capitalize></span>
                           <ion-icon name="right-arrow-filled"></ion-icon>
                         </div>
                         <div class="text">${connection.host}</div>
                         <div class="_placeholder" hidden></div>
                       </div>
                       <div class="info" info="cassandra" ${isSandbox ? 'style="min-width: fit-content;"' : ''}>
                         <div class="title">cassandra
                           <ion-icon name="right-arrow-filled"></ion-icon>
                         </div>
                         <div class="text">${isSandbox ? 'v' + connection.cassandraVersion : ''}</div>
                         <div class="_placeholder" ${isSandbox ? 'hidden' : '' }></div>
                       </div>
                       <div class="info" info="data-center" ${isSandbox ? 'hidden' : ''}>
                         <div class="title"><span mulang="data center" capitalize></span>
                           <ion-icon name="right-arrow-filled"></ion-icon>
                         </div>
                         <div class="text"></div>
                         <div class="_placeholder"></div>
                       </div>
                       ${numOfNodesInfo}
                       ${isAxonOpsInstalled}
                       ${managementTool}
                     </div>
                   </div>
                   <div class="path-inaccessible" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="the main folder for this $data has become inaccessible. Click the icon to copy its path" lang-data-1="${isSandbox ? 'local cluster' : 'connection'}" capitalize-first>
                     <ion-icon name="danger"></ion-icon>
                   </div>
                   ${!isSandbox ? footerStructure.nonSandbox : footerStructure.sandbox}
                   <div class="status">
                     <l-ripples style="--uib-size: 20px; --uib-color: #ff8000; --uib-speed: 7s;"><div class="dot"></div></l-ripples>
                   </div>
                   <div class="test-connection">
                     <div class="sub-content">
                       <l-pinwheel class="ldr change-color" style="--uib-size: 36px; --uib-stroke: 4px; --uib-speed: 0.45s; --uib-color: ${getAttributes(workspaceElement, 'data-color')};">
                        <div class="line"></div>
                        <div class="line"></div>
                        <div class="line"></div>
                        <div class="line"></div>
                        <div class="line"></div>
                        <div class="line"></div>
                       </l-pinwheel>
                     </div>
                     <div class="terminate-process">
                       <div class="btn btn-tertiary stop-btn" data-mdb-ripple-color="var(--mdb-danger)" reference-id="${connectionID}" button-id="${terminateProcessBtnID}" data-tippy="tooltip" data-mdb-placement="right" data-title data-mulang="terminate the process" capitalize-first>
                         <ion-icon name="close"></ion-icon>
                       </div>
                     </div>
                   </div>
                 </div>`


        try {
          setTimeout(() => {
            $(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`).toggleClass('inaccessible', inAccessible)

            try {
              if ($(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`).hasClass('is-being-watched'))
                throw 0

              $(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`).addClass('is-being-watched')

              Modules.Connections.watchConnectionPath(connectionID, Path.join(getWorkspaceFolderPath(workspaceID), getAttributes($(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`), 'data-folder')), () => {
                $(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`).removeClass('is-being-watched')

                $(`div.connection[data-id="${connectionID}"][data-workspace-id="${workspaceID}"]`).addClass('inaccessible')
              })
            } catch (e) {}
          })

          // If the current connection won't be appended then skip this try-catch block
          if (!isAppendAllowed)
            throw 0

          // Append the connection to the associated container
          connectionsContainer.append($(element).show(function() {
            // Apply different actions once the UI element is created
            {
              // Fade in the element based on the index
              setTimeout(() => $(this).addClass(`show-${(currentIndex + 1) > 300 ? 300 : (currentIndex + 1)}`))

              // Enable tooltip for the actions buttons
              setTimeout(() => ([settingsBtnID, deleteBtnID, folderBtnID]).forEach((btn) => getElementMDBObject($(`div[button-id="${btn}"]`), 'Tooltip')))

              // Apply the chosen language on the UI element after being fully loaded
              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
            }

            // Point at the connection's UI element
            let connectionElement = $(this)

            // Handle the `click` event for actions buttons
            setTimeout(() => {
              // Clicks the `TEST CONNECTION` button
              $(`button[button-id="${testConnectionBtnID}"]`).click(function(_, clickConnectBtn = false) {
                // Determine if the app is already connected with that connection, and if it has an active work area
                let [connected, hasWorkarea] = getAttributes(connectionElement, ['data-connected', 'data-workarea']),
                  // Whether or not the current process to be executed is disconnecting with the connection
                  isProcessDisconnect = $(this).find('span[mulang]').attr('mulang') == 'disconnect'

                // Get a random ID for this connection test process
                testConnectionProcessID = getRandom.id(30)

                // Get a random ID for the SSH tunnel creation process
                sshTunnelCreationRequestID = getRandom.id(30)

                // Set the flag's value
                isSSHTunnelNeeded = connectionElement.getAllAttributes('data-ssh')

                // Add log for this request
                try {
                  addLog(`Request to test the connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                } catch (e) {}

                // If the connection has an active work area and the process to be executed is not disconnecting with the connection then stop the process and show feedback to the user
                if (hasWorkarea == 'true' && !isProcessDisconnect)
                  return showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to test it', [getAttributes(connectionElement, 'data-name')])) + '.', 'warning')

                // Handle if the process is disconnecting with the connection
                if (isProcessDisconnect)
                  return $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${connectionID}"]`).find('div.connection-actions div.action[action="close"]').find('div.btn').trigger('click', false)

                // Check if the connection needs credentials to be provided before test the connection with it
                try {
                  // Get attributes related to credentials requirements
                  let [credentialsAuth, credentialsSSH] = getAttributes(connectionElement, ['data-credentials-auth', 'data-credentials-ssh']),
                    // Point at the credentials dialog
                    connectionCredentialsDialog = $('div.modal#connectionCredentials')

                  // If both attributes are not defined or the user already has provided required credentials then skip this try-catch block
                  if (([credentialsAuth, credentialsSSH]).every((credential) => credential == undefined) || getAttributes(connectionElement, 'data-got-credentials') == 'true') {
                    connectionElement.removeAttr('data-got-credentials')
                    throw 0
                  }

                  // By default, the credentials requirements process hasn't been passed yet
                  let pass = false,
                    // Get all attributes that hold the values of different secrets/credentials
                    allSecrets = getAttributes(connectionElement, ['data-username', 'data-password', 'data-ssh-username', 'data-ssh-password', 'data-ssh-passphrase'])

                  /**
                   * Multiple conditions to check
                   * DB authentication credentials are needed - and SSH credentials not -, and they've been provided
                   * SSH credentials are needed - and DB authentication credentials not -, and they've been provided
                   * Both types of credentials are needed and all of them have been provided
                   */
                  if (
                    (credentialsAuth != undefined && credentialsSSH == undefined && allSecrets[0] != undefined && allSecrets[1] != undefined) ||
                    (credentialsAuth == undefined && credentialsSSH != undefined && (allSecrets[2] != undefined || allSecrets[3] != undefined)) ||
                    (credentialsAuth != undefined && credentialsSSH != undefined && allSecrets.every((secret) => secret != undefined))
                  )
                    pass = true

                  // If there's a need to pass the credentials then skip the upcoming code
                  if (pass)
                    throw 0

                  // Determine if both credentials - DB and SSH - are needed
                  let bothcredentials = ([credentialsAuth, credentialsSSH]).every((credential) => credential != undefined)

                  try {
                    // If both credentials are needed then skip this `try` and jump to `catch` block
                    if (bothcredentials)
                      throw 0

                    // Add `one-only` class and either one of the two classes `ssh` and `auth`
                    connectionCredentialsDialog.addClass(`one-only ${credentialsAuth == undefined ? 'ssh' : 'auth'}`)
                  } catch (e) {
                    // Both credentials are needed so remove all class related to the need of one of them only
                    connectionCredentialsDialog.removeClass(`one-only ssh auth`)
                  }

                  // Update the credentials title by adding the connection's name
                  connectionCredentialsDialog.find('h5.modal-title connection-name').text(getAttributes(connectionElement, 'data-name'))

                  // Update the credentials title by adding the type of credentials if only one of them needed
                  connectionCredentialsDialog.find('h5.modal-title credentials-info').text(!bothcredentials ? (credentialsAuth != undefined ? 'DB ' + I18next.capitalize(I18next.t('authentication')) : 'SSH') : '')

                  // Update the credentials' dialog attributes by adding one which holds the connection's ID
                  connectionCredentialsDialog.attr('data-connection-id', connectionID)

                  // Show the credentials' dialog
                  $('button#showConnectionCredentialsDialog').click()

                  // Skip the upcoming code
                  return
                } catch (e) {}

                // Disable the `CONNECT` button
                $(`button[button-id="${connectBtnID}"]`).attr('disabled', '')

                try {
                  // If the app is not already connected with the connection then skip this try-catch block
                  if (connected != 'true')
                    throw 0

                  // Hide the Cassandra's version and the data center's name
                  connectionElement.find('div[info="cassandra"], div[info="data-center"]').each(function() {
                    $(this).children('div.text').text('')
                    $(this).children('div._placeholder').fadeIn('fast').removeAttr('hidden')
                  })

                  // Remove the connection status
                  connectionElement.attr('data-connected', 'false')

                  // Attempt to close SSH tunnel if it exists
                  try {
                    IPCRenderer.send('ssh-tunnel:close', connectionID)
                  } catch (e) {}
                } catch (e) {}

                // Reset the status of the connection with the connection
                connectionElement.children('div.status')
                  .removeClass('success failure')
                  .addClass('show')

                // The app is now testing the connection with the connection
                connectionElement.addClass('test-connection')

                // Enable the process termination button
                $(`div.btn[button-id="${terminateProcessBtnID}"]`).removeClass('disabled')

                // Show the termination process' button
                IPCRenderer.removeAllListeners(`process:can-be-terminated:${testConnectionProcessID}`)
                IPCRenderer.on(`process:can-be-terminated:${testConnectionProcessID}`, () => setTimeout(() => connectionElement.addClass('enable-terminate-process')))

                // Disable the button
                $(this).attr('disabled', 'disabled')

                // Test the connection with the connection; by calling the inner test connection function at the very end of this code block
                testConnection(connectionElement, testConnectionProcessID, sshTunnelCreationRequestID, clickConnectBtn)
              })

              /**
               * Clicks the `CONNECT` button
               *
               * This block of code has a lot of things; many inner functions, a bunch of events listeners, and elements creation
               * This event - click - listener takes one parameter:
               * `restart`; it tells if this is a work area `refresh` or a `fresh creation` process
               *
               */
              $(`button[button-id="${connectBtnID}"]`).on('click', function(_, restart = false) {
                // Get the app's config
                Modules.Config.getConfig((config) => {
                  // Get the maximum allowed number of running connections at a time
                  let maximumRunningConnections = parseInt(config.get('limit', 'cqlsh')),
                    // Get the number of currently running connections
                    numRunningConnections = $(`div[content="workarea"] div.workarea[connection-id*="connection-"], div[content="workarea"] div.workarea[connection-id*="cluster-"]`).length,
                    // Get the number of currently attempt to activate connections
                    numAttemptingConnections = $(`div[content="connections"] div.connections-container div.connection[data-id*="connection-"].test-connection`).length,
                    isBasicCQLSHEnabled = config.get('features', 'basicCQLSH') == 'true'

                  // Make sure the maximum number is valid, or adopt the default value `10`
                  maximumRunningConnections = isNaN(maximumRunningConnections) || maximumRunningConnections < 1 ? 10 : maximumRunningConnections

                  // Add log for this request
                  try {
                    addLog(`Request to connect '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                  } catch (e) {}

                  // If the currently running connections are more than or equal to the maximum allowed number and this is not the sandbox workspace then end the process and show feedback to the user
                  if (([numRunningConnections, numAttemptingConnections]).some((num) => num >= maximumRunningConnections) && !isSandbox)
                    return showToast(I18next.capitalize(I18next.t('activate connection')), I18next.capitalizeFirstLetter(I18next.replaceData('the maximum number of connectinos which allowed to be active simultaneously is [b]$data[/b]', [maximumRunningConnections])) + `.<br><br>` + I18next.capitalizeFirstLetter(I18next.t('this limit can be changed from the app\'s settings in the limits section')) + `.`, 'failure')

                  // Point at the work areas content's container
                  let content = $('div.body div.right div.content div[content="workarea"]'),
                    // If this variable is `true` then show the connection's work area and skip the creation of a new one
                    skipCreationWorkarea = false

                  // Hide all work areas
                  content.children('div.workarea').hide()

                  // Point at the connection's work area
                  let contentConnection = content.children(`div.workarea[connection-id="${connectionID}"]`)

                  $('div.body div.right').addClass('hide-content-info')

                  connectionElement.children('div.status').removeClass('failure').addClass('success')

                  try {
                    // If the work area does not exist then skip this try-catch block
                    if (contentConnection.length <= 0)
                      throw 0

                    // Skip the creation part and show the work area
                    skipCreationWorkarea = true

                    // Show the work area
                    contentConnection.show()

                    // Deactivate all switchers and activate the current connection's switcher
                    setTimeout(() => $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active').filter(`[_connection-id="${connectionID}"]`).attr('active', ''), 50)

                    try {
                      // Point at the target connection's switcher
                      let targetConnection = $(`div.switch-connections div.connection[_connection-id="${connectionID}"]`)

                      // If the switcher of the connection is visible then skip this try-catch block
                      if (targetConnection.is(':visible'))
                        throw 0

                      // Make sure to reposition the switchers by making the current connection's switcher the first active one
                      targetConnection.insertAfter($(`div.switch-connections div.`))
                      targetConnection.show()
                      $(`div.switch-connections div.connection`).filter(':visible').last().hide()

                      // Handle the margin of the first connection
                      setTimeout(() => handleConnectionSwitcherMargin())
                    } catch (e) {}

                    try {
                      // If the current shown work area is the connection's one then skip this try-catch block
                      if (!content.is(':visible'))
                        throw 0

                      // Update active connection's ID
                      activeConnectionID = connectionID

                      // Skip the upcoming code
                      return
                    } catch (e) {}
                  } catch (e) {}

                  // Handle when connection is lost with the connection
                  try {
                    // If the work area exists or this is the sandbox/project workspace then skip this try-catch block
                    if (contentConnection.length > 0 || isSandbox)
                      throw 0

                    // If the `data-connected` attribute is anything rather than `false` then skip this try-catch block
                    if (getAttributes(connectionElement, 'data-connected') != 'false')
                      throw 0

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('unable to create workarea')), I18next.capitalizeFirstLetter(I18next.replaceData('connection [b]$data[/b] seems not pre-established or has been lost. please attempt to test that connection', [getAttributes(connectionElement, 'data-name')])) + '.', 'failure')

                    // Skip the upcoming code
                    return
                  } catch (e) {}

                  try {
                    // If the `restart` flag is `true` then skip this try-catch block
                    if (restart)
                      throw 0

                    // Update active connection's ID
                    activeConnectionID = connectionID

                    // Fade out all content except the work area
                    $('div.body div.right div.content div[content]:not([content="workarea"])').fadeOut(200)

                    // Fade in the work area content container
                    setTimeout(() => content.removeAttr('hidden').hide().fadeIn(200), 150)
                  } catch (e) {}

                  // If no need to create a work area then skip the upcoming code
                  if (skipCreationWorkarea)
                    return

                  // Get random IDs for different elements in the connection's work area
                  let [
                    // The connection's metadata functions, and their related elements
                    copyMetadataBtnID,
                    refreshMetadataBtnID,
                    searchInMetadataBtnID,
                    // CQLSH and Bash sessions, and their related elements
                    cqlshSessionContentID,
                    cqlshSessionSearchInputID,
                    cqlshSessionStatementInputID,
                    executeStatementBtnID,
                    bashSessionContentID,
                    terminalContainerID,
                    terminalBashContainerID,
                    containerFooterID,
                    containerEmptyStatementsID,
                    // CQL description
                    cqlDescriptionContentID,
                    cqlDescriptionSearchInputID,
                    cqlDescriptionsCloseAllBtnID,
                    // Query tracing
                    queryTracingContentID,
                    queryTracingSearchInputID,
                    // Cluster's metadata differentiation
                    metadataContentID,
                    metadataDifferentiationContentID,
                    refreshDifferentiationBtnID,
                    showDifferentiationBtnID,
                    diffNavigationPrevBtnID,
                    diffNavigationNextBtnID,
                    saveSnapshotBtnID,
                    loadSnapshotBtnID,
                    openSnapshotsFolderBtnID,
                    changeViewBtnID,
                    saveSnapshotSuffixContainerID,
                    changesLinesContainerID,
                    oldSnapshotNameID,
                    newMetadataTimeID,
                    // Set a work area ID as a reference to check its existance
                    workareaID,
                    // Restart and close the work area
                    restartWorkareaBtnID,
                    closeWorkareaBtnID
                  ] = getRandom.id(20, 34)

                  /**
                   * Define tabs that shown only to sandbox projects
                   *
                   * Define the AxonOps tab's content, by default it's empty
                   */
                  let axonopsTab = '',
                    // Define the Bash Session tab's content, as AxonOps, it's empty by default
                    bashSessionTab = ''

                  let consoleEditor

                  try {
                    // If the current workspace is not the sandbox then skip this try-catch block
                    if (!isSandbox)
                      throw 0

                    // Define the content of the AxonOps tab to be added
                    if (getAttributes(connectionElement, 'data-axonops-installed') === 'true') {
                      axonopsTab = `
                             <li class="nav-item axonops-tab" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="AxonOps" capitalize data-title>
                               <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${localClustersAxonopsContentID}" role="tab" aria-selected="true">
                                 <span class="icon"><ion-icon name="axonops"></ion-icon></span>
                                 <span class="title">AxonOps</span>
                               </a>
                             </li>`
                    }

                    // Define the content of the bash session tab to be added
                    bashSessionTab = `
                           <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="bash session" capitalize data-title>
                             <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${bashSessionContentID}" role="tab" aria-selected="true">
                               <span class="icon">
                                 <ion-icon name="bash"></ion-icon>
                               </span>
                               <span class="title">
                                 <span mulang="bash session" capitalize></span>
                               </span>
                             </a>
                           </li>`
                  } catch (e) {}

                  let isAxonOpsIntegrationActionEnabled = isInitAxonOpsIntegrationEnabled && !(Store.get(`${workspaceID}:AxonOpsIntegrationEnabled`) != undefined && !Store.get(`${workspaceID}:AxonOpsIntegrationEnabled`)) && !(Store.get(`${connectionID}:AxonOpsIntegrationEnabled`) != undefined && !Store.get(`${connectionID}:AxonOpsIntegrationEnabled`)) && connectionElement.attr('data-axonops-integration-organization') != undefined

                  // Connection work area's UI element structure
                  let element = `
                             <div class="workarea" connection-id="${connectionID}" workarea-id="${workareaID}">
                               <div class="sub-sides left">
                                 <div class="connection-info">
                                   <div class="name-ssl ${isSandbox ? 'is-sandbox' : ''}">
                                     <div class="name no-select-reverse">${getAttributes(connectionElement, 'data-name')}</div>
                                     <div class="status" data-tippy="tooltip" data-mdb-placement="left" data-mulang="analyzing status" capitalize-first data-title ${isSCBConnection ? 'hidden' : ''}>
                                       <ion-icon name="unknown"></ion-icon>
                                     </div>
                                     <div class="axonops-agent" data-tippy="tooltip" data-mdb-placement="left" data-mulang="open AxonOps in browser" capitalize-first data-title ${getAttributes(connectionElement, 'data-axonops-installed') !== 'true' ? 'hidden' : ''}>
                                       <ion-icon name="globe"></ion-icon>
                                     </div>
                                     <div class="axonops-integration-icon" data-tippy="tooltip" data-mdb-placement="left" data-mulang="launch AxonOps" capitalize-first data-title ${!isAxonOpsIntegrationActionEnabled ? 'hidden' : ''}>
                                       <ion-icon name="axonops"></ion-icon>
                                       <ion-icon name="globe"></ion-icon>
                                     </div>
                                     <div class="connection-status">
                                       <l-ripples style="--uib-size: 20px; --uib-color: #ff8000; --uib-speed: 7s;"><div class="dot"></div></l-ripples>
                                     </div>
                                   </div>
                                   <div class="additional">
                                     <div class="info" info="host" ${isSCBConnection ? 'hidden' : ''}>
                                       <div class="title">host
                                         <ion-icon name="right-arrow-filled"></ion-icon>
                                       </div>
                                       <div class="text no-select-reverse">${getAttributes(connectionElement, 'data-host')}</div>
                                     </div>
                                     <div class="info" info="cassandra">
                                       <div class="title">cassandra
                                         <ion-icon name="right-arrow-filled"></ion-icon>
                                       </div>
                                       <div class="text no-select-reverse">v${getAttributes(connectionElement, 'data-cassandra-version')}</div>
                                     </div>
                                     <div class="info" info="data-center">
                                       <div class="title">data center
                                         <ion-icon name="right-arrow-filled"></ion-icon>
                                       </div>
                                       <div class="text no-select-reverse">${getAttributes(connectionElement, 'data-datacenter')}</div>
                                     </div>
                                     <div class="info" info="cluster-name">
                                       <div class="title">cluster name
                                         <ion-icon name="right-arrow-filled"></ion-icon>
                                       </div>
                                       <div class="text no-select-reverse"></div>
                                       <div class="_placeholder" style="width: 50px;"></div>
                                     </div>
                                     <div class="info" info="cassandra-username">
                                       <div class="title">username
                                         <ion-icon name="right-arrow-filled"></ion-icon>
                                       </div>
                                       <div class="text no-select-reverse"></div>
                                       <div class="_placeholder" style="width: 50px;"></div>
                                     </div>
                                   </div>
                                 </div>
                                 <div class="connection-metadata loading" ${isSCBConnection ? 'style="height: calc(100% - 217px);"' : ''}>
                                   <div class="search-in-metadata">
                                     <div class="form-outline form-white margin-bottom">
                                       <input type="text" class="form-control form-icon-trailing form-control-sm">
                                       <label class="form-label">
                                         <span mulang="search in metadata" capitalize-first></span>
                                       </label>
                                       <div class="right-elements">
                                         <div class="result-count">
                                           <span class="current"></span>/<span class="total"></span>
                                         </div>
                                         <div class="arrows">
                                           <div class="next btn btn-tertiary" data-mdb-ripple-color="light">
                                             <ion-icon name="arrow-down"></ion-icon>
                                           </div>
                                           <div class="previous btn btn-tertiary" data-mdb-ripple-color="light">
                                             <ion-icon name="arrow-up"></ion-icon>
                                           </div>
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                   <div class="metadata-content" data-id="${metadataContentID}">
                                   </div>
                                   <div class="loading">
                                     <div class="sub-content">
                                     <img src="../assets/lottie/loading-metadata.gif" background="transparent" style="position: absolute; inset: 0; margin: auto; width: -webkit-fill-available;">
                                     </div>
                                   </div>
                                   <div class="metadata-actions">
                                     <div class="action" action="copy">
                                       <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="copy metadata" capitalize-first data-id="${copyMetadataBtnID}">
                                         <ion-icon name="copy"></ion-icon>
                                       </div>
                                     </div>
                                     <div class="action" action="refresh">
                                       <div class="btn btn-tertiary disableable" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="refresh metadata" capitalize-first data-id="${refreshMetadataBtnID}">
                                         <ion-icon name="refresh"></ion-icon>
                                       </div>
                                     </div>
                                     <div class="action" action="search">
                                       <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="search in metadata" capitalize-first data-id="${searchInMetadataBtnID}">
                                         <ion-icon name="search" style="font-size: 135%;"></ion-icon>
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               </div>
                               <div class="sub-sides right">
                                 <div class="header">
                                   <div class="connection-tabs">
                                     <ul class="nav nav-tabs nav-justified mb-3" id="ex-with-icons" role="tablist">
                                       <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="CQL console" capitalize data-title>
                                         <a tab-content="cqlsh-session" class="nav-link btn btn-tertiary active" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${cqlshSessionContentID}" role="tab" aria-selected="true">
                                           <span class="icon">
                                             <ion-icon name="terminal"></ion-icon>
                                           </span>
                                           <span class="title">
                                             <span mulang="CQL console" capitalize></span>
                                           </span>
                                         </a>
                                       </li>
                                       ${bashSessionTab}
                                       <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="CQL description" capitalize data-title>
                                         <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${cqlDescriptionContentID}" role="tab" aria-selected="true">
                                           <span class="icon">
                                             <ion-icon name="cql-description"></ion-icon>
                                           </span>
                                           <span class="title">
                                             <span mulang="CQL description" capitalize></span>
                                           </span>
                                         </a>
                                       </li>
                                       <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="query tracing" capitalize data-title>
                                         <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${queryTracingContentID}" role="tab" aria-selected="true">
                                           <span class="icon">
                                             <ion-icon name="query-tracing"></ion-icon>
                                           </span>
                                           <span class="title">
                                             <span mulang="query tracing" capitalize></span>
                                           </span>
                                         </a>
                                       </li>
                                       <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="schema diff" capitalize data-title>
                                         <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${metadataDifferentiationContentID}" role="tab" aria-selected="true">
                                           <span class="icon">
                                             <ion-icon name="differentiation"></ion-icon>
                                           </span>
                                           <span class="title">
                                             <span mulang="schema diff" capitalize></span>
                                           </span>
                                         </a>
                                       </li>
                                       <li class="nav-item axonops-integration-tab axonops-tab" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="AxonOps" capitalize data-title>
                                         <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${axonopsIntegrationContentID}" role="tab" aria-selected="true">
                                           <span class="icon"><ion-icon name="axonops"></ion-icon></span>
                                           <span class="title">AxonOps</span>
                                         </a>
                                       </li>
                                       ${axonopsTab}
                                     </ul>
                                   </div>
                                   <div class="connection-actions colored-box-shadow" style="width:40px">
                                     <div class="action" action="restart" hidden>
                                       <div class="btn-container">
                                         <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="restart the work area" capitalize-first data-id="${restartWorkareaBtnID}">
                                           <ion-icon name="restart"></ion-icon>
                                         </div>
                                       </div>
                                     </div>
                                     <div class="action" action="close">
                                       <div class="btn-container">
                                         <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="close and disconnect" capitalize-first data-id="${closeWorkareaBtnID}">
                                           <ion-icon name="close"></ion-icon>
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                                 <div class="tab-content">
                                   <div class="tab-pane fade show active loading" tab="cqlsh-session" id="_${cqlshSessionContentID}" role="tabpanel">
                                     <div class="switch-terminal" ${!isBasicCQLSHEnabled ? 'hidden' : ''}>
                                       <button type="button" class="btn btn-primary changed-bg changed-color" disabled>
                                         <ion-icon name="switch"></ion-icon>
                                         <span mulang="switch terminal"></span>
                                       </button>
                                     </div>
                                     <div class="terminal-container" data-id="${terminalContainerID}" style="display:none;"></div>
                                     <div class="interactive-terminal-container" data-id="${terminalContainerID}_interactive">
                                       <div class="container-header" style="${!isBasicCQLSHEnabled ? 'width: 100%;' : ''}">
                                         <div class="form-outline form-white margin-bottom" style="margin-bottom:20px;">
                                           <ion-icon name="search" class="trailing" style="font-size: 120%;"></ion-icon>
                                           <input spellcheck="false" type="text" class="form-control form-icon-trailing form-control-lg" id="_${cqlshSessionSearchInputID}">
                                           <label class="form-label">
                                             <span mulang="search in the session" capitalize-first></span>
                                           </label>
                                         </div>
                                       </div>
                                       <div class="session-content" id="_${cqlshSessionContentID}_container"></div>
                                       <div class="empty-statements show" id="_${containerEmptyStatementsID}">
                                         <div class="container">
                                           <div class="semi-colon">;</div>
                                           <div class="message"><span mulang="start now by executing cql statement" capitalize-first></span></div>
                                         </div>
                                       </div>
                                       <div class="container-footer" id="_${containerFooterID}">
                                         <div class="session-actions">
                                           <div class="session-action" action="history">
                                             <button class="btn btn-secondary btn-rounded" type="button" data-mdb-ripple-color="light" disabled>
                                               <ion-icon name="history"></ion-icon>
                                               <span class="button-label"><span mulang="statements history"></span></span>
                                             </button>
                                           </div>
                                           <div class="session-action" action="execute-file">
                                             <button class="btn btn-secondary btn-rounded" type="button" data-mdb-ripple-color="light" disabled>
                                               <ion-icon name="files"></ion-icon>
                                               <span class="button-label"><span mulang="execute CQL file(s)"></span></span>
                                             </button>
                                           </div>
                                           <div class="session-action" action="cql-snippets">
                                             <button class="btn btn-secondary btn-rounded disabled" type="button" data-mdb-ripple-color="light" disabled>
                                               <ion-icon name="snippets"></ion-icon>
                                               <span class="button-label"><span mulang="CQL snippets"></span></span>
                                             </button>
                                           </div>
                                           <div class="actions-right-side">
                                           <div class="session-action query-tracing" action="query-tracing">
                                           <button class="btn btn-secondary btn-rounded" type="button" data-mdb-ripple-color="light">
                                             <ion-icon name="query-tracing"></ion-icon>
                                             <span class="button-label"><span mulang="query tracing">query tracing</span>:</span>
                                             <span class="staus" style="margin-left: 7px;"></span>
                                             <div class="tooltip-info" style="transform: translateY(1px) translateX(5px);" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true"
                                             data-title data-mulang="query tracing captures detailed diagnostic information about query execution across the cluster. Useful for troubleshooting performance issues and understanding query paths.[br][br][b]Note[/b]: Tracing adds overhead to your queries and should only be used temporarily for debugging specific queries. Enabling tracing for extended periods or bulk operations may impact cluster performance" capitalize-first data-tippy-delay="[300, 0]">
                                               <ion-icon name="info-circle-outline" style="transform: translateX(0px); font-size: 170%; margin-left: 4px;"></ion-icon>
                                             </div>
                                           </button>
                                           </div>
                                           <div class="session-action pagination-size" action="pagination-size">
                                           <button class="btn btn-secondary btn-rounded" type="button" data-mdb-ripple-color="light">
                                             <ion-icon name="pagination"></ion-icon>
                                             <span class="button-label"><span mulang="page size">page size</span>:</span>
                                             <span class="size" style="margin-left: 7px;">0</span>
                                           </button>
                                           </div>
                                           <div class="session-action consistency-level" action="consistency-level">
                                           <button class="btn btn-secondary btn-rounded" type="button" data-mdb-ripple-color="light">
                                             <ion-icon name="consistency"></ion-icon>
                                             <span class="button-label"><span mulang="consistency">consistency</span>:</span>
                                             <span class="badge rounded-pill badge-dark"><b standard></b></span>
                                             <div class="tooltip-info" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true"
                                               data-title data-mulang="consistency level (CL) controls how many replica nodes must acknowledge a read/write before success. Higher CLs increase data accuracy but reduce availability/performance, while lower CLs favor availability.[br][br]However, tolerance to failure does not mean inconsistent data. To guarantee strong consistency, use:[br][code]R + W > RF[/code][br](Read replicas + Write replicas > Replication Factor)[br][br]Example: With [code]RF=3[/code], using [code]QUORUM (2)[/code] for both reads and writes ensures strong consistency [code](2+2>3)[/code] while maintaining availability and tolerance to failure" capitalize-first data-tippy-delay="[300, 0]">
                                               <ion-icon name="info-circle-outline" style="transform: translateX(0px); font-size: 170%; margin-left: 4px;"></ion-icon>
                                             </div>
                                             <span class="badge rounded-pill badge-dark"><b serial></b></span>
                                             <div class="tooltip-info" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true"
                                               data-title data-mulang="[p]This consistency choice only applies when using Light Weight Transactions (LWTs). Understanding SERIAL vs LOCAL_SERIAL[/p][ul][li][strong]SERIAL[/strong]: Enforces linearizable consistency across all datacenters, requiring consensus from all involved datacenters.[/li][li][strong]LOCAL_SERIAL[/strong]: Only enforces linearizable consistency within the local datacenter, which can be much faster in multi-datacenter deployments[/li][/ul][p]Recommended Consistency Level Combinations for LWTs[/p][table tooltiptable][thead][tr][th]Deployment Scenario[/th][th]Write Consistency Level[/th][th]Serial Consistency Level[/th][/tr][/thead][tbody][tr][td][strong]Multi-DC Strong Consistency[/strong][/td][td][code]EACH_QUORUM[/code][/td][td][code]SERIAL[/code][/td][/tr][tr][td][strong]Multi-DC High Performance[/strong][/td][td][code]LOCAL_QUORUM[/code][/td][td][code]LOCAL_SERIAL[/code][/td][/tr][tr][td][strong]Single-DC Clusters[/strong][/td][td][code]QUORUM[/code][/td][td][code]SERIAL[/code][/td][/tr][/tbody][/table]" capitalize-first data-tippy-delay="[300, 0]" data-tippy-maxWidth="590">
                                               <ion-icon name="info-circle-outline" style="transform: translateX(0px); font-size: 170%; margin-left: 4px;"></ion-icon>
                                             </div>
                                           </button>
                                           </div>
                                           </div>
                                         </div>
                                         <div class="top">
                                           <div class="consistency-levels"></div>
                                           <div class="change-consistency-levels">
                                             <button type="button" class="btn btn-tertiary" data-mdb-ripple-color="light">
                                               <ion-icon name="consistency"></ion-icon>
                                               <span mulang="change levels"></span>
                                             </button>
                                           </div>
                                           <div class="current-pagination-size">
                                             <div class="form-outline form-white">
                                               <input type="number" class="form-control form-control-sm">
                                               <label class="form-label">
                                                 <span mulang="paging size" capitalize></span>
                                               </label>
                                             </div>
                                           </div>
                                           <div class="change-pagination-size">
                                             <button type="button" class="btn btn-tertiary" data-mdb-ripple-color="light">
                                               <ion-icon name="pagination"></ion-icon>
                                               <span mulang="change paging size"></span>
                                             </button>
                                           </div>
                                           <div class="history-items"></div>
                                           <div class="history-items-clear-all">
                                             <button type="button" class="btn btn-tertiary" data-mdb-ripple-color="light">
                                               <ion-icon name="trash"></ion-icon>
                                               <span mulang="clear all statements"></span>
                                             </button>
                                           </div>
                                           <div class="history" style="display: none;">
                                             <button class="btn btn-tertiary" type="button" data-mdb-ripple-color="light" disabled>
                                               <ion-icon name="history"></ion-icon>
                                             </button>
                                           </div>
                                           <div class="textarea">
                                             <div class="form-outline form-white margin-bottom">
                                               <div class="suggestion"></div>
                                               <textarea spellcheck="false" type="text" class="form-control form-icon-trailing form-control-lg" id="_${cqlshSessionStatementInputID}" data-role="cqlsh-textarea"></textarea>
                                               <label class="form-label">
                                                 <span mulang="execute a cql statement" capitalize-first></span>
                                               </label>
                                             </div>
                                           </div>
                                           <div class="kill-process">
                                             <button class="btn btn-primary changed-bg changed-color" type="button" data-mdb-ripple-color="var(--mdb-danger)" data-tippy="tooltip" data-mdb-placement="left" data-title data-mulang="kill the process" capitalize-first>
                                               <ion-icon name="close"></ion-icon>
                                             </button>
                                           </div>
                                           <div class="hints-container">
                                             <div class="hint changed-bg changed-color">
                                               <div class="text">
                                                 <span mulang="an incomplete statement would have interrupted the execution flow" capitalize-first></span>
                                               </div>
                                             </div>
                                           </div>
                                           <div class="execute">
                                             <button id="_${executeStatementBtnID}" class="btn btn-tertiary" type="button" data-mdb-ripple-color="light" disabled>
                                               <ion-icon name="send"></ion-icon>
                                               <svg l-reuleaux x="0px" y="0px" viewBox="0 0 37 37" height="20" width="20" preserveAspectRatio="xMidYMid meet" style="--uib-size: 20px; --uib-color: white; --uib-speed: 0.8s; --uib-bg-opacity: 0.25;">
                                                 <path class="track" fill="none" stroke-width="2" pathLength="100"
                                                   d="M36.63 31.746 c0 -13.394 -7.3260000000000005 -25.16 -18.13 -31.375999999999998 C7.696 6.66 0.37 18.352 0.37 31.746 c5.328 3.108 11.544 4.8839999999999995 18.13 4.8839999999999995 S31.301999999999996 34.854 36.63 31.746z"></path>
                                                 <path class="car" fill="none" stroke-width="2" pathLength="100"
                                                   d="M36.63 31.746 c0 -13.394 -7.3260000000000005 -25.16 -18.13 -31.375999999999998 C7.696 6.66 0.37 18.352 0.37 31.746 c5.328 3.108 11.544 4.8839999999999995 18.13 4.8839999999999995 S31.301999999999996 34.854 36.63 31.746z"></path>
                                               </svg>
                                             </button>
                                           </div>
                                         </div>
                                         <div class="bottom">
                                           <div class="suggestions-list"></div>
                                         </div>
                                         <div class="console-editor"></div>
                                       </div>
                                     </div>
                                     <div class="loading">
                                       <div class="sub-content" style="text-align: center;">
                                         <img src="../assets/lottie/loading-cqlsh.gif" class="gif" style="height: -webkit-fill-available;">
                                       </div>
                                     </div>
                                   </div>
                                   <div class="tab-pane fade _empty" tab="cql-description" id="_${cqlDescriptionContentID}" role="tabpanel">
                                     <div class="descriptions-container">
                                       <div class="form-outline form-white margin-bottom" style="margin-bottom:20px;width: calc(100% - 45px);">
                                         <ion-icon name="search" class="trailing" style="font-size: 120%;"></ion-icon>
                                         <input type="text" class="form-control form-icon-trailing form-control-lg" id="_${cqlDescriptionSearchInputID}">
                                         <label class="form-label">
                                           <span mulang="search for CQL description" capitalize-first></span>
                                         </label>
                                         <div class="close-all-descriptions">
                                           <button type="button" id="_${cqlDescriptionsCloseAllBtnID}" class="btn btn-sm btn-secondary ripple-surface-light" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="close all descriptions" capitalize data-title>
                                             <ion-icon name="close"></ion-icon>
                                           </button>
                                         </div>
                                       </div>
                                       <div class="descriptions">
                                       </div>
                                     </div>
                                     <div class="empty">
                                       <div class="lottie-container" style="text-align: center;">
                                         <img src="../assets/lottie/empty-cql-description.gif" class="gif" style="height: -webkit-fill-available;">
                                         <div class="message"><span mulang="right click on the cluster, keyspace or table and get its CQL description" capitalize-first></span>.
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                   <div class="tab-pane fade _empty" tab="query-tracing" id="_${queryTracingContentID}" role="tabpanel">
                                     <div class="queries-container">
                                       <div class="form-outline form-white margin-bottom" style="margin-bottom:20px;">
                                         <ion-icon name="search" class="trailing" style="font-size: 120%;"></ion-icon>
                                         <input type="text" class="form-control form-icon-trailing form-control-lg" id="_${queryTracingSearchInputID}">
                                         <label class="form-label">
                                           <span mulang="search by session ID or part of the query" capitalize-first></span>
                                         </label>
                                       </div>
                                       <div class="queries">
                                       </div>
                                     </div>
                                     <div class="empty">
                                       <div class="lottie-container" style="text-align: center;">
                                         <img src="../assets/lottie/empty-query-tracing.gif" class="gif" style="height: -webkit-fill-available;">
                                         <div class="message"><span mulang="no query has been traced yet" capitalize-first></span>.<hint> <span mulang="it can be enabled by running" capitalize-first></span> <code>tracing on</code></hint>
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                   <div class="tab-pane fade" tab="metadata-differentiation" id="_${metadataDifferentiationContentID}" role="tabpanel">
                                     <div class="metadata-content-container">
                                       <div class="metadata-content all">
                                         <div class="editor-container-all"></div>
                                       </div>
                                       <span class="badge badge-secondary old"><span mulang="previous" capitalize></span><span class="old-snapshot" data-id="${oldSnapshotNameID}"></span></span>
                                       <div class="centered-badges">
                                         <span class="badge badge-primary btn btn-secondary btn-sm changes" style="cursor:pointer;" data-mdb-ripple-color="dark" data-changes="0" data-id="${showDifferentiationBtnID}"><span mulang="changes" capitalize></span>: <span>0</span></span>
                                         <div class="diff-navigation">
                                           <span class="diff-nav-prev btn btn-secondary btn-sm disabled" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="previous change" capitalize-first
                                             data-id="${diffNavigationPrevBtnID}">
                                             <ion-icon name="arrow-up"></ion-icon>
                                           </span>
                                           <span class="diff-nav-next btn btn-secondary btn-sm disabled" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="next change" capitalize-first
                                             data-id="${diffNavigationNextBtnID}">
                                             <ion-icon name="arrow-up"></ion-icon>
                                           </span>
                                         </div>
                                         <div class="actions">
                                           <span class="refresh btn btn-secondary btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="refresh metadata" capitalize-first
                                             data-id="${refreshDifferentiationBtnID}">
                                             <ion-icon name="refresh"></ion-icon>
                                           </span>
                                           <span class="save-snapshot btn btn-secondary btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="save a schema snapshot" capitalize-first
                                             data-id="${saveSnapshotBtnID}">
                                             <ion-icon name="save-floppy"></ion-icon>
                                           </span>
                                           <span class="load-snapshot btn btn-secondary btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-titl data-mulang="load a schema snapshot" capitalize-first
                                             data-id="${loadSnapshotBtnID}">
                                             <ion-icon name="upload"></ion-icon>
                                           </span>
                                           <span class="snapshots-folder btn btn-secondary btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="open the schema snapshot folder" capitalize-first
                                             data-id="${openSnapshotsFolderBtnID}">
                                             <ion-icon name="folder-open-outline"></ion-icon>
                                           </span>
                                           <span class="change-view btn btn-secondary btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="change the editors view" capitalize-first
                                             data-id="${changeViewBtnID}" hidden>
                                             <ion-icon name="diff-vertical"></ion-icon>
                                           </span>
                                         </div>
                                       </div>
                                       <span class="badge badge-secondary new"><span mulang="new" capitalize></span><span class="new-metadata-time" data-id="${newMetadataTimeID}" data-time></span></span>
                                       <div class="save-snapshot-suffix" data-id="${saveSnapshotSuffixContainerID}">
                                         <div class="time"></div>
                                         <div class="form-outline form-white margin-bottom">
                                           <input type="text" class="form-control form-icon-trailing form-control-lg">
                                           <label class="form-label"><span mulang="snapshot suffix" capitalize></span> (<span mulang="optional" capitalize></span>)</label>
                                         </div>
                                         <button type="button" class="btn btn-primary btn-sm changed-bg changed-color"><span mulang="save schema snapshot"></span></button>
                                       </div>
                                       <div class="changes-lines" data-id="${changesLinesContainerID}">
                                       </div>
                                     </div>
                                   </div>
                                   <div class="tab-pane fade" tab="axonops-integration" id="_${axonopsIntegrationContentID}" role="tabpanel">
                                    <webview nodeIntegrationInSubFrames nodeintegration></webview>
                                    <div class="axonops-webview-actions">
                                      <div class="webview-action btn btn-tertiary" data-mdb-ripple-color="light" action="home" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="load cluster view" hidden capitalize-first>
                                        <ion-icon name="home"></ion-icon>
                                      </div>
                                      <div class="webview-action btn btn-tertiary" data-mdb-ripple-color="light" action="refresh" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="refresh the view" capitalize-first>
                                        <ion-icon name="refresh" style="transform: translateY(2px);"></ion-icon>
                                      </div>
                                      <div class="webview-action btn btn-tertiary" data-mdb-ripple-color="light" action="logout" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="logout" capitalize-first hidden>
                                        <ion-icon name="logout"></ion-icon>
                                      </div>
                                      <div class="webview-action btn btn-tertiary webview-current-link" data-tippy-maxWidth="1000" data-mdb-ripple-color="light" action="about" data-tippy="tooltip" data-mdb-placement="top" data-title data-mulang="-">
                                        <ion-icon name="about" style="font-size: 190%; transform: translateY(-2px);"></ion-icon>
                                      </div>
                                    </div>
                                   </div>
                                   <div class="tab-pane fade" id="_${localClustersAxonopsContentID}" role="tabpanel"></div>
                                   <div class="tab-pane fade" tab="bash-session" id="_${bashSessionContentID}" role="tabpanel">
                                     <div class="terminal-container" data-id="${terminalBashContainerID}"></div>
                                   </div>
                                 </div>
                               </div>
                             </div>`

                  // Append the connection's work area
                  content.append($(element).show(function() {
                    // Update the `work-area` attribute
                    connectionElement.attr('data-workarea', 'true')

                    // Apply different actions once the UI element is created
                    {
                      // Initialize the input and textarea fields
                      setTimeout(() => {
                        $(this).find('input[type="text"], input[type="number"], textarea').each(function() {
                          try {
                            let object = getElementMDBObject($(this), 'Input')
                            object.update()
                          } catch (e) {}
                        })
                      }, 1000)

                      // Initialize all tooltips inside the work area
                      setTimeout(() => {
                        $(this).find('[data-tippy="tooltip"]').each(function() {
                          // Create an MDB oject for the tooltip
                          let tooltip = getElementMDBObject($(this), 'Tooltip')

                          // Disable the tab's tooltips
                          if ($(this).attr('tab-tooltip') != undefined)
                            tooltip.disable()

                          // Once the tooltip's reference element is clicked hide the tooltip
                          $(tooltip.reference).click(() => tooltip.hide())
                        })
                      })

                      // Update the SSL lockpad status - if the status is available in this stage -
                      setTimeout(() => updateSSLLockpadStatus(connectionElement))

                      // Apply the chosen language on the UI element after being fully loaded
                      setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                      // Update the status of the connection in the mini connection's list
                      updateMiniConnection(workspaceID, connectionID)
                    }

                    // Handle when typing something inside the query tracing's search input field
                    {
                      setTimeout(() => {
                        $(this).find(`input#_${queryTracingSearchInputID}`).on('input', function() {
                          // Get the search text, minify/manipulate it
                          let searchValue = minifyText($(this).val()),
                            // Point at the queries' container
                            queriesContainer = $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).find('div.queries')

                          // The search text must be more than 3 characters
                          if (searchValue.length <= 3)
                            return queriesContainer.children('div.query').show()

                          // Loop through each query
                          queriesContainer.children('div.query').each(function() {
                            // Get its text in overall
                            let queryContent = minifyText($(this).text())

                            // Show/hide it based on the result of whether or not it contains the search text
                            $(this).toggle(queryContent.search(searchValue))
                          })
                        })
                      })
                    }

                    // Handle when typing something inside the interactive terminal's search input
                    {
                      setTimeout(() => {
                        $(this).find(`input#_${cqlshSessionSearchInputID}`).on('input', function() {
                          // Get the search text, minify/manipulate it
                          let searchValue = minifyText($(this).val()),
                            // Point at the sessions' container
                            sessionContainer = $(`#_${cqlshSessionContentID}_container`)

                          // The search text must be more than 3 characters
                          if (searchValue.length <= 3)
                            return sessionContainer.children('div.block').show()

                          // Loop through each block
                          sessionContainer.children('div.block').each(function() {
                            // Get its text in overall
                            let blockContent = minifyText($(this).text())

                            // Show/hide it based on the result of whether or not it contains the search text
                            $(this).toggle(blockContent.search(searchValue))
                          })
                        })
                      })
                    }

                    // Handle when typing something inside the cql description's search input field
                    {
                      setTimeout(() => {
                        $(this).find(`input#_${cqlDescriptionSearchInputID}`).on('input', function() {
                          // Get the search text, minify/manipulate it
                          let searchValue = minifyText($(this).val()),
                            // Point at the descriptions' container
                            descriptionsContainer = $(`div.tab-pane[tab="cql-description"]#_${cqlDescriptionContentID}`).find('div.descriptions')

                          // Update the input field by calling its object's `update` function
                          getElementMDBObject($(this)).update()

                          // Trigger the `resize` event to make sure editors' dimensions are correct
                          setTimeout(() => $(window.visualViewport).trigger('resize'))

                          // The search text must be more than 3 characters
                          if (searchValue.length <= 3)
                            return descriptionsContainer.children('div.description').show()

                          // Loop through each description
                          descriptionsContainer.children('div.description').each(function() {
                            // Get its text in overall
                            let descriptionContent = minifyText($(this).text())

                            // Show/hide it based on the result of whether or not it contains the search text
                            $(this).toggle(descriptionContent.search(searchValue))
                          })
                        })

                        $(`button#_${cqlDescriptionsCloseAllBtnID}`).click(function() {
                          $(`div.tab-pane[tab="cql-description"]#_${cqlDescriptionContentID}`).find('div.descriptions').find('button.close-description').click()
                        })
                      })
                    }

                    /**
                     * Define variables which will be available for all sub-scopes
                     *
                     * Point at the created work area
                     */
                    let workareaElement = $(this),
                      terminal, // The XTermJS object
                      terminalID = getRandom.id(10), // The cqlsh session's unique ID
                      prefix = '', // Dynamic prefix/prompt; `cqlsh>`, `cqlsh:system>`, etc...
                      isSessionPaused = false, // To determine if there's a need to pause the print of received data temporarily or permanently
                      isCQLSHLoaded = false, // To determine if the cqlsh tool has been loaded and ready to be used
                      isMetadataFetched = false, // To determine if the metadata will be fetched or not
                      latestMetadata = null, // Save the latest fetched metadata in JSON format
                      metadataChanges = 0, // Hold the latest detected number of changes/diffs in metadata
                      // An inner function to check/fetch metadata which will be implemented next and be available out of the implementation scope
                      checkMetadata = null,
                      /**
                       * The metadata differentiation editors - old and new metadata -
                       * Both of them have the editor's object, and decorations - to highlight diffs
                       */
                      metadataDiffEditors = {
                        old: {
                          object: null,
                          decorations: null
                        },
                        new: {
                          object: null,
                          decorations: null
                        }
                      },
                      diffEditor,
                      // Hold the object of the metadata's tree view
                      jsTreeObject = null,
                      // Save the latest executed command
                      latestCommand = null

                    /**
                     * Inner function to detect the differentiation between two metadata contents and apply changes over the UI
                     *
                     * @Parameters:
                     * {object} `oldMetadata` the old metadata in JSON format
                     * {object} `newMetadata` the new metadata in JSON format
                     */
                    let detectDifferentiationShow = (oldMetadata, newMetadata) => {
                      // Apply JSON beautify process on both contents
                      oldMetadata = beautifyJSON(oldMetadata, true)
                      newMetadata = beautifyJSON(newMetadata, true)

                      // Call the function which will return changes between two strings
                      detectDifferentiation(oldMetadata, newMetadata, (detectedChanges) => {
                        // Point at the results
                        let result = detectedChanges.result,
                          // Point at the differentiation show button000
                          differentiationBtn = workareaElement.find(`span.btn[data-id="${showDifferentiationBtnID}"]`),
                          // Point at the changes/differences container
                          changesContainer = workareaElement.find(`div.changes-lines[data-id="${changesLinesContainerID}"]`)

                        // Update the number of detected changes
                        differentiationBtn.attr('data-changes', result.length)

                        // Update the button's text by showing the number of detected changes
                        differentiationBtn.children('span').filter(':last').text(result.length); // This semicolon is critical here

                        // Loop through both editors and remove the decorations
                        (['old', 'new']).forEach((type) => {
                          if (metadataDiffEditors[type].decorations != null)
                            metadataDiffEditors[type].object.removeDecorations(metadataDiffEditors[type].decorations)
                        })

                        // If there's no detected change then end the process
                        if (result.length <= 0)
                          return

                        // Remove all previous changed lines from the changes' container
                        changesContainer.children('div.line').remove()

                        // Array which will hold all decorations
                        let highlights = []

                        // Loop through each change in the content
                        result.forEach((change) => {
                          // Increasing the number is important as the first line's number in the array is 0
                          change.number += 1

                          // Push the highlight object
                          highlights.push({
                            range: new monaco.Range(change.number, 0, change.number, 0),
                            options: {
                              isWholeLine: true,
                              className: 'diff'
                            },
                            type: change.type
                          })

                          // Line UI element structure
                          let element = `
                                     <div class="line" data-number="${change.number}">
                                       <span class="number">${change.number}</span>
                                       <span class="content">${change.content}</span>
                                     </div>`

                          // Append the line element to the container
                          changesContainer.append($(element).click(function() {
                            // Get the line's number
                            let lineNumber = parseInt($(this).attr('data-number')); // This semicolon is critical here

                            // For both editors, go to the clicked line
                            (['old', 'new']).forEach((type) => {
                              // Show the line at the center of the editor
                              metadataDiffEditors[type].object.revealLineInCenter(lineNumber)

                              // Put cursor at the beginning of the line
                              metadataDiffEditors[type].object.setPosition({
                                lineNumber,
                                column: 0
                              })
                            })
                          }))
                        }); // This semicolon is critical here

                        // Add highlights to both editors
                        (['old', 'new']).forEach((type) => {
                          let finalHighlights = [...highlights]

                          try {
                            if (type != 'new')
                              throw 0

                            finalHighlights = finalHighlights.map((highlight) => {
                              delete highlight.type
                              return highlight
                            })
                          } catch (e) {}

                          try {
                            if (type != 'old')
                              throw 0

                            finalHighlights = (finalHighlights.filter((highlight) => highlight.type != 'ADD')).map((highlight) => {
                              delete highlight.type
                              return highlight
                            })
                          } catch (e) {}

                          try {
                            metadataDiffEditors[type].decorations = metadataDiffEditors[type].object.deltaDecorations([], finalHighlights)
                          } catch (e) {}
                        })
                      })
                    }

                    /**
                     * Inner function to append block to the interactive terminal
                     *
                     * @Parameters:
                     * {object} `sessionContainer` the terminal's session HTML container
                     * {string} `blockID` the generated block ID
                     * {string} `statement` the executed statement
                     * {object} `callback` function that will be triggered with passing the final result
                     * {boolean} `?isOnlyInfo` Whether or not this is an info block only
                     * {string} `?type` the type of the message, the value could be:
                     * [`warning`, `info`, and `error`], or empty
                     *
                     * @Return: {string} the passed object in string format after manipulation
                     */
                    global.addBlock = (sessionContainer, blockID, statement, callback = null, isOnlyInfo = false, type = '', compact = false) => {
                      // Hide the emptiness class as there's at least one block now
                      sessionContainer.parent().find(`div.empty-statements`).removeClass('show')

                      let finalInfoContent = (type == 'neutral' ? 'info' : type),
                        statementText = `${isOnlyInfo ? finalInfoContent : statement}`

                      finalInfoContent = `<span mulang="${finalInfoContent}" capitalize></span>`

                      try {
                        if (isOnlyInfo)
                          throw 0

                        statementText = Highlight.highlight(removeComments(statementText, true), {
                          language: 'cql'
                        }).value
                      } catch (e) {}

                      // The statement's block UI structure
                      let element = `
                                   <div class="block show${compact ? ' compact' : ''}" data-id="${blockID}">
                                     <div class="statement ${isOnlyInfo ? type + ' capitalize' : ''}">
                                       <span class="toast-type" ${!isOnlyInfo ? 'hidden' : ''}>
                                         <img src="../assets/lottie/${type || 'neutral'}.gif" background="transparent" style="height: -webkit-fill-available;">
                                       </span>
                                       <div class="text"><pre>${statementText}</pre></div>
                                       <div class="actions for-statement" ${isOnlyInfo ? 'hidden' : ''}>
                                         <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="execute-statement" data-tippy="tooltip" data-mdb-placement="bottom" data-title onclick="executeStatement(this)" data-mulang="execute the statement" capitalize-first>
                                           <ion-icon name="execute-solid" style="font-size: 125%;"></ion-icon>
                                         </div>
                                         <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="copy-statement" data-tippy="tooltip" data-mdb-placement="bottom" onclick="copyStatement(this)" data-mulang="copy the statement" capitalize-first>
                                           <ion-icon name="copy-solid"></ion-icon>
                                         </div>
                                       </div>
                                     </div>
                                     <div class="info-badges">
                                       <div class="prompt badge badge-secondary" ${isOnlyInfo ? 'hidden' : ''}></div>
                                       <div class="statements-count badge badge-info" ${isOnlyInfo ? 'hidden' : ''}></div>
                                     </div>
                                     <div class="output">
                                       <div class="executing" ${isOnlyInfo ? 'hidden' : ''}></div>
                                       ${isOnlyInfo ? statement : ''}
                                     </div>
                                     <div class="actions" style="${isOnlyInfo ? 'width:30px;' : ''}">
                                       <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="download" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="download the block" capitalize-first hidden>
                                         <ion-icon name="download"></ion-icon>
                                       </div>
                                       <div class="download-options">
                                         <div class="option btn btn-tertiary" option="csv" data-mdb-ripple-color="dark">
                                           <ion-icon name="csv"></ion-icon>
                                         </div>
                                         <div class="option btn btn-tertiary" option="pdf" data-mdb-ripple-color="dark">
                                           <ion-icon name="pdf"></ion-icon>
                                         </div>
                                       </div>
                                       <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="copy" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="copy the block" capitalize-first ${isOnlyInfo ? 'hidden' : ''}>
                                         <ion-icon name="copy-solid"></ion-icon>
                                       </div>
                                       <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="delete the block" capitalize-first>
                                         <ion-icon name="trash"></ion-icon>
                                       </div>
                                     </div>
                                   </div>`

                      // Append the block and hide it - till and output is received -
                      sessionContainer.append($(element).show(function() {
                        // Enable tooltips
                        setTimeout(() => $(this).find('[data-tippy="tooltip"]').each(function() {
                          getElementMDBObject($(this), 'Tooltip')
                        }))

                        // Apply the chosen language on the UI element after being fully loaded
                        setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                        // Call the callback function with the created block
                        if (callback != null)
                          callback($(this))

                        // Scroll to the very bottom of the session's container
                        setTimeout(() => {
                          try {
                            $(this).parent().animate({
                              scrollTop: $(this).parent().get(0).scrollHeight
                            }, 100)
                          } catch (e) {}
                        }, 250)

                        // Skip the upcoming code if the block is not an info
                        if (!isOnlyInfo)
                          return

                        // Show the block if needed
                        $(this).show().addClass('show')

                        setTimeout(() => {
                          $(this).find('div.btn[action="delete"]').click(() => {
                            // Remove the block from the session
                            $(this).remove()

                            try {
                              // Point at the session's statements' container
                              let sessionContainer = workareaElement.find(`#_${cqlshSessionContentID}_container`)

                              // If there's still one block then skip this try-catch block
                              if (sessionContainer.find('div.block').length > 0)
                                throw 0

                              // Show the emptiness class
                              sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                            } catch (e) {}
                          })
                        })
                      }))
                    }

                    /**
                     * Inner function to handle the `click` event of a session's link in the terminal
                     *
                     * @Parameters:
                     * {object || boolean} `_` this parameter can be the event object, or flag to tell about the seesion's ID
                     * {string} `link` the link's content
                     */
                    let clickEvent = (_, link) => {
                      /**
                       * Get the session ID from the link - by slicing the protocol `session://`
                       * Other is passing `true` to `_` parameter; which tells that the function has been called from the interactive terminal
                       */
                      let sessionID = _ != true ? link.slice(10) : link,
                        // Point at the queries' container
                        queriesContainer = workareaElement.find(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).find('div.queries'),
                        // Point at the queries' tab
                        queryTracingTab = workareaElement.find(`a.nav-link.btn[href="#_${queryTracingContentID}"]`),
                        // Get the queries' tab MDB object
                        queryTracingTabObject = getElementMDBObject(queryTracingTab, 'Tab')

                      // If the clicked session exists in the query tracing's container
                      if (queriesContainer.children(`div.query[data-session-id="${sessionID}"]`).length != 0) {
                        // Just add the session ID in the search input and it'll handle the rest
                        workareaElement.find(`input#_${queryTracingSearchInputID}`).val(sessionID)

                        // Go to the query tracing's tab
                        queryTracingTabObject.show()

                        // Skip the upcoming code
                        return
                      }

                      // Request to get query tracing result by passing the connection's and the session's IDs
                      Modules.Connections.getQueryTracingResult(connectionID, sessionID, (result) => {
                        // If the `result` value is `null` then the app wasn't able to get the query tracing result
                        if (result == null)
                          return

                        let dataCenters = JSON.parse(connectionElement.attr('data-datacenters'))

                        try {
                          result = result.map((activity) => {

                            try {
                              activity.data_center = dataCenters.find((dataCenter) => dataCenter.address == activity.source).datacenter
                            } catch (e) {}

                            activity.color = invertColor(getRandom.color())

                            activity.id = getRandom.id(6)

                            return activity
                          })
                        } catch (e) {}

                        let groupedResult = groupActivitiesBySource([...result]),
                          totalSourcesElapsedTime = Object.keys(groupedResult).map((source) => {
                            let elapsedTime = 0

                            try {
                              let initTime = 0

                              elapsedTime = groupedResult[source].reduce((accumulator, activity) => accumulator + Math.abs(activity.source_elapsed), initTime)
                            } catch (e) {}

                            elapsedTime = (elapsedTime / 1000)

                            return {
                              source,
                              elapsedTime
                            }
                          })


                        // Get random IDs for the different elements of the query tracing section
                        let [
                          tableBodyID,
                          canvasTimelineID,
                          canvasPieChartID,
                          sourcesContainerID,
                          zoomResetBtnID
                        ] = getRandom.id(20, 5),
                          // Generate random color for each activity in the query tracing's result
                          sourcesColors = getRandom.color(Object.keys(groupedResult).length)

                        try {
                          if (!Array.isArray(sourcesColors))
                            sourcesColors = [sourcesColors]
                        } catch (e) {}

                        sourcesColors = sourcesColors.map((color) => invertColor(color))

                        // Remove the `empty` class; in order to show the query tracing's content
                        workareaElement.find(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).removeClass('_empty')

                        // The query tracing's result UI structure
                        let element = `
                                   <div class="query" data-session-id="${sessionID}">
                                     <span class="badge rounded-pill badge-secondary id-time">#${sessionID} <ion-icon name="time"></ion-icon> ${formatTimeUUID(sessionID)}</span>
                                     <div class="sources" id="_${sourcesContainerID}">
                                       <button type="button" class="btn btn-secondary btn-rounded btn-sm" data-source="all">
                                         <span source-ip>All</span>
                                       </button>
                                     </div>
                                     <div class="info-left">
                                       <div class="left-chart">
                                         <canvas data-canvas-id="${canvasTimelineID}" width="100%"></canvas>
                                         <button type="button" class="btn btn-tertiary zoom-reset" data-mdb-ripple-color="light" id="_${zoomResetBtnID}">
                                           <ion-icon name="zoom-reset"></ion-icon>
                                         </button>
                                       </div>
                                       <div class="right-chart"><canvas data-canvas-id="${canvasPieChartID}" width="100%"></canvas></div>
                                     </div>
                                     <div class="info-right">
                                       <div class="copy-tracing" style="z-index: 1;">
                                         <div class="btn btn-tertiary" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="left" data-title data-mulang="copy the tracing result" capitalize-first>
                                           <ion-icon name="copy-solid"></ion-icon>
                                         </div>
                                       </div>
                                       <div class="activities-table" id="_${tableBodyID}"></div>
                                     </div>
                                   </div>`

                        // Prepend the tracing's result to the container
                        queriesContainer.prepend($(element).show(function() {
                          // Apply different actions once the UI element is created
                          {
                            // Show the query tracing's tab after 0.25s of creation
                            setTimeout(() => queryTracingTabObject.show(), 250)

                            // Apply the chosen language on the UI element after being fully loaded
                            setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                          }

                          // Listen to the `click` event on the result's badge - which contain's the query tracing's session ID
                          {
                            setTimeout(() => $(this).find('span.badge').click(() => $(`tbody[data-body-id="${tableBodyID}"]`).parent().toggle()))
                          }

                          let activitesTabulatorObject = null

                          // Append each activity in the query tracing's table
                          {
                            setTimeout(() => {
                              let tableData = [...result]

                              try {
                                let index = -1

                                tableData = tableData.map((sourceActivity) => {
                                  index += 1

                                  sourceActivity.activity = `<span class="color" style="background-color:${sourceActivity.color}"></span> ${sourceActivity.activity}`

                                  sourceActivity.event_id = `${formatTimeUUID(sourceActivity.event_id, true)}`

                                  sourceActivity.source_elapsed_new = `${((index == 0 ? sourceActivity.source_elapsed : sourceActivity.source_elapsed - result[index - 1].source_elapsed) / 1000).toFixed(2)}ms`

                                  return sourceActivity
                                })

                                tableData = tableData.map((sourceActivity) => {
                                  sourceActivity.source_elapsed = `${sourceActivity.source_elapsed_new}`

                                  delete sourceActivity.source_elapsed_new

                                  delete sourceActivity.color

                                  return {
                                    "Activity": sourceActivity.activity,
                                    "Activity Chart ID": sourceActivity.id,
                                    "Source": sourceActivity.source,
                                    "Source Data Center": sourceActivity.data_center,
                                    "Source Elapsed": sourceActivity.source_elapsed,
                                    "Source Port": sourceActivity.source_port,
                                    "Thread": sourceActivity.thread,
                                    "Event ID": sourceActivity.event_id,
                                    "Session ID": sourceActivity.session_id
                                  }
                                })
                              } catch (e) {}

                              convertTableToTabulator(JSON.stringify(tableData), $(`div[id="_${tableBodyID}"]`), 10, true, (tabulatorObject) => setTimeout(() => {
                                activitesTabulatorObject = tabulatorObject

                                tabulatorObject.redraw()
                              }))
                            })
                          }

                          // Clicks the copy button
                          setTimeout(() => {
                            $(this).find('div.copy-tracing div.btn').click(function() {
                              // Get the beautified version of the result
                              let resultBeautified = beautifyJSON(result),
                                // Get the result size
                                resultSize = Bytes(ValueSize(resultBeautified))

                              // Copy the result to the clipboard
                              try {
                                Clipboard.writeText(resultBeautified)
                              } catch (e) {
                                try {
                                  errorLog(e, 'connections')
                                } catch (e) {}
                              }

                              // Give feedback to the user
                              showToast(I18next.capitalize(I18next.t('copy query tracing result')), I18next.capitalizeFirstLetter(I18next.replaceData('query tracing result with session ID of [b]$data[/b] has been copied to the clipboard, the size is $data', [sessionID, resultSize])) + '.', 'success')
                            })
                          })

                          // Set the common configuration between the two charts - timeline and doughnut -
                          let chartConfiguration = {
                            chart: {
                              fontFamily: 'Main, sans-serif'
                            },
                            data: {
                              datasets: [{
                                data: null,
                                backgroundColor: []
                              }],
                              labels: []
                            },
                            options: {
                              indexAxis: 'y',
                              scales: {
                                y: {
                                  ticks: {
                                    display: false
                                  }
                                }
                              },
                              responsive: true,
                              plugins: {
                                legend: {
                                  display: false
                                },
                                tooltip: {
                                  callbacks: {
                                    label: null
                                  }
                                },
                                title: {
                                  display: false
                                }
                              }
                            }
                          }

                          let onClickChartElement = (event, element) => {
                            try {
                              if (element.length <= 0)
                                return

                              if (element[0].element['$context'].raw.id == undefined)
                                return

                              let activityChartID = `${element[0].element['$context'].raw.id}`

                              let activityChartIDFilterInput = $(activitesTabulatorObject.element).find('div.tabulator-col[tabulator-field="Activity Chart ID"]').find('input[type="search"]')

                              activityChartIDFilterInput.val(`${activityChartID}`).focus()

                              setTimeout(() => $('body').find('button')[0].focus())
                            } catch (e) {}
                          }

                          /**
                           * Set the timeline chart configuration
                           * Doc: https://www.chartjs.org/docs/latest/charts/bar.html
                           *
                           * Copy the common configuration
                           */
                          let timeLineChartConfig = JSON.parse(JSON.stringify(chartConfiguration));

                          try {
                            timeLineChartConfig.options.onClick = (event, element) => onClickChartElement(event, element)
                          } catch (e) {}

                          // Set the special configuration for the timeline chart
                          try {
                            timeLineChartConfig.type = 'bar'
                            // timeLineChartConfig.data.datasets[0].data = result.map((query, index) => [index == 0 ? 0 : result[index - 1].source_elapsed / 1000, query.source_elapsed / 1000])

                            timeLineChartConfig.options.elements = {}
                            timeLineChartConfig.options.elements.bar = {
                              borderWidth: 1
                            }

                            timeLineChartConfig.options.plugins.zoom = {
                              pan: {
                                enabled: true,
                                mode: 'xy',
                                modifierKey: 'ctrl'
                              },
                              zoom: {
                                wheel: {
                                  enabled: true,
                                  speed: 0.05,
                                  modifierKey: 'ctrl'
                                },
                                pinch: {
                                  enabled: true
                                },
                                mode: 'xy',
                              }
                            }

                            timeLineChartConfig.options.plugins.tooltip.callbacks.label = (activity) => {
                              let val = JSON.parse(activity.formattedValue)
                              return `${(val[1] - val[0]).toFixed(2)}ms`
                            }
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          /**
                           * Set the pie/doughnut chart configuration
                           * Doc: https://www.chartjs.org/docs/latest/charts/doughnut.html
                           *
                           * Copy the common configuration
                           */
                          let pieChartConfig = JSON.parse(JSON.stringify(chartConfiguration));

                          try {
                            pieChartConfig.options.onClick = (event, element) => onClickChartElement(event, element)
                          } catch (e) {}

                          // Set the special configuration for the pie chart
                          try {
                            pieChartConfig.type = 'doughnut'
                            // pieChartConfig.data.datasets[0].data = result.map((query, index) => parseFloat((query.source_elapsed / 1000) - (index == 0 ? 0 : result[index - 1].source_elapsed / 1000)))
                            pieChartConfig.data.datasets[0].borderColor = 'rgba(0, 0, 0, 0)'

                            pieChartConfig.options.plugins.tooltip.callbacks.label = (activity) => {
                              return `${parseFloat(activity.formattedValue).toFixed(2)}ms`
                            }
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          /**
                           * Create the charts by calling the `Chart` constructor
                           * The charts' objects are saved in the `queryTracingChartsObjects` array
                           */
                          ([
                            [canvasTimelineID, timeLineChartConfig],
                            [canvasPieChartID, pieChartConfig]
                          ]).forEach((chart, index) => setTimeout(() => queryTracingChartsObjects[chart[0]] = new Chart($(`canvas[data-canvas-id="${chart[0]}"]`)[0], chart[1]), 50 * index))

                          let handleSourceBtnClick = function() {
                            if ($(this).hasClass('active'))
                              return

                            let sourceIP = $(this).attr('data-source'),
                              isFieldSource = true

                            try {
                              isFieldSource = activitesTabulatorObject.getColumnDefinitions().find((field) => field.title === 'Source') != undefined
                            } catch (e) {}

                            $(`div.sources[id="_${sourcesContainerID}"]`).children('button').each(function() {
                              try {
                                activitesTabulatorObject.removeFilter(!isFieldSource ? 'source' : 'Source', 'like', $(this).attr('data-source'))
                              } catch (e) {}
                            })

                            if (sourceIP != 'all')
                              activitesTabulatorObject.setFilter(!isFieldSource ? 'source' : 'Source', 'like', sourceIP)

                            $(`div.sources[id="_${sourcesContainerID}"]`).children('button').removeClass('active').addClass('btn-secondary')

                            $(this).removeClass('btn-secondary').addClass('active')

                            let chartData = $(this).data('chart-data')

                            let pieChart = queryTracingChartsObjects[canvasPieChartID],
                              timeLineChart = queryTracingChartsObjects[canvasTimelineID]

                            pieChart.data.labels = chartData.labels
                            pieChart.data.datasets[0].data = chartData.dataset.doughnut
                            pieChart.data.datasets[0].backgroundColor = chartData.backgroundColor

                            pieChart.update()

                            timeLineChart.data.labels = chartData.labels
                            timeLineChart.data.datasets[0].data = chartData.dataset.timeline
                            timeLineChart.data.datasets[0].backgroundColor = chartData.backgroundColor

                            timeLineChart.update()

                            timeLineChart.resetZoom()
                          }

                          {
                            let showAllSourcesBtn = $(this).find(`div.sources[id="_${sourcesContainerID}"]`).children('button[data-source="all"]'),
                              data = {
                                labels: Object.keys(groupedResult),
                                backgroundColor: sourcesColors,
                                dataset: {
                                  timeline: totalSourcesElapsedTime.map((sourceInfo) => [0, sourceInfo.elapsedTime]),
                                  doughnut: totalSourcesElapsedTime.map((sourceInfo) => sourceInfo.elapsedTime)
                                }
                              }

                            showAllSourcesBtn.data('chart-data', data)

                            showAllSourcesBtn.click(handleSourceBtnClick)

                            setTimeout(() => showAllSourcesBtn.trigger('click'), 1000)
                          }

                          setTimeout(() => $(this).find(`button[id="_${zoomResetBtnID}"]`).click(() => queryTracingChartsObjects[canvasTimelineID].resetZoom()))

                          let sourceIndex = 0
                          for (let sourceIP of Object.keys(groupedResult)) {
                            let sourceActivites = groupedResult[sourceIP],
                              dataCenter = '',
                              sourceColor = sourcesColors[sourceIndex],
                              data = {
                                labels: sourceActivites.map((sourceActivity) => sourceActivity.activity),
                                backgroundColor: sourceActivites.map((sourceActivity) => sourceActivity.color),
                                dataset: {
                                  timeline: sourceActivites.map((sourceActivity, index) => {
                                    return {
                                      x: [index == 0 ? 0 : sourceActivites[index - 1].source_elapsed / 1000, sourceActivity.source_elapsed / 1000],
                                      y: index + 1,
                                      id: sourceActivity.id
                                    }
                                  }),
                                  doughnut: sourceActivites.map((sourceActivity, index) => {
                                    return {
                                      value: parseFloat((sourceActivity.source_elapsed / 1000) - (index == 0 ? 0 : sourceActivites[index - 1].source_elapsed / 1000)),
                                      id: sourceActivity.id
                                    }
                                  })
                                }
                              }

                              ++sourceIndex

                            try {
                              dataCenter = dataCenters.find((dataCenter) => dataCenter.address == sourceIP).datacenter
                            } catch (e) {}

                            let element = `
                                      <button type="button" class="btn btn-secondary btn-rounded btn-sm" data-source="${sourceIP}">
                                        <span class="color" style="bottom: 0px; background-color:${sourceColor}"></span>
                                        <span source-ip>${sourceIP}</span>
                                        <span class="badge badge-dark ms-2 rounded-pill" ${dataCenter == '' ? 'hidden' : ''}>${dataCenter}</span>
                                      </button>`

                            $(this).find(`div.sources[id="_${sourcesContainerID}"]`).append($(element).show(function() {
                              $(this).data('chart-data', data)

                              $(this).click(handleSourceBtnClick)
                            }))
                          }
                        }))
                      })
                    }

                    // Restricted-scope variable that will hold all output till new line character is detected
                    let allOutput = '',
                      // Timeout object which will be triggerd in 10ms to check if the prompt is duplicated
                      promptDuplicationTimeout,
                      // Hold all blocks' output to be handled and removed later
                      blocksOutput = [],
                      // Hold all detected sessions' IDs to be used later
                      detectedSessionsID = [],
                      // Flag to tell if an empty line has been found or not
                      isEmptyLineFound = false,
                      isConnectionLost = false,
                      loggedInUsername = '',
                      pageSize = 100

                    // Call the inner function - at the very end of this code block -; to create a pty instance for that connection
                    requestPtyInstanceCreation({
                      cqlshSessionContentID,
                      terminalID,
                      isBasicCQLSHEnabled
                    }, (connectionCqlshObject) => {
                      try {
                        let fetchedPageSize = parseInt(connectionCqlshObject.cql.pagesize)

                        if (!isNaN(fetchedPageSize))
                          pageSize = fetchedPageSize
                      } catch (e) {}
                    })

                    try {
                      IPCRenderer.removeAllListeners(`pty:data:${connectionID}`)
                    } catch (e) {}

                    // Listen to data sent from the pty instance which are fetched from the cqlsh tool
                    IPCRenderer.on(`pty:data:${connectionID}`, (_, data) => {
                      // If the session is paused then nothing would be printed
                      if (isSessionPaused || ['print metadata', 'print cql_desc', 'check connection'].some((command) => `${data.output}`.includes(command)))
                        return

                      // Make sure the given output is string
                      data.output = data.output || ''

                      // Store all received data
                      allOutput += data.output

                      if (isConnectionLost)
                        return

                      try {
                        if (!((['connectionerror:', ',last_host']).some((keyword) => minifyText(allOutput).includes(keyword))))
                          throw 0

                        isConnectionLost = true

                        workareaElement.css({
                          'transition': 'filter 0.5s ease-in-out',
                          'filter': 'grayscale(1)'
                        })

                        showToast(I18next.t('activate connection'), I18next.capitalizeFirstLetter(I18next.replaceData(`failed to finalize the creation of the work area as the connection [b]$data[/b] has been lost. Consider to close this workarea and test the connection before trying again`, [getAttributes(connectionElement, 'data-name')]) + '.'), 'failure')

                        return
                      } catch (e) {}

                      // Check if the received data contains the `tracing session` keyword
                      try {
                        // Match the regular expression and get the session's ID
                        sessionID = (new RegExp('tracing\\s*session\\s*:\\s*(.+)', 'gm')).exec(data.output.toLowerCase())[1]

                        // Push the detected session ID
                        detectedSessionsID.push(manipulateOutput(sessionID))

                        // Remove any duplication
                        detectedSessionsID = [...new Set(detectedSessionsID)]
                      } catch (e) {}

                      // Check if `CQLSH-STARTED` has been received
                      try {
                        // If the keywords haven't been received yet or cqlsh has already been loaded then skip this try-catch block
                        if (!minifyText(data.output).search(minifyText('KEYWORD:CQLSH:STARTED')) || isCQLSHLoaded)
                          throw 0

                        // The CQLSH tool has been loaded
                        isCQLSHLoaded = true

                        // Handle the initialization of the basic terminal and the activation of the switching button
                        setTimeout(function() {
                          // Point at the switching button
                          let switchTerminalBtn = workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find(`div.switch-terminal button`)

                          // Click it to initialize the terminal
                          switchTerminalBtn.trigger('click', true)

                          // Enable the terminal switch button
                          setTimeout(() => switchTerminalBtn.attr('disabled', null), 1000)
                        }, 1000)

                        // Send an `EOL` character to the pty instance
                        IPCRenderer.send('pty:command', {
                          id: connectionID,
                          cmd: ''
                        })

                        // Disable paging for the interactive terminal
                        setTimeout(() => {
                          IPCRenderer.send('pty:command', {
                            id: connectionID,
                            // cmd: 'PAGING OFF;EXPAND OFF;'
                            cmd: 'EXPAND OFF;'
                          })

                          setTimeout(() => {
                            IPCRenderer.send('pty:command', {
                              id: connectionID,
                              cmd: 'CONSISTENCY;SERIAL CONSISTENCY;',
                              blockID: getRandom.id(10)
                            })

                            setTimeout(() => {
                              IPCRenderer.send('pty:command', {
                                id: connectionID,
                                cmd: `PAGING ${pageSize};`,
                                blockID: getRandom.id(10)
                              })

                              setTimeout(() => {
                                IPCRenderer.send('pty:command', {
                                  id: connectionID,
                                  cmd: 'TRACING;',
                                  blockID: getRandom.id(10)
                                })
                              }, 1000)
                            }, 1000)
                          }, 1000)
                        }, 1000)

                        try {
                          loggedInUsername = allOutput.match(/KEYWORD\:USERNAME\:\[(.*?)\]/i)[1]
                        } catch (e) {}

                        {
                          let cassandraUsernameInfoElement = workareaElement.find('div.connection-info').find('div.info[info="cassandra-username"]')

                          try {
                            if (loggedInUsername == undefined || `${loggedInUsername}`.length <= 0)
                              throw 0

                            cassandraUsernameInfoElement.children('div._placeholder').hide()

                            cassandraUsernameInfoElement.children('div.text').text(`${loggedInUsername}`)
                          } catch (e) {}
                        }

                        // Remove the loading class
                        workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).removeClass('loading')

                        // Enable all tabs and their associated sections
                        workareaElement.find('div.connection-tabs').find('li a').removeClass('disabled')

                        try {
                          let metadataDiffContainer = workareaElement.find(`div.tab-pane[tab="metadata-differentiation"]#_${metadataDifferentiationContentID}`)

                          diffEditor = monaco.editor.createDiffEditor(metadataDiffContainer.find(`div.editor-container-all`)[0], {
                            language: 'json', // Set the content's language
                            minimap: {
                              enabled: true
                            },
                            readOnly: true,
                            glyphMargin: true, // This option allows to render an object in the line numbering side
                            suggest: {
                              showFields: false,
                              showFunctions: false
                            },
                            theme: 'vs-dark',
                            scrollBeyondLastLine: true,
                            mouseWheelZoom: true,
                            fontSize: 11
                          })

                          diffEditors.push(diffEditor)
                        } catch (e) {}
                      } catch (e) {}

                      /**
                       * Inner function to check if the metadata has been fetched or not
                       * The declaration was at the very beginning of this code block
                       */
                      checkMetadata = (refresh = false) => {
                        try {
                          // Update `isMetadataFetched` to `true`; so no need to get it again till the user asks to
                          isMetadataFetched = true

                          // Inner function to create either the old or new editor
                          let createEditor = (type, metadata) => {
                            let editor = monaco.editor.createModel(beautifyJSON(metadata, true), 'json')

                            workareaElement.find(`span[data-id="${oldSnapshotNameID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                            workareaElement.find(`span[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                            workareaElement.find(`span[data-id="${newMetadataTimeID}"]`).attr('data-time', `${new Date().getTime()}`)

                            // Return the editor's object
                            return editor
                          }

                          // Get the cluster's metadata
                          Modules.Connections.getMetadata(connectionID, async (metadata) => {
                            try {
                              // Convert the metadata from JSON string to an object
                              try {
                                metadata = JSON.parse(metadata)
                              } catch (e) {
                                try {
                                  if (OS.platform() != 'win32')
                                    throw 0

                                  metadata = metadata.replace(/\\"/g, `\"`)

                                  metadata = JSON.parse(metadata)
                                } catch (e) {}
                              }

                              // Update latest metadata
                              latestMetadata = metadata

                              // Save the latest metadata in the OS keychain
                              try {
                                let snippetsMetadata = latestMetadata.keyspaces.map((keyspace) => {
                                  return {
                                    name: keyspace.name,
                                    tables: [...keyspace.tables, ...keyspace.indexes, ...keyspace.views].map((_object) => _object.name)
                                  }
                                })

                                encryptTextBG(JSON.stringify(snippetsMetadata), `metadata_${connectionID}`)
                              } catch (e) {}

                              {
                                let clusterNameInfoElement = workareaElement.find('div.connection-info').find('div.info[info="cluster-name"]')

                                try {
                                  clusterNameInfoElement.children('div._placeholder').hide()
                                  clusterNameInfoElement.children('div.text').text(`${metadata.cluster_name == undefined || metadata.cluster_name.length <= 0 ? 'Unknown' : metadata.cluster_name}`)
                                } catch (e) {}
                              }

                              // Build the tree view
                              let treeview = await buildTreeview(JSON.parse(JSON.stringify(metadata)), true, getActiveWorkspaceID(), connectionID),
                                // Point at the metadata content's container
                                metadataContent = workareaElement.find(`div.metadata-content[data-id="${metadataContentID}"]`)

                              // Create the tree view of the metadata and hold the returned object
                              jsTreeObject = metadataContent.jstree(treeview)

                              // Disable the selection feature of a tree node
                              jsTreeObject.disableSelection()

                              try {
                                jsTreeObject.unbind('contextmenu')
                                jsTreeObject.unbind('loaded.jstree')
                                jsTreeObject.unbind('search.jstree')
                                jsTreeObject.unbind('after_open.jstree')
                                jsTreeObject.unbind('select_node.jstree')
                                workareaElement.find('div.right-elements div.arrows div.btn').unbind('click')
                              } catch (e) {}

                              try {
                                jsTreeObject.on('loaded.jstree', () => {
                                  setTimeout(() => {
                                    if (metadataContent.data('jstreeLastOpenedNodeID') != undefined && metadataContent.data('jstreeLastOpenedNodeID').length == 32)
                                      jsTreeObject.jstree()._open_to(metadataContent.data('jstreeLastOpenedNodeID'))

                                    if (metadataContent.data('jstreeLastSelectedNodeID') != undefined && metadataContent.data('jstreeLastSelectedNodeID').length == 32)
                                      jsTreeObject.jstree().select_node(metadataContent.data('jstreeLastSelectedNodeID'))
                                  })
                                })
                              } catch (e) {}

                              /**
                               * Create a listener to the event `contextmenu`
                               * This event `contextmenu` is customized for the JSTree plugin
                               */
                              jsTreeObject.on('contextmenu', async function(event) {
                                // Remove the default contextmenu created by the plugin
                                $('.vakata-context').remove()

                                // If connection is lost with the connection then no context-menu would be shown
                                if (isConnectionLost)
                                  return

                                // Point at the right-clicked node
                                let clickedNode = $(event.target)

                                // If the node is not one of the specified types then skip this process
                                if (['a', 'i', 'span'].every((type) => !clickedNode.is(clickedNode)))
                                  return

                                /**
                                 * The main element in the node is the anchor `a`
                                 * If the clicked element is not `a` but `i` or `span` then the `a` is actually their parent
                                 */
                                try {
                                  // If the right-clicked node is an anchor already then skip this try-catch block
                                  if (clickedNode.is('a'))
                                    throw 0

                                  // Point at the clicked element's parent `a`
                                  clickedNode = clickedNode.parent()
                                } catch (e) {}

                                // If after the manipulation the final element is not an anchor or doesn't have a required attribute then skip the process
                                if (!clickedNode.is('a') || clickedNode.attr('allow-right-context') != 'true')
                                  return

                                // If there's no processing element in the anchor then append one
                                if (clickedNode.find('div.processing').length <= 0)
                                  clickedNode.append($(`<div class="processing"></div>`))

                                let [
                                  // Get the target's node name in Cassandra
                                  targetName,
                                  // Get the target's keyspace's name - if it's a table -
                                  keyspaceName,
                                  tableName,
                                  // Get the target's type - cluster, keyspace or table -
                                  nodeType
                                ] = getAttributes(clickedNode, ['name', 'keyspace', 'table', 'type'])

                                // Define the scope to be passed with the request
                                scope = `keyspace>${nodeType == 'keyspace' ? targetName : keyspaceName}${nodeType != 'keyspace' ? 'table>' + targetName : ''}`

                                // If the node type is cluster then only `cluster` is needed as a scope
                                if (nodeType == 'cluster' || nodeType == 'keyspaces')
                                  scope = 'cluster'

                                // If the node type is an index
                                try {
                                  if (nodeType != 'index')
                                    throw 0

                                  // Add the keyspace
                                  scope = `keyspace>${keyspaceName}`

                                  // Add the index's table
                                  scope += `table>${tableName}`

                                  // And finally add the index itself
                                  scope += `index>${targetName}`
                                } catch (e) {}

                                let contextMenu = [{
                                  label: I18next.capitalize(I18next.t('get CQL description')),
                                  submenu: [{
                                      label: I18next.capitalize(I18next.t('display in the work area')),
                                      click: `() => views.main.webContents.send('cql-desc:get', {
                                                    connectionID: '${getAttributes(connectionElement, 'data-id')}',
                                                    scope: '${scope}',
                                                    tabID: '${cqlDescriptionContentID}',
                                                    nodeID: '${getAttributes(clickedNode, 'id')}'
                                                  })`
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('save it as a text file')),
                                      click: `() => views.main.webContents.send('cql-desc:get', {
                                                    connectionID: '${getAttributes(connectionElement, 'data-id')}',
                                                    scope: '${scope}',
                                                    tabID: '${cqlDescriptionContentID}',
                                                    nodeID: '${getAttributes(clickedNode, 'id')}',
                                                    saveAsFile: true
                                                  })`
                                    },
                                  ]
                                }]

                                let commands = {
                                    ddl: [],
                                    dql: [],
                                    dml: [],
                                    dcl: []
                                  },
                                  isSystemKeyspace = false,
                                  replicationStrategy = {},
                                  keyspaceJSONObj = {},
                                  keyspaceUDTs = [],
                                  keyspaceTables = []

                                try {
                                  if (['cluster'].every((type) => nodeType != type))
                                    throw 0

                                  commands.ddl.push({
                                    label: I18next.capitalize(I18next.t('create keyspace')),
                                    action: 'createKeyspace',
                                    click: `() => views.main.webContents.send('create-keyspace', {
                                                datacenters: '${getAttributes(connectionElement, 'data-datacenters')}',
                                                keyspaces: '${JSON.stringify(metadata.keyspaces.map((keyspace) => keyspace.name))}',
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`
                                  })
                                } catch (e) {}

                                try {
                                  if (['keyspace', 'udts-parent', 'udt', 'tables-parent', 'counter-tables-parent', 'table'].every((type) => nodeType != type) || (clickedNode.attr('data-is-virtual') != null && ['keyspace', 'table'].every((type) => nodeType != type)))
                                    throw 0

                                  try {
                                    if (['udt', 'counter-tables-parent', 'tables-parent', 'table'].every((type) => !nodeType.includes(type)))
                                      throw 0

                                    if (nodeType != 'table')
                                      contextMenu = []

                                    targetName = keyspaceName
                                  } catch (e) {}

                                  let keyspaceInfo = metadata.keyspaces.find((keyspace) => keyspace.name == targetName)

                                  isSystemKeyspace = Modules.Consts.CassandraSystemKeyspaces.some((keyspace) => keyspace == keyspaceInfo.name)

                                  try {
                                    $('#rightClickActionsMetadata').attr('data-keyspace-info', `${JSON.stringify(keyspaceInfo)}`)
                                  } catch (e) {}

                                  replicationStrategy = JSON.parse(repairJSONString(`${keyspaceInfo.replication_strategy}`) || `{}`)

                                  keyspaceJSONObj = metadata.keyspaces.find((keyspace) => keyspace.name == targetName)

                                  keyspaceUDTs = keyspaceJSONObj.user_types

                                  keyspaceTables = (keyspaceJSONObj.tables || []).map((table) => table.name)

                                  if ((replicationStrategy || {}).class == 'LocalStrategy')
                                    throw 0

                                  if (contextMenu.length != 0)
                                    contextMenu = contextMenu.concat([{
                                      type: 'separator',
                                    }])

                                  commands.ddl = commands.ddl.concat([{
                                      label: I18next.capitalize(I18next.t('create UDT')),
                                      action: 'createUDT',
                                      click: `() => views.main.webContents.send('create-udt', {
                                                keyspaceName: '${targetName}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                numOfUDTs: ${keyspaceUDTs.length},
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: !isSystemKeyspace && ['keyspace', 'udts-parent'].some((type) => nodeType == type),
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('create table')),
                                      action: 'createStandardTable',
                                      click: `() => views.main.webContents.send('create-table', {
                                                keyspaceName: '${targetName}',
                                                tables: '${JSON.stringify(keyspaceTables) || []}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                numOfUDTs: ${keyspaceUDTs.length},
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                                })`,
                                      visible: !isSystemKeyspace && ['keyspace', 'tables-parent'].some((type) => nodeType == type)
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('create counter table')),
                                      action: 'createCounterTable',
                                      click: `() => views.main.webContents.send('create-counter-table', {
                                                keyspaceName: '${targetName}',
                                                tables: '${JSON.stringify(keyspaceTables) || []}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                numOfUDTs: ${keyspaceUDTs.length},
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: !isSystemKeyspace && ['keyspace', 'tables-parent', 'counter-tables-parent'].some((type) => nodeType == type)
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('alter UDT')),
                                      action: 'alterUDT',
                                      click: `() => views.main.webContents.send('alter-udt', {
                                                keyspaceName: '${targetName}',
                                                udtName: '${clickedNode.attr('name')}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                numOfUDTs: ${keyspaceUDTs.length},
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'udt'
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('drop UDT')),
                                      action: 'dropUDT',
                                      click: `() => views.main.webContents.send('drop-udt', {
                                                udtName: '${clickedNode.attr('name')}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${targetName}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'udt'
                                    }
                                  ])

                                  commands.dml = commands.dml.concat([{
                                      label: I18next.capitalize(I18next.t('insert row as JSON')),
                                      action: 'insertRow',
                                      click: `() => views.main.webContents.send('insert-row', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}',
                                                asJSON: 'true'
                                              })`,
                                      visible: nodeType == 'table' && clickedNode.attr('is-counter-table') == 'false'
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('insert row')),
                                      action: 'insertRow',
                                      click: `() => views.main.webContents.send('insert-row', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'table' && clickedNode.attr('is-counter-table') == 'false'
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('increment/decrement counter(s)')),
                                      action: 'incrementDecrementCounter',
                                      click: `() => views.main.webContents.send('insert-row', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: clickedNode.attr('is-counter-table') == 'true'
                                    }
                                  ])

                                  commands.ddl.push({
                                    label: I18next.capitalize(I18next.t('alter table')),
                                    action: 'alterTable',
                                    click: `() => views.main.webContents.send('alter-table', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                numOfUDTs: ${keyspaceUDTs.length},
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                    visible: nodeType == 'table'
                                  })

                                  commands.dml.push({
                                    label: I18next.capitalize(I18next.t('delete row/colum')),
                                    action: 'insertRow',
                                    click: `() => views.main.webContents.send('delete-row-column', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                    visible: nodeType == 'table' && clickedNode.attr('is-counter-table') == 'false'
                                  })

                                  commands.ddl = commands.ddl.concat([{
                                      label: I18next.capitalize(I18next.t('drop table')),
                                      action: 'dropTable',
                                      click: `() => views.main.webContents.send('drop-table', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'table'
                                    }, {
                                      label: I18next.capitalize(I18next.t('truncate table')),
                                      action: 'truncateTable',
                                      click: `() => views.main.webContents.send('truncate-table', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'table'
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('alter keyspace')),
                                      action: 'alterKeyspace',
                                      click: `() => views.main.webContents.send('alter-keyspace', {
                                                datacenters: '${getAttributes(connectionElement, 'data-datacenters')}',
                                                keyspaces: '${JSON.stringify(metadata.keyspaces.map((keyspace) => keyspace.name))}',
                                                keyspaceName: '${targetName}',
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'keyspace'
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('drop keyspace')),
                                      action: 'dropKeyspace',
                                      click: `() => views.main.webContents.send('drop-keyspace', {
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${targetName}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                      visible: nodeType == 'keyspace'
                                    }
                                  ])

                                  if (isSystemKeyspace)
                                    contextMenu = contextMenu.filter((item) => item.action != 'dropKeyspace')
                                } catch (e) {}

                                try {
                                  if ((replicationStrategy || {}).class == 'LocalStrategy' && !isSystemKeyspace)
                                    throw 0

                                  commands.dql.push({
                                    label: I18next.capitalize(I18next.t('select row as JSON')),
                                    action: 'selectRow',
                                    click: `() => views.main.webContents.send('select-row', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}',
                                                asJSON: 'true'
                                              })`,
                                    visible: nodeType == 'table'
                                  }, {
                                    label: I18next.capitalize(I18next.t('select row')),
                                    action: 'selectRow',
                                    click: `() => views.main.webContents.send('select-row', {
                                                tableName: '${clickedNode.attr('name')}',
                                                tables: '${JSON.stringify(keyspaceJSONObj.tables || []).replace(/([^\\])'/g, "$1\\'")}',
                                                udts: '${JSON.stringify(keyspaceUDTs) || []}',
                                                tabID: '_${cqlshSessionContentID}',
                                                keyspaceName: '${keyspaceName}',
                                                isCounterTable: '${clickedNode.attr('is-counter-table')}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`,
                                    visible: nodeType == 'table'
                                  })
                                } catch (e) {}

                                try {
                                  if (nodeType != 'keyspaces')
                                    throw 0

                                  commands.ddl.push({
                                    label: I18next.capitalize(I18next.t('create keyspace')),
                                    action: 'createKeyspace',
                                    click: `() => views.main.webContents.send('create-keyspace', {
                                                datacenters: '${getAttributes(connectionElement, 'data-datacenters')}',
                                                keyspaces: '${JSON.stringify(metadata.keyspaces.map((keyspace) => keyspace.name))}',
                                                tabID: '_${cqlshSessionContentID}',
                                                textareaID: '_${cqlshSessionStatementInputID}',
                                                btnID: '_${executeStatementBtnID}'
                                              })`
                                  })
                                } catch (e) {}

                                if (contextMenu.length > 0 && contextMenu.find((item) => item.type == 'separator') == undefined)
                                  contextMenu = contextMenu.concat([{
                                    type: 'separator',
                                  }])

                                if (clickedNode.attr('data-is-virtual') == 'true') {
                                  commands.ddl = []
                                  commands.dml = []
                                  commands.dcl = []
                                }

                                contextMenu = contextMenu.concat([{
                                    label: I18next.capitalize(I18next.t('commands')),
                                    enabled: false
                                  },
                                  {
                                    label: I18next.capitalize(I18next.t('DDL (Data Definition Language)')),
                                    enabled: commands.ddl.length > 0 && commands.ddl.some((command) => command.visible != false),
                                    submenu: commands.ddl
                                  },
                                  {
                                    label: I18next.capitalize(I18next.t('DQL (Data Query Language)')),
                                    enabled: commands.dql.length > 0 && commands.dql.some((command) => command.visible != false),
                                    submenu: commands.dql
                                  },
                                  {
                                    label: I18next.capitalize(I18next.t('DML (Data Manipulation Language)')),
                                    enabled: commands.dml.length > 0 && commands.dml.some((command) => command.visible != false),
                                    submenu: commands.dml
                                  },
                                  {
                                    label: I18next.capitalize(I18next.t('DCL (Data Control Language)')),
                                    enabled: commands.dcl.length > 0 && commands.dcl.some((command) => command.visible != false),
                                    submenu: commands.dcl
                                  }
                                ])

                                try {
                                  if (!['cluster', 'keyspace', 'table'].some((type) => nodeType == type))
                                    throw 0

                                  contextMenu = contextMenu.concat([{
                                      type: 'separator',
                                    },
                                    {
                                      label: I18next.capitalize(I18next.t('features')),
                                      enabled: false
                                    }
                                  ])

                                  let click = ''

                                  if (nodeType == 'cluster')
                                    click = `() => views.main.webContents.send('axonops-integration', {
                                        workareaID: '${workareaElement.attr('workarea-id')}',
                                        connectionID: '${connectionID}',
                                        clusterName: 'cluster'
                                      })`

                                  if (nodeType == 'keyspace')
                                    click = `() => views.main.webContents.send('axonops-integration', {
                                        workareaID: '${workareaElement.attr('workarea-id')}',
                                        connectionID: '${connectionID}',
                                        keyspaceName: '${targetName}'
                                      })`

                                  if (nodeType == 'table')
                                    click = `() => views.main.webContents.send('axonops-integration', {
                                        workareaID: '${workareaElement.attr('workarea-id')}',
                                        connectionID: '${connectionID}',
                                        tableName: '${clickedNode.attr('name')}',
                                        keyspaceName: '${keyspaceName}'
                                      })`

                                  contextMenu = contextMenu.concat([{
                                    label: I18next.capitalize(I18next.replaceData(`view $data dashboard`, [I18next.t(`${nodeType}`)])),
                                    action: 'axonops-integration',
                                    click,
                                    enabled: isAxonOpsIntegrationActionEnabled,
                                    icon: Path.join(__dirname, '..', '..', '..', 'assets', 'images', `axonops-icon-transparent-16x16${!isHostThemeDark ? '-dark' : ''}.png`)
                                  }])

                                  // The snippets feature
                                  contextMenu = contextMenu.concat([{
                                    label: I18next.capitalize(I18next.t(`view related snippets`)),
                                    action: 'cql-snippets',
                                    click: nodeType == 'keyspace' ? `() => views.main.webContents.send('cql-snippets:view', {
                                        workareaID: '${workareaElement.attr('workarea-id')}',
                                        connectionID: '${connectionID}',
                                        keyspaceName: '${targetName}',
                                        workareaID: '${workareaElement.attr('workarea-id')}'
                                        })` : `() => views.main.webContents.send('cql-snippets:view', {
                                          workareaID: '${workareaElement.attr('workarea-id')}',
                                          connectionID: '${connectionID}',
                                          tableName: '${clickedNode.attr('name')}',
                                          keyspaceName: '${keyspaceName}',
                                          workareaID: '${workareaElement.attr('workarea-id')}'
                                        })`,
                                    enabled: nodeType != 'cluster'
                                  }])
                                } catch (e) {}

                                // Send a request to the main thread regards pop-up a menu
                                IPCRenderer.send('show-context-menu', JSON.stringify(contextMenu))
                              })

                              // Handle the search feature in the metadata tree view
                              {
                                // Define the current index of the search results
                                let currentIndex = 0,
                                  // Hold the last search results in an array
                                  lastSearchResults = []

                                // Once a search process is completed
                                jsTreeObject.on('search.jstree', function(event, data) {
                                  try {
                                    // Reset the current index to be the first result
                                    currentIndex = 0

                                    // Hold the search results
                                    lastSearchResults = metadataContent.find('a.jstree-search')

                                    // Remove the click animation class from all results; to be able to execute the animation again
                                    lastSearchResults.removeClass('animate-click')

                                    // Whether or not the search container should be shown
                                    workareaElement.find('div.right-elements').toggleClass('show', data.nodes.length > 0)

                                    // Reset the current result where the pointer has reached
                                    workareaElement.find('div.result-count span.current').text(`1`)

                                    // Set the new number of results
                                    workareaElement.find('div.result-count span.total').text(`${lastSearchResults.length}`)

                                    // If there's at least one result for this search then attempt to click the first result
                                    try {
                                      lastSearchResults[0].click()
                                    } catch (e) {}
                                  } catch (e) {}
                                })

                                jsTreeObject.on('after_open.jstree', function(event, data) {
                                  metadataContent.data('jstreeLastOpenedNodeID', `${data.node.id}`)
                                })

                                jsTreeObject.on('select_node.jstree', function(event, data) {
                                  metadataContent.data('jstreeLastSelectedNodeID', `${data.node.id}`)
                                })

                                // Clicks either the previous or the next buttons/arrows
                                workareaElement.find('div.right-elements div.arrows div.btn').click(function() {
                                  try {
                                    // Increase the index if the clicked button is `next`, otherwise decrease it
                                    currentIndex += $(this).hasClass('next') ? 1 : -1

                                    // If the pointer has reached the first result already then move to the last one
                                    if (currentIndex < 0)
                                      currentIndex = lastSearchResults.length - 1

                                    // If the pointer has reached the last result then move to the first one
                                    if (currentIndex > lastSearchResults.length - 1)
                                      currentIndex = 0

                                    // Update the current index text
                                    workareaElement.find('div.result-count span.current').text(`${currentIndex + 1}`)

                                    // Attempt to click the reached result
                                    lastSearchResults[currentIndex].click()

                                    // Remove the click animation class from the reached result
                                    $(lastSearchResults[currentIndex]).removeClass('animate-click')

                                    // Add the click animation class to the reached result
                                    setTimeout(() => $(lastSearchResults[currentIndex]).addClass('animate-click'), 50)
                                  } catch (e) {}
                                })
                              }

                              // This try-catch block is for initializing the metadata differentiation after getting the metadata
                              try {
                                // If this is a refresh then skip this try-catch block
                                if (refresh)
                                  throw 0

                                setTimeout(() => {
                                  // Get the newest/latest saved snapshot for the connection
                                  Modules.Connections.getNewestSnapshot(Path.join(getWorkspaceFolderPath(workspaceID), getAttributes(connectionElement, 'data-folder')), (snapshot) => {
                                    // The metadata to be loaded is by default the recently fetched one
                                    let toBeLoadedMetadata = metadata

                                    try {
                                      // If there's a saved snapshot then get its content
                                      if (snapshot.content != undefined)
                                        toBeLoadedMetadata = snapshot.content

                                      // Parse the content from JSON string to object
                                      toBeLoadedMetadata = JSON.parse(toBeLoadedMetadata)

                                      let snapshotTakenTime = ''

                                      try {
                                        snapshotTakenTime = toBeLoadedMetadata.time

                                        delete toBeLoadedMetadata.time
                                      } catch (e) {}

                                      try {
                                        if (snapshotTakenTime.length <= 0)
                                          throw 0

                                        snapshotTakenTime = ` (${formatTimestamp(snapshotTakenTime)})`
                                      } catch (e) {}

                                      // The old side's badge will be updated with the snapshot name
                                      setTimeout(() => {
                                        workareaElement.find(`span.old-snapshot[data-id="${oldSnapshotNameID}"]`).text(`: 11${snapshot.name}${snapshotTakenTime}`)
                                      }, 1000);

                                      // The new side's badge will be updated with fetched time of the latest metadata
                                      workareaElement.find(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)

                                      workareaElement.find(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).attr('data-time', `${new Date().getTime()}`)
                                    } catch (e) {}

                                    // Create an editor for the old metadata content
                                    metadataDiffEditors.old.object = createEditor('old', toBeLoadedMetadata)

                                    // Create an editor for the new metadata content
                                    metadataDiffEditors.new.object = createEditor('new', metadata)

                                    diffEditor.setModel({
                                      original: metadataDiffEditors.old.object,
                                      modified: metadataDiffEditors.new.object
                                    })

                                    diffEditor.onDidUpdateDiff(function() {
                                      // Point at the results
                                      let result = diffEditor.getLineChanges(),
                                        // Point at the differentiation show button000
                                        differentiationBtn = workareaElement.find(`span.btn[data-id="${showDifferentiationBtnID}"]`),
                                        // Point at the changes/differences container
                                        changesContainer = workareaElement.find(`div.changes-lines[data-id="${changesLinesContainerID}"]`)

                                      // Update the number of detected changes
                                      differentiationBtn.attr('data-changes', result.length)

                                      // Update the button's text by showing the number of detected changes
                                      differentiationBtn.children('span').filter(':last').text(result.length); // This semicolon is critical here

                                      workareaElement.find(`span.btn[data-id="${diffNavigationPrevBtnID}"]`).add(workareaElement.find(`span.btn[data-id="${diffNavigationNextBtnID}"]`)).toggleClass('disabled', result.length <= 0)

                                      // If there's no detected change then end the process
                                      if (result.length <= 0)
                                        return

                                      // Remove all previous changed lines from the changes' container
                                      changesContainer.children('div.line').remove()

                                      // Loop through each change in the content
                                      result.forEach((change) => {
                                        // Line UI element structure
                                        let element = `
                                                     <div class="line" data-number="${change.originalStartLineNumber}">
                                                       <span class="number">${change.originalStartLineNumber}</span>
                                                       <span class="content">${metadataDiffEditors.old.object.getLineContent(change.originalStartLineNumber)}</span>
                                                     </div>`

                                        // Append the line element to the container
                                        changesContainer.append($(element).click(function() {
                                          // Get the line's number
                                          let lineNumber = parseInt($(this).attr('data-number')); // This semicolon is critical here

                                          try {
                                            diffEditor.revealLineInCenter(lineNumber)
                                          } catch (e) {}
                                        }))
                                      }) // This semicolon is critical here
                                    })

                                    // Update its layout
                                    setTimeout(() => diffEditor.layout(), 200)

                                    /**
                                     * Create a resize observer for the work area body element
                                     * By doing this the editor's dimensions will always fit with the dialog's dimensions
                                     */
                                    setTimeout(() => {
                                      (new ResizeObserver(() => {
                                        try {
                                          diffEditor.layout()
                                        } catch (e) {}
                                      })).observe(workareaElement[0])
                                    })

                                    // // Detect differentiation between old and new content
                                    // detectDifferentiationShow(toBeLoadedMetadata, metadata)
                                  })

                                })
                              } catch (e) {
                                try {
                                  errorLog(e, 'connections')
                                } catch (e) {}
                              }

                              // Hide the loading indicator in the tree view section
                              setTimeout(() => {
                                metadataContent.parent().removeClass('loading')

                                let cqlSnippetsButton = workareaElement.find('div.session-action[action="cql-snippets"]').find('button.btn')

                                cqlSnippetsButton.removeClass('disabled')
                                cqlSnippetsButton.attr('disabled', null)
                              }, 150)
                            } catch (e) {
                              try {
                                errorLog(e, 'connections')
                              } catch (e) {}
                            }
                          })
                        } catch (e) {
                          try {
                            errorLog(e, 'connections')
                          } catch (e) {}
                        }
                      }
                      // End of the check metadata function

                      // Determine whether or not the metadata function will be called
                      try {
                        // If the cqlsh prompt hasn't been found in the received data or cqlsh is not loaded yet then the work area isn't ready to get metadata
                        if ((new RegExp('cqlsh\s*(\:|\s*)(.+|\s*)\>')).exec(data.output) == null || !isCQLSHLoaded)
                          throw 0

                        // If metadata hasn't been got yet
                        if (!isMetadataFetched) {
                          // Call the metadata function
                          checkMetadata()

                          // Skip the upcoming code in this try-catch block
                          throw 0
                        }
                      } catch (e) {}

                      /**
                       * For the app's terminal
                       *
                       * Get cqlsh current prompt - for instance; `cqlsh>` -
                       */
                      let prompt = data.output.match(/^(.*?cqlsh.*?>)/gm),
                        // Update the active prefix to be used
                        activePrefix = prefix

                      /**
                       * The upcoming block is about the interactive terminal
                       *
                       * Whether or not the output is related to paging process
                       */
                      let isOutputWithPaging = data.output.indexOf('KEYWORD:PAGING:CONTINUE') != -1,
                        // Whether or not the output has been completed
                        isOutputCompleted = data.output.indexOf('KEYWORD:OUTPUT:COMPLETED:ALL') != -1,
                        // Whether or not this output is incomplete
                        isOutputIncomplete = allOutput.endsWith('KEYWORD:STATEMENT:INCOMPLETE'),
                        // Whether or not this output is ignored
                        isOutputIgnored = data.output.indexOf('KEYWORD:STATEMENT:IGNORE') != -1,
                        // Define the variable that will hold a timeout to refresh the metadata content
                        refreshMetadataTimeout

                      try {
                        // If the given `blockID` is empty - the execution has not been called from the interactive terminal - then skip this try-catch block
                        if (minifyText(`${data.blockID}`).length <= 0)
                          throw 0

                        // Point at the associated block element in the interactive terminal
                        let blockElement = workareaElement.find(`div.interactive-terminal-container div.session-content div.block[data-id="${data.blockID}"]`),
                          // Get the block's statement/command
                          blockStatement = blockElement.find('div.statement div.text').text(),
                          // Define the content of the `no-output` element
                          noOutputElement = '<no-output><span mulang="CQL statement executed" capitalize-first></span>.</no-output>',
                          isSourceCommand = blockElement.attr('data-is-source-command') != undefined

                        if (isOutputWithPaging && !isOutputCompleted)
                          blockElement.attr('data-is-paging', 'true')

                        isOutputWithPaging = isOutputWithPaging || blockElement.attr('data-is-paging') != undefined

                        try {
                          isOutputIncomplete = (isSourceCommand ? !(allOutput.includes('KEYWORD:OUTPUT:SOURCE:COMPLETED')) : isOutputIncomplete) || isOutputWithPaging
                        } catch (e) {}

                        // Update the block's output
                        blocksOutput[data.blockID] = `${blocksOutput[data.blockID] || ''}${data.output}`

                        // Define the final content to be manipulated and rendered
                        finalContent = blocksOutput[data.blockID]

                        // Get the identifiers detected in the statements
                        let statementsIdentifiers = [],
                          statementsStNextIdentifiers = [],
                          statementsNdNextIdentifiers = []

                        try {
                          // Get the detected identifiers
                          statementsIdentifiers = finalContent.match(/KEYWORD\:STATEMENTS\:IDENTIFIERS\:\[(.*?)\]/i)[1].split(',')
                          // Manipulate them
                          statementsIdentifiers = statementsIdentifiers.map((identifier) => identifier.trim())
                        } catch (e) {}

                        try {
                          statementsStNextIdentifiers = finalContent.match(/KEYWORD\:STATEMENTS\:IDENTIFIERS\:\[.*?\]\[(.*?)\]/i)[1].split(',')
                          statementsStNextIdentifiers = statementsStNextIdentifiers.map((identifier) => identifier.trim())
                        } catch (e) {}

                        try {
                          statementsNdNextIdentifiers = finalContent.match(/KEYWORD\:STATEMENTS\:IDENTIFIERS\:\[.*?\]\[.*?\]\[(.*?)\]/i)[1].split(',')
                          statementsNdNextIdentifiers = statementsNdNextIdentifiers.map((identifier) => identifier.trim())
                        } catch (e) {}

                        // Handle if the statement's execution process has stopped
                        try {
                          // Toggle the `busy` state of the execution button
                          workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').toggleClass('busy', isOutputIncomplete)

                          // Attempt to clear the killing process button showing state
                          try {
                            clearTimeout(killProcessTimeout)
                          } catch (e) {}

                          // Hide the button if there's no incomplete output
                          if (!isOutputIncomplete)
                            hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                          // There's an incomplete output
                          if (isOutputIncomplete)
                            killProcessTimeout = setTimeout(() => {
                              killProcessBtn.parent().addClass('show')

                              workareaElement.find('div.session-actions').find('button').attr('disabled', 'true')
                              workareaElement.find('.disableable').addClass('disabled')
                              workareaElement.addClass('busy-cqlsh')

                              if (!isOutputWithPaging)
                                setTimeout(() => hintsContainer.addClass('show'), 1000)
                            }, 1500)
                        } catch (e) {}

                        try {
                          if (!isOutputIgnored || blockElement.children('div.output').find('div.incomplete-statement').length != 0)
                            throw 0

                          // The sub output structure UI
                          let element = `
                                         <div class="sub-output info incomplete-statement">
                                           <div class="sub-output-content"><span mulang="incomplete statement has been detected and stopped the execution flow" capitalize-first></span>.</div>
                                         </div>`

                          blockElement.children('div.output').children('div.executing').hide()

                          // Append a `sub-output` element in the output's container
                          blockElement.children('div.output').append($(element).show(function() {
                            workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').addClass('busy')

                            // Apply the chosen language on the UI element after being fully loaded
                            setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                            // Execute this code whatever the case is
                            setTimeout(() => {
                              // Unbind all events regards the actions' buttons of the block
                              blockElement.find('div.btn[action], div.btn[sub-action]').unbind()

                              // Clicks the copy button; to copy content in JSON string format
                              blockElement.find('div.btn[action="copy"]').click(function() {
                                // Get all sub output elements
                                let allOutputElements = blockElement.find('div.output').find('div.sub-output').find('div.sub-output-content'),
                                  // Initial group of all output inside the block
                                  outputGroup = []

                                // Loop through each sub output
                                allOutputElements.each(function() {
                                  try {
                                    // If the output is not a table then skip this try-catch block
                                    if ($(this).find('div.tabulator').length <= 0)
                                      throw 0

                                    // Push the table's data as JSON
                                    outputGroup.push(Tabulator.findTable($(this).find('div.tabulator')[0])[0].getData())

                                    // Skip the upcoming code
                                    return
                                  } catch (e) {}

                                  // Just get the output's text
                                  outputGroup.push($(this).text())
                                })

                                // Get the beautified version of the block's content
                                let contentBeautified = beautifyJSON({
                                    statement: blockElement.find('div.statement div.text').text() || 'No statement',
                                    output: outputGroup
                                  }),
                                  // Get the content's size
                                  contentSize = Bytes(ValueSize(contentBeautified))

                                // Copy content to the clipboard
                                try {
                                  Clipboard.writeText(contentBeautified)
                                } catch (e) {
                                  try {
                                    errorLog(e, 'connections')
                                  } catch (e) {}
                                }

                                // Give feedback to the user
                                showToast(I18next.capitalize(I18next.t('copy content')), I18next.capitalizeFirstLetter(I18next.replaceData('content has been copied to the clipboard, the size is $data', [contentSize])) + '.', 'success')
                              })

                              // Clicks the deletion button
                              blockElement.find('div.btn[action="delete"]').click(() => {
                                let queriesContainer = workareaElement.find(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`)

                                setTimeout(function() {
                                  // Remove related query tracing element if exists
                                  blockElement.find('div.btn[sub-action="tracing"]').each(function() {
                                    workareaElement.find(`div.queries div.query[data-session-id="${$(this).attr('data-session-id')}"]`).remove()
                                  })

                                  // If there's still one query tracing result then skip this try-catch block
                                  try {
                                    if (queriesContainer.find('div.query').length > 0)
                                      throw 0

                                    // Show the emptiness class
                                    queriesContainer.addClass('_empty')
                                  } catch (e) {}
                                }, 500)

                                // Remove the block from the session
                                blockElement.remove()

                                try {
                                  // Point at the session's statements' container
                                  let sessionContainer = workareaElement.find(`#_${cqlshSessionContentID}_container`)

                                  // If there's still one block then skip this try-catch block
                                  if (sessionContainer.find('div.block').length > 0)
                                    throw 0

                                  // Show the emptiness class
                                  sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                                } catch (e) {}
                              })
                            })

                            setTimeout(() => {
                              try {
                                blockElement.parent().animate({
                                  scrollTop: blockElement.parent().get(0).scrollHeight
                                }, 100)
                              } catch (e) {}
                            }, 500)
                          }))

                          return
                        } catch (e) {}

                        // If no output has been detected then skip this try-catch block
                        if (['KEYWORD:OUTPUT:COMPLETED:ALL', 'KEYWORD:PAGING:CONTINUE'].every((keyword) => !finalContent.includes(keyword)))
                          throw 0

                        // Get the detected output of each statement
                        let detectedOutput

                        if (finalContent.includes('KEYWORD:OUTPUT:COMPLETED:ALL')) {
                          detectedOutput = finalContent.match(/([\s\S]*?)KEYWORD:OUTPUT:COMPLETED:ALL/gm)

                          blockElement.attr('data-is-paging-completed', 'true')

                          let nextPageBtn = blockElement.find('button[data-action="next-page"]')

                          nextPageBtn.find('[spinner]').hide()
                          nextPageBtn.attr('disabled', null)

                          nextPageBtn.parent().find('button[data-page="last"]').removeClass('hidden')

                          try {
                            clearTimeout(killProcessTimeout)
                          } catch (e) {}

                          setTimeout(() => {
                            workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute button').parent().removeClass('busy')

                            workareaElement.find('div.session-actions').find(`div.session-action${(Store.get(connectionID) || []).length <= 0 ? ':not([action="history"])' : ''}`).find('button').attr('disabled', null)
                            workareaElement.find('.disableable').removeClass('disabled')
                            workareaElement.removeClass('busy-cqlsh')

                            killProcessBtn.parent().removeClass('show')
                          }, 2000)
                        } else {
                          detectedOutput = finalContent.match(/([\s\S]*?)KEYWORD:PAGING:CONTINUE/gm)
                        }

                        // Handle all statements and their output
                        try {
                          // Loop through each detected output
                          for (let output of detectedOutput) {
                            // Make sure to remove the current handled output
                            blocksOutput[data.blockID] = blocksOutput[data.blockID].replace(output, '')

                            // Point at the output's container
                            let outputContainer = blockElement.children('div.output'),
                              // Define a regex to match each output of each statement
                              statementOutputRegex = /KEYWORD:OUTPUT:STARTED([\s\S]*?)(KEYWORD:OUTPUT:COMPLETED|KEYWORD:PAGING:CONTINUE)/gm,
                              // Define variable to initially hold the regex's match
                              matches,
                              // The index of loop's pointer
                              loopIndex = -1

                            try {
                              let tableObj = blockElement.data('tableObj')

                              if (`${output}`.indexOf('KEYWORD:JSON:STARTED') <= -1 || tableObj == undefined)
                                throw 0

                              jsonString = `${output}`.match(/KEYWORD:JSON:STARTED\s*([\s\S]+)\s*KEYWORD:JSON:COMPLETED/)[1]

                              jsonString = jsonString.replace(/KEYWORD:TABLEMETA:INFO:\[.+\]/, '')

                              if (tableObj != undefined) {
                                convertJSONToTable(jsonString, (newPage) => {
                                  tableObj.blockRedraw()
                                  tableObj.addData(newPage.json, false).then(() => {
                                    tableObj.restoreRedraw()

                                    tableObj.setPage(tableObj.getPageMax())

                                    let nextPageBtn = blockElement.find('button[data-action="next-page"]')

                                    nextPageBtn.find('[spinner]').hide()
                                    nextPageBtn.attr('disabled', null)
                                  })
                                })

                                return
                              }
                            } catch (e) {}

                            // Loop through the final content and match output
                            while ((matches = statementOutputRegex.exec(output)) !== null) {
                              // Increase the loop; to match the identifier of the current output's statement
                              loopIndex = loopIndex + 1

                              // Point at the current identifier
                              let statementIdentifier = statementsIdentifiers[loopIndex],
                                statementsStNextIdentifier = statementsStNextIdentifiers[loopIndex],
                                statementsNdNextIdentifier = statementsNdNextIdentifiers[loopIndex]

                              // Avoid infinite loops with zero-width matches
                              if (matches.index === statementOutputRegex.lastIndex)
                                statementOutputRegex.lastIndex++

                              // Loop through each matched part of the output
                              matches.forEach((match, groupIndex) => {
                                // Ignore specific group
                                if (groupIndex != 1)
                                  return

                                // Whether or not an error has been found in the output
                                let isErrorFound = `${match}`.indexOf('KEYWORD:ERROR:STARTED') != -1,
                                  isOutputInfo = `${match}`.indexOf('[OUTPUT:INFO]') != -1

                                // Refresh the latest metadata based on specific actions and only if no erorr has occurred
                                try {
                                  if (['alter', 'create', 'drop'].some((type) => statementIdentifier.toLowerCase().indexOf(type) != -1 && !isErrorFound)) {
                                    // Make sure the statement is not about specific actions
                                    if (['role', 'user'].some((identifier) => statementsStNextIdentifier.toLowerCase().indexOf(identifier) != -1))
                                      throw 0

                                    // Make sure to clear the previous timeout
                                    try {
                                      clearTimeout(refreshMetadataTimeout)
                                    } catch (e) {}

                                    // Set the timeout to be triggerd and refresh the metadata
                                    refreshMetadataTimeout = setTimeout(() => workareaElement.find(`div.btn[data-id="${refreshMetadataBtnID}"]`).click(), 1000)
                                  }
                                } catch (e) {}

                                try {
                                  if (!(['select'].some((type) => statementIdentifier.toLowerCase().indexOf(type) != -1)))
                                    throw 0

                                  noOutputElement = '<no-output><span mulang="CQL statement executed" capitalize-first></span> - <span mulang="no data found" capitalize-first></span>.</no-output>'
                                } catch (e) {}

                                try {
                                  if (`${statementIdentifier}`.toLowerCase() != 'begin' || !([statementsStNextIdentifier, statementsNdNextIdentifier].some((identifier) => `${identifier}`.toLowerCase() == 'batch')))
                                    throw 0

                                  noOutputElement = '<no-output>Batch <span mulang="CQL statement executed" capitalize-first></span>.</no-output>'
                                } catch (e) {}

                                let isOutputHighlighted = false

                                try {
                                  isOutputHighlighted = (['desc', 'describe'].some((type) => statementIdentifier.toLowerCase().indexOf(type) != -1 && !isErrorFound))
                                } catch (e) {}

                                try {
                                  if (!isOutputHighlighted)
                                    throw 0

                                  match = Highlight.highlight(match, {
                                    language: 'cql'
                                  }).value
                                } catch (e) {}

                                let isConsistencyCommand = false

                                // For consistency
                                try {
                                  if (!((['consistency', 'serial']).some((command) => minifyText(statementIdentifier) == command)))
                                    throw 0

                                  let consistencyType = minifyText(statementIdentifier),
                                    setConsistency = `${match}`.trim()

                                  try {
                                    setConsistency = setConsistency.match(/\s+([A-Z_]+)\.$/g)[0].trim().replace(/\./g, '')
                                  } catch (e) {}

                                  try {
                                    let consistencyLevels = Modules.Consts.ConsistencyLevels[consistencyType == 'consistency' ? 'Regular' : 'Serial']

                                    if (!(consistencyLevels.some((level) => level == setConsistency)))
                                      throw 0

                                    let consistencyAction = workareaElement.find('div.session-action.consistency-level[action="consistency-level"]')

                                    if (consistencyAction.css('display') == 'none')
                                      consistencyAction.fadeIn('fast')

                                    consistencyAction.children('button').find(`b[${consistencyType == 'consistency' ? 'standard' : 'serial'}]`).text(setConsistency)

                                    if (activeSessionsConsistencyLevels[activeConnectionID] == undefined)
                                      activeSessionsConsistencyLevels[activeConnectionID] = {
                                        standard: '',
                                        serial: ''
                                      }

                                    activeSessionsConsistencyLevels[activeConnectionID][consistencyType == 'consistency' ? 'standard' : 'serial'] = setConsistency

                                    isConsistencyCommand = true
                                  } catch (e) {}
                                } catch (e) {}

                                // For paging
                                try {
                                  if (minifyText(statementIdentifier) != 'paging')
                                    throw 0

                                  let paginationAction = workareaElement.find('div.session-action.pagination-size[action="pagination-size"]')

                                  if (`${match}`.includes('OFF')) {
                                    paginationAction.fadeOut('fast')
                                    throw 0
                                  }

                                  // Make sure paging is ON
                                  if (!(`${match}`.includes('ON')) && isNaN(parseInt(statementsStNextIdentifier)))
                                    throw 0

                                  let detectedPagingSize = parseInt(`${match}`.match(/size\:\s*(\d+)/)[1])

                                  if (isNaN(detectedPagingSize))
                                    throw 0

                                  activeSessionsPaginationSize = detectedPagingSize

                                  if (paginationAction.css('display') == 'none')
                                    paginationAction.fadeIn('fast')

                                  try {
                                    detectedPagingSize = detectedPagingSize.format()
                                  } catch (e) {}

                                  paginationAction.find(`span.size`).text(`${detectedPagingSize}`)
                                } catch (e) {}

                                // For paging
                                try {
                                  if (minifyText(statementIdentifier) != 'tracing')
                                    throw 0

                                  let queryTracingAction = workareaElement.find('div.session-action.query-tracing[action="query-tracing"]')

                                  if (queryTracingAction.css('display') == 'none')
                                    queryTracingAction.fadeIn('fast')

                                  let isTracingEnabled = `${match}`.includes('ON')

                                  queryTracingAction.data('tracingStatus', isTracingEnabled)

                                  queryTracingAction.find(`span.staus`).text(`${isTracingEnabled ? 'ON' : 'OFF'}`)
                                } catch (e) {}

                                // The sub output structure UI
                                let element = `
                                         <div class="sub-output ${isErrorFound ? 'error' : ''} ${isOutputInfo ? 'info': ''}">
                                           <div class="general-hint select-rows">
                                            <ion-icon name="info-circle-outline" class="hint-icon no-select"></ion-icon> To perform a range selection hold <kbd>SHIFT</kbd> key and click on the end row, also, hold <kbd>CTRL</kbd> key and click on a row to deselect it.
                                           </div>
                                           <div class="sub-output-content"></div>
                                           <div class="sub-actions" hidden>
                                             <div class="sub-action btn btn-tertiary" data-mdb-ripple-color="dark" sub-action="download" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="download the block" capitalize-first>
                                               <ion-icon name="download"></ion-icon>
                                             </div>
                                             <div class="download-options">
                                               <div class="option btn btn-tertiary" option="csv" data-mdb-ripple-color="dark">
                                                 <ion-icon name="csv"></ion-icon>
                                               </div>
                                               <div class="option btn btn-tertiary" option="pdf" data-mdb-ripple-color="dark">
                                                 <ion-icon name="pdf"></ion-icon>
                                               </div>
                                             </div>
                                             <div class="sub-action btn btn-tertiary disabled" data-mdb-ripple-color="dark" sub-action="tracing" data-tippy="tooltip" data-mdb-placement="bottom" data-title data-mulang="trace the query" capitalize-first>
                                               <ion-icon name="query-tracing"></ion-icon>
                                             </div>
                                           </div>
                                         </div>`

                                outputContainer.children('div.executing').hide()

                                // Append a `sub-output` element in the output's container
                                outputContainer.append($(element).show(function() {
                                  // Point at the appended element
                                  let outputElement = $(this)

                                  // Apply the chosen language on the UI element after being fully loaded
                                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                                  // If the number of executed statements are more than `1` then show a badge indicates that
                                  setTimeout(() => {
                                    try {
                                      // Get the number of statements in the current block based on how many sub output elements exist
                                      let numberOfStatements = outputContainer.find('div.sub-output').length

                                      // If it's less than `2` then hide the badge
                                      if (numberOfStatements < 2)
                                        throw 0

                                      // Show the badge with the number of statements
                                      blockElement.find('div.statements-count').text(`${numberOfStatements} statements`).hide().fadeIn('fast')
                                    } catch (e) {
                                      // Hide the badge
                                      blockElement.find('div.statements-count').hide()
                                    }
                                  }, 500)

                                  /**
                                   * Reaching here with `match` means this is an output to be rendered
                                   *
                                   * Manipulate the content
                                   * Remove any given prompts within the output
                                   */
                                  match = match.replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')
                                    // Remove the statement from the output
                                    .replace(new RegExp(quoteForRegex(blockElement.children('div.statement').text()), 'g'), '')
                                    // Get rid of tracing results
                                    .replace(/Tracing\s*session\:[\S\s]+/gi, '')
                                    // Trim the output
                                    .trim()

                                  // Make sure to show the emptiness message if the output is empty
                                  if (minifyText(match).replace(/nooutputreceived\./g, '').length <= 0)
                                    match = noOutputElement

                                  // Define the JSON string which will be updated if the output has valid JSON block
                                  let jsonString = '',
                                    // Define the tabulator object if one is created
                                    tabulatorObject = null,
                                    connectionLost = `${match}`.indexOf('NoHostAvailable:') != -1,
                                    isJSONKeywordFound = `${statementsStNextIdentifier}`.toLowerCase().indexOf('json') != -1

                                  try {
                                    if (!isJSONKeywordFound)
                                      throw 0

                                    outputElement.find('div.sub-actions').attr('hidden', null)

                                    outputElement.find('div.sub-actions').css('width', '30px')

                                    outputElement.find('div.sub-actions').children('div.sub-action[sub-action="download"]').hide()

                                    outputElement.addClass('actions-shown')
                                  } catch (e) {}

                                  // Handle if the content has JSON string
                                  try {
                                    // If the statement is not `SELECT` or 'DELETE' then don't attempt to render a table
                                    // if (['select', 'delete', 'create', 'insert'].every((command) => statementIdentifier.toLowerCase().indexOf(command) <= -1) || isJSONKeywordFound || connectionLost)
                                    if (isJSONKeywordFound || connectionLost)
                                      throw 0

                                    if (`${match}`.indexOf('KEYWORD:JSON:STARTED') <= -1)
                                      throw 0

                                    jsonString = `${match}`.match(/KEYWORD:JSON:STARTED\s*([\s\S]+)\s*KEYWORD:JSON:COMPLETED/)[1]

                                    let selectorTableInfo = ''
                                    try {
                                      if (!jsonString.includes('KEYWORD:TABLEMETA:INFO'))
                                        throw 0

                                      selectorTableInfo = jsonString.match(/KEYWORD:TABLEMETA:INFO:\[(.+)\]/)[1]

                                      jsonString = jsonString.replace(/KEYWORD:TABLEMETA:INFO:\[.+\]/, '')
                                    } catch (e) {}

                                    // Convert the JSON string to HTML table related to a Tabulator object
                                    convertTableToTabulator(jsonString, outputElement.find('div.sub-output-content'), activeSessionsPaginationSize || 50, false, (_tabulatorObject) => {
                                      // As a tabulator object has been created add the associated class
                                      outputElement.find('div.sub-actions').attr('hidden', null)

                                      outputElement.addClass('actions-shown')

                                      // Hold the created object
                                      tabulatorObject = _tabulatorObject

                                      tabulatorObject.selectorTableInfo = selectorTableInfo

                                      let paginator = outputElement.find('div.sub-output-content').find('span.tabulator-paginator')

                                      paginator.find('button[data-page="last"], button[data-page="next"]').addClass('hidden')

                                      paginator.find('button[data-page="last"]').before($(`<button class="tabulator-page" data-action="next-page" type="button" role="button" aria-label="Next Page" title="Next Page"><span>Next</span><l-chaotic-orbit spinner style="vertical-align: middle; position: relative; bottom: 1px; margin-left: 5px; display:none; --uib-size: 17px; --uib-color: black; --uib-speed: 0.7s;"></l-chaotic-orbit></button>`).show(function() {
                                        blockElement.data('tableObj', tabulatorObject)

                                        $(this).data('blockID', data.blockID)

                                        $(this).click(function() {
                                          let originalNextBtn = $(this).parent().find('button[data-page="next"]')

                                          if (originalNextBtn.attr('disabled') == undefined || isOutputCompleted || blockElement.attr('data-is-paging-completed') == 'true') {
                                            originalNextBtn.click()
                                            return
                                          }

                                          $(this).find('[spinner]').css('display', 'inline-block')
                                          $(this).attr('disabled', '')

                                          IPCRenderer.send('pty:command', {
                                            id: connectionID,
                                            cmd: '',
                                            blockID: $(this).data('blockID')
                                          })
                                        })
                                      }))

                                      // Add `Select rows in the page` option
                                      let selectPageRowsCheckboxID = `_${getRandom.id()}`

                                      outputElement.find('div.sub-output-content').find('div.tabulator').before($(`
                                      <div class="select-page-rows-container">
                                        <div class="form-check">
                                          <input class="form-check-input" type="checkbox" role="switch" id="${selectPageRowsCheckboxID}">
                                          <label class="form-check-label" for="${selectPageRowsCheckboxID}">
                                            <span mulang="select all rows in the current page" capitalize-first></span>.
                                          </label>
                                        </div>
                                      </div>
                                      `).show(function() {
                                        getElementMDBObject($(this))

                                        setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                                        $(this).find('input').change(function() {
                                          let isChecked = $(this).prop('checked')

                                          tabulatorObject[isChecked ? 'selectRow' : 'deselectRow'](isChecked ? 'visible' : '')
                                        })
                                      }))

                                      tabulatorObject.on('rowContext', function(e, row) {
                                        e.preventDefault()

                                        let selectedRows = tabulatorObject.getSelectedRows()

                                        if (selectedRows.length <= 0)
                                          selectedRows.push(row)

                                        let [keyspaceName, tableName] = tabulatorObject.selectorTableInfo.split('.'),
                                          keyspaceObject = latestMetadata.keyspaces.find((keyspace) => keyspace.name == keyspaceName),
                                          tableObject = keyspaceObject.tables.find((table) => table.name == tableName)

                                        selectedRows = selectedRows.map((selectedRow) => selectedRow._row.data)

                                        let generationInfo = {
                                            keyspaceName,
                                            tableName,
                                            tableObject,
                                            selectedRows
                                          },
                                          tempObjectID = `_${getRandom.id(10)}`

                                        tempObjects[tempObjectID] = generationInfo

                                        IPCRenderer.send('show-context-menu', JSON.stringify([{
                                          label: I18next.capitalizeFirstLetter(`${I18next.t('generate insert statement(s)')}`),
                                          click: `() => views.main.webContents.send('insert-statements:generate', {
                                                    tempObjectID: '${tempObjectID}'
                                                  })`
                                        }]))
                                      })

                                      let handleRowClick = () => {
                                        let selectedRows = tabulatorObject.getSelectedRows(),
                                          hintElement = outputElement.find('div.general-hint.select-rows')

                                        hintElement.toggle(selectedRows.length > 0)
                                      }

                                      tabulatorObject.on('rowSelected', () => handleRowClick())

                                      tabulatorObject.on('rowDeselected', () => handleRowClick())

                                      let clickOutsideEvent,
                                        tabulatorTableContainer = outputElement.find('div.tabulator[id]')

                                      setTimeout(() => tabulatorObject.on('cellClick', function(e, cell) {
                                        try {
                                          tabulatorTableContainer.oneClickOutside('off')
                                        } catch (e) {}

                                        tabulatorTableContainer.addClass('arrows-nav')

                                        tabulatorTableContainer.find('div.tabulator-cell').removeClass('tabulator-editing')

                                        clickOutsideEvent = tabulatorTableContainer.oneClickOutside({
                                          callback: function() {
                                            tabulatorTableContainer.find('div.tabulator-cell').removeClass('tabulator-editing')

                                            tabulatorTableContainer.removeClass('arrows-nav')
                                          },
                                          calledFromClickInsideHandler: true
                                        })

                                        $(cell._cell.element).addClass('tabulator-editing')
                                      }))
                                    })

                                    try {
                                      workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').toggleClass('busy', isOutputIncomplete)

                                      try {
                                        clearTimeout(killProcessTimeout)
                                      } catch (e) {}

                                      if (!isOutputIncomplete)
                                        hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                                      if (isOutputIncomplete)
                                        killProcessTimeout = setTimeout(() => {
                                          killProcessBtn.parent().addClass('show')

                                          workareaElement.find('div.session-actions').find('button').attr('disabled', 'true')
                                          workareaElement.find('.disableable').addClass('disabled')
                                          workareaElement.addClass('busy-cqlsh')

                                          if (!isOutputWithPaging)
                                            setTimeout(() => hintsContainer.addClass('show'), 1000)
                                        }, 1500)
                                    } catch (e) {}

                                    // Show the block
                                    blockElement.show().addClass('show')

                                    // Scroll at the bottom of the blocks' container after each new block
                                    setTimeout(() => {
                                      try {
                                        blockElement.parent().animate({
                                          scrollTop: blockElement.parent().get(0).scrollHeight
                                        }, 100)
                                      } catch (e) {}
                                    }, 100)

                                    // Skip the upcoming code
                                    return
                                  } catch (e) {} finally {
                                    // Execute this code whatever the case is
                                    setTimeout(() => {
                                      // Unbind all events regards the actions' buttons of the block
                                      blockElement.find('div.btn[action], div.btn[sub-action]').unbind()

                                      // Clicks the copy button; to copy content in JSON string format
                                      blockElement.find('div.btn[action="copy"]').click(function() {
                                        // Get all sub output elements
                                        let allOutputElements = blockElement.find('div.output').find('div.sub-output').find('div.sub-output-content'),
                                          // Initial group of all output inside the block
                                          outputGroup = []

                                        // Loop through each sub output
                                        allOutputElements.each(function() {
                                          try {
                                            // If the output is not a table then skip this try-catch block
                                            if ($(this).find('div.tabulator').length <= 0)
                                              throw 0

                                            // Push the table's data as JSON
                                            outputGroup.push(Tabulator.findTable($(this).find('div.tabulator')[0])[0].getData())

                                            // Skip the upcoming code
                                            return
                                          } catch (e) {}

                                          // Just get the output's text
                                          outputGroup.push($(this).text())
                                        })

                                        // Get the beautified version of the block's content
                                        let contentBeautified = beautifyJSON({
                                            statement: blockElement.find('div.statement div.text').text() || 'No statement',
                                            output: outputGroup
                                          }),
                                          // Get the content's size
                                          contentSize = Bytes(ValueSize(contentBeautified))

                                        // Copy content to the clipboard
                                        try {
                                          Clipboard.writeText(contentBeautified)
                                        } catch (e) {
                                          try {
                                            errorLog(e, 'connections')
                                          } catch (e) {}
                                        }

                                        // Give feedback to the user
                                        showToast(I18next.capitalize(I18next.t('copy content')), I18next.capitalizeFirstLetter(I18next.replaceData('content has been copied to the clipboard, the size is $data', [contentSize])) + '.', 'success')
                                      })

                                      // Clicks the download button; to download the tabulator object either as PDF or CSV
                                      outputElement.find('div.btn[sub-action="download"]').click(function() {
                                        // Point at the download options' container
                                        let downloadOptionsElement = outputElement.find('div.download-options'),
                                          // Whether or not the optionss' container is hidden
                                          isOptionsHidden = downloadOptionsElement.css('display') == 'none'

                                        // Show/hide the container
                                        downloadOptionsElement.css('display', isOptionsHidden ? 'flex' : 'none')
                                      })

                                      // Handle the download options
                                      {
                                        // Download the table as CSV
                                        outputElement.find('div.option[option="csv"]').click(() => tabulatorObject.download('csv', 'statement_block.csv'))

                                        // Path.join(getWorkspaceFolderPath(getActiveWorkspaceID()), connectionElement.attr('data-folder'), descriptionFileName)

                                        // Download the table as PDF
                                        outputElement.find('div.option[option="pdf"]').click(() => tabulatorObject.download('pdf', 'statement_block.pdf', {
                                          orientation: 'portrait',
                                          title: `${blockStatement}`,
                                        }))
                                      }

                                      // Handle the clicks of the tracing button
                                      {
                                        // Point at the tracing button
                                        let tracingButton = outputElement.find('div.btn[sub-action="tracing"]')

                                        setTimeout(() => {
                                          // Get the session's tracing ID
                                          let sessionID

                                          try {
                                            sessionID = detectedSessionsID.filter((sessionID) => sessionID != null)[0]
                                          } catch (e) {}

                                          try {
                                            // If there's no session ID exists then skip this try-catch block
                                            if (sessionID == undefined)
                                              throw 0

                                            tracingButton.attr('data-session-id', sessionID)

                                            detectedSessionsID = detectedSessionsID.map((_sessionID) => _sessionID == sessionID ? null : _sessionID)

                                            // Enable the tracing button
                                            tracingButton.removeClass('disabled')

                                            // Add listener to the `click` event
                                            tracingButton.click(() => clickEvent(true, sessionID))
                                          } catch (e) {}
                                        }, 2000)

                                        // Clicks the deletion button
                                        blockElement.find('div.btn[action="delete"]').click(() => {
                                          let queriesContainer = workareaElement.find(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`)

                                          setTimeout(function() {
                                            // Remove related query tracing element if exists
                                            blockElement.find('div.btn[sub-action="tracing"]').each(function() {
                                              workareaElement.find(`div.queries div.query[data-session-id="${$(this).attr('data-session-id')}"]`).remove()
                                            })

                                            // If there's still one query tracing result then skip this try-catch block
                                            try {
                                              if (queriesContainer.find('div.query').length > 0)
                                                throw 0

                                              // Show the emptiness class
                                              queriesContainer.addClass('_empty')
                                            } catch (e) {}
                                          }, 500)

                                          // Remove the block from the session
                                          blockElement.remove()

                                          setTimeout(() => $(window.visualViewport).trigger('resize'))

                                          try {
                                            // Point at the session's statements' container
                                            let sessionContainer = workareaElement.find(`#_${cqlshSessionContentID}_container`)

                                            // If there's still one block then skip this try-catch block
                                            if (sessionContainer.find('div.block').length > 0)
                                              throw 0

                                            // Show the emptiness class
                                            sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                                          } catch (e) {}
                                        })
                                      }
                                    })
                                  }

                                  // Reaching here with JSON keyword means there's a content needs to be handled
                                  try {
                                    if (`${match}`.indexOf('KEYWORD:JSON:STARTED') <= -1)
                                      throw 0

                                    jsonString = `${match}`.match(/KEYWORD:JSON:STARTED\s*([\s\S]+)\s*KEYWORD:JSON:COMPLETED/)[1]

                                    jsonString = jsonString.replace(/KEYWORD:TABLEMETA:INFO:\[.+\]/, '')

                                    if (!pathIsAccessible(`${jsonString.trim()}`))
                                      throw 0

                                    let tempFilePath = `${jsonString.trim()}`

                                    FS.readFile(tempFilePath, 'utf8', (err, data) => {
                                      if (err)
                                        throw 0

                                      match = `${data}`
                                    })
                                  } catch (e) {}

                                  try {
                                    if (OS.platform() != 'win32')
                                      throw 0

                                    match = match.replace(/\n(?![^<]*<\/span>)/gim, '')
                                  } catch (e) {}

                                  // Manipulate the content
                                  match = match.replace(new RegExp(`(${OS.EOL}){2,}`, `g`), OS.EOL)
                                    .replace(createRegex(OS.EOL, 'g'), '<br>')
                                    .replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br>')
                                    .replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')
                                    .replace('[OUTPUT:INFO]', '')
                                    .replace(/\r?\n?KEYWORD:([A-Z0-9]+)(:[A-Z0-9]+)*((-|:)[a-zA-Z0-9\[\]\,]+)*\r?\n?/gmi, '')

                                  // Convert any ANSI characters to HTML characters - especially colors -
                                  match = (new ANSIToHTML()).toHtml(match)

                                  // Reaching here and has a `json` keyword in the output means there's no record/row to be shown
                                  if (StripTags(match).length <= 0)
                                    match = noOutputElement

                                  match = `<pre>${match}</pre>`

                                  // For consistency level
                                  if (isConsistencyCommand)
                                    match = `${match}<div class="consistency-level-enhanced-console-info"><ion-icon name="info-circle-outline" class="management-tools-hint-icon no-select localclusters-dialog"></ion-icon> This consistency will be used for all subsequent queries in this session.</div>`

                                  // Set the final content and make sure the localization process is updated
                                  outputElement.find('div.sub-output-content').html(match).show(function() {
                                    $(this).children('pre').find('br').remove()

                                    // Apply the localization process on elements that support it
                                    setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                                  })
                                }))
                              })
                            }
                          }
                        } catch (e) {}

                        // Show the current active prefix/prompt
                        setTimeout(() => blockElement.find('div.prompt').text(minifyText(prefix).slice(0, -1)).hide().fadeIn('fast'), 1000)

                        try {
                          workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').toggleClass('busy', isOutputIncomplete)

                          try {
                            clearTimeout(killProcessTimeout)
                          } catch (e) {}

                          if (!isOutputIncomplete)
                            hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                          if (isOutputIncomplete)
                            killProcessTimeout = setTimeout(() => {
                              killProcessBtn.parent().addClass('show')

                              workareaElement.find('div.session-actions').find('button').attr('disabled', 'true')
                              workareaElement.find('.disableable').addClass('disabled')
                              workareaElement.addClass('busy-cqlsh')

                              if (!isOutputWithPaging)
                                setTimeout(() => hintsContainer.addClass('show'), 1000)
                            }, 1500)
                        } catch (e) {}

                        // Show the block
                        blockElement.show().addClass('show')

                        // Make sure to scroll at the end of the blocks' container
                        setTimeout(() => {
                          try {
                            blockElement.parent().animate({
                              scrollTop: blockElement.parent().get(0).scrollHeight
                            }, 100)
                          } catch (e) {}
                        }, 100)
                      } catch (e) {}

                      try {
                        // Check if the query tracing feature has been enabled/disabled
                        {
                          // Point at the hint UI element in the query tracing's tab
                          let queryTracingHint = workareaElement.find(`div.tab-pane#_${queryTracingContentID}`).find('hint')

                          // If it has been enabled
                          if (data.output.toLowerCase().indexOf('tracing is enabled') != -1)
                            queryTracingHint.hide()

                          // If it has been disabled
                          if (data.output.toLowerCase().indexOf('disabled tracing') != -1)
                            queryTracingHint.show()
                        }
                      } catch (e) {}

                      // Set the prompt which has been got from cqlsh tool
                      activePrefix = ''

                      try {
                        // If it is `null` then skip this try-catch block
                        if (prompt == null && prompt.search('cqlsh>'))
                          throw 0

                        // Got a prompt, adopt it
                        activePrefix = `${prompt[0]} `
                        prefix = activePrefix
                      } catch (e) {}
                    })
                    // The listener to data sent from the pty instance has been finished

                    try {
                      if (!isBasicCQLSHEnabled)
                        throw 0

                      // Create the terminal instance from the XtermJS constructor
                      terminalObjects[terminalID] = new XTerm({
                        theme: XTermThemes.Atom
                      })

                      // Set the `terminal` variable to be as a reference to the object
                      terminal = terminalObjects[terminalID]

                      // Add log
                      try {
                        addLog(`CQL console created for the connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`)
                      } catch (e) {}

                      /**
                       * Custom terminal options
                       *
                       * Change font family to `JetBrains Mono` and set its size and line height
                       * https://www.jetbrains.com/lp/mono/
                       */
                      terminal.options.fontFamily = `'Terminal', monospace`
                      terminal.options.fontSize = 13
                      terminal.options.lineHeight = 1.35

                      // Enable the cursor blink when the terminal is being focused on
                      terminal._publicOptions.cursorBlink = true

                      try {
                        setTimeout(() => {
                          /**
                           * Define XtermJS addons
                           *
                           * Fit addon; to resize the terminal without distortion
                           */
                          fitAddon = new FitAddon.FitAddon()

                          /**
                           * Load XtermJS addons
                           *
                           * Load the `Fit` addon
                           */
                          terminal.loadAddon(fitAddon)

                          // The terminal now will be shown in the UI
                          terminal.open(workareaElement.find(`div.terminal-container[data-id="${terminalContainerID}"]`)[0])

                          // Load the `Canvas` addon
                          terminal.loadAddon(new CanvasAddon())

                          // Load the `Webfont` addon
                          terminal.loadAddon(new XtermWebFonts())

                          // Fit the terminal with its container
                          setTimeout(() => fitAddon.fit())

                          // Push the fit addon object to the related array
                          terminalFitAddonObjects.push(fitAddon)

                          // Call the fit addon for the terminal
                          setTimeout(() => fitAddon.fit(), 1200)

                          try {
                            IPCRenderer.removeAllListeners(`pty:data-basic:${connectionID}`)
                          } catch (e) {}

                          // Listen to data sent from the pty instance regards the basic terminal
                          IPCRenderer.on(`pty:data-basic:${connectionID}`, (_, data) => {
                            try {
                              // If the session is paused then nothing would be printed
                              if (isSessionPaused)
                                throw 0

                              // Print/write the data to the terminal
                              terminal.write(data.output)
                            } catch (e) {}
                          })

                          /**
                           * Listen to the user's input to the terminal's buffer
                           * This listener will send the character to the pty instance to be handled in realtime
                           *
                           * Point at the terminal's viewport in the UI
                           */
                          let terminalViewport = workareaElement.find(`div.terminal-container[data-id="${terminalContainerID}"]`).find('div.xterm-viewport')[0],
                            // Get the terminal's active buffer; to get the entire written statement if needed
                            terminalBuffer = terminal.buffer.active

                          // Listen to data from the user - input to the terminal -
                          terminal.onData((char) => {
                            // Get the entire written statement
                            let statement = terminalBuffer.getLine(terminalBuffer.baseY + terminalBuffer.cursorY).translateToString(true)

                            // Remove any prefixes
                            statement = statement.replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')

                            // Check if the command is terminating the cqlsh session
                            let isQuitFound = (['quit', 'exit']).some((command) => statement.toLowerCase().startsWith(command)),
                              // Get the key code
                              keyCode = char.charCodeAt(0)

                            try {
                              /**
                               * `quit` or `exit` command will close the connection
                               * If none of them were found then skip this try-catch block
                               */
                              if (!isQuitFound)
                                throw 0

                              // Show feedback to the user
                              printMessageInBasicTerminal(terminal, 'info', `Work area for the connection ${getAttributes(connectionElement, 'data-name')} will be closed in few seconds`)

                              // Pause the print of output from the Pty instance
                              isSessionPaused = true

                              // Dispose the readline addon
                              prefix = ''

                              // Click the close connection button after a while
                              setTimeout(() => workareaElement.find('div.connection-actions div.action[action="close"] div.btn-container div.btn').click(), 2000)
                            } catch (e) {}

                            // Send the character in realtime to the pty instance
                            IPCRenderer.send('pty:data', {
                              id: connectionID,
                              char
                            })

                            // Make sure both the app's UI terminal and the associated pty instance are syned in their size
                            IPCRenderer.send('pty:resize', {
                              id: connectionID,
                              cols: terminal.cols,
                              rows: terminal.rows
                            })

                            // Switch between the key code's values
                            switch (keyCode) {
                              // `ENTER`
                              case 13: {
                                // Scroll to the very bottom of the terminal
                                terminalViewport.scrollTop = terminalViewport.scrollHeight

                                // Resize the terminal
                                fitAddon.fit()
                                break
                              }
                            }
                          })

                          // Listen to custom key event
                          terminal.attachCustomKeyEventHandler((event) => {
                            // Get different values from the event
                            let {
                              key, // The pressed key
                              ctrlKey, // Whether or not the `CTRL` is being pressed
                              shiftKey, // Whether or not the `SHIFT` is being pressed
                              metaKey // Whether or not the `META/WINDOWS/SUPER` key is being pressed
                            } = event

                            // Inner function to prevent the event from performing its defined handler
                            let preventEvent = () => {
                              /**
                               * Prevent the default behavior of pressing the combination
                               * https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault
                               */
                              event.preventDefault()

                              /**
                               * Prevent further propagation of the event in the capturing and bubbling phases
                               * https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation
                               */
                              event.stopPropagation()
                            }

                            // Hande `CTRL+R`
                            try {
                              if (!(ctrlKey && key.toLowerCase() == 'r'))
                                throw 0

                              // Call the inner function
                              preventEvent()

                              // Return `false` to make sure the handler of xtermjs won't be executed
                              return false
                            } catch (e) {}

                            /**
                             * Handle the terminal's buffer clearing process on Windows
                             * `CTRL+L`
                             */
                            try {
                              if (!(ctrlKey && (key.toLowerCase() == 'l')) || OS.platform() != 'win32')
                                throw 0

                              // Call the inner function
                              preventEvent()

                              // Clear the buffer
                              terminal.clear()

                              // Return `false` to make sure the handler of xtermjs won't be executed
                              return false
                            } catch (e) {}

                            /**
                             * Handle the termination of the terminal's session
                             * `CTRL+D`
                             */
                            try {
                              if (!(ctrlKey && key.toLowerCase() == 'd' && !shiftKey))
                                throw 0

                              // Call the inner function
                              preventEvent()

                              // Return `false` to make sure the handler of xtermjs won't be executed
                              return false
                            } catch (e) {}

                            /**
                             * Handle the copying process of selected text in the terminal
                             *
                             * `CTRL+SHIFT+C` for Linux and Windows
                             * `CMD+C` for macOS
                             */
                            try {
                              if (!((ctrlKey && shiftKey && `${key}`.toLowerCase() === 'c') || (metaKey && `${key}`.toLowerCase() === 'c')))
                                throw 0

                              // Call the inner function
                              preventEvent()

                              // Attempt to write the selected text in the terminal
                              try {
                                Clipboard.writeText(terminal.getSelection())
                              } catch (e) {}

                              // Return `false` to make sure the handler of xtermjs won't be executed
                              return false
                            } catch (e) {}
                          })

                          /**
                           * Listen to `keydown` event in the terminal's container
                           * The main reason is to provide the ability to increase/decrease and reset the terminal's font size
                           * Custom event `changefont` has been added, it will be triggered when the app's zooming level is changing
                           */
                          setTimeout(() => {
                            try {
                              if (OS.platform() == 'darwin')
                                throw 0

                              // Increase font size
                              Modules.Shortcuts.setShortcutInSession(workareaElement.find('div.terminal.xterm')[0], 'basic-console-font-increase', () => terminal.options.fontSize += 1)

                              // Decrease font size
                              Modules.Shortcuts.setShortcutInSession(workareaElement.find('div.terminal.xterm')[0], 'basic-console-font-decrease', () => terminal.options.fontSize -= 1)

                              // Reset font size
                              Modules.Shortcuts.setShortcutInSession(workareaElement.find('div.terminal.xterm')[0], 'basic-console-font-reset', () => terminal.options.fontSize = 13)

                              workareaElement.find('div.terminal.xterm').on('changefont', function(e, keyCode = null) {
                                // If the `CTRL` key is not pressed or `CTRL` and `SHIFT` are being pressed together then skip this try-catch block
                                if ((!e.ctrlKey && e.type != 'changefont') || e.shiftKey)
                                  return true

                                // If the event type is `changefont` then the keycode is provided in variable `keyCode`
                                if (e.type == 'changefont')
                                  e.keyCode = keyCode

                                // Switch between the `keyCode` values
                                switch (e.keyCode) {
                                  // `+` Increase the font size
                                  case 187: {
                                    terminal.options.fontSize += 1
                                    break
                                  }
                                  // `-` Decrease the font size
                                  case 189: {
                                    terminal.options.fontSize -= 1
                                    break
                                  }
                                  // `0` reset the font size
                                  case 48: {
                                    terminal.options.fontSize = 13
                                    break
                                  }
                                }

                                // Prevent any default behavior
                                e.preventDefault()
                              })
                            } catch (e) {}
                          }, 1000)
                        })
                      } catch (e) {
                        try {
                          errorLog(e, 'connections')
                        } catch (e) {}
                      }
                      // End of handling the app's basic terminal
                    } catch (e) {}

                    /*
                     * Point at killing the current process
                     * Point at the CQLSH session's overall container
                     */
                    let cqlshSessionTabContainer = workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`),
                      killProcessBtn = cqlshSessionTabContainer.find('div.kill-process button'),
                      hintsContainer = cqlshSessionTabContainer.find('div.hints-container'),
                      killProcessTimeout

                    // This block of code for the interactive terminal
                    {
                      /**
                       * Define variables and inner functions to be used in the current scope
                       *
                       * Point at the CQLSH interactive terminal's session's main container
                       */
                      let sessionContainer = workareaElement.find(`#_${cqlshSessionContentID}_container`),
                        // Point at the statement's input field
                        statementInputField = workareaElement.find(`textarea#_${cqlshSessionStatementInputID}`),
                        // Point at the interactive terminal's container
                        interactiveTerminal = workareaElement.find(`div[data-id="${terminalContainerID}_interactive"]`),
                        // Point at the basic terminal's container
                        basicTerminal = workareaElement.find(`div[data-id="${terminalContainerID}"]`),
                        // Point at the suggestions' list - at the very bottom of the statement's input field -
                        suggestionsList = cqlshSessionTabContainer.find('div.bottom div.suggestions-list'),
                        // Point at the realtime suggestion's element
                        realtimeSuggestion = statementInputField.parent().find('div.suggestion'),
                        /**
                         * Point at different buttons related to the current scope
                         *
                         * Point at the terminal's switching button - at the top-right of the cqlsh session -
                         */
                        switchTerminalBtn = cqlshSessionTabContainer.find(`div.switch-terminal button`),
                        // Point at the statement's execution button
                        executeBtn = cqlshSessionTabContainer.find('div.execute button')

                      // Hold the last saved important data
                      workareaElement.data('lastData', {
                        cursorPosition: -1,
                        closestWord: '',
                        suggestion: '',
                        history: -1
                      })

                      /**
                       * Inner function to get the closest word to the cursor
                       * Used while the user is updating the statement's input field
                       *
                       * @Parameters:
                       * {object} `textarea` the textarea HTML element
                       *
                       * @Return: {string} the matched content, or an empty value if there's no string close to the cursor
                       */
                      let getClosestWord = (textarea) => {
                        // Get the cursor's current position
                        let cursorPosition = textarea.selectionStart

                        /**
                         * If the user is currently selecting something then return an empty value
                         * The reason is by selecting something while the function is executing will lead to get incorrect values about the cursor's position
                         */
                        if (textarea.selectionEnd !== cursorPosition)
                          return ''

                        // Get the content of the textarea up to the cursor position
                        let textBeforeCursor = textarea.value.slice(0, cursorPosition),
                          // Do a matching process; which is getting the last string in the line that has a space right before it
                          match = /\S+$/.exec(textBeforeCursor)

                        // If there's a value from the matching process then return it, otherwise return an empty value
                        return match ? match[0] : ''
                      }

                      /**
                       * Inner function to get important info from the latest metadata
                       *
                       * @Return: {object} the fetched info from the latest metadata as JSON object
                       */
                      let getMetadataInfo = () => {
                        // Define the final result to be returned
                        let result = {}

                        try {
                          // Get the keyspaces names and their tables' names
                          let temp = {},
                            keyspaces = latestMetadata.keyspaces.map((keyspace) => {
                              return {
                                name: keyspace.name,
                                tables: keyspace.tables
                              }
                            })

                          // Loop through each keyspace and set its tables' names in array
                          for (let keyspace of keyspaces)
                            temp[keyspace.name] = keyspace.tables

                          for (let keyspaceName of Object.keys(temp)) {
                            result[keyspaceName] = {}

                            for (let table of temp[keyspaceName]) {
                              result[keyspaceName][table.name] = table.columns.map((column) => {
                                return {
                                  name: column.name,
                                  type: column.cql_type
                                }
                              })
                            }
                          }
                        } catch (e) {}

                        // Return the final result
                        return result
                      }

                      /**
                       * Apply the auto size feature for the statement's input field
                       * This will simply increase and decrease the height based on the input's value
                       */
                      AutoSize(statementInputField[0])

                      // Clicks the terminal's switching button
                      switchTerminalBtn.click(function(event, onlyInit = false) {
                        try {
                          // If the basic terminal is already shown then skip this try-catch block
                          if (basicTerminal.css('display') != 'none')
                            throw 0

                          if (!onlyInit)
                            switchTerminalBtn.parent().css('z-index', '5')

                          try {
                            // If the terminal has already been initialized then skip this try-catch block
                            if (basicTerminal.attr('data-initialized') == 'true')
                              throw 0

                            // Reset the terminal's buffer - will clear it with the prompt -
                            terminal.reset()

                            // Send multiple `EOL` chars at the same time; to make sure the messy buffer is completely cleared
                            setTimeout(() => {
                              // Define the variable which will hold all the `EOL` chars
                              let charEOL = ''; // This semicolon is critical here

                              // Get 20x of `EOL` char
                              (new Array(20).fill('')).forEach((_) => {
                                charEOL += OS.EOL
                              })

                              // Send it at once to the basic terminal
                              IPCRenderer.send('pty:data', {
                                id: connectionID,
                                char: charEOL
                              })

                              // Clear the screen again but with the prompt this time
                              setTimeout(() => {
                                try {
                                  terminal.clear()
                                } catch (e) {}
                              }, 1000)
                            })

                            // Update the attribute; to not perform this process again
                            basicTerminal.attr('data-initialized', 'true')
                          } catch (e) {}

                          // If the process is only initialization then skip the upcoming code
                          if (onlyInit)
                            return

                          // Show the basic terminal
                          basicTerminal.show()

                          // Hide the interactive terminal
                          interactiveTerminal.hide()
                        } catch (e) {
                          /**
                           * Reaching here means the basic terminal is already shown
                           *
                           * Show the interactive terminal
                           */
                          interactiveTerminal.show()

                          switchTerminalBtn.parent().css('z-index', '3')

                          // Hide the basic terminal
                          basicTerminal.hide()
                        } finally {
                          // Trigger the `resize` event regardless the shown and hidden terminal
                          setTimeout(() => $(window.visualViewport).trigger('resize'), 50)
                        }
                      })

                      let blockID

                      // Clicks the statement's execution button
                      executeBtn.on('click', function(e, oldStatement = '') {
                        // If the button is disabled then skip the upcoming code and end the process
                        if ($(this).attr('disabled') != undefined || $(this).parent().hasClass('busy'))
                          return

                        // Get the statement
                        let statement = statementInputField.val()

                        // Get a random ID for the block which will be created
                        blockID = getRandom.id(10)

                        // Clear the statement's input field and make sure it's focused on it
                        setTimeout(() => statementInputField.val(oldStatement).trigger('input').attr('style', null))

                        setTimeout(() => {
                          consoleEditor.setValue(oldStatement)
                          consoleEditor.focus()
                        })

                        try {
                          let isClearCommand = (['clear', 'cls']).some((command) => statement.startsWith(minifyText(command)))

                          if (!isClearCommand)
                            throw 0


                          sessionContainer.children('div.block').find('div.actions div.btn[action="delete"]').click()

                          return
                        } catch (e) {}

                        try {
                          if (!((['quit', 'exit']).some((command) => minifyText(statement).startsWith(minifyText(command)))))
                            throw 0

                          // Show it in the interactive terminal
                          addBlock(workareaElement.find(`#_${cqlshSessionContentID}_container`), getRandom.id(10), `Work area for the connection ${getAttributes(connectionElement, 'data-name')} will be closed in few seconds`, null, true, 'neutral', true)

                          // Pause the print of output from the Pty instance
                          isSessionPaused = true

                          // Dispose the readline addon
                          prefix = ''

                          // Click the close connection button after a while
                          setTimeout(() => workareaElement.find('div.connection-actions div.action[action="close"] div.btn-container div.btn').click(), 2000)

                          // Skip the upcoming code in the execution button
                          return
                        } catch (e) {}

                        try {
                          if (!(minifyText(statement).startsWith('source_')))
                            throw 0

                          // Add the statement to the connection's history space
                          {
                            // Get current saved statements
                            let history = Store.get(connectionID) || []

                            /**
                             * Maximum allowed statements to be saved are 30 for each connection
                             * When this value is exceeded the oldest statement should be removed
                             */
                            if (history.length > 50)
                              history.pop()

                            statement = removeComments(statement, true)

                            // Add the statement at the very beginning of the array
                            history.unshift(statement)

                            // Remove any duplication
                            Store.set(connectionID, [...new Set(history)])

                            // Enable the history button
                            workareaElement.find('div.session-action[action="history"]').find('button.btn').attr('disabled', null)

                            // Reset the history current index
                            workareaElement.data('lastData').history = -1
                          }

                          {
                            workareaElement.find('div.metadata-actions').find('div.action[action="copy"], div.action[action="refresh"]').css({
                              'opacity': '0.3',
                              'pointer-events': 'none'
                            })

                            workareaElement.find('div.metadata-content').css({
                              'opacity': '0.75',
                              'pointer-events': 'none',
                              'transition': 'all 0.2s ease-in-out'
                            })

                            workareaElement.find('div.tab-pane[tab="cqlsh-session"]').find('div.session-action[action="execute-file"] button').attr('disabled', '')

                            workareaElement.find('ul.nav.nav-tabs').find('li.nav-item:not(:first-of-type) a.nav-link').addClass('disabled')
                          }

                          let isExecutionTerminatedOnError = statement.slice(`${statement}`.indexOf(' |')).includes('true')

                          statement = JSON.parse(`${statement}`.slice(8, `${statement}`.indexOf(' |')))

                          addBlock(sessionContainer, blockID, `Executing ${statement.length} CQL file(s).`, (element) => {
                            let statementTextContainer = element.find('div.statement').children('div.text')

                            element.attr('data-is-source-command', 'true')

                            statementTextContainer.addClass('executing')

                            executeBtn.parent().addClass('busy')

                            element.find('div.actions.for-statement').hide()

                            {
                              try {
                                clearTimeout(killProcessTimeout)
                              } catch (e) {}

                              try {
                                killProcessBtn.parent().addClass('show')
                              } catch (e) {}
                            }

                            statementTextContainer.prepend($(`<span class="spinner"><l-wobble style="--uib-size: 25px; --uib-color: #f0f0f0; --uib-speed: 0.77s;"></l-wobble></span>`).hide(function() {
                              let wobbleSpinner = $(this)

                              setTimeout(() => wobbleSpinner.fadeIn('fast'), 150)

                              // The sub output structure UI
                              let blockElement = workareaElement.find(`div.interactive-terminal-container div.session-content div.block[data-id="${blockID}"]`)

                              let handleFileExecution = (fileIndex = 0) => {
                                if (fileIndex >= statement.length) {
                                  if (statement.length > 1)
                                    blockElement.children('div.output').append($(`
                                          <div class="sub-output info">
                                            <div class="sub-output-content">All files have been executed.</div>
                                          </div>`))

                                  statementTextContainer.removeClass('executing')

                                  executeBtn.parent().removeClass('busy')

                                  killProcessBtn.parent().removeClass('show')

                                  workareaElement.find('div.session-actions').find('button').attr('disabled', null)
                                  workareaElement.find('.disableable').removeClass('disabled')
                                  workareaElement.removeClass('busy-cqlsh')

                                  wobbleSpinner.hide()

                                  {
                                    workareaElement.find('div.metadata-actions').find('div.action[action="copy"], div.action[action="refresh"]').css({
                                      'opacity': '',
                                      'pointer-events': ''
                                    })

                                    workareaElement.find('div.metadata-content').css({
                                      'opacity': '',
                                      'pointer-events': '',
                                      'transition': ''
                                    })

                                    workareaElement.find('div.tab-pane[tab="cqlsh-session"]').find('div.session-action[action="execute-file"] button').attr('disabled', null)

                                    workareaElement.find('ul.nav.nav-tabs').find('li.nav-item:not(:first-of-type) a.nav-link').removeClass('disabled')
                                  }

                                  return
                                }

                                let filePath = statement[fileIndex],
                                  showErrorsBtnID = getRandom.id(10),
                                  fileExecutionInfoID = getRandom.id(10),
                                  element = `
                                          <div class="sub-output info incomplete-statement">
                                            <div class="sub-output-content">${fileIndex + 1}: Executing file '${filePath}'</div>
                                          </div>
                                          <div class="sub-output" data-id="${fileExecutionInfoID}_executed" data-count="0" hidden>
                                            <div class="sub-output-content">-</div>
                                          </div>
                                          <div class="sub-output error" data-id="${fileExecutionInfoID}_error" data-count="0" hidden>
                                            <span class="arrow"><ion-icon name="arrow-down"></ion-icon></span>
                                            <div class="sub-output-content" onclick="$(this).parent().children('div.sub-output-content.all-errors').slideToggle('fast');$(this).parent().children('span.arrow').toggleClass('show');" style="display: inline;"><span>-</span></div>
                                            <div class="sub-output-content all-errors" style="display: none;"></div>
                                          </div>
                                          <div class="sub-output info" data-id="${fileExecutionInfoID}_info" hidden>
                                            <div class="sub-output-content">The file has been fully executed.</div>
                                          </div>`

                                blockElement.children('div.output').children('div.executing').hide()

                                setTimeout(() => {
                                  IPCRenderer.send('pty:command', {
                                    id: connectionID,
                                    cmd: `SOURCE '${filePath}${isExecutionTerminatedOnError ? '{KEYWORD:STOPONERROR:TRUE}' : ''}'`,
                                    blockID,
                                    isSourceCommand: true
                                  })
                                })

                                blockElement.children('div.output').append($(element).show(function() {
                                  setTimeout(() => {
                                    try {
                                      blockElement.parent().animate({
                                        scrollTop: blockElement.parent().get(0).scrollHeight
                                      }, 100)
                                    } catch (e) {}
                                  }, 500)
                                }))

                                try {
                                  IPCRenderer.removeAllListeners(`cql:file:execute:data:${connectionID}`)
                                } catch (e) {}

                                let ansiToHTML = new ANSIToHTML(),
                                  errorsCount = 0

                                IPCRenderer.on(`cql:file:execute:data:${connectionID}`, (_, data) => {
                                  let errors = []

                                  try {
                                    errors = JSON.parse(data.errors)
                                  } catch (e) {}

                                  errorsCount += errors.length

                                  try {
                                    errors = errors.map((error) => {
                                      try {
                                        if (OS.platform() != 'win32')
                                          throw 0

                                        error = error.replace(/\n(?![^<]*<\/span>)/gim, '')
                                      } catch (e) {}

                                      // Manipulate the content
                                      error = error.replace(new RegExp(`(${OS.EOL}){2,}`, `g`), OS.EOL)
                                        .replace(createRegex(OS.EOL, 'g'), '<br>')
                                        .replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br>')
                                        .replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')
                                        .replace('[OUTPUT:INFO]', '')
                                        .replace(/\r?\n?KEYWORD:([A-Z0-9]+)(:[A-Z0-9]+)*((-|:)[a-zA-Z0-9\[\]\,]+)*\r?\n?/gmi, '')

                                      error = ansiToHTML.toHtml(error)

                                      error = StripTags(error)

                                      return error
                                    })
                                  } catch (e) {}

                                  {
                                    let errorsContainer = workareaElement.find(`div.sub-output[data-id="${fileExecutionInfoID}_error"]`).find('div.sub-output-content.all-errors')

                                    for (let error of errors)
                                      errorsContainer.html(`${errorsContainer.html()}<pre>${error}</pre>`)
                                  }

                                  if (errors.length != 0)
                                    workareaElement.find(`div.sub-output[data-id="${fileExecutionInfoID}_error"]`).attr('hidden', null).find('div.sub-output-content:not(.all-errors)').find('span').text(`${errorsCount} error(s) occured in this execution cycle.`)

                                  workareaElement.find(`div.sub-output[data-id="${fileExecutionInfoID}_executed"]`).attr('hidden', null).text(`${data.totalExecutions} statement(s) executed in this execution cycle.`)

                                  if (!data.isFinished)
                                    return

                                  workareaElement.find(`div.sub-output[data-id="${fileExecutionInfoID}_info"]`).attr('hidden', null)

                                  setTimeout(() => handleFileExecution(++fileIndex), 1000)
                                })
                              }

                              handleFileExecution()
                            }))

                            setTimeout(() => {
                              element.find('div.btn[action="copy"]').parent().css('width', '30px')

                              element.find('div.btn[action="copy"]').hide()

                              element.find('div.btn[action="delete"]').unbind('click')

                              element.find('div.btn[action="delete"]').click(() => {
                                // Remove the block from the session
                                element.remove()

                                try {
                                  // Point at the session's statements' container
                                  let sessionContainer = workareaElement.find(`#_${cqlshSessionContentID}_container`)

                                  // If there's still one block then skip this try-catch block
                                  if (sessionContainer.find('div.block').length > 0)
                                    throw 0

                                  // Show the emptiness class
                                  sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                                } catch (e) {}
                              })
                            })
                          })

                          return
                        } catch (e) {}

                        executeBtn.parent().addClass('busy')

                        {
                          try {
                            clearTimeout(killProcessTimeout)
                          } catch (e) {}

                          hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                          killProcessTimeout = setTimeout(() => {
                            killProcessBtn.parent().addClass('show')

                            workareaElement.find('div.session-actions').find('button').attr('disabled', 'true')
                            workareaElement.find('.disableable').addClass('disabled')
                            workareaElement.addClass('busy-cqlsh')

                            if (!isOutputWithPaging)
                              setTimeout(() => hintsContainer.addClass('show'), 1000)
                          }, 1500)
                        }

                        // Add the block
                        addBlock(sessionContainer, blockID, statement, (element) => {
                          // Add the statement to the connection's history space
                          {
                            // Get current saved statements
                            let history = Store.get(connectionID) || []

                            /**
                             * Maximum allowed statements to be saved are 30 for each connection
                             * When this value is exceeded the oldest statement should be removed
                             */
                            if (history.length > 50)
                              history.pop()

                            statement = removeComments(statement, true)

                            // Add the statement at the very beginning of the array
                            history.unshift(statement)

                            // Remove any duplication
                            Store.set(connectionID, [...new Set(history)])

                            // Enable the history button
                            workareaElement.find('div.session-action[action="history"]').find('button.btn').attr('disabled', null)

                            // Reset the history current index
                            workareaElement.data('lastData').history = -1
                          }

                          // Handle when the statement is `SELECT` but there's no `JSON` after it
                          // try {
                          //   // Regex pattern to match 'SELECT' not followed by 'JSON'
                          //   let pattern = /((?:^|\;\s*)\bselect\b(?!\s+json\b))/gi
                          //
                          //   // Replace 'SELECT' with 'SELECT JSON' if 'JSON' is not already present
                          //   statement = statement.replace(pattern, '$1 JSON')
                          // } catch (e) {}

                          try {
                            statement = statement.trim()
                          } catch (e) {}

                          try {
                            if (OS.platform() == 'win32')
                              statement = `${statement.replace(new RegExp('\n|\r', 'g'), ' \n\n')}`
                          } catch (e) {}

                          // Send the command to the main thread to be executed
                          IPCRenderer.send('pty:command', {
                            id: connectionID,
                            cmd: statement,
                            blockID
                          })
                        })
                      })

                      killProcessBtn.click(function() {
                        let blockElement = workareaElement.find(`div.interactive-terminal-container div.session-content div.block[data-id="${blockID}"]`),
                          isSourceCommand = blockElement.attr('data-is-source-command') != undefined,
                          isPagingProcess = blockElement.attr('data-is-paging') != undefined

                        if (isPagingProcess) {
                          blockElement.attr({
                            'data-is-paging': null,
                            'data-is-paging-completed': 'true'
                          })

                          let nextPageBtn = blockElement.find('button[data-action="next-page"]')

                          nextPageBtn.find('[spinner]').hide()
                          nextPageBtn.attr('disabled', null)

                          nextPageBtn.parent().find('button[data-page="last"]').removeClass('hidden')

                          IPCRenderer.send('pty:command', {
                            id: connectionID,
                            cmd: '\x03',
                            blockID
                          })
                        } else {
                          if (isSourceCommand)
                            IPCRenderer.send('pty:command', {
                              id: connectionID,
                              cmd: `\r\r`,
                              blockID
                            })

                          IPCRenderer.send('pty:command', {
                            id: connectionID,
                            cmd: `KEYWORD:STATEMENT:IGNORE-${Math.floor(Math.random() * 999) + 1}`,
                            blockID
                          })
                        }

                        try {
                          if (!isSourceCommand)
                            throw 0

                          blockElement.children('div.output').append($(`
                                  <div class="sub-output info">
                                    <div class="sub-output-content">The execution process has been terminated.</div>
                                  </div>`))

                          blockElement.find('div.statement').children('div.text').removeClass('executing')

                          executeBtn.parent().removeClass('busy')

                          killProcessBtn.parent().removeClass('show')

                          workareaElement.find('div.session-actions').find('button').attr('disabled', null)
                          workareaElement.find('.disableable').removeClass('disabled')
                          workareaElement.removeClass('busy-cqlsh')

                          blockElement.find('div.statement').find('span.spinner').hide()

                          {
                            workareaElement.find('div.metadata-actions').find('div.action[action="copy"], div.action[action="refresh"]').css({
                              'opacity': '',
                              'pointer-events': ''
                            })

                            workareaElement.find('div.metadata-content').css({
                              'opacity': '',
                              'pointer-events': '',
                              'transition': ''
                            })

                            workareaElement.find('div.tab-pane[tab="cqlsh-session"]').find('div.session-action[action="execute-file"] button').attr('disabled', null)

                            workareaElement.find('ul.nav.nav-tabs').find('li.nav-item:not(:first-of-type) a.nav-link').removeClass('disabled')
                          }
                        } catch (e) {}
                      }).hover(() => hintsContainer.hide(), () => hintsContainer.show())

                      // The statement's input field's value has been updated
                      statementInputField.on('input', function() {
                        // Get the statement's content
                        let statement = $(this).val(),
                          // Get the closest word to the cursor in the input field
                          closestWord = getClosestWord($(this)[0]),
                          /**
                           * Whether or not the content has multiple lines
                           * In case it has, the suggestions and autocomplete feature will be temporary disabled
                           */
                          isMultipleLines = $(this).val().match(new RegExp(OS.EOL, 'g')) != null

                        // Enable and disable the execution button based set conditions
                        {
                          // Minify the statement
                          let minifiedStatement = minifyText(removeComments(statement, true)),
                            /**
                             * Whether or not the statement is a CQLSH command
                             * In this case, the statement doesn't need semi colon `;` at the end
                             */
                            isCQLSHCommand = Modules.Consts.CQLSHCommands.some((command) => minifiedStatement.startsWith(minifyText(command))),
                            // Whether or not the statement is quitting the cqlsh session
                            isQuitCommand = (['quit', 'exit']).some((command) => minifiedStatement.startsWith(minifyText(command))),
                            isClearCommand = (['clear', 'cls']).some((command) => minifiedStatement.startsWith(minifyText(command))),
                            isConsistencyCommand = (['consistency', 'serial']).some((command) => minifiedStatement.startsWith(minifyText(command))),
                            // Decide whether or not the execution button should be disabled
                            isExecutionButtonDisabled = minifiedStatement.length <= 0 || ((!isCQLSHCommand && !isQuitCommand && !isClearCommand && !isConsistencyCommand) && !minifiedStatement.endsWith(';'))

                          // Disable/enable the execution button
                          executeBtn.attr('disabled', isExecutionButtonDisabled ? '' : null)
                        }

                        /**
                         * Update some of the saved data
                         *
                         * Update the latest saved cursor's position
                         */
                        workareaElement.data('lastData').cursorPosition = $(this)[0].selectionEnd

                        // The default array for suggestions is the CQL keywords with the commands
                        let suggestionsArray = Modules.Consts.CQLKeywords.concat(Modules.Consts.CQLSHCommands),
                          // Get the keyspaces and their tables from the last metadata
                          metadataInfo = getMetadataInfo(),
                          // Get keyspaces' names
                          keyspaces = Object.keys(metadataInfo),
                          // Flag to tell if keyspace has been found and it's time to suggest its tables
                          isKeyspace = false,
                          // Flag to tell if suggestions should be the keyspaces only
                          isSuggestKeyspaces = false

                        try {
                          /**
                           * Determine whether or not keyspaces and their tables should be shown as suggestions
                           *
                           * Get the content before the cursor's position
                           */
                          let contentBeforeCursor = statement.slice(0, workareaElement.data('lastData').cursorPosition)

                          // Check the content against defined regex patterns
                          isSuggestKeyspaces = Object.keys(Modules.Consts.CQLRegexPatterns).some((type) => Modules.Consts.CQLRegexPatterns[type].Patterns.some((regex) => $(this).val().slice(0, workareaElement.data('lastData').cursorPosition).match(regex) != null))

                          // If the closest word to the cursor doesn't have `.` then skip this try-catch block
                          if (!isSuggestKeyspaces || !closestWord.includes('.'))
                            throw 0

                          // Get the recognized keyspace name
                          let keyspace = closestWord.slice(0, closestWord.indexOf('.')).replace(/^\"*(.*?)\"*$/g, '$1'),
                            // Attempt to get its tables
                            tables = Object.keys(metadataInfo[keyspace])

                          // If the attempt failed then skip this try-catch block
                          if (tables == undefined)
                            throw 0

                          /**
                           * Update associated variables
                           *
                           * Update the flag to be `true`
                           */
                          isKeyspace = true

                          // Update the suggestions' array
                          suggestionsArray = tables

                          // Update the closest word to be what after `.`
                          closestWord = closestWord.slice(closestWord.indexOf('.') + 1)
                        } catch (e) {}

                        // Update the latest saved closest word to the cursor
                        workareaElement.data('lastData').closestWord = closestWord

                        // Get the suggestions based on the closest word
                        let suggestions = suggestionSearch(closestWord, (isSuggestKeyspaces && !isKeyspace) ? keyspaces : suggestionsArray, isSuggestKeyspaces || isKeyspace)

                        // Keep related suggestions and remove the rest
                        try {
                          // If there's no such a suggestion then skip this try-catch block
                          if (typeof suggestions == 'string' || suggestions.length <= 0)
                            throw 0

                          // Remove all current suggestions
                          suggestionsList.children('span.suggestion').each(function() {
                            // Reset the selection attribute
                            $(this).attr('data-selected', 'false')

                            // If the suggestion is related then skip the upcoming code and move to the next suggestion
                            if (suggestions.includes($(this).attr('data-suggestion')) || suggestions == $(this).attr('data-suggestion'))
                              return

                            // Suggestion is not related, remove it
                            $(this).remove()
                          })
                        } catch (e) {
                          suggestionsList.children('span.suggestion').remove()
                        }

                        // Reset the realtime suggestion's text
                        realtimeSuggestion.text('')

                        // If the statement has multiple lines, or there's no close word to the cursor and there's no keyspace name recognized then remove all related suggestions and stop this feature
                        if (isMultipleLines || (minifyText(closestWord).length <= 0 && !isKeyspace && !isSuggestKeyspaces))
                          return suggestionsList.children('span.suggestion').remove()

                        // Manipulate the received suggestions
                        {
                          // Define index to be used with the appended suggestions
                          let index = 0

                          // Loop through each received suggestion
                          for (let suggestion of suggestions) {
                            // Whether or not the `suggestions` is actually one `string` suggestion not an array
                            let isSuggestionString = typeof suggestions == 'string'

                            // If there's only one suggestion then handle it
                            if (isSuggestionString)
                              suggestion = suggestions

                            // If the suggestion already exist in the UI then skip the appending process and move to the next suggestion
                            if (suggestionsList.children(`span.suggestion[data-suggestion="${suggestion}"]`).length != 0)
                              continue

                            // The suggestion UI structure
                            let element = `
                                     <span ${isSuggestKeyspaces || isKeyspace ? 'data-double-quote-check="true"' : ''} class="btn suggestion badge rounded-pill ripple-surface-light" data-index="${index}" data-suggestion="${suggestion}" data-selected="false" data-mdb-ripple-color="light" style="display:none">${suggestion}</span>`

                            // Append the suggestion and handle the `click` event
                            suggestionsList.append($(element).delay(50 * index).fadeIn(100 * (index + 1)).click(function() {
                              // Reset the selection state of all suggestions
                              suggestionsList.children('span.suggestion').attr('data-selected', 'false')

                              /**
                               * If the clicked suggestion has a sibling before it then select it
                               * As `TAB` key will autocomplete the subling right after the selected one
                               */
                              if ($(this).prev().length > 0)
                                $(this).prev().attr('data-selected', 'true')

                              // Trigger the `keydown` event with `isVirtual` set to `true`
                              statementInputField.trigger('keydown', true)
                            }))

                            // If there's only one suggestion then end this loop
                            if (isSuggestionString)
                              break

                            // Increment the index
                            index += 1
                          }
                        }

                        // If there's no suggestion received then skip the upcoming code and end the process
                        if (suggestions.length <= 0)
                          return

                        // Define the final suggestion text which will be rendered in the realtime suggestion's UI element
                        let suggestionText = '',
                          // Get the textarea/statement value and split it to characters
                          textareaValue = $(this).val().split('')

                        // Loop through the characters, add them to the suggestion's text
                        for (let i = 0; i < $(this)[0].selectionEnd; i++)
                          suggestionText += `<span style="color:transparent;">${textareaValue[i]}</span>`

                        // Define the selected suggestion to be adopted
                        let selectedSuggestion = typeof suggestions == 'string' ? suggestions : suggestions[0]

                        // Set the suggestion's text to be lower case if needed
                        if (`${closestWord.at(-1)}` != `${closestWord.at(-1)}`.toUpperCase())
                          selectedSuggestion = selectedSuggestion.toLowerCase()

                        // Update the realtime suggestion's text
                        realtimeSuggestion.html(`${suggestionText}${selectedSuggestion.slice(closestWord.length)}`)

                        // Reset the suggestion's index
                        currentSuggestionIndex = -1

                        // Key is pressed while the textarea is focused
                      }).keydown(function(event, isVirtual = false) {
                        // Get the pressed key's code
                        let keyCode = event.keyCode

                        // If the pressed key is not `TAB` then trigger the `input` event for the textarea
                        if (keyCode != 9)
                          setTimeout(() => $(this).trigger('input', false))

                        // `UP Arrow` and `DOWN Arrow` key press/down
                        try {
                          if (!(keyCode == 38 && event.ctrlKey) && !(keyCode == 40 && event.ctrlKey))
                            throw 0

                          // Flag to tell if the pressed key is the `UP Arrow` key
                          let isUpArrow = keyCode == 38

                          // Prevent the default behavior for this key pressing event
                          event.preventDefault()

                          // Get the saved statements
                          let history = Store.get(connectionID) || []

                          // If there's no saved history then simply skip this try-catch block
                          if (history.length <= 0)
                            throw 0

                          // Increment/decrement the current history's index based on the pressed key
                          workareaElement.data('lastData').history += isUpArrow ? 1 : -1

                          // Get the selected statement
                          let statement = history[workareaElement.data('lastData').history]

                          // If the statement is `undefined` then the index is out of range
                          if (statement == undefined) {
                            // Normalize the index
                            workareaElement.data('lastData').history = isUpArrow ? 0 : history.length - 1

                            // Update the selected statement
                            statement = history[workareaElement.data('lastData').history]
                          }

                          // Remove any realtime suggestions
                          realtimeSuggestion.text('')

                          // Update the textarea's content and focus
                          $(this).val(statement).trigger('input').focus()

                          // Update the size of the textarea
                          AutoSize.update($(this)[0])
                        } catch (e) {}

                        // `ENTER` key press/down
                        try {
                          if (keyCode != 13 || event.shiftKey)
                            throw 0

                          // Prevent the default behavior for this key pressing event
                          event.preventDefault()

                          // Click the statement's execution button
                          executeBtn.trigger('click')
                        } catch (e) {}

                        // `TAB` key press/down
                        try {
                          if (keyCode != 9 && !isVirtual)
                            throw 0

                          // Prevent the default behavior for this key pressing event
                          event.preventDefault()

                          // Reset the realtime suggestion's text
                          realtimeSuggestion.text('')

                          // Get the current selected suggestion's index
                          let currentSelectedSuggestionIndex = suggestionsList.children('span.suggestion[data-selected="true"]').index()

                          /**
                           * Manipulate the selected suggestion's index
                           * If the current selected suggestion's index is `-1` - no suggestion is selected -, or the current selected one is acutally the last one then adopt the first suggestion
                           * Otherwise increase the current index by 1
                           */
                          currentSelectedSuggestionIndex = (currentSelectedSuggestionIndex <= -1 || (currentSelectedSuggestionIndex + 1) >= suggestionsList.children('span.suggestion').length) ? 0 : (currentSelectedSuggestionIndex + 1)

                          // Get the final selected suggestion's UI element
                          let selectedSuggestion = suggestionsList.children('span.suggestion').eq(currentSelectedSuggestionIndex)

                          // Reset the selection state of all suggestions
                          suggestionsList.children('span.suggestion').attr('data-selected', 'false')

                          // The selected suggestion's attribute would be set to be `true`
                          selectedSuggestion.attr('data-selected', 'true')

                          // Get the selected suggestion's content/text
                          let selectedSuggestionContent = selectedSuggestion.attr('data-suggestion'),
                            isDoubleQuotesCheckNeeded = selectedSuggestion.attr('data-double-quote-check') == 'true',
                            // Get the statement/textarea's content/text
                            currentStatementContent = $(this).val(),
                            areDoubleQuotesAdded = false

                          if (isDoubleQuotesCheckNeeded) {
                            selectedSuggestionContent = addDoubleQuotes(selectedSuggestionContent)

                            areDoubleQuotesAdded = selectedSuggestionContent.startsWith('"')
                          } else {
                            // Set the suggestion's text to be lower case if needed
                            if (workareaElement.data('lastData').closestWord.at(-1) != `${workareaElement.data('lastData').closestWord.at(-1) || ''}`.toUpperCase())
                              selectedSuggestionContent = selectedSuggestionContent.toLowerCase()

                            // Update the selected suggestion's content by slicing what already has been typed by the user
                            selectedSuggestionContent = selectedSuggestionContent.slice(workareaElement.data('lastData').closestWord.length)
                          }

                          // Define initially the suggestion's prefix content
                          let suggestionPrefixContent = currentStatementContent.slice(workareaElement.data('lastData').cursorPosition)

                          if (isDoubleQuotesCheckNeeded) {
                            // Update the prefix content by remove the previous suggestion if it already has been added
                            if (workareaElement.data('lastData').suggestion.indexOf(suggestionPrefixContent) != -1 && suggestionPrefixContent.length != 0) {
                              try {
                                if (suggestionPrefixContent == workareaElement.data('lastData').suggestion || `${workareaElement.data('lastData').closestWord}${suggestionPrefixContent}` == workareaElement.data('lastData').suggestion) {
                                  suggestionPrefixContent = ''

                                  throw 0
                                }

                                let tempTxt = ''
                                for (let i = 0; i < suggestionPrefixContent.length; ++i) {
                                  tempTxt += `${suggestionPrefixContent[i]}`

                                  if (workareaElement.data('lastData').suggestion.endsWith(`${workareaElement.data('lastData').closestWord}${tempTxt}`)) {
                                    let newPrefix = suggestionPrefixContent.slice(suggestionPrefixContent.indexOf(tempTxt) + tempTxt.length)

                                    suggestionPrefixContent = newPrefix
                                    break
                                  }
                                }
                              } catch (e) {}
                            }
                          } else {
                            // Update the prefix content by remove the previous suggestion if it already has been added
                            if (suggestionPrefixContent.indexOf(workareaElement.data('lastData').suggestion) != -1)
                              suggestionPrefixContent = `${suggestionPrefixContent.slice(0, suggestionPrefixContent.indexOf(workareaElement.data('lastData').suggestion))}${suggestionPrefixContent.slice(suggestionPrefixContent.indexOf(workareaElement.data('lastData').suggestion) + workareaElement.data('lastData').suggestion.length)}`
                          }

                          if (isDoubleQuotesCheckNeeded && suggestionPrefixContent.startsWith(workareaElement.data('lastData').suggestion))
                            suggestionPrefixContent = suggestionPrefixContent.slice(suggestionPrefixContent.indexOf(workareaElement.data('lastData').suggestion) + workareaElement.data('lastData').suggestion.length)

                          // Update the statement's text/content
                          currentStatementContent = currentStatementContent.slice(0, workareaElement.data('lastData').cursorPosition - (isDoubleQuotesCheckNeeded ? workareaElement.data('lastData').closestWord.length : 0)) + `${selectedSuggestionContent}${suggestionPrefixContent}`

                          // Update the last saved suggestion
                          workareaElement.data('lastData').suggestion = `${selectedSuggestionContent}`

                          if (isDoubleQuotesCheckNeeded)
                            workareaElement.data('lastData').suggestion = workareaElement.data('lastData').suggestion.slice(workareaElement.data('lastData').suggestion.indexOf(workareaElement.data('lastData').closestWord) + workareaElement.data('lastData').closestWord.length)

                          // Set the final statement's text/content
                          $(this).val(currentStatementContent).focus()

                          // Update the cursor's position inside the textarea
                          {
                            // Define the updated cursor's position
                            let cursorPosition = workareaElement.data('lastData').cursorPosition + selectedSuggestionContent.length + (isDoubleQuotesCheckNeeded && suggestionPrefixContent.length > 0 ? 1 : 0)

                            // Set it inside the textarea
                            $(this)[0].setSelectionRange(cursorPosition, cursorPosition)
                          }
                        } catch (e) {}
                      })

                      {
                        setTimeout(() => {
                          let enhancedConsoleFooter = workareaElement.find(`div#_${containerFooterID}`),
                            emptyStatements = workareaElement.find(`div#_${containerEmptyStatementsID}`),
                            cqlshSessionContent = workareaElement.find(`div#_${cqlshSessionContentID}_container`),
                            historyItemsContainer = workareaElement.find('div.history-items'),
                            clearHistoryItemsBtn = workareaElement.find('div.history-items-clear-all'),
                            baseHeightFooter = enhancedConsoleFooter.outerHeight(),
                            updateLayoutTimeout

                          // Make the left side resizable
                          enhancedConsoleFooter.resizable({
                            handles: 'n', // [N]orth
                            minHeight: baseHeightFooter,
                            maxHeight: baseHeightFooter * 2
                          }).bind({
                            resize: function(_, __) {
                              enhancedConsoleFooter.css('top', '0px')

                              emptyStatements.add(cqlshSessionContent).css('height', `calc(100% - ${240 + (enhancedConsoleFooter.outerHeight() - baseHeightFooter)}px)`)

                              historyItemsContainer.add(clearHistoryItemsBtn).css('bottom', `${165 + (enhancedConsoleFooter.outerHeight() - baseHeightFooter)}px`)

                              try {
                                clearTimeout(updateLayoutTimeout)
                              } catch (e) {}

                              updateLayoutTimeout = setTimeout(() => {
                                try {
                                  consoleEditor.layout()
                                } catch (e) {}
                              }, 200)

                            }
                          })
                        }, 3000)
                      }

                      {
                        try {
                          consoleEditor = monaco.editor.create(workareaElement.find('div.console-editor')[0], {
                            value: '', // This is the default content of the `cqlsh.rc` file
                            language: 'sql', // This language is the perfect one that supports the `cqlsh.rc` file content's syntax highlighting
                            minimap: {
                              enabled: false
                            },
                            glyphMargin: true, // This option allows to render an object in the line numbering side
                            suggest: {
                              showFields: false,
                              showFunctions: false,
                              showWords: false
                            },
                            padding: {
                              top: 7,
                              bottom: 7
                            },
                            wordBasedSuggestions: 'off',
                            padding: {
                              top: 10,
                              bottom: 10
                            },
                            theme: 'vs-dark',
                            scrollBeyondLastLine: true,
                            mouseWheelZoom: true,
                            fontSize: 14,
                            fontFamily: "'Terminal', 'Minor', 'SimplifiedChinese', monospace",
                            fontLigatures: true
                          })

                          consoleEditor.getModel().onDidChangeContent(() => statementInputField.val(consoleEditor.getValue()).trigger('input'))

                          consoleEditor.addAction({
                            id: getRandom.id(),
                            label: getRandom.id(),
                            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                            run: function(editor) {
                              try {
                                $(editor.getDomNode()).closest('div.interactive-terminal-container').find('div.execute button').trigger('click')
                              } catch (e) {}
                            }
                          })

                          consoleEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
                            let text = Clipboard.readText(),
                              selection = consoleEditor.getSelection()

                            consoleEditor.executeEdits('paste', [{
                              range: selection,
                              text: text,
                              forceMoveMarkers: true
                            }])
                          })

                          consoleEditor.addCommand(Modules.Shortcuts.getShortcutForMonacoEditor('enhanced-console-clear'), () => $(document).trigger('clearEnhancedConsole'))

                          consoleEditor.addAction({
                            id: getRandom.id(),
                            label: getRandom.id(),
                            keybindings: [Modules.Shortcuts.getShortcutForMonacoEditor('history-statements-forward')],
                            run: function(editor) {
                              try {
                                let workareaElement = $(editor.getDomNode()).closest('div.workarea[workarea-id][connection-id]'),
                                  connectionID = workareaElement.attr('connection-id'),
                                  // Get the saved statements
                                  history = Store.get(connectionID) || []

                                // If there's no saved history then simply skip this try-catch block
                                if (history.length <= 0)
                                  throw 0

                                // Increment/decrement the current history's index based on the pressed key
                                workareaElement.data('lastData').history += 1

                                // Get the selected statement
                                let statement = history[workareaElement.data('lastData').history]

                                // If the statement is `undefined` then the index is out of range
                                if (statement == undefined) {
                                  // Normalize the index
                                  workareaElement.data('lastData').history = 0

                                  // Update the selected statement
                                  statement = history[workareaElement.data('lastData').history]
                                }

                                consoleEditor.setValue(statement)
                                consoleEditor.focus()

                                let lastLine = consoleEditor.getModel().getLineCount(),
                                  lastColumn = consoleEditor.getModel().getLineMaxColumn(lastLine);

                                consoleEditor.setPosition({
                                  lineNumber: lastLine,
                                  column: lastColumn
                                })
                              } catch (e) {}
                            }
                          })

                          consoleEditor.addAction({
                            id: getRandom.id(),
                            label: getRandom.id(),
                            keybindings: [Modules.Shortcuts.getShortcutForMonacoEditor('history-statements-backward')],
                            run: function(editor) {
                              try {
                                let workareaElement = $(editor.getDomNode()).closest('div.workarea[workarea-id][connection-id]'),
                                  connectionID = workareaElement.attr('connection-id'),
                                  // Get the saved statements
                                  history = Store.get(connectionID) || []

                                // If there's no saved history then simply skip this try-catch block
                                if (history.length <= 0)
                                  throw 0

                                // Increment/decrement the current history's index based on the pressed key
                                workareaElement.data('lastData').history += -1

                                // Get the selected statement
                                let statement = history[workareaElement.data('lastData').history]

                                // If the statement is `undefined` then the index is out of range
                                if (statement == undefined) {
                                  // Normalize the index
                                  workareaElement.data('lastData').history = history.length - 1

                                  // Update the selected statement
                                  statement = history[workareaElement.data('lastData').history]
                                }

                                consoleEditor.setValue(statement)
                                consoleEditor.focus()

                                let lastLine = consoleEditor.getModel().getLineCount(),
                                  lastColumn = consoleEditor.getModel().getLineMaxColumn(lastLine);

                                consoleEditor.setPosition({
                                  lineNumber: lastLine,
                                  column: lastColumn
                                })
                              } catch (e) {}
                            }
                          })

                          monaco.languages.registerCompletionItemProvider('sql', {
                            triggerCharacters: [' ', '.', '"', '*', ';'],
                            provideCompletionItems: function(model, position) {
                              if (model != consoleEditor.getModel())
                                return {
                                  suggestions: []
                                }

                              let statement = model.getValueInRange(new monaco.Range(position.lineNumber, 1, position.lineNumber, position.column)),
                                closestWord = '',
                                WordAtPosition = model.getWordAtPosition(position),
                                range = WordAtPosition ?
                                new monaco.Range(position.lineNumber, WordAtPosition.startColumn, position.lineNumber, position.column) :
                                new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                suggestions = []

                              // Get the closest word to the cursor in the input field
                              try {
                                closestWord = WordAtPosition.word
                              } catch (e) {}

                              try {
                                if (closestWord.length <= 0)
                                  closestWord = /\S+$/.exec(statement)[0]
                              } catch (e) {}

                              // The default array for suggestions is the CQL keywords with the commands
                              let suggestionsArray = Modules.Consts.CQLKeywords.concat(Modules.Consts.CQLSHCommands),
                                // Get the keyspaces and their tables from the last metadata
                                metadataInfo = getMetadataInfo(),
                                // Get keyspaces' names
                                keyspaces = Object.keys(metadataInfo),
                                // Flag to tell if keyspace has been found and it's time to suggest its tables
                                isKeyspace = false,
                                // Flag to tell if suggestions should be the keyspaces only
                                isSuggestKeyspaces = false,
                                matchedPattern = ''

                              try {
                                /**
                                 * Determine whether or not keyspaces and their tables should be shown as suggestions
                                 *
                                 * Get the content before the cursor's position
                                 */
                                let contentBeforeCursor = statement

                                // Check the content against defined regex patterns
                                isSuggestKeyspaces = Object.keys(Modules.Consts.CQLRegexPatterns).some((type) => {
                                  let isMatched = Modules.Consts.CQLRegexPatterns[type].Patterns.some((regex) => contentBeforeCursor.match(regex) != null)

                                  if (isMatched)
                                    matchedPattern = type

                                  return isMatched
                                })

                                // If the closest word to the cursor doesn't have `.` then skip this try-catch block
                                if (!isSuggestKeyspaces || !closestWord.includes('.'))
                                  throw 0

                                // Get the recognized keyspace name
                                let keyspace = closestWord.slice(0, closestWord.indexOf('.')).replace(/^\"*(.*?)\"*$/g, '$1'),
                                  // Attempt to get its tables
                                  tables = Object.keys(metadataInfo[keyspace])

                                // If the attempt failed then skip this try-catch block
                                if (tables == undefined)
                                  throw 0

                                /**
                                 * Update associated variables
                                 *
                                 * Update the flag to be `true`
                                 */
                                isKeyspace = true

                                // Update the suggestions' array
                                suggestionsArray = tables

                                // Update the closest word to be what after `.`
                                closestWord = closestWord.slice(closestWord.indexOf('.') + 1)
                              } catch (e) {}

                              let finalSuggestions = suggestionSearch(closestWord, (isSuggestKeyspaces && !isKeyspace) ? keyspaces : suggestionsArray, isSuggestKeyspaces || isKeyspace),
                                isONKeyword = false

                              // Handle suggesting columns from table
                              try {
                                if (!isSuggestKeyspaces || matchedPattern != 'Where')
                                  throw 0

                                let keyspaceAndTable = null

                                // Try any of these
                                for (let regex of [/.*\bfrom\s+(.*?)\s+where\b/is, /.*\bupdate\s+(.*?)\s+\b/is, /.*\ON\s+(.*?)\s+/is]) {
                                  try {
                                    keyspaceAndTable = statement.match(regex)[1]

                                    if (`${regex}`.includes('ON') && statement.match(/ON.+\(/is) == null)
                                      isONKeyword = true

                                    break
                                  } catch (e) {}
                                }

                                if (keyspaceAndTable == null)
                                  throw 0

                                let [keyspace, table] = keyspaceAndTable.split('.').map((name) => `${name}`.replace(/^\"*(.*?)\"*$/g, '$1')),
                                  columns = metadataInfo[keyspace][table]

                                finalSuggestions = columns
                              } catch (e) {}

                              if ((JSON.stringify(finalSuggestions) == JSON.stringify(suggestionsArray)) && !(isSuggestKeyspaces || isKeyspace))
                                return {
                                  suggestions: []
                                }

                              suggestions = finalSuggestions.map((suggestionItem) => {
                                let suggestion = suggestionItem,
                                  isItemObject = typeof suggestionItem == 'object'

                                if (isItemObject)
                                  suggestion = suggestionItem.name

                                insertText = (isSuggestKeyspaces || isKeyspace) ? addDoubleQuotes(`${suggestion}`) : suggestion

                                if (isONKeyword)
                                  insertText = `(${insertText})`

                                return {
                                  label: !isItemObject ? suggestion : `${suggestionItem.name}: ${suggestionItem.type}`,
                                  kind: monaco.languages.CompletionItemKind.Keyword,
                                  insertText,
                                  range
                                }
                              })

                              try {
                                suggestions = removeArrayDuplicates(suggestions, 'label')
                              } catch (e) {}

                              // Handle if the keyword is DESC/DESCRIBE
                              try {
                                if (Modules.Consts.CQLRegexPatterns.Desc.Patterns.some((regex) => statement.match(regex) != null) && (isSuggestKeyspaces || isKeyspace))
                                  suggestions.unshift({
                                    label: 'SCHEMA',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    insertText: 'SCHEMA',
                                    range
                                  })
                              } catch (e) {}

                              return {
                                suggestions
                              }
                            }
                          })
                        } catch (e) {}
                      }
                    }
                    // End of hanlding the interactive terminal

                    // Handle the bash session only if the connection is a sandbox project
                    try {
                      if (!isSandbox)
                        throw 0

                      // Put the code inside curly brackets to reduce its scope and make sure to not affect the rest of the code
                      {
                        // Define global variables to be used in this code block
                        let terminalBash, // The XTermJS object for Bash
                          fitAddonBash, // Used for resizing the terminal and making it responsive
                          printData = false, // Whether or not the data coming from the pty instances should be printed or not
                          latestCommand = '', // Store the user's input to create a command
                          sessionID = getRandom.id(5) // Get a random ID as a suffix to the sandbox project's ID

                        // Create the terminal instance from the XtermJS constructor
                        terminalBash = new XTerm({
                          theme: XTermThemes.Atom
                        })

                        // Add log
                        try {
                          addLog(`Created a bash session for local cluster ${getAttributes(connectionElement, ['data-id'])}`)
                        } catch (e) {}

                        /**
                         * Custom terminal options
                         *
                         * Change font family to `JetBrains Mono` and set its size and line height
                         * https://www.jetbrains.com/lp/mono/
                         */
                        terminalBash.options.fontFamily = 'Terminal, monospace'
                        terminalBash.options.fontSize = 13
                        terminalBash.options.lineHeight = 1.35

                        // Enable the cursor blink when the terminal is being focused on
                        terminalBash._publicOptions.cursorBlink = true

                        setTimeout(() => {
                          /**
                           * Define XtermJS addons
                           *
                           * Fit addon; to resize the terminal without distortion
                           */
                          fitAddonBash = new FitAddon.FitAddon()

                          /**
                           * Load XtermJS addons
                           *
                           * Load the `Fit` addon
                           */
                          terminalBash.loadAddon(fitAddonBash)

                          // The terminal now will be shown in the UI
                          terminalBash.open(workareaElement.find(`div.terminal-container[data-id="${terminalBashContainerID}"]`)[0])

                          // Load the `Canvas` addon
                          terminalBash.loadAddon(new CanvasAddon())

                          // Load the `Webfont` addon
                          terminalBash.loadAddon(new XtermWebFonts())

                          // Fit the terminal with its container
                          setTimeout(() => fitAddonBash.fit(), 1500)

                          // Push the fit addon object to the related array
                          terminalFitAddonObjects.push(fitAddonBash)

                          // Send a request to create a pty instance
                          setTimeout(() => IPCRenderer.send('pty:create:bash-session', {
                            id: `${connectionID}-bash-${sessionID}`,
                            projectID: `cassandra_${connectionID}`,
                            path: Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..', '..', '..')), 'data', 'localclusters', connectionID),
                            dockerComposeBinary: Modules.Docker.getDockerComposeBinary()
                          }), 500)

                          /**
                           * Decide what to print to the user after initializing the pty instance
                           *
                           * Define the regex syntax in which the terminal is ready to be used once it's matched
                           */
                          let regex = new RegExp('root.+\:\/\#', 'gm')

                          // Remove all previous listeners to the channel between the main and renderer threads
                          IPCRenderer.removeAllListeners(`pty:${connectionID}-bash-${sessionID}:data:bash-session`)

                          /**
                           * Get the terminal's active buffer
                           * This process detects any attempt to execute the `exit` command
                           */
                          let activeBuffer = terminalBash.buffer.active

                          // Listen to data sent from the pty instance
                          IPCRenderer.on(`pty:${connectionID}-bash-${sessionID}:data:bash-session`, (_, data) => {
                            // Update the printing status if the regex execution has returned a positive result
                            if (regex.exec(minifyText(data)) != null && !printData)
                              printData = true

                            // If the printing status is `false` then don't print the current received data
                            if (!printData)
                              return

                            // Write data to the terminal
                            terminalBash.write(data)

                            // Detect any attempt to execute the `exit` command
                            setTimeout(() => {
                              // Get the active's line content
                              let activeLine = activeBuffer.getLine(activeBuffer.cursorY).translateToString(),
                                // Manipulate the entire line, get only the command, and get rid of the prompt
                                minifiedActiveLine = minifyText(activeLine).slice(activeLine.indexOf(':/#') + 3),
                                // Whether or not the `exit` is in the line
                                isExitFound = ['exit', 'exit&', 'exit;'].some((exit) => minifiedActiveLine.endsWith(exit) || minifiedActiveLine.startsWith(exit))

                              // If there's an `exit` command then suffix the entire line with `!` symbol
                              if (isExitFound && !minifiedActiveLine.endsWith('!'))
                                IPCRenderer.send(`pty:${connectionID}-bash-${sessionID}:command:bash-session`, '!')
                            })
                          })

                          // As the user typing and providing data to the terminal
                          terminalBash.onData((data) => {
                            // Add the data to the `latestCommand` variable
                            latestCommand += data

                            // If the command has an `exit` character then remove it
                            {
                              // Define the exit character
                              let exitChar = '\x04',
                                // Create a regular expression to match the character everywhere in the data
                                regex = new RegExp(exitChar, 'gm')

                              // Remove the character
                              data = data.replace(regex, '')
                            }

                            // Send the data to the pty instance
                            IPCRenderer.send(`pty:${connectionID}-bash-${sessionID}:command:bash-session`, data)
                          })

                          // Point at the terminal viewport - main container -
                          let terminalViewport = workareaElement.find(`div.terminal-container[data-id="${terminalBashContainerID}"]`).find('div.xterm-viewport')[0]

                          /**
                           * Listen to data - characters - from the user - input to the terminal -
                           * What is being listened to is mainly the keypresses like `ENTER`
                           */
                          terminalBash.onData((char) => {
                            // Get the key code
                            let keyCode = char.charCodeAt(0)

                            // Switch between the key code's values
                            switch (keyCode) {
                              // `ENTER`
                              case 13: {
                                // Empty the latest command
                                latestCommand = ''

                                // Scroll to the very bottom of the terminal
                                terminalViewport.scrollTop = terminalViewport.scrollHeight

                                // Resize the terminal
                                fitAddonBash.fit()

                                break
                              }
                            }
                          })
                        })
                        // End of handling the app's terminal
                      }
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }
                    // End of handling the bash session's terminal

                    // Handle different events for many elements in the work area
                    {
                      // Metadata tree view side
                      setTimeout(() => {
                        // Clicks the copy button; to copy metadata in JSON string format
                        workareaElement.find(`div.btn[data-id="${copyMetadataBtnID}"]`).click(function() {
                          // Get the beautified version of the metadata
                          let metadataBeautified = beautifyJSON(latestMetadata, true),
                            // Get the metadata size
                            metadataSize = Bytes(ValueSize(metadataBeautified))

                          // Copy metadata to the clipboard
                          try {
                            Clipboard.writeText(metadataBeautified)
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Give feedback to the user
                          showToast(I18next.capitalize(I18next.t('copy metadata')), I18next.capitalizeFirstLetter(I18next.replaceData('metadata for the cluster connected to by [b]$data[/b] has been copied to the clipboard, the size is $data', [getAttributes(connectionElement, 'data-name'), metadataSize])) + '.', 'success')
                        })

                        // Refresh the tree view
                        workareaElement.find(`div.btn[data-id="${refreshMetadataBtnID}"]`).click(function() {
                          // If the `checkMetadata` function is not yet implemented then skip the upcoming code
                          if (checkMetadata == null)
                            return

                          // If there's a tree object already then attempt to destroy it
                          if (jsTreeObject != null)
                            try {
                              workareaElement.find(`div.metadata-content[data-id="${metadataContentID}"]`).jstree('destroy')
                            } catch (e) {}

                          // Trigger the `click` event for the search in metadata tree view button; to make sure it's reset
                          workareaElement.find(`div.btn[data-id="${searchInMetadataBtnID}"]`).trigger('click', true)

                          // Add log about this refreshing process
                          try {
                            addLog(`Request to refresh the metadata of the cluster connected to by '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                          } catch (e) {}

                          // Reset the metadata trigger
                          isMetadataFetched = false

                          // Show the loading of the tree view
                          $(this).parent().parent().parent().addClass('loading')

                          // Check metadata with `refresh` = `true`
                          checkMetadata(true)
                        })

                        // Handle the search feature inside the metadata tree view
                        {
                          // Point at the search container
                          let searchContainer = workareaElement.find('div.search-in-metadata'),
                            // Point at the metadata tree view container
                            metadataContent = workareaElement.find(`div.metadata-content[data-id="${metadataContentID}"]`),
                            // Flag to tell if the search container is shown already
                            isSearchShown = false,
                            // The timeout function to be defined for the starting the search process
                            searchTimeout

                          // Clicks the search button/icon
                          workareaElement.find(`div.btn[data-id="${searchInMetadataBtnID}"]`).on('click', function(e, overrideFlag = null) {
                            // If an override flag has been passed - true/false for showing the search container - then adopt this flag
                            if (overrideFlag != null)
                              isSearchShown = overrideFlag

                            // Apply a special effect for the tree view based on the current showing status
                            metadataContent.toggleClass('show-search-input', !isSearchShown)

                            setTimeout(() => {
                              // Show or hide the search input based on the current showing status
                              searchContainer.toggleClass('show', !isSearchShown)

                              // Toggle the flag
                              isSearchShown = !isSearchShown

                              // If the new status is to show the search input then skip the upcoming code
                              if (isSearchShown)
                                return

                              // Empty the search value - if there's one -
                              searchContainer.find('input').val('').trigger('input')

                              // Hide the navigation arrows
                              workareaElement.find('div.right-elements').removeClass('show')
                            })
                          })

                          // When the user types in the search input
                          searchContainer.find('input').on('input', function() {
                            // Make sure to clear any ongoing timeout processes
                            if (searchTimeout != null)
                              clearTimeout(searchTimeout)

                            /**
                             * Perform a search process after a set time of finish typing
                             * This delay will avoid any potential performance issues
                             */
                            searchTimeout = setTimeout(() => {
                              try {
                                $(metadataContent).jstree(true).search($(this).val(), true, false)
                              } catch (e) {}
                            }, 500)
                          })
                        }
                      })

                      // Metadata differentiation section
                      setTimeout(() => {
                        // Point at the snapshot's suffix name container
                        let suffixContainer = workareaElement.find(`div.save-snapshot-suffix[data-id="${saveSnapshotSuffixContainerID}"]`),
                          // Point at the time element; where the snapshot's time will be printed to the user
                          timeElement = suffixContainer.children('div.time'),
                          // Point at the save schema snapshot button
                          saveSnapshotBtn = suffixContainer.children('button'),
                          // Point at the suffix's input field
                          suffixInput = suffixContainer.find('input'),
                          // Get the object of the input field
                          suffixInputObject = getElementMDBObject(suffixInput),
                          // Variable which will hold the formatted version of the snapshot's time
                          timeFormatted

                        // Show the differentiation list - line's number and content -
                        workareaElement.find(`span.btn[data-id="${showDifferentiationBtnID}"]`).click(function() {
                          // Get how many detected changes
                          let changes = parseInt($(this).attr('data-changes'))

                          // If none, then skip the upcoming code and show feedback to the user
                          if (changes <= 0)
                            return showToast(I18next.capitalize(I18next.t('show differentiation')), I18next.capitalizeFirstLetter(I18next.t('there is no difference between the previous and new metadata')) + '.', 'warning')

                          // Show/hide the changes container
                          workareaElement.find(`div.changes-lines[data-id="${changesLinesContainerID}"]`).toggleClass('show')
                        })

                        workareaElement.find(`span.btn[data-id="${diffNavigationPrevBtnID}"]`).click(() => diffEditor.goToDiff('previous'))

                        workareaElement.find(`span.btn[data-id="${diffNavigationNextBtnID}"]`).click(() => diffEditor.goToDiff('next'))

                        // Refresh the new metadata and do a differentiation check
                        workareaElement.find(`span.btn[data-id="${refreshDifferentiationBtnID}"]`).click(function() {
                          // Disable the button
                          $(this).attr('disabled', '').addClass('disabled refreshing')

                          // Get the latest metadata
                          Modules.Connections.getMetadata(connectionID, (metadata) => {
                            try {
                              // Convert the metadata from JSON string to an object
                              metadata = JSON.parse(metadata)

                              // Detect differences
                              // detectDifferentiationShow(JSON.parse(metadataDiffEditors.old.object.getValue()), metadata)

                              // Beautify the received metadata
                              metadata = beautifyJSON(metadata, true)

                              // Update the fetch date and time of the new metadata
                              workareaElement.find(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                              workareaElement.find(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).attr('data-time', `${new Date().getTime()}`)

                              // Update the new editor's value
                              metadataDiffEditors.new.object.setValue(metadata)

                              // Enable the button again
                              $(this).removeAttr('disabled').removeClass('disabled refreshing')
                            } catch (e) {
                              try {
                                errorLog(e, 'connections')
                              } catch (e) {}
                            }
                          })
                        })

                        // Clicks the button to open the save schema snapshot pop-up container
                        workareaElement.find(`span.btn[data-id="${saveSnapshotBtnID}"]`).click(function() {
                          // Reset the suffix value
                          suffixInput.val('')
                          suffixInputObject.update()
                          setTimeout(() => suffixInputObject._deactivate())

                          // Get the current date and time, format it, and show it to the user
                          let time = parseInt(workareaElement.find(`span[data-id="${newMetadataTimeID}"]`).attr('data-time')) || new Date().getTime()
                          timeFormatted = formatTimestamp(time, true).replace(/\:/gm, '_')
                          timeElement.text(`${timeFormatted}`)

                          // Show the save schema snapshot container
                          suffixContainer.addClass('show')

                          // Add a backdrop element
                          $('body').append($(`<div class="backdrop"></div>`).show(function() {
                            // Show it with animation
                            setTimeout(() => $(this).addClass('show'), 50)

                            // Once it's clicked
                            $(this).click(function() {
                              // Remove it
                              $(this).remove()

                              // Hide the snapshot container
                              suffixContainer.removeClass('show')
                            })
                          }))
                        })

                        // Clicks the `SAVE SCHEMA SNAPSHOT` button
                        saveSnapshotBtn.click(function() {
                          // Get the suffix's value
                          let suffix = suffixInput.val(),
                            // Get the new metadata content
                            metadata = metadataDiffEditors.new.object.getValue(),
                            // Get the workspace's folder path
                            workspaceFolderPath = getWorkspaceFolderPath(workspaceID, true),
                            // The snapshot's initial name is the fetched time of the new metadata
                            snapshotName = `${timeFormatted}`

                          try {
                            metadata = JSON.parse(metadata)

                            metadata.time = parseInt(workareaElement.find(`span[data-id="${newMetadataTimeID}"]`).attr('data-time')) || new Date().getTime()

                            metadata = JSON.stringify(metadata)
                          } catch (e) {}

                          // Add log a about the request
                          try {
                            addLog(`Request to save a schema snapshot of the metadata of the cluster connected to by '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                          } catch (e) {}

                          // Minimize the size of the metadata by compression
                          try {
                            metadata = JSON.stringify(JSON.parse(metadata))
                          } catch (e) {}

                          try {
                            suffix = Sanitize(suffix)
                          } catch (e) {}

                          // If there's a suffix then add it to the name
                          if (suffix.trim().length != 0)
                            snapshotName = `${snapshotName}_${suffix}`

                          // Finally add the `.json` extension
                          snapshotName = `${snapshotName}.json`

                          let workspacePath = getWorkspaceFolderPath(workspaceID),
                            filePath = Path.join(isSandbox ? Path.join(workspacePath, '..', '..', 'localclusters') : workspacePath, getAttributes(connectionElement, 'data-folder'), 'snapshots', snapshotName)

                          // Write the snapshot file in the default snapshots folder of the connection
                          FS.writeFile(filePath, metadata, (err) => {
                            // Click the backdrop element; to hide the snapshot's container
                            $('div.backdrop').click()

                            // Show failure feedback to the user and skip the upcoming code
                            if (err)
                              return showToast(I18next.capitalize(I18next.t('save schema snapshot')), I18next.capitalizeFirstLetter(I18next.t('failed to save snapshot, please make sure the app has write permissions and try again')) + '.', 'failure')

                            // Show success feedback to the user
                            showToast(I18next.capitalize(I18next.t('save schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot has been successfully saved with name [b]$data[/b]', [snapshotName])) + '.', 'success')
                          })
                        })

                        // Load a saved snapshot
                        workareaElement.find(`span.btn[data-id="${loadSnapshotBtnID}"]`).click(function() {
                          let workspacePath = getWorkspaceFolderPath(workspaceID),
                            folderPath = Path.join(isSandbox ? Path.join(workspacePath, '..', '..', 'localclusters') : workspacePath, getAttributes(connectionElement, 'data-folder'))

                          // Get all saved snapshots of the connection
                          Modules.Connections.getSnapshots(folderPath, (snapshots) => {
                            // If there are no saved snapshots then show feedback to the user and skip the upcoming code
                            if (snapshots.length <= 0)
                              return showToast(I18next.capitalize(I18next.t('load schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('there are no saved schema snapshots related to the connection [b]$data[/b], attempt first to save one', [getAttributes(connectionElement, 'data-name')])) + '.', 'warning')

                            // Reset some elements' state in the dialog
                            try {
                              // Point at the actions' container
                              let actionsMultiple = $('#loadSnapshot').find('div.actions-multiple')

                              // Hide the actions for multiple snapshots' container
                              actionsMultiple.removeClass('show')

                              // Reset the `check` attribute; so the next time it clicks the snapshots will be checked
                              actionsMultiple.find('a[action="select"]').attr('check', 'true')
                            } catch (e) {}

                            // Point at the snapshot's dialog/modal then get the snapshots' container
                            let snapshotsContainer = $('#loadSnapshot').find('div.snapshots')

                            // Remove all previous snapshots
                            snapshotsContainer.children('div.snapshot').remove()

                            // Loop through each saved snapshot - ordered descending by creation date -
                            snapshots.forEach((snapshot) => {
                              // Snapshot UI element structure
                              let element = `
                                         <div class="snapshot" data-path="${snapshot.path}" data-name="${snapshot.name}">
                                           <div class="_left">
                                             <div class="name">${snapshot.name}</div>
                                             <div class="badges">
                                               <span class="badge badge-primary">${formatTimestamp(snapshot.time)}</span>
                                               <span class="badge badge-secondary">${Bytes(snapshot.size)}</span>
                                             </div>
                                           </div>
                                           <div class="_right">
                                             <a action="load" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                               <ion-icon name="upload"></ion-icon>
                                             </a>
                                             <a action="delete" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" data-confirmed="false">
                                               <ion-icon name="trash"></ion-icon>
                                             </a>
                                             <a action="multiple" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="#1d1d1e">
                                               <input class="form-check-input" type="checkbox">
                                             </a>
                                           </div>
                                         </div>`

                              // Append the snapshot to the container
                              snapshotsContainer.append($(element).show(function() {
                                // Point at the snapshot element
                                let snapshot = $(this),
                                  // Get the snapshot's path and name
                                  [snapshotPath, snapshotName] = getAttributes($(this), ['data-path', 'data-name'])

                                // Apply the chosen language on the UI element after being fully loaded
                                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                                // Clicks the loading button - to load schema snapshot in the old side -
                                $(this).find('a[action="load"]').click(async function() {
                                  try {
                                    // Add log about this loading process
                                    try {
                                      addLog(`Request to load a schema snapshot in path '${snapshotPath}' related to the connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                                    } catch (e) {}

                                    // Read the snapshot's content
                                    let snapshotContent = await FS.readFileSync(snapshotPath, 'utf8')

                                    // Convert it from JSON string to object
                                    snapshotContent = JSON.parse(snapshotContent)

                                    let snapshotTakenTime = ''

                                    try {
                                      snapshotTakenTime = snapshotContent.time

                                      delete snapshotContent.time
                                    } catch (e) {}

                                    // Update the old editor's value
                                    metadataDiffEditors.old.object.setValue(beautifyJSON(snapshotContent, true))

                                    try {
                                      if (snapshotTakenTime.length <= 0)
                                        throw 0

                                      snapshotTakenTime = ` (${formatTimestamp(snapshotTakenTime)})`
                                    } catch (e) {}

                                    // Update the old side's badge
                                    workareaElement.find(`span.old-snapshot[data-id="${oldSnapshotNameID}"]`).text(`: ${snapshot.attr('data-name')}${snapshotTakenTime}`)

                                    // Detect differentiation between the metadata content's after loading the snapshot
                                    // detectDifferentiationShow(snapshotContent, JSON.parse(metadataDiffEditors.new.object.getValue()))

                                    // Show success feedback to the user
                                    showToast(I18next.capitalize(I18next.t('load schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the schema snapshot [b]$data[/b] has been successfully loaded', [snapshot.attr('data-name')])) + '.', 'success')

                                    // Close the modal/dialog
                                    $('div.modal#loadSnapshot').find('button.btn-close').click()
                                  } catch (e) {
                                    try {
                                      errorLog(e, 'connections')
                                    } catch (e) {}

                                    // If any error has occurred then show feedback to the user about the failure
                                    showToast(I18next.capitalize(I18next.t('load schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to load the snapshot [b]$data[/b], make sure the file exists and it is a valid [code]JSON[/code]', [snapshot.attr('data-name')])) + '.', 'failure')
                                  }
                                })

                                // Delete a snapshot
                                $(this).find('a[action="delete"]').on('click', function(e, info) {
                                  // Inner function to delete a snapshot
                                  let deleteSnapshot = (keepFiles = false) => {
                                    let callbackFunction = (err) => {
                                      // If any error has occurred then show feedback to the user and skip the upcoming code
                                      if (err) {
                                        // Add error log
                                        try {
                                          errorLog(e, 'connections')
                                        } catch (e) {}

                                        // Show feedback to the user
                                        showToast(I18next.capitalize(I18next.t('delete schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to delete the snapshot [b]$data[/b], it may be already deleted or there is no permission granted to delete it', [snapshotName])) + '.', 'failure')

                                        // Skip the upcoming code
                                        return
                                      }

                                      // Show success feedback to the user
                                      showToast(I18next.capitalize(I18next.t('delete schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot [b]$data[/b] has been successfully deleted', [snapshotName])) + '.', 'success')

                                      // Remove the snapshot UI element in the container
                                      snapshot.remove()

                                      // If no saved snapshots left then close the modal/dialog
                                      if (snapshotsContainer.children('div.snapshot').length <= 0)
                                        $('#showLoadSnapshotDialog').click()
                                    }

                                    // Remove the snapshot file
                                    if (!keepFiles)
                                      FS.remove(snapshotPath, callbackFunction)

                                    // Keep the snapshot file, however, adding a prefix to the extension will cause to be ignored by the app
                                    if (keepFiles) {
                                      FS.move(snapshotPath, `${snapshotPath}_DEL_${getRandom.id(5)}`, callbackFunction)
                                    }
                                  }

                                  // Add log about this deletion process
                                  try {
                                    addLog(`Request to delete a snapshot in path '${snapshotPath}' related to the connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                                  } catch (e) {}

                                  // If no need for confirmation then call the deletion function and skip the upcoming code
                                  try {
                                    if (info.noConfirm)
                                      return deleteSnapshot(info.checked)
                                  } catch (e) {}

                                  // Open the confirmation dialog and wait for the response
                                  openDialog(I18next.capitalizeFirstLetter(I18next.replaceData('do you want to delete the snapshot [b]$data[/b]? once you confirm, there is no undo', [snapshotName])), (response) => {
                                    // If canceled, or not confirmed then skip the upcoming code
                                    if (!response.confirmed)
                                      return

                                    // Call the deletion function
                                    deleteSnapshot(response.checked)
                                  }, true, 'keep the associated files in the system')
                                })

                                // Select the snapshot to be deleted
                                $(this).find('a[action="multiple"] input').change(function() {
                                  // Get the number of selected snapshots
                                  let checkedSnapshots = snapshotsContainer.find('div.snapshot').find('a[action="multiple"] input').filter(':checked'),
                                    unCheckedSnapshots = snapshotsContainer.find('div.snapshot').find('a[action="multiple"] input').filter(':not(:checked)')

                                  // Show/hide the actions for multiple snapshots based on the number of selected ones
                                  $('#loadSnapshot div.actions-multiple').toggleClass('show', checkedSnapshots.length != 0)

                                  $('#loadSnapshot').find('div.actions-multiple').find('a[action="select"]').attr('check', unCheckedSnapshots.length > 0 ? 'true' : 'false')
                                })
                              }))
                            })

                            // Show the modal/dialog once all processes completed
                            $('#showLoadSnapshotDialog').click()
                          })
                        })

                        // Open the snapshots' folder
                        workareaElement.find(`span.btn[data-id="${openSnapshotsFolderBtnID}"]`).click(() => {
                          let workspacePath = getWorkspaceFolderPath(workspaceID),
                            folderPath = Path.join(isSandbox ? Path.join(workspacePath, '..', '..', 'localclusters') : workspacePath, getAttributes(connectionElement, 'data-folder'), 'snapshots')

                          try {
                            Open(folderPath)
                          } catch (e) {}
                        })

                        // Change the editors view - vertical and horizontal -
                        workareaElement.find(`span.btn[data-id="${changeViewBtnID}"]`).click(function() {
                          // Point at the cluster's metadata differentiation content's container
                          let metadataContentContainer = workareaElement.find(`div#_${metadataDifferentiationContentID} div.metadata-content-container`),
                            // Whether or not a horizontal view is already applied
                            isViewHorizontal = metadataContentContainer.hasClass('view-horizontal')

                          // Toggle the horizontal class based on the checking result
                          metadataContentContainer.toggleClass('view-horizontal', !isViewHorizontal)

                          // Change the button's icon based on the checking result as well
                          $(this).children('ion-icon').attr('name', `diff-${isViewHorizontal ? 'vertical' : 'horizontal'}`)

                          // Trigger the `resize` event to adjust editors' dimensions
                          $(window.visualViewport).trigger('resize')
                        })
                      })

                      // The `click` event for all tabs in the work area
                      setTimeout(() => {
                        // With every `click` event of one of the tabs
                        workareaElement.find('a[href*="#_"]').click(() => {
                          /**
                           * Trigger the `resize` event for the entire window
                           * This will resize editors and terminals
                           */
                          setTimeout(() => $(window.visualViewport).trigger('resize'), 100)
                        })
                      })

                      // Clicks either the restart or the close buttons for the connection's work area
                      setTimeout(() => {
                        workareaElement.find(`div.btn[data-id="${restartWorkareaBtnID}"]`).add(`div.btn[data-id="${closeWorkareaBtnID}"]`).on('click', (event, moveToWorkspace = true) => {
                          // Add log for this action
                          try {
                            addLog(`Request to close/refresh the work area of the connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                          } catch (e) {}

                          // Ask the user for credentials again if they're required
                          try {
                            // Get the related attributes
                            let [credentialsAuth, credentialsSSH] = getAttributes(connectionElement, ['data-credentials-auth', 'data-credentials-ssh'])

                            try {
                              // If there's no need to ask for the DB authentication credentials then skip this try-catch block
                              if (credentialsAuth == undefined)
                                throw 0

                              connectionElement.removeAttr('data-username data-password data-got-credentials')
                            } catch (e) {}

                            try {
                              // If there's no need to ask for the SSH credentials then skip this try-catch block
                              if (credentialsSSH == undefined)
                                throw 0

                              connectionElement.removeAttr('data-ssh-username data-ssh-password data-got-credentials')
                            } catch (e) {}
                          } catch (e) {}

                          try {
                            // If the current workspace is not the sandbox or it's not a `close` event then skip this try-catch block
                            if (!isSandbox || !$(event.currentTarget).is(workareaElement.find(`div.btn[data-id="${closeWorkareaBtnID}"]`)))
                              throw 0

                            // Show the test connection state - it's used here to indicate the closing process of a sandbox project -
                            connectionElement.addClass('test-connection')

                            // Show the termination process' button
                            setTimeout(() => connectionElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                            // Disable all buttons inside the sandbox project's element in the connections/sandbox projects container
                            connectionElement.find('button').attr('disabled', '')

                            /**
                             * Create a pinned toast to show the output of the process
                             *
                             * Get a random ID for the toast
                             */
                            let pinnedToastID = getRandom.id(10)

                            // Show/create that toast
                            pinnedToast.show(pinnedToastID, I18next.capitalize(I18next.t('stop local cluster')) + ' ' + getAttributes(connectionElement, 'data-name'), '')

                            // Attempt to close/stop the docker project
                            Modules.Docker.getDockerInstance(connectionElement).stopDockerCompose(pinnedToastID, (feedback) => {
                              /**
                               * Failed to close/stop the project
                               * Show feedback to the user and skip the upcoming code
                               */
                              if (!feedback.status)
                                return showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] were not successfully stopped', [getAttributes(connectionElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                              /**
                               * Successfully closed/stopped
                               * Show feedback to the user
                               */
                              showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] have been successfully stopped', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

                              // Reset the sandbox project's element in the clusters/sandbox projects container
                              connectionElement.removeClass('test-connection enable-terminate-process')
                              connectionElement.find('button').removeAttr('disabled')
                              connectionElement.children('div.status').removeClass('show success')

                              // Hide the termination process' button after a set time out
                              setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
                            })

                            // Show the initial feedback to the user which
                            showToast(I18next.capitalize(I18next.t('close local cluster work area')), I18next.capitalizeFirstLetter(I18next.replaceData('the work area of the local cluster [b]$data[/b] has been successfully closed, attempting to stop the local cluster containers', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

                            // Reset the button's text
                            setTimeout(() => $(`button[button-id="${startProjectBtnID}"]`).children('span').attr('mulang', 'start').text(I18next.t('start')))
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Point at the current active work aree
                          let workarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${connectionID}"]`)

                          // Send the `quit` command to the CQLSH instance
                          IPCRenderer.send('pty:command', {
                            id: connectionID,
                            cmd: 'quit'
                          })

                          // Send a `close` request for the pty instance
                          IPCRenderer.send('pty:close', connectionID)

                          /**
                           * Remove all listeners to the data coming from the pty instance
                           * This will prevent having multiple listeners in the background
                           */
                          try {
                            IPCRenderer.removeAllListeners(`pty:data:${connectionID}`)
                          } catch (e) {}

                          setTimeout(() => {
                            // Remove both editors in the metadata differentiation section
                            (['old', 'new']).forEach((type) => {
                              try {
                                metadataDiffEditors[type].object.getModel().dispose()
                              } catch (e) {}
                            })

                            // Remove the terminal and all its components
                            try {
                              terminal.dispose()
                              terminal._core.dispose()
                              terminal._addonManager.dispose()
                              terminal = null
                            } catch (e) {}

                            try {
                              // If the clicked button is not for restarting the work area then skip this try-catch block
                              if (!$(event.currentTarget).is(workareaElement.find(`div.btn[data-id="${restartWorkareaBtnID}"]`)))
                                throw 0

                              // Remove the work area element
                              workarea.remove()

                              // Click the button to connect with the connection again
                              $(`button[button-id="${connectBtnID}"]`).trigger('click', true)

                              // Add an AxonOps webview if needed
                              setTimeout(() => {
                                try {
                                  // Get the chosen port and the final URL
                                  let axonopsPort = getAttributes(connectionElement, 'data-port-axonops'),
                                    axonopsURL = `http://localhost:${axonopsPort}`

                                  // If the provided port is not actually a number then skip this try-catch block
                                  if (isNaN(axonopsPort))
                                    throw 0

                                  // Append the `webview` ElectronJS custom element
                                  workareaElement.find(`div.tab-pane#_${localClustersAxonopsContentID}`).append($(`<webview src="${axonopsURL}" nodeIntegrationInSubFrames nodeintegration preload="${Path.join(__dirname, '..', '..', '..', 'js', 'axonops_agent_webview.js')}"></webview>`).show(function() {
                                    // Point at the webview element
                                    let webView = $(this)[0]

                                    // Reload it after 1s of creation
                                    try {
                                      setTimeout(() => webView.reloadIgnoringCache(), 1000)
                                    } catch (e) {}

                                    // Once the content inside the webview is ready/loaded
                                    webView.addEventListener('dom-ready', () => {
                                      // Once a message from the IPC is received
                                      webView.addEventListener(`ipc-message`, (event) => {
                                        // If it's a request to reload the webview then reload it
                                        if (event.channel == 'reload-webview')
                                          webView.reloadIgnoringCache()
                                      })
                                    })
                                  }))

                                  // Clicks the globe icon in the connection's info
                                  workareaElement.find(`div[content="workarea"] div.workarea[connection-id="${connectionID}"]`).find('div.axonops-agent').click(() => {
                                    try {
                                      Open(axonopsURL)
                                    } catch (e) {}
                                  })
                                } catch (e) {}
                              }, 1000)

                              // Skip the upcoming code - as it's for closing the work area
                              return
                            } catch (e) {}

                            // Update the work-area attribute
                            connectionElement.attr('data-workarea', 'false')

                            // Update the status of the connection in the mini connection's list
                            updateMiniConnection(workspaceID, connectionID, true)

                            // Flag to tell if the workarea is actually visible
                            let isWorkareaVisible = workarea.is(':visible')

                            // Destroy Tippy tooltips in this workarea as it has been closed/removed
                            try {
                              workarea.find('[data-title]').each(function() {
                                try {
                                  let tippyInstance = mdbObjects.find((obj) => obj.type === 'Tooltip' && obj.element && $(this).is(obj.element))

                                  if (!(tippyInstance && tippyInstance.object))
                                    throw 0

                                  tippyInstance.object.destroy()

                                  // Remove from mdbObjects array
                                  let index = mdbObjects.indexOf(tippyInstance)

                                  if (index !== -1)
                                    mdbObjects.splice(index, 1)
                                } catch (e) {}
                              })
                            } catch (e) {}

                            // Dispose Monaco editors and remove from global registry
                            for (let editorUI of workarea.find('div.monaco-editor').get()) {
                              try {
                                let editor = monaco.editor.getEditors().find((editor) => $(editorUI).parent().is(editor._domElement))

                                if (!editor)
                                  throw 0

                                // Remove from diffEditors array if it's a diff editor
                                let diffEditorIndex = diffEditors.indexOf(editor)

                                if (diffEditorIndex !== -1)
                                  diffEditors.splice(diffEditorIndex, 1)

                                // Dispose the editor
                                editor.dispose()
                              } catch (e) {}
                            }

                            // Memory leak fix: Destroy Chart.js instances for this workarea
                            try {
                              Object.keys(queryTracingChartsObjects).forEach((chartKey) => {
                                try {
                                  if (queryTracingChartsObjects[chartKey] && queryTracingChartsObjects[chartKey].canvas) {
                                    // Check if this chart belongs to the workarea being closed
                                    if (workarea.find(queryTracingChartsObjects[chartKey].canvas).length > 0) {
                                      queryTracingChartsObjects[chartKey].destroy()

                                      delete queryTracingChartsObjects[chartKey]
                                    }
                                  }
                                } catch (e) {}
                              })
                            } catch (e) {}

                            // Remove the work area element
                            workarea.remove()

                            /**
                             * Get all scripts to be executed associated with the connection
                             * Here only the post-connection scripts will be considered
                             */
                            Modules.Connections.getPrePostScripts(workspaceID, connectionID).then((scripts) => {
                              // Define a variable to save the scripts' execution feedback
                              let executionFeedback = ''

                              try {
                                // If there's no post-connection script to execute then skip this try-catch block
                                if (scripts.post.length <= 0)
                                  throw 0

                                // Show feedback to the user about starting the execution process
                                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('post-connection scripts are being executed after closing the connection [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(connectionElement, 'data-name')])) + '.'), 50)

                                // Execute the post-connection scripts in order
                                Modules.Connections.executeScript(0, scripts.post, (executionResult) => {
                                  try {
                                    // If we've got `0` - as a final result - then it means all scripts have been executed with success and returned `0`; so skip this try-catch block and show a success feedback to the user
                                    if (executionResult.status == 0)
                                      throw 0

                                    // Show feedback to the user about the script which failed
                                    let info = `${I18next.t('script "$data" didn\'t return the success code [code]0[/code], but')} <code>${executionResult.status}</code>.`

                                    if (status == -1000)
                                      info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                                    // Set final feedback
                                    executionFeedback = `. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`

                                    // Show feedback to the user
                                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of connection [b]$data[/b]', [I18next.t('post'), getAttributes(connectionElement, 'data-name')]))}${executionFeedback}`, 'failure'), 50)
                                  } catch (e) {
                                    // Show success feedback to the user if the error is `0` code
                                    if (e == 0)
                                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of connection [b]$data[/b] have been successfully executed', [I18next.t('post'), getAttributes(connectionElement, 'data-name')])) + '.', 'success'), 50)
                                  }
                                })
                              } catch (e) {}
                            })

                            // Clicks the `ENTER` button for the connection's workspace
                            if (moveToWorkspace || isWorkareaVisible)
                              $(`div.workspaces-container div.workspace[data-id="${getAttributes(connectionElement, 'data-workspace-id')}"]`).find('div.button button').click()

                            setTimeout(() => {
                              try {
                                // Handle the reset of the UI if the process is not restarting the work area
                                if ($(event.currentTarget).is(workareaElement.find(`div.btn[data-id="${restartWorkareaBtnID}"]`)))
                                  throw 0

                                // Point at both buttons; the `CONNECT` and `TEST CONNECTION`
                                let connectBtn = $(`button[button-id="${connectBtnID}"]`),
                                  testConnectionBtn = $(`button[button-id="${testConnectionBtnID}"]`); // This semicolon is critical here

                                // Reset the text of each button
                                ([connectBtn, testConnectionBtn]).forEach((button) => button.children('span').attr('mulang', button.is(connectBtn) ? 'connect' : 'test connection').text(I18next.t(button.is(connectBtn) ? 'connect' : 'test connection')))

                                // Disable the `CONNECT` button
                                connectBtn.attr('disabled', '')

                                $(`button[button-id="${connectAltBtnID}"]`).attr('hidden', null)
                                $(`button[button-id="${connectBtnID}"]`).attr('hidden', '')

                                // Reset the connection's connection status
                                connectionElement.find('div.status').removeClass('show success failure')
                              } catch (e) {}
                            })

                            setTimeout(() => {
                              /**
                               * Remove the connection from the switcher
                               *
                               * Point at the connections' switchers container
                               */
                              let connectionSwitcher = $(`div.body div.left div.content div.switch-connections`)

                              // Remove the connection's switcher
                              $(`div.body div.left div.content div.switch-connections div.connection[_connection-id="${connectionID}"]`).remove()

                              // Update the switchers' container's view
                              updateSwitcherView('connections')

                              // Handle the first switcher's margin
                              handleConnectionSwitcherMargin()

                              // If there are no more active connections then hide the switcher's container
                              if (connectionSwitcher.children('div.connection').length <= 0)
                                connectionSwitcher.removeClass('show')
                            }, 10)
                          })
                        })
                      })
                    }

                    // Add the connection's switcher to the container
                    try {
                      // If the switcher already exists or this is a restarting process then skip this try-catch block
                      if ($(`div.body div.left div.content div.switch-connections div.connection[_connection-id="${workspaceID}"]`).length != 0 || restart)
                        throw 0

                      // Point at the connections' switchers container
                      let connectionSwitcher = $(`div.body div.left div.content div.switch-connections`),
                        // Get the container's height
                        switcherCurrentHeight = connectionSwitcher.outerHeight()

                      // Set the container's height; to guarantee a smooth height update animation
                      connectionSwitcher.css('height', `${switcherCurrentHeight}px`)

                      // If there's no active connections yet then make set the container's height to `0`
                      if (connectionSwitcher.children('div.connection').length <= 0)
                        switcherCurrentHeight = 0

                      // Check if the upcoming switcher will cause an overflow
                      setTimeout(() => {
                        // Define the new height
                        let newHeight = switcherCurrentHeight + 35,
                          // Define the new maximum allowed height
                          newHeightAllowed = calcSwitchersAllowedHeight()

                        // Divide the new height by two - as there are two switchers' containers
                        newHeightAllowed = newHeightAllowed / 2

                        // Determine if there's a need to handle an overflow
                        let hideSwitcher = newHeight >= newHeightAllowed

                        // Toggle the shown/hide of the navigation arrows
                        connectionSwitcher.toggleClass('show-more', hideSwitcher)

                        // Update the container's height
                        if (!hideSwitcher)
                          connectionSwitcher.css('height', `${switcherCurrentHeight + 35}px`)

                        setTimeout(() => {
                          // Show the container
                          connectionSwitcher.addClass('show')

                          // Define the connection's host
                          let connectionHost = getAttributes(connectionElement, 'data-host'),
                            // Define the connection's color
                            workspaceColor = getAttributes(workspaceElement, 'data-color')

                          // Slice it if needed
                          connectionHost = connectionHost.length > 20 ? `${connectionHost.slice(0, 20)}...` : connectionHost

                          // Connection's switcher UI element structure
                          let element = `
                                     <div class="connection" _connection-id="${connectionID}" style="box-shadow: inset 0px 0px 0 1px ${workspaceColor || '#7c7c7c'};" active ${hideSwitcher ? "hidden" : "" }>
                                       <button type="button" style="color: ${workspaceColor};" class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="right" data-mdb-html="true"
                                         data-title="<span class='tooltip-left'>${getAttributes(connectionElement, 'data-name')}<br>${connectionHost}</span>" data-mdb-html="true" data-mdb-customClass="tooltip-left">${extractTwoCharsConnectionName(getAttributes(connectionElement, 'data-name'))}</button>
                                     </div>`

                          // Define the suitable adding function based on whether or not there's an overflow
                          let addingFunction = {
                            element: connectionSwitcher,
                            method: 'append'
                          }

                          try {
                            // If there's no need to handle an overflow then skip this try-catch block
                            if (!hideSwitcher)
                              throw 0

                            // Update the adding function's attributes
                            addingFunction = {
                              element: connectionSwitcher.children('div.show-more-connections'),
                              method: 'after'
                            }
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Append the switcher to the container
                          addingFunction.element[addingFunction.method]($(element).show(function() {
                            // Variable which will hold the tooltip's MDB object
                            let tooltip

                            try {
                              // If there's no need to handle an overflow then skip this try-catch block
                              if (!hideSwitcher)
                                throw 0

                              // Show the current swticher
                              $(this).removeAttr('hidden')

                              // And hide the last visible switcher
                              connectionSwitcher.children('div.connection').filter(':visible').last().hide()
                            } catch (e) {}

                            setTimeout(() => {
                              // Show the switcher
                              $(this).addClass('show')

                              // Get the switcher's tooltip's MDB object
                              tooltip = getElementMDBObject($(this).children('button'), 'Tooltip')

                              // Deactivate all switchers
                              $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                              // Activate the connection's switcher
                              $(this).attr('active', '')
                            }, 150)

                            // Handle the `click` event of the switcher
                            setTimeout(() => {
                              $(this).children('button').click(function() {
                                // Point at the connection's workspace's UI element
                                let workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`),
                                  // Point at the connection's UI element
                                  connectionElement = $(`div[content="connections"] div.connections-container div.connections[workspace-id="${workspaceID}"] div.connection[data-id="${connectionID}"]`)

                                // Add log about this action
                                try {
                                  addLog(`Switch to the work area of the connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                                } catch (e) {}

                                // Set the workspace's color on the UI
                                setUIColor(getAttributes(workspaceElement, 'data-color'))

                                // Deactivate all switchers
                                $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                                // Activate the connection's switcher
                                $(this).parent().attr('active', '')

                                // Hide the switcher's tooltip once it's clicked
                                tooltip.hide()

                                // Click the `CONNECT` button of the connection
                                connectionElement.find('div.button button.connect').click()

                                /**
                                 * Trigger the `resize` function of the window
                                 * This will fit and resize related elements in the work area - especially the terminal -
                                 */
                                setTimeout(() => $(window.visualViewport).trigger('resize'), 500)
                              })
                            })

                            // Handle the `right button` click event of the switcher
                            setTimeout(() => {
                              $(this).mousedown(function(event) {
                                // Make sure the `right button` is one which clicked
                                if (event.which != 3)
                                  return

                                // Send a request to the main thread regards pop-up a menu
                                IPCRenderer.send('show-context-menu', JSON.stringify([{
                                  label: I18next.capitalizeFirstLetter(`${I18next.t('close connection')} (${I18next.capitalizeFirstLetter(I18next.t('disconnect'))})`),
                                  click: `() => views.main.webContents.send('workarea:close', {
                                            btnID: '${closeWorkareaBtnID}'
                                          })`
                                }]))
                              })
                            })

                            // Handle the first switcher's margin
                            setTimeout(() => handleConnectionSwitcherMargin())
                          }))
                        }, 200)
                      })
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }

                    // Allow for resizing the left side of the work area taking into account all affected elements
                    {
                      setTimeout(() => {
                        // Point at both sides - left and right -
                        let rightSide = workareaElement.children('div.sub-sides.right'),
                          leftSide = workareaElement.children('div.sub-sides.left'),
                          // The minimum width allowed for resizing is the default left side's width
                          leftSideMinWidth = leftSide.outerWidth(),
                          // Get the right side's transition value
                          rightSideTransition = rightSide.css('transition')

                        // Make the left side resizable
                        leftSide.resizable({
                          handles: 'e', // [E]ast
                          minWidth: leftSideMinWidth, // Minimum width allowed to be reached
                          maxWidth: !isSandbox ? 1333 : 1170 // Maximum width allowed to be reached
                        }).bind({
                          // While the resizing process is active
                          resize: function(_, __) {
                            // Update the right side's width based on the new left side's width
                            rightSide.css({
                              'width': `calc(100% - ${leftSide.outerWidth()}px)`,
                              'transition': `all 0s`
                            })

                            /**
                             * Trigger the `resize` event for the entire window
                             * This will resize editors and terminals
                             */
                            {
                              // Attempt to clear the timeout if it has already been created
                              try {
                                clearTimeout(global.resizeTriggerOnResize)
                              } catch (e) {}

                              // Set a global timeout object
                              global.resizeTriggerOnResize = setTimeout(() => $(window.visualViewport).trigger('resize', {
                                ignoreLabels: true
                              }))
                            }

                            // Get the minimum width allowed to be reached for the right side before hiding the tabs' titles
                            let minimumAllowedWidth = !isSandbox ? 867 : 1215,
                              // Decide whether or not the tabs' titles should be shown
                              showTabsTitles = rightSide.outerWidth() > minimumAllowedWidth,
                              // Get all tabs' tooltips in the work area
                              workareaTooltipElements = [...workareaElement.find('[tab-tooltip]')],
                              // Get tooltips' objects of the tabs' tooltips
                              workareaTooltipObjects = mdbObjects.filter((mdbObject) => workareaTooltipElements.some((elem) => mdbObject.element.is(elem)))

                            // Inside the workareas, find all tabs' titles and toggle their display based on the window width
                            workareaElement
                              .find('div.connection-tabs ul a.nav-link span.title')
                              .toggleClass('ignore-resize', !showTabsTitles)
                              .toggle(showTabsTitles)

                            let hideRightSideButtonsLabels = rightSide.outerWidth() <= 1145,
                              hideButtonsLabels = rightSide.outerWidth() <= 920

                            $('div.tab-content div.tab-pane[tab="cqlsh-session"] div.interactive-terminal-container div.session-actions').toggleClass('hide-labels-right-side', hideRightSideButtonsLabels)

                            $('div.tab-content div.tab-pane[tab="cqlsh-session"] div.interactive-terminal-container div.session-actions').toggleClass('hide-labels', hideButtonsLabels)

                            // Enable/disable the work area's tabs' tooltips
                            workareaTooltipObjects.forEach((mdbObject) => mdbObject.object[!showTabsTitles ? 'enable' : 'disable']())
                          },
                          // Once the resizing process stopped/finished
                          stop: function(_, __) {
                            // Return the original transition's value
                            rightSide.css('transition', rightSideTransition)

                            /**
                             * Trigger the `resize` function of the window
                             * This will fit and resize related elements in the work area - especially the terminal -
                             */
                            $(window.visualViewport).trigger('resize', {
                              ignoreLabels: true
                            })
                          }
                        })
                      })
                    }

                    // Update the button's text to be `ENTER`
                    setTimeout(() => $(`button[button-id="${connectBtnID}"]`).children('span').attr('mulang', 'enter').text(I18next.t('enter')), 1000)

                    setTimeout(() => {
                      $(`button[button-id="${connectAltBtnID}"]`).attr('hidden', '')
                      $(`button[button-id="${connectBtnID}"]`).attr('hidden', null)
                    }, 1000)

                    // Update the test connection's button's text to be `DISCONNECT`
                    setTimeout(() => $(`button[button-id="${testConnectionBtnID}"]`).children('span').attr('mulang', 'disconnect').text(I18next.t('disconnect')), 1000)

                    /*
                     * Check the connectivity with the current connection
                     * Define a flag to be used in wider scope - especially for the right-click context-menu of the tree view items -
                     */
                    isConnectionLost = false

                    {
                      // By default, the flag to show a toast regards lost connection is set to `false`
                      let isLostConnectionToastShown = false

                      setTimeout(() => {
                        // Inner function to check the connectivity status
                        let checkConnectivity = () => {
                          return

                          /**
                           * Handle if the basic terminal is currently active
                           * In this case, the app won't perform a connectivity check
                           */
                          try {
                            // If the basic terminal is not active then skip this try-catch block
                            if (workareaElement.find(`div[data-id="${terminalContainerID}"]`).css('display') == 'none')
                              throw 0

                            // Perform a new check process after 1 minute
                            setTimeout(() => checkConnectivity(), 60000)

                            // Skip the upcoming code
                            return
                          } catch (e) {}

                          // Point at the connection status element in the UI
                          let connectionStatusElement = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${getAttributes(connectionElement, 'data-id')}"][workarea-id="${workareaID}"]`).find('div.connection-status')

                          // If the connection status UI element is not exists then the work area has been closed and the check process should be terminated
                          if (connectionStatusElement.length <= 0 || connectionStatusElement == null)
                            return

                          // Call the connectivity check function from the connections' module
                          Modules.Connections.checkConnectivity(getAttributes(connectionElement, 'data-id'), (connected) => {
                            // Show a `not-connected` class if the app is not connected with the connection
                            connectionStatusElement.removeClass('show connected not-connected').toggleClass('show not-connected', !connected)

                            // Perform a check process every 1 minute
                            setTimeout(() => checkConnectivity(), 60000)

                            // Update the associated flag
                            isConnectionLost = !connected

                            /**
                             * Apply different effects on the work area UI
                             * Update the connection's element in the connections' list
                             */
                            // connectionElement.attr('data-connected', connected ? 'true' : 'false')
                            //   .children('div.status').addClass(connected ? 'success' : 'failure').removeClass(connected ? 'failure' : 'success')

                            // Disable selected buttons
                            workareaElement.find('.disableable').toggleClass('disabled', !connected)

                            try {
                              /**
                               * In case the app is not connected with the connection
                               * If the app is connected then skip this try-catch block
                               */
                              if (connected)
                                throw 0

                              // If the toast/feedback regards lost connection has been shown then skip the upcoming code
                              if (isLostConnectionToastShown)
                                return

                              // Show feedback to the user
                              showToast(I18next.capitalize(I18next.replaceData(`connection $data lost`, [getAttributes(connectionElement, 'data-name')])), I18next.capitalizeFirstLetter(I18next.replaceData(`connection [b]$data[/b] in workspace [b]$data[/b] is lost. A toast will be shown when the connection is restored. Most of the work area processes are now non-functional`, [getAttributes(connectionElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'warning')

                              // Update the associated flag in order to not show that feedback in this checking cycle
                              isLostConnectionToastShown = true

                              // Skip the upcoming code
                              return
                            } catch (e) {}

                            try {
                              /**
                               * Reaching here means the app is connected with the connection
                               * If the toast/feedback regards lost connection hasn't been shown already then there's no need to show the restore connection feedback, skip this try-catch block
                               */
                              if (!isLostConnectionToastShown)
                                throw 0

                              // Update the associated flag
                              isLostConnectionToastShown = false

                              // Show feedback to the user
                              showToast(I18next.capitalize(I18next.replaceData(`connection $data restored`, [getAttributes(connectionElement, 'data-name')])), I18next.capitalizeFirstLetter(I18next.replaceData(`connection [b]$data[/b] in workspace [b]$data[/b] has been restored. All work area processes are now functional`, [getAttributes(connectionElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'success')
                            } catch (e) {}
                          })
                        }

                        // Start the checking process after 30 seoncds of creating the work area
                        setTimeout(() => checkConnectivity(), 30000)
                      })
                    }

                    // Handle the history feature
                    {
                      // Point at the history items' container
                      let historyItemsContainer = $(this).find('div.history-items'),
                        historyItemsClearAllButton = $(this).find('div.history-items-clear-all'),
                        // Point at the history show button
                        historyBtn = $(this).find('div.session-action[action="history"]').find('button.btn'),
                        // Get the current saved items
                        savedHistoryItems = Store.get(connectionID) || []

                      // Determine to disable/enable the history button based on the number of saved items
                      historyBtn.attr('disabled', savedHistoryItems.length > 0 ? null : 'disabled')

                      // Clicks the history button
                      historyBtn.click(function() {
                        // Remove all rendered items
                        historyItemsContainer.html('')

                        // Get the saved history items
                        savedHistoryItems = Store.get(connectionID) || []

                        // Reverse the array; to make the last saved item the first one in the list
                        // savedHistoryItems.reverse()

                        // Define index to be set for each history item
                        let index = 0

                        // Loop through each saved history item
                        for (let historyItem of savedHistoryItems) {
                          // Decrement the index
                          index += 1

                          let isSourceCommand = historyItem.startsWith('SOURCE_'),
                            filesPaths = [],
                            isExecutionTerminatedOnError = true

                          try {
                            if (!isSourceCommand)
                              throw 0

                            isExecutionTerminatedOnError = historyItem.slice(`${historyItem}`.indexOf(' |')).includes('true')

                            filesPaths = JSON.parse(`${historyItem}`.slice(8, `${historyItem}`.indexOf(' |')))

                            let numOfFiles = filesPaths.length

                            historyItem = `Execute ${numOfFiles} CQL file(s).`
                          } catch (e) {}

                          // The history item structure UI
                          let element = `
                                     <div class="history-item" data-index="${index}" data-is-source-command="${isSourceCommand}">
                                       <div class="index">${index < 10 ? '0' : ''}${index}</div>
                                       <div class="inner-content">
                                         <pre>${historyItem}</pre>
                                       </div>
                                       <div class="click-area"></div>
                                       <div class="action-execute">
                                         <span class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                           <ion-icon name="execute-solid"></ion-icon>
                                         </span>
                                       </div>
                                       <div class="action-copy">
                                         <span class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                           <ion-icon name="copy-solid"></ion-icon>
                                         </span>
                                       </div>
                                       <div class="action-delete">
                                         <span class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                           <ion-icon name="trash"></ion-icon>
                                         </span>
                                       </div>
                                     </div>`

                          // Append the history item
                          historyItemsContainer.append($(element).show(function() {
                            // Point at the statement input field
                            let statementInputField = workareaElement.find(`textarea#_${cqlshSessionStatementInputID}`)

                            try {
                              if ($(this).attr('data-is-source-command') != 'true')
                                throw 0

                              $(this).find('div.action-copy, div.action-execute').css({
                                'opacity': '0.2',
                                'cursor': 'default',
                                'pointer-events': 'none'
                              })
                            } catch (e) {}

                            // Clicks the item to be typed in the input field
                            $(this).find('div.click-area').click(function() {
                              // Click the backdrop element to close the history items' container
                              $(`div.backdrop:last`).click()

                              // Get the index of the saved item in the array
                              let statementIndex = parseInt($(this).parent().attr('data-index')) - 1,
                                // Get the statement's content
                                statement = savedHistoryItems[statementIndex]

                              try {
                                if ($(this).parent().attr('data-is-source-command') != 'true')
                                  throw 0

                                let executionBtn = $(this).closest('div.tab-pane[tab="cqlsh-session"]').find('div.session-action[action="execute-file"]').find('button.btn')

                                executionBtn.data('filesPaths', filesPaths)
                                executionBtn.data('isExecutionTerminatedOnError', isExecutionTerminatedOnError)

                                executionBtn.trigger('click')

                                $(`div.backdrop:last`).click()

                                return
                              } catch (e) {}

                              // Set the statement
                              consoleEditor.setValue(statement)
                              consoleEditor.focus()

                              let lastLine = consoleEditor.getModel().getLineCount(),
                                lastColumn = consoleEditor.getModel().getLineMaxColumn(lastLine);

                              consoleEditor.setPosition({
                                lineNumber: lastLine,
                                column: lastColumn
                              })

                              // Update the MDB object
                              try {
                                getElementMDBObject(statementInputField).update()
                              } catch (e) {}
                            })

                            $(this).find('div.action-execute').find('span.btn').click(() => {
                              try {
                                // Click the backdrop element to close the history items' container
                                $(`div.backdrop:last`).click()

                                // Get the index of the saved item in the array
                                let statementIndex = parseInt($(this).attr('data-index')) - 1,
                                  // Get the statement's content
                                  statement = savedHistoryItems[statementIndex]

                                // Set the statement
                                statementInputField.val(statement).trigger('input')

                                // Update the MDB object
                                try {
                                  getElementMDBObject(statementInputField).update()
                                } catch (e) {}

                                workareaElement.find(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').find('button').click()
                              } catch (e) {}
                            })

                            $(this).find('div.action-copy').find('span.btn').click(() => {
                              let statement = $(this).find('div.inner-content').children('pre').text(),
                                icon = $(this).find('div.action-copy').find('span.btn').children('ion-icon')

                              // Copy the result to the clipboard
                              try {
                                Clipboard.writeText(statement)

                                icon.attr('name', 'copy')

                                setTimeout(() => icon.attr('name', 'copy-solid'), 150);
                              } catch (e) {
                                try {
                                  errorLog(e, 'connections')
                                } catch (e) {}
                              }
                            })

                            // Delete a history item
                            $(this).find('div.action-delete').find('span.btn').click(function() {
                              // Get the index of the saved item in the array
                              let statementIndex = parseInt($(this).parent().parent().attr('data-index')) - 1

                              // Remove the history item from the array
                              savedHistoryItems.splice(statementIndex, 1)

                              // Reverse the array before save it
                              // savedHistoryItems.reverse()

                              // Set the manipulated array
                              Store.set(connectionID, [...new Set(savedHistoryItems)])

                              try {
                                if (savedHistoryItems.length > 0)
                                  throw 0

                                // Click the backdrop element to close the history items' container
                                $(`div.backdrop:last`).click()

                                // Disable the history button
                                historyBtn.attr('disabled', 'disabled')

                                // Skip the upcoming code
                                return
                              } catch (e) {}

                              // Click the history button to update the items' list
                              historyBtn.click()
                            })

                            // Apply the chosen language on the UI element after being fully loaded
                            setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                          }))
                        }

                        // Show the history items' container
                        historyItemsContainer.add(historyItemsClearAllButton).addClass('show')

                        // If a backdrop element already rendered then skip the upcoming code
                        if ($('body').find('div.backdrop').length > 0)
                          return

                        // Add a backdrop element
                        $('body').append($(`<div class="backdrop"></div>`).show(function() {
                          // Show it with animation
                          setTimeout(() => $(this).addClass('show'), 50)

                          // Once it's clicked
                          $(this).click(function() {
                            // Remove it
                            $(this).remove()

                            // Hide the history items' container
                            historyItemsContainer.add(historyItemsClearAllButton).removeClass('show')
                          })
                        }))
                      })

                      historyItemsClearAllButton.find('button').click(function() {
                        try {
                          Store.set(connectionID, [])

                          // Click the backdrop element to close the history items' container
                          $(`div.backdrop:last`).click()

                          // Disable the history button
                          historyBtn.attr('disabled', 'disabled')

                          showToast(I18next.capitalize(I18next.t('clear all statements')), I18next.capitalizeFirstLetter(I18next.replaceData('all history statements for connection [b]$data[/b] have been successfully cleared', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')
                        } catch (e) {}
                      })
                    }

                    {
                      let consistencyLevelsContainer = $(this).find('div.consistency-levels'),
                        changeLevelsButton = $(this).find('div.change-consistency-levels'),
                        levelsTableParent

                      $(this).find('div.session-action[action="consistency-level"]').find('button.btn').click(function() {
                        consistencyLevelsContainer.add(changeLevelsButton).addClass('show')

                        let allLevels = [],
                          levelsTable = $(`<table><tr><th><ion-icon name="arrow-up-circle"></ion-icon>Standard</th><th><ion-icon name="arrow-up-circle"></ion-icon>Serial</th></tr></table>`)

                        for (let i = 0; i < Modules.Consts.ConsistencyLevels.Regular.length; ++i)
                          allLevels.push([Modules.Consts.ConsistencyLevels.Regular[i], Modules.Consts.ConsistencyLevels.Serial[i]])

                        for (let levels of allLevels) {
                          let serialElement = levels[1] == undefined ? '' : `<div class="level ${activeSessionsConsistencyLevels[activeConnectionID].serial == levels[1] ? 'selected' : ''}" data-type="serial" data-level-name="${levels[1]}">${levels[1]}</div>`

                          levelsTable.append(`
                                  <tr>
                                    <td type="standard">
                                      <div class="level ${activeSessionsConsistencyLevels[activeConnectionID].standard == levels[0] ? 'selected' : ''}" data-type="standard" data-level-name="${levels[0]}">${levels[0]}</div>
                                    </td>
                                    <td type="serial">
                                      ${serialElement}
                                    </td>
                                  </tr>`)
                        }

                        consistencyLevelsContainer.html('')

                        consistencyLevelsContainer.append($(levelsTable).show(function() {
                          levelsTableParent = $(this)

                          levelsTableParent.find('div.level').click(function() {
                            if ($(this).hasClass('selected'))
                              return

                            levelsTableParent.find(`div.level[data-type="${$(this).attr('data-type')}"]`).removeClass('selected')

                            $(this).addClass('selected')
                          })
                        }))

                        // Add a backdrop element
                        $('body').append($(`<div class="backdrop"></div>`).show(function() {
                          // Show it with animation
                          setTimeout(() => $(this).addClass('show'), 50)

                          // Once it's clicked
                          $(this).click(function() {
                            // Remove it
                            $(this).remove()

                            // Hide the history items' container
                            consistencyLevelsContainer.add(changeLevelsButton).removeClass('show')
                          })
                        }))
                      })

                      changeLevelsButton.find('button').click(function() {
                        // Click the backdrop element to close the history items' container
                        $(`div.backdrop:last`).click()

                        try {
                          // Get set levels
                          let setLevels = {
                              standard: levelsTableParent.find(`div.level[data-type="standard"].selected`).attr('data-level-name'),
                              serial: levelsTableParent.find(`div.level[data-type="serial"].selected`).attr('data-level-name')
                            },
                            currentLevels = activeSessionsConsistencyLevels[activeConnectionID],
                            statement = ``

                          if (currentLevels.standard != setLevels.standard)
                            statement = `CONSISTENCY ${setLevels.standard};`

                          if (currentLevels.serial != setLevels.serial)
                            statement = `${statement}${statement.length > 0 ? OS.EOL : ''}SERIAL CONSISTENCY ${setLevels.serial};`

                          if (statement.length <= 0)
                            throw 0

                          let statementInputField = workareaElement.find(`textarea#_${cqlshSessionStatementInputID}`),
                            oldStatement = `${statementInputField.val()}`

                          try {
                            statementInputField.val(statement)
                            statementInputField.trigger('input').focus()
                            AutoSize.update(statementInputField[0])
                          } catch (e) {}

                          try {
                            setTimeout(() => workareaElement.find(`button#_${executeStatementBtnID}`).trigger('click', oldStatement))
                          } catch (e) {}
                        } catch (e) {}
                      })
                    }

                    {
                      let PaginationSizeContainer = $(this).find('div.current-pagination-size'),
                        paginationSizeInput = PaginationSizeContainer.find('input[type="number"]'),
                        changePaginationSize = $(this).find('div.change-pagination-size')

                      $(this).find('div.session-action[action="pagination-size"]').find('button.btn').click(function() {
                        try {
                          paginationSizeInput.val(activeSessionsPaginationSize)

                          getElementMDBObject(paginationSizeInput).update()
                        } catch (e) {}

                        changePaginationSize.find('button').removeClass('disabled')

                        PaginationSizeContainer.add(changePaginationSize).addClass('show')

                        // Add a backdrop element
                        $('body').append($(`<div class="backdrop"></div>`).show(function() {
                          // Show it with animation
                          setTimeout(() => $(this).addClass('show'), 50)

                          // Once it's clicked
                          $(this).click(function() {
                            // Remove it
                            $(this).remove()

                            PaginationSizeContainer.add(changePaginationSize).removeClass('show')
                          })
                        }))
                      })

                      changePaginationSize.find('button').click(function() {
                        // Click the backdrop element to close the history items' container
                        $(`div.backdrop:last`).click()

                        try {
                          let statementInputField = workareaElement.find(`textarea#_${cqlshSessionStatementInputID}`),
                            pagingSize = parseInt(paginationSizeInput.val()),
                            statement = `PAGING ${pagingSize}`,
                            oldStatement = `${statementInputField.val()}`

                          try {
                            statementInputField.val(statement)
                            statementInputField.trigger('input').focus()
                            AutoSize.update(statementInputField[0])
                          } catch (e) {}

                          try {
                            setTimeout(() => workareaElement.find(`button#_${executeStatementBtnID}`).trigger('click', oldStatement))
                          } catch (e) {}
                        } catch (e) {}
                      })

                      paginationSizeInput.on('input', function() {
                        try {
                          if ($(this).val().length <= 0)
                            throw 0

                          let size = parseInt($(this).val())

                          if (size <= 0)
                            throw 0

                          changePaginationSize.find('button').removeClass('disabled')
                        } catch (e) {
                          changePaginationSize.find('button').addClass('disabled')
                        }
                      })
                    }

                    {
                      let queryTracingActionContainer = $(this).find('div.session-action[action="query-tracing"]')

                      queryTracingActionContainer.find('button.btn').click(function() {
                        try {
                          let statementInputField = workareaElement.find(`textarea#_${cqlshSessionStatementInputID}`),
                            isTracingEnabled = queryTracingActionContainer.data('tracingStatus') == true,
                            statement = `TRACING ${isTracingEnabled ? 'OFF' : 'ON'}`,
                            oldStatement = `${statementInputField.val()}`

                          try {
                            statementInputField.val(statement)
                            statementInputField.trigger('input').focus()
                            AutoSize.update(statementInputField[0])
                          } catch (e) {}

                          try {
                            setTimeout(() => workareaElement.find(`button#_${executeStatementBtnID}`).trigger('click', oldStatement))
                          } catch (e) {}
                        } catch (e) {}
                      })
                    }

                    {
                      let executeFilesModal = $('div.modal#executeCQLFiles'),
                        filesContainer = executeFilesModal.find('div.cql-files-container'),
                        filesExecutionBtn = workareaElement.find('div.session-action[action="execute-file"]').find('button.btn')

                      try {
                        filesExecutionBtn.unbind('click')
                      } catch (e) {}

                      filesExecutionBtn.click(function() {
                        // Get a random ID for the dialog request
                        let requestID = getRandom.id(10),
                          // Set other attributes to be used to create the dialog
                          data = {
                            id: requestID,
                            title: I18next.capitalizeFirstLetter(I18next.t('select file(s) to be executed')),
                            properties: ['openFile', 'multiSelections', 'showHiddenFiles'],
                            filters: [{
                                name: I18next.capitalize(I18next.t('supported text files')),
                                extensions: Modules.Consts.SupportedTextFilesExtenstions
                              },
                              {
                                name: I18next.capitalize(I18next.t('all files')),
                                extensions: ['*']
                              }
                            ]
                          }

                        // Listen for the response - folders' paths - and call the check workspaces inner function
                        let handleFilesPaths = (filesPaths, isExecutionTerminatedOnError = true, noSort = false) => {
                          if (filesPaths.length <= 0)
                            return

                          filesContainer.children('div.cql-file').remove()

                          $('input#terminateFileExecutionOnError').prop('checked', isExecutionTerminatedOnError)

                          try {
                            if (noSort)
                              throw 0

                            filesPaths = filesPaths.sort((a, b) => {
                              let baseNameA = Path.basename(minifyText(a)),
                                baseNameB = Path.basename(minifyText(b))

                              if (baseNameA < baseNameB)
                                return -1

                              if (baseNameA > baseNameB)
                                return 1

                              return 0
                            })
                          } catch (e) {}

                          for (let filePath of filesPaths) {
                            filePath = `${filePath}`

                            try {
                              let fileStats = {
                                size: 0
                              }

                              try {
                                fileStats = FS.statSync(filePath)
                              } catch (e) {}

                              let element = `
                                          <div class="cql-file ${fileStats.size <= 0 ? 'invalid' : ''}">
                                            <div class="sort-handler" style="cursor:grab;">
                                              <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                                            </div>
                                            <div class="file-info">
                                              <div class="path">${filePath.slice(1)}</div>
                                              <div class="metadata">
                                                <span class="badge rounded-pill badge-secondary" ${fileStats.size <= 0 ? 'hidden' : ''}><span mulang="size" capitalize></span>: ${Bytes(fileStats.size)}</span>
                                                <span class="badge rounded-pill badge-secondary" ${fileStats.size > 0 ? 'hidden' : ''}>The file is either missing or inaccessible</span>
                                              </div>
                                            </div>
                                            <a class="btn btn-link btn-rounded btn-sm remove-cql-file" data-mdb-ripple-color="light" href="#" role="button">
                                              <ion-icon name="trash"></ion-icon>
                                            </a>
                                          </div>`

                              filesContainer.append($(element).show(function() {
                                let cqlFileElement = $(this)

                                cqlFileElement.data('path', filePath)

                                cqlFileElement.find('a.btn.remove-cql-file').click(function() {
                                  cqlFileElement.remove()

                                  try {
                                    if (filesContainer.children('div.cql-file').length <= 0)
                                      getElementMDBObject(executeFilesModal, 'Modal').hide()
                                  } catch (e) {}
                                })

                                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                              }))
                            } catch (e) {}
                          }

                          try {
                            getElementMDBObject(executeFilesModal, 'Modal').show()
                          } catch (e) {}
                        }

                        if ($(this).data('filesPaths') != null) {
                          handleFilesPaths([...$(this).data('filesPaths')], $(this).data('isExecutionTerminatedOnError'), true)

                          $(this).data('filesPaths', null)
                          $(this).data('isExecutionTerminatedOnError', null)

                          return
                        }

                        // Send a request to the main thread to create a dialog
                        IPCRenderer.send('dialog:create', data)

                        IPCRenderer.on(`dialog:${requestID}`, (_, filesPaths) => handleFilesPaths(filesPaths))
                      })

                      setTimeout(() => {
                        try {
                          filesContainer.sortable({
                            handle: '.sort-handler',
                            animation: 150,
                            ghostClass: 'ghost-field'
                          })
                        } catch (e) {}
                      }, 1000)

                      $('button#executeCQLFilesBtn').click(function() {
                        let pathsArray = [],
                          PathsElements = filesContainer.children('div.cql-file').get(),
                          isExecutionTerminatedOnError = $('input#terminateFileExecutionOnError').prop('checked')

                        try {
                          pathsArray = PathsElements.map((path) => $(path).data('path'))
                        } catch (e) {}

                        try {
                          let statementInputField = $(`textarea#_${cqlshSessionStatementInputID}`)

                          statementInputField.val(`SOURCE_ ${JSON.stringify(pathsArray)} |${isExecutionTerminatedOnError}|`).trigger('input')
                        } catch (e) {}

                        try {
                          getElementMDBObject(executeFilesModal, 'Modal').hide()
                        } catch (e) {}

                        try {
                          setTimeout(() => $(`button#_${executeStatementBtnID}`).click())
                        } catch (e) {}
                      })
                    }

                    {
                      let cqlSnippetsBtn = workareaElement.find('div.session-action[action="cql-snippets"]').find('button.btn')

                      try {
                        cqlSnippetsBtn.unbind('click')
                      } catch (e) {}

                      cqlSnippetsBtn.click(function(_, targetNode = null) {
                        let connectionMetadata = latestMetadata.keyspaces.map((keyspace) => {
                          return {
                            name: keyspace.name,
                            tables: [...keyspace.tables, ...keyspace.indexes, ...keyspace.views].map((_object) => _object.name)
                          }
                        })

                        $(`div.body div.left div.content div.navigation div.group div.item[action="cql-snippets"]`).trigger('click', {
                          connectionMetadata,
                          targetNode: targetNode,
                          workareaID: workareaElement.attr('workarea-id')
                        })
                      })
                    }

                    setTimeout(() => setUIColor(getAttributes(workspaceElement, 'data-color')))

                    {
                      let axonOpsIntegrationWebviewActionsBtns = workareaElement.find('div.axonops-webview-actions').children('div.webview-action.btn')

                      axonOpsIntegrationWebviewActionsBtns.click(function() {
                        let action = $(this).attr('action'),
                          axonOpsIntegrationWebview = workareaElement.find('div.tab-pane[tab="axonops-integration"]').find('webview')

                        switch (action) {
                          case 'home': {
                            try {
                              axonOpsIntegrationWebview.attr('src', $(this).attr('home-url'))
                            } catch (e) {}

                            try {
                              let tooltip = getElementMDBObject(workareaElement.find('div.webview-action.btn.webview-current-link'), 'Tooltip')

                              tooltip.setContent($(this).attr('home-url-params'))
                            } catch (e) {}

                            break
                          }
                          case 'refresh': {
                            try {
                              axonOpsIntegrationWebview[0].reloadIgnoringCache()
                            } catch (e) {}
                            break
                          }
                        }
                      })

                      workareaElement.find('div.axonops-integration-icon').click(() => {
                        let isAxonOpsSaaS = connectionElement.attr('data-axonops-integration-url') == 'axonops-saas',
                          url = isAxonOpsSaaS ? Modules.Consts.AxonOpsIntegration.DefaultURL : `${connectionElement.attr('data-axonops-integration-url')}`,
                          isValidURL = false

                        try {
                          let testURL = new URL(url)

                          if (testURL.protocol.length != 0 && testURL.host.length != 0)
                            isValidURL = true
                        } catch (e) {}

                        if (!isValidURL)
                          return showToast(I18next.capitalize(I18next.t('axonOps integration feature')), I18next.capitalizeFirstLetter(I18next.replaceData('the provided URL for this connection [code]$data[/code] seems invalid, consider to update the connection and try again', [urlHost])) + '.', 'failure')

                        try {
                          if (!isAxonOpsSaaS)
                            throw 0

                          let [organization, clustername] = getAttributes(connectionElement, ['data-axonops-integration-organization', 'data-axonops-integration-clustername'])

                          url = new URL(`${organization}/cassandra/${clustername}`, url).href
                        } catch (e) {}

                        try {
                          Open(url)
                        } catch (e) {}
                      })
                    }
                  }))
                })
              })
              // End the process when we attempt to connect with a connection by clicking the `CONNECT` button

              $(`button[button-id="${connectAltBtnID}"]`).click(() => {
                try {
                  if ($(`button[button-id="${connectBtnID}"]`).attr('disabled') != undefined)
                    throw 0

                  $(`button[button-id="${connectBtnID}"]`).click()

                  return
                } catch (e) {}

                $(`button[button-id="${testConnectionBtnID}"]`).trigger('click', true)
              })

              // Flag to tell if the starting process of docker/sandbox project ha been terminated or not
              let isStartingProcessTerminated = false

              // This try-catch block is only for the sandbox/docker projects
              try {
                // If the current workspace is not the sandbox/docker then skip this try-catch block
                if (!isSandbox)
                  throw 0

                /**
                 * Handle the `click` event on the `START` button - which is shown only for the sandbox projects -
                 * The handler takes two parameters:
                 * One is `restart` which tells if the process is restarting the project's work area
                 * Other is `instant` which tells if the animation and transitions should not be applied
                 */
                $(`button[button-id="${startProjectBtnID}"]`).on('click', function(_, restart = false, instant = false) {
                  // Point at the project's work area
                  let projectWorkarea = $(`div[content="workarea"] div.workarea[connection-id="${connectionID}"]`)

                  // Enable the process termination button
                  $(`div.btn[button-id="${terminateProcessBtnID}"]`).removeClass('disabled')

                  // If exists then click the hidden `CONNECT` button and skip the upcoming code
                  if (projectWorkarea.length > 0)
                    return $(`button[button-id="${connectBtnID}"]`).trigger('click')

                  // Get the app's config
                  Modules.Config.getConfig((config) => {
                    // Get the maximum allowed number of running projects at the same time
                    let maximumRunningSandbox = parseInt(config.get('limit', 'sandbox')),
                      // Get the number of currently running projects
                      numRunningSandbox = $(`div[content="workarea"] div.workarea:not([connection-id*="connection-"])`).filter(function() {
                        let connectionID = $(this).attr('connection-id'),
                          connectionElement = $(`div.connections-container div.connections[workspace-id="workspace-sandbox"] div.connection[data-id="${connectionID}"]`)

                        return (connectionElement.length > 0)
                      }).length,
                      // Get the number of currently attempting-to-start projects
                      numAttemptingSandbox = $(`div[content="connections"] div.connections-container div.connection[data-is-sandbox="true"].test-connection`).length

                    // Add log for this request
                    try {
                      addLog(`Request to start a local cluster '${getAttributes(connectionElement, ['data-id'])}'`, 'action')
                    } catch (e) {}

                    // Manipulate the maximum number, set it to the default value `1` if needed
                    maximumRunningSandbox = isNaN(maximumRunningSandbox) || maximumRunningSandbox < 1 ? 1 : maximumRunningSandbox

                    // If the currently running projects are more than or equal to the maximum allowed number then end the process and show feedback to the user
                    if (([numRunningSandbox, numAttemptingSandbox]).some((num) => num >= maximumRunningSandbox))
                      return showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the maximum number of local clusters which allowed to be started simultaneously is [b]$data[/b]', [maximumRunningSandbox])) + `.<br><br>` + I18next.capitalizeFirstLetter(I18next.t('this limit can be changed from the app\'s settings in the limits section')) + `.`, 'failure')

                    // Inner function to execute the post-start code
                    let startPostProcess = (success = false) => {
                      // Enable the `START` button again
                      $(this).removeAttr('disabled')

                      // Remove the starting - test connection - state
                      connectionElement.removeClass('test-connection enable-terminate-process')

                      // Hide the termination process' button after a set time out
                      setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                      // Remove any indicators about the state of start/connecting
                      connectionElement.children('div.status').removeClass('show success failure')

                      // If the start process failed and the process hasn't been terminated then skip the upcoming code
                      if (!success && !isStartingProcessTerminated) {
                        /**
                         * Create a pinned toast to show the output of the stopping process
                         *
                         * Get a random ID for the toast
                         */
                        let pinnedToastID = getRandom.id(10)

                        // Show/create that toast
                        pinnedToast.show(pinnedToastID, I18next.capitalize(I18next.t('stop local cluster')) + ' ' + getAttributes(connectionElement, 'data-name'), '')

                        // Stop the docker/sandbox project as an error has been occurred
                        Modules.Docker.getDockerInstance(connectionElement).stopDockerCompose(pinnedToastID, () => {})

                        // Skip the upcoming code
                        return
                      }

                      // Add success state
                      connectionElement.children('div.status').addClass('show success')
                    }

                    // Disable the button
                    $(this).attr('disabled', '')

                    // Add a starting class
                    connectionElement.addClass('test-connection')

                    // Show the termination process' button
                    setTimeout(() => connectionElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                    // Get the ports of the project
                    Modules.Docker.getPortsFromYAMLFile(getAttributes(connectionElement, 'data-folder')).then(async (ports) => {
                      // Update attributes that hold the project's ports
                      connectionElement.attr({
                        'data-port-cassandra': ports.cassandra,
                        'data-port-axonops': ports.axonops
                      })

                      try {
                        // Get all saved projects' objects
                        let projects = await Modules.Docker.getProjects()

                        // Get the current project's object
                        let currentProject = projects.filter((project) => project.folder == getAttributes(connectionElement, 'data-folder'))

                        // Set Cassandra's version
                        connectionElement.attr('data-cassandra-version', currentProject[0].cassandraVersion)
                      } catch (e) {
                        try {
                          errorLog(e, 'connections')
                        } catch (e) {}
                      }

                      /**
                       * Create a pinned toast to show the output of the process
                       *
                       * Get a random ID for the toast
                       */
                      let pinnedToastID = getRandom.id(10)

                      // Show/create that toast
                      pinnedToast.show(pinnedToastID, I18next.capitalize(I18next.t('start local cluster')) + ' ' + getAttributes(connectionElement, 'data-name'), '')

                      // Check the existence of Docker in the machine
                      Modules.Docker.checkDockerCompose((dockerExists, userGroup, selectedManagementTool) => {
                        try {
                          if (['docker', 'podman'].some((tool) => `${selectedManagementTool}` == tool))
                            throw 0

                          showToast(I18next.capitalize(I18next.t('create local cluster')), I18next.capitalizeFirstLetter(I18next.t('a containers management tool should be selected before using the local clusters feature, please consider to select either Podman or Docker before attempting to create a local cluster')) + '.', 'failure')

                          startPostProcess()

                          return
                        } catch (e) {}

                        // If `podman` is the selected management tool then check if the host is Linux Ubuntu
                        try {
                          if (selectedManagementTool != 'podman')
                            throw 0

                          if (!isHostUbuntu())
                            throw 0

                          showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.t(`Linux distributions based on Ubuntu often face compatibility issues with Podman containers management tool. Switching to Docker is highly recommended for better compatibility`)) + '.', 'failure')

                          startPostProcess()

                          return
                        } catch (e) {}

                        // If Docker doesn't exist then show feedback to the user and skip the upcoming code
                        if (!dockerExists) {
                          if (selectedManagementTool != 'podman')
                            showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('local clusters feature with Docker management tool requires [code]docker compose[/code] to be installed, please make sure it is installed and accessible before attempting to $data', [I18next.t('start local cluster')])) + '.', 'failure')

                          try {
                            if (selectedManagementTool != 'podman')
                              throw 0

                            showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData(`local clusters feature with Podman management tool requires [code]podman compose[/code] to be installed, please make sure it's installed and accessible before attempting to $data`, [I18next.t('start local cluster')])) + '.', 'failure')
                          } catch (e) {}

                          startPostProcess()

                          return
                        }

                        // If the current user is not in the `docker` group
                        if (!userGroup) {
                          showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.t('local clusters feature with Docker management tool requires the current user to be in the [code]docker[/code] group in [b]Linux[/b], please make sure this requirement is met then try again')) + '.', 'failure')

                          startPostProcess()

                          return
                        }

                        // Set the flag to be `false`
                        isStartingProcessTerminated = false

                        // Show feedback to the user about starting the project
                        showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('local cluster [b]$data[/b] is about to start, a notification will show up once the process begins', [getAttributes(connectionElement, 'data-name')])) + '.')

                        Modules.Docker.checkProjectIsRunning(getAttributes(connectionElement, 'data-folder'), (isProjectRunning) => {
                          if (isProjectRunning) {
                            showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the local cluster [b]$data[/b] seems be running or stopping, the app will shortly attempt to terminate it', [getAttributes(connectionElement, 'data-name')])) + `. `, 'warning')

                            // Call the termination button
                            $(`div.btn[button-id="${terminateProcessBtnID}"]`).addClass('disabled').click()

                            // Skip the upcoming code
                            return
                          }

                          // Start the project
                          Modules.Docker.getDockerInstance(connectionElement).startDockerCompose(pinnedToastID, (feedback) => {
                            // The project didn't run as expected or the starting process has been terminated
                            if (!feedback.status || isStartingProcessTerminated) {
                              // Show failure feedback to the user if the process hasn't been terminated
                              if (!isStartingProcessTerminated)
                                showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, it seems the local cluster [b]$data[/b] didn\'t run as expected', [getAttributes(connectionElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` : ''), 'failure')

                              // Call the post function
                              startPostProcess()

                              // Skip the upcoming code
                              return
                            }

                            // Show success feedback to the user
                            showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('local cluster [b]$data[/b] has been successfully started, waiting for Apache Cassandra to be up, you\'ll be automatically navigated to the local cluster work area once it\'s up', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

                            // Remove all previous states
                            connectionElement.children('div.status').removeClass('success failure').addClass('show')

                            // Update the process ID
                            checkCassandraProcessID = getRandom.id(20)

                            // Define variables which will hold important timeout and interval functions
                            let checkingCassandraTimeout, checkingTerminationInterval

                            checkingTerminationInterval = setInterval(() => {
                              // If the checking process is flagged to be terminated
                              try {
                                if (checkCassandraProcessID != 'terminated')
                                  throw 0

                                // Request to destroy the associated pinned toast
                                pinnedToast.update(pinnedToastID, true, true)

                                // Clear the checking trigger timeout
                                clearTimeout(checkingCassandraTimeout)

                                // Clear the termination checking interval
                                clearInterval(checkingTerminationInterval)
                              } catch (e) {}
                            }, 500)

                            checkingCassandraTimeout = setTimeout(() => {
                              // Make sure to clear the termination check interval
                              try {
                                clearInterval(checkingTerminationInterval)
                              } catch (e) {}

                              // Define inner flag to tell if the process has been terminated
                              let isTerminated = false

                              // Start watching Cassandra's node inside the project
                              Modules.Docker.checkCassandraInContainer(pinnedToastID, ports.cassandra, (status) => {
                                try {
                                  connectionElement.attr('data-latest-cassandra-version', `${status.version}`)
                                } catch (e) {}

                                try {
                                  connectionElement.attr('data-datacenters', `${JSON.stringify(status.datacenters)}`)
                                } catch (e) {}

                                // If the process has been terminated then skip the upcoming code and stop the process
                                if (status.terminated || isTerminated) {
                                  // Update the associated flag
                                  isTerminated = true

                                  // Skip the upcoming code
                                  return
                                }

                                // Failed to connect with the node
                                if (!status.connected) {
                                  // Show a failure feedback to the user
                                  showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, it seems the Apache Cassandra nodes of the local cluster [b]$data[/b] didn\'t start as expected, automatic stop of the local cluster will be started in seconds', [getAttributes(connectionElement, 'data-name')])) + '.', 'failure')

                                  /**
                                   * Create a pinned toast to show the output of the process
                                   *
                                   * Get a random ID for the toast
                                   */
                                  let pinnedToastID = getRandom.id(10)

                                  // Show/create that toast
                                  pinnedToast.show(pinnedToastID, I18next.capitalize(I18next.t('start local cluster')) + ' ' + getAttributes(connectionElement, 'data-name'), '')

                                  setTimeout(() => {
                                    // Attempt to stop the project
                                    Modules.Docker.getDockerInstance(connectionElement).stopDockerCompose(pinnedToastID, (feedback) => {
                                      // Call the post function
                                      startPostProcess()

                                      /**
                                       * Failed to stop the project
                                       * Show failure feedback to the user and tell how to stop it manually
                                       */
                                      if (!feedback.status)
                                        return showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to stop the local cluster [b]$data[/b], please consider to do it manually by stopping the project [b]cassandra_$data[/b]', [getAttributes(connectionElement, 'data-name'), getAttributes(connectionElement, 'data-folder')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                                      // The Docker project has successfully stopped
                                      showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the local cluster [b]$data[/b] has been successfully stopped', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')
                                    })
                                  }, 3000)

                                  // Skip the upcoming code
                                  return
                                }

                                // Disable the process termination button
                                $(`div.btn[button-id="${terminateProcessBtnID}"]`).addClass('disabled')

                                /**
                                 * Successfully started the project and Cassandra's one node at least is up
                                 * Show feedback to the user
                                 */
                                showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('apache Cassandra nodes of the local cluster [b]$data[/b] has been successfully started and ready to be connected with, work area will be created and navigated to in seconds', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

                                // Request to destroy the associated pinned toast
                                pinnedToast.update(pinnedToastID, true, true)

                                // Update the data center title
                                connectionElement.find('div[info="data-center"]').children('div._placeholder').hide()

                                try {
                                  connectionElement.attr('data-datacenter', `${status.datacenter}` || 'datacenter1')
                                  connectionElement.find('div[info="data-center"]').children('div.text').text(`${status.datacenter}`)
                                } catch (e) {}

                                setTimeout(() => {
                                  // Click the hidden `CONNECT` button
                                  $(`button[button-id="${connectBtnID}"]`).trigger('click')

                                  // Update the button's text to be `ENTER`
                                  setTimeout(() => $(this).children('span').attr('mulang', 'enter').text(I18next.t('enter')), 1000)

                                  try {
                                    setTimeout(() => {
                                      let connectionButtons = connectionElement.find('button')

                                      connectionButtons.each(function() {
                                        $(this).toggle(minifyText($(this).text()).length > 0)
                                      })
                                    }, 2000)
                                  } catch (e) {}

                                  setTimeout(() => {
                                    // Call the post function
                                    startPostProcess(true)

                                    try {
                                      // Get the chosen port and the final URL
                                      let axonopsPort = getAttributes(connectionElement, 'data-port-axonops'),
                                        axonopsURL = `http://localhost:${axonopsPort}`

                                      // If the provided port is not actually a number then skip this try-catch block
                                      if (isNaN(axonopsPort))
                                        throw 0

                                      // Append the `webview`
                                      $(`div.tab-pane#_${localClustersAxonopsContentID}`).append($(`<webview src="${axonopsURL}" nodeIntegrationInSubFrames nodeintegration preload="${Path.join(__dirname, '..', '..', '..', 'js', 'axonops_agent_webview.js')}"></webview>`).show(function() {
                                        // Point at the webview element
                                        let webView = $(this)[0]

                                        // Reload it after 1s of creation
                                        try {
                                          setTimeout(() => webView.reloadIgnoringCache(), 1000)
                                        } catch (e) {}

                                        // Once the content inside the webview is ready/loaded
                                        webView.addEventListener('dom-ready', () => {
                                          // Once a message from the IPC is received
                                          webView.addEventListener(`ipc-message`, (event) => {
                                            // If it's a request to reload the webview then reload it
                                            if (event.channel == 'reload-webview')
                                              webView.reloadIgnoringCache()
                                          })
                                        })
                                      }))

                                      // Clicks the globe icon in the connection's info
                                      $(`div[content="workarea"] div.workarea[connection-id="${connectionID}"]`).find('div.axonops-agent').click(() => {
                                        try {
                                          Open(axonopsURL)
                                        } catch (e) {}
                                      })
                                    } catch (e) {}
                                  }, 1000)
                                }, 3000)
                              }, null, checkCassandraProcessID)
                            }, 20000)
                          })
                        })
                      })
                    })
                  })
                })
              } catch (e) {
                try {
                  errorLog(e, 'connections')
                } catch (e) {}
              }

              // Clicks the settings button
              $(`div.btn[button-id="${settingsBtnID}"]`).click(async function() {
                /**
                 * The `Add New Connection` dialog will be used after making tweaks to it
                 *
                 * Define the dialog path's CSS selector
                 */
                let dialog = 'div.modal#addEditConnectionDialog',
                  // Get the connection's ID
                  connectionID = $(this).attr('reference-id'),
                  // Point at the connection element in the UI
                  connectionElement = $(`div.connections div.connection[data-id="${connectionID}"]`),
                  // Determine if the connection has an active work area
                  hasWorkarea = getAttributes(connectionElement, 'data-workarea'),
                  isSCBConnection = connectionElement.attr('data-scb-path') != undefined

                // Add log about edit connection
                try {
                  addLog(`Attempt to edit connection '${getAttributes(connectionElement, ['data-name', 'data-id'])}'`, 'action')
                } catch (e) {}

                // If the connection has an active work area then stop the process and show feedback to the user
                if (hasWorkarea == 'true')
                  return showToast(I18next.capitalize(I18next.t('connection settings')), I18next.capitalizeFirstLetter(I18next.replaceData('this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to edit or delete it', [getAttributes(connectionElement, 'data-name')])) + '.', 'warning')

                // Open the `Add New Connection` dialog
                $(`button#addConnectionProcess`).trigger('click')

                // Change the dialog's title
                $(`${dialog}`).find('h5.modal-title').text(`${I18next.capitalize(I18next.t('connection settings'))} ${getAttributes(connectionElement, 'data-name')}`)

                // Update the workspace's name badge
                $(`${dialog}`).find('div.modal-header span.badge.badge-secondary').text(getWorkspaceName(workspaceID))

                // Change and add some attributes to the dialog
                $(`${dialog}`).attr({
                  'data-edit-workspace-id': workspaceID, // Change the workspace's ID
                  'data-edit-connection-id': connectionID // This attribute tells that the dialog is in the `Editing` mode
                })

                // Change the primary button's text
                $(`button#addConnection`).text(I18next.t('update connection'))

                $(`div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type[data-type="${!isSCBConnection ? 'apache-cassandra' : 'astra-db'}"]`).click()

                if (!isSCBConnection) {
                  $('div.modal#addEditConnectionDialog div.modal-body div.side-left div.sections div.section div.btn[section="basic"]').click()

                  if ($('div.modal#addEditConnectionDialog').hasClass('show-editor'))
                    $('button#switchEditor').click()
                }

                /**
                 * Reset some elements in the dialog
                 *
                 * Enable the save/edit button
                 */
                $('button#addConnection').attr('disabled', null)

                // Hide passwords
                $(`[info-section="none"][info-key="password"]`).add('input#astraDBClientSecret').attr('type', 'password')
                $('span.reveal-password div.btn ion-icon').attr('name', 'eye-opened')

                $('input[info-section="connection"][info-key="ssl"]').add('input[info-section="ssl"][info-key="validate"]').each(function() {
                  $(this).prop('checked', $(this).attr('default-value') == 'true')
                })

                // Get all connections in the workspace
                let allConnections = await Modules.Connections.getConnections(workspaceID),
                  // Get the target connection that we want to edit/update
                  currentConnection = allConnections.find((_connection) => _connection.info.id == connectionID)

                // If the app wasn't able to get the target connection then give feedback to the user and stop the editing process
                if (currentConnection == undefined)
                  return showToast(I18next.capitalize(I18next.t('connection settings')), I18next.capitalizeFirstLetter(I18next.replaceData('unable to locate the workspace folder of connection [b]$data[/b]', [getAttributes(connectionElement, 'data-name')])) + '.', 'failure')

                // Define this variable as a copy of the connection's object before starting the edit
                editedConnectionObject = currentConnection

                try {
                  if (!isSCBConnection)
                    throw 0

                  getRSAKey('private', (key) => {
                    // If the key is empty then something is not correct with the generator tool
                    if (key.length <= 0)
                      return showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                    let inputFields = {
                        connectionName: $('input#astraDBConnectionName'),
                        username: $('input#astraDBClientID'),
                        password: $('input#astraDBClientSecret'),
                        scbFilePath: $('input#astraDBSCBPath')
                      },
                      username = decryptText(key, currentConnection.info.secrets.username)
                    password = decryptText(key, currentConnection.info.secrets.password)

                    inputFields.connectionName.val(currentConnection.name)
                    inputFields.username.val(username)
                    inputFields.password.val(password)

                    try {
                      let tooltipObject = getElementMDBObject(inputFields.scbFilePath, 'Tooltip')

                      tooltipObject.enable()
                      tooltipObject.setContent(currentConnection.info.secureConnectionBundlePath)
                    } catch (e) {}

                    inputFields.scbFilePath.val(currentConnection.info.secureConnectionBundlePath).trigger('input')
                    inputFields.scbFilePath.parent().attr('file-name', Path.basename(currentConnection.info.secureConnectionBundlePath))
                  })
                } catch (e) {}

                try {
                  if (isSCBConnection)
                    throw 0

                  /**
                   * Change the value of the editor to the connection's `cqlsh.rc` file's content
                   * There's a `change` listener that will perform all needed changes; as we've already handled that in the listener
                   */
                  addEditConnectionEditor.setValue(currentConnection.cqlshrc)

                  setTimeout(() => {
                    // Define inputs that are not in the `cqlsh.rc` file; to handle them separately
                    let inputs = [{
                      section: 'none',
                      key: 'connectionName',
                      val: currentConnection.name
                    }, {
                      section: 'none',
                      key: 'datacenter',
                      val: currentConnection.info.datacenter
                    }]

                    try {
                      inputs.push({
                        section: 'none',
                        key: 'axonops-organization',
                        val: (currentConnection.info.axonOpsIntegration != undefined) ? currentConnection.info.axonOpsIntegration.organization : ''
                      })

                      inputs.push({
                        section: 'none',
                        key: 'axonops-clustername',
                        val: (currentConnection.info.axonOpsIntegration != undefined) ? currentConnection.info.axonOpsIntegration.clusterName : ''
                      })

                      $(`[info-section="none"][info-key="axonops-url-protocol"]`).val('')
                      $(`[info-section="none"][info-key="axonops-url-host"]`).val('')

                      let customURL

                      try {
                        let url = new URL(currentConnection.info.axonOpsIntegration.url)

                        customURL = {
                          protocol: url.protocol,
                          host: url.host
                        }

                        if (customURL.protocol.length <= 0 || customURL.host.length <= 0)
                          customURL = undefined
                      } catch (e) {}

                      if (customURL == undefined || currentConnection.info.axonOpsIntegration == undefined || currentConnection.info.axonOpsIntegration.url == 'axonops-saas') {
                        $('#axonOpsSaaS').prop('checked', true)
                        $('#axonOpsSaaS').trigger('change')
                        throw 0
                      }

                      $('#axonOpsSelfHost').prop('checked', true)
                      $('#axonOpsSelfHost').trigger('change')

                      $(`[info-section="none"][info-key="axonops-url-protocol"]`).val(`${customURL.protocol}`.replace(':', ''))
                      $(`[info-section="none"][info-key="axonops-url-host"]`).val(customURL.host)
                    } catch (e) {}

                    // Handle all SSH related input fields/file selectors
                    try {
                      // If there's a saved destination address, and it is not `127.0.0.1` then show it to the user
                      inputs.push({
                        section: 'none',
                        key: 'ssh-dest-addr',
                        val: (currentConnection.ssh.dstAddr != undefined) ? currentConnection.ssh.dstAddr : ''
                      })

                      // If we have a private key then show it to the user
                      inputs.push({
                        section: 'none',
                        key: 'ssh-privatekey',
                        val: (currentConnection.ssh.privatekey != undefined) ? currentConnection.ssh.privatekey : ''
                      })

                      // If we have a passphrase then show it to the user
                      inputs.push({
                        section: 'none',
                        key: 'ssh-passphrase',
                        val: (currentConnection.ssh.passphrase != undefined) ? currentConnection.ssh.passphrase : ''
                      })

                      // If there's a saved destination port, and it is not the same as the connection port then show it as well
                      inputs.push({
                        section: 'none',
                        key: 'ssh-dest-port',
                        val: (currentConnection.ssh.dstPort != undefined) ? currentConnection.ssh.dstPort : ''
                      })

                      // Do the same process to the SSH host
                      inputs.push({
                        section: 'none',
                        key: 'ssh-host',
                        val: (currentConnection.ssh.host != undefined) ? currentConnection.ssh.host : ''
                      })

                      // And the SSH port as well
                      inputs.push({
                        section: 'none',
                        key: 'ssh-port',
                        val: (currentConnection.ssh.port != undefined) ? currentConnection.ssh.port : ''
                      })
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }

                    // Loop through all inputs in the `inputs` array and set their proper values
                    inputs.forEach((input) => {
                      // Get the MDB object for the current input
                      let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                      // Set its saved value
                      $(object._element).find('input').val(input.val)

                      // Update the object
                      object.update()
                      setTimeout(() => object._deactivate())

                      // If the current input is not a file selector then skip this try-catch block
                      if ($(object._element).attr('file-name') == undefined)
                        return

                      /**
                       * Update the tooltip's content and state
                       * Get the object
                       */
                      let tooltipObject = getElementMDBObject($(object._element).find('input'), 'Tooltip')

                      // Set the selected file's path
                      $(object._element).find('input').val(input.val).trigger('input')
                      $(object._element).attr('file-name', input.val.length <= 0 ? '-' : Path.basename(input.val))

                      // Handle the tooltip
                      try {
                        // If the value is acutally empty then attempt to disable the tooltip
                        if (input.val.length <= 0)
                          throw 0

                        // Enable the tooltip and update its content
                        tooltipObject.enable()
                        tooltipObject.setContent(input.val)
                      } catch (e) {
                        try {
                          // Disable the tooltip
                          tooltipObject.disable()
                        } catch (e) {}
                      }
                    })

                    // Check username and password existence for Apache Cassandra and SSH tunnel
                    let username = '',
                      password = '',
                      sshUsername = '',
                      sshPassword = ''

                    // If there are saved secrets for the connection
                    if (currentConnection.info.secrets != undefined) {
                      try {
                        // Get the private key; to decrypt secrets and show them in the dialog
                        getRSAKey('private', (key) => {
                          // If the key is empty then something is not correct with the generator tool
                          if (key.length <= 0)
                            return showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                          // Try to decrypt both; username and password
                          username = decryptText(key, currentConnection.info.secrets.username)
                          password = decryptText(key, currentConnection.info.secrets.password)

                          // Empty the `inputs` array
                          inputs = []

                          // Push new secrets in the `inputs` array
                          inputs.push({
                            section: 'none',
                            key: 'username',
                            val: username
                          }, {
                            section: 'none',
                            key: 'password',
                            val: password
                          })

                          // Check if SSH username is provided
                          try {
                            if (currentConnection.info.secrets.sshUsername == undefined)
                              throw 0

                            // Decrypt the SSH username
                            sshUsername = decryptText(key, currentConnection.info.secrets.sshUsername)

                            // Push it to the `inputs` array; to be shown in the dialog
                            inputs.push({
                              section: 'none',
                              key: 'ssh-username',
                              val: sshUsername
                            })
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Check if SSH password is provided
                          try {
                            if (currentConnection.info.secrets.sshPassword == undefined)
                              throw 0

                            // Decrypt the SSHS password
                            sshPassword = decryptText(key, currentConnection.info.secrets.sshPassword)

                            // Push it to the `inputs` array
                            inputs.push({
                              section: 'none',
                              key: 'ssh-password',
                              val: sshPassword
                            })
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Check if SSH private key passphrase is provided
                          try {
                            if (currentConnection.info.secrets.sshPassphrase == undefined)
                              throw 0

                            // Decrypt the SSHS password
                            sshPassphrase = decryptText(key, currentConnection.info.secrets.sshPassphrase)

                            // Push it to the `inputs` array
                            inputs.push({
                              section: 'none',
                              key: 'ssh-passphrase',
                              val: sshPassphrase
                            })
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Loop through secrets' inputs and set their value
                          inputs.forEach((input) => {
                            // Get the MDB object for the current input
                            let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                            // Set its saved value
                            $(object._element).find('input').val(input.val)

                            // Update the object
                            object.update()
                            setTimeout(() => object._deactivate())
                          })
                        })
                      } catch (e) {
                        try {
                          errorLog(e, 'connections')
                        } catch (e) {}
                      }
                    } else {
                      /**
                       * There are no saved secrets for the connection
                       *
                       * Empty the `inputs` array
                       */
                      inputs = []

                      // Push the secrets' input fields
                      inputs.push({
                        section: 'none',
                        key: 'username',
                      }, {
                        section: 'none',
                        key: 'password',
                      }, {
                        section: 'none',
                        key: 'ssh-username',
                      }, {
                        section: 'none',
                        key: 'ssh-password',
                      }, {
                        section: 'none',
                        key: 'ssh-privatekey',
                      }, {
                        section: 'none',
                        key: 'ssh-passphrase',
                      })

                      // Loop through the input fields and empty them
                      inputs.forEach((input) => {
                        // Get the MDB object for the current input
                        let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                        // Set its saved value
                        $(object._element).find('input').val('')

                        // Update the object
                        object.update()
                        setTimeout(() => object._deactivate())

                        // If the current input is not a file selector then skip this try-catch block
                        if ($(object._element).attr('file-name') == undefined)
                          return

                        /**
                         * Update the tooltip's content and state
                         * Get the object
                         */
                        let tooltipObject = getElementMDBObject($(object._element).find('input'), 'Tooltip')

                        try {
                          // Disable the tooltip
                          tooltipObject.disable()
                        } catch (e) {}
                      })
                    }
                  })
                } catch (e) {}

                // The rest actions and events related to the dialog are handled in the dialog buttons events listeners
              })

              // Clicks the delete button
              $(`div.btn[button-id="${deleteBtnID}"]`).click(function() {
                // Define the confirm's text
                let confirmText = I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the connection [b]$data[/b] in the workspace [b]$data[/b]?', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)]))

                // Add log
                try {
                  addLog(`Request to delete ${isSandbox ? 'local cluster' : 'connection'} ${getAttributes(connectionElement, ['data-name', 'data-id'])}`, 'action')
                } catch (e) {}

                // If the current workspace is sandbox then change the text
                if (isSandbox)
                  confirmText = I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the local cluster [b]$data[/b]?', [getAttributes(connectionElement, 'data-name')]))

                // Open the confirmation dialog and wait for the response
                openDialog(confirmText, (response) => {
                  // If canceled, or not confirmed then skip the upcoming code
                  if (!response.confirmed)
                    return

                  // Get the project/connection work area
                  let connectionWorkarea = $(`div[content="workarea"] div.workarea[connection-id="${getAttributes(connectionElement, 'data-id')}"]`)

                  // If there's a work area already then stop the deletion process
                  if (connectionWorkarea.length != 0)
                    return showToast(I18next.capitalize(I18next.t(isSandbox ? 'delete local cluster' : 'delete connection')), I18next.capitalizeFirstLetter(I18next.replaceData(isSandbox ? 'there\'s an active work area for the local cluster [b]$data[/b], please consider to close it before attempting to delete the local cluster again' : 'this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to edit or delete it', [getAttributes(connectionElement, 'data-name')])) + '.', 'warning')

                  try {
                    // If the current workspace is not the sandbox then skip this try-catch block
                    if (!isSandbox)
                      throw 0

                    // Attempt to delete the project
                    Modules.Docker.deleteProject(getAttributes(connectionElement, 'data-folder'), response.checked).then((status) => {
                      // Failed to delete the project
                      if (!status)
                        return showToast(I18next.capitalize(I18next.t('delete local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to delete the local cluster [b]$data[/b]', [getAttributes(connectionElement, 'data-name')])) + '.', 'failure')

                      // Successfully deleted the project
                      showToast(I18next.capitalize(I18next.t('delete local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the local cluster [b]$data[/b] has been successfully deleted', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

                      // Point at the projects' container
                      let projectsContainer = $(`div.connections-container div.connections[workspace-id="${workspaceID}"]`)

                      // Remove the deleted project's UI element
                      projectsContainer.children(`div.connection[data-workspace-id="${workspaceID}"][data-folder="${getAttributes(connectionElement, 'data-folder')}"]`).remove()

                      // Refresh projects' list
                      $(document).trigger('refreshConnections', {
                        workspaceID
                      })
                    })

                    // Skip the upcoming code - no need to execute it if the workspace is the sandbox -
                    return
                  } catch (e) {}

                  // Call the connection's deletion function from the connections' module
                  Modules.Connections.deleteConnection(getWorkspaceFolderPath(workspaceID), getAttributes(connectionElement, 'data-folder'), connectionID, (result) => {
                    // If the deletion process failed then show feedback to the user and skip the upcoming code
                    if (!result)
                      return showToast(I18next.capitalize(I18next.t('delete connection')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to delete connection [b]$data[/b] in workspace [b]$data[/b], please check that it\'s exists, and the app has permission to access the workspace folder', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'failure')

                    /**
                     * The connection has successfully been deleted
                     *
                     * Send the `quit` command
                     */
                    IPCRenderer.send('pty:command', {
                      id: connectionID,
                      cmd: 'quit'
                    })

                    // Request to entirely close the pty instance
                    IPCRenderer.send('pty:close', connectionID)

                    // Close the SSH tunnel if it exists
                    try {
                      IPCRenderer.send('ssh-tunnel:close', connectionID)
                    } catch (e) {}

                    // Attempt to close the work area of the connection if exists
                    try {
                      $(`div[content="workarea"] div.workarea[connection-id="${connectionID}"]`).find('div.action[action="close"] div.btn-container div.btn').click()
                    } catch (e) {}

                    // Remove the target workspace element
                    $(`div.connections div.connection[data-id="${connectionID}"]`).remove()

                    // Refresh connections' list
                    $(document).trigger('refreshConnections', {
                      workspaceID
                    })

                    // Refresh workspaces' list
                    $(document).trigger('getWorkspaces')

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('delete connection')), I18next.capitalizeFirstLetter(I18next.replaceData('connection [b]$data[/b] in workspace [b]$data[/b] has been successfully deleted', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'success')
                  }, response.checked)
                }, false, 'keep the associated files in the system')
              })

              // Clicks the folder button
              $(`div.btn[button-id="${folderBtnID}"]`).click(() => {
                // Define the initial element's path variable
                let elementPath = ''

                try {
                  // If the current workspace is the sandbox then skip this try-catch block
                  if (isSandbox)
                    throw 0

                  // Get the connection's path
                  elementPath = Path.join(getWorkspaceFolderPath(getAttributes(connectionElement, 'data-workspace-id')), getAttributes(connectionElement, 'data-folder'))
                } catch (e) {
                  // Get the sandbox project's path
                  elementPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..', '..', '..')), 'data', 'localclusters', getAttributes(connectionElement, 'data-folder'))
                }

                // Open the final path
                try {
                  Open(elementPath)
                } catch (e) {}
              })

              $(`div.btn[button-id="${axonOpsIntegrationBtnID}"]`).click(function() {

                // If the connection has an active work area then stop the process and show feedback to the user
                if (getAttributes(connectionElement, 'data-workarea') == 'true')
                  return showToast(I18next.capitalize(I18next.t('toggle AxonOps integration feature')), I18next.capitalizeFirstLetter(I18next.replaceData('this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to toggle the feature', [getAttributes(connectionElement, 'data-name')])) + '.', 'warning')

                let isAxonOpsIntegrationEnabled = !(Store.get(`${connectionID}:AxonOpsIntegrationEnabled`) != undefined && !Store.get(`${connectionID}:AxonOpsIntegrationEnabled`))

                Store.set(`${connectionID}:AxonOpsIntegrationEnabled`, !isAxonOpsIntegrationEnabled)

                $(this).toggleClass('enabled', !isAxonOpsIntegrationEnabled)

                $(this).find('ion-icon.status').attr('name', !isAxonOpsIntegrationEnabled ? 'check' : 'close')
              })

              $(this).find('div.path-inaccessible').click(function() {
                try {
                  let inaccessibleConnectionPath = Path.join(getWorkspaceFolderPath(workspaceID), getAttributes(connectionElement, 'data-folder'))

                  if (inaccessibleConnectionPath.length <= 0)
                    throw 0

                  // Copy the path to the clipboard
                  try {
                    Clipboard.writeText(inaccessibleConnectionPath)
                  } catch (e) {
                    try {
                      errorLog(e, 'connections')
                    } catch (e) {}
                  }

                  showToast(I18next.capitalize(I18next.t('inaccessible path')), I18next.capitalizeFirstLetter(I18next.replaceData('the path has been copied to the clipboard. Once it becomes accessible again, click the refresh button to update the $data status', [isSandbox ? 'local cluster' : 'connection'])) + '.', 'success')
                } catch (e) {
                  showToast(I18next.capitalize(I18next.t('inaccessible path')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to get the inaccessible path')) + '.', 'failure')
                }
              })

              // Clicks the process termination button
              $(`div.btn[button-id="${terminateProcessBtnID}"]`).click(() => {
                // Disable this button while processing
                $(`div.btn[button-id="${terminateProcessBtnID}"]`).addClass('disabled')

                try {
                  // If the current connection is not actually a docker/sandbox project then skip this try-catch block
                  if (!isSandbox)
                    throw 0

                  // Set the flag to be `true`
                  isStartingProcessTerminated = true

                  /**
                   * Create a pinned toast to show the output of the process
                   *
                   * Get a random ID for the toast
                   */
                  let pinnedToastID = getRandom.id(10)

                  // Show/create that toast
                  pinnedToast.show(pinnedToastID, I18next.capitalize(I18next.t('terminate local cluster')) + ' ' + getAttributes(connectionElement, 'data-name'), '')

                  // Send request to the main thread to terminate the connection test process - if there's any -
                  try {
                    IPCRenderer.send(`pty:test-connection:terminate`, checkCassandraProcessID)
                  } catch (e) {}

                  // Update the ID to be `terminated`; to stop the checking process from being started if it's not yet
                  checkCassandraProcessID = 'terminated'

                  // Attempt to close/stop the docker project
                  Modules.Docker.getDockerInstance(connectionElement).stopDockerCompose(pinnedToastID, (feedback) => {
                    /**
                     * Failed to close/stop the project
                     * Show feedback to the user and skip the upcoming code
                     */
                    if (!feedback.status)
                      return showToast(I18next.capitalize(I18next.t('terminate local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] were not successfully stopped', [getAttributes(connectionElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                    /**
                     * Successfully closed/stopped
                     * Show feedback to the user
                     */
                    showToast(I18next.capitalize(I18next.t('terminate local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] have been successfully stopped', [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

                    // Reset the sandbox project's element in the connections/sandbox projects container
                    connectionElement.removeClass('test-connection enable-terminate-process')
                    connectionElement.find('button').removeAttr('disabled')
                    connectionElement.children('div.status').removeClass('show success')

                    // Hide the termination process' button after a set time out
                    setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
                  })

                  // Skip the upcoming code
                  return
                } catch (e) {}

                try {
                  if (!isSSHTunnelNeeded)
                    throw 0

                  // Attempt to close the SSH tunnel if it has already been created
                  try {
                    IPCRenderer.send('ssh-tunnel:close', connectionID)
                  } catch (e) {}

                  // Send a request to terminate the SSH tunnel creation process
                  IPCRenderer.send(`ssh-tunnel:terminate`, sshTunnelCreationRequestID)

                  // Show success feedback to the user
                  showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData('the testing process for the connection [b]$data[/b] in workspace [b]$data[/b] has been terminated with success', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)]) + '.'), 'success')
                } catch (e) {}

                // Send request to the main thread to terminate the current ongoing connection test process
                IPCRenderer.send(`process:terminate:${testConnectionProcessID}`)

                // Make sure to remove all previous listeners to prevent duplication
                IPCRenderer.removeAllListeners(`process:terminate:${testConnectionProcessID}:result`)

                // Once the termination status is received
                if (!isSSHTunnelNeeded)
                  IPCRenderer.on(`process:terminate:${testConnectionProcessID}:result`, (_, status) => showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData(status ? 'the testing process for the connection [b]$data[/b] in workspace [b]$data[/b] has been terminated with success' : 'something went wrong, failed to terminate the testing process of connection [b]$data[/b] in workspace [b]$data[/b]', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)]) + '.'), status ? 'success' : 'failure'))
              })
            })
            // End of handling the `click` events for actions buttons

            /**
             * Inner function to request a pty instance creation from the main thread
             * It has been defined inside the connections' loop as it needs a lot of real-time created elements
             *
             * @Parameters:
             * {object} `readLine` is the read line object that has been created for the terminal, the terminal object itself can be passed too
             */
            let requestPtyInstanceCreation = async (info, callback) => {
              try {
                // Get the workspace's folder path
                let workspaceFolderPath = getWorkspaceFolderPath(workspaceID),
                  // Get the current connection's folder path
                  connectionFolder = Path.join(workspaceFolderPath, getAttributes(connectionElement, 'data-folder'))

                // Get the `cqlsh.rc` config file's path for the current connection
                let cqlshrcPath = Path.join(connectionFolder, 'config', 'cqlsh.rc'),
                  // Get Apache Cassandra's version
                  version = getAttributes(connectionElement, 'data-latest-cassandra-version') || getAttributes(connectionElement, 'data-cassandra-version'),
                  host = getAttributes(connectionElement, 'data-host')

                // Show it in the interactive terminal
                if (minifyText(host).length != 0)
                  addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandom.id(10), `Connecting with host ${host}.`, null, true, 'neutral', true)

                addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandom.id(10), `Detected Apache Cassandra version is ${version}.`, null, true, 'neutral', true)

                $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${connectionElement.attr('data-id')}"]`).find('div.info[info="cassandra"]').children('div.text').text(`v${version}`)

                /**
                 * Check some options in the `cqlsh.rc` file
                 * If we aren't able to do this the code flow will continue and no need to notify the user about that
                 */
                try {
                  // Read the `cqlsh.rc` file
                  FS.readFile(cqlshrcPath, 'utf8', (err, content) => {
                    // With an error occurs stop the checking process
                    if (err) {
                      try {
                        errorLog(err, 'connections')
                      } catch (e) {}

                      return
                    }

                    // Convert content to UTF-8 string
                    content = content.toString()

                    // Convert the `cqlsh.rc` file's content to an array of sections and options
                    Modules.Connections.getCQLSHRCContent(workspaceID, content, addEditConnectionEditor).then((result) => {
                      /**
                       * Check SSL
                       *
                       * Set its status to be enabled by default
                       */
                      connectionElement.attr('ssl-enabled', 'true')

                      callback(result)

                      // Check if SSL is disabled
                      try {
                        // If SSL is enabled then skip this try-catch block
                        if (!([undefined, 'false'].includes(result.connection.ssl)))
                          throw 0

                        // Show it in the interactive terminal
                        addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandom.id(10), `SSL is not enabled, the connection is not encrypted and is being transmitted in the clear.`, null, true, 'warning', true)

                        // Update the SSL attribute
                        connectionElement.attr('ssl-enabled', 'false')
                      } catch (e) {}

                      // Update the lockpad status
                      updateSSLLockpadStatus(connectionElement)
                    })
                  })
                } catch (e) {
                  try {
                    errorLog(e, 'connections')
                  } catch (e) {}
                }

                // Show feedback to the user when the connection is established through the SSH tunnel
                if (sshTunnelsObjects[connectionID] != null) {
                  // Show it in the interactive terminal
                  addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandom.id(10), `The connection is encrypted and transmitted through an SSH tunnel.`, null, true, 'neutral', true)
                }

                /**
                 * The connection creation object
                 * The initial data: The connection's ID, its `cqlsh.rc` config file path, Apache Cassandra's version, and the log file path for this connection session
                 */
                let creationData = {
                  id: connectionID,
                  cqlshrc: cqlshrcPath,
                  version,
                  logPath: Path.join(connectionFolder, 'logs', `${machineID} - ${formatTimestamp((new Date()).getTime())}.log`)
                }

                if (isSCBConnection)
                  creationData.scbFilePath = connectionElement.attr('data-scb-path')

                // Check if username and password are provided
                try {
                  // Get them from the connection's attributes
                  let [username, password] = getAttributes(connectionElement, ['data-username', 'data-password'])

                  // Make sure both are defined, and not empty
                  if ([username, password].some((secret) => secret == undefined || secret.trim().length <= 0))
                    throw 0

                  // Add them in the `creationData.secrets`
                  creationData.secrets = {
                    username: username,
                    password: password
                  }

                  // As username exists; decrypt it and check if it is `cassandra`; to give a warning to the user if it is `true`
                  getRSAKey('private', (key) => {
                    // If we didn't get the key, just stop this subprocess
                    if (key.length <= 0)
                      return

                    // Decrypt the username
                    let usernameDecrypted = decryptText(key, username)

                    // If the username is `cassandra` then warn the user about that
                    if (usernameDecrypted == 'cassandra') {
                      // Show it in the interactive terminal
                      addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandom.id(10), 'This connection is using the default `cassandra` user.', null, true, 'warning', true)
                    }
                  })
                } catch (e) {
                  try {
                    errorLog(e, 'connections')
                  } catch (e) {}
                }

                // Check if there is SSH tunnel creation info
                try {
                  // If there is no SSH tunnel info then stop this sub-process
                  if (sshTunnelsObjects[connectionID] == null)
                    throw 0

                  // Create an object to handle the creation info
                  let tunnelInfo = sshTunnelsObjects[connectionID],
                    sshTunnel = {
                      port: tunnelInfo.port,
                      host: tunnelInfo.host,
                      oport: tunnelInfo.oport
                    }

                  // Add the creation info in the `creationData.ssh`
                  creationData = {
                    ...creationData,
                    ssh: sshTunnel
                  }
                } catch (e) {}

                // Check if the current connection is a sandbox project
                try {
                  if (!isSandbox)
                    throw 0

                  // Update the creation data to adopt the sandbox project without the need to do heavy changes
                  creationData = {
                    ...creationData,
                    cqlshrc: null,
                    version: getAttributes(connectionElement, 'data-cassandra-version'),
                    ssh: {
                      port: getAttributes(connectionElement, 'data-port-cassandra')
                    }
                  }
                } catch (e) {}

                // Get variables manifest and values
                try {
                  // Define JSON object which will hold the names of the temporary files
                  let files = {}

                  // Loop through the names of the content
                  for (let name of ['manifest', 'values']) {
                    // Get the content from the OS keychain
                    let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

                    // Create a name for the temporary file
                    files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandom.id(20)}.aocwtmp`))

                    // Create the temporary file with related content
                    await FS.writeFileSync(files[name], content || '')
                  }

                  // Update the creation data to adopt the variables' info
                  creationData = {
                    ...creationData,
                    variables: {
                      ...files
                    }
                  }
                } catch (e) {}

                // Send a request to create a pty instance and connect with the connection
                IPCRenderer.send('pty:create', {
                  ...creationData,
                  isBasicCQLSHEnabled: info.isBasicCQLSHEnabled,
                  terminalID: info.terminalID,
                  workspaceID: getActiveWorkspaceID()
                })
              } catch (e) {
                try {
                  errorLog(e, 'connections')
                } catch (e) {}
              }
            }

            setTimeout(() => {
              try {
                if (passedData.callback != null && (currentIndex + 1) >= connections.length)
                  passedData.callback()
              } catch (e) {}
            }, 1000)
          }))
          // End of the process when appending a connection in the container
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }
      })
    })
    // End of getting all saved connections/projects

    let innerUpdateContainersManagementTool = () => {
      setTimeout(() => {
        if ((connectionsIndex + 1) < connectionsCounter)
          return innerUpdateContainersManagementTool()

        setTimeout(() => updateContainersManagementToolUI('unknown', true), 500)
      }, 100)
    }

    innerUpdateContainersManagementTool()

    /**
     * Define different inner functions that are used only in this event file, and in the current events handler
     *
     * Inner function to perform the test connection's process with an already added connection
     *
     * @Parameters:
     * {object} `connectionElement` the connection's UI element in the workspace connections' list
     * {string} `?testConnectionProcessID` the ID of the connection test process of the connection
     * {string} `?sshTunnelCreationRequestID` the ID of the SSH tunnel creation process - if needed -
     * {boolean} `?clickConnectBtn` whether or not the `CONNECT` button should be clicked
     */
    let testConnection = async (connectionElement, testConnectionProcessID = '', sshTunnelCreationRequestID = '', clickConnectBtn = false) => {
      // Point at the Apache Cassandra's version UI element
      let cassandraVersion = connectionElement.find('div[info="cassandra"]'),
        // Point at the data center element
        dataCenterElement = connectionElement.find('div[info="data-center"]'),
        // Point at the `CONNECT` button
        connectBtn = connectionElement.children('div.footer').children('div.button').children('button.connect'),
        // Point at the `TEST CONNECTION` button
        testConnectionBtn = connectionElement.children('div.footer').children('div.button').children('button.test-connection'),
        // Point at the status element - the flashing circle at the top right -
        statusElement = connectionElement.children('div.status'),
        // Get the connection's ID from its attribute
        connectionID = getAttributes(connectionElement, 'data-id'),
        // Username and password - for Apache Cassandra DB Auth - to be passed if needed
        username = '',
        password = '',
        // By default, there's no wait for encrypting username and password
        waitForEncryption = false,
        isSCBConnection = connectionElement.attr('data-scb-path') != undefined

      // Get all saved connections
      let allConnections = await Modules.Connections.getConnections(workspaceID),
        // Filter connections; by finding the target one based on its ID
        connectionObject = allConnections.find((_connection) => _connection.info.id == connectionID),
        // Check if any sensitive data was added to the `cqlsh.rc` file
        foundSensitiveData = false,
        // Check if there are scripts to run in pre or post-connection
        scripts = {
          pre: [],
          post: []
        }

      // Make sure the connection's object exists
      try {
        // If the target connection has been found then skip this try-catch block
        if (connectionObject != undefined)
          throw 0

        // Show feedback to the user about not finding the target connection
        showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong while attempt to test connection [b]$data[/b] in workspace [b]$data[/b], mostly it is an issue with [code]cqlsh.rc[/code] file', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'failure')

        setTimeout(() => {
          // Enable the `TEST CONNECTION` button
          testConnectionBtn.removeAttr('disabled')

          // Remove multiple classes for the connection and its status elements
          connectionElement.add(statusElement).removeClass('test-connection enable-terminate-process show failure success')

          // Hide the termination process' button after a set time out
          setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
        })

        // Skip the upcoming code
        return
      } catch (e) {}

      try {
        if (isSCBConnection)
          throw 0

        /**
         * Check pre and post-connect scripts
         * Get all scripts associated with the connection
         */
        let check = await Modules.Connections.getPrePostScripts(workspaceID, connectionID)

        // Set the received data
        scripts.pre = check.pre
        scripts.post = check.post
        foundSensitiveData = check.foundSensitiveData

        try {
          // If no sensitive data has been found then skip this try-catch block
          if (!foundSensitiveData)
            throw 0

          // Show feedback to the user about having sensitive data in the `cqlsh.rc` file
          showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.t(`workbench stores sensitive data encrypted and securely using the appropriate secure storage mechanism for your OS. The [code]cqlsh.rc[/code] content added contains sensitive information (such as username, password or a path to a credentials file), which is not permitted. Please remove this sensitive data before attempting to connect again`)) + '.', 'failure')

          // Enable the `CONNECT` button
          testConnectionBtn.removeAttr('disabled')

          // Remove multiple classes for the connection and its status elements
          connectionElement.add(statusElement).removeClass('test-connection enable-terminate-process show failure success')

          // Hide the termination process' button after a set time out
          setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

          // Skip the upcoming code
          return
        } catch (e) {}
      } catch (e) {}

      // Define the test data; the connection's ID and its `cqlsh.rc` file's path
      let testData = {
        id: connectionObject.info.id,
        cqlshrcPath: connectionObject.cqlshrcPath
      }

      if (isSCBConnection)
        testData.scbFilePath = connectionElement.attr('data-scb-path')

      // Check if there is a username and password for Apache Cassandra
      try {
        // Username and password have been encrypted already and added to the connection's UI attributes
        [username, password] = getAttributes(connectionElement, ['data-username', 'data-password'])

        // If both username and password values are not valid then stop then skip this try-catch block
        if ([username, password].some((secret) => secret == undefined || secret.trim().length <= 0))
          throw 0

        // Add the username and the password in the `secrets` sub-object
        testData.secrets = {
          username: username,
          password: password
        }
      } catch (e) {}

      /**
       * Inner function to start the connection test process with connection
       *
       * @Parameters:
       * {object} `?sshCreation` the SSH tunnel object associated with the connection
       */
      let startTestConnection = async (sshCreation = null) => {
        // Define an SSH port object to be passed if needed
        let sshInfo = {},
          // Get a random ID for the connection test's request
          requestID = getRandom.id(10)

        // If the `sshCreation` object has been passed then use the random used port in the creation process instead of the one the user has passed
        if (sshCreation != null) {
          sshInfo.sshPort = sshCreation.port
          sshInfo.sshHost = sshCreation.host
        }

        // Get variables manifest and values
        try {
          if (isSCBConnection)
            throw 0

          // Define JSON object which will hold the names of the temporary files
          let files = {}

          // Loop through the names of the content
          for (let name of ['manifest', 'values']) {
            // Get the content from the OS keychain
            let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

            // Create a name for the temporary file
            files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandom.id(20)}.aocwtmp`))

            // Create the temporary file with related content
            await FS.writeFileSync(files[name], content || '')
          }

          // Update the creation data to adopt the variables' info
          testData = {
            ...testData,
            variables: {
              ...files
            }
          }
        } catch (e) {}

        // Send test request to the main thread and pass the final `testData`
        IPCRenderer.send('pty:test-connection', {
          workspaceID: getActiveWorkspaceID(),
          processID: testConnectionProcessID,
          requestID,
          ...testData,
          ...sshInfo
        })

        // Once a response from the main thread has been received
        IPCRenderer.on(`pty:test-connection:${requestID}`, (_, result) => {
          setTimeout(() => {
            /**
             * Implement a data center(s) check
             * By default, no data center is set unless the user provides one
             */
            let dataCenter = getAttributes(connectionElement, 'data-datacenter'),
              // Define a flag to tell if the provided data center - if provided - exists and is seen by the app or not
              isDataCenterExists = true,
              // Hold all detected/seen data centers' names in array
              allDataCenters

            // Handle when the process has been terminated
            try {
              // If the process hasn't been terminated then skip this try-catch block
              if (result.terminated != true)
                throw 0

              /**
               * Make sure to remove all listeners to the process' result
               * This will prevent showing success/failure of the process after being terminated
               */
              IPCRenderer.removeAllListeners(`pty:test-connection:${requestID}`)
            } catch (e) {}

            try {
              // If there's no provided data center by the user then skip this try-catch block
              if (dataCenter.trim().length <= 0)
                throw 0

              // Determine if the provided data center exists
              isDataCenterExists = result.datacenters.filter((_dataCenter) => _dataCenter.datacenter == dataCenter).length != 0

              // Hold all detected/seen data centers
              allDataCenters = [...new Set(result.datacenters.map((_dataCenter) => _dataCenter.datacenter))]
            } catch (e) {}

            // Failed to connect with the connection
            try {
              // If the `connected` attribute in the result is `true`, and the Apache Cassandra's version has been identified, or the testing process hasn't been terminated then skip this try-catch block
              if (result.connected && ![undefined, null].includes(result.version) && result.terminated == undefined)
                throw 0

              // If the provided data center doesn't exist
              if (!isDataCenterExists) {
                let allDataCentersStr = JSON.stringify(allDataCenters)

                // Format the string format of the data centers array for the toast
                allDataCentersStr = allDataCentersStr.slice(1, allDataCentersStr.length - 1).replace(/\"/g, '').split(',').join('[/code], [code]')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('the set data center [code]$data[/code] is not recognized but the following data center(s): [code]$data[/code]. Please consider updating the data center input field or leaving it blank', [dataCenter, allDataCentersStr])) + '.', 'failure')

                // Enable or disable the save button based on the test's result
                $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null)

                // Skip the upcoming code
                throw 0
              }

              /**
               * Update connection UI element
               *
               * Change the `connected` attribute's value to `false` - failed to connect with the connection -
               */
              connectionElement.attr('data-connected', 'false')

              try {
                // If the testing process has been terminated then skip this try-catch block - as ther's no need to show an error feedback to the user -
                if (result.terminated)
                  throw 0

                // Whether or not the error details will be shown
                let error = result.error.trim().length != 0 ? `, ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.replaceData('failed to activate connection [b]$data[/b] in workspace [b]$data[/b]', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)]))}${error}.`, 'failure')
              } catch (e) {}

              // Close the SSH tunnel if it exists
              try {
                IPCRenderer.send('ssh-tunnel:close', getAttributes(connectionElement, 'data-id'))
              } catch (e) {}

              setTimeout(() => {
                // Test process has finished
                connectionElement.removeClass('test-connection enable-terminate-process')

                // Hide the termination process' button after a set time out
                setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                // Show failure feedback if the testing process hasn't been terminated
                statusElement.removeClass('success').toggleClass('show failure', result.terminated == undefined)

                // Enable the test connection button again
                testConnectionBtn.removeAttr('disabled')
              })

              // Get the credentials attributes
              let [credentialsAuth, credentialsSSH] = getAttributes(connectionElement, ['data-credentials-auth', 'data-credentials-ssh'])

              // If there are no DB authentication credentials for the connection then remove all associated attributes
              try {
                if (credentialsAuth == undefined)
                  throw 0

                connectionElement.removeAttr('data-username data-password data-got-credentials')
              } catch (e) {}

              // If there's no SSH credentials for the connection then remove all associated attributes
              try {
                if (credentialsSSH == undefined)
                  throw 0

                connectionElement.removeAttr('data-ssh-username data-ssh-password data-ssh-passphrase data-got-credentials')
              } catch (e) {}

              /**
               * Check if we have post-connection scripts to run
               *
               * Define a variable to save the scripts' execution feedback
               */
              let executionFeedback = ''

              try {
                // If there's no post-connection script to execute then skip this try-catch block
                if (scripts.post.length <= 0)
                  throw 0

                // Show feedback to the user about starting the execution process
                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('post-connection scripts are being executed after closing the connection [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(connectionElement, 'data-name')])) + '.'), 50)

                // Execute the post-connection scripts in order
                Modules.Connections.executeScript(0, scripts.post, (executionResult) => {
                  try {
                    // If we've got `0` - as a final result - then it means all scripts have been executed with success and returned `0`; so skip this try-catch block and call the post-process function
                    if (executionResult.status == 0)
                      throw 0

                    // Show feedback to the user about the script which failed
                    let info = `${I18next.t('script "$data" didn\'t return the success code [code]0[/code], but')} <code>${executionResult.status}</code>.`

                    if (status == -1000)
                      info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                    // Set final feedback
                    executionFeedback = `. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`

                    // Show feedback to the user
                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of connection [b]$data[/b]', [I18next.t('post'), getAttributes(connectionElement, 'data-name')]))}${executionFeedback}`, 'failure'), 50)
                  } catch (e) {
                    // Show success feedback to the user if the error is `0` code
                    if (e == 0)
                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of connection [b]$data[/b] have been successfully executed', [I18next.t('post'), getAttributes(connectionElement, 'data-name')])) + '.', 'success'), 50)
                  }
                })
              } catch (e) {}

              // Skip the upcoming code
              return
            } catch (e) {}

            /**
             * Successfully connected with the connection
             *
             * Add the created SSH tunnel object to the `sshTunnelsObjects` array; to have the ability to identify if the connection has an SSH tunnel associated with it
             */
            sshTunnelsObjects[connectionObject.info.id] = sshCreation

            // Show Apache Cassandra version
            cassandraVersion.children('div._placeholder').hide()
            cassandraVersion.children('div.text').text(`v${result.version}`)

            try {
              // If there's no provided data center by the user then skip this try-catch block
              if (dataCenter.trim().length <= 0 || `${dataCenter}` == 'undefined')
                throw 0

              // If the provided data center is not the same as the one connected with then show feedback to the user
              if (dataCenter != result.datacenter)
                showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData(`the specified data center [code]$data[/code] is not the one connected with [code]$data[/code]`, [dataCenter, result.datacenter]) + '.'), 'warning')
            } catch (e) {}

            // Show data center
            if (result.datacenter != undefined) {
              dataCenterElement.children('div._placeholder').hide()
              dataCenterElement.children('div.text').text(`${result.datacenter}`)
            }

            // Update some attributes for the connection UI element alongside some classes
            connectionElement.attr({
              'data-cassandra-version': result.version,
              'data-datacenter': result.datacenter,
              'data-datacenters': result.datacenters ? JSON.stringify(result.datacenters) : null,
              'data-connected': 'true'
            })

            // Add the success state to the connection's UI element
            statusElement.removeClass('failure')

            try {
              // If the version of Cassandra is not v3 then skip this try-catch block
              if (!result.version.startsWith('3.'))
                throw 0

              // Just warn the user about that unsupported version
              setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
            } catch (e) {}

            // Show success feedback to the user
            if (!clickConnectBtn)
              showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('test connection [b]$data[/b] in workspace [b]$data[/b] has finished with success, you can now connect with it and start a session', [getAttributes(connectionElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'success')

            setTimeout(() => {
              // Enable the `CONNECT` button
              connectBtn.add(testConnectionBtn).removeAttr('disabled')

              // Remove the test connection state
              connectionElement.removeClass('test-connection enable-terminate-process')

              // Hide the termination process' button after a set time out
              setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

              try {
                if (!clickConnectBtn)
                  throw 0

                setTimeout(() => connectBtn.click())
              } catch (e) {}
            })
          })
        })
      }

      /**
       * Inner function to do processes that come after checking SSH tunneling info
       *
       * @Parameters:
       * {object} `?sshCreation` the SSH tunnel object associated with the connection
       */
      let afterSSHTunnelingCheck = async (sshCreation = null) => {
        try {
          // If there's no pre-connection script to execute then skip this try-catch block
          if (scripts.pre.length <= 0)
            throw 0

          // Add the loading/processing class to the connection UI element
          connectionElement.addClass('test-connection')

          // Show the termination process' button
          IPCRenderer.removeAllListeners(`process:can-be-terminated:${testConnectionProcessID}`)
          IPCRenderer.on(`process:can-be-terminated:${testConnectionProcessID}`, () => setTimeout(() => connectionElement.addClass('enable-terminate-process')))

          // Show feedback to the user about starting the execution process
          setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('pre-connection scripts are being executed before starting with connection [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(connectionElement, 'data-name')])) + '.'), 50)

          // Execute the pre-connection scripts with order
          Modules.Connections.executeScript(0, scripts.pre, (executionResult) => {
            // All scripts have been executed successfully; thus start the connection test process
            if (executionResult.status == 0) {
              // Show a success feedback to the user
              setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of connection [b]$data[/b] have been successfully executed', [I18next.t('pre'), getAttributes(connectionElement, 'data-name')])) + '.', 'success'), 50)

              // Start the connection test process
              startTestConnection(sshCreation)

              // Skip the upcoming code
              return
            }

            /**
             * There's an issue with one or more script
             *
             * Define the feedback info
             */
            let info = `${I18next.t('script "$data" didn\'t return the success code [code]0[/code], but')} <code>${executionResult.status}</code>`

            // `-1000` error code means the app couldn't find the script in the given path
            if (status == -1000)
              info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

            // Show feedback to the user
            setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of connection [b]$data[/b]', [I18next.t('pre'), getAttributes(connectionElement, 'data-name')]))}. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`, 'failure'), 50)

            // Call the error feedback function
            errorVisualFeedback()
          })

          // Skip the upcoming code
          return
        } catch (e) {}

        // If there's no pre-connection script to execute then call the test connection function immediately
        startTestConnection(sshCreation)
      }

      // Inner function that do the changes in connection element when an error occurs
      let errorVisualFeedback = (isProcessTerminated = false) => {
        // Remove the test connection class
        connectionElement.removeClass('test-connection enable-terminate-process')

        // Hide the termination process' button after a set time out
        setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

        // Show failure feedback if the process hasn't been terminated
        statusElement.removeClass('success')[isProcessTerminated ? 'removeClass' : 'addClass']('show failure')

        // Enable the `CONNECT` button
        testConnectionBtn.removeAttr('disabled')

        // Get the credentials from the associated attributes
        let [credentialsAuth, credentialsSSH] = getAttributes(connectionElement, ['data-credentials-auth', 'data-credentials-ssh'])

        try {
          // If there are no DB authentication credentials then skip this try-catch block
          if (credentialsAuth == undefined)
            throw 0

          // Remove all related attributes
          connectionElement.removeAttr('data-username data-password data-got-credentials')
        } catch (e) {}

        try {
          // If there are no SSH credentials then skip this try-catch block
          if (credentialsSSH == undefined)
            throw 0

          // Remove all related attributes
          connectionElement.removeAttr('data-ssh-username data-ssh-password data-got-credentials')
        } catch (e) {}
      }

      /**
       * The workflow of the `testConnection` function is:
       * Pre-processes and checks -> Checking SSH tunneling info -> Create an SSH Tunnel || No need to create an SSH tunnel -> afterSSHTunnelingCheck() -> startTestConnection()
       *
       * Get the SSH tunnel creation info for the connection
       */
      let sshTunnelingInfo = await Modules.Connections.getSSHTunnelingInfo(workspaceID, getAttributes(connectionElement, 'data-folder'), getAttributes(connectionElement, 'data-id'))

      try {
        // If there's no need to create an SSH tunnel then skip this try-catch block
        if (sshTunnelingInfo == null || typeof sshTunnelingInfo != 'object' || sshTunnelingInfo.length <= 0)
          throw 0

        // Check if an SSH client is installed and accessible
        tunnelSSH.checkClient((exists) => {
          // If the SSH client doesn't exist
          if (!exists) {
            // Show feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection')), I18next.t('SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine') + '.', 'failure')

            // Call the error's visual feedback function
            errorVisualFeedback()

            // Skip the upcoming code - terminate the process -
            return
          }

          /**
           * Prepare the SSH tunnel's info
           *
           * Everything needed is present, except username and password - if no SSH private key file is provided -, so we'll get them, decrypt them, and add them to the object final SSH object
           */
          let [sshUsername, sshPassword, sshPassphrase] = getAttributes(connectionElement, ['data-ssh-username', 'data-ssh-password', 'data-ssh-passphrase'])

          // Check that the username is at least, and maybe password values are valid
          if (([sshUsername, sshPassword, sshPassphrase].every((secret) => secret == undefined || secret.trim().length <= 0))) {
            // If not then stop the test process and show feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection')), I18next.t('SSH tunnel can\'t be established without passing at least a username, please check given info before attempting to connect again') + '.', 'failure')

            // Call the error's visual feedback function
            errorVisualFeedback()

            // Skip the upcoming code
            return
          }

          // Get the RSA private key - of our project -; to decrypt username and/or password
          getRSAKey('private', (key) => {
            try {
              // If the received key is valid then skip this try-catch block
              if (key.length > 0)
                throw 0

              // Show feedback to the user about the app wasn't able to get the private key
              showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

              // Call the error's visual feedback function
              errorVisualFeedback()

              // Skip the upcoming code
              return
            } catch (e) {}

            /**
             * Reaching here means we need to decrypt the SSH username at least
             *
             * Decrypt the SSH username
             */
            sshUsername = decryptText(key, sshUsername)

            // Decrypt the SSH password
            sshPassword = decryptText(key, sshPassword)

            // Decrypt the SSH private key's passphrase
            sshPassphrase = decryptText(key, sshPassphrase)

            // Adopt the decrypted SSH password if it's valid
            if (sshPassword.trim().length > 0)
              sshTunnelingInfo.password = sshPassword

            // Adopt the decrypted SSH passphrase if it's valid
            if (sshPassphrase.trim().length > 0)
              sshTunnelingInfo.passphrase = sshPassphrase

            // Adopt the decrypted SSH username
            sshTunnelingInfo.username = sshUsername

            // Define the host and port to be passed to the SSH tunneling creation's function
            let host = sshTunnelingInfo.dstAddr != '127.0.0.1' ? sshTunnelingInfo.dstAddr : sshTunnelingInfo.host,
              port = sshTunnelingInfo.dstPort

            // Define the connection's ID in the SSH tunneling info object
            sshTunnelingInfo.connectionID = getAttributes(connectionElement, 'data-id')

            // Add the passed requestID
            sshTunnelingInfo = {
              ...sshTunnelingInfo,
              requestID: sshTunnelCreationRequestID
            }

            // Create an SSH tunnel based on the final `sshTunnelingInfo` object
            tunnelSSH.createTunnel(sshTunnelingInfo, (creationResult) => {
              // If there's no error then call the `afterSSHTunnelingCheck` function
              if (creationResult.error == undefined)
                return afterSSHTunnelingCheck({
                  port: creationResult.port, // The port to be shown to the user
                  oport: port, // The original port to be used within the creation process
                  ...creationResult,
                  host
                })

              /**
               * The app failed to establish an SSH tunnel
               *
               * Show feedback to the user
               */
              if (!creationResult.terminated)
                showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.replaceData('failed to establish an SSH tunnel for connection [b]$data[/b]', [getAttributes(connectionElement, 'data-name')]))}</b>. ${creationResult.error}.`, 'failure')

              // Call the error's visual feedback function
              errorVisualFeedback(creationResult.terminated)

              // End the testing process
              return
            })
          })
        })
        return
      } catch (e) {}

      // If there's no need to create an SSH tunnel then simply call the `afterSSHTunnelingCheck` function
      afterSSHTunnelingCheck()
    }
    // End of `testConnection` function

    /**
     * Inner function to update the SSL lock pad's status
     *
     * @Parameters:
     * {object} `connectionElement` is the target connection's UI element
     */
    let updateSSLLockpadStatus = (connectionElement) => {
      // Point at the SSL lock pad icon in the left side of the work area
      let workareaInfoContainer = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${getAttributes(connectionElement, 'data-id')}"] div.sub-sides.left div.connection-info`),
        lockpad = workareaInfoContainer.find('div.status ion-icon'),
        // Get the MDB tooltip's object of the lockpad
        tooltip = getElementMDBObject(lockpad.parent(), 'Tooltip')

      try {
        // Whether or not SSL is enabled or disabled for the target connection
        let enabledSSL = getAttributes(connectionElement, 'ssl-enabled')

        // Reset the lock pad status
        lockpad.attr('name', 'unknown')

        // Set the default title
        let defaultTitle = I18next.capitalize(I18next.t('analyzing status'))

        setTimeout(() => {
          // Make sure to hide the status' tooltip before doing any update
          try {
            tooltip.hide()
          } catch (e) {}
        })

        // If the SSL status for the connection is not defined yet then skip this try-catch block
        if (enabledSSL == undefined) {
          try {
            tooltip.setContent(defaultTitle)
          } catch (e) {}

          // Skip the upcoming code in the try-catch block
          throw 0
        }

        // Determine the SSL status in a boolean format
        enabledSSL = enabledSSL != 'false'

        // Update the lock pad icon and its color based on the status
        lockpad.attr('name', enabledSSL ? 'lock-closed' : 'lock-opened')

        setTimeout(() => {
          try {
            // Determine the suitable SSL status
            let tooltipContent = enabledSSL ? 'SSL is enabled' : 'SSL is not enabled'

            // Update the content of the tooltip
            tooltip.setContent(I18next.t(tooltipContent))

            // Update the new language's key
            $(tooltip.reference).attr('data-mulang', tooltipContent)
          } catch (e) {}
        })
      } catch (e) {}
    }

    /**
     * Inner function to update the mini connection's background color - the elements in the workspace's element in the list -
     *
     * @Parameters:
     * {string} `workspaceID` the ID of the connection's workspace
     * {string} `connectionID` the ID of the connection
     * {boolean} `?noColor` Determine if the mini connection's background color will be reseted
     */
    updateMiniConnection = (workspaceID, connectionID, noColor = false) => {
      // Point at the connection's workspace element
      let workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`),
        // Get the color of the workspace in RGB format `R G B`
        workspaceColorRGB = HEXToRGB(getAttributes(workspaceElement, 'data-color')).join(' '),
        // Point at the mini connection
        miniConnection = workspaceElement.find(`div._connection[_connection-id="${connectionID}"]`)

      // Determine if the mini connection is clickable - can be used to navigate to the connection's work area -
      miniConnection.toggleClass('clickable', !noColor)

      // Update the mini connection's background color
      // miniConnection.css('background', !noColor ? (getAttributes(workspaceElement, 'data-color').trim().length != 0 ? `rgb(${workspaceColorRGB} / 70%)` : '#7c7c7c') : '')
    }
  })
})
// End of `getConnections` and `refreshConnections` events

/**
 * Define an inner function - which will be used in `refresh` and `get` connections events and in other events associated with connections
 * The full definition is applied at the very bottom of 'getConnections refreshConnections' events listener
 */
let updateMiniConnection

// Set the time which after it the termination of the connection test process is allowed
const ConnectionTestProcessTerminationTimeout = 250

// Handle different events for elements related to connections - especially the add/edit connection dialog -
{
  // Add/edit dialog
  {
    // Define a portion of the common CSS selector
    let dialog = `div.modal#addEditConnectionDialog div.modal-body div.side`

    // Clicks any of the section's buttons in the left side of the dialog
    {
      $(`${dialog}-left div.sections div.section div.btn`).click(function() {
        // Get the section's name
        let section = $(this).attr('section')

        // Deactivate all sections
        $(`${dialog}-left div.sections div.section div.btn`).removeClass('active')

        // Hide all sections
        $(`${dialog}-right div.modal-section`).hide()

        // Activate the clicked section
        $(this).addClass('active')

        // Show the clicked section
        $(`${dialog}-right div.modal-section[section="${section}"]`).show().removeAttr('hidden')

        // Remove any notification about an invalid input in the active section
        try {
          $(this).children('div.invalid-inputs').fadeOut('fast')
        } catch (e) {}
      })
    }

    // Events handlers for the `Add New Connection` dialog and its elements
    {
      // Handle `input` and `click` events for all input fields
      {
        $(`${dialog}-right div.modal-section [info-section][info-key]`).on('input click', async function() {
          let input = $(this), // Point at the current input
            workspaceID = getActiveWorkspaceID() // Get the active workspace's ID

          // Remove any visual feedback about having an invalid value
          input.removeClass('is-invalid')

          // Ignore the input field if it is not associated with a section in the `cqlsh.rc` config file
          if (getAttributes(input, 'info-section') == 'none')
            return

          // Get the input's value, section, and key
          let value = input.val(),
            [section, key] = getAttributes(input, ['info-section', 'info-key'])

          // If the input is a switch then its value will be the whether it's checked or not
          if (getAttributes(input, 'type') == 'checkbox')
            value = input.prop('checked')

          // If the input is a file selector then get the selected file's path, or just ignore it
          if (getAttributes(input, 'type') == 'file') {
            try {
              value = input[0].files[0].path
            } catch (e) {
              value = ''
            }
          }

          // Convert final value to string
          value = `${value}`

          // Inner function to update the editor's content
          let update = async () => {
            isUpdatingEditor = true // Change the value to `true`; to prevent collisions

            try {
              let timestampGenerator = cqlshValues.connection.timestamp_generator,
                currentValue = $('input[info-section="connection"][info-key="timestamp_generator"]').attr('cqlsh-value')

              cqlshValues.connection.timestamp_generator = (timestampGenerator == 'Not Set' || currentValue == 'Not Set') ? 'DISABLED' : currentValue
            } catch (e) {}

            // Get final values - from the input fields - as JSON object
            let finalValues = await variablesManipulation(workspaceID, cqlshValues),
              // Apply the final values to the editor's content
              updatedCQLSH = Modules.Connections.setCQLSHRCContent(finalValues, null, addEditConnectionEditor)

            // Set the new content
            addEditConnectionEditor.setValue(updatedCQLSH)

            // Refresh the editor's layout
            addEditConnectionEditor.layout()
          }

          try {
            // If the input's value is not empty then skip this try-catch block
            if (`${value}`.trim().length > 0)
              throw 0

            /**
             * As the input's value is empty multiple choices are present:
             * One is to disable it in the editor by prepending a semicolon
             * Other is set a default value instead of the empty one
             *
             * Define the final input's value
             */
            let finalValue = ''

            // If the key/option is not one of those then it can be disabled in the editor's content
            if (!(['hostname', 'port'].includes(key)))
              finalValue = 'DISABLED'

            // Set the final value
            cqlshValues[section][key] = finalValue

            // Call the inner function `update`
            await update()

            // Skip the upcoming code
            return
          } catch (e) {}

          // Set the final value
          cqlshValues[section][key] = value

          // Call the inner `update` function
          await update()
        })
      }

      // When change occurs in any of the input fields - except the connection's name - the `SAVE THE CLUSTER` button will be disabled
      {
        $(`${dialog}-right div.modal-section [info-section][info-key]`).filter(function() {
          let isNotConnectionName = $(this).is(':not([info-key="connectionName"])'),
            isNotAxonOpsIntegration = !($(this).attr('info-key').startsWith('axonops-'))

          return isNotConnectionName && isNotAxonOpsIntegration
        }).on('input', () => $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null))
      }

      /**
       * Switching between the editor and the input fields
       *
       * When switching to the editor, the scroll value should be `0` - being at the top of the dialog -; to let the editor fit the entire dialog
       * Switching back to the input fields needs to set the scroll value before switching to the editor
       */
      {
        // Define the scroll value, by default, the current scroll value is `0` - at the top of the dialog -
        let scrollValue = 0,
          dialogElement = $(`div.modal#addEditConnectionDialog`)

        // Clicks the `SWITCH TO EDITOR` button
        $('#switchEditor').click(function() {
          // Point at the dialog's content element
          let dialogBody = dialogElement.find('div.modal-body'),
            // Determine if the editor is visible/shown or not
            editorShown = dialogElement.hasClass('show-editor')

          // Add the `show-editor` class if it is not added, otherwise it'll be removed
          dialogElement.toggleClass('show-editor', !editorShown)

          // Show/hide the expand editor's buttons
          $(`button#expandEditor`).toggleClass('show', !editorShown)

          // Update the current scroll value if the editor is not shown already, otherwise, keep the current saved value
          scrollValue = !editorShown ? dialogBody[0].scrollTop : scrollValue

          // Either scroll to the last saved position if the editor is visible, or scroll to the top of the dialog for the editor before showing it
          dialogBody[0].scrollTo(0, editorShown ? scrollValue : 0)

          // Update the editor's layout
          addEditConnectionEditor.layout()

          // Return the dialog to its normal dimensions once back to the UI mode instead of the editor mode
          if (dialogElement.find('div.modal-dialog').hasClass('expanded'))
            $(`button#expandEditor`).click()
        })

        /**
         * Create a resize observer for the add/edit dialog's body element
         * By doing this the editor's dimensions will be always fit with the dialog's dimensions
         */
        setTimeout(() => {
          (new ResizeObserver(() => {
            try {
              addEditConnectionEditor.layout()
            } catch (e) {}
          })).observe(dialogElement.find('div.modal-body')[0])
        })

        // Get the MDB object for the expand button's tooltip
        let tooltip = getElementMDBObject($(`button#expandEditor`), 'Tooltip')

        // Click the expand button - to expand the editor's view -
        $(`button#expandEditor`).click(function() {
          // Whether or not the dialog is already expanded
          let expanded = dialogElement.find('div.modal-dialog').hasClass('expanded')

          // Hide the tooltip once the button is clicked
          tooltip.hide()

          try {
            // If the dialog is already expanded then skip this try-catch block
            if (expanded)
              throw 0

            // Update the expand's button icon
            $(this).children('ion-icon').attr('name', 'collapse')

            // Expand the dialog
            dialogElement.children('div.modal-dialog').addClass('modal-xl expanded').removeClass('modal-lg')

            // Resize the editor initially - the resize observer will keep updating the size -
            addEditConnectionEditor.layout()

            // Skip the upcoming code
            return
          } catch (e) {}

          // Update the expand's button icon
          $(this).children('ion-icon').attr('name', 'expand')

          // Return to the default status of the dialog's size
          dialogElement.children('div.modal-dialog').addClass('modal-lg').removeClass('modal-xl expanded')

          // Resize the editor initially - the resize observer will keep updating the size -
          addEditConnectionEditor.layout()
        })
      }

      // Show/hide the password fields' values by interacting with the eye button
      {
        // Clicks the eye button
        $('div.form-outline div.reveal-password div.btn').click(function() {
          // Point at the password input field
          let password = $(this).parent().parent().children('input'),
            // If the input field type is `text` then the password value is revealed
            revealed = getAttributes(password, 'type') == 'text' ? true : false

          // Change the eye button's icon based on the revealing status
          $(this).children('ion-icon').attr('name', revealed ? 'eye-opened' : 'eye-closed')

          // Switch the password input field type based on the revealing status
          password.attr('type', revealed ? 'password' : 'text')
        })
      }

      {
        // Define a temporary connection ID to be used in the testing and adding prcoesses
        let tempConnectionID = null,
          // Hold the test connection's object
          testedConnectionObject = null,
          // Hold the test connection's created SSH tunnel - if one has been created -
          testedSSHTunnelObject = null

        // The testing connection process with the to be added/updated connection
        {
          /**
           * Define an initial ID for the connection test process of the to be added/updated connection
           * The value will be updated with every test connection process
           */
          let testConnectionProcessID,
            // Define an initial ID for the SSH tunnel creation process as well
            sshTunnelCreationRequestID,
            // Flag to tell if an SSH tunnel is needed before connecting with Cassandra connection/node
            isSSHTunnelNeeded = false

          // Clicks the `TEST CONNECTION` button to do a connection test with the connection before saving/updating it
          $('#testConnection').click(async function() {
            let hostname = '', // The given hostname
              port = 9042, // Default port to connect with Apache Cassandra
              dataCenter = $('[info-section="none"][info-key="datacenter"]').val(), // By default, no data center is set unless the user provides one
              // Apache Cassandra's authentication username and password
              username = '',
              password = '',
              waitForEncryption = false, // Don't wait for encryption as username and password are not provided
              sshTunnel = false, // There is no SSH tunnel creation info
              // SSH tunnel creation info's object
              ssh = {
                host: '',
                username: '',
                dstPort: 0
              },
              // Get the currently active workspace's ID
              workspaceID = getActiveWorkspaceID(),
              // Point at the `TEST CONNECTION` button
              button = $(this),
              // Point at the add/edit connection's dialog
              dialogElement = $('div.modal#addEditConnectionDialog')

            // Get a random ID for this connection test process
            testConnectionProcessID = getRandom.id(30)

            // Get a random ID for the SSH tunnel creation process
            sshTunnelCreationRequestID = getRandom.id(30)

            // Add log about this request
            try {
              addLog(`Request to test connection that could be added/updated`, 'action')
            } catch (e) {}

            try {
              // For AstraDB Connection type
              let isAstraDBConnectionType = $('div#addEditConnectionDialog').attr('data-selected-modal-body') == 'astra-db'

              if (!isAstraDBConnectionType)
                throw 0

              let astraDBConnectionData = {
                  ClientID: $('#astraDBClientID').val(),
                  ClientSecret: $('#astraDBClientSecret').val(),
                  SCBPath: $('#astraDBSCBPath').val()
                },
                requestID = getRandom.id(10)

              // Check if there's any missing data
              let isMissingDataFound = false

              try {
                for (let key of Object.keys(astraDBConnectionData)) {
                  let data = astraDBConnectionData[key],
                    isMissing = minifyText(data).length <= 0

                  $(`#astraDB${key}`).toggleClass('is-invalid', isMissing)

                  if (isMissing)
                    isMissingDataFound = true
                }
              } catch (e) {}

              if (isMissingDataFound)
                return showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.t('to test connection with Astra DB, all fields are required, please make sure to provide them all before attempting to test connection again')) + '.', 'failure')

              // The dialog is testing the connection with the connection
              dialogElement.addClass('test-connection')

              // Show the termination process' button
              IPCRenderer.removeAllListeners(`process:can-be-terminated:${testConnectionProcessID}`)
              IPCRenderer.on(`process:can-be-terminated:${testConnectionProcessID}`, () => setTimeout(() => dialogElement.addClass('enable-terminate-process')))

              // Disable all the buttons in the footer
              button.add('#addConnection').add('#switchEditor').attr('disabled', 'disabled')

              $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').addClass('disabled')

              tempConnectionID = null

              try {
                // Get the SSH username and password - for Apache Cassandra's authentication -
                username = astraDBConnectionData.ClientID
                password = astraDBConnectionData.ClientSecret

                // If both username and password have been provided then they'll be encrypted
                waitForEncryption = [username, password].every((secret) => secret.trim().length != 0)
              } catch (e) {}

              getRSAKey('public', async (key) => {
                try {
                  // If the received key is valid then skip this try-catch block
                  if (key.length > 0)
                    throw 0

                  // Remove the test connection class
                  dialogElement.removeClass('test-connection enable-terminate-process')

                  // Hide the termination process' button after a set time out
                  setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                  // Enable some buttons in the footer
                  button.add('#switchEditor').removeAttr('disabled', 'disabled')

                  $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')

                  // Disable the `SAVE CLUSTER` button
                  $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null)

                  // Show feedback to the user
                  showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                  // Skip the upcoming code - end the process -
                  return
                } catch (e) {}

                /**
                 * Reaching here means the received key is valid
                 *
                 * Encrypt both values; username and password
                 */
                encryptedUsername = encryptText(key, username)
                encryptedPassword = encryptText(key, password)

                // Request to test connection based on the provided data
                IPCRenderer.send('pty:test-connection', {
                  requestID,
                  processID: testConnectionProcessID,
                  secrets: {
                    username: encryptedUsername,
                    password: encryptedPassword
                  },
                  workspaceID: getActiveWorkspaceID(),
                  scbFilePath: astraDBConnectionData.SCBPath
                })

                // In both cases listen to the response about the connection test
                IPCRenderer.on(`pty:test-connection:${requestID}`, async (_, result) => {
                  try {
                    IPCRenderer.removeAllListeners(`pty:test-connection:${requestID}`)
                  } catch (e) {}

                  setTimeout(async () => {
                    /**
                     * If there's a post-connection script(s) to be executed
                     *
                     * Set this variable to hold the overall script's execution feedback
                     */
                    let executionFeedback = ''

                    // Hold the tested connection's object
                    testedConnectionObject = result

                    // Hold all detected/seen data centers' names in array
                    let allDataCenters

                    try {
                      // Remove the test connection class
                      dialogElement.removeClass('test-connection enable-terminate-process')

                      // Hide the termination process' button after a set time out
                      setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                      // Enable the `TEST CONNECTION` button
                      button.add('#switchEditor').removeAttr('disabled', 'disabled')

                      $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')

                      // Determine if the connection test has succeeded or not, or terminated
                      let notConnected = !result.connected || [undefined, null].includes(result.version) || result.terminated != undefined

                      // Enable or disable the save button based on the test's result
                      $('#addConnection').attr('disabled', !notConnected || getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') != undefined ? null : 'disabled')

                      // Failed to connect with the connection - process hasn't been terminated -
                      if (notConnected && result.terminated == undefined) {
                        // Define the error message
                        let error = result.error.trim().length != 0 ? ` ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                        // Show feedback to the user
                        showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to activate connection'))}${error}${executionFeedback}.`, 'failure')

                        // Skip the upcoming code
                        throw 0
                      }

                      // If the process has been terminated then skip this try-catch block
                      if (result.terminated != undefined)
                        throw 0

                      /**
                       * Successfully connected with the connection
                       *
                       * Get the success feedback suffix
                       */
                      let suffix = I18next.t('you may now add it')

                      // Change the suffix if the dialog's current mode is `edit`
                      if (getAttributes(dialogElement, 'data-edit-connection-id') != undefined)
                        suffix = I18next.t('you can now complete the update')

                      try {
                        // If the version of Cassandra is not v3 then skip this try-catch block
                        if (!result.version.startsWith('3.'))
                          throw 0

                        // Just warn the user about that unsupported version
                        setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
                      } catch (e) {}

                      // Show feedback to the user
                      showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('connection test has finished with success'))}, ${I18next.capitalizeFirstLetter(suffix)}${executionFeedback}.`, 'success')

                      // Refresh workspaces - to ensure synchronization with the latest data -
                      $(document).trigger('refreshWorkspaces')
                    } catch (e) {}
                  })
                })
              })

              return
            } catch (e) {}

            // For Apache Cassandra Connection type
            // Get a temporary random ID for the connection which is being tested
            tempConnectionID = getRandom.id(30)

            // Attempt to close the created SSH tunnel - if exists -
            try {
              IPCRenderer.send('ssh-tunnel:close', tempConnectionID)
            } catch (e) {}

            try {
              /**
               * To test the connection, the user should have provided the hostname at least
               *
               * Get the `hostname` for the given data
               */
              hostname = cqlshValues.connection.hostname

              port = cqlshValues.connection.port

              // If the hostname is empty or only whitespaces then skip this try-catch block
              if (hostname.trim().length <= 0 || `${cqlshValues.connection.port}`.length <= 0)
                throw 0
            } catch (e) {
              /**
               * Being here means the given hostname is invalid
               *
               * Add `invalid` class to the `hostname` input field
               */
              if (`${cqlshValues.connection.port}`.length <= 0)
                $('[info-section="connection"][info-key="port"]').addClass('is-invalid')

              if (hostname.trim().length <= 0)
                $('[info-section="connection"][info-key="hostname"]').addClass('is-invalid')

              // Point at the basic section navigation button in the dialog
              let basicSectionBtn = dialogElement.find('div.btn[section="basic"]')

              // If the basic section is not the currently active one then show invalid inputs notification
              if (!basicSectionBtn.hasClass('active'))
                basicSectionBtn.children('div.invalid-inputs').fadeIn('fast')

              // Show feedback to the user
              showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.t('to test connection, host name and port are the only required fields to be provided')) + '.', 'failure')

              // Skip the upcoming code - end the connection test process -
              return
            }

            // Determine if any sensitive data has been added to the `cqlsh.rc` file
            let foundSensitiveData = false,
              // Determine if there's pre-post connection script(s) to be executed
              scripts = {
                pre: [],
                post: []
              },
              // Will store the `cqlsh.rc` config file's content in the editor
              cqlshContent

            /**
             * Check pre and post connect scripts
             * Get all scripts associated with the connection
             */
            let check = await Modules.Connections.getPrePostScripts(workspaceID)

            // Set the received data
            scripts.pre = check.pre
            scripts.post = check.post
            foundSensitiveData = check.foundSensitiveData
            cqlshContent = check.cqlshContent

            try {
              // If no sensitive data has been found then skip this try-catch block
              if (!foundSensitiveData)
                throw 0

              // Show feedback to the user about having sensitive data in the `cqlsh.rc` config file's content
              showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.t(`workbench stores sensitive data encrypted and securely using the appropriate secure storage mechanism for your OS. The [code]cqlsh.rc[/code] content added contains sensitive information (such as username, password or a path to a credentials file), which is not permitted. Please remove this sensitive data before attempting to connect again`)) + '.', 'failure')

              // Enable the `TEST CONNECTION` button
              button.add('#switchEditor').removeAttr('disabled', 'disabled')

              $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')

              // Remove the test connection class
              dialogElement.removeClass('test-connection enable-terminate-process')

              // Hide the termination process' button after a set time out
              setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

              // Skip the upcoming code
              return
            } catch (e) {}

            // Check if there's a need to create an SSH tunnel
            try {
              // Get related inputs values to the SSH tunnel info
              let values = ['username', 'password', 'privatekey', 'passphrase']

              // Loop through each value
              values.forEach((value) => {
                // Get the value of the current input
                ssh[value] = $(`[info-section="none"][info-key="ssh-${value}"]`).val()
              })

              // Check if username has been given but without password nor private key path
              if (ssh.username.trim().length != 0 && ([ssh.password, ssh.privatekey].every((secret) => secret.trim().length <= 0)))
                return showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('username [code]$data[/code] has been provided for creating an SSH tunnel without providing neither a password nor private key, please consider to provide one of them and try again', [ssh.username])) + '.', 'failure')

              // If both username and (password or private key) have been provided then an SSH tunnel should be created
              sshTunnel = ssh.username.trim().length != 0 && ([ssh.password, ssh.privatekey].some((secret) => secret.trim().length != 0))

              // Set the flag's value
              isSSHTunnelNeeded = sshTunnel
            } catch (e) {}

            // The dialog is testing the connection with the connection
            dialogElement.addClass('test-connection')

            // Show the termination process' button
            IPCRenderer.removeAllListeners(`process:can-be-terminated:${testConnectionProcessID}`)
            IPCRenderer.on(`process:can-be-terminated:${testConnectionProcessID}`, () => setTimeout(() => dialogElement.addClass('enable-terminate-process')))

            // Disable all the buttons in the footer
            button.add('#addConnection').add('#switchEditor').attr('disabled', 'disabled')

            $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').addClass('disabled')

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

              try {
                // Get the SSH username and password - for Apache Cassandra's authentication -
                username = $('[info-section="none"][info-key="username"]').val()
                password = $('[info-section="none"][info-key="password"]').val()

                // If both username and password have been provided then they'll be encrypted
                waitForEncryption = [username, password].every((secret) => secret.trim().length != 0)
              } catch (e) {}

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
                    files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandom.id(20)}.aocwtmp`))

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

                // If there's a need to wait for the encryption of the username and password before starting the connection test
                if (waitForEncryption) {
                  // Get the app's RSA public key - for encryption we use the public key -
                  getRSAKey('public', async (key) => {
                    try {
                      // If the received key is valid then skip this try-catch block
                      if (key.length > 0)
                        throw 0

                      // Delete the temp file which contains the `cqlsh.rc` config file's content
                      try {
                        await FS.unlinkSync(tempConfigFile)
                      } catch (e) {
                        try {
                          errorLog(e, 'connections')
                        } catch (e) {}
                      }

                      // Remove the test connection class
                      dialogElement.removeClass('test-connection enable-terminate-process')

                      // Hide the termination process' button after a set time out
                      setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                      // Enable some buttons in the footer
                      button.add('#switchEditor').removeAttr('disabled', 'disabled')

                      $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')

                      // Disable the `SAVE CLUSTER` button
                      $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null)

                      // Show feedback to the user
                      showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                      // Skip the upcoming code - end the process -
                      return
                    } catch (e) {}

                    /**
                     * Reaching here means the received key is valid
                     *
                     * Encrypt both values; username and password
                     */
                    encryptedUsername = encryptText(key, username)
                    encryptedPassword = encryptText(key, password)

                    // Request to test connection based on the provided data
                    IPCRenderer.send('pty:test-connection', {
                      requestID: cqlshrc.name,
                      processID: testConnectionProcessID,
                      secrets: {
                        username: encryptedUsername,
                        password: encryptedPassword
                      },
                      workspaceID: getActiveWorkspaceID(),
                      cqlshrcPath: tempConfigFile,
                      ...override
                    })
                  })
                } else {
                  /**
                   * No need to encrypt any data or wait for an encryption process
                   *
                   * Request to test connection based on the provided data
                   */
                  IPCRenderer.send('pty:test-connection', {
                    requestID: cqlshrc.name,
                    processID: testConnectionProcessID,
                    ...override,
                    workspaceID: getActiveWorkspaceID(),
                    cqlshrcPath: tempConfigFile
                  })
                }

                // In both cases listen to the response about the connection test
                IPCRenderer.on(`pty:test-connection:${cqlshrc.name}`, async (_, result) => {
                  try {
                    IPCRenderer.removeAllListeners(`pty:test-connection:${cqlshrc.name}`)
                  } catch (e) {}

                  setTimeout(async () => {
                    // Delete the temp file which contains the `cqlsh.rc` config file's content
                    try {
                      await FS.unlinkSync(tempConfigFile)
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }

                    /**
                     * If there's a post-connection script(s) to be executed
                     *
                     * Set this variable to hold the overall script's execution feedback
                     */
                    let executionFeedback = ''

                    // Hold the tested connection's object
                    testedConnectionObject = result

                    /**
                     * Implement a data center(s) check
                     * Define a flag to tell if the provided data center - if provided - exists and is seen by the app or not
                     */
                    let isDataCenterExists = true,
                      // Hold all detected/seen data centers' names in array
                      allDataCenters

                    try {
                      // If there's no provided data center by the user then skip this try-catch block
                      if (dataCenter.trim().length <= 0)
                        throw 0

                      // Determine if the provided data center exists
                      isDataCenterExists = result.datacenters.filter((_dataCenter) => _dataCenter.datacenter == dataCenter).length != 0

                      // Hold all detected/seen data centers
                      allDataCenters = [...new Set(result.datacenters.map((_dataCenter) => _dataCenter.datacenter))]
                    } catch (e) {}

                    try {
                      // Remove the test connection class
                      dialogElement.removeClass('test-connection enable-terminate-process')

                      // Hide the termination process' button after a set time out
                      setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                      // Enable the `TEST CONNECTION` button
                      button.add('#switchEditor').removeAttr('disabled', 'disabled')

                      $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')

                      // Determine if the connection test has succeeded or not, or terminated
                      let notConnected = !result.connected || [undefined, null].includes(result.version) || result.terminated != undefined

                      // Enable or disable the save button based on the test's result
                      $('#addConnection').attr('disabled', !notConnected || getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') != undefined ? null : 'disabled')

                      // If the provided data center doesn't exist
                      if (!isDataCenterExists) {
                        let allDataCentersStr = JSON.stringify(allDataCenters)

                        // Format the string format of the data centers array for the toast
                        allDataCentersStr = allDataCentersStr.slice(1, allDataCentersStr.length - 1).replace(/\"/g, '').split(',').join('[/code], [code]')

                        // Show feedback to the user
                        showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('the set data center [code]$data[/code] is not recognized but the following data center(s): [code]$data[/code]. Please consider updating the data center input field or leaving it blank', [dataCenter, allDataCentersStr])) + '.', 'failure')

                        // Enable or disable the save button based on the test's result
                        $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null)

                        // Skip the upcoming code
                        throw 0
                      }

                      // Failed to connect with the connection - process hasn't been terminated -
                      if (notConnected && result.terminated == undefined) {
                        // Define the error message
                        let error = result.error.trim().length != 0 ? ` ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                        // Show feedback to the user
                        showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to activate connection'))}${error}${executionFeedback}.`, 'failure')

                        // Skip the upcoming code
                        throw 0
                      }

                      // If the process has been terminated then skip this try-catch block
                      if (result.terminated != undefined)
                        throw 0

                      try {
                        // If there's no provided data center by the user then skip this try-catch block
                        if (dataCenter.trim().length <= 0 || `${dataCenter}` == 'undefined')
                          throw 0

                        // If the provided data center is not the same as the one connected with then show feedback to the user
                        if (dataCenter != result.datacenter)
                          showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData(`the specified data center [code]$data[/code] is not the one connected with [code]$data[/code]`, [dataCenter, result.datacenter]) + '.'), 'warning')
                      } catch (e) {}

                      /**
                       * Successfully connected with the connection
                       *
                       * Get the success feedback suffix
                       */
                      let suffix = I18next.t('you may now add it')

                      // Change the suffix if the dialog's current mode is `edit`
                      if (getAttributes(dialogElement, 'data-edit-connection-id') != undefined)
                        suffix = I18next.t('you can now complete the update')

                      try {
                        // If the version of Cassandra is not v3 then skip this try-catch block
                        if (!result.version.startsWith('3.'))
                          throw 0

                        // Just warn the user about that unsupported version
                        setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
                      } catch (e) {}

                      // Show feedback to the user
                      showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('connection test has finished with success'))}, ${I18next.capitalizeFirstLetter(suffix)}${executionFeedback}.`, 'success')

                      // Refresh workspaces - to ensure synchronization with the latest data -
                      $(document).trigger('refreshWorkspaces')
                    } catch (e) {}

                    // Check if there are post-connection scripts to be executed after the connection attempt
                    if (scripts.post.length != 0) {
                      // Show feedback to the user about starting the execution process
                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.t('post-connection scripts are being executed after closing the connection, you\'ll be notified once the process is finished')) + '.'), 50)

                      // Request to execute the post-connection scripts
                      Modules.Connections.executeScript(0, scripts.post, (executionResult) => {
                        /**
                         * All scripts have been successfully executed and all of them have returned `0`
                         * Show the success feedback to the user and skip the upcoming code
                         */
                        if (executionResult.status == 0)
                          return setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of the connection have been successfully executed', [I18next.t('post')])) + '.', 'success'), 50)

                        /**
                         * There's an issue with one or more script
                         *
                         * Define the feedback info
                         */
                        let info = `${I18next.t('script "$data" didn\'t return the success code [code]0[/code], but')} <code>${executionResult.status}</code>.`

                        // `-1000` error code means the app couldn't find the script in the given path
                        if (status == -1000)
                          info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                        // Final feedback to be shown to the user
                        executionFeedback = `${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}`

                        // Show feedback to the user
                        setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of the connection', [I18next.t('post')]))}. ${executionFeedback}`, 'failure'), 50)
                      })
                    }
                  })
                })
              }

              /**
               * Define the `cqlsh.rc` file content from the editor, and set its random name
               * For testing the connection, a temporary file with the editor's content will be created in the OS temp folder
               */
              let cqlshrc = {
                  value: addEditConnectionEditor.getValue(),
                  name: `${getRandom.id(10)}.cwb` // [C]assandra [W]ork[B]ench
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

                // Show feedback to the user the about failure to create a necessary temp file for the connection test process
                showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to complete the test process, please check the privileges of the app to read/write'))}.`, 'failure')

                // Disable the `SAVE CLUSTER` button
                $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null)

                // Skip the upcoming code
                return
              } catch (e) {}

              // Call the function which will start the connection test
              startTestConnection()
            }
            // End of the function `afterSSHProcess`

            // Inner function to check and - based on the check result - create an SSH tunnel
            let checkAndCreateSSHTunnel = () => {

              let resetDialogStatus = () => {
                // Remove the test connection class
                dialogElement.removeClass('test-connection enable-terminate-process')

                // Hide the termination process' button after a set time out
                setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                // Enable the `TEST CONNECTION` button
                button.add('#switchEditor').removeAttr('disabled', 'disabled')

                $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')
              }

              /**
               * There's a need to create an SSH tunnel before testing the connection with the connection
               *
               * Check if an SSH client is installed and accessible
               */
              tunnelSSH.checkClient((exists) => {
                // If the SSH client doesn't exist then end the process and show feedback to the user
                if (!exists) {
                  showToast(I18next.capitalize(I18next.t('test connection')), I18next.t('SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine') + '.', 'failure')

                  return resetDialogStatus()
                }

                // Define the essential SSH tunnel creation info
                ssh.host = $('[info-section="none"][info-key="ssh-host"]').val()
                ssh.port = $('[info-section="none"][info-key="ssh-port"]').val() || 22
                ssh.dstAddr = hostname
                ssh.dstPort = cqlshContent.connection.port
                ssh.connectionID = tempConnectionID

                if (minifyText(ssh.host).length <= 0) {
                  showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.t('a valid SSH host is required in order to establish SSH tunnel, please make sure to provide it and try again')) + '.', 'failure')

                  $('[info-section="none"][info-key="ssh-host"]').addClass('is-invalid')

                  // Point at the basic section navigation button in the dialog
                  let sshTunnelSectionBtn = dialogElement.find('div.btn[section="ssh-tunnel"]')

                  // If the basic section is not the currently active one then show invalid inputs notification
                  if (!sshTunnelSectionBtn.hasClass('active'))
                    sshTunnelSectionBtn.children('div.invalid-inputs').fadeIn('fast')

                  return resetDialogStatus()
                }

                // Add the generated requestID
                ssh = {
                  ...ssh,
                  requestID: sshTunnelCreationRequestID
                }

                // Create an SSH tunnel
                tunnelSSH.createTunnel(ssh, (creationResult) => {
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

                  resetDialogStatus()

                  // Show feedback to the user
                  if (!creationResult.terminated)
                    showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to establish an SSH tunnel for the connection'))}. ${creationResult.error}.`, 'failure')
                })
              })
            }

            // Execute pre-connection scripts if needed
            try {
              // If there's no pre-connection script(s) to be executed then skip this try-catch block
              if (scripts.pre.length <= 0)
                throw 0

              // Show feedback to the user about starting the execution process
              setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.t('pre-connection scripts are being executed before starting the connection, you\'ll be notified once the process is finished')) + '.'), 50)

              // Request to execute the pre-connection script(s)
              Modules.Connections.executeScript(0, scripts.pre, (executionResult) => {
                /**
                 * All scripts have been executed successfully
                 * Call the function which will start the connection test
                 */
                if (executionResult.status == 0) {
                  // Show success feedback to the uers
                  setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of the connection have been successfully executed', [I18next.t('pre')])) + '.', 'success'), 50)

                  // If there's no need to create an SSH tunnel then directly call the `afterSSHProcess` function
                  if (!sshTunnel)
                    return afterSSHProcess(null)

                  // Otherwise, call the `checkAndCreateSSHTunnel` function
                  checkAndCreateSSHTunnel()

                  // Skip the upcoming code
                  return
                }

                /**
                 * There's an issue with one or more script
                 *
                 * Define the feedback info
                 */
                let info = `${I18next.t('script "$data" didn\'t return the success code [code]0[/code], but')} <code>${executionResult.status}</code>.`

                // `-1000` error code means the app couldn't find the script in the given path
                if (status == -1000)
                  info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                // Show feedback to the user
                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of the connection', [I18next.t('pre')]))}. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}`, 'failure'), 50)

                // Remove the test connection class
                dialogElement.removeClass('test-connection enable-terminate-process')

                // Hide the termination process' button after a set time out
                setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                // Enable the `TEST CONNECTION` button
                button.add('#switchEditor').removeAttr('disabled', 'disabled')

                $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').removeClass('disabled')

                // Disable the `SAVE CLUSTER` button
                $('#addConnection').attr('disabled', getAttributes($('div.modal#addEditConnectionDialog'), 'data-edit-connection-id') == undefined ? 'disabled' : null)
              })

              // Skip the upcoming code
              return
            } catch (e) {}

            // Call the `afterSSHProcess` function if there's no need to create an SSH tunnel
            if (!sshTunnel)
              return afterSSHProcess(null)

            // Call the `checkAndCreateSSHTunnel` function as there's a need to create an SSH tunnel
            checkAndCreateSSHTunnel()
          })

          // Clicks the process termination button
          $('#terminateConnectionTestProcess').add('#terminateConnectionTestProcessAstraDB').click(() => {
            try {
              if (!isSSHTunnelNeeded)
                throw 0

              // Attempt to close the SSH tunnel if it has already been created
              try {
                IPCRenderer.send('ssh-tunnel:close', tempConnectionID)
              } catch (e) {}

              // Send a request to terminate the SSH tunnel creation process
              IPCRenderer.send(`ssh-tunnel:terminate`, sshTunnelCreationRequestID)

              // Show success feedback to the user
              showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData('the testing process of the connection to be added/edited in workspace [b]$data[/b] has been terminated with success', [getWorkspaceName(getActiveWorkspaceID())]) + '.'), 'success')
            } catch (e) {}

            // Send request to the main thread to terminate the current ongoing connection test process
            IPCRenderer.send(`process:terminate:${testConnectionProcessID}`)

            // Send request to the main thread to terminate the connection test process - if there's any -
            try {
              IPCRenderer.send(`pty:test-connection:terminate`, checkCassandraProcessID)
            } catch (e) {}

            // Once the termination status is received
            if (!isSSHTunnelNeeded)
              IPCRenderer.on(`process:terminate:${testConnectionProcessID}:result`, (_, status) => showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData(status ? 'the testing process of the connection to be added/edited in workspace [b]$data[/b] has been terminated with success' : 'something went wrong, failed to terminate the testing process of the connection to be added/edited in workspace [b]$data[/b]', [getWorkspaceName(getActiveWorkspaceID())]) + '.'), status ? 'success' : 'failure'))
          })
        }

        // Clicks the `SAVE/UPDATE CLUSTER` button
        {
          $('#addConnection').click(async function() {
            let connectionName = $('[info-section="none"][info-key="connectionName"]').val(), // The connection's unique name
              dataCenter = $('[info-section="none"][info-key="datacenter"]').val(), // By default, no data center is set unless the user provides one
              username = '', // Apache Cassandra's username
              password = '', // Apache Cassandra's password
              sshUsername = '', // SSH username - for creating a tunnel -
              sshPassword = '', // SSH password
              sshPrivatekey = '', // SSH RSA private key content - not a path -
              sshPassphrase = '', // SSH private key's passphrase
              sshTunnel = false, // There is no SSH tunneling info
              saveAuthCredentials = $('input#saveAuthCredentials').prop('checked'),
              saveSSHCredentials = $('input#saveSSHCredentials').prop('checked'),
              waitForEncryption = false, // Don't wait for encryption, username and password are not provided
              workspaceID = getActiveWorkspaceID(), // Current active workspace's ID
              // Current active workspace's folder path
              workspaceFolder = getAttributes($(`div.workspace[data-id="${workspaceID}"]`), 'data-folder'),
              // Save/update button
              button = $(this),
              // We're in editing mode or not
              editingMode = getAttributes($(`div.modal#addEditConnectionDialog`), 'data-edit-connection-id') != undefined,
              finalConnection

            // Add log about this request
            try {
              addLog(`Request to add/edit new connection after a successful test`, 'action')
            } catch (e) {}

            /**
             * Inner function to do processes after saving/updating connection
             *
             * @Parameters:
             * {boolean} `status` saving/updating process status [true: success, false: failed]
             * {object} `?secrets` secrets to be updated for the connection after the saving/updating process
             */
            let postProcess = async (status, secrets = null) => {
              // Enable the buttons in the footer
              button.add('#testConnection').add('#switchEditor').removeAttr('disabled')

              try {
                // If the saving/updating process has succeeded then skip this try-catch block
                if (status)
                  throw 0

                // Show feedback to the user about the failure
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), `${I18next.capitalizeFirstLetter(I18next.t(editingMode ? 'failed to update the connection' : 'failed to add the new connection'))}.`, 'failure')

                // Skip the upcoming code - end the process -
                return
              } catch (e) {}

              /**
               * The connection has been successfully saved/updated
               *
               * Show feedback to the user
               */
              showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), `${I18next.capitalizeFirstLetter(I18next.t(editingMode ? 'the connection has been successfully updated' : 'the new connection has been successfully added'))}.`, 'success')

              // Click the close button
              $(`${dialog}-right`).parent().parent().find('button.btn-close').click()

              // Make sure all fields are cleared
              try {
                /**
                 * If this is an editing mode then there's no need for this try-catch block
                 * When the user attempts to edit another connection all fields are updated
                 * Also when attempting to add a new connection the app detects that the previous attempt was `edit` and do changes as needed
                 */
                if (editingMode)
                  throw 0

                setTimeout(() => {
                  // Set the default `.cqlshrc` content
                  addEditConnectionEditor.setValue(Modules.Consts.CQLSHRC)

                  $('div.modal#addEditConnectionDialog div.modal-body div.side-left div.sections div.section div.btn[section="basic"]').click()

                  // Loop through each input not related to section nor key in the `.cqlshrc` content
                  $('[info-section="none"][info-key]').each(function() {
                    // Get the input's Material Design object
                    let object_ = getElementMDBObject($(this))

                    // Handle when the input is actually a file selector
                    try {
                      // If the input is not a file selector then skip this try-catch block
                      if ($(this).parent().attr('file-name') == undefined)
                        throw 0

                      /**
                       * Update the tooltip's content and state
                       * Get the object
                       */
                      let tooltipObject = mdbObjects.filter((object) => object.type == 'Tooltip' && object.element.is($(this)))

                      // Clear the file's name preview
                      $(this).parent().attr('file-name', '-')

                      // Disable the tooltip
                      try {
                        tooltipObject[0].object.disable()
                      } catch (e) {}
                    } catch (e) {}

                    /**
                     * If it is `undefined` then it hasn't been found in the `cqlsh.rc` file
                     * Set the input value to ''
                     */
                    try {
                      $(this).val('')
                    } catch (e) {
                      // If the previous set didn't work then try to call the `selected` attribute
                      try {
                        $(this).prop('checked', getAttributes($(this), 'default-value') == 'true' ? true : false)
                      } catch (e) {}
                    } finally {
                      // Update the object
                      object_.update()
                      setTimeout(() => object_._deactivate())
                    }
                  })
                }, 1000)

                $('#axonOpsSaaS').prop('checked', true)
                $('#axonOpsSaaS').trigger('change')
              } catch (e) {}

              try {
                // If the current mode is not `edit` then skip this try-catch block
                if (!editingMode)
                  throw 0

                // Point at the connection's UI element in the workspace connections' list
                let connectionUI = $(`div.connections-container div.connections div.connection[data-id="${editedConnectionObject.info.id}"]`),
                  // Get all saved connections
                  getAllConnections = await Modules.Connections.getConnections(workspaceID),
                  // Get the edited/updated connection
                  newEditedConnection = getAllConnections.find((_connection) => _connection.info.id == finalConnection.info.id)

                // Update the connection's name
                try {
                  connectionUI.find('div.header > div.title').text(newEditedConnection.name)
                } catch (e) {}

                // Update the connection's host
                try {
                  connectionUI.find('div.info[info="host"] div.text').text(newEditedConnection.host)
                } catch (e) {}

                // Hide cassandra and datacenter info elements and show their placeholder
                (['cassandra', 'data-center']).forEach((info) => {
                  info = connectionUI.find(`div.info[info="${info}"]`)
                  info.children('div.text').text('')
                  info.children('div._placeholder').fadeIn('fast')
                })

                // Update the connection's UI element's attributes
                connectionUI.attr({
                  'data-name': newEditedConnection.name,
                  'data-folder': newEditedConnection.folder,
                  'data-host': newEditedConnection.host,
                  'data-connected': 'false',
                  'data-workarea': 'false'
                })

                try {
                  let relatedData = finalConnection.info.axonOpsIntegration,
                    areAllDataValid = relatedData != undefined && Object.keys(relatedData).every((data) => relatedData[data].length > 0)

                  connectionUI.attr({
                    'data-axonops-integration-organization': areAllDataValid ? relatedData.organization : null,
                    'data-axonops-integration-clusterName': areAllDataValid ? relatedData.clusterName : null,
                    'data-axonops-integration-url': areAllDataValid ? relatedData.url : null
                  })

                  connectionUI.find('div.footer').find('div.actions').toggleClass('axonops-integration', areAllDataValid && isInitAxonOpsIntegrationEnabled)
                  connectionUI.find('div.footer').find('div.actions').find('div.action[action="axonops-integration"]').toggle(areAllDataValid && isInitAxonOpsIntegrationEnabled)
                  connectionUI.find('div.footer').find('div.actions').find('div.action[action="axonops-integration"]').attr('hidden', areAllDataValid && isInitAxonOpsIntegrationEnabled ? null : '')
                } catch (e) {}

                // Update the status of the connection in the mini connection's list
                updateMiniConnection(workspaceID, getAttributes(connectionUI, 'data-id'), true)

                try {
                  // Update secrets data for the connection - Apache Cassandra's authentication and SSH credentials -
                  connectionUI.attr({
                    'data-username': saveAuthCredentials && secrets.auth == undefined ? (secrets != null ? secrets.username : null) : null,
                    'data-password': saveAuthCredentials && secrets.auth == undefined ? (secrets != null ? secrets.password : null) : null,
                    'data-ssh-username': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshUsername : null) : null,
                    'data-ssh-password': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshPassword : null) : null,
                    'data-ssh-passphrase': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshPassphrase : null) : null,
                    'data-credentials-auth': secrets.auth != undefined || (!saveAuthCredentials && (secrets != null && secrets.username != null && secrets.password != null)) ? 'true' : null,
                    'data-credentials-ssh': secrets.ssh != undefined || !saveSSHCredentials && (secrets != null && secrets.sshUsername != null && secrets.sshPassword != null) ? 'true' : null,
                  })
                } catch (e) {
                  try {
                    errorLog(e, 'connections')
                  } catch (e) {}
                }

                // Remove all test connection status classes
                connectionUI.find('div.status').removeClass('show success failure')

                // Update the global `editedConnectionObject` value
                editedConnectionObject = newEditedConnection
              } catch (e) {}

              // Refresh connections for the currently active workspace
              $(document).trigger('refreshConnections', {
                workspaceID
              })

              // Get workspaces; to sync with newly added/updated connections
              $(document).trigger('getWorkspaces')

              {
                setTimeout(() => {
                  let connectionElement = $(`div.connections-container div.connection[data-id="${finalConnection.info.id}"]`),
                    cassandraVersion = connectionElement.find('div[info="cassandra"]'),
                    // Point at the data center element
                    dataCenterElement = connectionElement.find('div[info="data-center"]'),
                    // Point at the `CONNECT` button
                    connectBtn = connectionElement.children('div.footer').children('div.button').children('button.connect'),
                    // Point at the `TEST CONNECTION` button
                    testConnectionBtn = connectionElement.children('div.footer').children('div.button').children('button.test-connection'),
                    // Point at the status element - the flashing circle at the top right -
                    statusElement = connectionElement.children('div.status')

                  try {
                    if (!secrets[0])
                      throw 0

                    getRSAKey('public', (key) => {
                      try {
                        // If the received key is valid to be used then skip this try-catch block
                        if (key.length <= 0)
                          throw 0

                        for (secret of secrets) {
                          if (typeof secret !== 'object')
                            continue

                          try {
                            if (`${secret.value}`.length <= 0)
                              throw 0

                            let value = encryptText(key, secret.value)

                            connectionElement.attr(`data-${secret.name.toLowerCase().replace('ssh', 'ssh-')}`, value)
                          } catch (e) {}
                        }
                      } catch (e) {}
                    })
                  } catch (e) {}

                  try {
                    if (tempConnectionID == null)
                      throw 0

                    /**
                     * Add the created SSH tunnel object to the `sshTunnelsObjects` array; to have the ability to identify if the connection has an SSH tunnel associated with it
                     */
                    sshTunnelsObjects[finalConnection.info.id] = testedSSHTunnelObject

                    try {
                      IPCRenderer.send('ssh-tunnel:update', {
                        oldID: tempConnectionID,
                        newID: finalConnection.info.id
                      })
                    } catch (e) {}
                  } catch (e) {}

                  // Show Apache Cassandra version
                  try {
                    if (testedConnectionObject.version != undefined) {
                      cassandraVersion.children('div._placeholder').hide()
                      cassandraVersion.children('div.text').text(`v${testedConnectionObject.version}`)
                    }
                  } catch (e) {}

                  // Show data center
                  try {
                    if (testedConnectionObject.datacenter != undefined) {
                      dataCenterElement.children('div._placeholder').hide()
                      dataCenterElement.children('div.text').text(`${testedConnectionObject.datacenter}`)
                    }
                  } catch (e) {}

                  // Update some attributes for the connection UI element alongside some classes
                  let isConnected = false
                  try {
                    connectionElement.attr({
                      'data-cassandra-version': testedConnectionObject.version,
                      'data-datacenter': testedConnectionObject.datacenter,
                      'data-datacenters': JSON.stringify(testedConnectionObject.datacenters),
                      'data-connected': 'true'
                    })

                    isConnected = true
                  } catch (e) {}

                  if (!isConnected)
                    return

                  // Add the success state to the connection's UI element
                  statusElement.removeClass('failure').addClass('show success')

                  setTimeout(() => {
                    // Enable the `CONNECT` button
                    connectBtn.add(testConnectionBtn).removeAttr('disabled')

                    // Remove the test connection state
                    connectionElement.removeClass('test-connection enable-terminate-process')

                    // Hide the termination process' button after a set time out
                    setTimeout(() => connectionElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
                  })
                }, 1000)
              }
            }
            // End of the inner function to do processes after saving/updating connection

            // For AstraDB Connection type
            try {
              let isAstraDBConnectionType = $('div#addEditConnectionDialog').attr('data-selected-modal-body') == 'astra-db'

              if (!isAstraDBConnectionType)
                throw 0

              let astraDBConnectionData = {
                ClientID: $('#astraDBClientID').val(),
                ClientSecret: $('#astraDBClientSecret').val(),
                SCBPath: $('#astraDBSCBPath').val()
              }

              connectionName = $('#astraDBConnectionName').val()

              // For Apache Cassandra Connection type
              try {
                // If the provided connection's name is valid then skip this try-catch block
                if (connectionName.trim().length > 0)
                  throw 0

                // Add an `invalid` class to the connection name's input field
                $('#astraDBConnectionName').addClass('is-invalid')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.t('to add a connection, a unique valid name is required to be provided')) + '.', 'failure')

                // Skip the upcoming code - terminate the connection's saving/updating process -
                return
              } catch (e) {}

              username = astraDBConnectionData.ClientID

              password = astraDBConnectionData.ClientSecret

              // Disable the buttons in the footer
              button.add('#testConnection').add('#switchEditor').attr('disabled', 'disabled')

              $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type').addClass('disabled')

              // Get all saved connections in the workspace
              let _connections = await Modules.Connections.getConnections(workspaceID),
                // Make sure the provided connection's name does not exist - duplication is not allowed -
                exists = _connections.find((_connection) => (manipulateText(_connection.name) == manipulateText(connectionName)) && (manipulateText(Sanitize(_connection.folder)) == manipulateText(Sanitize(connectionName)))),
                /**
                 * If the current state of the dialog is `edit` then make sure to exclude the connection's name from duplication
                 * `editedConnectionObject` is a global object that is updated with every attempt to edit/update a connection
                 */
                extraCondition = editingMode ? connectionName != editedConnectionObject.name : true

              try {
                if (Sanitize(minifyText(connectionName)).length > 0)
                  throw 0

                // Enable the buttons in the footer
                button.add('#testConnection').add('#switchEditor').removeAttr('disabled')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.t('the given name seems invalid, please provide a unique valid name')) + '.', 'failure')

                // Skip the upcoming code - terminate the saving/updating process -
                return
              } catch (e) {}

              try {
                // If there's no duplication then skip this try-catch block
                if ([undefined, null].includes(exists) || !extraCondition)
                  throw 0

                // Enable the buttons in the footer
                button.add('#testConnection').add('#switchEditor').removeAttr('disabled')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.replaceData('a connection is already exists with the given name [b]$data[/b] in workspace [b]$data[/b], please provide a unique valid name', [connectionName, getWorkspaceName(workspaceID)])) + '.', 'failure')

                // Skip the upcoming code - terminate the saving/updating process -
                return
              } catch (e) {}

              /**
               * Reaching here means there's no duplication in the name of the connection
               *
               * Set the final connection's object which will be used to save it and its info - secrets, SSH tunneling info, etc... -
               */
              finalConnection = {
                name: connectionName,
                info: {
                  id: editingMode ? editedConnectionObject.info.id : `connection-${getRandom.id(10)}`,
                  datacenter: '',
                  secureConnectionBundlePath: astraDBConnectionData.SCBPath
                }
              }

              // If the current mode is `edit` then add an `original` object of the connection - which is the connection before being edited -
              if (editingMode)
                finalConnection.original = editedConnectionObject

              // Determine the proper function to be called based on whether the current mode is `edit` or not
              let connectionsCallFunction = editingMode ? Modules.Connections.updateConnection : Modules.Connections.saveConnection

              /**
               * Encrypt all provided secrets - for Apache Cassandra and SSH -
               *
               * Create an array of names and values of the secrets
               */
              let secrets = [{
                name: 'username',
                value: username
              }, {
                name: 'password',
                value: password
              }]

              try {
                // Get the apps' public RSA key
                getRSAKey('public', (key) => {
                  try {
                    // If the received key is valid to be used then skip this try-catch block
                    if (key.length != 0)
                      throw 0

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                    // Call the post-process function with `false` - failed to save/update the connection
                    postProcess(false)

                    // Stop the process; as something is not correct with the generator tool
                    return
                  } catch (e) {}

                  // Values will be saved in the `secrets` object
                  finalConnection.info.secrets = [],
                    // Array to be a copy from the original secrets before manipulation
                    savedSecrets = []

                  // Set the `credentials` attribute
                  finalConnection.info.credentials = {}

                  // Loop through each secret's value
                  for (let secret of secrets) {
                    // Make sure there's a value to encrypt
                    if (secret.value.trim().length != 0 && !([undefined, null].includes(secret.value))) {
                      // Whether or not the current secret will be saved or the user will be asked to provide this secret next time
                      let toBeSaved = saveAuthCredentials

                      // This secret/credential will be saved
                      if (toBeSaved) {
                        savedSecrets[secret.name] = encryptText(key, secret.value)
                      } else {
                        // This credential should be provided by the user next time
                        finalConnection.info.credentials['auth'] = true
                      }
                    }
                  }

                  // If there are no saved secrets then delete the `secrets` attribute
                  if (Object.keys(savedSecrets).length <= 0) {
                    delete finalConnection.info.secrets
                  } else {
                    // Otherwise, save it
                    finalConnection.info.secrets = savedSecrets
                  }

                  // If ther are no required credentials then delete the `credentials` attribute
                  if (Object.keys(finalConnection.info.credentials).length <= 0)
                    delete finalConnection.info.credentials

                  // Call the proper function, then pass the status to the `postProcess` inner function
                  connectionsCallFunction(workspaceID, finalConnection).then((status) => postProcess(status, editingMode ? {
                    ...savedSecrets,
                    ...finalConnection.info.credentials
                  } : [true, ...secrets]))
                })
              } catch (e) {}

              return
            } catch (e) {}

            // For Apache Cassandra Connection type
            try {
              // If the provided connection's name is valid then skip this try-catch block
              if (connectionName.trim().length > 0)
                throw 0

              // Add an `invalid` class to the connection name's input field
              $('[info-section="none"][info-key="connectionName"]').addClass('is-invalid')

              // Point at the basic section navigation button in the dialog
              let basicSectionBtn = $(`div.modal#addEditConnectionDialog`).find('div.btn[section="basic"]')

              // If the basic section is not the currently active one then show invalid inputs notification
              if (!basicSectionBtn.hasClass('active'))
                basicSectionBtn.children('div.invalid-inputs').fadeIn('fast')

              // Show feedback to the user
              showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.t('to add a connection, a unique valid name is required to be provided')) + '.', 'failure')

              // Skip the upcoming code - terminate the connection's saving/updating process -
              return
            } catch (e) {}

            // Disable the buttons in the footer
            button.add('#testConnection').add('#switchEditor').attr('disabled', 'disabled')

            // Get all saved connections in the workspace
            let _connections = await Modules.Connections.getConnections(workspaceID),
              // Make sure the provided connection's name does not exist - duplication is not allowed -
              exists = _connections.find((_connection) => (manipulateText(_connection.name) == manipulateText(connectionName)) && (manipulateText(Sanitize(_connection.folder)) == manipulateText(Sanitize(connectionName)))),
              /**
               * If the current state of the dialog is `edit` then make sure to exclude the connection's name from duplication
               * `editedConnectionObject` is a global object that is updated with every attempt to edit/update a connection
               */
              extraCondition = editingMode ? connectionName != editedConnectionObject.name : true

            try {
              if (Sanitize(minifyText(connectionName)).length > 0)
                throw 0

              // Enable the buttons in the footer
              button.add('#testConnection').add('#switchEditor').removeAttr('disabled')

              // Show feedback to the user
              showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.t('the given name seems invalid, please provide a unique valid name')) + '.', 'failure')

              // Skip the upcoming code - terminate the saving/updating process -
              return
            } catch (e) {}

            try {
              // If there's no duplication then skip this try-catch block
              if ([undefined, null].includes(exists) || !extraCondition)
                throw 0

              // Enable the buttons in the footer
              button.add('#testConnection').add('#switchEditor').removeAttr('disabled')

              // Show feedback to the user
              showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.replaceData('a connection is already exists with the given name [b]$data[/b] in workspace [b]$data[/b], please provide a unique valid name', [connectionName, getWorkspaceName(workspaceID)])) + '.', 'failure')

              // Skip the upcoming code - terminate the saving/updating process -
              return
            } catch (e) {}

            /**
             * Reaching here means there's no duplication in the name of the connection
             *
             * Set the final connection's object which will be used to save it and its info - secrets, SSH tunneling info, etc... -
             */
            finalConnection = {
              name: connectionName,
              cqlshrc: addEditConnectionEditor.getValue(),
              info: {
                id: editingMode ? editedConnectionObject.info.id : `connection-${getRandom.id(10)}`,
                datacenter: dataCenter.trim()
              }
            }

            // Handle the AxonOps integration feature
            try {
              let axonOpsIntegration = {
                organization: minifyText(`${$(`[info-section="none"][info-key="axonops-organization"]`).val()}`),
                clusterName: minifyText(`${$(`[info-section="none"][info-key="axonops-clustername"]`).val()}`),
                url: getCheckedValue('axonOpsURL')
              }

              try {
                if (axonOpsIntegration.url == 'axonOpsSaaS') {
                  axonOpsIntegration.url = 'axonops-saas'
                  throw 0
                }

                let protocol = `${$('input#axonOpsDashboardIntegrationDefaultURLProtocol').val()}` || `https`,
                  url = `${$('input#axonOpsDashboardIntegrationDefaultURL').val()}`

                if ([protocol, url].some((value) => minifyText(value).length <= 0)) {
                  showToast(I18next.capitalizeFirstLetter(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.replaceData('when the AxonOps Self-Host option is selected, a valid URL with both protocol and host is required. Please provide these before $data the connection', [editingMode ? 'saving' : 'updating'])) + '.', 'failure')

                  return postProcess(false)
                }

                axonOpsIntegration.url = [protocol, url].some((part) => minifyText(part).length <= 0) ? '' : `${protocol}://${url}`
              } catch (e) {}

              if (Object.keys(axonOpsIntegration).some((data) => axonOpsIntegration[data].length <= 0))
                throw 0

              finalConnection.info.axonOpsIntegration = axonOpsIntegration
            } catch (e) {}

            // If the current mode is `edit` then add an `original` object of the connection - which is the connection before being edited -
            if (editingMode)
              finalConnection.original = editedConnectionObject

            try {
              /**
               * Check username and password for both; Apache Cassandra and SSH tunnel
               *
               * Define the secrets to be checked
               */
              let values = ['username', 'password', 'ssh-sshUsername', 'ssh-sshPassword', 'ssh-sshPrivatekey', 'ssh-sshPassphrase']

              // Loop through each secret
              values.forEach((value) => {
                /**
                 * Get the secret's value from the related input field
                 * Using `eval` here won't affect the performance at all
                 */
                eval(`${value.replace('ssh-', '')} = "${$(`[info-section="none"][info-key="${(value.replace('-ssh', '-')).toLowerCase()}"]`).val()}"`)
              })

              // If Apache Cassandra's username and password have been provided then the encryption process must be executed
              if ([username, password].every((secret) => secret.trim().length != 0))
                waitForEncryption = true

              // If SSH's username and password have been provided then the encryption process must be executed, and add the tunnel creation info to the connection's object
              if (sshUsername.trim().length != 0 && [sshPassword, sshPrivatekey].some((secret) => secret.trim().length != 0)) {
                waitForEncryption = true
                sshTunnel = true
              }
            } catch (e) {
              try {
                errorLog(e, 'connections')
              } catch (e) {}
            }

            try {
              // If there's no SSH tunnel creation info to be handled then skip this try-catch block
              if (!sshTunnel)
                throw 0

              // Add `ssh` object to the final connection's object
              finalConnection.ssh = {}

              // Add the `privatekey` attribute if it has been provided
              if (sshPrivatekey.trim().length != 0)
                finalConnection.ssh.privatekey = sshPrivatekey

              // Add the `passphrase` attribute if it has been provided
              if (sshPassphrase.trim().length != 0)
                finalConnection.ssh.passphrase = sshPassphrase

              // Add other info; host, port, destination address, and destination port
              finalConnection.ssh.host = $('[info-section="none"][info-key="ssh-host"]').val()
              finalConnection.ssh.port = $('[info-section="none"][info-key="ssh-port"]').val() || 22
              finalConnection.ssh.dstAddr = $('[info-section="connection"][info-key="hostname"]').val()
              finalConnection.ssh.dstPort = $('[info-section="connection"][info-key="port"]').val()

              if (minifyText(finalConnection.ssh.host).length <= 0) {
                showToast(I18next.capitalizeFirstLetter(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.t('a valid SSH host is required in order to establish SSH tunnel, please make sure to provide it and try again')) + '.', 'failure')

                $('[info-section="none"][info-key="ssh-host"]').addClass('is-invalid')

                // Point at the basic section navigation button in the dialog
                let sshTunnelSectionBtn = dialogElement.find('div.btn[section="ssh-tunnel"]')

                // If the basic section is not the currently active one then show invalid inputs notification
                if (!sshTunnelSectionBtn.hasClass('active'))
                  sshTunnelSectionBtn.children('div.invalid-inputs').fadeIn('fast')

                return
              }
            } catch (e) {
              try {
                errorLog(e, 'connections')
              } catch (e) {}
            }

            // Determine the proper function to be called based on whether the current mode is `edit` or not
            let connectionsCallFunction = editingMode ? Modules.Connections.updateConnection : Modules.Connections.saveConnection

            /**
             * Encrypt all provided secrets - for Apache Cassandra and SSH -
             *
             * Create an array of names and values of the secrets
             */
            let secrets = [{
                name: 'username',
                value: username
              }, {
                name: 'password',
                value: password
              }, {
                name: 'sshUsername',
                value: sshUsername
              }, {
                name: 'sshPassword',
                value: sshPassword
              },
              {
                name: 'sshPassphrase',
                value: sshPassphrase
              }
            ]

            try {
              // If there's no need to wait for the encryption process then skip this try-catch block
              if (!waitForEncryption)
                throw 0

              // Get the apps' public RSA key
              getRSAKey('public', (key) => {
                try {
                  // If the received key is valid to be used then skip this try-catch block
                  if (key.length != 0)
                    throw 0

                  // Show feedback to the user
                  showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                  // Call the post-process function with `false` - failed to save/update the connection
                  postProcess(false)

                  // Stop the process; as something is not correct with the generator tool
                  return
                } catch (e) {}

                // Values will be saved in the `secrets` object
                finalConnection.info.secrets = [],
                  // Array to be a copy from the original secrets before manipulation
                  savedSecrets = []

                // Set the `credentials` attribute
                finalConnection.info.credentials = {}

                // Loop through each secret's value
                for (let secret of secrets) {
                  // Make sure there's a value to encrypt
                  if (secret.value.trim().length != 0 && !([undefined, null].includes(secret.value))) {
                    // Whether or not the current secret will be saved or the user will be asked to provide this secret next time
                    let toBeSaved = secret.name.indexOf('ssh') != -1 ? saveSSHCredentials : saveAuthCredentials

                    // This secret/credential will be saved
                    if (toBeSaved) {
                      savedSecrets[secret.name] = encryptText(key, secret.value)
                    } else {
                      // This credential should be provided by the user next time
                      finalConnection.info.credentials[secret.name.indexOf('ssh') != -1 ? 'ssh' : 'auth'] = true
                    }
                  }
                }

                // If there are no saved secrets then delete the `secrets` attribute
                if (Object.keys(savedSecrets).length <= 0) {
                  delete finalConnection.info.secrets
                } else {
                  // Otherwise, save it
                  finalConnection.info.secrets = savedSecrets
                }

                // If ther are no required credentials then delete the `credentials` attribute
                if (Object.keys(finalConnection.info.credentials).length <= 0)
                  delete finalConnection.info.credentials

                // Call the proper function, then pass the status to the `postProcess` inner function
                connectionsCallFunction(workspaceID, finalConnection).then((status) => postProcess(status, editingMode ? {
                  ...savedSecrets,
                  ...finalConnection.info.credentials
                } : [true, ...secrets]))
              })

              // Skip the upcoming code
              return
            } catch (e) {}

            /**
             * Reaching here means there's no need to wait for the encryption process
             *
             * Call the proper function, then pass the status to the `postProcess` inner function
             */
            connectionsCallFunction(workspaceID, finalConnection).then((status) => postProcess(status))
          })
        }
      }

      // Click one of the select file inputs
      {
        // This selection covers all select file inputs and their click area
        $('div.form-outline div.clickable').click(function() {
          // Get the input key's name
          let key = getAttributes($(this), 'for-info-key') || getAttributes($(this), 'for-input'),
            // Whether or not empty value is allowed
            allowEmptyValue = getAttributes($(this), 'data-empty-not-allowed') == undefined,
            id = getRandom.id(5), // Get random ID for the selection file dialog
            title = '' // Define the file selection dialog's title

          // Switch between key values
          switch (key) {
            case 'workspacePath': {
              title = 'select workspace folder path'
              break
            }
          }

          // Set other attributes to be used to create the dialog
          let data = {
            id,
            title: I18next.capitalizeFirstLetter(I18next.t(title)),
            properties: ['showHiddenFiles', 'createDirectory', 'promptToCreate', getAttributes($(this), 'for-input') == undefined ? 'openFile' : 'openDirectory']
          }

          // Send a request to the main thread to create a dialog
          IPCRenderer.send('dialog:create', data)

          // Listen for the response
          IPCRenderer.on(`dialog:${id}`, (_, selected) => {
            // The received value is either a path or convert it to an empty string
            selected = selected || ``

            if (!allowEmptyValue && selected.length <= 0)
              return

            // Get the MDB object for the current input field
            let inputObject = getElementMDBObject($(this).parent().children('input'))

            try {
              // Update the input's value
              $(this).parent().children('input').val(selected)

              // Trigger a custom event
              $(this).parent().children('input').trigger('inputChanged')

              // Update its state
              inputObject.update()
            } catch (e) {}
          })
        })

        /**
         * This input is related to select files regards SSH, SSL, and Cassandra authentication
         * Listeners are `click` and `keypress` - ENTER -
         */
        $('div.form-outline[role="file-selector"] input').on('click keypress', function(e) {
          // If the event is key pressing and the key is not ENTER then end this process
          if (e.type == 'keypress' && e.keyCode != 13)
            return

          // Prevent the default behavior of the event
          e.preventDefault()

          // Get the input key's name
          let key = getAttributes($(this), 'info-key'),
            id = getRandom.id(5), // Get random ID for the selection file dialog
            title = '' // Define the file selection dialog's title

          // Switch between key values
          switch (key) {
            case 'credentials': {
              title = 'select cassandra credentials file'
              break
            }
            case 'ssh-privatekey': {
              title = 'select SSH private key file'
              break
            }
            case 'certfile': {
              title = 'select SSL CA certificate file'
              break
            }
            case 'userkey': {
              title = 'select SSL user key file'
              break
            }
            case 'usercert': {
              title = 'select SSL user certificate key file'
              break
            }
          }

          if ($(this).attr('id') == 'astraDBSCBPath')
            title = 'select the secure connection bundle zip file'

          // Set other attributes to be used to create the dialog
          let data = {
            id,
            title: I18next.capitalize(I18next.t(title)),
            properties: ['showHiddenFiles', 'createDirectory', 'promptToCreate', 'openFile']
          }

          // Send a request to the main thread to create a dialog
          IPCRenderer.send('dialog:create', data)

          // Listen for the response
          IPCRenderer.on(`dialog:${id}`, (_, selected) => {
            // The received value is either a path or convert it to an empty string
            selected = selected || ``

            /**
             * Update the tooltip's content and state
             * Get the object
             */
            let tooltipObject = getElementMDBObject($(this), 'Tooltip')

            // If the path to the file is invalid or inaccessible then don't adopt it
            if (!pathIsAccessible(selected[0])) {
              // Clear the input's value
              $(this).val('').trigger('input')

              // CLear the file's name preview
              $(this).parent().attr('file-name', '-')

              try {
                // Disable the tooltip
                tooltipObject.disable()
              } catch (e) {}

              // Skip the upcoming code
              return
            }

            try {
              // Enable the tooltip and update its content
              tooltipObject.enable()
              tooltipObject.setContent(selected[0])
            } catch (e) {}

            // Set the selected file's path
            $(this).val(selected[0]).trigger('input')
            $(this).parent().attr('file-name', Path.basename(selected[0]))
          })
        })
      }
    }
  }

  // Load schema snapshot dialog
  {
    // Define a portion of the common CSS selector
    let dialog = `div.modal#loadSnapshot div.modal-body`

    // Once the user inputs something in the snapshot's search input field
    {
      $(`${dialog}`).find('input[type="text"]').on('input', function() {
        // Get the search text
        let text = minifyText($(this).val())

        // Loop through each saved snapshot
        $('div.modal#loadSnapshot div.snapshots div.snapshot').each(function() {
          // Minify the snapshot's content
          let content = minifyText($(this).text())

          // Show/hide the snapshot based on whether its content has the search text or the search text's length is less than 2
          $(this).toggle(content.search(text) || text.length < 2)
        })
      })
    }

    // Actions for multiple snapshots
    {
      // Clicks the selection button
      $(`${dialog}`).find('div.actions-multiple a[action="select"]').click(function() {
        // If the action to be performed is checking the snapshot's checkbox
        let check = $(this).attr('check') == 'true'

        // Loop through each snapshot's checkbox
        $(`${dialog}`).find('input[type="checkbox"]').each(function() {
          // Set its state based on the action to be performed
          $(this).prop('checked', check)
        })

        // Toggle the `check` attribute's status
        $(this).attr('check', `${!check}`)

        // Toggle the actions' container based on the `check` status
        $(this).parent().toggleClass('show', check)
      })

      // Clicks the deletion button
      $(`${dialog}`).find('div.actions-multiple a[action="delete"]').click(function() {
        // Open the confirmation dialog and wait for the response
        openDialog(I18next.capitalizeFirstLetter(I18next.t('do you want to delete the selected snapshots? once you confirm, there is no undo')), (response) => {
          // If canceled, or not confirmed then skip the upcoming code
          if (!response.confirmed)
            return

          // Loop through each snapshot
          $(`${dialog} div.snapshots div.snapshot`).each(function() {
            // Check if the checkbox of it is checked
            let checked = $(this).find('input[type="checkbox"]').prop('checked')

            // If so, then delete that snapshot
            if (checked)
              $(this).find('a[action="delete"]').trigger('click', {
                noConfirm: true,
                checked: response.checked
              })
          })
        }, true, 'keep the associated files in the system')
      })
    }
  }

  // Observe addition/removal of connections' switchers
  {
    // Point at the connections' switchers' container
    let switchersContainer = $(`div.body div.left div.content div.switch-connections`),
      // Create observer object
      observer = new MutationObserver(function(mutations) {
        // Loop through each detected mutation
        mutations.forEach(function(mutation) {
          // If the mutation is an appended/removed child
          if (mutation.type === 'childList')
            setTimeout(() => {
              // Update the switchers' container's view
              updateSwitcherView('connections')

              // Handle the first switcher's margin
              handleConnectionSwitcherMargin()
            }, 100)
        })
      })

    // Start the observation process
    observer.observe(switchersContainer[0], {
      childList: true
    })
  }
}

// Handle different events for input fields with `file` type
{
  $(`input[info-section][info-key][type="file"]`).parent().add(`input[info-section][info-key][type="file"]`).on('change click', function() {
    // Point at the input field
    let input = $(this)

    // If the element is the parent of the input field then point at the input field instead
    if ($(this).is($(`input[info-section][info-key][type="file"]`).parent()))
      input = input.children('input')

    /**
     * Initial state is used to print the saved value of the input field
     * It should be removed once an event is triggered
     *
     * Remove the initial indicator's attribute
     */
    input.removeAttr('data-initial')

    // Remove the initial class
    input.removeClass('initial')
  })
}

// Clicks the `ADD CLUSTER` button which shows up if there are no added connections
{
  $(`button#addConnectionProcess`).on('click', function(e, editingMode = false) {
    // Define the dialog path's CSS selector
    let dialog = 'div.modal#addEditConnectionDialog'

    try {
      // if (getAttributes($(`${dialog}`), 'data-edit-connection-id') == undefined || editingMode)
      //   throw 0

      // Reset everything and make sure the `creation mode` is properly back
      $(`${dialog}`).find('h5.modal-title').text(I18next.capitalize(I18next.t('add connection')))
      $(`${dialog}`).removeAttr('data-edit-workspace-id data-edit-connection-id')

      $(`${dialog} button#addConnection`).attr('disabled', 'disabled')
      $(`${dialog} button#addConnection`).text(I18next.capitalize(I18next.t('add connection')))

      $('div.modal#addEditConnectionDialog div.modal-body div.side-left div.sections div.section div.btn[section="basic"]').click()

      // Loop through all inputs in the dialog
      $(`${dialog}`).find('[info-section][info-key]').each(function() {
        // Get the input's Material Design object
        let object_ = getElementMDBObject($(this))

        // Handle when the input is actually a file selector
        try {
          // If the input is not a file selector then skip this try-catch block
          if ($(this).parent().attr('file-name') == undefined)
            throw 0

          /**
           * Update the tooltip's content and state
           * Get the object
           */
          let tooltipObject = mdbObjects.filter((object) => object.type == 'Tooltip' && object.element.is($(this)))

          // Clear the file's name preview
          $(this).parent().attr('file-name', '-')

          // Disable the tooltip
          try {
            tooltipObject[0].object.disable()
          } catch (e) {}
        } catch (e) {}

        $('#axonOpsSaaS').prop('checked', true)
        $('#axonOpsSaaS').trigger('change')

        /**
         * If it is `undefined` then it hasn't been found in the `cqlsh.rc` file
         * Set the input value to ''
         */
        try {
          $(this).val('')
        } catch (e) {}

        // If the previous set didn't work then try to call the `selected` attribute
        try {
          if ($(this).attr('type') == 'checkbox')
            $(this).prop('checked', getAttributes($(this), 'default-value') == 'true' ? true : false)
        } catch (e) {}

        // Update the object
        object_.update()
        setTimeout(() => object_._deactivate())
      })

      // Reset editor's content
      addEditConnectionEditor.setValue(Modules.Consts.CQLSHRC)
    } catch (e) {}
  })
}

// Click event for `add` and `refresh` actions in the connections' container
{
  // Define a portion of the common CSS selector
  let selector = `div.body div.right div.content div[content="connections"] div.section-actions div.action`,
    // Inner function to click the parent button - which shows/hides actions buttons
    clickParentButton = (button) => {
      $(button).parent().parent().find('button.btn.btn-lg').click()
    }

  // Clicks the add button
  $(`${selector}[action="add"] button`).click(function() {
    // Point at the button to be clicked - which is the `ADD CLUSTER` button -
    let buttonToBeClicked = $(`button#addConnectionProcess`)

    // If the current workspace is the sandbox then point at the `ADD PROJECT` button
    if (getActiveWorkspaceID() == 'workspace-sandbox')
      buttonToBeClicked = $(`button#createSandboxProjectProcess`)

    // Click the pointed at button
    buttonToBeClicked.click()

    // Call the inner function
    clickParentButton(this)

    // Hide the tooltip
    tooltips.addConnectionActionButton.hide()

    if (!$('div.modal#addEditConnectionDialo').hasClass('test-connection'))
      $('div.modal#addEditConnectionDialog div.modal-body.select-type').find('div.connection-type[data-type="apache-cassandra"]').click()

    // For Astra  DB
    try {
      $('input#astraDBConnectionName').add('input#astraDBClientID').add('input#astraDBClientSecret').add('input#astraDBSCBPath').val('')

      let scbFilePathInputTooltip = getElementMDBObject($('input#astraDBSCBPath'), 'Tooltip')

      scbFilePathInputTooltip.setContent('-')
      scbFilePathInputTooltip.disable()
    } catch (e) {}
  })

  // Clicks the refresh button
  $(`${selector}[action="refresh"] button`).click(function() {
    // Refresh connections' list
    $(document).trigger('refreshConnections', {
      workspaceID: getActiveWorkspaceID()
    })

    // Call the inner function
    clickParentButton(this)

    // Hide the tooltip
    tooltips.refreshConnectionActionButton.hide()
  })
}

// Handle the connections' witcher's navigation arrows - up and down -
{
  $(`div.body div.left div.content div.switch-connections div.show-more-connections div.buttons button`).click(function() {
    // Get the clicked button's navigation
    let navigation = $(this).attr('navigation'),
      // Point at the switchers' container
      switchersContainer = $(`div.body div.left div.content div.switch-connections`),
      // Get all currently visible switchers
      visibleSwitchers = switchersContainer.children('div.connection[_connection-id]').filter(':visible')

    // Remove the `hidden` attribute from all switchers; as they'll be shown or hidden as needed
    switchersContainer.children('div.connection[_connection-id]').removeAttr('hidden')

    // Handle the down arrow
    try {
      // If the navigation direction is not `down` then skip this try-catch block
      if (navigation != 'down')
        throw 0

      // Point at the switcher to be shown
      let switcherToBeShown = visibleSwitchers.last().nextAll().filter(':hidden').first()

      // If we already have reached the latest switcher then no need to run the following code
      if (switcherToBeShown.length <= 0)
        return

      // Hide the first `visible` switcher - will be at the very top -
      visibleSwitchers.first().hide()

      // Show the selected switcher to be shown
      switcherToBeShown.show()

      // Call the margin handler function
      handleConnectionSwitcherMargin()

      // Skip the upcoming code
      return
    } catch (e) {}

    /**
     * Reaching here means it's the up arrow
     * Point at the switcher to be shown
     */
    let switcherToBeShown = visibleSwitchers.first().prevAll().filter(':hidden').first()

    // If we already have reached the first switcher then no need to run the following code
    if (switcherToBeShown.length <= 0)
      return

    // Hide the last `visible` switcher - will be at the very bottom -
    visibleSwitchers.last().hide()

    // Show the selected switcher to be shown
    switcherToBeShown.show()

    // Call the margin handler function
    handleConnectionSwitcherMargin()
  })
}

{
  $('input[type="radio"][name="axonOpsURL"]').on('change', function() {
    let modalSection = $('div.modal-section[section="axonops-integration"]'),
      isSelectedValueSelfHost = getCheckedValue('axonOpsURL') == 'axonOpsSelfHost'

    modalSection.find('div.axonops-self-host').toggle(isSelectedValueSelfHost)
    modalSection.find('div.general-hint.axonops-integration.axonops-saas').toggle(!isSelectedValueSelfHost)
  })
}

{
  setTimeout(() => {
    try {
      let generateInsertStatementsEditorObject = monaco.editor.getEditors().find((editor) => $('div.modal#generateInsertStatements .editor').is(editor._domElement)),
        generateInsertStatementsModal = getElementMDBObject($('#generateInsertStatements'), 'Modal')

      $('button#copyGeneratedInsertStatements').click(function() {
        let generatedStatements = generateInsertStatementsEditorObject.getValue(),
          statementsSize = Bytes(ValueSize(generatedStatements))

        // Copy the result to the clipboard
        try {
          Clipboard.writeText(generatedStatements)
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        // Give feedback to the user
        showToast(I18next.capitalize(I18next.t('copy generated insert statements')), I18next.capitalizeFirstLetter(I18next.replaceData('generated insert statements have been copied to the clipboard, the size is $data', [statementsSize])) + '.', 'success')

        generateInsertStatementsModal.hide()
      })

      $('button#executeGeneratedInsertStatements').click(function() {
        let consoleEditoObject = monaco.editor.getEditors().find((editor) => $(`div.workarea[connection-id="${activeConnectionID}"]`).find('div.console-editor').is(editor._domElement))

        consoleEditoObject.setValue(generateInsertStatementsEditorObject.getValue())

        $(`div.workarea[connection-id="${activeConnectionID}"]`).find('div.execute').find('button').click()

        generateInsertStatementsModal.hide()
      })
    } catch (e) {}
  }, 10000)
}

{
  let searchModalObject = getElementMDBObject($("#searchConnections"), 'Modal'),
    searchInputField = $('input#searchConnectionsInputField'),
    workspacesAndConnections = [],
    enableSearchFeature = (data, finished = false) => {
      workspacesAndConnections.push(data)

      if (!finished)
        return

      workspacesAndConnections = workspacesAndConnections.filter((data) => data.connections.length > 0)

      searchInputField.attr('disabled', null)

      setTimeout(() => searchInputField.focus())

      $("#searchConnections").find('div.search-input').removeClass('loading')
    }

  $('button#searchConnectionsButton').click(function() {
    let isModelOpened = $('div.modal-backdrop.show').length != 0

    if (isModelOpened)
      return

    try {
      searchModalObject.show()
    } catch (e) {}

    searchInputField.val('')

    searchInputField.attr('disabled', '')

    workspacesAndConnections = []

    $("#searchConnections").find('div.search-input').addClass('loading')

    try {
      getElementMDBObject($('input#searchConnectionsInputField')).update()
    } catch (e) {}

    $('div#searchConnections div.search-result').hide()

    $('div#searchConnections div.search-result').html('')

    Modules.Workspaces.getWorkspaces().then((workspaces) => {
      let numOfHandledWorkspaces = 0

      workspaces.forEach(async (workspace) => {
        let connections = await Modules.Connections.getConnections(workspace.id)

        for (let connection of connections)
          connection.cqlshrc = await Modules.Connections.getCQLSHRCContent(workspace.id, connection.cqlshrc)

        numOfHandledWorkspaces += 1

        enableSearchFeature({
          workspace,
          connections
        }, numOfHandledWorkspaces >= workspaces.length)
      })
    })
  })

  searchInputField.on('input', function() {
    let searchValue = minifyText($(this).val())

    if (searchValue.length <= 0) {
      $('div#searchConnections div.search-result').hide()

      $('div#searchConnections div.search-result').html('')

      return
    }

    let matchedData = workspacesAndConnections.map((data) => {
      let matchedConnections = data.connections.filter((connection) => {
        let isMatched = false

        try {
          // 1: Match with the name and folder host
          if (minifyText(`${connection.info.name}${connection.folder}`).includes(searchValue))
            isMatched = true
        } catch (e) {}

        try {
          // 2: Match with the host and datacenter
          if (!isMatched && minifyText(`${connection.host}${connection.info.datacenter}`).includes(searchValue))
            isMatched = true
        } catch (e) {}

        return isMatched
      })

      return {
        workspace: data.workspace,
        connections: matchedConnections
      }
    })

    matchedData = matchedData.filter((data) => data.connections.length > 0)

    $('div#searchConnections div.search-result').html('')

    $('div#searchConnections div.search-result').toggle(matchedData.length > 0)

    for (let data of matchedData) {
      let workspace = data.workspace,
        color = HEXToRGB(workspace.color).join(' ')

      for (let connection of data.connections) {
        let connectionElement = `
            <div class="result-connection" data-workspace-id="${workspace.id}" data-connection-id="${connection.info.id}" style="box-shadow: inset 0px 0px 0px 1px rgb(${color} / 50%);">
              <div class="header">
                <div class="name">${connection.name}</div>
                <div class="workspace" style="background: rgb(${color} / 70%); ${TinyColor(workspace.color).isLight() ? 'color: #252525;' : ''}"><span class="name">${workspace.name}</span></div>
              </div>
              <div class="connection-info">
                <div class="info" info="host">
                  <div class="title"><span mulang="host" capitalize></span>
                    <ion-icon name="right-arrow-filled" role="img" class="md hydrated" aria-label="right arrow filled"></ion-icon>
                  </div>
                  <div class="text">${connection.info.secureConnectionBundlePath != undefined ? 'AstraDB DataStax' : connection.host}</div>
                </div>
              </div>
              <button type="button" class="btn btn-tertiary navigate" data-mdb-ripple-color="light">
                <ion-icon name="arrow-down"></ion-icon>
              </button>
            </div>`

        $('div#searchConnections div.search-result').append($(connectionElement).show(function() {
          let connectionElement = $(this)

          $(this).find('button.navigate').click(function() {
            let [workspaceID, connectionID] = getAttributes(connectionElement, ['data-workspace-id', 'data-connection-id'])

            try {
              searchModalObject.hide()
            } catch (e) {}

            try {
              let connectionSwitcher = $(`div.body div.left div.content div.switch-connections div.connection[_connection-id="${connectionID}"]`)

              if (connectionSwitcher.length > 0)
                return connectionSwitcher.find('button.btn').click()
            } catch (e) {}

            $(`div.body div.right div.content div[content="workspaces"] div.workspaces-container`).find(`div.workspace[data-id="${workspaceID}"]`).find('button.enter').trigger('click', {
              callback: () => {
                setTimeout(() => {
                  let connectionCardElement = $(`div.body div.right div.content div[content="connections"] div.connections-container div.connections[workspace-id="${workspaceID}"]`).find(`div.connection[data-id="${connectionID}"]`)

                  connectionCardElement.addClass('highlight')

                  setTimeout(() => {
                    try {
                      connectionCardElement.removeClass('highlight')
                    } catch (e) {}
                  }, 5000)
                }, 300)
              }
            })
          })

          // Apply the chosen language on the UI element after being fully loaded
          setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
        }))
      }
    }
  })

  // searchModalObject._element.addEventListener('shown.mdb.modal', () => setTimeout(() => searchInputField.focus()))
}
