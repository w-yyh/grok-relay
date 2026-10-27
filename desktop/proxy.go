package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
)

// WebView2 can supply a body stream without a Content-Length header.
// ReverseProxy treats ContentLength == 0 as an empty request and drops it.
func prepareProxyBody(r *http.Request) error {
	if r.Body == nil || r.Body == http.NoBody {
		return nil
	}
	const limit = 256 * 1024
	body, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return err
	}
	if len(body) > limit {
		return fmt.Errorf("request body too large")
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	r.Header.Set("Content-Length", strconv.Itoa(len(body)))
	return nil
}
