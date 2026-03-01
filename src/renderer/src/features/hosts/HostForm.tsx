import { useEffect, useState } from 'react';
import type { Host, CreateHostInput, UpdateHostInput } from '@shared/types/hosts';
import type { PortForwardConfig } from '@shared/types/port-forward';
import { useHostStore } from '@/stores/host-store';
import { useKeyStore } from '@/stores/key-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Server, KeyRound, Lock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HostFormProps {
  onClose: () => void;
  workspaceId: string;
  host?: Host | null;
}

const MIN_PORT = 1;
const MAX_PORT = 65535;

function parsePort(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_PORT || value > MAX_PORT) {
    return null;
  }
  return value;
}

function isValidForwardPort(port: number): boolean {
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
}

export function HostForm({ onClose, workspaceId, host }: HostFormProps) {
  const { createHost, updateHost } = useHostStore();
  const { keys, fetchKeys } = useKeyStore();

  const [label, setLabel] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState('');
  const [portForwards, setPortForwards] = useState<PortForwardConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchKeys(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (host) {
      setLabel(host.label);
      setHostname(host.hostname);
      setPort(String(host.port));
      setUsername(host.username);
      setAuthType(host.authType);
      setPassword('');
      setKeyId(host.keyId ?? '');
      setPortForwards(host.portForwards ?? []);
    } else {
      setLabel('');
      setHostname('');
      setPort('22');
      setUsername('');
      setAuthType('password');
      setPassword('');
      setKeyId('');
      setPortForwards([]);
    }
    setError(null);
  }, [host]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const parsedPort = parsePort(port);
    if (!parsedPort) {
      setError(`Port must be an integer between ${MIN_PORT} and ${MAX_PORT}.`);
      setLoading(false);
      return;
    }

    const normalizedLabel = label.trim();
    const normalizedHostname = hostname.trim();
    const normalizedUsername = username.trim();
    const normalizedForwards = portForwards.map((pf) => ({
      ...pf,
      remoteHost: pf.remoteHost.trim(),
    }));

    if (!normalizedLabel || !normalizedHostname || !normalizedUsername) {
      setError('Label, hostname, and username are required.');
      setLoading(false);
      return;
    }

    const invalidForward = normalizedForwards.find(
      (pf) =>
        !isValidForwardPort(pf.localPort) ||
        !isValidForwardPort(pf.remotePort) ||
        !pf.remoteHost
    );
    if (invalidForward) {
      setError(`Port forwards must use ports ${MIN_PORT}-${MAX_PORT} and include a remote host.`);
      setLoading(false);
      return;
    }

    if (authType === 'key' && !keyId) {
      setError('Select an SSH key or switch to password authentication.');
      setLoading(false);
      return;
    }

    try {
      if (host) {
        const update: UpdateHostInput = {
          label: normalizedLabel,
          hostname: normalizedHostname,
          port: parsedPort,
          username: normalizedUsername,
          authType,
          password: authType === 'password' ? password || null : null,
          keyId: authType === 'key' ? keyId || null : null,
          portForwards: normalizedForwards,
        };
        await updateHost(host.id, update);
      } else {
        const input: CreateHostInput = {
          workspaceId,
          label: normalizedLabel,
          hostname: normalizedHostname,
          port: parsedPort,
          username: normalizedUsername,
          authType,
          password: authType === 'password' ? password || null : null,
          keyId: authType === 'key' ? keyId || null : null,
          portForwards: normalizedForwards,
        };
        await createHost(input);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col w-full h-full border-l bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b shrink-0">
        <Server className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1">
          {host ? 'Edit Host' : 'New Host'}
        </span>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5 min-h-0">
        <form id="host-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Connection section */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connection</p>
            <div className="space-y-1.5">
              <Label htmlFor="hf-label" className="text-xs">Display Name</Label>
              <Input
                id="hf-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="Production Server"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-hostname" className="text-xs">Hostname / IP</Label>
              <Input
                id="hf-hostname"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                required
                placeholder="192.168.1.1 or server.example.com"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="hf-port" className="text-xs">Port</Label>
                <Input
                  id="hf-port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  min={1}
                  max={65535}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="hf-username" className="text-xs">Username</Label>
                <Input
                  id="hf-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="root"
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Auth section */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Authentication</p>

            {/* Auth type toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted/50">
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  authType === 'password'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setAuthType('password')}
              >
                <Lock className="h-3 w-3" />
                Password
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  authType === 'key'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setAuthType('key')}
              >
                <KeyRound className="h-3 w-3" />
                SSH Key
              </button>
            </div>

            {authType === 'password' && (
              <div className="space-y-1.5">
                <Label htmlFor="hf-password" className="text-xs">Password</Label>
                <Input
                  id="hf-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-8 text-sm w-full"
                />
              </div>
            )}

            {authType === 'key' && (
              <div className="space-y-1.5">
                <Label className="text-xs">SSH Key</Label>
                <Select value={keyId} onValueChange={(v) => { if (v) setKeyId(v); }}>
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder="Select a key...">
                      {keyId ? keys.find((k) => k.id === keyId)?.name || 'Select a key...' : 'Select a key...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {keys.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No keys imported
                      </SelectItem>
                    ) : (
                      keys.map((k) => (
                        <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {keys.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Import keys in Settings &rarr; SSH Keys
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />
          {/* Port Forwarding section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Port Forwarding</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setPortForwards([...portForwards, { id: crypto.randomUUID(), type: 'local', localPort: 8080, remoteHost: '127.0.0.1', remotePort: 80 }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            
            {portForwards.length === 0 ? (
              <p className="text-xs text-muted-foreground">No port forwards configured.</p>
            ) : (
              <div className="space-y-2">
                {portForwards.map((pf) => (
                  <div key={pf.id} className="p-2 border rounded-md space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Select
                        value={pf.type}
                        onValueChange={(v: string | null) => {
                          if (v === 'local' || v === 'remote') {
                            setPortForwards(portForwards.map(p => p.id === pf.id ? { ...p, type: v } : p))
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Local</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => setPortForwards(portForwards.filter(p => p.id !== pf.id))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Local Port</Label>
                        <Input
                          type="number"
                          value={pf.localPort}
                          onChange={(e) => {
                            const parsed = parsePort(e.target.value);
                            if (parsed === null) return;
                            setPortForwards(portForwards.map(p => p.id === pf.id ? { ...p, localPort: parsed } : p));
                          }}
                          className="h-6 text-xs"
                          min={MIN_PORT}
                          max={MAX_PORT}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Remote Port</Label>
                        <Input
                          type="number"
                          value={pf.remotePort}
                          onChange={(e) => {
                            const parsed = parsePort(e.target.value);
                            if (parsed === null) return;
                            setPortForwards(portForwards.map(p => p.id === pf.id ? { ...p, remotePort: parsed } : p));
                          }}
                          className="h-6 text-xs"
                          min={MIN_PORT}
                          max={MAX_PORT}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Remote Host</Label>
                      <Input
                        value={pf.remoteHost}
                        onChange={(e) => setPortForwards(portForwards.map(p => p.id === pf.id ? { ...p, remoteHost: e.target.value } : p))}
                        className="h-6 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </form>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t shrink-0">
        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="host-form" size="sm" className="flex-1" disabled={loading}>
          {loading ? 'Saving...' : host ? 'Save Changes' : 'Add Host'}
        </Button>
      </div>
    </div>
  );
}
