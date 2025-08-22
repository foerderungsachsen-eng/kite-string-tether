import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Globe, Play, Edit, Trash2, Coins, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Webhook {
  id: string;
  name: string;
  description: string | null;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: any;
  input_type: 'TEXT' | 'FILE';
  output_type: 'TEXT' | 'FILE';
  is_active: boolean;
  tokens_cost: number;
  created_at: string;
  client_id: string;
  clients?: {
    id: string;
    name: string;
    user_id: string;
    profiles?: {
      email: string;
    };
  };
}

const Webhooks = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWebhooks();
    }
  }, [user, isAdmin]);

  const fetchWebhooks = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (isAdmin) {
        // Admin can see all webhooks with client information
        const { data: webhooksData, error } = await supabase
          .from('webhooks')
          .select(`
            *,
            clients!inner (
              id,
              name,
              user_id,
              profiles!inner (
                email
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Admin webhooks error:', error);
          throw error;
        }

        setWebhooks(webhooksData || []);
      } else {
        // Get client data first for regular users
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (clientError) {
          console.error('Client data error:', clientError);
          throw clientError;
        }

        if (!clientData) {
          console.log('No client data found for user:', user.id);
          setWebhooks([]);
          return;
        }

        // Get webhooks for this client
        const { data: webhooksData, error: webhooksError } = await supabase
          .from('webhooks')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false });

        if (webhooksError) {
          console.error('Client webhooks error:', webhooksError);
          throw webhooksError;
        }

        setWebhooks(webhooksData || []);
      }
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
      toast({
        title: "Fehler beim Laden der Webhooks",
        description: error?.message || "Die Webhooks konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook({
      ...webhook,
      headers: JSON.stringify(webhook.headers || {}, null, 2)
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (webhook: Webhook) => {
    setWebhookToDelete(webhook);
    setDeleteDialogOpen(true);
  };

  const updateWebhook = async () => {
    if (!editingWebhook) return;

    setIsUpdating(true);
    try {
      // Validate headers JSON
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(editingWebhook.headers as string);
      } catch {
        throw new Error('Headers müssen gültiges JSON sein');
      }

      const { error } = await supabase
        .from('webhooks')
        .update({
          name: editingWebhook.name,
          description: editingWebhook.description || null,
          url: editingWebhook.url,
          method: editingWebhook.method,
          headers: parsedHeaders,
          input_type: editingWebhook.input_type,
          output_type: editingWebhook.output_type,
          tokens_cost: editingWebhook.tokens_cost,
          is_active: editingWebhook.is_active
        })
        .eq('id', editingWebhook.id);

      if (error) throw error;

      toast({
        title: "Webhook aktualisiert",
        description: "Der Webhook wurde erfolgreich aktualisiert.",
      });

      setEditDialogOpen(false);
      setEditingWebhook(null);
      await fetchWebhooks();
    } catch (error: any) {
      console.error('Error updating webhook:', error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error?.message || "Der Webhook konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteWebhook = async () => {
    if (!webhookToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookToDelete.id);

      if (error) throw error;

      toast({
        title: "Webhook gelöscht",
        description: "Der Webhook wurde erfolgreich gelöscht.",
      });

      setDeleteDialogOpen(false);
      setWebhookToDelete(null);
      await fetchWebhooks();
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast({
        title: "Fehler beim Löschen",
        description: error?.message || "Der Webhook konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Verwalten Sie alle Webhooks im System" 
                : "Ihre verfügbaren Webhooks"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchWebhooks} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            {isAdmin && (
              <Button onClick={() => navigate('/webhooks/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Neuer Webhook
              </Button>
            )}
          </div>
        </div>

        {webhooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Keine Webhooks</CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Es wurden noch keine Webhooks erstellt. Erstellen Sie den ersten Webhook."
                  : "Ihnen wurden noch keine Webhooks zugewiesen. Kontaktieren Sie Ihren Administrator."
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
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-500" />
                      {webhook.name}
                    </CardTitle>
                    <Badge variant={webhook.is_active ? "default" : "secondary"}>
                      {webhook.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                  {webhook.description && (
                    <CardDescription>{webhook.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isAdmin && webhook.clients && (
                      <div className="p-2 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Client:</p>
                        <p className="text-sm text-muted-foreground">
                          {webhook.clients.name} ({webhook.clients.profiles?.email})
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{webhook.method}</Badge>
                      <Badge variant="outline">{webhook.input_type}</Badge>
                      <Badge variant="outline">{webhook.output_type}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <span>{webhook.tokens_cost} Token{webhook.tokens_cost !== 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/execute/${webhook.id}`)}
                        disabled={!webhook.is_active}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ausführen
                      </Button>
                      {isAdmin && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditDialog(webhook)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => openDeleteDialog(webhook)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
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

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Webhook bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Webhook-Einstellungen
              </DialogDescription>
            </DialogHeader>
            
            {editingWebhook && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editingWebhook.name}
                      onChange={(e) => setEditingWebhook(prev => prev ? { ...prev, name: e.target.value } : null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-method">HTTP Methode</Label>
                    <Select 
                      value={editingWebhook.method} 
                      onValueChange={(value: 'GET' | 'POST' | 'PUT' | 'DELETE') => 
                        setEditingWebhook(prev => prev ? { ...prev, method: value } : null)
                      }
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
                  <Label htmlFor="edit-url">URL</Label>
                  <Input
                    id="edit-url"
                    type="url"
                    value={editingWebhook.url}
                    onChange={(e) => setEditingWebhook(prev => prev ? { ...prev, url: e.target.value } : null)}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Beschreibung</Label>
                  <Textarea
                    id="edit-description"
                    value={editingWebhook.description || ''}
                    onChange={(e) => setEditingWebhook(prev => prev ? { ...prev, description: e.target.value } : null)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Input-Typ</Label>
                    <Select 
                      value={editingWebhook.input_type} 
                      onValueChange={(value: 'TEXT' | 'FILE') => 
                        setEditingWebhook(prev => prev ? { ...prev, input_type: value } : null)
                      }
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
                      value={editingWebhook.output_type} 
                      onValueChange={(value: 'TEXT' | 'FILE') => 
                        setEditingWebhook(prev => prev ? { ...prev, output_type: value } : null)
                      }
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
                  <Label htmlFor="edit-tokens">Token-Kosten</Label>
                  <Input
                    id="edit-tokens"
                    type="number"
                    min="1"
                    value={editingWebhook.tokens_cost}
                    onChange={(e) => setEditingWebhook(prev => prev ? { ...prev, tokens_cost: parseInt(e.target.value) || 1 } : null)}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-headers">HTTP Headers (JSON)</Label>
                  <Textarea
                    id="edit-headers"
                    value={editingWebhook.headers as string}
                    onChange={(e) => setEditingWebhook(prev => prev ? { ...prev, headers: e.target.value } : null)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-active"
                    checked={editingWebhook.is_active}
                    onCheckedChange={(checked) => setEditingWebhook(prev => prev ? { ...prev, is_active: checked } : null)}
                  />
                  <Label htmlFor="edit-active">Webhook aktiv</Label>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={updateWebhook} disabled={isUpdating}>
                {isUpdating ? "Speichere..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Webhook löschen</AlertDialogTitle>
              <AlertDialogDescription>
                Sind Sie sicher, dass Sie den Webhook "{webhookToDelete?.name}" löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction 
                onClick={deleteWebhook}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Lösche..." : "Löschen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Webhooks;