import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, Settings, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Webhook {
  id: string;
  name: string;
  target_url: string;
  method: string;
  is_active: boolean;
  description?: string;
  created_at: string;
}

const Webhooks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWebhooks();
    }
  }, [user]);

  const fetchWebhooks = async () => {
    if (!user) return;

    try {
      // Get client data first
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;

      // Get webhooks
      const { data: webhooksData } = await supabase
        .from('webhooks')
        .select('*')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      setWebhooks(webhooksData || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeWebhook = (webhookId: string) => {
    navigate(`/execute/${webhookId}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">Verwalten Sie Ihre Webhook-Endpunkte</p>
          </div>
          <Button onClick={() => navigate('/webhooks/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Webhook
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Noch keine Webhooks</CardTitle>
              <CardDescription>
                Erstellen Sie Ihren ersten Webhook, um loszulegen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/webhooks/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Ersten Webhook erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{webhook.name}</CardTitle>
                    <Badge variant={webhook.is_active ? "default" : "secondary"}>
                      {webhook.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {webhook.description || "Keine Beschreibung verfügbar"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs break-all">{webhook.target_url}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{webhook.method}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(webhook.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/execute/${webhook.id}`)}
                        disabled={!webhook.is_active}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Ausführen
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/webhooks/${webhook.id}/settings`)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Webhooks;