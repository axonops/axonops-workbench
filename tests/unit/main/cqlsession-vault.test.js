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

jest.mock('@axonops/cqlai-node', () => ({
  CQLSession: {
    connect: jest.fn(),
    testConnectionWithID: jest.fn(),
    cancelTestConnection: jest.fn()
  }
}))

const CQLNode = require('@axonops/cqlai-node').CQLSession

describe('Vault credentials passed to cqlai-node', () => {
  let window,
    cqlsession

  beforeAll(() => {
    global.FS = require('fs')
    global.addLog = jest.fn()

    cqlsession = require('../../../custom_modules/main/cqlsession')
  })

  beforeEach(() => {
    jest.clearAllMocks()

    window = {
      webContents: {
        send: jest.fn()
      }
    }

    CQLNode.testConnectionWithID.mockResolvedValue({
      success: false,
      error: 'reading database/creds/readonly from Vault: permission denied',
      code: 'CONNECTION_FAILED'
    })

    CQLNode.connect.mockResolvedValue({
      success: false,
      error: 'failed'
    })
  })

  let testConnectionOptions = (data) => {
    cqlsession.testConnection(window, {
      requestID: 'request',
      processID: 'process',
      ...data
    })

    return CQLNode.testConnectionWithID.mock.calls[0][0]
  }

  describe('testing a connection', () => {
    test('passes every Vault setting and the encrypted token', () => {
      let options = testConnectionOptions({
        vault: {
          path: 'database/creds/readonly',
          addr: 'https://vault.example.com:8200',
          namespace: 'team-a',
          caCert: '/certs/vault-ca.pem'
        },
        secrets: {
          vaultToken: 'encrypted-token'
        }
      })

      expect(options).toMatchObject({
        vaultPath: 'database/creds/readonly',
        vaultAddr: 'https://vault.example.com:8200',
        vaultNamespace: 'team-a',
        vaultCaCert: '/certs/vault-ca.pem',
        vaultToken: 'encrypted-token'
      })
      expect(options.vault).toBeUndefined()
    })

    test('leaves out empty Vault settings and a missing token so cqlai-node falls back to the environment', () => {
      let options = testConnectionOptions({
        vault: {
          path: 'database/creds/readonly',
          addr: 'https://vault.example.com:8200',
          namespace: '',
          caCert: '   '
        }
      })

      expect(options.vaultPath).toBe('database/creds/readonly')
      expect(options).not.toHaveProperty('vaultNamespace')
      expect(options).not.toHaveProperty('vaultCaCert')
      expect(options).not.toHaveProperty('vaultToken')
    })

    test('drops a username and password when the credentials come from Vault', () => {
      let options = testConnectionOptions({
        vault: {
          path: 'database/creds/readonly',
          addr: 'https://vault.example.com:8200'
        },
        secrets: {
          username: 'encrypted-username',
          password: 'encrypted-password',
          vaultToken: 'encrypted-token'
        }
      })

      expect(options).not.toHaveProperty('username')
      expect(options).not.toHaveProperty('password')
      expect(options.vaultToken).toBe('encrypted-token')
    })

    test('keeps the username and password when there is no Vault path', () => {
      let options = testConnectionOptions({
        vault: {
          path: '  ',
          addr: 'https://vault.example.com:8200'
        },
        secrets: {
          username: 'encrypted-username',
          password: 'encrypted-password'
        }
      })

      expect(options).toMatchObject({
        username: 'encrypted-username',
        password: 'encrypted-password'
      })
      expect(options).not.toHaveProperty('vaultPath')
      expect(options).not.toHaveProperty('vaultAddr')
    })

    test('reports a Vault error with its code', async () => {
      testConnectionOptions({
        vault: {
          path: 'database/creds/readonly',
          addr: 'https://vault.example.com:8200'
        }
      })

      await new Promise((resolve) => setImmediate(resolve))

      expect(window.webContents.send).toHaveBeenCalledWith('pty:test-connection:request', expect.objectContaining({
        connected: false,
        error: 'reading database/creds/readonly from Vault: permission denied [CONNECTION_FAILED]'
      }))
    })
  })

  describe('connecting a session', () => {
    test('passes the Vault settings and token instead of the saved username and password', () => {
      let data = {
        id: 'connection-1',
        vault: {
          path: 'database/creds/readonly',
          addr: 'https://vault.example.com:8200'
        },
        secrets: {
          username: 'encrypted-username',
          password: 'encrypted-password',
          vaultToken: 'encrypted-token'
        }
      }

      new cqlsession.Session(window, data).connect(data)

      let options = CQLNode.connect.mock.calls[0][0]

      expect(options).toMatchObject({
        vaultPath: 'database/creds/readonly',
        vaultAddr: 'https://vault.example.com:8200',
        vaultToken: 'encrypted-token'
      })
      expect(options).not.toHaveProperty('username')
      expect(options).not.toHaveProperty('password')
      expect(options).not.toHaveProperty('vault')
    })

    test('passes the username and password of a connection without Vault', () => {
      let data = {
        id: 'connection-2',
        secrets: {
          username: 'encrypted-username',
          password: 'encrypted-password'
        }
      }

      new cqlsession.Session(window, data).connect(data)

      let options = CQLNode.connect.mock.calls[0][0]

      expect(options).toMatchObject({
        username: 'encrypted-username',
        password: 'encrypted-password'
      })
      expect(options).not.toHaveProperty('vaultPath')
    })
  })
})
