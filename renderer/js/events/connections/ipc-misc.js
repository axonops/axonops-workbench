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
