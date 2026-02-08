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
                    port: sshCreation.port,
                    isSSH: true
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
                      let tooltipLookup = null
                      try { let tm = mdbObjectsIndex.get(this); if (tm) tooltipLookup = tm['Tooltip'] } catch (_e) {}
                      let tooltipObject = tooltipLookup ? [{ object: tooltipLookup }] : []

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
