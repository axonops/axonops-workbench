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
 * Module to handle crash reports
 *
 * Import needed modules
 *
 * Electron module to submit crash reports locally or to a remote server
 */
const CrashReporter = require('electron').crashReporter,
  // Convert a bytes value to a human-readable string (9 KB, 2 MB, and so on)
  ByteSize = require('bytes'),
  // System and OS overall information library
  SystemInformation = require('systeminformation'),
  // The app's important constants
  Constants = require('./consts')

/**
 * Update the extra info about the machine and the app's usage
 * Main extra info: [Memory, CPU usage, and info about the machine]
 */
let updateExtraInfo = async () => {
  // Define extra info to be sent within the crash report
  let extraInfo = {
    // Get information about the machine's memory/RAM and the app's total memory usage
    memory: await getMemory(),
    // Get information about the machine's CPU
    cpu: await getCPU(),
    // Get information about the machine - manufacturer, and model only -
    machine: await getMachineInfo()
  }; // This semicolon is critical here

  // Update the extra info
  (['memory', 'cpu', 'machine']).forEach((info) => CrashReporter.addExtraParameter(info, extraInfo[info]))

  // Update the extra info every second - it waits till all info is fetched -
  setTimeout(() => updateExtraInfo(), 1000)
}

/**
 * Calculate the app's total memory usage
 *
 * @Return: {integer} total memory usage by the app in Bytes
 */
let getMemoryUsage = () => {
  // Get the app/process' memory usage
  let memoryUsage = process.memoryUsage(),
    /**
     * Final result to be returned
     * Multiple values will be calculated together to get the total value
     */
    totalMemoryUsage = 0

  try {
    // Loop through each type of memory consuming and add its consumption/usage to `totalMemoryUsage`
    for (let type of Object.keys(memoryUsage))
      totalMemoryUsage += memoryUsage[type]
  } catch (e) {
    try {
      // If the error is a number then don't log the error
      if (!isNaN(parseInt(e.toString())))
        throw 0

      addLog(`Error in process crash reporter. Details: ${e}`, 'error')
    } catch (e) {}
  }

  // Return the final result
  return totalMemoryUsage
}

/**
 * Get information about the machine's memory/RAM
 *
 * @Return: {string} JSON string with different needed attributes which hold information about the memory - values converted from Bytes to human-readable string -
 */
let getMemory = async () => {
  // Final result to be returned
  let result = {}

  try {
    // Get the machine's memory info
    let memory = await SystemInformation.mem()

    // Get the app's total memory usage
    result.appUsage = getMemoryUsage()

    // Get the machine's total amount of memory
    result.total = memory.total

    // Get the currently available memory
    result.available = memory.available

    // Loop through each attribute
    Object.keys(result).forEach((attribute) => {
      // Get the current attribute's value
      let value = result[attribute]

      // Convert the value from bytes to a human-readable string
      value = Bytes(value)

      // Format the string to be the value and its unit - KB, MB, etc... -
      value = `${value['value']}${value['unit']}`

      // Save the updated value
      result[attribute] = value
    })
  } catch (e) {
    try {
      // If the error is a number then don't log the error
      if (!isNaN(parseInt(e.toString())))
        throw 0

      addLog(`Error in process crash reporter. Details: ${e}`, 'error')
    } catch (e) {}
  }

  // Return the final result
  return JSON.stringify(result)
}

/**
 * Get information about the machine's CPU
 *
 * @Return: {string} JSON string with different needed attributes which hold information about the CPU
 */
let getCPU = async () => {
  // Final result to be returned
  let result = {}

  try {
    // Get the CPU's info
    let cpu = await SystemInformation.cpu()

    // Get the CPU's manufacturer - for example Intel -
    result.manufacturer = cpu.manufacturer

    // Get the CPU's brand - for example Core™ i7-9... -
    result.brand = cpu.brand

    // Get the CPU's current, minimum, and maximum speed
    result.speed = {
      current: cpu.speed,
      min: cpu.speedMin,
      max: cpu.speedMax
    }

    // Get the number of logical cores which the CPU has
    result.cores = cpu.cores
  } catch (e) {
    try {
      // If the error is a number then don't log the error
      if (!isNaN(parseInt(e.toString())))
        throw 0

      addLog(`Error in process crash reporter. Details: ${e}`, 'error')
    } catch (e) {}
  }

  // Return the final result
  return JSON.stringify(result)
}

/**
 * Get information about the machine - manufacturer, and model only -
 *
 * @Return: {string} JSON string with different needed attributes which hold information about the machine
 */
let getMachineInfo = async () => {
  // Final result to be returned
  let result = {}

  try {
    // Get the machine's info
    let machine = await SystemInformation.system()

    // Get the machine's manufacturer - for example HP -
    result.manufacturer = machine.manufacturer

    // Get the machine's model - for example HP EliteBook... -
    result.model = machine.model
  } catch (e) {
    try {
      // If the error is a number then don't log the error
      if (!isNaN(parseInt(e.toString())))
        throw 0

      addLog(`Error in process crash reporter. Details: ${e}`, 'error')
    } catch (e) {}
  }

  // Return the final result
  return JSON.stringify(result)
}

// Start the crashing handler
let startCrashingHandler = async () => {
  CrashReporter.start({
    submitURL: Constants.CrashHandlerServer,
    uploadToServer: true,
    compress: false,
    extra: {
      memory: 'N/A',
      cpu: 'N/A',
      machine: 'N/A'
    }
  })

  // Call the extra info-getter function
  updateExtraInfo()
}

module.exports = {
  startCrashingHandler
}
