/**
 * Build a full tree-view model from a given metadata
 *
 * @Parameters:
 * {object} `metadata` the given metadata from the main thread
 * {boolean} `ignoreTitles` whether or not titles - like `Keyspace:`, `Table:` will not be added as prefix
 *
 * @Return: {object} a valid tree structure to be rendered
 */
let buildTreeview = async (metadata, ignoreTitles = false, _workspaceID = '', _connectionID = '') => {
  let counterIDs = 0,
    getMD5IDForNode = async (amount = 1) => {
      let ids = []

      for (let i = 0; i < amount; i++) {
        counterIDs = counterIDs + 1

        try {
          ids.push(await MD5(`${counterIDs}`))
        } catch (e) {
          try {
            errorLog(e, 'functions')
          } catch (e) {}
        }
      }

      return amount == 1 ? ids[0] : ids
    }

  let dataCenters = {}

  sortItemsAlphabetically(metadata.hosts_info, 'datacenter')

  try {
    dataCenters = metadata.hosts_info.reduce((result, item) => {
      let {
        datacenter,
        rack
      } = item

      if (!result[datacenter])
        result[datacenter] = {}

      if (!result[datacenter][rack])
        result[datacenter][rack] = []

      result[datacenter][rack].push(item)

      return result
    }, {})
  } catch (e) {}

  // Get a keyspaces container's random ID
  let [connectionID, keyspacesID, dataCentersID] = await getMD5IDForNode(3),
    // Define the path of extra icons to be used with each leaf
    extraIconsPath = normalizePath(Path.join(__dirname, '..', 'js', 'external', 'jstree', 'theme', 'extra')),
    // The initial tree structure
    treeStructure = {
      'types': {
        'default': {
          'icon': normalizePath(Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
        }
      },
      'dnd': {
        'is_draggable': false,
        'check_while_dragging': false
      },
      'core': {
        'strings': {
          'Loading ...': ' '
        },
        'themes': {
          'responsive': true,
          'name': 'default-dark'
        },
        'multiple': false,
        'data': [{
            'id': connectionID,
            'parent': '#',
            'text': `Cluster: <span>${metadata.cluster_name}</span>`,
            'type': 'default',
            'icon': normalizePath(Path.join(extraIconsPath, 'cluster.png')),
            'state': {
              'opened': true,
              'selected': false
            },
            'a_attr': {
              'allow-right-context': 'true',
              'name': metadata.cluster_name,
              'type': 'cluster'
            }
          },
          {
            'id': await getMD5IDForNode(),
            'parent': connectionID,
            'text': `Partitioner: <span>${metadata.partitioner.replace(/.+\.(.+)/gi, '$1')}</span>`,
            'type': 'default',
          },
          {
            'id': dataCentersID,
            'parent': connectionID,
            'text': `Data Centers (<span>${(Object.keys(dataCenters) || []).length}</span>)`,
            'type': 'default',
            'icon': normalizePath(Path.join(extraIconsPath, 'datacenter.png'))
          },
          {
            'id': keyspacesID,
            'parent': '#',
            'text': `Keyspaces (<span>${metadata.keyspaces.length}</span>)`,
            'type': 'default',
            'icon': normalizePath(Path.join(extraIconsPath, 'keyspaces.png')),
            'state': {
              'opened': true,
              'selected': false
            },
            'a_attr': {
              'allow-right-context': 'true',
              'type': 'keyspaces'
            }
          }
        ]
      },
      'plugins': ['types', 'contextmenu', 'search'],
      'contextmenu': {
        'select_node': false
      }
    }

  // Get a random ID for the system's keyspaces container
  let systemKeyspacesParentID = await getMD5IDForNode(),
    /**
     * Count the number of found system keyspaces in the connected to connection
     *
     * This is a better approach in long term than hardcoding the number
     */
    numOfFoundSystemKeyspaces = 0

  /**
   * Inner function to build a child's leaf and append it to the tree view
   *
   * @Parameters:
   * {string} `parentID` The child parent's ID
   * {string} `childID` The child's ID
   * {string} `text` the text to be shown in the leaf/node
   * {object} `object` the child's object
   * {string} `?icon` the name of the icon to be used with the leaf
   * {string} `?parentType` the child's parent type - partition, clustering, etc... -
   */
  let buildTreeViewForChild = async (parentID, childID, text, object, icon = null, parentType = '') => {
    // Define the parent's type
    let setParentType = icon || `${parentType}`

    try {
      if (!(Modules.Consts.CassandraSystemKeyspaces.some((keyspace) => keyspace == object.name)))
        throw 0

      // Update the parent's ID to be the `System Keyspaces` node
      parentID = systemKeyspacesParentID

      // Increase the counter
      numOfFoundSystemKeyspaces += 1
    } catch (e) {}

    let snippetsCounter = ''

    try {
      if (['keyspace', 'table'].every((type) => icon != type))
        throw 0

      let snippetsScope = icon == 'keyspace' ? [_workspaceID, _connectionID, object.name] : [_workspaceID, _connectionID, parentType.keyspace, object.name],
        snippetsCount = await Modules.Snippets.getSnippets(snippetsScope),
        hashedScope = await MD5(JSON.stringify(snippetsScope))

      snippetsCount = snippetsCount.length

      snippetsCounter = `<span class="snippets-counter ${snippetsCount >= 1 ? 'show' : ''}" data-hashed-scope="${hashedScope}"><ion-icon name="snippets"></ion-icon><counter>${snippetsCount}</counter></span>`
    } catch (e) {}

    // Define the child's structure
    let structure = {
      id: childID,
      parent: parentID,
      text: `<span>${EscapeHTML(object.name)}</span> ${snippetsCounter}`,
      type: 'default',
      parentType: setParentType
    }

    // If the title needs to be added then do this addition as a prefix
    if (!ignoreTitles)
      structure.text = `${text}: ${structure.text}`

    // If an icon has been passed then add it to the leaf's structure
    if (icon != null)
      structure.icon = normalizePath(Path.join(extraIconsPath, `${icon}.png`))

    // Add the parent's ID
    structure.a_attr = {
      'parent': `${parentID}`
    }

    try {
      if (text != `Index`)
        throw 0

      structure.a_attr.table = parentType.table || null
    } catch (e) {}

    try {
      // If the child is not any of the defined types then skip this try-catch block
      if (['Keyspace', 'Table', 'View', 'Index', 'User Type'].every((type) => text != type))
        throw 0

      // Set an `a_attr` attribute with important sub-attributes
      structure.a_attr = {
        ...structure.a_attr,
        'allow-right-context': 'true',
        'name': object.name,
        'type': `${text}`.toLowerCase()
      }

      try {
        structure.a_attr.keyspace = parentType.keyspace
      } catch (e) {}

      try {
        structure.a_attr['is-counter-table'] = parentType.isCounterTable
      } catch (e) {}

      try {
        if (parentType.isVirtual)
          object.virtual = true
      } catch (e) {}

      try {
        structure.a_attr.table = parentType.table
      } catch (e) {}

      try {
        if (minifyText(text) != 'usertype')
          throw 0

        structure.a_attr.type = 'udt'
        structure.a_attr.keyspace = object.keyspace
      } catch (e) {}
    } catch (e) {}

    /**
     * If the child is a table or view then make sure to set the `parentType` to empty
     * Not doing this would lead to incorrect structure
     */
    if (['Table', 'View'].some((type) => type == text))
      parentType = ''

    // Push the structure into the overall tree structure
    treeStructure.core.data.push(structure)

    try {
      /**
       * Check if the child has one or more of these attributes
       *
       * Define the attributes' names
       */
      let attributes = ['virtual', 'durable_writes']

      if (parentType == 'partitionKeys')
        attributes = attributes.slice(0, -2)

      // Loop through them all
      for (let attribute of attributes) {
        // If the child doesn't have this attribute then skip it and move to the next one
        if (object[attribute] == undefined)
          return

        // For `durable_writes`, it should be displayed if its value is only `false`
        if (attribute == 'durable_writes' && object[attribute])
          return

        let materialIcon = object[attribute] ? 'check' : 'close'

        // Otherwise, define that attribute's structure
        let structure = {
          id: await getMD5IDForNode(),
          parent: childID,
          text: `${I18next.capitalize(attribute.replace(/\_/gm, ' ')).replace(/Cql/gm, 'CQL')}: <span class="material-icons for-treeview">${materialIcon}</span>`,
          type: 'default'
        }

        // Some changes would be applied if the current attribute is `virtual`
        try {
          // If the attribute is not `virtual` then skip this try-catch block
          if (attribute != 'virtual')
            throw 0

          // Add the `virtual` attribute value as sub attribute in the structure
          structure.virtualValue = object[attribute] ? true : false

          // If the `virtual` value is `true` then it should be shown to the user
          if (structure.virtualValue)
            throw 0

          // Otherwise, hide the node which indicate's the node `virtual` value as it's `false` by default
          structure.state = {
            hidden: true
          }
        } catch (e) {}

        // Append that attribute to the child
        treeStructure.core.data.push(structure)
      }
    } catch (e) {}

    // Check if the child has a CQL type
    try {
      // If the child doesn't have a cql_type attribute then skip this try-catch block
      if (object.cql_type == undefined)
        throw 0

      // Otherwise, add the type to the node's text
      structure.text = `${structure.text}: <span>${EscapeHTML(object.cql_type)}</span>`
    } catch (e) {}

    try {
      if (object['is_static'] == undefined)
        throw 0

      let attribute = object['is_static']

      structure.text = `${structure.text}${attribute ? ' <span class="is-static-node">STATIC</span>' : ''}`
    } catch (e) {}

    try {
      if (object['is_reversed'] == undefined || icon != 'clustering-key')
        throw 0

      let attribute = object['is_reversed']

      materialIcon = attribute ? 'arrow_downward' : 'arrow_upward'

      structure.text = `${structure.text} <span class="is-reversed-node">${attribute ? 'DESC' : 'ASC'} <span class="material-icons for-treeview">${materialIcon}</span></span>`
    } catch (e) {}
  }

  // Handle the data centers (hosts)
  try {
    for (let dataCenterName of Object.keys(dataCenters)) {
      let dataCenter = dataCenters[dataCenterName],
        dataCenterID = await getMD5IDForNode(),
        dataCenterStructure = {
          id: dataCenterID,
          parent: dataCentersID,
          text: `DC: ${dataCenterName} (${(Object.keys(dataCenter) || []).length})`,
          type: 'default',
          state: {
            opened: false,
            selected: false
          },
          icon: normalizePath(Path.join(extraIconsPath, 'datacenter.png'))
        }

      treeStructure.core.data.unshift(dataCenterStructure)

      try {
        dataCenter = Object.keys(dataCenter).sort().reduce((acc, key) => {
          acc[key] = obj[key]

          return acc
        }, {})
      } catch (e) {}

      // Loop through racks
      for (let rackName of Object.keys(dataCenter)) {
        let rack = dataCenter[rackName],
          rackID = await getMD5IDForNode(),
          rackStructure = {
            id: rackID,
            parent: dataCenterID,
            text: `Rack: ${rackName} (${rack.length})`,
            type: 'default',
            state: {
              opened: false,
              selected: false
            },
            icon: normalizePath(Path.join(extraIconsPath, 'rack.png'))
          }

        treeStructure.core.data.unshift(rackStructure)

        sortItemsAlphabetically(rack, 'address')

        // Loop through nodes in the rack
        for (let rackNode of rack) {
          let rackNodeID = await getMD5IDForNode(),
            nodeStatus = rackNode.is_up == null ? '' : `-${(rackNode.is_up ? 'up' : 'down')}`,
            rackNodeStructure = {
              id: rackNodeID,
              parent: rackID,
              text: `${rackNode.address} (${nodeStatus.length <= 0 ? 'N/A' : nodeStatus.slice(1).toUpperCase()})`,
              type: 'default',
              state: {
                opened: false,
                selected: false
              },
              icon: normalizePath(Path.join(extraIconsPath, `node${nodeStatus}.png`))
            }

          treeStructure.core.data.unshift(rackNodeStructure)

          for (let nodeInfo of ['dse_version', 'broadcast_rpc_address']) {
            if (nodeInfo == 'dse_version' && rackNode[nodeInfo] == null)
              continue

            if (nodeInfo == 'broadcast_rpc_address' && `${rackNode[nodeInfo]}`.trim() == `${rackNode.address}`.trim())
              continue

            let infoID = await getMD5IDForNode(),
              infoText = nodeInfo == 'dse_version' ? `Cassandra version: ${rackNode[nodeInfo] || 'N/A'}` : `Broadcast RPC Address: ${rackNode.broadcast_rpc_address}:${rackNode.broadcast_rpc_port}`,
              infoStructure = {
                id: infoID,
                parent: rackNodeID,
                text: `${infoText}`,
                type: 'default',
                state: {
                  opened: false,
                  selected: false
                }
              }

            treeStructure.core.data.unshift(infoStructure)
          }
        }
      }
    }

  } catch (e) {}

  // Sort keyspaces alphabetically
  sortItemsAlphabetically(metadata.keyspaces, 'name')

  // Loop through the keyspaces
  for (let keyspace of metadata.keyspaces) {
    // Get a unique ID for the current keyspace, and an ID for its tables' container
    let [
      keyspaceID,
      tablesID
    ] = await getMD5IDForNode(2),
      indexesInfo = []

    // Build tree view for the keyspace
    await buildTreeViewForChild(keyspacesID, keyspaceID, `Keyspace`, keyspace, 'keyspace')

    try {
      if (keyspace.replication_strategy == undefined)
        throw 0

      let replicationStrategy = JSON.parse(repairJSONString(keyspace.replication_strategy)),
        replicationStrategyID = await getMD5IDForNode()

      // Tables' container that will be under the keyspace container
      let replicationStrategyStructure = {
        id: replicationStrategyID,
        parent: keyspaceID, // Under the current keyspace
        text: `Replication Strategy`,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'replication_strategy.png'))
      }

      // Append the tables' container to the tree structure
      treeStructure.core.data.push(replicationStrategyStructure); // This semicolon is critical here

      for (let key of Object.keys(replicationStrategy)) {
        treeStructure.core.data.push({
          id: await getMD5IDForNode(),
          parent: replicationStrategyID,
          text: `${key}: ${replicationStrategy[key]}`,
          type: 'default',
          icon: normalizePath(Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
        })
      }
    } catch (e) {}

    // Tables' container that will be under the keyspace container
    let tablesStructure = {
      id: tablesID,
      parent: keyspaceID, // Under the current keyspace
      text: `Tables (<span>${keyspace.tables.length}</span>)`,
      type: 'default',
      icon: normalizePath(Path.join(extraIconsPath, 'table.png')),
      a_attr: {
        keyspace: keyspace.name,
        type: 'tables-parent',
        'allow-right-context': true
      }
    }

    // Append the tables' container to the tree structure
    treeStructure.core.data.push(tablesStructure)

    sortItemsAlphabetically(keyspace.tables, 'name')

    let counterTablesID = await getMD5IDForNode(),
      counterTablesStructure = {
        id: counterTablesID,
        parent: tablesID,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'counter.png')),
        state: {
          hidden: true
        },
        a_attr: {
          keyspace: keyspace.name,
          type: 'counter-tables-parent',
          'allow-right-context': true
        }
      },
      numOfCounterTables = 0

    treeStructure.core.data.push(counterTablesStructure)

    // Loop through every table in the keyspace
    for (let table of keyspace.tables) {

      // Get random IDs for all upcoming children
      let [
        tableID,
        primaryKeysID,
        partitionKeysID,
        clusteringKeysID,
        columnsID,
        triggersID,
        viewsID,
        indexesID
      ] = await getMD5IDForNode(8)

      let isCounterTable = table.columns.find((column) => column.cql_type == 'counter') != undefined

      if (isCounterTable)
        numOfCounterTables += 1

      /**
       * Build a tree view for the table
       * For the `parentType` parameter set it to be the table's keyspace's name; to set a correct scope for getting a CQL description
       */
      await buildTreeViewForChild(tablesID, tableID, `Table`, table, 'table', {
        keyspace: keyspace.name,
        isCounterTable,
        isVirtual: keyspace.virtual
      })

      if (isCounterTable)
        await buildTreeViewForChild(counterTablesID, `${tableID}_${counterTablesID}`, `Table`, table, 'table', {
          keyspace: keyspace.name,
          isCounterTable: true,
          isVirtual: keyspace.virtual
        })

      // Table's primary keys
      {
        let primaryKeysStructure = {
          id: primaryKeysID,
          parent: tableID,
          text: `Primary Key (<span>${table.primary_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
        }

        treeStructure.core.data.push(primaryKeysStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...primaryKeysStructure,
            id: `${primaryKeysID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        sortItemsAlphabetically(table.primary_key, 'name')

        // Loop through primary keys
        for (let primaryKey of table.primary_key) {
          // Get a random ID for the key
          let primaryKeyID = await getMD5IDForNode(),
            isPartitionKey = table.partition_key.find((partitionKey) => primaryKey.name == partitionKey.name) != undefined

          // Build tree view for the key
          await buildTreeViewForChild(primaryKeysID, primaryKeyID, `Key`, primaryKey, isPartitionKey ? 'partition-key' : 'clustering-key')

          if (isCounterTable)
            await buildTreeViewForChild(`${primaryKeysID}_${counterTablesID}`, `${primaryKeyID}_${counterTablesID}`, `Key`, primaryKey, isPartitionKey ? 'partition-key' : 'clustering-key')
        }
      }

      // Table's partition key
      {
        let partitionKeysStructure = {
          id: partitionKeysID,
          parent: tableID,
          text: `Partition Key (<span>${table.partition_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'partition-key.png'))
        }

        treeStructure.core.data.push(partitionKeysStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...partitionKeysStructure,
            id: `${partitionKeysID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        sortItemsAlphabetically(table.partition_key, 'name')

        // Loop through keys
        for (let partitionKey of table.partition_key) {
          // Get a random ID for the key
          let partitionKeyID = await getMD5IDForNode()

          // Build tree view for the key
          await buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'partition-key', 'partitionKeys')

          if (isCounterTable)
            await buildTreeViewForChild(`${partitionKeysID}_${counterTablesID}`, `${partitionKeyID}_${counterTablesID}`, `Key`, partitionKey, 'partition-key', 'partitionKeys')
        }
      }

      // Loop through the table's children, starting from the clustering keys
      {
        let clusteringKeysStructure = {
          id: clusteringKeysID,
          parent: tableID,
          text: `Clustering Keys (<span>${table.clustering_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'clustering-key.png'))
        }

        treeStructure.core.data.push(clusteringKeysStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...clusteringKeysStructure,
            id: `${clusteringKeysID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        sortItemsAlphabetically(table.clustering_key, 'name')

        // Loop through clustering keys
        for (let clusteringKey of table.clustering_key) {
          // Get a random ID for the key
          let clusteringKeyID = await getMD5IDForNode()

          // Build tree view for the key
          await buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'clustering-key')

          if (isCounterTable)
            await buildTreeViewForChild(`${clusteringKeysID}_${counterTablesID}`, `${clusteringKeyID}_${counterTablesID}`, `Key`, clusteringKey, 'clustering-key')
        }
      }

      {
        let staticColumns = table.columns.filter((column) => column['is_static']),
          staticColumnsStructure = {
            id: `${columnsID}_static`,
            parent: tableID,
            text: `Static Columns (<span>${staticColumns.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'static-column.png'))
          }

        treeStructure.core.data.push(staticColumnsStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...staticColumnsStructure,
            id: `${columnsID}_${counterTablesID}_static`,
            parent: `${tableID}_${counterTablesID}`
          })

        sortItemsAlphabetically(staticColumns, 'name')

        // Loop through columns
        for (let column of staticColumns) {
          // Get a random ID for the column
          let columnID = await getMD5IDForNode(),
            isPartitionKey = table.partition_key.find((partitionKey) => column.name == partitionKey.name) != undefined,
            isClusteringKey = table.clustering_key.find((clusteringKey) => column.name == clusteringKey.name) != undefined

          // Get rid of `is_reversed` attribute
          if (!isClusteringKey)
            delete column.is_reversed

          // Build a tree view for the column
          await buildTreeViewForChild(`${columnsID}_static`, columnID, `Column`, column, isPartitionKey ? 'partition-key' : (isClusteringKey ? 'clustering-key' : 'static-column'))

          if (isCounterTable)
            await buildTreeViewForChild(`${columnsID}_${counterTablesID}_static`, `${columnID}_${counterTablesID}`, `Column`, column, isPartitionKey ? 'partition-key' : (isClusteringKey ? 'clustering-key' : 'static-column'))
        }
      }

      // Table's columns
      {
        let columnsStructure = {
          id: columnsID,
          parent: tableID,
          text: `Columns (<span>${table.columns.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
        }

        treeStructure.core.data.push(columnsStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...columnsStructure,
            id: `${columnsID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        sortItemsAlphabetically(table.columns, 'name')

        let allColumns = ([...table.partition_key, ...table.clustering_key, ...table.columns] || table.columns)

        allColumns = removeArrayDuplicates(allColumns, 'name')

        // Loop through columns
        for (let column of allColumns) {
          // Get a random ID for the column
          let columnID = await getMD5IDForNode(),
            isPartitionKey = table.partition_key.find((partitionKey) => column.name == partitionKey.name) != undefined,
            isClusteringKey = table.clustering_key.find((clusteringKey) => column.name == clusteringKey.name) != undefined,
            isStatic = column['is_static']

          // Get rid of `is_reversed` attribute
          if (!isClusteringKey)
            delete column.is_reversed

          // Build a tree view for the column
          await buildTreeViewForChild(columnsID, columnID, `Column`, column, isPartitionKey ? 'partition-key' : (isClusteringKey ? 'clustering-key' : (isStatic ? 'static-column' : 'column')))

          if (isCounterTable)
            await buildTreeViewForChild(`${columnsID}_${counterTablesID}`, `${columnID}_${counterTablesID}`, `Column`, column, isPartitionKey ? 'partition-key' : (isClusteringKey ? 'clustering-key' : (isStatic ? 'static-column' : 'column')))
        }
      }

      // Define an inner function to handle the appending process of options to the tree structure
      let appendOptions = async (options, parentID) => {
        // Loop through the passed `options`
        for (let option of Object.keys(options)) {
          // Manipulate the option's key/text
          let text = I18next.capitalize(`${option}`.replace(/\_/g, ' ')),
            // Get the option's value
            value = options[option]

          // Don't show `CDC` option if its value is `NULL`
          if (`${text}`.toLowerCase() == 'cdc' && `${value}`.toLowerCase() == 'null')
            return

          // If the value is one of the defined values in the array, then set the value to `NULL`
          value = [undefined, null].includes(value) ? 'NULL' : value

          try {
            /**
             * Handle if the option's value is actually a JSON object that has other sub-options
             * If the option's value is not an object, then skip this try-catch block
             */
            if (typeof value != 'object')
              throw 0

            // Get a random ID for the current parent's options node
            let parentOptionsID = await getMD5IDForNode(),
              // Define the node/leaf structure
              parentOptionsStructure = {
                id: parentOptionsID,
                parent: parentID, // Under the options' container node
                text: `${EscapeHTML(text)}`,
                type: 'default',
                icon: normalizePath(`${text}`.toLowerCase() == 'compaction' ? Path.join(extraIconsPath, 'compaction.png') : Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
              }

            // Push the node
            treeStructure.core.data.push(parentOptionsStructure)

            if (isCounterTable)
              treeStructure.core.data.push({
                ...parentOptionsStructure,
                id: `${parentOptionsID}_${counterTablesID}`,
                parent: `${parentID}_${counterTablesID}`
              })

            // Make a recursive call to the same function
            return await appendOptions(value, parentOptionsID)
          } catch (e) {}

          try {
            if (text == 'Class')
              value = `${value}`.match(/(?<=\.)[^.]+$/)[0]
          } catch (e) {}

          /**
           * Reaching here means the current option's value is not an object
           * Get a random ID for the option's node
           */
          let optionID = await getMD5IDForNode(),
            // Define the node/leaf structure
            optionStructure = {
              id: optionID,
              parent: parentID, // Under the options' node
              text: `${text}: <span>${EscapeHTML(value)}</span>`,
              type: 'default',
              icon: normalizePath(Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
            }

          // Push the node
          treeStructure.core.data.push(optionStructure)

          if (isCounterTable)
            treeStructure.core.data.push({
              ...optionStructure,
              id: `${optionID}_${counterTablesID}`,
              parent: `${parentID}_${counterTablesID}`
            })
        }
      }

      try {
        if (table.options.length <= 0)
          throw 0

        await appendOptions({
          compaction: {
            ...table.options['compaction'],
            bloom_filter_fp_chance: table.options['bloom_filter_fp_chance']
          }
        }, tableID)
      } catch (e) {}

      // Display the `Options` node/leaf if there is at least one option available for the current table
      try {
        /**
         * Options' container that will be under the table overall container
         * Get a random ID for the options' parent/container node
         */
        let optionsID = await getMD5IDForNode(),
          // Define the node/leaf structure
          optionsStructure = {
            id: optionsID,
            parent: tableID, // Under the current table
            text: `Options`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'options.png'))
          }

        // Append the options' parent/container to the tree structure
        treeStructure.core.data.push(optionsStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...optionsStructure,
            id: `${optionsID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        // If the current table does not have an `options` attribute, then skip this try-catch block
        if (table.options == undefined || Object.keys(table.options).length <= 0)
          throw 0

        // Initial call to the inner function
        await appendOptions(table.options, optionsID)
      } catch (e) {}

      // Table's triggers
      {
        try {
          if (isCounterTable)
            throw 0

          let triggersStructure = {
            id: triggersID,
            parent: tableID,
            text: `Triggers (<span>${table.triggers.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'trigger.png'))
          }

          treeStructure.core.data.push(triggersStructure)

          // if (isCounterTable)
          //   treeStructure.core.data.push({
          //     ...triggersStructure,
          //     id: `${triggersID}_${counterTablesID}`,
          //     parent: `${tableID}_${counterTablesID}`
          //   })

          // Loop through triggers
          for (let trigger of table.triggers) {
            // Get a random ID for the trigger
            let triggerID = await getMD5IDForNode()

            // Build a tree view for the trigger
            await buildTreeViewForChild(triggersID, triggerID, `Trigger`, trigger, 'trigger')

            // if (isCounterTable)
            //   await buildTreeViewForChild(`${triggersID}_${counterTablesID}`, `${triggerID}_${counterTablesID}`, `Trigger`, trigger, 'trigger')
          }
        } catch (e) {}
      }

      // Show a `Views` node/leaf if the current table has at least one view
      try {
        if (isCounterTable)
          throw 0

        /**
         * Views' container that will be under the table container
         * Get a random ID for the views' parent node
         */
        let viewsID = await getMD5IDForNode(),
          // Define the node/leaf structure
          viewsStructure = {
            id: viewsID,
            parent: tableID, // Under the current table
            text: `Views (<span>${table.views.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'view.png'))
          }

        // Append the views' container to the tree structure
        treeStructure.core.data.push(viewsStructure)

        // if (isCounterTable)
        //   treeStructure.core.data.push({
        //     ...viewsStructure,
        //     id: `${viewsID}_${counterTablesID}`,
        //     parent: `${tableID}_${counterTablesID}`
        //   })

        // If the current table doesn't have any materialized view then skip this try-catch block
        if (table.views.length <= 0)
          throw 0

        // Loop through every view in the table
        for (let view of table.view) {
          // Get random IDs for all upcoming children
          let [
            viewID,
            clusteringKeysID,
            partitionKeysID,
            columnsID
          ] = await getMD5IDForNode(4)

          /**
           * Build a tree view for the current view
           * For the `parentType` parameter set it to be the view's keyspace's name; to set a correct scope for getting a CQL description
           */
          await buildTreeViewForChild(viewsID, viewID, `View`, view, 'view', {
            keyspace: keyspace.name
          })

          // if (isCounterTable)
          //   await buildTreeViewForChild(`${viewsID}_${counterTablesID}`, `${viewID}_${counterTablesID}`, `View`, view, 'view', {
          //     keyspace: keyspace.name
          //   })

          // Loop through the view's children, starting from the clustering keys
          let clusteringKeysStructure = {
            id: clusteringKeysID,
            parent: viewID,
            text: `Clustering Keys (<span>${view.clustering_key.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'clustering-key.png'))
          }

          treeStructure.core.data.push(clusteringKeysStructure)

          if (isCounterTable)
            treeStructure.core.data.push({
              ...clusteringKeysStructure,
              id: `${clusteringKeysID}_${counterTablesID}`,
              parent: `${viewID}_${counterTablesID}`
            })

          sortItemsAlphabetically(view.clustering_key, 'name')

          // Loop through clustering keys
          for (let clusteringKey of view.clustering_key) {
            // Get a random ID for the key
            let clusteringKeyID = await getMD5IDForNode()

            // Build tree view for the key
            await buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'clustering-key')

            if (isCounterTable)
              await buildTreeViewForChild(`${clusteringKeysID}_${counterTablesID}`, `${clusteringKeyID}_${counterTablesID}`, `Key`, clusteringKey, 'clustering-key')
          }
          // End of view's clustering keys

          // View's partition key
          let partitionKeysStructure = {
            id: partitionKeysID,
            parent: viewID,
            text: `Partition Key (<span>${view.partition_key.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'partition-key.png'))
          }

          treeStructure.core.data.push(partitionKeysStructure)

          if (isCounterTable)
            treeStructure.core.data.push({
              ...partitionKeysStructure,
              id: `${partitionKeysID}_${counterTablesID}`,
              parent: `${viewID}_${counterTablesID}`
            })

          sortItemsAlphabetically(view.partition_key, 'name')

          // Loop through keys
          for (let partitionKey of view.partition_key) {
            // Get a random ID for the key
            let partitionKeyID = await getMD5IDForNode()

            // Build tree view for the key
            await buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'partition-key', 'partitionKeys')

            if (isCounterTable)
              await buildTreeViewForChild(`${partitionKeysID}_${partitionKeyID}`, `${clusteringKeyID}_${counterTablesID}`, `Key`, partitionKey, 'partition-key', 'partitionKeys')
          }
          // End of view's partition key

          {
            // View's columns
            let staticColumns = view.columns.filter((column) => column['is_static']),
              staticColumnsStructure = {
                id: `${columnsID}_static`,
                parent: viewID,
                text: `Columns (<span>${staticColumns.length}</span>)`,
                type: 'default',
                icon: normalizePath(Path.join(extraIconsPath, 'static-column.png'))
              }

            treeStructure.core.data.push(staticColumnsStructure)

            sortItemsAlphabetically(staticColumns, 'name')

            // Loop through columns
            for (let column of staticColumns) {
              // Get rid of `is_reversed` attribute
              delete column.is_reversed

              // Get a random ID for the column
              let columnID = await getMD5IDForNode()

              // Build a tree view for the column
              await buildTreeViewForChild(`${columnsID}_static`, columnID, `Column`, column, 'static-column')
            }
          }

          // View's columns
          let columnsStructure = {
            id: columnsID,
            parent: viewID,
            text: `Columns (<span>${view.columns.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
          }

          treeStructure.core.data.push(columnsStructure)

          // if (isCounterTable)
          //   treeStructure.core.data.push({
          //     ...columnsStructure,
          //     id: `${columnsID}_${counterTablesID}`,
          //     parent: `${viewID}_${counterTablesID}`
          //   })

          sortItemsAlphabetically(view.columns, 'name')

          let allColumns = ([...view.partition_key, ...view.clustering_key, ...view.columns] || view.columns)

          allColumns = removeArrayDuplicates(allColumns, 'name')

          // Loop through columns
          for (let column of allColumns) {
            // Get rid of `is_reversed` attribute
            delete column.is_reversed

            // Get a random ID for the column
            let columnID = await getMD5IDForNode()

            // Build a tree view for the column
            await buildTreeViewForChild(columnsID, columnID, `Column`, column, column['is_static'] ? 'static-column' : 'column')

            // if (isCounterTable)
            //   await buildTreeViewForChild(`${columnsID}_${counterTablesID}`, `${columnID}_${counterTablesID}`, `Column`, column, 'column')
          }
        }
      } catch (e) {}

      // Show an `Indexes` node/leaf if the current table has at least one index
      try {
        if (isCounterTable)
          throw 0

        /**
         * Indexes' container that will be under the table container
         * Get a random ID for the indexes' parent node
         */
        let indexesID = await getMD5IDForNode(),
          // Define the node/leaf structure
          indexesStructure = {
            id: indexesID,
            parent: tableID, // Under the current table
            text: `Indexes (<span>${table.indexes.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'index.png'))
          }

        // Append the indexes' container to the tree structure
        treeStructure.core.data.push(indexesStructure)

        // if (isCounterTable)
        //   treeStructure.core.data.push({
        //     ...indexesStructure,
        //     id: `${indexesID}_${counterTablesID}`,
        //     parent: `${tableID}_${counterTablesID}`
        //   })

        // If the current table doesn't have any index then skip this try-catch block
        if (table.indexes.length <= 0)
          throw 0

        // Loop through every index in the table
        for (let index of table.indexes) {
          // Get random IDs for the current index and its kind/type
          let [
            indexID,
            kindID
          ] = await getMD5IDForNode(2)

          indexesInfo.push({
            name: index.name,
            keyspace: keyspace.name,
            table: table.name
          })

          // Build a tree view for the current UDT
          await buildTreeViewForChild(indexesID, indexID, `Index`, index, 'index', {
            keyspace: keyspace.name,
            table: table.name
          })

          // if (isCounterTable)
          //   await buildTreeViewForChild(`${indexesID}_${counterTablesID}`, `${indexID}_${counterTablesID}`, `Index`, index, 'index', {
          //     keyspace: keyspace.name,
          //     table: table.name
          //   })

          // Push the index's kind's tree view's node structure
          treeStructure.core.data.push({
            id: kindID,
            parent: indexID,
            text: `Kind: <span>${I18next.capitalizeFirstLetter(EscapeHTML(index.kind.toLowerCase()))}</span>`,
            type: 'default'
          })

          // if (isCounterTable)
          //   treeStructure.core.data.push({
          //     id: `${kindID}_${counterTablesID}`,
          //     parent: `${indexID}_${counterTablesID}`,
          //     text: `Kind: <span>${I18next.capitalizeFirstLetter(EscapeHTML(index.kind.toLowerCase()))}</span>`,
          //     type: 'default'
          //   })
        }
      } catch (e) {}
    }

    try {
      let counterTablesNode = treeStructure.core.data.find((node) => node.id == counterTablesID)

      counterTablesNode.state.hidden = false

      counterTablesNode.text = `Counter Tables (<span>${numOfCounterTables}</span>)`
    } catch (e) {}

    // Show a `Views` node/leaf if the current keyspace has at least one view
    try {
      /**
       * Views' container that will be under the keyspace container
       * Get a random ID for the views' parent node
       */
      let viewsID = await getMD5IDForNode(),
        // Define the node/leaf structure
        viewsStructure = {
          id: viewsID,
          parent: keyspaceID, // Under the current keyspace
          text: `Views (<span>${keyspace.views.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'view.png'))
        }

      // Append the views' container to the tree structure
      treeStructure.core.data.push(viewsStructure)

      // If the current keyspace doesn't have any materialized view then skip this try-catch block
      if (keyspace.views.length <= 0)
        throw 0

      // Loop through every view in the keyspace
      for (let view of keyspace.views) {

        // Get random IDs for all upcoming children
        let [
          viewID,
          clusteringKeysID,
          partitionKeysID,
          columnsID
        ] = await getMD5IDForNode(4)

        /**
         * Build a tree view for the current view
         * For the `parentType` parameter set it to be the view's keyspace's name; to set a correct scope for getting a CQL description
         */
        await buildTreeViewForChild(viewsID, viewID, `View`, view, 'view', keyspace.name)

        // Add a node/leaf about the view's base table's name
        treeStructure.core.data.push({
          id: await getMD5IDForNode(),
          parent: viewID,
          text: `Base Table: <span>${EscapeHTML(view.base_table_name)}</span>`,
          type: 'default'
        })

        // Loop through the view's children, starting from the clustering keys
        let clusteringKeysStructure = {
          id: clusteringKeysID,
          parent: viewID,
          text: `Clustering Keys (<span>${view.clustering_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'clustering-key.png'))
        }

        treeStructure.core.data.push(clusteringKeysStructure)

        sortItemsAlphabetically(view.clustering_key, 'name')

        // Loop through clustering keys
        for (let clusteringKey of view.clustering_key) {
          // Get a random ID for the key
          let clusteringKeyID = await getMD5IDForNode()

          // Build tree view for the key
          await buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'clustering-key')
        }
        // End of view's clustering keys

        // View's partition key
        let partitionKeysStructure = {
          id: partitionKeysID,
          parent: viewID,
          text: `Partition Key (<span>${view.partition_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'partition-key.png'))
        }

        treeStructure.core.data.push(partitionKeysStructure)

        sortItemsAlphabetically(view.partition_key, 'name')

        // Loop through keys
        for (let partitionKey of view.partition_key) {
          // Get a random ID for the key
          let partitionKeyID = await getMD5IDForNode()

          // Build tree view for the key
          await buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'partition-key', 'partitionKeys')
        }
        // End of view's partition key

        {
          // View's columns
          let staticColumns = view.columns.filter((column) => column['is_static']),
            staticColumnsStructure = {
              id: `${columnsID}_static`,
              parent: viewID,
              text: `Columns (<span>${staticColumns.length}</span>)`,
              type: 'default',
              icon: normalizePath(Path.join(extraIconsPath, 'static-column.png'))
            }

          treeStructure.core.data.push(staticColumnsStructure)

          sortItemsAlphabetically(view.staticColumns, 'name')

          // Loop through columns
          for (let column of staticColumns) {
            // Get rid of `is_reversed` attribute
            delete column.is_reversed

            // Get a random ID for the column
            let columnID = await getMD5IDForNode()

            // Build a tree view for the column
            await buildTreeViewForChild(`${columnsID}_static`, columnID, `Column`, column, 'static-column')
          }
        }

        // View's columns
        let columnsStructure = {
          id: columnsID,
          parent: viewID,
          text: `Columns (<span>${view.columns.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
        }

        treeStructure.core.data.push(columnsStructure)

        sortItemsAlphabetically(view.columns, 'name')

        let allColumns = ([...view.partition_key, ...view.clustering_key, ...view.columns] || view.columns)

        allColumns = removeArrayDuplicates(allColumns, 'name')

        // Loop through columns
        for (let column of allColumns) {
          // Get rid of `is_reversed` attribute
          delete column.is_reversed

          // Get a random ID for the column
          let columnID = await getMD5IDForNode()

          // Build a tree view for the column
          await buildTreeViewForChild(columnsID, columnID, `Column`, column, column['is_static'] ? 'static-column' : 'column')
        }
      }
    } catch (e) {}

    // Show an `Indexes` node/leaf if the current keyspace has at least one index
    try {
      /**
       * Indexes' container that will be under the keyspace container
       * Get a random ID for the indexes' parent node
       */
      let indexesID = await getMD5IDForNode(),
        // Define the node/leaf structure
        indexesStructure = {
          id: indexesID,
          parent: keyspaceID, // Under the current keyspace
          text: `Indexes (<span>${keyspace.indexes.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'index.png'))
        }

      // Append the indexes' container to the tree structure
      treeStructure.core.data.push(indexesStructure)

      // If the current keyspace doesn't have any index then skip this try-catch block
      if (keyspace.indexes.length <= 0)
        throw 0

      // Loop through every index in the keyspace
      for (let index of keyspace.indexes) {

        // Get random IDs for the current index and its kind/type
        let [
          indexID,
          kindID,
          relatedTableID
        ] = await getMD5IDForNode(3)

        let indexInfo = {}

        try {
          indexInfo = indexesInfo.find((_index) => _index.name == index.name && _index.keyspace == keyspace.name)
        } catch (e) {}

        // Build a tree view for the current UDT
        await buildTreeViewForChild(indexesID, indexID, `Index`, index, 'index', {
          keyspace: keyspace.name,
          table: indexInfo.table
        })

        // Push the index's kind's tree view's node structure
        treeStructure.core.data.push({
          id: kindID,
          parent: indexID,
          text: `Kind: <span>${I18next.capitalizeFirstLetter(EscapeHTML(index.kind.toLowerCase()))}</span>`,
          type: 'default'
        })

        treeStructure.core.data.push({
          id: relatedTableID,
          parent: indexID,
          text: `Table: ${EscapeHTML(indexInfo.table)}`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'table.png'))
        })
      }
    } catch (e) {}

    // Check if the current keyspace has any user-defined element
    try {
      // Get the length of selected user-defined elements
      let lengths = {
          userTypes: keyspace.user_types.length,
          functions: keyspace.functions.length,
          aggregates: keyspace.aggregates.length
        },
        // Get random ID for the main node/leaf
        userDefinedElementsID = await getMD5IDForNode()

      // // Define the main node's structure
      // let userDefinedElementsStructure = {
      //   id: userDefinedElementsID,
      //   parent: keyspaceID,
      //   text: `User Definitions`,
      //   type: 'default',
      //   icon: normalizePath(Path.join(extraIconsPath, 'user_definitions.png'))
      // }
      //
      // // Append the UDEs' container to the tree structure
      // treeStructure.core.data.push(userDefinedElementsStructure)

      // Handle `User Defined Types (UDT)`
      try {
        /**
         * UDTs' parent node that will be under the main node
         * Get a random ID for the UDTs' parent node
         */
        let userTypesID = await getMD5IDForNode(),
          // Define the node/leaf structure
          userTypesStructure = {
            id: userTypesID,
            parent: keyspaceID,
            text: `User Defined Types (<span>${lengths.userTypes}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'udt.png')),
            a_attr: {
              keyspace: keyspace.name,
              type: 'udts-parent',
              'allow-right-context': true
            }
          }

        // Append the UDTs' container to the tree structure
        treeStructure.core.data.push(userTypesStructure)

        // If the current keyspace doesn't have any UDT then skip this try-catch block
        if (lengths.userTypes <= 0)
          throw 0

        // Loop through every UDT in the keyspace
        for (let userType of keyspace.user_types) {
          // Get random IDs for the current UDT and its fields
          let [
            userTypeID,
            fieldsID
          ] = await getMD5IDForNode(2)

          // Build a tree view for the current UDT
          await buildTreeViewForChild(userTypesID, userTypeID, `User Type`, {
            ...userType,
            keyspace: keyspace.name
          }, 'udt')

          // Loop through each field of the current UDT
          {
            let index = 0
            for (let field of userType.field_names) {
              // Get random IDs for the current field and its type
              let [
                fieldID, fieldTypeID
              ] = await getMD5IDForNode(2),
                // Get the field's type
                type = userType.field_types[index]

              // Push the field's tree view's node structure
              treeStructure.core.data.push({
                  id: fieldID,
                  parent: userTypeID,
                  text: `<span>${field}</span>: <span>${EscapeHTML(type)}</span>`,
                  type: 'default'
                })

                ++index
            }
          }
        }
      } catch (e) {}

      // Handle `User Defined Functions (UDF)`
      try {
        /**
         * UDFs' parent node that will be under the main node
         * Get a random ID for the UDFs' parent node
         */
        let userFuncsID = await getMD5IDForNode(),
          // Define the node/leaf structure
          userFuncsStructure = {
            id: userFuncsID,
            parent: keyspaceID,
            text: `User Defined Functions (<span>${lengths.functions}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'udf.png'))
          }

        // Push the UDFs' node to the tree structure
        treeStructure.core.data.push(userFuncsStructure)

        // If the current keyspace doesn't have any UDF then skip this try-catch block
        if (lengths.functions <= 0)
          throw 0

        // Loop through every UDF in the keyspace
        for (let func of keyspace.functions) {
          // Get random IDs for the current UDF and its arguments
          let [
            funcID,
            argumentsID
          ] = await getMD5IDForNode(2)

          // Build a tree view for the current UDF
          await buildTreeViewForChild(userFuncsID, funcID, `User Function`, func, 'udf')

          // Add different attributes to the current UDF
          {
            // Define the attributes' text
            let attributes = [
              `Deterministic: <span class="material-icons for-treeview">${func.deterministic ? 'check' : 'close'}</span>`,
              `Monotonic: <span class="material-icons for-treeview">${func.monotonic ? 'check' : 'close'}</span>`,
              `Called On null Input: <span class="material-icons for-treeview">${func.called_on_null_input ? 'check' : 'close'}</span>`,
              `Language: <span>${EscapeHTML(func.language.toUpperCase())}</span>`,
              `Return Type: <span>${EscapeHTML(func.return_type)}</span>`
            ]

            // Loop through each attribute's text
            for (let attribute of attributes) {
              // Push the attribute within a tree view's node structure
              treeStructure.core.data.push({
                id: await getMD5IDForNode(),
                parent: funcID,
                text: attribute,
                type: 'default'
              })
            }
          }

          // Push the current UDF's arguments' tree view's node structure
          treeStructure.core.data.push({
            id: argumentsID,
            parent: funcID,
            text: `Arguments (<span>${func.argument_names.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'argument.png'))
          })

          // Loop through each argument
          {
            let index = 0
            for (let argument of func.argument_names) {
              // Get random IDs for the current argument and its type
              let [
                argumentID, argumentTypeID
              ] = await getMD5IDForNode(2),
                // Get the argument's type
                type = func.argument_types[index]

              // Push the argument's tree tree view's node structure
              treeStructure.core.data.push({
                  id: argumentID,
                  parent: argumentsID,
                  text: `<span>${argument}</span>: <span>${EscapeHTML(type)}</span>`,
                  type: 'default'
                })

                ++index
            }
          }
        }
      } catch (e) {}

      // Handle `User Defined Aggregates (UDA)`
      try {
        /**
         * UDA's parent node that will be under the main node
         * Get a random ID for the UDTs' parent node
         */
        let userAggregatesID = await getMD5IDForNode(),
          // Define the node/leaf structure
          userAggregatesStructure = {
            id: userAggregatesID,
            parent: keyspaceID, // Under the current keyspace
            text: `User Defined Aggregates (<span>${lengths.aggregates}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'aggregate.png'))
          }

        // Push the UDA's main node to the tree structure
        treeStructure.core.data.push(userAggregatesStructure)

        // If the current keyspace doesn't have any UDA then skip this try-catch block
        if (lengths.aggregates <= 0)
          throw 0

        // Loop through every UDA in the keyspace
        for (let aggregate of keyspace.aggregates) {
          // Get random IDs for the current UDA and its arguments
          let [
            aggregateID,
            argumentsID
          ] = await getMD5IDForNode(2)

          // Build a tree view for the current UDA
          await buildTreeViewForChild(userAggregatesID, aggregateID, `User Function`, aggregate, 'aggregate')

          // Add different attributes to the current UDA
          {
            // Define the attributes' text
            let attributes = [
              `Deterministic: <span class="material-icons for-treeview">${aggregate.deterministic ? 'check' : 'close'}</span>`,
              `Final Function: <span>${aggregate.final_func}</span>`,
              `Initial Condition: <span>${aggregate.initial_condition}</span>`,
              `Return Type: <span>${EscapeHTML(aggregate.return_type)}</span>`,
              `State Function: <span>${aggregate.state_func}</span>`,
              `State Type: <span>${EscapeHTML(aggregate.state_type)}</span>`
            ]

            // Loop through each attribute's text
            for (let attribute of attributes) {
              // Push the attribute within a tree view's node structure
              treeStructure.core.data.push({
                id: await getMD5IDForNode(),
                parent: aggregateID,
                text: attribute,
                type: 'default'
              })
            }
          }

          // Push the current UDA's arguments types' tree view's node structure
          treeStructure.core.data.push({
            id: argumentsID,
            parent: aggregateID,
            text: `Arguments Types (<span>${aggregate.argument_types.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'argument.png'))
          })

          // Loop through each argument type of the current UDA
          {
            let index = 0
            for (let argumentType of aggregate.argument_types) {
              // Get random IDs for the current argument type
              let argumentTypeID = await getMD5IDForNode()

              // Push the argument type's tree view's node structure
              treeStructure.core.data.push({
                  id: argumentTypeID,
                  parent: argumentsID,
                  text: `<span>${EscapeHTML(argumentType)}</span>`,
                  type: 'default'
                })

                ++index
            }
          }
        }
      } catch (e) {}
    } catch (e) {}
  }

  // Add the system's keyspaces container node
  try {
    // Define the structure
    let systemKeyspacesStructure = {
      id: systemKeyspacesParentID,
      parent: keyspacesID,
      text: `System Keyspaces (<span>${numOfFoundSystemKeyspaces}</span>)`,
      type: 'default',
      state: {
        opened: true,
        selected: false
      },
      icon: normalizePath(Path.join(extraIconsPath, 'keyspaces.png'))
    }

    // Push the `System Keyspaces` node
    treeStructure.core.data.unshift(systemKeyspacesStructure)
  } catch (e) {}

  /**
   * Create a `Virtual Keyspaces` if needed and push the related nodes under it
   * Get all nodes that are flagged as `virtual`
   */
  let virtualNodes = treeStructure.core.data.filter((node) => node.virtualValue)

  // Filter the virtual nodes with more conditions
  virtualNodes = virtualNodes.filter((node) => {
    // Get the node's parent
    let parent = treeStructure.core.data.find((_node) => _node.id == node.parent)

    if (parent.parentType == 'table')
      node.state = {
        ...node.state,
        hidden: true
      }

    try {
      node.parentType = parent.parentType
    } catch (e) {}

    // Keep the node only if the parent node is a keyspace
    return ['keyspace', 'table'].some((type) => node.parentType == type)
  })

  try {
    // If there are no virtual keyspaces then skip this try-catch block
    if (virtualNodes.length <= 0)
      throw 0

    // Get a random ID for the `Virtual Keyspaces` node
    let virtualKeyspacesParentID = await getMD5IDForNode(),
      virtualKeyspacesCount = metadata.keyspaces.filter((keyspace) => keyspace.virtual).length

    // Define the node structure
    let structure = {
      id: virtualKeyspacesParentID,
      parent: keyspacesID,
      text: `Virtual Keyspaces (<span>${virtualKeyspacesCount}</span>)`,
      type: 'default',
      state: {
        opened: true,
        selected: false
      },
      icon: normalizePath(Path.join(extraIconsPath, 'keyspaces.png'))
    }

    // Push the `Virtual Keyspaces` node
    treeStructure.core.data.unshift(structure)

    // Loop through all remaining nodes after the filtering process
    for (let node of virtualNodes) {
      // Get the keyspace node and clone it
      let object = {
        ...treeStructure.core.data.filter((_node) => _node.id == node.parent)[0]
      }

      // Remove it from the overall structure
      treeStructure.core.data = treeStructure.core.data.filter((_node) => _node.id != node.parent)

      // Update the cloned keyspace node's parent ID to be the virtual keyspace node's ID
      if (node.parentType == 'keyspace')
        object.parent = virtualKeyspacesParentID

      object.a_attr = {
        ...object.a_attr,
        'data-is-virtual': `true`
      }

      // Push the object node again
      treeStructure.core.data.push(object)
    }
  } catch (e) {}

  // Return the final tree structure
  return treeStructure
}


let sortItemsAlphabetically = (array, sortBy) => {
  try {
    array.sort((a, b) => {
      if (`${a[sortBy]}`.toLowerCase() < `${b[sortBy]}`.toLowerCase())
        return -1

      if (`${a[sortBy]}`.toLowerCase() > `${b[sortBy]}`.toLowerCase())
        return 1

      return 0
    })
  } catch (e) {}
}
