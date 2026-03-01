export type HostKeyEventType = 'unknown_accepted' | 'unknown_rejected' | 'mismatch_blocked';

export interface HostKeyEvent {
  id: string;
  type: HostKeyEventType;
  timestamp: string;
  host: string;
  port: number;
  displayHost: string;
  hostCandidates: string[];
  keyType: string;
  presentedFingerprint: string;
  knownFingerprints: string[];
}
