{

  let updateActionStatusForInsertRow,
    updateActionStatusForDeleteRowColumn,
    updateActionStatusForSelectRowColumn,
    getAllPrimaryKeyColumns,
    changeFooterButtonsStateTimeout

  // Handle the request of getting a CQL description of the connection, keyspace in it, or a table
  {
    IPCRenderer.on('cql-desc:get', (_, data) => {
      // Define a portion of the common CSS selector
      let selector = `div.body div.right div.content div[content]`,
        // Point at the associated connection's UI element
        connectionElement = $(`${selector}[content="connections"] div.connections-container div.connection[data-id="${data.connectionID}"]`),
        // Point at the associated connection's work area UI element
        workareaElement = $(`${selector}[content="workarea"] div.workarea[connection-id="${data.connectionID}"]`),
        // Point at the CQL description's tab's content - main container -
        cqlDescriptionsTabContent = workareaElement.find('div.sub-sides div.tab-content div.tab-pane[tab="cql-description"]'),
        // Point at the CQL descriptions' elements container
        cqlDescriptionsContainer = cqlDescriptionsTabContent.find('div.descriptions-container div.descriptions'),
        // Point at the CQL description tab - navigation tab -
        cqlDescriptionTab = $(`a.nav-link.btn[href="#_${data.tabID}"]`),
        // Get the cql descriptions' tab MDB object
        cqlDescriptionTabObject = getElementMDBObject(cqlDescriptionTab, 'Tab'),
        // Flag to tell if the description has been fetched already or not - no need to perform the same actions for the same request -
        isDescriptionFetched = false,
        // Point at the clicked node
        clickedNode = $(`#${data.nodeID}`)

      // Add the processing class
      clickedNode.addClass('perform-process')

      // Get the CQL description based on the passed scope
      Modules.Connections.getCQLDescription(data.connectionID, data.scope, (description) => {
        // As the description has been received remove the processing class
        clickedNode.removeClass('perform-process')

        // If the description has been fetched already then skip this process
        if (isDescriptionFetched)
          return

        // Update the flag
        isDescriptionFetched = true

        try {
          if (data.saveAsFile == undefined)
            throw 0

          // keyspace_cyclingtable_products_2024-11-14_203041
          let descriptionScope = data.scope.replace(/>/gm, '-').replace('table-', '-table-'),
            descriptionFileName = Sanitize(`${descriptionScope}-${formatTimestamp(new Date().getTime(), true)}.cql`).replace(/\s+/gm, '_') || 'cql_desc.cql'

          try {
            descriptionFileName = Path.join(getWorkspaceFolderPath(getActiveWorkspaceID()), connectionElement.attr('data-folder'), descriptionFileName)
          } catch (e) {}

          let dialogID = getRandom.id(5),
            dialogData = {
              id: dialogID,
              title: I18next.capitalize(I18next.t('save CQL description')),
              properties: ['showHiddenFiles', 'createDirectory', 'promptToCreate'],
              defaultPath: descriptionFileName,
              type: 'showSaveDialog'
            }

          IPCRenderer.send('dialog:create', dialogData)

          IPCRenderer.on(`dialog:${dialogID}`, (_, path) => {
            path = `${path}`

            try {
              IPCRenderer.removeAllListeners(`dialog:${dialogID}`)
            } catch (e) {}

            try {
              if (path.length <= 0)
                throw 0

              if (!pathIsAccessible(Path.join(path, '..'))) {
                showToast(I18next.capitalize(I18next.t('save CQL description')), I18next.capitalizeFirstLetter(I18next.t('the selected path is inaccessible and can\'t be used, please make sure you have read/write permissions')) + '.', 'failure')

                throw 0
              }

              let descriptionSize = Bytes(ValueSize(description))

              FS.writeFile(path, description, (err) => {
                if (err)
                  return showToast(I18next.capitalize(I18next.t('save CQL description')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to save the CQL description')) + `. ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${err}` + '.', 'failure')

                showToast(I18next.capitalize(I18next.t('save CQL description')), I18next.capitalizeFirstLetter(I18next.replaceData('the cql description has been successfully saved as a text file, the size is $data', [descriptionSize])) + '.', 'success')
              })
            } catch (e) {}
          })

          return
        } catch (e) {}

        // The CQL description's tab's container is not empty now, and make sure to clear the empty the search input field
        cqlDescriptionsTabContent.removeClass('_empty').find('input').val('').trigger('input')

        // Show the tab's content automatically
        setTimeout(() => cqlDescriptionTabObject.show(), 250)

        /**
         * Trigger the `resize` event for the entire window
         * This will resize all editors
         */
        setTimeout(() => $(window.visualViewport).trigger('resize'), 260)

        // Check if there's an associated CQL description
        let associatedDescription = cqlDescriptionsContainer.find(`div.description[data-scope="${data.scope}"]`),
          // Manipulate the scope to be set in the badge
          scope = data.scope == 'cluster' ? `Cluster: ${getAttributes(connectionElement, 'data-name')}` : ''

        try {
          // If the scope's length after the manipulation is not `0` then it's a `cluster` scope and this try-catch block may be skipped
          if (scope.length != 0)
            throw 0

          // Manipulate the scope
          scope = data.scope.replace(/\s*\>\s*/gm, ': ')
            .replace(/keyspace:/gm, 'Keyspace: ')
            .replace(/table:/gm, '<span class="dot"></span> Table: ')
            .replace(/\s+/gm, ' ')
        } catch (e) {}

        try {
          // If there's no associated description then skip this try-catch block
          if (associatedDescription.length <= 0)
            throw 0

          setTimeout(() => {
            // Add the scope in the search input field and trigger the `input` event
            cqlDescriptionsTabContent.find('input').val(StripTags(scope)).trigger('input')

            // Get the description's editor's object
            let editorObject = monaco.editor.getEditors().find((editor) => associatedDescription.find('div.editor').is(editor._domElement))

            // Update the editor's content with the latest fetched description
            editorObject.setValue(OS.EOL + OS.EOL + `${description}`)
          })

          // Skip the upcoming code
          return
        } catch (e) {}

        // Get a random ID for the description's editor's container
        let editorContainerID = getRandom.id(10)

        // Description's UI element structure
        let element = `
            <div class="description" data-scope="${data.scope}">
              <div class="sticky-header">
                <span class="badge rounded-pill badge-secondary description-scope">
                  <a href="#_${editorContainerID}">${scope}</a>
                </span>
                <div class="close-description">
                  <button type="button" class="btn btn-sm btn-tertiary close-description" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="left" data-mulang="close description" capitalize data-title>
                    <ion-icon name="close"></ion-icon>
                  </button>
                </div>
              </div>
              <div class="inner-content">
                <div class="editor" id="_${editorContainerID}"></div>
              </div>
              <div class="expand-editor">
                <button type="button" class="btn btn-sm btn-tertiary expand-editor" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="right" data-mulang="expand editor" capitalize data-title>
                  <ion-icon name="arrow-left"></ion-icon>
                </button>
              </div>
            </div>`

        // Prepend the description's UI element to the container
        cqlDescriptionsContainer.prepend($(element).show(function() {
          // Handle the expandation/shrinking button's different actions and events listeners
          setTimeout(() => {
            // Point at the description UI element
            let main = $(this),
              // Hold the original height of the description before any manipulation
              originalHeight = main.actual('height', {
                absolute: true
              }),
              // Point at the expandation/shrinking button
              expandBtnElement = $(this).find('button.expand-editor'),
              closeDescriptionBtnElement = $(this).find('button.close-description'); // This semicolon is critical here

            // Create a tooltip object for the button
            getElementMDBObject(expandBtnElement, 'Tooltip')
            getElementMDBObject(closeDescriptionBtnElement, 'Tooltip')

            // Once the button is clicked
            expandBtnElement.click(function() {
              // Whether or not the description's UI element has already been expanded
              let isAlreadyExpanded = $(this).hasClass('shrink')

              // Toggle the `shrink` class for the button based on the flag
              $(this).toggleClass('shrink', !isAlreadyExpanded)

              // If the original height hasn't been fetched then fetch it now
              if (originalHeight <= 0)
                originalHeight = main.actual('height', {
                  absolute: true
                })

              try {
                // If the description's UI element is not expanded already then skip this try-catch block
                if (!isAlreadyExpanded)
                  throw 0

                // Set the original height
                main.css('height', `${originalHeight}px`)

                /**
                 * After a set period of time set `height` to be `auto`
                 * This is useful in case the app's main window has been resized
                 */
                setTimeout(() => main.css('height', `auto`), 210)

                // Skip the upcoming code
                return
              } catch (e) {}

              // Set the original height
              main.css('height', `${originalHeight}px`)

              /**
               * Reaching here means the description's UI element has to be expanded
               *
               * Get the descriptions' container's height
               */
              let descriptionsContainerHeight = main.parent().actual('height')

              // Set the new height of the description's UI element
              main.css('height', `${descriptionsContainerHeight - 38}px`)

              // Click the attached anchor in the description's UI element
              setTimeout(() => $(main).find('a')[0].click(), 210)
            })

            closeDescriptionBtnElement.click(function() {
              main.remove()

              if (cqlDescriptionsContainer.children('div.description').length <= 0)
                cqlDescriptionsTabContent.addClass('_empty').find('input').trigger('input')
            })

            // Click the expandation button
            setTimeout(() => expandBtnElement.click(), 100)
          })

          setTimeout(() => {
            // Create an editor for the description
            let descriptionEditor = monaco.editor.create($(`#_${editorContainerID}`)[0], {
              value: `${description}`,
              language: 'sql', // Set the content's language
              minimap: {
                enabled: true
              },
              padding: {
                top: 35
              },
              readOnly: true,
              glyphMargin: false,
              suggest: {
                showFields: false,
                showFunctions: false
              },
              theme: 'vs-dark',
              scrollBeyondLastLine: false,
              mouseWheelZoom: true,
              fontSize: 12,
              fontFamily: "'Terminal', 'Minor', 'SimplifiedChinese', monospace",
              fontLigatures: true
            })

            /**
             * Make sure the editor's dimensions are correct
             * Set a counter with an initial value
             */
            let count = 0,
              // Create an interval that will be cleared after 5 executes
              updateEditorLayout = setInterval(() => {
                // After 5 executes
                if (count >= 5) {
                  /**
                   * Create a multiple resize observers for the work area body element
                   * By doing this the editor's dimensions will always fit with its parent container
                   *
                   * Create observer for the work area overall
                   */
                  setTimeout(() => {
                    (new ResizeObserver(() => {
                      try {
                        descriptionEditor.layout()
                      } catch (e) {}
                    })).observe(workareaElement[0]); // This semicolon is critical here

                    // Create observer for the description's UI element
                    (new ResizeObserver(() => {
                      try {
                        descriptionEditor.layout()
                      } catch (e) {}
                    })).observe($(this)[0])
                  })

                  // Clear the interval
                  clearInterval(updateEditorLayout)
                }

                // Update the editor's layout/dimensions
                descriptionEditor.layout(); // This semicolon is critical here

                // Increase the counter
                ++count
              }, 100)
          })

          // Apply the chosen language on the UI element after being fully loaded
          setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
        }))
      })
    })

    {
      IPCRenderer.on('create-keyspace', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

        $('div.modal#rightClickActionsMetadata div[action]').hide()
        $('div.modal#rightClickActionsMetadata div[action="keyspaces"]').show()

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'create keyspace').text(I18next.capitalize(I18next.t('create keyspace')))

        $('#rightClickActionsMetadata').attr('data-state', null)

        $('input#keyspaceReplicationStrategy').attr('data-datacenters', `${data.datacenters}`)

        try {
          $('#rightClickActionsMetadata').attr('data-keyspaces', `${data.keyspaces}`)
        } catch (e) {}

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('input#keyspaceReplicationStrategy').attr('disabled', null).css('background-color', 'inherit')

        $('input#keyspaceReplicationStrategy').parent().children('ion-icon.trailing').show()

        $('input#keyspaceName').val('').trigger('input')

        $('input#keyspaceReplicationStrategy').val('NetworkTopologyStrategy').trigger('input')

        $('input#keyspaceReplicationFactorSimpleStrategy').val(1).trigger('input')

        $('input#keyspaceDurableWrites').prop('checked', true)

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        rightClickActionsMetadataModal.show()
      })

      IPCRenderer.on('alter-keyspace', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal'),
          metadataInfo = JSON.parse(repairJSONString($('#rightClickActionsMetadata').attr('data-keyspace-info')))

        $('div.modal#rightClickActionsMetadata div[action]').hide()
        $('div.modal#rightClickActionsMetadata div[action="keyspaces"]').show()

        try {
          metadataInfo.replication_strategy = JSON.parse(repairJSONString(metadataInfo.replication_strategy))
        } catch (e) {}

        try {
          $('#rightClickActionsMetadata').attr('data-keyspaces', `${data.keyspaces}`)
        } catch (e) {}

        try {
          $('#generalPurposeDialog').attr('data-keyspacename', `${data.keyspaceName}`)
        } catch (e) {}

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'alter keyspace').text(I18next.capitalize(I18next.t('alter keyspace')))

        $('#rightClickActionsMetadata').attr('data-state', 'alter')

        $('input#keyspaceReplicationStrategy').attr('data-datacenters', `${data.datacenters}`)

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('input#keyspaceName').val(`${metadataInfo.name}`).trigger('input')

        $('input#keyspaceReplicationStrategy').val(`${metadataInfo.replication_strategy.class}`).trigger('input')

        try {
          if (`${metadataInfo.replication_strategy.class}` != 'SimpleStrategy')
            throw 0

          $('#rightClickActionsMetadata').attr('data-rf', `${metadataInfo.replication_strategy.replication_factor}`)

          $('input#keyspaceReplicationFactorSimpleStrategy').val(metadataInfo.replication_strategy.replication_factor).trigger('input')

          $('#rightClickActionsMetadata').attr('data-datacenters-rf', null)

          $('input#keyspaceReplicationStrategy').attr('disabled', null).css('background-color', 'inherit')

          $('input#keyspaceReplicationStrategy').parent().children('ion-icon.trailing').show()
        } catch (e) {}

        try {
          if (`${metadataInfo.replication_strategy.class}` != 'NetworkTopologyStrategy')
            throw 0

          $('#rightClickActionsMetadata').attr('data-datacenters-rf', `${JSON.stringify(metadataInfo.replication_strategy)}`)

          $('#rightClickActionsMetadata').attr('data-rf', null)

          $('input#keyspaceReplicationStrategy').attr('disabled', '').css('background-color', '')

          $('input#keyspaceReplicationStrategy').parent().children('ion-icon.trailing').hide()
        } catch (e) {}

        $('input#keyspaceDurableWrites').prop('checked', metadataInfo.durable_writes)
        $('input#keyspaceDurableWrites').attr('set-value', metadataInfo.durable_writes)

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        rightClickActionsMetadataModal.show()
      })

      IPCRenderer.on('drop-keyspace', (_, data) => {
        let keyspaceName = addDoubleQuotes(`${data.keyspaceName}`),
          dropKeyspaceEditor = monaco.editor.getEditors().find((editor) => $(`div.modal#extraDataActions .editor`).find('div.monaco-editor').is(editor.getDomNode()))

        $(`div.modal#extraDataActions div.editor-container`).removeClass('truncate')

        if (minifyText(keyspaceName).length <= 0)
          return

        try {
          $('#generalPurposeDialog').attr('data-keyspacename', `${keyspaceName}`)
        } catch (e) {}

        let dropStatement = `DROP KEYSPACE ${keyspaceName};`

        try {
          dropKeyspaceEditor.setValue(dropStatement)
        } catch (e) {}

        setTimeout(() => $(window.visualViewport).trigger('resize'), 100)

        openExtraDataActionsDialog(I18next.capitalizeFirstLetter(I18next.replaceData(`are you sure you want to drop the keyspace [b]$data[/b]? This action is irreversible`, [keyspaceName])) + '.', (confirmed) => {
          if (!confirmed)
            return

          try {
            getElementMDBObject($(`a.nav-link.btn[href="#${data.tabID}"]`), 'Tab').show()
          } catch (e) {}

          let activeWorkarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${activeConnectionID}"]`)

          try {
            activeWorkarea.find('div.terminal-container').hide()
            activeWorkarea.find('div.interactive-terminal-container').show()
          } catch (e) {}

          try {
            let statementInputField = $(`textarea#${data.textareaID}`)
            statementInputField.val(dropKeyspaceEditor.getValue())
            statementInputField.trigger('input').focus()
            AutoSize.update(statementInputField[0])
          } catch (e) {}

          try {
            setTimeout(() => $(`button#${data.btnID}`).click(), 100)
          } catch (e) {}
        })
      })
    }

    {
      IPCRenderer.on('create-udt', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('#rightClickActionsMetadata').attr('data-state', null)

        $('div.modal#rightClickActionsMetadata').find('div.data-field.row').remove()

        $('input[type="text"]#udtName').val('').trigger('input')

        $('div.modal#rightClickActionsMetadata').find('div.empty-fields').show()

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'create UDT').text(I18next.capitalize(I18next.t('create UDT')))

        $('#rightClickActionsMetadata div.input-group-text.udt-name-keyspace div.keyspace-name').text(`${data.keyspaceName}`)

        $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

        $('div.modal#rightClickActionsMetadata div[action]').hide()

        $('div.modal#rightClickActionsMetadata div[action="udts"]').show()

        $('div.modal#rightClickActionsMetadata a.addFieldBtn#addUDTDataField').toggleClass('disabled', data.numOfUDTs <= 0)

        $('div.modal#rightClickActionsMetadata').find('span[mulang].one-udt').hide()
        $('div.modal#rightClickActionsMetadata').find('span[mulang].no-udt').toggle(data.numOfUDTs <= 0)
        $('div.modal#rightClickActionsMetadata').find('span[mulang].exist-udt').toggle(data.numOfUDTs > 0)

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        rightClickActionsMetadataModal.show()
      })

      IPCRenderer.on('alter-udt', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

        $('div.modal#rightClickActionsMetadata div[action]').hide()
        $('div.modal#rightClickActionsMetadata div[action="udts"]').show()

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('#rightClickActionsMetadata').attr('data-state', 'alter')

        $('div.modal#rightClickActionsMetadata').find('div.data-field.row').remove()

        $('input[type="text"]#udtName').val(`${data.udtName}`).trigger('input')

        $('div.modal#rightClickActionsMetadata').find('div.empty-fields').show()

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'alter UDT').text(I18next.capitalize(I18next.t('alter UDT')))

        $('#rightClickActionsMetadata div.input-group-text.udt-name-keyspace div.keyspace-name').text(`${data.keyspaceName}`)

        $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

        $('div.modal#rightClickActionsMetadata a.addFieldBtn#addUDTDataField').toggleClass('disabled', data.numOfUDTs <= 0)

        $('div.modal#rightClickActionsMetadata').find('span[mulang].one-udt').hide()
        $('div.modal#rightClickActionsMetadata').find('span[mulang].no-udt').toggle(data.numOfUDTs <= 0)
        $('div.modal#rightClickActionsMetadata').find('span[mulang].exist-udt').toggle(data.numOfUDTs > 0)

        // Get related data to the current UDT
        try {
          let udt = JSON.parse(JSONRepair(data.udts)).find((udt) => udt.name == data.udtName),
            fields = [];

          for (let i = 0; i < udt.field_names.length; ++i) {
            fields.push({
              name: udt.field_names[i],
              type: udt.field_types[i]
            })
          }

          $(`a[action]#addDataField`).add($(`a[action]#addUDTDataField`)).trigger('click', JSON.stringify(fields))
        } catch (e) {}

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        rightClickActionsMetadataModal.show()
      })

      IPCRenderer.on('drop-udt', (_, data) => {
        let udtName = addDoubleQuotes(`${data.udtName}`),
          keyspaceName = addDoubleQuotes(`${data.keyspaceName}`),
          dropUDTEditor = monaco.editor.getEditors().find((editor) => $(`div.modal#extraDataActions .editor`).find('div.monaco-editor').is(editor.getDomNode()))

        $(`div.modal#extraDataActions div.editor-container`).removeClass('truncate')

        if ([udtName, keyspaceName].some((name) => minifyText(name).length <= 0))
          return

        try {
          $('#generalPurposeDialog').attr({
            'data-keyspacename': `${keyspaceName}`,
            'data-udtname': `${udtName}`
          })
        } catch (e) {}

        let dropStatement = `DROP TYPE ${keyspaceName}.${udtName};`

        try {
          dropUDTEditor.setValue(dropStatement)
        } catch (e) {}

        setTimeout(() => $(window.visualViewport).trigger('resize'), 100)

        openExtraDataActionsDialog(I18next.capitalizeFirstLetter(I18next.replaceData(`are you sure you want to drop the defined type [b]$data[/b] in the keyspace [b]$data[/b]? This action is irreversible, and, by executing this command, the UDT [b]$data[/b] will be dropped [b]immediately[/b]`, [udtName, keyspaceName, udtName])) + '.', (confirmed) => {
          if (!confirmed)
            return

          try {
            getElementMDBObject($(`a.nav-link.btn[href="#${data.tabID}"]`), 'Tab').show()
          } catch (e) {}

          let activeWorkarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${activeConnectionID}"]`)

          try {
            activeWorkarea.find('div.terminal-container').hide()
            activeWorkarea.find('div.interactive-terminal-container').show()
          } catch (e) {}

          try {
            let statementInputField = $(`textarea#${data.textareaID}`)
            statementInputField.val(dropUDTEditor.getValue())
            statementInputField.trigger('input').focus()
            AutoSize.update(statementInputField[0])
          } catch (e) {}

          try {
            setTimeout(() => $(`button#${data.btnID}`).click(), 100)
          } catch (e) {}
        })
      })
    }

    // For tables - standard and counter -
    {
      IPCRenderer.on('create-table', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('#rightClickActionsMetadata').attr('data-state', null)

        $('div.modal#rightClickActionsMetadata').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field, div.standard-table-udt-column-field, div.standard-table-option-field').remove()

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'create table').text(I18next.capitalize(I18next.t('create table')))

        $('input[type="text"]#standardtableName').val('').trigger('input')

        $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

        $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-partition-keys, div.empty-standard-table-clustering-keys, div.empty-standard-table-columns, div.empty-standard-table-udt-columns, div.empty-standard-table-options').show()

        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-clustering-keys').find('span[mulang]').hide()
        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-clustering-keys').find('span:not(.no-keys)').show()

        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-columns').find('span[mulang]').hide()
        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-columns').find('span:not(.no-columns)').show()

        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-udt-columns').find('span[mulang]').hide()
        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-udt-columns').find('span.add-column').show()

        $(`a#addStandardTableUDTColumns`).removeClass('hide-action-button')

        // For UDT columns
        try {
          let keyspaceUDTs = JSON.parse(JSONRepair(data.udts))

          if (keyspaceUDTs.length > 0)
            throw 0

          $(`a#addStandardTableUDTColumns`).addClass('hide-action-button')

          $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-udt-columns').find('span[mulang]').hide()

          $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-udt-columns').find('span.no-udts').show()
        } catch (e) {}

        $('#rightClickActionsMetadata div.input-group-text.standard-table-name-keyspace div.keyspace-name').text(`${data.keyspaceName}`)

        $(`a[action]#addStandardTablePartitionKey`).removeClass('disabled')

        $(`a[action]#addStandardTablePartitionKey`).add($(`a[action]#addStandardTableClusteringKey`)).show()

        $('div.modal#rightClickActionsMetadata div[action]').hide()

        $('div.modal#rightClickActionsMetadata div[action="standard-tables"]').show()

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        try {
          let cassandraVersion = $(`div[content="connections"] div.connections-container div.connection[data-id="${activeConnectionID}"]`).attr('data-cassandra-version')

          cassandraVersion = cassandraVersion.startsWith('5.0') ? '5.0' : (cassandraVersion.startsWith('4.1') ? '4.1' : '4.0')

          let tableDefaultMetadata = Modules.Consts.TableDefaultMetadata[cassandraVersion]

          $(`a[action]#addStandardTableOption`).trigger('click', JSON.stringify([...tableDefaultMetadata, {
            default: true
          }]))
        } catch (e) {}

        $('#rightClickActionsMetadata').find('div.standard-table-options-sub-container a').click()

        rightClickActionsMetadataModal.show()
      })

      IPCRenderer.on('create-counter-table', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('#rightClickActionsMetadata').attr('data-state', null)

        $('div.modal#rightClickActionsMetadata').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field, div.counter-table-option-field').remove()

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'create counter table').text(I18next.capitalize(I18next.t('create counter table')))

        $('input[type="text"]#countertableName').val('').trigger('input')

        $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

        $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

        $('div.modal#rightClickActionsMetadata').find('div.empty-counter-table-partition-keys, div.empty-counter-table-clustering-keys, div.empty-counter-table-columns, div.empty-counter-table-options').show()

        $('div.modal#rightClickActionsMetadata').find('div.empty-counter-table-clustering-keys').find('span[mulang]').hide()
        $('div.modal#rightClickActionsMetadata').find('div.empty-counter-table-clustering-keys').find('span:not(.no-keys)').show()

        $('#rightClickActionsMetadata div.input-group-text.counter-table-name-keyspace div.keyspace-name').text(`${data.keyspaceName}`)

        $(`a[action]#addCounterTablePartitionKey`).removeClass('disabled')

        $(`a[action]#addCounterTablePartitionKey`).add($(`a[action]#addCounterTableClusteringKey`)).show()

        $('div.modal#rightClickActionsMetadata div[action]').hide()

        $('div.modal#rightClickActionsMetadata div[action="counter-tables"]').show()

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        try {
          let cassandraVersion = $(`div[content="connections"] div.connections-container div.connection[data-id="${activeConnectionID}"]`).attr('data-cassandra-version')

          cassandraVersion = cassandraVersion.startsWith('5.0') ? '5.0' : (cassandraVersion.startsWith('4.1') ? '4.1' : '4.0')

          let tableDefaultMetadata = Modules.Consts.TableDefaultMetadata[cassandraVersion]

          $(`a[action]#addCounterTableOption`).trigger('click', JSON.stringify([...tableDefaultMetadata, {
            default: true
          }]))
        } catch (e) {}

        $('#rightClickActionsMetadata').find('div.counter-table-options-sub-container a').click()

        rightClickActionsMetadataModal.show()
      })

      IPCRenderer.on('alter-table', (_, data) => {
        let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

        try {
          if (data.isCounterTable != 'true')
            throw 0

          let tableName = `${data.tableName}`,
            tableObj = null,
            partitionKeys = [],
            clusteringKeys = [],
            counterColumns = [],
            tableOptions = []

          try {
            tableObj = JSON.parse(JSONRepair(data.tables)).find((table) => table.name == tableName)
          } catch (e) {}

          try {
            partitionKeys = tableObj.partition_key.map((key) => ({
              name: key.name,
              type: key.cql_type
            }))
          } catch (e) {}

          try {
            clusteringKeys = tableObj.clustering_key.map((key) => ({
              name: key.name,
              type: key.cql_type
            }))
          } catch (e) {}

          try {
            counterColumns = tableObj.columns.filter((column) => minifyText(column.cql_type) == 'counter')
              .map((column) => column.name)
          } catch (e) {}

          try {
            tableOptions = tableObj.options
          } catch (e) {}

          $('div.modal#rightClickActionsMetadata div[action]').hide()
          $('div.modal#rightClickActionsMetadata div[action="counter-tables"]').show()

          $('button#executeActionStatement').attr({
            'data-tab-id': `${data.tabID}`,
            'data-textarea-id': `${data.textareaID}`,
            'data-btn-id': `${data.btnID}`
          })

          $('#rightClickActionsMetadata').attr('data-state', 'alter')

          $('div.modal#rightClickActionsMetadata').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field, div.counter-table-option-field').remove()

          $('div.modal#rightClickActionsMetadata').find('div.empty-counter-table-partition-keys, div.empty-counter-table-clustering-keys, div.empty-counter-table-columns, div.empty-counter-table-options').show()

          $('div.modal#rightClickActionsMetadata').find('div.empty-counter-table-clustering-keys').find('span[mulang]').hide()
          $('div.modal#rightClickActionsMetadata').find('div.empty-counter-table-clustering-keys').find('span:not(.no-keys)').show()

          $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'alter counter table').text(I18next.capitalize(I18next.t('alter counter table')))

          $('#rightClickActionsMetadata div.input-group-text.counter-table-name-keyspace div.keyspace-name').text(`${data.keyspaceName}`)

          $('input[type="text"]#countertableName').val(`${data.tableName}`).trigger('input')

          $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

          $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

          $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

          $(`a[action]#addCounterTablePartitionKey`).trigger('click', JSON.stringify(partitionKeys))

          $(`a[action]#addCounterTablePartitionKey`).add($(`a[action]#addCounterTableClusteringKey`)).hide()

          $(`a[action]#addCounterTableClusteringKey`).trigger('click', JSON.stringify(clusteringKeys))

          $(`a[action]#addCounterTableColumn`).trigger('click', JSON.stringify(counterColumns))

          $(`a[action]#addCounterTableOption`).trigger('click', JSON.stringify(tableOptions))

          rightClickActionsMetadataModal.show()

          $('#rightClickActionsMetadata').find('div.counter-table-options-sub-container a').click()

          return
        } catch (e) {}

        let tableName = `${data.tableName}`,
          tableObj = null,
          partitionKeys = [],
          clusteringKeys = [],
          columns = {
            regular: [],
            udt: []
          },
          tableOptions = []

        let keyspaceUDTs

        try {
          tableObj = JSON.parse(JSONRepair(data.tables)).find((table) => table.name == tableName)
        } catch (e) {}

        try {
          partitionKeys = tableObj.partition_key.map((key) => ({
            name: key.name,
            type: key.cql_type,
            isStatic: key.is_static
          }))
        } catch (e) {}

        try {
          clusteringKeys = tableObj.clustering_key.map((key) => ({
            name: key.name,
            type: key.cql_type,
            isStatic: key.is_static
          }))
        } catch (e) {}

        try {
          tableOptions = tableObj.options
        } catch (e) {}

        try {
          keyspaceUDTs = JSON.parse(JSONRepair(data.udts)),
            filteredColumns = tableObj.columns.filter((column) => tableObj.primary_key.find((key) => key.name == column.name) == undefined)

          for (let column of filteredColumns) {
            let columnType = column.cql_type

            try {
              columnType = columnType.match(/frozen\<(.*?)(\<|\>)/)[1]
            } catch (e) {}

            let isColumnDataTypeUDT = keyspaceUDTs.find((udt) => udt.name == columnType)

            columns[isColumnDataTypeUDT ? 'udt' : 'regular'].push({
              name: column.name,
              type: column.cql_type,
              isStatic: column.is_static
            })
          }
        } catch (e) {}

        $('div.modal#rightClickActionsMetadata div[action]').hide()
        $('div.modal#rightClickActionsMetadata div[action="standard-tables"]').show()

        $('button#executeActionStatement').attr({
          'data-tab-id': `${data.tabID}`,
          'data-textarea-id': `${data.textareaID}`,
          'data-btn-id': `${data.btnID}`
        })

        $('#rightClickActionsMetadata').attr('data-state', 'alter')

        $('div.modal#rightClickActionsMetadata').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field, div.standard-table-udt-column-field, div.standard-table-option-field').remove()

        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-partition-keys, div.empty-standard-table-clustering-keys, div.empty-standard-table-columns, div.empty-standard-table-udt-columns, div.empty-standard-table-options').show()

        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-clustering-keys').find('span[mulang]').hide()
        $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-clustering-keys').find('span:not(.no-keys)').show()

        $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'alter table').text(I18next.capitalize(I18next.t('alter table')))

        $('#rightClickActionsMetadata div.input-group-text.standard-table-name-keyspace div.keyspace-name').text(`${data.keyspaceName}`)

        $('input[type="text"]#standardtableName').val(`${data.tableName}`).trigger('input')

        $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

        $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

        $('#rightClickActionsMetadata').removeClass('insertion-action show-editor')

        $(`a[action]#addStandardTablePartitionKey`).trigger('click', JSON.stringify(partitionKeys))

        $(`a[action]#addStandardTablePartitionKey`).add($(`a[action]#addStandardTableClusteringKey`)).hide()

        $(`a[action]#addStandardTableClusteringKey`).trigger('click', JSON.stringify(clusteringKeys))

        $(`a[action]#addStandardTableOption`).trigger('click', JSON.stringify(tableOptions))

        $(`a[action]#addStandardTableColumns`).trigger('click', JSON.stringify(columns.regular))

        $(`a[action]#addStandardTableUDTColumns`).trigger('click', JSON.stringify(columns.udt))

        try {
          if (keyspaceUDTs.length > 0)
            throw 0

          $(`a#addStandardTableUDTColumns`).addClass('hide-action-button')

          $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-udt-columns').find('span[mulang]').hide()

          $('div.modal#rightClickActionsMetadata').find('div.empty-standard-table-udt-columns').find('span.no-udts').show()
        } catch (e) {}

        rightClickActionsMetadataModal.show()

        $('#rightClickActionsMetadata').find('div.standard-table-options-sub-container a').click()
      })

      IPCRenderer.on('drop-table', (_, data) => {
        let tableName = addDoubleQuotes(`${data.tableName}`),
          keyspaceName = addDoubleQuotes(`${data.keyspaceName}`),
          dropTableEditor = monaco.editor.getEditors().find((editor) => $(`div.modal#extraDataActions .editor`).find('div.monaco-editor').is(editor.getDomNode()))

        $(`div.modal#extraDataActions div.editor-container`).removeClass('truncate')

        if ([tableName, keyspaceName].some((name) => minifyText(name).length <= 0))
          return

        try {
          $('#generalPurposeDialog').attr({
            'data-keyspacename': `${keyspaceName}`,
            'data-tablename': `${tableName}`
          })
        } catch (e) {}

        let dropStatement = `DROP TABLE ${keyspaceName}.${tableName};`

        try {
          dropTableEditor.setValue(dropStatement)
        } catch (e) {}

        setTimeout(() => $(window.visualViewport).trigger('resize'), 100)

        openExtraDataActionsDialog(I18next.capitalizeFirstLetter(I18next.replaceData(`are you sure you want to drop the table [b]$data[/b] in the keyspace [b]$data[/b]? This action is irreversible, and, by executing this command, the table [b]$data[/b] will be dropped [b]immediately[/b]`, [tableName, keyspaceName, tableName])) + '.', (confirmed) => {
          if (!confirmed)
            return

          try {
            getElementMDBObject($(`a.nav-link.btn[href="#${data.tabID}"]`), 'Tab').show()
          } catch (e) {}

          let activeWorkarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${activeConnectionID}"]`)

          try {
            activeWorkarea.find('div.terminal-container').hide()
            activeWorkarea.find('div.interactive-terminal-container').show()
          } catch (e) {}

          try {
            let statementInputField = $(`textarea#${data.textareaID}`)
            statementInputField.val(dropTableEditor.getValue())
            statementInputField.trigger('input').focus()
            AutoSize.update(statementInputField[0])
          } catch (e) {}

          try {
            setTimeout(() => $(`button#${data.btnID}`).click(), 100)
          } catch (e) {}
        })
      })

      IPCRenderer.on('truncate-table', (_, data) => {
        let tableName = addDoubleQuotes(`${data.tableName}`),
          keyspaceName = addDoubleQuotes(`${data.keyspaceName}`),
          truncateTableEditor = monaco.editor.getEditors().find((editor) => $(`div.modal#extraDataActions .editor`).find('div.monaco-editor').is(editor.getDomNode()))

        $(`div.modal#extraDataActions div.editor-container`).addClass('truncate')

        if ([tableName, keyspaceName].some((name) => minifyText(name).length <= 0))
          return

        try {
          $('#generalPurposeDialog').attr({
            'data-keyspacename': `${keyspaceName}`,
            'data-tablename': `${tableName}`
          })
        } catch (e) {}

        let truncateStatement = `CONSISTENCY ${activeSessionsConsistencyLevels[activeConnectionID].standard};` + OS.EOL + `TRUNCATE TABLE ${keyspaceName}.${tableName};`

        try {
          truncateTableEditor.setValue(truncateStatement)
        } catch (e) {}

        setTimeout(() => $(window.visualViewport).trigger('resize'), 100)

        openExtraDataActionsDialog(I18next.capitalizeFirstLetter(I18next.replaceData(`are you sure you want to truncate data in the table [b]$data[/b] in the keyspace [b]$data[/b]? this operation is irreversible and will permanently delete all data in the table. Key consequences include:[br][ul][li]All rows in the specified table will be removed immediately.[/li][li]Materialized views derived from this table will also be truncated.[/li][li]Snapshots: If your Cassandra cluster is configured to take snapshots before truncation, a snapshot of the table's current data will be created for recovery purposes. Remember to remove this snapshot if they are not needed.[/li][ul][li]Clean up snapshots: Use [code]nodetool clearsnapshot[/code] to remove snapshots if they are no longer needed.[/li][li]Disable automatic snapshots: Modify [code]cassandra.yaml[/code] to disable snapshots if you do not want this behavior.[/li][/ul][/ul]Please confirm that you want to proceed with this operation, understanding its irreversible nature and potential impact on snapshots`, [tableName, keyspaceName, tableName])) + '.', (confirmed) => {
          if (!confirmed)
            return

          try {
            getElementMDBObject($(`a.nav-link.btn[href="#${data.tabID}"]`), 'Tab').show()
          } catch (e) {}

          let activeWorkarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${activeConnectionID}"]`)

          try {
            activeWorkarea.find('div.terminal-container').hide()
            activeWorkarea.find('div.interactive-terminal-container').show()
          } catch (e) {}

          try {
            let statementInputField = $(`textarea#${data.textareaID}`)
            statementInputField.val(truncateTableEditor.getValue())
            statementInputField.trigger('input').focus()
            AutoSize.update(statementInputField[0])
          } catch (e) {}

          try {
            setTimeout(() => $(`button#${data.btnID}`).click(), 100)
          } catch (e) {}
        })
      })

      let tableFieldsTreeContainers = {
        primaryKey: $('div#tableFieldsPrimaryKeysTree'),
        columnsRegular: $('div#tableFieldsRegularColumnsTree'),
        columnsCollection: $('div#tableFieldsCollectionColumnsTree'),
        columnsUDT: $('div#tableFieldsUDTColumnsTree')
      }

      let effectedNodes = {}

      IPCRenderer.on('insert-row', (_, data) => {
        Modules.Config.getConfig((config) => {
          let enableBlobPreview = false

          try {
            enableBlobPreview = config.get('features', 'previewBlob') == 'true'
          } catch (e) {}

          effectedNodes = {}

          let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal'),
            isInsertionAsJSON = data.asJSON === 'true'

          $('button#executeActionStatement').attr({
            'data-tab-id': `${data.tabID}`,
            'data-textarea-id': `${data.textareaID}`,
            'data-btn-id': `${data.btnID}`
          })

          $('#rightClickActionsMetadata').attr({
            'data-state': null,
            'data-keyspace-name': `${data.keyspaceName}`,
            'data-table-name': `${data.tableName}`,
            'data-is-counter-table': data.isCounterTable == 'true' ? 'true' : null,
            'data-as-json': `${!isInsertionAsJSON ? null : 'true'}`
          })

          $('div.row.default-omitted-columns-value-row').toggle(isInsertionAsJSON)

          $('div.row.default-omitted-columns-value-row').find('a[value="UNSET"]').click()

          $('input#ttl').val('')
          $('input#ttlMS').prop('checked', true)
          $('input#insertionTimestamp').val('')

          $('input#ttl').closest('div.row.data-ttl-row').toggle(!(data.isCounterTable == 'true'))

          $(`div[action="insert-row"] div.types-of-transactions`).toggle(!(data.isCounterTable == 'true'))

          $('input#insertNoSelectOption').prop('checked', true)
          $('input#insertNoSelectOption').trigger('change')

          $('div[action="insert-row"] div[section="standard"]').click()

          try {
            $('div.dropdown[for-select="insertWriteConsistencyLevel"]').find(`a[value="${activeSessionsConsistencyLevels[activeConnectionID].standard}"]`).click()
          } catch (e) {}

          try {
            $('div.dropdown[for-select="insertSerialConsistencyLevel"]').find(`a[value="${activeSessionsConsistencyLevels[activeConnectionID].serial}"]`).click()
          } catch (e) {}

          $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', !(data.isCounterTable == 'true') ? 'insert row' : 'increment/decrement counter').html(`${I18next.capitalize(I18next.t(!(data.isCounterTable == 'true') ? 'insert row' : 'increment/decrement counter'))} ${isInsertionAsJSON ? '(JSON)' : ''} <span class="keyspace-table-info badge rounded-pill badge-secondary" style="text-transform: none; background-color: rgba(235, 237, 239, 0.15); color: #ffffff;">${data.keyspaceName}.${data.tableName}</span>`)

          $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

          $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

          try {
            for (let container of Object.keys(tableFieldsTreeContainers)) {
              try {
                tableFieldsTreeContainers[container].jstree('destroy')
              } catch (e) {}
            }
          } catch (e) {}

          let keys = [],
            columns = [],
            udts = [],
            keyspaceUDTs = []

          try {
            let tableObj = JSON.parse(JSONRepair(data.tables)).find((table) => table.name == data.tableName)

            try {
              keys = tableObj.primary_key.map((key) => {
                let isPartition = tableObj.partition_key.find((partitionKey) => partitionKey.name == key.name) != undefined

                return {
                  name: key.name,
                  type: key.cql_type,
                  isPartition
                }
              })
            } catch (e) {}

            try {
              columns = tableObj.columns.filter((column) => tableObj.primary_key.find((key) => key.name == column.name) == undefined)
                .map((column) => {
                  return {
                    name: column.name,
                    type: column.cql_type
                  }
                })
            } catch (e) {}

            try {
              try {
                keyspaceUDTs = JSON.parse(JSONRepair(data.udts))
              } catch (e) {}

              for (let column of columns) {
                let udtStructure = {},
                  manipulatedColumnType = column.type

                manipulatedColumnType = removeFrozenKeyword(`${manipulatedColumnType}`)

                try {
                  manipulatedColumnType = `${manipulatedColumnType}`.match(/<(.*?)>$/)[1];
                } catch (e) {}

                let udtObject = keyspaceUDTs.find((udt) => udt.name == manipulatedColumnType)

                if (udtObject == undefined || ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`)))
                  continue

                udtStructure = {
                  ...udtObject,
                  ...column
                }

                udts.push(udtStructure)
              }

              columns = columns.filter((column) => udts.find((udt) => udt.name == column.name) == undefined)
            } catch (e) {}
          } catch (e) {}

          let groupStructure = buildTableFieldsTreeview(keys, columns, udts, keyspaceUDTs, enableBlobPreview),
            handleHiddenNodes = (treeData) => {
              let index = 0

              while (index < treeData.length) {
                const node = treeData[index]

                try {
                  if (Array.isArray(node)) {
                    processArray(node)

                    index++

                    continue
                  }

                  if (node.a_attr['add-hidden-node'] !== undefined) {
                    treeData.splice(index + 1, 0, {
                      id: node.a_attr['add-hidden-node'],
                      parent: node.parent,
                      state: {
                        opened: true,
                        selected: false
                      },
                      text: ``
                    })

                    index++
                  }
                } catch (e) {}

                index++

              }
              return treeData;
            },
            handleNodeCreationDeletion = () => {
              let allInsertionRelatedInputs = $('#rightClickActionsMetadata').find('div[action="insert-row"]').find('input').get()

              for (let inputDOM of allInsertionRelatedInputs) {
                let input = $(inputDOM),
                  [
                    inputCassandraType,
                    inputHTMLType,
                    inputID
                  ] = getAttributes(input, ['data-field-type', 'type', 'id']),
                  inputSavedValue = effectedNodes[inputID] || ''

                if (inputSavedValue == undefined || inputSavedValue.length <= 0)
                  continue

                try {
                  if (inputHTMLType != 'checkbox')
                    throw 0

                  if (input.attr('data-set-indeterminate') == 'true') {
                    input.attr('data-set-indeterminate', null)

                    input.prop('indeterminate', true)

                    input.trigger('change')

                    throw 0
                  }

                  input.prop('checked', !(inputSavedValue != 'true'))

                  input.prop('indeterminate', inputSavedValue == 'indeterminate')

                  input.trigger('change')

                  continue
                } catch (e) {}

                try {
                  if (inputCassandraType != 'blob')
                    throw 0

                  input.val(inputSavedValue.inputValue).trigger('input')

                  input.data('value', inputSavedValue.dataValue)

                  continue
                } catch (e) {}

                // Not `blob` or `boolean`
                try {
                  input.val(inputSavedValue).trigger('input')
                } catch (e) {}
              }

              setTimeout(() => {
                try {
                  updateActionStatusForInsertRow()
                } catch (e) {}
              })
            }

          try {
            for (let treeViewType of Object.keys(groupStructure))
              groupStructure[treeViewType].core.data = handleHiddenNodes(groupStructure[treeViewType].core.data)
          } catch (e) {}

          {
            let primaryKeyTreeElements = tableFieldsTreeContainers.primaryKey.add('div#insertPrimaryKeyBadge')

            try {
              if (keys.length <= 0)
                throw 0

              primaryKeyTreeElements.show()

              try {
                groupStructure.primaryKey.core.data = groupStructure.primaryKey.core.data.filter((field) => field != undefined)
              } catch (e) {}

              let primaryKeyTreeObject = tableFieldsTreeContainers.primaryKey.jstree(groupStructure.primaryKey)

              try {
                primaryKeyTreeObject.unbind('loaded.jstree')
              } catch (e) {}

              try {
                primaryKeyTreeObject.on('loaded.jstree', () => setTimeout(() => primaryKeyTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${primaryKeyTreeObject.find('a.jstree-anchor').length - index}`))))
              } catch (e) {}
            } catch (e) {
              primaryKeyTreeElements.hide()
            }
          }

          {
            let columnsRegularTreeElements = tableFieldsTreeContainers.columnsRegular.add('div#insertRegularColumnsBadge')

            try {
              if (!(columns.some((column) => ['map', 'set', 'list'].every((type) => !(`${column.type}`.includes(`${type}<`))))))
                throw 0

              columnsRegularTreeElements.show()

              try {
                groupStructure.regularColumns.core.data = groupStructure.regularColumns.core.data.filter((field) => field != undefined)
              } catch (e) {}

              let regularColumnsTreeObject = tableFieldsTreeContainers.columnsRegular.jstree(groupStructure.regularColumns)

              try {
                regularColumnsTreeObject.unbind('loaded.jstree')
              } catch (e) {}

              try {
                regularColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => regularColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${regularColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
              } catch (e) {}
            } catch (e) {
              columnsRegularTreeElements.hide()
            }
          }

          {
            let columnsCollectionTreeElements = tableFieldsTreeContainers.columnsCollection.add('div#insertCollectionColumnsBadge')

            try {
              if (!(columns.some((column) => ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`)))))
                throw 0

              columnsCollectionTreeElements.show()

              try {
                groupStructure.collectionColumns.core.data = groupStructure.collectionColumns.core.data.filter((field) => field != undefined)
              } catch (e) {}

              let collectionColumnsTreeObject = tableFieldsTreeContainers.columnsCollection.jstree(groupStructure.collectionColumns)

              try {
                collectionColumnsTreeObject.unbind('loaded.jstree')
              } catch (e) {}

              try {
                collectionColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => collectionColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${collectionColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
              } catch (e) {}
            } catch (e) {
              columnsCollectionTreeElements.hide()
            }
          }

          {
            let columnsUDTTreeElements = tableFieldsTreeContainers.columnsUDT.add('div#insertUDTColumnsBadge')
            try {
              if (udts.length <= 0)
                throw 0

              columnsUDTTreeElements.show()

              let udtColumnsTreeObject = tableFieldsTreeContainers.columnsUDT.jstree(groupStructure.udtColumns)

              try {
                udtColumnsTreeObject.unbind('loaded.jstree')
              } catch (e) {}

              try {
                udtColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => udtColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${udtColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
              } catch (e) {}
            } catch (e) {
              columnsUDTTreeElements.hide()
            }
          }

          setTimeout(() => {
            for (let container of Object.keys(tableFieldsTreeContainers)) {
              let tableFieldsTreeContainer = tableFieldsTreeContainers[container]

              try {
                tableFieldsTreeContainer.unbind('loaded.jstree')
                tableFieldsTreeContainer.unbind('select_node.jstree')
                tableFieldsTreeContainer.unbind('create_node.jstree')
                tableFieldsTreeContainer.unbind('delete_node.jstree')
                tableFieldsTreeContainer.unbind('hide_node.jstree')
              } catch (e) {}

              tableFieldsTreeContainer.on('loaded.jstree', () => {
                tableFieldsTreeContainer.find('input').each(function() {
                  setTimeout(() => {
                    try {
                      let mdbObject = getElementMDBObject($(this))

                      mdbObject.update()
                    } catch (e) {}
                  }, 100)
                })

                setTimeout(() => {
                  try {
                    updateActionStatusForInsertRow()
                  } catch (e) {}
                })

                tableFieldsTreeContainer.find('a.jstree-anchor[add-hidden-node]').each(function() {
                  let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${$(this).attr('add-hidden-node')}"]`)

                  hiddenNode.css('margin-top', '-45px')

                  hiddenNode.children('a').css('pointer-events', 'none')
                })

                setTimeout(() => {
                  {
                    let allActionsMenuToggleBtns = tableFieldsTreeContainer.find('button.dropdown-toggle').get()

                    for (let toggleBtn of allActionsMenuToggleBtns) {
                      let actionsDropDownObject = getElementMDBObject($(toggleBtn), 'Dropdown'),
                        actionsDropDownElement = $(actionsDropDownObject._menu)

                      try {
                        $(toggleBtn).unbind('click')
                      } catch (e) {}

                      $(toggleBtn).click(() => {
                        for (let subToggleBtn of allActionsMenuToggleBtns) {
                          if ($(subToggleBtn).is($(toggleBtn)))
                            continue

                          let subActionsDropDownObject = getElementMDBObject($(subToggleBtn), 'Dropdown'),
                            subActionsDropDownElement = $(subActionsDropDownObject._menu)

                          try {
                            subActionsDropDownElement.hide()
                            subActionsDropDownObject.hide()
                          } catch (e) {}
                        }

                        setTimeout(() => {
                          actionsDropDownElement.toggle()
                          actionsDropDownObject.toggle()
                        })

                        setTimeout(() => {
                          actionsDropDownElement.oneClickOutside({
                            callback: function() {
                              try {
                                actionsDropDownElement.hide()
                                actionsDropDownObject.hide()
                              } catch (e) {}
                            },
                            exceptions: toggleBtn
                          })
                        })

                        setTimeout(() => {
                          try {
                            updateActionStatusForInsertRow()
                          } catch (e) {}
                        })
                      })
                    }
                  }

                  {
                    let allAddItemActionBtns = tableFieldsTreeContainer.find('button[action="add-item"]').get()

                    for (let addItemActionBtn of allAddItemActionBtns) {
                      try {
                        $(addItemActionBtn).unbind('click')
                      } catch (e) {}

                      $(addItemActionBtn).click(function() {
                        let relatedNode = $(this).parent().parent().parent(),
                          [
                            id,
                            type,
                            fieldType,
                            mandatory,
                            hiddenNodeID
                          ] = getAttributes(relatedNode, ['id', 'type', 'field-type', 'mandatory', 'add-hidden-node']),
                          isTypeMap = `${type}`.includes('map<'),
                          relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree(),
                          relatedHiddenNode = relatedTreeObject.element.find(`li[id="hiddenNodeID"]`)

                        try {
                          type = removeFrozenKeyword(`${type}`)
                        } catch (e) {}

                        try {
                          type = `${type}`.match(/<(.*?)>$/)[1]
                        } catch (e) {}

                        try {
                          if (!isTypeMap)
                            throw 0

                          type = `${type}`.replace(/\s+/, '').split(',')

                          type = type.map((subType) => {
                            try {
                              subType = removeFrozenKeyword(`${subType}`)
                            } catch (e) {}

                            subType = subType.replace(/(.*?)</gi, '').replace(/>(.*?)/gi, '')

                            return subType
                          })

                        } catch (e) {}

                        try {
                          if (typeof type != 'object')
                            throw 0

                          let itemMainNodeID = getRandom.id(30),
                            itemMainNodeStrucutre = {
                              id: itemMainNodeID,
                              parent: hiddenNodeID,
                              state: {
                                opened: true,
                                selected: false
                              },
                              a_attr: {
                                'is-map-item': true
                              },
                              text: `
                              <div class="input-group">
                                <div class="input-group-text for-insertion for-name ignored-applied">
                                  <span class="name">
                                    <span mulang="name" capitalize></span>
                                    <ion-icon name="right-arrow-filled"></ion-icon>
                                  </span>
                                  <span class="name-value">Item #${getRandom.id(3)}</span>
                                </div>
                                <div class="input-group-text for-insertion for-actions ignored-applied">
                                  <span class="actions">
                                    <span mulang="actions" capitalize></span>
                                    <ion-icon name="right-arrow-filled"></ion-icon>
                                  </span>
                                  <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="delete-item">
                                    <ion-icon name="trash-outline"></ion-icon>
                                    <span mulang="delete item"></span>
                                  </button>
                                </div>
                              </div>`
                            }

                          let mapKeyUDTObject = keyspaceUDTs.find((udt) => udt.name == type[0]),
                            mapKeyObject = {
                              isUDT: mapKeyUDTObject != undefined,
                              name: ``,
                              type: type[0],
                              fieldType: 'collection-map-key',
                              isMandatory: false,
                              noEmptyValue: true
                            },
                            mapKeyStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, enableBlobPreview, mapKeyObject.isUDT ? {
                              ...mapKeyUDTObject,
                              ...mapKeyObject
                            } : mapKeyObject)

                          let mapValueUDTObject = keyspaceUDTs.find((udt) => udt.name == type[1]),
                            mapValueObject = {
                              isUDT: mapValueUDTObject != undefined,
                              name: ``,
                              type: type[1],
                              fieldType: 'collection-map-value',
                              isMandatory: false,
                              noEmptyValue: true
                            },
                            mapValueStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, enableBlobPreview, mapValueObject.isUDT ? {
                              ...mapValueUDTObject,
                              ...mapValueObject
                            } : mapValueObject)

                          try {
                            mapKeyStructure.parent = itemMainNodeID
                          } catch (e) {}

                          try {
                            mapValueStructure.parent = itemMainNodeID
                          } catch (e) {}

                          let allNewNodes = []

                          try {
                            if (Array.isArray(itemMainNodeStrucutre)) {
                              allNewNodes = allNewNodes.concat(itemMainNodeStrucutre)
                            } else {
                              allNewNodes.push(itemMainNodeStrucutre)
                            }
                          } catch (e) {}

                          try {
                            if (Array.isArray(mapKeyStructure)) {
                              allNewNodes = allNewNodes.concat(mapKeyStructure)
                            } else {
                              allNewNodes.push(mapKeyStructure)
                            }
                          } catch (e) {}

                          try {
                            if (Array.isArray(mapValueStructure)) {
                              allNewNodes = allNewNodes.concat(mapValueStructure)
                            } else {
                              allNewNodes.push(mapValueStructure)
                            }
                          } catch (e) {}

                          try {
                            allNewNodes = flattenArray(allNewNodes)
                          } catch (e) {}

                          try {
                            allNewNodes = handleHiddenNodes(allNewNodes)
                          } catch (e) {}

                          for (let i = 0; i < allNewNodes.length; i++) {
                            let node = allNewNodes[i]

                            try {
                              if (node.parent != '#')
                                throw 0

                              allNewNodes[i].parent = itemMainNodeID
                            } catch (e) {}

                            try {
                              let nodeText = Cheerio.load(allNewNodes[i].text)

                              try {
                                nodeText('body').find('div.input-group-text.for-not-ignoring').attr('hidden', '')
                              } catch (e) {}

                              allNewNodes[i].text = nodeText('body').html()
                            } catch (e) {}

                            try {
                              relatedTreeObject.create_node(allNewNodes[i].parent, allNewNodes[i])
                            } catch (e) {}

                            try {
                              handleNodeCreationDeletion()
                            } catch (e) {}
                          }

                          return
                        } catch (e) {}

                        let nodeUDTType = keyspaceUDTs.find((udt) => udt.name == type),
                          nodeTypeObject = {
                            isUDT: nodeUDTType != undefined,
                            name: ``,
                            type: type,
                            fieldType: 'collection-type',
                            isMandatory: false,
                            noEmptyValue: true
                          },
                          nodeTypeStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, enableBlobPreview, nodeTypeObject.isUDT ? {
                            ...nodeUDTType,
                            ...nodeTypeObject
                          } : nodeTypeObject)

                        try {
                          nodeTypeStructure = Array.isArray(nodeTypeStructure) ? flattenArray(nodeTypeStructure) : [nodeTypeStructure]
                        } catch (e) {}

                        try {
                          nodeTypeStructure = handleHiddenNodes(nodeTypeStructure)
                        } catch (e) {}

                        for (let i = 0; i < nodeTypeStructure.length; i++) {
                          try {
                            if (nodeTypeStructure[i].parent != '#')
                              throw 0

                            let nodeText = Cheerio.load(nodeTypeStructure[i].text),
                              deleteItemBtn = `
                            <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="delete-item">
                              <ion-icon name="trash-outline"></ion-icon>
                              <span mulang="delete item"></span>
                            </button>`

                            try {
                              nodeText('body').find('div.input-group-text.for-not-ignoring').attr('hidden', '')
                            } catch (e) {}

                            let actionsGroup = nodeText('div.input-group-text.for-actions')

                            if (actionsGroup.length != 0) {
                              actionsGroup.find('button').before(deleteItemBtn)
                            } else {
                              let actionsGroupContainer = `
                                <div class="input-group-text for-insertion for-actions ignored-applied">
                                  <span class="actions">
                                    <span mulang="actions" capitalize></span>
                                    <ion-icon name="right-arrow-filled"></ion-icon>
                                  </span>
                                  ${deleteItemBtn}
                                </div>`

                              nodeText('div.input-group').append(actionsGroupContainer)
                            }

                            nodeTypeStructure[i].text = nodeText('body').html()

                            nodeTypeStructure[i].parent = hiddenNodeID
                          } catch (e) {}

                          try {
                            relatedTreeObject.create_node(nodeTypeStructure[i].parent, {
                              ...nodeTypeStructure[i]
                            })
                          } catch (e) {}

                          try {
                            handleNodeCreationDeletion()
                          } catch (e) {}
                        }

                        try {
                          updateActionStatusForInsertRow()
                        } catch (e) {}
                      })
                    }

                    let allDeleteItemActionBtns = tableFieldsTreeContainer.find('button[action="delete-item"]').get()

                    for (let deleteItemActionBtn of allDeleteItemActionBtns) {
                      try {
                        $(deleteItemActionBtn).unbind('click')
                      } catch (e) {}

                      $(deleteItemActionBtn).click(function() {
                        let relatedNode = $(this).parent().parent().parent(),
                          relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree()

                        try {
                          let deletedNode = relatedTreeObject.get_node(relatedNode)

                          relatedTreeObject.delete_node(deletedNode)

                          try {
                            handleNodeCreationDeletion()
                          } catch (e) {}
                        } catch (e) {}
                      })
                    }
                  }

                  {
                    let AllIgnoreCheckboxes = tableFieldsTreeContainer.find('div.not-ignore-checkbox').get()

                    for (let ignoreCheckbox of AllIgnoreCheckboxes) {
                      try {
                        $(ignoreCheckbox).unbind('click')
                      } catch (e) {}

                      $(ignoreCheckbox).click(function() {
                        let relatedNode = $(this).closest('a.jstree-anchor'),
                          relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree(),
                          relatedNodeObject = relatedTreeObject.get_node(relatedNode)

                        $(this).attr('data-status', `${$(this).attr('data-status') == 'true' ? 'false' : 'true'}`)

                        let checkBoxStatus = $(this).attr('data-status')

                        relatedNode.toggleClass('ignored', checkBoxStatus != 'true')

                        let allChildrenNodes = relatedNodeObject.children_d

                        try {
                          if (relatedNode.attr('add-hidden-node') == undefined)
                            throw 0

                          let hiddenNodeObject = relatedTreeObject.get_node(`${relatedNode.attr('add-hidden-node')}`)

                          allChildrenNodes = allChildrenNodes.concat(hiddenNodeObject.children_d)
                        } catch (e) {}

                        for (let childrenNodeID of allChildrenNodes) {
                          let childrenNode = $(`a[id="${childrenNodeID}_anchor"]`)

                          childrenNode.toggleClass('ignored', checkBoxStatus != 'true')
                        }

                        setTimeout(() => {
                          try {
                            updateActionStatusForInsertRow()
                          } catch (e) {}
                        })
                      })
                    }
                  }

                  {
                    let allClearFieldBtns = tableFieldsTreeContainer.find('div.clear-field div.btn').get()

                    for (let clearFieldBtn of allClearFieldBtns) {
                      try {
                        $(clearFieldBtn).unbind('click')
                      } catch (e) {}

                      $(clearFieldBtn).click(function() {
                        let relatedNode = $(this).closest('a.jstree-anchor'),
                          rlatedInutField = relatedNode.find('input'),
                          inputObject = getElementMDBObject(rlatedInutField)

                        try {
                          rlatedInutField.val('').trigger('input')
                        } catch (e) {}

                        try {
                          inputObject.update()
                          setTimeout(() => inputObject._deactivate())
                        } catch (e) {}

                        setTimeout(() => {
                          try {
                            updateActionStatusForInsertRow()
                          } catch (e) {}
                        })
                      })
                    }
                  }

                  {
                    let allNULLApplyBtns = tableFieldsTreeContainer.find('button[action="apply-null"]').get()

                    for (let applyBtn of allNULLApplyBtns) {
                      try {
                        $(applyBtn).unbind('click')
                      } catch (e) {}

                      $(applyBtn).click(function() {
                        let isNULLApplied = $(this).hasClass('applied')

                        $(this).closest('a.jstree-anchor').find('.null-related').toggleClass('null-applied', !isNULLApplied)
                        $(this).toggleClass('applied', !isNULLApplied)

                        setTimeout(() => {
                          try {
                            updateActionStatusForInsertRow()
                          } catch (e) {}
                        })
                      })
                    }
                  }
                })

                // If it's a counter table then we need to update the counter columns
                try {
                  if (data.isCounterTable !== 'true')
                    throw 0

                  setTimeout(() => {
                    let allCounterColumns = $(tableFieldsTreeContainer).find('a.jstree-anchor[type="counter"]'),
                      incrementDecrementButtons = `
                      <div class="input-group-text for-insertion for-counter-value ignored-applied">
                    <button type="button" class="btn btn-light btn-rounded btn-sm ripple-surface-dark selected" data-mdb-ripple-color="dark" action="apply-increment" style="">
                      <ion-icon name="plus-circle-outline"></ion-icon>
                      <span>Increment</span>
                    </button>
                    <button type="button" class="btn btn-light btn-rounded btn-sm ripple-surface-dark" data-mdb-ripple-color="dark" action="apply-decrement" style="">
                      <ion-icon name="minus-circle-outline"></ion-icon>
                      <span>Decrement</span>
                    </button>
                  </div>`

                    for (let counterColumn of allCounterColumns.get()) {
                      let typeContainer = $(counterColumn).find('div.input-group-text.for-insertion.for-type')

                      typeContainer.before($(incrementDecrementButtons).show(function() {
                        let container = $(this)

                        $(counterColumn).find('input[data-field-type="counter"]').attr('type', 'number')

                        setTimeout(() => $(counterColumn).find('div.input-group-text.for-insertion.for-null-value').remove())

                        let buttons = container.find('button[action]')

                        buttons.click(function() {
                          buttons.removeClass('selected')

                          $(this).addClass('selected')

                          setTimeout(() => {
                            try {
                              updateActionStatusForInsertRow()
                            } catch (e) {}
                          })
                        })
                      }))
                    }
                  })
                } catch (e) {}

                setTimeout(() => {
                  try {
                    tableFieldsTreeContainer.find('input').unbind('input')
                    tableFieldsTreeContainer.find('input').unbind('change')
                  } catch (e) {}

                  tableFieldsTreeContainer.find('input').on('input change', function() {
                    let [
                      inputCassandraType,
                      inputHTMLType,
                      inputID
                    ] = getAttributes($(this), ['data-field-type', 'type', 'id']),
                      relatedNode = $(this).closest('a.jstree-anchor'),
                      isMandatory = relatedNode.attr('mandatory') == 'true',
                      isEmptyValueNotAllowed = relatedNode.attr('no-empty-value') == 'true'

                    try {
                      if (!((isMandatory || isEmptyValueNotAllowed) && $(this).val().length <= 0))
                        throw 0

                      relatedNode.find('div.clear-field').addClass('hide')

                      $(this).addClass('is-invalid')

                      setTimeout(() => {
                        try {
                          updateActionStatusForInsertRow()
                        } catch (e) {}
                      })

                      return
                    } catch (e) {}

                    $(this).removeClass('is-invalid')

                    /**
                     * Using `switch` here won't be suffiecnet as we need, in some cases, to check either one of the types, or both of them
                     * `boolean` type - `checkbox` input type
                     */
                    try {
                      if (inputHTMLType != 'checkbox')
                        throw 0

                      if ($(this).attr('data-set-indeterminate') == 'true') {
                        $(this).attr('data-set-indeterminate', null)

                        $(this).prop('indeterminate', true)
                      }

                      $(`label[for="${$(this).attr('id')}"]`).text($(this).prop('indeterminate') ? 'not set' : ($(this).prop('checked') ? 'true' : 'false'))

                      effectedNodes[inputID] = $(this).prop('indeterminate') ? 'indeterminate' : `${$(this).prop('checked')}`
                    } catch (e) {}

                    if (inputHTMLType != 'checkbox')
                      effectedNodes[inputID] = $(this).val()

                    // `inet` Cassandra type - `text` input type
                    try {
                      if (inputCassandraType != 'inet')
                        throw 0

                      let ipValue = $(this).val(),
                        isValidIP = isIP(`${ipValue}`) != 0

                      if (minifyText(ipValue).length <= 0)
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidIP)
                    } catch (e) {}

                    // `uuid` and `timeuuid` Cassandra types - `text` input type
                    try {
                      if (!(['uuid', 'timeuuid'].some((type) => inputCassandraType == type)))
                        throw 0

                      let uuidValue = $(this).val(),
                        isValidUUID = isUUID(`${uuidValue}`),
                        uuidFunction = inputCassandraType == 'uuid' ? 'uuid' : 'now'

                      if (minifyText(uuidValue).length <= 0 || uuidValue == `${uuidFunction}()`)
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidUUID)
                    } catch (e) {}

                    // `timestamp` Cassandra type - `text` input type
                    try {
                      if (inputCassandraType != 'timestamp')
                        throw 0

                      let timestampValue = $(this).val()

                      try {
                        timestampValue = !isNaN(timestampValue) ? parseInt(timestampValue) : timestampValue
                      } catch (e) {}

                      let isValidTimestamp = !isNaN((new Date(timestampValue).getTime()))

                      if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_timestamp()')
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidTimestamp)
                    } catch (e) {}

                    // `date` Cassandra type - `text` input type
                    try {
                      if (inputCassandraType != 'date')
                        throw 0

                      let dateValue = $(this).val(),
                        isValidDate = (`${dateValue}`.match(/^\d{4}-\d{2}-\d{2}$/) != null || !isNaN(dateValue)) && !(isNaN(new Date(parseInt(dateValue)).getTime()))

                      if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_date()')
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidDate)
                    } catch (e) {}

                    // `time` Cassandra type - `text` input type
                    try {
                      if (inputCassandraType != 'time')
                        throw 0

                      let timeValue = $(this).val(),
                        isValidTime = (`${timeValue}`.match(/^\d{2}:\d{2}:\d{2}(\.\d+)*$/) != null || !isNaN(timeValue)) && !(isNaN(new Date(parseInt(timeValue)).getTime()))

                      if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_time()')
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidTime)
                    } catch (e) {}

                    // `duration` Cassandra type - `text` input type
                    try {
                      if (inputCassandraType != 'duration')
                        throw 0

                      let durationValue = $(this).val(),
                        isValidDuration = `${durationValue}`.match(/^P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d*\.?\d*S)?)?$/) != null

                      if (minifyText($(this).val()).length <= 0)
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidDuration)
                    } catch (e) {}

                    // `blob` Cassandra type - `text` input type
                    try {
                      if (inputCassandraType != 'blob')
                        throw 0

                      let blobValue = $(this).val(),
                        isValidBlob = `${blobValue}`.match(/^(?:0x)[0-9a-fA-F]+(\.\.\.)?$/) != null

                      if (minifyText($(this).val()).length <= 0)
                        throw $(this).removeClass('is-invalid')

                      $(this).toggleClass('is-invalid', !isValidBlob)

                      effectedNodes[inputID] = {
                        inputValue: $(this).val(),
                        dataValue: $(this).data('value')
                      }
                    } catch (e) {}

                    try {
                      relatedNode.find('div.clear-field').toggleClass('hide', $(this).val().length <= 0)
                    } catch (e) {}

                    setTimeout(() => {
                      try {
                        updateActionStatusForInsertRow()
                      } catch (e) {}
                    })
                  })

                  let tippyInstances = []

                  tableFieldsTreeContainer.find('a.dropdown-item').on('click', function() {
                    let btnAction = $(this).attr('action')

                    switch (btnAction) {
                      case 'function': {
                        let functionContent = $(this).attr('data-function'),
                          inputField = $(this).parent().parent().parent().parent().find('input'),
                          inputObject = getElementMDBObject(inputField)

                        inputField.val(`${functionContent}`).trigger('input')

                        try {
                          inputObject.update()
                        } catch (e) {}

                        break
                      }
                      case 'datetimepicker': {
                        let viewMode = $(this).attr('data-view-mode'),
                          inputField = $(this).parent().parent().parent().parent().find('input'),
                          inputObject = getElementMDBObject(inputField)

                        try {
                          let tippyReference = $(this).parent().parent().parent().find('button'),
                            tippyInstance = tippyInstances.find((instance) => $(instance.reference).is(tippyReference))

                          if (tippyInstance != undefined) {
                            try {
                              tippyInstance.enable()
                              tippyInstance.show()
                            } catch (e) {}

                            throw 0
                          }

                          let pickerContainerID = getRandom.id(30),
                            isDataCleared = false

                          tippyInstance = tippy(tippyReference[0], {
                            content: `<div id="_${pickerContainerID}"></div>`,
                            appendTo: () => document.body,
                            allowHTML: true,
                            arrow: false,
                            interactive: true,
                            placement: 'right-start',
                            trigger: 'click',
                            theme: 'material',
                            showOnCreate: true,
                            onShow(instance) {
                              let popper = $(instance.popper),
                                reference = $(instance.reference),
                                inputField = reference.parent().parent().find('input'),
                                inputObject = getElementMDBObject(inputField)

                              if (popper.find('div.row, form').length != 0)
                                return

                              setTimeout(() => {
                                try {
                                  if (viewMode != 'HMS-D')
                                    throw 0

                                  let [
                                    yearsInputID,
                                    monthsInputID,
                                    daysInputID,
                                    hoursInputID,
                                    minutesInputID,
                                    secondsInputID,
                                    clearBtnID,
                                    confirmBtnID
                                  ] = getRandom.id(10, 8).map((id) => `_${id}_du`),
                                    durationForm = `
                                    <div class="row for-duration">
                                      <div class="input-group">
                                      <div class="input-group-text" style="height: 29px; font-size: 100%;">
                                          <span mulang="period" capitalize></span>
                                        </div>
                                        <div class="form-outline form-white">
                                          <input type="number" step="1" min="0" class="form-control form-control-sm" id="${yearsInputID}" data-part-suffix="Y">
                                          <label class="form-label">
                                            <span mulang="years" capitalize></span>
                                          </label>
                                        </div>
                                        <div class="form-outline form-white">
                                          <input type="number" step="1" min="0" class="form-control form-control-sm" id="${monthsInputID}" data-part-suffix="M">
                                          <label class="form-label">
                                            <span mulang="months" capitalize></span>
                                          </label>
                                        </div>
                                        <div class="form-outline form-white">
                                          <input type="number" step="1" min="0" class="form-control form-control-sm" id="${daysInputID}" data-part-suffix="D">
                                          <label class="form-label">
                                            <span mulang="days" capitalize></span>
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="row for-duration">
                                      <div class="input-group">
                                        <div class="input-group-text" style="height: 29px; font-size: 100%;">
                                          <span mulang="time" capitalize></span>
                                        </div>
                                        <div class="form-outline form-white">
                                          <input type="number" step="1" min="0" class="form-control form-control-sm" id="${hoursInputID}" data-part-suffix="H">
                                          <label class="form-label">
                                            <span mulang="hours" capitalize></span>
                                          </label>
                                        </div>
                                        <div class="form-outline form-white">
                                          <input type="number" step="1" min="0" class="form-control form-control-sm" id="${minutesInputID}" data-part-suffix="M">
                                          <label class="form-label">
                                            <span mulang="minutes" capitalize></span>
                                          </label>
                                        </div>
                                        <div class="form-outline form-white">
                                          <input type="number" step="1" min="0" class="form-control form-control-sm" id="${secondsInputID}" data-part-suffix="S">
                                          <label class="form-label">
                                            <span mulang="seconds" capitalize></span>
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="row for-duration">
                                      <div class="col-md-4">
                                        <button type="button" class="btn btn-secondary btn-sm" id="${clearBtnID}">
                                          <span mulang="clear"></span>
                                        </button>
                                      </div>
                                      <div class="col-md-8">
                                        <button type="button" class="btn btn-primary changed-bg changed-color btn-sm" id="${confirmBtnID}">
                                          <span mulang="confirm"></span>
                                        </button>
                                      </div>
                                    </div>`

                                  $(`div#_${pickerContainerID}`).append($(durationForm).show(function() {
                                    let durationFormElement = $(this)

                                    setTimeout(() => durationFormElement.find('input').each(function() {
                                      setTimeout(() => getElementMDBObject($(this)))
                                    }))

                                    setTimeout(() => durationFormElement.find('button').each(function() {
                                      getElementMDBObject($(this), 'Button')
                                    }))

                                    setTimeout(() => Modules.Localization.applyLanguageSpecific(durationFormElement.find('span[mulang], [data-mulang]')))

                                    setTimeout(() => {
                                      $(`button#${clearBtnID}`).add(`button#${confirmBtnID}`).unbind('click')

                                      $(`button#${clearBtnID}`).click(function() {
                                        for (let durationInputField of $(this).parent().parent().parent().find('input').get()) {
                                          $(durationInputField).val(``).trigger('input')

                                          try {
                                            let durationInputObject = getElementMDBObject($(durationInputObject))

                                            durationInputObject.update()
                                            setTimeout(() => durationInputObject._deactivate())
                                          } catch (e) {}
                                        }

                                        inputField.val(``).trigger('input')

                                        try {
                                          inputObject.update()
                                          setTimeout(() => inputObject._deactivate())
                                        } catch (e) {}

                                        setTimeout(() => {
                                          try {
                                            updateActionStatusForInsertRow()
                                          } catch (e) {}
                                        })
                                      })

                                      $(`button#${confirmBtnID}`).click(function() {
                                        try {
                                          let duration = `P`

                                          try {
                                            let periodInputFields = [yearsInputID, monthsInputID, daysInputID]

                                            for (let periodInputFieldID of periodInputFields) {
                                              let inputElement = $(`input#${periodInputFieldID}`),
                                                inputSuffix = inputElement.attr('data-part-suffix'),
                                                inputValue = parseInt(inputElement.val()) >= 1 ? `${inputElement.val()}${inputSuffix}` : ''

                                              duration += inputValue
                                            }
                                          } catch (e) {}

                                          try {
                                            let timeInputFields = [hoursInputID, minutesInputID, secondsInputID],
                                              tempTxt = ''

                                            for (let timeInputFieldID of timeInputFields) {
                                              let inputElement = $(`input#${timeInputFieldID}`),
                                                inputSuffix = inputElement.attr('data-part-suffix'),
                                                inputValue = parseInt(inputElement.val()) >= 1 ? `${inputElement.val()}${inputSuffix}` : ''

                                              tempTxt += inputValue
                                            }

                                            if (tempTxt.length <= 0)
                                              throw 0

                                            duration += `T${tempTxt}`
                                          } catch (e) {}

                                          duration = duration == 'P' ? '' : duration

                                          inputField.val(duration).trigger('input')

                                          try {
                                            inputObject.update()
                                          } catch (e) {}
                                        } catch (e) {} finally {
                                          try {
                                            instance.disable()
                                            instance.hide()
                                          } catch (e) {}
                                        }

                                        setTimeout(() => {
                                          try {
                                            updateActionStatusForInsertRow()
                                          } catch (e) {}
                                        })
                                      })
                                    })
                                  }))

                                  return
                                } catch (e) {}

                                setTimeout(() => $(instance.popper).find('div.tippy-content').addClass('no-padding'))

                                setTimeout(() => $(`div#_${pickerContainerID}`).datetimepicker({
                                  date: new Date(),
                                  viewMode,
                                  onClear: () => {
                                    inputField.val('').trigger('input')

                                    isDataCleared = true

                                    try {
                                      inputObject.update()
                                      setTimeout(() => inputObject._deactivate())
                                    } catch (e) {}

                                    setTimeout(() => {
                                      try {
                                        updateActionStatusForInsertRow()
                                      } catch (e) {}
                                    })
                                  },
                                  onDateChange: function() {
                                    isDataCleared = this.getValue() == null
                                  },
                                  onOk: function() {
                                    try {
                                      if (isDataCleared)
                                        throw 0

                                      let dateTimeValue = this.getText(viewMode == 'YMDHMS' ? 'YYYY-MM-DD HH:mm:ss.i' : (viewMode == 'YMD' ? 'YYYY-MM-DD' : 'HH:mm:ss.i'))

                                      try {
                                        if (viewMode != 'YMDHMS')
                                          throw 0

                                        dateTimeValue = new Date(this.getValue()).getTime()
                                      } catch (e) {}

                                      inputField.val(`${dateTimeValue}`).trigger('input')

                                      try {
                                        inputObject.update()
                                      } catch (e) {}

                                    } catch (e) {} finally {
                                      try {
                                        instance.disable()
                                        instance.hide()
                                      } catch (e) {}
                                    }

                                    setTimeout(() => {
                                      try {
                                        updateActionStatusForInsertRow()
                                      } catch (e) {}
                                    })
                                  }
                                }))
                              })
                            },
                            onHidden(instance) {
                              try {
                                instance.disable()
                                instance.hide()
                              } catch (e) {}
                            },
                          })

                          tippyInstances.push(tippyInstance)
                        } catch (e) {}

                        break
                      }
                      case 'upload-item': {
                        let inputField = $(this).parent().parent().parent().parent().find('input'),
                          inputObject = getElementMDBObject(inputField),
                          dialogID = getRandom.id(5),
                          data = {
                            id: dialogID,
                            title: I18next.capitalizeFirstLetter(I18next.t('upload item for BLOB field')),
                            properties: ['showHiddenFiles', 'createDirectory', 'promptToCreate', 'openFile']
                          }

                        // Send a request to the main thread to create a dialog
                        IPCRenderer.send('dialog:create', data)

                        // Listen for the response
                        IPCRenderer.on(`dialog:${dialogID}`, (_, selected) => {
                          try {
                            IPCRenderer.removeAllListeners(`dialog:${dialogID}`)
                          } catch (e) {}

                          if (selected.length <= 0) {
                            inputField.val('').trigger('input')

                            inputField.data('value', '')

                            try {
                              inputObject.update()

                              setTimeout(() => inputObject._deactivate())
                            } catch (e) {}

                            return
                          }

                          let selectedItem = selected[0]

                          Modules.Config.getConfig((config) => {
                            let maxItemSize = config.get('limit', 'insertBlobSize') || '2MB'

                            try {
                              maxItemSize = Bytes(maxItemSize) || 2097152
                            } catch (e) {}

                            FS.stat(selectedItem, (err, stats) => {
                              if (err)
                                return

                              let itemSize = stats.size

                              if (itemSize > maxItemSize)
                                return showToast(I18next.capitalize(I18next.t('upload item')), I18next.capitalizeFirstLetter(I18next.replaceData('the size of the uploaded item is [b]$data[/b], which is greater than the maximum allowed size of [b]$data[/b]. Please consider to change that in the config file or try with smaller item', [Bytes(itemSize), Bytes(maxItemSize)])) + '.', 'failure')

                              let requestID = getRandom.id(20),
                                ringSpinnerElement = $(this).parent().parent().parent().children('svg[l-ring-2]'),
                                showRingSpinnerTimeout = null,
                                showRingSpinner = () => {
                                  try {
                                    clearTimeout(showRingSpinnerTimeout)
                                  } catch (e) {}

                                  showRingSpinnerTimeout = setTimeout(() => ringSpinnerElement.addClass('show'), 500)
                                }

                              showRingSpinner()

                              // Request to get the public key
                              IPCRenderer.send('blob:read-convert', {
                                requestID,
                                itemPath: selectedItem
                              })

                              // Wait for the response
                              IPCRenderer.on(`blob:read-convert:result:${requestID}`, (_, data) => {
                                try {
                                  IPCRenderer.removeAllListeners(`blob:read-convert:result:${requestID}`)
                                } catch (e) {}

                                inputField.data('value', data.itemHEXString)

                                data.itemHEXString = data.itemHEXString.length <= 0 ? '' : (data.itemHEXString.length > 100 ? `${data.itemHEXString.slice(0, 100)}...` : data.itemHEXString)

                                inputField.val(data.itemHEXString).trigger('input')

                                try {
                                  inputObject.update()
                                } catch (e) {}

                                try {
                                  clearTimeout(showRingSpinnerTimeout)
                                } catch (e) {}

                                ringSpinnerElement.removeClass('show')
                              })
                            })
                          })
                        })

                        break
                      }
                      case 'preview-item': {
                        let inputField = $(this).parent().parent().parent().parent().find('input')

                        try {
                          let blobHEXString = inputField.data('value')

                          if (`${inputField.val()}`.slice(0, 100) != `${blobHEXString}`.slice(0, 100))
                            throw 0

                          getBlobType(blobHEXString, (err, result) => {
                            if (err || `${result.mime}`.includes('application'))
                              throw 0

                            let itemType = ''

                            try {
                              itemType = result.ext
                            } catch (e) {}

                            let requestID = getRandom.id(20),
                              ringSpinnerElement = $(this).parent().parent().parent().children('svg[l-ring-2]'),
                              showRingSpinnerTimeout = null,
                              showRingSpinner = () => {
                                try {
                                  clearTimeout(showRingSpinnerTimeout)
                                } catch (e) {}

                                showRingSpinnerTimeout = setTimeout(() => ringSpinnerElement.addClass('show'), 500)
                              }

                            showRingSpinner()

                            // Request to get the public key
                            IPCRenderer.send('blob:convert-write', {
                              requestID,
                              itemType,
                              blobHEXString,
                              randomID: getRandom.id(15)
                            })

                            // Wait for the response
                            IPCRenderer.on(`blob:convert-write:result:${requestID}`, (_, data) => {
                              try {
                                IPCRenderer.removeAllListeners(`blob:convert-write:result:${requestID}`)
                              } catch (e) {}

                              if (data.error)
                                throw 0

                              try {
                                Open(data.itemTempFile)
                              } catch (e) {}

                              try {
                                clearTimeout(showRingSpinnerTimeout)
                              } catch (e) {}

                              ringSpinnerElement.removeClass('show')
                            })
                          })
                        } catch (e) {
                          showToast(I18next.capitalize(I18next.t('preview item')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to finalize the preview process of the current item')) + '.', 'failure')
                        }

                        break
                      }
                    }

                    $(this).parent().parent().hide()

                    setTimeout(() => {
                      try {
                        updateActionStatusForInsertRow()
                      } catch (e) {}
                    })
                  })

                  setTimeout(() => {
                    tableFieldsTreeContainer.find('input').trigger('input')
                    tableFieldsTreeContainer.find('input').trigger('change')
                  })
                })

                setTimeout(() => Modules.Localization.applyLanguageSpecific(tableFieldsTreeContainer.find('span[mulang], [data-mulang]')))
              })

              let triggerLoadEventTimeOut = null,
                triggerLoadEvent = () => {
                  try {
                    clearTimeout(triggerLoadEventTimeOut)
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForInsertRow()
                    } catch (e) {}
                  })

                  triggerLoadEventTimeOut = setTimeout(() => tableFieldsTreeContainer.trigger('loaded.jstree'))
                }

              tableFieldsTreeContainer.on('create_node.jstree', function(e, data) {
                let parentNodeID = '_'

                try {
                  parentNodeID = data.node.parents.at(-2)
                } catch (e) {}

                try {
                  if (tableFieldsTreeContainer.find(`a.jstree-anchor[add-hidden-node="${parentNodeID}"]`).length <= 0)
                    throw 0

                  let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${parentNodeID}"]`)

                  hiddenNode.css('margin-top', '-45px')

                  hiddenNode.children('a').css('pointer-events', 'none')
                } catch (e) {}

                triggerLoadEvent()
              })

              tableFieldsTreeContainer.on('delete_node.jstree', function(e, data) {
                try {
                  data.instance.hide_node(data.node.id)
                } catch (e) {}

                setTimeout(() => {
                  try {
                    updateActionStatusForInsertRow()
                  } catch (e) {}
                })
              })

              tableFieldsTreeContainer.on('hide_node.jstree', () => triggerLoadEvent())

              tableFieldsTreeContainer.on('select_node.jstree', function(e, data) {
                let clickedNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${data.node.id}"]`)

                try {
                  let clickedTarget = $(data.event.target)

                  if (!clickedTarget.hasClass('focus-area'))
                    throw 0

                  let relatedInput = clickedTarget.parent().children('input')

                  setTimeout(() => {
                    try {
                      if (relatedInput.attr('type') != 'checkbox')
                        throw 0

                      if (relatedInput.prop('indeterminate')) {
                        relatedInput.prop('indeterminate', false)
                        relatedInput.prop('checked', true)
                        relatedInput.trigger('change')
                      } else {
                        if (!(relatedInput.prop('checked'))) {
                          relatedInput.prop('indeterminate', true)
                          relatedInput.trigger('change')
                        } else {
                          relatedInput.trigger('click')
                        }
                      }

                      return
                    } catch (e) {}

                    relatedInput.trigger('focus')
                  })
                } catch (e) {}

                setTimeout(() => {
                  try {
                    data.instance.deselect_all()
                  } catch (e) {}
                }, 100)
              })
            }
          })

          $('div.modal#rightClickActionsMetadata div[action]').hide()
          $('div.modal#rightClickActionsMetadata div[action="insert-row"]').show()

          $('div.modal#rightClickActionsMetadata').addClass('insertion-action')

          $('#rightClickActionsMetadata').removeClass('show-editor')

          rightClickActionsMetadataModal.show()

          setTimeout(() => {
            try {
              updateActionStatusForInsertRow()
            } catch (e) {}
          })
        })
      })

      {
        let tableFieldsDeleteTreeContainers = {
          primaryKey: $('div#tableFieldsPrimaryKeyTreeDeleteAction'),
          columnsRegular: $('div#tableFieldsRegularColumnsTreeDeleteAction'),
          columnsCollection: $('div#tableFieldsCollectionColumnsTreeDeleteAction'),
          columnsUDT: $('div#tableFieldsUDTColumnsTreeDeleteAction')
        }

        IPCRenderer.on('delete-row-column', (_, data) => {
          Modules.Config.getConfig((config) => {
            let enableBlobPreview = false

            try {
              enableBlobPreview = config.get('features', 'previewBlob') == 'true'
            } catch (e) {}

            // Get the MDB object of the related modal
            let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal')

            // Update the execution button's attributes
            $('button#executeActionStatement').attr({
              'data-tab-id': `${data.tabID}`,
              'data-textarea-id': `${data.textareaID}`,
              'data-btn-id': `${data.btnID}`
            })

            $('#rightClickActionsMetadata').find('div.modal-body').css('height', 'auto')

            $('#rightClickActionsMetadata').attr({
              'data-state': null,
              'data-keyspace-name': `${data.keyspaceName}`,
              'data-table-name': `${data.tableName}`
            })

            try {
              $('div.dropdown[for-select="deleteWriteConsistencyLevel"]').find(`a[value="${activeSessionsConsistencyLevels[activeConnectionID].standard}"]`).click()
            } catch (e) {}

            try {
              $('div.dropdown[for-select="deleteSerialConsistencyLevel"]').find(`a[value="${activeSessionsConsistencyLevels[activeConnectionID].serial}"]`).click()
            } catch (e) {}

            // Update different modal's attributes
            $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'delete row/column').html(`${I18next.capitalize(I18next.t('delete row/column'))} <span class="keyspace-table-info badge rounded-pill badge-secondary" style="text-transform: none; background-color: rgba(235, 237, 239, 0.15); color: #ffffff;">${data.keyspaceName}.${data.tableName}</span>`)

            $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

            $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

            try {
              for (let container of Object.keys(tableFieldsDeleteTreeContainers)) {
                try {
                  tableFieldsDeleteTreeContainers[container].jstree('destroy')
                } catch (e) {}
              }
            } catch (e) {}

            let keys = [],
              columns = [],
              udts = [],
              keyspaceUDTs = []

            try {
              let tableObj = JSON.parse(JSONRepair(data.tables)).find((table) => table.name == data.tableName)

              try {
                keys = tableObj.primary_key.map((key) => {
                  let isPartition = tableObj.partition_key.find((partitionKey) => partitionKey.name == key.name) != undefined

                  return {
                    name: key.name,
                    type: key.cql_type,
                    isPartition
                  }
                })
              } catch (e) {}

              try {
                columns = tableObj.columns.filter((column) => tableObj.primary_key.find((key) => key.name == column.name) == undefined)
                  .map((column) => {
                    return {
                      name: column.name,
                      type: column.cql_type,
                      isStatic: column.is_static
                    }
                  })
              } catch (e) {}

              try {
                try {
                  keyspaceUDTs = JSON.parse(JSONRepair(data.udts))
                } catch (e) {}

                for (let column of columns) {
                  let udtStructure = {},
                    manipulatedColumnType = column.type

                  manipulatedColumnType = removeFrozenKeyword(`${manipulatedColumnType}`)

                  try {
                    manipulatedColumnType = `${manipulatedColumnType}`.match(/<(.*?)>$/)[1];
                  } catch (e) {}

                  let udtObject = keyspaceUDTs.find((udt) => udt.name == manipulatedColumnType)

                  if (udtObject == undefined || ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`)))
                    continue

                  udtStructure = {
                    ...udtObject,
                    ...column
                  }

                  udts.push(udtStructure)
                }

                columns = columns.filter((column) => udts.find((udt) => udt.name == column.name) == undefined)
              } catch (e) {}
            } catch (e) {}

            let groupStructure = buildTableFieldsTreeview(keys, columns, udts, keyspaceUDTs, false, null, true),
              handleHiddenNodes = (treeData) => {
                let index = 0

                while (index < treeData.length) {
                  const node = treeData[index]

                  try {
                    if (Array.isArray(node)) {
                      processArray(node)

                      index++

                      continue
                    }

                    if (node.a_attr['add-hidden-node'] !== undefined) {
                      treeData.splice(index + 1, 0, {
                        id: node.a_attr['add-hidden-node'],
                        parent: node.parent,
                        state: {
                          opened: true,
                          selected: false
                        },
                        text: ``
                      })

                      index++
                    }
                  } catch (e) {}

                  index++

                }
                return treeData;
              },
              handleNodeCreationDeletion = () => {
                let allInsertionRelatedInputs = $('#rightClickActionsMetadata').find('div[action="delete-row-column"]').find('input').get()

                for (let inputDOM of allInsertionRelatedInputs) {
                  if ($(inputDOM).hasClass('operators-dropdown'))
                    continue

                  let input = $(inputDOM),
                    [
                      inputCassandraType,
                      inputHTMLType,
                      inputID
                    ] = getAttributes(input, ['data-field-type', 'type', 'id']),
                    inputSavedValue = effectedNodes[inputID] || ''

                  if (inputSavedValue == undefined || inputSavedValue.length <= 0)
                    continue

                  try {
                    if (inputHTMLType != 'checkbox')
                      throw 0

                    if (input.attr('data-set-indeterminate') == 'true') {
                      input.attr('data-set-indeterminate', null)

                      input.prop('indeterminate', true)

                      input.trigger('change')

                      throw 0
                    }

                    input.prop('checked', inputSavedValue == 'indeterminate' ? true : !(inputSavedValue != 'true'))

                    input.prop('indeterminate', inputSavedValue == 'indeterminate')

                    input.trigger('change')

                    continue
                  } catch (e) {}

                  try {
                    if (inputCassandraType != 'blob')
                      throw 0

                    input.val(inputSavedValue.inputValue).trigger('input')

                    input.data('value', inputSavedValue.dataValue)

                    continue
                  } catch (e) {}

                  // Not `blob` or `boolean`
                  try {
                    input.val(inputSavedValue).trigger('input')
                  } catch (e) {}
                }

                setTimeout(() => {
                  try {
                    updateActionStatusForDeleteRowColumn()
                  } catch (e) {}
                })
              }

            try {
              for (let treeViewType of Object.keys(groupStructure))
                groupStructure[treeViewType].core.data = handleHiddenNodes(groupStructure[treeViewType].core.data)
            } catch (e) {}

            {
              let primaryKeyTreeElements = tableFieldsDeleteTreeContainers.primaryKey.add('div#deletePrimaryKeyBadge')

              try {
                if (keys.length <= 0)
                  throw 0

                primaryKeyTreeElements.show()

                try {
                  groupStructure.primaryKey.core.data = groupStructure.primaryKey.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let primaryKeyTreeObject = tableFieldsDeleteTreeContainers.primaryKey.jstree(groupStructure.primaryKey)

                try {
                  primaryKeyTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  primaryKeyTreeObject.on('loaded.jstree', () => setTimeout(() => primaryKeyTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${primaryKeyTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                primaryKeyTreeElements.hide()
              }
            }

            let areNonPKColumnsExist = false

            {
              let columnsRegularTreeElements = tableFieldsDeleteTreeContainers.columnsRegular.add('div#deleteRegularColumnsBadge')

              try {
                if (!(columns.some((column) => ['map', 'set', 'list'].every((type) => !(`${column.type}`.includes(`${type}<`))))))
                  throw 0

                areNonPKColumnsExist = true

                columnsRegularTreeElements.show()

                try {
                  groupStructure.regularColumns.core.data = groupStructure.regularColumns.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let regularColumnsTreeObject = tableFieldsDeleteTreeContainers.columnsRegular.jstree(groupStructure.regularColumns)

                try {
                  regularColumnsTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  regularColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => regularColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${regularColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                columnsRegularTreeElements.hide()
              }
            }

            {
              let columnsCollectionTreeElements = tableFieldsDeleteTreeContainers.columnsCollection.add('div#deleteCollectionColumnsBadge')

              try {
                if (!(columns.some((column) => ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`)))))
                  throw 0

                areNonPKColumnsExist = true

                columnsCollectionTreeElements.show()

                try {
                  groupStructure.collectionColumns.core.data = groupStructure.collectionColumns.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let collectionColumnsTreeObject = tableFieldsDeleteTreeContainers.columnsCollection.jstree(groupStructure.collectionColumns)

                try {
                  collectionColumnsTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  collectionColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => collectionColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${collectionColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                columnsCollectionTreeElements.hide()
              }
            }

            {
              let columnsUDTTreeElements = tableFieldsDeleteTreeContainers.columnsUDT.add('div#deleteUDTColumnsBadge')
              try {
                if (udts.length <= 0)
                  throw 0

                areNonPKColumnsExist = true

                columnsUDTTreeElements.show()

                try {
                  groupStructure.udtColumns.core.data = groupStructure.udtColumns.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let udtColumnsTreeObject = tableFieldsDeleteTreeContainers.columnsUDT.jstree(groupStructure.udtColumns)

                try {
                  udtColumnsTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  udtColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => udtColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${udtColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                columnsUDTTreeElements.hide()
              }
            }

            $('div#tableFieldsNonPKColumnsDeleteAction').add('div#deleteNonPKColumns').add('div.delete-columns-hint').toggle(areNonPKColumnsExist)

            $('input#deleteIfColumnOption').attr('disabled', !areNonPKColumnsExist ? '' : null)

            $('input#deleteNoSelectOption').prop('checked', true)
            $('input#deleteNoSelectOption').trigger('change')

            $('div[action="delete-row-column"] div[section="standard"]').click()

            try {
              $('#deleteTimestamp').val('').trigger('input')

              getElementMDBObject($('#deleteTimestamp')).update()
            } catch (e) {}

            let deleteNonPKColumnsContainer = $('div#tableFieldsNonPKColumnsDeleteAction div.columns')

            deleteNonPKColumnsContainer.children('div.column').remove()

            for (let nonPKColumn of [...columns, ...udts]) {
              try {
                let columnType = EscapeHTML(`${nonPKColumn.type}`).slice(0, 20),
                  element = `
                    <div data-name="${nonPKColumn.name}" data-type="${nonPKColumn.type}" class="column btn btn-tertiary" data-mdb-ripple-color="light">
                      <ion-icon name="trash"></ion-icon>
                      <div class="name">${nonPKColumn.name}</div>
                      <div class="type">
                        ${columnType}${nonPKColumn.type.length > 20 ? '...' : ''}
                      </div>
                      <div class="is-static" ${!nonPKColumn.isStatic ? 'hidden' : ''}>Static</div>
                    </div>`

                deleteNonPKColumnsContainer.append($(element).show((function() {
                  let columnBtn = $(this)

                  setTimeout(() => $(this).click(() => {
                    columnBtn.add($('#tableFieldsRegularColumnsTreeDeleteAction, #tableFieldsCollectionColumnsTreeDeleteAction').find(`a.jstree-anchor[name="${$(this).attr('data-name')}"][type="${$(this).attr('data-type')}"]`)).toggleClass('deleted')

                    try {
                      updateActionStatusForDeleteRowColumn()
                    } catch (e) {}

                    $('input#toBeDeletedColumnsFilter').trigger('input')
                  }))
                })))
              } catch (e) {}
            }

            setTimeout(() => {
              for (let container of Object.keys(tableFieldsDeleteTreeContainers)) {
                let tableFieldsTreeContainer = tableFieldsDeleteTreeContainers[container]

                try {
                  tableFieldsTreeContainer.unbind('loaded.jstree')
                  tableFieldsTreeContainer.unbind('select_node.jstree')
                  tableFieldsTreeContainer.unbind('create_node.jstree')
                  tableFieldsTreeContainer.unbind('delete_node.jstree')
                  tableFieldsTreeContainer.unbind('hide_node.jstree')
                } catch (e) {}

                tableFieldsTreeContainer.on('loaded.jstree', () => {
                  setTimeout(() => {
                    try {
                      updateActionStatusForDeleteRowColumn()
                    } catch (e) {}
                  })

                  tableFieldsTreeContainer.find('a.jstree-anchor[add-hidden-node]').each(function() {
                    let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${$(this).attr('add-hidden-node')}"]`)

                    hiddenNode.css('margin-top', '-45px')

                    hiddenNode.children('a').css('pointer-events', 'none')
                  })

                  setTimeout(() => {
                    {
                      let allAddItemActionBtns = tableFieldsTreeContainer.find('button[action="add-item"]').get()

                      for (let addItemActionBtn of allAddItemActionBtns) {
                        try {
                          $(addItemActionBtn).unbind('click')
                        } catch (e) {}

                        $(addItemActionBtn).click(function() {
                          let relatedNode = $(this).parent().parent().parent(),
                            [
                              id,
                              type,
                              fieldType,
                              mandatory,
                              hiddenNodeID
                            ] = getAttributes(relatedNode, ['id', 'type', 'field-type', 'mandatory', 'add-hidden-node']),
                            isTypeMap = `${type}`.includes('map<'),
                            relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree(),
                            relatedHiddenNode = relatedTreeObject.element.find(`li[id="hiddenNodeID"]`)

                          try {
                            type = removeFrozenKeyword(`${type}`)
                          } catch (e) {}

                          try {
                            type = `${type}`.match(/<(.*?)>$/)[1]
                          } catch (e) {}

                          try {
                            if (!isTypeMap)
                              throw 0

                            type = `${type}`.replace(/\s+/, '').split(',')

                            type = type.map((subType) => {
                              try {
                                subType = removeFrozenKeyword(`${subType}`)
                              } catch (e) {}

                              subType = subType.replace(/(.*?)</gi, '').replace(/>(.*?)/gi, '')

                              return subType
                            })

                          } catch (e) {}

                          try {
                            if (typeof type != 'object')
                              throw 0

                            let itemMainNodeID = getRandom.id(30),
                              itemMainNodeStrucutre = {
                                id: itemMainNodeID,
                                parent: hiddenNodeID,
                                state: {
                                  opened: true,
                                  selected: false
                                },
                                a_attr: {
                                  'is-map-item': true
                                },
                                text: `
                                <div class="input-group">
                                  <div class="input-group-text for-deletion for-name ignored-applied">
                                    <span class="name">
                                      <span mulang="name" capitalize></span>
                                      <ion-icon name="right-arrow-filled"></ion-icon>
                                    </span>
                                    <span class="name-value">Item #${getRandom.id(3)}</span>
                                  </div>
                                  <div class="input-group-text for-deletion for-actions ignored-applied">
                                    <span class="actions">
                                      <span mulang="actions" capitalize></span>
                                      <ion-icon name="right-arrow-filled"></ion-icon>
                                    </span>
                                    <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="delete-item">
                                      <ion-icon name="trash-outline"></ion-icon>
                                      <span mulang="delete item"></span>
                                    </button>
                                  </div>
                                </div>`
                              }

                            let mapKeyUDTObject = keyspaceUDTs.find((udt) => udt.name == type[0]),
                              mapKeyObject = {
                                isUDT: mapKeyUDTObject != undefined,
                                name: ``,
                                type: type[0],
                                fieldType: 'collection-map-key',
                                isMandatory: false,
                                noEmptyValue: true
                              },
                              mapKeyStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, enableBlobPreview, mapKeyObject.isUDT ? {
                                ...mapKeyUDTObject,
                                ...mapKeyObject
                              } : mapKeyObject)

                            let mapValueUDTObject = keyspaceUDTs.find((udt) => udt.name == type[1]),
                              mapValueObject = {
                                isUDT: mapValueUDTObject != undefined,
                                name: ``,
                                type: type[1],
                                fieldType: 'collection-map-value',
                                isMandatory: false,
                                noEmptyValue: true
                              },
                              mapValueStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, enableBlobPreview, mapValueObject.isUDT ? {
                                ...mapValueUDTObject,
                                ...mapValueObject
                              } : mapValueObject)

                            try {
                              mapKeyStructure.parent = itemMainNodeID
                            } catch (e) {}

                            try {
                              mapValueStructure.parent = itemMainNodeID
                            } catch (e) {}

                            let allNewNodes = []

                            try {
                              if (Array.isArray(itemMainNodeStrucutre)) {
                                allNewNodes = allNewNodes.concat(itemMainNodeStrucutre)
                              } else {
                                allNewNodes.push(itemMainNodeStrucutre)
                              }
                            } catch (e) {}

                            try {
                              if (Array.isArray(mapKeyStructure)) {
                                allNewNodes = allNewNodes.concat(mapKeyStructure)
                              } else {
                                allNewNodes.push(mapKeyStructure)
                              }
                            } catch (e) {}

                            try {
                              if (Array.isArray(mapValueStructure)) {
                                allNewNodes = allNewNodes.concat(mapValueStructure)
                              } else {
                                allNewNodes.push(mapValueStructure)
                              }
                            } catch (e) {}

                            try {
                              allNewNodes = flattenArray(allNewNodes)
                            } catch (e) {}

                            try {
                              allNewNodes = handleHiddenNodes(allNewNodes)
                            } catch (e) {}

                            for (let i = 0; i < allNewNodes.length; i++) {
                              let node = allNewNodes[i]

                              try {
                                if (node.parent != '#')
                                  throw 0

                                allNewNodes[i].parent = itemMainNodeID
                              } catch (e) {}

                              try {
                                let nodeText = Cheerio.load(allNewNodes[i].text)

                                try {
                                  nodeText('body').find('div.input-group-text.for-not-ignoring').attr('hidden', '')
                                } catch (e) {}

                                allNewNodes[i].text = nodeText('body').html()
                              } catch (e) {}

                              try {
                                relatedTreeObject.create_node(allNewNodes[i].parent, allNewNodes[i])
                              } catch (e) {}

                              try {
                                handleNodeCreationDeletion()
                              } catch (e) {}
                            }

                            return
                          } catch (e) {}

                          let nodeUDTType = keyspaceUDTs.find((udt) => udt.name == type),
                            nodeTypeObject = {
                              isUDT: nodeUDTType != undefined,
                              name: ``,
                              type: type,
                              fieldType: 'collection-type',
                              isMandatory: false,
                              noEmptyValue: true
                            },
                            nodeTypeStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, enableBlobPreview, nodeTypeObject.isUDT ? {
                              ...nodeUDTType,
                              ...nodeTypeObject
                            } : nodeTypeObject)

                          try {
                            nodeTypeStructure = Array.isArray(nodeTypeStructure) ? flattenArray(nodeTypeStructure) : [nodeTypeStructure]
                          } catch (e) {}

                          try {
                            nodeTypeStructure = handleHiddenNodes(nodeTypeStructure)
                          } catch (e) {}

                          for (let i = 0; i < nodeTypeStructure.length; i++) {
                            try {
                              if (nodeTypeStructure[i].parent != '#')
                                throw 0

                              let nodeText = Cheerio.load(nodeTypeStructure[i].text),
                                deleteItemBtn = `
                            <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="delete-item">
                              <ion-icon name="trash-outline"></ion-icon>
                              <span mulang="delete item"></span>
                            </button>`

                              try {
                                nodeText('body').find('div.input-group-text.for-not-ignoring').attr('hidden', '')
                              } catch (e) {}

                              let actionsGroup = nodeText('div.input-group-text.for-actions')

                              if (actionsGroup.length != 0) {
                                actionsGroup.find('button').before(deleteItemBtn)
                              } else {
                                let actionsGroupContainer = `
                                <div class="input-group-text for-deletion for-actions ignored-applied">
                                  <span class="actions">
                                    <span mulang="actions" capitalize></span>
                                    <ion-icon name="right-arrow-filled"></ion-icon>
                                  </span>
                                  ${deleteItemBtn}
                                </div>`

                                nodeText('div.input-group').append(actionsGroupContainer)
                              }

                              nodeTypeStructure[i].text = nodeText('body').html()

                              nodeTypeStructure[i].parent = hiddenNodeID
                            } catch (e) {}

                            try {
                              relatedTreeObject.create_node(nodeTypeStructure[i].parent, {
                                ...nodeTypeStructure[i]
                              })
                            } catch (e) {}

                            try {
                              handleNodeCreationDeletion()
                            } catch (e) {}
                          }

                          try {
                            updateActionStatusForDeleteRowColumn()
                          } catch (e) {}
                        })
                      }

                      let allDeleteItemActionBtns = tableFieldsTreeContainer.find('button[action="delete-item"]').get()

                      for (let deleteItemActionBtn of allDeleteItemActionBtns) {
                        try {
                          $(deleteItemActionBtn).unbind('click')
                        } catch (e) {}

                        $(deleteItemActionBtn).click(function() {
                          let relatedNode = $(this).parent().parent().parent(),
                            relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree()

                          try {
                            let deletedNode = relatedTreeObject.get_node(relatedNode)

                            relatedTreeObject.delete_node(deletedNode)

                            try {
                              handleNodeCreationDeletion()
                            } catch (e) {}
                          } catch (e) {}
                        })
                      }
                    }

                    {
                      let allClearFieldBtns = tableFieldsTreeContainer.find('div.clear-field div.btn').get()

                      for (let clearFieldBtn of allClearFieldBtns) {
                        try {
                          $(clearFieldBtn).unbind('click')
                        } catch (e) {}

                        $(clearFieldBtn).click(function() {
                          let relatedNode = $(this).closest('a.jstree-anchor'),
                            rlatedInutField = relatedNode.find('div[data-is-main-input="true"]').find('input'),
                            inputObject = getElementMDBObject(rlatedInutField)

                          try {
                            rlatedInutField.val('').trigger('input')
                          } catch (e) {}

                          try {
                            inputObject.update()
                            setTimeout(() => inputObject._deactivate())
                          } catch (e) {}

                          setTimeout(() => {
                            try {
                              updateActionStatusForDeleteRowColumn()
                            } catch (e) {}
                          })
                        })
                      }
                    }

                    {
                      let allNULLApplyBtns = tableFieldsTreeContainer.find('button[action="apply-null"]').get()

                      for (let applyBtn of allNULLApplyBtns) {
                        try {
                          $(applyBtn).unbind('click')
                        } catch (e) {}

                        $(applyBtn).click(function() {
                          let isNULLApplied = $(this).hasClass('applied')

                          $(this).closest('a.jstree-anchor').find('.null-related').toggleClass('null-applied', !isNULLApplied)
                          $(this).toggleClass('applied', !isNULLApplied)

                          setTimeout(() => {
                            try {
                              updateActionStatusForDeleteRowColumn()
                            } catch (e) {}
                          })
                        })
                      }
                    }

                    {
                      let allOperatorsContainers = tableFieldsTreeContainer.find('div.input-group-text.for-deletion.for-operators').get()

                      for (let operatorsContainerElement of allOperatorsContainers) {
                        let node = $(operatorsContainerElement).closest('a.jstree-anchor'),
                          isCollectionType = $(node).attr('is-collection-type') == 'true'

                        setTimeout(() => {
                          try {
                            $(operatorsContainerElement).find('label.btn').unbind('click')
                          } catch (e) {}

                          $(operatorsContainerElement).find('label.btn').click(function() {
                            $(this).parent().find(`input[id="${$(this).attr('for')}"]`).trigger('click')
                          })
                        })

                        setTimeout(() => {
                          try {
                            if (!isCollectionType)
                              throw 0

                            $(operatorsContainerElement).find('label[for="_operator_in"]').parent().remove()

                            $(operatorsContainerElement).find('a.dropdown-item[data-operator-id="_operator_in"]').parent().remove()
                          } catch (e) {}
                        })

                        setTimeout(() => {
                          try {
                            $(operatorsContainerElement).find(`button[data-id="hidden-operators-btn"]`).unbind('click')
                          } catch (e) {}

                          $(operatorsContainerElement).find(`button[data-id="hidden-operators-btn"]`).click(function(_, onlyHideUncheckedOps = false) {
                            let areOperatorsShown = $(node).hasClass('show-hidden-operators')

                            if (onlyHideUncheckedOps)
                              areOperatorsShown = true

                            $(node).toggleClass('show-hidden-operators', !areOperatorsShown)

                            $(this).toggleClass('expanded', !areOperatorsShown)

                            $(this).closest('div.for-operators').find('div.btn-group.operators').find('span.checked').show()

                            $(this).closest('div.for-operators').find('div.btn-group.operators').find('span:not(.checked)').toggle(!areOperatorsShown)

                            $(this).closest('div.for-operators').css('width', areOperatorsShown ? '' : '100%')
                          })
                        })

                        let allOperators = tableFieldsTreeContainer.find('div.btn-group.operators').find('input[type="radio"]')

                        for (let operator of allOperators.get()) {
                          setTimeout(() => {
                            try {
                              $(operator).unbind('change')
                            } catch (e) {}

                            $(operator).on('change', function() {
                              let opNode = $(this).closest('a.jstree-anchor'),
                                allOperatorsInGroup = $(this).closest('div.btn-group.operators').find('input[type="radio"]'),
                                selectedOperator = $(allOperatorsInGroup).filter(':checked'),
                                isSelectedOperatorIN = selectedOperator.attr('id') == '_operator_in',
                                mainInput = opNode.find('div.form-outline[data-is-main-input="true"]').find('input'),
                                relatedTreeObject = opNode.closest('div.table-fields-tree').jstree()

                              opNode.find('div.form-outline[data-is-main-input="true"]').toggle(!isSelectedOperatorIN)

                              opNode.find('div.input-group-text.for-actions').toggle(isSelectedOperatorIN)

                              if (isSelectedOperatorIN) {
                                setTimeout(() => mainInput.val('').trigger('input'))
                              } else {
                                try {
                                  relatedTreeObject.delete_node(relatedTreeObject.get_node(opNode.attr('add-hidden-node')).children_d)
                                } catch (e) {}
                              }

                              let spanParent = $(this).parent(),
                                operatorsGroup = spanParent.closest('div.btn-group.operators')

                              operatorsGroup.children('span').removeClass('checked')

                              spanParent.addClass('checked')
                            })
                          })

                          setTimeout(() => {
                            try {
                              if (!isCollectionType)
                                throw 0

                              $(operatorsContainerElement).find('label[for="_operator_in"]').parent().remove()

                              $(operatorsContainerElement).find('a.dropdown-item[data-operator-id="_operator_in"]').parent().remove()
                            } catch (e) {}
                          })

                          setTimeout(() => Modules.Localization.applyLanguageSpecific($(node).find('span[mulang], [data-mulang]')))
                        }

                        setTimeout(() => Modules.Localization.applyLanguageSpecific($(node).find('span[mulang], [data-mulang]')))
                      }
                    }

                    {
                      setTimeout(() => {
                        let allHiddenOperatorsBtns = tableFieldsTreeContainer.find('button[data-id="hidden-operators-btn"]').get()

                        for (let hiddenOperatorsBtn of allHiddenOperatorsBtns)
                          $(hiddenOperatorsBtn).trigger('click', true)
                      })
                    }
                  })

                  setTimeout(() => {
                    try {
                      tableFieldsTreeContainer.find('div[data-is-main-input="true"]').find('input').unbind('input')
                      tableFieldsTreeContainer.find('div[data-is-main-input="true"]').find('input').unbind('change')
                    } catch (e) {}

                    tableFieldsTreeContainer.find('div[data-is-main-input="true"]').find('input').on('input change', function() {
                      let [
                        inputCassandraType,
                        inputHTMLType,
                        inputID
                      ] = getAttributes($(this), ['data-field-type', 'type', 'id']),
                        relatedNode = $(this).closest('a.jstree-anchor'),
                        isMandatory = relatedNode.attr('mandatory') == 'true',
                        isEmptyValueNotAllowed = relatedNode.attr('no-empty-value') == 'true',
                        isInputEmpty = false,
                        relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree()

                      /**
                       * Using `switch` here won't be suffiecnet as we need, in some cases, to check either one of the types, or both of them
                       * `boolean` type - `checkbox` input type
                       */
                      try {
                        if (inputHTMLType != 'checkbox')
                          throw 0

                        if ($(this).attr('data-set-indeterminate') == 'true') {
                          $(this).attr('data-set-indeterminate', null)

                          $(this).prop('indeterminate', true)
                        }

                        $(`label[for="${$(this).attr('id')}"]`).text($(this).prop('indeterminate') ? 'not set' : ($(this).prop('checked') ? 'true' : 'false'))

                        effectedNodes[inputID] = $(this).prop('indeterminate') ? 'indeterminate' : `${$(this).prop('checked')}`

                        $(this).removeClass('is-invalid')
                      } catch (e) {}

                      if ($(this).val().length <= 0)
                        isInputEmpty = true

                      let addIsEmptyClass = true

                      try {
                        let parentID = relatedTreeObject.get_node(relatedNode.attr('static-id')).parents.at(-2),
                          parent = relatedTreeObject.get_node(parentID, true),
                          finalNode = parentID == undefined ? relatedNode : $('#tableFieldsPrimaryKeyTreeDeleteAction').find(`a.jstree-anchor[static-id="${parentID}"]`)

                        if (finalNode.length <= 0)
                          finalNode = $('#tableFieldsPrimaryKeyTreeDeleteAction').find(`a.jstree-anchor[id="${parentID}_anchor"]`)

                        if (finalNode.attr('is-hidden-node') == 'true')
                          finalNode = $('#tableFieldsPrimaryKeyTreeDeleteAction').find(`a.jstree-anchor[static-id="${finalNode.attr('related-node-id')}"]`)

                        addIsEmptyClass = isInputEmpty && !$('#tableFieldsPrimaryKeyTreeDeleteAction').find('input:not([type="radio"])').first().closest('a.jstree-anchor').is(finalNode)
                      } catch (e) {}

                      $(this).add($(this).closest('div.form-outline')).toggleClass('is-empty', addIsEmptyClass)

                      try {
                        if (!($(this).val().length <= 0))
                          throw 0

                        relatedNode.find('div.clear-field').addClass('hide')

                        if (inputHTMLType != 'checkbox')
                          $(this).addClass('is-invalid')

                        setTimeout(() => {
                          try {
                            updateActionStatusForDeleteRowColumn()
                          } catch (e) {}
                        })

                        return
                      } catch (e) {}

                      $(this).removeClass('is-invalid')

                      if (inputHTMLType != 'checkbox')
                        effectedNodes[inputID] = $(this).val()

                      // `inet` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'inet')
                          throw 0

                        let ipValue = $(this).val(),
                          isValidIP = isIP(`${ipValue}`) != 0

                        if (minifyText(ipValue).length <= 0)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidIP)
                      } catch (e) {}

                      // `uuid` and `timeuuid` Cassandra types - `text` input type
                      try {
                        if (!(['uuid', 'timeuuid'].some((type) => inputCassandraType == type)))
                          throw 0

                        let uuidValue = $(this).val(),
                          isValidUUID = isUUID(`${uuidValue}`),
                          uuidFunction = inputCassandraType == 'uuid' ? 'uuid' : 'now'

                        if (minifyText(uuidValue).length <= 0 || uuidValue == `${uuidFunction}()`)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidUUID)
                      } catch (e) {}

                      // `timestamp` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'timestamp')
                          throw 0

                        let timestampValue = $(this).val()

                        try {
                          timestampValue = !isNaN(timestampValue) ? parseInt(timestampValue) : timestampValue
                        } catch (e) {}

                        let isValidTimestamp = !isNaN((new Date(timestampValue).getTime()))

                        if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_timestamp()')
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidTimestamp)
                      } catch (e) {}

                      // `date` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'date')
                          throw 0

                        let dateValue = $(this).val(),
                          isValidDate = (`${dateValue}`.match(/^\d{4}-\d{2}-\d{2}$/) != null || !isNaN(dateValue)) && !(isNaN(new Date(parseInt(dateValue)).getTime()))

                        if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_date()')
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidDate)
                      } catch (e) {}

                      // `time` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'time')
                          throw 0

                        let timeValue = $(this).val(),
                          isValidTime = (`${timeValue}`.match(/^\d{2}:\d{2}:\d{2}(\.\d+)*$/) != null || !isNaN(timeValue)) && !(isNaN(new Date(parseInt(timeValue)).getTime()))

                        if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_time()')
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidTime)
                      } catch (e) {}

                      // `duration` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'duration')
                          throw 0

                        let durationValue = $(this).val(),
                          isValidDuration = `${durationValue}`.match(/^P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d*\.?\d*S)?)?$/) != null

                        if (minifyText($(this).val()).length <= 0)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidDuration)
                      } catch (e) {}

                      // `blob` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'blob')
                          throw 0

                        let blobValue = $(this).val(),
                          isValidBlob = `${blobValue}`.match(/^(?:0x)[0-9a-fA-F]+(\.\.\.)?$/) != null

                        if (minifyText($(this).val()).length <= 0)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidBlob)

                        effectedNodes[inputID] = {
                          inputValue: $(this).val(),
                          dataValue: $(this).data('value')
                        }
                      } catch (e) {}

                      try {
                        relatedNode.find('div.clear-field').toggleClass('hide', $(this).val().length <= 0)
                      } catch (e) {}

                      setTimeout(() => {
                        try {
                          updateActionStatusForDeleteRowColumn()
                        } catch (e) {}
                      })
                    })

                    let tippyInstances = []

                    setTimeout(() => {
                      tableFieldsTreeContainer.find('input:not([type="radio"])').trigger('input')
                      tableFieldsTreeContainer.find('input:not([type="radio"])').trigger('change')

                      tableFieldsTreeContainer.find('button.expand-range.expanded').trigger('click')
                    })
                  })

                  // Handle Primary key of the table
                  try {
                    let nodes = tableFieldsTreeContainer.find('a.jstree-anchor:not(.hidden-node)').get()

                    for (let node of nodes) {
                      let isRelatedToHiddenNode = false

                      try {
                        let parentNode = $(node).closest('ul').parent().children('a.jstree-anchor').first()

                        isRelatedToHiddenNode = $(parentNode).closest('li').attr('is-hidden-node') == 'true'
                      } catch (e) {}

                      if (isRelatedToHiddenNode) {
                        $(node).attr({
                          'data-deletion-changes-applied': 'true',
                          'ignore-disable': container == 'primaryKey' ? 'true' : null
                        })

                        $(node).find('div.input-group-text.for-actions').find('button:not([action="delete-item"])').remove()
                      }

                      let isUDTType = {
                          column: $(node).attr('field-type') == 'udt-column',
                          field: $(node).attr('field-type') == 'udt-field'
                        },
                        isPartOfMap = `${$(node).attr('field-type')}`.startsWith('collection-map'),
                        isCollectionFieldType = $(node).attr('field-type') == 'collection-type'

                      setTimeout(() => {
                        try {
                          updateActionStatusForDeleteRowColumn()
                        } catch (e) {}
                      })

                      if (isRelatedToHiddenNode || $(node).attr('data-deletion-changes-applied') == 'true' || isUDTType.field || isPartOfMap || isCollectionFieldType)
                        continue

                      $(node).attr('data-deletion-changes-applied', 'true')

                      let operatorsDropDownID = `_${getRandom.id(10)}`

                      let isPartition = $(node).attr('partition') == 'true',
                        isCollectionType = $(node).attr('is-collection-type') == 'true',
                        isBooleanType = $(node).attr('type') == 'boolean',
                        hiddenOperatorsBtnID = `_${getRandom.id(10)}`,
                        operatorsContainerID = `_${getRandom.id(10)}`,
                        isTypeAllowed = !(['boolean', 'blob'].some((type) => $(node).attr('type') == type)),
                        rangeOperators = `
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_less_than" autocomplete="off" data-operator="<">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_less_than" data-mdb-ripple-init><</label>
                        </span>
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_greater_than" autocomplete="off" data-operator=">">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_greater_than" data-mdb-ripple-init>></label>
                        </span>
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_less_than_equal" autocomplete="off" data-operator="<=">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_less_than_equal" data-mdb-ripple-init><=</label>
                        </span>
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_greater_than_equal" autocomplete="off" data-operator=">=">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_greater_than_equal" data-mdb-ripple-init>>=</label>
                        </span>
                        <button id="${hiddenOperatorsBtnID}" data-id="hidden-operators-btn" type="button" class="btn btn-secondary btn-light btn-sm expand-range expanded" data-mdb-ripple-init>
                          <ion-icon name="arrow-up"></ion-icon>
                        </button>`,
                        rangeOperatorsDropDown = `
                        <li><a class="dropdown-item" href="#" value="<" data-operator-id="_operator_less_than"><</a></li>
                        <li><a class="dropdown-item" href="#" value=">" data-operator-id="_operator_greater_than">></a></li>
                        <li><a class="dropdown-item" href="#" value="<=" data-operator-id="_operator_less_than_equal"><=</a></li>
                        <li><a class="dropdown-item" href="#" value=">=" data-operator-id="_operator_greater_than_equal">>=</a></li>
                        `,
                        operatorsContainer = `
                        <div class="input-group-text for-deletion for-operators ignored-applied" style="z-index:0;">
                          <span class="operator">
                            <span mulang="operator" capitalize></span>
                            <ion-icon name="right-arrow-filled"></ion-icon>
                          </span>
                          <div class="btn-group operators" style="display: none;">
                            <span class="checked">
                              <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_equal" autocomplete="off" data-operator="=" checked>
                              <label class="btn btn-secondary btn-light btn-sm" for="_operator_equal" data-mdb-ripple-init>=</label>
                            </span>
                            <span>
                              <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_in" autocomplete="off" data-operator="IN">
                              <label class="btn btn-secondary btn-light btn-sm" for="_operator_in" data-mdb-ripple-init>IN</label>
                            </span>
                            ${!isPartition && !isCollectionType && isTypeAllowed ? rangeOperators : ''}
                          </div>
                          <div class="form-outline form-white operators-dropdown" style="z-index: 2; width: 70px;">
                            <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                            <input type="text" data-mdb-placement="bottom" data-mdb-html="true" class="form-control form-icon-trailing form-control-sm operators-dropdown" style="background-color: inherit; cursor: default; pointer-events:none; font-family: 'Terminal'; font-weight: bold;" id="${operatorsDropDownID}" value="=" readonly noopacity>
                            <div class="operators-dropdown-focusarea"></div>
                          </div>
                        </div>`

                      $(node).find('div.input-group').addClass('custom-width')

                      let actionsContainer = $(node).find('div.input-group').find('div.input-group-text.for-actions')

                      actionsContainer.find('span.actions').hide()

                      actionsContainer.find('button').css('transform-origin', 'left')

                      actionsContainer.addClass('block-display')

                      actionsContainer.hide()

                      actionsContainer.css('width', '100%')

                      actionsContainer.before($(operatorsContainer).show(function() {
                        let operatorsContainerElement = $(this),
                          tippyInputObject

                        setTimeout(() => $(this).find('label.btn').click(function() {
                          $(this).parent().find(`input[id="${$(this).attr('for')}"]`).trigger('click')
                        }))

                        // Add tippy
                        {
                          setTimeout(() => {
                            let tippyInput = $(node).find(`input[id="${operatorsDropDownID}"]`)

                            tippyInputObject = tippy(tippyInput[0], {
                              trigger: 'manual',
                              allowHTML: true,
                              arrow: false,
                              theme: 'material',
                              interactive: true,
                              onShown(instance) {
                                $(instance.popper).find(`ul.dropdown-menu`).find('a').click(function() {
                                  // Point at the input field related to the list
                                  let selectElement = $(`input#${$(instance.popper).find(`ul.dropdown-menu`).attr('for-select')}`),
                                    selectedValue = $(this).attr('value'),
                                    selectedValueID = $(this).attr('data-operator-id'),
                                    isTypeCollection = $(this).attr('data-is-collection') != undefined,
                                    isCollectionMap = $(this).attr('data-is-map') != undefined

                                  // Update the input's value
                                  selectElement.val(selectedValue).trigger('input')

                                  $(instance.reference).closest('div.input-group').find(`input[type="radio"][id="${selectedValueID}"]`).prop('checked', true).trigger('change')

                                  try {
                                    updateActionStatusForDeleteRowColumn()
                                  } catch (e) {}
                                })
                              }
                            })

                            try {
                              tippyInputObject.setContent(`
                                <ul class="dropdown-menu operators-dropdown show tippy-dropdown" for-select="${operatorsDropDownID}">
                                  <li><a class="dropdown-item" href="#" value="=" data-operator-id="_operator_equal">=</a></li>
                                  <li><a class="dropdown-item" href="#" value="IN" data-operator-id="_operator_in">IN</a></li>
                                  ${!isPartition && !isCollectionType && isTypeAllowed ? rangeOperatorsDropDown : ''}
                                </ul>`)
                            } catch (e) {}
                          })
                        }

                        setTimeout(() => {
                          try {
                            if (!isCollectionType && !isUDTType.field && !isPartOfMap && !isBooleanType)
                              throw 0

                            $(this).find('label[for="_operator_in"]').parent().remove()
                          } catch (e) {}
                        })

                        setTimeout(() => {
                          let nodeOperators = $(this).find(`input[name="${operatorsContainerID}"]`)

                          nodeOperators.on('change', function() {
                            let selectedOperator = nodeOperators.filter(':checked'),
                              isSelectedOperatorIN = selectedOperator.attr('id') == '_operator_in',
                              mainInput = $(node).find('div.form-outline[data-is-main-input="true"]').find('input'),
                              relatedTreeObject = $(node).closest('div.table-fields-tree').jstree()

                            $(node).find('div.form-outline[data-is-main-input="true"]').toggle(!isSelectedOperatorIN)

                            $(node).find('div.input-group-text.for-actions').toggle(isSelectedOperatorIN)

                            if (isSelectedOperatorIN) {
                              setTimeout(() => mainInput.val('').trigger('input'))
                            } else {
                              try {
                                relatedTreeObject.delete_node(relatedTreeObject.get_node(opNode.attr('add-hidden-node')).children_d)
                              } catch (e) {}
                            }

                            let spanParent = $(this).parent(),
                              operatorsGroup = spanParent.closest('div.btn-group.operators')

                            operatorsGroup.children('span').removeClass('checked')

                            spanParent.addClass('checked')
                          })
                        })

                        setTimeout(() => {
                          let inputToBeCloned = $(node).find('div.input-group').find('div[data-is-main-input="true"]'),
                            clondedInput = $(inputToBeCloned.clone(true))

                          setTimeout(() => {
                            actionsContainer.before((clondedInput.length != 0 ? clondedInput : $('<u></u>')).show(function() {
                              if (isCollectionType) {
                                actionsContainer.show()

                                try {
                                  clondedInput.hide()
                                } catch (e) {}
                              }

                              if (!isUDTType.field && !isPartOfMap)
                                $(node).find('div[class^="form-"], div.input-group-text.for-null-value, div.for-actions').not($(this)).not(actionsContainer).not('.operators-dropdown').remove()

                              setTimeout(() => {
                                $(node).find('input:not([type="radio"]):not(.operators-dropdown)').each(function() {
                                  $(this).val('').trigger('input')

                                  let mdbObject = getElementMDBObject($(this))

                                  setTimeout(() => mdbObject.update(), 500)
                                })
                              })

                              setTimeout(() => {
                                {
                                  // Point at the associated input field
                                  let input = $(node).find(`input[id="${operatorsDropDownID}"]`)

                                  $(node).find('div.operators-dropdown-focusarea').click(() => setTimeout(() => input.trigger('focus').trigger('input'), 10))

                                  // Once the associated select element is being focused then show the dropdown element and vice versa
                                  input.on('focus', () => {
                                    try {
                                      input.parent().find('div.invalid-feedback').addClass('transparent-color')
                                    } catch (e) {}

                                    tippyInputObject.show()

                                    $('div#rightClickActionsMetadata div.modal-body').css({
                                      'overflow': 'hidden',
                                      'padding-right': '24px'
                                    })
                                  }).on('focusout', () => setTimeout(() => {
                                    try {
                                      input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                                    } catch (e) {}

                                    tippyInputObject.hide()

                                    $('div#rightClickActionsMetadata div.modal-body').css({
                                      'overflow-y': 'scroll',
                                      'padding-right': '16px'
                                    })
                                  }, 100))
                                }
                              })

                              setTimeout(() => Modules.Localization.applyLanguageSpecific($(node).find('span[mulang], [data-mulang]')))

                              setTimeout(() => {
                                try {
                                  let groupedOperators = $(node).find('div.btn-group.operators'),
                                    scaleFactor = 0.87,
                                    originalWidth = groupedOperators[0].getBoundingClientRect().width / scaleFactor,
                                    newWidth = groupedOperators[0].getBoundingClientRect().width

                                  let marginLeftAdjustment = (originalWidth - newWidth) - 4

                                  groupedOperators.css("margin-left", -marginLeftAdjustment + 'px');
                                } catch (e) {}
                              }, 200)
                            }))
                          })
                        })

                        // Specify column/key type (partition or clustering)
                        try {
                          if (container != 'primaryKey')
                            throw 0

                          let iconName = isPartition ? 'partition' : 'clustering',
                            iconPath = Path.join(__dirname, '..', '..', '..', 'js', 'external', 'jstree', 'theme', 'extra', `${iconName}-key.png`)

                          // isPartition
                          // partition-key.png
                          $(node).find('div.not-ignore-checkbox').parent().append(`<div class="pk-type-icon">
                              <img src="${iconPath}"
                            </div>`)
                        } catch (e) {}
                      }))

                      setTimeout(() => $(node).find('div.not-ignore-checkbox').addClass('mandatory'))

                      if (isPartition)
                        continue

                      // Handle clustering key(s)
                      $(node).attr('mandatory', 'false')

                      $(node).find('div.not-ignore-checkbox').removeClass('mandatory')
                    }

                    let isUDTColumn = false

                    tableFieldsTreeContainer.find('a.jstree-anchor').get().forEach((nodeAnchor, index) => {
                      if ($(nodeAnchor).attr('ignore-disable') == 'true')
                        return

                      if ($(nodeAnchor).attr('field-type') == 'udt-column' && index == 0) {
                        isUDTColumn = true

                        return
                      }

                      if ($(nodeAnchor).attr('field-type') == 'udt-field' && isUDTColumn)
                        return

                      isUDTColumn = false

                      $(nodeAnchor).toggleClass('unavailable', index != 0)

                      $(nodeAnchor).find('input:not([type="radio"])').toggleClass('disabled', index != 0)

                      let buttonsAndInputAreas = $(nodeAnchor).find('.btn, div.focus-area')

                      $(nodeAnchor).find('div[data-is-main-input="true"]').toggleClass('disabled', index != 0)

                      buttonsAndInputAreas.toggleClass('disabled', index != 0)

                      buttonsAndInputAreas.attr('disabled', index != 0 ? '' : null)
                    })
                  } catch (e) {}

                  // Handle other columns - regular and UDTs -
                  try {
                    if (container == 'primaryKey')
                      throw 0

                    let nodes = tableFieldsTreeContainer.find('a.jstree-anchor:not(.hidden-node)').get()

                    for (let node of nodes) {
                      // Add a deletion feature
                      let deletionBtn = $(`<a action="delete-column" data-mdb-ripple-color="light" href="#" role="button">
                              <ion-icon name="trash" role="img" class="md hydrated" aria-label="trash"></ion-icon>
                            </a>`)

                      deletionBtn.click(function() {
                        let nodeAnchor = $(this).closest('a.jstree-anchor')

                        nodeAnchor.add($('div#tableFieldsNonPKColumnsDeleteAction div.columns').find(`div.column[data-name="${nodeAnchor.attr('name')}"][data-type="${nodeAnchor.attr('type')}"]`)).toggleClass('deleted')

                        try {
                          setTimeout(() => updateActionStatusForDeleteRowColumn())
                        } catch (e) {}
                      })

                      let targetElement = $(node).find('div.not-ignore-checkbox').parent()

                      targetElement.css('width', '26px')

                      targetElement.html(deletionBtn)
                    }
                  } catch (e) {}

                  setTimeout(() => Modules.Localization.applyLanguageSpecific(tableFieldsTreeContainer.find('span[mulang], [data-mulang]')))

                  setTimeout(() => {
                    for (let inputField of tableFieldsTreeContainer.find('input').get()) {
                      setTimeout(() => {
                        try {
                          let mdbObject = getElementMDBObject($(inputField))

                          setTimeout(() => {
                            try {
                              mdbObject.update()
                            } catch (e) {}
                          })
                        } catch (e) {}
                      })
                    }
                  })
                })

                let triggerLoadEventTimeOut = null,
                  triggerLoadEvent = () => {
                    try {
                      clearTimeout(triggerLoadEventTimeOut)
                    } catch (e) {}

                    setTimeout(() => {
                      try {
                        updateActionStatusForDeleteRowColumn()
                      } catch (e) {}
                    })

                    triggerLoadEventTimeOut = setTimeout(() => tableFieldsTreeContainer.trigger('loaded.jstree'))
                  }

                tableFieldsTreeContainer.on('create_node.jstree', function(e, data) {
                  let parentNodeID = '_'

                  try {
                    parentNodeID = data.node.parents.at(-2)
                  } catch (e) {}

                  try {
                    let relatedToHiddenNode = tableFieldsTreeContainer.find(`a.jstree-anchor[add-hidden-node="${parentNodeID}"]`)

                    if (relatedToHiddenNode.length <= 0)
                      throw 0

                    let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${parentNodeID}"]`)

                    hiddenNode.children('a.jstree-anchor').attr({
                      'is-hidden-node': 'true',
                      'related-node-id': relatedToHiddenNode.attr('static-id')
                    })

                    hiddenNode.css('margin-top', '-45px')

                    hiddenNode.children('a').css('pointer-events', 'none')
                  } catch (e) {}

                  triggerLoadEvent()
                })

                tableFieldsTreeContainer.on('delete_node.jstree', function(e, data) {
                  try {
                    data.instance.hide_node(data.node.id)
                  } catch (e) {}
                })

                tableFieldsTreeContainer.on('hide_node.jstree', function(e, data) {
                  let parentNodeID = '_'

                  try {
                    parentNodeID = data.node.parents.at(-2)
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      let relatedToHiddenNode = tableFieldsTreeContainer.find(`a.jstree-anchor[add-hidden-node="${parentNodeID}"]`)

                      if (relatedToHiddenNode.length <= 0)
                        throw 0

                      let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${parentNodeID}"]`)

                      hiddenNode.children('a.jstree-anchor').attr({
                        'is-hidden-node': 'true',
                        'related-node-id': relatedToHiddenNode.attr('static-id')
                      })

                      hiddenNode.css('margin-top', '-45px')

                      hiddenNode.children('a').css('pointer-events', 'none')
                    } catch (e) {}

                    setTimeout(() => {
                      try {
                        updateActionStatusForDeleteRowColumn()
                      } catch (e) {}

                      triggerLoadEvent()
                    })
                  })
                })

                tableFieldsTreeContainer.on('select_node.jstree', function(e, data) {
                  let clickedNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${data.node.id}"]`)

                  try {
                    let clickedTarget = $(data.event.target)

                    if (!clickedTarget.hasClass('focus-area'))
                      throw 0

                    let relatedInput = clickedTarget.parent().children('input')

                    setTimeout(() => {
                      try {
                        if (relatedInput.attr('type') != 'checkbox')
                          throw 0

                        if (relatedInput.prop('indeterminate')) {
                          relatedInput.prop('indeterminate', false)
                          relatedInput.prop('checked', true)
                          relatedInput.trigger('change')
                        } else {
                          if (!(relatedInput.prop('checked'))) {
                            relatedInput.prop('indeterminate', true)
                            relatedInput.trigger('change')
                          } else {
                            relatedInput.trigger('click').trigger('input')
                          }
                        }

                        return
                      } catch (e) {}

                      relatedInput.trigger('focus').trigger('input')
                    })
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      data.instance.deselect_all()
                    } catch (e) {}
                  }, 100)
                })
              }
            })

            $('div.modal#rightClickActionsMetadata div[action]').hide()
            $('div.modal#rightClickActionsMetadata div[action="delete-row-column"]').show()

            $('#rightClickActionsMetadata').addClass('insertion-action').removeClass('show-editor')

            rightClickActionsMetadataModal.show()
          })
        })

        let updateRowsZIndexDeleteAction = (isTransformNegative = false) => {
          setTimeout(() => {
            let rows = $('div#rightClickActionsMetadata').find('div[action="delete-row-column"]').find('a.jstree-anchor:not(.ignored):not(.unavailable)').get(),
              rowsCount = rows.length

            if (isTransformNegative)
              rows = rows.reverse()

            for (let row of rows) {
              $(row).css('z-index', `${rowsCount}`)

              rowsCount -= 1
            }
          })
        }
      }

      {
        let tableFieldsSelectTreeContainers = {
          primaryKey: $('div#tableFieldsPrimaryKeyTreeSelectAction'),
          columnsRegular: $('div#tableFieldsRegularColumnsTreeSelectAction'),
          columnsCollection: $('div#tableFieldsCollectionColumnsTreeSelectAction'),
          columnsUDT: $('div#tableFieldsUDTColumnsTreeSelectAction')
        }

        IPCRenderer.on('select-row', (_, data) => {
          Modules.Config.getConfig((config) => {
            // Get the MDB object of the related modal
            let rightClickActionsMetadataModal = getElementMDBObject($('#rightClickActionsMetadata'), 'Modal'),
              isSelectionAsJSON = data.asJSON === 'true'

            // Update the execution button's attributes
            $('button#executeActionStatement').attr({
              'data-tab-id': `${data.tabID}`,
              'data-textarea-id': `${data.textareaID}`,
              'data-btn-id': `${data.btnID}`
            })

            $('#rightClickActionsMetadata').find('div.modal-body').css('height', 'auto')

            $('#rightClickActionsMetadata').attr({
              'data-state': null,
              'data-keyspace-name': `${data.keyspaceName}`,
              'data-table-name': `${data.tableName}`,
              'data-select-as-json': `${!isSelectionAsJSON ? null : 'true'}`
            })

            $('div.row.default-omitted-columns-value-row-select').toggle(isSelectionAsJSON)

            // Update different modal's attributes
            $('#rightClickActionsMetadata').find('h5.modal-title').children('span').attr('mulang', 'select row').html(`${I18next.capitalize(I18next.t('select row'))} ${isSelectionAsJSON ? '(JSON)' : ''} <span class="keyspace-table-info badge rounded-pill badge-secondary" style="text-transform: none; background-color: rgba(235, 237, 239, 0.15); color: #ffffff;">${data.keyspaceName}.${data.tableName}</span>`)

            $('#rightClickActionsMetadata').attr('data-keyspace-tables', `${data.tables}`)

            $('#rightClickActionsMetadata').attr('data-keyspace-udts', `${data.udts}`)

            try {
              for (let container of Object.keys(tableFieldsSelectTreeContainers)) {
                try {
                  tableFieldsSelectTreeContainers[container].jstree('destroy')
                } catch (e) {}
              }
            } catch (e) {}

            let keys = [],
              columns = [],
              udts = [],
              keyspaceUDTs = []

            try {
              let tableObj = JSON.parse(JSONRepair(data.tables)).find((table) => table.name == data.tableName)

              try {
                keys = tableObj.primary_key.map((key) => {
                  let isPartition = tableObj.partition_key.find((partitionKey) => partitionKey.name == key.name) != undefined

                  return {
                    name: key.name,
                    type: key.cql_type,
                    isReversed: key.is_reversed,
                    isPartition
                  }
                })
              } catch (e) {}

              try {
                columns = tableObj.columns.filter((column) => tableObj.primary_key.find((key) => key.name == column.name) == undefined)
                  .map((column) => {
                    return {
                      name: column.name,
                      type: column.cql_type,
                      isStatic: column.is_static
                    }
                  })
              } catch (e) {}

              try {
                try {
                  keyspaceUDTs = JSON.parse(JSONRepair(data.udts))
                } catch (e) {}

                for (let column of columns) {
                  let udtStructure = {},
                    manipulatedColumnType = column.type

                  manipulatedColumnType = removeFrozenKeyword(`${manipulatedColumnType}`)

                  try {
                    manipulatedColumnType = `${manipulatedColumnType}`.match(/<(.*?)>$/)[1];
                  } catch (e) {}

                  let udtObject = keyspaceUDTs.find((udt) => udt.name == manipulatedColumnType)

                  if (udtObject == undefined || ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`)))
                    continue

                  udtStructure = {
                    ...udtObject,
                    ...column
                  }

                  udts.push(udtStructure)
                }

                columns = columns.filter((column) => udts.find((udt) => udt.name == column.name) == undefined)
              } catch (e) {}
            } catch (e) {}

            let groupStructure = buildTableFieldsTreeview(keys, columns, udts, keyspaceUDTs, false, null, true),
              handleHiddenNodes = (treeData) => {
                let index = 0

                while (index < treeData.length) {
                  const node = treeData[index]

                  try {
                    if (Array.isArray(node)) {
                      processArray(node)

                      index++

                      continue
                    }

                    if (node.a_attr['add-hidden-node'] !== undefined) {
                      treeData.splice(index + 1, 0, {
                        id: node.a_attr['add-hidden-node'],
                        parent: node.parent,
                        state: {
                          opened: true,
                          selected: false
                        },
                        text: ``
                      })

                      index++
                    }
                  } catch (e) {}

                  index++

                }
                return treeData;
              },
              handleNodeCreationDeletion = () => {
                let allSelectionRelatedInputs = $('#rightClickActionsMetadata').find('div[action="select-row"]').find('input').get()

                for (let inputDOM of allSelectionRelatedInputs) {
                  if ($(inputDOM).hasClass('operators-dropdown'))
                    continue

                  let input = $(inputDOM),
                    [
                      inputCassandraType,
                      inputHTMLType,
                      inputID
                    ] = getAttributes(input, ['data-field-type', 'type', 'id']),
                    inputSavedValue = effectedNodes[inputID] || ''

                  if (inputSavedValue == undefined || inputSavedValue.length <= 0)
                    continue

                  try {
                    if (inputHTMLType != 'checkbox')
                      throw 0

                    if (input.attr('data-set-indeterminate') == 'true') {
                      input.attr('data-set-indeterminate', null)

                      input.prop('indeterminate', true)

                      input.trigger('change')

                      throw 0
                    }

                    input.prop('checked', inputSavedValue == 'indeterminate' ? true : !(inputSavedValue != 'true'))

                    input.prop('indeterminate', inputSavedValue == 'indeterminate')

                    input.trigger('change')

                    continue
                  } catch (e) {}

                  try {
                    if (inputCassandraType != 'blob')
                      throw 0

                    input.val(inputSavedValue.inputValue).trigger('input')

                    input.data('value', inputSavedValue.dataValue)

                    continue
                  } catch (e) {}

                  // Not `blob` or `boolean`
                  try {
                    input.val(inputSavedValue).trigger('input')
                  } catch (e) {}
                }

                setTimeout(() => {
                  try {
                    updateActionStatusForSelectRowColumn()
                  } catch (e) {}
                })
              }

            try {
              for (let treeViewType of Object.keys(groupStructure))
                groupStructure[treeViewType].core.data = handleHiddenNodes(groupStructure[treeViewType].core.data)
            } catch (e) {}

            {
              let primaryKeyTreeElements = tableFieldsSelectTreeContainers.primaryKey.add('div#selectPrimaryKeyBadge')

              try {
                if (keys.length <= 0)
                  throw 0

                primaryKeyTreeElements.show()

                try {
                  groupStructure.primaryKey.core.data = groupStructure.primaryKey.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let primaryKeyTreeObject = tableFieldsSelectTreeContainers.primaryKey.jstree(groupStructure.primaryKey)

                try {
                  primaryKeyTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  primaryKeyTreeObject.on('loaded.jstree', () => setTimeout(() => primaryKeyTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${primaryKeyTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                primaryKeyTreeElements.hide()
              }
            }

            let areNonPKColumnsExist = false

            {
              let columnsRegularTreeElements = tableFieldsSelectTreeContainers.columnsRegular.add('div#selectRegularColumnsBadge')

              try {
                if (!(columns.some((column) => ['map', 'set', 'list'].every((type) => !(`${column.type}`.includes(`${type}<`))))))
                  throw 0

                areNonPKColumnsExist = true

                columnsRegularTreeElements.show()

                try {
                  groupStructure.regularColumns.core.data = groupStructure.regularColumns.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let regularColumnsTreeObject = tableFieldsSelectTreeContainers.columnsRegular.jstree(groupStructure.regularColumns)

                try {
                  regularColumnsTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  regularColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => regularColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${regularColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                columnsRegularTreeElements.hide()
              }
            }

            {
              let columnsCollectionTreeElements = tableFieldsSelectTreeContainers.columnsCollection.add('div#selectCollectionColumnsBadge')

              try {
                if (!(columns.some((column) => ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`)))))
                  throw 0

                areNonPKColumnsExist = true

                columnsCollectionTreeElements.show()

                try {
                  groupStructure.collectionColumns.core.data = groupStructure.collectionColumns.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let collectionColumnsTreeObject = tableFieldsSelectTreeContainers.columnsCollection.jstree(groupStructure.collectionColumns)

                try {
                  collectionColumnsTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  collectionColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => collectionColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${collectionColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                columnsCollectionTreeElements.hide()
              }
            }

            {
              let columnsUDTTreeElements = tableFieldsSelectTreeContainers.columnsUDT.add('div#selectUDTColumnsBadge')
              try {
                if (udts.length <= 0)
                  throw 0

                areNonPKColumnsExist = true

                columnsUDTTreeElements.show()

                try {
                  groupStructure.udtColumns.core.data = groupStructure.udtColumns.core.data.filter((field) => field != undefined)
                } catch (e) {}

                let udtColumnsTreeObject = tableFieldsSelectTreeContainers.columnsUDT.jstree(groupStructure.udtColumns)

                try {
                  udtColumnsTreeObject.unbind('loaded.jstree')
                } catch (e) {}

                try {
                  udtColumnsTreeObject.on('loaded.jstree', () => setTimeout(() => udtColumnsTreeObject.find('a.jstree-anchor').get().forEach((anchor, index) => $(anchor).css('z-index', `${udtColumnsTreeObject.find('a.jstree-anchor').length - index}`))))
                } catch (e) {}
              } catch (e) {
                columnsUDTTreeElements.hide()
              }
            }

            $('div#tableFieldsNonPKColumnsSelectAction').add('div#selectNonPKColumns').add('div#non-pk-columns-warning-select').toggle(areNonPKColumnsExist)

            $('input#selectAllowFilteringNoSelectOption').prop('checked', true)
            $('input#selectAllowFilteringNoSelectOption').trigger('change')

            $('div[action="select-row"] div[section="standard"]').click()

            $('input#select-limit').val('')

            $('input#selectAggregateFunctions').val('')

            $('input#toBeSelectedColumnsFilter').val('').trigger('input')

            let selectColumnsContainer = $('div#tableFieldsNonPKColumnsSelectAction div.columns')

            selectColumnsContainer.children('div.column').remove()

            for (let column of [...keys, ...columns, ...udts]) {
              try {
                let columnType = EscapeHTML(`${column.type}`).slice(0, 20),
                  element = `
                    <div data-name="${column.name}" data-type="${column.type}" class="column btn btn-tertiary" data-mdb-ripple-color="light">
                    <ion-icon name="circle" style="font-size: 125%; top: 3px;"></ion-icon>
                      <div class="name">${column.name}</div>
                      <div class="type">
                        ${columnType}${column.type.length > 20 ? '...' : ''}
                      </div>
                      <div class="is-static" ${!column.isStatic ? 'hidden' : ''}>Static</div>
                    </div>`

                selectColumnsContainer.append($(element).show((function() {
                  let columnBtn = $(this)

                  setTimeout(() => $(this).click(() => {
                    columnBtn.toggleClass('selected')

                    let isColumnSelected = columnBtn.hasClass('selected')

                    columnBtn.find('ion-icon').attr('name', isColumnSelected ? 'circle-checked' : 'circle')

                    try {
                      updateActionStatusForSelectRowColumn()
                    } catch (e) {}

                    $('input#toBeSelectdColumnsFilter').trigger('input')
                  }))
                })))
              } catch (e) {}
            }

            setTimeout(() => {
              for (let container of Object.keys(tableFieldsSelectTreeContainers)) {
                let tableFieldsTreeContainer = tableFieldsSelectTreeContainers[container]

                try {
                  tableFieldsTreeContainer.unbind('loaded.jstree')
                  tableFieldsTreeContainer.unbind('select_node.jstree')
                  tableFieldsTreeContainer.unbind('create_node.jstree')
                  tableFieldsTreeContainer.unbind('delete_node.jstree')
                  tableFieldsTreeContainer.unbind('hide_node.jstree')
                } catch (e) {}

                tableFieldsTreeContainer.on('loaded.jstree', () => {
                  setTimeout(() => {
                    try {
                      updateActionStatusForSelectRowColumn()
                    } catch (e) {}
                  })

                  tableFieldsTreeContainer.find('a.jstree-anchor[add-hidden-node]').each(function() {
                    let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${$(this).attr('add-hidden-node')}"]`)

                    hiddenNode.css('margin-top', '-45px')

                    hiddenNode.children('a').css('pointer-events', 'none')
                  })

                  setTimeout(() => {
                    {
                      let allAddItemActionBtns = tableFieldsTreeContainer.find('button[action="add-item"]').get()

                      for (let addItemActionBtn of allAddItemActionBtns) {
                        try {
                          $(addItemActionBtn).unbind('click')
                        } catch (e) {}

                        $(addItemActionBtn).click(function() {
                          let relatedNode = $(this).parent().parent().parent(),
                            [
                              id,
                              type,
                              fieldType,
                              mandatory,
                              hiddenNodeID
                            ] = getAttributes(relatedNode, ['id', 'type', 'field-type', 'mandatory', 'add-hidden-node']),
                            isTypeMap = `${type}`.includes('map<'),
                            relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree(),
                            relatedHiddenNode = relatedTreeObject.element.find(`li[id="hiddenNodeID"]`)

                          try {
                            type = removeFrozenKeyword(`${type}`)
                          } catch (e) {}

                          try {
                            type = `${type}`.match(/<(.*?)>$/)[1]
                          } catch (e) {}

                          try {
                            if (!isTypeMap)
                              throw 0

                            type = `${type}`.replace(/\s+/, '').split(',')

                            type = type.map((subType) => {
                              try {
                                subType = removeFrozenKeyword(`${subType}`)
                              } catch (e) {}

                              subType = subType.replace(/(.*?)</gi, '').replace(/>(.*?)/gi, '')

                              return subType
                            })

                          } catch (e) {}

                          try {
                            if (typeof type != 'object')
                              throw 0

                            let itemMainNodeID = getRandom.id(30),
                              itemMainNodeStrucutre = {
                                id: itemMainNodeID,
                                parent: hiddenNodeID,
                                state: {
                                  opened: true,
                                  selected: false
                                },
                                a_attr: {
                                  'is-map-item': true
                                },
                                text: `
                                <div class="input-group">
                                  <div class="input-group-text for-deletion for-name ignored-applied">
                                    <span class="name">
                                      <span mulang="name" capitalize></span>
                                      <ion-icon name="right-arrow-filled"></ion-icon>
                                    </span>
                                    <span class="name-value">Item #${getRandom.id(3)}</span>
                                  </div>
                                  <div class="input-group-text for-deletion for-actions ignored-applied">
                                    <span class="actions">
                                      <span mulang="actions" capitalize></span>
                                      <ion-icon name="right-arrow-filled"></ion-icon>
                                    </span>
                                    <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="delete-item">
                                      <ion-icon name="trash-outline"></ion-icon>
                                      <span mulang="delete item"></span>
                                    </button>
                                  </div>
                                </div>`
                              }

                            let mapKeyUDTObject = keyspaceUDTs.find((udt) => udt.name == type[0]),
                              mapKeyObject = {
                                isUDT: mapKeyUDTObject != undefined,
                                name: ``,
                                type: type[0],
                                fieldType: 'collection-map-key',
                                isMandatory: false,
                                noEmptyValue: true
                              },
                              mapKeyStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, false, mapKeyObject.isUDT ? {
                                ...mapKeyUDTObject,
                                ...mapKeyObject
                              } : mapKeyObject)

                            let mapValueUDTObject = keyspaceUDTs.find((udt) => udt.name == type[1]),
                              mapValueObject = {
                                isUDT: mapValueUDTObject != undefined,
                                name: ``,
                                type: type[1],
                                fieldType: 'collection-map-value',
                                isMandatory: false,
                                noEmptyValue: true
                              },
                              mapValueStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, false, mapValueObject.isUDT ? {
                                ...mapValueUDTObject,
                                ...mapValueObject
                              } : mapValueObject)

                            try {
                              mapKeyStructure.parent = itemMainNodeID
                            } catch (e) {}

                            try {
                              mapValueStructure.parent = itemMainNodeID
                            } catch (e) {}

                            let allNewNodes = []

                            try {
                              if (Array.isArray(itemMainNodeStrucutre)) {
                                allNewNodes = allNewNodes.concat(itemMainNodeStrucutre)
                              } else {
                                allNewNodes.push(itemMainNodeStrucutre)
                              }
                            } catch (e) {}

                            try {
                              if (Array.isArray(mapKeyStructure)) {
                                allNewNodes = allNewNodes.concat(mapKeyStructure)
                              } else {
                                allNewNodes.push(mapKeyStructure)
                              }
                            } catch (e) {}

                            try {
                              if (Array.isArray(mapValueStructure)) {
                                allNewNodes = allNewNodes.concat(mapValueStructure)
                              } else {
                                allNewNodes.push(mapValueStructure)
                              }
                            } catch (e) {}

                            try {
                              allNewNodes = flattenArray(allNewNodes)
                            } catch (e) {}

                            try {
                              allNewNodes = handleHiddenNodes(allNewNodes)
                            } catch (e) {}

                            for (let i = 0; i < allNewNodes.length; i++) {
                              let node = allNewNodes[i]

                              try {
                                if (node.parent != '#')
                                  throw 0

                                allNewNodes[i].parent = itemMainNodeID
                              } catch (e) {}

                              try {
                                let nodeText = Cheerio.load(allNewNodes[i].text)

                                try {
                                  nodeText('body').find('div.input-group-text.for-not-ignoring').attr('hidden', '')
                                } catch (e) {}

                                allNewNodes[i].text = nodeText('body').html()
                              } catch (e) {}

                              try {
                                relatedTreeObject.create_node(allNewNodes[i].parent, allNewNodes[i])
                              } catch (e) {}

                              try {
                                handleNodeCreationDeletion()
                              } catch (e) {}
                            }

                            return
                          } catch (e) {}

                          let nodeUDTType = keyspaceUDTs.find((udt) => udt.name == type),
                            nodeTypeObject = {
                              isUDT: nodeUDTType != undefined,
                              name: ``,
                              type: type,
                              fieldType: 'collection-type',
                              isMandatory: false,
                              noEmptyValue: true
                            },
                            nodeTypeStructure = buildTableFieldsTreeview([], [], [], keyspaceUDTs, false, nodeTypeObject.isUDT ? {
                              ...nodeUDTType,
                              ...nodeTypeObject
                            } : nodeTypeObject)

                          try {
                            nodeTypeStructure = Array.isArray(nodeTypeStructure) ? flattenArray(nodeTypeStructure) : [nodeTypeStructure]
                          } catch (e) {}

                          try {
                            nodeTypeStructure = handleHiddenNodes(nodeTypeStructure)
                          } catch (e) {}

                          for (let i = 0; i < nodeTypeStructure.length; i++) {
                            try {
                              if (nodeTypeStructure[i].parent != '#')
                                throw 0

                              let nodeText = Cheerio.load(nodeTypeStructure[i].text),
                                deleteItemBtn = `
                                <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="delete-item">
                                  <ion-icon name="trash-outline"></ion-icon>
                                  <span mulang="delete item"></span>
                                </button>`

                              try {
                                nodeText('body').find('div.input-group-text.for-not-ignoring').attr('hidden', '')
                              } catch (e) {}

                              let actionsGroup = nodeText('div.input-group-text.for-actions')

                              if (actionsGroup.length != 0) {
                                actionsGroup.find('button').before(deleteItemBtn)
                              } else {
                                let actionsGroupContainer = `
                                <div class="input-group-text for-deletion for-actions ignored-applied">
                                  <span class="actions">
                                    <span mulang="actions" capitalize></span>
                                    <ion-icon name="right-arrow-filled"></ion-icon>
                                  </span>
                                  ${deleteItemBtn}
                                </div>`

                                nodeText('div.input-group').append(actionsGroupContainer)
                              }

                              nodeTypeStructure[i].text = nodeText('body').html()

                              nodeTypeStructure[i].parent = hiddenNodeID
                            } catch (e) {}

                            try {
                              relatedTreeObject.create_node(nodeTypeStructure[i].parent, {
                                ...nodeTypeStructure[i]
                              })
                            } catch (e) {}

                            try {
                              handleNodeCreationDeletion()
                            } catch (e) {}
                          }

                          try {
                            updateActionStatusForSelectRowColumn()
                          } catch (e) {}
                        })
                      }

                      let allSelectItemActionBtns = tableFieldsTreeContainer.find('button[action="delete-item"]').get()

                      for (let deleteItemActionBtn of allSelectItemActionBtns) {
                        try {
                          $(deleteItemActionBtn).unbind('click')
                        } catch (e) {}

                        $(deleteItemActionBtn).click(function() {
                          let relatedNode = $(this).parent().parent().parent(),
                            relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree()

                          try {
                            let deletedNode = relatedTreeObject.get_node(relatedNode)

                            relatedTreeObject.delete_node(deletedNode)

                            try {
                              handleNodeCreationDeletion()
                            } catch (e) {}
                          } catch (e) {}
                        })
                      }
                    }

                    {
                      let allClearFieldBtns = tableFieldsTreeContainer.find('div.clear-field div.btn').get()

                      for (let clearFieldBtn of allClearFieldBtns) {
                        try {
                          $(clearFieldBtn).unbind('click')
                        } catch (e) {}

                        $(clearFieldBtn).click(function() {
                          let relatedNode = $(this).closest('a.jstree-anchor'),
                            rlatedInutField = relatedNode.find('div[data-is-main-input="true"]').find('input'),
                            inputObject = getElementMDBObject(rlatedInutField)

                          try {
                            rlatedInutField.val('').trigger('input')
                          } catch (e) {}

                          try {
                            inputObject.update()
                            setTimeout(() => inputObject._deactivate())
                          } catch (e) {}

                          setTimeout(() => {
                            try {
                              updateActionStatusForSelectRowColumn()
                            } catch (e) {}
                          })
                        })
                      }
                    }

                    {
                      let allNULLApplyBtns = tableFieldsTreeContainer.find('button[action="apply-null"]').get()

                      for (let applyBtn of allNULLApplyBtns) {
                        try {
                          $(applyBtn).unbind('click')
                        } catch (e) {}

                        $(applyBtn).click(function() {
                          let isNULLApplied = $(this).hasClass('applied')

                          $(this).closest('a.jstree-anchor').find('.null-related').toggleClass('null-applied', !isNULLApplied)
                          $(this).toggleClass('applied', !isNULLApplied)

                          setTimeout(() => {
                            try {
                              updateActionStatusForSelectRowColumn()
                            } catch (e) {}
                          })
                        })
                      }
                    }

                    {
                      let allOperatorsContainers = tableFieldsTreeContainer.find('div.input-group-text.for-deletion.for-operators').get()

                      for (let operatorsContainerElement of allOperatorsContainers) {
                        let node = $(operatorsContainerElement).closest('a.jstree-anchor'),
                          isCollectionType = $(node).attr('is-collection-type') == 'true'

                        setTimeout(() => {
                          try {
                            $(operatorsContainerElement).find('label.btn').unbind('click')
                          } catch (e) {}

                          $(operatorsContainerElement).find('label.btn').click(function() {
                            $(this).parent().find(`input[id="${$(this).attr('for')}"]`).trigger('click')
                          })
                        })

                        setTimeout(() => {
                          try {
                            if (!isCollectionType)
                              throw 0

                            $(operatorsContainerElement).find('label[for="_operator_in"]').parent().remove()

                            $(operatorsContainerElement).find('a.dropdown-item[data-operator-id="_operator_in"]').parent().remove()
                          } catch (e) {}
                        })

                        setTimeout(() => {
                          try {
                            $(operatorsContainerElement).find(`button[data-id="hidden-operators-btn"]`).unbind('click')
                          } catch (e) {}

                          $(operatorsContainerElement).find(`button[data-id="hidden-operators-btn"]`).click(function(_, onlyHideUncheckedOps = false) {
                            let areOperatorsShown = $(node).hasClass('show-hidden-operators')

                            if (onlyHideUncheckedOps)
                              areOperatorsShown = true

                            $(node).toggleClass('show-hidden-operators', !areOperatorsShown)

                            $(this).toggleClass('expanded', !areOperatorsShown)

                            $(this).closest('div.for-operators').find('div.btn-group.operators').find('span.checked').show()

                            $(this).closest('div.for-operators').find('div.btn-group.operators').find('span:not(.checked)').toggle(!areOperatorsShown)

                            $(this).closest('div.for-operators').css('width', areOperatorsShown ? '' : '100%')
                          })
                        })

                        let allOperators = tableFieldsTreeContainer.find('div.btn-group.operators').find('input[type="radio"]')

                        for (let operator of allOperators.get()) {
                          setTimeout(() => {
                            try {
                              $(operator).unbind('change')
                            } catch (e) {}

                            $(operator).on('change', function() {
                              let opNode = $(this).closest('a.jstree-anchor'),
                                allOperatorsInGroup = $(this).closest('div.btn-group.operators').find('input[type="radio"]'),
                                selectedOperator = $(allOperatorsInGroup).filter(':checked'),
                                isSelectedOperatorIN = selectedOperator.attr('id') == '_operator_in',
                                mainInput = opNode.find('div.form-outline[data-is-main-input="true"]').find('input'),
                                relatedTreeObject = opNode.closest('div.table-fields-tree').jstree()

                              opNode.find('div.form-outline[data-is-main-input="true"]').toggle(!isSelectedOperatorIN)

                              opNode.find('div.input-group-text.for-actions').toggle(isSelectedOperatorIN)

                              if (isSelectedOperatorIN) {
                                setTimeout(() => mainInput.val('').trigger('input'))
                              } else {
                                try {
                                  relatedTreeObject.delete_node(relatedTreeObject.get_node(opNode.attr('add-hidden-node')).children_d)
                                } catch (e) {}
                              }

                              let spanParent = $(this).parent(),
                                operatorsGroup = spanParent.closest('div.btn-group.operators')

                              operatorsGroup.children('span').removeClass('checked')

                              spanParent.addClass('checked')
                            })
                          })

                          setTimeout(() => {
                            try {
                              if (!isCollectionType)
                                throw 0

                              $(operatorsContainerElement).find('label[for="_operator_in"]').parent().remove()

                              $(operatorsContainerElement).find('a.dropdown-item[data-operator-id="_operator_in"]').parent().remove()
                            } catch (e) {}
                          })

                          setTimeout(() => Modules.Localization.applyLanguageSpecific($(node).find('span[mulang], [data-mulang]')))
                        }

                        setTimeout(() => Modules.Localization.applyLanguageSpecific($(node).find('span[mulang], [data-mulang]')))
                      }
                    }

                    {
                      setTimeout(() => {
                        let allHiddenOperatorsBtns = tableFieldsTreeContainer.find('button[data-id="hidden-operators-btn"]').get()

                        for (let hiddenOperatorsBtn of allHiddenOperatorsBtns)
                          $(hiddenOperatorsBtn).trigger('click', true)
                      })
                    }
                  })

                  setTimeout(() => {
                    try {
                      tableFieldsTreeContainer.find('div[data-is-main-input="true"]').find('input').unbind('input')
                      tableFieldsTreeContainer.find('div[data-is-main-input="true"]').find('input').unbind('change')
                    } catch (e) {}

                    tableFieldsTreeContainer.find('div[data-is-main-input="true"]').find('input').on('input change', function() {
                      let [
                        inputCassandraType,
                        inputHTMLType,
                        inputID
                      ] = getAttributes($(this), ['data-field-type', 'type', 'id']),
                        relatedNode = $(this).closest('a.jstree-anchor'),
                        isMandatory = relatedNode.attr('mandatory') == 'true',
                        isEmptyValueNotAllowed = relatedNode.attr('no-empty-value') == 'true',
                        isInputEmpty = false,
                        relatedTreeObject = relatedNode.closest('div.table-fields-tree').jstree()

                      /**
                       * Using `switch` here won't be suffiecnet as we need, in some cases, to check either one of the types, or both of them
                       * `boolean` type - `checkbox` input type
                       */
                      try {
                        if (inputHTMLType != 'checkbox')
                          throw 0

                        if ($(this).attr('data-set-indeterminate') == 'true') {
                          $(this).attr('data-set-indeterminate', null)

                          $(this).prop('indeterminate', true)
                        }

                        $(`label[for="${$(this).attr('id')}"]`).text($(this).prop('indeterminate') ? 'not set' : ($(this).prop('checked') ? 'true' : 'false'))

                        effectedNodes[inputID] = $(this).prop('indeterminate') ? 'indeterminate' : `${$(this).prop('checked')}`

                        $(this).removeClass('is-invalid')
                      } catch (e) {}

                      if ($(this).val().length <= 0)
                        isInputEmpty = true

                      let addIsEmptyClass = true

                      try {
                        let parentID = relatedTreeObject.get_node(relatedNode.attr('static-id')).parents.at(-2),
                          parent = relatedTreeObject.get_node(parentID, true),
                          finalNode = parentID == undefined ? relatedNode : $('#tableFieldsPrimaryKeyTreeSelectAction').find(`a.jstree-anchor[static-id="${parentID}"]`)

                        if (finalNode.length <= 0)
                          finalNode = $('#tableFieldsPrimaryKeyTreeSelectAction').find(`a.jstree-anchor[id="${parentID}_anchor"]`)

                        if (finalNode.attr('is-hidden-node') == 'true')
                          finalNode = $('#tableFieldsPrimaryKeyTreeSelectAction').find(`a.jstree-anchor[static-id="${finalNode.attr('related-node-id')}"]`)

                        addIsEmptyClass = isInputEmpty
                      } catch (e) {}

                      $(this).add($(this).closest('div.form-outline')).toggleClass('is-empty', addIsEmptyClass)

                      try {
                        if (!($(this).val().length <= 0))
                          throw 0

                        relatedNode.find('div.clear-field').addClass('hide')

                        if (inputHTMLType != 'checkbox')
                          $(this).addClass('is-invalid')

                        setTimeout(() => {
                          try {
                            updateActionStatusForSelectRowColumn()
                          } catch (e) {}
                        })

                        return
                      } catch (e) {}

                      $(this).removeClass('is-invalid')

                      if (inputHTMLType != 'checkbox')
                        effectedNodes[inputID] = $(this).val()

                      // `inet` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'inet')
                          throw 0

                        let ipValue = $(this).val(),
                          isValidIP = isIP(`${ipValue}`) != 0

                        if (minifyText(ipValue).length <= 0)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidIP)
                      } catch (e) {}

                      // `uuid` and `timeuuid` Cassandra types - `text` input type
                      try {
                        if (!(['uuid', 'timeuuid'].some((type) => inputCassandraType == type)))
                          throw 0

                        let uuidValue = $(this).val(),
                          isValidUUID = isUUID(`${uuidValue}`),
                          uuidFunction = inputCassandraType == 'uuid' ? 'uuid' : 'now'

                        if (minifyText(uuidValue).length <= 0 || uuidValue == `${uuidFunction}()`)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidUUID)
                      } catch (e) {}

                      // `timestamp` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'timestamp')
                          throw 0

                        let timestampValue = $(this).val()

                        try {
                          timestampValue = !isNaN(timestampValue) ? parseInt(timestampValue) : timestampValue
                        } catch (e) {}

                        let isValidTimestamp = !isNaN((new Date(timestampValue).getTime()))

                        if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_timestamp()')
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidTimestamp)
                      } catch (e) {}

                      // `date` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'date')
                          throw 0

                        let dateValue = $(this).val(),
                          isValidDate = (`${dateValue}`.match(/^\d{4}-\d{2}-\d{2}$/) != null || !isNaN(dateValue)) && !(isNaN(new Date(parseInt(dateValue)).getTime()))

                        if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_date()')
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidDate)
                      } catch (e) {}

                      // `time` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'time')
                          throw 0

                        let timeValue = $(this).val(),
                          isValidTime = (`${timeValue}`.match(/^\d{2}:\d{2}:\d{2}(\.\d+)*$/) != null || !isNaN(timeValue)) && !(isNaN(new Date(parseInt(timeValue)).getTime()))

                        if (minifyText($(this).val()).length <= 0 || $(this).val() == 'current_time()')
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidTime)
                      } catch (e) {}

                      // `duration` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'duration')
                          throw 0

                        let durationValue = $(this).val(),
                          isValidDuration = `${durationValue}`.match(/^P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d*\.?\d*S)?)?$/) != null

                        if (minifyText($(this).val()).length <= 0)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidDuration)
                      } catch (e) {}

                      // `blob` Cassandra type - `text` input type
                      try {
                        if (inputCassandraType != 'blob')
                          throw 0

                        let blobValue = $(this).val(),
                          isValidBlob = `${blobValue}`.match(/^(?:0x)[0-9a-fA-F]+(\.\.\.)?$/) != null

                        if (minifyText($(this).val()).length <= 0)
                          throw $(this).removeClass('is-invalid')

                        $(this).toggleClass('is-invalid', !isValidBlob)

                        effectedNodes[inputID] = {
                          inputValue: $(this).val(),
                          dataValue: $(this).data('value')
                        }
                      } catch (e) {}

                      try {
                        relatedNode.find('div.clear-field').toggleClass('hide', $(this).val().length <= 0)
                      } catch (e) {}

                      setTimeout(() => {
                        try {
                          updateActionStatusForSelectRowColumn()
                        } catch (e) {}
                      })
                    })

                    let tippyInstances = []

                    setTimeout(() => {
                      tableFieldsTreeContainer.find('input:not([type="radio"])').trigger('input')
                      tableFieldsTreeContainer.find('input:not([type="radio"])').trigger('change')

                      tableFieldsTreeContainer.find('button.expand-range.expanded').trigger('click')
                    })
                  })

                  // Handle Primary key of the table
                  try {
                    let nodes = tableFieldsTreeContainer.find('a.jstree-anchor:not(.hidden-node)').get()

                    for (let node of nodes) {
                      let isRelatedToHiddenNode = false

                      try {
                        let parentNode = $(node).closest('ul').parent().children('a.jstree-anchor').first()

                        isRelatedToHiddenNode = $(parentNode).closest('li').attr('is-hidden-node') == 'true'
                      } catch (e) {}

                      if (isRelatedToHiddenNode) {
                        $(node).attr({
                          'data-deletion-changes-applied': 'true',
                          'ignore-disable': container == 'primaryKey' ? 'true' : null
                        })

                        $(node).find('div.input-group-text.for-actions').find('button:not([action="delete-item"])').remove()
                      }

                      let isUDTType = {
                          column: $(node).attr('field-type') == 'udt-column',
                          field: $(node).attr('field-type') == 'udt-field'
                        },
                        isPartOfMap = `${$(node).attr('field-type')}`.startsWith('collection-map'),
                        isCollectionFieldType = $(node).attr('field-type') == 'collection-type'

                      setTimeout(() => {
                        try {
                          updateActionStatusForSelectRowColumn()
                        } catch (e) {}
                      })

                      if (isRelatedToHiddenNode || $(node).attr('data-deletion-changes-applied') == 'true' || isUDTType.field || isPartOfMap || isCollectionFieldType)
                        continue

                      $(node).attr('data-deletion-changes-applied', 'true')

                      let operatorsDropDownID = `_${getRandom.id(10)}`

                      let isPartition = $(node).attr('partition') == 'true',
                        isCollectionType = $(node).attr('is-collection-type') == 'true',
                        isBooleanType = $(node).attr('type') == 'boolean',
                        hiddenOperatorsBtnID = `_${getRandom.id(10)}`,
                        operatorsContainerID = `_${getRandom.id(10)}`,
                        isTypeAllowed = !(['boolean', 'blob'].some((type) => $(node).attr('type') == type)),
                        rangeOperators = `
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_less_than" autocomplete="off" data-operator="<">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_less_than" data-mdb-ripple-init><</label>
                        </span>
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_greater_than" autocomplete="off" data-operator=">">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_greater_than" data-mdb-ripple-init>></label>
                        </span>
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_less_than_equal" autocomplete="off" data-operator="<=">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_less_than_equal" data-mdb-ripple-init><=</label>
                        </span>
                        <span>
                          <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_greater_than_equal" autocomplete="off" data-operator=">=">
                          <label class="btn btn-secondary btn-light btn-sm" for="_operator_greater_than_equal" data-mdb-ripple-init>>=</label>
                        </span>
                        <button id="${hiddenOperatorsBtnID}" data-id="hidden-operators-btn" type="button" class="btn btn-secondary btn-light btn-sm expand-range expanded" data-mdb-ripple-init>
                          <ion-icon name="arrow-up"></ion-icon>
                        </button>`,
                        rangeOperatorsDropDown = `
                        <li><a class="dropdown-item" href="#" value="<" data-operator-id="_operator_less_than"><</a></li>
                        <li><a class="dropdown-item" href="#" value=">" data-operator-id="_operator_greater_than">></a></li>
                        <li><a class="dropdown-item" href="#" value="<=" data-operator-id="_operator_less_than_equal"><=</a></li>
                        <li><a class="dropdown-item" href="#" value=">=" data-operator-id="_operator_greater_than_equal">>=</a></li>
                        `,
                        operatorsContainer = `
                        <div class="input-group-text for-deletion for-operators ignored-applied" style="z-index:0;">
                          <span class="operator">
                            <span mulang="operator" capitalize></span>
                            <ion-icon name="right-arrow-filled"></ion-icon>
                          </span>
                          <div class="btn-group operators" style="display: none;">
                            <span class="checked">
                              <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_equal" autocomplete="off" data-operator="=" checked>
                              <label class="btn btn-secondary btn-light btn-sm" for="_operator_equal" data-mdb-ripple-init>=</label>
                            </span>
                            <span>
                              <input type="radio" class="btn-check" name="${operatorsContainerID}" id="_operator_in" autocomplete="off" data-operator="IN">
                              <label class="btn btn-secondary btn-light btn-sm" for="_operator_in" data-mdb-ripple-init>IN</label>
                            </span>
                            ${!isPartition && !isCollectionType && isTypeAllowed ? rangeOperators : ''}
                          </div>
                          <div class="form-outline form-white operators-dropdown" style="z-index: 2; width: 70px;">
                            <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                            <input type="text" data-tippy="tooltip" data-mdb-placement="bottom" data-mdb-html="true" class="form-control form-icon-trailing form-control-sm operators-dropdown" style="background-color: inherit; cursor: default; pointer-events:none; font-family: 'Terminal'; font-weight: bold;" id="${operatorsDropDownID}" value="=" readonly noopacity>
                            <div class="operators-dropdown-focusarea"></div>
                          </div>
                        </div>`

                      $(node).find('div.input-group').addClass('custom-width')

                      let actionsContainer = $(node).find('div.input-group').find('div.input-group-text.for-actions')

                      actionsContainer.find('span.actions').hide()

                      actionsContainer.find('button').css('transform-origin', 'left')

                      actionsContainer.addClass('block-display')

                      actionsContainer.hide()

                      actionsContainer.css('width', '100%')

                      actionsContainer.before($(operatorsContainer).show(function() {
                        let operatorsContainerElement = $(this),
                          tippyInputObject

                        // Add tippy
                        {
                          setTimeout(() => {
                            let tippyInput = $(node).find(`input[id="${operatorsDropDownID}"]`)

                            tippyInputObject = tippy(tippyInput[0], {
                              trigger: 'manual',
                              allowHTML: true,
                              arrow: false,
                              theme: 'material',
                              interactive: true,
                              onShown(instance) {
                                $(instance.popper).find(`ul.dropdown-menu`).find('a').click(function() {
                                  // Point at the input field related to the list
                                  let selectElement = $(`input#${$(instance.popper).find(`ul.dropdown-menu`).attr('for-select')}`),
                                    selectedValue = $(this).attr('value'),
                                    selectedValueID = $(this).attr('data-operator-id'),
                                    isTypeCollection = $(this).attr('data-is-collection') != undefined,
                                    isCollectionMap = $(this).attr('data-is-map') != undefined

                                  // Update the input's value
                                  selectElement.val(selectedValue).trigger('input')

                                  $(instance.reference).closest('div.input-group').find(`input[type="radio"][id="${selectedValueID}"]`).prop('checked', true).trigger('change')

                                  try {
                                    updateActionStatusForSelectRowColumn()
                                  } catch (e) {}
                                })
                              }
                            })

                            try {
                              tippyInputObject.setContent(`
                              <ul class="dropdown-menu operators-dropdown show tippy-dropdown" for-select="${operatorsDropDownID}">
                              <li><a class="dropdown-item" href="#" value="=" data-operator-id="_operator_equal">=</a></li>
                              <li><a class="dropdown-item" href="#" value="IN" data-operator-id="_operator_in">IN</a></li>
                              ${!isPartition && !isCollectionType && isTypeAllowed ? rangeOperatorsDropDown : ''}
                              </ul>`)
                            } catch (e) {}
                          })
                        }

                        setTimeout(() => $(this).find('label.btn').click(function() {
                          $(this).parent().find(`input[id="${$(this).attr('for')}"]`).trigger('click')
                        }))

                        setTimeout(() => {
                          try {
                            if (!isCollectionType && !isUDTType.field && !isPartOfMap && !isBooleanType)
                              throw 0

                            $(this).find('label[for="_operator_in"]').parent().remove()
                          } catch (e) {}
                        })

                        setTimeout(() => {
                          let nodeOperators = $(this).find(`input[name="${operatorsContainerID}"]`)

                          nodeOperators.on('change', function() {
                            let selectedOperator = nodeOperators.filter(':checked'),
                              isSelectedOperatorIN = selectedOperator.attr('id') == '_operator_in',
                              mainInput = $(node).find('div.form-outline[data-is-main-input="true"]').find('input'),
                              relatedTreeObject = $(node).closest('div.table-fields-tree').jstree()

                            $(node).find('div.form-outline[data-is-main-input="true"]').toggle(!isSelectedOperatorIN)

                            $(node).find('div.input-group-text.for-actions').toggle(isSelectedOperatorIN)

                            if (isSelectedOperatorIN) {
                              setTimeout(() => mainInput.val('').trigger('input'))
                            } else {
                              try {
                                relatedTreeObject.delete_node(relatedTreeObject.get_node(opNode.attr('add-hidden-node')).children_d)
                              } catch (e) {}
                            }

                            let spanParent = $(this).parent(),
                              operatorsGroup = spanParent.closest('div.btn-group.operators')

                            operatorsGroup.children('span').removeClass('checked')

                            spanParent.addClass('checked')
                          })
                        })

                        setTimeout(() => {
                          let inputToBeCloned = $(node).find('div.input-group').find('div[data-is-main-input="true"]'),
                            clondedInput = $(inputToBeCloned.clone(true))

                          setTimeout(() => {
                            actionsContainer.before((clondedInput.length != 0 ? clondedInput : $('<u></u>')).show(function() {
                              if (isCollectionType) {
                                actionsContainer.show()

                                try {
                                  clondedInput.hide()
                                } catch (e) {}
                              }

                              if (!isUDTType.field && !isPartOfMap)
                                $(node).find('div[class^="form-"], div.input-group-text.for-null-value, div.for-actions').not($(this)).not(actionsContainer).not('.operators-dropdown').remove()

                              setTimeout(() => {
                                $(node).find('input:not([type="radio"]):not(.operators-dropdown)').each(function() {
                                  $(this).val('').trigger('input')

                                  let mdbObject = getElementMDBObject($(this))

                                  setTimeout(() => mdbObject.update(), 500)
                                })
                              })

                              setTimeout(() => {
                                let dropDownElement = $(node).find(`div.dropdown[for-select="${operatorsDropDownID}"]`),
                                  selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown')

                                setTimeout(() => {
                                  try {
                                    selectDropdown.update()
                                  } catch (e) {}
                                }, 500)

                                {
                                  // Point at the associated input field
                                  let input = $(node).find(`input[id="${operatorsDropDownID}"]`)

                                  $(node).find('div.operators-dropdown-focusarea').click(() => setTimeout(() => input.trigger('focus').trigger('input'), 10))

                                  // Once the associated select element is being focused then show the dropdown element and vice versa
                                  input.on('focus', () => {
                                    try {
                                      input.parent().find('div.invalid-feedback').addClass('transparent-color')
                                    } catch (e) {}

                                    tippyInputObject.show()
                                  }).on('focusout', () => setTimeout(() => {
                                    try {
                                      input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                                    } catch (e) {}

                                    tippyInputObject.hide()
                                  }, 100))
                                }
                              })

                              setTimeout(() => Modules.Localization.applyLanguageSpecific($(node).find('span[mulang], [data-mulang]')))

                              setTimeout(() => {
                                try {
                                  let groupedOperators = $(node).find('div.btn-group.operators'),
                                    scaleFactor = 0.87,
                                    originalWidth = groupedOperators[0].getBoundingClientRect().width / scaleFactor,
                                    newWidth = groupedOperators[0].getBoundingClientRect().width

                                  let marginLeftAdjustment = (originalWidth - newWidth) - 4

                                  groupedOperators.css("margin-left", -marginLeftAdjustment + 'px');
                                } catch (e) {}
                              }, 200)
                            }))
                          })
                        })

                        // Specify column/key type (partition or clustering)
                        try {
                          if (container != 'primaryKey')
                            throw 0

                          let iconName = isPartition ? 'partition' : 'clustering',
                            iconPath = Path.join(__dirname, '..', '..', '..', 'js', 'external', 'jstree', 'theme', 'extra', `${iconName}-key.png`)

                          // isPartition
                          // partition-key.png
                          $(node).find('div.not-ignore-checkbox').parent().append(`<div class="pk-type-icon">
                              <img src="${iconPath}"
                            </div>`)
                        } catch (e) {}
                      }))

                      // Add aggregate functions
                      setTimeout(() => {
                        try {
                          if ($(node).attr('is-hidden-node') == 'true')
                            throw 0

                          let aggregateFunctionsBtnID = `_${getRandom.id(10)}btn`

                          $(node).find('div.input-group').append($(`
                            <div class="input-group-text for-deletion for-aggregate-functions column-aggregate-functions">
                            <span class="operator">
                              <span mulang="extra" capitalize></span>
                              <ion-icon name="right-arrow-filled"></ion-icon>
                            </span>
                            <button type="button" id="${aggregateFunctionsBtnID}" data-column-name="${$(node).attr('name')}" class="btn btn-light btn-rounded btn-sm ripple-surface-dark aggregate-functions-btn" style="width: 40px;"><ion-icon name="cogs" style="font-size: 150%; margin-right: 0; transform: translateX(-5px);"></ion-icon></button>
                            <div class="dropdown" multiple for-select="${aggregateFunctionsBtnID}" style="position: absolute; left: 45px; top: 0;">
                            <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                            <ul class="dropdown-menu for-aggregate-functions top-margin less multiple">
                              <li><a class="dropdown-item" href="#" value="COUNT">
                                  <ion-icon name="circle"></ion-icon>
                                  <ion-icon name="circle-checked"></ion-icon>
                                  COUNT
                                </a></li>
                              <li><a class="dropdown-item" href="#" value="MIN">
                                  <ion-icon name="circle"></ion-icon>
                                  <ion-icon name="circle-checked"></ion-icon>
                                  MIN
                                </a></li>
                              <li><a class="dropdown-item" href="#" value="MAX">
                                  <ion-icon name="circle"></ion-icon>
                                  <ion-icon name="circle-checked"></ion-icon>
                                  MAX
                                </a></li>
                              <li><a class="dropdown-item" href="#" value="SUM">
                                  <ion-icon name="circle"></ion-icon>
                                  <ion-icon name="circle-checked"></ion-icon>
                                  SUM
                                </a></li>
                              <li><a class="dropdown-item" href="#" value="AVG">
                                  <ion-icon name="circle"></ion-icon>
                                  <ion-icon name="circle-checked"></ion-icon>
                                  AVG
                                </a></li>
                            </ul>
                          </div>
                            </div>
                            `).show(function() {
                            // Get the MDB object of the current dropdown element
                            let selectDropdown = getElementMDBObject($(this).find('div.dropdown[for-select]'), 'Dropdown'),
                              // Point at the associated input field
                              btn = $(this).find(`button#${$(this).find('div.dropdown[for-select]').attr('for-select')}`),
                              isMultiple = $(this).find('div.dropdown[for-select]').attr('multiple') != undefined

                            // Once the associated select element is being focused then show the dropdown element and vice versa
                            btn.on('focus', () => {
                              let isBtnDisabled = btn.hasClass('disabled') || btn.attr('disabled') != undefined

                              if (isBtnDisabled)
                                return selectDropdown.hide()

                              selectDropdown.show()

                              if (!isMultiple)
                                return

                              setTimeout(() => {
                                $(this).find('div.dropdown[for-select]').find('ul.dropdown-menu.multiple').oneClickOutside({
                                  callback: function() {
                                    setTimeout(() => {
                                      let isBtnDisabled = btn.hasClass('disabled') || btn.attr('disabled') != undefined

                                      if (isBtnDisabled)
                                        return selectDropdown.hide()

                                      selectDropdown.hide()
                                    }, 100)
                                  },
                                  exceptions: btn
                                })
                              }, 100)
                            })

                            // Once the parent `form-outline` is clicked trigger the `focus` event
                            btn.click(() => btn.trigger('focus'))

                            {
                              let aggregateFunctionsDropDownItems = $(this).find('div.dropdown[for-select]').find('ul.dropdown-menu.multiple').find('li').find('a')

                              aggregateFunctionsDropDownItems.on('click', function() {
                                $(this).toggleClass('selected')

                                setTimeout(() => {
                                  let selectedFunctions = aggregateFunctionsDropDownItems.filter('.selected'),
                                    finalFunctions = selectedFunctions.get().map((selectedFunction) => `${$(selectedFunction).attr('value')}`)

                                  btn.data('aggregateFunctions', finalFunctions)

                                  btn.toggleClass('active-function', finalFunctions.length > 0)

                                  try {
                                    updateActionStatusForSelectRowColumn()
                                  } catch (e) {}
                                })
                              })
                            }
                          }))
                        } catch (e) {}

                        setTimeout(() => {
                          try {
                            if ($(node).attr('type') !== 'counter')
                              throw 0

                            $(node).find('div.input-group-text.for-type').nextAll('div.input-group-text').hide()
                            $(node).find('div.input-group-text.for-type').nextAll('div.form-outline').hide()
                          } catch (e) {}
                        }, 50)
                      }, 50)

                      setTimeout(() => $(node).find('div.not-ignore-checkbox').addClass('mandatory'))

                      // Handle clustering key(s)
                      $(node).attr('mandatory', 'false')

                      if (isPartition)
                        continue

                      // Add badge that indicates the order (DESC, ASC)
                      setTimeout(() => {
                        try {
                          if ($(node).attr('is-reversed') == undefined || $(node).attr('field-type') != 'primary-key')
                            throw 0

                          let orderType = $(node).attr('is-reversed') == 'true' ? 'desc' : 'asc'

                          $(node).find('div.input-group').find('div.input-group-text.for-aggregate-functions').append($(`
                            <button type="button" class="btn btn-light btn-rounded btn-sm ripple-surface-dark column-order-type disabled" style="margin-right: -5px;" data-column-name="${$(node).attr('name')}" data-original-order="${orderType}" data-current-order="${orderType}" disabled><ion-icon name="sort-${orderType}" style="margin-right: 0px;"></ion-icon> <span>${orderType}</span></button>
                            `).click(function(_, internal = false) {
                            let isActive = $(this).hasClass('active-order'),
                              currentOrder = !isActive ? 'inactive' : $(this).attr('data-current-order'),
                              states = ['inactive', $(this).attr('data-original-order'), $(this).attr('data-original-order') == 'asc' ? 'desc' : 'asc'],
                              currentStateIndex = states.indexOf(currentOrder),
                              nextState = (currentStateIndex + 1) % states.length,
                              validOrder = null, // Can be changed to `desc`, `asc`, or `any`
                              primaryKeyColumns = [],
                              precedeningColumns = [],
                              afterColumns = [],
                              orderButton = $(this),
                              orderButtonParent

                            try {
                              primaryKeyColumns = getAllPrimaryKeyColumns()

                              primaryKeyColumns = primaryKeyColumns.map((column) => {

                                column.isBtnParent = orderButton.closest('a.jstree-anchor').is(column.element)

                                return column
                              });

                              [precedeningColumns, afterColumns] = splitArrayByAttrbiute(primaryKeyColumns, 'isBtnParent')

                              orderButtonParent = precedeningColumns.at(-1)
                            } catch (e) {}

                            if (precedeningColumns.length <= 1) {
                              validOrder = 'any'
                            } else {
                              let isCurrentColumnAvailable = !orderButtonParent.element.hasClass('unavailable')

                              // Handle precedening columns
                              let precedeningColumn = precedeningColumns.at(-2),
                                // Check if the order button is active or not
                                precedeningColOrderBtn = precedeningColumn.element.find('button.column-order-type')

                              if (precedeningColOrderBtn.hasClass('active-order')) {
                                if (precedeningColOrderBtn.attr('data-original-order') == precedeningColOrderBtn.attr('data-current-order')) {
                                  validOrder = orderButton.attr('data-original-order')
                                } else {
                                  validOrder = orderButton.attr('data-original-order') == 'asc' ? 'desc' : 'asc'
                                }
                              } else {
                                // Column doesn't have an active order, but it's valid and has value
                                validOrder = 'any'
                              }

                              if (precedeningColumn.element.hasClass('invalid invalid-order'))
                                validOrder = 'invalid'
                            }

                            if (validOrder == 'invalid' && states[nextState] != 'inactive') {
                              $(node).removeClass('invalid invalid-order')

                              orderButton.removeClass('active-order')
                            } else {
                              $(node).toggleClass('invalid invalid-order', (validOrder != 'any' && validOrder != states[nextState]) && states[nextState] != 'inactive')

                              orderButton.toggleClass('active-order', states[nextState] != 'inactive')

                              let finalState = states[nextState] != 'inactive' ? states[nextState] : $(this).attr('data-original-order')

                              orderButton.attr('data-current-order', finalState)
                              orderButton.children('ion-icon').attr('name', `sort-${finalState}`)
                              orderButton.children('span').text(`${finalState}`)
                            }

                            if (!internal) {
                              for (let afterColumn of afterColumns) {
                                if ((afterColumn.element.is(orderButtonParent.element) || !afterColumn.element.hasClass('invalid invalid-order')) && !$(node).hasClass('invalid invalid-order'))
                                  continue

                                afterColumn.element.find('button.column-order-type').trigger('click', true)
                              }
                            }

                            try {
                              updateActionStatusForSelectRowColumn()
                            } catch (e) {}
                          }))
                        } catch (e) {}
                      }, 100)

                      $(node).find('div.not-ignore-checkbox').removeClass('mandatory')
                    }

                    let isUDTColumn = false

                    tableFieldsTreeContainer.find('a.jstree-anchor').get().forEach((nodeAnchor, index) => {
                      if ($(nodeAnchor).attr('ignore-disable') == 'true')
                        return

                      if ($(nodeAnchor).attr('field-type') == 'udt-column' && index == 0) {
                        isUDTColumn = true

                        return
                      }

                      if ($(nodeAnchor).attr('field-type') == 'udt-field' && isUDTColumn)
                        return

                      isUDTColumn = false

                      $(nodeAnchor).toggleClass('unavailable', index != 0)

                      $(nodeAnchor).find('input:not([type="radio"])').toggleClass('disabled', index != 0)

                      let buttonsAndInputAreas = $(nodeAnchor).find('.btn, div.focus-area')

                      $(nodeAnchor).find('div[data-is-main-input="true"]').toggleClass('disabled', index != 0)

                      buttonsAndInputAreas.toggleClass('disabled', index != 0)

                      buttonsAndInputAreas.attr('disabled', index != 0 ? '' : null)
                    })
                  } catch (e) {}

                  // Handle other columns - regular and UDTs -
                  try {
                    if (container == 'primaryKey')
                      throw 0

                    let nodes = tableFieldsTreeContainer.find('a.jstree-anchor:not(.hidden-node)').get()

                    for (let node of nodes)
                      $(node).find('div.not-ignore-checkbox').parent().hide()
                  } catch (e) {}

                  setTimeout(() => Modules.Localization.applyLanguageSpecific(tableFieldsTreeContainer.find('span[mulang], [data-mulang]')))

                  setTimeout(() => {
                    for (let inputField of tableFieldsTreeContainer.find('input').get()) {
                      setTimeout(() => {
                        try {
                          let mdbObject = getElementMDBObject($(inputField))

                          setTimeout(() => {
                            try {
                              mdbObject.update()
                            } catch (e) {}
                          })
                        } catch (e) {}
                      })
                    }
                  })
                })

                let triggerLoadEventTimeOut = null,
                  triggerLoadEvent = () => {
                    try {
                      clearTimeout(triggerLoadEventTimeOut)
                    } catch (e) {}

                    setTimeout(() => {
                      try {
                        updateActionStatusForSelectRowColumn()
                      } catch (e) {}
                    })

                    triggerLoadEventTimeOut = setTimeout(() => tableFieldsTreeContainer.trigger('loaded.jstree'))
                  }

                tableFieldsTreeContainer.on('create_node.jstree', function(e, data) {
                  let parentNodeID = '_'

                  try {
                    parentNodeID = data.node.parents.at(-2)
                  } catch (e) {}

                  try {
                    let relatedToHiddenNode = tableFieldsTreeContainer.find(`a.jstree-anchor[add-hidden-node="${parentNodeID}"]`)

                    if (relatedToHiddenNode.length <= 0)
                      throw 0

                    let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${parentNodeID}"]`)

                    hiddenNode.children('a.jstree-anchor').attr({
                      'is-hidden-node': 'true',
                      'related-node-id': relatedToHiddenNode.attr('static-id')
                    })

                    hiddenNode.css('margin-top', '-45px')

                    hiddenNode.children('a').css('pointer-events', 'none')
                  } catch (e) {}

                  triggerLoadEvent()
                })

                tableFieldsTreeContainer.on('delete_node.jstree', function(e, data) {
                  try {
                    data.instance.hide_node(data.node.id)
                  } catch (e) {}
                })

                tableFieldsTreeContainer.on('hide_node.jstree', function(e, data) {
                  let parentNodeID = '_'

                  try {
                    parentNodeID = data.node.parents.at(-2)
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      let relatedToHiddenNode = tableFieldsTreeContainer.find(`a.jstree-anchor[add-hidden-node="${parentNodeID}"]`)

                      if (relatedToHiddenNode.length <= 0)
                        throw 0

                      let hiddenNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${parentNodeID}"]`)

                      hiddenNode.children('a.jstree-anchor').attr({
                        'is-hidden-node': 'true',
                        'related-node-id': relatedToHiddenNode.attr('static-id')
                      })

                      hiddenNode.css('margin-top', '-45px')

                      hiddenNode.children('a').css('pointer-events', 'none')
                    } catch (e) {}

                    setTimeout(() => {
                      try {
                        updateActionStatusForSelectRowColumn()
                      } catch (e) {}

                      triggerLoadEvent()
                    })
                  })
                })

                tableFieldsTreeContainer.on('select_node.jstree', function(e, data) {
                  let clickedNode = tableFieldsTreeContainer.find(`li.jstree-node[id="${data.node.id}"]`)

                  try {
                    let clickedTarget = $(data.event.target)

                    if (!clickedTarget.hasClass('focus-area'))
                      throw 0

                    let relatedInput = clickedTarget.parent().children('input')

                    setTimeout(() => {
                      try {
                        if (relatedInput.attr('type') != 'checkbox')
                          throw 0

                        if (relatedInput.prop('indeterminate')) {
                          relatedInput.prop('indeterminate', false)
                          relatedInput.prop('checked', true)
                          relatedInput.trigger('change')
                        } else {
                          if (!(relatedInput.prop('checked'))) {
                            relatedInput.prop('indeterminate', true)
                            relatedInput.trigger('change')
                          } else {
                            relatedInput.trigger('click').trigger('input')
                          }
                        }

                        return
                      } catch (e) {}

                      relatedInput.trigger('focus').trigger('input')
                    })
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      data.instance.deselect_all()
                    } catch (e) {}
                  }, 100)
                })
              }
            })

            $('div.modal#rightClickActionsMetadata div[action]').hide()
            $('div.modal#rightClickActionsMetadata div[action="select-row"]').show()

            $('#rightClickActionsMetadata').addClass('selection-action').removeClass('show-editor')

            rightClickActionsMetadataModal.show()
          })
        })

        let updateRowsZIndexSelectAction = (isTransformNegative = false) => {
          setTimeout(() => {
            let rows = $('div#rightClickActionsMetadata').find('div[action="select-row"]').find('a.jstree-anchor:not(.ignored)').get(),
              rowsCount = rows.length

            if (isTransformNegative)
              rows = rows.reverse()

            for (let row of rows) {
              $(row).css('z-index', `${rowsCount}`)

              rowsCount -= 1
            }
          })
        }

        {
          $('input[type="radio"][name="selectAllowFilteringOptions"]').on('change', function() {
            setTimeout(() => {
              try {
                updateActionStatusForSelectRowColumn()
              } catch (e) {}
            })
          })

          let selectColumnAction = $('div[action="select-row"]'),
            sectionsButtons = selectColumnAction.find('div.btn[section]')

          sectionsButtons.click(function() {
            if ($(this).hasClass('active'))
              return

            sectionsButtons.removeClass('active')

            $(this).addClass('active')

            selectColumnAction.children('div[section]').hide()

            let section = $(this).attr('section')

            selectColumnAction.children(`div[section="${section}"]`).show()

            selectColumnAction.find('div.allow-filtering-hint').toggle(section == 'allow-filtering')
          })

          $('input#toBeSelectedColumnsFilter').on('input', function() {
            let filteringText = `${$(this).val()}`,
              selectNonPKColumns = $('div#tableFieldsNonPKColumnsSelectAction div.columns').children('div.column.btn')

            if (filteringText.length <= 0) {
              selectNonPKColumns.show()

              $('#noColumnMatched').hide()
              $('div#tableFieldsNonPKColumnsSelectAction div.columns').show()

              return
            }

            selectNonPKColumns.hide()

            let matchedColumns = selectNonPKColumns.filter(function() {
              return minifyText($(this).text()).includes(filteringText) || $(this).hasClass('selected')
            })

            $('#noColumnMatched').toggle(matchedColumns.length <= 0)
            $('div#tableFieldsNonPKColumnsSelectAction div.columns').toggle(matchedColumns.length > 0)

            matchedColumns.show()
          })
        }

        {
          let aggregateFunctionsDropDownInput = $('input#selectAggregateFunctions'),
            aggregateFunctionsDropDownItems = $('div.dropdown[for-select="selectAggregateFunctions"]').find('ul.dropdown-menu.multiple').find('li').find('a')

          aggregateFunctionsDropDownItems.on('click', function() {
            $(this).toggleClass('selected')

            setTimeout(() => {
              let selectedFunctions = aggregateFunctionsDropDownItems.filter('.selected'),
                finalFunctions = selectedFunctions.get().map((selectedFunction) => `${$(selectedFunction).attr('value')}`)

              aggregateFunctionsDropDownInput.val(`${finalFunctions.join(', ')}`)

              try {
                getElementMDBObject(aggregateFunctionsDropDownInput).update()
              } catch (e) {}

              try {
                updateActionStatusForSelectRowColumn()
              } catch (e) {}
            })
          })
        }
      }
    }
  }

  // Handle the request of closing a connection's work area
  {
    IPCRenderer.on('workarea:close', (_, data) => $(`div.btn[data-id="${data.btnID}"]`).trigger('click', false))
  }

  {
    setTimeout(() => {
      try {
        // Define the scroll value, by default, the current scroll value is `0` - at the top of the dialog -
        let scrollValue = 0,
          dialogElement = $(`div.modal#rightClickActionsMetadata`),
          actionEditor = monaco.editor.getEditors().find((editor) => dialogElement.find('div.action-editor div.editor div.monaco-editor').is(editor.getDomNode())),
          mainFunctionTimeOut,
          updateActionStatusForKeyspaces = () => {
            try {
              clearTimeout(mainFunctionTimeOut)
            } catch (e) {}

            mainFunctionTimeOut = setTimeout(() => {
              let replicationStrategy = $('input#keyspaceReplicationStrategy').val(),
                keyspaceName = addDoubleQuotes($('input#keyspaceName').val()),
                durableWrites = $('input#keyspaceDurableWrites').prop('checked'),
                replication = {},
                isRFAcceptable = false

              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

              isAlterState = isAlterState != null && isAlterState == 'alter'

              try {
                if (dialogElement.find('div[action="keyspaces"]').find('.is-invalid:not(.ignore-invalid)').length <= 0)
                  throw 0

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

                return
              } catch (e) {}

              try {
                if (minifyText(replicationStrategy) != 'simplestrategy')
                  throw 0

                let replicationFactor = $('input#keyspaceReplicationFactorSimpleStrategy').val()

                replication.class = 'SimpleStrategy'
                replication.replication_factor = replicationFactor
              } catch (e) {}

              try {
                if (minifyText(replicationStrategy) != 'networktopologystrategy')
                  throw 0

                let replicationFactor = $('input#keyspaceReplicationFactorSimpleStrategy').val()

                replication.class = 'NetworkTopologyStrategy'

                let dataCenters = dialogElement.find('div[action="keyspaces"]').find('div[for-strategy="NetworkTopologyStrategy"]').children('div.data-centers').find('div.data-center')

                for (let dataCenter of dataCenters) {
                  dataCenter = $(dataCenter)
                  let rf = dataCenter.find('input[type="number"]').val()

                  if (rf <= 0)
                    continue

                  isRFAcceptable = true

                  replication[dataCenter.attr('data-datacenter')] = rf
                }

                if (isAlterState)
                  isRFAcceptable = true

                dialogElement.find('div.row.invalid-text-container').toggleClass('show', !isRFAcceptable)

                let invalidState = !isAlterState && (!isRFAcceptable || ($('input#keyspaceName').hasClass('is-invalid') || `${$('input#keyspaceName').val()}`.length <= 0))

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', invalidState ? '' : null), 50)

                if (invalidState)
                  return
              } catch (e) {}

              let durableWritesSetValue = $('input#keyspaceDurableWrites').attr('set-value'),
                replicationStrategySetValue = ''

              try {
                replicationStrategySetValue = JSONRepair(JSON.parse(JSONRepair($('#rightClickActionsMetadata').attr('data-keyspace-info'))).replication_strategy)
              } catch (e) {}

              let durableWritesFinal = '',
                replicationStrategyFinal = ''

              try {
                if (isAlterState && minifyText(replicationStrategySetValue) == minifyText(JSON.stringify(replication)))
                  throw 0

                replicationStrategyFinal = OS.EOL + `WITH replication = ${JSON.stringify(replication).replace(/"/gm, "'")}`
              } catch (e) {}

              try {
                if (isAlterState && `${durableWritesSetValue}` == `${durableWrites}`)
                  throw 0

                durableWritesFinal = OS.EOL + (replicationStrategyFinal.length <= 0 ? 'WITH' : 'AND') + ` durable_writes = ${durableWrites}`
              } catch (e) {}

              try {
                if (!isAlterState)
                  throw 0

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', [replicationStrategyFinal, durableWritesFinal].every((str) => `${str}`.length <= 0) ? '' : null), 50)
              } catch (e) {}

              let statement = `${isAlterState ? 'ALTER' : 'CREATE'} KEYSPACE${!isAlterState ? ' IF NOT EXISTS' : ''} ${keyspaceName}${replicationStrategyFinal}${durableWritesFinal};`

              try {
                actionEditor.setValue(statement)
              } catch (e) {}
            })
          }

        $('input#keyspaceName').on('input', function() {
          let keyspaces = [],
            keyspaceName = $(this).val(),
            isNameDuplicated = false,
            isNameInvalid = false,
            invalidFeedback = $(this).parent().children('div.invalid-feedback'),
            isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

          isAlterState = isAlterState != null && isAlterState == 'alter'


          $(this).attr('disabled', isAlterState ? '' : null)
          $(this).parent().toggleClass('invalid-warning', isAlterState)
          $(this).removeClass('is-invalid ignore-invalid')

          try {
            if (!isAlterState)
              throw 0

            invalidFeedback.find('span').attr('mulang', 'the keyspace name can\'t be altered').text(I18next.capitalizeFirstLetter(I18next.t('the keyspace name can\'t be altered')))

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

            return
          } catch (e) {}


          try {
            keyspaces = JSON.parse(JSONRepair($('#rightClickActionsMetadata').attr('data-keyspaces')))
          } catch (e) {}

          try {
            if (keyspaces.length <= 0)
              throw 0

            isNameDuplicated = keyspaces.some((keyspace) => `${keyspace}` == `${keyspaceName}`)

            if (isAlterState && isNameDuplicated && (keyspaceName == $('div.modal#rightClickActionsMetadata').attr('data-keyspacename')))
              isNameDuplicated = false

            if (isNameDuplicated)
              invalidFeedback.find('span').attr('mulang', 'provided name is already in use').text(I18next.capitalizeFirstLetter(I18next.t('provided name is already in use')))
          } catch (e) {}

          try {
            if (`${keyspaceName}`.length <= 0)
              throw 0

            isNameInvalid = `${keyspaceName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null

            if (isNameInvalid)
              invalidFeedback.find('span').attr('mulang', 'provided name is invalid, only alphanumeric and underscores are allowed').text(I18next.capitalizeFirstLetter(I18next.t('provided name is invalid, only alphanumeric and underscores are allowed')))
          } catch (e) {}

          $(this).toggleClass('is-invalid', isNameDuplicated || isNameInvalid)

          try {
            clearTimeout(changeFooterButtonsStateTimeout)
          } catch (e) {}

          changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', $(this).hasClass('is-invalid') || `${keyspaceName}`.length <= 0 ? '' : null), 50)

          try {
            updateActionStatusForKeyspaces()
          } catch (e) {}
        })

        $('input#keyspaceReplicationStrategy').on('input', function() {
          let replicationStrategy = $(this).val(),
            isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

          isAlterState = isAlterState != null && isAlterState == 'alter'

          setTimeout(() => $('#keyspaceName').trigger('input'))

          setTimeout(() => {
            dialogElement.find('div[for-strategy]').hide()

            let networkTopologyContainer = dialogElement.find('div[for-strategy="NetworkTopologyStrategy"]'),
              simpleStrategyContainer = dialogElement.find('div[for-strategy="SimpleStrategy"]'),
              dataCentersContainer = networkTopologyContainer.children('div.data-centers'),
              dataCenters = []

            try {
              dataCenters = JSON.parse(JSONRepair($(this).attr('data-datacenters')))
            } catch (e) {}

            try {
              dataCenters = dataCenters.reduce((datacenters, datacenter) => {
                if (!datacenters.find(_datacenter => _datacenter.datacenter === datacenter.datacenter))
                  datacenters.push(datacenter);

                return datacenters
              }, [])
            } catch (e) {}

            $(this).parent().find('div.invalid-feedback span[mulang][capitalize-first]').attr('mulang', 'SimpleStrategy is intended for development purposes only').text(I18next.capitalizeFirstLetter(I18next.t('SimpleStrategy is intended for development purposes only')))

            $(this).parent().css('margin-bottom', '50px')

            try {
              if (minifyText(replicationStrategy) == minifyText('simplestrategy'))
                throw 0

              $('span.dynamic-rf').attr('mulang', 'data center replication factor')

              Modules.Localization.applyLanguageSpecific($('span.dynamic-rf'))

              $(this).removeClass('is-invalid')

              $('input#keyspaceReplicationFactorSimpleStrategy').val(1).trigger('input')

              try {
                dataCentersContainer.children('div.row.data-center').remove()

                let dataCentersRF = {}

                try {
                  if (isAlterState)
                    dataCentersRF = JSON.parse(JSONRepair($('div.modal#rightClickActionsMetadata').attr('data-datacenters-rf')))
                } catch (e) {}

                try {
                  dataCentersRF = dataCentersRF.filter((datacenter, index, datacenters) => datacenters.findIndex(_datacenter => _datacenter.name === datacenter.name) === index)
                } catch (e) {}

                for (let datacenter of dataCenters) {
                  let replicationFactor = parseInt(dataCentersRF[datacenter.datacenter]) || 0

                  try {
                    if (!isAlterState || dataCenters.length > 1 || dataCentersRF.class == 'NetworkTopologyStrategy')
                      throw 0

                    replicationFactor = parseInt($('div.modal#rightClickActionsMetadata').attr('data-rf')) || 0
                  } catch (e) {}

                  let element = `
                        <div class="data-center row" data-datacenter="${datacenter.datacenter}">
                          <div class="col-md-7">${datacenter.datacenter}</div>
                          <div class="col-md-5">
                            <div class="form-outline form-white">
                              <input type="number" class="form-control" style="margin-bottom: 0;" value="${replicationFactor}" min="0">
                              <label class="form-label">
                                <span mulang="replication factor" capitalize></span>
                              </label>
                            </div>
                          </div>
                        </div>`
                  dataCentersContainer.append($(element).show(function() {
                    let dataCenter = $(this)

                    setTimeout(() => {
                      dataCenter.find('input').each(function() {
                        getElementMDBObject($(this))
                      })

                      dataCenter.find('input[type="number"]').on('input', function() {
                        let rf = parseInt($(this).val()),
                          isInvalid = isNaN(rf) || rf < 0

                        $(this).toggleClass('is-invalid', isInvalid)

                        if (minifyText($('input#keyspaceName').val()).length <= 0)
                          return

                        try {
                          clearTimeout(changeFooterButtonsStateTimeout)
                        } catch (e) {}

                        changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isInvalid ? '' : null), 50)

                        try {
                          updateActionStatusForKeyspaces()
                        } catch (e) {}
                      })
                    })

                    setTimeout(() => Modules.Localization.applyLanguageSpecific(dataCenter.find('span[mulang], [data-mulang]')))
                  }))
                }
              } catch (e) {}

              networkTopologyContainer.show()

              try {
                updateActionStatusForKeyspaces()
              } catch (e) {}

              return
            } catch (e) {}

            $('span.dynamic-rf').attr('mulang', 'replication factor')

            Modules.Localization.applyLanguageSpecific($('span.dynamic-rf'))

            setTimeout(() => $(this).addClass('is-invalid'), 250)

            try {
              if (!isAlterState)
                throw 0

              $('input#keyspaceReplicationFactorSimpleStrategy').val(parseInt($('div.modal#rightClickActionsMetadata').attr('data-rf')) || 1)

              $(`div.modal#rightClickActionsMetadata`).find('div.data-center').find('input[type="number"]').val(0).trigger('input')

              if (dataCenters.length > 1) {
                $(this).parent().find('div.invalid-feedback span[mulang][capitalize-first]').attr('mulang', 'avoid switching from SimpleStrategy to NetworkTopologyStrategy in multi-DC clusters; plan carefully').text(I18next.capitalizeFirstLetter(I18next.t('avoid switching from SimpleStrategy to NetworkTopologyStrategy in multi-DC clusters; plan carefully')))

                $(this).parent().css('margin-bottom', '50px')
              }
            } catch (e) {}

            dialogElement.find('div[for-strategy="SimpleStrategy"]').show()

            try {
              updateActionStatusForKeyspaces()
            } catch (e) {}
          }, 150)
        })

        $('input#keyspaceReplicationFactorSimpleStrategy').on('input', function() {
          let rf = parseInt($(this).val()),
            isInvalid = isNaN(rf) || rf < 1

          $('input#keyspaceReplicationFactorSimpleStrategy').toggleClass('is-invalid', isInvalid)

          if (minifyText($('input#keyspaceName').val()).length <= 0)
            return

          try {
            clearTimeout(changeFooterButtonsStateTimeout)
          } catch (e) {}

          changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isInvalid ? '' : null), 50)

          try {
            updateActionStatusForKeyspaces()
          } catch (e) {}
        })

        // Clicks the `SWITCH TO EDITOR` button
        dialogElement.find('button.switch-editor').click(function() {
          // Point at the dialog's content element
          let dialogBody = dialogElement.find('div.modal-body'),
            // Determine if the editor is visible/shown or not
            editorShown = dialogElement.hasClass('show-editor'),
            currentActiveAction = $('div.modal#rightClickActionsMetadata div[action]').filter(':visible').attr('action')

          // Add the `show-editor` class if it is not added, otherwise it'll be removed
          dialogElement.toggleClass('show-editor', !editorShown)

          try {
            dialogBody.css('height', !editorShown && dialogBody.height() > $('body').height() ? `${$('body').height() - 200}px` : '')
          } catch (e) {}

          // Update the current scroll value if the editor is not shown already, otherwise, keep the current saved value
          scrollValue = !editorShown ? dialogBody[0].scrollTop : scrollValue

          // Either scroll to the last saved position if the editor is visible, or scroll to the top of the dialog for the editor before showing it
          dialogBody[0].scrollTo(0, editorShown ? scrollValue : 0)

          // Update the editor's layout
          $(window.visualViewport).trigger('resize')

          try {
            if (currentActiveAction != 'keyspaces')
              throw 0

            updateActionStatusForKeyspaces()
          } catch (e) {}

          try {
            if (currentActiveAction != 'udts')
              throw 0

            updateActionStatusForUDTs()
          } catch (e) {}

          try {
            if (currentActiveAction != 'counter-tables')
              throw 0

            updateActionStatusForCounterTables()
          } catch (e) {}

          try {
            if (currentActiveAction != 'standard-tables')
              throw 0

            updateActionStatusForStandardTables()
          } catch (e) {}

          try {
            if (currentActiveAction != 'insert-row')
              throw 0

            updateActionStatusForInsertRow()
          } catch (e) {}
        })

        $('input[type="checkbox"]#keyspaceDurableWrites').on('change', function() {
          try {
            updateActionStatusForKeyspaces()
          } catch (e) {}
        })

        $('button#executeActionStatement').click(function() {
          let currentActiveAction = $('div.modal#rightClickActionsMetadata div[action]').filter(':visible').attr('action')

          try {
            if (currentActiveAction != 'keyspaces')
              throw 0

            updateActionStatusForKeyspaces()
          } catch (e) {}

          try {
            if (currentActiveAction != 'udts')
              throw 0

            updateActionStatusForUDTs()
          } catch (e) {}

          try {
            if (currentActiveAction != 'insert-row')
              throw 0

            updateActionStatusForInsertRow()
          } catch (e) {}

          try {
            if (currentActiveAction != 'counter-tables')
              throw 0

            updateActionStatusForCounterTables()
          } catch (e) {}

          try {
            if (currentActiveAction != 'standard-tables')
              throw 0

            updateActionStatusForStandardTables()
          } catch (e) {}

          try {
            getElementMDBObject($(`a.nav-link.btn[href="#${$(this).attr('data-tab-id')}"]`), 'Tab').show()
          } catch (e) {}

          let activeWorkarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[connection-id="${activeConnectionID}"]`)

          try {
            activeWorkarea.find('div.terminal-container').hide()
            activeWorkarea.find('div.interactive-terminal-container').show()
          } catch (e) {}

          try {
            let statementInputField = $(`textarea#${$(this).attr('data-textarea-id')}`)
            statementInputField.val(actionEditor.getValue())
            statementInputField.trigger('input').focus()
            AutoSize.update(statementInputField[0])
          } catch (e) {}

          try {
            setTimeout(() => $(`button#${$(this).attr('data-btn-id')}`).click(), 100)
          } catch (e) {}

          try {
            setTimeout(() => getElementMDBObject($('#rightClickActionsMetadata'), 'Modal').hide(), 50)
          } catch (e) {}
        })

        let updateActionStatusForUDTs

        {
          let getFieldElement = (keyspaceUDTs = []) => {
              let typesList = `
              <li><span class="group-text"><span mulang="numeric types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="int">int</a></li>
              <li><a class="dropdown-item" href="#" value="bigint">bigint</a></li>
              <li><a class="dropdown-item" href="#" value="smallint">smallint</a></li>
              <li><a class="dropdown-item" href="#" value="tinyint">tinyint</a></li>
              <li><a class="dropdown-item" href="#" value="varint">varint</a></li>
              <li><a class="dropdown-item" href="#" value="float">float</a></li>
              <li><a class="dropdown-item" href="#" value="double">double</a></li>
              <li><a class="dropdown-item" href="#" value="decimal">decimal</a></li>
              <li><span class="group-text"><span mulang="textual types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="text">text</a></li>
              <li><a class="dropdown-item" href="#" value="varchar">varchar</a></li>
              <li><a class="dropdown-item" href="#" value="ascii">ascii</a></li>
              <li><span class="group-text"><span mulang="boolean type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="boolean">boolean</a></li>
              <li><span class="group-text"><span mulang="date/time types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="timestamp">timestamp</a></li>
              <li><a class="dropdown-item" href="#" value="date">date</a></li>
              <li><a class="dropdown-item" href="#" value="duration">duration</a></li>
              <li><a class="dropdown-item" href="#" value="time">time</a></li>
              <li><span class="group-text"><span mulang="binary type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="blob">blob</a></li>
              <li><span class="group-text"><span mulang="UUID types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="uuid">uuid</a></li>
              <li><a class="dropdown-item" href="#" value="timeuuid">timeuuid</a></li>
              <li><span class="group-text"><span mulang="network type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="inet">inet</a></li>`,
                collectionsTypesItems = `
              <li><span class="group-text"><span mulang="collection types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="list" data-is-collection>list&lt;type&gt;</a></li>
              <li><a class="dropdown-item" href="#" value="set" data-is-collection>set&lt;type&gt;</a></li>
              <li><a class="dropdown-item" style="overflow: hidden; text-overflow: ellipsis;" href="#" value="map" data-is-collection data-is-map>map&lt;key_type, value_type&gt;</a></li>`
              defaultType = 'text'

              try {
                if (keyspaceUDTs == null || keyspaceUDTs.length <= 0)
                  throw 0

                typesList = ''

                defaultType = keyspaceUDTs[0]

                for (let udt of keyspaceUDTs)
                  typesList += `<li><a class="dropdown-item" href="#" value="${udt}">${udt}</a></li>`
              } catch (e) {}

              let [
                collectionKeyTypeID,
                collectionItemTypeID,
                fieldDataTypeID
              ] = getRandom.id(10, 3).map((id) => `_${id}`),
                element = `
            <div class="data-field row" ${keyspaceUDTs.length > 0 ? 'for-udt-data-field' : ''}>
            <div class="col-md-5">
              <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                <input type="text" class="form-control form-icon-trailing fieldName is-invalid" style="margin-bottom: 0;">
                <label class="form-label">
                  <span mulang="field name" capitalize></span>
                </label>
                <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
              </div>
            </div>
            <div class="col-md-6" col="fieldDataType">
              <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                <input type="text" class="form-control form-icon-trailing fieldDataType" id="${fieldDataTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                <label class="form-label">
                  <span mulang="field data type" capitalize></span>
                </label>
                <div class="valid-feedback"></div>
                <div class="invalid-feedback"></div>
              </div>
              <div class="dropdown" for-select="${fieldDataTypeID}" for-data-type="fieldDataType" style="bottom: 20px;">
                <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                <ul class="dropdown-menu">
                  ${typesList}
                  ${keyspaceUDTs.length <= 0 ? collectionsTypesItems : ''}
                </ul>
              </div>
            </div>
            <div class="col-md-2" col="collectionKeyType" style="display:none;">
              <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                <input type="text" class="form-control form-icon-trailing collectionKeyType" id="${collectionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                <label class="form-label">
                  <span mulang="key type" capitalize></span>
                </label>
                <div class="valid-feedback"></div>
                <div class="invalid-feedback"></div>
              </div>
              <div class="dropdown" for-select="${collectionKeyTypeID}" style="bottom: 20px;">
                <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                <ul class="dropdown-menu">
                  ${typesList}
                </ul>
              </div>
            </div>
            <div class="col-md-2" col="collectionItemType" style="display:none;">
              <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                <input type="text" class="form-control form-icon-trailing collectionItemType" id="${collectionItemTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                <label class="form-label">
                  <span mulang="value type" capitalize></span>
                </label>
                <div class="valid-feedback"></div>
                <div class="invalid-feedback"></div>
              </div>
              <div class="dropdown" for-select="${collectionItemTypeID}" style="bottom: 20px;">
                <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                <ul class="dropdown-menu">
                  ${typesList}
                </ul>
              </div>
            </div>
            <div class="col-md-1">
              <a action="delete-udt" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                <ion-icon name="trash"></ion-icon>
              </a>
            </div>
          </div>`

              return element
            },
            updateRowsZIndex = (isTransformNegative = false) => {
              setTimeout(() => {
                let rows = dialogElement.find('div.data-field.row').get(),
                  rowsCount = rows.length

                if (isTransformNegative)
                  rows = rows.reverse()

                for (let row of rows) {
                  $(row).css('z-index', `${rowsCount}`)

                  rowsCount -= 1
                }
              })
            }

          updateActionStatusForUDTs = () => {
            try {
              clearTimeout(mainFunctionTimeOut)
            } catch (e) {}

            mainFunctionTimeOut = setTimeout(() => {
              let udtName = addDoubleQuotes($('input#udtName').val()),
                keyspaceName = addDoubleQuotes(dialogElement.find('div[action="udts"]').find('div.keyspace-name').text()),
                allDataFields = dialogElement.find('div[action="udts"]').find('div.data-field.row'),
                isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state'),
                dataFieldsText = ''

              isAlterState = isAlterState != null && isAlterState == 'alter'

              try {
                if (dialogElement.find('div[action="udts"]').find('.is-invalid:not(.ignore-invalid)').length <= 0 &&
                  dialogElement.find('div[action="udts"]').find('div.data-field.row').length > 0 &&
                  minifyText(udtName).length > 0)
                  throw 0

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

                return
              } catch (e) {}

              try {
                if (!isAlterState)
                  throw 0

                let statements = []

                for (let row of dialogElement.find('div[action="udts"]').find('div.data-field.row')) {
                  let rowElement = $(row),
                    fieldName = addDoubleQuotes(rowElement.find('input.fieldName').attr('data-original-value')),
                    fieldType = addDoubleQuotes(rowElement.find('input.fieldDataType').attr('data-original-value'))

                  // Deleting a field is the first thing to be checked
                  if (rowElement.hasClass('deleted')) {
                    statements.push(`ALTER TYPE ${keyspaceName}.${udtName} DROP ${fieldName};`)
                    continue
                  }

                  // The type of the field has been changed
                  {
                    let isChangeInTypeDetected = false

                    try {
                      for (let typeRelatedField of [rowElement.find('input.fieldDataType'), rowElement.find('input.collectionItemType'), rowElement.find('input.collectionKeyType')]) {
                        let setValue = typeRelatedField.val(),
                          originalValue = typeRelatedField.attr('data-original-value')

                        if (setValue != originalValue && originalValue != undefined) {
                          isChangeInTypeDetected = true
                          break
                        }
                      }
                    } catch (e) {}

                    try {
                      if (!isChangeInTypeDetected)
                        throw 0

                      // Second is altering the type of the field
                      let newFieldType = rowElement.find('input.fieldDataType').val()

                      if (!([newFieldType, fieldName].some((data) => data == undefined))) {
                        try {
                          if (['map', 'set', 'list'].some((type) => newFieldType == type))
                            throw 0

                          let finalNewFieldType = addDoubleQuotes(`${newFieldType}`)

                          if (rowElement.parent().hasClass('data-udt-fields'))
                            finalNewFieldType = `frozen<${finalNewFieldType}>`

                          statements.push(`ALTER TYPE ${keyspaceName}.${udtName} ALTER ${fieldName} TYPE ${finalNewFieldType};`)
                        } catch (e) {}

                        try {
                          if (!(['map', 'set', 'list'].some((type) => newFieldType == type)))
                            throw 0

                          let collectionItemType = addDoubleQuotes(rowElement.find('input.collectionItemType').val())

                          if (`${newFieldType}` != 'map') {
                            statements.push(`ALTER TYPE ${keyspaceName}.${udtName} ALTER ${fieldName} TYPE ${newFieldType}<${collectionItemType}>;`)
                            throw 0
                          }

                          let collectionKeyType = addDoubleQuotes(rowElement.find('input.collectionKeyType').val())

                          statements.push(`ALTER TYPE ${keyspaceName}.${udtName} ALTER ${fieldName} TYPE ${newFieldType}<${collectionKeyType}, ${collectionItemType}>;`)
                        } catch (e) {}
                      }
                    } catch (e) {}
                  }

                  // The field's name has been changed
                  {
                    try {
                      let setFieldName = addDoubleQuotes(rowElement.find('input.fieldName').val())

                      if (fieldName == setFieldName || fieldName == undefined)
                        throw 0

                      statements.push(`ALTER TYPE ${keyspaceName}.${udtName} RENAME ${fieldName} TO ${setFieldName};`)
                    } catch (e) {}
                  }

                  // A new field has been added
                  {
                    try {
                      if (rowElement.attr('data-original-field') != undefined)
                        throw 0

                      fieldName = addDoubleQuotes(rowElement.find('input.fieldName').val())
                      fieldType = addDoubleQuotes(rowElement.find('input.fieldDataType').val())

                      try {
                        if (['map', 'set', 'list'].some((type) => fieldType == type))
                          throw 0

                        let finalFieldType = `${fieldType}`

                        if (rowElement.parent().hasClass('data-udt-fields'))
                          finalFieldType = `frozen<${finalFieldType}>`

                        statements.push(`ALTER TYPE ${keyspaceName}.${udtName} ADD ${fieldName} ${finalFieldType};`)
                      } catch (e) {}

                      try {
                        if (!(['map', 'set', 'list'].some((type) => fieldType == type)))
                          throw 0

                        let collectionItemType = addDoubleQuotes(rowElement.find('input.collectionItemType').val())

                        if (`${fieldType}` != 'map') {
                          statements.push(`ALTER TYPE ${keyspaceName}.${udtName} ADD ${fieldName} ${fieldType}<${collectionItemType}>;`)

                          throw 0
                        }

                        let collectionKeyType = rowElement.find('input.collectionKeyType').val()

                        statements.push(`ALTER TYPE ${keyspaceName}.${udtName} ADD ${fieldName} ${fieldType}<${collectionKeyType}, ${collectionItemType}>;`)
                      } catch (e) {}
                    } catch (e) {}
                  }
                }

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', statements.length <= 0 ? '' : null), 50)

                try {
                  actionEditor.setValue(statements.join(OS.EOL))
                } catch (e) {}

                return
              } catch (e) {}

              try {
                let currentIndex = 0

                for (let dataField of allDataFields) {
                  let tempTxt = '',
                    dataFieldUIElement = $(dataField),
                    isUDTDataField = $(dataField).attr('for-udt-data-field') != undefined,
                    fieldName = addDoubleQuotes(dataFieldUIElement.find('input.fieldName').val()),
                    fieldType = addDoubleQuotes(dataFieldUIElement.find('input.fieldDataType').val()),
                    collectionKeyType = addDoubleQuotes(dataFieldUIElement.find('input.collectionKeyType').val()),
                    collectionItemType = addDoubleQuotes(dataFieldUIElement.find('input.collectionItemType').val())

                  currentIndex += 1

                  try {
                    if (!isUDTDataField)
                      throw 0

                    tempTxt = `${fieldName} frozen<${fieldType}>`
                  } catch (e) {}

                  try {
                    if (isUDTDataField)
                      throw 0

                    let finalFieldType = `${fieldName} ${fieldType}`

                    if (['set', 'list'].some((type) => fieldType == type))
                      finalFieldType = `${fieldName} ${fieldType}<${collectionItemType}>`

                    if (fieldType == 'map')
                      finalFieldType = `${fieldName} ${fieldType}<${collectionKeyType},${collectionItemType}>`

                    tempTxt = finalFieldType
                  } catch (e) {}

                  if (currentIndex != allDataFields.length)
                    tempTxt = `${tempTxt},`

                  tempTxt = `    ${tempTxt}`

                  dataFieldsText += tempTxt + OS.EOL
                }
              } catch (e) {}

              dataFieldsText = OS.EOL + dataFieldsText

              let statement = `CREATE TYPE IF NOT EXISTS ${keyspaceName}.${udtName} (${dataFieldsText});`

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

              try {
                actionEditor.setValue(statement)
              } catch (e) {}
            })
          }

          let dataFieldsContainer = dialogElement.find('div.data-fields'),
            dataUDTFieldsContainer = dialogElement.find('div.data-udt-fields')

          $(`a[action]#addDataField`).on('click', function(_, fields = null) {
            dataFieldsContainer.children('div.empty-fields').hide()

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              let filterdFields = fields.filter((field) => !field.type.includes('frozen<'))

              if (filterdFields.length <= 0) {
                dataFieldsContainer.children('div.empty-fields').show()
                return
              }

              for (let field of filterdFields) {
                dataFieldsContainer.append($(getFieldElement()).show(function() {
                  let row = $(this)

                  row.attr('data-original-field', 'true')

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      row.find('div.dropdown[for-select]').each(function() {
                        let dropDownElement = $(this),
                          // Get the MDB object of the current dropdown element
                          selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                          // Point at the associated input field
                          input = row.find(`input#${dropDownElement.attr('for-select')}`)

                        // Once the associated select element is being focused then show the dropdown element and vice versa
                        input.on('focus', () => {
                          try {
                            input.parent().find('div.invalid-feedback').addClass('transparent-color')
                          } catch (e) {}

                          selectDropdown.show()
                        }).on('focusout', () => setTimeout(() => {
                          try {
                            input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                          } catch (e) {}

                          selectDropdown.hide()
                        }, 100))

                        // Once the parent `form-outline` is clicked trigger the `focus` event
                        input.parent().click(() => input.trigger('focus'))
                      })

                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'fieldDataType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined

                          try {
                            if (!mainDropDown)
                              throw 0

                            row.find(`div[col="fieldDataType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForUDTs()
                          } catch (e) {}
                        })
                      })
                    }

                    $(this).find(`a[action="delete-udt"]`).click(function() {
                      row.toggleClass('deleted')

                      try {
                        updateActionStatusForUDTs()
                      } catch (e) {}
                    })

                    let errorWarningIcon = $(this).find('ion-icon.error-warning')

                    $(this).find('input.fieldName').on('input', function(_, triggerInput = true) {
                      let fieldName = $(this).val(),
                        fieldRow = $(this).parent().parent().parent(),
                        isNameDuplicated = false,
                        isNameInvalid = false,
                        isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                      isAlterState = isAlterState != null && isAlterState == 'alter'

                      try {
                        if (`${fieldName}`.length <= 0)
                          throw 0

                        isNameInvalid = `${fieldName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                      } catch (e) {}

                      try {
                        let allDataFields = dialogElement.find('div[action="udts"]').find('div.data-field.row').not(fieldRow[0])

                        for (let dataField of allDataFields) {
                          let dataFieldNameElement = $(dataField).find('input.fieldName')

                          if (triggerInput)
                            dataFieldNameElement.trigger('input', false)

                          if (minifyText(`${dataFieldNameElement.val()}`) != minifyText(fieldName))
                            continue

                          isNameDuplicated = true
                          break
                        }
                      } catch (e) {}

                      let isError = isNameDuplicated || isNameInvalid || minifyText(fieldName).length <= 0

                      $(this).toggleClass('is-invalid', isError)

                      errorWarningIcon.toggleClass('show', isError && minifyText(fieldName).length > 0)

                      try {
                        if (!isError)
                          throw 0

                        let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                        tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                        tooltip.enable()
                      } catch (e) {}

                      try {
                        clearTimeout(changeFooterButtonsStateTimeout)
                      } catch (e) {}

                      changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                      try {
                        updateActionStatusForUDTs()
                      } catch (e) {}
                    })

                    setTimeout(() => {
                      $(this).find('input[type="text"]').each(function() {
                        let mdbObject = getElementMDBObject($(this))

                        setTimeout(() => mdbObject.update(), 500)
                      })
                    })

                    setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                    updateRowsZIndex()

                    try {
                      row.find('input.fieldName').val(field.name).trigger('input')
                      row.find('input.fieldName').attr('data-original-value', field.name)

                      if (['map', 'set', 'list'].some((type) => field.type == type))
                        throw 0

                      row.find('input.fieldDataType').val(field.type).trigger('input')
                      row.find('input.fieldDataType').attr('data-original-value', field.type)
                    } catch (e) {}

                    try {
                      let extractData = field.type.match(/(.+)\<(.*?)\>/)

                      if (extractData == null || !(['map', 'set', 'list'].some((type) => extractData[1].includes(type))))
                        throw 0

                      $(`div.dropdown[for-select="${row.find('input.fieldDataType').attr('id')}"]`).find(`li a[value="${extractData[1]}"]`).trigger('click')

                      row.find('input.fieldDataType').attr('data-original-value', extractData[1])

                      if (extractData[1] != 'map') {
                        row.find('input.collectionItemType').val(extractData[2]).trigger('input')
                        row.find('input.collectionItemType').attr('data-original-value', extractData[2])
                      } else {
                        let mapValues = minifyText(extractData[2]).split(',')

                        row.find('input.collectionKeyType').val(mapValues[0]).trigger('input')
                        row.find('input.collectionKeyType').attr('data-original-value', mapValues[0])

                        row.find('input.collectionItemType').val(mapValues[1]).trigger('input')
                        row.find('input.collectionItemType').attr('data-original-value', mapValues[1])
                      }
                    } catch (e) {}

                    try {
                      updateActionStatusForUDTs()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getFieldElement()).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'fieldDataType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="fieldDataType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForUDTs()
                      } catch (e) {}
                    })
                  })
                }

                $(this).find(`a[action="delete-udt"]`).click(function() {
                  $(this).parent().parent().remove()

                  try {
                    updateActionStatusForUDTs()
                  } catch (e) {}

                  if (dataFieldsContainer.children('div.data-field.row').length != 0)
                    return

                  dataFieldsContainer.children('div.empty-fields').fadeIn(250)
                })

                let errorWarningIcon = $(this).find('ion-icon.error-warning')

                $(this).find('input.fieldName').on('input', function(_, triggerInput = true) {
                  let fieldName = $(this).val(),
                    fieldRow = $(this).parent().parent().parent(),
                    isNameDuplicated = false,
                    isNameInvalid = false,
                    isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                  isAlterState = isAlterState != null && isAlterState == 'alter'

                  try {
                    if (`${fieldName}`.length <= 0)
                      throw 0

                    isNameInvalid = `${fieldName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                  } catch (e) {}

                  try {
                    let allDataFields = dialogElement.find('div[action="udts"]').find('div.data-field.row').not(fieldRow[0])

                    for (let dataField of allDataFields) {
                      let dataFieldNameElement = $(dataField).find('input.fieldName')

                      if (triggerInput)
                        dataFieldNameElement.trigger('input', false)

                      if (minifyText(`${dataFieldNameElement.val()}`) != minifyText(fieldName))
                        continue

                      isNameDuplicated = true
                      break
                    }
                  } catch (e) {}

                  let isError = isNameDuplicated || isNameInvalid || minifyText(fieldName).length <= 0

                  $(this).toggleClass('is-invalid', isError)

                  errorWarningIcon.toggleClass('show', isError && minifyText(fieldName).length > 0)

                  try {
                    if (!isError)
                      throw 0

                    let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                    tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                    tooltip.enable()
                  } catch (e) {}

                  try {
                    clearTimeout(changeFooterButtonsStateTimeout)
                  } catch (e) {}

                  changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                  try {
                    updateActionStatusForUDTs()
                  } catch (e) {}
                })

                setTimeout(() => {
                  $(this).find('input[type="text"]').each(function() {
                    let mdbObject = getElementMDBObject($(this))

                    setTimeout(() => mdbObject.update(), 500)
                  })
                })

                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                updateRowsZIndex()

                try {
                  updateActionStatusForUDTs()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addUDTDataField`).click('click', function(_, fields = null) {
            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}

            try {
              if (!isAlterState)
                throw 0

              keyspaceUDTs = keyspaceUDTs.filter((udt) => udt != $('input#udtName').val())
            } catch (e) {}

            if (keyspaceUDTs.length <= 0) {
              $('a[action]#addUDTDataField').addClass('disabled')

              dataUDTFieldsContainer.children('div.empty-fields').find('span').hide()
              dataUDTFieldsContainer.children('div.empty-fields').find('span.one-udt').show()

              return
            }

            dataUDTFieldsContainer.children('div.empty-fields').hide()

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              let filterdFields = fields.filter((field) => field.type.includes('frozen<'))

              if (filterdFields.length <= 0) {
                dataUDTFieldsContainer.children('div.empty-fields').show()
                return
              }

              for (let field of filterdFields) {
                try {
                  let extractData = field.type.match(/.+\<(.*?)\>/)[1]

                  field.type = extractData
                } catch (e) {}

                dataUDTFieldsContainer.append($(getFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this)

                  row.attr('data-original-field', 'true')

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      row.find('div.dropdown[for-select]').each(function() {
                        let dropDownElement = $(this),
                          // Get the MDB object of the current dropdown element
                          selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                          // Point at the associated input field
                          input = row.find(`input#${dropDownElement.attr('for-select')}`)

                        // Once the associated select element is being focused then show the dropdown element and vice versa
                        input.on('focus', () => {
                          try {
                            input.parent().find('div.invalid-feedback').addClass('transparent-color')
                          } catch (e) {}

                          selectDropdown.show()
                        }).on('focusout', () => setTimeout(() => {
                          try {
                            input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                          } catch (e) {}

                          selectDropdown.hide()
                        }, 100))

                        // Once the parent `form-outline` is clicked trigger the `focus` event
                        input.parent().click(() => input.trigger('focus'))
                      })
                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'fieldDataType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined

                          try {
                            if (!mainDropDown)
                              throw 0

                            row.find(`div[col="fieldDataType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForUDTs()
                          } catch (e) {}
                        })
                      })
                    }

                    $(this).find(`a[action="delete-udt"]`).click(function() {
                      row.toggleClass('deleted')

                      try {
                        updateActionStatusForUDTs()
                      } catch (e) {}
                    })

                    let errorWarningIcon = $(this).find('ion-icon.error-warning')

                    $(this).find('input.fieldName').on('input', function(_, triggerInput = true) {
                      let fieldName = $(this).val(),
                        fieldRow = $(this).parent().parent().parent(),
                        isNameDuplicated = false,
                        isNameInvalid = false,
                        isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                      isAlterState = isAlterState != null && isAlterState == 'alter'

                      try {
                        if (`${fieldName}`.length <= 0)
                          throw 0

                        isNameInvalid = `${fieldName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                      } catch (e) {}

                      try {
                        let allDataFields = dialogElement.find('div[action="udts"]').find('div.data-field.row').not(fieldRow[0])

                        for (let dataField of allDataFields) {
                          let dataFieldNameElement = $(dataField).find('input.fieldName')

                          if (triggerInput)
                            dataFieldNameElement.trigger('input', false)

                          if (minifyText(`${dataFieldNameElement.val()}`) != minifyText(fieldName))
                            continue

                          isNameDuplicated = true
                          break
                        }
                      } catch (e) {}

                      let isError = isNameDuplicated || isNameInvalid || minifyText(fieldName).length <= 0

                      $(this).toggleClass('is-invalid', isError)

                      errorWarningIcon.toggleClass('show', isError && minifyText(fieldName).length > 0)

                      try {
                        if (!isError)
                          throw 0

                        let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                        tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                        tooltip.enable()
                      } catch (e) {}

                      try {
                        clearTimeout(changeFooterButtonsStateTimeout)
                      } catch (e) {}

                      changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                      try {
                        updateActionStatusForUDTs()
                      } catch (e) {}
                    })

                    setTimeout(() => {
                      $(this).find('input[type="text"]').each(function() {
                        let mdbObject = getElementMDBObject($(this))

                        setTimeout(() => mdbObject.update(), 500)
                      })
                    })

                    setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                    updateRowsZIndex()

                    try {
                      row.find('input.fieldName').val(field.name).trigger('input')
                      row.find('input.fieldName').attr('data-original-value', field.name)

                      row.find('input.fieldDataType').val(field.type).trigger('input')
                      row.find('input.fieldDataType').attr('data-original-value', field.type)
                    } catch (e) {}

                    try {
                      updateActionStatusForUDTs()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataUDTFieldsContainer.append($(getFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })
                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'fieldDataType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="fieldDataType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 6}`)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForUDTs()
                      } catch (e) {}
                    })
                  })
                }

                $(this).find(`a[action="delete-udt"]`).click(function() {
                  $(this).parent().parent().remove()

                  try {
                    updateActionStatusForUDTs()
                  } catch (e) {}

                  if (dataUDTFieldsContainer.children('div.data-field.row').length != 0)
                    return

                  dataUDTFieldsContainer.children('div.empty-fields').fadeIn(250)
                })

                let errorWarningIcon = $(this).find('ion-icon.error-warning')

                $(this).find('input.fieldName').on('input', function(_, triggerInput = true) {
                  let fieldName = $(this).val(),
                    fieldRow = $(this).parent().parent().parent(),
                    isNameDuplicated = false,
                    isNameInvalid = false,
                    isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                  isAlterState = isAlterState != null && isAlterState == 'alter'

                  try {
                    if (`${fieldName}`.length <= 0)
                      throw 0

                    isNameInvalid = `${fieldName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                  } catch (e) {}

                  try {
                    let allDataFields = dialogElement.find('div[action="udts"]').find('div.data-field.row').not(fieldRow[0])

                    for (let dataField of allDataFields) {
                      let dataFieldNameElement = $(dataField).find('input.fieldName')

                      if (triggerInput)
                        dataFieldNameElement.trigger('input', false)

                      if (minifyText(`${dataFieldNameElement.val()}`) != minifyText(fieldName))
                        continue

                      isNameDuplicated = true
                      break
                    }
                  } catch (e) {}

                  let isError = isNameDuplicated || isNameInvalid || minifyText(fieldName).length <= 0

                  $(this).toggleClass('is-invalid', isError)

                  errorWarningIcon.toggleClass('show', isError && minifyText(fieldName).length > 0)

                  try {
                    if (!isError)
                      throw 0

                    let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                    tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                    tooltip.enable()
                  } catch (e) {}

                  try {
                    clearTimeout(changeFooterButtonsStateTimeout)
                  } catch (e) {}

                  changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                  try {
                    updateActionStatusForUDTs()
                  } catch (e) {}
                })

                setTimeout(() => {
                  $(this).find('input[type="text"]').each(function() {
                    let mdbObject = getElementMDBObject($(this))

                    setTimeout(() => mdbObject.update(), 500)
                  })
                })

                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                updateRowsZIndex()

                try {
                  updateActionStatusForUDTs()
                } catch (e) {}
              })
            }))
          })

          $('input#udtName').on('input', function() {
            let keyspaceUDTs = [],
              udtName = $(this).val(),
              isNameDuplicated = false,
              isNameInvalid = false,
              invalidFeedback = $(this).parent().children('div.invalid-feedback'),
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            $(this).attr('disabled', isAlterState ? '' : null)
            $(this).parent().toggleClass('invalid-warning', isAlterState)
            $(this).removeClass('is-invalid ignore-invalid')

            try {
              if (!isAlterState)
                throw 0

              invalidFeedback.find('span').attr('mulang', 'the UDT name can\'t be altered').text(I18next.capitalizeFirstLetter(I18next.t('the UDT name can\'t be altered')))

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

              return
            } catch (e) {}

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($('#rightClickActionsMetadata').attr('data-keyspace-udts')))
            } catch (e) {}

            try {
              if (keyspaceUDTs.length <= 0)
                throw 0

              isNameDuplicated = keyspaceUDTs.some((udt) => minifyText(`${udt.name}`) == minifyText(`${udtName}`))

              if (isAlterState && isNameDuplicated && (udtName == $('div.modal#rightClickActionsMetadata').attr('data-udt-name')))
                isNameDuplicated = false

              if (isNameDuplicated)
                invalidFeedback.find('span').attr('mulang', 'provided name is already in use').text(I18next.capitalizeFirstLetter(I18next.t('provided name is already in use')))
            } catch (e) {}

            try {
              if (`${udtName}`.length <= 0)
                throw 0

              isNameInvalid = `${udtName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null

              if (isNameInvalid)
                invalidFeedback.find('span').attr('mulang', 'provided name is invalid, only alphanumeric and underscores are allowed').text(I18next.capitalizeFirstLetter(I18next.t('provided name is invalid, only alphanumeric and underscores are allowed')))
            } catch (e) {}

            $(this).toggleClass('is-invalid', isNameDuplicated || isNameInvalid)

            let allDataFields = dialogElement.find('div[action="udts"]').find('div.data-field.row'),
              invalidInputFields = allDataFields.find('input.is-invalid')

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', $(this).hasClass('is-invalid') || `${keyspaceName}`.length <= 0 || allDataFields.length <= 0 || invalidInputFields.length > 0 ? '' : null), 50)

            try {
              updateActionStatusForUDTs()
            } catch (e) {}
          })
        }

        let updateActionStatusForCounterTables

        {
          let updateRowsZIndex = (isTransformNegative = false) => {
            setTimeout(() => {
              let rows = dialogElement.find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field, div.counter-table-option-field').get(),
                rowsCount = rows.length

              if (isTransformNegative)
                rows = rows.reverse()

              for (let row of rows) {
                $(row).css('z-index', `${rowsCount}`)

                rowsCount -= 1
              }
            })
          }

          updateActionStatusForCounterTables = () => {
            try {
              clearTimeout(mainFunctionTimeOut)
            } catch (e) {}

            mainFunctionTimeOut = setTimeout(() => {
              let counterTableName = addDoubleQuotes($('input#countertableName').val())

              try {
                if (dialogElement.find('div[action="counter-tables"]').find('.is-invalid:not(.ignore-invalid)').length <= 0 &&
                  dialogElement.find('div[action="counter-tables"]').find('div.counter-table-partition-key-field.row').length > 0 &&
                  dialogElement.find('div[action="counter-tables"]').find('div.counter-table-column-field.row').length > 0 &&
                  minifyText(counterTableName).length > 0)
                  throw 0

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

                return
              } catch (e) {}

              let keyspaceName = addDoubleQuotes(dialogElement.find('div[action="counter-tables"]').find('div.keyspace-name').text()),
                allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field, div.counter-table-option-field'),
                isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

              isAlterState = isAlterState != null && isAlterState == 'alter'

              try {
                if (!isAlterState)
                  throw 0

                let alteringStatements = [],
                  alteredOptions = [],
                  droppedColumns = []

                for (let dataField of allDataFields) {
                  if ($(dataField).hasClass('counter-table-partition-key-field'))
                    continue

                  try {
                    if (!$(dataField).hasClass('counter-table-clustering-key-field'))
                      throw 0

                    let clusteringKeyName = addDoubleQuotes($(dataField).find('input.clusteringKeyName').val()),
                      clusteringKeyTypeElement = $(dataField).find('input.clusteringKeyType'),
                      currentType = addDoubleQuotes(clusteringKeyTypeElement.val()),
                      originalType = addDoubleQuotes(clusteringKeyTypeElement.attr('data-original-type'))

                    if (currentType != originalType)
                      alteringStatements.push(`ALTER ${clusteringKeyName} TYPE ${currentType}`)

                    continue
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('counter-table-column-field'))
                      throw 0

                    let counterColumnNameElement = $(dataField).find('input.counterColumnName'),
                      counterColumnName = addDoubleQuotes(counterColumnNameElement.val()),
                      originalName = addDoubleQuotes(counterColumnNameElement.attr('data-original-name'))

                    if ($(dataField).hasClass('deleted')) {
                      alteringStatements.push(`DROP ${counterColumnName}`)

                      continue
                    }

                    if (originalName != undefined && counterColumnName != originalName)
                      alteringStatements.push(`RENAME ${counterColumnName} TO ${originalName}`)

                    if (originalName == undefined)
                      alteringStatements.push(`ADD ${counterColumnName} counter`)

                    continue
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('counter-table-option-field'))
                      throw 0

                    let tableOptionName = $(dataField).find('input.tableOptionName').val(),
                      tableOptionValue = $(dataField).find('input.tableOptionValue').val(),
                      [originalName, originalValue] = getAttributes($(dataField), ['data-original-name', 'data-original-value'])

                    if (tableOptionName != originalName || tableOptionValue != originalValue)
                      alteredOptions.push(`${alteredOptions.length <= 0 ? 'WITH' : 'AND'} ${tableOptionName} = ${tableOptionValue}`)
                  } catch (e) {}
                }

                try {
                  let commentTextarea = $('textarea#counterTableCommentOption')

                  if (`${commentTextarea.val()}` != commentTextarea.data('original-value'))
                    alteredOptions.push(`${alteredOptions.length <= 0 ? 'WITH' : 'AND'} comment = '${commentTextarea.val().replace(/(^|[^'])'(?!')/g, "$1''")}'`)
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', [...alteringStatements, ...alteredOptions, ...droppedColumns].length <= 0 ? '' : null), 50)

                let statement = [...alteringStatements, ...droppedColumns].map((statement) => `ALTER TABLE ${keyspaceName}.${counterTableName} ${statement}`).join(';' + OS.EOL) + ';'

                try {
                  if (alteredOptions.length <= 0)
                    throw 0

                  statement = alteringStatements.length <= 0 ? '' : `${statement}` + OS.EOL

                  statement += `ALTER TABLE ${keyspaceName}.${counterTableName} ` + alteredOptions.join(' ') + ';'
                } catch (e) {}

                try {
                  actionEditor.setValue(statement)
                } catch (e) {}

                return
              } catch (e) {}

              let partitionKeys = [],
                clusteringKeys = [],
                counterColumns = [],
                tableOptions = [],
                primaryKeys = '',
                order = {
                  asc: [],
                  desc: []
                }

              try {
                for (let dataField of allDataFields) {
                  try {
                    if (!$(dataField).hasClass('counter-table-partition-key-field'))
                      throw 0

                    let name = $(dataField).find('input.partitionKeyName').val(),
                      type = $(dataField).find('input.partitionKeyType').val(),
                      isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == type),
                      isCollectionMap = isTypeCollection && type == 'map'

                    try {
                      if (isTypeCollection)
                        throw 0

                      partitionKeys.push({
                        name,
                        type
                      })
                    } catch (e) {}

                    try {
                      if (!isTypeCollection)
                        throw 0

                      let tempJSON = {
                        value: $(dataField).find('input.collectionItemType').val()
                      }

                      if (isCollectionMap)
                        tempJSON.key = $(dataField).find('input.collectionKeyType').val()

                      partitionKeys.push({
                        name,
                        type,
                        ...tempJSON
                      })
                    } catch (e) {}

                    order[$(dataField).find('div.btn.field-sort-type').attr('data-current-sort') != 'asc' ? 'desc' : 'asc'].push(name)
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('counter-table-clustering-key-field'))
                      throw 0

                    let name = $(dataField).find('input.clusteringKeyName').val(),
                      type = $(dataField).find('input.clusteringKeyType').val(),
                      isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == type),
                      isCollectionMap = isTypeCollection && type == 'map'

                    try {
                      if (isTypeCollection)
                        throw 0

                      clusteringKeys.push({
                        name,
                        type
                      })
                    } catch (e) {}

                    try {
                      if (!isTypeCollection)
                        throw 0

                      let tempJSON = {
                        value: $(dataField).find('input.collectionItemType').val()
                      }

                      if (isCollectionMap)
                        tempJSON.key = $(dataField).find('input.collectionKeyType').val()

                      clusteringKeys.push({
                        name,
                        type,
                        ...tempJSON
                      })
                    } catch (e) {}

                    order[$(dataField).find('div.btn.field-sort-type').attr('data-current-sort') != 'asc' ? 'desc' : 'asc'].push(name)
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('counter-table-column-field'))
                      throw 0

                    counterColumns.push({
                      name: $(dataField).find('input.counterColumnName').val(),
                      type: 'counter'
                    })
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('counter-table-option-field'))
                      throw 0

                    let name = $(dataField).find('input.tableOptionName').val(),
                      value = $(dataField).find('input.tableOptionValue').val()

                    try {
                      if ($(dataField).attr('data-is-default') != 'true')
                        throw 0

                      let defaultName = $(dataField).attr('data-default-name'),
                        defaultValue = $(dataField).attr('data-default-value')

                      if (defaultName == name && defaultValue == value)
                        continue
                    } catch (e) {}

                    tableOptions.push({
                      name,
                      value
                    })
                  } catch (e) {}
                }
              } catch (e) {}

              // Add comment
              try {
                let comment = $('textarea#counterTableCommentOption').val()

                if (`${comment}`.length <= 0)
                  throw 0

                tableOptions.push({
                  name: 'comment',
                  value: (comment || '').replace(/(^|[^'])'(?!')/g, "$1''")
                })
              } catch (e) {}

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

              let manipulatedKeysAndColumns = ([...partitionKeys, ...clusteringKeys, ...counterColumns].map((key) => {
                let isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == key.type),
                  isCollectionMap = isTypeCollection && key.type == 'map',
                  keyspaceUDTs = [],
                  isTypeUDT = false


                try {
                  key.name = addDoubleQuotes(key.name)
                } catch (e) {}

                try {
                  key.type = addDoubleQuotes(key.type)
                } catch (e) {}

                try {
                  key.key = addDoubleQuotes(key.key)
                } catch (e) {}

                try {
                  key.value = addDoubleQuotes(key.value)
                } catch (e) {}

                try {
                  keyspaceUDTs = JSON.parse(JSONRepair($('div.modal#rightClickActionsMetadata').attr('data-keyspace-udts'))).map((udt) => udt.name)
                } catch (e) {}

                isTypeUDT = keyspaceUDTs.find((udt) => key.type == udt)

                try {
                  if (!isTypeUDT)
                    throw 0

                  key.type = `frozen<${key.type}>`
                } catch (e) {}

                try {
                  if (!isTypeCollection)
                    throw 0

                  let collectionType = isCollectionMap ? `${key.key}, ${key.value}` : `${key.value}`

                  key.type = `frozen<${key.type}<${collectionType}>>`
                } catch (e) {}

                return `    ${key.name} ${key.type},` + OS.EOL
              })).join('')

              try {
                primaryKeys = (partitionKeys.map((key) => key.name)).join(', ')

                if (partitionKeys.length > 1)
                  primaryKeys = `(${primaryKeys})`
              } catch (e) {}

              try {
                if (clusteringKeys.length <= 0)
                  throw 0

                primaryKeys += `, ` + (clusteringKeys.map((key) => key.name)).join(', ')
              } catch (e) {}

              let descOrder = [...order.asc, ...order.desc]

              try {
                if (tableOptions.length <= 0)
                  throw 0

                let tempTxt = descOrder.length > 0 ? OS.EOL + '    AND ' : ` WITH `

                tempTxt += (tableOptions.map((option) => {
                  option.value = option.value.startsWith('{') && option.value.endsWith('}') ? option.value : `'${option.value}'`

                  return `${option.name} = ${option.value}`
                })).join(OS.EOL + '    AND ')

                tableOptions = tempTxt
              } catch (e) {
                tableOptions = ''
              }

              try {
                if (descOrder.length <= 0 || clusteringKeys.length <= 0)
                  throw 0

                descOrder = ` WITH CLUSTERING ORDER BY (` + (clusteringKeys.map((key) => `${key.name} ${order.desc.includes(key.name) ? 'DESC' : 'ASC'}`)).join(', ') + `)`
              } catch (e) {
                descOrder = ''
              }

              let statement = `CREATE TABLE IF NOT EXISTS ${keyspaceName}.${counterTableName} (` + OS.EOL + `${manipulatedKeysAndColumns}` + `    PRIMARY KEY (${primaryKeys})` + OS.EOL + ')' + `${descOrder}` + `${tableOptions}` + ';'

              try {
                actionEditor.setValue(statement)
              } catch (e) {}
            })
          }
          setTimeout(() => {
            try {
              dialogElement.find('div.counter-table-columns-fields, div.counter-table-partition-keys-fields').sortable({
                handle: '.sort-handler',
                animation: 150,
                ghostClass: 'ghost-field',
                onSort: () => updateRowsZIndex()
              })
            } catch (e) {}
          }, 1000)

          $('input#countertableName').on('input', function() {
            let keyspaceTables = [],
              countertableName = $(this).val(),
              isNameDuplicated = false,
              isNameInvalid = false,
              invalidFeedback = $(this).parent().children('div.invalid-feedback'),
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            $(this).attr('disabled', isAlterState ? '' : null)
            $(this).parent().toggleClass('invalid-warning', isAlterState)
            $(this).removeClass('is-invalid ignore-invalid')

            try {
              if (!isAlterState)
                throw 0

              invalidFeedback.find('span').attr('mulang', 'the table name can\'t be altered').text(I18next.capitalizeFirstLetter(I18next.t('the table name can\'t be altered')))

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

              return
            } catch (e) {}

            try {
              keyspaceTables = JSON.parse(JSONRepair($('#rightClickActionsMetadata').attr('data-keyspace-tables')))
            } catch (e) {}

            try {
              if (keyspaceTables.length <= 0)
                throw 0

              isNameDuplicated = keyspaceTables.some((name) => minifyText(`${name}`) == minifyText(`${countertableName}`))

              if (isAlterState && isNameDuplicated && (countertableName == $('div.modal#rightClickActionsMetadata').attr('data-table-name')))
                isNameDuplicated = false

              if (isNameDuplicated)
                invalidFeedback.find('span').attr('mulang', 'provided name is already in use').text(I18next.capitalizeFirstLetter(I18next.t('provided name is already in use')))
            } catch (e) {}

            try {
              if (`${countertableName}`.length <= 0)
                throw 0

              isNameInvalid = `${countertableName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null

              if (isNameInvalid)
                invalidFeedback.find('span').attr('mulang', 'provided name is invalid, only alphanumeric and underscores are allowed').text(I18next.capitalizeFirstLetter(I18next.t('provided name is invalid, only alphanumeric and underscores are allowed')))
            } catch (e) {}

            $(this).toggleClass('is-invalid', isNameDuplicated || isNameInvalid)

            let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field, div.counter-table-option-field'),
              invalidInputFields = allDataFields.find('input.is-invalid')

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', $(this).hasClass('is-invalid') || `${keyspaceName}`.length <= 0 || allDataFields.length <= 0 || invalidInputFields.length > 0 ? '' : null), 50)

            try {
              updateActionStatusForCounterTables()
            } catch (e) {}
          })

          $(`a[action]#addCounterTablePartitionKey`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.counter-table-partition-keys-fields'),
              getPartitionKeyFieldElement = (keyspaceUDTs = []) => {
                let typesList = `
                <li><span class="group-text"><span mulang="numeric types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="int">int</a></li>
                <li><a class="dropdown-item" href="#" value="bigint">bigint</a></li>
                <li><a class="dropdown-item" href="#" value="smallint">smallint</a></li>
                <li><a class="dropdown-item" href="#" value="tinyint">tinyint</a></li>
                <li><a class="dropdown-item" href="#" value="varint">varint</a></li>
                <li><a class="dropdown-item" href="#" value="float">float</a></li>
                <li><a class="dropdown-item" href="#" value="double">double</a></li>
                <li><a class="dropdown-item" href="#" value="decimal">decimal</a></li>
                <li><span class="group-text"><span mulang="textual types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="text">text</a></li>
                <li><a class="dropdown-item" href="#" value="varchar">varchar</a></li>
                <li><a class="dropdown-item" href="#" value="ascii">ascii</a></li>
                <li><span class="group-text"><span mulang="boolean type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="boolean">boolean</a></li>
                <li><span class="group-text"><span mulang="date/time types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="timestamp">timestamp</a></li>
                <li><a class="dropdown-item" href="#" value="date">date</a></li>
                <li><a class="dropdown-item" href="#" value="duration">duration</a></li>
                <li><a class="dropdown-item" href="#" value="time">time</a></li>
                <li><span class="group-text"><span mulang="binary type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="blob">blob</a></li>
                <li><span class="group-text"><span mulang="UUID types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="uuid">uuid</a></li>
                <li><a class="dropdown-item" href="#" value="timeuuid">timeuuid</a></li>
                <li><span class="group-text"><span mulang="network type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="inet">inet</a></li>`,
                  collectionsTypesItems = `
              <li><span class="group-text"><span mulang="collection types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="list" data-is-collection>list&lt;type&gt;</a></li>
              <li><a class="dropdown-item" href="#" value="set" data-is-collection>set&lt;type&gt;</a></li>
              <li><a class="dropdown-item" style="overflow: hidden; text-overflow: ellipsis;" href="#" value="map" data-is-collection data-is-map>map&lt;key_type, value_type&gt;</a></li>`
                defaultType = 'text'

                try {
                  if (keyspaceUDTs.length <= 0)
                    throw 0

                  typesList += '<li><span class="group-text"><span mulang="user defined types" capitalize></span></span></li>'

                  for (let udt of keyspaceUDTs)
                    typesList += `<li><a class="dropdown-item" data-is-udt="true" href="#" value="${udt}">${udt}</a></li>`
                } catch (e) {}

                let [
                  collectionKeyTypeID,
                  collectionItemTypeID,
                  partitionKeyTypeID
                ] = getRandom.id(10, 3).map((id) => `_${id}`),
                  element = `
                  <div class="counter-table-partition-key-field row">
                    <div class="col-md-1" style="text-align: center;">
                      <div class="sort-handler" style="cursor:grab;">
                        <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-5" col="partitionKeyName">
                      <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                        <input type="text" class="form-control form-icon-trailing partitionKeyName is-invalid" style="margin-bottom: 0;">
                        <label class="form-label">
                          <span mulang="key name" capitalize></span>
                        </label>
                        <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-5" col="partitionKeyType">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing partitionKeyType" id="${partitionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${partitionKeyTypeID}" for-data-type="partitionKeyType" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                          ${collectionsTypesItems}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionKeyType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionKeyType" id="${collectionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionKeyTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionItemType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionItemType" id="${collectionItemTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="value type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionItemTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-1" style="text-align: center; display: none;">
                      <div class="btn ripple-surface-light field-sort-type badge rounded-pill" data-mdb-ripple-color="light" style="height: 26px; vertical-align: middle; width: fit-content; text-align: left; margin-left: 4px;" data-current-sort="asc">
                        <ion-icon name="sort-asc" style="font-size: 160%; margin-right: 1px;"></ion-icon> <span style="position: relative; top: 1px; text-transform: uppercase;">ASC</span>
                      </div>
                    </div>
                    <div class="col-md-1">
                      <a action="delete-counter-table-partition-key" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" style="transform: translateX(12px);">
                        <ion-icon name="trash"></ion-icon>
                      </a>
                    </div>
                  </div>`

                return element
              }

            dataFieldsContainer.children('div.empty-counter-table-partition-keys').hide()

            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              for (let field of fields) {
                dataFieldsContainer.append($(getPartitionKeyFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this)

                  $(this).attr('data-is-altered', 'true')

                  setTimeout(() => {
                    $(this).find('div.sort-handler').parent().hide()

                    $(this).find('a:not([value]), input').removeClass('is-invalid').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                    $(this).find(`a[action="delete-counter-table-partition-key"]`).parent().hide()

                    $(this).find('div[col="partitionKeyName"], div[col="partitionKeyType"]').removeClass('col-md-5').addClass('col-md-6')

                    $(this).find('ion-icon[name="arrow-down"]').hide()
                  })

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'partitionKeyType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined,
                            isAltered = row.attr('data-is-altered') != undefined

                          try {
                            if (!mainDropDown)
                              throw 0

                            let newColMD = isTypeCollection ? (isCollectionMap ? 3 : 4) : 5

                            if (isAltered)
                              newColMD += 1

                            row.find(`div[col="partitionKeyName"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="partitionKeyType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForCounterTables()
                          } catch (e) {}
                        })
                      })
                    }
                  })

                  setTimeout(() => {
                    $(this).find('input.partitionKeyName').val(`${field.name}`).trigger('input')

                    let fieldType = field.type

                    try {
                      fieldType = field.type.match(/frozen\<(.*?)(\<|\>)/)[1]
                    } catch (e) {}

                    try {
                      if (!(['map', 'set', 'list'].some((type) => type == fieldType)))
                        throw 0

                      let fieldKeyType = field.type.match(/frozen\<.*?\<(.*?)\>/)[1]

                      if (fieldType == 'map') {
                        let mapValues = minifyText(fieldKeyType).split(',')

                        $(this).find('input.collectionKeyType').val(`${mapValues[0]}`).trigger('input')
                        $(this).find('input.collectionItemType').val(`${mapValues[1]}`).trigger('input')
                      } else {
                        $(this).find('input.collectionKeyType').val(`${fieldKeyType}`).trigger('input')
                      }
                    } catch (e) {}

                    $(this).find('div.dropdown[for-data-type="partitionKeyType"]').find(`a[value="${fieldType}"]`).trigger('click')
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  $(`a[action]#addCounterTableClusteringKey`).addClass('disabled')

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getPartitionKeyFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              setTimeout(() => {
                $(this).find(`a[action="delete-counter-table-partition-key"]`).click(function() {
                  $(this).parent().parent().remove()

                  try {
                    updateActionStatusForCounterTables()
                  } catch (e) {}

                  if (dataFieldsContainer.children('div.counter-table-partition-key-field.row').length != 0)
                    return

                  $(`a[action]#addCounterTableClusteringKey`).addClass('disabled')

                  dataFieldsContainer.children('div.empty-counter-table-partition-keys').fadeIn(250)
                })

                $(this).find(`div.btn.field-sort-type`).click(function() {
                  let currentSort = $(this).attr('data-current-sort'),
                    newSort = (currentSort == 'asc' ? 'desc' : 'asc')

                  $(this).attr('data-current-sort', newSort)

                  $(this).find('ion-icon').attr('name', `sort-${newSort}`)
                  $(this).find('span').text(`${newSort}`)

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })
                })

                let errorWarningIcon = $(this).find('ion-icon.error-warning')

                $(this).find('input.partitionKeyName').on('input', function(_, triggerInput = true) {
                  let partitionKeyName = $(this).val(),
                    fieldRow = $(this).parent().parent().parent(),
                    isNameDuplicated = false,
                    isNameInvalid = false,
                    isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                  isAlterState = isAlterState != null && isAlterState == 'alter'

                  try {
                    if (`${partitionKeyName}`.length <= 0)
                      throw 0

                    isNameInvalid = `${partitionKeyName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                  } catch (e) {}

                  try {
                    let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field').not(fieldRow[0])

                    for (let dataField of allDataFields) {
                      let dataPartitionKeyNameElement = $(dataField).find('input.partitionKeyName, input.clusteringKeyName, input.counterColumnName')

                      if (triggerInput)
                        dataPartitionKeyNameElement.trigger('input', false)

                      if (minifyText(`${dataPartitionKeyNameElement.val()}`) != minifyText(partitionKeyName))
                        continue

                      isNameDuplicated = true
                      break
                    }
                  } catch (e) {}

                  let isError = isNameDuplicated || isNameInvalid || minifyText(partitionKeyName).length <= 0

                  $(this).toggleClass('is-invalid', isError)

                  errorWarningIcon.toggleClass('show', isError && minifyText(partitionKeyName).length > 0)

                  try {
                    if (!isError)
                      throw 0

                    let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                    tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                    tooltip.enable()
                  } catch (e) {}

                  try {
                    clearTimeout(changeFooterButtonsStateTimeout)
                  } catch (e) {}

                  changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                  try {
                    updateActionStatusForCounterTables()
                  } catch (e) {}
                })
              })

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'partitionKeyType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="partitionKeyName"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="partitionKeyType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForCounterTables()
                      } catch (e) {}
                    })
                  })
                }
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              if (fields == null)
                $(`a[action]#addCounterTableClusteringKey`).removeClass('disabled')

              setTimeout(() => {
                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addCounterTableClusteringKey`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.counter-table-clustering-keys-fields'),
              getClusteringKeyFieldElement = (keyspaceUDTs = []) => {
                let typesList = `
                <li><span class="group-text"><span mulang="numeric types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="int">int</a></li>
                <li><a class="dropdown-item" href="#" value="bigint">bigint</a></li>
                <li><a class="dropdown-item" href="#" value="smallint">smallint</a></li>
                <li><a class="dropdown-item" href="#" value="tinyint">tinyint</a></li>
                <li><a class="dropdown-item" href="#" value="varint">varint</a></li>
                <li><a class="dropdown-item" href="#" value="float">float</a></li>
                <li><a class="dropdown-item" href="#" value="double">double</a></li>
                <li><a class="dropdown-item" href="#" value="decimal">decimal</a></li>
                <li><span class="group-text"><span mulang="textual types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="text">text</a></li>
                <li><a class="dropdown-item" href="#" value="varchar">varchar</a></li>
                <li><a class="dropdown-item" href="#" value="ascii">ascii</a></li>
                <li><span class="group-text"><span mulang="boolean type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="boolean">boolean</a></li>
                <li><span class="group-text"><span mulang="date/time types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="timestamp">timestamp</a></li>
                <li><a class="dropdown-item" href="#" value="date">date</a></li>
                <li><a class="dropdown-item" href="#" value="duration">duration</a></li>
                <li><a class="dropdown-item" href="#" value="time">time</a></li>
                <li><span class="group-text"><span mulang="binary type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="blob">blob</a></li>
                <li><span class="group-text"><span mulang="UUID types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="uuid">uuid</a></li>
                <li><a class="dropdown-item" href="#" value="timeuuid">timeuuid</a></li>
                <li><span class="group-text"><span mulang="network type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="inet">inet</a></li>`,
                  collectionsTypesItems = `
            <li><span class="group-text"><span mulang="collection types" capitalize></span></span></li>
            <li><a class="dropdown-item" href="#" value="list" data-is-collection>list&lt;type&gt;</a></li>
            <li><a class="dropdown-item" href="#" value="set" data-is-collection>set&lt;type&gt;</a></li>
            <li><a class="dropdown-item" style="overflow: hidden; text-overflow: ellipsis;" href="#" value="map" data-is-collection data-is-map>map&lt;key_type, value_type&gt;</a></li>`
                defaultType = 'text'

                try {
                  if (keyspaceUDTs.length <= 0)
                    throw 0

                  typesList += '<li><span class="group-text"><span mulang="user defined types" capitalize></span></span></li>'

                  for (let udt of keyspaceUDTs)
                    typesList += `<li><a class="dropdown-item" data-is-udt="true" href="#" value="${udt}">${udt}</a></li>`
                } catch (e) {}

                let [
                  collectionKeyTypeID,
                  collectionItemTypeID,
                  clusteringKeyTypeID
                ] = getRandom.id(10, 3).map((id) => `_${id}`),
                  element = `
                  <div class="counter-table-clustering-key-field row">
                    <div class="col-md-1" style="text-align: center;">
                      <div class="sort-handler" style="cursor:grab;">
                        <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-5" col="clusteringKeyName">
                      <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                        <input type="text" class="form-control form-icon-trailing clusteringKeyName is-invalid" style="margin-bottom: 0;">
                        <label class="form-label">
                          <span mulang="key name" capitalize></span>
                        </label>
                        <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-4" col="clusteringKeyType">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing clusteringKeyType" id="${clusteringKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${clusteringKeyTypeID}" for-data-type="clusteringKeyType" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                          ${collectionsTypesItems}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionKeyType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionKeyType" id="${collectionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionKeyTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionItemType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionItemType" id="${collectionItemTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="value type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionItemTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-1" style="text-align: center;">
                    <div class="btn ripple-surface-light field-sort-type badge rounded-pill" data-mdb-ripple-color="light" style="height: 26px; vertical-align: middle; width: fit-content; text-align: left; margin-left: 4px;" data-current-sort="asc">
                    <ion-icon name="sort-asc" style="font-size: 160%; margin-right: 1px;"></ion-icon> <span style="position: relative; top: 1px; text-transform: uppercase;">ASC</span>
                      </div>
                    </div>
                    <div class="col-md-1">
                      <a action="delete-counter-table-clustering-key" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" style="transform: translateX(12px);">
                        <ion-icon name="trash"></ion-icon>
                      </a>
                    </div>
                  </div>`

                return element
              }

            dataFieldsContainer.children('div.empty-counter-table-clustering-keys').hide()

            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              if (fields.length <= 0) {
                dataFieldsContainer.children('div.empty-counter-table-clustering-keys').show()
                dataFieldsContainer.children('div.empty-counter-table-clustering-keys').find('span[mulang]').hide()
                dataFieldsContainer.children('div.empty-counter-table-clustering-keys').find('span.no-keys').show()
              }

              for (let field of fields) {
                dataFieldsContainer.append($(getClusteringKeyFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this),
                    fieldType = field.type

                  setTimeout(() => {
                    $(this).find('div.sort-handler').parent().hide()

                    $(this).find('div.field-sort-type').parent().hide()

                    $(this).find('span.group-text').remove()

                    $(this).find(`a:not([value]), input`).removeClass('is-invalid').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                    $(this).find(`a[action="delete-counter-table-clustering-key"]`).parent().hide()

                    $(this).find('div[col="clusteringKeyName"], div[col="clusteringKeyType"]').removeClass('col-md-5').addClass('col-md-6')

                    $(this).find(`input`).parent().children('ion-icon[name="arrow-down"]').hide()
                  })

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      row.find('div.dropdown[for-select]').each(function() {
                        let dropDownElement = $(this),
                          // Get the MDB object of the current dropdown element
                          selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                          // Point at the associated input field
                          input = row.find(`input#${dropDownElement.attr('for-select')}`)

                        // Once the associated select element is being focused then show the dropdown element and vice versa
                        input.on('focus', () => {
                          if (input.hasClass('disabled'))
                            return

                          try {
                            input.parent().find('div.invalid-feedback').addClass('transparent-color')
                          } catch (e) {}

                          selectDropdown.show()
                        }).on('focusout', () => setTimeout(() => {
                          try {
                            input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                          } catch (e) {}

                          selectDropdown.hide()
                        }, 100))

                        // Once the parent `form-outline` is clicked trigger the `focus` event
                        input.parent().click(() => input.trigger('focus'))
                      })

                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'clusteringKeyType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined,
                            isAltered = row.attr('data-is-altered') != undefined

                          try {
                            if (!mainDropDown)
                              throw 0

                            let newColMD = isTypeCollection ? (isCollectionMap ? 4 : 5) : 6

                            row.find(`div[col="clusteringKeyName"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="clusteringKeyType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForCounterTables()
                          } catch (e) {}
                        })
                      })
                    }
                  })

                  setTimeout(() => {
                    $(this).find('input.clusteringKeyName').val(`${field.name}`).trigger('input')

                    try {
                      fieldType = field.type.match(/frozen\<(.*?)(\<|\>)/)[1]
                    } catch (e) {}

                    try {
                      if (!(['map', 'set', 'list'].some((type) => type == fieldType)))
                        throw 0

                      let fieldKeyType = field.type.match(/frozen\<.*?\<(.*?)\>/)[1]

                      if (fieldType == 'map') {
                        let mapValues = minifyText(fieldKeyType).split(',')

                        $(this).find('input.collectionKeyType').val(`${mapValues[0]}`).trigger('input')
                        $(this).find('input.collectionItemType').val(`${mapValues[1]}`).trigger('input')
                      } else {
                        $(this).find('input.collectionKeyType').val(`${fieldKeyType}`).trigger('input')
                      }
                    } catch (e) {}

                    $(this).find('div.dropdown[for-data-type="clusteringKeyType"]').find(`a[value="${fieldType}"]`).trigger('click')
                    $(this).find('input.clusteringKeyType').attr('data-original-type', `${fieldType}`)
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getClusteringKeyFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              setTimeout(() => {
                $(this).find(`a[action="delete-counter-table-clustering-key"]`).click(function() {
                  $(this).parent().parent().remove()

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  if (dataFieldsContainer.children('div.counter-table-clustering-key-field.row').length != 0)
                    return

                  dataFieldsContainer.children('div.empty-counter-table-clustering-keys').fadeIn(250)

                  dataFieldsContainer.children('div.empty-counter-table-clustering-keys').find('span[mulang]').hide()
                  dataFieldsContainer.children('div.empty-counter-table-clustering-keys').find('span:not(.no-keys)').show()
                })

                $(this).find(`div.btn.field-sort-type`).click(function() {
                  let currentSort = $(this).attr('data-current-sort'),
                    newSort = (currentSort == 'asc' ? 'desc' : 'asc')

                  $(this).attr('data-current-sort', newSort)

                  $(this).find('ion-icon').attr('name', `sort-${newSort}`)
                  $(this).find('span').text(`${newSort}`)
                })

                let errorWarningIcon = $(this).find('ion-icon.error-warning')

                $(this).find('input.clusteringKeyName').on('input', function(_, triggerInput = true) {
                  let clusteringKeyName = $(this).val(),
                    fieldRow = $(this).parent().parent().parent(),
                    isNameDuplicated = false,
                    isNameInvalid = false,
                    isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                  isAlterState = isAlterState != null && isAlterState == 'alter'

                  try {
                    if (`${clusteringKeyName}`.length <= 0)
                      throw 0

                    isNameInvalid = `${clusteringKeyName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                  } catch (e) {}

                  try {
                    let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field').not(fieldRow[0])

                    for (let dataField of allDataFields) {
                      let dataClusteringKeyNameElement = $(dataField).find('input.partitionKeyName, input.clusteringKeyName, input.counterColumnName')

                      if (triggerInput)
                        dataClusteringKeyNameElement.trigger('input', false)

                      if (minifyText(`${dataClusteringKeyNameElement.val()}`) != minifyText(clusteringKeyName))
                        continue

                      isNameDuplicated = true
                      break
                    }
                  } catch (e) {}

                  let isError = isNameDuplicated || isNameInvalid || minifyText(clusteringKeyName).length <= 0

                  $(this).toggleClass('is-invalid', isError)

                  errorWarningIcon.toggleClass('show', isError && minifyText(clusteringKeyName).length > 0)

                  try {
                    if (!isError)
                      throw 0

                    let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                    tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                    tooltip.enable()
                  } catch (e) {}

                  try {
                    clearTimeout(changeFooterButtonsStateTimeout)
                  } catch (e) {}

                  changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                  try {
                    updateActionStatusForCounterTables()
                  } catch (e) {}
                })
              })

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'clusteringKeyType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="clusteringKeyName"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="clusteringKeyType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 4}`)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForCounterTables()
                      } catch (e) {}
                    })
                  })
                }
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addCounterTableColumn`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.counter-table-columns-fields'),
              getCounterColumnFieldElement = () => {
                return `
                <div class="counter-table-column-field row">
                  <div class="col-md-1" style="text-align: center; display:none;">
                    <div class="sort-handler" style="cursor:grab;">
                      <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                    </div>
                  </div>
                  <div class="col-md-11">
                    <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                      <input type="text" class="form-control form-icon-trailing counterColumnName is-invalid" style="margin-bottom: 0;">
                      <label class="form-label">
                        <span mulang="counter column name" capitalize></span>
                      </label>
                      <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                    </div>
                  </div>
                  <div class="col-md-1">
                    <a action="delete-counter-table-column" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                      <ion-icon name="trash"></ion-icon>
                    </a>
                  </div>
                </div>`
              }

            dataFieldsContainer.children('div.empty-counter-table-columns').hide()

            let isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              if (fields.length <= 0)
                dataFieldsContainer.children('div.empty-counter-table-columns').show()

              for (let field of fields) {
                dataFieldsContainer.append($(getCounterColumnFieldElement()).show(function() {
                  let row = $(this)

                  setTimeout(() => {
                    $(this).find('input.counterColumnName').val(`${field}`).removeClass('is-invalid').attr('data-original-name', `${field}`).trigger('input')
                  })

                  setTimeout(() => $(this).find(`a[action="delete-counter-table-column"]`).click(() => {
                    row.toggleClass('deleted')

                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  }))

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getCounterColumnFieldElement()).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              $(this).find(`a[action="delete-counter-table-column"]`).click(function() {
                $(this).parent().parent().remove()

                setTimeout(() => {
                  try {
                    updateActionStatusForCounterTables()
                  } catch (e) {}
                })

                if (dataFieldsContainer.children('div.counter-table-column-field.row').length != 0)
                  return

                dataFieldsContainer.children('div.empty-counter-table-columns').fadeIn(250)
              })

              let errorWarningIcon = $(this).find('ion-icon.error-warning')

              $(this).find('input.counterColumnName').on('input', function(_, triggerInput = true) {
                let counterColumnName = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isNameDuplicated = false,
                  isNameInvalid = false,
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                try {
                  if (`${counterColumnName}`.length <= 0)
                    throw 0

                  isNameInvalid = `${counterColumnName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                } catch (e) {}

                try {
                  let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-partition-key-field, div.counter-table-clustering-key-field, div.counter-table-column-field').not(fieldRow[0])

                  for (let dataField of allDataFields) {
                    let dataCounterColumnNameElement = $(dataField).find('input.partitionKeyName, input.clusteringKeyName, input.counterColumnName')

                    if (triggerInput)
                      dataCounterColumnNameElement.trigger('input', false)

                    if (minifyText(`${dataCounterColumnNameElement.val()}`) != minifyText(counterColumnName))
                      continue

                    isNameDuplicated = true
                    break
                  }
                } catch (e) {}

                let isError = isNameDuplicated || isNameInvalid || minifyText(counterColumnName).length <= 0

                $(this).toggleClass('is-invalid', isError)

                errorWarningIcon.toggleClass('show', isError && minifyText(counterColumnName).length > 0)

                try {
                  if (!isError)
                    throw 0

                  let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                  tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                  tooltip.enable()
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addCounterTableOption`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.counter-table-options-fields'),
              getTableOptionFieldElement = (defaultOption = false) => {
                return `
                <div class="counter-table-option-field row" style="padding-right: 10px;">
                  <div class="col-md-5">
                    <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                      <input type="text" class="form-control form-icon-trailing tableOptionName is-invalid" style="margin-bottom: 0;">
                      <label class="form-label">
                        <span mulang="option name" capitalize></span>
                      </label>
                      <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                      <input type="text" class="form-control form-icon-trailing tableOptionValue is-invalid" style="margin-bottom: 0;">
                      <label class="form-label">
                        <span mulang="option value" capitalize></span>
                      </label>
                    </div>
                  </div>
                  <div class="col-md-1" ${defaultOption ? 'hidden' : ''}>
                    <a action="delete-counter-table-option" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                      <ion-icon name="trash"></ion-icon>
                    </a>
                  </div>
                  <div class="col-md-1" ${!defaultOption ? 'hidden' : ''}>
                    <a action="undo-change" class="btn btn-link btn-rounded btn-sm disabled" data-mdb-ripple-color="light" href="#" role="button">
                      <ion-icon name="undo"></ion-icon>
                    </a>
                  </div>
                </div>`
              }

            dataFieldsContainer.children('div.empty-counter-table-options').hide()

            try {
              if (fields == null)
                throw 0

              try {
                fields = JSON.parse(repairJSONString(fields))
              } catch (e) {
                fields = []
              }

              let areDefaultOptions = fields.default === true || fields.find((option) => option.default) != undefined

              if (!areDefaultOptions)
                throw 0

              for (let field of fields) {
                if (field.name == undefined)
                  continue

                try {
                  if (field.name != 'comment')
                    throw 0

                  $('textarea#counterTableCommentOption').data('original-value', `${field.value}`)

                  $('textarea#counterTableCommentOption').val(`${field.value}`).trigger('input')

                  continue
                } catch (e) {}

                dataFieldsContainer.append($(getTableOptionFieldElement(true)).show(function() {
                  let row = $(this)

                  row.attr({
                    'data-is-default': 'true',
                    'data-default-name': `${field.name}`,
                    'data-default-value': `${field.value.replace(/"/g, "'")}`
                  })

                  row.find('input.tableOptionName').removeClass('is-invalid').val(field.name).trigger('input')
                  row.find('input.tableOptionValue').removeClass('is-invalid').val(field.value.replace(/"/g, "'")).trigger('input')

                  row.find(`a[action="undo-change"]`).click(function() {
                    row.find('input.tableOptionName').val(row.attr('data-default-name')).trigger('input')
                    row.find('input.tableOptionValue').val(row.attr('data-default-value')).trigger('input')

                    setTimeout(() => {
                      try {
                        updateActionStatusForCounterTables()
                      } catch (e) {}
                    })
                  })

                  let errorWarningIcon = $(this).find('ion-icon.error-warning')

                  $(this).find('input.tableOptionName').on('input', function(_, triggerInput = true) {
                    let tableOptionName = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isNameDuplicated = false,
                      isNameInvalid = false,
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    try {
                      if (`${tableOptionName}`.length <= 0)
                        throw 0

                      isNameInvalid = `${tableOptionName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                    } catch (e) {}

                    try {
                      let defaultName = row.attr('data-default-name'),
                        defaultValue = row.attr('data-default-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-option-field').not(fieldRow[0])

                      for (let dataField of allDataFields) {
                        let tableOptionNameElement = $(dataField).find('input.tableOptionName')

                        if (triggerInput)
                          tableOptionNameElement.trigger('input', false)

                        if (minifyText(`${tableOptionNameElement.val()}`) != minifyText(tableOptionName))
                          continue

                        isNameDuplicated = true
                        break
                      }
                    } catch (e) {}

                    let isError = isNameDuplicated || isNameInvalid || minifyText(tableOptionName).length <= 0

                    $(this).toggleClass('is-invalid', isError)

                    errorWarningIcon.toggleClass('show', isError && minifyText(tableOptionName).length > 0)

                    try {
                      if (!isError)
                        throw 0

                      let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                      tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                      tooltip.enable()
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  $(this).find('input.tableOptionValue').on('input', function(_, triggerInput = true) {
                    let tableOptionValue = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    $(this).toggleClass('is-invalid', minifyText(tableOptionValue).length <= 0)

                    try {
                      let defaultName = row.attr('data-default-name'),
                        defaultValue = row.attr('data-default-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', minifyText(tableOptionValue).length <= 0 ? '' : null), 50)

                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    try {
                      dataFieldsContainer.animate({
                        scrollTop: dataFieldsContainer.get(0).scrollHeight
                      }, 10)
                    } catch (e) {}
                  })
                }))
              }

              if (areDefaultOptions)
                return
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              let options = []

              try {
                options = fields
              } catch (e) {}

              let optionsNames = Object.keys(options)

              for (let optionName of optionsNames) {
                let optionValue = options[optionName]

                try {
                  if (optionName != 'comment')
                    throw 0

                  $('textarea#counterTableCommentOption').data('original-value', `${optionValue}`)

                  $('textarea#counterTableCommentOption').val(`${optionValue}`).trigger('input')

                  continue
                } catch (e) {}

                try {
                  if (typeof optionValue == 'object')
                    optionValue = JSON.stringify(optionValue)
                } catch (e) {}

                optionValue = `${optionValue}`

                dataFieldsContainer.append($(getTableOptionFieldElement(true)).show(function() {
                  let row = $(this)

                  row.attr({
                    'data-original-name': `${optionName}`,
                    'data-original-value': `${optionValue.replace(/"/g, "'")}`
                  })

                  row.find('input.tableOptionName').removeClass('is-invalid').val(optionName).trigger('input')
                  row.find('input.tableOptionValue').removeClass('is-invalid').val(optionValue.replace(/"/g, "'")).trigger('input')

                  row.find(`a[action="undo-change"]`).click(function() {
                    row.find('input.tableOptionName').val(row.attr('data-original-name')).trigger('input')
                    row.find('input.tableOptionValue').val(row.attr('data-original-value')).trigger('input')

                    setTimeout(() => {
                      try {
                        updateActionStatusForCounterTables()
                      } catch (e) {}
                    })
                  })

                  let errorWarningIcon = $(this).find('ion-icon.error-warning')

                  $(this).find('input.tableOptionName').on('input', function(_, triggerInput = true) {
                    let tableOptionName = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isNameDuplicated = false,
                      isNameInvalid = false,
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    try {
                      if (`${tableOptionName}`.length <= 0)
                        throw 0

                      isNameInvalid = `${tableOptionName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                    } catch (e) {}

                    try {
                      let defaultName = row.attr('data-original-name'),
                        defaultValue = row.attr('data-original-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-option-field').not(fieldRow[0])

                      for (let dataField of allDataFields) {
                        let tableOptionNameElement = $(dataField).find('input.tableOptionName')

                        if (triggerInput)
                          tableOptionNameElement.trigger('input', false)

                        if (minifyText(`${tableOptionNameElement.val()}`) != minifyText(tableOptionName))
                          continue

                        isNameDuplicated = true
                        break
                      }
                    } catch (e) {}

                    let isError = isNameDuplicated || isNameInvalid || minifyText(tableOptionName).length <= 0

                    $(this).toggleClass('is-invalid', isError)

                    errorWarningIcon.toggleClass('show', isError && minifyText(tableOptionName).length > 0)

                    try {
                      if (!isError)
                        throw 0

                      let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                      tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                      tooltip.enable()
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  $(this).find('input.tableOptionValue').on('input', function(_, triggerInput = true) {
                    let tableOptionValue = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    $(this).toggleClass('is-invalid', minifyText(tableOptionValue).length <= 0)

                    try {
                      let defaultName = row.attr('data-original-name'),
                        defaultValue = row.attr('data-original-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', minifyText(tableOptionValue).length <= 0 ? '' : null), 50)

                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForCounterTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    try {
                      dataFieldsContainer.animate({
                        scrollTop: dataFieldsContainer.get(0).scrollHeight
                      }, 10)
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getTableOptionFieldElement()).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              $(this).find(`a[action="delete-counter-table-option"]`).click(function() {
                $(this).parent().parent().remove()

                setTimeout(() => {
                  try {
                    updateActionStatusForCounterTables()
                  } catch (e) {}
                })

                if (dataFieldsContainer.children('div.counter-table-option-field.row').length != 0)
                  return

                dataFieldsContainer.children('div.empty-counter-table-options').fadeIn(250)
              })

              let errorWarningIcon = $(this).find('ion-icon.error-warning')

              $(this).find('input.tableOptionName').on('input', function(_, triggerInput = true) {
                let tableOptionName = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isNameDuplicated = false,
                  isNameInvalid = false,
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                try {
                  if (`${tableOptionName}`.length <= 0)
                    throw 0

                  isNameInvalid = `${tableOptionName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                } catch (e) {}

                try {
                  let allDataFields = dialogElement.find('div[action="counter-tables"]').find('div.counter-table-option-field').not(fieldRow[0])

                  for (let dataField of allDataFields) {
                    let tableOptionNameElement = $(dataField).find('input.tableOptionName')

                    if (triggerInput)
                      tableOptionNameElement.trigger('input', false)

                    if (minifyText(`${tableOptionNameElement.val()}`) != minifyText(tableOptionName))
                      continue

                    isNameDuplicated = true
                    break
                  }
                } catch (e) {}

                let isError = isNameDuplicated || isNameInvalid || minifyText(tableOptionName).length <= 0

                $(this).toggleClass('is-invalid', isError)

                errorWarningIcon.toggleClass('show', isError && minifyText(tableOptionName).length > 0)

                try {
                  if (!isError)
                    throw 0

                  let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                  tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                  tooltip.enable()
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })

              $(this).find('input.tableOptionValue').on('input', function(_, triggerInput = true) {
                let tableOptionValue = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                $(this).toggleClass('is-invalid', minifyText(tableOptionValue).length <= 0)

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', minifyText(tableOptionValue).length <= 0 ? '' : null), 50)

                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForCounterTables()
                } catch (e) {}
              })

              setTimeout(() => {
                try {
                  dataFieldsContainer.animate({
                    scrollTop: dataFieldsContainer.get(0).scrollHeight
                  }, 10)
                } catch (e) {}
              })
            }))
          })

          {
            let showCounterTableOptionsContainerBtn = $('#rightClickActionsMetadata').find('div.show-counter-table-options-container'),
              hideCounterTableOptionsContainerBtn = $('#rightClickActionsMetadata').find('div.counter-table-options-sub-container a'),
              tableOptionsContainer = $('#rightClickActionsMetadata').find('div.counter-table-options-container'),
              tableOptionsContainerResizingObserver,
              isShowBtnShown = false

            showCounterTableOptionsContainerBtn.click(function() {
              $(this).hide()

              try {
                tableOptionsContainerResizingObserver.disconnect()
              } catch (e) {}

              isShowBtnShown = false

              tableOptionsContainer.slideDown(300)

              hideCounterTableOptionsContainerBtn.addClass('show')
            })

            hideCounterTableOptionsContainerBtn.click(function() {
              tableOptionsContainer.slideUp(300)

              $(this).removeClass('show')

              try {
                tableOptionsContainerResizingObserver.disconnect()
              } catch (e) {}

              tableOptionsContainerResizingObserver = new ResizeObserver(() => {
                try {
                  if (tableOptionsContainer.height() > 35 || isShowBtnShown)
                    throw 0

                  showCounterTableOptionsContainerBtn.show()

                  tableOptionsContainer.hide()

                  isShowBtnShown = true

                  try {
                    tableOptionsContainerResizingObserver.disconnect()
                  } catch (e) {}
                } catch (e) {}
              })

              try {
                tableOptionsContainerResizingObserver.observe(tableOptionsContainer[0])
              } catch (e) {}
            })
          }
        }

        let updateActionStatusForStandardTables

        {
          let updateRowsZIndex = (isTransformNegative = false) => {
            setTimeout(() => {
              let rows = dialogElement.find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field, div.standard-table-udt-column-field, div.standard-table-option-field').get(),
                rowsCount = rows.length

              if (isTransformNegative)
                rows = rows.reverse()

              for (let row of rows) {
                $(row).css('z-index', `${rowsCount}`)

                rowsCount -= 1
              }
            })
          }

          updateActionStatusForStandardTables = () => {
            try {
              clearTimeout(mainFunctionTimeOut)
            } catch (e) {}

            mainFunctionTimeOut = setTimeout(() => {
              let keyspaceName = addDoubleQuotes(dialogElement.find('div[action="standard-tables"]').find('div.keyspace-name').text()),
                allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field, div.standard-table-udt-column-field, div.standard-table-option-field'),
                isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

              isAlterState = isAlterState != null && isAlterState == 'alter'

              let keyspaceUDTs = []

              try {
                keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts'))).map((udt) => udt.name)
              } catch (e) {}

              let standardTableName = addDoubleQuotes($('input#standardtableName').val())

              // For enabling the `static` option for columns
              try {
                let isClusteringKeyFieldFound = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-clustering-key-field').length > 0,
                  columnsFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-column-field, div.standard-table-udt-column-field')

                for (let columnField of columnsFields) {
                  columnField = $(columnField)

                  let isStaticCheckboxFormTooltip = getElementMDBObject(columnField.find('div.form-check.forIsStaticCheckbox'), 'Tooltip'),
                    isStaticCheckbox = columnField.find('input.isStatic:not(.altered)')

                  try {
                    isStaticCheckboxFormTooltip[isClusteringKeyFieldFound ? 'disable' : 'enable']()
                  } catch (e) {}

                  try {
                    isStaticCheckbox.attr('disabled', isClusteringKeyFieldFound ? null : '')
                  } catch (e) {}
                }
              } catch (e) {}

              try {
                // if (dialogElement.find('div[action="standard-tables"]').find('.is-invalid:not(.ignore-invalid)').length <= 0 &&
                //   dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field.row').length > 0 &&
                //   dialogElement.find('div[action="standard-tables"]').find('div.standard-table-column-field.row, div.standard-table-udt-column-field.row').length > 0 &&
                //   minifyText(standardTableName).length > 0)
                if (dialogElement.find('div[action="standard-tables"]').find('.is-invalid:not(.ignore-invalid)').length <= 0 &&
                  dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field.row').length > 0 &&
                  minifyText(standardTableName).length > 0)
                  throw 0

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

                return
              } catch (e) {}

              try {
                if (!isAlterState)
                  throw 0

                let alteredOptions = [],
                  addedColumns = [],
                  droppedColumns = []

                for (let dataField of allDataFields) {
                  if (['partition', 'clustering'].some((fieldClass) => $(dataField).hasClass(`standard-table-${fieldClass}-key-field`)))
                    continue

                  try {
                    if (!(['column', 'udt-column'].some((fieldClass) => $(dataField).hasClass(`standard-table-${fieldClass}-field`))))
                      throw 0

                    let name = $(dataField).find('input.columnName').val()

                    if ($(dataField).hasClass('deleted')) {
                      droppedColumns.push(name)
                      continue
                    }

                    if ($(dataField).find('input.columnName').hasClass('disabled'))
                      continue

                    let type = $(dataField).find('input.columnType').val(),
                      isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == type),
                      isCollectionMap = isTypeCollection && type == 'map',
                      isTypeUDT = keyspaceUDTs.find((udtName) => udtName == type) != undefined,
                      isStatic = $(dataField).find('input.isStatic').prop('checked') && $(dataField).find('input.isStatic').attr('disabled') == undefined,
                      isFrozen = $(dataField).find('input.isFrozen').prop('checked') && (isTypeCollection || isTypeUDT)

                    try {
                      if (isTypeCollection || isTypeUDT)
                        throw 0

                      addedColumns.push({
                        name,
                        type,
                        isStatic
                      })
                    } catch (e) {}

                    try {
                      if (!isTypeCollection && !isTypeUDT)
                        throw 0

                      let tempJSON = {
                        value: $(dataField).find('input.collectionItemType').val()
                      }

                      if (isCollectionMap)
                        tempJSON.key = $(dataField).find('input.collectionKeyType').val()

                      let columnStructure = {
                        name,
                        type,
                        isStatic,
                        isFrozen
                      }

                      if (isTypeCollection)
                        columnStructure = {
                          ...columnStructure,
                          ...tempJSON
                        }

                      addedColumns.push(columnStructure)
                    } catch (e) {}
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('standard-table-option-field'))
                      throw 0

                    let tableOptionName = $(dataField).find('input.tableOptionName').val(),
                      tableOptionValue = $(dataField).find('input.tableOptionValue').val(),
                      [originalName, originalValue] = getAttributes($(dataField), ['data-original-name', 'data-original-value'])

                    if (tableOptionName != originalName || tableOptionValue != originalValue)
                      alteredOptions.push(`${alteredOptions.length <= 0 ? 'WITH' : 'AND'} ${tableOptionName} = ${tableOptionValue}`)
                  } catch (e) {}
                }

                try {
                  let commentTextarea = $('textarea#standardTableCommentOption')

                  if (`${commentTextarea.val()}` != commentTextarea.data('original-value'))
                    alteredOptions.push(`${alteredOptions.length <= 0 ? 'WITH' : 'AND'} comment = '${commentTextarea.val().replace(/(^|[^'])'(?!')/g, "$1''")}'`)
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', [...droppedColumns, ...addedColumns, ...alteredOptions].length <= 0 ? '' : null), 50)

                try {
                  droppedColumns = droppedColumns.map((column) => `DROP ${addDoubleQuotes(column)}`)
                } catch (e) {}

                try {
                  addedColumns = addedColumns.map((column) => {
                    let isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == column.type),
                      isCollectionMap = isTypeCollection && column.type == 'map',
                      keyspaceUDTs = []
                    isTypeUDT = false

                    try {
                      keyspaceUDTs = JSON.parse(JSONRepair($('div.modal#rightClickActionsMetadata').attr('data-keyspace-udts'))).map((udt) => udt.name)

                      isTypeUDT = keyspaceUDTs.find((udt) => column.type == udt)
                    } catch (e) {}

                    try {
                      column.type = addDoubleQuotes(column.type)
                    } catch (e) {}

                    try {
                      column.key = addDoubleQuotes(column.key)
                    } catch (e) {}

                    try {
                      column.value = addDoubleQuotes(column.value)
                    } catch (e) {}

                    try {
                      if (!isTypeCollection)
                        throw 0

                      let collectionType = isCollectionMap ? `${column.key}, ${column.value}` : `${column.value}`

                      column.type = `${column.type}<${collectionType}>`
                    } catch (e) {}

                    if ((isTypeCollection || isTypeUDT) && column.isFrozen)
                      column.type = `frozen<${column.type}>`

                    return `ADD ${column.name} ${column.type}${column.isStatic ? ' STATIC' : ''}`
                  })
                } catch (e) {}

                let statement = [...addedColumns, ...droppedColumns].map((statement) => `ALTER TABLE ${keyspaceName}.${standardTableName} ${statement}`).join(';' + OS.EOL) + ';'

                try {
                  if (alteredOptions.length <= 0)
                    throw 0

                  statement = ([...addedColumns, ...droppedColumns]).length <= 0 ? '' : `${statement}` + OS.EOL

                  statement += `ALTER TABLE ${keyspaceName}.${standardTableName} ` + alteredOptions.join(' ') + ';'
                } catch (e) {}

                try {
                  actionEditor.setValue(statement)
                } catch (e) {}

                return
              } catch (e) {}

              let partitionKeys = [],
                clusteringKeys = [],
                columns = [],
                tableOptions = [],
                primaryKeys = '',
                order = {
                  asc: [],
                  desc: []
                }

              try {
                for (let dataField of allDataFields) {
                  try {
                    if (!$(dataField).hasClass('standard-table-partition-key-field'))
                      throw 0

                    let name = $(dataField).find('input.partitionKeyName').val(),
                      type = $(dataField).find('input.partitionKeyType').val(),
                      isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == type),
                      isCollectionMap = isTypeCollection && type == 'map'

                    try {
                      if (isTypeCollection)
                        throw 0

                      partitionKeys.push({
                        name,
                        type
                      })
                    } catch (e) {}

                    try {
                      if (!isTypeCollection)
                        throw 0

                      let tempJSON = {
                        value: $(dataField).find('input.collectionItemType').val()
                      }

                      if (isCollectionMap)
                        tempJSON.key = $(dataField).find('input.collectionKeyType').val()

                      partitionKeys.push({
                        name,
                        type,
                        ...tempJSON
                      })
                    } catch (e) {}
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('standard-table-clustering-key-field'))
                      throw 0

                    let name = $(dataField).find('input.clusteringKeyName').val(),
                      type = $(dataField).find('input.clusteringKeyType').val(),
                      isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == type),
                      isCollectionMap = isTypeCollection && type == 'map'

                    try {
                      if (isTypeCollection)
                        throw 0

                      clusteringKeys.push({
                        name,
                        type
                      })
                    } catch (e) {}

                    try {
                      if (!isTypeCollection)
                        throw 0

                      let tempJSON = {
                        value: $(dataField).find('input.collectionItemType').val()
                      }

                      if (isCollectionMap)
                        tempJSON.key = $(dataField).find('input.collectionKeyType').val()

                      clusteringKeys.push({
                        name,
                        type,
                        ...tempJSON
                      })
                    } catch (e) {}

                    order[$(dataField).find('div.btn.field-sort-type').attr('data-current-sort') != 'asc' ? 'desc' : 'asc'].push(name)
                  } catch (e) {}

                  try {
                    if (['standard-table-column-field', 'standard-table-udt-column-field'].every((fieldClass) => !$(dataField).hasClass(fieldClass)))
                      throw 0

                    let name = $(dataField).find('input.columnName').val(),
                      type = $(dataField).find('input.columnType').val(),
                      isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == type),
                      isCollectionMap = isTypeCollection && type == 'map',
                      isTypeUDT = keyspaceUDTs.find((udtName) => udtName == type) != undefined,
                      isStatic = $(dataField).find('input.isStatic').prop('checked') && $(dataField).find('input.isStatic').attr('disabled') == undefined,
                      isFrozen = $(dataField).find('input.isFrozen').prop('checked') && (isTypeCollection || isTypeUDT)

                    try {
                      if (isTypeCollection || isTypeUDT)
                        throw 0

                      columns.push({
                        name,
                        type,
                        isStatic
                      })
                    } catch (e) {}


                    try {
                      if (!isTypeCollection && !isTypeUDT)
                        throw 0

                      let tempJSON = {
                        value: $(dataField).find('input.collectionItemType').val()
                      }

                      if (isCollectionMap)
                        tempJSON.key = $(dataField).find('input.collectionKeyType').val()

                      let columnStructure = {
                        name,
                        type,
                        isStatic,
                        isFrozen
                      }

                      if (isTypeCollection)
                        columnStructure = {
                          ...columnStructure,
                          ...tempJSON
                        }

                      columns.push(columnStructure)
                    } catch (e) {}
                  } catch (e) {}

                  try {
                    if (!$(dataField).hasClass('standard-table-option-field'))
                      throw 0

                    let name = $(dataField).find('input.tableOptionName').val(),
                      value = $(dataField).find('input.tableOptionValue').val()

                    try {
                      if ($(dataField).attr('data-is-default') != 'true')
                        throw 0

                      let defaultName = $(dataField).attr('data-default-name'),
                        defaultValue = $(dataField).attr('data-default-value')

                      if (defaultName == name && defaultValue == value)
                        continue
                    } catch (e) {}

                    tableOptions.push({
                      name,
                      value
                    })
                  } catch (e) {}
                }
              } catch (e) {}

              // Add comment
              try {
                let comment = $('textarea#standardTableCommentOption').val()

                if (`${comment}`.length <= 0)
                  throw 0

                tableOptions.push({
                  name: 'comment',
                  value: (comment || '').replace(/(^|[^'])'(?!')/g, "$1''")
                })
              } catch (e) {}

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

              let manipulatedKeys = ([...partitionKeys, ...clusteringKeys].map((key) => {
                let isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == key.type),
                  isCollectionMap = isTypeCollection && key.type == 'map',
                  keyspaceUDTs = [],
                  isTypeUDT = false

                try {
                  keyspaceUDTs = JSON.parse(JSONRepair($('div.modal#rightClickActionsMetadata').attr('data-keyspace-udts'))).map((udt) => udt.name)
                } catch (e) {}

                isTypeUDT = keyspaceUDTs.find((udt) => key.type == udt)

                try {
                  key.type = addDoubleQuotes(key.type)
                } catch (e) {}

                try {
                  key.name = addDoubleQuotes(key.name)
                } catch (e) {}

                try {
                  key.value = addDoubleQuotes(key.value)
                } catch (e) {}

                try {
                  key.key = addDoubleQuotes(key.key)
                } catch (e) {}

                try {
                  if (!isTypeUDT)
                    throw 0

                  key.type = `frozen<${key.type}>`
                } catch (e) {}

                try {
                  if (!isTypeCollection)
                    throw 0

                  let collectionType = isCollectionMap ? `${key.key}, ${key.value}` : `${key.value}`

                  key.type = `frozen<${key.type}<${collectionType}>>`
                } catch (e) {}

                return `    ${key.name} ${key.type},` + OS.EOL
              })).join('')

              let manipulatedColumns = columns.map((column) => {
                let isTypeCollection = ['map', 'set', 'list'].some((collectionType) => collectionType == column.type),
                  isCollectionMap = isTypeCollection && column.type == 'map',
                  keyspaceUDTs = []
                isTypeUDT = false

                try {
                  keyspaceUDTs = JSON.parse(JSONRepair($('div.modal#rightClickActionsMetadata').attr('data-keyspace-udts'))).map((udt) => udt.name)

                  isTypeUDT = keyspaceUDTs.find((udt) => column.type == udt)
                } catch (e) {}


                try {
                  column.type = addDoubleQuotes(column.type)
                } catch (e) {}

                try {
                  column.name = addDoubleQuotes(column.name)
                } catch (e) {}

                try {
                  column.value = addDoubleQuotes(column.value)
                } catch (e) {}

                try {
                  column.key = addDoubleQuotes(column.key)
                } catch (e) {}

                try {
                  if (!isTypeCollection)
                    throw 0

                  let collectionType = isCollectionMap ? `${column.key}, ${column.value}` : `${column.value}`

                  column.type = `${column.type}<${collectionType}>`
                } catch (e) {}

                if ((isTypeCollection || isTypeUDT) && column.isFrozen)
                  column.type = `frozen<${column.type}>`

                return `    ${column.name} ${column.type}${column.isStatic ? ' STATIC' : ''},` + OS.EOL
              }).join('')

              try {
                primaryKeys = (partitionKeys.map((key) => key.name)).join(', ')

                if (partitionKeys.length > 1)
                  primaryKeys = `(${primaryKeys})`
              } catch (e) {}

              try {
                if (clusteringKeys.length <= 0)
                  throw 0

                primaryKeys += `, ` + (clusteringKeys.map((key) => key.name)).join(', ')
              } catch (e) {}

              let descOrder = [...order.asc, ...order.desc]

              try {
                if (tableOptions.length <= 0)
                  throw 0

                let tempTxt = descOrder.length > 0 ? OS.EOL + '    AND ' : ` WITH `

                tempTxt += (tableOptions.map((option) => {
                  option.value = option.value.startsWith('{') && option.value.endsWith('}') ? option.value : `'${option.value}'`

                  return `${option.name} = ${option.value}`
                })).join(OS.EOL + '    AND ')

                tableOptions = tempTxt
              } catch (e) {
                tableOptions = ''
              }

              try {
                if (descOrder.length <= 0 || clusteringKeys.length <= 0)
                  throw 0

                descOrder = ` WITH CLUSTERING ORDER BY (` + (clusteringKeys.map((key) => `${key.name} ${order.desc.includes(key.name) ? 'DESC' : 'ASC'}`)).join(', ') + `)`
              } catch (e) {
                descOrder = ''
              }

              let statement = `CREATE TABLE IF NOT EXISTS ${keyspaceName}.${standardTableName} (` + OS.EOL + `${manipulatedKeys}${manipulatedColumns}` + `    PRIMARY KEY (${primaryKeys})` + OS.EOL + ')' + `${descOrder}` + `${tableOptions}` + ';'

              try {
                actionEditor.setValue(statement)
              } catch (e) {}
            })
          }
          setTimeout(() => {
            try {
              dialogElement.find('div.standard-table-partition-keys-fields, div.standard-table-clustering-keys-fields').sortable({
                handle: '.sort-handler',
                animation: 150,
                ghostClass: 'ghost-field',
                onSort: () => updateRowsZIndex()
              })
            } catch (e) {}
          }, 1000)

          $('input#standardtableName').on('input', function() {
            let keyspaceTables = [],
              standardtableName = $(this).val(),
              isNameDuplicated = false,
              isNameInvalid = false,
              invalidFeedback = $(this).parent().children('div.invalid-feedback'),
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            $(this).attr('disabled', isAlterState ? '' : null)
            $(this).parent().toggleClass('invalid-warning', isAlterState)
            $(this).removeClass('is-invalid ignore-invalid')

            try {
              if (!isAlterState)
                throw 0

              invalidFeedback.find('span').attr('mulang', 'the table name can\'t be altered').text(I18next.capitalizeFirstLetter(I18next.t('the table name can\'t be altered')))

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

              return
            } catch (e) {}

            try {
              keyspaceTables = JSON.parse(JSONRepair($('#rightClickActionsMetadata').attr('data-keyspace-tables')))
            } catch (e) {}

            try {
              if (keyspaceTables.length <= 0)
                throw 0

              isNameDuplicated = keyspaceTables.some((name) => minifyText(`${name}`) == minifyText(`${standardtableName}`))

              if (isAlterState && isNameDuplicated && (standardtableName == $('div.modal#rightClickActionsMetadata').attr('data-table-name')))
                isNameDuplicated = false

              if (isNameDuplicated)
                invalidFeedback.find('span').attr('mulang', 'provided name is already in use').text(I18next.capitalizeFirstLetter(I18next.t('provided name is already in use')))
            } catch (e) {}

            try {
              if (`${standardtableName}`.length <= 0)
                throw 0

              isNameInvalid = `${standardtableName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null

              if (isNameInvalid)
                invalidFeedback.find('span').attr('mulang', 'provided name is invalid, only alphanumeric and underscores are allowed').text(I18next.capitalizeFirstLetter(I18next.t('provided name is invalid, only alphanumeric and underscores are allowed')))
            } catch (e) {}

            $(this).toggleClass('is-invalid', isNameDuplicated || isNameInvalid)

            let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field, div.standard-table-udt-column-field, div.standard-table-option-field'),
              invalidInputFields = allDataFields.find('input.is-invalid')

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', $(this).hasClass('is-invalid') || `${keyspaceName}`.length <= 0 || allDataFields.length <= 0 || invalidInputFields.length > 0 ? '' : null), 50)

            try {
              updateActionStatusForStandardTables()
            } catch (e) {}
          })

          $(`a[action]#addStandardTablePartitionKey`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.standard-table-partition-keys-fields'),
              getPartitionKeyFieldElement = (keyspaceUDTs = []) => {
                let typesList = `
              <li><span class="group-text"><span mulang="numeric types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="int">int</a></li>
              <li><a class="dropdown-item" href="#" value="bigint">bigint</a></li>
              <li><a class="dropdown-item" href="#" value="smallint">smallint</a></li>
              <li><a class="dropdown-item" href="#" value="tinyint">tinyint</a></li>
              <li><a class="dropdown-item" href="#" value="varint">varint</a></li>
              <li><a class="dropdown-item" href="#" value="float">float</a></li>
              <li><a class="dropdown-item" href="#" value="double">double</a></li>
              <li><a class="dropdown-item" href="#" value="decimal">decimal</a></li>
              <li><span class="group-text"><span mulang="textual types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="text">text</a></li>
              <li><a class="dropdown-item" href="#" value="varchar">varchar</a></li>
              <li><a class="dropdown-item" href="#" value="ascii">ascii</a></li>
              <li><span class="group-text"><span mulang="boolean type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="boolean">boolean</a></li>
              <li><span class="group-text"><span mulang="date/time types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="timestamp">timestamp</a></li>
              <li><a class="dropdown-item" href="#" value="date">date</a></li>
              <li><a class="dropdown-item" href="#" value="duration">duration</a></li>
              <li><a class="dropdown-item" href="#" value="time">time</a></li>
              <li><span class="group-text"><span mulang="binary type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="blob">blob</a></li>
              <li><span class="group-text"><span mulang="UUID types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="uuid">uuid</a></li>
              <li><a class="dropdown-item" href="#" value="timeuuid">timeuuid</a></li>
              <li><span class="group-text"><span mulang="network type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="inet">inet</a></li>`,
                  collectionsTypesItems = `
            <li><span class="group-text"><span mulang="collection types" capitalize></span></span></li>
            <li><a class="dropdown-item" href="#" value="list" data-is-collection>list&lt;type&gt;</a></li>
            <li><a class="dropdown-item" href="#" value="set" data-is-collection>set&lt;type&gt;</a></li>
            <li><a class="dropdown-item" style="overflow: hidden; text-overflow: ellipsis;" href="#" value="map" data-is-collection data-is-map>map&lt;key_type, value_type&gt;</a></li>`
                defaultType = 'text'

                try {
                  if (keyspaceUDTs.length <= 0)
                    throw 0

                  typesList += '<li><span class="group-text"><span mulang="user defined types" capitalize></span></span></li>'

                  for (let udt of keyspaceUDTs)
                    typesList += `<li><a class="dropdown-item" data-is-udt="true" href="#" value="${udt}">${udt}</a></li>`
                } catch (e) {}

                let [
                  collectionKeyTypeID,
                  collectionItemTypeID,
                  partitionKeyTypeID
                ] = getRandom.id(10, 3).map((id) => `_${id}`),
                  element = `
                <div class="standard-table-partition-key-field row">
                  <div class="col-md-1" style="text-align: center;">
                    <div class="sort-handler" style="cursor:grab;">
                      <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                    </div>
                  </div>
                  <div class="col-md-5" col="partitionKeyName">
                    <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                      <input type="text" class="form-control form-icon-trailing partitionKeyName is-invalid" style="margin-bottom: 0;">
                      <label class="form-label">
                        <span mulang="key name" capitalize></span>
                      </label>
                      <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                    </div>
                  </div>
                  <div class="col-md-5" col="partitionKeyType">
                    <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                      <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                      <input type="text" class="form-control form-icon-trailing partitionKeyType" id="${partitionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                      <label class="form-label">
                        <span mulang="key type" capitalize></span>
                      </label>
                      <div class="valid-feedback"></div>
                      <div class="invalid-feedback"></div>
                    </div>
                    <div class="dropdown" for-select="${partitionKeyTypeID}" for-data-type="partitionKeyType" style="bottom: 20px;">
                      <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                      <ul class="dropdown-menu">
                        ${typesList}
                        ${collectionsTypesItems}
                      </ul>
                    </div>
                  </div>
                  <div class="col-md-2" col="collectionKeyType" style="display:none;">
                    <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                      <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                      <input type="text" class="form-control form-icon-trailing collectionKeyType" id="${collectionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                      <label class="form-label">
                        <span mulang="key type" capitalize></span>
                      </label>
                      <div class="valid-feedback"></div>
                      <div class="invalid-feedback"></div>
                    </div>
                    <div class="dropdown" for-select="${collectionKeyTypeID}" style="bottom: 20px;">
                      <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                      <ul class="dropdown-menu">
                        ${typesList}
                      </ul>
                    </div>
                  </div>
                  <div class="col-md-2" col="collectionItemType" style="display:none;">
                    <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                      <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                      <input type="text" class="form-control form-icon-trailing collectionItemType" id="${collectionItemTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                      <label class="form-label">
                        <span mulang="value type" capitalize></span>
                      </label>
                      <div class="valid-feedback"></div>
                      <div class="invalid-feedback"></div>
                    </div>
                    <div class="dropdown" for-select="${collectionItemTypeID}" style="bottom: 20px;">
                      <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                      <ul class="dropdown-menu">
                        ${typesList}
                      </ul>
                    </div>
                  </div>
                  <div class="col-md-1" style="text-align: center; display: none;">
                    <div class="btn ripple-surface-light field-sort-type badge rounded-pill" data-mdb-ripple-color="light" style="height: 26px; vertical-align: middle; width: fit-content; text-align: left; margin-left: 4px;" data-current-sort="asc">
                      <ion-icon name="sort-asc" style="font-size: 160%; margin-right: 1px;"></ion-icon> <span style="position: relative; top: 1px; text-transform: uppercase;">ASC</span>
                    </div>
                  </div>
                  <div class="col-md-1">
                    <a action="delete-standard-table-partition-key" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" style="transform: translateX(12px);">
                      <ion-icon name="trash"></ion-icon>
                    </a>
                  </div>
                </div>`

                return element
              }

            dataFieldsContainer.children('div.empty-standard-table-partition-keys').hide()

            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}


            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              if (fields.length <= 0) {
                dataFieldsContainer.children('div.empty-standard-table-partition-keys').show()
                dataFieldsContainer.children('div.empty-standard-table-partition-keys').find('span[mulang]').hide()
                dataFieldsContainer.children('div.empty-standard-table-partition-keys').find('span.no-keys').show()
              }

              for (let field of fields) {
                dataFieldsContainer.append($(getPartitionKeyFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this),
                    fieldType = field.type

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'partitionKeyType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined

                          try {
                            if (!mainDropDown)
                              throw 0

                            let newColMD = isTypeCollection ? (isCollectionMap ? 4 : 5) : 6

                            row.find(`div[col="partitionKeyName"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="partitionKeyType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForStandardTables()
                          } catch (e) {}
                        })
                      })
                    }
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  setTimeout(() => {
                    $(this).find('div.sort-handler').parent().hide()

                    $(this).find('div.field-sort-type').parent().hide()

                    $(this).find('span.group-text').remove()

                    $(this).find(`a:not([value]), input`).removeClass('is-invalid').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                    $(this).find(`a[action="delete-standard-table-partition-key"]`).parent().hide()

                    $(this).find('div[col="partitionKeyName"], div[col="partitionKeyType"]').removeClass('col-md-5').addClass('col-md-6')

                    $(this).find(`input`).parent().children('ion-icon[name="arrow-down"]').hide()
                  })

                  setTimeout(() => {
                    $(this).find('input.partitionKeyName').val(`${field.name}`).trigger('input')

                    try {
                      fieldType = field.type.match(/frozen\<(.*?)(\<|\>)/)[1]
                    } catch (e) {}

                    try {
                      if (!(['map', 'set', 'list'].some((type) => type == fieldType)))
                        throw 0

                      let fieldKeyType = field.type.match(/frozen\<.*?\<(.*?)\>/)[1]

                      if (fieldType == 'map') {
                        let mapValues = minifyText(fieldKeyType).split(',')

                        $(this).find('input.collectionKeyType').val(`${mapValues[0]}`).trigger('input')
                        $(this).find('input.collectionItemType').val(`${mapValues[1]}`).trigger('input')
                      } else {
                        $(this).find('input.collectionKeyType').val(`${fieldKeyType}`).trigger('input')
                      }
                    } catch (e) {}

                    $(this).find('div.dropdown[for-data-type="partitionKeyType"]').find(`a[value="${fieldType}"]`).trigger('click')
                    $(this).find('input.partitionKeyType').attr('data-original-type', `${fieldType}`)
                  })

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getPartitionKeyFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              setTimeout(() => {
                $(this).find(`a[action="delete-standard-table-partition-key"]`).click(function() {
                  $(this).parent().parent().remove()

                  try {
                    updateActionStatusForStandardTables()
                  } catch (e) {}

                  if (dataFieldsContainer.children('div.standard-table-partition-key-field.row').length != 0)
                    return

                  $(`a[action]#addStandardTableClusteringKey`).addClass('disabled')

                  dataFieldsContainer.children('div.empty-standard-table-partition-keys').fadeIn(250)
                })

                $(this).find(`div.btn.field-sort-type`).click(function() {
                  let currentSort = $(this).attr('data-current-sort'),
                    newSort = (currentSort == 'asc' ? 'desc' : 'asc')

                  $(this).attr('data-current-sort', newSort)

                  $(this).find('ion-icon').attr('name', `sort-${newSort}`)
                  $(this).find('span').text(`${newSort}`)

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })
                })

                let errorWarningIcon = $(this).find('ion-icon.error-warning')

                $(this).find('input.partitionKeyName').on('input', function(_, triggerInput = true) {
                  let partitionKeyName = $(this).val(),
                    fieldRow = $(this).parent().parent().parent(),
                    isNameDuplicated = false,
                    isNameInvalid = false,
                    isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                  isAlterState = isAlterState != null && isAlterState == 'alter'

                  try {
                    if (`${partitionKeyName}`.length <= 0)
                      throw 0

                    isNameInvalid = `${partitionKeyName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                  } catch (e) {}

                  try {
                    let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field').not(fieldRow[0])

                    for (let dataField of allDataFields) {
                      let dataPartitionKeyNameElement = $(dataField).find('input.partitionKeyName, input.clusteringKeyName, input.columnName')

                      if (triggerInput)
                        dataPartitionKeyNameElement.trigger('input', false)

                      if (minifyText(`${dataPartitionKeyNameElement.val()}`) != minifyText(partitionKeyName))
                        continue

                      isNameDuplicated = true
                      break
                    }
                  } catch (e) {}

                  let isError = isNameDuplicated || isNameInvalid || minifyText(partitionKeyName).length <= 0

                  $(this).toggleClass('is-invalid', isError)

                  errorWarningIcon.toggleClass('show', isError && minifyText(partitionKeyName).length > 0)

                  try {
                    if (!isError)
                      throw 0

                    let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                    tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                    tooltip.enable()
                  } catch (e) {}

                  try {
                    clearTimeout(changeFooterButtonsStateTimeout)
                  } catch (e) {}

                  changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                  try {
                    updateActionStatusForStandardTables()
                  } catch (e) {}
                })
              })

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'partitionKeyType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="partitionKeyName"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="partitionKeyType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForStandardTables()
                      } catch (e) {}
                    })
                  })
                }
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              if (fields == null)
                $(`a[action]#addStandardTableClusteringKey`).removeClass('disabled')

              setTimeout(() => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addStandardTableClusteringKey`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.standard-table-clustering-keys-fields'),
              getClusteringKeyFieldElement = (keyspaceUDTs = []) => {
                let typesList = `
                <li><span class="group-text"><span mulang="numeric types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="int">int</a></li>
                <li><a class="dropdown-item" href="#" value="bigint">bigint</a></li>
                <li><a class="dropdown-item" href="#" value="smallint">smallint</a></li>
                <li><a class="dropdown-item" href="#" value="tinyint">tinyint</a></li>
                <li><a class="dropdown-item" href="#" value="varint">varint</a></li>
                <li><a class="dropdown-item" href="#" value="float">float</a></li>
                <li><a class="dropdown-item" href="#" value="double">double</a></li>
                <li><a class="dropdown-item" href="#" value="decimal">decimal</a></li>
                <li><span class="group-text"><span mulang="textual types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="text">text</a></li>
                <li><a class="dropdown-item" href="#" value="varchar">varchar</a></li>
                <li><a class="dropdown-item" href="#" value="ascii">ascii</a></li>
                <li><span class="group-text"><span mulang="boolean type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="boolean">boolean</a></li>
                <li><span class="group-text"><span mulang="date/time types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="timestamp">timestamp</a></li>
                <li><a class="dropdown-item" href="#" value="date">date</a></li>
                <li><a class="dropdown-item" href="#" value="duration">duration</a></li>
                <li><a class="dropdown-item" href="#" value="time">time</a></li>
                <li><span class="group-text"><span mulang="binary type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="blob">blob</a></li>
                <li><span class="group-text"><span mulang="UUID types" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="uuid">uuid</a></li>
                <li><a class="dropdown-item" href="#" value="timeuuid">timeuuid</a></li>
                <li><span class="group-text"><span mulang="network type" capitalize></span></span></li>
                <li><a class="dropdown-item" href="#" value="inet">inet</a></li>`,
                  collectionsTypesItems = `
            <li><span class="group-text"><span mulang="collection types" capitalize></span></span></li>
            <li><a class="dropdown-item" href="#" value="list" data-is-collection>list&lt;type&gt;</a></li>
            <li><a class="dropdown-item" href="#" value="set" data-is-collection>set&lt;type&gt;</a></li>
            <li><a class="dropdown-item" style="overflow: hidden; text-overflow: ellipsis;" href="#" value="map" data-is-collection data-is-map>map&lt;key_type, value_type&gt;</a></li>`
                defaultType = 'text'

                try {
                  if (keyspaceUDTs.length <= 0)
                    throw 0

                  typesList += '<li><span class="group-text"><span mulang="user defined types" capitalize></span></span></li>'

                  for (let udt of keyspaceUDTs)
                    typesList += `<li><a class="dropdown-item" data-is-udt="true" href="#" value="${udt}">${udt}</a></li>`
                } catch (e) {}

                let [
                  collectionKeyTypeID,
                  collectionItemTypeID,
                  clusteringKeyTypeID
                ] = getRandom.id(10, 3).map((id) => `_${id}`),
                  element = `
                  <div class="standard-table-clustering-key-field row">
                    <div class="col-md-1" style="text-align: center;">
                      <div class="sort-handler" style="cursor:grab;">
                        <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-5" col="clusteringKeyName">
                      <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                        <input type="text" class="form-control form-icon-trailing clusteringKeyName is-invalid" style="margin-bottom: 0;">
                        <label class="form-label">
                          <span mulang="key name" capitalize></span>
                        </label>
                        <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-4" col="clusteringKeyType">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing clusteringKeyType" id="${clusteringKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${clusteringKeyTypeID}" for-data-type="clusteringKeyType" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                          ${collectionsTypesItems}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionKeyType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionKeyType" id="${collectionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionKeyTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionItemType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionItemType" id="${collectionItemTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="value type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionItemTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-1" style="text-align: center;">
                    <div class="btn ripple-surface-light field-sort-type badge rounded-pill" data-mdb-ripple-color="light" style="height: 26px; vertical-align: middle; width: fit-content; text-align: left; margin-left: 4px;" data-current-sort="asc">
                    <ion-icon name="sort-asc" style="font-size: 160%; margin-right: 1px;"></ion-icon> <span style="position: relative; top: 1px; text-transform: uppercase;">ASC</span>
                      </div>
                    </div>
                    <div class="col-md-1">
                      <a action="delete-standard-table-clustering-key" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" style="transform: translateX(12px);">
                        <ion-icon name="trash"></ion-icon>
                      </a>
                    </div>
                  </div>`

                return element
              }

            dataFieldsContainer.children('div.empty-standard-table-clustering-keys').hide()

            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              if (fields.length <= 0) {
                dataFieldsContainer.children('div.empty-standard-table-clustering-keys').show()
                dataFieldsContainer.children('div.empty-standard-table-clustering-keys').find('span[mulang]').hide()
                dataFieldsContainer.children('div.empty-standard-table-clustering-keys').find('span.no-keys').show()
              }

              for (let field of fields) {
                dataFieldsContainer.append($(getClusteringKeyFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this),
                    fieldType = field.type

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'clusteringKeyType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined

                          try {
                            if (!mainDropDown)
                              throw 0

                            let newColMD = isTypeCollection ? (isCollectionMap ? 4 : 5) : 6

                            row.find(`div[col="clusteringKeyName"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="clusteringKeyType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${newColMD}`)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForStandardTables()
                          } catch (e) {}
                        })
                      })
                    }
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  setTimeout(() => {
                    $(this).find('div.sort-handler').parent().hide()

                    $(this).find('div.field-sort-type').parent().hide()

                    $(this).find('span.group-text').remove()

                    $(this).find(`a:not([value]), input`).removeClass('is-invalid').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                    $(this).find(`a[action="delete-standard-table-clustering-key"]`).parent().hide()

                    $(this).find('div[col="clusteringKeyName"], div[col="clusteringKeyType"]').removeClass('col-md-5').addClass('col-md-6')

                    $(this).find(`input`).parent().children('ion-icon[name="arrow-down"]').hide()
                  })

                  setTimeout(() => {
                    $(this).find('input.clusteringKeyName').val(`${field.name}`).trigger('input')

                    try {
                      fieldType = field.type.match(/frozen\<(.*?)(\<|\>)/)[1]
                    } catch (e) {}

                    try {
                      if (!(['map', 'set', 'list'].some((type) => type == fieldType)))
                        throw 0

                      let fieldKeyType = field.type.match(/frozen\<.*?\<(.*?)\>/)[1]

                      if (fieldType == 'map') {
                        let mapValues = minifyText(fieldKeyType).split(',')

                        $(this).find('input.collectionKeyType').val(`${mapValues[0]}`).trigger('input')
                        $(this).find('input.collectionItemType').val(`${mapValues[1]}`).trigger('input')
                      } else {
                        $(this).find('input.collectionKeyType').val(`${fieldKeyType}`).trigger('input')
                      }
                    } catch (e) {}

                    $(this).find('div.dropdown[for-data-type="clusteringKeyType"]').find(`a[value="${fieldType}"]`).trigger('click')
                    $(this).find('input.clusteringKeyType').attr('data-original-type', `${fieldType}`)
                  })

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getClusteringKeyFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              setTimeout(() => {
                $(this).find(`a[action="delete-standard-table-clustering-key"]`).click(function() {
                  $(this).parent().parent().remove()

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  if (dataFieldsContainer.children('div.standard-table-clustering-key-field.row').length != 0)
                    return

                  dataFieldsContainer.children('div.empty-standard-table-clustering-keys').fadeIn(250)

                  dataFieldsContainer.children('div.empty-standard-table-clustering-keys').find('span[mulang]').hide()
                  dataFieldsContainer.children('div.empty-standard-table-clustering-keys').find('span:not(.no-keys)').show()
                })

                $(this).find(`div.btn.field-sort-type`).click(function() {
                  let currentSort = $(this).attr('data-current-sort'),
                    newSort = (currentSort == 'asc' ? 'desc' : 'asc')

                  $(this).attr('data-current-sort', newSort)

                  $(this).find('ion-icon').attr('name', `sort-${newSort}`)
                  $(this).find('span').text(`${newSort}`)
                })

                let errorWarningIcon = $(this).find('ion-icon.error-warning')

                $(this).find('input.clusteringKeyName').on('input', function(_, triggerInput = true) {
                  let clusteringKeyName = $(this).val(),
                    fieldRow = $(this).parent().parent().parent(),
                    isNameDuplicated = false,
                    isNameInvalid = false,
                    isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                  isAlterState = isAlterState != null && isAlterState == 'alter'

                  try {
                    if (`${clusteringKeyName}`.length <= 0)
                      throw 0

                    isNameInvalid = `${clusteringKeyName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                  } catch (e) {}

                  try {
                    let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field').not(fieldRow[0])

                    for (let dataField of allDataFields) {
                      let dataClusteringKeyNameElement = $(dataField).find('input.partitionKeyName, input.clusteringKeyName, input.columnName')

                      if (triggerInput)
                        dataClusteringKeyNameElement.trigger('input', false)

                      if (minifyText(`${dataClusteringKeyNameElement.val()}`) != minifyText(clusteringKeyName))
                        continue

                      isNameDuplicated = true
                      break
                    }
                  } catch (e) {}

                  let isError = isNameDuplicated || isNameInvalid || minifyText(clusteringKeyName).length <= 0

                  $(this).toggleClass('is-invalid', isError)

                  errorWarningIcon.toggleClass('show', isError && minifyText(clusteringKeyName).length > 0)

                  try {
                    if (!isError)
                      throw 0

                    let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                    tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                    tooltip.enable()
                  } catch (e) {}

                  try {
                    clearTimeout(changeFooterButtonsStateTimeout)
                  } catch (e) {}

                  changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                  try {
                    updateActionStatusForStandardTables()
                  } catch (e) {}
                })
              })

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'clusteringKeyType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="clusteringKeyName"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="clusteringKeyType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 4}`)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForStandardTables()
                      } catch (e) {}
                    })
                  })
                }
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addStandardTableColumns`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.standard-table-columns-fields'),
              getStandardColumnFieldElement = (keyspaceUDTs = []) => {
                let typesList = `
              <li><span class="group-text"><span mulang="numeric types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="int">int</a></li>
              <li><a class="dropdown-item" href="#" value="bigint">bigint</a></li>
              <li><a class="dropdown-item" href="#" value="smallint">smallint</a></li>
              <li><a class="dropdown-item" href="#" value="tinyint">tinyint</a></li>
              <li><a class="dropdown-item" href="#" value="varint">varint</a></li>
              <li><a class="dropdown-item" href="#" value="float">float</a></li>
              <li><a class="dropdown-item" href="#" value="double">double</a></li>
              <li><a class="dropdown-item" href="#" value="decimal">decimal</a></li>
              <li><span class="group-text"><span mulang="textual types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="text">text</a></li>
              <li><a class="dropdown-item" href="#" value="varchar">varchar</a></li>
              <li><a class="dropdown-item" href="#" value="ascii">ascii</a></li>
              <li><span class="group-text"><span mulang="boolean type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="boolean">boolean</a></li>
              <li><span class="group-text"><span mulang="date/time types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="timestamp">timestamp</a></li>
              <li><a class="dropdown-item" href="#" value="date">date</a></li>
              <li><a class="dropdown-item" href="#" value="duration">duration</a></li>
              <li><a class="dropdown-item" href="#" value="time">time</a></li>
              <li><span class="group-text"><span mulang="binary type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="blob">blob</a></li>
              <li><span class="group-text"><span mulang="UUID types" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="uuid">uuid</a></li>
              <li><a class="dropdown-item" href="#" value="timeuuid">timeuuid</a></li>
              <li><span class="group-text"><span mulang="network type" capitalize></span></span></li>
              <li><a class="dropdown-item" href="#" value="inet">inet</a></li>`,
                  collectionsTypesItems = `
            <li><span class="group-text"><span mulang="collection types" capitalize></span></span></li>
            <li><a class="dropdown-item" href="#" value="list" data-is-collection>list&lt;type&gt;</a></li>
            <li><a class="dropdown-item" href="#" value="set" data-is-collection>set&lt;type&gt;</a></li>
            <li><a class="dropdown-item" style="overflow: hidden; text-overflow: ellipsis;" href="#" value="map" data-is-collection data-is-map>map&lt;key_type, value_type&gt;</a></li>`
                defaultType = 'text'

                let addKeyspaceUDTs = (typesList) => {
                  try {
                    if (keyspaceUDTs.length <= 0)
                      throw 0

                    typesList += '<li><span class="group-text"><span mulang="user defined types" capitalize></span></span></li>'

                    for (let udt of keyspaceUDTs)
                      typesList += `<li><a class="dropdown-item" data-is-udt="true" href="#" value="${udt}">${udt}</a></li>`
                  } catch (e) {}

                  return typesList
                }

                let [
                  collectionKeyTypeID,
                  collectionItemTypeID,
                  columnTypeID,
                  isColumnStaticCheckboxID,
                  isDateTypeFrozenCheckboxID
                ] = getRandom.id(10, 5).map((id) => `_${id}`),
                  element = `
                  <div class="standard-table-column-field row">
                    <div class="col-md-1" style="text-align: center; display:none;">
                      <div class="sort-handler" style="cursor:grab;">
                        <ion-icon name="sort" style="font-size: 130%;"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-5" col="columnName">
                      <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                        <input type="text" class="form-control form-icon-trailing columnName is-invalid" style="margin-bottom: 0;">
                        <label class="form-label">
                          <span mulang="column name" capitalize></span>
                        </label>
                        <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-4" col="columnType">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing columnType" id="${columnTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${columnTypeID}" for-data-type="columnType" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                          ${collectionsTypesItems}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionKeyType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionKeyType" id="${collectionKeyTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionKeyTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${addKeyspaceUDTs(typesList)}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="collectionItemType" style="display:none;">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing collectionItemType" id="${collectionItemTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="value type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${collectionItemTypeID}" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${addKeyspaceUDTs(typesList)}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="is-frozen" style="display:none;">
                      <div class="form-check margin-bottom" style="padding-left: 30px;">
                        <input class="form-check-input isFrozen" type="checkbox" id="_${isDateTypeFrozenCheckboxID}">
                        <label class="form-check-label" for="_${isDateTypeFrozenCheckboxID}">
                          <span mulang="frozen" capitalize-first></span>
                        </label>
                      </div>
                    </div>
                    <div class="col-md-3" col="is-static">
                    <div class="form-check margin-bottom forIsStaticCheckbox" style="width: fit-content; padding-left: 30px;" data-tippy="tooltip" data-mdb-placement="right" data-mulang="set column to be static is possible when there's at least one clustering key" data-is-hidden="true" data-tippy-delay="500" capitalize-first data-title>
                        <input class="form-check-input isStatic" type="checkbox" id="_${isColumnStaticCheckboxID}" tab-tooltip data-tippy="tooltip" data-mdb-placement="right" data-mulang="static" data-is-hidden="true" capitalize data-title disabled>
                        <label class="form-check-label" for="_${isColumnStaticCheckboxID}">
                          <span mulang="static" capitalize-first></span>
                        </label>
                      </div>
                    </div>
                    <div class="col-md-1">
                      <a action="delete-standard-table-column" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                        <ion-icon name="trash"></ion-icon>
                      </a>
                    </div>
                  </div>`

                return element
              }

            dataFieldsContainer.children('div.empty-standard-table-columns').hide()

            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              if (fields.length <= 0)
                dataFieldsContainer.children('div.empty-standard-table-columns').show()

              for (let field of fields) {
                dataFieldsContainer.append($(getStandardColumnFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this),
                    isFrozen = false,
                    fieldType = field.type

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => {
                      try {
                        dropDownMDBObject.update()
                      } catch (e) {}
                    }, 500)

                    {
                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        let mainDropDown = $(this).attr('for-data-type') == 'columnType'

                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value'),
                            isTypeCollection = $(this).attr('data-is-collection') != undefined,
                            isCollectionMap = $(this).attr('data-is-map') != undefined,
                            isTypeUDT = $(this).attr('data-is-udt') != undefined

                          try {
                            let tooltip = getElementMDBObject(row.find(`div[col="is-static"]`).find('input[data-tippy="tooltip"]'), 'Tooltip')

                            try {
                              tooltip[isTypeCollection || isTypeUDT ? 'enable' : 'disable']()
                            } catch (e) {}
                          } catch (e) {}

                          try {
                            if (!mainDropDown)
                              throw 0

                            row.find(`div[col="columnName"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                            row.find(`div[col="columnType"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 4}`)

                            row.find(`div[col="is-static"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeCollection ? 1 : 3}`).find('label').toggle(!isTypeCollection)

                            row.find(`div[col="is-frozen"]`).toggle(isTypeCollection)

                            row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                            row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)

                            if (isTypeCollection)
                              throw 0

                            row.find(`div[col="is-static"]`).removeClass(function(index, className) {
                              return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                            }).addClass(`col-md-${isTypeUDT ? 1 : 3}`).find('label').toggle(!isTypeUDT)

                            row.find(`div[col="is-frozen"]`).toggle(isTypeUDT)
                          } catch (e) {}

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForStandardTables()
                          } catch (e) {}
                        })
                      })
                    }
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => {
                    $(this).find('[data-tippy="tooltip"]').each(function() {
                      // Create an MDB oject for the tooltip
                      let tooltip = getElementMDBObject($(this), 'Tooltip')

                      // Disable the tab's tooltips
                      if ($(this).attr('data-is-hidden') != undefined)
                        tooltip.disable()

                      // Once the tooltip's reference element is clicked hide the tooltip
                      $(tooltip.reference).click(() => tooltip.hide())
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  try {
                    fieldType = `${field.type}`.match(/frozen\<(.*?)(\<|\>)/)[1]

                    isFrozen = true
                  } catch (e) {}

                  try {
                    fieldType = removeFrozenKeyword(`${field.type}`)

                    fieldType = `${fieldType}`.match(/^((.*?)<)/)[2]
                  } catch (e) {}

                  $(this).find(`a[action="delete-standard-table-column"]`).click(function() {
                    row.toggleClass('deleted')

                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    row.find('input.columnName').val(`${field.name}`).removeClass('is-invalid').addClass('disabled')

                    try {
                      if (!(['map', 'set', 'list'].some((type) => type == fieldType)))
                        throw 0

                      let fieldKeyType = field.type

                      try {
                        if (`${fieldKeyType}`.match(/^frozen</) == null)
                          throw 0

                        fieldKeyType = removeFrozenKeyword(`${fieldKeyType}`)
                      } catch (e) {}

                      if (fieldType == 'map') {
                        try {
                          fieldKeyType = fieldKeyType.match(/.*?<(.*?)>$/)[1]
                        } catch (e) {}

                        let mapValues = minifyText(fieldKeyType).split(',')

                        mapValues.forEach((value, index) => {
                          try {
                            if (`${fieldKeyType}`.includes('frozen<'))
                              mapValues[index] = removeFrozenKeyword(value)
                          } catch (e) {}
                        })

                        $(this).find('input.collectionKeyType').val(`${mapValues[0]}`).trigger('input')
                        $(this).find('input.collectionItemType').val(`${mapValues[1]}`).trigger('input')
                      } else {
                        try {
                          if (`${fieldKeyType}`.includes('frozen<'))
                            fieldKeyType = removeFrozenKeyword(fieldKeyType)
                        } catch (e) {}

                        try {
                          fieldKeyType = `${fieldKeyType}`.match(/<(.*?)>$/)[1]
                        } catch (e) {}

                        $(this).find('input.collectionItemType').val(`${fieldKeyType}`).trigger('input')
                      }

                      $(this).find('input.collectionKeyType, input.collectionItemType').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                      $(this).find('ion-icon[name="arrow-down"]').hide()
                    } catch (e) {}

                    row.find(`ul.dropdown-menu`).find(`a[value="${fieldType}"]`).click()

                    row.find('div[col="columnType"]').find('ion-icon[name="arrow-down"]').hide()

                    row.find('div[col="columnType"]').find('input.columnType').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                    row.find('input.isFrozen').prop('checked', isFrozen || false).attr('disabled', '')

                    row.find('input.isStatic').addClass('altered').prop('checked', field.isStatic || false).attr('disabled', '')
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getStandardColumnFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              $(this).find(`a[action="delete-standard-table-column"]`).click(function() {
                $(this).parent().parent().remove()

                setTimeout(() => {
                  try {
                    updateActionStatusForStandardTables()
                  } catch (e) {}
                })

                if (dataFieldsContainer.children('div.standard-table-column-field.row').length != 0)
                  return

                dataFieldsContainer.children('div.empty-standard-table-columns').fadeIn(250)
              })

              let errorWarningIcon = $(this).find('ion-icon.error-warning')

              $(this).find('input.columnName').on('input', function(_, triggerInput = true) {
                let columnName = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isNameDuplicated = false,
                  isNameInvalid = false,
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                try {
                  if (`${columnName}`.length <= 0)
                    throw 0

                  isNameInvalid = `${columnName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                } catch (e) {}

                try {
                  let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-column-field, div.standard-table-udt-column-field').not(fieldRow[0])

                  for (let dataField of allDataFields) {
                    let dataStandardColumnNameElement = $(dataField).find('input.partitionKeyName, input.columnName, input.clusteringKeyName, input.columnName')

                    if (triggerInput)
                      dataStandardColumnNameElement.trigger('input', false)

                    if (minifyText(`${dataStandardColumnNameElement.val()}`) != minifyText(columnName))
                      continue

                    isNameDuplicated = true
                    break
                  }
                } catch (e) {}

                let isError = isNameDuplicated || isNameInvalid || minifyText(columnName).length <= 0

                $(this).toggleClass('is-invalid', isError)

                errorWarningIcon.toggleClass('show', isError && minifyText(columnName).length > 0)

                try {
                  if (!isError)
                    throw 0

                  let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                  tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                  tooltip.enable()
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })

              $(this).find('input.isStatic, input.isFrozen').on('change', () => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => {
                  try {
                    dropDownMDBObject.update()
                  } catch (e) {}
                }, 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    let mainDropDown = $(this).attr('for-data-type') == 'columnType'

                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value'),
                        isTypeCollection = $(this).attr('data-is-collection') != undefined,
                        isCollectionMap = $(this).attr('data-is-map') != undefined,
                        isTypeUDT = $(this).attr('data-is-udt') != undefined

                      try {
                        let tooltip = getElementMDBObject(row.find(`div[col="is-static"]`).find('input[data-tippy="tooltip"]'), 'Tooltip')

                        try {
                          tooltip[isTypeCollection || isTypeUDT ? 'enable' : 'disable']()
                        } catch (e) {}
                      } catch (e) {}

                      try {
                        if (!mainDropDown)
                          throw 0

                        row.find(`div[col="columnName"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 3 : 4) : 5}`)

                        row.find(`div[col="columnType"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? (isCollectionMap ? 2 : 3) : 4}`)

                        row.find(`div[col="is-static"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeCollection ? 1 : 3}`).find('label').toggle(!isTypeCollection)

                        row.find(`div[col="is-frozen"]`).toggle(isTypeCollection)

                        row.find(`div[col="collectionKeyType"]`).toggle(isCollectionMap)

                        row.find(`div[col="collectionItemType"]`).toggle(isTypeCollection)

                        if (isTypeCollection)
                          throw 0

                        row.find(`div[col="is-static"]`).removeClass(function(index, className) {
                          return (className.match(/(^|\s)col-md-\S+/g) || []).join(' ')
                        }).addClass(`col-md-${isTypeUDT ? 1 : 3}`).find('label').toggle(!isTypeUDT)

                        row.find(`div[col="is-frozen"]`).toggle(isTypeUDT)
                      } catch (e) {}

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForStandardTables()
                      } catch (e) {}
                    })
                  })
                }
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => {
                $(this).find('[data-tippy="tooltip"]').each(function() {
                  // Create an MDB oject for the tooltip
                  let tooltip = getElementMDBObject($(this), 'Tooltip')

                  // Disable the tab's tooltips
                  if ($(this).attr('data-is-hidden') != undefined)
                    tooltip.disable()

                  // Once the tooltip's reference element is clicked hide the tooltip
                  $(tooltip.reference).click(() => tooltip.hide())
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addStandardTableUDTColumns`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.standard-table-udt-columns-fields'),
              getStandardUDTColumnFieldElement = (keyspaceUDTs = []) => {
                let typesList = '',
                  defaultType = ''

                try {
                  if (keyspaceUDTs.length <= 0)
                    throw 0

                  defaultType = keyspaceUDTs[0]

                  for (let udt of keyspaceUDTs)
                    typesList += `<li><a class="dropdown-item" data-is-udt="true" href="#" value="${udt}">${udt}</a></li>`
                } catch (e) {}

                let [
                  columnTypeID,
                  isColumnStaticCheckboxID,
                  isDateTypeFrozenCheckboxID
                ] = getRandom.id(10, 3).map((id) => `_${id}`),
                  element = `
                  <div class="standard-table-udt-column-field row">
                    <div class="col-md-3" col="columnName">
                      <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                        <input type="text" class="form-control form-icon-trailing columnName is-invalid" style="margin-bottom: 0;">
                        <label class="form-label">
                          <span mulang="column name" capitalize></span>
                        </label>
                        <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                      </div>
                    </div>
                    <div class="col-md-4" col="columnType">
                      <div class="form-outline form-white" style="z-index: 2; margin-left: 4px; width: calc(100% - 4px);">
                        <ion-icon name="arrow-down" class="trailing" style="font-size: 190%;"></ion-icon>
                        <input type="text" class="form-control form-icon-trailing columnType" id="${columnTypeID}" style="background-color: inherit; cursor: pointer;" value="${defaultType}" readonly noopacity>
                        <label class="form-label">
                          <span mulang="key type" capitalize></span>
                        </label>
                        <div class="valid-feedback"></div>
                        <div class="invalid-feedback"></div>
                      </div>
                      <div class="dropdown" for-select="${columnTypeID}" for-data-type="columnType" style="bottom: 20px;">
                        <button class="btn dropdown-toggle" type="button" data-mdb-toggle="dropdown"></button>
                        <ul class="dropdown-menu">
                          ${typesList}
                        </ul>
                      </div>
                    </div>
                    <div class="col-md-2" col="is-frozen" <div class="form-check margin-bottom" style="padding-left: 7px;">
                      <input class="form-check-input isFrozen" type="checkbox" id="_${isDateTypeFrozenCheckboxID}">
                      <label class="form-check-label" for="_${isDateTypeFrozenCheckboxID}">
                        <span mulang="frozen" capitalize-first></span>
                      </label>
                    </div>
                    <div class="col-md-2" col="is-static">
                    <div class="form-check margin-bottom forIsStaticCheckbox" style="width: fit-content; padding-left: 30px;" data-tippy="tooltip" data-mdb-placement="right" data-mulang="set column to be static is possible when there's at least one clustering key" data-is-hidden="true" data-tippy-delay="500" capitalize-first data-title>
                        <input class="form-check-input isStatic" type="checkbox" id="_${isColumnStaticCheckboxID}" data-tippy="tooltip" data-mdb-placement="right" data-mulang="static" data-is-hidden="true" capitalize data-title disabled>
                        <label class="form-check-label" for="_${isColumnStaticCheckboxID}">
                          <span mulang="static" capitalize-first></span>
                        </label>
                      </div>
                    </div>
                    <div class="col-md-1">
                      <a action="delete-standard-table-udt-column" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                        <ion-icon name="trash"></ion-icon>
                      </a>
                    </div>
                  </div>`

                return element
              }

            dataFieldsContainer.children('div.empty-standard-table-udt-columns').hide()

            let keyspaceUDTs = [],
              isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

            isAlterState = isAlterState != null && isAlterState == 'alter'

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts')))

              keyspaceUDTs = keyspaceUDTs.map((udt) => udt.name)
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              fields = JSON.parse(fields)

              if (fields.length <= 0)
                dataFieldsContainer.children('div.empty-standard-table-udt-columns').show()

              for (let field of fields) {
                dataFieldsContainer.append($(getStandardUDTColumnFieldElement(keyspaceUDTs)).show(function() {
                  let row = $(this),
                    isFrozen = false,
                    fieldType = field.type

                  try {
                    fieldType = field.type.match(/frozen\<(.*?)(\<|\>)/)[1]

                    isFrozen = true
                  } catch (e) {}

                  $(this).find(`a[action="delete-standard-table-udt-column"]`).click(function() {
                    row.toggleClass('deleted')

                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    row.find('input.columnName').val(`${field.name}`).removeClass('is-invalid').addClass('disabled')

                    row.find('div.dropdown[for-data-type="columnType"]').find(`a.dropdown-item[value="${fieldType}"]`).click()

                    row.find('div[col="columnType"]').find('ion-icon[name="arrow-down"]').hide()

                    row.find('div[col="columnType"]').find('input.columnType').addClass('disabled').attr('disabled', 'disabled').css('background-color', '')

                    row.find('input.isFrozen').prop('checked', isFrozen || false).attr('disabled', '')

                    row.find('input.isStatic').addClass('altered').prop('checked', field.isStatic || false).attr('disabled', '')
                  })

                  setTimeout(() => {
                    let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                    setTimeout(() => dropDownMDBObject.update(), 500)

                    {
                      // Once one of the items is clicked
                      $(this).find(`div.dropdown[for-select]`).each(function() {
                        $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                          let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                          $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                          try {
                            updateRowsZIndex(isTransformNegative)
                          } catch (e) {}
                        })

                        $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                          // Point at the input field related to the list
                          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                            selectedValue = $(this).attr('value')

                          // Update the input's value
                          selectElement.val(selectedValue).trigger('input')

                          try {
                            updateActionStatusForStandardTables()
                          } catch (e) {}
                        })
                      })
                    }
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => {
                    $(this).find('[data-tippy="tooltip"]').each(function() {
                      // Create an MDB oject for the tooltip
                      let tooltip = getElementMDBObject($(this), 'Tooltip')

                      // Disable the tab's tooltips
                      if ($(this).attr('data-is-hidden') != undefined)
                        tooltip.disable()

                      // Once the tooltip's reference element is clicked hide the tooltip
                      $(tooltip.reference).click(() => tooltip.hide())
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getStandardUDTColumnFieldElement(keyspaceUDTs)).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.position().top
                }, 150) : '')

              $(this).find(`a[action="delete-standard-table-udt-column"]`).click(function() {
                $(this).parent().parent().remove()

                setTimeout(() => {
                  try {
                    updateActionStatusForStandardTables()
                  } catch (e) {}
                })

                if (dataFieldsContainer.children('div.standard-table-udt-column-field.row').length != 0)
                  return

                dataFieldsContainer.children('div.empty-standard-table-udt-columns').fadeIn(250)
              })

              let errorWarningIcon = $(this).find('ion-icon.error-warning')

              $(this).find('input.columnName').on('input', function(_, triggerInput = true) {
                let columnName = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isNameDuplicated = false,
                  isNameInvalid = false,
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                try {
                  if (`${columnName}`.length <= 0)
                    throw 0

                  isNameInvalid = `${columnName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                } catch (e) {}

                try {
                  let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-partition-key-field, div.standard-table-clustering-key-field, div.standard-table-udt-column-field').not(fieldRow[0])

                  for (let dataField of allDataFields) {
                    let dataStandardColumnNameElement = $(dataField).find('input.partitionKeyName, input.columnName, input.clusteringKeyName, input.columnName')

                    if (triggerInput)
                      dataStandardColumnNameElement.trigger('input', false)

                    if (minifyText(`${dataStandardColumnNameElement.val()}`) != minifyText(columnName))
                      continue

                    isNameDuplicated = true
                    break
                  }
                } catch (e) {}

                let isError = isNameDuplicated || isNameInvalid || minifyText(columnName).length <= 0

                $(this).toggleClass('is-invalid', isError)

                errorWarningIcon.toggleClass('show', isError && minifyText(columnName).length > 0)

                try {
                  if (!isError)
                    throw 0

                  let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                  tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                  tooltip.enable()
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })

              $(this).find('input.isStatic, input.isFrozen').on('change', () => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })

              setTimeout(() => {
                let dropDownMDBObject = getElementMDBObject(row.find(`div.dropdown[for-select]`), 'Dropdown')

                setTimeout(() => dropDownMDBObject.update(), 500)

                {
                  row.find('div.dropdown[for-select]').each(function() {
                    let dropDownElement = $(this),
                      // Get the MDB object of the current dropdown element
                      selectDropdown = getElementMDBObject(dropDownElement, 'Dropdown'),
                      // Point at the associated input field
                      input = row.find(`input#${dropDownElement.attr('for-select')}`)

                    // Once the associated select element is being focused then show the dropdown element and vice versa
                    input.on('focus', () => {
                      try {
                        input.parent().find('div.invalid-feedback').addClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.show()
                    }).on('focusout', () => setTimeout(() => {
                      try {
                        input.parent().find('div.invalid-feedback').removeClass('transparent-color')
                      } catch (e) {}

                      selectDropdown.hide()
                    }, 100))

                    // Once the parent `form-outline` is clicked trigger the `focus` event
                    input.parent().click(() => input.trigger('focus'))
                  })

                  // Once one of the items is clicked
                  $(this).find(`div.dropdown[for-select]`).each(function() {
                    $(this).find(`ul.dropdown-menu`).observeTransform(() => {
                      let isTransformNegative = `${$(this).find(`ul.dropdown-menu`).css('transform')}`.includes('-')

                      $(this).find(`ul.dropdown-menu`).find('li').last().css('margin-bottom', isTransformNegative ? '20px' : '')

                      try {
                        updateRowsZIndex(isTransformNegative)
                      } catch (e) {}
                    })

                    $(this).find(`ul.dropdown-menu`).find('a').click(function() {
                      // Point at the input field related to the list
                      let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`),
                        selectedValue = $(this).attr('value')

                      // Update the input's value
                      selectElement.val(selectedValue).trigger('input')

                      try {
                        updateActionStatusForStandardTables()
                      } catch (e) {}
                    })
                  })
                }
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => {
                $(this).find('[data-tippy="tooltip"]').each(function() {
                  // Create an MDB oject for the tooltip
                  let tooltip = getElementMDBObject($(this), 'Tooltip')

                  // Disable the tab's tooltips
                  if ($(this).attr('data-is-hidden') != undefined)
                    tooltip.disable()

                  // Once the tooltip's reference element is clicked hide the tooltip
                  $(tooltip.reference).click(() => tooltip.hide())
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })
            }))
          })

          $(`a[action]#addStandardTableOption`).on('click', function(_, fields = null) {
            let dataFieldsContainer = dialogElement.find('div.standard-table-options-fields'),
              getTableOptionFieldElement = (defaultOption = false) => {
                return `
                <div class="standard-table-option-field row" style="padding-right: 10px;">
                  <div class="col-md-5">
                    <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                      <input type="text" class="form-control form-icon-trailing tableOptionName is-invalid" style="margin-bottom: 0;">
                      <label class="form-label">
                        <span mulang="option name" capitalize></span>
                      </label>
                      <ion-icon name="info-circle" class="error-warning" data-tippy="tooltip" data-mdb-placement="top" data-mdb-html="true" data-title data-tippy-delay="[100, 0]"></ion-icon>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-outline form-white" style="margin-right: 4px; width: calc(100% - 4px);">
                      <input type="text" class="form-control form-icon-trailing tableOptionValue is-invalid" style="margin-bottom: 0;">
                      <label class="form-label">
                        <span mulang="option value" capitalize></span>
                      </label>
                    </div>
                  </div>
                  <div class="col-md-1" ${defaultOption ? 'hidden' : ''}>
                    <a action="delete-standard-table-option" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                      <ion-icon name="trash"></ion-icon>
                    </a>
                  </div>
                  <div class="col-md-1" ${!defaultOption ? 'hidden' : ''}>
                    <a action="undo-change" class="btn btn-link btn-rounded btn-sm disabled" data-mdb-ripple-color="light" href="#" role="button">
                      <ion-icon name="undo"></ion-icon>
                    </a>
                  </div>
                </div>`
              }

            dataFieldsContainer.children('div.empty-standard-table-options').hide()

            try {
              if (fields == null)
                throw 0

              try {
                fields = JSON.parse(repairJSONString(fields))
              } catch (e) {
                fields = []
              }

              let areDefaultOptions = fields.default === true || fields.find((option) => option.default) != undefined

              if (!areDefaultOptions)
                throw 0

              for (let field of fields) {
                if (field.name == undefined)
                  continue

                try {
                  if (field.name != 'comment')
                    throw 0

                  $('textarea#standardTableCommentOption').data('original-value', `${field.value}`)

                  $('textarea#standardTableCommentOption').val(`${field.value}`).trigger('input')

                  continue
                } catch (e) {}

                dataFieldsContainer.append($(getTableOptionFieldElement(true)).show(function() {
                  let row = $(this)

                  row.attr({
                    'data-is-default': 'true',
                    'data-default-name': `${field.name}`,
                    'data-default-value': `${field.value.replace(/"/g, "'")}`
                  })

                  row.find('input.tableOptionName').removeClass('is-invalid').val(field.name).trigger('input')
                  row.find('input.tableOptionValue').removeClass('is-invalid').val(field.value.replace(/"/g, "'")).trigger('input')

                  row.find(`a[action="undo-change"]`).click(function() {
                    row.find('input.tableOptionName').val(row.attr('data-default-name')).trigger('input')
                    row.find('input.tableOptionValue').val(row.attr('data-default-value')).trigger('input')

                    setTimeout(() => {
                      try {
                        updateActionStatusForStandardTables()
                      } catch (e) {}
                    })
                  })

                  let errorWarningIcon = $(this).find('ion-icon.error-warning')

                  $(this).find('input.tableOptionName').on('input', function(_, triggerInput = true) {
                    let tableOptionName = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isNameDuplicated = false,
                      isNameInvalid = false,
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    try {
                      if (`${tableOptionName}`.length <= 0)
                        throw 0

                      isNameInvalid = `${tableOptionName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                    } catch (e) {}

                    try {
                      let defaultName = row.attr('data-default-name'),
                        defaultValue = row.attr('data-default-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-option-field').not(fieldRow[0])

                      for (let dataField of allDataFields) {
                        let tableOptionNameElement = $(dataField).find('input.tableOptionName')

                        if (triggerInput)
                          tableOptionNameElement.trigger('input', false)

                        if (minifyText(`${tableOptionNameElement.val()}`) != minifyText(tableOptionName))
                          continue

                        isNameDuplicated = true
                        break
                      }
                    } catch (e) {}

                    let isError = isNameDuplicated || isNameInvalid || minifyText(tableOptionName).length <= 0

                    $(this).toggleClass('is-invalid', isError)

                    errorWarningIcon.toggleClass('show', isError && minifyText(tableOptionName).length > 0)

                    try {
                      if (!isError)
                        throw 0

                      let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                      tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                      tooltip.enable()
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  $(this).find('input.tableOptionValue').on('input', function(_, triggerInput = true) {
                    let tableOptionValue = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    $(this).toggleClass('is-invalid', minifyText(tableOptionValue).length <= 0)

                    try {
                      let defaultName = row.attr('data-default-name'),
                        defaultValue = row.attr('data-default-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', minifyText(tableOptionValue).length <= 0 ? '' : null), 50)

                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })
                }))
              }

              if (areDefaultOptions)
                return
            } catch (e) {}

            try {
              if (fields == null)
                throw 0

              let options = []

              try {
                options = fields
              } catch (e) {}

              let optionsNames = Object.keys(options)

              for (let optionName of optionsNames) {
                let optionValue = options[optionName]

                try {
                  if (optionName != 'comment')
                    throw 0

                  $('textarea#standardTableCommentOption').data('original-value', `${optionValue}`)

                  $('textarea#standardTableCommentOption').val(`${optionValue}`).trigger('input')

                  continue
                } catch (e) {}

                try {
                  if (typeof optionValue == 'object')
                    optionValue = JSON.stringify(optionValue)
                } catch (e) {}

                optionValue = `${optionValue}`

                dataFieldsContainer.append($(getTableOptionFieldElement(true)).show(function() {
                  let row = $(this)

                  row.attr({
                    'data-original-name': `${optionName}`,
                    'data-original-value': `${optionValue.replace(/"/g, "'")}`
                  })

                  row.find('input.tableOptionName').removeClass('is-invalid').val(optionName).trigger('input')
                  row.find('input.tableOptionValue').removeClass('is-invalid').val(optionValue.replace(/"/g, "'")).trigger('input')

                  row.find(`a[action="undo-change"]`).click(function() {
                    row.find('input.tableOptionName').val(row.attr('data-original-name')).trigger('input')
                    row.find('input.tableOptionValue').val(row.attr('data-original-value')).trigger('input')

                    setTimeout(() => {
                      try {
                        updateActionStatusForStandardTables()
                      } catch (e) {}
                    })
                  })

                  let errorWarningIcon = $(this).find('ion-icon.error-warning')

                  $(this).find('input.tableOptionName').on('input', function(_, triggerInput = true) {
                    let tableOptionName = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isNameDuplicated = false,
                      isNameInvalid = false,
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    try {
                      if (`${tableOptionName}`.length <= 0)
                        throw 0

                      isNameInvalid = `${tableOptionName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                    } catch (e) {}

                    try {
                      let defaultName = row.attr('data-original-name'),
                        defaultValue = row.attr('data-original-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-option-field').not(fieldRow[0])

                      for (let dataField of allDataFields) {
                        let tableOptionNameElement = $(dataField).find('input.tableOptionName')

                        if (triggerInput)
                          tableOptionNameElement.trigger('input', false)

                        if (minifyText(`${tableOptionNameElement.val()}`) != minifyText(tableOptionName))
                          continue

                        isNameDuplicated = true
                        break
                      }
                    } catch (e) {}

                    let isError = isNameDuplicated || isNameInvalid || minifyText(tableOptionName).length <= 0

                    $(this).toggleClass('is-invalid', isError)

                    errorWarningIcon.toggleClass('show', isError && minifyText(tableOptionName).length > 0)

                    try {
                      if (!isError)
                        throw 0

                      let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                      tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                      tooltip.enable()
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  $(this).find('input.tableOptionValue').on('input', function(_, triggerInput = true) {
                    let tableOptionValue = $(this).val(),
                      fieldRow = $(this).parent().parent().parent(),
                      isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                    isAlterState = isAlterState != null && isAlterState == 'alter'

                    $(this).toggleClass('is-invalid', minifyText(tableOptionValue).length <= 0)

                    try {
                      let defaultName = row.attr('data-original-name'),
                        defaultValue = row.attr('data-original-value')

                      row.find(`a[action="undo-change"]`).toggleClass('disabled', !(defaultName != row.find('input.tableOptionName').val() || defaultValue != row.find('input.tableOptionValue').val()))
                    } catch (e) {}

                    try {
                      clearTimeout(changeFooterButtonsStateTimeout)
                    } catch (e) {}

                    changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', minifyText(tableOptionValue).length <= 0 ? '' : null), 50)

                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })

                  setTimeout(() => {
                    $(this).find('input[type="text"]').each(function() {
                      let mdbObject = getElementMDBObject($(this))

                      setTimeout(() => mdbObject.update(), 500)
                    })
                  })

                  setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                  try {
                    updateRowsZIndex()
                  } catch (e) {}

                  setTimeout(() => {
                    try {
                      updateActionStatusForStandardTables()
                    } catch (e) {}
                  })
                }))
              }

              return
            } catch (e) {}

            dataFieldsContainer.append($(getTableOptionFieldElement()).show(function() {
              let row = $(this)

              if ((fields || []).length <= 0)
                setTimeout(() => !row.isVisibleInContainer() ? row.offsetParent().animate({
                  scrollTop: row.offsetParent().get(0).scrollHeight
                }, 150) : '')

              $(this).find(`a[action="delete-standard-table-option"]`).click(function() {
                $(this).parent().parent().remove()

                setTimeout(() => {
                  try {
                    updateActionStatusForStandardTables()
                  } catch (e) {}
                })

                if (dataFieldsContainer.children('div.standard-table-option-field.row').length != 0)
                  return

                dataFieldsContainer.children('div.empty-standard-table-options').fadeIn(250)
              })

              let errorWarningIcon = $(this).find('ion-icon.error-warning')

              $(this).find('input.tableOptionName').on('input', function(_, triggerInput = true) {
                let tableOptionName = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isNameDuplicated = false,
                  isNameInvalid = false,
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                try {
                  if (`${tableOptionName}`.length <= 0)
                    throw 0

                  isNameInvalid = `${tableOptionName}`.match(/^(?:[a-zA-Z][a-zA-Z0-9_]*|".+?")$/gm) == null
                } catch (e) {}

                try {
                  let allDataFields = dialogElement.find('div[action="standard-tables"]').find('div.standard-table-option-field').not(fieldRow[0])

                  for (let dataField of allDataFields) {
                    let tableOptionNameElement = $(dataField).find('input.tableOptionName')

                    if (triggerInput)
                      tableOptionNameElement.trigger('input', false)

                    if (minifyText(`${tableOptionNameElement.val()}`) != minifyText(tableOptionName))
                      continue

                    isNameDuplicated = true
                    break
                  }
                } catch (e) {}

                let isError = isNameDuplicated || isNameInvalid || minifyText(tableOptionName).length <= 0

                $(this).toggleClass('is-invalid', isError)

                errorWarningIcon.toggleClass('show', isError && minifyText(tableOptionName).length > 0)

                try {
                  if (!isError)
                    throw 0

                  let tooltip = getElementMDBObject(errorWarningIcon, 'Tooltip')

                  tooltip.setContent(isNameInvalid ? 'Invalid name detected' : 'Name duplication detected')

                  tooltip.enable()
                } catch (e) {}

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', isNameDuplicated || isNameInvalid ? '' : null), 50)

                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })

              $(this).find('input.tableOptionValue').on('input', function(_, triggerInput = true) {
                let tableOptionValue = $(this).val(),
                  fieldRow = $(this).parent().parent().parent(),
                  isAlterState = $('div.modal#rightClickActionsMetadata').attr('data-state')

                isAlterState = isAlterState != null && isAlterState == 'alter'

                $(this).toggleClass('is-invalid', minifyText(tableOptionValue).length <= 0)

                try {
                  clearTimeout(changeFooterButtonsStateTimeout)
                } catch (e) {}

                changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', minifyText(tableOptionValue).length <= 0 ? '' : null), 50)

                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })

              setTimeout(() => {
                $(this).find('input[type="text"]').each(function() {
                  let mdbObject = getElementMDBObject($(this))

                  setTimeout(() => mdbObject.update(), 500)
                })
              })

              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              try {
                updateRowsZIndex()
              } catch (e) {}

              setTimeout(() => {
                try {
                  updateActionStatusForStandardTables()
                } catch (e) {}
              })
            }))
          })

          {
            let showStandardTableOptionsContainerBtn = $('#rightClickActionsMetadata').find('div.show-standard-table-options-container'),
              hideStandardTableOptionsContainerBtn = $('#rightClickActionsMetadata').find('div.standard-table-options-sub-container a'),
              tableOptionsContainer = $('#rightClickActionsMetadata').find('div.standard-table-options-container'),
              tableOptionsContainerResizingObserver,
              isShowBtnShown = false

            showStandardTableOptionsContainerBtn.click(function() {
              $(this).hide()

              try {
                tableOptionsContainerResizingObserver.disconnect()
              } catch (e) {}

              isShowBtnShown = false

              tableOptionsContainer.slideDown(300)

              hideStandardTableOptionsContainerBtn.addClass('show')
            })

            hideStandardTableOptionsContainerBtn.click(function() {
              tableOptionsContainer.slideUp(300)

              $(this).removeClass('show')

              try {
                tableOptionsContainerResizingObserver.disconnect()
              } catch (e) {}

              tableOptionsContainerResizingObserver = new ResizeObserver(() => {
                try {
                  if (tableOptionsContainer.height() > 35 || isShowBtnShown)
                    throw 0

                  showStandardTableOptionsContainerBtn.show()

                  tableOptionsContainer.hide()

                  isShowBtnShown = true

                  try {
                    tableOptionsContainerResizingObserver.disconnect()
                  } catch (e) {}
                } catch (e) {}
              })

              try {
                tableOptionsContainerResizingObserver.observe(tableOptionsContainer[0])
              } catch (e) {}
            })
          }
        }

        {
          $('textarea#standardTableCommentOption').add('textarea#counterTableCommentOption').on('input', function() {
            try {
              let originalValue = $(this).data('original-value')

              $('a#standardTableCommentOptionUndoChanges').add('a#counterTableCommentOptionUndoChanges').toggleClass('disabled', !(originalValue != $(this).val()))
            } catch (e) {}

            setTimeout(() => {
              try {
                if ($(this).attr('id').includes('standard')) {
                  updateActionStatusForStandardTables()
                } else {
                  updateActionStatusForCounterTables()
                }
              } catch (e) {}
            })
          })

          $('a#standardTableCommentOptionUndoChanges').click(function() {
            let relatedTextarea = $(`textarea#standardTableCommentOption`),
              originalValue = relatedTextarea.data('original-value')

            relatedTextarea.val(originalValue).trigger('input')

            setTimeout(() => {
              try {
                updateActionStatusForStandardTables()
              } catch (e) {}
            })
          })

          $('a#counterTableCommentOptionUndoChanges').click(function() {
            let relatedTextarea = $(`textarea#counterTableCommentOption`),
              originalValue = relatedTextarea.data('original-value')

            relatedTextarea.val(originalValue).trigger('input')

            setTimeout(() => {
              try {
                updateActionStatusForCounterTables()
              } catch (e) {}
            })
          })
        }
      } catch (e) {}
    }, 10000)
  }

  {
    let tippyInstance = [],
      dateTimePickerObject = []

    $('button#insertionTimestampPicker, button#deleteTimestampPicker').click(function(_, isInitProcess = false) {
      try {
        let tippyReference = $(this),
          id = $(this).attr('id')

        if (tippyInstance[id] != null) {
          try {
            tippyInstance[id].enable()
            setTimeout(() => tippyInstance[id].show())
          } catch (e) {}

          try {
            dateTimePickerObject[id].setValue(new Date())
          } catch (e) {}

          throw 0
        }

        let pickerContainerID = getRandom.id(30),
          isDataCleared = false,
          viewMode = 'YMDHMS'

        tippyInstance[id] = tippy(tippyReference[0], {
          content: `<div id="_${pickerContainerID}"></div>`,
          appendTo: () => document.body,
          allowHTML: true,
          arrow: false,
          interactive: true,
          placement: 'top',
          trigger: 'click',
          theme: 'material',
          showOnCreate: false,
          onShow(instance) {
            let popper = $(instance.popper),
              reference = $(instance.reference),
              inputField = reference.parent().parent().find('input'),
              inputObject = getElementMDBObject(inputField)

            if (popper.find('div.row, form').length != 0)
              return

            setTimeout(() => {
              setTimeout(() => $(instance.popper).find('div.tippy-content').addClass('no-padding'))

              setTimeout(() => {
                dateTimePickerObject[id] = $(`div#_${pickerContainerID}`).datetimepicker({
                  date: new Date(),
                  viewMode,
                  onClear: () => {
                    inputField.val('').trigger('input')

                    isDataCleared = true

                    try {
                      inputObject.update()
                      setTimeout(() => inputObject._deactivate())
                    } catch (e) {}
                  },
                  onDateChange: function() {
                    isDataCleared = this.getValue() == null
                  },
                  onOk: function() {
                    try {
                      if (isDataCleared)
                        throw 0

                      let dateTimeValue = this.getText(viewMode == 'YMDHMS' ? 'YYYY-MM-DD HH:mm:ss.i' : (viewMode == 'YMD' ? 'YYYY-MM-DD' : 'HH:mm:ss.i'))

                      try {
                        if (viewMode != 'YMDHMS')
                          throw 0

                        dateTimeValue = new Date(this.getValue()).getTime()
                      } catch (e) {}

                      inputField.val(`${dateTimeValue}`).trigger('input')

                      try {
                        inputObject.update()
                      } catch (e) {}

                    } catch (e) {} finally {
                      try {
                        instance.disable()
                        instance.hide()
                      } catch (e) {}
                    }
                  }
                })
              })
            })

            if (isInitProcess) {
              setTimeout(() => {
                try {
                  instance.disable()
                  instance.hide()
                } catch (e) {}
              })
            }
          },
          onHidden(instance) {
            try {
              instance.disable()
              instance.hide()
            } catch (e) {}
          },
        })
      } catch (e) {}
    })

    setTimeout(() => $('button#insertionTimestampPicker, button#deleteTimestampPicker').trigger('click', true), 3000)

    setTimeout(() => {
      // Point at the list container
      let insertConsistencyLevelsContainers = $(`div.dropdown[for-select="insertWriteConsistencyLevel"] ul.dropdown-menu, div.dropdown[for-select="insertSerialConsistencyLevel"] ul.dropdown-menu`),
        defaultOmittedColumnsValueContainer = $(`div.dropdown[for-select="defaultOmittedColumnsValue"] ul.dropdown-menu`)

      // Once one of the items is clicked
      insertConsistencyLevelsContainers.add(defaultOmittedColumnsValueContainer).find('a').click(function() {
        // Point at the input field related to the list
        let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

        // Update the input's value
        selectElement.val($(this).attr('value')).trigger('input')

        if (selectElement.attr('id') == 'defaultOmittedColumnsValue')
          selectElement.toggleClass('is-invalid', $(this).attr('value') == 'NULL')

        setTimeout(() => {
          try {
            updateActionStatusForInsertRow()
          } catch (e) {}
        })
      })
    })

    $('input#timestampGenerator').on('focus', () => setTimeout(() => {
      $('div.modal#addEditConnectionDialog').find('div.side-right').scrollTop($('div.modal#addEditConnectionDialog').find('div.side-right').height())

      $('#timestampGenerator').closest('div.modal-section').find('ul.dropdown-menu').css('transform', 'translate(0px, -26px)')
    }))

    {
      setTimeout(() => {
        $(`div.dropdown[for-select="timestampGenerator"] ul.dropdown-menu`).find('a').click(function() {
          // Point at the input field related to the list
          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

          // Update the input's value
          selectElement.val($(this).attr('value')).trigger('input')
        })
      })
    }

    $('input#ttl').add($('input#insertionTimestamp')).each(function() {
      let clearField = $(this).parent().parent().find('div.clear-field')

      $(this).on('input', function() {
        try {
          clearField.toggleClass('hide', $(this).val().length <= 0)
        } catch (e) {}

        if ($(this).is($('input#insertionTimestamp')))
          $(this).toggleClass('is-invalid', $(this).val().length > 0 && getCheckedValue('lwtInsertOptions') != 'insertNoSelectOption')

        setTimeout(() => {
          try {
            updateActionStatusForInsertRow()
          } catch (e) {}
        })
      })

      clearField.children('div.btn').click(function() {
        let rlatedInutField = $(this).parent().parent().find('input'),
          inputObject = getElementMDBObject(rlatedInutField)

        try {
          rlatedInutField.val('').trigger('input')
        } catch (e) {}

        try {
          inputObject.update()
          setTimeout(() => inputObject._deactivate())
        } catch (e) {}
      })
    })

    $('input[name="ttlValueType"]').each(function() {
      $(this).on('change input', function() {
        setTimeout(() => {
          try {
            updateActionStatusForInsertRow()
          } catch (e) {}
        })
      })
    })
  }

  {
    let deletionTimestampInput = $('input#deleteTimestamp'),
      clearField = deletionTimestampInput.parent().parent().find('div.clear-field')

    deletionTimestampInput.on('input', function() {
      try {
        clearField.toggleClass('hide', $(this).val().length <= 0)
      } catch (e) {}

      $('#deleteTimestamp').toggleClass('is-invalid', $('#deleteTimestamp').val().length > 0 && getCheckedValue('lwtDeleteOptions') != 'deleteNoSelectOption')

      setTimeout(() => {
        try {
          updateActionStatusForDeleteRowColumn()
        } catch (e) {}
      })
    })

    clearField.children('div.btn').click(function() {
      let rlatedInutField = $(this).parent().parent().find('input'),
        inputObject = getElementMDBObject(rlatedInutField)

      try {
        rlatedInutField.val('').trigger('input')
      } catch (e) {}

      try {
        inputObject.update()
        setTimeout(() => inputObject._deactivate())
      } catch (e) {}
    })

    $('input[type="radio"][name="lwtDeleteOptions"]').on('change', function() {
      $('#deleteTimestamp').attr('disabled', $(this).attr('id') == 'deleteNoSelectOption' ? null : '')

      if ($(this).attr('id') == 'deleteNoSelectOption') {
        $('#rightClickActionsMetadata').find('div[consistency="write"]').removeClass('col-md-6').addClass('col-md-12')

        $('#rightClickActionsMetadata').find('div[consistency="serial"]').hide()
      } else {
        $('#rightClickActionsMetadata').find('div[consistency="write"], div[consistency="serial"]').removeClass('col-md-12').addClass('col-md-6').show()
      }

      setTimeout(() => {
        try {
          updateActionStatusForDeleteRowColumn()
        } catch (e) {}

        $('input#deleteWriteConsistencyLevel').add('#deleteTimestamp').trigger('input')
      })
    })

    let deleteRowColumnAction = $('div[action="delete-row-column"]'),
      sectionsButtons = deleteRowColumnAction.find('div.btn[section]')

    sectionsButtons.click(function() {
      if ($(this).hasClass('active'))
        return

      sectionsButtons.removeClass('active')

      $(this).addClass('active')

      deleteRowColumnAction.children('div[section]').hide()

      let section = $(this).attr('section')

      deleteRowColumnAction.children(`div[section="${section}"]`).show()

      deleteRowColumnAction.find('div.lwt-hint').toggle(section == 'lwt')
    })

    $('input#toBeDeletedColumnsFilter').on('input', function() {
      let filteringText = `${$(this).val()}`,
        deleteNonPKColumns = $('div#tableFieldsNonPKColumnsDeleteAction div.columns').children('div.column.btn')

      if (filteringText.length <= 0) {
        deleteNonPKColumns.show()

        $('#noColumnMatched').hide()
        $('div#tableFieldsNonPKColumnsDeleteAction div.columns').show()

        return
      }

      deleteNonPKColumns.hide()

      let matchedColumns = deleteNonPKColumns.filter(function() {
        return minifyText($(this).text()).includes(filteringText) || $(this).hasClass('deleted')
      })

      $('#noColumnMatched').toggle(matchedColumns.length <= 0)
      $('div#tableFieldsNonPKColumnsDeleteAction div.columns').toggle(matchedColumns.length > 0)

      matchedColumns.show()
    })
  }

  setTimeout(() => {
    try {
      let dialogElement = $(`div.modal#rightClickActionsMetadata`),
        actionEditor = monaco.editor.getEditors().find((editor) => dialogElement.find('div.action-editor div.editor div.monaco-editor').is(editor.getDomNode()))

      let mainFunctionTimeOut

      updateActionStatusForInsertRow = () => {
        try {
          clearTimeout(mainFunctionTimeOut)
        } catch (e) {}

        mainFunctionTimeOut = setTimeout(() => {
          let dialogElement = $('#rightClickActionsMetadata'),
            [
              keyspaceName,
              tableName
            ] = getAttributes(dialogElement, ['data-keyspace-name', 'data-table-name']).map((name) => addDoubleQuotes(name)),
            relatedTreesObjects = {
              primaryKey: $('div#tableFieldsPrimaryKeysTree').jstree(),
              columns: {
                regular: $('div#tableFieldsRegularColumnsTree').jstree(),
                collection: $('div#tableFieldsCollectionColumnsTree').jstree(),
                udt: $('div#tableFieldsUDTColumnsTree').jstree()
              }
            },
            lwtOption = getCheckedValue('lwtInsertOptions'),
            isCounterTable = $('div.modal#rightClickActionsMetadata').attr('data-is-counter-table') == 'true'

          let keyspaceUDTs = []

          try {
            keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts'))).map((udt) => udt.name)
          } catch (e) {}

          let allNodes = dialogElement.find('div[action="insert-row"]').find(`a.jstree-anchor`)

          allNodes.each(function() {
            if ($(this)[0].scrollWidth == $(this).innerWidth() || $(this).find('ul.dropdown-menu.for-insertion-actions').hasClass('show'))
              return

            let widthDifference = Math.abs($(this)[0].scrollWidth - $(this).innerWidth()),
              typeValueSpan = $(this).find('span.type-value'),
              spanWidth = typeValueSpan.outerWidth() - 4

            typeValueSpan.css('width', `${spanWidth - widthDifference}px`).addClass('overflow')
          })

          $(`div[action="insert-row"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).removeClass('invalid')

          let isPrimaryKeyMissingFields = false

          try {
            let primaryKeyAddButtons = $('#tableFieldsPrimaryKeysTree').find('button[action="add-item"]').get()

            for (let addItemBtn of primaryKeyAddButtons) {
              let button = $(addItemBtn),
                relatedNode = button.closest('a.jstree-anchor'),
                hasChildren = relatedTreesObjects.primaryKey.get_node(relatedNode.attr('add-hidden-node')).children_d.length > 0

              if (!hasChildren) {
                isPrimaryKeyMissingFields = true

                relatedNode.addClass('invalid')

                continue
              }

              relatedNode.removeClass('invalid')
            }
          } catch (e) {}

          if ($('#insertionTimestamp').hasClass('is-invalid'))
            $(`div[action="insert-row"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).addClass('invalid')

          try {
            if (allNodes.filter(`:not(.ignored)`).find('.is-invalid:not(.ignore-invalid)').length <= 0 && !isPrimaryKeyMissingFields && !$('#insertionTimestamp').hasClass('is-invalid'))
              throw 0

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

            $(`div[action="insert-row"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).addClass('invalid')

            return
          } catch (e) {}

          let fieldsNames = [],
            fieldsValues = [],
            passedFields = [],
            isInsertionAsJSON = $('#rightClickActionsMetadata').attr('data-as-json') === 'true'

          let handleFieldsPre = (treeObject, mainNodeID = '#') => {
            let relatedFieldsArray = []

            try {
              treeObject.get_node(mainNodeID)
            } catch (e) {
              return relatedFieldsArray
            }

            for (let currentNodeID of treeObject.get_node(mainNodeID).children) {
              let currentNode = $(`a.jstree-anchor[static-id="${currentNodeID}"]`)

              try {
                if (currentNode.length <= 0)
                  currentNode = $(`a.jstree-anchor[id="${currentNodeID}_anchor"]`)
              } catch (e) {}

              let [
                fieldName,
                fieldType,
                isMandatory,
                isMapItem
              ] = getAttributes(currentNode, ['name', 'type', 'mandatory', 'is-map-item']),
                fieldValue = currentNode.find('input'),
                isNULL = false

              // Check if the field is boolean
              if (fieldValue.attr('type') == 'checkbox' && fieldValue.prop('indeterminate'))
                continue

              if (passedFields.includes(currentNodeID))
                continue

              passedFields.push(currentNodeID)

              try {
                fieldValue = fieldValue.attr('type') == 'checkbox' ? fieldValue.prop('checked') : fieldValue.val()
              } catch (e) {}

              // If it's counter column
              try {
                if (fieldType != 'counter')
                  throw 0

                if (isNaN(parseInt(fieldValue)))
                  continue

                let isIncrementProcess = currentNode.find('div.input-group-text.for-counter-value').find('button[action="apply-increment"]').hasClass('selected')

                fieldValue = `${fieldName} ${isIncrementProcess ? '+' : '-'} ${fieldValue}`
              } catch (e) {}

              try {
                isNULL = $(currentNode).find('button[action="apply-null"]').hasClass('applied')
              } catch (e) {}

              let isIgnored = currentNode.hasClass('ignored')

              if (isIgnored || (`${fieldValue}`.length <= 0 && !isNULL))
                continue

              try {
                isMapItem = isMapItem != undefined
              } catch (e) {}

              // Check if the type is collection
              try {
                if (!(['map', 'set', 'list'].some((type) => `${fieldType}`.includes(`${type}<`))) && !isMapItem)
                  throw 0

                let hiddenNodeID = currentNode.attr(isMapItem ? 'id' : 'add-hidden-node')

                relatedFieldsArray.push({
                  name: addDoubleQuotes(fieldName),
                  type: fieldType,
                  value: fieldValue,
                  id: hiddenNodeID,
                  parent: mainNodeID,
                  isMapItem,
                  isNULL
                })

                relatedFieldsArray[hiddenNodeID] = handleFieldsPre(treeObject, hiddenNodeID)

                continue
              } catch (e) {}

              // Check if the type is UDT
              try {
                let manipulatedType = `${fieldType}`

                try {
                  if (`${manipulatedType}`.match(/^frozen</) == null) throw 0;

                  manipulatedType = `${manipulatedType}`.match(/^frozen<(.*?)>$/)[1];
                } catch (e) {}

                try {
                  manipulatedType = `${manipulatedType}`.match(/<(.*?)>$/)[1];
                } catch (e) {}

                if (!(keyspaceUDTs.includes(manipulatedType)))
                  throw 0

                relatedFieldsArray.push({
                  name: addDoubleQuotes(fieldName),
                  type: fieldType,
                  value: fieldValue,
                  id: currentNodeID,
                  parent: mainNodeID,
                  isMapItem,
                  isUDT: true,
                  isNULL
                })

                relatedFieldsArray[currentNodeID] = handleFieldsPre(treeObject, currentNodeID)

                continue
              } catch (e) {}

              // Standard type
              relatedFieldsArray.push({
                name: addDoubleQuotes(fieldName),
                type: fieldType,
                value: fieldValue,
                id: currentNodeID,
                parent: mainNodeID,
                isMapItem,
                isNULL
              })
            }

            return relatedFieldsArray
          }

          let primaryKeyFields = handleFieldsPre(relatedTreesObjects.primaryKey),
            columnsRegularFields = handleFieldsPre(relatedTreesObjects.columns.regular),
            columnsCollectionFields = handleFieldsPre(relatedTreesObjects.columns.collection),
            columnsUDTFields = handleFieldsPre(relatedTreesObjects.columns.udt)

          let handleFieldsPost = (fields, isUDT = false, isCollection = false, parentType = null) => {
            let names = [],
              values = []

            for (let field of fields) {
              try {
                if (['name', 'type', 'value'].every((attribute) => field[attribute] == undefined) && !field.isMapItem)
                  continue

                let value = ''

                // Handle collection type
                try {
                  if (!(['map', 'set', 'list'].some((type) => `${field.type}`.includes(`${type}<`))) && !field.isMapItem)
                    throw 0

                  let items = []

                  // Check if there're no added items
                  try {
                    items = fields[field.id]

                    if (fields[field.id].length <= 0)
                      continue
                  } catch (e) {}

                  let fieldValue = handleFieldsPost(items, false, true, parentType || field.type)

                  try {
                    let isUDTType = false

                    try {
                      isUDTType = fieldValue.values[1].startsWith('{') && fieldValue.values[1].endsWith('}')
                    } catch (e) {}

                    fieldValue = fieldValue.values.join(field.isMapItem ? ': ' : ', ')

                    if (parentType != null && (`${parentType}`.includes(`list<`) || `${parentType}`.includes(`set<`)) && (field.isMapItem || `${field.type}`.includes(`map<`))) {
                      fieldValue = `{${fieldValue}}`
                    } else if (field.parent == '#' || isUDT) {
                      fieldValue = `${field.type}`.includes(`list<`) || (`${field.type}`.includes(`set<`) && isInsertionAsJSON) ? `[${fieldValue}]` : (`${field.type}`.includes(`set<`) || (`${field.type}`.includes(`map<`) && !isUDTType) ? `{${fieldValue}}` : `${fieldValue}`)
                    }
                  } catch (e) {}

                  if (field.parent == '#')
                    names.push(`${field.name}` + (!isInsertionAsJSON ? `, -- ${field.type}` : ''))

                  if (field.parent != '#' && isUDT)
                    names.push(`${field.name}`)

                  values.push(field.isMapItem ? `${fieldValue}` : (`${fieldValue}` + (field.parent == '#' && !isInsertionAsJSON ? `, -- ${field.type}` : '')))

                  continue
                } catch (e) {}

                // Handle UDT type
                try {
                  let manipulatedType = `${field.type}`

                  try {
                    if (`${manipulatedType}`.match(/^frozen</) == null) throw 0;

                    manipulatedType = `${manipulatedType}`.match(/^frozen<(.*?)>$/)[1];
                  } catch (e) {}

                  try {
                    manipulatedType = `${manipulatedType}`.match(/<(.*?)>$/)[1];
                  } catch (e) {}

                  if (!(keyspaceUDTs.includes(manipulatedType)))
                    throw 0

                  let subFields = []

                  // Check if there're no added items
                  try {
                    subFields = fields[field.id]

                    if (fields[field.id].length <= 0)
                      continue
                  } catch (e) {}

                  let fieldValue = handleFieldsPost(subFields, true, false),
                    joinedValue = []

                  try {
                    for (let i = 0; i < fieldValue.names.length; i++) {

                      let subFieldName = addDoubleQuotes(fieldValue.names[i])

                      try {
                        if (!isInsertionAsJSON)
                          throw 0

                        subFieldName = `${subFieldName}`.replace(/"/g, '\\"')

                        subFieldName = `"${subFieldName}"`
                      } catch (e) {}

                      joinedValue.push(`${subFieldName}: ${fieldValue.values[i]}`)
                    }

                    joinedValue = joinedValue.join(', ')

                    joinedValue = `{ ${joinedValue} }`
                  } catch (e) {}

                  if (field.parent == '#')
                    names.push(`${field.name}` + (!isInsertionAsJSON ? `, -- ${field.type}` : ''))

                  if (field.parent != '#' && isUDT)
                    names.push(`${field.name}`)

                  values.push(`${joinedValue}` + (field.parent == '#' && !isInsertionAsJSON ? `, -- ${field.type}` : ''))

                  continue
                } catch (e) {}

                // Standard type
                try {
                  let isSingleQuotesNeeded = false

                  value = `${field.value}`

                  try {
                    if (isInsertionAsJSON && !isCounterTable) {
                      isSingleQuotesNeeded = true
                      throw 0
                    }

                    try {
                      if (['text', 'varchar', 'ascii', 'inet'].some((type) => type == field.type))
                        isSingleQuotesNeeded = true
                    } catch (e) {}

                    try {
                      if (field.type != 'time')
                        throw 0

                      if (IsTimestamp(value)) {
                        try {
                          value = formatTimestamp(parseInt(value), false, true).split(/\s+/)[1]
                        } catch (e) {}
                      }

                      if (ValidateDate(value, 'boolean') || !value.endsWith(')'))
                        isSingleQuotesNeeded = true
                    } catch (e) {}

                    try {
                      if (field.type != 'date')
                        throw 0

                      if (IsTimestamp(value)) {
                        try {
                          value = `toDate(${value})`
                        } catch (e) {}
                      }

                      if (ValidateDate(value, 'boolean') || !value.endsWith(')'))
                        isSingleQuotesNeeded = true
                    } catch (e) {}

                    try {
                      if (field.type != 'timestamp')
                        throw 0

                      if (ValidateDate(value, 'boolean'))
                        value = `toTimestamp('${value}')`
                    } catch (e) {}
                  } catch (e) {}

                  try {
                    if (!isSingleQuotesNeeded)
                      throw 0

                    value = `${value}`.replace(/(^|[^'])'(?!')/g, "$1''")

                    value = isInsertionAsJSON && !isCounterTable ? `"${value}"` : `'${value}'`
                  } catch (e) {}

                  if (field.isNULL)
                    value = !isInsertionAsJSON ? 'NULL' : 'null'

                  if (field.parent == '#' || isUDT)
                    names.push(isUDT ? `${field.name}` : (`${field.name}` + (!isInsertionAsJSON ? `, -- ${field.type}` : '')))

                  values.push(isUDT || isCollection ? `${value}` : (`${value}` + (field.parent == '#' && !isInsertionAsJSON ? `, -- ${field.type}` : '')))
                } catch (e) {}
              } catch (e) {}
            }

            return {
              names,
              values
            }
          }

          if (isCounterTable)
            isInsertionAsJSON = true

          let manipulatedFields = {
            primaryKey: handleFieldsPost(primaryKeyFields),
            columnsRegular: handleFieldsPost(columnsRegularFields),
            columnsCollection: handleFieldsPost(columnsCollectionFields),
            columnsUDT: handleFieldsPost(columnsUDTFields)
          }

          if (isCounterTable)
            isInsertionAsJSON = false

          try {
            clearTimeout(changeFooterButtonsStateTimeout)
          } catch (e) {}

          changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', [...fieldsNames, ...fieldsValues].length <= 0 || isPrimaryKeyMissingFields ? '' : null), 50)

          // Handle counter tables - increment and decrement -
          try {
            if (!isCounterTable)
              throw 0

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', manipulatedFields.columnsRegular.names.length <= 0 || isPrimaryKeyMissingFields ? '' : null), 50)

            fieldsNames = {
              primaryKey: [],
              columns: []
            }

            fieldsValues = {
              primaryKey: [],
              columns: []
            }
          } catch (e) {}

          for (let fieldsClass of Object.keys(manipulatedFields)) {
            let fields = manipulatedFields[fieldsClass]

            if (!isCounterTable) {
              fieldsNames = fieldsNames.concat(fields.names)
              fieldsValues = fieldsValues.concat(fields.values)
            } else {
              fieldsNames[fieldsClass == 'primaryKey' ? 'primaryKey' : 'columns'] = fieldsNames[fieldsClass == 'primaryKey' ? 'primaryKey' : 'columns'].concat(fields.names)
              fieldsValues[fieldsClass == 'primaryKey' ? 'primaryKey' : 'columns'] = fieldsValues[fieldsClass == 'primaryKey' ? 'primaryKey' : 'columns'].concat(fields.values)
            }
          }

          let fields = []

          try {
            if (!isCounterTable && isInsertionAsJSON) {
              fieldsNames = fieldsNames.map((name) => {
                name = addDoubleQuotes(name)

                try {
                  name = `${name}`.replace(/"/g, '\\"')
                } catch (e) {}

                return `"${name}"`
              })

              for (let i = 0; i < fieldsNames.length; i++) {
                let fieldName = fieldsNames[i],
                  fieldValue = fieldsValues[i]

                fields.push(`${fieldName}: ${fieldValue}`)
              }

              fields = fields.map((field) => `    ${field}`).join(`,` + OS.EOL)


              throw 0
            }

            try {
              if (isCounterTable)
                throw 0

              let lastFieldName = fieldsNames.at(-1)

              fieldsNames[fieldsNames.length - 1] = `${lastFieldName.substring(0, lastFieldName.lastIndexOf(', --'))} --${lastFieldName.substring(lastFieldName.lastIndexOf(', --') + 4)}`
            } catch (e) {}

            try {
              if (isCounterTable)
                throw 0

              let lastFieldValue = fieldsValues.at(-1)

              fieldsValues[fieldsValues.length - 1] = `${lastFieldValue.substring(0, lastFieldValue.lastIndexOf(', --'))} --${lastFieldValue.substring(lastFieldValue.lastIndexOf(', --') + 4)}`
            } catch (e) {}

            try {
              if (!isCounterTable)
                fieldsNames = fieldsNames.map((name) => `    ${name}`).join(OS.EOL)
            } catch (e) {}

            try {
              if (!isCounterTable)
                fieldsValues = fieldsValues.map((value) => `    ${value}`).join(OS.EOL)
            } catch (e) {}
          } catch (e) {}

          let columns = [],
            primaryKey = []

          try {
            if (!isCounterTable)
              throw 0

            columns = fieldsNames.columns.map((column, index) => `${column} = ${fieldsValues.columns[index]}`).join(', ')

            primaryKey = fieldsNames.primaryKey.map((key, index) => `${key} = ${fieldsValues.primaryKey[index]}`).join(' AND ')
          } catch (e) {}

          // Extra options
          let extraOptions = '',
            // Get consistency level
            writeConsistencyLevel = '',
            serialConsistencyLevel = ''

          // TTL
          try {
            let ttlValue = $('#ttl').val(),
              ttlValueType = getCheckedValue('ttlValueType'),
              multipliers = {
                ms: 1,
                s: 1000,
                m: 60000,
                h: 3600000,
                d: 86400000
              }

            if (`${ttlValue}`.length <= 0)
              throw 0

            try {
              ttlValue = parseInt(ttlValue) * (multipliers[ttlValueType] || 1)
            } catch (e) {}

            if (isNaN(ttlValue))
              throw 0

            extraOptions = `TTL ${ttlValue}`
          } catch (e) {}

          // Data insertion timestamp
          try {
            if (lwtOption != 'insertNoSelectOption')
              throw 0

            let insertionTimestamp = $('#insertionTimestamp').val()

            if (`${insertionTimestamp}`.length <= 0)
              throw 0

            let insertionTimestampTxt = `TIMESTAMP ${insertionTimestamp}`

            extraOptions = `${extraOptions}` + (extraOptions.length <= 0 ? '' : ' AND ') + insertionTimestampTxt
          } catch (e) {}

          if (extraOptions.length != 0)
            extraOptions = ` USING ${extraOptions}`

          if (lwtOption != 'insertNoSelectOption')
            extraOptions = ` IF NOT EXISTS${extraOptions}`

          try {
            let writeLevel = $('#insertWriteConsistencyLevel').val()

            writeConsistencyLevel = `CONSISTENCY ${writeLevel};`

            if (writeLevel == activeSessionsConsistencyLevels[activeConnectionID].standard)
              writeConsistencyLevel = `-- ${writeConsistencyLevel} Note: CQL session already using this CL`

            writeConsistencyLevel = `${writeConsistencyLevel}` + OS.EOL
          } catch (e) {}

          try {
            if (lwtOption == 'insertNoSelectOption')
              throw 0

            let serialLevel = $('#insertSerialConsistencyLevel').val()

            serialConsistencyLevel = `SERIAL CONSISTENCY ${serialLevel};`

            if (serialLevel == activeSessionsConsistencyLevels[activeConnectionID].serial)
              serialConsistencyLevel = `-- ${serialConsistencyLevel} Note: CQL session already using this CL`

            serialConsistencyLevel = `${serialConsistencyLevel}` + OS.EOL
          } catch (e) {}

          let statement =
            `${writeConsistencyLevel}${serialConsistencyLevel}` +
            `INSERT INTO ${keyspaceName}.${tableName} (` + OS.EOL +
            `${fieldsNames}` + OS.EOL + `) VALUES (` + OS.EOL +
            `${fieldsValues}` + OS.EOL + `)${extraOptions};`

          if (isInsertionAsJSON && !isCounterTable) {
            try {
              extraOptions = ` DEFAULT ${$('input#defaultOmittedColumnsValue').val()}${extraOptions}`
            } catch (e) {}

            statement = `${writeConsistencyLevel}${serialConsistencyLevel}` +
              `INSERT INTO ${keyspaceName}.${tableName} JSON '{` + OS.EOL +
              `${fields}` + OS.EOL +
              `}'${extraOptions};`
          }

          if (isCounterTable)
            statement = `${writeConsistencyLevel}${serialConsistencyLevel}` +
            `UPDATE ${keyspaceName}.${tableName}` + OS.EOL + `SET ${columns}` + OS.EOL + `WHERE ${primaryKey}${extraOptions};`

          try {
            actionEditor.setValue(statement)
          } catch (e) {}
        }, 250)
      }

      setTimeout(() => {
        // Point at the list container
        let consistencyLevelsContainer = $(`div.dropdown[for-select="deleteWriteConsistencyLevel"] ul.dropdown-menu, div.dropdown[for-select="deleteSerialConsistencyLevel"] ul.dropdown-menu`)

        // Once one of the items is clicked
        consistencyLevelsContainer.find('a').click(function() {
          // Point at the input field related to the list
          let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

          // Update the input's value
          selectElement.val($(this).attr('value')).trigger('input')

          setTimeout(() => {
            try {
              updateActionStatusForDeleteRowColumn()
            } catch (e) {}
          })
        })
      })

      updateActionStatusForDeleteRowColumn = () => {
        try {
          clearTimeout(mainFunctionTimeOut)
        } catch (e) {}

        mainFunctionTimeOut = setTimeout(() => {
          let dialogElement = $('#rightClickActionsMetadata'),
            [
              keyspaceName,
              tableName
            ] = getAttributes(dialogElement, ['data-keyspace-name', 'data-table-name']).map((name) => addDoubleQuotes(name)),
            relatedTreesObjects = {
              primaryKey: $('div#tableFieldsPrimaryKeyTreeDeleteAction').jstree(),
              columns: {
                regular: $('div#tableFieldsRegularColumnsTreeDeleteAction').jstree(),
                collection: $('div#tableFieldsCollectionColumnsTreeDeleteAction').jstree(),
                udt: $('div#tableFieldsUDTColumnsTreeDeleteAction').jstree()
              }
            },
            lwtOption = getCheckedValue('lwtDeleteOptions')

          let keyspaceUDTs = []

          try {
            keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts'))).map((udt) => udt.name)
          } catch (e) {}

          let allNodes = dialogElement.find('div[action="delete-row-column"]').find(`a.jstree-anchor`)

          allNodes.each(function() {
            if ($(this)[0].scrollWidth == $(this).innerWidth() || $(this).find('ul.dropdown-menu.for-insertion-actions').hasClass('show'))
              return

            let widthDifference = Math.abs($(this)[0].scrollWidth - $(this).innerWidth()),
              typeValueSpan = $(this).find('span.type-value'),
              spanWidth = typeValueSpan.outerWidth() - 4

            typeValueSpan.css('width', `${spanWidth - widthDifference}px`).addClass('overflow')
          })

          $(`div[action="delete-row-column"]`).find('div.in-operator-error').hide()
          $(`div[action="delete-row-column"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).removeClass('invalid')

          /**
           * By looping through each node, the node is enabled based on specific conditions
           * Start with the primary key
           */
          let isPreviousKeyInvalid = {
              partition: false,
              clustering: false
            },
            handleKeyField = (field, disabled = true) => {
              $(field).toggleClass('unavailable', disabled)
              $(field).find('input:not([type="radio"])').toggleClass('disabled', disabled)
              let buttonsAndInputAreas = $(field).find('.btn, div.focus-area')
              $(field).find('div[data-is-main-input="true"]').toggleClass('disabled', disabled)
              buttonsAndInputAreas.toggleClass('disabled', disabled)
              buttonsAndInputAreas.attr('disabled', disabled ? '' : null)

              $(`a.jstree-anchor[id="${field.attr('add-hidden-node')}_anchor"]`).attr('is-hidden-node', 'true')

              if ($(field).attr('is-collection-type') == 'true')
                $(field).find('.is-invalid').removeClass('is-invalid')
            },
            getAllChildrenInOrder = (treeObjectName, childID = '#') => {
              let children = [],
                relatedTreeObject = typeof treeObjectName == 'string' ? relatedTreesObjects[treeObjectName] : relatedTreesObjects[treeObjectName[0]][treeObjectName[1]]

              let node = relatedTreeObject.get_node(childID)

              if (childID != '#')
                children.push(childID)

              for (let _childID of node.children)
                children = children.concat(getAllChildrenInOrder(treeObjectName, _childID))

              return children
            },
            allPrimaryKeyFields = getAllChildrenInOrder('primaryKey').map((childID) => {
              return {
                id: childID,
                element: $(`a.jstree-anchor[static-id="${childID}"]`)
              }
            }),
            checkFieldIsParititon = (fieldID, parentID, lastCheck = false, lastParentID = null) => {
              let isFieldPartition = $(`a.jstree-anchor[static-id="${fieldID}"]`).attr('partition') == 'true',
                fieldParentID = relatedTreesObjects.primaryKey.get_parent(fieldID)

              lastCheck = isFieldPartition

              try {
                if (fieldParentID != '#' || isFieldPartition)
                  throw 0

                let parentNode = allPrimaryKeyFields.find((field) => field.element.attr('add-hidden-node') == lastParentID)

                if (parentNode == undefined)
                  parentNode = allPrimaryKeyFields.find((field) => field.id == lastParentID)

                if (parentNode == undefined)
                  throw 0

                return parentNode.element.attr('partition') == 'true'
              } catch (e) {}

              lastParentID = fieldParentID

              if (isFieldPartition)
                return lastCheck

              return checkFieldIsParititon(fieldParentID, relatedTreesObjects.primaryKey.get_parent(fieldParentID), lastCheck, lastParentID)
            },
            allPartitionKeysValidationStatus = [],
            allClusteringKeysValidationStatus = []

          // For clustering key(s)
          let arePrecedingColumnsWithEquOp = true

          for (let primaryKeyField of allPrimaryKeyFields) {
            let field = primaryKeyField.element

            if (field.length <= 0 || field.attr('is-hidden-node') == 'true')
              continue

            let isFieldPartition = checkFieldIsParititon(primaryKeyField.id, '#', false)

            // Partition key(s)
            try {
              if (!isFieldPartition)
                throw 0

              handleKeyField(field, isPreviousKeyInvalid.partition)

              let doesFieldHasChildren = false,
                isINOperatorChecked = field.find('div.btn-group.operators').find(`input[type="radio"]`).filter(':checked').attr('id') == '_operator_in' || field.attr('is-collection-type') == 'true'

              doesFieldHasChildren = isINOperatorChecked

              try {
                if (!isINOperatorChecked)
                  throw 0

                let relatedHiddenNodeChildrenLength = relatedTreesObjects.primaryKey.get_node(field.attr('add-hidden-node')).children_d.length

                doesFieldHasChildren = relatedHiddenNodeChildrenLength > 0
              } catch (e) {}

              isPreviousKeyInvalid.partition = (field.find('.is-invalid:not(.ignore-invalid):not([type="radio"])').length > 0 && !field.hasClass('unavailable')) || field.hasClass('unavailable')

              field.toggleClass('invalid', isINOperatorChecked && !doesFieldHasChildren && !field.hasClass('unavailable'))

              if (isINOperatorChecked)
                isPreviousKeyInvalid.partition = !doesFieldHasChildren || field.hasClass('unavailable')

              allPartitionKeysValidationStatus.push(isPreviousKeyInvalid.partition)

              continue
            } catch (e) {}

            // For the first clustering key
            if (allPartitionKeysValidationStatus.includes(true)) {
              handleKeyField(field, true)

              continue
            }

            let operatorsDropDown = field.find('input.operators-dropdown').attr('id')

            if (operatorsDropDown != undefined)
              operatorsDropDown = field.find(`div.dropdown[for-select="${operatorsDropDown}"]`)

            let fieldCheckedOperator = getCheckedValue(field.find('div.btn-group.operators').find('input[type="radio"]').attr('name'))

            if (arePrecedingColumnsWithEquOp) {
              field.find('div.btn-group.operators').find('label.btn').removeClass('disabled')

              try {
                operatorsDropDown.find('a.dropdown-item').removeClass('disabled')
              } catch (e) {}

              field.removeClass('invalid')

              arePrecedingColumnsWithEquOp = fieldCheckedOperator == '_operator_equal'
            } else {
              setTimeout(() => field.find('div.btn-group.operators').find('label.btn').filter(':not([for="_operator_equal"])').addClass('disabled'))

              setTimeout(() => {
                try {
                  operatorsDropDown.find('a.dropdown-item').filter(':not([data-operator-id="_operator_equal"])').addClass('disabled')
                } catch (e) {}
              })

              field.toggleClass('invalid', fieldCheckedOperator != '_operator_equal')
            }

            if (fieldCheckedOperator == '')
              field.removeClass('invalid')

            let isLVL1InvalidKeywordFound = `${isPreviousKeyInvalid.clustering}` == 'LVL1'

            if (isLVL1InvalidKeywordFound) {
              if (relatedTreesObjects.primaryKey.is_leaf(field.id)) {
                isPreviousKeyInvalid.clustering = false
              } else {
                isPreviousKeyInvalid.clustering = true
              }
            }

            try {
              handleKeyField(field, isPreviousKeyInvalid.clustering)

              let doesFieldHasChildren = false,
                isINOperatorChecked = field.find('div.btn-group.operators').find(`input[type="radio"]`).filter(':checked').attr('id') == '_operator_in' || field.attr('is-collection-type') == 'true'

              doesFieldHasChildren = isINOperatorChecked

              try {
                if (!isINOperatorChecked)
                  throw 0

                let relatedHiddenNodeChildrenLength = relatedTreesObjects.primaryKey.get_node(field.attr('add-hidden-node')).children_d.length

                doesFieldHasChildren = relatedHiddenNodeChildrenLength > 0
              } catch (e) {}

              isPreviousKeyInvalid.clustering = (field.find('.is-invalid:not(.ignore-invalid):not([type="radio"])').length > 0 && !field.hasClass('unavailable')) || field.hasClass('unavailable') || field.hasClass('invalid')

              if (isINOperatorChecked)
                isPreviousKeyInvalid.clustering = !doesFieldHasChildren || field.hasClass('unavailable') || field.hasClass('invalid')
            } catch (e) {}

            if ((fieldCheckedOperator == '_operator_in' || isLVL1InvalidKeywordFound) && !field.hasClass('invalid'))
              isPreviousKeyInvalid.clustering = 'LVL1'

            if (fieldCheckedOperator != '_operator_equal' && isPreviousKeyInvalid.clustering != 'LVL1')
              isPreviousKeyInvalid.clustering = true

            allClusteringKeysValidationStatus.push(isPreviousKeyInvalid.clustering != false)
          }

          relatedTreesObjects = {
            primaryKey: $('div#tableFieldsPrimaryKeyTreeDeleteAction').jstree(),
            columns: {
              regular: $('div#tableFieldsRegularColumnsTreeDeleteAction').jstree(),
              collection: $('div#tableFieldsCollectionColumnsTreeDeleteAction').jstree(),
              udt: $('div#tableFieldsUDTColumnsTreeDeleteAction').jstree()
            }
          }

          let allColumns = [...getAllChildrenInOrder(['columns', 'regular']), ...getAllChildrenInOrder(['columns', 'collection']), ...getAllChildrenInOrder(['columns', 'udt'])].map((childID) => {
            return {
              id: childID,
              element: $(`a.jstree-anchor[static-id="${childID}"]`)
            }
          })

          for (let column of allColumns) {
            let field = column.element

            if (field.length <= 0 || field.attr('is-hidden-node') == 'true')
              continue

            if ([...allClusteringKeysValidationStatus, ...allPartitionKeysValidationStatus].includes(true)) {
              handleKeyField(field, true)

              continue
            }

            handleKeyField(field, lwtOption != 'deleteIfColumnOption')
          }

          $(`div[action="delete-row-column"] div.types-of-transactions div.sections div.section div.btn`).removeClass('invalid')

          $('div#non-pk-columns-warning').toggle([...allPartitionKeysValidationStatus, ...allClusteringKeysValidationStatus].includes(true))

          try {
            let allInvalidNodes = allNodes.filter(`:not(.ignored):not(.unavailable)`)

            allInvalidNodes = allInvalidNodes.filter(function() {
              let mainInput = $(this).find('.is-invalid:not(.ignore-invalid):not([type="radio"]):not(.is-empty)'),
                isINOperatorChecked = $(this).find('input[id="_operator_in"]:checked')

              return $(this).hasClass('invalid') || (mainInput.length != 0 && isINOperatorChecked.length <= 0)
            })

            if (allInvalidNodes.length <= 0 && !$('#deleteTimestamp').hasClass('is-invalid'))
              throw 0

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

            for (let invalidNode of allInvalidNodes) {
              try {
                $(`div[action="delete-row-column"] div.types-of-transactions div.sections div.section div.btn[section="${$(invalidNode).closest('div[section]').attr('section')}"]`).addClass('invalid')
              } catch (e) {}
            }

            if ($('#deleteTimestamp').hasClass('is-invalid'))
              $(`div[action="delete-row-column"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).addClass('invalid')

            return
          } catch (e) {}

          let fieldsNames = [],
            fieldsValues = [],
            passedFields = [],
            isInsertionAsJSON = $('#rightClickActionsMetadata').attr('data-as-json') === 'true'

          let handleFieldsPre = (treeObject, mainNodeID = '#') => {
            let relatedFieldsArray = []

            try {
              treeObject.get_node(mainNodeID)
            } catch (e) {
              return relatedFieldsArray
            }

            for (let currentNodeID of treeObject.get_node(mainNodeID).children) {
              try {
                let currentNode = $(`a.jstree-anchor[static-id="${currentNodeID}"]`)

                try {
                  if (currentNode.length <= 0)
                    currentNode = $(`a.jstree-anchor[id="${currentNodeID}_anchor"]`)
                } catch (e) {}

                let [
                  fieldName,
                  fieldType,
                  isMandatory,
                  isMapItem
                ] = getAttributes(currentNode, ['name', 'type', 'mandatory', 'is-map-item']),
                  fieldValue = currentNode.find('input').last(),
                  isNULL = false,
                  fieldOperator = currentNode.find('input[type="radio"]:checked').attr('id'),
                  isColumnToBeDeleted = currentNode.hasClass('deleted'),
                  isColumnIgnored = fieldValue.hasClass('is-empty') || currentNode.hasClass('unavailable'),
                  isPartition = currentNode.attr('partition') == 'true'

                // Check if the field is boolean
                if (fieldValue.attr('type') == 'checkbox' && fieldValue.prop('indeterminate'))
                  continue

                if (passedFields.includes(currentNodeID))
                  continue

                passedFields.push(currentNodeID)

                try {
                  fieldValue = fieldValue.attr('type') == 'checkbox' ? fieldValue.prop('checked') : fieldValue.val()
                } catch (e) {}

                try {
                  isNULL = $(currentNode).find('button[action="apply-null"]').hasClass('applied')
                } catch (e) {}

                let isIgnored = currentNode.hasClass('ignored')

                if ((isIgnored || (`${fieldValue}`.length <= 0 && !isNULL && fieldOperator != '_operator_in')) && !isColumnToBeDeleted)
                  continue

                try {
                  isMapItem = isMapItem != undefined
                } catch (e) {}

                // Check if the type is collection
                try {
                  if (!(['map', 'set', 'list'].some((type) => `${fieldType}`.includes(`${type}<`))) && !isMapItem && fieldOperator != '_operator_in')
                    throw 0

                  let hiddenNodeID = currentNode.attr(isMapItem ? 'id' : 'add-hidden-node')

                  relatedFieldsArray.push({
                    name: addDoubleQuotes(fieldName),
                    type: fieldType,
                    value: fieldValue,
                    id: hiddenNodeID,
                    parent: mainNodeID,
                    fieldOperator,
                    isPartition,
                    isMapItem,
                    isDeleted: isColumnToBeDeleted,
                    isIgnored: isColumnIgnored,
                    isNULL
                  })

                  relatedFieldsArray[hiddenNodeID] = handleFieldsPre(treeObject, hiddenNodeID)

                  continue
                } catch (e) {}

                // Check if the type is UDT
                try {
                  let manipulatedType = `${fieldType}`

                  try {
                    if (`${manipulatedType}`.match(/^frozen</) == null) throw 0;

                    manipulatedType = `${manipulatedType}`.match(/^frozen<(.*?)>$/)[1];
                  } catch (e) {}

                  try {
                    manipulatedType = `${manipulatedType}`.match(/<(.*?)>$/)[1];
                  } catch (e) {}

                  if (!(keyspaceUDTs.includes(manipulatedType)))
                    throw 0

                  relatedFieldsArray.push({
                    name: addDoubleQuotes(fieldName),
                    type: fieldType,
                    value: fieldValue,
                    id: currentNodeID,
                    parent: mainNodeID,
                    fieldOperator,
                    isPartition,
                    isDeleted: isColumnToBeDeleted,
                    isIgnored: isColumnIgnored,
                    isMapItem,
                    isUDT: true,
                    isNULL
                  })

                  relatedFieldsArray[currentNodeID] = handleFieldsPre(treeObject, currentNodeID)

                  continue
                } catch (e) {}

                // Standard type
                relatedFieldsArray.push({
                  name: addDoubleQuotes(fieldName),
                  type: fieldType,
                  value: fieldValue,
                  id: currentNodeID,
                  parent: mainNodeID,
                  fieldOperator,
                  isPartition,
                  isDeleted: isColumnToBeDeleted,
                  isIgnored: isColumnIgnored,
                  isMapItem,
                  isNULL
                })

              } catch (e) {}
            }

            return relatedFieldsArray
          }

          // Start with the primary key
          let primaryKeyFields = handleFieldsPre(relatedTreesObjects.primaryKey),
            columnsRegularFields = handleFieldsPre(relatedTreesObjects.columns.regular),
            columnsCollectionFields = handleFieldsPre(relatedTreesObjects.columns.collection),
            columnsUDTFields = handleFieldsPre(relatedTreesObjects.columns.udt)

          let isNonEqualityOpFound = false

          // Check if any column has an operator rather than equal
          try {
            isNonEqualityOpFound = primaryKeyFields.some((primaryKey) => {
              let _isNonEqualityOpFound = false

              if (!primaryKey.isPartition)
                return _isNonEqualityOpFound

              try {
                _isNonEqualityOpFound = primaryKey.fieldOperator != undefined && primaryKey.fieldOperator != '_operator_equal'
              } catch (e) {}

              return _isNonEqualityOpFound
            })
          } catch (e) {}

          try {
            if (!isNonEqualityOpFound || ([...columnsRegularFields, ...columnsCollectionFields, ...columnsUDTFields]).find((column) => column.fieldOperator != undefined) == undefined)
              throw 0

            if (lwtOption == 'deleteNoSelectOption')
              throw 0

            $(`div[action="delete-row-column"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).addClass('invalid')

            $(`div[action="delete-row-column"]`).find('div.in-operator-error').show()

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

            return
          } catch (e) {}

          let getOperatorSymbol = (operator) => {
            let symbol = '='

            switch (operator) {
              case '_operator_in':
                symbol = 'IN'
                break;

              case '_operator_less_than':
                symbol = '<'
                break;

              case '_operator_greater_than':
                symbol = '>'
                break;

              case '_operator_less_than_equal':
                symbol = '<='
                break;

              case '_operator_greater_than_equal':
                symbol = '>='
                break;
            }

            return symbol
          }

          let handleFieldsPost = (fields, isUDT = false, isCollection = false, parentType = null) => {
            let names = [],
              values = [],
              isInsertionAsJSON = true

            for (let field of fields) {
              try {
                if (field.parent == '#')
                  field.fieldOperator = field.fieldOperator || '_operator_equal'
              } catch (e) {}

              try {
                if (field.fieldOperator == '_operator_in')
                  field.type = `set<${field.type}>`
              } catch (e) {}

              let finalFieldName = `${field.name}`

              try {
                if (field.fieldOperator != undefined)
                  finalFieldName = `${field.name} ${getOperatorSymbol(field.fieldOperator)}`
              } catch (e) {}

              try {
                if ((['name', 'type', 'value'].every((attribute) => field[attribute] == undefined) && !field.isMapItem))
                  continue

                let value = ''

                // Handle collection type - and `IN` operator -
                try {
                  if (!(['map', 'set', 'list'].some((type) => `${field.type}`.includes(`${type}<`))) && !field.isMapItem)
                    throw 0

                  let items = []

                  // Check if there're no added items
                  try {
                    items = fields[field.id]

                    if (fields[field.id].length <= 0)
                      continue
                  } catch (e) {}

                  let fieldValue = handleFieldsPost(items, false, true, parentType || field.type)

                  try {
                    let isUDTType = false

                    try {
                      isUDTType = fieldValue.values[1].startsWith('{') && fieldValue.values[1].endsWith('}')
                    } catch (e) {}

                    fieldValue = fieldValue.values.join(field.isMapItem ? ': ' : ', ')

                    if (parentType != null && (`${parentType}`.includes(`list<`) || `${parentType}`.includes(`set<`)) && (field.isMapItem || `${field.type}`.includes(`map<`))) {
                      fieldValue = `{${fieldValue}}`
                    } else if (field.parent == '#' || isUDT) {
                      fieldValue = `${field.type}`.includes(`list<`) || (`${field.type}`.includes(`set<`) && isInsertionAsJSON) ? (field.fieldOperator != '_operator_in' ? `[${fieldValue}]` : `(${fieldValue})`) : (`${field.type}`.includes(`set<`) || (`${field.type}`.includes(`map<`) && !isUDTType) ? `{${fieldValue}}` : `${fieldValue}`)
                    }
                  } catch (e) {}

                  if (fieldValue == '{  }')
                    continue

                  if (field.parent == '#')
                    names.push(`${finalFieldName}` + (!isInsertionAsJSON ? `, -- ${field.type}` : ''))

                  if (field.parent != '#' && isUDT)
                    names.push(`${finalFieldName}`)

                  values.push(field.isMapItem ? `${fieldValue}` : (`${fieldValue}` + (field.parent == '#' && !isInsertionAsJSON ? `, -- ${field.type}` : '')))

                  continue
                } catch (e) {}

                // Handle UDT type
                try {
                  let manipulatedType = `${field.type}`

                  try {
                    if (`${manipulatedType}`.match(/^frozen</) == null) throw 0;

                    manipulatedType = `${manipulatedType}`.match(/^frozen<(.*?)>$/)[1];
                  } catch (e) {}

                  try {
                    manipulatedType = `${manipulatedType}`.match(/<(.*?)>$/)[1];
                  } catch (e) {}

                  if (!(keyspaceUDTs.includes(manipulatedType)))
                    throw 0

                  let subFields = []

                  // Check if there're no added items
                  try {
                    subFields = fields[field.id]

                    if (fields[field.id].length <= 0)
                      continue
                  } catch (e) {}

                  let fieldValue = handleFieldsPost(subFields, true, false),
                    joinedValue = []

                  try {
                    for (let i = 0; i < fieldValue.names.length; i++) {

                      let subFieldName = addDoubleQuotes(fieldValue.names[i])

                      joinedValue.push(`${subFieldName}: ${fieldValue.values[i]}`)
                    }

                    joinedValue = joinedValue.join(', ')

                    joinedValue = `{ ${joinedValue} }`
                  } catch (e) {}

                  if (joinedValue == '{  }')
                    continue

                  if (field.parent == '#')
                    names.push(`${finalFieldName}` + (!isInsertionAsJSON ? `, -- ${field.type}` : ''))

                  if (field.parent != '#' && isUDT)
                    names.push(`${finalFieldName}`)

                  values.push(`${joinedValue}` + (field.parent == '#' && !isInsertionAsJSON ? `, -- ${field.type}` : ''))

                  continue
                } catch (e) {}

                // Standard type
                try {
                  let isSingleQuotesNeeded = false

                  value = `${field.value}`

                  try {
                    try {
                      if (['text', 'varchar', 'ascii', 'inet'].some((type) => type == field.type))
                        isSingleQuotesNeeded = true
                    } catch (e) {}

                    try {
                      if (field.type != 'time')
                        throw 0

                      if (IsTimestamp(value)) {
                        try {
                          value = formatTimestamp(parseInt(value), false, true).split(/\s+/)[1]
                        } catch (e) {}
                      }

                      if (ValidateDate(value, 'boolean') || !value.endsWith(')'))
                        isSingleQuotesNeeded = true
                    } catch (e) {}

                    try {
                      if (field.type != 'date')
                        throw 0

                      if (IsTimestamp(value)) {
                        try {
                          value = `toDate(${value})`
                        } catch (e) {}
                      }

                      if (ValidateDate(value, 'boolean') || !value.endsWith(')'))
                        isSingleQuotesNeeded = true
                    } catch (e) {}

                    try {
                      if (field.type != 'timestamp')
                        throw 0

                      if (ValidateDate(value, 'boolean'))
                        value = `toTimestamp('${value}')`
                    } catch (e) {}
                  } catch (e) {}

                  try {
                    if (!isSingleQuotesNeeded)
                      throw 0

                    value = `${value}`.replace(/(^|[^'])'(?!')/g, "$1''")

                    value = `'${value}'`
                  } catch (e) {}

                  if (field.isNULL)
                    value = 'NULL'

                  if (field.parent == '#' || isUDT)
                    names.push(isUDT ? `${finalFieldName}` : (`${finalFieldName}` + (!isInsertionAsJSON ? `, -- ${field.type}` : '')))

                  values.push(isUDT || isCollection ? `${value}` : (`${value}` + (field.parent == '#' && !isInsertionAsJSON ? `, -- ${field.type}` : '')))
                } catch (e) {}
              } catch (e) {}
            }

            return {
              names,
              values
            }
          }

          let deletedColumns = '',
            usingTimestamp = '',
            primaryKey = '',
            otherFields = ''

          // Get deleted columns
          try {
            deletedColumns = [...columnsRegularFields, ...columnsCollectionFields, ...columnsUDTFields].filter((column) => column.isDeleted)

            deletedColumns = (deletedColumns.map((column) => `${addDoubleQuotes(column.name)}`)).join(', ')

            if (deletedColumns.length != 0)
              deletedColumns = ` ${deletedColumns}`
          } catch (e) {}

          let manipulatedFields = {
            primaryKey: handleFieldsPost(primaryKeyFields),
            allNonPKColumns: {
              regular: handleFieldsPost(columnsRegularFields),
              collection: handleFieldsPost(columnsCollectionFields),
              udt: handleFieldsPost(columnsUDTFields)
            }
          }

          try {
            let temp = []

            for (let i = 0; i < manipulatedFields.primaryKey.names.length; i++)
              temp.push(`${manipulatedFields.primaryKey.names[i]} ${manipulatedFields.primaryKey.values[i]}`)

            primaryKey = temp.join(' AND ')
          } catch (e) {}

          try {
            let temp = []

            for (let nonPKColumns of Object.keys(manipulatedFields.allNonPKColumns)) {
              for (let i = 0; i < manipulatedFields.allNonPKColumns[nonPKColumns].names.length; i++) {
                let name = manipulatedFields.allNonPKColumns[nonPKColumns].names[i],
                  value = manipulatedFields.allNonPKColumns[nonPKColumns].values[i]

                if ([name, value].some((attribute) => `${attribute}` == 'undefined'))
                  continue

                temp.push(`${name} ${value}`)
              }
            }

            otherFields = temp.join(' AND ')
          } catch (e) {}

          if (otherFields.length != 0)
            otherFields = OS.EOL + `IF ${otherFields}`

          switch (lwtOption) {
            case 'deleteIfExistsOption':
              otherFields = OS.EOL + `IF EXISTS`
              break
            case 'deleteNoSelectOption':
              otherFields = ''
              break
          }

          // Using timestamp
          try {
            if (lwtOption != 'deleteNoSelectOption')
              throw 0

            let timestamp = parseInt($('#deleteTimestamp').val())

            if (`${timestamp}`.length <= 0 || isNaN(timestamp))
              throw 0

            usingTimestamp = `USING TIMESTAMP ${timestamp}` + OS.EOL
          } catch (e) {}

          // Check if `IF EXISTS` is checked
          try {
            if (!$('#deleteIfExistsOption').prop('checked'))
              throw 0

            otherFields = OS.EOL + `IF EXISTS`
          } catch (e) {}

          // Get consistency level
          let writeConsistencyLevel = '',
            serialConsistencyLevel = ''

          try {
            let writeLevel = $('#deleteWriteConsistencyLevel').val()

            writeConsistencyLevel = `CONSISTENCY ${writeLevel};`

            if (writeLevel == activeSessionsConsistencyLevels[activeConnectionID].standard)
              writeConsistencyLevel = `-- ${writeConsistencyLevel} Note: CQL session already using this CL`

            writeConsistencyLevel = `${writeConsistencyLevel}` + OS.EOL
          } catch (e) {}

          try {
            if (lwtOption == 'deleteNoSelectOption')
              throw 0

            let serialLevel = $('#deleteSerialConsistencyLevel').val()

            serialConsistencyLevel = `SERIAL CONSISTENCY ${serialLevel};`

            if (serialLevel == activeSessionsConsistencyLevels[activeConnectionID].serial)
              serialConsistencyLevel = `-- ${serialConsistencyLevel} Note: CQL session already using this CL`

            serialConsistencyLevel = `${serialConsistencyLevel}` + OS.EOL
          } catch (e) {}

          try {
            clearTimeout(changeFooterButtonsStateTimeout)
          } catch (e) {}

          changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

          let statement = `${writeConsistencyLevel}${serialConsistencyLevel}DELETE${deletedColumns} FROM ${keyspaceName}.${tableName}` + OS.EOL + `${usingTimestamp}WHERE ${primaryKey}${otherFields};`

          try {
            actionEditor.setValue(statement)
          } catch (e) {}

        })
      }

      setTimeout(() => {
        for (let action of ['delete', 'insert']) {
          $(`input#${action}WriteConsistencyLevel`).add(`input#${action}SerialConsistencyLevel`).on('input', () => {
            let lwtOption = getCheckedValue(action == 'delete' ? 'lwtDeleteOptions' : 'lwtInsertOptions')

            if (lwtOption == `${action}NoSelectOption`) {
              $(`div.consistency-level-warning-${action}`).hide()
              return
            }

            let warningTxt = '',
              writeConsistencyLevel = $(`input#${action}WriteConsistencyLevel`).val(),
              serialConsistencyLevel = $(`input#${action}SerialConsistencyLevel`).val()

            if (writeConsistencyLevel == 'EACH_QUORUM' && serialConsistencyLevel == 'LOCAL_SERIAL')
              warningTxt = `Cross-DC inconsistency risk: Writes enforce global quorum (EACH_QUORUM) but LWT checks only local DC state (LOCAL_SERIAL). This may cause cross-DC inconsistencies`

            if (writeConsistencyLevel == 'LOCAL_QUORUM' && serialConsistencyLevel == 'SERIAL')
              warningTxt = `Protocol mismatch: Local writes (LOCAL_QUORUM) cannot satisfy global LWT requirements (SERIAL)`

            if (writeConsistencyLevel == 'ANY' && serialConsistencyLevel != 'NOT SET')
              warningTxt = `Atomicity violation: Hinted handoffs (ANY) prevent guaranteed transaction isolation`

            if (writeConsistencyLevel == 'ONE' && serialConsistencyLevel == 'SERIAL')
              warningTxt = `Insufficient replication: Single-replica writes (ONE) cannot support global LWT consensus (SERIAL)`

            if (writeConsistencyLevel == 'ALL' && serialConsistencyLevel == 'LOCAL_SERIAL')
              warningTxt = `Resource conflict: Full replication (ALL) requirement negates localized LWT benefits (LOCAL_SERIAL)`

            $(`div.consistency-level-warning-${action}`).toggle(warningTxt.length > 0)

            $(`div.consistency-level-warning-${action} span`).html(warningTxt)
          })
        }
      })

      $('input[type="radio"][name="lwtInsertOptions"]').on('change', function() {
        $('#insertionTimestamp').attr('disabled', $(this).attr('id') == 'insertNoSelectOption' ? null : '')

        if ($(this).attr('id') == 'insertNoSelectOption') {
          $('#rightClickActionsMetadata').find('div[insert-consistency="write"]').removeClass('col-md-6').addClass('col-md-12')

          $('#rightClickActionsMetadata').find('div[insert-consistency="serial"]').hide()
        } else {
          $('#rightClickActionsMetadata').find('div[insert-consistency="write"], div[insert-consistency="serial"]').removeClass('col-md-12').addClass('col-md-6').show()
        }

        setTimeout(() => {
          try {
            updateActionStatusForInsertRow()
          } catch (e) {}

          $('input#insertWriteConsistencyLevel').add($('#insertionTimestamp')).trigger('input')
        })
      })
    } catch (e) {}
  }, 10000)

  {
    let insertRowAction = $('div[action="insert-row"]'),
      sectionsButtons = insertRowAction.find('div.btn[section]')

    sectionsButtons.click(function() {
      if ($(this).hasClass('active'))
        return

      sectionsButtons.removeClass('active')

      $(this).addClass('active')

      insertRowAction.children('div[section]').hide()

      let section = $(this).attr('section')

      insertRowAction.children(`div[section="${section}"]`).show()

      insertRowAction.find('div.lwt-hint-insert').toggle(section == 'lwt')
    })
  }

  {
    setTimeout(() => {
      try {
        let dialogElement = $('#rightClickActionsMetadata'),
          actionEditor = monaco.editor.getEditors().find((editor) => dialogElement.find('div.action-editor div.editor div.monaco-editor').is(editor.getDomNode())),
          mainFunctionTimeOut

        updateActionStatusForSelectRowColumn = (returnPrimaryKey = false) => {
          try {
            clearTimeout(mainFunctionTimeOut)
          } catch (e) {}

          mainFunctionTimeOut = setTimeout(() => {
            let [
              keyspaceName,
              tableName
            ] = getAttributes(dialogElement, ['data-keyspace-name', 'data-table-name']).map((name) => addDoubleQuotes(name)),
              relatedTreesObjects = {
                primaryKey: $('div#tableFieldsPrimaryKeyTreeSelectAction').jstree(),
                columns: {
                  regular: $('div#tableFieldsRegularColumnsTreeSelectAction').jstree(),
                  collection: $('div#tableFieldsCollectionColumnsTreeSelectAction').jstree(),
                  udt: $('div#tableFieldsUDTColumnsTreeSelectAction').jstree()
                }
              },
              allowFilteringOptions = getCheckedValue('selectAllowFilteringOptions')

            let keyspaceUDTs = []

            try {
              keyspaceUDTs = JSON.parse(JSONRepair($(dialogElement).attr('data-keyspace-udts'))).map((udt) => udt.name)
            } catch (e) {}

            let allNodes = dialogElement.find('div[action="select-row"]').find(`a.jstree-anchor`)

            allNodes.each(function() {
              if ($(this)[0].scrollWidth == $(this).innerWidth() || $(this).find('ul.dropdown-menu.for-insertion-actions, ul.dropdown-menu.for-aggregate-functions').hasClass('show'))
                return

              let widthDifference = Math.abs($(this)[0].scrollWidth - $(this).innerWidth()),
                typeValueSpan = $(this).find('span.type-value'),
                spanWidth = typeValueSpan.outerWidth() - 4

              typeValueSpan.css('width', `${spanWidth - widthDifference}px`).addClass('overflow')
            })

            $(`div[action="select-row"]`).find('div.in-operator-error').hide()
            $(`div[action="select-row"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).removeClass('invalid')

            /**
             * By looping through each node, the node is enabled based on specific conditions
             * Start with the primary key
             */
            let isPreviousKeyInvalid = {
                partition: false,
                clustering: false
              },
              isPreviousOrderButtonActive = false,
              isFirstClusteringKeyOrderEnabled = false,
              handleKeyField = (field, disabled = true) => {
                $(field).toggleClass('unavailable', disabled)
                $(field).find('input:not([type="radio"])').toggleClass('disabled', disabled)
                let buttonsAndInputAreas = $(field).find('.btn, div.focus-area')
                $(field).find('div[data-is-main-input="true"]').toggleClass('disabled', disabled)
                buttonsAndInputAreas.filter(':not(.column-order-type):not(.aggregate-functions-btn)').toggleClass('disabled', disabled)
                buttonsAndInputAreas.filter(':not(.column-order-type):not(.aggregate-functions-btn)').attr('disabled', disabled ? '' : null)

                $(`a.jstree-anchor[id="${field.attr('add-hidden-node')}_anchor"]`).attr('is-hidden-node', 'true')

                if ($(field).attr('is-collection-type') == 'true')
                  $(field).find('.is-invalid').removeClass('is-invalid')
              },
              getAllChildrenInOrder = (treeObjectName, childID = '#') => {
                let children = [],
                  relatedTreeObject = typeof treeObjectName == 'string' ? relatedTreesObjects[treeObjectName] : relatedTreesObjects[treeObjectName[0]][treeObjectName[1]]

                let node = relatedTreeObject.get_node(childID)

                if (childID != '#')
                  children.push(childID)

                for (let _childID of node.children)
                  children = children.concat(getAllChildrenInOrder(treeObjectName, _childID))

                return children
              },
              allPrimaryKeyFields = getAllChildrenInOrder('primaryKey').map((childID) => {
                return {
                  id: childID,
                  element: $(`a.jstree-anchor[static-id="${childID}"]`)
                }
              }),
              checkFieldIsParititon = (fieldID, parentID, lastCheck = false, lastParentID = null) => {
                let isFieldPartition = $(`a.jstree-anchor[static-id="${fieldID}"]`).attr('partition') == 'true',
                  fieldParentID = relatedTreesObjects.primaryKey.get_parent(fieldID)

                lastCheck = isFieldPartition

                try {
                  if (fieldParentID != '#' || isFieldPartition)
                    throw 0

                  let parentNode = allPrimaryKeyFields.find((field) => field.element.attr('add-hidden-node') == lastParentID)

                  if (parentNode == undefined)
                    parentNode = allPrimaryKeyFields.find((field) => field.id == lastParentID)

                  if (parentNode == undefined)
                    throw 0

                  return parentNode.element.attr('partition') == 'true'
                } catch (e) {}

                lastParentID = fieldParentID

                if (isFieldPartition)
                  return lastCheck

                return checkFieldIsParititon(fieldParentID, relatedTreesObjects.primaryKey.get_parent(fieldParentID), lastCheck, lastParentID)
              },
              allPartitionKeysValidationStatus = [],
              allClusteringKeysValidationStatus = []

            // For clustering key(s)
            let arePrecedingColumnsWithEquOp = true

            try {
              if (!returnPrimaryKey)
                throw 0

              let allPrimaryKeyFieldsToBeReturned = allPrimaryKeyFields.filter((primaryKeyField) => {
                let field = primaryKeyField.element,
                  isFieldPartition = checkFieldIsParititon(primaryKeyField.id, '#', false)

                return !(field.length <= 0 || field.attr('is-hidden-node') == 'true' || isFieldPartition)
              })

              return allPrimaryKeyFieldsToBeReturned
            } catch (e) {}

            for (let primaryKeyField of allPrimaryKeyFields) {
              let field = primaryKeyField.element,
                isColumnInvalidDueToOrder = field.hasClass('invalid-order')

              if (field.length <= 0 || field.attr('is-hidden-node') == 'true')
                continue

              let isFieldPartition = checkFieldIsParititon(primaryKeyField.id, '#', false)

              // Partition key
              try {
                if (!isFieldPartition)
                  throw 0

                handleKeyField(field, isPreviousKeyInvalid.partition && allowFilteringOptions != 'selectAllowFilteringEnableOption')

                let doesFieldHasChildren = false,
                  isINOperatorChecked = field.find('div.btn-group.operators').find(`input[type="radio"]`).filter(':checked').attr('id') == '_operator_in' || field.attr('is-collection-type') == 'true'

                doesFieldHasChildren = isINOperatorChecked

                try {
                  if (!isINOperatorChecked)
                    throw 0

                  let relatedHiddenNodeChildrenLength = relatedTreesObjects.primaryKey.get_node(field.attr('add-hidden-node')).children_d.length

                  doesFieldHasChildren = relatedHiddenNodeChildrenLength > 0
                } catch (e) {}

                isPreviousKeyInvalid.partition = (field.find('.is-invalid:not(.ignore-invalid):not([type="radio"])').length > 0 && !field.hasClass('unavailable')) || field.hasClass('unavailable')

                field.toggleClass('invalid', isINOperatorChecked && !doesFieldHasChildren && !field.hasClass('unavailable'))

                if (isINOperatorChecked)
                  isPreviousKeyInvalid.partition = !doesFieldHasChildren || field.hasClass('unavailable')

                allPartitionKeysValidationStatus.push(isPreviousKeyInvalid.partition)

                continue
              } catch (e) {}

              let orderingBtn = field.find('button.column-order-type'),
                disablingCondition = ((isPreviousKeyInvalid.clustering && isFirstClusteringKeyOrderEnabled) || isPreviousKeyInvalid.partition) && !isPreviousOrderButtonActive

              // Here for clustering key(s)
              orderingBtn.attr('disabled', disablingCondition ? '' : null).toggleClass('disabled', disablingCondition)

              if (orderingBtn.hasClass('active-order') && orderingBtn.hasClass('disabled'))
                orderingBtn.removeClass('active-order')

              isFirstClusteringKeyOrderEnabled = true

              isPreviousOrderButtonActive = orderingBtn.hasClass('active-order') && !orderingBtn.hasClass('disabled')

              // For the first clustering key
              if (allPartitionKeysValidationStatus.includes(true)) {
                handleKeyField(field, true && allowFilteringOptions != 'selectAllowFilteringEnableOption')

                continue
              }

              try {
                let operatorsDropDown = field.find('input.operators-dropdown').attr('id')

                if (operatorsDropDown != undefined)
                  operatorsDropDown = field.find(`div.dropdown[for-select="${operatorsDropDown}"]`)

                let fieldCheckedOperator = getCheckedValue(field.find('div.btn-group.operators').find('input[type="radio"]').attr('name'))

                if (arePrecedingColumnsWithEquOp) {
                  field.find('div.btn-group.operators').find('label.btn').removeClass('disabled')

                  try {
                    operatorsDropDown.find('a.dropdown-item').removeClass('disabled')
                  } catch (e) {}

                  if (!isColumnInvalidDueToOrder)
                    field.removeClass('invalid')

                  arePrecedingColumnsWithEquOp = fieldCheckedOperator == '_operator_equal'
                } else {
                  setTimeout(() => field.find('div.btn-group.operators').find('label.btn').filter(':not([for="_operator_equal"])').addClass('disabled'))

                  setTimeout(() => {
                    try {
                      operatorsDropDown.find('a.dropdown-item').filter(':not([data-operator-id="_operator_equal"])').addClass('disabled')
                    } catch (e) {}
                  })

                  if (!isColumnInvalidDueToOrder)
                    field.toggleClass('invalid', fieldCheckedOperator != '_operator_equal')
                }
              } catch (e) {}

              try {
                handleKeyField(field, isPreviousKeyInvalid.clustering && allowFilteringOptions != 'selectAllowFilteringEnableOption')

                let doesFieldHasChildren = false,
                  isINOperatorChecked = field.find('div.btn-group.operators').find(`input[type="radio"]`).filter(':checked').attr('id') == '_operator_in' || field.attr('is-collection-type') == 'true',
                  isOrderByButtonActive = false

                doesFieldHasChildren = isINOperatorChecked

                try {
                  if (!isINOperatorChecked)
                    throw 0

                  let relatedHiddenNodeChildrenLength = relatedTreesObjects.primaryKey.get_node(field.attr('add-hidden-node')).children_d.length

                  doesFieldHasChildren = relatedHiddenNodeChildrenLength > 0
                } catch (e) {}

                isPreviousKeyInvalid.clustering = (field.find('.is-invalid:not(.ignore-invalid):not([type="radio"])').length > 0 && !field.hasClass('unavailable')) || field.hasClass('unavailable')

                if (!isColumnInvalidDueToOrder)
                  field.toggleClass('invalid', isINOperatorChecked && !doesFieldHasChildren && !field.hasClass('unavailable'))

                if (isINOperatorChecked)
                  isPreviousKeyInvalid.clustering = !doesFieldHasChildren || field.hasClass('unavailable')

                allClusteringKeysValidationStatus.push(isPreviousKeyInvalid.clustering)

                continue
              } catch (e) {}
            }

            relatedTreesObjects = {
              primaryKey: $('div#tableFieldsPrimaryKeyTreeSelectAction').jstree(),
              columns: {
                regular: $('div#tableFieldsRegularColumnsTreeSelectAction').jstree(),
                collection: $('div#tableFieldsCollectionColumnsTreeSelectAction').jstree(),
                udt: $('div#tableFieldsUDTColumnsTreeSelectAction').jstree()
              }
            }

            let allColumns = [...getAllChildrenInOrder(['columns', 'regular']), ...getAllChildrenInOrder(['columns', 'collection']), ...getAllChildrenInOrder(['columns', 'udt'])].map((childID) => {
              return {
                id: childID,
                element: $(`a.jstree-anchor[static-id="${childID}"]`)
              }
            })

            $('div#no-pk-columns-warning-select').toggle(!allPartitionKeysValidationStatus.includes(false))

            for (let column of allColumns) {
              let field = column.element

              if (field.length <= 0 || field.attr('is-hidden-node') == 'true')
                continue

              // if ([...allClusteringKeysValidationStatus, ...allPartitionKeysValidationStatus].includes(true)) {
              //   handleKeyField(field, true)
              //
              //   continue
              // }

              handleKeyField(field, allowFilteringOptions != 'selectAllowFilteringEnableOption')
            }

            $(`div[action="select-row"] div.types-of-transactions div.sections div.section div.btn`).removeClass('invalid')

            $('div#non-pk-columns-warning').toggle([...allPartitionKeysValidationStatus, ...allClusteringKeysValidationStatus].includes(true))

            try {
              let allInvalidNodes = allNodes.filter(`:not(.ignored):not(.unavailable)`)

              allInvalidNodes = allInvalidNodes.filter(function() {
                let mainInput = $(this).find('.is-invalid:not(.ignore-invalid):not([type="radio"]):not(.is-empty)'),
                  isINOperatorChecked = $(this).find('input[id="_operator_in"]:checked')

                return $(this).hasClass('invalid') || (mainInput.length != 0 && isINOperatorChecked.length <= 0)
              })

              if (allInvalidNodes.length <= 0)
                throw 0

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

              for (let invalidNode of allInvalidNodes) {
                try {
                  $(`div[action="select-row"] div.types-of-transactions div.sections div.section div.btn[section="${$(invalidNode).closest('div[section]').attr('section')}"]`).addClass('invalid')
                } catch (e) {}
              }

              return
            } catch (e) {}

            let fieldsNames = [],
              fieldsValues = [],
              passedFields = [],
              isSelectionAsJSON = $('#rightClickActionsMetadata').attr('data-select-as-json') === 'true'

            let handleFieldsPre = (treeObject, mainNodeID = '#') => {
              let relatedFieldsArray = []

              try {
                treeObject.get_node(mainNodeID)
              } catch (e) {
                return relatedFieldsArray
              }

              for (let currentNodeID of treeObject.get_node(mainNodeID).children) {
                try {
                  let currentNode = $(`a.jstree-anchor[static-id="${currentNodeID}"]`)

                  try {
                    if (currentNode.length <= 0)
                      currentNode = $(`a.jstree-anchor[id="${currentNodeID}_anchor"]`)
                  } catch (e) {}

                  let [
                    fieldName,
                    fieldType,
                    isMandatory,
                    isMapItem
                  ] = getAttributes(currentNode, ['name', 'type', 'mandatory', 'is-map-item']),
                    fieldValue = currentNode.find('input').last(),
                    isNULL = false,
                    fieldOperator = currentNode.find('input[type="radio"]:checked').attr('id'),
                    isColumnToBeSelectd = currentNode.hasClass('selected'),
                    isColumnIgnored = fieldValue.hasClass('is-empty') || currentNode.hasClass('unavailable'),
                    isPartition = currentNode.attr('partition') == 'true'

                  // Check if the field is boolean
                  if (fieldValue.attr('type') == 'checkbox' && fieldValue.prop('indeterminate'))
                    continue

                  if (passedFields.includes(currentNodeID))
                    continue

                  passedFields.push(currentNodeID)

                  try {
                    fieldValue = fieldValue.attr('type') == 'checkbox' ? fieldValue.prop('checked') : fieldValue.val()
                  } catch (e) {}

                  try {
                    isNULL = $(currentNode).find('button[action="apply-null"]').hasClass('applied')
                  } catch (e) {}

                  let isIgnored = currentNode.hasClass('ignored')

                  if ((isIgnored || (`${fieldValue}`.length <= 0 && !isNULL && fieldOperator != '_operator_in')) && !isColumnToBeSelectd)
                    continue

                  try {
                    isMapItem = isMapItem != undefined
                  } catch (e) {}

                  // Check if the type is collection
                  try {
                    if (!(['map', 'set', 'list'].some((type) => `${fieldType}`.includes(`${type}<`))) && !isMapItem && fieldOperator != '_operator_in')
                      throw 0

                    let hiddenNodeID = currentNode.attr(isMapItem ? 'id' : 'add-hidden-node')

                    relatedFieldsArray.push({
                      name: addDoubleQuotes(fieldName),
                      type: fieldType,
                      value: fieldValue,
                      id: hiddenNodeID,
                      parent: mainNodeID,
                      fieldOperator,
                      isPartition,
                      isMapItem,
                      isSelectd: isColumnToBeSelectd,
                      isIgnored: isColumnIgnored,
                      isNULL
                    })

                    relatedFieldsArray[hiddenNodeID] = handleFieldsPre(treeObject, hiddenNodeID)

                    continue
                  } catch (e) {}

                  // Check if the type is UDT
                  try {
                    let manipulatedType = `${fieldType}`

                    try {
                      if (`${manipulatedType}`.match(/^frozen</) == null) throw 0;

                      manipulatedType = `${manipulatedType}`.match(/^frozen<(.*?)>$/)[1];
                    } catch (e) {}

                    try {
                      manipulatedType = `${manipulatedType}`.match(/<(.*?)>$/)[1];
                    } catch (e) {}

                    if (!(keyspaceUDTs.includes(manipulatedType)))
                      throw 0

                    relatedFieldsArray.push({
                      name: addDoubleQuotes(fieldName),
                      type: fieldType,
                      value: fieldValue,
                      id: currentNodeID,
                      parent: mainNodeID,
                      fieldOperator,
                      isPartition,
                      isSelectd: isColumnToBeSelectd,
                      isIgnored: isColumnIgnored,
                      isMapItem,
                      isUDT: true,
                      isNULL
                    })

                    relatedFieldsArray[currentNodeID] = handleFieldsPre(treeObject, currentNodeID)

                    continue
                  } catch (e) {}

                  // Standard type
                  relatedFieldsArray.push({
                    name: addDoubleQuotes(fieldName),
                    type: fieldType,
                    value: fieldValue,
                    id: currentNodeID,
                    parent: mainNodeID,
                    fieldOperator,
                    isPartition,
                    isSelectd: isColumnToBeSelectd,
                    isIgnored: isColumnIgnored,
                    isMapItem,
                    isNULL
                  })

                } catch (e) {}
              }

              return relatedFieldsArray
            }

            // Start with the primary key
            let primaryKeyFields = handleFieldsPre(relatedTreesObjects.primaryKey),
              columnsRegularFields = handleFieldsPre(relatedTreesObjects.columns.regular),
              columnsCollectionFields = handleFieldsPre(relatedTreesObjects.columns.collection),
              columnsUDTFields = handleFieldsPre(relatedTreesObjects.columns.udt)

            let allColumnsWithPK = [...primaryKeyFields, ...columnsRegularFields, ...columnsCollectionFields, ...columnsUDTFields],
              isExecutionWithoutColumnAllowed = !(allColumnsWithPK.some((column) => column.name != undefined && column.type != undefined))

            let isNonEqualityOpFound = false

            // Check if any column has an operator rather than equal
            try {
              isNonEqualityOpFound = primaryKeyFields.some((primaryKey) => {
                let _isNonEqualityOpFound = false

                if (!primaryKey.isPartition)
                  return _isNonEqualityOpFound

                try {
                  _isNonEqualityOpFound = primaryKey.fieldOperator != undefined && primaryKey.fieldOperator != '_operator_equal'
                } catch (e) {}

                return _isNonEqualityOpFound
              })
            } catch (e) {}

            try {
              if (!isNonEqualityOpFound || ([...columnsRegularFields, ...columnsCollectionFields, ...columnsUDTFields]).find((column) => column.fieldOperator != undefined) == undefined || isExecutionWithoutColumnAllowed)
                throw 0

              if (allowFilteringOptions == 'selectAllowFilteringNoSelectOption')
                throw 0

              $(`div[action="select-row"] div.types-of-transactions div.sections div.section div.btn[section="standard"]`).addClass('invalid')

              $(`div[action="select-row"]`).find('div.in-operator-error').show()

              try {
                clearTimeout(changeFooterButtonsStateTimeout)
              } catch (e) {}

              changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', ''), 50)

              return
            } catch (e) {}

            let getOperatorSymbol = (operator) => {
              let symbol = '='

              switch (operator) {
                case '_operator_in':
                  symbol = 'IN'
                  break;

                case '_operator_less_than':
                  symbol = '<'
                  break;

                case '_operator_greater_than':
                  symbol = '>'
                  break;

                case '_operator_less_than_equal':
                  symbol = '<='
                  break;

                case '_operator_greater_than_equal':
                  symbol = '>='
                  break;
              }

              return symbol
            }

            let handleFieldsPost = (fields, isUDT = false, isCollection = false, parentType = null) => {
              let names = [],
                values = []

              for (let field of fields) {
                try {
                  if (field.parent == '#')
                    field.fieldOperator = field.fieldOperator || '_operator_equal'
                } catch (e) {}

                try {
                  if (field.fieldOperator == '_operator_in')
                    field.type = `set<${field.type}>`
                } catch (e) {}

                let finalFieldName = `${field.name}`

                try {
                  if (field.fieldOperator != undefined)
                    finalFieldName = `${field.name} ${getOperatorSymbol(field.fieldOperator)}`
                } catch (e) {}

                try {
                  if ((['name', 'type', 'value'].every((attribute) => field[attribute] == undefined) && !field.isMapItem))
                    continue

                  let value = ''

                  // Handle collection type - and `IN` operator -
                  try {
                    if (!(['map', 'set', 'list'].some((type) => `${field.type}`.includes(`${type}<`))) && !field.isMapItem)
                      throw 0

                    let items = []

                    // Check if there're no added items
                    try {
                      items = fields[field.id]

                      if (fields[field.id].length <= 0)
                        continue
                    } catch (e) {}

                    let fieldValue = handleFieldsPost(items, false, true, parentType || field.type)

                    try {
                      let isUDTType = false

                      try {
                        isUDTType = fieldValue.values[1].startsWith('{') && fieldValue.values[1].endsWith('}')
                      } catch (e) {}

                      fieldValue = fieldValue.values.join(field.isMapItem ? ': ' : ', ')

                      if (parentType != null && (`${parentType}`.includes(`list<`) || `${parentType}`.includes(`set<`)) && (field.isMapItem || `${field.type}`.includes(`map<`))) {
                        fieldValue = `{${fieldValue}}`
                      } else if (field.parent == '#' || isUDT) {
                        fieldValue = `${field.type}`.includes(`list<`) || (`${field.type}`.includes(`set<`) && true) ? (field.fieldOperator != '_operator_in' ? `[${fieldValue}]` : `(${fieldValue})`) : (`${field.type}`.includes(`set<`) || (`${field.type}`.includes(`map<`) && !isUDTType) ? `{${fieldValue}}` : `${fieldValue}`)
                      }
                    } catch (e) {}

                    if (fieldValue == '{  }')
                      continue

                    if (field.parent == '#')
                      names.push(`${finalFieldName}` + (!true ? `, -- ${field.type}` : ''))

                    if (field.parent != '#' && isUDT)
                      names.push(`${finalFieldName}`)

                    values.push(field.isMapItem ? `${fieldValue}` : (`${fieldValue}` + (field.parent == '#' && !true ? `, -- ${field.type}` : '')))

                    continue
                  } catch (e) {}

                  // Handle UDT type
                  try {
                    let manipulatedType = `${field.type}`

                    try {
                      if (`${manipulatedType}`.match(/^frozen</) == null) throw 0;

                      manipulatedType = `${manipulatedType}`.match(/^frozen<(.*?)>$/)[1];
                    } catch (e) {}

                    try {
                      manipulatedType = `${manipulatedType}`.match(/<(.*?)>$/)[1];
                    } catch (e) {}

                    if (!(keyspaceUDTs.includes(manipulatedType)))
                      throw 0

                    let subFields = []

                    // Check if there're no added items
                    try {
                      subFields = fields[field.id]

                      if (fields[field.id].length <= 0)
                        continue
                    } catch (e) {}

                    let fieldValue = handleFieldsPost(subFields, true, false),
                      joinedValue = []

                    try {
                      for (let i = 0; i < fieldValue.names.length; i++) {

                        let subFieldName = addDoubleQuotes(fieldValue.names[i])

                        joinedValue.push(`${subFieldName}: ${fieldValue.values[i]}`)
                      }

                      joinedValue = joinedValue.join(', ')

                      joinedValue = `{ ${joinedValue} }`
                    } catch (e) {}

                    if (joinedValue == '{  }')
                      continue

                    if (field.parent == '#')
                      names.push(`${finalFieldName}` + (!true ? `, -- ${field.type}` : ''))

                    if (field.parent != '#' && isUDT)
                      names.push(`${finalFieldName}`)

                    values.push(`${joinedValue}` + (field.parent == '#' && !true ? `, -- ${field.type}` : ''))

                    continue
                  } catch (e) {}

                  // Standard type
                  try {
                    let isSingleQuotesNeeded = false

                    value = `${field.value}`

                    try {
                      try {
                        if (['text', 'varchar', 'ascii', 'inet'].some((type) => type == field.type))
                          isSingleQuotesNeeded = true
                      } catch (e) {}

                      try {
                        if (field.type != 'time')
                          throw 0

                        if (IsTimestamp(value)) {
                          try {
                            value = formatTimestamp(parseInt(value), false, true).split(/\s+/)[1]
                          } catch (e) {}
                        }

                        if (ValidateDate(value, 'boolean') || !value.endsWith(')'))
                          isSingleQuotesNeeded = true
                      } catch (e) {}

                      try {
                        if (field.type != 'date')
                          throw 0

                        if (IsTimestamp(value)) {
                          try {
                            value = `toDate(${value})`
                          } catch (e) {}
                        }

                        if (ValidateDate(value, 'boolean') || !value.endsWith(')'))
                          isSingleQuotesNeeded = true
                      } catch (e) {}

                      try {
                        if (field.type != 'timestamp')
                          throw 0

                        if (ValidateDate(value, 'boolean'))
                          value = `toTimestamp('${value}')`
                      } catch (e) {}
                    } catch (e) {}

                    try {
                      if (!isSingleQuotesNeeded)
                        throw 0

                      value = `${value}`.replace(/(^|[^'])'(?!')/g, "$1''")

                      value = `'${value}'`
                    } catch (e) {}

                    if (field.isNULL)
                      value = 'NULL'

                    if (field.parent == '#' || isUDT)
                      names.push(isUDT ? `${finalFieldName}` : (`${finalFieldName}` + (!true ? `, -- ${field.type}` : '')))

                    values.push(isUDT || isCollection ? `${value}` : (`${value}` + (field.parent == '#' && !true ? `, -- ${field.type}` : '')))
                  } catch (e) {}
                } catch (e) {}
              }

              return {
                names,
                values
              }
            }

            let selectedColumns = '',
              primaryKey = '',
              otherFields = ''

            let manipulatedFields = {
              primaryKey: handleFieldsPost(primaryKeyFields),
              allNonPKColumns: {
                regular: handleFieldsPost(columnsRegularFields),
                collection: handleFieldsPost(columnsCollectionFields),
                udt: handleFieldsPost(columnsUDTFields)
              }
            }

            try {
              let temp = []

              for (let i = 0; i < manipulatedFields.primaryKey.names.length; i++)
                temp.push(`${manipulatedFields.primaryKey.names[i]} ${manipulatedFields.primaryKey.values[i]}`)

              primaryKey = temp.join(' AND ')
            } catch (e) {}

            try {
              let temp = []

              for (let nonPKColumns of Object.keys(manipulatedFields.allNonPKColumns)) {
                for (let i = 0; i < manipulatedFields.allNonPKColumns[nonPKColumns].names.length; i++) {
                  let name = manipulatedFields.allNonPKColumns[nonPKColumns].names[i],
                    value = manipulatedFields.allNonPKColumns[nonPKColumns].values[i]

                  if ([name, value].some((attribute) => `${attribute}` == 'undefined'))
                    continue

                  temp.push(`${name} ${value}`)
                }
              }

              otherFields = temp.join(' AND ')
            } catch (e) {}

            // Check if `IF EXISTS` is checked
            let allowFiltering = ''

            try {
              if (!$('#selectAllowFilteringEnableOption').prop('checked'))
                throw 0

              allowFiltering = ` ALLOW FILTERING`
            } catch (e) {}

            // Get selected columns
            try {
              let selectedColumnsElements = $('div#tableFieldsNonPKColumnsSelectAction').children('div.columns').children('div.column.selected').get()

              if (selectedColumnsElements.length <= 0)
                throw 0

              selectedColumns = ' ' + selectedColumnsElements.map((column) => `${addDoubleQuotes($(column).attr('data-name'))}`).join(', ')
            } catch (e) {}

            let countAggregateFunction = ''

            try {
              countAggregateFunction = $('input#selectAggregateFunctions').val()

              if (countAggregateFunction.length <= 0)
                throw 0

              countAggregateFunction = `${countAggregateFunction}(*)`

              if (selectedColumns.length != 0) {
                countAggregateFunction = `, ${countAggregateFunction}`
              } else {
                countAggregateFunction = ` ${countAggregateFunction}`
              }
            } catch (e) {}

            let columnsAggregateFunctions = ''

            try {
              let allAggregationFunctionsBtns = allNodes.find('button.aggregate-functions-btn').filter(function() {
                return ($(this).data('aggregateFunctions') || []).length != 0
              })

              if (allAggregationFunctionsBtns.length <= 0)
                throw 0

              for (let aggregationFunctionsBtn of allAggregationFunctionsBtns.get()) {
                let columnName = $(aggregationFunctionsBtn).attr('data-column-name'),
                  temp = $(aggregationFunctionsBtn).data('aggregateFunctions').map((func) => `${func}(${addDoubleQuotes(columnName)})`).join(', ')

                columnsAggregateFunctions = `${columnsAggregateFunctions}${columnsAggregateFunctions.length > 0 ? ', ' : ''}${temp}`
              }

              if (`${selectedColumns}${countAggregateFunction}`.length > 0) {
                columnsAggregateFunctions = `, ${columnsAggregateFunctions}`
              } else {
                columnsAggregateFunctions = ` ${columnsAggregateFunctions}`
              }
            } catch (e) {}

            let orderByClusteringColumns = ''

            try {
              let allOrderByClusteringColumnsBtns = $('div#tableFieldsPrimaryKeyTreeSelectAction').find('button.column-order-type.active-order')

              if (allOrderByClusteringColumnsBtns.length <= 0)
                throw 0

              orderByClusteringColumns = `ORDER BY `,
                tempArray = [],
                isErrorFound = false

              for (let orderByClusteringColumnBtn of allOrderByClusteringColumnsBtns.get()) {
                if ($(orderByClusteringColumnBtn).closest('a.jstree-anchor').hasClass('invalid-order')) {
                  isErrorFound = true

                  break
                }

                temp = `${addDoubleQuotes($(orderByClusteringColumnBtn).attr('data-column-name'))} ${$(orderByClusteringColumnBtn).attr('data-current-order').toUpperCase()}`

                tempArray.push(temp)
              }

              orderByClusteringColumns = `${orderByClusteringColumns}${tempArray.join(', ')}`

              if (isErrorFound) {
                orderByClusteringColumns = ''

                throw 0
              }

              if (`${primaryKey}${otherFields}`.length != 0)
                orderByClusteringColumns = ` ${orderByClusteringColumns}`
            } catch (e) {}

            let limit = ''

            try {
              let setLimit = parseInt($('input#select-limit').val())

              if (isNaN(setLimit) || setLimit <= 0)
                throw 0

              limit = ` LIMIT ${setLimit}`

              if (allowFiltering.length != 0)
                limit = `${limit} `
            } catch (e) {}

            try {
              clearTimeout(changeFooterButtonsStateTimeout)
            } catch (e) {}

            changeFooterButtonsStateTimeout = setTimeout(() => dialogElement.find('button.switch-editor').add($('#executeActionStatement')).attr('disabled', null), 50)

            let selectionPart = `${selectedColumns}${countAggregateFunction}${columnsAggregateFunctions}`

            if (selectionPart.length <= 0)
              selectionPart = ' *'

            if (`${primaryKey}`.length > 0 && otherFields.length != 0)
              otherFields = ` AND ${otherFields}`

            let wherePart = `${primaryKey}${otherFields}`

            let statement = `SELECT${isSelectionAsJSON ? ' JSON' : ''}${selectionPart} FROM ${keyspaceName}.${tableName}` + (wherePart.length > 0 ? OS.EOL + `WHERE ${wherePart}` : '') + `${orderByClusteringColumns}${limit}${allowFiltering};`

            try {
              actionEditor.setValue(statement)
            } catch (e) {}
          })
        }

        getAllPrimaryKeyColumns = () => updateActionStatusForSelectRowColumn(true)

        $('input[name="selectOrderBy"]').each(function() {
          $(this).on('change input', function() {
            let selectedType = getCheckedValue('selectOrderBy'),
              clusteringKeysNodes = $('div#tableFieldsPrimaryKeyTreeSelectAction').find('a.jstree-anchor[partition="false"][is-reversed]'),
              orderBadges = clusteringKeysNodes.find('button.column-order-type')

            orderBadges.css('display', selectedType == 'selectOBNone' ? 'none' : 'flex')

            try {
              if (selectedType == 'selectOBNone')
                throw 0

              for (let orderBadge of orderBadges.get()) {
                let selectedOrder = $(orderBadge).attr('data-original-order')

                if (selectedType == 'selectOBDefaultReversed')
                  selectedOrder = selectedOrder == 'asc' ? 'desc' : 'asc'

                $(orderBadge).attr('data-current-order', selectedOrder)

                $(orderBadge).find('ion-icon').attr('name', `sort-${selectedOrder}`)

                $(orderBadge).find('span').text(`${selectedOrder}`)
              }
            } catch (e) {}

            setTimeout(() => {
              try {
                updateActionStatusForSelectRow()
              } catch (e) {}
            })
          })
        })
      } catch (e) {}
    }, 10000)
  }

  {
    setTimeout(() => $('input#select-limit').on('input', () => {
      try {
        updateActionStatusForSelectRowColumn()
      } catch (e) {}
    }))
  }
}

// Handle choosing the connection type to added/updated
{
  setTimeout(() => {
    {
      let selectionButtons = $('div.modal#addEditConnectionDialog div.modal-body.select-type div.connection-type')

      selectionButtons.click(function() {
        if ($(this).hasClass('active'))
          return

        let type = $(this).attr('data-type')

        $(`div.modal#addEditConnectionDialog`).attr('data-selected-modal-body', type)

        $(`div.modal#addEditConnectionDialog`).find('div.connection-type').removeClass('active')

        $(this).addClass('active')

        $('div.modal#addEditConnectionDialog div.modal-body[data-connection-type]').hide()

        $(`div.modal#addEditConnectionDialog`).find('div.modal-content').css('height', `calc(202px + ${type == 'apache-cassandra' ? 470 : 326}px)`)

        setTimeout(() => $(`div.modal#addEditConnectionDialog div.modal-body[data-connection-type="${type}"]`).fadeIn(150), 200)

        $('#addConnection').attr('disabled', 'disabled')
      })
    }

    {
      $('input.astradb-data-field').on('input', function() {
        $(this).removeClass('is-invalid')
      })
    }
  })
}

{
  IPCRenderer.on('axonops-integration', (_, data) => {
    let workareaElement = $(`div.workarea[workarea-id="${data.workareaID}"]`),
      connectionElement = $(`div.connection[data-id="${data.connectionID}"]`),
      webviewElement = workareaElement.find('div.tab-pane[tab="axonops-integration"]').find('webview'),
      [integOrg, integClusterName, integURL] = getAttributes(connectionElement, ['data-axonops-integration-organization', 'data-axonops-integration-clustername', 'data-axonops-integration-url']),
      targetElement = data.clusterName != undefined ? 'cluster' : (data.tableName != undefined ? 'table' : 'keyspace'),
      urlHost = integURL == 'axonops-saas' ? Modules.Consts.AxonOpsIntegration.DefaultURL : `${integURL}`,
      urlParams = '',
      finalURL = '',
      isWebViewLoaded = $(webviewElement).data('isLoaded'),
      getClusterURL = (withParams = false) => {
        try {
          let _urlParams = Modules.Consts.AxonOpsIntegration.Patterns.Cluster

          _urlParams = _urlParams.replace('{ORG}', `${integOrg}`)

          _urlParams = _urlParams.replace('{CLUSTERNAME}', `${integClusterName}`)

          if (withParams)
            return {
              url: (new URL(_urlParams, urlHost)).href,
              params: _urlParams
            }

          urlParams = _urlParams

          return (new URL(urlParams, urlHost)).href
        } catch (e) {}

        return ''
      }

    try {
      switch (targetElement) {
        case 'cluster': {

          finalURL = getClusterURL()

          break
        }

        case 'keyspace': {
          urlParams = Modules.Consts.AxonOpsIntegration.Patterns.Keyspace

          urlParams = urlParams.replace('{ORG}', `${integOrg}`)

          urlParams = urlParams.replace('{CLUSTERNAME}', `${integClusterName}`)

          urlParams = urlParams.replace('{KEYSPACENAME}', `${data.keyspaceName}`)

          finalURL = (new URL(urlParams, urlHost)).href

          break
        }

        case 'table': {
          urlParams = Modules.Consts.AxonOpsIntegration.Patterns.Table

          urlParams = urlParams.replace('{ORG}', `${integOrg}`)

          urlParams = urlParams.replace('{CLUSTERNAME}', `${integClusterName}`)

          urlParams = urlParams.replace('{KEYSPACENAME}', `${data.keyspaceName}`)

          urlParams = urlParams.replace('{TABLENAME}', `${data.tableName}`)

          finalURL = (new URL(urlParams, urlHost)).href

          break
        }
      }
    } catch (e) {}

    if (finalURL.length <= 0)
      return showToast(I18next.capitalize(I18next.t('axonOps integration feature')), I18next.capitalizeFirstLetter(I18next.replaceData('the provided URL for this connection [code]$data[/code] seems invalid, consider to update the connection and try again', [urlHost])) + '.', 'failure')

    workareaElement.find('li.nav-item.axonops-integration-tab').show()

    try {
      let clusterURL = getClusterURL(true)

      workareaElement.find('div.webview-action.btn[action="home"]').attr({
        'home-url': clusterURL.url,
        'home-url-params': clusterURL.params
      })
    } catch (e) {}

    try {
      let axonopsTab = workareaElement.find('li.nav-item.axonops-integration-tab').children('a.nav-link'),
        axonopsTabObject = getElementMDBObject(axonopsTab, 'Tab')

      axonopsTabObject.show()
    } catch (e) {}

    try {
      if (!isWebViewLoaded) {
        $(webviewElement).attr('src', finalURL)
        $(webviewElement).data('isLoaded', true)
      } else {
        webviewElement[0].executeJavaScript(`
          window.next.router.replace("${new URL(getClusterURL(true).url).pathname}", undefined, { shallow: true })
          setTimeout(() => window.next.router.replace("${urlParams}", undefined, { shallow: false }))`)
      }
    } catch (e) {}

    try {
      let tooltip = getElementMDBObject(workareaElement.find('div.webview-action.btn.webview-current-link'), 'Tooltip')

      tooltip.setContent(urlParams)
    } catch (e) {}

  })
}

{
  IPCRenderer.on('insert-statements:generate', (_, data) => {
    let editorObject = monaco.editor.getEditors().find((editor) => $('div.modal#generateInsertStatements .editor').is(editor._domElement)),
      generateInsertStatementsModal = getElementMDBObject($('#generateInsertStatements'), 'Modal'),
      dataObject = tempObjects[data.tempObjectID],
      tableColumns = dataObject.tableObject.columns.map((column) => {
        return {
          name: column.name,
          type: column.cql_type
        }
      }),
      writeConsistencyLevel = `-- CONSISTENCY ${activeSessionsConsistencyLevels[activeConnectionID].standard} Note: CQL session already using this CL`,
      serialConsistencyLevel = `-- SERIAL CONSISTENCY ${activeSessionsConsistencyLevels[activeConnectionID].serial} Note: CQL session already using this CL`,
      statements = [],
      fieldsNames = tableColumns.map((column, index) => `    ${addDoubleQuotes(column.name)}${(index + 1) >= tableColumns.length ? '' : ','} -- ${column.type}`)

    for (let selectedRow of dataObject.selectedRows) {
      let rowFieldsValues = []

      for (let tableColumn of Object.keys(tableColumns)) {
        let fieldValue = selectedRow[tableColumns[tableColumn].name]

        try {
          let isSingleQuotesNeeded = false

          try {
            try {
              if (['text', 'varchar', 'ascii', 'inet'].some((type) => type == tableColumns[tableColumn].type))
                isSingleQuotesNeeded = true
            } catch (e) {}

            try {
              if (['time', 'timestamp'].every((type) => tableColumns[tableColumn].type != type))
                throw 0

              if (ValidateDate(fieldValue, 'boolean') || !fieldValue.endsWith(')'))
                isSingleQuotesNeeded = true
            } catch (e) {}

            try {
              if (tableColumns[tableColumn].type != 'date')
                throw 0

              if (ValidateDate(fieldValue, 'boolean') || !fieldValue.endsWith(')'))
                isSingleQuotesNeeded = true
            } catch (e) {}
          } catch (e) {}

          try {
            if (!isSingleQuotesNeeded)
              throw 0

            fieldValue = `${fieldValue}`.replace(/(^|[^'])'(?!')/g, "$1''")

            fieldValue = `'${fieldValue}'`
          } catch (e) {}

          rowFieldsValues.push(`    ${fieldValue}${(parseInt(tableColumn) + 1) >= tableColumns.length ? '' : ','} -- ${tableColumns[tableColumn].type}`)
        } catch (e) {}
      }

      let statement =
        `INSERT INTO ${addDoubleQuotes(dataObject.keyspaceName)}.${addDoubleQuotes(dataObject.tableName)} (` + OS.EOL +
        `${fieldsNames.join(OS.EOL)}` + OS.EOL + `) VALUES (` + OS.EOL +
        `${rowFieldsValues.join(OS.EOL)}` + OS.EOL + `) IF NOT EXISTS;`

      statements.push(statement)
    }

    let statement =
      `${writeConsistencyLevel}` + OS.EOL + `${serialConsistencyLevel}` + OS.EOL +
      statements.join(OS.EOL + OS.EOL)

    try {
      editorObject.setValue(statement)
    } catch (e) {}

    setTimeout(() => $(window.visualViewport).trigger('resize'))

    generateInsertStatementsModal.show()

    setTimeout(() => {
      try {
        delete tempObjects[data.tempObjectID]
      } catch (e) {}
    }, 500)
  })
}

{
  IPCRenderer.on('cql-snippets:view', (_, data) => $(`div.workarea[workarea-id="${data.workareaID}"]`).find('div.session-action[action="cql-snippets"]').find('button.btn').trigger('click', data))
}
