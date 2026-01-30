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
 * New module to handle connections' sessions instead of cqlsh Python session using `node-pty
 *
 * Load the new module
 */
const CQLNode = require('@cqlai/node').CQLSession

/**
 * The module is mainly this class with different attributes and methods
 * With each session we create an instance from this class
 */
class Session {
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

    // For AstraDB; the path to SCB file
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

    /**
     * IDs of different requests from the renderer thread and related variables
     */
    this.metadataPrintRequestID = '' // Store the ID of connection's metadata print request
    this.cqlDescPrintRequestID = '' // Hold the ID of CQL description's fetch/print request
    this.checkConnectivityRequestID = '' // Hold the ID of connectivity check request
    this.getQueryTracingRequestID = '' // Store the ID of query tracing's result get request

    /**
     * Store the received block ID within the command/statement
     * Having value in this variable means the command is received from an interactive terminal
     */
    this.latestBlockID = ''

    // If we've got secrets (username and password)
    this.secrets = data.secrets || null

    // If we've got SSH tunneling info
    this.ssh = data.ssh || null

    this.sessionInstance = null
  }

  /**
   * Original --> createCQLSHInstance
   * Create a cqlsh instance
   * The proper cqlsh version will be called based on the given Apache Cassandra's version
   *
   * @Parameters:
   * {string} `cqlshrcPath` The associated `cqlsh.rc` file's path
   */
  async connect(data) {
    let parameters = {
      ...data
    }

    // If there are more arguments to be passed - like username and password -
    try {
      // If not, then we may skip this try-catch block
      if ([null, undefined].includes(this.secrets))
        throw 0

      parameters.username = this.secrets.username
      parameters.password = this.secrets.password
    } catch (e) {}

    // Check if SSH tunneling info has been given
    try {
      // If not, then we may skip this try-catch block
      if ([null, undefined].includes(this.ssh))
        throw 0

      parameters.port = this.ssh.port
      parameters.overridePort = this.ssh.oport
      parameters.overridePort = this.ssh.oport
    } catch (e) {}

    try {
      parameters.cqlshrc = `${data.cqlshrc || data.cqlshrcPath}`
    } catch (e) {}

    try {
      parameters.varsManifest = `${data.variables.manifest}`
    } catch (e) {}

    try {
      parameters.varsValues = `${data.variables.values}`
    } catch (e) {}

    try {
      parameters.workspaceID = `${this.workspaceID}`
    } catch (e) {}

    let isAstraDB = !(this.scbFilePath == undefined)

    try {
      if (isAstraDB)
        parameters = {
          bundlePath: this.scbFilePath,
          ...parameters
        }
    } catch (e) {}

    CQLNode[!isAstraDB ? 'connect' : 'connectWithAstraBundle'](parameters).then((result) => {
      // Send connection status
      this.window.webContents.send(`pty:connection-status:${this.id}`, {
        ...result,
        data: null
      })

      // Error, no need to do anything further
      if (result.error)
        return

      this.sessionInstance = isAstraDB ? result.data.session : result.data
    })
  }

  /**
   * Send command to the pty instance
   *
   * @Parameters:
   * {string} `command` the command's text to be sent
   * {string} `blockID` the associated block's ID in the app's UI
   */
  command(command, blockID) {
    // If the command is one of the array's items then we'll stop sending data, and destroy the pty instance
    if ((['quit', 'exit']).some((keyword) => command.toLowerCase().startsWith(keyword)))
      this.sendData = false

    // Update the latest received block ID as well
    this.latestBlockID = blockID || ''

    // Attempt to execute the given command(s) and return the result
    this.sessionInstance.execute(command, {
      stopOnError: true,
      onProgress: async (result) => {
        this.window.webContents.send(`pty:data:${this.id}`, {
          output: result,
          blockID: this.latestBlockID
        })
      }
    }).then(async (result) => {
      // Handle early errors (incomplete, parse error) that don't trigger onProgress
      if (!result.success && result.statementsCount === 0)
        this.window.webContents.send(`pty:data:${this.id}`, {
          output: result,
          blockID: this.latestBlockID
        })
    })
  }

  sourceCommand(files, stopOnError, blockID) {
    this.sessionInstance.executeSourceFiles({
      files,
      stopOnError,
      onProgress: async (result) => {
        this.window.webContents.send(`cql:file:execute:data:${this.id}`, {
          output: result,
          blockID
        })
      }
    }).then(async (result) => {
      // Handle early errors (incomplete, parse error) that don't trigger onProgress
      if (!result.success && result.statementsCount === 0)
        this.window.webContents.send(`cql:file:execute:data:${this.id}`, {
          output: result,
          blockID: this.latestBlockID
        })
    })
  }

  stopSourceExecution() {
    this.sessionInstance.stopSourceExecution().then(async (result) => this.window.webContents.send(`pty:stop-source-execution:${this.id}`, {
      output: result
    }))
  }

  fetchNextPage(queryID, blockID, subOutputID) {
    // Update the latest received block ID as well
    this.latestBlockID = blockID || ''

    // Attempt to execute the given command(s) and return the result
    this.sessionInstance.fetchNextPage(queryID).then(async (result) => this.window.webContents.send(`pty:data:${this.id}`, {
      output: result,
      blockID: this.latestBlockID,
      subOutputID,
      fromNextPage: true
    }))
  }

  // Close, kill and destroy the pty instance, furthermore, kill the instance using a different approach by its process ID
  close() {
    try {
      this.sessionInstance.close()
    } catch (e) {}
  }

  /**
   * Get the connected-to connection's metadata
   *
   * @Parameters:
   * {string} `metadataPrintRequestID` The request's generated ID
   */
  getMetadata(metadataPrintRequestID) {
    // We change the value of `metadataPrintRequestID`; so when we receive data from cqlsh it'll be handled within the `print metadata` request
    this.metadataPrintRequestID = metadataPrintRequestID

    // Define the request ID that the renderer thread is listening to
    let requestID = `connection:metadata:${this.metadataPrintRequestID}:${this.id}`

    try {
      this.sessionInstance.getClusterMetadata().then((result) => this.window.webContents.send(requestID, {
        result,
        connectionID: this.id
      }))
    } catch (e) {}
  }

  /**
   * Get a CQL description of the connected-to connection, keyspace in it, or a table
   * The process is handled in the `constructor` function as we've executed the `print` command
   *
   * @Parameters:
   * {string} `cqlDescPrintRequestID` The request's generated ID
   * {string} `scope` The description's scope - explained the renderer thread -
   */
  getCQLDescription(cqlDescPrintRequestID, scope) {
    // We change the value of `cqlDescPrintRequestID`; so when we receive data from cqlsh it'll be handled within the `print cql_desc` request
    this.cqlDescPrintRequestID = cqlDescPrintRequestID

    // Define the request ID that the renderer thread is listening to
    let requestID = `connection:cql-desc:${this.cqlDescPrintRequestID}:${this.id}`

    try {
      this.sessionInstance.getDDL(scope).then((result) => this.window.webContents.send(requestID, {
        result,
        connectionID: this.id
      }))
    } catch (e) {}
  }

  /**
   * Get a query tracing's result for a session by passing its ID
   * The process is handled in the `constructor` function as we've executed the related statement
   *
   * @Parameters:
   * {string} `requestID` The request's generated ID
   * {string} `sessionID` The aimed session's ID
   */
  getQueryTracing(requestID, sessionID) {
    // We change the value of `getQueryTracingRequestID`; so when we receive data from cqlsh it'll be handled within the query tracing request
    this.getQueryTracingRequestID = requestID

    try {
      this.sessionInstance.getQueryTrace(sessionID).then((result) => this.window.webContents.send(`connection:query-tracing:${requestID}`, {
        result,
        connectionID: this.id
      }))
    } catch (e) {}
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
    // The connection test process' ID
    processID = data.processID

  // Send the renderer thread that the connection's testing attempt can be terminated
  window.webContents.send(`process:can-be-terminated:${processID}`, true)

  try {
    // Define final JSON object to be passed to test the connection
    let options = {}

    try {
      // If the connection doesn't have any secret data, then we may skip this try-catch block
      if (!([null, undefined].includes(data.secrets))) {
        // Otherwise, secrets will be passed as arguments
        options.username = data.secrets.username
        options.password = data.secrets.password
      }
    } catch (e) {}

    try {
      // Check if we've got a port to override the given one in `cqlsh.rc`
      if (data.sshPort != undefined) {
        options.port = data.sshPort
        options.host = data.sshHost
      }
    } catch (e) {}

    // Check if we've got an actual port
    if (data.port != undefined)
      options.port = data.port

    // Define variables JSON object to avoid any possible error
    try {
      data.variables = data.variables || {}
    } catch (e) {}

    // Give the test request a unique ID
    options.requestID = processID

    /**
     * For Astra DB
     * Define special attributes for the connection
     */
    let isAstraDB = !(data.scbFilePath == undefined)

    if (isAstraDB)
      options.bundlePath = data.scbFilePath

    options = {
      ...data,
      ...options
    }

    if (!isAstraDB) {
      options = {
        ...options,
        cqlshrc: data.cqlshrc || data.cqlshrcPath,
        varsManifest: data.variables.manifest,
        varsValues: data.variables.values
      }
    }

    CQLNode[!isAstraDB ? 'testConnectionWithID' : 'testAstraConnectionWithID'](options).then((testResult) => sendResult(testResult))

    // Inner function to send the test's result
    let sendResult = (testResult) => {
      try {
        /**
         * The test connection has been completed with success
         * We can get the Apache Cassandra version that we've connected with
         */
        result.connected = testResult.success

        if (result.connected) {
          result.version = testResult.data.build

          // Get the connection's data center
          result.datacenter = testResult.data.datacenter

          // Get all detected/seen data centers
          result.datacenters = testResult.data.datacenters
        } else {
          result.error = `${testResult.error} [${testResult.code}]`
        }
      } catch (e) {}

      // If the condition is `true` then send the test result to the renderer thread
      window.webContents.send(`pty:test-connection:${data.requestID}`, {
        ...result
      })

      // Add log about the result
      try {
        addLog(`Test result with connection/node is ${JSON.stringify(result)}`)
      } catch (e) {}
    }
  } catch (e) {}

  // Received request to terminate the connection test process
  IPCMain.on(`process:terminate:${processID}`, () => CQLNode.cancelTestConnection(processID))
}

module.exports = {
  Session,
  testConnection
}
