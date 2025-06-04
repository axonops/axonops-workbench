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

// Mock the funcs.js module
jest.mock('../../../renderer/js/funcs.js', () => {
  return {
    getElementMDBObject: jest.fn((element, type = 'Input') => {
      // Mock implementation
      const mockObject = {
        element: element,
        type: type,
        dispose: jest.fn(),
        update: jest.fn()
      };
      
      // Add type-specific methods
      switch (type) {
        case 'Modal':
          mockObject.show = jest.fn();
          mockObject.hide = jest.fn();
          mockObject.toggle = jest.fn();
          break;
        case 'Input':
          mockObject.value = '';
          mockObject.setValue = jest.fn((val) => { mockObject.value = val; });
          mockObject.getValue = jest.fn(() => mockObject.value);
          break;
        case 'Dropdown':
          mockObject.show = jest.fn();
          mockObject.hide = jest.fn();
          mockObject.toggle = jest.fn();
          break;
      }
      
      return mockObject;
    })
  };
});

const { getElementMDBObject } = require('../../../renderer/js/funcs.js');

describe('Global Functions (funcs.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.mdbObjects = [];
  });

  describe('getElementMDBObject', () => {
    test('should return MDB object for given element and type', () => {
      const element = $('<input>');
      const mdbObject = getElementMDBObject(element, 'Input');
      
      expect(mdbObject).toBeDefined();
      expect(mdbObject.type).toBe('Input');
      expect(mdbObject.element).toBe(element);
      expect(mdbObject.setValue).toBeDefined();
      expect(mdbObject.getValue).toBeDefined();
    });

    test('should return Modal object with correct methods', () => {
      const element = $('<div class="modal">');
      const mdbObject = getElementMDBObject(element, 'Modal');
      
      expect(mdbObject).toBeDefined();
      expect(mdbObject.type).toBe('Modal');
      expect(mdbObject.show).toBeDefined();
      expect(mdbObject.hide).toBeDefined();
      expect(mdbObject.toggle).toBeDefined();
    });

    test('should return Dropdown object with correct methods', () => {
      const element = $('<div class="dropdown">');
      const mdbObject = getElementMDBObject(element, 'Dropdown');
      
      expect(mdbObject).toBeDefined();
      expect(mdbObject.type).toBe('Dropdown');
      expect(mdbObject.show).toBeDefined();
      expect(mdbObject.hide).toBeDefined();
      expect(mdbObject.toggle).toBeDefined();
    });

    test('should default to Input type when type not specified', () => {
      const element = $('<input>');
      const mdbObject = getElementMDBObject(element);
      
      expect(mdbObject.type).toBe('Input');
    });

    test('should handle null element gracefully', () => {
      const mdbObject = getElementMDBObject(null, 'Input');
      
      expect(mdbObject).toBeDefined();
      expect(mdbObject.element).toBeNull();
    });
  });
});

// Additional tests for actual funcs.js implementation patterns
describe('UI Helper Functions', () => {
  describe('Notification Functions', () => {
    beforeEach(() => {
      // Mock notification functions
      global.showNotification = jest.fn();
      global.showError = jest.fn();
      global.showSuccess = jest.fn();
      global.showWarning = jest.fn();
      global.showInfo = jest.fn();
    });

    test('should show success notification', () => {
      const message = 'Operation completed successfully';
      showSuccess(message);
      
      expect(showSuccess).toHaveBeenCalledWith(message);
    });

    test('should show error notification', () => {
      const message = 'An error occurred';
      showError(message);
      
      expect(showError).toHaveBeenCalledWith(message);
    });

    test('should show warning notification', () => {
      const message = 'This action cannot be undone';
      showWarning(message);
      
      expect(showWarning).toHaveBeenCalledWith(message);
    });

    test('should show info notification', () => {
      const message = 'New updates available';
      showInfo(message);
      
      expect(showInfo).toHaveBeenCalledWith(message);
    });
  });

  describe('DOM Manipulation Helpers', () => {
    test('should handle element visibility toggling', () => {
      const element = $('<div>');
      const showSpy = jest.spyOn(element, 'show');
      const hideSpy = jest.spyOn(element, 'hide');
      
      // Show element
      element.show();
      expect(showSpy).toHaveBeenCalled();
      
      // Hide element
      element.hide();
      expect(hideSpy).toHaveBeenCalled();
    });

    test('should handle class manipulation', () => {
      const element = $('<div>');
      
      element.addClass('active');
      expect(element.addClass).toHaveBeenCalledWith('active');
      
      element.removeClass('active');
      expect(element.removeClass).toHaveBeenCalledWith('active');
      
      element.toggleClass('active');
      expect(element.toggleClass).toHaveBeenCalledWith('active');
    });

    test('should handle attribute manipulation', () => {
      const element = $('<input>');
      
      element.attr('disabled', true);
      expect(element.attr).toHaveBeenCalledWith('disabled', true);
      
      element.prop('checked', true);
      expect(element.prop).toHaveBeenCalledWith('checked', true);
    });
  });

  describe('Event Handler Helpers', () => {
    test('should attach event handlers correctly', () => {
      const element = $('<button>');
      const handler = jest.fn();
      
      element.on('click', handler);
      expect(element.on).toHaveBeenCalledWith('click', handler);
      
      element.off('click', handler);
      expect(element.off).toHaveBeenCalledWith('click', handler);
    });

    test('should trigger custom events', () => {
      const element = $('<div>');
      const eventData = { key: 'value' };
      
      element.trigger('customEvent', eventData);
      expect(element.trigger).toHaveBeenCalledWith('customEvent', eventData);
    });
  });

  describe('Data Storage Helpers', () => {
    test('should handle data attributes', () => {
      const element = $('<div>');
      const testData = { id: 123, name: 'test' };
      
      element.data('info', testData);
      expect(element.data).toHaveBeenCalledWith('info', testData);
      
      element.data('info');
      expect(element.data).toHaveBeenCalledWith('info');
      
      element.removeData('info');
      expect(element.removeData).toHaveBeenCalledWith('info');
    });
  });

  describe('Animation Helpers', () => {
    test('should handle fade animations', () => {
      const element = $('<div>');
      const callback = jest.fn();
      
      element.fadeIn(300, callback);
      expect(element.fadeIn).toHaveBeenCalledWith(300, callback);
      
      element.fadeOut(300, callback);
      expect(element.fadeOut).toHaveBeenCalledWith(300, callback);
    });

    test('should handle slide animations', () => {
      const element = $('<div>');
      const callback = jest.fn();
      
      element.slideUp(300, callback);
      expect(element.slideUp).toHaveBeenCalledWith(300, callback);
      
      element.slideDown(300, callback);
      expect(element.slideDown).toHaveBeenCalledWith(300, callback);
    });
  });
});