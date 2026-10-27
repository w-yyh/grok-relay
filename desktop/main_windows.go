//go:build windows

// GrokRelay uses the same desktop pattern as magpie: a Wails tray panel
// and a separate persistent window, rendered by the system WebView2 runtime.
// The message transport stays in the existing Node worker.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	ui "grokrelay.local/app"
)

type backend struct {
	base    string
	root    string
	data    string
	node    string
	process *exec.Cmd
	client  *http.Client
}

func paths() (*backend, error) {
	executable, err := os.Executable()
	if err != nil {
		return nil, err
	}
	root := filepath.Dir(executable)
	if _, err := os.Stat(filepath.Join(root, "panel-server.cjs")); err != nil {
		root, _ = os.Getwd()
	}
	var local struct {
		DataDir string `json:"dataDir"`
	}
	if b, err := os.ReadFile(filepath.Join(root, "runtime.local.json")); err == nil {
		_ = json.Unmarshal(b, &local)
	}
	data := os.Getenv("BRIDGE_DATA_DIR")
	if data == "" {
		data = local.DataDir
	}
	if data == "" {
		data = filepath.Join(os.Getenv("LOCALAPPDATA"), "GrokRelay")
	}
	node := os.Getenv("BRIDGE_NODE")
	if node == "" {
		node, err = exec.LookPath("node.exe")
	}
	if err != nil {
		return nil, fmt.Errorf("Node.js 22.19+ is required: %w", err)
	}
	port := os.Getenv("BRIDGE_PORT")
	if port == "" {
		port = "43187"
	}
	return &backend{base: "http://127.0.0.1:" + port, root: root, data: data, node: node, client: &http.Client{Timeout: 75 * time.Second}}, nil
}

func (b *backend) available() bool {
	c := http.Client{Timeout: time.Second}
	r, err := c.Get(b.base + "/api/status")
	if err != nil {
		return false
	}
	defer r.Body.Close()
	var state struct {
		App string `json:"app"`
	}
	return json.NewDecoder(r.Body).Decode(&state) == nil && state.App == "GrokRelay"
}

func (b *backend) start() error {
	if b.available() {
		return nil
	}
	b.process = exec.Command(b.node, filepath.Join(b.root, "panel-server.cjs"))
	b.process.Dir = b.root
	b.process.Env = append(os.Environ(), "BRIDGE_DATA_DIR="+b.data)
	b.process.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	file, err := os.OpenFile(filepath.Join(b.data, "state", "panel.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	b.process.Stdout, b.process.Stderr = file, file
	err = b.process.Start()
	file.Close()
	if err != nil {
		return err
	}
	go func() { _ = b.process.Wait() }()
	for i := 0; i < 50; i++ {
		if b.available() {
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	return fmt.Errorf("The local service did not start. Inspect panel.log.")
}

func (b *backend) control(action string, remember bool) {
	data, _ := json.Marshal(map[string]any{"action": action, "remember": remember})
	response, err := b.client.Post(b.base+"/api/control", "application/json", bytes.NewReader(data))
	if err != nil {
		log.Println("bridge control:", err)
		return
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		log.Println("bridge control rejected:", response.StatusCode)
	}
}

func trayIcon() []byte {
	// Two linked blocks: an original, legible monochrome communications mark.
	img := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	ink := color.NRGBA{R: 76, G: 81, B: 128, A: 255}
	for y := 5; y < 27; y++ {
		for x := 3; x < 29; x++ {
			left := x < 13 && (x < 7 || y < 9 || y >= 23)
			right := x >= 19 && (x >= 25 || y < 9 || y >= 23)
			link := x >= 10 && x < 22 && y >= 14 && y < 18
			if left || right || link {
				img.SetNRGBA(x, y, ink)
			}
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func run() error {
	backend, err := paths()
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Join(backend.data, "state"), 0700); err != nil {
		return err
	}
	logfile, err := os.OpenFile(filepath.Join(backend.data, "state", "desktop.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer logfile.Close()
	log.SetOutput(logfile)

	var app *application.App
	var panel, main *application.WebviewWindow
	panelReady := false
	var tray *application.SystemTray
	ready := make(chan struct{})
	var readyOnce sync.Once
	var makeMain func(string)
	showMain := func(view string) {
		application.InvokeAsync(func() {
			if panel != nil {
				panel.Hide()
			}
			if main == nil {
				makeMain(view)
				return
			}
			if view != "activity" {
				main.SetURL("/?native=1&view=" + url.QueryEscape(view))
			}
			main.Show().Focus()
		})
	}
	files, _ := fs.Sub(ui.Panel, "panel")
	static := http.FileServer(http.FS(files))
	target, _ := url.Parse(backend.base)
	proxy := httputil.NewSingleHostReverseProxy(target)
	oldDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		oldDirector(r)
		r.Host = target.Host
		r.Header.Set("Origin", backend.base)
		r.Header.Del("Sec-Fetch-Site")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, e error) {
		http.Error(w, "Local service unavailable", http.StatusServiceUnavailable)
	}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			proxy.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/native/") {
			if r.Method != http.MethodPost {
				http.Error(w, "POST required", 405)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			switch r.URL.Path {
			case "/native/main":
				showMain(r.URL.Query().Get("view"))
			case "/native/hide":
				application.InvokeAsync(func() {
					if panel != nil {
						panel.Hide()
					}
					if main != nil {
						main.Hide()
					}
				})
			case "/native/quit":
				go func() { backend.control("stop", false); app.Quit() }()
			default:
				http.NotFound(w, r)
				return
			}
			_, _ = w.Write([]byte(`{"ok":true}`))
			return
		}
		static.ServeHTTP(w, r)
	})
	app = application.New(application.Options{
		Name: "GrokRelay", Description: "Agent messaging in existing conversations", Icon: trayIcon(),
		Assets:  application.AssetOptions{Handler: handler},
		Windows: application.WindowsOptions{DisableQuitOnLastWindowClosed: true, WebviewUserDataPath: filepath.Join(backend.data, "state", "webview2")},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               "grokrelay.desktop",
			OnSecondInstanceLaunch: func(application.SecondInstanceData) { go func() { <-ready; showMain("activity") }() },
		},
		OnShutdown: func() {
			if backend.process != nil && backend.process.Process != nil {
				_ = backend.process.Process.Kill()
			}
		},
		ErrorHandler: func(err error) { log.Println("desktop:", err) },
	})
	// The popup traits follow magpie's panelOptions; a distinct persistent
	// window owns editing, so losing tray focus never dismisses a draft.
	makePanel := func() {
		panelReady = false
		window := app.Window.NewWithOptions(application.WebviewWindowOptions{
			Name: "panel", Title: "GrokRelay", URL: "/?native=1&mode=tray", Width: 420, Height: 580,
			Hidden: true, Frameless: true, AlwaysOnTop: true, DisableResize: true, HideOnEscape: true, HideOnFocusLost: true,
			MinimiseButtonState: application.ButtonHidden, MaximiseButtonState: application.ButtonHidden, CloseButtonState: application.ButtonHidden,
			BackgroundColour: application.RGBA{Red: 243, Green: 243, Blue: 245, Alpha: 255},
			Windows:          application.WindowsWindow{HiddenOnTaskbar: true}, DefaultContextMenuDisabled: true,
		})
		panel = window
		var loaded sync.Once
		window.OnWindowEvent(events.Windows.WebViewNavigationCompleted, func(*application.WindowEvent) {
			loaded.Do(func() {
				log.Println("panel loaded")
				application.InvokeAsync(func() {
					if panel == window {
						panelReady = true
						_ = tray.PositionWindow(window, 6)
						window.Show().Focus()
					}
				})
			})
		})
		window.OnWindowEvent(events.Common.WindowHide, func(*application.WindowEvent) {
			time.AfterFunc(8*time.Second, func() {
				application.InvokeAsync(func() {
					if panel == window && !window.IsVisible() {
						panel = nil
						window.Close()
						log.Println("idle panel released")
					}
				})
			})
		})
	}
	makeMain = func(view string) {
		window := app.Window.NewWithOptions(application.WebviewWindowOptions{
			Name: "main", Title: "GrokRelay", URL: "/?native=1&view=" + url.QueryEscape(view), Width: 560, Height: 740, MinWidth: 420, MinHeight: 560, Hidden: true,
			BackgroundColour: application.RGBA{Red: 243, Green: 243, Blue: 245, Alpha: 255}, DefaultContextMenuDisabled: true,
		})
		main = window
		var loaded sync.Once
		window.OnWindowEvent(events.Windows.WebViewNavigationCompleted, func(*application.WindowEvent) {
			loaded.Do(func() {
				log.Println("main window loaded")
				application.InvokeAsync(func() {
					if main == window {
						window.Show().Focus()
					}
				})
			})
		})
		window.OnWindowEvent(events.Common.WindowClosing, func(*application.WindowEvent) {
			if main == window {
				main = nil
			}
			log.Println("main window released")
		})
	}
	tray = app.SystemTray.New()
	tray.SetIcon(trayIcon()).SetTooltip("GrokRelay")
	menu := app.NewMenu()
	menu.Add("Open GrokRelay").OnClick(func(*application.Context) { showMain("activity") })
	menu.Add("Contacts").OnClick(func(*application.Context) { showMain("contacts") })
	menu.AddSeparator()
	menu.Add("Quit GrokRelay").OnClick(func(*application.Context) { go func() { backend.control("stop", false); app.Quit() }() })
	tray.SetMenu(menu)
	tray.OnClick(func() {
		application.InvokeAsync(func() {
			if panel == nil {
				makePanel()
			} else if !panelReady {
				return
			} else if panel.IsVisible() {
				panel.Hide()
			} else {
				_ = tray.PositionWindow(panel, 6)
				panel.Show().Focus()
			}
		})
	})
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		readyOnce.Do(func() { close(ready) })
		onlyTray := false
		for _, arg := range os.Args[1:] {
			if arg == "--tray" {
				onlyTray = true
			}
		}
		if !onlyTray {
			application.InvokeAsync(makePanel)
		}
	})
	if err = backend.start(); err != nil {
		return err
	}
	var preferences struct {
		Paused bool `json:"paused"`
	}
	if b, e := os.ReadFile(filepath.Join(backend.data, "state", "preferences.json")); e == nil {
		_ = json.Unmarshal(b, &preferences)
	}
	if !preferences.Paused {
		go backend.control("start", false)
	}
	log.Println("native host started")
	return app.Run()
}

func main() {
	if err := run(); err != nil {
		log.Println(err)
		title, _ := syscall.UTF16PtrFromString("GrokRelay")
		text, _ := syscall.UTF16PtrFromString(err.Error())
		syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
		os.Exit(1)
	}
}
