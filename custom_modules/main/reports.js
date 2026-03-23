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
  let extraInfo = {
    memory: await getMemory(),
    cpu: await getCPU(),
    machine: await getMachineInfo()
  }; // This semicolon is critical here

  (['memory', 'cpu', 'machine']).forEach((info) => CrashReporter.addExtraParameter(info, extraInfo[info]))

  // Update the extra info every second - it waits till all info is fetched -
  setTimeout(updateExtraInfo, 1000)
}

/**
 * Calculate the app's total memory usage
 *
 * @Return: {integer} total memory usage by the app in Bytes
 */
let getMemoryUsage = () => {
  let memoryUsage = process.memoryUsage(),
    totalMemoryUsage = 0

  try {
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
  let result = {}

  try {
    let memory = await SystemInformation.mem()

    result.appUsage = getMemoryUsage()
    result.total = memory.total
    result.available = memory.available

    Object.keys(result).forEach((attribute) => {
      let value = Bytes(result[attribute])
      result[attribute] = `${value['value']}${value['unit']}`
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
  let result = {}

  try {
    let cpu = await SystemInformation.cpu()

    result.manufacturer = cpu.manufacturer
    result.brand = cpu.brand
    result.speed = {
      current: cpu.speed,
      min: cpu.speedMin,
      max: cpu.speedMax
    }

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
  let result = {}

  try {
    let machine = await SystemInformation.system()

    result.manufacturer = machine.manufacturer
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

  updateExtraInfo()
}

module.exports = {
  startCrashingHandler
}
