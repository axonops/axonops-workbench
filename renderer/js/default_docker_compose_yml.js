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

const DockerYAML = `version: '3.8'

services:
  opensearch:
    image: opensearchproject/opensearch:2.18.0
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - OPENSEARCH_JAVA_OPTS=-Xms256m -Xmx256m
      - DISABLE_INSTALL_DEMO_CONFIG=true # Prevents execution of bundled demo script which installs demo certificates and security configurations to OpenSearch
      - DISABLE_SECURITY_PLUGIN=true # Disables Security plugin
    volumes:
      - opensearch:/usr/share/opensearch/data
    healthcheck:
      test:
        - CMD
        - curl
        - '-sSf'
        - '-k'
        - 'http://127.0.0.1:9200'
      interval: 10s
      timeout: 5s
      start_period: 30s
      retries: 50
  axon-server:
    depends_on:
      opensearch:
        condition: service_healthy
    image: registry.axonops.com/axonops-public/axonops-docker/axon-server:latest
    pull_policy: always
    environment:
      - SEARCH_DB_HOSTS=http://opensearch:9200
    healthcheck:
      test:
        - CMD
        - curl
        - '-sf'
        - 127.0.0.1:8080
      interval: 10s
      timeout: 5s
      start_period: 10s
      retries: 5
  axon-dash:
    restart: unless-stopped
    depends_on:
      axon-server:
        condition: service_healthy
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    pull_policy: always
    environment:
      - AXONSERVER_PRIVATE_ENDPOINTS=http://axon-server:8080
    ports:
      - '33787:3000'
    healthcheck:
      test:
        - CMD
        - curl
        - '-sf'
        - 127.0.0.1:3000
      interval: 10s
      timeout: 5s
      start_period: 10s
      retries: 5
  cassandra-0:
    image: registry.axonops.com/axonops-public/axonops-docker/cassandra:5.0
    hostname: cassandra-0
    restart: unless-stopped
    volumes:
      - cassandra-0:/var/lib/cassandra
    environment:
      - CASSANDRA_CLUSTER_NAME=sandbox-cluster
      - CASSANDRA_SEEDS=cassandra-0
      - CASSANDRA_ENDPOINT_SNITCH=GossipingPropertyFileSnitch
      - CASSANDRA_DC=dc1
      - CASSANDRA_RACK=rack0
      - CASSANDRA_BROADCAST_RPC_ADDRESS=127.0.0.1
      - CASSANDRA_NATIVE_TRANSPORT_PORT=41773
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
      - AXON_AGENT_SERVER_HOST=axon-server
      - AXON_AGENT_SERVER_PORT=1888
      - AXON_AGENT_ORG=sandbox
      - AXON_AGENT_TLS_MODE=none
      - AXON_AGENT_LOG_OUTPUT=file
    ports:
      - '41773:41773'
    healthcheck:
      test:
        - CMD
        - nc
        - '-z'
        - 127.0.0.1
        - '41773'
      interval: 10s
      timeout: 5s
      retries: 50
      start_period: 60s
volumes:
  opensearch:
  cassandra-0: `

module.exports = {
  DockerYAML
}
