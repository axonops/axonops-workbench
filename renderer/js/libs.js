/**
 * Libraries, packages and custom modules importing file
 *
 * Import all essential libraries and modules
 *
 * Node.js file system module - improved version which has methods that aren't included in the native `fs` module -
 * Used for working with files system, it provides related utilities
 */
const FS = require('fs-extra'),
  /**
   * Node.js OS module
   * Used for operating system-related utilities and properties
   */
  OS = require('os'),
  /**
   * Electron renderer communication with the main thread
   * Used for sending requests from the renderer threads to the main thread and listening to the responses
   */
  IPCRenderer = require('electron').ipcRenderer,
  /**
   * Electron clipboard module
   * Perform copy and paste operations on the system clipboard
   * Mainly used for copying the cluster's metadata
   */
  Clipboard = require('electron').clipboard,
  /**
   * Convert a byte value to a human-readable string (9 KB, 2 MB, and so on)
   * Mainly used for showing the metadata size
   */
  ByteSize = require('byte-size'),
  /**
   * Get the size of an array, object or string
   * Mainly used for getting the size of a metadata JSON string
   */
  ValueSize = require('value-size'),
  /**
   * I18next
   * Used for handling the complexity of localization/languages
   */
  I18next = require('i18next'),
  /**
   * Generate a random string
   * Mainly used for generating IDs for clusters, workspaces, UI elements, and so on
   * It has been implemented within the function `getRandomID(length, ?amount)`
   */
  RandomID = require('id-16'),
  /**
   * Get a random flat color
   * It has been implemented within the function `getRandomColor(?amount)`
   */
  RandomFlatColors = require('random-flat-colors'),
  /**
   * Small, fast library for color manipulation and conversion
   * Used almost everywhere in the app, adopted for applying a run-time color-changing
   */
  TinyColor = require('tinycolor2'),
  // Convert a color's value from HEX to RGB
  HEXToRGB = require('hex-to-rgb'),
  // Convert ANSI escaped text streams to html
  ANSIToHTML = require('ansi-to-html'),
  /**
   * Search for substrings in a string by using N-API and boyer-moore-magiclen
   * It has been implemented within the function `String.prototype.search(needle)`
   */
  FSS = require('fast-string-search'),
  // Return the absolute system-dependant path for the place where the app should store its data for the current user
  AppData = require('appdata-path'),
  /**
   * `JSON.stringify` with fixed maximum character width
   * It has been implemented within the function `applyJSONBeautify(object, ?sort)`
   */
  BeautifyJSON = require('json-beautify'),
  /**
   * This module takes JSON content and returns a copy of the same content but with the sorted keys
   * It has been implemented within the function `applyJSONBeautify(object, ?sort)`
   */
  SortJSON = require('sort-json'),
  // Convert JSON data to HTML table
  ConvertJSONTable = require('json-table-converter').jsonToTableHtmlString,
  // Generate interactive HTML table
  Tabulator = require('tabulator-tables'),
  // Sanitize a string to be safe for use as a file name; by removing directory paths and invalid characters
  Sanitize = require('sanitize-filename'),
  /**
   * An implementation of PHP `strip_tags` in Node.js
   * Used for stripping HTML tags from a given string
   */
  StripTags = require('@ramumb/strip-tags'),
  // Replacing/stripping special characters, alphabets, and numerics in a given string
  StripChar = require('stripchar').StripChar,
  // Escape string for use in HTML
  EscapeHTML = require('escape-html'),
  /**
   * Pure Node.js RSA library implemented
   * It has been implemented within the functions `encrypt(publicKey, text)` and `decrypt(privateKey, text)`
   */
  NodeRSA = require('node-rsa'),
  /**
   * Node.js module to manage system keychain
   * It has been implemented within the function `getKey(type, callback)`
   */
  Keytar = require('keytar'),
  /**
   * Cross-platform unique machine ID discovery
   * It has been implemented within the function `getMachineID()`
   */
  MachineID = require('node-machine-id').machineIdSync,
  // A small, stand-alone script to automatically adjust HTML textarea height
  AutoSize = require('autosize'),
  /**
   * Open package
   * Used for opening paths, apps, files, links, and so on
   */
  Open = require('open'),
  /**
   * Get a random free-to-use port
   * It has been implemented within the function `getRandomPort(?amount)`
   */
  PortGet = require('port-get'),
  /**
   * Create an SSH tunnel with the ability to close it, and listen to its traffic
   * It has been implemented within the function `createSSHTunnel(data)`
   */
  OpenSSHTunnel = require('open-ssh-tunnel'),
  /**
   * Fix a given JSON in string format
   * It has been implemented within the function `repairJSON(json)`
   */
  JSONRepair = require('jsonrepair').jsonrepair,
  // The adopted HTTP client in the app
  Axios = require('axios'),
  // Cross-browser storage for all use cases
  Store = require('store'),
  // Node.js CMD module to execute commands
  Terminal = require('node-cmd'),
  /**
   * This module gives a hand with creating nice aligned boxes in the terminal
   * It has been implemented within the function `terminalPrintMessage(terminal, type, message, ?hideIcon)`
   */
  CLIBoxes = require('cli-boxes'),
  /**
   * XtermJS
   * Used to have a base to build the app's unique terminal
   */
  XTerm = require('xterm').Terminal,
  // Readline addon for xterm
  Readline = require('xterm-readline').Readline,
  // Weblinks addon for XtermJS which enables web links
  WebLinksAddon = require('xterm-addon-web-links').WebLinksAddon,
  // Canvas addon for rendering the terminal's content in canvas instead of regular DOMs
  CanvasAddon = require('xterm-addon-canvas').CanvasAddon,
  // XtermJS themes
  XTermThemes = require('xterm-theme'),
  // Addon for ensuring that webfonts load correctly before attempting to draw characters in an xterm instance
  XtermWebFonts = require('xterm-webfont')

/**
 * Import the custom node modules for the renderer thread
 *
 * Define the `Modules` constant that will contain all custom modules
 * The modules can be accessed by calling the path `Modules.{ModuleName}.{Function}`
 */
const Modules = []

try {
  /**
   * Define the folder path of the custom node modules
   *
   * `Path` module has been imported in the initialization file `init.js`
   */
  const modulesFilesPath = Path.join(__dirname, '..', '..', 'custom_node_modules', 'renderer')

  // Read files inside the folder
  let modulesFiles = FS.readdirSync(modulesFilesPath)

  /**
   * Reverse the order of the array; to make sure the `clusters` module will be loaded after the `workspaces` module; due to calls of functions from the `workspaces` in the `clusters` modules
   * Filter the array by getting rid of `consts.js` file; as it'll unshifted at the beginning of the array
   */
  modulesFiles = modulesFiles.reverse().filter((moduleFile) => !moduleFile.startsWith('consts'))

  // Unshift the `consts.js` file to be the first module to import
  modulesFiles.unshift('consts.js')

  /**
   * Loop through modules files
   * Main modules are `clusters`, `workspaces`, and `localization`
   */
  modulesFiles.forEach((moduleFile) => {
    try {
      // Make sure the module file's name is in lowercase
      moduleFile = moduleFile.toLowerCase()

      // Ignore any file which is not JavaScript
      if (!moduleFile.endsWith('.js'))
        return

      // Define the module's name
      let moduleName = moduleFile.slice(0, `${moduleFile}`.indexOf('.js'))

      // Capitalize the name - to follow the style guide -
      moduleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1)

      // Import the module
      Modules[moduleName] = require(Path.join(modulesFilesPath, moduleFile))
    } catch (e) {}
  })
} catch (e) {}
