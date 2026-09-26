# Alaska Hoffman Poetry Website

## Software portfolio

`/software` is the Experiments index, linked from the home page and
shared navigation. It contains reading tools, games and simulation, and team-related
work. The index displays only linked titles, using the same list layout as Poetry;
project pages show a title, a one- or two-sentence description, and images with
optional captions.

Edit `api/software.json` to update the catalog. Set `SidebarOnly` for projects already featured in the sidebar to omit them from
the Experiments list while retaining their detail pages. Each group has an `ID`, `Name`,
and `Projects`. A project supplies its `Slug`, `Name`, `Status`, `Summary`,
`Medium`, `Paragraphs`, `State`, `Screenshot`, `Caption`, and optional `Links`
(label and URL). Screenshots are local images under `api/public/images/`;
optional captions identify previews, archived results, or image context when needed.
Optional `AdditionalScreenshots` entries supply a `URL` and `Caption` for
further views, using the same image treatment as the primary screenshot.
Text is escaped by Go's HTML templates; write plain text, not HTML.
Descriptions use the site's third-person, museum-label style in one or two sentences
total, matching the portaltext and andstar pages: identify the work, explain its
distinctive interaction, and make its purpose concrete. Include attribution or
development status in that paragraph where useful;
no separate subheading, status line, or attribution block is rendered.
The index and detail pages inherit the existing typography and project layout.

New projects appear at `/software/<slug>`. Set `Page` only when pointing to an
existing case study, such as `/portaltext`, `/andstar`, or `/dxrg`. Release
labels should be supported by actual releases; otherwise describe the current
prototype or research stage. The local folder audit is in
`docs/software-inventory.md`.

Run the site with `go run .` (port 8081 by default; override with `PORT`). Run
`go test ./...` to check catalog navigation, project pages, and existing routes.
The Squire application is separately hosted through the existing Vercel rewrite;
that application does not run inside the local Go preview.

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
