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
 * Define all global functions
 *
 * Get the Material Design's object related to a passed UI element
 *
 * @Parameters:
 * {object} `element` the HTML element in the UI
 * {string} `?type` the type of the element, all possible types are:
 * [`Button`, `Dropdown`, `Input`, `Modal`, `Range`, `Ripple`, `Tab`, `Tooltip`]
 *
 * @Return: {object} the Material Design's object
 */
let getElementMDBObject = (element, type = 'Input') => {
  // Define the final object which be returned
  let object = null

  // O(1) WeakMap lookup instead of O(n) array scan
  try {
    let domNode = element[0] || element
    let typeMap = mdbObjectsIndex.get(domNode)
    if (typeMap && typeMap[type] != undefined)
      return typeMap[type]
  } catch (e) {}

  /**
   * Check if the type is a `tooltip`
   * Tooltips are handled by `TippyJS` instead of MDB tooltip; because `Tippy` adds a trackable ID to the created tooltip element; so its position can be changed as needed
   * This feature is available by many libraries besides `TippyJS`, it's not available in MDB nor `Bootstrap` though
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
      placement: getAttributes(element, 'data-mdb-placement'),
      allowHTML: getAttributes(element, 'data-mdb-html') == 'true',
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
            // Get the popper and reference outer width and height
            let pWidth = popper.outerWidth(),
              pHeight = popper.outerHeight(),
              rWidth = reference.outerWidth(),
              rHeight = reference.outerHeight()

            // Switch between the tooltip's placement
            switch (instance.props.placement) {
              case 'left': {
                translate.x -= pWidth + 10
                translate.y -= rHeight / 2 - pHeight / 2
                break
              }
              case 'right': {
                translate.x += rWidth + 10
                translate.y += rHeight / 2 - pHeight / 2
                break
              }
              case 'top': {
                translate.y -= rHeight + 10
                translate.x += rWidth / 2 - pWidth / 2
                break
              }
              case 'bottom': {
                translate.y += rHeight + 10
                translate.x += rWidth / 2 - pWidth / 2
                break
              }
            }

            // Set the new offset of the tooltip
            setOffset(translate)
          })
        } catch (e) {}
      }
    })

    // Store in WeakMap index for O(1) future lookups
    try {
      let domNode = element[0] || element
      let typeMap = mdbObjectsIndex.get(domNode) || {}
      typeMap[type] = object
      mdbObjectsIndex.set(domNode, typeMap)
    } catch (e) {}

    // Push the created object to be returned later once it's called
    mdbObjects.push({
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

  // Store in WeakMap index for O(1) future lookups
  try {
    let domNode = element[0] || element
    let typeMap = mdbObjectsIndex.get(domNode) || {}
    typeMap[type] = object
    mdbObjectsIndex.set(domNode, typeMap)
  } catch (e) {}

  // Push the created object to be returned later once it's called
  mdbObjects.push({
    element,
    object,
    type
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
  // Add log about this loading process
  try {
    addLog(`Renderer thread initialized '${Path.basename(path).replace(Path.extname(path), '')}'`)
  } catch (e) {}

  /**
   * Call the JQuery's HTTP request function
   * Set `async attribute` to `false`; to be sure the script is loaded before executing the upcoming code
   */
  try {
    $.ajax({
      url: path,
      async: false,
      dataType: 'script'
    })
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }
}

/**
 * Load a stylesheet - CSS file -
 *
 * @Parameters:
 * {string} `path` the path to the CSS file in the project
 */
let loadStyleSheet = (path) => {
  // Add log about this loading process
  try {
    addLog(`Renderer thread initialized '${Path.basename(path).replace(Path.extname(path), '')}'`)
  } catch (e) {}

  // Prepend the stylesheet file
  try {
    $('head').prepend(`<link rel="stylesheet" href="${path}">`)
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }
}

/**
 * Show toast at the bottom center of the app
 * The toast - structure, style, code, etc... - has been created especially for the app
 *
 * @Parameters:
 * {string} `title` the title of the toast
 * {string} `text` the text to be shown in the toast
 * {string} `?type` the toast's type, all possible values are:
 * [`success`, `failure`, `warning`, and `neutral`]
 * {string} `?toastID` if an ID has been passed then the toast will be pinned till it's called to be destroyed
 * {object} `?clickCallback` a function to be called once the navigation icon is clicked - will be shown only if a callback function has been passed -
 */
let showToast = (title, text, type = 'neutral', toastID = '', clickCallback = null) => {
  /**
   * Set the proper time-out
   * This is performed either by just setting it to a fixed value, or based on the text's length with a maximum time of 20s
   */
  let minTimeout = 7000,
    maxTimeout = 20000,
    timeout = minTimeout

  /**
   * Calculate the showing time
   * Every character in the text is adding 50ms to the time
   */
  timeout = text.length * 50

  /**
   * Maximum acceptable time is 20s, minimum is 5.5s
   * Timeout more than `20s`? `true` then `= 20s`,
   * `false` then timeout is less than `5.5s`? `true` then `= 5.5s`,
   * `false` then adopt the calculated time
   */
  timeout = timeout > maxTimeout ? maxTimeout : (timeout < minTimeout ? minTimeout : timeout)

  // Add the toast's content as a log
  {
    // Define the log's type
    let logType = (['success', 'neutral']).some((_type) => type == _type) ? 'info' : (type == 'failure' ? 'error' : type)

    // Add the log - toast's title and text -
    try {
      addLog(`${StripTags(title)}: ${StripTags(text)}`, logType)
    } catch (e) {}
  }

  // Whether or not the `toast-id` attribute will be added
  let addToastID = toastID.length != 0 ? `toast-id="${toastID}"` : '',
    // Whether or not a specified elements will be hidden
    hideElement = toastID.length != 0 ? 'hidden' : ''

  // Toast UI element structure
  let element = `
      <div style="text-align: initial;" class="toast ${toastID.length <= 0 ? 'show' : ''}" ${addToastID}>
        <div class="toast-header no-select">
          <span class="toast-type ${type}">
            <img src="../assets/lottie/${type}.gif" background="transparent">
          </span>
          <strong class="me-auto">${title}</strong>
          <button type="button" class="navigation" ${clickCallback == null ? 'hidden' : ''}>
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
  $(`body div.${toastID.length != 0 ? 'pinned-' : ''}toast-container`).append($(element).show(function() {
    // Point at the just-created toast element
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
      // If the toast is pinned then there's no need to show nor animate the progress bar, skip this try-catch block
      if (toastID.length != 0)
        throw 0

      /**
       * Start to animate the decreasing of the progress bar after a set period of time of creation
       * Once the animation is done click the close button
       *
       * Define the animation's attributes
       */
      let animation = {
        startTimestamp: null,
        properties: {
          width: '0%'
        },
        duration: timeout - 200,
        complete: () => closeBtn.click()
      }

      // After a set period of time start the animation process
      setTimeout(() => {
        // Update the `startTimestamp` attributes
        animation.startTimestamp = new Date().getTime()

        // Start the animation process
        try {
          progressBar.animate(animation.properties, animation.duration, animation.complete)
        } catch (e) {}
      }, 150)

      // When hovering on the toast's body the closing timer will be paused then resumed on hover out
      toast.find('div.toast-body').hover(() => progressBar.pause(animation), () => progressBar.resume(animation))
    } catch (e) {}

    // When double clicks the toast's body its content will be selected
    toast.find('div.toast-body').dblclick(function() {
      $(this).selectContent()
    })

    // Clicks the close button
    closeBtn.click(() => {
      // Hide the toast with fading animation
      toast.addClass('animate-hide')

      // Remove the toast after it's hidden
      setTimeout(() => toast.remove(), 120)
    })

    try {
      /**
       * If there's no passed callback function then skip this try-catch block
       * Clicking the navigation button will lead to calling the callback function
       */
      if (clickCallback != null)
        navigationBtn.click(() => clickCallback())
    } catch (e) {}
  }))

  // If the toast is pinned then there's no need to add it in the notifications center, skip the upcoming code
  if (toastID.length != 0)
    return

  /**
   * Check if the main window is being focused or not
   * Based on the result the notification/toast may be pushed to the notifications center
   */
  {
    // Send request to the main thread; to return if the main window is being focused or not
    IPCRenderer.invoke('window:focused').then((isFocused) => {
      // If the main window is being focused then skip this entire process - no need to push the toast -
      if (isFocused)
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
      (actionBtn.find('img.gif')).attr('src', '../assets/lottie/notification.gif')

      // Prepend the notification to the container
      container.prepend($(element).hide(function() {
        // Clean the toast be removing the unnecessary elements
        ($(this).find('div.toast-header').find('button')).add($(this).find('div.hide-progress')).remove()

        $(this).css('width', '100%')

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

// Functions for the pinned toasts - toasts for ongoing process feedback -
let pinnedToast = {
  /**
   * Shorthand the function `showToast(title, text, ?type, ?toastID, ?clickCallback)` in case the toast will be pinned and its content will be updated
   *
   * @Parameters:
   * {string} `pinnedToastID` The ID of the toast that will be created
   * {string} `title` the title of the toast
   * {string} `text` the text to be shown in the toast
   */
  show: (pinnedToastID, title, text) => showToast(title, text, 'bg-progress', pinnedToastID),
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
  update: (pinnedToastID, text, destroy = false) => {
    try {
      // Point at the toast
      let toast = $(`div.pinned-toast-container div.toast[toast-id="${pinnedToastID}"]`),
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
        // If the passed `text` is set to `true` then skip this try-catch block and keep the body's content
        if (text == true)
          throw 0

        // If the passed `text` has `++` prefixed then append the given text instead of replacing the body's content with it
        if (text.indexOf('++') == 0) {
          // Get the current content
          let content = toastBody.html()

          // Append the given text
          toastBody.html(`${content}<code>${text.slice(2)}</code><br>`)

          // Skip the upcoming code in this try-catch block
          throw 0
        }

        /**
         * Reaching here means the entire content needs to be updated
         *
         * Update the toast's body content
         */
        toastBody.html(text)
      } catch (e) {}

      // Always scroll to the very bottom of the toast's body
      toastBody.animate({
        scrollTop: toastBody.get(0).scrollHeight
      }, 1)

      // If the toast doesn't need to be destroyed then end this process
      if (!destroy)
        return

      // Show the close button
      closeBtn.add(hideProgressBar).removeAttr('hidden')

      /**
       * Start to animate the decreasing of the progress bar after a set period of time of creation
       * Once the animation is done click the close button
       *
       * Define the animation's attributes
       */
      let animation = {
        startTimestamp: null,
        properties: {
          width: '0%'
        },
        duration: 10000,
        complete: () => closeBtn.click()
      }

      // After a set period of time start the animation process
      setTimeout(() => {
        // Update the `startTimestamp` attributes
        animation.startTimestamp = new Date().getTime()

        // Start the animation process
        progressBar.animate(animation.properties, animation.duration, animation.complete)
      }, 150)

      // When hovering on the toast's body the closing timer will be paused then resumed on hover out
      toastBody.hover(() => progressBar.pause(animation), () => progressBar.resume(animation))
    } catch (e) {}
  }
}

/**
 * Format a given timestamp to readable text
 *
 * @Parameters:
 * {integer} `timestamp` the timestamp value to be formatted
 * {boolean} `?isSecondFormat` return the second format `Year-Month-Day Hours:Minutes:Seconds`
 * {boolean} `?withMilliSeconds` add milliseconds to the final result
 *
 * @Return: {string} formatted timestamp with the chosen format
 */
let formatTimestamp = (timestamp, isSecondFormat = false, withMilliSeconds = false) => {
  // Define the final result to be returned
  let format = ''

  try {
    // Get the date object based on the given timestamp, then get the year, month, and day of that timestamp
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
      seconds = date.getSeconds(),
      milliSeconds = date.getMilliseconds()

    // Manipulate hours, minutes, and seconds values; by adding `0` to what is less than `10`
    hours = hours < 10 ? `0${hours}` : hours
    minutes = minutes < 10 ? `0${minutes}` : minutes
    seconds = seconds < 10 ? `0${seconds}` : seconds

    // Define the default format
    format = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`

    // If it's required to adopt the second format
    if (isSecondFormat)
      format = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

    // If it's required to add milliSeconds
    if (withMilliSeconds)
      format = `${format}.${milliSeconds}`
  } catch (e) {}

  // Return the human-readable result
  return format
}

/**
 * Format a time UUID string to readable text
 *
 * @Inspired by this answer: https://stackoverflow.com/a/26915856
 * Comments added after understanding the purpose of each line
 *
 * @Parameters:
 * {string} `uuid` the time UUID string format
 * {boolean} `?withMilliSeconds` add milliseconds to the final result
 *
 * @Return: {string} formatted timestamp extracted from the passed time UUID
 */
let formatTimeUUID = (uuid, withMilliSeconds = false) => {
  // Extract the `int` time value from the UUID string
  let getTimeInt = (uuidString) => {
    // Split the UUID string
    let uuidArray = `${uuidString}`.split('-'),
      // Rearrange and join specific parts; to create the time string in HEX format
      timeString = [uuidArray[2].substring(1), uuidArray[1], uuidArray[0]].join('')

    // Convert the HEX time string
    return parseInt(timeString, 16)
  }

  // Convert the passed UUI string to a timestamp
  let getTimestamp = (uuidString) => {
    // Get the `int` time value from the UUID
    let intTime = getTimeInt(uuidString) - 122192928000000000,
      // Convert the nanosecond to milliseconds
      intMilliSeconds = Math.floor(intTime / 10000)

    // Return the final timestamp
    return intMilliSeconds
  }

  // Return the formatted UUID string
  return formatTimestamp(getTimestamp(uuid), false, withMilliSeconds)
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
let repairJSONString = (json) => {
  let result = json // Final result which be returned

  // Only for Windows platform
  try {
    if (OS.platform() != 'win32')
      throw 0

    result = `${result}`.replace(/'comment'\s*:\s*'(.*?)',\s*'compaction'/g, (_, match) => {

      let modifiedComment = match.replace(/"/g, '\\"')

      return `'comment': '${modifiedComment}', 'compaction'`
    })
  } catch (e) {}

  // Add a log about this process -  without logging the result afterward -
  try {
    addLog(`Repairing JSON '${json.slice(0, 20)}...'`, 'process')
  } catch (e) {}

  try {
    // Replace non-ascii chars except the ones which are used to build a valid JSON
    json = `${json}`.replace(/[^\x20-\x7E{}[\]:,"']/g, '')
      // Remove some added chars from the cqlsh tool and terminal
      .replace(/1C/g, '')
      .replace(/u\\'/g, "'")
      .replace(/\(\)/g, "''")
      // Remove an added bracket to the `keyspace_name` attribute that can lead to an error
      .replace(/\'\:\[\'keyspace_name\'/g, "':'keyspace_name'")
      // Get rid of the function's body - which is code -; as this causes the parsing process to fall apart
      .replace(/'body':\s*'([\s\S]*?)',/g, `'body': '',`)

    // Remove more covered ASCII escape characters for Windows
    if (OS.platform == 'win32')
      json = `${json}`.replace(/[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\[0K|\[\?25[hl]/g, '')

    // Attempt to match the JSON block `{...JSON content...}`
    try {
      json = json.match(/\{[\s\S]+/gm)[0]
    } catch (e) {}

    // Repair the JSON string after the manipulation process
    json = JSONRepair(json)

    // Update the result with the new repaired JSON string
    result = json
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  } finally {
    // Return the final result
    return result
  }
}

/**
 * Convert JSON string to HTML table string
 *
 * @Parameters:
 * {string} `json` the JSON string to be manipulated, and it can be an absolute file path
 *
 * @Return: {object} the JSON in table array format, and the manipulated JSON
 */
let convertJSONToTable = (json, callback) => {
  try {
    // Convert the final manipulated JSON object to HTML table string
    let tableHTML = ConvertJSONTable(json)

    // Return final result
    return callback({
      table: tableHTML,
      json
    })
  } catch (e) {}

  /**
   * Reaching here means the conversion wasn't successful
   * Return empty string
   */
  callback(json)
}

/**
 * Convert HTML table to Tabulator table/object
 *
 * @Parameters:
 * {string} `json` the JSON string to be manipulated
 * {object} `container` the HTML table's container in the UI
 * {integer} `paginationSize` the default pagination size (100 by default)
 * {object} `callback` function that will be triggered with passing the created object
 *
 * @Return: {object} the Tabulator table object
 */
let convertTableToTabulator = (json, container, paginationSize = 100, paginationSizeSelectorEnabled = true, callback) => {
  convertJSONToTable(json, (convertedJSON) => {
    // Get a random ID for the table
    let tableID = getRandom.id(20),
      // The variable which is going to hold the Tabulator object
      tabulatorTable,
      columns = [],
      rows = []

    try {
      if (convertedJSON.table != undefined) {
        columns = convertedJSON.table[0]
      } else {
        columns = Object.keys(convertedJSON[0])
      }
    } catch (e) {}

    try {
      if (convertedJSON.json != undefined) {
        rows = convertedJSON.json
      } else {
        rows = convertedJSON
      }
    } catch (e) {}

    try {
      if (paginationSizeSelectorEnabled)
        throw 0

      columns.unshift('select-checkbox')

      let currentIndex = 0

      for (let jsonData of rows) {
        jsonData.checkbox = ''

        jsonData._rowIndex = currentIndex

        currentIndex += 1
      }
    } catch (e) {}

    // Append the HTML table to the passed container
    container.append($(`<div id="_${tableID}"></div>`).show(function() {
      try {
        setTimeout(() => {
          // Create a Tabulator object with set properties
          tabulatorTable = new Tabulator(`div#_${tableID}`, {
            layout: 'fitDataStretch',
            index: '_rowIndex',
            initialSort: [{
              column: "_rowIndex",
              dir: "asc"
            }],
            columns: [{
                field: "_rowIndex",
                visible: false
              },
              ...columns.map((column) => {
                let isCheckbox = column == 'select-checkbox',
                  finalFormat = {}

                try {
                  finalFormat = {
                    title: !isCheckbox ? column : 'select',
                    field: !isCheckbox ? column : 'checkbox',
                    headerFilter: !isCheckbox ? 'input' : ''
                  }

                  if (isCheckbox)
                    finalFormat.formatter = () => `<div class="form-check">
                                                    <input class="form-check-input select-row" type="checkbox">
                                                  </div>`
                } catch (e) {}

                return finalFormat
              })
            ],
            data: rows,
            resizableColumnFit: true,
            resizableRowGuide: true,
            movableColumns: true,
            pagination: 'local',
            paginationSize,
            // selectableRows: !paginationSizeSelectorEnabled,
            // selectableRowsRangeMode: 'click',
            virtualDom: true,
            paginationSizeSelector: paginationSizeSelectorEnabled ? [5, 10, 20, 40, 60, 80, 100] : false,
            paginationCounter: 'rows',
            rowFormatter: function(row) {
              /**
               * Format some data in the rows
               *
               * Get the row's HTML UI element
               */
              let element = row.getElement()

              $(element).find('div:contains("<span")').each(function() {
                try {
                  let spanTxt = `${$(this).text().match(/<span(.*?)<\/span>\s*/)[0]}`

                  $(this).text($(this).text().replace(/<span(.*?)<\/span>\s*/, ''))

                  $(this).prepend($(spanTxt))
                } catch (e) {}
              })

              // Search for any field in the row that contain specific keyword for object
              $(element).find('div:contains("-OBJECT-")').each(function() {
                try {
                  // Add CSS property
                  $(this).css('padding-left', '25px')

                  // Manipulate the field's content
                  let content = `${$(this).text()}`.replace(/\-OBJECT\-/g, '')

                  // Create a JSON/Object view for the content
                  $(this).text('').jsonViewer(JSON.parse(content), {
                    collapsed: true,
                    withLinks: false
                  })

                  // Make sure to redraw the table with each open/close of the object viewer
                  setTimeout(() => $(this).find('a').click(() => setTimeout(() => tabulatorTable.redraw())))
                } catch (e) {}
              })
            }
          })

          tabulatorTable.on('columnsLoaded', () => callback(tabulatorTable))
        })
      } catch (e) {
        // Return `null` as a critical error has occured
        callback(null)
      }
    }))
  })
}


/**
 * Due to the way JSTree is coded, there's an issue with the paths in Windows
 * To solve this issue, this inner function replaces the backward slashes
 * If the OS is not Windows it'll simply return the path without any manipulation
 */
let normalizePath = (path) => OS.platform == 'win32' ? `${path}`.replace(/\\/gm, '/') : `${path}`

