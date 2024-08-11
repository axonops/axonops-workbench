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
 * Import the initial packages/modules
 *
 * Compilation cache optimizer
 */
require('v8-compile-cache')

/**
 * Node.js file system module - improved version which has methods that aren't included in the native `fs` module -
 * Used for working with files system, it provides related utilities
 */
const FS = require('fs-extra'),
  // jQuery library
  $ = require('jquery'),
  jQuery = $,
  /**
   * Node.js path module
   * Working with file and directory paths, and providing useful utilities
   */
  Path = require('path'),
  /**
   * Electron renderer communication with the main thread
   * Used for sending requests from the renderer threads to the main thread and listening to the responses
   */
  IPCRenderer = require('electron').ipcRenderer

/**
 * Get the set extra resources path
 * This value will be updated from the main thread
 */
let extraResourcesPath = null

// Get the set extra resources path from the main thread
$(document).ready(() => IPCRenderer.on('extra-resources-path', async (_, path) => {
  // Adopt the set path
  extraResourcesPath = path

  // Make sure resources are exist in the correct place
  try {
    // Get the app's path
    let appPath = await IPCRenderer.invoke('app-path:get'),
      // Define the process type and the associated folders and files
      processTypes = {
        // Those files will be checked and created if not exist
        ensureFile: [
          ['config', 'app-config.cfg'],
          ['data', 'docker', 'docker.json'],
          ['data', 'logging', 'log.tmp'],
          ['data', 'workspaces', 'workspaces.json']
        ]
      }

    try {
      /**
       * For the process `ensureFile`
       *
       * Loop through each file
       */
      for (let file of processTypes.ensureFile) {
        try {
          // If the current file about `logging`
          if (file[1] != 'logging')
            throw 0

          // Ensure the file exists
          try {
            await FS.ensureFile(Path.join(appPath, ...file))
          } catch (e) {}

          // Skip the upcoming code and move to the next file
          continue
        } catch (e) {}

        // Ensure the file exists
        try {
          await FS.ensureFile(Path.join((extraResourcesPath || appPath), ...file))
        } catch (e) {}
      }
    } catch (e) {} finally {
      // Now call the `pre-initialize` event for `document`
      setTimeout(() => $(document).trigger('pre-initialize'), 100)
    }
  } catch (e) {
    // Now call the `pre-initialize` event for `document`
    setTimeout(() => $(document).trigger('pre-initialize'), 100)
  }
}))

// Load bootstrap JS files
$(document).on('pre-initialize', async () => {
  /**
   * Functions file
   * It has global functions that are used throughout the app
   */
  $.ajax({
    async: false,
    url: Path.join(__dirname, '..', 'js', 'funcs.js'),
    dataType: 'script'
  })

  /**
   * Essential modification for the `console` function after loading the `functions` file
   * Now console triggers such as `log`, `debug`, `error`, and others are logged as part of the logging feature
   */
  {
    try {
      // Copy the original `console` function
      let originalConsole = {
        ...console
      }; // This semicolon is critical here

      // Loop through a set of console types
      (['debug', 'error', 'info', 'log']).forEach((type) => {
        // Initial log type
        let logType = type

        // Switch and manipulate the type to be suitable
        switch (logType) {
          case 'log':
          case 'debug': {
            logType = 'info'
            break
          }
          default: {
            logType = 'info'
          }
        }

        // Manipulate the original `console` by adding any upcoming text as a log
        global.console[type] = (text) => {
          try {
            addLog(`${text}`, logType)
          } catch (e) {}

          // Call the original `console`
          originalConsole[type](text)
        }
      })
    } catch (e) {
      try {
        errorLog(e, 'initialization')
      } catch (e) {}
    }
  }

  // Load the rest bootstrap JS files
  for (let file of ['libs', 'globs'])
    loadScript(Path.join(__dirname, '..', 'js', `${file}.js`))

  /**
   * Extra checking process
   * Merge the shipped new config file with the old
   *
   * Get the app's path
   */
  let appPath = await IPCRenderer.invoke('app-path:get'),
    // Define the old config file's path
    oldConfigFilePath = Path.join((extraResourcesPath || appPath), 'config', 'app-config.cfg'),
    // Define the new config file's path
    newConfigFilePath = Path.join(appPath, 'config', 'app-config.cfg')

  try {
    // If the old and new config files' paths' are not the same then skip this try-catch block
    if (oldConfigFilePath != newConfigFilePath)
      throw 0

    /**
     * Now call the `initialization` event for `document`
     * This event will load and initialize the entire app after getting the path of the extra resources
     */
    setTimeout(() => $(document).trigger('initialize'), 100)

    // Skip the upcoming code
    return
  } catch (e) {}

  // Merge the two config files, and wait for the callback function to be triggerd
  Modules.Config.mergeConfigFiles(oldConfigFilePath, newConfigFilePath, () => {
    /**
     * Now call the `initialization` event for `document`
     * This event will load and initialize the entire app after getting the path of the extra resources
     */
    setTimeout(() => $(document).trigger('initialize'), 100)
  })
})

// Initialize the logging system
$(document).on('initialize', () => {
  // Get the app's config
  Modules.Config.getConfig((config) => {
    // Check the status of whether or not the logging feature is enabled
    isLoggingEnabled = config.get('security', 'loggingEnabled') || isLoggingEnabled

    // Convert the flag to a boolean instead of a string
    isLoggingEnabled = isLoggingEnabled == 'false' ? false : true

    // If the logging feature is not enabled then skip the upcoming code
    if (!isLoggingEnabled)
      return

    // Send the initialization request to the main thread
    IPCRenderer.send('logging:init', {
      date: new Date().getTime(),
      id: getRandomID(5)
    })
  })
})

// Handle the AI Assistant initialization process
$(document).on('initialize', () => {
  /**
   * Whether or not the AI assistant feature should be available
   * This is determined by a constant in the `Consts` module
   */
  $(`div.body div.left div.content div.navigation div.group div.item[action="ai"]`).add('div.ai-assistant-answers-limitation').toggle(Modules.Consts.EnableAIAssistant)

  /**
   * Load the AI Assistant webview
   *
   * If there's no need to do this this skip this try-catch block
   */
  if (!Modules.Consts.EnableAIAssistant)
    return

  // Point at the hidden area
  let hiddenAreaElement = $('div.main.hidden-area'),
    // Point at the web view element
    webviewAIAssistant = $('webview#ai_assistant_webview'),
    // Point at the web view's navigation's container
    webviewNavigationContainer = hiddenAreaElement.find('div.webview-navigation'),
    // Point at the container of the extra actions
    webviewMoreActionsContainer = hiddenAreaElement.find('div.webview-more-actions'),
    // Point at the loading element
    loadingPage = hiddenAreaElement.find('div.loading-page')

  // Point at different buttons related to the hidden area
  let buttons = {}; // This semicolon is critical here

  // Define the names, loop and point at the buttons
  ['back', 'forward', 'more', 'refresh', 'logout'].forEach((button) => {
    buttons[button] = webviewNavigationContainer.add(webviewMoreActionsContainer).find(`div.nav[action="${button}"] button`)
  })

  // Update the web view element `src` with the AI Assistant's server URL
  webviewAIAssistant.attr('src', Modules.Consts.AIAssistantServer)

  // Show/hide the loading spinner based on the status
  webviewAIAssistant
    .on('did-start-loading', () => loadingPage.addClass('show'))
    .on('did-stop-loading', () => loadingPage.removeClass('show'))

  // Go back one page
  buttons.back.click(() => {
    try {
      webviewAIAssistant[0].goBack()
    } catch (e) {}
  })

  // Go forward one page
  buttons.forward.click(() => {
    try {
      webviewAIAssistant[0].goForward()
    } catch (e) {}
  })

  // Click the `more` button
  buttons.more.click(() => {
    // Show/hide the more actions container
    $(webviewMoreActionsContainer).toggleClass('show')

    // Show the transparent background which prevent interacting with the webview
    $('div.body div.hidden-area div.content div.more-list-bg').show()

    setTimeout(() => {
      // When clicking outside the more actions container
      $(webviewMoreActionsContainer).oneClickOutside({
        callback: () => {
          // Hide the container
          $(webviewMoreActionsContainer).removeClass('show')

          // Hide the transparent background
          $('div.body div.hidden-area div.content div.more-list-bg').hide()
        }
      })
    }, 500)
  })

  // Refresh the entire webview
  buttons.refresh.click(() => {
    try {
      webviewAIAssistant[0].reloadIgnoringCache()()
    } catch (e) {}
  })

  // Logout from the AxonOps AI Chat
  buttons.logout.click(() => webviewAIAssistant.attr('src', `${(new URL(Modules.Consts.AIAssistantServer)).origin}/logout`))

  // Check and enable/disable the back/forward buttons based on the status
  setInterval(() => {
    buttons.back.toggleClass('disabled', !webviewAIAssistant[0].canGoBack())
    buttons.forward.toggleClass('disabled', !webviewAIAssistant[0].canGoForward())
  }, 500)
})

// Get the unique machine's ID and set it to be used across the app
$(document).on('initialize', async () => getMachineID().then((id) => {
  machineID = id

  // Add the first set of logs
  setTimeout(() => {
    try {
      addLog(`AxonOps™ Workbench has loaded all components and is ready to be used`)
      addLog(`This machine has a unique ID of '${machineID}'`, 'env')
    } catch (e) {}
  }, 1000)
}))

// Initialize `I18next` module
$(document).on('initialize', () => {
  // Get the app's config
  Modules.Config.getConfig((config) => {
    try {
      setTimeout(() => {
        // If the saved language is invalid, the chosen language will be `English`
        let chosenLanguage = config.get('ui', 'language') || 'en'

        // Add a log about the chosen language
        try {
          addLog(`The configuration file has been loaded, and the language to be rendered is '${chosenLanguage.toUpperCase()}'`)
        } catch (e) {}

        // Load all saved languages and make sure the chosen language exists and is loaded as well
        Modules.Localization.loadLocalization((languages) => {
          try {
            // Attempt to get the language's object
            let languageObject = languages.list.filter((language) => language.key == chosenLanguage)

            // Make sure the loaded language's key exists
            chosenLanguage = languageObject.length <= 0 ? 'en' : chosenLanguage

            // Whether or not the language needs right to left shift of the UI
            isLanguageRTL = languageObject.length != 0 ? languageObject[0].rtl : false

            // Set RTL class if the language needs that
            $('body').toggleClass('rtl', isLanguageRTL)

            /**
             * Set a loading time for the default/selected language
             *
             * Get the start loading time
             */
            let startLoadingTime = new Date().getTime()

            // Start the initialization process of loading the language
            I18next.init({
              lng: chosenLanguage,
              resources: languages.content
            })

            /**
             * Integrated function to capitalize the first letter of the first word in a given text
             *
             * @Parameters:
             * {string} `text` the text to be manipulated
             *
             * @Return: {string} the passed text after the manipulation process
             */
            I18next.capitalizeFirstLetter = (text) => text.charAt(0).toUpperCase() + text.slice(1)

            /**
             * Integrated function to capitalize the first letter of each word in a given text
             *
             * @Parameters:
             * {string} `text` the text to be manipulated
             *
             * @Return: {string} the passed text after the manipulation process
             */
            I18next.capitalize = (text) => {
              // Split the given text by whitespaces
              text = text.split(/\s+/)

              // Loop through each word, and capitalize the first letter
              for (let i = 0; i < text.length; i++)
                text[i] = I18next.capitalizeFirstLetter(text[i])

              // Join words and add a whitespace between them
              return text.join(' ')
            }

            /**
             * Update the built-in `t` function for the `I18next` module
             * The update detects if the key's value has an accepted HTML tag and replaces it to make it valid for rendering
             *
             * Have a copy from the original implementation of the function
             */
            let originalI18nextFun = I18next.t

            // Apply the update
            I18next.t = (key) => {
              // Call the original function's implementation
              let text = originalI18nextFun(key),
                // Whether or not an allowed HTML tag has been found
                isHTMLFound = false

              // Strip any HTML tag
              text = StripTags(text)

              try {
                // Update the status of the flag
                isHTMLFound = Modules.Consts.AllowedHTMLTags.some((tag) => text.indexOf(`[${tag}]`) != -1)

                // If there's no allowed HTML has been found then skip this try-catch block
                if (!isHTMLFound)
                  throw 0

                // Loop through the allowed HTML tags
                Modules.Consts.AllowedHTMLTags.forEach((tag) => {
                  // Define a regex for the tag's opening
                  let opening = createRegex(`[${tag}]`, 'gm'),
                    // The same thing with the tag's close
                    close = createRegex(`[/${tag}]`, 'gm')

                  // Update the opening
                  text = text.replace(opening, `<${tag}>`)

                  // Update the close
                  text = text.replace(close, `</${tag}>`)
                })
              } catch (e) {
                try {
                  errorLog(e, 'initialization')
                } catch (e) {}
              }

              // Return the final result
              return text
            }

            /**
             * Integrated function to replace - in order - `$data` placeholder in a given string with an actual data
             *
             * @Parameters:
             * {string} `key` the key of the localized phrase
             * {object} `dataArray` array of data to replace `$data` with them
             *
             * @Return: {string} the localized phrase with actual data
             */
            I18next.replaceData = (key, dataArray) => {
              // Get the localized phrase
              let localizedPhrase = I18next.t(key)

              /**
               * Loop through the given data array
               * Reversing the array will lead to the correct order of finding the `$data` placeholder
               */
              dataArray.reverse().forEach((data) => {
                // Define the regular expression to find the first `$data` placeholder
                let regex = new RegExp('(.*)\\$data(.*)', 'gm')

                // Replace the placeholder with the current data
                localizedPhrase = localizedPhrase.replace(regex, '$1' + data + '$2')
              })

              // Return the final result
              return localizedPhrase
            }

            // Set the maximum allowed loading time for the chosen language
            const MaxLoadingTime = 5000

            // Wait for the loading of the language and check if it has exceeded the maximum loading time
            let waitForLoading,
              // Inner function to clear the interval; as the loading process has finished
              clearLoadInterval = () => clearInterval(waitForLoading)

            // Set an interval function; to make sure that the language has been entirely loaded before exceeding the maximum loading time
            waitForLoading = setInterval(() => {
              // Check if those main keys have been loaded
              if (['workspace home', 'settings'].some((key) => I18next.exists(key))) {
                // If so, then call the `applyLanguage` function
                Modules.Localization.applyLanguage(chosenLanguage)

                // Clear the interval function
                clearLoadInterval()
              }

              // If the loading time has exceeded the maximum set time then abort it; to avoid an endless check process
              if ((new Date()).getTime() - startLoadingTime > MaxLoadingTime)
                clearLoadInterval()
            })
          } catch (e) {
            try {
              errorLog(e, 'initialization')
            } catch (e) {}
          }

          // Update the list of languages to select in the settings dialog
          setTimeout(() => {
            // Point at the list container
            let languagesMenuContainer = $(`div.dropdown[for-select="languageUI"] ul.dropdown-menu`)

            // Loop through loaded languages
            languages.list.forEach((language) => {
              // The list option's UI structure
              let element = `
                  <li>
                    <a class="dropdown-item" href="#" value="${language.name}" hidden-value="${language.key}" rtl="${language.rtl}">${language.name}</a>
                  </li>`

              // Append the language
              languagesMenuContainer.append($(element).show(function() {
                // Once a language/option is clicked
                $(this).children('a').click(function() {
                  // Point at the input field related to the list
                  let selectElement = $(`input#${$(this).parent().parent().parent().attr('for-select')}`)

                  // Update the input's value
                  selectElement.val($(this).attr('value'))

                  // Update the input's `hidden value` and `rtl` attributes
                  selectElement.attr({
                    'hidden-value': $(this).attr('hidden-value'),
                    'rtl': $(this).attr('rtl')
                  })
                })
              }))
            })
          })
        })
      })
    } catch (e) {
      try {
        errorLog(e, 'initialization')
      } catch (e) {}
    }
  })
})

/**
 * Import `s-ago` module
 * Used to convert timestamp to a human-readable string `now, minute ago...`
 * Define the variable which will hold the module
 */
let ReadableTime

$(document).on('initialize', () => {
  // Import the module
  ReadableTime = require(Path.join(__dirname, '..', 'js', 'external', 's-ago'))

  // Every 10 seconds update the associated elements
  setInterval(() => {
    // Loop through each element
    $('[s-ago-time]').each(function() {
      try {
        // Get its timestamp
        let time = parseInt($(this).attr('s-ago-time'))

        // Convert it to human-readable format
        $(this).text(ReadableTime(new Date(time)))
      } catch (e) {}
    })
  }, 10000)
})

// Load UI/Renderer components
$(document).on('initialize', () => {
  /*
   * Official Material Design from Google
   * https://m2.material.io
   */
  {
    // Material Design
    {
      // Define the path to the distribution version
      let materialPath = Path.join(__dirname, '..', '..', 'node_modules', 'material-components-web', 'dist')

      // Load the CSS file associated with the library
      loadStyleSheet(Path.join(materialPath, 'material-components-web.min.css'))
    }

    // Material Icons
    {
      // Load the CSS file
      loadStyleSheet(Path.join(__dirname, '..', '..', 'node_modules', 'material-icons', 'iconfont', 'material-icons.css'))
    }
  }

  /**
   * Material Design for Bootstrap (MDB)
   * This framework reduces the ugliness of Material Design API calls and provides better control over colors
   */
  {
    let materialPath = Path.join(__dirname, '..', 'js', 'external', 'mdb5')

    loadStyleSheet(Path.join(materialPath, 'style-dark.css'))

    loadScript(Path.join(materialPath, 'mdb.js'))

    // Get the MDB object for add and refresh clusters floating buttons' tooltips
    {
      setTimeout(() => {
        // Define the general selector
        let selector = `div.body div.right div.content div[content="clusters"] div.section-actions div.action`

        // Get the MDB object for the `add` button's tooltip
        tooltips.addClusterActionButton = getElementMDBObject($(`${selector}[action="add"] button`), 'Tooltip')

        // Get the MDB object for the `refresh` button's tooltip
        tooltips.refreshClusterActionButton = getElementMDBObject($(`${selector}[action="refresh"] button`), 'Tooltip')
      }, 1000)
    }
  }

  // Ion Icons
  {
    loadScript(Path.join(__dirname, '..', 'js', 'external', 'ionicons', 'main.js'))
  }

  // jsPDF - for the Tabulator library -
  {
    loadScript(Path.join(__dirname, '..', 'js', 'external', 'jspdf', 'jspdf.js'))

    loadScript(Path.join(__dirname, '..', 'js', 'external', 'jspdf', 'plugin.autotable.js'))
  }

  // Tabulator library theme
  {
    loadStyleSheet(Path.join(__dirname, '..', '..', 'node_modules', 'tabulator-tables', 'dist', 'css', 'tabulator_site_dark.min.css'))
  }

  // XtermJS and its add-ons
  {
    // Define the path to the dist version
    let xtermModulePath = Path.join(__dirname, '..', '..', 'node_modules', '@xterm')

    // Load CSS only, JS part has been imported already
    loadStyleSheet(Path.join(xtermModulePath, 'xterm', 'css', 'xterm.css'))

    // Fit addon; to let the console fit its container
    loadScript(Path.join(xtermModulePath, 'addon-fit', 'lib', 'addon-fit.js'))
  }

  // jQuery UI and its related plugins
  {
    // jQuery UI
    {
      let jQueryUIPath = Path.join(__dirname, '..', 'js', 'external', 'jqueryui')

      loadStyleSheet(Path.join(jQueryUIPath, 'style.css'))

      loadScript(Path.join(jQueryUIPath, 'jqueryui.js'))
    }

    // jQuery JS Tree Plugin
    {
      let jsTreePath = Path.join(__dirname, '..', 'js', 'external', 'jstree')

      loadStyleSheet(Path.join(jsTreePath, 'theme', 'style.css'))

      loadScript(Path.join(jsTreePath, 'jstree.js'))
    }

    // jQuery JSON Viewer plugin
    {
      let jsonViewerPath = Path.join(__dirname, '..', '..', 'node_modules', 'jquery.json-viewer', 'json-viewer')

      loadStyleSheet(Path.join(jsonViewerPath, 'jquery.json-viewer.css'))

      loadScript(Path.join(jsonViewerPath, 'jquery.json-viewer.js'))
    }

    // jQuery Actual element's values plugin
    {
      loadScript(Path.join(__dirname, '..', 'js', 'external', 'actual.js'))
    }

    // jQuery plugin that adds a one-time callback for a click outside of an element
    {
      loadScript(Path.join(__dirname, '..', 'js', 'external', 'click_outside.js'))
    }
  }

  // Coloris
  {
    let colorisPath = Path.join(__dirname, '..', 'js', 'external', 'coloris')

    loadStyleSheet(Path.join(colorisPath, 'style.css'))

    loadScript(Path.join(colorisPath, 'coloris.js'))

    /**
     * Set the preferred options for Coloris
     *
     * Disable the support for alpha (color opacity)
     * Define a list of ready-to-pick colors
     */
    setTimeout(() => {
      Coloris({
        alpha: false,
        clearButton: true,
        clearLabel: I18next.capitalize(I18next.t('clear')),
        themeMode: 'dark',
        swatches: ['#E53935', '#F4511E', '#FF8A80', '#FB8C00', '#FFB300', '#FFD180', '#FDD835', '#FFFF8D', '#C0CA33', '#43A047', '#7CB342', '#B9F6CA', '#00897B', '#1E88E5', '#039BE5', '#00ACC1', '#84FFFF', '#80D8FF', '#3949AB', '#5E35B1', '#8E24AA', '#B388FF', '#6D4C41', '#546E7A']
      })
    })
  }

  // Mutate.js
  {
    loadScript(Path.join(__dirname, '..', 'js', 'external', 'mutate.js'))
  }

  // Chart.js
  {
    loadScript(Path.join(__dirname, '..', '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js'))
  }

  // ldrs.js
  {
    let ldrsPath = Path.join(__dirname, '..', '..', 'node_modules', 'ldrs', 'dist', 'index.js'),
      usedLoaders = ['lineWobble', 'pinwheel', 'reuleaux', 'square']

    try {
      import(ldrsPath).then((loaders) => usedLoaders.forEach((loader) => loaders[loader].register()))
    } catch (e) {}
  }

  // Lottie Files Player
  {
    loadScript(Path.join(__dirname, '..', 'js', 'external', 'lottie-player.js'))
  }

  // Monaco editor
  {
    let monacoPath = Path.join(__dirname, '..', '..', 'node_modules', 'monaco-editor', 'min'),
      editorUIElement = $('div.modal#addEditClusterDialog div.modal-body div.editor-container div.editor')

    // Initialize the editor
    let amdLoader = require(Path.join(monacoPath, 'vs', 'loader.js')),
      amdRequire = amdLoader.require,
      amdDefine = amdRequire.define

    // Inner function to create a URI from a given path
    let uriFromPath = (path) => {
      let pathName = Path.resolve(path).replace(/\\/g, '/')

      if (pathName.length > 0 && pathName.charAt(0) !== '/')
        pathName = '/' + pathName

      return encodeURI('file://' + pathName)
    }

    amdRequire.config({
      baseUrl: uriFromPath(Path.join(monacoPath))
    })

    // Establish the editor with set properties
    amdRequire(['vs/editor/editor.main'], () => {
      try {
        editor = monaco.editor.create(editorUIElement[0], {
          value: Modules.Consts.CQLSHRC, // This is the default content of the `cqlsh.rc` file
          language: 'ini', // This language is the perfect one that supports the `cqlsh.rc` file content's syntax highlighting
          minimap: {
            enabled: true
          },
          glyphMargin: true, // This option allows to render an object in the line numbering side
          suggest: {
            showFields: false,
            showFunctions: false
          },
          theme: 'vs-dark',
          scrollBeyondLastLine: true,
          mouseWheelZoom: true,
          fontSize: 11
        })

        // Once the editor is established save the default values in the `CQLSHValues` variable
        Modules.Clusters.getCQLSHRCContent(getActiveWorkspaceID(), Modules.Consts.CQLSHRC).then((_default) => {
          // Update the global cqlsh values array with the default values
          cqlshValues = _default

          // Trigger the `ChangeContent` event for the editor
          editor.setValue(editor.getValue())
        })

        /**
         * Call the `layout` function
         * It's used to optimize the editor's dimensions with the parent container
         */
        editor.layout()

        // Once there is a change in the editor (by pasting, typing, etc...)
        editor.getModel().onDidChangeContent(() => {
          // If the editor is updating then stop once
          if (isUpdatingEditor) {
            isUpdatingEditor = false

            // By doing this, the `ChangeContent` event is triggered again after updating the content
            editor.setValue(editor.getValue())

            // Skip the upcoming code
            return
          }

          // Disable the save cluster button
          $('#addCluster').attr('disabled', 'disabled')

          // Detected sensitive data - username, password -
          let detectedSensitiveData = false,
            // Get the currently active workspace's ID
            workspaceID = getActiveWorkspaceID()

          // Get and parse the content of the current `cqlsh.rc `file and change inputs' values as needed
          Modules.Clusters.getCQLSHRCContent(workspaceID, null, editor).then((_content) => {
            try {
              // Update the global cqlsh values array with the current values from the editor
              cqlshValues = _content

              // Define the sections [connection, ui, SSL, etc...]
              let _sections = Object.keys(_content)

              // If there are no sections then the cqlsh is not - in terms of syntax - correct or something is missing then stop this process
              if (_sections.length <= 0)
                throw 0

              // Loop through each section
              for (let _section of _sections) {
                // Define the current section's keys [hostname, port, SSL, etc...]
                let _keys = Object.keys(_content[_section])

                // If the current section has no keys then skip this section and move to the next one
                if (_keys.length <= 0)
                  continue

                // Loop through each key/option
                for (let _key of _keys) {
                  // Check if this key/option is considered to be sensitive data that shouldn't be in the config file
                  if (Modules.Consts.SensitiveData.includes(_key))
                    detectedSensitiveData = true

                  // Get the current key/option input field's object
                  let inputObject = getElementMDBObject($(`[info-section="${_section}"][info-key="${_key}"]`)),
                    // Get the value for the key/option
                    optionValue = _content[_section][_key],
                    // Point at the input field
                    input = $(`[info-section="${_section}"][info-key="${_key}"]`)

                  // Try to set the value using the `setValue` method
                  try {
                    input.val(optionValue)
                  } catch (e) {}

                  // Add values to the checkbox inputs
                  try {
                    // If the input's type is not `checkbox` then skip this try-catch block
                    if (input.attr('type') != 'checkbox')
                      throw 0

                    // Update the checkbox's status
                    input.prop('checked', optionValue == 'true')
                  } catch (e) {}

                  // Add values to the file input fields
                  try {
                    // If the input field's type is not `file` then skip this try-catch block
                    if (input.attr('type') == 'text' && input.parent().attr('role') != 'file-selector')
                      throw 0

                    /**
                     * Update the tooltip's content and state
                     * Get the object
                     */
                    let tooltipObject = mdbObjects.filter((object) => object.type == 'Tooltip' && object.element.is(input))

                    // If the path to the file is invalid or inaccessible then don't adopt it
                    if (!pathIsAccessible(optionValue)) {
                      // Clear the input's value
                      input.val('')

                      // Clear the file's name preview
                      input.parent().attr('file-name', '-')

                      // Disable the tooltip
                      try {
                        tooltipObject[0].object.disable()
                      } catch (e) {}

                      // Skip the upcoming code in this try-catch block
                      throw 0
                    }

                    // Enable the tooltip and update its content
                    try {
                      tooltipObject[0].object.enable()
                      tooltipObject[0].object.setContent(optionValue)
                    } catch (e) {}

                    // Set the selected file's path
                    input.val(optionValue)
                    input.parent().attr('file-name', Path.basename(optionValue))
                  } catch (e) {}

                  // Update the input's object
                  inputObject.update()
                  inputObject._deactivate()
                }
              }
            } catch (e) {} finally {
              // Check if there's any disabled key/option after the change and clear its input field in the UI
              $('[info-section][info-key]').each(function() {
                // Get the input's Material Design object
                let object_ = getElementMDBObject($(this)),
                  // Get the inputs' section, and its related key/option's name
                  [section_, key_] = getAttributes($(this), ['info-section', 'info-key'])

                // If the input section is `none` then skip it and move to the next key/option
                if (section_ == 'none')
                  return

                try {
                  /**
                   * Find the input's value from the editor
                   * If it is not `undefined`; then it means this value has been updated already and no need to handle it as an empty or `undefined` value
                   */
                  if (_content[section_][key_] != undefined)
                    return

                  // Handle when the input is actually a file selector
                  try {
                    // If the input is not a file selector then skip this try-catch block
                    if ($(this).parent().attr('file-name') == undefined)
                      throw 0

                    /**
                     * Update the tooltip's content and state
                     * Get the object
                     */
                    let tooltipObject = mdbObjects.filter((object) => object.type == 'Tooltip' && object.element.is($(this)))

                    // Clear the file's name preview
                    $(this).parent().attr('file-name', '-')

                    // Disable the tooltip
                    try {
                      tooltipObject[0].object.disable()
                    } catch (e) {}
                  } catch (e) {}

                  /**
                   * If it is `undefined` then it hasn't been found in the `cqlsh.rc` file
                   * Set the input value to ''
                   */
                  try {
                    $(this).val('')
                  } catch (e) {
                    // If the previous set didn't work then try to call the `selected` attribute
                    try {
                      $(this).prop('checked', getAttributes($(this), 'default-value') == 'true' ? true : false)
                    } catch (e) {}
                  } finally {
                    // Update the object
                    object_.update()
                    object_._deactivate()
                  }
                } catch (e) {}
              })
            }

            // Remove all decorations
            if (editorDecorations != null)
              editor.removeDecorations(editorDecorations)

            // Sensitive data has been detected, if not, just stop here
            if (!detectedSensitiveData)
              return

            /**
             * If sensitive data has been detected then get the line number for those data and add red highlighter to them
             *
             * Define the alerts array which will be passed to the editor to decorate them
             */
            let alerts = [],
              // Get the editor's model object
              editorModel = editor.getModel(),
              // Get the number of lines in the editor
              lines = editorModel.getLineCount()

            // Loop through editor's lines
            for (let i = 1; i <= lines; i++) {
              try {
                // Get the current line based on the index
                let line = editorModel.getLineContent(i),
                  // Get the option in that current line if possible, and make sure it is active if so
                  active = line.match(/^((?![\;\[])|(\;*\s*\[)).+/gm),
                  // Split that active option, and look at the key
                  [key, value] = active[0].split(/\s*\=\s*/gm)

                // The key/option name is not considered sensitive data
                if (!Modules.Consts.SensitiveData.includes(key))
                  continue

                // If the key is considered sensitive data then add highlighter to that data line
                let alert = {
                  range: new monaco.Range(i, 0, i, 0),
                  options: {
                    isWholeLine: true,
                    className: 'line-forbidden',
                    glyphMarginClassName: 'forbidden',
                  }
                }

                // Push that alert to be applied later in the editor
                alerts.push(alert)
              } catch (e) {}
            }

            // Apply highlighters/decorations
            editorDecorations = editor.deltaDecorations([], alerts)
          })
        })
      } catch (e) {
        try {
          errorLog(e, 'initialization')
        } catch (e) {}
      }
    })
  }

  // TippyJS
  {
    let tippyPath = Path.join(__dirname, '..', 'js', 'external', 'tippyjs')

    loadScript(Path.join(tippyPath, 'popper.js'))

    loadScript(Path.join(tippyPath, 'tippy.js'))
  }
})

// Load other JS files related to UI
$(document).on('initialize', () => {
  // Load events files in the `events` folder
  try {
    // Define the events files folder path
    let eventsFilesPath = Path.join(__dirname, '..', 'js', 'events'),
      // Attempt to read the files insid-e the folder
      eventsFiles = FS.readdirSync(eventsFilesPath)

    // Loop through events files
    eventsFiles.forEach((eventFile) => {
      try {
        // Ignore any file which is not JS
        if (!eventFile.endsWith('.js'))
          return

        // Otherwise, load the event file
        loadScript(Path.join(eventsFilesPath, eventFile))
      } catch (e) {}
    })
  } catch (e) {
    try {
      errorLog(e, 'initialization')
    } catch (e) {}
  }
})

// Clear the temporary files and folders created by the app and its binaries
$(document).on('initialize', () => clearTemp())

// Get the view content's ID from the main thread
$(document).on('initialize', () => IPCRenderer.on('view-content-id', (_, contentID) => viewContentID = contentID))

// The app is terminating and there's a need to close all active work areas
$(document).on('initialize', () => IPCRenderer.on('app-terminating', () => closeAllWorkareas()))

// Make sure to hide the tooltip when its parent element has been clicked
$(document).on('initialize', () => {
  setTimeout(() => {
    // Get all created tooltips
    let tooltips = $('[data-tippy="tooltip"]')

    // Loop through each one of them
    tooltips.each(function() {
      // Get the current tooltip's MDB object
      let tooltip = getElementMDBObject($(this), 'Tooltip')

      // If this tooltip is created for showing the path of selected files in dialogs then disable it by default
      if ($(this).parent().attr('role') == 'file-selector')
        tooltip.disable()

      // On parent click, hide the tooltip
      $(this).click(() => tooltip.hide())
    })
  }, 1000)
})

// Check whether or not binaries exist
$(document).on('initialize', () => {
  // Get the app's path
  IPCRenderer.invoke('app-path:get').then((appPath) => {
    setTimeout(() => {
      try {
        // Define the path to all binaries
        let binariesPath = Path.join((extraResourcesPath != null ? Path.join(appPath) : Path.join(__dirname, '..', '..')), 'main', 'bin'),
          // Define binaries to be checked
          binaries = ['cqlsh-407', 'cqlsh-410', 'keys_generator']

        // Check their existence
        Terminal.run(`cd "${binariesPath}" && ${OS.platform() == 'win32' ? 'dir' : 'ls'}`, (err, data, stderr) => {
          // Make sure all of them are exist
          let areBinariesExist = binaries.every((binary) => `${data}`.search(binary))

          // Skip the upcoming code if all of them exist
          if (areBinariesExist)
            return

          // Show feedback to the user if one of the binaries is missing
          showToast(I18next.capitalize(I18next.t(`binaries check`)), I18next.capitalizeFirstLetter(I18next.t(`it seems some or all binaries shipped with the app are corrupted or missing, this state will cause critical issues for many processes. Please make sure to have the official complete version of the app`)) + '.', 'failure')
        })
      } catch (e) {}
    }, 3000)
  })
})

// Initialization process for the `About` modal - with ID `#appAbout` -
$(document).on('initialize', () => {
  /**
   * Handle the `credits` SQLite database
   * This database mainly has credits to all packages, plugins and modules used in the app
   * It also has general text for licenses like Apache 2.0 license
   *
   * Get the app's path
   */
  IPCRenderer.invoke('app-path:get').then((appPath) => {
    try {
      // Point at the credits' container in the modal
      let creditsContainer = $('div.modal#appAbout').find('div.modal-section[section="credits"]'),
        // Connect with the associated database
        database = new SQLite3(Path.join(appPath, 'data', 'credits.db')),
        // Get all records inside the `credits` table
        credits = database.prepare('SELECT * FROM credits ORDER BY license ASC, name ASC').all(),
        // Get all records inside the `licenses` table
        licenses = database.prepare('SELECT * FROM licenses').all()

      // Add general license's content to specified `pre` elements
      $('div.modal#appAbout').find('pre[license]').each(function() {
        try {
          // Get the license code; to get its content
          let licenseCode = $(this).attr('license'),
            // Get the content/text of the license
            licenseContent = licenses.filter((license) => license.code == licenseCode)[0].content

          // Add the content
          $(this).text(licenseContent)
        } catch (e) {}
      })

      // Loop through each credit/record
      for (let credit of credits) {
        let content = credit.content

        try {
          content = Marked.parse(content)
        } catch (e) {}

        // The credit's notice UI structure
        let element = `
            <div class="notice">
              <div class="notice-header">
                <span class="badge badge-primary">${credit.name}</span>
                <span class="badge badge-info">${credit.license}</span>
                <span class="badge badge-info btn btn-light btn-rounded btn-sm" data-mdb-ripple-color="dark" data-link="${credit.repository}">${credit.repository} <ion-icon name="external-link"></ion-icon></span>
                <ion-icon name="arrow-down" for-pre></ion-icon>
                <div class="clickable"></div>
              </div>
              <pre main>${StripTags(content)}</pre>
            </div>`

        // Append the credit
        creditsContainer.append($(element).show(function() {
          // Point at the header of the notice
          let noticeHeader = $(this).find('div.notice-header')

          // The user clicks the clickable area of the header
          $(this).find('div.clickable').click(() => {
            // Rotate the arrow based on the status
            noticeHeader.toggleClass('shown-pre')

            // Show/hide the license
            $(this).find('pre[main]').slideToggle()
          })

          // Clicks the link-badge
          $(this).find('span.badge.btn').click(function() {
            Open($(this).attr('data-link'))
          })
        }))
      }
    } catch (e) {}
  })

  // Enable the click event and opening of external links
  $('div.modal#appAbout').find('span.link').click(function() {
    Open($(this).children('span.content').text())
  })
})

/*
 * Whether or not the content protection should be shown in the app's settings
 * This feature is hidden from Linux platform only
 */
$(document).on('initialize', () => $(`div.row#contentProtectionContainer`).toggle(OS.platform() != 'linux'))

// Send the `loaded` event to the main thread, and show the `About` dialog/modal
$(document).on('initialize', () => setTimeout(() => {
  /**
   * Handle whether or not the `About` dialog should be shown
   *
   * Get the app's config
   */
  Modules.Config.getConfig((config) => {
    // Whether or not the copyright notice is acknowledged already
    let isCopyrightAcknowledged = config.get('security', 'cassandraCopyrightAcknowledged') == 'true'

    // If it's not then skip the upcoming code - the app won't be loaded till the checkbox is checked -
    if (!isCopyrightAcknowledged)
      return

    // Send the event
    IPCRenderer.send('loaded')
  })
}, 2000))

// Once the UI is ready, get all workspaces
$(document).ready(() => IPCRenderer.on('windows-shown', () => $(document).trigger('getWorkspaces')))
