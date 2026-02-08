/**
 * Get the currently active workspace ID
 *
 * @Return: {string} the currently active workspace ID
 */
let getActiveWorkspaceID = () => activeWorkspaceID || getAttributes($(`#addEditConnectionDialog`), 'data-workspace-id')

/**
 * Get the name of a workspace
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the active or target workspace
 *
 * @Return: {string} the workspace name
 */
let getWorkspaceName = (workspaceID) => getAttributes($(`div.workspace[data-id="${workspaceID}"]`), 'data-name')

/**
 * Get a workspace's full folder path
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {boolean} `?replaceDefault` replace the `${default}` variable with the actual default workspaces folder's path
 *
 * @Return: {string} the path of the target workspace, or an empty value if something went wrong
 */
let getWorkspaceFolderPath = (workspaceID, replaceDefault = true) => {
  try {
    // Define the default path
    let defaultPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces'),
      // Point at the workspace element in the UI
      workspaceElement = $(`div.workspace[data-id="${workspaceID}"]`),
      // Get its folder name and its path
      [folderName, folderPath] = getAttributes(workspaceElement, ['data-folder', 'data-folder-path'])

    try {
      if (workspaceID == 'workspace-sandbox')
        defaultPath = Path.join(defaultPath, '..')
    } catch (e) {}

    try {
      if (![folderName, folderPath].some((attribute) => attribute == undefined))
        throw 0

      let workspace

      if (workspaceID != 'workspace-sandbox') {
        let workspaces = Modules.Workspaces.getWorkspacesNoAsync()

        workspace = workspaces.find((workspace) => manipulateText(workspace.id) == manipulateText(workspaceID))
      } else {
        workspace = {
          id: 'workspace-sandbox',
          defaultPath: true,
          folder: 'localclusters'
        }
      }

      folderName = `${workspace.folder}`
      folderPath = `${workspace.defaultPath ? 'default' : workspace.path}`
    } catch (e) {}

    // Decide whether or not the ${default} variable will be replaced
    folderPath = folderPath == 'default' ? (!replaceDefault ? '${default}' : defaultPath) : folderPath

    // Return the result
    return Path.join(folderPath, folderName)
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}

    // Return an empty value if an error has occurred
    return ''
  }
}

/**
 * Get a list of attributes' values for a given element
 *
 * @Parameters:
 * {object} `element` the HTML element whose attribute's values will be fetched
 * {string || object} `attributes` one attribute name, or group - array - of attributes' names
 *
 * @Return: {string || object} the value of the given attribute, or group - array - of values for attributes
 */
let getAttributes = (element, attributes) => {
  let attributesValues = [] // The final values which be returned

  // If the passed `attributes` is a `string` rather than an `array` then wrap it inside an `array`
  attributes = (typeof attributes != 'object') ? [attributes] : attributes

  /**
   * Loop through given attributes' names
   * Push the value of the current `attribute`
   */
  attributes.forEach((attribute) => attributesValues.push(element.attr(attribute)))

  // Return the result - if there's only one value then return it, otherwise return the entire array -
  return attributesValues.length == 1 ? attributesValues[0] : attributesValues
}

/**
 * Check if a given path exists and is accessible - read/write permissions are granted -
 *
 * @Parameters:
 * {string} `path` the path to be checked
 * {boolean} `?addLogLine` whether or not adding a log line for the process
 *
 * @Return: {boolean} the path is accessible or not
 */
let pathIsAccessible = (path, addLogLine = true) => {
  // Final result which be returned
  let accessible = false

  try {
    // Test the accessibility
    FS.accessSync(`${path}`, FS.constants.R_OK | FS.constants.W_OK)

    // Reaching here means the test has successfully passed
    accessible = true
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Add log for this process
  try {
    if (addLogLine)
      addLog(`Check the path '${path}' is accessible and the user has privileges to manipulate it, result is '${accessible ? '' : 'in'}accessible'`, 'process')
  } catch (e) {}

  // Return the test result
  return accessible
}

/**
 * Get a unique ID for the host machine
 * It is mainly used to identify the source of log files by adding the machine ID as a prefix in their names
 *
 * @Return: {string} the unique machine ID, or an empty value if something went wrong
 */
let getMachineID = async () => {
  // Final result which be returned
  let machineID = ''

  /**
   * Get the unique machine's ID
   * Set the `original` property to `true` to avoid getting a hashed value (sha-256)
   */
  try {
    machineID = await MachineID({
      original: true // Set to `true`; to return the original ID value of the machine rather than a hashed value (SHA-256)
    })
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Return the machine ID
  return machineID
}

/**
 * Clear the temporary files and folders created by the app and its binaries
 * It is called only once in the initialization process of the app
 */
let clearTemp = () => {
  // Define the OS temp folder
  let tempFolder = OS.tmpdir()

  // Add log about this process
  try {
    addLog(`Clear temporary files from the last session`, 'process')
  } catch (e) {}

  // Read the temp folder and get all items (files and folders) in it
  FS.readdir(tempFolder, (err, items) => {
    // If any error has occurred then end this process
    if (err) {
      try {
        errorLog(err, 'functions')
      } catch (e) {}

      return
    }

    // Loop through detected items in the temp folder
    for (let item of items) {
      /**
       * Check if the item ends with the `.cwb` or `.metadata` extensions
       * The `.cwb` item is a `cqlsh.rc` config file created for test connection and it should be removed
       */
      if (['cwb', 'metadata', 'tmp', 'cqldesc', 'checkconn', 'aocwtmp', '_wb.txt'].some((extension) => item.endsWith(`.${extension}`)) || item.startsWith('preview_item_')) {
        // Remove that temporary config file
        try {
          FS.removeSync(Path.join(tempFolder, item))
        } catch (e) {}

        // Skip the upcoming code and move to the next item
        continue
      }

      // Deal with the item as a folder and get all items in it
      FS.readdir(Path.join(tempFolder, item), (err, items) => {
        // If an error has occurred then skip the upcoming code and move to the next item
        if (err)
          return

        // If the current folder contains any of the defined names then remove that folder and all its content
        if (items.some((item) => ['cassandra', 'secretstorage', 'pytz'].some((name) => item.toLowerCase().indexOf(name) != -1)))
          try {
            FS.removeSync(Path.join(tempFolder, item))
          } catch (e) {}
      })
    }
  })
}

/**
 * Excape special characters `. ? * + ^ $ [ ] \ ( ) { } | -` in Regex concept
 *
 * @Parameters:
 * {string} `text` the text that will be manipulated
 *
 * @Return: {string} the passed text after the manipulation process
 */
let quoteForRegex = (text) => `${text}`.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')

/**
 * Create a regular expression for a given plain text
 * The function will escape the special characters (; . , | etc...) in the text; so it's guaranteed that the regex will be safe from unwanted behaviors
 *
 * @Parameters:
 * {string} `text` the text that will be added as a regex
 * {string} `flags` the regex's different flags [s u y i g m]
 *
 * @Return: {object} a regular expression object
 */
let createRegex = (text, flags) => {
  // Escape special characters
  text = quoteForRegex(text)

  // Return a regular expression object
  return new RegExp(text, flags)
}

/**
 * Extract two characters from a given connection name in a systematic way
 *
 * @Example: extractTwoCharsConnectionName('>Local >Cluster') // LC
 * @Example: extractTwoCharsConnectionName('>A>nothertest') // AN
 *
 * @Parameters:
 * {string} `connectionName` the connection name
 *
 * @Return: {string} the two characters to be used
 */
let extractTwoCharsConnectionName = (connectionName) => {
  // Remove all white spaces from the given name
  connectionName = `${connectionName}`.replace(/\s+/gm, ''),
    // Get all characters in array
    allChars = connectionName.split(''),
    // Final result which be returned
    chars = ''

  // Loop through each character
  allChars.forEach((char, index) => {
    // The first chosen character is always the first one in upper case
    if (index == 0) {
      chars += char.toUpperCase()
      return
    }

    // If the current character is in upper case and the second character is not chosen yet then adopt this character
    if (char == char.toUpperCase() && chars.length < 2)
      chars += char
  })

  // If the second character is still not chosen then adopt the second character in the name
  if (chars.length < 2)
    chars += allChars[1].toUpperCase()

  // Return the chosen characters
  return chars
}

/**
 * Detect differentiation between two given texts
 * The process is performed in the background renderer thread
 *
 * @Parameters:
 * {string} `oldText` the old text to be checked
 * {string} `newText` the new text to be checked against the old one
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object} the differentiation between the two given texts as an array
 */
let detectDifferentiation = (oldText, newText, callback) => {
  // Get a random ID for the detection request
  let requestID = getRandom.id(10)

  // Send the request to the main thread
  IPCRenderer.send('detect-differentiation', {
    requestID,
    oldText,
    newText
  })

  // Once a response is received
  IPCRenderer.on(`detect-differentiation:result:${requestID}`, (_, difference) => {
    // Call the callback function with passing the result
    callback(difference)

    try {
      IPCRenderer.removeAllListeners(`detect-differentiation:result:${requestID}`)
    } catch (e) {}
  })
}

/**
 * Set the UI color for specific elements and parts based on the given workspace's color
 *
 * @Parameters:
 * {string} `workspaceColor` the workspace's color in HEX format
 */
let setUIColor = (workspaceColor) => {
  try {
    // Convert the given color from HEX to RGB format `R G B`
    let color = HEXToRGB(workspaceColor).join(' '),
      // Create a Tiny Color object from the given color
      tinyColor = TinyColor(workspaceColor),
      // Define the default and hover state of the background color
      backgroundColor = {
        default: tinyColor.isValid() ? `rgb(${color} / 70%)` : '',
        hover: tinyColor.isValid() ? `rgb(${HEXToRGB(tinyColor.darken(10).toString()).join(' ')} / 70%)` : ''
      },
      // Determine if the color of the element needs to be black based on the lightening of the given color
      textColor = tinyColor.isLight() ? `#252525` : ''

    // Remove the old UI color
    $('style#uicolor').remove()

    // Change the loaders' color
    $('.change-color').css('--uib-color', tinyColor.isValid() ? workspaceColor : '#dfdfdf')

    // If the given color is not valid then stop the entire process
    if (!tinyColor.isValid())
      return

    // For highlight cql statements
    let mainColor = tinyColor.isDark() ? TinyColor(invertColor(tinyColor.toHex())) : tinyColor,
      highlightColors = mainColor.monochromatic().map((color) => {
        color = color.isDark() ? TinyColor(invertColor(color.toHex())) : color

        return `#${color.toHex()}`
      })

    highlightColors[0] = tinyColor.isDark() ? tinyColor.lighten(25) : tinyColor

    highlightColors[0] = `#${highlightColors[0].toHex()}`

    // Define the stylesheet that will be applied
    let stylesheet = `
        <style id="uicolor">
          .changed-bg {background: ${backgroundColor.default} !important}
          .changed-bg:hover {background: ${backgroundColor.hover} !important}
          .checkbox-checked:checked, .form-check-input:not([no-color])[type=checkbox]:checked, .form-check-input:not([no-color]):checked {background: ${backgroundColor.default} !important}
          .checkbox-checked:checked:after {background: ${backgroundColor.hover.replace('70%', '100%')} !important}
          .ui-resizable-handle {background: ${backgroundColor.hover.replace('70%', '0%')} !important}
          .ui-resizable-handle:hover {background: ${backgroundColor.hover.replace('70%', '40%')} !important}
          .checkbox-checked:checked:focus:before {box-shadow: 3px -1px 0 13px ${backgroundColor.hover.replace('70%', '100%')} !important;}
          .form-check-input:not([no-color]):checked:focus:before {box-shadow: 0 0 0 13px ${backgroundColor.hover.replace('70%', '100%')} !important;}
          .checkbox-checked.fixed-colors {background:#af2828 !important}
          .checkbox-checked.fixed-colors:after {background:#af2828 !important}
          .checkbox-checked.fixed-colors:checked {background:#1b8523 !important}
          .checkbox-checked.fixed-colors:checked:after {background:#1b8523 !important}
          .checkbox-checked.fixed-colors:checked:focus:before {box-shadow: 3px -1px 0 13px #1b8523 !important;}
          .form-check-input:not([no-color])[type=checkbox].fixed-colors:checked, .form-check-input:not([no-color]).fixed-colors:checked {background:#1b8523 !important}
          .form-check-input[type=radio]:not([no-color]):checked:after {border-color: ${backgroundColor.hover.replace('70%', '35%')} !important; background-color: ${backgroundColor.hover.replace('70%', '35%')} !important;}
          .form-check-input[type=radio]:not([no-color]):checked {background: ${backgroundColor.hover.replace('70%', '25%')} !important;}
          .changed-color {color: ${textColor} !important}
          .actions-bg {background: ${backgroundColor.default.replace('70%', '5%')} !important; box-shadow: inset 0px 0px 20px 0px ${backgroundColor.default.replace('70%', '10%')} !important;}
          .tabulator-row.tabulator-selectable:hover { background: ${backgroundColor.default.replace('70%', '5%')} !important; }
          .tabulator-row.tabulator-selected { background: ${backgroundColor.default.replace('70%', '35%')} !important; }
          .tabulator-row.tabulator-selected:hover { background: ${backgroundColor.default.replace('70%', '25%')} !important; }
          .column.selected:after {background: ${backgroundColor.default.replace('70%', '100%')} !important;}
          .column.selected > ion-icon {color: ${backgroundColor.default.replace('70%', '100%')} !important;}
          button.aggregate-functions-btn:after, button.column-order-type:after {background: ${backgroundColor.default.replace('70%', '85%')} !important;}
          .nav-tabs .nav-item.show .nav-link, .nav-tabs .nav-link.active, form-check-input:not([no-color]):checked, .form-check-input:not([no-color]):checked:focus, .form-check-input:not([no-color]):checked, .form-check-input:not([no-color]):checked:focus {border-color: ${backgroundColor.default} !important}
          ion-icon[name="lock-closed"] {color: ${backgroundColor.default} !important}
          .jstree-default-dark .jstree-search {background: ${backgroundColor.hover.replace('70%', '15%')} !important;}
          div.sub-output-content div.select-page-rows-container:after {background: ${backgroundColor.default} !important;}
          .tabulator .tabulator-header{border-bottom-color:${backgroundColor.default} !important;}
          .tabulator-row .tabulator-cell.tabulator-editing{border: 1px solid ${backgroundColor.default};}
          .tabulator-row .tabulator-cell.tabulator-editing.copied {box-shadow: inset 0px 0px 20px 5px ${backgroundColor.default};}
          .tabulator .tabulator-footer{border-top-color:${backgroundColor.default} !important;}
          .tabulator .tabulator-header .tabulator-col input:focus, .tabulator .tabulator-header .tabulator-col select:focus{border-color: ${backgroundColor.default} !important}
          .tabulator .tabulator-header .tabulator-col.tabulator-sortable .tabulator-col-content .tabulator-col-sorter .tabulator-arrow {border-top-color: ${backgroundColor.default} !important; color: ${backgroundColor.default} !important;}
          .tabulator .tabulator-header .tabulator-col.tabulator-sortable[aria-sort=ascending] .tabulator-col-content .tabulator-col-sorter .tabulator-arrow {border-bottom-color: ${backgroundColor.default} !important;}
          .tabulator .tabulator-footer .tabulator-page-size, .tabulator .tabulator-footer .tabulator-page {border: 1px solid ${backgroundColor.default} !important;color: #f8f8f8 !important;}
          .tabulator .tabulator-footer .tabulator-page.active{background:${backgroundColor.hover} !important;color: ${textColor} !important}
          .colored-box-shadow{box-shadow: 0px 0px 20px 1px ${backgroundColor.hover.replace('70%', '40%')} !important;}
          :root {--workspace-background-color:${backgroundColor.default};}
          div.connection-type.btn.active {box-shadow: 0 0 15px 1px rgba(0, 0, 0, 0.15), inset 0px 0px 0px 1px ${backgroundColor.default} !important;}
          div.connection-type.btn.active div.icon {background: ${backgroundColor.default} !important; color: ${textColor} !important;}
          .hljs-title, .hljs-name { color: ${highlightColors[1]}; }
          .hljs-number, .hljs-symbol, .hljs-literal, .hljs-deletion, .hljs-link { color: ${highlightColors[2]}; }
          .hljs-string, .hljs-doctag, .hljs-addition, .hljs-regexp, .hljs-selector-attr, .hljs-selector-pseudo { color: ${highlightColors[3]}; }
          .hljs-attribute, .hljs-code, .hljs-selector-id { color: ${highlightColors[4]}; }
          .hljs-keyword, .hljs-selector-tag, .hljs-bullet, .hljs-tag { color: ${highlightColors[0]}; }
          .hljs-subst, .hljs-variable, .hljs-template-tag, .hljs-template-variable { color: ${highlightColors[5]}; }
          .hljs-type, .hljs-built_in, .hljs-quote, .hljs-section, .hljs-selector-class { color: ${highlightColors[4]}; }
          .perfect-datetimepicker table.tt input:focus { border-color: ${backgroundColor.default}; box-shadow: 0 0 6px ${backgroundColor.hover.replace('70%', '60%')}; }
          .perfect-datetimepicker table.tt input:focus { border-color: ${backgroundColor.default}; box-shadow: 0 0 6px ${backgroundColor.hover.replace('70%', '60%')}; }
          .perfect-datetimepicker tbody td.today { color: ${highlightColors[0]}; }
          .perfect-datetimepicker tbody td.selected { border: 1px solid ${backgroundColor.default}; background-color: ${backgroundColor.default}; }
          div.connection.highlight {box-shadow: 0px 0px 25px 0px ${backgroundColor.default.replace('70%', '50%')}, inset 0px 0px 0 2px ${backgroundColor.default.replace('70%', '50%')}; transition: box-shadow 0.15s ease-in-out;}
          .perfect-datetimepicker table td.weekend { color: ${highlightColors[4]}; opacity: 0.5; }
        </style>`

    // Append the stylesheet
    $('body').append($(stylesheet))
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }
}

/**
 * Update the height and navigation state of a given left-side switchers' container
 *
 * @Parameters:
 * {string} `?type` the switchers' container type, values are [`workspace` or `connection`]
 *
 * @Return: {boolean} whether or not the navigation arrows - overflow handling in general - is no longer needed
 */
let updateSwitcherView = (type = 'workspaces') => {
  // Point at the switchers' container
  let switchersContainer = $(`div.body div.left div.content div.switch-${type}`),
    // Get the container's current height
    containerCurrentHeight = switchersContainer.outerHeight(),
    // Get all switchers inside the container
    switchersElements = switchersContainer.children(`div.${type.slice(0, type.length - 1)}`)

  // Decide the allowed new height for the container
  let newHeightAllowed = calcSwitchersAllowedHeight()

  // Divide the new allowed height by 2; as there are two switchers' containers
  newHeightAllowed = newHeightAllowed / 2

  // Define a variable whose value will be incremented while looping through switchers
  let incrementedHeight = 35,
    // Whether or not all switchers after the current one will be shown or not
    showThisSwitcher = true

  // Loop through all switchers
  switchersElements.each(function() {
    // Increment the height
    incrementedHeight += 35

    // Decide to show the current switcher based on the value of `showThisSwitcher`
    $(this).toggle(showThisSwitcher).attr('hidden', showThisSwitcher ? null : '')

    // If the container's current height equals or has exceeded the allowed height then hide all upcoming switchers
    if (incrementedHeight >= newHeightAllowed)
      showThisSwitcher = false
  })

  // Show navigation arrows if one switcher at least is hidden due to overflow
  switchersContainer.toggleClass('show-more', !showThisSwitcher && switchersContainer.children(`div.${type.slice(0, type.length - 1)}`).filter(':visible').length < switchersElements.length)

  // If there's no need to hide any switcher then make sure to show them all
  if (showThisSwitcher)
    switchersContainer.find(`div.${type.slice(0, type.length - 1)}`).filter(':hidden').show()

  /**
   * Set the final height of the container
   *
   * Final height initial value is `10`
   */
  let finalHeight = 10

  // Loop through all switchers in the container
  switchersElements.each(function() {
    // If the switcher is not hidden then add its height to the final height
    if ($(this).is(':visible'))
      finalHeight += 35
  })

  // Set the final height
  switchersContainer.css('height', `${finalHeight}px`)

  // Return if there's an overflow and the navigation arrows are shown or not
  return !showThisSwitcher
}

/**
 * Set the connections' switchers' margin
 * In some cases, the top margin of the first switcher might not be applied as desired so it's handled by this function
 */
let handleConnectionSwitcherMargin = () => {
  // Point at the connections' switchers' container
  let switchersContainer = $(`div.body div.left div.content div.switch-connections`)

  /**
   * Set the margin as needed
   * Get all visible connections in the switcher's container
   */
  let visibleConnections = switchersContainer.children('div.connection').filter(':visible')

  // The first visible connection's top margin should be set to `0`
  visibleConnections.first().css('margin-top', '0px')

  // Any other connection rather than the first one its top margin should be set to `10`
  visibleConnections.filter(':not(:first)').css('margin-top', '10px')

  // Get the number of active connections' work areas
  let numOfActiveWorkareas = $('div.body div.right div.content div[content="workarea"] div.workarea').length

  // If there's one at least then activate the option to close them all in one click - in the more options list -
  $(`div.body div.left div.content div.navigation div.group div.item ul.dropdown-menu li a[action="closeWorkareas"]`).toggleClass('disabled', numOfActiveWorkareas <= 0)
}

/**
 * Calculate the allowed height for switchers - in the left side of the app -
 *
 * @Return: {integer} the allowed height
 */
let calcSwitchersAllowedHeight = () => {
  // Point at the left side content's UI element
  let leftSideContent = $(`div.body div.left div.content`),
    // Get the height of the app's logo
    logoHeight = leftSideContent.children('div.logo').outerHeight(),
    // Get the height of the navigation UI element
    navigationHeight = leftSideContent.children('div.navigation').outerHeight()

  /**
   * Return the final result (left side overall height - (logo height + navigation height + 95))
   * `95px` is a summation of margins and paddings
   */
  return leftSideContent.outerHeight() - (logoHeight + navigationHeight + 95)
}

/**
 * Set the right symbol `®` to "Apache Cassandra®"
 *
 * @Parameters:
 * {string} `text` the text which the `®` symbol will be added to where Cassandra is located
 *
 * @Return: {string} final manipulated text
 */
let setApacheCassandraRightSymbol = (text) => `${text}`.replace(/Cassandra/gm, 'Cassandra®')

/**
 * Add a new log text in the current logging session
 *
 * @Parameters:
 * {string} `log` the log's text
 */
let addLog = (log, type = 'info') => {
  // If the logging feature is not enabled then skip the upcoming code
  if (!isLoggingFeatureEnabled)
    return

  // Send the log text to the main thread
  IPCRenderer.send('logging:add', {
    date: new Date().getTime(),
    log,
    type
  })
}

/**
 * Shorthand the function `addLog(log, ?type)` for handling error's logs
 *
 * @Parameters:
 * {string} `error` the error's text
 * {string} `process` the process's type (example: connections, workpsaces...)
 */
let errorLog = (error, process) => {
  /**
   * Whether the error is a number or not
   * If so, then this error has been thrown for a purpose and there's no need to log it
   */
  let isErrorNotNumber = isNaN(parseInt(error.toString()))

  // If this flag is false then don't log the error
  if (!isErrorNotNumber)
    return

  let errorStack = ''

  try {
    errorStack = error.stack ? `. Stack ${error.stack}` : ''
  } catch (e) {}

  // Log the error
  try {
    addLog(`Error in process ${process}. Details: ${error}${errorStack}`, 'error')
  } catch (e) {}
}

/**
 * Close all active work areas - connections and sandbox projects -
 * This function is called once the user decides to close all work areas, and on app termination
 */
let closeAllWorkareas = () => {
  // Point at all work areas
  let workareas = $('div.body div.right div.content div[content="workarea"] div.workarea[connection-id]')

  // Add log for this  process
  try {
    addLog(`Close all active work areas, count is '${workareas.length}' work area(s)`, 'process')
  } catch (e) {}

  // Loop through each docker/sandbox project and attempt to close it
  Modules.Docker.getProjects().then((projects) => projects.forEach((project) => Modules.Docker.getDockerInstance(project.folder).stopDockerCompose(undefined, () => {})))

  // Loop through all work areas
  workareas.each(function() {
    // Point at the connection's element associated with the current work area
    let connectionElement = $(`div.connections-container div.connections div.connection[data-id="${getAttributes($(this), 'connection-id')}"]`),
      // Also point at the workspace's elemenet associated with the connection
      workspaceElement = $(`div.workspaces-container div.workspace[data-id="${getAttributes(connectionElement, 'data-workspace-id')}"]`),
      // Whether or not the current work area is actually for a sandbox project
      isSandboxProject = getAttributes(connectionElement, 'data-is-sandbox') == 'true'

    try {
      // Attempt of click the `close workarea` button
      $(this).find('div.sub-sides.right div.header div.connection-actions div.action[action="close"] div.btn-container div.btn').click()

      /**
       * Show feedback to the user
       *
       * If the work area is actually for a sandbox project
       */
      if (isSandboxProject)
        return showToast(I18next.capitalize(I18next.t('close work area')), I18next.capitalizeFirstLetter(I18next.replaceData(`the work area of local cluster [b]$data[/b] is being terminated`, [getAttributes(connectionElement, 'data-name')])) + '.', 'success')

      // Otherwise, show this toast
      showToast(I18next.capitalize(I18next.t('close work area')), I18next.capitalizeFirstLetter(I18next.replaceData(`the work area of connection [b]$data[/b] in workspace [b]$data[/b] has been successfully closed`, [getAttributes(connectionElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'success')
    } catch (e) {}
  })
}

/**
 * Show prompt/authentication dialog using sudo
 *
 * @Parameters:
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {boolean} whether or not the process finished with success
 */
let promptSudo = (callback) => {
  try {
    // Attempt to execute common command and show the sudo prompt dialog
    Sudo.exec(`echo ""`, {
        name: 'AxonOps'
      },
      // Return the final result
      (error, stdout, stderr) => callback(!error)
    )
  } catch (e) {
    // Return result with `false` if any error has occured
    callback(false)
  }
}

/**
 * Handle the top header that shows the current workspace and related actions buttons, and it's hidden when a workarea is active
 *
 * @Parameters:
 * {string} `type` the current type of the active item, values are:
 ** ['workspaces', 'connections']
 * {object} `?element` pass a workspace element to get its name and color if needed
 */
let handleContentInfo = (type, element = null) => {
  // Point at the content's info overall container
  let contentInfoContainer = $('div.body div.right div.content-info'),
    /**
     * Point at the left and right sides of the container
     * The left side contains the active workspace color and name
     */
    leftSide = contentInfoContainer.children('div._left'),
    // The right side contains the related actions based on the passed type
    rightSide = contentInfoContainer.children('div._right'),
    // Point at the actions buttons of workspaces
    workspacesActions = rightSide.find('div._actions._for-workspaces'),
    // Point at the actions buttons of connections
    connectionsActions = rightSide.find('div._actions._for-connections'),
    // Show current active workspace - connections -
    connection = leftSide.find('div._connection')

  leftSide.find('div._arrow').add(connection).toggleClass('show', type == 'connections')

  workspacesActions.toggleClass('show', type != 'connections')

  connectionsActions.toggleClass('show', type == 'connections')

  setTimeout(() => $('div.body div.right').removeClass('hide-content-info'), 200)

  try {
    if (element == undefined)
      throw 0

    connection.find('div.text').text(element.attr('data-name'))
    connection.find('div._color').css('background', element.attr('data-color'))
  } catch (e) {}
}

/**
 * Copy a cql statement in the enhanced console
 *
 * @Parameters:
 * {object} `button` the copy button, it's passed in order to catch the statement's content
 */
let copyStatement = (button) => {
  // Get the block's statement
  let content = `${$(button).parent().parent().children('div.text').text()}`,
    // Get the statement's size
    contentSize = Bytes(ValueSize(content))

  // Copy statement to the clipboard
  try {
    Clipboard.writeText(content)
  } catch (e) {
    try {
      errorLog(e, 'connections')
    } catch (e) {}
  }

  // Give feedback to the user
  showToast(I18next.capitalize(I18next.t('copy content')), I18next.capitalizeFirstLetter(I18next.replaceData('content has been copied to the clipboard, the size is $data', [contentSize])) + '.', 'success')
}

/**
 * Execute a cql statement in the enhanced console
 *
 * @Parameters:
 * {object} `button` the execution button, it's passed in order to catch the statement's content
 */
let executeStatement = (button) => {
  // Get the block's statement
  let content = `${$(button).parent().parent().children('div.text').text()}`,
    workareaElement = $(button).closest('div.workarea[workarea-id][connection-id]')

  workareaElement.find(`textarea[data-role="cqlsh-textarea"]`).val(`${content}`).trigger('input')

  setTimeout(() => workareaElement.find(`div.tab-pane[tab="cqlsh-session"]`).find('div.execute').find('button').click())
}

let isHostUbuntu = () => {
  if (OS.platform() != 'linux')
    return false

  try {
    let command = Terminal.runSync('(dpkg --list | less -S) | grep ubuntu-')

    if (command.err || command.stderr)
      return false

    try {
      return minifyText(command.data).includes('ubuntu')
    } catch (e) {
      return false
    }
  } catch (e) {
    return false
  }
}

let removeComments = (statement, trim = false) => {
  let result = `${statement}`

  try {
    result = result.replace(/(?=(?:[^\\'\\"]*(?:\\'|\\")[^\\'\\"]*(?:\\'|\\"))*[^\\'\\"]*$)\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/(?=(?:[^\\'\\"]*(?:\\'|\\")[^\\'\\"]*(?:\\'|\\"))*[^\\'\\"]*$)(^|[^"'])--(?!.*['"]).*$/gm, '$1') // Remove `--` comments
      .replace(/(?=(?:[^\\'\\"]*(?:\\'|\\")[^\\'\\"]*(?:\\'|\\"))*[^\\'\\"]*$)(^|[^"'])\/\/.*$/gm, '$1') // Remove `//` comments

    if (trim)
      result = result.trim()

  } catch (e) {}

  return result
}

let updateContainersManagementToolUI = (tool, getConfig = false) => {
  let update = () => {
    $(`ion-icon.management-tool[name]`).attr('name', ['docker', 'podman'].some((_tool) => `${tool}` == _tool) ? `${tool}-plain` : 'unknown')
  }

  if (!getConfig)
    return update()

  Modules.Config.getConfig((config) => {
    try {
      tool = config.get('features', 'containersManagementTool') || 'none'
    } catch (e) {}

    update()
  })
}

let handleLabelClickEvent = (label) => {
  let checkBoxInput = $(`input#${$(label).attr('for')}`)

  checkBoxInput.prop('checked', !checkBoxInput.prop('checked')).trigger('input')
}

let buildTableFieldsTreeview = (keys = [], columns = [], udts = [], keyspaceUDTs = [], enableBlobPreview = false, singleNode = null, addItemBtnToAll = false) => {
  let treeStructure = {
      'dnd': {
        'is_draggable': false,
        'check_while_dragging': false
      },
      'core': {
        'multiple': false,
        'strings': {
          'Loading ...': ' '
        },
        'themes': {
          'responsive': true,
          'icons': false,
          'name': 'default-dark'
        },
        'check_callback': true,
        'data': []
      },
      'plugins': ['dnd', 'noclose']
    },
    getInputType = (fieldType) => {
      let type = 'text',
        extraProps = {}

      try {
        let number = ['int', 'bigint', 'smallint', 'tinyint', 'varint', 'float', 'double', 'decimal']

        if (!(number.some((type) => type == fieldType)))
          throw 0

        type = 'number'

        extraProps.step = ['float', 'double', 'decimal'].some((type) => type == fieldType) ? 'any' : '1'
      } catch (e) {}

      if (fieldType == 'boolean')
        type = 'switch'

      if (fieldType == 'uuid')
        extraProps.default = 'uuid()'

      if (fieldType == 'timeuuid')
        extraProps.default = 'now()'

      if (addItemBtnToAll)
        extraProps.default = ''

      return {
        type,
        extraProps
      }
    },
    isInsertionAsJSON = $('#rightClickActionsMetadata').attr('data-as-json') === 'true',
    handlers = {
      node: (nodeObject, parentID = '#', ignoreAddItemBtnToAll = false) => {
        let nodeID = getRandom.id(30),
          nodeStructure = {
            'id': nodeID,
            'parent': parentID,
            'state': {
              'opened': true,
              'selected': false
            },
            'a_attr': {
              'name': `${nodeObject.name}`,
              'type': `${nodeObject.type}`,
              'field-type': `${nodeObject.fieldType}`,
              'partition': `${nodeObject.isPartition == true}`,
              'is-reversed': `${nodeObject.isReversed == true}`,
              'static-id': `${nodeID}`,
              'mandatory': nodeObject.isMandatory,
              'no-empty-value': nodeObject.noEmptyValue == true
            }
          },
          manipulatedType = getInputType(nodeObject.type),
          defaultValue = manipulatedType.extraProps.default || null,
          inputStep = manipulatedType.step ? `step="${manipulatedType.step}"` : '',
          isIgnoranceCheckboxShown = false,
          forceToAddItemBtnToAll = !ignoreAddItemBtnToAll && addItemBtnToAll

        try {
          isIgnoranceCheckboxShown = parentID == '#' && nodeObject.fieldType != 'udt-field'
        } catch (e) {}

        defaultValue = defaultValue && !isInsertionAsJSON ? `value="${defaultValue}"` : ''

        let inputFieldUIElement = `
            <div data-is-main-input="true" class="form-outline form-white ignored-applied null-related" style="z-index:1;">
              <div class="clear-field hide" ${manipulatedType.type == 'checkbox' ? 'hidden' : ''}>
                <div class="btn btn-tertiary" data-mdb-ripple-color="light">
                  <ion-icon name="close"></ion-icon>
                </div>
              </div>
              <input type="${manipulatedType.type}" data-field-type="${nodeObject.type}" class="form-control ${manipulatedType.type != 'checkbox' ? 'has-clear-button' : ''}" id="_${getRandom.id(10)}" ${defaultValue} ${inputStep}>
              <label class="form-label">
                <span mulang="value" capitalize></span>
              </label>
              <div class="focus-area"></div>
            </div>`,
          fieldActions = ``

        try {
          if (manipulatedType.type != 'switch')
            throw 0

          let switchBtnID = getRandom.id(10)

          inputFieldUIElement = `
            <div data-is-main-input="true" class="form-check form-switch form-white ignored-applied null-related">
              <input class="form-check-input checkbox-checked" type="checkbox" role="switch" id="_${switchBtnID}" data-field-type="${nodeObject.type}" data-set-indeterminate="true">
              <label class="form-check-label uppercase" for="_${switchBtnID}" onclick="handleLabelClickEvent(this)">not set</label>
              <div class="focus-area checkbox"></div>
            </div>`
        } catch (e) {}

        try {
          if (`${nodeObject.type}` != 'uuid')
            throw 0

          let dropDownBtnID = getRandom.id(30)

          fieldActions = `
            <div class="input-group-text dropend for-insertion for-actions ignored-applied">
              <span class="actions">
                <span mulang="actions" capitalize></span>
                <ion-icon name="right-arrow-filled"></ion-icon>
              </span>
              <button type="button" class="btn btn-light btn-rounded btn-sm dropdown-toggle" data-mdb-ripple-color="dark" data-mdb-dropdown-init aria-expanded="false" id="_${dropDownBtnID}">
              </button>
              <ul class="dropdown-menu for-insertion-actions" data-mdb-auto-close="true" aria-labelledby="_${dropDownBtnID}">
                <li>
                  <a class="dropdown-item" href="#" aria-expanded="false" action="function" data-function="uuid()">
                    <ion-icon name="function"></ion-icon> <code>uuid()</code>
                  </a>
                </li>
              </ul>
            </div>`

          if (isInsertionAsJSON)
            fieldActions = ''
        } catch (e) {}

        try {
          if (`${nodeObject.type}` != 'blob')
            throw 0

          let dropDownBtnID = getRandom.id(30)

          fieldActions = `
            <div class="input-group-text dropend for-insertion for-actions ignored-applied">
              <span class="actions">
                <span mulang="actions" capitalize></span>
                <ion-icon name="right-arrow-filled"></ion-icon>
              </span>
              <button type="button" class="btn btn-light btn-rounded btn-sm dropdown-toggle" data-mdb-ripple-color="dark" data-mdb-dropdown-init aria-expanded="false" id="_${dropDownBtnID}">
              </button>
              <ul class="dropdown-menu for-insertion-actions" data-mdb-auto-close="true" aria-labelledby="_${dropDownBtnID}">
                <li>
                  <a class="dropdown-item" href="#" aria-expanded="false" action="upload-item">
                    <ion-icon name="upload"></ion-icon> <span mulang="upload item" capitalize></span>
                  </a>
                </li>
                <li>
                  <a class="dropdown-item ${!enableBlobPreview ? 'disabled' : ''}" href="#" aria-expanded="false" action="preview-item" ${!enableBlobPreview ? 'style="color: #898989 !important;"' : ''}>
                    <ion-icon name="eye-opened"></ion-icon> <span mulang="preview item" capitalize></span>
                  </a>
                </li>
              </ul>
              <svg l-ring-2 viewBox="0 0 40 40" height="20" width="20" style="--uib-size: 20px; --uib-color: #ffffff; --uib-speed: 0.45s; --uib-bg-opacity: 0.25;">
                <circle class="track" cx="20" cy="20" r="17.5" pathlength="100" stroke-width="2px" fill="none" />
                <circle class="car" cx="20" cy="20" r="17.5" pathlength="100" stroke-width="2px" fill="none" />
              </svg>
            </div>`
        } catch (e) {}

        try {
          if (`${nodeObject.type}` != 'timeuuid')
            throw 0

          let dropDownBtnID = getRandom.id(30)

          fieldActions = `
            <div class="input-group-text dropend for-insertion for-actions ignored-applied">
              <span class="actions">
                <span mulang="actions" capitalize></span>
                <ion-icon name="right-arrow-filled"></ion-icon>
              </span>
              <button type="button" class="btn btn-light btn-rounded btn-sm dropdown-toggle" data-mdb-ripple-color="dark" data-mdb-dropdown-init aria-expanded="false" id="_${dropDownBtnID}">
              </button>
              <ul class="dropdown-menu for-insertion-actions" data-mdb-auto-close="true" aria-labelledby="_${dropDownBtnID}">
                <li>
                  <a class="dropdown-item" href="#" aria-expanded="false" action="function" data-function="now()">
                    <ion-icon name="function"></ion-icon> <code>now()</code>
                  </a>
                </li>
              </ul>
            </div>`

          if (isInsertionAsJSON)
            fieldActions = ''
        } catch (e) {}

        try {
          if (!(['timestamp', 'date', 'duration', 'time'].some((type) => `${nodeObject.type}` == type)))
            throw 0

          let viewMode = 'YMDHMS',
            functionBtn = ``

          switch (nodeObject.type) {
            case 'date': {
              viewMode = 'YMD'
              functionBtn = `
              <li>
                <a class="dropdown-item" href="#" aria-expanded="false" action="function" data-function="current_date()">
                  <ion-icon name="function"></ion-icon> <code>current_date()</code>
                </a>
              </li>`
              break
            }
            case 'duration': {
              viewMode = 'HMS-D'
              break
            }
            case 'time': {
              viewMode = 'HMS'
              functionBtn = `
              <li>
                <a class="dropdown-item" href="#" aria-expanded="false" action="function" data-function="current_time()">
                  <ion-icon name="function"></ion-icon> <code>current_time()</code>
                </a>
              </li>`
              break
            }
            case 'timestamp': {
              functionBtn = `
              <li>
                <a class="dropdown-item" href="#" aria-expanded="false" action="function" data-function="current_timestamp()">
                  <ion-icon name="function"></ion-icon> <code>current_timestamp()</code>
                </a>
              </li>`
              break
            }
          }

          if (isInsertionAsJSON)
            functionBtn = ''

          let dropDownBtnID = getRandom.id(30),
            pickerTitle = 'date time picker'

          switch (viewMode) {
            case 'YMD': {
              pickerTitle = 'date picker'
              break
            }
            case 'HMS': {
              pickerTitle = 'time picker'
              break
            }
            case 'HMS-D': {
              pickerTitle = 'duration picker'
              break
            }
          }

          fieldActions = `
          <div class="input-group-text dropend for-insertion for-actions ignored-applied">
            <span class="actions">
              <span mulang="actions" capitalize></span>
              <ion-icon name="right-arrow-filled"></ion-icon>
            </span>
            <button type="button" class="btn btn-light btn-rounded btn-sm dropdown-toggle" data-mdb-ripple-color="dark" data-mdb-dropdown-init aria-expanded="false" id="_${dropDownBtnID}">
            </button>
            <ul class="dropdown-menu for-insertion-actions" data-mdb-auto-close="true" aria-labelledby="_${dropDownBtnID}">
              <li>
                <a class="dropdown-item" href="#" aria-expanded="false" action="datetimepicker" data-view-mode="${viewMode}">
                  <ion-icon name="${viewMode.startsWith('HMS') ? 'time-outline' : 'calendar'}"></ion-icon> <span mulang="${pickerTitle}" capitalize></span>
                </a>
              </li>
              ${functionBtn}
            </ul>
          </div>`
        } catch (e) {}

        try {
          let isCollectionType = (['map', 'set', 'list'].some((type) => `${nodeObject.type}`.includes(`${type}<`)))

          if (!forceToAddItemBtnToAll && !isCollectionType)
            throw 0

          nodeStructure.a_attr['add-items'] = true

          nodeStructure.a_attr['add-hidden-node'] = getRandom.id(30)

          if (forceToAddItemBtnToAll && isCollectionType)
            nodeStructure.a_attr['is-collection-type'] = true

          if (!forceToAddItemBtnToAll && isCollectionType)
            inputFieldUIElement = ``

          fieldActions = `
            <div class="input-group-text for-insertion for-actions ignored-applied">
              <span class="actions">
                <span mulang="actions" capitalize></span>
                <ion-icon name="right-arrow-filled"></ion-icon>
              </span>
              <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="add-item">
                <ion-icon name="plus"></ion-icon>
                <span mulang="add item"></span>
              </button>
            </div>`
        } catch (e) {}

        try {
          if (keyspaceUDTs.find((udt) => nodeObject.type == udt.name) == undefined)
            throw 0

          inputFieldUIElement = ``

          nodeStructure.a_attr['is-udt'] = true
        } catch (e) {}

        let nullValueSupport = ``

        try {
          if (`${nodeObject.fieldType}` != 'regular-column' || nodeStructure.a_attr['add-items'] == true)
            throw 0

          nullValueSupport = `
          <div class="input-group-text for-insertion for-null-value ignored-applied">
            <button type="button" class="btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" action="apply-null">
              <span class="circle changed-bg"></span>
              <span>NULL</span>
            </button>
          </div>`
        } catch (e) {}

        nodeStructure.text = `
        <div class="input-group">
          <div class="input-group-text for-not-ignoring" ${!isIgnoranceCheckboxShown ? 'hidden' : '' }>
            <div class="not-ignore-checkbox ${nodeObject.fieldType == 'primary-key' ? 'mandatory' : ''}" data-status="true">
              <div class="circle changed-bg"></div>
            </div>
          </div>
          <div class="input-group-text for-insertion for-name ignored-applied" ${nodeObject.name.length <=0 ? 'hidden' : '' }>
            <span class="name">
              <span mulang="name" capitalize></span>
              <ion-icon name="right-arrow-filled"></ion-icon>
            </span>
            <span class="name-value">${nodeObject.name}</span>
          </div>
          ${inputFieldUIElement}
          ${nullValueSupport}
          <div class="input-group-text for-insertion for-type ignored-applied" style="z-index:0;">
            <span class="type">
              <span mulang="type" capitalize></span>
              <ion-icon name="right-arrow-filled"></ion-icon>
            </span>
            <span class="type-value">${EscapeHTML(nodeObject.type)}</span>
          </div>
          ${fieldActions}
        </div>`

        return nodeStructure
      },
      udt: (udtObject, parentID = '#', returnStructure = false) => {
        let udtGroupStrcuture = [],
          isForPrimaryKey = false

        try {
          if (returnStructure != 'PRIMARYKEY')
            throw 0
          isForPrimaryKey = true

          returnStructure = false
        } catch (e) {}

        try {
          let udtID = getRandom.id(30),
            udtNodeStructure = {
              'id': udtID,
              'parent': parentID,
              'state': {
                'opened': true,
                'selected': false
              },
              'a_attr': {
                'name': `${udtObject.name}`,
                'type': `${udtObject.type}`,
                'field-type': 'udt-column',
                'static-id': `${udtID}`,
                'partition': `${udtObject.isPartition == true}`,
                'is-reversed': `${udtObject.isReversed == true}`,
                'mandatory': false,
                'no-empty-value': true
              }
            }

          udtNodeStructure.text = `
          <div class="input-group">
            <div class="input-group-text for-not-ignoring" ${parentID != '#' ? 'hidden' : ''}>
              <div class="not-ignore-checkbox" data-status="true">
                <div class="circle changed-bg"></div>
              </div>
            </div>
            <div class="input-group-text for-insertion for-name ignored-applied"  ${udtObject.name.length <= 0 ? 'hidden' : ''}>
              <span class="name">
                <span mulang="name" capitalize></span>
                <ion-icon name="right-arrow-filled"></ion-icon>
              </span>
              <span class="name-value">${udtObject.name}</span>
            </div>
            <div class="input-group-text for-insertion for-type ignored-applied" style="z-index:0;">
              <span class="type">
                <span mulang="type" capitalize></span>
                <ion-icon name="right-arrow-filled"></ion-icon>
              </span>
              <span class="type-value">${EscapeHTML(udtObject.type)}</span>
            </div>
          </div>`

          if (returnStructure) {
            udtGroupStrcuture.push(udtNodeStructure)
          } else {
            groupStructure[!isForPrimaryKey ? 'udtColumns' : 'primaryKey'].core.data.push(udtNodeStructure)
          }

          for (let i = 0; i < udtObject.field_names.length; i++) {
            let fieldName = udtObject.field_names[i],
              fieldType = udtObject.field_types[i]

            fieldType = removeFrozenKeyword(fieldType)

            try {
              let fieldUDT = keyspaceUDTs.find((udt) => fieldType == udt.name)

              if (fieldUDT == undefined)
                throw 0

              let fieldUDTStructure = handlers.udt({
                ...fieldUDT,
                name: fieldName,
                type: fieldType
              }, udtID, returnStructure)

              if (returnStructure)
                udtGroupStrcuture.push(fieldUDTStructure)

              continue
            } catch (e) {}

            try {
              let fieldNodeStructure = handlers.node({
                name: fieldName,
                type: fieldType,
                fieldType: 'udt-field',
                isMandatory: false,
                isPartition: udtObject.isPartition,
                noEmptyValue: true
              }, udtID, true)

              if (returnStructure) {
                udtGroupStrcuture.push(fieldNodeStructure)
              } else {
                groupStructure[!isForPrimaryKey ? 'udtColumns' : 'primaryKey'].core.data.push(fieldNodeStructure)
              }
            } catch (e) {}
          }
        } catch (e) {}

        if (returnStructure)
          return udtGroupStrcuture

      }
    },
    groupStructure = {},
    groups = ['primaryKey', 'regularColumns', 'collectionColumns', 'udtColumns']

  if (singleNode != null)
    return singleNode.isUDT ? handlers.udt(singleNode, '#', true) : handlers.node(singleNode)

  for (let group of groups)
    groupStructure[group] = JSON.parse(JSON.stringify(treeStructure))

  for (let key of keys) {
    let keyUDT = keyspaceUDTs.find((udt) => removeFrozenKeyword(key.type) == udt.name),
      isKeyUDT = keyUDT != undefined

    try {
      if (isKeyUDT)
        key.type = removeFrozenKeyword(key.type)
    } catch (e) {}

    let keyNodeObject = {
      ...key,
      fieldType: 'primary-key',
      isMandatory: true
    }

    try {
      if (!isKeyUDT)
        throw 0

      keyNodeObject = {
        ...keyUDT,
        ...keyNodeObject
      }
    } catch (e) {}

    try {
      let keyNodeStructure = handlers[isKeyUDT ? 'udt' : 'node'](keyNodeObject, '#', isKeyUDT ? 'PRIMARYKEY' : false)

      groupStructure.primaryKey.core.data.push(keyNodeStructure)
    } catch (e) {}
  }

  for (let column of columns) {
    try {
      let columnNodeStructure = handlers.node({
          ...column,
          fieldType: 'regular-column',
          isMandatory: false
        }, '#'),
        isTypeCollection = ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`))

      if (isTypeCollection) {
        groupStructure.collectionColumns.core.data.push(columnNodeStructure)
      } else {
        groupStructure.regularColumns.core.data.push(columnNodeStructure)
      }
    } catch (e) {}
  }

  for (let udt of udts)
    handlers.udt(udt)

  return groupStructure
}

/**
 * https://nodejs.org/api/net.html#netisipinput
 * Returns `6` if input is an IPv6 address
 * Returns `4` if input is an IPv4 address in dot-decimal notation with no leading zeroes
 * Otherwise, returns 0
 */
const isIP = require('net').isIP

const isUUID = require('uuid').validate

let addDoubleQuotes = (text) => {
  try {
    if (typeof text == 'string' && `${text}` != `${text}`.toLowerCase() && !`${text}`.startsWith('"'))
      text = `"${text}"`
  } catch (e) {}

  return text
}

let escapeSingleQuotes = (text) => text.replace(/(^|[^'])'([^']|$)/g, "$1''$2")

let getBlobType = (blobHEXString, callback) => {
  let blobBytes = []

  try {
    blobBytes = ConvertHEX.hexToBytes(`${blobHEXString}`.slice(0, 24))
  } catch (e) {}

  DetectFileType.fromBuffer(blobBytes, (err, result) => callback(err, result))
}

let getCheckedValue = (groupName) => {
  let selectedValue = '',
    radioButtons = document.getElementsByName(groupName)

  for (let i = 0; i < radioButtons.length; i++) {
    if ($(radioButtons[i]).prop('checked')) {
      selectedValue = radioButtons[i].getAttribute('id')
      break
    }
  }

  return selectedValue
}

let removeFrozenKeyword = (text, attemptNum = 1) => {
  try {
    if (`${text}`.match(/frozen</) == null || attemptNum >= 100)
      return text

    text = text.replace(/frozen<([^>]*)>/g, '$1')

    return removeFrozenKeyword(text, ++attemptNum)
  } catch (e) {
    return text
  }
}

let groupActivitiesBySource = (activities) => {
  let groupedActivities = {}

  activities.forEach((activity) => {
    if (!groupedActivities[activity.source])
      groupedActivities[activity.source] = []

    groupedActivities[activity.source].push(activity)
  })

  return groupedActivities
}

let removeArrayDuplicates = (arr, attr) => arr.filter((stObj, i, a) => a.findIndex(ndObj => ndObj[attr] === stObj[attr]) === i)

let convertJSONObjectToYAML = (jsonObject) => {
  let yamlString = ''

  try {
    yamlString = YAML.stringify(jsonObject)

    yamlString = `---\n${yamlString}---\n`
  } catch (e) {}

  return yamlString
}

/**
 * Helper function to decode file:///… for folders
 */
let fileURLToLocalPath = (uri) => {
  try {
    let u = new URL(uri)

    if (u.protocol !== 'file:')
      return null

    return decodeURI(u.pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  } catch {
    return null
  }
}

/**
 * Important function to dispose resources and prevent memory leaks
 * Should be called on window unload/exiting the workbench to clear all intervals, dispose editors, destroy charts, etc...
 */
let cleanupResources = () => {
  // Clear all old intervals
  try {
    Object.keys(globalTrackers.intervals).forEach((interval) => {
      try {
        if (globalTrackers.intervals[interval]) {
          clearInterval(globalTrackers.intervals[interval])

          globalTrackers.intervals[interval] = null
        }
      } catch (e) {}
    })
  } catch (e) {}

  // Clear all old workspace path watcher timeouts
  try {
    Object.keys(globalTrackers.workspaceWatchers).forEach((workspaceID) => {
      try {
        clearTimeout(globalTrackers.workspaceWatchers[workspaceID])

        delete globalTrackers.workspaceWatchers[workspaceID]
      } catch (e) {}
    })
  } catch (e) {}

  // Clear all connection path watcher timeouts
  try {
    Object.keys(globalTrackers.connectionWatchers).forEach((connectionID) => {
      try {
        clearTimeout(globalTrackers.connectionWatchers[connectionID])
        delete globalTrackers.connectionWatchers[connectionID]
      } catch (e) {}
    })
  } catch (e) {}

  // Destroy all Tippy tooltip instances
  try {
    mdbObjects.filter((obj) => obj.type === 'Tooltip').forEach((obj) => {
      try {
        if (obj.object && obj.object.destroy)
          obj.object.destroy()
        // Clear from WeakMap index
        let domNode = (obj.element && obj.element[0]) || obj.element
        let typeMap = mdbObjectsIndex.get(domNode)
        if (typeMap) delete typeMap['Tooltip']
      } catch (e) {}
    })

    // Clear Tippy instances from mdbObjects
    mdbObjects = mdbObjects.filter((obj) => obj.type !== 'Tooltip')
  } catch (e) {}

  // Dispose all Monaco editors
  try {
    monaco.editor.getEditors().forEach((editor) => {
      try {
        editor.dispose()
      } catch (e) {}
    })

    // Clear the diff editors array
    diffEditors.length = 0
  } catch (e) {}

  // Destroy all Chart.js instances
  try {
    Object.keys(queryTracingChartsObjects).forEach((chartKey) => {
      try {
        if (queryTracingChartsObjects[chartKey]) {
          queryTracingChartsObjects[chartKey].destroy()

          delete queryTracingChartsObjects[chartKey]
        }
      } catch (e) {}
    })
  } catch (e) {}

  // Dispose all terminals
  try {
    terminalObjects.forEach((terminal) => {
      try {
        terminal.dispose()
      } catch (e) {}
    })

    terminalObjects.length = 0

    terminalFitAddonObjects.length = 0
  } catch (e) {}

  // Remove webview event listeners
  try {
    $('webview').each(function() {
      try {
        $(this).off('did-start-loading')

        $(this).off('did-stop-loading')

        $(this).off('dom-ready')

        $(this).off('ipc-message')
      } catch (e) {}
    })
  } catch (e) {}

  // Disconnect all tracked observers (`ResizeObserver` and `MutationObserver`)
  try {
    globalTrackers.observers.forEach((observer) => {
      try {
        observer.disconnect()
      } catch (e) {}
    })

    globalTrackers.observers.length = 0
  } catch (e) {}

  // Remove all jQuery event listeners from document
  try {
    $(document).off('initialize')

    $(document).off('clearEnhancedConsole')
  } catch (e) {}

  // Clear all pending timeouts/intervals (except the tracked ones)
  try {
    // Get highest timeout ID by creating and immediately clearing a timeout
    let highestTimeoutId = setTimeout(() => {}, 0)

    for (let i = 0; i < highestTimeoutId; i++) {
      // Skip our tracked global intervals
      if (!Object.values(globalIntervals).includes(i)) {
        clearTimeout(i)

        clearInterval(i)
      }
    }
  } catch (e) {}

  // Clear performance observer buffers (fixes PerformanceLongAnimationFrameTiming leak)
  try {
    if (!window.performance)
      throw 0

    // Clear all performance entries
    performance.clearMarks()

    performance.clearMeasures()

    performance.clearResourceTimings()
  } catch (e) {}
}
