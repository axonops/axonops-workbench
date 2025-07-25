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
 * Module to handle all events, bi-directional communications, and actions with `node-pty` module
 * `node-pty` is mainly used as a container to create a unique cqlsh/bash for each session/connection
 *
 * Import modules
 *
 * PTY module
 * Creates pseudo terminal, it returns a terminal object that allows interaction - reads and writes - with that terminal
 */
const PTY = require('node-pty'),
  // Provides the ability to spawn subprocesses
  ChildProcessSpawn = require('child_process').spawn,
  // Strip all special characters in a given string
  StripChar = require('stripchar').StripChar,
  // Return the absolute system-dependant path for the place where applications should store their data for the current user
  AppData = require('appdata-path'),
  /**
   * Module to fix a given JSON in string format
   * Used mostly within `print metadata` request
   */
  JSONRepair = require('jsonrepair').jsonrepair,
  // Kill all processes in the process tree, including the root process
  Kill = require('tree-kill'),
  /**
   * Generate a random string
   * Mainly used for generating IDs for connections, workspaces, UI elements, and so on
   * It has been implemented within the function `getRandom.id(length, ?amount)`
   */
  RandomID = require('id-16')

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

/**
 * The module is a class with different attributes and methods
 * With each session we create an instance from this class
 */
class Pty {
  /**
   * The class' constructor
   *
   * @Parameters:
   * {object} `window` the associated renderer thread - it's expected to be the main renderer thread -
   * {object} `data` a JSON object which has many attributes to be considered
   */
  constructor(window, data) {
    /**
     * Main attributes for the object
     */
    this.id = data.id // The connection's ID which this instance is associated with
    this.window = window // Window to interact with - send and receive requests -

    this.windowBackground = null

    this.scbFilePath = data.scbFilePath

    /**
     * Important info regards Cassandra and the logs file path
     */
    this.cassandraVersion = data.version // Cassandra version passed from the renderer thread after the connection test
    this.logPath = data.logPath // Log file's path for the current instance
    this.workspaceID = data.workspaceID // Given workspace's ID; to get the proper variables based on the scope
    /**
     * Important flags to control the data sending/receiving flow
     */
    this.sendData = true // Whether or not send data to the renderer thread
    this.prepareToSendAgain = false // Whether or not stop sending data partially to the renderer process
    this.terminalID = data.terminalID // Hold the app's associated UI terminal's ID
    /**
     * IDs of different requests from the renderer thread and related variables
     */
    this.metadataPrintRequestID = '' // Store the ID of connection's metadata print request
    this.cqlDescPrintRequestID = '' // Hold the ID of CQL description's fetch/print request
    this.checkConnectivityRequestID = '' // Hold the ID of connectivity check request
    this.getQueryTracingRequestID = '' // Store the ID of query tracing's result get request
    this.requestTimeout = null // Timeout to be triggered if we didn't get the final valid result for a request
    /**
     * Store different data for set purposes
     */
    this.latestCommand = '' // Store the latest received command from the renderer process
    /**
     * Store the received block ID within the command/statement
     * Having value in this variable means the command is received from an interactive terminal
     */
    this.latestBlockID = ''
    this.allOutput = '' // Store all output to catch `CQLSH-STARTED` keyword

    this.isBasicCQLSHEnabled = data.isBasicCQLSHEnabled

    this.isBasicCQLSHOnly = data.isBasicCQLSHOnly == undefined ? false : data.isBasicCQLSHOnly

    /**
     * Create a pty instance; the main one and the basic one
     * Loop through the names and create the pty instances
     */
    for (let processName of ['processMain', 'processBasic']) {
      if (!this.isBasicCQLSHEnabled && processName == 'processBasic')
        continue

      if (this.isBasicCQLSHEnabled && this.isBasicCQLSHOnly && processName == 'processMain')
        continue

      this[processName] = PTY.spawn(Shell, [], {
        cwd: CWD,
        useConpty: false // Important for Windows; to prevent app's sudden crashes
      })
    }

    // If we've got secrets (username and password)
    this.secrets = data.secrets || null

    // If we've got SSH tunneling info
    this.ssh = data.ssh || null

    this.chars = []
    this.writeCharTimeout = null

    this.writeChar = () => {
      let currentCharIndex = 0,
        writeCharInner = () => {
          this.writeCharTimeout = setTimeout(() => {
            let char = this.chars[currentCharIndex]

            if (char == undefined)
              return;

            if (char !== -1) {
              this.processBasic.write(`${char}`)
              this.chars[currentCharIndex] = -1
            }

            ++currentCharIndex

            writeCharInner()
          })
        }

      try {
        clearTimeout(this.writeCharTimeout)
      } catch (e) {}

      writeCharInner()
    }

    // To be more comfortable about pointing at the main instance
    let instance = this,
      count = 0 // Counter to neglect data (like Python warnings)

    // When receiving any data from the main instance, send it to the provided window
    if (!(this.isBasicCQLSHEnabled && this.isBasicCQLSHOnly))
      instance.processMain.on('data', (data) => {
        try {
          // Manipulate the given output/data if the current host OS is Windows
          if (Platform == 'win32')
            data = manipulateOutput(data)

          // Add the received data to the associated variable and catch the start keywords
          try {
            // If one of the keywords has been captured already then skip this try-catch block
            if (instance.allOutput == 'ignore-text')
              throw 0

            // Add the received data to the variable
            instance.allOutput += minifyText(data)

            // If any of the keywords have been found
            if ((['KEYWORD:OUTPUT:COMPLETED:ALL', 'KEYWORD:CQLSH:STARTED', 'cqlsh>']).some((keyword) => instance.allOutput.indexOf(minifyText(keyword)) != -1)) {
              // Add the ignore keyword
              instance.allOutput = 'ignore-text'

              // Send the `started` keyword to the renderer thread
              return instance[instance.windowBackground != null ? 'windowBackground' : 'window'].webContents.send(`pty:data:${instance.id}`, {
                output: 'KEYWORD:CQLSH:STARTED'
              })
            }
          } catch (e) {
            try {
              // If the error is a number then don't log the error
              if (!isNaN(parseInt(e.toString())))
                throw 0

              addLog(`Error in process terminal. Details: ${e}`, 'error')
            } catch (e) {}
          }

          // Increase the counter with every data/chunk received
          ++count

          // If we're not allowed yet to send data, or we must entirely stop sending data
          if (!instance.sendData)
            return

          /**
           * Handle the request - from the renderer thread - to get a query tracing result
           * This request is being catched by having a value in `getQueryTracingRequestID` that has been set from `getQueryTracing` function
           */
          try {
            // If `getQueryTracingRequestID` is empty then we may skip this try-catch block
            if (instance.getQueryTracingRequestID.length <= 0)
              throw 0

            // Define the request ID that the renderer thread `ipc` is listening to
            let requestID = `connection:query-tracing:${instance.getQueryTracingRequestID}`

            // Check if there's `(n rows) ` keyword in the given data then it means we've got all rows in the query tracing result and we may stop the process
            try {
              // If the keyword is not found then skip this try-catch block
              if ((new RegExp('KEYWORD\:OUTPUT\:COMPLETED')).exec(data) == null)
                throw 0

              /**
               * Reset the `getQueryTracingRequestID` to empty; so pty can send data to the renderer thread right after this process
               * Update `prepareToSendAgain` to `true`; to resume the sending process
               * Call the clear timeout function without reset
               */
              instance.getQueryTracingRequestID = ''
              instance.prepareToSendAgain = true
            } catch (e) {}

            // Send the tracing result in JSON block, attached with the connection's ID
            instance[instance.windowBackground != null ? 'windowBackground' : 'window'].webContents.send(requestID, {
              block: data,
              connectionID: instance.id
            })

            // Skip the upcoming code
            return
          } catch (e) {
            try {
              // If the error is a number then don't log the error
              if (!isNaN(parseInt(e.toString())))
                throw 0

              addLog(`Error in process terminal. Details: ${e}`, 'error')
            } catch (e) {}
          }

          /**
           * Handle the request - from the renderer thread - to send the metadata info
           * This request is being catched by having a value in `metadataPrintRequestID` that has been set from the `getMetadata` function
           */
          try {
            // If `metadataPrintRequestID` is empty then we may skip this try-catch block
            if (instance.metadataPrintRequestID.length <= 0)
              throw 0

            /**
             * Reset the `metadataPrintRequestID` and `metadataBlock` to empty; so pty can send data to the renderer thread again
             * Update `prepareToSendAgain` to `true`; to resume the sending process
             */
            instance.metadataPrintRequestID = ''
            instance.prepareToSendAgain = true

            // Skip the upcoming code
            return
          } catch (e) {}

          /**
           * Handle the request - from the renderer thread - to check the connectivity with the connection
           * This request is being catched by having a value in `checkConnectivityRequestID`
           */
          try {
            // If `metadataPrintRequestID` is empty then we may skip this try-catch block
            if (instance.checkConnectivityRequestID.length <= 0)
              throw 0

            /**
             * Reset the `checkConnectivityRequestID` to empty; so pty can send data to the renderer thread again
             * Update `prepareToSendAgain` to `true`; to resume the sending process
             */
            instance.checkConnectivityRequestID = ''
            instance.prepareToSendAgain = true

            // Skip the upcoming code
            return
          } catch (e) {}

          /**
           * Handle the request - from the renderer thread - to get a CQL description of the specific scope
           * This request is being catched by having a value in `cqlDescPrintRequestID` that has been set from the `getCQLDescription` function
           */
          try {
            // If `cqlDescPrintRequestID` is empty then we may skip this try-catch block
            if (instance.cqlDescPrintRequestID.length <= 0)
              throw 0

            /**
             * Reset the `cqlDescPrintRequestID` to empty; so pty can send data to the renderer thread again
             * Update `prepareToSendAgain` to `true`; to resume the sending process
             * Call the clear timeout function without reset
             */
            instance.cqlDescPrintRequestID = ''
            instance.prepareToSendAgain = true

            // Skip the upcoming code
            return
          } catch (e) {}

          /**
           * Handle when `prepareToSendAgain` is set to `true`
           * In this case the current received output won't be shown
           */
          try {
            // If there's no need to execute the try-catch block then skip it
            if (!instance.prepareToSendAgain)
              throw 0

            // Update the flag `prepareToSendAgain` to be `false`
            instance.prepareToSendAgain = false

            // Skip the upcoming code if the current platform is not Windows
            if (Platform != 'win32')
              return
          } catch (e) {}

          // Send data from cqlsh to the renderer thread
          instance[instance.windowBackground != null ? 'windowBackground' : 'window'].webContents.send(`pty:data:${instance.id}`, {
            output: data,
            blockID: instance.latestBlockID
          })
        } catch (e) {}
      })

    // When receiving any data from the basic instance, send it to the provided window
    if (instance.isBasicCQLSHEnabled)
      instance.processBasic.on('data', (data) => instance[instance.windowBackground != null ? 'windowBackground' : 'window'].webContents.send(`pty:data-basic:${instance.id}`, {
        output: data
      }))
  }

  /**
   * Send command to the pty instance
   *
   * @Parameters:
   * {string} `command` the command's text to be sent
   * {string} `blockID` the associated block's ID in the app's UI
   * {string} `currentBuffer` the current buffer - active line content - in the app's associated UI terminal
   * {string} `?process` the process type to interact with
   */
  command(command, blockID, currentBuffer, process = 'processMain') {
    // If the command is one of the array's items then we'll stop sending data, and destroy the pty instance
    if ((['quit', 'exit']).some((keyword) => command.toLowerCase().startsWith(keyword)))
      this.sendData = false

    if (currentBuffer != 'BACKGROUNDVIEW')
      this.windowBackground = null

    // Update the latest command
    this.latestCommand = command

    // Update the latest received block ID as well
    this.latestBlockID = blockID || ''

    try {
      if (OS.platform() != 'darwin')
        throw 0

      let multipleCommands = `${command}`.split(OS.EOL),
        currentCommandIndex = 0,
        splitCommand = (command, length) => {
          let result = []

          for (let i = 0; i < command.length; i += length)
            result.push(command.slice(i, i + length))

          return result
        },
        writeCommand = () => {
          let singleCommand = multipleCommands[currentCommandIndex]

          if (singleCommand == undefined)
            return

          // Split the signle command to fixed-length chunks
          let commandChunks = splitCommand(`${singleCommand}`, 50),
            currentChunkIndex = -1

          let writeChunks = () => {
            setTimeout(() => {
              ++currentChunkIndex;

              let chunk = commandChunks[currentChunkIndex]

              if (currentChunkIndex >= commandChunks.length - 1) {
                // Send the command to the pty instance
                try {
                  this[process].write(chunk + OS.EOL)
                } catch (e) {}

                ++currentCommandIndex

                writeCommand()

                return
              }

              this[process].write(chunk)

              writeChunks()
            }, 35)
          }

          writeChunks()
        }

      multipleCommands = multipleCommands.filter((singleCommand) => minifyText(singleCommand).length != 0)

      writeCommand()
    } catch (e) {}

    // Send the command to the pty instance
    try {
      if (OS.platform() == 'darwin')
        throw 0

      this[process].write(command + OS.EOL)
    } catch (e) {}

    /**
     * For Windows only
     * Make sure the renderer thread is recognizing this command
     */
    try {
      if (Platform == 'win32' && command.startsWith('KEYWORD:STATEMENT:IGNORE'))
        this.window.webContents.send(`pty:data:${this.id}`, {
          output: 'KEYWORD:STATEMENT:IGNORE',
          blockID: this.latestBlockID
        })
    } catch (e) {}
  }


  sourceCommand(command, blockID, backgroundView) {
    this.command(command, blockID, 'BACKGROUNDVIEW')

    this.windowBackground = backgroundView
  }

  /**
   * Receive realtime typed characters from the app's terminal
   * This helps with making the terminal basic and creates a raw experience
   *
   * @Parameters:
   * {string} `char` the typed character to be written in the pty instance
   */
  realtimeData(char) {
    try {
      if (OS.platform() != 'darwin')
        throw 0

      this.chars = this.chars.concat(char.split(''))
      this.chars = this.chars.filter((char) => char !== -1)
      this.writeChar()

      return
    } catch (e) {}

    this.processBasic.write(char)
  }

  // Close, kill and destroy the pty instance, furthermore, kill the instance using a different approach by its process ID
  close() {
    // Execute the destroy and kill processes for the main process
    if (!(this.isBasicCQLSHEnabled && this.isBasicCQLSHOnly))
      try {
        this.processMain.destroy()
        Kill(this.processMain.pid, 'SIGKILL')
      } catch (e) {
        addLog(`Error in process terminal. Details: ${e}`, 'error')
      }

    // Execute the destroy and kill processes for the basic process
    if (this.isBasicCQLSHEnabled)
      try {
        this.processBasic.destroy()
        Kill(this.processBasic.pid, 'SIGKILL')
      } catch (e) {
        addLog(`Error in process terminal. Details: ${e}`, 'error')
      }
  }

  // Pause the socket which connects between the pty instance and the renderer thread
  pause() {
    this.processMain.pause()
  }

  // Resume the socket
  resume() {
    this.processMain.resume()
  }

  /**
   * Resize the pty instance (cols, rows)
   *
   * @Parameters:
   * {object} `nums` JSON object consists of `cols` and `rows` of the associated app's UI terminal
   */
  resize(nums) {
    if (!(this.isBasicCQLSHEnabled && this.isBasicCQLSHOnly))
      this.processMain.resize(nums.cols, nums.rows)

    if (this.isBasicCQLSHEnabled)
      this.processBasic.resize(nums.cols, nums.rows)
  }

  /**
   * Create a cqlsh instance
   * The proper cqlsh version will be called based on the given Apache Cassandra's version
   *
   * @Parameters:
   * {string} `cqlshrcPath` The associated `cqlsh.rc` file's path
   */
  async createCQLSHInstance(data) {
    // Run cqlsh instance with the given cqlsh file path
    let binCall = `./cqlsh`

    // If the host is Windows then change the binary call format
    binCall = Platform == 'win32' ? (`cqlsh.exe`) : binCall

    // If there are more arguments to be passed - like username and password -
    let moreArguments = ''
    try {
      // If not, then we may skip this try-catch block
      if ([null, undefined].includes(this.secrets))
        throw 0

      // Otherwise, secrets will be passed as arguments
      moreArguments += `--username="${this.secrets.username}"  -SPLIT- `
      moreArguments += `--password="${this.secrets.password}"  -SPLIT- `
    } catch (e) {}

    // Check if SSH tunneling info has been given
    let override = ''
    try {
      // If not, then we may skip this try-catch block
      if ([null, undefined].includes(this.ssh))
        throw 0

      // Otherwise, SSH info will be passed with the execution command
      override += `127.0.0.1 ${this.ssh.port}  -SPLIT- `
      override += `--overrideHost="${this.ssh.host}"  -SPLIT- `
      override += `--overridePort="${this.ssh.oport}"  -SPLIT- `
    } catch (e) {}

    // Check if adding a cmd command to change the code page is required
    let pageCode = Platform == 'win32' ? 'chcp 65001 && ' : '',
      // Define the chosen binary's directory
      binDirectory = `cd "cqlsh" && `

    // Switch to the single-file mode
    try {
      if (!FS.lstatSync(Path.join(CWD, `cqlsh`)).isDirectory())
        binDirectory = ''
    } catch (e) {}

    let logArgument = `--log="${this.logPath}"`

    try {
      if (data.workspaceID == 'workspace-sandbox')
        logArgument = ''
    } catch (e) {}

    /**
     * Define the final command to be executed
     * `-SPLIT-` keyword is used to split the command into portions for macOS
     * On Windows and Linux, this keyword is removed
     */
    let command = `${pageCode}${binDirectory}${binCall} ${override} --cqlshrc="${data.cqlshrc || data.cqlshrcPath}" -SPLIT- ${moreArguments}  -SPLIT- ${logArgument}  -SPLIT- --varsManifest="${data.variables.manifest}" -SPLIT- --varsValues="${data.variables.values}"  -SPLIT- --workspaceID="${this.workspaceID}"`,
      // Define the argument to keep the temporary files
      keepTempArgument = ' --keepTemp=1',
      // Define the argument to start a basic session
      basicArgument = ' --basic=1'

    /**
     * Define the command to be executed for the basic terminal
     * By default, it's the same as the interactive terminal
     */
    let basicCommand = command

    try {
      if (this.scbFilePath != undefined)
        throw 0

      // Define the new names for the temporary filess
      let names = {
        // The variables' manifest
        manifest: Path.join(data.variables.manifest, '..', `b-${Path.basename(data.variables.manifest)}`),
        // The variables' values
        values: Path.join(data.variables.values, '..', `b-${Path.basename(data.variables.values)}`)
      }

      // Copy the manifest file with the new name
      await FS.copySync(data.variables.manifest, names.manifest)

      // Same thing to the values
      await FS.copySync(data.variables.values, names.values)

      // Update the basic terminal's command
      basicCommand = `${pageCode}${binDirectory}${binCall} ${override} --cqlshrc="${data.cqlshrc || data.cqlshrcPath}" -SPLIT- ${moreArguments} ${logArgument} --varsManifest="${names.manifest}" -SPLIT- --varsValues="${names.values}" --workspaceID="${this.workspaceID}"`
    } catch (e) {}

    try {
      if (this.scbFilePath == undefined)
        throw 0

      command = `${pageCode}${binDirectory}${binCall} ${override} -SPLIT- ${moreArguments}  -SPLIT- ${logArgument}  -SPLIT- --workspaceID="${this.workspaceID}" -SPLIT- --secure-connect-bundle="${this.scbFilePath}"`

      basicCommand = `${pageCode}${binDirectory}${binCall} ${override} -SPLIT- ${moreArguments} -SPLIT- ${logArgument} -SPLIT- --workspaceID="${this.workspaceID}" -SPLIT- --secure-connect-bundle="${this.scbFilePath}"`
    } catch (e) {}

    try {
      // If the host OS is macOS then skip this try-catch block
      // if (Platform == 'darwin')
      //   throw 0

      // Run the cqlsh's executing command in the main process
      if (!(this.isBasicCQLSHEnabled && this.isBasicCQLSHOnly))
        this.command(command.replace(/\-SPLIT\-/g, '') + keepTempArgument)

      // Run the command in the basic process
      if (this.isBasicCQLSHEnabled)
        this.command(basicCommand.replace(/\-SPLIT\-/g, '') + basicArgument, undefined, undefined, 'processBasic')
    } catch (e) {
      // Split the command into portions using the keyword
      let commandSplit = command.split('-SPLIT-'),
        // Split the basic terminal's command as well
        basicCommandSplit = basicCommand.split('-SPLIT-')

      // Add the temp keep argument to the main process
      commandSplit[commandSplit.length - 1] += keepTempArgument

      // Loop through each portion and execute it
      commandSplit.forEach((portion, index) => this.command(`${portion.trimStart()}${(index + 1) >= commandSplit.length ? '' : ' \\'}`))

      try {
        if (!this.isBasicCQLSHEnabled)
          throw 0

        /**
         * For the basic process
         *
         * Add the important argument
         */
        basicCommandSplit[basicCommandSplit.length - 1] += basicArgument

        // Loop through each portion and execute it
        basicCommandSplit.forEach((portion, index) => this.command(`${portion}${(index + 1) >= basicCommandSplit.length ? '' : ' \\'}`, undefined, undefined, 'processBasic'))
      } catch (e) {}
    }
  }

  /**
   * Get the connected-to connection's metadata
   *
   * @Parameters:
   * {string} `metadataPrintRequestID` The request's generated ID
   * {string} `currentBuffer` the current buffer - active line content - in the app's associated UI terminal
   */
  getMetadata(metadataPrintRequestID, currentBuffer) {
    // We change the value of `metadataPrintRequestID`; so when we receive data from cqlsh it'll be handled within the `print metadata` request
    this.metadataPrintRequestID = metadataPrintRequestID

    // Execute the command/statement
    this.command(`print metadata (${metadataPrintRequestID})`, null, currentBuffer)

    // Define the request ID that the renderer thread is listening to
    let requestID = `connection:metadata:${this.metadataPrintRequestID}:${this.id}`,
      // Define the temp file path; to be watched once it's created
      tempFile = Path.join(OS.tmpdir(), `${this.metadataPrintRequestID}.metadata`)

    // Watch the temp file existence
    watchFileExistance(tempFile, async (found) => {
      // If the file not found for any reason then send `null` result to the renderer thread
      if (!found) {
        this.window.webContents.send(requestID, {
          metadata: null,
          connectionID: this.id
        })

        // Skip the upcoming code
        return
      }

      // Read the file's content
      let metadataContent = await FS.readFileSync(tempFile, 'utf8')

      // Send the metadata JSON block, attached with the connection's ID
      this.window.webContents.send(requestID, {
        metadata: metadataContent,
        connectionID: this.id
      })

      // Remove the temp file
      try {
        FS.unlinkSync(tempFile)
      } catch (e) {
        try {
          // If the error is a number then don't log the error
          if (!isNaN(parseInt(e.toString())))
            throw 0

          addLog(`Error in process terminal. Details: ${e}`, 'error')
        } catch (e) {}
      }
    })
  }

  /**
   * Get a CQL description of the connected-to connection, keyspace in it, or a table
   * The process is handled in the `constructor` function as we've executed the `print` command
   *
   * @Parameters:
   * {string} `cqlDescPrintRequestID` The request's generated ID
   * {string} `scope` The description's scope - explained the renderer thread -
   * {string} `currentBuffer` the current buffer - active line content - in the app's associated UI terminal
   */
  getCQLDescription(cqlDescPrintRequestID, scope, currentBuffer) {
    // We change the value of `cqlDescPrintRequestID`; so when we receive data from cqlsh it'll be handled within the `print cql_desc` request
    this.cqlDescPrintRequestID = cqlDescPrintRequestID

    // Execute the command/statement
    this.command(`print cql_desc (${cqlDescPrintRequestID}) (${scope})`, null, currentBuffer)

    // Define the request ID that the renderer thread is listening to
    let requestID = `connection:cql-desc:${this.cqlDescPrintRequestID}:${this.id}`,
      // Define the temp file path; to be watched once it's created
      tempFile = Path.join(OS.tmpdir(), `${this.cqlDescPrintRequestID}.cqldesc`)

    // Watch the temp file existence
    watchFileExistance(tempFile, async (found) => {
      // If the file is not found for any reason then send the `null` result to the renderer thread
      if (!found) {
        this.window.webContents.send(requestID, {
          cqlDesc: null,
          connectionID: this.id
        })

        // Skip the upcoming code
        return
      }

      // Read the file's content
      let cqlDescContent = await FS.readFileSync(tempFile, 'utf8')

      // Send the cqlDesc JSON block, attached with the connection's ID
      this.window.webContents.send(requestID, {
        cqlDesc: cqlDescContent,
        connectionID: this.id
      })

      // Remove the temp file
      try {
        FS.unlinkSync(tempFile)
      } catch (e) {
        try {
          // If the error is a number then don't log the error
          if (!isNaN(parseInt(e.toString())))
            throw 0

          addLog(`Error in process terminal. Details: ${e}`, 'error')
        } catch (e) {}
      }
    })
  }

  /**
   * Check the connectivity status with the current connection
   * The process is handled in the `constructor` function as we've executed the `check connection` command
   *
   * @Parameters:
   * {string} `checkConnectivityRequestID` The request's generated ID
   * {string} `currentBuffer` the current buffer - active line content - in the app's associated UI terminal
   */
  checkConnectivity(checkConnectivityRequestID, currentBuffer) {
    // We change the value of `checkConnectivityRequestID`; so when we receive data from cqlsh it won't be printed in the terminal
    this.checkConnectivityRequestID = checkConnectivityRequestID

    // Execute the command/statement
    this.command(`check connection (${checkConnectivityRequestID})`, null, currentBuffer)

    // Define the request ID that the renderer thread is listening to
    let requestID = `connection:check-connection:${this.checkConnectivityRequestID}:${this.id}`,
      // Define the temp file path; to be watched once it's created
      tempFile = Path.join(OS.tmpdir(), `${this.checkConnectivityRequestID}.checkconn`)

    // Watch the temp file existence
    watchFileExistance(tempFile, async (found) => {
      // If the file is not found for any reason then send the `null` result to the renderer thread
      if (!found) {
        this.window.webContents.send(requestID, null)

        // Skip the upcoming code
        return
      }

      // Read the file's content
      let checkResult = await FS.readFileSync(tempFile, 'utf8')

      // Send the the result within the response as boolean
      this.window.webContents.send(requestID, checkResult == 'True')

      // Remove the temp file
      try {
        FS.unlinkSync(tempFile)
      } catch (e) {
        try {
          // If the error is a number then don't log the error
          if (!isNaN(parseInt(e.toString())))
            throw 0

          addLog(`Error in process terminal. Details: ${e}`, 'error')
        } catch (e) {}
      }
    })
  }

  /**
   * Get a query tracing's result for a session by passing its ID
   * The process is handled in the `constructor` function as we've executed the related statement
   *
   * @Parameters:
   * {string} `requestID` The request's generated ID
   * {string} `sessionID` The aimed session's ID
   * {string} `currentBuffer` the current buffer - active line content - in the app's associated UI terminal
   */
  getQueryTracing(requestID, sessionID, currentBuffer) {
    // We change the value of `getQueryTracingRequestID`; so when we receive data from cqlsh it'll be handled within the query tracing request
    this.getQueryTracingRequestID = requestID

    // Execute the command/statement
    this.command('select JSON * from system_traces.events where session_id = ' + sessionID + ';', null, currentBuffer)
  }
}

/**
 * Test connection with a given connection based on its `cqlsh.rc` file
 *
 * @Parameters:
 * {object} `window` the associated renderer thread - it's expected to be the main renderer thread -
 * {object} `data` a JSON object which has many attributes to be considered
 */
let testConnection = (window, data) => {
  // Final test result which be returned
  let result = {
      connected: false, // Connection status - `false`: failed, `true`: succeed - with the connection
      version: '-' // Apache Cassandra's version
      // `error` attribute is added in case there's one
    },
    // If we've got JSON string then the connection test has succeeded
    gotJSON = false,
    // Used to prevent sending the test result more than once
    resultSent = false,
    // Counter; to make sure that a response will be sent to the renderer thread for sure after 4 received data blocks
    count = 0,
    // Save the last given output; so we can track the connection process and detect errors
    lastOutput = '',
    // Whether or not send the test's final result
    send = false,
    // Send time out to be triggered within 5 seconds
    sendTimeout = null,
    // All output from the testing process is appended here
    fullOutput = '',
    // The connection test process' ID
    processID = data.processID

  // There might be duplicated code here; as this function is isolated from the Pty class
  try {
    // Create a temporary pty instance that will contain cqlsh instance
    let tempProcess = PTY.spawn(Shell, [], {
      cwd: CWD,
      useConpty: false
    })

    // If the host is Windows then change the binary call format
    let binCall = (Platform == 'win32') ? 'cqlsh.exe' : './cqlsh',
      // Define the cqlsh tool's directory
      binDirectory = `cd "cqlsh" && `

    // Switch to the single-file mode
    try {
      if (!FS.lstatSync(Path.join(CWD, `cqlsh`)).isDirectory())
        binDirectory = ''
    } catch (e) {}

    // If there are more arguments to be passed - like username and password -
    let moreArguments = ''
    try {
      // If not, then we may skip this try-catch block
      if ([null, undefined].includes(data.secrets))
        throw 0

      // Otherwise, secrets will be passed as arguments
      moreArguments += `--username="${data.secrets.username}"  -SPLIT- `
      moreArguments += `--password="${data.secrets.password}"  -SPLIT- `
    } catch (e) {}

    // Check if we've got a port to override the given one in `cqlsh.rc`
    let override = ''
    if (data.sshPort != undefined)
      override = `127.0.0.1 ${data.sshPort} --overrideHost="${data.sshHost}"`

    if (data.port != undefined)
      override = `127.0.0.1 ${data.port}`

    // Check if adding a change code page command is required
    let pageCode = Platform == 'win32' ? 'chcp 65001 && ' : ''

    try {
      data.variables = data.variables || {}
    } catch (e) {}

    let command = `${pageCode}${binDirectory}${binCall} -SPLIT- ${override} -SPLIT- --cqlshrc="${data.cqlshrc || data.cqlshrcPath}" -SPLIT- ${moreArguments} --test 1 --varsManifest="${data.variables.manifest}" -SPLIT- --varsValues="${data.variables.values}" -SPLIT- --workspaceID="${data.workspaceID}"`

    try {
      if (data.scbFilePath == undefined)
        throw 0

      command = `${pageCode}${binDirectory}${binCall} -SPLIT- ${override} -SPLIT- ${moreArguments} --test 1 -SPLIT- --workspaceID="${data.workspaceID}" --secure-connect-bundle="${data.scbFilePath}"`
    } catch (e) {}

    try {
      // If the host OS is macOS then skip this try-catch block
      if (Platform == 'darwin')
        throw 0

      // Run the cqlsh's executing command in the main process
      tempProcess.write(command.replace(/\-SPLIT\-/g, '') + OS.EOL)
    } catch (e) {
      // Split the command into portions using the keyword
      let commandSplit = command.split('-SPLIT-')

      // Loop through each portion and execute it
      commandSplit.forEach((portion, index) => tempProcess.write(`${portion.trimStart()}${(index + 1) >= commandSplit.length ? OS.EOL : (' \\' + OS.EOL)}`))
    }

    // With every received data
    tempProcess.on('data', async (output) => {
      // If the output contains any of the strings then it won't be count
      if (['bin', 'bash', 'zsh'].every((str) => output.toLowerCase().indexOf(str) <= -1))
        ++count // Increment the counter

      // Append the output's content
      fullOutput += `${output}`

      // Get rid of new line and line breaks
      fullOutput = fullOutput.replace(/\n/g, '')
      fullOutput = fullOutput.replace(/\r/g, '')

      // Check the output in overall; to determine if the testing process has finished or not
      checkOutput(output)
    })

    // Check the given output against several conditions
    let checkOutput = (output) => {
      // If a JSON object has been given then skip the checking process
      if (gotJSON)
        return

      // If `--cqlshrc` has been catched in the output then it means something went wrong with the test and we weren't able to make the test process
      if (lastOutput.indexOf('--cqlshrc') != -1 || lastOutput.match(/\-\-[a-z]+/gm) != null)
        lastOutput = 'Unable to make the test process'

      // Set the manipulated output as the last output if it has met the conditions
      if (output.toLowerCase().indexOf('active code') <= 0 && output.length > 5 && ['bin', 'bash', 'zsh'].every((str) => output.indexOf(str) <= -1))
        lastOutput = output.replace(/\r?\n?KEYWORD:([A-Z0-9]+)(:[A-Z0-9]+)*((-|:)[a-zA-Z0-9\[\]\,]+)*\r?\n?/gmi, '')

      // Replace non-ascii chars, except the common ones - like brackets and colon -
      lastOutput = lastOutput.replace(/[^\x20-\x7E()[\]:,"']/g, '')

      // Match and clean more ASCII escape characters for Windows
      if (Platform == 'win32')
        lastOutput = lastOutput.replace(/[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\[0K|\[\?25[hl]/g, '')

      // Replace `[K` char which can be printed in Windows cmd
      lastOutput = lastOutput.replace(/\[K/g, '')

      // If this try-catch block has been executed without errors then it means we've got JSON data and we may send the data and end the test process
      try {
        // Manipulate the full output
        let jsonString = manipulateOutput(fullOutput)

        // Deal with the given data as JSON string by default
        jsonString = jsonString.match(/\{[\s\S]+\}/gm)[0]

        // Repair the JSON to make sure it can be converted to JSON object easily
        jsonString = JSONRepair(jsonString)

        // Convert JSON content from string to object
        let jsonObject = JSON.parse(jsonString)

        /**
         * The test connection has been completed with success
         * We can get the Apache Cassandra version that we've connected with
         */
        result.connected = true
        result.version = jsonObject.build

        // If the version is `undefined` then it happens that the output split into multiple lines
        if (result.version == undefined)
          result.version = jsonObject[0].build

        // Get the connection's data center
        result.datacenter = jsonObject.datacenter

        // Do the same thing - as the version - with the data center
        if (result.datacenter == undefined)
          result.datacenter = jsonObject[0].datacenter

        try {
          // Get all detected/seen data centers
          result.datacenters = jsonObject.datacenters

          // Do the same thing - as the data center - with the data centers
          if (result.datacenters == undefined)
            result.datacenters = jsonObject[0].datacenters
        } catch (e) {}

        // Set `gotJSON` to true to end the connection test
        gotJSON = true
      } catch (e) {}

      // Inner function to send the test's result
      let sendResult = () => {
        // If the condition is `true` then send the test result to the renderer thread
        window.webContents.send(`pty:test-connection:${data.requestID}`, {
          ...result,
          error: lastOutput.replace(/\r?\n?KEYWORD:([A-Z0-9]+)(:[A-Z0-9]+)*((-|:)[a-zA-Z0-9\[\]\,]+)*\r?\n?/gmi, '')
        })

        // Add log about the result
        try {
          addLog(`Test result with connection/node is ${JSON.stringify(result)}`)
        } catch (e) {}

        // Update `resultSent` to prevent sending the test result more than once
        resultSent = true

        // To be more sure about ending the testing process 3 attempts (300ms in total) is executed; to kill the pty process by its pid
        try {
          let tries = 0,
            interval = setInterval(() => {
              if (tries > 2)
                return clearInterval(interval); // This semicolon is critical here

              ++tries
              try {
                // Call the `destroy` function from the pty instance
                tempProcess.destroy()

                // Attempt to kill the pty instance process by its process ID
                Kill(tempProcess.pid, 'SIGKILL')
              } catch (e) {}
            }, 100)
        } catch (e) {}
      }

      // Either we've got a valid JSON string or catched the `TEST-COMPLETED` keyword or an error has occurred, and the test's result is not yet sent to the renderer thread
      if ((gotJSON || (fullOutput.indexOf('KEYWORD:TEST:COMPLETED') != -1) || (fullOutput.toLowerCase().indexOf('error') != -1 && fullOutput.toLowerCase().indexOf('symbol') <= -1)) && !resultSent) {
        // If we need to send the results now
        if (send) {
          // Clear the timeout function
          clearTimeout(sendTimeout)

          // Call the send function
          sendResult()

          // Skip the upcoming code
          return
        }

        // Update `send` to `true`; to send the results next time or within 5 seconds
        send = true

        // Set timeout to be triggered if there's no more output
        sendTimeout = setTimeout(() => sendResult())
      }
    }

    // Received request to terminate the connection test process
    IPCMain.on(`process:terminate:${processID}`, (_, __) => {
      // Define final status to be returned
      let status = false

      try {
        // Call the `destroy` function from the pty instance
        tempProcess.destroy()

        // Attempt to kill the pty instance process by its process ID
        Kill(tempProcess.pid, 'SIGKILL')

        // Successfully terminated
        status = true
      } catch (e) {
        try {
          // If the error is a number then don't log the error
          if (!isNaN(parseInt(e.toString())))
            throw 0

          addLog(`Error in process terminal. Details: ${e}`, 'error')
        } catch (e) {}
      } finally {
        // Send final status
        window.webContents.send(`process:terminate:${processID}:result`, status)

        // Send to the renderer thread that the test process has been finished with `terminated` attribute
        window.webContents.send(`pty:test-connection:${data.requestID}`, {
          ...result,
          terminated: true
        })
      }
    })
  } catch (e) {
    try {
      // If the error is a number then don't log the error
      if (!isNaN(parseInt(e.toString())))
        throw 0

      addLog(`Error in process terminal. Details: ${e}`, 'error')
    } catch (e) {}

    window.webContents.send(`pty:test-connection:${data.requestID}`, {
      ...result,
      error: lastOutput.replace(/\r?\n?KEYWORD:([A-Z0-9]+)(:[A-Z0-9]+)*((-|:)[a-zA-Z0-9\[\]\,]+)*\r?\n?/gmi, '')
    })
  }
}

/**
 * Watch a given file and callback once it's exists
 *
 * @Parameters:
 * {string} `filePath` the aimed file's path - which will be watched -
 * {object} `callback` function that will be triggered when the aimed file has been created
 * {integer} `?startTime` the start timestamp of this process
 *
 * @Return: {boolean} the watching process' result
 */
let watchFileExistance = (filePath, callback, startTime = new Date().getTime()) => {
  try {
    // Once it exists return `true` with the callback function
    if (FS.existsSync(filePath))
      return callback(true)

    throw 0
  } catch (e) {
    // Get current time
    let time = new Date().getTime()

    /**
     * Maximum watch time is 30 seconds
     * If the watcher failed to see the file within the specific time then it'll return `false` with the callback function
     */
    if ((time - startTime) >= 30000)
      return callback(false)

    // Make the process executed recursively
    setTimeout(() => watchFileExistance(filePath, callback, startTime), 1000)
  }
}

/**
 * Manipulate a passed output by removing all possible ANSI escape sequences
 *
 * @Parameters:
 * {string} `output` the output to be manipulated
 *
 * @Return: {string} the manipulated output
 */
let manipulateOutput = (output) => {
  try {
    /**
     * Manipulate the passed output
     *
     * Remove all possible ANSI escape sequences using a basic regex
     */
    let manipulatedOutput = `${output}`.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      /**
       * Use an advanced regex as an extra step of the manipulation
       * The regex has been retrieved from the `ansi-regex` module -
       */
      .replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '')
      /**
       * Use another regex to cover all ANSI sequences as much as possible
       * Reference: https://stackoverflow.com/a/29497680
       */
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
      // Remove some added chars from cqlsh tool
      .replace(/u\'/gm, "'")

    // Match and clean more ASCII escape characters for Windows
    if (Platform == 'win32')
      manipulatedOutput = manipulatedOutput.replace(/[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\[0K|\[\?25[hl]/g, '')

    // Return the final manipulated output
    return manipulatedOutput
  } catch (e) {
    // If any error has occured then return the passed output
    return output
  }
}

/**
 * Function especially for Windows; to clean a given command and make it able to be compared with
 *
 * @Parameters:
 * {string} `command` the command to be manipulated
 *
 * @Return: {string} the manipulated command
 */
let cleanCommand = (command) => {
  // Remove all terminal's special characters
  command = manipulateOutput(command)

  // Lower the case of all characters in the command
  command = command.toLowerCase()
    // Get rid of extra weird unwanted characters and symbols
    .replace(/^(.*?>)/gm, '')
    .replace(/\\n/gm, '')
    .replace('�[0K�[0K�[?25h', '')
    // Get rid of start and end spaces
    .trim()

  // Return the final manipulated command
  return command
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

/**
 * Handle the creation of a Bash session inside the Docker project
 * Also handle the needed communication between the main and renderer threads
 *
 * @Parameters:
 * {object} `window` the associated renderer thread - it's expected to be the main renderer thread -
 * {object} `data` a JSON object which has many attributes to be considered
 */
let bashSession = (window, data) => {
  // Create the pty instance and set the docker project folder as the current working directory
  let process = PTY.spawn(Shell, [], {
    cwd: data.path,
    useConpty: false
  })

  // If the OS is macoS then make sure to update the `PATH` variable
  if (Platform == 'darwin')
    process.write(`export PATH=$PATH:~/.rd/bin:~/homebrew/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin:/usr/sbin` + OS.EOL)

  // Immediately attempt to execute the command of executing `bash` inside the first Cassandra's node container
  process.write(`${data.dockerComposeBinary} -p "${data.projectID}" exec "cassandra-0" /bin/bash` + OS.EOL)

  // When receiving any data from the instance send it to the provided window
  process.on('data', (_data) => window.webContents.send(`pty:${data.id}:data:bash-session`, _data))

  // When receiving a command to be executed from te renderer thread
  data.IPCMain.on(`pty:${data.id}:command:bash-session`, (_, command) => {
    try {
      // Send the command to the pty instance
      process.write(command)
    } catch (e) {
      try {
        // If the error is a number then don't log the error
        if (!isNaN(parseInt(e.toString())))
          throw 0

        addLog(`Error in process terminal. Details: ${e}`, 'error')
      } catch (e) {}
    }
  })

  // When receiving a request to close the bash session
  data.IPCMain.on(`pty:${data.id}:close:bash-session`, (_, __) => {
    try {
      // Call the `destroy` function from the pty instance
      process.destroy()

      // Attempt to kill the pty instance process by its process ID
      Kill(process.pid, 'SIGKILL')
    } catch (e) {
      try {
        // If the error is a number then don't log the error
        if (!isNaN(parseInt(e.toString())))
          throw 0

        addLog(`Error in process terminal. Details: ${e}`, 'error')
      } catch (e) {}
    }
  })
}

let runKeysGenerator = (callback) => {
  let output = '',
    process = ChildProcessSpawn('./keys_generator', {
      cwd: Path.join(CWD, 'keys_generator'),
    })

  process.stdout.on('data', (data) => {
    output += `${data}`
  })

  process.stderr.on('data', () => callback(output))

  process.on('close', () => callback(output))

  process.on('error', () => callback(output))
}

let initializeCQLSH = (window) => {
  // Create the pty instance and set the docker project folder as the current working directory
  let process = PTY.spawn(Shell, [], {
      cwd: CWD,
      useConpty: false
    }),
    output = ''

  process.write('cd "cqlsh/" && ./cqlsh --username=cassandra --password=cassandra --initialize=1' + OS.EOL)

  process.on('data', (data) => {
    output += `${data}`

    if ((manipulateOutput(output).match(/KEYWORD:INIT:COMPLETED/gi) || []).length >= 1)
      window.webContents.send(`pty:cqlsh:initialize:finished`)
  })
}

module.exports = {
  Pty,
  testConnection,
  bashSession,
  runKeysGenerator,
  initializeCQLSH
}
