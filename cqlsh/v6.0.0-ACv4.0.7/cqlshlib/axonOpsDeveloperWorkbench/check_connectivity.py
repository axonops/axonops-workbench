# Custom module to check the connectivity with the current cluster/node
from os import path
import tempfile

def checkConnectivityBackground(id, session):
    # By default, we're not conencted with the node
    connected = False
    try:
        # If this statement exeucted with success then we're connected
        check = session.execute("select now() from system.local")

        # Update the flag
        connected = True
    except:
        pass
    
    # Write the check result in a file
    file_name = path.join(tempfile.gettempdir(), f"{id}.checkconn")
    file = open(file_name,"w")
    file.write(f"{connected}")
    file.close()