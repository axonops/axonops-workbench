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
  $(window.visualViewport).on('resize', function(_, options = {}) {
    // Resize all created editors
    resizeEditors()

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
      let existsAxonopsTab = $('div.connection-tabs ul.nav.nav-tabs li.axonops-tab').filter(':visible').length > 0

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

      // Inside the connection's workareas, find all tabs' titles and toggle their display based on the window width
      $('div.body div.right div.content div[content="workarea"]')
        .find('div.connection-tabs ul a.nav-link span.title:not(.ignore-resize)')
        .toggle(showTabsTitles)

      // Enable/disable the work area's tabs' tooltips
      mdbObjects.filter((mdbObject) => mdbObject.element.attr('tab-tooltip') != undefined && mdbObject.element.find('span.title.ignore-resize').length <= 0).forEach((mdbObject) => mdbObject.object[!showTabsTitles ? 'enable' : 'disable']())

      if (options.ignoreLabels)
        throw 0

      // Show/hide session actions buttons
      let hideRightSideButtonsLabels = (windowWidth < 1600 || rightSideWidth < 1510),
        hideButtonsLabels = (windowWidth < 1330 || rightSideWidth < 1245)

      $('div.tab-content div.tab-pane[tab="cqlsh-session"] div.interactive-terminal-container div.session-actions').toggleClass('hide-labels-right-side', hideRightSideButtonsLabels)

      $('div.tab-content div.tab-pane[tab="cqlsh-session"] div.interactive-terminal-container div.session-actions').toggleClass('hide-labels', hideButtonsLabels)
    } catch (e) {}

    // Update the switchers' container's status
    try {
      (['workspaces', 'connections']).forEach((type) => updateSwitcherView(type))
    } catch (e) {}
  })

  let resizeEditors = () => {
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
  }
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
    try {
      Open('https://axonops.com/docs/')
    } catch (e) {}

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
      (btn.find('img.gif')).attr('src', '../assets/lottie/notification-f1.gif')

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
    maxNumSandboxProjectsObject = getElementMDBObject($('input#maxNumSandboxProjects')),
    cqlSnippetsAuthorNameObject = getElementMDBObject($('input#cqlSnippetsAuthorName'))

  let shortcutsSection = $(`div.modal-section[section="shortcuts"]`),
    listenBackdrop = shortcutsSection.find('div.listen-backdrop'),
    listenToShortcut = shortcutsSection.find(`div.listen-to-shortcut`),
    savedShortcutsContainer = shortcutsSection.find(`div.saved-shortcuts`)

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
        sandboxProjectsEnabled = config.get('features', 'localClusters'),
        containersManagementTool = config.get('features', 'containersManagementTool') || 'none',
        basicCQLSHEnabled = config.get('features', 'basicCQLSH'),
        cqlSnippetsAuthorName = config.get('features', 'cqlSnippetsAuthorName') || '',
        checkForUpdates = config.get('updates', 'checkForUpdates'),
        autoUpdate = config.get('updates', 'autoUpdate'),
        displayLanguage = config.get('ui', 'language'),
        axonOpsIntegration = config.get('features', 'axonOpsIntegration')

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

      $('input#enableAxonOpsDashboardIntegration[type="checkbox"]').prop('checked', axonOpsIntegration == 'true')

      $('input#checkForUpdatesOnLanuch[type="checkbox"]').prop('checked', checkForUpdates == 'true')
      $('input#autoUpdateWithNotification[type="checkbox"]').prop('checked', autoUpdate == 'true')

      // Check the sandbox projects
      $('input#sandboxProjects[type="checkbox"]').prop('checked', sandboxProjectsEnabled == 'true')

      $('div.management-tools.settings-dialog div.tool').removeClass('selected')

      try {
        containersManagementTool = (['docker', 'podman'].some((tool) => `${containersManagementTool}` == `${tool}`)) ? containersManagementTool : 'none'
      } catch (e) {}

      $(`div.management-tools.settings-dialog div.tool[tool="${containersManagementTool}"]`).addClass('selected').click()

      $('input#basicCQLSH[type="checkbox"]').prop('checked', basicCQLSHEnabled == 'true')

      $('input#cqlSnippetsAuthorName').val(minifyText(cqlSnippetsAuthorName).length <= 0 ? '' : cqlSnippetsAuthorName)
      setTimeout(() => cqlSnippetsAuthorNameObject.update())

      // Point to the environment variables section
      $(`div.modal#appSettings div.modal-body div.side-left div.sections div.section div.btn[section="variables"]`).click()

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

      // Load and show shortcuts
      {
        let shortcuts = Modules.Shortcuts.getShortcuts(),
          defaultShortcuts = Modules.Shortcuts.getDefaultShortcuts()

        sortItemsAlphabetically(shortcuts, 'description')

        savedShortcutsContainer.children('div.shortcut').remove()

        $(`input#shortcutsSearch`).val('').trigger('input')

        listenToShortcut.add(listenBackdrop).removeClass('show')

        $('button#setShortcut').attr('disabled', '')

        try {
          shortcutDetectorObject.stop()
        } catch (e) {}

        for (let shortcut of shortcuts) {
          let shortcutKeys = shortcut.keys[OS.platform()] || shortcut.keys['linux'],
            defaultKeys = defaultShortcuts.find((defaultShortcut) => defaultShortcut.id == shortcut.id)

          try {
            defaultKeys = defaultKeys.keys[OS.platform()] || defaultKeys.keys['linux']
          } catch (e) {}

          let element = `
            <div class="shortcut" data-shortcut-id="${shortcut.id}" data-shortcut-value="${shortcutKeys}" data-shortcut-init-value="${shortcutKeys}" data-shortcut-default-value="${defaultKeys}" data-is-uneditable="${shortcut.uneditable ? 'true' : 'false'}">
              <div class="description">
                <span mulang="${shortcut.description}" capitalize-first></span>
              </div>
              <div class="kbd">
                ${Modules.Shortcuts.getKbd(shortcutKeys, true)}
              </div>
              <div class="buttons">
                <div class="button set-shortcut">
                  <div class="btn btn-tertiary btn-sm ${shortcut.uneditable ? 'disabled' : ''}" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="right" data-title data-mulang="set a new shortcut" capitalize-first>
                    <ion-icon name="keyboard"></ion-icon>
                  </div>
                </div>
                <div class="button reset-shortcut">
                  <div class="btn btn-tertiary btn-sm disabled" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="right" data-title data-mulang="reset to saved shortcut" capitalize-first>
                    <ion-icon name="undo"></ion-icon>
                  </div>
                </div>
                <div class="button clear-shortcut">
                  <div class="btn btn-tertiary btn-sm ${shortcut.uneditable ? 'disabled' : ''}" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="right" data-title data-mulang="clear shortcut" capitalize-first>
                    <ion-icon name="close"></ion-icon>
                  </div>
                </div>
              </div>
            </div>`

          savedShortcutsContainer.append($(element).show(function() {
            let shortcutElement = $(this)

            // Detect when clicking the button to set a shortcut
            shortcutElement.find('div.set-shortcut').find('div.btn').click(function() {
              let latestShortcuts = Modules.Shortcuts.getShortcuts()

              listenToShortcut.add(listenBackdrop).addClass('show')

              listenToShortcut.data('data-shortcut-id', shortcutElement.attr('data-shortcut-id'))

              $('button#setShortcut').attr('disabled', '')

              $('#appSettings').find('button.btn-close').add($('#appSettings').find('div.side-left').find('div.btn[section]')).addClass('disabled')

              listenToShortcut.find('div.hint').show()

              listenToShortcut.removeClass('active')

              // Temporary disable all shortcuts
              for (let shortcutsObject of [...(shortcutsObjects || [])]) {
                try {
                  shortcutsObject.tinyKeys()
                } catch (e) {}
              }

              shortcutDetectorObject = Modules.Shortcuts.shortcutDetector($(document), (keys) => {
                let shortcutValue = Modules.Shortcuts.utils.keysArrayToTinyKeys(keys),
                  shortcutID = shortcutElement.attr('data-shortcut-id'),
                  // Check if there's any shortcut that has the same keys
                  duplicatedShortcut = latestShortcuts.find((shortcut) => shortcut.id != shortcutID && (shortcut.keys[OS.platform()] || shortcut.keys['linux']) == shortcutValue),
                  isShortcutFixed = false

                listenToShortcut.find(`div.shortcut-duplication-warning`).toggle(duplicatedShortcut != undefined)

                try {
                  if (duplicatedShortcut == undefined)
                    throw 0

                  let duplicatedShortcutElement = savedShortcutsContainer.find(`div.shortcut[data-shortcut-id="${duplicatedShortcut.id}"]`)

                  isShortcutFixed = duplicatedShortcutElement.attr('data-is-uneditable') == 'true'

                  listenToShortcut.find(`div.shortcut-duplication-warning`).find('span[mulang][fixed]').toggle(isShortcutFixed)
                  listenToShortcut.find(`div.shortcut-duplication-warning`).find('span[mulang][not-fixed]').toggle(!isShortcutFixed)
                } catch (e) {}

                listenToShortcut.data('duplicated-shortcut', duplicatedShortcut != undefined ? duplicatedShortcut.id : null)

                listenToShortcut.addClass('active')

                listenToShortcut.find('div.hint').hide()

                listenToShortcut.data('data-shortcut-value', shortcutValue)

                listenToShortcut.find('div.shortcut').html('').append(`${Modules.Shortcuts.getKbd(shortcutValue)}`)

                $('button#setShortcut').attr('disabled', isShortcutFixed ? '' : null)
              })
            })

            shortcutElement.find('div.reset-shortcut').find('div.btn').click(function() {
              let initValue = shortcutElement.attr('data-shortcut-init-value'),
                currentShortcuts = savedShortcutsContainer.find(`div.shortcut:not([data-shortcut-id="${shortcutElement.attr('data-shortcut-id')}"])`).get(),
                // Check if there's any shortcut that has the same keys
                duplicatedShortcut = currentShortcuts.find((shortcut) => $(shortcut).attr('data-shortcut-value') == initValue)

              if (duplicatedShortcut != undefined)
                $(duplicatedShortcut).find('div.clear-shortcut').find('div.btn').click()

              try {
                shortcutElement.attr('data-shortcut-value', initValue)

                shortcutElement.find('div.kbd').html(`${Modules.Shortcuts.getKbd(initValue, true)}`)
              } catch (e) {}

              $(this).addClass('disabled')

              shortcutElement.find('div.clear-shortcut').find('div.btn').removeClass('disabled')
            })

            shortcutElement.find('div.clear-shortcut').find('div.btn').click(function() {
              $(this).addClass('disabled')

              shortcutElement.find('div.reset-shortcut').find('div.btn').removeClass('disabled')

              shortcutElement.attr('data-shortcut-value', ``)

              shortcutElement.find('div.kbd').html(`<kbd class="not-set">NOT SET</kbd>`)
            })

            // Apply the chosen language on the UI element after being fully loaded
            setTimeout(() => setTimeout(() => Modules.Localization.applyLanguageSpecific(shortcutElement.find('span[mulang], [data-mulang]'))))
          }))
        }
      }

      // Show the settings' modal
      settingsModal.show()
    })
  })

  $(`input#shortcutsSearch`).on('input', function() {
    let searchValue = minifyText($(this).val()),
      shortcuts = savedShortcutsContainer.find(`div.shortcut`),
      isResultFound = false

    shortcuts.each(function(index) {
      let shortcutContent = minifyText($(this).text()),
        isRelated = shortcutContent.includes(searchValue)

      if (isRelated)
        isResultFound = true

      $(this).toggle(isRelated)

      if ((index + 1) >= shortcuts.length)
        savedShortcutsContainer.find(`div.no-results`).toggle(!isResultFound)
    })
  })

  $(`div.action.btn.reset-shortcuts`).click(function() {
    let shortcuts = savedShortcutsContainer.find(`div.shortcut[data-is-uneditable="false"]`)

    shortcuts.each(function() {
      let id = $(this).attr('data-shortcut-id'),
        defaultValue = $(this).attr('data-shortcut-default-value')

      try {
        $(this).attr('data-shortcut-value', defaultValue)

        $(this).find('div.kbd').html(`${Modules.Shortcuts.getKbd(defaultValue)}`)
      } catch (e) {}

      $(this).find('div.reset-shortcut').find('div.btn').add($(this).find('div.clear-shortcut').find('div.btn')).removeClass('disabled')
    })
  })

  $('button#cancelShortcut').click(function() {
    listenToShortcut.add(listenBackdrop).removeClass('show')

    $('#appSettings').find('button.btn-close').add($('#appSettings').find('div.side-left').find('div.btn[section]')).removeClass('disabled')

    Modules.Shortcuts.updateShortcutsInSession()

    setTimeout(() => {
      $('button#setShortcut').attr('disabled', '')

      listenToShortcut.find('div.hint').show()

      listenToShortcut.removeClass('active')
    }, 200)
  })

  $('button#setShortcut').click(function() {
    let targetShortcut = {
        id: listenToShortcut.data('data-shortcut-id'),
        value: listenToShortcut.data('data-shortcut-value')
      },
      shortcutElement = savedShortcutsContainer.find(`div.shortcut[data-shortcut-id="${targetShortcut.id}"]`),
      duplicatedShortcut,
      duplicatedShortcutID = listenToShortcut.data('duplicated-shortcut'),
      resetShortcutButton = shortcutElement.find('div.reset-shortcut').find('div.btn'),
      initValue = shortcutElement.attr('data-shortcut-init-value')

    try {
      shortcutElement.attr('data-shortcut-value', targetShortcut.value)

      shortcutElement.find('div.kbd').html(`${Modules.Shortcuts.getKbd(targetShortcut.value)}`)
    } catch (e) {}

    try {
      if (duplicatedShortcut)
        savedShortcutsContainer.find(`div.shortcut[data-shortcut-id="${duplicatedShortcutID}"]`).find('div.clear-shortcut').find('div.btn').click()
    } catch (e) {}

    resetShortcutButton.toggleClass('disabled', targetShortcut.value == initValue)

    $('button#cancelShortcut').click()
  })

  // Point at the `About` modal
  {
    let aboutModal = getElementMDBObject($('#appAbout'), 'Modal')

    // Show it when click the associated icon
    $(`${selector}[action="about"]`).click(() => aboutModal.show())
  }

  // Point at the `CQL Snippets` modal
  {
    let cqlSnippetsModal = getElementMDBObject($('#cqlSnippets'), 'Modal'),
      objectsTreeView = $('#cqlSnippets').find('div.side.objects-treeview'),
      snippetsListContainer = $('#cqlSnippets').find('div.side.snippets-list').find('div.cql-snippets'),
      snippetsContainer = snippetsListContainer.find('div.snippets'),
      snippetTagsContainer = $('#cqlSnippets').find('div.row.snippet-tags'),
      snippetsActionsContainer = snippetsListContainer.find('div.snippets-list-header').find('div.actions'),
      scopeBadge = $('#cqlSnippets').find('span.badge.current-scope'),
      extraIconsPath = normalizePath(Path.join(__dirname, '..', '..', 'renderer', 'js', 'external', 'jstree', 'theme', 'extra')),
      extraIcons = ['workspace', 'connection', 'keyspace', 'table'],
      // Tree view actions
      treeViewActionsContainer = objectsTreeView.find('div.treeview-actions'),
      snippetsTreeviewObject = null,
      // Flag to tell if the search container is shown already
      isSearchShown = false,
      // The timeout function to be defined for the starting the search process
      searchTimeout,
      // Define the current index of the search results
      currentIndex = 0,
      // Hold the last search results in an array
      lastSearchResults = [],
      selectedNodeID = ''

    let createSnippetElement = (snippet, callback = () => {}) => {
        try {
          let tags = ''

          try {
            tags = (snippet.attributes.tags || []).map((tag) => `<div class="tag"><ion-icon name="tag"></ion-icon><span>${tag}</span></div>`).join('')
          } catch (e) {}

          let snippetStrucutre = `
            <div class="snippet">
              <div class="checkbox">
                <input class="form-check-input" type="checkbox">
              </div>
              <div class="content">
                <div class="snippet-name">${StripTags(snippet.attributes.title)}</div>
                <div class="snippet-description">${StripTags(snippet.attributes.description)}</div>
                <div class="snippet-tags">${tags}</div>
              </div>
              <div class="actions">
                <div class="action">
                  <button action="delete" class="btn btn-tertiary btn-rounded btn-sm" data-mdb-ripple-color="light" data-confirmed="false">
                    <ion-icon name="trash"></ion-icon>
                  </button>
                </div>
              </div>
            </div>`

          snippetsContainer.prepend($(snippetStrucutre).show(function() {
            let snippetElement = $(this)

            callback(snippetElement)

            snippetElement.data('json-data', snippet)

            snippetElement.children('div.content').click(function() {
              let snippetData = snippetElement.data('json-data')

              if (!snippetElement.hasClass('active')) {
                snippetsContainer.children('div.snippet').removeClass('active')
                snippetElement.addClass('active')
              }

              // Load snippet's data in the editor
              try {
                let snippetTitle = $('input#snippetTitle')

                snippetTitle.val(`${snippetData.attributes.title}`)

                snippetTitle.trigger('input')

                getElementMDBObject(snippetTitle).update()
              } catch (e) {}

              try {
                let snippetAuthorName = $('input#snippetAuthorName')

                snippetAuthorName.val(`${snippetData.attributes.created_by}`)

                snippetAuthorName.trigger('input')

                getElementMDBObject(snippetAuthorName).update()
              } catch (e) {}

              try {
                let snippetDescription = $('textarea#snippetDescription')

                snippetDescription.val(`${snippetData.attributes.description}`)

                snippetDescription.trigger('input')

                getElementMDBObject(snippetDescription).update()
              } catch (e) {}

              try {
                let snippetTags = (snippetData.attributes.tags || [])

                snippetTagsContainer.find('div.added-tags').find('div.tag').remove()

                for (let snippetTag of snippetTags)
                  snippetTagsContainer.find('div.add-tag').find('div.btn').trigger('click', snippetTag)
              } catch (e) {}

              try {
                cqlSnippets.editor.setValue(snippetData.content)

                cqlSnippets.editor.layout()
              } catch (e) {}
            })

            // The delete button
            snippetElement.find('div.actions').find('button[action="delete"]').click(function(_, isConfirmed = false) {
              let deleteSnippet = () => {
                  Modules.Snippets.deleteSnippet(snippetPath).then((isDeleted) => {
                    if (!isDeleted)
                      return errorToast()

                    if (snippetElement.hasClass('active'))
                      $('button#updateSnippet, button#snippetRevertChanges').attr('disabled', '')

                    snippetElement.remove()

                    MD5(JSON.stringify($('#cqlSnippets').find('span.badge.current-scope').data('scope'))).then((hashedScope) => {
                      try {
                        let snippetsCounter = $(`span.snippets-counter[data-hashed-scope="${hashedScope}"]`),
                          currentCount = parseInt($(snippetsCounter[0]).find('counter').text()) || 0

                        snippetsCounter.each(function() {
                          $(this).toggleClass('show', (currentCount - 1) > 0)

                          $(this).find('counter').text(`${(currentCount - 1) || 0}`)
                        })
                      } catch (e) {}
                    })

                    let numOfSnippets = snippetsContainer.find('div.snippet').length

                    if (numOfSnippets <= 0) {
                      snippetsContainer.find('div.empty-snippets').addClass('show')
                      snippetsContainer.find('div.empty-snippets').find('div.message').addClass('show')
                      snippetsContainer.find('div.empty-snippets').find('div.loading').removeClass('show')
                    }

                  })
                },
                errorToast = () => showToast(I18next.capitalize(I18next.t('delete snippet')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to delete the snippet')) + '.', 'failure'),
                snippetPath = '',
                snippetName = ''

              try {
                snippetPath = snippetElement.data('json-data').path
              } catch (e) {}

              try {
                snippetName = snippetElement.data('json-data').attributes.title
              } catch (e) {}

              if (snippetPath == undefined || snippetPath.length <= 0)
                return errorToast()

              if (isConfirmed)
                return deleteSnippet()

              openDialog(I18next.capitalizeFirstLetter(I18next.replaceData('do you want to delete the snippet [b]$data[/b]? once you confirm, there is no undo', [(snippetName || '')])), (isConfirmed) => {
                // If canceled, or not confirmed then skip the upcoming code
                if (!isConfirmed)
                  return

                deleteSnippet()
              }, true)
            })
          }))
        } catch (e) {}
      },
      updateSnippetElement = (updateSnippetElement) => {
        try {
          let snippetData = updateSnippetElement.data('json-data')

          try {
            let tags = ''

            try {
              tags = (snippetData.attributes.tags || []).map((tag) => `<div class="tag"><ion-icon name="tag"></ion-icon><span>${tag}</span></div>`).join('')
            } catch (e) {}

            updateSnippetElement.find('div.snippet-name').text(snippetData.attributes.title)
            updateSnippetElement.find('div.snippet-description').text(snippetData.attributes.description)
            updateSnippetElement.find('div.snippet-tags').html(`${tags}`)
          } catch (e) {}
        } catch (e) {}
      }

    // Show it when click the associated icon
    $(`${selector}[action="cql-snippets"]`).click(function(_, internalData = null) {
      cqlSnippetsModal.show()

      $('button#clearSnippetFields').trigger('click')

      $('button#executeSnippet').toggle(internalData != null)

      $('button#executeSnippet').data('workareaID', internalData != null ? internalData.workareaID : null)

      $('button#createSnippet').toggleClass('btn-primary', internalData == null).toggleClass('btn-secondary', internalData != null)

      $('#cqlSnippets').find('span.badge.current-scope').html('').hide()
      $('#cqlSnippets').find('span.badge.current-scope').data('scope', null)

      $('button#createSnippet, button#executeSnippet, button#updateSnippet, button#snippetRevertChanges').attr('disabled', '')

      snippetsListContainer.find('div.empty').addClass('show')

      objectsTreeView.removeClass('searching-in-tree')

      objectsTreeView.children('div.search-in-tree').removeClass('show')

      objectsTreeView.children('div.search-in-tree').find('input').val('').trigger('input')

      objectsTreeView.addClass('loading')

      if (snippetsTreeviewObject != null)
        try {
          snippetsTreeviewObject.trigger('search.jstree', {
            nodes: []
          })

          objectsTreeView.find('div.snippets-objects-treeview').jstree('destroy')
        } catch (e) {}

      let keyspaceName = null,
        tableName = null

      try {
        keyspaceName = internalData.targetNode.keyspaceName || null
      } catch (e) {}

      try {
        tableName = internalData.targetNode.tableName || null
      } catch (e) {}

      Modules.Snippets.buildTreeView(internalData != null ? {
        connectionID: `${activeConnectionID}`,
        workspaceID: getActiveWorkspaceID()
      } : null).then(async (data) => {
        snippetsTreeviewObject = objectsTreeView.find('div.snippets-objects-treeview').jstree(data.treeStructure)

        setTimeout(() => {
          searchTimeout = null
          currentIndex = 0
          lastSearchResults = []
          isSearchShown = false

          try {
            snippetsTreeviewObject.unbind('loaded.jstree')
            snippetsTreeviewObject.unbind('open_all.jstree')
            snippetsTreeviewObject.unbind('close_all.jstree')
            snippetsTreeviewObject.unbind('init_loading_finished.jstree')
            snippetsTreeviewObject.unbind('open_node.jstree')
            snippetsTreeviewObject.unbind('search.jstree')
            snippetsTreeviewObject.unbind('refresh.jstree')
            snippetsTreeviewObject.unbind('contextmenu')
            snippetsTreeviewObject.unbind('select_node.jstree')
          } catch (e) {}

          snippetsTreeviewObject.on('loaded.jstree', () => {
            setTimeout(() => {
              cqlSnippets.loadingMetadataNodes = []

              cqlSnippets.finishedLoadingMetadataNodes = []

              cqlSnippets.treeObjectID = `tree_${getRandom.id()}`

              snippetsTreeviewObject.hide()
              snippetsTreeviewObject.jstree().open_all()
            })
          })

          let openAllNodesProcessTimeout

          snippetsTreeviewObject.on('open_all.jstree', async () => {
            try {
              clearTimeout(openAllNodesProcessTimeout)
            } catch (e) {}

            openAllNodesProcessTimeout = setTimeout(async () => {
              /**
               * Loop through each connection
               * The one that has a saved metadata will be fetched and loaded in the tree view
               */
              for (let treeConnectionInfo of data.treeConnectionsInfo) {
                connectionLatestMetadata = pathIsAccessible(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'internal_data', `metadata_${treeConnectionInfo.connectionID}.blob`)),
                  nodeElement = objectsTreeView.find(`a.jstree-anchor[id="${treeConnectionInfo.nodeID}_anchor"]`)

                if (!connectionLatestMetadata || nodeElement.length <= 0)
                  continue

                cqlSnippets.loadingMetadataNodes.push({
                  nodeID: treeConnectionInfo.nodeID,
                  workspaceNodeID: treeConnectionInfo.workspaceNodeID
                })

                Modules.Snippets.loadConnectionMetadata(treeConnectionInfo.workspaceID, treeConnectionInfo.workspaceName, treeConnectionInfo.connectionID, treeConnectionInfo.connectionName, treeConnectionInfo.nodeID, `${cqlSnippets.treeObjectID}`, internalData != null ? {
                  metadata: internalData.connectionMetadata,
                  keyspaceName: keyspaceName,
                  tableName: tableName
                } : null)
              }

              setTimeout(() => {
                snippetsTreeviewObject.show()
                snippetsTreeviewObject.jstree().close_all()
                snippetsTreeviewObject.trigger('init_loading_finished.jstree')
              })
            })
          })

          let handleMetadataLoadingSpinner = () => {
            setTimeout(() => {
              for (let finishedLoadingNodes of cqlSnippets.finishedLoadingMetadataNodes) {
                try {
                  Object.keys(finishedLoadingNodes).forEach((id) => objectsTreeView.find(`a.jstree-anchor[id="${finishedLoadingNodes[id]}_anchor"]`).removeClass('perform-process'))
                } catch (e) {}
              }

              for (let loadingNode of cqlSnippets.loadingMetadataNodes) {
                try {
                  Object.keys(loadingNode).forEach((id) => objectsTreeView.find(`a.jstree-anchor[id="${loadingNode[id]}_anchor"]`).addClass('perform-process'))
                } catch (e) {}
              }

              objectsTreeView.find('span.snippets-counter').trigger('input')
            })
          }

          snippetsTreeviewObject.on('init_loading_finished.jstree', async () => {
            let clickTargetNode = () => {
              setTimeout(() => {
                let targetNode

                if (tableName != null) {
                  try {
                    targetNode = snippetsTreeviewObject.find(`a.jstree-anchor[type="table"][object-id="${tableName}"][keyspace-id="${keyspaceName}"]`)
                  } catch (e) {}
                } else {
                  // Select a keyspace
                  if (keyspaceName != null && tableName == null) {
                    try {
                      targetNode = snippetsTreeviewObject.find(`a.jstree-anchor[type="keyspace"][object-id="${keyspaceName}"]`)
                    } catch (e) {}
                  }
                }

                try {
                  if (targetNode == undefined || targetNode.length <= 0) {
                    clickTargetNode()
                  } else {
                    targetNode.click()
                  }
                } catch (e) {

                } finally {

                }
              }, 100)
            }

            setTimeout(() => {
              objectsTreeView.removeClass('loading')

              snippetsTreeviewObject.jstree().open_node(data.workspacesParentID)

              if (keyspaceName != null || tableName != null)
                clickTargetNode()

              handleMetadataLoadingSpinner()
            }, 100)
          })

          snippetsTreeviewObject.on('refresh.jstree', async () => handleMetadataLoadingSpinner())

          snippetsTreeviewObject.on('open_node.jstree', async () => handleMetadataLoadingSpinner())

          // Once a search process is completed
          snippetsTreeviewObject.on('search.jstree', function(event, data) {
            try {
              // Reset the current index to be the first result
              currentIndex = 0

              // Hold the search results
              lastSearchResults = objectsTreeView.find('a.jstree-search')

              // Remove the click animation class from all results; to be able to execute the animation again
              lastSearchResults.removeClass('animate-click')

              // Whether or not the search container should be shown
              objectsTreeView.find('div.right-elements').toggleClass('show', data.nodes.length > 0)

              // Reset the current result where the pointer has reached
              objectsTreeView.find('div.result-count span.current').text(`1`)

              // Set the new number of results
              objectsTreeView.find('div.result-count span.total').text(`${lastSearchResults.length}`)

              // If there's at least one result for this search then attempt to click the first result
              try {
                lastSearchResults[0].click()
              } catch (e) {}
            } catch (e) {}
          })

          snippetsTreeviewObject.on('select_node.jstree', async function(event, data) {
            let nodeID = data.node.id

            if (selectedNodeID == nodeID) {
              return
            } else {
              selectedNodeID = nodeID
            }

            $('button#updateSnippet').add('button#snippetRevertChanges').attr('disabled', '')

            let nodeAttributes = data.node.a_attr,
              objectID = nodeAttributes['object-id'],
              handleSnippets = (snippets) => {
                snippetsContainer.children('div.snippet').remove()

                snippetsContainer.find('div.empty-snippets').toggleClass('show', snippets.length <= 0)

                snippetsContainer.find('div.empty-snippets').find('div.message').addClass('show')
                snippetsContainer.find('div.empty-snippets').find('div.loading').removeClass('show')

                // Order snippets based on the creation timestamp
                try {
                  snippets = snippets.sort((a, b) => a.creationTimestamp - b.creationTimestamp)
                } catch (e) {}

                for (let snippet of snippets)
                  createSnippetElement(snippet)
              },
              scopeBadgeContent = {
                names: '',
                ids: ''
              }

            // Especial state for the orphaned snippets
            snippetsActionsContainer.filter('.right-side').find('div.action').find('button[action="open-folder"]').toggleClass('hide', nodeAttributes.type == 'orphaned')

            if (nodeAttributes.type == 'orphaned')
              $('button#createSnippet').attr('disabled', '')

            snippetsListContainer.find('div.empty').removeClass('show')
            snippetsContainer.find('div.empty-snippets').addClass('show')
            snippetsContainer.find('div.empty-snippets').find('div.message').removeClass('show')
            snippetsContainer.find('div.empty-snippets').find('div.loading').addClass('show')

            switch (nodeAttributes.type) {
              case 'workspace': {
                scopeBadgeContent.names = [objectID == 'workspaces' ? 'Workspaces' : nodeAttributes['object-name']]
                scopeBadgeContent.ids = [objectID]

                Modules.Snippets.getSnippets([objectID]).then((snippets) => handleSnippets(snippets))

                break
              }
              case 'connection': {
                let workspaceID = nodeAttributes['workspace-id']

                scopeBadgeContent.names = [nodeAttributes['workspace-name'], nodeAttributes['object-name']]
                scopeBadgeContent.ids = [workspaceID, objectID]

                Modules.Snippets.getSnippets([workspaceID, objectID]).then((snippets) => handleSnippets(snippets))

                break
              }
              case 'keyspace': {
                let workspaceID = nodeAttributes['workspace-id'],
                  connectionID = nodeAttributes['connection-id']

                scopeBadgeContent.names = [nodeAttributes['workspace-name'], nodeAttributes['connection-name'], objectID]
                scopeBadgeContent.ids = [workspaceID, connectionID, objectID]

                Modules.Snippets.getSnippets([workspaceID, connectionID, objectID]).then((snippets) => handleSnippets(snippets))

                break
              }
              case 'table': {
                let workspaceID = nodeAttributes['workspace-id'],
                  connectionID = nodeAttributes['connection-id'],
                  keyspaceName = nodeAttributes['keyspace-id']

                scopeBadgeContent.names = [nodeAttributes['workspace-name'], nodeAttributes['connection-name'], keyspaceName, objectID]
                scopeBadgeContent.ids = [workspaceID, connectionID, keyspaceName, objectID]

                Modules.Snippets.getSnippets([workspaceID, connectionID, keyspaceName, objectID]).then((snippets) => handleSnippets(snippets))

                break
              }
              case 'orphaned': {
                scopeBadgeContent.names = ['Orphaned Snippets']
                scopeBadgeContent.ids = ['orphaned']

                Modules.Snippets.getSnippets(['orphaned']).then((snippets) => handleSnippets(snippets))

                break
              }
            }

            scopeBadge.data('scope', scopeBadgeContent.ids)

            $('input#snippetTitle').trigger('input')

            let scopeElements = scopeBadgeContent.names.map((name, index) => {
              let icon = extraIcons[index]

              try {
                if (icon == undefined)
                  throw 0

                if (index == 0)
                  icon = `${icon}` + (name == 'Workspaces' ? 's' : '')

                icon = `<img src="${normalizePath(Path.join(extraIconsPath, icon + '.png'))}">`
              } catch (e) {
                icon = ''
              }

              return `<span>${icon}${name}</span>`
            }).join('<ion-icon name="arrow-up-circle"></ion-icon>')

            scopeBadge.html(scopeElements).toggle(`${scopeElements}`.length > 0)
          })

          snippetsTreeviewObject.on('contextmenu', async function(event) {
            // Remove the default contextmenu created by the plugin
            $('.vakata-context').remove()

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

            let nodeType = clickedNode.attr('type')

            let contextMenu = [{
                label: I18next.capitalize(I18next.t('create a CQL snippet')),
                click: `() => views.main.webContents.send('cql:snippets:create', {
                        datacenters: 'true'
                      })`
              },
              {
                label: I18next.capitalize(I18next.t('refresh/Fetch metadata')),
                click: `() => views.main.webContents.send('cql:snippets:metadata:fetch', {
                        datacenters: 'true'
                      })`,
                visible: nodeType == 'connection'
              }
            ]

            IPCRenderer.send('show-context-menu', JSON.stringify(contextMenu))
          })
        })
      })
    })

    treeViewActionsContainer.children('div.action[action="refresh"]').children('div.btn').click(() => $(`${selector}[action="cql-snippets"]`).trigger('click'))

    treeViewActionsContainer.children('div.action[action="search"]').children('div.btn').click(function(_, overrideFlag = null) {
      // If an override flag has been passed - true/false for showing the search container - then adopt this flag
      if (overrideFlag != null)
        isSearchShown = overrideFlag

      setTimeout(() => {
        // Apply a special effect for the tree view based on the current showing status
        objectsTreeView.toggleClass('show-search-input', !isSearchShown)

        // Show or hide the search input based on the current showing status
        objectsTreeView.children('div.search-in-tree').toggleClass('show', !isSearchShown)

        objectsTreeView.toggleClass('searching-in-tree', !isSearchShown)

        // Toggle the flag
        isSearchShown = !isSearchShown

        // If the new status is to show the search input then skip the upcoming code
        if (isSearchShown)
          return

        // Empty the search value - if there's one -
        objectsTreeView.children('div.search-in-tree').find('input').val('').trigger('input')

        // Hide the navigation arrows
        objectsTreeView.children('div.search-in-tree').find('div.right-elements').removeClass('show')
      })
    })

    // When the user types in the search input
    objectsTreeView.children('div.search-in-tree').find('input').on('input', function() {
      // Make sure to clear any ongoing timeout processes
      if (searchTimeout != null)
        clearTimeout(searchTimeout)

      /**
       * Perform a search process after a set time of finish typing
       * This delay will avoid any potential performance issues
       */
      searchTimeout = setTimeout(() => {
        try {
          let searchValue = $(this).val()

          snippetsTreeviewObject.jstree(true).search(searchValue, true, false)

          if (minifyText(searchValue).length <= 0)
            snippetsTreeviewObject.trigger('search.jstree', {
              nodes: []
            })
        } catch (e) {}
      }, 500)
    })

    objectsTreeView.children('div.search-in-tree').find('div.right-elements').find('div.btn').click(function() {
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
        objectsTreeView.find('div.result-count span.current').text(`${currentIndex + 1}`)

        // Attempt to click the reached result
        lastSearchResults[currentIndex].click()

        // Remove the click animation class from the reached result
        $(lastSearchResults[currentIndex]).removeClass('animate-click')

        // Add the click animation class to the reached result
        setTimeout(() => $(lastSearchResults[currentIndex]).addClass('animate-click'), 50)
      } catch (e) {}
    })

    snippetsActionsContainer.filter('.right-side').find('div.action').find('button').click(function() {
      let action = `${$(this).attr('action')}`

      switch (action) {
        case 'open-folder': {
          Modules.Snippets.getSnippets((scopeBadge.data('scope') || []), true).then((snippetsPath) => {
            try {
              Open(snippetsPath)
            } catch (e) {}
          })

          break
        }
      }
    })

    snippetsActionsContainer.filter('.left-side').find('a.btn').click(function() {
      let action = $(this).attr('action')

      switch (action) {
        case 'delete': {
          let selectedSnippets = snippetsContainer.find('div.snippet').filter(function() {
            let isSnippetSelected = $(this).find('div.checkbox').find('input[type="checkbox"]').prop('checked')

            return isSnippetSelected
          })

          if (selectedSnippets.length <= 0)
            return


          openDialog(I18next.capitalizeFirstLetter(I18next.t('do you want to delete the selected snippet(s)? once you confirm, there is no undo')), (isConfirmed) => {
            // If canceled, or not confirmed then skip the upcoming code
            if (!isConfirmed)
              return

            selectedSnippets.each(function() {
              $(this).find('div.actions').find('button[action="delete"]').trigger('click', true)
            })
          }, true)

          break
        }
      }
    })

    snippetsListContainer.find('div.search-snippet').find('input[type="text"]').on('input', function() {
      let searchText = `${$(this).val()}`.toLowerCase(),
        snippets = snippetsContainer.find('div.snippet'),
        isMatchedSnippetFound = false

      if (searchText.length <= 0)
        snippets.show()

      for (let snippet of snippets.get()) {
        try {
          let metadata = $(snippet).find('div.content').text().toLowerCase(),
            content = $(snippet).data('json-data').content.toLowerCase(),
            searchContent = `${metadata} ${content}`,
            isSnippetMatch = searchContent.indexOf(searchText) != -1

          if (isSnippetMatch)
            isMatchedSnippetFound = true

          $(snippet).toggle(isSnippetMatch)
        } catch (e) {}
      }
    })

    {
      snippetTagsContainer.find('div.add-tag').find('input[type="text"]').on('input', function() {
        let tag = $(this).val()

        if (tag.length <= 0) {
          $(this).removeClass('is-invalid')

          snippetTagsContainer.find('div.add-tag').find('div.btn').addClass('disabled')

          return
        }

        if (tag.match(/^#?[^\s!@#$%^&*()=+./,\[{\]};:'"?><]+$/) == null || snippetTagsContainer.find('div.added-tags').find(`div.tag[data-tag="${tag}"]`).length != 0) {
          $(this).addClass('is-invalid')

          snippetTagsContainer.find('div.add-tag').find('div.btn').addClass('disabled')

          return
        }

        $(this).removeClass('is-invalid')

        snippetTagsContainer.find('div.add-tag').find('div.btn').removeClass('disabled')
      }).on('keypress', function(e) {
        // Enter key pressed
        if (e.keyCode == 13)
          snippetTagsContainer.find('div.add-tag').find('div.btn').click()
      })

      snippetTagsContainer.find('div.add-tag').find('div.btn').click(function(_, tagName = null) {
        if (tagName == null && ($(this).hasClass('disabled') || snippetTagsContainer.find('div.add-tag').find('input[type="text"]').hasClass('is-invalid')))
          return

        let tag = (tagName || snippetTagsContainer.find('div.add-tag').find('input[type="text"]').val())

        let tagElement = `
            <div class="tag" data-tag="${tag}">
              <div class="btn btn-tertiary" data-mdb-ripple-color="light">
                <ion-icon name="close"></ion-icon>
                <ion-icon name="tag"></ion-icon>
                <span>${tag}</span>
              </div>
            </div>`

        snippetTagsContainer.find('div.added-tags').append($(tagElement).show(function() {
          snippetTagsContainer.find('div.add-tag').css('margin-left', '10px')

          if (tagName == null)
            snippetTagsContainer.find('div.add-tag').find('input[type="text"]').val('').trigger('input').trigger('focus')

          setTimeout(() => {
            try {
              snippetTagsContainer.find('div.added-tags')[0].scrollTo(snippetTagsContainer.find('div.added-tags')[0].scrollWidth, 0)
            } catch (e) {}
          })

          $(this).click(function() {
            $(this).remove()

            snippetTagsContainer.find('div.add-tag').css('margin-left', snippetTagsContainer.find('div.added-tags').find('div.tag').length <= 0 ? '0px' : '10px')
          })
        }))
      })
    }

    $('button#createSnippet').click(function() {
      let snippetMetadata = {
          title: $('input#snippetTitle').val(),
          description: $('textarea#snippetDescription').val(),
          tags: '',
          created_by: $('input#snippetAuthorName').val(),
          created_date: new Date().getTime(),
          last_modified: new Date().getTime(),
          associated_with: ''
        },
        snippetScope = $('#cqlSnippets').find('span.badge.current-scope').data('scope'),
        snippetContent = ''

      if (snippetScope == null)
        return showToast(I18next.capitalize(I18next.t('create snippet')), I18next.capitalizeFirstLetter(I18next.t('to create a snippet, please click an object in the tree view so that the snippet can be associated with it, then try again')) + '.', 'failure')

      try {
        snippetContent = cqlSnippets.editor.getValue()
      } catch (e) {}

      Modules.Snippets.getSnippets(snippetScope, true).then((snippetFolderPath) => {
        // Get added tags
        try {
          let addedTags = snippetTagsContainer.find('div.added-tags').find('div.tag')

          if (addedTags.length <= 0)
            throw 0

          snippetMetadata.tags = [...addedTags.get()].map((tagElement) => $(tagElement).attr('data-tag'))
        } catch (e) {}

        // Set the snippet scope
        try {
          // If it's only a workspace snippet - or global - then no need to set the scope
          if (snippetScope.length > 1)
            snippetMetadata.associated_with = [...snippetScope.slice(1)]
        } catch (e) {}

        Modules.Snippets.createSnippet(snippetMetadata, snippetContent, snippetFolderPath).then((result) => {
          if (!result.isCreated)
            return showToast(I18next.capitalize(I18next.t('create snippet')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to create the snippet')) + '.', 'failure')

          showToast(I18next.capitalize(I18next.t('create snippet')), I18next.capitalizeFirstLetter(I18next.replaceData('the snippet has been successfully created with a file name [b]$data[/b]', [result.fileName])) + '.', 'success')

          MD5(JSON.stringify(snippetScope)).then((hashedScope) => {
            try {
              let snippetsCounter = $(`span.snippets-counter[data-hashed-scope="${hashedScope}"]`),
                currentCount = parseInt($(snippetsCounter[0]).find('counter').text()) || 0

              snippetsCounter.each(function() {
                $(this).addClass('show')

                $(this).find('counter').text(`${currentCount + 1}`)
              })
            } catch (e) {}
          })

          createSnippetElement({
            ...result.snippet,
            content: result.snippet.body,
            path: result.path,
            creationTimestamp: new Date(result.snippet.attributes.created_date).getTime()
          }, (snippetElement) => {
            snippetsContainer.find('div.empty-snippets').removeClass('show')

            setTimeout(() => snippetElement.find('div.content').click())
          })
        })
      })
    })

    $('button#executeSnippet').click(function() {
      let workareaElement = $(`div.workarea[workarea-id="${$(this).data('workareaID')}"]`)

      if (workareaElement.length <= 0)
        return showToast(I18next.capitalize(I18next.t('execute snippet')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to execute the snippet')) + '.', 'failure')

      let cqlContent = cqlSnippets.editor.getValue()

      try {
        workareaElement.find(`textarea[data-role="cqlsh-textarea"]`).val(cqlContent)

        workareaElement.find(`textarea[data-role="cqlsh-textarea"]`).trigger('input')
      } catch (e) {}

      try {
        getElementMDBObject(workareaElement.find(`a.nav-link.btn[tab-content="cqlsh-session"]`), 'Tab').show()
      } catch (e) {}

      cqlSnippetsModal.hide()

      workareaElement.find('div.execute').find('button.btn').click()
    })

    $('button#updateSnippet').click(function() {
      let activeSnippetElement = snippetsContainer.children('div.snippet.active')

      if (activeSnippetElement.length <= 0)
        return showToast(I18next.capitalize(I18next.t('update snippet')), I18next.capitalizeFirstLetter(I18next.t('to update a snippet, please click one from the list, then try again')) + '.', 'failure')

      let snippetMetadata = {
          title: $('input#snippetTitle').val(),
          description: $('textarea#snippetDescription').val(),
          tags: '',
          created_by: $('input#snippetAuthorName').val(),
          last_modified: new Date()
        },
        snippetFilePath = '',
        snippetContent = ''

      try {
        snippetFilePath = activeSnippetElement.data('json-data').path
      } catch (e) {}

      if (snippetFilePath == undefined || snippetFilePath.length <= 0)
        return showToast(I18next.capitalize(I18next.t('create snippet')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to update the snippet')) + '.', 'failure')

      try {
        snippetContent = cqlSnippets.editor.getValue()
      } catch (e) {}

      // Get added tags
      try {
        let addedTags = snippetTagsContainer.find('div.added-tags').find('div.tag')

        if (addedTags.length <= 0)
          throw 0

        snippetMetadata.tags = [...addedTags.get()].map((tagElement) => $(tagElement).attr('data-tag'))
      } catch (e) {}

      let finalSnippetData = {}

      try {
        let snippetSavedMetadata = activeSnippetElement.data('json-data'),
          temp = {}

        temp = {
          ...snippetSavedMetadata
        }

        temp.attributes.title = snippetMetadata.title
        temp.attributes.description = snippetMetadata.description
        temp.attributes.tags = snippetMetadata.tags
        temp.attributes.created_by = snippetMetadata.created_by
        temp.attributes.last_modified = snippetMetadata.last_modified

        temp.content = snippetContent

        finalSnippetData = {
          ...temp
        }
      } catch (e) {}

      Modules.Snippets.updateSnippet(finalSnippetData).then((result) => {
        if (!result.isUpdated)
          return showToast(I18next.capitalize(I18next.t('update snippet')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to update the snippet')) + '.', 'failure')

        showToast(I18next.capitalize(I18next.t('update snippet')), I18next.capitalizeFirstLetter(I18next.t('the snippet has been successfully updated')) + '.', 'success')

        updateSnippetElement(activeSnippetElement)
      })
    })

    $('button#snippetRevertChanges').click(() => snippetsContainer.children('div.snippet.active').find('div.content').trigger('click'))

    $('button#clearSnippetFields').click(function() {
      Modules.Config.getConfig((config) => {
        let authorName = config.get('features', 'cqlSnippetsAuthorName')

        try {
          if (authorName == undefined || minifyText(authorName).length <= 0)
            authorName = OS.userInfo().username
        } catch (e) {
          authorName = ''
        }

        $(`input#snippetAuthorName`).val(authorName)

        setTimeout(() => {
          try {
            getElementMDBObject($(`input#snippetAuthorName`)).update()
          } catch (e) {}
        })
      })

      $('button#createSnippet, button#executeSnippet, button#updateSnippet, button#snippetRevertChanges').attr('disabled', '')

      $('input#snippetTitle').val('')

      try {
        getElementMDBObject($('input#snippetTitle')).update()
      } catch (e) {}

      $('textarea#snippetDescription').val('')

      try {
        getElementMDBObject($('textarea#snippetDescription')).update()
      } catch (e) {}

      try {
        cqlSnippets.editor.setValue('')

        cqlSnippets.editor.layout()
      } catch (e) {}

      {
        snippetTagsContainer.find('div.added-tags').find('div.tag').remove()

        snippetTagsContainer.find('div.add-tag').css('margin-left', '0px')

        snippetTagsContainer.find('div.add-tag').find('input[type="text"]').val('').trigger('input')
      }

      snippetsContainer.children('div.snippet').removeClass('active')
    })

    $('input#snippetTitle, input#snippetAuthorName, textarea#snippetDescription').on('input', () => {
      let editorContent = minifyText(cqlSnippets.editor.getValue()),
        areFieldsValuesValid = ['input#snippetTitle', 'input#snippetAuthorName', 'textarea#snippetDescription'].every((inputField) => minifyText($(inputField).val()).length > 0)

      if (editorContent.length <= 0 || !areFieldsValuesValid)
        return $('button#createSnippet, button#executeSnippet, button#updateSnippet, button#snippetRevertChanges').attr('disabled', '')

      if (editorContent.length > 0 && areFieldsValuesValid) {
        let isOrphanedList = ($('#cqlSnippets').find('span.badge.current-scope').data('scope') || [])[0] == 'orphaned'

        $(`${!isOrphanedList ? 'button#createSnippet, ' : ''}button#executeSnippet`).attr('disabled', null)

        let editingMode = snippetsListContainer.find('div.snippet.active').length > 0

        $('button#updateSnippet, button#snippetRevertChanges').attr('disabled', !editingMode ? '' : null)
      }
    })
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

  {
    $("#appSettings")[0].addEventListener('hidden.mdb.modal', () => {
      try {
        shortcutDetectorObject.stop()
      } catch (e) {}
    })
  }

  // Handle the click of items in more options/settings menu
  {
    // Point at the items
    let actionButton = $(`div.dropdown.more-actions ul.dropdown-menu li a.dropdown-item`),
      // Set the zoom level - initially 100% -
      zoomLevel = parseInt(Store.get('zooming')) || 100

    if (zoomLevel != 100)
      $('body').css('zoom', `${zoomLevel}%`)

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

          // Store the value as it'll be applied in the next launch
          Store.set('zooming', zoomLevel)

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

          // Store the value as it'll be applied in the next launch
          Store.set('zooming', zoomLevel)

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

          // Store the value as it'll be applied in the next launch
          Store.set('zooming', zoomLevel)

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

    setTimeout(() => {
      try {
        Modules.Shortcuts.updateKbdElements()
      } catch (e) {}
    })

    // Listen to key presses in relation to the more options/settings shortcuts
    setTimeout(() => {
      let searchModalObject = getElementMDBObject($("#searchConnections"), 'Modal')

      try {
        Modules.Shortcuts.setShortcutInSession(window, 'zoom-in', () => actionButton.filter('[action="zoomIn"]').click())

        Modules.Shortcuts.setShortcutInSession(window, 'zoom-out', () => actionButton.filter('[action="zoomOut"]').click())

        Modules.Shortcuts.setShortcutInSession(window, 'zoom-reset', () => actionButton.filter('[action="zoomReset"]').click())

        Modules.Shortcuts.setShortcutInSession(window, 'connections-search', () => {
          try {
            let searchConnectionsButtonContainer = $('div.body div.right div.content-info div._right div.action[action="search"]')

            if (!searchConnectionsButtonContainer.is(':visible') || searchModalObject._isShown)
              return

            searchConnectionsButtonContainer.find('button.btn').trigger('click')
          } catch (e) {}
        })
      } catch (e) {}

      // CTRL+L to clear the enhanced terminal
      Modules.Shortcuts.setShortcutInSession(document, 'enhanced-console-clear', () => $(document).trigger('clearEnhancedConsole'))
    }, 5000)

    $(document).on('keydown', function(e) {
      /**
       * `F11` for toggling fullscreen mode
       * This shortcut is fixed
       */
      if (e.keyCode != 122)
        return

      actionButton.filter('[action="toggleFullscreen"]').click()
    })

    $(document).on('clearEnhancedConsole', () => {
      let interactiveTerminal = $(`div[content="workarea"] div.workarea[connection-id="${activeConnectionID}"] div.tab-content div.tab-pane[tab="cqlsh-session"] div.interactive-terminal-container div.session-content`)

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
  $("#extraDataActions")[0].addEventListener('shown.mdb.modal', () => $(window.visualViewport).trigger('resize'))

  $('div.modal#extraDataActions div.editor-container').observeVisibility(() => $(window.visualViewport).trigger('resize'))
}

{
  $("#cqlSnippets")[0].addEventListener('shown.mdb.modal', () => $(window.visualViewport).trigger('resize'))
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
