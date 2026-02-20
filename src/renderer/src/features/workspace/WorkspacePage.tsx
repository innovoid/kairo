import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralTab } from './GeneralTab';
import { EncryptionTab } from './EncryptionTab';
import { TeamTab } from './TeamTab';

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Tabs defaultValue="general" orientation="vertical" className="flex flex-1 overflow-hidden">
          {/* Nav wrapper */}
          <div className="w-44 shrink-0 border-r bg-muted/10 flex flex-col">
            <TabsList className="flex flex-col w-full rounded-none bg-transparent p-2 gap-0.5 justify-start">
              <TabsTrigger value="general" className="w-full justify-start px-3 py-1.5 text-sm">
                General
              </TabsTrigger>
              <TabsTrigger value="encryption" className="w-full justify-start px-3 py-1.5 text-sm">
                Encryption
              </TabsTrigger>
              <TabsTrigger value="team" className="w-full justify-start px-3 py-1.5 text-sm">
                Team
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="general" className="p-6 m-0">
              <GeneralTab workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="encryption" className="p-6 m-0">
              <EncryptionTab workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="team" className="p-6 m-0">
              <TeamTab workspaceId={workspaceId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
