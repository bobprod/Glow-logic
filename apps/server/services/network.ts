import { exec } from "child_process";
import dgram from "dgram";
import os from "os";
import { SerialPort } from "serialport";

export interface NetworkAdapter {
  name: string;
  description: string;
  status: "Up" | "Disconnected" | "Down" | "unknown";
  ip: string | null;
}

export interface ArtNetNode {
  ip: string;
  shortName: string;
  longName: string;
  mac: string;
  bindIp: string;
}

/**
 * Lists all physical/virtual network adapters on the system.
 * Uses PowerShell on Windows, falls back to Node's os.networkInterfaces() on other platforms.
 */
export function getNetworkAdapters(): Promise<NetworkAdapter[]> {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      return resolve(getFallbackAdapters());
    }

    const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetAdapter | ForEach-Object { $adapter = $_; $ip = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress -First 1; [PSCustomObject]@{ Name = $adapter.Name; Description = $adapter.InterfaceDescription; Status = $adapter.Status; IP = $ip } } | ConvertTo-Json"`;

    exec(command, (error, stdout) => {
      if (error) {
        console.warn("⚠️ [Network] PowerShell adapter query failed, falling back:", error.message);
        return resolve(getFallbackAdapters());
      }

      try {
        const trimmed = stdout.trim();
        if (!trimmed) return resolve([]);
        const parsed = JSON.parse(trimmed);
        const rawList = Array.isArray(parsed) ? parsed : [parsed];

        const adapters: NetworkAdapter[] = rawList.map((item: any) => ({
          name: String(item.Name || ""),
          description: String(item.Description || ""),
          status: item.Status === "Up" ? "Up" : "Disconnected",
          ip: item.IP ? String(item.IP) : null,
        }));

        resolve(adapters);
      } catch (err) {
        console.warn("⚠️ [Network] Failed to parse adapter JSON, falling back:", err);
        resolve(getFallbackAdapters());
      }
    });
  });
}

function getFallbackAdapters(): NetworkAdapter[] {
  const nets = os.networkInterfaces();
  const adapters: NetworkAdapter[] = [];

  for (const name of Object.keys(nets)) {
    const infos = nets[name] || [];
    for (const info of infos) {
      if (info.family === "IPv4" && !info.internal) {
        adapters.push({
          name,
          description: "Interface Réseau Physique",
          status: "Up",
          ip: info.address,
        });
      }
    }
  }
  return adapters;
}

/**
 * Configures static IP address on a Windows network adapter.
 * Uses PowerShell with Start-Process -Verb RunAs to request administrator privilege elevation.
 */
export function configureStaticIp(
  adapterName: string,
  ip: string,
  mask: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      return resolve({
        success: false,
        error: "La configuration d'adresse IP n'est supportée que sur Windows.",
      });
    }

    // Command to set static IP via elevated powershell netsh execution
    const script = `netsh interface ipv4 set address name=\`"${adapterName}\`" static ${ip} ${mask}`;
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \\\"${script}\\\"' -Verb RunAs -Wait"`;

    exec(command, (error, _stdout, stderr) => {
      if (error) {
        console.error("❌ [Network] IP configuration failed:", error);
        return resolve({ success: false, error: stderr || error.message });
      }
      resolve({ success: true });
    });
  });
}

/**
 * Broadcasts an ArtPoll packet on the local network (port 6454) and collects replies.
 * Runs for a specified timeout in milliseconds before returning discovered nodes.
 */
export function pollArtNetNodes(timeoutMs = 3000): Promise<ArtNetNode[]> {
  return new Promise((resolve) => {
    const nodes: Map<string, ArtNetNode> = new Map();
    const socket = dgram.createSocket("udp4");

    socket.on("error", (err) => {
      console.error("⚠️ [ArtPoll] UDP socket error:", err);
      try {
        socket.close();
      } catch {}
      resolve(Array.from(nodes.values()));
    });

    socket.on("message", (msg, rinfo) => {
      try {
        if (msg.length < 14) return;

        // Check header starting with "Art-Net\0"
        const header = msg.toString("ascii", 0, 8);
        if (header !== "Art-Net\0") return;

        // Check OpCode: OpPollReply is 0x2100 (little-endian, so low byte 0x00, high byte 0x21)
        const opCode = msg.readUInt16LE(8);
        if (opCode === 0x2100) {
          const ip = msg.slice(10, 14).join(".");
          
          // ShortName: bytes 26 to 43 (18 bytes)
          const shortName = msg
            .toString("ascii", 26, 44)
            .replace(/\0/g, "")
            .trim();

          // LongName: bytes 44 to 107 (64 bytes)
          const longName = msg
            .toString("ascii", 44, 108)
            .replace(/\0/g, "")
            .trim();

          // MAC Address: bytes 201 to 206 (6 bytes)
          let mac = "";
          if (msg.length >= 207) {
            mac = Array.from(msg.slice(201, 207))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(":");
          }

          nodes.set(ip, {
            ip,
            shortName: shortName || "Art-Net Node",
            longName: longName || "Generic Art-Net Interface",
            mac: mac || "00:00:00:00:00:00",
            bindIp: rinfo.address,
          });
        }
      } catch (err) {
        console.error("⚠️ [ArtPoll] Failed to parse poll reply:", err);
      }
    });

    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);

        // ArtPoll Packet Structure (14 bytes):
        // 0-7: "Art-Net\0"
        // 8-9: 0x2000 (OpPoll, little-endian = 0x00, 0x20)
        // 10-11: 0x000e (ProtVer 14, big-endian = 0x00, 0x0e)
        // 12: TalkToMe = 0x02 (Send replies, no diagnostics)
        // 13: Priority = 0x00
        const artPollPacket = Buffer.from([
          0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // Header
          0x00, 0x20, // OpCode OpPoll
          0x00, 0x0e, // ProtVer 14
          0x02,       // TalkToMe
          0x00,       // Priority
        ]);

        // Broadcast to general network
        socket.send(artPollPacket, 6454, "255.255.255.255", (err) => {
          if (err) console.error("⚠️ [ArtPoll] Broadcast send failed:", err);
        });

        // Broadcast to typical Art-Net standard subnets
        socket.send(artPollPacket, 6454, "2.255.255.255", () => {});
        socket.send(artPollPacket, 6454, "10.255.255.255", () => {});

      } catch (err) {
        console.error("⚠️ [ArtPoll] Socket broadcast prep failed:", err);
        try {
          socket.close();
        } catch {}
        resolve([]);
      }
    });

    setTimeout(() => {
      try {
        socket.close();
      } catch {}
      resolve(Array.from(nodes.values()));
    }, timeoutMs);
  });
}

/**
 * Diagnostics check for USB-DMX serial ports.
 * Attempts to briefly open the selected COM port to verify FTDI connectivity.
 */
export function diagnoseUsbPort(portPath: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (!portPath) {
      return resolve({ success: false, message: "Aucun port COM sélectionné." });
    }

    const port = new SerialPort({
      path: portPath,
      baudRate: 250000,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        return resolve({
          success: false,
          message: `Impossible d'ouvrir le port ${portPath} : ${err.message}`,
        });
      }

      port.close((closeErr) => {
        resolve({
          success: true,
          message: `Port ${portPath} ouvert avec succès. Puce FTDI active.${
            closeErr ? ` (Note fermeture: ${closeErr.message})` : ""
          }`,
        });
      });
    });
  });
}
