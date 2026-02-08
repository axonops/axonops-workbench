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
