storage "file" {
  path = "/vault/file"
}

# storage "raft" {
#   path    = "/vault/data"
#   node_id = "raft_node_1"
# }

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

disable_mlock = true
ui = true
# cluster_addr = "http://127.0.0.1:8201"
# api_addr     = "http://127.0.0.1:8200"

