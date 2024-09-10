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

{
  /**
   * Get and refresh all clusters events
   *
   * `getClusters` will remove all clusters in the UI and fetch them all over again from the workspace folder
   * `refreshClusters` will keep the current clusters in the UI, and just add clusters that are not in the UI already
   */
  $(document).on('getClusters refreshClusters', function(e, workspaceID) {
    // To determine if the event is `getClusters` or `refreshClusters`
    const event = e.type,
      // Point at the element of the associated workspace element in the UI
      workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`),
      // Point at the parent of all clusters container
      parentClusterContainer = $(`div.body div.right div.content div[content="clusters"]`),
      // Point at the cluster's container
      clustersContainer = parentClusterContainer.children(`div.clusters-container`).children(`div.clusters[workspace-id="${workspaceID}"]`)

    // Determine if the associated workspace is the docker/sandbox projects
    let isSandbox = workspaceID == 'workspace-sandbox',
      // Set the suitable function to get clusters/projects based on the type of the workspace
      moduleGetFunction = !isSandbox ? Modules.Clusters.getClusters : Modules.Docker.getProjects

    // Get all clusters/projects saved in the workspace
    moduleGetFunction(workspaceID).then((clusters) => {
      // Clean the container if the event is `get` clusters
      if (event == 'getClusters')
        clustersContainer.html('')

      // Add or remove the `empty` class based on the number of saved clusters
      let areNoClusters = clusters.length <= 0

      // Toggle the `empty` class
      setTimeout(() => parentClusterContainer.toggleClass('empty', areNoClusters), areNoClusters ? 200 : 10)

      handleContentInfo('clusters', workspaceElement)

      // Point at the cog actions button in the UI
      let clusterActions = parentClusterContainer.find('div.section-actions')

      // If sub-buttons of the cog actions are shown then hide them
      if (clusterActions.hasClass('show'))
        clusterActions.children('div.main').children('button').click()

      // Loop through all fetched clusters
      clusters.forEach((cluster, currentIndex) => {
        try {
          // If the current workspace is not the docker/sandbox then skip this try-catch block
          if (!isSandbox)
            throw 0

          /**
           * Set different attributes for the current cluster's object
           * By doing this, resusing and adopting the the same code of clusters for the sandbox projects is possible without the need to do heavy edits and changes
           */
          cluster.info = {}
          cluster.info.id = cluster.folder
          cluster.info.secrets = undefined
          cluster.name = cluster.name || cluster.folder
          cluster.host = `127.0.0.1:${cluster.ports.cassandra}`
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        // Define the cluster's ID
        let clusterID = cluster.info.id,
          // Get random IDs for the different elements of the cluster's UI element
          [
            testConnectionBtnID,
            connectBtnID,
            terminateProcessBtnID,
            startProjectBtnID,
            folderBtnID,
            settingsBtnID,
            deleteBtnID
          ] = getRandomID(15, 7),
          /**
           * Define the variable which holds the ID for the connection test process of the cluster
           * The value will be updated with every test connection process
           */
          testConnectionProcessID,
          /**
           * Define the variable which holds the latest generated ID for the SSH tunnel creation process
           * The value will be updated with every test connection process
           */
          sshTunnelCreationRequestID,
          // For Docker/Sandbox projects set the process ID of checking Cassandra®
          checkCassandraProcessID,
          /**
           * The AxonOps™ section ID
           * It's defined here as it's being used in different parts of the event
           */
          axonopsContentID = getRandomID(15),
          // Flag to tell if this cluster is going to be added/appended to the UI as a new element or if it already exists, by default it's `true`
          isAppendAllowed = true,
          // Flag to tell if an SSH tunnel is needed before connecting with Cassandra® cluster/node
          isSSHTunnelNeeded = false

        /**
         * Look for the cluster in the UI
         * If it exists then no need to append it
         */
        if (event == 'refreshClusters')
          isAppendAllowed = $(`div.cluster[data-id="${clusterID}"][data-workspace-id="${workspaceID}"]`).length != 0 ? false : isAppendAllowed

        // This variable will hold the username and password of DB and SSH in UI attributes if needed
        let secrets = ''

        try {
          // If the current cluster doesn't have secrets - `username` and `password` for Apache Cassandra®, and SSH `username` and `password` - then skip this try-catch block
          if (cluster.info.secrets == undefined)
            throw 0

          // Shorten the secrets reference
          let secretsInfo = cluster.info.secrets

          // Check the DB authentication's username
          secrets += secretsInfo.username != undefined ? `data-username="${secretsInfo.username}" ` : ''

          // Check the DB authentication's password
          secrets += secretsInfo.password != undefined ? `data-password="${secretsInfo.password}" ` : ''

          // Check the SSH username
          secrets += secretsInfo.sshUsername != undefined ? `data-ssh-username="${secretsInfo.sshUsername}" ` : ''

          // Check the SSH password
          secrets += secretsInfo.sshPassword != undefined ? `data-ssh-password="${secretsInfo.sshPassword}" ` : ''

          // Check the SSH passphrase
          secrets += secretsInfo.sshPassphrase != undefined ? `data-ssh-passphrase="${secretsInfo.sshPassphrase}" ` : ''
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        // This variable will hold the requirement of DB auth and SSH credentials in UI attributes if needed
        let credentials = ''

        try {
          // If the current cluster doesn't have any credentials to be given then skip this try-catch block
          if (cluster.info.credentials == undefined)
            throw 0

          // Check the DB authentication credentials
          credentials += cluster.info.credentials.auth != undefined ? ` data-credentials-auth="true"` : ''

          // Check the SSH credentials
          credentials += cluster.info.credentials.ssh != undefined ? ` data-credentials-ssh="true"` : ''
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }

        /**
         * Define the footer of the cluster's UI based on the workspace's type
         * It can be a cluster or a docker/sandbox project
         */
        let footerStructure = {
          nonSandbox: `
          <div class="footer">
            <div class="button">
              <button type="button" class="btn btn-secondary btn-dark btn-sm test-connection" reference-id="${clusterID}" button-id="${testConnectionBtnID}">
                <span mulang="test connection"></span>
              </button>
              <button type="button" class="btn btn-primary btn-dark btn-sm connect changed-bg changed-color" reference-id="${clusterID}" button-id="${connectBtnID}" disabled>
                <span mulang="connect"></span>
              </button>
            </div>
            <div class="actions">
              <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${clusterID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Open the connection folder"
                data-mulang="open the connection folder" capitalize-first>
                <ion-icon name="folder-open"></ion-icon>
              </div>
              <div class="action btn btn-tertiary" reference-id="${clusterID}" button-id="${settingsBtnID}" data-mdb-ripple-color="dark" action="settings" data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="connection settings" capitalize-first
                data-title="Connection settings">
                <ion-icon name="cog"></ion-icon>
              </div>
              <div class="action btn btn-tertiary" reference-id="${clusterID}" button-id="${deleteBtnID}" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Delete connection" data-mulang="delete connection"
                capitalize-first>
                <ion-icon name="trash"></ion-icon>
              </div>
            </div>
          </div>`,
          sandbox: `
          <div class="footer">
            <div class="button">
              <button type="button" class="btn btn-primary btn-dark btn-sm changed-bg changed-color" reference-id="${clusterID}" button-id="${startProjectBtnID}">
                <span mulang="start"></span>
              </button>
              <button type="button" class="btn btn-primary btn-dark btn-sm connect changed-bg changed-color" reference-id="${clusterID}" button-id="${connectBtnID}" hidden></button>
            </div>
            <div class="actions">
              <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${clusterID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Open the local cluster folder"
                data-mulang="open the local cluster folder" capitalize-first>
                <ion-icon name="folder-open"></ion-icon>
              </div>
              <div class="action btn btn-tertiary" reference-id="${clusterID}" button-id="${deleteBtnID}" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Delete local cluster"
                data-mulang="delete local cluster" capitalize-first>
                <ion-icon name="trash"></ion-icon>
              </div>
            </div>
          </div>`
        }

        /**
         * For docker/sandbox projects, an additional info is added `number of nodes`
         * By default, it's empty
         */
        let numOfNodesInfo = '',
          isAxonOpsInstalled = ''

        try {
          // If the current cluster is not a docker/sandbox project then skip this try-catch block
          if (!isSandbox)
            throw 0

          // The number of chosen nodes' info UI structure
          numOfNodesInfo = `
          <div class="info" info="nodes">
            <div class="title"><span mulang="nodes" capitalize></span>
              <ion-icon name="right-arrow-filled"></ion-icon>
            </div>
            <div class="text">${cluster.nodes}</div>
            <div class="_placeholder" hidden></div>
          </div>`

          isAxonOpsInstalled = `
          <div class="info" info="axonops">
            <div class="title">AxonOps™</span>
              <ion-icon name="right-arrow-filled"></ion-icon>
            </div>
            <div class="text"><ion-icon class="axonops-status ${cluster.axonops}" name="${cluster.axonops == true ? 'check' : 'close'}"></ion-icon></div>
            <div class="_placeholder" hidden></div>
          </div>`
        } catch (e) {}

        // Cluster UI element structure
        let element = `
            <div class="cluster" data-name="${cluster.name}" data-folder="${cluster.folder}" data-id="${clusterID}" data-workspace-id="${workspaceID}" data-host="${cluster.host}" data-datacenter="${cluster.info.datacenter}" data-connected="false" data-is-sandbox="${isSandbox}" data-axonops-installed="${cluster.axonops || 'unknown'}" data-workarea="false" ${secrets} ${credentials}>
              <div class="header">
                <div class="title cluster-name">${cluster.name}</div>
                <div class="cluster-info">
                  <div class="info" info="host">
                    <div class="title"><span mulang="host" capitalize></span>
                      <ion-icon name="right-arrow-filled"></ion-icon>
                    </div>
                    <div class="text">${cluster.host}</div>
                    <div class="_placeholder" hidden></div>
                  </div>
                  <div class="info" info="cassandra">
                    <div class="title">cassandra
                      <ion-icon name="right-arrow-filled"></ion-icon>
                    </div>
                    <div class="text">${isSandbox ? 'v' + cluster.cassandraVersion : ''}</div>
                    <div class="_placeholder" ${isSandbox ? 'hidden' : '' }></div>
                  </div>
                  <div class="info" info="data-center" ${isSandbox ? 'hidden' : ''}>
                    <div class="title"><span mulang="data center" capitalize></span>
                      <ion-icon name="right-arrow-filled"></ion-icon>
                    </div>
                    <div class="text">${isSandbox ? 'datacenter1' : ''}</div>
                    <div class="_placeholder" ${isSandbox ? 'hidden' : '' }></div>
                  </div>
                  ${numOfNodesInfo}
                  ${isAxonOpsInstalled}
                </div>
              </div>
              ${!isSandbox ? footerStructure.nonSandbox : footerStructure.sandbox}
              <div class="status">
                <lottie-player src="../assets/lottie/connection-status.json" background="transparent" autoplay loop speed="0.5"></lottie-player>
              </div>
              <div class="test-connection">
                <div class="sub-content">
                  <l-pinwheel class="ldr change-color" size="60" stroke="4" speed="0.6" color="${getAttributes(workspaceElement, 'data-color')}"></l-pinwheel>
                </div>
                <div class="terminate-process">
                  <div class="btn btn-tertiary stop-btn" data-mdb-ripple-color="var(--mdb-danger)" reference-id="${clusterID}" button-id="${terminateProcessBtnID}" data-tippy="tooltip" data-mdb-placement="right" data-title="Terminate the process" data-mulang="terminate the process"
                    capitalize-first>
                    <ion-icon name="close"></ion-icon>
                  </div>
                </div>
              </div>
            </div>`

        try {
          // If the current cluster won't be appended then skip this try-catch block
          if (!isAppendAllowed)
            throw 0

          // Append the cluster to the associated container
          clustersContainer.append($(element).show(function() {
            // Apply different actions once the UI element is created
            {
              // Fade in the element based on the index
              setTimeout(() => $(this).addClass(`show-${currentIndex + 1}`))

              // Enable tooltip for the actions buttons
              setTimeout(() => ([settingsBtnID, deleteBtnID, folderBtnID]).forEach((btn) => getElementMDBObject($(`div[button-id="${btn}"]`), 'Tooltip')))

              // Apply the chosen language on the UI element after being fully loaded
              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
            }

            // Point at the cluster's UI element
            let clusterElement = $(this)

            // Handle the `click` event for actions buttons
            setTimeout(() => {
              // Clicks the `TEST CONNECTION` button
              $(`button[button-id="${testConnectionBtnID}"]`).click(function() {
                // Determine if the app is already connected with that cluster, and if it has an active work area
                let [connected, hasWorkarea] = getAttributes(clusterElement, ['data-connected', 'data-workarea']),
                  // Whether or not the current process to be executed is disconnecting with the cluster
                  isProcessDisconnect = $(this).find('span[mulang]').attr('mulang') == 'disconnect'

                // Get a random ID for this connection test process
                testConnectionProcessID = getRandomID(30)

                // Get a random ID for the SSH tunnel creation process
                sshTunnelCreationRequestID = getRandomID(30)

                // Set the flag's value
                isSSHTunnelNeeded = clusterElement.getAllAttributes('data-ssh')

                // Add log for this request
                try {
                  addLog(`Request to test the connection '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                } catch (e) {}

                // If the cluster has an active work area and the process to be executed is not disconnecting with the cluster then stop the process and show feedback to the user
                if (hasWorkarea == 'true' && !isProcessDisconnect)
                  return showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to test it', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                // Handle if the process is disconnecting with the cluster
                if (isProcessDisconnect)
                  return $(`div.body div.right div.content div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`).find('div.cluster-actions div.action[action="close"]').find('div.btn').trigger('click', false)

                // Check if the cluster needs credentials to be provided before test the connection with it
                try {
                  // Get attributes related to credentials requirements
                  let [credentialsAuth, credentialsSSH] = getAttributes(clusterElement, ['data-credentials-auth', 'data-credentials-ssh']),
                    // Point at the credentials dialog
                    clusterCredentialsDialog = $('div.modal#clusterCredentials')

                  // If both attributes are not defined or the user already has provided required credentials then skip this try-catch block
                  if (([credentialsAuth, credentialsSSH]).every((credential) => credential == undefined) || getAttributes(clusterElement, 'data-got-credentials') == 'true') {
                    clusterElement.removeAttr('data-got-credentials')
                    throw 0
                  }

                  // By default, the credentials requirements process hasn't been passed yet
                  let pass = false,
                    // Get all attributes that hold the values of different secrets/credentials
                    allSecrets = getAttributes(clusterElement, ['data-username', 'data-password', 'data-ssh-username', 'data-ssh-password', 'data-ssh-passphrase'])

                  /**
                   * Multiple conditions to check
                   * DB authentication credentials are needed - and SSH credentials not -, and they've been provided
                   * SSH credentials are needed - and DB authentication credentials not -, and they've been provided
                   * Both types of credentials are needed and all of them have been provided
                   */
                  if (
                    (credentialsAuth != undefined && credentialsSSH == undefined && allSecrets[0] != undefined && allSecrets[1] != undefined) ||
                    (credentialsAuth == undefined && credentialsSSH != undefined && (allSecrets[2] != undefined || allSecrets[3] != undefined)) ||
                    (credentialsAuth != undefined && credentialsSSH != undefined && allSecrets.every((secret) => secret != undefined))
                  )
                    pass = true

                  // If there's a need to pass the credentials then skip the upcoming code
                  if (pass)
                    throw 0

                  // Determine if both credentials - DB and SSH - are needed
                  let bothcredentials = ([credentialsAuth, credentialsSSH]).every((credential) => credential != undefined)

                  try {
                    // If both credentials are needed then skip this `try` and jump to `catch` block
                    if (bothcredentials)
                      throw 0

                    // Add `one-only` class and either one of the two classes `ssh` and `auth`
                    clusterCredentialsDialog.addClass(`one-only ${credentialsAuth == undefined ? 'ssh' : 'auth'}`)
                  } catch (e) {
                    // Both credentials are needed so remove all class related to the need of one of them only
                    clusterCredentialsDialog.removeClass(`one-only ssh auth`)
                  }

                  // Update the credentials title by adding the cluster's name
                  clusterCredentialsDialog.find('h5.modal-title cluster-name').text(getAttributes(clusterElement, 'data-name'))

                  // Update the credentials title by adding the type of credentials if only one of them needed
                  clusterCredentialsDialog.find('h5.modal-title credentials-info').text(!bothcredentials ? (credentialsAuth != undefined ? 'DB ' + I18next.capitalize(I18next.t('authentication')) : 'SSH') : '')

                  // Update the credentials' dialog attributes by adding one which holds the cluster's ID
                  clusterCredentialsDialog.attr('data-cluster-id', clusterID)

                  // Show the credentials' dialog
                  $('button#showClusterCredentialsDialog').click()

                  // Skip the upcoming code
                  return
                } catch (e) {}

                // Disable the `CONNECT` button
                $(`button[button-id="${connectBtnID}"]`).attr('disabled', '')

                try {
                  // If the app is not already connected with the cluster then skip this try-catch block
                  if (connected != 'true')
                    throw 0

                  // Hide the Cassandra®'s version and the data center's name
                  clusterElement.find('div[info="cassandra"], div[info="data-center"]').each(function() {
                    $(this).children('div.text').text('')
                    $(this).children('div._placeholder').fadeIn('fast').removeAttr('hidden')
                  })

                  // Remove the connection status
                  clusterElement.attr('data-connected', 'false')

                  // Attempt to close SSH tunnel if it exists
                  try {
                    IPCRenderer.send('ssh-tunnel:close', clusterID)
                  } catch (e) {}
                } catch (e) {}

                // Reset the status of the connection with the cluster
                clusterElement.children('div.status')
                  .removeClass('success failure')
                  .addClass('show')

                // The app is now testing the connection with the cluster
                clusterElement.addClass('test-connection')

                // Enable the process termination button
                $(`div.btn[button-id="${terminateProcessBtnID}"]`).removeClass('disabled')

                // Show the termination process' button
                setTimeout(() => clusterElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                // Disable the button
                $(this).attr('disabled', 'disabled')

                // Test the connection with the cluster; by calling the inner test connection function at the very end of this code block
                testConnection(clusterElement, testConnectionProcessID, sshTunnelCreationRequestID)
              })

              /**
               * Clicks the `CONNECT` button
               *
               * This block of code has a lot of things; many inner functions, a bunch of events listeners, and elements creation
               * This event - click - listener takes two parameters:
               * First is `restart`; it tells if this is a work area `refresh` or a `fresh creation` process
               * Second is `instant`; if it's `true` then some transitions will not be applied
               *
               */
              $(`button[button-id="${connectBtnID}"]`).on('click', function(_, restart = false, instant = false) {
                // Get the app's config
                Modules.Config.getConfig((config) => {
                  // Get the maximum allowed number of running clusters at a time
                  let maximumRunningClusters = parseInt(config.get('limit', 'cqlsh')),
                    // Get the number of currently running clusters
                    numRunningClusters = $(`div[content="workarea"] div.workarea[cluster-id*="cluster-"]`).length,
                    // Get the number of currently attempt to activate connections
                    numAttemptingClusters = $(`div[content="clusters"] div.clusters-container div.cluster[data-id*="cluster-"].test-connection`).length

                  // Make sure the maximum number is valid, or adopt the default value `10`
                  maximumRunningClusters = isNaN(maximumRunningClusters) || maximumRunningClusters < 1 ? 10 : maximumRunningClusters

                  // Add log for this request
                  try {
                    addLog(`Request to connect '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                  } catch (e) {}

                  // If the currently running clusters are more than or equal to the maximum allowed number and this is not the sandbox workspace then end the process and show feedback to the user
                  if (([numRunningClusters, numAttemptingClusters]).some((num) => num >= maximumRunningClusters) && !isSandbox)
                    return showToast(I18next.capitalize(I18next.t('activate connection')), I18next.capitalizeFirstLetter(I18next.replaceData('the maximum number of connectinos which allowed to be active simultaneously is [b]$data[/b]', [maximumRunningClusters])) + `.<br><br>` + I18next.capitalizeFirstLetter(I18next.t('this limit can be changed from the app\'s settings in the limits section')) + `.`, 'failure')

                  // Point at the work areas content's container
                  let content = $('div.body div.right div.content div[content="workarea"]'),
                    // If this variable is `true` then show the cluster's work area and skip the creation of a new one
                    skipCreationWorkarea = false

                  // Hide all work areas
                  content.children('div.workarea').hide()

                  // Point at the cluster's work area
                  let contentCluster = content.children(`div.workarea[cluster-id="${clusterID}"]`)

                  $('div.body div.right').addClass('hide-content-info')

                  try {
                    // If the work area does not exist then skip this try-catch block
                    if (contentCluster.length <= 0)
                      throw 0

                    // Skip the creation part and show the work area
                    skipCreationWorkarea = true

                    // Show the work area
                    contentCluster.show()

                    // Deactivate all switchers and activate the current cluster's switcher
                    setTimeout(() => $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active').filter(`[_cluster-id="${clusterID}"]`).attr('active', ''), 50)

                    try {
                      // Point at the target cluster's switcher
                      let targetCluster = $(`div.switch-clusters div.cluster[_cluster-id="${clusterID}"]`)

                      // If the switcher of the cluster is visible then skip this try-catch block
                      if (targetCluster.is(':visible'))
                        throw 0

                      // Make sure to reposition the switchers by making the current cluster's switcher the first active one
                      targetCluster.insertAfter($(`div.switch-clusters div.`))
                      targetCluster.show()
                      $(`div.switch-clusters div.cluster`).filter(':visible').last().hide()

                      // Handle the margin of the first cluster
                      setTimeout(() => handleClusterSwitcherMargin())
                    } catch (e) {}

                    try {
                      // If the current shown work area is the cluster's one then skip this try-catch block
                      if (!content.is(':visible'))
                        throw 0

                      // Update active cluster's ID
                      activeClusterID = clusterID

                      // Skip the upcoming code
                      return
                    } catch (e) {}
                  } catch (e) {}

                  // Handle when connection is lost with the cluster
                  try {
                    // If the work area exists or this is the sandbox/project workspace then skip this try-catch block
                    if (contentCluster.length > 0 || isSandbox)
                      throw 0

                    // If the `data-connected` attribute is anything rather than `false` then skip this try-catch block
                    if (getAttributes(clusterElement, 'data-connected') != 'false')
                      throw 0

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('unable to create workarea')), I18next.capitalizeFirstLetter(I18next.replaceData('connection [b]$data[/b] seems not pre-established or has been lost. please attempt to test that connection', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                    // Skip the upcoming code
                    return
                  } catch (e) {}

                  try {
                    // If the `restart` flag is `true` then skip this try-catch block
                    if (restart)
                      throw 0

                    // Update active cluster's ID
                    activeClusterID = clusterID

                    // Fade out all content except the work area
                    $('div.body div.right div.content div[content]:not([content="workarea"])').fadeOut(200)

                    // Fade in the work area content container
                    setTimeout(() => content.removeAttr('hidden').hide().fadeIn(200), 150)
                  } catch (e) {}

                  // If no need to create a work area then skip the upcoming code
                  if (skipCreationWorkarea)
                    return

                  // Get random IDs for different elements in the cluster's work area
                  let [
                    // The cluster's metadata functions, and their related elements
                    copyMetadataBtnID,
                    refreshMetadataBtnID,
                    searchInMetadataBtnID,
                    // CQLSH and Bash sessions, and their related elements
                    cqlshSessionContentID,
                    cqlshSessionSearchInputID,
                    cqlshSessionStatementInputID,
                    bashSessionContentID,
                    terminalContainerID,
                    terminalBashContainerID,
                    // CQL description
                    cqlDescriptionContentID,
                    cqlDescriptionSearchInputID,
                    // Query tracing
                    queryTracingContentID,
                    queryTracingSearchInputID,
                    // Cluster's metadata differentiation
                    metadataContentID,
                    metadataDifferentiationContentID,
                    refreshDifferentiationBtnID,
                    showDifferentiationBtnID,
                    diffNavigationPrevBtnID,
                    diffNavigationNextBtnID,
                    saveSnapshotBtnID,
                    loadSnapshotBtnID,
                    openSnapshotsFolderBtnID,
                    changeViewBtnID,
                    saveSnapshotSuffixContainerID,
                    changesLinesContainerID,
                    oldSnapshotNameID,
                    newMetadataTimeID,
                    // Set a work area ID as a reference to check its existance
                    workareaID,
                    // Restart and close the work area
                    restartWorkareaBtnID,
                    closeWorkareaBtnID
                  ] = getRandomID(20, 30)

                  /**
                   * Define tabs that shown only to sandbox projects
                   *
                   * Define the AxonOps™ tab's content, by default it's empty
                   */
                  let axonopsTab = '',
                    // Define the Bash Session tab's content, as AxonOps™, it's empty by default
                    bashSessionTab = ''

                  try {
                    // If the current workspace is not the sandbox then skip this try-catch block
                    if (!isSandbox)
                      throw 0

                    // Define the content of the AxonOps™ tab to be added
                    if (getAttributes(clusterElement, 'data-axonops-installed') === 'true') {
                      axonopsTab = `
                      <li class="nav-item axonops-tab" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="AxonOps™" capitalize data-title="AxonOps™">
                        <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${axonopsContentID}" role="tab" aria-selected="true">
                          <span class="icon"><ion-icon name="axonops"></ion-icon></span>
                          <span class="title">AxonOps™</span>
                        </a>
                      </li>`
                    }

                    // Define the content of the bash session tab to be added
                    bashSessionTab = `
                    <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="bash session" capitalize data-title="Bash Session">
                      <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${bashSessionContentID}" role="tab" aria-selected="true">
                        <span class="icon">
                          <ion-icon name="bash"></ion-icon>
                        </span>
                        <span class="title">
                          <span mulang="bash session" capitalize></span>
                        </span>
                      </a>
                    </li>`
                  } catch (e) {}

                  // Cluster work area's UI element structure
                  let element = `
                      <div class="workarea" cluster-id="${clusterID}" workarea-id="${workareaID}">
                        <div class="sub-sides left">
                          <div class="cluster-info">
                            <div class="name-ssl ${isSandbox ? 'is-sandbox' : ''}">
                              <div class="name no-select-reverse">${getAttributes(clusterElement, 'data-name')}</div>
                              <div class="status" data-tippy="tooltip" data-mdb-placement="left" data-mulang="analyzing status" capitalize-first data-title="Analyzing status">
                                <ion-icon name="unknown"></ion-icon>
                              </div>
                              <div class="axonops-agent" data-tippy="tooltip" data-mdb-placement="left" data-mulang="open AxonOps™ in browser" capitalize-first data-title="Open AxonOps™ in browser" ${getAttributes(clusterElement, 'data-axonops-installed') !== 'true' ? 'hidden' : ''}>
                                <ion-icon name="globe"></ion-icon>
                              </div>
                              <div class="connection-status">
                                <lottie-player src="../assets/lottie/connection-status.json" background="transparent" autoplay loop speed="0.25"></lottie-player>
                              </div>
                            </div>
                            <div class="additional">
                              <div class="info" info="host">
                                <div class="title">host
                                  <ion-icon name="right-arrow-filled"></ion-icon>
                                </div>
                                <div class="text no-select-reverse">${getAttributes(clusterElement, 'data-host')}</div>
                              </div>
                              <div class="info" info="cassandra">
                                <div class="title">cassandra
                                  <ion-icon name="right-arrow-filled"></ion-icon>
                                </div>
                                <div class="text no-select-reverse">v${getAttributes(clusterElement, 'data-cassandra-version')}</div>
                              </div>
                              <div class="info" info="data-center">
                                <div class="title">data center
                                  <ion-icon name="right-arrow-filled"></ion-icon>
                                </div>
                                <div class="text no-select-reverse">${getAttributes(clusterElement, 'data-datacenter')}</div>
                              </div>
                            </div>
                          </div>
                          <div class="cluster-metadata loading">
                            <div class="search-in-metadata">
                              <div class="form-outline form-white margin-bottom">
                                <input type="text" class="form-control form-icon-trailing form-control-sm">
                                <label class="form-label">
                                  <span mulang="search in metadata" capitalize-first></span>
                                </label>
                                <div class="right-elements">
                                  <div class="result-count">
                                    <span class="current"></span>/<span class="total"></span>
                                  </div>
                                  <div class="arrows">
                                    <div class="next btn btn-tertiary" data-mdb-ripple-color="light">
                                      <ion-icon name="arrow-down"></ion-icon>
                                    </div>
                                    <div class="previous btn btn-tertiary" data-mdb-ripple-color="light">
                                      <ion-icon name="arrow-up"></ion-icon>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div class="metadata-content" data-id="${metadataContentID}">
                            </div>
                            <div class="loading">
                              <div class="sub-content">
                                <lottie-player src="../assets/lottie/loading-metadata.json" background="transparent" autoplay loop speed="1.15"></lottie-player>
                              </div>
                            </div>
                            <div class="metadata-actions">
                              <div class="action" action="copy">
                                <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Copy metadata" data-mulang="copy metadata" capitalize-first data-id="${copyMetadataBtnID}">
                                  <ion-icon name="copy"></ion-icon>
                                </div>
                              </div>
                              <div class="action" action="refresh">
                                <div class="btn btn-tertiary disableable" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Refresh metadata" data-mulang="refresh metadata" capitalize-first data-id="${refreshMetadataBtnID}">
                                  <ion-icon name="refresh"></ion-icon>
                                </div>
                              </div>
                              <div class="action" action="search">
                                <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Search in metadata" data-mulang="search in metadata" capitalize-first data-id="${searchInMetadataBtnID}">
                                  <ion-icon name="search" style="font-size: 135%;"></ion-icon>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="sub-sides right">
                          <div class="header">
                            <div class="cluster-tabs">
                              <ul class="nav nav-tabs nav-justified mb-3" id="ex-with-icons" role="tablist">
                                <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="CQLSH session" capitalize data-title="CQLSH Session">
                                  <a class="nav-link btn btn-tertiary active" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${cqlshSessionContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="terminal"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="CQLSH session" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                ${bashSessionTab}
                                <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="CQL description" capitalize data-title="CQL Description">
                                  <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${cqlDescriptionContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="cql-description"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="CQL description" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="query tracing" capitalize data-title="Query Tracing">
                                  <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${queryTracingContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="query-tracing"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="query tracing" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="schema diff" capitalize data-title="Schema Diff">
                                  <a class="nav-link btn btn-tertiary disabled" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${metadataDifferentiationContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="differentiation"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="schema diff" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                ${axonopsTab}
                              </ul>
                            </div>
                            <div class="cluster-actions colored-box-shadow" style="width:40px">
                              <div class="action" action="restart" hidden>
                                <div class="btn-container">
                                  <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Restart the work area" data-mulang="restart the work area" capitalize-first data-id="${restartWorkareaBtnID}">
                                    <ion-icon name="restart"></ion-icon>
                                  </div>
                                </div>
                              </div>
                              <div class="action" action="close">
                                <div class="btn-container">
                                  <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Close the work area" data-mulang="close the work area" capitalize-first data-id="${closeWorkareaBtnID}">
                                    <ion-icon name="close"></ion-icon>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="tab-content">
                            <div class="tab-pane fade show active loading" tab="cqlsh-session" id="_${cqlshSessionContentID}" role="tabpanel">
                              <div class="switch-terminal">
                                <button type="button" class="btn btn-primary btn-dark changed-bg changed-color" disabled>
                                  <ion-icon name="switch"></ion-icon>
                                  <span mulang="switch terminal"></span>
                                </button>
                              </div>
                              <div class="terminal-container" data-id="${terminalContainerID}" style="display:none;"></div>
                              <div class="interactive-terminal-container" data-id="${terminalContainerID}_interactive">
                                <div class="container-header">
                                  <div class="form-outline form-white margin-bottom" style="margin-bottom:20px;">
                                    <ion-icon name="search" class="trailing" style="font-size: 120%;"></ion-icon>
                                    <input spellcheck="false" type="text" class="form-control form-icon-trailing form-control-lg" id="_${cqlshSessionSearchInputID}">
                                    <label class="form-label">
                                      <span mulang="search in the session" capitalize-first></span>
                                    </label>
                                  </div>
                                </div>
                                <div class="session-content" id="_${cqlshSessionContentID}_container"></div>
                                <div class="empty-statements show">
                                  <div class="container">
                                    <div class="semi-colon">;</div>
                                    <div class="message"><span mulang="start now by executing cql statement" capitalize-first></span></div>
                                  </div>
                                </div>
                                <div class="container-footer">
                                  <div class="top">
                                    <div class="history-items"></div>
                                    <div class="history">
                                      <button class="btn btn-tertiary" type="button" data-mdb-ripple-color="light" disabled>
                                        <ion-icon name="history"></ion-icon>
                                      </button>
                                    </div>
                                    <div class="textarea">
                                      <div class="form-outline form-white margin-bottom">
                                        <div class="suggestion"></div>
                                        <textarea spellcheck="false" type="text" class="form-control form-icon-trailing form-control-lg" id="_${cqlshSessionStatementInputID}"></textarea>
                                        <label class="form-label">
                                          <span mulang="execute a cql statement" capitalize-first></span>
                                        </label>
                                      </div>
                                    </div>
                                    <div class="kill-process">
                                      <button class="btn btn-primary btn-dark changed-bg changed-color" type="button" data-mdb-ripple-color="var(--mdb-danger)" data-tippy="tooltip" data-mdb-placement="left" data-title="Kill the process" data-mulang="kill the process" capitalize-first>
                                        <ion-icon name="close"></ion-icon>
                                      </button>
                                    </div>
                                    <div class="hints-container">
                                      <div class="hint changed-bg changed-color">
                                        <div class="text">
                                          <span mulang="an incomplete statement would have interrupted the execution flow" capitalize-first></span>
                                        </div>
                                      </div>
                                    </div>
                                    <div class="execute">
                                      <button class="btn btn-tertiary" type="button" data-mdb-ripple-color="light" disabled>
                                        <ion-icon name="send"></ion-icon>
                                        <l-reuleaux size="20" stroke="2" stroke-length="0.25" bg-opacity="0.25" speed="0.8" color="white"></l-reuleaux>
                                      </button>
                                    </div>
                                  </div>
                                  <div class="bottom">
                                    <div class="suggestions-list"></div>
                                  </div>
                                </div>
                              </div>
                              <div class="loading">
                                <div class="sub-content">
                                  <lottie-player src="../assets/lottie/loading-cqlsh.json" background="transparent" autoplay loop speed="2"></lottie-player>
                                </div>
                              </div>
                            </div>
                            <div class="tab-pane fade _empty" tab="cql-description" id="_${cqlDescriptionContentID}" role="tabpanel">
                              <div class="descriptions-container">
                                <div class="form-outline form-white margin-bottom" style="margin-bottom:20px;">
                                  <ion-icon name="search" class="trailing" style="font-size: 120%;"></ion-icon>
                                  <input type="text" class="form-control form-icon-trailing form-control-lg" id="_${cqlDescriptionSearchInputID}">
                                  <label class="form-label">
                                    <span mulang="search for CQL description" capitalize-first></span>
                                  </label>
                                </div>
                                <div class="descriptions">
                                </div>
                              </div>
                              <div class="empty">
                                <div class="lottie-container">
                                  <lottie-player src="../assets/lottie/empty-cql-description.json" background="transparent" loop autoplay speed="0.75" direction="1"></lottie-player>
                                  <div class="message"><span mulang="right click on the cluster, keyspace or table and get its CQL description" capitalize-first></span>.
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div class="tab-pane fade _empty" tab="query-tracing" id="_${queryTracingContentID}" role="tabpanel">
                              <div class="queries-container">
                                <div class="form-outline form-white margin-bottom" style="margin-bottom:20px;">
                                  <ion-icon name="search" class="trailing" style="font-size: 120%;"></ion-icon>
                                  <input type="text" class="form-control form-icon-trailing form-control-lg" id="_${queryTracingSearchInputID}">
                                  <label class="form-label">
                                    <span mulang="search by session ID or part of the query" capitalize-first></span>
                                  </label>
                                </div>
                                <div class="queries">
                                </div>
                              </div>
                              <div class="empty">
                                <div class="lottie-container">
                                  <lottie-player src="../assets/lottie/empty-query-tracing.json" background="transparent" loop autoplay speed="0.75" direction="1" mode"bounce"></lottie-player>
                                  <div class="message"><span mulang="no query has been traced yet" capitalize-first></span>.<hint> <span mulang="it can be enabled by running" capitalize-first></span> <code>tracing on</code></hint>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div class="tab-pane fade" tab="metadata-differentiation" id="_${metadataDifferentiationContentID}" role="tabpanel">
                              <div class="metadata-content-container">
                                <div class="metadata-content all">
                                  <div class="editor-container-all"></div>
                                </div>
                                <span class="badge badge-secondary old"><span mulang="previous" capitalize></span><span class="old-snapshot" data-id="${oldSnapshotNameID}"></span></span>
                                <div class="centered-badges">
                                  <span class="badge badge-primary btn btn-secondary btn-dark btn-sm changes" style="cursor:pointer;" data-mdb-ripple-color="dark" data-changes="0" data-id="${showDifferentiationBtnID}"><span mulang="changes" capitalize></span>: <span>0</span></span>
                                  <div class="diff-navigation">
                                    <span class="diff-nav-prev btn btn-secondary btn-dark btn-sm disabled" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Previous change" data-mulang="previous change" capitalize-first
                                      data-id="${diffNavigationPrevBtnID}">
                                      <ion-icon name="arrow-up"></ion-icon>
                                    </span>
                                    <span class="diff-nav-next btn btn-secondary btn-dark btn-sm disabled" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Next change" data-mulang="next change" capitalize-first
                                      data-id="${diffNavigationNextBtnID}">
                                      <ion-icon name="arrow-up"></ion-icon>
                                    </span>
                                  </div>
                                  <div class="actions">
                                    <span class="refresh btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Refresh metadata" data-mulang="refresh metadata" capitalize-first
                                      data-id="${refreshDifferentiationBtnID}">
                                      <ion-icon name="refresh"></ion-icon>
                                    </span>
                                    <span class="save-snapshot btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Save a schema snapshot" data-mulang="save a schema snapshot" capitalize-first
                                      data-id="${saveSnapshotBtnID}" ${isSandbox ? 'hidden' : '' }>
                                      <ion-icon name="save-floppy"></ion-icon>
                                    </span>
                                    <span class="load-snapshot btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Load a schema snapshot" data-mulang="load a schema snapshot" capitalize-first
                                      data-id="${loadSnapshotBtnID}" ${isSandbox ? 'hidden' : '' }>
                                      <ion-icon name="upload"></ion-icon>
                                    </span>
                                    <span class="snapshots-folder btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Open the schema snapshot folder" data-mulang="open the schema snapshot folder" capitalize-first
                                      data-id="${openSnapshotsFolderBtnID}" ${isSandbox ? 'hidden' : '' }>
                                      <ion-icon name="folder-open-outline"></ion-icon>
                                    </span>
                                    <span class="change-view btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Change the editors view" data-mulang="change the editors view" capitalize-first
                                      data-id="${changeViewBtnID}" hidden>
                                      <ion-icon name="diff-vertical"></ion-icon>
                                    </span>
                                  </div>
                                </div>
                                <span class="badge badge-secondary new"><span mulang="new" capitalize></span><span class="new-metadata-time" data-id="${newMetadataTimeID}" data-time></span></span>
                                <div class="save-snapshot-suffix" data-id="${saveSnapshotSuffixContainerID}" ${isSandbox ? 'hidden' : '' }>
                                  <div class="time"></div>
                                  <div class="form-outline form-white margin-bottom">
                                    <input type="text" class="form-control form-icon-trailing form-control-lg">
                                    <label class="form-label"><span mulang="snapshot suffix" capitalize></span> (<span mulang="optional" capitalize></span>)</label>
                                  </div>
                                  <button type="button" class="btn btn-primary btn-dark btn-sm changed-bg changed-color"><span mulang="save schema snapshot"></span></button>
                                </div>
                                <div class="changes-lines" data-id="${changesLinesContainerID}">
                                </div>
                              </div>
                            </div>
                            <div class="tab-pane fade" id="_${axonopsContentID}" role="tabpanel"></div>
                            <div class="tab-pane fade" tab="bash-session" id="_${bashSessionContentID}" role="tabpanel">
                              <div class="terminal-container" data-id="${terminalBashContainerID}"></div>
                            </div>
                          </div>
                        </div>
                      </div>`

                  // Append the cluster's work area
                  content.append($(element).show(function() {
                    // Update the `work-area` attribute
                    clusterElement.attr('data-workarea', 'true')

                    // Apply different actions once the UI element is created
                    {
                      // Initialize the input and textarea fields
                      setTimeout(() => {
                        $(this).find('input[type="text"], textarea').each(function() {
                          try {
                            let object = getElementMDBObject($(this), 'Input')
                            object.update()
                          } catch (e) {}
                        })
                      }, 1000)

                      // Initialize all tooltips inside the work area
                      setTimeout(() => {
                        $(this).find('[data-tippy="tooltip"]').each(function() {
                          // Create an MDB oject for the tooltip
                          let tooltip = getElementMDBObject($(this), 'Tooltip')

                          // Disable the tab's tooltips
                          if ($(this).attr('tab-tooltip') != undefined)
                            tooltip.disable()

                          // Once the tooltip's reference element is clicked hide the tooltip
                          $(tooltip.reference).click(() => tooltip.hide())
                        })
                      })

                      // Update the SSL lockpad status - if the status is available in this stage -
                      setTimeout(() => updateSSLLockpadStatus(clusterElement))

                      // Apply the chosen language on the UI element after being fully loaded
                      setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                      // Update the status of the cluster in the mini cluster's list
                      updateMiniCluster(workspaceID, clusterID)
                    }

                    // Handle when typing something inside the query tracing's search input field
                    {
                      setTimeout(() => {
                        $(`input#_${queryTracingSearchInputID}`).on('input', function() {
                          // Get the search text, minify/manipulate it
                          let searchValue = minifyText($(this).val()),
                            // Point at the queries' container
                            queriesContainer = $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).find('div.queries')

                          // The search text must be more than 3 characters
                          if (searchValue.length <= 3)
                            return queriesContainer.children('div.query').show()

                          // Loop through each query
                          queriesContainer.children('div.query').each(function() {
                            // Get its text in overall
                            let queryContent = minifyText($(this).text())

                            // Show/hide it based on the result of whether or not it contains the search text
                            $(this).toggle(queryContent.search(searchValue))
                          })
                        })
                      })
                    }

                    // Handle when typing something inside the interactive terminal's search input
                    {
                      setTimeout(() => {
                        $(`input#_${cqlshSessionSearchInputID}`).on('input', function() {
                          // Get the search text, minify/manipulate it
                          let searchValue = minifyText($(this).val()),
                            // Point at the sessions' container
                            sessionContainer = $(`#_${cqlshSessionContentID}_container`)

                          // The search text must be more than 3 characters
                          if (searchValue.length <= 3)
                            return sessionContainer.children('div.block').show()

                          // Loop through each block
                          sessionContainer.children('div.block').each(function() {
                            // Get its text in overall
                            let blockContent = minifyText($(this).text())

                            // Show/hide it based on the result of whether or not it contains the search text
                            $(this).toggle(blockContent.search(searchValue))
                          })
                        })
                      })
                    }

                    // Handle when typing something inside the cql description's search input field
                    {
                      setTimeout(() => {
                        $(`input#_${cqlDescriptionSearchInputID}`).on('input', function() {
                          // Get the search text, minify/manipulate it
                          let searchValue = minifyText($(this).val()),
                            // Point at the descriptions' container
                            descriptionsContainer = $(`div.tab-pane[tab="cql-description"]#_${cqlDescriptionContentID}`).find('div.descriptions')

                          // Update the input field by calling its object's `update` function
                          getElementMDBObject($(this)).update()

                          // Trigger the `resize` event to make sure editors' dimensions are correct
                          setTimeout(() => $(window.visualViewport).trigger('resize'))

                          // The search text must be more than 3 characters
                          if (searchValue.length <= 3)
                            return descriptionsContainer.children('div.description').show()

                          // Loop through each description
                          descriptionsContainer.children('div.description').each(function() {
                            // Get its text in overall
                            let descriptionContent = minifyText($(this).text())

                            // Show/hide it based on the result of whether or not it contains the search text
                            $(this).toggle(descriptionContent.search(searchValue))
                          })
                        })
                      })
                    }

                    /**
                     * Define variables which will be available for all sub-scopes
                     *
                     * Point at the created work area
                     */
                    let workareaElement = $(this),
                      terminal, // The XTermJS object
                      terminalID = getRandomID(10), // The cqlsh session's unique ID
                      prefix = '', // Dynamic prefix/prompt; `cqlsh>`, `cqlsh:system>`, etc...
                      isSessionPaused = false, // To determine if there's a need to pause the print of received data temporarily or permanently
                      isCQLSHLoaded = false, // To determine if the cqlsh tool has been loaded and ready to be used
                      isMetadataFetched = false, // To determine if the metadata will be fetched or not
                      latestMetadata = null, // Save the latest fetched metadata in JSON format
                      metadataChanges = 0, // Hold the latest detected number of changes/diffs in metadata
                      // An inner function to check/fetch metadata which will be implemented next and be available out of the implementation scope
                      checkMetadata = null,
                      /**
                       * The metadata differentiation editors - old and new metadata -
                       * Both of them have the editor's object, and decorations - to highlight diffs
                       */
                      metadataDiffEditors = {
                        old: {
                          object: null,
                          decorations: null
                        },
                        new: {
                          object: null,
                          decorations: null
                        }
                      },
                      diffEditor,
                      diffEditorNavigator,
                      // Hold the object of the metadata's tree view
                      jsTreeObject = null,
                      // Save the latest executed command
                      latestCommand = null

                    /**
                     * Inner function to detect the differentiation between two metadata contents and apply changes over the UI
                     *
                     * @Parameters:
                     * {object} `oldMetadata` the old metadata in JSON format
                     * {object} `newMetadata` the new metadata in JSON format
                     */
                    let detectDifferentiationShow = (oldMetadata, newMetadata) => {
                      // Apply JSON beautify process on both contents
                      oldMetadata = applyJSONBeautify(oldMetadata, true)
                      newMetadata = applyJSONBeautify(newMetadata, true)

                      // Call the function which will return changes between two strings
                      detectDifferentiation(oldMetadata, newMetadata, (detectedChanges) => {
                        // Point at the results
                        let result = detectedChanges.result,
                          // Point at the differentiation show button000
                          differentiationBtn = $(`span.btn[data-id="${showDifferentiationBtnID}"]`),
                          // Point at the changes/differences container
                          changesContainer = $(`div.changes-lines[data-id="${changesLinesContainerID}"]`)

                        // Update the number of detected changes
                        differentiationBtn.attr('data-changes', result.length)

                        // Update the button's text by showing the number of detected changes
                        differentiationBtn.children('span').filter(':last').text(result.length); // This semicolon is critical here

                        // Loop through both editors and remove the decorations
                        (['old', 'new']).forEach((type) => {
                          if (metadataDiffEditors[type].decorations != null)
                            metadataDiffEditors[type].object.removeDecorations(metadataDiffEditors[type].decorations)
                        })

                        // If there's no detected change then end the process
                        if (result.length <= 0)
                          return

                        // Remove all previous changed lines from the changes' container
                        changesContainer.children('div.line').remove()

                        // Array which will hold all decorations
                        let highlights = []

                        // Loop through each change in the content
                        result.forEach((change) => {
                          // Increasing the number is important as the first line's number in the array is 0
                          change.number += 1

                          // Push the highlight object
                          highlights.push({
                            range: new monaco.Range(change.number, 0, change.number, 0),
                            options: {
                              isWholeLine: true,
                              className: 'diff'
                            },
                            type: change.type
                          })

                          // Line UI element structure
                          let element = `
                              <div class="line" data-number="${change.number}">
                                <span class="number">${change.number}</span>
                                <span class="content">${change.content}</span>
                              </div>`

                          // Append the line element to the container
                          changesContainer.append($(element).click(function() {
                            // Get the line's number
                            let lineNumber = parseInt($(this).attr('data-number')); // This semicolon is critical here

                            // For both editors, go to the clicked line
                            (['old', 'new']).forEach((type) => {
                              // Show the line at the center of the editor
                              metadataDiffEditors[type].object.revealLineInCenter(lineNumber)

                              // Put cursor at the beginning of the line
                              metadataDiffEditors[type].object.setPosition({
                                lineNumber,
                                column: 0
                              })
                            })
                          }))
                        }); // This semicolon is critical here

                        // Add highlights to both editors
                        (['old', 'new']).forEach((type) => {
                          let finalHighlights = [...highlights]

                          try {
                            if (type != 'new')
                              throw 0

                            finalHighlights = finalHighlights.map((highlight) => {
                              delete highlight.type
                              return highlight
                            })
                          } catch (e) {}

                          try {
                            if (type != 'old')
                              throw 0

                            finalHighlights = (finalHighlights.filter((highlight) => highlight.type != 'ADD')).map((highlight) => {
                              delete highlight.type
                              return highlight
                            })
                          } catch (e) {}

                          try {
                            metadataDiffEditors[type].decorations = metadataDiffEditors[type].object.deltaDecorations([], finalHighlights)
                          } catch (e) {}
                        })
                      })
                    }

                    /**
                     * Inner function to append block to the interactive terminal
                     *
                     * @Parameters:
                     * {object} `sessionContainer` the terminal's session HTML container
                     * {string} `blockID` the generated block ID
                     * {string} `statement` the executed statement
                     * {object} `callback` function that will be triggered with passing the final result
                     * {boolean} `?isOnlyInfo` Whether or not this is an info block only
                     * {string} `?type` the type of the message, the value could be:
                     * [`warning`, `info`, and `error`], or empty
                     *
                     * @Return: {string} the passed object in string format after manipulation
                     */
                    global.addBlock = (sessionContainer, blockID, statement, callback = null, isOnlyInfo = false, type = '') => {
                      // Hide the emptiness class as there's at least one block now
                      sessionContainer.parent().find(`div.empty-statements`).removeClass('show')

                      let finalInfoContent = (type == 'neutral' ? 'info' : type)

                      finalInfoContent = `<span mulang="${finalInfoContent}" capitalize></span>`

                      // The statement's block UI structure
                      let element = `
                           <div class="block show" data-id="${blockID}">
                             <div class="statement ${isOnlyInfo ? type + ' capitalize' : ''}">
                               <span class="toast-type" ${!isOnlyInfo ? 'hidden' : ''}>
                                 <lottie-player src="../assets/lottie/${type || 'neutral'}.json" background="transparent" autoplay></lottie-player>
                               </span>
                               <div class="text"><pre>${isOnlyInfo ? finalInfoContent : statement}</pre></div>
                               <div class="actions for-statement" ${isOnlyInfo ? 'hidden' : ''}>
                                 <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="copy-statement" data-tippy="tooltip" data-mdb-placement="right" data-title="Copy the statement" onclick="copyStatement(this)"
                                   data-mulang="copy the statement" capitalize-first>
                                   <ion-icon name="copy-solid"></ion-icon>
                                 </div>
                               </div>
                             </div>
                             <div class="info-badges">
                               <div class="prompt badge badge-secondary" ${isOnlyInfo ? 'hidden' : ''}></div>
                               <div class="statements-count badge badge-info" ${isOnlyInfo ? 'hidden' : ''}></div>
                             </div>
                             <div class="output">
                               <div class="executing" ${isOnlyInfo ? 'hidden' : ''}></div>
                               ${isOnlyInfo ? statement : ''}
                             </div>
                             <div class="actions" style="${isOnlyInfo ? 'width:30px;' : ''}">
                               <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="download" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Download the block"
                                 data-mulang="download the block" capitalize-first hidden>
                                 <ion-icon name="download"></ion-icon>
                               </div>
                               <div class="download-options">
                                 <div class="option btn btn-tertiary" option="csv" data-mdb-ripple-color="dark">
                                   <ion-icon name="csv"></ion-icon>
                                 </div>
                                 <div class="option btn btn-tertiary" option="pdf" data-mdb-ripple-color="dark">
                                   <ion-icon name="pdf"></ion-icon>
                                 </div>
                               </div>
                               <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="copy" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Copy the block"
                                 data-mulang="copy the block" capitalize-first ${isOnlyInfo ? 'hidden' : ''}>
                                 <ion-icon name="copy-solid"></ion-icon>
                               </div>
                               <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Delete the block"
                                 data-mulang="delete the block" capitalize-first>
                                 <ion-icon name="trash"></ion-icon>
                               </div>
                             </div>
                           </div>`

                      // Append the block and hide it - till and output is received -
                      sessionContainer.append($(element).show(function() {
                        // Enable tooltips
                        setTimeout(() => $(this).find('[data-tippy="tooltip"]').each(function() {
                          getElementMDBObject($(this), 'Tooltip')
                        }))

                        // Call the callback function with the created block
                        if (callback != null)
                          callback($(this))

                        // Skip the upcoming code if the block is not an info
                        if (!isOnlyInfo)
                          return

                        // Show the block if needed
                        $(this).show().addClass('show')

                        setTimeout(() => {
                          $(this).find('div.btn[action="delete"]').click(() => {
                            // Remove the block from the session
                            $(this).remove()

                            try {
                              // Point at the session's statements' container
                              let sessionContainer = $(`#_${cqlshSessionContentID}_container`)

                              // If there's still one block then skip this try-catch block
                              if (sessionContainer.find('div.block').length > 0)
                                throw 0

                              // Show the emptiness class
                              sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                            } catch (e) {}
                          })
                        })

                        // Scroll to the very bottom of the session's container
                        setTimeout(() => {
                          try {
                            $(this).parent().animate({
                              scrollTop: $(this).parent().get(0).scrollHeight
                            }, 100)
                          } catch (e) {}
                        }, 200)

                        // Apply the chosen language on the UI element after being fully loaded
                        setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                      }))
                    }

                    // Create the terminal instance from the XtermJS constructor
                    terminalObjects[terminalID] = new XTerm({
                      theme: XTermThemes.Atom
                    })

                    // Set the `terminal` variable to be as a reference to the object
                    terminal = terminalObjects[terminalID]

                    // Add log
                    try {
                      addLog(`CQLSH session created for the connection '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`)
                    } catch (e) {}

                    /**
                     * Custom terminal options
                     *
                     * Change font family to `JetBrains Mono` and set its size and line height
                     * https://www.jetbrains.com/lp/mono/
                     */
                    terminal.options.fontFamily = `'Terminal', monospace`
                    terminal.options.fontSize = 13
                    terminal.options.lineHeight = 1.35

                    // Enable the cursor blink when the terminal is being focused on
                    terminal._publicOptions.cursorBlink = true

                    try {
                      setTimeout(() => {
                        /**
                         * Define XtermJS addons
                         *
                         * Fit addon; to resize the terminal without distortion
                         */
                        fitAddon = new FitAddon.FitAddon()

                        /**
                         * Load XtermJS addons
                         *
                         * Load the `Fit` addon
                         */
                        terminal.loadAddon(fitAddon)

                        /**
                         * Inner function to handle the `click` event of a session's link in the terminal
                         *
                         * @Parameters:
                         * {object || boolean} `_` this parameter can be the event object, or flag to tell about the seesion's ID
                         * {string} `link` the link's content
                         */
                        let clickEvent = (_, link) => {
                          /**
                           * Get the session ID from the link - by slicing the protocol `session://`
                           * Other is passing `true` to `_` parameter; which tells that the function has been called from the interactive terminal
                           */
                          let sessionID = _ != true ? link.slice(10) : link,
                            // Point at the queries' container
                            queriesContainer = $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).find('div.queries'),
                            // Point at the queries' tab
                            queryTracingTab = $(`a.nav-link.btn[href="#_${queryTracingContentID}"]`),
                            // Get the queries' tab MDB object
                            queryTracingTabObject = getElementMDBObject(queryTracingTab, 'Tab')

                          // If the clicked session exists in the query tracing's container
                          if (queriesContainer.children(`div.query[data-session-id="${sessionID}"]`).length != 0) {
                            // Just add the session ID in the search input and it'll handle the rest
                            $(`input#_${queryTracingSearchInputID}`).val(sessionID)

                            // Go to the query tracing's tab
                            queryTracingTabObject.show()

                            // Skip the upcoming code
                            return
                          }

                          // Request to get query tracing result by passing the cluster's and the session's IDs
                          Modules.Clusters.getQueryTracingResult(clusterID, sessionID, (result) => {
                            // If the `result` value is `null` then the app wasn't able to get the query tracing result
                            if (result == null)
                              return

                            // Get random IDs for the different elements of the query tracing section
                            let [
                              canvasTimelineID,
                              canvasPieChartID,
                              tableBodyID
                            ] = getRandomID(20, 3),
                              // Generate random color for each activity in the query tracing's result
                              colors = getRandomColor(result.length).map((color) => invertColor(color))

                            // Remove the `empty` class; in order to show the query tracing's content
                            $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).removeClass('_empty')

                            // The query tracing's result UI structure
                            let element = `
                                <div class="query" data-session-id="${sessionID}">
                                  <span class="badge rounded-pill badge-secondary id-time">#${sessionID} <ion-icon name="time"></ion-icon> ${formatTimeUUID(sessionID)}</span>
                                  <div class="info-left">
                                    <div class="left-chart"><canvas data-canvas-id="${canvasTimelineID}" width="100%"></canvas></div>
                                    <div class="right-chart"><canvas data-canvas-id="${canvasPieChartID}" width="100%"></canvas></div>
                                  </div>
                                  <div class="info-right">
                                    <div class="copy-tracing">
                                      <div class="btn btn-tertiary" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="left" data-title="Copy the tracing result" data-mulang="copy the tracing result" capitalize-first>
                                        <ion-icon name="copy-solid"></ion-icon>
                                      </div>
                                    </div>
                                    <table class="table table-bordered">
                                      <thead>
                                        <tr>
                                          <th scope="col" style="width: 40%;"><span mulang="activity" capitalize></span></th>
                                          <th scope="col"><span mulang="time" capitalize></span></th>
                                          <th scope="col"><span mulang="source" capitalize></span></th>
                                          <th scope="col"><span mulang="source port" capitalize></span></th>
                                          <th scope="col"><span mulang="source elapsed" capitalize></span></th>
                                          <th scope="col"><span mulang="thread" capitalize></span></th>
                                        </tr>
                                      </thead>
                                      <tbody data-body-id="${tableBodyID}">
                                      </tbody>
                                    </table>
                                  </div>
                                </div>`

                            // Prepend the tracing's result to the container
                            queriesContainer.prepend($(element).show(function() {
                              // Apply different actions once the UI element is created
                              {
                                // Show the query tracing's tab after 0.25s of creation
                                setTimeout(() => queryTracingTabObject.show(), 250)

                                // Apply the chosen language on the UI element after being fully loaded
                                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                              }

                              // Listen to the `click` event on the result's badge - which contain's the query tracing's session ID
                              {
                                setTimeout(() => $(this).find('span.badge').click(() => $(`tbody[data-body-id="${tableBodyID}"]`).parent().toggle()))
                              }

                              // Append each activity in the query tracing's table
                              {
                                setTimeout(() => {
                                  // Loop through each activity
                                  result.forEach((activity, index) => {
                                    // Each activity is shown as a row in the result's table
                                    let element = `
                                        <tr>
                                          <td><span class="color" style="background-color:${colors[index]}"></span> ${activity.activity}</td>
                                          <td>${formatTimeUUID(activity.event_id, true)}</td>
                                          <td>${activity.source}</td>
                                          <td>${activity.source_port || '-'}</td>
                                          <td>${((index == 0 ? activity.source_elapsed : activity.source_elapsed - result[index - 1].source_elapsed) / 1000).toFixed(2)}ms</td>
                                          <td>${activity.thread}</td>
                                        </tr>`

                                    // Append the activity to the table
                                    $(this).find(`tbody[data-body-id="${tableBodyID}"]`).append($(element))
                                  })
                                })
                              }

                              // Clicks the copy button
                              setTimeout(() => {
                                $(this).find('div.copy-tracing div.btn').click(function() {
                                  // Get the beautified version of the result
                                  let resultBeautified = applyJSONBeautify(result),
                                    // Get the result size
                                    resultSize = ByteSize(ValueSize(resultBeautified))

                                  // Copy the result to the clipboard
                                  try {
                                    Clipboard.writeText(resultBeautified)
                                  } catch (e) {
                                    try {
                                      errorLog(e, 'connections')
                                    } catch (e) {}
                                  }

                                  // Give feedback to the user
                                  showToast(I18next.capitalize(I18next.t('copy query tracing result')), I18next.capitalizeFirstLetter(I18next.replaceData('query tracing result with session ID of [b]$data[/b] has been copied to the clipboard, the size is $data', [sessionID, resultSize])) + '.', 'success')
                                })
                              })

                              // Set the common configuration between the two charts - timeline and doughnut -
                              let chartConfiguration = {
                                chart: {
                                  fontFamily: 'Main, sans-serif'
                                },
                                data: {
                                  datasets: [{
                                    data: null,
                                    backgroundColor: colors
                                  }],
                                  labels: result.map((query) => query.activity)
                                },
                                options: {
                                  indexAxis: 'y',
                                  scales: {
                                    y: {
                                      ticks: {
                                        display: false
                                      }
                                    }
                                  },
                                  responsive: true,
                                  plugins: {
                                    legend: {
                                      display: false
                                    },
                                    tooltip: {
                                      callbacks: {
                                        label: null
                                      }
                                    },
                                    title: {
                                      display: false
                                    }
                                  }
                                }
                              }

                              /**
                               * Set the timeline chart configuration
                               * Doc: https://www.chartjs.org/docs/latest/charts/bar.html
                               *
                               * Copy the common configuration
                               */
                              let timeLineChartConfig = JSON.parse(JSON.stringify(chartConfiguration))

                              // Set the special configuration for the timeline chart
                              try {
                                timeLineChartConfig.type = 'bar'
                                timeLineChartConfig.data.datasets[0].data = result.map((query, index) => [index == 0 ? 0 : result[index - 1].source_elapsed / 1000, query.source_elapsed / 1000])

                                timeLineChartConfig.options.elements = {}
                                timeLineChartConfig.options.elements.bar = {
                                  borderWidth: 1
                                }

                                timeLineChartConfig.options.plugins.tooltip.callbacks.label = (activity) => {
                                  let val = JSON.parse(activity.formattedValue)
                                  return `${(val[1] - val[0]).toFixed(2)}ms`
                                }
                              } catch (e) {
                                try {
                                  errorLog(e, 'connections')
                                } catch (e) {}
                              }

                              /**
                               * Set the pie/doughnut chart configuration
                               * Doc: https://www.chartjs.org/docs/latest/charts/doughnut.html
                               *
                               * Copy the common configuration
                               */
                              let pieChartConfig = JSON.parse(JSON.stringify(chartConfiguration))

                              // Set the special configuration for the pie chart
                              try {
                                pieChartConfig.type = 'doughnut'
                                pieChartConfig.data.datasets[0].data = result.map((query, index) => parseFloat((query.source_elapsed / 1000) - (index == 0 ? 0 : result[index - 1].source_elapsed / 1000)))
                                pieChartConfig.data.datasets[0].borderColor = 'rgba(0, 0, 0, 0)'

                                pieChartConfig.options.plugins.tooltip.callbacks.label = (activity) => {
                                  return `${parseFloat(activity.formattedValue).toFixed(2)}ms`
                                }
                              } catch (e) {
                                try {
                                  errorLog(e, 'connections')
                                } catch (e) {}
                              }

                              /**
                               * Create the charts by calling the `Chart` constructor
                               * The charts' objects are saved in the `queryTracingChartsObjects` array
                               */
                              ([
                                [canvasTimelineID, timeLineChartConfig],
                                [canvasPieChartID, pieChartConfig]
                              ]).forEach((chart, index) => setTimeout(() => queryTracingChartsObjects[chart[0]] = new Chart($(`canvas[data-canvas-id="${chart[0]}"]`)[0], chart[1]), 50 * index))
                            }))
                          })
                        }

                        // The terminal now will be shown in the UI
                        terminal.open($(`div.terminal-container[data-id="${terminalContainerID}"]`)[0])

                        // Load the `Canvas` addon
                        terminal.loadAddon(new CanvasAddon())

                        // Load the `Webfont` addon
                        terminal.loadAddon(new XtermWebFonts())

                        // Fit the terminal with its container
                        setTimeout(() => fitAddon.fit())

                        // Push the fit addon object to the related array
                        terminalFitAddonObjects.push(fitAddon)

                        // Call the inner function - at the very end of this code block -; to create a pty instance for that cluster
                        requestPtyInstanceCreation(terminal, {
                          cqlshSessionContentID,
                          terminalID
                        })

                        // Call the fit addon for the terminal
                        setTimeout(() => fitAddon.fit(), 1200)

                        try {
                          IPCRenderer.removeAllListeners(`pty:data:${clusterID}`)
                        } catch (e) {}

                        // Restricted-scope variable that will hold all output till new line character is detected
                        let allOutput = '',
                          // Timeout object which will be triggerd in 10ms to check if the prompt is duplicated
                          promptDuplicationTimeout,
                          // Hold all blocks' output to be handled and removed later
                          blocksOutput = [],
                          // Hold all detected sessions' IDs to be used later
                          detectedSessionsID = [],
                          // Flag to tell if an empty line has been found or not
                          isEmptyLineFound = false

                        // Listen to data sent from the pty instance regards the basic terminal
                        IPCRenderer.on(`pty:data-basic:${clusterID}`, (_, data) => {
                          try {
                            // If the session is paused then nothing would be printed
                            if (isSessionPaused)
                              throw 0

                            // Print/write the data to the terminal
                            terminal.write(data.output)
                          } catch (e) {}
                        })

                        let isConnectionLost = false

                        // Listen to data sent from the pty instance which are fetched from the cqlsh tool
                        IPCRenderer.on(`pty:data:${clusterID}`, (_, data) => {
                          // If the session is paused then nothing would be printed
                          if (isSessionPaused || ['print metadata', 'print cql_desc', 'check connection'].some((command) => `${data.output}`.includes(command)))
                            return

                          // Make sure the given output is string
                          data.output = data.output || ''

                          // Store all received data
                          allOutput += data.output

                          if (isConnectionLost)
                            return


                          try {
                            if (!((['connectionerror:', ',last_host']).some((keyword) => minifyText(allOutput).includes(keyword))))
                              throw 0

                            isConnectionLost = true

                            workareaElement.find('div.sub-sides.left div.cluster-metadata.loading div.loading').find('lottie-player')[0].stop()

                            workareaElement.css({
                              'transition': 'filter 0.5s ease-in-out',
                              'filter': 'grayscale(1)'
                            })


                            showToast(I18next.t('activate connection'), I18next.capitalizeFirstLetter(I18next.replaceData(`failed to finalize the creation of the work area as the connection [b]$data[/b] has been lost. Consider to close this workarea and test the connection before trying again`, [getAttributes(clusterElement, 'data-name')]) + '.'), 'failure')

                            return
                          } catch (e) {}

                          // Check if the received data contains the `tracing session` keyword
                          try {
                            // Match the regular expression and get the session's ID
                            sessionID = (new RegExp('tracing\\s*session\\s*:\\s*(.+)', 'gm')).exec(data.output.toLowerCase())[1]

                            // Push the detected session ID
                            detectedSessionsID.push(manipulateOutput(sessionID))

                            // Remove any duplication
                            detectedSessionsID = [...new Set(detectedSessionsID)]
                          } catch (e) {}

                          // Check if `CQLSH-STARTED` has been received
                          try {
                            // If the keywords haven't been received yet or cqlsh has already been loaded then skip this try-catch block
                            if (!minifyText(data.output).search(minifyText('KEYWORD:CQLSH:STARTED')) || isCQLSHLoaded)
                              throw 0

                            // The CQLSH tool has been loaded
                            isCQLSHLoaded = true

                            // Handle the initialization of the basic terminal and the activation of the switching button
                            setTimeout(function() {
                              // Point at the switching button
                              let switchTerminalBtn = $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find(`div.switch-terminal button`)

                              // Click it to initialize the terminal
                              switchTerminalBtn.trigger('click', true)

                              // Enable the terminal switch button
                              setTimeout(() => switchTerminalBtn.attr('disabled', null), 1000)
                            }, 1000)

                            // Send an `EOL` character to the pty instance
                            IPCRenderer.send('pty:command', {
                              id: clusterID,
                              cmd: ''
                            })

                            // Disable paging for the interactive terminal
                            setTimeout(() => {
                              IPCRenderer.send('pty:command', {
                                id: clusterID,
                                cmd: 'PAGING OFF;EXPAND OFF;'
                              })
                            }, 1000)

                            // Remove the loading class
                            $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).removeClass('loading')

                            // Enable all tabs and their associated sections
                            workareaElement.find('div.cluster-tabs').find('li a').removeClass('disabled')

                            try {
                              let metadataDiffContainer = $(`div.tab-pane[tab="metadata-differentiation"]#_${metadataDifferentiationContentID}`)

                              diffEditor = monaco.editor.createDiffEditor(metadataDiffContainer.find(`div.editor-container-all`)[0], {
                                language: 'json', // Set the content's language
                                minimap: {
                                  enabled: true
                                },
                                readOnly: true,
                                glyphMargin: true, // This option allows to render an object in the line numbering side
                                suggest: {
                                  showFields: false,
                                  showFunctions: false
                                },
                                theme: 'vs-dark',
                                scrollBeyondLastLine: true,
                                mouseWheelZoom: true,
                                fontSize: 11
                              })

                              diffEditors.push(diffEditor)

                              diffEditorNavigator = monaco.editor.createDiffNavigator(diffEditor, {
                                followsCaret: true, // Optional
                                ignoreCharChanges: true // Optional: Treat each word/line as a diff, rather than individual characters
                              });
                            } catch (e) {

                            } finally {

                            }
                          } catch (e) {}

                          /**
                           * Inner function to check if the metadata has been fetched or not
                           * The declaration was at the very beginning of this code block
                           */
                          checkMetadata = (refresh = false) => {
                            try {
                              // Update `isMetadataFetched` to `true`; so no need to get it again till the user asks to
                              isMetadataFetched = true

                              // Inner function to create either the old or new editor
                              let createEditor = (type, metadata) => {
                                let editor = monaco.editor.createModel(applyJSONBeautify(metadata, true), 'json')

                                $(`span[data-id="${oldSnapshotNameID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                                $(`span[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                                $(`span[data-id="${newMetadataTimeID}"]`).attr('data-time', `${new Date().getTime()}`)

                                // Return the editor's object
                                return editor
                              }

                              // Get the cluster's metadata
                              Modules.Clusters.getMetadata(clusterID, (metadata) => {
                                try {
                                  if (OS.platform() == 'win32')
                                    metadata = metadata.replace(/\\"/g, `\"`)

                                  // Convert the metadata from JSON string to an object
                                  metadata = JSON.parse(metadata)

                                  // Update latest metadata
                                  latestMetadata = metadata

                                  // Build the tree view
                                  let treeview = buildTreeview(JSON.parse(JSON.stringify(metadata)), true),
                                    // Point at the metadata content's container
                                    metadataContent = $(`div.metadata-content[data-id="${metadataContentID}"]`)

                                  // Create the tree view of the metadata and hold the returned object
                                  jsTreeObject = metadataContent.jstree(treeview)

                                  // Disable the selection feature of a tree node
                                  jsTreeObject.disableSelection()

                                  /**
                                   * Create a listener to the event `contextmenu`
                                   * This event `contextmenu` is customized for the JSTree plugin
                                   */
                                  jsTreeObject.on('contextmenu', function(event) {
                                    // Remove the default contextmenu created by the plugin
                                    $('.vakata-context').remove()

                                    // If connection is lost with the cluster then no context-menu would be shown
                                    if (isConnectionLost)
                                      return

                                    // Point at the right-clicked node
                                    let clickedNode = $(event.target)

                                    // If the node is not one of the specified types then skip this process
                                    if (['a', 'i', 'span'].every((type) => !clickedNode.is(clickedNode)))
                                      return

                                    /**
                                     * The main element in the node is the anchor `a`
                                     * If the clicked element is not `a` but `i` or `span` then the `a` is actually their parent
                                     */
                                    try {
                                      // If the right-clicked node is an anchor already then skip this try-catch block
                                      if (clickedNode.is('a'))
                                        throw 0

                                      // Point at the clicked element's parent `a`
                                      clickedNode = clickedNode.parent()
                                    } catch (e) {}

                                    // If after the manipulation the final element is not an anchor or doesn't have a required attribute then skip the process
                                    if (!clickedNode.is('a') || clickedNode.attr('allow-right-context') != 'true')
                                      return

                                    // If there's no processing element in the anchor then append one
                                    if (clickedNode.find('div.processing').length <= 0)
                                      clickedNode.append($(`<div class="processing"></div>`))

                                    let [
                                      // Get the target's node name in Cassandra®
                                      targetName,
                                      // Get the target's keyspace's name - if it's a table -
                                      keyspaceName,
                                      tableName,
                                      // Get the target's type - cluster, keyspace or table -
                                      nodeType
                                    ] = getAttributes(clickedNode, ['name', 'keyspace', 'table', 'type'])

                                    // Define the scope to be passed with the request
                                    scope = `keyspace>${nodeType == 'keyspace' ? targetName : keyspaceName}${nodeType != 'keyspace' ? 'table>' + targetName : ''}`

                                    // If the node type is cluster then only `cluster` is needed as a scope
                                    if (nodeType == 'cluster')
                                      scope = 'cluster'

                                    // If the node type is an index
                                    try {
                                      if (nodeType != 'index')
                                        throw 0

                                      // Add the keyspace
                                      scope = `keyspace>${keyspaceName}`

                                      // Add the index's table
                                      scope += `table>${tableName}`

                                      // And finally add the index itself
                                      scope += `index>${targetName}`
                                    } catch (e) {}

                                    // Send a request to the main thread regards pop-up a menu
                                    IPCRenderer.send('show-context-menu', JSON.stringify([{
                                      label: I18next.capitalize(I18next.t('get CQL description')),
                                      click: `() => views.main.webContents.send('cql-desc:get', {
                                         clusterID: '${getAttributes(clusterElement, 'data-id')}',
                                         scope: '${scope}',
                                         tabID: '${cqlDescriptionContentID}',
                                         nodeID: '${getAttributes(clickedNode, 'id')}'
                                       })`
                                    }]))
                                  })

                                  // Handle the search feature in the metadata tree view
                                  {
                                    // Define the current index of the search results
                                    let currentIndex = 0,
                                      // Hold the last search results in an array
                                      lastSearchResults = []

                                    // Once a search process is completed
                                    jsTreeObject.on('search.jstree', function(event, data) {
                                      try {
                                        // Reset the current index to be the first result
                                        currentIndex = 0

                                        // Hold the search results
                                        lastSearchResults = metadataContent.find('a.jstree-search')

                                        // Remove the click animation class from all results; to be able to execute the animation again
                                        lastSearchResults.removeClass('animate-click')

                                        // Whether or not the search container should be shown
                                        workareaElement.find('div.right-elements').toggleClass('show', data.nodes.length > 0)

                                        // Reset the current result where the pointer has reached
                                        workareaElement.find('div.result-count span.current').text(`1`)

                                        // Set the new number of results
                                        workareaElement.find('div.result-count span.total').text(`${lastSearchResults.length}`)

                                        // If there's at least one result for this search then attempt to click the first result
                                        try {
                                          lastSearchResults[0].click()
                                        } catch (e) {}
                                      } catch (e) {}
                                    })

                                    // Clicks either the previous or the next buttons/arrows
                                    workareaElement.find('div.right-elements div.arrows div.btn').click(function() {
                                      try {
                                        // Increase the index if the clicked button is `next`, otherwise decrease it
                                        currentIndex += $(this).hasClass('next') ? 1 : -1

                                        // If the pointer has reached the first result already then move to the last one
                                        if (currentIndex < 0)
                                          currentIndex = lastSearchResults.length - 1

                                        // If the pointer has reached the last result then move to the first one
                                        if (currentIndex > lastSearchResults.length - 1)
                                          currentIndex = 0

                                        // Update the current index text
                                        workareaElement.find('div.result-count span.current').text(`${currentIndex + 1}`)

                                        // Attempt to click the reached result
                                        lastSearchResults[currentIndex].click()

                                        // Remove the click animation class from the reached result
                                        $(lastSearchResults[currentIndex]).removeClass('animate-click')

                                        // Add the click animation class to the reached result
                                        setTimeout(() => $(lastSearchResults[currentIndex]).addClass('animate-click'), 50)
                                      } catch (e) {}
                                    })
                                  }

                                  // This try-catch block is for initializing the metadata differentiation after getting the metadata
                                  try {
                                    // If this is a refresh then skip this try-catch block
                                    if (refresh)
                                      throw 0

                                    setTimeout(() => {
                                      // Get the newest/latest saved snapshot for the cluster
                                      Modules.Clusters.getNewestSnapshot(Path.join(getWorkspaceFolderPath(workspaceID), getAttributes(clusterElement, 'data-folder')), (snapshot) => {
                                        // The metadata to be loaded is by default the recently fetched one
                                        let toBeLoadedMetadata = metadata

                                        try {
                                          // If there's a saved snapshot then get its content
                                          if (snapshot.content != undefined)
                                            toBeLoadedMetadata = snapshot.content

                                          // Parse the content from JSON string to object
                                          toBeLoadedMetadata = JSON.parse(toBeLoadedMetadata)

                                          let snapshotTakenTime = ''

                                          try {
                                            snapshotTakenTime = toBeLoadedMetadata.time

                                            delete toBeLoadedMetadata.time
                                          } catch (e) {}

                                          try {
                                            if (snapshotTakenTime.length <= 0)
                                              throw 0

                                            snapshotTakenTime = ` (${formatTimestamp(snapshotTakenTime)})`
                                          } catch (e) {}

                                          // The old side's badge will be updated with the snapshot name
                                          setTimeout(() => {
                                            $(`span.old-snapshot[data-id="${oldSnapshotNameID}"]`).text(`: 11${snapshot.name}${snapshotTakenTime}`)
                                          }, 1000);

                                          // The new side's badge will be updated with fetched time of the latest metadata
                                          $(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)

                                          $(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).attr('data-time', `${new Date().getTime()}`)
                                        } catch (e) {}

                                        // Create an editor for the old metadata content
                                        metadataDiffEditors.old.object = createEditor('old', toBeLoadedMetadata)

                                        // Create an editor for the new metadata content
                                        metadataDiffEditors.new.object = createEditor('new', metadata)

                                        diffEditor.setModel({
                                          original: metadataDiffEditors.old.object,
                                          modified: metadataDiffEditors.new.object
                                        })

                                        diffEditor.onDidUpdateDiff(function() {
                                          // Point at the results
                                          let result = diffEditor.getLineChanges(),
                                            // Point at the differentiation show button000
                                            differentiationBtn = $(`span.btn[data-id="${showDifferentiationBtnID}"]`),
                                            // Point at the changes/differences container
                                            changesContainer = $(`div.changes-lines[data-id="${changesLinesContainerID}"]`)

                                          // Update the number of detected changes
                                          differentiationBtn.attr('data-changes', result.length)

                                          // Update the button's text by showing the number of detected changes
                                          differentiationBtn.children('span').filter(':last').text(result.length); // This semicolon is critical here

                                          $(`span.btn[data-id="${diffNavigationPrevBtnID}"]`).add($(`span.btn[data-id="${diffNavigationNextBtnID}"]`)).toggleClass('disabled', result.length <= 0)

                                          // If there's no detected change then end the process
                                          if (result.length <= 0)
                                            return

                                          // Remove all previous changed lines from the changes' container
                                          changesContainer.children('div.line').remove()

                                          // Loop through each change in the content
                                          result.forEach((change) => {
                                            // Line UI element structure
                                            let element = `
                                                <div class="line" data-number="${change.originalStartLineNumber}">
                                                  <span class="number">${change.originalStartLineNumber}</span>
                                                  <span class="content">${metadataDiffEditors.old.object.getLineContent(change.originalStartLineNumber)}</span>
                                                </div>`

                                            // Append the line element to the container
                                            changesContainer.append($(element).click(function() {
                                              // Get the line's number
                                              let lineNumber = parseInt($(this).attr('data-number')); // This semicolon is critical here

                                              try {
                                                diffEditor.revealLineInCenter(lineNumber)
                                              } catch (e) {}
                                            }))
                                          }) // This semicolon is critical here
                                        })

                                        // Update its layout
                                        setTimeout(() => diffEditor.layout(), 200)

                                        /**
                                         * Create a resize observer for the work area body element
                                         * By doing this the editor's dimensions will always fit with the dialog's dimensions
                                         */
                                        setTimeout(() => {
                                          (new ResizeObserver(() => {
                                            try {
                                              diffEditor.layout()
                                            } catch (e) {}
                                          })).observe(workareaElement[0])
                                        })

                                        // // Detect differentiation between old and new content
                                        // detectDifferentiationShow(toBeLoadedMetadata, metadata)
                                      })

                                    })
                                  } catch (e) {
                                    try {
                                      errorLog(e, 'connections')
                                    } catch (e) {}
                                  }

                                  // Hide the loading indicator in the tree view section
                                  setTimeout(() => metadataContent.parent().removeClass('loading'), 150)
                                } catch (e) {
                                  try {
                                    errorLog(e, 'connections')
                                  } catch (e) {}
                                }
                              })
                            } catch (e) {
                              try {
                                errorLog(e, 'connections')
                              } catch (e) {}
                            }
                          }
                          // End of the check metadata function

                          // Determine whether or not the metadata function will be called
                          try {
                            // If the cqlsh prompt hasn't been found in the received data or cqlsh is not loaded yet then the work area isn't ready to get metadata
                            if ((new RegExp('cqlsh\s*(\:|\s*)(.+|\s*)\>')).exec(data.output) == null || !isCQLSHLoaded)
                              throw 0

                            // If metadata hasn't been got yet
                            if (!isMetadataFetched) {
                              // Call the metadata function
                              checkMetadata()

                              // Skip the upcoming code in this try-catch block
                              throw 0
                            }
                          } catch (e) {}

                          /**
                           * For the app's terminal
                           *
                           * Get cqlsh current prompt - for instance; `cqlsh>` -
                           */
                          let prompt = data.output.match(/^(.*?cqlsh.*?>)/gm),
                            // Update the active prefix to be used
                            activePrefix = prefix

                          /**
                           * The upcoming block is about the interactive terminal
                           *
                           * Whether or not the output has been completed
                           */
                          let isOutputCompleted = data.output.indexOf('KEYWORD:OUTPUT:COMPLETED:ALL') != -1,
                            // Whether or not this output is incomplete
                            isOutputIncomplete = allOutput.endsWith('KEYWORD:STATEMENT:INCOMPLETE'),
                            // Whether or not this output is ignored
                            isOutputIgnored = data.output.indexOf('KEYWORD:STATEMENT:IGNORE') != -1,
                            // Define the variable that will hold a timeout to refresh the metadata content
                            refreshMetadataTimeout

                          try {
                            // If the given `blockID` is empty - the execution has not been called from the interactive terminal - then skip this try-catch block
                            if (minifyText(`${data.blockID}`).length <= 0)
                              throw 0

                            // Point at the associated block element in the interactive terminal
                            let blockElement = $(`div.interactive-terminal-container div.session-content div.block[data-id="${data.blockID}"]`),
                              // Get the block's statement/command
                              blockStatement = blockElement.find('div.statement div.text').text(),
                              // Define the content of the `no-output` element
                              noOutputElement = '<no-output><span mulang="CQL statement executed" capitalize-first></span>.</no-output>'

                            // Update the block's output
                            blocksOutput[data.blockID] = `${blocksOutput[data.blockID] || ''}${data.output}`

                            // Define the final content to be manipulated and rendered
                            finalContent = blocksOutput[data.blockID]

                            // Get the identifiers detected in the statements
                            let statementsIdentifiers = []

                            try {
                              // Get the detected identifiers
                              statementsIdentifiers = finalContent.match(/KEYWORD\:STATEMENTS\:IDENTIFIERS\:\[(.+)\]/i)[1].split(',')

                              // Manipulate them
                              statementsIdentifiers = statementsIdentifiers.map((identifier) => identifier.trim())
                            } catch (e) {}

                            // Handle if the statement's execution process has stopped
                            try {
                              // Toggle the `busy` state of the execution button
                              $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').toggleClass('busy', isOutputIncomplete)

                              // Attempt to clear the killing process button showing state
                              try {
                                clearTimeout(killProcessTimeout)
                              } catch (e) {}

                              // Hide the button if there's no incomplete output
                              if (!isOutputIncomplete)
                                hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                              // There's an incomplete output
                              if (isOutputIncomplete)
                                killProcessTimeout = setTimeout(() => {
                                  killProcessBtn.parent().addClass('show')
                                  setTimeout(() => hintsContainer.addClass('show'), 1000)
                                }, 1500)
                            } catch (e) {}

                            try {
                              if (!isOutputIgnored || blockElement.children('div.output').find('div.incomplete-statement').length != 0)
                                throw 0

                              // The sub output structure UI
                              let element = `
                                    <div class="sub-output info incomplete-statement">
                                      <div class="sub-output-content"><span mulang="incomplete statement has been detected and stopped the execution flow" capitalize-first></span>.</div>
                                    </div>`

                              blockElement.children('div.output').children('div.executing').hide()

                              // Append a `sub-output` element in the output's container
                              blockElement.children('div.output').append($(element).show(function() {
                                $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').addClass('busy')

                                // Apply the chosen language on the UI element after being fully loaded
                                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                                // Execute this code whatever the case is
                                setTimeout(() => {
                                  // Unbind all events regards the actions' buttons of the block
                                  blockElement.find('div.btn[action], div.btn[sub-action]').unbind()

                                  // Clicks the copy button; to copy content in JSON string format
                                  blockElement.find('div.btn[action="copy"]').click(function() {
                                    // Get all sub output elements
                                    let allOutputElements = blockElement.find('div.output').find('div.sub-output').find('div.sub-output-content'),
                                      // Initial group of all output inside the block
                                      outputGroup = []

                                    // Loop through each sub output
                                    allOutputElements.each(function() {
                                      try {
                                        // If the output is not a table then skip this try-catch block
                                        if ($(this).find('div.tabulator').length <= 0)
                                          throw 0

                                        // Push the table's data as JSON
                                        outputGroup.push(Tabulator.findTable($(this).find('div.tabulator')[0])[0].getData())

                                        // Skip the upcoming code
                                        return
                                      } catch (e) {}

                                      // Just get the output's text
                                      outputGroup.push($(this).text())
                                    })

                                    // Get the beautified version of the block's content
                                    let contentBeautified = applyJSONBeautify({
                                        statement: blockElement.find('div.statement div.text').text() || 'No statement',
                                        output: outputGroup
                                      }),
                                      // Get the content's size
                                      contentSize = ByteSize(ValueSize(contentBeautified))

                                    // Copy content to the clipboard
                                    try {
                                      Clipboard.writeText(contentBeautified)
                                    } catch (e) {
                                      try {
                                        errorLog(e, 'connections')
                                      } catch (e) {}
                                    }

                                    // Give feedback to the user
                                    showToast(I18next.capitalize(I18next.t('copy content')), I18next.capitalizeFirstLetter(I18next.replaceData('content has been copied to the clipboard, the size is $data', [contentSize])) + '.', 'success')
                                  })

                                  // Clicks the deletion button
                                  blockElement.find('div.btn[action="delete"]').click(() => {
                                    let queriesContainer = $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`)

                                    setTimeout(function() {
                                      // Remove related query tracing element if exists
                                      blockElement.find('div.btn[sub-action="tracing"]').each(function() {
                                        $(`div.queries div.query[data-session-id="${$(this).attr('data-session-id')}"]`).remove()
                                      })

                                      // If there's still one query tracing result then skip this try-catch block
                                      try {
                                        if (queriesContainer.find('div.query').length > 0)
                                          throw 0

                                        // Show the emptiness class
                                        queriesContainer.addClass('_empty')

                                        // Play the emptiness animation
                                        queriesContainer.find('lottie-player')[0].play()
                                      } catch (e) {}
                                    }, 500)

                                    // Remove the block from the session
                                    blockElement.remove()

                                    try {
                                      // Point at the session's statements' container
                                      let sessionContainer = $(`#_${cqlshSessionContentID}_container`)

                                      // If there's still one block then skip this try-catch block
                                      if (sessionContainer.find('div.block').length > 0)
                                        throw 0

                                      // Show the emptiness class
                                      sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                                    } catch (e) {}
                                  })
                                })

                                setTimeout(() => {
                                  try {
                                    blockElement.parent().animate({
                                      scrollTop: blockElement.parent().get(0).scrollHeight
                                    }, 100)
                                  } catch (e) {}
                                }, 100)
                              }))

                              return
                            } catch (e) {}


                            // If no output has been detected then skip this try-catch block
                            if (!finalContent.includes('KEYWORD:OUTPUT:COMPLETED:ALL'))
                              throw 0

                            // Get the detected output of each statement
                            let detectedOutput = finalContent.match(/([\s\S]*?)KEYWORD:OUTPUT:COMPLETED:ALL/gm)

                            // Handle all statements and their output
                            try {
                              // Loop through each detected output
                              for (let output of detectedOutput) {
                                // Make sure to remove the current handled output
                                blocksOutput[data.blockID] = blocksOutput[data.blockID].replace(output, '')

                                // Point at the output's container
                                let outputContainer = blockElement.children('div.output'),
                                  // Define a regex to match each output of each statement
                                  statementOutputRegex = /KEYWORD:OUTPUT:STARTED([\s\S]*?)KEYWORD:OUTPUT:COMPLETED/gm,
                                  // Define variable to initially hold the regex's match
                                  matches,
                                  // The index of loop's pointer
                                  loopIndex = -1

                                // Loop through the final content and match output
                                while ((matches = statementOutputRegex.exec(output)) !== null) {
                                  // Increase the loop; to match the identifier of the current output's statement
                                  loopIndex = loopIndex + 1

                                  // Point at the current identifier
                                  let statementIdentifier = statementsIdentifiers[loopIndex]

                                  // Avoid infinite loops with zero-width matches
                                  if (matches.index === statementOutputRegex.lastIndex)
                                    statementOutputRegex.lastIndex++

                                  // Loop through each matched part of the output
                                  matches.forEach((match, groupIndex) => {
                                    // Ignore specific group
                                    if (groupIndex != 1)
                                      return

                                    // Whether or not an error has been found in the output
                                    let isErrorFound = `${match}`.indexOf('KEYWORD:ERROR:STARTED') != -1,
                                      isOutputInfo = `${match}`.indexOf('[OUTPUT:INFO]') != -1

                                    // Refresh the latest metadata based on specific actions and only if no erorr has occurred
                                    try {
                                      if (['alter', 'create', 'drop'].some((type) => statementIdentifier.toLowerCase().indexOf(type) != -1 && !isErrorFound)) {
                                        // Make sure to clear the previous timeout
                                        try {
                                          clearTimeout(refreshMetadataTimeout)
                                        } catch (e) {}

                                        // Set the timeout to be triggerd and refresh the metadata
                                        refreshMetadataTimeout = setTimeout(() => $(`div.btn[data-id="${refreshMetadataBtnID}"]`).click(), 1000)
                                      }
                                    } catch (e) {}

                                    // The sub output structure UI
                                    let element = `
                                          <div class="sub-output ${isErrorFound ? 'error' : ''} ${isOutputInfo ? 'info': ''}">
                                            <div class="sub-output-content"></div>
                                            <div class="sub-actions" hidden>
                                              <div class="sub-action btn btn-tertiary" data-mdb-ripple-color="dark" sub-action="download" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Download the block" data-mulang="download the block" capitalize-first>
                                                <ion-icon name="download"></ion-icon>
                                              </div>
                                              <div class="download-options">
                                                <div class="option btn btn-tertiary" option="csv" data-mdb-ripple-color="dark">
                                                  <ion-icon name="csv"></ion-icon>
                                                </div>
                                                <div class="option btn btn-tertiary" option="pdf" data-mdb-ripple-color="dark">
                                                  <ion-icon name="pdf"></ion-icon>
                                                </div>
                                              </div>
                                              <div class="sub-action btn btn-tertiary disabled" data-mdb-ripple-color="dark" sub-action="tracing" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Trace the query" data-mulang="trace the query" capitalize-first>
                                                <ion-icon name="query-tracing"></ion-icon>
                                              </div>
                                            </div>
                                          </div>`

                                    outputContainer.children('div.executing').hide()

                                    // Append a `sub-output` element in the output's container
                                    outputContainer.append($(element).show(function() {
                                      // Point at the appended element
                                      let outputElement = $(this)

                                      // Apply the chosen language on the UI element after being fully loaded
                                      setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                                      // If the number of executed statements are more than `1` then show a badge indicates that
                                      setTimeout(() => {
                                        try {
                                          // Get the number of statements in the current block based on how many sub output elements exist
                                          let numberOfStatements = outputContainer.find('div.sub-output').length

                                          // If it's less than `2` then hide the badge
                                          if (numberOfStatements < 2)
                                            throw 0

                                          // Show the badge with the number of statements
                                          blockElement.find('div.statements-count').text(`${numberOfStatements} statements`).hide().fadeIn('fast')
                                        } catch (e) {
                                          // Hide the badge
                                          blockElement.find('div.statements-count').hide()
                                        }
                                      }, 500)

                                      /**
                                       * Reaching here with `match` means this is an output to be rendered
                                       *
                                       * Manipulate the content
                                       * Remove any given prompts within the output
                                       */
                                      match = match.replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')
                                        // Remove the statement from the output
                                        .replace(new RegExp(quoteForRegex(blockElement.children('div.statement').text()), 'g'), '')
                                        // Get rid of tracing results
                                        .replace(/Tracing\s*session\:[\S\s]+/gi, '')
                                        // Trim the output
                                        .trim()

                                      // Make sure to show the emptiness message if the output is empty
                                      if (minifyText(match).replace(/nooutputreceived\./g, '').length <= 0)
                                        match = noOutputElement

                                      // Define the JSON string which will be updated if the output has valid JSON block
                                      let jsonString = '',
                                        // Define the tabulator object if one is created
                                        tabulatorObject = null,
                                        connectionLost = `${match}`.indexOf('NoHostAvailable:') != -1

                                      // Handle if the content has JSON string
                                      try {
                                        // If the statement is not `SELECT` then don't attempt to render a table
                                        if (statementIdentifier.toLowerCase().indexOf('select') <= -1 || connectionLost)
                                          throw 0

                                        // Deal with the given output as JSON string by default
                                        jsonString = manipulateOutput(match).match(/\{[\s\S]+\}/gm)[0]

                                        if (OS.platform() == 'win32')
                                          jsonString = jsonString.replace(/\\"/g, `\"`)

                                        // Repair the JSON to make sure it can be converted to JSON object easily
                                        try {
                                          jsonString = JSONRepair(jsonString)
                                        } catch (e) {}

                                        // Convert the JSON string to HTML table related to a Tabulator object
                                        convertTableToTabulator(jsonString, outputElement.find('div.sub-output-content'), (_tabulatorObject) => {
                                          // As a tabulator object has been created add the associated class
                                          outputElement.find('div.sub-actions').attr('hidden', null)

                                          outputElement.addClass('actions-shown')

                                          // Hold the created object
                                          tabulatorObject = _tabulatorObject
                                        })

                                        try {
                                          $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').toggleClass('busy', isOutputIncomplete)

                                          try {
                                            clearTimeout(killProcessTimeout)
                                          } catch (e) {}

                                          if (!isOutputIncomplete)
                                            hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                                          if (isOutputIncomplete)
                                            killProcessTimeout = setTimeout(() => {
                                              killProcessBtn.parent().addClass('show')

                                              setTimeout(() => hintsContainer.addClass('show'), 1000)
                                            }, 1500)
                                        } catch (e) {}

                                        // Show the block
                                        blockElement.show().addClass('show')

                                        // Scroll at the bottom of the blocks' container after each new block
                                        setTimeout(() => {
                                          try {
                                            blockElement.parent().animate({
                                              scrollTop: blockElement.parent().get(0).scrollHeight
                                            }, 100)
                                          } catch (e) {}
                                        }, 100)

                                        // Skip the upcoming code
                                        return
                                      } catch (e) {} finally {
                                        // Execute this code whatever the case is
                                        setTimeout(() => {
                                          // Unbind all events regards the actions' buttons of the block
                                          blockElement.find('div.btn[action], div.btn[sub-action]').unbind()

                                          // Clicks the copy button; to copy content in JSON string format
                                          blockElement.find('div.btn[action="copy"]').click(function() {
                                            // Get all sub output elements
                                            let allOutputElements = blockElement.find('div.output').find('div.sub-output').find('div.sub-output-content'),
                                              // Initial group of all output inside the block
                                              outputGroup = []

                                            // Loop through each sub output
                                            allOutputElements.each(function() {
                                              try {
                                                // If the output is not a table then skip this try-catch block
                                                if ($(this).find('div.tabulator').length <= 0)
                                                  throw 0

                                                // Push the table's data as JSON
                                                outputGroup.push(Tabulator.findTable($(this).find('div.tabulator')[0])[0].getData())

                                                // Skip the upcoming code
                                                return
                                              } catch (e) {}

                                              // Just get the output's text
                                              outputGroup.push($(this).text())
                                            })

                                            // Get the beautified version of the block's content
                                            let contentBeautified = applyJSONBeautify({
                                                statement: blockElement.find('div.statement div.text').text() || 'No statement',
                                                output: outputGroup
                                              }),
                                              // Get the content's size
                                              contentSize = ByteSize(ValueSize(contentBeautified))

                                            // Copy content to the clipboard
                                            try {
                                              Clipboard.writeText(contentBeautified)
                                            } catch (e) {
                                              try {
                                                errorLog(e, 'connections')
                                              } catch (e) {}
                                            }

                                            // Give feedback to the user
                                            showToast(I18next.capitalize(I18next.t('copy content')), I18next.capitalizeFirstLetter(I18next.replaceData('content has been copied to the clipboard, the size is $data', [contentSize])) + '.', 'success')
                                          })

                                          // Clicks the download button; to download the tabulator object either as PDF or CSV
                                          outputElement.find('div.btn[sub-action="download"]').click(function() {
                                            // Point at the download options' container
                                            let downloadOptionsElement = outputElement.find('div.download-options'),
                                              // Whether or not the optionss' container is hidden
                                              isOptionsHidden = downloadOptionsElement.css('display') == 'none'

                                            // Show/hide the container
                                            downloadOptionsElement.css('display', isOptionsHidden ? 'flex' : 'none')
                                          })

                                          // Handle the download options
                                          {
                                            // Download the table as CSV
                                            outputElement.find('div.option[option="csv"]').click(() => tabulatorObject.download('csv', 'statement_block.csv'))

                                            // Download the table as PDF
                                            outputElement.find('div.option[option="pdf"]').click(() => tabulatorObject.download('pdf', 'statement_block.pdf', {
                                              orientation: 'portrait',
                                              title: `${blockStatement}`,
                                            }))
                                          }

                                          // Handle the clicks of the tracing button
                                          {
                                            // Point at the tracing button
                                            let tracingButton = outputElement.find('div.btn[sub-action="tracing"]')

                                            setTimeout(() => {
                                              // Get the session's tracing ID
                                              let sessionID

                                              try {
                                                sessionID = detectedSessionsID.filter((sessionID) => sessionID != null)[0]
                                              } catch (e) {}

                                              try {
                                                // If there's no session ID exists then skip this try-catch block
                                                if (sessionID == undefined)
                                                  throw 0

                                                tracingButton.attr('data-session-id', sessionID)

                                                detectedSessionsID = detectedSessionsID.map((_sessionID) => _sessionID == sessionID ? null : _sessionID)

                                                // Enable the tracing button
                                                tracingButton.removeClass('disabled')

                                                // Add listener to the `click` event
                                                tracingButton.click(() => clickEvent(true, sessionID))
                                              } catch (e) {}
                                            }, 2000)

                                            // Clicks the deletion button
                                            blockElement.find('div.btn[action="delete"]').click(() => {
                                              let queriesContainer = $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`)

                                              setTimeout(function() {
                                                // Remove related query tracing element if exists
                                                blockElement.find('div.btn[sub-action="tracing"]').each(function() {
                                                  $(`div.queries div.query[data-session-id="${$(this).attr('data-session-id')}"]`).remove()
                                                })

                                                // If there's still one query tracing result then skip this try-catch block
                                                try {
                                                  if (queriesContainer.find('div.query').length > 0)
                                                    throw 0

                                                  // Show the emptiness class
                                                  queriesContainer.addClass('_empty')

                                                  // Play the emptiness animation
                                                  queriesContainer.find('lottie-player')[0].play()
                                                } catch (e) {}
                                              }, 500)

                                              // Remove the block from the session
                                              blockElement.remove()

                                              try {
                                                // Point at the session's statements' container
                                                let sessionContainer = $(`#_${cqlshSessionContentID}_container`)

                                                // If there's still one block then skip this try-catch block
                                                if (sessionContainer.find('div.block').length > 0)
                                                  throw 0

                                                // Show the emptiness class
                                                sessionContainer.parent().find(`div.empty-statements`).addClass('show')
                                              } catch (e) {}
                                            })
                                          }
                                        })
                                      }

                                      // Manipulate the content
                                      match = match.replace(new RegExp(`(${OS.EOL}){2,}`, `g`), OS.EOL)
                                        .replace(createRegex(OS.EOL, 'g'), '<br>')
                                        .replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br>')
                                        .replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')
                                        .replace('[OUTPUT:INFO]', '')
                                        .replace(/\r?\n?KEYWORD:([A-Z0-9]+)(:[A-Z0-9]+)*((-|:)[a-zA-Z0-9\[\]\,]+)*\r?\n?/gmi, '')

                                      // Convert any ANSI characters to HTML characters - especially colors -
                                      match = (new ANSIToHTML()).toHtml(match)

                                      // Reaching here and has a `json` keyword in the output means there's no record/row to be shown
                                      if (match.includes('[json]') || StripTags(match).length <= 0)
                                        match = '<no-output><span mulang="CQL statement executed" capitalize-first></span>.</no-output>'

                                      // Set the final content and make sure the localization process is updated
                                      outputElement.find('div.sub-output-content').html(`<pre>${match}</pre>`).show(function() {
                                        $(this).children('pre').find('br').remove()

                                        // Apply the localization process on elements that support it
                                        setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                                      })
                                    }))
                                  })
                                }
                              }
                            } catch (e) {}

                            // Show the current active prefix/prompt
                            setTimeout(() => blockElement.find('div.prompt').text(minifyText(prefix).slice(0, -1)).hide().fadeIn('fast'), 1000)

                            try {
                              $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).find('div.execute').toggleClass('busy', isOutputIncomplete)

                              try {
                                clearTimeout(killProcessTimeout)
                              } catch (e) {}

                              if (!isOutputIncomplete)
                                hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                              if (isOutputIncomplete)
                                killProcessTimeout = setTimeout(() => {
                                  killProcessBtn.parent().addClass('show')

                                  setTimeout(() => hintsContainer.addClass('show'), 1000)
                                }, 1500)
                            } catch (e) {}

                            // Show the block
                            blockElement.show().addClass('show')

                            // Make sure to scroll at the end of the blocks' container
                            setTimeout(() => {
                              try {
                                blockElement.parent().animate({
                                  scrollTop: blockElement.parent().get(0).scrollHeight
                                }, 100)
                              } catch (e) {}
                            }, 100)
                          } catch (e) {}

                          try {
                            // Check if the query tracing feature has been enabled/disabled
                            {
                              // Point at the hint UI element in the query tracing's tab
                              let queryTracingHint = $(`div.tab-pane#_${queryTracingContentID}`).find('hint')

                              // If it has been enabled
                              if (data.output.toLowerCase().indexOf('tracing is enabled') != -1) {
                                queryTracingHint.hide()
                                $(`div.tab-pane#_${queryTracingContentID}`).find('lottie-player')[0].play()
                              }

                              // If it has been disabled
                              if (data.output.toLowerCase().indexOf('disabled tracing') != -1)
                                queryTracingHint.show()
                            }
                          } catch (e) {}

                          // Set the prompt which has been got from cqlsh tool
                          activePrefix = ''

                          try {
                            // If it is `null` then skip this try-catch block
                            if (prompt == null && prompt.search('cqlsh>'))
                              throw 0

                            // Got a prompt, adopt it
                            activePrefix = `${prompt[0]} `
                            prefix = activePrefix
                          } catch (e) {}
                        })
                        // The listener to data sent from the pty instance has been finished

                        /**
                         * Listen to the user's input to the terminal's buffer
                         * This listener will send the character to the pty instance to be handled in realtime
                         *
                         * Point at the terminal's viewport in the UI
                         */
                        let terminalViewport = $(`div.terminal-container[data-id="${terminalContainerID}"]`).find('div.xterm-viewport')[0],
                          // Get the terminal's active buffer; to get the entire written statement if needed
                          terminalBuffer = terminal.buffer.active

                        // Listen to data from the user - input to the terminal -
                        terminal.onData((char) => {
                          // Get the entire written statement
                          let statement = terminalBuffer.getLine(terminalBuffer.baseY + terminalBuffer.cursorY).translateToString(true)

                          // Remove any prefixes
                          statement = statement.replace(/([\Ss]+(\@))?cqlsh.*\>\s*/g, '')

                          // Check if the command is terminating the cqlsh session
                          let isQuitFound = (['quit', 'exit']).some((command) => statement.toLowerCase().startsWith(command)),
                            // Get the key code
                            keyCode = char.charCodeAt(0)

                          try {
                            /**
                             * `quit` or `exit` command will close the connection
                             * If none of them were found then skip this try-catch block
                             */
                            if (!isQuitFound)
                              throw 0

                            // Show feedback to the user
                            terminalPrintMessage(terminal, 'info', `Work area for the connection ${getAttributes(clusterElement, 'data-name')} will be closed in few seconds`)

                            // Pause the print of output from the Pty instance
                            isSessionPaused = true

                            // Dispose the readline addon
                            prefix = ''

                            // Click the close connection button after a while
                            setTimeout(() => workareaElement.find('div.cluster-actions div.action[action="close"] div.btn-container div.btn').click(), 2000)
                          } catch (e) {}

                          // Send the character in realtime to the pty instance
                          IPCRenderer.send('pty:data', {
                            id: clusterID,
                            char
                          })

                          // Make sure both the app's UI terminal and the associated pty instance are syned in their size
                          IPCRenderer.send('pty:resize', {
                            id: clusterID,
                            cols: terminal.cols,
                            rows: terminal.rows
                          })

                          // Switch between the key code's values
                          switch (keyCode) {
                            // `ENTER`
                            case 13: {
                              // Scroll to the very bottom of the terminal
                              terminalViewport.scrollTop = terminalViewport.scrollHeight

                              // Resize the terminal
                              fitAddon.fit()
                              break
                            }
                          }
                        })

                        // Listen to custom key event
                        terminal.attachCustomKeyEventHandler((event) => {
                          // Get different values from the event
                          let {
                            key, // The pressed key
                            ctrlKey, // Whether or not the `CTRL` is being pressed
                            shiftKey, // Whether or not the `SHIFT` is being pressed
                            metaKey // Whether or not the `META/WINDOWS/SUPER` key is being pressed
                          } = event

                          // Inner function to prevent the event from performing its defined handler
                          let preventEvent = () => {
                            /**
                             * Prevent the default behavior of pressing the combination
                             * https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault
                             */
                            event.preventDefault()

                            /**
                             * Prevent further propagation of the event in the capturing and bubbling phases
                             * https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation
                             */
                            event.stopPropagation()
                          }

                          // Hande `CTRL+R`
                          try {
                            if (!(ctrlKey && key.toLowerCase() == 'r'))
                              throw 0

                            // Call the inner function
                            preventEvent()

                            // Return `false` to make sure the handler of xtermjs won't be executed
                            return false
                          } catch (e) {}

                          /**
                           * Handle the terminal's buffer clearing process on Windows
                           * `CTRL+L`
                           */
                          try {
                            if (!(ctrlKey && (key.toLowerCase() == 'l')) || OS.platform() != 'win32')
                              throw 0

                            // Call the inner function
                            preventEvent()

                            // Clear the buffer
                            terminal.clear()

                            // Return `false` to make sure the handler of xtermjs won't be executed
                            return false
                          } catch (e) {}

                          /**
                           * Handle the termination of the terminal's session
                           * `CTRL+D`
                           */
                          try {
                            if (!(ctrlKey && key.toLowerCase() == 'd' && !shiftKey))
                              throw 0

                            // Call the inner function
                            preventEvent()

                            // Return `false` to make sure the handler of xtermjs won't be executed
                            return false
                          } catch (e) {}

                          /**
                           * Handle the copying process of selected text in the terminal
                           *
                           * `CTRL+SHIFT+C` for Linux and Windows
                           * `CMD+C` for macOS
                           */
                          try {
                            if (!((ctrlKey && shiftKey && `${key}`.toLowerCase() === 'c') || (metaKey && `${key}`.toLowerCase() === 'c')))
                              throw 0

                            // Call the inner function
                            preventEvent()

                            // Attempt to write the selected text in the terminal
                            try {
                              Clipboard.writeText(terminal.getSelection())
                            } catch (e) {}

                            // Return `false` to make sure the handler of xtermjs won't be executed
                            return false
                          } catch (e) {}
                        })

                        /**
                         * Listen to `keydown` event in the terminal's container
                         * The main reason is to provide the ability to increase/decrease and reset the terminal's font size
                         * Custom event `changefont` has been added, it will be triggered when the app's zooming level is changing
                         */
                        setTimeout(() => {
                          try {
                            if (OS.platform() == 'darwin')
                              throw 0

                            workareaElement.find('div.terminal.xterm').on('keydown changefont', function(e, keyCode = null) {
                              // If the `CTRL` key is not pressed or `CTRL` and `SHIFT` are being pressed together then skip this try-catch block
                              if ((!e.ctrlKey && e.type != 'changefont') || e.shiftKey)
                                return true

                              // If the event type is `changefont` then the keycode is provided in variable `keyCode`
                              if (e.type == 'changefont')
                                e.keyCode = keyCode

                              // Switch between the `keyCode` values
                              switch (e.keyCode) {
                                // `+` Increase the font size
                                case 187: {
                                  terminal.options.fontSize += 1
                                  break
                                }
                                // `-` Decrease the font size
                                case 189: {
                                  terminal.options.fontSize -= 1
                                  break
                                }
                                // `0` reset the font size
                                case 48: {
                                  terminal.options.fontSize = 13
                                  break
                                }
                              }

                              // Prevent any default behavior
                              e.preventDefault()
                            })
                          } catch (e) {}
                        }, 1000)
                      })
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }
                    // End of handling the app's terminal
                    /*
                     * Point at killing the current process
                     * Point at the CQLSH session's overall container
                     */
                    let cqlshSessionTabContainer = $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`),
                      killProcessBtn = cqlshSessionTabContainer.find('div.kill-process button'),
                      hintsContainer = cqlshSessionTabContainer.find('div.hints-container'),
                      killProcessTimeout

                    // This block of code for the interactive terminal
                    {
                      /**
                       * Define variables and inner functions to be used in the current scope
                       *
                       * Point at the CQLSH interactive terminal's session's main container
                       */
                      let sessionContainer = $(`#_${cqlshSessionContentID}_container`),
                        // Point at the statement's input field
                        statementInputField = $(`textarea#_${cqlshSessionStatementInputID}`),
                        // Point at the interactive terminal's container
                        interactiveTerminal = $(`div[data-id="${terminalContainerID}_interactive"]`),
                        // Point at the basic terminal's container
                        basicTerminal = $(`div[data-id="${terminalContainerID}"]`),
                        // Point at the suggestions' list - at the very bottom of the statement's input field -
                        suggestionsList = cqlshSessionTabContainer.find('div.bottom div.suggestions-list'),
                        // Point at the realtime suggestion's element
                        realtimeSuggestion = statementInputField.parent().find('div.suggestion'),
                        /**
                         * Point at different buttons related to the current scope
                         *
                         * Point at the terminal's switching button - at the top-right of the cqlsh session -
                         */
                        switchTerminalBtn = cqlshSessionTabContainer.find(`div.switch-terminal button`),
                        // Point at the statement's execution button
                        executeBtn = cqlshSessionTabContainer.find('div.execute button'),
                        // Hold the last saved important data
                        lastData = {
                          cursorPosition: -1,
                          closestWord: '',
                          suggestion: '',
                          history: -1
                        }

                      /**
                       * Inner function to get the closest word to the cursor
                       * Used while the user is updating the statement's input field
                       *
                       * @Parameters:
                       * {object} `textarea` the textarea HTML element
                       *
                       * @Return: {string} the matched content, or an empty value if there's no string close to the cursor
                       */
                      let getClosestWord = (textarea) => {
                        // Get the cursor's current position
                        let cursorPosition = textarea.selectionStart

                        /**
                         * If the user is currently selecting something then return an empty value
                         * The reason is by selecting something while the function is executing will lead to get incorrect values about the cursor's position
                         */
                        if (textarea.selectionEnd !== cursorPosition)
                          return ''

                        // Get the content of the textarea up to the cursor position
                        let textBeforeCursor = textarea.value.slice(0, cursorPosition),
                          // Do a matching process; which is getting the last string in the line that has a space right before it
                          match = /\S+$/.exec(textBeforeCursor)

                        // If there's a value from the matching process then return it, otherwise return an empty value
                        return match ? match[0] : ''
                      }

                      /**
                       * Inner function to get important info from the latest metadata
                       *
                       * @Return: {object} the fetched info from the latest metadata as JSON object
                       */
                      let getMetadataInfo = () => {
                        // Define the final result to be returned
                        let result = {}

                        try {
                          // Get the keyspaces names and their tables' names
                          let keyspaces = latestMetadata.keyspaces.map((keyspace) => {
                            return {
                              name: keyspace.name,
                              tables: keyspace.tables
                            }
                          })

                          // Loop through each keyspace and set its tables' names in array
                          for (let keyspace of keyspaces)
                            result[keyspace.name] = keyspace.tables.map((table) => table.name)
                        } catch (e) {}

                        // Return the final result
                        return result
                      }

                      /**
                       * Apply the auto size feature for the statement's input field
                       * This will simply increase and decrease the height based on the input's value
                       */
                      AutoSize(statementInputField[0])

                      // Clicks the terminal's switching button
                      switchTerminalBtn.click(function(event, onlyInit = false) {
                        try {
                          // If the basic terminal is already shown then skip this try-catch block
                          if (basicTerminal.css('display') != 'none')
                            throw 0

                          try {
                            // If the terminal has already been initialized then skip this try-catch block
                            if (basicTerminal.attr('data-initialized') == 'true')
                              throw 0

                            // Reset the terminal's buffer - will clear it with the prompt -
                            terminal.reset()

                            // Send multiple `EOL` chars at the same time; to make sure the messy buffer is completely cleared
                            setTimeout(() => {
                              // Define the variable which will hold all the `EOL` chars
                              let charEOL = ''; // This semicolon is critical here

                              // Get 20x of `EOL` char
                              (new Array(20).fill('')).forEach((_) => {
                                charEOL += OS.EOL
                              })

                              // Send it at once to the basic terminal
                              IPCRenderer.send('pty:data', {
                                id: clusterID,
                                char: charEOL
                              })

                              // Clear the screen again but with the prompt this time
                              setTimeout(() => terminal.clear(), 1000)
                            })

                            // Update the attribute; to not perform this process again
                            basicTerminal.attr('data-initialized', 'true')
                          } catch (e) {}

                          // If the process is only initialization then skip the upcoming code
                          if (onlyInit)
                            return

                          // Show the basic terminal
                          basicTerminal.show()

                          // Hide the interactive terminal
                          interactiveTerminal.hide()
                        } catch (e) {
                          /**
                           * Reaching here means the basic terminal is already shown
                           *
                           * Show the interactive terminal
                           */
                          interactiveTerminal.show()

                          // Hide the basic terminal
                          basicTerminal.hide()
                        } finally {
                          // Trigger the `resize` event regardless the shown and hidden terminal
                          setTimeout(() => $(window.visualViewport).trigger('resize'), 50)
                        }
                      })

                      let blockID

                      // Clicks the statement's execution button
                      executeBtn.click(function() {
                        // If the button is disabled then skip the upcoming code and end the process
                        if ($(this).attr('disabled') != undefined || $(this).parent().hasClass('busy'))
                          return

                        // Get the statement
                        let statement = statementInputField.val()

                        // Get a random ID for the block which will be created
                        blockID = getRandomID(10)

                        // Clear the statement's input field and make sure it's focused on it
                        setTimeout(() => statementInputField.val('').trigger('input').focus().attr('style', null))

                        try {
                          if (!((['quit', 'exit']).some((command) => minifyText(statement).startsWith(minifyText(command)))))
                            throw 0

                          // Show it in the interactive terminal
                          addBlock($(`#_${cqlshSessionContentID}_container`), getRandomID(10), `Work area for the connection ${getAttributes(clusterElement, 'data-name')} will be closed in few seconds`, null, true, 'neutral')

                          // Pause the print of output from the Pty instance
                          isSessionPaused = true

                          // Dispose the readline addon
                          prefix = ''

                          // Click the close connection button after a while
                          setTimeout(() => workareaElement.find('div.cluster-actions div.action[action="close"] div.btn-container div.btn').click(), 2000)

                          // Skip the upcoming code in the execution button
                          return
                        } catch (e) {}

                        executeBtn.parent().addClass('busy')

                        {
                          try {
                            clearTimeout(killProcessTimeout)
                          } catch (e) {}

                          hintsContainer.add(killProcessBtn.parent()).removeClass('show')

                          killProcessTimeout = setTimeout(() => {
                            killProcessBtn.parent().addClass('show')

                            setTimeout(() => hintsContainer.addClass('show'), 1000)
                          }, 1500)
                        }

                        // Add the block
                        addBlock(sessionContainer, blockID, statement, (element) => {
                          // Add the statement to the cluster's history space
                          {
                            // Get current saved statements
                            let history = Store.get(clusterID) || []

                            /**
                             * Maximum allowed statements to be saved are 30 for each cluster
                             * When this value is exceeded the oldest statement should be removed
                             */
                            if (history.length >= 30)
                              history.pop()

                            // Add the statement at the very beginning of the array
                            history.unshift(statement)

                            // Remove any duplication
                            Store.set(clusterID, [...new Set(history)])

                            // Enable the history button
                            workareaElement.find('div.history').find('button.btn').attr('disabled', null)

                            // Reset the history current index
                            lastData.history = -1
                          }

                          // Handle when the statement is `SELECT` but there's no `JSON` after it
                          try {
                            if (!(Modules.Consts.CQLRegexPatterns.Select.Patterns.some((pattern) => pattern.test(statement))))
                              throw 0

                            // Regex pattern to match 'SELECT' not followed by 'JSON'
                            let pattern = /\bselect\b(?!\s+json\b)/gi

                            // Replace 'SELECT' with 'SELECT JSON' if 'JSON' is not already present
                            statement = statement.replace(pattern, 'SELECT JSON')
                          } catch (e) {}

                          // Send the command to the main thread to be executed
                          IPCRenderer.send('pty:command', {
                            id: clusterID,
                            cmd: statement,
                            blockID
                          })
                        })
                      })

                      killProcessBtn.click(function() {
                        IPCRenderer.send('pty:command', {
                          id: clusterID,
                          cmd: `KEYWORD:STATEMENT:IGNORE-${Math.floor(Math.random() * 999) + 1}`,
                          blockID
                        })
                      }).hover(() => hintsContainer.hide(), () => hintsContainer.show())

                      // The statement's input field's value has been updated
                      statementInputField.on('input', function() {
                        // Get the statement's content
                        let statement = $(this).val(),
                          // Get the closest word to the cursor in the input field
                          closestWord = getClosestWord($(this)[0]),
                          /**
                           * Whether or not the content has multiple lines
                           * In case it has, the suggestions and autocomplete feature will be temporary disabled
                           */
                          isMultipleLines = $(this).val().match(new RegExp(OS.EOL, 'g')) != null

                        // Enable and disable the execution button based set conditions
                        {
                          // Minify the statement
                          let minifiedStatement = minifyText(statement),
                            /**
                             * Whether or not the statement is a CQLSH command
                             * In this case, the statement doesn't need semi colon `;` at the end
                             */
                            isCQLSHCommand = Modules.Consts.CQLSHCommands.some((command) => minifiedStatement.startsWith(minifyText(command))),
                            // Whether or not the statement is quitting the cqlsh session
                            isQuitCommand = (['quit', 'exit']).some((command) => minifiedStatement.startsWith(minifyText(command))),
                            // Decide whether or not the execution button should be disabled
                            isExecutionButtonDisabled = minifiedStatement.length <= 0 || ((!isCQLSHCommand && !isQuitCommand) && !minifiedStatement.endsWith(';'))

                          // Disable/enable the execution button
                          executeBtn.attr('disabled', isExecutionButtonDisabled ? '' : null)
                        }

                        /**
                         * Update some of the saved data
                         *
                         * Update the latest saved cursor's position
                         */
                        lastData.cursorPosition = $(this)[0].selectionEnd

                        // The default array for suggestions is the CQL keywords with the commands
                        let suggestionsArray = Modules.Consts.CQLKeywords.concat(Modules.Consts.CQLSHCommands),
                          // Get the keyspaces and their tables from the last metadata
                          metadataInfo = getMetadataInfo(),
                          // Get keyspaces' names
                          keyspaces = Object.keys(metadataInfo),
                          // Flag to tell if keyspace has been found and it's time to suggest its tables
                          isKeyspace = false,
                          // Flag to tell if suggestions should be the keyspaces only
                          isSuggestKeyspaces = false

                        try {
                          /**
                           * Determine whether or not keyspaces and their tables should be shown as suggestions
                           *
                           * Get the content before the cursor's position
                           */
                          let contentBeforeCursor = statement.slice(0, lastData.cursorPosition)

                          // Check the content against defined regex patterns
                          isSuggestKeyspaces = Object.keys(Modules.Consts.CQLRegexPatterns).some((type) => Modules.Consts.CQLRegexPatterns[type].Patterns.some((regex) => $(this).val().slice(0, lastData.cursorPosition).match(regex) != null))

                          // If the closest word to the cursor doesn't have `.` then skip this try-catch block
                          if (!isSuggestKeyspaces || !closestWord.includes('.'))
                            throw 0

                          // Get the recognized keyspace name
                          let keyspace = closestWord.slice(0, closestWord.indexOf('.')),
                            // Attempt to get its tables
                            tables = metadataInfo[keyspace]

                          // If the attempt failed then skip this try-catch block
                          if (tables == undefined)
                            throw 0

                          /**
                           * Update associated variables
                           *
                           * Update the flag to be `true`
                           */
                          isKeyspace = true

                          // Update the suggestions' array
                          suggestionsArray = tables

                          // Update the closest word to be what after `.`
                          closestWord = closestWord.slice(closestWord.indexOf('.') + 1)
                        } catch (e) {}

                        // Update the latest saved closest word to the cursor
                        lastData.closestWord = closestWord

                        // Get the suggestions based on the closest word
                        let suggestions = suggestionSearch(closestWord, (isSuggestKeyspaces && !isKeyspace) ? keyspaces : suggestionsArray)

                        // Keep related suggestions and remove the rest
                        try {
                          // If there's no such a suggestion then skip this try-catch block
                          if (typeof suggestions == 'string' || suggestions.length <= 0)
                            throw 0

                          // Remove all current suggestions
                          suggestionsList.children('span.suggestion').each(function() {
                            // Reset the selection attribute
                            $(this).attr('data-selected', 'false')

                            // If the suggestion is related then skip the upcoming code and move to the next suggestion
                            if (suggestions.includes($(this).attr('data-suggestion')) || suggestions == $(this).attr('data-suggestion'))
                              return

                            // Suggestion is not related, remove it
                            $(this).remove()
                          })
                        } catch (e) {
                          suggestionsList.children('span.suggestion').remove()
                        }

                        // Reset the realtime suggestion's text
                        realtimeSuggestion.text('')

                        // If the statement has multiple lines, or there's no close word to the cursor and there's no keyspace name recognized then remove all related suggestions and stop this feature
                        if (isMultipleLines || (minifyText(closestWord).length <= 0 && !isKeyspace && !isSuggestKeyspaces))
                          return suggestionsList.children('span.suggestion').remove()

                        // Manipulate the received suggestions
                        {
                          // Define index to be used with the appended suggestions
                          let index = 0

                          // Loop through each received suggestion
                          for (let suggestion of suggestions) {
                            // Whether or not the `suggestions` is actually one `string` suggestion not an array
                            let isSuggestionString = typeof suggestions == 'string'

                            // If there's only one suggestion then handle it
                            if (isSuggestionString)
                              suggestion = suggestions

                            // If the suggestion already exist in the UI then skip the appending process and move to the next suggestion
                            if (suggestionsList.children(`span.suggestion[data-suggestion="${suggestion}"]`).length != 0)
                              continue

                            // The suggestion UI structure
                            let element = `
                                <span class="btn suggestion badge rounded-pill ripple-surface-light" data-index="${index}" data-suggestion="${suggestion}" data-selected="false" data-mdb-ripple-color="light" style="display:none">${suggestion}</span>`

                            // Append the suggestion and handle the `click` event
                            suggestionsList.append($(element).delay(50 * index).fadeIn(100 * (index + 1)).click(function() {
                              // Reset the selection state of all suggestions
                              suggestionsList.children('span.suggestion').attr('data-selected', 'false')

                              /**
                               * If the clicked suggestion has a sibling before it then select it
                               * As `TAB` key will autocomplete the subling right after the selected one
                               */
                              if ($(this).prev().length > 0)
                                $(this).prev().attr('data-selected', 'true')

                              // Trigger the `keydown` event with `isVirtual` set to `true`
                              statementInputField.trigger('keydown', true)
                            }))

                            // If there's only one suggestion then end this loop
                            if (isSuggestionString)
                              break

                            // Increment the index
                            index += 1
                          }
                        }

                        // If there's no suggestion received then skip the upcoming code and end the process
                        if (suggestions.length <= 0)
                          return

                        // Define the final suggestion text which will be rendered in the realtime suggestion's UI element
                        let suggestionText = '',
                          // Get the textarea/statement value and split it to characters
                          textareaValue = $(this).val().split('')

                        // Loop through the characters, add them to the suggestion's text
                        for (let i = 0; i < $(this)[0].selectionEnd; i++)
                          suggestionText += `<span style="color:transparent;">${textareaValue[i]}</span>`

                        // Define the selected suggestion to be adopted
                        let selectedSuggestion = typeof suggestions == 'string' ? suggestions : suggestions[0]

                        // Set the suggestion's text to be lower case if needed
                        if (`${closestWord.at(-1)}` != `${closestWord.at(-1)}`.toUpperCase())
                          selectedSuggestion = selectedSuggestion.toLowerCase()

                        // Update the realtime suggestion's text
                        realtimeSuggestion.html(`${suggestionText}${selectedSuggestion.slice(closestWord.length)}`)

                        // Reset the suggestion's index
                        currentSuggestionIndex = -1

                        // Key is pressed while the textarea is focused
                      }).keydown(function(event, isVirtual = false) {
                        // Get the pressed key's code
                        let keyCode = event.keyCode

                        // If the pressed key is not `TAB` then trigger the `input` event for the textarea
                        if (keyCode != 9)
                          setTimeout(() => $(this).trigger('input', false))

                        // `UP Arrow` and `DOWN Arrow` key press/down
                        try {
                          if (!(keyCode == 38 && event.ctrlKey) && !(keyCode == 40 && event.ctrlKey))
                            throw 0

                          // Flag to tell if the pressed key is the `UP Arrow` key
                          let isUpArrow = keyCode == 38

                          // Prevent the default behavior for this key pressing event
                          event.preventDefault()

                          // Get the saved statements
                          let history = Store.get(clusterID) || []

                          // If there's no saved history then simply skip this try-catch block
                          if (history.length <= 0)
                            throw 0

                          // Increment/decrement the current history's index based on the pressed key
                          lastData.history += isUpArrow ? 1 : -1

                          // Get the selected statement
                          let statement = history[lastData.history]

                          // If the statement is `undefined` then the index is out of range
                          if (statement == undefined) {
                            // Normalize the index
                            lastData.history = isUpArrow ? 0 : history.length - 1

                            // Update the selected statement
                            statement = history[lastData.history]
                          }

                          // Remove any realtime suggestions
                          realtimeSuggestion.text('')

                          // Update the textarea's content and focus
                          $(this).val(statement).trigger('input').focus()

                          // Update the size of the textarea
                          AutoSize.update($(this)[0])
                        } catch (e) {}

                        // `ENTER` key press/down
                        try {
                          if (keyCode != 13 || event.shiftKey)
                            throw 0

                          // Prevent the default behavior for this key pressing event
                          event.preventDefault()

                          // Click the statement's execution button
                          executeBtn.trigger('click')
                        } catch (e) {}

                        // `TAB` key press/down
                        try {
                          if (keyCode != 9 && !isVirtual)
                            throw 0

                          // Prevent the default behavior for this key pressing event
                          event.preventDefault()

                          // Reset the realtime suggestion's text
                          realtimeSuggestion.text('')

                          // Get the current selected suggestion's index
                          let currentSelectedSuggestionIndex = suggestionsList.children('span.suggestion[data-selected="true"]').index()

                          /**
                           * Manipulate the selected suggestion's index
                           * If the current selected suggestion's index is `-1` - no suggestion is selected -, or the current selected one is acutally the last one then adopt the first suggestion
                           * Otherwise increase the current index by 1
                           */
                          currentSelectedSuggestionIndex = (currentSelectedSuggestionIndex <= -1 || (currentSelectedSuggestionIndex + 1) >= suggestionsList.children('span.suggestion').length) ? 0 : (currentSelectedSuggestionIndex + 1)

                          // Get the final selected suggestion's UI element
                          let selectedSuggestion = suggestionsList.children('span.suggestion').eq(currentSelectedSuggestionIndex)

                          // Reset the selection state of all suggestions
                          suggestionsList.children('span.suggestion').attr('data-selected', 'false')

                          // The selected suggestion's attribute would be set to be `true`
                          selectedSuggestion.attr('data-selected', 'true')

                          // Get the selected suggestion's content/text
                          let selectedSuggestionContent = selectedSuggestion.attr('data-suggestion'),
                            // Get the statement/textarea's content/text
                            currentStatementContent = $(this).val()

                          // Set the suggestion's text to be lower case if needed
                          if (lastData.closestWord.at(-1) != `${lastData.closestWord.at(-1) || ''}`.toUpperCase())
                            selectedSuggestionContent = selectedSuggestionContent.toLowerCase()

                          // Update the selected suggestion's content by slicing what already has been typed by the user
                          selectedSuggestionContent = selectedSuggestionContent.slice(lastData.closestWord.length)

                          // Define initially the suggestion's prefix content
                          let suggestionPrefixContent = currentStatementContent.slice(lastData.cursorPosition)

                          // Update the prefix content by remove the previous suggestion if it already has been added
                          if (suggestionPrefixContent.indexOf(lastData.suggestion) != -1)
                            suggestionPrefixContent = `${suggestionPrefixContent.slice(0, suggestionPrefixContent.indexOf(lastData.suggestion))}${suggestionPrefixContent.slice(suggestionPrefixContent.indexOf(lastData.suggestion) + lastData.suggestion.length)}`

                          // Update the statement's text/content
                          currentStatementContent = `${currentStatementContent.slice(0, lastData.cursorPosition)}${selectedSuggestionContent}${suggestionPrefixContent}`

                          // Update the last saved suggestion
                          lastData.suggestion = `${selectedSuggestionContent}`

                          // Set the final statement's text/content
                          $(this).val(currentStatementContent).focus()

                          // Update the cursor's position inside the textarea
                          {
                            // Define the updated cursor's position
                            let cursorPosition = lastData.cursorPosition + selectedSuggestionContent.length

                            // Set it inside the textarea
                            $(this)[0].setSelectionRange(cursorPosition, cursorPosition)
                          }
                        } catch (e) {}
                      })
                    }
                    // End of hanlding the interactive terminal

                    // Handle the bash session only if the cluster is a sandbox project
                    try {
                      if (!isSandbox)
                        throw 0

                      // Put the code inside curly brackets to reduce its scope and make sure to not affect the rest of the code
                      {
                        // Define global variables to be used in this code block
                        let terminalBash, // The XTermJS object for Bash
                          fitAddonBash, // Used for resizing the terminal and making it responsive
                          printData = false, // Whether or not the data coming from the pty instances should be printed or not
                          latestCommand = '', // Store the user's input to create a command
                          sessionID = getRandomID(5) // Get a random ID as a suffix to the sandbox project's ID

                        // Create the terminal instance from the XtermJS constructor
                        terminalBash = new XTerm({
                          theme: XTermThemes.Atom
                        })

                        // Add log
                        try {
                          addLog(`Created a bash session for local cluster ${getAttributes(clusterElement, ['data-id'])}`)
                        } catch (e) {}

                        /**
                         * Custom terminal options
                         *
                         * Change font family to `JetBrains Mono` and set its size and line height
                         * https://www.jetbrains.com/lp/mono/
                         */
                        terminalBash.options.fontFamily = 'Terminal, monospace'
                        terminalBash.options.fontSize = 13
                        terminalBash.options.lineHeight = 1.35

                        // Enable the cursor blink when the terminal is being focused on
                        terminalBash._publicOptions.cursorBlink = true

                        setTimeout(() => {
                          /**
                           * Define XtermJS addons
                           *
                           * Fit addon; to resize the terminal without distortion
                           */
                          fitAddonBash = new FitAddon.FitAddon()

                          /**
                           * Load XtermJS addons
                           *
                           * Load the `Fit` addon
                           */
                          terminalBash.loadAddon(fitAddonBash)

                          // The terminal now will be shown in the UI
                          terminalBash.open($(`div.terminal-container[data-id="${terminalBashContainerID}"]`)[0])

                          // Load the `Canvas` addon
                          terminalBash.loadAddon(new CanvasAddon())

                          // Load the `Webfont` addon
                          terminalBash.loadAddon(new XtermWebFonts())

                          // Fit the terminal with its container
                          setTimeout(() => fitAddonBash.fit(), 1500)

                          // Push the fit addon object to the related array
                          terminalFitAddonObjects.push(fitAddonBash)

                          // Send a request to create a pty instance
                          setTimeout(() => IPCRenderer.send('pty:create:bash-session', {
                            id: `${clusterID}-bash-${sessionID}`,
                            projectID: `cassandra_${clusterID}`,
                            path: Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'localclusters', clusterID),
                            dockerComposeBinary: Modules.Docker.getDockerComposeBinary()
                          }), 500)

                          /**
                           * Decide what to print to the user after initializing the pty instance
                           *
                           * Define the regex syntax in which the terminal is ready to be used once it's matched
                           */
                          let regex = new RegExp('root.+\:\/\#', 'gm')

                          // Remove all previous listeners to the channel between the main and renderer threads
                          IPCRenderer.removeAllListeners(`pty:${clusterID}-bash-${sessionID}:data:bash-session`)

                          /**
                           * Get the terminal's active buffer
                           * This process detects any attempt to execute the `exit` command
                           */
                          let activeBuffer = terminalBash.buffer.active

                          // Listen to data sent from the pty instance
                          IPCRenderer.on(`pty:${clusterID}-bash-${sessionID}:data:bash-session`, (_, data) => {
                            // Update the printing status if the regex execution has returned a positive result
                            if (regex.exec(minifyText(data)) != null && !printData)
                              printData = true

                            // If the printing status is `false` then don't print the current received data
                            if (!printData)
                              return

                            // Write data to the terminal
                            terminalBash.write(data)

                            // Detect any attempt to execute the `exit` command
                            setTimeout(() => {
                              // Get the active's line content
                              let activeLine = activeBuffer.getLine(activeBuffer.cursorY).translateToString(),
                                // Manipulate the entire line, get only the command, and get rid of the prompt
                                minifiedActiveLine = minifyText(activeLine).slice(activeLine.indexOf(':/#') + 3),
                                // Whether or not the `exit` is in the line
                                isExitFound = ['exit', 'exit&', 'exit;'].some((exit) => minifiedActiveLine.endsWith(exit) || minifiedActiveLine.startsWith(exit))

                              // If there's an `exit` command then suffix the entire line with `!` symbol
                              if (isExitFound && !minifiedActiveLine.endsWith('!'))
                                IPCRenderer.send(`pty:${clusterID}-bash-${sessionID}:command:bash-session`, '!')
                            })
                          })

                          // As the user typing and providing data to the terminal
                          terminalBash.onData((data) => {
                            // Add the data to the `latestCommand` variable
                            latestCommand += data

                            // If the command has an `exit` character then remove it
                            {
                              // Define the exit character
                              let exitChar = '\x04',
                                // Create a regular expression to match the character everywhere in the data
                                regex = new RegExp(exitChar, 'gm')

                              // Remove the character
                              data = data.replace(regex, '')
                            }

                            // Send the data to the pty instance
                            IPCRenderer.send(`pty:${clusterID}-bash-${sessionID}:command:bash-session`, data)
                          })

                          // Point at the terminal viewport - main container -
                          let terminalViewport = $(`div.terminal-container[data-id="${terminalBashContainerID}"]`).find('div.xterm-viewport')[0]

                          /**
                           * Listen to data - characters - from the user - input to the terminal -
                           * What is being listened to is mainly the keypresses like `ENTER`
                           */
                          terminalBash.onData((char) => {
                            // Get the key code
                            let keyCode = char.charCodeAt(0)

                            // Switch between the key code's values
                            switch (keyCode) {
                              // `ENTER`
                              case 13: {
                                // Empty the latest command
                                latestCommand = ''

                                // Scroll to the very bottom of the terminal
                                terminalViewport.scrollTop = terminalViewport.scrollHeight

                                // Resize the terminal
                                fitAddonBash.fit()

                                break
                              }
                            }
                          })
                        })
                        // End of handling the app's terminal
                      }
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }
                    // End of handling the bash session's terminal

                    // Handle different events for many elements in the work area
                    {
                      // Metadata tree view side
                      setTimeout(() => {
                        // Clicks the copy button; to copy metadata in JSON string format
                        $(`div.btn[data-id="${copyMetadataBtnID}"]`).click(function() {
                          // Get the beautified version of the metadata
                          let metadataBeautified = applyJSONBeautify(latestMetadata, true),
                            // Get the metadata size
                            metadataSize = ByteSize(ValueSize(metadataBeautified))

                          // Copy metadata to the clipboard
                          try {
                            Clipboard.writeText(metadataBeautified)
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Give feedback to the user
                          showToast(I18next.capitalize(I18next.t('copy metadata')), I18next.capitalizeFirstLetter(I18next.replaceData('metadata for the cluster connected to by [b]$data[/b] has been copied to the clipboard, the size is $data', [getAttributes(clusterElement, 'data-name'), metadataSize])) + '.', 'success')
                        })

                        // Refresh the tree view
                        $(`div.btn[data-id="${refreshMetadataBtnID}"]`).click(function() {
                          // If the `checkMetadata` function is not yet implemented then skip the upcoming code
                          if (checkMetadata == null)
                            return

                          // If there's a tree object already then attempt to destroy it
                          if (jsTreeObject != null)
                            try {
                              $(`div.metadata-content[data-id="${metadataContentID}"]`).jstree('destroy')
                            } catch (e) {}

                          // Trigger the `click` event for the search in metadata tree view button; to make sure it's reset
                          $(`div.btn[data-id="${searchInMetadataBtnID}"]`).trigger('click', true)

                          // Add log about this refreshing process
                          try {
                            addLog(`Request to refresh the metadata of the cluster connected to by '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                          } catch (e) {}

                          // Reset the metadata trigger
                          isMetadataFetched = false

                          // Show the loading of the tree view
                          $(this).parent().parent().parent().addClass('loading')

                          // Check metadata with `refresh` = `true`
                          checkMetadata(true)
                        })

                        // Handle the search feature inside the metadata tree view
                        {
                          // Point at the search container
                          let searchContainer = workareaElement.find('div.search-in-metadata'),
                            // Point at the metadata tree view container
                            metadataContent = $(`div.metadata-content[data-id="${metadataContentID}"]`),
                            // Flag to tell if the search container is shown already
                            isSearchShown = false,
                            // The timeout function to be defined for the starting the search process
                            searchTimeout

                          // Clicks the search button/icon
                          $(`div.btn[data-id="${searchInMetadataBtnID}"]`).on('click', function(e, overrideFlag = null) {
                            // If an override flag has been passed - true/false for showing the search container - then adopt this flag
                            if (overrideFlag != null)
                              isSearchShown = overrideFlag

                            // Apply a special effect for the tree view based on the current showing status
                            metadataContent.toggleClass('show-search-input', !isSearchShown)

                            setTimeout(() => {
                              // Show or hide the search input based on the current showing status
                              searchContainer.toggleClass('show', !isSearchShown)

                              // Toggle the flag
                              isSearchShown = !isSearchShown

                              // If the new status is to show the search input then skip the upcoming code
                              if (isSearchShown)
                                return

                              // Empty the search value - if there's one -
                              searchContainer.find('input').val('').trigger('input')

                              // Hide the navigation arrows
                              workareaElement.find('div.right-elements').removeClass('show')
                            })
                          })

                          // When the user types in the search input
                          searchContainer.find('input').on('input', function() {
                            // Make sure to clear any ongoing timeout processes
                            if (searchTimeout != null)
                              clearTimeout(searchTimeout)

                            /**
                             * Perform a search process after a set time of finish typing
                             * This delay will avoid any potential performance issues
                             */
                            searchTimeout = setTimeout(() => {
                              try {
                                $(metadataContent).jstree(true).search($(this).val(), true, false)
                              } catch (e) {}
                            }, 500)
                          })
                        }
                      })

                      // Metadata differentiation section
                      setTimeout(() => {
                        // Point at the snapshot's suffix name container
                        let suffixContainer = $(`div.save-snapshot-suffix[data-id="${saveSnapshotSuffixContainerID}"]`),
                          // Point at the time element; where the snapshot's time will be printed to the user
                          timeElement = suffixContainer.children('div.time'),
                          // Point at the save schema snapshot button
                          saveSnapshotBtn = suffixContainer.children('button'),
                          // Point at the suffix's input field
                          suffixInput = suffixContainer.find('input'),
                          // Get the object of the input field
                          suffixInputObject = getElementMDBObject(suffixInput),
                          // Variable which will hold the formatted version of the snapshot's time
                          timeFormatted

                        // Show the differentiation list - line's number and content -
                        $(`span.btn[data-id="${showDifferentiationBtnID}"]`).click(function() {
                          // Get how many detected changes
                          let changes = parseInt($(this).attr('data-changes'))

                          // If none, then skip the upcoming code and show feedback to the user
                          if (changes <= 0)
                            return showToast(I18next.capitalize(I18next.t('show differentiation')), I18next.capitalizeFirstLetter(I18next.t('there is no difference between the previous and new metadata')) + '.', 'warning')

                          // Show/hide the changes container
                          $(`div.changes-lines[data-id="${changesLinesContainerID}"]`).toggleClass('show')
                        })

                        $(`span.btn[data-id="${diffNavigationPrevBtnID}"]`).click(() => diffEditorNavigator.previous())

                        $(`span.btn[data-id="${diffNavigationNextBtnID}"]`).click(() => diffEditorNavigator.next())

                        // Refresh the new metadata and do a differentiation check
                        $(`span.btn[data-id="${refreshDifferentiationBtnID}"]`).click(function() {
                          // Disable the button
                          $(this).attr('disabled', '').addClass('disabled refreshing')

                          // Get the latest metadata
                          Modules.Clusters.getMetadata(clusterID, (metadata) => {
                            try {
                              // Convert the metadata from JSON string to an object
                              metadata = JSON.parse(metadata)

                              // Detect differences
                              // detectDifferentiationShow(JSON.parse(metadataDiffEditors.old.object.getValue()), metadata)

                              // Beautify the received metadata
                              metadata = applyJSONBeautify(metadata, true)

                              // Update the fetch date and time of the new metadata
                              $(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                              $(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).attr('data-time', `${new Date().getTime()}`)

                              // Update the new editor's value
                              metadataDiffEditors.new.object.setValue(metadata)

                              // Enable the button again
                              $(this).removeAttr('disabled').removeClass('disabled refreshing')
                            } catch (e) {
                              try {
                                errorLog(e, 'connections')
                              } catch (e) {}
                            }
                          })
                        })

                        // Clicks the button to open the save schema snapshot pop-up container
                        $(`span.btn[data-id="${saveSnapshotBtnID}"]`).click(function() {
                          // Reset the suffix value
                          suffixInput.val('')
                          suffixInputObject.update()
                          suffixInputObject._deactivate()

                          // Get the current date and time, format it, and show it to the user
                          let time = parseInt($(`span[data-id="${newMetadataTimeID}"]`).attr('data-time')) || new Date().getTime()
                          timeFormatted = formatTimestamp(time, true).replace(/\:/gm, '_')
                          timeElement.text(`${timeFormatted}`)

                          // Show the save schema snapshot container
                          suffixContainer.addClass('show')

                          // Add a backdrop element
                          $('body').append($(`<div class="backdrop"></div>`).show(function() {
                            // Show it with animation
                            setTimeout(() => $(this).addClass('show'), 50)

                            // Once it's clicked
                            $(this).click(function() {
                              // Remove it
                              $(this).remove()

                              // Hide the snapshot container
                              suffixContainer.removeClass('show')
                            })
                          }))
                        })

                        // Clicks the `SAVE SCHEMA SNAPSHOT` button
                        saveSnapshotBtn.click(function() {
                          // Get the suffix's value
                          let suffix = suffixInput.val(),
                            // Get the new metadata content
                            metadata = metadataDiffEditors.new.object.getValue(),
                            // Get the workspace's folder path
                            workspaceFolderPath = getWorkspaceFolderPath(workspaceID, true),
                            // The snapshot's initial name is the fetched time of the new metadata
                            snapshotName = `${timeFormatted}`

                          try {
                            metadata = JSON.parse(metadata)

                            metadata.time = parseInt($(`span[data-id="${newMetadataTimeID}"]`).attr('data-time')) || new Date().getTime()

                            metadata = JSON.stringify(metadata)
                          } catch (e) {}

                          // Add log a about the request
                          try {
                            addLog(`Request to save a schema snapshot of the metadata of the cluster connected to by '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                          } catch (e) {}

                          // Minimize the size of the metadata by compression
                          try {
                            metadata = JSON.stringify(JSON.parse(metadata))
                          } catch (e) {}

                          // If there's a suffix then add it to the name
                          if (suffix.trim().length != 0)
                            snapshotName = `${snapshotName}_${suffix}`

                          // Finally add the `.json` extension
                          snapshotName = `${snapshotName}.json`

                          // Write the snapshot file in the default snapshots folder of the cluster
                          FS.writeFile(Path.join(workspaceFolderPath, getAttributes(clusterElement, 'data-folder'), 'snapshots', snapshotName), metadata, (err) => {
                            // Click the backdrop element; to hide the snapshot's container
                            $('div.backdrop').click()

                            // Show failure feedback to the user and skip the upcoming code
                            if (err)
                              return showToast(I18next.capitalize(I18next.t('save schema snapshot')), I18next.capitalizeFirstLetter(I18next.t('failed to save snapshot, please make sure the app has write permissions and try again')) + '.', 'failure')

                            // Show success feedback to the user
                            showToast(I18next.capitalize(I18next.t('save schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot has been successfully saved with name [b]$data[/b]', [snapshotName])) + '.', 'success')
                          })
                        })

                        // Load a saved snapshot
                        $(`span.btn[data-id="${loadSnapshotBtnID}"]`).click(function() {
                          // Get all saved snapshots of the cluster
                          Modules.Clusters.getSnapshots(Path.join(getWorkspaceFolderPath(workspaceID), getAttributes(clusterElement, 'data-folder')), (snapshots) => {
                            // If there are no saved snapshots then show feedback to the user and skip the upcoming code
                            if (snapshots.length <= 0)
                              return showToast(I18next.capitalize(I18next.t('load schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('there are no saved schema snapshots related to the connection [b]$data[/b], attempt first to save one', [getAttributes(clusterElement, 'data-name')])) + '.', 'warning')

                            // Reset some elements' state in the dialog
                            try {
                              // Point at the actions' container
                              let actionsMultiple = $('#loadSnapshot').find('div.actions-multiple')

                              // Hide the actions for multiple snapshots' container
                              actionsMultiple.removeClass('show')

                              // Reset the `check` attribute; so the next time it clicks the snapshots will be checked
                              actionsMultiple.find('a[action="select"]').attr('check', 'true')
                            } catch (e) {}

                            // Point at the snapshot's dialog/modal then get the snapshots' container
                            let snapshotsContainer = $('#loadSnapshot').find('div.snapshots')

                            // Remove all previous snapshots
                            snapshotsContainer.children('div.snapshot').remove()

                            // Loop through each saved snapshot - ordered descending by creation date -
                            snapshots.forEach((snapshot) => {
                              // Snapshot UI element structure
                              let element = `
                                  <div class="snapshot" data-path="${snapshot.path}" data-name="${snapshot.name}">
                                    <div class="_left">
                                      <div class="name">${snapshot.name}</div>
                                      <div class="badges">
                                        <span class="badge badge-primary">${formatTimestamp(snapshot.time)}</span>
                                        <span class="badge badge-secondary">${ByteSize(snapshot.size)}</span>
                                      </div>
                                    </div>
                                    <div class="_right">
                                      <a action="load" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                        <ion-icon name="upload"></ion-icon>
                                      </a>
                                      <a action="delete" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" data-confirmed="false">
                                        <ion-icon name="trash"></ion-icon>
                                      </a>
                                      <a action="multiple" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="#1d1d1e">
                                        <input class="form-check-input" type="checkbox">
                                      </a>
                                    </div>
                                  </div>`

                              // Append the snapshot to the container
                              snapshotsContainer.append($(element).show(function() {
                                // Point at the snapshot element
                                let snapshot = $(this),
                                  // Get the snapshot's path and name
                                  [snapshotPath, snapshotName] = getAttributes($(this), ['data-path', 'data-name'])

                                // Apply the chosen language on the UI element after being fully loaded
                                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

                                // Clicks the loading button - to load schema snapshot in the old side -
                                $(this).find('a[action="load"]').click(async function() {
                                  try {
                                    // Add log about this loading process
                                    try {
                                      addLog(`Request to load a schema snapshot in path '${snapshotPath}' related to the connection '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                                    } catch (e) {}

                                    // Read the snapshot's content
                                    let snapshotContent = await FS.readFileSync(snapshotPath, 'utf8')

                                    // Convert it from JSON string to object
                                    snapshotContent = JSON.parse(snapshotContent)

                                    let snapshotTakenTime = ''

                                    try {
                                      snapshotTakenTime = snapshotContent.time

                                      delete snapshotContent.time
                                    } catch (e) {}

                                    // Update the old editor's value
                                    metadataDiffEditors.old.object.setValue(applyJSONBeautify(snapshotContent, true))

                                    try {
                                      if (snapshotTakenTime.length <= 0)
                                        throw 0

                                      snapshotTakenTime = ` (${formatTimestamp(snapshotTakenTime)})`
                                    } catch (e) {}

                                    // Update the old side's badge
                                    $(`span.old-snapshot[data-id="${oldSnapshotNameID}"]`).text(`: ${snapshot.attr('data-name')}${snapshotTakenTime}`)

                                    // Detect differentiation between the metadata content's after loading the snapshot
                                    // detectDifferentiationShow(snapshotContent, JSON.parse(metadataDiffEditors.new.object.getValue()))

                                    // Show success feedback to the user
                                    showToast(I18next.capitalize(I18next.t('load schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the schema snapshot [b]$data[/b] has been successfully loaded', [snapshot.attr('data-name')])) + '.', 'success')

                                    // Close the modal/dialog
                                    $('div.modal#loadSnapshot').find('button.btn-close').click()
                                  } catch (e) {
                                    try {
                                      errorLog(e, 'connections')
                                    } catch (e) {}

                                    // If any error has occurred then show feedback to the user about the failure
                                    showToast(I18next.capitalize(I18next.t('load schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to load the snapshot [b]$data[/b], make sure the file exists and it is a valid [code]JSON[/code]', [snapshot.attr('data-name')])) + '.', 'failure')
                                  }
                                })

                                // Delete a snapshot
                                $(this).find('a[action="delete"]').on('click', function(e, info) {
                                  // Inner function to delete a snapshot
                                  let deleteSnapshot = (keepFiles = false) => {
                                    let callbackFunction = (err) => {
                                      // If any error has occurred then show feedback to the user and skip the upcoming code
                                      if (err) {
                                        // Add error log
                                        try {
                                          errorLog(e, 'connections')
                                        } catch (e) {}

                                        // Show feedback to the user
                                        showToast(I18next.capitalize(I18next.t('delete schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to delete the snapshot [b]$data[/b], it may be already deleted or there is no permission granted to delete it', [snapshotName])) + '.', 'failure')

                                        // Skip the upcoming code
                                        return
                                      }

                                      // Show success feedback to the user
                                      showToast(I18next.capitalize(I18next.t('delete schema snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot [b]$data[/b] has been successfully deleted', [snapshotName])) + '.', 'success')

                                      // Remove the snapshot UI element in the container
                                      snapshot.remove()

                                      // If no saved snapshots left then close the modal/dialog
                                      if (snapshotsContainer.children('div.snapshot').length <= 0)
                                        $('#showLoadSnapshotDialog').click()
                                    }

                                    // Remove the snapshot file
                                    if (!keepFiles)
                                      FS.remove(snapshotPath, callbackFunction)

                                    // Keep the snapshot file, however, adding a prefix to the extension will cause to be ignored by the app
                                    if (keepFiles) {
                                      FS.move(snapshotPath, `${snapshotPath}_DEL_${getRandomID(5)}`, callbackFunction)
                                    }
                                  }

                                  // Add log about this deletion process
                                  try {
                                    addLog(`Request to delete a snapshot in path '${snapshotPath}' related to the connection '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                                  } catch (e) {}

                                  // If no need for confirmation then call the deletion function and skip the upcoming code
                                  try {
                                    if (info.noConfirm)
                                      return deleteSnapshot(info.checked)
                                  } catch (e) {}

                                  // Open the confirmation dialog and wait for the response
                                  openDialog(I18next.capitalizeFirstLetter(I18next.replaceData('do you want to delete the snapshot [b]$data[/b]? once you confirm, there is no undo', [snapshotName])), (response) => {
                                    // If canceled, or not confirmed then skip the upcoming code
                                    if (!response.confirmed)
                                      return

                                    // Call the deletion function
                                    deleteSnapshot(response.checked)
                                  }, true, 'keep the associated files in the system')
                                })

                                // Select the snapshot to be deleted
                                $(this).find('a[action="multiple"] input').change(function() {
                                  // Get the number of selected snapshots
                                  let checkedSnapshots = snapshotsContainer.find('div.snapshot').find('a[action="multiple"] input').filter(':checked')

                                  // Show/hide the actions for multiple snapshots based on the number of selected ones
                                  $('#loadSnapshot div.actions-multiple').toggleClass('show', checkedSnapshots.length != 0)
                                })
                              }))
                            })

                            // Show the modal/dialog once all processes completed
                            $('#showLoadSnapshotDialog').click()
                          })
                        })

                        // Open the snapshots' folder
                        $(`span.btn[data-id="${openSnapshotsFolderBtnID}"]`).click(() => Open(Path.join(getWorkspaceFolderPath(workspaceID), getAttributes(clusterElement, 'data-folder'), 'snapshots')))

                        // Change the editors view - vertical and horizontal -
                        $(`span.btn[data-id="${changeViewBtnID}"]`).click(function() {
                          // Point at the cluster's metadata differentiation content's container
                          let metadataContentContainer = $(`div#_${metadataDifferentiationContentID} div.metadata-content-container`),
                            // Whether or not a horizontal view is already applied
                            isViewHorizontal = metadataContentContainer.hasClass('view-horizontal')

                          // Toggle the horizontal class based on the checking result
                          metadataContentContainer.toggleClass('view-horizontal', !isViewHorizontal)

                          // Change the button's icon based on the checking result as well
                          $(this).children('ion-icon').attr('name', `diff-${isViewHorizontal ? 'vertical' : 'horizontal'}`)

                          // Trigger the `resize` event to adjust editors' dimensions
                          $(window.visualViewport).trigger('resize')
                        })
                      })

                      // The `click` event for all tabs in the work area
                      setTimeout(() => {
                        // With every `click` event of one of the tabs
                        workareaElement.find('a[href*="#_"]').click(() => {
                          /**
                           * Trigger the `resize` event for the entire window
                           * This will resize editors and terminals
                           */
                          setTimeout(() => $(window.visualViewport).trigger('resize'), 100)
                        })
                      })

                      // Clicks either the restart or the close buttons for the cluster's work area
                      setTimeout(() => {
                        $(`div.btn[data-id="${restartWorkareaBtnID}"]`).add(`div.btn[data-id="${closeWorkareaBtnID}"]`).on('click', (event, moveToWorkspace = true) => {
                          // Add log for this action
                          try {
                            addLog(`Request to close/refresh the work area of the connection '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                          } catch (e) {}

                          // Ask the user for credentials again if they're required
                          try {
                            // Get the related attributes
                            let [credentialsAuth, credentialsSSH] = getAttributes(clusterElement, ['data-credentials-auth', 'data-credentials-ssh'])

                            try {
                              // If there's no need to ask for the DB authentication credentials then skip this try-catch block
                              if (credentialsAuth == undefined)
                                throw 0

                              clusterElement.removeAttr('data-username data-password data-got-credentials')
                            } catch (e) {}

                            try {
                              // If there's no need to ask for the SSH credentials then skip this try-catch block
                              if (credentialsSSH == undefined)
                                throw 0

                              clusterElement.removeAttr('data-ssh-username data-ssh-password data-got-credentials')
                            } catch (e) {}
                          } catch (e) {}

                          try {
                            // If the current workspace is not the sandbox or it's not a `close` event then skip this try-catch block
                            if (!isSandbox || !$(event.currentTarget).is($(`div.btn[data-id="${closeWorkareaBtnID}"]`)))
                              throw 0

                            // Show the test connection state - it's used here to indicate the closing process of a sandbox project -
                            clusterElement.addClass('test-connection')

                            // Show the termination process' button
                            setTimeout(() => clusterElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                            // Disable all buttons inside the sandbox project's element in the clusters/sandbox projects container
                            clusterElement.find('button').attr('disabled', '')

                            /**
                             * Create a pinned toast to show the output of the process
                             *
                             * Get a random ID for the toast
                             */
                            let pinnedToastID = getRandomID(10)

                            // Show/create that toast
                            showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('stop local cluster')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                            // Attempt to close/stop the docker project
                            Modules.Docker.getDockerInstance(clusterElement).stopDockerCompose(pinnedToastID, (feedback) => {
                              /**
                               * Failed to close/stop the project
                               * Show feedback to the user and skip the upcoming code
                               */
                              if (!feedback.status)
                                return showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] were not successfully stopped', [getAttributes(clusterElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                              /**
                               * Successfully closed/stopped
                               * Show feedback to the user
                               */
                              showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] have been successfully stopped', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                              // Reset the sandbox project's element in the clusters/sandbox projects container
                              clusterElement.removeClass('test-connection enable-terminate-process')
                              clusterElement.find('button').removeAttr('disabled')
                              clusterElement.children('div.status').removeClass('show success')

                              // Hide the termination process' button after a set time out
                              setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
                            })

                            // Show the initial feedback to the user which
                            showToast(I18next.capitalize(I18next.t('close local cluster work area')), I18next.capitalizeFirstLetter(I18next.replaceData('the work area of the local cluster [b]$data[/b] has been successfully closed, attempting to stop the local cluster containers', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                            // Reset the button's text
                            setTimeout(() => $(`button[button-id="${startProjectBtnID}"]`).children('span').attr('mulang', 'start').text(I18next.t('start')))
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Point at the current active work aree
                          let workarea = $(`div.body div.right div.content div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`)

                          // Send the `quit` command to the CQLSH instance
                          IPCRenderer.send('pty:command', {
                            id: clusterID,
                            cmd: 'quit'
                          })

                          // Send a `close` request for the pty instance
                          IPCRenderer.send('pty:close', clusterID)

                          /**
                           * Remove all listeners to the data coming from the pty instance
                           * This will prevent having multiple listeners in the background
                           */
                          try {
                            IPCRenderer.removeAllListeners(`pty:data:${clusterID}`)
                          } catch (e) {}

                          setTimeout(() => {
                            // Remove both editors in the metadata differentiation section
                            (['old', 'new']).forEach((type) => {
                              try {
                                metadataDiffEditors[type].object.getModel().dispose()
                              } catch (e) {}
                            })

                            // Remove the terminal and all its components
                            try {
                              terminal.dispose()
                              terminal._core.dispose()
                              terminal._addonManager.dispose()
                              terminal = null
                            } catch (e) {}

                            try {
                              // If the clicked button is not for restarting the work area then skip this try-catch block
                              if (!$(event.currentTarget).is($(`div.btn[data-id="${restartWorkareaBtnID}"]`)))
                                throw 0

                              // Remove the work area element
                              workarea.remove()

                              // Click the button to connect with the cluster again
                              $(`button[button-id="${connectBtnID}"]`).trigger('click', true)

                              // Add an AxonOps™ webview if needed
                              setTimeout(() => {
                                try {
                                  // Get the chosen port and the final URL
                                  let axonopsPort = getAttributes(clusterElement, 'data-port-axonops'),
                                    axonopsURL = `http://localhost:${axonopsPort}`

                                  // If the provided port is not actually a number then skip this try-catch block
                                  if (isNaN(axonopsPort))
                                    throw 0

                                  // Append the `webview` ElectronJS custom element
                                  $(`div.tab-pane#_${axonopsContentID}`).append($(`<webview src="${axonopsURL}" nodeIntegrationInSubFrames nodeintegration preload="${Path.join(__dirname, '..', 'js', 'axonops_agent_webview.js')}"></webview>`).show(function() {
                                    // Point at the webview element
                                    let webView = $(this)[0]

                                    // Reload it after 1s of creation
                                    try {
                                      setTimeout(() => webView.reloadIgnoringCache(), 1000)
                                    } catch (e) {}

                                    // Once the content inside the webview is ready/loaded
                                    webView.addEventListener('dom-ready', () => {
                                      // Once a message from the IPC is received
                                      webView.addEventListener(`ipc-message`, (event) => {
                                        // If it's a request to reload the webview then reload it
                                        if (event.channel == 'reload-webview')
                                          webView.reloadIgnoringCache()
                                      })
                                    })
                                  }))

                                  // Clicks the globe icon in the cluster's info
                                  $(`div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`).find('div.axonops-agent').click(() => Open(axonopsURL))
                                } catch (e) {}
                              }, 1000)

                              // Skip the upcoming code - as it's for closing the work area
                              return
                            } catch (e) {}

                            // Update the work-area attribute
                            clusterElement.attr('data-workarea', 'false')

                            // Update the status of the cluster in the mini cluster's list
                            updateMiniCluster(workspaceID, clusterID, true)

                            // Flag to tell if the workarea is actually visible
                            let isWorkareaVisible = workarea.is(':visible')

                            // Remove the work area element
                            workarea.remove()

                            /**
                             * Get all scripts to be executed associated with the cluster
                             * Here only the post-connection scripts will be considered
                             */
                            getPrePostConnectionScripts(workspaceID, clusterID).then((scripts) => {
                              // Define a variable to save the scripts' execution feedback
                              let executionFeedback = ''

                              try {
                                // If there's no post-connection script to execute then skip this try-catch block
                                if (scripts.post.length <= 0)
                                  throw 0

                                // Show feedback to the user about starting the execution process
                                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('post-connection scripts are being executed after closing the connection [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(clusterElement, 'data-name')])) + '.'), 50)

                                // Execute the post-connection scripts in order
                                executeScript(0, scripts.post, (executionResult) => {
                                  try {
                                    // If we've got `0` - as a final result - then it means all scripts have been executed with success and returned `0`; so skip this try-catch block and show a success feedback to the user
                                    if (executionResult.status == 0)
                                      throw 0

                                    // Show feedback to the user about the script which failed
                                    let info = `${I18next.t('script "$data" didn\'t return the success code <code>0</code>, but')} <code>${executionResult.status}</code>.`

                                    if (status == -1000)
                                      info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                                    // Set final feedback
                                    executionFeedback = `. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`

                                    // Show feedback to the user
                                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of connection [b]$data[/b]', [I18next.t('post'), getAttributes(clusterElement, 'data-name')]))}${executionFeedback}`, 'failure'), 50)
                                  } catch (e) {
                                    // Show success feedback to the user if the error is `0` code
                                    if (e == 0)
                                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of connection [b]$data[/b] have been successfully executed', [I18next.t('post'), getAttributes(clusterElement, 'data-name')])) + '.', 'success'), 50)
                                  }
                                })
                              } catch (e) {}
                            })

                            // Clicks the `ENTER` button for the cluster's workspace
                            if (moveToWorkspace || isWorkareaVisible)
                              $(`div.workspaces-container div.workspace[data-id="${getAttributes(clusterElement, 'data-workspace-id')}"]`).find('div.button button').click()

                            setTimeout(() => {
                              try {
                                // Handle the reset of the UI if the process is not restarting the work area
                                if ($(event.currentTarget).is($(`div.btn[data-id="${restartWorkareaBtnID}"]`)))
                                  throw 0

                                // Point at both buttons; the `CONNECT` and `TEST CONNECTION`
                                let connectBtn = $(`button[button-id="${connectBtnID}"]`),
                                  testConnectionBtn = $(`button[button-id="${testConnectionBtnID}"]`); // This semicolon is critical here

                                // Reset the text of each button
                                ([connectBtn, testConnectionBtn]).forEach((button) => button.children('span').attr('mulang', button.is(connectBtn) ? 'connect' : 'test connection').text(I18next.t(button.is(connectBtn) ? 'connect' : 'test connection')))

                                // Disable the `CONNECT` button
                                connectBtn.attr('disabled', '')

                                // Reset the cluster's connection status
                                clusterElement.find('div.status').removeClass('show success failure')
                              } catch (e) {}
                            })

                            setTimeout(() => {
                              /**
                               * Remove the cluster from the switcher
                               *
                               * Point at the clusters' switchers container
                               */
                              let clusterSwitcher = $(`div.body div.left div.content div.switch-clusters`)

                              // Remove the cluster's switcher
                              $(`div.body div.left div.content div.switch-clusters div.cluster[_cluster-id="${clusterID}"]`).remove()

                              // Update the switchers' container's view
                              updateSwitcherView('clusters')

                              // Handle the first switcher's margin
                              handleClusterSwitcherMargin()

                              // If there are no more active clusters then hide the switcher's container
                              if (clusterSwitcher.children('div.cluster').length <= 0)
                                clusterSwitcher.removeClass('show')
                            }, 10)
                          })
                        })
                      })
                    }

                    // Add the cluster's switcher to the container
                    try {
                      // If the switcher already exists or this is a restarting process then skip this try-catch block
                      if ($(`div.body div.left div.content div.switch-clusters div.cluster[_cluster-id="${workspaceID}"]`).length != 0 || restart)
                        throw 0

                      // Point at the clusters' switchers container
                      let clusterSwitcher = $(`div.body div.left div.content div.switch-clusters`),
                        // Get the container's height
                        switcherCurrentHeight = clusterSwitcher.outerHeight()

                      // Set the container's height; to guarantee a smooth height update animation
                      clusterSwitcher.css('height', `${switcherCurrentHeight}px`)

                      // If there's no active clusters yet then make set the container's height to `0`
                      if (clusterSwitcher.children('div.cluster').length <= 0)
                        switcherCurrentHeight = 0

                      // Check if the upcoming switcher will cause an overflow
                      setTimeout(() => {
                        // Define the new height
                        let newHeight = switcherCurrentHeight + 35,
                          // Define the new maximum allowed height
                          newHeightAllowed = calcSwitchersAllowedHeight()

                        // Divide the new height by two - as there are two switchers' containers
                        newHeightAllowed = newHeightAllowed / 2

                        // Determine if there's a need to handle an overflow
                        let hideSwitcher = newHeight >= newHeightAllowed

                        // Toggle the shown/hide of the navigation arrows
                        clusterSwitcher.toggleClass('show-more', hideSwitcher)

                        // Update the container's height
                        if (!hideSwitcher)
                          clusterSwitcher.css('height', `${switcherCurrentHeight + 35}px`)

                        setTimeout(() => {
                          // Show the container
                          clusterSwitcher.addClass('show')

                          // Define the cluster's host
                          let clusterHost = getAttributes(clusterElement, 'data-host'),
                            // Define the cluster's color
                            workspaceColor = getAttributes(workspaceElement, 'data-color')

                          // Slice it if needed
                          clusterHost = clusterHost.length > 20 ? `${clusterHost.slice(0, 20)}...` : clusterHost

                          // Cluster's switcher UI element structure
                          let element = `
                              <div class="cluster" _cluster-id="${clusterID}" style="box-shadow: inset 0px 0px 0 1px ${workspaceColor || '#7c7c7c'};" active ${hideSwitcher ? "hidden" : "" }>
                                <button type="button" style="color: ${workspaceColor};" class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="right" data-mdb-html="true"
                                  data-title="<span class='tooltip-left'>${getAttributes(clusterElement, 'data-name')}<br>${clusterHost}</span>" data-mdb-html="true" data-mdb-customClass="tooltip-left">${extractChars(getAttributes(clusterElement, 'data-name'))}</button>
                              </div>`

                          // Define the suitable adding function based on whether or not there's an overflow
                          let addingFunction = {
                            element: clusterSwitcher,
                            method: 'append'
                          }

                          try {
                            // If there's no need to handle an overflow then skip this try-catch block
                            if (!hideSwitcher)
                              throw 0

                            // Update the adding function's attributes
                            addingFunction = {
                              element: clusterSwitcher.children('div.more-clusters'),
                              method: 'after'
                            }
                          } catch (e) {
                            try {
                              errorLog(e, 'connections')
                            } catch (e) {}
                          }

                          // Append the switcher to the container
                          addingFunction.element[addingFunction.method]($(element).show(function() {
                            // Variable which will hold the tooltip's MDB object
                            let tooltip

                            try {
                              // If there's no need to handle an overflow then skip this try-catch block
                              if (!hideSwitcher)
                                throw 0

                              // Show the current swticher
                              $(this).removeAttr('hidden')

                              // And hide the last visible switcher
                              clusterSwitcher.children('div.cluster').filter(':visible').last().hide()
                            } catch (e) {}

                            setTimeout(() => {
                              // Show the switcher
                              $(this).addClass('show')

                              // Get the switcher's tooltip's MDB object
                              tooltip = getElementMDBObject($(this).children('button'), 'Tooltip')

                              // Deactivate all switchers
                              $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                              // Activate the cluster's switcher
                              $(this).attr('active', '')
                            }, 150)

                            // Handle the `click` event of the switcher
                            setTimeout(() => {
                              $(this).children('button').click(function() {
                                // Point at the cluster's workspace's UI element
                                let workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`),
                                  // Point at the cluster's UI element
                                  clusterElement = $(`div[content="clusters"] div.clusters-container div.clusters[workspace-id="${workspaceID}"] div.cluster[data-id="${clusterID}"]`)

                                // Add log about this action
                                try {
                                  addLog(`Switch to the work area of the connection '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                                } catch (e) {}

                                // Set the workspace's color on the UI
                                setUIColor(getAttributes(workspaceElement, 'data-color'))

                                // Deactivate all switchers
                                $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                                // Activate the cluster's switcher
                                $(this).parent().attr('active', '')

                                // Hide the switcher's tooltip once it's clicked
                                tooltip.hide()

                                // Click the `CONNECT` button of the cluster
                                clusterElement.find('div.button button.connect').click()

                                /**
                                 * Trigger the `resize` function of the window
                                 * This will fit and resize related elements in the work area - especially the terminal -
                                 */
                                $(window.visualViewport).trigger('resize')
                              })
                            })

                            // Handle the `right button` click event of the switcher
                            setTimeout(() => {
                              $(this).mousedown(function(event) {
                                // Make sure the `right button` is one which clicked
                                if (event.which != 3)
                                  return

                                // Send a request to the main thread regards pop-up a menu
                                IPCRenderer.send('show-context-menu', JSON.stringify([{
                                  label: I18next.capitalize(I18next.t('close workarea (disconnect)')),
                                  click: `() => views.main.webContents.send('workarea:close', {
                                     btnID: '${closeWorkareaBtnID}'
                                   })`
                                }]))
                              })
                            })

                            // Handle the first switcher's margin
                            setTimeout(() => handleClusterSwitcherMargin())
                          }))
                        }, 200)
                      })
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }

                    // Allow for resizing the left side of the work area taking into account all affected elements
                    {
                      setTimeout(() => {
                        // Point at both sides - left and right -
                        let rightSide = workareaElement.children('div.sub-sides.right'),
                          leftSide = workareaElement.children('div.sub-sides.left'),
                          // The minimum width allowed for resizing is the default left side's width
                          leftSideMinWidth = leftSide.outerWidth(),
                          // Get the right side's transition value
                          rightSideTransition = rightSide.css('transition')

                        // Make the left side resizable
                        leftSide.resizable({
                          handles: 'e', // [E]ast
                          minWidth: leftSideMinWidth, // Minimum width allowed to be reached
                          maxWidth: !isSandbox ? 1333 : 1170 // Maximum width allowed to be reached
                        }).bind({
                          // While the resizing process is active
                          resize: function(_, __) {
                            // Update the right side's width based on the new left side's width
                            rightSide.css({
                              'width': `calc(100% - ${leftSide.outerWidth()}px)`,
                              'transition': `all 0s`
                            })

                            /**
                             * Trigger the `resize` event for the entire window
                             * This will resize editors and terminals
                             */
                            {
                              // Attempt to clear the timeout if it has already been created
                              try {
                                clearTimeout(global.resizeTriggerOnResize)
                              } catch (e) {}

                              // Set a global timeout object
                              global.resizeTriggerOnResize = setTimeout(() => $(window.visualViewport).trigger('resize'))
                            }

                            // Get the minimum width allowed to be reached for the right side before hiding the tabs' titles
                            let minimumAllowedWidth = !isSandbox ? 867 : 1215,
                              // Decide whether or not the tabs' titles should be shown
                              showTabsTitles = rightSide.outerWidth() > minimumAllowedWidth,
                              // Get all tabs' tooltips in the work area
                              workareaTooltipElements = [...workareaElement.find('[tab-tooltip]')],
                              // Get tooltips' objects of the tabs' tooltips
                              workareaTooltipObjects = mdbObjects.filter((mdbObject) => workareaTooltipElements.some((elem) => mdbObject.element.is(elem)))

                            // Inside the workareas, find all tabs' titles and toggle their display based on the window width
                            workareaElement
                              .find('div.cluster-tabs ul a.nav-link span.title')
                              .toggleClass('ignore-resize', !showTabsTitles)
                              .toggle(showTabsTitles)

                            // Enable/disable the work area's tabs' tooltips
                            workareaTooltipObjects.forEach((mdbObject) => mdbObject.object[!showTabsTitles ? 'enable' : 'disable']())
                          },
                          // Once the resizing process stopped/finished
                          stop: function(_, __) {
                            // Return the original transition's value
                            rightSide.css('transition', rightSideTransition)

                            /**
                             * Trigger the `resize` function of the window
                             * This will fit and resize related elements in the work area - especially the terminal -
                             */
                            $(window.visualViewport).trigger('resize')
                          }
                        })
                      })
                    }

                    // Update the button's text to be `ENTER`
                    setTimeout(() => $(`button[button-id="${connectBtnID}"]`).children('span').attr('mulang', 'enter').text(I18next.t('enter')), 1000)

                    // Update the test connection's button's text to be `DISCONNECT`
                    setTimeout(() => $(`button[button-id="${testConnectionBtnID}"]`).children('span').attr('mulang', 'disconnect').text(I18next.t('disconnect')), 1000)

                    /*
                     * Check the connectivity with the current cluster
                     * Define a flag to be used in wider scope - especially for the right-click context-menu of the tree view items -
                     */
                    let isConnectionLost = false

                    {
                      // By default, the flag to show a toast regards lost connection is set to `false`
                      let isLostConnectionToastShown = false

                      setTimeout(() => {
                        // Inner function to check the connectivity status
                        let checkConnectivity = () => {
                          return
                          /**
                           * Handle if the basic terminal is currently active
                           * In this case, the app won't perform a connectivity check
                           */
                          try {
                            // If the basic terminal is not active then skip this try-catch block
                            if ($(`div[data-id="${terminalContainerID}"]`).css('display') == 'none')
                              throw 0

                            // Perform a new check process after 1 minute
                            setTimeout(() => checkConnectivity(), 60000)

                            // Skip the upcoming code
                            return
                          } catch (e) {}

                          // Point at the connection status element in the UI
                          let connectionStatusElement = $(`div.body div.right div.content div[content="workarea"] div.workarea[cluster-id="${getAttributes(clusterElement, 'data-id')}"][workarea-id="${workareaID}"]`).find('div.connection-status')

                          // If the connection status UI element is not exists then the work area has been closed and the check process should be terminated
                          if (connectionStatusElement.length <= 0 || connectionStatusElement == null)
                            return

                          // Call the connectivity check function from the clusters' module
                          Modules.Clusters.checkConnectivity(getAttributes(clusterElement, 'data-id'), (connected) => {
                            // Show a `not-connected` class if the app is not connected with the cluster
                            connectionStatusElement.removeClass('show connected not-connected').toggleClass('show not-connected', !connected)

                            // Perform a check process every 1 minute
                            setTimeout(() => checkConnectivity(), 60000)

                            // Update the associated flag
                            isConnectionLost = !connected

                            /**
                             * Apply different effects on the work area UI
                             * Update the cluster's element in the clusters' list
                             */
                            clusterElement.attr('data-connected', connected ? 'true' : 'false')
                              .children('div.status').addClass(connected ? 'success' : 'failure').removeClass(connected ? 'failure' : 'success')

                            // Disable selected buttons
                            workareaElement.find('.disableable').toggleClass('disabled', !connected)

                            try {
                              /**
                               * In case the app is not connected with the cluster
                               * If the app is connected then skip this try-catch block
                               */
                              if (connected)
                                throw 0

                              // If the toast/feedback regards lost connection has been shown then skip the upcoming code
                              if (isLostConnectionToastShown)
                                return

                              // Show feedback to the user
                              showToast(I18next.capitalize(I18next.replaceData(`connection $data lost`, [getAttributes(clusterElement, 'data-name')])), I18next.capitalizeFirstLetter(I18next.replaceData(`connection [b]$data[/b] in workspace [b]$data[/b] is lost. A toast will be shown when the connection is restored. Most of the work area processes are now non-functional`, [getAttributes(clusterElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'warning')

                              // Update the associated flag in order to not show that feedback in this checking cycle
                              isLostConnectionToastShown = true

                              // Skip the upcoming code
                              return
                            } catch (e) {}

                            try {
                              /**
                               * Reaching here means the app is connected with the cluster
                               * If the toast/feedback regards lost connection hasn't been shown already then there's no need to show the restore connection feedback, skip this try-catch block
                               */
                              if (!isLostConnectionToastShown)
                                throw 0

                              // Update the associated flag
                              isLostConnectionToastShown = false

                              // Show feedback to the user
                              showToast(I18next.capitalize(I18next.replaceData(`connection $data restored`, [getAttributes(clusterElement, 'data-name')])), I18next.capitalizeFirstLetter(I18next.replaceData(`connection [b]$data[/b] in workspace [b]$data[/b] has been restored. All work area processes are now functional`, [getAttributes(clusterElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'success')
                            } catch (e) {}
                          })
                        }

                        // Start the checking process after 30 seoncds of creating the work area
                        setTimeout(() => checkConnectivity(), 30000)
                      })
                    }

                    // Handle the history feature
                    {
                      // Point at the history items' container
                      let historyItemsContainer = $(this).find('div.history-items'),
                        // Point at the history show button
                        historyBtn = $(this).find('div.history').find('button.btn'),
                        // Get the current saved items
                        savedHistoryItems = Store.get(clusterID) || []

                      // Determine to disable/enable the history button based on the number of saved items
                      historyBtn.attr('disabled', savedHistoryItems.length > 0 ? null : 'disabled')

                      // Clicks the history button
                      historyBtn.click(function() {
                        // Remove all rendered items
                        historyItemsContainer.html('')

                        // Get the saved history items
                        savedHistoryItems = Store.get(clusterID) || []

                        // Reverse the array; to make the last saved item the first one in the list
                        savedHistoryItems.reverse()

                        // Define index to be set for each history item
                        let index = 0

                        // Loop through each saved history item
                        for (let historyItem of savedHistoryItems) {
                          // Decrement the index
                          index += 1

                          // The history item structure UI
                          let element = `
                              <div class="history-item" data-index="${index}">
                                <div class="index">${index < 10 ? '0' : ''}${index}</div>
                                <div class="inner-content">
                                  <pre>${historyItem}</pre>
                                </div>
                                <div class="click-area"></div>
                                <div class="action-copy">
                                  <span class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                    <ion-icon name="copy-solid"></ion-icon>
                                  </span>
                                </div>
                                <div class="action-delete">
                                  <span class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button">
                                    <ion-icon name="trash"></ion-icon>
                                  </span>
                                </div>
                              </div>`

                          // Append the history item
                          historyItemsContainer.append($(element).show(function() {
                            // Point at the statement input field
                            let statementInputField = $(`textarea#_${cqlshSessionStatementInputID}`)

                            // Clicks the item to be typed in the input field
                            $(this).find('div.click-area').click(function() {
                              // Get the index of the saved item in the array
                              let statementIndex = parseInt($(this).parent().attr('data-index')) - 1,
                                // Get the statement's content
                                statement = savedHistoryItems[statementIndex]

                              // Set the statement
                              statementInputField.val(statement).trigger('input').focus()

                              // Update the size of the textarea
                              AutoSize.update(statementInputField[0])

                              // Update the MDB object
                              try {
                                getElementMDBObject(statementInputField).update()
                              } catch (e) {}

                              // Click the backdrop element to close the history items' container
                              $(`div.backdrop:last`).click()
                            })

                            $(this).find('div.action-copy').find('span.btn').click(() => {
                              let statement = $(this).find('div.inner-content').children('pre').text(),
                                icon = $(this).find('div.action-copy').find('span.btn').children('ion-icon')

                              // Copy the result to the clipboard
                              try {
                                Clipboard.writeText(statement)

                                icon.attr('name', 'copy')

                                setTimeout(() => icon.attr('name', 'copy-solid'), 150);
                              } catch (e) {
                                try {
                                  errorLog(e, 'connections')
                                } catch (e) {}
                              }

                            })

                            // Delete a history item
                            $(this).find('div.action-delete').find('span.btn').click(function() {
                              // Get the index of the saved item in the array
                              let statementIndex = parseInt($(this).parent().parent().attr('data-index')) - 1

                              // Remove the history item from the array
                              savedHistoryItems.splice(statementIndex, 1)

                              // Reverse the array before save it
                              savedHistoryItems.reverse()

                              // Set the manipulated array
                              Store.set(clusterID, [...new Set(savedHistoryItems)])

                              try {
                                if (savedHistoryItems.length > 0)
                                  throw 0

                                // Click the backdrop element to close the history items' container
                                $(`div.backdrop:last`).click()

                                // Disable the history button
                                historyBtn.attr('disabled', 'disabled')

                                // Skip the upcoming code
                                return
                              } catch (e) {}

                              // Click the history button to update the items' list
                              historyBtn.click()
                            })

                            // Apply the chosen language on the UI element after being fully loaded
                            setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                          }))
                        }

                        // Show the history items' container
                        historyItemsContainer.addClass('show')

                        // If a backdrop element already rendered then skip the upcoming code
                        if ($('body').find('div.backdrop').length > 0)
                          return

                        // Add a backdrop element
                        $('body').append($(`<div class="backdrop"></div>`).show(function() {
                          // Show it with animation
                          setTimeout(() => $(this).addClass('show'), 50)

                          // Once it's clicked
                          $(this).click(function() {
                            // Remove it
                            $(this).remove()

                            // Hide the history items' container
                            historyItemsContainer.removeClass('show')
                          })
                        }))
                      })
                    }
                  }))
                })
              })
              // End the process when we attempt to connect with a cluster by clicking the `CONNECT` button

              // Flag to tell if the starting process of docker/sandbox project ha been terminated or not
              let isStartingProcessTerminated = false

              // This try-catch block is only for the sandbox/docker projects
              try {
                // If the current workspace is not the sandbox/docker then skip this try-catch block
                if (!isSandbox)
                  throw 0

                /**
                 * Handle the `click` event on the `START` button - which is shown only for the sandbox projects -
                 * The handler takes two parameters:
                 * One is `restart` which tells if the process is restarting the project's work area
                 * Other is `instant` which tells if the animation and transitions should not be applied
                 */
                $(`button[button-id="${startProjectBtnID}"]`).on('click', function(_, restart = false, instant = false) {
                  // Point at the project's work area
                  let projectWorkarea = $(`div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`)

                  // Enable the process termination button
                  $(`div.btn[button-id="${terminateProcessBtnID}"]`).removeClass('disabled')

                  // If exists then click the hidden `CONNECT` button and skip the upcoming code
                  if (projectWorkarea.length > 0)
                    return $(`button[button-id="${connectBtnID}"]`).trigger('click')

                  // Get the app's config
                  Modules.Config.getConfig((config) => {
                    // Get the maximum allowed number of running projects at the same time
                    let maximumRunningSandbox = parseInt(config.get('limit', 'sandbox')),
                      // Get the number of currently running projects
                      numRunningSandbox = $(`div[content="workarea"] div.workarea:not([cluster-id*="cluster-"])`).length,
                      // Get the number of currently attempting-to-start projects
                      numAttemptingSandbox = $(`div[content="clusters"] div.clusters-container div.cluster[data-is-sandbox="true"].test-connection`).length

                    // Add log for this request
                    try {
                      addLog(`Request to start a local cluster '${getAttributes(clusterElement, ['data-id'])}'`, 'action')
                    } catch (e) {}

                    // Manipulate the maximum number, set it to the default value `1` if needed
                    maximumRunningSandbox = isNaN(maximumRunningSandbox) || maximumRunningSandbox < 1 ? 1 : maximumRunningSandbox

                    // If the currently running projects are more than or equal to the maximum allowed number then end the process and show feedback to the user
                    if (([numRunningSandbox, numAttemptingSandbox]).some((num) => num >= maximumRunningSandbox))
                      return showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the maximum number of local clusters which allowed to be started simultaneously is [b]$data[/b]', [maximumRunningSandbox])) + `.<br><br>` + I18next.capitalizeFirstLetter(I18next.t('this limit can be changed from the app\'s settings in the limits section')) + `.`, 'failure')

                    // Inner function to execute the post-start code
                    let startPostProcess = (success = false) => {
                      // Enable the `START` button again
                      $(this).removeAttr('disabled')

                      // Remove the starting - test connection - state
                      clusterElement.removeClass('test-connection enable-terminate-process')

                      // Hide the termination process' button after a set time out
                      setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                      // Remove any indicators about the state of start/connecting
                      clusterElement.children('div.status').removeClass('show success failure')

                      // If the start process failed and the process hasn't been terminated then skip the upcoming code
                      if (!success && !isStartingProcessTerminated) {
                        /**
                         * Create a pinned toast to show the output of the stopping process
                         *
                         * Get a random ID for the toast
                         */
                        let pinnedToastID = getRandomID(10)

                        // Show/create that toast
                        showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('stop local cluster')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                        // Stop the docker/sandbox project as an error has been occurred
                        Modules.Docker.getDockerInstance(clusterElement).stopDockerCompose(pinnedToastID, () => {})

                        // Skip the upcoming code
                        return
                      }

                      // Add success state
                      clusterElement.children('div.status').addClass('show success')
                    }

                    // Disable the button
                    $(this).attr('disabled', '')

                    // Add a starting class
                    clusterElement.addClass('test-connection')

                    // Show the termination process' button
                    setTimeout(() => clusterElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                    // Get the ports of the project
                    Modules.Docker.getPortsFromYAMLFile(getAttributes(clusterElement, 'data-folder')).then(async (ports) => {
                      // Update attributes that hold the project's ports
                      clusterElement.attr({
                        'data-port-cassandra': ports.cassandra,
                        'data-port-axonops': ports.axonops
                      })

                      try {
                        // Get all saved projects' objects
                        let projects = await Modules.Docker.getProjects()

                        // Get the current project's object
                        let currentProject = projects.filter((project) => project.folder == getAttributes(clusterElement, 'data-folder'))

                        // Set Cassandra®'s version
                        clusterElement.attr('data-cassandra-version', currentProject[0].cassandraVersion)
                      } catch (e) {
                        try {
                          errorLog(e, 'connections')
                        } catch (e) {}
                      }

                      /**
                       * Create a pinned toast to show the output of the process
                       *
                       * Get a random ID for the toast
                       */
                      let pinnedToastID = getRandomID(10)

                      // Show/create that toast
                      showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('start local cluster')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                      // Check the existence of Docker in the machine
                      Modules.Docker.checkDockerCompose((dockerExists, userGroup) => {
                        // If Docker doesn't exist then show feedback to the user and skip the upcoming code
                        if (!dockerExists) {
                          showToast(I18next.capitalize(I18next.t('create local cluster')), I18next.capitalizeFirstLetter(I18next.t('local clusters feature requires [code]docker compose[/code] or [code]docker-compose[/code] tool to be installed, please make sure it\'s installed and accessible before attempting to create a local cluster')) + '.', 'failure')

                          startPostProcess()

                          return
                        }

                        // If the current user is not in the `docker` group
                        if (!userGroup) {
                          showToast(I18next.capitalize(I18next.t('create local cluster')), I18next.capitalizeFirstLetter(I18next.t('local clusters feature requires the current user to be in the [code]docker[/code] group in [b]Linux[/b], please make sure this requirement is met then try again')) + '.', 'failure')

                          startPostProcess()

                          return
                        }

                        // Set the flag to be `false`
                        isStartingProcessTerminated = false

                        // Show feedback to the user about starting the project
                        showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('local cluster [b]$data[/b] is about to start, a notification will show up once the process begins', [getAttributes(clusterElement, 'data-name')])) + '.')

                        Modules.Docker.checkProjectIsRunning(getAttributes(clusterElement, 'data-folder'), (isProjectRunning) => {
                          if (isProjectRunning) {
                            showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the local cluster [b]$data[/b] seems be running or stopping, the app will shortly attempt to terminate it', [getAttributes(clusterElement, 'data-name')])) + `. `, 'warning')

                            // Call the termination button
                            $(`div.btn[button-id="${terminateProcessBtnID}"]`).addClass('disabled').click()

                            // Skip the upcoming code
                            return
                          }

                          // Start the project
                          Modules.Docker.getDockerInstance(clusterElement).startDockerCompose(pinnedToastID, (feedback) => {
                            // The project didn't run as expected or the starting process has been terminated
                            if (!feedback.status || isStartingProcessTerminated) {
                              // Show failure feedback to the user if the process hasn't been terminated
                              if (!isStartingProcessTerminated)
                                showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, it seems the local cluster [b]$data[/b] didn\'t run as expected', [getAttributes(clusterElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                              // Call the post function
                              startPostProcess()

                              // Skip the upcoming code
                              return
                            }

                            // Show success feedback to the user
                            showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('local cluster [b]$data[/b] has been successfully started, waiting for Apache Cassandra® to be up, you\'ll be automatically navigated to the local cluster work area once it\'s up', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                            // Remove all previous states
                            clusterElement.children('div.status').removeClass('success failure').addClass('show')

                            // Update the process ID
                            checkCassandraProcessID = getRandomID(20)

                            // Define variables which will hold important timeout and interval functions
                            let checkingCassandraTimeout, checkingTerminationInterval

                            checkingTerminationInterval = setInterval(() => {
                              // If the checking process is flagged to be terminated
                              try {
                                if (checkCassandraProcessID != 'terminated')
                                  throw 0

                                // Request to destroy the associated pinned toast
                                updatePinnedToast(pinnedToastID, true, true)

                                // Clear the checking trigger timeout
                                clearTimeout(checkingCassandraTimeout)

                                // Clear the termination checking interval
                                clearInterval(checkingTerminationInterval)
                              } catch (e) {}
                            }, 500)

                            checkingCassandraTimeout = setTimeout(() => {
                              // Make sure to clear the termination check interval
                              try {
                                clearInterval(checkingTerminationInterval)
                              } catch (e) {}

                              // Define inner flag to tell if the process has been terminated
                              let isTerminated = false

                              // Start watching Cassandra®'s node inside the project
                              Modules.Docker.checkCassandraInContainer(pinnedToastID, ports.cassandra, (status) => {
                                try {
                                  clusterElement.attr('data-latest-cassandra-version', `${status.version}`)
                                } catch (e) {}

                                // If the process has been terminated then skip the upcoming code and stop the process
                                if (status.terminated || isTerminated) {
                                  // Update the associated flag
                                  isTerminated = true

                                  // Skip the upcoming code
                                  return
                                }

                                // Failed to connect with the node
                                if (!status.connected) {
                                  // Show a failure feedback to the user
                                  showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, it seems the Apache Cassandra® nodes of the local cluster [b]$data[/b] didn\'t start as expected, automatic stop of the local cluster will be started in seconds', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                                  /**
                                   * Create a pinned toast to show the output of the process
                                   *
                                   * Get a random ID for the toast
                                   */
                                  let pinnedToastID = getRandomID(10)

                                  // Show/create that toast
                                  showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('start local cluster')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                                  setTimeout(() => {
                                    // Attempt to stop the project
                                    Modules.Docker.getDockerInstance(clusterElement).stopDockerCompose(pinnedToastID, (feedback) => {
                                      // Call the post function
                                      startPostProcess()

                                      /**
                                       * Failed to stop the project
                                       * Show failure feedback to the user and tell how to stop it manually
                                       */
                                      if (!feedback.status)
                                        return showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to stop the local cluster [b]$data[/b], please consider to do it manually by stopping the project [b]cassandra_$data[/b]', [getAttributes(clusterElement, 'data-name'), getAttributes(clusterElement, 'data-folder')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                                      // The Docker project has successfully stopped
                                      showToast(I18next.capitalize(I18next.t('stop local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the local cluster [b]$data[/b] has been successfully stopped', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')
                                    })
                                  }, 3000)

                                  // Skip the upcoming code
                                  return
                                }

                                // Disable the process termination button
                                $(`div.btn[button-id="${terminateProcessBtnID}"]`).addClass('disabled')

                                /**
                                 * Successfully started the project and Cassandra®'s one node at least is up
                                 * Show feedback to the user
                                 */
                                showToast(I18next.capitalize(I18next.t('start local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('apache Cassandra® nodes of the local cluster [b]$data[/b] has been successfully started and ready to be connected with, work area will be created and navigated to in seconds', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                                // Request to destroy the associated pinned toast
                                updatePinnedToast(pinnedToastID, true, true)

                                // Update the data center title
                                clusterElement.attr('data-datacenter', 'datacenter1')

                                setTimeout(() => {
                                  // Click the hidden `CONNECT` button
                                  $(`button[button-id="${connectBtnID}"]`).trigger('click')

                                  // Update the button's text to be `ENTER`
                                  setTimeout(() => $(this).children('span').attr('mulang', 'enter').text(I18next.t('enter')), 1000)

                                  setTimeout(() => {
                                    // Call the post function
                                    startPostProcess(true)

                                    try {
                                      // Get the chosen port and the final URL
                                      let axonopsPort = getAttributes(clusterElement, 'data-port-axonops'),
                                        axonopsURL = `http://localhost:${axonopsPort}`

                                      // If the provided port is not actually a number then skip this try-catch block
                                      if (isNaN(axonopsPort))
                                        throw 0

                                      // Append the `webview`
                                      $(`div.tab-pane#_${axonopsContentID}`).append($(`<webview src="${axonopsURL}" nodeIntegrationInSubFrames nodeintegration preload="${Path.join(__dirname, '..', 'js', 'axonops_agent_webview.js')}"></webview>`).show(function() {
                                        // Point at the webview element
                                        let webView = $(this)[0]

                                        // Reload it after 1s of creation
                                        try {
                                          setTimeout(() => webView.reloadIgnoringCache(), 1000)
                                        } catch (e) {}

                                        // Once the content inside the webview is ready/loaded
                                        webView.addEventListener('dom-ready', () => {
                                          // Once a message from the IPC is received
                                          webView.addEventListener(`ipc-message`, (event) => {
                                            // If it's a request to reload the webview then reload it
                                            if (event.channel == 'reload-webview')
                                              webView.reloadIgnoringCache()
                                          })
                                        })
                                      }))

                                      // Clicks the globe icon in the cluster's info
                                      $(`div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`).find('div.axonops-agent').click(() => Open(axonopsURL))
                                    } catch (e) {}
                                  }, 1000)
                                }, 3000)
                              }, null, checkCassandraProcessID)
                            }, 20000)
                          })
                        })
                      })
                    })
                  })
                })
              } catch (e) {
                try {
                  errorLog(e, 'connections')
                } catch (e) {}
              }

              // Clicks the settings button
              $(`div.btn[button-id="${settingsBtnID}"]`).click(async function() {
                /**
                 * The `Add New Cluster` dialog will be used after making tweaks to it
                 *
                 * Define the dialog path's CSS selector
                 */
                let dialog = 'div.modal#addEditClusterDialog',
                  // Get the cluster's ID
                  clusterID = $(this).attr('reference-id'),
                  // Point at the cluster element in the UI
                  clusterElement = $(`div.clusters div.cluster[data-id="${clusterID}"]`),
                  // Determine if the cluster has an active work area
                  hasWorkarea = getAttributes(clusterElement, 'data-workarea')

                // Add log about edit cluster
                try {
                  addLog(`Attempt to edit local cluster '${getAttributes(clusterElement, ['data-name', 'data-id'])}'`, 'action')
                } catch (e) {}

                // If the cluster has an active work area then stop the process and show feedback to the user
                if (hasWorkarea == 'true')
                  return showToast(I18next.capitalize(I18next.t('connection settings')), I18next.capitalizeFirstLetter(I18next.replaceData('this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to edit it', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                // Change the dialog's title
                $(`${dialog}`).find('h5.modal-title').text(`${I18next.capitalize(I18next.t('connection settings'))} ${getAttributes(clusterElement, 'data-name')}`)

                // Update the workspace's name badge
                $(`${dialog}`).find('div.modal-header span.badge.badge-secondary').text(getWorkspaceName(workspaceID))

                // Change and add some attributes to the dialog
                $(`${dialog}`).attr({
                  'data-edit-workspace-id': workspaceID, // Change the workspace's ID
                  'data-edit-cluster-id': clusterID // This attribute tells that the dialog is in the `Editing` mode
                })

                // Change the primary button's text
                $(`button#addCluster`).text(I18next.t('update connection'))

                $('div.modal#addEditClusterDialog div.modal-body div.side-left div.sections div.section div.btn[section="basic"]').click()

                /**
                 * Reset some elements in the dialog
                 *
                 * Disable the save/edit button
                 */
                $('button#addCluster').attr('disabled', 'disabled')
                // Hide passwords
                $(`[info-section="none"][info-key="password"]`).attr('type', 'password')
                $('span.reveal-password div.btn ion-icon').attr('name', 'eye-opened')

                // Get all clusters in the workspace
                let allClusters = await Modules.Clusters.getClusters(workspaceID),
                  // Get the target cluster that we want to edit/update
                  currentCluster = allClusters.find((_cluster) => _cluster.info.id == clusterID)

                // If the app wasn't able to get the target cluster then give feedback to the user and stop the editing process
                if (currentCluster == undefined)
                  return showToast(I18next.capitalize(I18next.t('connection settings')), I18next.capitalizeFirstLetter(I18next.replaceData('unable to locate the workspace folder of connection [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                // Define this variable as a copy of the cluster's object before starting the edit
                editedClusterObject = currentCluster

                /**
                 * Change the value of the editor to the cluster's `cqlsh.rc` file's content
                 * There's a `change` listener that will perform all needed changes; as we've already handled that in the listener
                 */
                editor.setValue(currentCluster.cqlshrc)

                setTimeout(() => {
                  // Define inputs that are not in the `cqlsh.rc` file; to handle them separately
                  let inputs = [{
                    section: 'none',
                    key: 'clusterName',
                    val: currentCluster.name
                  }, {
                    section: 'none',
                    key: 'datacenter',
                    val: currentCluster.info.datacenter
                  }]

                  // Handle all SSH related input fields/file selectors
                  try {
                    // If there's a saved destination address, and it is not `127.0.0.1` then show it to the user
                    inputs.push({
                      section: 'none',
                      key: 'ssh-dest-addr',
                      val: !([undefined, '127.0.0.1'].includes(currentCluster.ssh.dstAddr)) ? currentCluster.ssh.dstAddr : ''
                    })

                    // If we have a private key then show it to the user
                    inputs.push({
                      section: 'none',
                      key: 'ssh-privatekey',
                      val: (currentCluster.ssh.privatekey != undefined) ? currentCluster.ssh.privatekey : ''
                    })

                    // If we have a passphrase then show it to the user
                    inputs.push({
                      section: 'none',
                      key: 'ssh-passphrase',
                      val: (currentCluster.ssh.passphrase != undefined) ? currentCluster.ssh.passphrase : ''
                    })

                    // If there's a saved destination port, and it is not the same as the connection port then show it as well
                    inputs.push({
                      section: 'none',
                      key: 'ssh-dest-port',
                      val: (currentCluster.ssh.dstPort != undefined && $('input[info-section="connection"][info-key="port"]').val() != currentCluster.ssh.dstPort) ? currentCluster.ssh.dstPort : ''
                    })

                    // Do the same process to the SSH host
                    inputs.push({
                      section: 'none',
                      key: 'ssh-host',
                      val: (currentCluster.ssh.host != undefined && $('input[info-section="connection"][info-key="hostname"]').val() != currentCluster.ssh.host) ? currentCluster.ssh.host : ''
                    })

                    // And the SSH port as well
                    inputs.push({
                      section: 'none',
                      key: 'ssh-port',
                      val: (!([undefined, '22'].includes(currentCluster.ssh.port))) ? currentCluster.ssh.port : ''
                    })
                  } catch (e) {
                    try {
                      errorLog(e, 'connections')
                    } catch (e) {}
                  }

                  // Loop through all inputs in the `inputs` array and set their proper values
                  inputs.forEach((input) => {
                    // Get the MDB object for the current input
                    let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                    // Set its saved value
                    $(object._element).find('input').val(input.val)

                    // Update the object
                    object.update()
                    object._deactivate()

                    // If the current input is not a file selector then skip this try-catch block
                    if ($(object._element).attr('file-name') == undefined)
                      return

                    /**
                     * Update the tooltip's content and state
                     * Get the object
                     */
                    let tooltipObject = getElementMDBObject($(object._element).find('input'), 'Tooltip')

                    // Set the selected file's path
                    $(object._element).find('input').val(input.val).trigger('input')
                    $(object._element).attr('file-name', input.val.length <= 0 ? '-' : Path.basename(input.val))

                    // Handle the tooltip
                    try {
                      // If the value is acutally empty then attempt to disable the tooltip
                      if (input.val.length <= 0)
                        throw 0

                      // Enable the tooltip and update its content
                      tooltipObject.enable()
                      tooltipObject.setContent(input.val)
                    } catch (e) {
                      try {
                        // Disable the tooltip
                        tooltipObject.disable()
                      } catch (e) {}
                    }
                  })

                  // Check username and password existence for Apache Cassandra® and SSH tunnel
                  let username = '',
                    password = '',
                    sshUsername = '',
                    sshPassword = ''

                  // If there are saved secrets for the cluster
                  if (currentCluster.info.secrets != undefined) {
                    try {
                      // Get the private key; to decrypt secrets and show them in the dialog
                      getKey('private', (key) => {
                        // If the key is empty then something is not correct with the generator tool
                        if (key.length <= 0)
                          return showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                        // Try to decrypt both; username and password
                        username = decrypt(key, currentCluster.info.secrets.username)
                        password = decrypt(key, currentCluster.info.secrets.password)

                        // Empty the `inputs` array
                        inputs = []

                        // Push new secrets in the `inputs` array
                        inputs.push({
                          section: 'none',
                          key: 'username',
                          val: username
                        }, {
                          section: 'none',
                          key: 'password',
                          val: password
                        })

                        // Check if SSH username is provided
                        try {
                          if (currentCluster.info.secrets.sshUsername == undefined)
                            throw 0

                          // Decrypt the SSH username
                          sshUsername = decrypt(key, currentCluster.info.secrets.sshUsername)

                          // Push it to the `inputs` array; to be shown in the dialog
                          inputs.push({
                            section: 'none',
                            key: 'ssh-username',
                            val: sshUsername
                          })
                        } catch (e) {
                          try {
                            errorLog(e, 'connections')
                          } catch (e) {}
                        }

                        // Check if SSH password is provided
                        try {
                          if (currentCluster.info.secrets.sshPassword == undefined)
                            throw 0

                          // Decrypt the SSHS password
                          sshPassword = decrypt(key, currentCluster.info.secrets.sshPassword)

                          // Push it to the `inputs` array
                          inputs.push({
                            section: 'none',
                            key: 'ssh-password',
                            val: sshPassword
                          })
                        } catch (e) {
                          try {
                            errorLog(e, 'connections')
                          } catch (e) {}
                        }

                        // Loop through secrets' inputs and set their value
                        inputs.forEach((input) => {
                          // Get the MDB object for the current input
                          let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                          // Set its saved value
                          $(object._element).find('input').val(input.val)

                          // Update the object
                          object.update()
                          object._deactivate()
                        })
                      })
                    } catch (e) {
                      try {
                        errorLog(e, 'connections')
                      } catch (e) {}
                    }
                  } else {
                    /**
                     * There are no saved secrets for the cluster
                     *
                     * Empty the `inputs` array
                     */
                    inputs = []

                    // Push the secrets' input fields
                    inputs.push({
                      section: 'none',
                      key: 'username',
                    }, {
                      section: 'none',
                      key: 'password',
                    }, {
                      section: 'none',
                      key: 'ssh-username',
                    }, {
                      section: 'none',
                      key: 'ssh-password',
                    }, {
                      section: 'none',
                      key: 'ssh-privatekey',
                    })

                    // Loop through the input fields and empty them
                    inputs.forEach((input) => {
                      // Get the MDB object for the current input
                      let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                      // Set its saved value
                      $(object._element).find('input').val('')

                      // Update the object
                      object.update()
                      object._deactivate()

                      // If the current input is not a file selector then skip this try-catch block
                      if ($(object._element).attr('file-name') == undefined)
                        return

                      /**
                       * Update the tooltip's content and state
                       * Get the object
                       */
                      let tooltipObject = getElementMDBObject($(object._element).find('input'), 'Tooltip')

                      try {
                        // Disable the tooltip
                        tooltipObject.disable()
                      } catch (e) {}
                    })
                  }

                  // Open the `Add New Cluster` dialog
                  $(`button#addClusterProcess`).trigger('click', true)
                })
                // The rest actions and events related to the dialog are handled in the dialog buttons events listeners
              })

              // Clicks the delete button
              $(`div.btn[button-id="${deleteBtnID}"]`).click(function() {
                // Define the confirm's text
                let confirmText = I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the connection [b]$data[/b] in the workspace [b]$data[/b]?', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)]))

                // Add log
                try {
                  addLog(`Request to delete ${isSandbox ? 'local cluster' : 'connection'} ${getAttributes(clusterElement, ['data-name', 'data-id'])}`, 'action')
                } catch (e) {}

                // If the current workspace is sandbox then change the text
                if (isSandbox)
                  confirmText = I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the local cluster [b]$data[/b]?', [getAttributes(clusterElement, 'data-name')]))

                // Open the confirmation dialog and wait for the response
                openDialog(confirmText, (response) => {
                  // If canceled, or not confirmed then skip the upcoming code
                  if (!response.confirmed)
                    return

                  // Get the project/cluster work area
                  let clusterWorkarea = $(`div[content="workarea"] div.workarea[cluster-id="${getAttributes(clusterElement, 'data-folder')}"]`)

                  // If there's a work area already then stop the deletion process
                  if (clusterWorkarea.length != 0)
                    return showToast(I18next.capitalize(I18next.t('delete local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('there\'s an active work area for the local cluster [b]$data[/b], please consider to close it before attempting to delete the local cluster again', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                  try {
                    // If the current workspace is not the sandbox then skip this try-catch block
                    if (!isSandbox)
                      throw 0

                    // Attempt to delete the project
                    Modules.Docker.deleteProject(getAttributes(clusterElement, 'data-folder'), response.checked).then((status) => {
                      // Failed to delete the project
                      if (!status)
                        return showToast(I18next.capitalize(I18next.t('delete local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to delete the local cluster [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                      // Successfully deleted the project
                      showToast(I18next.capitalize(I18next.t('delete local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the local cluster [b]$data[/b] has been successfully deleted', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                      // Point at the projects' container
                      let projectsContainer = $(`div.clusters-container div.clusters[workspace-id="${workspaceID}"]`)

                      // Remove the deleted project's UI element
                      projectsContainer.children(`div.cluster[data-workspace-id="${workspaceID}"][data-folder="${getAttributes(clusterElement, 'data-folder')}"]`).remove()

                      // Refresh projects' list
                      $(document).trigger('refreshClusters', workspaceID)
                    })

                    // Skip the upcoming code - no need to execute it if the workspace is the sandbox -
                    return
                  } catch (e) {}

                  // Call the cluster's deletion function from the clusters' module
                  Modules.Clusters.deleteCluster(getWorkspaceFolderPath(workspaceID), getAttributes(clusterElement, 'data-folder'), clusterID, (result) => {
                    // If the deletion process failed then show feedback to the user and skip the upcoming code
                    if (!result)
                      return showToast(I18next.capitalize(I18next.t('delete connection')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to delete connection [b]$data[/b] in workspace [b]$data[/b], please check that it\'s exists, and the app has permission to access the workspace folder', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'failure')

                    /**
                     * The cluster has successfully been deleted
                     *
                     * Send the `quit` command
                     */
                    IPCRenderer.send('pty:command', {
                      id: clusterID,
                      cmd: 'quit'
                    })

                    // Request to entirely close the pty instance
                    IPCRenderer.send('pty:close', clusterID)

                    // Close the SSH tunnel if it exists
                    try {
                      IPCRenderer.send('ssh-tunnel:close', clusterID)
                    } catch (e) {}

                    // Attempt to close the work area of the cluster if exists
                    try {
                      $(`div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`).find('div.action[action="close"] div.btn-container div.btn').click()
                    } catch (e) {}

                    // Remove the target workspace element
                    $(`div.clusters div.cluster[data-id="${clusterID}"]`).remove()

                    // Refresh clusters' list
                    $(document).trigger('refreshClusters', workspaceID)

                    // Refresh workspaces' list
                    $(document).trigger('getWorkspaces')

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('delete connection')), I18next.capitalizeFirstLetter(I18next.replaceData('connection [b]$data[/b] in workspace [b]$data[/b] has been successfully deleted', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'success')
                  }, response.checked)
                }, false, 'keep the associated files in the system')
              })

              // Clicks the folder button
              $(`div.btn[button-id="${folderBtnID}"]`).click(() => {
                // Define the initial element's path variable
                let elementPath = ''

                try {
                  // If the current workspace is the sandbox then skip this try-catch block
                  if (isSandbox)
                    throw 0

                  // Get the cluster's path
                  elementPath = Path.join(getWorkspaceFolderPath(getAttributes(clusterElement, 'data-workspace-id')), getAttributes(clusterElement, 'data-folder'))
                } catch (e) {
                  // Get the sandbox project's path
                  elementPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'localclusters', getAttributes(clusterElement, 'data-folder'))
                }

                // Open the final path
                Open(elementPath)
              })

              // Clicks the process termination button
              $(`div.btn[button-id="${terminateProcessBtnID}"]`).click(() => {
                // Disable this button while processing
                $(`div.btn[button-id="${terminateProcessBtnID}"]`).addClass('disabled')

                try {
                  // If the current cluster is not actually a docker/sandbox project then skip this try-catch block
                  if (!isSandbox)
                    throw 0

                  // Set the flag to be `true`
                  isStartingProcessTerminated = true

                  /**
                   * Create a pinned toast to show the output of the process
                   *
                   * Get a random ID for the toast
                   */
                  let pinnedToastID = getRandomID(10)

                  // Show/create that toast
                  showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('terminate local cluster')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                  // Send request to the main thread to terminate the connection test process - if there's any -
                  try {
                    IPCRenderer.send(`pty:test-connection:terminate`, checkCassandraProcessID)
                  } catch (e) {}

                  // Update the ID to be `terminated`; to stop the checking process from being started if it's not yet
                  checkCassandraProcessID = 'terminated'

                  // Attempt to close/stop the docker project
                  Modules.Docker.getDockerInstance(clusterElement).stopDockerCompose(pinnedToastID, (feedback) => {
                    /**
                     * Failed to close/stop the project
                     * Show feedback to the user and skip the upcoming code
                     */
                    if (!feedback.status)
                      return showToast(I18next.capitalize(I18next.t('terminate local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] were not successfully stopped', [getAttributes(clusterElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                    /**
                     * Successfully closed/stopped
                     * Show feedback to the user
                     */
                    showToast(I18next.capitalize(I18next.t('terminate local cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the local cluster [b]$data[/b] have been successfully stopped', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                    // Reset the sandbox project's element in the clusters/sandbox projects container
                    clusterElement.removeClass('test-connection enable-terminate-process')
                    clusterElement.find('button').removeAttr('disabled')
                    clusterElement.children('div.status').removeClass('show success')

                    // Hide the termination process' button after a set time out
                    setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
                  })

                  // Skip the upcoming code
                  return
                } catch (e) {}

                try {
                  if (!isSSHTunnelNeeded)
                    throw 0

                  // Attempt to close the SSH tunnel if it has already been created
                  try {
                    IPCRenderer.send('ssh-tunnel:close', clusterID)
                  } catch (e) {}

                  // Send a request to terminate the SSH tunnel creation process
                  IPCRenderer.send(`ssh-tunnel:terminate`, sshTunnelCreationRequestID)

                  // Show success feedback to the user
                  showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData('the testing process for the connection [b]$data[/b] in workspace [b]$data[/b] has been terminated with success', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)]) + '.'), 'success')
                } catch (e) {}

                // Send request to the main thread to terminate the current ongoing connection test process
                IPCRenderer.send(`process:terminate:${testConnectionProcessID}`)

                // Make sure to remove all previous listeners to prevent duplication
                IPCRenderer.removeAllListeners(`process:terminate:${testConnectionProcessID}:result`)

                // Once the termination status is received
                if (!isSSHTunnelNeeded)
                  IPCRenderer.on(`process:terminate:${testConnectionProcessID}:result`, (_, status) => showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData(status ? 'the testing process for the connection [b]$data[/b] in workspace [b]$data[/b] has been terminated with success' : 'something went wrong, failed to terminate the testing process of connection [b]$data[/b] in workspace [b]$data[/b]', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)]) + '.'), status ? 'success' : 'failure'))
              })
            })
            // End of handling the `click` events for actions buttons

            /**
             * Inner function to request a pty instance creation from the main thread
             * It has been defined inside the clusters' loop as it needs a lot of real-time created elements
             *
             * @Parameters:
             * {object} `readLine` is the read line object that has been created for the terminal, the terminal object itself can be passed too
             */
            let requestPtyInstanceCreation = async (readLine, info) => {
              try {
                // Get the workspace's folder path
                let workspaceFolderPath = getWorkspaceFolderPath(workspaceID),
                  // Get the current cluster's folder path
                  clusterFolder = Path.join(workspaceFolderPath, getAttributes(clusterElement, 'data-folder'))

                // Get the `cqlsh.rc` config file's path for the current cluster
                let cqlshrcPath = Path.join(clusterFolder, 'config', 'cqlsh.rc'),
                  // Get Apache Cassandra®'s version
                  version = getAttributes(clusterElement, 'data-latest-cassandra-version') || getAttributes(clusterElement, 'data-cassandra-version')

                // Print the host and Apache Cassandra®'s version in the terminal
                // terminalPrintMessage(readLine, 'info', `Connecting with host ${getAttributes(clusterElement, 'data-host')}`)
                // terminalPrintMessage(readLine, 'info', `Detected Apache Cassandra® version is ${version}`)

                // Show it in the interactive terminal
                addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandomID(10), `Connecting with host ${getAttributes(clusterElement, 'data-host')}.`, null, true, 'neutral')
                addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandomID(10), `Detected Apache Cassandra® version is ${version}.`, null, true, 'neutral')

                $(`div.body div.right div.content div[content="workarea"] div.workarea[cluster-id="${clusterElement.attr('data-id')}"]`).find('div.info[info="cassandra"]').children('div.text').text(`v${version}`)

                /**
                 * Check some options in the `cqlsh.rc` file
                 * If we aren't able to do this the code flow will continue and no need to notify the user about that
                 */
                try {
                  // Read the `cqlsh.rc` file
                  FS.readFile(cqlshrcPath, 'utf8', (err, content) => {
                    // With an error occurs stop the checking process
                    if (err) {
                      try {
                        errorLog(err, 'clusters')
                      } catch (e) {}

                      return
                    }

                    // Convert content to UTF-8 string
                    content = content.toString()

                    // Convert the `cqlsh.rc` file's content to an array of sections and options
                    Modules.Clusters.getCQLSHRCContent(workspaceID, content, editor).then((result) => {
                      /**
                       * Check SSL
                       *
                       * Set its status to be enabled by default
                       */
                      clusterElement.attr('ssl-enabled', 'true')

                      // Check if SSL is disabled
                      try {
                        // If SSL is enabled then skip this try-catch block
                        if (!([undefined, 'false'].includes(result.connection.ssl)))
                          throw 0

                        // Print message in the terminal
                        // terminalPrintMessage(readLine, 'warn', 'SSL is not enabled, the connection is not encrypted and is being transmitted in the clear')

                        // Show it in the interactive terminal
                        addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandomID(10), `SSL is not enabled, the connection is not encrypted and is being transmitted in the clear.`, null, true, 'warning')

                        // Update the SSL attribute
                        clusterElement.attr('ssl-enabled', 'false')
                      } catch (e) {}

                      // Update the lockpad status
                      updateSSLLockpadStatus(clusterElement)
                    })
                  })
                } catch (e) {
                  try {
                    errorLog(e, 'connections')
                  } catch (e) {}
                }

                // Show feedback to the user when the connection is established through the SSH tunnel
                if (sshTunnelsObjects[clusterID] != null) {
                  // terminalPrintMessage(readLine, 'info', 'The connection is encrypted and transmitted through an SSH tunnel')

                  // Show it in the interactive terminal
                  addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandomID(10), `The connection is encrypted and transmitted through an SSH tunnel.`, null, true, 'neutral')
                }

                /**
                 * The connection creation object
                 * The initial data: The cluster's ID, its `cqlsh.rc` config file path, Apache Cassandra®'s version, and the log file path for this connection session
                 */
                let creationData = {
                  id: clusterID,
                  cqlshrc: cqlshrcPath,
                  version,
                  logPath: Path.join(clusterFolder, 'logs', `${machineID} - ${formatTimestamp((new Date()).getTime())}.log`)
                }

                // Check if username and password are provided
                try {
                  // Get them from the cluster's attributes
                  let [username, password] = getAttributes(clusterElement, ['data-username', 'data-password'])

                  // Make sure both are defined, and not empty
                  if ([username, password].some((secret) => secret == undefined || secret.trim().length <= 0))
                    throw 0

                  // Add them in the `creationData.secrets`
                  creationData.secrets = {
                    username: username,
                    password: password
                  }

                  // As username exists; decrypt it and check if it is `cassandra`; to give a warning to the user if it is `true`
                  getKey('private', (key) => {
                    // If we didn't get the key, just stop this subprocess
                    if (key.length <= 0)
                      return

                    // Decrypt the username
                    let usernameDecrypted = decrypt(key, username)

                    // If the username is `cassandra` then warn the user about that
                    if (usernameDecrypted == 'cassandra') {
                      // terminalPrintMessage(readLine, 'warn', 'This connection is using the default `cassandra` user')

                      // Show it in the interactive terminal
                      addBlock($(`#_${info.cqlshSessionContentID}_container`), getRandomID(10), 'This connection is using the default `cassandra` user.', null, true, 'warning')
                    }
                  })
                } catch (e) {
                  try {
                    errorLog(e, 'connections')
                  } catch (e) {}
                }

                // Check if there is SSH tunnel creation info
                try {
                  // If there is no SSH tunnel info then stop this sub-process
                  if (sshTunnelsObjects[clusterID] == null)
                    throw 0

                  // Create an object to handle the creation info
                  let tunnelInfo = sshTunnelsObjects[clusterID],
                    sshTunnel = {
                      port: tunnelInfo.port,
                      host: tunnelInfo.host,
                      oport: tunnelInfo.oport
                    }

                  // Add the creation info in the `creationData.ssh`
                  creationData = {
                    ...creationData,
                    ssh: sshTunnel
                  }
                } catch (e) {}

                // Check if the current cluster is a sandbox project
                try {
                  if (!isSandbox)
                    throw 0

                  // Update the creation data to adopt the sandbox project without the need to do heavy changes
                  creationData = {
                    ...creationData,
                    cqlshrc: null,
                    version: getAttributes(clusterElement, 'data-cassandra-version'),
                    ssh: {
                      port: getAttributes(clusterElement, 'data-port-cassandra')
                    }
                  }
                } catch (e) {}

                // Get variables manifest and values
                try {
                  // Define JSON object which will hold the names of the temporary files
                  let files = {}

                  // Loop through the names of the content
                  for (let name of ['manifest', 'values']) {
                    // Get the content from the OS keychain
                    let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

                    // Create a name for the temporary file
                    files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandomID(20)}.aocwtmp`))

                    // Create the temporary file with related content
                    await FS.writeFileSync(files[name], content || '')
                  }

                  // Update the creation data to adopt the variables' info
                  creationData = {
                    ...creationData,
                    variables: {
                      ...files
                    }
                  }
                } catch (e) {}

                // Send a request to create a pty instance and connect with the cluster
                IPCRenderer.send('pty:create', {
                  ...creationData,
                  terminalID: info.terminalID,
                  workspaceID: getActiveWorkspaceID()
                })
              } catch (e) {
                try {
                  errorLog(e, 'connections')
                } catch (e) {}
              }
            }
          }))
          // End of the process when appending a cluster in the container
        } catch (e) {
          try {
            errorLog(e, 'connections')
          } catch (e) {}
        }
      })
    })
    // End of getting all saved clusters/projects

    /**
     * Define different inner functions that are used only in this event file, and in the current events handler
     *
     * Inner function to perform the test connection's process with an already added cluster
     *
     * @Parameters:
     * {object} `clusterElement` the cluster's UI element in the workspace clusters' list
     * {string} `?testConnectionProcessID` the ID of the connection test process of the cluster
     * {string} `?sshTunnelCreationRequestID` the ID of the SSH tunnel creation process - if needed -
     */
    let testConnection = async (clusterElement, testConnectionProcessID = '', sshTunnelCreationRequestID = '') => {
      // Point at the Apache Cassandra®'s version UI element
      let cassandraVersion = clusterElement.find('div[info="cassandra"]'),
        // Point at the data center element
        dataCenterElement = clusterElement.find('div[info="data-center"]'),
        // Point at the `CONNECT` button
        connectBtn = clusterElement.children('div.footer').children('div.button').children('button.connect'),
        // Point at the `TEST CONNECTION` button
        testConnectionBtn = clusterElement.children('div.footer').children('div.button').children('button.test-connection'),
        // Point at the status element - the flashing circle at the top right -
        statusElement = clusterElement.children('div.status'),
        // Get the cluster's ID from its attribute
        clusterID = getAttributes(clusterElement, 'data-id'),
        // Username and password - for Apache Cassandra® DB Auth - to be passed if needed
        username = '',
        password = '',
        // By default, there's no wait for encrypting username and password
        waitForEncryption = false

      // Get all saved clusters
      let allClusters = await Modules.Clusters.getClusters(workspaceID),
        // Filter clusters; by finding the target one based on its ID
        clusterObject = allClusters.find((_cluster) => _cluster.info.id == clusterID),
        // Check if any sensitive data was added to the `cqlsh.rc` file
        foundSensitiveData = false,
        // Check if there are scripts to run in pre or post-connection
        scripts = {
          pre: [],
          post: []
        }

      // Make sure the cluster's object exists
      try {
        // If the target cluster has been found then skip this try-catch block
        if (clusterObject != undefined)
          throw 0

        // Show feedback to the user about not finding the target cluster
        showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong while attempt to test connection [b]$data[/b] in workspace [b]$data[/b], mostly it is an issue with <code>cqlsh.rc</code> file', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'failure')

        setTimeout(() => {
          // Enable the `TEST CONNECTION` button
          testConnectionBtn.removeAttr('disabled')

          // Remove multiple classes for the cluster and its status elements
          clusterElement.add(statusElement).removeClass('test-connection enable-terminate-process show failure success')

          // Hide the termination process' button after a set time out
          setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
        })

        // Skip the upcoming code
        return
      } catch (e) {}

      /**
       * Check pre and post-connect scripts
       * Get all scripts associated with the cluster
       */
      let check = await getPrePostConnectionScripts(workspaceID, clusterID)

      // Set the received data
      scripts.pre = check.pre
      scripts.post = check.post
      foundSensitiveData = check.foundSensitiveData

      try {
        // If no sensitive data has been found then skip this try-catch block
        if (!foundSensitiveData)
          throw 0

        // Show feedback to the user about having sensitive data in the `cqlsh.rc` file
        showToast(I18next.capitalize(I18next.t('test connection')), `<code>cqlsh.rc</code> ${I18next.t('content for this connection contains a sensitive data (username, password and alike), please consider to remove them before attempting to connect again')}.`, 'failure')

        // Enable the `CONNECT` button
        testConnectionBtn.removeAttr('disabled')

        // Remove multiple classes for the cluster and its status elements
        clusterElement.add(statusElement).removeClass('test-connection enable-terminate-process show failure success')

        // Hide the termination process' button after a set time out
        setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

        // Skip the upcoming code
        return
      } catch (e) {}

      // Define the test data; the cluster's ID and its `cqlsh.rc` file's path
      let testData = {
        id: clusterObject.info.id,
        cqlshrcPath: clusterObject.cqlshrcPath
      }

      // Check if there is a username and password for Apache Cassandra®
      try {
        // Username and password have been encrypted already and added to the cluster's UI attributes
        [username, password] = getAttributes(clusterElement, ['data-username', 'data-password'])

        // If both username and password values are not valid then stop then skip this try-catch block
        if ([username, password].some((secret) => secret == undefined || secret.trim().length <= 0))
          throw 0

        // Add the username and the password in the `secrets` sub-object
        testData.secrets = {
          username: username,
          password: password
        }
      } catch (e) {}

      /**
       * Inner function to start the connection test process with cluster
       *
       * @Parameters:
       * {object} `?sshCreation` the SSH tunnel object associated with the cluster
       */
      let startTestConnection = async (sshCreation = null) => {
        // Define an SSH port object to be passed if needed
        let sshPort = {},
          // Get a random ID for the connection test's request
          requestID = getRandomID(10)

        // If the `sshCreation` object has been passed then use the random used port in the creation process instead of the one the user has passed
        if (sshCreation != null)
          sshPort.port = sshCreation.port

        // Get variables manifest and values
        try {
          // Define JSON object which will hold the names of the temporary files
          let files = {}

          // Loop through the names of the content
          for (let name of ['manifest', 'values']) {
            // Get the content from the OS keychain
            let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

            // Create a name for the temporary file
            files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandomID(20)}.aocwtmp`))

            // Create the temporary file with related content
            await FS.writeFileSync(files[name], content || '')
          }

          // Update the creation data to adopt the variables' info
          testData = {
            ...testData,
            variables: {
              ...files
            }
          }
        } catch (e) {}

        // Send test request to the main thread and pass the final `testData`
        IPCRenderer.send('pty:test-connection', {
          workspaceID: getActiveWorkspaceID(),
          processID: testConnectionProcessID,
          requestID,
          ...testData,
          ...sshPort
        })

        // Once a response from the main thread has been received
        IPCRenderer.on(`pty:test-connection:${requestID}`, (_, result) => {
          setTimeout(() => {
            /**
             * Implement a data center(s) check
             * By default, no data center is set unless the user provides one
             */
            let dataCenter = getAttributes(clusterElement, 'data-datacenter'),
              // Define a flag to tell if the provided data center - if provided - exists and is seen by the app or not
              isDataCenterExists = true,
              // Hold all detected/seen data centers' names in array
              allDataCenters

            // Handle when the process has been terminated
            try {
              // If the process hasn't been terminated then skip this try-catch block
              if (result.terminated != true)
                throw 0

              /**
               * Make sure to remove all listeners to the process' result
               * This will prevent showing success/failure of the process after being terminated
               */
              IPCRenderer.removeAllListeners(`pty:test-connection:${requestID}`)
            } catch (e) {}

            try {
              // If there's no provided data center by the user then skip this try-catch block
              if (dataCenter.trim().length <= 0)
                throw 0

              // Determine if the provided data center exists
              isDataCenterExists = result.datacenters.filter((_dataCenter) => _dataCenter.datacenter == dataCenter).length != 0

              // Hold all detected/seen data centers
              allDataCenters = [...new Set(result.datacenters.map((_dataCenter) => _dataCenter.datacenter))]
            } catch (e) {}

            // Failed to connect with the cluster
            try {
              // If the `connected` attribute in the result is `true`, and the Apache Cassandra®'s version has been identified, or the testing process hasn't been terminated then skip this try-catch block
              if (result.connected && ![undefined, null].includes(result.version) && result.terminated == undefined)
                throw 0

              // If the provided data center doesn't exist
              if (!isDataCenterExists) {
                let allDataCentersStr = JSON.stringify(allDataCenters)

                // Format the string format of the data centers array for the toast
                allDataCentersStr = allDataCentersStr.slice(1, allDataCentersStr.length - 1).replace(/\"/g, '').split(',').join('[/code], [code]')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('the set data center [code]$data[/code] is not recognized but the following data center(s): [code]$data[/code]. Please consider updating the data center input field or leaving it blank', [dataCenter, allDataCentersStr])) + '.', 'failure')

                // Enable or disable the save button based on the test's result
                $('#addCluster').attr('disabled', 'disabled')

                // Skip the upcoming code
                throw 0
              }

              /**
               * Update cluster UI element
               *
               * Change the `connected` attribute's value to `false` - failed to connect with the cluster -
               */
              clusterElement.attr('data-connected', 'false')

              try {
                // If the testing process has been terminated then skip this try-catch block - as ther's no need to show an error feedback to the user -
                if (result.terminated)
                  throw 0

                // Whether or not the error details will be shown
                let error = result.error.trim().length != 0 ? `, ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.replaceData('failed to activate connection [b]$data[/b] in workspace [b]$data[/b]', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)]))}${error}.`, 'failure')
              } catch (e) {}

              // Close the SSH tunnel if it exists
              try {
                IPCRenderer.send('ssh-tunnel:close', getAttributes(clusterElement, 'data-id'))
              } catch (e) {}

              setTimeout(() => {
                // Test process has finished
                clusterElement.removeClass('test-connection enable-terminate-process')

                // Hide the termination process' button after a set time out
                setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                // Show failure feedback if the testing process hasn't been terminated
                statusElement.removeClass('success').toggleClass('show failure', result.terminated == undefined)

                // Enable the test connection button again
                testConnectionBtn.removeAttr('disabled')
              })

              // Get the credentials attributes
              let [credentialsAuth, credentialsSSH] = getAttributes(clusterElement, ['data-credentials-auth', 'data-credentials-ssh'])

              // If there are no DB authentication credentials for the cluster then remove all associated attributes
              try {
                if (credentialsAuth == undefined)
                  throw 0

                clusterElement.removeAttr('data-username data-password data-got-credentials')
              } catch (e) {}

              // If there's no SSH credentials for the cluster then remove all associated attributes
              try {
                if (credentialsSSH == undefined)
                  throw 0

                clusterElement.removeAttr('data-ssh-username data-ssh-password data-ssh-passphrase data-got-credentials')
              } catch (e) {}

              /**
               * Check if we have post-connection scripts to run
               *
               * Define a variable to save the scripts' execution feedback
               */
              let executionFeedback = ''

              try {
                // If there's no post-connection script to execute then skip this try-catch block
                if (scripts.post.length <= 0)
                  throw 0

                // Show feedback to the user about starting the execution process
                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('post-connection scripts are being executed after closing the connection [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(clusterElement, 'data-name')])) + '.'), 50)

                // Execute the post-connection scripts in order
                executeScript(0, scripts.post, (executionResult) => {
                  try {
                    // If we've got `0` - as a final result - then it means all scripts have been executed with success and returned `0`; so skip this try-catch block and call the post-process function
                    if (executionResult.status == 0)
                      throw 0

                    // Show feedback to the user about the script which failed
                    let info = `${I18next.t('script "$data" didn\'t return the success code <code>0</code>, but')} <code>${executionResult.status}</code>.`

                    if (status == -1000)
                      info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                    // Set final feedback
                    executionFeedback = `. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`

                    // Show feedback to the user
                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of connection [b]$data[/b]', [I18next.t('post'), getAttributes(clusterElement, 'data-name')]))}${executionFeedback}`, 'failure'), 50)
                  } catch (e) {
                    // Show success feedback to the user if the error is `0` code
                    if (e == 0)
                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of connection [b]$data[/b] have been successfully executed', [I18next.t('post'), getAttributes(clusterElement, 'data-name')])) + '.', 'success'), 50)
                  }
                })
              } catch (e) {}

              // Skip the upcoming code
              return
            } catch (e) {}

            /**
             * Successfully connected with the cluster
             *
             * Add the created SSH tunnel object to the `sshTunnelsObjects` array; to have the ability to identify if the cluster has an SSH tunnel associated with it
             */
            sshTunnelsObjects[clusterObject.info.id] = sshCreation

            // Show Apache Cassandra® version
            cassandraVersion.children('div._placeholder').hide()
            cassandraVersion.children('div.text').text(`v${result.version}`)

            try {
              // If there's no provided data center by the user then skip this try-catch block
              if (dataCenter.trim().length <= 0 || `${dataCenter}` == 'undefined')
                throw 0

              // If the provided data center is not the same as the one connected with then show feedback to the user
              if (dataCenter != result.datacenter)
                showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData(`the specified data center [code]$data[/code] is not the one connected with [code]$data[/code]`, [dataCenter, result.datacenter]) + '.'), 'warning')
            } catch (e) {}

            // Show data center
            if (result.datacenter != undefined) {
              dataCenterElement.children('div._placeholder').hide()
              dataCenterElement.children('div.text').text(`${result.datacenter}`)
            }

            // Update some attributes for the cluster UI element alongside some classes
            clusterElement.attr({
              'data-cassandra-version': result.version,
              'data-datacenter': result.datacenter,
              'data-datacenters': result.datacenters ? JSON.stringify(result.datacenters) : null,
              'data-connected': 'true'
            })

            // Add the success state to the cluster's UI element
            statusElement.removeClass('failure').addClass('success')

            try {
              // If the version of Cassandra® is not v3 then skip this try-catch block
              if (!result.version.startsWith('3.'))
                throw 0

              // Just warn the user about that unsupported version
              setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra® is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
            } catch (e) {}

            // Show success feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('test connection [b]$data[/b] in workspace [b]$data[/b] has finished with success, you can now connect with it and start a session', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'success')

            setTimeout(() => {
              // Enable the `CONNECT` button
              connectBtn.add(testConnectionBtn).removeAttr('disabled')

              // Remove the test connection state
              clusterElement.removeClass('test-connection enable-terminate-process')

              // Hide the termination process' button after a set time out
              setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
            })
          })
        })
      }

      /**
       * Inner function to do processes that come after checking SSH tunneling info
       *
       * @Parameters:
       * {object} `?sshCreation` the SSH tunnel object associated with the cluster
       */
      let afterSSHTunnelingCheck = async (sshCreation = null) => {
        try {
          // If there's no pre-connection script to execute then skip this try-catch block
          if (scripts.pre.length <= 0)
            throw 0

          // Add the loading/processing class to the cluster UI element
          clusterElement.addClass('test-connection')

          // Show the termination process' button
          setTimeout(() => clusterElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

          // Show feedback to the user about starting the execution process
          setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('pre-connection scripts are being executed before starting with connection [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(clusterElement, 'data-name')])) + '.'), 50)

          // Execute the pre-connection scripts with order
          executeScript(0, scripts.pre, (executionResult) => {
            // All scripts have been executed successfully; thus start the connection test process
            if (executionResult.status == 0) {
              // Show a success feedback to the user
              setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of connection [b]$data[/b] have been successfully executed', [I18next.t('pre'), getAttributes(clusterElement, 'data-name')])) + '.', 'success'), 50)

              // Start the connection test process
              startTestConnection(sshCreation)

              // Skip the upcoming code
              return
            }

            /**
             * There's an issue with one or more script
             *
             * Define the feedback info
             */
            let info = `${I18next.t('script "$data" didn\'t return the success code <code>0</code>, but')} <code>${executionResult.status}</code>`

            // `-1000` error code means the app couldn't find the script in the given path
            if (status == -1000)
              info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

            // Show feedback to the user
            setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of connection [b]$data[/b]', [I18next.t('pre'), getAttributes(clusterElement, 'data-name')]))}. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`, 'failure'), 50)

            // Call the error feedback function
            errorVisualFeedback()
          })

          // Skip the upcoming code
          return
        } catch (e) {}

        // If there's no pre-connection script to execute then call the test connection function immediately
        startTestConnection(sshCreation)
      }

      // Inner function that do the changes in cluster element when an error occurs
      let errorVisualFeedback = (isProcessTerminated = false) => {
        // Remove the test connection class
        clusterElement.removeClass('test-connection enable-terminate-process')

        // Hide the termination process' button after a set time out
        setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

        // Show failure feedback if the process hasn't been terminated
        statusElement.removeClass('success')[isProcessTerminated ? 'removeClass' : 'addClass']('show failure')

        // Enable the `CONNECT` button
        testConnectionBtn.removeAttr('disabled')

        // Get the credentials from the associated attributes
        let [credentialsAuth, credentialsSSH] = getAttributes(clusterElement, ['data-credentials-auth', 'data-credentials-ssh'])

        try {
          // If there are no DB authentication credentials then skip this try-catch block
          if (credentialsAuth == undefined)
            throw 0

          // Remove all related attributes
          clusterElement.removeAttr('data-username data-password data-got-credentials')
        } catch (e) {}

        try {
          // If there are no SSH credentials then skip this try-catch block
          if (credentialsSSH == undefined)
            throw 0

          // Remove all related attributes
          clusterElement.removeAttr('data-ssh-username data-ssh-password data-got-credentials')
        } catch (e) {}
      }

      /**
       * The workflow of the `testConnection` function is:
       * Pre-processes and checks -> Checking SSH tunneling info -> Create an SSH Tunnel || No need to create an SSH tunnel -> afterSSHTunnelingCheck() -> startTestConnection()
       *
       * Get the SSH tunnel creation info for the cluster
       */
      let sshTunnelingInfo = await Modules.Clusters.getSSHTunnelingInfo(workspaceID, getAttributes(clusterElement, 'data-folder'))

      try {
        // If there's no need to create an SSH tunnel then skip this try-catch block
        if (sshTunnelingInfo == null || typeof sshTunnelingInfo != 'object' || sshTunnelingInfo.length <= 0)
          throw 0

        // Check if an SSH client is installed and accessible
        checkSSH((exists) => {
          // If the SSH client doesn't exist
          if (!exists) {
            // Show feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection')), I18next.t('SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine') + '.', 'failure')

            // Call the error's visual feedback function
            errorVisualFeedback()

            // Skip the upcoming code - terminate the process -
            return
          }

          /**
           * Prepare the SSH tunnel's info
           *
           * Everything needed is present, except username and password - if no SSH private key file is provided -, so we'll get them, decrypt them, and add them to the object final SSH object
           */
          let [sshUsername, sshPassword, sshPassphrase] = getAttributes(clusterElement, ['data-ssh-username', 'data-ssh-password', 'data-ssh-passphrase'])

          // Check that the username is at least, and maybe password values are valid
          if (([sshUsername, sshPassword, sshPassphrase].every((secret) => secret == undefined || secret.trim().length <= 0))) {
            // If not then stop the test process and show feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection')), I18next.t('SSH tunnel can\'t be established without passing at least a username, please check given info before attempting to connect again') + '.', 'failure')

            // Call the error's visual feedback function
            errorVisualFeedback()

            // Skip the upcoming code
            return
          }

          // Get the RSA private key - of our project -; to decrypt username and/or password
          getKey('private', (key) => {
            try {
              // If the received key is valid then skip this try-catch block
              if (key.length > 0)
                throw 0

              // Show feedback to the user about the app wasn't able to get the private key
              showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

              // Call the error's visual feedback function
              errorVisualFeedback()

              // Skip the upcoming code
              return
            } catch (e) {}

            /**
             * Reaching here means we need to decrypt the SSH username at least
             *
             * Decrypt the SSH username
             */
            sshUsername = decrypt(key, sshUsername)

            // Decrypt the SSH password
            sshPassword = decrypt(key, sshPassword)

            // Decrypt the SSH private key's passphrase
            sshPassphrase = decrypt(key, sshPassphrase)

            // Adopt the decrypted SSH password if it's valid
            if (sshPassword.trim().length > 0)
              sshTunnelingInfo.password = sshPassword

            // Adopt the decrypted SSH passphrase if it's valid
            if (sshPassphrase.trim().length > 0)
              sshTunnelingInfo.passphrase = sshPassphrase

            // Adopt the decrypted SSH username
            sshTunnelingInfo.username = sshUsername

            // Define the host and port to be passed to the SSH tunneling creation's function
            let host = sshTunnelingInfo.dstAddr != '127.0.0.1' ? sshTunnelingInfo.dstAddr : sshTunnelingInfo.host,
              port = sshTunnelingInfo.dstPort

            // Define the cluster's ID in the SSH tunneling info object
            sshTunnelingInfo.clusterID = getAttributes(clusterElement, 'data-id')

            // Add the passed requestID
            sshTunnelingInfo = {
              ...sshTunnelingInfo,
              requestID: sshTunnelCreationRequestID
            }

            // Create an SSH tunnel based on the final `sshTunnelingInfo` object
            createSSHTunnel(sshTunnelingInfo, (creationResult) => {
              // If there's no error then call the `afterSSHTunnelingCheck` function
              if (creationResult.error == undefined)
                return afterSSHTunnelingCheck({
                  port: creationResult.port, // The port to be shown to the user
                  oport: port, // The original port to be used within the creation process
                  ...creationResult,
                  host
                })

              /**
               * The app failed to establish an SSH tunnel
               *
               * Show feedback to the user
               */
              if (!creationResult.terminated)
                showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.replaceData('failed to establish an SSH tunnel for connection [b]$data[/b]', [getAttributes(clusterElement, 'data-name')]))}</b>. ${creationResult.error}.`, 'failure')

              // Call the error's visual feedback function
              errorVisualFeedback(creationResult.terminated)

              // End the testing process
              return
            })
          })
        })
        return
      } catch (e) {}

      // If there's no need to create an SSH tunnel then simply call the `afterSSHTunnelingCheck` function
      afterSSHTunnelingCheck()
    }
    // End of `testConnection` function

    /**
     * Inner function to update the SSL lock pad's status
     *
     * @Parameters:
     * {object} `clusterElement` is the target cluster's UI element
     */
    let updateSSLLockpadStatus = (clusterElement) => {
      // Point at the SSL lock pad icon in the left side of the work area
      let workareaInfoContainer = $(`div.body div.right div.content div[content="workarea"] div.workarea[cluster-id="${getAttributes(clusterElement, 'data-id')}"] div.sub-sides.left div.cluster-info`),
        lockpad = workareaInfoContainer.find('div.status ion-icon'),
        // Get the MDB tooltip's object of the lockpad
        tooltip = getElementMDBObject(lockpad.parent(), 'Tooltip')

      try {
        // Whether or not SSL is enabled or disabled for the target cluster
        let enabledSSL = getAttributes(clusterElement, 'ssl-enabled')

        // Reset the lock pad status
        lockpad.attr('name', 'unknown')

        // Set the default title
        let defaultTitle = I18next.capitalize(I18next.t('analyzing status'))

        setTimeout(() => {
          // Make sure to hide the status' tooltip before doing any update
          try {
            tooltip.hide()
          } catch (e) {}
        })

        // If the SSL status for the cluster is not defined yet then skip this try-catch block
        if (enabledSSL == undefined) {
          try {
            tooltip.setContent(defaultTitle)
          } catch (e) {}

          // Skip the upcoming code in the try-catch block
          throw 0
        }

        // Determine the SSL status in a boolean format
        enabledSSL = enabledSSL != 'false'

        // Update the lock pad icon and its color based on the status
        lockpad.attr('name', enabledSSL ? 'lock-closed' : 'lock-opened')

        setTimeout(() => {
          try {
            // Determine the suitable SSL status
            let tooltipContent = enabledSSL ? 'SSL is enabled' : 'SSL is not enabled'

            // Update the content of the tooltip
            tooltip.setContent(I18next.t(tooltipContent))

            // Update the new language's key
            $(tooltip.reference).attr('data-mulang', tooltipContent)
          } catch (e) {}
        })
      } catch (e) {}
    }

    /**
     * Inner function to update the mini cluster's background color - the elements in the workspace's element in the list -
     *
     * @Parameters:
     * {string} `workspaceID` the ID of the cluster's workspace
     * {string} `clusterID` the ID of the cluster
     * {boolean} `?noColor` Determine if the mini cluster's background color will be reseted
     */
    updateMiniCluster = (workspaceID, clusterID, noColor = false) => {
      // Point at the cluster's workspace element
      let workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`),
        // Get the color of the workspace in RGB format `R G B`
        workspaceColorRGB = HEXToRGB(getAttributes(workspaceElement, 'data-color')).join(' '),
        // Point at the mini cluster
        miniCluster = workspaceElement.find(`div._cluster[_cluster-id="${clusterID}"]`)

      // Determine if the mini cluster is clickable - can be used to navigate to the cluster's work area -
      miniCluster.toggleClass('clickable', !noColor)

      // Update the mini cluster's background color
      miniCluster.css('background', !noColor ? (getAttributes(workspaceElement, 'data-color').trim().length != 0 ? `rgb(${workspaceColorRGB} / 70%)` : '#7c7c7c') : '')
    }
  })
  // End of `getClusters` and `refreshClusters` events

  /**
   * Define an inner function - which will be used in `refresh` and `get` clusters events and in other events associated with clusters
   * The full definition is applied at the very bottom of 'getClusters refreshClusters' events listener
   */
  let updateMiniCluster

  // Set the time which after it the termination of the connection test process is allowed
  const ConnectionTestProcessTerminationTimeout = 250

  // Handle different events for elements related to clusters - especially the add/edit cluster dialog -
  {
    // Add/edit dialog
    {
      // Define a portion of the common CSS selector
      let dialog = `div.modal#addEditClusterDialog div.modal-body div.side`

      // Clicks any of the section's buttons in the left side of the dialog
      {
        $(`${dialog}-left div.sections div.section div.btn`).click(function() {
          // Get the section's name
          let section = $(this).attr('section')

          // Deactivate all sections
          $(`${dialog}-left div.sections div.section div.btn`).removeClass('active')

          // Hide all sections
          $(`${dialog}-right div.modal-section`).hide()

          // Activate the clicked section
          $(this).addClass('active')

          // Show the clicked section
          $(`${dialog}-right div.modal-section[section="${section}"]`).show().removeAttr('hidden')

          // Remove any notification about an invalid input in the active section
          try {
            $(this).children('div.invalid-inputs').fadeOut('fast')
          } catch (e) {}
        })
      }

      // Events handlers for the `Add New Cluster` dialog and its elements
      {
        // Handle `input` and `click` events for all input fields
        {
          $(`${dialog}-right div.modal-section [info-section][info-key]`).on('input click', async function() {
            let input = $(this), // Point at the current input
              workspaceID = getActiveWorkspaceID() // Get the active workspace's ID

            // Ignore the input field if it is not associated with a section in the `cqlsh.rc` config file
            if (getAttributes(input, 'info-section') == 'none')
              return

            // Get the input's value, section, and key
            let value = input.val(),
              [section, key] = getAttributes(input, ['info-section', 'info-key'])

            // If the input is a switch then its value will be the whether it's checked or not
            if (getAttributes(input, 'type') == 'checkbox')
              value = input.prop('checked')

            // If the input is a file selector then get the selected file's path, or just ignore it
            if (getAttributes(input, 'type') == 'file') {
              try {
                value = input[0].files[0].path
              } catch (e) {
                value = ''
              }
            }

            // Convert final value to string
            value = `${value}`

            // Remove any visual feedback about having an invalid value
            input.removeClass('is-invalid')

            // Inner function to update the editor's content
            let update = async () => {
              isUpdatingEditor = true // Change the value to `true`; to prevent collisions

              // Get final values - from the input fields - as JSON object
              let finalValues = await variablesManipulation(workspaceID, cqlshValues),
                // Apply the final values to the editor's content
                updatedCQLSH = Modules.Clusters.setCQLSHRCContent(finalValues, null, editor)

              // Set the new content
              editor.setValue(updatedCQLSH)

              // Refresh the editor's layout
              editor.layout()
            }

            try {
              // If the input's value is not empty then skip this try-catch block
              if (`${value}`.trim().length > 0)
                throw 0

              /**
               * As the input's value is empty multiple choices are present:
               * One is to disable it in the editor by prepending a semicolon
               * Other is set a default value instead of the empty one
               *
               * Define the final input's value
               */
              let finalValue = ''

              // If the key/option is not one of those then it can be disabled in the editor's content
              if (!(['hostname', 'port'].includes(key)))
                finalValue = 'DISABLED'

              // Set the final value
              cqlshValues[section][key] = finalValue

              // Call the inner function `update`
              await update()

              // Skip the upcoming code
              return
            } catch (e) {}

            // Set the final value
            cqlshValues[section][key] = value

            // Call the inner `update` function
            await update()
          })
        }

        // When change occurs in any of the input fields - except the cluster's name - the `SAVE THE CLUSTER` button will be disabled
        {
          $(`${dialog}-right div.modal-section [info-section][info-key]:not([info-key="clusterName"])`).on('input', () => $('#addCluster').attr('disabled', 'disabled'))
        }

        /**
         * Switching between the editor and the input fields
         *
         * When switching to the editor, the scroll value should be `0` - being at the top of the dialog -; to let the editor fit the entire dialog
         * Switching back to the input fields needs to set the scroll value before switching to the editor
         */
        {
          // Define the scroll value, by default, the current scroll value is `0` - at the top of the dialog -
          let scrollValue = 0,
            dialogElement = $(`div.modal#addEditClusterDialog`)

          // Clicks the `SWITCH TO EDITOR` button
          $('#switchEditor').click(function() {
            // Point at the dialog's content element
            let dialogBody = dialogElement.find('div.modal-body'),
              // Determine if the editor is visible/shown or not
              editorShown = dialogElement.hasClass('show-editor')

            // Add the `show-editor` class if it is not added, otherwise it'll be removed
            dialogElement.toggleClass('show-editor', !editorShown)

            // Show/hide the expand editor's buttons
            $(`button#expandEditor`).toggleClass('show', !editorShown)

            // Update the current scroll value if the editor is not shown already, otherwise, keep the current saved value
            scrollValue = !editorShown ? dialogBody[0].scrollTop : scrollValue

            // Either scroll to the last saved position if the editor is visible, or scroll to the top of the dialog for the editor before showing it
            dialogBody[0].scrollTo(0, editorShown ? scrollValue : 0)

            // Update the editor's layout
            editor.layout()

            // Return the dialog to its normal dimensions once back to the UI mode instead of the editor mode
            if (dialogElement.find('div.modal-dialog').hasClass('expanded'))
              $(`button#expandEditor`).click()
          })

          /**
           * Create a resize observer for the add/edit dialog's body element
           * By doing this the editor's dimensions will be always fit with the dialog's dimensions
           */
          setTimeout(() => {
            (new ResizeObserver(() => {
              try {
                editor.layout()
              } catch (e) {}
            })).observe(dialogElement.find('div.modal-body')[0])
          })

          // Get the MDB object for the expand button's tooltip
          let tooltip = getElementMDBObject($(`button#expandEditor`), 'Tooltip')

          // Click the expand button - to expand the editor's view -
          $(`button#expandEditor`).click(function() {
            // Whether or not the dialog is already expanded
            let expanded = dialogElement.find('div.modal-dialog').hasClass('expanded')

            // Hide the tooltip once the button is clicked
            tooltip.hide()

            try {
              // If the dialog is already expanded then skip this try-catch block
              if (expanded)
                throw 0

              // Update the expand's button icon
              $(this).children('ion-icon').attr('name', 'collapse')

              // Expand the dialog
              dialogElement.children('div.modal-dialog').addClass('modal-xl expanded').removeClass('modal-lg')

              // Resize the editor initially - the resize observer will keep updating the size -
              editor.layout()

              // Skip the upcoming code
              return
            } catch (e) {}

            // Update the expand's button icon
            $(this).children('ion-icon').attr('name', 'expand')

            // Return to the default status of the dialog's size
            dialogElement.children('div.modal-dialog').addClass('modal-lg').removeClass('modal-xl expanded')

            // Resize the editor initially - the resize observer will keep updating the size -
            editor.layout()
          })
        }

        // Show/hide the password fields' values by interacting with the eye button
        {
          // Clicks the eye button
          $('div.form-outline div.reveal-password div.btn').click(function() {
            // Point at the password input field
            let password = $(this).parent().parent().children('input'),
              // If the input field type is `text` then the password value is revealed
              revealed = getAttributes(password, 'type') == 'text' ? true : false

            // Change the eye button's icon based on the revealing status
            $(this).children('ion-icon').attr('name', revealed ? 'eye-opened' : 'eye-closed')

            // Switch the password input field type based on the revealing status
            password.attr('type', revealed ? 'password' : 'text')
          })
        }

        {
          // Define a temporary cluster ID to be used in the testing and adding prcoesses
          let tempClusterID = null,
            // Hold the test cluster's object
            testedClusterObject = null,
            // Hold the test cluster's created SSH tunnel - if one has been created -
            testedSSHTunnelObject = null

          // The testing connection process with the to be added/updated cluster
          {
            /**
             * Define an initial ID for the connection test process of the to be added/updated cluster
             * The value will be updated with every test connection process
             */
            let testConnectionProcessID,
              // Define an initial ID for the SSH tunnel creation process as well
              sshTunnelCreationRequestID,
              // Flag to tell if an SSH tunnel is needed before connecting with Cassandra® cluster/node
              isSSHTunnelNeeded = false

            // Clicks the `TEST CONNECTION` button to do a connection test with the cluster before saving/updating it
            $('#testConnectionCluster').click(async function() {
              let hostname = '', // The given hostname
                port = 9042, // Default port to connect with Apache Cassandra®
                dataCenter = $('[info-section="none"][info-key="datacenter"]').val(), // By default, no data center is set unless the user provides one
                // Apache Cassandra®'s authentication username and password
                username = '',
                password = '',
                waitForEncryption = false, // Don't wait for encryption as username and password are not provided
                sshTunnel = false, // There is no SSH tunnel creation info
                // SSH tunnel creation info's object
                ssh = {
                  host: '',
                  username: '',
                  dstPort: 0
                },
                // Get the currently active workspace's ID
                workspaceID = getActiveWorkspaceID(),
                // Point at the `TEST CONNECTION` button
                button = $(this),
                // Point at the add/edit cluster's dialog
                dialogElement = $('div.modal#addEditClusterDialog')

              // Get a random ID for this connection test process
              testConnectionProcessID = getRandomID(30)

              // Get a random ID for the SSH tunnel creation process
              sshTunnelCreationRequestID = getRandomID(30)

              // Add log about this request
              try {
                addLog(`Request to test connection that could be added/updated`, 'action')
              } catch (e) {}

              // Attempt to close the created SSH tunnel - if exists -
              try {
                IPCRenderer.send('ssh-tunnel:close', tempClusterID)
              } catch (e) {}

              // Get a temporary random ID for the cluster which is being tested
              tempClusterID = getRandomID(30)

              try {
                /**
                 * To test the connection, the user should have provided the hostname at least
                 *
                 * Get the `hostname` for the given data
                 */
                hostname = cqlshValues.connection.hostname

                // If the hostname is empty or only whitespaces then skip this try-catch block
                if (hostname.trim().length <= 0)
                  throw 0
              } catch (e) {
                /**
                 * Being here means the given hostname is invalid
                 *
                 * Add `invalid` class to the `hostname` input field
                 */
                $('[info-section="connection"][info-key="hostname"]').addClass('is-invalid')

                // Point at the basic section navigation button in the dialog
                let basicSectionBtn = dialogElement.find('div.btn[section="basic"]')

                // If the basic section is not the currently active one then show invalid inputs notification
                if (!basicSectionBtn.hasClass('active'))
                  basicSectionBtn.children('div.invalid-inputs').fadeIn('fast')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.t('to test connection, host name is the only required field to be provided')) + '.', 'failure')

                // Skip the upcoming code - end the connection test process -
                return
              }

              // Determine if any sensitive data has been added to the `cqlsh.rc` file
              let foundSensitiveData = false,
                // Determine if there's pre-post connection script(s) to be executed
                scripts = {
                  pre: [],
                  post: []
                },
                // Will store the `cqlsh.rc` config file's content in the editor
                cqlshContent

              /**
               * Check pre and post connect scripts
               * Get all scripts associated with the cluster
               */
              let check = await getPrePostConnectionScripts(workspaceID)

              // Set the received data
              scripts.pre = check.pre
              scripts.post = check.post
              foundSensitiveData = check.foundSensitiveData
              cqlshContent = check.cqlshContent

              try {
                // If no sensitive data has been found then skip this try-catch block
                if (!foundSensitiveData)
                  throw 0

                // Show feedback to the user about having sensitive data in the `cqlsh.rc` config file's content
                showToast(I18next.capitalize(I18next.t('test connection')), `<code>cqlsh.rc</code> ${I18next.t('content for this connection contains a sensitive data (username, password and alike), please consider to remove them before attempting to connect again')}.`, 'failure')

                // Enable the `TEST CONNECTION` button
                button.add('#switchEditor').removeAttr('disabled', 'disabled')

                // Remove the test connection class
                dialogElement.removeClass('test-connection enable-terminate-process')

                // Hide the termination process' button after a set time out
                setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                // Skip the upcoming code
                return
              } catch (e) {}

              // Check if there's a need to create an SSH tunnel
              try {
                // Get related inputs values to the SSH tunnel info
                let values = ['username', 'password', 'privatekey', 'passphrase']

                // Loop through each value
                values.forEach((value) => {
                  // Get the value of the current input
                  ssh[value] = $(`[info-section="none"][info-key="ssh-${value}"]`).val()
                })

                // Check if username has been given but without password nor private key path
                if (ssh.username.trim().length != 0 && ([ssh.password, ssh.privatekey].every((secret) => secret.trim().length <= 0)))
                  return showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('username [code]$data[/code] has been provided for creating an SSH tunnel without providing neither a password nor private key, please consider to provide one of them and try again', [ssh.username])) + '.', 'failure')

                // If both username and (password or private key) have been provided then an SSH tunnel should be created
                sshTunnel = ssh.username.trim().length != 0 && ([ssh.password, ssh.privatekey].some((secret) => secret.trim().length != 0))

                // Set the flag's value
                isSSHTunnelNeeded = sshTunnel
              } catch (e) {}

              // The dialog is testing the connection with the cluster
              dialogElement.addClass('test-connection')

              // Show the termination process' button
              setTimeout(() => dialogElement.addClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

              // Disable all the buttons in the footer
              button.add('#addCluster').add('#switchEditor').attr('disabled', 'disabled')

              /**
               * Inner function to do processes which are after the SSH tunneling creation process - whether the process has been executed or not -
               *
               * @Parameters:
               * {object} `?sshCreation` the SSH tunnel object associated with the cluster
               */
              let afterSSHProcess = async (sshCreation = null) => {
                // Make sure to set tempClusterID to `null` if there's no SSH tunnel to be created
                if (sshCreation == null)
                  tempClusterID = null

                try {
                  // Get the SSH username and password - for Apache Cassandra®'s authentication -
                  username = $('[info-section="none"][info-key="username"]').val()
                  password = $('[info-section="none"][info-key="password"]').val()

                  // If both username and password have been provided then they'll be encrypted
                  waitForEncryption = [username, password].every((secret) => secret.trim().length != 0)
                } catch (e) {}

                // Inner function inside `afterSSHProcess` function; to start the connection test with cluster
                let startTestConnection = async () => {
                  /**
                   * A custom port might be passed to the `cqlsh` tool in case there's an SSH tunnel creation process
                   *
                   * The variable which will have the `port` attribute as an override
                   */
                  let override = null

                  // If an SSH tunnel creation object has been passed
                  if (sshCreation != null) {
                    // Override the port
                    override = {
                      port: sshCreation.port
                    }
                  }

                  // Get variables manifest and values
                  try {
                    // Define JSON object which will hold the names of the temporary files
                    let files = {}

                    // Loop through the names of the content
                    for (let name of ['manifest', 'values']) {
                      // Get the content from the OS keychain
                      let content = name == 'manifest' ? await Keytar.findPassword(`AxonOpsWorkbenchVars${I18next.capitalize(name)}`) : JSON.stringify(await retrieveAllVariables(true))

                      // Create a name for the temporary file
                      files[name] = Path.join(OS.tmpdir(), Sanitize(`${getRandomID(20)}.aocwtmp`))

                      // Create the temporary file with related content
                      await FS.writeFileSync(files[name], content || '')
                    }

                    // Update the creation data to adopt the variables' info
                    override = {
                      ...override,
                      variables: {
                        ...files
                      }
                    }
                  } catch (e) {}

                  // If there's a need to wait for the encryption of the username and password before starting the connection test
                  if (waitForEncryption) {
                    // Get the app's RSA public key - for encryption we use the public key -
                    getKey('public', async (key) => {
                      try {
                        // If the received key is valid then skip this try-catch block
                        if (key.length > 0)
                          throw 0

                        // Delete the temp file which contains the `cqlsh.rc` config file's content
                        try {
                          await FS.unlinkSync(tempConfigFile)
                        } catch (e) {
                          try {
                            errorLog(e, 'connections')
                          } catch (e) {}
                        }

                        // Remove the test connection class
                        dialogElement.removeClass('test-connection enable-terminate-process')

                        // Hide the termination process' button after a set time out
                        setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                        // Enable some buttons in the footer
                        button.add('#switchEditor').removeAttr('disabled', 'disabled')

                        // Disable the `SAVE CLUSTER` button
                        $('#addCluster').attr('disabled', 'disabled')

                        // Show feedback to the user
                        showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                        // Skip the upcoming code - end the process -
                        return
                      } catch (e) {}

                      /**
                       * Reaching here means the received key is valid
                       *
                       * Encrypt both values; username and password
                       */
                      encryptedUsername = encrypt(key, username)
                      encryptedPassword = encrypt(key, password)

                      // Request to test connection based on the provided data
                      IPCRenderer.send('pty:test-connection', {
                        requestID: cqlshrc.name,
                        processID: testConnectionProcessID,
                        secrets: {
                          username: encryptedUsername,
                          password: encryptedPassword
                        },
                        workspaceID: getActiveWorkspaceID(),
                        cqlshrcPath: tempConfigFile,
                        ...override
                      })
                    })
                  } else {
                    /**
                     * No need to encrypt any data or wait for an encryption process
                     *
                     * Request to test connection based on the provided data
                     */
                    IPCRenderer.send('pty:test-connection', {
                      requestID: cqlshrc.name,
                      processID: testConnectionProcessID,
                      ...override,
                      workspaceID: getActiveWorkspaceID(),
                      cqlshrcPath: tempConfigFile
                    })
                  }

                  // In both cases listen to the response about the connection test
                  IPCRenderer.on(`pty:test-connection:${cqlshrc.name}`, async (_, result) => {
                    setTimeout(async () => {
                      // Delete the temp file which contains the `cqlsh.rc` config file's content
                      try {
                        await FS.unlinkSync(tempConfigFile)
                      } catch (e) {
                        try {
                          errorLog(e, 'connections')
                        } catch (e) {}
                      }

                      /**
                       * If there's a post-connection script(s) to be executed
                       *
                       * Set this variable to hold the overall script's execution feedback
                       */
                      let executionFeedback = ''

                      // Hold the tested cluster's object
                      testedClusterObject = result

                      /**
                       * Implement a data center(s) check
                       * Define a flag to tell if the provided data center - if provided - exists and is seen by the app or not
                       */
                      let isDataCenterExists = true,
                        // Hold all detected/seen data centers' names in array
                        allDataCenters

                      try {
                        // If there's no provided data center by the user then skip this try-catch block
                        if (dataCenter.trim().length <= 0)
                          throw 0

                        // Determine if the provided data center exists
                        isDataCenterExists = result.datacenters.filter((_dataCenter) => _dataCenter.datacenter == dataCenter).length != 0

                        // Hold all detected/seen data centers
                        allDataCenters = [...new Set(result.datacenters.map((_dataCenter) => _dataCenter.datacenter))]
                      } catch (e) {}

                      try {
                        // Remove the test connection class
                        dialogElement.removeClass('test-connection enable-terminate-process')

                        // Hide the termination process' button after a set time out
                        setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                        // Enable the `TEST CONNECTION` button
                        button.add('#switchEditor').removeAttr('disabled', 'disabled')

                        // Determine if the connection test has succeeded or not, or terminated
                        let notConnected = !result.connected || [undefined, null].includes(result.version) || result.terminated != undefined

                        // Enable or disable the save button based on the test's result
                        $('#addCluster').attr('disabled', !notConnected ? null : 'disabled')

                        // If the provided data center doesn't exist
                        if (!isDataCenterExists) {
                          let allDataCentersStr = JSON.stringify(allDataCenters)

                          // Format the string format of the data centers array for the toast
                          allDataCentersStr = allDataCentersStr.slice(1, allDataCentersStr.length - 1).replace(/\"/g, '').split(',').join('[/code], [code]')

                          // Show feedback to the user
                          showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData('the set data center [code]$data[/code] is not recognized but the following data center(s): [code]$data[/code]. Please consider updating the data center input field or leaving it blank', [dataCenter, allDataCentersStr])) + '.', 'failure')

                          // Enable or disable the save button based on the test's result
                          $('#addCluster').attr('disabled', 'disabled')

                          // Skip the upcoming code
                          throw 0
                        }

                        // Failed to connect with the cluster - process hasn't been terminated -
                        if (notConnected && result.terminated == undefined) {
                          // Define the error message
                          let error = result.error.trim().length != 0 ? ` ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                          // Show feedback to the user
                          showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to activate connection'))}${error}${executionFeedback}.`, 'failure')

                          // Skip the upcoming code
                          throw 0
                        }

                        // If the process has been terminated then skip this try-catch block
                        if (result.terminated != undefined)
                          throw 0

                        try {
                          // If there's no provided data center by the user then skip this try-catch block
                          if (dataCenter.trim().length <= 0 || `${dataCenter}` == 'undefined')
                            throw 0

                          // If the provided data center is not the same as the one connected with then show feedback to the user
                          if (dataCenter != result.datacenter)
                            showToast(I18next.capitalize(I18next.t('test connection')), I18next.capitalizeFirstLetter(I18next.replaceData(`the specified data center [code]$data[/code] is not the one connected with [code]$data[/code]`, [dataCenter, result.datacenter]) + '.'), 'warning')
                        } catch (e) {}

                        /**
                         * Successfully connected with the cluster
                         *
                         * Get the success feedback suffix
                         */
                        let suffix = I18next.t('you may now save it')

                        // Change the suffix if the dialog's current mode is `edit`
                        if (getAttributes(dialogElement, 'data-edit-cluster-id') != undefined)
                          suffix = I18next.t('you can now complete the update')

                        try {
                          // If the version of Cassandra® is not v3 then skip this try-catch block
                          if (!result.version.startsWith('3.'))
                            throw 0

                          // Just warn the user about that unsupported version
                          setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra® is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
                        } catch (e) {}

                        // Show feedback to the user
                        showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('connection test has finished with success'))}, ${I18next.capitalizeFirstLetter(suffix)}${executionFeedback}.`, 'success')

                        // Refresh workspaces - to ensure synchronization with the latest data -
                        $(document).trigger('refreshWorkspaces')
                      } catch (e) {}

                      // Check if there are post-connection scripts to be executed after the connection attempt
                      if (scripts.post.length != 0) {
                        // Show feedback to the user about starting the execution process
                        setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.t('post-connection scripts are being executed after closing the connection, you\'ll be notified once the process is finished')) + '.'), 50)

                        // Request to execute the post-connection scripts
                        executeScript(0, scripts.post, (executionResult) => {
                          /**
                           * All scripts have been successfully executed and all of them have returned `0`
                           * Show the success feedback to the user and skip the upcoming code
                           */
                          if (executionResult.status == 0)
                            return setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of the connection have been successfully executed', [I18next.t('post')])) + '.', 'success'), 50)

                          /**
                           * There's an issue with one or more script
                           *
                           * Define the feedback info
                           */
                          let info = `${I18next.t('script "$data" didn\'t return the success code <code>0</code>, but')} <code>${executionResult.status}</code>.`

                          // `-1000` error code means the app couldn't find the script in the given path
                          if (status == -1000)
                            info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                          // Final feedback to be shown to the user
                          executionFeedback = `${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}`

                          // Show feedback to the user
                          setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of the connection', [I18next.t('post')]))}. ${executionFeedback}`, 'failure'), 50)
                        })
                      }
                    })
                  })
                }

                /**
                 * Define the `cqlsh.rc` file content from the editor, and set its random name
                 * For testing the connection, a temporary file with the editor's content will be created in the OS temp folder
                 */
                let cqlshrc = {
                    value: editor.getValue(),
                    name: `${getRandomID(10)}.cwb` // [C]assandra [W]ork[B]ench
                  },
                  /**
                   * Get the OS temp folder path
                   * `OS` module will handle this for all operating systems
                   */
                  tempConfigFile = Path.join(OS.tmpdir(), cqlshrc.name),
                  // Create the temp `*.cwb` file with the `cqlsh.rc` content from the editor
                  saveTemp = await FS.writeFileSync(tempConfigFile, cqlshrc.value)

                try {
                  // If the app has successfully created the temp file then skip this try-catch block
                  if (saveTemp == undefined)
                    throw 0

                  // Show feedback to the user the about failure to create a necessary temp file for the connection test process
                  showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to complete the test process, please check the privileges of the app to read/write'))}.`, 'failure')

                  // Disable the `SAVE CLUSTER` button
                  $('#addCluster').attr('disabled', 'disabled')

                  // Skip the upcoming code
                  return
                } catch (e) {}

                // Call the function which will start the connection test
                startTestConnection()
              }
              // End of the function `afterSSHProcess`

              // Inner function to check and - based on the check result - create an SSH tunnel
              let checkAndCreateSSHTunnel = () => {
                /**
                 * There's a need to create an SSH tunnel before testing the connection with the cluster
                 *
                 * Check if an SSH client is installed and accessible
                 */
                checkSSH((exists) => {
                  // If the SSH client doesn't exist then end the process and show feedback to the user
                  if (!exists)
                    return showToast(I18next.capitalize(I18next.t('test connection')), I18next.t('SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine') + '.', 'failure')

                  // Define the essential SSH tunnel creation info
                  ssh.host = $('[info-section="none"][info-key="ssh-host"]').val() || hostname
                  ssh.port = $('[info-section="none"][info-key="ssh-port"]').val() || 22
                  ssh.dstAddr = $('[info-section="none"][info-key="ssh-dest-addr"]').val() || '127.0.0.1'
                  ssh.dstPort = $('[info-section="none"][info-key="ssh-dest-port"]').val() || cqlshContent.connection.port
                  ssh.clusterID = tempClusterID

                  // Add the generated requestID
                  ssh = {
                    ...ssh,
                    requestID: sshTunnelCreationRequestID
                  }

                  // Create an SSH tunnel
                  createSSHTunnel(ssh, (creationResult) => {
                    // If no error has occurred then perform the after SSH tunnel creation processes, and skip the upcoming code
                    if (creationResult.error == undefined) {
                      let host = ssh.dstAddr != '127.0.0.1' ? ssh.dstAddr : ssh.host,
                        port = ssh.dstPort

                      // Hold the created SSH tunnel's info
                      testedSSHTunnelObject = {
                        port: creationResult.port, // The port to be shown to the user
                        oport: port, // The original port to be used within the creation process
                        ...creationResult,
                        host
                      }

                      // Call the next function in the process and skip the upcoming code
                      return afterSSHProcess(creationResult)
                    }

                    // Remove the test connection class
                    dialogElement.removeClass('test-connection enable-terminate-process')

                    // Hide the termination process' button after a set time out
                    setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                    // Enable the `TEST CONNECTION` button
                    button.add('#switchEditor').removeAttr('disabled', 'disabled')

                    // Show feedback to the user
                    if (!creationResult.terminated)
                      showToast(I18next.capitalize(I18next.t('test connection')), `${I18next.capitalizeFirstLetter(I18next.t('failed to establish an SSH tunnel for the connection'))}. ${creationResult.error}.`, 'failure')
                  })
                })
              }

              // Execute pre-connection scripts if needed
              try {
                // If there's no pre-connection script(s) to be executed then skip this try-catch block
                if (scripts.pre.length <= 0)
                  throw 0

                // Show feedback to the user about starting the execution process
                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.t('pre-connection scripts are being executed before starting the connection, you\'ll be notified once the process is finished')) + '.'), 50)

                // Request to execute the pre-connection script(s)
                executeScript(0, scripts.pre, (executionResult) => {
                  /**
                   * All scripts have been executed successfully
                   * Call the function which will start the connection test
                   */
                  if (executionResult.status == 0) {
                    // Show success feedback to the uers
                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts of the connection have been successfully executed', [I18next.t('pre')])) + '.', 'success'), 50)

                    // If there's no need to create an SSH tunnel then directly call the `afterSSHProcess` function
                    if (!sshTunnel)
                      return afterSSHProcess(null)

                    // Otherwise, call the `checkAndCreateSSHTunnel` function
                    checkAndCreateSSHTunnel()

                    // Skip the upcoming code
                    return
                  }

                  /**
                   * There's an issue with one or more script
                   *
                   * Define the feedback info
                   */
                  let info = `${I18next.t('script "$data" didn\'t return the success code <code>0</code>, but')} <code>${executionResult.status}</code>.`

                  // `-1000` error code means the app couldn't find the script in the given path
                  if (status == -1000)
                    info = `${I18next.t('script "$data" seems not exist, please check its path and make sure it has no errors')}.`

                  // Show feedback to the user
                  setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts of the connection', [I18next.t('pre')]))}. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}`, 'failure'), 50)

                  // Remove the test connection class
                  dialogElement.removeClass('test-connection enable-terminate-process')

                  // Hide the termination process' button after a set time out
                  setTimeout(() => dialogElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)

                  // Enable the `TEST CONNECTION` button
                  button.add('#switchEditor').removeAttr('disabled', 'disabled')

                  // Disable the `SAVE CLUSTER` button
                  $('#addCluster').attr('disabled', 'disabled')
                })

                // Skip the upcoming code
                return
              } catch (e) {}

              // Call the `afterSSHProcess` function if there's no need to create an SSH tunnel
              if (!sshTunnel)
                return afterSSHProcess(null)

              // Call the `checkAndCreateSSHTunnel` function as there's a need to create an SSH tunnel
              checkAndCreateSSHTunnel()
            })

            // Clicks the process termination button
            $('#terminateConnectionTestProcess').click(() => {
              try {
                if (!isSSHTunnelNeeded)
                  throw 0

                // Attempt to close the SSH tunnel if it has already been created
                try {
                  IPCRenderer.send('ssh-tunnel:close', tempClusterID)
                } catch (e) {}

                // Send a request to terminate the SSH tunnel creation process
                IPCRenderer.send(`ssh-tunnel:terminate`, sshTunnelCreationRequestID)

                // Show success feedback to the user
                showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData('the testing process of the connection to be added/edited in workspace [b]$data[/b] has been terminated with success', [getWorkspaceName(getActiveWorkspaceID())]) + '.'), 'success')
              } catch (e) {}

              // Send request to the main thread to terminate the current ongoing connection test process
              IPCRenderer.send(`process:terminate:${testConnectionProcessID}`)

              // Send request to the main thread to terminate the connection test process - if there's any -
              try {
                IPCRenderer.send(`pty:test-connection:terminate`, checkCassandraProcessID)
              } catch (e) {}

              // Once the termination status is received
              if (!isSSHTunnelNeeded)
                IPCRenderer.on(`process:terminate:${testConnectionProcessID}:result`, (_, status) => showToast(I18next.capitalize(I18next.t('terminate test process')), I18next.capitalizeFirstLetter(I18next.replaceData(status ? 'the testing process of the connection to be added/edited in workspace [b]$data[/b] has been terminated with success' : 'something went wrong, failed to terminate the testing process of the connection to be added/edited in workspace [b]$data[/b]', [getWorkspaceName(getActiveWorkspaceID())]) + '.'), status ? 'success' : 'failure'))
            })
          }

          // Clicks the `SAVE/UPDATE CLUSTER` button
          {
            $('#addCluster').click(async function() {
              let clusterName = $('[info-section="none"][info-key="clusterName"]').val(), // The cluster's unique name
                dataCenter = $('[info-section="none"][info-key="datacenter"]').val(), // By default, no data center is set unless the user provides one
                username = '', // Apache Cassandra®'s username
                password = '', // Apache Cassandra®'s password
                sshUsername = '', // SSH username - for creating a tunnel -
                sshPassword = '', // SSH password
                sshPrivatekey = '', // SSH RSA private key content - not a path -
                sshPassphrase = '', // SSH private key's passphrase
                sshTunnel = false, // There is no SSH tunneling info
                saveAuthCredentials = $('input#saveAuthCredentials').prop('checked'),
                saveSSHCredentials = $('input#saveSSHCredentials').prop('checked'),
                waitForEncryption = false, // Don't wait for encryption, username and password are not provided
                workspaceID = getActiveWorkspaceID(), // Current active workspace's ID
                // Current active workspace's folder path
                workspaceFolder = getAttributes($(`div.workspace[data-id="${workspaceID}"]`), 'data-folder'),
                // Save/update button
                button = $(this),
                // We're in editing mode or not
                editingMode = getAttributes($(`div.modal#addEditClusterDialog`), 'data-edit-cluster-id') != undefined

              // Add log about this request
              try {
                addLog(`Request to add/edit new connection after a successful test`, 'action')
              } catch (e) {}

              try {
                // If the provided cluster's name is valid then skip this try-catch block
                if (clusterName.trim().length > 0)
                  throw 0

                // Add an `invalid` class to the cluster name's input field
                $('[info-section="none"][info-key="clusterName"]').addClass('is-invalid')

                // Point at the basic section navigation button in the dialog
                let basicSectionBtn = $(`div.modal#addEditClusterDialog`).find('div.btn[section="basic"]')

                // If the basic section is not the currently active one then show invalid inputs notification
                if (!basicSectionBtn.hasClass('active'))
                  basicSectionBtn.children('div.invalid-inputs').fadeIn('fast')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.t('to save a connection, a unique valid name is required to be provided')) + '.', 'failure')

                // Skip the upcoming code - terminate the cluster's saving/updating process -
                return
              } catch (e) {}

              // Disable the buttons in the footer
              button.add('#testConnectionCluster').add('#switchEditor').attr('disabled', 'disabled')

              // Get all saved clusters in the workspace
              let _clusters = await Modules.Clusters.getClusters(workspaceID),
                // Make sure the provided cluster's name does not exist - duplication is not allowed -
                exists = _clusters.find((_cluster) => (manipulateText(_cluster.name) == manipulateText(clusterName)) && (manipulateText(Sanitize(_cluster.folder)) == manipulateText(Sanitize(clusterName)))),
                /**
                 * If the current state of the dialog is `edit` then make sure to exclude the cluster's name from duplication
                 * `editedClusterObject` is a global object that is updated with every attempt to edit/update a cluster
                 */
                extraCondition = editingMode ? clusterName != editedClusterObject.name : true

              try {
                // If there's no duplication then skip this try-catch block
                if ([undefined, null].includes(exists) || !extraCondition)
                  throw 0

                // Enable the buttons in the footer
                button.add('#testConnectionCluster').add('#switchEditor').removeAttr('disabled')

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), I18next.capitalizeFirstLetter(I18next.replaceData('a connection is already exists with the given name [b]$data[/b] in workspace [b]$data[/b], please provide a unique valid name', [clusterName, getWorkspaceName(workspaceID)])) + '.', 'failure')

                // Skip the upcoming code - terminate the saving/updating process -
                return
              } catch (e) {}

              /**
               * Reaching here means there's no duplication in the name of the cluster
               *
               * Set the final cluster's object which will be used to save it and its info - secrets, SSH tunneling info, etc... -
               */
              let finalCluster = {
                name: clusterName,
                cqlshrc: editor.getValue(),
                info: {
                  id: editingMode ? editedClusterObject.info.id : `cluster-${getRandomID(10)}`,
                  datacenter: dataCenter.trim()
                }
              }

              // If the current mode is `edit` then add an `original` object of the cluster - which is the cluster before being edited -
              if (editingMode)
                finalCluster.original = editedClusterObject

              /**
               * Inner function to do processes after saving/updating cluster
               *
               * @Parameters:
               * {boolean} `status` saving/updating process status [true: success, false: failed]
               * {object} `?secrets` secrets to be updated for the cluster after the saving/updating process
               */
              let postProcess = async (status, secrets = null) => {
                // Enable the buttons in the footer
                button.add('#testConnectionCluster').add('#switchEditor').removeAttr('disabled')

                try {
                  // If the saving/updating process has succeeded then skip this try-catch block
                  if (status)
                    throw 0

                  // Show feedback to the user about the failure
                  showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), `${I18next.capitalizeFirstLetter(I18next.t(editingMode ? 'failed to update the connection' : 'failed to save the new connection'))}.`, 'failure')

                  // Skip the upcoming code - end the process -
                  return
                } catch (e) {}

                /**
                 * The cluster has been successfully saved/updated
                 *
                 * Show feedback to the user
                 */
                showToast(I18next.capitalize(I18next.t(!editingMode ? 'add connection' : 'update connection')), `${I18next.capitalizeFirstLetter(I18next.t(editingMode ? 'the connection has been successfully updated' : 'the new connection has been successfully saved'))}.`, 'success')

                // Click the close button
                $(`${dialog}-right`).parent().parent().find('button.btn-close').click()

                // Make sure all fields are cleared
                try {
                  /**
                   * If this is an editing mode then there's no need for this try-catch block
                   * When the user attempts to edit another cluster all fields are updated
                   * Also when attempting to add a new cluster the app detects that the previous attempt was `edit` and do changes as needed
                   */
                  if (editingMode)
                    throw 0

                  setTimeout(() => {
                    // Set the default `.cqlshrc` content
                    editor.setValue(Modules.Consts.CQLSHRC)

                    $('div.modal#addEditClusterDialog div.modal-body div.side-left div.sections div.section div.btn[section="basic"]').click()

                    // Loop through each input not related to section nor key in the `.cqlshrc` content
                    $('[info-section="none"][info-key]').each(function() {
                      // Get the input's Material Design object
                      let object_ = getElementMDBObject($(this))

                      // Handle when the input is actually a file selector
                      try {
                        // If the input is not a file selector then skip this try-catch block
                        if ($(this).parent().attr('file-name') == undefined)
                          throw 0

                        /**
                         * Update the tooltip's content and state
                         * Get the object
                         */
                        let tooltipObject = mdbObjects.filter((object) => object.type == 'Tooltip' && object.element.is($(this)))

                        // Clear the file's name preview
                        $(this).parent().attr('file-name', '-')

                        // Disable the tooltip
                        try {
                          tooltipObject[0].object.disable()
                        } catch (e) {}
                      } catch (e) {}

                      /**
                       * If it is `undefined` then it hasn't been found in the `cqlsh.rc` file
                       * Set the input value to ''
                       */
                      try {
                        $(this).val('')
                      } catch (e) {
                        // If the previous set didn't work then try to call the `selected` attribute
                        try {
                          $(this).prop('checked', getAttributes($(this), 'default-value') == 'true' ? true : false)
                        } catch (e) {}
                      } finally {
                        // Update the object
                        object_.update()
                        object_._deactivate()
                      }
                    })
                  }, 1000)
                } catch (e) {}

                try {
                  // If the current mode is not `edit` then skip this try-catch block
                  if (!editingMode)
                    throw 0

                  // Point at the cluster's UI element in the workspace clusters' list
                  let clusterUI = $(`div.clusters-container div.clusters div.cluster[data-id="${editedClusterObject.info.id}"]`),
                    // Get all saved clusters
                    getAllClusters = await Modules.Clusters.getClusters(workspaceID),
                    // Get the edited/updated cluster
                    newEditedCluster = getAllClusters.find((_cluster) => _cluster.info.id == finalCluster.info.id)

                  // Update the cluster's name
                  try {
                    clusterUI.find('div.header > div.title').text(newEditedCluster.name)
                  } catch (e) {}

                  // Update the cluster's host
                  try {
                    clusterUI.find('div.info[info="host"] div.text').text(newEditedCluster.host)
                  } catch (e) {}

                  // Hide cassandra® and datacenter info elements and show their placeholder
                  (['cassandra', 'data-center']).forEach((info) => {
                    info = clusterUI.find(`div.info[info="${info}"]`)
                    info.children('div.text').text('')
                    info.children('div._placeholder').fadeIn('fast')
                  })

                  // Update the cluster's UI element's attributes
                  clusterUI.attr({
                    'data-name': newEditedCluster.name,
                    'data-folder': newEditedCluster.folder,
                    'data-host': newEditedCluster.host,
                    'data-connected': 'false',
                    'data-workarea': 'false'
                  })

                  // Update the status of the cluster in the mini cluster's list
                  updateMiniCluster(workspaceID, getAttributes(clusterUI, 'data-id'), true)

                  try {
                    // Update secrets data for the cluster - Apache Cassandra®'s authentication and SSH credentials -
                    clusterUI.attr({
                      'data-username': saveAuthCredentials && secrets.auth == undefined ? (secrets != null ? secrets.username : null) : null,
                      'data-password': saveAuthCredentials && secrets.auth == undefined ? (secrets != null ? secrets.password : null) : null,
                      'data-ssh-username': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshUsername : null) : null,
                      'data-ssh-password': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshPassword : null) : null,
                      'data-ssh-passphrase': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshPassphrase : null) : null,
                      'data-credentials-auth': secrets.auth != undefined || (!saveAuthCredentials && (secrets != null && secrets.username != null && secrets.password != null)) ? 'true' : null,
                      'data-credentials-ssh': secrets.ssh != undefined || !saveSSHCredentials && (secrets != null && secrets.sshUsername != null && secrets.sshPassword != null) ? 'true' : null,
                    })
                  } catch (e) {
                    try {
                      errorLog(e, 'connections')
                    } catch (e) {}
                  }

                  // Remove all test connection status classes
                  clusterUI.find('div.status').removeClass('show success failure')

                  // Update the global `editedClusterObject` value
                  editedClusterObject = newEditedCluster
                } catch (e) {}

                {
                  setTimeout(() => {
                    let clusterElement = $(`div.clusters-container div.cluster[data-id="${finalCluster.info.id}"]`),
                      cassandraVersion = clusterElement.find('div[info="cassandra"]'),
                      // Point at the data center element
                      dataCenterElement = clusterElement.find('div[info="data-center"]'),
                      // Point at the `CONNECT` button
                      connectBtn = clusterElement.children('div.footer').children('div.button').children('button.connect'),
                      // Point at the `TEST CONNECTION` button
                      testConnectionBtn = clusterElement.children('div.footer').children('div.button').children('button.test-connection'),
                      // Point at the status element - the flashing circle at the top right -
                      statusElement = clusterElement.children('div.status')

                    try {
                      if (tempClusterID == null)
                        throw 0

                      /**
                       * Add the created SSH tunnel object to the `sshTunnelsObjects` array; to have the ability to identify if the cluster has an SSH tunnel associated with it
                       */
                      sshTunnelsObjects[finalCluster.info.id] = testedSSHTunnelObject

                      try {
                        IPCRenderer.send('ssh-tunnel:update', {
                          oldID: tempClusterID,
                          newID: finalCluster.info.id
                        })
                      } catch (e) {}
                    } catch (e) {}

                    // Show Apache Cassandra® version
                    cassandraVersion.children('div._placeholder').hide()
                    cassandraVersion.children('div.text').text(`v${testedClusterObject.version}`)

                    // Show data center
                    if (testedClusterObject.datacenter != undefined) {
                      dataCenterElement.children('div._placeholder').hide()
                      dataCenterElement.children('div.text').text(`${testedClusterObject.datacenter}`)
                    }

                    // Update some attributes for the cluster UI element alongside some classes
                    clusterElement.attr({
                      'data-cassandra-version': testedClusterObject.version,
                      'data-datacenter': testedClusterObject.datacenter,
                      'data-datacenters': JSON.stringify(testedClusterObject.datacenters),
                      'data-connected': 'true'
                    })

                    // Add the success state to the cluster's UI element
                    statusElement.removeClass('failure').addClass('show success')

                    setTimeout(() => {
                      // Enable the `CONNECT` button
                      connectBtn.add(testConnectionBtn).removeAttr('disabled')

                      // Remove the test connection state
                      clusterElement.removeClass('test-connection enable-terminate-process')

                      // Hide the termination process' button after a set time out
                      setTimeout(() => clusterElement.removeClass('enable-terminate-process'), ConnectionTestProcessTerminationTimeout)
                    })
                  }, 1000)
                }

                // Refresh clusters for the currently active workspace
                $(document).trigger('refreshClusters', workspaceID)

                // Get workspaces; to sync with newly added/updated clusters
                $(document).trigger('getWorkspaces')
              }
              // End of the inner function to do processes after saving/updating cluster

              try {
                /**
                 * Check username and password for both; Apache Cassandra® and SSH tunnel
                 *
                 * Define the secrets to be checked
                 */
                let values = ['username', 'password', 'ssh-sshUsername', 'ssh-sshPassword', 'ssh-sshPrivatekey', 'ssh-sshPassphrase']

                // Loop through each secret
                values.forEach((value) => {
                  /**
                   * Get the secret's value from the related input field
                   * Using `eval` here won't affect the performance at all
                   */
                  eval(`${value.replace('ssh-', '')} = "${$(`[info-section="none"][info-key="${(value.replace('-ssh', '-')).toLowerCase()}"]`).val()}"`)
                })

                // If Apache Cassandra®'s username and password have been provided then the encryption process must be executed
                if ([username, password].every((secret) => secret.trim().length != 0))
                  waitForEncryption = true

                // If SSH's username and password have been provided then the encryption process must be executed, and add the tunnel creation info to the cluster's object
                if (sshUsername.trim().length != 0 && [sshPassword, sshPrivatekey].some((secret) => secret.trim().length != 0)) {
                  waitForEncryption = true
                  sshTunnel = true
                }
              } catch (e) {
                try {
                  errorLog(e, 'connections')
                } catch (e) {}
              }

              try {
                // If there's no SSH tunnel creation info to be handled then skip this try-catch block
                if (!sshTunnel)
                  throw 0

                // Add `ssh` object to the final cluster's object
                finalCluster.ssh = {}

                // Add the `privatekey` attribute if it has been provided
                if (sshPrivatekey.trim().length != 0)
                  finalCluster.ssh.privatekey = sshPrivatekey

                // Add the `passphrase` attribute if it has been provided
                if (sshPassphrase.trim().length != 0)
                  finalCluster.ssh.passphrase = sshPassphrase

                // Add other info; host, port, destination address, and destination port
                finalCluster.ssh.host = $('[info-section="none"][info-key="ssh-host"]').val() || $('[info-section="connection"][info-key="hostname"]').val()
                finalCluster.ssh.port = $('[info-section="none"][info-key="ssh-port"]').val() || 22
                finalCluster.ssh.dstAddr = $('[info-section="none"][info-key="ssh-dest-addr"]').val() || '127.0.0.1'
                finalCluster.ssh.dstPort = $('[info-section="none"][info-key="ssh-dest-port"]').val() || $('[info-section="connection"][info-key="port"]').val()
              } catch (e) {
                try {
                  errorLog(e, 'connections')
                } catch (e) {}
              }

              // Determine the proper function to be called based on whether the current mode is `edit` or not
              let clustersCallFunction = editingMode ? Modules.Clusters.updateCluster : Modules.Clusters.saveCluster

              try {
                // If there's no need to wait for the encryption process then skip this try-catch block
                if (!waitForEncryption)
                  throw 0

                // Get the apps' public RSA key
                getKey('public', (key) => {
                  try {
                    // If the received key is valid to be used then skip this try-catch block
                    if (key.length != 0)
                      throw 0

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('secret keys')), I18next.capitalizeFirstLetter(I18next.t('an error has occurred with secret keys, please check the app permissions and make sure the keychain feature is available on your system')) + '.', 'failure')

                    // Call the post-process function with `false` - failed to save/update the cluster
                    postProcess(false)

                    // Stop the process; as something is not correct with the generator tool
                    return
                  } catch (e) {}

                  /**
                   * Encrypt all provided secrets - for Apache Cassandra® and SSH -
                   *
                   * Create an array of names and values of the secrets
                   */
                  let secrets = [{
                      name: 'username',
                      value: username
                    }, {
                      name: 'password',
                      value: password
                    }, {
                      name: 'sshUsername',
                      value: sshUsername
                    }, {
                      name: 'sshPassword',
                      value: sshPassword
                    },
                    {
                      name: 'sshPassphrase',
                      value: sshPassphrase
                    }
                  ]

                  // Values will be saved in the `secrets` object
                  finalCluster.info.secrets = [],
                    // Array to be a copy from the original secrets before manipulation
                    savedSecrets = []

                  // Set the `credentials` attribute
                  finalCluster.info.credentials = {}

                  // Loop through each secret's value
                  for (let secret of secrets) {
                    // Make sure there's a value to encrypt
                    if (secret.value.trim().length != 0 && !([undefined, null].includes(secret.value))) {
                      // Whether or not the current secret will be saved or the user will be asked to provide this secret next time
                      let toBeSaved = secret.name.indexOf('ssh') != -1 ? saveSSHCredentials : saveAuthCredentials

                      // This secret/credential will be saved
                      if (toBeSaved) {
                        savedSecrets[secret.name] = encrypt(key, secret.value)
                      } else {
                        // This credential should be provided by the user next time
                        finalCluster.info.credentials[secret.name.indexOf('ssh') != -1 ? 'ssh' : 'auth'] = true
                      }
                    }
                  }

                  // If there are no saved secrets then delete the `secrets` attribute
                  if (Object.keys(savedSecrets).length <= 0) {
                    delete finalCluster.info.secrets
                  } else {
                    // Otherwise, save it
                    finalCluster.info.secrets = savedSecrets
                  }

                  // If ther are no required credentials then delete the `credentials` attribute
                  if (Object.keys(finalCluster.info.credentials).length <= 0)
                    delete finalCluster.info.credentials

                  // Call the proper function, then pass the status to the `postProcess` inner function
                  clustersCallFunction(workspaceID, finalCluster).then((status) => postProcess(status, editingMode ? {
                    ...savedSecrets,
                    ...finalCluster.info.credentials
                  } : null))
                })

                // Skip the upcoming code
                return
              } catch (e) {}

              /**
               * Reaching here means there's no need to wait for the encryption process
               *
               * Call the proper function, then pass the status to the `postProcess` inner function
               */
              clustersCallFunction(workspaceID, finalCluster).then((status) => postProcess(status))
            })
          }
        }

        // Click one of the select file inputs
        {
          // This selection covers all select file inputs and their click area
          $('div.form-outline div.clickable').click(function() {
            // Get the input key's name
            let key = getAttributes($(this), 'for-info-key') || getAttributes($(this), 'for-input'),
              // Whether or not empty value is allowed
              allowEmptyValue = getAttributes($(this), 'data-empty-not-allowed') == undefined,
              id = getRandomID(5), // Get random ID for the selection file dialog
              title = '' // Define the file selection dialog's title

            // Switch between key values
            switch (key) {
              case 'workspacePath': {
                title = 'select workspace folder path'
                break
              }
            }

            // Set other attributes to be used to create the dialog
            let data = {
              id,
              title: I18next.capitalizeFirstLetter(I18next.t(title)),
              properties: ['showHiddenFiles', 'createDirectory', 'promptToCreate', getAttributes($(this), 'for-input') == undefined ? 'openFile' : 'openDirectory']
            }

            // Send a request to the main thread to create a dialog
            IPCRenderer.send('dialog:create', data)

            // Listen for the response
            IPCRenderer.on(`dialog:${id}`, (_, selected) => {
              // The received value is either a path or convert it to an empty string
              selected = selected || ``

              if (!allowEmptyValue && selected.length <= 0)
                return

              // Get the MDB object for the current input field
              let inputObject = getElementMDBObject($(this).parent().children('input'))

              try {
                // Update the input's value
                $(this).parent().children('input').val(selected)

                // Trigger a custom event
                $(this).parent().children('input').trigger('inputChanged')

                // Update its state
                inputObject.update()
              } catch (e) {}
            })
          })

          /**
           * This input is related to select files regards SSH, SSL, and Cassandra® authentication
           * Listeners are `click` and `keypress` - ENTER -
           */
          $('div.form-outline[role="file-selector"] input').on('click keypress', function(e) {
            // If the event is key pressing and the key is not ENTER then end this process
            if (e.type == 'keypress' && e.keyCode != 13)
              return

            // Prevent the default behavior of the event
            e.preventDefault()

            // Get the input key's name
            let key = getAttributes($(this), 'info-key'),
              id = getRandomID(5), // Get random ID for the selection file dialog
              title = '' // Define the file selection dialog's title

            // Switch between key values
            switch (key) {
              case 'credentials': {
                title = 'select cassandra credentials file'
                break
              }
              case 'ssh-privatekey': {
                title = 'select SSH private key file'
                break
              }
              case 'certfile': {
                title = 'select SSL CA certificate file'
                break
              }
              case 'userkey': {
                title = 'select SSL user key file'
                break
              }
              case 'usercert': {
                title = 'select SSL user certificate key file'
                break
              }
            }

            // Set other attributes to be used to create the dialog
            let data = {
              id,
              title: I18next.capitalize(I18next.t(title)),
              properties: ['showHiddenFiles', 'createDirectory', 'promptToCreate', 'openFile']
            }

            // Send a request to the main thread to create a dialog
            IPCRenderer.send('dialog:create', data)

            // Listen for the response
            IPCRenderer.on(`dialog:${id}`, (_, selected) => {
              // The received value is either a path or convert it to an empty string
              selected = selected || ``

              /**
               * Update the tooltip's content and state
               * Get the object
               */
              let tooltipObject = getElementMDBObject($(this), 'Tooltip')

              // If the path to the file is invalid or inaccessible then don't adopt it
              if (!pathIsAccessible(selected[0])) {
                // Clear the input's value
                $(this).val('').trigger('input')

                // CLear the file's name preview
                $(this).parent().attr('file-name', '-')

                try {
                  // Disable the tooltip
                  tooltipObject.disable()
                } catch (e) {}

                // Skip the upcoming code
                return
              }

              try {
                // Enable the tooltip and update its content
                tooltipObject.enable()
                tooltipObject.setContent(selected[0])
              } catch (e) {}

              // Set the selected file's path
              $(this).val(selected[0]).trigger('input')
              $(this).parent().attr('file-name', Path.basename(selected[0]))
            })
          })
        }
      }
    }

    // Load schema snapshot dialog
    {
      // Define a portion of the common CSS selector
      let dialog = `div.modal#loadSnapshot div.modal-body`

      // Once the user inputs something in the snapshot's search input field
      {
        $(`${dialog}`).find('input[type="text"]').on('input', function() {
          // Get the search text
          let text = minifyText($(this).val())

          // Loop through each saved snapshot
          $('div.modal#loadSnapshot div.snapshots div.snapshot').each(function() {
            // Minify the snapshot's content
            let content = minifyText($(this).text())

            // Show/hide the snapshot based on whether its content has the search text or the search text's length is less than 2
            $(this).toggle(content.search(text) || text.length < 2)
          })
        })
      }

      // Actions for multiple snapshots
      {
        // Clicks the selection button
        $(`${dialog}`).find('div.actions-multiple a[action="select"]').click(function() {
          // If the action to be performed is checking the snapshot's checkbox
          let check = $(this).attr('check') == 'true'

          // Loop through each snapshot's checkbox
          $(`${dialog}`).find('input[type="checkbox"]').each(function() {
            // Set its state based on the action to be performed
            $(this).prop('checked', check)
          })

          // Toggle the `check` attribute's status
          $(this).attr('check', `${!check}`)

          // Toggle the actions' container based on the `check` status
          $(this).parent().toggleClass('show', check)
        })

        // Clicks the deletion button
        $(`${dialog}`).find('div.actions-multiple a[action="delete"]').click(function() {
          // Open the confirmation dialog and wait for the response
          openDialog(I18next.capitalizeFirstLetter(I18next.t('do you want to delete the selected snapshots? once you confirm, there is no undo')), (response) => {
            // If canceled, or not confirmed then skip the upcoming code
            if (!response.confirmed)
              return

            // Loop through each snapshot
            $(`${dialog} div.snapshots div.snapshot`).each(function() {
              // Check if the checkbox of it is checked
              let checked = $(this).find('input[type="checkbox"]').prop('checked')

              // If so, then delete that snapshot
              if (checked)
                $(this).find('a[action="delete"]').trigger('click', {
                  noConfirm: true,
                  checked: response.checked
                })
            })
          }, true, 'keep the associated files in the system')
        })
      }
    }

    // Observe addition/removal of clusters' switchers
    {
      // Point at the clusters' switchers' container
      let switchersContainer = $(`div.body div.left div.content div.switch-clusters`),
        // Create observer object
        observer = new MutationObserver(function(mutations) {
          // Loop through each detected mutation
          mutations.forEach(function(mutation) {
            // If the mutation is an appended/removed child
            if (mutation.type === 'childList')
              setTimeout(() => {
                // Update the switchers' container's view
                updateSwitcherView('clusters')

                // Handle the first switcher's margin
                handleClusterSwitcherMargin()
              }, 100)
          })
        })

      // Start the observation process
      observer.observe(switchersContainer[0], {
        childList: true
      })
    }
  }

  // Handle different events for input fields with `file` type
  {
    $(`input[info-section][info-key][type="file"]`).parent().add(`input[info-section][info-key][type="file"]`).on('change click', function() {
      // Point at the input field
      let input = $(this)

      // If the element is the parent of the input field then point at the input field instead
      if ($(this).is($(`input[info-section][info-key][type="file"]`).parent()))
        input = input.children('input')

      /**
       * Initial state is used to print the saved value of the input field
       * It should be removed once an event is triggered
       *
       * Remove the initial indicator's attribute
       */
      input.removeAttr('data-initial')

      // Remove the initial class
      input.removeClass('initial')
    })
  }

  // Clicks the `ADD CLUSTER` button which shows up if there are no added clusters
  {
    $(`button#addClusterProcess`).on('click', function(e, editingMode = false) {
      // Define the dialog path's CSS selector
      let dialog = 'div.modal#addEditClusterDialog'

      try {
        // If the previous mode wasn't `editing` a workspace, or the mode is `edit` then skip this try-catch block
        if (getAttributes($(`${dialog}`), 'data-edit-cluster-id') == undefined || editingMode)
          throw 0

        // Reset everything and make sure the `creation mode` is properly back
        $(`${dialog}`).find('h5.modal-title').text(I18next.capitalize(I18next.t('add connection')))
        $(`${dialog}`).removeAttr('data-edit-workspace-id data-edit-cluster-id')

        $(`${dialog} button#addCluster`).attr('disabled', 'disabled')
        $(`${dialog} button#addCluster`).text(I18next.capitalize(I18next.t('add connection')))

        $('div.modal#addEditClusterDialog div.modal-body div.side-left div.sections div.section div.btn[section="basic"]').click()

        // Loop through all inputs in the dialog
        $(`${dialog}`).find('[info-section][info-key]').each(function() {
          let input = $(this),
            inputObject = getElementMDBObject(input)

          // Remove the `is-invalid` class
          input.removeClass('is-invalid')

          // Attempt to remove its value
          try {
            input.val('')
          } catch (e) {}

          // Reset the checkbox's value
          try {
            input.prop('checked', getAttributes(input, 'default-value') == 'true')
          } catch (e) {}

          // Get its MDB object and update it
          setTimeout(() => {
            try {
              inputObject.update()
              inputObject._deactivate()
            } catch (e) {}

            // Remove the initial indicator's attribute
            input.removeAttr('data-initial')

            // Remove the initial class
            input.removeClass('initial')
          })
        })

        // Reset editor's content
        editor.setValue(Modules.Consts.CQLSHRC)
      } catch (e) {}
    })
  }

  // Click event for `add` and `refresh` actions in the clusters' container
  {
    // Define a portion of the common CSS selector
    let selector = `div.body div.right div.content div[content="clusters"] div.section-actions div.action`,
      // Inner function to click the parent button - which shows/hides actions buttons
      clickParentButton = (button) => {
        $(button).parent().parent().find('button.btn.btn-lg').click()
      }

    // Clicks the add button
    $(`${selector}[action="add"] button`).click(function() {
      // Point at the button to be clicked - which is the `ADD CLUSTER` button -
      let buttonToBeClicked = $(`button#addClusterProcess`)

      // If the current workspace is the sandbox then point at the `ADD PROJECT` button
      if (getActiveWorkspaceID() == 'workspace-sandbox')
        buttonToBeClicked = $(`button#createSandboxProjectProcess`)

      // Click the pointed at button
      buttonToBeClicked.click()

      // Call the inner function
      clickParentButton(this)

      // Hide the tooltip
      tooltips.addClusterActionButton.hide()
    })

    // Clicks the refresh button
    $(`${selector}[action="refresh"] button`).click(function() {
      // Refresh clusters' list
      $(document).trigger('refreshClusters', getActiveWorkspaceID())

      // Call the inner function
      clickParentButton(this)

      // Hide the tooltip
      tooltips.refreshClusterActionButton.hide()
    })
  }

  // Handle the clusters' witcher's navigation arrows - up and down -
  {
    $(`div.body div.left div.content div.switch-clusters div.more-clusters div.buttons button`).click(function() {
      // Get the clicked button's navigation
      let navigation = $(this).attr('navigation'),
        // Point at the switchers' container
        switchersContainer = $(`div.body div.left div.content div.switch-clusters`),
        // Get all currently visible switchers
        visibleSwitchers = switchersContainer.children('div.cluster[_cluster-id]').filter(':visible')

      // Remove the `hidden` attribute from all switchers; as they'll be shown or hidden as needed
      switchersContainer.children('div.cluster[_cluster-id]').removeAttr('hidden')

      // Handle the down arrow
      try {
        // If the navigation direction is not `down` then skip this try-catch block
        if (navigation != 'down')
          throw 0

        // Point at the switcher to be shown
        let switcherToBeShown = visibleSwitchers.last().nextAll().filter(':hidden').first()

        // If we already have reached the latest switcher then no need to run the following code
        if (switcherToBeShown.length <= 0)
          return

        // Hide the first `visible` switcher - will be at the very top -
        visibleSwitchers.first().hide()

        // Show the selected switcher to be shown
        switcherToBeShown.show()

        // Call the margin handler function
        handleClusterSwitcherMargin()

        // Skip the upcoming code
        return
      } catch (e) {}

      /**
       * Reaching here means it's the up arrow
       * Point at the switcher to be shown
       */
      let switcherToBeShown = visibleSwitchers.first().prevAll().filter(':hidden').first()

      // If we already have reached the first switcher then no need to run the following code
      if (switcherToBeShown.length <= 0)
        return

      // Hide the last `visible` switcher - will be at the very bottom -
      visibleSwitchers.last().hide()

      // Show the selected switcher to be shown
      switcherToBeShown.show()

      // Call the margin handler function
      handleClusterSwitcherMargin()
    })
  }

  // Handle the request of getting a CQL description of the cluster, keyspace in it, or a table
  {
    IPCRenderer.on('cql-desc:get', (_, data) => {
      // Define a portion of the common CSS selector
      let selector = `div.body div.right div.content div[content]`,
        // Point at the associated cluster's UI element
        clusterElement = $(`${selector}[content="clusters"] div.clusters-container div.cluster[data-id="${data.clusterID}"]`),
        // Point at the associated cluster's work area UI element
        workareaElement = $(`${selector}[content="workarea"] div.workarea[cluster-id="${data.clusterID}"]`),
        // Point at the CQL description's tab's content - main container -
        cqlDescriptionsTabContent = workareaElement.find('div.sub-sides div.tab-content div.tab-pane[tab="cql-description"]'),
        // Point at the CQL descriptions' elements container
        cqlDescriptionsContainer = cqlDescriptionsTabContent.find('div.descriptions-container div.descriptions'),
        // Point at the CQL description tab - navigation tab -
        cqlDescriptionTab = $(`a.nav-link.btn[href="#_${data.tabID}"]`),
        // Get the cql descriptions' tab MDB object
        cqlDescriptionTabObject = getElementMDBObject(cqlDescriptionTab, 'Tab'),
        // Flag to tell if the description has been fetched already or not - no need to perform the same actions for the same request -
        isDescriptionFetched = false,
        // Point at the clicked node
        clickedNode = $(`#${data.nodeID}`)

      // Add the processing class
      clickedNode.addClass('perform-process')

      // Get the CQL description based on the passed scope
      Modules.Clusters.getCQLDescription(data.clusterID, data.scope, (description) => {
        // As the description has been received remove the processing class
        clickedNode.removeClass('perform-process')

        // If the description has been fetched already then skip this process
        if (isDescriptionFetched)
          return

        // Update the flag
        isDescriptionFetched = true

        // The CQL description's tab's container is not empty now, and make sure to clear the empty the search input field
        cqlDescriptionsTabContent.removeClass('_empty').find('input').val('').trigger('input')

        // Show the tab's content automatically
        setTimeout(() => cqlDescriptionTabObject.show(), 250)

        /**
         * Trigger the `resize` event for the entire window
         * This will resize all editors
         */
        setTimeout(() => $(window.visualViewport).trigger('resize'), 260)

        // Check if there's an associated CQL description
        let associatedDescription = cqlDescriptionsContainer.find(`div.description[data-scope="${data.scope}"]`),
          // Manipulate the scope to be set in the badge
          scope = data.scope == 'cluster' ? `Cluster: ${getAttributes(clusterElement, 'data-name')}` : ''

        try {
          // If the scope's length after the manipulation is not `0` then it's a `cluster` scope and this try-catch block may be skipped
          if (scope.length != 0)
            throw 0

          // Manipulate the scope
          scope = data.scope.replace(/\s*\>\s*/gm, ': ')
            .replace(/keyspace:/gm, 'Keyspace: ')
            .replace(/table:/gm, '<span class="dot"></span> Table: ')
            .replace(/\s+/gm, ' ')
        } catch (e) {}

        try {
          // If there's no associated description then skip this try-catch block
          if (associatedDescription.length <= 0)
            throw 0

          setTimeout(() => {
            // Add the scope in the search input field and trigger the `input` event
            cqlDescriptionsTabContent.find('input').val(StripTags(scope)).trigger('input')

            // Get the description's editor's object
            let editorObject = monaco.editor.getEditors().find((editor) => associatedDescription.find('div.editor').is(editor._domElement))

            // Update the editor's content with the latest fetched description
            editorObject.setValue(OS.EOL + OS.EOL + `${description}`)
          })

          // Skip the upcoming code
          return
        } catch (e) {}

        // Get a random ID for the description's editor's container
        let editorContainerID = getRandomID(10)

        // Description's UI element structure
        let element = `
            <div class="description" data-scope="${data.scope}">
              <span class="badge rounded-pill badge-secondary">
                <a href="#_${editorContainerID}">${scope}</a>
              </span>
              <div class="inner-content">
                <div class="editor" id="_${editorContainerID}"></div>
              </div>
              <div class="expand-editor">
                <button type="button" class="btn btn-sm btn-tertiary expand-editor" data-mdb-ripple-color="light" data-tippy="tooltip" data-mdb-placement="right" data-mulang="expand editor" capitalize data-title="Expand editor">
                  <ion-icon name="arrow-left"></ion-icon>
                </button>
              </div>
            </div>`

        // Prepend the description's UI element to the container
        cqlDescriptionsContainer.prepend($(element).show(function() {
          // Handle the expandation/shrinking button's different actions and events listeners
          setTimeout(() => {
            // Point at the description UI element
            let main = $(this),
              // Hold the original height of the description before any manipulation
              originalHeight = main.actual('height', {
                absolute: true
              }),
              // Point at the expandation/shrinking button
              expandBtnElement = $(this).find('button.expand-editor'); // This semicolon is critical here

            // Create a tooltip object for the button
            getElementMDBObject(expandBtnElement, 'Tooltip')

            // Once the button is clicked
            expandBtnElement.click(function() {
              // Whether or not the description's UI element has already been expanded
              let isAlreadyExpanded = $(this).hasClass('shrink')

              // Toggle the `shrink` class for the button based on the flag
              $(this).toggleClass('shrink', !isAlreadyExpanded)

              // If the original height hasn't been fetched then fetch it now
              if (originalHeight <= 0)
                originalHeight = main.actual('height', {
                  absolute: true
                })

              try {
                // If the description's UI element is not expanded already then skip this try-catch block
                if (!isAlreadyExpanded)
                  throw 0

                // Set the original height
                main.css('height', `${originalHeight}px`)

                /**
                 * After a set period of time set `height` to be `auto`
                 * This is useful in case the app's main window has been resized
                 */
                setTimeout(() => main.css('height', `auto`), 210)

                // Skip the upcoming code
                return
              } catch (e) {}

              // Set the original height
              main.css('height', `${originalHeight}px`)

              /**
               * Reaching here means the description's UI element has to be expanded
               *
               * Get the descriptions' container's height
               */
              let descriptionsContainerHeight = main.parent().actual('height')

              // Set the new height of the description's UI element
              main.css('height', `${descriptionsContainerHeight - 38}px`)

              // Click the attached anchor in the description's UI element
              setTimeout(() => $(main).find('a')[0].click(), 210)
            })

            // Click the expandation button
            setTimeout(() => expandBtnElement.click(), 100)
          })

          setTimeout(() => {
            // Create an editor for the description
            let descriptionEditor = monaco.editor.create($(`#_${editorContainerID}`)[0], {
              value: OS.EOL + OS.EOL + `${description}`,
              language: 'sql', // Set the content's language
              minimap: {
                enabled: true
              },
              readOnly: true,
              glyphMargin: false,
              suggest: {
                showFields: false,
                showFunctions: false
              },
              theme: 'vs-dark',
              scrollBeyondLastLine: false,
              mouseWheelZoom: true,
              fontSize: 11
            })

            /**
             * Make sure the editor's dimensions are correct
             * Set a counter with an initial value
             */
            let count = 0,
              // Create an interval that will be cleared after 5 executes
              updateEditorLayout = setInterval(() => {
                // After 5 executes
                if (count >= 5) {
                  /**
                   * Create a multiple resize observers for the work area body element
                   * By doing this the editor's dimensions will always fit with its parent container
                   *
                   * Create observer for the work area overall
                   */
                  setTimeout(() => {
                    (new ResizeObserver(() => {
                      try {
                        descriptionEditor.layout()
                      } catch (e) {}
                    })).observe(workareaElement[0]); // This semicolon is critical here

                    // Create observer for the description's UI element
                    (new ResizeObserver(() => {
                      try {
                        descriptionEditor.layout()
                      } catch (e) {}
                    })).observe($(this)[0])
                  })

                  // Clear the interval
                  clearInterval(updateEditorLayout)
                }

                // Update the editor's layout/dimensions
                descriptionEditor.layout(); // This semicolon is critical here

                // Increase the counter
                ++count
              }, 100)
          })

          // Apply the chosen language on the UI element after being fully loaded
          setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
        }))
      })
    })
  }

  // Handle the request of closing a cluster's work area
  {
    IPCRenderer.on('workarea:close', (_, data) => $(`div.btn[data-id="${data.btnID}"]`).trigger('click', false))
  }
}
