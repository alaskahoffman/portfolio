package api

import (
	_ "embed"
	"encoding/json"
	"html/template"
	"net/http"
	"strings"
)

//go:embed software.json
var softwareJSON []byte

type softwareProject struct {
	SidebarOnly           bool
	Slug                  string
	Name                  string
	Status                string
	Summary               string
	Medium                string
	Page                  string
	Paragraphs            []string
	State                 string
	Links                 []softwareLink
	Screenshot            string
	Caption               string
	AdditionalScreenshots []softwareImage
}

type softwareImage struct {
	URL     string
	Caption string
}

type softwareLink struct {
	Label string
	URL   string
}

type softwareGroup struct {
	ID       string
	Name     string
	Projects []softwareProject
}

// Existing case studies retain their URLs; new entries receive their own page.
func (p softwareProject) URL() string {
	if p.Page != "" {
		return p.Page
	}
	return "/software/" + p.Slug
}

var softwareGroups = func() []softwareGroup {
	var groups []softwareGroup
	if err := json.Unmarshal(softwareJSON, &groups); err != nil {
		panic(err)
	}
	return groups
}()

var softwareIndexTmpl = template.Must(template.New("software-index").Parse(`
<div class="poem-list">
    {{range .}}
        {{range .Projects}}
        {{if not .SidebarOnly}}
        <div class="poem-listing">
            <a href="{{.URL}}">{{.Name}}</a>
        </div>
        {{end}}
        {{end}}
    {{end}}
</div>`))

var softwareProjectTmpl = template.Must(template.New("software-project").Parse(`
<main>
    <h4>{{.Name}}</h4>
    <div class="poem-content">
        {{range .Paragraphs}}<p>{{.}}</p>{{end}}
        {{if .Screenshot}}
        <a href="{{.Screenshot}}"><img class="project-img" src="{{.Screenshot}}" alt="{{.Name}}{{if .Caption}} — {{.Caption}}{{end}}" loading="lazy" decoding="async"></a>
        {{if .Caption}}<p class="project-meta">{{.Caption}}</p>{{end}}
        {{end}}
        {{range .AdditionalScreenshots}}
        <a href="{{.URL}}"><img class="project-img" src="{{.URL}}" alt="{{.Caption}}" loading="lazy" decoding="async"></a>
        {{if .Caption}}<p class="project-meta">{{.Caption}}</p>{{end}}
        {{end}}
    </div>
    {{range .Links}}<p><a href="{{.URL}}">{{.Label}}</a></p>{{end}}
</main>`))

func softwareHandler(w http.ResponseWriter, r *http.Request) {
	var content strings.Builder
	if err := softwareIndexTmpl.Execute(&content, softwareGroups); err != nil {
		http.Error(w, "Unable to render software", http.StatusInternalServerError)
		return
	}
	render(w, "Experiments - Alaska Hoffman", content.String(), "")
}

func softwareProjectHandler(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/software/")
	for _, group := range softwareGroups {
		for _, project := range group.Projects {
			if project.Slug != slug {
				continue
			}
			if project.Page != "" {
				http.Redirect(w, r, project.Page, http.StatusFound)
				return
			}
			var content strings.Builder
			if err := softwareProjectTmpl.Execute(&content, project); err != nil {
				http.Error(w, "Unable to render project", http.StatusInternalServerError)
				return
			}
			render(w, project.Name+" - Alaska Hoffman", content.String(), "")
			return
		}
	}
	http.NotFound(w, r)
}
