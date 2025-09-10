
# Commands to prepare architecture
## full graph (no module):
go run ./cmd/archmap

##  focused (module by short name or full module path), radius 2:
go run ./cmd/archmap --module=drg --radius=2

##  pick a branch/ref and ignore some paths:
go run ./cmd/archmap --ref=develop --ignore=archived,sandbox