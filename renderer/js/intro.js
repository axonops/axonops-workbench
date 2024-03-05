/**
 * Node.js path module
 * Working with file and directory paths
 */
const Path = require('path')

// When the window/view is fully loaded
window.onload = () => {
  try {
    // Import the app's info from the `package.json` file
    const AppInfo = require(Path.join(__dirname, '..', '..', 'package.json')); // This semicolon is critical here

    // Set the app's name and version
    (['title', 'version']).forEach((info) => document.getElementById(info).innerHTML = AppInfo[info])
  } catch (e) {}
}
