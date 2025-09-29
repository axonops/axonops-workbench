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

/**
 * Module to handle CQL snippets feature's processes and actions
 */

/**
 * `scope` here is an array with maximum 4 items
 * Each item here is a level:
 * Item `0`: `workspaces` or a workspace ID
 * Item `1`: A connection ID
 * Item `2`: A keyspace name in the connection
 * Item `3`: A table name in the keyspace
 * Based on the `length` of the `scope` the workbench will decide from where snippets will be fetched
 * If the scope is nothing (empty array), the workbench will attempt to get all snippets in the data folder
 */
let getSnippets = async (scope = [], onlyPath = false) => {
  if (scope[0] == 'orphaned')
    return await getOrphanedSnippets()

  let snippets = [],
    workspacesPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces')

  let getSnippetContent = async (snippetFilePath) => {
      try {
        if (!snippetFilePath.endsWith('.cql'))
          return null

        let snippetContent = await FS.readFile(snippetFilePath, 'utf8')

        if (!FrontMatter.test(snippetContent))
          return null

        snippetContent = FrontMatter(snippetContent)

        return {
          attributes: snippetContent.attributes,
          content: snippetContent.body,
          path: snippetFilePath,
          creationTimestamp: new Date(snippetContent.attributes.created_date).getTime()
        }
      } catch (e) {
        return null
      }
    },
    getSnippetsInPath = async (snippetsFolderPath) => {
      let finalSnippets = [],
        folderSnippets = []

      try {
        await FS.ensureDir(snippetsFolderPath)
      } catch (e) {}

      try {
        folderSnippets = await FS.readdir(snippetsFolderPath)
      } catch (e) {}

      for (let folderSnippet of folderSnippets) {
        try {
          let snippetContent = await getSnippetContent(Path.join(snippetsFolderPath, folderSnippet))

          if (snippetContent == null)
            continue

          finalSnippets.push(snippetContent)
        } catch (e) {}
      }

      return finalSnippets
    }

  // Get the global snippets (for the entire workbench)
  try {
    // If a scope is given and it's not for all workspaces
    if (scope.length >= 1 && scope[0] != 'workspaces')
      throw 0

    try {
      let globalSnippetsFolderPath = Path.join(workspacesPath, '_snippets')

      if (onlyPath)
        return globalSnippetsFolderPath

      let globalSnippets = await getSnippetsInPath(globalSnippetsFolderPath)

      snippets.push(...globalSnippets)
    } catch (e) {}

    // Scope length is `1` and it's for global snippets
    if (scope.length >= 1 && scope[0] == 'workspaces')
      return snippets
  } catch (e) {}

  let savedWorkspaces = Modules.Workspaces.getWorkspacesNoAsync()

  try {
    if (scope.length >= 1 && scope[0] != 'workspaces')
      savedWorkspaces = savedWorkspaces.filter((workspace) => workspace.id == scope[0])
  } catch (e) {}

  // Check all recognized workspaces
  try {
    for (let workspace of savedWorkspaces) {
      let workspaceSnippetsPath = Path.join(workspace.defaultPath ? workspacesPath : workspace.path, workspace.folder, '_snippets')

      if (onlyPath)
        return workspaceSnippetsPath

      let workspaceSnippets = await getSnippetsInPath(workspaceSnippetsPath)

      snippets.push(...workspaceSnippets)
    }
  } catch (e) {}

  // The scope is either `workspaces` or specific workspace
  if (scope.length == 1)
    return snippets.filter((snippet) => typeof snippet.attributes.associated_with != 'object' || (snippet.attributes.associated_with || []).length <= 0)

  // In case the scope is for specific connection, keyspace or table in the provided workspace
  try {
    if (!(scope.length > 1 && scope[0] != 'workspaces'))
      throw 0

    // Get connection ID
    let connectionID = scope[1], // It should be always the second item
      keyspaceName = scope[2],
      tableName = scope[3]

    // Filter for connection
    snippets = snippets.filter((snippet) => {
      try {
        let isAssociatedWithConnection = (snippet.attributes.associated_with || [])[0] == connectionID

        return isAssociatedWithConnection
      } catch (e) {
        return false
      }
    })

    if (scope.length == 2)
      return snippets.filter((snippet) => (snippet.attributes.associated_with || []).length == 1)

    // Filter for keyspace
    if (keyspaceName != undefined) {
      snippets = snippets.filter((snippet) => {
        try {
          let isAssociatedWithKeyspace = (snippet.attributes.associated_with || [])[1] == keyspaceName

          return isAssociatedWithKeyspace
        } catch (e) {
          return false
        }
      })

      if (scope.length == 3)
        return snippets.filter((snippet) => (snippet.attributes.associated_with || []).length == 2)
    }

    // Filter for table
    if (tableName != undefined) {
      snippets = snippets.filter((snippet) => {
        try {
          let isAssociatedWithTable = (snippet.attributes.associated_with || [])[2] == tableName

          return isAssociatedWithTable
        } catch (e) {
          return false
        }
      })

      if (scope.length == 4)
        return snippets.filter((snippet) => (snippet.attributes.associated_with || []).length == 3)
    }
  } catch (e) {}

  // Check all folders inside the workspaces default path and look for a snippets folder
  try {
    // If a scope is given and it's not for all workspaces
    if (scope.length >= 1 && scope[0] != 'workspaces')
      throw 0

    // Get all folders inside the default workspaces folder
    let workspacesInDefaultFolder = await FS.readdir(workspacesPath)

    try {
      workspacesInDefaultFolder = workspacesInDefaultFolder.filter((folder) => folder != '_snippets' && savedWorkspaces.find((workspace) => workspace.folder == folder && workspace.defaultPath) == undefined)
    } catch (e) {}

    for (let workspaceInDefaultFolder of workspacesInDefaultFolder) {
      let workspaceSnippetsPath = Path.join(workspacesPath, workspaceInDefaultFolder, '_snippets'),
        workspaceSnippets = await getSnippetsInPath(workspaceSnippetsPath)

      snippets.push(...workspaceSnippets)
    }
  } catch (e) {}

  return snippets
}

let getOrphanedSnippets = async () => {
  let workspacesDefaultFolder = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces'),
    allSnippets = []

  if (!FS.existsSync(workspacesDefaultFolder))
    return allSnippets

  let pathItems = FS.readdirSync(workspacesDefaultFolder, {
      withFileTypes: true
    }),
    // Check first level `_snippets` folder
    snippetsFolder = pathItems.find((item) => item.isDirectory() && item.name == '_snippets')

  try {
    if (snippetsFolder == undefined)
      throw 0

    FS.readdirSync(Path.join(workspacesDefaultFolder, '_snippets'), {
        withFileTypes: true
      })
      .filter((file) => file.isFile() && file.name.endsWith('.cql'))
      .forEach((file) => allSnippets.push(Path.resolve(Path.join(workspacesDefaultFolder, '_snippets'), file.name)))
  } catch {}

  // Check second level `_snippets` folders
  pathItems.filter((item) => item.isDirectory() && item.name !== '_snippets')
    .forEach((folder) => {
      try {
        if (!FS.existsSync(Path.join(workspacesDefaultFolder, folder.name, '_snippets')))
          throw 0

        FS.readdirSync(Path.join(workspacesDefaultFolder, folder.name, '_snippets'), {
            withFileTypes: true
          })
          .filter((file) => file.isFile() && file.name.endsWith('.cql'))
          .forEach((file) => allSnippets.push(Path.resolve(Path.join(workspacesDefaultFolder, folder.name, '_snippets'), file.name)))
      } catch {}
    })

  /**
   * Now we've got all snippets everywhere
   * Loop through them, convert them from Front Matter to JSON and check is association
   */
  let orphanedSnippets = [],
    workspacesAndConnections = []

  for (let workspace of Modules.Workspaces.getWorkspacesNoAsync()) {
    let connectionsIDs = await Modules.Connections.getConnections(workspace.id)

    workspacesAndConnections.push({
      workspaceID: workspace.id,
      connectionsIDs: connectionsIDs.map((connection) => connection.info.id)
    })
  }

  for (let snippetFilePath of allSnippets) {
    try {
      if (!snippetFilePath.endsWith('.cql'))
        return null

      let snippetContent = await FS.readFile(snippetFilePath, 'utf8')

      if (!FrontMatter.test(snippetContent))
        return null

      snippetContent = FrontMatter(snippetContent)

      let snippetObject = {
          attributes: snippetContent.attributes,
          content: snippetContent.body,
          path: snippetFilePath,
          creationTimestamp: new Date(snippetContent.attributes.created_date).getTime()
        },
        snippetAssociatedWith = snippetContent.attributes.associated_with

      // Case 1: The snippet is associated with the workspace - do nothing -
      if (['', undefined].some((state) => snippetAssociatedWith == state) || (snippetAssociatedWith || []).length <= 0)
        continue


      /**
       * Case 2: The snippet is associated with an object or more - connection is the first object -
       * Check the connection exists or not based on its ID
       */
      let connectionID = snippetAssociatedWith[0],
        isConnectionExists = workspacesAndConnections.find((workspace) => workspace.connectionsIDs.find((id) => id == connectionID))

      // Connection doesn't exist, it's an orphaned snippet
      if (isConnectionExists == undefined) {
        orphanedSnippets.push(snippetObject)

        continue
      }

      /**
       * Reaching here means the connection exists
       * Case 3: Check if there's a metadata for that connection in case the snippet is associated with an object in the node
       */
      if (snippetAssociatedWith.length <= 1)
        continue

      // TODO: Check keyspaces and tables
    } catch (e) {}
  }

  return orphanedSnippets
}

let deleteSnippet = async (snippetPath) => {
  let isDeleted = false

  try {
    await FS.remove(snippetPath)

    isDeleted = true
  } catch (e) {}

  return isDeleted
}

let createSnippet = async (snippetMetadata, snippetContent, snippetFolderPath) => {
  let result = {
      isCreated: false,
      snippet: null,
      fileName: `${Sanitize(snippetMetadata.title).replace(/\s+/g, '-')}-${getRandom.id(4)}.cql`
    },
    snippetFileContent = ''

  try {
    snippetFileContent = `${convertJSONObjectToYAML(snippetMetadata)}${snippetContent}`
  } catch (e) {}

  /**
   * If the file is not properly structureed as YAML file
   * Or the given path is inaccessible then stop the process
   */
  if (!FrontMatter.test(snippetFileContent) || !pathIsAccessible(snippetFolderPath))
    return result

  try {
    result.path = Path.join(snippetFolderPath, result.fileName)

    await FS.writeFileSync(result.path, snippetFileContent)

    result.isCreated = true

    result.snippet = FrontMatter(snippetFileContent)
  } catch (e) {}

  return result
}

let updateSnippet = async (snippetData) => {
  // Get the attributes and convert it to yaml
  let result = {
      isUpdated: false
    },
    snippetFileContent = ''

  try {
    snippetFileContent = `${convertJSONObjectToYAML(snippetData.attributes)}${snippetData.content}`
  } catch (e) {}

  /**
   * If the file is not properly structureed as YAML file
   * Or the given path is inaccessible then stop the process
   */
  if (!FrontMatter.test(snippetFileContent) || !pathIsAccessible(snippetData.path))
    return result

  try {
    await FS.writeFileSync(snippetData.path, snippetFileContent)

    result.isUpdated = true
  } catch (e) {}

  return result
}

let buildTreeView = async (specificScope = null) => {
  let extraIconsPath = normalizePath(Path.join(__dirname, '..', '..', 'renderer', 'js', 'external', 'jstree', 'theme', 'extra')),
    [
      workspacesParentID,
      orphanedSnippetsParentID
    ] = getRandom.id(10, 2).map((id) => `_${id}`),
    createSnippetsCounter = async (snippetsScope) => {
        try {
          let snippetsCount = await Modules.Snippets.getSnippets(snippetsScope),
            hashedScope = await MD5(JSON.stringify(snippetsScope))

          snippetsCount = snippetsCount.length

          return `<span class="snippets-counter ${snippetsCount >= 1 ? 'show' : ''}" data-hashed-scope="${hashedScope}"><ion-icon name="snippets"></ion-icon><counter>${snippetsCount}</counter></span>`
        } catch (e) {}
      },
      treeStructure = {
        'types': {
          'default': {
            'icon': normalizePath(Path.join(__dirname, '..', '..', 'renderer', 'assets', 'images', 'tree-icons', 'default.png'))
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
          'data': [{
              'id': workspacesParentID,
              'parent': '#',
              'text': `Workspaces`,
              'type': 'default',
              'icon': normalizePath(Path.join(extraIconsPath, 'workspaces.png')),
              'state': {
                'opened': specificScope != null,
                'selected': false
              },
              'a_attr': {
                'allow-right-context': 'false',
                'object-id': 'workspaces',
                'type': 'workspace'
              }
            },
            {
              'id': orphanedSnippetsParentID,
              'parent': '#',
              'text': `Orphaned Snippets`,
              'type': 'default',
              'icon': normalizePath(Path.join(extraIconsPath, 'unlinked.png')),
              'state': {
                'opened': false,
                'selected': false
              },
              'a_attr': {
                'allow-right-context': 'false',
                'object-id': 'orphaned',
                'type': 'orphaned'
              }
            }
          ]
        },
        'plugins': ['types', 'contextmenu', 'search'],
        'contextmenu': {
          'select_node': false
        }
      }

  let workspaces = Modules.Workspaces.getWorkspacesNoAsync(),
    treeConnectionsInfo = []

  sortItemsAlphabetically(workspaces, 'name')

  try {
    if (specificScope != null)
      workspaces = workspaces.filter((workspace) => workspace.id == specificScope.workspaceID)
  } catch (e) {}

  for (let workspace of workspaces) {
    let workspaceNodeID = `_${getRandom.id()}`,
      workspaceStructure = {
        'id': workspaceNodeID,
        'parent': workspacesParentID,
        'text': `${StripTags(workspace.name)}<div class="processing"></div>`,
        'type': 'default',
        'icon': normalizePath(Path.join(extraIconsPath, 'workspace.png')),
        'state': {
          'opened': specificScope != null,
          'selected': false
        },
        'a_attr': {
          'allow-right-context': 'false',
          'object-id': `${workspace.id}`,
          'object-name': `${workspace.name}`,
          'type': 'workspace'
        }
      }

    treeStructure.core.data.push(workspaceStructure)

    let workspaceConnections = await Modules.Connections.getConnections(workspace.id)

    sortItemsAlphabetically(workspaceConnections, 'name')

    try {
      if (specificScope != null)
        workspaceConnections = workspaceConnections.filter((connection) => connection.info.id == specificScope.connectionID)
    } catch (e) {}

    for (let connection of workspaceConnections) {
      let connectionNodeID = `_${getRandom.id()}`,
        connectionStructure = {
          'id': connectionNodeID,
          'parent': workspaceNodeID,
          'text': `${StripTags(connection.name)}<div class="processing"></div>`,
          'type': 'default',
          'icon': normalizePath(Path.join(extraIconsPath, 'connection.png')),
          'state': {
            'opened': specificScope != null,
            'selected': false
          },
          'a_attr': {
            'allow-right-context': 'false',
            'workspace-id': `${workspace.id}`,
            'workspace-name': `${workspace.name}`,
            'object-id': `${connection.info.id}`,
            'object-name': `${connection.name}`,
            'type': 'connection'
          }
        }

      treeConnectionsInfo.push({
        connectionID: connection.info.id,
        connectionName: connection.name,
        workspaceID: workspace.id,
        workspaceName: workspace.name,
        workspaceNodeID: workspaceNodeID,
        nodeID: connectionNodeID
      })

      treeStructure.core.data.push(connectionStructure)
    }
  }

  return {
    treeStructure,
    treeConnectionsInfo,
    workspacesParentID
  }
}

let loadConnectionMetadata = async (workspaceID, workspaceName, connectionID, connectionName, nodeID, treeObjectID, internalData = null, onlyMetadata = false) => {
  let handleMetadata = (metadata) => {
    let newNodes = [],
      extraIconsPath = normalizePath(Path.join(__dirname, '..', '..', 'renderer', 'js', 'external', 'jstree', 'theme', 'extra'))

    if (treeObjectID != cqlSnippets.treeObjectID)
      return

    try {
      let keyspaces = internalData != null ? metadata : JSON.parse(metadata)

      sortItemsAlphabetically(keyspaces, 'name')

      for (let keyspace of keyspaces) {
        let keyspaceNodeID = `_${getRandom.id()}`,
          keyspaceStructure = {
            'id': keyspaceNodeID,
            'parent': nodeID,
            'text': `${StripTags(keyspace.name)}<div class="processing"></div>`,
            'type': 'default',
            'icon': normalizePath(Path.join(extraIconsPath, 'keyspace.png')),
            'state': {
              'opened': internalData != null && internalData.keyspaceName == keyspace.name,
              'selected': false
            },
            'a_attr': {
              'allow-right-context': 'false',
              'workspace-id': `${workspaceID}`,
              'workspace-name': `${workspaceName}`,
              'connection-id': `${connectionID}`,
              'connection-name': `${connectionName}`,
              'object-id': `${keyspace.name}`,
              'type': 'keyspace'
            }
          }

        newNodes.push(keyspaceStructure)

        for (let table of keyspace.tables) {
          let tableNodeID = `_${getRandom.id()}`,
            tableStructure = {
              'id': tableNodeID,
              'parent': keyspaceNodeID,
              'text': `${StripTags(table)}<div class="processing"></div>`,
              'type': 'default',
              'icon': normalizePath(Path.join(extraIconsPath, 'table.png')),
              'state': {
                'opened': internalData != null && internalData.tableName == table,
                'selected': false
              },
              'a_attr': {
                'allow-right-context': 'false',
                'object-id': `${table}`,
                'workspace-id': `${workspaceID}`,
                'workspace-name': `${workspaceName}`,
                'connection-id': `${connectionID}`,
                'connection-name': `${connectionName}`,
                'keyspace-id': `${keyspace.name}`,
                'type': 'table'
              }
            }

          newNodes.push(tableStructure)
        }
      }

      let jstreeViewObject = $('#cqlSnippets').find('div.side.objects-treeview').find('div.snippets-objects-treeview').jstree(true)

      jstreeViewObject.settings.core.data.push(...newNodes)

      cqlSnippets.finishedLoadingMetadataNodes.push(cqlSnippets.loadingMetadataNodes.find((loadingNode) => loadingNode.nodeID == nodeID))

      cqlSnippets.loadingMetadataNodes = cqlSnippets.loadingMetadataNodes.filter((loadingNode) => loadingNode.nodeID != nodeID)

      jstreeViewObject.refresh(true)
    } catch (e) {}
  }

  if (internalData != null)
    return handleMetadata(internalData.metadata)

  decryptTextBG('', (metadata) => handleMetadata(metadata), `metadata_${connectionID}`)
}

let getConnectionSavedMetadata = async (connectionID, callback) => decryptTextBG('', (metadata) => callback(metadata), `metadata_${connectionID}`)

module.exports = {
  buildTreeView,
  loadConnectionMetadata,
  getSnippets,
  getConnectionSavedMetadata,
  createSnippet,
  updateSnippet,
  deleteSnippet
}
