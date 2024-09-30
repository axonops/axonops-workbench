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
 * This file is for `Hightlight.js` Node module
 * It describes the structure of the `cql` language
 */

function cql(hljs) {
  const regex = hljs.regex

  const COMMENT_MODE = hljs.COMMENT('--', '//')

  const STRING = {
    className: 'string',
    variants: [{
      begin: /'/,
      end: /'/,
      contains: [{
        begin: /''/
      }]
    }]
  }

  const QUOTED_IDENTIFIER = {
    begin: /"/,
    end: /"/,
    contains: [{
      begin: /""/
    }]
  }

  const LITERALS = [
    "true",
    "false",
    "null",
    "on",
    "off"
  ]

  const TYPES = [
    'ascii', 'bigint', 'blob', 'boolean', 'counter', 'date', 'decimal', 'double', 'duration', 'float', 'inet', 'int', 'smallint', 'time', 'timestamp', 'timeuuid', 'tinyint', 'uuid', 'varint', 'list', 'map', 'set', 'frozen', 'tuple', 'frozen<list>', 'frozen<map>', 'frozen<set>', 'materialized view', 'static', 'counter column', 'primary key'
  ]

  const RESERVED_WORDS = [
    'add', 'aggregate', 'all', 'alter', 'analyze', 'and', 'apply', 'as', 'ascii', 'batch', 'begin', 'bigint', 'blob', 'boolean', 'by', 'columnfamily', 'contains', 'create', 'delete', 'desc', 'describe', 'distinct', 'double', 'drop', 'expand', 'filtering', 'from', 'grant', 'group', 'having', 'if', 'in', 'increment', 'insert', 'int', 'keyspace', 'keyspaces', 'tables', 'limit', 'list', 'map', 'materialized', 'modify', 'order', 'primary', 'revoke', 'select', 'set', 'static', 'table', 'text', 'timeuuid', 'timestamp', 'truncate', 'uuid', 'varint', 'where', 'with', 'using', 'tracing', 'consistency', 'frozen', 'counter', 'on', 'off', 'like', 'then', 'else', 'when', 'case', 'end', 'returning'
  ]

  const RESERVED_FUNCTIONS = [
    'count', 'sum', 'avg', 'min', 'max', 'abs', 'ceil', 'floor', 'round', 'concat', 'lower', 'upper', 'substring', 'trim', 'now', 'dateof', 'to_timestamp', 'extract', 'to_date', 'uuid', 'timeuuid'
  ]

  const COMBOS = [
    'create keyspace', 'create table', 'create index', 'create view', 'create function', 'create aggregate', 'create type', 'create trigger', 'create materialized view', 'alter keyspace', 'alter table', 'alter index', 'alter view', 'alter function', 'alter aggregate', 'alter type', 'alter trigger', 'drop keyspace', 'drop table', 'drop index', 'drop view', 'drop function', 'drop aggregate', 'drop type', 'drop trigger', 'drop materialized view', 'select from', 'insert into', 'update set', 'delete from', 'batch insert', 'batch update', 'use keyspace', 'describe table', 'list indexes', 'tracing on', 'tracing off', 'expand on', 'expand off', 'consistency level'
  ]

  const FUNCTIONS = RESERVED_FUNCTIONS

  const KEYWORDS = [
    ...RESERVED_WORDS,
  ].filter((keyword) => !RESERVED_FUNCTIONS.includes(keyword))

  const VARIABLE = {
    className: "variable",
    begin: /@[a-z0-9][a-z0-9_]*/,
  }

  const OPERATOR = {
    className: "operator",
    begin: /[-+*/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?/,
    relevance: 0,
  }

  const FUNCTION_CALL = {
    begin: regex.concat(/\b/, regex.either(...FUNCTIONS), /\s*\(/),
    relevance: 0,
    keywords: {
      built_in: FUNCTIONS
    }
  }

  function reduceRelevancy(list, {
    exceptions,
    when
  } = {}) {
    const qualifyFn = when
    exceptions = exceptions || []
    return list.map((item) => {
      if (item.match(/\|\d+$/) || exceptions.includes(item)) {
        return item
      } else if (qualifyFn(item)) {
        return `${item}|0`
      } else {
        return item
      }
    })
  }

  return {
    name: 'cql',
    case_insensitive: true,
    illegal: /[{}]|<\//,
    keywords: {
      $pattern: /\b[\w\.]+/,
      keyword: reduceRelevancy(KEYWORDS, {
        when: (x) => x.length < 3
      }),
      literal: LITERALS,
      type: TYPES
    },
    contains: [{
        begin: regex.either(...COMBOS),
        relevance: 0,
        keywords: {
          $pattern: /[\w\.]+/,
          keyword: KEYWORDS.concat(COMBOS),
          literal: LITERALS,
          type: TYPES
        },
      },
      FUNCTION_CALL,
      VARIABLE,
      STRING,
      QUOTED_IDENTIFIER,
      hljs.C_NUMBER_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      COMMENT_MODE,
      OPERATOR
    ]
  }
}

module.exports = cql
