"""
Glow Logic DMX Bridge — Python
Génère le signal BREAK correctement pour le dongle FTDI UTD-10
Protocol: DMX512 @ 250000 baud avec BREAK via Windows API SetCommBreak/ClearCommBreak
Reçoit des commandes JSON sur stdin, envoie DMX sur COM5
"""
import sys
import json
import time
import ctypes
import ctypes.wintypes
import threading

# ── Windows Serial API ─────────────────────────────────────────
kernel32 = ctypes.windll.kernel32

GENERIC_READ        = 0x80000000
GENERIC_WRITE       = 0x40000000
OPEN_EXISTING       = 3
FILE_ATTRIBUTE_NORMAL = 0x80
INVALID_HANDLE_VALUE = -1

# Configure 64-bit safe signatures (argtypes / restypes)
kernel32.CreateFileW.argtypes = [ctypes.wintypes.LPCWSTR, ctypes.wintypes.DWORD, ctypes.wintypes.DWORD, ctypes.c_void_p, ctypes.wintypes.DWORD, ctypes.wintypes.DWORD, ctypes.wintypes.HANDLE]
kernel32.CreateFileW.restype = ctypes.c_void_p

kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
kernel32.CloseHandle.restype = ctypes.wintypes.BOOL

kernel32.GetCommState.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
kernel32.GetCommState.restype = ctypes.wintypes.BOOL

kernel32.SetCommState.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
kernel32.SetCommState.restype = ctypes.wintypes.BOOL

kernel32.SetCommTimeouts.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
kernel32.SetCommTimeouts.restype = ctypes.wintypes.BOOL

kernel32.EscapeCommFunction.argtypes = [ctypes.c_void_p, ctypes.wintypes.DWORD]
kernel32.EscapeCommFunction.restype = ctypes.wintypes.BOOL

kernel32.SetCommBreak.argtypes = [ctypes.c_void_p]
kernel32.SetCommBreak.restype = ctypes.wintypes.BOOL

kernel32.ClearCommBreak.argtypes = [ctypes.c_void_p]
kernel32.ClearCommBreak.restype = ctypes.wintypes.BOOL

kernel32.WriteFile.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.wintypes.DWORD, ctypes.POINTER(ctypes.wintypes.DWORD), ctypes.c_void_p]
kernel32.WriteFile.restype = ctypes.wintypes.BOOL

class DCB(ctypes.Structure):
    _fields_ = [
        ("DCBlength",        ctypes.wintypes.DWORD),
        ("BaudRate",         ctypes.wintypes.DWORD),
        ("fBinary",          ctypes.wintypes.DWORD, 1),
        ("fParity",          ctypes.wintypes.DWORD, 1),
        ("fOutxCtsFlow",     ctypes.wintypes.DWORD, 1),
        ("fOutxDsrFlow",     ctypes.wintypes.DWORD, 1),
        ("fDtrControl",      ctypes.wintypes.DWORD, 2),
        ("fDsrSensitivity",  ctypes.wintypes.DWORD, 1),
        ("fTXContinueOnXoff",ctypes.wintypes.DWORD, 1),
        ("fOutX",            ctypes.wintypes.DWORD, 1),
        ("fInX",             ctypes.wintypes.DWORD, 1),
        ("fErrorChar",       ctypes.wintypes.DWORD, 1),
        ("fNull",            ctypes.wintypes.DWORD, 1),
        ("fRtsControl",      ctypes.wintypes.DWORD, 2),
        ("fAbortOnError",    ctypes.wintypes.DWORD, 1),
        ("fDummy2",          ctypes.wintypes.DWORD, 17),
        ("wReserved",        ctypes.wintypes.WORD),
        ("XonLim",           ctypes.wintypes.WORD),
        ("XoffLim",          ctypes.wintypes.WORD),
        ("ByteSize",         ctypes.c_byte),
        ("Parity",           ctypes.c_byte),
        ("StopBits",         ctypes.c_byte),
        ("XonChar",          ctypes.c_char),
        ("XoffChar",         ctypes.c_char),
        ("ErrorChar",        ctypes.c_char),
        ("EofChar",          ctypes.c_char),
        ("EvtChar",          ctypes.c_char),
        ("wReserved1",       ctypes.wintypes.WORD),
    ]

class COMMTIMEOUTS(ctypes.Structure):
    _fields_ = [
        ("ReadIntervalTimeout",         ctypes.wintypes.DWORD),
        ("ReadTotalTimeoutMultiplier",  ctypes.wintypes.DWORD),
        ("ReadTotalTimeoutConstant",    ctypes.wintypes.DWORD),
        ("WriteTotalTimeoutMultiplier", ctypes.wintypes.DWORD),
        ("WriteTotalTimeoutConstant",   ctypes.wintypes.DWORD),
    ]

class DmxBridge:
    def __init__(self, port="COM5"):
        self.port    = port
        self.handle  = None
        self.buffer  = bytearray(512)  # DMX channels 1-512
        self.running = False
        self.lock    = threading.Lock()

    def open(self):
        # Open serial port via Windows API
        h = kernel32.CreateFileW(
            f"\\\\.\\{self.port}",
            GENERIC_READ | GENERIC_WRITE,
            0, None, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, None
        )
        if h == INVALID_HANDLE_VALUE or h == 0 or h == 18446744073709551615:
            raise RuntimeError(f"Cannot open {self.port}: error {kernel32.GetLastError()}")
        self.handle = h

        # Configure DCB: 250000 baud, 8N2 (DMX standard)
        dcb = DCB()
        dcb.DCBlength = ctypes.sizeof(DCB)
        kernel32.GetCommState(h, ctypes.byref(dcb))
        dcb.BaudRate  = 250000
        dcb.ByteSize  = 8
        dcb.Parity    = 0   # NOPARITY
        dcb.StopBits  = 2   # TWOSTOPBITS
        dcb.fBinary   = 1
        kernel32.SetCommState(h, ctypes.byref(dcb))

        # Timeouts
        ct = COMMTIMEOUTS()
        ct.ReadIntervalTimeout         = 0xFFFFFFFF
        ct.ReadTotalTimeoutMultiplier  = 0
        ct.ReadTotalTimeoutConstant    = 0
        ct.WriteTotalTimeoutMultiplier = 0
        ct.WriteTotalTimeoutConstant   = 2000
        kernel32.SetCommTimeouts(h, ctypes.byref(ct))

        # Enable RTS and DTR to enable RS-485 transceiver driver (DE/RE pins)
        SETRTS = 3
        SETDTR = 5
        kernel32.EscapeCommFunction(h, SETRTS)
        kernel32.EscapeCommFunction(h, SETDTR)

        print(f"[DMX Bridge] {self.port} ouvert @ 250000 baud (RTS/DTR ON)", flush=True)
        return True

    def close(self):
        if self.handle:
            kernel32.CloseHandle(self.handle)
            self.handle = None

    def set_channel(self, channel, value):
        """channel: 1-indexed, value: 0-255"""
        with self.lock:
            if 1 <= channel <= 512:
                self.buffer[channel - 1] = max(0, min(255, value))

    def send_frame(self):
        """Send one complete DMX frame with proper BREAK signal"""
        h = self.handle
        if not h:
            return

        # 1. BREAK: pull TX line low for ≥88µs
        kernel32.SetCommBreak(h)
        time.sleep(0.001)  # 1ms >> 88µs minimum

        # 2. MAB: release break for ≥8µs
        kernel32.ClearCommBreak(h)
        time.sleep(0.0001)  # 100µs

        # 3. Send start code (0x00) + 512 channel bytes
        frame = bytes([0x00]) + bytes(self.buffer)
        written = ctypes.wintypes.DWORD(0)
        res = kernel32.WriteFile(h, frame, len(frame), ctypes.byref(written), None)
        if not res:
            print(f"[DMX Bridge] WriteFile failed: error {kernel32.GetLastError()}", flush=True)

    def run_loop(self):
        """Send DMX at ~44Hz"""
        self.running = True
        interval = 1.0 / 44
        while self.running:
            t0 = time.monotonic()
            try:
                self.send_frame()
            except Exception as e:
                print(f"[DMX Bridge] send error: {e}", flush=True)
                time.sleep(1)
            elapsed = time.monotonic() - t0
            wait = interval - elapsed
            if wait > 0:
                time.sleep(wait)

    def stop(self):
        self.running = False


# ── Main: read JSON commands from stdin ────────────────────────
def kill_other_instances():
    import os
    import subprocess
    mypid = os.getpid()
    try:
        # Tuer tout autre processus dmx_bridge.py en cours
        cmd = f"powershell -NoProfile -Command \"Get-Process | Where-Object {{ $_.Name -match 'python' }} | ForEach-Object {{ $cmd = (Get-CimInstance Win32_Process -Filter \\\"ProcessId = $($_.Id)\\\").CommandLine; if ($cmd -like '*dmx_bridge.py*' -and $_.Id -ne {mypid}) {{ Stop-Process -Id $_.Id -Force }} }}\""
        subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def main():
    # Auto-nettoyage des instances orphelines avant d'ouvrir le port
    kill_other_instances()
    
    bridge = DmxBridge("COM5")

    try:
        bridge.open()
    except RuntimeError as e:
        print(json.dumps({"error": str(e)}), flush=True)
        sys.exit(1)

    # Start DMX loop in background thread
    t = threading.Thread(target=bridge.run_loop, daemon=True)
    t.start()

    print(json.dumps({"status": "ready", "port": "COM5"}), flush=True)

    # Read commands line-by-line (using readline to avoid iterator buffering)
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
            if cmd.get("cmd") == "quit":
                break
            ch  = int(cmd.get("channel", 1))
            val = int(cmd.get("value", 0))
            bridge.set_channel(ch, val)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

    bridge.stop()
    bridge.close()
    print(json.dumps({"status": "closed"}), flush=True)


if __name__ == "__main__":
    main()
