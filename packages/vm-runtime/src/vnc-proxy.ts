import * as net from 'net';
import { VmDisplay, VmInfo, VmState } from './vm-types';

/**
 * VNC WebSocket Proxy - Bridges QEMU VNC Unix socket to WebSocket clients.
 * Based on GitCortex Studio's VncWebSocketProxy.
 */
export class VncWebSocketProxy {
  private vncSocketPath: string;
  private server: net.Server | null = null;
  private connectedClients: Set<net.Socket> = new Set();
  private vncConnection: net.Socket | null = null;

  constructor(vncSocketPath: string) {
    this.vncSocketPath = vncSocketPath;
  }

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((clientSocket) => {
        this.handleClient(clientSocket);
      });

      this.server.on('error', reject);
      this.server.listen(port, () => {
        console.log(`[VNC Proxy] Listening on port ${port}, proxying to ${this.vncSocketPath}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Disconnect all clients
      for (const client of this.connectedClients) {
        client.end();
      }
      this.connectedClients.clear();

      // Disconnect from VNC
      if (this.vncConnection) {
        this.vncConnection.end();
        this.vncConnection = null;
      }

      // Close server
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getDisplayInfo(vmId: string, token: string): VmDisplay {
    const port = this.server?.address() ? (this.server.address() as net.AddressInfo).port : 0;
    return {
      vmId,
      webSocketUrl: `ws://localhost:${port}`,
      token,
    };
  }

  private async handleClient(clientSocket: net.Socket): Promise<void> {
    this.connectedClients.add(clientSocket);

    try {
      // Connect to QEMU VNC socket if not already connected
      if (!this.vncConnection) {
        await this.connectToVnc();
      }

      // Pipe VNC data to client
      this.vncConnection!.pipe(clientSocket);

      // Pipe client data to VNC
      clientSocket.pipe(this.vncConnection!);

      clientSocket.on('close', () => {
        this.connectedClients.delete(clientSocket);
      });

      clientSocket.on('error', () => {
        this.connectedClients.delete(clientSocket);
      });
    } catch (err) {
      clientSocket.end();
      this.connectedClients.delete(clientSocket);
    }
  }

  private connectToVnc(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.vncConnection = net.createConnection({ path: this.vncSocketPath });

      this.vncConnection.on('connect', () => {
        console.log(`[VNC Proxy] Connected to QEMU VNC at ${this.vncSocketPath}`);
        resolve();
      });

      this.vncConnection.on('error', (err) => {
        console.error(`[VNC Proxy] Failed to connect to VNC:`, err);
        reject(err);
      });
    });
  }
}
