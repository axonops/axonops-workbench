const DockerYAML = `version: "3"

services:
  elasticsearch:
    container_name: elasticsearch
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.10
    environment:
      - discovery.type=single-node
      - 'ES_JAVA_OPTS=-Xms256m -Xmx256m'
  axon-server:
    container_name: axon-server
    image: registry.axonops.com/axonops-public/axonops-docker/axon-server:latest
    environment:
      - ELASTIC_HOSTS=http://elasticsearch:9200
  axon-dash:
    container_name: axon-dash
    image: registry.axonops.com/axonops-public/axonops-docker/axon-dash:latest
    command: >
      /bin/sh -c "sed -i 's|private_endpoints.*|private_endpoints: http://axon-server:8080|' /etc/axonops/axon-dash.yml && /usr/share/axonops/axon-dash --appimage-extract-and-run"
    ports:
      - {axonopsPort}:3000

  axon-agent-0:
    container_name: axon-agent-0
    image: registry.axonops.com/axonops-public/axonops-docker/axon-agent:latest
    restart: always
    environment:
       - AXON_AGENT_SERVER_HOST=axon-server
       - AXON_AGENT_SERVER_PORT=1888
       - AXON_AGENT_ORG=demo
       - AXON_AGENT_TLS_MODE=none
    volumes:
      - cassandra-0:/var/lib/cassandra
      - axonops-0:/var/lib/axonops
      - cassandra-logs-0:/opt/cassandra/logs
    command: >
      /bin/sh -c "touch /var/log/axonops/axon-agent.log && /entrypoint.sh"
  cassandra-0:
    container_name: cassandra-0
    image: cassandra:{version}
    ports:
      - {cassandraPort}:9042
    restart: always
    volumes:
      - cassandra-0:/var/lib/cassandra
      - axonops-0:/var/lib/axonops
      - cassandra-logs-0:/opt/cassandra/logs
    environment:
      - JVM_EXTRA_OPTS=-javaagent:/var/lib/axonops/axon-cassandra{version}-agent.jar=/etc/axonops/axon-agent.yml
      - CASSANDRA_CLUSTER_NAME=demo-cluster
      - CASSANDRA_SEEDS=cassandra-0
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
    command: >
      /bin/sh -c "mkdir -p /etc/axonops && echo 'axon-agent:' > /etc/axonops/axon-agent.yml && mkdir -p /var/log/axonops && chown cassandra.cassandra /var/log/axonops && /usr/local/bin/docker-entrypoint.sh cassandra -f"

  axon-agent-1:
    container_name: axon-agent-1
    image: registry.axonops.com/axonops-public/axonops-docker/axon-agent:latest
    restart: always
    environment:
       - AXON_AGENT_SERVER_HOST=axon-server
       - AXON_AGENT_SERVER_PORT=1888
       - AXON_AGENT_ORG=demo
       - AXON_AGENT_TLS_MODE=none
    volumes:
      - cassandra-1:/var/lib/cassandra
      - axonops-1:/var/lib/axonops
      - cassandra-logs-1:/opt/cassandra/logs
    command: >
      /bin/sh -c "touch /var/log/axonops/axon-agent.log && /entrypoint.sh"
  cassandra-1:
    container_name: cassandra-1
    image: cassandra:{version}
    restart: always
    volumes:
      - cassandra-1:/var/lib/cassandra
      - axonops-1:/var/lib/axonops
      - cassandra-logs-1:/opt/cassandra/logs
    environment:
      - JVM_EXTRA_OPTS=-javaagent:/var/lib/axonops/axon-cassandra{version}-agent.jar=/etc/axonops/axon-agent.yml
      - CASSANDRA_CLUSTER_NAME=demo-cluster
      - CASSANDRA_SEEDS=cassandra-0
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
    command: >
      /bin/sh -c "mkdir -p /etc/axonops && echo 'axon-agent:' > /etc/axonops/axon-agent.yml && mkdir -p /var/log/axonops && chown cassandra.cassandra /var/log/axonops && /usr/local/bin/docker-entrypoint.sh cassandra -f"

  axon-agent-2:
    container_name: axon-agent-2
    image: registry.axonops.com/axonops-public/axonops-docker/axon-agent:latest
    restart: always
    environment:
       - AXON_AGENT_SERVER_HOST=axon-server
       - AXON_AGENT_SERVER_PORT=1888
       - AXON_AGENT_ORG=demo
       - AXON_AGENT_TLS_MODE=none
    volumes:
      - cassandra-2:/var/lib/cassandra
      - axonops-2:/var/lib/axonops
      - cassandra-logs-2:/opt/cassandra/logs
    command: >
      /bin/sh -c "touch /var/log/axonops/axon-agent.log && /entrypoint.sh"
  cassandra-2:
    container_name: cassandra-2
    image: cassandra:{version}
    restart: always
    volumes:
      - cassandra-2:/var/lib/cassandra
      - axonops-2:/var/lib/axonops
      - cassandra-logs-2:/opt/cassandra/logs
    environment:
      - JVM_EXTRA_OPTS=-javaagent:/var/lib/axonops/axon-cassandra{version}-agent.jar=/etc/axonops/axon-agent.yml
      - CASSANDRA_CLUSTER_NAME=demo-cluster
      - CASSANDRA_SEEDS=cassandra-0
      - MAX_HEAP_SIZE=256m
      - HEAP_NEWSIZE=50m
    command: >
      /bin/sh -c "mkdir -p /etc/axonops && echo 'axon-agent:' > /etc/axonops/axon-agent.yml && mkdir -p /var/log/axonops && chown cassandra.cassandra /var/log/axonops && /usr/local/bin/docker-entrypoint.sh cassandra -f"

volumes:
  cassandra-0:
  axonops-0:
  cassandra-1:
  axonops-1:
  cassandra-2:
  axonops-2:
  cassandra-logs-0:
  cassandra-logs-1:
  cassandra-logs-2:`

module.exports = {
  DockerYAML
}
