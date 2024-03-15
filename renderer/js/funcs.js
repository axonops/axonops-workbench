/**
 * Get the Material Design's object related to a passed UI element
 *
 * @Parameters:
 * {object} `element` the HTML element in the UI
 * {string} `?type` the type of the element to be fetched, all possible types are: [`Button`, `Dropdown`, `Input`, `Modal`, `Range`, `Ripple`, `Tab`, `Tooltip`]
 *
 * @Return: {object} the Material Design's object
 */
let getElementMDBObject = (element, type = 'Input') => {
  // Define the final object which be returned
  let object = null

  // Check if the MDB object has already been created
  try {
    // Get the MDB object by filtering all created objects
    let foundObject = allMDBObjects.filter((object) => object.element.is(element) && object.type == type)

    // If it has already been found then return it
    if (foundObject.length != 0)
      return foundObject[0].object
  } catch (e) {}

  /**
   * Check if the type is a tooltip
   * Tooltips are handled by `TippyJS` instead of MDB tooltip; because `Tippy` adds a trackable ID to the created tooltip element; so we can change its position as needed
   * This feature is available by many libraries besides `TippyJS`, it's not available in MDB or `Bootstrap` though
   */
  try {
    // If the type is not a tooltip then skip this try-catch block
    if (type != 'Tooltip')
      throw 0

    // Create a `Tippy` instance
    object = tippy(element[0], {
      content: getAttributes(element, 'data-title'),
      arrow: false,
      theme: 'material',
      placement: getAttributes(element, 'data-mdb-placement'), // Placement is based on the attribute
      allowHTML: getAttributes(element, 'data-mdb-html') == 'true', // Allowance is also based on the attribute
      // Once the tooltip is about to be shown
      onShow(instance) {
        // Get the current zoom level of the app
        let zoomLevel = parseFloat($('body').css('zoom')),
          // Point at the instance's popper and reference UI elements
          popper = $(instance.popper),
          reference = $(instance.reference)

        try {
          // If there's no zoom - 1 means 100% - then skip this try-catch block
          if (zoomLevel == 1)
            throw 0

          // Get the tooltip's parent/reference offset
          let referenceOffset = reference.offset()

          // Set the initial position of the tooltip
          let translate = {
            x: referenceOffset.left,
            y: referenceOffset.top
          }

          // Inner function to set the final position of the tooltip
          let setOffset = (translate) => {
            popper.css({
              'transform': `translate(${parseInt(translate.x)}px, ${parseInt(translate.y)}px)`,
              'inset': '0 auto auto 0'
            })
          }

          /**
           * Switch between the different placements
           * Each placement has its equation to be executed
           */
          setTimeout(() => {
            switch (instance.props.placement) {
              case 'left': {
                translate.x -= popper.outerWidth() + 10
                translate.y -= reference.outerHeight() / 2 - popper.outerHeight() / 2
                break
              }
              case 'right': {
                translate.x += reference.outerWidth() + 10
                translate.y += reference.outerHeight() / 2 - popper.outerHeight() / 2
                break
              }
              case 'top': {
                translate.y -= reference.outerHeight() + 10
                translate.x += reference.outerWidth() / 2 - popper.outerWidth() / 2
                break
              }
              case 'bottom': {
                translate.y += reference.outerHeight() + 10
                translate.x += reference.outerWidth() / 2 - popper.outerWidth() / 2
                break
              }
            }
            setOffset(translate)
          })
        } catch (e) {}
      }
    })

    // Push the created object to be returned later once it's called
    allMDBObjects.push({
      element,
      object,
      type: 'Tooltip'
    })

    // Return the final object and skip the upcoming code
    return object
  } catch (e) {}

  /**
   * Reaching here means the type is not `Tooltip`
   *
   * Attempt to create the MDB object by passing the element itself
   */
  try {
    object = new mdb[type](element[0])
  } catch (e) {
    // If the element itself is invalid for the MDB class then pass the element's parent
    try {
      object = new mdb[type](element.parent()[0])
    } catch (e) {}
  }

  // Push the created object to be returned later once it's called
  allMDBObjects.push({
    element,
    object,
    type,
  })

  // Return the final object
  return object
}

/**
 * Load JS script in a synchronous way
 *
 * @Parameters:
 * {string} `path` the path to the JS file in the project
 */
let loadScript = (path) => {
  /**
   * Call the JQuery's HTTP request function
   * Set `async attribute` to `false`; to be sure the script was loaded before executing the upcoming code
   */
  $.ajax({
    url: path,
    async: false,
    dataType: 'script'
  })
}

/**
 * Load a stylesheet - CSS file -
 *
 * @Parameters:
 * {string} `path` the path to the CSS file in the project
 */
let loadStyleSheet = (path) => $('head').prepend(`<link rel="stylesheet" href="${path}">`)

/**
 * Show toast at the bottom center of the app
 * The toast - structure, style, code, etc... - has been created especially for the app
 *
 * @Parameters:
 * {string} `title` the title of the toast
 * {string} `text` the text to be shown in the toast
 * {string} `?type` the toast's type, the value could be: [`success`, `failure`, `warning`, and `neutral`]
 * {string} `?toastID` if an ID has been passed then the toast will be pinned for a while
 * {object} `?clickCallback` a function to be called once the navigation icon is clicked - will be shown only if a callback function has been passed -
 */
let showToast = (title, text, type = 'neutral', toastID = '', clickCallback = null) => {
  /**
   * Set the proper time-out
   * This is performed either by just setting it to 5.5s or based on the text's length with a maximum time of 15s
   */
  let minTimeout = 5500,
    maxTimeout = 15000,
    timeout = minTimeout

  /**
   *  Calculate the showing time
   * Every character in the text is adding 50ms to the time
   */
  timeout = text.length * 50

  /**
   * Maximum acceptable time is 15s, minimum is 5.5s
   * Timeout more than `15s`? `true` then `= 15s`,
   * `false` then timeout is less than `5.5s`? `true` then `= 5.5s`,
   * `false` then adopt the calculated time
   */
  timeout = timeout > maxTimeout ? maxTimeout : (timeout < minTimeout ? minTimeout : timeout)

  // Add the toast's content as a log
  {
    // Define the log's type
    let logType = (['success', 'neutral']).some((_type) => type == _type) ? 'info' : (type == 'failure' ? 'error' : type)

    // Add the log - toast's title and text -
    addLog(`${StripTags(title)}: ${StripTags(text)}`, logType)
  }

  // Whether or not the `toast-id` attribute will be added
  let addToastID = toastID.length != 0 ? `toast-id="${toastID}"` : '',
    // Whether or not specified elements will be hidden
    hideElement = toastID.length != 0 ? 'hidden' : ''

  // Toast UI element strucutre
  let element = `
      <div class="toast ${toastID.length <= 0 ? 'show' : ''}" ${addToastID}>
        <div class="toast-header">
          <span class="toast-type ${type}">
            <lottie-player src="../assets/lottie/${type}.json" background="transparent" autoplay ${toastID.length != 0 ? 'loop speed="0.9"' : ''}></lottie-player>
          </span>
          <strong class="me-auto">${title}</strong>
          <button type="button" class="navigation" ${clickCallback == null ? 'hidden' : '' }>
            <ion-icon name="navigation"></ion-icon>
          </button>
          <button type="button" class="btn-close" ${hideElement}></button>
        </div>
        <div class="toast-body" dir="auto">
          ${text}
        </div>
        <div class="hide-progress ${type}" ${hideElement}>
          <div class="bar"></div>
        </div>
      </div>`

  // Append the toast to the main toasts' container
  $('body div.toast-container').append($(element).show(function() {
    // Point at the toast element
    let toast = $(this),
      // Point at the progress bar
      progressBar = toast.find('div.bar'),
      // Point at the close button
      closeBtn = toast.find('button.btn-close'),
      // Point at the navigation button
      navigationBtn = toast.find('button.navigation')

    // Animate the toast's shown
    toast.addClass('animate')

    try {
      // If the toast is pinned then there's no need to progress bar
      if (toastID.length != 0)
        throw 0

      // Start to animate the decreasing of the progress bar after 100ms of creation
      setTimeout(() => {
        progressBar.animate({
          width: '0%'
        }, timeout - 200).promise().done(() => {
          // Once the animation is done click the close button
          closeBtn.click()
        })
      }, 150)
    } catch (e) {}

    // Clicking the close button
    closeBtn.click(() => {
      // Hide the toast with fading animation
      toast.addClass('animate-hide')

      // Remove the toast after it's hidden
      setTimeout(() => toast.remove(), 120)
    })

    try {
      // If there's no passed callback function then skip this try-catch block
      if (clickCallback == null)
        throw 0

      // Clicking the navigation button will lead to calling the callback function
      navigationBtn.click(() => clickCallback())
    } catch (e) {}
  }))

  // If the toast is pinned then there's no need to add it in the notifications center
  if (toastID.length != 0)
    return

  /**
   * Check if the main window is being focused or not
   * Based on the result the notification/toast may be pushed to the notifications center
   */
  {
    // Send request to the main thread; to return if the main window is being focused or not
    IPCRenderer.send('window:focused')

    // Remove all previous listeners
    IPCRenderer.removeAllListeners('window:focused')

    // Got a response from the main thread
    IPCRenderer.on('window:focused', (_, focused) => {
      // If the main window is being focused then skip this entire process - no need to push the toast -
      if (focused)
        return

      // Point at the notifications' container
      let container = $('div.body div.hidden-area div.content.notifications-center div.notifications-container'),
        // Point at the notifications center's action button - at the left side -
        actionBtn = $('div.body div.left div.content div.navigation div.group div.item[action="notifications-center"]')

      // Remove the emptiness class
      container.parent().removeClass('_empty')

      // Add `active` class to the action's button - to notify the user about a new notification -
      actionBtn.find('div.sub-content.btn').addClass('active'); // This semicolon is critical here

      // Play the icon's animation
      (actionBtn.find('lottie-player'))[0].play()

      // Prepend the notification to the container
      container.prepend($(element).hide(function() {
        // Clean the toast be removing the unnecessary elements
        ($(this).find('div.toast-header').find('button')).add($(this).find('div.hide-progress')).remove()

        // Get the current timestamp
        let time = new Date().getTime(),
          // Define a footer to be appended to the toast
          toastFooter = `
          <div class="toast-footer" s-ago-time="${time}">
            ${ReadableTime(new Date(time))}
          </div>`

        // Append the footer
        $(this).append($(toastFooter).show(() => $(this).show().addClass('show new')))
      }))
    })
  }
}

/**
 * Shorthand the function `showToast(title, text, ?type, ?toastID, ?clickCallback)` in case the toast will be pinned and its content will be updated
 *
 * @Parameters:
 * {string} `pinnedToastID` The ID of the toast that will be created
 * {string} `title` the title of the toast
 * {string} `text` the text to be shown in the toast
 */
let showPinnedToast = (pinnedToastID, title, text) => showToast(title, text, 'bg-progress', pinnedToastID)

/**
 * Update a pinned toast's text/content
 *
 * @Parameters:
 * {string} `pinnedToastID` The ID of the toast which its content will be updated
 * {string} `text` the text to be shown in the toast
 * The `text` argument can be set to `true`; so the function will keep the body's content
 * Also the double plus character `++` can be prefixed so the function will append the given text
 * {boolean} `?destroy` whether or not the pinned toast should be destroyed
 */
let updatePinnedToast = (pinnedToastID, text, destroy = false) => {
  try {
    // Point at the toast
    let toast = $(`div.toast-container div.toast[toast-id="${pinnedToastID}"]`),
      // Find the toast's body
      toastBody = toast.find('div.toast-body'),
      // Point at the progress bar
      progressBar = toast.find('div.bar'),
      // Point at the hidden progress bar
      hideProgressBar = toast.find('div.hide-progress'),
      // Find the toast's close button
      closeBtn = toast.find('button.btn-close')

    // Show the toast if needed
    if (text != true && `${text}`.length != 0)
      toast.addClass('show')

    try {
      // If the passed `text` is not set to `true` then skip this try-catch block and keep the body's content
      if (text == true)
        throw 0

      // If the passed `text` has `++` prefixed then append the given text instead of replacing the body's content with it
      if (text.indexOf('++') == 0) {
        // Get the current content
        let content = toastBody.html()

        // Append the given text
        toastBody.html(`${content}<code>${text.slice(2)}</code><br>`)

        // Skip the upcoming code in the try-catch block
        throw 0
      }

      // Update the toast's body content
      toastBody.html(text)
    } catch (e) {}

    // Always scroll to the very bottom of the toast's body
    toastBody.animate({
      scrollTop: toastBody.get(0).scrollHeight
    }, 1)

    // If the toast needs to be destroyed
    if (!destroy)
      return

    // Show the close button
    closeBtn.add(hideProgressBar).removeAttr('hidden')

    // Start to animate the decreasing of the progress bar after 100ms
    setTimeout(() => {
      progressBar.animate({
        width: '0%'
      }, 10000).promise().done(() => {
        // Once the animation is done click the close button
        closeBtn.click()
      })
    }, 150)
  } catch (e) {}
}

/**
 * Format a given timestamp to readable text
 *
 * @Parameters:
 * {integer} `timestamp` the timestamp value to be formatted
 * {boolean} `?isSecondFormat` return the second format `Year-Month-Day Hours:Minutes:Seconds`
 *
 * @Return: {string} formatted timestamp `Day-Month-Year Hours:Minutes:Seconds`
 */
let formatTimestamp = (timestamp, isSecondFormat = false) => {
  // Define the final result to be returned
  let format = ''

  try {
    // Get the date object based on the given timestamp, and get the year, month, and day of that timestamp
    let date = new Date(timestamp),
      year = date.getUTCFullYear(),
      month = date.getUTCMonth(),
      day = date.getUTCDate()

    // Manipulate month and day values; by adding `0` to what is less than `10`, and normalize the month's value
    month = month < 1 ? 1 : ((month > 12) ? 12 : (++month))
    month = month < 10 ? `0${month}` : month
    day = day < 10 ? `0${day}` : day

    // Get left hours, minutes, and seconds in the given timestamp
    let hours = date.getHours(),
      minutes = date.getMinutes(),
      seconds = date.getSeconds()

    // Manipulate hours, minutes, and seconds values; by adding `0` to what is less than `10`
    hours = hours < 10 ? `0${hours}` : hours
    minutes = minutes < 10 ? `0${minutes}` : minutes
    seconds = seconds < 10 ? `0${seconds}` : seconds

    // Define the default format
    format = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`

    // If it's required to adopt the second format
    if (isSecondFormat)
      format = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (e) {}

  // Return the human-readable result
  return format
}

/**
 * Repair a given JSON in string format
 * Unwanted chars and symbols will be removed
 * The purpose of this process is to fix the passed JSON string; so it'll be able to be parsed into an object
 *
 * @Parameters:
 * {string} `json` the JSON string to be repaired
 *
 * @Return: {string} final repaired JSON string, or the original string if an error has occurred
 */
let repairJSON = (json) => {
  let result = json // Final result which be returned

  try {
    // Replace non-ascii chars except the ones which are used to build a valid JSON
    json = json.replace(/[^\x20-\x7E{}[\]:,"']/g, '')
      // Remove some added chars from the cqlsh tool and terminal
      .replace(/1C/g, '')
      .replace(/u\'/gm, "'")
      // Remove an added bracket to `keyspace_name` attribute that can lead to an error
      .replace(/\'\:\[\'keyspace_name\'/g, "':'keyspace_name'")
      // Get rid of the `OrderedMapSerializedKey` object - cause the repairing process to fall apart -
      .replace(/OrderedMapSerializedKey\(\[.*?\]\)/g, "''")

    // Attempt to match the JSON block `{...JSON content...}`
    try {
      json = json.match(/\{[\s\S]+/gm)[0]
    } catch (e) {}

    // Repair the JSON string after the manipulation process
    json = JSONRepair(json)

    // Update the result with the new repaired JSON string
    result = json
  } catch (e) {} finally {
    // Return the final result
    return result
  }
}

/**
 * Build a full tree-view model from a given metadata
 *
 * @Parameters:
 * {object} `metadata` the given metadata from the main thread
 * {boolean} `ignoreTitles` whether or not titles - like `Keyspace:`, `Table:` will not be added as prefix
 *
 * @Return: {object} a valid tree structure to be rendered
 */
let buildTreeview = (metadata, ignoreTitles = false) => {
  /**
   * Due to the way JSTree is coded, there's an issue with the paths in Windows
   * To solve this issue, this function replaces the backward slashes
   * If the OS is not Windows it'll simply return the path without any manipulation
   */
  let normalizePath = (path) => OS.platform == 'win32' ? path.replace(/\\/gm, '/') : path

  // Get a keyspaces container's random ID
  let keyspacesID = getRandomID(30),
    // Define the path of extra icons to be used with each leaf
    extraIconsPath = normalizePath(Path.join(__dirname, '..', 'js', 'jstree', 'theme', 'extra')),
    // The initial tree structure
    treeStructure = {
      'types': {
        'default': {
          'icon': normalizePath(Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
        }
      },
      'dnd': {
        'is_draggable': false,
        'check_while_dragging': false
      },
      'core': {
        'strings': {
          'Loading ...': ' '
        },
        'themes': {
          'responsive': true,
          'name': 'default-dark'
        },
        'data': [
          // Cluster's name
          {
            id: getRandomID(30),
            parent: '#',
            text: `Cluster: <span>${metadata.cluster_name}</span>`,
            type: 'default',
            a_attr: {
              'allow-right-context': 'true',
              'name': metadata.cluster_name,
              'type': 'cluster'
            }
          },
          // Partitioner
          {
            id: getRandomID(30),
            parent: '#',
            text: `Partitioner: <span>${metadata.partitioner}</span>`,
            type: 'default',
          },
          // Is it a database as a service?
          // {
          //   id: getRandomID(30),
          //   parent: '#',
          //   text: `DBaaS: <span class="material-icons for-treeview">${metadata.dbaas ? 'check': 'close'}</span>`,
          //   type: 'default',
          // },
          // The keyspaces' container
          {
            id: keyspacesID,
            parent: '#',
            text: `Keyspaces (<span>${metadata.keyspaces.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'keyspaces.png')),
          }
        ]
      },
      'plugins': ['types', 'contextmenu'],
      'contextmenu': {
        'select_node': false
      }
    }

  /**
   * Inner function to build a child's leaf and append it to the tree view
   *
   * @Parameters:
   * {string} `parentID` The child parent's ID
   * {string} `childID` The child's ID
   * {string} `text` the text to be shown in the leaf/node
   * {object} `object` the child's object
   * {string} `?icon` the name of the icon to be used with the leaf
   * {string} `?parentType` the child's parent type - partition, clustering, etc... -
   */
  let buildTreeViewForChild = (parentID, childID, text, object, icon = null, parentType = '') => {
    // Define the set parent type
    let setParentType = icon || parentType

    // Define the child's structure
    let structure = {
      id: childID,
      parent: parentID,
      text: `<span>${object.name}</span>`,
      type: 'default',
      parentType: setParentType
    }

    // If the title needs to be added then do this addition as a prefix
    if (!ignoreTitles)
      structure.text = `${text}: ${structure.text}`

    // If an icon has been passed then add it to the leaf's structure
    if (icon != null)
      structure.icon = normalizePath(Path.join(extraIconsPath, `${icon}.png`))

    try {
      // Check if the child is not any of the defined types then skip this try-catch block
      if (['Keyspace', 'Table', 'View'].every((type) => text != type))
        throw 0

      // Set an `a_attr` attribute with important sub-attributes
      structure.a_attr = {
        'allow-right-context': 'true',
        'name': object.name,
        'type': `${text}`.toLowerCase(),
        'keyspace': parentType
      }
    } catch (e) {}

    /**
     * If the child is a table or view then make sure to set the `parentType` to empty
     * Not doing this would lead to incorrect structure
     */
    if (['Table', 'View'].some((type) => type == text))
      parentType = ''

    // Push the structure into the overall tree structure
    treeStructure.core.data.push(structure)

    try {
      /**
       * Check if the child has one or more of these attributes
       *
       * Define the attributes' names
       */
      let attributes = ['virtual', 'durable_writes', 'is_cql_compatible', 'is_static', 'is_reversed']

      if (parentType == 'partitionKeys')
        attributes = attributes.slice(0, -2)

      // Loop through them all
      attributes.forEach((attribute) => {
        // If the child doesn't have this attribute then skip it and move to the next one
        if (object[attribute] == undefined)
          return

        // Otherwise, define that attribute's structure
        let structure = {
          id: getRandomID(30),
          parent: childID,
          text: `${I18next.capitalize(attribute.replace(/\_/gm, ' ')).replace(/Cql/gm, 'CQL')}: <span class="material-icons for-treeview">${object[attribute] ? 'check' : 'close'}</span>`,
          type: 'default'
        }

        // If the attribute is `virtual` then add its value as sub attribute
        if (attribute == 'virtual')
          structure.virtualValue = object[attribute] ? true : false

        // Display the `is_static` attribute only if it's `true`
        if (attribute == 'is_static' && !object[attribute])
          return

        // Append that attribute to the child
        treeStructure.core.data.push(structure)
      })
    } catch (e) {}

    // Check if the child has a CQL type
    try {
      // If the child doesn't have a cql_type attribute then skip this try-catch block
      if (object.cql_type == undefined)
        throw 0

      // Otherwise, define that attribute's structure
      let cqlType = {
        id: getRandomID(30),
        parent: childID,
        text: `CQL Type: <span>${object.cql_type}</span>`,
        type: 'default',
      }

      // Append that attribute to the child
      treeStructure.core.data.push(cqlType)
    } catch (e) {}
  }

  // Loop through the keyspaces
  metadata.keyspaces.forEach((keyspace) => {
    // Get a unique ID for the current keyspace, and an ID for its tables' container
    let [
      keyspaceID,
      tablesID
    ] = getRandomID(30, 2)

    // Build tree view for the keyspace
    buildTreeViewForChild(keyspacesID, keyspaceID, `Keyspace`, keyspace, 'keyspace')

    // Tables' container that will be under the keyspace container
    let tablesStructure = {
      id: tablesID,
      parent: keyspaceID, // Under the current keyspace
      text: `Tables (<span>${keyspace.tables.length}</span>)`,
      type: 'default',
      icon: normalizePath(Path.join(extraIconsPath, 'table.png'))
    }

    // Append the tables' container to the tree structure
    treeStructure.core.data.push(tablesStructure)

    // Loop through every table in the keyspace
    keyspace.tables.forEach((table) => {
      // Get random IDs for all upcoming children
      let [
        tableID,
        clusteringKeysID,
        primaryKeysID,
        partitionKeysID,
        columnsID,
        triggersID,
        viewsID,
        indexesID
      ] = getRandomID(30, 8)

      /**
       * Build a tree view for the table
       * For the `parentType` parameter set it to be the table's keyspace's name; to set a correct scope for getting a CQL description
       */
      buildTreeViewForChild(tablesID, tableID, `Table`, table, 'table', keyspace.name)

      // Loop through the table's children, starting from the clustering keys
      let clusteringKeysStructure = {
        id: clusteringKeysID,
        parent: tableID,
        text: `Clustering Keys (<span>${table.clustering_key.length}</span>)`,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
      }

      treeStructure.core.data.push(clusteringKeysStructure)

      // Loop through clustering keys
      table.clustering_key.forEach((clusteringKey) => {
        // Get a random ID for the key
        let clusteringKeyID = getRandomID(30)

        // Build tree view for the key
        buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'key')
      })
      // End of table's clustering keys

      // Table's primary keys
      let primaryKeysStructure = {
        id: primaryKeysID,
        parent: tableID,
        text: `Primary Keys (<span>${table.primary_key.length}</span>)`,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
      }

      treeStructure.core.data.push(primaryKeysStructure)

      // Loop through primary keys
      table.primary_key.forEach((primaryKey) => {
        // Get a random ID for the key
        let primaryKeyID = getRandomID(30)

        // Build tree view for the key
        buildTreeViewForChild(primaryKeysID, primaryKeyID, `Key`, primaryKey, 'key')
      })
      // End of table's primary keys

      // Table's partition keys
      let partitionKeysStructure = {
        id: partitionKeysID,
        parent: tableID,
        text: `Partition Keys (<span>${table.partition_key.length}</span>)`,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
      }

      treeStructure.core.data.push(partitionKeysStructure)

      // Loop through keys
      table.partition_key.forEach((partitionKey) => {
        // Get a random ID for the key
        let partitionKeyID = getRandomID(30)

        // Build tree view for the key
        buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'key', 'partitionKeys')
      })
      // End of table's partition keys

      // Table's columns
      let columnsStructure = {
        id: columnsID,
        parent: tableID,
        text: `Columns (<span>${table.columns.length}</span>)`,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
      }

      treeStructure.core.data.push(columnsStructure)

      // Loop through columns
      table.columns.forEach((column) => {
        // Get rid of `is_reversed` attribute
        delete column.is_reversed

        // Get a random ID for the column
        let columnID = getRandomID(30)

        // Build a tree view for the column
        buildTreeViewForChild(columnsID, columnID, `Column`, column, 'column')
      })

      // Show a `Views` node/leaf if the current table has at least one view
      try {
        // If the current table doesn't have any materialized view then skip this try-catch block
        if (table.views.length <= 0)
          throw 0

        /**
         * Views' container that will be under the table container
         * Get a random ID for the views' parent node
         */
        let viewsID = getRandomID(30),
          // Define the node/leaf structure
          viewsStructure = {
            id: viewsID,
            parent: tableID, // Under the current table
            text: `Views (<span>${table.views.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'table.png'))
          }

        // Append the views' container to the tree structure
        treeStructure.core.data.push(viewsStructure)

        // Loop through every view in the table
        table.views.forEach((view) => {
          // Get random IDs for all upcoming children
          let [
            viewID,
            clusteringKeysID,
            partitionKeysID,
            columnsID
          ] = getRandomID(30, 4)

          /**
           * Build a tree view for the current view
           * For the `parentType` parameter set it to be the view's keyspace's name; to set a correct scope for getting a CQL description
           */
          buildTreeViewForChild(viewsID, viewID, `View`, view, 'table', keyspace.name)

          // Loop through the view's children, starting from the clustering keys
          let clusteringKeysStructure = {
            id: clusteringKeysID,
            parent: viewID,
            text: `Clustering Keys (<span>${view.clustering_key.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
          }

          treeStructure.core.data.push(clusteringKeysStructure)

          // Loop through clustering keys
          view.clustering_key.forEach((clusteringKey) => {
            // Get a random ID for the key
            let clusteringKeyID = getRandomID(30)

            // Build tree view for the key
            buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'key')
          })
          // End of view's clustering keys

          // View's partition keys
          let partitionKeysStructure = {
            id: partitionKeysID,
            parent: viewID,
            text: `Partition Keys (<span>${view.partition_key.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
          }

          treeStructure.core.data.push(partitionKeysStructure)

          // Loop through keys
          view.partition_key.forEach((partitionKey) => {
            // Get a random ID for the key
            let partitionKeyID = getRandomID(30)

            // Build tree view for the key
            buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'key', 'partitionKeys')
          })
          // End of view's partition keys

          // View's columns
          let columnsStructure = {
            id: columnsID,
            parent: viewID,
            text: `Columns (<span>${view.columns.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
          }

          treeStructure.core.data.push(columnsStructure)

          // Loop through columns
          view.columns.forEach((column) => {
            // Get rid of `is_reversed` attribute
            delete column.is_reversed

            // Get a random ID for the column
            let columnID = getRandomID(30)

            // Build a tree view for the column
            buildTreeViewForChild(columnsID, columnID, `Column`, column, 'column')
          })
        })
      } catch (e) {}
    })

    // Show a `Views` node/leaf if the current keyspace has at least one view
    try {
      // If the current keyspace doesn't have any materialized view then skip this try-catch block
      if (keyspace.views.length <= 0)
        throw 0

      /**
       * Views' container that will be under the keyspace container
       * Get a random ID for the views' parent node
       */
      let viewsID = getRandomID(30),
        // Define the node/leaf structure
        viewsStructure = {
          id: viewsID,
          parent: keyspaceID, // Under the current keyspace
          text: `Views (<span>${keyspace.views.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'table.png'))
        }

      // Append the views' container to the tree structure
      treeStructure.core.data.push(viewsStructure)

      // Loop through every view in the keyspace
      keyspace.views.forEach((view) => {
        // Get random IDs for all upcoming children
        let [
          viewID,
          clusteringKeysID,
          partitionKeysID,
          columnsID
        ] = getRandomID(30, 4)

        /**
         * Build a tree view for the current view
         * For the `parentType` parameter set it to be the view's keyspace's name; to set a correct scope for getting a CQL description
         */
        buildTreeViewForChild(viewsID, viewID, `View`, view, 'table', keyspace.name)

        // Add a node/leaf about the view's base table's name
        treeStructure.core.data.push({
          id: getRandomID(30),
          parent: viewID,
          text: `Base Table: <span>${view.base_table_name}</span>`,
          type: 'default'
        })

        // Loop through the view's children, starting from the clustering keys
        let clusteringKeysStructure = {
          id: clusteringKeysID,
          parent: viewID,
          text: `Clustering Keys (<span>${view.clustering_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
        }

        treeStructure.core.data.push(clusteringKeysStructure)

        // Loop through clustering keys
        view.clustering_key.forEach((clusteringKey) => {
          // Get a random ID for the key
          let clusteringKeyID = getRandomID(30)

          // Build tree view for the key
          buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'key')
        })
        // End of view's clustering keys

        // View's partition keys
        let partitionKeysStructure = {
          id: partitionKeysID,
          parent: viewID,
          text: `Partition Keys (<span>${view.partition_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
        }

        treeStructure.core.data.push(partitionKeysStructure)

        // Loop through keys
        view.partition_key.forEach((partitionKey) => {
          // Get a random ID for the key
          let partitionKeyID = getRandomID(30)

          // Build tree view for the key
          buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'key', 'partitionKeys')
        })
        // End of view's partition keys

        // View's columns
        let columnsStructure = {
          id: columnsID,
          parent: viewID,
          text: `Columns (<span>${view.columns.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
        }

        treeStructure.core.data.push(columnsStructure)

        // Loop through columns
        view.columns.forEach((column) => {
          // Get rid of `is_reversed` attribute
          delete column.is_reversed

          // Get a random ID for the column
          let columnID = getRandomID(30)

          // Build a tree view for the column
          buildTreeViewForChild(columnsID, columnID, `Column`, column, 'column')
        })
      })
    } catch (e) {}

    // Show a `User Defined Types` node/leaf if the current keyspace has at least one UDT
    try {
      // If the current keyspace doesn't have any UDT then skip this try-catch block
      if (keyspace.user_types.length <= 0)
        throw 0

      /**
       * UDTs' container that will be under the keyspace container
       * Get a random ID for the UDTs' parent node
       */
      let userTypesID = getRandomID(30),
        // Define the node/leaf structure
        userTypesStructure = {
          id: userTypesID,
          parent: keyspaceID, // Under the current keyspace
          text: `User Defined Types (<span>${keyspace.user_types.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'udt.png'))
        }

      // Append the UDTs' container to the tree structure
      treeStructure.core.data.push(userTypesStructure)

      // Loop through every user defined type in the keyspace
      keyspace.user_types.forEach((userType) => {
        // Get random IDs for the current user type and its fields
        let [
          userTypeID,
          fieldsID
        ] = getRandomID(30, 2)

        // Build a tree view for the current UDT
        buildTreeViewForChild(userTypesID, userTypeID, `User Type`, userType, 'udt')

        // Loop through each field of the current UDT
        userType.field_names.forEach((field, index) => {
          // Get random IDs for the current field and its type
          let [
            fieldID, fieldTypeID
          ] = getRandomID(30, 2),
            // Get the field's type
            type = userType.field_types[index]

          // Push the field's tree view
          treeStructure.core.data.push({
            id: fieldID,
            parent: userTypeID,
            text: `<span>${field}</span>`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
          })

          // Push the field's type tree view
          treeStructure.core.data.push({
            id: fieldTypeID,
            parent: fieldID,
            text: `Field Type: <span>${type}</span>`,
            type: 'default'
          })
        })
      })
    } catch (e) {}
  })

  /**
   * Create a `Virtual Keyspaces` if needed and push the related nodes under it
   * Get all nodes that are flagged as `virtual`
   */
  let virtualNodes = treeStructure.core.data.filter((node) => node.virtualValue)

  // Filter the virtual nodes with more conditions
  virtualNodes = virtualNodes.filter((node) => {
    // Get the node's parent
    let parent = treeStructure.core.data.filter((_node) => _node.id == node.parent)[0]

    // Keep the node only if the parent node is a keyspace
    return parent.parentType == 'keyspace'
  })

  try {
    // If there are no virtual keyspaces then skip this try-catch block
    if (virtualNodes.length <= 0)
      throw 0

    // Get a random ID for the `Virtual Keyspaces` node
    let virtualKeyspacesParentID = getRandomID(30)

    // Define the node structure
    let structure = {
      id: virtualKeyspacesParentID,
      parent: keyspacesID,
      text: `Virtual Keyspaces (<span>${virtualNodes.length}</span>)`,
      type: 'default',
      icon: normalizePath(Path.join(extraIconsPath, 'keyspaces.png'))
    }

    // Push the `Virtual Keyspaces` node
    treeStructure.core.data.unshift(structure)

    // Loop through all remaining nodes after the filtering process
    virtualNodes.forEach((node) => {
      // Get the keyspace node and clone it
      let keyspace = {
        ...treeStructure.core.data.filter((_node) => _node.id == node.parent)[0]
      }

      // Remove it from the overall structure
      treeStructure.core.data = treeStructure.core.data.filter((_node) => _node.id != node.parent)

      // Update the cloned keyspace node's parent ID to be the virtual keyspace node's ID
      keyspace.parent = virtualKeyspacesParentID

      // Push the keyspace node again
      treeStructure.core.data.push(keyspace)
    })
  } catch (e) {}

  // Return the final tree structure
  return treeStructure
}

/**
 * Find a suitable suggestion from a group of given suggestions
 * The given `needle` will be matched with the beginning of the `haystack` strings' values
 *
 * @Parameters:
 * {string} `needle` the string to search for
 * {object} `haystack` group of strings to search in
 *
 * @Return: {string || object} one suggestion, or group - array - of suggestions
 */
let suggestionSearch = (needle, haystack) => {
  let result = [] // Final result which be returned

  // Lowered the case for the `needle`
  needle = needle.toLowerCase()

  // Filter the `haystack` by keeping values that start with the `needle`
  result = haystack.filter((val) => (val.toLowerCase()).startsWith(needle))

  // If this test passed, then there's a `haystack` value that exactly matches the `needle`
  let test = result.find((val) => val.toLowerCase() == needle)

  // Either return the one matched value instead of an array, or return an array of matched values
  return test != undefined ? test : result
}

/**
 * Search for a given string in another string using the extremely fast `FSS` node module
 *
 * This function is defined as a part of the `String` type
 * @Example: ('a test').search('test') // true
 *
 * @Parameters:
 * {string} `needle` the string to search for
 *
 * @Return: {boolean} the given needle is in the haystack or not
 */
String.prototype.search = function(needle) {
  return FSS.indexOf(`${this}`, `${needle}`).length != 0
}


/**
 * Open a confirmation dialog
 * The dialog has `confirm` and `cancel` buttons to choose from
 *
 * @Parameters:
 * {string} `text` the dialog's text
 * {object} `callback` function that will be triggered with passing the final result
 * {boolean} `?noBackdrop` whether or not the backdrop background should be rendered
 *
 * @Return: {boolean} action confirmed or canceled
 */
let openDialog = (text, callback, noBackdrop = false) => {
  // Point at the dialog's UI element
  let dialog = $('div#generalPurposeDialog'),
    // Get the dialog's MDB object
    dialogObject = getElementMDBObject(dialog, 'Modal'),
    // Point at the dialog's content container
    dialogContent = dialog.find('div.modal-body'),
    // Point at the dialog's close `X` button
    closeBtn = dialog.find('div.btn-close')

  // Set the dialog's text
  dialogContent.html(text)

  // Add log for this confirmation dialog - its text -
  addLog(`Confirmation dialog, text: ${text}`, 'action')

  // Point at the confirm and cancel buttons in the dialog
  let confirm = dialog.find('button.btn-primary'),
    cancel = dialog.find('button.btn-secondary')

  // Unbind all events listeners on buttons
  confirm.add(cancel).unbind()

  // Set a `click` event listener
  confirm.add(cancel).click(function() {
    // Call the `callback` function with whether the user has clicked on the confirm button or not
    callback($(this).is(confirm))

    // Add log for the confirmation's status
    addLog(`Confirmation dialog status: ${$(this).is(confirm)}.`)

    // Hide the dialog
    dialogObject.hide()
  })

  // Open the dialog
  dialogObject.show()

  // If there's no need for the backdrop background then remove it
  if (noBackdrop)
    $('div.modal-backdrop:last-of-type').remove()
}

/**
 * Print a custom message in the app's terminals
 *
 * @Parameters:
 * {object} `terminal` the terminal object in which the message will be printed - the `readLine` object can be passed too -
 * {string} `type` the type of the message, the value could be: [`warning`, `info`, and `error`]
 * {string} `message` the message's content that will be printed
 * {boolean} `?hideIcon` print the message without a prefix icon that indicates its type
 */
let terminalPrintMessage = (terminal, type, message, hideIcon = false) => {
  // Get the message box's corners and pipes
  let box = CLIBoxes.round,
    // Get the message's length
    length = message.length + 4,
    // Set the default format (warning)
    format = {
      icon: ' ⚠️ ',
      color: '234;255;18'
    }

  // Switch between other types
  switch (type) {
    case 'info': {
      format.icon = ' ℹ️ '
      format.color = '15;168;255'
      break
    }
    case 'error': {
      format.icon = ' × '
      format.color = '239;41;41'
      break
    }
  }

  // If the prefix icon should be hidden
  if (hideIcon) {
    format.icon = ' '
    length -= 2
  }

  /**
   * Define the `message`
   * Start with the prefix icon - or empty string -, and make the message's text style bold
   */
  message = `${format.icon}` + '\033[1m' + `${message}` + '\033[0m'

  /**
   * Put the message inside a box
   * Start by adding the top left corner `⌜` of the box
   */
  let messageFormatted = '\x1b[38;2;' + `${format.color}` + 'm' + `${box.topLeft}`

  // Add a line that covers the message from the top
  for (let i = 0; i < length; i++)
    messageFormatted += box.top

  // Add the top right corner `⌝`, then a left pipe, and the message
  messageFormatted += `${box.topRight}` + '\r\n' + `${box.left}${message}`

  // Add the right pipe, then the bottom left corner `⌞`
  messageFormatted += '\x1b[38;2;' + `${format.color}` + 'm' + ` ${box.right}` + '\r\n' + `${box.bottomLeft}`

  // Add a line that covers the message from the bottom
  for (let i = 0; i < length; i++)
    messageFormatted += `${box.bottom}`

  // Add the bottom right corner `⌟`, now the message is entirely covered with a box
  messageFormatted += `${box.bottomRight}` + '\033[0m'

  /**
   * Print the message in the given terminal
   * Try with `println` which is used with the `Readline` addon
   */
  try {
    terminal.println(messageFormatted)
  } catch (e) {
    // As `println` didn't work use `writeln` which is used with the Xterm object
    terminal.writeln(messageFormatted)
  }
}

/**
 * Get the public/private key to be used for encryption/decryption
 *
 * @Parameters:
 * {string} `type` the key's type, the value could be: [`public` or `private`]
 * {object} `callback` function that will be triggered with passing the final result
 * {boolean} `?called` whether or not the function has already been called and this is the second attempt to get the key
 *
 * @Return: {string} the public/private key, or an empty string
 */
let getKey = async (type, callback, called = false) => {
  try {
    // If the key's type is not `private` then skip this try-catch block
    if (type != 'private')
      throw 0

    // Define our private key service
    let service = 'cassandraWorkbenchPrivateKey'

    /**
     * Use `keytar` to get the private key on the fly
     * The private key will be removed automatically from memory after being used
     */
    Keytar.findPassword(service).then(async (key) => {
      /**
       * It happens - especially on Windows - that a `\x00` hex value might be added,
       * this value leads to corruption in the private key format, so it should be removed
       */
      key = key.replace(/\x00/gm, '')

      /**
       * If the key is valid, or it's the second attempt already, then pass the key value whatever it's to the `callback` function
       * In this way a possible endless loop is prevented, and if the key is invalid the encryption/decryption process will stop
       */
      if ((key != null && key.length >= 886) || called)
        return callback(key)

      /**
       * If the key is not valid then add a custom key and then delete it,
       * then call the `getKey` again, and it should return the key this time
       */
      await Keytar.setPassword(service, 'key', ' ')
      await Keytar.deletePassword(service, 'key')

      /**
       * Ask for the actual key again
       * This method has worked every time the first attempt failed
       */
      getKey('private', callback, true)
    })

    // Skip the upcoming code - since it's about obtaining a public key -
    return
  } catch (e) {}

  /**
   * Reaching here means the key's type is `public`
   *
   * If the app already has got it then just return it; to save time and resources
   */
  if (publicKey.trim().length > 0)
    return callback(publicKey)

  /**
   * If not, then request to get the public key from the main thread
   *
   * Get a random ID for the request
   */
  let requestID = getRandomID(20)

  // Request to get the public key
  IPCRenderer.send('public-key:get', requestID)

  // Wait for the response
  IPCRenderer.on(`public-key:${requestID}`, (_, result) => {
    // Save the public key in the `publicKey` global variable
    publicKey = result

    // Call the callback function with passing the result
    return callback(result)
  })
}

/**
 * Encrypt a given text using RSA
 * Encrypted text is converted to `base64` format
 *
 * @Parameters:
 * {string} `publicKey` the public key that will be used for encryption
 * {string} `text` the text that will be encrypted
 *
 * @Return: {string} either the encrypted text or an empty text if something went wrong
 */
let encrypt = (publicKey, text) => {
  let encryptedText = '' // The final encrypted text which be returned

  try {
    // Create a public RSA object
    let public = new NodeRSA(publicKey, 'public', {
      encryptionScheme: 'pkcs1'
    })

    // Encrypt the given text
    encryptedText = public.encrypt(text).toString('base64')
  } catch (e) {} finally {
    // Return the final encrypted text
    return encryptedText
  }
}

/**
 * Decrypt a given text using RSA
 *
 * @Parameters:
 * {string} `privateKey` the private key that will be used for decryption
 * {string} `text` the encrypted text that will be decrypted
 *
 * @Return: {string} either the decrypted text or an empty text if something went wrong
 */
let decrypt = (privateKey, text) => {
  let decryptedText = '' // The final decrypted text

  try {
    // Create a private RSA object
    let private = new NodeRSA(privateKey, 'private', {
      encryptionScheme: 'pkcs1'
    })

    // Decrypt the given text
    decryptedText = private.decrypt(text).toString('utf8')
  } catch (e) {} finally {
    // Return the final decrypted text
    return decryptedText
  }
}

/**
 * Execute a given array of scripts
 *
 * @Parameters:
 * {integer} `scriptID` the index of the script to execute in the `scripts` array
 * {object} `scripts` an array of paths of scripts
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object}: {integer} `scriptID`, {object} `scripts`, {integer} `status`
 *
 * If `status` is not `0`, then the last executed script didn't return the success code `0`, otherwise, all scripts have been successfully executed
 */
let executeScript = (scriptID, scripts, callback) => {
  // Get a random ID for the execution request
  let requestID = getRandomID(20)

  // Add log about executing the current script
  addLog(`Executing the script ${scripts[scriptID]}.`, 'process')

  // Send the execution request
  IPCRenderer.send('script:run', {
    id: requestID,
    scriptPath: scripts[scriptID]
  })

  // Handle the response
  IPCRenderer.on(`script:result:${requestID}`, (_, status) => {
    // Preserve the original status' value before parsing
    let originalStatus = status

    /**
     * Get the execution's status
     * If it's not the success code `0`, then the last script hasn't executed properly
     */
    status = parseInt(status)

    // Add log for the execution's status
    addLog(`Execution status of the script ${scripts[scriptID]} is ${isNaN(status) ? originalStatus : status}.`)

    try {
      // If the status/returned value is not `0` then it is considered an error
      if (status != 0)
        throw 0; // This semicolon is critical here

      // Otherwise, the status value is `0` and the current script has been successfully executed
      ++scriptID

      // If condition `true`, then all scripts have been executed without errors
      if (scriptID + 1 > scripts.length)
        throw 0

      // Call the execution function again in a recursive way
      executeScript(scriptID, scripts, callback)
    } catch (e) {
      /**
       * Call the callback function
       * Pass the last executed script ID, all scripts array, and the last execution status
       */
      return callback({
        scriptID: scriptID,
        scripts: scripts,
        status: isNaN(status) ? originalStatus : status
      })
    }
  })
}

/**
 * Get all pre and post-connection scripts of a given cluster
 *
 * @Parameters:
 * {string} `workspaceID` the ID of the target workspace
 * {string} `?clusterID` the target cluster's ID, or null to check the editor's content
 *
 * @Return: {object} JSON object which has `pre` and `post` attributes, each attribute holds an array of scripts' paths
 */
let getPrePostConnectionScripts = async (workspaceID, clusterID = null) => {
  // Final result to be returned - scripts to be executed -
  let scripts = {
      pre: [], // Pre-connection scripts' paths
      post: [] // Post-connection scripts' paths
    },
    /**
     * Flag which tells if sensitive data has been found in the cluster's `cqlsh.rc` content
     * This is an extra attribute
     */
    foundSensitiveData = false,
    // An object which holds the content of the cluster's cqlsh.rc file
    cqlshContent = null

  // Check pre and post-connection scripts
  try {
    // Set cluster to be null by default
    let cluster = null

    try {
      // If there's no cluster ID has been passed then skip this try-catch block
      if (clusterID == null)
        throw 0

      // Get all saved clusters
      let clusters = await Modules.Clusters.getClusters(workspaceID)

      // Get the target cluster's object
      cluster = clusters.filter((cluster) => cluster.info.id == clusterID)[0]
    } catch (e) {}

    // Get the cluster's `cqlsh.rc` file's content
    cqlshContent = cluster != null ? await Modules.Clusters.getCQLSHRCContent(workspaceID, cluster.cqlshrc) : await Modules.Clusters.getCQLSHRCContent(workspaceID, null, editor),
      // Define the file's sections
      sections = Object.keys(cqlshContent)

    // If there are no sections in the `cqlsh.rc` file then skip this try-catch block
    if (sections.length <= 0)
      throw 0

    // Loop through each section
    for (let section of sections) {
      // Define the current section's keys/options
      let keys = Object.keys(cqlshContent[section])

      // If no keys have been found in this section then skip it and move to the next one
      if (keys.length <= 0)
        continue

      // Loop through keys/options
      for (let key of keys) {
        // If the current key/option is considered sensitive - for instance; it is `username` -
        if (Modules.Consts.SensitiveData.includes(key))
          foundSensitiveData = true

        // Check if there are scripts
        let script = cqlshContent[section][key]

        // Check if there're pre or post connect scripts
        if (['preconnect', 'postconnect'].includes(section))
          scripts[section == 'preconnect' ? 'pre' : 'post'].push(script)
      }
    }
  } catch (e) {}

  // Return the final result
  return {
    ...scripts,
    foundSensitiveData,
    cqlshContent
  }
}

/**
 * Get random free-to-use port(s)
 *
 * @Parameters:
 * {integer} `?amount` the number of port(s) to get/generate
 *
 * @Return: {integer || object} one port, or group - array - of ports
 */
let getRandomPort = async (amount = 1) => {
  // Define the ports array which be returned
  let ports = []

  /**
   * Loop based on the number of needed ports
   * Push every `port` to the `ports` array
   */
  for (let i = 0; i < amount; i++)
    ports.push(await PortGet())

  // Add log about the free-to-use ports
  addLog(`Request to get ${amount} free-to-use port(s), returned ${amount == 1 ? ports[0] : JSON.stringify(ports)}.`, 'network')

  // Return one `port` if only one is needed, or the entire array otherwise
  return amount == 1 ? ports[0] : ports
}

/**
 * Get random ID(s)
 *
 * @Parameters:
 * {integer} `length` the length of all IDs
 * {integer} `?amount` the number of ID(s) to get/generate
 *
 * @Return: {integer || object} one ID, or group of IDs
 */
let getRandomID = (length, amount = 1) => {
  // Define IDs array which be returned
  let ids = []

  /**
   * Loop based on the number of needed IDs
   * Push every ID to the `ids` array
   */
  for (let i = 0; i < amount; ++i)
    ids.push(RandomID(length))

  // Return one ID if only one is needed, or the entire array otherwise
  return ids.length == 1 ? ids[0] : ids
}

/**
 * Get random HEX color(s)
 *
 * @Parameters:
 * {integer} `?amount` the number of colors to get/generate
 *
 * @Return: {integer || object} one color, or group of colors
 */
let getRandomColor = (amount = 1) => {
  // Define the colors array which be returned
  let colors = []

  /**
   * Loop based on the number of needed `colors`
   * Push every `color` to the `colors` array
   */
  for (let i = 0; i < amount; ++i)
    colors.push(RandomFlatColors())

  // Return one `color` if only one is needed, or the entire array otherwise
  return colors.length == 1 ? colors[0] : colors
}

/**
 * Invert a given color in HEX format
 *
 * @Inspired by this answer: https://stackoverflow.com/a/35970186
 * Comments added after understanding the purpose of each line
 *
 * @Parameters:
 * {string} `hex` the color to be inverted in HEX format
 *
 * @Return {string} the inverted color in HEX format
 */
let invertColor = (hex) => {
  // Check if the color starts with `#` and remove it if so
  if (hex.indexOf('#') === 0)
    hex = hex.slice(1)

  // If the given color is in the short form `#fff` then expand it to `#ffffff`
  if (hex.length === 3)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]

  // If the given color is invalid then return it and skip the upcoming code
  if (hex.length !== 6)
    return hex

  // Inner function to add leading zeros to a given string; to ensure it has a specified length
  let padZero = (str, len) => {
    len = len || 2
    let zeros = new Array(len).join('0')
    return (zeros + str).slice(-len)
  }

  /**
   * Calculate the inverted RGB values by the following steps:
   * Subrtact each channel value from 255.
   * Convert the result to HEXA (16).
   * Then add leading zeros if needed.
   */
  let r = padZero((255 - parseInt(hex.slice(0, 2), 16)).toString(16)),
    g = padZero((255 - parseInt(hex.slice(2, 4), 16)).toString(16)),
    b = padZero((255 - parseInt(hex.slice(4, 6), 16)).toString(16))

  // Return the final result
  return `#${r}${g}${b}`
}

/**
 * Check if the host machine has an SSH client installed
 * Works on all major operating systems (Linux, macOS, and Windows)
 *
 * @Parameters:
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {boolean} the host machine has an SSH client or not
 */
let checkSSH = (callback) => {
  // Add log for this process
  addLog(`Checking SSH client exists or not.`, 'process')

  // Run the command to check SSH
  Terminal.run('ssh -V', (err, stderr, data) => {
    // Add log for the process' result
    addLog(`Checking SSH client status: ${!(err || stderr)}.`)

    // Call the callback function with the result
    callback(!(err || stderr))
  })
}

/**
 * Create an SSH tunnel
 *
 * @Parameters:
 * {object} `data` contains the SSH tunneling info, parameters are:
 * {string} `host`, {string} `username`, {string} `?password`, {string} `?privateKey`, {string} `?passphrase`, {integer} `?port`, {string} `?dstAddr`, {string} `dstPort`
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object} SSH tunnel object; to control the tunnel and get the active port
 */
let createSSHTunnel = (data, callback) => {
  // Get a random ID for the creation request
  let requestID = getRandomID(10)

  // Send the request to the main thread
  IPCRenderer.send('ssh-tunnel:create', {
    ...data,
    requestID
  })

  // Once a response is received
  IPCRenderer.on(`ssh-tunnel:create:result:${requestID}`, (_, data) => {
    // Call the callback function with passing the result
    callback(data)
  })
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
  let result = object, // Final result which be returned
    // Define variables files' path
    variablesFilePath = {
      // Path of the manifest file in the app's root folder
      manifest: Path.join(__dirname, '..', '..', 'config', 'variables.json'),
      // Path of the values of the actual variables stored in the os config/appdata folder
      values: AppData('cassandra_workbench.variables')
    }

  try {
    // Get the object's values
    let objectValues = Object.keys(object),
      // Define the manifest and the values of saved variables
      variablesManifest = '',
      variablesValues = ''

    // Get the variables' manifest content
    try {
      variablesManifest = await FS.readFileSync(variablesFilePath.manifest, 'utf8')
    } catch (e) {}

    // Get the saved variables' values in the host config/app data folder
    try {
      variablesValues = await FS.readFileSync(variablesFilePath.values, 'utf8')
    } catch (e) {}

    // Define the final variables object
    let variables = [],
      // Convert manifest and values content from string JSON to object
      variablesManifestObject = variablesManifest.trim().length > 0 ? JSON.parse(variablesManifest) : [],
      variablesValuesObject = variablesValues.trim().length > 0 ? JSON.parse(variablesValues) : []

    // Filter the variables based on their scope
    variablesManifestObject = variablesManifestObject.filter(
      // The filter is whether or not the variable's scope includes the current workspace, or it includes all workspaces
      (variable) => variable.scope.some(
        (workspace) => [
          workspaceID,
          'workspace-all'
        ].includes(workspace))
    )

    /**
     * Loop through the variables' manifest
     * If the variable has a value in the values file, then return it and use it, otherwise, it'll be ignored
     */
    variablesManifestObject.forEach((variable) => {
      try {
        // Check if there's a value exists in the variables' values file
        let exists = variablesValuesObject.find((_variable) => _variable.name == variable.name && JSON.stringify(_variable.scope) == JSON.stringify(variable.scope))

        // If it exists, push and adopt it
        if (exists != undefined)
          variables.push(exists)
      } catch (e) {}
    })

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
            subValue = subValue.replace(regex, '${' + variable.name + '}')
          })

          // Update the object's value with the manipulated one
          result[objectValue][_subValue] = subValue
        })

        // Skip the upcoming code
        return
      } catch (e) {}

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
        value = value.replace(regex, '${' + variable.name + '}')
      })

      // Update the object's value with the manipulated one
      result[objectValue] = value
    })
  } catch (e) {} finally {
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
      value = value.replace(regex, variable.value)
    })

    // Update the object's value with the manipulated one
    object[key] = value
  })

  // Return the object after manipulation
  return object
}

/**
 * Convert a JSON object to a beautified JSON string
 *
 * @Parameters:
 * {object} `object` the JSON object that will be manipulated
 * {boolean} `?sort` sort the given JSON object alphabetically (a -> z)
 *
 * @Return: {string} the passed object in string format after manipulation
 */
let applyJSONBeautify = (object, sort = false) => {
  // The given JSON object needs to be sorted
  if (sort)
    object = SortJSON(object, {
      ignoreCase: true,
      reverse: false,
      depth: 5
    })

  // Return the beautified version of the JSON
  return BeautifyJSON(object, null, 2, 80)
}

/**
 * Manipulate a given text; by getting rid of all spaces, and lowering the case of all chars
 *
 * @Parameters:
 * {string} `text` the text that will be manipulated
 *
 * @Return: {string} the passed text after manipulation
 */
let manipulateText = (text) => text.replace(/\s+/gm, '').toLowerCase()

/**
 * Minify a given text by manipulating it, plus getting rid of new lines
 *
 * @Parameters:
 * {string} `text` the text that will be manipulated
 *
 * @Return: {string} the passed text after manipulation
 */
let minifyText = (text) => {
  // Define the regex expression to be created
  let regexs = ['\\n', '\\r']

  // Loop through each regex
  regexs.forEach((regex) => {
    // Create regex object
    regex = new RegExp(regex, 'g')

    // Execute the replication process
    text = `${text}`.replace(regex, '')
  })

  // Call the text manipulation function
  text = manipulateText(text)

  // Return final result
  return text
}

/**
 * Get the currently active workspace ID
 *
 * @Return: {string} the currently active workspace ID
 */
let getActiveWorkspaceID = () => activeWorkspaceID || getAttributes($(`#addEditClusterDialog`), 'data-workspace-id')

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
    let defaultPath = Path.join(__dirname, '..', '..', 'data', 'workspaces'),
      // Point at the workspace element in the UI
      workspaceElement = $(`div.workspace[data-id="${workspaceID}"]`),
      // Get its folder name and its path
      [folderName, folderPath] = getAttributes(workspaceElement, ['data-folder', 'data-folder-path'])

    // Decide whether or not the ${default} variable will be replaced
    folderPath = folderPath == 'default' ? (!replaceDefault ? '${default}' : defaultPath) : folderPath

    // Return the result
    return Path.join(folderPath, folderName)
  } catch (e) {
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
 *
 * @Return: {boolean} the path is accessible or not
 */
let pathIsAccessible = (path) => {
  // Final result which be returned
  let accessible = false

  try {
    // Test the accessibility
    FS.accessSync(path, FS.constants.R_OK | FS.constants.W_OK)

    // Reaching here means the test has successfully passed
    accessible = true
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
  } catch (e) {}

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

  // Read the temp folder and get all items (files and folders) in it
  FS.readdir(tempFolder, (err, items) => {
    // If any error has occurred then end this process
    if (err)
      return

    // Loop through detected items in the temp folder
    for (let item of items) {
      /**
       * Check if the item ends with the `.cwb` or `.metadata` extensions
       * The `.cwb` item is a `cqlsh.rc` config file created for test connection and it should be removed
       */
      if (['cwb', 'metadata'].some((extension) => item.endsWith(extension))) {
        // Remove that temporary config file
        FS.remove(Path.join(tempFolder, item))

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
          FS.remove(Path.join(tempFolder, item))
      })
    }
  })
}

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
  text = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

  // Return a regular expression object
  return new RegExp(text, flags)
}

/**
 * Extract two characters from a given cluster name in a systematic way
 *
 * @Example: extractChars('>Local >Cluster') // LC
 * @Example: extractChars('>A>nothertest') // AN
 *
 * @Parameters:
 * {string} `clusterName` the cluster name
 *
 * @Return: {string} the two characters to be used
 */
let extractChars = (clusterName) => {
  // Remove all white spaces from the given name
  clusterName = clusterName.replace(/\s+/gm, ''),
    // Get all characters in array
    allChars = clusterName.split(''),
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
  let requestID = getRandomID(10)

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
  })
}

/**
 * Set the UI color for specific elements and parts based on the given workspace's color
 *
 * @Parameters:
 * {string} `workspaceColor` the workspace's color in HEX format
 */
let setUIColor = (workspaceColor) => {
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

  // If the given color is not valid then stop the entire process
  if (workspaceColor.trim().length <= 0)
    return

  // Define the stylesheet that will be applied
  let stylesheet = `
      <style id="uicolor">
        .changed-bg {background: ${backgroundColor.default} !important}
        .changed-bg:hover {background: ${backgroundColor.hover} !important}
        .checkbox-checked:checked, .form-check-input:not([no-color])[type=checkbox]:checked, .form-check-input:not([no-color]):checked {background: ${backgroundColor.default} !important}
        .checkbox-checked:checked:after {background: ${backgroundColor.hover.replace('70%', '100%')} !important}
        .ui-resizable-handle {background: ${backgroundColor.hover.replace('70%', '0%')}}
        .ui-resizable-handle:hover {background: ${backgroundColor.hover.replace('70%', '40%')}}
        .checkbox-checked:checked:focus:before {box-shadow: 3px -1px 0 13px ${backgroundColor.hover.replace('70%', '100%')} !important;}
        .form-check-input:not([no-color]):checked:focus:before {box-shadow: 0 0 0 13px ${backgroundColor.hover.replace('70%', '100%')} !important;}
        .changed-color {color: ${textColor} !important}
        .nav-tabs .nav-item.show .nav-link, .nav-tabs .nav-link.active, form-check-input:not([no-color]):checked, .form-check-input:not([no-color]):checked:focus, .form-check-input:not([no-color]):checked, .form-check-input:not([no-color]):checked:focus {border-color: ${backgroundColor.default} !important}
        ion-icon[name="lock-closed"] {color: ${backgroundColor.default} !important}
      </style>`

  // Append the stylesheet
  $('body').append($(stylesheet))
}

/**
 * Update the height and navigation state of a given left-side switchers' container
 *
 * @Parameters:
 * {string} `?type` the switchers' container type, values are [`workspace` or `cluster`]
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
 * Set the trademark symbol `™` to "Apache Cassandra"
 *
 * @Parameters:
 * {string} `text` the text which the `™` symbol will be added to where Cassandra is located
 *
 * @Return: {string} final manipulated text
 */
let setApacheCassandraTMSymbol = (text) => text.replace(/Cassandra/gm, 'Cassandra ™')

/**
 * Set the clusters' switchers' margin
 * In some cases, the top margin of the first switcher might not be applied as desired so it's handled by this function
 */
let handleClusterSwitcherMargin = () => {
  // Point at the clusters' switchers' container
  let switchersContainer = $(`div.body div.left div.content div.switch-clusters`)

  /**
   * Set the margin as needed
   * Get all visible clusters in the switcher's container
   */
  let visibleClusters = switchersContainer.children('div.cluster').filter(':visible')

  // The first visible cluster's top margin should be set to `0`
  visibleClusters.first().css('margin-top', '0px')

  // Any other cluster rather than the first one its top margin should be set to `10`
  visibleClusters.filter(':not(:first)').css('margin-top', '10px')

  // Get the number of active clusters' work areas
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
 * Improve performance by play/stop lottie elements on show/hide
 *
 * @Parameters:
 * {object} `lottieElement` the lottie UI element
 */
let autoPlayStopLottieElement = (lottieElement) => {
  // Unbind any previous `mutate` event
  lottieElement.unbind('mutate')
    // When the lottie element is hidden (not visible)
    .mutate('hide', (lottie) => lottie.stop())
    // When the lottie element is shown (visible)
    .mutate('show', (lottie) => {
      // If the lottie element is not set to be played automatically, and its current state is `stopped` or `loading` then don't play it automatically
      if (!lottie.autoplay && ['loading', 'stopped'].some((state) => lottie.currentState == state))
        return

      // Play the lottie element
      lottie.play()
    })
}

/**
 * Add a new log text in the current logging session
 *
 * @Parameters:
 * {string} `log` the log's text
 */
let addLog = (log, type = 'info') => {
  // If the logging feature is not enabled then skip the upcoming code
  if (!isLoggingEnabled)
    return

  // Define the log's type's icons
  let icons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      action: '👤',
      process: '⚙️',
      network: '🌐',
      security: '🔒',
      env: '🖥️'
    },
    // Decide the suitable icon
    icon = icons[type] || icons.info

  // Send the log text to the main thread
  IPCRenderer.send('logging:add', {
    date: new Date().getTime(),
    log,
    icon
  })
}

/**
 * Shorthand the function `addLog(log, ?type)` for handling error's logs
 *
 * @Parameters:
 * {string} `error` the error's text
 * {string} `process` the process's type (example: clusters, workpsaces...)
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

  // Log the error
  addLog(`Error in process ${process}. Details: ${error}`, 'error')
}

/**
 * Close all active work areas - clusters and sandbox projects -
 * This function is called once the user decides to close all work areas, and on app termination
 */
let closeAllWorkareas = () => {
  // Point at all work areas
  let workareas = $('div.body div.right div.content div[content="workarea"] div.workarea[cluster-id]')

  // Loop through all work areas
  workareas.each(function() {
    // Point at the cluster's element associated with the current work area
    let clusterElement = $(`div.clusters-container div.clusters div.cluster[data-id="${getAttributes($(this), 'cluster-id')}"]`),
      // Also point at the workspace's elemenet associated with the cluster
      workspaceElement = $(`div.workspaces-container div.workspace[data-id="${getAttributes(clusterElement, 'data-workspace-id')}"]`),
      // Whether or not the current work area is actually for a sandbox project
      isSandboxProject = getAttributes(clusterElement, 'data-is-sandbox') == 'true'

    try {
      // Attempt of click the `close workarea` button
      $(this).find('div.sub-sides.right div.header div.cluster-actions div.action[action="close"] div.btn-container div.btn').click()

      /**
       * Show feedback to the user
       *
       * If the work area is actually for a sandbox project
       */
      if (isSandboxProject)
        return showToast(I18next.capitalize(I18next.t('close work area')), I18next.capitalizeFirstLetter(I18next.replaceData(`the work area of docker project [b]$data[/b] is being terminated`, [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

      // Otherwise, show this toast
      showToast(I18next.capitalize(I18next.t('close work area')), I18next.capitalizeFirstLetter(I18next.replaceData(`the work area of cluster [b]$data[/b] in workspace [b]$data[/b] has been successfully closed`, [getAttributes(clusterElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'success')
    } catch (e) {}
  })
}