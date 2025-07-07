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
 * Module to handle all workspaces processes in the project
 *
 * Return all saved workspaces
 *
 * @Return: {object} list of saved workspaces
 */
let getWorkspacesInternal = () => {
  let workspaces = [] // Final object which be returned

  // Add log about this process
  try {
    addLog(`Retrieve saved workspaces`, 'process')
  } catch (e) {}

  try {
    // Get all workspaces
    let savedWorkspaces = FS.readFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      savedWorkspaces = JSON.parse(savedWorkspaces)
    } catch (e) {
      savedWorkspaces = []
    }

    // Update the returned object
    workspaces = savedWorkspaces

    // Loop through each workspace and get `connections.json` file inside each one
    for (let workspace of workspaces) {
      try {
        // Define the current workspace path - default or custom -
        let folderPath = !workspace.defaultPath ? workspace.path : Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces'),
          // Read `connections.json` file of that workspace
          connections = FS.readFileSync(Path.join(folderPath, workspace.folder, 'connections.json'), 'utf8')

        // Convert the JSON content from string to object
        try {
          connections = JSON.parse(connections)
        } catch (e) {
          connections = []
        }

        // Save the connections object in the workspace object
        workspace.connections = connections
      } catch (e) {
        try {
          errorLog(e, 'workspaces')
        } catch (e) {}
      }
    }
  } catch (e) {
    try {
      errorLog(e, 'workspaces')
    } catch (e) {}
  } finally {
    // Return workspaces
    return workspaces
  }
}

let getWorkspaces = async () => await getWorkspacesInternal()

let getWorkspacesNoAsync = () => getWorkspacesInternal()

/**
 * Save a passed workspace object
 *
 * @Parameters:
 * {object} `workspace` the workspace's object - info and data - to be saved
 *
 * @Return: {boolean} the saving process has succeeded or failed
 */
let saveWorkspace = async (workspace) => {
  // Saving process status: [-2: Duplication in ID, -1: Duplication in name, 0: Not saved, 1: Saved]
  let status = 0

  // Add log about this process
  try {
    addLog(`Save workspace with attributes '${JSON.stringify(workspace)}'`, 'process')
  } catch (e) {}

  try {
    // Get all workspaces
    let workspaces = await FS.readFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      workspaces = JSON.parse(workspaces)
    } catch (e) {
      workspaces = []
    }

    // Extract the workspace folder name from its given name
    let folder = Sanitize(workspace.name),
      id = Sanitize(workspace.id),
      // Make sure the given name does not exist - no duplication -
      duplicationInName = workspaces.find((workspace) => manipulateText(Sanitize(workspace.folder)) == manipulateText(Sanitize(folder))),
      duplicationInID = workspaces.find((workspace) => manipulateText(workspace.id) == manipulateText(id))

    // If the given name exists
    if (duplicationInName != undefined)
      return status = -1 // Failed to save the connection due to duplication in name

    // If the given ID exists
    if (duplicationInName != undefined)
      return status = -2 // Failed to save the connection due to duplication in ID

    // Save the workspaces' original object before manipulation
    let originalWorkspace = {
      ...workspace
    }

    // Delete attributes if found
    try {
      delete workspace.connectionsPath
      delete workspace.checkedConnections
    } catch (e) {}

    // Push connection info
    workspaces.push({
      ...workspace,
      folder
    })

    // Define the workspace folder path - will be created -
    let workspacePath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', folder)

    // If a chosen path has been provided then it'll be adopted instead of the default one
    if (!workspace.defaultPath)
      workspacePath = Path.join(workspace.path, folder)

    // Handle if the process for an imported connection not a new one
    try {
      // If this attribute hasn't been found then skip this try-catch block
      if (originalWorkspace.connectionsPath == undefined)
        throw 0

      // Copy the workspace's folder to the new location - the default path -
      await FS.copySync(originalWorkspace.connectionsPath, workspacePath, {
        overwrite: true
      })

      // Get all saved connections in the about-to-imported workspace
      let connectionsManifest = await FS.readFileSync(Path.join(workspacePath, 'connections.json'), 'utf8')

      // Convert the manifest to Object
      try {
        connectionsManifest = JSON.parse(connectionsManifest)
      } catch (e) {
        connectionsManifest = []
      }

      // Loop through each saved connection
      for (let connection of connectionsManifest) {
        // If this connection is meant to be imported then skip it
        if (originalWorkspace.checkedConnections.some((checkedConnection) => checkedConnection == connection.folder))
          continue

        // Remove the connection from the manifest
        connectionsManifest = connectionsManifest.filter((savedConnection) => savedConnection.folder != connection.folder)

        // Remove its folder as well
        await FS.removeSync(Path.join(workspacePath, connection.folder))
      }

      // Apply the new content of the manifest
      await FS.writeFileSync(Path.join(workspacePath, 'connections.json'), beautifyJSON(connectionsManifest))

      // Update the `workspaces.json` file; by adding the imported workspace
      await FS.writeFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), beautifyJSON(workspaces))

      // Return success
      return 1
    } catch (e) {
      // Return failure
      if (parseInt(`${e}`) != 0)
        return 0
    }

    // Create the workspace folder
    await FS.mkdirSync(workspacePath)

    // Inside it, create the `connections.json` file
    await FS.writeFileSync(Path.join(workspacePath, 'connections.json'), '')

    // Update the `workspaces.json` file; by adding the new workspace
    await FS.writeFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), beautifyJSON(workspaces))

    // Successfully saved
    status = 1

    // Return the saving process status
    return status
  } catch (e) {
    try {
      errorLog(e, 'workspaces')
    } catch (e) {}

    // Return the saving process status
    return status
  }
}

/**
 * Update a passed workspace
 *
 * @Parameters:
 * {object} `workspace` the workspace's info and data to be saved
 *
 * @Return: {boolean} the updating process has succeeded or failed
 */
let updateWorkspace = async (workspace) => {
  // Updating process status: [false: Not updated, true: Updated]
  let status = false

  // Add log about this process
  try {
    addLog(`Attempt to update/edit workspace with attributes ${JSON.stringify(workspace)}`, 'process')
  } catch (e) {}

  try {
    // Get all workspaces
    let workspaces = await FS.readFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      workspaces = JSON.parse(workspaces)
    } catch (e) {
      workspaces = []
    }

    // Extract the workspace folder name from its given name and get the workspace object by its original folder name
    let folder = Sanitize(workspace.name),
      targetWorkspace = workspaces.find((_workspace) => manipulateText(Sanitize(_workspace.folder)) == manipulateText(Sanitize(workspace.originalFolder)))

    // Update workspace data
    targetWorkspace = {
      ...targetWorkspace, // Original data (like ID)
      name: workspace.name, // New workspace name
      color: workspace.color, // New color
      folder // And new folder name
    }

    // Define the default path
    let defaultPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces'),
      // Get the original path - before updating it -
      originalFolderPath = !targetWorkspace.defaultPath ? targetWorkspace.path : defaultPath,
      // Get the final original path
      originalPath = Path.join(originalFolderPath, workspace.originalFolder),
      // Get the new path - after updating it -
      newFolderPath = !workspace.extra.defaultPath ? workspace.extra.path : defaultPath,
      // Get the final new pat
      newPath = Path.join(newFolderPath, folder)

    /**
     * Move the entire workspace from its original path to the new one
     * Allow overwriting if the path exists
     */
    try {
      await FS.moveSync(originalPath, newPath, {
        overwrite: true
      })
    } catch (e) {
      try {
        errorLog(e, 'workspaces')
      } catch (e) {}
    }

    // Now update workspace default path and path info
    targetWorkspace.defaultPath = workspace.extra.defaultPath

    // This attribute will be deleted if exists and it'll be added again if the new data has a custom path instead of the default one
    delete targetWorkspace.path

    // Check if the deleted attribute need to be set again
    if (!workspace.extra.defaultPath)
      targetWorkspace.path = workspace.extra.path

    // Update the workspaces' object by replacing the workspace's info with the new one
    workspaces = workspaces.map((workspace) => workspace.id != targetWorkspace.id ? workspace : targetWorkspace)

    // Write the new workspaces JSON object
    await FS.writeFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), beautifyJSON(workspaces))

    // Successfully updated
    status = true
  } catch (e) {
    try {
      errorLog(e, 'workspaces')
    } catch (e) {}
  } finally {
    // Return the updating process status
    return status
  }
}

/**
 * Delete a passed workspace
 *
 * @Parameters:
 * {object} `workspace` the target workspace's object
 * {object} `workspaces` an array of all saved workspaces
 * {boolean} `?keepFiles` whether or not related files should be kept in the system
 *
 * @Return: {boolean} the deletion process's status
 */
let deleteWorkspace = async (workspace, workspaces, keepFiles = false) => {
  // Deletion process status: [false: Not deleted, true: deleted]
  let status = false

  // Add log about this process
  try {
    addLog(`Delete workspace with attributes '${JSON.stringify(workspace)}'`, 'process')
  } catch (e) {}

  try {
    // Define workspace folder path
    let folderPath = !workspace.defaultPath ? workspace.path : Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces'),
      workspaceFolderPath = Path.join(folderPath, workspace.folder)

    try {
      // Remove the entire workspace folder; including all sub files and folders and make sure to force that process
      if (!keepFiles)
        await FS.rmSync(workspaceFolderPath, {
          recursive: true,
          force: true
        })

      // Keep the workspace's folder, however, add a prefix `_DEL_` with random digits
      if (keepFiles)
        await FS.moveSync(workspaceFolderPath, `${workspaceFolderPath}_DEL_${getRandom.id(5)}`, {
          overwrite: true
        })
    } catch (e) {
      try {
        errorLog(e, 'workspaces')
      } catch (e) {}

      // If any error has occurred then stop the deletion process with a failure
      return status
    }

    // Filter workspaces object by removing the deleted workspace and getting rid of the `connections` object
    workspaces = workspaces
      .filter((_workspace) => _workspace.folder != workspace.folder && _workspace.id != 'workspace-sandbox')
      .map((_workspace) => {
        delete _workspace.connections
        return _workspace
      })

    // Write the new workspaces object
    await FS.writeFileSync(Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces', 'workspaces.json'), beautifyJSON(workspaces))

    // Successfully deleted
    status = true
  } catch (e) {
    try {
      errorLog(e, 'workspaces')
    } catch (e) {}
  } finally {
    // Return the deletion process status
    return status
  }
}

module.exports = {
  getWorkspaces,
  getWorkspacesNoAsync,
  saveWorkspace,
  updateWorkspace,
  deleteWorkspace
}
