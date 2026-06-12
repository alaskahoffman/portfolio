package main

import (
	"log"
	"net/http"
	"os"

	"archwebsite/api"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Starting server on port %s", port)
	log.Printf("Visit http://localhost:%s", port)
	log.Printf("Available routes:")
	log.Printf("  - http://localhost:%s/ (homepage)", port)
	log.Printf("  - http://localhost:%s/poetry (all poems)", port)
	log.Printf("  - http://localhost:%s/boma (Boma story)", port)
	log.Printf("  - http://localhost:%s/search?q=query (search)", port)
	
	http.HandleFunc("/", api.Handler)
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

