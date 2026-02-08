/**
 * Split a given array into two arrays based on an attribute in the items
 *
 * @Parameters:
 * {object} `array` the array to be splitted
 * {string} `attribute` the attribute to be looking for among items
 *
 * @Return: {object} an array consists of two items:
 ** The first item is an array of items before finding the attribute
 ** Second item is an array of all items after finding the attribute
 */
let splitArrayByAttrbiute = (array, attribute) => {
  array = array || []

  let index = array.findIndex(item => item[attribute] === true)

  if (index === -1)
    return [array, []]

  let firstArray = array.slice(0, index + 1),
    secondArray = array.slice(index + 1)

  return [firstArray, secondArray]
}

/**
 * Flatten a given array and make all its items in level 1
 *
 * @Parameters:
 * {object} `array` the array to be flattened
 *
 * @Return: {object} the array after the manipulation process
 */
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

/**
 * Open a confirmation dialog
 * The dialog has a `confirm` and `cancel` buttons to choose from
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

/**
 * Shorthand the function `openDialog(text, callback, ?noBackdrop, ?checkBox, ?dialogElement)` in case a quick and small action dialog is needed
 *
 * @Parameters:
 * {string} `text` the dialog's text
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {boolean} action confirmed or canceled
 */
let openExtraDataActionsDialog = (text, callback) => openDialog(text, callback, false, '', $('div#extraDataActions'))

/**
 * Print a custom message in a basic terminal - like cqlsh basic and bash sessions -
 *
 * @Parameters:
 * {object} `terminal` the terminal object in which the message will be printed - the `readLine` object can be passed too -
 * {string} `type` the type of the message, the value could be:
 * [`warning`, `info`, and `error`]
 * {string} `message` the message's content that will be printed
 * {boolean} `?hideIcon` print the message without a prefix icon that indicates its type
 */
let printMessageInBasicTerminal = (terminal, type, message, hideIcon = false) => {
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
    try {
      terminal.writeln('')
    } catch (e) {}
  }

  /**
   * Print the message in the given terminal
   * Try with `println` which is used with the `Readline` addon
   */
  try {
    terminal.println(message)
  } catch (e) {
    // As `println` didn't work use `writeln` which is used with the Xterm object
    try {
      terminal.writeln(message)
    } catch (e) {}
  }
}

/**
 * Get the public/private key to be used for encryption/decryption
 *
 * @Parameters:
 * {string} `type` the key's type, the value could be:
 ** [`public` or `private`]
 * {object} `callback` function that will be triggered with passing the final result - key or an empty string -
 * {boolean} `?called` whether or not the function has already been called and this is the second attempt to get the key
 *
 * @Return: {string} the public/private key, or an empty string
 */
let getRSAKey = async (type, callback, called = false) => {
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
       * then call the `getRSAKey` again, and it should return the key this time
       */
      try {
        await Keytar.setPassword(Service, 'key', ' ')
        await Keytar.deletePassword(Service, 'key')
      } catch (e) {}

      /**
       * Ask for the actual key again
       * This method has worked every time the first attempt failed
       */
      getRSAKey('private', callback, true)
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
  let requestID = getRandom.id(20)

  // Request to get the public key
  IPCRenderer.send('public-key:get', requestID)

  // Wait for the response
  IPCRenderer.on(`public-key:${requestID}`, (_, result) => {
    // Save the public key in the `publicKey` global variable
    publicKey = result

    try {
      IPCRenderer.removeAllListeners(`public-key:${requestID}`)
    } catch (e) {}

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
let encryptText = (publicKey, text) => {
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
let decryptText = (privateKey, text) => {
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

// Get random items using those functions
let getRandom = {
  /**
   * Get random free-to-use port(s)
   *
   * @Parameters:
   * {integer} `?amount` the number of port(s) to get/generate, default is 1
   *
   * @Return: {integer || object} one port, or group - array - of ports
   */
  port: async (amount = 1) => {
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
  },
  /**
   * Get random ID(s)
   *
   * @Parameters:
   * {integer} `length` the length of all IDs
   * {integer} `?amount` the number of ID(s) to get/generate, default is 1
   *
   * @Return: {integer || object} one ID, or group of IDs
   */
  id: (length, amount = 1) => {
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
  },
  /**
   * Get random HEX color(s)
   *
   * @Parameters:
   * {integer} `?amount` the number of colors to get/generate, default is 1
   *
   * @Return: {integer || object} one color, or group of colors
   */
  color: (amount = 1) => {
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
  },
  /**
   * Get a random number in specific interval
   *
   * @Parameters:
   * {integer} `min` the starting number of the interval
   * {integer} `max` the ending number of the interval
   *
   * @Return: {integer} random number from the specific interval
   */
  numberInterval: (min, max) => Math.floor(Math.random() * (max - min + 1) + min)
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

// Functions for the SSH Tunnel
let tunnelSSH = {
  /**
   * Check if the host machine has an SSH client installed
   * Works on all major operating systems (Linux, macOS, and Windows)
   *
   * @Parameters:
   * {object} `callback` function that will be triggered with passing the final result
   *
   * @Return: {boolean} the host machine has an SSH client or not
   */
  checkClient: (callback) => {
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
  },
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
  createTunnel: (data, callback) => {
    // Send the request to the main thread
    IPCRenderer.send('ssh-tunnel:create', data)

    // Once a response is received
    IPCRenderer.on(`ssh-tunnel:create:result:${data.requestID}`, (_, receivedData) => {
      // Remove all listeners as a result has been received
      try {
        IPCRenderer.removeAllListeners(`ssh-tunnel:create:result:${data.requestID}`)
      } catch (e) {}

      // Call the callback function with passing the result
      callback(receivedData)
    })
  }
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
let beautifyJSON = (object, sort = false) => {
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
 * Manipulate a given text; by getting rid of all spaces, and lowering the case of all chars
 *
 * @Parameters:
 * {string} `text` the text that will be manipulated
 *
 * @Return: {string} the passed text after manipulation
 */
let manipulateText = (text) => `${text}`.replace(/\s+/gm, '').toLowerCase()

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
