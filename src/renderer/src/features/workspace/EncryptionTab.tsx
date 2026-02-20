import { useEffect, useState } from 'react';
import type { SshKey } from '@shared/types/keys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Lock, Shield, Key, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface EncryptionTabProps {
  workspaceId: string;
}

// Calculate passphrase strength (0-100)
function calculatePassphraseStrength(passphrase: string): number {
  if (!passphrase) return 0;

  let strength = 0;

  // Length contribution (max 40 points)
  strength += Math.min(passphrase.length * 2, 40);

  // Character variety (max 60 points)
  if (/[a-z]/.test(passphrase)) strength += 15; // lowercase
  if (/[A-Z]/.test(passphrase)) strength += 15; // uppercase
  if (/[0-9]/.test(passphrase)) strength += 15; // numbers
  if (/[^a-zA-Z0-9]/.test(passphrase)) strength += 15; // special chars

  return Math.min(strength, 100);
}

// Get strength label and color
function getStrengthInfo(strength: number): { label: string; color: string } {
  if (strength === 0) return { label: 'None', color: 'bg-muted' };
  if (strength < 30) return { label: 'Weak', color: 'bg-red-500' };
  if (strength < 60) return { label: 'Fair', color: 'bg-yellow-500' };
  if (strength < 80) return { label: 'Good', color: 'bg-blue-500' };
  return { label: 'Strong', color: 'bg-green-500' };
}

export function EncryptionTab({ workspaceId }: EncryptionTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [keys, setKeys] = useState<SshKey[]>([]);

  // Enable Encryption form state
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  // Change Passphrase form state
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmNewPassphrase, setConfirmNewPassphrase] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  // Sync key state
  const [syncingKeyId, setSyncingKeyId] = useState<string | null>(null);

  // Load encryption status and keys
  useEffect(() => {
    loadEncryptionState();
  }, [workspaceId]);

  const loadEncryptionState = async () => {
    try {
      setIsLoading(true);
      const [initialized, keysList] = await Promise.all([
        window.keysApi.isWorkspaceEncryptionInitialized(workspaceId),
        window.keysApi.list(workspaceId),
      ]);
      setIsInitialized(initialized);
      setKeys(keysList);
    } catch (error) {
      console.error('Failed to load encryption state:', error);
      toast.error('Failed to load encryption information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeEncryption = async () => {
    if (!passphrase.trim()) {
      toast.error('Passphrase cannot be empty');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      toast.error('Passphrases do not match');
      return;
    }

    const strength = calculatePassphraseStrength(passphrase);
    if (strength < 30) {
      toast.error('Passphrase is too weak. Please use a stronger passphrase.');
      return;
    }

    try {
      setIsInitializing(true);
      await window.keysApi.initializeWorkspaceEncryption(workspaceId, passphrase);
      setIsInitialized(true);
      setPassphrase('');
      setConfirmPassphrase('');
      toast.success('Workspace encryption enabled successfully');
      await loadEncryptionState();
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      toast.error((error as Error).message || 'Failed to enable encryption');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleChangePassphrase = async () => {
    if (!currentPassphrase.trim()) {
      toast.error('Current passphrase cannot be empty');
      return;
    }

    if (!newPassphrase.trim()) {
      toast.error('New passphrase cannot be empty');
      return;
    }

    if (newPassphrase !== confirmNewPassphrase) {
      toast.error('New passphrases do not match');
      return;
    }

    const strength = calculatePassphraseStrength(newPassphrase);
    if (strength < 30) {
      toast.error('New passphrase is too weak. Please use a stronger passphrase.');
      return;
    }

    if (currentPassphrase === newPassphrase) {
      toast.error('New passphrase must be different from current passphrase');
      return;
    }

    try {
      setIsChanging(true);
      await window.keysApi.changeWorkspacePassphrase(workspaceId, currentPassphrase, newPassphrase);
      setCurrentPassphrase('');
      setNewPassphrase('');
      setConfirmNewPassphrase('');
      toast.success('Passphrase changed successfully');
    } catch (error) {
      console.error('Failed to change passphrase:', error);
      toast.error((error as Error).message || 'Failed to change passphrase');
    } finally {
      setIsChanging(false);
    }
  };

  const handleSyncKey = async (keyId: string) => {
    if (!isInitialized) {
      toast.error('Please enable encryption first');
      return;
    }

    // Prompt for passphrase
    const passphraseInput = prompt('Enter your workspace passphrase to sync this key:');
    if (!passphraseInput) {
      return;
    }

    try {
      setSyncingKeyId(keyId);
      await window.keysApi.syncKeyToCloud(workspaceId, keyId, passphraseInput);
      toast.success('Key synced to cloud successfully');
      await loadEncryptionState();
    } catch (error) {
      console.error('Failed to sync key:', error);
      toast.error((error as Error).message || 'Failed to sync key to cloud');
    } finally {
      setSyncingKeyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  const syncedKeysCount = keys.filter((k) => k.hasEncryptedSync).length;
  const passphraseStrength = isInitialized ? calculatePassphraseStrength(newPassphrase) : calculatePassphraseStrength(passphrase);
  const strengthInfo = getStrengthInfo(passphraseStrength);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Encryption Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage workspace encryption and secure key synchronization.
        </p>
      </div>

      <Separator />

      {/* Encryption Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Encryption Status
          </CardTitle>
          <CardDescription>Current workspace encryption configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInitialized ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Encryption Enabled</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">Encryption Disabled</span>
                </>
              )}
            </div>
            {isInitialized && (
              <Badge variant="default">
                {syncedKeysCount} {syncedKeysCount === 1 ? 'Key' : 'Keys'} Synced
              </Badge>
            )}
          </div>

          {!isInitialized && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Enable encryption to securely sync your SSH keys to the cloud. Your keys will be
                encrypted with your passphrase before uploading.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Enable Encryption Form (if not initialized) */}
      {!isInitialized && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Enable Encryption
            </CardTitle>
            <CardDescription>
              Set a strong passphrase to enable encryption and secure key syncing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase"
                disabled={isInitializing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-passphrase">Confirm Passphrase</Label>
              <Input
                id="confirm-passphrase"
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Re-enter your passphrase"
                disabled={isInitializing}
              />
            </div>

            {passphrase && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label>Passphrase Strength</Label>
                  <span className="text-muted-foreground">{strengthInfo.label}</span>
                </div>
                <Progress value={passphraseStrength} className="h-2" />
              </div>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Remember your passphrase! It cannot be recovered if lost. You'll need it to sync and
                access your encrypted keys.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleInitializeEncryption}
              disabled={isInitializing || !passphrase || !confirmPassphrase}
              className="w-full"
            >
              {isInitializing ? 'Enabling...' : 'Enable Encryption'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Change Passphrase Form (if initialized) */}
      {isInitialized && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Change Passphrase
            </CardTitle>
            <CardDescription>Update your workspace encryption passphrase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-passphrase">Current Passphrase</Label>
              <Input
                id="current-passphrase"
                type="password"
                value={currentPassphrase}
                onChange={(e) => setCurrentPassphrase(e.target.value)}
                placeholder="Enter your current passphrase"
                disabled={isChanging}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-passphrase">New Passphrase</Label>
              <Input
                id="new-passphrase"
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                placeholder="Enter a new passphrase"
                disabled={isChanging}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-passphrase">Confirm New Passphrase</Label>
              <Input
                id="confirm-new-passphrase"
                type="password"
                value={confirmNewPassphrase}
                onChange={(e) => setConfirmNewPassphrase(e.target.value)}
                placeholder="Re-enter your new passphrase"
                disabled={isChanging}
              />
            </div>

            {newPassphrase && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label>Passphrase Strength</Label>
                  <span className="text-muted-foreground">{strengthInfo.label}</span>
                </div>
                <Progress value={passphraseStrength} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleChangePassphrase}
              disabled={
                isChanging || !currentPassphrase || !newPassphrase || !confirmNewPassphrase
              }
              className="w-full"
            >
              {isChanging ? 'Changing...' : 'Change Passphrase'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Encrypted Keys List */}
      {keys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Encrypted Keys
            </CardTitle>
            <CardDescription>
              Manage encrypted synchronization for your SSH keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{key.name}</span>
                    {key.hasEncryptedSync ? (
                      <Badge variant="default" className="shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Synced
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Synced
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase">{key.keyType}</span>
                    <span>•</span>
                    <span className="font-mono truncate">{key.fingerprint}</span>
                  </div>
                </div>

                {!key.hasEncryptedSync && isInitialized && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSyncKey(key.id)}
                    disabled={syncingKeyId === key.id}
                    className="ml-2 shrink-0"
                  >
                    {syncingKeyId === key.id ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sync to Cloud
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}

            {keys.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No SSH keys found in this workspace</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
