# Alaska Hoffman Poetry Website

A Go-based poetry website showcasing Alaska Hoffman's work with search functionality.

## Features

- Homepage with bio
- Poetry archive with individual poem pages
- Search functionality across all poems
- Responsive design with background image
- Static file serving for images and poem data

## Deployment on Vercel

This project is configured for deployment on Vercel:

1. **Connect to Vercel**: Link your GitHub repository to Vercel
2. **Automatic Deployment**: Vercel will automatically detect the Go project and deploy using the `vercel.json` configuration
3. **Static Files**: All static files in the `static/` directory are properly served
4. **Environment**: The app automatically uses Vercel's PORT environment variable

## Local Development

To run locally:

```bash
# Install dependencies (none required for this Go project)
go mod tidy

# Build and run the application
go run main.go data.go
```

The server will start on port 8080 (or the PORT environment variable if set).

## Project Structure

- `main.go` - Main application with HTTP handlers and templates
- `data.go` - Product data (legacy, kept for compatibility)
- `static/` - Static files (images, poem JSON files)
- `static/poems/` - Individual poem JSON files
- `vercel.json` - Vercel deployment configuration

## Routes

- `/` - Homepage with bio
- `/poetry` - All poems listing
- `/poem/{id}` - Individual poem pages
- `/search?q={query}` - Search functionality
- `/static/` - Static file serving

## Poem Data Format

Poems are stored as JSON files in `static/poems/` with the following structure:

```json
{
  "id": 1,
  "title": "Poem Title",
  "date": "YYYY-MM-DD",
  "category": "Category",
  "location": "Location",
  "content": "Poem content with line breaks"
}
```
