"""
SECTalk Desktop Launcher
=======================
A sleek desktop app that launches the SECTalk backend + frontend
dev servers with a single click and opens the browser automatically.
"""

import tkinter as tk
from tkinter import font as tkfont
import subprocess
import threading
import socket
import os
import sys
import webbrowser
import signal
import ctypes


# ─── Helpers ───────────────────────────────────────────────────────────────────

def get_local_ip():
    """Get the machine's LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def resource_path(relative):
    """Get absolute path to a bundled resource (works for PyInstaller)."""
    if getattr(sys, '_MEIPASS', None):
        return os.path.join(sys._MEIPASS, relative)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative)


def get_project_root():
    """Return the SECTalk project root directory."""
    if getattr(sys, '_MEIPASS', None):
        # When running as .exe, the exe sits inside the project folder
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


# ─── Constants ─────────────────────────────────────────────────────────────────

BG           = "#0f0f0f"
SURFACE      = "#1a1a1a"
SURFACE_2    = "#242424"
BORDER       = "#2a2a2a"
TEXT         = "#e8e8e8"
TEXT_DIM     = "#888888"
ACCENT       = "#6366f1"   # Indigo
ACCENT_HOVER = "#818cf8"
SUCCESS      = "#22c55e"
DANGER       = "#ef4444"
WARNING      = "#f59e0b"


# ─── Application ───────────────────────────────────────────────────────────────

class SECTalkLauncher(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("SECTalk Launcher")
        self.configure(bg=BG)
        self.resizable(False, False)

        # Window size
        w, h = 460, 500
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")

        # Remove default window icon, set taskbar icon
        try:
            self.iconbitmap(default="")
        except Exception:
            pass

        # Dark title bar on Windows 10/11
        self._apply_dark_titlebar()

        # State
        self.backend_proc = None
        self.server_running = False
        self.local_ip = get_local_ip()
        self.server_port = "3001"

        # Fonts
        self.font_title    = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        self.font_subtitle = tkfont.Font(family="Segoe UI", size=10)
        self.font_ip       = tkfont.Font(family="Consolas", size=16, weight="bold")
        self.font_label    = tkfont.Font(family="Segoe UI", size=9)
        self.font_btn      = tkfont.Font(family="Segoe UI", size=12, weight="bold")
        self.font_log      = tkfont.Font(family="Consolas", size=8)
        self.font_status   = tkfont.Font(family="Segoe UI", size=9, weight="bold")

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── Dark Title Bar ────────────────────────────────────────────────────────
    def _apply_dark_titlebar(self):
        """Apply dark title bar on Windows 10+ using dwmapi."""
        try:
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            DWMWA_USE_IMMERSIVE_DARK_MODE = 20
            value = ctypes.c_int(1)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE,
                ctypes.byref(value), ctypes.sizeof(value)
            )
        except Exception:
            pass

    # ── UI Construction ───────────────────────────────────────────────────────
    def _build_ui(self):
        # Top padding
        tk.Frame(self, bg=BG, height=20).pack(fill="x")

        # ── Title Area ─────────────────────────────────────────────────────
        title_frame = tk.Frame(self, bg=BG)
        title_frame.pack(fill="x", padx=30)

        tk.Label(
            title_frame, text="SECTalk", font=self.font_title,
            bg=BG, fg=ACCENT
        ).pack(anchor="w")
        tk.Label(
            title_frame, text="Secure Encrypted Communication",
            font=self.font_subtitle, bg=BG, fg=TEXT_DIM
        ).pack(anchor="w")

        # Divider
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=30, pady=(15, 15))

        # ── Network Info Card ──────────────────────────────────────────────
        card = tk.Frame(self, bg=SURFACE, highlightbackground=BORDER,
                        highlightthickness=1, bd=0)
        card.pack(fill="x", padx=30, pady=(0, 12))

        inner = tk.Frame(card, bg=SURFACE)
        inner.pack(fill="x", padx=20, pady=16)

        tk.Label(
            inner, text="LOCAL IP ADDRESS", font=self.font_label,
            bg=SURFACE, fg=TEXT_DIM
        ).pack(anchor="w")

        ip_row = tk.Frame(inner, bg=SURFACE)
        ip_row.pack(fill="x", pady=(4, 0))

        self.ip_label = tk.Label(
            ip_row, text=self.local_ip, font=self.font_ip,
            bg=SURFACE, fg=TEXT
        )
        self.ip_label.pack(side="left")

        # Copy button
        copy_btn = tk.Label(
            ip_row, text="📋", font=("Segoe UI", 12),
            bg=SURFACE, fg=TEXT_DIM, cursor="hand2"
        )
        copy_btn.pack(side="right")
        copy_btn.bind("<Button-1>", self._copy_ip)
        copy_btn.bind("<Enter>", lambda e: copy_btn.config(fg=TEXT))
        copy_btn.bind("<Leave>", lambda e: copy_btn.config(fg=TEXT_DIM))



        # ── Status Indicator ───────────────────────────────────────────────
        status_frame = tk.Frame(self, bg=BG)
        status_frame.pack(fill="x", padx=30, pady=(0, 12))

        self.status_dot = tk.Canvas(status_frame, width=10, height=10,
                                     bg=BG, highlightthickness=0)
        self.status_dot.pack(side="left")
        self.status_dot.create_oval(1, 1, 9, 9, fill=DANGER, outline="", tags="dot")

        self.status_label = tk.Label(
            status_frame, text="  Server Offline", font=self.font_status,
            bg=BG, fg=DANGER
        )
        self.status_label.pack(side="left")

        # ── Launch Button ──────────────────────────────────────────────────
        self.btn_frame = tk.Frame(self, bg=BG)
        self.btn_frame.pack(fill="x", padx=30, pady=(0, 12))

        self.launch_btn = tk.Canvas(
            self.btn_frame, height=48, bg=ACCENT,
            highlightthickness=0, cursor="hand2"
        )
        self.launch_btn.pack(fill="x")
        self.btn_text = self.launch_btn.create_text(
            0, 24, text="▶  START SERVER", fill="white",
            font=self.font_btn
        )
        # Keep text centered when canvas resizes
        self.launch_btn.bind("<Configure>", lambda e: self.launch_btn.coords(
            self.btn_text, e.width / 2, e.height / 2))
        self.launch_btn.bind("<Button-1>", self._toggle_server)
        self.launch_btn.bind("<Enter>", lambda e: self.launch_btn.config(bg=ACCENT_HOVER))
        self.launch_btn.bind("<Leave>", lambda e: self.launch_btn.config(
            bg=DANGER if self.server_running else ACCENT))

        # ── Open Browser Button ────────────────────────────────────────────
        self.browser_btn = tk.Canvas(
            self.btn_frame, height=36, bg=SURFACE_2,
            highlightthickness=0, cursor="hand2"
        )
        self.browser_btn.pack(fill="x", pady=(8, 0))
        self.browser_btn_text = self.browser_btn.create_text(
            0, 18, text="🌐  Open in Browser",
            fill=TEXT_DIM, font=self.font_label
        )
        # Keep text centered when canvas resizes
        self.browser_btn.bind("<Configure>", lambda e: self.browser_btn.coords(
            self.browser_btn_text, e.width / 2, e.height / 2))
        self.browser_btn.bind("<Button-1>", self._open_browser)
        self.browser_btn.bind("<Enter>", lambda e: self.browser_btn.config(bg=BORDER))
        self.browser_btn.bind("<Leave>", lambda e: self.browser_btn.config(bg=SURFACE_2))

        # ── Log Console ────────────────────────────────────────────────────
        log_label_frame = tk.Frame(self, bg=BG)
        log_label_frame.pack(fill="x", padx=30, pady=(4, 4))
        tk.Label(log_label_frame, text="SERVER LOG", font=self.font_label,
                 bg=BG, fg=TEXT_DIM).pack(anchor="w")

        log_frame = tk.Frame(self, bg=SURFACE, highlightbackground=BORDER,
                             highlightthickness=1, bd=0)
        log_frame.pack(fill="both", expand=True, padx=30, pady=(0, 20))

        self.log_text = tk.Text(
            log_frame, bg=SURFACE, fg=TEXT_DIM, font=self.font_log,
            wrap="word", state="disabled", bd=0, padx=10, pady=8,
            insertbackground=TEXT, selectbackground=ACCENT,
            relief="flat"
        )
        self.log_text.pack(fill="both", expand=True)

        self._log("Ready. Press START SERVER to launch SECTalk.")

    # ── Actions ───────────────────────────────────────────────────────────────

    def _copy_ip(self, event=None):
        self.clipboard_clear()
        self.clipboard_append(self.local_ip)
        self._log(f"Copied IP to clipboard: {self.local_ip}")

    def _log(self, msg):
        self.log_text.config(state="normal")
        self.log_text.insert("end", f"  {msg}\n")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    def _set_status(self, running):
        self.server_running = running
        if running:
            self.status_dot.itemconfig("dot", fill=SUCCESS)
            self.status_label.config(text="  Server Online", fg=SUCCESS)
            self.launch_btn.config(bg=DANGER)
            self.launch_btn.itemconfig(self.btn_text, text="■  STOP SERVER")
        else:
            self.status_dot.itemconfig("dot", fill=DANGER)
            self.status_label.config(text="  Server Offline", fg=DANGER)
            self.launch_btn.config(bg=ACCENT)
            self.launch_btn.itemconfig(self.btn_text, text="▶  START SERVER")

    def _toggle_server(self, event=None):
        if self.server_running:
            self._stop_server()
        else:
            self._start_server()

    def _start_server(self):
        root = get_project_root()
        backend_dir = os.path.join(root, "backend")

        if not os.path.isdir(backend_dir):
            self._log(f"ERROR: Cannot find backend dir in {root}")
            return

        # Look for bundled node.exe first, then fall back to system node
        bundled_node = os.path.join(root, "node", "node.exe")
        if os.path.isfile(bundled_node):
            node_cmd = bundled_node
            self._log(f"Using bundled Node.js")
        else:
            node_cmd = "node"
            self._log(f"Using system Node.js")

        server_script = os.path.join(backend_dir, "server.js")

        # On Windows, combine flags to hide CMD windows and allow process group kill
        if sys.platform == "win32":
            _cflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
        else:
            _cflags = 0

        self._log("Starting SECTalk server...")
        try:
            self.backend_proc = subprocess.Popen(
                [node_cmd, server_script],
                cwd=backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                creationflags=_cflags,
                encoding="utf-8",
                errors="replace"
            )
            threading.Thread(target=self._read_output, args=(self.backend_proc, "SRV"),
                             daemon=True).start()
        except Exception as e:
            self._log(f"ERROR starting server: {e}")
            return

        self._set_status(True)
        self._log("Server starting up... opening browser in 3 seconds.")

        # Wait a moment for the server to spin up, then open the browser
        self.after(3000, self._open_browser)

    def _stop_server(self):
        self._log("Stopping server...")
        self._kill_proc(self.backend_proc)
        self.backend_proc = None
        self._set_status(False)
        self._log("Server stopped.")

    def _kill_proc(self, proc):
        if proc is None:
            return
        try:
            if sys.platform == "win32":
                # Kill the entire process tree on Windows
                subprocess.call(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def _read_output(self, proc, tag):
        """Read subprocess output line-by-line and display in the log."""
        try:
            for line in proc.stdout:
                line = line.rstrip()
                if line:
                    self.after(0, self._log, f"[{tag}] {line}")
        except Exception:
            pass

    def _open_browser(self, event=None):
        url = f"https://{self.local_ip}:{self.server_port}/sectalk"
        self._log(f"Opening browser: {url}")
        webbrowser.open(url)

    def _on_close(self):
        if self.server_running:
            self._stop_server()
        self.destroy()


# ─── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = SECTalkLauncher()
    app.mainloop()
