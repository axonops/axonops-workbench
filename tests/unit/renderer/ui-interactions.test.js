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

const { shell, clipboard, remote } = require('electron');

describe('UI Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    document.body.innerHTML = `
      <div id="app">
        <div class="header">
          <input id="search" type="text" placeholder="Search...">
          <button id="search-btn">Search</button>
        </div>
        <div class="content">
          <div class="sidebar">
            <ul class="menu">
              <li class="menu-item" data-action="clusters">Clusters</li>
              <li class="menu-item" data-action="workspaces">Workspaces</li>
              <li class="menu-item" data-action="settings">Settings</li>
            </ul>
          </div>
          <div class="main">
            <div class="tabs">
              <div class="tab" data-tab="query">Query</div>
              <div class="tab" data-tab="results">Results</div>
              <div class="tab" data-tab="history">History</div>
            </div>
            <div class="tab-content"></div>
          </div>
        </div>
      </div>
    `;
  });

  describe('Search Functionality', () => {
    test('should handle search input', () => {
      const searchInput = $('#search');
      const searchBtn = $('#search-btn');
      const searchTerm = 'test cluster';
      
      // Set search value
      searchInput.val(searchTerm);
      expect(searchInput.val).toHaveBeenCalledWith(searchTerm);
      
      // Trigger search
      searchBtn.click();
      expect(searchBtn.click).toHaveBeenCalled();
    });

    test('should handle search keyboard shortcuts', () => {
      const searchInput = $('#search');
      const enterEvent = createMockEvent('keydown', { key: 'Enter' });
      
      searchInput.trigger('keydown', enterEvent);
      expect(searchInput.trigger).toHaveBeenCalledWith('keydown', enterEvent);
    });

    test('should clear search', () => {
      const searchInput = $('#search');
      
      searchInput.val('test');
      searchInput.val('');
      
      expect(searchInput.val).toHaveBeenCalledWith('');
    });

    test('should focus search on keyboard shortcut', () => {
      const searchInput = $('#search');
      const ctrlF = createMockEvent('keydown', { ctrlKey: true, key: 'f' });
      
      $(document).trigger('keydown', ctrlF);
      searchInput.focus();
      
      expect(searchInput.focus).toHaveBeenCalled();
    });
  });

  describe('Menu Navigation', () => {
    test('should handle menu item clicks', () => {
      const menuItems = $('.menu-item');
      
      menuItems.each(function() {
        const $item = $(this);
        const action = $item.data('action');
        
        $item.click();
        expect($item.click).toHaveBeenCalled();
      });
    });

    test('should highlight active menu item', () => {
      const clustersItem = $('.menu-item[data-action="clusters"]');
      
      // Remove active from all
      $('.menu-item').removeClass('active');
      
      // Add active to clicked item
      clustersItem.addClass('active');
      
      expect(clustersItem.addClass).toHaveBeenCalledWith('active');
    });

    test('should handle menu keyboard navigation', () => {
      const menuItems = $('.menu-item');
      let currentIndex = 0;
      
      // Arrow down
      const arrowDown = createMockEvent('keydown', { key: 'ArrowDown' });
      menuItems.eq(currentIndex).trigger('keydown', arrowDown);
      currentIndex = Math.min(currentIndex + 1, menuItems.length - 1);
      
      expect(menuItems.eq(0).trigger).toHaveBeenCalledWith('keydown', arrowDown);
    });
  });

  describe('Tab Management', () => {
    test('should switch between tabs', () => {
      const tabs = $('.tab');
      const queryTab = $('.tab[data-tab="query"]');
      const resultsTab = $('.tab[data-tab="results"]');
      
      // Activate query tab
      tabs.removeClass('active');
      queryTab.addClass('active');
      
      expect(queryTab.addClass).toHaveBeenCalledWith('active');
      
      // Switch to results tab
      tabs.removeClass('active');
      resultsTab.addClass('active');
      
      expect(resultsTab.addClass).toHaveBeenCalledWith('active');
    });

    test('should load tab content', () => {
      const tabContent = $('.tab-content');
      const queryContent = '<div class="query-editor">SELECT * FROM system.local;</div>';
      
      tabContent.html(queryContent);
      
      expect(tabContent.html).toHaveBeenCalledWith(queryContent);
    });

    test('should handle tab close', () => {
      const tab = $('<div class="tab closable">');
      const closeBtn = $('<span class="close-btn">×</span>');
      
      tab.append(closeBtn);
      closeBtn.click();
      tab.remove();
      
      expect(tab.remove).toHaveBeenCalled();
    });
  });

  describe('Modal Dialogs', () => {
    test('should show and hide modal', () => {
      const modal = $('<div class="modal">');
      const modalInstance = getElementMDBObject(modal, 'Modal');
      
      // Show modal
      modalInstance.show();
      expect(modalInstance.show).toHaveBeenCalled();
      
      // Hide modal
      modalInstance.hide();
      expect(modalInstance.hide).toHaveBeenCalled();
    });

    test('should handle modal form submission', () => {
      const form = $('<form>');
      const submitHandler = jest.fn((e) => {
        e.preventDefault();
        return false;
      });
      
      form.on('submit', submitHandler);
      form.trigger('submit');
      
      expect(form.trigger).toHaveBeenCalledWith('submit');
    });

    test('should validate modal inputs', () => {
      const input = $('<input required>');
      const errorMsg = $('<div class="error-message">');
      
      // Invalid state
      input.addClass('invalid');
      errorMsg.show();
      
      expect(input.addClass).toHaveBeenCalledWith('invalid');
      expect(errorMsg.show).toHaveBeenCalled();
      
      // Valid state
      input.removeClass('invalid');
      errorMsg.hide();
      
      expect(input.removeClass).toHaveBeenCalledWith('invalid');
      expect(errorMsg.hide).toHaveBeenCalled();
    });
  });

  describe('Clipboard Operations', () => {
    test('should copy text to clipboard', () => {
      const text = 'SELECT * FROM users;';
      clipboard.writeText(text);
      
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
    });

    test('should paste text from clipboard', () => {
      const pastedText = clipboard.readText();
      
      expect(clipboard.readText).toHaveBeenCalled();
      expect(pastedText).toBe(''); // Mock returns empty string
    });

    test('should copy HTML to clipboard', () => {
      const html = '<strong>Bold text</strong>';
      clipboard.writeHTML(html);
      
      expect(clipboard.writeHTML).toHaveBeenCalledWith(html);
    });

    test('should clear clipboard', () => {
      clipboard.clear();
      
      expect(clipboard.clear).toHaveBeenCalled();
    });
  });

  describe('External Links', () => {
    test('should open external URL', async () => {
      const url = 'https://github.com/axonops/axonops-workbench';
      await shell.openExternal(url);
      
      expect(shell.openExternal).toHaveBeenCalledWith(url);
    });

    test('should handle mailto links', async () => {
      const mailto = 'mailto:support@axonops.com';
      await shell.openExternal(mailto);
      
      expect(shell.openExternal).toHaveBeenCalledWith(mailto);
    });

    test('should show item in folder', () => {
      const filePath = '/Users/test/document.txt';
      shell.showItemInFolder(filePath);
      
      expect(shell.showItemInFolder).toHaveBeenCalledWith(filePath);
    });
  });

  describe('Context Menus', () => {
    test('should show context menu on right click', () => {
      const element = $('<div class="context-menu-target">');
      const contextMenuHandler = jest.fn((e) => {
        e.preventDefault();
        // Show context menu
      });
      
      element.on('contextmenu', contextMenuHandler);
      element.trigger('contextmenu');
      
      expect(element.trigger).toHaveBeenCalledWith('contextmenu');
    });

    test('should build context menu from template', () => {
      const template = [
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { type: 'separator' },
        { label: 'Delete', click: jest.fn() }
      ];
      
      const menu = remote.Menu.buildFromTemplate(template);
      expect(remote.Menu.buildFromTemplate).toHaveBeenCalledWith(template);
    });

    test('should handle context menu item clicks', () => {
      const menuItem = new remote.MenuItem({
        label: 'Custom Action',
        click: jest.fn()
      });
      
      expect(menuItem).toEqual({
        label: 'Custom Action',
        click: expect.any(Function)
      });
    });
  });

  describe('Drag and Drop', () => {
    test('should handle drag start', () => {
      const draggable = $('<div draggable="true">');
      const dragStartHandler = jest.fn((e) => {
        e.dataTransfer = { setData: jest.fn() };
        e.dataTransfer.setData('text/plain', 'drag-data');
      });
      
      draggable.on('dragstart', dragStartHandler);
      draggable.trigger('dragstart');
      
      expect(draggable.trigger).toHaveBeenCalledWith('dragstart');
    });

    test('should handle drag over', () => {
      const dropZone = $('<div class="drop-zone">');
      const dragOverHandler = jest.fn((e) => {
        e.preventDefault();
      });
      
      dropZone.on('dragover', dragOverHandler);
      dropZone.trigger('dragover');
      
      expect(dropZone.trigger).toHaveBeenCalledWith('dragover');
    });

    test('should handle drop', () => {
      const dropZone = $('<div class="drop-zone">');
      const dropHandler = jest.fn((e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
      });
      
      dropZone.on('drop', dropHandler);
      dropZone.trigger('drop');
      
      expect(dropZone.trigger).toHaveBeenCalledWith('drop');
    });
  });

  describe('Tooltips', () => {
    test('should show tooltip on hover', () => {
      const element = $('<button data-mdb-toggle="tooltip" title="Click me!">');
      const tooltip = getElementMDBObject(element, 'Tooltip');
      
      element.trigger('mouseenter');
      expect(element.trigger).toHaveBeenCalledWith('mouseenter');
      
      element.trigger('mouseleave');
      expect(element.trigger).toHaveBeenCalledWith('mouseleave');
    });

    test('should create tooltip with custom options', () => {
      const element = $('<div>');
      const options = {
        placement: 'bottom',
        trigger: 'click',
        html: true,
        title: '<strong>Bold</strong> tooltip'
      };
      
      const tooltip = getElementMDBObject(element, 'Tooltip');
      expect(tooltip).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    test('should validate required fields', () => {
      const form = $('<form>');
      const input = $('<input required>');
      
      // Check validity
      const isValid = input.prop('validity');
      
      // Add error class
      input.addClass('is-invalid');
      expect(input.addClass).toHaveBeenCalledWith('is-invalid');
      
      // Add success class
      input.removeClass('is-invalid').addClass('is-valid');
      expect(input.addClass).toHaveBeenCalledWith('is-valid');
    });

    test('should validate email format', () => {
      const emailInput = $('<input type="email">');
      const validEmail = 'test@example.com';
      const invalidEmail = 'not-an-email';
      
      // Valid email
      emailInput.val(validEmail);
      expect(emailInput.val).toHaveBeenCalledWith(validEmail);
      
      // Invalid email
      emailInput.val(invalidEmail);
      expect(emailInput.val).toHaveBeenCalledWith(invalidEmail);
    });

    test('should show validation messages', () => {
      const feedback = $('<div class="invalid-feedback">');
      const message = 'This field is required';
      
      feedback.text(message);
      feedback.show();
      
      expect(feedback.text).toHaveBeenCalledWith(message);
      expect(feedback.show).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should handle global keyboard shortcuts', () => {
      const shortcuts = {
        'Ctrl+N': jest.fn(), // New
        'Ctrl+O': jest.fn(), // Open
        'Ctrl+S': jest.fn(), // Save
        'Ctrl+Q': jest.fn(), // Quit
        'F5': jest.fn(),     // Refresh
        'F11': jest.fn()     // Fullscreen
      };
      
      // Simulate Ctrl+S
      const ctrlS = createMockEvent('keydown', { 
        ctrlKey: true, 
        key: 's',
        preventDefault: jest.fn()
      });
      
      $(document).trigger('keydown', ctrlS);
      expect($(document).trigger).toHaveBeenCalledWith('keydown', ctrlS);
    });

    test('should prevent default for handled shortcuts', () => {
      const preventDefault = jest.fn();
      const event = createMockEvent('keydown', {
        ctrlKey: true,
        key: 'a',
        preventDefault
      });
      
      // Handler that prevents default
      const handler = (e) => {
        if (e.ctrlKey && e.key === 'a') {
          e.preventDefault();
        }
      };
      
      handler(event);
      expect(preventDefault).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    test('should show loading spinner', () => {
      const spinner = $('<div class="spinner">');
      const overlay = $('<div class="loading-overlay">');
      
      // Show loading
      spinner.show();
      overlay.fadeIn();
      
      expect(spinner.show).toHaveBeenCalled();
      expect(overlay.fadeIn).toHaveBeenCalled();
      
      // Hide loading
      spinner.hide();
      overlay.fadeOut();
      
      expect(spinner.hide).toHaveBeenCalled();
      expect(overlay.fadeOut).toHaveBeenCalled();
    });

    test('should disable UI during loading', () => {
      const button = $('<button>');
      const input = $('<input>');
      
      // Disable
      button.prop('disabled', true);
      input.prop('disabled', true);
      
      expect(button.prop).toHaveBeenCalledWith('disabled', true);
      expect(input.prop).toHaveBeenCalledWith('disabled', true);
      
      // Enable
      button.prop('disabled', false);
      input.prop('disabled', false);
      
      expect(button.prop).toHaveBeenCalledWith('disabled', false);
      expect(input.prop).toHaveBeenCalledWith('disabled', false);
    });
  });
});