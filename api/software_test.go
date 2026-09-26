package api

import (
	"bytes"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSoftwareNavigation(t *testing.T) {
	index := httptest.NewRecorder()
	Handler(index, httptest.NewRequest(http.MethodGet, "/software", nil))
	if index.Code != http.StatusOK {
		t.Fatalf("index returned %d", index.Code)
	}
	for _, group := range softwareGroups {
		for _, project := range group.Projects {
			t.Run(project.Slug, func(t *testing.T) {
				if !project.SidebarOnly && !strings.Contains(index.Body.String(), `href="`+project.URL()+`"`) {
					t.Fatalf("project is missing from index")
				}
				page := httptest.NewRecorder()
				Handler(page, httptest.NewRequest(http.MethodGet, project.URL(), nil))
				if page.Code != http.StatusOK {
					t.Fatalf("project URL %s returned %d", project.URL(), page.Code)
				}
				if !strings.Contains(page.Body.String(), project.Name) {
					t.Fatal("project page has no project title")
				}
				if strings.Contains(page.Body.String(), "ZgotmplZ") || strings.Contains(page.Body.String(), "<no value>") {
					t.Fatal("project page has invalid template output")
				}
				if project.Page == "" && (project.State == "" || len(project.Paragraphs) == 0) {
					t.Fatal("new case study is missing its description or current state")
				}
				if project.Screenshot == "" {
					t.Fatal("project is missing its screenshot")
				}
				if !strings.Contains(page.Body.String(), `src="`+project.Screenshot+`"`) {
					t.Fatal("screenshot is not displayed on the project page")
				}
				shot := httptest.NewRecorder()
				Handler(shot, httptest.NewRequest(http.MethodGet, project.Screenshot, nil))
				if shot.Code != http.StatusOK || shot.Header().Get("Content-Type") != "image/png" || shot.Body.Len() == 0 {
					t.Fatal("screenshot URL does not serve an image")
				}
				if strings.HasPrefix(project.Screenshot, "/static/images/software/") {
					if _, err := png.DecodeConfig(bytes.NewReader(shot.Body.Bytes())); err != nil {
						t.Fatalf("screenshot is not a valid PNG: %v", err)
					}
				}
				for _, extra := range project.AdditionalScreenshots {
					if !strings.Contains(page.Body.String(), `src="`+extra.URL+`"`) {
						t.Fatal("additional screenshot is missing its image")
					}
					image := httptest.NewRecorder()
					Handler(image, httptest.NewRequest(http.MethodGet, extra.URL, nil))
					if image.Code != http.StatusOK || image.Header().Get("Content-Type") != "image/png" || image.Body.Len() == 0 {
						t.Fatalf("additional screenshot %s does not serve an image", extra.URL)
					}
					if _, err := png.DecodeConfig(bytes.NewReader(image.Body.Bytes())); err != nil {
						t.Fatalf("additional screenshot is not a valid PNG: %v", err)
					}
				}
				for _, link := range project.Links {
					if strings.HasPrefix(link.URL, "/") {
						linked := httptest.NewRecorder()
						Handler(linked, httptest.NewRequest(http.MethodGet, link.URL, nil))
						if linked.Code != http.StatusOK {
							t.Fatalf("related link %s returned %d", link.URL, linked.Code)
						}
					}
				}
			})
		}
	}
}

func TestSoftwareRoutes(t *testing.T) {
	for _, path := range []string{"/", "/poetry", "/poem/1", "/boma", "/portaltext", "/andstar", "/dxrg"} {
		page := httptest.NewRecorder()
		Handler(page, httptest.NewRequest(http.MethodGet, path, nil))
		if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), `href="/software"`) {
			t.Errorf("existing page %s must render with software navigation", path)
		}
	}
	for _, path := range []string{"/software/not-a-project", "/software/puller/extra", "/software/truthbrary", "/software/fishmonger"} {
		page := httptest.NewRecorder()
		Handler(page, httptest.NewRequest(http.MethodGet, path, nil))
		if page.Code != http.StatusNotFound {
			t.Errorf("unknown project %s returned %d", path, page.Code)
		}
	}
	page := httptest.NewRecorder()
	Handler(page, httptest.NewRequest(http.MethodGet, "/software/portaltext", nil))
	if page.Code != http.StatusFound || page.Header().Get("Location") != "/portaltext" {
		t.Fatal("existing project alias must redirect to its original case study")
	}
}
