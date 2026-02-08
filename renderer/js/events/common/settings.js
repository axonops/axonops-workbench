
// Handle the app's settings' and about dialogs events and processes
{
  (['appSettings', 'appAbout', 'importWorkspaces']).forEach((modalID) => {
    // Define the common element CSS selector
    let dialog = `div.modal#${modalID} div.modal-body div.side`

    // Clicks one of the left side buttons
    $(`${dialog}-left div.sections div.section div.btn`).click(function() {
      // Handle if the button should redirect the user to an external link
      try {
        // Attempt to get the link
        let link = $(this).attr('link')

        // If the link is not found then skip this try-catch block
        if (link == undefined)
          throw 0

        // Open the link
        try {
          Open(link)
        } catch (e) {}

        // Skip the upcoming code
        return
      } catch (e) {}

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
    })
  })

  // Clicks the `SAVE SETTINGS` button in the footer of the dialog
  $(`button#saveSettings`).click(function() {
    // Add log about this action
    try {
      addLog(`Request to save the updated app's settings`, 'action')
    } catch (e) {}

    // Update variables and get the result
    $('button#updateVariables').trigger('click', (result) => {
      // Check content protection
      let contentProtection = $('input#contentProtection[type="checkbox"]').prop('checked'),
        // Check logging system enable/disable status
        loggingEnabled = $('input#loggingSystem[type="checkbox"]').prop('checked'),
        // AxonOps Integration feature
        axonOpsIntegration = $('input#enableAxonOpsDashboardIntegration[type="checkbox"]').prop('checked'),
        // Check the sandbox projects enable/disable status
        sandboxProjectsEnabled = $('input#sandboxProjects[type="checkbox"]').prop('checked'),
        basicCQLSHEnabled = $('input#basicCQLSH[type="checkbox"]').prop('checked'),
        cqlSnippetsAuthorName = $('input#cqlSnippetsAuthorName').val(),
        assistantAIEnabled = $('input#enableAIAssistant[type="checkbox"]').prop('checked'),
        // Get the maximum allowed running instances
        maxNumCQLSHSessions = $('input#maxNumCQLSHSessions').val(),
        maxNumSandboxProjects = $('input#maxNumSandboxProjects').val(),
        checkForUpdatesOnLanuch = $('input#checkForUpdatesOnLanuch[type="checkbox"]').prop('checked'),
        autoUpdateWithNotification = $('input#autoUpdateWithNotification[type="checkbox"]').prop('checked'),
        // Get chosen display language and if it's from right to left
        [chosenDisplayLanguage, languageRTL] = getAttributes($('input#languageUI'), ['hidden-value', 'rtl']),
        containersManagementTool = 'none',
        toolExtraPaths = $('input#toolExtraPaths').val(),
        savedShortcutsContainer = $(`div.modal-section[section="shortcuts"]`).find(`div.saved-shortcuts`)

      // Set RTL class if the language needs that
      if (languageRTL != undefined)
        $('body').toggleClass('rtl', languageRTL == 'true')

      // Apply the chosen display language
      Modules.Localization.applyLanguage(chosenDisplayLanguage)

      // Apply the new content protection state
      IPCRenderer.send('content-protection', contentProtection)

      // Set the new state of the content protection feature
      $('input#contentProtection[type="checkbox"]').attr({
        'data-initial-status': `${contentProtection}`,
        'data-authenticated': 'false'
      })

      $('input#enableAIAssistant[type="checkbox"]').attr({
        'data-initial-status': `${assistantAIEnabled}`,
        'data-authenticated': 'false'
      })

      try {
        let selectedManagementTool = $('div.management-tools.settings-dialog div.tool.selected').attr('tool')

        if (selectedManagementTool == undefined)
          throw 0

        containersManagementTool = selectedManagementTool
      } catch (e) {}

      try {
        // Get the current app's config/settings
        Modules.Config.getConfig((config) => {
          // Update settings
          Keytar.setPassword('AxonOpsWorkbenchContentProtection', 'value', `${contentProtection}`)
          config.set('security', 'loggingEnabled', loggingEnabled)
          config.set('features', 'localClusters', sandboxProjectsEnabled)
          config.set('features', 'basicCQLSH', basicCQLSHEnabled)
          config.set('features', 'cqlSnippetsAuthorName', minifyText(cqlSnippetsAuthorName).length <= 0 ? '' : cqlSnippetsAuthorName)
          config.set('features', 'containersManagementTool', containersManagementTool)
          config.set('features', 'axonOpsIntegration', axonOpsIntegration)
          Keytar.setPassword('AxonOpsWorkbenchAIAssistant', 'value', `${assistantAIEnabled}`)
          config.set('limit', 'cqlsh', maxNumCQLSHSessions)
          config.set('limit', 'sandbox', maxNumSandboxProjects)
          config.set('ui', 'language', chosenDisplayLanguage)
          config.set('updates', 'checkForUpdates', checkForUpdatesOnLanuch)
          config.set('updates', 'autoUpdate', autoUpdateWithNotification)

          if (containersManagementTool != 'none')
            config.set('containersManagementToolsPaths', containersManagementTool, toolExtraPaths)

          // Set the updated settings
          Modules.Config.setConfig(config)

          updateContainersManagementToolUI(containersManagementTool)

          // Set shortcuts
          try {
            let shortcuts = savedShortcutsContainer.find(`div.shortcut[data-is-uneditable="false"]`).get()

            shortcuts = shortcuts.map((shortcut) => {
              return {
                id: $(shortcut).attr('data-shortcut-id'),
                value: $(shortcut).attr('data-shortcut-value'),
                default: $(shortcut).attr('data-shortcut-default-value')
              }
            })

            for (let shortcut of shortcuts) {
              try {
                Modules.Shortcuts.setShortcut(shortcut.id, shortcut.value, shortcut.default == shortcut.value)
              } catch (e) {}
            }

            Modules.Shortcuts.updateKbdElements()

            Modules.Shortcuts.updateShortcutsInSession()

            if ($('div.body div.right div.content div[content="workarea"] div.workarea[connection-id]').length > 0)
              showToast(I18next.capitalize(I18next.t('update shortcuts')), I18next.capitalizeFirstLetter(I18next.t('some shortcut updates will take effect only for new active connections; existing active ones will continue using the old shortcuts')) + '.', 'warning')
          } catch (e) {}

          // Show feedback to the user
          setTimeout(() => {
            // Success feedback
            if (result.status)
              return showToast(I18next.capitalize(I18next.t('app settings')), `${I18next.capitalizeFirstLetter(I18next.t('settings have been successfully saved'))}.`, 'success')

            // Failure feedback
            showToast(I18next.capitalize(I18next.t('app settings')), I18next.capitalizeFirstLetter(I18next.replaceData('some settings have been successfully saved, however, an error has occurred with variables, $data', [result.failureMessage])) + '.', 'warning')
          }, 100)
        })
      } catch (e) {
        try {
          errorLog(e, 'common')
        } catch (e) {}
      }
    })
  })

  // Attempt to change the `content protection` checkbox status
  $('input#contentProtection[type="checkbox"]').add($('input#enableAIAssistant[type="checkbox"]')).change(function(event) {
    // Get both; the initial status and whether or not the user has passed the authentication process
    isAuthenticated = getAttributes($(this), ['data-authenticated'])

    // Based on the given result the process may be skipped and no need for an authentication process
    if (isAuthenticated != 'false')
      return

    // Get the new/updated status
    let newStatus = $(this).prop('checked')

    // Make sure it won't be applied till the authentication process is completed with success
    $(this).prop('checked', !newStatus)

    // Show sudo prompt
    promptSudo((authenticated) => {
      // If the authentication failed then stop the process and don't apply the new status
      if (!authenticated)
        return

      // Apply the new status
      $(this).prop('checked', newStatus)

      // The authentication process result will be saved till the new settings applied
      $(this).attr('data-authenticated', 'true')
    })
  })

  // Show/hide the languages' list once the associated input is focused on/out
  setTimeout(() => {
    // Define the app's settings model selector path
    let dialog = 'div.modal#appSettings, div.modal#rightClickActionsMetadata, div.modal#addEditConnectionDialog'

    // Loop through the dropdown element of each select element
    $(`${dialog}`).find('div.dropdown[for-select]').each(function() {
      // Get the MDB object of the current dropdown element
      let selectDropdown = getElementMDBObject($(this), 'Dropdown'),
        // Point at the associated input field
        input = $(`${dialog}`).find(`input#${$(this).attr('for-select')}`),
        isMultiple = $(this).attr('multiple') != undefined

      // Once the associated select element is being focused then show the dropdown element and vice versa
      input.on('focus', () => {
        let isInputDisabled = input.hasClass('disabled') || input.attr('disabled') != undefined

        if (isInputDisabled)
          return selectDropdown.hide()

        try {
          input.parent().find('div.invalid-feedback').addClass('transparent-color')
        } catch (e) {}

        selectDropdown.show()

        if (!isMultiple)
          return

        setTimeout(() => {
          $(this).find('ul.dropdown-menu.multiple').oneClickOutside({
            callback: function() {
              setTimeout(() => {
                let isInputDisabled = input.hasClass('disabled') || input.attr('disabled') != undefined

                if (isInputDisabled)
                  return selectDropdown.hide()

                try {
                  input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                } catch (e) {}

                selectDropdown.hide()
              }, 100)
            },
            exceptions: input
          })
        }, 100)
      }).on('focusout', () => {
        if (isMultiple)
          return

        setTimeout(() => {
          let isInputDisabled = input.hasClass('disabled') || input.attr('disabled') != undefined

          if (isInputDisabled)
            return selectDropdown.hide()

          try {
            input.parent().find('div.invalid-feedback').removeClass('transparent-color')
          } catch (e) {}

          selectDropdown.hide()
        }, 100)
      })

      // Once the parent `form-outline` is clicked trigger the `focus` event
      input.parent().click(() => input.trigger('focus'))
    })
  })
}

// Clicks any of the section's buttons in the left side of the dialog
{
  // Define the common element CSS selector
  let dialog = `div.modal#connectionCredentials div.modal-body div.side`

  // Clicks one of the top side buttons
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
  })

  // Clicks the `IGNORE CREDENTIALS` button
  $(`${dialog}-right`).parent().parent().find('button#ignoreCredentials').click(function() {
    // Get the associated connection's ID
    let connectionID = $(`div.modal#connectionCredentials`).attr('data-connection-id'),
      // Get the UI element of the connection
      connectionElement = $(`div.connections[workspace-id="${getActiveWorkspaceID()}"] div.connection[data-id="${connectionID}"]`)

    // Get all saved connections in the currently active workspace
    Modules.Connections.getConnections(getActiveWorkspaceID()).then((connections) => {
      try {
        // Get the associated connection's object
        let connection = connections.filter((connection) => connection.info.id == connectionID)[0]

        // This attribute is required for updating connections
        connection.original = connection

        /*
         * Get rid of the connection's credentials
         * By doing this the app won't ask the user to enter the credentials again
         */
        delete connection.info.credentials

        // Attempt to update the connection
        Modules.Connections.updateConnection(getActiveWorkspaceID(), connection).then((status) => {
          // If the updating process failed then throw an error and skip the upcoming code
          if (!status)
            throw 0

          // Remove associated attributes
          connectionElement.removeAttr('data-credentials-auth data-credentials-ssh')

          // Close the credentials dialog
          $('div.modal#connectionCredentials').find('div.modal-header button.btn-close').click()

          // Clicks the `TEST CONNECTION` button of the connection
          setTimeout(() => connectionElement.find('div.button button.test-connection').click())
        })
      } catch (e) {
        try {
          errorLog(e, 'common')
        } catch (e) {}

        // The updating process failed, show feedback to the user
        return showToast(I18next.capitalize(I18next.t('ignore connection credentials')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update the connection [b]$data[/b]', [getAttributes(connectionElement, 'data-name')])) + '.', 'failure')
      }
    })
  })

  // Clicks the `PROCEED` button
  $(`${dialog}-right`).parent().parent().find('button#realtimeCredentialsProceed').click(function() {
    // Get the associated connection's ID
    let connectionID = $(`div.modal#connectionCredentials`).attr('data-connection-id'),
      // Get the UI element of the connection
      connectionElement = $(`div[content="connections"] div.connections-container div.connections[workspace-id="${getActiveWorkspaceID()}"] div.connection[data-id="${connectionID}"]`),
      // Determine if the provided credentials are required for both sections `DB auth` and `ssh` or for one of them
      onlyOneSection = ''

    // Define the ID of the associated inputs
    let credentialsInputs = ['AuthUsername', 'AuthPassword', 'SSHUsername', 'SSHPassword', 'SSHPassphrase', 'confirmSaveAuthCredentials', 'confirmSaveSSHCredentials'],
      // Define a JSON object which will hold the values of each input
      credentialsArray = {}

    // Loop through all inputs
    credentialsInputs.forEach((input) => {
      // Define the input's name
      let name = input,
        // Is it a confirm checkbox or a text input field?
        confirm = !name.search('confirm')

      // Point at the checkbox/text field
      input = $(`input#${confirm ? 'realtimeCredentials' : ''}${name}`)

      // Get the input's value
      input = confirm ? input.val() : input.prop('checked')

      // Store the final value of the current input
      credentialsArray[`${name.toLowerCase()}`] = input
    })

    // Check if only one section is needed
    if ($('div.modal#connectionCredentials').hasClass('one-only'))
      onlyOneSection = $('div.modal#connectionCredentials').hasClass('auth') ? 'auth' : 'ssh'

    // Switch between the final result of `onlyOneSection`
    switch (onlyOneSection) {
      /**
       * Only the `DB authentication` section
       * Check `username` and `password` DB credentials
       */
      case 'auth': {
        if (([credentialsArray.authusername, credentialsArray.authpassword]).some((secret) => secret.trim().length <= 0))
          return showToast(I18next.capitalize(I18next.t('connection credentials')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid authentication credentials')) + '.', 'failure')
        break
      }
      /**
       * Only the `SSH authentication` section
       * Check `username` and `password` SSH credentials
       */
      case 'ssh': {
        if (([credentialsArray.sshusername, credentialsArray.sshpassword, credentialsArray.sshpassphrase]).every((secret) => secret.trim().length <= 0))
          return showToast(I18next.capitalize(I18next.t('connection credentials')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid ssh credentials')) + '.', 'failure')
        break
      }
      /**
       * Both sections are required
       * Check all credentials
       */
      case '': {
        if ((([credentialsArray.authusername, credentialsArray.authpassword]).some((secret) => secret.trim().length <= 0)) || (([credentialsArray.sshusername, credentialsArray.sshpassword, credentialsArray.sshpassphrase]).every((secret) => secret.trim().length <= 0)))
          return showToast(I18next.capitalize(I18next.t('connection credentials')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid credentials for both sections')) + '.', 'failure')
        break
      }
    }

    // Disable the proceed button
    $(this).attr('disabled', '')

    // Get the public key; to be used for the credentials encryption process
    getRSAKey('public', (key) => {
      try {
        // If the `DB authentication` section is not required then skip this try-catch block
        if (onlyOneSection != 'auth' && onlyOneSection != '')
          throw 0

        // Set the DB auth credentials
        connectionElement.attr({
          'data-username': credentialsArray.authusername.trim().length <= 0 ? null : encryptText(key, credentialsArray.authusername),
          'data-password': credentialsArray.authpassword.trim().length <= 0 ? null : encryptText(key, credentialsArray.authpassword)
        })
      } catch (e) {}

      try {
        // If the `SSH authentication` section is not required then skip this try-catch block
        if (onlyOneSection != 'ssh' && onlyOneSection != '')
          throw 0

        // Set the SSH credentials
        connectionElement.attr({
          'data-ssh-username': credentialsArray.sshusername.trim().length <= 0 ? null : encryptText(key, credentialsArray.sshusername),
          'data-ssh-password': credentialsArray.sshpassword.trim().length <= 0 ? null : encryptText(key, credentialsArray.sshpassword),
          'data-ssh-passphrase': credentialsArray.sshpassphrase.trim().length <= 0 ? null : encryptText(key, credentialsArray.sshpassphrase)
        })
      } catch (e) {}

      // Check if the user wants to save any of the given credentials
      try {
        // Get the checkbox `checked` result for both credentials
        let saveAuthCredentialsConfirmed = credentialsArray.confirmsaveauthcredentials,
          saveSSHCredentialsConfirmed = credentialsArray.confirmsavesshcredentials

        // If none of the checkboxes were checked then skip this try-catch block
        if (([saveAuthCredentialsConfirmed, saveSSHCredentialsConfirmed]).every((confirm) => !confirm))
          throw 0

        // Get all saved connections in the currently active workspace
        Modules.Connections.getConnections(getActiveWorkspaceID()).then((connections) => {
          try {
            // Get the associated connection's object
            let connection = connections.filter((connection) => connection.info.id == connectionID)[0]

            // This attribute is required for updating connections
            connection.original = connection

            /**
             * If both credentials saving are confirmed then remove the `credentials` attribute
             * If only DB auth is confirmed then remove its credentials attribute
             * If only SSH auth is confirmed then remove its credentials attribute
             */
            if (saveAuthCredentialsConfirmed && saveSSHCredentialsConfirmed)
              delete connection.info.credentials
            else if (saveAuthCredentialsConfirmed && !saveSSHCredentialsConfirmed)
              delete connection.info.credentials.auth
            else if (!saveAuthCredentialsConfirmed && saveSSHCredentialsConfirmed)
              delete connection.info.credentials.ssh

            /**
             * Make sure to keep the saved secrets as it
             * Without this line the app will remove the already saved secrets/credentials
             */
            connection.info.secrets = connection.info.secrets == undefined ? [] : connection.info.secrets

            try {
              // If the user didn't confirm the saving of DB auth credentials then skip this try-catch block
              if (!saveAuthCredentialsConfirmed)
                throw 0

              // Save `username`
              if (credentialsArray.authusername.trim().length != 0)
                connection.info.secrets.username = encryptText(key, credentialsArray.authusername)

              // Save `password`
              if (credentialsArray.authpassword.trim().length != 0)
                connection.info.secrets.password = encryptText(key, credentialsArray.authpassword)
            } catch (e) {
              try {
                errorLog(e, 'common')
              } catch (e) {}
            }

            try {
              // If the user didn't confirm the saving of SSH credentials then skip this try-catch block
              if (!saveSSHCredentialsConfirmed)
                throw 0

              // Save the SSH `username`
              if (credentialsArray.sshusername.trim().length != 0)
                connection.info.secrets.sshUsername = encryptText(key, credentialsArray.sshusername)

              // Save the SSH `password`
              if (credentialsArray.sshpassword.trim().length != 0)
                connection.info.secrets.sshPassword = encryptText(key, credentialsArray.sshpassword)

              // Save the SSH `passphrase`
              if (credentialsArray.sshpassphrase.trim().length != 0)
                connection.info.secrets.sshPassphrase = encryptText(key, credentialsArray.sshpassphrase)
            } catch (e) {
              try {
                errorLog(e, 'common')
              } catch (e) {}
            }

            // Attempt to update the connection
            Modules.Connections.updateConnection(getActiveWorkspaceID(), connection).then((status) => {
              // If the updating process failed then throw an error and skip the upcoming code
              if (!status)
                throw 0

              // Update the connection's unused attributes - after the update -
              connectionElement.removeAttr(`${saveAuthCredentialsConfirmed ? 'data-credentials-auth' : ''} ${saveSSHCredentialsConfirmed ? 'data-credentials-ssh' : ''}`)
            })
          } catch (e) {
            try {
              errorLog(e, 'common')
            } catch (e) {}

            // The updating process failed, show feedback to the user
            showToast(I18next.capitalize(I18next.t('save connection credentials')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update the connection [b]$data[/b]', [getAttributes(connectionElement, 'data-name')])) + '.', 'failure')

            // Enable the proceed button again
            $(this).removeAttr('disabled')

            // Skip the upcoming code
            return
          }
        })
      } catch (e) {
        try {
          errorLog(e, 'common')
        } catch (e) {}
      }

      // Enable the proceed button again
      $(this).removeAttr('disabled')

      // Update the connection's unused attributes - after the update -
      connectionElement.attr('data-got-credentials', 'true')

      // Close the credentials dialog
      $('div.modal#connectionCredentials').find('div.modal-header button.btn-close').click()

      // Clicks the `TEST CONNECTION` button of the connection
      setTimeout(() => connectionElement.find('div.button button.test-connection').click())
    })
  })
}

// Clicks the terminal's font select element
{
  setTimeout(() => {
    // Point at the list container
    let languagesMenuContainer = $(`div.dropdown[for-select="terminalFont"] ul.dropdown-menu`)

    // Once one of the items is clicked
    languagesMenuContainer.find('a').click(function() {
      // Point at the input field related to the list
      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

      // Update the input's value
      selectElement.val($(this).attr('value'))

      // Update the input's hidden value
      selectElement.attr('hidden-value', $(this).attr('hidden-value'))
    })
  })
}

{
  $('button#showMoreAbout').click(function() {
    let isSlideUp = $(this).hasClass('slideUp'),
      rightSide = $('div.modal#appAbout div.modal-body div.side-right')

    $(this).toggleClass('slideUp', !isSlideUp)

    $('div#moreAbout').slideToggle(300, function() {
      try {
        rightSide.animate({
          scrollTop: rightSide.get(0).scrollHeight
        }, 250)
      } catch (e) {}
    })
  })
}

{
  $(`ion-icon.management-tools-hint-icon.settings-dialog`).click(function() {
    let isClicked = `${$(this).attr('name')}`.includes('outline')

    try {
      if (isClicked)
        throw 0

      $(this).attr('name', 'info-circle-outline')

      $('div.management-tools-hint.settings-dialog').slideUp(350)

      return
    } catch (e) {}

    $(this).attr('name', 'info-circle')

    $('div.management-tools-hint.settings-dialog').slideDown(350)
  })
}

{
  let toolExtraPathsDivElement = $('div.extra-paths-input[for-form="toolExtraPaths"]'),
    toolExtraPathsInput = $('input#toolExtraPaths'),
    pathIsAbsolute = OS.platform() == 'win32' ? Path.win32.isAbsolute : Path.isAbsolute

  $('div.management-tools.settings-dialog div.tool[tool]').click(function() {
    $('div.management-tools.settings-dialog div.tool').removeClass('selected')

    $(this).addClass('selected')

    // For tool's location extra paths feature
    {
      toolExtraPathsDivElement.slideDown('fast')

      let selectedTool = $(this).attr('tool')

      Modules.Config.getConfig((config) => {
        let extraPaths = config.get('containersManagementToolsPaths', selectedTool) || ''

        toolExtraPathsInput.val(`${extraPaths}`).trigger('input')

        setTimeout(() => {
          try {
            getElementMDBObject(toolExtraPathsInput).update()
          } catch (e) {}
        })
      })
    }
  })

  toolExtraPathsInput.on('input', function() {
    let paths = `${$(this).val()}`

    if (paths.length <= 0)
      return toolExtraPathsInput.removeClass('is-invalid')

    paths = paths.split('|')

    let isInvalidPathFound = false

    for (let path of paths) {
      let isPathValid = pathIsAbsolute(path) && pathIsAccessible(path)

      if (isPathValid)
        continue

      isInvalidPathFound = true

      break
    }

    toolExtraPathsInput.toggleClass('is-invalid', isInvalidPathFound)

    $('button#saveSettings').attr('disabled', isInvalidPathFound ? '' : null)
  })
}

{
  setTimeout(() => {
    // Point at the list container
    let keyspaceReplicationStrategyContainer = $(`div.dropdown[for-select="keyspaceReplicationStrategy"] ul.dropdown-menu`)

    // Once one of the items is clicked
    keyspaceReplicationStrategyContainer.find('a').click(function() {
      // Point at the input field related to the list
      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

      // Update the input's value
      selectElement.val($(this).attr('value')).trigger('input')
    })
  })
}

{
  $('div.body div.left div.content div.logo').click(() => {
    try {
      Open(`https://axonops.com`)
    } catch (e) {}
  })
}

{
  $('div.modal#extraDataActions div.editor-container').observeVisibility(() => $(window.visualViewport).trigger('resize'))
}

{
  $('div.modal[id]').get().forEach((modal) => modal.addEventListener('shown.mdb.modal', () => $(window.visualViewport).trigger('resize')))
}

{
  $("#rightClickActionsMetadata")[0].addEventListener('hidden.mdb.modal', () => $("#rightClickActionsMetadata").removeClass('insertion-action'))
}

// Check and update the app's icon's badge in macOS based on the currently active work areas (connections)
{
  try {
    if (OS.platform() != 'darwin')
      throw 0

    let numOfActiveWorkareas = 0

    globalTrackers.intervals.badgeUpdate = setInterval(() => {
      let numUpdate = $('div.body div.right div.content div[content="workarea"] div.workarea').length

      if (numUpdate == numOfActiveWorkareas)
        return

      IPCRenderer.send('badge:update', numUpdate)

      numOfActiveWorkareas = numUpdate
    }, 1500)
  } catch (e) {}
}

{
  $('input[type="checkbox"][role="switch"]').on('change input', function() {
    $(this).parent().find(`label[for="${$(this).attr('id')}"]`).css('opacity', $(this).prop('checked') ? '1' : '0.65')
  })
}

{
  IPCRenderer.send('theme:is-dark')

  IPCRenderer.on('theme:is-dark', (_, isHostThemeDarkUpdated) => isHostThemeDark = isHostThemeDarkUpdated)
}

// Prevent mouse click on `a` elements from opening a new tab
{
  window.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault()
  })
}

// Stop navigation on drops anywhere
{
  window.addEventListener('dragover', (e) => {
    e.preventDefault()

    e.dataTransfer.dropEffect = 'copy'
  })

  window.addEventListener('drop', (e) => e.preventDefault())
}

{
  $('div.modal button.btn.expand').click(function() {
    let modalDialog = $(this).closest('div.modal-dialog'),
      isExpandEnabled = modalDialog.hasClass('modal-fullscreen')

    modalDialog.toggleClass('modal-fullscreen', !isExpandEnabled)

    $(this).find('ion-icon').attr('name', `${isExpandEnabled ? 'expand-2' : 'contract'}`)

    // Save the state of that modal
    let currentModals = (Store.get(`fullscreen-modals`) || []),
      modalID = `${modalDialog.closest('div.modal').attr('id')}`

    if (!isExpandEnabled)
      currentModals.push(modalID)

    currentModals = [...new Set(currentModals)]

    if (isExpandEnabled)
      currentModals = currentModals.filter((currentModalID) => modalID != currentModalID)

    Store.set(`fullscreen-modals`, currentModals)

    setTimeout(() => $(window.visualViewport).trigger('resize'))
  })
}

{
  $('div.modal.fullscreen-mode').get().forEach((modal) => modal.addEventListener('show.mdb.modal', () => {
    let modalID = $(modal).attr('id'),
      isFullscreenModeEnabled = (Store.get(`fullscreen-modals`) || []).find((currentModalID) => currentModalID == modalID) != undefined

    if (isFullscreenModeEnabled && !$(modal).find('div.modal-dialog').hasClass('modal-fullscreen'))
      $(modal).find('button.btn.expand').click()
  }))
}
