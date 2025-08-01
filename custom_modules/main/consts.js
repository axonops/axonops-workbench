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
 * This module has the important constants that are used in the entire app - main and renderer threads -
 *
 * Define all constants
 */
const Constants = {
  // When set to `false`, the AI assistant will be completely hidden in the UI, and no way to interact with it
  EnableAIAssistant: true,
  AxonOpsIntegration: {
    DefaultURL: `https://dash.axonops.cloud`,
    Patterns: {
      Cluster: '{ORG}/cassandra/{CLUSTERNAME}/deeplink/dashboard/cluster',
      Keyspace: '{ORG}/cassandra/{CLUSTERNAME}/deeplink/dashboard/keyspace?keyspace={KEYSPACENAME}',
      Table: '{ORG}/cassandra/{CLUSTERNAME}/deeplink/dashboard/keyspace?keyspace={KEYSPACENAME}&table={TABLENAME}',
    }
  },
  URLS: {
    Workbench: 'https://github.com/axonops/axonops-workbench',
    Binaries: 'https://github.com/axonops/axonops-workbench-cqlsh',
    // The host server where the AI assistant's Python project is running
    AIAssistantServer: 'https://ai.axonops.cloud/chat',
    /**
     * A server that accepts the crash reports' POST requests
     * The crash reporter project is hosted on GitHub
     */
    CrashHandlerServer: 'http://127.0.0.1:55155/set/crash'
  },
  // Default `cqlsh.rc` file's content
  CQLSHRC: require(Path.join(__dirname, '..', '..', 'renderer', 'js', 'default_cqlshrc.js')).CQLSHRC,
  // Default `docker-compose.yml` content
  DockerComposeYAML: require(Path.join(__dirname, '..', '..', 'renderer', 'js', 'default_docker_compose_yml.js')).DockerYAML,
  // Define sensitive data to be checked inside the `cqlsh.rc` content
  SensitiveData: ['username', 'password', 'credentials'],
  // Allowed HTML tags to be rendered in the localization process
  AllowedHTMLTags: ['b', 'code', 'kbd', 'br', 'ul', 'li'],
  /**
   * Define CQL keywords
   *
   * From:
   * https://github.com/apache/cassandra/blob/trunk/src/resources/org/apache/cassandra/cql3/reserved_keywords.txt
   */
  CQLKeywords: ['ADD', 'ALLOW', 'ALTER', 'AND', 'APPLY', 'ASC', 'AUTHORIZE', 'BATCH', 'BEGIN', 'BY', 'COLUMNFAMILY', 'CREATE', 'DELETE', 'DESC', 'DROP', 'ENTRIES', 'EXECUTE', 'FROM', 'FULL', 'GRANT', 'IF', 'IN', 'INDEX', 'INFINITY', 'INSERT', 'INTO', 'IS', 'KEYSPACE', 'LIMIT', 'MATERIALIZED', 'MODIFY', 'NAN', 'NORECURSIVE', 'NOT', 'NULL', 'OF', 'ON', 'OR', 'ORDER', 'PRIMARY', 'RENAME', 'REVOKE', 'SCHEMA', 'SELECT', 'SET', 'TABLE', 'TO', 'TOKEN', 'TRUNCATE', 'UNLOGGED', 'UPDATE', 'USE', 'USING', 'VIEW', 'WHERE', 'WITH', 'FILTERING'],
  TableDefaultMetadata: {
    '5.0': [{
        name: 'additional_write_policy',
        value: '99p'
      },
      {
        name: 'bloom_filter_fp_chance',
        value: '0.01'
      },
      {
        name: 'caching',
        value: '{"keys": "ALL", "rows_per_partition": "NONE"}'
      },
      {
        name: 'comment',
        value: ''
      },
      {
        name: 'compaction',
        value: '{"class": "org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy", "max_threshold": "32", "min_threshold": "4"}'
      },
      {
        name: 'compression',
        value: '{"chunk_length_in_kb": "16", "class": "org.apache.cassandra.io.compress.LZ4Compressor"}'
      },
      {
        name: 'crc_check_chance',
        value: '1.0'
      },
      {
        name: 'default_time_to_live',
        value: '0'
      },
      {
        name: 'gc_grace_seconds',
        value: '864000'
      },
      {
        name: 'max_index_interval',
        value: '2048'
      },
      {
        name: 'memtable_flush_period_in_ms',
        value: '0'
      },
      {
        name: 'min_index_interval',
        value: '128'
      },
      {
        name: 'read_repair',
        value: 'BLOCKING'
      },
      {
        name: 'speculative_retry',
        value: '99p'
      }
    ],
    '4.1': [{
        name: 'additional_write_policy',
        value: '99p'
      },
      {
        name: 'bloom_filter_fp_chance',
        value: '0.01'
      },
      {
        name: 'caching',
        value: '{"keys": "ALL", "rows_per_partition": "NONE"}'
      },
      {
        name: 'comment',
        value: ''
      },
      {
        name: 'compaction',
        value: '{"class": "org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy", "max_threshold": "32", "min_threshold": "4"}'
      },
      {
        name: 'compression',
        value: '{"chunk_length_in_kb": "16", "class": "org.apache.cassandra.io.compress.LZ4Compressor"}'
      },
      {
        name: 'crc_check_chance',
        value: '1.0'
      },
      {
        name: 'default_time_to_live',
        value: '0'
      },
      {
        name: 'gc_grace_seconds',
        value: '864000'
      },
      {
        name: 'max_index_interval',
        value: '2048'
      },
      {
        name: 'memtable_flush_period_in_ms',
        value: '0'
      },
      {
        name: 'min_index_interval',
        value: '128'
      },
      {
        name: 'read_repair',
        value: 'BLOCKING'
      },
      {
        name: 'speculative_retry',
        value: '99p'
      }
    ],
    '4.0': [{
        name: 'additional_write_policy',
        value: '99p'
      },
      {
        name: 'bloom_filter_fp_chance',
        value: '0.01'
      },
      {
        name: 'caching',
        value: '{"keys": "ALL", "rows_per_partition": "NONE"}'
      },
      {
        name: 'comment',
        value: ''
      },
      {
        name: 'compaction',
        value: '{"class": "org.apache.cassandra.db.compaction.SizeTieredCompactionStrategy", "max_threshold": "32", "min_threshold": "4"}'
      },
      {
        name: 'compression',
        value: '{"chunk_length_in_kb": "16", "class": "org.apache.cassandra.io.compress.LZ4Compressor"}'
      },
      {
        name: 'crc_check_chance',
        value: '1.0'
      },
      {
        name: 'default_time_to_live',
        value: '0'
      },
      {
        name: 'gc_grace_seconds',
        value: '864000'
      },
      {
        name: 'max_index_interval',
        value: '2048'
      },
      {
        name: 'memtable_flush_period_in_ms',
        value: '0'
      },
      {
        name: 'min_index_interval',
        value: '128'
      },
      {
        name: 'read_repair',
        value: 'BLOCKING'
      },
      {
        name: 'speculative_retry',
        value: '99p'
      }
    ]
  },
  /**
   * Define the CQLSH commands
   *
   * From:
   * https://docs.datastax.com/en/cql-oss/3.1/cql/cql_reference/cqlshCommandsTOC.html
   */
  CQLSHCommands: ['CAPTURE', 'CONSISTENCY', 'SERIAL', 'COPY', 'DESC', 'DESCRIBE', 'EXPAND', 'EXIT', 'PAGING', 'SHOW', 'SOURCE', 'TRACING'],
  ConsistencyLevels: {
    Regular: ['ANY', 'LOCAL_ONE', 'ONE', 'TWO', 'THREE', 'QUORUM', 'LOCAL_QUORUM', 'EACH_QUORUM', 'ALL'],
    Serial: ['SERIAL', 'LOCAL_SERIAL']
  },
  // List of Cassandra system's keyspaces
  CassandraSystemKeyspaces: ['system', 'system_auth', 'system_distributed', 'system_schema', 'system_traces'],
  // All possible patterns where keyspaces should be suggested
  CQLRegexPatterns: {
    Alter: {
      Basic: /^\s*ALTER/i,
      Patterns: [
        /^\s*ALTER\s+KEYSPACE\s+\S*(?!.)/i,
        /^\s*ALTER\s+MATERIALIZED\s+VIEW\s+\S*(?!.)/i,
        /^\s*ALTER\s+TABLE\s+(\w+)?\S*(?!.)/i
      ]
    },
    Create: {
      Basic: /^\s*CREATE/i,
      Patterns: [
        /^\s*CREATE(\s+OR\s+REPLACE)?\s+AGGREGATE(\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\S*(?!.)/i,
        /^\s*CREATE\s+(CUSTOM\s+)?INDEX(\s+IF\s+NOT\s+EXISTS)?\s*(\w+)?\s+ON\s+(\w+)?\S*(?!.)/i,
        /^\s*CREATE(\s+OR\s+REPLACE)?\s+FUNCTION(\s+IF\s+NOT\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*CREATE\s+MATERIALIZED\s+VIEW(\s+IF\s+NOT\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*CREATE\s+TABLE(\s+IF\s+NOT\s+EXISTS)?\s+(\w+)?\S*(?!.)/i,
        /^\s*CREATE\s+TRIGGER\s+(\w+)\s+ON\s+\S*(?!.)/i,
        /^\s*CREATE\s+TYPE(\s+IF\s+NOT\s+EXISTS)?\s+\S*(?!.)/i
      ]
    },
    Delete: {
      Basic: /^\s*DELETE/i,
      Patterns: [
        /^\s*DELETE\s*.*?\s+FROM\s+(\w+)?\S*(?!.)/i
      ]
    },
    Drop: {
      Basic: /^\s*DROP/i,
      Patterns: [
        /^\s*DROP\s+AGGREGATE(\s+IF\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*DROP\s+FUNCTION(\s+IF\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*DROP\s+INDEX(\s+IF\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*DROP\s+KEYSPACE(\s+IF\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*DROP\s+MATERIALIZED\s+VIEW(\s+IF\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*DROP\s+TABLE(\s+IF\s+EXISTS)?\s+\S*(?!.)/i,
        /^\s*DROP\s+TRIGGER(\s+IF\s+EXISTS)?\s+(\w+)\s+ON\s+\S*(?!.)/i,
        /^\s*DROP\s+TYPE(\s+IF\s+EXISTS)?\s+(\w+)\S*(?!.)/i
      ]
    },
    Insert: {
      Basic: /^\s*INSERT/i,
      Patterns: [
        /^\s*INSERT\s+INTO\s+(\w+)?\S*(?!.)/i
      ]
    },
    Select: {
      Basic: /^\s*SELECT/i,
      Patterns: [
        /^\s*SELECT\s*.*?\s+FROM\s+(\w+)?\S*(?!.)/i
      ]
    },
    Truncate: {
      Basic: /^\s*TRUNCATE/i,
      Patterns: [
        /^\s*TRUNCATE(\s+TABLE)?\s+(\w+)\S*(?!.)/i
      ]
    },
    Update: {
      Basic: /^\s*UPDATE/i,
      Patterns: [
        /^\s*UPDATE\s+(\w+)?\S*(?!.)/i
      ]
    },
    Use: {
      Basic: /^\s*USE/i,
      Patterns: [
        /^\s*USE\s+\S*(?!.)/i
      ]
    },
    Desc: {
      Basic: /^\s*(DESC|DESCRIBE)/i,
      Patterns: [
        /^\s*(DESC|DESCRIBE)\s*.*?\s+KEYSPACE\s+(\w+)?\S*(?!.)/i,
        /^\s*(DESC|DESCRIBE)\s+\S*(?!.)/i
      ]
    }
  },
  // This array will be updated with +500 extensions using `text-extensions` modules
  SupportedTextFilesExtenstions: ['sql', 'cql'],
  // The legal notice shown in the intro view and CLI mode
  LegalNotice: `AxonOps is a registered trademark of AxonOps Limited. Apache, Apache Cassandra, Cassandra, Apache Spark, Spark, Apache TinkerPop, TinkerPop, Apache Kafka and Kafka are either registered trademarks or trademarks of the Apache Software Foundation (<span class="link"><span class="content">http://www.apache.org/</span></span>) or its subsidiaries in Canada, the United States and/or other countries. Elasticsearch is a trademark of Elasticsearch B.V., registered in the U.S. and in other countries. DataStax is registered trademarks of DataStax, Inc. and its subsidiaries in the United States and/or other countries. Docker is a trademark or registered trademark of Docker, Inc. in the United States and/or other countries`
}

module.exports = Constants
