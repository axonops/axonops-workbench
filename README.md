<div align="center">
  <img src="renderer/assets/images/axonops-icon-512x512.png" alt="AxonOps Workbench Icon" width="128">

  # AxonOps Workbench

  **Purpose-Built Database Management Desktop App for Apache Cassandra®**

  [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
  [![GitHub Issues](https://img.shields.io/github/issues/axonops/axonops-workbench)](https://github.com/axonops/axonops-workbench/issues)
  [![GitHub Discussions](https://img.shields.io/github/discussions/axonops/axonops-workbench)](https://github.com/axonops/axonops-workbench/discussions)
  [![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://axonops.com/workbench/download/)

  [🚀 Download](https://axonops.com/workbench/download/) | [📚 Documentation](https://docs.axonops.com/) | [💬 Discussions](https://github.com/axonops/axonops-workbench/discussions/categories/ideas) | [🐛 Issues](https://github.com/axonops/axonops-workbench/issues/new/choose)
</div>

## 🚀 Overview

[AxonOps Workbench](https://axonops.com/workbench/) is a **powerful, free, and open-source** desktop application designed specifically for Cassandra developers and DBAs. Experience a revolutionary way to work with your distributed databases through an intuitive interface packed with advanced features.

<div align="center">

  ### 🎁 100% Free & Open Source
  **No hidden costs • No premium tiers • No license keys**

  Community-driven development with full transparency

</div>

### 🔗 Supported Databases
- **[Apache Cassandra®](https://cassandra.apache.org/)** - The leading open-source distributed database
- **[DataStax™ Enterprise](https://www.datastax.com/products/datastax-enterprise)** - Enterprise-ready Cassandra distribution
- **[DataStax™ Astra DB](https://www.datastax.com/products/datastax-astra)** - Serverless Cassandra-as-a-Service

### ✨ Why AxonOps Workbench?

- 🎯 **Cassandra-Native Design** - Engineered specifically for Cassandra's unique architecture and workflows
- 🛠️ **Developer-Friendly** - Intuitive interface with powerful productivity features
- 🔒 **Secure by Design** - Built-in SSH tunneling and credential management
- 🏃 **Local Development** - Spin up local Cassandra clusters with one click
- 📊 **Advanced Analytics** - Deep query tracing and performance insights
- 🌍 **Cross-Platform** - Available for macOS, Windows, and Linux

## ⚡ Quick Start

1. **Download & Install** - Get AxonOps Workbench from [axonops.com/workbench/download](https://axonops.com/workbench/download/)
2. **Set up Podman or Docker** - Required for running local clusters only
3. **Create a Workspace** - Organize your clusters and connections
4. **Connect to Cassandra** - Support for Apache Cassandra, DataStax Enterprise, and Astra DB
5. **Start Exploring** - Use the CQL console and query tracing

---

## 🎯 Key Features at a Glance

<div align="center">

| Feature | Description |
|---------|-------------|
| 🖥️ **CQL Console** | Advanced editor with syntax highlighting, auto-completion |
| 🔍 **Query Tracing** | Deep performance analysis with execution plans and bottleneck detection |
| 🏃 **Local Clusters** | Spin up Cassandra clusters instantly with Docker/Podman integration |
| 🔒 **SSH Tunneling** | Secure remote connections without external tools |
| 📁 **Workspaces** | Organize and share cluster configurations via source control |
| 🌍 **Multi-Language** | Available in English, Spanish, French, Arabic, Chinese, and more |
| ⌨️ **Command Line Interface** | Powerful CLI for automation and launching CQLSH on the command line using workspace connections |

</div>

---

## 📥 Download and Install

### 🎯 Recommended Installation

You can download a specific release from project [releases](https://github.com/axonops/axonops-workbench/releases), for the best experience we recommend downloading stable releases of AxonOps Workbench directly from our website:

<div align="center">

  **[⬇️ Download](https://axonops.com/workbench/download/)**

  Available for macOS, Windows, and Linux
</div>

### 🍺 Homebrew (macOS)

For macOS users, you can also install AxonOps Workbench using [Homebrew](https://brew.sh/):

```sh
# Optional: set applications directory to your $HOME
export HOMEBREW_CASK_OPTS="--appdir=~/Applications"
brew tap axonops/homebrew-repository
brew install --cask axonopsworkbench
```

If you'd like to use a `beta` release use instead

```sh
brew install --cask axonopsworkbench-beta
```

and for the daily internal builds (used for testing and development purposes) use

```sh
brew install --cask axonopsworkbench-internal
```

## 🐳 Docker or Podman Requirements for running Local Clusters

**IMPORTANT - YOU ONLY NEED THIS TO DEPLOY CLUSTERS LOCALLY ON YOUR MACHINE, NOT TO USE THE APP.**

To run local Cassandra clusters using AxonOps Workbench, you'll need either Docker or Podman installed with the Compose plugin. Recent versions of both include Compose by default.

### Setup Instructions
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/)
2. Ensure the Compose plugin is available
3. AxonOps Workbench will automatically detect installations in standard paths
4. For custom installations, configure paths in application settings

<img width="864" alt="Docker Settings" src="https://github.com/user-attachments/assets/3696af51-2f13-44eb-956a-7b8751c8abd9" />

## 🎨 Features Showcase

### 📝 Enhanced CQL Console
Experience the most advanced CQL editor with syntax highlighting, auto-completion, query history, and multi-tab support.

![Enhanced_CQL_Console](https://github.com/user-attachments/assets/225cc8f3-d1e7-493c-bd73-b8186baa404d)

### 🔍 Advanced Query Tracing
Deep dive into query performance with detailed tracing, execution plans, and bottleneck identification.

![Advanced_query_tracing](https://github.com/user-attachments/assets/346cbdc4-60f2-4482-9a57-874919a4f711)

### 📁 Workspace Management
Organize your clusters into workspaces and securely share configurations through source control.

<img width="1678" alt="Screenshot 2024-08-23 at 10 07 50" src="https://github.com/user-attachments/assets/42be7bd5-6fa6-4881-8c30-42ab96c2ae45">

### 🏃 Local Cluster Management
Spin up local Cassandra clusters instantly for development and testing with just one click.

<img width="1699" alt="Screenshot 2024-08-23 at 10 13 16" src="https://github.com/user-attachments/assets/0d3cdfe9-4266-4254-b9d1-54d90d7cbdfe">

### 🔒 Built-in SSH Tunneling
Connect securely to remote clusters through SSH tunnels without external tools or complex configurations.

<img width="981" alt="Screenshot 2024-08-23 at 07 50 46" src="https://github.com/user-attachments/assets/d26aee76-c34a-4495-a89b-85896e2590e5">

### ⌨️ Command Line Interface
Automate your workflow with powerful CLI commands for workspace and connection management, perfect for CI/CD pipelines and server environments.

[📚 View Complete CLI Documentation](docs/cli.md)

### 🚀 Additional Features

- **🔐 Secure Credential Management** - Store and manage connection credentials securely in your system keychain
- **📊 Schema Visualization** *(Coming Soon)* - Visual representation of keyspaces, tables, and relationships
- **🎯 Smart Auto-completion** - Context-aware CQL suggestions and table/column name completion
- **📝 Query History** - Access and search through your previously executed queries
- **🔄 Import/Export** - Export query results to CSV, JSON, or other formats
- **🌐 Multi-cluster Support** - Connect to multiple clusters simultaneously with easy switching
- **🌍 Internationalization** - Available in multiple languages including English, Spanish, French, Arabic, Chinese, and more
- **⚡ Performance Metrics** Real-time cluster health and performance monitoring via AxonOps
- **🔧 Table Operations** - Visual tools for creating, altering, and managing tables
- **📁 Data Import/Export** - Bulk data operations with progress tracking
- **🔍 Full-text Search** - Search across your entire cluster metadata

## 📋 Software Bill of Materials (SBOM)

This project provides Software Bill of Materials (SBOM) files with each release, offering transparency into our software components and dependencies. SBOMs help users and organizations understand exactly what components are included in our software, enabling better security and compliance management.

### Available SBOM Formats
- **CycloneDX** (`sbom.cyclonedx.json`): A lightweight SBOM standard that provides detailed component information and security context
- **SPDX** (`sbom.spdx.json`): A comprehensive format focusing on software licensing and component identification

### Benefits of Our SBOM
- 🛡️ **Security**: Easily identify and track known vulnerabilities in dependencies
- 📜 **Compliance**: Verify license obligations for all included components
- 🔍 **Transparency**: Clear visibility into the software supply chain
- ⚡ **Risk Management**: Better understand and assess potential risks in the software stack

You can find our SBOM files in each [release](https://github.com/axonops/axonops-workbench/releases) as part of the release artifacts. These files are automatically generated during our build process to ensure they remain current with each release.

### Using SBOM Files
1. Download the SBOM file in your preferred format from the release assets
2. Use SBOM analysis tools:
   - `cyclonedx-cli` for CycloneDX files
   - `spdx-tools` for SPDX files
3. Integrate with your security and compliance workflows
4. Monitor for vulnerabilities in included components

We maintain these SBOM files as part of our commitment to software supply chain security and transparency. They are updated with each release to reflect the current state of our software dependencies.

## 🛠️ Development

Want to contribute or run AxonOps Workbench in development mode? Follow these instructions:

### 📋 Requirements

- Node.js >= 20.15.0
- pnpm >= 10.7.0
- Python >= 3.12

### 🚀 Installation & Running

1. Clone this repository
   ```sh
   git clone https://github.com/axonops/axonops-workbench.git
   cd axonops-workbench
   ```

2. Install Python dependencies
   ```sh
   pip3 install -r requirements.txt
   ```

3. Install required tools (downloads CQLSH binaries from [axonops-workbench-cqlsh](https://github.com/axonops/axonops-workbench-cqlsh/releases/latest))
   ```sh
   ./tools/install_tools.sh
   ```

4. Install Node.js dependencies
   ```sh
   pnpm i
   ```

5. Run in development mode
   ```sh
   pnpm start
   ```

### 🧪 Testing

AxonOps Workbench includes a comprehensive test suite. See our [Testing Guide](TESTING.md) for detailed information on:

- Running unit tests
- Writing new tests
- Test architecture and best practices
- Continuous integration setup

Quick test commands:
```sh
# Run all tests
pnpm test

# Run tests with coverage report
pnpm run test:coverage

# Run tests in watch mode (for development)
pnpm run test:watch
```

### 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting pull requests. The guide covers:

- Code of conduct and community guidelines
- Development workflow and branching strategy
- Coding standards and best practices
- How to submit bug reports and feature requests
- Pull request process and review guidelines
- License agreements and legal requirements

Key points for contributors:
- Fork the repository and create feature branches from `main`
- Follow the existing code style and conventions
- Write tests for new features and bug fixes
- Update documentation as needed
- Sign our [Contributor License Agreement (CLA)](CLA.md) by following the bot instructions on your first PR
- All contributors must sign the CLA before their PRs can be merged

### 🐛 Debugging

- Set `AXONOPS_DEV_TOOLS=true` environment variable to open developer tools on startup
- In VSCode, use the `Main + Renderer` compound launch configuration to debug both processes simultaneously

### 📦 Packaging

If you'd like to create your own distribution package, you will need to install `electron-builder` and then run the following:

```sh
# builds linux deb, rpm and tar.gz
pnpm run linux
# OSX dmg and zip
pnpm run mac
# windows
pnpm run win
```

See the `packages.json` for other build options.

### 🧹 Cleaning Up Between Development Builds

Development builds may not be backwards compatible. Clean up as follows:

#### 🐧 Linux and macOS:
1. Delete folders with prefix `.axonops-` in the home folder
2. Remove all keys with prefix `AxonOps` from the OS Keychain

#### 🪟 Windows:
1. Delete the folder with prefix `axonops-` in `C:\Users\{username}`
2. Delete the folder with prefix `AxonOps` in `C:\Users\{username}\AppData\Roaming` or `%appData%`
3. Remove all credentials with prefix `AxonOps` from Windows Credential Manager
4. In Registry Editor, navigate to `Computer\HKEY_LOCAL_MACHINE\SOFTWARE\AxonOpsWorkbenchClustersSecrets` (or `AxonOpsDeveloperWorkbenchClustersSecrets`) and delete the entire key/folder

## 🙏 Acknowledgements

AxonOps Workbench builds upon the foundation laid by several open-source projects, particularly Apache Cassandra. We extend our sincere gratitude to the Apache Cassandra community for their outstanding work and contributions to the field of distributed databases.

Apache Cassandra is a free and open-source, distributed, wide-column store, NoSQL database management system designed to handle large amounts of data across many commodity servers, providing high availability with no single point of failure.

### Apache Cassandra Resources

- **Official Website**: [cassandra.apache.org](https://cassandra.apache.org/)
- **Source Code**: Available on [GitHub](https://github.com/apache/cassandra) or the Apache Git repository at `gitbox.apache.org/repos/asf/cassandra.git`
- **Documentation**: Comprehensive guides and references available at the [Apache Cassandra website](https://cassandra.apache.org/)

AxonOps Workbench incorporates and extends functionality from various Cassandra tools and utilities, enhancing them to provide a seamless desktop experience for Cassandra DB developers and DBAs.

We encourage users to explore and contribute to the main Apache Cassandra project, as well as to provide feedback and suggestions for AxonOps Workbench through our [GitHub discussions](https://github.com/axonops/axonops-workbench/discussions/categories/ideas) and [issues](https://github.com/axonops/axonops-workbench/issues/new/choose) pages.

## 💬 Community & Support

### Get Involved
- 💡 **Share Ideas**: Visit our [GitHub Discussions](https://github.com/axonops/axonops-workbench/discussions/categories/ideas) to propose new features
- 🐛 **Report Issues**: Found a bug? [Open an issue](https://github.com/axonops/axonops-workbench/issues/new/choose)
- 🤝 **Contribute**: We welcome pull requests! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
- ⭐ **Star Us**: If you find AxonOps Workbench useful, please star our repository!

### Stay Connected
- 🌐 **Website**: [axonops.com](https://axonops.com)
- 📧 **Contact**: Visit our website for support options

## 📊 Download Statistics

We track download statistics from this Github project for all AxonOps Workbench releases to better understand usage patterns and platform adoption. These reports are automatically generated weekly via the Github public APIs and provide insights into:

- **Total Downloads**: Overall download counts across all releases
- **Platform Distribution**: Downloads broken down by Windows, macOS, and Linux
- **Release Adoption**: How quickly new releases are being adopted
- **Latest Release Performance**: Detailed statistics for the most recent release

### 📈 View Reports

- **[Latest Download Report](reports/latest.md)** - View the most recent weekly statistics
- **[All Reports](reports/)** - Browse historical download reports

These reports help us:
- Understand which platforms need more focus
- Track the success of new releases
- Make data-driven decisions about feature development
- Ensure we're meeting our community's needs

***

## 📄 Legal Notices

*This project may contain trademarks or logos for projects, products, or services. Any use of third-party trademarks or logos are subject to those third-party's policies.*

- **AxonOps** is a registered trademark of AxonOps Limited.
- **Apache**, **Apache Cassandra**, **Cassandra**, **Apache Spark**, **Spark**, **Apache TinkerPop**, **TinkerPop**, **Apache Kafka** and **Kafka** are either registered trademarks or trademarks of the Apache Software Foundation or its subsidiaries in Canada, the United States and/or other countries.
- **DataStax** is a registered trademark of DataStax, Inc. and its subsidiaries in the United States and/or other countries.
- **Elasticsearch** is a trademark of Elasticsearch B.V., registered in the U.S. and in other countries.
- **Docker** is a trademark or registered trademark of Docker, Inc. in the United States and/or other countries.
