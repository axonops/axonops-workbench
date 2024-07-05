/**
 * The `intro` JS file - the only file that is imported by the `intro` view -
 *
 * Import the Node.js path module
 * Working with file and directory paths
 */
const Path = require('path'),
  /**
   * Electron renderer communication with the main thread
   * Used for sending requests from the renderer threads to the main thread and listening to the responses
   */
  IPCRenderer = require('electron').ipcRenderer

// When the window/view is fully loaded
window.onload = () => {
  try {
    // Import the app's info from the `package.json` file
    const AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')); // This semicolon is critical here

    // Set the app's name and version
    (['title', 'version']).forEach((info) => document.getElementById(info).innerHTML = AppInfo[info])
  } catch (e) {}

  // Handle the Cassandra®'s copyright acknowledgement
  {
    // Point at the intro's overall container
    let container = document.querySelector('center'),
      // Point at the acknowledgement checkbox
      acknowledgedCheckbox = document.getElementById('cassandraCopyrightAcknowledged')

    // When the checkbox value is changed
    acknowledgedCheckbox.addEventListener('change', () => {
      // Whether or not it's checked
      let isChecked = acknowledgedCheckbox.checked

      // If it's not then skip the upcoming code
      if (!isChecked)
        return

      // Hide the checkbox's form
      setTimeout(() => container.classList.remove("show-checkbox"), 100);

      // Set the associated key in the app's config to be `true`
      IPCRenderer.send(`cassandra-copyright-acknowledged:true`)

      // The app should be loaded now
      setTimeout(() => IPCRenderer.send(`loaded`), 2500)
    })

    // Send request to the main thread; to get the status of the copyright acknowledgement
    IPCRenderer.send(`cassandra-copyright-acknowledged`)

    // Once the result is received
    IPCRenderer.on(`cassandra-copyright-acknowledged`, (_, isAcknowledged) => {
      // Show spinner then the notice
      try {
        // Show the spinner
        setTimeout(() => container.classList.add("show-spinner"), 750)

        // Now show the notice
        setTimeout(() => container.classList.add("show-notice"), 1500)

        // If the copyright notice is already acknowledgement then skip this try-catch block
        if (isAcknowledged)
          throw 0

        // Now show the notice
        setTimeout(() => container.classList.add("show-checkbox"), 2000)
      } catch (e) {}
    })
  }
}
