// Import the base of the command line interface feature
const Argv = App.commandLine,
  CommandLineUsage = require('command-line-usage'),
  AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')),
  PTY = require('node-pty'),
  Consts = require(Path.join(__dirname, '..', '..', 'custom_modules', 'main', 'consts')),
  /**
   * An implementation of PHP `strip_tags` in Node.js
   * Used for stripping HTML tags from a given string
   */
  StripTags = require('@ramumb/strip-tags')

/**
 * Get platform (`win32`, `linux` or `darwin`)
 * Will be used a lot in the module
 */
const Platform = OS.platform(),
  /**
   * Choose the suitable shell based on the platform
   * For Linux and macOS we use `bash`, for Windows we use the `cmd`
   */
  Shell = Platform == 'win32' ? 'cmd.exe' : 'bash',
  // Point at the `bin` folder where we have all modified cqlsh versions - and other binary files -
  // CWD = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'main', 'bin'),
  CWD = Path.join((extraResourcesPath != null ? Path.join(__dirname, '..', '..', '..') : Path.join(__dirname, '..', '..')), 'main', 'bin')

let isReadyToCallFunctions = false

let exitApp = () => process.exit(0),
  callWhenReady = (func) => {
    global.IPCMain.on('cli:ready', () => {
      isReadyToCallFunctions = true

      func()
    })

    if (isReadyToCallFunctions)
      func()
  }


/**
 * Minify a given text by manipulating it, plus getting rid of new lines
 * This function has been implemented in the `funcs.js` file in the renderer thread
 *
 * @Parameters:
 * {string} `text` the text to be manipulated
 *
 * @Return: {string} the manipulated text
 */
let minifyText = (text) => {
  // Define the regex expression to be created
  let regexs = ['\\n', '\\r']

  // Loop through each regex
  regexs.forEach((regex) => {
    // Create regex object
    regex = new RegExp(regex, 'g')

    // Execute the replication process
    text = `${text}`.replace(regex, '')
  })

  // Call the text manipulation function
  text = `${text}`.replace(/\s+/gm, '').toLowerCase()

  // Return final result
  return text
}

var arguments = {},
  definedArguments = [{
      name: 'help',
      flag: 'h',
      typeLabel: ' ',
      description: '> Print all supported arguments.'
    },
    {
      name: 'version',
      flag: 'v',
      typeLabel: ' ',
      description: '> Print the current version of AxonOps Workbench.'
    },
    {
      name: 'list-workspaces',
      flag: '',
      typeLabel: ' ',
      description: '> List all saved workspaces in the workbench without their connections.'
    },
    {
      name: 'import-workspace',
      flag: '',
      typeLabel: '{underline String: JSON or File Path}',
      description: '> Import a workspace by either directly passing a JSON string containing specific data, or by passing an absolute path of a file containing a valid JSON string.'
    },
    {
      name: 'list-connections',
      typeLabel: '{underline String: Workspace ID}',
      flag: '',
      description: '> List all saved connections in a specific workspace by passing its ID.'
    },
    {
      name: 'import-connection',
      flag: '',
      typeLabel: '{underline String: JSON File Path}',
      description: '> Import a connection by passing an absolute path of a file containing a valid JSON string. {rgb(0,0,255).bold Note}: {italic this action supports passing SSH tunnel info in a specific format, and a cqlsh.rc file path, however, username and password should be passed within the JSON string, if they exist in the cqlsh config file they will be ignored}.'
    },
    {
      name: 'test-connection',
      flag: '',
      typeLabel: '{underline Boolean: true or false}',
      description: '> For {bold import-connection} argument, test the connection about to be imported before finalizing the import process, passing it with {bold true} value will stop the importing process in case the connection has failed, otherwise, passing it without specifying a value or with {bold false} value will not stop the importing process, in both cases a feedback will be printed.'
    },
    {
      name: 'delete-file',
      flag: '',
      typeLabel: ' ',
      description: '> For {bold import-workspace} and {bold import-connection} arguments, delete the provided file after successful feedback.'
    },
    {
      name: 'connect',
      flag: '',
      typeLabel: '{underline String: connection ID}',
      description: '> Connect directly to a saved connection and start a cqlsh session by passing its ID.'
    },
  ],
  supportedArguments = [],
  sections = []

let init = () => {
  for (let argument of definedArguments)
    supportedArguments.push(argument.name, argument.flag)

  supportedArguments = supportedArguments.filter((argument) => argument.length > 0)

  try {
    for (let supportedArgument of supportedArguments) {
      let isExist = Argv.hasSwitch(supportedArgument)

      if (!isExist)
        continue

      let argumentValue = Argv.getSwitchValue(supportedArgument)

      arguments[supportedArgument] = argumentValue.length <= 0 ? true : argumentValue
    }
  } catch (e) {}

  // Make sure at least one supported argument has been passed
  if (!(Object.keys(arguments).some((argument) => supportedArguments.includes(argument))))
    throw 0

  Argv.appendSwitch('log-level', '3')
  Argv.appendArgument('--silent')
  Argv.appendArgument('--is-cli')
  Argv.appendArgument('--no-sandbox')

  global.IsCLIMode = true

  global.Chalk = require('chalk')

  global.Spinner = require('cli-spinner').Spinner

  global.spinnerObj = new Spinner('%s')

  spinnerObj.setSpinnerString(19)

  spinnerObj.end = () => {
    console.log('')

    spinnerObj.stop()
  }

  App.whenReady().then(() => App.on('before-quit', () => exitApp()))

  sections = [{
      header: `${AppInfo.title}`,
      content: 'CLI feature to interact with the workbench from the command line interface.'
    },
    {
      header: `Copyright Notices`,
      content: StripTags(`${Consts.LegalNotice}`)
    },
    {
      header: 'Supported Arguments',
      optionList: definedArguments.map((argument) => {
        return {
          ...argument,
          name: `${argument.name}` + (argument.flag != '' ? `, -${argument.flag}` : ''),
          description: `${argument.description}`
        }
      })
    }
  ]
}

let start = async () => {
  try {
    let usageContent = CommandLineUsage(sections),
      argumentsNames = Object.keys(arguments)

    for (let argument of argumentsNames) {
      // Handle `help` argument
      try {
        if (argument != 'help' && argument != 'h')
          throw 0

        console.log(usageContent)

        exitApp()

        break
      } catch (e) {}

      try {
        if (argument != 'version' && argument != 'v')
          throw 0

        console.log(Chalk.bold(`${AppInfo.title}`) + ` v${AppInfo.version}`)

        exitApp()

        break
      } catch (e) {}

      try {
        if (argument != 'list-workspaces')
          throw 0

        spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Retreving saved workspaces')}`)
        spinnerObj.start()

        callWhenReady(() => {
          global.views.main.webContents.send('cli:list-workspaces')

          global.IPCMain.on('cli:list-workspaces:result', (_, workspaces) => {
            spinnerObj.end()

            workspaces = (workspaces || []).map((workspace) => {
              return {
                'Workspace ID': workspace.id,
                'Workspace Name': workspace.name,
                'Number of connections': workspace.connections.length
              }
            })

            console.log(workspaces)

            exitApp()
          })
        })

        break
      } catch (e) {}

      try {
        if (argument != 'list-connections')
          throw 0

        let workspaceID = `${arguments[argument]}`

        spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Retreving saved connections in workspace #' + workspaceID)}`)
        spinnerObj.start()

        callWhenReady(() => {
          global.views.main.webContents.send('cli:list-connections', workspaceID)

          global.IPCMain.on('cli:list-connections:result', (_, connections) => {
            spinnerObj.end()

            connections = connections.map((connection) => {
              return {
                name: connection.name,
                hostname: connection.host == '' ? 'AstraDB' : connection.host,
                id: connection.info.id
              }
            })

            console.log(connections)

            exitApp()
          })
        })

        break
      } catch (e) {}

      try {
        if (argument != 'import-workspace')
          throw 0

        let isDeleteFileArgPassed = argumentsNames.includes('delete-file')

        spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Importing workspace')}`)
        spinnerObj.start()

        callWhenReady(() => {
          global.views.main.webContents.send('cli:import-workspace', `${arguments[argument]}`)

          global.IPCMain.on('cli:import-workspace:result', (_, result) => {
            spinnerObj.end()

            switch (result.code) {
              case -3: {
                console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace. ${Chalk.underline('Reason')}: ${result.text}.`))
                break
              }
              case -2: {
                console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace. ${Chalk.underline('Reason')}: ID duplication detected.`))
                break
              }
              case -1: {
                console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace. ${Chalk.underline('Reason')}: Name duplication detected.`))
                break
              }
              case 0: {
                console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace. ${Chalk.underline('Reason')}: Process has been interrupted.`))
                break
              }
              case 1: {
                console.log(Chalk.green(`[${Chalk.bold('SUCCESS')}]: Workspace ${Chalk.bold(result.text[0])} has been successfully imported and saved with ID ${Chalk.bold(result.text[1])}.`))
                break
              }
            }

            try {
              /**
               * The delete file argument should be passed
               * The import process has been finished with success
               * The passed value is a path not a JSON string
               */
              if (!isDeleteFileArgPassed || result.code != 1 || !result.isInputAPath)
                throw 0

              FS.unlinkSync(`${arguments[argument]}`)

              console.log(Chalk.rgb(154, 85, 0)(`[${Chalk.bold('DELETE FILE')}]: The provided JSON string file has beeen deleted.`))
            } catch (e) {
              if (e != 0)
                console.log(Chalk.red(`[${Chalk.bold('DELETE FILE')}]: Something went wrong, failed to delete the provided JSON string file.`))
            }

            exitApp()
          })
        })

        break
      } catch (e) {}

      try {
        if (argument != 'import-connection')
          throw 0

        spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Importing connection')}`)
        spinnerObj.start()

        let isDeleteFileArgPassed = argumentsNames.includes('delete-file'),
          isTestConnectionArgPassed = argumentsNames.includes('test-connection'),
          testConnectionValue = isTestConnectionArgPassed ? (arguments['test-connection'] == undefined ? false : arguments['test-connection'] == 'true') : ''

        callWhenReady(() => {
          global.views.main.webContents.send('cli:import-connection', {
            jsonStringPath: `${arguments[argument]}`,
            testConnection: {
              passed: isTestConnectionArgPassed,
              value: testConnectionValue
            }
          })

          global.IPCMain.on('cli:import-connection:found-sens-data', (_, data) => {
            spinnerObj.end()

            console.log(Chalk.rgb(154, 85, 0)(`[${Chalk.bold('WARNING')}]: Sensitive data has been found in the provided cqlsh.rc file (${data.join(', ')}) and has been removed.`))

            spinnerObj.start()
          })

          global.IPCMain.on('cli:import-connection:test-connection:result', (_, data) => {
            spinnerObj.end()

            console.log(Chalk[data.success ? 'green' : 'red'](`[${Chalk.bold('TEST CONNECTION')}] The connection test has finished with ${data.success ? 'success, continue with importing the connection' : ('failure. Reason: ' + data.reason + '. ' + (testConnectionValue ? 'Importing process will be terminated' : 'Importing process will be continued'))}.`))

            if (!data.success && testConnectionValue)
              exitApp()

            spinnerObj.start()
          })

          global.IPCMain.on('cli:import-connection:result', (_, result) => {
            spinnerObj.end()

            switch (result.success) {
              case true: {
                console.log(Chalk.green(`[${Chalk.bold('SUCCESS')}]: Connection ${Chalk.bold(result.text[0])} has been successfully imported and saved with ID ${Chalk.bold(result.text[1])}.`))
                break
              }
              case false: {
                if (typeof result.text == 'object') {
                  console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import connection. ${Chalk.underline('Reason')}: Possible name dupication has been detected, please recheck the provided JSON data.`))
                } else {
                  console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import connection. ${Chalk.underline('Reason')}: ${result.text}.`))
                }
                break
              }
            }

            try {
              /**
               * The delete file argument should be passed
               * The import process has been finished with success
               * The passed value is a path not a JSON string
               */
              if (!isDeleteFileArgPassed || !result.success)
                throw 0

              FS.unlinkSync(`${arguments[argument]}`)

              console.log(Chalk.rgb(154, 85, 0)(`[${Chalk.bold('DELETE FILE')}]: The provided JSON string file has beeen deleted.`))
            } catch (e) {
              if (e != 0)
                console.log(Chalk.red(`[${Chalk.bold('DELETE FILE')}]: Something went wrong, failed to delete the provided JSON string file.`))
            }

            exitApp()
          })
        })

        break
      } catch (e) {}

      try {
        if (argument != 'connect')
          throw 0

        spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Starting connection #' + arguments[argument])}`)
        spinnerObj.start()

        callWhenReady(() => {
          global.views.main.webContents.send('cli:connect', `${arguments[argument]}`)

          global.IPCMain.on('cli:connect:result', async (_, result) => {
            switch (result.success) {
              case true: {
                let connectionObject = result.connectionObject,
                  cqlshInstance

                // Run cqlsh instance with the given cqlsh file path
                let binCall = `./cqlsh`

                // If the host is Windows then change the binary call format
                binCall = Platform == 'win32' ? (`cqlsh.exe`) : binCall

                /**
                 * Start the connecting process
                 *
                 * For AstraDB - Secure connection bundle connection -
                 */
                try {
                  if (connectionObject.info.secureConnectionBundlePath == undefined)
                    throw 0

                  // If there are more arguments to be passed - like username and password -
                  let moreArguments = ''
                  try {
                    // If not, then we may skip this try-catch block
                    if ([null, undefined].includes(connectionObject.info.secrets))
                      throw 0

                    // Otherwise, secrets will be passed as arguments
                    moreArguments += `--username="${connectionObject.info.secrets.username}"  -SPLIT- `
                    moreArguments += `--password="${connectionObject.info.secrets.password}"  -SPLIT- `
                  } catch (e) {}

                  // Check if adding a cmd command to change the code page is required
                  let pageCode = Platform == 'win32' ? 'chcp 65001 && ' : '',
                    // Define the chosen binary's directory
                    binDirectory = `cqlsh`

                  // Switch to the single-file mode
                  try {
                    if (!FS.lstatSync(Path.join(CWD, `cqlsh`)).isDirectory())
                      binDirectory = ''
                  } catch (e) {}

                  /**
                   * Define the final command to be executed
                   * `-SPLIT-` keyword is used to split the command into portions for macOS
                   * On Windows and Linux, this keyword is removed
                   */
                  let command = `"${Path.join(CWD, binDirectory, binCall)}" -SPLIT- ${moreArguments} -SPLIT- --workspaceID="${connectionObject.workspaceID}" -SPLIT- --secure-connect-bundle="${connectionObject.info.secureConnectionBundlePath}" -SPLIT- --basic=1 --exit-keyword=1`

                  // Create pty instance - for cqlsh -
                  cqlshInstance = PTY.spawn(Shell, [], {
                    cwd: process.cwd(),
                    useConpty: false
                  })

                  // Write the cqlsh execution command
                  try {
                    cqlshInstance.write(command.replace(/\-SPLIT\-/g, '') + OS.EOL)
                  } catch (e) {}

                  let output = '',
                    isPrintOutputAllowed = false

                  // Print terminal output to stdout
                  cqlshInstance.onData((data) => {
                    output += data

                    if (`${output}`.includes('cassandra.DriverException') && !isPrintOutputAllowed) {
                      let error = output

                      try {
                        error = `${output}`.match(/.+DriverException:.+/g)[0]
                      } catch (e) {
                        try {
                          error = `${output}`.match(/.+error:.+/g)[0]
                        } catch (e) {}
                      }

                      spinnerObj.end()

                      console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to start a cqlsh session. ${Chalk.underline('Reason')}: ${error}.`))

                      exitApp()

                      return
                    }

                    // Found the start keyword, start printing the output
                    if (output.includes('KEYWORD:CQLSH:STARTED') && !isPrintOutputAllowed) {
                      output = ''
                      isPrintOutputAllowed = true

                      spinnerObj.end()

                      return
                    }

                    // Found the exit keyword, terminate the entire process
                    if (`${output}`.includes('KEYWORD:EXIT')) {
                      process.stdout.write(OS.EOL)
                      try {
                        cqlshInstance.kill()
                      } catch (e) {}

                      exitApp()
                      return
                    }

                    // Write output char by char
                    if (isPrintOutputAllowed && !isErrorFound)
                      process.stdout.write(data)
                  })

                  process.stdin.setRawMode(true)
                  process.stdin.resume()
                  process.stdin.setEncoding('utf8')

                  process.stdin.on('data', (key) => {
                    if (key === '\u0003') {
                      spinnerObj.end()
                      console.log('')
                      process.exit(0)
                    }

                    cqlshInstance.write(key)
                  })

                  return
                } catch (e) {}

                let createCQLSHInstance = (connectionObject, sshTunnelObject = null) => {
                  try {
                    // If there are more arguments to be passed - like username and password -
                    let moreArguments = ''
                    try {
                      // If not, then we may skip this try-catch block
                      if ([null, undefined].includes(connectionObject.info.secrets))
                        throw 0

                      // Otherwise, secrets will be passed as arguments
                      moreArguments += `--username="${connectionObject.info.secrets.username}"  -SPLIT- `
                      moreArguments += `--password="${connectionObject.info.secrets.password}"  -SPLIT- `
                    } catch (e) {}

                    // Check if SSH tunneling info has been given
                    let override = ''
                    try {
                      // If not, then we may skip this try-catch block
                      if (sshTunnelObject == null)
                        throw 0

                      // Otherwise, SSH info will be passed with the execution command
                      override += `127.0.0.1 ${sshTunnelObject.port}  -SPLIT- `
                      override += `--overrideHost="${sshTunnelObject.host}"  -SPLIT- `
                      override += `--overridePort="${sshTunnelObject.oport}"  -SPLIT- `
                    } catch (e) {}

                    // Check if adding a cmd command to change the code page is required
                    let pageCode = Platform == 'win32' ? 'chcp 65001 && ' : '',
                      // Define the chosen binary's directory
                      binDirectory = `cqlsh`

                    // Switch to the single-file mode
                    try {
                      if (!FS.lstatSync(Path.join(CWD, `cqlsh`)).isDirectory())
                        binDirectory = ''
                    } catch (e) {}

                    global.views.main.webContents.send('cli:connect:variables:get')

                    IPCMain.on('cli:connect:variables:get:result', (_, files) => {
                      /**
                       * Define the final command to be executed
                       * `-SPLIT-` keyword is used to split the command into portions for macOS
                       * On Windows and Linux, this keyword is removed
                       */
                      let command = `"${Path.join(CWD, binDirectory, binCall)}" ${override} --cqlshrc="${connectionObject.cqlshrcPath}" -SPLIT- ${moreArguments} -SPLIT- --varsManifest="${files.manifest}" -SPLIT- --varsValues="${files.values}" -SPLIT- --workspaceID="${connectionObject.workspaceID}" -SPLIT- --basic=1 --exit-keyword=1`

                      // Create pty instance - for cqlsh -
                      cqlshInstance = PTY.spawn(Shell, [], {
                        cwd: process.cwd(),
                        useConpty: false
                      })

                      // Write the cqlsh execution command
                      try {
                        cqlshInstance.write(command.replace(/\-SPLIT\-/g, '') + OS.EOL)
                      } catch (e) {}

                      let output = '',
                        isPrintOutputAllowed = false

                      // Print terminal output to stdout
                      cqlshInstance.onData((data) => {
                        output += data

                        if ((output.toLowerCase().indexOf('error') != -1 && output.toLowerCase().indexOf('symbol') <= -1) && !isPrintOutputAllowed) {
                          let error = output

                          try {
                            error = `${output}`.match(/.+DriverException:.+/g)[0]
                          } catch (e) {
                            try {
                              error = `${output}`.match(/.+error:.+/g)[0]
                            } catch (e) {}
                          }

                          spinnerObj.end()

                          console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to start a cqlsh session. ${Chalk.underline('Reason')}: ${error}.`))

                          exitApp()

                          return
                        }

                        // Found the start keyword, start printing the output
                        if (output.includes('KEYWORD:CQLSH:STARTED') && !isPrintOutputAllowed) {
                          output = ''

                          isPrintOutputAllowed = true

                          spinnerObj.end()

                          return
                        }

                        // Found the exit keyword, terminate the entire process
                        if (`${output}`.includes('KEYWORD:EXIT')) {
                          process.stdout.write(OS.EOL)
                          try {
                            cqlshInstance.kill()
                          } catch (e) {}

                          exitApp()
                          return
                        }

                        // Write output char by char
                        if (isPrintOutputAllowed)
                          process.stdout.write(data)
                      })

                      process.stdin.setRawMode(true)
                      process.stdin.resume()
                      process.stdin.setEncoding('utf8')

                      process.stdin.on('data', (key) => {
                        if (key === '\u0003') {
                          spinnerObj.end()
                          console.log('')
                          process.exit(0)
                        }

                        cqlshInstance.write(key)
                      })
                    })
                  } catch (e) {

                  }
                }

                /**
                 * For Apache Cassandra connection
                 * We need to check SSH credentials, if provided then we have to create an SSH tunnel first, otherwise we can connect directly
                 */
                try {
                  if (Object.keys(connectionObject.ssh).length <= 0)
                    throw 0

                  spinnerObj.setSpinnerTitle(`%s Establishing an SSH tunnel`)

                  global.views.main.webContents.send('cli:connect:ssh:handle', connectionObject)

                  IPCMain.on('cli:connect:ssh:handle', (_, creationResult) => {
                    // If no error has occurred then perform the after SSH tunnel creation processes, and skip the upcoming code
                    if (creationResult.error == undefined) {
                      let host = connectionObject.ssh.dstAddr != '127.0.0.1' ? connectionObject.ssh.dstAddr : connectionObject.ssh.host,
                        port = connectionObject.ssh.dstPort

                      // Hold the created SSH tunnel's info
                      let sshTunnelObject = {
                        port: creationResult.port, // The port to be shown to the user
                        oport: port, // The original port to be used within the creation process
                        ...creationResult,
                        host
                      }

                      spinnerObj.end()

                      console.log(Chalk.green(`[${Chalk.bold('SSH TUNNEL')}]: Successfully established the SSH tunnel, resuming the connecting process.`))

                      spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Starting connection #' + arguments[argument])}`)
                      spinnerObj.start()

                      createCQLSHInstance(connectionObject, sshTunnelObject)

                      return
                    } else {
                      console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to establish an SSH tunnel for the connection. ${Chalk.underline('Reason')}: ${creationResult.error}.`))

                      exitApp()

                      return
                    }
                  })

                  return
                } catch (e) {}

                createCQLSHInstance(connectionObject)

                break
              }
              case false: {
                console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to start the connection. ${Chalk.underline('Reason')}: ${result.text}.`))

                exitApp()
                break
              }
            }
          })
        })

        break
      } catch (e) {}
    }
  } catch (e) {}
}

module.exports = {
  init,
  start
}
