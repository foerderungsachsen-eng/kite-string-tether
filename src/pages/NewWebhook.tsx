import { useState } from "react";
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
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NewWebhook = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    url: '',
    method: 'POST' as 'GET' | 'POST' | 'PUT' | 'DELETE',
    headers: '{"Content-Type": "application/json"}',
    input_type: 'TEXT' as 'TEXT' | 'FILE',
    output_type: 'TEXT' as 'TEXT' | 'FILE',
    tokens_cost: 1,
    is_active: true
  });

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

  const createWebhook = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast({
        title: "Felder erforderlich",
        description: "Name und URL sind erforderlich.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let headers;
      try {
        headers = JSON.parse(form.headers);
      } catch {
        throw new Error('Headers müssen gültiges JSON sein');
      }

      // Get a client to assign the webhook to (for now, use the first available client)
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .limit(1)
        .single();

      if (clientsError || !clientsData) {
        throw new Error('Kein Client verfügbar. Erstellen Sie zuerst einen Benutzer.');
      }

      const { error } = await supabase
        .from('webhooks')
        .insert({
          name: form.name,
          description: form.description || null,
          url: form.url,
          method: form.method,
          headers: headers,
          input_type: form.input_type,
          output_type: form.output_type,
          tokens_cost: form.tokens_cost,
          is_active: form.is_active,
          client_id: clientsData.id
        });

      if (error) throw error;

      toast({
        title: "Webhook erstellt",
        description: `${form.name} wurde erfolgreich erstellt.`,
      });

      navigate('/webhooks');
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: (error && typeof error.message === 'string') ? error.message : "Der Webhook konnte nicht erstellt werden.",
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
            <p className="text-muted-foreground">Erstellen Sie einen neuen Webhook</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Webhook-Details</CardTitle>
            <CardDescription>
              Geben Sie die Details für den neuen Webhook ein
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="tokens-cost">Token-Kosten</Label>
                <Input
                  id="tokens-cost"
                  type="number"
                  min="1"
                  value={form.tokens_cost}
                  onChange={(e) => setForm(prev => ({ ...prev, tokens_cost: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Anzahl der Tokens, die für eine Ausführung benötigt werden
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optionale Beschreibung"
              />
            </div>

            <div>
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                value={form.url}
                onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/webhook"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="method">HTTP Methode</Label>
                <Select value={form.method} onValueChange={(value: 'GET' | 'POST' | 'PUT' | 'DELETE') => setForm(prev => ({ ...prev, method: value }))}>
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

              <div>
                <Label htmlFor="input-type">Input Typ</Label>
                <Select value={form.input_type} onValueChange={(value: 'TEXT' | 'FILE') => setForm(prev => ({ ...prev, input_type: value }))}>
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
                <Label htmlFor="output-type">Output Typ</Label>
                <Select value={form.output_type} onValueChange={(value: 'TEXT' | 'FILE') => setForm(prev => ({ ...prev, output_type: value }))}>
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
              <Label htmlFor="headers">Headers (JSON)</Label>
              <Textarea
                id="headers"
                value={form.headers}
                onChange={(e) => setForm(prev => ({ ...prev, headers: e.target.value }))}
                placeholder='{"Content-Type": "application/json"}'
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Geben Sie die Headers als gültiges JSON ein
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-active"
                checked={form.is_active}
                onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
              />
              <Label htmlFor="is-active">Webhook aktiv</Label>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/webhooks')}>
                Abbrechen
              </Button>
              <Button onClick={createWebhook} disabled={loading}>
                {loading ? "Erstelle..." : "Webhook erstellen"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default NewWebhook;