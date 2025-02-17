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

// When the window is being resized
{
  $(window.visualViewport).on('resize', () => {
    // Resize all created editors
    try {
      // Get all editors
      let editors = monaco.editor.getEditors()

      try {
        editors = editors.concat(diffEditors)
      } catch (e) {}

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
        rightSideWidth = $('div.body div.main.right').outerWidth(),
        // Whether or not titles in the work areas tabs would be shown
        showTabsTitles = (windowWidth >= 1630 && rightSideWidth >= 1190) || (windowWidth < 1630 && !$('div.body').hasClass('show-hidden'))

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
        showTabsTitles = windowWidth >= 1420 && rightSideWidth >= 980

        // Check if the hidden section is shown and the window is less than the minimum possible value - in this case -
        if (showTabsTitles)
          showTabsTitles = windowWidth >= 1720 && rightSideWidth >= 1280 && !$('div.body').hasClass('show-hidden')
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
  let selector = `div.body div.left div.content div.navigation div.group div.item`,
    isHiddenAreaResizable = false,
    latestWidth = 450,
    triggerStopTimeout,
    hiddenAreaElement = $('div.body div.main.hidden-area'),
    rightSideElement = $('div.body div.main.right'),
    toastsContainer = $('div.toast-container'),
    pinnedToastsContainer = $('div.pinned-toast-container')

  // Clicks the AI assistant button
  $(`${selector}[action="ai"]`).click(() => {
    /**
     * Show the AI assistant container's content
     *
     * Point at the content
     */
    let assistantContent = $('div.body div.hidden-area div.content.ai-assistant')

    // Add log for this action
    try {
      addLog(`The navigation side, opened the AI Assistant section`, 'action')
    } catch (e) {}

    try {
      // If the content is already shown/visible
      if (assistantContent.is(':visible') && $('div.body').hasClass('show-hidden')) {
        // Hide the hidden area
        $('div.body').removeClass('show-hidden')

        // Reset the width of each sides - hidden area and the right side -
        setTimeout(() => hiddenAreaElement.add(rightSideElement).css('width', ''))

        // Update the pinned toasts' container's position
        setTimeout(() => pinnedToastsContainer.css('left', '100px'))

        // Update the toasts' container's position
        setTimeout(() => toastsContainer.css('transform', 'translateX(0px)'))

        // Skip this try-catch block
        throw 0
      }

      // Hide other contents in the hidden area
      $('div.body div.hidden-area div.content').hide().removeAttr('hidden')

      // Show the AI assistant's content
      assistantContent.show()

      // Show the hidden area if it's not already shown
      $('div.body').addClass('show-hidden')

      setTimeout(() => {
        // Set the latest saved width for the hidden area
        hiddenAreaElement.css('width', `${latestWidth}px`)

        // Same thing with the right side
        rightSideElement.css('width', `calc(100% - 80px - ${latestWidth}px)`)

        // Update the pinned toasts' container's position
        pinnedToastsContainer.css('left', 100 + latestWidth + 'px')

        // Update the toasts' container's position
        toastsContainer.css('transform', 'translateX(' + (latestWidth - 100) + 'px)')
      })
    } catch (e) {}

    try {
      /**
       * Make the hidden area resizable
       *
       * If the flag is already set to `true` then skip this try-catch block
       */
      if (isHiddenAreaResizable)
        throw 0

      // Update the flag
      isHiddenAreaResizable = true

      // Make the hidden area resizable
      hiddenAreaElement.resizable({
        handles: 'e', // [E]ast
        minWidth: 350, // Minimum width allowed to be reached
        maxWidth: 900
        // While the resizing process is active
      }).on('resize',
        function(_, __) {
          // Make sure there's no transition effects while the resizing process is being performed
          hiddenAreaElement.add(rightSideElement).add(pinnedToastsContainer).add(toastsContainer).addClass('no-transition')

          // Applying this rule will prevent the sudden stop while the area is being resized
          hiddenAreaElement.find('webview').css('pointer-events', 'none')

          // Update the `latestWidth` value
          latestWidth = hiddenAreaElement.outerWidth()

          // Update the right side width based on the hidden area's new width
          rightSideElement.css('width', `calc(100% - 80px - ${latestWidth}px)`)

          // Update the pinned toasts' container's position
          pinnedToastsContainer.css('left', 100 + latestWidth + 'px')

          // Update the toasts' container's position
          toastsContainer.css('transform', 'translateX(' + (latestWidth - 100) + 'px)')

          // Set a timeout to trigger the `resizestop` event after set period of time
          {
            if (triggerStopTimeout != undefined)
              clearTimeout(triggerStopTimeout)

            setTimeout(() => hiddenAreaElement.trigger('resizestop'), 100)
          }

          // When the resizing process stop
        }).on('resizestop', function(_, __) {
        // Restore the transition effects
        hiddenAreaElement.add(rightSideElement).add(pinnedToastsContainer).add(toastsContainer).removeClass('no-transition')

        // Make the hidden area interactive again
        hiddenAreaElement.find('webview').css('pointer-events', 'all')

        // Trigger the resize event for the window; to hide the tabs' titles if needed
        $(window.visualViewport).trigger('resize')
      })
    } catch (e) {}

    // Show the initialization element if needed
    try {
      // If the AI Assistant has already been initialized then skip this try-catch block
      if (!assistantContent.hasClass('not-initialized'))
        throw 0

      // Add the `loading` class
      assistantContent.addClass('_loading')

      // Point at the AI Assistant web view element
      let webviewAIAssistant = $('webview#ai_assistant_webview')[0],
        // The interval object which will hold the loading checking process
        checkLoadingInterval,
        // Number of checks so far, maximum is 30 - 30 seconds -
        count = 0

      checkLoadingInterval = setInterval(() => {
        // If the 30 seconds have been exceeded then finish this process
        if (count >= 30)
          return clearInterval(checkLoadingInterval)

        try {
          if (webviewAIAssistant.isLoading())
            throw 0

          // Remove the initialization classess
          assistantContent.removeClass('not-initialized _loading')

          // Finish the checking process
          clearInterval(checkLoadingInterval)
        } catch (e) {}

        ++count
      }, 1000)
    } catch (e) {}

    // Trigger the resize event for the window; to hide the tabs' titles if needed
    setTimeout(() => $(window.visualViewport).trigger('resize'), 400)
  })

  // Clicks the help/documentation button
  $(`${selector}[action="help"]`).click(() => {
    // Open the documentation's web page
    Open('https://axonops.com/docs/')

    // Add log for this action
    try {
      addLog(`The navigation side, opened the help/documentation web page`, 'action')
    } catch (e) {}
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
    try {
      addLog(`The navigation side, opened the notifications center section`, 'action')
    } catch (e) {}

    try {
      // If the content is already shown/visible
      if (notificationsCenterContent.is(':visible') && $('div.body').hasClass('show-hidden')) {
        // Hide the hidden area
        $('div.body').removeClass('show-hidden')

        // Hide all toasts
        toasts.removeClass('show')

        // Reset the width of each sides - hidden area and the right side -
        setTimeout(() => hiddenAreaElement.add(rightSideElement).css('width', ''))

        // Update the pinned toasts' container's position
        setTimeout(() => pinnedToastsContainer.css('left', '100px'))

        // Update the toasts' container's position
        setTimeout(() => toastsContainer.css('transform', 'translateX(0px)'))

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

      setTimeout(() => {
        // Set the latest saved width for the hidden area
        hiddenAreaElement.css('width', `${latestWidth}px`)

        // Same thing with the right side
        rightSideElement.css('width', `calc(100% - 80px - ${latestWidth}px)`)

        // Update the pinned toasts' container's position
        pinnedToastsContainer.css('left', 100 + latestWidth + 'px')

        // Update the toasts' container's position
        toastsContainer.css('transform', 'translateX(' + (latestWidth - 100) + 'px)')
      })
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

    // Trigger the resize event for the window; to hide the tabs' titles if needed
    $(window.visualViewport).trigger('resize')

    try {
      /**
       * Make the hidden area resizable
       *
       * If the flag is already set to `true` then skip this try-catch block
       */
      if (isHiddenAreaResizable)
        throw 0

      // Update the flag
      isHiddenAreaResizable = true

      // Make the hidden area resizable
      hiddenAreaElement.resizable({
        handles: 'e', // [E]ast
        minWidth: 350, // Minimum width allowed to be reached
        maxWidth: 900
        // While the resizing process is active
      }).on('resize',
        function(_, __) {
          // Make sure there's no transition effects while the resizing process is being performed
          hiddenAreaElement.add(rightSideElement).add(pinnedToastsContainer).add(toastsContainer).addClass('no-transition')

          // Applying this rule will prevent the sudden stop while the area is being resized
          hiddenAreaElement.find('webview').css('pointer-events', 'none')

          // Update the `latestWidth` value
          latestWidth = hiddenAreaElement.outerWidth()

          // Update the right side width based on the hidden area's new width
          rightSideElement.css('width', `calc(100% - 80px - ${latestWidth}px)`)

          // Update the pinned toasts' container's position
          pinnedToastsContainer.css('left', 100 + latestWidth + 'px')

          // Update the toasts' container's position
          toastsContainer.css('transform', 'translateX(' + (latestWidth - 100) + 'px)')

          // Set a timeout to trigger the `resizestop` event after set period of time
          {
            if (triggerStopTimeout != undefined)
              clearTimeout(triggerStopTimeout)

            setTimeout(() => hiddenAreaElement.trigger('resizestop'), 100)
          }

          // When the resizing process stop
        }).on('resizestop', function(_, __) {
        // Restore the transition effects
        hiddenAreaElement.add(rightSideElement).add(pinnedToastsContainer).add(toastsContainer).removeClass('no-transition')

        // Make the hidden area interactive again
        hiddenAreaElement.find('webview').css('pointer-events', 'all')

        // Trigger the resize event for the window; to hide the tabs' titles if needed
        $(window.visualViewport).trigger('resize')
      })
    } catch (e) {}
  })

  // Get the MDB objects for the settings modal, and different UI elements inside it
  let settingsModal = getElementMDBObject($('#appSettings'), 'Modal'),
    maxNumCQLSHSessionsObject = getElementMDBObject($('input#maxNumCQLSHSessions')),
    maxNumSandboxProjectsObject = getElementMDBObject($('input#maxNumSandboxProjects'))

  // Clicks the settings button
  $(`${selector}[action="settings"]`).click(() => {
    // Get the app's config/settings
    Modules.Config.getConfig(async (config) => {
      // Get different saved settings to be checked and applied on the UI
      let maxNumCQLSHSessions = config.get('limit', 'cqlsh'),
        maxNumSandboxProjects = config.get('limit', 'sandbox'),
        contentProtection = await Keytar.findPassword('AxonOpsWorkbenchContentProtection') || false,
        assistantAIEnabled = await Keytar.findPassword('AxonOpsWorkbenchAIAssistant') || false,
        loggingEnabled = config.get('security', 'loggingEnabled'),
        sandboxProjectsEnabled = config.get('features', 'sandboxProjects'),
        containersManagementTool = config.get('features', 'containersManagementTool') || 'none',
        basicCQLSHEnabled = config.get('features', 'basicCQLSH'),
        checkForUpdates = config.get('updates', 'checkForUpdates'),
        autoUpdate = config.get('updates', 'autoUpdate'),
        displayLanguage = config.get('ui', 'language')

      // Add log for this action
      try {
        addLog(`The navigation side, opened the settings dialog`, 'action')
      } catch (e) {}

      // Check the maximum number of allowed CQLSH sessions at once
      $('input#maxNumCQLSHSessions').val(!isNaN(maxNumCQLSHSessions) && maxNumCQLSHSessions > 0 ? maxNumCQLSHSessions : 10)
      setTimeout(() => maxNumCQLSHSessionsObject.update())

      // Check the maximum number of allowed sandbox projects at once
      $('input#maxNumSandboxProjects').val(!isNaN(maxNumSandboxProjects) && maxNumSandboxProjects > 0 ? maxNumSandboxProjects : 1)
      setTimeout(() => maxNumSandboxProjectsObject.update())

      // Check the content protection status
      $('input#contentProtection[type="checkbox"]').prop('checked', `${contentProtection}` == 'true').attr({
        'data-initial-status': `${contentProtection}`,
        'data-authenticated': 'false'
      })

      $('input#enableAIAssistant[type="checkbox"]').prop('checked', `${assistantAIEnabled}` == 'true').attr({
        'data-initial-status': `${assistantAIEnabled}`,
        'data-authenticated': 'false'
      })

      // Check the logging system
      $('input#loggingSystem[type="checkbox"]').prop('checked', loggingEnabled == 'true')

      $('input#checkForUpdatesOnLanuch[type="checkbox"]').prop('checked', checkForUpdates == 'true')
      $('input#autoUpdateWithNotification[type="checkbox"]').prop('checked', autoUpdate == 'true')

      // Check the sandbox projects
      $('input#sandboxProjects[type="checkbox"]').prop('checked', sandboxProjectsEnabled == 'true')

      $('div.management-tools.settings-dialog div.tool').removeClass('selected')

      try {
        containersManagementTool = (['docker', 'podman'].some((tool) => `${containersManagementTool}` == `${tool}`)) ? containersManagementTool : 'none'
      } catch (e) {}

      $(`div.management-tools.settings-dialog div.tool[tool="${containersManagementTool}"]`).addClass('selected')


      $('input#basicCQLSH[type="checkbox"]').prop('checked', basicCQLSHEnabled == 'true')

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
      setTimeout(() => ([maxNumCQLSHSessionsObject, maxNumSandboxProjectsObject]).forEach((object) => $(object._element).find('div.form-notch-middle').css('width', '111.2px')), 1000)

      // Show the settings' modal
      settingsModal.show()
    })
  })

  // Point at the `About` modal
  {
    let aboutModal = getElementMDBObject($('#appAbout'), 'Modal')

    // Show it when click the associated icon
    $(`${selector}[action="about"]`).click(() => aboutModal.show())
  }

  {
    let appUpdateModal = getElementMDBObject($('#appUpdate'), 'Modal')

    // Show it when click the associated icon
    $(`${selector}[action="update"]`).click(() => appUpdateModal.show())

    $("#appUpdate")[0].addEventListener('hidden.mdb.modal', () => $('#appSettings').css('z-index', '1055'))

    $("#appUpdate")[0].addEventListener('show.mdb.modal', () => $('#appSettings').css('z-index', '1'))

    $('button#checkNowForUpdates').click(function() {
      $(this).addClass('checking disabled')

      $(`div[check-result]`).removeClass('show')

      Store.remove('dismissUpdate')

      $(document).trigger('checkForUpdates', true)
    })

    $(`div[check-result]`).click(function() {
      if ($(this).hasClass('btn-secondary'))
        return

      appUpdateModal.show()
    })
  }

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
          try {
            addLog(`Zoom in the UI by '${zoomLevel}%'`, 'action')
          } catch (e) {}
          break
        }
        case 'zoomOut': {
          zoomLevel -= 5
          $('body').css('zoom', `${zoomLevel}%`)
          $('div.terminal-container div.terminal.xterm').trigger('changefont', 189)

          // Add log for this action
          try {
            addLog(`Zoom out the UI by '${zoomLevel}%'`, 'action')
          } catch (e) {}
          break
        }
        case 'zoomReset': {
          zoomLevel = 100
          $('body').css('zoom', `${zoomLevel}%`)
          $('div.terminal-container div.terminal.xterm').trigger('changefont', 48)

          // Add log for this action
          try {
            addLog(`Rest the zoom of the UI to '${zoomLevel}%'`, 'action')
          } catch (e) {}
          break
        }
        case 'toggleFullscreen': {
          IPCRenderer.send('options:view:toggle-fullscreen')

          // Add log for this action
          try {
            addLog(`Toggle the fullscreen mode`, 'action')
          } catch (e) {}
          break
        }
        case 'restartApp': {
          // Add log for this action
          try {
            addLog(`Restart the app`, 'action')
          } catch (e) {}

          IPCRenderer.send('options:actions:restart')
          break
        }
        case 'quitApp': {
          // Add log for this action
          try {
            addLog(`Quit the app`, 'action')
          } catch (e) {}

          IPCRenderer.send('options:actions:quit')
          break
        }
        case 'closeWorkareas': {
          // Add log for this action
          try {
            addLog(`Request to close all active work areas`, 'action')
          } catch (e) {}

          // Confirm the close of all work areas
          openDialog(I18next.capitalizeFirstLetter(I18next.t('are you sure about closing all active work areas - including local clusters - ?')), (confirm) => {
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
    setTimeout(() => {
      try {
        tinyKeys.tinykeys(window, {
          "$mod+Shift+Equal": () => actionButton.filter('[action="zoomIn"]').click(),
          "$mod+Shift+Minus": () => actionButton.filter('[action="zoomOut"]').click(),
          "$mod+Shift+Digit0": () => actionButton.filter('[action="zoomReset"]').click()
        })

        if (OS.platform() == 'darwin')
          tinyKeys.tinykeys(window, {
            "$mod+Shift+BracketRight": () => actionButton.filter('[action="zoomIn"]').click(),
            "$mod+Shift+Slash": () => actionButton.filter('[action="zoomOut"]').click(),
            "$mod+Shift+Digit9": () => actionButton.filter('[action="zoomReset"]').click()
          })

        if (OS.platform() == 'win32') {
          tinyKeys.tinykeys(window, {
            "$mod+Shift+Digit9": () => actionButton.filter('[action="zoomReset"]').click()
          })
          $(`a[action="zoomReset"]`).find('kbd[digit]').text('9')
        }
      } catch (e) {}
    }, 5000)

    $(document).on('keydown', function(e) {
      // F11 for toggling fullscreen mode
      if (e.keyCode != 122)
        return

      actionButton.filter('[action="toggleFullscreen"]').click()
    })

    $(document).on('keydown', function(e) {
      // CTRL+L to clear the enhanced terminal
      if (!e.ctrlKey || e.keyCode != 76)
        return

      let interactiveTerminal = $(`div[content="workarea"] div.workarea[cluster-id="${activeClusterID}"] div.tab-content div.tab-pane[tab="cqlsh-session"] div.interactive-terminal-container div.session-content`)

      if (interactiveTerminal.length <= 0)
        return

      try {
        if (!interactiveTerminal.is(':visible'))
          throw 0

        interactiveTerminal.children('div.block').find('div.actions div.btn[action="delete"]').click()
      } catch (e) {}
    })
  }
}

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
        Open(link)

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
        // Check the sandbox projects enable/disable status
        sandboxProjectsEnabled = $('input#sandboxProjects[type="checkbox"]').prop('checked'),
        basicCQLSHEnabled = $('input#basicCQLSH[type="checkbox"]').prop('checked'),
        assistantAIEnabled = $('input#enableAIAssistant[type="checkbox"]').prop('checked'),
        // Get the maximum allowed running instances
        maxNumCQLSHSessions = $('input#maxNumCQLSHSessions').val(),
        maxNumSandboxProjects = $('input#maxNumSandboxProjects').val(),
        checkForUpdatesOnLanuch = $('input#checkForUpdatesOnLanuch[type="checkbox"]').prop('checked'),
        autoUpdateWithNotification = $('input#autoUpdateWithNotification[type="checkbox"]').prop('checked'),
        // Get chosen display language and if it's from right to left
        [chosenDisplayLanguage, languageRTL] = getAttributes($('input#languageUI'), ['hidden-value', 'rtl']),
        containersManagementTool = 'none'

      // Set RTL class if the language needs that
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
          config.set('features', 'sandboxProjects', sandboxProjectsEnabled)
          config.set('features', 'basicCQLSH', basicCQLSHEnabled)
          config.set('features', 'containersManagementTool', containersManagementTool)
          Keytar.setPassword('AxonOpsWorkbenchAIAssistant', 'value', `${assistantAIEnabled}`)
          config.set('limit', 'cqlsh', maxNumCQLSHSessions)
          config.set('limit', 'sandbox', maxNumSandboxProjects)
          config.set('ui', 'language', chosenDisplayLanguage)
          config.set('updates', 'checkForUpdates', checkForUpdatesOnLanuch)
          config.set('updates', 'autoUpdate', autoUpdateWithNotification)

          // Set the updated settings
          Modules.Config.setConfig(config)

          updateContainersManagementToolUI(containersManagementTool)

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
    [initialStatus, isAuthenticated] = getAttributes($(this), ['data-initial-status', 'data-authenticated'])

    // Based on the given result the process may be skipped and no need for an authentication process
    if (initialStatus == ($(this).is($('input#enableAIAssistant[type="checkbox"]')) ? 'true' : 'false') || isAuthenticated != 'false')
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
    let dialog = 'div.modal#appSettings, div.modal#rightClickActionsMetadata'

    // Loop through the dropdown element of each select element
    $(`${dialog}`).find('div.dropdown[for-select]').each(function() {
      // Get the MDB object of the current dropdown element
      let selectDropdown = getElementMDBObject($(this), 'Dropdown'),
        // Point at the associated input field
        input = $(`${dialog}`).find(`input#${$(this).attr('for-select')}`)

      // Once the associated select element is being focused then show the dropdown element and vice versa
      input.on('focus', () => {
        let isInputDisabled = input.hasClass('disabled') || input.attr('disabled') != undefined

        if (isInputDisabled)
          return selectDropdown.hide()

        try {
          input.parent().find('div.invalid-feedback').addClass('transparent-color')
        } catch (e) {}

        selectDropdown.show()
      }).on('focusout', () => setTimeout(() => {
        let isInputDisabled = input.hasClass('disabled') || input.attr('disabled') != undefined

        if (isInputDisabled)
          return selectDropdown.hide()

        try {
          input.parent().find('div.invalid-feedback').removeClass('transparent-color')
        } catch (e) {}

        selectDropdown.hide()
      }, 100))

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
        try {
          errorLog(e, 'common')
        } catch (e) {}

        // The updating process failed, show feedback to the user
        return showToast(I18next.capitalize(I18next.t('ignore connection credentials')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update the connection [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')
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
                cluster.info.secrets.sshUsername = encrypt(key, credentialsArray.sshusername)

              // Save the SSH `password`
              if (credentialsArray.sshpassword.trim().length != 0)
                cluster.info.secrets.sshPassword = encrypt(key, credentialsArray.sshpassword)

              // Save the SSH `passphrase`
              if (credentialsArray.sshpassphrase.trim().length != 0)
                cluster.info.secrets.sshPassphrase = encrypt(key, credentialsArray.sshpassphrase)
            } catch (e) {
              try {
                errorLog(e, 'common')
              } catch (e) {}
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
            try {
              errorLog(e, 'common')
            } catch (e) {}

            // The updating process failed, show feedback to the user
            showToast(I18next.capitalize(I18next.t('save connection credentials')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update the connection [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

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

{
  setInterval(() => {
    $('lottie-player').each(function() {
      let lottieElement = $(this)

      try {
        // The lottie element is not visible
        if (lottieElement.isVisible())
          throw 0

        if (lottieElement.data('is-stopped') != 'true')
          lottieElement.data({
            'last-state': `${lottieElement[0].currentState}`,
            'is-stopped': 'true'
          })

        lottieElement[0].stop()
      } catch (e) {
        // The lottie element is visible
        try {
          let lastState = lottieElement.data('last-state') || 'stopped'

          if (lastState == 'stopped')
            return

          lottieElement.data('is-stopped', 'false')

          lottieElement[0].play()
        } catch (e) {}
      }
    })
  }, 500)
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

  $('div.management-tools.settings-dialog div.tool[tool]').click(function() {
    $('div.management-tools.settings-dialog div.tool').removeClass('selected')

    $(this).addClass('selected')
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
  $('div.body div.left div.content div.logo').click(() => Open(`https://axonops.com`))
}

{
  $("#actionDataDrop")[0].addEventListener('shown.mdb.modal', () => $(window.visualViewport).trigger('resize'))

  $('div.modal#actionDataDrop div.editor-container').mutate('show', () => $(window.visualViewport).trigger('resize'))
}

{
  $("#rightClickActionsMetadata")[0].addEventListener('hidden.mdb.modal', () => $("#rightClickActionsMetadata").removeClass('insertion-action'))
}
