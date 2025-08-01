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
 * Import the compilation cache optimizer
 * It attaches a require hook to use V8's code cache to speed up instantiation time
 */
require('v8-compile-cache')

/**
 * Libraries, packages and custom modules importing file
 *
 * Import all essential libraries and modules
 *
 * Node.js OS module
 * Used for operating system-related utilities and properties
 */
const OS = require('os'),
  /**
   * Electron clipboard module
   * Perform copy and paste operations on the system clipboard
   * Mainly used for copying the connection's metadata
   */
  Clipboard = require('electron').clipboard,
  /**
   * Convert a byte value to a human-readable string (9 KB, 2 MB, and so on), and vice-versa
   * Mainly used for showing the metadata size
   */
  Bytes = require('bytes'),
  // Convert to/from HEX strings and byte arrays
  ConvertHEX = require('convert-hex'),
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
   * Mainly used for generating IDs for connections, workspaces, UI elements, and so on
   * It has been implemented within the function `getRandom.id(length, ?amount)`
   */
  RandomID = require('id-16'),
  /**
   * Get a random flat color
   * It has been implemented within the function `getRandom.color(?amount)`
   */
  RandomFlatColors = require('random-flat-colors'),
  /**
   * Small, fast library for color manipulation and conversion
   * Used almost everywhere in the app, adopted for applying a run-time color-changing
   */
  TinyColor = require('tinycolor2'),
  // Convert a color's value from HEX to RGB
  HEXToRGB = require('hex-to-rgb'),
  // JavaScript syntax highlighter
  Highlight = require('highlight.js/lib/core'),
  // Convert ANSI escaped text streams to html
  ANSIToHTML = require('ansi-to-html'),
  // Fast, and flexible library for parsing and manipulating HTML and XML
  Cheerio = require('cheerio'),
  // Return the absolute system-dependant path for the place where the app should store its data for the current user
  AppData = require('appdata-path'),
  /**
   * `JSON.stringify` with fixed maximum character width
   * It has been implemented within the function `beautifyJSON(object, ?sort)`
   */
  BeautifyJSON = require('json-beautify'),
  /**
   * This module takes JSON content and returns a copy of the same content but with the sorted keys
   * It has been implemented within the function `beautifyJSON(object, ?sort)`
   */
  SortJSON = require('sort-json'),
  // Convert an array of Objects into a table format
  ConvertJSONTable = require('json-to-table'),
  // Generate interactive HTML table
  Tabulator = require('tabulator-tables'),
  // Promise based HTTP client for the browser and node.js
  Axios = require('axios'),
  /**
   * An implementation of PHP `strip_tags` in Node.js
   * Used for stripping HTML tags from a given string
   */
  StripTags = require('@ramumb/strip-tags'),
  // Replacing/stripping special characters, alphabets, and numerics in a given string
  StripChar = require('stripchar').StripChar,
  // Escape string for use in HTML
  EscapeHTML = require('escape-html'),
  // A markdown parser and compiler. Built for speed
  Marked = require('marked'),
  /**
   * Pure Node.js RSA library implemented
   * It has been implemented within the functions `encryptText(publicKey, text)` and `decryptText(privateKey, text)`
   */
  NodeRSA = require('node-rsa'),
  /**
   * Node.js module to manage system keychain
   * It has been implemented within the function `getRSAKey(type, callback)`
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
  // Detect file type by signatures
  DetectFileType = require('detect-file-type'),
  // Helps with date validations
  ValidateDate = require("validate-date"),
  // Checks if a value is a timestamp
  IsTimestamp = require('is-timestamp'),
  /**
   * Get a random free-to-use port
   * It has been implemented within the function `getRandom.port(?amount)`
   */
  PortGet = require('port-get'),
  /**
   * Fix a given JSON in string format
   * It has been implemented within the function `repairJSONString(json)`
   */
  JSONRepair = require('jsonrepair').jsonrepair,
  // Cross-browser storage for all use cases
  Store = require('store'),
  // Lightning fast hash function library for Node.js
  HashWASM = require('hash-wasm'),
  MD5 = HashWASM.md5,
  // Run commands using sudo, prompting the user with a graphical OS dialog
  Sudo = require('sudo-prompt'),
  // The fastest and simplest library for SQLite3 in Node.js
  SQLite3 = require('better-sqlite3'),
  // Node.js CMD module to execute commands
  Terminal = require('node-cmd'),
  /**
   * XtermJS
   * Used to have a base to build the app's unique terminal
   */
  XTerm = require('@xterm/xterm').Terminal,
  // Canvas addon for rendering the terminal's content in canvas instead of regular DOMs
  CanvasAddon = require('@xterm/addon-canvas').CanvasAddon,
  // XtermJS themes
  XTermThemes = require('xterm-theme'),
  // Addon for ensuring that webfonts load correctly before attempting to draw characters in an xterm instance
  XtermWebFonts = require('xterm-webfont')

// Sanitize a string to be safe for use as a file name; by removing directory paths and invalid characters
let Sanitize = require('sanitize-filename')

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
  const modulesFilesPath = Path.join(__dirname, '..', '..', 'custom_modules', 'renderer')

  // Read files inside the folder
  let modulesFiles = FS.readdirSync(modulesFilesPath)

  /**
   * Reverse the order of the array; to make sure the `connections` module will be loaded after the `workspaces` module; due to calls of functions from the `workspaces` in the `connections` modules
   * Filter the array by getting rid of `consts.js` file; as it'll unshifted at the beginning of the array
   */
  modulesFiles = modulesFiles.reverse().filter((moduleFile) => !moduleFile.startsWith('consts'))

  // Unshift the `consts.js` file to be the first module to import
  modulesFiles.unshift('consts.js')

  /**
   * Loop through modules files
   * Main modules are `connections`, `workspaces`, and `localization`
   */
  modulesFiles.forEach((moduleFile) => {
    try {
      // Make sure the module file's name is in lowercase
      moduleFile = `${moduleFile}`.toLowerCase()

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
