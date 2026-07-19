import { Loader2 } from 'lucide-react'
import { DashboardView } from '@/components/dashboard-view'
import { Header } from '@/components/header'
import { TrackerView } from '@/components/tracker-view'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHost } from '@/hooks/use-host'
import { useDishes, useSettings } from '@/hooks/use-potluck'

export default function PotluckPage() {
  const { isHost, exitHost } = useHost()
  const dishes = useDishes()
  const settings = useSettings()

  return (
    <div className="min-h-dvh">
      <Header isHost={isHost} onExitHost={exitHost} />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-12">
        {dishes.isPending || settings.isPending ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-20 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading the table…
          </div>
        ) : dishes.isError || settings.isError ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              <p className="text-foreground mb-1 font-medium">Couldn&apos;t reach the potluck</p>
              <p>Check your connection — retrying automatically.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="tracker">
            <TabsList className="mb-2 w-full">
              <TabsTrigger value="tracker">Tracker</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="tracker">
              <TrackerView dishes={dishes.data} isHost={isHost} />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardView dishes={dishes.data} settings={settings.data} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
