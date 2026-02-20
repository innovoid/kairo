import { Server, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EmptyHostsStateProps {
  onAddHost: () => void
}

export function EmptyHostsState({ onAddHost }: EmptyHostsStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md border-2 border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center text-center gap-6 pt-12 pb-12">
          <div
            className="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center"
            data-testid="server-icon-container"
          >
            <Server className="w-8 h-8 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">No hosts yet</h2>
            <p className="text-sm text-muted-foreground">
              Add your first SSH host to get started with secure remote connections
            </p>
          </div>

          <Button
            onClick={onAddHost}
            className="gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Add Host
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
