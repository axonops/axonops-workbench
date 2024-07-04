// Handle the sandbox project's creation dialog
{
  // Define the dialog path's CSS selector
  let dialog = 'div.modal#createSandboxProjectDialog',
    // Get the MDB object of the dropdown - version's select - UI element
    selectDropdown = getElementMDBObject($(`${dialog}`).find('div.dropdown'), 'Dropdown')

  // On input's `focus` event show the dropdown menu
  $(`${dialog}`).find(`input#apacheCassandraVersion`).on('focus', () => selectDropdown.show()).on('focusout', () => setTimeout(() => selectDropdown.hide(), 100))

  // Clicks one of the items on the dropdown menu
  $(`${dialog}`).find('ul li a.dropdown-item').click(function() {
    // Point at the main select/input field element
    let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

    // Change its value
    selectElement.val($(this).attr('value'))
  })

  // Clicks the `CREATE PROJECT` button
  $(`button#createDockerProject`).click(function() {
    // Disable the button - to let the user know that there's a background process
    $(this).attr('disabled', '')

    // Add log about this request
    addLog(`Request has been triggered, create a docker/sandbox project`, 'action')

    // Check the existence of Docker in the machine
    Modules.Docker.checkDockerCompose((dockerExists, userGroup) => {
      // Enable the button again
      $(this).removeAttr('disabled')

      // If Docker doesn't exist then show feedback to the user and skip the upcoming code
      if (!dockerExists)
        return showToast(I18next.capitalize(I18next.t('create docker project')), I18next.capitalizeFirstLetter(I18next.t('sandbox feature requires [code]docker[/code] and its [code]docker-compose[/code] tool to be installed, please make sure its installed and accessible before attempting to create a docker project')) + '.', 'failure')

      // If the current user is not in the `docker` group
      if (!userGroup)
        return showToast(I18next.capitalize(I18next.t('create docker project')), I18next.capitalizeFirstLetter(I18next.t('sandbox feature requires the current user to be in the [code]docker[/code] group in [b]Linux[/b], please make sure this requirement is met then try again')) + '.', 'failure')

      /**
       * Get associated inputs
       *
       * Get the project's name - optional -
       */
      let dockerProjectName = $(`${dialog}`).find(`input#dockerProjectName`).val(),
        // Get the preferred Cassandra® version
        cassandraVersion = $(`${dialog}`).find(`input#apacheCassandraVersion`).val(),
        // Get the number of Cassandra®'s nodes in the project
        numOfNodes = parseInt($('input#numOfNodes').val()),
        // Get whether the project should be started once it's created or not
        immediateProjectRun = $(`${dialog}`).find(`input#immediateProjectRun`).prop('checked'),
        // Get the minimum and maximum number of Cassandra®'s nodes in the project
        [minNumOfNodes, maxNumOfNodes] = getAttributes($('input#numOfNodes'), ['min', 'max'])

      // Parse the minimum and maximum values to integer
      minNumOfNodes = parseInt(minNumOfNodes)
      maxNumOfNodes = parseInt(maxNumOfNodes)

      // Normalize the given number of nodes
      numOfNodes = (numOfNodes < minNumOfNodes) ? minNumOfNodes : ((numOfNodes > maxNumOfNodes) ? maxNumOfNodes : numOfNodes)

      // Add log about the project's attributes
      addLog(`The docker/sandbox project's attributes are: [Cassandra® version: ${cassandraVersion}, Number of nodes: ${numOfNodes}]`)

      // Create a Docker instance/object
      let dockerObject = new Modules.Docker.DockerCompose()

      // Create the Docker compose YAML file
      dockerObject.createDockerComposeYAML(cassandraVersion, numOfNodes).then((project) => {
        // If a name has been given then adopt it
        if (manipulateText(dockerProjectName).length != 0)
          project.name = dockerProjectName

        // Set Cassandra®'s version
        project.cassandraVersion = cassandraVersion

        // Set the number of Cassandra®'s nodes in the project
        project.nodes = numOfNodes

        // Save the Docker project
        Modules.Docker.saveProject(project).then((status) => {
          // Failed to save the project
          if (status != 1)
            return showToast(I18next.capitalize(I18next.t('create docker project')), I18next.capitalizeFirstLetter(I18next.t('something went wrong, failed to save the docker project')) + '.', 'failure')

          // Successfully saved the project
          showToast(I18next.capitalize(I18next.t('create docker project')), I18next.capitalizeFirstLetter(I18next.replaceData('the project with Apache Cassandra® v$data has been successfully created and saved', [cassandraVersion])) + '.', 'success')

          // Either `refresh` or `get` workspaces based on the state of the process
          $(document).trigger(getAttributes($(this), 'data-refresh') == 'false' ? 'getWorkspaces' : 'refreshWorkspaces')

          // Refresh clusters
          $(document).trigger('refreshClusters', 'workspace-sandbox')

          // Click the close button of the dialog
          $(`${dialog}`).find('button.btn-close').click()

          // If there's no need to run the project then skip the upcoming code
          if (!immediateProjectRun)
            return

          // Inner function that will run the created docker project once it's visible
          let runProject = () => {
            /**
             * Make sure this process has a time frame
             * Get the start time of the process
             */
            let startTime = new Date().getTime(),
              // Set the maximum time allowed for this process to retry
              maximumAllowedTime = 10000

            // Define an interval object
            let intervalObject = setInterval(() => {
              // Get the current time of retying the process
              let currentTime = new Date().getTime()

              // If the process has exceeded the maximum allowed time then end it
              if (currentTime - startTime >= maximumAllowedTime)
                return clearInterval(intervalObject)

              try {
                // Point at the created docker project's element in the UI
                let dockerProjectElement = $(`div.clusters[workspace-id="workspace-sandbox"] div.cluster[data-folder="${project.folder}"]`)

                // If the element is yet not visible in the UI then skip this try-catch block
                if (!dockerProjectElement.is(':visible'))
                  throw 0

                /**
                 * Reaching here means the element is visible in the UI
                 * Clear the interval process
                 */
                if (intervalObject != undefined)
                  clearInterval(intervalObject)

                // Click the `START` button of the project
                dockerProjectElement.find('div.footer div.button button:not(.connect)').click()
              } catch (e) {}
            }, 100)
          }

          // If the user is in the docker/sandbox projects container then start/run the created docker project immediately
          if (getActiveWorkspaceID() == 'workspace-sandbox')
            return runProject()

          /**
           * Reaching here means the user is not in the docker projects container so the app should enter it first
           * Click the `ENTER` button of the container
           */
          $('div.body div.right div.content div[content][content="workspaces"] div.workspaces-container div.workspace[data-id="workspace-sandbox"]').find('div.button button').click()

          // Now attempt to start/run the created docker project
          setTimeout(() => runProject(), 250)
        })
      })
    })
  })

  // Clicks the sandbox project creation button - the icon one which appears if neither a workspace nor sandbox project created yet -
  $(`button#createSandboxProjectProcess`).on('click', function(_, refresh = false) {
    $(`button#createDockerProject`).attr('data-refresh', `${refresh}`)
  })
}
