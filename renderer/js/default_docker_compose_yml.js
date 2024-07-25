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

const DockerYAML = `version: "3.8"

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.12
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - 'ES_JAVA_OPTS=-Xms256m -Xmx256m'
    volumes:
      - elasticsearch:/var/lib/elasticsearch
    healthcheck:
      test: ["CMD", "curl", "-sSf", "127.0.0.1:9200"]
      interval: 10s
      timeout: 5s
      start_period: 30s
      retries: 50
  axon-server:
    depends_on:
      elasticsearch:
        condition: service_healthy
    image: registry.axonops.com/axonops-public/axonops-docker/axon-server:latest
    environment:
      - ELASTIC_HOSTS=http://elasticsearch:9200
    healthcheck:
      test: ["CMD", "curl", "-sf", "127.0.0.1:8080"]
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
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && /usr/share/axonops/axon-dash --appimage-extract-and-run"
    ports:
      - {axonopsPort}:3000
    healthcheck:
      test: ["CMD", "curl", "-sf", "127.0.0.1:3000"]
      interval: 10s
      timeout: 5s
      start_period: 10s
      retries: 5

  cassandra-0:
    image: registry.axonops.com/axonops-public/axonops-docker/cassandra:{version}
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
      - CASSANDRA_NATIVE_TRANSPORT_PORT=9042
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
      - AXON_AGENT_SERVER_HOST=axon-server
      - AXON_AGENT_SERVER_PORT=1888
      - AXON_AGENT_ORG=sandbox
      - AXON_AGENT_TLS_MODE=none
      - AXON_AGENT_LOG_OUTPUT=file
    ports:
      - "{cassandraPort}:9042"
    healthcheck:
      test: ["CMD", "nc", "-z", "127.0.0.1", "9042"]
      interval: 10s
      timeout: 5s
      retries: 50
      start_period: 60s

  cassandra-1:
    depends_on:
      cassandra-0:
        condition: service_healthy
    image: registry.axonops.com/axonops-public/axonops-docker/cassandra:{version}
    hostname: cassandra-1
    restart: unless-stopped
    volumes:
      - cassandra-1:/var/lib/cassandra
    environment:
      - CASSANDRA_CLUSTER_NAME=sandbox-cluster
      - CASSANDRA_SEEDS=cassandra-0
      - CASSANDRA_ENDPOINT_SNITCH=GossipingPropertyFileSnitch
      - CASSANDRA_DC=dc1
      - CASSANDRA_RACK=rack1
      - CASSANDRA_BROADCAST_RPC_ADDRESS=127.0.0.1
      - CASSANDRA_NATIVE_TRANSPORT_PORT=9043
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
      - AXON_AGENT_SERVER_HOST=axon-server
      - AXON_AGENT_SERVER_PORT=1888
      - AXON_AGENT_ORG=sandbox
      - AXON_AGENT_TLS_MODE=none
      - AXON_AGENT_LOG_OUTPUT=file
    ports:
      - "9043:9043"
    healthcheck:
      test: ["CMD", "nc", "-z", "127.0.0.1", "9043"]
      interval: 10s
      timeout: 5s
      retries: 50
      start_period: 60s

  cassandra-2:
    depends_on:
      cassandra-1:
        condition: service_healthy
    image: registry.axonops.com/axonops-public/axonops-docker/cassandra:{version}
    hostname: cassandra-2
    restart: unless-stopped
    volumes:
      - cassandra-2:/var/lib/cassandra
    environment:
      - CASSANDRA_CLUSTER_NAME=sandbox-cluster
      - CASSANDRA_SEEDS=cassandra-0
      - CASSANDRA_ENDPOINT_SNITCH=GossipingPropertyFileSnitch
      - CASSANDRA_DC=dc1
      - CASSANDRA_RACK=rack2
      - CASSANDRA_BROADCAST_RPC_ADDRESS=127.0.0.1
      - CASSANDRA_NATIVE_TRANSPORT_PORT=9044
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
      - AXON_AGENT_SERVER_HOST=axon-server
      - AXON_AGENT_SERVER_PORT=1888
      - AXON_AGENT_ORG=sandbox
      - AXON_AGENT_TLS_MODE=none
      - AXON_AGENT_LOG_OUTPUT=file
    ports:
      - "9044:9044"
    healthcheck:
      test: ["CMD", "nc", "-z", "127.0.0.1", "9044"]
      interval: 10s
      timeout: 5s
      retries: 50
      start_period: 60s

volumes:
  elasticsearch:
  cassandra-0:
  cassandra-1:
  cassandra-2:`

module.exports = {
  DockerYAML
}
