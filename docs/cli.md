# AxonOps Workbench Command Line Interface (CLI)

The AxonOps Workbench CLI provides a powerful command-line interface that can be enabled by passing supported arguments while calling the workbench from CMD/Terminal.

## 🚀 Getting Started

From terminal/CMD, start the AxonOps Workbench and pass one or more of the following supported arguments. The workbench will automatically switch to CLI mode, otherwise the regular GUI mode will be started as usual.

```bash
./axonops-workbench -v # CLI Mode!
./axonops-workbench # Regular GUI Mode
```

## 📋 Supported Arguments

```
  --help, -h                                         > Print all supported      
                                                     arguments.                 
                                                                                
                                                                                
  --version, -v                                      > Print the current        
                                                     version of AxonOps         
                                                     Workbench.                 
                                                                                
                                                                                
  --list-workspaces                                  > List all saved           
                                                     workspaces in the          
                                                     workbench without their    
                                                     connections.               
                                                                                
                                                                                
  --list-connections Str: Workspace ID               > List all saved           
                                                     connections in a specific  
                                                     workspace by passing its   
                                                     ID.                        
                                                                                
                                                                                
  --import-workspace Str: JSON or File/Folder Path   > Import a workspace by    
                                                     either:                    
                                                     >> Directly passing a JSON 
                                                     string containing          
                                                     specific data - see the    
                                                     Readme file -.             
                                                     >> Passing an absolute     
                                                     path of a file containing  
                                                     a valid JSON string - see  
                                                     the Readme file -.         
                                                     >> Passing an absolute     
                                                     path of a single workspace 
                                                     folder, or a folder        
                                                     contains multiple          
                                                     workspaces folders - one   
                                                     depth level -, the import  
                                                     process will also import   
                                                     the connections. Note: The 
                                                     Workbench will import all  
                                                     connections without        
                                                     specification, if there's  
                                                     a name duplication         
                                                     regarding the workspace    
                                                     name the process will be   
                                                     terminated.                
                                                                                
                                                                                
  --copy-to-default                                  > For import-workspace     
                                                     argument, if the value is  
                                                     a folder path, the         
                                                     workspace will be copied   
                                                     to the default data        
                                                     directory. Without this    
                                                     argument, the import       
                                                     process detects workspaces 
                                                     and leaves them in the     
                                                     original path.             
                                                                                
                                                                                
  --import-connection Str: JSON File Path            > Import a connection by   
                                                     passing an absolute path   
                                                     of a file containing a     
                                                     valid JSON string. Note:   
                                                     this action supports       
                                                     passing SSH tunnel info in 
                                                     a specific format, and a   
                                                     cqlsh.rc file path,        
                                                     however, username and      
                                                     password should be passed  
                                                     within the JSON string, if 
                                                     they exist in the cqlsh    
                                                     config file they will be   
                                                     ignored.                   
                                                                                
                                                                                
  --json                                             > For list-workspaces,     
                                                     list-connections, import-  
                                                     workspace and import-      
                                                     connections arguments, the 
                                                     output will be a JSON      
                                                     object or an array of JSON 
                                                     items (as a string)        
                                                     instead of a formatted     
                                                     text.                      
                                                                                
                                                                                
  --delete-file                                      > For import-workspace and 
                                                     import-connection          
                                                     arguments, it deletes the  
                                                     provided file - or folder  
                                                     - after successful import. 
                                                     Note: If import-workspace  
                                                     is given a folder path     
                                                     then the deletion request  
                                                     will be ignored.           
                                                                                
                                                                                
  --test-connection Bool: true or false              > For import-connection    
                                                     argument, test the         
                                                     connection about to be     
                                                     imported before finalizing 
                                                     the import process,        
                                                     passing it with true value 
                                                     will stop the importing    
                                                     process in case the        
                                                     connection has failed,     
                                                     otherwise, passing it      
                                                     without specifying a value 
                                                     or with false value will   
                                                     not stop the importing     
                                                     process, in both cases a   
                                                     feedback will be printed.  
                                                                                
                                                                                
  --connect Str: connection ID                       > Connect directly to a    
                                                     saved connection and start 
                                                     a cqlsh session by         
                                                     passing its ID.
```

## 📁 JSON Structure

### Workspace

```json
{
    "name":"",
    "color": "",
    "defaultPath": "",
    "path": ""
}
```

- `name` (Mandatory): The workspace's unique name, in case of duplication or invalidation a feedback will be shown.
- `color` (Optional): The workspace's dominant color, passed value can be any color format (HEX, RGB, HSL, etc..).
- `defaultPath` (Optional): Whether or not workspace's main folder (data) should be in the default path or not, accepted value is either `true` or `false`, it's `false` by default.
- `path` (Optional): An absolute path to create workspace's main folder (data) in it, to make the Workbench takes this attribute into account `defaultPath` attribute must be provided with `false` value.
  This JSON structure can be passed directly, for example:
  
  ```bash
  --import-workspace='{"name":"test"}'
  ```
  
  And it also can be in file, and the absolute path to this file is passed, for example:
  
  ```bash
  --import-workspace='/path/to/file'
  ```
  
  In addition, a folder path can be passed, which presents a single workspace folder or a folder that contains one or more workspace folders.
  
  ```bash
  --import-workspace='/path/to/folder/'
  ```
  
  `--delete-file` argument can be passed alongside this argument, it'll delete the passed JSON file in case the importing process has been finished with success.`--copy-to-default` argument can also be passed; if the value is a folder path, the workspace will be copied to the default data directory. Without this argument, the import process detects workspaces and leaves them in the original path.
  
  ### Connection
  
  #### Apache Cassandra
  
  ```json
  {
    "basic": {
        "workspace_id": "",
        "name": "",
        "datacenter": "",
        "hostname": "",
        "port": "",
        "timestamp_generator": "",
        "cqlshrc": ""
    },
    "auth": {
        "username": "",
        "password": ""
    },
    "ssl": {
        "ssl": "",
        "certfile": "",
        "userkey": "",
        "usercert": "",
        "validate": ""
    },
    "ssh": {
        "host": "",
        "port": "",
        "username": "",
        "password": "",
        "privatekey": "",
        "passphrase": "",
        "destaddr": "",
        "destport": ""
    }
  }
  ```
  
- Only `workspace_id`, `name` and `hostname` attributes are mandatory, all other attributes are optional.
- `basic`.
  - `workspace_id`: The ID of the workspace which the connection will be imported to.
  - `name`: The name of the connection, must be unique within the scope of the passed workspace.
  - `datacenter`: Specify a data center to be set when activating the connection.
  - `hostname`: Host/IP to Cassandra node.
  - `port`: Connection port, it's `9042` by default.
  - `cqlshrc`: Absolute path to a valid `cqlsh.rc` file.
- `auth`.
  - `username`: Apache Cassandra authentication username.
  - `password`: Apache Cassandra authentication password.
- `ssl`.
  - `ssl`: Enable SSL/TLS connection.
  - `certfile`: Path to CA certificate file.
  - `userkey`: Path to user key file.
  - `usercert`: Path to user certificate file.
  - `validate`: Enable certificate validation.
- `ssh`.
  - `host`: SSH tunnel host.
  - `port`: SSH tunnel port.
  - `username`: SSH username.
  - `password`: SSH password.
  - `privatekey`: Path to SSH private key.
  - `passphrase`: SSH key passphrase.
  - `destaddr`: Destination address for tunnel.
  - `destport`: Destination port for tunnel.
    
    #### Astra DB
    
    ```json
    {
    "workspace_id": "",
    "name": "",
    "username": "clientId in AstraDB",
    "password": "secret in AstraDB",
    "scb_path": ""
    }
    ```
    
- All attributes are required/mandatory.
- `username`: Represents `clientId` in AstraDB.
- `password`: Represents `secret` in AstraDB.
- `scb_path`: Absolute path to the secure connection bundle `.zip` file.
  
  ## 🔧 Test Connection
  
- Argument `--test-connection` can be passed alongside this `--import-connection` argument.
- Possible value is either `true` or `false`.
  - `true`: The importing process will be terminated in case the test process has finished with failure.
  - `false`: The importing process will be continued even if the test process has finished with failure.
- Default value is `false`.
  
  ## JSON Output
  
  You can pass the argument `--json` for `list-workspaces`, `list-connections`, `import- workspace`, and `import- connections` arguments; the output will be a JSON object or an array of JSON items (as a string) instead of a formatted text.
  This is useful when you want to link the CLI mode with a script; the output is suitable for parsing and reading.
  
  ## 🚀 Start a Connection and Launch CQLsh
  
- The `--connect` argument launches a full interactive CQLsh command-line session directly from your terminal - no GUI required!
- Simply pass the connection ID to immediately connect to your Cassandra database and enter the CQLsh interactive shell.
- The workbench handles all connection complexity (authentication, SSL, SSH tunnels) automatically before dropping you into the familiar CQLsh prompt.
- Progress will be shown in the terminal, then you'll have full access to execute CQL commands interactively just like using standalone CQLsh.
  
  ### 🐧 Run AxonOps Workbench in Linux Headless Host (no GUI)
  
  In order to use AxonOps Workbench in a headless Linux host, all you need to do is making sure the package `xvfb` is installed, running and exporting a display, it's available for most Linux distributions:
  
  | Distribution | Package Name | Install Command |
  | --- | --- | --- |
  | Ubuntu/Debian | `xvfb` | `sudo apt install xvfb` |
  | RHEL/CentOS | `xorg-x11-server-Xvfb` | `sudo yum install xorg-x11-server-Xvfb` |
  | Arch Linux | `xorg-server-xvfb` | `sudo pacman -S xorg-server-xvfb` |
  | Alpine | `xvfb` (via community) | `apk add xvfb` |
  | Before running the workbench, run this command: |     |     |
  
  ```bash
  Xvfb :99 -screen 0 1280x720x24 & export DISPLAY=:99
  ```
  
  And you're ready to go and run AxonOps Workbench in a headless Linux host!
  
  ## 📚 Examples
  
  ### Import Workspace and Connection
  
  ```bash
  # Import a workspace
  ./axonops-workbench --import-workspace='{"name":"Production", "color":"#FF5733"}'
  # List workspaces to get the ID
  ./axonops-workbench --list-workspaces
  # Import a connection with test
  ./axonops-workbench --import-connection=/path/to/connection.json --test-connection
  # Connect to the database
  ./axonops-workbench --connect="connection-id"
  ```
  
  ### Automated Setup
  
  ```bash
  #!/bin/bash
  # Import workspace from file and delete after success
  ./axonops-workbench --import-workspace=workspace.json --delete-file
  # Import and test connection
  ./axonops-workbench --import-connection=connection.json --test-connection --delete-file
  ```
  
  **NOTE:** When passing a value to an argument, you must use the equals sign (`=`). For example:
  
  ```bash
  ./axonops-workbench --list-connections workspace-0b5d20cb08 # Bad ❌
  ./axonops-workbench --list-connections=workspace-0b5d20cb08 # Good ✅
  ```
  
  ## 🆘 Troubleshooting
  
- If connection import fails, verify all mandatory fields are present in the JSON
- For SSH connections, ensure private key has correct permissions (chmod 600)
- In headless mode, ensure Xvfb is running before starting the workbench
- Use `--test-connection` to validate connections before importing
