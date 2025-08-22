import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, Settings, Play, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Webhook {
  id: string;
  name: string;
  target_url: string;
  method: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  webhook_assignments?: { count: number }[];
}

const Webhooks = () => {
  const { user, isAdmin } = useAuth();
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
      let webhooksData;
      
      if (isAdmin) {
        // Admins can see all webhooks
        const { data } = await supabase
          .from('webhooks')
          .select('*')
          .order('created_at', { ascending: false });
        webhooksData = data;
      } else {
        // Regular users can only see assigned webhooks
        const { data } = await supabase
          .from('webhooks')
          .select(`
            *,
            webhook_assignments!inner(*)
          `)
          .eq('webhook_assignments.user_id', user.id)
          .eq('webhook_assignments.is_active', true)
          .order('created_at', { ascending: false });
        webhooksData = data;
      }

      setWebhooks(webhooksData || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast({
        title: "Fehler beim Laden der Webhooks",
        description: "Die Webhooks konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeWebhook = (webhookId: string) => {
    navigate(`/execute/${webhookId}`);
  };

  const manageAssignments = (webhookId: string) => {
    navigate(`/webhooks/${webhookId}/assignments`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              {isAdmin ? "Verwalten Sie alle Webhook-Endpunkte" : "Ihre zugewiesenen Webhook-Endpunkte"}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => navigate('/users')}>
                  <Users className="mr-2 h-4 w-4" />
                  Benutzer
                </Button>
                <Button onClick={() => navigate('/webhooks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer Webhook
                </Button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {isAdmin ? "Noch keine Webhooks" : "Keine zugewiesenen Webhooks"}
              </CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Erstellen Sie Ihren ersten Webhook, um loszulegen."
                  : "Sie haben noch keine Webhooks zugewiesen bekommen. Kontaktieren Sie Ihren Administrator."
                }
              </CardDescription>
            </CardHeader>
            {isAdmin && (
              <CardContent>
                <Button onClick={() => navigate('/webhooks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten Webhook erstellen
                </Button>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{webhook.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </div>
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
                    
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button 
                        size="sm" 
                        className={isAdmin ? "" : "flex-1"}
                        onClick={() => navigate(`/execute/${webhook.id}`)}
                        disabled={!webhook.is_active}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Ausführen
                      </Button>
                      {isAdmin && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => manageAssignments(webhook.id)}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toast({ title: "Wird bald implementiert", description: "Webhook-Einstellungen kommen in einem zukünftigen Update" })}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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

            <Button onClick={() => navigate('/webhooks/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Webhook
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {isAdmin ? "Noch keine Webhooks" : "Keine zugewiesenen Webhooks"}
              </CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Erstellen Sie Ihren ersten Webhook, um loszulegen."
                  : "Sie haben noch keine Webhooks zugewiesen bekommen. Kontaktieren Sie Ihren Administrator."
                }
              </CardDescription>
            </CardHeader>
            {isAdmin && (
              <CardContent>
                <Button onClick={() => navigate('/webhooks/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten Webhook erstellen
                </Button>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{webhook.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                      {isAdmin && webhook.assigned_users !== undefined && (
                        <Badge variant="outline">
                          {webhook.assigned_users} Benutzer
                        </Badge>
                      )}
                    </div>
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
                    
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button 
                        size="sm" 
                        className={isAdmin ? "" : "flex-1"}
                        onClick={() => navigate(`/execute/${webhook.id}`)}
                        disabled={!webhook.is_active}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Ausführen
                      </Button>
                      {isAdmin && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => manageAssignments(webhook.id)}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toast({ title: "Wird bald implementiert", description: "Webhook-Einstellungen kommen in einem zukünftigen Update" })}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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