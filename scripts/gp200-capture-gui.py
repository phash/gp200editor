#!/usr/bin/env python3
"""
GP-200 Capture GUI
==================
Kleines grafisches Tool, um eine USB-MIDI-Aufnahme (Capture) des Valeton GP-200
ohne Kommandozeile durchzuführen. Gedacht für Anwender, die ein Problem mit dem
Editor / der Live-USB-Verbindung haben und den Entwicklern eine Aufnahme schicken
möchten.

Es ist die GUI-Variante von ``capture-windows.ps1`` und nutzt darunter dasselbe
``tshark`` (Wireshark). Es werden KEINE pip-Pakete benötigt — nur Python 3 mit
Tkinter (Standardbibliothek) und eine Wireshark-Installation mit tshark + USBPcap.

Start:
  python scripts/gp200-capture-gui.py        (Windows: am besten "als Administrator")

Ablauf:
  1. GP-200 per USB anschließen und einschalten
  2. Tool starten, USB-Interface auswählen
  3. (Optional) kurze Problembeschreibung eintippen → landet im Dateinamen
  4. "Aufnahme starten" → im Browser-Editor / in der Valeton-Software das Problem
     reproduzieren → "Aufnahme stoppen"
  5. Die .pcap-Datei den Entwicklern schicken (GitHub-Issue / E-Mail)

Anleitung mit Installation: docs/capture-tool.md
"""

from __future__ import annotations

import importlib.util
import os
import re
import signal
import subprocess
import sys
from datetime import datetime

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
IS_WINDOWS = sys.platform == "win32"


# ---- tshark discovery (reuse analyze-sysex.py, fall back to inline) ----------

def _find_tshark() -> str | None:
    """Locate tshark. Reuses analyze-sysex.find_tshark when importable."""
    try:
        spec = importlib.util.spec_from_file_location(
            "analyze_sysex", os.path.join(SCRIPT_DIR, "analyze-sysex.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        # analyze-sysex.find_tshark exits the process if not found, so guard it
        candidates = ["tshark"]
        if IS_WINDOWS:
            candidates += [
                r"C:\Program Files\Wireshark\tshark.exe",
                r"C:\Program Files (x86)\Wireshark\tshark.exe",
            ]
        for c in candidates:
            try:
                subprocess.run([c, "--version"], capture_output=True, check=True)
                return c
            except (FileNotFoundError, subprocess.CalledProcessError):
                continue
    except Exception:
        pass
    return None


def _is_admin() -> bool:
    if not IS_WINDOWS:
        return os.geteuid() == 0 if hasattr(os, "geteuid") else True
    try:
        import ctypes

        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def _slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:40]


# ---- GUI --------------------------------------------------------------------

class CaptureApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("GP-200 USB-Capture")
        self.geometry("680x620")
        self.minsize(620, 560)

        self.tshark = _find_tshark()
        self.proc: subprocess.Popen | None = None
        self.out_file: str | None = None
        self.start_time: datetime | None = None
        self._poll_job: str | None = None

        self.interfaces: list[tuple[str, str]] = []  # (id, description)

        self._build_ui()
        self._refresh_status()
        if self.tshark:
            self.refresh_interfaces()

    # -- layout ---------------------------------------------------------------

    def _build_ui(self) -> None:
        pad = dict(padx=10, pady=4)

        header = ttk.Label(
            self,
            text="GP-200 USB-Capture",
            font=("Segoe UI", 16, "bold"),
        )
        header.pack(anchor="w", padx=10, pady=(10, 0))

        intro = ttk.Label(
            self,
            text=(
                "Nimmt die USB-Kommunikation zwischen PC und GP-200 auf, damit "
                "Entwickler ein Problem nachvollziehen können.\n"
                "GP-200 anschließen → Interface wählen → Aufnahme starten → Problem "
                "reproduzieren → stoppen → Datei einsenden."
            ),
            wraplength=640,
            justify="left",
        )
        intro.pack(anchor="w", **pad)

        # Status box
        self.status_var = tk.StringVar()
        status = ttk.Label(self, textvariable=self.status_var, wraplength=640, justify="left")
        status.pack(anchor="w", **pad)

        # Interface selection
        ifrm = ttk.LabelFrame(self, text="USB-Interface")
        ifrm.pack(fill="x", **pad)
        self.iface_var = tk.StringVar()
        self.iface_combo = ttk.Combobox(ifrm, textvariable=self.iface_var, state="readonly", width=60)
        self.iface_combo.grid(row=0, column=0, padx=6, pady=6, sticky="we")
        self.usb_only = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            ifrm, text="nur USB-Interfaces", variable=self.usb_only, command=self.refresh_interfaces
        ).grid(row=0, column=1, padx=6)
        ttk.Button(ifrm, text="Aktualisieren", command=self.refresh_interfaces).grid(
            row=0, column=2, padx=6
        )
        ifrm.columnconfigure(0, weight=1)

        # Output folder + description
        ofrm = ttk.LabelFrame(self, text="Speicherort & Beschreibung")
        ofrm.pack(fill="x", **pad)
        default_dir = self._default_outdir()
        self.dir_var = tk.StringVar(value=default_dir)
        ttk.Label(ofrm, text="Ordner:").grid(row=0, column=0, sticky="w", padx=6, pady=4)
        ttk.Entry(ofrm, textvariable=self.dir_var).grid(row=0, column=1, sticky="we", padx=6)
        ttk.Button(ofrm, text="…", width=3, command=self._choose_dir).grid(row=0, column=2, padx=6)
        ttk.Label(ofrm, text="Problem (kurz):").grid(row=1, column=0, sticky="w", padx=6, pady=4)
        self.desc_var = tk.StringVar()
        ttk.Entry(ofrm, textvariable=self.desc_var).grid(row=1, column=1, sticky="we", padx=6)
        ttk.Label(ofrm, text="z. B. ir-load-crash", foreground="gray").grid(
            row=1, column=2, sticky="w", padx=6
        )
        ofrm.columnconfigure(1, weight=1)

        # Big start/stop button
        self.action_btn = ttk.Button(self, text="● Aufnahme starten", command=self.toggle_capture)
        self.action_btn.pack(fill="x", padx=10, pady=8)

        self.timer_var = tk.StringVar(value="")
        ttk.Label(self, textvariable=self.timer_var, font=("Consolas", 11)).pack(anchor="w", padx=10)

        # Log
        self.log = scrolledtext.ScrolledText(self, height=12, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True, padx=10, pady=(4, 6))

        # Post-capture actions
        self.post_frame = ttk.Frame(self)
        self.post_frame.pack(fill="x", padx=10, pady=(0, 10))
        self.analyze_btn = ttk.Button(
            self.post_frame, text="Analysieren", command=self._analyze, state="disabled"
        )
        self.analyze_btn.pack(side="left")
        self.open_btn = ttk.Button(
            self.post_frame, text="Ordner öffnen", command=self._open_folder, state="disabled"
        )
        self.open_btn.pack(side="left", padx=6)

    # -- helpers --------------------------------------------------------------

    def _default_outdir(self) -> str:
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        return desktop if os.path.isdir(desktop) else os.path.expanduser("~")

    def _log(self, msg: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _refresh_status(self) -> None:
        lines = []
        if self.tshark:
            lines.append(f"✓ tshark gefunden: {self.tshark}")
        else:
            lines.append(
                "✗ tshark NICHT gefunden. Bitte Wireshark mit 'TShark' + 'USBPcap' installieren "
                "(siehe docs/capture-tool.md)."
            )
        if IS_WINDOWS and not _is_admin():
            lines.append(
                "⚠ Nicht als Administrator gestartet — USB-Aufnahme braucht meist Admin-Rechte."
            )
        self.status_var.set("\n".join(lines))
        self.action_btn.configure(state="normal" if self.tshark else "disabled")

    def _choose_dir(self) -> None:
        d = filedialog.askdirectory(initialdir=self.dir_var.get() or os.path.expanduser("~"))
        if d:
            self.dir_var.set(d)

    # -- interfaces -----------------------------------------------------------

    def refresh_interfaces(self) -> None:
        if not self.tshark:
            return
        try:
            res = subprocess.run([self.tshark, "-D"], capture_output=True, text=True)
        except Exception as e:  # noqa: BLE001
            self._log(f"Interface-Liste fehlgeschlagen: {e}")
            return
        self.interfaces = []
        for line in res.stdout.splitlines():
            m = re.match(r"^\s*(\d+)\.\s+(\S+)\s*(?:\((.*)\))?", line)
            if not m:
                continue
            idx, ident, desc = m.group(1), m.group(2), (m.group(3) or "")
            label = f"{idx}: {desc or ident}"
            is_usb = ("usbpcap" in line.lower()) or ("usbmon" in line.lower())
            if self.usb_only.get() and not is_usb:
                continue
            self.interfaces.append((idx, label))
        values = [lbl for _, lbl in self.interfaces]
        self.iface_combo.configure(values=values)
        if values:
            self.iface_combo.current(0)
            self._log(f"{len(values)} Interface(s) gefunden.")
        else:
            self._log(
                "Keine USB-Interfaces gefunden. USBPcap installiert? "
                "Haken 'nur USB-Interfaces' entfernen, um alle zu sehen."
            )

    def _selected_iface_id(self) -> str | None:
        sel = self.iface_var.get()
        for idx, lbl in self.interfaces:
            if lbl == sel:
                return idx
        return None

    # -- capture --------------------------------------------------------------

    def toggle_capture(self) -> None:
        if self.proc is None:
            self.start_capture()
        else:
            self.stop_capture()

    def start_capture(self) -> None:
        iface = self._selected_iface_id()
        if not iface:
            messagebox.showwarning("Kein Interface", "Bitte zuerst ein USB-Interface auswählen.")
            return
        out_dir = self.dir_var.get().strip() or self._default_outdir()
        try:
            os.makedirs(out_dir, exist_ok=True)
        except Exception as e:  # noqa: BLE001
            messagebox.showerror("Ordner", f"Ordner nicht nutzbar:\n{e}")
            return

        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        slug = _slugify(self.desc_var.get())
        name = f"gp200-capture-{ts}{('-' + slug) if slug else ''}.pcap"
        self.out_file = os.path.join(out_dir, name)

        cmd = [self.tshark, "-i", iface, "-w", self.out_file]
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if IS_WINDOWS else 0
        try:
            self.proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags,
            )
        except Exception as e:  # noqa: BLE001
            messagebox.showerror("Start fehlgeschlagen", str(e))
            self.proc = None
            return

        self.start_time = datetime.now()
        self.action_btn.configure(text="■ Aufnahme stoppen")
        self.analyze_btn.configure(state="disabled")
        self.open_btn.configure(state="disabled")
        self._set_inputs_state("disabled")
        self._log("")
        self._log(f"▶ Aufnahme läuft → {self.out_file}")
        self._log("   Jetzt im Editor / in der Valeton-Software das Problem reproduzieren.")
        self._poll()

    def stop_capture(self) -> None:
        if self.proc is None:
            return
        self._log("■ Stoppe Aufnahme …")
        try:
            if IS_WINDOWS:
                # Clean stop so tshark flushes the final pcap block.
                self.proc.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                self.proc.terminate()
            self.proc.wait(timeout=8)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass
        self.proc = None
        if self._poll_job:
            self.after_cancel(self._poll_job)
            self._poll_job = None
        self.action_btn.configure(text="● Aufnahme starten")
        self._set_inputs_state("normal")

        if self.out_file and os.path.exists(self.out_file):
            size = os.path.getsize(self.out_file)
            self._log(f"✓ Gespeichert: {self.out_file}  ({size/1024:.0f} KB)")
            self._log("→ Diese Datei den Entwicklern schicken (GitHub-Issue oder E-Mail).")
            self.analyze_btn.configure(state="normal")
            self.open_btn.configure(state="normal")
            if size < 2048:
                self._log(
                    "⚠ Datei ist sehr klein — evtl. falsches Interface? "
                    "Anderes USB-Interface probieren und erneut aufnehmen."
                )
        else:
            self._log("✗ Keine Datei erzeugt. Falsches Interface oder fehlende Rechte?")

    def _set_inputs_state(self, state: str) -> None:
        self.iface_combo.configure(state="readonly" if state == "normal" else "disabled")

    def _poll(self) -> None:
        if self.proc is None:
            return
        if self.start_time:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            size = os.path.getsize(self.out_file) if (self.out_file and os.path.exists(self.out_file)) else 0
            self.timer_var.set(f"⏱  {int(elapsed)}s   ·   {size/1024:.0f} KB aufgenommen")
        if self.proc.poll() is not None:
            # tshark exited on its own (e.g. error)
            self._log("tshark wurde beendet.")
            self.stop_capture()
            return
        self._poll_job = self.after(500, self._poll)

    # -- post actions ---------------------------------------------------------

    def _analyze(self) -> None:
        if not self.out_file:
            return
        analyzer = os.path.join(SCRIPT_DIR, "analyze-sysex.py")
        if not os.path.exists(analyzer):
            messagebox.showinfo("Analyse", "analyze-sysex.py nicht gefunden.")
            return
        self._log("")
        self._log("--- Analyse (analyze-sysex.py) ---")
        try:
            res = subprocess.run(
                [sys.executable, analyzer, self.out_file],
                capture_output=True, text=True,
            )
            out = res.stdout.strip() or res.stderr.strip()
            # show a compact head so the log stays readable
            for line in out.splitlines()[:40]:
                self._log(line)
            if len(out.splitlines()) > 40:
                self._log(f"… (gekürzt, volle Ausgabe via: python scripts/analyze-sysex.py \"{self.out_file}\")")
        except Exception as e:  # noqa: BLE001
            self._log(f"Analyse fehlgeschlagen: {e}")

    def _open_folder(self) -> None:
        if not self.out_file:
            return
        folder = os.path.dirname(self.out_file)
        try:
            if IS_WINDOWS:
                os.startfile(folder)  # noqa: S606
            elif sys.platform == "darwin":
                subprocess.run(["open", folder])
            else:
                subprocess.run(["xdg-open", folder])
        except Exception as e:  # noqa: BLE001
            self._log(f"Ordner öffnen fehlgeschlagen: {e}")


def main() -> None:
    app = CaptureApp()
    app.mainloop()


if __name__ == "__main__":
    main()
