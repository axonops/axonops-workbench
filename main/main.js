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
global.Electron = require('electron')
/**
 * Import different sub-modules from the Electron module
 *
 * `app`
 * For controlling the app's event life cycle
 * https://www.electronjs.org/docs/latest/api/app
 *
 */
global.App = Electron.app
/**
 * `BrowserWindow`
 * Used to create and manage windows within the app
 * https://www.electronjs.org/docs/latest/api/browser-window
 *
 */
global.Window = Electron.BrowserWindow
/**
 * `Menu`
 * Creating native application menus and context menus
 * https://www.electronjs.org/docs/latest/api/menu
 *
 */
global.Menu = Electron.Menu
/**
 * `MenuItem`
 * For adding items to native application menus and context menus
 * https://www.electronjs.org/docs/latest/api/menu-item
 *
 */
global.MenuItem = Electron.MenuItem
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
// GLobal boolea value to tell if the workbench has been started in CLI mode or not
global.IsCLIMode = false

/**
 * Check if the app is in production environment
 * https://www.electronjs.org/docs/latest/api/app#appispackaged-readonly
 *
 * Based on checking result the extra resources path would be changed
 */
global.extraResourcesPath = App.isPackaged ? Path.join(App.getPath('home'), (process.platform != 'win32' ? '.' : '') + 'axonops-workbench') : null

global.terminatedTestsIDs = []

// Define a CLI object
let CLI

try {
  // Attempt to get the CLI module
  CLI = require(Path.join(__dirname, '..', 'custom_modules', 'main', 'argv'))

  /**
   * Initialize the CLI object
   * The initialization process here checks if the workbench needs to start in CLI mode or not by chaning the value of `IsCLIMode`
   */
  CLI.init()
} catch (e) {}

/**
 * Import extra modules needed in the main thread
 *
 * Node.js URL module
 * For URL resolution and parsing
 */
const URL = require('url')
/**
 * Node.js events module
 * Used for creating and handling custom events
 */
global.EventEmitter = require('events')
// Enable - ready to be used - right-click context menu
global.ContextMenu = require('electron-context-menu')
// Used to position the windows of the application.
global.Positioner = require('electron-positioner')
// Loads environment variables from a .env file into process.env
global.DotEnv = require('dotenv')

/**
 * Define global variables that will be used in different scopes in the main thread
 *
 * Create an event emitter object from the `events` class
 *
 */
global.eventEmitter = new EventEmitter()

// Import the set customized logging addition function and make it global across the entire thread
global.addLog = null

// Define customized function to create an error log
global.errorLog = null

// Whether or not logging feature is enabled
global.isLoggingFeatureEnabled = false

// Set the proper add log function
try {
  global.addLog = require(Path.join(__dirname, '..', 'custom_modules', 'main', 'setlogging')).addLog
} catch (e) {}

// Set an error log function
try {
  global.errorLog = (error, process) => {
    /**
     * Whether the error is a number or not
     * If so, then this error has been thrown for a purpose and there's no need to log it
     */
    let isErrorNotNumber = isNaN(parseInt(error.toString()))

    // If this flag is false then don't log the error
    if (!isErrorNotNumber)
      return

    // Add the error stack if possible
    let errorStack = ''

    try {
      errorStack = error.stack ? `. Stack ${error.stack}` : ''
    } catch (e) {}

    // Log the error
    try {
      addLog(`Error in process ${process}. Details: ${error}${errorStack}`, 'error')
    } catch (e) {}
  }
} catch (e) {}

/**
 * Import the custom node modules for the main thread
 *
 * `Modules` constant will contain all the custom modules
 */
global.Modules = []

try {
  // Define the folder's path of the custom node modules
  let modulesFilesPath = Path.join(__dirname, '..', 'custom_modules', 'main'),
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

      // Ignore any file which is not `JS` or it's the arguments module
      if (!moduleFile.endsWith('.js') || moduleFile.startsWith('argv'))
        return

      // Define the module's name
      let moduleName = moduleFile.slice(0, moduleFile.indexOf('.js'))

      // Capitalize the name
      moduleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1)

      // Import the module
      Modules[moduleName] = require(Path.join(modulesFilesPath, moduleFile))

      try {
        addLog(`'${moduleName}' has been loaded in the main thread`)
      } catch (e) {}
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
const areDevToolsEnabled = process.env.AXONOPS_DEV_TOOLS == 'true'

// Object that will hold all views/windows of the app
global.views = {
  // The main view/window object
  main: null,
  // A view/window as a loding screen
  intro: null,
  // A view/window for all background processes
  backgroundProcesses: null
}

// An array which saves all cqlsh instances with their ID - connection ID - given by the renderer thread
global.CQLSHInstances = []
// Whether or not the user wants to completely quit the application. This occurs when all renderer threads are terminated or closed
global.isMacOSForcedClose = false
// A `logging` object which will be created once the app is ready
global.logging = null

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
  try {
    windowObject = new Window(properties)
  } catch (e) {}

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
    try {
      if (extraProperties.maximize)
        windowObject.maximize()
    } catch (e) {}

    // Whether or not the window should be shown
    try {
      if (extraProperties.show && !global.IsCLIMode)
        windowObject.show()
    } catch (e) {}

    // Whether or not developer tools should be opened
    try {
      if (extraProperties.openDevTools && !global.IsCLIMode)
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
    minHeight: 768,
    center: true,
    icon: AppProps.Paths.Icon,
    title: AppProps.Info.title,
    backgroundColor: '#17181a',
    show: false,
    webPreferences: {
      devTools: areDevToolsEnabled,
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
    openDevTools: areDevToolsEnabled
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

// When the app is ready a renderer thread should be created and started
App.on('ready', () => {
  // Force to run only one instance of the app at once
  try {
    /**
     * https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
     * Quit/terminate that new instance
     */
    if (!(App.requestSingleInstanceLock() || global.IsCLIMode))
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

    /**
     * Call the `start` function of the CLI mode
     * It'll be effective in case the workbench has started in CLI mode
     */
    try {
      CLI.start()
    } catch (e) {}

    /**
     * Create the intro view/window with custom properties
     * This window will be destroyed once the main view/window and its children loaded
     */
    views.intro = createWindow({
      ...properties,
      width: 700,
      height: 425,
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
      show: !global.IsCLIMode
    }, Path.join(AppProps.Paths.MainView, '..', 'intro.html'), {
      show: true,
      center: true,
      parent: views.main
    })

    // In CLI mode there's no need to wait for an acknowledgement from the renderer thread about being loaded and initialized
    if (global.IsCLIMode) {
      status.loaded = true
      status.initialized = true
    }
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

  // Define the status of the renderer thread
  let status = {
    initialized: false,
    loaded: false
  }

  /**
   * Once a `loaded` message is received from the main view - renderer thread -
   * Also `initialized` message
   */
  IPCMain.on('loaded', () => status.loaded = true)

  IPCMain.on('initialized', () => status.initialized = true)

  // Define a function to check the renderer view status
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
          if (global.IsCLIMode)
            throw 0

          views.main.show()
          views.main.maximize()
        } catch (e) {}

        /**
         * Send a `shown` status to the main view
         * This will tell the app to load workspaces
         */
        setTimeout(() => views.main.webContents.send('windows-shown'))
      }, 100)
    }, 125)
  }

  // Call the checking function
  checkStatus()

  // Set the menu bar to `null`; so it won't be created
  Menu.setApplicationMenu(null)

  // Variable to prevent the immediate closure of the main view; so we have time to save the logs and terminate cqlsh sessions
  let isMainViewClosePrevented = true

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
      if (!isMainViewClosePrevented)
        throw 0

      // Prevent the default behavior for this event
      event.preventDefault()

      // Set to `false`; to skip this try-catch block on the next call of event `close`
      isMainViewClosePrevented = false
    } catch (e) {}

    // Close all active work areas - connections and sandbox projects -
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
App.on('second-instance', (event, argv, workingDirectory, additionalData) => {
  try {
    // If the attempt is to run the workbench in CLI mode then there's no need to restore the main view or focus on it
    if (global.IsCLIMode || (argv || []).includes('--is-cli'))
      throw 0

    // Restore the main's instance's window
    if (views.main.isMinimized())
      views.main.restore()

    // And focus it
    views.main.focus()
  } catch (e) {}
})

// Handle all requests from the renderer thread
{
  require(Path.join(__dirname, 'ipc'))
}
