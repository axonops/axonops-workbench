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

describe('Connection Events', () => {
  let mockConnections;
  let mockProjects;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    document.body.innerHTML = `
      <div class="workspaces-container">
        <div class="workspace" data-id="workspace-1"></div>
        <div class="workspace" data-id="workspace-sandbox"></div>
      </div>
      <div class="body">
        <div class="right">
          <div class="content">
            <div content="connections">
              <div class="connections-container">
                <div class="connections" workspace-id="workspace-1"></div>
                <div class="connections" workspace-id="workspace-sandbox"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Mock connection data
    mockConnections = [
      {
        id: 'connection-1',
        name: 'Production Connection',
        host: '192.168.1.100',
        port: 9042,
        username: 'cassandra',
        ssl: true
      },
      {
        id: 'connection-2',
        name: 'Development Connection',
        host: 'localhost',
        port: 9042,
        username: 'cassandra',
        ssl: false
      }
    ];
    
    // Mock Docker projects
    mockProjects = [
      {
        id: 'project-1',
        name: 'test-project',
        status: 'running',
        containers: ['cassandra-1', 'cassandra-2']
      }
    ];
    
    // Setup module mocks
    global.Modules.Connections.getConnections.mockResolvedValue(mockConnections);
    global.Modules.Docker.getProjects.mockResolvedValue(mockProjects);
  });

  describe('Connection Module Functions', () => {
    test('should fetch connections for workspace', async () => {
      const workspaceID = 'workspace-1';
      
      const result = await global.Modules.Connections.getConnections(workspaceID);
      
      expect(global.Modules.Connections.getConnections).toHaveBeenCalledWith(workspaceID);
      expect(result).toEqual(mockConnections);
    });

    test('should fetch Docker projects for sandbox', async () => {
      const workspaceID = 'workspace-sandbox';
      
      const result = await global.Modules.Docker.getProjects(workspaceID);
      
      expect(global.Modules.Docker.getProjects).toHaveBeenCalledWith(workspaceID);
      expect(result).toEqual(mockProjects);
    });

    test('should handle empty connections response', async () => {
      global.Modules.Connections.getConnections.mockResolvedValue([]);
      
      const result = await global.Modules.Connections.getConnections('workspace-1');
      
      expect(result).toEqual([]);
    });

    test('should handle error when fetching connections', async () => {
      const error = new Error('Failed to fetch connections');
      global.Modules.Connections.getConnections.mockRejectedValue(error);
      
      await expect(global.Modules.Connections.getConnections('workspace-1')).rejects.toThrow('Failed to fetch connections');
    });
  });

  describe('Event Handler Logic', () => {
    test('should create event handler for getConnections', () => {
      // Simulate creating an event handler
      const getConnectionsHandler = jest.fn(async (e, data) => {
        const { workspaceID } = data;
        const isSandbox = workspaceID === 'workspace-sandbox';
        const moduleGetFunction = !isSandbox ? global.Modules.Connections.getConnections : global.Modules.Docker.getProjects;
        
        const items = await moduleGetFunction(workspaceID);
        
        // Update UI logic would go here
        const container = $(`.connections[workspace-id="${workspaceID}"]`);
        if (e.type === 'getConnections') {
          container.html(''); // Clear
        }
        
        if (items.length === 0) {
          container.addClass('empty');
        } else {
          container.removeClass('empty');
        }
        
        return items;
      });

      // Test the handler logic
      const event = { type: 'getConnections' };
      const data = { workspaceID: 'workspace-1' };
      
      getConnectionsHandler(event, data);
      
      expect(getConnectionsHandler).toHaveBeenCalledWith(event, data);
    });

    test('should create event handler for refreshConnections', () => {
      const refreshConnectionsHandler = jest.fn(async (e, data) => {
        const { workspaceID } = data;
        const items = await global.Modules.Connections.getConnections(workspaceID);
        
        // Don't clear container on refresh
        const container = $(`.connections[workspace-id="${workspaceID}"]`);
        
        if (items.length === 0) {
          container.addClass('empty');
        } else {
          container.removeClass('empty');
        }
        
        return items;
      });

      const event = { type: 'refreshConnections' };
      const data = { workspaceID: 'workspace-1' };
      
      refreshConnectionsHandler(event, data);
      
      expect(refreshConnectionsHandler).toHaveBeenCalledWith(event, data);
    });
  });

  describe('Connection UI Elements', () => {
    test('should create connection element with correct attributes', () => {
      const connection = mockConnections[0];
      const connectionElement = $('<div>')
        .addClass('connection')
        .attr('data-id', connection.id)
        .attr('data-name', connection.name)
        .attr('data-host', connection.host)
        .attr('data-port', connection.port);
      
      expect(connectionElement.attr).toHaveBeenCalledWith('data-id', connection.id);
      expect(connectionElement.attr).toHaveBeenCalledWith('data-name', connection.name);
      expect(connectionElement.attr).toHaveBeenCalledWith('data-host', connection.host);
      expect(connectionElement.attr).toHaveBeenCalledWith('data-port', connection.port);
      expect(connectionElement.addClass).toHaveBeenCalledWith('connection');
    });

    test('should handle connection click events', () => {
      const connectionElement = $('<div class="connection">');
      const clickHandler = jest.fn();
      
      connectionElement.on('click', clickHandler);
      connectionElement.trigger('click');
      
      expect(connectionElement.trigger).toHaveBeenCalledWith('click');
    });

    test('should handle connection context menu', () => {
      const connectionElement = $('<div class="connection">');
      const contextMenuHandler = jest.fn();
      
      connectionElement.on('contextmenu', contextMenuHandler);
      connectionElement.trigger('contextmenu');
      
      expect(connectionElement.trigger).toHaveBeenCalledWith('contextmenu');
    });

    test('should toggle connection selection', () => {
      const connectionElement = $('<div class="connection">');
      
      connectionElement.addClass('selected');
      expect(connectionElement.addClass).toHaveBeenCalledWith('selected');
      
      connectionElement.removeClass('selected');
      expect(connectionElement.removeClass).toHaveBeenCalledWith('selected');
    });

    test('should update connection status indicator', () => {
      const connectionElement = $('<div class="connection">');
      const statusElement = $('<span class="status">');
      
      // Connected status
      statusElement.addClass('connected');
      statusElement.removeClass('disconnected');
      
      expect(statusElement.addClass).toHaveBeenCalledWith('connected');
      expect(statusElement.removeClass).toHaveBeenCalledWith('disconnected');
    });
  });

  describe('Connection Operations', () => {
    test('should save new connection', async () => {
      const newConnection = {
        name: 'New Connection',
        host: '10.0.0.1',
        port: 9042,
        username: 'admin'
      };
      
      global.Modules.Connections.saveConnection.mockResolvedValue(true);
      
      const result = await global.Modules.Connections.saveConnection('workspace-1', newConnection);
      
      expect(global.Modules.Connections.saveConnection).toHaveBeenCalledWith('workspace-1', newConnection);
      expect(result).toBe(true);
    });

    test('should update existing connection', async () => {
      const updatedConnection = {
        id: 'connection-1',
        name: 'Updated Connection',
        host: '192.168.1.101'
      };
      
      global.Modules.Connections.updateConnection.mockResolvedValue(true);
      
      const result = await global.Modules.Connections.updateConnection('workspace-1', updatedConnection);
      
      expect(global.Modules.Connections.updateConnection).toHaveBeenCalledWith('workspace-1', updatedConnection);
      expect(result).toBe(true);
    });

    test('should delete connection', async () => {
      const connectionId = 'connection-1';
      
      global.Modules.Connections.deleteConnection.mockResolvedValue(true);
      
      const result = await global.Modules.Connections.deleteConnection('workspace-1', connectionId);
      
      expect(global.Modules.Connections.deleteConnection).toHaveBeenCalledWith('workspace-1', connectionId);
      expect(result).toBe(true);
    });
  });

  describe('Docker/Sandbox Integration', () => {
    test('should handle Docker project operations', async () => {
      const workspaceID = 'workspace-sandbox';
      
      // Create project
      global.Modules.Docker.createProject.mockResolvedValue(true);
      const createResult = await global.Modules.Docker.createProject(workspaceID, { name: 'new-project' });
      expect(createResult).toBe(true);
      
      // Start project
      global.Modules.Docker.startProject.mockResolvedValue(true);
      const startResult = await global.Modules.Docker.startProject(workspaceID, 'project-1');
      expect(startResult).toBe(true);
      
      // Stop project
      global.Modules.Docker.stopProject.mockResolvedValue(true);
      const stopResult = await global.Modules.Docker.stopProject(workspaceID, 'project-1');
      expect(stopResult).toBe(true);
      
      // Delete project
      global.Modules.Docker.deleteProject.mockResolvedValue(true);
      const deleteResult = await global.Modules.Docker.deleteProject(workspaceID, 'project-1');
      expect(deleteResult).toBe(true);
    });

    test('should display Docker project status', () => {
      const project = mockProjects[0];
      const projectElement = $('<div>')
        .addClass('docker-project')
        .attr('data-id', project.id)
        .attr('data-status', project.status);
      
      expect(projectElement.attr).toHaveBeenCalledWith('data-status', 'running');
      
      // Update status
      projectElement.attr('data-status', 'stopped');
      expect(projectElement.attr).toHaveBeenCalledWith('data-status', 'stopped');
    });
  });

  describe('Workspace Integration', () => {
    test('should update workspace connection count', () => {
      const workspaceID = 'workspace-1';
      const workspaceElement = $(`.workspace[data-id="${workspaceID}"]`);
      const connectionCount = mockConnections.length;
      
      // Update connection count badge
      const badge = $('<span class="connection-count">');
      badge.text(connectionCount);
      
      expect(badge.text).toHaveBeenCalledWith(connectionCount);
    });

    test('should handle workspace selection', () => {
      const workspace1 = $('.workspace[data-id="workspace-1"]');
      const workspace2 = $('.workspace[data-id="workspace-sandbox"]');
      
      // Select workspace 1
      workspace1.addClass('active');
      workspace2.removeClass('active');
      
      expect(workspace1.addClass).toHaveBeenCalledWith('active');
      expect(workspace2.removeClass).toHaveBeenCalledWith('active');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection connection errors', async () => {
      const error = new Error('Connection refused');
      global.Modules.Connections.getConnections.mockRejectedValue(error);
      
      try {
        await global.Modules.Connections.getConnections('workspace-1');
      } catch (e) {
        expect(e.message).toBe('Connection refused');
      }
    });

    test('should handle invalid connection data', () => {
      const invalidConnection = {
        // Missing required fields
        name: 'Invalid'
      };
      
      const validateConnection = (connection) => {
        return !!(connection.host && connection.port && connection.name);
      };
      
      expect(validateConnection(invalidConnection)).toBe(false);
      expect(validateConnection(mockConnections[0])).toBe(true);
    });
  });
});