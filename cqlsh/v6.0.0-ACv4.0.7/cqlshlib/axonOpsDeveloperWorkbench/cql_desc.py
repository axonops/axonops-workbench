# Custom module to print the CQL description of an entire cluster, keyspace, or a specific table 
from os import path
import tempfile

def extractTableSchema(full_schema, table_name):
    tables = full_schema.split("CREATE TABLE")
    for table in tables:
        if table_name in table:
            return "CREATE TABLE" + table.split(";")[0] + ";"
    return ""

def printCQLDescBackground(id, scope, session):
    cql_desc = ""
    if scope == "cluster":
        cql_desc = session.cluster.metadata.export_schema_as_string()
    elif scope.startswith("keyspace>"):
        keyspace = scope[len("keyspace>"):]
        if "table>" not in scope:
            cql_desc = session.cluster.metadata.keyspaces[keyspace].export_as_string()
        else:
            keyspace = scope[scope.index("keyspace>")+len("keyspace>"):scope.index("table>")]
            table = scope[scope.index("table>")+len("table>"):]
            keyspace_scheme = session.cluster.metadata.keyspaces[keyspace].export_as_string()
            cql_desc = extractTableSchema(keyspace_scheme, table)

    file_name = path.join(tempfile.gettempdir(), f"{id}.cqldesc")
    file = open(file_name,"w")
    file.write(f"{cql_desc}")
    file.close()
