import { useState } from "react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface Client {
  id: string;
  name: string;
  user_id: string;
  email?: string;
}

const NewWebhook = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    target_url: "",
    method: "POST",
    description: "",
    is_active: true,
    headers: "{}",
    input_type: "TEXT",
    output_type: "TEXT",
    selected_client_id: ""
  });

  useEffect(() => {
    if (user && isAdmin) {
      fetchClients();
    }
  }, [user, isAdmin]);

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <Layout>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Zugriff verweigert</CardTitle>
              <CardDescription>
                Nur Administratoren können neue Webhooks erstellen.
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

  const fetchClients = async () => {
    try {
      // Get all clients with their profile information
      const { data: clientsData, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          user_id,
          profiles!inner(email)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const formattedClients = (clientsData || []).map(client => ({
        id: client.id,
        name: client.name,
        user_id: client.user_id,
        email: (client.profiles as any)?.email
      }));

      setClients(formattedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Fehler beim Laden der Clients",
        description: "Die Client-Liste konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.selected_client_id) {
      toast({
        title: "Client erforderlich",
        description: "Bitte wählen Sie einen Client aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {

      // Validate JSON headers
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(formData.headers);
      } catch (error) {
        toast({
          title: "Ungültige Headers",
          description: "Headers müssen gültiges JSON sein",
          variant: "destructive",
        });
        return;
      }

      // Create webhook
      const { error } = await supabase
        .from('webhooks')
        .insert({
          client_id: formData.selected_client_id,
          name: formData.name,
          target_url: formData.target_url,
          method: formData.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          description: formData.description || null,
          is_active: formData.is_active,
          headers: {
            ...parsedHeaders,
            input_type: formData.input_type,
            output_type: formData.output_type
          }
        });

      if (error) throw error;

      toast({
        title: "Webhook erstellt",
        description: "Der Webhook wurde erfolgreich erstellt.",
      });

      navigate('/webhooks');
    } catch (error: any) {
      toast({
        title: "Fehler beim Erstellen",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/webhooks')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Neuer Webhook</h1>
            <p className="text-muted-foreground">Erstellen Sie einen neuen Webhook-Endpunkt</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Webhook-Details</CardTitle>
              <CardDescription>
                Konfigurieren Sie Ihren neuen Webhook-Endpunkt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Webhook-Name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="method">HTTP-Methode</Label>
                    <Select
                      value={formData.method}
                      onValueChange={(value) => setFormData({ ...formData, method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client zuweisen *</Label>
                  {loadingClients ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Lade Clients...</span>
                    </div>
                  ) : (
                    <Select
                      value={formData.selected_client_id}
                      onValueChange={(value) => setFormData({ ...formData, selected_client_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Client auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} ({client.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Wählen Sie den Client aus, dem dieser Webhook zugewiesen werden soll
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_url">Ziel-URL *</Label>
                  <Input
                    id="target_url"
                    type="url"
                    value={formData.target_url}
                    onChange={(e) => setFormData({ ...formData, target_url: e.target.value })}
                    placeholder="https://prospert.app.n8n.cloud/webhook-test/912e1f34-4183-43d9-be08-ebf065590855"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optionale Beschreibung des Webhooks"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>Input-Typ</Label>
                    <RadioGroup
                      value={formData.input_type}
                      onValueChange={(value) => setFormData({ ...formData, input_type: value })}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="TEXT" id="input-text" />
                        <Label htmlFor="input-text">Text</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="FILE" id="input-file" />
                        <Label htmlFor="input-file">Datei</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Output-Typ</Label>
                    <RadioGroup
                      value={formData.output_type}
                      onValueChange={(value) => setFormData({ ...formData, output_type: value })}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="TEXT" id="output-text" />
                        <Label htmlFor="output-text">Text</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="FILE" id="output-file" />
                        <Label htmlFor="output-file">Datei</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headers">HTTP-Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    value={formData.headers}
                    onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                    placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Geben Sie die Headers als gültiges JSON ein
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Webhook aktivieren</Label>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Erstelle..." : "Webhook erstellen"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate('/webhooks')}
                  >
                    Abbrechen
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default NewWebhook;