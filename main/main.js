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
 * The main - singular - thread for the app overall
 *
 * https://www.electronjs.org/docs/latest/glossary#main-process
 *
 * Import the compilation cache optimizer
 * It attaches a require hook to use V8's code cache to speed up instantiation time
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
   * https://www.electronjs.org/docs/latest/api/app
   *
   */
  App = Electron.app,
  /**
   * `BrowserWindow`
   * Used to create and manage windows within the app
   * https://www.electronjs.org/docs/latest/api/browser-window
   *
   */
  Window = Electron.BrowserWindow,
  /**
   * `Menu`
   * Creating native application menus and context menus
   * https://www.electronjs.org/docs/latest/api/menu
   *
   */
  Menu = Electron.Menu,
  /**
   * `MenuItem`
   * For adding items to native application menus and context menus
   * https://www.electronjs.org/docs/latest/api/menu-item
   *
   */
  MenuItem = Electron.MenuItem

/**
 * Import modules globally
 * Those modules can be reached from all sub-modules of the main thread, such as `pty` and `config` sub-modules
 *
 * `ipcMain`
 * For communicating asynchronously from the main thread to the renderer thread(s)
 * https://www.electronjs.org/docs/latest/api/ipc-main
 *
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
 * Node.js OS module
 * Used for operating system-related utilities and properties
 */
global.OS = require('os')

/**
 * Import extra modules needed in the main thread
 *
 * Node.js URL module
 * For URL resolution and parsing
 */
const URL = require('url'),
  /**
   * Node.js events module
   * Used for creating and handling custom events
   */
  EventEmitter = require('events'),
  // Enable - ready to be used - right-click context menu
  ContextMenu = require('electron-context-menu'),
  // Used to position the windows of the application.
  Positioner = require('electron-positioner'),
  // Loads environment variables from a .env file into process.env
  DotEnv = require('dotenv')

/**
 * Check if the app is in production environment
 * https://www.electronjs.org/docs/latest/api/app#appispackaged-readonly
 *
 * Based on checking result the extra resources path would be changed
 */
global.extraResourcesPath = App.isPackaged ? Path.join(App.getPath('home'), (process.platform != 'win32' ? '.' : '') + 'axonops-workbench') : null

/**
 * Import the custom node modules for the main thread
 *
 * `Modules` constant will contain all the custom modules
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
      moduleFile = `${moduleFile}`.toLowerCase()

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

// Load environment variables from .env file
try {
  DotEnv.config({
    path: Path.join(__dirname, '..', '.env')
  })
} catch (e) {}

// Flag to tell whether or not dev tools are enabled
const isDevToolsEnabled = process.env.AXONOPS_DEV_TOOLS == 'true'

/**
 * Define global variables that will be used in different scopes in the main thread
 *
 * Create an event emitter object from the `events` class
 *
 */
global.eventEmitter = new EventEmitter()

// Import the set customized logging addition function and make it global across the entire thread
global.addLog = null

// Set the proper add log function
try {
  global.addLog = require(Path.join(__dirname, '..', 'custom_node_modules', 'main', 'setlogging')).addLog
} catch (e) {}

// Object that will hold all views/windows of the app
let views = {
  // The main view/window object
  main: null,
  // A view/window as a loding screen
  intro: null,
  // A view/window for all background processes
  backgroundProcesses: null
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
 * {object} `?callback` callback function which triggered when the thread has been loaded
 *
 * @Return: {object} the created window's object
 */
let createWindow = (properties, viewPath, extraProperties = {}, callback = null) => {
  let windowObject = null // Window object which be returned

  // Create a window with the given properties
  windowObject = new Window(properties)

  // Load the main HTML file of that window
  try {
    windowObject.loadURL(URL.format({
      pathname: viewPath,
      protocol: 'file:',
      slashes: true
    }))
  } catch (e) {}

  // Whether or not the window should be at the center of the screen
  if (extraProperties.center)
    try {
      // Call the custom module to center the window
      (new Positioner(windowObject)).move('center')

      // Call the native `BrowserWindow` centering function
      windowObject.center()
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

    // Attempt to call the callback function
    try {
      callback()
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
    backgroundColor: '#17181a',
    show: false,
    webPreferences: {
      devTools: isDevToolsEnabled,
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
    openDevTools: isDevToolsEnabled
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
/*
try {
  Modules.Reports.startCrashingHandler()
} catch (e) {}
*/

// When the app is ready a renderer thread should be created and started
App.on('ready', () => {
  // Force to run only one instance of the app at once
  try {
    // https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
    if (App.requestSingleInstanceLock())
      throw 0

    // Quit/terminate that new instance
    App.quit()
  } catch (e) {}

  // Create the main view, and pass the properties
  views.main = createWindow(properties, AppProps.Paths.MainView, extraProperties, () => {
    // Send the set extra resources path to the main renderer thread
    try {
      views.main.webContents.send(`extra-resources-path`, extraResourcesPath)
    } catch (e) {}
  })

  // Create the background processes' view/window and make it hidden; as there's no need for a window or GUI for it
  views.backgroundProcesses = createWindow(properties, Path.join(AppProps.Paths.MainView, '..', 'background.html'), {
    show: false,
    // openDevTools: true,
    parent: views.main
  }, () => {
    // Send the set extra resources path to the background processes renderer thread
    try {
      views.backgroundProcesses.webContents.send(`extra-resources-path`, extraResourcesPath)
    } catch (e) {}
  })

  /**
   * Create the intro view/window with custom properties
   * This window will be destroyed once the main view/window and its children loaded
   */
  views.intro = createWindow({
    ...properties,
    width: 700,
    height: 400,
    transparent: true,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    thickFrame: false,
    center: true,
    show: true
  }, Path.join(AppProps.Paths.MainView, '..', 'intro.html'), {
    show: true,
    center: true,
    parent: views.main
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
      try {
        views.main.close()
      } catch (e) {}
    } catch (e) {}
  })
  let status = {
    initialized: false,
    loaded: false
  }

  // Once a `loaded` event is received from the main view
  IPCMain.on('loaded', () => {
    status.loaded = true
  })

  IPCMain.on('initialized', () => {
    status.initialized = true
  })

  let checkStatus = () => {
    setTimeout(() => {
      if (!status.loaded || !status.initialized)
        return checkStatus()

      // Trigger after 1s of loading the main view
      setTimeout(() => {
        // Destroy the intro view/window entirely
        try {
          views.intro.destroy()
        } catch (e) {}

        // Show the main view/window and maximize it
        try {
          views.main.show()
          views.main.maximize()
        } catch (e) {}

        /**
         * Send a `shown` status to the main view
         * This will tell the app to load workspaces
         */
        setTimeout(() => views.main.webContents.send('windows-shown'), 100)
      }, 800)
    }, 900)
  }

  checkStatus()

  // Set the menu bar to `null`; so it won't be created
  Menu.setApplicationMenu(null)

  // Variable to prevent the immediate closure of the main view; so we have time to save the logs and terminate cqlsh sessions
  let isMainViewPreventClose = true

  // Once the `close` event is triggered
  views.main.on('close', (event) => {
    // Special process for macOS only
    try {
      // If the current OS is not macOS or there's a force to close the windows then skip this try-catch block
      if (process.platform != 'darwin' || isMacOSForcedClose)
        throw 0

      // On macOS, just minimize the main window when the user clicks the `X` button
      try {
        views.main.minimize()
      } catch (e) {}

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
App.on('window-all-closed', () => {
  try {
    App.quit()
  } catch (e) {}
})

// On attempt to run a second instance
App.on('second-instance', () => {
  try {
    // Restore the main's instance's window
    if (views.main.isMinimized())
      views.main.restore()

    // And focus it
    views.main.focus()
  } catch (e) {}
})

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
        CQLSHInstances[data.id].createCQLSHInstance(data)
      } catch (e) {}
    })

    // Send a command to the pty instance
    IPCMain.on('pty:command', (_, data) => {
      try {
        CQLSHInstances[data.id].command(data.cmd, data.blockID)
      } catch (e) {}
    })

    // Send a realtime data to the pty instance - while the user is acutally typing
    IPCMain.on('pty:data', (_, data) => {
      try {
        CQLSHInstances[data.id].realtimeData(data.char)
      } catch (e) {}
    })

    // Send a resize request to the pty instance based on the app's associated UI terminal
    IPCMain.on('pty:resize', (_, data) => {
      try {
        CQLSHInstances[data.id].resize(data)
      } catch (e) {}
    })

    // Get the metadata of a cluster
    IPCMain.on('pty:metadata', (_, data) => {
      try {
        CQLSHInstances[data.id].getMetadata(data.metadataSendID, data.currentBuffer)
      } catch (e) {}
    })

    // Get the CQL description of a cluster, keyspace in it, or table
    IPCMain.on('pty:cql-desc', (_, data) => {
      try {
        CQLSHInstances[data.id].getCQLDescription(data.cqlDescSendID, data.scope, data.currentBuffer)
      } catch (e) {}
    })

    // Check the connectivity with a cluster
    IPCMain.on('pty:check-connection', (_, data) => {
      try {
        CQLSHInstances[data.id].checkConnectivity(data.checkConnectivityRequestID, data.currentBuffer)
      } catch (e) {}
    })

    // Get the result of the query tracing process
    IPCMain.on('pty:query-tracing', (_, data) => {
      try {
        CQLSHInstances[data.clusterID].getQueryTracing(data.id, data.sessionID, data.currentBuffer)
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

    // Terminate a connection test process - especially docker/sandbox project -
    IPCMain.on(`pty:test-connection:terminate`, (_, requestID) => {
      // Send the request to associated renderer thread
      views.main.webContents.send(`pty:test-connection:${requestID}`, {
        connected: false,
        terminated: true,
        requestID
      })
    })

    // Create a Bash session
    IPCMain.on(`pty:create:bash-session`, (_, data) => {
      Modules.Pty.bashSession(views.main, {
        ...data,
        IPCMain
      })
    })

    IPCMain.on('pty:cqlsh:initialize', () => Modules.Pty.initializeCQLSH(views.main))
  }

  /**
   * Requests related to the logging system
   * All requests have the prefix `logging:`
   */
  {
    // Initialize the logging system
    IPCMain.on('logging:init', (_, data) => {
      // Create a `logging` object and refer to it via the global `logging` variable
      try {
        logging = new Modules.Logging.Logging(data)
      } catch (e) {}
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

      // Terminate an SSH tunnel creation process
      IPCMain.on(`ssh-tunnel:terminate`, (_, requestID) => {
        // Send the request to the background processes' renderer thread
        views.main.webContents.send(`ssh-tunnel:create:result:${requestID}`, {
          object: null,
          port: 0,
          error: 'Creation process has been terminated',
          terminated: true,
          requestID
        })

        // Send request to close the created SSH tunnel as the process has been terminated
        views.backgroundProcesses.webContents.send(`ssh-tunnel:close:queue`, requestID)
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
      // Make sure the quit action will be performed well on macOS
      isMacOSForcedClose = true

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
    let runKeysGenerator = () => {
      // Define the bin folder path
      // let binFolder = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath, 'main') : Path.join(__dirname)), 'bin')
      let binFolder = Path.join((extraResourcesPath != null ? Path.join(__dirname, '..', '..', 'main') : Path.join(__dirname)), 'bin', 'keys_generator')

      // Switch to the single-file mode
      try {
        if (!FS.lstatSync(binFolder).isDirectory())
          binFolder = Path.join(binFolder, '..')
      } catch (e) {}

      // Run the keys generator tool
      let binCall = `./keys_generator`

      // If the host is Windows
      binCall = (process.platform == 'win32') ? `keys_generator.exe` : binCall

      // Execute the command, get the public key, and send it to the renderer thread
      Terminal.run(`cd "${binFolder}" && ${binCall}`, (err, publicKey, stderr) => views.main.webContents.send(`public-key:${id}`, (err || stderr) ? '' : publicKey))
    }

    try {
      if (OS.platform() != 'darwin') {
        runKeysGenerator()
        throw 0
      }

      Modules.Pty.runKeysGenerator((publicKey) => {
        if (publicKey != null)
          return views.main.webContents.send(`public-key:${id}`, publicKey)

        runKeysGenerator()
      })
    } catch (e) {}
  })

  /**
   * Request to run a script
   * Given data: {id, scriptPath}
   */
  IPCMain.on('script:run', (_, data) => Modules.Scripts.executeScript(views.main, Terminal, data))

  // Request to change the content protection state
  IPCMain.on('content-protection', (_, apply) => views.main.setContentProtection(apply))

  // Request to get the app's current path
  IPCMain.handle('app-path:get', () => {
    // Get the app's path
    let path = App.getAppPath()

    // If the app in production environment
    if (App.isPackaged)
      path = Path.join(path, '..')

    // Return the app's final path
    return path
  })

  // Request to get the copyright acknowledgement status
  IPCMain.on('cassandra-copyright-acknowledged', () => Modules.Config.getConfig((config) => {
    // Define the initial value
    let result = false

    // Attempt to get the saved value
    try {
      result = config.get('security', 'cassandraCopyrightAcknowledged') == 'true'
    } catch (e) {}

    // Send the result
    views.intro.webContents.send('cassandra-copyright-acknowledged', result)
  }))

  // Request to set the copyright acknowledgement to be `true`
  IPCMain.on('cassandra-copyright-acknowledged:true', () => {
    setTimeout(() => {
      // Get the app's current config
      Modules.Config.getConfig((config) => {
        try {
          // Set the associated key to be `true`
          config.set('security', 'cassandraCopyrightAcknowledged', 'true')

          // Write the new config values
          Modules.Config.setConfig(config)
        } catch (e) {}
      })
    }, 5000)
  })

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

  // Check whether or not the current app's format supported by the auto update process
  IPCMain.handle('check-app-format', () => {
    let info = {}

    try {
      info = {
        devMode: !App.isPackaged,
        macOSAppStore: process.mas,
        windowsStore: process.windowsStore,
        linuxSnap: process.env.SNAP || process.env.SNAP_REVISION,
        linuxFlatpak: process.env.FLATPAK_ID
      }

      Object.keys(info).forEach((format) => {
        info[format] = info[format] || false
      })
    } catch (e) {}

    return info
  })
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
