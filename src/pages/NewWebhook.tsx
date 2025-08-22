import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface User {
  user_id: string;
  email: string;
  role: string;
  client_id?: string;
  client_name?: string;
}

const NewWebhook = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    url: '',
    method: 'POST' as 'GET' | 'POST' | 'PUT' | 'DELETE',
    headers: '{}',
    input_type: 'TEXT' as 'TEXT' | 'FILE',
    output_type: 'TEXT' as 'TEXT' | 'FILE',
    tokens_cost: 1,
    is_active: true,
    selected_user_id: ''
  });

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
    }
  }, [user, isAdmin]);

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Zugriff verweigert</h2>
            <p className="text-muted-foreground mb-4">
              Sie haben keine Berechtigung, neue Webhooks zu erstellen.
            </p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zum Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      // Get all users with their client information
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          role,
          clients (
            id,
            name
          )
        `)
        .eq('role', 'CLIENT')
        .order('email');

      if (error) throw error;

      // Format users with client info
      const formattedUsers = (usersData || []).map(user => ({
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        client_id: (user.clients as any)?.[0]?.id,
        client_name: (user.clients as any)?.[0]?.name || user.email.split('@')[0]
      })).filter(user => user.client_id); // Only users with client records

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Fehler beim Laden der Benutzer",
        description: "Die Benutzerliste konnte nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!form.name.trim() || !form.url.trim() || !form.selected_user_id.trim()) {
      toast({
        title: "Felder erforderlich",
        description: "Name, URL und Benutzer sind erforderlich.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      // Validate headers JSON
      try {
        JSON.parse(form.headers);
      } catch {
        throw new Error('Headers müssen gültiges JSON sein');
      }

      // Find the selected user's client ID
      const selectedUser = users.find(u => u.user_id === form.selected_user_id);
      if (!selectedUser?.client_id) {
        throw new Error('Ausgewählter Benutzer hat keinen Client-Datensatz.');
      }

      const { error } = await supabase
        .from('webhooks')
        .insert({
          name: form.name.trim(),
          description: form.description.trim() || null,
          url: form.url.trim(),
          method: form.method,
          headers: JSON.parse(form.headers),
          input_type: form.input_type,
          output_type: form.output_type,
          tokens_cost: form.tokens_cost,
          is_active: form.is_active,
          client_id: selectedUser.client_id
        });

      if (error) throw error;

      toast({
        title: "Webhook erstellt",
        description: "Der Webhook wurde erfolgreich erstellt.",
      });

      navigate('/webhooks');
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: (error && typeof error.message === 'string') ? error.message : "Der Webhook konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" size="sm" onClick={() => navigate('/webhooks')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu Webhooks
            </Button>
          </div>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Neuer Webhook</h1>
          <p className="text-muted-foreground">Erstellen Sie einen neuen Webhook für einen Benutzer</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Neuen Webhook erstellen</CardTitle>
            <CardDescription>
              Erstellen Sie einen neuen Webhook für einen Benutzer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="user-select">Benutzer auswählen *</Label>
              <Select 
                value={form.selected_user_id} 
                onValueChange={(value) => setForm(prev => ({ ...prev, selected_user_id: value }))}
                disabled={usersLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Lade Benutzer..." : "Benutzer auswählen"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.email} ({user.client_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Wählen Sie den Benutzer aus, dem dieser Webhook zugewiesen werden soll
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Webhook Name"
                />
              </div>
              <div>
                <Label>HTTP Methode</Label>
                <Select 
                  value={form.method} 
                  onValueChange={(value: 'GET' | 'POST' | 'PUT' | 'DELETE') => setForm(prev => ({ ...prev, method: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://api.example.com/webhook"
                />
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung des Webhooks..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Input-Typ</Label>
                <Select 
                  value={form.input_type} 
                  onValueChange={(value: 'TEXT' | 'FILE') => setForm(prev => ({ ...prev, input_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="FILE">Datei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Output-Typ</Label>
                <Select 
                  value={form.output_type} 
                  onValueChange={(value: 'TEXT' | 'FILE') => setForm(prev => ({ ...prev, output_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="FILE">Datei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="tokens">Token-Kosten</Label>
              <Input
                id="tokens"
                type="number"
                min="1"
                value={form.tokens_cost}
                onChange={(e) => setForm(prev => ({ ...prev, tokens_cost: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div>
              <Label htmlFor="headers">HTTP Headers (JSON)</Label>
              <Textarea
                id="headers"
                value={form.headers}
                onChange={(e) => setForm(prev => ({ ...prev, headers: e.target.value }))}
                placeholder='{"Content-Type": "application/json"}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="active">Webhook aktiv</Label>
            </div>

            <div className="flex gap-4">
              <Button onClick={createWebhook} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Erstelle...
                  </>
                ) : (
                  'Webhook erstellen'
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate('/webhooks')}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default NewWebhook;