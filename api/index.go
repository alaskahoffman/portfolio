package api

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strings"
)

//go:embed public/*
var staticFiles embed.FS

// ============================================================================
// DATA STRUCTURES
// ============================================================================
type Poem struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Date     string `json:"date"`
	Category string `json:"category"`
	Location string `json:"location"`
	Content  string `json:"content"`
}

// ============================================================================
// HTML TEMPLATES
// ============================================================================

// Sidebar template - used across all pages for consistent navigation
const sidebarTemplate = `
<div class="sidebar">
    <p><a href="/">Alaska Hoffman</a></p>
    
    <form action="/search" method="GET">
        <input type="text" name="q" value="{{.Query}}">
    </form>
    
    <nav>
        <div class="nav-label">Projects</div>
        <div><a href="/portaltext">portaltext (2026)</a></div>
        <div><a href="/andstar">andstar (2026)</a></div>
        <br>
        <div class="nav-label">Writing</div>
        <div><a href="/poetry">Poetry</a></div>
        <div><a href="/boma">Boma (2025)</a></div>
        <br>
        <div class="nav-label">Past</div>
        <s><div><a href="/search?q=">Capsule 21 (2022)</a></div></s>
        <s><div><a href="/search?q=">Superchief Gallery (2023)</a></div></s>
        <s><div><a href="/search?q=">COEX, Korea (2023)</a></div></s>
        <div><a href="/dxrg">DX Research Group (2024&ndash;2026)</a></div>
        <br>
        <br>
        <br>
        <br>
        <br>
        <div><a href="/">About</a></div>
        <div><a href="https://x.com/145k4">@145k4</a></div>
		<div>hello@alaskahoffman.com</div>
    </nav>
</div>`

// Base template - main page layout with CSS styling
const baseTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Title}}</title>
    <style>
        html {
            background: linear-gradient(168deg, #ccd5db 0%, #dde3e7 30%, #eef1f3 60%, #f8f9fa 100%) no-repeat fixed;
            background-size: 220% 220%;
            animation: sheen 75s ease-in-out infinite alternate;
        }
        @keyframes sheen {
            0%   { background-position: 0% 0%; }
            100% { background-position: 100% 100%; }
        }
        @view-transition {
            navigation: auto;
        }
        .container {
            view-transition-name: page;
        }
        .sidebar {
            view-transition-name: sidebar;
        }
        ::view-transition-old(page) {
            animation: page-out 280ms ease-in both;
        }
        ::view-transition-new(page) {
            animation: page-in 380ms 90ms ease-out both;
        }
        @keyframes page-out {
            to { opacity: 0; transform: scale(0.9); }
        }
        @keyframes page-in {
            from { opacity: 0; transform: scale(0.9); }
        }
        @media (prefers-reduced-motion: reduce) {
            html { animation: none; }
            ::view-transition-old(page),
            ::view-transition-new(page) { animation: none; }
        }
        body {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 11px;
            margin: 0;
            padding: 0;
        }
        .container {
            display: flex;
            min-height: 100vh;
        }
        .sidebar {
            width: 150px;
            padding: 20px;
            background-color: transparent;
            border-right: 1px solid #b4c0c8;
        }
          .main-content {
              flex: 1;
              padding: 80px 60px 20px 60px;
              max-width: 600px;
          }
          .mobile-menu-toggle {
              display: none;
          }
          @media (max-width: 768px) {
              .container {
                  flex-direction: column;
              }
              .main-content {
                  order: 1;
                  padding: 40px 20px 20px 20px;
                  max-width: 100%;
              }
              .sidebar {
                  order: 2;
                  width: auto;
                  border-right: none;
                  border-top: 1px solid #ccc;
              }
              .sidebar > p {
                  display: none;
              }
              .sidebar nav br {
                  display: none;
              }
              .sidebar p,
              .sidebar nav div,
              .sidebar nav a,
              .sidebar form input {
                  font-size: 14px;
              }
              .sidebar nav > div,
              .sidebar form {
                  margin-bottom: 6px;
              }
              .sidebar .nav-label {
                  margin-top: 16px;
              }
              .mobile-menu-toggle {
                  display: block;
                  padding: 15px 20px;
                  border-bottom: 1px solid #ccc;
                  font-size: 14px;
              }
              .mobile-menu-toggle a {
                  font-weight: bold;
                  font-size: 14px;
              }
          }
          .nav-label {
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 9px;
            margin-bottom: 3px;
        }
        .project-meta {
            color: #999;
        }
        .project-img {
            width: 100%;
            max-width: 600px;
            height: auto;
            display: block;
            margin: 13px 0;
            border: 1px solid #ccc;
        }
        .project-img-borderless {
            border: none;
        }
        .poem-list {
              line-height: 1.1;
              margin-top: 13px;
          }
          .poem-listing {
              margin-bottom: 2px;
          }
        input[type="text"] {
            width: 70px;
            height: 8px;
            padding: 3px;
            border: 1px solid black;
            border-radius: 0px;
            background-color: transparent;
            font-family: Helvetica, Arial, sans-serif;
            font-size: 11px;
        }
        form {
            margin-bottom: 13px;
        }
        a {
            color: black;
            text-decoration: none;
        }
        a:hover {
            color: black;
            text-decoration: underline;
        }
        .boma-content {
            font-size: 14px;
            line-height: 1.6;
            font-family: "Times New Roman", Times, serif;
        }
        .boma-content p {
            text-indent: 2em;
        }
    </style>
    <script>
        // Phase the background drift off the wall clock so it carries across page loads
        document.documentElement.style.animationDelay = -(Date.now() / 1000 % 150) + 's';
    </script>
</head>
<body>
    <div class="mobile-menu-toggle">
        <a href="/">Alaska Hoffman</a>
    </div>
    <div class="container">
        {{.Sidebar}}
        <div class="main-content">
            {{.Content}}
        </div>
    </div>
</body>
</html>`

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

var (
	sidebarTmpl = template.Must(template.New("sidebar").Parse(sidebarTemplate))
	baseTmpl    = template.Must(template.New("base").Parse(baseTemplate))
)

// render writes a full page using the shared sidebar and base layout.
func render(w http.ResponseWriter, title, content, query string) {
	var sidebarHTML strings.Builder
	sidebarTmpl.Execute(&sidebarHTML, struct{ Query string }{query})

	baseTmpl.Execute(w, struct {
		Title   string
		Sidebar template.HTML
		Content template.HTML
	}{title, template.HTML(sidebarHTML.String()), template.HTML(content)})
}

// loadPoems reads and parses all poem JSON files from the embedded filesystem.
func loadPoems() []Poem {
	entries, err := staticFiles.ReadDir("public/poems")
	if err != nil {
		log.Printf("Error reading poem files: %v", err)
		return nil
	}

	var poems []Poem
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := staticFiles.ReadFile("public/poems/" + entry.Name())
		if err != nil {
			continue
		}
		var poem Poem
		if err := json.Unmarshal(data, &poem); err != nil {
			continue
		}
		poems = append(poems, poem)
	}
	return poems
}

// formatBomaContent - formats story content with paragraph tags for proper indentation
func formatBomaContent(content string) string {
	// First, split on section headers to separate them from following text
	// Replace "\n\nI.\n" with a special marker, same for II. and III.
	content = strings.ReplaceAll(content, "\n\nI.\n", "\n\n__SECTION_I__\n")
	content = strings.ReplaceAll(content, "\n\nII.\n", "\n\n__SECTION_II__\n")
	content = strings.ReplaceAll(content, "\n\nIII\n", "\n\n__SECTION_III__\n")
	content = strings.ReplaceAll(content, "\n\nIII.\n", "\n\n__SECTION_III__\n")
	
	// Split by double newlines to get paragraphs
	paragraphs := strings.Split(content, "\n\n")
	var result strings.Builder
	
	for i, para := range paragraphs {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}
		
		// Helper function to format content with indented line breaks
		formatWithIndentedBreaks := func(text string) string {
			lines := strings.Split(text, "\n")
			var formatted strings.Builder
			for i, line := range lines {
				if i > 0 {
					// Add indent for lines after the first
					formatted.WriteString("<br><span style=\"display: inline-block; text-indent: 2em;\">")
					formatted.WriteString(strings.TrimSpace(line))
					formatted.WriteString("</span>")
				} else {
					// First line - no indent needed (paragraph already has text-indent)
					if i < len(lines)-1 {
						formatted.WriteString(line)
					} else {
						formatted.WriteString(line)
					}
				}
			}
			return formatted.String()
		}
		
		// Check if this paragraph starts with a section marker
		if strings.HasPrefix(para, "__SECTION_I__") {
			result.WriteString("<p style=\"text-indent: 0; text-align: center;\">I.</p>\n")
			// Get the rest of the text after the marker
			remaining := strings.TrimPrefix(para, "__SECTION_I__")
			remaining = strings.TrimSpace(remaining)
			if remaining != "" {
				result.WriteString("<p>")
				result.WriteString(formatWithIndentedBreaks(remaining))
				result.WriteString("</p>")
			}
		} else if strings.HasPrefix(para, "__SECTION_II__") {
			result.WriteString("<p style=\"text-indent: 0; text-align: center;\">II.</p>\n")
			remaining := strings.TrimPrefix(para, "__SECTION_II__")
			remaining = strings.TrimSpace(remaining)
			if remaining != "" {
				result.WriteString("<p>")
				result.WriteString(formatWithIndentedBreaks(remaining))
				result.WriteString("</p>")
			}
		} else if strings.HasPrefix(para, "__SECTION_III__") {
			result.WriteString("<p style=\"text-indent: 0; text-align: center;\">III.</p>\n")
			remaining := strings.TrimPrefix(para, "__SECTION_III__")
			remaining = strings.TrimSpace(remaining)
			if remaining != "" {
				result.WriteString("<p>")
				result.WriteString(formatWithIndentedBreaks(remaining))
				result.WriteString("</p>")
			}
		} else {
			// Regular paragraph - format with indented breaks
			result.WriteString("<p>")
			result.WriteString(formatWithIndentedBreaks(para))
			result.WriteString("</p>")
		}
		
		// Add spacing between paragraphs (except for last one)
		if i < len(paragraphs)-1 {
			result.WriteString("\n")
		}
	}
	
	return result.String()
}

// searchPoems - searches all poems for matching content
func searchPoems(query string) []Poem {
	var results []Poem
	queryLower := strings.ToLower(query)

	for _, poem := range loadPoems() {
		// Search in title, content, category, and location
		if strings.Contains(strings.ToLower(poem.Title), queryLower) ||
			strings.Contains(strings.ToLower(poem.Content), queryLower) ||
			strings.Contains(strings.ToLower(poem.Category), queryLower) ||
			strings.Contains(strings.ToLower(poem.Location), queryLower) {
			results = append(results, poem)
		}
	}
	return results
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

// Homepage handler - displays bio and navigation
func homeHandler(w http.ResponseWriter, r *http.Request) {
	content := `
        <div class="bio">
            <p>Alaska Hoffman is a Michigander poet and product builder based in Brooklyn, New York.</p>
            <p>She designs and builds software concerned with reading, language, and interface. She is the creator of <a href="/portaltext">portaltext</a> (2026), a browser extension that summarizes links in place, and <a href="/andstar">andstar</a> (2026), an engine for dialogue games with dice mechanics. She is the author of the essay <a href="https://hcra.substack.com/p/ai-has-a-ux-problem">&ldquo;AI Has a UX Problem&rdquo;</a> (2026).</p>
            <p>From 2024 to 2026 she was a product designer at <a href="/dxrg">DX Research Group</a>, and is a co-author of <a href="https://arxiv.org/abs/2604.26091">&ldquo;Operating-Layer Controls for Onchain Language-Model Agents Under Real Capital&rdquo;</a> (arXiv, 2026).</p>
            <p>Her writing is interested in themes of noise, futurism, permanence, hauntology, transition, repetition, and historicity.</p>
            <p>She has a B.A. in Creative Writing from Columbia University, and is a USMC veteran.</p>
            <p>This website serves as an archive of her personal work. Alaska has also created under the names dovetail, ennen, and Archway Labs.</p>
            <br>
            <p><a href="https://x.com/145k4">@145k4</a></p>
            <p>hello@alaskahoffman.com</p>
        </div>`

	render(w, "Alaska Hoffman", content, "")
}

// Search handler - searches through poem JSON files and displays results
func searchHandler(w http.ResponseWriter, r *http.Request) {
	query := strings.ToLower(r.URL.Query().Get("q"))

	var poemResults []Poem
	if query != "" {
		poemResults = searchPoems(query)
	}

	content := fmt.Sprintf(`
        <div class="poem-list">
        %s
        </div>`,
		func() string {
			resultHTML := ""
			
			// Display poem results
			if len(poemResults) > 0 {
				for _, poem := range poemResults {
					// Truncate content for preview
					preview := poem.Content
					if len(preview) > 200 {
						preview = preview[:200] + "..."
					}
					resultHTML += fmt.Sprintf(`
            <div class="poem-result">
                <h4><a href="/poem/%d">%s</a></h4>
                <p><strong>Date:</strong> %s | <strong>Location:</strong> %s</p>
                <p class="poem-preview">%s</p>
            </div>`, poem.ID, poem.Title, poem.Date, poem.Location, preview)
				}
			} else {
				resultHTML = fmt.Sprintf(`<p>No poems found matching "%s"</p>`, template.HTMLEscapeString(query))
			}
			
			return resultHTML
		}())

	render(w, "Search Results - Alaska Hoffman", content, query)
}

// Poem handler - displays individual poem pages from JSON files
func poemHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/poem/")
	poemID := strings.TrimSuffix(path, ".json")
	
	// Read the JSON file from embedded filesystem
	filePath := fmt.Sprintf("public/poems/poem-%s.json", poemID)
	data, err := staticFiles.ReadFile(filePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	
	// Parse the JSON
	var poem Poem
	if err := json.Unmarshal(data, &poem); err != nil {
		http.Error(w, "Error parsing poem data", http.StatusInternalServerError)
		return
	}

	content := fmt.Sprintf(`
        <h4>%s</h4>
        
        <div class="poem-content">
            %s
        </div>
        <br>
        <br>
        <p>%s // %s</p>`,
		poem.Title, strings.ReplaceAll(poem.Content, "\n", "<br>"),
		poem.Location, poem.Date)

	render(w, fmt.Sprintf("%s - Alaska Hoffman", poem.Title), content, "")
}

// Boma handler - displays the Boma short story
func bomaHandler(w http.ResponseWriter, r *http.Request) {
	// Read the JSON file from embedded filesystem
	data, err := staticFiles.ReadFile("public/boma.json")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	
	// Parse the JSON
	var story struct {
		Title    string `json:"title"`
		Date     string `json:"date"`
		Location string `json:"location"`
		Content  string `json:"content"`
	}
	
	if err := json.Unmarshal(data, &story); err != nil {
		http.Error(w, "Error parsing story data", http.StatusInternalServerError)
		return
	}

	// Format content with paragraph tags for proper indentation
	formattedContent := formatBomaContent(story.Content)
	
	content := fmt.Sprintf(`
        <h4>%s</h4>
        
        <div class="poem-content boma-content">
            %s
        </div>
        <br>
        <br>
        <p>%s // %s</p>`,
		story.Title, formattedContent,
		story.Location, story.Date)

	render(w, fmt.Sprintf("%s - Alaska Hoffman", story.Title), content, "")
}

// Portaltext handler - displays the portaltext project page
func portaltextHandler(w http.ResponseWriter, r *http.Request) {
	content := `
        <h4>portaltext (2026)</h4>
        <p class="project-meta">founder &amp; creator — design, engineering, product</p>

        <img class="project-img project-img-borderless" src="/static/images/portaltextwide.svg" alt="portaltext — a cat peeking through a green portal" style="max-width: 280px;">

        <div class="poem-content">
            <p>portaltext is a browser extension that produces short, context-aware summaries of links, images, and PDFs on hover. It reads both the current page and the linked destination, so a reader can follow a reference without leaving the page.</p>
            <p>A solo project, designed and built by Alaska Hoffman. Released June 2026.</p>
            <img class="project-img" src="/static/images/portaltext-hover.png" alt="portaltext hover summaries nesting across a Borges article">
        </div>
        <br>
        <p><a href="https://portaltext.com">portaltext.com</a></p>`

	render(w, "portaltext - Alaska Hoffman", content, "")
}

// Andstar handler - displays the andstar project page
func andstarHandler(w http.ResponseWriter, r *http.Request) {
	content := `
        <h4>andstar (2026)</h4>
        <p class="project-meta">solo project — design, engineering, product</p>

        <img class="project-img project-img-borderless" src="/static/images/andstar-wordmark.svg" alt="andstar" style="max-width: 280px;">

        <div class="poem-content">
            <p>andstar is a browser-based engine for Disco Elysium-style dialogue games with tabletop mechanics. Stories are written in plain text; the engine adds skill checks, dice rolls, items, currency, and branching endings. Finished games are shared as links, playable directly on <a href="https://andstar.org">andstar.org</a> on desktop and mobile.</p>
            <p>A solo project, designed and built by Alaska Hoffman. Released June 2026.</p>
            <img class="project-img" src="/static/images/andstar-play.png" alt="an andstar game mid-play: skill checks, dice rolls, inventory, and a skill-point allocation panel">
            <img src="/static/images/andstar-glyph.svg" alt="&amp;*" style="width: 24px; height: auto; display: block; margin-top: 13px;">
        </div>
        <br>
        <p><a href="https://andstar.org">andstar.org</a></p>`

	render(w, "andstar - Alaska Hoffman", content, "")
}

// DXRG handler - displays the DX Research Group work page
func dxrgHandler(w http.ResponseWriter, r *http.Request) {
	content := `
        <h4>DX Research Group (2024&ndash;2026)</h4>
        <p class="project-meta">product designer / AI &mdash; user&ndash;agent interaction, agent behavior design</p>

        <div class="poem-content">
            <p>DX Research Group develops operating-layer controls for autonomous agents that manage capital on blockchain networks. From 2024 to 2026, Alaska was a product designer there, responsible for the user&ndash;agent interaction layer.</p>
            <img class="project-img project-img-borderless" src="/static/images/dxterminal-wordmark.png" alt="DX Terminal" style="max-width: 300px; image-rendering: pixelated;">
            <p><strong>DX Terminal (2025)</strong> was a simulation in which 35,000 agents traded simulated tokens. Alaska designed its persona system, which differentiated the behavior of same-model agents.</p>
            <img class="project-img project-img-borderless" src="/static/images/dxterminalpro-logo.png" alt="DX Terminal Pro!" style="max-width: 220px;">
            <p><strong>DX Terminal Pro (2026)</strong> moved the system to real capital: over a 21-day deployment, 3,505 user-funded agents traded approximately $20M in ETH. Alaska designed its typed-control system, in which users direct agents through fixed parameters rather than conversation.</p>
            <p>Alaska is a co-author of the resulting paper, <a href="https://arxiv.org/abs/2604.26091">&ldquo;Operating-Layer Controls for Onchain Language-Model Agents Under Real Capital&rdquo;</a> (arXiv:2604.26091, 2026).</p>
            <a href="https://arxiv.org/abs/2604.26091"><img class="project-img" src="/static/images/dxrg-paper.png" alt="Title and abstract of the paper Operating-Layer Controls for Onchain Language-Model Agents Under Real Capital"></a>
        </div>
        <br>
        <p><a href="https://dxrg.ai">dxrg.ai</a></p>`

	render(w, "DX Research Group - Alaska Hoffman", content, "")
}

// Poetry handler - displays listing of all poems
func poetryHandler(w http.ResponseWriter, r *http.Request) {
	poems := loadPoems()

	content := fmt.Sprintf(`
        <div class="poem-list">
        %s
        </div>`,
		func() string {
			if len(poems) > 0 {
				resultHTML := ""
				for _, poem := range poems {
					resultHTML += fmt.Sprintf(`
            <div class="poem-listing">
                <a href="/poem/%d">%s</a>
            </div>`, poem.ID, poem.Title)
				}
				return resultHTML
			}
			return `<p>No poems found in the archive.</p>`
		}())

	render(w, "All Poems - Alaska Hoffman", content, "")
}

// ============================================================================
// MAIN HANDLER FUNCTION
// ============================================================================

// Handler is the main entry point for Vercel Go functions
func Handler(w http.ResponseWriter, r *http.Request) {
	// Handle static files first
	if strings.HasPrefix(r.URL.Path, "/static/") {
		filePath := strings.TrimPrefix(r.URL.Path, "/static/")
		data, err := staticFiles.ReadFile("public/" + filePath)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		
		// Set appropriate content type and caching headers
		if strings.HasSuffix(filePath, ".webp") {
			w.Header().Set("Content-Type", "image/webp")
			w.Header().Set("Cache-Control", "public, max-age=31536000")
		} else if strings.HasSuffix(filePath, ".png") {
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Cache-Control", "public, max-age=31536000")
		} else if strings.HasSuffix(filePath, ".svg") {
			w.Header().Set("Content-Type", "image/svg+xml")
			w.Header().Set("Cache-Control", "public, max-age=31536000")
		} else if strings.HasSuffix(filePath, ".json") {
			w.Header().Set("Content-Type", "application/json")
		}
		
		w.Write(data)
		return
	}
	
	// Route handling
	switch {
	case r.URL.Path == "/" || r.URL.Path == "":
		homeHandler(w, r)
	case r.URL.Path == "/search":
		searchHandler(w, r)
	case strings.HasPrefix(r.URL.Path, "/poem/"):
		poemHandler(w, r)
	case r.URL.Path == "/poetry":
		poetryHandler(w, r)
	case r.URL.Path == "/boma":
		bomaHandler(w, r)
	case r.URL.Path == "/portaltext":
		portaltextHandler(w, r)
	case r.URL.Path == "/andstar":
		andstarHandler(w, r)
	case r.URL.Path == "/dxrg":
		dxrgHandler(w, r)
	default:
		http.NotFound(w, r)
	}
}

