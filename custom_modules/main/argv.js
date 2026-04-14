// Import the base of the command line interface feature
const Argv = App.commandLine,
  CommandLineUsage = require('command-line-usage'),
  AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')),
  Consts = require(Path.join(__dirname, '..', '..', 'custom_modules', 'main', 'consts')),
  /**
   * An implementation of PHP `strip_tags` in Node.js
   * Used for stripping HTML tags from a given string
   */
  StripTags = require('@ramumb/strip-tags'),
  Table = require('cli-table3')

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

global.IPCMain.on('cli:ready', () => {
  isReadyToCallFunctions = true
})

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
      description: '> Print all supported arguments.\n\n'
    },
    {
      name: 'version',
      flag: 'v',
      typeLabel: ' ',
      description: '> Print the current version of AxonOps Workbench.\n\n'
    },
    {
      name: 'list-workspaces',
      flag: '',
      typeLabel: ' ',
      description: '> List all saved workspaces in the workbench without their connections.\n\n'
    },
    {
      name: 'list-connections',
      typeLabel: '{underline Str: Workspace ID}',
      flag: '',
      description: '> List all saved connections in a specific workspace by passing its ID.\n\n'
    },
    {
      name: 'import-workspace',
      flag: '',
      typeLabel: '{underline Str: JSON or File/Folder Path}',
      description: '> Import a workspace by either:\n>> Directly passing a JSON string containing specific data {italic - see the Readme file -}.\n>> Passing an absolute path of a file containing a valid JSON string {italic - see the Readme file -}.\n>> Passing an absolute path of a single workspace folder, or a folder contains multiple workspaces folders - one depth level -, the import process will also import the connections. {rgb(0,0,255).bold Note}: The Workbench will import all connections without specification, if there\'s a name duplication regarding the workspace name the process will be terminated.\n\n'
    },
    {
      name: 'copy-to-default',
      flag: '',
      typeLabel: ' ',
      description: '> For {bold import-workspace} argument, if the value is a folder path, the workspace will be copied to the default data directory. Without this argument, the import process detects workspaces and leaves them in the original path.\n\n'
    },
    {
      name: 'import-connection',
      flag: '',
      typeLabel: '{underline Str: JSON File Path}',
      description: '> Import a connection by passing an absolute path of a file containing a valid JSON string. {rgb(0,0,255).bold Note}: {italic this action supports passing SSH tunnel info in a specific format, and a cqlsh.rc file path, however, username and password should be passed within the JSON string, if they exist in the cqlsh config file they will be ignored}.\n\n'
    },
    {
      name: 'json',
      flag: '',
      typeLabel: ' ',
      description: '> For {bold list-workspaces}, {bold list-connections}, {bold import-workspace} and {bold import-connections} arguments, the output will be a JSON object or an array of JSON items (as a string) instead of a formatted text.\n\n'
    },
    {
      name: 'delete-file',
      flag: '',
      typeLabel: ' ',
      description: '> For {bold import-workspace} and {bold import-connection} arguments, it deletes the provided file - or folder - after successful import. {rgb(0,0,255).bold Note}: If {bold import-workspace} is given a folder path then the deletion request will be ignored.\n\n'
    },
    {
      name: 'test-connection',
      flag: '',
      typeLabel: '{underline Bool: true or false}',
      description: '> For {bold import-connection} argument, test the connection about to be imported before finalizing the import process, passing it with {bold true} value will stop the importing process in case the connection has failed, otherwise, passing it without specifying a value or with {bold false} value will not stop the importing process, in both cases a feedback will be printed.\n\n'
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

  // Note: The previously used chalk package (v4.1.2) was completely safe. However, we decided to remove it since it was not critical to the application, and we aim to keep only highly reputable and secure packages. A lightweight proxy is now used instead, which simply returns the text as-is
  global.Chalk = new Proxy(
    (text) => text, // Base function: just return text
    {
      get: () => Chalk, // Any property access returns Chalk itself
      apply: (_, __, args) => args[0], // Any function call returns first argument
    }
  )

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
      content: 'CLI feature to interact with the workbench from the command line interface.\n\n{rgb(0,0,255).italic Readme:}\nhttps://github.com/axonops/axonops-workbench/blob/main/docs/cli.md'
    },
    {
      header: `Copyright Notices`,
      content: StripTags(`${Consts.LegalNotice}`) + '.'
    },
    {
      header: `{rgb(0,0,255).underline Note For Windows}`,
      content: `On Windows, the shell may show the prompt immediately without waiting for Workbench to finish, so run it as {bold start /wait "" "AxonOps Workbench.exe" (Arguments)} to ensure it waits until completion`
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

        let isJSONArgPassed = argumentsNames.includes('json')

        if (!isJSONArgPassed) {
          spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Retreving saved workspaces')}`)
          spinnerObj.start()
        }

        callWhenReady(() => {
          global.views.main.webContents.send('cli:list-workspaces')

          global.IPCMain.on('cli:list-workspaces:result', (_, workspaces) => {
            if (!isJSONArgPassed)
              spinnerObj.end()

            if (!isJSONArgPassed) {
              let workspacesTable = new Table({
                head: ['Workspace ID', 'Workspace Name', 'Number of Connections']
              })

              workspacesTable.push(...(workspaces || []).map((workspace) => [workspace.id, workspace.name, workspace.connections.length]))

              console.log(workspacesTable.toString())
            } else {
              workspaces = (workspaces || []).map((workspace) => {
                return {
                  'id': workspace.id,
                  'name': workspace.name,
                  'connectionsCount': workspace.connections.length
                }
              })

              console.log(JSON.stringify(workspaces))
            }

            exitApp()
          })
        })

        break
      } catch (e) {}

      try {
        if (argument != 'list-connections')
          throw 0

        let isJSONArgPassed = argumentsNames.includes('json'),
          workspaceID = `${arguments[argument]}`

        if (!isJSONArgPassed) {
          spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Retreving saved connections in workspace #' + workspaceID)}`)
          spinnerObj.start()
        }

        callWhenReady(() => {
          global.views.main.webContents.send('cli:list-connections', workspaceID)

          global.IPCMain.on('cli:list-connections:result', (_, connections) => {
            if (!isJSONArgPassed)
              spinnerObj.end()

            connections = connections.map((connection) => {
              return {
                name: connection.name,
                hostname: connection.host == '' ? 'AstraDB' : connection.host,
                id: connection.info.id
              }
            })

            if (!isJSONArgPassed) {
              let connectionsTable = new Table({
                head: ['Connection ID', 'Connection Name', 'Connection Hostname']
              })

              connectionsTable.push(...(connections || []).map((connection) => [connection.id, connection.name, connection.hostname]))

              console.log(connectionsTable.toString())
            } else {
              console.log(JSON.stringify(connections))
            }

            exitApp()
          })
        })

        break
      } catch (e) {}

      try {
        if (argument != 'import-workspace')
          throw 0

        let isDeleteFileArgPassed = argumentsNames.includes('delete-file'),
          isCopyToDefaultArgPassed = argumentsNames.includes('copy-to-default'),
          isJSONArgPassed = argumentsNames.includes('json')

        if (!isJSONArgPassed) {
          spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Importing workspace')}`)
          spinnerObj.start()
        }

        callWhenReady(() => {
          global.views.main.webContents.send('cli:import-workspace', {
            argumentInput: `${arguments[argument]}`,
            copyToDefaultPath: isCopyToDefaultArgPassed
          })

          global.IPCMain.on('cli:import-workspace:result', (_, results) => {
            if (!isJSONArgPassed)
              spinnerObj.end()

            try {
              results = typeof results[Symbol.iterator] != 'function' ? [results] : results
            } catch (e) {}

            if (isJSONArgPassed) {
              console.log(JSON.stringify({
                code: {
                  '-3': 'Other reasons',
                  '-2': 'ID duplication',
                  '-1': 'Name duplication',
                  '0': 'Process interrupted',
                  '1': 'Successfully imported',
                },
                result: results
              }))
            } else {
              for (let result of results) {
                let workspaceName = ''

                try {
                  workspaceName = typeof result.text === 'object' ? result.text[0] : ''
                } catch (e) {}

                switch (result.code) {
                  case -3: {
                    console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace${workspaceName.length != 0 ? (' ' + workspaceName) : ''}. ${Chalk.underline('Reason')}: ${result.text}.`))
                    break
                  }
                  case -2: {
                    console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace${workspaceName.length != 0 ? (' ' + workspaceName) : ''}. ${Chalk.underline('Reason')}: ID duplication detected.`))
                    break
                  }
                  case -1: {
                    console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace${workspaceName.length != 0 ? (' ' + workspaceName) : ''}. ${Chalk.underline('Reason')}: Name duplication detected.`))
                    break
                  }
                  case 0: {
                    console.log(Chalk.red(`[${Chalk.bold('ERROR')}]: Failed to import workspace${workspaceName.length != 0 ? (' ' + workspaceName) : ''}. ${Chalk.underline('Reason')}: Process has been interrupted.`))
                    break
                  }
                  case 1: {
                    console.log(Chalk.green(`[${Chalk.bold('SUCCESS')}]: Workspace ${Chalk.bold(result.text[0])} has been successfully imported and saved with ID ${Chalk.bold(result.text[1])}.`))
                    break
                  }
                }
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

              if (!isJSONArgPassed)
                console.log(Chalk.rgb(154, 85, 0)(`[${Chalk.bold('DELETE FILE')}]: The provided JSON string file has beeen deleted.`))
            } catch (e) {
              if (e != 0 && !isJSONArgPassed)
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


        let isDeleteFileArgPassed = argumentsNames.includes('delete-file'),
          isTestConnectionArgPassed = argumentsNames.includes('test-connection'),
          testConnectionValue = isTestConnectionArgPassed ? (arguments['test-connection'] == undefined ? false : arguments['test-connection'] == 'true') : '',
          isJSONArgPassed = argumentsNames.includes('json')

        if (!isJSONArgPassed) {
          spinnerObj.setSpinnerTitle(`%s ${Chalk.bold('Importing connection')}`)
          spinnerObj.start()
        }

        callWhenReady(() => {
          global.views.main.webContents.send('cli:import-connection', {
            jsonStringPath: `${arguments[argument]}`,
            testConnection: {
              passed: isTestConnectionArgPassed,
              value: testConnectionValue
            }
          })

          if (!isJSONArgPassed)
            global.IPCMain.on('cli:import-connection:found-sens-data', (_, data) => {
              spinnerObj.end()

              console.log(Chalk.rgb(154, 85, 0)(`[${Chalk.bold('WARNING')}]: Sensitive data has been found in the provided cqlsh.rc file (${data.join(', ')}) and has been removed.`))

              spinnerObj.start()
            })

          global.IPCMain.on('cli:import-connection:test-connection:result', (_, data) => {
            if (!isJSONArgPassed) {
              spinnerObj.end()

              console.log(Chalk[data.success ? 'green' : 'red'](`[${Chalk.bold('TEST CONNECTION')}] The connection test has finished with ${data.success ? 'success, continue with importing the connection' : ('failure. Reason: ' + data.reason + '. ' + (testConnectionValue ? 'Importing process will be terminated' : 'Importing process will be continued'))}.`))
            }

            if (isJSONArgPassed && !data.success && testConnectionValue)
              console.log(JSON.stringify(data))

            if (!data.success && testConnectionValue)
              exitApp()

            if (!isJSONArgPassed)
              spinnerObj.start()
          })

          global.IPCMain.on('cli:import-connection:result', (_, result) => {
            if (!isJSONArgPassed)
              spinnerObj.end()

            if (isJSONArgPassed) {
              console.log(JSON.stringify(result))
            } else {
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

              if (!isJSONArgPassed)
                console.log(Chalk.rgb(154, 85, 0)(`[${Chalk.bold('DELETE FILE')}]: The provided JSON string file has beeen deleted.`))
            } catch (e) {
              if (e != 0 && !isJSONArgPassed)
                console.log(Chalk.red(`[${Chalk.bold('DELETE FILE')}]: Something went wrong, failed to delete the provided JSON string file.`))
            }

            exitApp()
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
