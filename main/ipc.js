const NativeImage = Electron.nativeImage,
  NativeTheme = Electron.nativeTheme

/**
 * Requests related to pty instances
 * All requests have the prefix `pty:`
 */
{
  // Create a pty instance - which will create a cqlsh instance as well -
  IPCMain.on('pty:create', (_, data) => {
    // Close/end any instance related to the connection
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
      if (!data.isSourceCommand)
        throw 0

      CQLSHInstances[data.id].sourceCommand(data.cmd, data.blockID, views.backgroundProcesses)

      views.backgroundProcesses.webContents.send('cql:file:execute', data)

      return
    } catch (e) {}

    try {
      CQLSHInstances[data.id].command(data.cmd, data.blockID)
    } catch (e) {}
  })

  IPCMain.on('cql:file:execute:data', (_, data) => views.main.webContents.send(`cql:file:execute:data:${data.id}`, data))

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

  // Get the metadata of a connection
  IPCMain.on('pty:metadata', (_, data) => {
    try {
      CQLSHInstances[data.id].getMetadata(data.metadataSendID, data.currentBuffer)
    } catch (e) {}
  })

  // Get the CQL description of a connection, keyspace in it, or table
  IPCMain.on('pty:cql-desc', (_, data) => {
    try {
      CQLSHInstances[data.id].getCQLDescription(data.cqlDescSendID, data.scope, data.currentBuffer)
    } catch (e) {}
  })

  // Check the connectivity with a connection
  IPCMain.on('pty:check-connection', (_, data) => {
    try {
      CQLSHInstances[data.id].checkConnectivity(data.checkConnectivityRequestID, data.currentBuffer)
    } catch (e) {}
  })

  // Get the result of the query tracing process
  IPCMain.on('pty:query-tracing', (_, data) => {
    try {
      CQLSHInstances[data.connectionID].getQueryTracing(data.id, data.sessionID, data.currentBuffer)
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

  // Test connection with a connection
  IPCMain.on('pty:test-connection', (_, data) => {
    // Call this function from `pty.js` file
    Modules.Pty.testConnection(views.main, data)
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

    isLoggingFeatureEnabled = true

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
  })

  // Get logs folder's path and current session's log file name if possible
  IPCMain.handle('logging:get:info', () => {
    let loggingSessionFileName = null

    try {
      loggingSessionFileName = logging.logginSessionFileName
    } catch (e) {}

    return {
      folder: Path.join(extraResourcesPath != null ? App.getPath('logs') : Path.join(__dirname, '..', 'data', 'logging')),
      file: loggingSessionFileName
    }
  })
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

    // Close an SSH tunnel based on the given connection's ID - or the port -
    IPCMain.on(`ssh-tunnel:close`, (_, connectionID) => {
      // Send the request to the background processes' renderer thread
      views.backgroundProcesses.webContents.send('ssh-tunnel:close', connectionID)
    })

    /**
     * Update an SSH tunnel's key/ID in the `sshTunnelsObjects` array with another new one
     * The process is mainly for changing the old temporary tunnel ID with the associated connection's ID
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

  {
    IPCMain.on('blob:read-convert', (_, data) => {
      // Send the request to the background processes' renderer thread
      views.backgroundProcesses.webContents.send('blob:read-convert', data)

      IPCMain.on(`blob:read-convert:result:${data.requestID}`, (_, data) => {
        // Send the response to the renderer thread
        views.main.webContents.send(`blob:read-convert:result:${data.requestID}`, data)
      })
    })

    IPCMain.on('blob:convert-write', (_, data) => {
      // Send the request to the background processes' renderer thread
      views.backgroundProcesses.webContents.send('blob:convert-write', data)

      IPCMain.on(`blob:convert-write:result:${data.requestID}`, (_, data) => {
        // Send the response to the renderer thread
        views.main.webContents.send(`blob:convert-write:result:${data.requestID}`, data)
      })
    })
  }

  {
    IPCMain.on('background:text:encrypt', (_, data) => views.backgroundProcesses.webContents.send('background:text:encrypt', data))

    IPCMain.on('background:text:decrypt', (_, data) => {
      // Send the request to the background processes' renderer thread
      views.backgroundProcesses.webContents.send('background:text:decrypt', data)

      // Once a response is received
      IPCMain.on(`background:text:decrypt:result:${data.requestID}`, (_, decryptedText) => {
        // Send the response to the renderer thread
        views.main.webContents.send(`background:text:decrypt:result:${data.requestID}`, decryptedText)
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

  // Called in the init process, it'll terminate the entire app
  IPCMain.on('options:actions:quit:init', () => {
    // Make sure the quit action will be performed well on macOS
    isMacOSForcedClose = true

    // Quite the entire app
    try {
      App.quit()
    } catch (e) {}
  })
}

/**
 * Different requests that aren't related
 * Request to create a dialog
 */
IPCMain.on('dialog:create', (_, data) => Modules.Dialogs.createDialog(views.main, data))

// Request to create an info/error/warning box
IPCMain.on('box:create', (_, data) => {
  try {
    if (data.isInitError)
      views.intro.hide()
  } catch (e) {}

  Modules.Dialogs.createBox(data.isInitError ? views.intro : views.main, data)
})

// Request to know whether the main window is currently being focused on or not
IPCMain.handle('window:focused', () => views.main.isFocused())

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
  let lastRequestTimestamp = 0,
    handleItems = (items) => {
      for (let item of items) {
        if (item.submenu != undefined)
          handleItems(item.submenu)

        // Use `eval` to convert the click's content from string format to actual function
        try {
          item.click = eval(item.click)
        } catch (e) {}

        try {
          item.icon = NativeImage.createFromPath(item.icon)
        } catch (e) {
          item.icon = ''
        }
      }
    }

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
      if (item.submenu != undefined)
        handleItems(item.submenu)

      try {
        // Use `eval` to convert the click's content from string format to actual function
        try {
          item.click = eval(item.click)
        } catch (e) {}

        try {
          item.icon = NativeImage.createFromPath(item.icon)
        } catch (e) {
          item.icon = ''
        }

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

IPCMain.on('badge:update', (_, numOfActiveWorkareas) => {
  try {
    App.setBadgeCount(numOfActiveWorkareas)
  } catch (e) {}
})

{
  IPCMain.on('theme:is-dark', () => views.main.webContents.send('theme:is-dark', NativeTheme.shouldUseDarkColors))

  NativeTheme.on('updated', () => views.main.webContents.send('theme:is-dark', NativeTheme.shouldUseDarkColors))
}
