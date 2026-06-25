declare module 'artnet-node' {
    export function createClient(options: any): any;
    const artnet: {
        createClient: typeof createClient;
    };
    export default artnet;
}
