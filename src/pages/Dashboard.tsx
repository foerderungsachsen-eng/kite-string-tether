import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Activity, Clock, Coins, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalWebhooks: number;
  activeWebhooks: number;
  totalExecutions: number;
  recentExecutions: any[];
  tokensBalance: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalWebhooks: 0,
    activeWebhooks: 0,
    totalExecutions: 0,
    recentExecutions: [],
    tokensBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Get client data
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, tokens_balance')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;

      // Get webhooks count
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('id, is_active')
        .eq('client_id', clientData.id);

      // Get executions count and recent executions
      const { data: executions } = await supabase
        .from('executions')
        .select('id, status, requested_at, webhook_id, tokens_used')
        .eq('client_id', clientData.id)
        .order('requested_at', { ascending: false })
        .limit(5);

      setStats({
        totalWebhooks: webhooks?.length || 0,
        activeWebhooks: webhooks?.filter(w => w.is_active).length || 0,
        totalExecutions: executions?.length || 0,
        recentExecutions: executions || [],
        tokensBalance: clientData.tokens_balance,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Überblick über Ihre Webhook-Aktivitäten</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token-Guthaben</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tokensBalance}</div>
            <p className="text-xs text-muted-foreground">Verfügbare Ausführungen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWebhooks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeWebhooks} aktiv
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausführungen</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExecutions}</div>
            <p className="text-xs text-muted-foreground">Gesamt ausgeführt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Letzte Aktivität</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recentExecutions.length > 0 ? 'Aktiv' : 'Keine'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.recentExecutions.length > 0 
                ? `${stats.recentExecutions.length} kürzlich`
                : 'Ausführungen'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
            <CardDescription>Häufige Aufgaben mit einem Klick</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full justify-start" 
              onClick={() => navigate('/webhooks/new')}
            >
              <Globe className="mr-2 h-4 w-4" />
              Neuen Webhook erstellen
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/history')}
            >
              <Activity className="mr-2 h-4 w-4" />
              Ausführungshistorie anzeigen
            </Button>
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle>Letzte Ausführungen</CardTitle>
            <CardDescription>Die 5 neuesten Webhook-Ausführungen</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentExecutions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Noch keine Ausführungen vorhanden
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentExecutions.map((execution) => (
                  <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Webhook #{execution.webhook_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(execution.requested_at).toLocaleString('de-DE')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={execution.status === 'SUCCESS' ? 'default' : 'destructive'}>
                      {execution.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;