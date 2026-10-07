# Moltech — atalhos. Rode `make` para ver a lista.
.PHONY: ajuda rodar testar exportar compilar limpar

ajuda:
	@echo "make rodar     - sobe o servidor em http://localhost:8080"
	@echo "make testar    - roda os testes"
	@echo "make exportar  - gera o site estatico em docs/ (GitHub Pages)"
	@echo "make compilar  - gera o executavel bin/moltech"
	@echo "make limpar    - apaga bin/"

rodar:
	go run .

testar:
	go vet ./...
	go test ./...

exportar:
	go run . -export docs

compilar:
	go build -o bin/moltech .

limpar:
	rm -rf bin
