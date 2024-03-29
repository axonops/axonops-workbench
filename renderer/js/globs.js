/**
 * Define all essential global variables and constants
 *
 * The main editor which is being used for browsing and editing the `cqlsh.rc` file's content in the add/edit cluster's dialog
 */
let editor,
  // Boolean value used to prevent collisions while updating `cqlsh.rc` content in the editor
  isUpdatingEditor = false,
  // The editor's decorations which be used to highlight sensitive data in the editor
  editorDecorations

/**
 * All `cqlsh.rc` config file's values
 * Updated with every new/edited cluster
 */
let cqlshValues = []

// Currently active workspace's ID
let activeWorkspaceID = '',
  // Currently active cluster's ID
  activeClusterID = '',
  /**
   * Cluster object that has been or is being edited/updated
   * Scaling up the scope of this variable is needed; as it's called in multiple isolated parts
   */
  editedClusterObject = null

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
// Boolean value used to tell if the logging system should be enabled in the current session or not
isLoggingEnabled = true

/**
 * All `fit` terminal addon objects for the app's terminals
 * This addon is used to make terminal's dimensions responsive
 */
let terminalFitAddonObjects = []

/**
 * All query tracing charts' objects
 * By adding those objects to the array, they can be resized and destroyed as needed
 */
let queryTracingChartsObjects = []

// Get the view/window content's ID from the main thread
let viewContentID = null

// Hold all created SSH tunnels
let sshTunnels = []

/**
 * Save all created MDB objects during the app's runtime
 * This array is associated with the singleton pattern implementation in the function `getElementMDBObject(element, ?type)`
 */
let allMDBObjects = [],
  // The MDB object of the `add` and `refresh` clusters floating buttons' tooltips
  tooltips = {
    addClusterActionButton: null,
    refreshClusterActionButton: null
  }
