package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"testing"
)

func TestWebViewBodySurvivesReverseProxy(t *testing.T) {
	for _, body := range []string{`{"language":"zh-CN"}`, `{"text":"你好，原文保留"}`} {
		t.Run(body, func(t *testing.T) {
			backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				actual, _ := io.ReadAll(r.Body)
				if string(actual) != body {
					t.Errorf("body = %q, want %q", actual, body)
				}
				w.WriteHeader(http.StatusNoContent)
			}))
			defer backend.Close()
			target, _ := url.Parse(backend.URL)
			r := httptest.NewRequest("POST", "/api/preferences", strings.NewReader(body))
			r.ContentLength = 0 // The shape produced by WebView2's stream adapter.
			if err := prepareProxyBody(r); err != nil {
				t.Fatal(err)
			}
			httputil.NewSingleHostReverseProxy(target).ServeHTTP(httptest.NewRecorder(), r)
		})
	}
}
