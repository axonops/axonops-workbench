let encryptTextBG = (text, keychainOSName = null) => getRSAKey('public', (key) => IPCRenderer.send(`background:text:encrypt`, {
  key,
  text,
  keychainOSName
}))

let decryptTextBG = (text, callback, keychainOSName = null) => getRSAKey('private', (key) => {
  let requestID = `_${getRandom.id()}`

  IPCRenderer.send(`background:text:decrypt`, {
    requestID,
    key,
    text,
    keychainOSName
  })

  IPCRenderer.on(`background:text:decrypt:result:${requestID}`, (_, text) => {
    callback(text)

    try {
      IPCRenderer.removeAllListeners(`background:text:decrypt:result:${requestID}`)
    } catch (e) {}
  })
})

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
let suggestionSearch = (needle, haystack, checkDoubleQuotes = false) => {
  let result = [] // Final result which be returned

  // Lowered the case for the `needle`
  needle = needle.toLowerCase()

  if (checkDoubleQuotes)
    needle = needle.replace(/^\"*(.*?)\"*$/g, '$1')

  // Filter the `haystack` by keeping values that start with the `needle`
  result = haystack.filter((val) => (`${val}`.toLowerCase()).startsWith(needle))

  // Return an array of matched values
  return result
}

/**
 * Search for a given string in another string
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

// Format a number by adding commas
Number.prototype.format = function() {
  let n = this.toString() // The given number
  if (n.length >= 4) {
    let p = 0 // Current loop pointer position
    let nw = '' // The new formatted number
    let d = '' // Everything after the decimal point
    if (n.indexOf('.') != -1) {
      d = n.slice(n.indexOf('.'))
      n = n.slice(0, n.indexOf('.'))
    }
    for (let i = (n.length - 1); i >= 0; --i) {
      ++p
      if (p == 3) {
        if (i == 0 && (n.length % 3 == 0)) {
          nw = n[i] + nw
        } else {
          nw = ',' + n[i] + nw
        }
        p = 0
      } else {
        nw = n[i] + nw
      }
    }
    return nw + d
  } else {
    return n
  }
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
  },
  isVisibleInContainer: function() {
    let elementRect = $(this)[0].getBoundingClientRect(),
      containerRect = $(this).offsetParent()[0].getBoundingClientRect()

    let isVisible = (
      elementRect.top >= containerRect.top &&
      elementRect.left >= containerRect.left &&
      elementRect.bottom <= containerRect.bottom &&
      elementRect.right <= containerRect.right
    )

    return isVisible
  },
  /**
   * Modern replacement for `mutate.js` using `MutationObserver` API
   * Watches for CSS transform property changes
   *
   * @Example: $(element).observeTransform(callback)
   * @Return: {jQuery} Returns `this`
   */
  observeTransform: function(callback) {
    if (typeof callback !== 'function')
      return this

    return this.each(function() {
      let element = $(this),
        previousTransform = element.css('transform')

      // Create `MutationObserver` to watch for `transform` attribute changes
      let observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {
        if (!(mutation.type === 'attributes' && mutation.attributeName === 'style'))
          return

        let currentTransform = element.css('transform')

        // Only fire callback if transform actually changed
        if (currentTransform === previousTransform)
          return

        previousTransform = currentTransform

        callback.call(element[0])
      }))

      // Start observing
      observer.observe(element[0], {
        attributes: true,
        attributeFilter: ['style']
      })

      // Track for cleanup
      try {
        globalTrackers.observers.push(observer)
      } catch (e) {}
    })
  },
  /**
   * Another modern replacement for `mutate.js` using `IntersectionObserver` API
   * Watches for element visibility changes (show/hide)
   *
   *
   * @Example: $(element).observeVisibility(callback)
   * @Return: {jQuery} Returns `this`
   */
  observeVisibility: function(callback) {
    if (typeof callback !== 'function')
      return this

    return this.each(function() {
      let element = $(this),
        wasVisible = element.is(':visible')

      // Create `IntersectionObserver` to watch for visibility changes
      let observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        let isVisible = entry.isIntersecting && element.is(':visible')

        // Only fire callback when visibility state changes
        if (isVisible && !wasVisible) {
          wasVisible = true

          callback.call(element[0])
        } else if (!isVisible && wasVisible) {
          wasVisible = false
        }
      }), {
        threshold: 0.01 // Fire when at least 1% of element is visible
      })

      // Start observing
      observer.observe(element[0])

      // Track for cleanup
      try {
        globalTrackers.observers.push(observer)
      } catch (e) {}
    })
  },
  getAbsolutePosition: function() {
    if (!$(this) || !$(this).length)
      return {
        x: 0,
        y: 0
      }

    let offset = $(this).offset()

    return {
      x: offset.left,
      y: offset.top
    }
  },
  getNextElement: function(selector, direction) {
    // Navigate Left
    if (direction === 'left') {
      // Find all previous siblings matching the selector and get the closest one
      let prevElements = $(this).prevAll(selector)

      return prevElements.length > 0 ? prevElements.first() : $()
    }

    // Navigate Right
    if (direction === 'right') {
      // Find all next siblings matching the selector and get the closest one
      let nextElements = $(this).nextAll(selector)

      return nextElements.length > 0 ? nextElements.first() : $()
    }

    // Navigate Up or Down
    if (direction === 'up' || direction === 'down') {
      // 1. Get the parent row
      let row = $(this).parent(),
        // 2. Get all matching elements in the current row
        cellsInRow = row.children(selector),
        // 3. Find the index of the current element among matching siblings
        index = cellsInRow.index($(this))

      // If element not found in current row, return empty
      if (index === -1)
        return $()

      // 4. Find the target row based on direction
      let targetRow = (direction === 'up') ? row.prev() : row.next()

      // If no target row exists, return empty
      if (targetRow.length === 0)
        return $()

      // 5. Get the element at the same index in the target row
      let targetCell = targetRow.children(selector).eq(index)

      return targetCell.length > 0 ? targetCell : $()
    }

    // Return an empty jQuery object if direction is invalid
    return $()
  },
  scrollToElement: function() {
    if ($(this).length === 0)
      return

    // Find all scrollable parents
    let scrollableParents = $(this).findScrollableParents()

    if (scrollableParents.length > 0) {
      let scrollableParent = $(scrollableParents[0]),
        containerOffset = scrollableParent.offset(),
        elementOffset = $(this).offset(),
        containerScrollTop = scrollableParent.scrollTop(),
        containerScrollLeft = scrollableParent.scrollLeft()

      // Calculate the position of the element relative to the scrollable container
      let relativeTop = elementOffset.top - containerOffset.top,
        relativeLeft = elementOffset.left - containerOffset.left,
        scrollConfig = {},
        // Check if vertical scrolling is needed
        containerHeight = scrollableParent.innerHeight()

      if (relativeTop < 0 || relativeTop > containerHeight)
        scrollConfig.scrollTop = containerScrollTop + relativeTop - (containerHeight / 2)

      // Check if horizontal scrolling is needed
      let containerWidth = scrollableParent.innerWidth()

      if (relativeLeft < 0 || relativeLeft > containerWidth)
        scrollConfig.scrollLeft = containerScrollLeft + relativeLeft - (containerWidth / 2)

      // Animate scroll if needed
      if (Object.keys(scrollConfig).length > 0)
        scrollableParent.animate(scrollConfig, 20)
    } else {
      // No scrollable parent found, scroll the window
      $('html, body').animate({
        scrollTop: $(this).offset().top - 100,
        scrollLeft: $(this).offset().left - 100
      }, 20)
    }
  },
  findScrollableParents: function() {
    let scrollableParents = [],
      parent = $(this).parent()

    // Traverse up the DOM tree to find all scrollable parents
    while (parent.length > 0 && !parent.is('html')) {
      let overflowY = parent.css('overflow-y'),
        overflowX = parent.css('overflow-x'),
        overflow = parent.css('overflow')

      // Check if this parent is scrollable
      let isScrollableY = (overflowY === 'auto' || overflowY === 'scroll' || overflow === 'auto' || overflow === 'scroll'),
        isScrollableX = (overflowX === 'auto' || overflowX === 'scroll' || overflow === 'auto' || overflow === 'scroll')

      // Check if it actually has scrollable content
      let hasVerticalScroll = parent[0].scrollHeight > parent[0].clientHeight,
        hasHorizontalScroll = parent[0].scrollWidth > parent[0].clientWidth

      // Add to array if it's scrollable in any direction
      if ((isScrollableY && hasVerticalScroll) || (isScrollableX && hasHorizontalScroll))
        scrollableParents.push(parent)

      parent = parent.parent()
    }

    return scrollableParents
  }
})
