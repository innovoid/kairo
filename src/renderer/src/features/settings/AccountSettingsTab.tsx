import { useState, useEffect } from 'react'
import { User, Mail, Download, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDataExport } from './hooks/useDataExport'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UserData {
  email: string
  user_metadata: {
    full_name?: string
  }
}

const AccountSettingsTab = () => {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { exportData, isExporting } = useDataExport()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error: fetchError } = await supabase.auth.getUser()

        if (fetchError) {
          setError('Failed to load user data')
          return
        }

        if (data.user) {
          setUser(data.user as UserData)
        } else {
          setError('Failed to load user data')
        }
      } catch (err) {
        setError('Failed to load user data')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const handleExportData = async () => {
    await exportData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Summary
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">
                {user?.user_metadata?.full_name || 'Not set'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Your Data Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data in JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Download Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Manage Account Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Manage Account
          </CardTitle>
          <CardDescription>
            View and update your profile settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href="/profile" className="flex items-center gap-2">
              Go to Profile
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default AccountSettingsTab
