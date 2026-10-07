// Moltech — tabela periódica interativa.
//
// Uso:
//
//	go run .                  sobe o servidor em http://localhost:8080
//	go run . -addr :3000      escolhe outra porta
//	go run . -export dist     gera o site estático na pasta dist/
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"moltech/internal/site"
)

func main() {
	addr := flag.String("addr", ":8080", "endereço em que o servidor escuta")
	export := flag.String("export", "", "gera o site estático nesta pasta e encerra")
	flag.Parse()

	s, err := site.New()
	if err != nil {
		log.Fatal(err)
	}

	if *export != "" {
		if err := s.Export(*export); err != nil {
			log.Fatal(err)
		}
		log.Printf("site estático gerado em %s/", *export)
		return
	}

	srv := &http.Server{
		Addr:              *addr,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Ctrl+C: para de aceitar conexões e espera as que estão em andamento.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		fim, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(fim)
	}()

	log.Printf("Moltech em http://localhost%s", *addr)
	err = srv.ListenAndServe()
	if errors.Is(err, syscall.EADDRINUSE) {
		log.Fatalf("a porta %s já está em uso. Outro Moltech ainda está rodando? Feche-o com Ctrl+C ou use outra porta: go run . -addr :8081", *addr)
	}
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
