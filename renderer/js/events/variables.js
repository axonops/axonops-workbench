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
    variablesBeforeUpdate = [], // All variables before being updated
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
   * The variables files - manifest and values -, `cqlsh.rc` files for all connections, workspaces, and SSH tunnels files
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

    // Get all variables before the updating process
    variablesBeforeUpdate = await retrieveAllVariables(true)

    // Loop through rows (variables in the UI)
    content.children('div.variable').each(function() {
      let row = $(this), // Point at the variable's row
        nameInput = row.find(`input[var-type="name"]`), // Point at its name input field
        valueInput = row.find(`input[var-type="value"]`), // Point at its value
        selectedWorkspaces = row.find(`div.workspaces`), // Point at its workspaces badges parent
        resolveVariables = row.find(`div.resolve-variables`), // Point at the button to resolve nested variables
        tempWorkspaces = [], // Temp array that will hold the selected workspaces
        variableNewValue = valueInput.val() // Save the variable's new value

      try {
        // Reset the viewing state of the nested variables
        if (resolveVariables.find('ion-icon').attr('name') != 'eye-closed')
          throw 0

        resolveVariables.find('div.btn').click()
        variableNewValue = row.find(`a[action="delete"]`).attr('variable-value')
      } catch (e) {}

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
      if ([nameInput.val(), variableNewValue].some((val) => `${val}`.trim().length <= 0) || !(/^\d*[a-zA-Z_][a-zA-Z\d_]*$/g.test(`${nameInput.val()}`))) {
        // If not, show feedback to the user
        failureMessage = I18next.capitalizeFirstLetter(I18next.t('variable or more are not having a valid name or value, make sure unique names and values are provided for each variable and the variable name is only digits and letters, underscore symbol [code]_[/code] is allowed'))

        // By setting the `collision` value to true the process will be stopped entirely
        collision = true

        // Show feedback to the user
        row.find('input[type="text"]').addClass('is-invalid')

        // Return `false` to stop the loop of `each` row
        return false
      }

      // Push the variable to the `temp` array
      temp.push({
        name: nameInput.val(),
        value: variableNewValue,
        scope: selectedWorkspaces
      })

      /**
       * Check collision
       *
       * First, filter variables and keep whose are similar in name or value
       */
      collision = temp.filter((variable) => variable.name == nameInput.val() || variable.value == variableNewValue)

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

        // Show feedback to the user
        row.find('input[type="text"]').addClass('is-invalid')

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
        (getAttributes(deleteBtn, 'variable-value') != variableNewValue && getAttributes(deleteBtn, 'variable-value').trim().length != 0) ||
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
            new: variableNewValue
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
        'variable-value': variableNewValue,
        'variable-scope': selectedWorkspacesIDs
      })

      /**
       * Remove this attribute to take care of the deletion process of that variable after changing its data
       * If the variable is empty, it should be ignored if it has been deleted, this is done by checking the `ignored` attribute
       */
      deleteBtn.removeAttr('ignored')

      // Show/hide the `eye` button based on whether or not nested variables have been found
      {
        // Flag to tell if nested variables have been found
        let isNestedVariablesExist = `${variableNewValue}`.match(/\${(.*?)}/gm) != null

        // Update associated attributes
        resolveVariables.attr({
          'hidden': (isNestedVariablesExist || resolveVariables.attr('data-had-variable') != null) ? null : '',
          'data-had-variable': isNestedVariablesExist ? '' : null
        })
      }
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
  retrieveVariables = async (onlyVariables = false, handleNestedVariables = false) => {
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

      // Reverse `variables` array; so newly added ones will be at the top
      variables = variables.reverse()

      // Return variables if needed
      try {
        if (onlyVariables)
          return (handleNestedVariables ? resolveNestedVariables(variables) : variables)
      } catch (e) {}

      /**
       * Handle the missing variables
       *
       * Define the array which will hold the detected missing variables
       */
      let missingVariables = []

      try {
        // Call the inner function which gets the missing variables
        missingVariables = await getMissingVariables(variables)

        // Manipulate the data to be merged with the `variables` array
        missingVariables = Object.keys(missingVariables).map((variableName) => {
          return {
            name: variableName,
            value: '',
            scope: [...new Set(missingVariables[variableName])]
          }
        })
      } catch (e) {}

      // Concat the defined and the missing variables
      variables = variables.concat(missingVariables)

      /**
       * As a final result, there should be a valid `variables` array
       *
       * Check if there are variables to show - even if they're missing and not defined yet -
       */
      variablesList.toggleClass('empty', variables.length <= 0 && missingVariables.length <= 0)

      // Whether the `Refresh Variables` button should be shown
      $('#refreshVariables').toggleClass('show', variables.length > 0)

      // Remove all rows/variables
      content.children('div.variable').remove()

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

  // Set global function to get all variables in all scopes
  global.retrieveAllVariables = async (handleNestedVariables = false) => await retrieveVariables(true, handleNestedVariables)

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
    ] = getRandom.id(15, 3),
      // Check if the variable's value has nested variables
      isNestedVariablesExist = `${variable.value}`.match(/\${(.*?)}/gm) != null

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
                  <div class="resolve-variables" ${!isNestedVariablesExist ? 'hidden' : 'data-had-variable'}>
                    <div class="btn btn-tertiary" data-mdb-ripple-color="light" data-workspaces="${variable.scope.join(',')}" data-variable-name="${variable.name}">
                      <ion-icon name="eye-opened"></ion-icon>
                    </div>
                  </div>
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
              name: '<span mulang="all workspaces" capitalize-first></span>',
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

        // Click the `resolve variables` - the `eye` - button
        $(this).find('div.resolve-variables div.btn').click(async function() {
          try {
            // Get all available variables
            let allVariables = await retrieveAllVariables(true),
              // Point at the `delete` button; to retrieve saved info about the variable
              deleteBtn = $(`a[button-id="${deleteBtnID}"]`),
              // Get the variable's name
              variableName = deleteBtn.attr('variable-name'),
              // Get its scope as an array
              workspaces = deleteBtn.attr('variable-scope').split(','),
              // Whether or not the value has already been resolved
              isValueResolved = $(this).find('ion-icon').attr('name') == 'eye-closed',
              // Get the resolved version of the variable
              variableResolved = allVariables.find((variable) => variable.name == variableName && JSON.stringify(variable.scope) == JSON.stringify(workspaces))

            // Change the button's state
            $(this).find('ion-icon').attr('name', `eye-${isValueResolved ? 'opened' : 'closed'}`)

            // Set the value based on the state
            $(`input#_${variableValueID}`).val(isValueResolved ? variableResolved.originalValue : variableResolved.value)

            // Disable/enable the value's input field based on the state
            $(`input#_${variableValueID}`).attr('disabled', isValueResolved ? null : '')
          } catch (e) {}
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

      // Reset the `invalid` feedback
      setTimeout(() => $(this).find('input[type="text"]').on('input click focus', () => $(this).find('input[type="text"]').removeClass('is-invalid')))

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
      workspaceID = getActiveWorkspaceID(),
      // Get all saved/updated variables
      updatedVariables = await retrieveAllVariables(true)

    // Loop through all saved workspaces
    for (let workspace of savedWorkspaces) {
      // Get the connections of the current workspace
      let connections = await Modules.Connections.getConnections(workspace.id)

      // Map the connections; keep only their `cqlsh.rc` file's path and content
      connections = connections.map((connection) => {
        return {
          content: connection.cqlshrc,
          path: connection.cqlshrcPath
        }
      })

      // Loop through connections objects, and update their `cqlsh.rc` file's content
      for (let connection of connections)
        await Modules.Connections.updateFilesVariables(workspace.id, connection.content, connection.path, removedVariables, changedVariables, {
          before: variablesBeforeUpdate,
          after: updatedVariables
        })

      // If the current workspace is not the active one, or there's no need to update the editor's content then skip the upcoming code
      if (workspace.id != workspaceID || !updateEditor)
        continue

      // Get the editor's content
      let editorContent = addEditConnectionEditor.getValue(),
        // New content will be manipulated after updating values to variables
        newContent = await Modules.Connections.updateFilesVariables(workspace.id, editorContent, null, removedVariables, changedVariables, {
          before: variablesBeforeUpdate,
          after: updatedVariables
        })

      // Set the new content
      addEditConnectionEditor.setValue(newContent)
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

  // Inner function to get the missing variables in all connections
  let getMissingVariables = async (savedVariables) => {
    // Get all saved workspaces
    let workspaces = await Modules.Workspaces.getWorkspaces(),
      // Define the array which will hold all the missing variables
      missingVariables = []

    // Loop through each saved workspace
    for (let workspace of workspaces) {
      // Get the workspace's connections
      let connections = await Modules.Connections.getConnections(workspace.id)

      // Loop through each saved connection
      for (let connection of connections) {
        // Get the connection's cqlsh.rc file's content and convert it to Object
        let cqlshrcContentObject = await Modules.Connections.getCQLSHRCContent(null, connection.cqlshrc, null, false),
          // Get all sections in the content
          sections = Object.keys(cqlshrcContentObject),
          // Define the variable's regex
          variableRegex = /\${([\s\S]*?)}/gi

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

            // Loop through each detected variable
            for (let variable of match) {
              // Determine if there's a missing variable or more in the current connection
              if (!(
                  match.every((variable) =>
                    savedVariables.some((savedVariable) =>
                      savedVariable.name == variable && ['workspace-all', workspace.id].some((id) => savedVariable.scope.includes(id))
                    )
                  ))) {
                if (missingVariables[variable] == undefined)
                  missingVariables[variable] = []

                // Push the variable with its workspace - scope -
                missingVariables[variable].push(workspace.id)
              }
            }
          }
        }
      }
    }

    // Return the detected missing variables
    return missingVariables
  }
}

/**
 * Convert full or a part of a JSON object's values to variables
 * The function may also return the saved variables only as raw data, taking into account the scope of variables against the given workspace ID
 * For returning raw data only, the function `getProperVariables(workspaceID)` can be used as a shorthand
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the active or target workspace
 * {object} `object` the JSON object whose values will be manipulated
 * {boolean} `?rawData` only return the proper variables based on the given workspace ID
 *
 * @Return: {object} the passed object after manipulation
 */
let variablesManipulation = async (workspaceID, object, rawData = false) => {
  let result = object // Final result which be returned

  try {
    // Get the object's values
    let objectValues = Object.keys(object),
      // Retrieve all saved variables
      savedVariables = await retrieveAllVariables(true)

    // Define the final variables object
    let variables = []

    // Filter the variables based on their scope
    variables = savedVariables.filter(
      // The filter is whether or not the variable's scope includes the current workspace, or it includes all workspaces
      (variable) => variable.scope.some(
        (workspace) => [
          workspaceID,
          'workspace-all'
        ].includes(workspace))
    )

    // If the call is about getting the available variables for the workspace then return `variables` and skip the upcoming code
    if (rawData)
      return variables

    // Loop through the object's values, and change what needed to variables
    objectValues.forEach((objectValue) => {
      // Get the current object's value
      let value = result[objectValue],
        // Check if there's a variable's value - or more - in the current value
        exists = variables.filter((variable) => value.search(variable.value))

      try {
        /**
         * If the `value` type is an `object`, this means that the `value` is an array of other sub-values, and another loop through that array is needed
         * It's guaranteed that the given object won't exceed two levels of depth
         */
        if (typeof value != 'object')
          throw 0

        // Get the sub-values' keys
        let subValues = Object.keys(value)

        // Loop through the sub-values, and make changes to them as needed
        subValues.forEach((_subValue) => {
          // Get the current object's value
          let subValue = value[_subValue],
            // Check if there's a variable's value - or more - in the current value
            exists = variables.filter((variable) => subValue.search(variable.value))

          // If there's no variable's value found in the current `value` then skip it and move to the next one
          if (exists.length <= 0)
            return

          // Loop through the existing variables
          exists.forEach((variable) => {
            // Match its value anywhere in the object's value
            let regex = createRegex(`${variable.value}`, `gm`)

            // Replace the variable's value with its name
            subValue = `${subValue}`.replace(regex, '${' + variable.name + '}')
          })

          // Update the object's value with the manipulated one
          result[objectValue][_subValue] = subValue
        })

        // Skip the upcoming code
        return
      } catch (e) {
        try {
          errorLog(e, 'functions')
        } catch (e) {}
      }

      /**
       * Reaching here means the current `value` is not an `object` but a `string`
       *
       * If there's no variable's value found in the current `value` then skip it and move to the next one
       */
      if (exists.length <= 0)
        return

      // Loop through the existing variables
      exists.forEach((variable) => {
        // Match its value anywhere in the object's value
        let regex = createRegex(`${variable.value}`, `gm`)

        // Replace the variable's value with its name
        value = `${value}`.replace(regex, '${' + variable.name + '}')
      })

      // Update the object's value with the manipulated one
      result[objectValue] = value
    })
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  } finally {
    // Return the final result in case more than raw data is wanted
    if (!rawData)
      return result
  }
}

/**
 * Shorthand the function `variablesManipulation(workspaceID, object, ?rawData)` in case only raw data is needed - saved variables with their values -
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the active or target workspace
 *
 * @Return: {object} raw data - saved variables with their values -
 */
let getProperVariables = async (workspaceID) => await variablesManipulation(workspaceID, [], true)

/**
 * Convert JSON object's values - which have been, fully or partly - converted to variables - to their proper values
 *
 * @Parameters:
 * {object} `object` the JSON object whose values will be manipulated
 * {object} `variables` the variables that will be checked in the object's values
 *
 * @Return: {object} the passed object after manipulation
 */
let variablesToValues = (object, variables) => {
  try {
    // Get keys of the given object
    let keys = Object.keys(object)

    // Loop through all keys
    keys.forEach((key) => {
      // Get the value of the current key
      let value = object[key],
        // Check if there is a variable or more in the value
        exists = variables.filter((variable) => value.search('${' + variable.name + '}'))

      // If no variable has been found in the key's value then skip it and move to the next key
      if (exists.length <= 0)
        return

      // Loop through existing variables
      exists.forEach((variable) => {
        // Create a regular expression to match the variable anywhere in the object's value
        let regex = createRegex('${' + variable.name + '}', 'gm')

        // Replace the object's value with the variable's value
        value = `${value}`.replace(regex, variable.value)
      })

      // Update the object's value with the manipulated one
      object[key] = value
    })
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Return the object after manipulation
  return object
}

/**
 * Resolve variables inside variables' values
 *
 * @Parameters:
 * {object} `variables` the variables to be manipulated
 *
 * @Return: {object} final result after the manipulation process
 */
let resolveNestedVariables = (variables) => {
  // Inner function to resolve a passed variable's value
  let resolveValue = (savedVariable) => {
    // The final variable to be returned
    let finalValue = `${savedVariable.value}`,
      // Define and match all available variables in the current variable's value
      foundVariables = finalValue.match(new RegExp(/\${(.*?)}/, 'gm'))

    try {
      // If no variable has been found in the current variable's value then skip this try-catch block
      if (foundVariables == null)
        throw 0

      // Loop through the found variables in the value
      for (let foundVariable of foundVariables) {
        // Get the variable's name
        let variableName = `${foundVariable}`.slice(2, foundVariable.length - 1),
          // Get that nested variable
          variable = variables.find(
            (variable) => variable.name == variableName && savedVariable.scope.some(
              (workspace) => variable.scope.find(
                (_workspace) => ['workspace-all', workspace].includes(_workspace) || _workspace == 'workspace-all')
            )
          )

        // If the nested variable hasn't been defined or it's actually the current variable then skip it
        if (variable == undefined || variable === savedVariable)
          continue

        // Resolve the variable's value recursively
        let resolvedValue = resolveValue(variable)

        // Set the new updated value
        finalValue = `${finalValue}`.replace(foundVariable, resolvedValue)
      }
    } catch (e) {}

    // Return the final value
    return finalValue
  }

  // Iterate through each variable and resolve its value
  for (let variable of variables) {
    // Hold the original value
    variable.originalValue = `${variable.value}`

    // Manipulate the variable's value
    variable.value = resolveValue(variable)
  }

  // Return the variables
  return variables
}
