# Custom module to print the metadata of the current, connected to, cluster
from os import path
import tempfile


def __getTableKeys(table_keys, columns=False):
    keys = []
    for key in table_keys:
        try:
            temp = {}
            if columns:
                for info in ["name", "cql_type", "is_static", "is_reversed"]:
                    try:
                        temp[info] = key.info
                    except:
                        try:
                            temp[info] = getattr(key[1], info)
                        except:
                            pass
            else:
                if isinstance(key, str):
                    temp = key
                else:
                    temp["name"] = key.name
                    temp["cql_type"] = key.cql_type
                    temp["is_static"] = key.is_static
                    temp["is_reversed"] = key.is_reversed
            keys.append(temp)
        except:
            pass
    return keys


def __getTableColumns(table_columns):
    keys = __getTableKeys(table_columns.items(), True)
    return keys


def __getIndexes(metadata_indexes):
    indexes = []
    for index in metadata_indexes:
        try:
            temp = {}
            index_obj = metadata_indexes[index]
            temp = {}
            temp["name"] = index_obj.name
            temp["kind"] = index_obj.kind
            indexes.append(temp)
        except:
            pass
    return indexes


def __getTableTriggers(table_triggers):
    triggers = []
    for trigger in table_triggers:
        try:
            trigger_obj = table_triggers[trigger]
            temp = {}
            temp["name"] = trigger_obj.name
            triggers.append(temp)
        except:
            pass
    return triggers


def __getViews(metadata_views):
    views = []
    for view in metadata_views:
        try:
            view_obj = metadata_views[view]
            temp = {}
            temp["name"] = view_obj.name
            temp["base_table_name"] = view_obj.base_table_name
            temp["partition_key"] = __getTableKeys(view_obj.partition_key)
            temp["clustering_key"] = __getTableKeys(view_obj.clustering_key)
            temp["columns"] = __getTableColumns(view_obj.columns)
            temp["include_all_columns"] = view_obj.include_all_columns
            temp["where_clause"] = view_obj.where_clause
            views.append(temp)
        except:
            pass
    return views


def __getKeyspaceTables(keyspace_tables):
    tables = []

    # Loop through tables
    for table in keyspace_tables:
        try:
            table_obj = keyspace_tables[table]
            temp = {}
            temp["primary_key"] = __getTableKeys(table_obj.primary_key)
            temp["is_cql_compatible"] = table_obj.is_cql_compatible
            temp["name"] = table_obj.name
            temp["partition_key"] = __getTableKeys(table_obj.partition_key)
            temp["clustering_key"] = __getTableKeys(table_obj.clustering_key)
            temp["columns"] = __getTableColumns(table_obj.columns)
            temp["indexes"] = __getIndexes(table_obj.indexes)
            temp["triggers"] = __getTableTriggers(table_obj.triggers)
            temp["views"] = __getViews(table_obj.views)
            temp["virtual"] = table_obj.virtual
            temp["options"] = {}
            for option in table_obj.options:
                temp["options"][option] = table_obj.options[option]

                if option in ["caching", "compaction", "compression"]:
                    try:
                        temp["options"][option] = {}
                        for sub_option in table_obj.options[option]:
                            temp["options"][option][sub_option] = table_obj.options[option][sub_option]
                    except:
                        pass
            tables.append(temp)
        except:
            pass
    return tables


def __getKeyspaceUserTypes(keyspace_user_types):
    user_types = []
    try:
        user_types_names = list(keyspace_user_types.keys())
        for user_type_name in user_types_names:
            try:
                user_type = keyspace_user_types[user_type_name]
                temp = {
                    "name": user_type.name,
                    "field_names": user_type.field_names,
                    "field_types": user_type.field_types,
                }
                user_types.append(temp)
            except:
                pass
    except:
        pass
    return user_types


def __getKeyspaceFunctions(keyspace_functions):
    functions = []
    for function in keyspace_functions:
        try:
            function_obj = keyspace_functions[function]
            temp = {
                "name": function_obj.name,
                "argument_types": function_obj.argument_types,
                "argument_names": function_obj.argument_names,
                "return_type": function_obj.return_type,
                "language": function_obj.language,
                "body": function_obj.body,
                "called_on_null_input": function_obj.called_on_null_input,
                "deterministic": function_obj.deterministic,
                "monotonic": function_obj.monotonic,
                "monotonic_on": function_obj.monotonic_on,
            }
            functions.append(temp)
        except:
            pass
    return functions


def __getKeyspaceAggregates(keyspace_aggregates):
    aggregates = []
    for aggregate in keyspace_aggregates:
        try:
            aggregate_obj = keyspace_aggregates[aggregate]
            temp = {
                "name": aggregate_obj.name,
                "argument_types": aggregate_obj.argument_types,
                "state_func": aggregate_obj.state_func,
                "state_type": aggregate_obj.state_type,
                "final_func": aggregate_obj.final_func,
                "initial_condition": aggregate_obj.initial_condition,
                "return_type": aggregate_obj.return_type,
                "deterministic": aggregate_obj.deterministic,
            }
            aggregates.append(temp)
        except:
            pass
    return aggregates


def __getKeyspaceViews(keyspace_views):
    views = []
    for view in keyspace_views:
        try:
            temp = {"name": view.name}

            views.append(temp)
        except:
            pass
    return views


def printMetadata(session):
    final_metadata = {}
    try:
        final_metadata["cluster_name"] = session.cluster.metadata.cluster_name
        final_metadata["partitioner"] = session.cluster.metadata.partitioner
        final_metadata["dbaas"] = session.cluster.metadata.dbaas
        final_metadata["keyspaces"] = []

        keyspaces = session.cluster.metadata.keyspaces

        for keyspace in keyspaces:
            keyspace_obj = session.cluster.metadata.keyspaces[keyspace]
            temp = {}
            temp["virtual"] = keyspace_obj.virtual
            temp["name"] = keyspace_obj.name
            temp["durable_writes"] = keyspace_obj.durable_writes
            temp["tables"] = __getKeyspaceTables(keyspace_obj.tables)
            temp["indexes"] = __getIndexes(keyspace_obj.indexes)
            temp["user_types"] = __getKeyspaceUserTypes(keyspace_obj.user_types)
            temp["functions"] = __getKeyspaceFunctions(keyspace_obj.functions)
            temp["aggregates"] = __getKeyspaceAggregates(keyspace_obj.aggregates)
            temp["views"] = __getViews(keyspace_obj.views)
            final_metadata["keyspaces"].append(temp)
    finally:
        return final_metadata


def printMetadataBackground(id, session):
    metadata = printMetadata(session)
    file_name = path.join(tempfile.gettempdir(), f"{id}.metadata")
    file = open(file_name, "w")
    file.write(f"{metadata}")
    file.close()
