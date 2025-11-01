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
 * Module to handle the shortcuts across the entire app
 */

/**
 * Define the default shortcuts
 * All shortcuts values are save in TinyKeys version, even those for `monaco-editor`
 */
let defaultShortcuts = [{
    id: 'zoom-in',
    description: 'zoom in',
    keys: {
      win32: '$mod+Shift+Equal',
      darwin: '$mod+Shift+BracketRight',
      linux: '$mod+Shift+Equal'
    }
  },
  {
    id: 'zoom-out',
    description: 'zoom out',
    keys: {
      win32: '$mod+Shift+Minus',
      darwin: '$mod+Shift+Slash',
      linux: '$mod+Shift+Minus'
    }
  },
  {
    id: 'zoom-reset',
    description: 'zoom rest',
    keys: {
      win32: '$mod+Shift+Digit9',
      darwin: '$mod+Shift+Digit9',
      linux: '$mod+Shift+Digit0'
    }
  },
  {
    id: 'connections-search',
    description: 'connections search',
    keys: {
      win32: '$mod+K',
      darwin: '$mod+K',
      linux: '$mod+K'
    }
  },
  {
    id: 'enhanced-console-clear',
    description: 'clear the enhanced console',
    keys: {
      win32: '$mod+L',
      darwin: '$mod+L',
      linux: '$mod+L'
    }
  },
  {
    id: 'basic-console-font-increase',
    description: 'increase basic console font size',
    keys: {
      win32: '$mod+Equal',
      darwin: '$mod+Equal',
      linux: '$mod+Equal'
    },
    uneditable: true
  },
  {
    id: 'basic-console-font-decrease',
    description: 'decrease basic console font size',
    keys: {
      win32: '$mod+Minus',
      darwin: '$mod+Minus',
      linux: '$mod+Minus'
    },
    uneditable: true
  },
  {
    id: 'basic-console-font-reset',
    description: 'reset basic console font size',
    keys: {
      win32: '$mod+Digit0',
      darwin: '$mod+Digit0',
      linux: '$mod+Digit0'
    },
    uneditable: true
  },
  {
    id: 'history-statements-forward',
    description: 'browse statements history forward',
    keys: {
      win32: '$mod+ArrowUp',
      darwin: '$mod+ArrowUp',
      linux: '$mod+ArrowUp'
    }
  },
  {
    id: 'history-statements-backward',
    description: 'browse statements history backward',
    keys: {
      win32: '$mod+ArrowDown',
      darwin: '$mod+ArrowDown',
      linux: '$mod+ArrowDown'
    }
  },
  {
    id: 'execute-cql-statement',
    description: 'execute the cql statement',
    keys: {
      win32: '$mod+Enter',
      darwin: '$mod+Enter',
      linux: '$mod+Enter'
    },
    uneditable: true
  },
  {
    id: 'toggle-full-screen',
    description: 'toogle full screen mode',
    keys: {
      win32: 'F11',
      darwin: 'F11',
      linux: 'F11'
    },
    uneditable: true
  },
  {
    id: 'rows-range-selection',
    description: 'Select rows within range',
    keys: {
      win32: 'shift+lMouse',
      darwin: 'shift+lMouse',
      linux: 'shift+lMouse'
    },
    uneditable: true
  },
  {
    id: 'deselect row',
    description: 'Deselect a row',
    keys: {
      win32: 'ctrl+lMouse',
      darwin: 'ctrl+lMouse',
      linux: 'ctrl+lMouse'
    },
    uneditable: true
  },
]

let utils = {
  // Convert a given keys array to TinyKeys compatible
  keysArrayToTinyKeys: (keysArray) => {
    if (!Array.isArray(keysArray) || keysArray.length === 0)
      return ''

    let keyMap = {
      // Modifier keys
      'ctrl': '$mod',
      'meta': '$mod',
      'shift': 'Shift',
      'alt': 'Alt',

      // Special keys
      'space': 'Space',
      'esc': 'Escape',
      'escape': 'Escape',
      'up': 'ArrowUp',
      'down': 'ArrowDown',
      'left': 'ArrowLeft',
      'right': 'ArrowRight',
      'arrowup': 'ArrowUp',
      'arrowdown': 'ArrowDown',
      'arrowleft': 'ArrowLeft',
      'arrowright': 'ArrowRight',
      'enter': 'Enter',
      'tab': 'Tab',
      'backspace': 'Backspace',
      'delete': 'Delete',
      'insert': 'Insert',
      'home': 'Home',
      'end': 'End',
      'pageup': 'PageUp',
      'pagedown': 'PageDown',

      // Symbol keys
      '=': 'Equal',
      '+': 'Equal', // Plus key is same as Equal
      '-': 'Minus',
      '/': 'Slash',
      '[': 'BracketLeft',
      ']': 'BracketRight',
      ';': 'Semicolon',
      "'": 'Quote',
      ',': 'Comma',
      '.': 'Period',
      '`': 'Backquote',
      '\\': 'Backslash'
    }

    let modifiers = [],
      mainKey = null

    for (let key of keysArray) {
      if (typeof key === 'object' && key.key)
        key = key.key

      let lowerKey = key.toLowerCase()

      // Check if it's a modifier
      if (lowerKey === 'ctrl' || lowerKey === 'meta') {
        if (!modifiers.includes('$mod'))
          modifiers.push('$mod')
      } else if (lowerKey === 'shift') {
        modifiers.push('Shift')
      } else if (lowerKey === 'alt') {
        modifiers.push('Alt')
      } else {
        mainKey = key
      }
    }

    try {
      if (!mainKey)
        throw 0

      let lowerMainKey = mainKey.toLowerCase()

      // Check in key map first (includes + and - symbols)
      if (keyMap[mainKey] || keyMap[lowerMainKey]) {
        mainKey = keyMap[mainKey] || keyMap[lowerMainKey]
      }
      // Single letter - capitalize
      else if (/^[a-z]$/i.test(mainKey)) {
        mainKey = mainKey.toUpperCase()
      }
      // Single digit - prefix with 'Digit'
      else if (/^[0-9]$/.test(mainKey)) {
        mainKey = 'Digit' + mainKey
      }
      // Function keys (F1-F24)
      else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(lowerMainKey)) {
        mainKey = mainKey.toUpperCase()
      }
    } catch (e) {}

    // Combine modifiers and main key
    let parts = [...modifiers]

    if (mainKey)
      parts.push(mainKey)

    return parts.join('+')
  },
  // Convert a given TinyKeys shortcut string to Monaco editor compatible
  tinyKeysToMonaco: (tinyKeysString) => {
    if (!tinyKeysString || typeof tinyKeysString !== 'string')
      return ''

    // Handle + and - keys by using placeholders before splitting
    let normalized = tinyKeysString
      .replace(/\+Equal/g, '+<!EQUAL!>')
      .replace(/\+Minus/g, '+<!MINUS!>')

    let parts = normalized.split('+').map(part =>
      part.replace('<!EQUAL!>', 'Equal').replace('<!MINUS!>', 'Minus')
    )

    // Modifiers map
    let modifierMap = {
        '$mod': 'CtrlCmd',
        'Shift': 'Shift',
        'Alt': 'Alt',
        'Ctrl': 'WinCtrl'
      },
      keyCodeMap = {
        // Special keys
        'Backspace': 'Backspace',
        'Tab': 'Tab',
        'Enter': 'Enter',
        'Escape': 'Escape',
        'Space': 'Space',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'End': 'End',
        'Home': 'Home',
        'Insert': 'Insert',
        'Delete': 'Delete',

        // Arrow keys
        'ArrowLeft': 'LeftArrow',
        'ArrowUp': 'UpArrow',
        'ArrowRight': 'RightArrow',
        'ArrowDown': 'DownArrow',
        'LeftArrow': 'LeftArrow',
        'UpArrow': 'UpArrow',
        'RightArrow': 'RightArrow',
        'DownArrow': 'DownArrow',

        // Digits
        'Digit0': 'Digit0',
        'Digit1': 'Digit1',
        'Digit2': 'Digit2',
        'Digit3': 'Digit3',
        'Digit4': 'Digit4',
        'Digit5': 'Digit5',
        'Digit6': 'Digit6',
        'Digit7': 'Digit7',
        'Digit8': 'Digit8',
        'Digit9': 'Digit9',

        // Function keys
        'F1': 'F1',
        'F2': 'F2',
        'F3': 'F3',
        'F4': 'F4',
        'F5': 'F5',
        'F6': 'F6',
        'F7': 'F7',
        'F8': 'F8',
        'F9': 'F9',
        'F10': 'F10',
        'F11': 'F11',
        'F12': 'F12',

        // Symbol keys
        'Semicolon': 'Semicolon',
        'Equal': 'Equal',
        'Comma': 'Comma',
        'Minus': 'Minus',
        'Period': 'Period',
        'Slash': 'Slash',
        'Backquote': 'Backquote',
        'BracketLeft': 'BracketLeft',
        'Backslash': 'Backslash',
        'BracketRight': 'BracketRight',
        'Quote': 'Quote',
        'Meta': 'Meta'
      }

    let monacoParts = parts.filter(part => part).map((part) => {
      // Check if it's a modifier
      if (modifierMap[part])
        return `monaco.KeyMod.${modifierMap[part]}`

      // Check if it's in keyCodeMap
      if (keyCodeMap[part])
        return `monaco.KeyCode.${keyCodeMap[part]}`

      // Handle single letter keys (A-Z)
      if (/^[A-Z]$/.test(part))
        return `monaco.KeyCode.Key${part}`

      // Fallback: assume it's a KeyCode
      return `monaco.KeyCode.${part}`
    })

    return monacoParts.join(' | ')
  },
  // Convert Monaco editor shortcut to TinyKeys compatible
  monacoToTinyKeys: (monacoString) => {
    if (!monacoString || typeof monacoString !== 'string')
      return ''

    let parts = monacoString.split('|').map(part => part.trim()),
      // Map Monaco KeyMod to TinyKeys
      modifierToTinyKeys = {
        'CtrlCmd': '$mod',
        'Shift': 'Shift',
        'Alt': 'Alt',
        'WinCtrl': 'Ctrl'
      },
      keyCodeToTinyKeys = {
        // Special keys
        'Backspace': 'Backspace',
        'Tab': 'Tab',
        'Enter': 'Enter',
        'Escape': 'Escape',
        'Space': 'Space',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'End': 'End',
        'Home': 'Home',
        'Insert': 'Insert',
        'Delete': 'Delete',

        // Arrow keys (Monaco -> TinyKeys)
        'LeftArrow': 'ArrowLeft',
        'UpArrow': 'ArrowUp',
        'RightArrow': 'ArrowRight',
        'DownArrow': 'ArrowDown',

        // Digits
        'Digit0': 'Digit0',
        'Digit1': 'Digit1',
        'Digit2': 'Digit2',
        'Digit3': 'Digit3',
        'Digit4': 'Digit4',
        'Digit5': 'Digit5',
        'Digit6': 'Digit6',
        'Digit7': 'Digit7',
        'Digit8': 'Digit8',
        'Digit9': 'Digit9',

        // Function keys
        'F1': 'F1',
        'F2': 'F2',
        'F3': 'F3',
        'F4': 'F4',
        'F5': 'F5',
        'F6': 'F6',
        'F7': 'F7',
        'F8': 'F8',
        'F9': 'F9',
        'F10': 'F10',
        'F11': 'F11',
        'F12': 'F12',

        // Symbol keys
        'Semicolon': 'Semicolon',
        'Equal': 'Equal',
        'Comma': 'Comma',
        'Minus': 'Minus',
        'Period': 'Period',
        'Slash': 'Slash',
        'Backquote': 'Backquote',
        'BracketLeft': 'BracketLeft',
        'Backslash': 'Backslash',
        'BracketRight': 'BracketRight',
        'Quote': 'Quote',
        'Meta': 'Meta'
      }

    let tinyKeysParts = parts.map((part) => {
      // Handle KeyMod
      if (part.startsWith('monaco.KeyMod.')) {
        let modifierName = part.replace('monaco.KeyMod.', '')

        return modifierToTinyKeys[modifierName] || modifierName
      }

      // Handle KeyCode
      if (part.startsWith('monaco.KeyCode.')) {
        let keyName = part.replace('monaco.KeyCode.', '')

        // Handle Key* pattern (e.g., KeyK -> K)
        if (/^Key[A-Z]$/.test(keyName))
          return keyName.substring(3)

        // Use map or fallback to keyName as-is
        return keyCodeToTinyKeys[keyName] || keyName
      }

      // Fallback
      return part
    }).filter(Boolean) // Remove any empty strings

    return tinyKeysParts.join('+')
  },
  // Convert TinyKeys shortcut to keys array
  tinyKeysToKeysArray: (tinyKeysString) => {
    if (!tinyKeysString || typeof tinyKeysString !== 'string')
      return []

    // Handle Equal and Minus keys by using placeholders before splitting
    let normalized = tinyKeysString
      .replace(/\+Equal/g, '+<!EQUAL!>')
      .replace(/\+Minus/g, '+<!MINUS!>')

    let parts = normalized.split('+').map(part =>
      part.replace('<!EQUAL!>', 'Equal').replace('<!MINUS!>', 'Minus')
    )

    // Map modifiers
    let modifierMap = {
        '$mod': 'ctrl',
        'Shift': 'shift',
        'Alt': 'alt',
        'Ctrl': 'ctrl',
        'Meta': 'meta'
      },
      // Map special keys to their key names and codes
      specialKeyMap = {
        'Backspace': {
          key: 'backspace',
          code: 8
        },
        'Tab': {
          key: 'tab',
          code: 9
        },
        'Enter': {
          key: 'enter',
          code: 13
        },
        'Escape': {
          key: 'esc',
          code: 27
        },
        'Space': {
          key: 'space',
          code: 32
        },
        'PageUp': {
          key: 'pageup',
          code: 33
        },
        'PageDown': {
          key: 'pagedown',
          code: 34
        },
        'End': {
          key: 'end',
          code: 35
        },
        'Home': {
          key: 'home',
          code: 36
        },
        'ArrowLeft': {
          key: 'left',
          code: 37
        },
        'ArrowUp': {
          key: 'up',
          code: 38
        },
        'ArrowRight': {
          key: 'right',
          code: 39
        },
        'ArrowDown': {
          key: 'down',
          code: 40
        },
        'Insert': {
          key: 'insert',
          code: 45
        },
        'Delete': {
          key: 'delete',
          code: 46
        },
        'F1': {
          key: 'f1',
          code: 112
        },
        'F2': {
          key: 'f2',
          code: 113
        },
        'F3': {
          key: 'f3',
          code: 114
        },
        'F4': {
          key: 'f4',
          code: 115
        },
        'F5': {
          key: 'f5',
          code: 116
        },
        'F6': {
          key: 'f6',
          code: 117
        },
        'F7': {
          key: 'f7',
          code: 118
        },
        'F8': {
          key: 'f8',
          code: 119
        },
        'F9': {
          key: 'f9',
          code: 120
        },
        'F10': {
          key: 'f10',
          code: 121
        },
        'F11': {
          key: 'f11',
          code: 122
        },
        'F12': {
          key: 'f12',
          code: 123
        }
      },
      // Map symbol keys
      symbolKeyMap = {
        'Semicolon': {
          key: ';',
          code: 186
        },
        'Equal': {
          key: '=',
          code: 187
        },
        'Comma': {
          key: ',',
          code: 188
        },
        'Minus': {
          key: '-',
          code: 189
        },
        'Period': {
          key: '.',
          code: 190
        },
        'Slash': {
          key: '/',
          code: 191
        },
        'Backquote': {
          key: '`',
          code: 192
        },
        'BracketLeft': {
          key: '[',
          code: 219
        },
        'Backslash': {
          key: '\\',
          code: 220
        },
        'BracketRight': {
          key: ']',
          code: 221
        },
        'Quote': {
          key: "'",
          code: 222
        }
      },
      // Map digit keys
      digitKeyMap = {
        'Digit0': {
          key: '0',
          code: 48
        },
        'Digit1': {
          key: '1',
          code: 49
        },
        'Digit2': {
          key: '2',
          code: 50
        },
        'Digit3': {
          key: '3',
          code: 51
        },
        'Digit4': {
          key: '4',
          code: 52
        },
        'Digit5': {
          key: '5',
          code: 53
        },
        'Digit6': {
          key: '6',
          code: 54
        },
        'Digit7': {
          key: '7',
          code: 55
        },
        'Digit8': {
          key: '8',
          code: 56
        },
        'Digit9': {
          key: '9',
          code: 57
        }
      }

    return parts.filter(part => part).map((part) => {
      // Check if it's a modifier
      if (modifierMap[part])
        return modifierMap[part]

      // Check if it's a single letter (A-Z)
      if (/^[A-Z]$/.test(part))
        return {
          key: part.toLowerCase(),
          code: part.charCodeAt(0)
        }

      // Check special keys, symbols, and digits
      let keyInfo = specialKeyMap[part] || symbolKeyMap[part] || digitKeyMap[part]

      if (keyInfo)
        return {
          ...keyInfo
        }

      // Fallback: return as-is with code 0
      return {
        key: part.toLowerCase(),
        code: 0
      }
    })
  }
}

let shortcutDetector = (element, callback) => {
  // Whether or not the current detector is still listening to shortcuts
  let isListening = true,
    // Inner function to get key name and code (number)
    getKeyNameAndCode = (e) => {
      /**
       * Handle special keys
       * [space, arrows - up, down, left and right, and ESC]
       */
      try {
        if (!e.key) throw 0

        let key = e.key.toLowerCase(), // Key name
          code = e.keyCode // Key code

        // Map special keys
        const keyMap = {
          ' ': 'space',
          'arrowup': 'up',
          'arrowdown': 'down',
          'arrowleft': 'left',
          'arrowright': 'right',
          'escape': 'esc'
        }

        // Use mapped key if it exists
        if (keyMap[key])
          key = keyMap[key]

        // Return final key name and its code
        return {
          key,
          code
        }
      } catch (e) {}

      /**
       * In case the previous method didn't work as expected
       * This method assumes we don't have `key` attribute directly
       */
      try {
        if (!e.keyCode)
          throw 0

        let code = e.keyCode

        // Letters A-Z
        if (code >= 65 && code <= 90)
          return {
            key: String.fromCharCode(code).toLowerCase(),
            code
          }

        // Numbers 0-9
        if (code >= 48 && code <= 57)
          return {
            key: String.fromCharCode(code),
            code
          }
      } catch (e) {}

      // Return `null` in case both methods failed
      return null
    }

  // Inner function to check if the key is a modifier key
  let isModifierKey = (key) => ['ctrl', 'shift', 'alt', 'meta'].includes(key)

  // Add event listener to the provided element
  element[0].addEventListener('keydown', function(e) {
    // In case the detector is not listening then skip the upcoming code
    if (!isListening)
      return

    // The combination keys
    let keys = []

    /**
     * Check and get modifier keys
     * `CTRL` or `META`
     */
    if (e.ctrlKey || e.metaKey)
      keys.push('ctrl')

    // `SHIFT`
    if (e.shiftKey)
      keys.push('shift')

    // `ALT`
    if (e.altKey)
      keys.push('alt')

    // Get the main key
    let mainKey = getKeyNameAndCode(e)

    // Make sure it's not a modifier key and mainKey exists
    if (mainKey && !isModifierKey(mainKey.key))
      keys.push(mainKey)

    try {
      keys = keys.filter((key) => (typeof key === 'object' ? key.key : `${key}`) != 'control')
    } catch (e) {}

    // Only trigger if we have at least one modifier + one key
    if (keys.length < 2)
      return

    // Call the callback
    try {
      callback(keys)
    } catch (e) {}
  })

  return {
    // Stop function; used to stop the detector from keep listening to key combinations
    stop: () => isListening = false
  }
}

let getShortcuts = () => {
  let shortcuts = getDefaultShortcuts()

  /**
   * Search for any custom shortcut value set by the user
   * Shorcuts are saved in local storage
   */
  for (let shortcut of shortcuts) {
    // Attempt to get the custom value
    let customValue = Store.get(`shortcut-${shortcut.id}`)

    // If the shortcut doesn't have a value then continue with the next shortcut
    if (customValue == undefined)
      continue

    // Update with the new value
    shortcut.keys[OS.platform() || 'linux'] = customValue
  }

  // Return the final shortcuts values
  return shortcuts
}

let setShortcut = (id, keys, isDefault = false) => {
  if (isDefault) {
    Store.remove(`shortcut-${id}`)

    return true
  }

  // If the action is set to be without a shortcut
  if (keys.length <= 0) {
    Store.set(`shortcut-${id}`, ``)

    return true
  }

  let tinyKeysString = typeof keys === 'object' ? utils.keysArrayToTinyKeys(keys) : keys

  try {
    if (!tinyKeysString || tinyKeysString.length <= 0)
      throw 0

    Store.set(`shortcut-${id}`, `${tinyKeysString}`)

    return true
  } catch (e) {
    return false
  }
}

let getShortcut = (id, onlyKey = false) => {
  let shortcuts = getShortcuts(),
    shortcut = shortcuts.find((shortcut) => shortcut.id == id)

  try {
    if (onlyKey)
      shortcut = shortcut.keys[OS.platform()] || shortcut.keys['linux']
  } catch (e) {}

  return shortcut
}

let getShortcutForMonacoEditor = (id) => eval(Modules.Shortcuts.utils.tinyKeysToMonaco(Modules.Shortcuts.getShortcut(id, true)))

let getKbd = (shortcutTinyKeyFormat, handleUnset = false) => {
  let shortcutArray = Modules.Shortcuts.utils.tinyKeysToKeysArray(shortcutTinyKeyFormat),
    htmlContent = ''

  try {
    htmlContent = shortcutArray.map((key) => {
      let keyName = typeof key === 'object' ? key.key : `${key}`

      if (keyName == 'control')
        return

      if (keyName == 'lmouse')
        return `<kbd><ion-icon name="mouse"></ion-icon> Left Mouse Click</kbd> `

      if (keyName == '=' || keyName == '+')
        return `<kbd>=\\+</kbd> `

      if (keyName == 'ctrl' && OS.platform() == 'darwin')
        return `<kbd>meta</kbd> `

      return `<kbd>${keyName}</kbd> `
    }).join('')
  } catch (e) {}

  if (htmlContent.length <= 0 && handleUnset)
    return `<kbd class="not-set">NOT SET</kbd>`

  return htmlContent
}

let updateKbdElements = () => {
  let shortcuts = getShortcuts()

  for (let shortcut of shortcuts) {
    try {
      let shortcutValue = shortcut.keys[OS.platform()] || shortcut.keys['linux']

      try {
        $(`[kbd-shortcut="${shortcut.id}"]`).html(`${getKbd(shortcutValue)}`)
      } catch (e) {}
    } catch (e) {}
  }
}

let setShortcutInSession = (element, shortcutID, func) => {
  let shortcut = getShortcut(shortcutID),
    shortcutKeyValue = {},
    shortcutValue = shortcut.keys[OS.platform()] || shortcut.keys['linux']

  try {
    shortcutKeyValue[shortcutValue] = () => func()
  } catch (e) {}

  try {
    let shortcutObject = shortcutsObjects.find((object) => $(object.element).is($(element)) && object.shortcutID == shortcutID)

    shortcutObject.tinyKeys()

    shortcutsObjects = shortcutsObjects.filter((object) => !$(object.element).is($(element)) && object.shortcutID != shortcutID)
  } catch (e) {}

  shortcutsObjects.push({
    element,
    shortcutID,
    func,
    tinyKeys: tinyKeys.tinykeys(element, shortcutKeyValue)
  })

  try {
    $(`[kbd-shortcut="${shortcutID}"]`).html(`${getKbd(shortcutValue)}`)
  } catch (e) {}
}

let updateShortcutsInSession = () => {
  for (let shortcutsObject of [...(shortcutsObjects || [])]) {
    try {
      setShortcutInSession(shortcutsObject.element, shortcutsObject.shortcutID, shortcutsObject.func)
    } catch (e) {}
  }
}

let getDefaultShortcuts = () => JSON.parse(JSON.stringify(defaultShortcuts))

module.exports = {
  setShortcut,
  setShortcutInSession,
  updateShortcutsInSession,
  getShortcuts,
  getShortcut,
  getDefaultShortcuts,
  getKbd,
  getShortcutForMonacoEditor,
  updateKbdElements,
  shortcutDetector,
  utils
}
