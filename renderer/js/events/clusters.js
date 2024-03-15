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

    // Determine if the associated workspace is the Docker-sandbox
    let isSandbox = workspaceID == 'workspace-sandbox',
      // Set the suitable function to get clusters/projects based on the type of the workspace
      getModuleFunction = !isSandbox ? Modules.Clusters.getClusters : Modules.Docker.getProjects

    // Get all clusters/projects saved in the workspace
    getModuleFunction(workspaceID).then((clusters) => {
      // Clean the container if the event is `get` clusters
      if (event == 'getClusters')
        clustersContainer.html('')

      // Add or remove the `empty` class based on the number of saved clusters
      let isNoClusters = clusters.length <= 0

      // Toggle the `empty` class
      setTimeout(() => parentClusterContainer.toggleClass('empty', isNoClusters), isNoClusters ? 200 : 10)

      /**
       * Click the cog actions button; to hide the actions sub-buttons
       *
       * Point at the cog actions button in the UI
       */
      let clusterActions = parentClusterContainer.find('div.section-actions')

      // If sub-buttons are shown then hide them
      if (clusterActions.hasClass('show'))
        clusterActions.children('div.main').children('button').click()

      // Loop through all clusters
      clusters.forEach((cluster, currentIndex) => {
        try {
          // If the current workspace is not the sandbox then skip this try-catch block
          if (!isSandbox)
            throw 0

          /**
           * Set different attributes for the current cluster's object
           * By doing this resusing and adopting the the same code of clusters for the sandbox projects is possible without the need to do heavy edits and changes
           */
          cluster.info = {}
          cluster.info.id = cluster.folder
          cluster.info.secrets = undefined
          cluster.name = cluster.name || cluster.folder
          cluster.host = `127.0.0.1:${cluster.ports.cassandra}`
        } catch (e) {}

        // Define the cluster's ID
        let clusterID = cluster.info.id,
          // Get random IDs for the different elements of the cluster's UI element
          [
            testConnectionBtnID,
            connectBtnID,
            startProjectBtnID,
            folderBtnID,
            settingsBtnID,
            deleteBtnID
          ] = getRandomID(15, 6),
          /**
           * The AxonOps sectin ID
           * It's defined here as it's being used in different parts of the event
           */
          axonOpsContentID = getRandomID(15),
          // Flag to tell if this cluster is going to be added/appended to the UI as a new element or if it already exists, by default it's `true`
          append = true

        /**
         * Look for the cluster in the UI
         * If it exists then no need to append it
         */
        if (event == 'refreshClusters')
          append = $(`div.cluster[data-id="${clusterID}"][data-workspace-id="${workspaceID}"]`).length != 0 ? false : append

        // This variable will contain the username and password of DB and SSH in UI attributes if needed
        let secrets = ''

        try {
          /**
           * If the current cluster doesn't have secrets:
           * `username` and `password` for Apache Cassandra DB, and SSH `username` and `password` then skip this try-catch block
           */
          if (cluster.info.secrets == undefined)
            throw 0

          // Shorten the secrets reference
          let secretsInfo = cluster.info.secrets

          // Check the DB authentication's username
          if (secretsInfo.username != undefined)
            secrets += `data-username="${secretsInfo.username}" `

          // Check the DB authentication's password
          if (secretsInfo.password != undefined)
            secrets += `data-password="${secretsInfo.password}" `

          // Check the SSH username
          if (secretsInfo.sshUsername != undefined)
            secrets += `data-ssh-username="${secretsInfo.sshUsername}" `

          // Check the SSH password
          if (secretsInfo.sshPassword != undefined)
            secrets += `data-ssh-password="${secretsInfo.sshPassword}" `

          // Check the SSH passphrase
          if (secretsInfo.sshPassphrase != undefined)
            secrets += `data-ssh-passphrase="${secretsInfo.sshPassphrase}" `
        } catch (e) {}

        // This variable will contain the requirement of DB auth and SSH credentials in UI attributes if needed
        let credentials = ''

        try {
          // If the current cluster doesn't have any credentials to be given then skip this try-catch block
          if (cluster.info.credentials == undefined)
            throw 0

          // Check the DB authentication credentials
          if (cluster.info.credentials.auth != undefined)
            credentials += ` data-credentials-auth="true"`

          // Check the SSH credentials
          if (cluster.info.credentials.ssh != undefined)
            credentials += ` data-credentials-ssh="true"`
        } catch (e) {}

        /**
         * Define the footer of the cluster's UI based on the workspace's type
         * It can be a normal cluster or a sandbox project
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
              <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${clusterID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Open the cluster folder"
                data-mulang="open the cluster folder" capitalize-first>
                <ion-icon name="folder-open"></ion-icon>
              </div>
              <div class="action btn btn-tertiary" reference-id="${clusterID}" button-id="${settingsBtnID}" data-mdb-ripple-color="dark" action="settings" data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="cluster settings" capitalize-first
                data-title="Cluster settings">
                <ion-icon name="cog"></ion-icon>
              </div>
              <div class="action btn btn-tertiary" reference-id="${clusterID}" button-id="${deleteBtnID}" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Delete cluster" data-mulang="delete cluster"
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
              <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${clusterID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Open the docker project folder"
                data-mulang="open the docker project folder" capitalize-first>
                <ion-icon name="folder-open"></ion-icon>
              </div>
              <div class="action btn btn-tertiary" reference-id="${clusterID}" button-id="${deleteBtnID}" data-mdb-ripple-color="dark" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Delete docker project"
                data-mulang="delete docker project" capitalize-first>
                <ion-icon name="trash"></ion-icon>
              </div>
            </div>
          </div>`
        }

        /**
         * Define the info's UI structure of the number of chosen nodes in the Docker project
         * By default, it's empty
         */
        let numOfNodesInfo = ''

        try {
          // If the current cluster is not a docker project then skip this try-catch block
          if (!isSandbox)
            throw 0

          // The number of chosen nodes' info UI structure
          numOfNodesInfo = `
          <div class="info" info="nodes">
            <div class="title">nodes
              <ion-icon name="right-arrow-filled"></ion-icon>
            </div>
            <div class="text">${cluster.nodes}</div>
            <div class="_placeholder" hidden></div>
          </div>`
        } catch (e) {}

        // Cluster UI element structure
        let element = `
            <div class="cluster" data-name="${cluster.name}" data-folder="${cluster.folder}" data-id="${clusterID}" data-workspace-id="${workspaceID}" data-host="${cluster.host}" data-connected="false" data-is-sandbox="${isSandbox}" data-workarea="false"
              ${secrets} ${credentials}>
              <div class="header">
                <div class="title">${cluster.name}</div>
                <div class="cluster-info">
                  <div class="info" info="host">
                    <div class="title">host
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
                  <div class="info" info="data-center">
                    <div class="title">data center
                      <ion-icon name="right-arrow-filled"></ion-icon>
                    </div>
                    <div class="text">${isSandbox ? 'datacenter1' : ''}</div>
                    <div class="_placeholder" ${isSandbox ? 'hidden' : '' }></div>
                  </div>
                  ${numOfNodesInfo}
                </div>
              </div>
              ${!isSandbox ? footerStructure.nonSandbox : footerStructure.sandbox}
              <div class="status">
                <lottie-player src="../assets/lottie/connection-status.json" background="transparent" autoplay loop speed="0.5"></lottie-player>
              </div>
              <div class="test-connection">
                <div class="sub-content">
                  <lottie-player src="../assets/lottie/test-connection.json" background="transparent" autoplay loop speed="1.2"></lottie-player>
                </div>
              </div>
            </div>`

        try {
          // If the current cluster won't be appended then skip this entire try-catch block
          if (!append)
            throw 0

          // Append the cluster to the associated container
          clustersContainer.append($(element).show(function() {
            // Apply different actions once the UI element is created
            {
              // Fade in the element based on the index
              setTimeout(() => $(this).addClass(`show-${currentIndex + 1}`))

              // Enable tooltip for the actions buttons
              setTimeout(() => {
                ([settingsBtnID, deleteBtnID, folderBtnID]).forEach((btn) => getElementMDBObject($(`div[button-id="${btn}"]`), 'Tooltip'))
              })

              // Apply the chosen language on the UI element after being fully loaded
              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))

              // Make sure the non-visible lottie element is not playing in the background
              setTimeout(() => autoPlayStopLottieElement($(this).find('lottie-player')))
            }

            // Point at the cluster's UI element
            let clusterElement = $(this)

            // Handle the `click` event for actions buttons
            setTimeout(() => {
              // Clicks the `TEST CONNECTION` button
              $(`button[button-id="${testConnectionBtnID}"]`).click(function() {
                // Determine if the app is already connected with that cluster, and if it has an active work area
                let [connected, hasWorkarea] = getAttributes(clusterElement, ['data-connected', 'data-workarea'])

                // Add log for this request
                addLog(`Request to test connection with cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

                // If the cluster has an active work area then stop the process and show feedback to the user
                if (hasWorkarea == 'true')
                  return showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('this cluster [b]$data[/b] has an active work area, make sure to close its work area before attempting to test connection with it', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

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

                  // Hide the Cassandra's version and the data center's name
                  clusterElement.find('div[info="cassandra"]')
                    .add(clusterElement.find('div[info="data-center"]')).each(function() {
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

                // Disable the button
                $(this).attr('disabled', 'disabled')

                // Test the connection with the cluster; by calling the inner test connection function at the very end of this code block
                testConnection(clusterElement)
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
                    // Get the number of currently attempt to connect with clusters
                    numAttemptingClusters = $(`div[content="clusters"] div.clusters-container div.cluster[data-id*="cluster-"].test-connection`).length

                  // Make sure the maximum number is valid, or adopt the default value `10`
                  maximumRunningClusters = isNaN(maximumRunningClusters) || maximumRunningClusters < 1 ? 10 : maximumRunningClusters

                  // Add log for this request
                  addLog(`Request to connect with cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

                  // If the currently running clusters are more than or equal to the maximum allowed number and this is not the sandbox workspace then end the process and show feedback to the user
                  if (([numRunningClusters, numAttemptingClusters]).some((num) => num >= maximumRunningClusters) && !isSandbox)
                    return showToast(I18next.capitalize(I18next.t('connect with cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('the maximum number of clusters which allowed to be connected to simultaneously is [b]$data[/b]', [maximumRunningClusters])) + `.<br><br>` + I18next.capitalizeFirstLetter(I18next.t('this limitation can be changed from the app\'s settings in the limitation section')) + `.`, 'failure')

                  // Point at the work areas content's container
                  let content = $('div.body div.right div.content div[content="workarea"]'),
                    // If this variable is `true` then show the cluster's work area and skip the creation of a new one
                    skipCreationWorkarea = false

                  // Hide all work areas
                  content.children('div.workarea').hide()

                  // Point at the cluster's work area
                  let contentCluster = content.children(`div.workarea[cluster-id="${clusterID}"]`)

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
                    // The cluster's metadata functions
                    copyMetadataBtnID,
                    refreshMetadataBtnID,
                    // CQLSH and Bash sessions, and their related elements
                    cqlshSessionContentID,
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
                    saveSnapshotBtnID,
                    loadSnapshotBtnID,
                    openSnapshotsFolderBtnID,
                    saveSnapshotSuffixContainerID,
                    changesLinesContainerID,
                    oldSnapshotNameID,
                    newMetadataTimeID,
                    // Restart and close the work area
                    restartWorkareaBtnID,
                    closeWorkareaBtnID
                  ] = getRandomID(20, 23)

                  /**
                   * Define tabs that shown only to sandbox projects
                   *
                   * Define the AxonOps tab's content, by default it's empty
                   */
                  let axonopsTab = '',
                    // Define the Bash Session tab's content, as AxonOps, it's empty by default
                    bashSessionTab = ''

                  try {
                    // If the current workspace is not the sandbox then skip this try-catch block
                    if (!isSandbox)
                      throw 0

                    // Define the content of the AxonOps tab to be added
                    axonopsTab = `
                    <li class="nav-item axonops-tab" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="AxonOps" capitalize data-title="AxonOps">
                      <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${axonOpsContentID}" role="tab" aria-selected="true">
                        <span class="icon">
                          <ion-icon name="axonops"></ion-icon>
                        </span>
                        <span class="title">AxonOps</span>
                      </a>
                    </li>`

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
                      <div class="workarea" cluster-id="${clusterID}">
                        <div class="sub-sides left">
                          <div class="cluster-info">
                            <div class="name-ssl ${isSandbox ? 'is-sandbox' : ''}">
                              <div class="name">${getAttributes(clusterElement, 'data-name')}</div>
                              <div class="status" data-tippy="tooltip" data-mdb-placement="left" data-mulang="analyzing status" capitalize-first data-title="Analyzing status">
                                <ion-icon name="unknown"></ion-icon>
                              </div>
                              <div class="axonops-agent" data-tippy="tooltip" data-mdb-placement="left" data-mulang="open AxonOps in browser" capitalize-first data-title="Open AxonOps in browser">
                                <ion-icon name="globe"></ion-icon>
                              </div>
                            </div>
                            <div class="additional">
                              <div class="info" info="host">
                                <div class="title">host
                                  <ion-icon name="right-arrow-filled"></ion-icon>
                                </div>
                                <div class="text">${getAttributes(clusterElement, 'data-host')}</div>
                              </div>
                              <div class="info" info="cassandra">
                                <div class="title">cassandra
                                  <ion-icon name="right-arrow-filled"></ion-icon>
                                </div>
                                <div class="text">v${getAttributes(clusterElement, 'data-cassandra-version')}</div>
                              </div>
                              <div class="info" info="data-center">
                                <div class="title">data center
                                  <ion-icon name="right-arrow-filled"></ion-icon>
                                </div>
                                <div class="text">${getAttributes(clusterElement, 'data-datacenter')}</div>
                              </div>
                            </div>
                          </div>
                          <div class="cluster-metadata loading">
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
                                <div class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Refresh metadata" data-mulang="refresh metadata" capitalize-first data-id="${refreshMetadataBtnID}">
                                  <ion-icon name="refresh"></ion-icon>
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
                                  <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${cqlDescriptionContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="cql-description"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="CQL description" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="query tracing" capitalize data-title="Query Tracing">
                                  <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${queryTracingContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="query-tracing"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="query tracing" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                <li class="nav-item" role="presentation" tab-tooltip data-tippy="tooltip" data-mdb-placement="bottom" data-mulang="cluster diff" capitalize data-title="Cluster Diff">
                                  <a class="nav-link btn btn-tertiary" data-mdb-ripple-color="dark" data-mdb-toggle="tab" href="#_${metadataDifferentiationContentID}" role="tab" aria-selected="true">
                                    <span class="icon">
                                      <ion-icon name="differentiation"></ion-icon>
                                    </span>
                                    <span class="title">
                                      <span mulang="cluster diff" capitalize></span>
                                    </span>
                                  </a>
                                </li>
                                ${axonopsTab}
                              </ul>
                            </div>
                            <div class="cluster-actions">
                              <div class="action" action="restart">
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
                              <div class="terminal-container" data-id="${terminalContainerID}"></div>
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
                                <div class="metadata-content old">
                                  <div class="editor-container-old"></div>
                                </div>
                                <div class="metadata-content new">
                                  <div class="editor-container-new"></div>
                                </div>
                                <span class="badge badge-secondary old"><span mulang="old" capitalize></span><span class="old-snapshot" data-id="${oldSnapshotNameID}"></span></span>
                                <div class="centered-badges">
                                  <span class="badge badge-primary btn btn-secondary btn-dark btn-sm changes" data-mdb-ripple-color="dark" data-changes="0" data-id="${showDifferentiationBtnID}"><span mulang="changes" capitalize></span>: <span>0</span></span>
                                  <div class="actions">
                                    <span class="refresh btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Refresh metadata" data-mulang="refresh metadata" capitalize-first
                                      data-id="${refreshDifferentiationBtnID}" ${isSandbox ? 'style=\"bottom:0px\"' : ''}>
                                      <ion-icon name="refresh"></ion-icon>
                                    </span>
                                    <span class="save-snapshot btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Save a snapshot" data-mulang="save a snapshot" capitalize-first
                                      data-id="${saveSnapshotBtnID}" ${isSandbox ? 'hidden' : ''}>
                                      <ion-icon name="save-floppy"></ion-icon>
                                    </span>
                                    <span class="load-snapshot btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Load a snapshot" data-mulang="load a snapshot" capitalize-first
                                      data-id="${loadSnapshotBtnID}" ${isSandbox ? 'hidden' : ''}>
                                      <ion-icon name="upload"></ion-icon>
                                    </span>
                                    <span class="snapshots-floder btn btn-secondary btn-dark btn-sm" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="top" data-title="Open the snapshots folder" data-mulang="open the snapshots folder" capitalize-first
                                      data-id="${openSnapshotsFolderBtnID}" ${isSandbox ? 'hidden' : ''}>
                                      <ion-icon name="folder-open-outline"></ion-icon>
                                    </span>
                                  </div>
                                </div>
                                <span class="badge badge-secondary new"><span mulang="new" capitalize></span><span class="new-metadata-time" data-id="${newMetadataTimeID}"></span></span>
                                <div class="save-snapshot-suffix" data-id="${saveSnapshotSuffixContainerID}" ${isSandbox ? 'hidden' : ''}>
                                  <div class="time"></div>
                                  <div class="form-outline form-white margin-bottom">
                                    <input type="text" class="form-control form-icon-trailing form-control-lg">
                                    <label class="form-label"><span mulang="snapshot suffix" capitalize></span> (<span mulang="optional" capitalize></span>)</label>
                                  </div>
                                  <button type="button" class="btn btn-primary btn-dark btn-sm changed-bg changed-color"><span mulang="save snapshot"></span></button>
                                </div>
                                <div class="changes-lines" data-id="${changesLinesContainerID}">
                                </div>
                              </div>
                            </div>
                            <div class="tab-pane fade" id="_${axonOpsContentID}" role="tabpanel"></div>
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
                      // Initialize the input fields
                      setTimeout(() => {
                        $(this).find('input[type="text"]').each(function() {
                          getElementMDBObject($(this), 'Input')
                        })
                      })

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

                      // Make sure the non-visible lottie element is not playing in the background
                      setTimeout(() => autoPlayStopLottieElement($(this).find('lottie-player')))
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
                      readLine, // Will handle the prompt, printing messages, and data
                      prefix = '', // Dynamic prefix/prompt; `cqlsh>`, `cqlsh:system>`, etc...
                      readLineTimeout = null, // For the delay before reading the user's inputs
                      pause = false, // To determine if there's a need to pause the print of received data temporarily
                      gotTracingSession = false, // To determine if there was a query tracing result that has been printed previously
                      cqlshLoaded = false, // To determine if the cqlsh tool has been loaded and ready to be used
                      gotMetadata = false, // To determine if the metadata will be fetched or not
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
                            }
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
                          try {
                            metadataDiffEditors[type].decorations = metadataDiffEditors[type].object.deltaDecorations([], highlights)
                          } catch (e) {}
                        })
                      })
                    }

                    /**
                     * Inner function to get the closest word to the cursor
                     * Used when the user presses the `TAB` key
                     *
                     * @Return: {string} the matched content, or an empty value if there's no string close to the cursor
                     */
                    let getClosestWord = () => {
                      /**
                       * If the user is currently selecting something then return an empty value
                       * The reason is by selecting something while the function is executing will lead to get incorrect values about the cursor's position
                       */
                      if (terminal.getSelection().length != 0)
                        return ''

                      // `Y` is the column - where the cursor is right now -
                      let cursorY = terminal._core.buffer.y,
                        // `X` is the row
                        cursorX = terminal._core.buffer.x,
                        // By using the position of the cursor in the `Y` axis the function will be able to get the line's content
                        line = terminal._core.buffer.lines.get(cursorY).translateToString(),
                        // Get the specific part of the line that matters; by slicing the line content from the beginning till the cursor's `X` position
                        lineContent = line.slice(0, cursorX)

                      // Do a matching process; which is getting the last string in the line that has a space right before it
                      let match = /\S+$/.exec(lineContent)

                      // If there's a value from the matching process then return it, otherwise return an empty value
                      return match ? match[0] : ''
                    }

                    /**
                     * Inner function to convert an array to a sorted string table
                     * Will be used to print suggestions in the terminal
                     *
                     * @Parameters:
                     * {object} `array` the array which will be converted to a sorted string table
                     *
                     * @Return: {string} the array's items converted to a string and well sorted
                     */
                    let arrayToString = (array) => {
                      try {
                        // Convert the given array to JSON string
                        array = JSON.stringify(array)

                        // Remove brackets from the beginning and the end
                        array = array.slice(1, -1)

                        // Remove all double quotes
                        array = array.replace(/\"/g, '')

                        // Replace commas with spaces
                        array = array.replace(/,/g, ' ')
                      } catch (e) {} finally {
                        // Return the `array` after manipulation
                        return array
                      }
                    }

                    // Create the terminal instance from the XtermJS constructor
                    terminal = new XTerm({
                      theme: XTermThemes.Atom
                    })

                    // Add log
                    addLog(`Created a CQLSH session for cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`)

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
                         * Read line addon; which handles the prompt and reads the user's inputs
                         */
                        readLine = new Readline(),
                          // Fit addon; to resize the terminal without distortion
                          fitAddon = new FitAddon.FitAddon()

                        /**
                         * Load XtermJS addons
                         *
                         * Load the `Read line` addon
                         */
                        terminal.loadAddon(readLine)

                        // Load the `Fit` addon
                        terminal.loadAddon(fitAddon)

                        /**
                         * Load the `Web links` addon; which helps to interact with links in the terminal
                         * Clicking the link is handled within the inner function `clickEvent`
                         * URL regex has changed to match `session://`; so user can open sessions tabs from terminal
                         */
                        setTimeout(() => {
                          terminal.loadAddon(new WebLinksAddon(clickEvent, {
                            urlRegex: /session?:[/]{2}[^\s"'!*(){}|\\\^<>`]*[^\s"':,.!?{}|\\\^~\[\]`()<>]/
                          }))
                        })

                        /**
                         * Inner function to handle the `click` event of a session's link in the terminal
                         *
                         * @Parameters:
                         * {string} `link` the link's content
                         */
                        let clickEvent = (_, link) => {
                          // Get the session ID from the link - by slicing the protocol `session://`
                          let sessionID = link.slice(10)

                          // Request to get query tracing result by passing the cluster's and the session's IDs
                          Modules.Clusters.getQueryTracingResult(clusterID, sessionID, (result) => {
                            // If the `result` value is `null` then the app wasn't able to get the query tracing result
                            if (result == null)
                              return showToast(I18next.capitalize(I18next.t('query tracing')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to get the query tracing result for the session [b]$data[/b]', [sessionID])) + '.', 'failure')

                            // Point at the queries' container
                            let queriesContainer = $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).find('div.queries'),
                              // Point at the queries' tab
                              queryTracingTab = $(`a.nav-link.btn[href="#_${queryTracingContentID}"]`),
                              // Get the queries' tab MDB object
                              queryTracingTabObject = getElementMDBObject(queryTracingTab, 'Tab'),
                              // Get random IDs for the different elements of the query tracing section
                              [
                                canvasTimelineID,
                                canvasPieChartID,
                                tableBodyID
                              ] = getRandomID(20, 3),
                              // Generate random color for each activity in the query tracing's result
                              colors = getRandomColor(result.length).map((color) => invertColor(color))

                            // Remove the `empty` class; in order to show the query tracing's content
                            $(`div.tab-pane[tab="query-tracing"]#_${queryTracingContentID}`).removeClass('_empty')

                            // If the clicked session exists in the query tracing's container
                            if (queriesContainer.children(`div.query[data-session-id="${sessionID}"]`).length != 0) {
                              // Just add the session ID in the search input and it'll handle the rest
                              $(`input#_${queryTracingSearchInputID}`).val(sessionID)

                              // Go to the query tracing's tab
                              queryTracingTabObject.show()

                              // Skip the upcoming code
                              return
                            }

                            // The query tracing's result UI structure
                            let element = `
                                <div class="query" data-session-id="${sessionID}">
                                  <span class="badge rounded-pill badge-secondary">#${sessionID}</span>
                                  <div class="info-left">
                                    <div class="left-chart"><canvas data-canvas-id="${canvasTimelineID}" width="100%"></canvas></div>
                                    <div class="right-chart"><canvas data-canvas-id="${canvasPieChartID}" width="100%"></canvas></div>
                                  </div>
                                  <div class="info-right">
                                    <table class="table table-bordered">
                                      <thead>
                                        <tr>
                                          <th scope="col"><span mulang="activity" capitalize></span></th>
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
                              } catch (e) {}

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
                              } catch (e) {}

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

                        // Work with read line addon
                        readLine.setCheckHandler((text) => text.trimEnd().endsWith('&&') ? false : true)

                        /**
                         * Inner function to catch any new given line from the user
                         *
                         * @Parameters:
                         * {string} `_prefix` the terminal's prefix - the prompt -
                         */
                        let readActiveLine = (_prefix) => {
                          readLine.read(_prefix).then((text) => {
                            // Check if some commands have been sent to be executed
                            let foundQuit = (['quit', 'exit']).some((command) => text.toLowerCase().startsWith(command))

                            try {
                              /**
                               * `quit` or `exit` command will close the connection
                               * If none of them were found then skip this try-catch block
                               */
                              if (!foundQuit)
                                throw 0

                              // Show feedback to the user
                              terminalPrintMessage(readLine, 'info', `Work area for the cluster ${getAttributes(clusterElement, 'data-name')} will be closed in few seconds`)

                              // Pause the print of output from the Pty instance
                              pause = true

                              // Dispose the readline addon
                              prefix = ''

                              // Click the close connection button after a while
                              setTimeout(() => workareaElement.find('div.cluster-actions div.action[action="close"] div.btn-container div.btn').click(), 2000)
                            } catch (e) {}

                            // Send the command to the main thread to be executed
                            IPCRenderer.send('pty:command', {
                              id: clusterID,
                              cmd: text
                            })

                            // Update the latest executed command
                            latestCommand = text
                          })
                        }

                        // Call the inner function - at the very end of this code block -; to create a pty instance for that cluster
                        requestPtyInstanceCreation(readLine)

                        // Call the fit addon for the terminal
                        setTimeout(() => fitAddon.fit(), 1200)

                        // Listen to data sent from the pty instance which are fetched from the cqlsh tool
                        IPCRenderer.on(`pty:data:${clusterID}`, (_, data) => {
                          /**
                           * Check if the received data contains the `tracing session` keyword
                           * Based on the check, pause printing data and print the custom session's navigation link
                           */
                          try {
                            // Match the regular expression and get the session's ID
                            sessionID = (new RegExp('tracing\\s*session\\s*:\\s*(.+)', 'gm')).exec(data.toLowerCase())[1]

                            // Print the custom session's navigation link
                            setTimeout(() => readLine.println('\x1b[38;2;' + `234;255;18` + 'm' + `Tracing session: session://${sessionID}` + '\033[0m'), 50)

                            // Pause printing data
                            pause = true

                            // Update the associated flag
                            gotTracingSession = true

                            // Skip the upcoming code
                            return

                            // This try-catch block will throw an exception if it didn't find a `tracing session` keyword
                          } catch (e) {}

                          // Check if `CQLSH-STARTED` has been received
                          try {
                            // If the keywords haven't been received yet or cqlsh has already been loaded then skip this try-catch block
                            if (!minifyText(data).search('cqlsh-started') || cqlshLoaded)
                              throw 0

                            // The CQLSH tool has been loaded
                            cqlshLoaded = true

                            /**
                             * Attempt to recall the process again
                             * This method helps with the hang that happen sometimes while booting the cqlsh session
                             */
                            setTimeout(() => IPCRenderer.send('pty:command', {
                              id: clusterID,
                              cmd: '\n'
                            }), 500)

                            // Remove the loading class
                            $(`div.tab-pane[tab="cqlsh-session"]#_${cqlshSessionContentID}`).removeClass('loading')

                            setTimeout(() => {
                              // Start reading the user input
                              readActiveLine(prefix)

                              // For Windows, there's a need to send a newline to start the cqlsh session
                              if (OS.platform() == 'win32')
                                setTimeout(() => {
                                  IPCRenderer.send('pty:command', {
                                    id: clusterID,
                                    cmd: '\n'
                                  })
                                }, 500)
                            }, 1000)
                          } catch (e) {}

                          /**
                           * Check if the received data contains one or more of the strings in the array, or if `pause` is set to `true`
                           * Or the command is empty and the OS is Windows
                           * Based on the check, the received data won't be printed
                           */
                          if (minifyText(data).search('cqlsh-started') || ['cqlsh-', 'cqlsh.py', 'main/bin', 'main\bin', 'code page:', '--var', '--test', '--workspace', '--username', '--password', 'cqlshrc location', 'print metadata', 'instead.'].some((str) => minifyText(data).search(str) || pause) || (`${latestCommand}`.trim().length <= 0 && OS.platform() == 'win32')) {
                            /**
                             * If `pause` is set to `true` and the cqlsh's prompt is got in the received data...
                             * then the cause of the pause has ended, thus, end the pause and start to print data again
                             */
                            if (((new RegExp('cqlsh\s*(\:|\s*)(.+|\s*)\>')).exec(data) != null && pause) || cqlshLoaded || minifyText(data).search('cqlsh-started')) {
                              // Reset the pause state
                              pause = false

                              setTimeout(() => {
                                // Update readline addon
                                readActiveLine(prefix)

                                // Update the query tracing flag to be false in all cases
                                gotTracingSession = false
                              }, gotTracingSession ? 250 : 4)
                            }

                            // Skip the upcoming code
                            return
                          }

                          try {
                            // If the received data is `failed` then the connection attempt has failed and the user needs to retry
                            if (data != 'failed')
                              throw 0

                            // Show feedback to the user
                            terminalPrintMessage(readLine, 'error', 'The connection attempt failed, please check cqlsh.rc file and press the restart button')

                            // Skip the upcoming code
                            return
                          } catch (e) {}

                          /**
                           * Inner function to check if the metadata has been fetched or not
                           * The declaration was at the very beginning of this code block
                           */
                          checkMetadata = (refresh = false) => {
                            try {
                              // Update `gotMetadata` to `true`; so no need to get it again till the user asks to
                              gotMetadata = true

                              // Inner function to create either the old or new editor
                              let createEditor = (type, metadata) => {
                                // Create the editor
                                let editor = monaco.editor.create($(`div.tab-pane[tab="metadata-differentiation"]#_${metadataDifferentiationContentID}`).find(`div.editor-container-${type}`)[0], {
                                  value: applyJSONBeautify(metadata, true),
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
                                  fontSize: 11
                                })

                                // Update its layout
                                setTimeout(() => editor.layout(), 200)

                                /**
                                 * Create a resize observer for the work area body element
                                 * By doing this the editor's dimensions will always fit with the dialog's dimensions
                                 */
                                setTimeout(() => {
                                  (new ResizeObserver(() => {
                                    try {
                                      editor.layout()
                                    } catch (e) {}
                                  })).observe(workareaElement[0])
                                })

                                // Return the editor's object
                                return editor
                              }

                              // Get the cluster's metadata
                              Modules.Clusters.getMetadata(clusterID, (metadata) => {
                                try {
                                  // If this is not a refresh then update the terminal reading addon
                                  if (!refresh)
                                    readActiveLine(prefix)

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

                                  jsTreeObject.disableSelection()

                                  /**
                                   * Create a listener to the event `contextmenu`
                                   * This event `contextmenu` is customized for the JSTree plugin
                                   */
                                  jsTreeObject.on('contextmenu', function(event) {
                                    // Remove the default contextmenu created by the plugin
                                    $('.vakata-context').remove()

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

                                    let [
                                      // Get the target's node name in Cassandra
                                      targetName,
                                      // Get the target's keyspace's name - if it's a table -
                                      keyspaceName,
                                      // Get the target's type - cluster, keyspace or table -
                                      nodeType
                                    ] = getAttributes(clickedNode, ['name', 'keyspace', 'type'])

                                    // Define the scope to be passed with the request
                                    scope = `keyspace>${nodeType == 'keyspace' ? targetName : keyspaceName}${nodeType != 'keyspace' ? 'table>' + targetName : ''}`

                                    // If the node type is cluster then only `cluster` is needed as a scope
                                    if (nodeType == 'cluster')
                                      scope = 'cluster'

                                    // Send a request to the main thread regards pop-up a menu
                                    IPCRenderer.send('show-context-menu', JSON.stringify([{
                                      label: 'Get CQL Description',
                                      click: `() => mainView.webContents.send('cql-desc:get', {
                                        clusterID: '${getAttributes(clusterElement, 'data-id')}',
                                        scope: '${scope}',
                                        tabID: '${cqlDescriptionContentID}'
                                      })`
                                    }]))
                                  })

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

                                          // The old side's badge will be updated with the snapshot name
                                          $(`span.old-snapshot[data-id="${oldSnapshotNameID}"]`).text(`: ${snapshot.name}`)

                                          // The new side's badge will be updated with fetched time of the latest metadata
                                          $(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)
                                        } catch (e) {}

                                        // Create an editor for the old metadata content
                                        metadataDiffEditors.old.object = createEditor('old', toBeLoadedMetadata)

                                        // Detect differentiation between old and new content
                                        detectDifferentiationShow(toBeLoadedMetadata, metadata)
                                      })

                                      // Create an editor for the new metadata content
                                      metadataDiffEditors.new.object = createEditor('new', metadata)
                                    })
                                  } catch (e) {}

                                  // Hide the loading indicator in the tree view section
                                  setTimeout(() => metadataContent.parent().removeClass('loading'), 150)
                                } catch (e) {}
                              })
                            } catch (e) {}
                          }
                          // End of the check metadata function

                          // Determine whether or not the metadata function will be called
                          try {
                            // If the cqlsh prompt hasn't been found in the received data or cqlsh is not loaded yet then the work area isn't ready to get metadata
                            if ((new RegExp('cqlsh\s*(\:|\s*)(.+|\s*)\>')).exec(data) == null || !cqlshLoaded)
                              throw 0

                            // If metadata hasn't been got yet
                            if (!gotMetadata) {
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
                          let prompt = data.match(/^(.*?cqlsh.*?>)/gm),
                            // Update the active prefix to be used
                            activePrefix = prefix

                          // Remove the prompt from the output before printing it in the terminal; because that prompt will be prepended, and the ability to remove it or interact with it will be disabled
                          if (minifyText(data).search('cqlsh>'))
                            data = data.replace(/^(.*?cqlsh.*?>)/gm, '')

                          // Determine whether to print the given data or not
                          try {
                            // If empty data has been received then ignore it
                            if (data.trim().length <= 0)
                              throw 0

                            // Check if the query tracing feature has been enabled/disabled
                            {
                              // Point at the hint UI element in the query tracing's tab
                              let queryTracingHint = $(`div.tab-pane#_${queryTracingContentID}`).find('hint')

                              // If it has been enabled
                              if (data.toLowerCase().indexOf('tracing is enabled') != -1) {
                                terminalPrintMessage(readLine, 'info', 'Query tracing feature is now enabled')
                                queryTracingHint.hide()
                                throw 0
                              }

                              // If it has been disabled
                              if (data.toLowerCase().indexOf('disabled tracing') != -1) {
                                terminalPrintMessage(readLine, 'info', 'Query tracing feature has been disabled')
                                queryTracingHint.show()
                                throw 0
                              }
                            }

                            // Print the data
                            readLine.write(data)

                            // Resize the terminal
                            fitAddon.fit()
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

                          try {
                            // If it is `null` then skip this try-catch block
                            if (readLineTimeout == null)
                              throw 0

                            // Clear the read line function timeout call
                            clearTimeout(readLineTimeout)
                          } catch (e) {}

                          // Set the read line timeout again
                          readLineTimeout = setTimeout(() => readActiveLine(activePrefix), 10)
                        })
                        // The listener to data sent from the pty instance has been finished

                        /**
                         * Listen to data from the user - input to the terminal -
                         * What is being listened to is mainly the keypresses like `TAB`
                         */
                        let terminalViewport = $(`div.terminal-container[data-id="${terminalContainerID}"]`).find('div.xterm-viewport')[0]
                        terminal.onData((char) => {
                          // Get the key code
                          let keyCode = char.charCodeAt(0)

                          // Switch between the key code's values
                          switch (keyCode) {
                            // `TAB`
                            case 9: {
                              // Attempt to get the closest word to the cursor
                              let closestWord = StripChar.RSExceptUnsAlpNum(getClosestWord())

                              // If we didn't get a word then stop this process
                              if (closestWord == false || closestWord.trim().length <= 0)
                                return

                              // Get suitable suggestions
                              let suggestions = suggestionSearch(closestWord, Modules.Consts.CQLKeywords)

                              try {
                                // If we've got more than one suggestion then continue in this try-catch block
                                if (suggestions.length <= 1 || typeof suggestions === 'string')
                                  throw 0

                                // Move the cursor to the next line
                                let currentLine = readLine.state.line.buf

                                // Make a new line in the terminal
                                readLine.print('\n')

                                // Print suggestions in an info box
                                terminalPrintMessage(readLine, 'info', arrayToString(suggestions), true)

                                // Refresh the terminal
                                readActiveLine(prefix)

                                // Update the last line; to see suggestions
                                setTimeout(() => readLine.state.update(currentLine))

                                // Skip the upcoming code
                                return
                              } catch (e) {}

                              /**
                               * Reaching here means we've got one suggestion
                               *
                               * Make sure it is valid, if it's not then end this process
                               */
                              if (suggestions[0] == undefined && typeof suggestions !== 'string')
                                return

                              // Wrap the suggestion in the `suggestion` variable
                              let suggestion = (typeof suggestions === 'object') ? suggestions[0] : suggestions

                              /**
                               * Replace the closest word in the terminal with that suggestion and move the cursor in the right way to the end of the line
                               *
                               * Get the line's buffer/content - without the prompt -
                               */
                              let line = readLine.state.line.buf,
                                // Make a copy of the line's content
                                updatedLine = line.slice(0, readLine.state.line.pos),
                                // Get the closest word in the line's content
                                regex = new RegExp(`${closestWord}(?!.*${closestWord})`, 'gm')

                              // Replace the word with the suggestion
                              updatedLine = updatedLine.replace(regex, suggestion)

                              // Slice the line's content and get everything after the closest word to the cursor
                              line = line.slice(readLine.state.line.pos)

                              // Combine the updated content with what is after the closest word
                              line = `${updatedLine}${line}`

                              // Calculate the updated position of the cursor based on the updated line's content
                              let updatedPosition = readLine.state.line.pos + Math.abs(closestWord.length - suggestion.length)
                              updatedPosition = line.length - updatedPosition

                              // Update the line's content
                              readLine.state.update(line)

                              // If the updated position is not the beginning of the line then move the cursor to it
                              if (updatedPosition > 0)
                                readLine.state.moveCursorBack(updatedPosition)

                              // End of `TAB` key press case
                              break
                            }

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

                        /**
                         * Listen to `keydown` event in the terminal's container
                         * The main reason is to provide the ability to increase/decrease and reset the terminal's font size
                         * Custom event `changefont` has been added, it will be triggered when the app's zooming level is changing
                         */
                        setTimeout(() => {
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
                        }, 1000)
                      })
                    } catch (e) {}
                    // End of handling the app's terminal

                    // Handle the bash session only if the cluster is a sandbox project
                    try {
                      if (!isSandbox)
                        throw 0

                      // Put the code inside curly brackets to reduce its scope and make sure to not affect the rest of the code
                      {
                        // Define global variables to be used in this code block
                        let terminalBash, // The XTermJS object for Bash
                          readLineBash, // Will handle the prompt, printing messages, and data
                          fitAddonBash, // Used for resizing the terminal and making it responsive
                          bashLoaded = false, // Whether or not the pty instance has been loaded - for easier reference it's called a Bash instance -
                          printData = false, // Whether or not the data coming from the pty instances should be printed or not
                          latestCommand = '', // Store the user's input to create a command
                          sessionID = getRandomID(5) // Get a random ID as a suffix to the sandbox project's ID

                        // Create the terminal instance from the XtermJS constructor
                        terminalBash = new XTerm({
                          theme: XTermThemes.Atom
                        })

                        // Add log
                        addLog(`Created a bash session for sandbox project ${getAttributes(clusterElement, ['data-id'])}.`)

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
                            path: Path.join(__dirname, '..', '..', 'data', 'docker', clusterID)
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
                    } catch (e) {}

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
                          } catch (e) {}

                          // Give feedback to the user
                          showToast(I18next.capitalize(I18next.t('copy metadata')), I18next.capitalizeFirstLetter(I18next.replaceData('metadata for the cluster [b]$data[/b] has been copied to the clipboard, the size is $data', [getAttributes(clusterElement, 'data-name'), metadataSize])) + '.', 'success')
                        })

                        // Refresh the tree view
                        $(`div.btn[data-id="${refreshMetadataBtnID}"]`).click(function() {
                          // If the `checkMetadata` function is not yet implemented then skip the upcoming code
                          if (checkMetadata == null)
                            return

                          // If there's a tree object already then attempt to destroy it
                          if (jsTreeObject != null)
                            try {
                              $.jstree.destroy(jsTreeObject)
                            } catch (e) {}

                          // Add log about this refreshing process
                          addLog(`Request to refresh metadata of cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

                          // Reset the metadata trigger
                          gotMetadata = false

                          // Show the loading of the tree view
                          $(this).parent().parent().parent().addClass('loading')

                          // Check metadata with `refresh` = `true`
                          checkMetadata(true)
                        })
                      })

                      // Metadata differentiation section
                      setTimeout(() => {
                        // Point at the snapshot's suffix name container
                        let suffixContainer = $(`div.save-snapshot-suffix[data-id="${saveSnapshotSuffixContainerID}"]`),
                          // Point at the time element; where the snapshot's time will be printed to the user
                          timeElement = suffixContainer.children('div.time'),
                          // Point at the save snapshot button
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
                            return showToast(I18next.capitalize(I18next.t('show differentiation')), I18next.capitalizeFirstLetter(I18next.t('there is no difference between the old and new metadata')) + '.', 'warning')

                          // Show/hide the changes container
                          $(`div.changes-lines[data-id="${changesLinesContainerID}"]`).toggleClass('show')
                        })

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
                              detectDifferentiationShow(JSON.parse(metadataDiffEditors.old.object.getValue()), metadata)

                              // Beautify the received metadata
                              metadata = applyJSONBeautify(metadata, true)

                              // Update the fetch date and time of the new metadata
                              $(`span.new-metadata-time[data-id="${newMetadataTimeID}"]`).text(`: ${formatTimestamp(new Date().getTime())}`)

                              // Update the new editor's value
                              metadataDiffEditors.new.object.setValue(metadata)

                              // Enable the button again
                              $(this).removeAttr('disabled').removeClass('disabled refreshing')
                            } catch (e) {}
                          })
                        })

                        // Clicks the button to open the save snapshot pop-up container
                        $(`span.btn[data-id="${saveSnapshotBtnID}"]`).click(function() {
                          // Reset the suffix value
                          suffixInput.val('')
                          suffixInputObject.update()
                          suffixInputObject._deactivate()

                          // Get the current date and time, format it, and show it to the user
                          let time = new Date().getTime()
                          timeFormatted = formatTimestamp(time, true).replace(/\:/gm, '_')
                          timeElement.text(`${timeFormatted}`)

                          // Show the save snapshot container
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

                        // Clicks the `SAVE SNAPSHOT` button
                        saveSnapshotBtn.click(function() {
                          // Get the suffix's value
                          let suffix = suffixInput.val(),
                            // Get the new metadata content
                            metadata = metadataDiffEditors.new.object.getValue(),
                            // Get the workspace's folder path
                            workspaceFolderPath = getWorkspaceFolderPath(workspaceID, true),
                            // The snapshot's initial name is the fetched time of the new metadata
                            snapshotName = `${timeFormatted}`

                          // Add log a about the request
                          addLog(`Request to save a snapshot of metadata of cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

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
                              return showToast(I18next.capitalize(I18next.t('save snapshot')), I18next.capitalizeFirstLetter(I18next.t('failed to save snapshot, please make sure the app has write permissions and try again')) + '.', 'failure')

                            // Show success feedback to the user
                            showToast(I18next.capitalize(I18next.t('save snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot has been successfully saved with name [b]$data[/b]', [snapshotName])) + '.', 'success')
                          })
                        })

                        // Load a saved snapshot
                        $(`span.btn[data-id="${loadSnapshotBtnID}"]`).click(function() {
                          // Get all saved snapshots of the cluster
                          Modules.Clusters.getSnapshots(Path.join(getWorkspaceFolderPath(workspaceID), getAttributes(clusterElement, 'data-folder')), (snapshots) => {
                            // If there are no saved snapshots then show feedback to the user and skip the upcoming code
                            if (snapshots.length <= 0)
                              return showToast(I18next.capitalize(I18next.t('load snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('there are no saved snapshots for the cluster [b]$data[/b], attempt first to save one', [getAttributes(clusterElement, 'data-name')])) + '.', 'warning')

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

                                // Clicks the loading button - to load snapshot in the old side -
                                $(this).find('a[action="load"]').click(async function() {
                                  try {
                                    // Add log about this loading process
                                    addLog(`Request to load a snapshot in path ${snapshotPath} of metadata of cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

                                    // Read the snapshot's content
                                    let snapshotContent = await FS.readFileSync(snapshotPath, 'utf8')

                                    // Convert it from JSON string to object
                                    snapshotContent = JSON.parse(snapshotContent)

                                    // Update the old editor's value
                                    metadataDiffEditors.old.object.setValue(applyJSONBeautify(snapshotContent, true))

                                    // Update the old side's badge
                                    $(`span.old-snapshot[data-id="${oldSnapshotNameID}"]`).text(`: ${snapshot.attr('data-name')}`)

                                    // Detect differentiation between the metadata content's after loading the snapshot
                                    detectDifferentiationShow(snapshotContent, JSON.parse(metadataDiffEditors.new.object.getValue()))

                                    // Show success feedback to the user
                                    showToast(I18next.capitalize(I18next.t('load snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot [b]$data[/b] has been successfully loaded', [snapshot.attr('data-name')])) + '.', 'success')

                                    // Close the modal/dialog
                                    $('div.modal#loadSnapshot').find('button.btn-close').click()
                                  } catch (e) {
                                    // If any error has occurred then show feedback to the user about the failure
                                    showToast(I18next.capitalize(I18next.t('load snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to load the snapshot [b]$data[/b], make sure the file exists and it is a valid [code]JSON[/code]', [snapshot.attr('data-name')])) + '.', 'failure')
                                  }
                                })

                                // Delete a snapshot
                                $(this).find('a[action="delete"]').on('click', function(e, noConfirm = false) {
                                  // Inner function to delete a snapshot
                                  let deleteSnapshot = () => {
                                    // Remove the snapshot file
                                    FS.remove(snapshotPath, (err) => {
                                      // If any error has occurred then show feedback to the user and skip the upcoming code
                                      if (err)
                                        return showToast(I18next.capitalize(I18next.t('delete snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to delete the snapshot [b]$data[/b], it may be already deleted or there is no permission granted to delete it', [snapshotName])) + '.', 'failure')

                                      // Show success feedback to the user
                                      showToast(I18next.capitalize(I18next.t('delete snapshot')), I18next.capitalizeFirstLetter(I18next.replaceData('the snapshot [b]$data[/b] has been successfully deleted', [snapshotName])) + '.', 'success')

                                      // Remove the snapshot UI element in the container
                                      snapshot.remove()

                                      // If no saved snapshots left then close the modal/dialog
                                      if (snapshotsContainer.children('div.snapshot').length <= 0)
                                        $('#showLoadSnapshotDialog').click()
                                    })
                                  }

                                  // Add log about this deletion process
                                  addLog(`Request to delete a snapshot in path ${snapshotPath} of metadata of cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

                                  // If no need for confirmation then call the deletion function and skip the upcoming code
                                  if (noConfirm)
                                    return deleteSnapshot()

                                  // Open the confirmation dialog and wait for the response
                                  openDialog(I18next.capitalizeFirstLetter(I18next.replaceData('do you want to delete the snapshot [b]$data[/b]? once you confirm, there is no undo', [snapshotName])), (response) => {
                                    // If canceled, or not confirmed then skip the upcoming code
                                    if (!response)
                                      return

                                    // Call the deletion function
                                    deleteSnapshot()
                                  }, true)
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
                        $(`div.btn[data-id="${restartWorkareaBtnID}"]`).add(`div.btn[data-id="${closeWorkareaBtnID}"]`).click(function() {
                          // Add log for this action
                          addLog(`Request to close/refresh workarea of cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

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
                            if (!isSandbox || !$(this).is($(`div.btn[data-id="${closeWorkareaBtnID}"]`)))
                              throw 0

                            // Show the test connection state - it's used here to indicate the closing process of a sandbox project -
                            clusterElement.addClass('test-connection')

                            // Disable all buttons inside the sandbox project's element in the clusters/sandbox projects container
                            clusterElement.find('button').attr('disabled', '')

                            /**
                             * Create a pinned toast to show the output of the process
                             *
                             * Get a random ID for the toast
                             */
                            let pinnedToastID = getRandomID(10)

                            // Show/create that toast
                            showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('stop docker containers')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                            // Attempt to close/stop the docker project
                            Modules.Docker.getDockerInstance(clusterElement).stopDockerCompose(pinnedToastID, (feedback) => {
                              /**
                               * Failed to close/stop the project
                               * Show feedback to the user and skip the upcoming code
                               */
                              if (!feedback.status)
                                return showToast(I18next.capitalize(I18next.t('stop docker containers')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the docker project [b]$data[/b] were not successfully stopped', [getAttributes(clusterElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                              /**
                               * Successfully closed/stopped
                               * Show feedback to the user
                               */
                              showToast(I18next.capitalize(I18next.t('stop docker containers')), I18next.capitalizeFirstLetter(I18next.replaceData('containers of the docker project [b]$data[/b] have been successfully stopped', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                              // Reset the sandbox project's element in the clusters/sandbox projects container
                              clusterElement.removeClass('test-connection')
                              clusterElement.find('button').removeAttr('disabled')
                              clusterElement.children('div.status').removeClass('show success')
                            })

                            // Show the initial feedback to the user which
                            showToast(I18next.capitalize(I18next.t('close docker project work area')), I18next.capitalizeFirstLetter(I18next.replaceData('the work area of the docker project [b]$data[/b] has been successfully closed, attempting to stop the docker containers', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                            // Reset the button's text
                            setTimeout(() => $(`button[button-id="${startProjectBtnID}"]`).children('span').attr('mulang', 'start').text(I18next.t('start')))
                          } catch (e) {}

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
                              if (!$(this).is($(`div.btn[data-id="${restartWorkareaBtnID}"]`)))
                                throw 0

                              // Remove the work area element
                              workarea.remove()

                              // Click the button to connect with the cluster again
                              $(`button[button-id="${connectBtnID}"]`).trigger('click', true)

                              setTimeout(() => {
                                try {
                                  let axonopsURL = `http://localhost:${getAttributes(clusterElement, 'data-port-axonops')}`
                                  $(`div.tab-pane#_${axonOpsContentID}`).append($(`<webview src="${axonopsURL}" nodeIntegrationInSubFrames nodeintegration></webview>`))

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
                                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('post-connection scripts are being executed after closing the connection with cluster [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(clusterElement, 'data-name')])) + '.'), 50)

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
                                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts with cluster [b]$data[/b]', [I18next.t('post'), getAttributes(clusterElement, 'data-name')]))}${executionFeedback}`, 'failure'), 50)
                                  } catch (e) {
                                    // Show success feedback to the user if the error is `0` code
                                    if (e == 0)
                                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts with cluster [b]$data[/b] have been successfully executed', [I18next.t('post'), getAttributes(clusterElement, 'data-name')])) + '.', 'success'), 50)
                                  }
                                })
                              } catch (e) {}
                            })

                            // Clicks the `ENTER` button for the cluster's workspace
                            $(`div.workspaces-container div.workspace[data-id="${getAttributes(clusterElement, 'data-workspace-id')}"]`).find('div.button button').click()

                            // Reset the button's text
                            setTimeout(() => $(`button[button-id="${connectBtnID}"]`).children('span').attr('mulang', 'connect').text(I18next.t('connect')))

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
                          } catch (e) {}

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
                                addLog(`Switch to the cluster ${getAttributes(clusterElement, ['data-name', 'data-id'])} work area.`, 'action')

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
                              })
                            })

                            // Handle the first switcher's margin
                            setTimeout(() => handleClusterSwitcherMargin())
                          }))
                        }, 200)
                      })
                    } catch (e) {}

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

                            // Get the minimum width allowed to be reached for the right side before hiding the tabs' titles
                            let minimumAllowedWidth = !isSandbox ? 867 : 1215,
                              // Decide whether or not the tabs' titles should be shown
                              showTabsTitles = rightSide.outerWidth() > minimumAllowedWidth,
                              // Get all tabs' tooltips in the work area
                              workareaTooltipElements = [...workareaElement.find('[tab-tooltip]')],
                              // Get tooltips' objects of the tabs' tooltips
                              workareaTooltipObjects = allMDBObjects.filter((mdbObject) => workareaTooltipElements.some((elem) => mdbObject.element.is(elem)))

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
                  }))
                })
              })
              // End the process when we attempt to connect with a cluster by clicking the `CONNECT` button

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
                    addLog(`Request to start a sandbox project ${getAttributes(clusterElement, ['data-id'])}.`, 'action')

                    // Manipulate the maximum number, set it to the default value `1` if needed
                    maximumRunningSandbox = isNaN(maximumRunningSandbox) || maximumRunningSandbox < 1 ? 1 : maximumRunningSandbox

                    // If the currently running projects are more than or equal to the maximum allowed number then end the process and show feedback to the user
                    if (([numRunningSandbox, numAttemptingSandbox]).some((num) => num >= maximumRunningSandbox))
                      return showToast(I18next.capitalize(I18next.t('start docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('the maximum number of sandbox projects which allowed to be started simultaneously is [b]$data[/b]', [maximumRunningSandbox])) + `.<br><br>` + I18next.capitalizeFirstLetter(I18next.t('this limitation can be changed from the app\'s settings in the limitation section')) + `.`, 'failure')

                    // Inner function to execute the post-start code
                    let startPostProcess = (success = false) => {
                      // Enable the `START` button again
                      $(this).removeAttr('disabled')

                      // Remove the starting - test connection - state
                      clusterElement.removeClass('test-connection')

                      // Remove any indicators about the state of start/connecting
                      clusterElement.children('div.status').removeClass('show success failure')

                      // If the start process failed then skip the upcoming code
                      if (!success)
                        return

                      // Add success state
                      clusterElement.children('div.status').addClass('show success')
                    }

                    // Disable the button
                    $(this).attr('disabled', '')

                    // Add a starting class
                    clusterElement.addClass('test-connection')

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

                        // Set Cassandra's version
                        clusterElement.attr('data-cassandra-version', currentProject[0].cassandraVersion)
                      } catch (e) {}

                      // A time out function which triggers if Docker seems to be downloading files related to the project
                      let installationInfo = setTimeout(() => showToast(I18next.capitalize(I18next.t('start docker project')), I18next.capitalizeFirstLetter(I18next.t('docker is seems to be downloading necessary images and related files, this is a once time process and might take up to 10 minutes depending on the internet connection')) + '.'), 90000) // After 1 minute and 30 seconds

                      /**
                       * Create a pinned toast to show the output of the process
                       *
                       * Get a random ID for the toast
                       */
                      let pinnedToastID = getRandomID(10)

                      // Show/create that toast
                      showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('start docker containers')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

                      // Check the existence of Docker in the machine
                      Modules.Docker.checkDockerCompose((dockerExists, userGroup) => {
                        // If Docker doesn't exist then show feedback to the user and skip the upcoming code
                        if (!dockerExists) {
                          showToast(I18next.capitalize(I18next.t('create docker project')), I18next.capitalizeFirstLetter(I18next.t('sandbox feature requires [code]docker[/code] and its [code]docker-compose[/code] tool to be installed, please make sure it\'s installed and accessible before attempting to create a docker project')) + '.', 'failure')

                          startPostProcess()

                          return
                        }

                        // If the current user is not in the `docker` group
                        if (!userGroup) {
                          showToast(I18next.capitalize(I18next.t('create docker project')), I18next.capitalizeFirstLetter(I18next.t('sandbox feature requires the current user to be in the [code]docker[/code] group in [b]Linux[/b], please make sure this requirement is met then try again')) + '.', 'failure')

                          startPostProcess()

                          return
                        }

                        // Start the project
                        Modules.Docker.getDockerInstance(clusterElement).startDockerCompose(pinnedToastID, (feedback) => {
                          // Don't trigger the time out function
                          clearTimeout(installationInfo)

                          // The project didn't run as expected
                          if (!feedback.status) {
                            // Show failure feedback to the user
                            showToast(I18next.capitalize(I18next.t('start docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, it seems the docker project [b]$data[/b] didn\'t run as expected', [getAttributes(clusterElement, 'data-name')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                            // Call the post function
                            startPostProcess()

                            // Skip the upcoming code
                            return
                          }

                          // Show success feedback to the user
                          showToast(I18next.capitalize(I18next.t('start docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('docker project [b]$data[/b] has been successfully started, waiting for Apache Cassandra ® to be up, you\'ll be automatically navigated to the project work area once it\'s up', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

                          // Remove all previous states
                          clusterElement.children('div.status').removeClass('success failure').addClass('show')

                          setTimeout(() => {
                            // Start watching Cassandra's node inside the project
                            Modules.Docker.checkCassandraInContainer(pinnedToastID, ports.cassandra, (status) => {
                              // Failed to connect with the node
                              if (!status.connected) {
                                // Show a failure feedback to the user
                                showToast(I18next.capitalize(I18next.t('start docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, it seems the Apache Cassandra ® nodes of the docker project [b]$data[/b] didn\'t start as expected, automatic stop of the docker project will be started in seconds', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                                /**
                                 * Create a pinned toast to show the output of the process
                                 *
                                 * Get a random ID for the toast
                                 */
                                let pinnedToastID = getRandomID(10)

                                // Show/create that toast
                                showPinnedToast(pinnedToastID, I18next.capitalize(I18next.t('start docker containers')) + ' ' + getAttributes(clusterElement, 'data-name'), '')

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
                                      return showToast(I18next.capitalize(I18next.t('stop docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to stop the docker project [b]$data[/b], please consider to do it manually by stopping the project [b]cassandra_$data[/b]', [getAttributes(clusterElement, 'data-name'), getAttributes(clusterElement, 'data-folder')])) + `. ` + (feedback.error != undefined ? I18next.capitalizeFirstLetter(I18next.t('error details')) + `: ${feedback.error}` + '.' : ''), 'failure')

                                    // The Docker project has successfully stopped
                                    showToast(I18next.capitalize(I18next.t('stop docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('the docker project [b]$data[/b] has been successfully stopped', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')
                                  })
                                }, 3000)

                                // Skip the upcoming code
                                return
                              }

                              /**
                               * Successfully started the project and Cassandra's one node at least is up
                               * Show feedback to the user
                               */
                              showToast(I18next.capitalize(I18next.t('start docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('apache Cassandra ® nodes of the docker project [b]$data[/b] has been successfully started and ready to be connected with, work area will be created and navigated to in seconds', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

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
                                    // Define the AxonOps localhost URL
                                    let axonopsURL = `http://localhost:${getAttributes(clusterElement, 'data-port-axonops')}`

                                    // Append a `webview` tag to the AxonOps tab
                                    $(`div.tab-pane#_${axonOpsContentID}`).append($(`<webview src="${axonopsURL}" nodeIntegrationInSubFrames nodeintegration></webview>`))

                                    // Clicks the globe icon in the cluster's info
                                    $(`div[content="workarea"] div.workarea[cluster-id="${clusterID}"]`).find('div.axonops-agent').click(() => Open(axonopsURL))
                                  } catch (e) {}
                                }, 1000)
                              }, 3000)
                            })
                          }, 20000)
                        })
                      })
                    })
                  })
                })
              } catch (e) {}

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
                addLog(`Attempt to edit cluster/sandbox ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`)

                // If the cluster has an active work area then stop the process and show feedback to the user
                if (hasWorkarea == 'true')
                  return showToast(I18next.capitalize(I18next.t('edit cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('this cluster [b]$data[/b] has an active work area, make sure to close its work area before attempting to edit it', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                // Change the dialog's title
                $(`${dialog}`).find('h5.modal-title').text(`${I18next.capitalize(I18next.t('edit cluster'))} ${getAttributes(clusterElement, 'data-name')}`)

                // Update the workspace's name badge
                $(`${dialog}`).find('div.modal-header span.badge.badge-secondary').text(getWorkspaceName(workspaceID))

                // Change and add some attributes to the dialog
                $(`${dialog}`).attr({
                  'data-edit-workspace-id': workspaceID, // Change the workspace's ID
                  'data-edit-cluster-id': clusterID // This attribute tells that the dialog is in the `Editing` mode
                })

                // Change the primary button's text
                $(`button#addCluster`).text(I18next.t('update cluster'))

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
                  return showToast(I18next.capitalize(I18next.t('edit cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('unable to locate cluster [b]$data[/b] workspace folder', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

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
                  }]

                  // Check if there's a need to create an SSH tunnel
                  try {
                    // If there's no SSH tunneling info then skip this try-catch block
                    if (currentCluster.ssh == undefined || Object.keys(currentCluster.ssh).length <= 0)
                      throw 0

                    // If there's a saved destination address, and it is not `127.0.0.1` then show it to the user
                    if (!([undefined, '127.0.0.1'].includes(currentCluster.ssh.dstAddr))) {
                      inputs.push({
                        section: 'none',
                        key: 'ssh-dest-addr',
                        val: currentCluster.ssh.dstAddr
                      })
                    }

                    // If we have a private key then show it to the user
                    if (currentCluster.ssh.privateKey != undefined) {
                      inputs.push({
                        section: 'none',
                        key: 'ssh-privateKey',
                        val: currentCluster.ssh.privateKey
                      })
                    }

                    // If there's a saved destination port, and it is not the same as the connection port then show it as well
                    if (currentCluster.ssh.dstPort != undefined && $('input[info-section="connection"][info-key="port"]').val() != currentCluster.ssh.dstPort) {
                      inputs.push({
                        section: 'none',
                        key: 'ssh-dest-port',
                        val: currentCluster.ssh.dstPort
                      })
                    }

                    // Do the same process to the SSH host
                    if (currentCluster.ssh.host != undefined && $('input[info-section="connection"][info-key="hostname"]').val() != currentCluster.ssh.host) {
                      inputs.push({
                        section: 'none',
                        key: 'ssh-host',
                        val: currentCluster.ssh.host
                      })
                    }

                    // And the SSH port as well
                    if (!([undefined, '22'].includes(currentCluster.ssh.port))) {
                      inputs.push({
                        section: 'none',
                        key: 'ssh-port',
                        val: currentCluster.ssh.port
                      })
                    }
                  } catch (e) {}

                  // Loop through all inputs in the `inputs` array and set their proper values
                  inputs.forEach((input) => {
                    // Get the MDB object for the current input
                    let object = getElementMDBObject($(`[info-section="${input.section}"][info-key="${input.key}"]`))

                    // Set its saved value
                    $(object._element).find('input').val(input.val)

                    // Update the object
                    object.update()
                    object._deactivate()
                  })

                  // Check username and password existence for Apache Cassandra and SSH tunnel
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
                        } catch (e) {}

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
                        } catch (e) {}

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
                    } catch (e) {}
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
                      key: 'ssh-privateKey',
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
                let confirmText = I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the cluster [b]$data[/b] in the workspace [b]$data[/b]?', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)]))

                // Add log
                addLog(`Request to delete cluster/sandbox ${getAttributes(clusterElement, ['data-name', 'data-id'])}.`, 'action')

                // If the current workspace is sandbox then change the text
                if (isSandbox)
                  confirmText = I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the docker project [b]$data[/b]?', [getAttributes(clusterElement, 'data-name')]))

                // Open the confirmation dialog and wait for the response
                openDialog(confirmText, (response) => {
                  // If canceled, or not confirmed then skip the upcoming code
                  if (!response)
                    return

                  // Get the project/cluster work area
                  let clusterWorkarea = $(`div[content="workarea"] div.workarea[cluster-id="${getAttributes(clusterElement, 'data-folder')}"]`)

                  // If there's a work area already then stop the deletion process
                  if (clusterWorkarea.length != 0)
                    return showToast(I18next.capitalize(I18next.t('delete docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('there\'s an active work area for the docker project [b]$data[/b], please consider to close it before attempting to delete the project again', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                  try {
                    // If the current workspace is not the sandbox then skip this try-catch block
                    if (!isSandbox)
                      throw 0

                    // Attempt to delete the project
                    Modules.Docker.deleteProject(getAttributes(clusterElement, 'data-folder')).then((status) => {
                      // Failed to delete the project
                      if (!status)
                        return showToast(I18next.capitalize(I18next.t('delete docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to delete the docker project [b]$data[/b]', [getAttributes(clusterElement, 'data-name')])) + '.', 'failure')

                      // Successfully deleted the project
                      showToast(I18next.capitalize(I18next.t('delete docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('the docker project [b]$data[/b] has been successfully deleted', [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

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
                      return showToast(I18next.capitalize(I18next.t('delete cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('failed to delete cluster [b]$data[/b] in workspace [b]$data[/b], please check that it\'s exists, and the app has permission to access the workspace folder', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'failure')

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
                    showToast(I18next.capitalize(I18next.t('delete cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('cluster [b]$data[/b] in workspace [b]$data[/b] has been successfully deleted', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'success')
                  })
                })
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
                  elementPath = Path.join(__dirname, '..', '..', 'data', 'docker', getAttributes(clusterElement, 'data-folder'))
                }

                // Open the final path
                Open(elementPath)
              })
            })
            // End of handling the `click` events for actions buttons

            /**
             * Inner function to request a pty instance creation from the main thread
             *
             * @Parameters:
             * {object} `readLine` is the read line object that has been created for the terminal, the terminal object itself can be passed too
             */
            let requestPtyInstanceCreation = (readLine) => {
              try {
                // Get the workspace's folder path
                let workspaceFolderPath = getWorkspaceFolderPath(workspaceID),
                  // Get the current cluster's folder path
                  clusterFolder = Path.join(workspaceFolderPath, getAttributes(clusterElement, 'data-folder'))

                // Get the `cqlsh.rc` config file's path for the current cluster
                let cqlshrcPath = Path.join(clusterFolder, 'config', 'cqlsh.rc'),
                  // Get Apache Cassandra's version
                  version = getAttributes(clusterElement, 'data-cassandra-version')

                // Print the host and Apache Cassandra's version in the terminal
                terminalPrintMessage(readLine, 'info', `Connecting with host ${getAttributes(clusterElement, 'data-host')}`)
                terminalPrintMessage(readLine, 'info', `Detected Apache Cassandra ® version is ${version}`)

                /**
                 * Check some options in the `cqlsh.rc` file
                 * If we aren't able to do this the code flow will continue and no need to notify the user about that
                 */
                try {
                  // Read the `cqlsh.rc` file
                  FS.readFile(cqlshrcPath, 'utf8', (err, content) => {
                    // With an error occurs stop the checking process
                    if (err)
                      return

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
                        terminalPrintMessage(readLine, 'warn', 'SSL is not enabled, the connection is not encrypted and is being transmitted in the clear')

                        // Update the SSL attribute
                        clusterElement.attr('ssl-enabled', 'false')
                      } catch (e) {}

                      // Update the lockpad status
                      updateSSLLockpadStatus(clusterElement)
                    })
                  })
                } catch (e) {}

                // Show feedback to the user when the connection is established through the SSH tunnel
                if (sshTunnels[clusterID] != null)
                  terminalPrintMessage(readLine, 'info', 'This connection is established through SSH tunnel')

                /**
                 * The connection creation object
                 * The initial data: The cluster's ID, its `cqlsh.rc` config file path, Apache Cassandra's version, and the log file path for this connection session
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
                    if (usernameDecrypted == 'cassandra')
                      terminalPrintMessage(readLine, 'warn', 'Connection is using default `cassandra` user')
                  })
                } catch (e) {}

                // Check if there is SSH tunnel creation info
                try {
                  // If there is no SSH tunnel info then stop this sub-process
                  if (sshTunnels[clusterID] == null)
                    throw 0

                  // Create an object to handle the creation info
                  let tunnelInfo = sshTunnels[clusterID],
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

                // Send a request to create a pty instance and connect with the cluster
                IPCRenderer.send('pty:create', {
                  ...creationData,
                  workspaceID: getActiveWorkspaceID()
                })
              } catch (e) {}
            }
          }))
          // End of the process when appending a cluster in the container
        } catch (e) {}
      })
    })
    // End of getting all saved clusters/projects

    /**
     * Define different inner functions that are used in this events file
     *
     * Inner function to perform the test connection's process with cluster
     *
     * @Parameters:
     * {object} `clusterElement` the cluster's UI element in the workspace clusters' list
     */
    let testConnection = async (clusterElement) => {
      // Point at the Apache Cassandra's version UI element
      let cassandraVersion = clusterElement.find('div[info="cassandra"]'),
        // Point at the data center element
        dataCenter = clusterElement.find('div[info="data-center"]'),
        // Point at the `CONNECT` button
        connectBtn = clusterElement.children('div.footer').children('div.button').children('button.connect'),
        // Point at the `TEST CONNECTION` button
        testConnectionBtn = clusterElement.children('div.footer').children('div.button').children('button.test-connection'),
        // Point at the status element - the flashing circle at the top right -
        statusElement = clusterElement.children('div.status'),
        // Get the cluster's ID from its attribute
        clusterID = getAttributes(clusterElement, 'data-id'),
        // Username and password - for Apache Cassandra DB Auth - to be passed if needed
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
        showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong while attempt to test connection with cluster [b]$data[/b] in workspace [b]$data[/b], mostly it is an issue with <code>cqlsh.rc</code> file', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'failure')

        setTimeout(() => {
          // Enable the `TEST CONNECTION` button
          testConnectionBtn.removeAttr('disabled')

          // Remove multiple classes for the cluster and its status elements
          clusterElement.add(statusElement).removeClass('test-connection show failure success')
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
        showToast(I18next.capitalize(I18next.t('test connection with cluster')), `<code>cqlsh.rc</code> ${I18next.t('content for this connection contains a sensitive data (username, password and alike), please consider to remove them before attempting to connect again')}.`, 'failure')

        // Enable the `CONNECT` button
        testConnectionBtn.removeAttr('disabled')

        // Remove multiple classes for the cluster and its status elements
        clusterElement.add(statusElement).removeClass('test-connection show failure success')

        // Skip the upcoming code
        return
      } catch (e) {}

      // Define the test data; the cluster's ID and its `cqlsh.rc` file's path
      let testData = {
        id: clusterObject.info.id,
        cqlshrcPath: clusterObject.cqlshrcPath
      }

      // Check if there is a username and password for Apache Cassandra
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
      let startTestConnection = (sshCreation = null) => {
        // Define an SSH port object to be passed if needed
        let sshPort = {},
          // Get a random ID for the connection test's request
          requestID = getRandomID(10)

        // If the `sshCreation` object has been passed then use the random used port in the creation process instead of the one the user has passed
        if (sshCreation != null)
          sshPort.port = sshCreation.port

        // Send test request to the main thread and pass the final `testData`
        IPCRenderer.send('pty:test-connection', {
          workspaceID: getActiveWorkspaceID(),
          ...testData,
          ...sshPort,
          requestID
        })

        // Once a response from the main thread has been received
        IPCRenderer.on(`pty:test-connection:${requestID}`, (_, result) => {
          setTimeout(() => {
            // Failed to connect with the cluster
            try {
              // If the `connected` attribute in the result is `true`, and the Apache Cassandra's version has been identified then skip this try-catch block
              if (result.connected && ![undefined, null].includes(result.version))
                throw 0

              /**
               * Update cluster UI element
               *
               * Change the `connected` attribute's value to `false` - failed to connect with the cluster -
               */
              clusterElement.attr('data-connected', 'false')

              try {
                // Whether or not the error details will be shown
                let error = result.error.trim().length != 0 ? `, ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                // Show feedback to the user
                showToast(I18next.capitalize(I18next.t('test connection with cluster')), `${I18next.capitalizeFirstLetter(I18next.replaceData('failed to connect with cluster [b]$data[/b] in workspace [b]$data[/b]', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)]))}${error}.`, 'failure')
              } catch (e) {}

              // Close the SSH tunnel if it exists
              try {
                IPCRenderer.send('ssh-tunnel:close', getAttributes(clusterElement, 'data-id'))
              } catch (e) {}

              setTimeout(() => {
                // Test process has finished
                clusterElement.removeClass('test-connection')

                // Show failure feedback
                statusElement.removeClass('success').addClass('show failure')

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
                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('post-connection scripts are being executed after closing the connection with cluster [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(clusterElement, 'data-name')])) + '.'), 50)

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
                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts with cluster [b]$data[/b]', [I18next.t('post'), getAttributes(clusterElement, 'data-name')]))}${executionFeedback}`, 'failure'), 50)
                  } catch (e) {
                    // Show success feedback to the user if the error is `0` code
                    if (e == 0)
                      setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts with cluster [b]$data[/b] have been successfully executed', [I18next.t('post'), getAttributes(clusterElement, 'data-name')])) + '.', 'success'), 50)
                  }
                })
              } catch (e) {}

              // Skip the upcoming code
              return
            } catch (e) {}

            /**
             * Successfully connected with the cluster
             *
             * Add the created SSH tunnel object to the `sshTunnels` array; to have the ability to identify if the cluster has an SSH tunnel associated with it
             */
            sshTunnels[clusterObject.info.id] = sshCreation

            // Show Apache Cassandra version
            cassandraVersion.children('div._placeholder').hide()
            cassandraVersion.children('div.text').text(`v${result.version}`)

            // Show data center
            if (result.datacenter != undefined) {
              dataCenter.children('div._placeholder').hide()
              dataCenter.children('div.text').text(`${result.datacenter}`)
            }

            // Update some attributes for the cluster UI element alongside some classes
            clusterElement.attr({
              'data-cassandra-version': result.version,
              'data-datacenter': result.datacenter,
              'data-connected': 'true'
            })

            // Add the success state to the cluster's UI element
            statusElement.removeClass('failure').addClass('success')

            try {
              // If the version of Cassandra is not v3 then skip this try-catch block
              if (!result.version.startsWith('3.'))
                throw 0

              // Just warn the user about that unsupported version
              setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra ® is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
            } catch (e) {}

            // Show success feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('test connection with cluster [b]$data[/b] in workspace [b]$data[/b] has finished with success, you can now connect with it and start a session', [getAttributes(clusterElement, 'data-name'), getWorkspaceName(workspaceID)])) + '.', 'success')

            setTimeout(() => {
              // Enable the `CONNECT` button
              connectBtn.add(testConnectionBtn).removeAttr('disabled')

              // Remove the test connection state
              clusterElement.removeClass('test-connection')
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

          // Show feedback to the user about starting the execution process
          setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('pre-connection scripts are being executed before starting the connection with cluster [b]$data[/b], you\'ll be notified once the process is finished', [getAttributes(clusterElement, 'data-name')])) + '.'), 50)

          // Execute the pre-connection scripts with order
          executeScript(0, scripts.pre, (executionResult) => {
            // All scripts have been executed successfully; thus start the connection test process
            if (executionResult.status == 0) {
              // Show a success feedback to the user
              setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts with cluster [b]$data[/b] have been successfully executed', [I18next.t('pre'), getAttributes(clusterElement, 'data-name')])) + '.', 'success'), 50)

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
            setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts with cluster [b]$data[/b]', [I18next.t('pre'), getAttributes(clusterElement, 'data-name')]))}. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}.`, 'failure'), 50)

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
      let errorVisualFeedback = () => {
        // Remove the test connection class
        clusterElement.removeClass('test-connection')

        // Add a failure class
        statusElement.addClass('show failure')

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
        if (sshTunnelingInfo == null || typeof sshTunnelingInfo != 'object')
          throw 0

        // Check if an SSH client is installed and accessible
        checkSSH((exists) => {
          // If the SSH client doesn't exist
          if (!exists) {
            // Show feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.t('SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine') + '.', 'failure')

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
          if (([sshUsername, sshPassword, sshPassphrase].filter((secret) => secret == undefined || secret.trim().length <= 0)).length == 2) {
            // If not then stop the test process and show feedback to the user
            showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.t('SSH tunnel can\'t be established without passing at least a username, please check given info before attempting to connect again') + '.', 'failure')

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
              showToast(I18next.capitalize(I18next.t('test connection with cluster')), `${I18next.capitalizeFirstLetter(I18next.replaceData('failed to establish an SSH tunnel for cluster [b]$data[/b]', [getAttributes(clusterElement, 'data-name')]))}</b>. ${creationResult.error}.`, 'failure')

              // Call the error's visual feedback function
              errorVisualFeedback()

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

              // If the key/option is `port` then set it to its default value
              if (key == 'port')
                finalValue = '9042'

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

          // Clicks the `TEST CONNECTION` button to do a connection test with the cluster before saving/updating it
          {
            $('#testConnectionCluster').click(async function() {
              let hostname = '', // The given hostname
                port = 9042, // Default port to connect with Apache Cassandra
                // Apache Cassandra's authentication username and password
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

              // Add log about this request
              addLog(`Request to test connection with cluster which about to be added/updated.`, 'action')

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
                showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.capitalizeFirstLetter(I18next.t('to test connection, host name is the only required field to be fulfilled')) + '.', 'failure')

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
                showToast(I18next.capitalize(I18next.t('test connection with cluster')), `<code>cqlsh.rc</code> ${I18next.t('content for this connection contains a sensitive data (username, password and alike), please consider to remove them before attempting to connect again')}.`, 'failure')

                // Enable the `TEST CONNECTION` button
                button.add('#switchEditor').removeAttr('disabled', 'disabled')

                // Remove the test connection class
                dialogElement.removeClass('test-connection')

                // Skip the upcoming code
                return
              } catch (e) {}

              // Check if there's a need to create an SSH tunnel
              try {
                // Get related inputs values to the SSH tunnel info
                let values = ['username', 'password', 'privateKey', 'passphrase']

                // Loop through each value
                values.forEach((value) => {
                  // Get the value of the current input
                  ssh[value] = $(`[info-section="none"][info-key="ssh-${value}"]`).val()
                })

                // If both username and (password or private key) have been provided then an SSH tunnel should be created
                sshTunnel = ssh.username.trim().length != 0 && ([ssh.password, ssh.privateKey].some((secret) => secret.trim().length != 0))
              } catch (e) {}

              // The dialog is testing the connection with the cluster
              dialogElement.addClass('test-connection')

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
                  // Get the SSH username and password - for Apache Cassandra's authentication -
                  username = $('[info-section="none"][info-key="username"]').val()
                  password = $('[info-section="none"][info-key="password"]').val()

                  // If both username and password have been provided then they'll be encrypted
                  waitForEncryption = [username, password].every((secret) => secret.trim().length != 0)
                } catch (e) {}

                // Inner function inside `afterSSHProcess` function; to start the connection test with cluster
                let startTestConnection = () => {
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
                        } catch (e) {}

                        // Remove the test connection class
                        dialogElement.removeClass('test-connection')

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
                      } catch (e) {}

                      /**
                       * If there's a post-connection script(s) to be executed
                       *
                       * Set this variable to hold the overall script's execution feedback
                       */
                      let executionFeedback = ''

                      // Hold the tested cluster's object
                      testedClusterObject = result

                      try {
                        // Remove the test connection class
                        dialogElement.removeClass('test-connection')

                        // Enable the `TEST CONNECTION` button
                        button.add('#switchEditor').removeAttr('disabled', 'disabled')

                        // Determine if the connection test has succeeded or not
                        let notConnected = !result.connected || [undefined, null].includes(result.version)

                        // Enable or disable the save button based on the test's result
                        $('#addCluster').attr('disabled', !notConnected ? null : 'disabled')

                        // Failed to connect with the cluster
                        if (notConnected) {
                          // Define the error message
                          let error = result.error.trim().length != 0 ? ` ${I18next.capitalizeFirstLetter(I18next.t('error details'))}: ${result.error}` : ''

                          // Show feedback to the user
                          showToast(I18next.capitalize(I18next.t('test connection with cluster')), `${I18next.capitalizeFirstLetter(I18next.t('failed to connect with cluster'))}${error}${executionFeedback}.`, 'failure')

                          // Skip the upcoming code
                          throw 0
                        }

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
                          // If the version of Cassandra is not v3 then skip this try-catch block
                          if (!result.version.startsWith('3.'))
                            throw 0

                          // Just warn the user about that unsupported version
                          setTimeout(() => showToast(I18next.capitalize(I18next.t('unsupported version')), I18next.capitalizeFirstLetter(I18next.replaceData('the detected version of Apache Cassandra ® is [b]$data[/b], unwanted behaviour and compatibility issues may be encountered', [result.version])) + '.', 'warning'))
                        } catch (e) {}

                        // Show feedback to the user
                        showToast(I18next.capitalize(I18next.t('test connection with cluster')), `${I18next.capitalizeFirstLetter(I18next.t('successfully connected with the cluster'))}, ${I18next.capitalizeFirstLetter(suffix)}${executionFeedback}.`, 'success')

                        // Refresh workspaces - to ensure synchronization with the latest data -
                        $(document).trigger('refreshWorkspaces')
                      } catch (e) {}

                      // Check if there are post-connection scripts to be executed after the connection attempt
                      if (scripts.post.length != 0) {
                        // Show feedback to the user about starting the execution process
                        setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.t('post-connection scripts are being executed after closing the connection with the cluster, you\'ll be notified once the process is finished')) + '.'), 50)

                        // Request to execute the post-connection scripts
                        executeScript(0, scripts.post, (executionResult) => {
                          /**
                           * All scripts have been successfully executed and all of them have returned `0`
                           * Show the success feedback to the user and skip the upcoming code
                           */
                          if (executionResult.status == 0)
                            return setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts with the cluster have been successfully executed', [I18next.t('post')])) + '.', 'success'), 50)

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
                          setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('post')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts with the cluster', [I18next.t('post')]))}. ${executionFeedback}`, 'failure'), 50)
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
                  showToast(I18next.capitalize(I18next.t('test connection with cluster')), `${I18next.capitalizeFirstLetter(I18next.t('failed to complete the test process, please check the privileges of the app to read/write'))}.`, 'failure')

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
                    return showToast(I18next.capitalize(I18next.t('test connection with cluster')), I18next.t('SSH client has to be installed and accessible in order to establish SSH tunnel, please make sure to install it on your machine') + '.', 'failure')

                  // Define the essential SSH tunnel creation info
                  ssh.host = $('[info-section="none"][info-key="ssh-host"]').val() || hostname
                  ssh.port = $('[info-section="none"][info-key="ssh-port"]').val() || 22
                  ssh.dstAddr = $('[info-section="none"][info-key="ssh-dest-addr"]').val() || '127.0.0.1'
                  ssh.dstPort = $('[info-section="none"][info-key="ssh-dest-port"]').val() || cqlshContent.connection.port
                  ssh.clusterID = tempClusterID

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
                    dialogElement.removeClass('test-connection')

                    // Enable the `TEST CONNECTION` button
                    button.add('#switchEditor').removeAttr('disabled', 'disabled')

                    // Show feedback to the user
                    showToast(I18next.capitalize(I18next.t('test connection with cluster')), `${I18next.capitalizeFirstLetter(I18next.t('failed to establish an SSH tunnel for the cluster'))}. ${creationResult.error}.`, 'failure')
                  })
                })
              }

              // Execute pre-connection scripts if needed
              try {
                // If there's no pre-connection script(s) to be executed then skip this try-catch block
                if (scripts.pre.length <= 0)
                  throw 0

                // Show feedback to the user about starting the execution process
                setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.t('pre-connection scripts are being executed before starting the connection with the cluster, you\'ll be notified once the process is finished')) + '.'), 50)

                // Request to execute the pre-connection script(s)
                executeScript(0, scripts.pre, (executionResult) => {
                  /**
                   * All scripts have been executed successfully
                   * Call the function which will start the connection test
                   */
                  if (executionResult.status == 0) {
                    // Show success feedback to the uers
                    setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), I18next.capitalizeFirstLetter(I18next.replaceData('all $data-connection scripts with the cluster have been successfully executed', [I18next.t('pre')])) + '.', 'success'), 50)

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
                  setTimeout(() => showToast(I18next.capitalize(I18next.replaceData('$data-connection scripts execution', [I18next.t('pre')])), `${I18next.capitalizeFirstLetter(I18next.replaceData('an error has occurred while executing $data-connection scripts with the cluster', [I18next.t('pre')]))}. ${I18next.capitalizeFirstLetter(I18next.replaceData(info, [executionResult.scripts[executionResult.scriptID]]))}`, 'failure'), 50)

                  // Remove the test connection class
                  dialogElement.removeClass('test-connection')

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
          }

          // Clicks the `SAVE/UPDATE CLUSTER` button
          {
            $('#addCluster').click(async function() {
              let clusterName = $('[info-section="none"][info-key="clusterName"]').val(), // The cluster's unique name
                username = '', // Apache Cassandra's username
                password = '', // Apache Cassandra's password
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
              addLog(`Request to add/edit cluster.`, 'action')

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
                showToast(I18next.capitalize(I18next.t('add cluster')), I18next.capitalizeFirstLetter(I18next.t('to save a cluster, a unique valid name is required to be fulfilled')) + '.', 'failure')

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
                showToast(I18next.capitalize(I18next.t('add cluster')), I18next.capitalizeFirstLetter(I18next.replaceData('a cluster is already exists with the given name [b]$data[/b] in workspace [b]$data[/b], please provide a unique valid name', [clusterName, getWorkspaceName(workspaceID)])) + '.', 'failure')

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
                  datacenter: $('[info-section="none"][info-key="datacenter"]').val()
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
                  showToast(I18next.capitalize(I18next.t('add cluster')), `${I18next.capitalizeFirstLetter(I18next.t(editingMode ? 'failed to update the cluster' : 'failed to save the new cluster'))}.`, 'failure')

                  // Skip the upcoming code - end the process -
                  return
                } catch (e) {}

                /**
                 * The cluster has been successfully saved/updated
                 *
                 * Show feedback to the user
                 */
                showToast(I18next.capitalize(I18next.t('add cluster')), `${I18next.capitalizeFirstLetter(I18next.t(editingMode ? 'the cluster has been updated successfully' : 'the new cluster has been saved successfully'))}.`, 'success')

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

                  // Hide cassandra and datacenter info elements and show their placeholder
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
                    // Update secrets data for the cluster - Apache Cassandra's authentication and SSH credentials -
                    clusterUI.attr({
                      'data-username': saveAuthCredentials && secrets.auth == undefined ? (secrets != null ? secrets.username : null) : null,
                      'data-password': saveAuthCredentials && secrets.auth == undefined ? (secrets != null ? secrets.password : null) : null,
                      'data-ssh-username': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshUsername : null) : null,
                      'data-ssh-password': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshPassword : null) : null,
                      'data-ssh-passphrase': saveSSHCredentials && secrets.ssh == undefined ? (secrets != null ? secrets.sshPassphrase : null) : null,
                      'data-credentials-auth': secrets.auth != undefined || (!saveAuthCredentials && (secrets != null && secrets.username != null && secrets.password != null)) ? 'true' : null,
                      'data-credentials-ssh': secrets.ssh != undefined || !saveSSHCredentials && (secrets != null && secrets.sshUsername != null && secrets.sshPassword != null) ? 'true' : null,
                    })
                  } catch (e) {}

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
                      dataCenter = clusterElement.find('div[info="data-center"]'),
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
                       * Add the created SSH tunnel object to the `sshTunnels` array; to have the ability to identify if the cluster has an SSH tunnel associated with it
                       */
                      sshTunnels[finalCluster.info.id] = testedSSHTunnelObject

                      try {
                        IPCRenderer.send('ssh-tunnel:update', {
                          oldID: tempClusterID,
                          newID: finalCluster.info.id
                        })
                      } catch (e) {}
                    } catch (e) {}

                    // Show Apache Cassandra version
                    cassandraVersion.children('div._placeholder').hide()
                    cassandraVersion.children('div.text').text(`v${testedClusterObject.version}`)

                    // Show data center
                    if (testedClusterObject.datacenter != undefined) {
                      dataCenter.children('div._placeholder').hide()
                      dataCenter.children('div.text').text(`${testedClusterObject.datacenter}`)
                    }

                    // Update some attributes for the cluster UI element alongside some classes
                    clusterElement.attr({
                      'data-cassandra-version': testedClusterObject.version,
                      'data-datacenter': testedClusterObject.datacenter,
                      'data-connected': 'true'
                    })

                    // Add the success state to the cluster's UI element
                    statusElement.removeClass('failure').addClass('show success')

                    setTimeout(() => {
                      // Enable the `CONNECT` button
                      connectBtn.add(testConnectionBtn).removeAttr('disabled')

                      // Remove the test connection state
                      clusterElement.removeClass('test-connection')
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
                 * Check username and password for both; Apache Cassandra and SSH tunnel
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

                // If Apache Cassandra's username and password have been provided then the encryption process must be executed
                if ([username, password].every((secret) => secret.trim().length != 0))
                  waitForEncryption = true

                // If SSH's username and password have been provided then the encryption process must be executed, and add the tunnel creation info to the cluster's object
                if (sshUsername.trim().length != 0 && [sshPassword, sshPrivatekey].some((secret) => secret.trim().length != 0)) {
                  waitForEncryption = true
                  sshTunnel = true
                }
              } catch (e) {}

              try {
                // If there's no SSH tunnel creation info to be handled then skip this try-catch block
                if (!sshTunnel)
                  throw 0

                // Add `ssh` object to the final cluster's object
                finalCluster.ssh = {}

                // Add the `privateKey` attribute if it has been provided
                if (sshPrivatekey.trim().length != 0)
                  finalCluster.ssh.privateKey = sshPrivatekey

                // Add the `passphrase` attribute if it has been provided
                if (sshPassphrase.trim().length != 0)
                  finalCluster.ssh.passphrase = sshPassphrase

                // Add other info; host, port, destination address, and destination port
                finalCluster.ssh.host = $('[info-section="none"][info-key="ssh-host"]').val() || $('[info-section="connection"][info-key="hostname"]').val()
                finalCluster.ssh.port = $('[info-section="none"][info-key="ssh-port"]').val() || 22
                finalCluster.ssh.dstAddr = $('[info-section="none"][info-key="ssh-dest-addr"]').val() || '127.0.0.1'
                finalCluster.ssh.dstPort = $('[info-section="none"][info-key="ssh-dest-port"]').val() || $('[info-section="connection"][info-key="port"]').val()
              } catch (e) {}

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
                   * Encrypt all provided secrets - for Apache Cassandra and SSH -
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

              // Get the MDB object for the current input field
              let inputObject = getElementMDBObject($(this).parent().children('input'))

              try {
                // Update the input's value
                $(this).parent().children('input').val(selected)

                // Update its state
                inputObject.update()
              } catch (e) {}
            })
          })

          /**
           * This input is related to select files regards SSH, SSL, and Cassandra authentication
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
              case 'ssh-privateKey': {
                title = 'select SSH private key file'
                break
              }
              case 'certfile': {
                title = 'select SSL certificate file'
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
              let tooltipObject = allMDBObjects.filter((object) => object.type == 'Tooltip' && object.element.is($(this)))

              // If the path to the file is invalid or inaccessible then don't adopt it
              if (!pathIsAccessible(selected[0])) {
                // Clear the input's value
                $(this).val('').trigger('input')

                // CLear the file's name preview
                $(this).parent().attr('file-name', '-')

                try {
                  // Disable the tooltip
                  tooltipObject[0].object.disable()
                } catch (e) {}

                // Skip the upcoming code
                return
              }

              try {
                // Enable the tooltip and update its content
                tooltipObject[0].object.enable()
                tooltipObject[0].object.setContent(selected[0])
              } catch (e) {}

              // Set the selected file's path
              $(this).val(selected[0]).trigger('input')
              $(this).parent().attr('file-name', Path.basename(selected[0]))
            })
          })
        }
      }
    }

    // Load snapshot dialog
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
            if (!response)
              return

            // Loop through each snapshot
            $(`${dialog} div.snapshots div.snapshot`).each(function() {
              // Check if the checkbox of it is checked
              let checked = $(this).find('input[type="checkbox"]').prop('checked')

              // If so, then delete that snapshot
              if (checked)
                $(this).find('a[action="delete"]').trigger('click', true)
            })
          }, true)
        })
      }
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
        $(`${dialog}`).find('h5.modal-title').text(I18next.capitalize(I18next.t('add cluster')))
        $(`${dialog}`).removeAttr('data-edit-workspace-id data-edit-cluster-id')

        $(`${dialog} button#addCluster`).attr('disabled', 'disabled')
        $(`${dialog} button#addCluster`).text(I18next.capitalize(I18next.t('add cluster')))

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
        // Flag to tell if the description has been fetched already or not
        isDescriptionFetched = false

      // Get the CQL description based on the passed scope
      Modules.Clusters.getCQLDescription(data.clusterID, data.scope, (description) => {
        // If the description has been fetched already then skip this process
        if (isDescriptionFetched)
          return

        // Update the flag
        isDescriptionFetched = true

        // The CQL description's tab's container is not empty now, and make sure to clear the empty the search input field
        cqlDescriptionsTabContent.removeClass('_empty').find('input').val('')

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
            editorObject.setValue('\n\n' + `${description}`)
          })

          // Skip the upcoming code
          return
        } catch (e) {}

        // Get a random ID for the description's editor's container
        let editorContainerID = getRandomID(10)

        // Description's UI element structure
        let element = `
            <div class="description" data-scope="${data.scope}">
              <span class="badge rounded-pill badge-secondary">${scope}</span>
              <div class="inner-content">
                <div class="editor" id="_${editorContainerID}">
                </div>
              </div>
            </div>`

        // Prepend the description's UI element to the container
        cqlDescriptionsContainer.prepend($(element).show(function() {
          setTimeout(() => {
            // Create an editor for the description
            let descriptionEditor = monaco.editor.create($(`#_${editorContainerID}`)[0], {
              value: '\n\n' + `${description}`,
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
              scrollBeyondLastLine: true,
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
                   * Create a resize observer for the work area body element
                   * By doing this the editor's dimensions will always fit with the dialog's dimensions
                   */
                  setTimeout(() => {
                    (new ResizeObserver(() => {
                      try {
                        descriptionEditor.layout()
                      } catch (e) {}
                    })).observe(workareaElement[0])
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
        }))
      })
    })
  }
}