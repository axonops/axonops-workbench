// Native helper functions to replace lodash
function isPlainObject(obj) {
  return obj != null && typeof obj === 'object' && obj.constructor === Object;
}

function isArray(obj) {
  return Array.isArray(obj);
}

function isObject(obj) {
  return obj != null && typeof obj === 'object';
}

function get(obj, path, defaultValue) {
  if (!obj || typeof path !== 'string') return defaultValue;

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}

function flatten(arr) {
  return arr.reduce((flat, item) => flat.concat(Array.isArray(item) ? flatten(item) : item), []);
}

// Native traverse implementation
function traverse(obj) {
  const headers = {};

  function walk(current, path = [], level = 0) {
    if (current == null) return;

    if (isArray(current)) {
      current.forEach((item, index) => {
        walk(item, [...path, index], level + 1);
      });
    } else if (isPlainObject(current)) {
      Object.keys(current).forEach(key => {
        walk(current[key], [...path, key], level + 1);
      });
    } else {
      // This is a leaf value
      if (path.length > 0) {
        const pathStr = path.slice(1).join('.');
        if (pathStr) {
          headers[pathStr] = true;
        }
      }
    }
  }

  walk(obj);
  return headers;
}

module.exports = function transformJSONToTable(docs, options = {}) {
  options.defaultVal = options.hasOwnProperty('defaultVal') ? options.defaultVal : '';

  if (isPlainObject(docs)) {
    docs = [docs];
  }

  // Get all possible headers from all documents
  let allHeaders = {};

  docs.forEach(doc => {
    function walkObject(obj, path = []) {
      if (obj == null) return;

      if (isArray(obj)) {
        if (options.includeCollectionLength && path.length > 0) {
          allHeaders[`${path.join('.')}.length`] = true;
        }

        if (!options.excludeSubArrays) {
          obj.forEach((item, index) => {
            if (options.listSubArrays && !isPlainObject(item)) {
              if (path.length > 0) {
                allHeaders[path.join('.')] = true;
              }
            } else {
              walkObject(item, [...path, index]);
            }
          });
        }
      } else if (isPlainObject(obj)) {
        if (options.stringifyObjects && path.length === 1) {
          allHeaders[path[path.length - 1]] = true;
        } else if (!options.stringifyObjects) {
          Object.keys(obj).forEach(key => {
            walkObject(obj[key], [...path, key]);
          });
        }
      } else {
        // Leaf value
        if (path.length > 0) {
          let pathStr = path.join('.');
          // Handle special case where path contains dots
          if (path.some(part => part.indexOf('.') > -1) && path.length > 2) {
            pathStr = path.map(part =>
              part.indexOf('.') > -1 ? `\`${part}\`` : part
            ).join('.');
          }
          allHeaders[pathStr] = true;
        }
      }
    }

    walkObject(doc);
  });

  // Convert headers object to array
  const headerArray = Object.keys(allHeaders);

  // Build table data
  let tableData = [headerArray];

  docs.forEach(doc => {
    const row = headerArray.map(header => {
      if (options.stringifyObjects && doc[header]) {
        return isObject(doc[header]) ? JSON.stringify(doc[header]) : doc[header];
      }

      if (options.checkKeyBeforePath && doc[header]) {
        return doc[header];
      }

      if (header.indexOf('.`') > -1) {
        const parts = header.split('.`');
        const head = parts[0].replace(/`/g, '');
        const tail = parts[1].replace(/`/g, '');
        const headObj = get(doc, head, {});
        return headObj[tail];
      }

      return get(doc, header, options.defaultVal);
    });

    tableData.push(row);
  });

  return tableData;
};
