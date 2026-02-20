import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Video, Play, Trash2 } from 'lucide-react';
import { ReplayPlayer } from './ReplayPlayer';

interface Recording {
  filename: string;
  path: string;
  timestamp: number;
}

export function RecordingControls() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRecordings();
    }
  }, [isOpen]);

  async function loadRecordings() {
    const list = await window.recordingApi.list();
    // Sort by timestamp descending (newest first)
    list.sort((a, b) => b.timestamp - a.timestamp);
    setRecordings(list);
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" title="View recordings">
            <Video className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Terminal Recordings</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recordings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recordings yet</p>
            ) : (
              recordings.map((rec) => (
                <div
                  key={rec.path}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{rec.filename}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(rec.timestamp)}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRecording(rec.path)}
                      title="Play recording"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedRecording && (
        <ReplayPlayer
          recordingPath={selectedRecording}
          onClose={() => setSelectedRecording(null)}
        />
      )}
    </>
  );
}
