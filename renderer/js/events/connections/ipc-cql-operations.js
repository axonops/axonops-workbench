let updateActionStatusForInsertRow,
  updateActionStatusForDeleteRowColumn,
  updateActionStatusForSelectRowColumn,
  getAllPrimaryKeyColumns,
  changeFooterButtonsStateTimeout

{
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

      let scopeFormat = '',
        scopeToString = (scopeObject) => {
          if (scopeObject.cluster)
            return 'cluster'

          let scope = `keyspace>${scopeObject.keyspace}`

          if (scopeObject.table) {
            scope += `table>${scopeObject.table}`
            if (scopeObject.index) {
              scope += `index>${scopeObject.index}`
            }
          } else if (scopeObject.type) {
            scope += `type>${scopeObject.type}`
          } else if (scopeObject.function) {
            scope += `function>${scopeObject.function}`
          } else if (scopeObject.aggregate) {
            scope += `aggregate>${scopeObject.aggregate}`
          } else if (scopeObject.view) {
            scope += `view>${scopeObject.view}`
          }

          return scope
        }

      try {
        data.scope = JSON.parse(data.scope)
      } catch (e) {}

      try {
        scopeFormat = scopeToString(data.scope)
      } catch (e) {}

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
          let descriptionScope = scopeFormat.replace(/>/gm, '-').replace('table-', '-table-'),
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
        let associatedDescription = cqlDescriptionsContainer.find(`div.description[data-scope="${scopeFormat}"]`),
          // Manipulate the scope to be set in the badge
          scope = scopeFormat == 'cluster' ? `Cluster: ${getAttributes(connectionElement, 'data-name')}` : ''

        try {
          // If the scope's length after the manipulation is not `0` then it's a `cluster` scope and this try-catch block may be skipped
          if (scope.length != 0)
            throw 0

          // Manipulate the scope
          scope = scopeFormat.replace(/\s*\>\s*/gm, ': ')
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
            <div class="description" data-scope="${scopeFormat}">
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

          $('input#insertionTimestamp').closest('div.data-insertion-timestamp-row').toggle(!(data.isCounterTable == 'true'))

          $(`div[action="insert-row"] div.types-of-transactions`).toggle(!(data.isCounterTable == 'true'))

          $(`div#extraOptionsBadge`).toggle(!(data.isCounterTable == 'true'))

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
                            iconPath = Path.join(__dirname, '..', 'js', 'external', 'jstree', 'theme', 'extra', `${iconName}-key.png`)

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
                            iconPath = Path.join(__dirname, '..', 'js', 'external', 'jstree', 'theme', 'extra', `${iconName}-key.png`)

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
}
