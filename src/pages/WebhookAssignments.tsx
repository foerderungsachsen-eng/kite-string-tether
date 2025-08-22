import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  description?: string;
}

interface Assignment {
  id: string;
  user_id: string;
  assigned_at: string;
  is_active: boolean;
  user_email?: string;
}

interface User {
  user_id: string;
  email: string;
  role: string;
}

const WebhookAssignments = () => {
  const { webhookId } = useParams<{ webhookId: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");

  useEffect(() => {
    if (user && webhookId && isAdmin) {
      fetchData();
    }
  }, [user, webhookId, isAdmin]);

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <Layout>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Zugriff verweigert</CardTitle>
              <CardDescription>
                Nur Administratoren können Webhook-Zuweisungen verwalten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/webhooks')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zu Webhooks
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const fetchData = async () => {
    if (!webhookId) return;

    try {
      // Fetch webhook details
      const { data: webhookData } = await supabase
        .from('webhooks')
        .select('id, name, description')
        .eq('id', webhookId)
        .single();

      if (webhookData) {
        setWebhook(webhookData);
      }

      // Fetch current assignments
      const { data: assignmentsData } = await supabase
        .from('webhook_assignments')
        .select(`
          id,
          user_id,
          assigned_at,
          is_active,
          profiles!inner(email)
        `)
        .eq('webhook_id', webhookId)
        .eq('is_active', true);

      if (assignmentsData) {
        const formattedAssignments = assignmentsData.map(assignment => ({
          id: assignment.id,
          user_id: assignment.user_id,
          assigned_at: assignment.assigned_at,
          is_active: assignment.is_active,
          user_email: (assignment.profiles as any)?.email
        }));
        setAssignments(formattedAssignments);
      }

      // Fetch available users (not already assigned)
      const assignedUserIds = assignmentsData?.map(a => a.user_id) || [];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, email, role')
        .eq('role', 'CLIENT')
        .not('user_id', 'in', `(${assignedUserIds.join(',')})`);

      setAvailableUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const assignUser = async (userId: string) => {
    if (!webhookId || !user) return;

    try {
      const { error } = await supabase
        .from('webhook_assignments')
        .insert({
          webhook_id: webhookId,
          user_id: userId,
          assigned_by: user.id,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Benutzer zugewiesen",
        description: "Der Webhook wurde erfolgreich zugewiesen.",
      });

      fetchData(); // Refresh data
    } catch (error: any) {
      toast({
        title: "Fehler bei Zuweisung",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('webhook_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Zuweisung entfernt",
        description: "Die Webhook-Zuweisung wurde entfernt.",
      });

      fetchData(); // Refresh data
    } catch (error: any) {
      toast({
        title: "Fehler beim Entfernen",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredUsers = availableUsers.filter(user =>
    user.email.toLowerCase().includes(searchEmail.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!webhook) {
    return (
      <Layout>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook nicht gefunden</CardTitle>
              <CardDescription>
                Der angeforderte Webhook konnte nicht gefunden werden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/webhooks')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zu Webhooks
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/webhooks')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhook-Zuweisungen</h1>
            <p className="text-muted-foreground">{webhook.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Assignments */}
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Zuweisungen</CardTitle>
              <CardDescription>
                Benutzer, die Zugriff auf diesen Webhook haben
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Noch keine Benutzer zugewiesen
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{assignment.user_email}</p>
                        <p className="text-sm text-muted-foreground">
                          Zugewiesen am {new Date(assignment.assigned_at).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeAssignment(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Users */}
          <Card>
            <CardHeader>
              <CardTitle>Verfügbare Benutzer</CardTitle>
              <CardDescription>
                Benutzer, die diesem Webhook zugewiesen werden können
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nach E-Mail suchen..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    {searchEmail ? "Keine Benutzer gefunden" : "Alle Benutzer bereits zugewiesen"}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.email}</p>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => assignUser(user.user_id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Zuweisen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default WebhookAssignments;