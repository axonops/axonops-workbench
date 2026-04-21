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
 * Module to handle connections' sessions using cqlai-node
 *
 * Load the module
 */
const CQLNode = require('@axonops/cqlai-node').CQLSession

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
    this.id = data.id
    this.window = window
    this.scbFilePath = data.scbFilePath

    this.cassandraVersion = data.version
    this.logPath = data.logPath
    this.workspaceID = data.workspaceID

    this.sendData = true

    this.metadataPrintRequestID = ''
    this.cqlDescPrintRequestID = ''
    this.checkConnectivityRequestID = ''
    this.getQueryTracingRequestID = ''

    this.latestBlockID = ''

    this.secrets = data.secrets || null
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
    let parameters = { ...data }

    try {
      if ([null, undefined].includes(this.secrets))
        throw 0

      parameters.username = this.secrets.username
      parameters.password = this.secrets.password
    } catch (e) {}

    try {
      if ([null, undefined].includes(this.ssh))
        throw 0

      parameters.port = parseInt(this.ssh.port)
      parameters.host = `127.0.0.1`
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

    let isAstraDB = this.scbFilePath != undefined

    try {
      if (isAstraDB)
        parameters = {
          bundlePath: this.scbFilePath,
          ...parameters
        }
    } catch (e) {}

    try {
      for (let parameter of ['varsManifest', 'varsValues', 'cqlshrc']) {
        let toBeDeleted = false

        if (parameters[parameter] == undefined)
          toBeDeleted = true

        try {
          if (toBeDeleted)
            throw 0

          let file = FS.readFileSync(parameters[parameter], 'utf8')

          if (file.length <= 0)
            toBeDeleted = true
        } catch (e) {}

        if (toBeDeleted)
          delete parameters[parameter]
      }
    } catch (e) {}

    CQLNode[!isAstraDB ? 'connect' : 'connectWithAstraBundle'](parameters).then((result) => {
      this.window.webContents.send(`pty:connection-status:${this.id}`, {
        ...result,
        data: null
      })

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
    if ((['quit', 'exit']).some((keyword) => command.toLowerCase().startsWith(keyword)))
      this.sendData = false

    this.latestBlockID = blockID || ''

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
    this.latestBlockID = blockID || ''

    this.sessionInstance.fetchNextPage(queryID).then(async (result) => this.window.webContents.send(`pty:data:${this.id}`, {
      output: result,
      blockID: this.latestBlockID,
      subOutputID,
      fromNextPage: true
    }))
  }

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
    this.metadataPrintRequestID = metadataPrintRequestID

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
    this.cqlDescPrintRequestID = cqlDescPrintRequestID

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
  let result = {
      connected: false,
      version: '-'
    },
    processID = data.processID

  window.webContents.send(`process:can-be-terminated:${processID}`, true)

  try {
    let options = {}

    try {
      if (!([null, undefined].includes(data.secrets))) {
        options.username = data.secrets.username
        options.password = data.secrets.password
      }
    } catch (e) {}

    if (data.port != undefined)
      options.port = data.port

    try {
      data.variables = data.variables || {}
    } catch (e) {}

    options.requestID = processID

    let isAstraDB = data.scbFilePath != undefined

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

    try {
      if (data.isSSH !== true)
        throw 0

      let port = data.port != undefined ? data.port : data.sshPort

      options.host = '127.0.0.1'
      options.port = parseInt(port)
    } catch (e) {}

    try {
      for (let option of ['varsManifest', 'varsValues', 'cqlshrc']) {
        let toBeDeleted = false

        if (options[option] == undefined)
          toBeDeleted = true

        try {
          if (toBeDeleted)
            throw 0

          let file = FS.readFileSync(options[option], 'utf8')

          if (file.length <= 0)
            toBeDeleted = true
        } catch (e) {}

        if (toBeDeleted)
          delete options[option]
      }
    } catch (e) {}

    CQLNode[!isAstraDB ? 'testConnectionWithID' : 'testAstraConnectionWithID'](options).then((testResult) => sendResult(testResult))

    let sendResult = (testResult) => {
      try {
        result.connected = testResult.success

        if (result.connected) {
          result.version = testResult.data.build
          result.datacenter = testResult.data.datacenter
          result.datacenters = testResult.data.datacenters
        } else {
          result.error = `${testResult.error} [${testResult.code}]`
        }
      } catch (e) {}

      window.webContents.send(`pty:test-connection:${data.requestID}`, {
        ...result
      })

      try {
        addLog(`Test result with connection/node is ${JSON.stringify(result)}`)
      } catch (e) {}
    }
  } catch (e) {}

  IPCMain.on(`process:terminate:${processID}`, () => CQLNode.cancelTestConnection(processID))
}

module.exports = {
  Session,
  testConnection
}
