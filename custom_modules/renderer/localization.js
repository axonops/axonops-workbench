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
 * Module to work with the localization feature
 * @Usage:
 * To use it in the UI, a span element could be added with specific attributes:
 * <span mulang="${valueKey}"></span>
 * To use it in tooltips, `data-mulang="${valueKey}"` attribute should be added
 * Special attributes can be used to change the state of characters:
 * `capitalize`: To capitalize the first character of each word
 * `capitalize-first` To capitalize the first character of the first word only
 * The app will recognize all related spans, and print the text related to the given key in the language JSON file
 * In the runtime, `I18next.t(valueKey)` function can be used to get the proper value of a key
 *
 * Import the improved JSON file loader
 */
const JSONFile = require('jsonfile')

/**
 * Load all languages' JSON files in the localization folder
 *
 * @Parameters:
 * {object} `callback` function that will be triggered with passing the final result
 *
 * @Return: {object} the languages' names and their content - key and value -
 */
let loadLocalization = (callback) => {
  // Define the languages' JSON files path
  // let localizationPath = Path.join((extraResourcesPath != null ? Path.join(extraResourcesPath) : Path.join(__dirname, '..', '..')), 'localization'),
  let localizationPath = Path.join(__dirname, '..', '..', 'localization'),
    // Define the final result which be returned
    result = {
      list: [], // The list of languages (name and its key)
      content: {} // The content - keys and values - of each language
    }

  // Add log about this process
  try {
    addLog(`Load recognized languages as a part of the localization process`, 'process')
  } catch (e) {}

  // Go through the localization folder and get all JSON files there
  try {
    // Read the localization folder directory and get the list of its files/languages
    let languages = FS.readdirSync(localizationPath)

    // Loop through files/languages
    for (let language of languages) {
      /**
       * Make sure the current file ends with `.json`
       * This check will prevent reading invalid and unwanted files
       */
      if (!language.toLowerCase().endsWith('.json'))
        continue

      // Read the content of the current file and push it if needed
      try {
        // Read the content using `JSONFile` module
        let langObject = JSONFile.readFileSync(Path.join(localizationPath, language))

        // Get the language name
        let langName = langObject.title,
          // And if it's from right to left or not
          langRTL = langObject.rtl == 'true',
          // And its key `en - ar - fr - ...`
          langKey = language.slice(0, `${language}`.indexOf('.json'))

        // If we have added this language already then stop here and don't add it again
        if (result.list.some((lang) => lang.name == langName && lang.key == langKey))
          throw 0

        // Otherwise, push its name and key in the `result.list` object
        result.list.push({
          name: langName,
          rtl: langRTL,
          key: langKey
        })

        // Add the languages' content to the `result.content` object
        result.content[langKey] = langObject[langKey]
      } catch (e) {
        try {
          errorLog(e, 'localization')
        } catch (e) {}
      }
    }
  } catch (e) {
    try {
      errorLog(e, 'localization')
    } catch (e) {}
  } finally {
    // After all this, return the result as a callback
    return callback(result)
  }
}

/**
 * Change the current applied language in the UI with any other defined one
 * No need to restart or refresh the renderer thread
 *
 * @Parameters:
 * {string} `langKey` the language's key - en, ar, fr, ... -
 */
let applyLanguage = (langKey) => {
  // Add log about this process
  try {
    addLog(`Apply language '${langKey.toUpperCase()}' over the UI, sub-elements and dynamic elements`, 'process')
  } catch (e) {}

  try {
    /**
     * Call the `changeLanguage` function and pass the given language key
     * If the passed key is not defined or the language is corrupted nothing will happen
     */
    I18next.changeLanguage(langKey)

    // Loop through all special spans in the UI and change their content with the new one
    applyLanguageSpecific($('body').find('span[mulang], [data-mulang]'))

    // Change coloris `clear` button's label
    Coloris({
      clearLabel: I18next.capitalize(I18next.t('clear'))
    })
  } catch (e) {
    try {
      errorLog(e, 'localization')
    } catch (e) {}
  }
}

/**
 * Apply the current language's content for specific passed elements
 * This is useful when we don't want to refresh the entire UI, but just some dynamic and created elements in the runtime
 *
 * @Parameters:
 * {object} `elements` array of HTML elements to update their content
 */
let applyLanguageSpecific = (elements) => {
  /**
   * Filter the given elements and classify them
   *
   * Get the `spans` elements
   */
  let spans = elements.filter('span').filter(':not([data-tippy])'),
    // Get the `tooltip` MDB elements
    tooltips = elements.filter('[data-tippy="tooltip"]'),
    // Get the `file selector` elements
    fileSelectors = elements.filter('[file-info]')

  // Loop through each class - spans, tooltips, and file selectors -
  {
    /**
     * Start with `span` elements
     * Loop through each `span`
     */
    spans.each(function() {
      // Get the value of the localized text based on the `mulang` value
      let text = I18next.t(getAttributes($(this), 'mulang'))

      // Capitalize the text if needed
      if ($(this).attr('capitalize') != undefined)
        text = I18next.capitalize(text)

      // Capitalize the first character of the first word if needed
      if ($(this).attr('capitalize-first') != undefined)
        text = I18next.capitalizeFirstLetter(text)

      // Apply the updated text
      $(this)[Modules.Consts.AllowedHTMLTags.some((tag) => text.indexOf(`<${tag}>`) != -1) ? 'html' : 'text'](text)
    })

    // Loop through each `tooltip`
    tooltips.each(function() {
      // Get the value of the localized text based on the `data-mulang` value
      let text = I18next.t(getAttributes($(this), 'data-mulang')),
        // Get the MDB object for this tooltip
        tooltipObject = getElementMDBObject($(this), 'Tooltip')

      // Capitalize the text if needed
      if ($(this).attr('capitalize') != undefined)
        text = I18next.capitalize(text)

      // Capitalize the first character of the first word if needed
      if ($(this).attr('capitalize-first') != undefined)
        text = I18next.capitalizeFirstLetter(text)

      // Apply the updated text
      tooltipObject.setContent(text)
    })

    // Loop through each `file selector`
    fileSelectors.each(function() {
      // Get the value of the localized text based on the `data-mulang` value
      let text = I18next.t(getAttributes($(this), 'data-mulang'))

      // Capitalize the text if needed
      if ($(this).attr('capitalize') != undefined)
        text = I18next.capitalize(text)

      // Capitalize the first character of the first word if needed
      if ($(this).attr('capitalize-first') != undefined)
        text = I18next.capitalizeFirstLetter(text)

      // Apply the updated text
      $(this).attr('file-info', text)
    })
  }
}

module.exports = {
  loadLocalization,
  applyLanguage,
  applyLanguageSpecific
}
