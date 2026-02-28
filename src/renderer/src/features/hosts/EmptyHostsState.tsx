import { Server, Plus, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyHostsStateProps {
  onAddHost: () => void
}

export function EmptyHostsState({ onAddHost }: EmptyHostsStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="flex flex-col items-center text-center gap-6 max-w-xs">

        {/* Animated illustration */}
        <div className="relative w-24 h-24">
          {/* Outer pulse rings */}
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping [animation-duration:2.5s]" />
          <span className="absolute inset-2 rounded-full bg-primary/10 animate-ping [animation-duration:2.5s] [animation-delay:0.4s]" />
          {/* Icon container */}
          <div className="relative w-24 h-24 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
            <Server className="w-10 h-10 text-primary" strokeWidth={1.5} />
            {/* Small wifi badge */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-center">
              <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">No hosts yet</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add an SSH host to start connecting to remote servers securely.
          </p>
        </div>

        <Button
          onClick={onAddHost}
          className="gap-2"
          size="sm"
          data-testid="add-host-button"
        >
          <Plus className="w-4 h-4" />
          Add Host
        </Button>

        <p className="text-xs text-muted-foreground/60">
          Supports password, SSH key, and SSH agent auth
        </p>
      </div>
    </div>
  )
}
