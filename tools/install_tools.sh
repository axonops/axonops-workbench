#!/bin/bash

CQLSH_BUILD_VERSION="0.14.3"
CQLSH_GITHUB_URL='https://github.com/axonops/axonops-workbench-cqlsh/releases/download'

mkdir -p main/bin
for binary in cqlsh keys_generator; do
    curl -fL ${CQLSH_GITHUB_URL}/${CQLSH_BUILD_VERSION}/${binary}-$(uname -s)-$(uname -m).tar | tar xf - -C main/bin

    mv main/bin/${binary}-$(uname -s)-$(uname -m) main/bin/${binary}
    mv main/bin/${binary}/${binary}-$(uname -s)-$(uname -m) main/bin/${binary}/${binary}
done
