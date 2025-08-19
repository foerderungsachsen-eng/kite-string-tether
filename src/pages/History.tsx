import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw } from "lucide-react";

interface Execution {
  id: string;
  webhook_id: string;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  requested_at: string;
  duration_ms: number | null;
  tokens_used: number;
  request_type: 'TEXT' | 'FILE';
  status_code: number | null;
  response: string | null;
  error: string | null;
  webhooks: {
    name: string;
  };
}

const History = () => {
  const { user } = useAuth();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchExecutions();
    }
  }, [user]);

  const fetchExecutions = async () => {
    if (!user) return;

    try {
      // Get client data first
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;

      // Get executions with webhook names
      const { data: executionsData } = await supabase
        .from('executions')
        .select(`
          *,
          webhooks (
            name
          )
        `)
        .eq('client_id', clientData.id)
        .order('requested_at', { ascending: false })
        .limit(50);

      setExecutions(executionsData || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'default';
      case 'ERROR':
        return 'destructive';
      case 'TIMEOUT':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'Erfolgreich';
      case 'ERROR':
        return 'Fehler';
      case 'TIMEOUT':
        return 'Timeout';
      default:
        return status;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
          <h1 className="text-3xl font-bold tracking-tight">Ausführungshistorie</h1>
          <p className="text-muted-foreground">Übersicht über alle Webhook-Ausführungen</p>
          </div>
          <Button onClick={fetchExecutions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : executions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Keine Ausführungen</CardTitle>
              <CardDescription>
                Es wurden noch keine Webhooks ausgeführt.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {executions.map((execution) => (
              <Card key={execution.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{execution.webhooks.name}</h3>
                        <Badge variant={getStatusColor(execution.status) as any}>
                          {getStatusText(execution.status)}
                        </Badge>
                        {execution.status_code && (
                          <Badge variant="outline">
                            HTTP {execution.status_code}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {execution.request_type}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {new Date(execution.requested_at).toLocaleString('de-DE')}
                        </span>
                        {execution.duration_ms && (
                          <span>{execution.duration_ms}ms</span>
                        )}
                        <span>{execution.tokens_used} Token verwendet</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Show execution details in a modal or expand
                          console.log('Show details for:', execution.id);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                  
                  {execution.error && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive font-medium">Fehler:</p>
                      <p className="text-sm text-destructive/80 mt-1">
                        {typeof execution.error === 'string' 
                          ? execution.error 
                          : JSON.stringify(execution.error)
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default History;