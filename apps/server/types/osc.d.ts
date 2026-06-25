declare module 'osc' {
  export class UDPPort {
    constructor(options: any);
    open(): void;
    send(oscMessage: any, address?: string, port?: number): void;
    on(event: string, callback: (...args: any[]) => void): void;
    close(): void;
  }
}
