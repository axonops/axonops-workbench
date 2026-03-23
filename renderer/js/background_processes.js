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

const FS = require('fs-extra'),
  Path = require('path'),
  OS = require('os'),
  $ = require('jquery'),
  jQuery = $,
  IPCRenderer = require('electron').ipcRenderer,
  PortGet = require('port-get'),
  OpenSSHTunnel = require(Path.join(__dirname, '..', 'js', 'external', 'open_ssh_tunnel.js')),
  SSH2Utils = require('ssh2').utils,
  Diff = require('diff'),
  ConvertHEX = require('convert-hex'),
  Sanitize = require('sanitize-filename'),
  NodeRSA = require('node-rsa'),
  RandomID = require('id-16'),
  ZLib = require('zlib')

let extraResourcesPath = null,
  sshTunnelsObjects = [],
  isLoggingFeatureEnabled = true,
  toBeClosedSSHTunnels = [],
  publicKey = ''

$(document).ready(() => IPCRenderer.on('extra-resources-path', (_, path) => {
  extraResourcesPath = path

  const Config = require(Path.join(__dirname, '..', '..', 'custom_modules', 'renderer', 'config'))

  let internalDataPath = Path.join(extraResourcesPath || Path.join(__dirname, '..', '..'), 'internal_data')

  $(document).ready(() => {
    $.ajax({
      async: false,
      url: Path.join(__dirname, '..', 'js', 'funcs.js'),
      dataType: 'script'
    })
  })

  Config.getConfig(async (config) => {
    isLoggingFeatureEnabled = config.get('security', 'loggingEnabled') || isLoggingFeatureEnabled
    isLoggingFeatureEnabled = isLoggingFeatureEnabled != 'false'
  })

  {
    // SSH tunnels creation and controlling
    {
      IPCRenderer.on(`ssh-tunnel:create`, async (_, data) => {
        try {
          addLog(`Create an SSH tunnel to activate connection`, 'network')
        } catch (e) {}

        Config.getConfig(async (config) => {
          let timeout = {}; // This semicolon is critical here

          (['ready', 'forward']).forEach((value) => timeout[value] = parseInt(config.get('sshtunnel', `${value}Timeout`)) || 60000)

          let result = {
            object: null,
            port: 0
          }

          try {
            let [
              srcPort,
              localPort
            ] = await getRandom.port(2)

            data.port = data.port || 22
            data.dstAddr = data.dstAddr || '127.0.0.1'

            let authentication = {}

            if (![undefined, null, ''].includes(data.password))
              authentication.password = data.password

            try {
              if (![undefined, null, ''].includes(data.privatekey))
                authentication.privateKey = await FS.readFileSync(data.privatekey, 'utf8')
            } catch (e) {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
            }

            try {
              if (data.passphrase == undefined || data.passphrase.trim().length <= 0)
                throw 0

              let prasedKey = SSH2Utils.parseKey(authentication.privateKey, data.passphrase)

              if (prasedKey.type.includes('ed25519'))
                throw 0

              authentication.privateKey = prasedKey.getPrivatePEM()
            } catch (e) {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
            }

            // Remove keys with `undefined` values
            try {
              Object.keys(data).forEach((key) => {
                if (`${data[key]}` == 'undefined')
                  delete data[key]
              })

              Object.keys(authentication).forEach((key) => {
                if (`${authentication[key]}` == 'undefined' || minifyText(`${authentication[key]}`).length <= 0)
                  delete authentication[key]
              })
            } catch (e) {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
            }

            let sshTunnelAttributes = {
              ...data,
              ...authentication,
              srcAddr: '127.0.0.1',
              srcPort,
              localAddr: '127.0.0.1',
              localPort,
              readyTimeout: timeout.ready,
              forwardTimeout: timeout.forward,
              debug: function(data) {
                try {
                  addLog(data)
                } catch (e) {}
              }
            }

            // Obscure sensitive info before logging
            {
              let sshTunnelAttributesCopy = {
                ...sshTunnelAttributes
              }; // This semicolon is critical here

              (['username', 'password', 'privateKey', 'passphrase', 'requestID']).forEach((attribute) => {
                if (sshTunnelAttributesCopy[attribute] == undefined)
                  return

                sshTunnelAttributesCopy[attribute] = '*****'
              })

              try {
                addLog(`Final attributes of the SSH tunnel are '${JSON.stringify(sshTunnelAttributesCopy)}'`)
              } catch (e) {}
            }

            OpenSSHTunnel(sshTunnelAttributes).then((tunnel) => {
              // If this tunnel was queued for closing while being created, close it now
              try {
                if (!(toBeClosedSSHTunnels.some((_requestID) => _requestID == data.requestID)))
                  throw 0

                try {
                  tunnel.close()

                  try {
                    addLog(`The SSH tunnel which associated with request ID '${data.requestID}' has been closed`)
                  } catch (e) {}

                  toBeClosedSSHTunnels = toBeClosedSSHTunnels.filter((_requestID) => _requestID == data.requestID)
                } catch (e) {
                  try {
                    errorLog(e, 'SSH tunnel')
                  } catch (e) {}
                }

                return
              } catch (e) {}

              let key = data.connectionID == 'port' ? `_${localPort}` : data.connectionID

              sshTunnelsObjects[key] = {
                object: tunnel,
                port: localPort
              }

              result.port = localPort

              IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
                ...result,
                requestID: data.requestID
              })
            }).catch((e) => {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}

              result.error = e.toString()

              if (minifyText(result.error).includes('connectionrefused'))
                result.error = `${result.error}. Ensure that Cassandra is up and running, then start taking additional steps if the error persists`

              IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
                ...result,
                requestID: data.requestID
              })
            })
          } catch (e) {
            try {
              errorLog(e, 'SSH tunnel')
            } catch (e) {}

            result.error = e.toString()

            if (minifyText(result.error).includes('connectionrefused'))
              result.error = `${result.error}. Ensure that Cassandra is up and running, then start taking additional steps if the error persists`

            IPCRenderer.send(`ssh-tunnel:create:result:${data.requestID}`, {
              ...result,
              requestID: data.requestID
            })
          }
        })
      })

      IPCRenderer.on('ssh-tunnel:close', (_, connectionID) => {
        let isPort = !isNaN(parseInt(connectionID))

        try {
          addLog(`Close an SSH tunnel that associated with the connection of ID/defined-port '${connectionID}'`, 'network')
        } catch (e) {}

        try {
          if (!isPort)
            throw 0

          Object.keys(sshTunnelsObjects).forEach((tunnel) => {
            let sshTunnel = sshTunnelsObjects[tunnel]

            if (sshTunnel.port != connectionID)
              return

            try {
              sshTunnel.object.close()

              try {
                addLog(`The SSH tunnel which associated with connection of ID/defined-port '${connectionID}' has been closed`)
              } catch (e) {}
            } catch (e) {
              try {
                errorLog(e, 'SSH tunnel')
              } catch (e) {}
            }
          })

          return
        } catch (e) {
          try {
            errorLog(e, 'SSH tunnel')
          } catch (e) {}
        }

        try {
          sshTunnelsObjects[connectionID].object.close()

          addLog(`The SSH tunnel which associated with connection of ID/defined-port '${connectionID}' has been closed.`)
        } catch (e) {
          try {
            errorLog(e, 'SSH tunnel')
          } catch (e) {}
        }
      })

      IPCRenderer.on('ssh-tunnel:update', (_, data) => {
        try {
          if (sshTunnelsObjects[data.newID] != undefined)
            throw 0

          sshTunnelsObjects[data.newID] = sshTunnelsObjects[data.oldID]
        } catch (e) {}
      })

      IPCRenderer.on('ssh-tunnel:close:queue', (_, requestID) => toBeClosedSSHTunnels.push(requestID))
    }

    // Detect differentiation between two texts
    {
      IPCRenderer.on('detect-differentiation', async (_, data) => {
        let responseTag = `detect-differentiation:result:${data.requestID}`,
          changedLines = [],
          newLines = []

        try {
          data.oldText = data.oldText.split('\n')
          data.newText = data.newText.split('\n')

          if (data.newText.length <= data.oldText.length)
            throw 0

          let numOfLines = data.newText.length - data.oldText.length

          for (let i = data.newText.length - numOfLines; i < data.newText.length; ++i)
            newLines.push({
              number: i,
              content: data.newText[i],
              type: 'ADD'
            })
        } catch (e) {}

        for (let i = 0; i < data.oldText.length; ++i) {
          try {
            let oldLine = data.oldText[i].replace(/\s+/gm, ''),
              newLine = data.newText[i].replace(/\s+/gm, '')

            let diff = Diff.diffSentences(oldLine, newLine)[0]

            if ([diff.added, diff.removed].some((val) => val != undefined))
              changedLines.push({
                number: i,
                content: oldLine,
                type: 'CHANGE'
              })
          } catch (e) {
            try {
              errorLog(e, 'SSH tunnel')
            } catch (e) {}
          }
        }

        let result = changedLines.concat(newLines)

        try {
          result = result.map((change) => ({
            ...change,
            content: change.content.trim()
          }))
        } catch (e) {}

        IPCRenderer.send(responseTag, {
          result,
          requestID: data.requestID
        })
      })
    }

    // Blob content bi-directional conversion
    {
      IPCRenderer.on('blob:read-convert', (_, data) => {
        let itemHEXString = ''

        try {
          let itemBuffer = FS.readFileSync(data.itemPath)

          itemHEXString = ConvertHEX.bytesToHex(Array.from(itemBuffer))

          itemHEXString = `0x${itemHEXString}`
        } catch (e) {}

        IPCRenderer.send(`blob:read-convert:result:${data.requestID}`, {
          itemHEXString,
          requestID: data.requestID
        })
      })

      IPCRenderer.on('blob:convert-write', (_, data) => {
        let itemTempFile = ``,
          error = false

        try {
          let blobBytes = ConvertHEX.hexToBytes(data.blobHEXString),
            itemBuffer = Buffer.from(blobBytes)

          itemTempFile = Path.join(OS.tmpdir(), Sanitize(`preview_item_${data.randomID}`))

          itemTempFile = `${itemTempFile}.${data.itemType}`

          FS.writeFileSync(itemTempFile, itemBuffer)
        } catch (e) {
          error = true
        } finally {
          IPCRenderer.send(`blob:convert-write:result:${data.requestID}`, {
            itemTempFile,
            error,
            requestID: data.requestID
          })
        }
      })
    }

    {
      let handleCQLExecution = (data) => {
        let finalContent = '',
          count = 0,
          errors = [],
          totalExecutions = 0

        try {
          IPCRenderer.removeAllListeners(`pty:data:${data.id}`)
        } catch (e) {}

        IPCRenderer.on(`pty:data:${data.id}`, (_, _data) => {
          try {
            count += 1

            finalContent = `${finalContent}${_data.output}`

            if (!finalContent.includes('KEYWORD:OUTPUT:COMPLETED:ALL'))
              throw 0

            totalExecutions += 1

            let detectedOutput = finalContent.match(/([\s\S]*?)KEYWORD:OUTPUT:COMPLETED:ALL/gm)

            try {
              for (let output of detectedOutput) {
                finalContent = finalContent.replace(output, '')

                let statementOutputRegex = /KEYWORD:OUTPUT:STARTED([\s\S]*?)KEYWORD:OUTPUT:COMPLETED/gm,
                  matches,
                  loopIndex = -1

                while ((matches = statementOutputRegex.exec(output)) !== null) {
                  loopIndex = loopIndex + 1

                  // Avoid infinite loops with zero-width matches
                  if (matches.index === statementOutputRegex.lastIndex)
                    statementOutputRegex.lastIndex++

                  matches.forEach((match, groupIndex) => {
                    if (groupIndex != 1)
                      return

                    let isErrorFound = `${match}`.indexOf('KEYWORD:ERROR:STARTED') != -1

                    if (isErrorFound)
                      errors.push(`${match}`)
                  })
                }
              }
            } catch (e) {}

            if (!(count % 100 == 0 || minifyText(_data.output).includes('keyword:output:source:completed')))
              return

            let finalData = {
              ...data,
              totalExecutions,
              errors: JSON.stringify(errors),
              isFinished: minifyText(_data.output).includes('keyword:output:source:completed')
            }

            IPCRenderer.send(`cql:file:execute:data`, finalData)

            errors = []
          } catch (e) {}
        })
      }

      IPCRenderer.on('cql:file:execute', (_, data) => handleCQLExecution(data))
    }

    // Encrypt/Decrypt provided metadata
    {
      IPCRenderer.on('background:text:encrypt', async (_, data) => {
        let encryptedText = ''

        try {
          encryptedText = encryptText(data.key, data.text)
        } catch (e) {}

        try {
          ZLib.gzip(encryptedText, {
            level: ZLib.constants.Z_BEST_COMPRESSION
          }, async (err, compressedText) => {
            try {
              if (err)
                return

              try {
                encryptedText = compressedText.toString('base64')
              } catch (e) {}

              if (encryptedText.length <= 0 || data.keychainOSName == null)
                return

              try {
                await FS.ensureDir(internalDataPath)
              } catch (e) {}

              try {
                await FS.writeFileSync(Path.join(internalDataPath, `${data.keychainOSName}.blob`), encryptedText)
              } catch (e) {}
            } catch (e) {}
          })
        } catch (e) {}
      })

      IPCRenderer.on(`background:text:decrypt`, async (_, data) => {
        let decryptedText = '',
          sendResult = () => IPCRenderer.send(`background:text:decrypt:result:${data.requestID}`, decryptedText)

        try {
          if (data.keychainOSName == null)
            throw 0

          try {
            await FS.ensureDir(internalDataPath)
          } catch (e) {}

          try {
            data.text = await FS.readFileSync(Path.join(internalDataPath, `${data.keychainOSName}.blob`), 'utf8')
          } catch (e) {}

          ZLib.gunzip(Buffer.from(data.text, 'base64'), async (err, decompressed) => {
            if (err)
              return sendResult()

            try {
              decryptedText = decompressed.toString()
            } catch (e) {}

            try {
              decryptedText = decryptText(data.key, decryptedText)
            } catch (e) {}

            sendResult()
          })

          return
        } catch (e) {}

        try {
          decryptedText = decryptText(data.key, data.text)
        } catch (e) {}

        sendResult()
      })
    }
  }
}))
