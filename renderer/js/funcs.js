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

  // Check if the MDB object has already been created
  try {
    // Get the MDB object by filtering all created objects
    let foundObject = mdbObjects.find((object) => {
      let objectUIElement = object.element

      try {
        objectUIElement = object.element.length > 1 ? object.element[0] : objectUIElement
      } catch (e) {}

      try {
        objectUIElement = object.object.reference || objectUIElement
      } catch (e) {}

      let isObjectFound = false

      try {
        isObjectFound = objectUIElement.is(element) && object.type == type
      } catch (e) {
        try {
          isObjectFound = $(objectUIElement).is(element) && object.type == type
        } catch (e) {}
      }

      return isObjectFound
    })

    // If it has already been found then return it
    if (foundObject != undefined)
      return foundObject.object
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
    addLog(`The initialization process loaded '${Path.basename(path).replace(Path.extname(path), '')}'`)
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
    addLog(`The initialization process loaded  '${Path.basename(path).replace(Path.extname(path), '')}'`)
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
  let minTimeout = 5500,
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
            <lottie-player src="../assets/lottie/${type}.json" background="transparent" autoplay ${toastID.length != 0 ? 'loop speed="0.9"' : ''}></lottie-player>
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
        progressBar.animate(animation.properties, animation.duration, animation.complete)
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
      // If there's no passed callback function then skip this try-catch block
      if (clickCallback == null)
        throw 0

      // Clicking the navigation button will lead to calling the callback function
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
    IPCRenderer.send('window:focused')

    // Remove all previous listeners
    IPCRenderer.removeAllListeners('window:focused')

    // Got a response from the main thread
    IPCRenderer.on('window:focused', (_, isFocused) => {
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
      (actionBtn.find('lottie-player'))[0].play()

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

  // Add log for this process
  try {
    addLog(`Format the timestamp '${timestamp}' to a human-readable format '${format}'`, 'process')
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
let repairJSON = (json) => {
  let result = json // Final result which be returned

  // Add a log about this process -  without logging the result afterward -
  try {
    addLog(`Repair a string-format JSON '${json.slice(0, 20)}...'`, 'process')
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
 * {string} `json` the JSON string to be manipulated
 * {boolean} `?isExpandOn` flag to tell if the expandation feature is enabled in cqlsh
 *
 * @Return: {object} the JSON in table array format, and the manipulated JSON
 */
let convertJSONToTable = (json, isExpandOn = false) => {
  // Attempt to repair the passed JSON string
  json = repairJSON(json)

  /**
   * Split the JSON string by new line
   * CQLSH return each record/row in seperated line
   */
  try {
    json = JSON.parse(json)

    if (json.length == undefined) {
      json = JSON.stringify(json)
      throw 0
    }
  } catch (e) {
    json = `${json}`.split('\n')
  }

  let stringJSON = '',
    foundJSON = []

  try {
    if (OS.platform() != 'win32')
      throw 0

    json.forEach((record) => {
      stringJSON += `${record}`;

      try {
        let match = `${stringJSON}`.match(
          /\{[\s\S]+\}/gm
        )

        if (match == null)
          return

        foundJSON.push(match[0]);

        stringJSON = stringJSON.replace(/\{[\s\S]+\}/gm, '')
      } catch (e) {}
    })
  } catch (e) {}

  try {
    // Convert each record/row to JSON object inside array
    let jsonObject = [...(foundJSON.length != 0 ? foundJSON : json)].map((item) => {
      let finalItem = item

      try {
        if (typeof finalItem === 'object')
          throw 0

        finalItem = JSON.parse(repairJSON(item))
      } catch (e) {}

      return finalItem
    })

    // Loop through each record
    for (let i = 0; i < jsonObject.length; i++) {
      // Point at the record
      let record = jsonObject[i]

      // Loop through each column inside the current record
      Object.keys(record).forEach((key) => {
        // Get the value of the current column
        let data = record[key]

        try {
          // Process only for Windows
          if (OS.platform() != 'win32')
            throw 0

          // If the data is `undefined`
          if (data == undefined) {
            // Delete it from the record with its key
            delete jsonObject[i][key]

            // Skip the remaining code in this try-catch block
            throw 0
          }

          // If the key has characters - like new line -
          if (minifyText(key) != key) {
            // Minify the key and add it to the record
            jsonObject[i][minifyText(key)] = data

            // Delete the old key
            delete jsonObject[i][key]
          }
        } catch (e) {}

        // If the value type is not `object` then skip the upcoming code
        if (typeof data != 'object')
          return

        // Convert the data of type `object` to be string
        try {
          record[key] = JSON.stringify(data)
        } catch (e) {
          record[key] = `${data}`
        } finally {
          // Add keyword to be recognized once the Tabulator object is created
          record[key] += '-OBJECT-'
        }
      })
    }

    // Convert the final manipulated JSON object to HTML table string
    let tableHTML = ConvertJSONTable(jsonObject)

    // Return final result
    return {
      table: tableHTML,
      json: jsonObject
    }
  } catch (e) {}

  /**
   * Reaching here means the conversion wasn't successful
   * Return empty string
   */
  return ''
}

/**
 * Convert HTML table to Tabulator table/object
 *
 * @Parameters:
 * {string} `json` the JSON string to be manipulated
 * {object} `container` the HTML table's container in the UI
 * {object} `callback` function that will be triggered with passing the created object
 *
 * @Return: {object} the Tabulator table object
 */
let convertTableToTabulator = (json, container, callback) => {
  // Convert the passed JSON string to HTML table
  let convertedJSON = convertJSONToTable(json),
    // Get a random ID for the table
    tableID = getRandomID(20),
    // The variable which is going to hold the Tabulator object
    tabulatorTable

  // Append the HTML table to the passed container
  container.append($(`<div id="_${tableID}"></div>`).show(function() {
    try {
      setTimeout(() => {
        // Create a Tabulator object with set properties
        tabulatorTable = new Tabulator(`div#_${tableID}`, {
          layout: 'fitDataStretch',
          columns: convertedJSON.table[0].map((column) => {
            return {
              title: column,
              field: column,
              headerFilter: 'input'
            }
          }),
          data: convertedJSON.json,
          resizableColumnFit: true,
          resizableRowGuide: true,
          movableColumns: true,
          pagination: 'local',
          paginationSize: 10,
          paginationSizeSelector: [5, 10, 20, 40, 60, 80, 100],
          paginationCounter: 'rows',
          rowFormatter: function(row) {
            /**
             * Format some data in the rows
             *
             * Get the row's HTML UI element
             */
            let element = row.getElement()

            // Search for any field in the row that contain specific keyword for object
            $(element).find('div:contains("-OBJECT-")').each(function() {
              try {
                // Add CSS properties
                $(this).css({
                  'padding-left': '25px'
                })

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
   * To solve this issue, this inner function replaces the backward slashes
   * If the OS is not Windows it'll simply return the path without any manipulation
   */
  let normalizePath = (path) => OS.platform == 'win32' ? `${path}`.replace(/\\/gm, '/') : `${path}`

  // Get a keyspaces container's random ID
  let [clusterID, keyspacesID] = getRandomID(30, 2),
    // Define the path of extra icons to be used with each leaf
    extraIconsPath = normalizePath(Path.join(__dirname, '..', 'js', 'external', 'jstree', 'theme', 'extra')),
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
        'data': [{
            'id': clusterID,
            'parent': '#',
            'text': `Cluster: <span>${metadata.cluster_name}</span>`,
            'type': 'default',
            'icon': normalizePath(Path.join(extraIconsPath, 'cluster.png')),
            'state': {
              'opened': true,
              'selected': false
            },
            'a_attr': {
              'allow-right-context': 'true',
              'name': metadata.cluster_name,
              'type': 'cluster'
            }
          },
          {
            'id': getRandomID(30),
            'parent': clusterID,
            'text': `Partitioner: <span>${metadata.partitioner.replace(/.+\.(.+)/gi, '$1')}</span>`,
            'type': 'default',
          },
          {
            'id': keyspacesID,
            'parent': '#',
            'text': `Keyspaces (<span>${metadata.keyspaces.length}</span>)`,
            'type': 'default',
            'icon': normalizePath(Path.join(extraIconsPath, 'keyspaces.png')),
            'state': {
              'opened': true,
              'selected': false
            },
            'a_attr': {
              'allow-right-context': 'true',
              'type': 'keyspaces'
            }
          }
        ]
      },
      'plugins': ['types', 'contextmenu', 'search'],
      'contextmenu': {
        'select_node': false
      }
    }

  // Get a random ID for the system's keyspaces container
  let systemKeyspacesParentID = getRandomID(30),
    /**
     * Count the number of found system keyspaces in the connected to cluster
     *
     * This is a better approach in long term than hardcoding the number
     */
    numOfFoundSystemKeyspaces = 0

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
      // Define the parent's type
      let setParentType = icon || `${parentType}`

      try {
        if (!(Modules.Consts.CassandraSystemKeyspaces.some((keyspace) => keyspace == object.name)))
          throw 0

        // Update the parent's ID to be the `System Keyspaces` node
        parentID = systemKeyspacesParentID

        // Increase the counter
        numOfFoundSystemKeyspaces += 1
      } catch (e) {}

      // Define the child's structure
      let structure = {
        id: childID,
        parent: parentID,
        text: `<span>${EscapeHTML(object.name)}</span>`,
        type: 'default',
        parentType: setParentType
      }

      // If the title needs to be added then do this addition as a prefix
      if (!ignoreTitles)
        structure.text = `${text}: ${structure.text}`

      // If an icon has been passed then add it to the leaf's structure
      if (icon != null)
        structure.icon = normalizePath(Path.join(extraIconsPath, `${icon}.png`))

      // Add the parent's ID
      structure.a_attr = {
        'parent': `${parentID}`
      }

      try {
        if (text != `Index`)
          throw 0

        structure.a_attr.table = parentType.table || null
      } catch (e) {}

      try {
        // If the child is not any of the defined types then skip this try-catch block
        if (['Keyspace', 'Table', 'View', 'Index', 'User Type'].every((type) => text != type))
          throw 0

        // Set an `a_attr` attribute with important sub-attributes
        structure.a_attr = {
          ...structure.a_attr,
          'allow-right-context': 'true',
          'name': object.name,
          'type': `${text}`.toLowerCase()
        }

        try {
          structure.a_attr.keyspace = parentType.keyspace
        } catch (e) {}

        try {
          structure.a_attr['is-counter-table'] = parentType.isCounterTable
        } catch (e) {}

        try {
          structure.a_attr.table = parentType.table
        } catch (e) {}

        try {
          if (minifyText(text) != 'usertype')
            throw 0

          structure.a_attr.type = 'udt'
          structure.a_attr.keyspace = object.keyspace
        } catch (e) {}
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
        let attributes = ['virtual', 'durable_writes', 'is_static']

        if (parentType == 'partitionKeys')
          attributes = attributes.slice(0, -2)

        // Loop through them all
        attributes.forEach((attribute) => {
          // If the child doesn't have this attribute then skip it and move to the next one
          if (object[attribute] == undefined)
            return

          // For `durable_writes`, it should be displayed if its value is only `false`
          if (attribute == 'durable_writes' && object[attribute])
            return

          let materialIcon = object[attribute] ? 'check' : 'close'

          // Otherwise, define that attribute's structure
          let structure = {
            id: getRandomID(30),
            parent: childID,
            text: `${I18next.capitalize(attribute.replace(/\_/gm, ' ')).replace(/Cql/gm, 'CQL')}: <span class="material-icons for-treeview">${materialIcon}</span>`,
            type: 'default'
          }

          // Some changes would be applied if the current attribute is `virtual`
          try {
            // If the attribute is not `virtual` then skip this try-catch block
            if (attribute != 'virtual')
              throw 0

            // Add the `virtual` attribute value as sub attribute in the structure
            structure.virtualValue = object[attribute] ? true : false

            // If the `virtual` value is `true` then it should be shown to the user
            if (structure.virtualValue)
              throw 0

            // Otherwise, hide the node which indicate's the node `virtual` value as it's `false` by default
            structure.state = {
              hidden: true
            }
          } catch (e) {}

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

        // Otherwise, add the type to the node's text
        structure.text = `${structure.text}: <span>${EscapeHTML(object.cql_type)}</span>`
      } catch (e) {}

      try {
        if (object['is_reversed'] == undefined || icon != 'clustering-key')
          throw 0

        let attribute = object['is_reversed']

        materialIcon = attribute ? 'arrow_downward' : 'arrow_upward'

        structure.text = `${structure.text} <span class="is-reversed-node">${attribute ? 'DESC' : 'ASC'} <span class="material-icons for-treeview">${materialIcon}</span></span>`
      } catch (e) {}
    },
    sortItemsAlphabetically = (array, sortBy) => {
      try {
        array.sort((a, b) => {
          if (`${a[sortBy]}`.toLowerCase() < `${b[sortBy]}`.toLowerCase())
            return -1

          if (`${a[sortBy]}`.toLowerCase() > `${b[sortBy]}`.toLowerCase())
            return 1

          return 0
        })
      } catch (e) {}
    }

  // Sort keyspaces alphabetically
  sortItemsAlphabetically(metadata.keyspaces, 'name')

  // Loop through the keyspaces
  metadata.keyspaces.forEach((keyspace) => {
    // Get a unique ID for the current keyspace, and an ID for its tables' container
    let [
      keyspaceID,
      tablesID
    ] = getRandomID(30, 2),
      indexesInfo = []

    // Build tree view for the keyspace
    buildTreeViewForChild(keyspacesID, keyspaceID, `Keyspace`, keyspace, 'keyspace')

    try {
      if (keyspace.replication_strategy == undefined)
        throw 0

      let replicationStrategy = JSON.parse(repairJSON(keyspace.replication_strategy)),
        replicationStrategyID = getRandomID(30)

      // Tables' container that will be under the keyspace container
      let replicationStrategyStructure = {
        id: replicationStrategyID,
        parent: keyspaceID, // Under the current keyspace
        text: `Replication Strategy`,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'replication_strategy.png'))
      }

      // Append the tables' container to the tree structure
      treeStructure.core.data.push(replicationStrategyStructure); // This semicolon is critical here

      Object.keys(replicationStrategy).forEach((key) => {
        treeStructure.core.data.push({
          id: getRandomID(30),
          parent: replicationStrategyID,
          text: `${key}: ${replicationStrategy[key]}`,
          type: 'default',
          icon: normalizePath(Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
        })
      })
    } catch (e) {}

    // Tables' container that will be under the keyspace container
    let tablesStructure = {
      id: tablesID,
      parent: keyspaceID, // Under the current keyspace
      text: `Tables (<span>${keyspace.tables.length}</span>)`,
      type: 'default',
      icon: normalizePath(Path.join(extraIconsPath, 'table.png')),
      a_attr: {
        keyspace: keyspace.name,
        type: 'tables-parent',
        'allow-right-context': true
      }
    }

    // Append the tables' container to the tree structure
    treeStructure.core.data.push(tablesStructure)

    sortItemsAlphabetically(keyspace.tables, 'name')

    let counterTablesID = getRandomID(30),
      counterTablesStructure = {
        id: counterTablesID,
        parent: tablesID,
        type: 'default',
        icon: normalizePath(Path.join(extraIconsPath, 'counter.png')),
        state: {
          hidden: true
        },
        a_attr: {
          keyspace: keyspace.name,
          type: 'counter-tables-parent',
          'allow-right-context': true
        }
      },
      numOfCounterTables = 0

    treeStructure.core.data.push(counterTablesStructure)

    // Loop through every table in the keyspace
    keyspace.tables.forEach((table) => {
      // Get random IDs for all upcoming children
      let [
        tableID,
        primaryKeysID,
        partitionKeysID,
        clusteringKeysID,
        columnsID,
        triggersID,
        viewsID,
        indexesID
      ] = getRandomID(30, 8)

      let isCounterTable = table.columns.find((column) => column.cql_type == 'counter') != undefined

      if (isCounterTable)
        numOfCounterTables += 1

      /**
       * Build a tree view for the table
       * For the `parentType` parameter set it to be the table's keyspace's name; to set a correct scope for getting a CQL description
       */
      buildTreeViewForChild(tablesID, tableID, `Table`, table, 'table', {
        keyspace: keyspace.name,
        isCounterTable
      })

      if (isCounterTable)
        buildTreeViewForChild(counterTablesID, `${tableID}_${counterTablesID}`, `Table`, table, 'table', {
          keyspace: keyspace.name,
          isCounterTable: true
        })

      // Table's primary keys
      {
        let primaryKeysStructure = {
          id: primaryKeysID,
          parent: tableID,
          text: `Primary Key (<span>${table.primary_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'key.png'))
        }

        treeStructure.core.data.push(primaryKeysStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...primaryKeysStructure,
            id: `${primaryKeysID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        // Loop through primary keys
        table.primary_key.forEach((primaryKey) => {
          // Get a random ID for the key
          let primaryKeyID = getRandomID(30),
            isPartitionKey = table.partition_key.find((partitionKey) => primaryKey.name == partitionKey.name) != undefined

          // Build tree view for the key
          buildTreeViewForChild(primaryKeysID, primaryKeyID, `Key`, primaryKey, isPartitionKey ? 'partition-key' : 'clustering-key')

          if (isCounterTable)
            buildTreeViewForChild(`${primaryKeysID}_${counterTablesID}`, `${primaryKeyID}_${counterTablesID}`, `Key`, primaryKey, isPartitionKey ? 'partition-key' : 'clustering-key')
        })
      }

      // Table's partition keys
      {
        let partitionKeysStructure = {
          id: partitionKeysID,
          parent: tableID,
          text: `Partition Keys (<span>${table.partition_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'partition-key.png'))
        }

        treeStructure.core.data.push(partitionKeysStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...partitionKeysStructure,
            id: `${partitionKeysID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        // Loop through keys
        table.partition_key.forEach((partitionKey) => {
          // Get a random ID for the key
          let partitionKeyID = getRandomID(30)

          // Build tree view for the key
          buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'partition-key', 'partitionKeys')

          if (isCounterTable)
            buildTreeViewForChild(`${partitionKeysID}_${counterTablesID}`, `${partitionKeyID}_${counterTablesID}`, `Key`, partitionKey, 'partition-key', 'partitionKeys')
        })
      }

      // Loop through the table's children, starting from the clustering keys
      {
        let clusteringKeysStructure = {
          id: clusteringKeysID,
          parent: tableID,
          text: `Clustering Keys (<span>${table.clustering_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'clustering-key.png'))
        }

        treeStructure.core.data.push(clusteringKeysStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...clusteringKeysStructure,
            id: `${clusteringKeysID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        // Loop through clustering keys
        table.clustering_key.forEach((clusteringKey) => {
          // Get a random ID for the key
          let clusteringKeyID = getRandomID(30)

          // Build tree view for the key
          buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'clustering-key')

          if (isCounterTable)
            buildTreeViewForChild(`${clusteringKeysID}_${counterTablesID}`, `${clusteringKeyID}_${counterTablesID}`, `Key`, clusteringKey, 'clustering-key')
        })
      }

      // Table's columns
      {
        let columnsStructure = {
          id: columnsID,
          parent: tableID,
          text: `Columns (<span>${table.columns.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'column.png'))
        }

        treeStructure.core.data.push(columnsStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...columnsStructure,
            id: `${columnsID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        sortItemsAlphabetically(table.columns, 'name')

        // Loop through columns
        table.columns.forEach((column) => {
          // Get a random ID for the column
          let columnID = getRandomID(30),
            isPartitionKey = table.partition_key.find((partitionKey) => column.name == partitionKey.name) != undefined,
            isClusteringKey = table.clustering_key.find((clusteringKey) => column.name == clusteringKey.name) != undefined

          // Get rid of `is_reversed` attribute
          if (!isClusteringKey)
            delete column.is_reversed

          // Build a tree view for the column
          buildTreeViewForChild(columnsID, columnID, `Column`, column, isPartitionKey ? 'partition-key' : (isClusteringKey ? 'clustering-key' : 'column'))

          if (isCounterTable)
            buildTreeViewForChild(`${columnsID}_${counterTablesID}`, `${columnID}_${counterTablesID}`, `Column`, column, isPartitionKey ? 'partition-key' : (isClusteringKey ? 'clustering-key' : 'column'))
        })
      }

      // Define an inner function to handle the appending process of options to the tree structure
      let appendOptions = (options, parentID) => {
        // Loop through the passed `options`
        Object.keys(options).forEach((option) => {
          // Manipulate the option's key/text
          let text = I18next.capitalize(`${option}`.replace(/\_/g, ' ')),
            // Get the option's value
            value = options[option]

          // Don't show `CDC` option if its value is `NULL`
          if (`${text}`.toLowerCase() == 'cdc' && `${value}`.toLowerCase() == 'null')
            return

          // If the value is one of the defined values in the array, then set the value to `NULL`
          value = [undefined, null].includes(value) ? 'NULL' : value

          try {
            /**
             * Handle if the option's value is actually a JSON object that has other sub-options
             * If the option's value is not an object, then skip this try-catch block
             */
            if (typeof value != 'object')
              throw 0

            // Get a random ID for the current parent's options node
            let parentOptionsID = getRandomID(30),
              // Define the node/leaf structure
              parentOptionsStructure = {
                id: parentOptionsID,
                parent: parentID, // Under the options' container node
                text: `${EscapeHTML(text)}`,
                type: 'default',
                icon: normalizePath(`${text}`.toLowerCase() == 'compaction' ? Path.join(extraIconsPath, 'compaction.png') : Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
              }

            // Push the node
            treeStructure.core.data.push(parentOptionsStructure)

            if (isCounterTable)
              treeStructure.core.data.push({
                ...parentOptionsStructure,
                id: `${parentOptionsID}_${counterTablesID}`,
                parent: `${parentID}_${counterTablesID}`
              })

            // Make a recursive call to the same function
            return appendOptions(value, parentOptionsID)
          } catch (e) {}

          /**
           * Reaching here means the current option's value is not an object
           * Get a random ID for the option's node
           */
          let optionID = getRandomID(30),
            // Define the node/leaf structure
            optionStructure = {
              id: optionID,
              parent: parentID, // Under the options' node
              text: `${text}: <span>${EscapeHTML(value)}</span>`,
              type: 'default',
              icon: normalizePath(Path.join(__dirname, '..', 'assets', 'images', 'tree-icons', 'default.png'))
            }

          // Push the node
          treeStructure.core.data.push(optionStructure)

          if (isCounterTable)
            treeStructure.core.data.push({
              ...optionStructure,
              id: `${optionID}_${counterTablesID}`,
              parent: `${parentID}_${counterTablesID}`
            })
        })
      }

      try {
        if (table.options.length <= 0)
          throw 0

        appendOptions({
          compaction: {
            ...table.options['compaction'],
            bloom_filter_fp_chance: table.options['bloom_filter_fp_chance']
          }
        }, tableID)
      } catch (e) {}

      // Display the `Options` node/leaf if there is at least one option available for the current table
      try {
        /**
         * Options' container that will be under the table overall container
         * Get a random ID for the options' parent/container node
         */
        let optionsID = getRandomID(30),
          // Define the node/leaf structure
          optionsStructure = {
            id: optionsID,
            parent: tableID, // Under the current table
            text: `Options`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'options.png'))
          }

        // Append the options' parent/container to the tree structure
        treeStructure.core.data.push(optionsStructure)

        if (isCounterTable)
          treeStructure.core.data.push({
            ...optionsStructure,
            id: `${optionsID}_${counterTablesID}`,
            parent: `${tableID}_${counterTablesID}`
          })

        // If the current table does not have an `options` attribute, then skip this try-catch block
        if (table.options == undefined || Object.keys(table.options).length <= 0)
          throw 0

        // Initial call to the inner function
        appendOptions(table.options, optionsID)
      } catch (e) {}

      // Table's triggers
      {
        try {
          if (isCounterTable)
            throw 0

          let triggersStructure = {
            id: triggersID,
            parent: tableID,
            text: `Triggers (<span>${table.triggers.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'trigger.png'))
          }

          treeStructure.core.data.push(triggersStructure)

          // if (isCounterTable)
          //   treeStructure.core.data.push({
          //     ...triggersStructure,
          //     id: `${triggersID}_${counterTablesID}`,
          //     parent: `${tableID}_${counterTablesID}`
          //   })

          // Loop through triggers
          table.triggers.forEach((trigger) => {
            // Get a random ID for the trigger
            let triggerID = getRandomID(30)

            // Build a tree view for the trigger
            buildTreeViewForChild(triggersID, triggerID, `Trigger`, trigger, 'trigger')

            // if (isCounterTable)
            //   buildTreeViewForChild(`${triggersID}_${counterTablesID}`, `${triggerID}_${counterTablesID}`, `Trigger`, trigger, 'trigger')
          })
        } catch (e) {}
      }

      // Show a `Views` node/leaf if the current table has at least one view
      try {
        if (isCounterTable)
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
            icon: normalizePath(Path.join(extraIconsPath, 'view.png'))
          }

        // Append the views' container to the tree structure
        treeStructure.core.data.push(viewsStructure)

        // if (isCounterTable)
        //   treeStructure.core.data.push({
        //     ...viewsStructure,
        //     id: `${viewsID}_${counterTablesID}`,
        //     parent: `${tableID}_${counterTablesID}`
        //   })

        // If the current table doesn't have any materialized view then skip this try-catch block
        if (table.views.length <= 0)
          throw 0

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
          buildTreeViewForChild(viewsID, viewID, `View`, view, 'view', {
            keyspace: keyspace.name
          })

          // if (isCounterTable)
          //   buildTreeViewForChild(`${viewsID}_${counterTablesID}`, `${viewID}_${counterTablesID}`, `View`, view, 'view', {
          //     keyspace: keyspace.name
          //   })

          // Loop through the view's children, starting from the clustering keys
          let clusteringKeysStructure = {
            id: clusteringKeysID,
            parent: viewID,
            text: `Clustering Keys (<span>${view.clustering_key.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'clustering-key.png'))
          }

          treeStructure.core.data.push(clusteringKeysStructure)

          if (isCounterTable)
            treeStructure.core.data.push({
              ...clusteringKeysStructure,
              id: `${clusteringKeysID}_${counterTablesID}`,
              parent: `${viewID}_${counterTablesID}`
            })

          // Loop through clustering keys
          view.clustering_key.forEach((clusteringKey) => {
            // Get a random ID for the key
            let clusteringKeyID = getRandomID(30)

            // Build tree view for the key
            buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'clustering-key')

            if (isCounterTable)
              buildTreeViewForChild(`${clusteringKeysID}_${counterTablesID}`, `${clusteringKeyID}_${counterTablesID}`, `Key`, clusteringKey, 'clustering-key')
          })
          // End of view's clustering keys

          // View's partition keys
          let partitionKeysStructure = {
            id: partitionKeysID,
            parent: viewID,
            text: `Partition Keys (<span>${view.partition_key.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'partition-key.png'))
          }

          treeStructure.core.data.push(partitionKeysStructure)

          if (isCounterTable)
            treeStructure.core.data.push({
              ...partitionKeysStructure,
              id: `${partitionKeysID}_${counterTablesID}`,
              parent: `${viewID}_${counterTablesID}`
            })

          // Loop through keys
          view.partition_key.forEach((partitionKey) => {
            // Get a random ID for the key
            let partitionKeyID = getRandomID(30)

            // Build tree view for the key
            buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'partition-key', 'partitionKeys')

            if (isCounterTable)
              buildTreeViewForChild(`${partitionKeysID}_${partitionKeyID}`, `${clusteringKeyID}_${counterTablesID}`, `Key`, partitionKey, 'partition-key', 'partitionKeys')
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

          // if (isCounterTable)
          //   treeStructure.core.data.push({
          //     ...columnsStructure,
          //     id: `${columnsID}_${counterTablesID}`,
          //     parent: `${viewID}_${counterTablesID}`
          //   })

          // Loop through columns
          view.columns.forEach((column) => {
            // Get rid of `is_reversed` attribute
            delete column.is_reversed

            // Get a random ID for the column
            let columnID = getRandomID(30)

            // Build a tree view for the column
            buildTreeViewForChild(columnsID, columnID, `Column`, column, 'column')

            // if (isCounterTable)
            //   buildTreeViewForChild(`${columnsID}_${counterTablesID}`, `${columnID}_${counterTablesID}`, `Column`, column, 'column')
          })
        })
      } catch (e) {}

      // Show an `Indexes` node/leaf if the current table has at least one index
      try {
        if (isCounterTable)
          throw 0

        /**
         * Indexes' container that will be under the table container
         * Get a random ID for the indexes' parent node
         */
        let indexesID = getRandomID(30),
          // Define the node/leaf structure
          indexesStructure = {
            id: indexesID,
            parent: tableID, // Under the current table
            text: `Indexes (<span>${table.indexes.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'index.png'))
          }

        // Append the indexes' container to the tree structure
        treeStructure.core.data.push(indexesStructure)

        // if (isCounterTable)
        //   treeStructure.core.data.push({
        //     ...indexesStructure,
        //     id: `${indexesID}_${counterTablesID}`,
        //     parent: `${tableID}_${counterTablesID}`
        //   })

        // If the current table doesn't have any index then skip this try-catch block
        if (table.indexes.length <= 0)
          throw 0

        // Loop through every index in the table
        table.indexes.forEach((index) => {
          // Get random IDs for the current index and its kind/type
          let [
            indexID,
            kindID
          ] = getRandomID(30, 2)

          indexesInfo.push({
            name: index.name,
            keyspace: keyspace.name,
            table: table.name
          })

          // Build a tree view for the current UDT
          buildTreeViewForChild(indexesID, indexID, `Index`, index, 'index', {
            keyspace: keyspace.name,
            table: table.name
          })

          // if (isCounterTable)
          //   buildTreeViewForChild(`${indexesID}_${counterTablesID}`, `${indexID}_${counterTablesID}`, `Index`, index, 'index', {
          //     keyspace: keyspace.name,
          //     table: table.name
          //   })

          // Push the index's kind's tree view's node structure
          treeStructure.core.data.push({
            id: kindID,
            parent: indexID,
            text: `Kind: <span>${I18next.capitalizeFirstLetter(EscapeHTML(index.kind.toLowerCase()))}</span>`,
            type: 'default'
          })

          // if (isCounterTable)
          //   treeStructure.core.data.push({
          //     id: `${kindID}_${counterTablesID}`,
          //     parent: `${indexID}_${counterTablesID}`,
          //     text: `Kind: <span>${I18next.capitalizeFirstLetter(EscapeHTML(index.kind.toLowerCase()))}</span>`,
          //     type: 'default'
          //   })
        })
      } catch (e) {}
    })

    try {
      let counterTablesNode = treeStructure.core.data.find((node) => node.id == counterTablesID)

      counterTablesNode.state.hidden = false

      counterTablesNode.text = `Counter Tables (<span>${numOfCounterTables}</span>)`
    } catch (e) {}

    // Show a `Views` node/leaf if the current keyspace has at least one view
    try {
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
          icon: normalizePath(Path.join(extraIconsPath, 'view.png'))
        }

      // Append the views' container to the tree structure
      treeStructure.core.data.push(viewsStructure)

      // If the current keyspace doesn't have any materialized view then skip this try-catch block
      if (keyspace.views.length <= 0)
        throw 0

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
        buildTreeViewForChild(viewsID, viewID, `View`, view, 'view', keyspace.name)

        // Add a node/leaf about the view's base table's name
        treeStructure.core.data.push({
          id: getRandomID(30),
          parent: viewID,
          text: `Base Table: <span>${EscapeHTML(view.base_table_name)}</span>`,
          type: 'default'
        })

        // Loop through the view's children, starting from the clustering keys
        let clusteringKeysStructure = {
          id: clusteringKeysID,
          parent: viewID,
          text: `Clustering Keys (<span>${view.clustering_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'clustering-key.png'))
        }

        treeStructure.core.data.push(clusteringKeysStructure)

        // Loop through clustering keys
        view.clustering_key.forEach((clusteringKey) => {
          // Get a random ID for the key
          let clusteringKeyID = getRandomID(30)

          // Build tree view for the key
          buildTreeViewForChild(clusteringKeysID, clusteringKeyID, `Key`, clusteringKey, 'clustering-key')
        })
        // End of view's clustering keys

        // View's partition keys
        let partitionKeysStructure = {
          id: partitionKeysID,
          parent: viewID,
          text: `Partition Keys (<span>${view.partition_key.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'partition-key.png'))
        }

        treeStructure.core.data.push(partitionKeysStructure)

        // Loop through keys
        view.partition_key.forEach((partitionKey) => {
          // Get a random ID for the key
          let partitionKeyID = getRandomID(30)

          // Build tree view for the key
          buildTreeViewForChild(partitionKeysID, partitionKeyID, `Key`, partitionKey, 'partition-key', 'partitionKeys')
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

    // Show an `Indexes` node/leaf if the current keyspace has at least one index
    try {
      /**
       * Indexes' container that will be under the keyspace container
       * Get a random ID for the indexes' parent node
       */
      let indexesID = getRandomID(30),
        // Define the node/leaf structure
        indexesStructure = {
          id: indexesID,
          parent: keyspaceID, // Under the current keyspace
          text: `Indexes (<span>${keyspace.indexes.length}</span>)`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'index.png'))
        }

      // Append the indexes' container to the tree structure
      treeStructure.core.data.push(indexesStructure)

      // If the current keyspace doesn't have any index then skip this try-catch block
      if (keyspace.indexes.length <= 0)
        throw 0

      // Loop through every index in the keyspace
      keyspace.indexes.forEach((index) => {
        // Get random IDs for the current index and its kind/type
        let [
          indexID,
          kindID,
          relatedTableID
        ] = getRandomID(30, 3)

        let indexInfo = {}

        try {
          indexInfo = indexesInfo.find((_index) => _index.name == index.name && _index.keyspace == keyspace.name)
        } catch (e) {}

        // Build a tree view for the current UDT
        buildTreeViewForChild(indexesID, indexID, `Index`, index, 'index', {
          keyspace: keyspace.name,
          table: indexInfo.table
        })

        // Push the index's kind's tree view's node structure
        treeStructure.core.data.push({
          id: kindID,
          parent: indexID,
          text: `Kind: <span>${I18next.capitalizeFirstLetter(EscapeHTML(index.kind.toLowerCase()))}</span>`,
          type: 'default'
        })

        treeStructure.core.data.push({
          id: relatedTableID,
          parent: indexID,
          text: `Table: ${EscapeHTML(indexInfo.table)}`,
          type: 'default',
          icon: normalizePath(Path.join(extraIconsPath, 'table.png'))
        })
      })
    } catch (e) {}

    // Check if the current keyspace has any user-defined element
    try {
      // Get the length of selected user-defined elements
      let lengths = {
          userTypes: keyspace.user_types.length,
          functions: keyspace.functions.length,
          aggregates: keyspace.aggregates.length
        },
        // Get random ID for the main node/leaf
        userDefinedElementsID = getRandomID(30)

      // // Define the main node's structure
      // let userDefinedElementsStructure = {
      //   id: userDefinedElementsID,
      //   parent: keyspaceID,
      //   text: `User Definitions`,
      //   type: 'default',
      //   icon: normalizePath(Path.join(extraIconsPath, 'user_definitions.png'))
      // }
      //
      // // Append the UDEs' container to the tree structure
      // treeStructure.core.data.push(userDefinedElementsStructure)

      // Handle `User Defined Types (UDT)`
      try {
        /**
         * UDTs' parent node that will be under the main node
         * Get a random ID for the UDTs' parent node
         */
        let userTypesID = getRandomID(30),
          // Define the node/leaf structure
          userTypesStructure = {
            id: userTypesID,
            parent: keyspaceID,
            text: `User Defined Types (<span>${lengths.userTypes}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'udt.png')),
            a_attr: {
              keyspace: keyspace.name,
              type: 'udts-parent',
              'allow-right-context': true
            }
          }

        // Append the UDTs' container to the tree structure
        treeStructure.core.data.push(userTypesStructure)

        // If the current keyspace doesn't have any UDT then skip this try-catch block
        if (lengths.userTypes <= 0)
          throw 0

        // Loop through every UDT in the keyspace
        keyspace.user_types.forEach((userType) => {
          // Get random IDs for the current UDT and its fields
          let [
            userTypeID,
            fieldsID
          ] = getRandomID(30, 2)

          // Build a tree view for the current UDT
          buildTreeViewForChild(userTypesID, userTypeID, `User Type`, {
            ...userType,
            keyspace: keyspace.name
          }, 'udt')

          // Loop through each field of the current UDT
          userType.field_names.forEach((field, index) => {
            // Get random IDs for the current field and its type
            let [
              fieldID, fieldTypeID
            ] = getRandomID(30, 2),
              // Get the field's type
              type = userType.field_types[index]

            // Push the field's tree view's node structure
            treeStructure.core.data.push({
              id: fieldID,
              parent: userTypeID,
              text: `<span>${field}</span>: <span>${EscapeHTML(type)}</span>`,
              type: 'default'
            })
          })
        })
      } catch (e) {}

      // Handle `User Defined Functions (UDF)`
      try {
        /**
         * UDFs' parent node that will be under the main node
         * Get a random ID for the UDFs' parent node
         */
        let userFuncsID = getRandomID(30),
          // Define the node/leaf structure
          userFuncsStructure = {
            id: userFuncsID,
            parent: keyspaceID,
            text: `User Defined Functions (<span>${lengths.functions}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'udf.png'))
          }

        // Push the UDFs' node to the tree structure
        treeStructure.core.data.push(userFuncsStructure)

        // If the current keyspace doesn't have any UDF then skip this try-catch block
        if (lengths.functions <= 0)
          throw 0

        // Loop through every UDF in the keyspace
        keyspace.functions.forEach((func) => {
          // Get random IDs for the current UDF and its arguments
          let [
            funcID,
            argumentsID
          ] = getRandomID(30, 2)

          // Build a tree view for the current UDF
          buildTreeViewForChild(userFuncsID, funcID, `User Function`, func, 'udf')

          // Add different attributes to the current UDF
          {
            // Define the attributes' text
            let attributes = [
              `Deterministic: <span class="material-icons for-treeview">${func.deterministic ? 'check' : 'close'}</span>`,
              `Monotonic: <span class="material-icons for-treeview">${func.monotonic ? 'check' : 'close'}</span>`,
              `Called On null Input: <span class="material-icons for-treeview">${func.called_on_null_input ? 'check' : 'close'}</span>`,
              `Language: <span>${EscapeHTML(func.language.toUpperCase())}</span>`,
              `Return Type: <span>${EscapeHTML(func.return_type)}</span>`
            ]

            // Loop through each attribute's text
            attributes.forEach((attribute) => {
              // Push the attribute within a tree view's node structure
              treeStructure.core.data.push({
                id: getRandomID(30),
                parent: funcID,
                text: attribute,
                type: 'default'
              })
            })
          }

          // Push the current UDF's arguments' tree view's node structure
          treeStructure.core.data.push({
            id: argumentsID,
            parent: funcID,
            text: `Arguments (<span>${func.argument_names.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'argument.png'))
          })

          // Loop through each argument
          func.argument_names.forEach((argument, index) => {
            // Get random IDs for the current argument and its type
            let [
              argumentID, argumentTypeID
            ] = getRandomID(30, 2),
              // Get the argument's type
              type = func.argument_types[index]

            // Push the argument's tree tree view's node structure
            treeStructure.core.data.push({
              id: argumentID,
              parent: argumentsID,
              text: `<span>${argument}</span>: <span>${EscapeHTML(type)}</span>`,
              type: 'default'
            })
          })
        })
      } catch (e) {}

      // Handle `User Defined Aggregates (UDA)`
      try {
        /**
         * UDA's parent node that will be under the main node
         * Get a random ID for the UDTs' parent node
         */
        let userAggregatesID = getRandomID(30),
          // Define the node/leaf structure
          userAggregatesStructure = {
            id: userAggregatesID,
            parent: keyspaceID, // Under the current keyspace
            text: `User Defined Aggregates (<span>${lengths.aggregates}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'aggregate.png'))
          }

        // Push the UDA's main node to the tree structure
        treeStructure.core.data.push(userAggregatesStructure)

        // If the current keyspace doesn't have any UDA then skip this try-catch block
        if (lengths.aggregates <= 0)
          throw 0

        // Loop through every UDA in the keyspace
        keyspace.aggregates.forEach((aggregate) => {
          // Get random IDs for the current UDA and its arguments
          let [
            aggregateID,
            argumentsID
          ] = getRandomID(30, 2)

          // Build a tree view for the current UDA
          buildTreeViewForChild(userAggregatesID, aggregateID, `User Function`, aggregate, 'aggregate')

          // Add different attributes to the current UDA
          {
            // Define the attributes' text
            let attributes = [
              `Deterministic: <span class="material-icons for-treeview">${aggregate.deterministic ? 'check' : 'close'}</span>`,
              `Final Function: <span>${aggregate.final_func}</span>`,
              `Initial Condition: <span>${aggregate.initial_condition}</span>`,
              `Return Type: <span>${EscapeHTML(aggregate.return_type)}</span>`,
              `State Function: <span>${aggregate.state_func}</span>`,
              `State Type: <span>${EscapeHTML(aggregate.state_type)}</span>`
            ]

            // Loop through each attribute's text
            attributes.forEach((attribute) => {
              // Push the attribute within a tree view's node structure
              treeStructure.core.data.push({
                id: getRandomID(30),
                parent: aggregateID,
                text: attribute,
                type: 'default'
              })
            })
          }

          // Push the current UDA's arguments types' tree view's node structure
          treeStructure.core.data.push({
            id: argumentsID,
            parent: aggregateID,
            text: `Arguments Types (<span>${aggregate.argument_types.length}</span>)`,
            type: 'default',
            icon: normalizePath(Path.join(extraIconsPath, 'argument.png'))
          })

          // Loop through each argument type of the current UDA
          aggregate.argument_types.forEach((argumentType, index) => {
            // Get random IDs for the current argument type
            let argumentTypeID = getRandomID(30)

            // Push the argument type's tree view's node structure
            treeStructure.core.data.push({
              id: argumentTypeID,
              parent: argumentsID,
              text: `<span>${EscapeHTML(argumentType)}</span>`,
              type: 'default'
            })
          })
        })
      } catch (e) {}
    } catch (e) {}
  })

  // Add the system's keyspaces container node
  try {
    // Define the structure
    let systemKeyspacesStructure = {
      id: systemKeyspacesParentID,
      parent: keyspacesID,
      text: `System Keyspaces (<span>${numOfFoundSystemKeyspaces}</span>)`,
      type: 'default',
      state: {
        opened: true,
        selected: false
      },
      icon: normalizePath(Path.join(extraIconsPath, 'keyspaces.png'))
    }

    // Push the `System Keyspaces` node
    treeStructure.core.data.unshift(systemKeyspacesStructure)
  } catch (e) {}

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
      state: {
        opened: true,
        selected: false
      },
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

      keyspace.a_attr = {
        ...keyspace.a_attr,
        'data-is-virtual': `true`
      }

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
  result = haystack.filter((val) => (`${val}`.toLowerCase()).startsWith(needle))

  // Return an array of matched values
  return result
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
  return this.indexOf(needle) != -1
}

let flattenArray = (array) => {
  let i = 0

  while (i < array.length) {
    if (Array.isArray(array[i])) {
      const nested = flattenArray(array[i])

      array.splice(i, 1, ...nested)
    } else {
      i++
    }
  }
  return array
}

// Extend the jQuery library capabilities by adding new functions to objects
jQuery.fn.extend({
  /**
   * Get the query selector for specific jQuery element
   *
   * @Inspired by this answer: https://stackoverflow.com/a/42184417
   * Comments added after understanding the purpose of each line
   *
   * This function can be called by any jQuery element
   * @Example: $('body').getQuerySelector() // 'HTML > BODY'
   *
   * @Return: {string} the query selector of the jQuery element
   */
  getQuerySelector: function() {
    // Point at the DOM of the jQuery element
    let element = $(this)[0],
      /**
       * Define the final which be returned
       * The initial value is the element's `tag` name
       */
      selector = element.tagName

    // If the `tag` name of the element is `html` then just return it
    if (`${selector}`.toLowerCase() == 'html')
      return 'HTML'

    // If the element has an ID then add it to the final selector
    selector += (element.id != '') ? '#' + element.id : ''

    try {
      // If the element doesn't have any classes then skip this try-catch block
      if (!element.className)
        throw 0

      // Create an array that holds all the element's classes
      let classes = `${element.className}`.split(/\s/)

      // Loop through each class and add it to the final selector
      classes.forEach((_class) => {
        if (_class.trim().length != 0)
          selector += '.' + _class
      })
    } catch (e) {}

    try {
      /**
       * Improved the function by adding the current element's attributes to the selector
       * If the element doesn't have any attributes then skip this try-catch block
       */
      if (element.attributes.length <= 0)
        throw 0

      // Loop through each attribute and add it to the final selector
      for (let attribute of element.attributes) {
        if (attribute.nodeValue.trim().length != 0)
          selector += `[${attribute.nodeName}="${attribute.nodeValue}"]`
      }
    } catch (e) {}

    // The function will keep calling itself till the `html` tag is reached
    return $(element.parentNode).getQuerySelector() + ' > ' + selector
  },
  /**
   * Get object's all attributes as an array
   * String can be passed to the function and will return boolean value if one of the attributes starts with that string
   *
   * This function can be called by any jQuery element
   * @Example: $('body').getAllAttributes('data-') // ['data-test', 'data-test2', ...]
   *
   * @Return: {object} array contains the names of all attributes
   */
  getAllAttributes: function(prefixStringSearch = '') {
    // Get all attributes - as object -
    let attributes = $(this)[0].attributes,
      // Final result which be returned
      names = []

    // Loop throuh each object/attribute and get its name
    for (let i = 0; i < attributes.length; i++)
      names.push(attributes[i].localName)

    try {
      // If there's a prefix string to search for
      if (prefixStringSearch.length <= 0)
        throw 0

      return names.some((name) => name.startsWith(prefixStringSearch))
    } catch (e) {}

    // Return all attributes' names
    return names
  },
  /**
   * Select the content of element - input, div, etc... -
   *
   * @Inspired by this answer: https://stackoverflow.com/a/1173319
   *
   * This function can be called by any jQuery element
   * @Example: $('body').selectContent() // Will select the conent of the element
   */
  selectContent: function() {
    /**
     * Return a new Range object
     * https://developer.mozilla.org/en-US/docs/Web/API/Document/createRange
     */
    let range = document.createRange()

    /**
     * Sets the Range to contain the node and its contents
     * https://developer.mozilla.org/en-US/docs/Web/API/Range/selectNode
     */
    range.selectNode($(this)[0])

    /**
     * Rreturn a Selection object representing the range of text selected by the user or the current position of the caret
     * https://developer.mozilla.org/en-US/docs/Web/API/Window/getSelection
     *
     * Remove all ranges from the selection, leaving the `anchorNode` and `focusNode` properties equal to null and nothing selected
     * https://developer.mozilla.org/en-US/docs/Web/API/Selection/removeAllRanges
     */
    window.getSelection().removeAllRanges()

    /**
     * Add a Range to a Selection
     * https://developer.mozilla.org/en-US/docs/Web/API/Selection/addRange
     */
    window.getSelection().addRange(range)
  },
  // Pause the current animation process of element
  pause: function(animation) {
    // Get the current timestamp
    let currentTimestamp = new Date().getTime(),
      // Calculate the remaining duration to preserved and used on `resume`
      remainingDuration = animation.duration - (currentTimestamp - animation.startTimestamp)

    // If the remaining duration is less than 2s then set it to be 2s
    if (remainingDuration < 2000)
      remainingDuration = 2000

    // Save the remaining duration
    $(this).data('remaining-duration', remainingDuration)

    // Stop the animation but keep the state as it
    $(this).stop()
  },
  // Resume the animation process of element
  resume: function(animation) {
    // Trigger the animation process again with the remaining time
    $(this).animate(animation.properties, $(this).data('remaining-duration'), animation.complete)
  },
  /**
   * Check if the element is "actually" visible
   * The function will check its opacity, visibility, and display values
   *
   * This function can be called by any jQuery element
   * @Example: $('body').isVisible() // true
   *
   * @Return: {boolean} whether or not the element is visible
   */
  isVisible: function() {
    return $(this)[0].checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
      checkDisplayNone: true,
      checkContentVisibility: true
    })
  }
})

/**
 * Open a confirmation dialog
 * The dialog has `confirm` and `cancel` buttons to choose from
 *
 * @Parameters:
 * {string} `text` the dialog's text
 * {object} `callback` function that will be triggered with passing the final result
 * {boolean} `?noBackdrop` whether or not the backdrop background should be rendered
 * {string} `?checkBox` whether or not showing a checkbox, the passed text will be the checkbox's label
 * {object} `?dialogElement` the dialog UI element object to be used instead of the default one
 *
 * @Return: {boolean} action confirmed or canceled
 */
let openDialog = (text, callback, noBackdrop = false, checkBox = '', dialogElement = null) => {
  // Point at the dialog's UI element
  let dialog = dialogElement || $('div#generalPurposeDialog'),
    // Get the dialog's MDB object
    dialogObject = getElementMDBObject(dialog, 'Modal'),
    // Point at the dialog's content container
    dialogContent = dialog.find('div.modal-body'),
    // Point at the dialog's close `X` button
    closeBtn = dialog.find('div.btn-close'),
    // Point at the checkbox input element
    checkBoxInput = dialog.find('input[type="checkbox"]')

  try {
    if (dialogElement != null)
      dialogContent = dialogContent.find('div.text')
  } catch (e) {}

  // Set the dialog's text
  dialogContent.html(text)

  // By default, hide the checkbox form
  checkBoxInput.parent().hide()

  // Handle the need to show the checkbox
  try {
    // If no text passed as a checkbox's label then skip this try-catch block
    if (checkBox.length <= 0)
      throw 0

    setTimeout(() => {
      // Show the form
      checkBoxInput.parent().show()

      // Update the checkbox's label
      checkBoxInput.parent().find('label').find('span[mulang]').attr('mulang', checkBox)

      // Apply the proper language
      Modules.Localization.applyLanguageSpecific(checkBoxInput.parent().find('label').find('span[mulang]'))

      // Reset the checkbox
      checkBoxInput.prop('checked', false)
    })
  } catch (e) {}

  // Add log for this confirmation dialog - its text -
  try {
    addLog(`Confirmation dialog, text: '${text}'`, 'action')
  } catch (e) {}

  // Point at the confirm and cancel buttons in the dialog
  let confirm = dialog.find('button.btn-primary'),
    cancel = dialog.find('button.btn-secondary')

  // Unbind all events listeners on buttons
  confirm.add(cancel).unbind()

  // Set a `click` event listener
  confirm.add(cancel).click(function() {
    // Call the `callback` function with whether the user has clicked on the confirm button or not, and the checkbox's status if needed
    callback(checkBox.length != 0 ? {
      confirmed: $(this).is(confirm),
      checked: checkBoxInput.prop('checked')
    } : $(this).is(confirm))

    // Add log for the confirmation's status
    try {
      addLog(`Confirmation dialog status: '${$(this).is(confirm) ? 'confirmed' : 'canceled'}'`)
    } catch (e) {}

    // Hide the dialog
    dialogObject.hide()
  })

  // Open the dialog
  dialogObject.show()

  // If there's no need for the backdrop background then remove it
  if (noBackdrop)
    $('div.modal-backdrop:last-of-type').remove()
}

let openExtraDataActionsDialog = (text, callback) => openDialog(text, callback, false, '', $('div#extraDataActions'))

/**
 * Print a custom message in the app's terminals
 *
 * @Parameters:
 * {object} `terminal` the terminal object in which the message will be printed - the `readLine` object can be passed too -
 * {string} `type` the type of the message, the value could be:
 * [`warning`, `info`, and `error`]
 * {string} `message` the message's content that will be printed
 * {boolean} `?hideIcon` print the message without a prefix icon that indicates its type
 */
let terminalPrintMessage = (terminal, type, message, hideIcon = false) => {
  // Get the message's length
  let length = message.length + 4,
    // Set the default format (info)
    format = {
      icon: ' ℹ️ ',
      color: '15;168;255'
    }

  // Switch between other types
  switch (type) {
    case 'warning': {
      format.icon = ' ⚠️ '
      format.color = '234;255;18'
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
  message = '\x1b[38;2;' + `${format.color}` + 'm' + `${format.icon}` + '\033[1m' + `${message}` + '\033[0m'

  // Attempt to print a new line
  try {
    terminal.println('')
  } catch (e) {
    // As `println` didn't work use `writeln` which is used with the Xterm object
    terminal.writeln('')
  }

  /**
   * Print the message in the given terminal
   * Try with `println` which is used with the `Readline` addon
   */
  try {
    terminal.println(message)
  } catch (e) {
    // As `println` didn't work use `writeln` which is used with the Xterm object
    terminal.writeln(message)
  }
}

/**
 * Get the public/private key to be used for encryption/decryption
 *
 * @Parameters:
 * {string} `type` the key's type, the value could be:
 * [`public` or `private`]
 * {object} `callback` function that will be triggered with passing the final result
 * {boolean} `?called` whether or not the function has already been called and this is the second attempt to get the key
 *
 * @Return: {string} the public/private key, or an empty string
 */
let getKey = async (type, callback, called = false) => {
  // Add log for this process
  try {
    addLog(`Obtain the ${type} key for encryption or decryption`, 'process')
  } catch (e) {}

  try {
    // If the key's type is not `private` then skip this try-catch block
    if (type != 'private')
      throw 0

    // Define our private key service
    const Service = 'AxonOpsWorkbenchPrivateKey'

    /**
     * Use `keytar` to get the private key on the fly
     * The private key will be removed automatically from memory after being used
     */
    Keytar.findPassword(Service).then(async (key) => {
      /**
       * It happens - especially on Windows - that a `\x00` hex value might be added,
       * this value leads to corruption in the private key format, so it should be removed
       */
      key = `${key}`.replace(/\x00/gm, '')

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
      await Keytar.setPassword(Service, 'key', ' ')
      await Keytar.deletePassword(Service, 'key')

      /**
       * Ask for the actual key again
       * This method has worked every time the first attempt failed
       */
      getKey('private', callback, true)
    })

    // Skip the upcoming code - since it's about obtaining a public key -
    return
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

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
  let encryptedText = text || '' // The final encrypted text which be returned

  // Add log for this process
  try {
    addLog(`Use the RSA cryptosystem to encrypt a text`, 'process')
  } catch (e) {}

  try {
    // Create a public RSA object
    let public = new NodeRSA(publicKey, 'public', {
      encryptionScheme: 'pkcs1_oaep'
    })

    // Encrypt the given text
    encryptedText = public.encrypt(text).toString('base64')
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  } finally {
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
  let decryptedText = text || '' // The final decrypted text

  // Add log for this process
  try {
    addLog(`Use the RSA cryptosystem to decrypt a text`, 'process')
  } catch (e) {}

  try {
    // Create a private RSA object
    let private = new NodeRSA(privateKey, 'private', {
      encryptionScheme: 'pkcs1_oaep'
    })

    // Decrypt the given text
    decryptedText = private.decrypt(text).toString('utf8')
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  } finally {
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
  try {
    addLog(`Executing the script '${scripts[scriptID]}' within a connection process with cluster`, 'process')
  } catch (e) {}

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
    try {
      addLog(`Execution status of the script '${scripts[scriptID]}' is '${isNaN(status) ? originalStatus : status}'`)
    } catch (e) {}

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
      try {
        errorLog(e, 'functions')
      } catch (e) {}

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

  // Define the text to be added to the log regards the workspace
  let workspace = `workspace #${workspaceID}`

  // Add log about this process
  try {
    addLog(`Get all pre and post-connection scripts of ${clusterID != null ? 'connection #' + clusterID + ' in ' : ' a connection about to be added/updated in '}${workspace}`, 'process')
  } catch (e) {}

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
    } catch (e) {
      try {
        errorLog(e, 'functions')
      } catch (e) {}
    }

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
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Add log if scripts have been found
  if (scripts.length != 0)
    try {
      addLog(`Pre and post-connection scripts of ${clusterID != null ? 'connection #' + clusterID + ' in ' : ' a connection about to be added/updated in '}${workspace} are (${JSON.stringify(scripts)})`, 'process')
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
    try {
      ports.push(await PortGet())
    } catch (e) {
      try {
        errorLog(e, 'functions')
      } catch (e) {}
    }

  // Add log about the free-to-use ports
  try {
    addLog(`Get ${amount} free-to-use port(s), returned '${amount == 1 ? ports[0] : JSON.stringify(ports)}'`, 'network')
  } catch (e) {}

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
  // Final result to be returned
  let [r, g, b] = ['', '', '']

  try {
    // Check if the color starts with `#` and remove it if so
    if (hex.indexOf('#') === 0)
      hex = `${hex}`.slice(1)

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
      return `${(zeros + str)}`.slice(-len)
    }

    /**
     * Calculate the inverted RGB values by the following steps:
     * Subrtact each channel value from 255.
     * Convert the result to HEXA (16).
     * Then add leading zeros if needed.
     */
    r = padZero((255 - parseInt(`${hex}`.slice(0, 2), 16)).toString(16))
    g = padZero((255 - parseInt(`${hex}`.slice(2, 4), 16)).toString(16))
    b = padZero((255 - parseInt(`${hex}`.slice(4, 6), 16)).toString(16))
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

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
  try {
    // Run the command to check SSH
    Terminal.run('ssh -V', (err, stderr, data) => {
      // Add log for the process' result
      try {
        addLog(`Check SSH client existence and accessibility, status: '${!(err || stderr) ? 'exists and accessible' : 'not exists or inaccessible. Details: ' + err || stderr}'`, 'process')
      } catch (e) {}

      // Call the callback function with the result
      callback(!(err || stderr))
    })
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }
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
  // Send the request to the main thread
  IPCRenderer.send('ssh-tunnel:create', data)

  // Once a response is received
  IPCRenderer.on(`ssh-tunnel:create:result:${data.requestID}`, (_, receivedData) => {
    // Remove all listeners as a result has been received
    IPCRenderer.removeAllListeners(`ssh-tunnel:create:result:${data.requestID}`)

    // Call the callback function with passing the result
    callback(receivedData)
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
  // Final result to be returned
  let beautifiedJSON = ''

  try {
    // The given JSON object needs to be sorted
    if (sort)
      object = SortJSON(object, {
        ignoreCase: true,
        reverse: false,
        depth: 5
      })

    // Attempt to beautify the passed JSON object
    beautifiedJSON = BeautifyJSON(object, null, 2, 80)
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Return the beautified version of the JSON
  return beautifiedJSON
}

/**
 * Manipulate a given text; by getting rid of all spaces, and lowering the case of all chars
 *
 * @Parameters:
 * {string} `text` the text that will be manipulated
 *
 * @Return: {string} the passed text after manipulation
 */
let manipulateText = (text) => `${text}`.replace(/\s+/gm, '').toLowerCase()

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
 * Manipulate a passed output by removing all possible ANSI escape sequences
 *
 * @Parameters:
 * {string} `output` the output to be manipulated
 *
 * @Return: {string} the passed output after manipulation
 */
let manipulateOutput = (output) => {
  try {
    /**
     * Manipulate the passed output
     *
     * Remove all possible ANSI escape sequences using a basic regex
     */
    let manipulatedOutput = `${output}`.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      /**
       * Use an advanced regex as an extra step of the manipulation
       * The regex has been retrieved from the `ansi-regex` module -
       */
      .replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '')
      /**
       * Use another regex to cover all ANSI sequences as much as possible
       * Reference: https://stackoverflow.com/a/29497680
       */
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
      // Remove some added chars from cqlsh tool
      .replace(/u\'/gm, "'")

    // Another regex to cover more ASCII escape characters for Windows
    if (OS.platform == 'win32')
      manipulatedOutput = `${manipulatedOutput}`.replace(/[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\[0K|\[\?25[hl]/g, '')

    // Return the final manipulated output
    return manipulatedOutput
  } catch (e) {
    // If any error has occured then return the passed output
    return output
  }
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
    let defaultPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'data', 'workspaces'),
      // Point at the workspace element in the UI
      workspaceElement = $(`div.workspace[data-id="${workspaceID}"]`),
      // Get its folder name and its path
      [folderName, folderPath] = getAttributes(workspaceElement, ['data-folder', 'data-folder-path'])

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
  } catch (e) {
    try {
      errorLog(e, 'functions')
    } catch (e) {}
  }

  // Add log for this process
  try {
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
      if (['cwb', 'metadata', 'tmp', 'cqldesc', 'checkconn', 'aocwtmp'].some((extension) => item.endsWith(`.${extension}`)) || item.startsWith('preview_item_')) {
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

let quoteForRegex = (text) => `${text}`.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')

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
  clusterName = `${clusterName}`.replace(/\s+/gm, ''),
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
    $('.change-color[color]').attr('color', tinyColor.isValid() ? workspaceColor : '#dfdfdf')

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
          .form-check-input[type=radio]:not([no-color]):checked:after {border-color: ${backgroundColor.hover.replace('70%', '35%')} !important; background-color: ${backgroundColor.hover.replace('70%', '35%')} !important;}
          .form-check-input[type=radio]:not([no-color]):checked {background: ${backgroundColor.hover.replace('70%', '25%')} !important;}
          .changed-color {color: ${textColor} !important}
          .nav-tabs .nav-item.show .nav-link, .nav-tabs .nav-link.active, form-check-input:not([no-color]):checked, .form-check-input:not([no-color]):checked:focus, .form-check-input:not([no-color]):checked, .form-check-input:not([no-color]):checked:focus {border-color: ${backgroundColor.default} !important}
          ion-icon[name="lock-closed"] {color: ${backgroundColor.default} !important}
          .jstree-default-dark .jstree-search {background: ${backgroundColor.hover.replace('70%', '15%')} !important;}
          .tabulator .tabulator-header{border-bottom-color:${backgroundColor.default} !important;}
          .tabulator .tabulator-footer{border-top-color:${backgroundColor.default} !important;}
          .tabulator .tabulator-header .tabulator-col input:focus, .tabulator .tabulator-header .tabulator-col select:focus{border-color: ${backgroundColor.default} !important}
          .tabulator .tabulator-header .tabulator-col.tabulator-sortable .tabulator-col-content .tabulator-col-sorter .tabulator-arrow {border-top-color: ${backgroundColor.default} !important; color: ${backgroundColor.default} !important;}
          .tabulator .tabulator-header .tabulator-col.tabulator-sortable[aria-sort=ascending] .tabulator-col-content .tabulator-col-sorter .tabulator-arrow {border-bottom-color: ${backgroundColor.default} !important;}
          .tabulator .tabulator-footer .tabulator-page-size, .tabulator .tabulator-footer .tabulator-page {border: 1px solid ${backgroundColor.default} !important;color: #f8f8f8 !important;}
          .tabulator .tabulator-footer .tabulator-page.active{background:${backgroundColor.hover} !important;color: ${textColor} !important}
          .colored-box-shadow{box-shadow: 0px 0px 20px 1px ${backgroundColor.hover.replace('70%', '40%')} !important;}
          :root {--workspace-background-color:${backgroundColor.default};}

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
  if (!isLoggingEnabled)
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
  try {
    addLog(`Error in process ${process}. Details: ${error}`, 'error')
  } catch (e) {}
}

/**
 * Close all active work areas - clusters and sandbox projects -
 * This function is called once the user decides to close all work areas, and on app termination
 */
let closeAllWorkareas = () => {
  // Point at all work areas
  let workareas = $('div.body div.right div.content div[content="workarea"] div.workarea[cluster-id]')

  // Add log for this  process
  try {
    addLog(`Close all active work areas, count is '${workareas.length}' work area(s)`, 'process')
  } catch (e) {}

  // Loop through each docker/sandbox project and attempt to close it
  Modules.Docker.getProjects().then((projects) => projects.forEach((project) => Modules.Docker.getDockerInstance(project.folder).stopDockerCompose(undefined, () => {})))

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
        return showToast(I18next.capitalize(I18next.t('close work area')), I18next.capitalizeFirstLetter(I18next.replaceData(`the work area of local cluster [b]$data[/b] is being terminated`, [getAttributes(clusterElement, 'data-name')])) + '.', 'success')

      // Otherwise, show this toast
      showToast(I18next.capitalize(I18next.t('close work area')), I18next.capitalizeFirstLetter(I18next.replaceData(`the work area of connection [b]$data[/b] in workspace [b]$data[/b] has been successfully closed`, [getAttributes(clusterElement, 'data-name'), getAttributes(workspaceElement, 'data-name')])) + '.', 'success')
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


let handleContentInfo = (type, element = null) => {
  let leftSide = $('div.body div.right div.content-info div._left'),
    rightSide = $('div.body div.right div.content-info div._right'),
    workspacesActions = rightSide.find('div._actions._for-workspaces'),
    clustersActions = rightSide.find('div._actions._for-clusters'),
    arrow = leftSide.find('div._arrow'),
    cluster = leftSide.find('div._cluster')

  arrow.add(cluster).toggleClass('show', type == 'clusters')

  workspacesActions.toggleClass('show', type != 'clusters')
  clustersActions.toggleClass('show', type == 'clusters')

  setTimeout(() => $('div.body div.right').removeClass('hide-content-info'), 200)

  try {
    if (element == undefined)
      throw 0

    cluster.find('div.text').text(element.attr('data-name'))
    cluster.find('div._color').css('background', element.attr('data-color'))
  } catch (e) {

  } finally {

  }
}

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

let buildTableFieldsTreeview = (keys = [], columns = [], udts = [], keyspaceUDTs = [], enableBlobPreview = false, singleNode = null) => {
  let treeStructure = {
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
          'icons': false,
          'name': 'default-dark'
        },
        'check_callback': true,
        'data': []
      },
      'plugins': ['dnd', 'state', 'noclose']
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

      return {
        type,
        extraProps
      }
    },
    isInsertionAsJSON = $('#rightClickActionsMetadata').attr('data-as-json') === 'true',
    handleNode = (nodeObject, parentID = '#') => {
      let nodeID = getRandomID(30),
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
            'static-id': `${nodeID}`,
            'mandatory': nodeObject.isMandatory,
            'no-empty-value': nodeObject.noEmptyValue == true
          }
        },
        manipulatedType = getInputType(nodeObject.type),
        defaultValue = manipulatedType.extraProps.default || null,
        inputStep = manipulatedType.step ? `step="${manipulatedType.step}"` : '',
        isIgnoranceCheckboxShown = false

      try {
        isIgnoranceCheckboxShown = parentID == '#' && nodeObject.fieldType != 'udt-field'
      } catch (e) {}

      defaultValue = defaultValue && !isInsertionAsJSON ? `value="${defaultValue}"` : ''

      let inputFieldUIElement = `
          <div class="form-outline form-white ignored-applied null-related" style="z-index:1;">
            <div class="clear-field hide" ${manipulatedType.type == 'checkbox' ? 'hidden' : ''}>
              <div class="btn btn-tertiary" data-mdb-ripple-color="light">
                <ion-icon name="close"></ion-icon>
              </div>
            </div>
            <input type="${manipulatedType.type}" data-field-type="${nodeObject.type}" class="form-control ${manipulatedType.type != 'checkbox' ? 'has-clear-button' : ''}" id="_${getRandomID(10)}" ${defaultValue} ${inputStep}>
            <label class="form-label">
              <span mulang="value" capitalize></span>
            </label>
          </div>`,
        fieldActions = ``

      try {
        if (manipulatedType.type != 'switch')
          throw 0

        let switchBtnID = getRandomID(10)

        inputFieldUIElement = `
          <div class="form-check form-switch form-white ignored-applied null-related">
            <input class="form-check-input checkbox-checked" type="checkbox" role="switch" id="_${switchBtnID}" data-field-type="${nodeObject.type}">
            <label class="form-check-label uppercase" for="_${switchBtnID}" onclick="handleLabelClickEvent(this)">false</label>
          </div>`
      } catch (e) {}

      try {
        if (!(['map', 'set', 'list'].some((type) => `${nodeObject.type}`.includes(`${type}<`))))
          throw 0

        nodeStructure.a_attr['add-items'] = true

        nodeStructure.a_attr['add-hidden-node'] = getRandomID(30)

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
        if (`${nodeObject.type}` != 'uuid')
          throw 0

        let dropDownBtnID = getRandomID(30)

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

        let dropDownBtnID = getRandomID(30)

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
            <l-ring-2 size="20" stroke="2" stroke-length="0.25" bg-opacity="0.25" speed="0.45" color="white"></l-ring-2>
          </div>`
      } catch (e) {}

      try {
        if (`${nodeObject.type}` != 'timeuuid')
          throw 0

        let dropDownBtnID = getRandomID(30)

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

        let dropDownBtnID = getRandomID(30),
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
    handleUDT = (udtObject, parentID = '#', returnStructure = false) => {
      let udtGroupStrcuture = []

      try {
        let udtID = getRandomID(30),
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
          groupStructure.udtColumns.core.data.push(udtNodeStructure)
        }


        for (let i = 0; i < udtObject.field_names.length; i++) {
          let fieldName = udtObject.field_names[i],
            fieldType = udtObject.field_types[i]


          fieldType = removeFrozenKeyword(fieldType)

          try {
            let fieldUDT = keyspaceUDTs.find((udt) => fieldType == udt.name)

            if (fieldUDT == undefined)
              throw 0

            let fieldUDTStructure = handleUDT({
              ...fieldUDT,
              name: fieldName,
              type: fieldType
            }, udtID, returnStructure)

            if (returnStructure)
              udtGroupStrcuture.push(fieldUDTStructure)

            continue
          } catch (e) {}

          try {
            let fieldNodeStructure = handleNode({
              name: fieldName,
              type: fieldType,
              fieldType: 'udt-field',
              isMandatory: false,
              noEmptyValue: true
            }, udtID)

            if (returnStructure) {
              udtGroupStrcuture.push(fieldNodeStructure)
            } else {
              groupStructure.udtColumns.core.data.push(fieldNodeStructure)
            }
          } catch (e) {}
        }
      } catch (e) {}

      if (returnStructure)
        return udtGroupStrcuture

    },
    groupStructure = {},
    groups = ['primaryKey', 'regularColumns', 'collectionColumns', 'udtColumns']

  if (singleNode != null)
    return singleNode.isUDT ? handleUDT(singleNode, '#', true) : handleNode(singleNode)

  for (let group of groups)
    groupStructure[group] = JSON.parse(JSON.stringify(treeStructure))

  for (let key of keys) {
    try {
      let keyNodeStructure = handleNode({
        ...key,
        fieldType: 'primary-key',
        isMandatory: true
      })

      groupStructure.primaryKey.core.data.push(keyNodeStructure)
    } catch (e) {}
  }

  for (let column of columns) {
    try {
      let columnNodeStructure = handleNode({
          ...column,
          fieldType: 'regular-column',
          isMandatory: false
        }),
        isTypeCollection = ['map', 'set', 'list'].some((type) => `${column.type}`.includes(`${type}<`))

      if (isTypeCollection) {
        groupStructure.collectionColumns.core.data.push(columnNodeStructure)
      } else {
        groupStructure.regularColumns.core.data.push(columnNodeStructure)
      }
    } catch (e) {}
  }

  for (let udt of udts)
    handleUDT(udt)

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

let getBlobType = (blobHEXString, callback) => {
  let blobBytes = []

  try {
    blobBytes = ConvertHEX.hexToBytes(`${blobHEXString}`.slice(0, 24))
  } catch (e) {}

  DetectFileType.fromBuffer(blobBytes, (err, result) => callback(err, result))
}

let getCheckedValue = (groupName) => {
  let selectedValue = '',
    radioButtons = document.getElementsByName(groupName);

  for (let i = 0; i < radioButtons.length; i++) {
    if (radioButtons[i].checked) {
      selectedValue = radioButtons[i].value
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
