package assets

import "embed"

// Panel contains only the public interface, never account or conversation data.
//
//go:embed panel/*
var Panel embed.FS

// Icon is derived from the same source as panel/logo.svg and the Windows ICO.
//go:embed assets/icon.png
var Icon []byte
