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
 * Module to handle the Docker - sandbox - feature
 *
 * Import needed YAML parser and dumper module
 */
const YAML = require('js-yaml')

// Set the docker container's default path
const DockerContainersPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'localclusters')

/**
 * Set the default docker compose binary to be used
 * Will be updated with Podman tool if needed
 */
let dockerComposeBinary = 'docker compose'

/**
 * The Docker compose class with different attributes and methods
 * With each docker container an instance from this class is created
 */
class DockerCompose {
  /**
   * The constructor accepts a folder name for the container
   * In this way, we can start and stop the already created docker project without the need to create a new one
   */
  constructor(folderName = null) {
    /**
     * Set the instance's folder name
     * It can be given, or it'll be random - in case of creating a new container -
     */
    this.folderName = folderName || getRandom.id(5)

    /**
     * Set the docker container name
     * It's the same as the final chosen name for the container's folder
     */
    this.containerName = this.folderName
  }

  /**
   * Create a Docker compose YAML file
   *
   * Cassandra's version can be chosen, values are [3.11, 4.0 (default)]
   */
  async createDockerComposeYAML(cassandraVersion = '4.0', installAxonOps = true, numOfNodes = 3) {
    // Add log about this process
    try {
      addLog(`Create local cluster config file with Cassandra v${cassandraVersion} and ${numOfNodes} node(s)`, 'process')
    } catch (e) {}

    // Get a random free-to-use ports for the AxonOps agent and Apache Cassandra
    [this.axonopsPort, this.cassandraPort] = await getRandom.port(2)

    // Load the default Docker Compose YAML file content
    let yamlContent = Modules.Consts.DockerComposeYAML

    // Replace `cassandraPort` placeholders with the given port
    yamlContent = `${yamlContent}`.replace(/\{cassandraPort\}/gm, `${this.cassandraPort}`)

    // Replace `axonopsPort` placeholders with the given port
    yamlContent = yamlContent.replace(/\{axonopsPort\}/gm, `${this.axonopsPort}`)

    // Replace `version` placeholders with the chosen Cassandra's version
    yamlContent = yamlContent.replace(/\{version\}/gm, `${cassandraVersion}`)

    // Handle if the number of nodes to be created in the project is not the default one `3`
    try {
      // If the number of nodes is `3` then skip this try-catch block; as this is the default case already
      if (numOfNodes == 3)
        throw 0

      // Load the YAML content as a JSON object
      let yamlObject = YAML.load(yamlContent),
        // Get the template of different sub-objects to be used later
        cassandraNodeInfo = {
          services: {
            cassandra: {
              ...yamlObject.services['cassandra-1']
            }
          },
          volumes: {
            axonops: yamlObject.volumes['axonops-1'],
            cassandra: yamlObject.volumes['cassandra-1'],
            cassandraLogs: yamlObject.volumes['cassandra-logs-1']
          }
        }

      // Loop through services which starts with `cassandra-`
      Object.keys(yamlObject.services).filter((service) => service.startsWith('cassandra-')).forEach((service) => {
        // Get the number of the current Cassandra service
        let number = parseInt(`${service}`.slice(10)) + 1

        // If it's less than the chosen number of nodes then skip it and move to the next service
        if (number <= numOfNodes)
          return

        // Manipulate the value to be started from `0` again
        number -= 1

        // Delete all related services and volumes to the current Cassandra service
        delete yamlObject.services[`cassandra-${number}`]
        delete yamlObject.volumes[`axonops-${number}`]
        delete yamlObject.volumes[`cassandra-${number}`]
        delete yamlObject.volumes[`cassandra-logs-${number}`]
      })

      /**
       * Loop based on the given number of nodes
       * The loop starts from `1`; as the first node `0` always exists no matter what the number of nodes is
       */
      for (let i = 1; i < numOfNodes; i++) {
        // If the current number is already defined then skip it and move to the next number
        if (yamlObject.services[`cassandra-${i}`] != undefined)
          continue

        // Set Cassandra service
        yamlObject.services[`cassandra-${i}`] = this.applyCassandraNodeID(cassandraNodeInfo.services.cassandra, i)

        // Set different volumes related to the services
        yamlObject.volumes[`axonops-${i}`] = cassandraNodeInfo.volumes.axonops
        yamlObject.volumes[`cassandra-${i}`] = cassandraNodeInfo.volumes.cassandra
        yamlObject.volumes[`cassandra-logs-${i}`] = cassandraNodeInfo.volumes.cassandraLogs
      }

      // Convert YAML JSON object to a string
      yamlContent = YAML.dump(yamlObject)

      // Get rid of `null` value
      yamlContent = `${yamlContent}`.replace(/null/gm, '')
    } catch (e) {
      try {
        errorLog(e, 'local clusters')
      } catch (e) {}
    }

    // Provide unique port for each Cassandra node in the project
    {
      try {
        // Get the latest content's YAML's object
        let latestYamlObject = YAML.load(yamlContent),
          // Get all available nodes - except the first one -
          nodes = Object.keys(latestYamlObject.services).filter((service) => service.startsWith('cassandra-'))

        /**
         * Loop through each node and set a unique port
         *
         * Define index to be used in the loop
         */
        let index = 0

        // Loop through each node in the project
        for (let node of nodes) {
          /**
           * Get a unique port
           * Exception for the first node `cassandra-0`
           */
          let nodePort = (node == 'cassandra-0') ? this.cassandraPort : await getRandom.port()

          // Set the port in format `{Unique Port}:{9043, 9044, 9045, 9043 + n}`
          latestYamlObject.services[node].ports[0] = `${nodePort}:${nodePort}`

          // Update the port in specific environment's variable
          {
            // Set the variable's key
            let envKey = 'CASSANDRA_NATIVE_TRANSPORT_PORT',
              // Get the index of the variable
              envIndex = latestYamlObject.services[node].environment.findIndex((key) => `${key}`.startsWith(envKey))

            // Update the value
            latestYamlObject.services[node].environment[envIndex] = `${envKey}=${nodePort}`
          }

          // Update the port in the healthcheck
          {
            try {
              // Get the test's arguments
              let testArguments = latestYamlObject.services[node].healthcheck.test,
                // Whether or not there's a port to be updated
                isPortFound = !isNaN(testArguments[testArguments.length - 1])

              // If no port has been found - as the last argument - then skip this try-catch block
              if (!isPortFound)
                throw 0

              // Update the value
              latestYamlObject.services[node].healthcheck.test[testArguments.length - 1] = `${nodePort}`
            } catch (e) {}
          }

          // Update the depending-on node for the current node
          {
            try {
              // Get the current depending-on node
              let dependingOnNode = Object.keys(latestYamlObject.services[node].depends_on)[0]

              // If the current depending-on node is the one about to be used then skip this try-catch block
              if (dependingOnNode == `cassandra-${index - 1}`)
                throw 0

              // Update the node's name
              latestYamlObject.services[node].depends_on[`cassandra-${index - 1}`] = {
                ...latestYamlObject.services[node].depends_on[dependingOnNode]
              }

              // Delete the old node
              delete latestYamlObject.services[node].depends_on[dependingOnNode]
            } catch (e) {}
          }

          // Increase the index
          ++index
        }

        try {
          if (installAxonOps)
            throw 0

          delete latestYamlObject.services['axon-dash']
          delete latestYamlObject.services['axon-server']
          delete latestYamlObject.services['elasticsearch']
        } catch (e) {}

        // Convert the new YAML JSON object to a string
        yamlContent = YAML.dump(latestYamlObject)

        // Get rid of `null` value
        yamlContent = `${yamlContent}`.replace(/null/gm, '')
      } catch (e) {}
    }

    // Create the container's folder if not already exist
    try {
      await FS.ensureDirSync(Path.join(DockerContainersPath, this.folderName, 'snapshots'))
    } catch (e) {
      try {
        errorLog(e, 'local clusters')
      } catch (e) {}
    }

    // Write the updated version of the YAML file in the `docker` folder
    try {
      await FS.writeFileSync(Path.join(DockerContainersPath, this.folderName, `docker-compose.yml`), yamlContent, 'utf8')
    } catch (e) {
      try {
        errorLog(e, 'local clusters')
      } catch (e) {}
    }

    // Return some useful info to be used
    return {
      ports: {
        axonops: this.axonopsPort,
        cassandra: this.cassandraPort
      },
      axonops: installAxonOps,
      folder: this.folderName
    }
  }

  // Apply Cassandra node ID to a given content
  applyCassandraNodeID(content, ID) {
    // Convert the given JSON content from object to a string
    content = JSON.stringify(content)

    // Set the given ID in the suitable positions
    content = content.replace(/\-1/gm, `-${ID}`)

    // Convert the JSON object after the manipulation process to a string
    content = JSON.parse(content)

    // Return final content
    return content
  }

  /**
   * Start/Up a docker container using `docker compose`
   *
   * A callback function should be passed, it'll receive a boolean value based on the success of the process
   * The name of the container can be passed, if it hasn't then the instance's container's name will be used
   */
  async startDockerCompose(pinnedToastID, callback, containerName = null) {
    // Set the container's name, or use the instance's one
    containerName = containerName || this.containerName

    // Add log about this process
    try {
      addLog(`Start local cluster in path '${Path.join(DockerContainersPath, this.folderName)}' under name 'cassandra_${containerName}'`, 'process')
    } catch (e) {}

    // Automatically migrate legacy docker-compose file if needed
    try {
      const {
        migrateDockerComposeFile
      } = require('./docker-migration');
      const migrationResult = await migrateDockerComposeFile(Path.join(DockerContainersPath, this.folderName));

      // Log migration status (no user interaction needed)
      if (migrationResult.migrated) {
        try {
          addLog(`Docker Compose file automatically migrated to new format. Backup created: ${migrationResult.backupPath}`, 'info')
        } catch (e) {}
      }

      // If migration was needed but failed, log it but continue anyway
      if (migrationResult.needed && !migrationResult.migrated) {
        try {
          addLog(`Warning: Could not migrate docker-compose.yml: ${migrationResult.message}`, 'warning')
        } catch (e) {}
      }
    } catch (migrationError) {
      // Log migration error but don't stop the process
      try {
        addLog(`Migration check failed: ${migrationError.message}`, 'warning')
      } catch (e) {}
    }

    let extraArgument = ''

    // Execute the `docker compose` command
    Terminal.spawn(`cd "${Path.join(DockerContainersPath, this.folderName)}" && ${dockerComposeBinary} ${extraArgument} -p "cassandra_${containerName}" up -d`, pinnedToastID, 'start', (error, stdout, stderr) => {
      // Set the command execution status
      let status = !error || ([error, stderr, stdout]).some((output) => `${output}`.match(/is already in use/gm) != null),
        // Set the final error details to be adopted
        finalError = stderr || stdout || error

      /**
       * By default, the error message is in the `error` variable
       * Convert the error to be string
       */
      try {
        finalError = finalError.toString()
      } catch (e) {}

      // On macOS the error has mainly two lines; one is the position of the error in the codebase and the other is the actual error's details
      try {
        if (OS.platform() != 'darwin')
          throw 0

        finalError = finalError.split('\n')[1]
      } catch (e) {}

      // Attempt to catch the error from `stdout` if there's an `ERROR:` keyword
      try {
        if (finalError.trim().length != 0)
          throw 0

        finalError = OS.platform() == 'darwin' ? stdout : (stdout.match(/ERROR:([\s\S]+)/g)[0]).replace(/ERROR:/g, '')
      } catch (e) {}

      // Extra process for Windows only
      try {
        if (OS.platform() != 'win32')
          throw 0

        finalError = `${stderr || stdout}`
      } catch (e) {}

      // Add log about this process
      try {
        addLog(`Output of running local cluster '${Path.join(DockerContainersPath, this.folderName)}' under name 'cassandra_${containerName}' is:
          ${stdout}.${finalError != undefined ? ' Possible error: ' + finalError : ''}`)
      } catch (e) {}

      // Call the callback function
      callback({
        status,
        error: !status ? `<pre>${finalError}</pre>` : ''
      })
    })
  }

  /**
   * Stop/Down a docker container using `docker compose`
   *
   * A callback function should be passed, it'll receive a boolean value based on the success of the process
   * The name of the container can be passed, if it hasn't then the instance's container's name will be used
   */
  stopDockerCompose(pinnedToastID, callback, containerName = null) {
    // Set the container's name, or use the instance's one
    containerName = containerName || this.containerName

    // Add log about this process
    try {
      addLog(`Stop local cluster in path '${Path.join(DockerContainersPath, this.folderName)}' under name 'cassandra_${containerName}'`, 'process')
    } catch (e) {}

    let extraArgument = ''

    // Execute the `docker compose` command
    Terminal.spawn(`cd "${Path.join(DockerContainersPath, this.folderName)}" && ${dockerComposeBinary} ${extraArgument} -p "cassandra_${this.containerName}" down`, pinnedToastID, 'stop', (error, stdout, stderr) => {
      // Set the final error details to be adopted
      let finalError = error || stderr

      /**
       * By default, the error message is in the `stderr` variable
       * Convert the error to be string
       */
      try {
        finalError = error.toString()
      } catch (e) {
        try {
          // If failed then `stderr` is `undefined` or `null` and thus convert `error` to be string
          finalError = stderr.toString()
        } catch (e) {}
      }

      // On macOS the error has mainly two lines; one is the position of the error in the codebase and the other is the actual error's details
      try {
        finalError = finalError.split('\n')[1]
      } catch (e) {}

      // Attempt to catch the error from `stdout` if there's an `ERROR:` keyword
      try {
        if (finalError.trim().length != 0)
          throw 0

        finalError = OS.platform() == 'darwin' ? stdout : (stdout.match(/ERROR:([\s\S]+)/g)[0]).replace(/ERROR:/g, '')
      } catch (e) {}

      // Add log about this process
      try {
        addLog(`Output of stopping local cluster '${Path.join(DockerContainersPath, this.folderName)}' under name 'cassandra_${containerName}' is:
          ${stdout}.${finalError != undefined ? ' Possible error: ' + finalError : ''}`)
      } catch (e) {}

      // Call the callback function
      callback({
        status: !error,
        error: !status ? finalError : ''
      })
    })
  }
}

/**
 * Check if the host machine has `docker compose` installed, and - on Linux - if the current user is in the `docker` group
 * Works on all major operating systems (Linux, macOS, and Windows)
 *
 * @Parameters:
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {boolean} the host machine has `docker compose` and the user is in the docker group or not
 */
let checkDockerCompose = (callback) => {
  // Inner function to check the given command and call a callback function
  let checkProcess = (command, callback) => Terminal.run(command, (err, data, stderr) => {
      // Add log about this process
      try {
        addLog(`Check if docker exists in the host machine with command '${command}'. Output is:
         ${err || data || stderr}`)
      } catch (e) {}

      // Call the callback function with the checking result
      callback(!err || [data, stderr].some((output) => `${output}`.toLowerCase().indexOf('version') != -1))
    }),
    // Inner function to be executed after the checking process
    postCheck = (isDockerComposeInstalled, selectedManagementTool) => {
      // If the host OS not Linux then there's no need to check out the `docker` group and just call the callback function
      if (OS.platform() != 'linux')
        return callback(isDockerComposeInstalled, true, selectedManagementTool)

      // Check if the current user in the `docker` group
      Terminal.run('groups', (err, data, stderr) => {
        // Get any possible output
        let output = stderr || err || data,
          // Whether or not the user in the `docker` group
          isUserInDockerGroup = minifyText(`${output}`).indexOf('docker') != -1

        if (selectedManagementTool == 'podman')
          isUserInDockerGroup = true

        // Add log about this process
        try {
          addLog(`Check the current user is in the docker group. Output is:
         ${err || data || stderr}`)
        } catch (e) {}

        // Call the callback function with the final result
        callback(isDockerComposeInstalled, isUserInDockerGroup, selectedManagementTool)
      })
    }

  Modules.Config.getConfig((config) => {
    let selectedManagementTool = config.get('features', 'containersManagementTool')

    try {
      if (`${selectedManagementTool}` != 'podman')
        throw 0

      checkProcess('podman compose --version', (exist) => {
        try {
          // Update the associated variable
          dockerComposeBinary = 'podman compose'

          // Call the post checking process function
          postCheck(exist, selectedManagementTool)
        } catch (e) {}
      })

      return
    } catch (e) {}

    // Start with `docker compose`
    checkProcess('docker compose version', (exist) => {
      try {
        // Update the associated variable
        dockerComposeBinary = 'docker compose'

        // Call the post checking process function
        postCheck(exist, selectedManagementTool)
      } catch (e) {}
    })
  })
}

/**
 * Get the set Docker compose binary
 *
 * @Return: {string} the set docker compose binary `docker compose`
 */
let getDockerComposeBinary = () => dockerComposeBinary

/**
 * Check if Cassandra is up and ready to be connected with in the container
 *
 * @Parameters:
 * {integer} `pinnedToastID` the toast ID which its content will be updated
 * {integer} `port` the port in the host machine that connects to Cassandra in the container
 * {object} `callback` function that will be triggered with passing the final result
 *
 * Other parameters are for internal use only
 * `?timestamp` to track how much time elapsed for the entire process
 * `?requestID` helps with keeping the request ID with every new call of the function
 * `?send` helps with not sending the result again if it has already been sent
 *
 * @Return: {boolean}
 */
let checkCassandraInContainer = (pinnedToastID, port, callback, timestamp = null, requestID = null, send = true) => {
  // Define the checking process' different timeout values
  const TimeOut = {
    // Maximum timeout - when it's exceeded the process will be terminated with failure -
    maximum: 360000, // 6 minutes
    // The timeout before executing the process again
    retry: 5000 // 5 seconds
  }

  // Add log about this process
  try {
    addLog(`Check Cassandra is ready to be connected with or not, listen to port '${port}'`, 'process')
  } catch (e) {}

  // If the result has already been sent then skip the upcoming code and break the recursive loop
  if (!send)
    return

  // Manipulate the requestID in a way it won't be `null` whatsoever
  requestID = requestID || getRandom.id(10)

  // Same thing to the timestamp, it won't be `null` at all
  timestamp = timestamp || new Date().getTime()

  // If about 2 minutes have passed and there's no result regards Cassandra then return a `false` result
  if (new Date().getTime() - timestamp >= TimeOut.maximum) {
    // Be sure to not send the result again
    send = false

    return callback({
      connected: false
    })
  }

  // Send test request to the main thread and pass the port and the request's ID
  IPCRenderer.send('pty:test-connection', {
    sshPort: port,
    requestID
  })

  // Once a response from the main thread has been received
  IPCRenderer.on(`pty:test-connection:${requestID}`, (_, result) => {
    // Handle when the process is meant to be terminated
    try {
      // If the result doesn't have `terminated` attribute with `true` then skip this try-catch block
      if (!result.terminated)
        throw 0

      // Close the associated pinned toast
      pinnedToast.update(pinnedToastID, true, true)

      // Call the callback function
      callback(result)

      // The result has been sent
      send = true

      // Skip the upcoming code
      return
    } catch (e) {}

    // If the result has already been sent then skip the upcoming code
    if (!send)
      return pinnedToast.update(pinnedToastID, true, true)

    // If the received result tells that Cassandra is ready then call the callback function and finish the process
    if (result.connected && result.version != undefined) {
      // Add log about the final result of the process
      try {
        addLog(`Cassandra on port '${port}' is ready to be connected with`)
      } catch (e) {}

      // Call the callback function
      callback(result)

      // Skip the upcoming code
      return
    }

    // Make sure to remove all previous listeners to the result from the main thread
    IPCRenderer.removeAllListeners(`pty:test-connection:${requestID}`)

    // Call the update function telling that Cassandra isn't ready yet
    let message = `Cassandra is not ready yet, recheck again in ${TimeOut.retry/1000} seconds`

    pinnedToast.update(pinnedToastID, `++${message}.`)

    try {
      addLog(`${message}. Listen to port '${port}'`)
    } catch (e) {}

    // If the process is meant to be terminated then skip the upcoming code
    if (result.terminated)
      return

    /**
     * Call the function again in a recursive loop
     * Calling it after defined seconds is to give the main thread enough time to terminate the PTY instance and get rid of artifacts
     */
    setTimeout(() => checkCassandraInContainer(pinnedToastID, port, callback, timestamp, requestID, send), TimeOut.retry)
  })
}


/**
 * Check if a given docker/sandbox project is running/being terminated
 *
 * @Parameters:
 * {string} `folderName` the name of the container's folder - parent folder is `docker` by default -
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {boolean} whether or not the project is running
 */
let checkProjectIsRunning = (folderName, callback) => {
  // Get all running containers
  Terminal.run('docker ps -a', (err, data, stderr) => {
    // Initial result is `false`
    let isProjectRunning = false

    // Check if the project is running
    try {
      isProjectRunning = `${data}`.includes(`cassandra_${folderName}`)
    } catch (e) {}

    // Call the callback function
    callback(isProjectRunning)
  })
}

/**
 * Get ports (AxonOps agent and Apache Cassandra) from a docker-compose YAML file
 *
 * @Parameters:
 * {string} `folderName` the name of the container's folder - parent folder is `docker` by default -
 *
 * @Return: {object} AxonOps agent and Apache Cassandra ports in the passed YAML file
 */
let getPortsFromYAMLFile = async (folderName) => {
  // The final result which be returned
  let ports = {
    axonops: null,
    cassandra: null
  }

  try {
    // Read and load the passed YAML file
    let yamlConfig = YAML.load(await FS.readFileSync(Path.join(DockerContainersPath, folderName, 'docker-compose.yml')))

    /**
     * Extract ports
     * The AxonOps agent
     */
    try {
      ports.axonops = yamlConfig.services['axon-dash'].ports[0].split(':')[0]
    } catch (e) {}

    // Extract Apache Cassandra's port
    try {
      ports.cassandra = yamlConfig.services['cassandra-0'].ports[0].split(':')[0]
    } catch (e) {}
  } catch (e) {
    try {
      errorLog(e, 'local clusters')
    } catch (e) {}
  }

  // Add log about this process
  try {
    addLog(`Retrieve ports of AxonOps agent and Apache Cassandra in '${Path.join(DockerContainersPath, folderName, 'docker-compose.yml')}' file. Result is '${JSON.stringify(ports)}'`)
  } catch (e) {}

  // Return the final result
  return ports
}

/**
 * Get a Docker class instance by passing the project's UI element
 *
 * @Parameters:
 * {object} `connectionElement` the project/connection UI element
 *
 * @Return: {object} the Docker class instance
 */
let getDockerInstance = (connectionElement) => {
  // Get the project's folder name
  let folderName = typeof connectionElement === 'string' ? connectionElement : (getAttributes(connectionElement, 'data-folder') || getAttributes(connectionElement, 'data-id'))

  // Return a Docker class instance with passing the folder name
  return new DockerCompose(folderName)
}

/**
 * Return all saved docker projects
 *
 * @Return: {object} list of saved docker projects
 */
let getProjects = async () => {
  let projects = [] // Final object which be returned

  // Add log about this process
  try {
    addLog(`Retrieve saved local clusters`, 'process')
  } catch (e) {}

  try {
    // Get all workspaces
    let savedProjects = await FS.readFileSync(Path.join(DockerContainersPath, 'localclusters.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      savedProjects = JSON.parse(savedProjects)
    } catch (e) {
      savedProjects = []
    }

    // Update the returned object
    projects = savedProjects
  } catch (e) {
    try {
      errorLog(e, 'local clusters')
    } catch (e) {}
  } finally {
    // Return workspaces
    return projects
  }
}

/**
 * Save a passed docker project
 *
 * @Parameters:
 * {object} `project` the project's info and data to be saved
 *
 * @Return: {boolean} the saving process has succeeded or failed
 */
let saveProject = async (project) => {
  // Saving process status: [0: Not saved, 1: Saved]
  let status = 0

  // Add log about this process
  try {
    addLog(`Save a local cluster with info '${JSON.stringify(project)}'`, 'process')
  } catch (e) {}

  try {
    // Get all docker projects
    let projects = await FS.readFileSync(Path.join(DockerContainersPath, 'localclusters.json'), 'utf8')

    // Convert the JSON content from string to object
    try {
      projects = JSON.parse(projects)
    } catch (e) {
      projects = []
    }

    // Push project's info
    projects.push(project)

    // Update the `docker.json` file; by adding the new project
    await FS.writeFileSync(Path.join(DockerContainersPath, 'localclusters.json'), beautifyJSON(projects))

    // Successfully saved
    status = 1
  } catch (e) {
    try {
      errorLog(e, 'local clusters')
    } catch (e) {}
  } finally {
    // Return the saving process status
    return status
  }
}

/**
 * Delete a passed docker project
 *
 * @Parameters:
 * {string} `folderName` the name of the project's folder
 * {boolean} `?keepFiles` whether or not related files should be kept in the system
 *
 * @Return: {boolean} the deletion process has succeeded or failed
 */
let deleteProject = async (folderName, keepFiles = false) => {
  // Deletion process status: [false: Not deleted, true: Deleted]
  let status = false

  // Add log about this process
  try {
    addLog(`Delete local cluster in path '${Path.join(DockerContainersPath, folderName)}'`, 'process')
  } catch (e) {}

  try {
    // Remove the entire folder, recursively, with no exceptions
    if (!keepFiles)
      await FS.rmSync(Path.join(DockerContainersPath, folderName), {
        recursive: true,
        force: true
      })

    // Keep the workspace's folder, however, add a prefix `_DEL_` with random digits
    if (keepFiles)
      await FS.moveSync(Path.join(DockerContainersPath, folderName), `${Path.join(DockerContainersPath, folderName)}_DEL_${getRandom.id(5)}`, {
        overwrite: true
      })

    // Get all saved projects
    let projects = await FS.readFileSync(Path.join(DockerContainersPath, 'localclusters.json'), 'utf8')

    // Convert projects from JSON string to object
    try {
      projects = JSON.parse(projects)
    } catch (e) {
      projects = []
    }

    // Filter the saved projects and exclude the ones that wanted to be deleted
    projects = projects.filter((project) => project.folder != folderName)

    // Update the saved project's JSON file
    try {
      await FS.writeFileSync(Path.join(DockerContainersPath, 'localclusters.json'), beautifyJSON(projects), 'utf8')
    } catch (e) {
      try {
        errorLog(e, 'local clusters')
      } catch (e) {}
    }

    // The project has been successfully deleted
    status = true
  } catch (e) {
    try {
      errorLog(e, 'local clusters')
    } catch (e) {}
  } finally {
    // Return final status
    return status
  }
}

/**
 * Integrated function to simulate the `spawn` behavior instead of `exec`
 *
 * @Parameters:
 * {string} `command` the command's content to be executed
 * {string} `pinnedToastID` the toast ID which its content will be updated
 * {string} `process` determine the process' type, values are [start, stop]
 * {object} `callback` function to be called, parameters are (error, stdout, stderr)
 */
Terminal.spawn = (command, pinnedToastID, process, callback) => {
  /**
   * Define a temporary file name
   * This file will be updated with the command's output
   */
  let tempFileName = Path.join(OS.tmpdir(), `${getRandom.id(10)}.tmp`),
    // Set the process' start time
    startTime = new Date().getTime(),
    // Define an output watcher - will watch the temporary file changes
    outputWatcher,
    // Define the initial command's output
    commandOutput = ''

  // Inner function to watch the temporary file's changes
  let watchTempFile = () => {
    try {
      // Set a watching process
      outputWatcher = FS.watch(tempFileName, (eventType, _) => {
        try {
          // If the event type is not `change` in content then skip this try-catch block
          if (eventType != 'change')
            throw 0

          /**
           * Reaching here means the temporary file's content has been changed
           * Read the file's content
           */
          FS.readFile(tempFileName, (err, output) => {
            // If there's any error then skip the upcoming code
            if (err)
              return

            // Convert the output to a string
            output = output.toString()

            // Strip all HTML tags from the output
            output = StripTags(output)

            // Replace the break line character `\n` with HTML break line `<br>`
            output = output.replace(/\n/g, '<br>')

            // Wrap the output inside a `code` element
            commandOutput = `<code>${output}</code>`

            // Update the associated pinned toast's body content
            if (pinnedToastID != undefined)
              pinnedToast.update(pinnedToastID, commandOutput)
          })
        } catch (e) {}
      })
    } catch (e) {}
  }

  // Inner function to check - and watch - whether or not the temporary file has been created
  let checkFileCreated = () => {
    setTimeout(() => {
      // Get this checking/watching process' starting time
      let currentTime = new Date().getTime(),
        // Determine if the watching process overall has exceeded 1 minute
        isTimeExceeded = (currentTime - startTime) > 60000

      // Check the temporary file's existence
      FS.exists(tempFileName, (exists) => {
        // If the file does not exist and the process hasn't exceeded 1 minute then keep the process alive
        if (!exists && !isTimeExceeded)
          checkFileCreated()

        // If the process has exceeded 1 minute then end it
        if (isTimeExceeded)
          return

        // The file has been created and its content is ready to be watched
        watchTempFile()
      })
    }, 500)
  }

  // Call the file's existence watcher
  checkFileCreated()

  // Update the passed command by dumping its output to the temporary file
  command = `${command} > ${tempFileName} 2>&1`

  // Execute the manipulated command
  Terminal.run(command, (error, stdout, stderr) => {
    // Once the execution finish
    FS.readFile(tempFileName, 'utf8', (_, content) => {
      try {
        // The process is `start` a docker project, thus the app needs to tell the user about the next sub-process
        if (process == 'start' && !error && !stderr) {
          pinnedToast.update(pinnedToastID, '++Waiting for Cassandra to be up and ready.')

          // Skip the upcoming code in the try-catch block
          throw 0
        }

        // The process is `stop` a docker project thus there's no need to keep the pinned toast
        pinnedToast.update(pinnedToastID, true, true)
      } catch (e) {}

      // Delete the temporary file
      try {
        setTimeout(() => FS.unlinkSync(tempFileName))
      } catch (e) {}

      // Close the temporary file's watcher
      setTimeout(() => {
        if (outputWatcher == null)
          return

        outputWatcher.close()
      })

      // Call the callback function
      callback(error, content, stderr)
    })
  })
}


/**
 * Manipulate the original `run` function if the platform is macOS
 * The manipulation is bascilly update the `PATH` variable and adds as much paths as possible - where executables and binaries commonly located
 */
{
  // Copy the original `nod-cmd` module
  let originalObject = {
    ...Terminal
  }

  // Override the original `run` function
  Terminal.run = (...args) => {
    Modules.Config.getConfig((config) => {
      let extraPaths = {
          podman: '',
          docker: ''
        },
        defaultPaths = {
          win32: {
            podman: '%PATH%;C:\\Program Files\\Podman;C:\\Program Files (x86)\\Podman;C:\\ProgramData\\Podman;C:\\Users\\%USERNAME%\\AppData\\Local\\Podman;C:\\Users\\%USERNAME%\\AppData\\Roaming\\Podman;C:\\Podman',
            docker: '%PATH%;C:\\Program Files\\Docker;C:\\Program Files (x86)\\Docker;C:\\ProgramData\\Docker;C:\\Users\\%USERNAME%\\AppData\\Local\\Docker;C:\\Users\\%USERNAME%\\AppData\\Roaming\\Docker;C:\\Docker'
          },
          darwin: {
            podman: '$PATH:/bin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/opt/homebrew/sbin:/opt/podman/bin:/opt/local/bin:/opt/bin:/usr/local/sbin:/usr/sbin:~/.rd/bin:~/homebrew/bin',
            docker: '$PATH:/usr/local/bin:/usr/bin:/opt/homebrew/bin:/opt/docker/bin:/opt/local/bin:/opt/bin:/usr/local/sbin:/usr/sbin'
          },
          linux: {
            podman: '$PATH:/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin:/opt/bin:/opt/podman/bin:/usr/local/sbin:/usr/local/lib/podman:/var/lib/podman',
            docker: '$PATH:/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin:/opt/bin:/opt/docker/bin:/usr/local/sbin:/usr/local/lib/docker:/var/lib/docker'
          }
        },
        finalExtraPath = '',
        containersManagementTool = config.get('features', 'containersManagementTool') || 'none'

      for (let tool of Object.keys(extraPaths)) {
        try {
          extraPaths[tool] = config.get('containersManagementToolsPaths', tool)

          extraPaths[tool] = extraPaths[tool].split('|').map((path) => path.length != 0 ? `"${path}"` : '').join(OS.platform() == 'win32' ? ';' : ':')
        } catch (e) {}
      }

      try {
        finalExtraPath = [...Object.keys(extraPaths)].map((tool) => {
          let path = `${extraPaths[tool]}`

          return path.length != 0 ? `${path}${OS.platform() == 'win32' ? ';' : ':'}` : ''
        }).join('')
      } catch (e) {}

      let finalDefaultPath = ''

      try {
        finalDefaultPath = defaultPaths[OS.platform()][containersManagementTool] || ''
      } catch (e) {}

      let pathVariableValue = `${finalExtraPath}${finalDefaultPath}`,
        exportCommand = `${OS.platform() == 'win32' ? 'set' : 'export'} PATH=${pathVariableValue}`

      if (!exportCommand.endsWith('PATH=') && pathVariableValue != 'undefined')
        args[0] = `${OS.platform() == 'win32' ? 'set' : 'export'} PATH=${finalExtraPath}${finalDefaultPath} && ${args[0]}`

      // Call the original function with passing the manipulated arguments
      originalObject.run(...args)
    })
  }
}

module.exports = {
  DockerCompose,
  checkDockerCompose,
  checkCassandraInContainer,
  checkProjectIsRunning,
  getPortsFromYAMLFile,
  getDockerInstance,
  getDockerComposeBinary,
  getProjects,
  saveProject,
  deleteProject
}
