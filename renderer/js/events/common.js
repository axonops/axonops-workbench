// When the window is being resized
{
  $(window.visualViewport).on('resize', () => {
    // Resize all created editors
    try {
      // Get all editors
      let editors = monaco.editor.getEditors()

      // Loop through each one of them and resize it
      editors.forEach((editor) => {
        try {
          editor.layout()
        } catch (e) {}
      })
    } catch (e) {}

    // Resize all created terminals
    try {
      terminalFitAddonObjects.forEach((fitAddon) => {
        try {
          fitAddon.fit()
        } catch (e) {}
      })
    } catch (e) {}

    // Resize all query tracing charts
    try {
      Object.keys(queryTracingChartsObjects).forEach((chart) => {
        try {
          queryTracingChartsObjects[chart].resize()
        } catch (e) {}
      })
    } catch (e) {}

    // Hide the tabs' titles if the AI assistant is opened or the app's window's width is not wide enough
    try {
      // Get the overall width of the app's main window
      let windowWidth = window.outerWidth,
        // Whether or not titles in the work areas tabs would be shown
        showTabsTitles = windowWidth >= 1630 || (windowWidth < 1630 && !$('div.body').hasClass('show-hidden'))

      /**
       * Check if there's at least one visible opened sandbox project
       * This process is done because the sandbox project has extra tabs - AxonOps -; so the app's window's width should be wider
       */
      let existsAxonopsTab = $('div.cluster-tabs ul.nav.nav-tabs li.axonops-tab').filter(':visible').length > 0

      try {
        // If there are no opened sandbox projects then skip this try-catch block
        if (!existsAxonopsTab)
          throw 0

        // Check if the window is less than the minimum possible value
        showTabsTitles = windowWidth >= 1420

        // Check if the hidden section is shown and the window is less than the minimum possible value - in this case -
        if (showTabsTitles)
          showTabsTitles = windowWidth >= 1720 && !$('div.body').hasClass('show-hidden')
      } catch (e) {}

      // Inside the cluster's workareas, find all tabs' titles and toggle their display based on the window width
      $('div.body div.right div.content div[content="workarea"]')
        .find('div.cluster-tabs ul a.nav-link span.title:not(.ignore-resize)')
        .toggle(showTabsTitles)

      // Enable/disable the work area's tabs' tooltips
      mdbObjects.filter((mdbObject) => mdbObject.element.attr('tab-tooltip') != undefined && mdbObject.element.find('span.title.ignore-resize').length <= 0).forEach((mdbObject) => mdbObject.object[!showTabsTitles ? 'enable' : 'disable']())
    } catch (e) {}

    // Update the switchers' container's status
    try {
      (['workspaces', 'clusters']).forEach((type) => updateSwitcherView(type))
    } catch (e) {}
  })
}

// Handle clicking on different sections buttons in the left side
{
  // Define the common element CSS selector
  let selector = `div.body div.left div.content div.navigation div.group div.item`

  // Clicks the AI assistant button
  $(`${selector}[action="ai"]`).click(() => {
    /**
     * Show the AI assistant container's content
     *
     * Point at the content
     */
    let assistantContent = $('div.body div.hidden-area div.content.ai-assistant')

    // Add log for this action
    addLog(`The navigation side, opened the AI Assistant section`, 'action')

    try {
      // If the content is already shown/visible
      if (assistantContent.is(':visible') && $('div.body').hasClass('show-hidden')) {
        // Hide the hidden area
        $('div.body').removeClass('show-hidden')

        // Skip this try-catch block
        throw 0
      }

      // Hide other contents in the hidden area
      $('div.body div.hidden-area div.content').hide().removeAttr('hidden')

      // Show the AI assistant's content
      assistantContent.show()

      // Show the hidden area if it's not already shown
      $('div.body').addClass('show-hidden')
    } catch (e) {}

    /**
     * Show the initialization element if needed
     * TODO: This is just a preview of the authentication process for using the AI assistant
     */
    try {
      if (!assistantContent.hasClass('not-initialized'))
        throw 0

      assistantContent.addClass('_loading')

      // Load some of the saved questions
      $(document).trigger('loadQuestions')

      // Set a random time to remove the initialization process
      setTimeout(() => assistantContent.removeClass('not-initialized _loading'), 1500 + (1500 * Math.random()))
    } catch (e) {}

    // Trigger the resize event for the window; to hide the tabs' titles if needed
    $(window.visualViewport).trigger('resize')

    // Point at the answering indicator beside the AI's icon
    let answeringLoader = $(`div.body div.left div.content div.navigation div.group div.item[action="ai"] div.answering`)

    try {
      // If the AI assistant is already shown then skip this try-catch block
      if ($('div.body').hasClass('show-hidden'))
        throw 0

      /**
       * Reaching here means the AI assistant is hidden
       *
       * Check if the AI is answering a question
       */
      let answeringQuestion = $(`div.hidden-area div.content div.questions-and-answers div.block._right div.answer div.answering:not([style*="display: none"])`).length > 0

      // If the AI assistant is answering a question then show the answering indicator beside the AI's icon
      if (answeringQuestion)
        answeringLoader.addClass('show')

      // Skip the upcoming code
      return
    } catch (e) {}

    // Remove the answering indicator as the AI assistant is opened/shown
    answeringLoader.removeClass('show')
  })

  // Clicks the help/documentation button
  $(`${selector}[action="help"]`).click(() => {
    /**
     * Send a request to the main thread to show the documentation view
     * If the documentation view is already shown it'll be focused on
     */
    IPCRenderer.send('documentation-view:show')

    // Add log for this action
    addLog(`The navigation side, opened the help/documentation section`, 'action')
  })

  // Clicks the AI assistant button
  $(`${selector}[action="notifications-center"]`).click(function() {
    /**
     * Show the AI assistant container's content
     *
     * Point at the content
     */
    let notificationsCenterContent = $('div.body div.hidden-area div.content.notifications-center'),
      // Get all toasts inside the notifications container
      toasts = $('div.body div.hidden-area div.content.notifications-center div.notifications-container div.toast'),
      // Point at the button inside the action's item
      btn = $(this).find('div.sub-content.btn')

    // Add log for this action
    addLog(`The navigation side, opened the notifications center section`, 'action')

    try {
      // If the content is already shown/visible
      if (notificationsCenterContent.is(':visible') && $('div.body').hasClass('show-hidden')) {
        // Hide the hidden area
        $('div.body').removeClass('show-hidden')

        // Hide all toasts
        toasts.removeClass('show')

        // Skip this try-catch block
        throw 0
      }

      // Hide other contents in the hidden area
      $('div.body div.hidden-area div.content').hide().removeAttr('hidden')

      // Show the AI assistant's content
      notificationsCenterContent.show()

      // Show the hidden area if it's not already shown
      $('div.body').addClass('show-hidden')

      // Show all hidden toasts
      setTimeout(() => toasts.filter(':not(.show)').addClass('show'), 100)
    } catch (e) {}

    try {
      // If this is not a fresh open - after notified about new toasts -
      if (!(btn.hasClass('active'))) {
        // Remove `new` class from all toasts
        toasts.removeClass('new')

        // Skip the try-catch block
        throw 0
      }

      // Stop the notification's icon's animation
      (btn.find('lottie-player'))[0].stop()

      // Remove its `active` class, the user has been notified and the center has been opened
      btn.removeClass('active')
    } catch (e) {}

    // Point at the AI answering indicator beside the AI's icon
    let answeringLoader = $(`div.body div.left div.content div.navigation div.group div.item[action="ai"] div.answering`),
      assistantContainer = $('div.body div.hidden-area div.content.ai-assistant')

    try {
      // If the hidden area is already shown then skip this try-catch block
      if ($('div.body').hasClass('show-hidden') && assistantContainer.is(':visible'))
        throw 0

      /**
       * Reaching here means the AI assistant is hidden
       *
       * Check if the AI is answering a question
       */
      let answeringQuestion = $(`div.hidden-area div.content div.questions-and-answers div.block._right div.answer div.answering:not([style*="display: none"])`).length > 0

      // If the AI assistant is answering a question then show the answering indicator beside the AI's icon
      if (answeringQuestion && !assistantContainer.is(':visible'))
        answeringLoader.addClass('show')

      // Skip the upcoming code
      return
    } catch (e) {}

    // Remove the answering indicator as the AI assistant is opened/shown
    answeringLoader.removeClass('show')

    // Trigger the resize event for the window; to hide the tabs' titles if needed
    $(window.visualViewport).trigger('resize')
  })

  // Get the MDB objects for the settings modal, and different UI elements inside it
  let settingsModal = getElementMDBObject($('#appSettings'), 'Modal'),
    maxNumCQLSHSessionsObject = getElementMDBObject($('input#maxNumCQLSHSessions')),
    maxNumSandboxProjectsObject = getElementMDBObject($('input#maxNumSandboxProjects')),
    maxNumAIAssistantAnswersObject = getElementMDBObject($('input#maxNumAIAssistantAnswers'))

  // Clicks the settings button
  $(`${selector}[action="settings"]`).click(() => {
    // Get the app's config/settings
    Modules.Config.getConfig((config) => {
      // Get different saved settings to be checked and applied on the UI
      let maxNumCQLSHSessions = config.get('limit', 'cqlsh'),
        maxNumSandboxProjects = config.get('limit', 'sandbox'),
        maxNumAIAssistantAnswers = config.get('limit', 'assistantQuestions'),
        contentProtection = config.get('security', 'contentProtection'),
        loggingEnabled = config.get('security', 'loggingEnabled'),
        displayLanguage = config.get('ui', 'language')

      // Add log for this action
      addLog(`The navigation side, opened the settings dialog`, 'action')

      // Check the maximum number of allowed CQLSH sessions at once
      $('input#maxNumCQLSHSessions').val(!isNaN(maxNumCQLSHSessions) && maxNumCQLSHSessions > 0 ? maxNumCQLSHSessions : 10)
      setTimeout(() => maxNumCQLSHSessionsObject.update())

      // Check the maximum number of allowed sandbox projects at once
      $('input#maxNumSandboxProjects').val(!isNaN(maxNumSandboxProjects) && maxNumSandboxProjects > 0 ? maxNumSandboxProjects : 1)
      setTimeout(() => maxNumAIAssistantAnswersObject.update())

      // Check the maximum number of answers to be loaded per time
      $('input#maxNumAIAssistantAnswers').val(!isNaN(maxNumAIAssistantAnswers) && maxNumAIAssistantAnswers > 0 ? maxNumAIAssistantAnswers : 4)
      setTimeout(() => maxNumAIAssistantAnswersObject.update())

      // Check the content protection status
      $('input#contentProtection[type="checkbox"]').prop('checked', contentProtection == 'true')

      // Check the logging system
      $('input#loggingSystem[type="checkbox"]').prop('checked', loggingEnabled == 'true')

      /**
       * Check the chosen display language - whether it's valid or not -
       * Point at the language's option in the UI - if it exists then it means the app has loaded it successfully at the initialization process -
       */
      let chosenDisplayLanguageElement = $('div.dropdown[for-select="languageUI"] ul li a').filter(`[hidden-value="${displayLanguage}"]`)

      try {
        // If the language's option is not in the UI then skip the upcoming code and jump to the catch/exception block
        if (chosenDisplayLanguageElement.length <= 0)
          throw 0

        // Select the chosen language in the UI
        $('input#languageUI').val(chosenDisplayLanguageElement.attr('value'))
        $('input#languageUI').attr('hidden-value', chosenDisplayLanguageElement.attr('hidden-value'))
      } catch (e) {
        // Select English as the chosen language is not available/hasn't been loaded
        $('input#languageUI').val('English')
        $('input#languageUI').attr('hidden-value', 'en')
      }

      // Set the suitable width for the inputs' titles' notch
      setTimeout(() => ([maxNumCQLSHSessionsObject, maxNumSandboxProjectsObject, maxNumAIAssistantAnswers]).forEach((object) => $(object._element).find('div.form-notch-middle').css('width', '111.2px')), 1000)

      // Show the settings' modal
      settingsModal.show()
    })
  })

  // Handle the click of items in more options/settings menu
  {
    // Point at the items
    let actionButton = $(`div.dropdown.more-actions ul.dropdown-menu li a.dropdown-item`),
      // Set the zoom level - initially 100% -
      zoomLevel = 100

    // Listen to the `click` event
    actionButton.click(function() {
      // Get the clicked item's action
      let action = $(this).attr('action')

      // Switch between actions
      switch (action) {
        case 'zoomIn': {
          zoomLevel += 5
          $('body').css('zoom', `${zoomLevel}%`)
          $('div.terminal-container div.terminal.xterm').trigger('changefont', 187)

          // Add log for this action
          addLog(`Zoom in the UI by '${zoomLevel}%'`, 'action')
          break
        }
        case 'zoomOut': {
          zoomLevel -= 5
          $('body').css('zoom', `${zoomLevel}%`)
          $('div.terminal-container div.terminal.xterm').trigger('changefont', 189)

          // Add log for this action
          addLog(`Zoom out the UI by '${zoomLevel}%'`, 'action')
          break
        }
        case 'zoomReset': {
          zoomLevel = 100
          $('body').css('zoom', `${zoomLevel}%`)
          $('div.terminal-container div.terminal.xterm').trigger('changefont', 48)

          // Add log for this action
          addLog(`Rest the zoom of the UI to '${zoomLevel}%'`, 'action')
          break
        }
        case 'toggleFullscreen': {
          IPCRenderer.send('options:view:toggle-fullscreen')

          // Add log for this action
          addLog(`Toggle the fullscreen mode`, 'action')
          break
        }
        case 'restartApp': {
          // Add log for this action
          addLog(`Restart the app`, 'action')

          IPCRenderer.send('options:actions:restart')
          break
        }
        case 'quitApp': {
          // Add log for this action
          addLog(`Quit the app`, 'action')

          IPCRenderer.send('options:actions:quit')
          break
        }
        case 'closeWorkareas': {
          // Add log for this action
          addLog(`Request to close all active work areas`, 'action')

          // Confirm the close of all work areas
          openDialog(I18next.capitalizeFirstLetter(I18next.t('are you sure about closing all active work areas - including sandbox projects - ?')), (confirm) => {
            // If canceled, or not confirmed then skip the upcoming code
            if (!confirm)
              return

            // Call the closing function
            closeAllWorkareas()

            /**
             * Disable the `close all workareas` button
             * It'll be enabled once a new work area created
             */
            $(this).addClass('disabled')
          })
          break
        }
      }
    })

    // Listen to key presses in relation to the more options/settings shortcuts
    $(document).on('keypress', function(e) {
      // `CTRL` and `SHIFT` keys should be pressed
      if (!e.ctrlKey || !e.shiftKey)
        return

      switch (e.keyCode) {
        // Zoom in
        case 11: {
          actionButton.filter('[action="zoomIn"]').click()
          break
        }
        // Zoom out
        case 31: {
          actionButton.filter('[action="zoomOut"]').click()
          break
        }
        // Zoom reset
        case 9: {
          actionButton.filter('[action="zoomReset"]').click()
          break
        }
      }
    }).on('keydown', function(e) {
      // F11 for toggling fullscreen mode
      if (e.keyCode != 122)
        return

      actionButton.filter('[action="toggleFullscreen"]').click()
    })
  }
}

// Handle the app's settings' dialog events and processes
{
  // Define the common element CSS selector
  let dialog = `div.modal#appSettings div.modal-body div.side`

  // Clicks one of the left side buttons
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

  // Clicks the `SAVE SETTINGS` button in the footer in the dialog
  $(`button#saveSettings`).click(function() {
    // Add log about this action
    addLog(`Request to save the updated app's settings`, 'action')

    // Update variables and get the result
    $('button#updateVariables').trigger('click', (result) => {
      // Check content protection
      let contentProtection = $('input#contentProtection[type="checkbox"]').prop('checked'),
        // Check logging system enable/disable status
        loggingEnabled = $('input#loggingSystem[type="checkbox"]').prop('checked'),
        // Get the maximum allowed running instances
        maxNumCQLSHSessions = $('input#maxNumCQLSHSessions').val(),
        maxNumSandboxProjects = $('input#maxNumSandboxProjects').val(),
        // Get the maximum number of loaded answers per time
        maxNumAIAssistantAnswers = $('input#maxNumAIAssistantAnswers').val(),
        // Get chosen display language and if it's from right to left
        [chosenDisplayLanguage, languageRTL] = getAttributes($('input#languageUI'), ['hidden-value', 'rtl'])

      // Set RTL class if the language needs that
      $('body').toggleClass('rtl', languageRTL == 'true')

      // Apply the chosen display language
      Modules.Localization.applyLanguage(chosenDisplayLanguage)

      // Apply the new content protection state
      IPCRenderer.send('content-protection', contentProtection)

      try {
        // Get the current app's config/settings
        Modules.Config.getConfig((config) => {
          // Update settings
          config.set('security', 'contentProtection', contentProtection)
          config.set('security', 'loggingEnabled', loggingEnabled)
          config.set('limit', 'cqlsh', maxNumCQLSHSessions)
          config.set('limit', 'sandbox', maxNumSandboxProjects)
          config.set('limit', 'assistantQuestions', maxNumAIAssistantAnswers)
          config.set('ui', 'language', chosenDisplayLanguage)

          // Set the updated settings
          Modules.Config.setConfig(config)

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
        errorLog(e, 'common')
      }
    })
  })

  // Show/hide the languages' list once the associated input is focused on/out
  setTimeout(() => {
    // Define the app's settings model selector path
    let dialog = 'div.modal#appSettings'

    // Loop through the dropdown element of each select element
    $(`${dialog}`).find('div.dropdown[for-select]').each(function() {
      // Get the MDB object of the current dropdown element
      let selectDropdown = getElementMDBObject($(this), 'Dropdown'),
        // Point at the associated input field
        input = $(`${dialog}`).find(`input#${$(this).attr('for-select')}`)

      // Once the associated select element is being focused then show the dropdown element and vice versa
      input.on('focus', () => selectDropdown.show()).on('focusout', () => setTimeout(() => selectDropdown.hide(), 100))

      // Once the parent `form-outline` is clicked trigger the `focus` event
      input.parent().click(() => input.trigger('focus'))
    })
  })
}

// Clicks any of the section's buttons in the left side of the dialog
{
  // Define the common element CSS selector
  let dialog = `div.modal#clusterCredentials div.modal-body div.side`

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
    // Get the associated cluster's ID
    let clusterID = $(`div.modal#clusterCredentials`).attr('data-cluster-id'),
      // Get the UI element of the cluster
      clusterElement = $(`div.clusters[workspace-id="${getActiveWorkspaceID()}"] div.cluster[data-id="${clusterID}"]`)

    // Get all saved clusters in the currently active workspace
    Modules.Clusters.getClusters(getActiveWorkspaceID()).then((clusters) => {
      try {
        // Get the associated cluster's object
        let cluster = clusters.filter((cluster) => cluster.info.id == clusterID)[0]

        // This attribute is required for updating clusters
        cluster.original = cluster

        /*
         * Get rid of the cluster's credentials
         * By doing this the app won't ask the user to enter the credentials again
         */
        delete cluster.info.credentials

        // Attempt to update the cluster
        Modules.Clusters.updateCluster(getActiveWorkspaceID(), cluster).then((status) => {
          // If the updating process failed then throw an error and skip the upcoming code
          if (!status)
            throw 0

          // Remove associated attributes
          clusterElement.removeAttr('data-credentials-auth data-credentials-ssh')

          // Close the credentials dialog
          $('div.modal#clusterCredentials').find('div.modal-header button.btn-close').click()

          // Clicks the `TEST CONNECTION` button of the cluster
          setTimeout(() => clusterElement.find('div.button button.test-connection').click())
        })
      } catch (e) {
        errorLog(e, 'common')

        // The updating process failed, show feedback to the user
        return showToast(I18next.capitalize(I18next.t('ignore cluster credentials')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update the cluster [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')
      }
    })
  })

  // Clicks the `PROCEED` button
  $(`${dialog}-right`).parent().parent().find('button#realtimeCredentialsProceed').click(function() {
    // Get the associated cluster's ID
    let clusterID = $(`div.modal#clusterCredentials`).attr('data-cluster-id'),
      // Get the UI element of the cluster
      clusterElement = $(`div[content="clusters"] div.clusters-container div.clusters[workspace-id="${getActiveWorkspaceID()}"] div.cluster[data-id="${clusterID}"]`),
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
    if ($('div.modal#clusterCredentials').hasClass('one-only'))
      onlyOneSection = $('div.modal#clusterCredentials').hasClass('auth') ? 'auth' : 'ssh'

    // Switch between the final result of `onlyOneSection`
    switch (onlyOneSection) {
      /**
       * Only the `DB authentication` section
       * Check `username` and `password` DB credentials
       */
      case 'auth': {
        if (([credentialsArray.authusername, credentialsArray.authpassword]).some((secret) => secret.trim().length <= 0))
          return showToast(I18next.capitalize(I18next.t('cluster credentials')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid authentication credentials')) + '.', 'failure')
        break
      }
      /**
       * Only the `SSH authentication` section
       * Check `username` and `password` SSH credentials
       */
      case 'ssh': {
        if (([credentialsArray.sshusername, credentialsArray.sshpassword, credentialsArray.sshpassphrase]).every((secret) => secret.trim().length <= 0))
          return showToast(I18next.capitalize(I18next.t('cluster credentials')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid ssh credentials')) + '.', 'failure')
        break
      }
      /**
       * Both sections are required
       * Check all credentials
       */
      case '': {
        if ((([credentialsArray.authusername, credentialsArray.authpassword]).some((secret) => secret.trim().length <= 0)) || (([credentialsArray.sshusername, credentialsArray.sshpassword, credentialsArray.sshpassphrase]).every((secret) => secret.trim().length <= 0)))
          return showToast(I18next.capitalize(I18next.t('cluster credentials')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid credentials for both sections')) + '.', 'failure')
        break
      }
    }

    // Disable the proceed button
    $(this).attr('disabled', '')

    // Get the public key; to be used for the credentials encryption process
    getKey('public', (key) => {
      try {
        // If the `DB authentication` section is not required then skip this try-catch block
        if (onlyOneSection != 'auth' && onlyOneSection != '')
          throw 0

        // Set the DB auth credentials
        clusterElement.attr({
          'data-username': credentialsArray.authusername.trim().length <= 0 ? null : encrypt(key, credentialsArray.authusername),
          'data-password': credentialsArray.authpassword.trim().length <= 0 ? null : encrypt(key, credentialsArray.authpassword)
        })
      } catch (e) {}

      try {
        // If the `SSH authentication` section is not required then skip this try-catch block
        if (onlyOneSection != 'ssh' && onlyOneSection != '')
          throw 0

        // Set the SSH credentials
        clusterElement.attr({
          'data-ssh-username': credentialsArray.sshusername.trim().length <= 0 ? null : encrypt(key, credentialsArray.sshusername),
          'data-ssh-password': credentialsArray.sshpassword.trim().length <= 0 ? null : encrypt(key, credentialsArray.sshpassword),
          'data-ssh-passphrase': credentialsArray.sshpassphrase.trim().length <= 0 ? null : encrypt(key, credentialsArray.sshpassphrase)
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

        // Get all saved clusters in the currently active workspace
        Modules.Clusters.getClusters(getActiveWorkspaceID()).then((clusters) => {
          try {
            // Get the associated cluster's object
            let cluster = clusters.filter((cluster) => cluster.info.id == clusterID)[0]

            // This attribute is required for updating clusters
            cluster.original = cluster

            /**
             * If both credentials saving are confirmed then remove the `credentials` attribute
             * If only DB auth is confirmed then remove its credentials attribute
             * If only SSH auth is confirmed then remove its credentials attribute
             */
            if (saveAuthCredentialsConfirmed && saveSSHCredentialsConfirmed)
              delete cluster.info.credentials
            else if (saveAuthCredentialsConfirmed && !saveSSHCredentialsConfirmed)
              delete cluster.info.credentials.auth
            else if (!saveAuthCredentialsConfirmed && saveSSHCredentialsConfirmed)
              delete cluster.info.credentials.ssh

            /**
             * Make sure to keep the saved secrets as it
             * Without this line the app will remove the already saved secrets/credentials
             */
            cluster.info.secrets = cluster.info.secrets == undefined ? [] : cluster.info.secrets

            try {
              // If the user didn't confirm the saving of DB auth credentials then skip this try-catch block
              if (!saveAuthCredentialsConfirmed)
                throw 0

              // Save `username`
              if (credentialsArray.authusername.trim().length != 0)
                cluster.info.secrets.username = encrypt(key, credentialsArray.authusername)

              // Save `password`
              if (credentialsArray.authpassword.trim().length != 0)
                cluster.info.secrets.password = encrypt(key, credentialsArray.authpassword)
            } catch (e) {
              errorLog(e, 'common')
            }

            try {
              // If the user didn't confirm the saving of SSH credentials then skip this try-catch block
              if (!saveSSHCredentialsConfirmed)
                throw 0

              // Save the SSH `username`
              if (credentialsArray.sshusername.trim().length != 0)
                cluster.info.secrets.sshUsername = encrypt(key, credentialsArray.sshusername)

              // Save the SSH `password`
              if (credentialsArray.sshpassword.trim().length != 0)
                cluster.info.secrets.sshPassword = encrypt(key, credentialsArray.sshpassword)

              // Save the SSH `passphrase`
              if (credentialsArray.sshpassphrase.trim().length != 0)
                cluster.info.secrets.sshPassphrase = encrypt(key, credentialsArray.sshpassphrase)
            } catch (e) {
              errorLog(e, 'common')
            }

            // Attempt to update the cluster
            Modules.Clusters.updateCluster(getActiveWorkspaceID(), cluster).then((status) => {
              // If the updating process failed then throw an error and skip the upcoming code
              if (!status)
                throw 0

              // Update the cluster's unused attributes - after the update -
              clusterElement.removeAttr(`${saveAuthCredentialsConfirmed ? 'data-credentials-auth' : ''} ${saveSSHCredentialsConfirmed ? 'data-credentials-ssh' : ''}`)
            })
          } catch (e) {
            errorLog(e, 'common')

            // The updating process failed, show feedback to the user
            showToast(I18next.capitalize(I18next.t('save cluster credentials')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update the cluster [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

            // Enable the proceed button again
            $(this).removeAttr('disabled')

            // Skip the upcoming code
            return
          }
        })
      } catch (e) {
        errorLog(e, 'common')
      }

      // Enable the proceed button again
      $(this).removeAttr('disabled')

      // Update the cluster's unused attributes - after the update -
      clusterElement.attr('data-got-credentials', 'true')

      // Close the credentials dialog
      $('div.modal#clusterCredentials').find('div.modal-header button.btn-close').click()

      // Clicks the `TEST CONNECTION` button of the cluster
      setTimeout(() => clusterElement.find('div.button button.test-connection').click())
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
