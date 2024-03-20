/**
 * Events of Getting/Refreshing all workspaces
 *
 * `getWorkspaces` event will remove all workspaces in the UI, and retrieve them from the workspaces' folder or the specific location of each one of them
 * `refreshWorkspaces` event, on the other hand, will keep the current workspaces in the UI, update them as needed, and just add the ones that are not in the UI already
 */
$(document).on('getWorkspaces refreshWorkspaces', function(e) {
  const event = e.type, // To determine if the event is `getWorkspaces` or `refreshWorkspaces`
    // Point at the workspaces container element
    workspacesContainer = $('div.body div.right div.content div[content="workspaces"] div.workspaces-container')

  // Get all saved workspaces
  Modules.Workspaces.getWorkspaces().then(async (workspaces) => {
    // Clean the container if the event is `get` workspaces
    if (event == 'getWorkspaces')
      workspacesContainer.html('')

    // Get all saved docker projects
    let dockerProjects = await Modules.Docker.getProjects()

    // Add or remove the empty class based on the number of saved workspaces
    workspacesContainer.parent().toggleClass('empty', workspaces.length <= 0 && dockerProjects.length <= 0)

    // Add the docker/sandbox element
    try {
      workspaces.unshift({
        id: 'workspace-sandbox',
        defaultPath: true,
        folder: 'docker',
        name: 'Sandbox',
        color: '#3b71ca'
      })
    } catch (e) {}

    /**
     * Click the cog actions button; to hide the actions sub-buttons
     *
     * Point at the cog actions button in the UI
     */
    let workspaceActions = workspacesContainer.parent().find('div.section-actions')

    // If sub-buttons are shown then hide them
    if (workspaceActions.hasClass('show'))
      workspaceActions.children('div.main').children('button').click()

    // Loop through all workspaces
    workspaces.forEach((workspace, currentIndex) => {
      // Define current workspace ID
      let workspaceID = workspace.id,
        // Get random IDs for actions buttons
        [
          enterBtnID,
          folderBtnID,
          settingsBtnID,
          deleteBtnID
        ] = getRandomID(15, 4),
        // Determine whether or not the workspace will be appended in the container UI, by default it's `true`
        append = true

      /**
       * Look for the workspace in the UI
       * If it exists then no need to append the workspace
       */
      if (event == 'refreshWorkspaces')
        append = $(`div.workspace[data-id="${workspaceID}"]`).length != 0 ? false : append

      // Determine if the current workspace is the docker/sandbox - one
      let isSandbox = workspace.id == 'workspace-sandbox',
        /**
         * Determine if the workspace folder is accessible or not by checking the `clusters` object
         * The value will be `undefined` if the app wasn't able to access the workspace folder and it's not the docker/sandbox workspace
         */
        inAccessible = workspace.clusters == undefined && !isSandbox,
        // Get the workspace's color in `R G B` format
        color = HEXToRGB(workspace.color).join(' '),
        // Set the background color for the `ENTER` button
        backgroundColor = TinyColor(workspace.color).isValid() ? `style="background: rgb(${color} / 70%); ` : ''

      // Determine if the color of the button needs to be black based on the lightening of the color
      backgroundColor += TinyColor(workspace.color).isLight() ? `color: #252525;"` : `"`

      // Workspace UI element structure
      let element = `
          <div class="workspace ${inAccessible ? 'inaccessible' : ''} ${isSandbox ? 'sandbox' : ''}" data-id="${workspaceID}" data-name="${workspace.name}" data-folder="${workspace.folder}" data-color="${workspace.color}"
            data-folder-path="${workspace.defaultPath ? 'default' : workspace.path}" style="box-shadow: inset 0px 0px 0 3px #161719, inset 0px 0px 0 4px rgb(${color} / 50%);">
            <ion-icon name="sandbox" ${!isSandbox ? 'hidden' : '' }></ion-icon>
            <div class="header">
              <div class="title">${workspace.name}</div>
              <div class="_clusters"></div>
            </div>
            <div class="footer">
              <div class="button">
                <button type="button" class="btn btn-primary btn-dark btn-sm" reference-id="${workspaceID}" button-id="${enterBtnID}" ${backgroundColor}>
                  <span mulang="enter"></span>
                </button>
              </div>
              <div class="actions ${isSandbox ? 'sandbox' : ''}">
                <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${workspaceID}" button-id="${folderBtnID}" action="folder" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Open the workspace folder"
                  data-mulang="open the workspace folder" capitalize-first>
                  <ion-icon name="folder-open"></ion-icon>
                </div>
                <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${workspaceID}" button-id="${settingsBtnID}" action="settings" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Workspace settings"
                  data-mulang="workspace settings" capitalize-first ${isSandbox ? 'hidden' : '' }>
                  <ion-icon name="cog"></ion-icon>
                </div>
                <div class="action btn btn-tertiary" data-mdb-ripple-color="dark" reference-id="${workspaceID}" button-id="${deleteBtnID}" action="delete" data-tippy="tooltip" data-mdb-placement="bottom" data-title="Delete workspace"
                  data-mulang="delete workspace" capitalize-first ${isSandbox ? 'hidden' : '' }>
                  <ion-icon name="trash"></ion-icon>
                </div>
              </div>
            </div>
            <div class="loading" style="background: rgb(${color} / 10%)">
              <lottie-player src="../assets/lottie/loading-clusters.json" background="transparent" autoplay loop speed="1.15"></lottie-player>
            </div>
          </div>`

      try {
        /**
         * Update the inaccessibility status of the workspace
         * This line will update the inaccessibility status of the already-added workspace
         */
        $(`div.workspace[data-id="${workspaceID}"]`).toggleClass('inaccessible', inAccessible)

        // If the current workspace won't be appended then skip this try-catch block
        if (!append)
          throw 0

        // Append the workspace to the container
        workspacesContainer.append($(element).show(function() {
          // Apply different actions once the UI element is created
          {
            // Fade in the element based on the index
            setTimeout(() => $(this).addClass(`show-${currentIndex + 1}`))

            // Make sure the non-visible lottie element is not playing in the background
            setTimeout(() => autoPlayStopLottieElement($(this).find('lottie-player')))

            // Enable tooltip for the actions buttons
            setTimeout(() => {
              ([folderBtnID, settingsBtnID, deleteBtnID]).forEach((btn) => {
                getElementMDBObject($(`div[button-id="${btn}"]`), 'Tooltip')
              })
            })

            // Add the clusters inside the workspace's list
            setTimeout(() => {
              // Point at the clusters container inside the workspace UI element
              let clustersList = $(this).find('div._clusters')

              // Get all clusters in the workspace
              Modules.Clusters.getClusters(workspaceID).then((clusters) => {
                // Loop through each cluster
                for (let cluster of clusters) {
                  // Set the cluster's host
                  let clusterHost = cluster.host.length > 20 ? `${cluster.host.slice(0, 20)}...` : cluster.host,
                    // The cluster UI element structure
                    element = `
                    <div class="_cluster" _cluster-id="${cluster.info.id}" data-tippy="tooltip" data-mdb-placement="bottom" data-title="${cluster.name}<br>${clusterHost}" data-mdb-html="true"></div>`

                  // Append cluster to the list
                  clustersList.append($(element).show(function() {
                    setTimeout(() => getElementMDBObject($(this), 'Tooltip'))

                    // Once the user clicks this mini-cluster element
                    $(this).click(function() {
                      // Make sure it's clickable - active and has workarea -
                      if (!$(this).hasClass('clickable'))
                        return

                      $(`div.body div.left div.content div.switch-clusters div.cluster[_cluster-id="${getAttributes($(this), '_cluster-id')}"] button`).click()
                    })
                  }))
                }
              })
            })
          }

          // Handle the `click` event for actions buttons
          setTimeout(() => {
            // Point at the workspace's UI element
            let workspaceElement = $(this)

            /**
             * Clicks the `ENTER` button
             * If `instant` is `true` then some transitions will not be applied
             */
            $(`button[button-id="${enterBtnID}"]`).on('click', function(_, instant = false) {
              // Immediately update the active workspace ID
              activeWorkspaceID = workspaceID

              /**
               * Update the title of action's tooltips
               * Start with the `add` button
               */
              {
                // Define the suitable key based on the type of the workspace
                let tooltipAddContent = activeWorkspaceID == 'workspace-sandbox' ? 'add project' : 'add cluster'

                // Update the tooltip's content
                tooltips.addClusterActionButton.setContent(I18next.capitalize(I18next.t(tooltipAddContent)))

                // Update related attributes
                $(tooltips.addClusterActionButton.reference).attr({
                  'data-mulang': tooltipAddContent,
                  'data-mdb-original-title': I18next.capitalize(I18next.t(tooltipAddContent))
                })
              }

              // Update the show/hide of cleaning Docker
              // TODO: Will be updated
              {
                // $('div.content div[content="clusters"] div.section-actions').toggleClass('sandbox', activeWorkspaceID == 'workspace-sandbox')
              }

              // Apply the same process on the `refresh` button
              {
                // Define the suitable key based on the type of the workspace
                let tooltipRefreshContent = activeWorkspaceID == 'workspace-sandbox' ? 'refresh projects' : 'refresh clusters'

                // Update the tooltip's content
                tooltips.refreshClusterActionButton.setContent(I18next.capitalize(I18next.t(tooltipRefreshContent)))

                // Update related attributes
                $(tooltips.refreshClusterActionButton.reference).attr({
                  'data-mulang': tooltipRefreshContent,
                  'data-mdb-original-title': I18next.capitalize(I18next.t(tooltipRefreshContent))
                })
              }

              // Apply the workspace's color on the UI
              setUIColor(getAttributes(workspaceElement, 'data-color'))

              // Toggle the class which handles docker empty state
              $('div.content div[content="clusters"] div.empty').toggleClass('for-sandbox', isSandbox)

              // Point at the workspace clusters' container
              let workspaceClusters = $(`div.clusters-container div.clusters[workspace-id="${workspaceID}"]`)

              try {
                // If the workspace clusters' container exists already - as it has been created - then show it and finish this `click` event
                if (workspaceClusters.length <= 0)
                  throw 0

                // Hide other containers rather than the current workspace clusters' container
                $('div.clusters-container div.clusters').hide()

                // Show the current workspace clusters' container
                workspaceClusters.show()

                // Get the number of clusters added to the clicked workspace
                let numOfClusters = $(`div.clusters div.cluster[data-id][data-workspace-id="${workspaceID}"]`).length,
                  // Point at the cluster's content container
                  clustersContent = $('div.body div.right div.content div[content="clusters"]')

                // Toggle the empty class based on the number of clusters
                clustersContent.toggleClass('empty', numOfClusters <= 0)

                // Make the transition instant
                clustersContent.addClass('instant')

                // Remove the instant transition; to make sure it'll be applied when it's required to
                setTimeout(() => clustersContent.removeClass('instant'))

                // Point at different UI elements
                let allContentElements = $('div.body div.right div.content div[content]'),
                  clustersContentElement = $(`div.body div.right div.content div[content="clusters"]`),
                  switchWorkspacesChildren = $(`div.body div.left div.content div.switch-workspaces div.workspace`),
                  workspaceSwitcher = $(`div.body div.left div.content div.switch-workspaces div.workspace[_workspace-id="${workspaceID}"]`)

                try {
                  // If the `instant` value is not `true` then skip this try-catch block
                  if (!instant || $('div.body div.right div.content div[content="workarea"]').is(':visible'))
                    throw 0

                  // Hide all content elements
                  allContentElements.hide()

                  // Show the workspace's clusters' content
                  clustersContentElement.show()

                  // Skip the upcoming code
                  return
                } catch (e) {}

                // Hide all content elements with fade out transition
                allContentElements.fadeOut(200)

                // After 150ms of clicking the button
                setTimeout(() => {
                  // Show the workspace's clusters' content with fade in transition
                  clustersContentElement.fadeIn(200).removeAttr('hidden')

                  // Remove the active attribute from all switchers
                  $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                  // Add it to the current workspace
                  workspaceSwitcher.attr('active', '')

                  try {
                    // If the current workspace's switcher is visible then skip this try-catch block
                    if (workspaceSwitcher.is(':visible'))
                      throw 0

                    // Reposition the switchers and make the workspace's one is the first one
                    workspaceSwitcher.insertAfter($(`div.switch-workspaces div.workspace[home]`))

                    // Make sure it's shown
                    workspaceSwitcher.show()

                    // Hide the last visible workspace's switcher
                    $(`div.switch-workspaces div.workspace`).filter(':visible').last().hide()
                  } catch (e) {}
                }, 150)

                // Skip the upcoming code
                return
              } catch (e) {}

              // Add loading class to the workspace UI element
              workspaceElement.addClass('loading')

              /**
               * If the workspace clusters' container does not exist - hasn't been created - then create one
               *
               * Workspace clusters container UI element structure
               */
              let element = `<div class="clusters" workspace-id="${workspaceID}"></div>`

              // Append the clusters' container for the workspace
              $(`div.body div.right div.content div[content="clusters"] div.clusters-container`).append($(element).hide(function() {
                // Hide containers and show the cluster's one after a while
                setTimeout(() => {
                  // Hide the the workspaces content UI element
                  $('div.body div.right div.content div[content="workspaces"]').hide()

                  // Hide other containers rather than the current clusters' container
                  $('div.clusters-container div.clusters').hide()

                  // Show the workspaces' clusters' content
                  $(`div.body div.right div.content div[content="clusters"]`).show().removeAttr('hidden')

                  // Show the clusters' container
                  $(this).show()
                }, 150)

                // Remove the loading class after a while
                setTimeout(() => workspaceElement.removeClass('loading'), 50)

                // Show a toast to the user about the possibility of seeing an authentication request when dealing with the sandbox projects
                try {
                  // If the current workspace is not the sandbox or the toast has already been shown then skip this try-catch block
                  if (!isSandbox || isSandboxDockerInfoShown)
                    throw 0

                  // Show the toast to the user
                  // showToast(I18next.capitalize(I18next.t('sandbox feature requires docker')), I18next.capitalizeFirstLetter(I18next.t('starting or stopping a sandbox project may prompt an authentication request due to its reliance on [code]docker[/code] and [code]docker-compose[/code]')) + '.')

                  // Update the global variable which tells if the info toast has been shown or not
                  isSandboxDockerInfoShown = true
                } catch (e) {}

                // Get the workspace's color
                let [r, g, b] = HEXToRGB(getAttributes(workspaceElement, 'data-color'))

                // Trigger the `getClusters` event for the current workspace
                $(document).trigger('getClusters', workspaceID)

                // Add the workspace to the workspaces' switcher in the left side
                try {
                  // Point at the workspace switch element in the switcher container
                  let workspaceSwitchElement = $(`div.body div.left div.content div.switch-workspaces div.workspace[_workspace-id="${workspaceID}"]`)

                  // If the workspace already exists in the switcher then skip this try-catch block and just activate it
                  if (workspaceSwitchElement.length != 0) {
                    // Deactivate all switchers
                    $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                    // Activate the current workspace
                    workspaceSwitchElement.attr('active', '')

                    // Skip the upcoming code
                    throw 0
                  }

                  // Point at the workspaces' switcher container
                  let workspaceSwitcher = $(`div.body div.left div.content div.switch-workspaces`),
                    // Get its current height
                    switcherCurrentHeight = workspaceSwitcher.outerHeight()

                  // Set the height in {n}px style; to make sure the animation applied on height will be smooth
                  workspaceSwitcher.css('height', `${switcherCurrentHeight}px`)

                  // By default there's no delay before applying a new height to the switcher
                  let delay = false

                  // If the workspaces' switchers' container is not shown yet
                  if (!workspaceSwitcher.hasClass('show')) {
                    // Show it
                    workspaceSwitcher.addClass('show')

                    // Apply some delay before applying the new height
                    delay = true
                  }

                  setTimeout(() => {
                    // Set the initial new height of the container
                    let newHeight = switcherCurrentHeight + 35,
                      // Set the maximum allowed height
                      newHeightAllowed = calcSwitchersAllowedHeight()

                    // Divide the height by two - as there are two switchers' containers -
                    newHeightAllowed = newHeightAllowed / 2

                    // Whether or not the container will be shown
                    let hideSwitcher = (newHeight >= newHeightAllowed) && (newHeightAllowed > 0)

                    // Toggle the `show` class based on the final value
                    workspaceSwitcher.toggleClass('show-more', hideSwitcher)

                    // Animate the height change
                    if (!hideSwitcher)
                      workspaceSwitcher.css('height', `${switcherCurrentHeight + 35}px`)

                    setTimeout(() => {
                      // The workspace switcher UI element structure
                      let element = `
                          <div class="workspace" _workspace-id="${workspaceID}" style="background:${getAttributes(workspaceElement, 'data-color')};" ${hideSwitcher ? 'hidden': ''}>
                            <button type="button" class="btn btn-tertiary" data-mdb-ripple-color="dark" data-tippy="tooltip" data-mdb-placement="right" data-title="${getAttributes(workspaceElement, 'data-name')}"></button>
                          </div>`

                      // Set the suitable adding function based on the state
                      let addingFunction = {
                        element: workspaceSwitcher,
                        method: 'append'
                      }

                      try {
                        // If the container is hidden then skip this try-catch block
                        if (!hideSwitcher)
                          throw 0

                        // As the container is shown, the new switcher will be right after the home button
                        addingFunction = {
                          element: workspaceSwitcher.children('div.workspace[home]'),
                          method: 'after'
                        }
                      } catch (e) {}

                      // Append the workspace switcher to the switch container
                      addingFunction.element[addingFunction.method]($(element).show(function() {
                        // Will hold the tooltip MDB object
                        let tooltip = null

                        try {
                          // If the container is hidden then skip this try-catch block
                          if (!hideSwitcher)
                            throw 0

                          // Show the new switcher
                          $(this).removeAttr('hidden')

                          // Hide the last visible switcher
                          workspaceSwitcher.children('div.workspace:not([home])').filter(':visible').last().hide()
                        } catch (e) {}

                        // Add the docker icon if the workspace is the sandbox
                        try {
                          // If the workspace is not the sandbox then skip this try-catch block
                          if (workspaceID != 'workspace-sandbox')
                            throw 0

                          // The icon's HTML structure
                          let icon = `<ion-icon name="sandbox"></ion-icon>`

                          setTimeout(() => {
                            // Append the icon
                            $(this).children('button').append($(icon).show(function() {
                              // Show the icon after a while
                              setTimeout(() => $(this).addClass('show'), 400)
                            }))
                          })
                        } catch (e) {}

                        setTimeout(() => {
                          // Get the MDB object of the workspace switcher tooltip
                          tooltip = getElementMDBObject($(this).children('button'), 'Tooltip')

                          // Show the switcher
                          $(this).addClass('show')

                          // Deactivate all switchers
                          $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                          // Activate the current switcher
                          $(this).attr('active', '')
                        }, 150)

                        setTimeout(() => {
                          // Clicks a switcher
                          $(this).children('button').click(function() {
                            // Point at the associated workspace UI element
                            let workspaceElement = $(`div[content="workspaces"] div.workspaces-container div.workspace[data-id="${workspaceID}"]`)

                            // Add log about this action
                            addLog(`Switch to the workspace ${getAttributes(workspaceElement, ['data-name', 'data-id'])} work area.`, 'action')

                            // Deactivate all workspaces and clusters inside the switchers
                            $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                            // Activate the clicked switcher
                            $(this).parent().attr('active', '')

                            // Hide the tooltip
                            tooltip.hide()

                            // Click the `ENTER` button of the workspace UI element
                            setTimeout(() => workspaceElement.find('div.footer div.button button').trigger('click', true))
                          })
                        })
                      }))
                    }, 200)
                  }, delay ? 500 : 10)
                } catch (e) {}

                // Apply the chosen language to different span elements in the created workspace clusters container
                setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang]')))
              }))
            })

            // Handle the `click` event of different buttons in the workspace UI element
            {
              // Get the MDB object of the workspace's dialog
              let dialogObject = getElementMDBObject($('div.modal#addEditWorkspaceDialog'), 'Modal')

              // Clicks the folder button
              $(`div.btn[button-id="${folderBtnID}"]`).click(() => {
                // Set the path to open based on whether or not the workspace is the docker/sandbox
                let path = !isSandbox ? getWorkspaceFolderPath(workspaceID) : Path.join(__dirname, '..', '..', 'data', 'docker')

                // Open the set path
                Open(path)
              })

              // Clicks the settings button
              $(`div.btn[button-id="${settingsBtnID}"]`).click(async () => {
                // Define a portion of the cluster's adding/editing dialog CSS selector
                let dialog = 'div.modal#addEditWorkspaceDialog',
                  // Define the workspace's name, color, and folder path
                  [
                    workspaceName,
                    workspaceColor,
                    workspaceFolderPath
                  ] = getAttributes(workspaceElement, ['data-name', 'data-color', 'data-folder-path'])

                // Change the dialog's title
                $(`${dialog}`).find('h5').text(`${I18next.capitalize(I18next.t('edit workspace'))} ${workspaceName}`)

                // Change the workspace's ID to the current one, and add the `edit` attribute to the dialog
                $(`${dialog}`).attr('data-edit-workspace-id', workspaceID)

                // Change the dialog's primary button's text, and enable it
                $(`button#addWorkspace`).text(I18next.t('update workspace'))
                $(`button#addWorkspace`).removeAttr('disabled')

                try {
                  // Point at the workspace's name input field
                  let workspaceNameElement = $('input#workspaceName'),
                    // Get its MDB object
                    workspaceNameObject = getElementMDBObject(workspaceNameElement)

                  // Change its value to the workspace's name
                  workspaceNameElement.val(workspaceName)

                  // Update its object
                  workspaceNameObject.update()
                  workspaceNameObject._deactivate()
                } catch (e) {}

                try {
                  // Point at the dialog's `Workspace Folder Path` input field's parent
                  let workspaceFolderPathElement = $('input#workspacePath'),
                    // Get its MDB object
                    workspaceFolderPathObject = getElementMDBObject(workspaceFolderPathElement)

                  // Change its value
                  workspaceFolderPathObject.val(workspaceFolderPath == 'default' ? '' : workspaceFolderPath)

                  // Update its state
                  workspaceFolderPathObject.update()
                  workspaceFolderPathObject._deactivate()
                } catch (e) {}

                try {
                  // Set the current workspace color and trigger the input event
                  $('input#workspaceColorHidden').val(workspaceColor).trigger('input')
                } catch (e) {}

                try {
                  // Open the dialog
                  dialogObject.show()
                } catch (e) {}
              })

              // Clicks the delete button
              $(`div.btn[button-id="${deleteBtnID}"]`).click(() => {
                // Add log about this deletion request
                addLog(`Request to delete workspace ${getAttributes(workspaceElement, ['data-name', 'data-id'])} work area.`, 'action')

                // Open the confirmation dialog and wait for the response
                openDialog(I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the workspace [b]$data[/b]? once you confirm, there is no undo', [getAttributes(workspaceElement, 'data-name')])) + '.', (response) => {
                  // If canceled, or not confirmed then skip the upcoming code
                  if (!response)
                    return

                  // Get all workspaces
                  Modules.Workspaces.getWorkspaces().then((workspaces) => {
                    // Get the current workspace by its ID
                    let workspace = workspaces.find((workspace) => workspace.id == workspaceID)

                    // If the workspace has cluster(s) then stop the deletion process
                    if (workspace.clusters != undefined && workspace.clusters.length != 0)
                      return showToast(I18next.capitalize(I18next.t('delete workspace')), I18next.capitalizeFirstLetter(I18next.replaceData('to delete a workspace, it must be empty and doesn\'t have any clusters in it, make sure to delete all clusters inside the workspace [b]$data[/b] before attempting to delete it again', [getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

                    // Request to delete the workspace, and wait for the result
                    Modules.Workspaces.deleteWorkspace(workspace, workspaces).then((result) => {
                      // Failed to delete the workspace
                      if (!result)
                        return showToast(I18next.capitalize(I18next.t('delete workspace')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to delete workspace [b]$data[/b]', [getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

                      // Successfully deleted
                      showToast(I18next.capitalize(I18next.t('delete workspace')), I18next.capitalizeFirstLetter(I18next.replaceData('workspace [b]$data[/b] has been successfully deleted', [getAttributes(workspaceElement, 'data-name')])) + '.', 'success')

                      // Remove the target workspace element
                      $(`div.workspace[data-id="${workspace.id}"]`).remove()

                      // Remove the workspace from the switcher
                      try {
                        // Point at the switchers' container
                        let switchersContainer = $(`div.body div.left div.content div.switch-workspaces`),
                          // Point at the workspace's switcher
                          workspaceSwitcher = switchersContainer.children(`div.workspace[_workspace-id="${workspaceID}"]`)

                        // If there's no switcher for the workspace then skip this try-catch block
                        if (workspaceSwitcher.length <= 0)
                          throw 0

                        // Remove the switcher
                        workspaceSwitcher.remove()

                        // Update the container's view
                        updateSwitcherView('workspaces')

                        // If there're no left switchers then hide the container
                        if (switchersContainer.children('div.workspace:not([home])').length <= 0)
                          switchersContainer.removeClass('show')
                      } catch (e) {}

                      // Refresh the workspaces' list
                      $(document).trigger('refreshWorkspaces')
                    })
                  })
                })
              })
            }
          })

          // Apply the chosen language to different span elements in the created workspace clusters container
          setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
        }))
      } catch (e) {}
    })
  })
})

// Events being listened to for the adding/editing workspace's dialog
{
  // Clicks the `ADD WORKSPACE` button which shows up if there are no added workspaces
  {
    $(`button#addWorkspaceProcess`).click(() => {
      // Define the dialog path's CSS selector
      let dialog = 'div.modal#addEditWorkspaceDialog'

      try {
        // If the previous mode wasn't `editing` a workspace then skip this try-catch block
        if (getAttributes($(`${dialog}`), 'data-edit-workspace-id') == undefined)
          throw 0

        // Reset everything and make sure the `creation mode` is properly back
        $(`${dialog}`).find('h5.modal-title').text(I18next.capitalize(I18next.t('add workspace')))
        $(`${dialog}`).removeAttr('data-edit-workspace-id')
        $(`${dialog} button#addWorkspace`).attr('disabled', 'disabled')
        $(`${dialog} button#addWorkspace`).text(I18next.t('add workspace'))

        // Define the inputs' IDs in the dialog and reset them
        let inputsIDs = ['workspaceName', 'workspaceColor', 'workspacePath']

        // Loop through each input ID
        inputsIDs.forEach((inputID) => {
          // Point at the input
          let input = $(`input#${inputID}`),
            // Get its MDB object
            inputObject = getElementMDBObject(input)

          // Remove its value and remove the `active` class
          input.val('').removeClass('active')

          // Update the MDB object
          inputObject.update()
          inputObject._deactivate()
        })

        // Clear the color picker's value and trigger the `input` event as a refresh
        $('input#workspaceColorHidden').val('').trigger('input')
      } catch (e) {}
    })
  }

  // Clicks the `ADD` and `REFRESH` buttons at the right bottom of the workspaces' list container
  {
    // Define the common CSS selector
    let selector = `div.body div.right div.content div[content="workspaces"] div.section-actions div.action`

    // Clicks the add button
    $(`${selector}[action="add"] button`).click(() => {
      // It'll click the `ADD WORKSPACE` button
      $(`button#addWorkspaceProcess`).click()
    })

    // Clicks the refresh button
    $(`${selector}[action="refresh"] button`).click(() => {
      // Trigger the workspaces' refresh event
      $(document).trigger('refreshWorkspaces')
    })
  }

  // The `input` event handler for the workspace's name
  {
    // Point at the save button
    let addWorkspaceBtn = $('button#addWorkspace')

    // When the `input` event is being triggered for the workspace name's input field
    {
      $(`input#workspaceName`).on('input', function() {
        /**
         * If the input's value is only whitespaces then disable the save button
         * Otherwise, enable the save button as the given name is so far acceptable
         */
        addWorkspaceBtn.attr('disabled', $(this).val().trim().length <= 0 ? 'disabled' : null)

        // Remove the `invalid` class
        $(this).parent().removeClass('mdc-text-field--invalid')
      })
    }

    // Clicks the `SAVE WORKSPACE` button
    {
      addWorkspaceBtn.click(async function() {
        // Define the dialog path's CSS selector
        let dialog = 'div.modal#addEditWorkspaceDialog',
          // Point at the dialog's different elements
          name = $(`input#workspaceName`),
          color = $(`input#workspaceColor`),
          folderPath = $(`input#workspacePath`),
          // Check if `editing` is the current mode
          editingMode = getAttributes($('#addEditWorkspaceDialog'), 'data-edit-workspace-id') != undefined

        // Check if a workspace folder path is passed
        let workspaceFolderPath = {
          defaultPath: true // By default, the workspace folder will be created in the app's default path
        }

        try {
          // Get the given path's value
          let path = folderPath.val()

          // Make sure it's not empty; because if it's then use the default path
          if (path.trim().length <= 0)
            throw 0

          // Test the path accessibility
          let accessible = pathIsAccessible(path)

          // If the path is inaccessible then stop the saving process
          if (!accessible)
            return showToast(I18next.capitalize(I18next.t('add workspace')), I18next.capitalizeFirstLetter(I18next.t('the selected path is inaccessible and can\'t be used, please make sure you have read/write permissions')) + '.', 'failure')

          // Set the result and the given path
          workspaceFolderPath = {
            defaultPath: false,
            path: path
          }
        } catch (e) {}

        try {
          // If the current mode is not `edit` then skip this try-catch block
          if (!editingMode)
            throw 0

          // Get the workspace's ID that is being edited
          let workspaceID = getAttributes($('#addEditWorkspaceDialog'), 'data-edit-workspace-id'),
            // Point at that workspace UI element in the list
            workspaceElement = $(`div.workspaces-container div.workspace[data-id="${workspaceID}"]`)

          /**
           * Check that the new name is not used
           *
           * Get all saved workspaces
           */
          let allWorkspaces = await Modules.Workspaces.getWorkspaces()

          // Check the existence of the new name and make sure to exclude the workspace which attempting to edit
          let nameExists = allWorkspaces.find((workspace) => manipulateText(workspace.name) == manipulateText(name.val()) && workspace.id != workspaceID)

          // If the name exists, or the name is invalid
          if (nameExists != undefined || name.val().trim().length <= 0) {
            // Add `invalid` class for the name input field
            name.parent().addClass('mdc-text-field--invalid')

            // Show feedback to the user
            showToast(I18next.capitalize(I18next.t('edit workspace')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid and unique name for the workspace')) + '.', 'failure')

            // Skip the upcoming code
            return
          }

          // Check if there is any active cluster - connected with - in the workspace
          let foundActiveCluster = false

          // Loop through all workspace's clusters
          $(`div.cluster[data-workspace-id="${workspaceID}"]`).each(function() {
            // Only one active cluster is needed to change the `foundActiveCluster` value
            if (getAttributes($(this), 'data-workarea') != 'false')
              foundActiveCluster = true
          })

          // If an active cluster has been found then end the process
          if (foundActiveCluster)
            return showToast(I18next.capitalize(I18next.t('edit workspace')), I18next.capitalizeFirstLetter(I18next.replaceData('one cluster or more in the workspace [b]$data[/b] are having an active workarea, please make sure to close the workarea before attempting to edit the workspace again', [getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

          // Attempt to Update the workspace
          Modules.Workspaces.updateWorkspace({
            name: name.val(),
            color: color.val(),
            originalFolder: getAttributes(workspaceElement, 'data-folder'),
            extra: workspaceFolderPath
          }).then((status) => {
            // Failed to update the workspace
            if (!status)
              return showToast(I18next.capitalize(I18next.t('edit workspace')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update workspace [b]$data[/b]', [getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

            // Show feedback to the user about the success of the update process
            showToast(I18next.capitalize(I18next.t('edit workspace')), I18next.capitalizeFirstLetter(I18next.replaceData('workspace [b]$data[/b] has been successfully updated', [getAttributes(workspaceElement, 'data-name')])) + '.', 'success')

            // Click the close button
            $(`${dialog}`).find('button.btn-close').click()

            // Update the workspace's attributes
            workspaceElement.attr({
              'data-name': name.val(),
              'data-folder': Sanitize(name.val()),
              'data-color': color.val(),
              'data-folder-path': folderPath.val().trim().length != 0 ? folderPath.val() : 'default'
            })

            // Update the workspace's name
            workspaceElement.find('div.title').text(name.val())

            // Get the workspace's new color in `R G B` format
            let colorRGB = HEXToRGB(color.val()).join(' '),
              // Set the background color for the `ENTER` button
              backgroundColor = TinyColor(color.val()).isValid() ? `rgb(${colorRGB} / 70%)` : '',
              // Determine if the color of the button needs to be black based on the lightening of the color
              textColor = TinyColor(color.val()).isLight() ? `#252525` : ''

            // Update the box-shadow of the workspace element
            workspaceElement.css('box-shadow', `inset 0px 0px 0 3px #161719, inset 0px 0px 0 4px rgb(${colorRGB} / 50%)`)

            // Update the loading's background color
            workspaceElement.find('div.loading').css('background', `rgb(${colorRGB} / 10%)`)

            // Update the workspace switcher's background color
            try {
              let workspaceSwitcher = $(`div.body div.left div.content div.switch-workspaces div.workspace[_workspace-id="${getAttributes(workspaceElement, 'data-id')}"]`)

              workspaceSwitcher.css('background', color.val())

              let tooltip = getElementMDBObject(workspaceSwitcher.children('button'), 'Tooltip')

              tooltip.setContent(getAttributes(workspaceElement, 'data-name'))
            } catch (e) {}

            // Update the `ENTER` button's background and text colors
            workspaceElement.find('div.button button').css({
              'background': `${backgroundColor}`,
              'color': `${textColor}`
            })

            // Refresh the workspaces' list in the UI
            $(document).trigger('refreshWorkspaces')
          })

          // Skip the upcoming code as the current mode is `edit`
          return
        } catch (e) {}

        /**
         * Reaching here means the workspace should be saved
         *
         * Check the given name
         */
        try {
          // If the provided name is valid then skip this try-catch block
          if (name.val().trim().length > 0)
            throw 0

          // It's an invalid name, add an `invalid` class for the name input field
          name.parent().addClass('mdc-text-field--invalid')

          // Show feedback to the user
          showToast(I18next.capitalize(I18next.t('add workspace')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid and unique name for the workspace')) + '.', 'failure')

          // Skip the upcoming code
          return
        } catch (e) {}

        // The given name is valid, attempt to save the workspace
        Modules.Workspaces.saveWorkspace({
          id: `workspace-${getRandomID(10)}`,
          name: name.val(),
          color: color.val(),
          ...workspaceFolderPath
        }).then((status) => {
          /**
           * Status values:
           * [1: Success, 0: Failed (many possible reasons), -1: Failed (Due to duplication in the name)]
           *
           * Define the toast's text and type
           */
          let toastText, toastType

          // Switch between status values
          switch (status) {
            case 1: {
              toastText = 'the workspace [b]$data[/b] has been successfully added'
              toastType = 'success'

              $(document).trigger('refreshWorkspaces')

              // Click the close button
              $(`${dialog}`).find('button.btn-close').click()
              break
            }
            case 0: {
              toastText = 'something went wrong, failed to add workspace [b]$data[/b]'
              toastType = 'failure'
              break
            }
            case -1: {
              toastText = 'to add a new workspace, a unique name must be provided, please choose another name rather than [b]$data[/b] for the workspace'
              toastType = 'failure'
              break
            }
          }

          // Show the toast with the final text and type
          showToast(I18next.capitalize(I18next.t('add workspace')), I18next.capitalizeFirstLetter(I18next.replaceData(toastText, [name.val()])) + '.', toastType)
        })
      })
    }
  }

  // The `click` event listener for the color preview element and its related elements
  {
    // Point at the UI element
    let colorElement = $('input#workspaceColor')

    // On the `click` event, look for the actual color picker button and click it
    colorElement.on('focus', () => $('input#workspaceColorHidden').click())

    // Get the color input field MDB object
    let colorElementObject = getElementMDBObject(colorElement)

    // When there's a new picked color
    $('input#workspaceColorHidden').on('input', (e) => {
      // Update the color input field's value
      colorElement.val($(e.target).val())
      colorElementObject.update()
      colorElementObject._deactivate()

      // Change the color preview element's background color
      $('div.preview-color').css('background', $(e.target).val())
    })
  }

  // Clicks on the default path button
  {
    // It'll empty the path input field
    $('div.btn[data-action="defaultPath"][data-reference="workspace"]').click(() => $('#workspacePath').val('').removeClass('active'))
  }
}

// Clicks the `home` button in the workspaces' switcher
{
  // Point at the button in the UI
  let homeBtn = $('div.body div.left div.content div.switch-workspaces div.workspace[home]'),
    // Get its tooltip MDB object
    tooltip = getElementMDBObject(homeBtn.children('button'), 'Tooltip')

  // Clicks the home button
  homeBtn.click(() => {
    // Define a portion of a common CSS selector
    let selector = `div.body div.right div.content div`

    // Remove the UI color as there's no active workspace now
    $(`style#uicolor`).remove()

    // Hide all contents' containers
    $(`${selector}[content]`).hide()

    // Show the workspaces' container
    $(`${selector}[content="workspaces"]`).show()

    // Hide the tooltip instead of letting it stick
    tooltip.hide()

    // Update the portion of a common CSS selector
    selector = `div.body div.left div.content`

    // Deactivate all workspaces and clusters in both switchers
    $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')
  })
}

// Handle the workspace' witcher's navigation arrows - up and down -
{
  $(`div.body div.left div.content div.switch-workspaces div.more-workspaces div.buttons button`).click(function() {
    // Get the clicked button's navigation
    let navigation = $(this).attr('navigation'),
      // Point at the switchers' container
      switchersContainer = $(`div.body div.left div.content div.switch-workspaces`),
      // Get all currently visible switchers
      visibleSwitchers = switchersContainer.children('div.workspace:not([home])').filter(':visible')

    // Remove `hidden` attribute from all switchers; as they'll be shown or hidden as needed
    switchersContainer.children('div.workspace:not([home])').removeAttr('hidden')

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
  })
}
