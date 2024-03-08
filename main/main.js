/**
 * The main - single - thread for the app overall
 *
 * Import the compilation cache optimizer
 */
require('v8-compile-cache')

// Import Electron module
const Electron = require('electron'),
  /**
   * Import different sub-modules from the Electron module
   *
   * `app`
   * For controlling the app's event lifecycle
   */
  App = Electron.app,
  /**
   * `BrowserWindow`
   * For creating and controlling the app's windows
   */
  Window = Electron.BrowserWindow,
  /**
   * `Menu`
   * For creating native application menus and context menus
   */
  Menu = Electron.Menu,
  /**
   * `ipcMain`
   * For communicating asynchronously from the main thread to the renderer thread(s)
   */
  IPCMain = Electron.ipcMain

/**
 * Import Node.js modules
 *
 * Node.js file system module - improved version which has methods that aren't included in the native `fs` module -
 * Used for working with file system, it provides related utilities
 */
const FS = require('fs-extra'),
  /**
   * Node.js path module
   * Working with file and directory paths, and provide useful utilities
   */
  Path = require('path'),
  /**
   * Node.js url module
   * For URL resolution and parsing
   */
  URL = require('url')

/**
 * Import extra modules to be used in the main thread
 *
 * Execute commands across all platforms
 */
const Terminal = require('node-cmd'),
  // Enable the right-click context menu
  ContextMenu = require('electron-context-menu'),
  // Helps positioning the app's windows
  Positioner = require('electron-positioner')

/**
 * Import the custom node modules for the main thread
 *
 * Define the `Modules` constant that will contain all custom modules
 */
const Modules = []

try {
  // Define the folder path of the custom node modules
  let modulesFilesPath = Path.join(__dirname, '..', 'custom_node_modules', 'main'),
    // Read the files inside the folder
    modulesFiles = FS.readdirSync(modulesFilesPath)

  /**
   * Loop through modules files
   * Main modules are `pty`, `dialogs`, and `scripts`
   */
  modulesFiles.forEach((moduleFile) => {
    try {
      // Make sure the module file name is in lowercase
      moduleFile = moduleFile.toLowerCase()

      // Ignore any file which is not JS
      if (!moduleFile.endsWith('.js'))
        return

      // Define the module's name
      let moduleName = moduleFile.slice(0, moduleFile.indexOf('.js'))

      // Capitalize the name
      moduleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1)

      // Import the module
      Modules[moduleName] = require(Path.join(modulesFilesPath, moduleFile))
    } catch (e) {}
  })
} catch (e) {}

/**
 * Define global variables that will be used in different scopes in the main thread
 *
 * The main view/window object
 */
let mainView = null,
  // A view for all background processes
  backgroundProcessesView = null,
  // A view for the app's offline documentation
  documentationView = null

// An array which will save all cqlsh instances with their ID given by the renderer thread
let CQLSHInstances = [],
  // Whether or not the user wants to entirely quit the app - this happens when all renderer threads are terminated/closed -
  macOSForceClose = false,
  // A `logging` object which will be created once the app is ready
  logging = null

/**
 * Create a window with different set properties
 *
 * @Parameters:
 * {object} `properties` the main properties of the window
 * {string} `viewPath` the path of the HTML file - which will be loaded as a renderer thread
 * {object} `?extraProperties` the extra properties of the window
 *
 * @Return: {object} the created window's object
 */
let createWindow = (properties, viewPath, extraProperties = {}) => {
  let windowObject = null // Window object which be returned

  // Create a window with the given properties
  windowObject = new Window(properties)

  // Load the main HTML file of that window
  windowObject.loadURL(URL.format({
    pathname: viewPath,
    protocol: 'file:',
    slashes: true
  }))

  // Whether or not the window should be at the center of the screen
  if (extraProperties.center)
    (new Positioner(windowObject)).move('center')

  // When the window has loaded
  windowObject.webContents.on('did-finish-load', () => {
    /**
     * Check extra properties
     *
     * Maximizing the window size
     */
    if (extraProperties.maximize)
      windowObject.maximize()

    // Whether or not the window should be shown
    if (extraProperties.show)
      windowObject.show()

    // Whether or not developer tools should be opened
    if (extraProperties.openDevTools)
      windowObject.webContents.openDevTools()

    // Send the window's content's ID
    try {
      windowObject.webContents.send(`view-content-id`, windowObject.webContents.id)
    } catch (e) {}
  })

  // When the window is closed - event has finished -, set the window object reference to `null`; as it should be neglected after being closed
  windowObject.on('closed', () => {
    windowObject = null
  })

  // Return the window object
  return windowObject
}

/**
 * Some app's properties
 *
 * The app's default icon path
 */
const AppIconPath = Path.join(__dirname, '..', 'renderer', 'assets', 'images', 'icon.ico'),
  // The app's main view - HTML file - path
  AppMainViewPath = Path.join(__dirname, '..', 'renderer', 'views', 'index.html'),
  // Get the app's info
  AppInfo = require(Path.join(__dirname, '..', 'package.json'))

/**
 * When the main thread is ready
 *
 * Define the main view/window properties and extra properties, plus the right-click context menu properties
 */
let properties = {
    minWidth: 1266,
    minHeight: 668,
    center: true,
    icon: AppIconPath,
    title: AppInfo.title,
    backgroundColor: '#f5f5f5',
    show: false,
    webPreferences: {
      devTools: true,
      nodeIntegration: true,
      webviewTag: true,
      enableRemoteModule: true,
      contextIsolation: false,
      plugins: false
    }
  },
  extraProperties = {
    maximize: false,
    show: false,
    openDevTools: true
  },
  contextMenuProperties = {
    showLearnSpelling: false,
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showCopyImage: false,
    showCopyLink: false,
    showInspectElement: false,
    showSelectAll: false
  }

// Define the properties of the right-click context menu
ContextMenu(contextMenuProperties)

// Start the crash handler immediately before the app gets ready
Modules.Reports.startCrashingHandler()

// When the app is ready a renderer thread should be created and started
App.on('ready', () => {
  // Create the main view, and pass the properties
  mainView = createWindow(properties, AppMainViewPath, extraProperties)

  // Create the background processes' view and make it hidden; as there's no need for a window or GUI for it
  backgroundProcessesView = createWindow(properties, Path.join(AppMainViewPath, '..', 'background.html'), {
    show: false,
    parent: mainView
  })

  // Create the documentation view
  documentationView = createWindow(properties, Path.join(AppMainViewPath, '..', 'documentation', 'index.html'), {
    show: false,
    parent: mainView
  })

  /**
   * Create the intro view/window with custom properties
   * This window will be destroyed once the main view and its children loaded
   */
  let introView = createWindow({
    ...properties,
    minWidth: 450,
    minHeight: 80,
    width: 480,
    height: 80,
    transparent: true,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    thickFrame: false,
    show: true
  }, Path.join(AppMainViewPath, '..', 'intro.html'), {
    show: true,
    center: true,
    parent: mainView
  })

  // When the `close` event is triggered for the documentation view
  documentationView.on('close', (event) => {
    // This will be set to `true` if the entire app is about to be closed
    if (!documentationViewPreventClose)
      return

    // Prevent the default behavior - terminate the view -
    event.preventDefault()

    /**
     * Only hide the documentation view
     * In this way we prevent unnecessary loading and creating time for the view each time it's called
     */
    documentationView.hide()
  })

  /**
   * When the `close` event is triggered for the background processes view
   * This event is only triggered at the back-end and not by the user
   */
  backgroundProcessesView.on('close', () => {
    // Update `macOSForceClose` flag if needed
    try {
      // If the value is already `true` then skip this try-catch block
      if (macOSForceClose)
        throw 0

      // Update the value
      macOSForceClose = true

      // Call the `close` event for the `mainView` but this time with forcing the close of all windows
      mainView.close()
    } catch (e) {}
  })

  // Once a `loaded` event is received from the main view
  IPCMain.on('loaded', () => {
    // Trigger after 1s of loading the main view
    setTimeout(() => {
      // Destroy the intro view entirely
      introView.destroy()

      // Show the main view and maximize it
      mainView.show()
      mainView.maximize()
    }, 500)
  })

  // Set the menu bar to `null`; so it won't be created
  Menu.setApplicationMenu(null)

  // Variable to prevent the immediate closure of the main view; so we have time to save the logs and terminate cqlsh sessions
  let mainViewPreventClose = true,
    documentationViewPreventClose = true

  // Once the `close` event is triggered
  mainView.on('close', (event) => {
    // Special process for macOS only
    try {
      // If the current OS is not macOS or there's a force to close the windows then skip this try-catch block
      if (process.platform != 'darwin' || macOSForceClose)
        throw 0

      // On macOS, just minimize the main window when the user clicks the `X` button
      mainView.minimize()

      // Prevent the default behavior
      event.preventDefault()

      // Skip the upcoming code
      return
    } catch (e) {}

    // The way we handle this event is by preventing its default behaviour only once, then, we do what we need to do before the termination and after all processes are finished the `close` event is triggered again but it won't be prevented this time
    try {
      // If we don't need to prevent the `close` default behaviour then we may skip this try-catch block
      if (!mainViewPreventClose)
        throw 0

      // Prevent the default behaviour for this event
      event.preventDefault()

      // Set to `false`; to skip this try-catch block on the next call of event `close`
      mainViewPreventClose = false
    } catch (e) {}

    // Close all active work areas - clusters and sandbox projects -
    try {
      mainView.webContents.send(`app-terminating`)
    } catch (e) {} finally {
      // Once the pre-close processes finished we may trigger the `close` event again for all windows
      setTimeout(() => {
        // Close the main view
        try {
          mainView.close()
        } catch (e) {}

        // Close the background-processes view
        try {
          backgroundProcessesView.close()
        } catch (e) {}

        // Close the documentation view
        try {
          // Set it to `true`; in order to close the documentation view and destroy it as well
          documentationViewPreventClose = false

          // Close the documentation view
          documentationView.close()
        } catch (e) {}
      }, 250)
    }
  })
})

// When there's an `activate` trigger for the app
App.on('activate', () => {
  // If the app is active but no window has been created for any reason then create the main one
  if (mainView === null)
    mainView = createWindow(properties, AppMainViewPath, extraProperties)

  // If the current OS is macOS then restore the state of the main window
  if (process.platform === 'darwin')
    mainView.restore()
})

// Quit the app when all windows are closed
App.on('window-all-closed', () => App.quit())

// Handle all requests from the renderer thread
{
  /**
   * Requests related to pty instances
   * All requests have the prefix `pty:`
   */
  {
    // Create a pty instance - which will create a cqlsh instance as well -
    IPCMain.on('pty:create', (_, data) => {
      // Close/end any instance related to the cluster
      try {
        CQLSHInstances[data.id].close()
      } catch (e) {}

      // Create a pty instance
      try {
        CQLSHInstances[data.id] = new Modules.Pty.Pty(mainView, data)
      } catch (e) {}

      // Call that instance to create a cqlsh instance
      try {
        CQLSHInstances[data.id].createCQLSHInstance(data.cqlshrc)
      } catch (e) {}
    })

    // Send a command to the pty instance
    IPCMain.on('pty:command', (_, data) => {
      try {
        CQLSHInstances[data.id].command(data.cmd)
      } catch (e) {}
    })

    // Get the metadata of a cluster
    IPCMain.on('pty:metadata', (_, data) => {
      try {
        CQLSHInstances[data.id].getMetadata(data.metadataSendID)
      } catch (e) {}
    })

    // Get the result of the query tracing process
    IPCMain.on('pty:query-tracing', (_, data) => {
      try {
        CQLSHInstances[data.clusterID].getQueryTracing(data.id, data.sessionID)
      } catch (e) {}
    })

    // Pause the pty instance
    IPCMain.on('pty:pause', (_, id) => {
      try {
        CQLSHInstances[id].pause()
      } catch (e) {}
    })

    // Resume the pty instance
    IPCMain.on('pty:resume', (_, id) => {
      try {
        CQLSHInstances[id].resume()
      } catch (e) {}
    })

    // Close the instance (kill and destroy)
    IPCMain.on('pty:close', (_, id) => {
      try {
        CQLSHInstances[id].close()
      } catch (e) {}
    })

    // Test connection with a cluster
    IPCMain.on('pty:test-connection', (_, data) => {
      // Call this function from `pty.js` file
      Modules.Pty.testConnectionWithCluster(mainView, data)
    })

    // Create a Bash session
    IPCMain.on(`pty:create:bash-session`, (_, data) => {
      Modules.Pty.bashSession(mainView, {
        ...data,
        IPCMain
      })
    })
  }

  /**
   * Requests related to the logging system
   * All requests have the prefix `logging:`
   */
  {
    // Initialize the logging system
    IPCMain.on('logging:init', (_, data) => {
      // Create a `logging` object and refer to it via the global `logging` variable
      logging = new Modules.Logging.Logging(data)
    })

    // Add a new log text
    IPCMain.on('logging:add', (_, data) => {
      try {
        logging.addLog(data)
      } catch (e) {}
    })
  }

  /**
   * Requests to perform processes in the background
   * Processes will be executed in the `backgroundProcessesView` view
   */
  {
    // SSH tunnel creation and related processes
    {
      // Create an SSH tunnel
      IPCMain.on('ssh-tunnel:create', (_, data) => {
        // Send the request to the background processes' renderer thread
        backgroundProcessesView.webContents.send('ssh-tunnel:create', data)

        // Once we received a response
        IPCMain.on(`ssh-tunnel:create:result:${data.requestID}`, (_, data) => {
          // Send the response to the main renderer thread
          mainView.webContents.send(`ssh-tunnel:create:result:${data.requestID}`, data)
        })
      })

      // Close an SSH tunnel based on the given cluster's ID - or the port -
      IPCMain.on(`ssh-tunnel:close`, (_, clusterID) => {
        // Send the request to the background processes' renderer thread
        backgroundProcessesView.webContents.send('ssh-tunnel:close', clusterID)
      })

      /**
       * Update an SSH tunnel's key/ID in the `sshTunnels` array with another new one
       * The process is mainly for changing the old temporary tunnel ID with the associated cluster's ID
       */
      IPCMain.on(`ssh-tunnel:update`, (_, data) => {
        // Send the request to the background processes' renderer thread
        backgroundProcessesView.webContents.send('ssh-tunnel:update', data)
      })
    }

    // Detect differentiation between two texts
    {
      IPCMain.on('detect-differentiation', (_, data) => {
        // Send the request to the background processes' renderer thread
        backgroundProcessesView.webContents.send('detect-differentiation', data)

        // Once we received a response
        IPCMain.on(`detect-differentiation:result:${data.requestID}`, (_, data) => {
          // Send the response to the main renderer thread
          mainView.webContents.send(`detect-differentiation:result:${data.requestID}`, data)
        })
      })
    }
  }

  /**
   * Requests from extra options/actions
   * All requests have the prefix `options:`
   */
  {
    // Toggle the fullscreen mode
    IPCMain.on('options:view:toggle-fullscreen', () => mainView.setFullScreen(!mainView.isFullScreen()))

    // Restart the entire app
    IPCMain.on('options:actions:restart', () => {
      // Close the main window
      mainView.close()

      // Relaunch the app
      App.relaunch()
    })

    // Entirely quit from the app
    IPCMain.on('options:actions:quit', () => {
      // Make sure the quit action will be performed well on macOS
      macOSForceClose = true

      // Close the main window
      mainView.close()
    })
  }

  /**
   * Different requests that aren't related
   * Request to create a dialog
   */
  IPCMain.on('dialog:create', (_, data) => Modules.Dialogs.createDialog(mainView, data))

  // Request to know if the main window is currently being focused on or not
  IPCMain.on('window:focused', (_, data) => mainView.webContents.send('window:focused', mainView.isFocused()))

  // Request to get the public key from the keys generator tool
  IPCMain.on('public-key:get', (_, id) => {
    // Define the bin folder path
    let binFolder = Path.join(__dirname, 'bin')

    // Make sure the tool is executable on Linux and macOS
    if (process.platform !== 'win32')
      Terminal.runSync(`cd '${binFolder}' && chmod +x keys_generator`)

    // Run the keys generator tool
    let binCall = `./keys_generator`

    // If the host is Windows
    binCall = (process.platform == 'win32') ? `keys_generator.exe` : binCall

    // Execute the command, get the public key and send it to the renderer thread
    Terminal.run(`cd "${binFolder}" && ${binCall}`, (err, publicKey, stderr) => mainView.webContents.send(`public-key:${id}`, (err || stderr) ? '' : publicKey))
  })

  /**
   * Request to run a script
   * Given data: {id, scriptPath}
   */
  IPCMain.on('script:run', (_, data) => Modules.Scripts.executeScript(mainView, Terminal, data))

  // Show the documentation view
  IPCMain.on('documentation-view:show', () => documentationView.show())

  // Request to change the content protection state
  IPCMain.on('content-protection', (_, apply) => mainView.setContentProtection(apply))
}

/**
 * Enabling this code block will cause the app to crash within 5 seconds
 * It's useful to test the crash report system
 */
// try {
//   setTimeout(() => {
//     process.crash()
//   }, 5000)
// } catch (e) {}
