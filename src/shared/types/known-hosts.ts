export interface KnownHostEntry {
  id: string;
  hostPattern: string;
  displayHost: string;
  keyType: string;
  fingerprint: string;
  lineNumber: number;
  hashed: boolean;
}
