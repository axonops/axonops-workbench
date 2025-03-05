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
 * Events of Getting/Refreshing all workspaces
 *
 * `getWorkspaces` event will remove all workspaces in the UI, and retrieve them from the workspaces' folder or the specific location of each one of them
 * `refreshWorkspaces` event, on the other hand, will keep the current workspaces in the UI, update them as needed, and just add the ones that are not in the UI already
 */
let isContentInfoHandledFirstTime = false

$(document).on('getWorkspaces refreshWorkspaces', function(e) {
  const event = e.type, // To determine if the event is `getWorkspaces` or `refreshWorkspaces`
    // Point at the workspaces container element
    workspacesContainer = $('div.body div.right div.content div[content="workspaces"] div.workspaces-container')

  // Get the app's config
  Modules.Config.getConfig((config) => {
    // Check the status of whether or not the sandbox projects feature is enabled
    isSandboxProjectsEnabled = config.get('features', 'sandboxProjects') == 'true'

    // Get all saved workspaces
    Modules.Workspaces.getWorkspaces().then(async (workspaces) => {
      // Clean the container if the event is `get` workspaces
      if (event == 'getWorkspaces')
        workspacesContainer.html('')

      // Get all saved docker projects
      let dockerProjects = isSandboxProjectsEnabled ? await Modules.Docker.getProjects() : []

      // Add or remove the empty class based on the number of saved workspaces
      workspacesContainer.parent().toggleClass('empty', workspaces.length <= 0 && dockerProjects.length <= 0)

      $('div.body div.right').toggleClass('hide-content-info', workspaces.length <= 0 && dockerProjects.length <= 0)

      if (!isContentInfoHandledFirstTime && !(workspaces.length <= 0 && dockerProjects.length <= 0)) {
        isContentInfoHandledFirstTime = true
        handleContentInfo('workspaces')
      }

      // Add the docker/sandbox element
      try {
        if (!isSandboxProjectsEnabled)
          throw 0

        workspaces.unshift({
          id: 'workspace-sandbox',
          defaultPath: true,
          folder: 'localclusters',
          name: 'Local Clusters',
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
                  <div class="title workspace-name">${isSandbox ? '<span mulang="local clusters" capitalize></span>' : workspace.name}</div>
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
                  <l-line-wobble class="ldr" size="100" stroke="5" bg-opacity="0.25" speed="1.3"  color="${workspace.color}"></l-line-wobble>
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
                  let tooltipAddContent = activeWorkspaceID == 'workspace-sandbox' ? 'add local cluster' : 'add connection'

                  // Update the tooltip's content
                  tooltips.addClusterActionButton.setContent(I18next.capitalize(I18next.t(tooltipAddContent)))

                  // Update related attributes
                  $(tooltips.addClusterActionButton.reference).attr({
                    'data-mulang': tooltipAddContent,
                    'data-mdb-original-title': I18next.capitalize(I18next.t(tooltipAddContent))
                  })
                }

                {
                  $('span[no-clusters-message]').html(I18next.capitalizeFirstLetter(I18next.replaceData($('span[no-clusters-message]').attr('mulang'), [getAttributes(workspaceElement, 'data-name')])))
                }

                // Apply the same process on the `refresh` button
                {
                  // Define the suitable key based on the type of the workspace
                  let tooltipRefreshContent = activeWorkspaceID == 'workspace-sandbox' ? 'refresh local clusters' : 'refresh clusters'

                  // Update the tooltip's content
                  tooltips.refreshClusterActionButton.setContent(I18next.capitalize(I18next.t(tooltipRefreshContent)))

                  // Update related attributes
                  $(tooltips.refreshClusterActionButton.reference).attr({
                    'data-mulang': tooltipRefreshContent,
                    'data-mdb-original-title': I18next.capitalize(I18next.t(tooltipRefreshContent))
                  })
                }

                {
                  let actionsButtonsContainer = $('div.body div.right div.content-info div._right div._actions._for-clusters'),
                    isLocalClustersWorkspace = workspaceID == 'workspace-sandbox'

                  actionsButtonsContainer.find('div.action[action="add"]').find('span[mulang]').attr('mulang', isLocalClustersWorkspace ? 'add cluster' : 'add connection')
                  actionsButtonsContainer.find('div.action[action="refresh"]').find('span[mulang]').attr('mulang', isLocalClustersWorkspace ? 'refresh clusters' : 'refresh connections')

                  Modules.Localization.applyLanguageSpecific(actionsButtonsContainer.find('span[mulang]'))
                }

                // Apply the workspace's color on the UI
                setUIColor(getAttributes(workspaceElement, 'data-color'))

                setTimeout(() => handleContentInfo('clusters', workspaceElement), 250)

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
                  allContentElements.fadeOut(50)

                  // After 150ms of clicking the button
                  setTimeout(() => {
                    // Show the workspace's clusters' content with fade in transition
                    clustersContentElement.fadeIn(50).removeAttr('hidden')

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
                  })

                  // Remove the loading class after a while
                  setTimeout(() => workspaceElement.removeClass('loading'))

                  // Show a toast to the user about the possibility of seeing an authentication request when dealing with the sandbox projects
                  try {
                    // If the current workspace is not the sandbox or the toast has already been shown then skip this try-catch block
                    if (!isSandbox || isSandboxDockerInfoShown)
                      throw 0

                    // Update the global variable which tells if the info toast has been shown or not
                    isSandboxDockerInfoShown = true
                  } catch (e) {}

                  // Get the workspace's color
                  let [r, g, b] = HEXToRGB(getAttributes(workspaceElement, 'data-color'))

                  // Trigger the `getClusters` event for the current workspace
                  $(document).trigger('getClusters', {
                    workspaceID,
                    containersManagementTool: config.get('features', 'containersManagementTool') || 'none'
                  })

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
                        } catch (e) {
                          try {
                            errorLog(e, 'workspaces')
                          } catch (e) {}
                        }

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
                              try {
                                addLog(`Switch to the work area of workspace '${getAttributes(workspaceElement, ['data-name', 'data-id'])}'`, 'action')
                              } catch (e) {}

                              // Deactivate all workspaces and clusters inside the switchers
                              $(`div.body div.left div.content div[class*=switch-] div`).removeAttr('active')

                              // Activate the clicked switcher
                              $(this).parent().attr('active', '')

                              // Hide the tooltip
                              tooltip.hide()

                              // Click the `ENTER` button of the workspace UI element
                              setTimeout(() => workspaceElement.find('div.footer div.button button').trigger('click', true))

                              handleContentInfo('clusters', workspaceElement)
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
                  let path = !isSandbox ? getWorkspaceFolderPath(workspaceID) : Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'localclusters')

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
                  $(`${dialog}`).find('h5').text(`${I18next.capitalize(I18next.t('workspace settings'))} ${workspaceName}`)

                  // Change the workspace's ID to the current one, and add the `edit` attribute to the dialog
                  $(`${dialog}`).attr('data-edit-workspace-id', workspaceID)

                  // Change the dialog's primary button's text, and enable it
                  $(`button#addWorkspace`).text(I18next.t('update workspace'))
                  $(`button#addWorkspace`).removeAttr('disabled')

                  // $('input#workspaceName').parent().toggle(workspaceID != 'workspace-sandbox')

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
                      workspaceFolderPathObject = getElementMDBObject(workspaceFolderPathElement),
                      clickableArea = $('div.clickable[for-input="workspacePath"]'),
                      clickableAreaTooltip = getElementMDBObject(clickableArea, 'Tooltip'),
                      workspaceSetPath = workspaceFolderPath == 'default' ? workspaceFolderPathElement.attr('data-default-path') : workspaceFolderPath


                    clickableAreaTooltip.setContent(workspaceSetPath)


                    // Change its value
                    workspaceFolderPathElement.val(workspaceSetPath)

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
                  try {
                    addLog(`Request to delete the workspace '${workspaceID}'`, 'action')
                  } catch (e) {}

                  // Open the confirmation dialog and wait for the response
                  openDialog(I18next.capitalizeFirstLetter(I18next.replaceData('do you want to entirely delete the workspace [b]$data[/b]? once you confirm, there is no undo', [getAttributes(workspaceElement, 'data-name')])) + '.', (response) => {
                    // If canceled, or not confirmed then skip the upcoming code
                    if (!response.confirmed)
                      return

                    Modules.Clusters.getClusters(workspaceID).then(async function(clusters) {
                      for (let cluster of clusters) {
                        let clusterElement = $(`div.body div.right div.content div[content="clusters"] div.clusters-container div.clusters[workspace-id="${workspaceID}"] div.cluster[data-id="${cluster.info.id}"`)

                        if (clusterElement.length <= 0)
                          continue

                        let clusterWorkarea = $(`div[content="workarea"] div.workarea[cluster-id="${getAttributes(clusterElement, 'data-id')}"]`)

                        if (clusterWorkarea.length <= 0)
                          continue

                        showToast(I18next.capitalize(I18next.t('delete connection')), I18next.capitalizeFirstLetter(I18next.replaceData('this connection [b]$data[/b] has an active work area, make sure to close its work area before attempting to delete the workspace [b]$data[/b]', [getAttributes(clusterElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

                        return
                      }

                      // Get all workspaces
                      Modules.Workspaces.getWorkspaces().then((workspaces) => {
                        // Get the current workspace by its ID
                        let workspace = workspaces.find((workspace) => workspace.id == workspaceID)

                        Modules.Workspaces.deleteWorkspace(workspace, workspaces, response.checked).then((result) => {
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
                  }, false, 'keep the associated files in the system')
                })
              }
            })

            // Apply the chosen language to different span elements in the created workspace clusters container
            setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
          }))
        } catch (e) {
          try {
            errorLog(e, 'workspaces')
          } catch (e) {}
        }
      })
    })
  })
})

// Events being listened to for the adding/editing workspace's dialog
{
  // Clicks the `ADD WORKSPACE` button which shows up if there are no added workspaces
  {
    $(`button#addWorkspaceProcess`).click(() => {
      // Define the dialog path's CSS selector
      let dialog = 'div.modal#addEditWorkspaceDialog',
        // Point at the color's input field
        colorInput = $('input#workspaceColorHidden')

      try {
        // If the previous mode wasn't `editing` a workspace then skip this try-catch block
        if (getAttributes($(`${dialog}`), 'data-edit-workspace-id') == undefined)
          throw 0

        // Reset everything and make sure the `creation mode` is properly back
        $(`${dialog}`).find('h5.modal-title').text(I18next.capitalize(I18next.t('add workspace')))
        $(`${dialog}`).removeAttr('data-edit-workspace-id')
        $(`${dialog} button#addWorkspace`).attr('disabled', 'disabled')
        $(`${dialog} button#addWorkspace`).text(I18next.t('add workspace'))

        // $('input#workspaceName').parent().show()

        // Define the inputs' IDs in the dialog and reset them
        let inputsIDs = ['workspaceName', 'workspaceColor', 'workspacePath']

        // Loop through each input ID
        inputsIDs.forEach((inputID) => {
          // Point at the input
          let input = $(`input#${inputID}`),
            // Get its MDB object
            inputObject = getElementMDBObject(input)

          try {
            if (inputID != 'workspacePath')
              throw 0

            $('div.btn[data-action="defaultPath"][data-reference="workspace"]').click()
          } catch (e) {
            // Remove its value and remove the `active` class
            input.val('').removeClass('active')
          }

          // Update the MDB object
          inputObject.update()
          inputObject._deactivate()
        })

        // Clear the color picker's value and trigger the `input` event as a refresh
        colorInput.val('').trigger('input')
      } catch (e) {}

      // Set a random color of the workspace each time the `ADD` dialog is opened
      try {
        colorInput.val(getRandomColor()).trigger('input')
      } catch (e) {}
    })
  }

  // Clicks the `ADD`, `IMPORT` and `REFRESH` buttons at the right bottom of the workspaces' list container
  {
    // Define the common CSS selector
    let selector = `div.body div.right div.content div[content="workspaces"] div.section-actions div.action`,
      // Point at the import process' dialog
      importWorkspacesDialog = getElementMDBObject($('#importWorkspaces'), 'Modal')

    // Clicks the add button
    $(`${selector}[action="add"] button`).click(() => {
      // It'll click the `ADD WORKSPACE` button
      $(`button#addWorkspaceProcess`).click()

      // Remove the `show` class of the actions section; to hide the actions buttons
      $(`${selector}`).parent().removeClass('show')
    })

    // Clicks the import button
    $(`${selector}[action="import"] button`).click(() => {
      importWorkspacesDialog.show()

      // Remove the `show` class of the actions section; to hide the actions buttons
      $(`${selector}`).parent().removeClass('show')
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
          if (path.trim().length <= 0 || path == folderPath.attr('data-default-path'))
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
          if (nameExists != undefined || name.val().trim().length <= 0 || Sanitize(minifyText(name.val())).length <= 0) {
            // Add `invalid` class for the name input field
            name.parent().addClass('mdc-text-field--invalid')

            // Show feedback to the user
            showToast(I18next.capitalize(I18next.t('workspace settings')), I18next.capitalizeFirstLetter(I18next.t('please provide a valid and unique name for the workspace')) + '.', 'failure')

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
            return showToast(I18next.capitalize(I18next.t('workspace settings')), I18next.capitalizeFirstLetter(I18next.replaceData('one connection or more in the workspace [b]$data[/b] is open, please make sure to close the connections before attempting to edit the workspace', [getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

          // Attempt to Update the workspace
          Modules.Workspaces.updateWorkspace({
            name: name.val(),
            color: color.val(),
            originalFolder: getAttributes(workspaceElement, 'data-folder'),
            extra: workspaceFolderPath
          }).then((status) => {
            // Failed to update the workspace
            if (!status)
              return showToast(I18next.capitalize(I18next.t('workspace settings')), I18next.capitalizeFirstLetter(I18next.replaceData('something went wrong, failed to update workspace [b]$data[/b]', [getAttributes(workspaceElement, 'data-name')])) + '.', 'failure')

            // Show feedback to the user about the success of the update process
            showToast(I18next.capitalize(I18next.t('workspace settings')), I18next.capitalizeFirstLetter(I18next.replaceData('workspace [b]$data[/b] has been successfully updated', [getAttributes(workspaceElement, 'data-name')])) + '.', 'success')

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
          if (name.val().trim().length > 0 && Sanitize(name.val()).length > 0)
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

          // Make sure all fields are cleared on a successful save
          try {
            // If the saving process wasn't successful then skip this try-catch block
            if (status != 1)
              throw 0

            setTimeout(() => {
              // Define the inputs' IDs in the dialog and reset them
              let inputsIDs = ['workspaceName', 'workspaceColor', 'workspacePath']

              // Loop through each input ID
              inputsIDs.forEach((inputID) => {
                // Point at the input
                let input = $(`input#${inputID}`),
                  // Get its MDB object
                  inputObject = getElementMDBObject(input)

                try {
                  if (inputID != 'workspacePath')
                    throw 0

                  $('div.btn[data-action="defaultPath"][data-reference="workspace"]').click()
                } catch (e) {
                  // Remove its value and remove the `active` class
                  input.val('').removeClass('active')
                }

                // Update the MDB object
                inputObject.update()
                inputObject._deactivate()
              })

              // Clear the color picker's value and trigger the `input` event as a refresh
              $('input#workspaceColorHidden').val('').trigger('input')
            }, 1000)
          } catch (e) {}
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
    $('div.btn[data-action="defaultPath"][data-reference="workspace"]').click(() => {
      $('#workspacePath').val($('#workspacePath').attr('data-default-path'))

      $('#workspacePath').trigger('inputChanged')

      getElementMDBObject($('#workspacePath')).update()
    })
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

    handleContentInfo('workspaces')
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

// Observe addition/removal of workspaces' switchers
{
  // Point at the workspaces' switchers' container
  let switchersContainer = $(`div.body div.left div.content div.switch-workspaces`),
    // Create observer object
    observer = new MutationObserver(function(mutations) {
      // Loop through each detected mutation
      mutations.forEach(function(mutation) {
        /**
         * If the mutation is an appended/removed child
         * Update the switchers' container's view
         */
        if (mutation.type === 'childList')
          setTimeout(() => updateSwitcherView('workspaces'), 100)
      })
    })

  // Start the observation process
  observer.observe(switchersContainer[0], {
    childList: true
  })
}

{
  let workspacePathElement = $('#workspacePath'),
    clickableArea = $('div.clickable[for-input="workspacePath"]'),
    clickableAreaTooltip = getElementMDBObject(clickableArea, 'Tooltip'),
    defaultPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces')

  workspacePathElement.attr('data-default-path', defaultPath)

  workspacePathElement.val(defaultPath)

  clickableAreaTooltip.props.delay = 250

  clickableAreaTooltip.setContent(defaultPath)

  workspacePathElement.on('inputChanged', () => clickableAreaTooltip.setContent(workspacePathElement.val()))
}

// Handle the importing process of workspaces
{
  // Point at the drag and drop workspaces element
  let dragDropWorkspaces = $('div.modal-section div.drag-drop-workspaces')

  /**
   * Users can also click the element instead of drop folders
   *
   * Handle the click event
   */
  dragDropWorkspaces.click(function() {
    // Get a random ID for the dialog request
    let requestID = getRandomID(10),
      // Set other attributes to be used to create the dialog
      data = {
        id: requestID,
        title: I18next.capitalizeFirstLetter(I18next.t('select workspaces to be imported')),
        properties: ['openFile', 'openDirectory', 'multiSelections', 'showHiddenFiles']
      }

    // Send a request to the main thread to create a dialog
    IPCRenderer.send('dialog:create', data)

    // Listen for the response - folders' paths - and call the check workspaces inner function
    IPCRenderer.on(`dialog:${requestID}`, (_, foldersPaths) => checkWorkspaces(foldersPaths))
  })

  // Handle the drag and drop events
  {
    // When the dragging process starts
    dragDropWorkspaces.on('dragstart dragover dragenter', function(e) {
      // Prevent the default behavior
      e.originalEvent.preventDefault()

      // Show to the user in the UI that the dragging process is detected
      dragDropWorkspaces.addClass('drag')
    })

    // When the dragging process ends
    dragDropWorkspaces.on('dragend dragleave', function(e) {
      // Prevent the default behavior
      e.originalEvent.preventDefault()

      // Show to the user in the UI that the dragging process has been detected as `finished`
      dragDropWorkspaces.removeClass('drag')
    })

    // Handle items - files and folders - dropping process
    dragDropWorkspaces.on('drop', function(e) {
      // Prevent the default behavior
      e.originalEvent.preventDefault()

      // Show to the user in the UI that the dragging process has been detected as `finished`
      dragDropWorkspaces.removeClass('drag')

      try {
        // Get all selected folders' paths
        let foldersPaths = [...e.originalEvent.dataTransfer.files].map((file) => file.path || '').filter((file) => `${file}`.length != 0)

        // Call the check workspaces inner function
        checkWorkspaces(foldersPaths)
      } catch (e) {}
    })
  }

  let checkWorkspaces = async (foldersPaths) => {
    // If the given array has no items - paths - then show feedback to the user and end the process
    if (foldersPaths.length <= 0)
      return showToast(I18next.capitalize(I18next.t('import workspaces')), I18next.capitalizeFirstLetter(I18next.t('please consider to select the folders of the workspace')) + '.', 'failure')

    // The final workspaces to be handled
    let workspaces = []

    // Loop through each given folder's path
    for (let folderPath of foldersPaths) {
      // Get the path's base name - the name of the last folder/file -
      let baseName = Path.basename(folderPath)

      try {
        // If the given path is inaccessible then skip this try-catch block
        if (!pathIsAccessible(folderPath))
          throw 0

        // Flag to tell whether or not the given path is directory
        let isPathDirectory = await FS.lstatSync(folderPath)

        // If not then skip this try-catch block
        if (!isPathDirectory)
          throw 0

        // Read the directory's items
        let content = await FS.readdirSync(folderPath),
          // The given directory is actually a workspace's directory if `clusters.json` file has been found
          isValidWorkspace = content.some((item) => item == 'connections.json')

        // If the given directory is not a valid workspace then ignore it and skip this try-catch block
        if (!isValidWorkspace)
          throw 0

        // Push info regards the current workspace to the `workspaces` array
        workspaces.push({
          name: baseName,
          folder: baseName,
          path: folderPath
        })
      } catch (e) {}
    }

    // If after the looping process no valid workspace has benn found then show feedback to the user and end the process
    if (workspaces.length <= 0)
      return showToast(I18next.capitalize(I18next.t('import workspaces')), I18next.capitalizeFirstLetter(I18next.t('no valid workspace folder has been found among the provided ones')) + '.', 'failure')

    // Point at the table's of the detection workspaces and their clusters
    let table = $('#importWorkspacesValidate'),
      // Get all saved workspaces
      savedWorkspaces = await Modules.Workspaces.getWorkspaces()

    // Clean the table
    table.children('tbody').html('')

    // Loop through each valid detected workspace
    workspaces.forEach((workspace, workspaceIndex) => {
      // Define different IDs for different elements
      let [
        importWorkspacesCheckboxInputID,
        importClustersCheckboxInputID,
        workspaceNameInputID,
        workspaceColorInputID,
        workspaceChecksID,
        workspaceClustersBtnID,
        workspaceClustersListID
      ] = getRandomID(10, 7),
        // Get a random color for the workspace
        workspaceColor = getRandomColor(),
        // Workspace UI element structure
        element = `
        <tr data-id="${workspaceIndex}" data-clusters-path="${workspace.path}">
          <td>
            <input type="checkbox" id="_${importWorkspacesCheckboxInputID}" class="form-check-input for-import-workspaces" checked="true" />
          </td>
          <td>
            <div class="form-outline form-white label-top">
              <input type="text" id="_${workspaceNameInputID}" style="margin-bottom:0px;" class="form-control form-icon-trailing form-control-lg workspace-name" value="${workspace.name}">
            </div>
          </td>
          <td>
            <div class="form-outline for-coloris">
              <input type="text" id="_${workspaceColorInputID}" class="coloris form-control form-icon-trailing form-control-lg workspace-color" value="${workspaceColor}" data-coloris>
              <div class="color-preview" style="background:${workspaceColor}"></div>
            </div>
          </td>
          <td class="checks" data-id="_${workspaceChecksID}">
            <l-line-wobble size="50" stroke="2" bg-opacity="0.25" speed="1.25" color="#e3e3e3"></l-line-wobble>
            <span class="badge rounded-pill badge-warning" check="variables" style="display:none"><span mulang="missing variables" capitalize></span></span>
            <span class="badge rounded-pill badge-danger" check="name" style="display:none"><span mulang="duplicate name" capitalize></span></span>
            <span class="badge rounded-pill badge-success" check="passed" style="display:none"><span mulang="passed" capitalize></span></span>
          </td>
          <td style="text-align: center;">
            <button type="button" id="_${workspaceClustersBtnID}" class="btn btn-sm clusters-list btn-dark disabled" data-mdb-ripple-init>
              <span class="badge badge-primary clusters-count">0</span>
              <ion-icon name="dash"></ion-icon>
            </button>
          </td>
        </tr>`

      // Append the workspace
      table.children('tbody').append($(element).show(function() {
        // Actions to be performed as the element has been created
        setTimeout(() => {
          try {
            $(`tr[data-id="${workspaceIndex}"]`).find('input[type="text"]:not(.coloris)').each(function() {
              getElementMDBObject($(this))
            })
          } catch (e) {}

          // When the workspace's color changes
          $(`input#_${workspaceColorInputID}`).on('input', function(e) {
            // Update the preview
            $(`tr[data-id="${workspaceIndex}"]`).find('div.color-preview').css('background', $(this).val())
          })

          // When the checkbox status changes
          $(`input#_${importWorkspacesCheckboxInputID}`).change(function() {
            let allRelatedCheckboxes = [...$('input.for-import-workspaces[type="checkbox"], input.for-import-clusters[type="checkbox"]')]

            try {
              $('#importWorkspacesCheckbox').prop('checked', (allRelatedCheckboxes.every((checkbox) => $(checkbox).prop('checked'))))
            } catch (e) {}

            $(`input#_${importClustersCheckboxInputID}`).prop('checked', $(this).prop('checked')).trigger('change')
          })

          // When clicks the button to show/hide clusters
          $(`button#_${workspaceClustersBtnID}`).click(function() {
            // Whether or not clusters are shown already
            let areClustersShown = $(this).hasClass('shown')

            // Toggle the list based on the status
            $(`div#_${workspaceClustersListID}`).slideToggle(areClustersShown)

            // Toggle the arrow's direction based on the new status
            $(this).toggleClass('shown', !areClustersShown)
          })

          $(`input#_${workspaceNameInputID}`).on('input', function() {
            healthChecks(workspace, workspaceIndex, savedWorkspaces, workspaceChecksID, importWorkspacesCheckboxInputID, $(this))
          })
        })

        // Handle the workspace's clusters
        setTimeout(() => {
          try {
            // Attempt to get the workspace's clusters' manifest
            let clusters = FS.readFileSync(Path.join(workspace.path, 'connections.json'), 'utf8')

            // Convert the manifest to a JSON object
            clusters = JSON.parse(clusters)

            // If no clusters have been found then skip this try-catch block
            if (clusters.length <= 0)
              throw 0

            // Add clusters to the `workspace` object
            workspace.clusters = clusters

            // Update the cluster's list button
            setTimeout(() => {
              // Enable it
              $(`button#_${workspaceClustersBtnID}`).removeClass('disabled')

              // Change the icon to be arrow instead of dash
              $(`button#_${workspaceClustersBtnID}`).find('ion-icon').attr('name', 'arrow-up')

              // Set the clusters' count
              $(`button#_${workspaceClustersBtnID}`).children('span.clusters-count').text(clusters.length)
            }, 100)

            // Clusters UI element structure
            let element = `
                <tr for-workspace-id="${workspaceIndex}">
                  <td colspan="5" class="clusters-table" style="height: fit-content; padding: 0;">
                    <div id="_${workspaceClustersListID}" style="display:none;">
                      <table class="table align-middle mb-0" style="background: transparent;">
                        <thead>
                          <tr>
                            <th width="5%">
                              <input id="_${importClustersCheckboxInputID}" class="form-check-input for-import-clusters" type="checkbox" checked="true"/>
                            </th>
                            <th width="35%"><span mulang="name" capitalize></span></th>
                            <th width="60%"><span mulang="host" capitalize></span>:<span mulang="port" capitalize></span></th>
                          </tr>
                        </thead>
                        <tbody>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>`

            // Append the clusters' list's container
            $(`tr[data-id="${workspaceIndex}"]`).after($(element).show(function() {
              setTimeout(() => {
                // Handle the parent checkbox which controls all clusters' checkboxes
                $(`#_${importClustersCheckboxInputID}`).change(function() {
                  // Whether or not the checkbox is checked
                  let isChecked = $(this).prop('checked')

                  // Based on the status change all checkboxes
                  $(`tr[for-workspace-id="${workspaceIndex}"]`).find('input.for-import-clusters-sub[type="checkbox"]').prop('checked', isChecked)

                  let allRelatedCheckboxes = [...$('input.for-import-workspaces[type="checkbox"]')]

                  try {
                    $('#importWorkspacesCheckbox').prop('checked', (allRelatedCheckboxes.every((checkbox) => $(checkbox).prop('checked'))))
                  } catch (e) {}
                })
              })

              // Now loop through each cluster
              setTimeout(() => {
                clusters.forEach((cluster, clusterIndex) => {
                  let element = `
                      <tr for-cluster-id="${clusterIndex}" data-folder="${cluster.folder}">
                        <td>
                          <input class="form-check-input for-import-clusters-sub" type="checkbox" checked="true" />
                        </td>
                        <td>
                          ${cluster.name}
                        </td>
                        <td data-host-port>
                        -
                        </td>
                      </tr>`

                  $(`tr[for-workspace-id="${workspaceIndex}"]`).find('tbody').append($(element).show(function() {
                    setTimeout(() => {
                      // When the checkbox status changes
                      $(this).find('input[type="checkbox"]').change(function() {
                        let allRelatedCheckboxes = [...$(`tr[for-workspace-id="${workspaceIndex}"]`).find('input.for-import-clusters-sub[type="checkbox"]')]

                        try {
                          $(`#_${importClustersCheckboxInputID}`).prop('checked', (allRelatedCheckboxes.every((checkbox) => $(checkbox).prop('checked'))))

                          if ($(`#_${importClustersCheckboxInputID}`).prop('checked'))
                            $(`#_${importClustersCheckboxInputID}`).trigger('change')
                        } catch (e) {}
                      })
                    })

                    // Apply the chosen language on the UI element after being fully loaded
                    setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
                  }))
                })
              })

              // Apply the chosen language on the UI element after being fully loaded
              setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
            }))
          } catch (e) {}

          // Update the import workspaces' checkbox's status
          setTimeout(() => $('#importWorkspacesCheckbox').prop('checked', true).trigger('change'))

          // Show the next phase in the dialog
          setTimeout(() => $('div.modal#importWorkspaces').find('div.btn[section="phase-2"]').removeClass('disabled').click())
        })

        // Apply the chosen language on the UI element after being fully loaded
        setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
      }))

      setTimeout(() => healthChecks(workspace, workspaceIndex, savedWorkspaces, workspaceChecksID, importWorkspacesCheckboxInputID, $(`input#_${workspaceNameInputID}`)))
    })
  }

  let healthChecks = async (workspace, workspaceIndex, savedWorkspaces, workspaceChecksID, importWorkspacesCheckboxInputID, workspaceNameInput = null) => {
    // By default, there's no duplication found regards the name
    let isNameDuplicated = false,
      // By default, there's no missing variable
      isMissingVariableFound = false,
      // Get the workspace name to be checked
      workspaceName = workspaceNameInput != null ? workspaceNameInput.val() : workspace.name,
      // Point at the checks' loader
      loader = $(`td[data-id="_${workspaceChecksID}"]`).find(`l-line-wobble`)

    try {
      let isInvalid = minifyText(workspaceNameInput.val()).length <= 0

      workspaceNameInput.toggleClass('is-invalid', isInvalid)

      try {
        if (!isInvalid)
          throw 0

        setTimeout(() => $(`input#_${importWorkspacesCheckboxInputID}`).prop('checked', false).trigger('change').attr('disabled', ''))

        return
      } catch (e) {}

      $(`input#_${importWorkspacesCheckboxInputID}`).attr('disabled', null)
    } catch (e) {}

    // First check; name duplication
    try {
      // Point at the check's badge if exists
      let checkBadge = $(`td[data-id="_${workspaceChecksID}"]`).find('span[check="name"]'),
        // Check the existence of the name among the saved workspaces
        nameExists = savedWorkspaces.find((savedWorkspace) => manipulateText(savedWorkspace.name) == manipulateText(workspaceName))

      // Check the existence of the name among other workspaces which about to be imported
      try {
        // Get all related inputs
        let allRelatedInputs = [...$(`table#importWorkspacesValidate`).find(`input.workspace-name`)],
          // Array which will hold their values
          allInputsValues = []

        // Map the inputs and get their current values
        allInputsValues = (allRelatedInputs.filter((input) => !($(input).is(workspaceNameInput)))).map((input) => $(input).val())

        // Perform the check
        if (!nameExists)
          nameExists = allInputsValues.find((nameValue) => manipulateText(nameValue) == manipulateText(workspaceName))
      } catch (e) {}

      // If there's no duplication in name
      if (nameExists == undefined) {
        // Hide the check's badge if exists
        if (checkBadge.length != 0)
          checkBadge.hide()

        // Remove the `invalid` class from the associated input field
        workspaceNameInput.removeClass('is-invalid')

        // Skip this try-catch block - check the name duplication -
        throw 0
      }

      /**
       * Reaching here means there's a duplication
       *
       * Update the flag
       */
      isNameDuplicated = true

      // Hide the loader
      loader.hide()

      // Add the `invalid` class
      workspaceNameInput.addClass('is-invalid')

      // Hide the `passed` badge
      try {
        $(`td[data-id="_${workspaceChecksID}"]`).find('span[check="passed"]').hide()
      } catch (e) {}

      // If there's a badge already
      if (checkBadge.length != 0) {
        // Show it
        checkBadge.show()
      }
    } catch (e) {}
    // Name duplication check ends here

    // Check missing values for variables in clusters
    try {
      // Map the workspace's clusters' array and keep the `cqlsh.rc` files' paths
      let clusters = [...workspace.clusters.map((cluster) => Path.join(workspace.path, cluster.folder, 'config', 'cqlsh.rc'))],
        // Get all saved variables
        savedVariables = await retrieveAllVariables(),
        // Point at the check's badge if exists
        checkBadge = $(`td[data-id="_${workspaceChecksID}"]`).find('span[check="variables"]'),
        clusterIndex = -1

      // Loop through each cluster
      for (let cluster of clusters) {
        // Increase the index
        ++clusterIndex

        try {
          // Point at the current cluster's `tr` element
          let clusterTRElement = $(`tr[for-workspace-id="${workspaceIndex}"]`).find($(`tr[for-cluster-id="${clusterIndex}"]`)),
            // Get the content of the config file
            cqlshrcContentString = FS.readFileSync(cluster, 'utf8'),
            // Convert the content to formatted Object
            cqlshrcContentObject = await Modules.Clusters.getCQLSHRCContent(null, cqlshrcContentString, null, false),
            // Get all sections in the content
            sections = Object.keys(cqlshrcContentObject),
            // Define the variable's regex
            variableRegex = /\${([\s\S]*?)}/gi

          try {
            clusterTRElement.find('td[data-host-port]').text(`${cqlshrcContentObject.connection.hostname}:${cqlshrcContentObject.connection.port}`)
          } catch (e) {}

          // Loop through each section
          for (let section of sections) {
            // Get the current section's active options
            options = Object.keys(cqlshrcContentObject[section])

            // If the current section has no options, then skip this section
            if (options.length <= 0)
              continue

            // Otherwise, loop through all options
            for (let _option of options) {
              // Get the value of the current option
              let option = cqlshrcContentObject[section][_option],
                // Search for variables in the option's value
                match = option.match(variableRegex)

              // If no variable has been found then skip this option
              if (match == null)
                continue

              // Keep the variable's name
              match = match.map((variable) => `${variable.slice(2, variable.length - 1)}`)

              // Determine if there's a missing variable or more in the current cluster
              if (!(match.every((variable) => savedVariables.some((savedVariable) => savedVariable.name == variable && savedVariable.scope.includes('workspace-all')))))
                isMissingVariableFound = true

              // If there's no missing variable then skip this option
              if (!isMissingVariableFound)
                continue

              // Hide the loader
              loader.hide()

              // Hide the `passed` badge
              try {
                $(`td[data-id="_${workspaceChecksID}"]`).find('span[check="passed"]').hide()
              } catch (e) {}

              // If there's a badge already
              if (checkBadge.length != 0) {
                // Show it
                checkBadge.show()
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    // Missing variables check ends here

    // Show the `passed` badge if there's no failed checks
    try {
      try {
        // If there's a name duplication then uncheck the related checkbox and disable it
        if (isNameDuplicated) {
          $(`input#_${importWorkspacesCheckboxInputID}`).prop('checked', false).trigger('change').attr('disabled', '')

          // Skip this try-catch block
          throw 0
        }

        // Check the workspace and enable the checkbox
        $(`input#_${importWorkspacesCheckboxInputID}`).prop('checked', true).trigger('change').attr('disabled', null)
      } catch (e) {}

      // If one check has failed then skip this try-catch block
      if (isNameDuplicated || isMissingVariableFound)
        throw 0

      // Hide the loader
      loader.hide()

      // Point at the check's badge if exists
      let checkBadge = $(`td[data-id="_${workspaceChecksID}"]`).find('span[check="passed"]')

      // If there's a badge already
      if (checkBadge.length != 0) {
        // Hide all badges
        try {
          $(`td[data-id="_${workspaceChecksID}"]`).find('span[check]').hide()
        } catch (e) {}

        // Show it
        checkBadge.show()

        // Skip this try-catch block
        throw 0
      }
    } catch (e) {}
  }

  // Handle the parent checkbox which controls all checkboxes in the table
  $('#importWorkspacesCheckbox').change(function() {
    // Whether or not the checkbox is checked
    let isChecked = $(this).prop('checked')

    // Based on the status change all checkboxes
    $('input.for-import-workspaces[type="checkbox"]:not([disabled]), input.for-import-clusters[type="checkbox"]:not([disabled])').prop('checked', isChecked).trigger('change')
  })

  // Handle the click of sections' navigation buttons
  $('div.modal#importWorkspaces').find('div.btn[section*="phase-"]').click(function() {
    $('div.modal#importWorkspaces').find('div.modal-footer').find('button').attr('disabled', $(this).attr('section') == 'phase-1' ? '' : null)
  })

  $('button#importWorkspacesReset').click(function() {
    $('#importWorkspacesValidate').children('tbody').html('')

    $('div.modal#importWorkspaces').find('div.btn[section*="phase-"]:not([section*="phase-1"])').addClass('disabled')

    $('div.modal#importWorkspaces').find('div.btn[section="phase-1"]').click()

    $(`div.modal#importWorkspaces`).find('div.modal-footer').find('button[data-mdb-dismiss="modal"]').attr('hidden', '')
    $(`#importWorkspacesFinish`).attr('hidden', null)
  })

  $('button#importWorkspacesFinish').click(async function() {
    let workspacesTRElements = $('table#importWorkspacesValidate').find('tr[data-id]').filter(function() {
        return $(this).find('input[type="checkbox"].for-import-workspaces').prop('checked')
      }),
      savingResults = []

    if (workspacesTRElements.length <= 0)
      return showToast(I18next.capitalize(I18next.t('import workspaces')), I18next.capitalizeFirstLetter(I18next.t('no checked workspaces have been detected, please consider to check at least one workspace')) + '.', 'failure')

    for (let workspace of [...workspacesTRElements]) {
      try {
        let workspaceStructure = {
          defaultPath: true,
          name: $(workspace).find(`input.workspace-name`).val(),
          color: $(workspace).find(`input.workspace-color`).val(),
          id: `workspace-${getRandomID(10)}`,
          clustersPath: $(workspace).attr('data-clusters-path')
        }

        let clustersTRElements = $('table#importWorkspacesValidate').find(`tr[for-workspace-id="${$(workspace).attr('data-id')}"]`).find(`tr[for-cluster-id]`).filter(function() {
          return $(this).find('input[type="checkbox"].for-import-clusters-sub').prop('checked')
        })

        workspaceStructure.checkedClusters = [...clustersTRElements].map((cluster) => $(cluster).attr('data-folder'))

        let saveWorkspace = await Modules.Workspaces.saveWorkspace(workspaceStructure)

        savingResults.push({
          name: workspaceStructure.name,
          status: saveWorkspace
        })
      } catch (e) {}
    }

    let savingResultsTxt = ''

    for (let result of savingResults) {
      savingResultsTxt += `, ${result.name}: ${I18next.capitalizeFirstLetter(I18next.t(result.status == 1 ? 'successfully saved' : 'failed to save'))}`
    }

    savingResultsTxt = savingResultsTxt.slice(2)

    showToast(I18next.capitalize(I18next.t('import workspaces')), I18next.capitalizeFirstLetter(I18next.replaceData(`the importing process has finished, results for the workspaces are: $data`, [savingResultsTxt])) + '.', 'success')

    $(`div.modal#importWorkspaces`).find('button[data-mdb-dismiss="modal"]').attr('hidden', null)
    $(`div.modal#importWorkspaces`).find('button#importWorkspacesFinish').attr('hidden', '')

    $(document).trigger('refreshWorkspaces')
  })
}

{
  $('#importWorkspacesAction').click(function() {
    let closeButton = $('div.modal#importWorkspaces').find('div.modal-footer').find('button[data-mdb-dismiss="modal"]')

    if (closeButton.attr('hidden') == undefined)
      $('button#importWorkspacesReset').click()
  })
}
