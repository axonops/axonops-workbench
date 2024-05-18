/**
 * The main - singular - thread for the app overall
 *
 * Import the compilation cache optimizer
 */
require('v8-compile-cache')

/**
 * Import Electron module and its sub-modules
 *
 * Import the main module
 */
const Electron = require('electron'),
  /**
   * Import different sub-modules from the Electron module
   *
   * `app`
   * For controlling the app's event life cycle
   */
  App = Electron.app,
  /**
   * `BrowserWindow`
   * Used to create and manage windows within the app
   */
  Window = Electron.BrowserWindow,
  /**
   * `Menu`
   * Creating native application menus and context menus
   */
  Menu = Electron.Menu,
  /**
   * `MenuItem`
   * For adding items to native application menus and context menus
   */
  MenuItem = Electron.MenuItem

/**
 * Import modules globally
 * Those modules can be reached from all sub-modules of the main module, such as `pty` and `config`
 *
 * `ipcMain`
 * For communicating asynchronously from the main thread to the renderer thread(s)
 */
global.IPCMain = Electron.ipcMain
// Execute commands across all platforms
global.Terminal = require('node-cmd')
/**
 * Import Node.js modules
 *
 * Node.js file system module - improved version that has methods that aren't included in the native fs module -
 * Used for working with files system, it provides related utilities
 */
global.FS = require('fs-extra')
/**
 * Node.js path module
 * Working with file and directory paths, and providing useful utilities
 */
global.Path = require('path')

/**
 * Node.js URL module
 * For URL resolution and parsing
 */
const URL = require('url'),
  /**
   * Node.js events module
   * Used for creating and handling custom events
   */
  EventEmitter = require('events')

/**
 * Import extra modules needed in the main thread
 *
 * Enable - ready to be used - right-click context menu
 */
const ContextMenu = require('electron-context-menu'),
  // Used to position the windows of the application.
  Positioner = require('electron-positioner')

/**
 * Import the custom node modules for the main thread
 *
 * Define the `Modules` constant that will contain all the custom modules
 */
const Modules = []

try {
  // Define the folder's path of the custom node modules
  let modulesFilesPath = Path.join(__dirname, '..', 'custom_node_modules', 'main'),
    // Read all files inside the folder
    modulesFiles = FS.readdirSync(modulesFilesPath)

  /**
   * Loop through each module file
   * Main modules are `pty`, `dialogs`, and `scripts`
   */
  modulesFiles.forEach((moduleFile) => {
    try {
      // Make sure the module file name is lowered case
      moduleFile = moduleFile.toLowerCase()

      // Ignore any file which is not `JS`
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

// Create an event emitter object from the `events` class
global.eventEmitter = new EventEmitter()

// Import the set customized logging addition function and make it global across the entire thread
global.addLog = require(Path.join(__dirname, '..', 'custom_node_modules', 'main', 'setlogging')).addLog

/**
 * Define global variables that will be used in different scopes in the main thread
 *
 * Object that will hold all views/windows of the app
 */
let views = {
  // The main view/window object
  main: null,
  // A view/window for all background processes
  backgroundProcesses: null,
  // A view/window for the app's offline documentation
  documentation: null
}

// An array that will save all cqlsh instances with their ID given by the renderer thread
let CQLSHInstances = [],
  // Whether or not the user wants to completely quit the application. This occurs when all renderer threads are terminated or closed
  isMacOSForcedClose = false,
  // A `logging` object which will be created once the app is ready
  logging = null

/**
 * Create a window with different passed properties
 *
 * @Parameters:
 * {object} `properties` the main properties of the window
 * {string} `viewPath` the path of the HTML file - which will be loaded as a renderer thread
 * {object} `?extraProperties` the extra properties of the window
 * Possible extra properties are: [`center`, `maximize`, `show`, `openDevTools`]
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
    try {
      (new Positioner(windowObject)).move('center')
    } catch (e) {}

  // When the window has loaded
  windowObject.webContents.on('did-finish-load', () => {
    /**
     * Check extra properties
     *
     * Maximizing the window size
     */
    if (extraProperties.maximize)
      try {
        windowObject.maximize()
      } catch (e) {}


    // Whether or not the window should be shown
    if (extraProperties.show)
      try {
        windowObject.show()
      } catch (e) {}

    // Whether or not developer tools should be opened
    if (extraProperties.openDevTools)
      try {
        windowObject.webContents.openDevTools()
      } catch (e) {}

    // Send the window's content's ID
    try {
      windowObject.webContents.send(`view-content-id`, windowObject.webContents.id)
    } catch (e) {}
  })

  // When the window is closed, the event has finished; set the window object reference to `null`
  windowObject.on('closed', () => {
    windowObject = null
  })

  // Return the window object
  return windowObject
}

// Define some app's properties
const AppProps = {
  Paths: {
    // The app's default icon path
    Icon: Path.join(__dirname, '..', 'renderer', 'assets', 'images', 'icon.ico'),
    // The app's main view/window - HTML file - path
    MainView: Path.join(__dirname, '..', 'renderer', 'views', 'index.html')
  },
  // Get the app's info
  Info: require(Path.join(__dirname, '..', 'package.json'))
}

/**
 * When the main thread is ready creates the main window/view
 *
 * Define the main view/window properties and extra properties, plus the right-click context menu properties
 */
let properties = {
    minWidth: 1266,
    minHeight: 668,
    center: true,
    icon: AppProps.Paths.Icon,
    title: AppProps.Info.title,
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
  views.main = createWindow(properties, AppProps.Paths.MainView, extraProperties)

  // Create the background processes' view/window and make it hidden; as there's no need for a window or GUI for it
  views.backgroundProcesses = createWindow(properties, Path.join(AppProps.Paths.MainView, '..', 'background.html'), {
    show: false,
    parent: views.main
  })

  // Create the documentation view
  views.documentation = createWindow({
    ...properties,
    title: `${properties.title} Documentation`
  }, Path.join(AppProps.Paths.MainView, '..', 'documentation', 'index.html'), {
    show: false,
    parent: views.main
  })

  /**
   * Create the intro view/window with custom properties
   * This window will be destroyed once the main view/window and its children loaded
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
  }, Path.join(AppProps.Paths.MainView, '..', 'intro.html'), {
    show: true,
    center: true,
    parent: views.main
  })

  // When the `close` event is triggered for the documentation view
  views.documentation.on('close', (event) => {
    // This will be set to `true` if the entire app is about to be closed
    if (!isDocumentationViewPreventClose)
      return

    // Prevent the default behavior - terminate the view/window -
    event.preventDefault()

    /**
     * Only hide the documentation view
     * In this way we prevent unnecessary loading and create time for the view/window each time it's called
     */
    views.documentation.hide()
  })

  /**
   * When the `close` event is triggered for the background processes view
   * This event is only triggered at the back-end and not by the user
   */
  views.backgroundProcesses.on('close', () => {
    // Update `isMacOSForcedClose` flag if needed
    try {
      // If the value is already `true` then skip this try-catch block
      if (isMacOSForcedClose)
        throw 0

      // Update the value
      isMacOSForcedClose = true

      // Call the `close` event for the `views.main` but this time with forcing the close of all windows
      views.main.close()
    } catch (e) {}
  })

  // Once a `loaded` event is received from the main view
  IPCMain.on('loaded', () => {
    // Trigger after 1s of loading the main view
    setTimeout(() => {
      // Destroy the intro view/window entirely
      introView.destroy()

      // Show the main view/window and maximize it
      views.main.show()
      views.main.maximize()
    }, 500)
  })

  // Set the menu bar to `null`; so it won't be created
  Menu.setApplicationMenu(null)

  // Variable to prevent the immediate closure of the main view; so we have time to save the logs and terminate cqlsh sessions
  let isMainViewPreventClose = true,
    isDocumentationViewPreventClose = true

  // Once the `close` event is triggered
  views.main.on('close', (event) => {
    // Special process for macOS only
    try {
      // If the current OS is not macOS or there's a force to close the windows then skip this try-catch block
      if (process.platform != 'darwin' || isMacOSForcedClose)
        throw 0

      // On macOS, just minimize the main window when the user clicks the `X` button
      views.main.minimize()

      // Prevent the default behavior
      event.preventDefault()

      // Skip the upcoming code
      return
    } catch (e) {}

    // The way we handle this event is by preventing its default behavior only once, then, we do what we need to do before the termination and after all processes are finished the `close` event is triggered again but it won't be prevented this time
    try {
      // If we don't need to prevent the `close` default behavior then we may skip this try-catch block
      if (!isMainViewPreventClose)
        throw 0

      // Prevent the default behavior for this event
      event.preventDefault()

      // Set to `false`; to skip this try-catch block on the next call of event `close`
      isMainViewPreventClose = false
    } catch (e) {}

    // Close all active work areas - clusters and sandbox projects -
    try {
      views.main.webContents.send(`app-terminating`)
    } catch (e) {} finally {
      // Once the pre-close processes finished we may trigger the `close` event again for all windows
      setTimeout(() => {
        // Close the main view
        try {
          views.main.close()
        } catch (e) {}

        // Close the background-processes view
        try {
          views.backgroundProcesses.close()
        } catch (e) {}

        // Close the documentation view
        try {
          // Set it to `true`; to close the documentation view/window and destroy it as well
          isDocumentationViewPreventClose = false

          // Close the documentation view
          views.documentation.close()
        } catch (e) {}
      }, 250)
    }
  })
})

// When there's an `activate` trigger for the app
App.on('activate', () => {
  // If the app is active but no window has been created for any reason then create the main one
  if (views.main === null)
    views.main = createWindow(properties, AppProps.Paths.MainView, extraProperties)

  // If the current OS is macOS then restore the state of the main window
  if (process.platform === 'darwin')
    views.main.restore()
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
        CQLSHInstances[data.id] = new Modules.Pty.Pty(views.main, data)
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

    // Get the CQL description of a cluster, keyspace in it, or table
    IPCMain.on('pty:cql-desc', (_, data) => {
      try {
        CQLSHInstances[data.id].getCQLDescription(data.cqlDescSendID, data.scope)
      } catch (e) {}
    })

    // Check the connectivity with a cluster
    IPCMain.on('pty:check-connection', (_, data) => {
      try {
        CQLSHInstances[data.id].checkConnectivity(data.checkConnectivityRequestID)
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
      Modules.Pty.testConnectionWithCluster(views.main, data)
    })

    // Create a Bash session
    IPCMain.on(`pty:create:bash-session`, (_, data) => {
      Modules.Pty.bashSession(views.main, {
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

    /**
     * Add a new log text
     *
     * Adding a new log can be processed via two methods:
     * First is using the `ipcMain` module, this method is used by the renderer threads
     * Second is by triggering a custom event using the `eventEmitter` module, this method is used inside the main thread
     */
    {
      // Define the event's name and its function/method
      let event = {
        name: 'logging:add',
        func: (_, data) => {
          try {
            logging.addLog(data)
          } catch (e) {}
        }
      }

      // Add a custom event to be triggered inside the main thread
      eventEmitter.addListener(event.name, event.func)

      // Listen to `add` log request from the renderer thread
      IPCMain.on(event.name, event.func)
    }
  }

  /**
   * Requests to perform processes in the background
   * Processes will be executed in the `views.backgroundProcesses` view
   */
  {
    // SSH tunnel creation and related processes
    {
      // Create an SSH tunnel
      IPCMain.on('ssh-tunnel:create', (_, data) => {
        // Send the request to the background processes' renderer thread
        views.backgroundProcesses.webContents.send('ssh-tunnel:create', data)

        // Once a response is received
        IPCMain.on(`ssh-tunnel:create:result:${data.requestID}`, (_, data) => {
          // Send the response to the renderer thread
          views.main.webContents.send(`ssh-tunnel:create:result:${data.requestID}`, data)
        })
      })

      // Close an SSH tunnel based on the given cluster's ID - or the port -
      IPCMain.on(`ssh-tunnel:close`, (_, clusterID) => {
        // Send the request to the background processes' renderer thread
        views.backgroundProcesses.webContents.send('ssh-tunnel:close', clusterID)
      })

      /**
       * Update an SSH tunnel's key/ID in the `sshTunnelsObjects` array with another new one
       * The process is mainly for changing the old temporary tunnel ID with the associated cluster's ID
       */
      IPCMain.on(`ssh-tunnel:update`, (_, data) => {
        // Send the request to the background processes' renderer thread
        views.backgroundProcesses.webContents.send('ssh-tunnel:update', data)
      })
    }

    // Detect differentiation between two texts
    {
      IPCMain.on('detect-differentiation', (_, data) => {
        // Send the request to the background processes' renderer thread
        views.backgroundProcesses.webContents.send('detect-differentiation', data)

        // Once we received a response
        IPCMain.on(`detect-differentiation:result:${data.requestID}`, (_, data) => {
          // Send the response to the renderer thread
          views.main.webContents.send(`detect-differentiation:result:${data.requestID}`, data)
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
    IPCMain.on('options:view:toggle-fullscreen', () => views.main.setFullScreen(!views.main.isFullScreen()))

    // Restart the entire app
    IPCMain.on('options:actions:restart', () => {
      // Close the main window
      views.main.close()

      // Relaunch the app
      App.relaunch()
    })

    // Entirely quit from the app
    IPCMain.on('options:actions:quit', () => {
      // Make sure the quit action will be performed well on macOS
      isMacOSForcedClose = true

      // Close the main window
      views.main.close()
    })
  }

  /**
   * Different requests that aren't related
   * Request to create a dialog
   */
  IPCMain.on('dialog:create', (_, data) => Modules.Dialogs.createDialog(views.main, data))

  // Request to know whether the main window is currently being focused on or not
  IPCMain.on('window:focused', (_, data) => views.main.webContents.send('window:focused', views.main.isFocused()))

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

    // Execute the command, get the public key, and send it to the renderer thread
    Terminal.run(`cd "${binFolder}" && ${binCall}`, (err, publicKey, stderr) => views.main.webContents.send(`public-key:${id}`, (err || stderr) ? '' : publicKey))
  })

  /**
   * Request to run a script
   * Given data: {id, scriptPath}
   */
  IPCMain.on('script:run', (_, data) => Modules.Scripts.executeScript(views.main, Terminal, data))

  // Show the documentation view
  IPCMain.on('documentation-view:show', () => views.documentation.show())

  // Request to change the content protection state
  IPCMain.on('content-protection', (_, apply) => views.main.setContentProtection(apply))

  /**
   * Show a pop-up context menu with passed items
   * Mainly used for getting CQL descriptions of right-clicked elements in the metadata tree view
   */
  {
    // Define a variable to hold the last request's timestamp
    let lastRequestTimestamp = 0

    // Received a request to show a right-click context-menu
    IPCMain.on('show-context-menu', (_, items) => {
      // Get the timestamp of receiving the request
      let requestTimestamp = new Date().getTime()

      // Make sure there's a 0.5s delay between each request
      if (requestTimestamp - lastRequestTimestamp <= 500)
        return

      // Update the last accepted request's timestamp
      lastRequestTimestamp = requestTimestamp

      // Create a menu object that will be a pop-up menu
      let popUpMenu = new Menu()

      // Parse the passed items from string format to JSON object
      items = JSON.parse(items)

      // Loop through each menu item
      for (let item of items) {
        try {
          // Use `eval` to convert the click's content from string format to actual function
          try {
            item.click = eval(item.click)
          } catch (e) {}

          // Append the menu item as a `MenuItem` object
          popUpMenu.append(new MenuItem(item))
        } catch (e) {}
      }

      // Pop-up/show the created menu
      popUpMenu.popup(views.main)
    })
  }
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
