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
  let variables = [], // All adopted/approved variables
    removedVariables = null, // Removed variables to be replaced with their values
    changedVariables = null, // Changed variables in which some or all their attributes would be changed - name, value, and scope -
    savedWorkspaces = [], // All saved workspaces - synced and up to date -
    variablesList = $('div.variables-list'), // Point at the variables' container in the settings dialog
    content = variablesList.children('div.content') // Point at the variables' content inside the container

  // Click the `Add Variable` button inside the dialog
  $('#addNewVariable').click(() => {
    // Remove the `empty` class; so the emptiness message will disappear
    variablesList.removeClass('empty')

    // Call the function of creating an empty variable UI element
    createVariableElement()

    // Show the `Refresh Variables` button
    $('#refreshVariables').addClass('show')
  })

  /**
   * Click the `Refresh Variables` button
   * When clicked, all changes will be ignored, and the saved variables will be loaded again
   */
  $('#refreshVariables').click(async () => {
    // Reset arrays
    removedVariables = null
    changedVariables = null

    // Retrieve the saved variables
    retrieveVariables()

    // Feedback to the user
    showToast(`${I18next.capitalize(I18next.t('settings'))}: ${I18next.capitalize(I18next.t('refresh variables'))}`, `${I18next.capitalizeFirstLetter(I18next.t('variables have been refreshed'))}.`, 'success')
  })

  // Clicks the bulk deletion of selected variables
  $(`#deleteSelectedVariables`).click(function() {
    // Get all variables which their deletion checkbox is checked
    let checkboxes = variablesList.find('input[type="checkbox"]:checked')

    // Loop through each one of them
    checkboxes.each(function() {
      // Point at the variable's element in the container
      let actionsContainer = $(this).parent().parent()

      // Click the delete button of that variable
      actionsContainer.children('a[action="delete"]').click()
    })

    // Hide the bulk deletion button
    $(this).removeClass('show')
  })

  /**
   * Click the `UPDATE VARIABLES` button
   * This button is hidden and the `click` event is triggered by the main settings saving button
   * The update process will apply changes on different files related to variables:
   * The variables files - manifest and values -, `cqlsh.rc` files for all clusters, workspaces, and SSH tunnels files
   */
  $('#updateVariables').on('click', async function(_, callback) {
    /**
     * Temp array
     * Will be copied to the `variables` array if no error has occurred
     */
    let temp = [],
      // Collision detection between variables
      collision = null,
      // The updating process' status
      status = false,
      // The failure message if any error has occurred
      failureMessage = ''

    // Loop through rows (variables in the UI)
    content.children('div.variable').each(function() {
      let row = $(this), // Point at the variable's row
        nameInput = row.find(`input[var-type="name"]`), // Point at its name input field
        valueInput = row.find(`input[var-type="value"]`), // Point at its value
        selectedWorkspaces = row.find(`div.workspaces`), // Point at its workspaces badges parent
        tempWorkspaces = [] // Temp array that will hold the selected workspaces

      // Loop through workspaces and push each workspace's ID plus whether it's selected or not
      selectedWorkspaces.children('div.btn.workspace').each(function() {
        // Push the workspace's info
        tempWorkspaces.push({
          id: getAttributes($(this), 'id'),
          selected: getAttributes($(this), 'data-selected') == 'true'
        })
      })

      // Filter and keep only the selected workspaces
      selectedWorkspaces = [...tempWorkspaces].filter((workspace) => workspace.selected == true),
        // Map the array after the filtering process by keeping only the workspace ID
        selectedWorkspaces = selectedWorkspaces.map((workspace) => workspace.id)

      // Make sure both name and value for the current variable/row are not empty
      if ([nameInput.val(), valueInput.val()].some((val) => val.trim().length <= 0)) {
        // If not, show feedback to the user
        failureMessage = I18next.capitalizeFirstLetter(I18next.t('variable or more are not having invalid name or value, make sure unique names and values are provided for each variable'))

        // By setting the `collision` value to true the process will be stopped entirely
        collision = true

        // Return `false` to stop the loop of `each` row
        return false
      }

      // Push the variable to the `temp` array
      temp.push({
        name: nameInput.val(),
        value: valueInput.val(),
        scope: selectedWorkspaces
      })

      /**
       * Check collision
       *
       * First, filter variables and keep whose are similar in name or value
       */
      collision = temp.filter((variable) => variable.name == nameInput.val() || variable.value == valueInput.val())

      /**
       * Second, apply another filter that will keep variables with an intersection in their scope
       * The result will be a `collision` array that has variables with the same name or value and has intersected scope
       */
      collision = collision.filter(
        (variable) => variable.scope.some(
          (workspace) => selectedWorkspaces.find(
            (_workspace) => ['workspace-all', workspace].includes(_workspace) || workspace == 'workspace-all'
          )
        )
      )

      // If there is a collision then end the process and give feedback
      if (collision.length > 1) {
        // Check if the collision is in `value` not `scope`
        let inValue = collision[0].value == collision[1].value

        // Show feedback to the user
        failureMessage = I18next.capitalizeFirstLetter(I18next.replaceData('a collision has been detected in variable $data, please consider to $data to prevent that collision', [inValue ? ' <b>' + collision[0].name + '</b> and <b>' + collision[1].name + '</b>' : ' <b>' + collision[0].name + '</b>', I18next.t(inValue ? 'change their values' : 'adjust the variable scope')]))

        // Return `false` to stop the loop of `each` row
        return false
      }

      // Set `collision` to `false`; as none has been detected
      collision = false

      // Point at the delete button of row/variable
      let deleteBtn = row.find(`a[action="delete"]`),
        // Sort the selected workspaces - scope - array; for comparison and change detection
        selectedWorkspacesIDs = selectedWorkspaces.sort(),
        // Do the same thing with the original scope array
        originalselectedWorkspacesIDs = getAttributes(deleteBtn, 'variable-scope').split(',').sort()

      /**
       * Check if the current variable's name has been changed
       * This is possible by checking the original name and value that has been added to the delete button once the variable has been loaded
       * Also, check if there is a change in the variable's scope - selectedWorkspacesIDs -
       */
      if (
        (getAttributes(deleteBtn, 'variable-name') != nameInput.val() && getAttributes(deleteBtn, 'variable-name').trim().length != 0) ||
        (getAttributes(deleteBtn, 'variable-value') != valueInput.val() && getAttributes(deleteBtn, 'variable-value').trim().length != 0) ||
        (JSON.stringify(selectedWorkspacesIDs) != JSON.stringify(originalselectedWorkspacesIDs))
      ) {
        /**
         * If the current variable/row has been changed then it'll be pushed to the `changedVariables` array
         *
         * If `changedVariables` is `null` then update it to `array`
         */
        if (changedVariables == null)
          changedVariables = []

        // Push the variable's info - name, value, and scope - to the `changedVariables` array
        changedVariables.push({
          name: {
            old: getAttributes(deleteBtn, 'variable-name'),
            new: nameInput.val()
          },
          value: {
            old: getAttributes(deleteBtn, 'variable-value'),
            new: valueInput.val()
          },
          scope: {
            old: originalselectedWorkspacesIDs,
            new: selectedWorkspacesIDs
          }
        })
      }

      // Update the delete button's attributes
      deleteBtn.attr({
        'variable-name': nameInput.val(),
        'variable-value': valueInput.val(),
        'variable-scope': selectedWorkspacesIDs
      })

      /**
       * Remove this attribute to take care of the deletion process of that variable after changing its data
       * If the variable is empty, it should be ignored if it has been deleted, this is done by checking the `ignored` attribute
       */
      deleteBtn.removeAttr('ignored')
    })

    // If a collision has been detected then stop the updating process and call the callback function
    if (collision != null && collision)
      return callback({
        status,
        failureMessage
      })

    // Copy the temp array
    variables = [...temp]

    try {
      // Update variables' manifest file
      await Keytar.setPassword('AxonOpsWorkbenchVarsManifest', 'content', JSON.stringify(
        [...variables.map(
          (variable) => {
            return {
              name: variable.name,
              scope: variable.scope
            }
          }
        )]
      ) || '')

      // Update variables' values file
      await Keytar.setPassword('AxonOpsWorkbenchVarsValues', 'content', JSON.stringify(variables) || '')

      // Call the update function
      setTimeout(async () => {
        // Tell the function to update the editor's content by passing `true`
        await updateVariablesInData(true)
      })

      // Update the process' status
      status = true
    } catch (e) {
      try {
        errorLog(e, 'variables')
      } catch (e) {}
    }

    // Call the callback function
    callback({
      status,
      failureMessage
    })
  })

  // Retrieve all saved values in JSON object format
  let retrieveVariables = async () => {
    try {
      // The saved variables' manifest and their values
      let variablesManifest = await Keytar.findPassword('AxonOpsWorkbenchVarsManifest'),
        variablesValues = await Keytar.findPassword('AxonOpsWorkbenchVarsValues')

      // Define the final variables object,
      let variables = [],
        // Convert manifest and values strings to JSON object
        variablesManifestObject = variablesManifest != null && `${variablesManifest}`.trim().length > 0 ? JSON.parse(variablesManifest) : [],
        variablesValuesObject = variablesValues != null && `${variablesValues}`.trim().length > 0 ? JSON.parse(variablesValues) : []

      /**
       * Loop through variables' manifest items
       * If the variable has a value in the values file, then return and use it, otherwise, it'll be ignored
       */
      variablesManifestObject.forEach((variable) => {
        try {
          // Check if there's a value exists in the variables' values file
          let exists = variablesValuesObject.find(
            (_variable) =>
            _variable.name == variable.name && JSON.stringify(_variable.scope) == JSON.stringify(variable.scope)
          )

          // If it exists, push and adopt it
          if (exists != undefined)
            variables.push(exists)
        } catch (e) {}
      })

      /**
       * As a final result, there should be a valid `variables` array
       *
       * Check if there are variables to show
       */
      variablesList.toggleClass('empty', variables.length <= 0)

      // Whether the `Refresh Variables` button should be shown
      $('#refreshVariables').toggleClass('show', variables.length > 0)

      // Remove all rows/variables
      content.children('div.variable').remove()

      // Reverse `variables` array; so newly added ones will be at the top
      variables = variables.reverse()

      // Create a row element for each variable
      variables.forEach((variable) => createVariableElement(variable))

      // Update saved workspaces array
      savedWorkspaces = await Modules.Workspaces.getWorkspaces()
    } catch (e) {
      try {
        errorLog(e, 'variables')
      } catch (e) {}
    }
  }

  /**
   * Create a UI element for a variable in the settings' dialog, sub-elements are:
   * `name` and `value` inputs, `badge buttons` of all workspaces - to define the variable's scope -, a `deletion` button and a checkbox for bulk deletion
   *
   * @Parameters:
   * {object} `?variable` the variable's different attributes:
   * {string} `name` the variable's name, {string} `value` the variable's value, {object} `scope` group - array - of workspaces ID
   */
  let createVariableElement = (variable = {
    name: '',
    value: '',
    scope: ['workspace-all'] // By default, the `All workspaces` button is selected
  }) => {
    // Get random IDs for the sub-elements
    let [
      variableNameID,
      variableValueID,
      deleteBtnID
    ] = getRandomID(15, 3)

    // Variable UI element structure
    let element = `
        <div class="variable">
          <div class="row input" style="--mdb-gutter-x:0;">
            <div class="row" style="--mdb-gutter-x:0;">
              <div class="col-md-5">
                <div class="form-outline form-white right-margin">
                  <input type="text" class="form-control form-control-m variable-name" id="_${variableNameID}" spellcheck="false" var-type="name">
                  <label class="form-label">
                    <span mulang="variable name" capitalize></span>
                  </label>
                </div>
              </div>
              <div class="col-md-5">
                <div class="form-outline form-white left-margin">
                  <input type="text" class="form-control form-control-m variable-value" id="_${variableValueID}" spellcheck="false" var-type="value">
                  <label class="form-label">
                    <span mulang="variable value" capitalize></span>
                  </label>
                </div>
              </div>
              <div class="col-md-2 flex">
                <div class="actions left-margin">
                  <a action="delete" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="light" href="#" role="button" data-confirmed="false" button-id="${deleteBtnID}" variable-name="${variable.name}" variable-value="${variable.value}"
                    variable-scope="${variable.scope}" ${variable.name.length <= 0 && variable.value.length <= 0 ? 'ignored' : '' }>
                    <ion-icon name="trash"></ion-icon>
                  </a>
                  <a action="multiple" class="btn btn-link btn-rounded btn-sm" data-mdb-ripple-color="#262626">
                    <input class="form-check-input" type="checkbox" no-color>
                  </a>
                </div>
              </div>
            </div>
            <div class="workspaces"></div>
          </div>
        </div>`

    // Prepend the element - show it at the top - to the container's content
    content.prepend($(element).show(function() {
      /**
       * Once the element is added
       *
       * Add workspaces as badge buttons; to provide the ability to change the variables' scope
       */
      let allWorkspacesID = `workspace-all` // The ID to cover all workspaces in the scope

      setTimeout(() => {
        // Point at the related container that will have all badges
        let selectedWorkspaces = $(this).find(`div.workspaces`),
          // Define workspaces that will be added as badges, including the `All workspaces` badge
          workspacesToAdd = [{
              id: allWorkspacesID,
              name: 'All workspaces',
              color: undefined
            },
            ...savedWorkspaces
          ]

        // Loop through workspaces
        workspacesToAdd.forEach((workspace) => {
          // Determine if the workspace is selected based on whether or not it's in the variable's scope
          let selected = variable.scope.find((workspaceID) => workspaceID == workspace.id) != undefined

          // Badge button UI element structure
          let element = `
              <div class="btn ripple-surface-light workspace badge rounded-pill" id="${workspace.id}" data-selected="${selected}" data-mdb-ripple-color="light">
                <span class="color" style="background: ${workspace.color}" ${workspace.color == undefined ? 'hidden' : ''}></span>
                <span class="title">${workspace.name}</span>
              </div>`

          // Append the workspace as a clickable badge
          selectedWorkspaces.append($(element).click(function() {
            // Determine if the badge is now selected or not
            let selected = $(this).attr('data-selected') == 'true',
              allWorkspacesButton = selectedWorkspaces.children(`div.btn.workspace[id="${allWorkspacesID}"]`)

            // If the clicked badge is `All workspaces`
            if ($(this).attr('id') == allWorkspacesID) {
              // Loop through badges
              selectedWorkspaces.children('div.btn.workspace').each(function() {
                // Deselect all other badges rather than the `All workspaces`
                $(this).attr('data-selected', $(this).attr('id') != allWorkspacesID ? 'false' : 'true')
              })

              // Make sure to select the `All workspaces` badge
              $(allWorkspacesButton).attr('data-selected', 'true')

              // Skip the upcoming code
              return
            }

            // If the clicked badge is not `All workspaces` then deselect the `All workspaces` badge
            $(allWorkspacesButton).attr('data-selected', 'false')

            // Switch the selection status of the currently clicked badge
            $(this).attr('data-selected', !selected)

            // Check if all workspaces have been selected, or none of them
            let allSelected = true,
              noneSelected = true

            // Loop through all badges
            selectedWorkspaces.children('div.btn.workspace').each(function() {
              // If the current badge is `All workspaces` then skip and jump to the next badge; because it's already handled
              if ($(this).attr('id') == allWorkspacesID)
                return

              // If the current badge is not selected then one badge at least is not selected
              if ($(this).attr('data-selected') == 'false')
                allSelected = false

              // If the current badge is selected then one badge at least is selected
              if ($(this).attr('data-selected') == 'true')
                noneSelected = false
            })

            // If not all badges are selected, and if one badge at least is selected then skip the upcoming code
            if (!allSelected && !noneSelected)
              return

            /**
             * Reaching here means either all badges are selected, or none of them are selected, and in both cases select the `All workspaces` badge
             *
             * Loop through all badges
             */
            selectedWorkspaces.children('div.btn.workspace').each(function() {
              // Deselect badge if it is not `All workspaces`
              $(this).attr('data-selected', $(this).attr('id') != allWorkspacesID ? 'false' : 'true')
            })

            // Select `All workspaces` badge
            $(allWorkspacesButton).attr('data-selected', 'true')
          }))
        })
      })

      // Handle different events and UI elements related to variables
      setTimeout(() => {
        // Create Material Design text field's object for `name` and `value` inputs of the variable
        let variableNameObject = getElementMDBObject($(`input[id="_${variableNameID}"]`)),
          variableValueObject = getElementMDBObject($(`input[id="_${variableValueID}"]`))

        // If the given variable's name is not empty then set that name in the input field
        if (variable.name.trim().length != 0) {
          $(`input[id="_${variableNameID}"]`).val(variable.name)
          variableNameObject.update()
        }

        // Same check for the variable's value
        if (variable.value.trim().length != 0) {
          $(`input[id="_${variableValueID}"]`).val(variable.value)
          variableValueObject.update()
        }

        // Clicks the deletion button
        $(`a[button-id="${deleteBtnID}"]`).click(function() {
          // Define saved name, value, and scope
          let [name, value, scope] = getAttributes($(this), ['variable-name', 'variable-value', 'variable-scope'])

          // Remove the entire row
          $(this).parent().parent().parent().parent().parent().remove()

          // Filter variables and remove the deleted one
          variables = variables.filter((_var) => _var.name != name && _var.value != value)

          // Show the empty message again if there are no variables nor any rows
          if (variables.length <= 0 && content.children('div.variable').length <= 0) {
            variablesList.addClass('empty')
            $('#refreshVariables').add('#deleteSelectedVariables').removeClass('show')
          }

          // Skip the upcoming code if the deletion of this variable should be ignored
          if ($(this).attr('ignored') != undefined)
            return

          // If the `removedVariables` is `null` then update it to `array`
          if (removedVariables == null)
            removedVariables = []

          // Push that variable in the removed variables; so it'll be handled in the next variables update
          removedVariables.push({
            name,
            value,
            scope
          })
        })

        // When there's a change in the checkbox's state
        $(this).find('input[type="checkbox"]').change(function() {
          // Get the state - checked or not -
          let checked = $(this).prop('checked')

          try {
            // If the checkbox is checked
            if (checked) {
              // Show the bulk deletion button
              $(`#deleteSelectedVariables`).addClass('show')

              // Skip the upcoming code in this try-catch block
              throw 0
            }

            /**
             * Reaching here means the new state of the checkbox is unchecked
             *
             * Get all checkboxes in the variables' container's content
             */
            let checkboxes = variablesList.find('input[type="checkbox"]'),
              // Flag to determine a at least one checked checkbox has been found
              foundChecked = false

            // Loop through each checkbox
            checkboxes.each(function() {
              // If the current checkbox is checked
              if ($(this).prop('checked')) {
                // Change the `foundChecked` flag
                foundChecked = true

                // End the loop
                return false
              }
            })

            // Show/hide the bulk deletion button based on the final state of the flag
            $(`#deleteSelectedVariables`).toggleClass('show', foundChecked)
          } catch (e) {
            try {
              errorLog(e, 'variables')
            } catch (e) {}
          }
        })
      })

      // Apply the chosen language on the UI element after being fully loaded
      setTimeout(() => Modules.Localization.applyLanguageSpecific($(this).find('span[mulang], [data-mulang]')))
    }))
  }

  /**
   * Update variables in all related files - like config files, SSH tunnel files, etc... -
   *
   * @Parameters:
   * {object} `?updateEditor` update the editor's content as well taking into account the currently active workspace
   */
  let updateVariablesInData = async (updateEditor = false) => {
    // Get all saved workspaces
    let savedWorkspaces = await Modules.Workspaces.getWorkspaces(),
      // Get the currently active workspace ID
      workspaceID = getActiveWorkspaceID()

    // Loop through all saved workspaces
    for (let workspace of savedWorkspaces) {
      // Get the clusters of the current workspace
      let clusters = await Modules.Clusters.getClusters(workspace.id)

      // Map the clusters; keep only their `cqlsh.rc` file's path and content
      clusters = clusters.map((cluster) => {
        return {
          content: cluster.cqlshrc,
          path: cluster.cqlshrcPath
        }
      })

      // Loop through clusters objects, and update their `cqlsh.rc` file's content
      for (let cluster of clusters)
        await Modules.Clusters.updateFilesVariables(workspace.id, cluster.content, cluster.path, removedVariables, changedVariables)

      // If the current workspace is not the active one, or there's no need to update the editor's content then skip the upcoming code
      if (workspace.id != workspaceID || !updateEditor)
        continue

      // Get the editor's content
      let editorContent = editor.getValue(),
        // New content will be manipulated after updating values to variables
        newContent = await Modules.Clusters.updateFilesVariables(workspace.id, editorContent, null, removedVariables, changedVariables)

      // Set the new content
      editor.setValue(newContent)
    }

    // Reset arrays
    removedVariables = null
    changedVariables = null
  }

  // When a request from the main thread to open the define variables dialog is received
  {
    let selector = `div.body div.left div.content div.navigation div.group div.item`
    $(`${selector}[action="settings"]`).click(() => retrieveVariables())
  }
}
