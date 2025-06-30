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
 * Define all essential global variables and constants that are being called throughout the entire app's renderer thread
 *
 * The main editor which is being used for browsing and editing the `cqlsh.rc` file's content in the add/edit connection's dialog
 */
let editor,
  diffEditors = [],
  // Boolean value used to prevent collisions while updating `cqlsh.rc` content in the editor
  isUpdatingEditor = false,
  // The editor's decorations which be used to highlight sensitive data in the editor
  editorDecorations

/**
 * All `cqlsh.rc` config file's values
 * Updated with every new/edited connection
 */
let cqlshValues = []

// Currently active workspace's ID
let activeWorkspaceID = '',
  // Currently active connection's ID
  activeConnectionID = '',
  /**
   * Connection object that has been or is being edited/updated
   * Scaling up the scope of this variable is needed; as it's called in multiple isolated parts
   */
  editedConnectionObject = null

// For active connections, consistency levels are being stored here:
// [connectionID]: {
//   standard: '',
//   serial: ''
// }
let activeSessionsConsistencyLevels = [],
  activeSessionsPaginationSize = null

/**
 * Store the apps' RSA public key
 * In this way, there's no need to request the key every time from the keys generator tool
 */
let publicKey = '',
  // Store the machine's unique ID
  machineID = ''

/**
 * Boolean value used to tell if the info toast has been shown to the user or not
 * This flag is defined to show the toast only once
 */
let isSandboxDockerInfoShown = false
// This flag determines whether or not the logging system should be enabled during the current session
isLoggingEnabled = true

/**
 * Retrieve the view/window content's ID from the main thread
 * This is useful in case there's a need to use `ipcRenderer.sendTo`
 */
let viewContentID = null

// All XTerm.js objects are stored here; to be accessed across the entire app
let terminalObjects = [],
  /**
   * All `fit` terminal addon objects for the app's terminals
   * This addon is used to make the terminal's dimensions more responsive
   */
  terminalFitAddonObjects = [],
  /**
   * All query tracing charts' objects
   * By adding those objects to the array, they can be resized and destroyed as needed
   */
  queryTracingChartsObjects = [],
  // Hold all created SSH tunnels objects
  sshTunnelsObjects = []

/**
 * Save all created MDB objects during the app's runtime
 * This array is associated with a singleton pattern implementation in the function `getElementMDBObject(element, ?type)`
 */
let mdbObjects = [],
  /**
   * The MDB object of the `add` and `refresh` connections floating buttons' tooltips
   * Those two tooltips are defined in this way as they need to be referenced and updated many times during the active session
   */
  tooltips = {
    addConnectionActionButton: null,
    refreshConnectionActionButton: null
  }
