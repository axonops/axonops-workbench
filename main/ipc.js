const NativeImage = Electron.nativeImage,
  NativeTheme = Electron.nativeTheme

const KeysGenerator = require('@mhmdkrmabd/rsa-keys-generator-node')
const keysServiceName = `AxonOpsWorkbench`

{
  IPCMain.on('pty:create', (_, data) => {
    try {
      CQLSHInstances[data.id].close()
    } catch (e) {}

    try {
      CQLSHInstances[data.id] = new Modules.Cqlsession.Session(views.main, data)
    } catch (e) {}

    try {
      CQLSHInstances[data.id].connect(data)
    } catch (e) {}
  })

  IPCMain.on('pty:command', (_, data) => {
    try {
      if (!data.isSourceCommand)
        throw 0

      let filesPaths = []

      try {
        filesPaths.push(data.cmd)
      } catch (e) {}

      CQLSHInstances[data.id].sourceCommand(filesPaths, data.stopOnError, data.blockID)

      return
    } catch (e) {}

    try {
      CQLSHInstances[data.id].command(data.cmd, data.blockID)
    } catch (e) {}
  })

  IPCMain.on('pty:fetch-next-query', (_, data) => {
    try {
      CQLSHInstances[data.id].fetchNextPage(data.queryID, data.blockID, data.subOutputID)
    } catch (e) {}
  })

  IPCMain.on('pty:stop-source-execution', (_, connectionID) => {
    try {
      CQLSHInstances[connectionID].stopSourceExecution()
    } catch (e) {}
  })

  IPCMain.on('pty:metadata', (_, data) => {
    try {
      CQLSHInstances[data.id].getMetadata(data.metadataSendID)
    } catch (e) {}
  })

  IPCMain.on('pty:cql-desc', (_, data) => {
    try {
      CQLSHInstances[data.id].getCQLDescription(data.cqlDescSendID, data.scope)
    } catch (e) {}
  })

  IPCMain.on('pty:query-tracing', (_, data) => {
    try {
      CQLSHInstances[data.connectionID].getQueryTracing(data.id, data.sessionID)
    } catch (e) {}
  })

  IPCMain.on('pty:close', (_, id) => {
    try {
      CQLSHInstances[id].close()
    } catch (e) {}
  })

  IPCMain.on('pty:test-connection', (_, data) => {
    Modules.Cqlsession.testConnection(views.main, data)
  })

  IPCMain.on(`pty:test-connection:terminate`, (_, requestID) => {
    if (global.terminatedTestsIDs.find((id) => id.requestID == requestID) != undefined)
      return

    global.terminatedTestsIDs.push({
      requestID,
      replySent: false
    })

    // Send the request to associated renderer thread
    views.main.webContents.send(`pty:test-connection:${requestID}`, {
      connected: false,
      terminated: true,
      requestID
    })
  })

  IPCMain.handle(`pty:get-info`, async (_, connectionID) => {
    let info = {}

    try {
      info = await CQLSHInstances[connectionID].sessionInstance.getInfo()
    } catch (e) {}

    return info
  })

  IPCMain.on(`pty:set-paging`, async (_, data) => {
    try {
      if (!(isNaN(data.value) || data.value <= 0))
        CQLSHInstances[data.id].sessionInstance.setPaging(data.value)
    } catch (e) {}
  })
}

{
  IPCMain.on('logging:init', (_, data) => {
    try {
      logging = new Modules.Logging.Logging(data)
    } catch (e) {}

    isLoggingFeatureEnabled = true

    {
      let event = {
        name: 'logging:add',
        func: (_, data) => {
          try {
            logging.addLog(data)
          } catch (e) {}
        }
      }

      eventEmitter.addListener(event.name, event.func)
      IPCMain.on(event.name, event.func)
    }
  })

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

{
  {
    IPCMain.on('ssh-tunnel:create', (_, data) => {
      views.backgroundProcesses.webContents.send('ssh-tunnel:create', data)

      IPCMain.on(`ssh-tunnel:create:result:${data.requestID}`, (_, data) => {
        views.main.webContents.send(`ssh-tunnel:create:result:${data.requestID}`, data)
      })
    })

    IPCMain.on(`ssh-tunnel:close`, (_, connectionID) => {
      views.backgroundProcesses.webContents.send('ssh-tunnel:close', connectionID)
    })

    IPCMain.on(`ssh-tunnel:update`, (_, data) => {
      views.backgroundProcesses.webContents.send('ssh-tunnel:update', data)
    })

    IPCMain.on(`ssh-tunnel:terminate`, (_, requestID) => {
      views.main.webContents.send(`ssh-tunnel:create:result:${requestID}`, {
        object: null,
        port: 0,
        error: 'Creation process has been terminated',
        terminated: true,
        requestID
      })

      views.backgroundProcesses.webContents.send(`ssh-tunnel:close:queue`, requestID)
    })
  }

  {
    IPCMain.on('detect-differentiation', (_, data) => {
      views.backgroundProcesses.webContents.send('detect-differentiation', data)

      IPCMain.on(`detect-differentiation:result:${data.requestID}`, (_, data) => {
        views.main.webContents.send(`detect-differentiation:result:${data.requestID}`, data)
      })
    })
  }

  {
    IPCMain.on('blob:read-convert', (_, data) => {
      views.backgroundProcesses.webContents.send('blob:read-convert', data)

      IPCMain.on(`blob:read-convert:result:${data.requestID}`, (_, data) => {
        views.main.webContents.send(`blob:read-convert:result:${data.requestID}`, data)
      })
    })

    IPCMain.on('blob:convert-write', (_, data) => {
      views.backgroundProcesses.webContents.send('blob:convert-write', data)

      IPCMain.on(`blob:convert-write:result:${data.requestID}`, (_, data) => {
        views.main.webContents.send(`blob:convert-write:result:${data.requestID}`, data)
      })
    })
  }

  {
    IPCMain.on('background:text:encrypt', (_, data) => views.backgroundProcesses.webContents.send('background:text:encrypt', data))

    IPCMain.on('background:text:decrypt', (_, data) => {
      views.backgroundProcesses.webContents.send('background:text:decrypt', data)

      IPCMain.on(`background:text:decrypt:result:${data.requestID}`, (_, decryptedText) => {
        views.main.webContents.send(`background:text:decrypt:result:${data.requestID}`, decryptedText)
      })
    })
  }
}

{
  IPCMain.on('options:view:toggle-fullscreen', () => views.main.setFullScreen(!views.main.isFullScreen()))

  IPCMain.on('options:actions:restart', () => {
    isMacOSForcedClose = true
    views.main.close()
    App.relaunch()
  })

  IPCMain.on('options:actions:quit', () => {
    isMacOSForcedClose = true
    views.main.close()
  })

  IPCMain.on('options:actions:quit:init', () => {
    isMacOSForcedClose = true

    try {
      App.quit()
    } catch (e) {}
  })
}

IPCMain.on('dialog:create', (_, data) => Modules.Dialogs.createDialog(views.main, data))

IPCMain.on('box:create', (_, data) => {
  try {
    if (data.isInitError)
      views.intro.hide()
  } catch (e) {}

  Modules.Dialogs.createBox(data.isInitError ? views.intro : views.main, data)
})

IPCMain.handle('window:focused', () => views.main.isFocused())

IPCMain.on('public-key:get', (_, id) => {
  let publicKey

  try {
    publicKey = KeysGenerator.getPublicKey(keysServiceName)

    if (publicKey == null)
      publicKey = KeysGenerator.regenerateKeys(keysServiceName)
  } catch (e) {}

  views.main.webContents.send(`public-key:${id}`, publicKey)
})

IPCMain.on('script:run', (_, data) => Modules.Scripts.executeScript(views.main, Terminal, data))

IPCMain.on('content-protection', (_, apply) => views.main.setContentProtection(apply))

IPCMain.handle('app-path:get', () => {
  let path = App.getAppPath()

  if (App.isPackaged)
    path = Path.join(path, '..')

  return path
})

IPCMain.on('cassandra-copyright-acknowledged', () => Modules.Config.getConfig((config) => {
  let result = false

  try {
    result = config.get('security', 'cassandraCopyrightAcknowledged') == 'true'
  } catch (e) {}

  views.intro.webContents.send('cassandra-copyright-acknowledged', result)
}))

IPCMain.on('cassandra-copyright-acknowledged:true', () => {
  setTimeout(() => {
    Modules.Config.getConfig((config) => {
      try {
        config.set('security', 'cassandraCopyrightAcknowledged', 'true')
        Modules.Config.setConfig(config)
      } catch (e) {}
    })
  }, 5000)
})

{
  let lastRequestTimestamp = 0,
    handleItems = (items) => {
      for (let item of items) {
        if (item.submenu != undefined)
          handleItems(item.submenu)

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

  IPCMain.on('show-context-menu', (_, items) => {
    let requestTimestamp = new Date().getTime()

    if (requestTimestamp - lastRequestTimestamp <= 500)
      return

    lastRequestTimestamp = requestTimestamp

    let popUpMenu = new Menu()

    items = JSON.parse(items)

    for (let item of items) {
      if (item.submenu != undefined)
        handleItems(item.submenu)

      try {
        try {
          item.click = eval(item.click)
        } catch (e) {}

        try {
          item.icon = NativeImage.createFromPath(item.icon)
        } catch (e) {
          item.icon = ''
        }

        popUpMenu.append(new MenuItem(item))
      } catch (e) {}
    }

    popUpMenu.popup(views.main)
  })
}

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
